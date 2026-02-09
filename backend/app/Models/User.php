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

    public function isVerifikator(): bool
    {
        return $this->role === 'verifikator';
    }

    public function isSuperAdmin(): bool
    {
        return $this->role === 'super_admin';
    }
}
