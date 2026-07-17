import { betterAuth } from 'better-auth';
import { db } from './db';
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = process.env.NODE_ENV === 'production' || process.env.DOCKER_ENV 
  ? path.join('/app/data', 'sqlite.db')
  : path.join(process.cwd(), 'sqlite.db');

const sqlite = new Database(dbPath);

export const auth = betterAuth({
    database: sqlite,
    emailAndPassword: {
        enabled: true,
    },
});
