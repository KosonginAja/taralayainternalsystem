# Taralaya OS V2 — Database Schema

Stack: NeonDB (Postgres) + Drizzle ORM

Tables 1–9 (below) are the original V1 foundation, already built and running. Table 10 onward is new V2 scope (Phase 7+).

---

## 1. `company_settings`

Single-row table (super admin only, one company).

| Column                     | Type         | Notes                                                                                                           |
| -------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------- |
| id                         | uuid, PK     |                                                                                                                 |
| name                       | text         |                                                                                                                 |
| logo_url                   | text         | URL to external storage (e.g. Cloudflare R2 or static host) — do NOT store the image as bytea/base64 in this DB |
| address                    | text         |                                                                                                                 |
| phone                      | text         |                                                                                                                 |
| email                      | text         |                                                                                                                 |
| tax_id                     | text         | NPWP, optional                                                                                                  |
| bank_name                  | text         |                                                                                                                 |
| bank_account_number        | text         |                                                                                                                 |
| bank_account_holder        | text         |                                                                                                                 |
| default_wallet_company_pct | numeric(5,2) | default split % to Dompet Perusahaan                                                                            |
| default_wallet_payroll_pct | numeric(5,2) | default split % to Dompet Penggajian                                                                            |
| created_at                 | timestamptz  |                                                                                                                 |
| updated_at                 | timestamptz  |                                                                                                                 |

---

## 2. `clients`

| Column     | Type        | Notes               |
| ---------- | ----------- | ------------------- |
| id         | uuid, PK    |                     |
| name       | text        | company/client name |
| pic_name   | text        | person in charge    |
| email      | text        |                     |
| phone      | text        |                     |
| address    | text        |                     |
| notes      | text        |                     |
| is_active  | boolean     | default true        |
| created_at | timestamptz |                     |
| updated_at | timestamptz |                     |

---

## 3. `pricelist_items` (satuan)

| Column      | Type          | Notes                         |
| ----------- | ------------- | ----------------------------- |
| id          | uuid, PK      |                               |
| name        | text          |                               |
| description | text          |                               |
| unit        | text          | e.g. "page", "jam", "project" |
| price       | numeric(14,2) |                               |
| category    | text          | optional grouping             |
| is_active   | boolean       | default true                  |
| created_at  | timestamptz   |                               |
| updated_at  | timestamptz   |                               |

---

## 4. `packages` (paket)

| Column      | Type          | Notes                                                   |
| ----------- | ------------- | ------------------------------------------------------- |
| id          | uuid, PK      |                                                         |
| name        | text          |                                                         |
| description | text          |                                                         |
| price       | numeric(14,2) | package's own price (can differ from sum of components) |
| is_active   | boolean       | default true                                            |
| created_at  | timestamptz   |                                                         |
| updated_at  | timestamptz   |                                                         |

## 4a. `package_items`

Links pricelist items into a package (for reference/breakdown display).

| Column            | Type                           | Notes     |
| ----------------- | ------------------------------ | --------- |
| id                | uuid, PK                       |           |
| package_id        | uuid, FK -> packages.id        |           |
| pricelist_item_id | uuid, FK -> pricelist_items.id |           |
| qty               | numeric(10,2)                  | default 1 |

---

## 5. `numbering_sequences`

Drives quotation/invoice number generation.

| Column      | Type     | Notes                                            |
| ----------- | -------- | ------------------------------------------------ |
| id          | uuid, PK |                                                  |
| doc_type    | text     | `quotation` \| `invoice`                         |
| prefix      | text     | e.g. `QUO`, `INV`                                |
| format      | text     | e.g. `{PREFIX}/{YEAR}/{MONTH}/{SEQ}`             |
| current_seq | integer  | last used sequence number                        |
| year        | integer  | resets seq when year changes (if format uses it) |

---

## 6. `quotations`

