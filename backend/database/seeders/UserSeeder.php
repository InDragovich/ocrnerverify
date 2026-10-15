<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    /**
     * Password akun demo publik. Sengaja tidak rahasia karena ditampilkan di
     * halaman login; akun ini hanya operator dan verifikator tanpa akses admin.
     */
    private const DEMO_PASSWORD = 'demo1234';

    public function run(): void
    {
        $this->seedDemoAccounts();

        // Password akun lain dibaca dari env agar tidak ada password default
        // yang berlaku di production. Default 'password' hanya untuk lokal.
        $password = env('SEED_PASSWORD')
            ?: (app()->environment('local', 'testing') ? 'password' : null);

        if ($password === null) {
            $this->command?->warn('SEED_PASSWORD belum diisi, akun staf tidak dibuat (akun demo tetap dibuat).');

            return;
        }

        $users = [
            [
                'name' => 'Budi Santoso',
                'username' => 'input_jkt',
                'password' => $password,
                'role' => 'operator',
                'region' => 'Jakarta',
                'kcu' => 'KCU Jakarta Utara',
                'kcp' => 'KPC Tanjung Priok',
            ],
            [
                'name' => 'Siti Aminah',
                'username' => 'input_medan',
                'password' => $password,
                'role' => 'operator',
                'region' => 'Medan',
                'kcu' => 'KCU Medan',
                'kcp' => 'KPC Medanpayageli',
            ],
            [
                'name' => 'Agus Salim',
                'username' => 'input_sby',
                'password' => $password,
                'role' => 'operator',
                'region' => 'Surabaya',
                'kcu' => 'KCU Surabaya Gubeng',
                'kcp' => 'KPC Dharmawangsa',
            ],
            [
                'name' => 'Rina Wati',
                'username' => 'input_mks',
                'password' => $password,
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
                'password' => $password,
                'role' => 'operator',
                'region' => null,
                'kcu' => null,
                'kcp' => null,
            ],
            [
                'name' => 'Admin Verifikator',
                'username' => 'verificator',
                'password' => $password,
                'role' => 'verifikator',
                'region' => null,
                'kcu' => null,
                'kcp' => null,
            ],
            [
                'name' => 'Super Administrator',
                'username' => 'superadmin',
                'password' => $password,
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

    private function seedDemoAccounts(): void
    {
        $demo = [
            ['name' => 'Demo Operator', 'username' => 'demo_operator', 'role' => 'operator'],
            ['name' => 'Demo Verifikator', 'username' => 'demo_verifikator', 'role' => 'verifikator'],
        ];

        foreach ($demo as $akun) {
            User::firstOrCreate(
                ['username' => $akun['username']],
                $akun + ['password' => self::DEMO_PASSWORD, 'region' => null, 'kcu' => null, 'kcp' => null],
            );
        }
    }
}
