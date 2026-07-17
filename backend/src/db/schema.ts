import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

export const companySettings = sqliteTable('company_settings', {
  id: integer('id').primaryKey(),
  name: text('name'),
  logoUrl: text('logo_url'),
  address: text('address'),
  email: text('email'),
  phone: text('phone'),
  website: text('website'),
  npwp: text('npwp'),
  bankName: text('bank_name'),
  bankAccount: text('bank_account'),
  bankHolder: text('bank_holder'),
  description: text('description'),
  signatureUrl: text('signature_url'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const clients = sqliteTable('clients', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  company: text('company'),
  pic: text('pic'),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  npwp: text('npwp'),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
});

export const numberingCounters = sqliteTable('numbering_counters', {
  id: integer('id').primaryKey(),
  docType: text('doc_type', { enum: ['QT', 'INV'] }),
  year: integer('year'),
  lastNumber: integer('last_number').default(0),
});
