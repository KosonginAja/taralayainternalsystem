import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const sql = neon(databaseUrl);
const db = drizzle(sql);

console.log('⏳ Running migrations...');
await migrate(db, {
  migrationsFolder: path.join(__dirname, 'migrations'),
});
console.log('✅ Migrations complete');
process.exit(0);
