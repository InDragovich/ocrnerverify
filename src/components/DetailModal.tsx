import React, { useState, useEffect } from 'react';
import { verifikasiService } from '../services/verifikasiService';
import type { VerifikasiItem } from '../services/verifikasiService';
import { STATUS_VERIFIKASI, HASIL_KESESUAIAN, CATEGORIES, MONTHS } from '../data/constants';
import { LampiranViewer } from './LampiranViewer';
import { formatDurasi } from '../utils/waktu';
import { X, FileText, CheckCircle2, XCircle, Loader2, AlertCircle, Pencil, Clock } from 'lucide-react';
import clsx from 'clsx';

interface DetailModalProps {
    doc: VerifikasiItem;
    onClose: () => void;
    readOnly?: boolean;
}

export const DetailModal: React.FC<DetailModalProps> = ({ doc: initialDoc, onClose, readOnly = false }) => {
    const [doc, setDoc] = useState<VerifikasiItem>(initialDoc);
    const [tab, setTab] = useState<'info' | 'ocr' | 'keputusan'>('info');

    // Keputusan form
    const [keputusan, setKeputusan] = useState<string>(doc.hasil_kesesuaian || 'belum_ditentukan');
    const [catatan, setCatatan] = useState(doc.catatan_verifikator || '');
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState('');

    // Editable entity corrections
    const [koreksiNominal, setKoreksiNominal] = useState<string>('');
    const [editingNominal, setEditingNominal] = useState(false);
    const [koreksiKategori, setKoreksiKategori] = useState<string>('');
    const [editingKategori, setEditingKategori] = useState(false);
    const [koreksiPeriode, setKoreksiPeriode] = useState<string>('');
    const [editingPeriode, setEditingPeriode] = useState(false);

    // Refresh detail data
    useEffect(() => {
        const refreshDetail = async () => {
            try {
                const fresh = await verifikasiService.getDetail(initialDoc.id);
                setDoc(fresh);
                setKeputusan(fresh.hasil_kesesuaian || 'belum_ditentukan');
                setCatatan(fresh.catatan_verifikator || '');
                // Initialize corrections from OCR result
                if (fresh.hasil_entitas?.nominal) {
                    setKoreksiNominal(String(fresh.hasil_entitas.nominal));
                }
                if (fresh.hasil_entitas?.kategori) {
                    setKoreksiKategori(fresh.hasil_entitas.kategori);
                }
                if (fresh.hasil_entitas?.periode) {
                    setKoreksiPeriode(fresh.hasil_entitas.periode);
                }
            } catch {
                // keep initial
                if (initialDoc.hasil_entitas?.nominal) {
                    setKoreksiNominal(String(initialDoc.hasil_entitas.nominal));
                }
                if (initialDoc.hasil_entitas?.kategori) {
                    setKoreksiKategori(initialDoc.hasil_entitas.kategori);
                }
                if (initialDoc.hasil_entitas?.periode) {
                    setKoreksiPeriode(initialDoc.hasil_entitas.periode);
                }
            }
        };
        refreshDetail();
    }, [initialDoc.id]);

    const nerNominal = doc.hasil_entitas?.nominal ? Number(doc.hasil_entitas.nominal) : null;
    const nominalMismatch = nerNominal !== null && doc.nominal_pelaporan !== nerNominal;

    const handleSaveKeputusan = async () => {
        if (keputusan === 'belum_ditentukan') return;
        setSaving(true);
        setSaveMsg('');
        try {
            // Build correction payload for edited fields
            const koreksi: Record<string, string | number | null> = {};
            if (editingNominal && koreksiNominal !== '' && doc.hasil_entitas?.nominal) {
                const correctedVal = Number(koreksiNominal.replace(/[^0-9]/g, ''));
                if (!isNaN(correctedVal) && correctedVal !== Number(doc.hasil_entitas.nominal)) {
                    koreksi.nominal = correctedVal;
                }
            }
            if (koreksiKategori && koreksiKategori !== (doc.hasil_entitas?.kategori || '')) {
                koreksi.kategori = koreksiKategori;
            }
            if (koreksiPeriode && koreksiPeriode !== (doc.hasil_entitas?.periode || '')) {
                koreksi.periode = koreksiPeriode;
            }

            const result = await verifikasiService.setKeputusan(
                doc.id,
                keputusan,
                catatan || null,
                Object.keys(koreksi).length > 0 ? koreksi : undefined,
            );
            setDoc(result.data);
            setKeputusan(result.data.hasil_kesesuaian || keputusan);
            setCatatan(result.data.catatan_verifikator || '');
            if (result.data.hasil_entitas?.nominal) {
                setKoreksiNominal(String(result.data.hasil_entitas.nominal));
            }
            if (result.data.hasil_entitas?.kategori) {
                setKoreksiKategori(result.data.hasil_entitas.kategori);
            }
            if (result.data.hasil_entitas?.periode) {
                setKoreksiPeriode(result.data.hasil_entitas.periode);
            }
            setEditingNominal(false);
            setEditingKategori(false);
            setEditingPeriode(false);
            setSaveMsg('Keputusan berhasil disimpan.');
            setTimeout(() => setSaveMsg(''), 4000);
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { message?: string } } };
            const msg = axiosErr?.response?.data?.message || (err instanceof Error ? err.message : 'Terjadi kesalahan');
            setSaveMsg(`Gagal menyimpan keputusan: ${msg}`);
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="p-5 border-b border-gray-100 flex items-center justify-between shrink-0">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 text-lg">
                        <FileText size={22} className="text-indigo-600" />
                        Detail Verifikasi #{doc.id}
                    </h3>
                    <div className="flex items-center gap-3">
                        {/* Waktu pemrosesan ditempatkan di header agar terlihat begitu modal
                            dibuka, tanpa bergantung pada tab yang sedang aktif. */}
                        {doc.waktu_ocr_ner_ms !== null && (
                            <span
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-sm font-semibold"
                                title={`Waktu ujung ke ujung: ${formatDurasi(doc.waktu_pemrosesan_ms)}`}
                            >
                                <Clock size={15} />
                                {formatDurasi(doc.waktu_ocr_ner_ms)}
                            </span>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <X size={22} className="text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100 shrink-0">
                    {[
                        { key: 'info', label: 'Informasi' },
                        { key: 'ocr', label: 'Hasil OCR/NER' },
                        ...(readOnly ? [] : [{ key: 'keputusan', label: 'Keputusan' }]),
                    ].map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key as typeof tab)}
                            className={clsx(
                                'px-6 py-3 text-sm font-medium transition-colors border-b-2',
                                tab === t.key
                                    ? 'border-indigo-600 text-indigo-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            )}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {/* === Tab: Info === */}
                    {tab === 'info' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <h4 className="font-semibold text-gray-800 mb-2">Data Input</h4>
                                <InfoRow label="Nama Rekening" value={doc.kategori} />
                                <InfoRow label="Tahun" value={String(doc.tahun)} />
                                <InfoRow label="Triwulan" value={String(doc.triwulan)} />
                                <InfoRow label="Periode" value={doc.periode} />
                                <InfoRow label="Nominal Pelaporan" value={`Rp ${doc.nominal_pelaporan.toLocaleString('id-ID')}`} />
                                <InfoRow label="Regional" value={doc.regional} />
                                <InfoRow label="KCU" value={doc.kcu} />
                                <InfoRow label="KPC" value={doc.kpc} />
                                <InfoRow label="Operator" value={doc.operator?.name || '-'} />
                                <InfoRow label="Verifikator" value={doc.verifikator?.name || '-'} />

                                <div className="flex gap-3 pt-2">
                                    <div>
                                        <span className="text-xs text-gray-500">Status</span>
                                        <div className="mt-1">
                                            <span className={clsx('px-2.5 py-1 rounded-full text-xs font-medium border', STATUS_VERIFIKASI[doc.status_verifikasi]?.color)}>
                                                {STATUS_VERIFIKASI[doc.status_verifikasi]?.label}
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-500">Kesesuaian</span>
                                        <div className="mt-1">
                                            <span className={clsx('px-2.5 py-1 rounded-full text-xs font-medium border', HASIL_KESESUAIAN[doc.hasil_kesesuaian]?.color)}>
                                                {HASIL_KESESUAIAN[doc.hasil_kesesuaian]?.label}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Lampiran – viewer inline (PDF, DOCX, XLSX, gambar) */}
                            <div>
                                <h4 className="font-semibold text-gray-800 mb-2">Lampiran</h4>
                                <p className="text-sm text-gray-500 mb-3">{doc.lampiran_nama_asli}</p>
                                <LampiranViewer
                                    verifikasiId={doc.id}
                                    filename={doc.lampiran_nama_asli}
                                    className="min-h-[320px]"
                                />
                            </div>
                        </div>
                    )}

                    {/* === Tab: OCR/NER === */}
                    {tab === 'ocr' && (
                        <div className="space-y-6">
                            {doc.status_verifikasi === 'menunggu' ? (
                                <div className="text-center py-10 text-gray-400">
                                    <AlertCircle size={48} className="mx-auto mb-3" />
                                    <p>Belum diproses. Jalankan verifikasi otomatis untuk melihat hasil OCR/NER.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Waktu Pemrosesan */}
                                    <div>
                                        <h4 className="font-semibold text-gray-800 mb-2">Waktu Pemrosesan</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                                                <p className="text-xs text-gray-500 mb-1">Modul OCR-NER</p>
                                                <p className="text-lg font-semibold text-gray-800">
                                                    {formatDurasi(doc.waktu_ocr_ner_ms)}
                                                </p>
                                            </div>
                                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                                                <p className="text-xs text-gray-500 mb-1">
                                                    Ujung ke ujung (termasuk transfer berkas)
                                                </p>
                                                <p className="text-lg font-semibold text-gray-800">
                                                    {formatDurasi(doc.waktu_pemrosesan_ms)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Extracted Text */}
                                    <div>
                                        <h4 className="font-semibold text-gray-800 mb-2">Teks Hasil Ekstraksi (OCR)</h4>
                                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 max-h-[200px] overflow-auto">
                                            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                                                {doc.hasil_ekstraksi_teks || '(Tidak ada teks terekstrak)'}
                                            </pre>
                                        </div>
                                    </div>

                                    {/* Entities Comparison */}
                                    <div>
                                        <h4 className="font-semibold text-gray-800 mb-2">Perbandingan Entitas (NER)</h4>
                                        {doc.hasil_entitas ? (
                                            <div className="overflow-x-auto">
                                                <table className="w-full border-collapse text-sm">
                                                    <thead>
                                                        <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                                                            <th className="p-3 text-left border-b">Field</th>
                                                            <th className="p-3 text-left border-b">Data Input</th>
                                                            <th className="p-3 text-left border-b">Hasil NER</th>
                                                            <th className="p-3 text-center border-b">Cocok?</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        <CompareRow field="Kategori" input={doc.kategori} ner={doc.hasil_entitas.kategori} />
                                                        <CompareRow field="Periode" input={`${doc.periode} ${doc.tahun}`} ner={doc.hasil_entitas.periode} />
                                                        <CompareRow field="Nominal" input={`Rp ${doc.nominal_pelaporan.toLocaleString('id-ID')}`} ner={doc.hasil_entitas.nominal ? `Rp ${Number(doc.hasil_entitas.nominal).toLocaleString('id-ID')}` : null} isNominal nominalInput={doc.nominal_pelaporan} nominalNer={doc.hasil_entitas.nominal ? Number(doc.hasil_entitas.nominal) : null} />
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <p className="text-gray-400 text-sm">(Tidak ada data entitas)</p>
                                        )}
                                    </div>

                                    {/* Error Message */}
                                    {doc.error_message && (
                                        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                            <p className="text-sm text-red-700 font-medium">Error:</p>
                                            <p className="text-sm text-red-600 mt-1">{doc.error_message}</p>
                                        </div>
                                    )}

                                    {/* Catatan Verifikator */}
                                    {doc.catatan_verifikator && (
                                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                            <p className="text-sm text-blue-700 font-medium">Catatan Verifikator:</p>
                                            <p className="text-sm text-blue-600 mt-1">{doc.catatan_verifikator}</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* === Tab: Keputusan === */}
                    {tab === 'keputusan' && (
                        <div className="max-w-lg mx-auto space-y-6">
                            <div>
                                <h4 className="font-semibold text-gray-800 mb-4">Keputusan Manual</h4>
                                <p className="text-sm text-gray-500 mb-4">
                                    Tetapkan kesesuaian dokumen ini secara manual. Ini akan menimpa hasil verifikasi otomatis jika ada.
                                </p>
                            </div>

                            {/* Nominal Correction Section */}
                            {doc.hasil_entitas && (
                                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                                    <h5 className="text-sm font-semibold text-gray-700">Ringkasan Hasil OCR/NER</h5>
                                    <div className="space-y-2 text-sm">
                                        {/* Kategori */}
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-gray-500">Kategori OCR/NER:</span>
                                            {editingKategori ? (
                                                <div className="flex items-center gap-2">
                                                    <select
                                                        value={koreksiKategori}
                                                        onChange={e => setKoreksiKategori(e.target.value)}
                                                        className="px-2 py-1 text-sm border border-indigo-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                                        autoFocus
                                                    >
                                                        <option value="">-- Pilih --</option>
                                                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                                    </select>
                                                    <button
                                                        onClick={() => {
                                                            setEditingKategori(false);
                                                            if (!koreksiKategori && doc.hasil_entitas?.kategori) {
                                                                setKoreksiKategori(doc.hasil_entitas.kategori);
                                                            }
                                                        }}
                                                        className="text-xs text-gray-500 hover:text-gray-700 underline"
                                                    >Batal</button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <span className={clsx(
                                                        'font-medium',
                                                        doc.hasil_entitas?.kategori && doc.kategori.toLowerCase() === doc.hasil_entitas.kategori.toLowerCase()
                                                            ? 'text-green-600' : 'text-red-600'
                                                    )}>
                                                        {koreksiKategori || doc.hasil_entitas?.kategori || '-'}
                                                    </span>
                                                    <button
                                                        onClick={() => setEditingKategori(true)}
                                                        className="p-1 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors"
                                                        title="Koreksi kategori"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        {/* Periode */}
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-gray-500">Periode OCR/NER:</span>
                                            {editingPeriode ? (
                                                <div className="flex items-center gap-2">
                                                    <select
                                                        value={koreksiPeriode}
                                                        onChange={e => setKoreksiPeriode(e.target.value)}
                                                        className="px-2 py-1 text-sm border border-indigo-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                                        autoFocus
                                                    >
                                                        <option value="">-- Pilih --</option>
                                                        {MONTHS.map(m => <option key={m} value={`${m} ${doc.tahun}`}>{m} {doc.tahun}</option>)}
                                                    </select>
                                                    <button
                                                        onClick={() => {
                                                            setEditingPeriode(false);
                                                            if (!koreksiPeriode && doc.hasil_entitas?.periode) {
                                                                setKoreksiPeriode(doc.hasil_entitas.periode);
                                                            }
                                                        }}
                                                        className="text-xs text-gray-500 hover:text-gray-700 underline"
                                                    >Batal</button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <span className={clsx(
                                                        'font-medium',
                                                        doc.hasil_entitas?.periode && `${doc.periode} ${doc.tahun}`.toLowerCase() === doc.hasil_entitas.periode.toLowerCase()
                                                            ? 'text-green-600' : 'text-red-600'
                                                    )}>
                                                        {koreksiPeriode || doc.hasil_entitas?.periode || '-'}
                                                    </span>
                                                    <button
                                                        onClick={() => setEditingPeriode(true)}
                                                        className="p-1 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors"
                                                        title="Koreksi periode"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        {/* Nominal */}
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-500">Nominal Pelaporan:</span>
                                            <span className="font-medium text-gray-900">Rp {doc.nominal_pelaporan.toLocaleString('id-ID')}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-gray-500">Nominal OCR/NER:</span>
                                            {editingNominal ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-gray-400 text-xs">Rp</span>
                                                    <input
                                                        type="text"
                                                        value={koreksiNominal}
                                                        onChange={e => {
                                                            // Allow only digits
                                                            const val = e.target.value.replace(/[^0-9]/g, '');
                                                            setKoreksiNominal(val);
                                                        }}
                                                        className="w-40 px-2 py-1 text-sm border border-indigo-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-right font-medium"
                                                        autoFocus
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            setEditingNominal(false);
                                                            // Reset to original if empty
                                                            if (koreksiNominal === '' && doc.hasil_entitas?.nominal) {
                                                                setKoreksiNominal(String(doc.hasil_entitas.nominal));
                                                            }
                                                        }}
                                                        className="text-xs text-gray-500 hover:text-gray-700 underline"
                                                    >
                                                        Batal
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <span className={clsx(
                                                        'font-medium',
                                                        nominalMismatch ? 'text-red-600' : 'text-green-600'
                                                    )}>
                                                        {nerNominal !== null
                                                            ? `Rp ${Number(koreksiNominal || nerNominal).toLocaleString('id-ID')}`
                                                            : '-'
                                                        }
                                                    </span>
                                                    {nominalMismatch && (
                                                        <span className="text-xs text-red-500 font-medium">(Tidak cocok)</span>
                                                    )}
                                                    <button
                                                        onClick={() => setEditingNominal(true)}
                                                        className="p-1 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors"
                                                        title="Koreksi nominal OCR"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        {editingNominal && koreksiNominal !== '' && (
                                            <p className="text-xs text-indigo-600 text-right">
                                                Nominal dikoreksi menjadi: Rp {Number(koreksiNominal).toLocaleString('id-ID')}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3">
                                <label className="block text-sm font-semibold text-gray-700">Hasil Kesesuaian</label>
                                <div className="flex gap-4">
                                    <label className={clsx(
                                        'flex-1 p-4 border-2 rounded-xl cursor-pointer transition-all text-center',
                                        keputusan === 'sesuai' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                                    )}>
                                        <input type="radio" name="keputusan" value="sesuai" checked={keputusan === 'sesuai'} onChange={e => setKeputusan(e.target.value)} className="sr-only" />
                                        <CheckCircle2 size={24} className={clsx('mx-auto mb-2', keputusan === 'sesuai' ? 'text-green-600' : 'text-gray-300')} />
                                        <p className={clsx('font-medium text-sm', keputusan === 'sesuai' ? 'text-green-700' : 'text-gray-600')}>Sesuai</p>
                                    </label>
                                    <label className={clsx(
                                        'flex-1 p-4 border-2 rounded-xl cursor-pointer transition-all text-center',
                                        keputusan === 'tidak_sesuai' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                                    )}>
                                        <input type="radio" name="keputusan" value="tidak_sesuai" checked={keputusan === 'tidak_sesuai'} onChange={e => setKeputusan(e.target.value)} className="sr-only" />
                                        <XCircle size={24} className={clsx('mx-auto mb-2', keputusan === 'tidak_sesuai' ? 'text-red-600' : 'text-gray-300')} />
                                        <p className={clsx('font-medium text-sm', keputusan === 'tidak_sesuai' ? 'text-red-700' : 'text-gray-600')}>Tidak Sesuai</p>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Catatan Verifikator</label>
                                <textarea
                                    value={catatan}
                                    onChange={e => setCatatan(e.target.value)}
                                    rows={4}
                                    placeholder="Tulis catatan (opsional)..."
                                    className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                />
                            </div>

                            {saveMsg && (
                                <div className={clsx(
                                    'text-sm px-4 py-2 rounded-xl',
                                    saveMsg.includes('berhasil') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                                )}>
                                    {saveMsg}
                                </div>
                            )}

                            <button
                                onClick={handleSaveKeputusan}
                                disabled={saving || keputusan === 'belum_ditentukan'}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                                {saving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                                {saving ? 'Menyimpan...' : 'Simpan Keputusan'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Helper components
const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
        <span className="text-sm text-gray-500">{label}</span>
        <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
);

const CompareRow: React.FC<{
    field: string;
    input: string;
    ner: string | null | undefined;
    isNominal?: boolean;
    nominalInput?: number;
    nominalNer?: number | null;
}> = ({ field, input, ner, isNominal, nominalInput, nominalNer }) => {
    let match = false;
    if (isNominal && nominalInput !== undefined && nominalNer !== null && nominalNer !== undefined) {
        match = nominalInput === nominalNer;
    } else if (!isNominal && ner) {
        match = input.toLowerCase() === ner.toLowerCase();
    }

    return (
        <tr className="border-b border-gray-50">
            <td className="p-3 font-medium text-gray-700">{field}</td>
            <td className="p-3 text-gray-600">{input}</td>
            <td className="p-3 text-gray-600">{ner || <span className="text-gray-300 italic">N/A</span>}</td>
            <td className="p-3 text-center">
                {ner ? (
                    match ? (
                        <CheckCircle2 size={18} className="text-green-500 mx-auto" />
                    ) : (
                        <XCircle size={18} className="text-red-500 mx-auto" />
                    )
                ) : (
                    <span className="text-gray-300">-</span>
                )}
            </td>
        </tr>
    );
};
