import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Upload, Save } from 'lucide-react';
import api from '../lib/api';

interface CompanySettings {
  id: string;
  name: string;
  logoUrl: string | null;
  signatureUrl: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  taxId: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  defaultWalletCompanyPct: string;
  defaultWalletPayrollPct: string;
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const sigRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [sigPreview, setSigPreview] = useState<string | null>(null);
  const [sigFile, setSigFile] = useState<File | null>(null);

  const { data: settings, isLoading } = useQuery<CompanySettings>({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then((r) => r.data),
  });

  const [form, setForm] = useState<Partial<CompanySettings>>({});

  // Sync form when settings loaded
  const effectiveForm = { ...settings, ...form };

  const mutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      Object.entries(effectiveForm).forEach(([k, v]) => {
        if (v !== undefined && v !== null && k !== 'id' && k !== 'logoUrl' && k !== 'signatureUrl') {
          fd.append(k, String(v));
        }
      });
      if (logoFile) fd.append('logo', logoFile);
      if (sigFile) fd.append('signature', sigFile);
      return api.put('/settings', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setSuccessMsg('Pengaturan berhasil disimpan');
      setLogoFile(null);
      setSigFile(null);
      setTimeout(() => setSuccessMsg(''), 3000);
    },
    onError: () => {
      setErrorMsg('Gagal menyimpan pengaturan');
      setTimeout(() => setErrorMsg(''), 3000);
    },
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSigFile(file);
    setSigPreview(URL.createObjectURL(file));
  };

  const field = (key: keyof CompanySettings) => ({
    id: `settings-${key}`,
    className: 'input',
    value: (effectiveForm[key] ?? '') as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
  });

  const companyPct = parseFloat(effectiveForm.defaultWalletCompanyPct ?? '70');
  const payrollPct = 100 - companyPct;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Settings size={24} className="text-brand-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Pengaturan Perusahaan</h1>
          <p className="text-gray-400 text-sm">Informasi umum, rekening, dan konfigurasi dompet</p>
        </div>
      </div>

      {/* Logo */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-base font-semibold text-white">Logo Perusahaan</h2>
        </div>
        <div className="card-body flex items-center gap-6">
          <div className="w-20 h-20 rounded-xl bg-gray-800 border border-gray-700 overflow-hidden flex items-center justify-center">
            {(logoPreview ?? settings?.logoUrl) ? (
              <img src={logoPreview ?? settings?.logoUrl!} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <span className="text-gray-500 text-2xl font-bold">T</span>
            )}
          </div>
          <div>
            <button
              id="settings-logo-upload-btn"
              type="button"
              onClick={() => fileRef.current?.click()}
              className="btn-secondary"
            >
              <Upload size={16} /> Ganti Logo
            </button>
            <p className="text-xs text-gray-500 mt-1.5">PNG, JPG, SVG. Maks 5MB.</p>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
          </div>
        </div>
      </div>

      {/* Signature */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-base font-semibold text-white">Tanda Tangan Digital</h2>
          <p className="text-gray-400 text-sm mt-0.5">Akan dicetak otomatis di bagian bawah Quotation & Invoice</p>
        </div>
        <div className="card-body flex items-center gap-6">
          <div className="w-36 h-20 rounded-xl bg-gray-800 border border-gray-700 overflow-hidden flex items-center justify-center">
            {(sigPreview ?? settings?.signatureUrl) ? (
              <img
                src={sigPreview ?? `http://localhost:3001${settings?.signatureUrl}`}
                alt="Tanda Tangan"
                className="w-full h-full object-contain p-2"
              />
            ) : (
              <span className="text-gray-500 text-xs text-center px-2">Belum ada tanda tangan</span>
            )}
          </div>
          <div>
            <button
              id="settings-signature-upload-btn"
              type="button"
              onClick={() => sigRef.current?.click()}
              className="btn-secondary"
            >
              <Upload size={16} /> Upload Tanda Tangan
            </button>
            <p className="text-xs text-gray-500 mt-1.5">PNG transparan disarankan. Maks 2MB.</p>
            <input ref={sigRef} type="file" accept="image/*" onChange={handleSigChange} className="hidden" />
          </div>
        </div>
      </div>


      <div className="card">
        <div className="card-header">
          <h2 className="text-base font-semibold text-white">Informasi Perusahaan</h2>
        </div>
        <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="input-label" htmlFor="settings-name">Nama Perusahaan</label>
            <input type="text" {...field('name')} />
          </div>
          <div>
            <label className="input-label" htmlFor="settings-email">Email</label>
            <input type="email" {...field('email')} />
          </div>
          <div>
            <label className="input-label" htmlFor="settings-phone">Telepon</label>
            <input type="text" {...field('phone')} />
          </div>
          <div>
            <label className="input-label" htmlFor="settings-taxId">NPWP</label>
            <input type="text" {...field('taxId')} placeholder="Opsional" />
          </div>
          <div className="md:col-span-2">
            <label className="input-label" htmlFor="settings-address">Alamat</label>
            <textarea
              id="settings-address"
              className="input"
              rows={3}
              value={(effectiveForm.address ?? '') as string}
              onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {/* Bank info */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-base font-semibold text-white">Informasi Rekening Bank</h2>
        </div>
        <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="input-label" htmlFor="settings-bankName">Nama Bank</label>
            <input type="text" {...field('bankName')} />
          </div>
          <div>
            <label className="input-label" htmlFor="settings-bankAccountNumber">Nomor Rekening</label>
            <input type="text" {...field('bankAccountNumber')} />
          </div>
          <div className="md:col-span-2">
            <label className="input-label" htmlFor="settings-bankAccountHolder">Nama Pemilik Rekening</label>
            <input type="text" {...field('bankAccountHolder')} />
          </div>
        </div>
      </div>

      {/* Wallet split */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-base font-semibold text-white">Pembagian Default Dompet</h2>
          <p className="text-gray-400 text-sm mt-0.5">Persentase default pembagian setiap pembayaran ke masing-masing dompet</p>
        </div>
        <div className="card-body space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label" htmlFor="settings-defaultWalletCompanyPct">
                Dompet Perusahaan (%)
              </label>
              <input
                id="settings-defaultWalletCompanyPct"
                type="number"
                min={0}
                max={100}
                step={0.01}
                className="input"
                value={(effectiveForm.defaultWalletCompanyPct ?? '70') as string}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setForm((prev) => ({
                    ...prev,
                    defaultWalletCompanyPct: String(val),
                    defaultWalletPayrollPct: String(100 - val),
                  }));
                }}
              />
            </div>
            <div>
              <label className="input-label" htmlFor="settings-defaultWalletPayrollPct">
                Dompet Penggajian (%)
              </label>
              <input
                id="settings-defaultWalletPayrollPct"
                type="number"
                className="input bg-gray-700/50 cursor-not-allowed"
                value={payrollPct.toFixed(2)}
                readOnly
              />
            </div>
          </div>
          {/* Visual bar */}
          <div className="h-3 rounded-full bg-gray-800 overflow-hidden flex">
            <div
              className="bg-brand-600 transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, companyPct))}%` }}
            />
            <div className="bg-purple-600 flex-1" />
          </div>
          <div className="flex gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-brand-600 rounded-full" />Perusahaan {companyPct.toFixed(0)}%</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-purple-600 rounded-full" />Penggajian {payrollPct.toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* Numbering Format Config (p6-b1) */}
      <NumberingSettingsSection />

      {/* Actions */}
      {successMsg && (
        <div className="bg-green-950/50 border border-green-900 text-green-400 text-sm px-4 py-3 rounded-lg">{successMsg}</div>
      )}
      {errorMsg && (
        <div className="bg-red-950/50 border border-red-900 text-red-400 text-sm px-4 py-3 rounded-lg">{errorMsg}</div>
      )}

      <div className="flex justify-end">
        <button
          id="settings-save-btn"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="btn-primary"
        >
          {mutation.isPending ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save size={16} />
          )}
          {mutation.isPending ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </button>
      </div>
    </div>
  );
}

