import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import type { User } from '../services/authService';
import { verifikasiService } from '../services/verifikasiService';
import type { VerifikasiItem, Filters, SummaryItem } from '../services/verifikasiService';
import { CATEGORIES } from '../data/constants';
import { Header } from '../components/Header';
import { DetailModal } from '../components/DetailModal';
import {
    Filter, Eye, Loader2,
    PlayCircle, CheckSquare, Square, MinusSquare, Search,
    ChevronRight, Building2, Landmark, MapPin, FileText,
} from 'lucide-react';
import clsx from 'clsx';

// ─── Types ───────────────────────────────────────────────────────────────────
type DrillLevel = 'regional' | 'kcu' | 'kpc' | 'rekening';
interface DrillPath { regional?: string; kcu?: string; kpc?: string; }

const LEVEL_LABELS: Record<DrillLevel, string> = {
    regional: 'Regional',
    kcu: 'KCU',
    kpc: 'KPC',
    rekening: 'Dokumen',
};
const LEVEL_ICONS: Record<DrillLevel, React.ReactNode> = {
    regional: <Building2 size={16} />,
    kcu: <Landmark size={16} />,
    kpc: <MapPin size={16} />,
    rekening: <FileText size={16} />,
};
const SUB_LABELS: Record<string, string> = {
    regional: 'KCU',
    kcu: 'KPC',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getNominalColor(doc: VerifikasiItem): string {
    if (doc.status_verifikasi === 'menunggu' || doc.status_verifikasi === 'diproses') {
        return 'text-gray-400';
    }
    const nerNominal = doc.hasil_entitas?.nominal ? Number(doc.hasil_entitas.nominal) : null;
    if (nerNominal === null) return 'text-gray-400';
    return doc.nominal_pelaporan === nerNominal ? 'text-green-600' : 'text-red-600';
}

function formatBiaya(value: number): string {
    return `Rp ${value.toLocaleString('id-ID')}`;
}

// ─── SummaryTable Component ──────────────────────────────────────────────────
interface SummaryTableProps {
    data: SummaryItem[];
    level: DrillLevel;
    loading: boolean;
    onDrillDown: (nama: string) => void;
}

const SummaryTable: React.FC<SummaryTableProps> = ({ data, level, loading, onDrillDown }) => {
    const subLabel = SUB_LABELS[level];

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50/50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                            <th className="p-4 w-12">No</th>
                            <th className="p-4">Nama</th>
                            {subLabel && <th className="p-4 text-center">Jml {subLabel}</th>}
                            <th className="p-4 text-center">Total Dokumen</th>
                            <th className="p-4 text-right">Total Biaya</th>
                            <th className="p-4">Progress</th>
                            <th className="p-4 text-center">Status Verifikasi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr>
                                <td colSpan={subLabel ? 7 : 6} className="p-8 text-center">
                                    <Loader2 className="animate-spin mx-auto text-gray-400" />
                                </td>
                            </tr>
                        ) : data.length === 0 ? (
                            <tr>
                                <td colSpan={subLabel ? 7 : 6} className="p-8 text-center text-gray-500">
                                    Belum ada data.
                                </td>
                            </tr>
                        ) : data.map((item, idx) => {
                            const total = item.total_dokumen;
                            const sudahVerifikasi = item.selesai;
                            const pct = total > 0 ? Math.round((sudahVerifikasi / total) * 100) : 0;

                            return (
                                <tr
                                    key={item.nama}
                                    onClick={() => onDrillDown(item.nama)}
                                    className="hover:bg-indigo-50/40 cursor-pointer transition-colors group"
                                >
                                    <td className="p-4 text-sm text-gray-500">{idx + 1}</td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">
                                                {item.nama || '(kosong)'}
                                            </span>
                                            <ChevronRight size={14} className="text-gray-300 group-hover:text-indigo-500 transition-colors" />
                                        </div>
                                    </td>
                                    {subLabel && (
                                        <td className="p-4 text-center text-sm font-medium text-gray-700">
                                            {item.jumlah_sub}
                                        </td>
                                    )}
                                    <td className="p-4 text-center text-sm font-medium text-gray-700">
                                        {item.total_dokumen}
                                    </td>
                                    <td className="p-4 text-right text-sm font-semibold text-gray-900">
                                        {formatBiaya(item.total_biaya)}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-[80px]">
                                                <div
                                                    className={clsx(
                                                        'h-2 rounded-full transition-all duration-500',
                                                        pct === 100 ? 'bg-green-500' : pct > 0 ? 'bg-amber-400' : 'bg-gray-300'
                                                    )}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                            <span className="text-xs text-gray-500 whitespace-nowrap w-16 text-right">
                                                {sudahVerifikasi}/{total}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        {item.menunggu + item.gagal > 0 ? (
                                            <span className="inline-block text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                                                Belum Verifikasi ({item.menunggu + item.gagal})
                                            </span>
                                        ) : (
                                            <span className="inline-block text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                                                Sudah Verifikasi
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export const VerifierDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);

    // drill-down state
    const [drillLevel, setDrillLevel] = useState<DrillLevel>('regional');
    const [drillPath, setDrillPath] = useState<DrillPath>({});

    // summary data (Level 1-3)
    const [summaryData, setSummaryData] = useState<SummaryItem[]>([]);
    const [loadingSummary, setLoadingSummary] = useState(false);

    // filters (global: tahun, triwulan; level 4 only: kategori, status)
    const [filters, setFilters] = useState<Filters>({
        kategori: '', tahun: '', triwulan: '', status_verifikasi: '', hasil_kesesuaian: '', page: 1, per_page: 15,
    });
    const [searchQuery, setSearchQuery] = useState('');

    // document data (Level 4)
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

    // ─── Load summary (Level 1-3) ────────────────────────────────────────────
    const loadSummary = useCallback(async () => {
        if (drillLevel === 'rekening') return;
        setLoadingSummary(true);
        try {
            const data = await verifikasiService.getSummary({
                group_by: drillLevel,
                tahun: filters.tahun || undefined,
                triwulan: filters.triwulan || undefined,
                regional: drillPath.regional || undefined,
                kcu: drillPath.kcu || undefined,
            });
            setSummaryData(data);
        } catch {
            setSummaryData([]);
        }
        setLoadingSummary(false);
    }, [drillLevel, drillPath, filters.tahun, filters.triwulan]);

    // ─── Load documents (Level 4) ────────────────────────────────────────────
    const loadDocuments = useCallback(async () => {
        if (drillLevel !== 'rekening') return;
        setLoading(true);
        try {
            const result = await verifikasiService.getList({
                ...filters,
                regional: drillPath.regional,
                kcu: drillPath.kcu,
                kpc: drillPath.kpc,
            });
            setDocuments(result.data);
            setTotalPages(result.last_page);
            setTotalItems(result.total);
        } catch {
            // silent
        }
        setLoading(false);
    }, [drillLevel, drillPath, filters]);

    useEffect(() => {
        if (user && drillLevel !== 'rekening') loadSummary();
    }, [user, drillLevel, loadSummary]);

    useEffect(() => {
        if (user && drillLevel === 'rekening') loadDocuments();
    }, [user, drillLevel, loadDocuments]);

    // ─── Navigation ──────────────────────────────────────────────────────────
    const handleDrillDown = (nama: string) => {
        if (drillLevel === 'regional') {
            setDrillPath({ regional: nama });
            setDrillLevel('kcu');
        } else if (drillLevel === 'kcu') {
            setDrillPath(prev => ({ ...prev, kcu: nama }));
            setDrillLevel('kpc');
        } else if (drillLevel === 'kpc') {
            setDrillPath(prev => ({ ...prev, kpc: nama }));
            setDrillLevel('rekening');
            setFilters(prev => ({ ...prev, page: 1 }));
            setSelected(new Set());
        }
    };

    const handleBreadcrumbNav = (level: DrillLevel) => {
        if (level === drillLevel) return;
        if (level === 'regional') {
            setDrillPath({});
            setDrillLevel('regional');
        } else if (level === 'kcu') {
            setDrillPath(prev => ({ regional: prev.regional }));
            setDrillLevel('kcu');
        } else if (level === 'kpc') {
            setDrillPath(prev => ({ regional: prev.regional, kcu: prev.kcu }));
            setDrillLevel('kpc');
        }
        setSelected(new Set());
    };

    // ─── Filters ─────────────────────────────────────────────────────────────
    const handleGlobalFilterChange = (key: 'tahun' | 'triwulan', value: string) => {
        setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
        // Reset to level 1 when global filter changes
        setDrillPath({});
        setDrillLevel('regional');
        setSelected(new Set());
    };

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

    // ─── Selection (Level 4) ─────────────────────────────────────────────────
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

    // ─── Batch verify (Level 4) ──────────────────────────────────────────────
    const handleBatchVerify = async () => {
        if (selected.size === 0) return;
        const ids = Array.from(selected);
        setBatchProcessing(true);
        setBatchIds(ids);
        setBatchMsg('');
        setBatchProgress({ total: ids.length, completed: 0, processing: ids.length, failed: 0 });

        try {
            await verifikasiService.batchVerify(ids);

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
            loadDocuments();
            setTimeout(() => setBatchMsg(''), 8000);
        }
    };

    const progressPercent = batchProgress.total > 0
        ? Math.round(((batchProgress.completed + batchProgress.failed) / batchProgress.total) * 100)
        : 0;

    const handleDetailClose = () => {
        setDetailDoc(null);
        loadDocuments();
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

    // ─── Build breadcrumb segments ───────────────────────────────────────────
    const breadcrumbs: { level: DrillLevel; label: string }[] = [
        { level: 'regional', label: 'Dashboard Verifikasi' },
    ];
    if (drillPath.regional) {
        breadcrumbs.push({ level: 'kcu', label: drillPath.regional });
    }
    if (drillPath.kcu) {
        breadcrumbs.push({ level: 'kpc', label: drillPath.kcu });
    }
    if (drillPath.kpc) {
        breadcrumbs.push({ level: 'rekening', label: drillPath.kpc });
    }

    const isDocLevel = drillLevel === 'rekening';

    return (
        <div className="min-h-screen bg-gray-50">
            <Header user={user} />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Building2 className="text-indigo-600" size={28} />
                        Dashboard Verifikasi
                    </h1>
                    <p className="text-gray-500 mt-1">
                        {isDocLevel
                            ? 'Daftar dokumen biaya rutin untuk verifikasi.'
                            : `Pilih ${LEVEL_LABELS[drillLevel].toLowerCase()} untuk melihat detail.`
                        }
                    </p>
                    {/* Breadcrumb — only show when drilled down */}
                    {breadcrumbs.length > 1 && (
                        <nav className="flex items-center gap-1.5 text-sm mt-3 flex-wrap">
                            {breadcrumbs.map((bc, i) => {
                                const isLast = i === breadcrumbs.length - 1;
                                return (
                                    <React.Fragment key={bc.level}>
                                        {i > 0 && <ChevronRight size={14} className="text-gray-300" />}
                                        {isLast ? (
                                            <span className="flex items-center gap-1 font-semibold text-gray-900">
                                                {LEVEL_ICONS[bc.level]}
                                                {bc.label}
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => handleBreadcrumbNav(bc.level)}
                                                className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
                                            >
                                                {LEVEL_ICONS[bc.level]}
                                                {bc.label}
                                            </button>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </nav>
                    )}
                </div>

                {/* Batch Progress (Level 4 only) */}
                {isDocLevel && batchProcessing && (
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
                {isDocLevel && !batchProcessing && batchMsg && (
                    <div className={clsx(
                        'mb-6 rounded-xl p-4 text-sm font-medium',
                        batchMsg.includes('Gagal') ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'
                    )}>
                        {batchMsg}
                    </div>
                )}

                {/* Filters */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        <div className="flex items-center gap-2 text-gray-400">
                            <Filter size={18} />
                            <span className="text-sm font-medium text-gray-600">Filter:</span>
                        </div>
                        <div className="flex flex-wrap gap-3 flex-1">
                            <select value={filters.tahun} onChange={e => handleGlobalFilterChange('tahun', e.target.value)}
                                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none">
                                <option value="">Semua Tahun</option>
                                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                            <select value={filters.triwulan} onChange={e => handleGlobalFilterChange('triwulan', e.target.value)}
                                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none">
                                <option value="">Semua TW</option>
                                {[1, 2, 3, 4].map(t => <option key={t} value={t}>TW {t}</option>)}
                            </select>
                            {/* Kategori & Status only at document level */}
                            {isDocLevel && (
                                <>
                                    <select value={filters.kategori} onChange={e => handleFilterChange('kategori', e.target.value)}
                                        className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none">
                                        <option value="">Semua Rekening</option>
                                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <select value={filters.status_verifikasi} onChange={e => handleFilterChange('status_verifikasi', e.target.value)}
                                        className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none">
                                        <option value="">Semua Status</option>
                                        <option value="menunggu">Menunggu</option>
                                        <option value="diproses">Diproses</option>
                                        <option value="selesai">Selesai</option>
                                        <option value="gagal">Gagal</option>
                                    </select>
                                </>
                            )}
                        </div>
                        {isDocLevel && (
                            <button
                                onClick={handleBatchVerify}
                                disabled={selected.size === 0 || batchProcessing}
                                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap"
                            >
                                <PlayCircle size={18} />
                                Verifikasi Otomatis ({selected.size})
                            </button>
                        )}
                    </div>
                </div>

                {/* ─── Level 1-3: Summary Table ─── */}
                {!isDocLevel && (
                    <SummaryTable
                        data={summaryData}
                        level={drillLevel}
                        loading={loadingSummary}
                        onDrillDown={handleDrillDown}
                    />
                )}

                {/* ─── Level 4: Document Table ─── */}
                {isDocLevel && (
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
                                        <th className="p-4">Tahun</th>
                                        <th className="p-4">TW</th>
                                        <th className="p-4">Periode</th>
                                        <th className="p-4">Pelaporan</th>
                                        <th className="p-4 text-center">Status Verifikasi</th>
                                        <th className="p-4 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={10} className="p-8 text-center">
                                                <Loader2 className="animate-spin mx-auto text-gray-400" />
                                            </td>
                                        </tr>
                                    ) : filteredDocuments.length === 0 ? (
                                        <tr>
                                            <td colSpan={10} className="p-8 text-center text-gray-500">
                                                Belum ada data.
                                            </td>
                                        </tr>
                                    ) : filteredDocuments.map((doc, idx) => {
                                        const canSelect = doc.status_verifikasi === 'menunggu' || doc.status_verifikasi === 'gagal' || doc.status_verifikasi === 'diproses';
                                        const isProcessingBatch = batchIds.includes(doc.id);
                                        const rowNum = ((filters.page || 1) - 1) * (filters.per_page || 15) + idx + 1;
                                        const nominalColor = getNominalColor(doc);

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
                                                <td className="p-4 text-center">
                                                    {isProcessingBatch ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                                                            <Loader2 size={12} className="animate-spin" /> Diproses
                                                        </span>
                                                    ) : doc.status_verifikasi === 'selesai' && doc.hasil_kesesuaian === 'sesuai' ? (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                                                            Sesuai
                                                        </span>
                                                    ) : doc.status_verifikasi === 'selesai' && doc.hasil_kesesuaian === 'tidak_sesuai' ? (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                                                            Tidak Sesuai
                                                        </span>
                                                    ) : doc.status_verifikasi === 'selesai' ? (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                                                            Belum Ditentukan
                                                        </span>
                                                    ) : doc.status_verifikasi === 'gagal' ? (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                                                            Gagal
                                                        </span>
                                                    ) : doc.status_verifikasi === 'diproses' ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                                                            <Loader2 size={12} className="animate-spin" /> Diproses
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
                                                            Menunggu
                                                        </span>
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
                )}
            </main>

            {/* Detail Modal */}
            {detailDoc && (
                <DetailModal doc={detailDoc} onClose={handleDetailClose} />
            )}
        </div>
    );
};
