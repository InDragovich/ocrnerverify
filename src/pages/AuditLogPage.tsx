import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import type { User } from '../services/authService';
import { Header } from '../components/Header';
import api from '../services/api';
import { Search, Loader2, ChevronLeft, ChevronRight, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import clsx from 'clsx';

interface AuditLogItem {
    id: number;
    user_id: number;
    action: string;
    auditable_type: string | null;
    auditable_id: number | null;
    old_values: Record<string, unknown> | null;
    new_values: Record<string, unknown> | null;
    ip_address: string | null;
    created_at: string;
    user?: { id: number; name: string; username: string; role: string } | null;
}

interface PaginatedAuditLogs {
    data: AuditLogItem[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

const ACTION_COLORS: Record<string, string> = {
    login: 'bg-blue-100 text-blue-700',
    logout: 'bg-gray-100 text-gray-600',
    create: 'bg-green-100 text-green-700',
    update: 'bg-yellow-100 text-yellow-700',
    delete: 'bg-red-100 text-red-700',
    batch_verify: 'bg-purple-100 text-purple-700',
    keputusan: 'bg-indigo-100 text-indigo-700',
    verify: 'bg-teal-100 text-teal-700',
};

function getActionColor(action: string): string {
    const key = Object.keys(ACTION_COLORS).find(k => action.toLowerCase().includes(k));
    return key ? ACTION_COLORS[key] : 'bg-gray-100 text-gray-600';
}

function formatAuditableType(type: string | null): string {
    if (!type) return '-';
    // Extract class name from full namespace
    const parts = type.split('\\');
    return parts[parts.length - 1] || type;
}

function formatDateTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

export const AuditLogPage: React.FC = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);

    const [logs, setLogs] = useState<AuditLogItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [perPage, setPerPage] = useState(15);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [filterAction, setFilterAction] = useState('');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');

    // Expanded rows for detail
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

    useEffect(() => {
        const currentUser = authService.getCurrentUser();
        if (!currentUser || currentUser.role !== 'super_admin') {
            navigate('/');
            return;
        }
        setUser(currentUser);
    }, [navigate]);

    const loadLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, string | number> = {
                page,
                per_page: perPage,
            };
            if (searchQuery) params.search = searchQuery;
            if (filterAction) params.action = filterAction;
            if (filterDateFrom) params.date_from = filterDateFrom;
            if (filterDateTo) params.date_to = filterDateTo;

            const { data } = await api.get<PaginatedAuditLogs>('/audit-logs', { params });
            setLogs(data.data);
            setTotalPages(data.last_page);
            setTotalItems(data.total);
        } catch {
            // silent
        }
        setLoading(false);
    }, [page, perPage, searchQuery, filterAction, filterDateFrom, filterDateTo]);

    useEffect(() => {
        if (user) loadLogs();
    }, [user, loadLogs]);

    const toggleExpand = (id: number) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
        setExpandedRows(new Set());
    };

    const handlePerPageChange = (newPerPage: number) => {
        setPerPage(newPerPage);
        setPage(1);
        setExpandedRows(new Set());
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-gray-50">
            <Header user={user} />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Activity className="text-indigo-600" size={24} />
                        Audit Logs
                    </h1>
                    <p className="text-gray-500">Riwayat aktivitas seluruh pengguna dalam sistem.</p>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
                    <div className="flex flex-col lg:flex-row lg:items-end gap-4">
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Cari</label>
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Cari user, aksi..."
                                    value={searchQuery}
                                    onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                                    className="text-sm border border-gray-200 rounded-lg pl-9 pr-3 py-2 bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none w-full"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Aksi</label>
                            <select
                                value={filterAction}
                                onChange={e => { setFilterAction(e.target.value); setPage(1); }}
                                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="">Semua Aksi</option>
                                <option value="login">Login</option>
                                <option value="logout">Logout</option>
                                <option value="create">Create</option>
                                <option value="update">Update</option>
                                <option value="delete">Delete</option>
                                <option value="batch_verify">Batch Verify</option>
                                <option value="keputusan">Keputusan</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Dari Tanggal</label>
                            <input
                                type="date"
                                value={filterDateFrom}
                                onChange={e => { setFilterDateFrom(e.target.value); setPage(1); }}
                                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Sampai Tanggal</label>
                            <input
                                type="date"
                                value={filterDateTo}
                                onChange={e => { setFilterDateTo(e.target.value); setPage(1); }}
                                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {/* Toolbar */}
                    <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">Show</span>
                            <select
                                value={perPage}
                                onChange={e => handlePerPageChange(Number(e.target.value))}
                                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                {[10, 15, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                            <span className="text-sm text-gray-600">entries</span>
                        </div>
                        <p className="text-sm text-gray-500">Total: {totalItems} log</p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                                    <th className="p-4 w-10"></th>
                                    <th className="p-4">No</th>
                                    <th className="p-4">Waktu</th>
                                    <th className="p-4">User</th>
                                    <th className="p-4">Aksi</th>
                                    <th className="p-4">Target</th>
                                    <th className="p-4">IP</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center">
                                            <Loader2 className="animate-spin mx-auto text-gray-400" />
                                        </td>
                                    </tr>
                                ) : logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-gray-500">
                                            Tidak ada data audit log.
                                        </td>
                                    </tr>
                                ) : logs.map((log, idx) => {
                                    const rowNum = (page - 1) * perPage + idx + 1;
                                    const isExpanded = expandedRows.has(log.id);
                                    const hasDetails = log.old_values || log.new_values;

                                    return (
                                        <React.Fragment key={log.id}>
                                            <tr className={clsx(
                                                'hover:bg-gray-50/50 transition-colors',
                                                isExpanded && 'bg-indigo-50/30'
                                            )}>
                                                <td className="p-4">
                                                    {hasDetails ? (
                                                        <button
                                                            onClick={() => toggleExpand(log.id)}
                                                            className="p-1 hover:bg-gray-100 rounded transition-colors text-gray-400"
                                                        >
                                                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                        </button>
                                                    ) : null}
                                                </td>
                                                <td className="p-4 text-sm text-gray-500">{rowNum}</td>
                                                <td className="p-4 text-sm text-gray-700 whitespace-nowrap">
                                                    {formatDateTime(log.created_at)}
                                                </td>
                                                <td className="p-4 text-sm">
                                                    <p className="font-medium text-gray-900">{log.user?.name || '-'}</p>
                                                    <p className="text-xs text-gray-400">{log.user?.username || ''}</p>
                                                </td>
                                                <td className="p-4">
                                                    <span className={clsx(
                                                        'px-2.5 py-1 rounded-full text-xs font-medium',
                                                        getActionColor(log.action)
                                                    )}>
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-sm text-gray-600">
                                                    {formatAuditableType(log.auditable_type)}
                                                    {log.auditable_id ? ` #${log.auditable_id}` : ''}
                                                </td>
                                                <td className="p-4 text-sm text-gray-400 font-mono text-xs">
                                                    {log.ip_address || '-'}
                                                </td>
                                            </tr>
                                            {isExpanded && hasDetails && (
                                                <tr className="bg-gray-50/70">
                                                    <td colSpan={7} className="p-4">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
                                                            {log.old_values && (
                                                                <div>
                                                                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Nilai Lama</p>
                                                                    <pre className="bg-white border border-gray-200 rounded-lg p-3 text-xs text-gray-700 overflow-auto max-h-[200px] font-mono">
                                                                        {JSON.stringify(log.old_values, null, 2)}
                                                                    </pre>
                                                                </div>
                                                            )}
                                                            {log.new_values && (
                                                                <div>
                                                                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Nilai Baru</p>
                                                                    <pre className="bg-white border border-gray-200 rounded-lg p-3 text-xs text-gray-700 overflow-auto max-h-[200px] font-mono">
                                                                        {JSON.stringify(log.new_values, null, 2)}
                                                                    </pre>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                        <p className="text-sm text-gray-500">
                            Showing {logs.length > 0 ? (page - 1) * perPage + 1 : 0} to {Math.min(page * perPage, totalItems)} of {totalItems} entries
                        </p>
                        {totalPages > 1 && (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => handlePageChange(page - 1)}
                                    disabled={page <= 1}
                                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30 transition-colors"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1)
                                    .filter(p => Math.abs(p - page) <= 2 || p === 1 || p === totalPages)
                                    .map((p, idx, arr) => (
                                        <React.Fragment key={p}>
                                            {idx > 0 && arr[idx - 1] !== p - 1 && (
                                                <span className="px-2 text-gray-300">...</span>
                                            )}
                                            <button
                                                onClick={() => handlePageChange(p)}
                                                className={clsx(
                                                    'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                                                    p === page
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'border border-gray-200 hover:bg-gray-50 text-gray-600'
                                                )}
                                            >
                                                {p}
                                            </button>
                                        </React.Fragment>
                                    ))}
                                <button
                                    onClick={() => handlePageChange(page + 1)}
                                    disabled={page >= totalPages}
                                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30 transition-colors"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};
