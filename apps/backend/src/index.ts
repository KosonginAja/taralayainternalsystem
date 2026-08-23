import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ?? 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, mobile)
    if (!origin) return callback(null, true);
    // Allow localhost in development
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }
    // Allow exact match from CLIENT_ORIGIN env var
    if (origin === CLIENT_ORIGIN) return callback(null, true);
    // Allow any *.vercel.app subdomain (preview deployments)
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    callback(new Error(`CORS: Origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve uploaded files — NOTE: on Vercel serverless, files do NOT persist.
// Use external storage (S3/Cloudinary) for production uploads.
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

import authRouter from './modules/auth/auth.router.js';
app.use('/api/auth', authRouter);

import settingsRouter from './modules/settings/settings.router.js';
app.use('/api/settings', settingsRouter);

import clientsRouter from './modules/clients/clients.router.js';
app.use('/api/clients', clientsRouter);

import pricelistRouter from './modules/pricelist/pricelist.router.js';
app.use('/api/pricelist', pricelistRouter);

import packagesRouter from './modules/packages/packages.router.js';
app.use('/api/packages', packagesRouter);

import quotationsRouter from './modules/quotations/quotations.router.js';
app.use('/api/quotations', quotationsRouter);

import invoicesRouter from './modules/invoices/invoices.router.js';
app.use('/api/invoices', invoicesRouter);

import paymentsRouter from './modules/payments/payments.router.js';
app.use('/api/payments', paymentsRouter);

import dashboardRouter from './modules/dashboard/dashboard.router.js';
app.use('/api/dashboard', dashboardRouter);

import documentsRouter from './modules/documents/documents.router.js';
app.use('/api/documents', documentsRouter);

import projectsRouter from './modules/projects/projects.router.js';
app.use('/api/projects', projectsRouter);

import usersRouter from './modules/users/users.router.js';
app.use('/api/users', usersRouter);

import payrollRouter from './modules/payroll/payroll.router.js';
app.use('/api/payroll', payrollRouter);

import expensesRouter from './modules/expenses/expenses.router.js';
app.use('/api/expenses', expensesRouter);

import leadsRouter from './modules/leads/leads.router.js';
app.use('/api/leads', leadsRouter);

import reportsRouter from './modules/reports/reports.router.js';
app.use('/api/reports', reportsRouter);

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// ─── Start (local dev only) ───────────────────────────────────────────────────
// Vercel does NOT need app.listen() — it handles invocation via the export below.
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`🚀 Taralaya Backend running at http://localhost:${PORT}`);
  });
}

// Export for Vercel serverless handler
export default app;
