import { pgTable, uuid, text, numeric, timestamp } from 'drizzle-orm/pg-core';
import { wallets } from './wallets.js';
import { payments } from './payments.js';

export const walletTransactions = pgTable('wallet_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletId: uuid('wallet_id').notNull().references(() => wallets.id, { onDelete: 'restrict' }),
  paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'set null' }),
  type: text('type').notNull(), // 'in' | 'out'
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  balanceAfter: numeric('balance_after', { precision: 14, scale: 2 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type NewWalletTransaction = typeof walletTransactions.$inferInsert;
