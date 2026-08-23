import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Receipt, Plus, Trash2, Save, ChevronLeft, AlertCircle,
  User, Calendar, Tag, Package, Pencil, Search, CreditCard
} from 'lucide-react';
import api from '../lib/api';
import { formatRupiah } from '../lib/utils';

interface Client { id: string; name: string; picName: string | null; }
interface PricelistItem { id: string; name: string; description: string | null; unit: string | null; price: string; category: string | null; }
interface PkgItem { id: string; name: string; description: string | null; price: string; }

interface LineItem {
  _key: string;
  refType: 'pricelist_item' | 'package' | 'custom';
  refId: string | null;
  name: string;
  description: string;
  qty: string;
  unitPrice: string;
}

interface InstallmentInput {
  _key: string;
  label: string;
  percentage: string;
  dueDate: string;
}

function makeKey() { return Math.random().toString(36).slice(2); }
function emptyLine(): LineItem {
  return { _key: makeKey(), refType: 'custom', refId: null, name: '', description: '', qty: '1', unitPrice: '0' };
}

export function InvoiceBuilderPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const quotationIdFromUrl = searchParams.get('quotationId');

  const [clientId, setClientId] = useState('');
  const [paymentType, setPaymentType] = useState<'full' | 'dp' | 'custom'>('full');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [taxRate, setTaxRate] = useState('0');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);
  const [installments, setInstallments] = useState<InstallmentInput[]>([
    { _key: makeKey(), label: 'Pelunasan', percentage: '100', dueDate: '' }
  ]);
  const [error, setError] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  // Fetch reference data
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients', '', false],
    queryFn: () => api.get('/clients').then(r => r.data),
  });
  const { data: pricelistItems = [] } = useQuery<PricelistItem[]>({
    queryKey: ['pricelist', '', false],
    queryFn: () => api.get('/pricelist').then(r => r.data),
  });
  const { data: packages = [] } = useQuery<PkgItem[]>({
    queryKey: ['packages', '', false],
    queryFn: () => api.get('/packages').then(r => r.data),
  });

  // Load from accepted quotation if specified in URL
  const { data: sourceQuotation } = useQuery({
    queryKey: ['quotation-detail', quotationIdFromUrl],
    queryFn: () => api.get(`/quotations/${quotationIdFromUrl}`).then(r => r.data),
    enabled: Boolean(quotationIdFromUrl),
  });

  useEffect(() => {
    if (!sourceQuotation) return;
    setClientId(sourceQuotation.clientId ?? '');
    setNotes(sourceQuotation.notes ?? '');
    // Transfer items
    setLines(
      (sourceQuotation.items ?? []).map((item: any) => ({
        _key: makeKey(),
        refType: item.refType,
        refId: item.refId ?? null,
        name: item.name,
        description: item.description ?? '',
        qty: item.qty,
        unitPrice: item.unitPrice,
      }))
    );
    // Auto-calculate tax if present
    setTaxRate(sourceQuotation.taxRate ?? '0');
  }, [sourceQuotation]);

  // Adjust installments automatically when paymentType changes
  useEffect(() => {
    if (paymentType === 'full') {
      setInstallments([
        { _key: makeKey(), label: 'Pelunasan Full (100%)', percentage: '100', dueDate: '' }
      ]);
    } else if (paymentType === 'dp') {
      setInstallments([
        { _key: makeKey(), label: 'Uang Muka (DP)', percentage: '30', dueDate: '' },
        { _key: makeKey(), label: 'Pelunasan', percentage: '70', dueDate: '' }
      ]);
    } else if (paymentType === 'custom') {
      setInstallments([
        { _key: makeKey(), label: 'Termin 1', percentage: '50', dueDate: '' },
        { _key: makeKey(), label: 'Termin 2', percentage: '50', dueDate: '' },
      ]);
    }
  }, [paymentType]);

  // Calculations
  const subtotalRaw = lines.reduce((acc, l) => {
    const qty = parseFloat(l.qty) || 0;
    const up = parseFloat(l.unitPrice) || 0;
    return acc + qty * up;
  }, 0);
  const taxRateNum = parseFloat(taxRate) || 0;
  const taxRaw = subtotalRaw * (taxRateNum / 100);
  const totalRaw = subtotalRaw + taxRaw;

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        quotationId: quotationIdFromUrl || null,
        clientId,
        paymentType,
        issueDate: issueDate || null,
        dueDate: dueDate || null,
        taxRate,
        tax: String(taxRaw.toFixed(2)),
        notes: notes || null,
        items: lines.map(l => ({
          refType: l.refType,
          refId: l.refId || null,
          name: l.name,
          description: l.description || null,
          qty: l.qty,
          unitPrice: l.unitPrice,
        })),
        installments: installments.map(i => ({
          label: i.label,
          percentage: i.percentage,
          dueDate: i.dueDate || null,
        })),
      };
      return api.post('/invoices', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      if (quotationIdFromUrl) {
        queryClient.invalidateQueries({ queryKey: ['quotations'] });
      }
      navigate('/invoices');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Gagal membuat invoice');
    },
  });

  const totalInstallmentPct = installments.reduce((sum, inst) => sum + (parseFloat(inst.percentage) || 0), 0);

  function addFromPricelist(item: PricelistItem) {
    setLines(prev => [...prev, {
      _key: makeKey(),
      refType: 'pricelist_item',
      refId: item.id,
      name: item.name,
      description: item.description ?? '',
      qty: '1',
      unitPrice: item.price,
    }]);
  }

  function addFromPackage(pkg: PkgItem) {
    setLines(prev => [...prev, {
      _key: makeKey(),
      refType: 'package',
      refId: pkg.id,
      name: pkg.name,
      description: pkg.description ?? '',
      qty: '1',
      unitPrice: pkg.price,
    }]);
  }

  function updateLine(key: string, field: keyof LineItem, value: string) {
    setLines(prev => prev.map(l => l._key === key ? { ...l, [field]: value } : l));
  }

  function removeLine(key: string) { setLines(prev => prev.filter(l => l._key !== key)); }

  function updateInstallment(key: string, field: keyof InstallmentInput, value: string) {
    setInstallments(prev => prev.map(i => i._key === key ? { ...i, [field]: value } : i));
  }

  function addInstallmentRow() {
    setInstallments(prev => [...prev, { _key: makeKey(), label: `Termin ${prev.length + 1}`, percentage: '0', dueDate: '' }]);
  }

  function removeInstallmentRow(key: string) {
    setInstallments(prev => prev.filter(i => i._key !== key));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!clientId) { setError('Pilih klien terlebih dahulu'); return; }
    if (lines.length === 0) { setError('Tambahkan minimal 1 item tagihan'); return; }
    if (lines.some(l => !l.name.trim())) { setError('Semua item harus memiliki nama'); return; }
    if (Math.abs(totalInstallmentPct - 100) > 0.01) {
      setError(`Total persentase termin harus tepat 100%. Saat ini: ${totalInstallmentPct}%`);
      return;
    }
    saveMutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate('/invoices')} className="btn-ghost p-2">
          <ChevronLeft size={18} />
        </button>
        <Receipt size={22} className="text-brand-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Buat Invoice Baru</h1>
          {quotationIdFromUrl && sourceQuotation && (
            <p className="text-xs text-brand-400">
              Menyalin data dari Quotation: {sourceQuotation.number}
            </p>
          )}
        </div>
      </div>

      {/* Basic fields */}
      <div className="card card-body grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="input-label flex items-center gap-2"><User size={14} /> Klien *</label>
          <select
            id="inv-client"
            className="input"
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            required
            disabled={Boolean(quotationIdFromUrl)}
          >
            <option value="">— Pilih Klien —</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.picName ? ` (${c.picName})` : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="input-label flex items-center gap-2"><Calendar size={14} /> Tanggal Invoice</label>
          <input id="inv-issue-date" type="date" className="input" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
        </div>
        <div>
          <label className="input-label flex items-center gap-2"><Calendar size={14} /> Tenggat Waktu (Utama)</label>
          <input id="inv-due-date" type="date" className="input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="input-label">Catatan Invoice (tampil di PDF)</label>
          <textarea id="inv-notes" className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
      </div>

      {/* Items list */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-200">Item Tagihan / Jasa</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPickerOpen(!pickerOpen)}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              <Tag size={13} /> Dari Pricelist
            </button>
            <button
              type="button"
              onClick={() => setLines(prev => [...prev, emptyLine()])}
              className="btn-ghost text-xs py-1.5 px-3"
            >
              <Plus size={13} /> Custom
            </button>
          </div>
        </div>

        {/* Picker panel */}
        {pickerOpen && (
          <div className="border-b border-gray-800 p-4 bg-gray-800/30">
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Cari item atau paket..."
                value={itemSearch}
                onChange={e => setItemSearch(e.target.value)}
                className="input pl-8 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Tag size={11} /> Satuan</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {pricelistItems.filter(p => p.name.toLowerCase().includes(itemSearch.toLowerCase())).map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addFromPricelist(item)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-left transition-colors"
                    >
                      <span className="text-sm text-gray-200">{item.name}</span>
                      <span className="text-xs text-green-400 shrink-0 ml-2">{formatRupiah(item.price)}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Package size={11} /> Paket</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {packages.filter(p => p.name.toLowerCase().includes(itemSearch.toLowerCase())).map(pkg => (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => addFromPackage(pkg)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-left transition-colors"
                    >
                      <span className="text-sm text-gray-200">{pkg.name}</span>
                      <span className="text-xs text-green-400 shrink-0 ml-2">{formatRupiah(pkg.price)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lines table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/40">
                <th className="px-4 py-2.5 text-left text-xs text-gray-400">Nama Item</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-400">Deskripsi</th>
                <th className="px-3 py-2.5 text-center text-xs text-gray-400 w-20">Qty</th>
                <th className="px-3 py-2.5 text-right text-xs text-gray-400 w-36">Harga Satuan</th>
                <th className="px-3 py-2.5 text-right text-xs text-gray-400 w-36">Subtotal</th>
                <th className="px-2 py-2.5 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => {
                const lineTotal = (parseFloat(line.qty) || 0) * (parseFloat(line.unitPrice) || 0);
                return (
                  <tr key={line._key} className="border-b border-gray-800/60 hover:bg-gray-800/20 group">
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={line.name}
                        onChange={e => updateLine(line._key, 'name', e.target.value)}
                        placeholder="Nama item..."
                        className="bg-transparent border-0 text-gray-200 focus:outline-none focus:ring-0 w-full text-sm font-medium"
                        id={`inv-line-name-${idx}`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={line.description}
                        onChange={e => updateLine(line._key, 'description', e.target.value)}
                        placeholder="Opsional..."
                        className="bg-transparent border-0 text-gray-400 focus:outline-none focus:ring-0 w-full text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={line.qty}
                        onChange={e => updateLine(line._key, 'qty', e.target.value)}
                        className="bg-gray-800/60 border border-gray-700 rounded-md text-center text-sm text-gray-200 w-full px-2 py-1"
                        id={`inv-line-qty-${idx}`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        value={line.unitPrice}
                        onChange={e => updateLine(line._key, 'unitPrice', e.target.value)}
                        className="bg-gray-800/60 border border-gray-700 rounded-md text-right text-sm text-gray-200 w-full px-2 py-1"
                        id={`inv-line-price-${idx}`}
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-green-400 text-sm">
                      {formatRupiah(lineTotal)}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => removeLine(line._key)}
                        className="p-1 rounded hover:bg-red-900/30 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="card-body border-t border-gray-800">
          <div className="flex flex-col items-end gap-2.5 max-w-sm ml-auto">
            <div className="flex justify-between w-full text-sm">
              <span className="text-gray-400">Subtotal</span>
              <span className="text-gray-200 font-mono">{formatRupiah(subtotalRaw)}</span>
            </div>
            <div className="flex items-center justify-between w-full text-sm gap-3">
              <div className="flex items-center gap-1.5 shrink-0">
                <label className="text-gray-400">Pajak (%)</label>
                <div className="flex gap-1">
                  {['0', '11', '12'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTaxRate(preset)}
                      className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                        taxRate === preset
                          ? 'bg-brand-900 border-brand-600 text-brand-300'
                          : 'border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      {preset}%
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="inv-tax-rate"
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={taxRate}
                  onChange={e => setTaxRate(e.target.value)}
                  className="input text-right text-sm py-1 w-20 font-mono"
                />
                <span className="text-xs text-gray-400 font-mono w-24 text-right">
                  {formatRupiah(taxRaw)}
                </span>
              </div>
            </div>
            <div className="flex justify-between w-full text-base font-semibold border-t border-gray-700 pt-2">
              <span className="text-white">Total Invoice</span>
              <span className="text-green-400 font-mono">{formatRupiah(totalRaw)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Terms Selector */}
      <div className="card card-body space-y-4">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <CreditCard size={15} className="text-brand-400" /> Termin Pembayaran
          </h2>
          <select
            id="inv-payment-type"
            className="input w-48 text-sm"
            value={paymentType}
            onChange={e => setPaymentType(e.target.value as any)}
          >
            <option value="full">Pembayaran Penuh</option>
            <option value="dp">Uang Muka (DP) & Pelunasan</option>
            <option value="custom">Kustom Termin</option>
          </select>
        </div>

        {/* Installment rows */}
        <div className="space-y-3">
          {installments.map((inst, index) => {
            const instAmount = (parseFloat(inst.percentage) || 0) / 100 * totalRaw;
            return (
              <div key={inst._key} className="flex items-center gap-3 bg-gray-800/20 p-3 rounded-lg border border-gray-800/80 group">
                <div className="flex-1">
                  <label className="text-[10px] uppercase text-gray-500 font-bold block mb-1">Label Termin</label>
                  <input
                    type="text"
                    value={inst.label}
                    onChange={e => updateInstallment(inst._key, 'label', e.target.value)}
                    className="input text-sm py-1"
                    placeholder="e.g. Termin 1..."
                    id={`inv-inst-label-${index}`}
                  />
                </div>
                <div className="w-24">
                  <label className="text-[10px] uppercase text-gray-500 font-bold block mb-1">Persentase (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={inst.percentage}
                    onChange={e => updateInstallment(inst._key, 'percentage', e.target.value)}
                    className="input text-center text-sm py-1 font-mono"
                    id={`inv-inst-pct-${index}`}
                  />
                </div>
                <div className="w-40 text-right">
                  <label className="text-[10px] uppercase text-gray-500 font-bold block mb-1">Jumlah</label>
                  <span className="text-sm font-mono text-green-400 block h-9 pt-1.5 font-semibold">
                    {formatRupiah(instAmount)}
                  </span>
                </div>
                <div className="w-36">
                  <label className="text-[10px] uppercase text-gray-500 font-bold block mb-1">Jatuh Tempo</label>
                  <input
                    type="date"
                    value={inst.dueDate}
                    onChange={e => updateInstallment(inst._key, 'dueDate', e.target.value)}
                    className="input text-sm py-1"
                    id={`inv-inst-due-${index}`}
                  />
                </div>
                {paymentType === 'custom' && (
                  <div className="w-8 pt-4">
                    <button
                      type="button"
                      onClick={() => removeInstallmentRow(inst._key)}
                      className="p-1.5 rounded hover:bg-red-900/30 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex justify-between items-center text-xs text-gray-400 pt-2 px-1">
            <div>
              Total persentase: <span className={`font-semibold ${Math.abs(totalInstallmentPct - 100) < 0.01 ? 'text-green-400' : 'text-red-400'}`}>{totalInstallmentPct}%</span> (harus 100%)
            </div>
            {paymentType === 'custom' && (
              <button
                type="button"
                id="inv-add-inst-btn"
                onClick={addInstallmentRow}
                className="btn-secondary py-1 text-xs"
              >
                <Plus size={11} /> Tambah Termin
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-950/50 border border-red-900 text-red-400 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => navigate('/invoices')} className="btn-secondary">
          Batal
        </button>
        <button
          id="inv-save-btn"
          type="submit"
          disabled={saveMutation.isPending}
          className="btn-primary"
        >
          {saveMutation.isPending ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save size={15} />
          )}
          Buat Invoice
        </button>
      </div>
    </form>
  );
}
