# Phase 6 — Database Design (MySQL)

Target: **MySQL 8.0+** (required by brief). ORM: **Drizzle** (covered in Phase 7).

---

## 6.1 Requirements recap (from brief)

- Normalization (no duplicate data).
- Strong relationships.
- Scalable, easy migration, fast query.
- Avoid unnecessary joins.
- Prepare indexes **and** composite indexes.
- **Explain every indexing decision.**

---

## 6.2 Normalization strategy

We normalize to **3NF** as the baseline, with **deliberate, documented denormalizations**:

| Deliberate denormalization | Where | Why | Integrity |
|---|---|---|---|
| `invoices.paid_amount`, `balance`, `payment_status` | Finance | Avoids re-aggregating allocations on every list view; list pages are the hottest path. | Recomputed in the same transaction as the allocation that changes it; a reconciliation job verifies nightly. |
| `projects.progress` | Delivery | Derived from tasks/milestones; recomputed on task transition. | Computed in `ProjectService` on every task/milestone change. |
| `activity_timeline.description` | Audit | Pre-rendered human text for fast feed reads; avoids joins to render. | Written once at event time; never updated. |
| `payroll_distributions.breakdown` (JSON) | Payroll | Computation trace stored with the result; audit/debug without re-run. | Append-only within a run. |
| `project_members.revenue_share_pct` | Delivery | Convenience cache for UI; **source of truth is `payroll_rules`**. | Re-synced when rules change; clearly documented as non-authoritative. |

Everything else is fully normalized. **No redundant copies of money, dates, or status** outside the above list.

---

## 6.3 Data types & sizing decisions

| Domain | Type | Why |
|---|---|---|
| Primary keys | `BIGINT UNSIGNED AUTO_INCREMENT` | Future-proof headroom; `INT UNSIGNED` (4B) would suffice today but BIGINT costs little and avoids an expensive migration later. Surrogate keys everywhere for stable joins. |
| Money | `DECIMAL(18,2)` + `CHAR(3) currency` | Exact decimal; 18,2 supports up to ~10^16 — plenty for agency scale. Never FLOAT/DOUBLE for money. |
| Percentages | `DECIMAL(8,5)` (general) / `DECIMAL(6,4)` (tax) | 8,5 supports up to 999.99999% — more than enough; 5 decimals for fine-grained revenue share. |
| Quantities | `DECIMAL(12,3)` | 3 decimals for fractional units (hours, etc.). |
| Timestamps | `TIMESTAMP` (UTC) | MySQL `TIMESTAMP` is stored as UTC and converted on session timezone; we force session TZ to UTC. (`DATETIME` would also work but `TIMESTAMP` gives automatic UTC normalization.) |
| Dates | `DATE` | Calendar dates only. |
| Status / small enums | `VARCHAR(32)` with app enum + DB `CHECK` | Readable in DB; type-safe in app; MySQL 8 enforces `CHECK`. (We avoid MySQL native `ENUM` because altering it is a costly DDL; a CHECK on VARCHAR is cheaper to change.) |
| Short codes / enums that need joins | real FK (e.g. `lead_stages`) | When status has metadata (won/lost/position), model it as a table, not an enum. |
| JSON | `JSON` | Used for variable-shape data: rule breakdowns, template variables, snapshots metadata, settings JSON. Validated in app. |
| Text bodies | `LONGTEXT` | Article/contract/proposal bodies. |
| URLs / files | `VARCHAR(500)`/`(1000)` | Generous for any URL. |
| Booleans | `BOOLEAN` (TINYINT 1) | Standard. |
| IP addresses | `VARCHAR(45)` | IPv6 compatible. |

> **Why not MySQL native ENUM?** Schema evolution: adding/removing a value to a `VARCHAR + CHECK` is a cheap `ALTER TABLE ... CHECK`, while a native `ENUM` change rewrites the table on some MySQL versions. Our statuses evolve (configurable pipelines), so the flexible path wins.

---

## 6.4 Character set & collation

- `utf8mb4` / `utf8mb4_0900_ai_ci` (MySQL 8 default) everywhere.
- `utf8mb4` is **mandatory** (emojis in comments, international client names). Never `utf8` (3-byte).

