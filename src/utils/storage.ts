import type { User } from '../data/mockData';


export type DocumentStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface SubsidyDocument {
    id: string;
    userId: string;
    userName: string;
    region: string;
    kcu: string;
    kcp: string;
    category: string;
    year: string;
    quarter: string;
    nominal: number;
    fileName: string; // Storing name/path mock
    fileData?: string; // Base64 Data URL
    submittedAt: string;

    status: DocumentStatus;
}

const DOCS_KEY = 'subsidy_docs';
const SESSION_KEY = 'subsidy_session';

export const storage = {
    getDocuments: (): SubsidyDocument[] => {
        const data = localStorage.getItem(DOCS_KEY);
        return data ? JSON.parse(data) : [];
    },

    saveDocument: (doc: Omit<SubsidyDocument, 'id' | 'submittedAt' | 'status'>) => {
        const docs = storage.getDocuments();
        const newDoc: SubsidyDocument = {
            ...doc,
            id: crypto.randomUUID(),
            submittedAt: new Date().toISOString(),
            status: 'PENDING',
        };
        localStorage.setItem(DOCS_KEY, JSON.stringify([...docs, newDoc]));
        return newDoc;
    },

    updateStatus: (id: string, status: DocumentStatus) => {
        const docs = storage.getDocuments();
        const updated = docs.map((d) => (d.id === id ? { ...d, status } : d));
        localStorage.setItem(DOCS_KEY, JSON.stringify(updated));
    },

    // Session Management
    login: (user: User) => {
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    },

    logout: () => {
        localStorage.removeItem(SESSION_KEY);
    },

    getCurrentUser: (): User | null => {
        const data = localStorage.getItem(SESSION_KEY);
        return data ? JSON.parse(data) : null;
    },
};
