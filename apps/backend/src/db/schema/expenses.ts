import { pgTable, uuid, text, numeric, date, timestamp } from 'drizzle-orm/pg-core';
import { wallets } from './wallets.js';
import { users } from './users.js';

export const expenses = pgTable('expenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  category: text('category').notNull(),
  description: text('description').notNull(),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  date: date('date').notNull(),
  walletId: uuid('wallet_id').notNull().references(() => wallets.id, { onDelete: 'restrict' }),
  receiptUrl: text('receipt_url'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
