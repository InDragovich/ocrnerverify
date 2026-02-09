import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import type { User } from '../services/authService';
import { verifikasiService } from '../services/verifikasiService';
import type { VerifikasiItem, Filters } from '../services/verifikasiService';
import { CATEGORIES, MONTHS, STATUS_VERIFIKASI, HASIL_KESESUAIAN } from '../data/constants';
import { Header } from '../components/Header';
import { DetailModal } from '../components/DetailModal';
import {
    Filter, Eye, Loader2, ChevronLeft, ChevronRight,
    PlayCircle, CheckSquare, Square, MinusSquare,
} from 'lucide-react';
import clsx from 'clsx';

export const VerifierDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);

    // filters
    const [filters, setFilters] = useState<Filters>({
        kategori: '', tahun: '', triwulan: '', status_verifikasi: '', hasil_kesesuaian: '', page: 1, per_page: 15,
    });

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
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, []);

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
        setSelected(new Set());
    };

    const handlePageChange = (page: number) => {
        setFilters(prev => ({ ...prev, page }));
        setSelected(new Set());
    };

    // Checkbox logic
    const selectableIds = documents
        .filter(d => d.status_verifikasi === 'menunggu' || d.status_verifikasi === 'gagal')
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
        setBatchProgress({ total: ids.length, completed: 0, processing: ids.length, failed: 0 });

        try {
            await verifikasiService.batchVerify(ids);

            // Start polling
            pollingRef.current = setInterval(async () => {
                try {
                    const status = await verifikasiService.getBatchStatus(ids);
                    setBatchProgress({
                        total: status.total,
                        completed: status.completed,
                        processing: status.processing,
                        failed: status.failed,
                    });

                    if (status.processing === 0) {
                        // All done
                        if (pollingRef.current) clearInterval(pollingRef.current);
                        pollingRef.current = null;
                        setBatchProcessing(false);
                        setBatchIds([]);
                        setSelected(new Set());
                        loadDocuments();
                    }
                } catch {
                    // ignore polling errors
                }
            }, 3000);
        } catch {
            setBatchProcessing(false);
            setBatchIds([]);
        }
    };

    const progressPercent = batchProgress.total > 0
        ? Math.round(((batchProgress.completed + batchProgress.failed) / batchProgress.total) * 100)
        : 0;

    const handleDetailClose = () => {
        setDetailDoc(null);
        loadDocuments(); // refresh in case keputusan was set
    };

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
                                <option value="">Semua Kategori</option>
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
                            <select value={filters.status_verifikasi} onChange={e => handleFilterChange('status_verifikasi', e.target.value)}
                                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none">
                                <option value="">Semua Status</option>
                                {Object.entries(STATUS_VERIFIKASI).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                            <select value={filters.hasil_kesesuaian} onChange={e => handleFilterChange('hasil_kesesuaian', e.target.value)}
                                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none">
                                <option value="">Semua Kesesuaian</option>
                                {Object.entries(HASIL_KESESUAIAN).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
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
                                    <th className="p-4">Kategori</th>
                                    <th className="p-4">Operator</th>
                                    <th className="p-4">Regional</th>
                                    <th className="p-4">Tahun</th>
                                    <th className="p-4">TW</th>
                                    <th className="p-4">Periode</th>
                                    <th className="p-4">Nominal</th>
                                    <th className="p-4">Lampiran</th>
                                    <th className="p-4 text-center">Status</th>
                                    <th className="p-4 text-center">Kesesuaian</th>
                                    <th className="p-4 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={13} className="p-8 text-center">
                                            <Loader2 className="animate-spin mx-auto text-gray-400" />
                                        </td>
                                    </tr>
                                ) : documents.length === 0 ? (
                                    <tr>
                                        <td colSpan={13} className="p-8 text-center text-gray-500">
                                            Belum ada data.
                                        </td>
                                    </tr>
                                ) : documents.map((doc, idx) => {
                                    const canSelect = doc.status_verifikasi === 'menunggu' || doc.status_verifikasi === 'gagal';
                                    const isProcessingBatch = batchIds.includes(doc.id);
                                    const rowNum = ((filters.page || 1) - 1) * (filters.per_page || 15) + idx + 1;

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
                                            <td className="p-4 text-sm font-medium">Rp {doc.nominal_pelaporan.toLocaleString('id-ID')}</td>
                                            <td className="p-4 text-sm text-indigo-600 truncate max-w-[150px]">{doc.lampiran_nama_asli}</td>
                                            <td className="p-4 text-center">
                                                <span className={clsx('px-2 py-1 rounded-full text-xs font-medium border', STATUS_VERIFIKASI[doc.status_verifikasi]?.color)}>
                                                    {isProcessingBatch ? (
                                                        <span className="flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Proses</span>
                                                    ) : STATUS_VERIFIKASI[doc.status_verifikasi]?.label}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className={clsx('px-2 py-1 rounded-full text-xs font-medium border', HASIL_KESESUAIAN[doc.hasil_kesesuaian]?.color)}>
                                                    {HASIL_KESESUAIAN[doc.hasil_kesesuaian]?.label}
                                                </span>
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
                    {totalPages > 1 && (
                        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                            <p className="text-sm text-gray-500">
                                Menampilkan {documents.length} dari {totalItems} data
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handlePageChange((filters.page || 1) - 1)}
                                    disabled={(filters.page || 1) <= 1}
                                    className="p-2 hover:bg-gray-100 disabled:opacity-30 rounded-lg transition-colors"
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1)
                                    .filter(p => Math.abs(p - (filters.page || 1)) <= 2 || p === 1 || p === totalPages)
                                    .map((p, idx, arr) => (
                                        <React.Fragment key={p}>
                                            {idx > 0 && arr[idx - 1] !== p - 1 && (
                                                <span className="text-gray-300">...</span>
                                            )}
                                            <button
                                                onClick={() => handlePageChange(p)}
                                                className={clsx(
                                                    'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                                                    p === (filters.page || 1)
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'hover:bg-gray-100 text-gray-600'
                                                )}
                                            >
                                                {p}
                                            </button>
                                        </React.Fragment>
                                    ))}
                                <button
                                    onClick={() => handlePageChange((filters.page || 1) + 1)}
                                    disabled={(filters.page || 1) >= totalPages}
                                    className="p-2 hover:bg-gray-100 disabled:opacity-30 rounded-lg transition-colors"
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Detail Modal */}
            {detailDoc && (
                <DetailModal doc={detailDoc} onClose={handleDetailClose} />
            )}
        </div>
    );
};
