# Phase 11 — Payroll Design

> Two systems: **Internal Payroll** (monthly salary) and **Project Payroll** (revenue sharing). Support **Fixed / Percentage / Hybrid**. **Rules are configurable — never hardcode percentages.**
> Three core entities (required by brief): **PayrollRule**, **PayrollDistribution**, **PayrollHistory**. Plus the run/adjustment scaffolding to compute them.

---

## 11.1 Two payroll systems, one engine

| | Internal Payroll | Project Payroll |
|---|---|---|
| Trigger | Monthly cycle (cron, configurable day, default 25th) | Project revenue booked (receipt linked to project) or manual run |
| Scope | Per user (employee) | Per project × contributor |
| Base | Fixed salary_base per user | Project revenue/profit (configurable) |
| Formula | Usually `fixed` (monthly salary) | Usually `percent` or `hybrid` |
| Output | One history entry per user per month | One history entry per contributor per project-run |
| Finance impact | Posts an `expense` (category: payroll) | Posts an `expense` (category: payroll, project-tagged) |

**One engine** (`PayrollEngine`) handles both — it's the rules in `payroll_rules` that differ by `type`. This avoids code duplication and keeps the audit trail uniform.

---

## 11.2 The PayrollRule entity (the configuration core)

A rule answers: **"For whom, on what base, with what formula, at what priority?"**

| Field | Purpose |
|---|---|
| `type` | `internal` \| `project` |
| `formula` | `fixed` \| `percent` \| `hybrid` |
| `fixed_amount` | used when formula includes fixed (salary, retainer, bonus base) |
| `percentage` | used when formula includes percent |
| `scope` | `global` \| `role` \| `user` \| `project` \| `department` |
| `scope_ref_id` | the user_id / role_id / project_id (null when global) |
| `base` | what the percentage applies to: `gross_revenue` \| `net_revenue` \| `profit` \| `salary_base` \| `fixed_value` |
| `priority` | higher wins when multiple rules match a (user, context) |
| `min_payout` / `max_payout` | clamps |
| `effective_from` / `effective_to` | validity window |
| `is_active` | on/off without delete |

**Examples of real rules (data, not code):**
1. *Junior dev monthly salary:* type=internal, formula=fixed, fixed_amount=2000, scope=user, scope_ref_id=42, base=salary_base, priority=10.
2. *All devs base retainer + revenue share:* type=project, formula=hybrid, fixed_amount=300, percentage=15.0, scope=role, scope_ref_id=role:developer, base=net_revenue, priority=20.
3. *Project lead gets bigger share:* type=project, formula=percent, percentage=25.0, scope=user, scope_ref_id=88, base=profit, priority=50 (overrides rule 2 for this user on projects they lead).
4. *Global profit share for everyone:* type=project, formula=percent, percentage=5.0, scope=global, base=profit, priority=1 (floor; specific rules override).

> The brief says **"Never hardcode percentages."** Every number above lives in `payroll_rules` rows — change them in the admin UI, no deploy.

---

## 11.3 Rule resolution algorithm (the heart)

Given a **payroll context** = `{ type, user, project?, period, baseAmounts }`, resolve which rule(s) apply:

```
1. Candidate rules = active rules WHERE type = ctx.type
                     AND effective_from <= ctx.period <= COALESCE(effective_to, ∞)
2. Filter by scope match:
   - global  → always matches
   - role    → matches if user has the role (scope_ref_id = role_id)
   - user    → matches if scope_ref_id = user.id
   - project → matches if scope_ref_id = ctx.project.id
   - department → (future) matches user's department
3. Rank candidates by scope specificity (most specific first):
   user > project > role > department > global
   (Within same scope, higher `priority` wins.)
4. For formula resolution, we support TWO policies (selectable per run):
   a. "Single best rule": pick the top-ranked candidate. (Default for internal salary.)
   b. "Stacking": sum all matching rules (e.g., global 5% + role 15%). (Default for project revenue share.)
5. Compute payout per formula (see 11.4).
6. Apply adjustments (bonus/deduction) from payroll_adjustments for (run, user).
7. Clamp to [min_payout, max_payout].
```

