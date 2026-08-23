import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import {
  payments,
  paymentWalletAllocations,
  walletTransactions,
  wallets,
  invoices,
  invoiceInstallments,
  companySettings,
  clients,
} from '../../db/schema/index.js';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth } from '../../middleware/auth.js';
import { z } from 'zod';

const router = Router();

const walletSplitSchema = z.object({
  walletId: z.string().uuid(),
  percentage: z.union([z.string(), z.number()]).transform((v) => String(v)),
});

const recordPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  installmentId: z.string().uuid(),
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
  paymentDate: z.string(),
  method: z.string().optional().nullable().default('transfer'),
  notes: z.string().optional().nullable(),
  walletSplit: z.array(walletSplitSchema).optional(),
});

// GET /api/payments — list all payments recorded
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await db
      .select({
        id: payments.id,
        invoiceId: payments.invoiceId,
        invoiceNumber: invoices.number,
        clientName: clients.name,
        installmentId: payments.installmentId,
        installmentLabel: invoiceInstallments.label,
        amount: payments.amount,
        paymentDate: payments.paymentDate,
        method: payments.method,
        notes: payments.notes,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
      .innerJoin(clients, eq(invoices.clientId, clients.id))
      .innerJoin(invoiceInstallments, eq(payments.installmentId, invoiceInstallments.id))
      .orderBy(desc(payments.createdAt));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payments', message: String(err) });
  }
});

// POST /api/payments — record payment and allocate to wallets (p5-b2 and p5-b3)
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parsed = recordPaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const paymentAmountNum = parseFloat(parsed.data.amount);

  try {
    const result = await db.transaction(async (tx) => {
      // 1. Lock installment & check if already paid
      const [inst] = await tx
        .select()
        .from(invoiceInstallments)
        .where(eq(invoiceInstallments.id, parsed.data.installmentId))
        .for('update');

      if (!inst) {
        throw new Error('Installment not found');
      }
      if (inst.status === 'paid') {
        throw new Error('Installment is already paid');
      }

      // 2. Lock invoice
      const [inv] = await tx
        .select()
        .from(invoices)
        .where(eq(invoices.id, parsed.data.invoiceId))
        .for('update');

      if (!inv) {
        throw new Error('Invoice not found');
      }

      // 3. Insert Payment Row
      const [newPayment] = await tx
        .insert(payments)
        .values({
          invoiceId: parsed.data.invoiceId,
          installmentId: parsed.data.installmentId,
          amount: parsed.data.amount,
          paymentDate: parsed.data.paymentDate,
          method: parsed.data.method,
          notes: parsed.data.notes,
        })
        .returning();

      // 4. Update Installment Status to paid
      await tx
        .update(invoiceInstallments)
        .set({ status: 'paid' })
        .where(eq(invoiceInstallments.id, inst.id));

      // 5. Recompute overall invoice status
      const allInsts = await tx
        .select()
        .from(invoiceInstallments)
        .where(eq(invoiceInstallments.invoiceId, inv.id));

      const totalInstallments = allInsts.length;
      const paidInstallments = allInsts.filter((i) => i.id === inst.id ? true : i.status === 'paid').length;

      let nextInvoiceStatus: 'unpaid' | 'partial' | 'paid' = 'unpaid';
      if (paidInstallments === totalInstallments) {
        nextInvoiceStatus = 'paid';
      } else if (paidInstallments > 0) {
        nextInvoiceStatus = 'partial';
      }

      await tx
        .update(invoices)
        .set({ status: nextInvoiceStatus, updatedAt: new Date() })
        .where(eq(invoices.id, inv.id));

      // 6. Get Wallet Split Allocation
      let splits: Array<{ walletId: string; percentage: string }> = [];

      if (parsed.data.walletSplit && parsed.data.walletSplit.length > 0) {
        // Validate custom split sum to 100%
        const totalPct = parsed.data.walletSplit.reduce((sum, s) => sum + parseFloat(s.percentage), 0);
        if (Math.abs(totalPct - 100) > 0.01) {
          throw new Error(`Custom split percentage must sum to exactly 100%. Current sum: ${totalPct}%`);
        }
        splits = parsed.data.walletSplit;
      } else {
        // Fetch default from settings & default wallets
        const [settings] = await tx.select().from(companySettings).limit(1);
        const compWalletPct = settings?.defaultWalletCompanyPct ?? '70.00';
        const payWalletPct = settings?.defaultWalletPayrollPct ?? '30.00';

        const allWallets = await tx.select().from(wallets);
        const compWallet = allWallets.find((w) => w.type === 'company');
        const payWallet = allWallets.find((w) => w.type === 'payroll');

        if (!compWallet || !payWallet) {
          throw new Error('Default company or payroll wallet not found in database');
        }

        splits = [
          { walletId: compWallet.id, percentage: compWalletPct },
          { walletId: payWallet.id, percentage: payWalletPct },
        ];
      }

      // 7. Process allocations and ledger transactions
      for (const split of splits) {
        const pct = parseFloat(split.percentage);
        const allocAmount = (pct / 100) * paymentAmountNum;

        // Lock & fetch wallet
        const [w] = await tx
          .select()
          .from(wallets)
          .where(eq(wallets.id, split.walletId))
          .for('update');

        if (!w) {
          throw new Error(`Wallet with ID "${split.walletId}" not found`);
        }

        const oldBalance = parseFloat(w.balance);
        const newBalance = oldBalance + allocAmount;

        // Update Wallet Balance
        await tx
          .update(wallets)
          .set({ balance: newBalance.toFixed(2) })
          .where(eq(wallets.id, w.id));

        // Insert allocation row
        await tx.insert(paymentWalletAllocations).values({
          paymentId: newPayment.id,
          walletId: w.id,
          percentage: split.percentage,
          amount: allocAmount.toFixed(2),
        });

        // Insert Transaction Log (ledger entry)
        await tx.insert(walletTransactions).values({
          walletId: w.id,
          paymentId: newPayment.id,
          type: 'in',
          amount: allocAmount.toFixed(2),
          balanceAfter: newBalance.toFixed(2),
          description: `Alokasi pembayaran ${pct}% untuk tagihan ${inv.number} (Termin: ${inst.label})`,
        });
      }

      return newPayment;
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to record payment', message: String(err) });
  }
});

// GET /api/wallets — list wallets with balances
router.get('/wallets', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await db.select().from(wallets).orderBy(wallets.name);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch wallets', message: String(err) });
  }
});

// GET /api/wallets/:id/transactions — list ledger transactions for a wallet (p5-b5)
router.get('/wallets/:id/transactions', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await db
      .select({
        id: walletTransactions.id,
        walletId: walletTransactions.walletId,
        paymentId: walletTransactions.paymentId,
        type: walletTransactions.type,
        amount: walletTransactions.amount,
        balanceAfter: walletTransactions.balanceAfter,
        description: walletTransactions.description,
        createdAt: walletTransactions.createdAt,
        invoiceNumber: invoices.number,
      })
      .from(walletTransactions)
      .leftJoin(payments, eq(walletTransactions.paymentId, payments.id))
      .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
      .where(eq(walletTransactions.walletId, req.params.id as string))
      .orderBy(desc(walletTransactions.createdAt));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch wallet transactions', message: String(err) });
  }
});

export default router;