| Column         | Type                                | Notes                                                         |
| -------------- | ----------------------------------- | ------------------------------------------------------------- |
| id             | uuid, PK                            |                                                               |
| number         | text                                | generated via numbering_sequences                             |
| client_id      | uuid, FK -> clients.id              |                                                               |
| status         | text                                | `draft` \| `sent` \| `accepted` \| `rejected` \| `superseded` |
| revision_of    | uuid, FK -> quotations.id, nullable | points to original if this is a revision                      |
| revision_label | text                                | e.g. `R1`, null if original                                   |
| issued_date    | date                                |                                                               |
| valid_until    | date                                |                                                               |
| subtotal       | numeric(14,2)                       |                                                               |
| discount       | numeric(14,2)                       | default 0                                                     |
| tax            | numeric(14,2)                       | default 0                                                     |
| total          | numeric(14,2)                       |                                                               |
| notes          | text                                |                                                               |
| created_at     | timestamptz                         |                                                               |
| updated_at     | timestamptz                         |                                                               |

> PDF is generated on-demand from this data (not stored as a file) to keep NeonDB free-tier storage usage minimal. No `pdf_url` column.

## 6a. `quotation_items`

| Column       | Type                      | Notes                                                   |
| ------------ | ------------------------- | ------------------------------------------------------- |
| id           | uuid, PK                  |                                                         |
| quotation_id | uuid, FK -> quotations.id |                                                         |
| ref_type     | text                      | `pricelist_item` \| `package` \| `custom`               |
| ref_id       | uuid, nullable            | FK to pricelist_items or packages depending on ref_type |
| name         | text                      | snapshot (survives if source item later edited/deleted) |
| description  | text                      | snapshot                                                |
| qty          | numeric(10,2)             |                                                         |
| unit_price   | numeric(14,2)             | snapshot                                                |
| subtotal     | numeric(14,2)             |                                                         |
| sort_order   | integer                   |                                                         |

> Revision handling: on edit of a `sent` quotation, create a new `quotations` row with `revision_of` set, `revision_label` incremented, copy+modify items. Mark original `status = superseded`. Never mutate a sent quotation in place.

---

## 7. `invoices`

| Column       | Type                                | Notes                                                       |
| ------------ | ----------------------------------- | ----------------------------------------------------------- |
| id           | uuid, PK                            |                                                             |
| number       | text                                | generated via numbering_sequences                           |
| quotation_id | uuid, FK -> quotations.id, nullable | null if invoice created manually                            |
| client_id    | uuid, FK -> clients.id              |                                                             |
| status       | text                                | `unpaid` \| `partial` \| `paid` \| `overdue` \| `cancelled` |
| payment_type | text                                | `full` \| `dp` \| `custom`                                  |
| issue_date   | date                                |                                                             |
| due_date     | date                                |                                                             |
| subtotal     | numeric(14,2)                       |                                                             |
| tax          | numeric(14,2)                       | default 0                                                   |
| total        | numeric(14,2)                       |                                                             |
| notes        | text                                |                                                             |
| created_at   | timestamptz                         |                                                             |
| updated_at   | timestamptz                         |                                                             |

> PDF is generated on-demand from this data (not stored as a file), same as quotations. No `pdf_url` column.

## 7a. `invoice_items`

Same shape as `quotation_items`, snapshot copied from quotation or entered manually.

| Column      | Type                    | Notes                                     |
| ----------- | ----------------------- | ----------------------------------------- |
| id          | uuid, PK                |                                           |
| invoice_id  | uuid, FK -> invoices.id |                                           |
| ref_type    | text                    | `pricelist_item` \| `package` \| `custom` |
| ref_id      | uuid, nullable          |                                           |
| name        | text                    |                                           |
| description | text                    |                                           |
| qty         | numeric(10,2)           |                                           |
| unit_price  | numeric(14,2)           |                                           |
| subtotal    | numeric(14,2)           |                                           |
| sort_order  | integer                 |                                           |

## 7b. `invoice_installments`

Generated based on `payment_type`. For `full`: single row (100%). For `dp`: 2 rows. For `custom`: N rows, sum of `percentage` = 100.

| Column     | Type                    | Notes                              |
| ---------- | ----------------------- | ---------------------------------- |
| id         | uuid, PK                |                                    |
| invoice_id | uuid, FK -> invoices.id |                                    |
| sequence   | integer                 | 1, 2, 3...                         |
| label      | text                    | e.g. "DP", "Pelunasan", "Termin 1" |
| percentage | numeric(5,2)            | % of invoice total                 |
| amount     | numeric(14,2)           | computed from percentage × total   |
| due_date   | date                    | nullable                           |
| status     | text                    | `pending` \| `paid`                |

