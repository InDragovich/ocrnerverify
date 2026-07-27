<?php

namespace Database\Seeders;

use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Hanya akun pengguna. VerifikasiSeeder sengaja tidak dipanggil karena
        // seeder ini ikut berjalan pada tiap deploy, sehingga dokumen contoh
        // akan tercampur dengan data simulasi. Jalankan manual bila dibutuhkan:
        // php artisan db:seed --class=VerifikasiSeeder
        $this->call([
            UserSeeder::class,
        ]);
    }
}
