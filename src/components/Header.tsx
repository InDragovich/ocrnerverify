import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/authService';
import type { User } from '../services/authService';
import { LogOut, User as UserIcon } from 'lucide-react';
import clsx from 'clsx';

interface HeaderProps {
    user: User | null;
}

const ROLE_LABELS: Record<string, string> = {
    operator: 'Operator',
    verifikator: 'Verifikator',
    super_admin: 'Super Admin',
};

const ROLE_COLORS: Record<string, string> = {
    operator: 'bg-blue-100 text-blue-700',
    verifikator: 'bg-purple-100 text-purple-700',
    super_admin: 'bg-red-100 text-red-700',
};

interface NavLink {
    label: string;
    path: string;
    roles: string[];
}

const NAV_LINKS: NavLink[] = [
    { label: 'Dashboard', path: '/dashboard', roles: ['super_admin', 'verifikator'] },
    { label: 'Verifikasi', path: '/verify', roles: ['super_admin', 'verifikator'] },
    { label: 'Input Data', path: '/input', roles: ['operator'] },
    { label: 'Audit Logs', path: '/audit-logs', roles: ['super_admin'] },
    { label: 'Kelola User', path: '/admin/users', roles: ['super_admin'] },
];

export const Header: React.FC<HeaderProps> = ({ user }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = async () => {
        await authService.logout();
        navigate('/');
    };

    if (!user) return null;

    const visibleLinks = NAV_LINKS.filter(link => link.roles.includes(user.role));

    return (
        <header className="bg-white shadow-sm border-b border-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <h1 className="text-lg font-bold text-gray-800">SIM-LPU</h1>
                        <span className="text-gray-300 hidden sm:inline">|</span>
                        <span className="text-sm text-gray-500 hidden sm:inline">Verifikasi Biaya Rutin</span>
                    </div>

                    {/* Navigation Links */}
                    <nav className="hidden md:flex items-center gap-1">
                        {visibleLinks.map(link => (
                            <button
                                key={link.path}
                                onClick={() => navigate(link.path)}
                                className={clsx(
                                    'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                                    location.pathname === link.path
                                        ? 'bg-indigo-50 text-indigo-700'
                                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                )}
                            >
                                {link.label}
                            </button>
                        ))}
                    </nav>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="bg-indigo-100 p-1.5 rounded-full text-indigo-600">
                            <UserIcon size={16} />
                        </div>
                        <span className="text-sm font-medium text-gray-700 hidden sm:inline">{user.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user.role] || 'bg-gray-100 text-gray-600'}`}>
                            {ROLE_LABELS[user.role] || user.role}
                        </span>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
                    >
                        <LogOut size={16} />
                        <span className="hidden sm:inline">Keluar</span>
                    </button>
                </div>
            </div>

            {/* Mobile Navigation */}
            {visibleLinks.length > 0 && (
                <div className="md:hidden border-t border-gray-100 px-4 py-2 flex gap-1 overflow-x-auto">
                    {visibleLinks.map(link => (
                        <button
                            key={link.path}
                            onClick={() => navigate(link.path)}
                            className={clsx(
                                'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap',
                                location.pathname === link.path
                                    ? 'bg-indigo-50 text-indigo-700'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            )}
                        >
                            {link.label}
                        </button>
                    ))}
                </div>
            )}
        </header>
    );
};
