<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('verifikasi_biaya_rutin', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('verifikator_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('kategori', 100);
            $table->smallInteger('tahun')->unsigned();
            $table->tinyInteger('triwulan')->unsigned();
            $table->string('periode', 20);
            $table->string('regional', 100);
            $table->string('kcu', 100);
            $table->string('kpc', 100);
            $table->bigInteger('nominal_pelaporan')->unsigned();
            $table->string('lampiran_path', 500);
            $table->string('lampiran_nama_asli', 255);
            $table->string('status_verifikasi', 20)->default('menunggu'); // menunggu, diproses, menunggu_review, selesai, gagal
            $table->string('hasil_kesesuaian', 20)->default('belum_ditentukan'); // sesuai, tidak_sesuai, belum_ditentukan
            $table->text('catatan_verifikator')->nullable();
            $table->longText('hasil_ekstraksi_teks')->nullable();
            $table->json('hasil_entitas')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('status_verifikasi');
            $table->index('hasil_kesesuaian');
            $table->index(['kategori', 'tahun', 'triwulan']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('verifikasi_biaya_rutin');
    }
};
