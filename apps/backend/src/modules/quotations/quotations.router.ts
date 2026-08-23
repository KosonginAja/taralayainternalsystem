import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import { quotations, quotationItems, clients, projects } from '../../db/schema/index.js';
import { eq, ilike, and, or, desc } from 'drizzle-orm';
import { requireAuth } from '../../middleware/auth.js';
import { generateNextNumber } from '../../services/numbering.service.js';
import { generateQuotationPdf } from '../../services/pdf.service.js';
import { z } from 'zod';

const router = Router();

const quotationItemSchema = z.object({
  refType: z.enum(['pricelist_item', 'package', 'custom']),
  refId: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  qty: z.union([z.string(), z.number()]).transform((v) => String(v)),
  unitPrice: z.union([z.string(), z.number()]).transform((v) => String(v)),
});

const quotationSchema = z.object({
  clientId: z.string().uuid(),
  issuedDate: z.string().optional().nullable(),
  validUntil: z.string().optional().nullable(),
  discount: z.union([z.string(), z.number()]).transform((v) => String(v)).default('0.00'),
  taxRate: z.union([z.string(), z.number()]).transform((v) => String(v)).default('0.00'),
  tax: z.union([z.string(), z.number()]).transform((v) => String(v)).default('0.00'),
  notes: z.string().optional().nullable(),
  items: z.array(quotationItemSchema).min(1),
});

interface RawQuotationItem {
  refType: 'pricelist_item' | 'package' | 'custom';
  refId?: string | null;
  name: string;
  description?: string | null;
  qty: string;
  unitPrice: string;
}

// Helper: Calculate subtotals and totals based on tax percentage
function calculateQuotationTotals(
  items: RawQuotationItem[],
  discountStr: string,
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

  const discount = parseFloat(discountStr || '0');
  const dpp = Math.max(0, subtotal - discount);
  const taxRate = parseFloat(taxRateStr || '0');

  let tax = 0;
  if (taxRate > 0) {
    tax = dpp * (taxRate / 100);
  } else if (taxStr) {
    tax = parseFloat(taxStr || '0');
  }

  const total = dpp + tax;

  return {
    subtotal: subtotal.toFixed(2),
    discount: discount.toFixed(2),
    taxRate: taxRate.toFixed(2),
    tax: tax.toFixed(2),
    total: total.toFixed(2),
    items: calculatedItems,
  };
}

// GET /api/quotations
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const search = (req.query.search as string | undefined) ?? '';
    const status = req.query.status as string | undefined;
    const clientId = req.query.clientId as string | undefined;

    let query = db
      .select({
        id: quotations.id,
        number: quotations.number,
        clientId: quotations.clientId,
        clientName: clients.name,
        status: quotations.status,
        issuedDate: quotations.issuedDate,
        validUntil: quotations.validUntil,
        total: quotations.total,
        createdAt: quotations.createdAt,
        revisionOf: quotations.revisionOf,
        revisionLabel: quotations.revisionLabel,
      })
      .from(quotations)
      .innerJoin(clients, eq(quotations.clientId, clients.id))
      .$dynamic();

    const conditions = [];
    if (search) {
      conditions.push(
        or(
          ilike(quotations.number, `%${search}%`),
          ilike(clients.name, `%${search}%`)
        )!
      );
    }
    if (status) {
      conditions.push(eq(quotations.status, status));
    }
    if (clientId) {
      conditions.push(eq(quotations.clientId, clientId));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const result = await query.orderBy(desc(quotations.createdAt));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch quotations', message: String(err) });
  }
});

