<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Menyeragamkan nilai regional ke enam nama kanonik Pos Indonesia.
 *
 * Sebelumnya kolom ini diisi teks bebas dari profil operator, sehingga muncul
 * variasi seperti "I. MEDAN", "kediri", dan "Banten" yang terhitung sebagai
 * regional terpisah pada dashboard verifikasi.
 */
return new class extends Migration
{
    public function up(): void
    {
        $canonical = config('wilayah.regional');
        $alias = config('wilayah.regional_alias');

        // Pencocokan case-insensitive terhadap nama kanonik itu sendiri,
        // misal "MEDAN" atau "jakarta" ikut dirapikan.
        $lookup = $alias;
        foreach ($canonical as $nama) {
            $lookup[mb_strtolower($nama)] = $nama;
        }

        foreach (['verifikasi_biaya_rutin' => 'regional', 'users' => 'region'] as $table => $column) {
            $values = DB::table($table)
                ->select($column)
                ->whereNotNull($column)
                ->where($column, '!=', '')
                ->distinct()
                ->pluck($column);

            foreach ($values as $value) {
                $target = $lookup[mb_strtolower(trim($value))] ?? null;

                if ($target !== null && $target !== $value) {
                    DB::table($table)->where($column, $value)->update([$column => $target]);
                }
            }
        }
    }

    public function down(): void
    {
        // Nilai asli tidak disimpan, normalisasi tidak dapat dibalik.
    }
};
