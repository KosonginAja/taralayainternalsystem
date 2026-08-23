import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Receipt, Plus, Search, Eye, Trash2,
  Download, Info, CreditCard, FileText
} from 'lucide-react';
import api from '../lib/api';
import { formatRupiah, formatDate } from '../lib/utils';
import { RecordPaymentModal } from '../components/RecordPaymentModal';
import { GenerateDocumentModal } from '../components/GenerateDocumentModal';

interface Invoice {
  id: string;
  number: string;
  clientId: string;
  clientName: string;
  status: 'unpaid' | 'partial' | 'paid' | 'overdue' | 'cancelled';
  paymentType: 'full' | 'dp' | 'custom';
  issueDate: string | null;
  dueDate: string | null;
  total: string;
  createdAt: string;
}

interface InvoiceItem {
  id: string;
  name: string;
  qty: string;
  unitPrice: string;
  subtotal: string;
}

interface InvoiceInstallment {
  id: string;
  sequence: number;
  label: string;
  percentage: string;
  amount: string;
  dueDate: string | null;
  status: 'pending' | 'paid';
}

interface InvoiceDetail extends Invoice {
  quotationId: string | null;
  quotationNumber: string | null;
  subtotal: string;
  tax: string;
  notes: string | null;
  updatedAt: string;
  items: InvoiceItem[];
  installments: InvoiceInstallment[];
}

