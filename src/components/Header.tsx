import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User as UserIcon } from 'lucide-react';
import { storage } from '../utils/storage';
import type { User } from '../data/mockData';


interface HeaderProps {
    user: User | null;
}

export const Header: React.FC<HeaderProps> = ({ user }) => {
    const navigate = useNavigate();

    const handleLogout = () => {
        storage.logout();
        navigate('/');
    };

    if (!user) return null;

    return (
        <header className="bg-white shadow-sm border-b border-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="bg-indigo-600 p-1.5 rounded-lg">
                        <UserIcon size={20} className="text-white" />
                    </div>
                    <div>
                        <h2 className="font-semibold text-gray-800 leading-tight">{user.name}</h2>
                        <p className="text-xs text-gray-500 font-medium">{user.role === 'INPUTTER' ? 'Penginput Dokumen' : 'Verifikator'}</p>
                    </div>
                </div>

                <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                >
                    <LogOut size={16} />
                    Keluar
                </button>
            </div>
        </header>
    );
};
