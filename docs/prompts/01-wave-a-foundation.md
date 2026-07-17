# Wave A — Foundation Prompt

> **Prerequisite:** Wave 0 (master boot) acknowledged.
> **Builds:** Monorepo scaffold, `packages/db` (Wave 0 + Wave 1 schema), `backend/core/*`, IAM module, audit/activity core.
> **Do not begin until the operator confirms Wave 0 is acknowledged.**

---

## BEGIN PROMPT — copy everything below this line

Execute **Wave A (Foundation)** of the Taralaya OS build. The master boot prompt is in effect.

### Step 1 — Read these MCP files (in order) before writing code
1. `docs/architecture/19-folder-architecture.md` — monorepo layout & module shape
2. `docs/architecture/07-drizzle-schema-plan.md` — Drizzle conventions & helpers (§7.0, §7.1)
3. `docs/architecture/04-entity-definitions.md` — entity defs for: `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `sessions`, `refresh_tokens`, `api_keys`, `password_reset_tokens`, plus all **Wave 0 foundation tables** (`settings`, `number_sequences`, `enum_values`, `tags`, `lead_stages`, `lead_sources`, `expense_categories`, `income_categories`, `tax_rates`, `sla_policies`, `asset_categories`, `article_categories`, `project_templates`, `discounts`, `notification_channels`, `notification_templates`)
4. `docs/architecture/08-migration-plan.md` — §8.2 Wave 0 + Wave 1, §8.4 seed data
5. `docs/architecture/06-database-design.md` — §6.3 types, §6.5 indexing (apply as you build schema)
6. `docs/architecture/10-permission-matrix.md` — to seed permissions/roles
7. `docs/architecture/09-rest-api-design.md` — §9.0 global conventions + IAM section (M01)
8. `docs/architecture/18-validation-rules.md` — §18.1–18.6 (naming, IDs, doc numbers), §18.10 layered validation
9. `docs/architecture/15-audit-system.md` — mechanism (§15.4) + action vocabulary (§15.5)
10. `docs/architecture/16-activity-timeline.md` — service interface

### Step 2 — Scaffold the monorepo (exactly per `19-folder-architecture.md`)
Create:
```
taralaya-os/   (repo root — use the current working directory)
├── package.json            # pnpm workspace root
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── .nvmrc / .node-version
├── .env.example
├── apps/
│   ├── backend/            # package.json, tsconfig.json, src/main.ts (stub), src/core/, src/modules/
│   └── worker/             # stub (boot in Wave D)
├── packages/
│   ├── shared/             # types/enums/DTOs/permission keys
│   ├── db/                 # Drizzle schema, migrations, seed
│   ├── ui/                 # placeholder (Wave H)
│   └── config/             # eslint, prettier, tsconfig presets
└── docs/                   # already exists
```
Use **pnpm workspaces + Turborepo**. Configure `turbo run build/test/lint/dev`. Share ESLint/Prettier/TS configs from `packages/config`.

### Step 3 — Build `packages/db` (Wave 0 + Wave 1 tables)
Per `07-drizzle-schema-plan.md`:
- Create `src/schema/_helpers.ts` with shared column helpers: `id()`, `auditColumns()`, `softDelete()`, `money(name)`, `currency()`, `percent(name)`, `statusCol()`.
- Create one schema file per module: `_helpers.ts`, `iam.ts`, `platform.ts` (foundation tables: settings/number_sequences/enum_values/tags), `crm.ts` (lead_stages, lead_sources only — full CRM in Wave B), plus stub files for the other foundation catalogs (expense_categories, income_categories, tax_rates, sla_policies, asset_categories, article_categories, project_templates, discounts, notification_channels, notification_templates). Define tables for **Wave 0 + Wave 1 only** (Phase 8 §8.2). Other modules' tables come in their waves — do NOT pre-create them.
- Define `relations()` per §7.13 for the tables you create.
- `drizzle.config.ts` pointing at MySQL; `src/client.ts` factory.
- Generate the first migrations (group by wave per §8.8: `0001_wave0_foundation.sql`, `0002_wave1_identity_crm.sql`). Review generated DDL by hand (Phase 7 §7.14).
- Create `src/seed/` with **idempotent** seed scripts (Phase 8 §8.4): `permissions` (every key from Phase 10 matrix), `roles` (8 default roles), `role_permissions` (the matrix), the **founder user** (`is_founder=true`; password from env), `lead_stages`, `lead_sources`, `number_sequences` (all prefixes: INV/RCT/DP/EXP/INC/QUO/PROP/CTR/PRJ/TASK/MNT/LEAD/CL/SUB/MCO/PAY), `settings` (defaults from Phase 11 §11.11 + Phase 12), `enum_values` (audit.action + activity.verb + polymorphic.types groups). Seeds must be re-runnable without duplicating.

### Step 4 — Build `apps/backend/src/core/*`
Per `19-folder-architecture.md` §19.2 + the relevant MCP phases:
- `core/config`: typed env loader (Zod-validated), reads `DATABASE_URL`, `JWT_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `PORT`, `NODE_ENV`, `FOUNDER_EMAIL`, `FOUNDER_PASSWORD`, `ARGON2_*` params.
- `core/db`: re-export client factory, transaction helper (`withTx(async (tx) => ...)`).
- `core/http`: Fastify/Express base, uniform envelope (`{data|error, meta}`), error→HTTP mapping (central), pagination, request-id, `If-Match` optimistic-lock helper, `Idempotency-Key` helper.
- `core/logger`: structured logger (pino) with request-id.
- `core/errors`: typed domain error hierarchy (`ValidationError`, `NotFoundError`, `ConflictError`, `UnauthorizedError`, `ForbiddenError`, `BusinessRuleError`, `InvalidTransitionError`) → HTTP status mapping.
- `core/validation`: Zod base schemas + the **`Money` value object** (amount: `DECIMAL`-safe string→Decimal, currency: ISO-4217). Equality/arithmetic/rounding (banker's). Throw on cross-currency ops.
- `core/sequence`: **`NumberSequenceService`** — `next(entityType): Promise<string>` returning `PREFIX-YYYY-NNNNN` under a **row-lock** on `number_sequences` (Phase 18 §18.6). Respect `reset_frequency`.
- `core/auth`: `PasswordService` (argon2id hash/verify, configurable), `JwtService` (issue access+refresh, verify, rotate refresh with reuse-detection that revokes the session family), `SessionService` (create/invalidate/expire), login lockout logic (Phase 4 §1 `users` business rules).
- `core/rbac`: **`PermissionResolver`** — given `userId`, return the merged permission set (union of all roles' permissions, with `*.manage` wildcard expansion). Cache (TTL ~5 min) + invalidation on role/permission change. Founder bypass. Permission-key constants in `packages/shared`. Middleware/decorator `@RequirePermission('invoice.view')` that returns `403` on miss.
- `core/audit`: **`AuditService.record({actorId, action, entityType, entityId, before, after, diff, ctx})`**; **`AuditLogRepository`** with **only** `record()` + read methods (append-only — no update/delete). A **repository interceptor/wrapper** that auto-calls `record()` for every CUD op (Phase 15 §15.4). Action vocabulary from `enum_values` group `audit.action`.
- `core/activity`: **`ActivityService.log({verb, verbSubject, actorId, entity, project?, client?, description, metadata, isPublic})`**; append-only repo; pre-render `description` at call site.
- `core/events`: in-process typed event bus (`emit(name, payload)`, `subscribe(name, handler)`). (Queue/async wiring comes in Wave D/G; today sync only.) Handlers are idempotent.
- `core/storage`: attachment storage **port** (interface) with a local-filesystem adapter (S3 adapter later). No business code depends on the provider.

### Step 5 — Build `apps/backend/src/modules/iam` (full module)
Per Phase 9 M01 + Phase 4 IAM defs + Phase 10 RBAC:
- `routes/`: `auth.routes.ts` (login, refresh, logout, me, password forgot/reset), `users.routes.ts` (full CRUD + activate/suspend/restore + roles assign + permissions resolved + sessions), `roles.routes.ts` (CRUD + replace permissions), `permissions.routes.ts` (list), `api-keys.routes.ts` (create/view/revoke). Every route declares its permission key via the `@RequirePermission` middleware; public routes (`/auth/login`, `/auth/refresh`, password forgot/reset) excluded.
- `services/`: `AuthService`, `UserService`, `RoleService`, `PermissionService`, `ApiKeyService`, `SessionService`.
- `repositories/`: `UserRepository`, `RoleRepository`, `PermissionRepository`, `SessionRepository`, `ApiKeyRepository` — all CUD routed through the audit interceptor.
- `dto/`: Zod schemas for every input (login, createUser, updateUser, createRole, etc.) with inferred types.
- `domain/`: `userStateMachine` (invited→active→suspended→deactivated), permission-key constants import.
- `events/`: emit `user.created`, `user.logged_in`, `user.logged_out`, `user.login_failed`, `role.*`, `user.role_assigned/revoked`, `permission.granted/revoked` (Phase 2 M01). Subscribe to own events to write audit/activity and invalidate RBAC cache.
- Enforce: email normalization (lowercase/trim), unique email, founder protection (founder can't be deactivated by non-founder; founder always super-admin), account lockout after N failed attempts.

### Step 6 — Wire `main.ts`
- Boot Fastify/Express, register `core/http` envelope + error mapping + request-id + logger + Zod validation pre-handler.
- Register `core/rbac` middleware.
- Mount IAM routers under `/api/v1`.
- Health endpoint: `/health` (200), `/health/db` (DB ping).
- Run migrations + seed on boot in **development** only (explicit opt-in flag); in production, migrations run via CI (Phase 8 §8.7) — app just verifies connectivity.

### Step 7 — Bootstrap founder + default data
- Seed must create the founder user from `FOUNDER_EMAIL`/`FOUNDER_PASSWORD` env (idempotent — update password only if env flag `FOUNDER_RESET=true`).
- Verify login works end-to-end: `POST /api/v1/auth/login` → access+refresh tokens → `GET /auth/me` returns resolved permissions including super-admin.

### Definition of Done (Wave A)

- [ ] Monorepo scaffolds; `pnpm install` + `pnpm turbo run build` succeed with zero errors.
- [ ] `pnpm turbo run lint` passes; TypeScript strict across all packages.
- [ ] `packages/db` defines Wave 0 + Wave 1 tables exactly per Phase 4 + 7; migrations generate & apply cleanly to a fresh MySQL DB (`pnpm db:migrate`).
- [ ] `pnpm db:seed` is idempotent and creates: all permission keys, 8 roles, role↔permission matrix, founder user, lead stages/sources, all number sequences, default settings, enum_values groups.
- [ ] `core/*` services compile and are unit-tested: `Money` VO (arithmetic, rounding, cross-currency throw), `NumberSequenceService` (gapless under concurrent calls — write a concurrency test), `PermissionResolver` (union + wildcard expansion + founder bypass + cache invalidation), `PasswordService` + `JwtService` (refresh rotation + reuse detection).
- [ ] IAM module: all M01 endpoints return correct status codes; permission checks enforced (`403` on missing key, founder bypasses); email normalization; lockout works; sessions/refresh rotate; reuse of a used refresh token revokes the session family.
- [ ] Auto-audit interceptor records a row for every CUD on users/roles; explicit `AuditService.record` fires on login/logout/login_failed/role_assign/permission_change.
- [ ] Activity entries written for `user.created`, `role.assign` catalog events.
- [ ] Public IDs surface as prefixed strings (`usr_1`, `role_2`) in all API responses; internal `bigint` only in DB/repos.
- [ ] A passing auth E2E: register/invite user → assign role → login → call a permission-gated endpoint → success; call without permission → `403`; founder → bypass.
- [ ] `.env.example` documents every env var; README at repo root has run instructions (`pnpm install`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm dev`).

### Verification commands (must pass before checkpoint)
```
pnpm turbo run build
pnpm turbo run lint
pnpm turbo run typecheck
pnpm db:migrate
pnpm db:seed
pnpm turbo run test
# manual: pnpm dev → POST /api/v1/auth/login with founder creds → 200 + tokens
```

### Checkpoint — STOP here
Report:
1. What you built (file tree of `packages/db/src/schema` + `apps/backend/src/core` + `apps/backend/src/modules/iam`).
2. Test results (counts: passing/failing).
3. Any MCP ambiguities you resolved (state the option chosen + why, per the undefined-decision protocol).
4. Anything in the spec you think is wrong (do NOT silently "fix" — flag it).
5. Confirm you did **not** edit `docs/architecture/`.

**Do not start Wave B.** Wait for the operator to paste `99-review-gate.md`, then `02-wave-b-crm-sales.md`.

## END PROMPT
