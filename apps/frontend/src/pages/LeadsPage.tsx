import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Plus, Mail, Phone, Building, Calendar, Edit3, Trash2, CheckCircle, FileText } from 'lucide-react';
import api from '../lib/api';
import { formatDate } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal_sent' | 'won' | 'lost';

const STATUS_COLUMNS: { id: LeadStatus; label: string; color: string }[] = [
  { id: 'new', label: 'Baru Masuk', color: 'bg-blue-900/50 border-blue-500/30 text-blue-400' },
  { id: 'contacted', label: 'Dihubungi', color: 'bg-indigo-900/50 border-indigo-500/30 text-indigo-400' },
  { id: 'qualified', label: 'Prospek Bagus', color: 'bg-emerald-900/50 border-emerald-500/30 text-emerald-400' },
  { id: 'proposal_sent', label: 'Proposal Dikirim', color: 'bg-amber-900/50 border-amber-500/30 text-amber-400' },
  { id: 'won', label: 'Goal / Closing', color: 'bg-green-900/50 border-green-500/30 text-green-400' },
  { id: 'lost', label: 'Lepas / Batal', color: 'bg-red-900/50 border-red-500/30 text-red-400' },
];

interface Lead {
  id: string;
  name: string;
  company: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  source: string | null;
  status: LeadStatus;
  notes: string | null;
  convertedQuotationId: string | null;
  createdAt: string;
}

