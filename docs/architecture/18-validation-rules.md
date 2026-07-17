# Phase 18 — Validation Rules

> The brief's checklist: **Naming Convention, Date Strategy, Currency Strategy, Timezone, ID Format, Invoice Number, Project Number, Quotation Number, Contract Number, Proposal Number, Receipt Number.**
> Plus the general validation discipline applied across the system.

---

## 18.1 Naming conventions

### Code
- **TypeScript/JS:** `camelCase` variables/functions, `PascalCase` types/classes/interfaces, `SCREAMING_SNAKE_CASE` constants/enums values, `kebab-case` file names.
- **Database:** `snake_case` table & column names; plural table names (`invoices`, `users`); singular concept referenced as pluralized set.
- **API paths:** plural kebab-case resources (`/maintenance-tickets`, `/down-payments`).
- **JSON fields:** `camelCase` in API payloads (translated to/from `snake_case` DB columns at the repository edge).

### Business identifiers
- Human-facing document numbers use **PREFIX-YYYY-NNNNN** (see §18.6).
- Slugs (articles, tags, pricelist service_key, role key, plan_code): `kebab-case`, lowercase, `[a-z0-9-]`, unique within scope.

---

## 18.2 Date strategy

- **Storage:** `DATE` for calendar dates, `TIMESTAMP` (UTC) for instants. All DB timestamps in **UTC** (MySQL session TZ forced to UTC; `TIMESTAMP` type auto-normalizes).
- **Transmission:** ISO-8601 over the wire. Dates: `YYYY-MM-DD`. Timestamps: `YYYY-MM-DDTHH:mm:ssZ` (always with `Z`, UTC). No local-time strings in the API.
- **Rendering:** converted to the user's `timezone` at the edge (frontend / email template). The user's timezone is stored on `users.timezone` (default `UTC`).
- **Periods:** closed-open where ranges matter (`[start, end)`) to avoid double-counting at boundaries; for human-facing "monthly" we use calendar `[first_of_month, last_of_month]` inclusive where intuitive.
- **No date arithmetic in float** — always use a date library; durations as integers (days/hours).

---

## 18.3 Currency strategy

- **Storage:** every monetary amount is `DECIMAL(18,2)` paired with a `CHAR(3)` ISO-4217 currency code. Never `FLOAT`/`DOUBLE`.
- **Per-entity currency:** each client has `default_currency`; each invoice/quotation/DP/expense/receipt carries its own `currency`. Mixed-currency within one document is disallowed.
- **No implicit conversion:** you cannot add/subtract two `Money` of different currencies (service throws). FX conversion is *future*; today, one currency per aggregate.
- **Rounding:** banker's rounding (half-even) to 2 decimals, configurable via `finance.rounding_mode` (options: `half_even`, `half_up`, `down`). Applied at each computation step that produces a 3rd+ decimal.
- **Display:** format with the currency's conventional decimals (most currencies 2; JPY/KRW 0 — future; today assume 2).
- **Symbol:** render with ISO code (`USD 1,200.00`) or locale symbol; configurable. Currency is always explicit (never "$" alone — ambiguous).

---

## 18.4 Timezone strategy

- **One source of truth:** UTC in the DB. Always.
- **Per-user preference:** `users.timezone` (IANA name, e.g. `Asia/Kolkata`); used for rendering and for "today" / "this month" computations scoped to the user.
- **Cron/schedulers:** run in UTC; convert to tenant/user TZ only for human-facing scheduling (e.g., "remind at 9am user-local" → compute the next 9am-local instant in UTC and store that).
- **Reminders** store `remind_at` as UTC + a `timezone` field for reference; the dispatcher just compares UTC.
- **No DST surprises:** always store instants (not wall-clock times) for anything schedulable.

---

## 18.5 ID format

- **Primary keys (DB):** `BIGINT UNSIGNED AUTO_INCREMENT`. Numeric for join/index performance.
- **Public IDs (API/URL):** **prefixed strings**, `prefix + '_' + base62/bigint`. e.g. `usr_42`, `inv_12345`, `cli_7`, `prj_88`, `task_401`.
  - The prefix is derived from the entity (`usr`, `inv`, `cli`, `prj`, `task`, `quo`, `ctr`, `prop`, `rct`, `dp_`, `exp`, `inc`, `sub`, `mco`, `mnt`, `asset_`, `lead_`, `payrun_`, ...).
  - Internal mapping: the API layer strips the prefix → `bigint`; the DB never sees the prefix.
  - **Why:** opaque to outsiders (no row-count leak), type-checkable at a glance, REST-friendly, decoupled from internal storage. Stripe-style.
- **No UUIDs for primary keys** (sequential bigint is faster for InnoDB clustering). UUIDs reserved for truly distributed IDs (e.g., future sync) — not v1.
- **Soft/Hard:** all IDs immutable once assigned.

---

## 18.6 Document number formats

All **human-facing** document numbers follow **`PREFIX-YYYY-NNNNN`** (zero-padded to 5 digits; configurable padding). Year is the issue/creation year. Sequence is **per-prefix, per-year**, gapless, generated under row-lock by `NumberSequenceService`.

