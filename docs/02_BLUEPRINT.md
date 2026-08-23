# Taralaya OS V2 — Implementation Blueprint

Stack: React (Vite) + TypeScript + Tailwind (FE) · Express + TypeScript (BE) · NeonDB + Drizzle ORM (DB)

Phase 1–6 (below) were originally "Business OS V1" — now absorbed as the foundation of Taralaya OS V2, all already built and running locally. Phase 7 onward is new V2 scope.

**Rule for the implementer (Antigravity):**
Work through phases in order. Each task below has a matching entry in `progress.json` with the same `id`. After finishing a task, update its `status` in `progress.json` from `"Pending"` to `"Done"` before moving to the next one. Do not skip ahead out of order unless a task is explicitly marked optional.

---

## Phase 1 — Foundation ✅ Done

**p1-b1 — Project scaffolding**
Set up two apps: `/frontend` (Vite + React + TS + Tailwind) and `/backend` (Express + TS). Shared `.env` convention for NeonDB connection string.

**p1-b2 — DB connection & Drizzle setup**
Install Drizzle ORM + Neon serverless driver. Configure `drizzle.config.ts`, migration folder, connection singleton.

**p1-b3 — Core schema migration**
Create tables: `company_settings`, `clients`, `numbering_sequences`, `wallets`. Seed `wallets` with the 2 fixed rows (company, payroll).

**p1-b4 — Super admin auth**
Single hardcoded/seeded admin credential. Simple session or JWT-based login.

**p1-b5 — Company Settings module**
Backend: GET/PUT single-row endpoint. Frontend: settings page (name, logo upload, address, contact, bank info, default wallet split %). Logo goes to external storage — only the URL is saved.

**p1-b6 — Client Management module**
Backend: CRUD endpoints. Frontend: list + create/edit form + detail view.

---

## Phase 2 — Pricelist ✅ Done

**p2-b1 — Pricelist schema migration** — `pricelist_items`, `packages`, `package_items`.
**p2-b2 — Pricelist Satuan API**
**p2-b3 — Pricelist Paket API**
**p2-b4 — Pricelist Satuan UI**
**p2-b5 — Pricelist Paket UI**

---

## Phase 3 — Quotation ✅ Done

**p3-b1 — Quotation schema migration** — `quotations`, `quotation_items`.
**p3-b2 — Numbering logic**
**p3-b3 — Quotation CRUD API**
**p3-b4 — Revision logic**
**p3-b5 — Quotation Builder UI**
**p3-b6 — Quotation PDF generation** (on-demand, no `pdf_url`)
**p3-b7 — Quotation list/detail UI**

---

## Phase 4 — Invoice ✅ Done

**p4-b1 — Invoice schema migration** — `invoices`, `invoice_items`, `invoice_installments`.
**p4-b2 — Invoice creation API**
**p4-b3 — Payment terms logic** (full/dp/custom)
**p4-b4 — Invoice Builder UI**
**p4-b5 — Invoice PDF generation** (on-demand)
**p4-b6 — Invoice list/detail UI**

---

## Phase 5 — Payment Recording & Wallet ✅ Done

**p5-b1 — Payment/wallet schema migration** — `payments`, `payment_wallet_allocations`, `wallet_transactions`.
**p5-b2 — Record payment API**
**p5-b3 — Wallet allocation API**
**p5-b4 — Record Payment UI**
**p5-b5 — Wallet dashboard UI**

---

## Phase 6 — Polish (V1 scope) ✅ Done

**p6-b1 — Numbering config UI**
**p6-b2 — Overview dashboard**
**p6-b3 — Validation & error handling pass**
**p6-b4 — Deployment preparation & build verification**

> Actual deployment now handled separately — see `03_DEPLOYMENT.md` (VPS + PM2 approach).

---

## Phase 7 — Project Management (new V2 scope)

Fills the gap flagged earlier: once a quotation is accepted, there was no system tracking the actual delivery work. No team/user assignment yet — that lands in Phase 8; for now projects are tracked at the super-admin level, same as everything else.

**p7-b1 — Project schema migration**
Create `projects`, `project_tasks` (see `01_DB_SCHEMA.md`).

**p7-b2 — Auto-create project on quotation accepted**
When a quotation's status transitions to `accepted`, auto-create a linked `projects` row (status `not_started`), pre-filled with client + quotation reference. Also allow manual project creation independent of a quotation.

**p7-b3 — Project CRUD API**
List, detail, update (status, dates, description), delete.

**p7-b4 — Project Task API**
CRUD for `project_tasks` within a project, reorderable (`sort_order`).

