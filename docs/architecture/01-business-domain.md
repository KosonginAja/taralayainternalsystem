# Phase 1 — Business Domain

> Goal: define the business Taralaya OS serves, the modules it needs, how they relate, the user journeys, the end-to-end workflow, and where the product will grow.

---

## 1.1 Business description

Taralaya Studio is a **digital agency**. Its "operating system" must run the **full agency lifecycle**:

1. **Acquire** — capture leads, qualify, convert to clients.
2. **Sell** — proposals, quotations, contracts.
3. **Deliver** — projects, tasks, timelines, checklists.
4. **Bill** — invoices, down payments (DP), receipts, subscriptions.
5. **Pay** — internal payroll (salary) + project payroll (revenue share).
6. **Maintain** — assets, maintenance tickets, recurring MCO.
7. **Operate** — expenses, income, cashflow, profit, reminders, notifications.
8. **Govern** — roles, permissions, audit, activity timeline, dashboards.

The OS must feel like a **single system**, not a stitched toolchain.

---

## 1.2 Business Modules (bounded contexts)

Twelve modules. Each is a **deployment-agnostic bounded context** — one module = one set of tables, services, and API routes that does not reach into another module's tables directly.

| # | Module | Core responsibility | Primary user |
|---|---|---|---|
| M01 | **IAM** (Identity & Access) | Users, roles, permissions, auth, sessions, login/logout | Admin / all |
| M02 | **CRM** | Leads, clients, contacts, lead→client conversion | Sales |
| M03 | **Sales** | Proposals, quotations, contracts, pricelist | Sales |
| M04 | **Delivery (Projects)** | Projects, tasks, milestones, checklists, timelines | PM / Dev |
| M05 | **Finance** | Invoices, receipts, DP, expenses, income, cashflow, profit, tax | Finance |
| M06 | **Subscription / Billing** | Recurring plans, MCO, billing cycles | Finance |
| M07 | **Payroll** | Internal (salary) + project (revenue share) payroll, rules, history | HR / Finance |
| M08 | **Asset & Maintenance** | Assets, maintenance tickets, MCO contracts | Ops |
| M09 | **Notification** | WhatsApp, Email, Discord, Telegram; provider abstraction | System / all |
| M10 | **Knowledge Base** | Articles, knowledge docs, internal/external KB | All |
| M11 | **Audit & Activity** | Audit log, activity timeline, immutable trail | Admin / compliance |
| M12 | **Platform / System** | Tags, attachments, comments, reminders, settings, number sequences | All |

> **Why 12 and not more?** Each module is the smallest unit that can be reasoned about, owned, and (eventually) deployed semi-independently while still being monolithic today. Splitting further (e.g., separate "Proposals" from "Quotations") would create artificial seams; merging (e.g., Payroll into Finance) would overload Finance with conceptually different rules.

---

## 1.3 Domain Boundaries

Module boundaries are defined by **what they own** and **what they publish**.

| Module | Owns (writes) | Publishes (others read, via API/event) | Depends on |
|---|---|---|---|
| IAM | `users`, `roles`, `permissions`, `sessions` | `user.id`, auth principal | Platform (settings) |
| CRM | `leads`, `clients`, `contacts` | `client.id` | IAM, Platform |
| Sales | `proposals`, `quotations`, `contracts`, `pricelist_items` | `contract.id`, `quotation.id` | CRM, Platform |
| Delivery | `projects`, `tasks`, `milestones`, `checklists`, `timelines` | `project.id`, `task.id` | Sales, CRM, IAM |
| Finance | `invoices`, `invoice_items`, `receipts`, `expenses`, `income`, `dp_allocations`, `cashflow_snapshots` | `invoice.id`, financial events | Sales, Delivery, Subscription |
| Subscription | `plans`, `subscriptions`, `mco_contracts`, `billing_cycles` | `subscription.id` | CRM, Finance |
| Payroll | `payroll_rules`, `payroll_distributions`, `payroll_runs`, `payroll_history` | `payroll_run.id` | IAM, Delivery, Finance |
| Asset & Maintenance | `assets`, `maintenance_tickets`, `asset_assignments` | `asset.id`, `maintenance_ticket.id` | Delivery, Subscription |
| Notification | `notifications`, `notification_templates`, `notification_logs` | send results | Platform |
| Knowledge | `articles`, `article_categories` | content | IAM |
| Audit & Activity | `audit_logs`, `activity_timeline` | (append-only) | ALL (observer) |
| Platform | `tags`, `attachments`, `comments`, `reminders`, `settings`, `number_sequences` | shared primitives | IAM |

**Boundary rule (hard):** A module's service layer may **never** query another module's tables by raw SQL/join. It must call the other module's service/API or subscribe to its events. This keeps the system refactor-safe for future service-splitting.

---

## 1.4 Module Relationship (high-level data flow)

