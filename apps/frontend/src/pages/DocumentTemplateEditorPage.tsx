import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export function DocumentTemplateEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    name: '',
    type: 'contract',
    templateContent: ''
  });

  const { data: template, isLoading } = useQuery({
    queryKey: ['document-template', id],
    queryFn: async () => {
      const res = await api.get(`/documents/templates/${id}`);
      return res.data;
    },
    enabled: isEdit
  });

  useEffect(() => {
    if (template) {
      setForm({
        name: template.name,
        type: template.type,
        templateContent: template.templateContent
      });
    }
  }, [template]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      if (isEdit) {
        return api.put(`/documents/templates/${id}`, data);
      } else {
        return api.post('/documents/templates', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-templates'] });
      navigate('/documents');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(form);
  };

  const placeholders = [
    { label: 'Nama Klien', code: '{{client.name}}' },
    { label: 'PIC Klien', code: '{{client.picName}}' },
    { label: 'Alamat Klien', code: '{{client.address}}' },
    { label: 'Nama Perusahaan', code: '{{company.name}}' },
    { label: 'Tanggal Hari Ini', code: '{{date.today}}' },
    { label: 'No. Quotation', code: '{{quotation.number}}' },
    { label: 'Total Quotation', code: '{{quotation.total}}' },
    { label: 'No. Invoice', code: '{{invoice.number}}' },
    { label: 'Nama Project', code: '{{project.name}}' },
  ];

  if (isEdit && isLoading) return <div className="p-8 text-center text-gray-500">Memuat template...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? 'Edit Template' : 'Buat Template Baru'}
        </h1>
        <button
          onClick={() => navigate('/documents')}
          className="text-gray-500 hover:text-gray-700"
        >
          Batal
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Template</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g., Kontrak Standar v1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Dokumen</label>
                <select
                  value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value })}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="contract">Kontrak</option>
                  <option value="proposal">Proposal</option>
                  <option value="bast">BAST</option>
                  <option value="warranty">Garansi</option>
                  <option value="other">Lainnya</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-end mb-1">
                <label className="block text-sm font-medium text-gray-700">Konten Template</label>
                <span className="text-xs text-gray-500">Teks murni. Bisa pakai placeholder.</span>
              </div>
              <textarea
                required
                rows={20}
                value={form.templateContent}
                onChange={e => setForm({ ...form, templateContent: e.target.value })}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                placeholder="Tulis draf dokumen di sini..."
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {saveMutation.isPending ? 'Menyimpan...' : 'Simpan Template'}
              </button>
            </div>
          </form>
        </div>

        <div className="col-span-1">
          <div className="bg-white rounded-lg shadow p-6 sticky top-6">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Daftar Placeholder</h3>
            <p className="text-xs text-gray-500 mb-4">
              Klik pada kode untuk menyalin, lalu tempel di konten template Anda. Data akan diganti secara otomatis saat generate PDF.
            </p>
            <ul className="space-y-3">
              {placeholders.map((p, i) => (
                <li key={i} className="flex flex-col">
                  <span className="text-xs font-medium text-gray-700">{p.label}</span>
                  <button 
                    type="button"
                    onClick={() => navigator.clipboard.writeText(p.code)}
                    className="text-left font-mono text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded mt-1 hover:bg-indigo-100 transition-colors"
                  >
                    {p.code}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
