import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase, Plus, Calendar, User, ArrowRight, Trash2, ExternalLink
} from 'lucide-react';
import api from '../lib/api';
import { formatDate } from '../lib/utils';

type ProjectStatus = 'not_started' | 'in_progress' | 'review' | 'completed' | 'on_hold' | 'cancelled';

interface Project {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  quotationId: string | null;
  status: ProjectStatus;
  startDate: string | null;
  deadline: string | null;
  description: string | null;
  createdAt: string;
}

const COLUMNS: { key: ProjectStatus; label: string; color: string; dot: string }[] = [
  { key: 'not_started',  label: 'Belum Mulai',   color: 'border-gray-700 bg-gray-900/40',    dot: 'bg-gray-500' },
  { key: 'in_progress',  label: 'Dikerjakan',     color: 'border-blue-800/50 bg-blue-950/20', dot: 'bg-blue-500' },
  { key: 'review',       label: 'Review',          color: 'border-amber-800/50 bg-amber-950/20', dot: 'bg-amber-400' },
  { key: 'completed',    label: 'Selesai',         color: 'border-emerald-800/50 bg-emerald-950/20', dot: 'bg-emerald-400' },
  { key: 'on_hold',      label: 'Ditunda',         color: 'border-orange-800/50 bg-orange-950/20', dot: 'bg-orange-500' },
  { key: 'cancelled',    label: 'Dibatalkan',      color: 'border-red-900/50 bg-red-950/20',  dot: 'bg-red-500' },
];

export function ProjectsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isNewOpen, setIsNewOpen] = useState(false);

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then(r => r.data),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ProjectStatus }) =>
      api.put(`/projects/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });

  const grouped = COLUMNS.reduce((acc, col) => {
    acc[col.key] = projects.filter(p => p.status === col.key);
    return acc;
  }, {} as Record<ProjectStatus, Project[]>);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Briefcase size={24} className="text-brand-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Project Management</h1>
            <p className="text-gray-400 text-sm">Kelola semua proyek aktif Taralaya Studio</p>
          </div>
        </div>
        <button
          onClick={() => setIsNewOpen(true)}
          className="btn-primary"
        >
          <Plus size={16} /> Proyek Baru
        </button>
      </div>

      {/* Kanban Board */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-start">
          {COLUMNS.map(col => (
            <div key={col.key} className={`rounded-xl border p-3 flex flex-col gap-3 ${col.color}`}>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{col.label}</p>
                <span className="ml-auto text-xs text-gray-500 font-mono">{grouped[col.key].length}</span>
              </div>

              {grouped[col.key].length === 0 && (
                <p className="text-xs text-gray-600 text-center py-4">—</p>
              )}

              {grouped[col.key].map(project => (
                <div
                  key={project.id}
                  className="bg-gray-900 border border-gray-800 rounded-lg p-3 space-y-2 group cursor-pointer hover:border-gray-700 transition-all"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <p className="text-sm font-semibold text-white leading-snug line-clamp-2">{project.name}</p>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <User size={10} />
                    <span className="truncate">{project.clientName}</span>
                  </div>
                  {project.deadline && (
                    <div className="flex items-center gap-1 text-xs text-amber-400">
                      <Calendar size={10} />
                      <span>{formatDate(project.deadline)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 pt-1" onClick={e => e.stopPropagation()}>
                    <select
                      value={project.status}
                      onChange={e => statusMutation.mutate({ id: project.id, status: e.target.value as ProjectStatus })}
                      className="flex-1 text-[10px] bg-gray-800 border border-gray-700 rounded text-gray-300 py-0.5 px-1"
                    >
                      {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                    <button
                      onClick={() => {
                        if (confirm('Hapus proyek ini?')) deleteMutation.mutate(project.id);
                      }}
                      className="p-1 text-gray-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* New Project Modal */}
      {isNewOpen && (
        <NewProjectModal
          onClose={() => setIsNewOpen(false)}
          onSuccess={() => {
            setIsNewOpen(false);
            queryClient.invalidateQueries({ queryKey: ['projects'] });
          }}
        />
      )}
    </div>
  );
}

function NewProjectModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ name: '', clientId: '', startDate: '', deadline: '', description: '' });

  const { data: clients = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['clients-list'],
    queryFn: () => api.get('/clients').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.post('/projects', data),
    onSuccess,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="font-bold text-white">Proyek Baru</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
        </div>
        <form
          onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }}
          className="p-6 space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Nama Proyek</label>
            <input
              required value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="input w-full"
              placeholder="e.g. Website Company XYZ"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Klien</label>
            <select
              required value={form.clientId}
              onChange={e => setForm({ ...form, clientId: e.target.value })}
              className="input w-full"
            >
              <option value="">-- Pilih Klien --</option>
              {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Tanggal Mulai</label>
              <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Deadline</label>
              <input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} className="input w-full" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Deskripsi</label>
            <textarea
              rows={3} value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="input w-full"
              placeholder="Scope, catatan proyek..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Batal</button>
            <button type="submit" disabled={createMutation.isPending} className="btn-primary">
              {createMutation.isPending ? 'Menyimpan...' : 'Buat Proyek'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
