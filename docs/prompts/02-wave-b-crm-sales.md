# Wave B — CRM + Sales Prompt

> **Prerequisite:** Wave A reviewed and committed.
> **Builds:** CRM module (leads/clients/contacts) + Sales module (pricelist/quotations/proposals/contracts).
> Note: Wave A created `lead_stages`/`lead_sources`; this wave adds the rest of CRM and all of Sales.

---

## BEGIN PROMPT — copy everything below this line

Execute **Wave B (CRM + Sales)** of the Taralaya OS build. Master boot + Wave A are in effect.

### Step 1 — Read these MCP files
1. `04-entity-definitions.md` → CRM entities (`leads`, `clients`, `contacts`); Sales entities (`pricelist_items`, `quotations`, `quotation_items`, `proposals`, `contracts`, `contract_documents`, `discounts`).
2. `07-drizzle-schema-plan.md` → §7.2 (CRM), §7.3 (Sales).
3. `08-migration-plan.md` → §8.2 Wave 2 ordering note (the `projects↔contracts↔quotations` cycle broken by nullable FKs).
4. `02-domain-model.md` → M02 (CRM), M03 (Sales): aggregates, invariants, events, services, repos.
5. `09-rest-api-design.md` → CRM section, Sales section (all endpoints).
6. `12-finance-design.md` → §12.2 (pricelist snapshot rule), §12.3 (quotation totals model).
7. `18-validation-rules.md` → §18.6 (document numbers QUO-/CTR-/PROP-/LEAD-/CL-), §18.8 (state machines for quotation/contract).
8. `10-permission-matrix.md` → CRM + Sales rows.

