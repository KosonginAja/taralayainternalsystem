import { pgTable, uuid, numeric } from 'drizzle-orm/pg-core';
import { payments } from './payments.js';
import { wallets } from './wallets.js';

export const paymentWalletAllocations = pgTable('payment_wallet_allocations', {
  id: uuid('id').primaryKey().defaultRandom(),
  paymentId: uuid('payment_id').notNull().references(() => payments.id, { onDelete: 'cascade' }),
  walletId: uuid('wallet_id').notNull().references(() => wallets.id, { onDelete: 'restrict' }),
  percentage: numeric('percentage', { precision: 5, scale: 2 }).notNull(),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
});

export type PaymentWalletAllocation = typeof paymentWalletAllocations.$inferSelect;
export type NewPaymentWalletAllocation = typeof paymentWalletAllocations.$inferInsert;