---

## 8. `payments`

One row per actual money received against an installment.

| Column         | Type                                | Notes                        |
| -------------- | ----------------------------------- | ---------------------------- |
| id             | uuid, PK                            |                              |
| invoice_id     | uuid, FK -> invoices.id             |                              |
| installment_id | uuid, FK -> invoice_installments.id |                              |
| amount         | numeric(14,2)                       |                              |
| payment_date   | date                                |                              |
| method         | text                                | transfer/cash/etc, free text |
| notes          | text                                |                              |
| created_at     | timestamptz                         |                              |

## 8a. `payment_wallet_allocations`

Splits a single payment across wallets. Rows' `amount` must sum to the payment's `amount`.

| Column     | Type                    | Notes                                     |
| ---------- | ----------------------- | ----------------------------------------- |
| id         | uuid, PK                |                                           |
| payment_id | uuid, FK -> payments.id |                                           |
| wallet_id  | uuid, FK -> wallets.id  |                                           |
| percentage | numeric(5,2)            | pre-filled from company default, editable |
| amount     | numeric(14,2)           | computed                                  |

---

## 9. `wallets`

Seeded with exactly 2 rows on setup: Dompet Perusahaan, Dompet Penggajian.

| Column     | Type          | Notes                                                     |
| ---------- | ------------- | --------------------------------------------------------- |
| id         | uuid, PK      |                                                           |
| name       | text          |                                                           |
| type       | text          | `company` \| `payroll`                                    |
| balance    | numeric(14,2) | denormalized running balance, updated on each transaction |
| created_at | timestamptz   |                                                           |

## 9a. `wallet_transactions`

Ledger — every allocation writes one row here.

| Column        | Type                              | Notes                                |
| ------------- | --------------------------------- | ------------------------------------ |
| id            | uuid, PK                          |                                      |
| wallet_id     | uuid, FK -> wallets.id            |                                      |
| payment_id    | uuid, FK -> payments.id, nullable | null for manual adjustments (future) |
| type          | text                              | `in` \| `out`                        |
| amount        | numeric(14,2)                     |                                      |
| balance_after | numeric(14,2)                     | snapshot                             |
| description   | text                              |                                      |
| created_at    | timestamptz                       |                                      |

---

## Relationship Summary

```
company_settings (singleton)

clients ──< quotations ──< quotation_items
              │
              └─(accepted, revision_of self-ref)

clients ──< invoices ──< invoice_items
quotations ──< invoices (optional link)
invoices ──< invoice_installments ──< payments ──< payment_wallet_allocations >── wallets ──< wallet_transactions

pricelist_items ──< package_items >── packages
pricelist_items / packages ──(ref_type/ref_id, snapshot)── quotation_items / invoice_items

numbering_sequences → generates .number for quotations & invoices
```

---

## 10. `projects` (Phase 7 — new)

| Column       | Type                                | Notes                                                                                 |
| ------------ | ----------------------------------- | ------------------------------------------------------------------------------------- |
| id           | uuid, PK                            |                                                                                       |
| quotation_id | uuid, FK -> quotations.id, nullable | set if auto-created from an accepted quotation                                        |
| client_id    | uuid, FK -> clients.id              |                                                                                       |
| name         | text                                |                                                                                       |
| status       | text                                | `not_started` \| `in_progress` \| `review` \| `completed` \| `on_hold` \| `cancelled` |
| start_date   | date, nullable                      |                                                                                       |
| deadline     | date, nullable                      |                                                                                       |
| description  | text                                |                                                                                       |
| created_at   | timestamptz                         |                                                                                       |
| updated_at   | timestamptz                         |                                                                                       |

## 10a. `project_tasks`

| Column      | Type                    | Notes                             |
| ----------- | ----------------------- | --------------------------------- |
| id          | uuid, PK                |                                   |
| project_id  | uuid, FK -> projects.id |                                   |
| title       | text                    |                                   |
| description | text                    |                                   |
| status      | text                    | `todo` \| `in_progress` \| `done` |
| due_date    | date, nullable          |                                   |
| sort_order  | integer                 |                                   |
| created_at  | timestamptz             |                                   |
| updated_at  | timestamptz             |                                   |

