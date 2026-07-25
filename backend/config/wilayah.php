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

];
