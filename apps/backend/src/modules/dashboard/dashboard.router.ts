import { Router, Response } from 'express';
import { db } from '../../db/connection.js';
import { invoices, quotations, wallets, clients } from '../../db/schema/index.js';
import { requireAuth, AuthRequest } from '../../middleware/auth.js';
import { eq, inArray, count, sql } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/dashboard/stats
 * Returns summary stats for the overview dashboard:
 *   - total clients
 *   - open quotations count (draft | sent)
 *   - unpaid/partial/overdue invoices count
 *   - total wallet balance (sum of all wallets)
 *   - recent open quotations (max 5)
 *   - recent unpaid/overdue invoices (max 5)
 */
router.get('/stats', requireAuth, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    // ── Parallel fetches ──────────────────────────────────────────────────────

    const [
      clientsCount,
      openQuotationsCount,
      unpaidInvoicesCount,
      walletRows,
      recentQuotations,
      recentInvoices,
    ] = await Promise.all([
      // Total active clients
      db
        .select({ count: count() })
        .from(clients)
        .where(eq(clients.isActive, true))
        .then((r) => r[0].count),

      // Open quotations: draft or sent
      db
        .select({ count: count() })
        .from(quotations)
        .where(inArray(quotations.status, ['draft', 'sent']))
        .then((r) => r[0].count),

      // Unpaid/partial/overdue invoices
      db
        .select({ count: count() })
        .from(invoices)
        .where(inArray(invoices.status, ['unpaid', 'partial', 'overdue']))
        .then((r) => r[0].count),

      // All wallet balances
      db.select({ balance: wallets.balance }).from(wallets),

      // Recent 5 open quotations
      db
        .select({
          id: quotations.id,
          number: quotations.number,
          clientId: quotations.clientId,
          status: quotations.status,
          total: quotations.total,
          issuedDate: quotations.issuedDate,
          validUntil: quotations.validUntil,
        })
        .from(quotations)
        .where(inArray(quotations.status, ['draft', 'sent']))
        .orderBy(sql`${quotations.createdAt} DESC`)
        .limit(5),

      // Recent 5 unpaid/overdue invoices
      db
        .select({
          id: invoices.id,
          number: invoices.number,
          clientId: invoices.clientId,
          status: invoices.status,
          total: invoices.total,
          dueDate: invoices.dueDate,
          paymentType: invoices.paymentType,
        })
        .from(invoices)
        .where(inArray(invoices.status, ['unpaid', 'partial', 'overdue']))
        .orderBy(sql`${invoices.dueDate} ASC NULLS LAST`)
        .limit(5),
    ]);

    // ── Client name lookup for quotations & invoices ───────────────────────────
    const clientIds = [
      ...new Set([
        ...recentQuotations.map((q) => q.clientId),
        ...recentInvoices.map((i) => i.clientId),
      ]),
    ];

    const clientMap: Record<string, string> = {};
    if (clientIds.length > 0) {
      const clientRows = await db
        .select({ id: clients.id, name: clients.name })
        .from(clients)
        .where(inArray(clients.id, clientIds));
      for (const c of clientRows) clientMap[c.id] = c.name;
    }

    const totalWalletBalance = walletRows.reduce(
      (sum, w) => sum + parseFloat(w.balance),
      0
    );

    res.json({
      stats: {
        totalClients: Number(clientsCount),
        openQuotations: Number(openQuotationsCount),
        unpaidInvoices: Number(unpaidInvoicesCount),
        totalWalletBalance: totalWalletBalance.toFixed(2),
      },
      recentQuotations: recentQuotations.map((q) => ({
        ...q,
        clientName: clientMap[q.clientId] ?? '—',
      })),
      recentInvoices: recentInvoices.map((i) => ({
        ...i,
        clientName: clientMap[i.clientId] ?? '—',
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dashboard stats', message: String(err) });
  }
});

export default router;
