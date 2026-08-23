import { pgTable, uuid, text, numeric, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { walletTransactions } from './wallet-transactions.js';

export const payrollEntries = pgTable('payroll_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  period: text('period').notNull(), // e.g. "2026-08"
  baseSalary: numeric('base_salary', { precision: 14, scale: 2 }).notNull().default('0.00'),
  commissions: numeric('commissions', { precision: 14, scale: 2 }).notNull().default('0.00'),
  bonuses: numeric('bonuses', { precision: 14, scale: 2 }).notNull().default('0.00'),
  deductions: numeric('deductions', { precision: 14, scale: 2 }).notNull().default('0.00'),
  netPay: numeric('net_pay', { precision: 14, scale: 2 }).notNull().default('0.00'),
  status: text('status').notNull().default('draft'), // draft | paid
  transactionId: uuid('transaction_id').references(() => walletTransactions.id, { onDelete: 'set null' }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type PayrollEntry = typeof payrollEntries.$inferSelect;
export type NewPayrollEntry = typeof payrollEntries.$inferInsert;