---

## 6.5 Indexing strategy & every decision

### Principles
1. Index for the **query**, not the column. Every index below maps to a real, named access path.
2. Composite indexes are ordered **leftmost by equality, then range** (per B-tree best practice).
3. Avoid over-indexing writes: every index slows INSERT/UPDATE. We index write-heavy tables (audit, notifications, activity) with care.
4. Soft-delete filter `deleted_at IS NULL` is folded into composite indexes where it's part of the query predicate.
5. Unique constraints double as indexes (no separate index needed).

### Index inventory & justification

**IAM**
- `users` `idx_users_status(status)` — user admin list filtered by active/invited.
- `users` unique `email` — login lookup (most critical index in system).
- `sessions(idx_sessions_user(user_id, expires_at))` — list/expire a user's sessions.
- `sessions(idx_sessions_expires(expires_at))` — cleanup cron.
- `role_permissions(idx_rp_role, idx_rp_perm)` — resolve permissions by role and reverse lookup.
- `user_roles(idx_ur_user, idx_ur_role)` — resolve a user's roles; reverse lookup for role deletion safety.

**CRM**
- `leads(idx_leads_stage(stage_id, deleted_at))` — pipeline board (filter by stage, exclude deleted). Composite because both are always predicates together.
- `leads(idx_leads_owner(owner_id))` — "my leads" view.
- `leads(idx_leads_expected_close(expected_close_date))` — forecast report (range).
- `leads(idx_leads_email(email))` — dedupe/lookup.
- `clients(idx_clients_name(name))` — search by name (note: for large scale this becomes ngram/FULLTEXT; today a prefix index suffices).
- `clients(idx_clients_status(status, deleted_at))` — active client list.
- `contacts(idx_contacts_client(client_id))`, `(idx_contacts_lead(lead_id))` — list contacts per parent.

**Sales**
- `quotations(idx_quo_client(client_id, deleted_at))` — client's quotations (hottest list).
- `quotations(idx_quo_status(status))` — pipeline.
- `quotations(idx_quo_issue(issue_date))` — date-range reports.
- `quotation_items(idx_qi_quotation(quotation_id, position))` — render items in order.
- `contracts(idx_ctr_client(client_id))`, `(idx_ctr_status(status))`, `(idx_ctr_dates(start_date,end_date))` — client list, status filter, active-period queries.
- `pricelist_items(idx_pli_active(is_active, deleted_at))` — active catalog list.

**Delivery**
- `projects(idx_prj_client(client_id, deleted_at))` — client's projects.
- `projects(idx_prj_status(status))` — board.
- `projects(idx_prj_manager(manager_id))` — "my projects".
- `projects(idx_prj_due(due_date))` — upcoming deliveries.
- `tasks(idx_task_project(project_id, status))` — board query (project + status, the single most common task query). **Composite, critical.**
- `tasks(idx_task_due(due_date))` — upcoming tasks across projects.
- `tasks(idx_task_parent(parent_task_id))` — subtask expansion.
- `task_assignments(idx_ta_user(user_id))` — "my tasks" (via join: tasks ← task_assignments).
- `milestones(idx_ms_project(project_id, position))` — ordered milestone list.
- `checklists(idx_chk_subject(subject_type, subject_id))` — polymorphic fetch.

**Finance** (most index-heavy; money + reporting)
- `invoices(idx_inv_client(client_id, deleted_at))` — client invoice list.
- `invoices(idx_inv_project(project_id))` — project billing.
- `invoices(idx_inv_status(status, due_date))` — **critical composite** for "overdue/unpaid due soon" queries (status equality + date range).
- `invoices(idx_inv_payment(payment_status))` — AR aging.
- `invoices(idx_inv_due(due_date))`, `(idx_inv_issue(issue_date))` — reports.
- `invoice_items(idx_ii_invoice(invoice_id, position))` — render.
- `receipts(idx_rct_client(client_id, payment_date))` — client payment history.
- `receipts(idx_rct_date(payment_date))` — daily cash report.
- `receipt_allocations(idx_ra_invoice(invoice_id))` — compute invoice.paid_amount (hot path).
- `dp_allocations(idx_dpa_invoice(invoice_id))` — same.
- `expenses(idx_exp_category(category_id, payment_date))` — expense by category over time.
- `expenses(idx_exp_date(payment_date))` — cashflow.
- `cashflow_snapshots(idx_cf_period(period_start, period_end))` — dashboard time-series.
- `profit_snapshots(idx_pf_period(...))` — same.

