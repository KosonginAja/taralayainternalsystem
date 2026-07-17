# Phase 8 — Migration Plan

> Strategy for creating and evolving the database schema with Drizzle Kit.
> Two concerns: **(A) initial schema creation order** (dependency-safe), and **(B) ongoing migration + rollback discipline**.

---

## 8.1 Migration principles

1. **Forward-only, reviewable, reversible.** Every migration is additive or has a documented reverse.
2. **Dependency-safe ordering.** Tables are created after their FK parents. (Drizzle can sort, but we enforce the order in the plan to keep diffs clean and avoid circular-FK headaches.)
3. **One logical change per migration.** Don't bundle "add column X" + "create table Y" if unrelated.
4. **Never edit applied migrations.** Need a change → new migration.
5. **Backward-compatible first.** New columns nullable or with default; deprecated columns dropped only after code no longer uses them (two-release window).
6. **Data migrations separate from DDL** when non-trivial (run via scripts, with idempotency).
7. **Test on a clone** before production; every migration ships with a rollback SQL in the same PR.

---

## 8.2 Initial schema creation order (dependency-safe)

Tables grouped into **waves**; within a wave, order is interchangeable. A wave may only reference tables from earlier waves (or self-references within the same table). **Circular cross-table FKs are avoided**; the few self-references (`tasks.parent_task_id`, `payroll_runs.reversal_of`, `article_categories.parent_id`, `comments.parent_id`) are fine because they're same-table.

### Wave 0 — Foundation (no FK dependencies)
1. `users`
2. `permissions`
3. `settings`
4. `number_sequences`
5. `enum_values`
6. `tags`
7. `lead_stages`
8. `lead_sources`
9. `expense_categories`
10. `income_categories`
11. `tax_rates` (reserved)
12. `sla_policies`
13. `asset_categories`
14. `article_categories` (self-ref `parent_id` allowed)
15. `project_templates`
16. `discounts`
17. `notification_channels`
18. `notification_templates`

> **Why first:** These are catalogs/config/lookups that everything else references, and they have no inbound FKs of their own.

### Wave 1 — Core identity & CRM
19. `roles`
20. `role_permissions` → (roles, permissions)
21. `user_roles` → (users, roles)
22. `clients` → (users [owner])
23. `leads` → (clients [converted], lead_stages, lead_sources, users [owner]) — *note: `leads.converted_client_id` references `clients` which is created in the same wave; order `clients` before `leads`.*
24. `contacts` → (clients, leads)
25. `sessions` → (users)
26. `refresh_tokens` → (users, sessions)
27. `password_reset_tokens` → (users)
28. `api_keys` → (users)

### Wave 2 — Sales & Delivery (interdependent, ordered)
29. `pricelist_items` (no FK)
30. `contracts` → (clients, projects[forward ref — see note], quotations[forward ref], proposals[forward ref]) — *`contracts` references `projects`, `quotations`, `proposals` which are created below; resolve by creating contracts AFTER them, OR make those FKs nullable and add later. We choose: create `projects`, `quotations`, `proposals` first, then `contracts`.*
31. `quotations` → (clients, projects[forward], leads) — *references projects (forward); create projects first.*
32. `proposals` → (clients, quotations)
33. `projects` → (clients, contracts[forward], quotations[forward], users, project_templates) — *forward refs to contracts/quotations are nullable; safe to create projects first with nullable FKs.*

> **Resolution of the Sales↔Delivery cycle:** `projects ↔ contracts ↔ quotations` form a loose cycle.
> Decision: **make the cross-references nullable and create in this order:**
> 1. `projects` (FKs to clients, users, templates; `contract_id`/`quotation_id` nullable).
> 2. `quotations` (FKs to clients, projects[now exists], leads; `converted_contract_id` nullable).
> 3. `proposals` (FK to quotations[now exists]).
> 4. `contracts` (FKs to clients, projects, quotations, proposals — all exist now).
> 5. *(No backfill needed; the nullable forward refs are populated at runtime.)*