// GET /api/quotations/:id — with items and revision history
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [quo] = await db
      .select({
        id: quotations.id,
        number: quotations.number,
        clientId: quotations.clientId,
        clientName: clients.name,
        status: quotations.status,
        issuedDate: quotations.issuedDate,
        validUntil: quotations.validUntil,
        subtotal: quotations.subtotal,
        discount: quotations.discount,
        tax: quotations.tax,
        total: quotations.total,
        notes: quotations.notes,
        createdAt: quotations.createdAt,
        updatedAt: quotations.updatedAt,
        revisionOf: quotations.revisionOf,
        revisionLabel: quotations.revisionLabel,
      })
      .from(quotations)
      .innerJoin(clients, eq(quotations.clientId, clients.id))
      .where(eq(quotations.id, req.params.id as string));

    if (!quo) {
      res.status(404).json({ error: 'Quotation not found' });
      return;
    }

    const items = await db
      .select()
      .from(quotationItems)
      .where(eq(quotationItems.quotationId, quo.id))
      .orderBy(quotationItems.sortOrder);

    // Fetch revision chain: find all quotations that share the same origin or are revisions of this one
    let originalId = quo.revisionOf || quo.id;
    const revisions = await db
      .select({
        id: quotations.id,
        number: quotations.number,
        status: quotations.status,
        revisionLabel: quotations.revisionLabel,
        total: quotations.total,
        createdAt: quotations.createdAt,
      })
      .from(quotations)
      .where(
        or(
          eq(quotations.id, originalId),
          eq(quotations.revisionOf, originalId)
        )
      )
      .orderBy(desc(quotations.createdAt));

    res.json({ ...quo, items, revisions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch quotation', message: String(err) });
  }
});

