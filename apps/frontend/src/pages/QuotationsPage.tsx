import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Plus, Search, Eye, Pencil, Trash2, ArrowRightLeft,
  Calendar, User, DollarSign, Download, ArrowUpRight, CheckCircle2, XCircle
} from 'lucide-react';
import api from '../lib/api';
import { formatRupiah, formatDate } from '../lib/utils';
import { GenerateDocumentModal } from '../components/GenerateDocumentModal';

interface Quotation {
  id: string;
  number: string;
  clientId: string;
  clientName: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'superseded';
  issuedDate: string | null;
  validUntil: string | null;
  total: string;
  createdAt: string;
  revisionOf: string | null;
  revisionLabel: string | null;
}

interface QuotationItem {
  id: string;
  name: string;
  qty: string;
  unitPrice: string;
  subtotal: string;
  refType: string;
}

interface RevisionHistory {
  id: string;
  number: string;
  status: string;
  revisionLabel: string | null;
  total: string;
  createdAt: string;
}

interface QuotationDetail extends Quotation {
  subtotal: string;
  discount: string;
  taxRate: string | null;
  tax: string;
  notes: string | null;
  updatedAt: string;
  items: QuotationItem[];
  revisions: RevisionHistory[];
}

export function QuotationsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selectedQuoId, setSelectedQuoId] = useState<string | null>(null);
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);

  const { data: quotations = [], isLoading } = useQuery<Quotation[]>({
    queryKey: ['quotations', search, status],
    queryFn: () =>
      api.get('/quotations', { params: { search, status } }).then((r) => r.data),
  });

  const { data: detail, isLoading: isLoadingDetail } = useQuery<QuotationDetail>({
    queryKey: ['quotation-detail', selectedQuoId],
    queryFn: () => api.get(`/quotations/${selectedQuoId}`).then((r) => r.data),
    enabled: Boolean(selectedQuoId),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, nextStatus }: { id: string; nextStatus: 'sent' | 'accepted' | 'rejected' }) =>
      api.patch(`/quotations/${id}/status`, { status: nextStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['quotation-detail', selectedQuoId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/quotations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      setSelectedQuoId(null);
    },
  });

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'draft': return <span className="badge-gray">Draft</span>;
      case 'sent': return <span className="badge-blue">Terkirim</span>;
      case 'accepted': return <span className="badge-green">Diterima</span>;
      case 'rejected': return <span className="badge-red">Ditolak</span>;
      case 'superseded': return <span className="badge-yellow">Revisi</span>;
      default: return <span className="badge-gray">{s}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <FileText size={24} className="text-brand-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Daftar Quotation</h1>
            <p className="text-gray-400 text-sm">{quotations.length} penawaran dibuat</p>
          </div>
        </div>
        <button
          id="quo-add-btn"
          onClick={() => navigate('/quotations/new')}
          className="btn-primary"
        >
          <Plus size={16} /> Buat Quotation
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            id="quo-search"
            type="text"
            placeholder="Cari nomor, nama klien..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
        <select
          id="quo-status-filter"
          className="input w-48"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Semua Status</option>
          <option value="draft">Draft</option>
          <option value="sent">Terkirim</option>
          <option value="accepted">Diterima</option>
          <option value="rejected">Ditolak</option>
          <option value="superseded">Revisi</option>
        </select>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* List (2/3 width) */}
        <div className="lg:col-span-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : quotations.length === 0 ? (
            <div className="card card-body text-center py-16">
              <FileText size={40} className="text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">Belum ada quotation. Klik "Buat Quotation" untuk mulai.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nomor</th>
                    <th>Klien</th>
                    <th>Status</th>
                    <th>Tanggal</th>
                    <th className="text-right">Total</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {quotations.map((q) => (
                    <tr
                      key={q.id}
                      className={`cursor-pointer transition-colors ${
                        selectedQuoId === q.id ? 'bg-gray-800/80' : ''
                      }`}
                      onClick={() => setSelectedQuoId(q.id)}
                    >
                      <td className="font-mono font-medium text-white">
                        {q.number}
                        {q.revisionLabel && (
                          <span className="ml-1 text-xs text-yellow-400">({q.revisionLabel})</span>
                        )}
                      </td>
                      <td className="font-medium text-gray-200">{q.clientName}</td>
                      <td>{getStatusBadge(q.status)}</td>
                      <td className="text-gray-400 text-xs">{formatDate(q.issuedDate || q.createdAt)}</td>
                      <td className="text-right font-mono text-green-400">{formatRupiah(q.total)}</td>
                      <td>
                        <button
                          id={`quo-view-${q.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedQuoId(q.id);
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

        {/* Detail Sidebar (1/3 width) */}
        <div className="lg:col-span-1">
          {!selectedQuoId ? (
            <div className="card card-body text-center py-16 text-gray-500 border-dashed border-2 border-gray-800">
              <InfoIcon />
              <p className="text-sm mt-2">Pilih salah satu quotation untuk melihat detail dan melakukan aksi.</p>
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
                  <h3 className="text-lg font-bold text-white font-mono leading-tight">
                    {detail.number}
                    {detail.revisionLabel && (
                      <span className="text-yellow-400 ml-1 text-sm font-semibold">
                        ({detail.revisionLabel})
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">Klien: {detail.clientName}</p>
                </div>
                {getStatusBadge(detail.status)}
              </div>

              {/* Status Actions */}
              {detail.status !== 'superseded' && (
                <div className="bg-gray-800/40 p-3 rounded-lg border border-gray-700/60 space-y-2">
                  <p className="text-xs font-semibold text-gray-400">Aksi Status:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {detail.status === 'draft' && (
                      <button
                        id="quo-status-sent"
                        onClick={() => statusMutation.mutate({ id: detail.id, nextStatus: 'sent' })}
                        className="btn-primary text-xs py-1.5 justify-center col-span-2"
                      >
                        <ArrowUpRight size={13} /> Kirim Ke Klien
                      </button>
                    )}
                    {detail.status === 'sent' && (
                      <>
                        <button
                          id="quo-status-accept"
                          onClick={() => statusMutation.mutate({ id: detail.id, nextStatus: 'accepted' })}
                          className="btn-primary bg-green-700 hover:bg-green-600 text-xs py-1.5 justify-center"
                        >
                          <CheckCircle2 size={13} /> Terima
                        </button>
                        <button
                          id="quo-status-reject"
                          onClick={() => statusMutation.mutate({ id: detail.id, nextStatus: 'rejected' })}
                          className="btn-secondary hover:bg-red-950/20 text-red-400 border-red-900/40 text-xs py-1.5 justify-center"
                        >
                          <XCircle size={13} /> Tolak
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Main Actions */}
              <div className="grid grid-cols-2 gap-2">
                <a
                  id="quo-pdf-btn"
                  href={`/api/quotations/${detail.id}/pdf`}
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
                  {(detail.status === 'draft' || detail.status === 'sent') ? (
                    <button
                      id="quo-edit-btn"
                      onClick={() => navigate(`/quotations/${detail.id}/edit`)}
                      className="btn-primary text-xs py-2 justify-center"
                    >
                      <Pencil size={13} />
                      {detail.status === 'sent' ? 'Buat Revisi' : 'Edit Draft'}
                    </button>
                  ) : null}
                  {detail.status === 'accepted' && (
                    <button
                      id="quo-create-invoice-btn"
                      onClick={() => navigate(`/invoices/new?quotationId=${detail.id}`)}
                      className="btn-primary text-xs py-2 justify-center flex items-center gap-1.5 col-span-2"
                    >
                      <Plus size={13} /> Buat Invoice
                    </button>
                  )}
                {detail.status === 'draft' && (
                  <button
                    id="quo-delete-btn"
                    onClick={() => {
                      const nameConfirm = prompt(`Ketik "HAPUS" untuk mengonfirmasi penghapusan quotation ${detail.number}:`);
                      if (nameConfirm === 'HAPUS') {
                        deleteMutation.mutate(detail.id);
                      }
                    }}
                    className="btn-secondary hover:bg-red-950/20 text-red-400 border-red-900/40 text-xs py-2 justify-center col-span-2"
                  >
                    <Trash2 size={13} /> Hapus Draft
                  </button>
                )}
              </div>

              {/* Items Summary */}
              <div className="space-y-2 border-t border-gray-800 pt-4">
                <p className="text-xs font-semibold text-gray-400 uppercase">Ringkasan Item</p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {detail.items.map((it) => (
                    <div key={it.id} className="flex justify-between text-xs bg-gray-950/50 p-2 rounded border border-gray-800">
                      <span className="text-gray-200 truncate max-w-44">{it.name}</span>
                      <span className="text-green-400 shrink-0 ml-2 font-mono">
                        {it.qty}× {formatRupiah(it.unitPrice)}
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
                {parseFloat(detail.discount) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Diskon</span>
                    <span className="text-red-400 font-mono">-{formatRupiah(detail.discount)}</span>
                  </div>
                )}
                {parseFloat(detail.tax) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">
                      Pajak {parseFloat(detail.taxRate ?? '0') > 0 ? `(${parseFloat(detail.taxRate ?? '0')}%)` : ''}
                    </span>
                    <span className="text-gray-200 font-mono">{formatRupiah(detail.tax)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold border-t border-gray-700/50 pt-2">
                  <span className="text-white">Total</span>
                  <span className="text-green-400 font-mono">{formatRupiah(detail.total)}</span>
                </div>
              </div>

              {/* Revision History list */}
              {detail.revisions && detail.revisions.length > 1 && (
                <div className="space-y-1.5 border-t border-gray-800 pt-4 text-xs">
                  <p className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-1.5">
                    <ArrowRightLeft size={12} /> Riwayat Revisi
                  </p>
                  <div className="space-y-1">
                    {detail.revisions.map((rev) => (
                      <button
                        key={rev.id}
                        onClick={() => setSelectedQuoId(rev.id)}
                        className={`w-full flex items-center justify-between p-2 rounded text-left ${
                          rev.id === detail.id ? 'bg-gray-800 font-semibold' : 'hover:bg-gray-850'
                        }`}
                      >
                        <span className="text-gray-300 font-mono">
                          {rev.revisionLabel || 'Original'}
                        </span>
                        <div className="text-right">
                          <div className="text-xs text-gray-400">{getStatusBadge(rev.status)}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {detail && (
        <GenerateDocumentModal
          isOpen={isDocumentModalOpen}
          onClose={() => setIsDocumentModalOpen(false)}
          contextType="quotation"
          contextId={detail.id}
        />
      )}
    </div>
  );
}

function InfoIcon() {
  return (
    <svg className="w-8 h-8 text-gray-600 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