This is implemented in `PayrollEngine.resolve(context)` and returns a `Distribution` with a full `breakdown` JSON trace (so anyone can audit *why* a number came out).

---

## 11.4 Formula computation

Let `B` = base amount (depends on rule.base; resolved from finance/contract data).

| Formula | Computation |
|---|---|
| `fixed` | `payout = fixed_amount` |
| `percent` | `payout = round(B × percentage / 100, 2)` |
| `hybrid` | `payout = fixed_amount + round(B × percentage / 100, 2)` |

**Rounding:** banker's rounding to 2 decimals (configurable in settings: `payroll.rounding_mode`).

**Base resolution (`B`):**
- `salary_base` → the user's configured salary base (from their internal rule's `fixed_amount`, or a `users.salary_base`-equivalent setting).
- `gross_revenue` → sum of `invoices.grand_total` for the project (issued in period), regardless of collection.
- `net_revenue` → sum of `receipts` allocated to the project's invoices (collected).
- `profit` → `net_revenue − project_expenses − other_payroll_for_project`.
- `fixed_value` → `fixed_amount` itself (rare; for flat bonuses).

> **Why distinguish gross vs net vs profit?** Agencies legitimately pay shares on collected money (you can't distribute cash you haven't received). Default for revenue share is **`net_revenue`** (collected). Profit-share uses `profit`. Configurable per rule.

---

## 11.5 The PayrollRun lifecycle

State machine:

```
draft ──compute──▶ computing ──▶ computed ──approve──▶ approved ──post──▶ posted
                       │                                              │
                       └──── (errors) ──▶ draft                       └──reverse──▶ reversed
```

- **draft** — created, nothing computed.
- **computing** — engine running (transient; for large runs).
- **computed** — distributions generated, editable (adjustments can be added).
- **approved** — signed off (by finance/hr).
- **posted** — immutable; writes `payroll_history` rows + a finance `expense` (one per run, or per user — configurable: `payroll.expense_grouping`).
- **reversed** — a posted run reversed by creating a *new* reversing run (`reversal_of` pointer); original `payroll_history` rows get `is_reversed=true`, and a reversing expense is posted.

**Idempotency:** a run key `(type, periodStart, periodEnd, projectId?)` must be unique among non-reversed runs; attempting to re-post a posted run returns the existing result.

---

## 11.6 The PayrollDistribution entity (computed line)

One row per (run, user) — or per (run, user, project) for project runs spanning multiple projects. Captures:

- `base_amount` — the `B` used.
- `rule_id` — the winning rule (or null if stacked — then breakdown lists all).
- `formula` — snapshot of the formula used.
- `computed_amount` — engine output before adjustments.
- `adjustment_amount` — sum of adjustments.
- `final_amount` — what will be paid/posted.
- `breakdown` (JSON) — full trace:
  ```json
  {
    "base": "net_revenue",
    "baseAmount": "12000.00",
    "appliedRules": [
      {"ruleId": 4, "scope":"global", "formula":"percent", "percentage":"5.0", "amount":"600.00"},
      {"ruleId": 2, "scope":"role:developer", "formula":"hybrid", "fixed":"300.00", "percentage":"15.0", "amount":"2100.00"}
    ],
    "subtotal": "2700.00",
    "adjustments": [{"kind":"bonus","amount":"200.00","reason":"extra hours"}],
    "adjustmentTotal": "200.00",
    "final": "2900.00",
    "clampsApplied": false
  }
  ```

This is **the** audit artifact for "why did X get paid Y."

---

## 11.7 The PayrollHistory entity (posted, immutable)

Posted payouts live here, **one row per (run, user)**, with:
- `amount`, `currency`, `type` (salary | revenue_share | bonus | deduction | reimbursement).
- `period_label` — human label ("2026-06" or "PRJ-2026-0001 share").
- `posted_at`, `is_reversed`, `reversed_by_run_id`.
- Linked `run_id` for drill-down.

