import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import type { User } from '../services/authService';
import { userService } from '../services/userService';
import type { UserItem } from '../services/userService';
import { Header } from '../components/Header';
import { REGIONALS } from '../data/constants';
import {
    Users, Plus, Pencil, UserX, Loader2, Search, X, Save,
    ChevronLeft, ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';

const ROLE_OPTIONS = [
    { value: 'operator', label: 'Operator' },
    { value: 'verifikator', label: 'Verifikator' },
    { value: 'super_admin', label: 'Super Admin' },
];

const ROLE_BADGE: Record<string, string> = {
    operator: 'bg-blue-100 text-blue-700',
    verifikator: 'bg-purple-100 text-purple-700',
    super_admin: 'bg-red-100 text-red-700',
};

interface FormData {
    name: string;
    username: string;
    password: string;
    role: string;
    region: string;
    kcu: string;
    kcp: string;
}

const emptyForm: FormData = { name: '', username: '', password: '', role: 'operator', region: '', kcu: '', kcp: '' };

export const AdminUsersPage: React.FC = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);

    // list
    const [users, setUsers] = useState<UserItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [roleFilter, setRoleFilter] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    // modal
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState<UserItem | null>(null);
    const [form, setForm] = useState<FormData>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    useEffect(() => {
        const currentUser = authService.getCurrentUser();
        if (!currentUser || currentUser.role !== 'super_admin') {
            navigate('/');
            return;
        }
        setUser(currentUser);
    }, [navigate]);

    const loadUsers = useCallback(async () => {
        setLoading(true);
        try {
            const result = await userService.getList({ role: roleFilter, search, page, per_page: 15 });
            setUsers(result.data);
            setTotalPages(result.last_page);
            setTotalItems(result.total);
        } catch {
            // silent
        }
        setLoading(false);
    }, [roleFilter, search, page]);

    useEffect(() => {
        if (user) loadUsers();
    }, [user, loadUsers]);

    const handleSearch = (val: string) => {
        setSearch(val);
        setPage(1);
    };

    const handleRoleFilter = (val: string) => {
        setRoleFilter(val);
        setPage(1);
    };

    const openAddModal = () => {
        setEditingUser(null);
        setForm(emptyForm);
        setFormError('');
        setShowModal(true);
    };

    const openEditModal = (u: UserItem) => {
        setEditingUser(u);
        setForm({
            name: u.name,
            username: u.username,
            password: '',
            role: u.role,
            region: u.region || '',
            kcu: u.kcu || '',
            kcp: u.kcp || '',
        });
        setFormError('');
        setShowModal(true);
    };

    const handleFormChange = (key: keyof FormData, value: string) => {
        setForm(prev => {
            const next = { ...prev, [key]: value };
            // Operator tanpa region tidak terikat wilayah, jadi KCU/KPC ikut dikosongkan.
            if (key === 'region' && !value && prev.role === 'operator') {
                next.kcu = '';
                next.kcp = '';
            }
            return next;
        });
    };

    const handleSave = async () => {
        setSaving(true);
        setFormError('');
        try {
            if (editingUser) {
                const payload: Record<string, unknown> = {
                    name: form.name,
                    username: form.username,
                    role: form.role,
                    region: form.region || null,
                    kcu: form.kcu || null,
                    kcp: form.kcp || null,
                };
                if (form.password) payload.password = form.password;
                await userService.update(editingUser.id, payload);
            } else {
                if (!form.password) {
                    setFormError('Password wajib diisi untuk user baru.');
                    setSaving(false);
                    return;
                }
                await userService.create({
                    name: form.name,
                    username: form.username,
                    password: form.password,
                    role: form.role,
                    region: form.region || undefined,
                    kcu: form.kcu || undefined,
                    kcp: form.kcp || undefined,
                });
            }
            setShowModal(false);
            loadUsers();
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
            if (error.response?.data?.errors) {
                setFormError(Object.values(error.response.data.errors).flat().join('. '));
            } else {
                setFormError(error.response?.data?.message || 'Gagal menyimpan.');
            }
        }
        setSaving(false);
    };

    const handleDeactivate = async (u: UserItem) => {
        if (!confirm(`Yakin ingin menonaktifkan user "${u.name}"?`)) return;
        try {
            await userService.deactivate(u.id);
            loadUsers();
        } catch {
            alert('Gagal menonaktifkan user.');
        }
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-gray-50">
            <Header user={user} />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <Users className="text-indigo-600" size={28} />
                            Manajemen User
                        </h1>
                        <p className="text-gray-500 mt-1">Kelola pengguna sistem.</p>
                    </div>
                    <button
                        onClick={openAddModal}
                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
                    >
                        <Plus size={18} /> Tambah User
                    </button>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Cari nama atau username..."
                            value={search}
                            onChange={e => handleSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                    <select
                        value={roleFilter}
                        onChange={e => handleRoleFilter(e.target.value)}
                        className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                        <option value="">Semua Role</option>
                        {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                </div>

                {/* Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                                    <th className="p-4">No</th>
                                    <th className="p-4">Nama</th>
                                    <th className="p-4">Username</th>
                                    <th className="p-4">Role</th>
                                    <th className="p-4">Region</th>
                                    <th className="p-4">KCU</th>
                                    <th className="p-4">KPC</th>
                                    <th className="p-4 text-center">Status</th>
                                    <th className="p-4 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr><td colSpan={9} className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" /></td></tr>
                                ) : users.length === 0 ? (
                                    <tr><td colSpan={9} className="p-8 text-center text-gray-500">Tidak ada data user.</td></tr>
                                ) : users.map((u, idx) => (
                                    <tr key={u.id} className="hover:bg-gray-50/50">
                                        <td className="p-4 text-sm text-gray-500">{(page - 1) * 15 + idx + 1}</td>
                                        <td className="p-4 text-sm font-medium text-gray-900">{u.name}</td>
                                        <td className="p-4 text-sm text-gray-600">{u.username}</td>
                                        <td className="p-4">
                                            <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', ROLE_BADGE[u.role] || 'bg-gray-100 text-gray-600')}>
                                                {ROLE_OPTIONS.find(r => r.value === u.role)?.label || u.role}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm">
                                            {u.region || (u.role === 'verifikator' ? 'Semua Region'
                                                : u.role === 'operator' ? 'Lintas Wilayah' : '-')}
                                        </td>
                                        <td className="p-4 text-sm">
                                            {u.kcu || (u.role === 'verifikator' ? 'Semua KCU'
                                                : u.role === 'operator' ? 'Dipilih saat input' : '-')}
                                        </td>
                                        <td className="p-4 text-sm">
                                            {u.kcp || (u.role === 'verifikator' ? 'Semua KPC'
                                                : u.role === 'operator' ? 'Dipilih saat input' : '-')}
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={clsx(
                                                'px-2 py-1 rounded-full text-xs font-medium border',
                                                u.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-200'
                                            )}>
                                                {u.is_active ? 'Aktif' : 'Nonaktif'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => openEditModal(u)}
                                                    className="p-1.5 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                                {u.is_active && u.id !== user?.id && (
                                                    <button
                                                        onClick={() => handleDeactivate(u)}
                                                        className="p-1.5 hover:bg-red-100 text-red-500 rounded-lg transition-colors"
                                                        title="Nonaktifkan"
                                                    >
                                                        <UserX size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                            <p className="text-sm text-gray-500">
                                {users.length} dari {totalItems} user
                            </p>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                                    className="p-2 hover:bg-gray-100 disabled:opacity-30 rounded-lg transition-colors">
                                    <ChevronLeft size={18} />
                                </button>
                                <span className="text-sm text-gray-600 font-medium">
                                    {page} / {totalPages}
                                </span>
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                                    className="p-2 hover:bg-gray-100 disabled:opacity-30 rounded-lg transition-colors">
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)}>
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-bold text-gray-800 text-lg">
                                {editingUser ? 'Edit User' : 'Tambah User Baru'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X size={20} className="text-gray-500" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {formError && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-xl text-sm">
                                    {formError}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Nama</label>
                                <input type="text" value={form.name} onChange={e => handleFormChange('name', e.target.value)}
                                    className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Username</label>
                                <input type="text" value={form.username} onChange={e => handleFormChange('username', e.target.value)}
                                    className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">
                                    Password {editingUser && <span className="text-gray-400 font-normal">(kosongkan jika tidak diubah)</span>}
                                </label>
                                <input type="password" value={form.password} onChange={e => handleFormChange('password', e.target.value)}
                                    className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Role</label>
                                <select value={form.role} onChange={e => handleFormChange('role', e.target.value)}
                                    className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none">
                                    {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                </select>
                            </div>
                            {form.role === 'operator' && (
                                <div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1">Region</label>
                                            <select value={form.region} onChange={e => handleFormChange('region', e.target.value)}
                                                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm">
                                                <option value="">Lintas Wilayah</option>
                                                {REGIONALS.map(r => <option key={r} value={r}>{r}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1">KCU</label>
                                            <input type="text" value={form.kcu} disabled={!form.region}
                                                placeholder={form.region ? '' : 'Dipilih saat input'}
                                                onChange={e => handleFormChange('kcu', e.target.value)}
                                                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm disabled:bg-gray-100 disabled:text-gray-400" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1">KPC</label>
                                            <input type="text" value={form.kcp} disabled={!form.region}
                                                placeholder={form.region ? '' : 'Dipilih saat input'}
                                                onChange={e => handleFormChange('kcp', e.target.value)}
                                                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm disabled:bg-gray-100 disabled:text-gray-400" />
                                        </div>
                                    </div>
                                    <p className="mt-1.5 text-xs text-gray-500">
                                        Region yang dikosongkan menjadikan operator lintas wilayah: wilayah dokumen
                                        dipilih sendiri dari data master pada saat menginput data.
                                    </p>
                                </div>
                            )}
                            {form.role === 'verifikator' && (
                                <div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1">Region</label>
                                            <select value={form.region} onChange={e => handleFormChange('region', e.target.value)}
                                                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm">
                                                <option value="">Semua Region</option>
                                                {REGIONALS.map(r => <option key={r} value={r}>{r}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1">KCU</label>
                                            <input type="text" value={form.kcu} placeholder="Semua KCU"
                                                onChange={e => handleFormChange('kcu', e.target.value)}
                                                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1">KPC</label>
                                            <input type="text" value={form.kcp} placeholder="Semua KPC"
                                                onChange={e => handleFormChange('kcp', e.target.value)}
                                                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                                        </div>
                                    </div>
                                    <p className="mt-1.5 text-xs text-gray-500">
                                        Kolom yang dikosongkan berarti verifikator dapat mengakses semua wilayah pada level tersebut.
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={() => setShowModal(false)}
                                className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                                Batal
                            </button>
                            <button onClick={handleSave} disabled={saving}
                                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold rounded-xl transition-colors">
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                {saving ? 'Menyimpan...' : 'Simpan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
