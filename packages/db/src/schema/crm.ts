import {
  bigint,
  boolean,
  date,
  decimal,
  index,
  int,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { id, auditColumns, softDelete } from './_helpers';

// ─────────────────────────────────────────────
// lead_stages (catalog — Wave 0)
// ─────────────────────────────────────────────
export const leadStages = mysqlTable(
  'lead_stages',
  {
    id: id(),
    key: varchar('key', { length: 32 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    position: int('position').notNull(),
    isWon: boolean('is_won').notNull().default(false),
    isLost: boolean('is_lost').notNull().default(false),
    isDefault: boolean('is_default').notNull().default(false),
    ...auditColumns(),
    ...softDelete(),
  },
  (t) => ({
    uqKey: uniqueIndex('uq_leadstage_key').on(t.key),
    idxPosition: index('idx_leadstage_position').on(t.position),
  }),
);

// ─────────────────────────────────────────────
// lead_sources (catalog — Wave 0)
// ─────────────────────────────────────────────
export const leadSources = mysqlTable(
  'lead_sources',
  {
    id: id(),
    name: varchar('name', { length: 120 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    ...auditColumns(),
    ...softDelete(),
  },
  (t) => ({
    uqName: uniqueIndex('uq_leadsource_name').on(t.name),
  }),
);

// Exported types
export type LeadStage = typeof leadStages.$inferSelect;
export type NewLeadStage = typeof leadStages.$inferInsert;
export type LeadSource = typeof leadSources.$inferSelect;
export type NewLeadSource = typeof leadSources.$inferInsert;
