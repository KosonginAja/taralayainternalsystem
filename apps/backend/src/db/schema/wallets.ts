import { pgTable, uuid, text, numeric, timestamp } from 'drizzle-orm/pg-core';

export const wallets = pgTable('wallets', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'company' | 'payroll'
  balance: numeric('balance', { precision: 14, scale: 2 }).notNull().default('0.00'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Wallet = typeof wallets.$inferSelect;
export type NewWallet = typeof wallets.$inferInsert;
