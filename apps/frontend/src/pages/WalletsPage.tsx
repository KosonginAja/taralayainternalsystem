import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Wallet, TrendingUp, TrendingDown, History,
  Building2, Users, Search, Filter
} from 'lucide-react';
import api from '../lib/api';
import { formatRupiah, formatDate } from '../lib/utils';

interface WalletData {
  id: string;
  name: string;
  type: 'company' | 'payroll';
  balance: string;
  createdAt: string;
}

interface WalletTransaction {
  id: string;
  walletId: string;
  paymentId: string | null;
  type: 'in' | 'out';
  amount: string;
  balanceAfter: string;
  description: string | null;
  createdAt: string;
  invoiceNumber: string | null;
}

export function WalletsPage() {
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [txSearch, setTxSearch] = useState('');

  const { data: wallets = [], isLoading: isLoadingWallets } = useQuery<WalletData[]>({
    queryKey: ['wallets'],
    queryFn: () => api.get('/payments/wallets').then((r) => r.data),
  });

  const { data: transactions = [], isLoading: isLoadingTx } = useQuery<WalletTransaction[]>({
    queryKey: ['wallet-transactions', selectedWalletId],
    queryFn: () =>
      api.get(`/payments/wallets/${selectedWalletId}/transactions`).then((r) => r.data),
    enabled: Boolean(selectedWalletId),
  });

  const totalBalance = wallets.reduce((sum, w) => sum + parseFloat(w.balance), 0);

  const filteredTx = transactions.filter((tx) => {
    if (!txSearch) return true;
    const q = txSearch.toLowerCase();
    return (
      tx.description?.toLowerCase().includes(q) ||
      tx.invoiceNumber?.toLowerCase().includes(q)
    );
  });

  function getWalletIcon(type: string) {
    return type === 'company'
      ? <Building2 size={20} className="text-brand-400" />
      : <Users size={20} className="text-emerald-400" />;
  }

  function getWalletAccent(type: string) {
    return type === 'company' ? 'brand' : 'emerald';
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <Wallet size={24} className="text-brand-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Dompet Kas</h1>
          <p className="text-gray-400 text-sm">Total saldo seluruh dompet</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Total Balance</p>
          <p className="text-2xl font-bold text-green-400 font-mono">{formatRupiah(totalBalance)}</p>
        </div>
      </div>

      {/* Wallet Cards */}
      {isLoadingWallets ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((n) => (
            <div key={n} className="card card-body animate-pulse bg-gray-800/40 h-32" />
          ))}
        </div>
      ) : wallets.length === 0 ? (
        <div className="card card-body text-center py-12">
          <Wallet size={36} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Belum ada dompet. Tambahkan dompet dari migrasi DB.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {wallets.map((w) => {
            const isSelected = selectedWalletId === w.id;
            const accent = getWalletAccent(w.type);
            return (
              <button
                key={w.id}
                id={`wallet-card-${w.type}`}
                onClick={() => setSelectedWalletId(isSelected ? null : w.id)}
                className={`card card-body text-left transition-all hover:ring-1 ${
                  isSelected
                    ? `ring-2 ring-${accent}-600 bg-${accent}-950/20`
                    : 'hover:ring-gray-600'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl bg-${accent}-900/30 border border-${accent}-800/50`}>
                      {getWalletIcon(w.type)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{w.name}</h3>
                      <p className="text-xs text-gray-400 capitalize">{w.type === 'company' ? 'Kas Perusahaan' : 'Kas Payroll'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400 mb-0.5">Saldo</p>
                    <p className="text-xl font-bold text-green-400 font-mono">
                      {formatRupiah(w.balance)}
                    </p>
                  </div>
                </div>
                <div className={`mt-4 pt-3 border-t border-${accent}-900/30 flex items-center justify-between`}>
                  <span className="text-xs text-gray-500">Klik untuk lihat riwayat transaksi</span>
                  {isSelected && (
                    <span className={`text-xs font-semibold text-${accent}-400 bg-${accent}-950/50 px-2 py-0.5 rounded-full border border-${accent}-900/50`}>
                      Dipilih
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Transaction Ledger */}
      {selectedWalletId && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <History size={18} className="text-gray-400" />
              <h2 className="text-base font-semibold text-white">
                Riwayat Transaksi — {wallets.find((w) => w.id === selectedWalletId)?.name}
              </h2>
            </div>
            <div className="relative w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                id="tx-search"
                type="text"
                placeholder="Cari keterangan / no invoice..."
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                className="input pl-9 text-sm py-2"
              />
            </div>
          </div>

          {isLoadingTx ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredTx.length === 0 ? (
            <div className="card card-body text-center py-12">
              <History size={36} className="text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">
                {txSearch
                  ? 'Tidak ada transaksi yang cocok dengan pencarian.'
                  : 'Belum ada transaksi pada dompet ini.'}
              </p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Keterangan</th>
                    <th>Invoice</th>
                    <th>Tipe</th>
                    <th className="text-right">Jumlah</th>
                    <th className="text-right">Saldo Akhir</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTx.map((tx) => (
                    <tr key={tx.id}>
                      <td className="text-gray-400 text-xs whitespace-nowrap">
                        {formatDate(tx.createdAt)}
                      </td>
                      <td className="text-gray-200 text-sm max-w-xs">
                        <span className="truncate block" title={tx.description ?? ''}>
                          {tx.description ?? '—'}
                        </span>
                      </td>
                      <td className="font-mono text-brand-400 text-xs">
                        {tx.invoiceNumber ?? '—'}
                      </td>
                      <td>
                        {tx.type === 'in' ? (
                          <span className="flex items-center gap-1 text-green-400 text-xs font-semibold">
                            <TrendingUp size={12} /> Masuk
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-400 text-xs font-semibold">
                            <TrendingDown size={12} /> Keluar
                          </span>
                        )}
                      </td>
                      <td className={`text-right font-mono font-semibold text-sm ${tx.type === 'in' ? 'text-green-400' : 'text-red-400'}`}>
                        {tx.type === 'in' ? '+' : '-'}{formatRupiah(tx.amount)}
                      </td>
                      <td className="text-right font-mono text-gray-300 text-sm">
                        {formatRupiah(tx.balanceAfter)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
