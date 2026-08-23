import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import { clients } from '../../db/schema/index.js';
import { eq, ilike, or, and } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../../middleware/auth.js';
import { z } from 'zod';

const router = Router();

const clientSchema = z.object({
  name: z.string().min(1),
  picName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/clients
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const search = (req.query.search as string | undefined) ?? '';
    const includeInactive = req.query.includeInactive === 'true';

    let query = db.select().from(clients).$dynamic();

    const conditions = [];
    if (!includeInactive) {
      conditions.push(eq(clients.isActive, true));
    }
    if (search) {
      conditions.push(
        or(
          ilike(clients.name, `%${search}%`),
          ilike(clients.picName, `%${search}%`),
          ilike(clients.email, `%${search}%`),
        )!
      );
    }
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const result = await query.orderBy(clients.createdAt);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch clients', message: String(err) });
  }
});

// GET /api/clients/:id
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [client] = await db.select().from(clients).where(eq(clients.id, req.params.id as string));
    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }
    res.json(client);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch client', message: String(err) });
  }
});

// POST /api/clients
router.post('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = clientSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  try {
    const [created] = await db.insert(clients).values(parsed.data).returning();
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create client', message: String(err) });
  }
});

// PUT /api/clients/:id
router.put('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parsed = clientSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  try {
    const [updated] = await db
      .update(clients)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(clients.id, req.params.id as string))
      .returning();
    if (!updated) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update client', message: String(err) });
  }
});

// DELETE /api/clients/:id  — soft delete (toggle isActive)
router.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [client] = await db.select().from(clients).where(eq(clients.id, req.params.id as string));
    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }
    const [updated] = await db
      .update(clients)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(clients.id, req.params.id as string))
      .returning();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to deactivate client', message: String(err) });
  }
});

export default router;
