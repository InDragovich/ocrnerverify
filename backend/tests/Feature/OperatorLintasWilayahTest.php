<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\VerifikasiBiayaRutin;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class OperatorLintasWilayahTest extends TestCase
{
    use RefreshDatabase;

    private function operator(array $wilayah): User
    {
        static $urutan = 0;

        return User::create(array_merge([
            'name' => 'Operator Uji',
            'username' => 'operator_uji_' . ++$urutan,
            'password' => 'password',
            'role' => 'operator',
            'is_active' => true,
        ], $wilayah));
    }

    private function payload(array $extra = []): array
    {
        return array_merge([
            'kategori' => 'Listrik',
            'tahun' => 2026,
            'triwulan' => 1,
            'periode' => 'Januari',
            'nominal_pelaporan' => 234302,
            'lampiran' => UploadedFile::fake()->create('laporan.pdf', 100, 'application/pdf'),
        ], $extra);
    }

    public function test_operator_lintas_wilayah_menentukan_wilayah_dokumen_dari_form(): void
    {
        Storage::fake('local');

        $operator = $this->operator([
            'region' => null,
            'kcu' => null,
            'kcp' => null,
        ]);

        $this->actingAs($operator)
            ->postJson('/api/verifikasi', $this->payload([
                'regional' => 'Medan',
                'kcu' => 'KCU Medan',
                'kpc' => 'KPC Medanpayageli',
            ]))
            ->assertCreated();

        $this->assertDatabaseHas('verifikasi_biaya_rutin', [
            'user_id' => $operator->id,
            'regional' => 'Medan',
            'kcu' => 'KCU Medan',
            'kpc' => 'KPC Medanpayageli',
        ]);
    }

    public function test_operator_lintas_wilayah_dapat_menginput_ke_beberapa_regional(): void
    {
        Storage::fake('local');

        $operator = $this->operator(['region' => null]);

        // Lima regional yang dipakai skenario simulasi pengujian.
        foreach (['Medan', 'Jakarta', 'Bandung', 'Surabaya', 'Makassar'] as $regional) {
            $kcu = array_key_first(config("wilayah.struktur.{$regional}"));
            $kpc = config("wilayah.struktur.{$regional}.{$kcu}")[0];

            $this->actingAs($operator)
                ->postJson('/api/verifikasi', $this->payload([
                    'regional' => $regional,
                    'kcu' => $kcu,
                    'kpc' => $kpc,
                ]))
                ->assertCreated();
        }

        $this->assertSame(5, VerifikasiBiayaRutin::distinct('regional')->count('regional'));
    }

    public function test_kombinasi_wilayah_di_luar_master_ditolak(): void
    {
        Storage::fake('local');

        $operator = $this->operator(['region' => null]);

        $this->actingAs($operator)
            ->postJson('/api/verifikasi', $this->payload([
                'regional' => 'Medan',
                'kcu' => 'KCU Medan',
                'kpc' => 'KPC Pettarani', // milik regional Makassar
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('kpc');
    }

    public function test_operator_terikat_wilayah_tetap_memakai_penempatan_profilnya(): void
    {
        Storage::fake('local');

        $operator = $this->operator([
            'region' => 'Jakarta',
            'kcu' => 'KCU Jakarta Utara',
            'kcp' => 'KPC Tanjung Priok',
        ]);

        // Wilayah yang dikirim di body harus diabaikan.
        $this->actingAs($operator)
            ->postJson('/api/verifikasi', $this->payload([
                'regional' => 'Medan',
                'kcu' => 'KCU Medan',
                'kpc' => 'KPC Medanpayageli',
            ]))
            ->assertCreated();

        $this->assertDatabaseHas('verifikasi_biaya_rutin', [
            'user_id' => $operator->id,
            'regional' => 'Jakarta',
            'kcu' => 'KCU Jakarta Utara',
            'kpc' => 'KPC Tanjung Priok',
        ]);
    }
}
