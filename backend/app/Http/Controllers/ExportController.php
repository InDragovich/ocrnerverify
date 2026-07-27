<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\VerifikasiBiayaRutin;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Ekspor data hasil verifikasi ke CSV untuk keperluan rekapitulasi dan analisis.
 *
 * Dua sudut pandang disediakan:
 * - dokumen(): satu baris per dokumen, untuk melihat hasil dan waktu per jalur ekstraksi.
 * - batch(): satu baris per pelaksanaan verifikasi otomatis, diambil dari log audit.
 */
class ExportController extends Controller
{
    public function dokumen(Request $request): StreamedResponse
    {
        $user = $request->user();

        $query = VerifikasiBiayaRutin::with('operator')
            ->where($user->wilayahScope())
            ->orderBy('id');

        foreach (['kategori', 'tahun', 'triwulan', 'periode', 'regional', 'kcu', 'kpc', 'status_verifikasi', 'hasil_kesesuaian'] as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->input($filter));
            }
        }

        $kolom = [
            'id', 'nama_rekening', 'regional', 'kcu', 'kpc', 'operator',
            'tahun', 'triwulan', 'periode', 'nominal_pelaporan', 'nominal_ner',
            'kategori_ner', 'periode_ner', 'metode_ekstraksi',
            'waktu_modul_detik', 'waktu_ujung_ke_ujung_detik',
            'status_verifikasi', 'hasil_kesesuaian', 'catatan', 'error_message',
            'diverifikasi_pada',
        ];

        return $this->streamCsv('verifikasi-dokumen', $kolom, function () use ($query) {
            foreach ($query->cursor() as $v) {
                $entitas = $v->hasil_entitas ?? [];

                yield [
                    $v->id,
                    $v->kategori,
                    $v->regional,
                    $v->kcu,
                    $v->kpc,
                    $v->operator?->name,
                    $v->tahun,
                    $v->triwulan,
                    $v->periode,
                    $v->nominal_pelaporan,
                    $entitas['nominal'] ?? null,
                    $entitas['kategori'] ?? null,
                    $entitas['periode'] ?? null,
                    $v->metode_ekstraksi,
                    self::detik($v->waktu_ocr_ner_ms),
                    self::detik($v->waktu_pemrosesan_ms),
                    $v->status_verifikasi,
                    $v->hasil_kesesuaian,
                    $v->catatan_verifikator,
                    $v->error_message,
                    $v->verified_at?->format('Y-m-d H:i:s'),
                ];
            }
        });
    }

    public function batch(Request $request): StreamedResponse
    {
        $user = $request->user();

        $query = AuditLog::with('user')
            ->where('action', 'batch_verify_completed')
            ->orderBy('created_at');

        // Verifikator hanya melihat pelaksanaan yang ia jalankan sendiri;
        // super admin melihat seluruhnya.
        if ($user->role !== 'super_admin') {
            $query->where('user_id', $user->id);
        }

        $kolom = [
            'waktu_pelaksanaan', 'verifikator', 'jumlah_dokumen',
            'total_waktu_detik', 'rata_rata_per_dokumen_detik',
        ];

        return $this->streamCsv('verifikasi-batch', $kolom, function () use ($query) {
            foreach ($query->cursor() as $log) {
                $nilai = $log->new_values ?? [];

                yield [
                    $log->created_at?->format('Y-m-d H:i:s'),
                    $log->user?->name,
                    $nilai['total'] ?? null,
                    self::detik($nilai['waktu_batch_ms'] ?? null),
                    self::detik($nilai['waktu_rata_rata_ms'] ?? null),
                ];
            }
        });
    }

    /** Milidetik menjadi detik dengan tiga desimal, memakai titik agar aman diolah perangkat lunak statistik. */
    private static function detik(?int $ms): ?string
    {
        return $ms === null ? null : number_format($ms / 1000, 3, '.', '');
    }

    private function streamCsv(string $namaBerkas, array $kolom, callable $baris): StreamedResponse
    {
        $namaLengkap = $namaBerkas . '-' . now()->format('Ymd-His') . '.csv';

        return response()->streamDownload(function () use ($kolom, $baris) {
            $out = fopen('php://output', 'w');

            // BOM UTF-8 agar Excel membaca karakter non-ASCII dengan benar.
            fwrite($out, "\xEF\xBB\xBF");

            fputcsv($out, $kolom);
            foreach ($baris() as $row) {
                fputcsv($out, $row);
            }

            fclose($out);
        }, $namaLengkap, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