interface NumberingSeq {
  id: string;
  docType: 'quotation' | 'invoice';
  prefix: string;
  format: string;
  currentSeq: number;
  year: number;
}

function NumberingSettingsSection() {
  const queryClient = useQueryClient();
  const [numSuccess, setNumSuccess] = useState('');
  const [numError, setNumError] = useState('');

  const { data: sequences = [], isLoading } = useQuery<NumberingSeq[]>({
    queryKey: ['numbering-sequences'],
    queryFn: () => api.get('/settings/numbering').then((r) => r.data),
  });

  const [localSeqs, setLocalSeqs] = useState<Record<string, { prefix: string; format: string }>>({});

  const updateMutation = useMutation({
    mutationFn: async ({ docType, prefix, format }: { docType: string; prefix: string; format: string }) => {
      return api.patch(`/settings/numbering/${docType}`, { prefix, format });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['numbering-sequences'] });
      setNumSuccess('Format penomoran berhasil diperbarui');
      setTimeout(() => setNumSuccess(''), 3000);
    },
    onError: () => {
      setNumError('Gagal memperbarui format penomoran');
      setTimeout(() => setNumError(''), 3000);
    },
  });

  if (isLoading) return null;

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="text-base font-semibold text-white">Format & Prefix Penomoran Dokumen</h2>
        <p className="text-gray-400 text-sm mt-0.5">Konfigurasi prefix dan pola penomoran otomatis untuk Quotation dan Invoice</p>
      </div>
      <div className="card-body space-y-6">
        {sequences.map((seq) => {
          const currentPrefix = localSeqs[seq.docType]?.prefix ?? seq.prefix;
          const currentFormat = localSeqs[seq.docType]?.format ?? seq.format;
          const label = seq.docType === 'quotation' ? 'Penawaran (Quotation)' : 'Faktur (Invoice)';

          const yearStr = new Date().getFullYear().toString();
          const monthStr = (new Date().getMonth() + 1).toString().padStart(2, '0');
          const sampleSeq = (seq.currentSeq + 1).toString().padStart(3, '0');
          const preview = currentFormat
            .replace('{PREFIX}', currentPrefix)
            .replace('{YEAR}', yearStr)
            .replace('{MONTH}', monthStr)
            .replace('{SEQ}', sampleSeq);

          return (
            <div key={seq.id} className="p-4 rounded-xl bg-gray-800/40 border border-gray-700/60 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-white text-sm">{label}</h3>
                <span className="text-xs text-gray-400 font-mono">Sequence Saat Ini: #{seq.currentSeq}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="input-label" htmlFor={`num-prefix-${seq.docType}`}>Prefix</label>
                  <input
                    id={`num-prefix-${seq.docType}`}
                    type="text"
                    className="input uppercase"
                    value={currentPrefix}
                    onChange={(e) =>
                      setLocalSeqs((prev) => ({
                        ...prev,
                        [seq.docType]: { prefix: e.target.value.toUpperCase(), format: currentFormat },
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="input-label" htmlFor={`num-format-${seq.docType}`}>Pola Format</label>
                  <input
                    id={`num-format-${seq.docType}`}
                    type="text"
                    className="input font-mono"
                    value={currentFormat}
                    onChange={(e) =>
                      setLocalSeqs((prev) => ({
                        ...prev,
                        [seq.docType]: { prefix: currentPrefix, format: e.target.value },
                      }))
                    }
                  />
                  <p className="text-[11px] text-gray-500 mt-1">Variabel: &#123;PREFIX&#125;, &#123;YEAR&#125;, &#123;MONTH&#125;, &#123;SEQ&#125;</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-700/40">
                <div className="text-xs">
                  <span className="text-gray-400">Preview Nomor Berikutnya: </span>
                  <span className="font-mono text-brand-400 font-bold ml-1">{preview}</span>
                </div>
                <button
                  type="button"
                  id={`num-save-${seq.docType}`}
                  onClick={() => updateMutation.mutate({ docType: seq.docType, prefix: currentPrefix, format: currentFormat })}
                  disabled={updateMutation.isPending}
                  className="btn-secondary py-1 text-xs"
                >
                  Simpan Format
                </button>
              </div>
            </div>
          );
        })}

        {numSuccess && <div className="bg-green-950/50 border border-green-900 text-green-400 text-xs px-3 py-2 rounded-lg">{numSuccess}</div>}
        {numError && <div className="bg-red-950/50 border border-red-900 text-red-400 text-xs px-3 py-2 rounded-lg">{numError}</div>}
      </div>
    </div>
  );
}

