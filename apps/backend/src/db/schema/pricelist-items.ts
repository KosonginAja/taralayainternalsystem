import { pgTable, uuid, text, numeric, boolean, timestamp } from 'drizzle-orm/pg-core';

export const pricelistItems = pgTable('pricelist_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  unit: text('unit'),
  price: numeric('price', { precision: 14, scale: 2 }).notNull().default('0.00'),
  category: text('category'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type PricelistItem = typeof pricelistItems.$inferSelect;
export type NewPricelistItem = typeof pricelistItems.$inferInsert;
