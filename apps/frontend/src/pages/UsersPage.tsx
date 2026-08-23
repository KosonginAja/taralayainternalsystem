import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UsersRound, Plus, Trash2, Shield, User } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { formatDate } from '../lib/utils';
import { Navigate } from 'react-router-dom';

interface UserItem {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'member';
  createdAt: string;
}

export function UsersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);

  const { data: users = [], isLoading } = useQuery<UserItem[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
    enabled: user?.role === 'admin'
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <UsersRound size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Tim & Karyawan</h1>
            <p className="text-gray-400 text-sm">Kelola akses sistem untuk tim internal</p>
          </div>
        </div>
        <button onClick={() => setIsAddOpen(true)} className="btn-primary">
          <Plus size={16} /> Tambah Member
        </button>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Email</th>
                <th>Role</th>
                <th>Tgl Bergabung</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="text-center py-4">Memuat data...</td></tr>
              ) : users.map((u) => (
                <tr key={u.id}>
                  <td className="font-medium text-white">{u.name}</td>
                  <td className="text-gray-400">{u.email}</td>
                  <td>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                      u.role === 'admin' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-gray-800 text-gray-300'
                    }`}>
                      {u.role === 'admin' ? <Shield size={10} /> : <User size={10} />}
                      {u.role.toUpperCase()}
                    </span>
                  </td>
                  <td className="text-gray-400 text-sm">{formatDate(u.createdAt)}</td>
                  <td className="text-right">
                    {u.id !== user?.id && (
                      <button
                        onClick={() => {
                          if (confirm('Hapus akses user ini?')) deleteMutation.mutate(u.id);
                        }}
                        className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
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
        <AddUserModal
          onClose={() => setIsAddOpen(false)}
          onSuccess={() => {
            setIsAddOpen(false);
            queryClient.invalidateQueries({ queryKey: ['users'] });
          }}
        />
      )}
    </div>
  );
}

function AddUserModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'member' });
  const [error, setError] = useState('');

  const addMutation = useMutation({
    mutationFn: (data: typeof form) => api.post('/users', data),
    onSuccess,
    onError: (err: any) => setError(err.response?.data?.error || 'Gagal menambahkan user'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="font-bold text-white">Tambah Anggota Tim</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </div>
        <form
          onSubmit={e => {
            e.preventDefault();
            setError('');
            addMutation.mutate(form);
          }}
          className="p-6 space-y-4"
        >
          {error && <div className="p-3 bg-red-900/30 border border-red-800 rounded text-red-300 text-sm">{error}</div>}
          
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Nama Lengkap</label>
            <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input w-full" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Email</label>
            <input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="input w-full" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Password</label>
            <input required type="password" minLength={6} value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="input w-full" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Role</label>
            <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="input w-full">
              <option value="member">Member (Terbatas)</option>
              <option value="admin">Admin (Full Akses)</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
            <button type="button" onClick={onClose} className="btn-secondary">Batal</button>
            <button type="submit" disabled={addMutation.isPending} className="btn-primary">
              {addMutation.isPending ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
