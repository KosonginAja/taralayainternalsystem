import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { wallets, numberingSequences, companySettings } from './schema/index.js';
import { eq } from 'drizzle-orm';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const sql = neon(databaseUrl);
const db = drizzle(sql);

console.log('🌱 Seeding database...');

// ─── 1. Wallets ────────────────────────────────────────────────────────────────
const existingWallets = await db.select().from(wallets);
if (existingWallets.length === 0) {
  await db.insert(wallets).values([
    { name: 'Dompet Perusahaan', type: 'company', balance: '0.00' },
    { name: 'Dompet Penggajian', type: 'payroll', balance: '0.00' },
  ]);
  console.log('  ✅ Wallets seeded');
} else {
  console.log('  ⏭️  Wallets already exist, skipping');
}

// ─── 2. Numbering Sequences ────────────────────────────────────────────────────
const currentYear = new Date().getFullYear();
const existingSeqs = await db.select().from(numberingSequences);

if (existingSeqs.length === 0) {
  await db.insert(numberingSequences).values([
    {
      docType: 'quotation',
      prefix: 'QUO',
      format: '{PREFIX}/{YEAR}/{MONTH}/{SEQ}',
      currentSeq: 0,
      year: currentYear,
    },
    {
      docType: 'invoice',
      prefix: 'INV',
      format: '{PREFIX}/{YEAR}/{MONTH}/{SEQ}',
      currentSeq: 0,
      year: currentYear,
    },
  ]);
  console.log('  ✅ Numbering sequences seeded');
} else {
  console.log('  ⏭️  Numbering sequences already exist, skipping');
}

// ─── 3. Company Settings (initial empty row) ───────────────────────────────────
const existingSettings = await db.select().from(companySettings);
if (existingSettings.length === 0) {
  await db.insert(companySettings).values({
    name: 'Taralaya Studio',
    defaultWalletCompanyPct: '70.00',
    defaultWalletPayrollPct: '30.00',
  });
  console.log('  ✅ Company settings seeded');
} else {
  console.log('  ⏭️  Company settings already exist, skipping');
}

console.log('🎉 Seed complete');
process.exit(0);
