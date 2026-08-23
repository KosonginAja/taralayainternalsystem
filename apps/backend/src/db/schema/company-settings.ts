import { pgTable, uuid, text, numeric, timestamp } from 'drizzle-orm/pg-core';

export const companySettings = pgTable('company_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().default(''),
  logoUrl: text('logo_url'),
  address: text('address'),
  phone: text('phone'),
  email: text('email'),
  taxId: text('tax_id'),
  bankName: text('bank_name'),
  bankAccountNumber: text('bank_account_number'),
  bankAccountHolder: text('bank_account_holder'),
  signatureUrl: text('signature_url'),
  defaultWalletCompanyPct: numeric('default_wallet_company_pct', { precision: 5, scale: 2 }).notNull().default('70.00'),
  defaultWalletPayrollPct: numeric('default_wallet_payroll_pct', { precision: 5, scale: 2 }).notNull().default('30.00'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type CompanySettings = typeof companySettings.$inferSelect;
export type NewCompanySettings = typeof companySettings.$inferInsert;
