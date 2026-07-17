# Phase 15 — Audit System

> Track **everything that changes state**. The brief's list: Insert, Update, Delete, Restore, Login, Logout, Permission Change — and "everything must be logged."

---

## 15.1 Two layers (recap)

- **Audit Log** (`audit_logs`) — *technical, low-level, complete*. Captures every CUD operation with before/after diff. Primary audience: compliance, security forensics.
- **Activity Timeline** (`activity_timeline`) — *business, high-level, curated*. Captures meaningful business events in human language. Primary audience: users reading a feed. (Detailed in Phase 16.)

Both are **append-only**. This phase is about the Audit Log.

---

## 15.2 What is audited (the "everything" list)

### Mandatory actions (always logged)
| Category | Actions |
|---|---|
| **Data CUD** | insert, update, delete, restore (soft-delete + undelete) on **every business table** |
| **Auth** | login (success), login_failed, logout, token_refresh, password_reset_requested, password_reset_completed, session_revoked |
| **Access control** | role_created, role_updated, role_deleted, user_role_assigned, user_role_revoked, permission_granted, permission_revoked, apikey_created, apikey_revoked, user_activated, user_suspended, user_deactivated |
| **Exports** | any `*.export` action (CSV/PDF bulk data download) — records what was exported, by whom, filters used |
| **Sensitive reads** (optional, opt-in per field) | view of sensitive fields (e.g., a client's tax_id, a user's phone) |
| **Money mutations** | all invoice/receipt/DP/expense/income/payroll create/void/post/reverse |
| **Status transitions** | every workflow state change (lead stage, project status, task status, invoice issue/void, payroll post/reverse) |
| **System / config** | setting_updated, number_sequence_adjusted, enum_value_changed, template_edited, notification_channel_changed |
| **Data migrations** | data_migration runs (actor=system) |

### Explicitly NOT audited (to avoid noise)
- Read operations on non-sensitive data (GET requests) — too noisy; covered by access logs at the HTTP layer if needed.
- Internal cache writes.
- Snapshot/job computations (the job itself logs one summary audit row, not per-row).

---

## 15.3 Audit record shape (the `audit_logs` row)

| Field | Content |
|---|---|
| `actor_id` | user who acted (null = system/cron) |
| `action` | one of the action vocabularies above (insert, update, delete, restore, login, logout, permission_change, export, view_sensitive, data_migration, ...) |
| `entity_type` | table name (e.g. `invoices`) |
| `entity_id` | the row's id (null for collection-level actions like export) |
| `before` | JSON snapshot of the row before the change (null on insert) |
| `after` | JSON snapshot after (null on delete) |
| `diff` | computed field-level diff (only changed fields) — the most useful for review |
| `ip_address` | request IP |
| `user_agent` | client UA |
| `route` / `method` | HTTP route + method (for API-driven actions) |
| `result` | success \| failure |
| `error` | error message if result=failure |
| `occurred_at` | UTC timestamp |

---

## 15.4 How audit is captured (mechanism)

Two complementary mechanisms:

1. **Repository/Mapper interceptor (automatic CUD)** — every write through a repository's `create/update/delete/restore` automatically emits an audit row. This is the backbone; developers don't write audit code for normal CRUD. Implemented as a thin wrapper around Drizzle operations that diffs the before/after.

2. **Explicit `AuditService.record(...)` calls** — for actions that aren't simple CUD: login, logout, permission_change, export, status transitions, data_migration. Called at the relevant point in the service layer.

Both write through `AuditService`, which:
- serializes before/after to JSON,
- computes the diff,
- stamps actor/ip/UA from the request context (or system for cron),
- inserts the row.

**Synchronous vs async:** audit writes happen **in the same transaction** as the business change for CUD (so a rollback also rolls back the audit — we never audit a change that didn't happen). For non-transactional actions (login, export), the audit row is written immediately after.

---

## 15.5 Action vocabulary (controlled list)

Maintained in `enum_values` group `audit.action`. Standard values:

```
insert, update, delete, restore,
login, login_failed, logout, token_refresh, password_reset_requested, password_reset_completed, session_revoked,
role_create, role_update, role_delete, role_assign, role_revoke,
permission_grant, permission_revoke,
user_activate, user_suspend, user_deactivate, user_invite,
apikey_create, apikey_revoke,
export, view_sensitive,
status_transition, void, post, reverse, approve, sign,
setting_update, config_change, template_edit,
data_migration, system
```

Free-text is disallowed; a new action requires adding it to the enum (so reports/analytics stay clean).

---

## 15.6 Immutability & integrity

- **No UPDATE or DELETE** is exposed by `AuditLogRepository`. The repository interface has only `record()` and read methods.
- Even admin "break-glass" deletion (e.g. for GDPR/retention) is itself logged as a `delete` audit action *before* it occurs, and operates via a dedicated, permission-gated, break-glass path — never the normal API.
- **Tamper-evidence (future):** chain each row's hash to the previous (`hash = sha256(prev_hash || canonical_row)`), so any retroactive edit breaks the chain detectably. Not in v1, but the schema accommodates it (a nullable `prev_hash`/`hash` column can be added).
- **Retention:** configurable per category (`audit.retention_years`, default 7). Old data archived/dropped via partition management (Phase 6 §6.8).

---

## 15.7 Querying

- Admin UI: filter by actor, entity (type+id), action, time range, result. Paginated.
- Entity history view: "audit trail for this invoice/client/project" — the hottest query, served by `idx_audit_entity(entity_type, entity_id, occurred_at)`.
- Compliance export: filtered CSV/JSON (permission `audit.export`).
- All audit queries are **read-only** and can target a replica.

---

## 15.8 Performance safeguards

- Audit tables are write-heavy and read-mostly; indexed for the query patterns in Phase 6.
- JSON before/after can be large; for very wide tables (e.g. `articles.body`), the interceptor can be configured to **redact/exclude** specific heavy columns from the snapshot (e.g. store `{body: "<redacted:longtext>"}`). Configurable per table in `audit.field_policy`.
- Partitioning by month (Phase 6) once volume grows, so old partitions drop cheaply.

---

## 15.9 Privacy / PII

- Some fields are PII (phone, email, tax_id, password_hash). These are still captured in `before`/`after` for completeness **but** access to view them is restricted (permission `audit.view_sensitive`).
- For GDPR/Right-to-Erasure: a subject's PII can be redacted in historical audit rows via the break-glass tool, which logs its own `data_migration` audit entry. The *fact* of the action is preserved; the *content* is redacted.

---

## 15.10 Coverage guarantee

To guarantee "everything is logged," a **test/CI check** asserts that every repository write method routes through the audited interceptor (a base class or decorator), and every service method performing an auditable action calls `AuditService.record()`. A coverage report lists any business table lacking audit. This makes the "everything must be logged" requirement **enforced**, not aspirational.
