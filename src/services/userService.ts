import api from './api';

export interface UserItem {
    id: number;
    name: string;
    username: string;
    role: string;
    region: string | null;
    kcu: string | null;
    kcp: string | null;
    is_active: boolean;
    created_at: string;
}

export interface PaginatedUsers {
    data: UserItem[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

export const userService = {
    async getList(params: { role?: string; search?: string; page?: number; per_page?: number } = {}): Promise<PaginatedUsers> {
        const { data } = await api.get<PaginatedUsers>('/admin/users', { params });
        return data;
    },

    async getDetail(id: number): Promise<UserItem> {
        const { data } = await api.get<UserItem>(`/admin/users/${id}`);
        return data;
    },

    async create(userData: {
        name: string;
        username: string;
        password: string;
        role: string;
        region?: string;
        kcu?: string;
        kcp?: string;
    }): Promise<{ message: string; data: UserItem }> {
        const { data } = await api.post('/admin/users', userData);
        return data;
    },

    async update(id: number, userData: Record<string, unknown>): Promise<{ message: string; data: UserItem }> {
        const { data } = await api.put(`/admin/users/${id}`, userData);
        return data;
    },

    async deactivate(id: number): Promise<{ message: string }> {
        const { data } = await api.delete(`/admin/users/${id}`);
        return data;
    },
};
