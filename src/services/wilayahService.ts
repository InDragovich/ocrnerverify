import api from './api';

/** Regional => KCU => daftar KPC, mengikuti backend/config/wilayah.php. */
export type StrukturWilayah = Record<string, Record<string, string[]>>;

export const wilayahService = {
    async getStruktur(): Promise<StrukturWilayah> {
        const { data } = await api.get<{ struktur: StrukturWilayah }>('/wilayah');
        return data.struktur;
    },
};
