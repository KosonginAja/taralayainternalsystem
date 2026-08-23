import 'dotenv/config';
import { db } from './connection.js';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('Running Phase 8 team/payroll migrations...');
  try {
    // 1. users table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Created users table.');

    // 2. payroll_entries table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS payroll_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        period TEXT NOT NULL,
        base_salary NUMERIC(14, 2) NOT NULL DEFAULT '0.00',
        commissions NUMERIC(14, 2) NOT NULL DEFAULT '0.00',
        bonuses NUMERIC(14, 2) NOT NULL DEFAULT '0.00',
        deductions NUMERIC(14, 2) NOT NULL DEFAULT '0.00',
        net_pay NUMERIC(14, 2) NOT NULL DEFAULT '0.00',
        status TEXT NOT NULL DEFAULT 'draft',
        transaction_id UUID REFERENCES wallet_transactions(id) ON DELETE SET NULL,
        paid_at TIMESTAMPTZ,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Created payroll_entries table.');

    // 3. Add assignee_id to project_tasks
    await db.execute(sql`
      ALTER TABLE project_tasks 
      ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES users(id) ON DELETE SET NULL;
    `);
    console.log('Added assignee_id to project_tasks.');

    // 4. Seed the first admin user
    const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@taralaya.com';
    const adminPass = process.env.ADMIN_PASSWORD ?? 'changeme';
    const hash = await bcrypt.hash(adminPass, 10);

    await db.execute(sql`
      INSERT INTO users (email, password_hash, name, role)
      VALUES (${adminEmail}, ${hash}, 'Super Admin', 'admin')
      ON CONFLICT (email) DO NOTHING;
    `);
    console.log(`Seeded admin user: ${adminEmail}`);

    console.log('Migration successful!');
  } catch (err) {
    console.error('Migration failed:', err);
  }
  process.exit(0);
}

main();
