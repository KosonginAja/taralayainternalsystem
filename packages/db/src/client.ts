import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from './schema';

export type DbClient = ReturnType<typeof createClient>;

export function createClient(databaseUrl: string) {
  const pool = mysql.createPool(databaseUrl);
  return drizzle(pool, { schema, mode: 'default' });
}

/**
 * Transaction helper. All business operations that span multiple writes
 * should use this to ensure atomicity.
 *
 * @example
 * await withTx(db, async (tx) => {
 *   await tx.insert(users).values(...);
 *   await tx.insert(userRoles).values(...);
 * });
 */
export async function withTx<T>(
  db: DbClient,
  fn: (tx: Parameters<Parameters<DbClient['transaction']>[0]>[0]) => Promise<T>,
): Promise<T> {
  return db.transaction(fn);
}

export { schema };
export * from './schema';
