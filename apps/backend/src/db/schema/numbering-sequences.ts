import { pgTable, uuid, text, integer } from 'drizzle-orm/pg-core';

export const numberingSequences = pgTable('numbering_sequences', {
  id: uuid('id').primaryKey().defaultRandom(),
  docType: text('doc_type').notNull(), // 'quotation' | 'invoice'
  prefix: text('prefix').notNull(),
  format: text('format').notNull(), // e.g. '{PREFIX}/{YEAR}/{MONTH}/{SEQ}'
  currentSeq: integer('current_seq').notNull().default(0),
  year: integer('year').notNull(),
});

export type NumberingSequence = typeof numberingSequences.$inferSelect;
export type NewNumberingSequence = typeof numberingSequences.$inferInsert;
