import { pgTable, uuid, text, numeric, integer } from 'drizzle-orm/pg-core';
import { quotations } from './quotations.js';

export const quotationItems = pgTable('quotation_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  quotationId: uuid('quotation_id').notNull().references(() => quotations.id, { onDelete: 'cascade' }),
  refType: text('ref_type').notNull(), // 'pricelist_item' | 'package' | 'custom'
  refId: uuid('ref_id'), // nullable FK to pricelist_items or packages
  name: text('name').notNull(), // snapshot
  description: text('description'), // snapshot
  qty: numeric('qty', { precision: 10, scale: 2 }).notNull().default('1'),
  unitPrice: numeric('unit_price', { precision: 14, scale: 2 }).notNull().default('0.00'), // snapshot
  subtotal: numeric('subtotal', { precision: 14, scale: 2 }).notNull().default('0.00'),
  sortOrder: integer('sort_order').notNull().default(0),
});

export type QuotationItem = typeof quotationItems.$inferSelect;
export type NewQuotationItem = typeof quotationItems.$inferInsert;
