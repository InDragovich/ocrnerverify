import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { storage } from '../utils/storage';
import { USERS } from '../data/mockData';

import { LogIn } from 'lucide-react';

export const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [error, setError] = useState<string>('');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        const user = USERS.find((u) => u.id === selectedUserId);
        if (!user) {
            setError('Silakan pilih user terlebih dahulu.');
            return;
        }

        storage.login(user);
        if (user.role === 'INPUTTER') {
            navigate('/input');
        } else {
            navigate('/verify');
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
                    <p className="text-gray-500 mt-2">Sistem Input & Verifikasi Dokumen Subsidi</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label htmlFor="user" className="block text-sm font-medium text-gray-700 mb-1">
                            Pilih Pengguna
                        </label>
                        <div className="relative">
                            <select
                                id="user"
                                value={selectedUserId}
                                onChange={(e) => setSelectedUserId(e.target.value)}
                                className="block w-full rounded-lg border-gray-300 bg-gray-50 border p-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow outline-none"
                            >
                                <option value="">-- Pilih User --</option>
                                <optgroup label="Penginput Dokumen">
                                    {USERS.filter(u => u.role === 'INPUTTER').map(u => (
                                        <option key={u.id} value={u.id}>
                                            {u.name} - {u.region}
                                        </option>
                                    ))}
                                </optgroup>
                                <optgroup label="Verifikator">
                                    {USERS.filter(u => u.role === 'VERIFICATOR').map(u => (
                                        <option key={u.id} value={u.id}>
                                            {u.name}
                                        </option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center">
                            <span className="mr-2">⚠️</span> {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5"
                    >
                        Masuk
                    </button>
                </form>
            </div>
        </div>
    );
};
