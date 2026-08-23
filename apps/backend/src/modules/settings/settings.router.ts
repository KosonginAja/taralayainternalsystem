import { Router, Response } from 'express';
import { db } from '../../db/connection.js';
import { companySettings, numberingSequences } from '../../db/schema/index.js';
import { requireAuth, AuthRequest } from '../../middleware/auth.js';
import { eq } from 'drizzle-orm';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, '..', '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `logo${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const signatureStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `signature${ext}`);
  },
});
const uploadSignature = multer({ storage: signatureStorage, limits: { fileSize: 2 * 1024 * 1024 } });

const uploadBoth = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      const prefix = file.fieldname === 'signature' ? 'signature' : 'logo';
      cb(null, `${prefix}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const router = Router();

// GET /api/settings
router.get('/', requireAuth, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rows = await db.select().from(companySettings).limit(1);
    res.json(rows[0] ?? null);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings', message: String(err) });
  }
});

// PUT /api/settings
router.put('/', requireAuth, uploadBoth.fields([{ name: 'logo', maxCount: 1 }, { name: 'signature', maxCount: 1 }]), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const existing = await db.select().from(companySettings).limit(1);
    const body = req.body as Record<string, string>;
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;

    const logoUrl = files?.logo?.[0]
      ? `/uploads/${files.logo[0].filename}`
      : (body.logoUrl ?? existing[0]?.logoUrl ?? null);

    const signatureUrl = files?.signature?.[0]
      ? `/uploads/${files.signature[0].filename}`
      : (body.signatureUrl ?? existing[0]?.signatureUrl ?? null);

    const values = {
      name: body.name ?? existing[0]?.name ?? '',
      logoUrl,
      signatureUrl,
      address: body.address ?? null,
      phone: body.phone ?? null,
      email: body.email ?? null,
      taxId: body.taxId ?? null,
      bankName: body.bankName ?? null,
      bankAccountNumber: body.bankAccountNumber ?? null,
      bankAccountHolder: body.bankAccountHolder ?? null,
      defaultWalletCompanyPct: body.defaultWalletCompanyPct ?? '70.00',
      defaultWalletPayrollPct: body.defaultWalletPayrollPct ?? '30.00',
      updatedAt: new Date(),
    };

    if (existing.length === 0) {
      const [created] = await db.insert(companySettings).values(values).returning();
      res.json(created);
    } else {
      const [updated] = await db
        .update(companySettings)
        .set(values)
        .returning();
      res.json(updated);
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings', message: String(err) });
  }
});

// GET /api/settings/numbering — list all numbering sequences
router.get('/numbering', requireAuth, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rows = await db.select().from(numberingSequences);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch numbering sequences', message: String(err) });
  }
});

// PATCH /api/settings/numbering/:docType — update prefix/format for a doc type
router.patch('/numbering/:docType', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    prefix: z.string().min(1).max(10).toUpperCase(),
    format: z.string().min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const docTypeStr = String(req.params.docType);

  try {
    const [existing] = await db
      .select()
      .from(numberingSequences)
      .where(eq(numberingSequences.docType, docTypeStr));

    if (!existing) {
      res.status(404).json({ error: `Numbering sequence for "${docTypeStr}" not found` });
      return;
    }

    const [updated] = await db
      .update(numberingSequences)
      .set({ prefix: parsed.data.prefix, format: parsed.data.format })
      .where(eq(numberingSequences.docType, docTypeStr))
      .returning();

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update numbering sequence', message: String(err) });
  }
});

export default router;
