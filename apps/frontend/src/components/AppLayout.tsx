import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText, Receipt, Wallet,
  Settings, Tag, Package, LogOut, Menu, X, Briefcase,
  UsersRound, CreditCard, Megaphone, BarChart2
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

const nav = [
  { label: 'Dashboard',      to: '/',             icon: LayoutDashboard, adminOnly: false },
  { label: 'Leads',          to: '/leads',         icon: Megaphone, adminOnly: false },
  { label: 'Klien',          to: '/clients',       icon: Users, adminOnly: false },
  { label: 'Pricelist',      to: '/pricelist',     icon: Tag, adminOnly: false },
  { label: 'Paket',          to: '/packages',      icon: Package, adminOnly: false },
  { label: 'Quotation',      to: '/quotations',    icon: FileText, adminOnly: false },
  { label: 'Invoice',        to: '/invoices',      icon: Receipt, adminOnly: false },
  { label: 'Dompet',         to: '/wallets',       icon: Wallet, adminOnly: true },
  { label: 'Project',        to: '/projects',      icon: Briefcase, adminOnly: false },
  { label: 'Dokumen',        to: '/documents',     icon: FileText, adminOnly: false },
  { label: 'Tim',            to: '/users',         icon: UsersRound, adminOnly: true },
  { label: 'Payroll',        to: '/payroll',       icon: CreditCard, adminOnly: true },
  { label: 'Pengeluaran',    to: '/expenses',      icon: Receipt, adminOnly: true },
  { label: 'Laporan',        to: '/reports',       icon: BarChart2, adminOnly: true },
  { label: 'Pengaturan',     to: '/settings',      icon: Settings, adminOnly: true },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const visibleNav = nav.filter(item => !item.adminOnly || user?.role === 'admin');

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed top-0 left-0 h-full z-30 flex flex-col bg-gray-900 border-r border-gray-800 transition-transform duration-300',
        'w-[260px]',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Logo */}
        <div className="px-6 py-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">T</span>
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Taralaya</p>
              <p className="text-gray-500 text-xs">Business OS</p>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {visibleNav.map(({ label, to, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-600/20 text-brand-400'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
              )}
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User + Logout */}
        <div className="px-3 py-4 border-t border-gray-800">
          <div className="px-3 py-2 mb-1">
            <p className="text-sm text-gray-300 font-semibold truncate">{user?.name || 'Admin'}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            <span className="inline-block mt-1 text-[10px] uppercase font-bold text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded">
              {user?.role}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-red-900/20 hover:text-red-400 transition-colors w-full text-left"
            id="logout-btn"
          >
            <LogOut size={16} />
            Keluar
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:ml-[260px] flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-900">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400"
          >
            <Menu size={20} />
          </button>
          <span className="text-white font-semibold text-sm">Taralaya Business OS</span>
        </header>

        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}


