import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import type { User } from '../services/authService';
import { verifikasiService } from '../services/verifikasiService';
import type { VerifikasiItem } from '../services/verifikasiService';
import { wilayahService } from '../services/wilayahService';
import type { StrukturWilayah } from '../services/wilayahService';
import { CATEGORIES, MONTHS, getTriwulan } from '../data/constants';
import { Header } from '../components/Header';
import { DetailModal } from '../components/DetailModal';
import { FileText, Save, CheckCircle, Upload, Loader2, Trash2, Search, Eye } from 'lucide-react';
import clsx from 'clsx';

function getNominalColor(doc: VerifikasiItem): string {
    if (doc.status_verifikasi === 'menunggu' || doc.status_verifikasi === 'diproses') {
        return 'text-gray-400';
    }
    const nerNominal = doc.hasil_entitas?.nominal ? Number(doc.hasil_entitas.nominal) : null;
    if (nerNominal === null) return 'text-gray-400';
    return doc.nominal_pelaporan === nerNominal ? 'text-green-600' : 'text-red-600';
}

function getNerNominal(doc: VerifikasiItem): number | null {
    if (!doc.hasil_entitas?.nominal) return null;
    return Number(doc.hasil_entitas.nominal);
}

export const InputDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);
    const [formData, setFormData] = useState({
        kategori: '',
        tahun: new Date().getFullYear().toString(),
        triwulan: '1',
        periode: '',
        nominal_pelaporan: '',
    });
    // Operator lintas wilayah (region profil kosong) memilih sendiri wilayah
    // dokumen; operator yang terikat wilayah memakai penempatan profilnya.
    const lintasWilayah = !!user && !user.region;
    const [struktur, setStruktur] = useState<StrukturWilayah>({});
    const [wilayah, setWilayah] = useState({ regional: '', kcu: '', kpc: '' });
    const [file, setFile] = useState<File | null>(null);
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [loading, setLoading] = useState(false);
    const [documents, setDocuments] = useState<VerifikasiItem[]>([]);
    const [loadingDocs, setLoadingDocs] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [perPage, setPerPage] = useState(10);
    const [detailDoc, setDetailDoc] = useState<VerifikasiItem | null>(null);

    useEffect(() => {
        const currentUser = authService.getCurrentUser();
        if (!currentUser || currentUser.role !== 'operator') {
            navigate('/');
            return;
        }
        setUser(currentUser);
    }, [navigate]);

    const loadDocuments = useCallback(async () => {
        setLoadingDocs(true);
        try {
            const result = await verifikasiService.getList({ per_page: 50 });
            setDocuments(result.data);
        } catch {
            // silent
        }
        setLoadingDocs(false);
    }, []);

    useEffect(() => {
        if (user) loadDocuments();
    }, [user, loadDocuments]);

    useEffect(() => {
        if (!lintasWilayah) return;
        wilayahService.getStruktur().then(setStruktur).catch(() => {
            setErrorMsg('Gagal memuat daftar wilayah.');
        });
    }, [lintasWilayah]);

    // Mengubah level atas mengosongkan level di bawahnya agar kombinasi
    // yang terkirim selalu ada di data master.
    const handleWilayahChange = (level: 'regional' | 'kcu' | 'kpc', value: string) => {
        if (level === 'regional') {
            setWilayah({ regional: value, kcu: '', kpc: '' });
        } else if (level === 'kcu') {
            setWilayah(w => ({ ...w, kcu: value, kpc: '' }));
        } else {
            setWilayah(w => ({ ...w, kpc: value }));
        }
    };

    const kcuOptions = Object.keys(struktur[wilayah.regional] ?? {});
    const kpcOptions = struktur[wilayah.regional]?.[wilayah.kcu] ?? [];

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'nominal_pelaporan') {
            setFormData({ ...formData, nominal_pelaporan: value.replace(/\D/g, '') });
        } else if (name === 'periode') {
            setFormData({ ...formData, periode: value, triwulan: value ? String(getTriwulan(value)) : '1' });
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const f = e.target.files[0];
            const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
            if (!allowed.includes(f.type)) {
                setErrorMsg('Format file harus PDF, JPG, atau PNG.');
                return;
            }
            if (f.size > 5 * 1024 * 1024) {
                setErrorMsg('Ukuran file maksimal 5MB.');
                return;
            }
            setErrorMsg('');
            setFile(f);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        if (!file) {
            setErrorMsg('Silakan upload dokumen terlebih dahulu.');
            return;
        }
        if (lintasWilayah && (!wilayah.regional || !wilayah.kcu || !wilayah.kpc)) {
            setErrorMsg('Silakan lengkapi Regional, KCU, dan KPC terlebih dahulu.');
            return;
        }

        setLoading(true);
        setErrorMsg('');

        try {
            const fd = new FormData();
            fd.append('kategori', formData.kategori);
            fd.append('tahun', formData.tahun);
            fd.append('triwulan', formData.triwulan);
            fd.append('periode', formData.periode);
            fd.append('nominal_pelaporan', formData.nominal_pelaporan);
            fd.append('lampiran', file);
            if (lintasWilayah) {
                fd.append('regional', wilayah.regional);
                fd.append('kcu', wilayah.kcu);
                fd.append('kpc', wilayah.kpc);
            }

            await verifikasiService.create(fd);

            setSuccessMsg('Data berhasil disimpan!');
            setFormData({ kategori: '', tahun: new Date().getFullYear().toString(), triwulan: '1', periode: '', nominal_pelaporan: '' });
            setFile(null);
            loadDocuments();
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
            if (error.response?.data?.errors) {
                setErrorMsg(Object.values(error.response.data.errors).flat().join('. '));
            } else {
                setErrorMsg(error.response?.data?.message || 'Gagal menyimpan data.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Yakin ingin menghapus data ini?')) return;
        try {
            await verifikasiService.delete(id);
            loadDocuments();
        } catch {
            alert('Gagal menghapus data.');
        }
    };

    // Client-side search filter
    const filteredDocuments = searchQuery
        ? documents.filter(doc =>
            doc.kategori.toLowerCase().includes(searchQuery.toLowerCase()) ||
            doc.periode.toLowerCase().includes(searchQuery.toLowerCase()) ||
            String(doc.nominal_pelaporan).includes(searchQuery)
        )
        : documents;

    const displayedDocuments = filteredDocuments.slice(0, perPage);

    if (!user) return null;

    return (
        <div className="min-h-screen bg-gray-50">
            <Header user={user} />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 sticky top-8">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <FileText className="text-indigo-500" size={20} /> Informasi Wilayah
                            </h3>
                            {lintasWilayah ? (
                                <div className="space-y-4">
                                    <div className="p-3 bg-indigo-50 rounded-lg">
                                        <p className="text-sm text-indigo-600 font-medium">Cakupan</p>
                                        <p className="text-lg font-bold text-gray-900">Lintas Wilayah</p>
                                    </div>
                                    <p className="text-sm text-gray-500">
                                        Akun Anda tidak terikat pada satu wilayah, sehingga wilayah dokumen
                                        dipilih langsung pada form input.
                                    </p>
                                    <div className="p-3 bg-gray-50 rounded-lg">
                                        <p className="text-sm text-gray-500 font-medium">Wilayah dokumen saat ini</p>
                                        <p className="text-base font-semibold text-gray-900">
                                            {wilayah.kpc || wilayah.kcu || wilayah.regional || 'Belum dipilih'}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="p-3 bg-indigo-50 rounded-lg">
                                        <p className="text-sm text-indigo-600 font-medium">Region</p>
                                        <p className="text-lg font-bold text-gray-900">{user.region || '-'}</p>
                                    </div>
                                    <div className="p-3 bg-blue-50 rounded-lg">
                                        <p className="text-sm text-blue-600 font-medium">KCU</p>
                                        <p className="text-base font-semibold text-gray-900">{user.kcu || '-'}</p>
                                    </div>
                                    <div className="p-3 bg-violet-50 rounded-lg">
                                        <p className="text-sm text-violet-600 font-medium">KPC</p>
                                        <p className="text-base font-semibold text-gray-900">{user.kcp || '-'}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                            <div className="mb-4">
                                <h2 className="text-xl font-bold text-gray-900">Input Data Verifikasi Biaya Rutin</h2>
                                <p className="text-sm text-gray-500">Lengkapi form di bawah ini untuk mensubmit data laporan.</p>
                            </div>

                            {successMsg && (
                                <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center gap-2">
                                    <CheckCircle size={20} /> {successMsg}
                                </div>
                            )}
                            {errorMsg && (
                                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
                                    <span>&#9888;&#65039;</span> {errorMsg}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {lintasWilayah && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Regional</label>
                                            <select required value={wilayah.regional}
                                                onChange={e => handleWilayahChange('regional', e.target.value)}
                                                className="w-full p-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm">
                                                <option value="">-- Pilih Regional --</option>
                                                {Object.keys(struktur).map(r => <option key={r} value={r}>{r}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">KCU</label>
                                            <select required value={wilayah.kcu} disabled={!wilayah.regional}
                                                onChange={e => handleWilayahChange('kcu', e.target.value)}
                                                className="w-full p-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm disabled:bg-gray-100 disabled:text-gray-400">
                                                <option value="">-- Pilih KCU --</option>
                                                {kcuOptions.map(k => <option key={k} value={k}>{k}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">KPC</label>
                                            <select required value={wilayah.kpc} disabled={!wilayah.kcu}
                                                onChange={e => handleWilayahChange('kpc', e.target.value)}
                                                className="w-full p-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm disabled:bg-gray-100 disabled:text-gray-400">
                                                <option value="">-- Pilih KPC --</option>
                                                {kpcOptions.map(k => <option key={k} value={k}>{k}</option>)}
                                            </select>
                                        </div>
                                        <p className="md:col-span-3 text-xs text-gray-500">
                                            Pilihan wilayah dipertahankan setelah menyimpan, agar beberapa dokumen pada KPC yang sama dapat diinput berurutan.
                                        </p>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nama Rekening</label>
                                        <select name="kategori" required value={formData.kategori} onChange={handleChange}
                                            className="w-full p-2.5 text-sm bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none">
                                            <option value="">-- Pilih Nama Rekening --</option>
                                            {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tahun</label>
                                        <input type="number" name="tahun" required min="2000" max="2099" value={formData.tahun} onChange={handleChange}
                                            className="w-full p-2.5 text-sm bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Periode</label>
                                        <select name="periode" required value={formData.periode} onChange={handleChange}
                                            className="w-full p-2.5 text-sm bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none">
                                            <option value="">-- Pilih Periode --</option>
                                            {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Triwulan</label>
                                        <select name="triwulan" required value={formData.triwulan} disabled
                                            className="w-full p-2.5 text-sm bg-gray-100 border border-gray-300 rounded-xl text-gray-500 cursor-not-allowed outline-none">
                                            {[1,2,3,4].map(t => <option key={t} value={t}>Triwulan {t}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nominal (Rp)</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">Rp</span>
                                            <input type="text" inputMode="numeric" name="nominal_pelaporan" required placeholder="234302" value={formData.nominal_pelaporan} onChange={handleChange}
                                                className="w-full p-2.5 pl-10 text-sm bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                                        </div>
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Upload Lampiran</label>
                                        <div className="border-2 border-dashed border-gray-300 rounded-xl px-4 py-3 hover:border-indigo-400 transition-colors bg-gray-50 cursor-pointer relative">
                                            <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                            <div className="flex items-center gap-3 pointer-events-none">
                                                <Upload className="text-gray-400 shrink-0" size={22} />
                                                <p className="text-sm text-gray-500 font-medium truncate">
                                                    {file ? <span className="text-indigo-600">{file.name}</span> : 'Klik untuk upload atau drag & drop'}
                                                </p>
                                                <p className="text-xs text-gray-400 ml-auto shrink-0">PDF, JPG, PNG (Max 5MB)</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-1">
                                    <button type="submit" disabled={loading}
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
                                        {loading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                                        {loading ? 'Menyimpan...' : 'Simpan Data'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>

                {/* My Documents Table */}
                <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <h3 className="text-lg font-bold text-gray-800">Daftar Data Saya</h3>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-600">Show</span>
                                <select
                                    value={perPage}
                                    onChange={e => setPerPage(Number(e.target.value))}
                                    className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    {[5, 10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                                <span className="text-sm text-gray-600">entries</span>
                            </div>
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="text-sm border border-gray-200 rounded-lg pl-9 pr-3 py-2 bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none w-48"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                                    <th className="p-4">No</th>
                                    <th className="p-4">Nama Rekening</th>
                                    <th className="p-4">Tahun</th>
                                    <th className="p-4">TW</th>
                                    <th className="p-4">Periode</th>
                                    <th className="p-4">Pelaporan</th>
                                    <th className="p-4">Verifikasi</th>
                                    <th className="p-4 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loadingDocs ? (
                                    <tr><td colSpan={8} className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" /></td></tr>
                                ) : displayedDocuments.length === 0 ? (
                                    <tr><td colSpan={8} className="p-8 text-center text-gray-500">Belum ada data.</td></tr>
                                ) : displayedDocuments.map((doc, idx) => {
                                    const nominalColor = getNominalColor(doc);
                                    const nerNominal = getNerNominal(doc);

                                    return (
                                        <tr key={doc.id} className="hover:bg-gray-50/50">
                                            <td className="p-4 text-sm">{idx + 1}</td>
                                            <td className="p-4 text-sm font-medium">{doc.kategori}</td>
                                            <td className="p-4 text-sm">{doc.tahun}</td>
                                            <td className="p-4 text-sm">{doc.triwulan}</td>
                                            <td className="p-4 text-sm">{doc.periode}</td>
                                            <td className={clsx('p-4 text-sm font-semibold', nominalColor)}>
                                                Rp {doc.nominal_pelaporan.toLocaleString('id-ID')}
                                            </td>
                                            <td className={clsx('p-4 text-sm font-semibold', nominalColor)}>
                                                {nerNominal !== null ? (
                                                    `Rp ${nerNominal.toLocaleString('id-ID')}`
                                                ) : (
                                                    <span className="text-gray-300">-</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button onClick={() => setDetailDoc(doc)} title="Lihat Detail"
                                                        className="p-1.5 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors">
                                                        <Eye size={16} />
                                                    </button>
                                                    {doc.status_verifikasi === 'menunggu' && (
                                                        <button onClick={() => handleDelete(doc.id)} title="Hapus"
                                                            className="p-1.5 hover:bg-red-100 text-red-500 rounded-lg transition-colors">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-6 py-3 border-t border-gray-100">
                        <p className="text-sm text-gray-500">
                            Showing {displayedDocuments.length > 0 ? 1 : 0} to {displayedDocuments.length} of {filteredDocuments.length} entries
                        </p>
                    </div>
                </div>
            </main>

            {detailDoc && (
                <DetailModal doc={detailDoc} onClose={() => setDetailDoc(null)} readOnly />
            )}
        </div>
    );
};
