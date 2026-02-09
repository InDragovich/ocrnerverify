import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import type { User } from '../services/authService';
import { verifikasiService } from '../services/verifikasiService';
import type { StatsResponse } from '../services/verifikasiService';
import { Header } from '../components/Header';
import { BarChart3, Clock, Cog, CheckCircle, XCircle, HelpCircle, Loader2 } from 'lucide-react';

export const DashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);
    const [stats, setStats] = useState<StatsResponse | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const currentUser = authService.getCurrentUser();
        if (!currentUser || (currentUser.role !== 'verifikator' && currentUser.role !== 'super_admin')) {
            navigate('/');
            return;
        }
        setUser(currentUser);
    }, [navigate]);

    useEffect(() => {
        if (!user) return;
        const loadStats = async () => {
            setLoading(true);
            try {
                const data = await verifikasiService.getStats();
                setStats(data);
            } catch {
                // silent
            }
            setLoading(false);
        };
        loadStats();
    }, [user]);

    if (!user) return null;

    const statusCards = stats ? [
        { label: 'Menunggu', value: stats.status_verifikasi.menunggu, icon: Clock, color: 'bg-yellow-50 text-yellow-600 border-yellow-200', iconBg: 'bg-yellow-100' },
        { label: 'Diproses', value: stats.status_verifikasi.diproses, icon: Cog, color: 'bg-blue-50 text-blue-600 border-blue-200', iconBg: 'bg-blue-100' },
        { label: 'Selesai', value: stats.status_verifikasi.selesai, icon: CheckCircle, color: 'bg-green-50 text-green-600 border-green-200', iconBg: 'bg-green-100' },
        { label: 'Gagal', value: stats.status_verifikasi.gagal, icon: XCircle, color: 'bg-red-50 text-red-600 border-red-200', iconBg: 'bg-red-100' },
    ] : [];

    const kesesuaianCards = stats ? [
        { label: 'Sesuai', value: stats.hasil_kesesuaian.sesuai, icon: CheckCircle, color: 'bg-green-50 text-green-600 border-green-200', iconBg: 'bg-green-100' },
        { label: 'Tidak Sesuai', value: stats.hasil_kesesuaian.tidak_sesuai, icon: XCircle, color: 'bg-red-50 text-red-600 border-red-200', iconBg: 'bg-red-100' },
        { label: 'Belum Ditentukan', value: stats.hasil_kesesuaian.belum_ditentukan, icon: HelpCircle, color: 'bg-gray-50 text-gray-500 border-gray-200', iconBg: 'bg-gray-100' },
    ] : [];

    const totalVerifikasi = stats
        ? stats.status_verifikasi.menunggu + stats.status_verifikasi.diproses + stats.status_verifikasi.selesai + stats.status_verifikasi.gagal
        : 0;

    return (
        <div className="min-h-screen bg-gray-50">
            <Header user={user} />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <BarChart3 className="text-indigo-600" size={28} />
                        Dashboard Statistik
                    </h1>
                    <p className="text-gray-500 mt-1">Ringkasan data verifikasi biaya rutin.</p>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="animate-spin text-gray-400" size={40} />
                    </div>
                ) : stats ? (
                    <>
                        {/* Total */}
                        <div className="mb-8 bg-indigo-600 text-white rounded-2xl p-6 shadow-lg">
                            <p className="text-indigo-200 text-sm font-medium">Total Data Verifikasi</p>
                            <p className="text-4xl font-bold mt-1">{totalVerifikasi}</p>
                        </div>

                        {/* Status Verifikasi */}
                        <div className="mb-8">
                            <h2 className="text-lg font-bold text-gray-800 mb-4">Status Verifikasi</h2>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {statusCards.map(card => (
                                    <div key={card.label} className={`rounded-2xl border p-5 ${card.color}`}>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className={`p-2 rounded-lg ${card.iconBg}`}>
                                                <card.icon size={20} />
                                            </div>
                                        </div>
                                        <p className="text-3xl font-bold">{card.value}</p>
                                        <p className="text-sm font-medium mt-1 opacity-80">{card.label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Hasil Kesesuaian */}
                        <div>
                            <h2 className="text-lg font-bold text-gray-800 mb-4">Hasil Kesesuaian</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {kesesuaianCards.map(card => (
                                    <div key={card.label} className={`rounded-2xl border p-5 ${card.color}`}>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className={`p-2 rounded-lg ${card.iconBg}`}>
                                                <card.icon size={20} />
                                            </div>
                                        </div>
                                        <p className="text-3xl font-bold">{card.value}</p>
                                        <p className="text-sm font-medium mt-1 opacity-80">{card.label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Quick Links */}
                        <div className="mt-8 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                            <h2 className="text-lg font-bold text-gray-800 mb-4">Aksi Cepat</h2>
                            <div className="flex flex-wrap gap-3">
                                <button
                                    onClick={() => navigate('/verify')}
                                    className="px-4 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors text-sm"
                                >
                                    Buka Halaman Verifikasi
                                </button>
                                <button
                                    onClick={() => navigate('/verify?status_verifikasi=menunggu')}
                                    className="px-4 py-2.5 bg-yellow-100 text-yellow-700 font-medium rounded-xl hover:bg-yellow-200 transition-colors text-sm"
                                >
                                    Lihat Menunggu ({stats.status_verifikasi.menunggu})
                                </button>
                                <button
                                    onClick={() => navigate('/verify?status_verifikasi=gagal')}
                                    className="px-4 py-2.5 bg-red-100 text-red-700 font-medium rounded-xl hover:bg-red-200 transition-colors text-sm"
                                >
                                    Lihat Gagal ({stats.status_verifikasi.gagal})
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="text-center py-20 text-gray-400">
                        <p>Gagal memuat statistik.</p>
                    </div>
                )}
            </main>
        </div>
    );
};
