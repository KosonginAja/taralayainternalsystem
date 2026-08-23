import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

interface GenerateDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  contextType: 'quotation' | 'invoice' | 'project' | 'client';
  contextId: string;
}

export function GenerateDocumentModal({ isOpen, onClose, contextType, contextId }: GenerateDocumentModalProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: templates, isLoading } = useQuery({
    queryKey: ['document-templates'],
    queryFn: async () => {
      const res = await api.get('/documents/templates');
      return res.data;
    },
    enabled: isOpen
  });

  const handleGenerate = async () => {
    if (!selectedTemplateId) return;
    setIsGenerating(true);
    try {
      // Because we stream PDF, we can't just use standard api.post with JSON response.
      // We need to fetch as blob.
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/documents/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` // Adjust based on your auth
        },
        body: JSON.stringify({
          templateId: selectedTemplateId,
          contextType,
          contextId
        })
      });

      if (!res.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      onClose();
    } catch (err) {
      alert('Gagal menghasilkan dokumen. Periksa koneksi atau console.');
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">Generate Dokumen</h3>
        </div>
        
        <div className="p-6 space-y-4">
          {isLoading ? (
            <p className="text-sm text-gray-500">Memuat template...</p>
          ) : templates?.length === 0 ? (
            <p className="text-sm text-gray-500">Belum ada template yang dibuat. Buat di menu Dokumen.</p>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Template</label>
              <select
                value={selectedTemplateId}
                onChange={e => setSelectedTemplateId(e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="" disabled>-- Pilih Template --</option>
                {templates?.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.type})</option>
                ))}
              </select>
              <p className="mt-2 text-xs text-gray-500">
                Data {contextType} saat ini akan dimasukkan ke dalam placeholder secara otomatis.
              </p>
            </div>
          )}
        </div>
        
        <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Batal
          </button>
          <button
            onClick={handleGenerate}
            disabled={!selectedTemplateId || isGenerating}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {isGenerating ? 'Memproses...' : 'Generate PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
