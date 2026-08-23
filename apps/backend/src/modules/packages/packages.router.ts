import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import { packages, packageItems, pricelistItems } from '../../db/schema/index.js';
import { eq, ilike, and, inArray } from 'drizzle-orm';
import { requireAuth } from '../../middleware/auth.js';
import { z } from 'zod';

const router = Router();

const packageSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.union([z.string(), z.number()]).transform((v) => String(v)),
  isActive: z.boolean().optional(),
});

const packageItemLinkSchema = z.object({
  pricelistItemId: z.string().uuid(),
  qty: z.union([z.string(), z.number()]).transform((v) => String(v)).optional(),
});

// GET /api/packages
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const search = (req.query.search as string | undefined) ?? '';
    const includeInactive = req.query.includeInactive === 'true';

    let query = db.select().from(packages).$dynamic();
    const conditions = [];
    if (!includeInactive) conditions.push(eq(packages.isActive, true));
    if (search) conditions.push(ilike(packages.name, `%${search}%`));
    if (conditions.length > 0) query = query.where(and(...conditions));

    const pkgs = await query.orderBy(packages.name);
    res.json(pkgs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch packages', message: String(err) });
  }
});

// GET /api/packages/:id — with items
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [pkg] = await db.select().from(packages).where(eq(packages.id, req.params.id as string));
    if (!pkg) {
      res.status(404).json({ error: 'Package not found' });
      return;
    }

    // Get package items with pricelist item details
    const items = await db
      .select({
        id: packageItems.id,
        packageId: packageItems.packageId,
        qty: packageItems.qty,
        pricelistItemId: packageItems.pricelistItemId,
        itemName: pricelistItems.name,
        itemUnit: pricelistItems.unit,
        itemPrice: pricelistItems.price,
        itemCategory: pricelistItems.category,
      })
      .from(packageItems)
      .innerJoin(pricelistItems, eq(packageItems.pricelistItemId, pricelistItems.id))
      .where(eq(packageItems.packageId, req.params.id as string));

    // Compute sum of components
    const sumOfComponents = items.reduce((acc, item) => {
      return acc + parseFloat(item.itemPrice) * parseFloat(item.qty);
    }, 0);

    res.json({ ...pkg, items, sumOfComponents: sumOfComponents.toFixed(2) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch package', message: String(err) });
  }
});

// POST /api/packages
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const body = req.body as { name?: string; description?: string; price?: string | number; isActive?: boolean; items?: unknown[] };
  const parsed = packageSchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  try {
    const [created] = await db.insert(packages).values(parsed.data).returning();

    // Insert items if provided
    if (Array.isArray(body.items) && body.items.length > 0) {
      const itemsParsed = z.array(packageItemLinkSchema).safeParse(body.items);
      if (itemsParsed.success) {
        await db.insert(packageItems).values(
          itemsParsed.data.map((item) => ({
            packageId: created.id,
            pricelistItemId: item.pricelistItemId,
            qty: item.qty ?? '1',
          }))
        );
      }
    }

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create package', message: String(err) });
  }
});

// PUT /api/packages/:id
router.put('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const body = req.body as { name?: string; description?: string; price?: string | number; isActive?: boolean; items?: unknown[] };
  const parsed = packageSchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  try {
    const [updated] = await db
      .update(packages)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(packages.id, req.params.id as string))
      .returning();
    if (!updated) {
      res.status(404).json({ error: 'Package not found' });
      return;
    }

    // Replace items if provided
    if (Array.isArray(body.items)) {
      // Delete existing package items
      await db.delete(packageItems).where(eq(packageItems.packageId, req.params.id as string));

      if (body.items.length > 0) {
        const itemsParsed = z.array(packageItemLinkSchema).safeParse(body.items);
        if (itemsParsed.success) {
          await db.insert(packageItems).values(
            itemsParsed.data.map((item) => ({
              packageId: updated.id,
              pricelistItemId: item.pricelistItemId,
              qty: item.qty ?? '1',
            }))
          );
        }
      }
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update package', message: String(err) });
  }
});

// PATCH /api/packages/:id/toggle
router.patch('/:id/toggle', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [pkg] = await db.select().from(packages).where(eq(packages.id, req.params.id as string));
    if (!pkg) {
      res.status(404).json({ error: 'Package not found' });
      return;
    }
    const [updated] = await db
      .update(packages)
      .set({ isActive: !pkg.isActive, updatedAt: new Date() })
      .where(eq(packages.id, req.params.id as string))
      .returning();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle package', message: String(err) });
  }
});

// DELETE /api/packages/:id
router.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    // packageItems cascade on delete
    const [deleted] = await db
      .delete(packages)
      .where(eq(packages.id, req.params.id as string))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: 'Package not found' });
      return;
    }
    res.json({ message: 'Deleted', id: deleted.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete package', message: String(err) });
  }
});

// POST /api/packages/:id/items — add single item
router.post('/:id/items', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parsed = packageItemLinkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  try {
    const [created] = await db.insert(packageItems).values({
      packageId: req.params.id as string,
      pricelistItemId: parsed.data.pricelistItemId,
      qty: parsed.data.qty ?? '1',
    }).returning();
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add item to package', message: String(err) });
  }
});

// DELETE /api/packages/:id/items/:itemId — remove single item
router.delete('/:id/items/:itemId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [deleted] = await db
      .delete(packageItems)
      .where(
        and(
          eq(packageItems.packageId, req.params.id as string),
          eq(packageItems.id, req.params.itemId as string)
        )
      )
      .returning();
    if (!deleted) {
      res.status(404).json({ error: 'Package item not found' });
      return;
    }
    res.json({ message: 'Item removed', id: deleted.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove item from package', message: String(err) });
  }
});

export default router;
