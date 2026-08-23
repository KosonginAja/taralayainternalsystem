import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const documentTemplates = pgTable('document_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type').notNull(), // 'contract', 'bast', 'proposal', 'company_profile', 'other'
  name: text('name').notNull(),
  templateContent: text('template_content').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type DocumentTemplate = typeof documentTemplates.$inferSelect;
export type NewDocumentTemplate = typeof documentTemplates.$inferInsert;
