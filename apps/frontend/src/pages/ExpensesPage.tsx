import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Receipt, Plus, Search, Calendar, Link as LinkIcon, Trash2 } from 'lucide-react';
import api from '../lib/api';
import { formatRupiah, formatDate } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

interface Expense {
  id: string;
  category: string;
  description: string;
  amount: string;
  date: string;
  walletName: string | null;
  receiptUrl: string | null;
  creatorName: string | null;
  createdAt: string;
}

const CATEGORIES = ['Operasional', 'Software/SaaS', 'Marketing', 'Peralatan', 'Lainnya'];

export function ExpensesPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().substring(0, 7));
  const [filterCategory, setFilterCategory] = useState('');

  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: ['expenses'],
    queryFn: () => api.get('/expenses').then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  });

  const filtered = expenses.filter(e => {
    const matchesMonth = e.date.startsWith(filterMonth);
    const matchesCategory = filterCategory ? e.category === filterCategory : true;
    return matchesMonth && matchesCategory;
  });

  const totalExpense = filtered.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400">
            <Receipt size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Pengeluaran</h1>
            <p className="text-gray-400 text-sm">Catat dan pantau pengeluaran operasional</p>
          </div>
        </div>
        <button onClick={() => setIsAddOpen(true)} className="btn-primary">
          <Plus size={16} /> Catat Pengeluaran
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4 md:col-span-1 border-red-900/30 bg-red-950/10">
          <p className="text-sm text-red-400">Total Pengeluaran (Filter)</p>
          <p className="text-2xl font-bold text-white mt-1">{formatRupiah(totalExpense)}</p>
        </div>
        
        <div className="card p-4 md:col-span-3 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Bulan</label>
            <input 
              type="month" 
              value={filterMonth} 
              onChange={e => setFilterMonth(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Kategori</label>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="input">
              <option value="">Semua Kategori</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Kategori & Deskripsi</th>
                <th>Sumber Dana (Kas)</th>
                <th>Nominal</th>
                <th>Bukti</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-4">Memuat data...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-4 text-gray-500">Tidak ada pengeluaran di periode ini</td></tr>
              ) : filtered.map((e) => (
                <tr key={e.id}>
                  <td className="text-gray-300">{formatDate(e.date)}</td>
                  <td>
                    <p className="font-medium text-white">{e.description}</p>
                    <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded mt-1 inline-block">{e.category}</span>
                  </td>
                  <td className="text-gray-400">{e.walletName || '-'}</td>
                  <td className="font-bold text-red-400">-{formatRupiah(Number(e.amount))}</td>
                  <td>
                    {e.receiptUrl ? (
                      <a href={e.receiptUrl} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-sm">
                        <LinkIcon size={12} /> Lihat
                      </a>
                    ) : (
                      <span className="text-gray-600 text-sm">-</span>
                    )}
                  </td>
                  <td className="text-right">
                    {user?.role === 'admin' && (
                      <button
                        onClick={() => { if(confirm('Hapus pencatatan pengeluaran ini?')) deleteMutation.mutate(e.id) }}
                        className="p-1.5 text-gray-500 hover:text-red-400"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isAddOpen && (
        <AddExpenseModal
          onClose={() => setIsAddOpen(false)}
          onSuccess={() => {
            setIsAddOpen(false);
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
          }}
        />
      )}
    </div>
  );
}

function AddExpenseModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ 
    category: CATEGORIES[0], 
    description: '', 
    amount: '', 
    date: new Date().toISOString().substring(0, 10),
    walletId: '',
    receiptUrl: ''
  });
  const [error, setError] = useState('');

  const { data: wallets = [] } = useQuery({
    queryKey: ['wallets-list'],
    queryFn: () => api.get('/payments/wallets').then(r => r.data)
  });

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post('/expenses', { ...data, amount: Number(data.amount) }),
    onSuccess,
    onError: (err: any) => setError(err.response?.data?.error || 'Gagal menyimpan pengeluaran'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between shrink-0">
          <h3 className="font-bold text-white">Catat Pengeluaran Baru</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </div>
        <form
          onSubmit={e => { e.preventDefault(); setError(''); addMutation.mutate(form); }}
          className="p-6 space-y-4 overflow-y-auto"
        >
          {error && <div className="p-3 bg-red-900/30 border border-red-800 rounded text-red-300 text-sm">{error}</div>}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Tanggal</label>
              <input type="date" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Kategori</label>
              <select required value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="input w-full">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Deskripsi / Keperluan</label>
            <input required value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Cth: Beli domain, langganan Zoom..." className="input w-full" />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Nominal (Rp)</label>
            <input type="number" min={1} required value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="input w-full" />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Ambil dari Kas/Dompet</label>
            <select required value={form.walletId} onChange={e => setForm({...form, walletId: e.target.value})} className="input w-full">
              <option value="">-- Pilih Kas/Dompet --</option>
              {wallets.map((w: any) => (
                <option key={w.id} value={w.id}>{w.name} ({formatRupiah(Number(w.balance))})</option>
              ))}
            </select>
            <p className="text-[10px] text-gray-500 mt-1">Saldo dompet akan otomatis berkurang.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">URL Bukti / Struk (Opsional)</label>
            <input type="url" value={form.receiptUrl} onChange={e => setForm({...form, receiptUrl: e.target.value})} placeholder="https://..." className="input w-full" />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
            <button type="button" onClick={onClose} className="btn-secondary">Batal</button>
            <button type="submit" disabled={addMutation.isPending || !form.walletId} className="btn-primary">
              {addMutation.isPending ? 'Menyimpan...' : 'Simpan Pengeluaran'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
