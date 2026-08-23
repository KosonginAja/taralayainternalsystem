import { pgTable, uuid, text, numeric, integer } from 'drizzle-orm/pg-core';
import { invoices } from './invoices.js';

export const invoiceItems = pgTable('invoice_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  refType: text('ref_type').notNull(), // 'pricelist_item' | 'package' | 'custom'
  refId: uuid('ref_id'),
  name: text('name').notNull(),
  description: text('description'),
  qty: numeric('qty', { precision: 10, scale: 2 }).notNull().default('1'),
  unitPrice: numeric('unit_price', { precision: 14, scale: 2 }).notNull().default('0.00'),
  subtotal: numeric('subtotal', { precision: 14, scale: 2 }).notNull().default('0.00'),
  sortOrder: integer('sort_order').notNull().default(0),
});

export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type NewInvoiceItem = typeof invoiceItems.$inferInsert;
