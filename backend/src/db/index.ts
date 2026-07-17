import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import path from 'path';

// For docker, we will mount a volume to /app/data
const dbPath = process.env.NODE_ENV === 'production' || process.env.DOCKER_ENV 
  ? path.join('/app/data', 'sqlite.db')
  : path.join(process.cwd(), 'sqlite.db');

const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });
