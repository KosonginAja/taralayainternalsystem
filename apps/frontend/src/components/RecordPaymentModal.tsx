import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, X, CreditCard, Percent } from 'lucide-react';
import api from '../lib/api';
import { formatRupiah } from '../lib/utils';

interface Wallet {
  id: string;
  name: string;
  type: string;
  balance: string;
}

interface CompanySettings {
  defaultWalletCompanyPct: string;
  defaultWalletPayrollPct: string;
}

interface Installment {
  id: string;
  label: string;
  sequence: number;
  percentage: string;
  amount: string;
  dueDate: string | null;
  status: 'pending' | 'paid';
}

interface RecordPaymentModalProps {
  invoiceId: string;
  invoiceNumber: string;
  installments: Installment[];
  onClose: () => void;
  onSuccess: () => void;
}

export function RecordPaymentModal({
  invoiceId,
  invoiceNumber,
  installments,
  onClose,
  onSuccess,
}: RecordPaymentModalProps) {
  const queryClient = useQueryClient();
  const pendingInstallments = installments.filter((i) => i.status === 'pending');

  const [selectedInstallmentId, setSelectedInstallmentId] = useState(
    pendingInstallments[0]?.id ?? ''
  );
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [method, setMethod] = useState('transfer');
  const [notes, setNotes] = useState('');
  const [customSplit, setCustomSplit] = useState(false);
  const [splits, setSplits] = useState<Array<{ walletId: string; name: string; percentage: string }>>([]);
  const [error, setError] = useState('');

  const { data: wallets = [] } = useQuery<Wallet[]>({
    queryKey: ['wallets'],
    queryFn: () => api.get('/payments/wallets').then((r) => r.data),
  });

  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then((r) => r.data),
  });

  // Pre-fill amount and splits when installment/settings change
  useEffect(() => {
    const inst = pendingInstallments.find((i) => i.id === selectedInstallmentId);
    if (inst) {
      setAmount(parseFloat(inst.amount).toFixed(0));
    }
  }, [selectedInstallmentId]);

  useEffect(() => {
    if (wallets.length > 0 && settings) {
      const compWallet = wallets.find((w) => w.type === 'company');
      const payWallet = wallets.find((w) => w.type === 'payroll');
      const newSplits = [];
      if (compWallet) newSplits.push({
        walletId: compWallet.id,
        name: compWallet.name,
        percentage: settings.defaultWalletCompanyPct,
      });
      if (payWallet) newSplits.push({
        walletId: payWallet.id,
        name: payWallet.name,
        percentage: settings.defaultWalletPayrollPct,
      });
      setSplits(newSplits);
    }
  }, [wallets, settings]);

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/payments', {
        invoiceId,
        installmentId: selectedInstallmentId,
        amount,
        paymentDate,
        method,
        notes: notes || null,
        walletSplit: customSplit ? splits.map((s) => ({ walletId: s.walletId, percentage: s.percentage })) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-detail'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      onSuccess();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Gagal merekam pembayaran');
    },
  });

  const totalSplitPct = splits.reduce((sum, s) => sum + (parseFloat(s.percentage) || 0), 0);
  const selectedInst = pendingInstallments.find((i) => i.id === selectedInstallmentId);
  const amountNum = parseFloat(amount) || 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!selectedInstallmentId) { setError('Pilih termin yang akan dibayar'); return; }
    if (!amount || parseFloat(amount) <= 0) { setError('Masukkan jumlah pembayaran yang valid'); return; }
    if (customSplit && Math.abs(totalSplitPct - 100) > 0.01) {
      setError(`Total persentase split harus 100%. Sekarang: ${totalSplitPct.toFixed(1)}%`);
      return;
    }
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700/80 rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <CreditCard size={17} className="text-brand-400" />
              Rekam Pembayaran
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Invoice: {invoiceNumber}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Installment Picker */}
          <div>
            <label className="input-label">Termin yang Dibayar *</label>
            {pendingInstallments.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Semua termin sudah lunas.</p>
            ) : (
              <div className="space-y-2">
                {pendingInstallments.map((inst) => (
                  <label
                    key={inst.id}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedInstallmentId === inst.id
                        ? 'bg-brand-950/50 border-brand-700'
                        : 'border-gray-700/60 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="installment"
                        value={inst.id}
                        checked={selectedInstallmentId === inst.id}
                        onChange={() => setSelectedInstallmentId(inst.id)}
                        className="accent-brand-500"
                        id={`inst-${inst.id}`}
                      />
                      <span className="text-sm text-gray-200 font-medium">{inst.label}</span>
                    </div>
                    <span className="text-sm text-green-400 font-mono font-semibold">
                      {formatRupiah(inst.amount)}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Amount, Date, Method */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="input-label">Jumlah Pembayaran (Rp) *</label>
              <input
                id="payment-amount"
                type="number"
                min={1}
                step={1}
                className="input font-mono"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              {selectedInst && parseFloat(amount) !== parseFloat(selectedInst.amount) && (
                <p className="text-xs text-amber-400 mt-1">
                  ⚠ Jumlah berbeda dari nominal termin ({formatRupiah(selectedInst.amount)})
                </p>
              )}
            </div>
            <div>
              <label className="input-label">Tanggal Bayar *</label>
              <input
                id="payment-date"
                type="date"
                className="input"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="input-label">Metode</label>
              <select
                id="payment-method"
                className="input"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="transfer">Transfer Bank</option>
                <option value="cash">Tunai (Cash)</option>
                <option value="qris">QRIS</option>
                <option value="cheque">Cek/Giro</option>
                <option value="other">Lainnya</option>
              </select>
            </div>
          </div>

          <div>
            <label className="input-label">Catatan (opsional)</label>
            <input
              id="payment-notes"
              type="text"
              className="input"
              placeholder="Contoh: Ref. BCA 123456..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Wallet Split Section */}
          <div className="space-y-3 bg-gray-800/30 p-4 rounded-xl border border-gray-700/60">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-200 flex items-center gap-1.5">
                <Percent size={14} className="text-brand-400" />
                Alokasi Dompet
              </p>
              <button
                type="button"
                onClick={() => setCustomSplit(!customSplit)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  customSplit
                    ? 'bg-brand-900/50 border-brand-700 text-brand-300'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                {customSplit ? 'Custom' : 'Default'}
              </button>
            </div>
            <div className="space-y-2">
              {splits.map((s) => {
                const allocAmount = (parseFloat(s.percentage) || 0) / 100 * amountNum;
                return (
                  <div key={s.walletId} className="flex items-center gap-3">
                    <span className="text-sm text-gray-300 flex-1">{s.name}</span>
                    <div className="flex items-center gap-2">
                      {customSplit ? (
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={s.percentage}
                          onChange={(e) => {
                            setSplits((prev) =>
                              prev.map((sp) =>
                                sp.walletId === s.walletId ? { ...sp, percentage: e.target.value } : sp
                              )
                            );
                          }}
                          className="input w-20 text-center text-sm py-1 font-mono"
                        />
                      ) : (
                        <span className="text-sm text-gray-400 font-mono w-20 text-center">
                          {parseFloat(s.percentage).toFixed(0)}%
                        </span>
                      )}
                      <span className="text-sm text-green-400 font-mono w-28 text-right">
                        {formatRupiah(allocAmount)}
                      </span>
                    </div>
                  </div>
                );
              })}
              {customSplit && Math.abs(totalSplitPct - 100) > 0.01 && (
                <p className="text-xs text-red-400 text-right">
                  Total: {totalSplitPct.toFixed(1)}% (harus 100%)
                </p>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-950/50 border border-red-900/60 text-red-400 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
              <AlertCircle size={15} /> {error}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">
              Batal
            </button>
            <button
              id="record-payment-submit"
              type="submit"
              disabled={mutation.isPending || pendingInstallments.length === 0}
              className="btn-primary"
            >
              {mutation.isPending ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
              ) : (
                <CreditCard size={14} />
              )}
              Konfirmasi Bayar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
