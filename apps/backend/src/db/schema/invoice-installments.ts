import { pgTable, uuid, text, numeric, integer, date } from 'drizzle-orm/pg-core';
import { invoices } from './invoices.js';

export const invoiceInstallments = pgTable('invoice_installments', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  sequence: integer('sequence').notNull(),
  label: text('label').notNull(), // e.g. 'DP', 'Pelunasan', 'Termin 1'
  percentage: numeric('percentage', { precision: 5, scale: 2 }).notNull(),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  dueDate: date('due_date'),
  status: text('status').notNull().default('pending'), // pending | paid
});

export type InvoiceInstallment = typeof invoiceInstallments.$inferSelect;
export type NewInvoiceInstallment = typeof invoiceInstallments.$inferInsert;
