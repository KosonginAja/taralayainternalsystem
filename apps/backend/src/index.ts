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

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin.startsWith('http://localhost:') || origin === CLIENT_ORIGIN) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve uploaded files (logo, etc.)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes
import authRouter from './modules/auth/auth.router.js';
app.use('/api/auth', authRouter);

// Settings routes
import settingsRouter from './modules/settings/settings.router.js';
app.use('/api/settings', settingsRouter);

// Client routes
import clientsRouter from './modules/clients/clients.router.js';
app.use('/api/clients', clientsRouter);

// Pricelist Satuan routes
import pricelistRouter from './modules/pricelist/pricelist.router.js';
app.use('/api/pricelist', pricelistRouter);

// Pricelist Paket routes
import packagesRouter from './modules/packages/packages.router.js';
app.use('/api/packages', packagesRouter);

// Quotation routes
import quotationsRouter from './modules/quotations/quotations.router.js';
app.use('/api/quotations', quotationsRouter);

// Invoice routes
import invoicesRouter from './modules/invoices/invoices.router.js';
app.use('/api/invoices', invoicesRouter);

// Payments and Wallets routes
import paymentsRouter from './modules/payments/payments.router.js';
app.use('/api/payments', paymentsRouter);

// Dashboard routes
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

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Taralaya Backend running at http://localhost:${PORT}`);
});

export default app;