### Step 2 — Extend `packages/db` (Wave 2 tables)
Create schema for: `leads`, `clients`, `contacts`, `pricelist_items`, `quotations`, `quotation_items`, `proposals`, `contracts`, `contract_documents`, `discounts`. Follow the **cycle-breaking order** from Phase 8 §8.2 Wave 2:
1. `pricelist_items` (no FK)
2. `projects` — **STUB ONLY**: create the `projects` table with its columns + FKs to `clients`/`users`/`project_templates`, but **`contract_id` and `quotation_id` nullable**. Full project features land in Wave C; we only need the table to exist now so quotations/contracts can reference it.
3. `quotations` (refs clients, projects, leads; `converted_contract_id` nullable — back-refs contracts, added after contracts exist; **make it nullable now, FK constraint fine since it's nullable**)
4. `quotation_items`
5. `proposals`
6. `contracts` (refs clients, projects, quotations, proposals — all exist now)
7. `contract_documents`, `discounts`
8. Now back-add the `quotations.converted_contract_id → contracts.id` FK (nullable).

Add `relations()` for these tables. Generate migration `0003_wave2_crm_sales.sql` (+ the `projects` stub migration). Review DDL.

> **Important:** Wave C owns the **projects table's real definition + all project/task/milestone tables**. Here you only create the `projects` table skeleton (columns per Phase 4 §22) so Sales can FK to it. Do NOT create `tasks`, `milestones`, `project_members`, etc. — that's Wave C. Coordinate via a clear TODO comment in `projects.ts` that Wave C will complete the relations.

### Step 3 — Build `modules/crm`
Per Phase 9 CRM + Phase 2 M02:
- `routes/`: `leads.routes.ts` (list/create/update/delete/convert/stage/lost/assign/pipeline/activity), `clients.routes.ts` (list/create/detail/update/delete/merge/blacklist/contacts/projects/invoices/statement), `lead-stages.routes.ts` + `lead-sources.routes.ts` (catalog CRUD, `setting.manage`), `contacts.routes.ts` (update/delete).
- `services/`: `LeadService` (status transitions via configurable `lead_stages`; convert creates Client + sets `converted_at`/`converted_client_id`; lost marks with reason; reassign), `ClientService` (create/merge — merge reassigns child rows; blacklist; soft-delete blocked if projects/invoices exist), `ContactService` (primary-contact atomic swap; client XOR lead).
- `repositories/`: `LeadRepository`, `ClientRepository`, `ContactRepository` (audited).
- `dto/`: Zod schemas (lead requires email XOR phone; client type→legal_name rule; etc.).
- `domain/`: `leadStateMachine` (terminal: converted, lost), `clientStateMachine`.
- `events/`: emit `lead.created/qualified/converted/lost/reassigned`, `client.created/merged/deactivated`, `contact.*`. Subscribe → activity entries (Phase 16 catalog) + audit.

### Step 4 — Build `modules/sales`
Per Phase 9 Sales + Phase 2 M03 + Phase 12 §12.2–12.3:
- `routes/`: `pricelist.routes.ts` (CRUD + archive), `quotations.routes.ts` (full per Phase 9: items CRUD, send/accept/reject/convert/duplicate/pdf), `proposals.routes.ts` (CRUD + submit/accept/version), `contracts.routes.ts` (CRUD + sign/terminate/documents/pdf).
- `services/`:
  - `PricelistService` (CRUD + archive).
  - `QuotationService` — **totals recomputed from items on every save** (subtotal/discount/tax/grand); **price snapshot** into `quotation_items.unit_price` (never re-derive from pricelist); state machine (draft→sent→viewed→accepted|rejected|expired→converted); cannot accept past `valid_until`; immutable after `sent`.
  - `ProposalService` (versioned; submit/accept).
  - `ContractService` (create/sign/terminate; `signed_at ≤ start_date`; convert quotation→contract optionally creates project).
- `repositories/`: per entity (audited).
- `dto/`: Zod (quotation item snapshot, discount type/value, date validation `valid_until ≥ issue_date`).
- `domain/`: `quotationStateMachine`, `contractStateMachine`, `totals.ts` (pure: given items → totals; unit-test heavily).
- `events/`: emit `quotation.created/sent/viewed/accepted/rejected/expired/converted`, `proposal.*`, `contract.created/signed/terminated`. Subscribe → activity + audit; `contract.signed` is the kickoff event (enables project start, DP request — handlers may be stubs now, fully wired in later waves).
- Number sequences: `LEAD-`, `CL-`, `QUO-`, `PROP-`, `CTR-` via `NumberSequenceService`.

### Step 5 — Wire routers + permissions
- Mount CRM + Sales routers under `/api/v1`.
- Apply `@RequirePermission` per Phase 10 CRM/Sales rows (e.g. `lead.create`, `quotation.approve` for accept, `contract.approve` for sign, `quotation.manage` for convert).
- Cross-module rule: Sales services reference `clientId`/`projectId` but **do not query** clients/projects tables directly — call `ClientService.getById()` (CRM) for client detail if needed, or accept IDs and let FK constraints validate.

### Definition of Done (Wave B)

- [ ] Wave 2 tables created in dependency-safe order; migration applies cleanly; `projects` stub exists (Wave C completes it).
- [ ] CRM endpoints functional: create lead → transition stages → convert to client (client created, lead locked); blacklist blocks; merge reassigns children; soft-delete a client with invoices → `409/blocked`.
- [ ] Quotation totals correct: add items → subtotal/discount/tax/grand recomputed; **unit tests for totals.ts** cover fixed/percent discount, line+header discount, tax inclusive/exclusive.
- [ ] Price snapshot verified: change a pricelist price after quotation created → quotation line unchanged.
- [ ] State machines enforced: accept a quotation past `valid_until` → `422`; edit a `sent` quotation → `422`; sign a contract with `signed_at > start_date` → `422`.
- [ ] Document numbers generate correctly: `LEAD-2026-00001`, `CL-2026-00001`, `QUO-2026-00001`, `PROP-2026-00001`, `CTR-2026-00001`; a second quotation gets `...-00002`; voided/rejected numbers are NOT reused.
- [ ] Public IDs: `lead_1`, `cli_1`, `quo_1`, `prop_1`, `ctr_1` in all responses.
- [ ] Permissions enforced: sales role can CRUD quotations but cannot sign contracts (`contract.approve` not in sales role per matrix); manager can.
- [ ] Events fire: each cataloged CRM/Sales event writes an activity row + audit row (verify via the activity feed endpoint).
- [ ] Tests: unit (state machines, totals), integration (lead→client→quotation→contract happy path + key `422` cases).
- [ ] No raw cross-module SQL (grep your code: `modules/sales` must not import `crm` tables; it calls CRM services).
- [ ] typecheck + lint + build + test all green.

### Verification commands
```
pnpm turbo run typecheck lint build test
pnpm db:migrate
# manual E2E: lead → convert → quotation → accept → convert → contract signed
```

### Checkpoint — STOP
Report: schema files added, modules built, test counts, MCP ambiguities resolved, anything you flag as wrong in the spec. **Do not start Wave C.**

## END PROMPT
