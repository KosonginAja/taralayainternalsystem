import {
  bigint,
  char,
  decimal,
  timestamp,
  varchar,
} from 'drizzle-orm/mysql-core';

/**
 * Standard BIGINT UNSIGNED auto-increment primary key.
 */
export const id = () =>
  bigint('id', { mode: 'bigint', unsigned: true }).autoincrement().primaryKey();

/**
 * The 4 mandatory audit columns on every table.
 */
export const auditColumns = () => ({
  createdAt: timestamp('created_at', { mode: 'date', fsp: 0 })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date', fsp: 0 })
    .notNull()
    .defaultNow()
    .onUpdateNow(),
  createdBy: bigint('created_by', { mode: 'bigint', unsigned: true }),
  updatedBy: bigint('updated_by', { mode: 'bigint', unsigned: true }),
});

/**
 * Soft-delete column. Appended on every business entity table.
 */
export const softDelete = () => ({
  deletedAt: timestamp('deleted_at', { mode: 'date', fsp: 0 }),
});

/**
 * DECIMAL(18,2) money column. Always paired with a currency column.
 * @param name Column name
 */
export const moneyCol = (name: string) =>
  decimal(name, { precision: 18, scale: 2 }).notNull().default('0.00');

/**
 * CHAR(3) ISO-4217 currency code column.
 * @param name Column name (default: 'currency')
 */
export const currencyCol = (name = 'currency') =>
  char(name, { length: 3 }).notNull().default('USD');

/**
 * DECIMAL(8,5) percentage column for revenue-share / payroll rules.
 * @param name Column name
 */
export const percentCol = (name: string) =>
  decimal(name, { precision: 8, scale: 5 });

/**
 * VARCHAR(32) generic status column. Validated at app level against typed enum.
 */
export const statusCol = () => varchar('status', { length: 32 });
