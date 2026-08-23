import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, BarChart2, Briefcase, Wallet, Receipt,
  AlertTriangle, CircleDollarSign, CheckCircle,
} from 'lucide-react';
import api from '../lib/api';
import { formatRupiah } from '../lib/utils';

const CURRENT_YEAR = new Date().getFullYear();

const PROJECT_STATUS_COLORS: Record<string, string> = {
  not_started: '#6b7280',
  in_progress:  '#6366f1',
  review:       '#f59e0b',
  completed:    '#10b981',
  on_hold:      '#f97316',
  cancelled:    '#ef4444',
};
const PROJECT_STATUS_LABELS: Record<string, string> = {
  not_started: 'Belum Mulai',
  in_progress: 'Dikerjakan',
  review:      'Review',
  completed:   'Selesai',
  on_hold:     'On Hold',
  cancelled:   'Batal',
};

function KpiCard({ label, value, sub, icon, accent = 'indigo', warn = false }: {
  label: string; value: string; sub?: string; icon: React.ReactNode;
  accent?: string; warn?: boolean;
}) {
  return (
    <div className={`card p-4 flex flex-col gap-2 border ${warn ? 'border-red-900/40 bg-red-950/10' : 'border-gray-800'}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-${accent}-500/10 text-${accent}-400`}>
          {icon}
        </div>
      </div>
      <p className={`text-2xl font-bold ${warn ? 'text-red-400' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

const tooltipStyle = { backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', color: '#f9fafb' };

export function ReportingPage() {
  const [year, setYear] = useState(CURRENT_YEAR);

  const { data: summary } = useQuery({
    queryKey: ['reports-summary'],
    queryFn: () => api.get('/reports/summary').then(r => r.data),
  });

  const { data: monthlyRevenue } = useQuery({
    queryKey: ['reports-revenue-monthly', year],
    queryFn: () => api.get(`/reports/revenue/monthly?year=${year}`).then(r => r.data),
  });

  const { data: projectReport } = useQuery({
    queryKey: ['reports-projects'],
    queryFn: () => api.get('/reports/projects').then(r => r.data),
  });

  const { data: cashflow } = useQuery({
    queryKey: ['reports-cashflow', year],
    queryFn: () => api.get(`/reports/cashflow?year=${year}`).then(r => r.data),
  });

  // Pie data for project status breakdown
  const pieData = projectReport
    ? Object.entries(projectReport.statusBreakdown as Record<string, number>)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({ name: PROJECT_STATUS_LABELS[k] || k, value: v, fill: PROJECT_STATUS_COLORS[k] || '#6b7280' }))
    : [];

  const monthlyData = monthlyRevenue?.data ?? [];
  const cashflowData = cashflow?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <BarChart2 size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Reporting Dashboard</h1>
            <p className="text-gray-400 text-sm">Laporan keuangan & operasional terpadu</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400">Tahun:</label>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="input py-1.5 text-sm"
          >
            {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard
          label="Pendapatan Bulan Ini"
          value={formatRupiah(summary?.revenueThisMonth ?? 0)}
          icon={<TrendingUp size={18} />}
          accent="emerald"
        />
        <KpiCard
          label="Total Saldo Kas"
          value={formatRupiah(summary?.totalWalletBalance ?? 0)}
          icon={<Wallet size={18} />}
          accent="indigo"
        />
        <KpiCard
          label="Outstanding Tagihan"
          value={formatRupiah(summary?.outstandingAmount ?? 0)}
          sub="Unpaid + Partial"
          icon={<CircleDollarSign size={18} />}
          accent="amber"
        />
        <KpiCard
          label="Pengeluaran Bulan Ini"
          value={formatRupiah(summary?.expensesThisMonth ?? 0)}
          icon={<Receipt size={18} />}
          accent="red"
        />
        <KpiCard
          label="Proyek Aktif"
          value={String(summary?.activeProjects ?? 0)}
          icon={<Briefcase size={18} />}
          accent="sky"
        />
        <KpiCard
          label="Invoice Jatuh Tempo"
          value={String(summary?.overdueCount ?? 0)}
          sub={summary?.overdueCount > 0 ? 'Perlu ditindaklanjuti!' : 'Semua aman'}
          icon={<AlertTriangle size={18} />}
          accent="red"
          warn={(summary?.overdueCount ?? 0) > 0}
        />
      </div>

      {/* ── Revenue & Expenses Chart ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Revenue vs Pengeluaran {year}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="monthLabel" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${(v / 1_000_000).toFixed(0)}jt`} tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: any, name: any) => [formatRupiah(Number(v)), name === 'revenue' ? 'Revenue' : 'Pengeluaran']}
              />
              <Legend formatter={v => v === 'revenue' ? 'Revenue' : 'Pengeluaran'} wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
              <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── Project Status Pie ── */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-1">Status Proyek</h3>
          {projectReport && (
            <p className="text-xs text-gray-500 mb-3">
              Total {projectReport.totalProjects} proyek · {projectReport.taskCompletionPct}% task selesai
            </p>
          )}
          {pieData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-gray-600 text-sm">Belum ada proyek</div>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="60%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                    dataKey="value" paddingAngle={3}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 flex-1">
                {pieData.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.fill }} />
                    <span className="text-xs text-gray-400">{d.name}</span>
                    <span className="text-xs font-bold text-white ml-auto">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Cash Flow Area Chart ── */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Arus Kas {year} (Masuk vs Keluar)</h3>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={cashflowData}>
            <defs>
              <linearGradient id="inGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="outGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis dataKey="monthLabel" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => `${(v / 1_000_000).toFixed(0)}jt`} tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v: any, name: any) => [
                formatRupiah(Number(v)),
                name === 'inflow' ? 'Kas Masuk' : name === 'outflow' ? 'Kas Keluar' : 'Net',
              ]}
            />
            <Legend formatter={v => v === 'inflow' ? 'Kas Masuk' : v === 'outflow' ? 'Kas Keluar' : 'Net'} wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
            <Area type="monotone" dataKey="inflow" stroke="#10b981" fill="url(#inGrad)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="outflow" stroke="#ef4444" fill="url(#outGrad)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="net" stroke="#6366f1" strokeWidth={2} dot={false} strokeDasharray="4 4" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Project KPIs row ── */}
      {projectReport && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-4 border border-gray-800">
            <p className="text-xs text-gray-500 mb-1">Total Proyek</p>
            <p className="text-3xl font-bold text-white">{projectReport.totalProjects}</p>
          </div>
          <div className="card p-4 border border-gray-800">
            <p className="text-xs text-gray-500 mb-1">Task Completion Rate</p>
            <p className="text-3xl font-bold text-white">{projectReport.taskCompletionPct}%</p>
            <p className="text-xs text-gray-500 mt-1">{projectReport.doneTasks} / {projectReport.totalTasks} task selesai</p>
          </div>
          <div className="card p-4 border border-gray-800">
            <p className="text-xs text-gray-500 mb-1">Rata-rata Waktu Selesai</p>
            <p className="text-3xl font-bold text-white">{projectReport.avgCompletionDays}<span className="text-lg text-gray-400 ml-1">hari</span></p>
            <p className="text-xs text-gray-500 mt-1">dari proyek yang sudah completed</p>
          </div>
        </div>
      )}

      {/* ── Cash Flow Balance ── */}
      <div className="card p-4 border border-indigo-900/30 bg-indigo-950/10 flex items-center gap-4">
        <CheckCircle size={32} className="text-indigo-400 shrink-0" />
        <div>
          <p className="text-xs text-gray-400">Total Saldo Seluruh Kas Saat Ini</p>
          <p className="text-2xl font-bold text-white">{formatRupiah(cashflow?.totalBalance ?? 0)}</p>
        </div>
      </div>
    </div>
  );
}
