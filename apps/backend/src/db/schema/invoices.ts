import { pgTable, uuid, text, numeric, date, timestamp } from 'drizzle-orm/pg-core';
import { clients } from './clients.js';
import { quotations } from './quotations.js';

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  number: text('number').notNull().unique(),
  quotationId: uuid('quotation_id').references(() => quotations.id, { onDelete: 'set null' }),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'restrict' }),
  status: text('status').notNull().default('unpaid'), // unpaid | partial | paid | overdue | cancelled
  paymentType: text('payment_type').notNull(), // full | dp | custom
  issueDate: date('issue_date'),
  dueDate: date('due_date'),
  subtotal: numeric('subtotal', { precision: 14, scale: 2 }).notNull().default('0.00'),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).notNull().default('0.00'),
  tax: numeric('tax', { precision: 14, scale: 2 }).notNull().default('0.00'),
  total: numeric('total', { precision: 14, scale: 2 }).notNull().default('0.00'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
