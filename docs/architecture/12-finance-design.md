# Phase 12 — Finance Design

> Modules: **Pricelist, Quotation, Invoice, Expense, Income, Cashflow, Profit, Subscription, Tax (future).**
> **DP System:** supports **Unlimited DP** and **Manual DP** modes, **Remaining Balance**, **Payment Status**.

This phase focuses on the **finance mechanics** (the entity-level schema is in Phase 4; here we model the *flows and rules*).

---

## 12.1 The money model (foundational)

- Every amount is `DECIMAL(18,2)` + a `currency CHAR(3)`.
- A `Money` value object (amount + currency) is used in all services.
- **Operations are currency-aware:** you cannot add two `Money` values of different currencies (service throws). Conversion is *future*.
- Rounding: 2 decimals, banker's rounding, configurable via `finance.rounding_mode`.
- Money flows one direction at a time; every flow is **double-entry in spirit** (every credit has a debit somewhere) even though we don't store a formal ledger today.

---

## 12.2 Pricelist

- Catalog of services with `unit_price`, `unit` (hour/day/item/month/project), `currency`, `effective_from/to`.
- **Snapshot rule:** when a pricelist item is added to a quotation or invoice, the `unit_price` is **copied** into the line item. Later pricelist changes never alter historical documents. (Enforced in `QuotationService`/`InvoiceService`.)
- Archiving (`is_active=false`) hides from new selections but keeps historical references intact.

---

## 12.3 Quotation → totals model

A quotation's totals are **derived from items**, recomputed on every save:

```
line_total_i = quantity_i × unit_price_i
             − discount_i (fixed or percent of gross)
             + tax_i (if inclusive=false, else embedded)
subtotal      = Σ line_total (pre-tax, pre-total-discount)
discount_total = Σ line discounts + any header-level discount
tax_total      = Σ tax (per line, from tax_rate)
grand_total    = subtotal − header_discount + tax_total
```

Header discount can be `fixed` or `percent` (of subtotal). All in the quotation's `currency`.

**States:** `draft → sent → viewed → accepted/rejected/expired → converted`.
- `accepted` enables `convert` → creates a Contract (and optionally a Project).
- Quotation is **immutable** after `sent` except for status transitions and notes.

---

## 12.4 Invoice model (the core finance object)

### Totals (derived from items, like quotation)
`subtotal, discount_total, tax_total, grand_total` — recomputed on save.

### Payment state (derived from allocations)
- `paid_amount = Σ receipt_allocations.amount (active) + Σ dp_allocations.amount (active)`
- `balance = grand_total − paid_amount`
- `payment_status`:
  - `paid_amount == 0` → `unpaid`
  - `0 < paid_amount < grand_total` → `partial`
  - `paid_amount == grand_total` → `paid`
  - `paid_amount > grand_total` → `overpaid` (flag; excess becomes client credit / refundable)

> **Why store `paid_amount`/`balance`/`payment_status` denormalized?** They're on every invoice list view and AR report. Recomputing from allocations on each render is expensive and join-heavy. We update them **in the same transaction** as the allocation change, and a nightly reconciliation job verifies them. (Phase 6 §6.2.)

### Status (lifecycle) vs payment_status (financial)
These are **two separate axes**:
- `status` (workflow): `draft → issued → sent → (paid|partial|overdue|uncollectible) → voided`.
- `payment_status` (money): `unpaid|partial|paid|overpaid|voided`.

An invoice can be `status=issued, payment_status=partial`. Voiding sets both to `voided`.

### Transitions & guards
| From → To | Guard |
|---|---|
| draft → issued | totals valid; items present; `issue` permission (`invoice.approve`) |
| issued → sent | has a client contact/channel |
| * → paid | `paid_amount == grand_total` (automatic when allocation reaches total) |
| * → overdue | `due_date < today AND payment_status != paid` (cron) |
| * → void | voiding reverses all allocations (receipt + DP); sets a reversal timestamp; financial fields frozen. |
| paid → (nothing) | a paid invoice can only be voided (with reversal), not edited. |

### Idempotency
- `external_ref` (gateway id) is unique when present; recording the same payment twice returns the original receipt.
- `Idempotency-Key` header supported on create.

---

## 12.5 Receipts & allocations

A **Receipt** is money received from a client. It may be:
- **Allocated** to one or more invoices via `receipt_allocations`.
- **Partially unallocated** (remainder becomes client credit / DP).

**Allocation rule (hard invariant):**
```
Σ allocations to an invoice (active) ≤ invoice.grand_total
```
Enforced in `ReceiptService.allocate()` with a **row lock** on the invoice (and its existing allocations) within the transaction. Over-allocation → `422`.

**Voiding a receipt:** reverses (soft-marks) all its allocations; recomputes affected invoices' paid_amount/balance/payment_status.

---

## 12.6 Down Payment (DP) System — the two modes

The brief requires **Unlimited DP** and **Manual DP**, plus **Remaining Balance** and **Payment Status**.

### Concepts
- A **DownPayment** is money collected **before** the corresponding invoice exists (at contract signing / kickoff), to be applied later.
- It has a `balance` (= amount − allocated − refunded).
- `mode`:
  - **`unlimited`** — the DP auto-applies to the client's invoices as they're issued, until exhausted. Useful for retainer-style "pay in advance."
  - **`manual`** — the DP is applied to specific invoices explicitly by finance. Default mode (safer, more control).

