import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { db } from './db';
import { companySettings, clients } from './db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Simple validation schemas
const companySettingsSchema = z.object({
  name: z.string().optional(),
  logoUrl: z.string().optional(),
  address: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().optional(),
  npwp: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  bankHolder: z.string().optional(),
  description: z.string().optional(),
  signatureUrl: z.string().optional(),
});

const clientSchema = z.object({
  name: z.string().min(1),
  company: z.string().optional(),
  pic: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  npwp: z.string().optional(),
  notes: z.string().optional(),
});

// Company Settings API
app.get('/api/v1/company-settings', async (req, res) => {
  try {
    let settings = await db.select().from(companySettings).where(eq(companySettings.id, 1)).get();
    if (!settings) {
      // Create default
      settings = await db.insert(companySettings).values({ id: 1, name: 'Taralaya Studio' }).returning().get();
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.put('/api/v1/company-settings', async (req, res) => {
  try {
    const data = companySettingsSchema.parse(req.body);
    const settings = await db.update(companySettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(companySettings.id, 1))
      .returning().get();
    res.json(settings);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// Clients API
app.get('/api/v1/clients', async (req, res) => {
  try {
    const allClients = await db.select().from(clients).all();
    res.json(allClients);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/v1/clients/:id', async (req, res) => {
  try {
    const client = await db.select().from(clients).where(eq(clients.id, Number(req.params.id))).get();
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json(client);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/v1/clients', async (req, res) => {
  try {
    const data = clientSchema.parse(req.body);
    const client = await db.insert(clients).values({ ...data, createdAt: new Date() }).returning().get();
    res.status(201).json(client);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

app.put('/api/v1/clients/:id', async (req, res) => {
  try {
    const data = clientSchema.parse(req.body);
    const client = await db.update(clients).set(data).where(eq(clients.id, Number(req.params.id))).returning().get();
    res.json(client);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

app.delete('/api/v1/clients/:id', async (req, res) => {
  try {
    await db.delete(clients).where(eq(clients.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
