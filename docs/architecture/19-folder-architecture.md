# Phase 19 — Folder Architecture

> Monorepo: **Backend + Frontend + Shared**. Feature-modular within each. Every choice explained.

---

## 19.1 Top level

```
taralaya-os/
├── apps/
│   ├── backend/              # Node.js + TypeScript API (Drizzle, REST)
│   ├── web/                  # Next.js frontend (admin/portal)
│   └── worker/               # Background jobs (queues, schedulers, dispatchers)
├── packages/
│   ├── shared/               # Types, enums, DTOs, constants shared across apps
│   ├── db/                   # Drizzle schema, migrations, seed (shared by backend + worker)
│   ├── ui/                   # Shared React component library (web + future portal)
│   └── config/               # ESLint, TS config, prettier — shared
├── docs/                     # this architecture package
├── scripts/                  # ops scripts (backup, migration runners)
├── .github/                  # CI/CD
├── package.json              # workspace root (pnpm/npm workspaces)
└── ...
```

**Why a monorepo?** The team is small, the surface is tightly coupled (frontend consumes backend types; backend & worker share the DB schema), and a monorepo keeps changes atomic (a schema change + API change + UI change ship together). Tooling: **pnpm workspaces** + **Turborepo** (or Nx) for caching.

**Why `apps/` + `packages/`?** Clear separation between *deployable things* (apps) and *importable things* (packages). The DB schema is a package because **two apps** (backend + worker) must share it — duplicating it would drift.

---

## 19.2 `apps/backend` — the API

