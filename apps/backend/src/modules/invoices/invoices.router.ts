import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import { invoices, invoiceItems, invoiceInstallments, clients, quotations, payments, paymentWalletAllocations, walletTransactions, wallets } from '../../db/schema/index.js';
import { eq, ilike, and, or, desc } from 'drizzle-orm';
import { requireAuth } from '../../middleware/auth.js';
import { generateNextNumber } from '../../services/numbering.service.js';
import { generateInvoicePdf } from '../../services/pdf.service.js';
import { z } from 'zod';

const router = Router();

const invoiceItemSchema = z.object({
  refType: z.enum(['pricelist_item', 'package', 'custom']),
  refId: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  qty: z.union([z.string(), z.number()]).transform((v) => String(v)),
  unitPrice: z.union([z.string(), z.number()]).transform((v) => String(v)),
});

const installmentSchema = z.object({
  label: z.string().min(1),
  percentage: z.union([z.string(), z.number()]).transform((v) => String(v)),
  dueDate: z.string().optional().nullable(),
});

const invoiceSchema = z.object({
  quotationId: z.string().uuid().nullable().optional(),
  clientId: z.string().uuid(),
  paymentType: z.enum(['full', 'dp', 'custom']),
  issueDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  taxRate: z.union([z.string(), z.number()]).transform((v) => String(v)).default('0.00'),
  tax: z.union([z.string(), z.number()]).transform((v) => String(v)).default('0.00'),
  notes: z.string().optional().nullable(),
  items: z.array(invoiceItemSchema).min(1),
  installments: z.array(installmentSchema).min(1),
});

interface RawInvoiceItem {
  refType: 'pricelist_item' | 'package' | 'custom';
  refId?: string | null;
  name: string;
  description?: string | null;
  qty: string;
  unitPrice: string;
}

// Helper: Calculate totals
function calculateInvoiceTotals(
  items: RawInvoiceItem[],
  taxRateStr: string,
  taxStr?: string
) {
  let subtotal = 0;
  const calculatedItems = items.map((item, idx) => {
    const qty = parseFloat(item.qty);
    const unitPrice = parseFloat(item.unitPrice);
    const itemSubtotal = qty * unitPrice;
    subtotal += itemSubtotal;
    return {
      ...item,
      subtotal: itemSubtotal.toFixed(2),
      sortOrder: idx,
    };
  });

  const taxRate = parseFloat(taxRateStr || '0');
  let tax = 0;
  if (taxRate > 0) {
    tax = subtotal * (taxRate / 100);
  } else if (taxStr) {
    tax = parseFloat(taxStr || '0');
  }

  const total = subtotal + tax;

  return {
    subtotal: subtotal.toFixed(2),
    taxRate: taxRate.toFixed(2),
    tax: tax.toFixed(2),
    total: total.toFixed(2),
    items: calculatedItems,
  };
}

// GET /api/invoices
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const search = (req.query.search as string | undefined) ?? '';
    const status = req.query.status as string | undefined;
    const clientId = req.query.clientId as string | undefined;

    let query = db
      .select({
        id: invoices.id,
        number: invoices.number,
        clientId: invoices.clientId,
        clientName: clients.name,
        status: invoices.status,
        paymentType: invoices.paymentType,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        total: invoices.total,
        createdAt: invoices.createdAt,
      })
      .from(invoices)
      .innerJoin(clients, eq(invoices.clientId, clients.id))
      .$dynamic();

    const conditions = [];
    if (search) {
      conditions.push(
        or(
          ilike(invoices.number, `%${search}%`),
          ilike(clients.name, `%${search}%`)
        )!
      );
    }
    if (status) {
      conditions.push(eq(invoices.status, status));
    }
    if (clientId) {
      conditions.push(eq(invoices.clientId, clientId));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const result = await query.orderBy(desc(invoices.createdAt));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invoices', message: String(err) });
  }
});

// GET /api/invoices/:id
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [inv] = await db
      .select({
        id: invoices.id,
        number: invoices.number,
        quotationId: invoices.quotationId,
        quotationNumber: quotations.number,
        clientId: invoices.clientId,
        clientName: clients.name,
        status: invoices.status,
        paymentType: invoices.paymentType,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        subtotal: invoices.subtotal,
        tax: invoices.tax,
        total: invoices.total,
        notes: invoices.notes,
        createdAt: invoices.createdAt,
        updatedAt: invoices.updatedAt,
      })
      .from(invoices)
      .innerJoin(clients, eq(invoices.clientId, clients.id))
      .leftJoin(quotations, eq(invoices.quotationId, quotations.id))
      .where(eq(invoices.id, req.params.id as string));

    if (!inv) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    const items = await db
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, inv.id))
      .orderBy(invoiceItems.sortOrder);

    const installments = await db
      .select()
      .from(invoiceInstallments)
      .where(eq(invoiceInstallments.invoiceId, inv.id))
      .orderBy(invoiceInstallments.sequence);

    res.json({ ...inv, items, installments });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invoice', message: String(err) });
  }
});

