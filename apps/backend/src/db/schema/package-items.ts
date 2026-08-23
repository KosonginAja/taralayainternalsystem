import { pgTable, uuid, numeric } from 'drizzle-orm/pg-core';
import { packages } from './packages.js';
import { pricelistItems } from './pricelist-items.js';

export const packageItems = pgTable('package_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  packageId: uuid('package_id').notNull().references(() => packages.id, { onDelete: 'cascade' }),
  pricelistItemId: uuid('pricelist_item_id').notNull().references(() => pricelistItems.id, { onDelete: 'restrict' }),
  qty: numeric('qty', { precision: 10, scale: 2 }).notNull().default('1'),
});

export type PackageItem = typeof packageItems.$inferSelect;
export type NewPackageItem = typeof packageItems.$inferInsert;
