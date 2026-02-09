import api from './api';

export interface User {
    id: number;
    name: string;
    username: string;
    role: 'operator' | 'verifikator' | 'super_admin';
    region?: string | null;
    kcu?: string | null;
    kcp?: string | null;
}

export interface LoginResponse {
    message: string;
    user: User;
    token: string;
}

export const authService = {
    async login(username: string, password: string): Promise<LoginResponse> {
        const { data } = await api.post<LoginResponse>('/login', { username, password });
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('auth_user', JSON.stringify(data.user));
        return data;
    },

    async logout(): Promise<void> {
        try {
            await api.post('/logout');
        } catch {
            // ignore errors on logout
        }
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
    },

    async getUser(): Promise<User> {
        const { data } = await api.get<User>('/user');
        return data;
    },

    getCurrentUser(): User | null {
        const data = localStorage.getItem('auth_user');
        return data ? JSON.parse(data) : null;
    },

    getToken(): string | null {
        return localStorage.getItem('auth_token');
    },

    isAuthenticated(): boolean {
        return !!localStorage.getItem('auth_token');
    },
};
