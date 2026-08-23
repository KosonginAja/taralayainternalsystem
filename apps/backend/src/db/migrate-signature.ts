import { db } from './connection.js';
import { sql } from 'drizzle-orm';

async function migrate() {
  console.log('Running migration: add signature_url to company_settings...');
  await db.execute(
    sql`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS signature_url TEXT`
  );
  console.log('Migration complete');
  process.exit(0);
}

migrate().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
