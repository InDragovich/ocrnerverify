<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasFactory, Notifiable, HasApiTokens;

    protected $fillable = [
        'name',
        'username',
        'password',
        'role',
        'region',
        'kcu',
        'kcp',
        'is_active',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    public function verifikasiData()
    {
        return $this->hasMany(VerifikasiBiayaRutin::class, 'user_id');
    }

    public function verifikasiAsVerifikator()
    {
        return $this->hasMany(VerifikasiBiayaRutin::class, 'verifikator_id');
    }

    public function auditLogs()
    {
        return $this->hasMany(AuditLog::class, 'user_id');
    }

    public function isOperator(): bool
    {
        return $this->role === 'operator';
    }

    /**
     * Operator lintas wilayah: operator yang region-nya dikosongkan sehingga
     * boleh memilih sendiri regional/KCU/KPC dokumen saat menginput data.
     * Operator yang region-nya terisi tetap terkunci pada wilayah profilnya.
     */
    public function isOperatorLintasWilayah(): bool
    {
        return $this->isOperator() && blank($this->region);
    }

    public function isVerifikator(): bool
    {
        return $this->role === 'verifikator';
    }

    public function isSuperAdmin(): bool
    {
        return $this->role === 'super_admin';
    }

    /**
     * Batas wilayah kerja verifikator, sebagai pasangan kolom => nilai.
     *
     * Bertingkat dan opsional: kolom yang dikosongkan berarti "semua" pada
     * level tersebut. Region kosong = semua wilayah; region terisi tapi KCU
     * kosong = seluruh KCU dalam region itu; begitu seterusnya.
     * Array kosong berarti tanpa pembatasan sama sekali.
     *
     * @return array<string, string>
     */
    public function wilayahScope(): array
    {
        if (!$this->isVerifikator()) {
            return [];
        }

        return array_filter([
            'regional' => $this->region,
            'kcu' => $this->kcu,
            'kpc' => $this->kcp,
        ], fn ($value) => filled($value));
    }
}
