import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase, ArrowLeft, Calendar, User, FileText, Plus,
  CheckSquare, Square, Trash2, Edit3, Save, X
} from 'lucide-react';
import api from '../lib/api';
import { formatDate } from '../lib/utils';

type TaskStatus = 'todo' | 'in_progress' | 'done';
type ProjectStatus = 'not_started' | 'in_progress' | 'review' | 'completed' | 'on_hold' | 'cancelled';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueDate: string | null;
  sortOrder: number;
  assigneeId: string | null;
}

interface ProjectDetail {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  quotationId: string | null;
  status: ProjectStatus;
  startDate: string | null;
  deadline: string | null;
  description: string | null;
  tasks: Task[];
}

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'not_started', label: 'Belum Mulai' },
  { value: 'in_progress', label: 'Dikerjakan' },
  { value: 'review', label: 'Review' },
  { value: 'completed', label: 'Selesai' },
  { value: 'on_hold', label: 'Ditunda' },
  { value: 'cancelled', label: 'Dibatalkan' },
];

const STATUS_COLORS: Record<ProjectStatus, string> = {
  not_started: 'badge-gray',
  in_progress: 'badge-blue',
  review: 'badge-yellow',
  completed: 'badge-green',
  on_hold: 'bg-orange-950/60 border border-orange-800/50 text-orange-300 text-xs font-medium px-2 py-0.5 rounded-full',
  cancelled: 'badge-red',
};

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [editingProject, setEditingProject] = useState(false);
  const [editForm, setEditForm] = useState<Partial<ProjectDetail>>({});

  const { data: project, isLoading } = useQuery<ProjectDetail>({
    queryKey: ['project-detail', id],
    queryFn: () => api.get(`/projects/${id}`).then(r => r.data),
    enabled: Boolean(id),
  });

  const { data: users = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  });

  const updateProjectMutation = useMutation({
    mutationFn: (data: Partial<ProjectDetail>) => api.put(`/projects/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setEditingProject(false);
    },
  });

  const addTaskMutation = useMutation({
    mutationFn: (title: string) => api.post(`/projects/${id}/tasks`, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-detail', id] });
      setNewTaskTitle('');
    },
  });

  const toggleTaskMutation = useMutation({
    mutationFn: ({ taskId, status, assigneeId }: { taskId: string; status?: TaskStatus, assigneeId?: string | null }) =>
      api.put(`/projects/${id}/tasks/${taskId}`, { status, assigneeId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project-detail', id] }),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => api.delete(`/projects/${id}/tasks/${taskId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project-detail', id] }),
  });

  if (isLoading || !project) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const doneTasks = project.tasks.filter(t => t.status === 'done').length;
  const progress = project.tasks.length > 0 ? Math.round((doneTasks / project.tasks.length) * 100) : 0;

  const handleStartEdit = () => {
    setEditForm({
      name: project.name,
      status: project.status,
      startDate: project.startDate ?? '',
      deadline: project.deadline ?? '',
      description: project.description ?? '',
    });
    setEditingProject(true);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back */}
      <button
        onClick={() => navigate('/projects')}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft size={16} /> Kembali ke Daftar Proyek
      </button>

      {/* Project Header Card */}
      <div className="card card-body space-y-4">
        {editingProject ? (
          <div className="space-y-4">
            <input
              value={editForm.name}
              onChange={e => setEditForm({ ...editForm, name: e.target.value })}
              className="input w-full text-lg font-bold"
              placeholder="Nama proyek"
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Status</label>
                <select
                  value={editForm.status}
                  onChange={e => setEditForm({ ...editForm, status: e.target.value as ProjectStatus })}
                  className="input w-full"
                >
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Deadline</label>
                <input
                  type="date" value={editForm.deadline ?? ''}
                  onChange={e => setEditForm({ ...editForm, deadline: e.target.value })}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Tanggal Mulai</label>
                <input
                  type="date" value={editForm.startDate ?? ''}
                  onChange={e => setEditForm({ ...editForm, startDate: e.target.value })}
                  className="input w-full"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Deskripsi</label>
              <textarea
                rows={3} value={editForm.description ?? ''}
                onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                className="input w-full"
                placeholder="Scope, catatan..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => updateProjectMutation.mutate(editForm)}
                disabled={updateProjectMutation.isPending}
                className="btn-primary"
              >
                <Save size={14} /> Simpan
              </button>
              <button onClick={() => setEditingProject(false)} className="btn-secondary">
                <X size={14} /> Batal
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h1 className="text-xl font-bold text-white">{project.name}</h1>
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <span className="flex items-center gap-1"><User size={13} /> {project.clientName}</span>
                  {project.startDate && (
                    <span className="flex items-center gap-1"><Calendar size={13} /> Mulai: {formatDate(project.startDate)}</span>
                  )}
                  {project.deadline && (
                    <span className="flex items-center gap-1 text-amber-400"><Calendar size={13} /> Deadline: {formatDate(project.deadline)}</span>
                  )}
                </div>
                {project.description && (
                  <p className="text-sm text-gray-400 mt-2">{project.description}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className={STATUS_COLORS[project.status]}>
                  {STATUS_OPTIONS.find(s => s.value === project.status)?.label}
                </span>
                <button onClick={handleStartEdit} className="btn-secondary py-1.5">
                  <Edit3 size={13} /> Edit
                </button>
              </div>
            </div>

            {project.quotationId && (
              <div className="flex items-center gap-2 text-xs text-brand-400">
                <FileText size={12} />
                <Link to="/quotations" className="hover:underline">Lihat Quotation Asal →</Link>
              </div>
            )}

            {/* Progress bar */}
            {project.tasks.length > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Progress Task</span>
                  <span className="font-mono">{doneTasks}/{project.tasks.length} ({progress}%)</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Task Checklist */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckSquare size={18} className="text-brand-400" />
            <h2 className="text-base font-semibold text-white">Task Checklist</h2>
          </div>
          <span className="text-xs text-gray-500 font-mono">{doneTasks}/{project.tasks.length}</span>
        </div>
        <div className="card-body space-y-2">
          {project.tasks.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">Belum ada task. Tambahkan task di bawah.</p>
          )}
          {project.tasks.map(task => (
            <div
              key={task.id}
              className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-800/40 group transition-colors"
            >
              <button
                onClick={() => toggleTaskMutation.mutate({
                  taskId: task.id,
                  status: task.status === 'done' ? 'todo' : 'done'
                })}
                className="shrink-0 text-gray-400 hover:text-emerald-400 transition-colors"
              >
                {task.status === 'done'
                  ? <CheckSquare size={18} className="text-emerald-400" />
                  : <Square size={18} />
                }
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${task.status === 'done' ? 'line-through text-gray-500' : 'text-white'}`}>
                  {task.title}
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                  {task.dueDate && (
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar size={10} /> {formatDate(task.dueDate)}
                    </p>
                  )}
                  {task.assigneeId && (
                    <p className="text-xs text-indigo-400 flex items-center gap-1">
                      <User size={10} /> {users.find(u => u.id === task.assigneeId)?.name || 'Unknown'}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <select
                  value={task.assigneeId || ''}
                  onChange={e => toggleTaskMutation.mutate({ taskId: task.id, assigneeId: e.target.value || null })}
                  onClick={e => e.stopPropagation()}
                  className="text-[10px] bg-gray-800 border border-gray-700 rounded text-gray-300 py-0.5 px-1 max-w-[100px]"
                >
                  <option value="">-- Assign --</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <select
                  value={task.status}
                  onChange={e => toggleTaskMutation.mutate({ taskId: task.id, status: e.target.value as TaskStatus })}
                  onClick={e => e.stopPropagation()}
                  className="text-[10px] bg-gray-800 border border-gray-700 rounded text-gray-300 py-0.5 px-1"
                >
                  <option value="todo">Todo</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
                <button
                  onClick={() => deleteTaskMutation.mutate(task.id)}
                  className="p-1 text-gray-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}

          {/* Add Task */}
          <form
            onSubmit={e => { e.preventDefault(); if (newTaskTitle.trim()) addTaskMutation.mutate(newTaskTitle.trim()); }}
            className="flex items-center gap-2 pt-2 border-t border-gray-800"
          >
            <input
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
              placeholder="Tambah task baru..."
              className="input flex-1 text-sm py-1.5"
            />
            <button
              type="submit"
              disabled={!newTaskTitle.trim() || addTaskMutation.isPending}
              className="btn-primary py-1.5"
            >
              <Plus size={14} /> Tambah
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
