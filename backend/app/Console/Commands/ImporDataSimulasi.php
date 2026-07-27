<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Models\VerifikasiBiayaRutin;
use App\Services\AuditService;
use App\Services\WilayahService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * Mengisi tabel verifikasi dari berkas manifest, meniru jalur unggah operator:
 * lampiran disalin ke storage dan tiap baris dicatat pada audit log.
 *
 * Dipakai untuk menyiapkan data simulasi pengujian dalam jumlah banyak, yang
 * bila diinput satu per satu lewat antarmuka akan memakan waktu lama.
 */
class ImporDataSimulasi extends Command
{
    protected $signature = 'simulasi:impor
                            {manifest : Berkas JSON berisi daftar data dan path lampirannya}
                            {--operator=operator : Username operator yang dicatat sebagai penginput}
                            {--force : Jalankan tanpa meminta konfirmasi}';

    protected $description = 'Mengimpor data simulasi beserta lampirannya dari berkas manifest';

    public function handle(): int
    {
        $manifestPath = $this->argument('manifest');

        if (!is_file($manifestPath)) {
            $this->error("Manifest tidak ditemukan: {$manifestPath}");

            return self::FAILURE;
        }

        $baris = json_decode(file_get_contents($manifestPath), true);

        if (!is_array($baris) || $baris === []) {
            $this->error('Manifest kosong atau bukan JSON yang valid.');

            return self::FAILURE;
        }

        $operator = User::where('username', $this->option('operator'))->first();

        if (!$operator) {
            $this->error("Operator '{$this->option('operator')}' tidak ada. Jalankan db:seed lebih dulu.");

            return self::FAILURE;
        }

        if (($galat = $this->periksa($baris)) !== []) {
            $this->error('Manifest belum lolos pemeriksaan:');
            foreach ($galat as $pesan) {
                $this->line("  - {$pesan}");
            }

            return self::FAILURE;
        }

        $jumlahSalah = count(array_filter($baris, fn ($b) => $b['disengaja_salah'] ?? false));

        $this->info(count($baris) . ' data akan diimpor sebagai operator ' . $operator->username . '.');
        $this->line(sprintf(
            '  %d data selaras dengan dokumen, %d data dengan kesalahan input yang disengaja.',
            count($baris) - $jumlahSalah,
            $jumlahSalah,
        ));

        if (!$this->option('force') && !$this->confirm('Lanjutkan?', false)) {
            $this->info('Dibatalkan.');

            return self::SUCCESS;
        }

        $bar = $this->output->createProgressBar(count($baris));
        $bar->start();

        foreach ($baris as $data) {
            // Lampiran disalin, bukan dipindah, agar berkas sumber tetap utuh.
            $isi = file_get_contents($data['berkas']);
            $path = 'lampiran/' . uniqid('', true) . '.' . pathinfo($data['nama_berkas'], PATHINFO_EXTENSION);
            Storage::disk('local')->put($path, $isi);

            $verifikasi = VerifikasiBiayaRutin::create([
                'user_id' => $operator->id,
                'kategori' => $data['kategori'],
                'tahun' => $data['tahun'],
                'triwulan' => $data['triwulan'],
                'periode' => $data['periode'],
                'regional' => $data['regional'],
                'kcu' => $data['kcu'],
                'kpc' => $data['kpc'],
                'nominal_pelaporan' => $data['nominal_pelaporan'],
                'lampiran_path' => $path,
                'lampiran_nama_asli' => $data['nama_berkas'],
                'status_verifikasi' => 'menunggu',
                'hasil_kesesuaian' => 'belum_ditentukan',
            ]);

            AuditService::log(
                'create',
                VerifikasiBiayaRutin::class,
                $verifikasi->id,
                null,
                $verifikasi->toArray(),
                $operator->id,
            );

            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);
        $this->info(count($baris) . ' data berhasil diimpor dengan status menunggu verifikasi.');
        $this->line('Jalankan verifikasi batch dari dashboard verifikator untuk menguji hasilnya.');

        return self::SUCCESS;
    }

    /**
     * Memeriksa seluruh manifest sebelum satu baris pun ditulis, supaya impor
     * tidak berhenti separuh jalan dan meninggalkan data yang tidak lengkap.
     *
     * @return list<string>
     */
    private function periksa(array $baris): array
    {
        $galat = [];
        $wajib = ['berkas', 'nama_berkas', 'kategori', 'tahun', 'triwulan',
                  'periode', 'regional', 'kcu', 'kpc', 'nominal_pelaporan'];

        foreach ($baris as $i => $data) {
            $nomor = $i + 1;

            foreach ($wajib as $kolom) {
                if (!isset($data[$kolom]) || $data[$kolom] === '') {
                    $galat[] = "baris {$nomor}: kolom '{$kolom}' kosong";
                }
            }

            if (isset($data['berkas']) && !is_file($data['berkas'])) {
                $galat[] = "baris {$nomor}: lampiran tidak ditemukan ({$data['berkas']})";
            }

            if (isset($data['regional'], $data['kcu'], $data['kpc'])
                && !WilayahService::kombinasiValid($data['regional'], $data['kcu'], $data['kpc'])) {
                $galat[] = "baris {$nomor}: kombinasi wilayah tidak terdaftar pada data master";
            }
        }

        return $galat;
    }
}
