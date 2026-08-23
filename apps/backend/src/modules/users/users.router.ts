import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../../db/connection.js';
import { users } from '../../db/schema/index.js';
import { eq, desc } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { z } from 'zod';

const router = Router();

// Only admins can manage users
router.use(requireAuth, requireAdmin);

// GET /api/users
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users', message: String(err) });
  }
});

// POST /api/users
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(['admin', 'member']).default('member'),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const existing = await db.select().from(users).where(eq(users.email, parsed.data.email));
    if (existing.length > 0) {
      res.status(400).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const [newUser] = await db.insert(users).values({
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
    }).returning({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
    });
    
    res.status(201).json(newUser);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create user', message: String(err) });
  }
});

// DELETE /api/users/:id
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    // Prevent deleting self
    if (req.params.id === (req as any).user.id) {
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    const [deleted] = await db
      .delete(users)
      .where(eq(users.id, req.params.id as string))
      .returning({ id: users.id });
      
    if (!deleted) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user', message: String(err) });
  }
});

export default router;