> No assignee field yet — task/project assignment to a team member lands in Phase 8 once `users`/team management exists. Column will be added then rather than stubbed now.

```
quotations ──(accepted)──> projects ──< project_tasks
clients ──< projects
```

---

## 11. `users` (Phase 8 — new)

| Column        | Type         | Notes               |
| ------------- | ------------ | ------------------- |
| id            | uuid, PK     |                     |
| name          | text         |                     |
| email         | text, unique |                     |
| password_hash | text         |                     |
| role          | text         | `admin` \| `member` |
| is_active     | boolean      | default true        |
| created_at    | timestamptz  |                     |
| updated_at    | timestamptz  |                     |

> Replaces the single hardcoded super-admin credential from Phase 1. `project_tasks.assignee_id` (FK -> users.id, nullable) added via migration once this table exists.

## 12. `payroll_entries` (Phase 8 — new)

| Column                | Type                                         | Notes                |
| --------------------- | -------------------------------------------- | -------------------- |
| id                    | uuid, PK                                     |                      |
| user_id               | uuid, FK -> users.id                         |                      |
| period_start          | date                                         |                      |
| period_end            | date                                         |                      |
| base_amount           | numeric(14,2)                                |                      |
| bonus_amount          | numeric(14,2)                                | default 0            |
| deduction_amount      | numeric(14,2)                                | default 0            |
| total_amount          | numeric(14,2)                                | computed             |
| status                | text                                         | `pending` \| `paid`  |
| paid_at               | timestamptz, nullable                        |                      |
| wallet_transaction_id | uuid, FK -> wallet_transactions.id, nullable | set once marked paid |
| created_at            | timestamptz                                  |                      |

---

## 13. `expenses` (Phase 9 — new)

| Column      | Type                           | Notes                                      |
| ----------- | ------------------------------ | ------------------------------------------ |
| id          | uuid, PK                       |                                            |
| category    | text                           | e.g. "software", "hosting", "office"       |
| description | text                           |                                            |
| amount      | numeric(14,2)                  |                                            |
| date        | date                           |                                            |
| wallet_id   | uuid, FK -> wallets.id         | which wallet the expense is paid from      |
| receipt_url | text, nullable                 | external storage URL, not stored as binary |
| created_by  | uuid, FK -> users.id, nullable |                                            |
| created_at  | timestamptz                    |                                            |

> On creation, writes a `wallet_transactions` row (type `out`) same as payment/payroll flows.

---

## 14. `leads` (Phase 10 — new)

| Column                 | Type                                | Notes                                                                     |
| ---------------------- | ----------------------------------- | ------------------------------------------------------------------------- |
| id                     | uuid, PK                            |                                                                           |
| name                   | text                                |                                                                           |
| company                | text                                |                                                                           |
| contact_email          | text                                |                                                                           |
| contact_phone          | text                                |                                                                           |
| source                 | text                                | e.g. "referral", "instagram", "website"                                   |
| status                 | text                                | `new` \| `contacted` \| `qualified` \| `proposal_sent` \| `won` \| `lost` |
| notes                  | text                                |                                                                           |
| converted_quotation_id | uuid, FK -> quotations.id, nullable | set when converted                                                        |
| created_at             | timestamptz                         |                                                                           |
| updated_at             | timestamptz                         |                                                                           |

---

## 15. `document_templates` (Phase 12 — new, optional)

| Column           | Type        | Notes                                                           |
| ---------------- | ----------- | --------------------------------------------------------------- |
| id               | uuid, PK    |                                                                 |
| type             | text        | `contract` \| `bast` \| `company_profile` \| `warranty` \| etc. |
| name             | text        |                                                                 |
| template_content | text        | HTML/rich text with placeholders, e.g. `{{client.name}}`        |
| created_at       | timestamptz |                                                                 |
| updated_at       | timestamptz |                                                                 |

> Documents generated on-demand from template + live data, same pattern as quotation/invoice PDFs — not stored.

---

## Relationship Summary (Phase 8-12 additions)

```
users ──< project_tasks (assignee_id)
users ──< payroll_entries ──(on paid)──> wallet_transactions (Payroll wallet)
wallets ──< expenses ──(on create)──> wallet_transactions
leads ──(converted)──> quotations
```
