import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tag, Plus, Search, Pencil, ToggleLeft, ToggleRight, X, Save } from 'lucide-react';
import api from '../lib/api';
import { formatRupiah } from '../lib/utils';

interface PricelistItem {
  id: string;
  name: string;
  description: string | null;
  unit: string | null;
  price: string;
  category: string | null;
  isActive: boolean;
  createdAt: string;
}

const emptyForm = {
  name: '',
  description: '',
  unit: '',
  price: '',
  category: '',
  isActive: true,
};

export function PricelistPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  const { data: items = [], isLoading } = useQuery<PricelistItem[]>({
    queryKey: ['pricelist', search, includeInactive],
    queryFn: () =>
      api.get('/pricelist', { params: { search, includeInactive } }).then((r) => r.data),
  });

  // Group by category
  const grouped = items.reduce<Record<string, PricelistItem[]>>((acc, item) => {
    const cat = item.category || 'Lainnya';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const saveMutation = useMutation({
    mutationFn: () =>
      editingId
        ? api.put(`/pricelist/${editingId}`, form)
        : api.post('/pricelist', form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricelist'] });
      closeModal();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setFormError(msg ?? 'Gagal menyimpan item');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/pricelist/${id}/toggle`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pricelist'] }),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (item: PricelistItem) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description ?? '',
      unit: item.unit ?? '',
      price: item.price,
      category: item.category ?? '',
      isActive: item.isActive,
    });
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setFormError('Nama wajib diisi'); return; }
    if (!form.price || isNaN(parseFloat(form.price))) { setFormError('Harga harus berupa angka'); return; }
    saveMutation.mutate();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Tag size={24} className="text-brand-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Pricelist Satuan</h1>
            <p className="text-gray-400 text-sm">{items.length} item ditemukan</p>
          </div>
        </div>
        <button id="pricelist-add-btn" onClick={openCreate} className="btn-primary">
          <Plus size={16} /> Tambah Item
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            id="pricelist-search"
            type="text"
            placeholder="Cari nama, deskripsi, kategori..."
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
            className="rounded"
          />
          Tampilkan nonaktif
        </label>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="card card-body text-center py-16">
          <Tag size={40} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Belum ada item pricelist. Klik "Tambah Item" untuk mulai.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([category, catItems]) => (
            <div key={category}>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1">
                {category}
              </h2>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nama Item</th>
                      <th>Deskripsi</th>
                      <th>Satuan</th>
                      <th className="text-right">Harga</th>
                      <th>Status</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catItems.map((item) => (
                      <tr key={item.id}>
                        <td className="font-medium text-white">{item.name}</td>
                        <td className="text-gray-400 text-sm max-w-xs truncate">{item.description || '—'}</td>
                        <td className="text-gray-400">{item.unit || '—'}</td>
                        <td className="text-right font-mono text-green-400">{formatRupiah(item.price)}</td>
                        <td>
                          {item.isActive ? (
                            <span className="badge-green">Aktif</span>
                          ) : (
                            <span className="badge-gray">Nonaktif</span>
                          )}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <button
                              id={`pricelist-edit-${item.id}`}
                              onClick={() => openEdit(item)}
                              className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              id={`pricelist-toggle-${item.id}`}
                              onClick={() => toggleMutation.mutate(item.id)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                item.isActive
                                  ? 'hover:bg-red-900/30 text-gray-400 hover:text-red-400'
                                  : 'hover:bg-green-900/30 text-gray-400 hover:text-green-400'
                              }`}
                              title={item.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                            >
                              {item.isActive ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal-box">
            <div className="modal-header">
              <h2 className="text-base font-semibold text-white">
                {editingId ? 'Edit Item Pricelist' : 'Tambah Item Baru'}
              </h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400">
                <X size={18} />
              </button>
            </div>

            <form id="pricelist-form" onSubmit={handleSubmit}>
              <div className="modal-body space-y-4">
                <div>
                  <label className="input-label" htmlFor="pl-name">Nama Item *</label>
                  <input
                    id="pl-name"
                    type="text"
                    className="input"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="input-label" htmlFor="pl-description">Deskripsi</label>
                  <textarea
                    id="pl-description"
                    className="input"
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="input-label" htmlFor="pl-unit">Satuan</label>
                    <input
                      id="pl-unit"
                      type="text"
                      className="input"
                      placeholder="page, jam, project..."
                      value={form.unit}
                      onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="input-label" htmlFor="pl-price">Harga (Rp) *</label>
                    <input
                      id="pl-price"
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

                <div>
                  <label className="input-label" htmlFor="pl-category">Kategori</label>
                  <input
                    id="pl-category"
                    type="text"
                    className="input"
                    placeholder="e.g. Desain, Foto, Video..."
                    value={form.category}
                    onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  />
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
                  id="pricelist-save-btn"
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="btn-primary"
                >
                  {saveMutation.isPending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save size={15} />
                  )}
                  {editingId ? 'Simpan Perubahan' : 'Tambah Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