export function InvoicesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selectedInvId, setSelectedInvId] = useState<string | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ['invoices', search, status],
    queryFn: () =>
      api.get('/invoices', { params: { search, status } }).then((r) => r.data),
  });

  const { data: detail, isLoading: isLoadingDetail } = useQuery<InvoiceDetail>({
    queryKey: ['invoice-detail', selectedInvId],
    queryFn: () => api.get(`/invoices/${selectedInvId}`).then((r) => r.data),
    enabled: Boolean(selectedInvId),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, nextStatus }: { id: string; nextStatus: string }) =>
      api.patch(`/invoices/${id}/status`, { status: nextStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-detail', selectedInvId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/invoices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setSelectedInvId(null);
    },
  });

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'unpaid': return <span className="badge-red">Belum Bayar</span>;
      case 'partial': return <span className="badge-yellow font-semibold">Cicilan Paruh</span>;
      case 'paid': return <span className="badge-green">Lunas</span>;
      case 'overdue': return <span className="badge-red bg-red-950/70">Terlambat</span>;
      case 'cancelled': return <span className="badge-gray">Dibatalkan</span>;
      default: return <span className="badge-gray">{s}</span>;
    }
  };

  const getPaymentTypeLabel = (pt: string) => {
    switch (pt) {
      case 'full': return 'Penuh (1x)';
      case 'dp': return 'DP + Pelunasan';
      case 'custom': return 'Kustom Termin';
      default: return pt;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Receipt size={24} className="text-brand-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Daftar Invoice</h1>
            <p className="text-gray-400 text-sm">{invoices.length} tagihan terbit</p>
          </div>
        </div>
        <button
          id="inv-add-btn"
          onClick={() => navigate('/invoices/new')}
          className="btn-primary"
        >
          <Plus size={16} /> Buat Invoice
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            id="inv-search"
            type="text"
            placeholder="Cari nomor invoice, nama klien..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
        <select
          id="inv-status-filter"
          className="input w-48"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Semua Status</option>
          <option value="unpaid">Belum Bayar</option>
          <option value="partial">Cicilan Paruh</option>
          <option value="paid">Lunas</option>
          <option value="overdue">Terlambat</option>
          <option value="cancelled">Dibatalkan</option>
        </select>
      </div>

      {/* Grid List + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* List Table */}
        <div className="lg:col-span-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="card card-body text-center py-16">
              <Receipt size={40} className="text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">Belum ada invoice. Klik "Buat Invoice" untuk mulai.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nomor</th>
                    <th>Klien</th>
                    <th>Status</th>
                    <th>Metode</th>
                    <th>Jatuh Tempo</th>
                    <th className="text-right">Total</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className={`cursor-pointer transition-colors ${
                        selectedInvId === inv.id ? 'bg-gray-800/80' : ''
                      }`}
                      onClick={() => setSelectedInvId(inv.id)}
                    >
                      <td className="font-mono font-medium text-white">{inv.number}</td>
                      <td className="font-medium text-gray-200">{inv.clientName}</td>
                      <td>{getStatusBadge(inv.status)}</td>
                      <td className="text-gray-300 text-sm">{getPaymentTypeLabel(inv.paymentType)}</td>
                      <td className="text-gray-400 text-xs">{formatDate(inv.dueDate || inv.createdAt)}</td>
                      <td className="text-right font-mono text-green-400">{formatRupiah(inv.total)}</td>
                      <td>
                        <button
                          id={`inv-view-${inv.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedInvId(inv.id);
                          }}
                          className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white"
                          title="Lihat Detail"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sidebar Detail */}
        <div className="lg:col-span-1">
          {!selectedInvId ? (
            <div className="card card-body text-center py-16 text-gray-500 border-dashed border-2 border-gray-800">
              <Info size={32} className="mx-auto text-gray-650 mb-2" />
              <p className="text-sm">Pilih salah satu invoice untuk melihat detail termin dan melakukan aksi tagihan.</p>
            </div>
          ) : isLoadingDetail || !detail ? (
            <div className="card card-body flex justify-center py-16">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="card space-y-5 card-body">
              {/* Header Info */}
              <div className="flex justify-between items-start border-b border-gray-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white font-mono leading-tight">{detail.number}</h3>
                  <p className="text-xs text-gray-400 mt-1">Klien: {detail.clientName}</p>
                  {detail.quotationNumber && (
                    <p className="text-[10px] text-brand-400 mt-0.5">Quotation: {detail.quotationNumber}</p>
                  )}
                </div>
                {getStatusBadge(detail.status)}
              </div>

              {/* Status Actions */}
              <div className="bg-gray-800/40 p-3 rounded-lg border border-gray-700/60 space-y-2">
                <p className="text-xs font-semibold text-gray-400">Ubah Status:</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    id="inv-status-paid"
                    onClick={() => statusMutation.mutate({ id: detail.id, nextStatus: 'paid' })}
                    className="btn-primary bg-green-750 hover:bg-green-700 text-xs py-1.5 justify-center"
                  >
                    Set Lunas
                  </button>
                  <button
                    id="inv-status-cancelled"
                    onClick={() => statusMutation.mutate({ id: detail.id, nextStatus: 'cancelled' })}
                    className="btn-secondary hover:bg-red-950/20 text-red-400 border-red-900/40 text-xs py-1.5 justify-center"
                  >
                    Batalkan
                  </button>
                </div>
              </div>

              {/* Main Actions */}
              <div className="grid grid-cols-2 gap-2">
                {/* Record Payment CTA — only show if there are pending installments */}
                {detail.installments.some((i) => i.status === 'pending') && detail.status !== 'cancelled' && (
                  <button
                    id="inv-record-payment-btn"
                    onClick={() => setPaymentModalOpen(true)}
                    className="btn-primary text-xs py-2 justify-center col-span-2"
                  >
                    <CreditCard size={13} /> Rekam Pembayaran
                  </button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <a
                    id="inv-pdf-btn"
                    href={`/api/invoices/${detail.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary text-xs py-2 justify-center flex items-center gap-1.5"
                  >
                    <Download size={13} /> PDF Preview
                  </a>
                  <button
                    onClick={() => setIsDocumentModalOpen(true)}
                    className="btn-secondary text-xs py-2 justify-center flex items-center gap-1.5"
                  >
                    <FileText size={13} /> Dokumen Custom
                  </button>
                </div>
                {(detail.status === 'unpaid' || detail.status === 'cancelled') && (
                  <button
                    id="inv-delete-btn"
                    onClick={() => {
                      if (confirm('Hapus invoice tagihan ini secara permanen?')) {
                        deleteMutation.mutate(detail.id);
                      }
                    }}
                    className="btn-secondary hover:bg-red-950/20 text-red-400 border-red-900/40 text-xs py-2 justify-center col-span-2"
                  >
                    <Trash2 size={13} /> Hapus Invoice
                  </button>
                )}
              </div>

              {/* Installments Breakdown */}
              <div className="space-y-2 border-t border-gray-800 pt-4">
                <p className="text-xs font-semibold text-gray-400 uppercase">Jadwal Termin Pembayaran</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {detail.installments.map((inst) => (
                    <div key={inst.id} className="flex justify-between items-center text-xs bg-gray-950/50 p-2.5 rounded border border-gray-800">
                      <div>
                        <span className="text-gray-200 block font-medium">{inst.label}</span>
                        {inst.dueDate && (
                          <span className="text-[10px] text-gray-500 block">Jatuh Tempo: {formatDate(inst.dueDate)}</span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-green-400 block font-mono font-semibold">{formatRupiah(inst.amount)}</span>
                        {inst.status === 'paid' ? (
                          <span className="text-[9px] font-bold text-green-400 bg-green-950/40 border border-green-900/50 px-1.5 py-0.5 rounded-full inline-block mt-0.5">LUNAS</span>
                        ) : (
                          <span className="text-[9px] font-bold text-amber-500 bg-amber-950/40 border border-amber-900/50 px-1.5 py-0.5 rounded-full inline-block mt-0.5">PENDING</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Items Summary */}
              <div className="space-y-2 border-t border-gray-800 pt-4">
                <p className="text-xs font-semibold text-gray-400 uppercase">Item Jasa</p>
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                  {detail.items.map((it) => (
                    <div key={it.id} className="flex justify-between text-xs py-1">
                      <span className="text-gray-300 truncate max-w-44">{it.name}</span>
                      <span className="text-gray-400 shrink-0 font-mono">
                        {parseFloat(it.qty)}× {formatRupiah(it.unitPrice)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financials */}
              <div className="space-y-1.5 border-t border-gray-800 pt-4 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Subtotal</span>
                  <span className="text-gray-200 font-mono">{formatRupiah(detail.subtotal)}</span>
                </div>
                {parseFloat(detail.tax) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">
                      Pajak {(detail as any).taxRate && parseFloat((detail as any).taxRate) > 0 ? `(${parseFloat((detail as any).taxRate)}%)` : ''}
                    </span>
                    <span className="text-gray-200 font-mono">{formatRupiah(detail.tax)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold border-t border-gray-700/50 pt-2">
                  <span className="text-white">Total</span>
                  <span className="text-green-400 font-mono">{formatRupiah(detail.total)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {paymentModalOpen && detail && (
        <RecordPaymentModal
          invoiceId={detail.id}
          invoiceNumber={detail.number}
          installments={detail.installments}
          onClose={() => setPaymentModalOpen(false)}
          onSuccess={() => {
            setPaymentModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['invoice-detail', selectedInvId] });
          }}
        />
      )}
      
      {detail && (
        <GenerateDocumentModal
          isOpen={isDocumentModalOpen}
          onClose={() => setIsDocumentModalOpen(false)}
          contextType="invoice"
          contextId={detail.id}
        />
      )}
    </div>
  );
}
