# Phase 2 — Domain Model (DDD per module)

> For **every module**: Purpose, Responsibilities, Dependencies, Events, Boundaries, **Aggregates**, **Value Objects**, **Entities**, **Services**, **Repository**, **Future Extension**.
>
> Conventions:
> - **Aggregate root** = the entity others cluster around for consistency.
> - **Value Object (VO)** = immutable, compared by value, no identity.
> - **Entity** = has identity, mutable.
> - **Domain Event** = `past_tense_verb.subject` (e.g. `invoice.issued`).
> - Repositories are named `<Aggregate>Repository` and expose intent-revealing methods (not generic CRUD only).

---

## M01 — IAM (Identity & Access)

**Purpose:** Authenticate users and authorize every action via merged RBAC.

**Responsibilities:** user lifecycle, credentials, sessions, roles, permissions, permission resolution (union across a user's roles), login/logout auditing.

**Dependencies:** Platform (settings, for auth config).

**Boundaries:** Owns identity & authorization decisions. Publishes `user.id` and the *principal* (current user + resolved permissions). Nothing else stores passwords or sessions.

**Domain Events:**
- `user.created`, `user.updated`, `user.activated`, `user.deactivated`, `user.deleted`, `user.restored`
- `user.logged_in`, `user.logged_out`, `user.login_failed`
- `role.created`, `role.updated`, `role.deleted`
- `user.role_assigned`, `user.role_revoked`
- `permission.granted`, `permission.revoked`

**Aggregates:**
| Aggregate | Root | Invariants |
|---|---|---|
| User | `User` | Email unique (per tenant future); at least one active role when activated; soft-deleted users cannot log in. |
| Role | `Role` | Role key unique; role deletable only when no users attached (or reassign first). |
| PermissionGrant | `RolePermission` | (roleId, permissionKey) unique. |

**Value Objects:**
- `Email` (normalized lowercase, validated)
- `PasswordHash` (algorithm + hash + salt metadata; never plaintext)
- `PermissionKey` (string `module.action[.scope]`, e.g. `invoice.view`, `invoice.approve`)
- `Principal` (resolved at request time: userId + tenantId + union of permissions) — ephemeral, not persisted.

**Entities:** `User`, `Role`, `Permission` (catalog), `RolePermission`, `UserRole`, `Session`, `RefreshToken`.

**Services:**
- `AuthService` — login, logout, token issue/refresh, password policy.
- `PermissionResolver` — given userId → merged permission set (cached).
- `PasswordService` — hash/verify (configurable algorithm).
- `SessionService` — create/invalidate sessions.

**Repository:** `UserRepository`, `RoleRepository`, `PermissionRepository`, `SessionRepository`.

**Future Extension:** SSO/OAuth, MFA, passkeys, per-tenant roles, scoped permissions (e.g. "view own projects only"), service accounts/API keys.

---

## M02 — CRM

**Purpose:** Manage leads through to clients.

**Responsibilities:** capture leads, qualify, store contacts, convert lead→client, dedupe.

**Dependencies:** IAM (ownership/assignment), Platform (tags, attachments, comments).

**Boundaries:** Owns lead & client identity. Publishes `client.id`. Does not know about invoices/projects directly (those reference `client_id`).

**Domain Events:**
- `lead.created`, `lead.updated`, `lead.qualified`, `lead.converted`, `lead.lost`, `lead.reassigned`
- `client.created`, `client.updated`, `client.merged`, `client.deactivated`
- `contact.created`, `contact.updated`

**Aggregates:**
| Aggregate | Root | Invariants |
|---|---|---|
| Lead | `Lead` | Status progression follows allowed transitions; conversion requires a created Client. |
| Client | `Client` | Unique business identity (email/org + name); cannot hard-delete if it has projects/invoices (soft-delete only). |

**Value Objects:**
- `ContactInfo` (email, phone, optional social)
- `Address` (line, city, state, postal, country)
- `Money` (amount + currency) — shared VO used everywhere.

**Entities:** `Lead`, `Client`, `Contact` (a person within a client/lead), `LeadSource` (catalog), `LeadStage` (configurable pipeline stage).

**Services:**
- `LeadService` — create/qualify/convert/reassign.
- `ClientService` — create/merge/deactivate.
- `ContactService`.

**Repository:** `LeadRepository`, `ClientRepository`, `ContactRepository`.

**Future Extension:** lead scoring, marketing automation hooks, client portal accounts, contact-import pipelines.

---

## M03 — Sales

**Purpose:** Turn clients into signed contracts via proposals, quotations, and pricelists.

**Responsibilities:** maintain pricelist (services + rates), build quotations (items → totals), attach proposals (narrative), negotiate (revision), convert to contract.

**Dependencies:** CRM (client), Platform (templates, attachments), Delivery (handoff to project).

**Boundaries:** Owns the pre-contract commercial artifacts. Publishes `contract.id`, `quotation.id`.

**Domain Events:**
- `pricelist.item.created/updated/archived`
- `quotation.created`, `quotation.updated`, `quotation.sent`, `quotation.viewed`, `quotation.accepted`, `quotation.rejected`, `quotation.expired`, `quotation.converted`
- `proposal.created`, `proposal.updated`, `proposal.submitted`, `proposal.accepted`
- `contract.created`, `contract.updated`, `contract.signed`, `contract.terminated`, `contract.expired`

**Aggregates:**
| Aggregate | Root | Invariants |
|---|---|---|
| Quotation | `Quotation` | Items belong to one quotation; totals recomputed from items; status transitions enforced; cannot accept an expired quotation. |
| Proposal | `Proposal` | One-to-one or many-to-one with client; versioned. |
| Contract | `Contract` | A contract requires a client and (typically) an accepted quotation/defined scope; signed date ≤ start date. |
| PriceList | `PriceListItem` (catalog aggregate) | (serviceKey) unique; archived not deleted; historical quotations retain snapshot of price. |

**Value Objects:**
- `QuotationTotals` (subtotal, discount, tax, grand total — computed)
- `PriceSnapshot` (unit price + currency captured at quotation time, so future pricelist changes don't mutate historical quotations)
- `ValidityWindow` (validFrom, validTo)
- `ContractTerms` (scope, deliverables, payment terms summary)

**Entities:** `PriceListItem`, `Quotation`, `QuotationItem`, `Proposal`, `Contract`, `ContractDocument` (signed PDFs/links), `Discount` (line/total level, percent or fixed).

**Services:**
- `QuotationService` — build/revise/send/accept; enforces totals.
- `ProposalService`.
- `ContractService` — create/sign/terminate; triggers `contract.signed` → Delivery.
- `PricelistService` — CRUD + archive; snapshots into quotations.

**Repository:** `QuotationRepository`, `ProposalRepository`, `ContractRepository`, `PricelistRepository`.

**Future Extension:** e-signing integration, quotation templates, AI-assisted proposal drafting, multi-currency quotation, version diffing.

---

## M04 — Delivery (Projects)

**Purpose:** Deliver committed work; track scope, progress, people, timelines.

**Responsibilities:** projects, tasks, milestones, checklists, timelines (project-level), team assignment.

**Dependencies:** Sales (contract), IAM (assignees), Platform (tags, comments, attachments), Finance (project drives billing), Payroll (project drives revenue share).

**Boundaries:** Owns execution state. Publishes `project.id`, `task.id`. Projects reference `contract_id` and `client_id` but do not modify them.

**Domain Events:**
- `project.created`, `project.updated`, `project.started`, `project.completed`, `project.on_hold`, `project.cancelled`, `project.reopened`
- `task.created`, `task.updated`, `task.assigned`, `task.started`, `task.completed`, `task.reopened`, `task.blocked`
- `milestone.created`, `milestone.reached`
- `checklist.item.toggled`
- `timeline.entry.added`

**Aggregates:**
| Aggregate | Root | Invariants |
|---|---|---|
| Project | `Project` | Needs client (and usually contract); status transitions enforced; completion requires milestones done (configurable). |
| Task | `Task` | Belongs to one project; one assignee (or multiple via assignment table); status transitions. |
| Milestone | `Milestone` | Ordered within project; reaching a milestone is idempotent. |

**Value Objects:**
- `DateRange` (start, due, end)
- `TaskEstimate` (hours or story points + unit)
- `Progress` (percent, derived from tasks/milestones)
- `ProjectStatus` (enum VO).

**Entities:** `Project`, `ProjectMember`, `Task`, `TaskAssignment`, `Milestone`, `Checklist`, `ChecklistItem`, `Timeline` (project timeline entries), `ProjectTemplate` (reusable).

**Services:**
- `ProjectService` — lifecycle, progress computation.
- `TaskService` — assignment, transitions.
- `MilestoneService`.
- `TimelineService` — append events (also feeds the global Activity Timeline, M11).

**Repository:** `ProjectRepository`, `TaskRepository`, `MilestoneRepository`, `TimelineRepository`.

**Future Extension:** time tracking, Gantt/dependencies, Kanban boards, resource planning, client-visible project portal, budget vs actuals.

---

## M05 — Finance

**Purpose:** Bill clients, collect money, track expenses/income, compute cashflow & profit.

**Responsibilities:** invoices + items, receipts, down payments (DP), expenses, income, allocations, cashflow snapshots, profit calc.

**Dependencies:** Sales (contract, quotation → invoice source), Delivery (project → invoice/expense link), Subscription (cycle → invoice), Platform (number sequences, attachments).

**Boundaries:** Owns all monetary state. **Money invariants are the strictest in the system.** Publishes `invoice.id`, financial events for dashboards/payroll.

**Domain Events:**
- `invoice.created`, `invoice.updated`, `invoice.issued`, `invoice.sent`, `invoice.paid`, `invoice.partially_paid`, `invoice.voided`, `invoice.overdue`
- `invoice_item.created/updated`
- `receipt.created`, `receipt.voided`
- `dp.collected`, `dp.allocated`, `dp.refunded`
- `expense.created`, `expense.approved`, `expense.paid`, `expense.voided`
- `income.created`, `income.categorized`
- `cashflow.snapshot.computed`

**Aggregates:**
| Aggregate | Root | Invariants |
|---|---|---|
| Invoice | `Invoice` | Totals from items; paid amount ≤ total (DP allocations enforced); status transitions; voiding reverses allocations. |
| Receipt | `Receipt` | One receipt ↔ one or more invoice allocations; amount > 0; voidable with reversal. |
| DownPayment | `DownPayment` (DP) | DP collected against client/contract; allocations to invoices cannot exceed DP amount. |
| Expense | `Expense` | Needs category + amount + payer; approval workflow optional. |
| Income | `Income` | Categorized; linked to client/project when applicable. |

**Value Objects:**
- `Money` (amount `DECIMAL`, currency) — **shared system-wide VO**.
- `InvoiceTotals` (subtotal, discount, tax, total, paid, balance — computed).
- `Allocation` (receiptId, invoiceId, amount).
- `PaymentStatus` (enum: unpaid, partial, paid, overpaid-flag, voided).

**Entities:** `Invoice`, `InvoiceItem`, `Receipt`, `ReceiptAllocation`, `DownPayment`, `DpAllocation`, `Expense`, `ExpenseCategory`, `Income`, `IncomeCategory`, `CashflowSnapshot`, `ProfitSnapshot`, `TaxRate` (reserved), `TaxComponent` (reserved).

**Services:**
- `InvoiceService` — issue, recompute, mark paid (idempotent by external payment ref).
- `ReceiptService` — record payment, allocate to invoices, enforce caps.
- `DownPaymentService` — collect, allocate, refund (supports **unlimited DP** and **manual DP** modes per Phase 12).
- `ExpenseService`, `IncomeService`.
- `FinanceReportingService` — cashflow/profit snapshots.

**Repository:** `InvoiceRepository`, `ReceiptRepository`, `DownPaymentRepository`, `ExpenseRepository`, `IncomeRepository`, `ReportingRepository` (read models).

**Future Extension:** double-entry ledger, tax engine, multi-currency FX, bank reconciliation, recurring invoice schedules, cost centers.

---

## M06 — Subscription / Billing

**Purpose:** Recurring revenue: plans, subscriptions, MCO (maintenance contract orders), billing cycles.

**Responsibilities:** define plans, subscribe clients, generate cycles, auto-create invoices per cycle, manage renewals/cancellations.

**Dependencies:** CRM (client), Finance (invoice), Asset & Maintenance (MCO drives tickets).

**Boundaries:** Owns the recurring model. Publishes `subscription.id`, billing cycle events. Does not modify invoices directly; requests invoice creation from Finance.

**Domain Events:**
- `plan.created/updated/archived`
- `subscription.created`, `subscription.activated`, `subscription.renewed`, `subscription.suspended`, `subscription.cancelled`, `subscription.expired`
- `mco_contract.created/signed/renewed/expired`
- `billing_cycle.generated`, `billing_cycle.invoiced`

**Aggregates:**
| Aggregate | Root | Invariants |
|---|---|---|
| Subscription | `Subscription` | One client, one plan; cycle dates monotonic; renewal extends `current_period_end`. |
| McoContract | `McoContract` | Tied to client + (optionally) closed project; has SLA terms; active period enforced. |
| Plan | `Plan` | Price/interval unique; archived not deleted. |

**Value Objects:**
- `BillingInterval` (monthly, quarterly, yearly, custom days)
- `Money`, `ValidityWindow`
- `CycleWindow` (periodStart, periodEnd)

**Entities:** `Plan`, `Subscription`, `SubscriptionItem` (line within subscription), `McoContract`, `BillingCycle`.

**Services:**
- `SubscriptionService` — create/activate/renew/cancel.
- `McoService` — MCO lifecycle; emits reminders.
- `BillingCycleService` — scheduler-driven; generates invoices via Finance.

**Repository:** `SubscriptionRepository`, `McoRepository`, `PlanRepository`, `BillingCycleRepository`.

**Future Extension:** usage-based billing, proration, dunning, plan upgrades/downgrades mid-cycle, trial periods, metered MCO.

---

## M07 — Payroll

**Purpose:** Pay people — either fixed monthly salary (internal) or revenue share per project.

**Responsibilities:** configurable rules, distribution computation, run history, integration with finance (payroll = expense).

**Dependencies:** IAM (users/employees), Delivery (project revenue inputs), Finance (expense posting).

**Boundaries:** Owns payroll rules, distributions, runs, history. **Never hardcodes percentages** — all rates come from `payroll_rules`.

**Domain Events:**
- `payroll.rule.created/updated/archived`
- `payroll.run.started`, `payroll.run.computed`, `payroll.run.approved`, `payroll.run.posted`, `payroll.run.reversed`
- `payroll.distribution.computed`, `payroll.distribution.adjusted`, `payroll.distribution.paid`

**Aggregates:**
| Aggregate | Root | Invariants |
|---|---|---|
| PayrollRule | `PayrollRule` | Type (internal/project), scope, rule priority unique within scope; archived not deleted. |
| PayrollRun | `PayrollRun` | One period; status transitions; posted run is immutable except via reversal. |
| PayrollHistory | `PayrollHistoryEntry` | One entry per (run, user); posted entries immutable. |

**Value Objects:**
- `PayrollType` (internal | project)
- `PayoutFormula` (fixed | percent | hybrid) with parameters
- `Money`, `DateRange`

**Entities:** `PayrollRule`, `PayrollDistribution` (computed line per contributor per run), `PayrollRun`, `PayrollHistory`, `PayrollAdjustment` (bonus/deduction).

**Services:**
- `PayrollRuleService` — CRUD + archive; priority management.
- `PayrollEngine` — given a run context (period or project + revenue), resolves applicable rules in priority order, computes distributions. **This is the heart of Phase 11.**
- `PayrollRunService` — start/compute/approve/post/reverse.
- `PayrollHistoryService`.

**Repository:** `PayrollRuleRepository`, `PayrollRunRepository`, `PayrollHistoryRepository`, `PayrollDistributionRepository`.

**Future Extension:** payslips PDF, tax withholding on payroll, multi-currency payouts, contractor vs employee distinction, time-sheet-driven inputs.

---

## M08 — Asset & Maintenance

**Purpose:** Track assets (hardware, software licenses, domains, hosting) and handle maintenance work (often recurring under MCO).

**Responsibilities:** asset registry, assignment to projects/clients, maintenance tickets, MCO-driven renewal reminders.

**Dependencies:** Delivery (project link), Subscription (MCO link), Platform (reminders, attachments), Notification.

**Boundaries:** Owns asset identity & ticket lifecycle. Publishes `asset.id`, `maintenance_ticket.id`.

**Domain Events:**
- `asset.created/updated/assigned/unassigned/retired`
- `maintenance_ticket.created`, `maintenance_ticket.assigned`, `maintenance_ticket.in_progress`, `maintenance_ticket.resolved`, `maintenance_ticket.closed`, `maintenance_ticket.reopened`
- `asset.license_expiring`, `mco.renewal_due`

**Aggregates:**
| Aggregate | Root | Invariants |
|---|---|---|
| Asset | `Asset` | Unique tag/serial; assignable to one project/client at a time (configurable); retired assets not assignable. |
| MaintenanceTicket | `MaintenanceTicket` | Requires an asset or an active MCO; status transitions; SLA tracked. |

**Value Objects:** `AssetTag`, `SlaWindow`, `Money`, `DateRange`.

**Entities:** `Asset`, `AssetAssignment`, `MaintenanceTicket`, `MaintenanceTicketComment` (or reuse Platform Comment), `SlaPolicy`.

**Services:** `AssetService`, `MaintenanceTicketService`, `SlaEvaluator`.

**Repository:** `AssetRepository`, `MaintenanceTicketRepository`.

**Future Extension:** depreciation, asset valuation, automated license-expiry scans, vendor management for assets.

---

## M09 — Notification

**Purpose:** Deliver messages across channels; abstract providers.

**Responsibilities:** template management, channel dispatch, delivery logs, retry.

**Dependencies:** Platform (settings for provider credentials), all modules (as consumers).

**Boundaries:** Owns nothing business-critical beyond delivery. **Provider-agnostic.** Subscribes to domain events; other modules never call `sendWhatsApp()` directly — they emit events or call `NotificationService.notify()`.

**Domain Events:**
- `notification.queued`, `notification.sent`, `notification.delivered`, `notification.failed`, `notification.read`

**Aggregates:**
| Aggregate | Root | Invariants |
|---|---|---|
| NotificationTemplate | `NotificationTemplate` | (key, channel) unique; variables defined. |
| Notification | `Notification` | One recipient, one channel, one template; status machine; idempotent by external key. |

**Value Objects:**
- `Channel` (enum: whatsapp, email, discord, telegram) — extensible.
- `Recipient` (channel-specific address + optional userId).
- `TemplateVariables` (map).

**Entities:** `Notification`, `NotificationTemplate`, `NotificationLog` (per-attempt record), `NotificationPreference` (per user/channel opt-in).

**Services:**
- `NotificationService` — `notify(templateKey, recipient, vars)`; routes to provider.
- `ProviderInterface` (port) — `send(message): result`; implementations per channel.
- `NotificationScheduler` — delayed/recurring sends.

**Repository:** `NotificationRepository`, `NotificationTemplateRepository`, `NotificationLogRepository`.

**Future Extension:** in-app notifications center, push notifications, SMS, provider failover, delivery analytics, templating language upgrades.

---

## M10 — Knowledge Base

**Purpose:** Capture reusable knowledge (for internal staff and optionally clients).

**Responsibilities:** articles, categories, versioning, search, visibility scoping.

**Dependencies:** IAM (authorship, visibility).

**Boundaries:** Owns content. Read-heavy; writes are simpler than the rest of the system.

**Domain Events:**
- `article.created`, `article.updated`, `article.published`, `article.unpublished`, `article.archived`

**Aggregates:** `Article` (root; versioned; visibility internal|client|public), `Category`.

**Value Objects:** `Visibility`, `ArticleSlug`, `ContentBody` (markdown/HTML + format).

**Entities:** `Article`, `ArticleCategory`, `ArticleRevision`, `ArticleTag`.

**Services:** `ArticleService`, `KnowledgeSearchService` (full-text; MySQL FULLTEXT now, external index later).

**Repository:** `ArticleRepository`, `CategoryRepository`.

**Future Extension:** AI semantic search, client-facing portal, voting/helpfulness, video/media KB, multilingual.

---

## M11 — Audit & Activity

**Purpose:** Immutable audit trail + human-readable activity timeline.

**Responsibilities:** capture every state-changing action (audit) + every "interesting" business event (activity).

**Dependencies:** ALL modules (as observers). This module **writes**; others **read** their own audit/activity.

**Boundaries:** **Append-only.** No updates/deletes except via admin break-glass (and even then, logged). Decoupled from business invariants.

> Distinction: **Audit Log** = technical/low-level (who changed which row, old/new values). **Activity Timeline** = business/high-level ("Invoice INV-001 was issued to Acme"). Both are needed; they are separate tables. (Phase 15 & 16.)

**Domain Events:** (the act of logging itself)
- `audit.entry.recorded`
- `activity.entry.recorded`

**Aggregates:**
| Aggregate | Root | Invariants |
|---|---|---|
| AuditLog | `AuditLog` | Append-only; includes actor, action, entity, before/after, ip, userAgent. |
| ActivityTimeline | `ActivityTimelineEntry` | Append-only; human-readable; references actor + subject + optional project/client. |

**Value Objects:**
- `AuditAction` (insert/update/delete/restore/login/logout/permission_change/export/...)
- `DiffPayload` (before/after JSON)
- `ActivityVerb` + `ActivitySubject`

**Entities:** `AuditLog`, `ActivityTimelineEntry`.

**Services:**
- `AuditService` — `record(action, entity, diff, ctx)`; called by an interceptor/middleware automatically for supported actions.
- `ActivityService` — `log(verb, subject, actor, meta)`; called explicitly at meaningful business moments.
- `AuditQueryService` — read/filtered views (admin).

**Repository:** `AuditLogRepository`, `ActivityTimelineRepository`.

**Future Extension:** tamper-evident hashing (chain), export to SIEM, retention policies, PII redaction.

---

## M12 — Platform / System

**Purpose:** Shared primitives every module uses.

**Responsibilities:** tags, attachments, comments, reminders, settings, number sequences (INV-/PRJ-/…), enums/catalogs.

**Dependencies:** IAM (ownership for attachments/comments).

**Boundaries:** Truly cross-cutting. Other modules **depend on** Platform; Platform depends on no business module.

**Domain Events:**
- `tag.attached/detached`
- `attachment.uploaded/deleted`
- `comment.created/updated/deleted`
- `reminder.created/fired/snoozed/dismissed`
- `setting.updated`
- `sequence.allocated`

**Aggregates:**
| Aggregate | Root | Invariants |
|---|---|---|
| Tag | `Tag` | (name, scope) unique; polymorphic attach via `taggables`. |
| Attachment | `Attachment` | Belongs to one attachable (polymorphic); storage ref + mime + size. |
| Comment | `Comment` | Threadable; belongs to one attachable; soft-delete only. |
| Reminder | `Reminder` | DueAt; status; snoozable; link to subject. |
| Setting | `Setting` | (key) unique; typed value; per-tenant in future. |
| NumberSequence | `NumberSequence` | (prefix) unique; increments; per-tenant scope in future. |

**Value Objects:** `PolymorphicRef` (entityType + entityId), `StorageRef` (provider + key + url), `SettingValue` (typed), `SequenceFormat` (prefix + padding + reset rule).

**Entities:** `Tag`, `Taggable`, `Attachment`, `Comment`, `Reminder`, `Setting`, `NumberSequence`, `EnumValue` (config-driven statuses/categories).

**Services:**
- `TagService`, `AttachmentService`, `CommentService`, `ReminderService`, `SettingService`, `NumberSequenceService` (the document-number generator; see Phase 18), `EnumService`.

**Repository:** per-entity repositories; plus a generic `AttachmentRepository` keyed by polymorphic ref.

**Future Extension:** per-tenant settings, file CDN, comment reactions, reminder recurrence, audit of setting changes.

---

## Cross-cutting: how modules cooperate at runtime

A canonical write path (e.g. **issuing an invoice**):
1. `Finance.InvoiceService` validates and persists `invoice`.
2. Transaction commits → domain events `invoice.issued` dispatched.
3. **Synchronous subscribers** (within same transaction or just after): `ActivityService.log(...)`, `AuditService.record(...)`.
4. **Asynchronous subscribers** (queue): `NotificationService.notify('invoice.issued', recipient=client.contact, vars=...)`, dashboard read-model update.
5. `ReminderService` schedules overdue reminders based on `due_date`.

This pattern (command → transaction → event → sync + async handlers) is the backbone of every cross-module interaction and is formalized in Phase 13.
