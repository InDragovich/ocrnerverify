<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessVerifikasiJob;
use App\Models\VerifikasiBiayaRutin;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BatchVerifikasiController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer|exists:verifikasi_biaya_rutin,id',
        ]);

        $user = $request->user();
        $ids = $request->ids;

        $items = VerifikasiBiayaRutin::whereIn('id', $ids)
            ->where($user->wilayahScope())
            ->whereIn('status_verifikasi', ['menunggu', 'gagal', 'diproses'])
            ->get();

        if ($items->isEmpty()) {
            return response()->json([
                'message' => 'Tidak ada data yang dapat diproses. Pastikan data berstatus "menunggu", "gagal", atau "diproses".',
                'total_jobs' => 0,
                'ids' => [],
            ], 422);
        }

        $processedIds = [];

        foreach ($items as $item) {
            $item->update([
                'status_verifikasi' => 'diproses',
                'error_message' => null,
            ]);
            $processedIds[] = $item->id;
        }

        AuditService::log(
            'batch_verify_initiated',
            null,
            null,
            null,
            ['ids' => $processedIds, 'total' => count($processedIds)],
        );

        // Process jobs synchronously so no queue worker is needed.
        // Wrap each job in try-catch so one failure doesn't stop the rest.
        // Batch berjalan sinkron, sehingga durasi seluruh proses dapat diukur
        // langsung di sini tanpa perlu bergantung pada waktu di sisi peramban.
        $batchStart = microtime(true);

        foreach ($processedIds as $id) {
            try {
                ProcessVerifikasiJob::dispatchSync($id, $user->id);
            } catch (\Throwable $e) {
                // Job already handles its own failures via markFailed(),
                // but catch any unexpected exception to prevent batch abort.
                $item = VerifikasiBiayaRutin::find($id);
                if ($item && $item->status_verifikasi === 'diproses') {
                    $item->update([
                        'status_verifikasi' => 'gagal',
                        'error_message' => 'Processing error: ' . $e->getMessage(),
                    ]);
                }
            }
        }

        $waktuBatchMs = (int) round((microtime(true) - $batchStart) * 1000);
        $totalJobs = count($processedIds);

        AuditService::log(
            'batch_verify_completed',
            null,
            null,
            null,
            [
                'total' => $totalJobs,
                'waktu_batch_ms' => $waktuBatchMs,
                'waktu_rata_rata_ms' => $totalJobs > 0 ? (int) round($waktuBatchMs / $totalJobs) : null,
            ],
        );

        return response()->json([
            'message' => 'Batch verifikasi selesai.',
            'total_jobs' => $totalJobs,
            'ids' => $processedIds,
            'waktu_batch_ms' => $waktuBatchMs,
            'waktu_rata_rata_ms' => $totalJobs > 0 ? (int) round($waktuBatchMs / $totalJobs) : null,
        ]);
    }

    public function status(Request $request): JsonResponse
    {
        $request->validate([
            'ids' => 'required|string',
        ]);

        $ids = array_map('intval', explode(',', $request->ids));

        $items = VerifikasiBiayaRutin::whereIn('id', $ids)
            ->where($request->user()->wilayahScope())
            ->select('id', 'status_verifikasi', 'hasil_kesesuaian', 'catatan_verifikator', 'error_message', 'waktu_ocr_ner_ms', 'waktu_pemrosesan_ms')
            ->get();

        // "menunggu_review" berarti proses otomatis selesai (menunggu tinjauan manusia),
        // sehingga dari sisi progress batch dihitung sebagai completed.
        $completed = $items->whereIn('status_verifikasi', ['selesai', 'gagal', 'menunggu_review'])->count();
        $processing = $items->where('status_verifikasi', 'diproses')->count();
        $failed = $items->where('status_verifikasi', 'gagal')->count();

        return response()->json([
            'total' => $items->count(),
            'completed' => $completed,
            'processing' => $processing,
            'failed' => $failed,
            'items' => $items,
        ]);
    }
}