**p7-b5 — Project Kanban/List UI**
Board view grouped by status (`not_started` / `in_progress` / `review` / `completed` / `on_hold` / `cancelled`), drag or dropdown to change status.

**p7-b6 — Project Detail UI**
Task checklist, deadline, linked quotation/invoice, description, status history.

---

## Phase 8 — Team & Payroll

Introduces multi-user. Replaces the single super-admin auth from Phase 1 with role-based access.

**p8-b1 — Users schema migration**
Create `users` (see `01_DB_SCHEMA.md`).

**p8-b2 — Multi-user auth**
Extend Phase 1 auth: login against `users` table instead of a single hardcoded credential. Password hashing, session/JWT per user.

**p8-b3 — Role-based access middleware**
Backend middleware gating routes/actions by `role` (`admin` full access, `member` restricted — e.g. can't edit company settings, pricelist, or wallet).

**p8-b4 — Add assignee to project_tasks**
Migration: add `assignee_id` (FK -> users.id, nullable) to `project_tasks`. Update Task API/UI to allow assignment.

**p8-b5 — Team Management UI**
Admin-only page: invite/add member, edit role, deactivate user.

**p8-b6 — Payroll schema migration**
Create `payroll_entries` (see `01_DB_SCHEMA.md`).

**p8-b7 — Payroll API**
Create payroll entry per user per period, mark as paid → writes a `wallet_transaction` (type `out`) against the Payroll wallet, same pattern as invoice payments.

**p8-b8 — Payroll UI**
List payroll entries per user/period, mark-as-paid action, links to wallet ledger entry.

---

## Phase 9 — Expense Tracking

**p9-b1 — Expenses schema migration**
Create `expenses` (see `01_DB_SCHEMA.md`).

**p9-b2 — Expense API**
CRUD for expenses. On creation, writes a `wallet_transaction` (type `out`) against the chosen wallet — same ledger pattern used for payments/payroll.

**p9-b3 — Expense UI**
List with category/date filters, add/edit form, receipt upload (external storage, URL only — same rule as company logo).

**p9-b4 — Wallet dashboard update**
Extend the Phase 5 wallet ledger view to clearly show expense-driven outflows alongside payment-driven inflows.

---

## Phase 10 — CRM / Lead Pipeline

**p10-b1 — Leads schema migration**
Create `leads` (see `01_DB_SCHEMA.md`).

**p10-b2 — Lead CRUD API**
Create/list/detail/update, status pipeline transitions (`new → contacted → qualified → proposal_sent → won/lost`).

**p10-b3 — Convert Lead to Quotation**
Action that pre-fills a new client (if not existing) + opens Quotation Builder pre-filled from lead data; on quotation creation, sets `leads.converted_quotation_id` and marks lead `won`.

**p10-b4 — Lead Pipeline UI**
Kanban board grouped by status, drag or dropdown to change stage.

---

## Phase 11 — Reporting Dashboard

No new tables — this phase is aggregation/read endpoints over existing data (invoices, payments, expenses, projects).

**p11-b1 — Revenue & profit reporting API**
Aggregate revenue (from paid invoices) and expenses/payroll (outflows) per period/project → profit margin.

**p11-b2 — Project completion reporting API**
% of projects by status, average time-to-completion (from `projects.start_date`/`deadline`/actual completion).

**p11-b3 — Cash flow overview API**
Wallet balance trend over time, derived from `wallet_transactions`.

**p11-b4 — Reporting Dashboard UI**
Charts: revenue trend, profit margin, project status distribution, cash flow over time. Extends the Phase 6 overview dashboard rather than replacing it.

---

## Phase 12 — Document Generator (optional)

Revisit only once manual document creation (contract, BAST, company profile — currently done in Word/Canva per earlier decision) actually becomes a bottleneck.

**p12-b1 — Document templates schema migration**
Create `document_templates` (see `01_DB_SCHEMA.md`).

**p12-b2 — Template CRUD API + placeholder engine**
Templates store HTML/rich text with placeholders (e.g. `{{client.name}}`, `{{project.deadline}}`). API merges live data from clients/projects/invoices into a template on request.

**p12-b3 — Document generation endpoint**
Same on-demand PDF pattern as quotation/invoice (Phase 3/4) — generated per request, not stored.

**p12-b4 — Template Editor UI**
Admin-only page to create/edit templates per document type (contract, BAST, company profile, etc.).

**p12-b5 — "Generate document" action**
Button on Project/Client/Invoice detail pages to generate a document from a chosen template, pre-filled with that record's data.

---

## Explicitly out of scope (until further notice)

Client Portal, e-signature, Automation, Subscription billing, Multi-tenant SaaS.
