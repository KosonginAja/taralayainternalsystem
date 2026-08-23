import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, Plus, Search, Pencil, ToggleLeft, ToggleRight, X, Save, ListPlus, Trash2, Info } from 'lucide-react';
import api from '../lib/api';
import { formatRupiah } from '../lib/utils';

interface PricelistItem {
  id: string;
  name: string;
  unit: string | null;
  price: string;
  category: string | null;
  isActive: boolean;
}

interface PackageItemRow {
  id: string;
  pricelistItemId: string;
  qty: string;
  itemName: string;
  itemUnit: string | null;
  itemPrice: string;
}

interface PackageDetail {
  id: string;
  name: string;
  description: string | null;
  price: string;
  isActive: boolean;
  items: PackageItemRow[];
  sumOfComponents: string;
}

interface Package {
  id: string;
  name: string;
  description: string | null;
  price: string;
  isActive: boolean;
}

const emptyForm = { name: '', description: '', price: '' };

interface SelectedItem { pricelistItemId: string; qty: string; }

export function PackagesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [formError, setFormError] = useState('');
  const [detailPkg, setDetailPkg] = useState<PackageDetail | null>(null);

  const { data: packages = [], isLoading } = useQuery<Package[]>({
    queryKey: ['packages', search, includeInactive],
    queryFn: () =>
      api.get('/packages', { params: { search, includeInactive } }).then((r) => r.data),
  });

  // Fetch all active pricelist items for the item picker
  const { data: allPricelistItems = [] } = useQuery<PricelistItem[]>({
    queryKey: ['pricelist', '', false],
    queryFn: () => api.get('/pricelist').then((r) => r.data),
    staleTime: 60_000,
  });

  const fetchDetail = async (id: string) => {
    const res = await api.get<PackageDetail>(`/packages/${id}`);
    setDetailPkg(res.data);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        items: selectedItems.map((si) => ({ pricelistItemId: si.pricelistItemId, qty: si.qty })),
      };
      return editingId
        ? api.put(`/packages/${editingId}`, payload)
        : api.post('/packages', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      closeModal();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setFormError(msg ?? 'Gagal menyimpan paket');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/packages/${id}/toggle`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['packages'] }),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setSelectedItems([]);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = async (pkg: Package) => {
    const res = await api.get<PackageDetail>(`/packages/${pkg.id}`);
    setEditingId(pkg.id);
    setForm({ name: pkg.name, description: pkg.description ?? '', price: pkg.price });
    setSelectedItems(res.data.items.map((i) => ({ pricelistItemId: i.pricelistItemId, qty: i.qty })));
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
  };

  const addItemToSelection = (plItem: PricelistItem) => {
    if (selectedItems.find((si) => si.pricelistItemId === plItem.id)) return; // already added
    setSelectedItems((prev) => [...prev, { pricelistItemId: plItem.id, qty: '1' }]);
  };

  const removeItemFromSelection = (plId: string) => {
    setSelectedItems((prev) => prev.filter((si) => si.pricelistItemId !== plId));
  };

  const updateQty = (plId: string, qty: string) => {
    setSelectedItems((prev) =>
      prev.map((si) => (si.pricelistItemId === plId ? { ...si, qty } : si))
    );
  };

  const getPlItem = (id: string) => allPricelistItems.find((p) => p.id === id);

  // Compute sum of selected components
  const sumOfSelected = selectedItems.reduce((acc, si) => {
    const item = getPlItem(si.pricelistItemId);
    if (!item) return acc;
    return acc + parseFloat(item.price) * parseFloat(si.qty || '1');
  }, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setFormError('Nama paket wajib diisi'); return; }
    if (!form.price || isNaN(parseFloat(form.price))) { setFormError('Harga harus berupa angka'); return; }
    saveMutation.mutate();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Package size={24} className="text-brand-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Pricelist Paket</h1>
            <p className="text-gray-400 text-sm">{packages.length} paket ditemukan</p>
          </div>
        </div>
        <button id="packages-add-btn" onClick={openCreate} className="btn-primary">
          <Plus size={16} /> Tambah Paket
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            id="packages-search"
            type="text"
            placeholder="Cari nama paket..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
          />
          Tampilkan nonaktif
        </label>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : packages.length === 0 ? (
        <div className="card card-body text-center py-16">
          <Package size={40} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Belum ada paket. Klik "Tambah Paket" untuk mulai.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nama Paket</th>
                <th>Deskripsi</th>
                <th className="text-right">Harga Paket</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <tr key={pkg.id}>
                  <td>
                    <button
                      onClick={() => fetchDetail(pkg.id)}
                      className="font-medium text-white hover:text-brand-400 text-left transition-colors"
                    >
                      {pkg.name}
                    </button>
                  </td>
                  <td className="text-gray-400 text-sm max-w-xs truncate">{pkg.description || '—'}</td>
                  <td className="text-right font-mono text-green-400">{formatRupiah(pkg.price)}</td>
                  <td>
                    {pkg.isActive ? (
                      <span className="badge-green">Aktif</span>
                    ) : (
                      <span className="badge-gray">Nonaktif</span>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button
                        id={`package-detail-${pkg.id}`}
                        onClick={() => fetchDetail(pkg.id)}
                        className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                        title="Lihat isi paket"
                      >
                        <Info size={14} />
                      </button>
                      <button
                        id={`package-edit-${pkg.id}`}
                        onClick={() => openEdit(pkg)}
                        className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        id={`package-toggle-${pkg.id}`}
                        onClick={() => toggleMutation.mutate(pkg.id)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          pkg.isActive
                            ? 'hover:bg-red-900/30 text-gray-400 hover:text-red-400'
                            : 'hover:bg-green-900/30 text-gray-400 hover:text-green-400'
                        }`}
                        title={pkg.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      >
                        {pkg.isActive ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail View Modal */}
      {detailPkg && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDetailPkg(null)}>
          <div className="modal-box max-w-xl">
            <div className="modal-header">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Package size={18} className="text-brand-400" /> {detailPkg.name}
              </h2>
              <button onClick={() => setDetailPkg(null)} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body space-y-4">
              {detailPkg.description && (
                <p className="text-sm text-gray-400">{detailPkg.description}</p>
              )}

              {/* Items breakdown */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Komponen Paket</p>
                {detailPkg.items.length === 0 ? (
                  <p className="text-sm text-gray-500">Belum ada item.</p>
                ) : (
                  <div className="space-y-1.5">
                    {detailPkg.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between bg-gray-800/60 rounded-lg px-3 py-2">
                        <div>
                          <span className="text-sm text-gray-200">{item.itemName}</span>
                          {item.itemUnit && <span className="text-xs text-gray-500 ml-1">({item.itemUnit})</span>}
                        </div>
                        <div className="text-right text-xs">
                          <span className="text-gray-400">{item.qty}×</span>
                          <span className="text-gray-200 ml-1">{formatRupiah(item.itemPrice)}</span>
                          <span className="text-green-400 ml-2 font-medium">
                            = {formatRupiah(parseFloat(item.itemPrice) * parseFloat(item.qty))}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Price comparison */}
              <div className="bg-gray-800/40 rounded-xl p-4 space-y-2 border border-gray-700">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total komponen</span>
                  <span className="text-gray-200 font-mono">{formatRupiah(detailPkg.sumOfComponents)}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-gray-700 pt-2">
                  <span className="text-white font-semibold">Harga paket</span>
                  <span className="text-green-400 font-semibold font-mono">{formatRupiah(detailPkg.price)}</span>
                </div>
                {parseFloat(detailPkg.price) < parseFloat(detailPkg.sumOfComponents) && (
                  <p className="text-xs text-yellow-400">
                    💡 Hemat {formatRupiah(parseFloat(detailPkg.sumOfComponents) - parseFloat(detailPkg.price))} dibanding beli satuan
                  </p>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setDetailPkg(null)} className="btn-secondary">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal-box max-w-2xl">
            <div className="modal-header">
              <h2 className="text-base font-semibold text-white">
                {editingId ? 'Edit Paket' : 'Tambah Paket Baru'}
              </h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400">
                <X size={18} />
              </button>
            </div>

            <form id="packages-form" onSubmit={handleSubmit}>
              <div className="modal-body space-y-5">
                {/* Basic info */}
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="input-label" htmlFor="pkg-name">Nama Paket *</label>
                    <input
                      id="pkg-name"
                      type="text"
                      className="input"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="input-label" htmlFor="pkg-description">Deskripsi</label>
                    <textarea
                      id="pkg-description"
                      className="input"
                      rows={2}
                      value={form.description}
                      onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="input-label" htmlFor="pkg-price">
                      Harga Paket (Rp) *
                      {selectedItems.length > 0 && (
                        <span className="ml-2 text-xs text-gray-500 font-normal">
                          Total komponen: {formatRupiah(sumOfSelected)}
                        </span>
                      )}
                    </label>
                    <input
                      id="pkg-price"
                      type="number"
                      min={0}
                      step={1000}
                      className="input"
                      value={form.price}
                      onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                {/* Item picker */}
                <div>
                  <p className="input-label mb-2">Komponen Item Pricelist</p>
                  <div className="border border-gray-700 rounded-xl overflow-hidden">
                    {/* Selected items */}
                    {selectedItems.length > 0 && (
                      <div className="p-3 space-y-2 border-b border-gray-700 bg-gray-800/30">
                        {selectedItems.map((si) => {
                          const plItem = getPlItem(si.pricelistItemId);
                          if (!plItem) return null;
                          return (
                            <div key={si.pricelistItemId} className="flex items-center gap-3">
                              <div className="flex-1 text-sm text-gray-200">{plItem.name}</div>
                              <div className="text-xs text-gray-400">{formatRupiah(plItem.price)}</div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-gray-500">×</span>
                                <input
                                  type="number"
                                  min={0.01}
                                  step={0.5}
                                  value={si.qty}
                                  onChange={(e) => updateQty(si.pricelistItemId, e.target.value)}
                                  className="input w-20 text-center py-1 text-sm"
                                />
                              </div>
                              <div className="text-xs text-green-400 w-28 text-right font-mono">
                                {formatRupiah(parseFloat(plItem.price) * parseFloat(si.qty || '1'))}
                              </div>
                              <button
                                type="button"
                                onClick={() => removeItemFromSelection(si.pricelistItemId)}
                                className="p-1 rounded hover:bg-red-900/30 text-gray-500 hover:text-red-400"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          );
                        })}
                        <div className="text-right text-xs text-gray-400 pt-1 border-t border-gray-700/50">
                          Total komponen: <span className="text-white font-medium">{formatRupiah(sumOfSelected)}</span>
                        </div>
                      </div>
                    )}

                    {/* Picker dropdown */}
                    <div className="p-3">
                      <p className="text-xs text-gray-500 mb-2 flex items-center gap-1.5">
                        <ListPlus size={13} /> Tambah item dari pricelist satuan
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                        {allPricelistItems
                          .filter((p) => !selectedItems.find((si) => si.pricelistItemId === p.id))
                          .map((plItem) => (
                            <button
                              key={plItem.id}
                              type="button"
                              onClick={() => addItemToSelection(plItem)}
                              className="flex items-center justify-between text-left px-3 py-2 rounded-lg bg-gray-800/60 hover:bg-gray-700/80 border border-gray-700/50 hover:border-brand-700 transition-colors group"
                            >
                              <span className="text-sm text-gray-300 group-hover:text-white truncate">{plItem.name}</span>
                              <span className="text-xs text-green-400 ml-2 shrink-0">{formatRupiah(plItem.price)}</span>
                            </button>
                          ))}
                        {allPricelistItems.filter((p) => !selectedItems.find((si) => si.pricelistItemId === p.id)).length === 0 && (
                          <p className="text-xs text-gray-600 col-span-2">Semua item sudah ditambahkan.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {formError && (
                  <div className="bg-red-950/50 border border-red-900 text-red-400 text-sm px-3 py-2 rounded-lg">
                    {formError}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" onClick={closeModal} className="btn-secondary">Batal</button>
                <button
                  id="packages-save-btn"
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="btn-primary"
                >
                  {saveMutation.isPending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save size={15} />
                  )}
                  {editingId ? 'Simpan Perubahan' : 'Buat Paket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
