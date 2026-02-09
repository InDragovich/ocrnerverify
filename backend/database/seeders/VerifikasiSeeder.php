<?php

namespace Database\Seeders;

use App\Models\VerifikasiBiayaRutin;
use Illuminate\Database\Seeder;

class VerifikasiSeeder extends Seeder
{
    public function run(): void
    {
        $samples = [
            [
                'user_id' => 2,
                'kategori' => 'Listrik',
                'tahun' => 2025,
                'triwulan' => 4,
                'periode' => 'Oktober',
                'regional' => 'I. MEDAN',
                'kcu' => 'KCU MEDAN',
                'kpc' => 'MEDANPAYAGELI',
                'nominal_pelaporan' => 234302,
                'lampiran_path' => 'lampiran/sample_listrik_1.pdf',
                'lampiran_nama_asli' => 'MEDANPAYAGELI (Listrik).pdf',
            ],
            [
                'user_id' => 2,
                'kategori' => 'Listrik',
                'tahun' => 2025,
                'triwulan' => 4,
                'periode' => 'Oktober',
                'regional' => 'I. MEDAN',
                'kcu' => 'KCU MEDAN',
                'kpc' => 'PANCURBATU',
                'nominal_pelaporan' => 109980,
                'lampiran_path' => 'lampiran/sample_listrik_2.pdf',
                'lampiran_nama_asli' => 'PANCURBATU (Listrik).pdf',
            ],
            [
                'user_id' => 2,
                'kategori' => 'Listrik',
                'tahun' => 2025,
                'triwulan' => 4,
                'periode' => 'Oktober',
                'regional' => 'I. MEDAN',
                'kcu' => 'KCU MEDAN',
                'kpc' => 'NAMORAMBE',
                'nominal_pelaporan' => 449792,
                'lampiran_path' => 'lampiran/sample_listrik_3.pdf',
                'lampiran_nama_asli' => 'NAMORAMBE (Listrik).pdf',
            ],
            [
                'user_id' => 1,
                'kategori' => 'Kebersihan',
                'tahun' => 2025,
                'triwulan' => 3,
                'periode' => 'September',
                'regional' => 'Jakarta',
                'kcu' => 'KCU Jakarta Utara',
                'kpc' => 'KCP Tanjung Priok',
                'nominal_pelaporan' => 750000,
                'lampiran_path' => 'lampiran/sample_kebersihan_1.pdf',
                'lampiran_nama_asli' => 'Tanjung Priok (Kebersihan).pdf',
            ],
            [
                'user_id' => 3,
                'kategori' => 'Air',
                'tahun' => 2025,
                'triwulan' => 3,
                'periode' => 'Agustus',
                'regional' => 'Surabaya',
                'kcu' => 'KCU Surabaya Gubeng',
                'kpc' => 'KCP Dharmawangsa',
                'nominal_pelaporan' => 325000,
                'lampiran_path' => 'lampiran/sample_air_1.pdf',
                'lampiran_nama_asli' => 'Dharmawangsa (Air).pdf',
            ],
        ];

        foreach ($samples as $data) {
            VerifikasiBiayaRutin::create(array_merge($data, [
                'status_verifikasi' => 'menunggu',
                'hasil_kesesuaian' => 'belum_ditentukan',
            ]));
        }
    }
}