### Allocation mechanics
- `dp_allocations` mirror `receipt_allocations` (DP → invoice).
- Same hard invariant: Σ DP allocations to an invoice + Σ receipt allocations ≤ grand_total.
- When `mode=unlimited`, a hook on `invoice.issued` auto-creates allocations from the oldest DP with a positive balance, up to the invoice total (or DP exhaustion).
- **Remaining balance** of a DP = `balance` field, kept current.
- **Payment status of a DP**: `collected → partially_allocated → fully_allocated → refunded`.

### Refunds
- `POST /down-payments/{id}/refund` reduces balance and posts a negative income/expense (configurable category). Refunded amount tracked separately.

### DP vs Receipt — when to use which
| Use Receipt when | Use DP when |
|---|---|
| Money received against a **known** invoice | Money received **before** an invoice exists |
| Client pays a specific bill | Client prepays / deposits at kickoff |
| Allocation is immediate | Allocation deferred to future invoices |

Both feed into an invoice's `paid_amount`, so the unified `payment_status` is consistent.

---

## 12.7 Expenses

- Money **out**. Fields: category, amount, currency, payment_date, method, project/client link (optional), vendor, receipt_url, status.
- **Approval workflow:** if `amount ≥ setting(finance.expense_approval_threshold)`, status must go `draft → pending_approval → approved → paid`. Below threshold, can skip to paid.
- Voiding an expense posts a reversal (reduces outflow in cashflow).
- Expenses categorized for P&L: `operating, cost_of_goods, payroll, tax, other`.

---

## 12.8 Income (non-invoice)

- Money **in** that isn't a client invoice payment (grants, interest, miscellaneous).
- Has category, amount, date, optional client/project link.
- Feeds cashflow & revenue (non-operating tagged separately).

---

## 12.9 Cashflow

**Cashflow = (money in) − (money out) over a period.**

| Inflow sources | Outflow sources |
|---|---|
| Receipts (allocated) | Expenses (paid) |
| Incomes | Payroll (posted) |
| DP collected (cash in, even if not yet allocated) | DP refunded |
| | Taxes paid (future) |

**Implementation:**
- A **snapshot job** (`cron: daily`) computes `cashflow_snapshots` per day/week/month/quarter/year × currency, storing `inflow, outflow, net`.
- Dashboards read snapshots (fast) instead of live-joining every financial table.
- A **live** endpoint can recompute a custom range on demand (slower, for ad-hoc).

---

## 12.10 Profit (P&L)

```
revenue          = invoice grand_totals (issued in period, by cash or accrual basis — configurable)
                   + non-invoice incomes
− cost_of_goods  = expenses categorized as cost_of_goods
− operating_expenses = expenses categorized as operating/other
− payroll        = posted payroll (salary + revenue_share)
= net_profit
```

- **Basis** configurable: `finance.accounting_basis` = `cash` (only when paid) or `accrual` (when invoiced). Default `accrual`.
- Snapshot job writes `profit_snapshots` per granularity.
- Per-project profit = project's revenue − project's expenses − project's payroll (drives the "was this project profitable?" view).

---

## 12.11 Subscription (recurring billing)

- A **Plan** defines interval + amount.
- A **Subscription** binds a client to a plan with `current_period_start/end`, `auto_renew`.
- A cron (`billing:cycle:generate`) creates **BillingCycle** rows as periods elapse; each cycle generates an **Invoice** via `InvoiceService` (idempotent: one invoice per cycle).
- **MCO (Maintenance Contract Order)** is a specialized subscription tied to maintenance: monthly hours/fee, drives maintenance ticket SLAs and renewal reminders.
- Renewal/expiration events update `subscriptions.status` and fire reminders (Phase 13).

---

## 12.12 Tax (future, prepared)

- `tax_rates` table exists (reserved) with `rate`, `is_inclusive`, `country`, `region`, `effective_from/to`.
- Invoice/quotation items reference `tax_rate_id`; tax_total computed per line.
- **Not building** a full tax engine now (withholding, reverse charge, VAT MOSS) — that's a future module. The schema leaves room.

---

## 12.13 Cross-cutting finance rules

1. **No negative invoices** — grand_total ≥ 0 (credit notes modeled as negative-line invoices or a separate `credit_notes` table later; today: void + reissue).
2. **Void, never delete** — financial records are voided (reversible) not hard-deleted.
3. **Single source of truth for "paid"** — always derive from allocations, store denormalized, reconcile nightly.
4. **Period boundaries** — once a period is "closed" (a `settings` flag `finance.period.<yyyy-mm>.closed=true`), postings into it are blocked except via reversal (accounting-style period close).
5. **Currency consistency within a document** — an invoice/quotation has one currency; mixed-currency lines are not allowed.
6. **Receipt/DP amount > 0** enforced by CHECK.
7. **All finance mutations are audited** with before/after JSON.

---

## 12.14 Numbering (summary; full rules in Phase 18)

- Invoice `INV-YYYY-NNNNN`, Receipt `RCT-YYYY-NNNNN`, DP `DP-YYYY-NNNNN`, Expense `EXP-YYYY-NNNNN`, Income `INC-YYYY-NNNNN`, Quotation `QUO-...`, Contract `CTR-...`, Proposal `PROP-...`.
- Per-entity sequence, yearly reset (configurable), gapless under row lock.

---

## 12.15 Reporting & dashboards (finance inputs to Phase 17)

- AR Aging (unpaid/partial invoices bucketed by 0–30/31–60/61–90/90+ days).
- Cashflow chart (from snapshots).
- P&L summary (from snapshots).
- Revenue by project / by client.
- Outstanding DP balances.
- Expense breakdown by category.

All dashboards read **snapshots + indexed reads**, never heavy live joins.
