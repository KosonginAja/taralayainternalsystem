import { pgTable, uuid, text, numeric, date, timestamp } from 'drizzle-orm/pg-core';
import { invoices } from './invoices.js';
import { invoiceInstallments } from './invoice-installments.js';

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'restrict' }),
  installmentId: uuid('installment_id').notNull().references(() => invoiceInstallments.id, { onDelete: 'restrict' }),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  paymentDate: date('payment_date').notNull(),
  method: text('method'), // transfer/cash/etc, free text
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
