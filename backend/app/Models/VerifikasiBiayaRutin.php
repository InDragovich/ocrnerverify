<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class VerifikasiBiayaRutin extends Model
{
    use SoftDeletes;

    protected $table = 'verifikasi_biaya_rutin';

    protected $fillable = [
        'user_id',
        'verifikator_id',
        'kategori',
        'tahun',
        'triwulan',
        'periode',
        'regional',
        'kcu',
        'kpc',
        'nominal_pelaporan',
        'lampiran_path',
        'lampiran_nama_asli',
        'status_verifikasi',
        'hasil_kesesuaian',
        'catatan_verifikator',
        'hasil_ekstraksi_teks',
        'hasil_entitas',
        'error_message',
        'metode_ekstraksi',
        'waktu_ocr_ner_ms',
        'waktu_pemrosesan_ms',
        'verified_at',
    ];

    protected function casts(): array
    {
        return [
            'tahun' => 'integer',
            'triwulan' => 'integer',
            'nominal_pelaporan' => 'integer',
            'hasil_entitas' => 'array',
            'waktu_ocr_ner_ms' => 'integer',
            'waktu_pemrosesan_ms' => 'integer',
            'verified_at' => 'datetime',
        ];
    }

    public function operator()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function verifikator()
    {
        return $this->belongsTo(User::class, 'verifikator_id');
    }
}