**Subscription**
- `subscriptions(idx_sub_client(client_id))`, `(idx_sub_status(status))`.
- `subscriptions(idx_sub_period_end(current_period_end))` — **critical** for the renewal cron (range scan of soon-to-expire).

**Payroll**
- `payroll_rules(idx_pr_type_scope(type, scope, is_active))` — rule resolution (filter by type + scope + active).
- `payroll_rules(idx_pr_active(is_active, effective_from, effective_to))` — currently-effective rules (range on dates).
- `payroll_history(idx_ph_user(user_id, posted_at))` — employee payslip history.
- `payroll_distributions(idx_pd_run(run_id))`, `(idx_pd_user(user_id))`.

**Asset & Maintenance**
- `maintenance_tickets(idx_mnt_client(client_id, status))` — client ticket board.
- `maintenance_tickets(idx_mnt_assignee(assignee_id, status))` — assignee workload.
- `maintenance_tickets(idx_mnt_due(due_at))` — SLA breach scan (range).
- `assets(idx_asset_license_exp(license_expires_at))` — expiry reminder scan.

**Notification**
- `notifications(idx_notif_status_scheduled(status, scheduled_at))` — **critical** for the dispatcher (queued + due).
- `notifications(idx_notif_recipient(recipient_user_id))` — inbox.

**Knowledge**
- `articles FULLTEXT(title, summary, body)` — **full-text search** (MySQL FULLTEXT, `IN BOOLEAN MODE`). Single best free-text index in the system.

**Audit & Activity**
- `audit_logs(idx_audit_entity(entity_type, entity_id, occurred_at))` — entity history (hottest audit query).
- `audit_logs(idx_audit_actor_time(actor_id, occurred_at))` — "what did user X do".
- `audit_logs(idx_audit_action_time(action, occurred_at))` — compliance reports.
- `audit_logs(idx_audit_time(occurred_at))` — time-window export.
- `activity_timeline(idx_act_project_time(project_id, occurred_at))` — project feed.
- `activity_timeline(idx_act_client_time(client_id, occurred_at))` — client feed.
- `activity_timeline(idx_act_time(occurred_at))` — global feed.

**Platform**
- `taggables(idx_tg_subject(taggable_type, taggable_id))` — fetch tags for an entity.
- `attachments(idx_att_subject(attachable_type, attachable_id))` — fetch files.
- `comments(idx_cmt_subject(commentable_type, commentable_id, created_at))` — threaded comments ordered by time.
- `reminders(idx_rem_pending(status, remind_at))` — **critical** for reminder dispatcher.
- `number_sequences` unique `(entity_type, prefix)` — sequence allocation.

### Composite indexes — explicit list (the brief asks for these explicitly)

| Composite index | Columns | Serves query |
|---|---|---|
| `idx_leads_stage` | (stage_id, deleted_at) | pipeline board |
| `idx_inv_status` | (status, due_date) | overdue / due-soon |
| `idx_task_project` | (project_id, status) | task board |
| `idx_rct_client` | (client_id, payment_date) | payment history range |
| `idx_exp_category` | (category_id, payment_date) | expense trend |
| `idx_mnt_client` | (client_id, status) | client ticket board |
| `idx_mnt_assignee` | (assignee_id, status) | assignee workload |
| `idx_notif_status_scheduled` | (status, scheduled_at) | dispatcher |
| `idx_rem_pending` | (status, remind_at) | reminder dispatcher |
| `idx_audit_entity` | (entity_type, entity_id, occurred_at) | entity audit trail |
| `idx_pr_type_scope` | (type, scope, is_active) | payroll rule resolution |
| `idx_sub_period_end` | (current_period_end) | renewal cron (range; single col but listed as hot) |

