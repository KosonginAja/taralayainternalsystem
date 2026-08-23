import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, Users, FileText, Receipt, Wallet,
  ArrowRight, Clock, AlertTriangle, CheckCircle, TrendingUp,
  BookOpen, UserPlus, Send, Handshake, FileSignature, Banknote, Package
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { formatRupiah, formatDate } from '../lib/utils';

interface DashboardStatsData {
  stats: {
    totalClients: number;
    openQuotations: number;
    unpaidInvoices: number;
    totalWalletBalance: string;
  };
  recentQuotations: Array<{
    id: string;
    number: string;
    clientId: string;
    clientName: string;
    status: string;
    total: string;
    issuedDate: string | null;
    validUntil: string | null;
  }>;
  recentInvoices: Array<{
    id: string;
    number: string;
    clientId: string;
    clientName: string;
    status: string;
    total: string;
    dueDate: string | null;
    paymentType: string;
  }>;
}

export function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardStatsData>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats').then((r) => r.data),
  });

  const stats = [
    {
      label: 'Total Klien Aktif',
      value: data?.stats ? String(data.stats.totalClients) : '—',
      icon: Users,
      to: '/clients',
      color: 'text-blue-400',
      bg: 'bg-blue-950/60 border-blue-800/50',
    },
    {
      label: 'Quotation Aktif',
      value: data?.stats ? String(data.stats.openQuotations) : '—',
      icon: FileText,
      to: '/quotations',
      color: 'text-amber-400',
      bg: 'bg-amber-950/60 border-amber-800/50',
    },
    {
      label: 'Invoice Belum Lunas',
      value: data?.stats ? String(data.stats.unpaidInvoices) : '—',
      icon: Receipt,
      to: '/invoices',
      color: 'text-rose-400',
      bg: 'bg-rose-950/60 border-rose-800/50',
    },
    {
      label: 'Saldo Kas Dompet',
      value: data?.stats ? formatRupiah(data.stats.totalWalletBalance) : '—',
      icon: Wallet,
      to: '/wallets',
      color: 'text-emerald-400',
      bg: 'bg-emerald-950/60 border-emerald-800/50',
    },
  ];

  const getQuotationBadge = (s: string) => {
    switch (s) {
      case 'draft': return <span className="badge-gray">Draft</span>;
      case 'sent': return <span className="badge-blue">Terkirim</span>;
      case 'accepted': return <span className="badge-green">Disetujui</span>;
      default: return <span className="badge-gray">{s}</span>;
    }
  };

  const getInvoiceBadge = (s: string) => {
    switch (s) {
      case 'unpaid': return <span className="badge-red">Belum Bayar</span>;
      case 'partial': return <span className="badge-yellow">Cicilan Paruh</span>;
      case 'overdue': return <span className="badge-red bg-red-950/80">Terlambat</span>;
      default: return <span className="badge-gray">{s}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LayoutDashboard size={24} className="text-brand-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Ringkasan Operasional</h1>
            <p className="text-gray-400 text-sm">Selamat datang di Taralaya Business OS V1</p>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            to={stat.to}
            className="card p-5 hover:border-gray-700 transition-all hover:-translate-y-0.5 group"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-bold text-white mt-1.5 font-mono">
                  {isLoading ? <span className="inline-block w-12 h-6 bg-gray-800 animate-pulse rounded" /> : stat.value}
                </p>
              </div>
              <div className={`p-2.5 rounded-xl border ${stat.bg}`}>
                <stat.icon size={20} className={stat.color} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity">
              <span>Lihat Detail</span>
              <ArrowRight size={12} />
            </div>
          </Link>
        ))}
      </div>

      {/* Main Grid: Open Quotations & Unpaid Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Open Quotations */}
        <div className="card space-y-4">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-amber-400" />
              <h2 className="text-base font-semibold text-white">Quotation Aktif</h2>
            </div>
            <Link to="/quotations" className="text-xs text-brand-400 hover:underline flex items-center gap-1">
              Semua Quotation <ArrowRight size={12} />
            </Link>
          </div>

          <div className="card-body p-0">
            {isLoading ? (
              <div className="flex justify-center py-10">
                <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !data?.recentQuotations || data.recentQuotations.length === 0 ? (
              <div className="text-center py-10 text-gray-500 text-sm">
                Tidak ada quotation aktif saat ini.
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {data.recentQuotations.map((q) => (
                  <div key={q.id} className="p-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white text-sm">{q.number}</span>
                        {getQuotationBadge(q.status)}
                      </div>
                      <p className="text-xs text-gray-400">{q.clientName}</p>
                      {q.validUntil && (
                        <p className="text-[11px] text-gray-500 flex items-center gap-1">
                          <Clock size={11} /> Berlaku hingga: {formatDate(q.validUntil)}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-semibold text-green-400 text-sm">{formatRupiah(q.total)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Unpaid / Overdue Invoices */}
        <div className="card space-y-4">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt size={18} className="text-rose-400" />
              <h2 className="text-base font-semibold text-white">Tagihan Belum Lunas</h2>
            </div>
            <Link to="/invoices" className="text-xs text-brand-400 hover:underline flex items-center gap-1">
              Semua Invoice <ArrowRight size={12} />
            </Link>
          </div>

          <div className="card-body p-0">
            {isLoading ? (
              <div className="flex justify-center py-10">
                <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !data?.recentInvoices || data.recentInvoices.length === 0 ? (
              <div className="text-center py-10 text-gray-500 text-sm">
                Semua invoice sudah lunas! 🎉
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {data.recentInvoices.map((inv) => (
                  <div key={inv.id} className="p-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white text-sm">{inv.number}</span>
                        {getInvoiceBadge(inv.status)}
                      </div>
                      <p className="text-xs text-gray-400">{inv.clientName}</p>
                      {inv.dueDate && (
                        <p className="text-[11px] text-gray-500 flex items-center gap-1">
                          <AlertTriangle size={11} className="text-amber-400" /> Jatuh tempo: {formatDate(inv.dueDate)}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-semibold text-green-400 text-sm">{formatRupiah(inv.total)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SOP: Client Intake Workflow */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-violet-400" />
            <h2 className="text-base font-semibold text-white">SOP — Alur Penerimaan Client</h2>
          </div>
          <span className="text-xs text-gray-500 italic">Standar operasi Taralaya Studio</span>
        </div>

        <div className="card-body">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {/* Step 1 */}
            <div className="flex flex-col gap-2 rounded-xl border border-blue-800/40 bg-blue-950/30 p-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-blue-400 bg-blue-900/50 rounded-full w-5 h-5 flex items-center justify-center shrink-0">1</span>
                <UserPlus size={15} className="text-blue-400" />
                <p className="text-sm font-semibold text-white">Pendekatan</p>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Perkenalan pertama dengan calon klien. Pahami kebutuhan, industri, dan ekspektasi mereka lewat meeting atau DM.
              </p>
              <Link to="/clients" className="mt-auto text-[11px] text-blue-400 hover:underline flex items-center gap-1">
                Tambah Klien <ArrowRight size={10} />
              </Link>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col gap-2 rounded-xl border border-violet-800/40 bg-violet-950/30 p-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-violet-400 bg-violet-900/50 rounded-full w-5 h-5 flex items-center justify-center shrink-0">2</span>
                <Send size={15} className="text-violet-400" />
                <p className="text-sm font-semibold text-white">Proposal</p>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Kirimkan <strong className="text-gray-300">Proposal / Company Profile</strong> ke klien. Bisa digenerate via menu Dokumen.
              </p>
              <Link to="/documents" className="mt-auto text-[11px] text-violet-400 hover:underline flex items-center gap-1">
                Buat Dokumen <ArrowRight size={10} />
              </Link>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col gap-2 rounded-xl border border-amber-800/40 bg-amber-950/30 p-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-400 bg-amber-900/50 rounded-full w-5 h-5 flex items-center justify-center shrink-0">3</span>
                <FileText size={15} className="text-amber-400" />
                <p className="text-sm font-semibold text-white">Quotation</p>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Buat <strong className="text-gray-300">Quotation resmi</strong> dengan rincian scope pekerjaan dan harga. Kirimkan ke klien untuk disetujui.
              </p>
              <Link to="/quotations/new" className="mt-auto text-[11px] text-amber-400 hover:underline flex items-center gap-1">
                Buat Quotation <ArrowRight size={10} />
              </Link>
            </div>

            {/* Step 4 */}
            <div className="flex flex-col gap-2 rounded-xl border border-emerald-800/40 bg-emerald-950/30 p-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-400 bg-emerald-900/50 rounded-full w-5 h-5 flex items-center justify-center shrink-0">4</span>
                <FileSignature size={15} className="text-emerald-400" />
                <p className="text-sm font-semibold text-white">Kontrak / SPK</p>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Setelah Quotation <strong className="text-gray-300">Accepted</strong>, generate <strong className="text-gray-300">Kontrak / SPK</strong> menggunakan template. Tandatangani kedua pihak.
              </p>
              <Link to="/documents" className="mt-auto text-[11px] text-emerald-400 hover:underline flex items-center gap-1">
                Generate Kontrak <ArrowRight size={10} />
              </Link>
            </div>

            {/* Step 5 */}
            <div className="flex flex-col gap-2 rounded-xl border border-rose-800/40 bg-rose-950/30 p-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-rose-400 bg-rose-900/50 rounded-full w-5 h-5 flex items-center justify-center shrink-0">5</span>
                <Banknote size={15} className="text-rose-400" />
                <p className="text-sm font-semibold text-white">Invoice & DP</p>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Buat <strong className="text-gray-300">Invoice</strong> termin DP. Rekam pembayaran masuk dan alokasikan ke dompet kas perusahaan.
              </p>
              <Link to="/invoices/new" className="mt-auto text-[11px] text-rose-400 hover:underline flex items-center gap-1">
                Buat Invoice <ArrowRight size={10} />
              </Link>
            </div>

            {/* Step 6 */}
            <div className="flex flex-col gap-2 rounded-xl border border-teal-800/40 bg-teal-950/30 p-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-teal-400 bg-teal-900/50 rounded-full w-5 h-5 flex items-center justify-center shrink-0">6</span>
                <Package size={15} className="text-teal-400" />
                <p className="text-sm font-semibold text-white">Serah Terima</p>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Selesaikan pekerjaan dan generate dokumen <strong className="text-gray-300">BAST</strong>. Tagihkan sisa pelunasan Invoice, lalu arsipkan.
              </p>
              <Link to="/documents" className="mt-auto text-[11px] text-teal-400 hover:underline flex items-center gap-1">
                Generate BAST <ArrowRight size={10} />
              </Link>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