| Entity | Prefix | Example | Reset |
|---|---|---|---|
| Invoice | `INV` | `INV-2026-00001` | yearly |
| Receipt | `RCT` | `RCT-2026-00001` | yearly |
| Down Payment | `DP` | `DP-2026-00001` | yearly |
| Expense | `EXP` | `EXP-2026-00001` | yearly |
| Income | `INC` | `INC-2026-00001` | yearly |
| Quotation | `QUO` | `QUO-2026-00001` | yearly |
| Proposal | `PROP` | `PROP-2026-00001` | yearly |
| Contract | `CTR` | `CTR-2026-00001` | yearly |
| Project | `PRJ` | `PRJ-2026-00001` | yearly |
| Task | `TASK` | `TASK-PRJ1-0001` | per-project (configurable) |
| Maintenance ticket | `MNT` | `MNT-2026-00001` | yearly |
| Lead | `LEAD` | `LEAD-2026-00001` | yearly |
| Client | `CL` | `CL-2026-00001` | yearly |
| Subscription | `SUB` | `SUB-2026-00001` | yearly |
| MCO | `MCO` | `MCO-2026-00001` | yearly |
| Payroll run | `PAY` | `PAY-2026-00001` | yearly |

> Task numbers are per-project by default (`TASK-PRJ1-0001`) since tasks are usually referenced within a project context; configurable to global.

### Number generation rules
- **Gapless within reason:** the sequence is allocated *before* the row insert under a row-lock on `number_sequences`; if the insert fails, the gap is acceptable (we don't reuse). True gaplessness would hurt concurrency; we optimize for correctness + speed.
- **Per-tenant scoping (future):** the sequence key becomes `(tenant_id, entity_type, prefix, year)`; today `tenant_id` is constant.
- **Reset behavior:** `reset_frequency=yearly` zeroes the counter each Jan 1; `monthly` (optional) for high-volume entities; `never` for cumulative.
- **No reuse:** voided/deleted documents keep their number (audit integrity); gaps from voids are intentional.
- **Preview:** a draft document can be created without a number; the number is assigned at the "issue/create finalized" step. (Drafts may show `DRAFT` placeholder.)

---

## 18.7 Field-level validation rules (per entity)

Enforced by Zod schemas at the API edge **and** CHECK constraints in the DB (belt & braces). Highlights:

| Field | Rule |
|---|---|
| email | RFC-valid; normalized lowercase + trimmed; unique |
| phone | E.164-ish; `+` and digits, 6–15 digits |
| URL | protocol-relative disallowed; http/https/mailto/tel |
| money amount | `>= 0` generally; allocation `amount > 0` |
| percentage | `0 <= x <= 100` (tax); revenue-share up to `999.99999` |
| dates | `valid_until >= issue_date`, `due_date >= issue_date`, `end_date >= start_date`, `signed_at <= start_date` |
| progress | `0–100` |
| quantities | `> 0` |
| slugs/keys | `^[a-z0-9]+(-[a-z0-9]+)*$`, length ≤ 180 |
| currency | ISO-4217, exactly 3 uppercase letters |
| country | ISO-3166 alpha-2 |
| status transitions | validated against per-entity allow-list (state machines) |

---

## 18.8 Status transition validation (state machines)

Each entity with a `status` field has an **allow-list** of transitions, enforced in the service (and surfaced as `422` on illegal moves):

- **Lead:** any → any within configured stages (but `converted`/`lost` are terminal).
- **Quotation:** draft→sent→viewed→accepted|rejected|expired→converted; terminal states locked.
- **Contract:** draft→sent→signed→active→terminated|expired; signed is the gate to bind a project.
- **Project:** planning→active→(on_hold↔active)→completed|cancelled; completed requires milestones (config).
- **Task:** backlog→todo→in_progress→(blocked↔in_progress)→review→done|cancelled; done→reopened.
- **Invoice (status):** draft→issued→sent→paid|partial|overdue|uncollectible→voided.
- **Invoice (payment_status):** unpaid→partial→paid→overpaid; voided terminal.
- **Receipt:** pending→confirmed→voided.
- **Down Payment:** collected→partially_allocated→fully_allocated→refunded.
- **Subscription:** trialing→active→suspended↔active→cancelled|expired.
- **MCO:** draft→active→suspended↔active→expired|terminated.
- **Maintenance ticket:** open→assigned→in_progress→(waiting_on_client↔in_progress)→resolved→closed→reopened; cancelled terminal.
- **Payroll run:** draft→computing→computed→approved→posted→reversed.

Illegal transition → `422` with `{ code: 'INVALID_TRANSITION', message: 'Cannot move task from done to in_progress directly; reopen first.' }`.

---

## 18.9 Validation error response shape

```json
{
  "error": {
    "code": "VALIDATION_ERROR" | "INVALID_TRANSITION" | "BUSINESS_RULE_VIOLATION",
    "message": "Due date must be on or after issue date.",
    "details": [ { "field": "dueDate", "issue": "must_be_gte", "ref": "issueDate" } ]
  }
}
```

Field-level details let the frontend annotate forms precisely.

---

## 18.10 Where validation lives (layered)

1. **DTO schema (Zod)** at the API edge → `400` for malformed input.
2. **Service-layer business rules** (state machines, money caps, permission scoping) → `422`.
3. **DB CHECK constraints** → last line of defense → `500`-ish (should never trigger if layers 1–2 work; surfaces as a clear integrity error).

Layers 1 and 2 do the real work; layer 3 is the safety net against bugs and direct-DB edits.

---

## 18.11 i18n / locale

- Validation error messages are **locale-aware**, translated via the user's `locale` (default `en`).
- Templates and emails rendered in the recipient's locale (Phase 14).
- Numbers/dates formatted per locale at the edge; stored canonical.
