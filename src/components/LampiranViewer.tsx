import React, { useState, useEffect, useRef } from 'react';
import { renderAsync } from 'docx-preview';
import * as XLSX from 'xlsx';
import api from '../services/api';
import { FileText, Loader2, AlertCircle } from 'lucide-react';

interface LampiranViewerProps {
    verifikasiId: number;
    filename: string | null | undefined;
    className?: string;
}

type ViewType = 'pdf' | 'docx' | 'xlsx' | 'image' | 'unknown';

function getViewType(filename: string | null | undefined): ViewType {
    if (!filename) return 'unknown';
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    if (['pdf'].includes(ext)) return 'pdf';
    if (['docx', 'doc'].includes(ext)) return 'docx';
    if (['xlsx', 'xls'].includes(ext)) return 'xlsx';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
    return 'unknown';
}

export const LampiranViewer: React.FC<LampiranViewerProps> = ({
    verifikasiId,
    filename,
    className = '',
}) => {
    const [blob, setBlob] = useState<Blob | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [objectUrl, setObjectUrl] = useState<string | null>(null);
    const [xlsxHtml, setXlsxHtml] = useState<string | null>(null);
    const docxContainerRef = useRef<HTMLDivElement>(null);
    const docxStyleRef = useRef<HTMLDivElement>(null);

    const viewType = getViewType(filename);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError(null);
            setXlsxHtml(null);
            try {
                const { data } = await api.get<Blob>(`/verifikasi/${verifikasiId}/lampiran`, {
                    responseType: 'blob',
                });
                setBlob(data);
            } catch {
                setError('Gagal memuat lampiran.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [verifikasiId]);

    // Object URL untuk PDF / image (revoke on cleanup)
    useEffect(() => {
        if (!blob || (viewType !== 'pdf' && viewType !== 'image')) {
            return;
        }
        const url = URL.createObjectURL(blob);
        setObjectUrl(url);
        return () => {
            URL.revokeObjectURL(url);
            setObjectUrl(null);
        };
    }, [blob, viewType]);

    // Parse XLSX saat blob siap
    useEffect(() => {
        if (viewType !== 'xlsx' || !blob) return;
        let cancelled = false;
        blob.arrayBuffer().then((ab) => {
            if (cancelled) return;
            try {
                const wb = XLSX.read(ab, { type: 'array' });
                const first = wb.SheetNames[0];
                if (!first) return;
                const html = XLSX.utils.sheet_to_html(wb.Sheets[first], {
                    id: 'xlsx-table',
                    editable: false,
                });
                setXlsxHtml(html);
            } catch {
                setError('Gagal merender file Excel.');
            }
        });
        return () => {
            cancelled = true;
        };
    }, [blob, viewType]);

    // Render DOCX into container when blob is ready
    useEffect(() => {
        if (viewType !== 'docx' || !blob || !docxContainerRef.current) return;
        const bodyEl = docxContainerRef.current;
        const styleEl = docxStyleRef.current ?? undefined;
        bodyEl.innerHTML = '';
        renderAsync(blob, bodyEl, styleEl, {
            className: 'docx-viewer',
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
        }).catch(() => setError('Gagal merender dokumen Word.'));
    }, [blob, viewType]);

    if (loading) {
        return (
            <div
                className={`flex flex-col items-center justify-center min-h-[320px] bg-gray-50 rounded-xl border border-gray-200 ${className}`}
            >
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
                <p className="text-sm text-gray-500">Memuat lampiran...</p>
            </div>
        );
    }

    if (error || !blob) {
        return (
            <div
                className={`flex flex-col items-center justify-center min-h-[320px] bg-gray-50 rounded-xl border border-gray-200 ${className}`}
            >
                <AlertCircle className="w-10 h-10 text-amber-500 mb-3" />
                <p className="text-sm text-gray-600">{error ?? 'Lampiran tidak tersedia.'}</p>
            </div>
        );
    }

    if (viewType === 'unknown') {
        return (
            <div
                className={`flex flex-col items-center justify-center min-h-[320px] bg-gray-50 rounded-xl border border-gray-200 ${className}`}
            >
                <FileText className="w-10 h-10 text-gray-400 mb-3" />
                <p className="text-sm text-gray-500">Preview tidak mendukung tipe file ini.</p>
                <a
                    href={api.defaults.baseURL + `/verifikasi/${verifikasiId}/lampiran?token=${encodeURIComponent(localStorage.getItem('auth_token') ?? '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 text-indigo-600 hover:underline text-sm"
                >
                    Buka di tab baru
                </a>
            </div>
        );
    }

    if (viewType === 'image') {
        if (!objectUrl) {
            return (
                <div className={`flex items-center justify-center min-h-[280px] bg-gray-50 rounded-xl border border-gray-200 ${className}`}>
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                </div>
            );
        }
        return (
            <div className={`rounded-xl border border-gray-200 overflow-hidden bg-gray-50 ${className}`}>
                <img
                    src={objectUrl}
                    alt={filename ?? 'Lampiran'}
                    className="max-w-full max-h-[70vh] w-auto h-auto object-contain mx-auto block"
                />
            </div>
        );
    }

    if (viewType === 'pdf') {
        if (!objectUrl) {
            return (
                <div className={`flex items-center justify-center min-h-[280px] bg-gray-50 rounded-xl border border-gray-200 ${className}`}>
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                </div>
            );
        }
        return (
            <div className={`rounded-xl border border-gray-200 overflow-hidden bg-gray-100 ${className}`}>
                <iframe
                    title={filename ?? 'PDF'}
                    src={objectUrl}
                    className="w-full min-h-[500px] h-[70vh] border-0"
                />
            </div>
        );
    }

    if (viewType === 'docx') {
        return (
            <div className={`rounded-xl border border-gray-200 overflow-hidden bg-white ${className}`}>
                <div ref={docxStyleRef} className="docx-styles" />
                <div
                    ref={docxContainerRef}
                    className="docx-body overflow-auto p-6 min-h-[400px] max-h-[70vh] bg-white"
                />
            </div>
        );
    }

    if (viewType === 'xlsx') {
        if (!xlsxHtml) {
            return (
                <div className={`flex items-center justify-center min-h-[320px] bg-gray-50 rounded-xl border border-gray-200 ${className}`}>
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                </div>
            );
        }
        return (
            <div
                className={`rounded-xl border border-gray-200 overflow-auto bg-white p-4 min-h-[400px] max-h-[70vh] ${className}`}
            >
                <div
                    className="xlsx-wrap overflow-x-auto [&_table]:min-w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-300 [&_td]:px-2 [&_td]:py-1 [&_th]:bg-gray-100 [&_th]:border [&_th]:border-gray-300 [&_th]:px-2 [&_th]:py-1"
                    dangerouslySetInnerHTML={{ __html: xlsxHtml }}
                />
            </div>
        );
    }

    return null;
};