### Indexes we deliberately do NOT create (avoiding bloat)
- No index on `*_currency` — never queried alone.
- No index on `description`/`notes` free text — FULLTEXT on articles only; elsewhere not worth it.
- No index on `created_by`/`updated_by` (mostly) — rare query; if needed, add later.
- No index on `metadata` JSON columns — JSON queries aren't indexed at column level today.

---

## 6.6 Foreign key policy

- `ON DELETE RESTRICT` by default (business data never cascade-deletes; we soft-delete).
- `ON DELETE CASCADE` only where the child is **entirely owned** by the parent and has no independent meaning: `invoice_items`, `quotation_items`, `subscription_items`, `receipt_allocations`, `dp_allocations`, `contract_documents`, `checklist_items` → `checklists`, `article_revisions`, `notification_logs`, `user_roles`, `role_permissions` (via role/user), `sessions` → `users`, `billing_cycles` → `subscriptions`.
- Polymorphic "FKs" are not DB-enforced (see Phase 5 §5.14) — handled by app + cleanup job.
- Every FK column is **indexed** (MySQL auto-indexes FKs, but we list them explicitly for clarity and to guarantee it).

---

## 6.7 Constraints (CHECK / NOT NULL / UNIQUE)

- `CHECK` constraints (MySQL 8 enforced) on:
  - Money non-negative: `amount >= 0`, `paid_amount >= 0`, `grand_total >= 0`, allocation `amount > 0`.
  - Dates: `valid_until >= issue_date`, `due_date >= issue_date`, `end_date >= start_date`, `signed_at <= start_date`.
  - Logical XOR: `contacts` exactly one of client_id/lead_id non-null (enforced via generated column trick or app + CHECK).
  - Range caps: `progress BETWEEN 0 AND 100`, `priority` in valid set.
- `NOT NULL` on all identity + status + money base columns (see Phase 4).
- `UNIQUE` on all document numbers and natural business keys (see Phase 4 per table).

---

## 6.8 Partitioning & scaling (forward-looking; not built now)

- **Audit & activity logs** (`audit_logs`, `activity_timeline`, `notification_logs`) are the highest-volume tables. **Plan:** partition by `RANGE` on `occurred_at`/`created_at` (monthly) once volume justifies it; old partitions become droppable for retention. Table schema includes the timestamp column to enable this without restructure.
- **No sharding** planned for v1. Single primary + read replicas for reporting.
- **Read replicas**: dashboards/reports read from replica; transactional writes hit primary. Application query layer routes by use-case.

---

## 6.9 Avoiding unnecessary joins

Techniques applied:
1. **Denormalized status/derived columns** (paid_amount, balance, progress) eliminate re-aggregation joins on hot list views.
2. **Snapshot pricing** in `quotation_items`/`invoice_items` removes the need to join `pricelist_items` (which also drifts over time) when rendering historical documents.
3. **Pre-rendered activity description** removes joins to render the timeline feed.
4. **`current_revision_id` on articles** avoids a `MAX(revision)` subquery to fetch current content.
5. Reports use **snapshot tables** (`cashflow_snapshots`, `profit_snapshots`) precomputed by a job, instead of live joins across invoices+receipts+expenses+payroll on every dashboard load.

---

## 6.10 Migration-friendliness

- Every table is created in dependency order (Phase 8).
- All DDL is additive-first: new columns are added as nullable or with defaults so old code keeps working during rollout.
- Soft delete (`deleted_at`) means destructive changes are rare.
- `JSON` columns absorb volatile structure (settings, breakdowns) so schema changes for config are data changes, not migrations.

---

## 6.11 Backup & durability (operational, noted for completeness)

- InnoDB with `innodb_flush_log_at_trx_commit=1` for ACID.
- Daily logical backup (mysqldump) + continuous binlog replication to a standby.
- Point-in-time recovery via binlogs (the append-only audit/activity tables make this especially valuable).
- Encryption at rest enabled on the volume.
