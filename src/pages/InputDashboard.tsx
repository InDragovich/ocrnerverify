import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { storage } from '../utils/storage';
import { CATEGORIES } from '../data/mockData';
import type { User } from '../data/mockData';

import { Header } from '../components/Header';
import { FileText, Save, CheckCircle, Upload } from 'lucide-react';

export const InputDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);
    const [formData, setFormData] = useState({
        category: '',
        year: new Date().getFullYear().toString(),
        quarter: '1',
        nominal: '',
        fileName: '',
        fileData: '',
    });
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');


    useEffect(() => {
        const currentUser = storage.getCurrentUser();
        if (!currentUser || currentUser.role !== 'INPUTTER') {
            navigate('/');
            return;
        }
        setUser(currentUser);
    }, [navigate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];

            if (file.size > 2 * 1024 * 1024) { // 2MB limit
                setErrorMsg('Ukuran file terlalu besar (Max 2MB).');
                return;
            }

            setErrorMsg('');
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData({
                    ...formData,
                    fileName: file.name,
                    fileData: reader.result as string
                });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        if (!formData.fileData) {
            setErrorMsg('Silakan upload dokumen terlebih dahulu.');
            return;
        }

        storage.saveDocument({
            userId: user.id,
            userName: user.name,
            region: user.region || '',
            kcu: user.kcu || '',
            kcp: user.kcp || '',
            category: formData.category,
            year: formData.year,
            quarter: formData.quarter,
            nominal: Number(formData.nominal),
            fileName: formData.fileName || 'document_scan.pdf',
            fileData: formData.fileData,
        });


        setSuccessMsg('Dokumen berhasil disimpan!');
        setFormData({
            category: '',
            year: new Date().getFullYear().toString(),
            quarter: '1',
            nominal: '',
            fileName: '',
            fileData: '',
        });


        setTimeout(() => setSuccessMsg(''), 3000);
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-gray-50">
            <Header user={user} />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* User Info Card */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 sticky top-8">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <FileText className="text-indigo-500" size={20} />
                                Informasi Wilayah
                            </h3>
                            <div className="space-y-4">
                                <div className="p-3 bg-indigo-50 rounded-lg">
                                    <p className="text-sm text-indigo-600 font-medium">Region</p>
                                    <p className="text-lg font-bold text-gray-900">{user.region}</p>
                                </div>
                                <div className="p-3 bg-blue-50 rounded-lg">
                                    <p className="text-sm text-blue-600 font-medium">KCU</p>
                                    <p className="text-base font-semibold text-gray-900">{user.kcu}</p>
                                </div>
                                <div className="p-3 bg-violet-50 rounded-lg">
                                    <p className="text-sm text-violet-600 font-medium">KCP</p>
                                    <p className="text-base font-semibold text-gray-900">{user.kcp}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Form Card */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100">
                            <div className="mb-6">
                                <h2 className="text-2xl font-bold text-gray-900">Input Data Dokumen</h2>
                                <p className="text-gray-500">Lengkapi form di bawah ini untuk mensubmit dokumen subsidi.</p>
                            </div>

                            {successMsg && (
                                <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
                                    <CheckCircle size={20} /> {successMsg}
                                </div>
                            )}

                            {errorMsg && (
                                <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
                                    <span className="text-xl">⚠️</span> {errorMsg}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-6">

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Kategori Dokumen</label>
                                        <select
                                            name="category"
                                            required
                                            value={formData.category}
                                            onChange={handleChange}
                                            className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                        >
                                            <option value="">-- Pilih Kategori --</option>
                                            {CATEGORIES.map((cat) => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Tahun</label>
                                        <input
                                            type="number"
                                            name="year"
                                            required
                                            min="2000"
                                            max="2030"
                                            value={formData.year}
                                            onChange={handleChange}
                                            className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Triwulan</label>
                                        <select
                                            name="quarter"
                                            required
                                            value={formData.quarter}
                                            onChange={handleChange}
                                            className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                        >
                                            <option value="1">Triwulan 1</option>
                                            <option value="2">Triwulan 2</option>
                                            <option value="3">Triwulan 3</option>
                                            <option value="4">Triwulan 4</option>
                                        </select>
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Nominal (Rp)</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">Rp</span>
                                            <input
                                                type="number"
                                                name="nominal"
                                                required
                                                placeholder="Contoh: 1000000"
                                                value={formData.nominal}
                                                onChange={handleChange}
                                                className="w-full p-3 pl-10 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Upload Dokumen</label>
                                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-indigo-400 transition-colors bg-gray-50 hover:bg-white cursor-pointer relative">
                                            <input
                                                type="file"
                                                onChange={handleFileChange}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            />
                                            <div className="flex flex-col items-center justify-center pointer-events-none">
                                                <Upload className="text-gray-400 mb-2" size={32} />
                                                <p className="text-sm text-gray-500 font-medium">
                                                    {formData.fileName ? <span className="text-indigo-600">{formData.fileName}</span> : 'Klik untuk upload atau drag & drop'}
                                                </p>
                                                <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG (Max 5MB)</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4">
                                    <button
                                        type="submit"
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg hover:shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Save size={20} />
                                        Simpan Data
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};