**Immutable rule:** posted history is never UPDATEd. Corrections = a new reversing entry (double-entry-style). This guarantees a complete, tamper-evident earnings record.

---

## 11.8 Internal Payroll flow (monthly salary)

```
Cron (25th, 23:59 UTC, configurable) ──▶ BillingCycle/Payroll scheduler
  └─▶ for each active employee (users with an internal rule in scope):
        create or fetch this month's internal PayrollRun (idempotent by period)
        for each employee:
          ctx = { type:'internal', user, period:{start,end} }
          dist = PayrollEngine.resolve(ctx)   // usually one fixed rule
          write payroll_distributions row
        approve (auto if setting payroll.internal_auto_approve=true) → else finance approves
        post → payroll_history (type=salary) + expense(category=payroll)
        notify employees (payslip available)
```

---

## 11.9 Project Payroll flow (revenue sharing)

```
Trigger: receipt allocated to a project's invoice (event: receipt.allocation.created)
  OR manual: finance opens a project PayrollRun

  └─▶ ctx = { type:'project', project, period:{receipt range or project lifetime}, baseAmounts }
        contributors = project_members (users) ∪ any user with a user/project-scoped rule
        for each contributor:
          ctx.user = contributor
          dist = PayrollEngine.resolve(ctx, policy='stacking')
          write payroll_distributions row
        review (finance) → approve → post
          payroll_history (type=revenue_share, period_label='PRJ-XXXX share')
          expense(category=payroll, project_id=...)
```

**Conflict with internal salary:** Project revenue share is **in addition to** salary, not a replacement (unless a rule explicitly sets salary to 0). Both history types coexist; an employee's total monthly earnings = salary run + any project share runs in that month.

---

## 11.10 Adjustments (bonus / deduction / correction)

`payroll_adjustments` overlays a manual amount onto a computed distribution *before posting*. Use cases: one-time bonus, tax correction, reimbursement. Adjustments are part of the run review; once posted, they're frozen into history. Post-posting corrections = reverse run + new run.

---

## 11.11 Configuration (settings, never code)

| Setting key | Default | Purpose |
|---|---|---|
| `payroll.internal_run_day` | 25 | day of month for internal run |
| `payroll.internal_auto_approve` | false | auto-approve monthly salary |
| `payroll.project_default_base` | net_revenue | default base for project rules |
| `payroll.project_default_policy` | stacking | single vs stacking |
| `payroll.rounding_mode` | half_even | banker's rounding |
| `payroll.expense_grouping` | per_run | one expense per run (vs per user) |
| `payroll.min_payout_global` | 0 | floor |

---

## 11.12 Edge cases & decisions

- **Employee leaves mid-month:** add a `payroll_adjustments` (kind=correction) prorating, or set `effective_to` on their rule. The engine honors `effective_to`.
- **Rule changed retroactively:** rules are *point-in-time* via `effective_from/to`; a run always uses rules effective *for the run's period*, not "now." This prevents retroactive distortion.
- **Negative profit (loss-making project):** `base=profit` can be negative. Decision: **clamp project payouts at 0** (no negative pay); configure via `payroll.allow_negative_project_payout=false`. Losses are absorbed by the agency (configurable).
- **Currency:** payouts in the project's currency; internal salary in the agency's base currency. Mixed-currency conversion is a *future* concern; today, one currency per run.
- **Contributors not in `project_members`:** a `user`-scoped rule still applies (e.g., a salesperson who closed the deal). Engine includes any user with a matching rule even if not a member.

---

## 11.13 Reporting

- **Payslip** (per history row) — PDF via template.
- **Payroll register** — per period, all employees, totals.
- **Project payroll summary** — per project, contributors + shares + total cost.
- **Earnings ledger per employee** — cumulative.

---

## 11.14 Future expansion

- Tax withholding (per-country), payslip tax breakdowns.
- Time-sheet-driven inputs (hours → base).
- Multi-currency payouts with FX.
- Contractor vs employee distinction (different rules, tax treatment).
- Bonus pools (a pot split among contributors by formula).
- Clawback rules for refunded projects.
