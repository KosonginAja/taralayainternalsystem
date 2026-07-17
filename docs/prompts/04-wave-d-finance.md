# Wave D — Finance Prompt

> **Prerequisite:** Wave C reviewed and committed.
> **Builds:** Finance module (invoices/items/receipts/allocations/DP/expenses/incomes/snapshots/reports) + the worker app + event bus async wiring. **The money core.**

---

## BEGIN PROMPT — copy everything below this line

Execute **Wave D (Finance)**. Master boot + Waves A–C in effect. This wave is the most invariant-sensitive — extra rigor on money/allocation tests.

### Step 1 — Read these MCP files
1. `04-entity-definitions.md` → Finance entities: `invoices`, `invoice_items`, `receipts`, `receipt_allocations`, `down_payments`, `dp_allocations`, `expenses`, `expense_categories`, `incomes`, `income_categories`, `cashflow_snapshots`, `profit_snapshots`, `tax_rates`.
2. `07-drizzle-schema-plan.md` → §7.5.
3. `08-migration-plan.md` → §8.2 Wave 3.
4. `02-domain-model.md` → M05 (Finance): aggregates, invariants, events, services.
5. `12-finance-design.md` → **read in full** (money model, totals, payment_status, DP modes, cashflow/profit, period-close).
6. `09-rest-api-design.md` → Finance section + Reports.
7. `18-validation-rules.md` → §18.6 (`INV-`, `RCT-`, `DP-`, `EXP-`, `INC-`), §18.8 (invoice/DP state machines).
8. `10-permission-matrix.md` → Finance rows.
9. `13-automation-flow.md` → Finance automation events (overdue scan, DP auto-allocate, snapshot jobs).
10. `15-audit-system.md` → money mutations are all audited.

### Step 2 — Build `packages/db` Finance tables (Wave 3)
Per §7.5 + Phase 4. Note `invoices.subscription_id`/`billing_cycle_id` are **nullable** (Wave E owns subscriptions; FKs fine as nullable). Migration `0005_wave3_finance.sql`. Review DDL — especially the CHECK constraints (`due_date >= issue_date`, `amount > 0`, `paid_amount >= 0`, `grand_total >= 0`).

### Step 3 — Boot the worker app
Per `19-folder-architecture.md` §19.3 + Phase 13:
- `apps/worker/src/main.ts` boots queue consumers + cron scheduler.
- `core/queue` port (interface) + BullMQ adapter (Redis). Jobs: `send-notification`, `compute-snapshot`, `run-payroll` (Wave F), etc.
- Cron scheduler with distributed lock (so only one worker runs each job) — pick a lock backend (Redis).
- The worker imports `packages/db` (same schema as backend) + relevant services.

### Step 4 — Build `modules/finance`
Per Phase 9 Finance + Phase 2 M05 + Phase 12:

- `routes/`: `invoices.routes.ts`, `receipts.routes.ts`, `down-payments.routes.ts`, `expenses.routes.ts`, `incomes.routes.ts`, catalog routes (`expense-categories`, `income-categories`, `tax-rates`), `reports.routes.ts` (cashflow/profit/ar-aging/revenue-by-project).

- `services/`:
  - **`InvoiceService`** — totals recomputed from items (subtotal/discount/tax/grand); price snapshot from pricelist; state machine (draft→issued→sent→paid|partial|overdue|uncollectible→voided); `issue` locks financials (immutable after); `void` reverses all allocations and recomputes paid_amount/balance/payment_status on affected invoices; **idempotent** via `external_ref` + `Idempotency-Key` header.
  - **`ReceiptService`** — record payment (amount>0); `allocate(invoiceId, amount)` enforces **`Σ allocations ≤ invoice.grand_total`** under a **row lock** on the invoice (use `SELECT ... FOR UPDATE` within `withTx`); updates `invoices.paid_amount/balance/payment_status` in the same transaction; void reverses allocations.
  - **`DownPaymentService`** — collect (`mode: unlimited|manual`); allocate to invoice (same invariant as receipts, shared lock logic); `mode=unlimited` auto-allocates to newly-issued invoices (via event handler, see Step 6); refund reduces balance + posts reversal; `balance` kept current.
  - `ExpenseService` (approval workflow above threshold `finance.expense_approval_threshold`; void reverses), `IncomeService`.
  - `FinanceReportingService` — reads snapshots for cashflow/profit; AR aging live (indexed `idx_inv_status(status, due_date)`); revenue-by-project group-by.

