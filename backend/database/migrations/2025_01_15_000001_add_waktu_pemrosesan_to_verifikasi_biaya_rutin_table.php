<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('verifikasi_biaya_rutin', function (Blueprint $table) {
            // Waktu disimpan dalam milidetik (integer) agar bebas galat pembulatan
            // saat dijumlahkan/dirata-ratakan. Konversi ke detik dilakukan di UI.
            //
            // waktu_ocr_ner_ms : waktu murni pemrosesan di layanan OCR-NER
            //                    (nilai `waktu_total` dari respons FastAPI).
            // waktu_pemrosesan_ms : waktu ujung ke ujung dari sisi Laravel,
            //                    termasuk transfer berkas dan overhead HTTP.
            $table->unsignedInteger('waktu_ocr_ner_ms')->nullable()->after('error_message');
            $table->unsignedInteger('waktu_pemrosesan_ms')->nullable()->after('waktu_ocr_ner_ms');
        });
    }

    public function down(): void
    {
        Schema::table('verifikasi_biaya_rutin', function (Blueprint $table) {
            $table->dropColumn(['waktu_ocr_ner_ms', 'waktu_pemrosesan_ms']);
        });
    }
};
