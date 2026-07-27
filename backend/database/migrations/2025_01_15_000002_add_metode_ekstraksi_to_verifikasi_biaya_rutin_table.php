<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('verifikasi_biaya_rutin', function (Blueprint $table) {
            // Jalur ekstraksi yang dipakai modul: "OCR" untuk dokumen gambar,
            // "Teks PDF" untuk PDF berlapis teks. Disimpan agar waktu pemrosesan
            // dapat dilaporkan terpisah per jalur, bukan dirata-ratakan bersama.
            $table->string('metode_ekstraksi', 20)->nullable()->after('hasil_entitas');
        });
    }

    public function down(): void
    {
        Schema::table('verifikasi_biaya_rutin', function (Blueprint $table) {
            $table->dropColumn('metode_ekstraksi');
        });
    }
};
