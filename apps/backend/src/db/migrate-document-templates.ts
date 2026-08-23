import 'dotenv/config';
import { db } from './connection.js';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Running document_templates migration...');
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS document_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        template_content TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Migration successful: document_templates table created.');
  } catch (err) {
    console.error('Migration failed:', err);
  }
  process.exit(0);
}

main();