Feature-modular (one folder per bounded context = Phase 1's modules). Shared infra lives in `core/`.

```
apps/backend/
├── src/
│   ├── main.ts               # bootstrap (Express/Fastify), middleware wiring
│   ├── core/                 # cross-cutting infra (not business)
│   │   ├── config/           # env loading, typed config
│   │   ├── db/               # re-exports packages/db; transaction helpers
│   │   ├── auth/             # JWT, session, password hashing
│   │   ├── rbac/             # permission resolver, decorators, middleware
│   │   ├── events/           # in-process event bus + queue publisher
│   │   ├── http/             # router base, error handling, envelope, pagination
│   │   ├── audit/            # AuditService + repository interceptor
│   │   ├── activity/         # ActivityService
│   │   ├── notification/     # NotificationService + provider adapters
│   │   ├── validation/       # Zod base schemas, Money VO, etc.
│   │   ├── sequence/         # NumberSequenceService
│   │   ├── storage/          # attachment storage abstraction (s3/local)
│   │   ├── logger/
│   │   └── errors/           # typed error hierarchy → HTTP mapping
│   ├── modules/              # THE business code, one folder per module
│   │   ├── iam/
│   │   ├── crm/
│   │   ├── sales/
│   │   ├── delivery/
│   │   ├── finance/
│   │   ├── subscription/
│   │   ├── payroll/
│   │   ├── asset/
│   │   ├── notification/     # (channel/template management UI endpoints)
│   │   ├── knowledge/
│   │   ├── audit/            # query endpoints for audit/activity
│   │   └── platform/         # tags/attachments/comments/reminders/settings
│   └── routers/              # top-level route composition: /api/v1/* wiring
└── ...
```

### Inside one module (e.g. `modules/finance/`)

```
modules/finance/
├── finance.module.ts         # declares routes, wires services, DI registration
├── routes/
│   ├── invoices.routes.ts    # /api/v1/invoices/*
│   ├── receipts.routes.ts
│   ├── down-payments.routes.ts
│   ├── expenses.routes.ts
│   ├── incomes.routes.ts
│   └── reports.routes.ts
├── services/
│   ├── invoice.service.ts
│   ├── receipt.service.ts
│   ├── down-payment.service.ts
│   ├── expense.service.ts
│   ├── income.service.ts
│   └── finance-reporting.service.ts
├── repositories/
│   ├── invoice.repository.ts
│   ├── receipt.repository.ts
│   └── ...
├── dto/                      # Zod input/output schemas for this module
│   ├── invoice.dto.ts
│   └── ...
├── domain/                   # domain logic: value objects, invariants, state machines
│   ├── invoiceStateMachine.ts
│   ├── allocationRules.ts
│   └── money.ts (or import from core)
├── events/                   # event handlers this module subscribes to / emits
│   └── finance.event-handlers.ts
└── __tests__/
```

**Why this shape?**
- **Module autonomy:** everything for Finance is in `finance/`. A developer can reason about, test, and (later) extract it without spelunking across the tree.
- **Layered within module:** `routes` (HTTP) → `services` (business rules, transactions) → `repositories` (DB, Drizzle). The **module boundary rule** (Phase 2) holds: a service never queries another module's tables — it calls that module's service or subscribes to its events.
- **`domain/` for pure logic:** state machines, money math, invariant functions are unit-testable without DB.
- **`dto/` colocated** so input/output contracts live next to the route that uses them.

---

## 19.3 `apps/worker` — background processing

Same shape as backend but no HTTP; entry points are queue consumers + cron schedules.

```
apps/worker/
├── src/
│   ├── main.ts               # boots queue consumers + cron scheduler
│   ├── consumers/            # one per async event domain
│   │   ├── notification.consumer.ts
│   │   ├── finance-snapshot.consumer.ts
│   │   ├── payroll.consumer.ts
│   │   └── ...
│   ├── schedulers/           # cron jobs (Phase 13)
│   │   ├── reminder.scheduler.ts
│   │   ├── overdue-invoice.scheduler.ts
│   │   ├── billing-cycle.scheduler.ts
│   │   ├── payroll-internal.scheduler.ts
│   │   └── ...
│   └── core/                 # shared with backend via packages where possible
```

**Why a separate worker app?** Long-running/jobs (PDF generation, payroll computation, bulk notifications) must not block API responses. Separate process = independent scaling (1 API replica + N worker replicas), isolated failures (a job crash doesn't take down the API), and clearer resource limits. Shares `packages/db` so it sees the same schema/types.

Queue tech: **BullMQ** (Redis) or **SQS** — abstracted behind a `core/queue` port so it's swappable.

---

## 19.4 `apps/web` — the frontend

Feature-modular Next.js (App Router). Mirrors backend modules.

```
apps/web/
├── src/
│   ├── app/                  # Next.js App Router: routes
│   │   ├── (auth)/           # login, forgot-password (route group)
│   │   ├── (dashboard)/      # authenticated app shell
│   │   │   ├── clients/      # feature pages
│   │   │   ├── projects/
│   │   │   ├── invoices/
│   │   │   ├── payroll/
│   │   │   ├── maintenance/
│   │   │   ├── dashboard/
│   │   │   └── settings/
│   │   └── layout.tsx
│   ├── features/             # per-feature: components, hooks, api clients
│   │   ├── clients/
│   │   │   ├── api/          # react-query hooks (TanStack Query)
│   │   │   ├── components/
│   │   │   ├── forms/
│   │   │   └── types.ts
│   │   ├── projects/
│   │   └── ...
│   ├── components/           # app-level shared UI (uses packages/ui)
│   ├── lib/                  # api client, auth client, rbac helper
│   └── styles/
```

**Why feature folders in `features/` + pages in `app/`?** Next.js App Router owns *routing*; the *feature logic* (hooks, forms, non-route components) lives in `features/<name>/` so it's reusable across pages and testable in isolation. TanStack Query hooks per feature call the backend REST API (see the `tanstack-query` skill conventions).

---

## 19.5 `packages/`

### `packages/shared`
Types/enums/DTOs shared between web and backend (and worker). e.g. `PermissionKey` union, status enums, request/response shapes (generated from the backend's Zod schemas via `zod-to-ts` or hand-maintained). **Single source of truth for contracts** so frontend and backend never drift.

### `packages/db`
The Drizzle schema (`schema/`), migrations (`migrations/`), and seed (`seed/`). Imported by `apps/backend` and `apps/worker`. This is the **only place** that defines tables — ensuring the worker and API can't disagree on schema.

```
packages/db/
├── src/
│   ├── schema/
│   │   ├── _helpers.ts       # id(), auditColumns(), money(), etc.
│   │   ├── iam.ts
│   │   ├── crm.ts
│   │   ├── sales.ts
│   │   ├── delivery.ts
│   │   ├── finance.ts
│   │   ├── subscription.ts
│   │   ├── payroll.ts
│   │   ├── asset.ts
│   │   ├── notification.ts
│   │   ├── knowledge.ts
│   │   ├── audit.ts
│   │   ├── platform.ts
│   │   └── index.ts          # re-exports + relations()
│   ├── client.ts             # Drizzle client factory
│   ├── seed/                 # idempotent seeds (Phase 8)
│   └── migrations/           # generated SQL
└── drizzle.config.ts
```

### `packages/ui`
Design-system React components (Button, Table, Modal, Form, etc.) shared by `web` and any future client portal.

### `packages/config`
Shared ESLint/Prettier/TS configs so all apps lint identically.

---

## 19.6 Why feature-modular (not layered-monolith)?

A layered-monolith (`controllers/`, `services/`, `repositories/` each a giant folder) scatters one feature across the tree — changing "invoices" means editing 4+ distant folders. Feature-modular co-locates everything about invoices in `modules/finance/invoices.*`. Benefits: locality of reasoning, easier testing, cleaner Git diffs, and a **clean migration path** to microservices later (a module folder → a service) without restructuring.

---

## 19.7 Cross-cutting patterns vs location

| Concern | Location | Why |
|---|---|---|
| HTTP framework, middleware | `backend/core/http` | shared by all modules |
| Auth/session/JWT | `backend/core/auth` | used everywhere |
| RBAC resolver | `backend/core/rbac` | cross-module |
| Event bus | `backend/core/events` | cross-module glue |
| Audit/Activity services | `backend/core/audit`, `core/activity` | every module calls them |
| Notification dispatch | `backend/core/notification` | cross-module |
| Money VO | `packages/shared` or `core/validation` | used by web + backend |
| DB schema | `packages/db` | shared by backend + worker |
| Feature DTOs | each `modules/<m>/dto` | feature-local |
| Feature state machines | each `modules/<m>/domain` | feature-local logic |

Rule: **if it's used by >1 module, it lives in `core/` (or `packages/`); if it's one module, it stays in the module.** This prevents `core/` from becoming a dumping ground.

---

## 19.8 Testing layout

```
<module>/__tests__/
  *.service.spec.ts           # unit: business rules, state machines
  *.repository.spec.ts        # integration: real DB (or test DB)
  *.routes.spec.ts            # API e2e: supertest
__e2e__/                       # app-level flows (lead→cash)
```

Plus contract tests between web and backend (using `packages/shared` DTOs).

---

## 19.9 Environment & config

- One `.env` per app (`apps/backend/.env`, `apps/worker/.env`, `apps/web/.env`), validated at boot by a typed config loader (Zod).
- Secrets (DB password, provider API keys, JWT secret) via env / secret manager — never in code, never in `packages/config`.
- `NODE_ENV=development|test|staging|production` drives behavior.

---

## 19.10 Build & deploy (summary)

- **Monorepo task runner:** Turborepo — `turbo run build/test/lint` across apps with caching.
- **Backend/worker:** compile TS → run via Node (or Bun in future). Containerized.
- **Web:** Next.js build → hosted (Vercel or self-hosted Node).
- **DB migrations:** run in CI/deploy pipeline (`packages/db` migrations), before app rollout (Phase 8).
- **Worker:** deployed as its own service; scaled by queue depth.

---

## 19.11 Naming the repo's existing skill scaffold

The repo currently has `.agents/skills/*` (frontend-design, nodejs-backend-patterns, etc.). These remain as **agent guidance** and don't conflict with the app code. They live at the root for the assistant to consult; the application lives in `apps/` + `packages/`.
