# Taralaya OS — Implementation Prompt Pack

> A set of **copy-paste prompts** that drive an implementation agent (any capable coding AI) to build the system **following the MCP** (`docs/architecture/`).
> One prompt per build wave. Run them in order.

---

## How this works

1. The **MCP** (`docs/architecture/00-overview.md` → `20-mcp-package.md`) is the source of truth — **rules, decisions, entity defs, ERD, API, folder layout.**
2. Each prompt here tells an agent **which slice of the MCP to build next**, with explicit "Definition of Done" and gates.
3. You paste **Wave 0 (master boot)** once to prime the agent, then paste **Wave A → I** sequentially. After each wave, the agent stops at a checkpoint for your review.

```
docs/
├── architecture/      ← the MCP (what to build + rules)
└── prompts/           ← this pack (how to drive the build)
    ├── README.md            ← you are here
    ├── 00-master-boot.md    ← paste first (sets role + global constraints)
    ├── 01-wave-a-foundation.md
    ├── 02-wave-b-crm-sales.md
    ├── 03-wave-c-delivery.md
    ├── 04-wave-d-finance.md
    ├── 05-wave-e-subscription-asset.md
    ├── 06-wave-f-payroll.md
    ├── 07-wave-g-cross-cutting.md
    ├── 08-wave-h-frontend.md
    ├── 09-wave-i-hardening.md
    └── 99-review-gate.md    ← paste between waves (review + handoff)
```

---

## How to use it (3 steps, repeated)

1. **Open the wave prompt file** (e.g. `01-wave-a-foundation.md`).
2. **Copy the entire contents** and paste it into a fresh agent session (or the same session, after the previous wave's review gate passes).
3. Let the agent work to its **Definition of Done**, then paste `99-review-gate.md` to review before the next wave.

> The prompts are **self-contained**: a fresh agent that has read the MCP can execute any single wave. You do **not** need to re-explain the project each time — each prompt points the agent at the right MCP files.

---

## Rules for you (the operator)

- **Run waves in order.** The dependency graph is strict (Phase 20 §20.10). Skipping a wave will produce broken references.
- **Never let the agent edit `docs/architecture/`.** It's the spec. If the agent thinks the spec is wrong, it must stop and ask — per the "undefined-decision protocol" (Phase 20 §20.14).
- **Review at each gate.** Wave N builds on Wave N−1's output. Catching a wrong assumption early is cheap; late is expensive.
- **Commit after each wave** (conventional commits, e.g. `feat(iam): add users/roles/permissions`).
- **One wave per session** is ideal. If a session gets long, the review gate is your natural restart point.

---

## Wave summary

| Wave | Prompt file | Builds | Depends on |
|---|---|---|---|
| 0 | `00-master-boot.md` | (priming only — role + constraints) | — |
| A | `01-wave-a-foundation.md` | Monorepo scaffold, `packages/db` (Wave 0+1 schema), `core/*`, IAM module, audit/activity core | — |
| B | `02-wave-b-crm-sales.md` | CRM (leads/clients/contacts), Sales (pricelist/quotations/proposals/contracts) | A |
| C | `03-wave-c-delivery.md` | Projects, members, tasks, assignments, milestones, checklists, templates | B |
| D | `04-wave-d-finance.md` | Invoices, receipts, DP (both modes), expenses, incomes, snapshots, reports | C |
| E | `05-wave-e-subscription-asset.md` | Plans, subscriptions, billing cycles, MCO; assets, assignments, maintenance tickets, SLA | D |
| F | `06-wave-f-payroll.md` | Payroll rules, runs, distributions, history, adjustments, engine, schedulers | E |
| G | `07-wave-g-cross-cutting.md` | Notification (4 channels), platform (tags/attachments/comments/reminders/settings), knowledge base, audit/activity query endpoints | F |
| H | `08-wave-h-frontend.md` | Next.js web app: auth shell + one section per module + dashboards | G |
| I | `09-wave-i-hardening.md` | E2E flows, perf passes, index verification, security review, CI/CD, docs sync | H |

---

## Quick-start (the short version)

1. Paste `00-master-boot.md`.
2. Paste `01-wave-a-foundation.md`. Agent builds. Paste `99-review-gate.md`. Review. Commit.
3. Repeat for waves B → I.

That's it. The MCP + these prompts = a deterministic build of Taralaya OS.