- `repositories/`: per entity (audited). Allocation repos operate within the service's transaction.

- `dto/`: Zod (money fields as decimal-strings; currency ISO-4217; date validations).

- `domain/`:
  - `invoiceStateMachine`, `paymentStatusMachine`, `downPaymentStateMachine`.
  - `totals.ts` (pure; reuse pattern from quotation).
  - `allocationRules.ts` (pure: given existing allocations + new allocation → ok or throw; unit-test the cap invariant).
  - Money VO from `core/validation` used everywhere.

- `events/`: emit `invoice.created/issued/sent/paid/partial/voided/overdue`, `receipt.created/allocated/voided`, `dp.collected/allocated/refunded`, `expense.approved/paid/voided`, `income.created`, `cashflow.snapshot.computed`, `profit.snapshot.computed`. Subscribe → activity + audit.

### Step 5 — Denormalized payment fields (correctness)
- `invoices.paid_amount = Σ active receipt_allocations + Σ active dp_allocations`.
- `balance = grand_total − paid_amount`.
- `payment_status`: unpaid (0) / partial / paid / overpaid (>).
- Updated **in the same transaction** as the allocation change.
- Write a **nightly reconciliation job** (worker cron) that recomputes and asserts these match; logs discrepancies to audit (action `data_migration` style) and alerts. (Phase 6 §6.2, Phase 12 §12.13.)

### Step 6 — Async event handlers (worker)
Per Phase 13 Finance automation:
- On `invoice.issued` + client has an `unlimited` DP → auto-allocate (worker consumer).
- Cron daily `invoice.overdue.scan`: `due_date < today AND payment_status ≠ paid AND status ≠ voided` → set `overdue`, emit `invoice.overdue`, schedule reminder (Notification stub until Wave G — log for now).
- Cron daily `cashflow.snapshot` + `profit.snapshot`: compute per granularity × currency, upsert into snapshot tables (unique key).
- Respect `finance.accounting_basis` (cash vs accrual) and period-close (`finance.period.<yyyy-mm>.closed`).

### Definition of Done (Wave D)

- [ ] Finance tables + CHECK constraints present; migration applies.
- [ ] Worker app boots, connects Redis, runs schedulers with distributed lock; jobs are idempotent.
- [ ] Invoice totals correct (unit test `totals.ts` + integration); price snapshot from pricelist verified.
- [ ] **Allocation invariant** tested rigorously: try to over-allocate an invoice (receipt + DP combined) → `422` and no partial write; concurrency test (two parallel allocations racing against the cap) → exactly one succeeds, other `409/422`.
- [ ] `paid_amount/balance/payment_status` stay consistent after every allocation/void (write the test that voids a receipt and checks the invoice's payment_status drops back).
- [ ] DP unlimited mode auto-allocates new invoices; manual mode does not; refund reduces balance; both DP and receipt allocations feed the same `paid_amount`.
- [ ] Void invoice reverses allocations; voided invoice's financials frozen.
- [ ] Expense approval workflow: below threshold → can skip to paid; above → must approve first.
- [ ] Cashflow/profit snapshot jobs produce correct numbers for a seeded scenario (write a scenario test).
- [ ] Document numbers: `INV-`, `RCT-`, `DP-`, `EXP-`, `INC-` yearly sequences; voided numbers not reused.
- [ ] Public IDs: `inv_`, `rct_`, `dp_`, `exp_`, `inc_`.
- [ ] Permissions: finance role can post receipts/void invoices; sales role can create invoices but NOT issue (`invoice.approve`); enforced.
- [ ] Idempotency: re-POST a receipt with same `Idempotency-Key`/`external_ref` → returns original, no duplicate.
- [ ] Period close: can't post into a closed period (`finance.period.2026-06.closed=true` blocks June-dated postings → `422`).
- [ ] Reconciliation job: seeds a deliberate mismatch → job detects + logs.
- [ ] Events → activity + audit for all Finance money mutations.
- [ ] No raw cross-module SQL; `modules/finance` calls Delivery/CRM/Sales services for derived client/project/contract data.
- [ ] typecheck/lint/build/test green.

### Verification
```
pnpm turbo run typecheck lint build test
pnpm db:migrate
# start worker: pnpm --filter worker dev
# E2E: invoice → issue → receipt allocate (partial then full) → payment_status paid; DP scenario; void scenario
```

### Checkpoint — STOP
Report: finance module, worker app, test counts (call out the concurrency/allocation test results), ambiguities, spec concerns. **Do not start Wave E.**

## END PROMPT
