import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import { projects, projectTasks, clients, quotations } from '../../db/schema/index.js';
import { eq, desc, asc, and } from 'drizzle-orm';
import { requireAuth } from '../../middleware/auth.js';
import { z } from 'zod';

const router = Router();

// ─── Projects ─────────────────────────────────────────────────────────────────

// GET /api/projects
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const rows = await db
      .select({
        id: projects.id,
        quotationId: projects.quotationId,
        clientId: projects.clientId,
        clientName: clients.name,
        name: projects.name,
        status: projects.status,
        startDate: projects.startDate,
        deadline: projects.deadline,
        description: projects.description,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .orderBy(desc(projects.updatedAt));

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch projects', message: String(err) });
  }
});

// POST /api/projects
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    clientId: z.string().uuid(),
    name: z.string().min(1),
    quotationId: z.string().uuid().optional(),
    startDate: z.string().optional(),
    deadline: z.string().optional(),
    description: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const [newProject] = await db.insert(projects).values({
      clientId: parsed.data.clientId,
      name: parsed.data.name,
      quotationId: parsed.data.quotationId ?? null,
      startDate: parsed.data.startDate ?? null,
      deadline: parsed.data.deadline ?? null,
      description: parsed.data.description ?? null,
      status: 'not_started',
    }).returning();
    res.status(201).json(newProject);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create project', message: String(err) });
  }
});

// GET /api/projects/:id
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [project] = await db
      .select({
        id: projects.id,
        quotationId: projects.quotationId,
        clientId: projects.clientId,
        clientName: clients.name,
        name: projects.name,
        status: projects.status,
        startDate: projects.startDate,
        deadline: projects.deadline,
        description: projects.description,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(eq(projects.id, req.params.id as string));

    if (!project) { res.status(404).json({ error: 'Project not found' }); return; }

    const tasks = await db
      .select()
      .from(projectTasks)
      .where(eq(projectTasks.projectId, req.params.id as string))
      .orderBy(asc(projectTasks.sortOrder), asc(projectTasks.createdAt));

    res.json({ ...project, tasks });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch project', message: String(err) });
  }
});

// PUT /api/projects/:id
router.put('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    name: z.string().min(1).optional(),
    status: z.enum(['not_started', 'in_progress', 'review', 'completed', 'on_hold', 'cancelled']).optional(),
    startDate: z.string().nullable().optional(),
    deadline: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
    if (parsed.data.startDate !== undefined) updateData.startDate = parsed.data.startDate;
    if (parsed.data.deadline !== undefined) updateData.deadline = parsed.data.deadline;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description;

    const [updated] = await db
      .update(projects)
      .set(updateData)
      .where(eq(projects.id, req.params.id as string))
      .returning();

    if (!updated) { res.status(404).json({ error: 'Project not found' }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update project', message: String(err) });
  }
});

// DELETE /api/projects/:id
router.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [deleted] = await db
      .delete(projects)
      .where(eq(projects.id, req.params.id as string))
      .returning();
    if (!deleted) { res.status(404).json({ error: 'Project not found' }); return; }
    res.json({ message: 'Deleted', id: deleted.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete project', message: String(err) });
  }
});

// ─── Project Tasks ─────────────────────────────────────────────────────────────

// POST /api/projects/:id/tasks
router.post('/:id/tasks', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    dueDate: z.string().nullable().optional(),
    sortOrder: z.number().optional(),
    assigneeId: z.string().uuid().nullable().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const [newTask] = await db.insert(projectTasks).values({
      projectId: req.params.id as string,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      dueDate: parsed.data.dueDate ?? null,
      sortOrder: parsed.data.sortOrder ?? 0,
      assigneeId: parsed.data.assigneeId ?? null,
      status: 'todo',
    }).returning();
    res.status(201).json(newTask);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create task', message: String(err) });
  }
});

// PUT /api/projects/:id/tasks/:taskId
router.put('/:id/tasks/:taskId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    title: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    status: z.enum(['todo', 'in_progress', 'done']).optional(),
    dueDate: z.string().nullable().optional(),
    sortOrder: z.number().optional(),
    assigneeId: z.string().uuid().nullable().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
    if (parsed.data.dueDate !== undefined) updateData.dueDate = parsed.data.dueDate;
    if (parsed.data.sortOrder !== undefined) updateData.sortOrder = parsed.data.sortOrder;
    if (parsed.data.assigneeId !== undefined) updateData.assigneeId = parsed.data.assigneeId;

    const [updated] = await db
      .update(projectTasks)
      .set(updateData)
      .where(and(
        eq(projectTasks.id, req.params.taskId as string),
        eq(projectTasks.projectId, req.params.id as string)
      ))
      .returning();

    if (!updated) { res.status(404).json({ error: 'Task not found' }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update task', message: String(err) });
  }
});

// DELETE /api/projects/:id/tasks/:taskId
router.delete('/:id/tasks/:taskId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [deleted] = await db
      .delete(projectTasks)
      .where(and(
        eq(projectTasks.id, req.params.taskId as string),
        eq(projectTasks.projectId, req.params.id as string)
      ))
      .returning();
    if (!deleted) { res.status(404).json({ error: 'Task not found' }); return; }
    res.json({ message: 'Task deleted', id: deleted.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task', message: String(err) });
  }
});

export default router;
