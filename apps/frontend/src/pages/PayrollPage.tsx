import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Plus, CheckCircle, Trash2, Calendar } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { formatRupiah, formatDate } from '../lib/utils';
import { Navigate } from 'react-router-dom';

interface PayrollEntry {
  id: string;
  userId: string;
  userName: string;
  period: string;
  baseSalary: string;
  commissions: string;
  bonuses: string;
  deductions: string;
  netPay: string;
  status: 'draft' | 'paid';
  paidAt: string | null;
}

export function PayrollPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [payModalId, setPayModalId] = useState<string | null>(null);

  const { data: payrolls = [], isLoading } = useQuery<PayrollEntry[]>({
    queryKey: ['payroll', period],
    queryFn: () => api.get(`/payroll?period=${period}`).then(r => r.data),
    enabled: user?.role === 'admin'
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/payroll/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payroll', period] }),
  });

  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  const totalNet = payrolls.reduce((sum, p) => sum + Number(p.netPay), 0);
  const totalPaid = payrolls.filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.netPay), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <CreditCard size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Payroll</h1>
            <p className="text-gray-400 text-sm">Manajemen gaji dan komisi tim</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input 
            type="month" 
            value={period} 
            onChange={e => setPeriod(e.target.value)}
            className="input w-40"
          />
          <button onClick={() => setIsAddOpen(true)} className="btn-primary">
            <Plus size={16} /> Buat Entri
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-sm text-gray-400">Total Gaji (Bulan Ini)</p>
          <p className="text-2xl font-bold text-white mt-1">{formatRupiah(totalNet)}</p>
        </div>
        <div className="card p-4 border-emerald-900/50 bg-emerald-950/10">
          <p className="text-sm text-emerald-400">Sudah Dibayar</p>
          <p className="text-2xl font-bold text-white mt-1">{formatRupiah(totalPaid)}</p>
        </div>
        <div className="card p-4 border-amber-900/50 bg-amber-950/10">
          <p className="text-sm text-amber-400">Belum Dibayar (Draft)</p>
          <p className="text-2xl font-bold text-white mt-1">{formatRupiah(totalNet - totalPaid)}</p>
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Gaji Pokok</th>
                <th>Komisi & Bonus</th>
                <th>Potongan</th>
                <th>Gaji Bersih (Take Home)</th>
                <th>Status</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-4">Memuat data...</td></tr>
              ) : payrolls.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-4 text-gray-500">Belum ada data payroll di bulan ini</td></tr>
              ) : payrolls.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium text-white">{p.userName}</td>
                  <td className="text-gray-400">{formatRupiah(Number(p.baseSalary))}</td>
                  <td className="text-emerald-400">+{formatRupiah(Number(p.commissions) + Number(p.bonuses))}</td>
                  <td className="text-red-400">-{formatRupiah(Number(p.deductions))}</td>
                  <td className="font-bold text-white">{formatRupiah(Number(p.netPay))}</td>
                  <td>
                    {p.status === 'paid' ? (
                      <span className="badge-green"><CheckCircle size={12} /> Lunas</span>
                    ) : (
                      <span className="badge-yellow">Draft</span>
                    )}
                  </td>
                  <td className="text-right">
                    {p.status === 'draft' ? (
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setPayModalId(p.id)} className="btn-primary py-1 px-2 text-xs">
                          Bayar
                        </button>
                        <button
                          onClick={() => { if(confirm('Hapus entri ini?')) deleteMutation.mutate(p.id) }}
                          className="p-1.5 text-gray-500 hover:text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500 flex items-center justify-end gap-1">
                        <Calendar size={10} /> {p.paidAt ? formatDate(p.paidAt) : ''}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isAddOpen && (
        <AddPayrollModal
          period={period}
          onClose={() => setIsAddOpen(false)}
          onSuccess={() => {
            setIsAddOpen(false);
            queryClient.invalidateQueries({ queryKey: ['payroll', period] });
          }}
        />
      )}

      {payModalId && (
        <PayPayrollModal
          payrollId={payModalId}
          onClose={() => setPayModalId(null)}
          onSuccess={() => {
            setPayModalId(null);
            queryClient.invalidateQueries({ queryKey: ['payroll', period] });
          }}
        />
      )}
    </div>
  );
}

