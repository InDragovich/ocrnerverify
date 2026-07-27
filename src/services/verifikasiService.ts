import api from './api';

export interface VerifikasiItem {
    id: number;
    user_id: number;
    verifikator_id: number | null;
    kategori: string;
    tahun: number;
    triwulan: number;
    periode: string;
    regional: string;
    kcu: string;
    kpc: string;
    nominal_pelaporan: number;
    lampiran_path: string;
    lampiran_nama_asli: string;
    status_verifikasi: 'menunggu' | 'diproses' | 'menunggu_review' | 'selesai' | 'gagal';
    hasil_kesesuaian: 'sesuai' | 'tidak_sesuai' | 'belum_ditentukan';
    catatan_verifikator: string | null;
    hasil_ekstraksi_teks: string | null;
    hasil_entitas: Record<string, string | null> | null;
    error_message: string | null;
    /** Waktu murni pemrosesan di layanan OCR-NER, dalam milidetik. */
    waktu_ocr_ner_ms: number | null;
    /** Waktu ujung ke ujung dari sisi backend (termasuk transfer berkas), dalam milidetik. */
    waktu_pemrosesan_ms: number | null;
    verified_at: string | null;
    created_at: string;
    updated_at: string;
    operator?: { id: number; name: string; username: string; region?: string; kcu?: string; kcp?: string };
    verifikator?: { id: number; name: string; username: string } | null;
}

export interface PaginatedResponse {
    data: VerifikasiItem[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

export interface StatsResponse {
    status_verifikasi: {
        menunggu: number;
        diproses: number;
        menunggu_review: number;
        selesai: number;
        gagal: number;
    };
    hasil_kesesuaian: {
        sesuai: number;
        tidak_sesuai: number;
        belum_ditentukan: number;
    };
}

export interface BatchStatusResponse {
    total: number;
    completed: number;
    processing: number;
    failed: number;
    items: Array<{
        id: number;
        status_verifikasi: string;
        hasil_kesesuaian: string;
        catatan_verifikator: string | null;
        error_message: string | null;
        waktu_ocr_ner_ms: number | null;
        waktu_pemrosesan_ms: number | null;
    }>;
}

export interface BatchVerifyResponse {
    message: string;
    total_jobs: number;
    ids: number[];
    /** Durasi seluruh batch di sisi server, dalam milidetik. */
    waktu_batch_ms: number | null;
    /** Rata-rata durasi per dokumen, dalam milidetik. */
    waktu_rata_rata_ms: number | null;
}

export interface Filters {
    kategori?: string;
    tahun?: string;
    triwulan?: string;
    periode?: string;
    status_verifikasi?: string;
    hasil_kesesuaian?: string;
    regional?: string;
    kcu?: string;
    kpc?: string;
    page?: number;
    per_page?: number;
}

export interface SummaryItem {
    nama: string;
    total_dokumen: number;
    total_biaya: number;
    selesai: number;
    menunggu: number;
    gagal: number;
    jumlah_sub: number;
}

export interface SummaryParams {
    group_by: 'regional' | 'kcu' | 'kpc';
    tahun?: string;
    triwulan?: string;
    regional?: string;
    kcu?: string;
}

export const verifikasiService = {
    async getList(filters: Filters = {}): Promise<PaginatedResponse> {
        const params = Object.fromEntries(
            Object.entries(filters).filter(([, v]) => v !== undefined && v !== '')
        );
        const { data } = await api.get<PaginatedResponse>('/verifikasi', { params });
        return data;
    },

    async getSummary(params: SummaryParams): Promise<SummaryItem[]> {
        const cleanParams = Object.fromEntries(
            Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
        );
        const { data } = await api.get<SummaryItem[]>('/verifikasi/summary', { params: cleanParams });
        return data;
    },

    async getDetail(id: number): Promise<VerifikasiItem> {
        const { data } = await api.get<VerifikasiItem>(`/verifikasi/${id}`);
        return data;
    },

    async create(formData: FormData): Promise<{ message: string; data: VerifikasiItem }> {
        const { data } = await api.post('/verifikasi', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return data;
    },

    async update(id: number, formData: FormData): Promise<{ message: string; data: VerifikasiItem }> {
        const { data } = await api.post(`/verifikasi/${id}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return data;
    },

    async delete(id: number): Promise<{ message: string }> {
        const { data } = await api.delete(`/verifikasi/${id}`);
        return data;
    },

    getLampiranUrl(id: number): string {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
        const token = localStorage.getItem('auth_token');
        return `${baseUrl}/verifikasi/${id}/lampiran?token=${token}`;
    },

    async getStats(): Promise<StatsResponse> {
        const { data } = await api.get<StatsResponse>('/verifikasi/stats');
        return data;
    },

    async batchVerify(ids: number[]): Promise<BatchVerifyResponse> {
        const { data } = await api.post<BatchVerifyResponse>('/verifikasi/batch', { ids });
        return data;
    },

    async getBatchStatus(ids: number[]): Promise<BatchStatusResponse> {
        const { data } = await api.get<BatchStatusResponse>('/verifikasi/batch-status', {
            params: { ids: ids.join(',') },
        });
        return data;
    },

    /**
     * Mengunduh CSV hasil verifikasi. `jenis` menentukan sudut pandangnya:
     * 'dokumen' satu baris per dokumen, 'batch' satu baris per pelaksanaan
     * verifikasi otomatis.
     */
    async exportCsv(jenis: 'dokumen' | 'batch', filters: Filters = {}): Promise<void> {
        const params = Object.fromEntries(
            Object.entries(filters).filter(([k, v]) =>
                v !== undefined && v !== '' && k !== 'page' && k !== 'per_page'
            )
        );
        const response = await api.get(`/verifikasi/export/${jenis}`, {
            params,
            responseType: 'blob',
        });

        const disposition = response.headers['content-disposition'] as string | undefined;
        const namaBerkas = disposition?.match(/filename="?([^"]+)"?/)?.[1]
            ?? `verifikasi-${jenis}.csv`;

        const url = URL.createObjectURL(response.data as Blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = namaBerkas;
        link.click();
        URL.revokeObjectURL(url);
    },

    async setKeputusan(
        id: number,
        hasil_kesesuaian: string,
        catatan_verifikator: string | null,
        koreksi_entitas?: Record<string, string | number | null>,
    ): Promise<{ message: string; data: VerifikasiItem }> {
        const payload: Record<string, unknown> = {
            hasil_kesesuaian,
            catatan_verifikator,
        };
        if (koreksi_entitas && Object.keys(koreksi_entitas).length > 0) {
            payload.koreksi_entitas = koreksi_entitas;
        }
        const { data } = await api.put(`/verifikasi/${id}/keputusan`, payload);
        return data;
    },
};
