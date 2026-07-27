/**
 * Pemformatan waktu pemrosesan.
 *
 * Waktu disimpan di basis data sebagai milidetik (integer) agar bebas galat
 * pembulatan saat dijumlahkan. Untuk pembaca, nilainya ditampilkan dalam detik
 * dengan pemisah desimal koma sesuai kaidah penulisan Bahasa Indonesia.
 */

/** Contoh: 4820 → "4,82 detik". Nilai null/undefined → "—". */
export function formatDurasi(ms: number | null | undefined): string {
    if (ms === null || ms === undefined) return '—';
    const detik = ms / 1000;
    return `${detik.toLocaleString('id-ID', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })} detik`;
}

/**
 * Sama seperti formatDurasi, tetapi durasi di atas satu menit ditulis sebagai
 * menit dan detik karena angka seperti "134,27 detik" sulit dibayangkan.
 * Contoh: 134270 → "2 menit 14 detik".
 */
export function formatDurasiPanjang(ms: number | null | undefined): string {
    if (ms === null || ms === undefined) return '—';
    if (ms < 60000) return formatDurasi(ms);

    const totalDetik = Math.round(ms / 1000);
    const menit = Math.floor(totalDetik / 60);
    const detik = totalDetik % 60;
    return detik === 0 ? `${menit} menit` : `${menit} menit ${detik} detik`;
}
