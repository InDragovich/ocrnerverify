<?php

namespace App\Jobs;

use App\Models\VerifikasiBiayaRutin;
use App\Services\AuditService;
use App\Services\MatchingService;
use App\Services\OcrNerService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class ProcessVerifikasiJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 120;

    public function __construct(
        public int $verifikasiId,
        public ?int $verifikatorId = null,
    ) {}

    public function handle(OcrNerService $ocrNerService, MatchingService $matchingService): void
    {
        $verifikasi = VerifikasiBiayaRutin::find($this->verifikasiId);

        if (!$verifikasi) {
            Log::warning("ProcessVerifikasiJob: Record #{$this->verifikasiId} not found");
            return;
        }

        try {
            $useMock = config('ocr_ner.use_mock', true);

            // Get file path — only require actual file when using real API
            $filePath = Storage::disk('local')->path($verifikasi->lampiran_path);

            if (!$useMock && !file_exists($filePath)) {
                $this->markFailed($verifikasi, 'File lampiran tidak ditemukan di storage');
                return;
            }

            // Call OCR-NER (mock runs in-process, real API sends the file)
            $ocrResult = $ocrNerService->extract($filePath, $verifikasi->lampiran_nama_asli, [
                'kategori' => $verifikasi->kategori,
                'periode' => $verifikasi->periode,
                'nominal' => $verifikasi->nominal_pelaporan,
            ]);

            // Save OCR text regardless of status
            $verifikasi->hasil_ekstraksi_teks = $ocrResult['text_ocr'];

            if ($ocrResult['status'] === 'failed') {
                $this->markFailed($verifikasi, $ocrResult['error_message'] ?? 'OCR-NER extraction failed');
                return;
            }

            // Save entities
            $verifikasi->hasil_entitas = $ocrResult['entities'];

            // Perform matching
            $inputData = [
                'kategori' => $verifikasi->kategori,
                'periode' => $verifikasi->periode . ' ' . $verifikasi->tahun,
                'nominal_pelaporan' => $verifikasi->nominal_pelaporan,
            ];

            $matchResult = $matchingService->match($inputData, $ocrResult['entities']);

            // Handle partial_success - note undetected entities
            if ($ocrResult['status'] === 'partial_success') {
                $matchResult['catatan'] .= ' (Catatan: Sebagian entitas tidak terdeteksi oleh NER)';
            }

            // Update record
            $verifikasi->hasil_kesesuaian = $matchResult['hasil_kesesuaian'];
            $verifikasi->catatan_verifikator = $matchResult['catatan'];
            $verifikasi->status_verifikasi = 'selesai';
            $verifikasi->verifikator_id = $this->verifikatorId;
            $verifikasi->verified_at = now();
            $verifikasi->save();

            AuditService::log(
                'auto_verify_completed',
                VerifikasiBiayaRutin::class,
                $verifikasi->id,
                null,
                [
                    'hasil_kesesuaian' => $matchResult['hasil_kesesuaian'],
                    'matching_detail' => $matchResult['detail'],
                ],
                $this->verifikatorId,
            );

        } catch (\Exception $e) {
            Log::error("ProcessVerifikasiJob error for #{$this->verifikasiId}: " . $e->getMessage());
            $this->markFailed($verifikasi, 'Processing error: ' . $e->getMessage());
        }
    }

    private function markFailed(VerifikasiBiayaRutin $verifikasi, string $errorMessage): void
    {
        $verifikasi->status_verifikasi = 'gagal';
        $verifikasi->error_message = $errorMessage;
        $verifikasi->save();

        AuditService::log(
            'auto_verify_failed',
            VerifikasiBiayaRutin::class,
            $verifikasi->id,
            null,
            ['error_message' => $errorMessage],
            $this->verifikatorId,
        );
    }

    public function failed(\Throwable $exception): void
    {
        Log::error("ProcessVerifikasiJob failed permanently for #{$this->verifikasiId}: " . $exception->getMessage());

        $verifikasi = VerifikasiBiayaRutin::find($this->verifikasiId);
        if ($verifikasi) {
            $this->markFailed($verifikasi, 'Job failed after retries: ' . $exception->getMessage());
        }
    }
}