// POST /api/invoices — create a new invoice
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parsed = invoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { subtotal, taxRate, tax, total, items } = calculateInvoiceTotals(
    parsed.data.items,
    parsed.data.taxRate,
    parsed.data.tax
  );

  // Validate installments sum to exactly 100%
  const totalPercentage = parsed.data.installments.reduce(
    (sum, inst) => sum + parseFloat(inst.percentage),
    0
  );

  if (Math.abs(totalPercentage - 100) > 0.01) {
    res.status(400).json({
      error: `Validation failed: Installment percentages must sum to exactly 100%. Current sum: ${totalPercentage}%`,
    });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      // Generate unique invoice number transaksional
      const number = await generateNextNumber('invoice');

      const [newInv] = await tx
        .insert(invoices)
        .values({
          number,
          quotationId: parsed.data.quotationId || null,
          clientId: parsed.data.clientId,
          status: 'unpaid',
          paymentType: parsed.data.paymentType,
          issueDate: parsed.data.issueDate || null,
          dueDate: parsed.data.dueDate || null,
          subtotal,
          taxRate,
          tax,
          total,
          notes: parsed.data.notes || null,
        })
        .returning();

      // Insert all invoice items
      await tx.insert(invoiceItems).values(
        items.map((item) => ({
          invoiceId: newInv.id,
          refType: item.refType,
          refId: item.refId || null,
          name: item.name,
          description: item.description || null,
          qty: item.qty,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
          sortOrder: item.sortOrder,
        }))
      );

      // Insert installments with calculated amounts
      const totalNum = parseFloat(total);
      await tx.insert(invoiceInstallments).values(
        parsed.data.installments.map((inst, idx) => {
          const pct = parseFloat(inst.percentage);
          const amount = (pct / 100) * totalNum;
          return {
            invoiceId: newInv.id,
            sequence: idx + 1,
            label: inst.label,
            percentage: inst.percentage,
            amount: amount.toFixed(2),
            dueDate: inst.dueDate || null,
            status: 'pending',
          };
        })
      );

      // If created from quotation, mark quotation as accepted
      if (parsed.data.quotationId) {
        await tx
          .update(quotations)
          .set({ status: 'accepted', updatedAt: new Date() })
          .where(eq(quotations.id, parsed.data.quotationId));
      }

      return newInv;
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create invoice', message: String(err) });
  }
});

// PATCH /api/invoices/:id/status — transition invoice status manually
router.patch('/:id/status', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const statusSchema = z.object({
    status: z.enum(['unpaid', 'partial', 'paid', 'overdue', 'cancelled']),
  });

  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid status value', details: parsed.error.flatten() });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, req.params.id as string));

    if (!existing) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    const [updated] = await db
      .update(invoices)
      .set({ status: parsed.data.status, updatedAt: new Date() })
      .where(eq(invoices.id, existing.id))
      .returning();

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update invoice status', message: String(err) });
  }
});

// DELETE /api/invoices/:id
router.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [existing] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, req.params.id as string));

    if (!existing) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    // Only allow deletion if unpaid or cancelled to protect audit trails
    if (existing.status !== 'unpaid' && existing.status !== 'cancelled') {
      res.status(400).json({
        error: `Cannot delete invoice with status "${existing.status}". Only unpaid or cancelled invoices can be deleted.`,
      });
      return;
    }

    await db.transaction(async (tx) => {
      // 1. Fetch all payments linked to this invoice
      const invoicePayments = await tx
        .select()
        .from(payments)
        .where(eq(payments.invoiceId, existing.id));

      for (const pay of invoicePayments) {
        // Fetch all allocations for this payment
        const allocations = await tx
          .select()
          .from(paymentWalletAllocations)
          .where(eq(paymentWalletAllocations.paymentId, pay.id));

        for (const alloc of allocations) {
          // Lock and retrieve the wallet
          const [w] = await tx
            .select()
            .from(wallets)
            .where(eq(wallets.id, alloc.walletId))
            .for('update');

          if (w) {
            const currentBal = parseFloat(w.balance);
            const allocAmt = parseFloat(alloc.amount);
            const restoredBal = Math.max(0, currentBal - allocAmt);

            // Rollback wallet balance
            await tx
              .update(wallets)
              .set({ balance: restoredBal.toFixed(2) })
              .where(eq(wallets.id, w.id));
          }
        }

        // Delete wallet transactions related to this payment
        await tx.delete(walletTransactions).where(eq(walletTransactions.paymentId, pay.id));

        // Delete payment wallet allocations
        await tx.delete(paymentWalletAllocations).where(eq(paymentWalletAllocations.paymentId, pay.id));

        // Delete payment itself
        await tx.delete(payments).where(eq(payments.id, pay.id));
      }

      // 2. Delete the invoice itself (cascades down to invoiceItems and invoiceInstallments)
      await tx.delete(invoices).where(eq(invoices.id, existing.id));
    });
    res.json({ message: 'Deleted successfully', id: existing.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete invoice', message: String(err) });
  }
});

// GET /api/invoices/:id/pdf — streaming PDF generation on-demand
router.get('/:id/pdf', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [inv] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, req.params.id as string));

    if (!inv) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, inv.clientId));

    const items = await db
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, inv.id))
      .orderBy(invoiceItems.sortOrder);

    const installments = await db
      .select()
      .from(invoiceInstallments)
      .where(eq(invoiceInstallments.invoiceId, inv.id))
      .orderBy(invoiceInstallments.sequence);

    await generateInvoicePdf(res, inv, items, installments, client);
  } catch (err) {
    console.error('Invoice PDF Generation Error:', err);
    res.status(500).json({ error: 'Failed to generate PDF', message: String(err) });
  }
});

export default router;