export function LeadsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);

  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ['leads'],
    queryFn: () => api.get('/leads').then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/leads/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string, status: LeadStatus }) => api.put(`/leads/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  });

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData('leadId', leadId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, status: LeadStatus) => {
    const leadId = e.dataTransfer.getData('leadId');
    const lead = leads.find(l => l.id === leadId);
    if (lead && lead.status !== status) {
      updateStatusMutation.mutate({ id: leadId, status });
    }
  };

  const handleConvertToQuotation = async (lead: Lead) => {
    try {
      // 1. Create a client from lead data
      const clientPayload = {
        name: lead.company || lead.name,
        picName: lead.company ? lead.name : '',
        email: lead.contactEmail || '',
        phone: lead.contactPhone || '',
        address: '',
      };
      
      const res = await api.post('/clients', clientPayload);
      const newClientId = res.data.id;
      
      // 2. Navigate to quotation builder
      navigate(`/quotations/new?leadId=${lead.id}&clientId=${newClientId}`);
    } catch (err) {
      alert('Gagal membuat klien dari lead ini.');
    }
  };

  if (isLoading) return <div className="p-8 text-center text-gray-400">Memuat pipeline...</div>;

  return (
    <div className="flex flex-col h-full -m-6 p-6">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400">
            <Megaphone size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Lead Pipeline</h1>
            <p className="text-gray-400 text-sm">Pantau dan kelola prospek klien</p>
          </div>
        </div>
        <button onClick={() => setIsAddOpen(true)} className="btn-primary">
          <Plus size={16} /> Tambah Lead
        </button>
      </div>

      <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
        {STATUS_COLUMNS.map((col) => (
          <div
            key={col.id}
            className="flex-1 min-w-[300px] flex flex-col bg-gray-900/50 rounded-xl border border-gray-800"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            <div className={`px-4 py-3 border-b border-gray-800 rounded-t-xl text-sm font-semibold uppercase tracking-wider ${col.color}`}>
              {col.label} ({leads.filter(l => l.status === col.id).length})
            </div>
            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              {leads.filter(l => l.status === col.id).map(lead => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, lead.id)}
                  className="bg-gray-800 border border-gray-700 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-gray-600 transition-colors group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-white text-sm truncate pr-2">{lead.name}</h4>
                    <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditLead(lead)} className="p-1 text-gray-400 hover:text-white">
                        <Edit3 size={14} />
                      </button>
                      <button onClick={() => { if(confirm('Hapus lead?')) deleteMutation.mutate(lead.id) }} className="p-1 text-gray-400 hover:text-red-400">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  
                  {lead.company && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1 truncate">
                      <Building size={12} className="shrink-0" /> {lead.company}
                    </div>
                  )}
                  {lead.contactPhone && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1 truncate">
                      <Phone size={12} className="shrink-0" /> {lead.contactPhone}
                    </div>
                  )}
                  {lead.source && (
                    <div className="text-[10px] bg-gray-900 text-gray-300 px-1.5 py-0.5 rounded inline-block mb-2 mt-1">
                      {lead.source}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-700">
                    <span className="text-[10px] text-gray-500">{formatDate(lead.createdAt)}</span>
                    
                    {col.id !== 'won' && col.id !== 'lost' && (
                      <button
                        onClick={() => handleConvertToQuotation(lead)}
                        className="text-[10px] font-medium text-emerald-400 bg-emerald-950/30 px-2 py-1 rounded hover:bg-emerald-950/60 transition-colors flex items-center gap-1"
                      >
                        <FileText size={10} /> Buat Quotation
                      </button>
                    )}
                    {col.id === 'won' && lead.convertedQuotationId && (
                      <span className="text-[10px] text-emerald-500 flex items-center gap-1">
                        <CheckCircle size={10} /> Converted
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {(isAddOpen || editLead) && (
        <LeadModal
          lead={editLead}
          onClose={() => { setIsAddOpen(false); setEditLead(null); }}
          onSuccess={() => {
            setIsAddOpen(false); setEditLead(null);
            queryClient.invalidateQueries({ queryKey: ['leads'] });
          }}
        />
      )}
    </div>
  );
}

function LeadModal({ lead, onClose, onSuccess }: { lead: Lead | null, onClose: () => void, onSuccess: () => void }) {
  const [form, setForm] = useState({
    name: lead?.name || '',
    company: lead?.company || '',
    contactEmail: lead?.contactEmail || '',
    contactPhone: lead?.contactPhone || '',
    source: lead?.source || '',
    notes: lead?.notes || '',
    status: lead?.status || 'new',
  });
  const [error, setError] = useState('');

  const saveMutation = useMutation({
    mutationFn: (data: any) => lead ? api.put(`/leads/${lead.id}`, data) : api.post('/leads', data),
    onSuccess,
    onError: (err: any) => setError(err.response?.data?.error || 'Gagal menyimpan lead'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="font-bold text-white">{lead ? 'Edit Lead' : 'Tambah Lead Baru'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </div>
        <form
          onSubmit={e => { e.preventDefault(); setError(''); saveMutation.mutate(form); }}
          className="p-6 space-y-4"
        >
          {error && <div className="p-3 bg-red-900/30 border border-red-800 rounded text-red-300 text-sm">{error}</div>}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Nama Prospek</label>
              <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Perusahaan / Brand</label>
              <input value={form.company} onChange={e => setForm({...form, company: e.target.value})} className="input w-full" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">No. WhatsApp/HP</label>
              <input value={form.contactPhone} onChange={e => setForm({...form, contactPhone: e.target.value})} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Email</label>
              <input type="email" value={form.contactEmail} onChange={e => setForm({...form, contactEmail: e.target.value})} className="input w-full" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Sumber (Source)</label>
              <input value={form.source} onChange={e => setForm({...form, source: e.target.value})} placeholder="Instagram, Referensi..." className="input w-full" />
            </div>
            {lead && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Status</label>
                <select value={form.status} onChange={e => setForm({...form, status: e.target.value as any})} className="input w-full">
                  {STATUS_COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Catatan</label>
            <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="input w-full h-20 resize-none"></textarea>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
            <button type="button" onClick={onClose} className="btn-secondary">Batal</button>
            <button type="submit" disabled={saveMutation.isPending} className="btn-primary">
              {saveMutation.isPending ? 'Menyimpan...' : 'Simpan Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
