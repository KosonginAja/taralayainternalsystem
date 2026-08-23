import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import { invoices, payments, expenses, payrollEntries, projects, projectTasks, walletTransactions, wallets } from '../../db/schema/index.js';
import { eq, and, gte, lte, sql, desc, count } from 'drizzle-orm';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// ─── Helper: parse period (default to current year) ─────────────────────────
function getPeriodRange(query: Record<string, any>) {
  const year = parseInt(String(query.year || new Date().getFullYear()));
  const month = query.month ? parseInt(String(query.month)) : null;
  let from: string, to: string;
  if (month) {
    const d = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0).getDate();
    from = `${year}-${String(month).padStart(2, '0')}-01`;
    to   = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  } else {
    from = `${year}-01-01`;
    to   = `${year}-12-31`;
  }
  return { from, to, year, month };
}

// ─── p11-b1: Revenue & Profit ────────────────────────────────────────────────
// GET /api/reports/revenue?year=YYYY&month=MM
router.get('/revenue', async (req: Request, res: Response) => {
  try {
    const { from, to } = getPeriodRange(req.query as any);

    // Total paid invoice revenue in period (by issue_date)
    const revenueRows = await db
      .select({ total: sql<string>`COALESCE(SUM(${invoices.total}), 0)` })
      .from(invoices)
      .where(and(
        eq(invoices.status, 'paid'),
        gte(invoices.issueDate as any, from),
        lte(invoices.issueDate as any, to),
      ));
    const revenue = Number(revenueRows[0]?.total ?? 0);

    // Expenses in period
    const expenseRows = await db
      .select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
      .from(expenses)
      .where(and(
        gte(expenses.date as any, from),
        lte(expenses.date as any, to),
      ));
    const totalExpenses = Number(expenseRows[0]?.total ?? 0);

    // Payroll paid in period
    const payrollRows = await db
      .select({ total: sql<string>`COALESCE(SUM(${payrollEntries.netPay}), 0)` })
      .from(payrollEntries)
      .where(and(
        eq(payrollEntries.status, 'paid'),
        gte(payrollEntries.paidAt as any, from),
        lte(payrollEntries.paidAt as any, to),
      ));
    const totalPayroll = Number(payrollRows[0]?.total ?? 0);

    const totalOutflows = totalExpenses + totalPayroll;
    const profit = revenue - totalOutflows;
    const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;

    res.json({
      period: { from, to },
      revenue,
      totalExpenses,
      totalPayroll,
      totalOutflows,
      profit,
      marginPct: parseFloat(marginPct.toFixed(2)),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch revenue report', message: String(err) });
  }
});

// GET /api/reports/revenue/monthly?year=YYYY  — monthly breakdown for chart
router.get('/revenue/monthly', async (req: Request, res: Response) => {
  try {
    const year = parseInt(String((req.query as any).year || new Date().getFullYear()));
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const results = await Promise.all(
      months.map(async (m) => {
        const from = `${year}-${String(m).padStart(2, '0')}-01`;
        const lastDay = new Date(year, m, 0).getDate();
        const to = `${year}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        const [revRow] = await db
          .select({ total: sql<string>`COALESCE(SUM(${invoices.total}), 0)` })
          .from(invoices)
          .where(and(eq(invoices.status, 'paid'), gte(invoices.issueDate as any, from), lte(invoices.issueDate as any, to)));

        const [expRow] = await db
          .select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
          .from(expenses)
          .where(and(gte(expenses.date as any, from), lte(expenses.date as any, to)));

        return {
          month: m,
          monthLabel: new Date(year, m - 1, 1).toLocaleString('id-ID', { month: 'short' }),
          revenue: Number(revRow?.total ?? 0),
          expenses: Number(expRow?.total ?? 0),
        };
      })
    );
    res.json({ year, data: results });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch monthly revenue', message: String(err) });
  }
});

// ─── p11-b2: Project completion reporting ────────────────────────────────────
// GET /api/reports/projects
router.get('/projects', async (req: Request, res: Response) => {
  try {
    // Count by status
    const statusRows = await db
      .select({
        status: projects.status,
        count: count(),
      })
      .from(projects)
      .groupBy(projects.status);

    const totalProjects = statusRows.reduce((s, r) => s + Number(r.count), 0);
    
    const statusMap = statusRows.reduce((acc, r) => {
      acc[r.status] = Number(r.count);
      return acc;
    }, {} as Record<string, number>);

    // Completed projects: avg days from created_at to updated_at (used as proxy)
    const completedRows = await db
      .select({
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .where(eq(projects.status, 'completed'));

    const avgCompletionDays = completedRows.length > 0
      ? completedRows.reduce((sum, p) => {
          const days = (new Date(p.updatedAt).getTime() - new Date(p.createdAt).getTime()) / 86400000;
          return sum + days;
        }, 0) / completedRows.length
      : 0;

    // Task completion aggregate
    const taskRows = await db
      .select({
        status: projectTasks.status,
        count: count(),
      })
      .from(projectTasks)
      .groupBy(projectTasks.status);

    const totalTasks = taskRows.reduce((s, r) => s + Number(r.count), 0);
    const doneTasks = Number(taskRows.find(r => r.status === 'done')?.count ?? 0);
    const taskCompletionPct = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;

    res.json({
      totalProjects,
      statusBreakdown: statusMap,
      avgCompletionDays: parseFloat(avgCompletionDays.toFixed(1)),
      totalTasks,
      doneTasks,
      taskCompletionPct: parseFloat(taskCompletionPct.toFixed(1)),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch project report', message: String(err) });
  }
});

// ─── p11-b3: Cash flow overview ───────────────────────────────────────────────
// GET /api/reports/cashflow?year=YYYY
router.get('/cashflow', async (req: Request, res: Response) => {
  try {
    const year = parseInt(String((req.query as any).year || new Date().getFullYear()));
    
    // Get all wallet transactions for the year, ordered by date
    const from = `${year}-01-01T00:00:00Z`;
    const to = `${year}-12-31T23:59:59Z`;

    const txRows = await db
      .select({
        type: walletTransactions.type,
        amount: walletTransactions.amount,
        balanceAfter: walletTransactions.balanceAfter,
        createdAt: walletTransactions.createdAt,
      })
      .from(walletTransactions)
      .where(and(
        gte(walletTransactions.createdAt, new Date(from)),
        lte(walletTransactions.createdAt, new Date(to)),
      ))
      .orderBy(walletTransactions.createdAt);

    // Group by month
    const monthlyFlow: Record<number, { inflow: number; outflow: number }> = {};
    for (let m = 1; m <= 12; m++) {
      monthlyFlow[m] = { inflow: 0, outflow: 0 };
    }

    for (const tx of txRows) {
      const m = new Date(tx.createdAt).getMonth() + 1;
      if (tx.type === 'in') {
        monthlyFlow[m].inflow += Number(tx.amount);
      } else {
        monthlyFlow[m].outflow += Number(tx.amount);
      }
    }

    // Current total balance (sum all wallets)
    const balanceRows = await db
      .select({ total: sql<string>`COALESCE(SUM(${wallets.balance}), 0)` })
      .from(wallets);
    const totalBalance = Number(balanceRows[0]?.total ?? 0);

    const data = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      return {
        month: m,
        monthLabel: new Date(year, m - 1, 1).toLocaleString('id-ID', { month: 'short' }),
        inflow: monthlyFlow[m].inflow,
        outflow: monthlyFlow[m].outflow,
        net: monthlyFlow[m].inflow - monthlyFlow[m].outflow,
      };
    });

    res.json({ year, totalBalance, data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch cashflow report', message: String(err) });
  }
});

// ─── Summary: combined dashboard KPIs ────────────────────────────────────────
// GET /api/reports/summary
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to   = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    // Revenue this month
    const [revRow] = await db
      .select({ total: sql<string>`COALESCE(SUM(${invoices.total}), 0)` })
      .from(invoices)
      .where(and(eq(invoices.status, 'paid'), gte(invoices.issueDate as any, from), lte(invoices.issueDate as any, to)));
    const revenueThisMonth = Number(revRow?.total ?? 0);

    // Outstanding (unpaid + partial)
    const [outstRow] = await db
      .select({ total: sql<string>`COALESCE(SUM(${invoices.total}), 0)` })
      .from(invoices)
      .where(sql`${invoices.status} IN ('unpaid', 'partial', 'overdue')`);
    const outstandingAmount = Number(outstRow?.total ?? 0);

    // Active projects
    const [activeRow] = await db
      .select({ count: count() })
      .from(projects)
      .where(sql`${projects.status} IN ('in_progress', 'review', 'not_started')`);
    const activeProjects = Number(activeRow?.count ?? 0);

    // Expenses this month
    const [expRow] = await db
      .select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
      .from(expenses)
      .where(and(gte(expenses.date as any, from), lte(expenses.date as any, to)));
    const expensesThisMonth = Number(expRow?.total ?? 0);

    // Total wallet balance
    const [balRow] = await db
      .select({ total: sql<string>`COALESCE(SUM(${wallets.balance}), 0)` })
      .from(wallets);
    const totalWalletBalance = Number(balRow?.total ?? 0);

    // Overdue invoices count
    const [overdueRow] = await db
      .select({ count: count() })
      .from(invoices)
      .where(sql`${invoices.status} IN ('unpaid', 'partial') AND ${invoices.dueDate} < CURRENT_DATE`);
    const overdueCount = Number(overdueRow?.count ?? 0);

    res.json({
      period: { year, month, from, to },
      revenueThisMonth,
      outstandingAmount,
      activeProjects,
      expensesThisMonth,
      totalWalletBalance,
      overdueCount,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch summary', message: String(err) });
  }
});

export default router;
