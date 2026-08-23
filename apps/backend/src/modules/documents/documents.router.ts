import { Router, Request, Response } from 'express';
import { db } from '../../db/connection.js';
import { documentTemplates } from '../../db/schema/index.js';
import { eq, desc } from 'drizzle-orm';
import { requireAuth } from '../../middleware/auth.js';
import { z } from 'zod';

const router = Router();

const templateSchema = z.object({
  type: z.string().min(1),
  name: z.string().min(1),
  templateContent: z.string(),
});

// GET /api/documents/templates
router.get('/templates', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const templates = await db.select().from(documentTemplates).orderBy(desc(documentTemplates.createdAt));
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch templates', message: String(err) });
  }
});

// POST /api/documents/templates
router.post('/templates', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parsed = templateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  
  try {
    const [newTemplate] = await db.insert(documentTemplates).values({
      type: parsed.data.type,
      name: parsed.data.name,
      templateContent: parsed.data.templateContent,
    }).returning();
    res.status(201).json(newTemplate);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create template', message: String(err) });
  }
});

// GET /api/documents/templates/:id
router.get('/templates/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [template] = await db.select().from(documentTemplates).where(eq(documentTemplates.id, req.params.id as string));
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    res.json(template);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch template', message: String(err) });
  }
});

// PUT /api/documents/templates/:id
router.put('/templates/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parsed = templateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const [updatedTemplate] = await db
      .update(documentTemplates)
      .set({
        type: parsed.data.type,
        name: parsed.data.name,
        templateContent: parsed.data.templateContent,
        updatedAt: new Date()
      })
      .where(eq(documentTemplates.id, req.params.id as string))
      .returning();
      
    if (!updatedTemplate) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    res.json(updatedTemplate);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update template', message: String(err) });
  }
});

// DELETE /api/documents/templates/:id
router.delete('/templates/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [deleted] = await db.delete(documentTemplates).where(eq(documentTemplates.id, req.params.id as string)).returning();
    if (!deleted) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    res.json({ message: 'Deleted successfully', id: deleted.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete template', message: String(err) });
  }
});

export default router;

import { companySettings, clients, quotations, invoices } from '../../db/schema/index.js';
import { generateDocumentPdf } from '../../services/pdf.service.js';

// Helper to format values
function formatVal(val: any): string {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) return val.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  return String(val);
}

// Generate Endpoint
router.post('/generate', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { templateId, contextType, contextId } = req.body;
  if (!templateId) {
    res.status(400).json({ error: 'templateId is required' });
    return;
  }

  try {
    const [template] = await db.select().from(documentTemplates).where(eq(documentTemplates.id, templateId));
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    let content = template.templateContent;

    // Fetch context data
    const [company] = await db.select().from(companySettings).limit(1);
    
    // Base context
    const ctx: Record<string, any> = {
      company: company || {},
      date: { today: new Date() }
    };

    if (contextType === 'client' && contextId) {
      const [client] = await db.select().from(clients).where(eq(clients.id, contextId));
      if (client) ctx.client = client;
    } else if (contextType === 'quotation' && contextId) {
      const [quotation] = await db.select().from(quotations).where(eq(quotations.id, contextId));
      if (quotation) {
        ctx.quotation = quotation;
        if (quotation.clientId) {
          const [client] = await db.select().from(clients).where(eq(clients.id, quotation.clientId as string));
          if (client) ctx.client = client;
        }
      }
    } else if (contextType === 'invoice' && contextId) {
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, contextId));
      if (invoice) {
        ctx.invoice = invoice;
        if (invoice.clientId) {
          const [client] = await db.select().from(clients).where(eq(clients.id, invoice.clientId as string));
          if (client) ctx.client = client;
        }
      }
    }

    // Replace placeholders
    content = content.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (match, path) => {
      const parts = path.split('.');
      let current = ctx;
      for (const part of parts) {
        if (current === null || current === undefined) return match; // Not found
        current = current[part];
      }
      return current !== undefined ? formatVal(current) : match;
    });

    await generateDocumentPdf(res, content, template.name);

  } catch (err) {
    console.error('PDF Generate Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate document', message: String(err) });
    }
  }
});
