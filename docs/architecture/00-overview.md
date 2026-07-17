# Taralaya OS — Backend Architecture & MCP

> **Document status:** Production architecture blueprint (Phase 1–20).
> **Target audience:** An implementation AI (or engineering team) that will turn this plan into code.
> **Single source of truth:** This `docs/architecture/` folder. When code and docs disagree, **docs win** until docs are updated.

---

## What Taralaya OS is

Taralaya OS is an **ERP / Operating System for a Digital Agency**. It runs the whole agency end-to-end: from the first inbound lead, through quoting, contracts, projects, delivery tasks, invoicing, finance, payroll, asset/maintenance lifecycle, and ongoing client retention — with full audit, notifications, and dashboards on top.

- **Current tenant (single-tenant now):** Taralaya Studio.
- **Future (explicitly NOT now):** Multi-tenant SaaS. Every table and boundary is shaped so a `tenant_id` (or `agency_id`) discriminator can be added later without a re-architecture. See §"Multi-tenant readiness" in every relevant phase.

---

## Tech & conventions locked up front

These are **decisions**, not proposals. They are repeated/derived in later phases.

| Concern | Decision | Why |
|---|---|---|
| Database | **MySQL 8.0+** | Required by the brief; mature, well-understood, strong tooling, good Drizzle support, JSON columns for flexible config. |
| ORM | **Drizzle ORM** (TypeScript) | Required by the brief. SQL-first, typed, generates migrations, no magic, predictable performance. |
| Backend runtime | **Node.js + TypeScript** | Matches Drizzle ecosystem and the team's frontend (Next.js) skills; one language across the stack. |
| API style | **REST** (resource-oriented, JSON) | Required by the brief. Predictable, cacheable, easy to consume from any client. |
| Auth | **RBAC** (role-permission), users may hold multiple roles, permissions are **merged (union)** | Required by the brief. Founder = Super Admin. |
| IDs | **`bigint` unsigned PK** surfaced as **prefixed string** (e.g. `usr_...`) | See Phase 18. Numeric in DB for index/join perf; prefixed strings at the API for clarity & no-leak. |
| Soft delete | **`deleted_at TIMESTAMP NULL`** on business entities | Recoverable; keeps audit integrity. |
| Audit | **`created_at`, `updated_at`, `created_by`, `updated_by`** on every table | Mandatory auditability. |
| Timestamps | **UTC** stored, timezone rendered at edge | See Phase 18. |
| Money | **Decimal** (MySQL `DECIMAL(18,2)`) + `currency` code (ISO-4217) | Never float for money. |
| Multi-tenant readiness | Every table reserves logical room for `tenant_id`; **not enforced now** | Future SaaS without re-architecture. |

---

## How to read this package

Read in order. Each phase builds on the previous.

| File | Phase | What it gives you |
|---|---|---|
| `00-overview.md` | — | This file. Conventions, glossary, decisions. |
| `01-business-domain.md` | 1 | The business: modules, boundaries, journeys, workflows, future. |
| `02-domain-model.md` | 2 | DDD per module: aggregates, value objects, entities, services, repos. |
| `03-entity-list.md` | 3 | Every entity, grouped, with one-line purpose. |
| `04-entity-definitions.md` | 4 | Per-entity schema: columns, keys, indexes, constraints, rules. |
| `05-erd.md` | 5 | Full Mermaid ERD + relationship inventory. |
| `06-database-design.md` | 6 | Normalization, indexing decisions, scaling notes. |
| `07-drizzle-schema-plan.md` | 7 | Table/column/relation/index/constraint plan (NO code). |
| `08-migration-plan.md` | 8 | Migration order, dependencies, rollback. |
| `09-rest-api-design.md` | 9 | Endpoints, bodies, validation, permissions per module. |
| `10-permission-matrix.md` | 10 | Full RBAC matrix. |
| `11-payroll-design.md` | 11 | Internal + project payroll, rules engine. |
| `12-finance-design.md` | 12 | Pricelist, quotation, invoice, DP, cashflow, profit. |
| `13-automation-flow.md` | 13 | Lead→…→Maintenance pipeline + event list. |
| `14-notification-design.md` | 14 | Provider interface, channels. |
| `15-audit-system.md` | 15 | What is tracked and how. |
| `16-activity-timeline.md` | 16 | Timeline event model. |
| `17-dashboard-metrics.md` | 17 | KPIs & computation. |
| `18-validation-rules.md` | 18 | Naming, dates, money, IDs, document numbers. |
| `19-folder-architecture.md` | 19 | Backend / frontend / shared layout + reasoning. |
| `20-mcp-package.md` | 20 | The assembled MCP for the implementation AI. |

---

## Glossary

- **Module** — A coarse-grained business area (e.g. *CRM*, *Finance*). Owns its tables, services, API.
- **Aggregate** — A consistency boundary; one root entity, invariants enforced inside.
- **Tenant** — An isolated agency (today: only Taralaya Studio).
- **Lead** — A prospect that has not yet become a Client.
- **Client** — A paying entity (organization or individual) we do work for.
- **Project** — A unit of work for a Client, tied to a Contract.
- **Task** — A unit of delivery inside a Project.
- **Quotation** — A priced offer (pre-contract).
- **Proposal** — A narrative/strategic offer (can accompany a quotation).
- **Contract** — A signed agreement; parent of invoices/payments.
- **Invoice** — A demand for payment.
- **Receipt** — Proof of a received payment.
- **DP (Down Payment)** — Money collected before/at kickoff.
- **MCO (Maintenance Contract Order)** — ongoing maintenance engagement (see Phase 12).
- **Payroll** — Either monthly fixed salary (internal) or revenue-share per project.
- **RBAC** — Role-Based Access Control.

---

## Multi-tenant readiness (read once, applies everywhere)

We are single-tenant **now** but design for multi-tenant **later**. The chosen pattern is **"Discriminator column, deferred enforcement."**

- Reserve a conceptual `tenant_id` on every tenant-scoped table. **Do not create the column now** unless trivial; instead, ensure no global uniqueness assumptions exist that would break per-tenant.
- All unique document numbers (INV-, PRJ-, QUO-) are **tenant-scoped sequences**, not global. This is the single most important multi-tenant decision.
- `User`, `Role`, `Permission` are tenant-scoped in the future. Today there is one implicit tenant.
- No cross-tenant queries are ever written; all list queries filter by the current tenant (today: constant).

> This is the only multi-tenant section you must internalize. Phases will not repeat it.

---

## Design principles (north stars)

1. **Boring, explicit, predictable.** No clever frameworks for core flows.
2. **Strong relationships, normalized.** Denormalize only with a written justification (and an index).
3. **Money is sacred.** `DECIMAL`, always with a currency code; never arithmetic without rounding rules.
4. **Everything auditable.** If an action changed state, there's a row proving who/when/what.
5. **Soft delete by default** for business data; hard delete only for ephemeral/system tables.
6. **Configurable over hardcoded.** Percentages, sequences, statuses, and rules live in DB/config rows — never in code literals.
7. **Idempotency where it matters.** Invoicing, payments, payroll runs are idempotent by natural/external key.
8. **Boundaries are load-bearing.** Modules talk via well-defined interfaces, never by reaching into another module's tables.
