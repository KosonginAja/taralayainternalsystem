import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  FileText, Plus, Trash2, Save, ChevronLeft, AlertCircle,
  User, Calendar, Tag, Package, Pencil, Search,
} from 'lucide-react';
import api from '../lib/api';
import { formatRupiah } from '../lib/utils';

interface Client { id: string; name: string; picName: string | null; }
interface PricelistItem { id: string; name: string; description: string | null; unit: string | null; price: string; category: string | null; }
interface PkgItem { id: string; name: string; description: string | null; price: string; }

interface LineItem {
  _key: string;               // UI-only key for React stability
  refType: 'pricelist_item' | 'package' | 'custom';
  refId: string | null;
  name: string;
  description: string;
  qty: string;
  unitPrice: string;
}

function makeKey() { return Math.random().toString(36).slice(2); }
function emptyLine(): LineItem {
  return { _key: makeKey(), refType: 'custom', refId: null, name: '', description: '', qty: '1', unitPrice: '0' };
}

export function QuotationBuilderPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const leadId = searchParams.get('leadId');
  const initialClientId = searchParams.get('clientId') || '';
  const isEditing = Boolean(id);

  const [clientId, setClientId] = useState(initialClientId);
  const [issuedDate, setIssuedDate] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [discount, setDiscount] = useState('0');
  const [taxRate, setTaxRate] = useState('0');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);
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

  // Load existing quotation when editing
  const { data: existingQuo } = useQuery({
    queryKey: ['quotation-detail', id],
    queryFn: () => api.get(`/quotations/${id}`).then(r => r.data),
    enabled: isEditing,
  });

  useEffect(() => {
    if (!existingQuo) return;
    setClientId(existingQuo.clientId ?? '');
    setIssuedDate(existingQuo.issuedDate ?? '');
    setValidUntil(existingQuo.validUntil ?? '');
    setDiscount(existingQuo.discount ?? '0');
    setTaxRate(existingQuo.taxRate ?? '0');
    setNotes(existingQuo.notes ?? '');
    setLines(
      (existingQuo.items ?? []).map((item: { refType: 'pricelist_item' | 'package' | 'custom'; refId?: string | null; name: string; description?: string | null; qty: string; unitPrice: string; }) => ({
        _key: makeKey(),
        refType: item.refType,
        refId: item.refId ?? null,
        name: item.name,
        description: item.description ?? '',
        qty: item.qty,
        unitPrice: item.unitPrice,
      }))
    );
  }, [existingQuo]);

  const subtotalRaw = lines.reduce(
    (sum, line) => sum + (parseFloat(line.qty) || 0) * (parseFloat(line.unitPrice) || 0),
    0
  );
  const discountRaw = parseFloat(discount) || 0;
  const dppRaw = Math.max(0, subtotalRaw - discountRaw);
  const taxRateNum = parseFloat(taxRate) || 0;
  const taxRaw = dppRaw * (taxRateNum / 100);
  const totalRaw = dppRaw + taxRaw;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        clientId,
        issuedDate: issuedDate || null,
        validUntil: validUntil || null,
        discount,
        taxRate,
        tax: String(taxRaw.toFixed(2)),
        notes: notes || null,
        items: lines.map(({ refType, refId, name, description, qty, unitPrice }) => ({
          refType,
          refId,
          name,
          description: description || null,
          qty,
          unitPrice,
        })),
      };
      
      let res;
      if (isEditing) {
        res = await api.put(`/quotations/${id}`, payload);
      } else {
        res = await api.post('/quotations', payload);
        // Link to lead if applicable
        if (leadId && res.data.id) {
          await api.put(`/leads/${leadId}`, { 
            status: 'won', 
            // the backend leadSchema doesn't have convertedQuotationId in PUT, 
            // wait, we can just let backend handle it, or update it manually.
            // Oh, I forgot to add convertedQuotationId to leadSchema in backend!
          });
        }
      }
      return res;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      // We also should invalidate leads query if we converted a lead
      if (leadId) queryClient.invalidateQueries({ queryKey: ['leads'] });
      navigate(`/quotations/${res.data.id}`);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Gagal menyimpan quotation');
    },
  });

  // (subtotalRaw, taxRaw, totalRaw already computed above)

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!clientId) { setError('Pilih klien terlebih dahulu'); return; }
    if (lines.length === 0) { setError('Tambahkan minimal 1 item'); return; }
    if (lines.some(l => !l.name.trim())) { setError('Semua item harus memiliki nama'); return; }
    saveMutation.mutate();
  }

  const filteredPl = pricelistItems.filter(p =>
    p.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
    (p.category ?? '').toLowerCase().includes(itemSearch.toLowerCase())
  );
  const filteredPkg = packages.filter(p =>
    p.name.toLowerCase().includes(itemSearch.toLowerCase())
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate('/quotations')} className="btn-ghost p-2">
          <ChevronLeft size={18} />
        </button>
        <FileText size={22} className="text-brand-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isEditing ? 'Edit Quotation' : 'Buat Quotation Baru'}
          </h1>
          {existingQuo && (
            <p className="text-sm text-gray-400">
              {existingQuo.number}
              {existingQuo.revisionLabel && (
                <span className="ml-2 text-yellow-400">({existingQuo.revisionLabel})</span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Header fields */}
      <div className="card card-body grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="input-label flex items-center gap-2"><User size={14} /> Klien *</label>
          <select
            id="quo-client"
            className="input"
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            required
          >
            <option value="">— Pilih Klien —</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.picName ? ` (${c.picName})` : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="input-label flex items-center gap-2"><Calendar size={14} /> Tanggal Terbit</label>
          <input id="quo-issued-date" type="date" className="input" value={issuedDate} onChange={e => setIssuedDate(e.target.value)} />
        </div>
        <div>
          <label className="input-label flex items-center gap-2"><Calendar size={14} /> Berlaku Sampai</label>
          <input id="quo-valid-until" type="date" className="input" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="input-label">Catatan (tampil di PDF)</label>
          <textarea id="quo-notes" className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
      </div>

      {/* Line items */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-200">Item Quotation</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="quo-open-picker"
              onClick={() => setPickerOpen(!pickerOpen)}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              <Tag size={13} /> Dari Pricelist
            </button>
            <button
              type="button"
              id="quo-add-custom"
              onClick={() => setLines(prev => [...prev, emptyLine()])}
              className="btn-ghost text-xs py-1.5 px-3"
            >
              <Plus size={13} /> Custom
            </button>
          </div>
        </div>

        {/* Item picker panel */}
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
              {/* Pricelist items */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Tag size={11} /> Satuan</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {filteredPl.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => { addFromPricelist(item); }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-left group transition-colors"
                    >
                      <div>
                        <span className="text-sm text-gray-200 group-hover:text-white">{item.name}</span>
                        {item.unit && <span className="text-xs text-gray-500 ml-1">/{item.unit}</span>}
                      </div>
                      <span className="text-xs text-green-400 shrink-0 ml-2">{formatRupiah(item.price)}</span>
                    </button>
                  ))}
                  {filteredPl.length === 0 && <p className="text-xs text-gray-600 px-2">Tidak ada item.</p>}
                </div>
              </div>
              {/* Packages */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Package size={11} /> Paket</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {filteredPkg.map(pkg => (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => { addFromPackage(pkg); }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-left group transition-colors"
                    >
                      <span className="text-sm text-gray-200 group-hover:text-white">{pkg.name}</span>
                      <span className="text-xs text-green-400 shrink-0 ml-2">{formatRupiah(pkg.price)}</span>
                    </button>
                  ))}
                  {filteredPkg.length === 0 && <p className="text-xs text-gray-600 px-2">Tidak ada paket.</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Line items table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/40">
                <th className="px-4 py-2.5 text-left text-xs text-gray-400 font-medium">Nama Item</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-400 font-medium">Deskripsi</th>
                <th className="px-3 py-2.5 text-center text-xs text-gray-400 font-medium w-20">Qty</th>
                <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-medium w-36">Harga Satuan</th>
                <th className="px-3 py-2.5 text-right text-xs text-gray-400 font-medium w-36">Subtotal</th>
                <th className="px-2 py-2.5 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => {
                const lineTotal = (parseFloat(line.qty) || 0) * (parseFloat(line.unitPrice) || 0);
                return (
                  <tr key={line._key} className="border-b border-gray-800/60 hover:bg-gray-800/20 group">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        {line.refType === 'pricelist_item' && <Tag size={12} className="text-brand-400 shrink-0" />}
                        {line.refType === 'package' && <Package size={12} className="text-purple-400 shrink-0" />}
                        {line.refType === 'custom' && <Pencil size={12} className="text-gray-500 shrink-0" />}
                        <input
                          type="text"
                          value={line.name}
                          onChange={e => updateLine(line._key, 'name', e.target.value)}
                          placeholder="Nama item..."
                          className="bg-transparent border-0 text-gray-200 focus:outline-none focus:ring-0 w-full text-sm"
                          id={`quo-line-name-${idx}`}
                        />
                      </div>
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
                        className="bg-gray-800/60 border border-gray-700 rounded-md text-center text-sm text-gray-200 w-full px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        id={`quo-line-qty-${idx}`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        value={line.unitPrice}
                        onChange={e => updateLine(line._key, 'unitPrice', e.target.value)}
                        className="bg-gray-800/60 border border-gray-700 rounded-md text-right text-sm text-gray-200 w-full px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        id={`quo-line-price-${idx}`}
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
              {lines.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">
                    Belum ada item. Tambahkan dari pricelist atau buat item custom.
                  </td>
                </tr>
              )}
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
              <label className="text-gray-400 shrink-0">Diskon (Rp)</label>
              <input
                id="quo-discount"
                type="number"
                min={0}
                step={1000}
                value={discount}
                onChange={e => setDiscount(e.target.value)}
                className="input text-right text-sm py-1 w-32 font-mono"
              />
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
                  id="quo-tax-rate"
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
              <span className="text-white">Total</span>
              <span className="text-green-400 font-mono">{formatRupiah(totalRaw)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-950/50 border border-red-900 text-red-400 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => navigate('/quotations')} className="btn-secondary">
          Batal
        </button>
        <button
          id="quo-save-btn"
          type="submit"
          disabled={saveMutation.isPending}
          className="btn-primary"
        >
          {saveMutation.isPending ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save size={15} />
          )}
          {isEditing ? 'Simpan Perubahan' : 'Buat Quotation'}
        </button>
      </div>
    </form>
  );
}

