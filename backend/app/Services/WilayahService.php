<?php

namespace App\Services;

/**
 * Akses terpusat ke daftar master wilayah pada config/wilayah.php.
 *
 * Dipakai untuk mengisi pilihan wilayah di form input dan untuk memvalidasi
 * bahwa kombinasi regional/KCU/KPC yang dikirim benar-benar ada di master.
 */
class WilayahService
{
    /**
     * @return array<string, array<string, array<int, string>>>
     */
    public static function struktur(): array
    {
        return config('wilayah.struktur', []);
    }

    /**
     * @return array<int, string>
     */
    public static function regionalList(): array
    {
        return array_keys(static::struktur());
    }

    /**
     * @return array<int, string>
     */
    public static function kcuList(?string $regional): array
    {
        return array_keys(static::struktur()[$regional] ?? []);
    }

    /**
     * @return array<int, string>
     */
    public static function kpcList(?string $regional, ?string $kcu): array
    {
        return static::struktur()[$regional][$kcu] ?? [];
    }

    /**
     * Benar bila kombinasi ketiganya persis ada pada daftar master.
     */
    public static function kombinasiValid(?string $regional, ?string $kcu, ?string $kpc): bool
    {
        return in_array($kpc, static::kpcList($regional, $kcu), true);
    }
}