// POST /api/quotations — create a new quotation (default status: draft)
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parsed = quotationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const { subtotal, discount, taxRate, tax, total, items } = calculateQuotationTotals(
      parsed.data.items,
      parsed.data.discount,
      parsed.data.taxRate,
      parsed.data.tax
    );

    const result = await db.transaction(async (tx) => {
      // Generate unique number transaksional
      const number = await generateNextNumber('quotation');

      const [newQuo] = await tx
        .insert(quotations)
        .values({
          number,
          clientId: parsed.data.clientId,
          status: 'draft',
          issuedDate: parsed.data.issuedDate || null,
          validUntil: parsed.data.validUntil || null,
          subtotal,
          discount,
          taxRate,
          tax,
          total,
          notes: parsed.data.notes || null,
        })
        .returning();

      // Insert all calculated items
      await tx.insert(quotationItems).values(
        items.map((item) => ({
          quotationId: newQuo.id,
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

      return newQuo;
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create quotation', message: String(err) });
  }
});

// PUT /api/quotations/:id — edit quotation (implements p3-b4 revision logic)
router.put('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parsed = quotationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(quotations)
      .where(eq(quotations.id, req.params.id as string));

    if (!existing) {
      res.status(404).json({ error: 'Quotation not found' });
      return;
    }

    const { subtotal, discount, taxRate, tax, total, items } = calculateQuotationTotals(
      parsed.data.items,
      parsed.data.discount,
      parsed.data.taxRate,
      parsed.data.tax
    );

    // Draft -> In-place update
    if (existing.status === 'draft') {
      const result = await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(quotations)
          .set({
            clientId: parsed.data.clientId,
            issuedDate: parsed.data.issuedDate || null,
            validUntil: parsed.data.validUntil || null,
            subtotal,
            discount,
            taxRate,
            tax,
            total,
            notes: parsed.data.notes || null,
            updatedAt: new Date(),
          })
          .where(eq(quotations.id, existing.id))
          .returning();

        // Re-create items
        await tx.delete(quotationItems).where(eq(quotationItems.quotationId, existing.id));
        await tx.insert(quotationItems).values(
          items.map((item) => ({
            quotationId: existing.id,
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

        return updated;
      });

      res.json(result);
      return;
    }

    // Sent -> Revision logic: create new row, original marked as superseded
    if (existing.status === 'sent') {
      const result = await db.transaction(async (tx) => {
        // Calculate new revision label
        let nextRevLabel = 'R1';
        if (existing.revisionLabel) {
          const currentRevNum = parseInt(existing.revisionLabel.replace('R', ''), 10);
          nextRevLabel = `R${currentRevNum + 1}`;
        }

        const originalId = existing.revisionOf || existing.id;
        const number = existing.number;

        const [revisedQuo] = await tx
          .insert(quotations)
          .values({
            number,
            clientId: parsed.data.clientId,
            status: 'draft', // starts as draft
            revisionOf: originalId,
            revisionLabel: nextRevLabel,
            issuedDate: parsed.data.issuedDate || null,
            validUntil: parsed.data.validUntil || null,
            subtotal,
            discount,
            taxRate,
            tax,
            total,
            notes: parsed.data.notes || null,
          })
          .returning();

        // Mark previous quotation as superseded
        await tx
          .update(quotations)
          .set({ status: 'superseded', updatedAt: new Date() })
          .where(eq(quotations.id, existing.id));

        // Insert revised items
        await tx.insert(quotationItems).values(
          items.map((item) => ({
            quotationId: revisedQuo.id,
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

        return revisedQuo;
      });

      res.json(result);
      return;
    }

    // Rest of status (accepted, rejected, superseded) cannot be edited
    res.status(400).json({ error: `Cannot edit quotation with status "${existing.status}"` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update quotation', message: String(err) });
  }
});

// PATCH /api/quotations/:id/status — transition status
router.patch('/:id/status', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const statusSchema = z.object({
    status: z.enum(['sent', 'accepted', 'rejected']),
  });

  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid status transition value', details: parsed.error.flatten() });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(quotations)
      .where(eq(quotations.id, req.params.id as string));

    if (!existing) {
      res.status(404).json({ error: 'Quotation not found' });
      return;
    }

    const current = existing.status;
    const target = parsed.data.status;

    // Check transition rules
    let allowed = false;
    if (current === 'draft' && target === 'sent') allowed = true;
    if (current === 'sent' && (target === 'accepted' || target === 'rejected')) allowed = true;

    if (!allowed) {
      res.status(400).json({
        error: `Invalid status transition from "${current}" to "${target}"`,
      });
      return;
    }

    const [updated] = await db
      .update(quotations)
      .set({ status: target, updatedAt: new Date() })
      .where(eq(quotations.id, existing.id))
      .returning();

      // Auto-create project when quotation is accepted
      if (target === 'accepted') {
        const [client] = await db.select().from(clients).where(eq(clients.id, existing.clientId as string));
        await db.insert(projects).values({
          quotationId: existing.id,
          clientId: existing.clientId as string,
          name: `Project — ${client?.name ?? 'Client'} (${existing.number})`,
          status: 'not_started',
        });
      }

      res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to change status', message: String(err) });
  }
});

// DELETE /api/quotations/:id — only allowed if draft
router.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [existing] = await db
      .select()
      .from(quotations)
      .where(eq(quotations.id, req.params.id as string));

    if (!existing) {
      res.status(404).json({ error: 'Quotation not found' });
      return;
    }

    if (existing.status !== 'draft') {
      res.status(400).json({ error: 'Only draft quotations can be deleted' });
      return;
    }

    await db.delete(quotations).where(eq(quotations.id, existing.id));
    res.json({ message: 'Deleted successfully', id: existing.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete quotation', message: String(err) });
  }
});

// GET /api/quotations/:id/pdf — streaming PDF generation on-demand
router.get('/:id/pdf', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [quo] = await db
      .select()
      .from(quotations)
      .where(eq(quotations.id, req.params.id as string));

    if (!quo) {
      res.status(404).json({ error: 'Quotation not found' });
      return;
    }

    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, quo.clientId));

    const items = await db
      .select()
      .from(quotationItems)
      .where(eq(quotationItems.quotationId, quo.id))
      .orderBy(quotationItems.sortOrder);

    await generateQuotationPdf(res, quo, items, client);
  } catch (err) {
    console.error('PDF Generation Error:', err);
    res.status(500).json({ error: 'Failed to generate PDF', message: String(err) });
  }
});

export default router;
