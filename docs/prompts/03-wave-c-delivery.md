# Wave C — Delivery Prompt

> **Prerequisite:** Wave B reviewed and committed.
> **Builds:** Delivery module (projects/members/tasks/assignments/milestones/checklists/templates). Completes the `projects` table stub from Wave B.

---

## BEGIN PROMPT — copy everything below this line

Execute **Wave C (Delivery)** of the Taralaya OS build. Master boot + Waves A–B in effect.

### Step 1 — Read these MCP files
1. `04-entity-definitions.md` → Delivery entities: `projects`, `project_members`, `tasks`, `task_assignments`, `milestones`, `checklists`, `checklist_items`, `project_templates`.
2. `07-drizzle-schema-plan.md` → §7.4.
3. `08-migration-plan.md` → §8.2 Wave 2 remainder (project_members, milestones, tasks, task_assignments, checklists, checklist_items).
4. `02-domain-model.md` → M04 (Delivery): aggregates, invariants, events.
5. `09-rest-api-design.md` → Delivery section (projects/tasks/milestones/templates).
6. `18-validation-rules.md` → §18.6 (`PRJ-`, `TASK-PRJ1-0001`), §18.8 (project/task state machines).
7. `10-permission-matrix.md` → Delivery rows (note the `.own` scope for developers on tasks).

### Step 2 — Complete the `projects` table + add Delivery tables
Wave B created `projects` as a stub. Now:
- Verify `projects` columns match Phase 4 §22 fully (Wave B should have; if anything's missing, add via a new additive migration — never edit the prior one).
- Add tables: `project_members`, `milestones`, `tasks`, `task_assignments`, `checklists`, `checklist_items`, `project_templates`.
- Relations: project→members, project→tasks, project→milestones, milestone→tasks, task→assignments, task→parent_task (self), checklist→items. Polymorphic `checklists.subject_type/subject_id` (task|project).
- Migration `0004_wave2_delivery_completion.sql` (or fold into the Wave 2 file's numbering — just keep ordering correct). Review DDL.

### Step 3 — Build `modules/delivery`
Per Phase 9 Delivery + Phase 2 M04:
- `routes/`:
  - `projects.routes.ts` (list/create/detail/update/delete + start/hold/complete/cancel + members CRUD + timeline + board + metrics).
  - `tasks.routes.ts` (list/create/detail/update/delete + assign + transition + checklists CRUD).
  - `milestones.routes.ts` (under projects: create/list; reach; update/delete).
  - `project-templates.routes.ts` (CRUD, `setting.manage`).
- `services/`:
  - `ProjectService` — lifecycle (planning→active→on_hold↔active→completed|cancelled); **`complete` requires all non-optional milestones reached** (configurable via setting `delivery.require_milestones_to_complete`); progress recomputed on task/milestone change (denormalized `projects.progress`, Phase 6 §6.2); create-from-template seeds tasks+milestones from `project_templates.default_task_blueprint`/`default_milestones`.
  - `TaskService` — assignment (many-to-many via `task_assignments`, one `is_primary`); transitions via `taskStateMachine`; `done` optionally requires checklist complete (setting); logged_hours accumulation (no time-tracking UI yet — just the field); parent/child (cycle prevention in code).
  - `MilestoneService` — ordered; `reach` is idempotent.
  - `TimelineService` (project-level entries — also feeds global Activity via `ActivityService`).
- `repositories/`: per entity (audited).
- `dto/`: Zod.
- `domain/`: `projectStateMachine`, `taskStateMachine`, `progress.ts` (pure: from tasks/milestones → 0–100).
- `events/`: emit `project.created/started/completed/on_hold/cancelled`, `task.created/assigned/started/completed/blocked/reopened`, `milestone.reached`, `checklist.item.toggled`. Subscribe → activity (Phase 16) + audit. `project.completed` triggers future MCO-offer hook (stub handler now).
- Number sequences: `PRJ-`, `TASK-PRJ{n}-NNNN` (per-project sequence — extend `NumberSequenceService` to support a scope key like `task:project:{id}` if not already).

### Step 4 — Scoped permissions for developers
Phase 10 notes `task.update`/`task.transition` for developers are `.own`-scoped. Implement per §10.6:
- Route middleware passes with `task.update` (developer has it).
- Service layer additionally enforces: the actor is an assignee of the task OR a `project_member` of the task's project. Otherwise `403` with `code: 'NOT_ASSIGNED'`.
- Managers/admins (with `task.update.any` implicit via `.manage`) bypass the ownership check.
- Project list for developers filters to projects where they're a member; for managers, all projects.

### Step 5 — Wire routers + cross-module
- Mount under `/api/v1`.
- Delivery references `clientId`/`contractId` (from Wave B) — do not query clients/contracts tables directly; trust the FK + call CRM/Sales services only if a derived field is needed.
- `projects.board` endpoint returns tasks grouped by status (uses the `idx_task_project(project_id, status)` composite).

### Definition of Done (Wave C)

- [ ] All Delivery tables created; migration applies; `projects` no longer a stub.
- [ ] Project lifecycle: create → start → hold → resume → complete; `complete` blocked when required milestones incomplete (test the `422`); from-template creation seeds tasks+milestones.
- [ ] Progress auto-recomputes: complete all of a project's tasks → `progress` reflects it; verify denormalized field stays consistent (recompute-on-write + a unit test for `progress.ts`).
- [ ] Task board endpoint returns correct grouping; `idx_task_project` composite used (verify via EXPLAIN in a test/comment).
- [ ] Task state machine enforced; `done` requires checklist when setting enabled; parent/child cycle prevented (test: try to make A child of B then B child of A → `422`).
- [ ] Developer scope: a developer can update their own task, gets `403 NOT_ASSIGNED` on another's; manager bypasses; project list scoped to membership.
- [ ] Milestones: reach is idempotent (calling twice doesn't error or duplicate).
- [ ] Document numbers: `PRJ-2026-00001`; tasks `TASK-PRJ1-0001` per-project.
- [ ] Public IDs: `prj_1`, `task_1`, `ms_1`.
- [ ] Events → activity + audit for all cataloged Delivery events.
- [ ] Cross-module rule holds: no `modules/delivery` import of `modules/crm` or `modules/sales` tables.
- [ ] typecheck/lint/build/test green.

### Verification
```
pnpm turbo run typecheck lint build test
pnpm db:migrate
# E2E: client (from Wave B) → project → tasks → milestone reach → project complete
```

### Checkpoint — STOP
Report built modules, test counts, ambiguities resolved, spec concerns. **Do not start Wave D.**

## END PROMPT
