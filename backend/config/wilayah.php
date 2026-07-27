<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Daftar Regional Pos Indonesia
    |--------------------------------------------------------------------------
    |
    | Enam regional resmi PT Pos Indonesia. Dipakai sebagai daftar master:
    | pilihan region operator, dan penjamin bahwa dashboard verifikasi selalu
    | menampilkan keenam regional walau belum ada dokumennya.
    |
    */

    'regional' => [
        'Medan',
        'Jakarta',
        'Bandung',
        'Semarang',
        'Surabaya',
        'Makassar',
    ],

    /*
    |--------------------------------------------------------------------------
    | Alias Regional
    |--------------------------------------------------------------------------
    |
    | Pemetaan nilai lama / ejaan bebas ke nama kanonik di atas. Kunci ditulis
    | huruf kecil karena pencocokan dilakukan case-insensitive.
    |
    */

    'regional_alias' => [
        'i. medan'   => 'Medan',
        'i medan'    => 'Medan',
        'regional 1' => 'Medan',
        'regional 2' => 'Jakarta',
        'banten'     => 'Jakarta',
        'regional 3' => 'Bandung',
        'regional 4' => 'Semarang',
        'regional 5' => 'Surabaya',
        'kediri'     => 'Surabaya',
        'regional 6' => 'Makassar',
    ],

    /*
    |--------------------------------------------------------------------------
    | Struktur Wilayah: Regional => KCU => daftar KPC
    |--------------------------------------------------------------------------
    |
    | Daftar master bertingkat yang dipakai sebagai pilihan wilayah saat
    | operator lintas wilayah menginput dokumen, sekaligus sebagai acuan
    | validasi agar nama KCU/KPC yang tersimpan konsisten (tidak salah ketik).
    |
    | Setiap regional memiliki satu KCU. KPC pada urutan pertama adalah KPC
    | fokus yang dipakai pada skenario simulasi pengujian proses verifikasi
    | (10 data laporan per regional); sisanya tersedia sebagai alternatif.
    |
    */

    'struktur' => [
        'Medan' => [
            'KCU Medan' => [
                'KPC Medanpayageli',
                'KPC Medan Baru',
                'KPC Belawan',
                'KPC Medan Petisah',
                'KPC Medan Johor',
            ],
        ],
        'Jakarta' => [
            'KCU Jakarta Pusat' => [
                'KPC Pasar Baru',
                'KPC Tanjung Priok',
                'KPC Kemayoran',
                'KPC Senen',
                'KPC Cempaka Putih',
            ],
        ],
        'Bandung' => [
            'KCU Bandung' => [
                'KPC Cicendo',
                'KPC Dago',
                'KPC Kiaracondong',
                'KPC Ujungberung',
                'KPC Cimahi',
            ],
        ],
        'Semarang' => [
            'KCU Semarang' => [
                'KPC Semarang Tengah',
                'KPC Pedurungan',
                'KPC Tugu',
                'KPC Banyumanik',
                'KPC Ungaran',
            ],
        ],
        'Surabaya' => [
            'KCU Surabaya' => [
                'KPC Gubeng',
                'KPC Rungkut',
                'KPC Tanjung Perak',
                'KPC Wonokromo',
                'KPC Sidoarjo',
            ],
        ],
        'Makassar' => [
            'KCU Makassar' => [
                'KPC Panakkukang',
                'KPC Pettarani',
                'KPC Tamalanrea',
                'KPC Daya',
                'KPC Sungguminasa',
            ],
        ],
    ],

];