```
        ┌──────────┐   lead→client   ┌──────────┐
        │   CRM    │ ───────────────▶│   CRM    │
        │ (Leads)  │                 │ (Clients)│
        └────┬─────┘                 └────┬─────┘
             │                            │ client.id
             ▼                            ▼
        ┌─────────────────────┐    ┌───────────────┐
        │       Sales         │◀───│  Subscription │ (recurring)
        │ proposals/quotations│    │   / MCO       │
        │ /contracts/pricelist│    └───────┬───────┘
        └────────┬────────────┘            │
                 │ contract.id             │
                 ▼                         │
        ┌──────────────────┐               │
        │     Delivery     │◀──────────────┘
        │ projects/tasks/  │
        │ milestones/      │
        │ checklists/      │
        │ timelines        │
        └────────┬─────────┘
                 │ project.id (drives billing + payroll)
                 ▼
        ┌──────────────────┐        ┌──────────────────┐
        │     Finance      │◀──────▶│     Payroll      │
        │ invoices/receipts│        │ salary + revenue │
        │ DP/expenses/cash │        │ share + rules    │
        └────────┬─────────┘        └──────────────────┘
                 │
                 ▼
        ┌──────────────────┐
        │ Asset/Maintenance│  (post-delivery retention)
        └────────┬─────────┘
                 │
                 ▼
   Cross-cutting: Notification, Audit, Activity, Platform (tags/attachments/comments/reminders/settings)
```

---

## 1.5 User Journeys

### Journey A — Lead to Cash (the spine)
```
Lead captured → Lead qualified → Lead → Client conversion
  → Proposal/Quotation → Contract signed
  → Project created → Down Payment (DP) collected
  → Tasks delivered → Milestones hit
  → Invoice issued → Receipt recorded
  → Project closed → Handover to Maintenance/MCO
  → Reminders for renewals
```

### Journey B — Recurring Revenue (MCO/Subscription)
```
Existing client → Subscription/MCO plan defined
  → Billing cycle generated each period
  → Invoice auto-created → Receipt recorded
  → Maintenance ticket opened when work happens
  → Profit tracked per cycle
```

### Journey C — Internal Payroll
```
Employee (User) hired → Payroll rule attached (fixed salary)
  → Monthly payroll run → Payroll history record
  → Linked to finance (expense)
```

### Journey D — Project Payroll (Revenue Share)
```
Project closed & revenue booked → Revenue-share rule applies
  → Distribution computed per contributor
  → Payroll history record per contributor
  → Conflicts with internal salary resolved by rule priority
```

### Journey E — Governance (Admin)
```
Admin sets roles & permissions → User assigned role(s)
  → Every action audited → Activity timeline updated
  → Dashboard reflects live metrics
```

### Journey F — Operations (Asset/Maintenance)
```
Asset registered → Assigned to project/client
  → Maintenance ticket opened → Resolved
  → MCO renewal reminder fired
```

---

## 1.6 Business Workflow (canonical, end-to-end)

This is the single canonical automation spine. Phase 13 expands each transition with concrete events.

```
LEAD ──qualify──▶ CLIENT ──quote──▶ QUOTATION ──accept──▶ CONTRACT
   │                                              │
   │                                              ▼
   │                                         PROJECT ──spawn──▶ TASKS
   │                                              │              │
   │                                              ▼              ▼
   │                                         DP collected   MILESTONES
   │                                              │
   └──────────────────────────────────────────────┼─────────────▶
                                                  ▼
                            INVOICE ──paid──▶ RECEIPT ──▶ CASHFLOW/PROFIT
                                                  │
                                                  ▼
                                  REMINDER ──▶ MAINTENANCE / MCO RENEWAL
```

**Key business rules embedded in the workflow:**
- A **Project cannot start** until a Contract exists (configurable: allow draft contract for internal projects).
- An **Invoice cannot be paid more than its total** (DP allocations cap at invoice total).
- **Payroll (revenue share) cannot run** until the project's revenue is booked (receipt linked to project).
- **Maintenance tickets** can only be opened against a client with an active MCO or a closed project.

---

## 1.7 Future Expansion Plan

Ordered by likelihood × value. Each future item is **prepared for** but **not built now**.

### Near-term (high readiness already baked in)
1. **Multi-tenant SaaS** — discriminator `tenant_id`, tenant-scoped number sequences, tenant-scoped roles. (See overview §"Multi-tenant readiness".)
2. **Tax engine** — invoice line tax, withholding tax, tax reports. `tax_rate`, `tax_component` tables reserved in Finance design.
3. **Client portal** — a read-only + payment surface for clients; reuses the same REST API with a client-scoped role.
4. **Document e-signing** — proposals/contracts signed digitally; `contract.signed_document_url`, signature audit events.

### Mid-term
5. **Budgets & estimates vs actuals** — per-project budget lines, variance tracking.
6. **Time tracking** — timers/logs feeding task progress and payroll inputs.
7. **Vendor/procurement** — purchase orders, supplier management (mirror of CRM/Finance for outbound).
8. **Inventory** — for agencies that resell hardware/hosting.

### Long-term
9. **Workflow automation designer** (visual) — generalize Phase 13's event list into a user-editable rule engine.
10. **AI assistant** — natural-language queries over dashboards; semantic search over Knowledge Base.
11. **Marketplace of agency templates** — reusable project/task templates, quotation templates.
12. **Banking integrations** — auto-reconciliation of receipts against bank feeds.

**Architecture invariant:** Every future item must be addable as a **new module or a new table within an existing module**, never by restructuring existing relationships. If an item forces a restructuring, it was mis-scoped.

---

## 1.8 Non-goals (explicit, to prevent scope creep)

- Not a **general accounting ledger** (double-entry). Finance is cashflow/P&L-oriented. A ledger is a Phase-2-of-the-product concern.
- Not a **chat platform**. Comments exist; real-time chat does not.
- Not a **CI/CD or devops tool**, even though the agency builds software for clients.
- Not **multi-currency conversion engine** today. We store a currency code per amount; FX conversion is future.
