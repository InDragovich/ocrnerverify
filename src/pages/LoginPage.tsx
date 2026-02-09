import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { LogIn, Loader2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username || !password) {
            setError('Username dan password harus diisi.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const result = await authService.login(username, password);
            const role = result.user.role;

            if (role === 'operator') {
                navigate('/input');
            } else if (role === 'super_admin') {
                navigate('/admin/users');
            } else {
                navigate('/dashboard');
            }
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            setError(error.response?.data?.message || 'Login gagal. Periksa koneksi server.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-indigo-500 via-purple-500 to-pink-500 p-4">
            <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl p-8 w-full max-w-md transform transition-all hover:scale-[1.01]">
                <div className="text-center mb-8">
                    <div className="bg-indigo-100 p-3 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 text-indigo-600">
                        <LogIn size={32} />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-800 tracking-tight">Selamat Datang</h1>
                    <p className="text-gray-500 mt-2">Sistem Verifikasi Biaya Rutin</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <label htmlFor="username" className="block text-sm font-semibold text-gray-700 mb-1">
                            Username
                        </label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Masukkan username"
                            className="block w-full rounded-lg border-gray-300 bg-gray-50 border p-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow outline-none"
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1">
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Masukkan password"
                            className="block w-full rounded-lg border-gray-300 bg-gray-50 border p-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow outline-none"
                        />
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center">
                            <span className="mr-2">&#9888;&#65039;</span> {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 size={20} className="animate-spin" /> : <LogIn size={20} />}
                        {loading ? 'Memproses...' : 'Masuk'}
                    </button>
                </form>

                <div className="mt-6 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-400 text-center">Demo accounts: input_jkt / input_medan / verificator / superadmin (password: password)</p>
                </div>
            </div>
        </div>
    );
};
