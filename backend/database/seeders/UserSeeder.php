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
                'kcp' => 'KCP Tanjung Priok',
            ],
            [
                'name' => 'Siti Aminah',
                'username' => 'input_medan',
                'password' => 'password',
                'role' => 'operator',
                'region' => 'I. MEDAN',
                'kcu' => 'KCU MEDAN',
                'kcp' => 'MEDANPAYAGELI',
            ],
            [
                'name' => 'Agus Salim',
                'username' => 'input_sby',
                'password' => 'password',
                'role' => 'operator',
                'region' => 'Surabaya',
                'kcu' => 'KCU Surabaya Gubeng',
                'kcp' => 'KCP Dharmawangsa',
            ],
            [
                'name' => 'Rina Wati',
                'username' => 'input_mks',
                'password' => 'password',
                'role' => 'operator',
                'region' => 'Makassar',
                'kcu' => 'KCU Makassar Panakkukang',
                'kcp' => 'KCP Pettarani',
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

        foreach ($users as $userData) {
            User::create($userData);
        }
    }
}
