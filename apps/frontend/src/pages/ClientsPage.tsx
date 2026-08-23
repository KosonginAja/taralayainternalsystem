import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Search, Pencil, ToggleLeft, ToggleRight, X, Save, Eye, Phone, Mail, MapPin, FileText } from 'lucide-react';
import api from '../lib/api';
import { formatDate } from '../lib/utils';

interface Client {
  id: string;
  name: string;
  picName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

const emptyForm = { name: '', picName: '', email: '', phone: '', address: '', notes: '', isActive: true };

export function ClientsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ['clients', search, includeInactive],
    queryFn: () =>
      api.get('/clients', { params: { search, includeInactive } }).then((r) => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        return api.put(`/clients/${editingId}`, form);
      } else {
        return api.post('/clients', form);
      }
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      // If we are editing the currently viewed client, update the detailed view
      if (selectedClient && selectedClient.id === editingId) {
        setSelectedClient(res.data);
      }
      closeModal();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setFormError(msg ?? 'Gagal menyimpan klien');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (client: Client) =>
      client.isActive
        ? api.delete(`/clients/${client.id}`)
        : api.put(`/clients/${client.id}`, { ...client, isActive: true }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      if (selectedClient && selectedClient.id === variables.id) {
        setSelectedClient((prev) => prev ? { ...prev, isActive: !prev.isActive } : null);
      }
    },
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (c: Client) => {
    setEditingId(c.id);
    setForm({
      name: c.name,
      picName: c.picName ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
      address: c.address ?? '',
      notes: c.notes ?? '',
      isActive: c.isActive,
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
    if (!form.name.trim()) {
      setFormError('Nama klien wajib diisi');
      return;
    }
    saveMutation.mutate();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Users size={24} className="text-brand-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Manajemen Klien</h1>
            <p className="text-gray-400 text-sm">{clients.length} klien ditemukan</p>
          </div>
        </div>
        <button id="client-add-btn" onClick={openCreate} className="btn-primary">
          <Plus size={16} /> Tambah Klien
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            id="client-search"
            type="text"
            placeholder="Cari nama, PIC, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
          <input
            id="client-include-inactive"
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="rounded"
          />
          Tampilkan nonaktif
        </label>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : clients.length === 0 ? (
        <div className="card card-body text-center py-16">
          <Users size={40} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Belum ada klien. Klik "Tambah Klien" untuk mulai.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>PIC</th>
                <th>Kontak</th>
                <th>Status</th>
                <th>Dibuat</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td>
                    <button
                      onClick={() => setSelectedClient(c)}
                      className="font-medium text-white hover:text-brand-400 text-left transition-colors focus:outline-none"
                    >
                      {c.name}
                    </button>
                  </td>
                  <td className="text-gray-400">{c.picName || '—'}</td>
                  <td>
                    <div className="space-y-0.5">
                      {c.email && <div className="text-gray-300 text-xs">{c.email}</div>}
                      {c.phone && <div className="text-gray-400 text-xs">{c.phone}</div>}
                    </div>
                  </td>
                  <td>
                    {c.isActive ? (
                      <span className="badge-green">Aktif</span>
                    ) : (
                      <span className="badge-gray">Nonaktif</span>
                    )}
                  </td>
                  <td className="text-gray-400 text-xs">{formatDate(c.createdAt)}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button
                        id={`client-view-btn-${c.id}`}
                        onClick={() => setSelectedClient(c)}
                        className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                        title="Detail"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        id={`client-edit-${c.id}`}
                        onClick={() => openEdit(c)}
                        className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        id={`client-toggle-${c.id}`}
                        onClick={() => toggleMutation.mutate(c)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          c.isActive
                            ? 'hover:bg-red-900/30 text-gray-400 hover:text-red-400'
                            : 'hover:bg-green-900/30 text-gray-400 hover:text-green-400'
                        }`}
                        title={c.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      >
                        {c.isActive ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
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
      {selectedClient && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setSelectedClient(null)}>
          <div className="modal-box max-w-md">
            <div className="modal-header">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Users size={18} className="text-brand-400" /> Detail Klien
              </h2>
              <button onClick={() => setSelectedClient(null)} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body space-y-5">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-lg font-bold text-white leading-tight">{selectedClient.name}</h3>
                  {selectedClient.isActive ? (
                    <span className="badge-green">Aktif</span>
                  ) : (
                    <span className="badge-gray">Nonaktif</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">ID Klien: {selectedClient.id}</p>
              </div>

              <div className="space-y-3 border-t border-gray-800 pt-4">
                <div className="flex items-start gap-3">
                  <Eye size={16} className="text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-gray-400">Person in Charge (PIC)</p>
                    <p className="text-sm text-gray-200 mt-0.5">{selectedClient.picName || '—'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail size={16} className="text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-gray-400">Alamat Email</p>
                    {selectedClient.email ? (
                      <a href={`mailto:${selectedClient.email}`} className="text-sm text-brand-400 hover:underline mt-0.5 block">
                        {selectedClient.email}
                      </a>
                    ) : (
                      <p className="text-sm text-gray-500 mt-0.5">—</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone size={16} className="text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-gray-400">Nomor Telepon</p>
                    {selectedClient.phone ? (
                      <p className="text-sm text-gray-200 mt-0.5">{selectedClient.phone}</p>
                    ) : (
                      <p className="text-sm text-gray-500 mt-0.5">—</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin size={16} className="text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-gray-400">Alamat Fisik</p>
                    <p className="text-sm text-gray-200 mt-0.5 whitespace-pre-wrap">{selectedClient.address || '—'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <FileText size={16} className="text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-gray-400">Catatan Internal</p>
                    <p className="text-sm text-gray-300 mt-0.5 whitespace-pre-wrap bg-gray-950 p-2.5 rounded-lg border border-gray-800/80">
                      {selectedClient.notes || 'Tidak ada catatan.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-xs text-gray-500 pt-2 flex justify-between">
                <span>Daftar sejak: {formatDate(selectedClient.createdAt)}</span>
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={() => {
                  openEdit(selectedClient);
                  setSelectedClient(null);
                }}
                className="btn-secondary"
              >
                <Pencil size={14} /> Edit Data
              </button>
              <button onClick={() => setSelectedClient(null)} className="btn-primary">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal-box">
            <div className="modal-header">
              <h2 className="text-base font-semibold text-white">
                {editingId ? 'Edit Klien' : 'Tambah Klien Baru'}
              </h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400">
                <X size={18} />
              </button>
            </div>

            <form id="client-form" onSubmit={handleSubmit}>
              <div className="modal-body space-y-4">
                <div>
                  <label className="input-label" htmlFor="client-name">Nama Klien / Perusahaan *</label>
                  <input
                    id="client-name"
                    type="text"
                    className="input"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="input-label" htmlFor="client-pic">Person in Charge (PIC)</label>
                  <input
                    id="client-pic"
                    type="text"
                    className="input"
                    value={form.picName}
                    onChange={(e) => setForm((p) => ({ ...p, picName: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="input-label" htmlFor="client-email">Email</label>
                    <input
                      id="client-email"
                      type="email"
                      className="input"
                      value={form.email}
                      onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="input-label" htmlFor="client-phone">Telepon</label>
                    <input
                      id="client-phone"
                      type="text"
                      className="input"
                      value={form.phone}
                      onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="input-label" htmlFor="client-address">Alamat</label>
                  <textarea
                    id="client-address"
                    className="input"
                    rows={2}
                    value={form.address}
                    onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="input-label" htmlFor="client-notes">Catatan</label>
                  <textarea
                    id="client-notes"
                    className="input"
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
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
                  id="client-save-btn"
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="btn-primary"
                >
                  {saveMutation.isPending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save size={15} />
                  )}
                  {editingId ? 'Simpan Perubahan' : 'Tambah Klien'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