Re-ordered Wave 2:
29. `pricelist_items`
30. `projects`
31. `quotations`
32. `quotation_items` → (quotations, pricelist_items, tax_rates)
33. `proposals`
34. `contracts`
35. `contract_documents` → (contracts)
36. `project_members` → (projects, users)
37. `milestones` → (projects)
38. `tasks` → (projects, milestones, tasks[self])
39. `task_assignments` → (tasks, users)
40. `checklists` (polymorphic, no FK)
41. `checklist_items` → (checklists)

### Wave 3 — Finance
42. `invoices` → (clients, projects, contracts, subscriptions[forward — created Wave 4], billing_cycles[forward])
    - *Decision: make `subscription_id` and `billing_cycle_id` nullable now; FKs added/validated in Wave 4 or left nullable permanently (they're genuinely optional).*
43. `invoice_items` → (invoices, pricelist_items, tax_rates)
44. `receipts` → (clients)
45. `receipt_allocations` → (receipts, invoices)
46. `down_payments` → (clients, projects, contracts)
47. `dp_allocations` → (down_payments, invoices)
48. `expenses` → (expense_categories, projects, clients)
49. `incomes` → (income_categories, projects, clients)
50. `cashflow_snapshots`
51. `profit_snapshots`

### Wave 4 — Subscription & Billing
52. `plans`
53. `subscriptions` → (clients, plans, mco_contracts[forward])
54. `subscription_items` → (subscriptions)
55. `mco_contracts` → (clients, projects, subscriptions[now exists])
56. `billing_cycles` → (subscriptions, invoices[now exists])

### Wave 5 — Payroll
57. `payroll_rules` (scopeRefId is polymorphic — no FK)
58. `payroll_runs` → (projects, payroll_runs[self for reversal])
59. `payroll_distributions` → (payroll_runs, users, projects, payroll_rules)
60. `payroll_history` → (payroll_runs, users, payroll_runs[self for reversedBy])
61. `payroll_adjustments` → (payroll_runs, users)

### Wave 6 — Asset & Maintenance
62. `assets` → (asset_categories, clients, projects)
63. `asset_assignments` → (assets) [polymorphic subject]
64. `maintenance_tickets` → (clients, projects, mco_contracts, assets, subscriptions, users, sla_policies)

### Wave 7 — Notification, Knowledge, Audit, Activity, Platform-polymorphic
65. `notifications` → (notification_templates, users) [polymorphic subject]
66. `notification_logs` → (notifications)
67. `notification_preferences` → (users)
68. `articles` → (article_categories, users, article_revisions[forward self via currentRevisionId — nullable])
69. `article_revisions` → (articles, users)
70. `article_tags` → (articles, tags)
71. `audit_logs` → (users)
72. `activity_timeline` → (users, projects, clients)
73. `taggables` → (tags) [polymorphic]
74. `attachments` → (users) [polymorphic subject]
75. `comments` → (users, comments[self parent]) [polymorphic subject]
76. `reminders` → (users) [polymorphic subject]

---

## 8.3 Foreign key ordering summary

`users`, `clients`, `projects` are the three **hub** entities (most inbound FKs). Everything that references a hub must come after the hub. The cycle `projects ↔ contracts ↔ quotations` is broken by nullable forward FKs (see Wave 2 note). No other cycles exist.

---

## 8.4 Seed data (run after Wave 0 + Wave 1)

Idempotent seed (`scripts/seed.ts`), safe to re-run:

- **Permissions:** every key from the Phase 10 matrix inserted (`permissions` table).
- **Roles:** `super_admin` (system), `admin`, `manager`, `sales`, `finance`, `hr`, `developer`, `viewer` (system-managed defaults; editable copies allowed).
- **role_permissions:** map Phase 10's matrix.
- **users:** the Founder (1 row, `is_founder=true`).
- **lead_stages:** default pipeline (New, Contacted, Qualified, Proposal, Negotiation, Won, Lost).
- **lead_sources:** (Referral, Website, Social, Cold Outreach, Other).
- **expense_categories:** (Salaries, Software, Hardware, Marketing, Office, Travel, Other).
- **income_categories:** (Project Revenue, Retainer, Interest, Other).
- **sla_policies:** per priority (urgent/4h/1d, high/8h/2d, medium/24h/5d, low/72h/14d).
- **number_sequences:** INV, RCT, DP, EXP, INC, QUO, CTR, PROP, PRJ, TASK, MNT, LEAD, CL, SUB, MCO, RUN (with prefixes & reset rules per Phase 18).
- **settings:** defaults (currency=USD, locale=en, timezone=UTC, invoice_due_days=14, dp_default_mode=manual, payroll_internal_day=25, etc.).
- **enum_values:** polymorphic types list, task statuses, etc.

> Seeds are **versioned in code** (a `seeds/` folder, one file per group), not in migrations, so they're maintainable and re-runnable.

---

## 8.5 Rollback strategy

Every migration ships with a paired **down/rollback** artifact. Strategy by migration type:

| Migration type | Rollback approach |
|---|---|
| **CREATE TABLE** | `DROP TABLE` (only safe if no data; in prod, archive first). |
| **ADD COLUMN** | `DROP COLUMN` (safe; data lost — acceptable for additive fields). |
| **ADD NOT NULL COLUMN with default** | Drop default, then drop column. |
| **CREATE INDEX** | `DROP INDEX`. |
| **RENAME column/table** | Reverse rename. (Avoid in prod; prefer add-new + backfill + drop-old over two releases.) |
| **DATA migration** | Snapshot affected rows to a `_bak_<table>_<ts>` table *before* the change; rollback restores from snapshot. |
| **DROP column/table** | **Not reversible** without backup. Gate behind a two-release deprecation window; take a logical backup before. |

**General rollback discipline:**
- Deploy migrations **one at a time** with a health check between.
- Keep the last N migrations always reversible; once code has depended on a change for a full release, mark it "safe to make irreversible."
- For finance/payroll data migrations, **always** write a row to `audit_logs` documenting the migration run (actor=system, action=`data_migration`).

---

## 8.6 Zero-downtime migration patterns (for prod)

- **Expand → Migrate → Contract** (the canonical safe pattern):
  1. *Expand:* add new column/table (nullable) — deploy.
  2. *Migrate:* backfill data via script — deploy dual-write code.
  3. *Contract:* after release N+1 no longer reads old, drop old column — deploy.
- For the **status enum → table** move (if any fixed enum is later promoted), use Expand/Migrate/Contract.
- For **large table rewrites** (future), use `pt-online-schema-change` or gh-ost to avoid lock contention.

---

## 8.7 CI/CD integration

- PR checks: `drizzle-kit generate --name <change>` must produce a clean diff; lint rejects migrations that edit applied files.
- A `migrate:up` and `migrate:down` script per environment.
- Pre-deploy gate: migration runs **before** app rollout; app is forward-compatible with the migration (additive).
- Post-deploy: smoke test hits `/health/db` and a representative read per module.

---

## 8.8 First-release migration manifest

The initial release is **one big migration set** (waves 0–7 above), but committed as **7 files** (one per wave) so the order is explicit and reviewable:

```
migrations/
  0001_wave0_foundation.sql
  0002_wave1_identity_crm.sql
  0003_wave2_sales_delivery.sql
  0004_wave3_finance.sql
  0005_wave4_subscription.sql
  0006_wave5_payroll.sql
  0007_wave6_asset_maintenance.sql
  0008_wave7_notification_kb_audit_platform.sql
  0009_seed_permissions_roles.sql   # (seed; idempotent)
  0010_seed_catalogs_sequences.sql  # (seed; idempotent)
```

(Actual filenames follow Drizzle Kit's generated convention; the wave grouping is for review.)
