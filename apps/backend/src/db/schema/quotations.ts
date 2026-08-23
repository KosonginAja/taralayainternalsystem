import { pgTable, uuid, text, numeric, date, timestamp, AnyPgColumn } from 'drizzle-orm/pg-core';
import { clients } from './clients.js';

export const quotations = pgTable('quotations', {
  id: uuid('id').primaryKey().defaultRandom(),
  number: text('number').notNull().unique(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'restrict' }),
  status: text('status').notNull().default('draft'), // draft | sent | accepted | rejected | superseded
  revisionOf: uuid('revision_of').references((): AnyPgColumn => quotations.id, { onDelete: 'set null' }),
  revisionLabel: text('revision_label'), // R1, R2, etc.
  issuedDate: date('issued_date'),
  validUntil: date('valid_until'),
  subtotal: numeric('subtotal', { precision: 14, scale: 2 }).notNull().default('0.00'),
  discount: numeric('discount', { precision: 14, scale: 2 }).notNull().default('0.00'),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).notNull().default('0.00'),
  tax: numeric('tax', { precision: 14, scale: 2 }).notNull().default('0.00'),
  total: numeric('total', { precision: 14, scale: 2 }).notNull().default('0.00'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Quotation = typeof quotations.$inferSelect;
export type NewQuotation = typeof quotations.$inferInsert;
