export const CATEGORIES = ['Listrik', 'Telepon', 'Air dan Gas'];

// Enam regional Pos Indonesia. Harus sinkron dengan backend/config/wilayah.php.
export const REGIONALS = [
    'Medan',
    'Jakarta',
    'Bandung',
    'Semarang',
    'Surabaya',
    'Makassar',
];

export const MONTHS = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export const STATUS_VERIFIKASI = {
    menunggu: { label: 'Menunggu', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    diproses: { label: 'Diproses', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    menunggu_review: { label: 'Perlu Ditinjau', color: 'bg-orange-50 text-orange-700 border-orange-200' },
    selesai: { label: 'Selesai', color: 'bg-green-50 text-green-700 border-green-200' },
    gagal: { label: 'Gagal', color: 'bg-red-50 text-red-700 border-red-200' },
} as const;

export const HASIL_KESESUAIAN = {
    sesuai: { label: 'Sesuai', color: 'bg-green-50 text-green-700 border-green-200' },
    tidak_sesuai: { label: 'Tidak Sesuai', color: 'bg-red-50 text-red-700 border-red-200' },
    belum_ditentukan: { label: 'Belum Ditentukan', color: 'bg-gray-50 text-gray-500 border-gray-200' },
} as const;

export const getTriwulan = (month: string): number => {
    const idx = MONTHS.indexOf(month);
    if (idx === -1) return 1;
    return Math.floor(idx / 3) + 1;
};

export type StatusVerifikasi = keyof typeof STATUS_VERIFIKASI;
export type HasilKesesuaian = keyof typeof HASIL_KESESUAIAN;
