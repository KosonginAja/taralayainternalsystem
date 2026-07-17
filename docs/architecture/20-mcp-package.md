# Phase 20 — MCP (Machine Context Package)

> The assembled context package that another AI reads to **implement Taralaya OS with minimal ambiguity.** This file is the **entry point**; it references the 00–19 docs for depth and re-states every locked decision so the implementer never has to guess.

**How to use this MCP:** Read this file end-to-end first. When a section says "see Phase N," open `NN-*.md` for the detail. Never make an architectural decision that contradicts this package — if something seems missing, make the most professional choice, document it, and proceed (per the original brief).

---

## 20.1 Project Context

- **Product:** Taralaya OS — an ERP / Operating System for a Digital Agency.
- **Current tenant (single-tenant now):** Taralaya Studio.
- **Future (design for, don't build):** Multi-tenant SaaS.
- **Scope of implementation:** A full backend (REST API + worker) and a web frontend, feature-modular, production-ready, scalable, modular, clean, extensible.
- **Status of repo:** greenfield (only agent skills + this `docs/architecture/` package exist). No application code yet — you are building from zero.

### Stack (locked)
| Layer | Choice |
|---|---|
| DB | MySQL 8.0+ |
| ORM | Drizzle ORM (TypeScript) |
| Backend | Node.js + TypeScript, REST over Express/Fastify |
| Worker | Node.js + TypeScript, queue (BullMQ/Redis or SQS) + cron |
| Frontend | Next.js (App Router) + TanStack Query |
| Monorepo | pnpm workspaces + Turborepo |
| Auth | JWT (access + refresh), RBAC, sessions |
| Validation | Zod |
| Money | `DECIMAL(18,2)` + ISO-4217 currency code, banker's rounding |

---

## 20.2 Business Rules (canonical, must-hold)

1. **Lead→Cash spine:** Lead → Client → Quotation → Contract → Project → Tasks → Invoice → Receipt → Reminder → Maintenance/MCO.
2. **Permissions:** users may hold multiple roles; effective permissions = **union**; Founder = Super Admin bypass.
3. **Money is sacred:** `DECIMAL` + currency; no float; no cross-currency arithmetic; banker's rounding.
4. **No duplicate data** except the documented denormalizations (Phase 6 §6.2: invoice paid_amount/balance/payment_status, project.progress, activity.description, payroll breakdown, project_members.revenue_share_pct cache).
5. **Soft delete** (`deleted_at`) on business entities; hard delete only for ephemeral/system tables.
6. **Void, never hard-delete** financial records; reversals create new entries.
7. **Allocation invariant:** `Σ receipt_allocations + Σ dp_allocations ≤ invoice.grand_total` (enforced with row lock).
8. **Payroll percentages never hardcoded** — all rates in `payroll_rules`.
9. **Snapshot pricing:** quotation/invoice line items freeze `unit_price` at creation.
10. **Append-only:** `audit_logs` and `activity_timeline` (and `payroll_history` once posted).
11. **Module boundary:** a service never queries another module's tables directly; use service calls or events.
12. **Document numbers** are `PREFIX-YYYY-NNNNN`, per-prefix per-year, gapless under row-lock, **never reused** (voids keep their number).
13. **State machines** enforce status transitions (Phase 18 §18.8); illegal moves → `422`.
14. **Everything auditable** — CUD + auth + permission changes + exports + money mutations + status transitions (Phase 15).
15. **Multi-tenant readiness:** reserve conceptual `tenant_id`; tenant-scoped number sequences; no global uniqueness assumptions (Phase 00).

---

## 20.3 Architecture Decisions (locked)

| # | Decision | Rationale |
|---|---|---|
| AD-1 | Monorepo: `apps/{backend,worker,web}` + `packages/{shared,db,ui,config}` | atomic changes, shared schema/types, small team |
| AD-2 | Feature-modular folders (one per bounded context) | locality, testability, clean future service extraction |
| AD-3 | Layered within module: routes → services → repositories | separation of HTTP / business / persistence |
| AD-4 | Domain logic (state machines, VOs) in `module/domain/` | pure, unit-testable |
| AD-5 | Event bus (in-process sync + queue async) | decouples modules, powers audit/activity/notification/automation |
| AD-6 | Repository interceptor auto-audits CUD | "everything logged" enforced, not aspirational |
| AD-7 | `BIGINT` PKs + prefixed-string public IDs | perf + opaque + type-checkable |
| AD-8 | `VARCHAR(32)` status + app enum + DB CHECK (not native ENUM) | cheap schema evolution |
| AD-9 | UTC storage; per-user TZ rendering | correctness across timezones |
| AD-10 | Snapshots for dashboards (cashflow/profit) | fast reads, no live joins |
| AD-11 | Polymorphic tables only for cross-cutting (tags/attachments/comments/reminders/checklists/notifications.subject/activity.entity) | controlled, documented, `(type,id)` indexed |
| AD-12 | Separate worker app for jobs | isolation, independent scaling |
| AD-13 | Provider-interface for notifications | swap vendors without touching business code |
| AD-14 | Drizzle migrations additive-first, reviewed by hand, never edited post-apply | safe evolution |
| AD-15 | Optimistic concurrency (`If-Match`) on high-contention resources | consistency without pessimistic locks everywhere |

---

## 20.4 Database Decisions (locked)

- MySQL 8.0+, InnoDB, `utf8mb4`/`utf8mb4_0900_ai_ci`.
- `BIGINT UNSIGNED` PKs; FKs indexed; `ON DELETE RESTRICT` default, `CASCADE` only for fully-owned children.
- Money `DECIMAL(18,2)` + `CHAR(3) currency`; percent `DECIMAL(8,5)`.
- Timestamps `TIMESTAMP` UTC; dates `DATE`.
- Indexing plan: see Phase 6 §6.5 (every index justified). Critical composites: `idx_inv_status(status,due_date)`, `idx_task_project(project_id,status)`, `idx_notif_status_scheduled(status,scheduled_at)`, `idx_rem_pending(status,remind_at)`, `idx_audit_entity(entity_type,entity_id,occurred_at)`.
- `FULLTEXT` on `articles(title,summary,body)`.
- Partition plan (future, schema-ready): audit/activity/notification_logs by month.
- 76 entities / 60 tables across 12 modules (Phase 3, 4).

---

## 20.5 REST Decisions (locked)

- Versioned `/api/v1`; plural kebab-case resources; max nesting depth 2.
- Uniform envelope: `{ data | error, meta }`; list pagination in `meta`.
- Standard methods; soft-delete via `DELETE` → `204`; restore via `POST /{id}/restore`.
- Status codes: 200/201/204/400/401/403/404/409/422/429.
- `Idempotency-Key` on money/payment/payroll POSTs.
- `If-Match` optimistic locking on invoices/payroll runs.
- Bearer JWT auth; route declares required permission key; RBAC middleware enforces; founder bypasses.
- Validation: Zod at edge → `400`; business rules → `422`; CHECK constraints as last net.
- Full endpoint inventory: **Phase 9** (per module).

---

## 20.6 Folder Structure (locked) — see Phase 19

```
taralaya-os/
├── apps/{backend,worker,web}
├── packages/{shared,db,ui,config}
├── docs/architecture/      # this package (00–20)
└── scripts/
```
- backend: `src/{core,modules/<m>/{routes,services,repositories,dto,domain,events,__tests__},routers}`
- worker: `src/{consumers,schedulers,core}`
- web: `src/{app,features/<f>/{api,components,forms},components,lib}`
- db: `src/{schema,migrations,seed,client}`

---

## 20.7 Entity Definitions (locked) — see Phases 3 & 4

- 76 entities / 60 tables / 12 modules.
- Every entity: columns, PK, FKs, indexes, unique, nullable, enums, soft-delete, audit, relationships, business rules, validation, future extension — all in `04-entity-definitions.md`.
- Cross-module FK inventory (52): Phase 5 §5.13.
- Polymorphic associations (8, controlled): Phase 5 §5.14.

---

## 20.8 ERD (locked) — see Phase 5

- 11 per-module Mermaid diagrams + cross-module relationship inventory.
- Hub entities: `users`, `clients`, `projects`. Cycle `projects↔contracts↔quotations` broken via nullable forward FKs.

---

## 20.9 Implementation Order (the build sequence)

Implement in this order to respect dependencies and ship value early. Each step is independently testable.

**Wave A — Foundation (no business deps)**
1. Monorepo scaffold: `apps/*`, `packages/*`, tooling (TS, ESLint, Prettier, Turbo), env config.
2. `packages/db`: Drizzle schema for **Wave 0 + Wave 1 tables** (foundation + IAM + CRM base — Phase 8 §8.2). Migrations + seed (permissions, roles, founder, lead_stages, number_sequences, settings, enum_values).
3. `backend/core`: config, db client, http envelope, errors, logger, validation (Zod + Money VO), sequence service.
4. `backend/core/auth` + `rbac`: JWT, session, password, permission resolver (with cache + invalidation).
5. `backend/modules/iam`: users/roles/permissions/sessions/api-keys routes+services+repos. Auto-audit interceptor wired.
6. `backend/core/audit` + `activity`: services + append-only repos.

**Wave B — CRM + Sales**
7. `modules/crm`: leads, clients, contacts (with lead→client conversion).
8. `modules/sales`: pricelist, quotations (+items, totals), proposals, contracts.

**Wave C — Delivery**
9. `modules/delivery`: projects, members, tasks, assignments, milestones, checklists, timeline. (Project templates.)

**Wave D — Finance (core money)**
10. `modules/finance`: invoices (+items, totals, payment_status), receipts (+allocations), down_payments (+allocations, both modes), expenses, incomes. Invariants + state machines.
11. `backend/core/events` bus + `worker` app boot.
12. Finance event handlers: invoice.overdue scan, auto-DP-allocation, snapshot jobs (cashflow/profit), reports.

**Wave E — Subscription + Asset/Maintenance**
13. `modules/subscription`: plans, subscriptions, billing cycles, MCO; billing scheduler.
14. `modules/asset`: assets, assignments, maintenance tickets, SLA; SLA/expiry schedulers.

**Wave F — Payroll**
15. `modules/payroll`: rules, runs, distributions, history, adjustments; `PayrollEngine` (resolve + compute, both types); schedulers (internal monthly run); finance posting.

**Wave G — Cross-cutting features**
16. `backend/core/notification`: service + provider interface + WhatsApp/Email/Discord/Telegram adapters; templates; preferences; dispatcher worker.
17. `modules/platform`: tags, attachments, comments, reminders (polymorphic) + settings/enum management.
18. `modules/knowledge`: articles, revisions, categories, FULLTEXT search.
19. `modules/audit` (query endpoints) + activity feeds.

**Wave H — Frontend**
20. `apps/web`: auth shell, layout, then one feature section per backend module (dashboard, CRM, sales, projects/tasks, finance, payroll, maintenance, KB, settings), each via TanStack Query against the REST API. Dashboards from Phase 17 metrics.

**Wave I — Hardening**
21. E2E flows (lead→cash), performance passes on hot queries, index verification, audit coverage test, security review, backups, CI/CD, deploy.

> Order rationale: foundation → spine (CRM/Sales/Delivery) → money (Finance) → recurring (Subscription/Asset) → payouts (Payroll) → cross-cutting → UI → hardening. Each wave unblocks the next; no forward references that block testing.

---

## 20.10 Dependency Graph (build-time)

```
shared ─┐
db ─────┼─▶ backend ─┐
config ─┘            ├─▶ (deployable)
                    worker ─┘
shared ─▶ ui ─▶ web ─▶ (deployable)
```
- `db` depends on nothing (pure schema).
- `backend` & `worker` depend on `db`, `shared`, `config`.
- `web` depends on `shared`, `ui`, `config`.
- Within backend modules: `platform` & `iam` are leaves; `crm` depends on iam; `sales` on crm; `delivery` on sales; `finance` on delivery+sales+subscription; `subscription` on crm+finance; `payroll` on iam+delivery+finance; `asset` on delivery+subscription; `knowledge` on iam; `audit` on all (observer). — matches Phase 2 boundaries.

---

## 20.11 Coding Rules (enforce in review & lint)

1. **TypeScript strict** everywhere; no `any` without an inline `// why` comment; no `// @ts-ignore` without justification.
2. **Zod** validates every API input; inferred types flow into handlers (`z.infer`).
3. **No raw cross-module SQL** — go through the owning module's service/repo.
4. **Services own transactions**; repositories are transaction-unaware (receive a tx client).
5. **No business logic in routes** — routes only parse, authorize, call service, shape response.
6. **No magic strings** for status/actions/keys — use typed constants from `packages/shared`.
7. **Money via `Money` VO** — never bare number arithmetic for amounts.
8. **Audit every CUD** through the interceptor; explicit `AuditService.record` for non-CUD actions.
9. **Activity entries** for every Phase 16 catalog event.
10. **Idempotency keys** on all money/payment/payroll POSTs.
11. **No `SELECT *`** in repositories — explicit columns (Drizzle typed select).
12. **N+1 guard** — use Drizzle's `with`/`query`/batch loading; flag list endpoints for review.
13. **Errors** thrown as typed domain errors (mapped to HTTP in one place), never raw strings.
14. **Tests required** for: state machines, money math, payroll engine, allocation invariants, permission resolver.
15. **Lint/format/typecheck must pass** in CI before merge.
16. **Conventional commits** (`feat(finance): ...`, `fix(payroll): ...`).

---

## 20.12 Best Practices (normative)

- **API:** consistent envelope, pagination, filters, sparse fieldsets, `include` for compound docs; versioning; rate limiting; structured request IDs.
- **DB:** additive migrations; review generated DDL; index for queries; avoid SELECT *; batch inserts; use transactions for multi-step writes; row-lock for sequence/allocation.
- **Security:** hash passwords (argon2id); JWT short-lived + refresh rotation + reuse detection; encrypt secrets at rest; RBAC on every route; audit sensitive reads; parameterized queries only (Drizzle handles); validate file uploads (mime/size).
- **Performance:** read replicas for reports; snapshot tables for dashboards; cache permission resolution; paginated lists; indexes per Phase 6; avoid N+1.
- **Reliability:** idempotent jobs; distributed locks for schedulers; retries with backoff + dead-letter; graceful shutdown; health checks.
- **Observability:** structured logs (pino), request IDs, audit trail, per-channel notification metrics, dashboard of dashboards.
- **Finance integrity:** reconcile `paid_amount`/`balance` nightly; period-close gating; void-not-delete; double-entry spirit.
- **Frontend:** TanStack Query for server state; optimistic updates where safe; RBAC-driven UI (hide actions user can't perform); accessible (WCAG AA); responsive.
- **Docs:** keep `docs/architecture/` as source of truth; ADRs for decisions that diverge.

---

## 20.13 Future Expansion (prepared, not built)

1. Multi-tenant SaaS (discriminator `tenant_id` ready).
2. Tax engine (tables reserved).
3. Client portal (reuses API with client-scoped role).
4. E-signing (contracts).
5. Budgets / estimates-vs-actuals.
6. Time tracking.
7. Vendor/procurement + inventory.
8. Visual workflow designer (generalize Phase 13 events into editable rules).
9. AI assistant over dashboards + KB.
10. Banking integrations / auto-reconciliation.
11. Double-entry ledger.
12. Multi-currency FX.

**Invariant:** each is additive (new module or new table) — never a restructure.

---

## 20.14 Undefined-decision protocol

When you hit something this package doesn't specify:
1. Search `docs/architecture/00–19` for the topic (it's likely there).
2. If genuinely unspecified, choose the **most professional, boring, reversible** option.
3. **Document** the decision in an ADR (`docs/adr/NN-*.md`) stating context, options, choice, why.
4. Proceed; don't block.
5. Never silently hardcode a percentage, a status string, a currency, or a document-number format — those are all specified and must be configurable/data-driven.

---

## 20.15 Document index (the full MCP reading list)

| File | Phase | When to read |
|---|---|---|
| `00-overview.md` | — | First — conventions, glossary, decisions |
| `01-business-domain.md` | 1 | To understand what you're building |
| `02-domain-model.md` | 2 | Before designing any module's internals |
| `03-entity-list.md` | 3 | To see the whole data surface |
| `04-entity-definitions.md` | 4 | Before writing any schema/migration |
| `05-erd.md` | 5 | To understand relationships |
| `06-database-design.md` | 6 | Before indexing/partitioning decisions |
| `07-drizzle-schema-plan.md` | 7 | While writing Drizzle schema |
| `08-migration-plan.md` | 8 | While writing/sequencing migrations |
| `09-rest-api-design.md` | 9 | While writing routes |
| `10-permission-matrix.md` | 10 | While wiring RBAC |
| `11-payroll-design.md` | 11 | While building payroll |
| `12-finance-design.md` | 12 | While building finance |
| `13-automation-flow.md` | 13 | While wiring events/jobs |
| `14-notification-design.md` | 14 | While building notifications |
| `15-audit-system.md` | 15 | While wiring audit |
| `16-activity-timeline.md` | 16 | While wiring activity |
| `17-dashboard-metrics.md` | 17 | While building dashboards |
| `18-validation-rules.md` | 18 | While writing any validation/IDs |
| `19-folder-architecture.md` | 19 | While scaffolding the repo |
| `20-mcp-package.md` | 20 | This file — the index |

---

## 20.16 One-paragraph executive summary for the implementer

> Taralaya OS is a single-tenant (future multi-tenant) digital-agency ERP: a Node/TypeScript backend (REST, Drizzle on MySQL) + worker + Next.js frontend in a pnpm/Turborepo monorepo. Twelve feature modules (IAM, CRM, Sales, Delivery, Finance, Subscription, Payroll, Asset/Maintenance, Notification, Knowledge, Audit/Activity, Platform) with hard boundaries, event-driven cooperation, RBAC (multi-role, merged, founder=super-admin), full audit + activity trail, configurable payroll (internal salary + project revenue share, rules in DB), finance with invoices/receipts/DP (unlimited+manual)/cashflow/profit, and automation across the lead→cash→retention pipeline. Build foundation→spine→money→recurring→payroll→cross-cutting→UI→harden, respecting the locked decisions in §20.3–20.6 and the entity/schema/API specs in Phases 3–9. When unsure, pick the boring reversible option, document it as an ADR, and proceed.

---

**End of MCP package.** Implementation can begin from Wave A of §20.9.
