<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $users = [
            [
                'name' => 'Budi Santoso',
                'username' => 'input_jkt',
                'password' => 'password',
                'role' => 'operator',
                'region' => 'Jakarta',
                'kcu' => 'KCU Jakarta Utara',
                'kcp' => 'KPC Tanjung Priok',
            ],
            [
                'name' => 'Siti Aminah',
                'username' => 'input_medan',
                'password' => 'password',
                'role' => 'operator',
                'region' => 'Medan',
                'kcu' => 'KCU Medan',
                'kcp' => 'KPC Medanpayageli',
            ],
            [
                'name' => 'Agus Salim',
                'username' => 'input_sby',
                'password' => 'password',
                'role' => 'operator',
                'region' => 'Surabaya',
                'kcu' => 'KCU Surabaya Gubeng',
                'kcp' => 'KPC Dharmawangsa',
            ],
            [
                'name' => 'Rina Wati',
                'username' => 'input_mks',
                'password' => 'password',
                'role' => 'operator',
                'region' => 'Makassar',
                'kcu' => 'KCU Makassar',
                'kcp' => 'KPC Pettarani',
            ],
            [
                // Operator lintas wilayah: region dikosongkan sehingga dapat
                // menginput dokumen untuk seluruh regional/KCU/KPC. Dipakai
                // untuk menyiapkan data simulasi pengujian.
                'name' => 'Operator Pusat',
                'username' => 'operator',
                'password' => 'password',
                'role' => 'operator',
                'region' => null,
                'kcu' => null,
                'kcp' => null,
            ],
            [
                'name' => 'Admin Verifikator',
                'username' => 'verificator',
                'password' => 'password',
                'role' => 'verifikator',
                'region' => null,
                'kcu' => null,
                'kcp' => null,
            ],
            [
                'name' => 'Super Administrator',
                'username' => 'superadmin',
                'password' => 'password',
                'role' => 'super_admin',
                'region' => null,
                'kcu' => null,
                'kcp' => null,
            ],
        ];

        // Dicocokkan per username, bukan create langsung. Seeder ini ikut
        // dijalankan pada tiap deploy, sehingga satu akun yang sudah ada akan
        // menggagalkan unique constraint dan membatalkan sisa daftar di
        // bawahnya. Akibatnya akun yang ditambahkan belakangan tidak pernah
        // terbuat di lingkungan yang sudah pernah di-seed.
        foreach ($users as $userData) {
            User::firstOrCreate(
                ['username' => $userData['username']],
                $userData,
            );
        }
    }
}