function AddPayrollModal({ period, onClose, onSuccess }: { period: string, onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ userId: '', baseSalary: 0, commissions: 0, bonuses: 0, deductions: 0 });
  const [error, setError] = useState('');

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data)
  });

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post('/payroll', { ...data, period }),
    onSuccess,
    onError: (err: any) => setError(err.response?.data?.error || 'Gagal membuat entri payroll'),
  });

  const net = form.baseSalary + form.commissions + form.bonuses - form.deductions;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="font-bold text-white">Buat Entri Payroll ({period})</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </div>
        <form
          onSubmit={e => { e.preventDefault(); setError(''); addMutation.mutate(form); }}
          className="p-6 space-y-4"
        >
          {error && <div className="p-3 bg-red-900/30 border border-red-800 rounded text-red-300 text-sm">{error}</div>}
          
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Anggota Tim</label>
            <select required value={form.userId} onChange={e => setForm({...form, userId: e.target.value})} className="input w-full">
              <option value="">-- Pilih --</option>
              {users.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Gaji Pokok</label>
              <input type="number" min={0} required value={form.baseSalary || ''} onChange={e => setForm({...form, baseSalary: Number(e.target.value)})} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Potongan</label>
              <input type="number" min={0} required value={form.deductions || ''} onChange={e => setForm({...form, deductions: Number(e.target.value)})} className="input w-full" />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Komisi</label>
              <input type="number" min={0} required value={form.commissions || ''} onChange={e => setForm({...form, commissions: Number(e.target.value)})} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Bonus</label>
              <input type="number" min={0} required value={form.bonuses || ''} onChange={e => setForm({...form, bonuses: Number(e.target.value)})} className="input w-full" />
            </div>
          </div>

          <div className="p-3 bg-gray-800 rounded flex justify-between items-center">
            <span className="text-sm text-gray-300">Gaji Bersih (Take Home Pay)</span>
            <span className="text-lg font-bold text-emerald-400">{formatRupiah(net)}</span>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
            <button type="button" onClick={onClose} className="btn-secondary">Batal</button>
            <button type="submit" disabled={addMutation.isPending || !form.userId} className="btn-primary">
              Simpan Draft
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PayPayrollModal({ payrollId, onClose, onSuccess }: { payrollId: string, onClose: () => void; onSuccess: () => void }) {
  const [walletId, setWalletId] = useState('');
  const [error, setError] = useState('');

  const { data: wallets = [] } = useQuery({
    queryKey: ['wallets-list'],
    queryFn: () => api.get('/payments/wallets').then(r => r.data)
  });

  const payMutation = useMutation({
    mutationFn: () => api.post(`/payroll/${payrollId}/pay`, { walletId }),
    onSuccess,
    onError: (err: any) => setError(err.response?.data?.error || 'Gagal memproses pembayaran'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-sm">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="font-bold text-white">Bayar Payroll</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </div>
        <form
          onSubmit={e => { e.preventDefault(); setError(''); payMutation.mutate(); }}
          className="p-6 space-y-4"
        >
          {error && <div className="p-3 bg-red-900/30 border border-red-800 rounded text-red-300 text-sm">{error}</div>}
          
          <p className="text-sm text-gray-400">Pilih dompet/kas untuk memotong saldo pembayaran gaji ini.</p>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Sumber Dana</label>
            <select required value={walletId} onChange={e => setWalletId(e.target.value)} className="input w-full">
              <option value="">-- Pilih Kas/Dompet --</option>
              {wallets.map((w: any) => (
                <option key={w.id} value={w.id}>{w.name} ({formatRupiah(Number(w.balance))})</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary">Batal</button>
            <button type="submit" disabled={payMutation.isPending || !walletId} className="btn-primary">
              Proses Pembayaran
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
