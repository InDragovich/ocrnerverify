<?php

namespace App\Console\Commands;

use App\Models\VerifikasiBiayaRutin;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * Mengosongkan tabel verifikasi beserta berkas lampirannya, tanpa menyentuh
 * akun pengguna. Dipakai untuk menyiapkan kondisi awal yang bersih sebelum
 * simulasi pengujian proses verifikasi dijalankan.
 */
class BersihkanDataVerifikasi extends Command
{
    protected $signature = 'verifikasi:bersihkan
                            {--force : Jalankan tanpa meminta konfirmasi}
                            {--simpan-lampiran : Biarkan berkas lampiran di storage}';

    protected $description = 'Menghapus seluruh data verifikasi untuk menyiapkan simulasi (akun pengguna tidak terpengaruh)';

    public function handle(): int
    {
        // Baris yang sudah dihapus lunak ikut dihitung dan dihapus permanen,
        // agar tabel benar-benar kosong saat simulasi dimulai.
        $query = VerifikasiBiayaRutin::withTrashed();
        $jumlah = $query->count();

        if ($jumlah === 0) {
            $this->info('Tabel verifikasi sudah kosong. Tidak ada yang dihapus.');

            return self::SUCCESS;
        }

        $this->table(
            ['Regional', 'Jumlah Dokumen'],
            VerifikasiBiayaRutin::withTrashed()
                ->selectRaw('regional, COUNT(*) as jumlah')
                ->groupBy('regional')
                ->orderBy('regional')
                ->pluck('jumlah', 'regional')
                ->map(fn ($jumlah, $regional) => [$regional ?: '(kosong)', $jumlah])
                ->values()
                ->all(),
        );

        $this->warn("Total {$jumlah} dokumen akan dihapus permanen beserta lampirannya.");
        $this->line('Akun pengguna dan catatan audit tidak terpengaruh.');

        if (!$this->option('force') && !$this->confirm('Lanjutkan?', false)) {
            $this->info('Dibatalkan.');

            return self::SUCCESS;
        }

        $lampiranTerhapus = 0;

        if (!$this->option('simpan-lampiran')) {
            $disk = Storage::disk('local');

            VerifikasiBiayaRutin::withTrashed()
                ->whereNotNull('lampiran_path')
                ->pluck('lampiran_path')
                ->each(function (string $path) use ($disk, &$lampiranTerhapus) {
                    if ($disk->exists($path)) {
                        $disk->delete($path);
                        $lampiranTerhapus++;
                    }
                });
        }

        VerifikasiBiayaRutin::withTrashed()->forceDelete();

        $this->newLine();
        $this->info("Selesai. {$jumlah} dokumen dihapus, {$lampiranTerhapus} berkas lampiran dibersihkan.");
        $this->line('Database siap diisi data simulasi.');

        return self::SUCCESS;
    }
}
