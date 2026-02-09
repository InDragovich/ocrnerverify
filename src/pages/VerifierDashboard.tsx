import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import type { User } from '../services/authService';
import { verifikasiService } from '../services/verifikasiService';
import type { VerifikasiItem, Filters } from '../services/verifikasiService';
import { CATEGORIES } from '../data/constants';
import { Header } from '../components/Header';
import { DetailModal } from '../components/DetailModal';
import {
    Filter, Eye, Loader2,
    PlayCircle, CheckSquare, Square, MinusSquare, Search,
} from 'lucide-react';
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

export const VerifierDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);

    // filters
    const [filters, setFilters] = useState<Filters>({
        kategori: '', tahun: '', triwulan: '', status_verifikasi: '', hasil_kesesuaian: '', page: 1, per_page: 15,
    });
    const [searchQuery, setSearchQuery] = useState('');

    // data
    const [documents, setDocuments] = useState<VerifikasiItem[]>([]);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [loading, setLoading] = useState(false);

    // selection
    const [selected, setSelected] = useState<Set<number>>(new Set());

    // batch processing
    const [batchProcessing, setBatchProcessing] = useState(false);
    const [batchIds, setBatchIds] = useState<number[]>([]);
    const [batchProgress, setBatchProgress] = useState({ total: 0, completed: 0, processing: 0, failed: 0 });
    const [batchMsg, setBatchMsg] = useState('');

    // detail modal
    const [detailDoc, setDetailDoc] = useState<VerifikasiItem | null>(null);

    useEffect(() => {
        const currentUser = authService.getCurrentUser();
        if (!currentUser || (currentUser.role !== 'verifikator' && currentUser.role !== 'super_admin')) {
            navigate('/');
            return;
        }
        setUser(currentUser);
    }, [navigate]);

    const loadDocuments = useCallback(async () => {
        setLoading(true);
        try {
            const result = await verifikasiService.getList(filters);
            setDocuments(result.data);
            setTotalPages(result.last_page);
            setTotalItems(result.total);
        } catch {
            // silent
        }
        setLoading(false);
    }, [filters]);

    useEffect(() => {
        if (user) loadDocuments();
    }, [user, loadDocuments]);

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
        setSelected(new Set());
    };

    const handlePageChange = (page: number) => {
        setFilters(prev => ({ ...prev, page }));
        setSelected(new Set());
    };

    const handlePerPageChange = (perPage: number) => {
        setFilters(prev => ({ ...prev, per_page: perPage, page: 1 }));
        setSelected(new Set());
    };

    // Checkbox logic
    const selectableIds = documents
        .filter(d => d.status_verifikasi === 'menunggu' || d.status_verifikasi === 'gagal' || d.status_verifikasi === 'diproses')
        .map(d => d.id);

    const allSelected = selectableIds.length > 0 && selectableIds.every(id => selected.has(id));
    const someSelected = selectableIds.some(id => selected.has(id)) && !allSelected;

    const toggleSelectAll = () => {
        if (allSelected) {
            setSelected(new Set());
        } else {
            setSelected(new Set(selectableIds));
        }
    };

    const toggleSelect = (id: number) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Batch verify
    const handleBatchVerify = async () => {
        if (selected.size === 0) return;
        const ids = Array.from(selected);
        setBatchProcessing(true);
        setBatchIds(ids);
        setBatchMsg('');
        setBatchProgress({ total: ids.length, completed: 0, processing: ids.length, failed: 0 });

        try {
            await verifikasiService.batchVerify(ids);

            // Jobs run synchronously on the server, so fetch final status
            try {
                const status = await verifikasiService.getBatchStatus(ids);
                setBatchProgress({
                    total: status.total,
                    completed: status.completed,
                    processing: status.processing,
                    failed: status.failed,
                });
                const successCount = status.completed - status.failed;
                setBatchMsg(
                    `Verifikasi selesai: ${successCount} berhasil` +
                    (status.failed > 0 ? `, ${status.failed} gagal` : '')
                );
            } catch {
                setBatchProgress({ total: ids.length, completed: ids.length, processing: 0, failed: 0 });
                setBatchMsg('Verifikasi selesai.');
            }

            setBatchProcessing(false);
            setBatchIds([]);
            setSelected(new Set());
            loadDocuments();
            setTimeout(() => setBatchMsg(''), 5000);
        } catch (err: unknown) {
            setBatchProcessing(false);
            setBatchIds([]);
            const axiosErr = err as { response?: { data?: { message?: string } } };
            const msg = axiosErr?.response?.data?.message || (err instanceof Error ? err.message : 'Terjadi kesalahan');
            setBatchMsg(`Gagal memproses verifikasi: ${msg}`);
            loadDocuments(); // refresh to see current state
            setTimeout(() => setBatchMsg(''), 8000);
        }
    };

    const progressPercent = batchProgress.total > 0
        ? Math.round(((batchProgress.completed + batchProgress.failed) / batchProgress.total) * 100)
        : 0;

    const handleDetailClose = () => {
        setDetailDoc(null);
        loadDocuments(); // refresh in case keputusan was set
    };

    // Filter documents by search query (client-side)
    const filteredDocuments = searchQuery
        ? documents.filter(doc =>
            doc.kategori.toLowerCase().includes(searchQuery.toLowerCase()) ||
            doc.operator?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            doc.regional.toLowerCase().includes(searchQuery.toLowerCase()) ||
            doc.kcu.toLowerCase().includes(searchQuery.toLowerCase()) ||
            doc.kpc.toLowerCase().includes(searchQuery.toLowerCase()) ||
            doc.periode.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : documents;

    if (!user) return null;

    return (
        <div className="min-h-screen bg-gray-50">
            <Header user={user} />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Dashboard Verifikasi</h1>
                    <p className="text-gray-500">Kelola dan verifikasi dokumen biaya rutin yang masuk.</p>
                </div>

                {/* Batch Progress */}
                {batchProcessing && (
                    <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-semibold text-indigo-700">
                                Memproses verifikasi otomatis... ({batchProgress.completed + batchProgress.failed}/{batchProgress.total})
                            </p>
                            <span className="text-xs text-indigo-500">{progressPercent}%</span>
                        </div>
                        <div className="w-full bg-indigo-200 rounded-full h-2.5">
                            <div
                                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        {batchProgress.failed > 0 && (
                            <p className="text-xs text-red-600 mt-1">{batchProgress.failed} item gagal diproses.</p>
                        )}
                    </div>
                )}

                {/* Batch Result Message */}
                {!batchProcessing && batchMsg && (
                    <div className={clsx(
                        'mb-6 rounded-xl p-4 text-sm font-medium',
                        batchMsg.includes('Gagal') ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'
                    )}>
                        {batchMsg}
                    </div>
                )}

                {/* Filters & Actions */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        <div className="flex items-center gap-2 text-gray-400">
                            <Filter size={18} />
                            <span className="text-sm font-medium text-gray-600">Filter:</span>
                        </div>
                        <div className="flex flex-wrap gap-3 flex-1">
                            <select value={filters.kategori} onChange={e => handleFilterChange('kategori', e.target.value)}
                                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none">
                                <option value="">Semua Rekening</option>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <select value={filters.tahun} onChange={e => handleFilterChange('tahun', e.target.value)}
                                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none">
                                <option value="">Semua Tahun</option>
                                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                            <select value={filters.triwulan} onChange={e => handleFilterChange('triwulan', e.target.value)}
                                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none">
                                <option value="">Semua TW</option>
                                {[1, 2, 3, 4].map(t => <option key={t} value={t}>TW {t}</option>)}
                            </select>
                        </div>
                        <button
                            onClick={handleBatchVerify}
                            disabled={selected.size === 0 || batchProcessing}
                            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap"
                        >
                            <PlayCircle size={18} />
                            Verifikasi Otomatis ({selected.size})
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {/* Table toolbar */}
                    <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">Show</span>
                            <select
                                value={filters.per_page || 15}
                                onChange={e => handlePerPageChange(Number(e.target.value))}
                                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                {[5, 10, 15, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
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
                                className="text-sm border border-gray-200 rounded-lg pl-9 pr-3 py-2 bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none w-64"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                                    <th className="p-4 w-10">
                                        <button onClick={toggleSelectAll} className="text-gray-400 hover:text-indigo-600 transition-colors" disabled={selectableIds.length === 0}>
                                            {allSelected ? <CheckSquare size={18} className="text-indigo-600" /> : someSelected ? <MinusSquare size={18} className="text-indigo-400" /> : <Square size={18} />}
                                        </button>
                                    </th>
                                    <th className="p-4">No</th>
                                    <th className="p-4">Nama Rekening</th>
                                    <th className="p-4">Operator</th>
                                    <th className="p-4">Regional</th>
                                    <th className="p-4">Tahun</th>
                                    <th className="p-4">TW</th>
                                    <th className="p-4">Periode</th>
                                    <th className="p-4">Pelaporan</th>
                                    <th className="p-4">Verifikasi</th>
                                    <th className="p-4 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={11} className="p-8 text-center">
                                            <Loader2 className="animate-spin mx-auto text-gray-400" />
                                        </td>
                                    </tr>
                                ) : filteredDocuments.length === 0 ? (
                                    <tr>
                                        <td colSpan={11} className="p-8 text-center text-gray-500">
                                            Belum ada data.
                                        </td>
                                    </tr>
                                ) : filteredDocuments.map((doc, idx) => {
                                    const canSelect = doc.status_verifikasi === 'menunggu' || doc.status_verifikasi === 'gagal' || doc.status_verifikasi === 'diproses';
                                    const isProcessingBatch = batchIds.includes(doc.id);
                                    const rowNum = ((filters.page || 1) - 1) * (filters.per_page || 15) + idx + 1;
                                    const nominalColor = getNominalColor(doc);
                                    const nerNominal = getNerNominal(doc);

                                    return (
                                        <tr key={doc.id} className={clsx('hover:bg-gray-50/50 transition-colors', isProcessingBatch && 'bg-indigo-50/30')}>
                                            <td className="p-4">
                                                {canSelect ? (
                                                    <button onClick={() => toggleSelect(doc.id)} className="text-gray-400 hover:text-indigo-600 transition-colors">
                                                        {selected.has(doc.id) ? <CheckSquare size={18} className="text-indigo-600" /> : <Square size={18} />}
                                                    </button>
                                                ) : (
                                                    <Square size={18} className="text-gray-200 cursor-not-allowed" />
                                                )}
                                            </td>
                                            <td className="p-4 text-sm text-gray-500">{rowNum}</td>
                                            <td className="p-4 text-sm font-medium text-gray-900">{doc.kategori}</td>
                                            <td className="p-4 text-sm">
                                                <p className="font-medium text-gray-900">{doc.operator?.name || '-'}</p>
                                            </td>
                                            <td className="p-4 text-sm">
                                                <p className="text-gray-700">{doc.regional}</p>
                                                <p className="text-xs text-gray-400">{doc.kcu} / {doc.kpc}</p>
                                            </td>
                                            <td className="p-4 text-sm">{doc.tahun}</td>
                                            <td className="p-4 text-sm">{doc.triwulan}</td>
                                            <td className="p-4 text-sm">{doc.periode}</td>
                                            <td className={clsx('p-4 text-sm font-semibold', nominalColor)}>
                                                {isProcessingBatch ? (
                                                    <span className="flex items-center gap-1 text-indigo-500">
                                                        <Loader2 size={14} className="animate-spin" /> Proses...
                                                    </span>
                                                ) : (
                                                    `Rp ${doc.nominal_pelaporan.toLocaleString('id-ID')}`
                                                )}
                                            </td>
                                            <td className={clsx('p-4 text-sm font-semibold', nominalColor)}>
                                                {isProcessingBatch ? (
                                                    <span className="flex items-center gap-1 text-indigo-500">
                                                        <Loader2 size={14} className="animate-spin" />
                                                    </span>
                                                ) : nerNominal !== null ? (
                                                    `Rp ${nerNominal.toLocaleString('id-ID')}`
                                                ) : (
                                                    <span className="text-gray-300">-</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-center">
                                                <button
                                                    onClick={() => setDetailDoc(doc)}
                                                    className="p-1.5 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors"
                                                    title="Lihat Detail"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                        <p className="text-sm text-gray-500">
                            Showing {filteredDocuments.length > 0 ? ((filters.page || 1) - 1) * (filters.per_page || 15) + 1 : 0} to {Math.min((filters.page || 1) * (filters.per_page || 15), totalItems)} of {totalItems} entries
                        </p>
                        {totalPages > 1 && (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => handlePageChange((filters.page || 1) - 1)}
                                    disabled={(filters.page || 1) <= 1}
                                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30 transition-colors"
                                >
                                    Previous
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1)
                                    .filter(p => Math.abs(p - (filters.page || 1)) <= 2 || p === 1 || p === totalPages)
                                    .map((p, idx, arr) => (
                                        <React.Fragment key={p}>
                                            {idx > 0 && arr[idx - 1] !== p - 1 && (
                                                <span className="px-2 text-gray-300">...</span>
                                            )}
                                            <button
                                                onClick={() => handlePageChange(p)}
                                                className={clsx(
                                                    'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                                                    p === (filters.page || 1)
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'border border-gray-200 hover:bg-gray-50 text-gray-600'
                                                )}
                                            >
                                                {p}
                                            </button>
                                        </React.Fragment>
                                    ))}
                                <button
                                    onClick={() => handlePageChange((filters.page || 1) + 1)}
                                    disabled={(filters.page || 1) >= totalPages}
                                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30 transition-colors"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Detail Modal */}
            {detailDoc && (
                <DetailModal doc={detailDoc} onClose={handleDetailClose} />
            )}
        </div>
    );
};
