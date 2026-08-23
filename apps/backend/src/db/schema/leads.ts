import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { quotations } from './quotations.js';

export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  company: text('company'),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  source: text('source'),
  status: text('status').notNull().default('new'), // new | contacted | qualified | proposal_sent | won | lost
  notes: text('notes'),
  convertedQuotationId: uuid('converted_quotation_id').references(() => quotations.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
