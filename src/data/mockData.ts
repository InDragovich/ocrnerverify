export type Role = 'INPUTTER' | 'VERIFICATOR';

export interface User {
    id: string;
    username: string;
    role: Role;
    name: string;
    region?: string;
    kcu?: string;
    kcp?: string;
}

export const USERS: User[] = [
    {
        id: 'u1',
        username: 'input_jkt',
        role: 'INPUTTER',
        name: 'Budi Santoso',
        region: 'Jakarta',
        kcu: 'KCU Jakarta Utara',
        kcp: 'KCP Tanjung Priok',
    },
    {
        id: 'u2',
        username: 'input_medan',
        role: 'INPUTTER',
        name: 'Siti Aminah',
        region: 'Medan',
        kcu: 'KCU Medan Kota',
        kcp: 'KCP Gatot Subroto',
    },
    {
        id: 'u3',
        username: 'input_sby',
        role: 'INPUTTER',
        name: 'Agus Salim',
        region: 'Surabaya',
        kcu: 'KCU Surabaya Gubeng',
        kcp: 'KCP Dharmawangsa',
    },
    {
        id: 'u4',
        username: 'input_mks',
        role: 'INPUTTER',
        name: 'Rina Wati',
        region: 'Makassar',
        kcu: 'KCU Makassar Panakkukang',
        kcp: 'KCP Pettarani',
    },
    {
        id: 'v1',
        username: 'verificator',
        role: 'VERIFICATOR',
        name: 'Admin Verifikator',
    },
];

export const CATEGORIES = ['Kebersihan', 'Telepon', 'Listrik', 'Air', 'Gas'];
