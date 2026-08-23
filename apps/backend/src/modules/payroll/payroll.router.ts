import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import { payrollEntries, users, wallets, walletTransactions } from '../../db/schema/index.js';
import { eq, desc, and } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { z } from 'zod';

const router = Router();

router.use(requireAuth, requireAdmin);

// GET /api/payroll?period=2026-08
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const period = req.query.period as string;
  try {
    let query = db
      .select({
        id: payrollEntries.id,
        userId: payrollEntries.userId,
        userName: users.name,
        userRole: users.role,
        period: payrollEntries.period,
        baseSalary: payrollEntries.baseSalary,
        commissions: payrollEntries.commissions,
        bonuses: payrollEntries.bonuses,
        deductions: payrollEntries.deductions,
        netPay: payrollEntries.netPay,
        status: payrollEntries.status,
        paidAt: payrollEntries.paidAt,
        notes: payrollEntries.notes,
      })
      .from(payrollEntries)
      .leftJoin(users, eq(payrollEntries.userId, users.id));

    if (period) {
      query = query.where(eq(payrollEntries.period, period)) as any;
    }

    const rows = await query.orderBy(desc(payrollEntries.createdAt));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payroll', message: String(err) });
  }
});

// POST /api/payroll
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    userId: z.string().uuid(),
    period: z.string(),
    baseSalary: z.string().or(z.number()),
    commissions: z.string().or(z.number()).default(0),
    bonuses: z.string().or(z.number()).default(0),
    deductions: z.string().or(z.number()).default(0),
    notes: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { userId, period, baseSalary, commissions, bonuses, deductions, notes } = parsed.data;
  const netPay = (Number(baseSalary) + Number(commissions) + Number(bonuses) - Number(deductions)).toFixed(2);

  try {
    // Check if already exists for this period
    const existing = await db
      .select()
      .from(payrollEntries)
      .where(and(eq(payrollEntries.userId, userId), eq(payrollEntries.period, period)));

    if (existing.length > 0) {
      res.status(400).json({ error: 'Payroll entry already exists for this user and period' });
      return;
    }

    const [newEntry] = await db.insert(payrollEntries).values({
      userId,
      period,
      baseSalary: String(baseSalary),
      commissions: String(commissions),
      bonuses: String(bonuses),
      deductions: String(deductions),
      netPay: String(netPay),
      status: 'draft',
      notes: notes ?? null,
    }).returning();

    res.status(201).json(newEntry);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create payroll', message: String(err) });
  }
});

// POST /api/payroll/:id/pay
router.post('/:id/pay', async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    walletId: z.string().uuid(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const { walletId } = parsed.data;
    const [entry] = await db.select().from(payrollEntries).where(eq(payrollEntries.id, req.params.id as string));
    
    if (!entry) { res.status(404).json({ error: 'Payroll not found' }); return; }
    if (entry.status === 'paid') { res.status(400).json({ error: 'Already paid' }); return; }

    const [wallet] = await db.select().from(wallets).where(eq(wallets.id, walletId));
    if (!wallet) { res.status(404).json({ error: 'Wallet not found' }); return; }

    if (Number(wallet.balance) < Number(entry.netPay)) {
      res.status(400).json({ error: 'Insufficient wallet balance' });
      return;
    }

    await db.transaction(async (tx) => {
      const newBalance = (Number(wallet.balance) - Number(entry.netPay)).toFixed(2);
      
      // Get user name for description
      const [user] = await tx.select().from(users).where(eq(users.id, entry.userId as string));
      const userName = user?.name || 'Karyawan';

      // Create transaction
      const [trx] = await tx.insert(walletTransactions).values({
        walletId,
        type: 'out',
        amount: entry.netPay,
        balanceAfter: newBalance,
        description: `Penggajian periode ${entry.period} (${userName})`,
      }).returning();

      // Deduct wallet
      await tx.update(wallets).set({ balance: newBalance }).where(eq(wallets.id, wallet.id as string));

      // Mark paid
      await tx.update(payrollEntries).set({
        status: 'paid',
        transactionId: trx.id,
        paidAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(payrollEntries.id, entry.id as string));
    });

    res.json({ message: 'Payroll marked as paid successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process payroll', message: String(err) });
  }
});

// DELETE /api/payroll/:id
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const [entry] = await db.select().from(payrollEntries).where(eq(payrollEntries.id, req.params.id as string));
    if (!entry) { res.status(404).json({ error: 'Payroll not found' }); return; }
    if (entry.status === 'paid') { res.status(400).json({ error: 'Cannot delete paid payroll' }); return; }

    await db.delete(payrollEntries).where(eq(payrollEntries.id, req.params.id as string));
    res.json({ message: 'Payroll deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete payroll', message: String(err) });
  }
});

export default router;
