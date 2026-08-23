import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import { pricelistItems } from '../../db/schema/index.js';
import { eq, ilike, and, or } from 'drizzle-orm';
import { requireAuth } from '../../middleware/auth.js';
import { z } from 'zod';

const router = Router();

const pricelistSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  unit: z.string().optional(),
  price: z.union([z.string(), z.number()]).transform((v) => String(v)),
  category: z.string().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/pricelist
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const search = (req.query.search as string | undefined) ?? '';
    const includeInactive = req.query.includeInactive === 'true';
    const category = req.query.category as string | undefined;

    let query = db.select().from(pricelistItems).$dynamic();

    const conditions = [];
    if (!includeInactive) {
      conditions.push(eq(pricelistItems.isActive, true));
    }
    if (search) {
      conditions.push(
        or(
          ilike(pricelistItems.name, `%${search}%`),
          ilike(pricelistItems.description, `%${search}%`),
          ilike(pricelistItems.category, `%${search}%`),
        )!
      );
    }
    if (category) {
      conditions.push(eq(pricelistItems.category, category));
    }
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const result = await query.orderBy(pricelistItems.category, pricelistItems.name);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pricelist items', message: String(err) });
  }
});

// GET /api/pricelist/:id
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [item] = await db.select().from(pricelistItems).where(eq(pricelistItems.id, req.params.id as string));
    if (!item) {
      res.status(404).json({ error: 'Pricelist item not found' });
      return;
    }
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pricelist item', message: String(err) });
  }
});

// POST /api/pricelist
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parsed = pricelistSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  try {
    const [created] = await db.insert(pricelistItems).values(parsed.data).returning();
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create pricelist item', message: String(err) });
  }
});

// PUT /api/pricelist/:id
router.put('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parsed = pricelistSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  try {
    const [updated] = await db
      .update(pricelistItems)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(pricelistItems.id, req.params.id as string))
      .returning();
    if (!updated) {
      res.status(404).json({ error: 'Pricelist item not found' });
      return;
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update pricelist item', message: String(err) });
  }
});

// PATCH /api/pricelist/:id/toggle — toggle isActive
router.patch('/:id/toggle', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [item] = await db.select().from(pricelistItems).where(eq(pricelistItems.id, req.params.id as string));
    if (!item) {
      res.status(404).json({ error: 'Pricelist item not found' });
      return;
    }
    const [updated] = await db
      .update(pricelistItems)
      .set({ isActive: !item.isActive, updatedAt: new Date() })
      .where(eq(pricelistItems.id, req.params.id as string))
      .returning();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle pricelist item', message: String(err) });
  }
});

// DELETE /api/pricelist/:id — hard delete (only if not referenced)
router.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [deleted] = await db
      .delete(pricelistItems)
      .where(eq(pricelistItems.id, req.params.id as string))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: 'Pricelist item not found' });
      return;
    }
    res.json({ message: 'Deleted', id: deleted.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete pricelist item', message: String(err) });
  }
});

export default router;
