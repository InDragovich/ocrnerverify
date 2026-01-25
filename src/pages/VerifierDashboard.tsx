import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { storage } from '../utils/storage';
import type { SubsidyDocument, DocumentStatus } from '../utils/storage';
import type { User } from '../data/mockData';
import { Header } from '../components/Header';
import { CheckCircle, XCircle, FileText, Filter, Eye, Wand2, X } from 'lucide-react';

import clsx from 'clsx';


export const VerifierDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);
    const [documents, setDocuments] = useState<SubsidyDocument[]>([]);
    const [filter, setFilter] = useState<DocumentStatus | 'ALL'>('ALL');
    const [previewDoc, setPreviewDoc] = useState<SubsidyDocument | null>(null);
    const [processingId, setProcessingId] = useState<string | null>(null);


    useEffect(() => {
        const currentUser = storage.getCurrentUser();
        if (!currentUser || currentUser.role !== 'VERIFICATOR') {
            navigate('/');
            return;
        }
        setUser(currentUser);
        loadDocuments();
    }, [navigate]);

    const loadDocuments = () => {
        setDocuments(storage.getDocuments().reverse()); // Newest first
    };

    const handleUpdateStatus = (id: string, status: DocumentStatus) => {
        storage.updateStatus(id, status);
        loadDocuments();
    };

    const handleAutoVerify = (doc: SubsidyDocument) => {
        setProcessingId(doc.id);

        // Simulate API Call delay
        setTimeout(() => {
            // Simulate 70% success rate for OCR/NER
            const isValid = Math.random() > 0.3;

            if (isValid) {
                storage.updateStatus(doc.id, 'VERIFIED');
                loadDocuments();
                alert(`Dokumen ${doc.category} valid! Otomatis terverifikasi.`);
            } else {
                alert(`Dokumen ${doc.category} TIDAK valid berdasarkan hasil scan. Silakan verifikasi manual.`);
            }
            setProcessingId(null);
        }, 1500);
    };


    const filteredDocs = filter === 'ALL'
        ? documents
        : documents.filter(d => d.status === filter);

    if (!user) return null;

    return (
        <div className="min-h-screen bg-gray-50">
            <Header user={user} />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Dashboard Verifikasi</h1>
                        <p className="text-gray-500">Kelola dan verifikasi dokumen subsidi yang masuk.</p>
                    </div>

                    <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-gray-100">
                        <Filter size={18} className="text-gray-400 ml-2" />
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value as any)}
                            className="bg-transparent border-none outline-none text-sm font-medium text-gray-700 cursor-pointer"
                        >
                            <option value="ALL">Semua Status</option>
                            <option value="PENDING">Menunggu Verifikasi</option>
                            <option value="VERIFIED">Terverifikasi</option>
                            <option value="REJECTED">Ditolak</option>
                        </select>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                                    <th className="p-4">Dokumen</th>
                                    <th className="p-4">Penginput & Wilayah</th>
                                    <th className="p-4">Periode</th>
                                    <th className="p-4">Nominal</th>
                                    <th className="p-4">Tanggal Submit</th>
                                    <th className="p-4 text-center">Status</th>
                                    <th className="p-4 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredDocs.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-gray-500">
                                            Belum ada dokumen yang sesuai filter.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredDocs.map((doc) => (
                                        <tr key={doc.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600">
                                                        <FileText size={20} />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-900">{doc.category}</p>
                                                        <p className="text-xs text-gray-500">{doc.fileName}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <p className="font-medium text-gray-900">{doc.userName}</p>
                                                <p className="text-xs text-gray-500">{doc.region} • {doc.kcu}</p>
                                            </td>
                                            <td className="p-4">
                                                <span className="text-sm text-gray-700">Tahun {doc.year}</span>
                                                <div className="text-xs text-gray-500">Triwulan {doc.quarter}</div>
                                            </td>
                                            <td className="p-4 font-medium text-gray-900">
                                                Rp {doc.nominal.toLocaleString('id-ID')}
                                            </td>
                                            <td className="p-4 text-sm text-gray-500">
                                                {new Date(doc.submittedAt).toLocaleDateString('id-ID')}
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className={clsx(
                                                    "px-2.5 py-1 rounded-full text-xs font-medium border",
                                                    doc.status === 'PENDING' && "bg-yellow-50 text-yellow-700 border-yellow-200",
                                                    doc.status === 'VERIFIED' && "bg-green-50 text-green-700 border-green-200",
                                                    doc.status === 'REJECTED' && "bg-red-50 text-red-700 border-red-200"
                                                )}>
                                                    {doc.status === 'PENDING' ? 'Menunggu' : doc.status === 'VERIFIED' ? 'Verified' : 'Ditolak'}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => setPreviewDoc(doc)}
                                                        className="p-1.5 hover:bg-gray-100 text-gray-600 rounded-lg transition-colors"
                                                        title="Lihat Dokumen"
                                                    >
                                                        <Eye size={20} />
                                                    </button>
                                                    {doc.status === 'PENDING' && (
                                                        <>
                                                            <button
                                                                onClick={() => handleAutoVerify(doc)}
                                                                disabled={processingId === doc.id}
                                                                className={clsx(
                                                                    "p-1.5 rounded-lg transition-colors",
                                                                    processingId === doc.id ? "bg-indigo-50 text-indigo-400 animate-pulse" : "hover:bg-indigo-100 text-indigo-600"
                                                                )}
                                                                title="Verifikasi Otomatis (OCR/NER)"
                                                            >
                                                                <Wand2 size={20} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleUpdateStatus(doc.id, 'VERIFIED')}
                                                                className="p-1.5 hover:bg-green-100 text-green-600 rounded-lg transition-colors"
                                                                title="Verifikasi"
                                                            >
                                                                <CheckCircle size={20} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleUpdateStatus(doc.id, 'REJECTED')}
                                                                className="p-1.5 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                                                                title="Tolak"
                                                            >
                                                                <XCircle size={20} />
                                                            </button>
                                                        </>
                                                    )}
                                                    {doc.status !== 'PENDING' && (
                                                        <span className="text-xs text-gray-400">-</span>
                                                    )}
                                                </div>
                                            </td>

                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Document Preview Modal */}
                {previewDoc && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setPreviewDoc(null)}>
                        <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                    <FileText size={20} className="text-indigo-600" />
                                    Preview: {previewDoc.fileName}
                                </h3>
                                <button onClick={() => setPreviewDoc(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                    <X size={24} className="text-gray-500" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-auto p-4 bg-gray-100 flex items-center justify-center">
                                {previewDoc.fileData ? (
                                    previewDoc.fileData.startsWith('data:image') ? (
                                        <img src={previewDoc.fileData} alt="Preview" className="max-w-full max-h-full rounded-lg shadow-sm" />
                                    ) : (
                                        <div className="text-center p-10">
                                            <FileText size={64} className="mx-auto text-gray-300 mb-4" />
                                            <p className="text-gray-500">Preview file PDF belum didukung langsung.</p>
                                            <a href={previewDoc.fileData} download={previewDoc.fileName} className="text-indigo-600 hover:underline mt-2 inline-block">
                                                Download File
                                            </a>
                                        </div>
                                    )
                                ) : (
                                    <div className="text-center text-gray-400">
                                        <p>File tidak dapat ditampilkan.</p>
                                    </div>
                                )}
                            </div>
                            {previewDoc.status === 'PENDING' && (
                                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                                    <button
                                        onClick={() => { handleAutoVerify(previewDoc); setPreviewDoc(null); }}
                                        className="px-4 py-2 bg-indigo-100 text-indigo-700 font-semibold rounded-lg hover:bg-indigo-200 transition-colors flex items-center gap-2"
                                    >
                                        <Wand2 size={18} /> Auto Verify
                                    </button>
                                    <button
                                        onClick={() => { handleUpdateStatus(previewDoc.id, 'REJECTED'); setPreviewDoc(null); }}
                                        className="px-4 py-2 bg-white border border-red-200 text-red-600 font-semibold rounded-lg hover:bg-red-50 transition-colors"
                                    >
                                        Tolak
                                    </button>
                                    <button
                                        onClick={() => { handleUpdateStatus(previewDoc.id, 'VERIFIED'); setPreviewDoc(null); }}
                                        className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
                                    >
                                        Verifikasi
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};
