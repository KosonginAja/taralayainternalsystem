import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import { leads, clients, quotations } from '../../db/schema/index.js';
import { eq, desc } from 'drizzle-orm';
import { requireAuth } from '../../middleware/auth.js';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);

const leadSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  company: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  source: z.string().optional(),
  status: z.enum(['new', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost']).default('new'),
  notes: z.string().optional(),
  convertedQuotationId: z.string().uuid().optional().nullable(),
});

// GET /api/leads
router.get('/', async (req: Request, res: Response) => {
  try {
    const list = await db.select().from(leads).orderBy(desc(leads.createdAt));
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leads', message: String(err) });
  }
});

// GET /api/leads/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const [lead] = await db.select().from(leads).where(eq(leads.id, req.params.id as string));
    if (!lead) { res.status(404).json({ error: 'Lead not found' }); return; }
    res.json(lead);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch lead', message: String(err) });
  }
});

// POST /api/leads
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = leadSchema.parse(req.body);
    const [newLead] = await db.insert(leads).values({
      name: parsed.name,
      company: parsed.company || null,
      contactEmail: parsed.contactEmail || null,
      contactPhone: parsed.contactPhone || null,
      source: parsed.source || null,
      status: parsed.status,
      notes: parsed.notes || null,
        convertedQuotationId: parsed.convertedQuotationId || null,
    }).returning();
    res.status(201).json(newLead);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: err.errors });
    } else {
      res.status(500).json({ error: 'Failed to create lead', message: String(err) });
    }
  }
});

// PUT /api/leads/:id
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = leadSchema.parse(req.body);
    const [updated] = await db.update(leads)
      .set({
        name: parsed.name,
        company: parsed.company || null,
        contactEmail: parsed.contactEmail || null,
        contactPhone: parsed.contactPhone || null,
        source: parsed.source || null,
        status: parsed.status,
        notes: parsed.notes || null,
        convertedQuotationId: parsed.convertedQuotationId || null,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, req.params.id as string))
      .returning();
      
    if (!updated) { res.status(404).json({ error: 'Lead not found' }); return; }
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: err.errors });
    } else {
      res.status(500).json({ error: 'Failed to update lead', message: String(err) });
    }
  }
});

// PUT /api/leads/:id/status (quick status update)
router.put('/:id/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, convertedQuotationId } = req.body;
    if (!['new', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }
    const [updated] = await db.update(leads)
      .set({ 
        status, 
        ...(convertedQuotationId && { convertedQuotationId }),
        updatedAt: new Date() 
      })
      .where(eq(leads.id, req.params.id as string))
      .returning();
      
    if (!updated) { res.status(404).json({ error: 'Lead not found' }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update lead status', message: String(err) });
  }
});

// DELETE /api/leads/:id
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const [deleted] = await db.delete(leads).where(eq(leads.id, req.params.id as string)).returning({ id: leads.id });
    if (!deleted) { res.status(404).json({ error: 'Lead not found' }); return; }
    res.json({ message: 'Lead deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete lead', message: String(err) });
  }
});

export default router;


