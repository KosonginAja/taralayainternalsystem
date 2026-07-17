# Phase 3 — Complete Entity List

> Every entity in the system, grouped by module, with a one-line purpose.
> Counts: **60 entities** across **12 modules**.
> Naming: `snake_case` table names; singular concept, pluralized table (e.g. entity `User` → table `users`).

## Legend
- 🟢 Aggregate root
- 🔵 Entity (within an aggregate or standalone)
- 🟣 Join / through table
- ⚪ Catalog / config table
- 🟤 Append-only log

---

## M01 — IAM (9 entities)
| # | Entity | Table | Kind | Purpose |
|---|---|---|---|---|
| 1 | User | `users` | 🟢 | A person who can log in (staff; future: client portal). |
| 2 | Role | `roles` | 🟢 | Named bundle of permissions (e.g. Admin, Sales, Finance). |
| 3 | Permission | `permissions` | ⚪ | Catalog of permission keys (`module.action`). |
| 4 | RolePermission | `role_permissions` | 🟣 | Grants a permission to a role. |
| 5 | UserRole | `user_roles` | 🟣 | Assigns a role to a user (many-to-many). |
| 6 | Session | `sessions` | 🔵 | Active login session. |
| 7 | RefreshToken | `refresh_tokens` | 🔵 | JWT/session refresh token. |
| 8 | ApiKey | `api_keys` | 🔵 | Service/integration API key (future-ready). |
| 9 | PasswordResetToken | `password_reset_tokens` | 🔵 | Self-serve password reset token. |

## M02 — CRM (5 entities)
| # | Entity | Table | Kind | Purpose |
|---|---|---|---|---|
| 10 | Lead | `leads` | 🟢 | A prospect not yet a client. |
| 11 | LeadStage | `lead_stages` | ⚪ | Configurable pipeline stage. |
| 12 | LeadSource | `lead_sources` | ⚪ | Where the lead came from. |
| 13 | Client | `clients` | 🟢 | A paying organization/individual. |
| 14 | Contact | `contacts` | 🔵 | A person within a lead/client. |

## M03 — Sales (7 entities)
| # | Entity | Table | Kind | Purpose |
|---|---|---|---|---|
| 15 | PriceListItem | `pricelist_items` | 🟢 | A service/product with a rate. |
| 16 | Quotation | `quotations` | 🟢 | A priced offer to a client. |
| 17 | QuotationItem | `quotation_items` | 🔵 | A line in a quotation (snapshots price). |
| 18 | Proposal | `proposals` | 🟢 | A narrative/strategic offer. |
| 19 | Contract | `contracts` | 🟢 | A signed agreement. |
| 20 | ContractDocument | `contract_documents` | 🔵 | Signed/uploaded contract artifacts. |
| 21 | Discount | `discounts` | 🔵 | Line/total discount (fixed or %). |

## M04 — Delivery (8 entities)
| # | Entity | Table | Kind | Purpose |
|---|---|---|---|---|
| 22 | Project | `projects` | 🟢 | A unit of work for a client. |
| 23 | ProjectMember | `project_members` | 🟣 | User assigned to a project. |
| 24 | Task | `tasks` | 🟢 | A unit of delivery within a project. |
| 25 | TaskAssignment | `task_assignments` | 🟣 | User(s) assigned to a task. |
| 26 | Milestone | `milestones` | 🔵 | Ordered checkpoint in a project. |
| 27 | Checklist | `checklists` | 🔵 | A checklist on a task/project. |
| 28 | ChecklistItem | `checklist_items` | 🔵 | A single to-do in a checklist. |
| 29 | ProjectTemplate | `project_templates` | ⚪ | Reusable project/task blueprint. |

## M05 — Finance (14 entities)
| # | Entity | Table | Kind | Purpose |
|---|---|---|---|---|
| 30 | Invoice | `invoices` | 🟢 | A demand for payment. |
| 31 | InvoiceItem | `invoice_items` | 🔵 | A line in an invoice. |
| 32 | Receipt | `receipts` | 🟢 | Proof of a received payment. |
| 33 | ReceiptAllocation | `receipt_allocations` | 🔵 | How a receipt is split across invoices. |
| 34 | DownPayment | `down_payments` | 🟢 | Money collected before/at kickoff (DP). |
| 35 | DpAllocation | `dp_allocations` | 🔵 | How a DP is allocated to invoices. |
| 36 | Expense | `expenses` | 🟢 | Money spent. |
| 37 | ExpenseCategory | `expense_categories` | ⚪ | Classification of expense. |
| 38 | Income | `incomes` | 🟢 | Money received (non-invoice). |
| 39 | IncomeCategory | `income_categories` | ⚪ | Classification of income. |
| 40 | CashflowSnapshot | `cashflow_snapshots` | 🟤 | Period cash in/out summary. |
| 41 | ProfitSnapshot | `profit_snapshots` | 🟤 | Period profit summary. |
| 42 | TaxRate | `tax_rates` | ⚪ | Tax rate catalog (reserved/future). |

## M06 — Subscription / Billing (5 entities)
| # | Entity | Table | Kind | Purpose |
|---|---|---|---|---|
| 43 | Plan | `plans` | ⚪ | A sellable recurring plan definition. |
| 44 | Subscription | `subscriptions` | 🟢 | A client's subscription to a plan. |
| 45 | SubscriptionItem | `subscription_items` | 🔵 | A line within a subscription. |
| 46 | McoContract | `mco_contracts` | 🟢 | A maintenance contract order (retention). |
| 47 | BillingCycle | `billing_cycles` | 🔵 | One billing period instance of a subscription. |

## M07 — Payroll (5 entities)
| # | Entity | Table | Kind | Purpose |
|---|---|---|---|---|
| 48 | PayrollRule | `payroll_rules` | 🟢 | A configurable payroll rule (fixed/%/hybrid). |
| 49 | PayrollRun | `payroll_runs` | 🟢 | One execution over a period/project. |
| 50 | PayrollDistribution | `payroll_distributions` | 🔵 | Computed payout line per contributor. |
| 51 | PayrollHistory | `payroll_history` | 🟤 | Posted payout record per (run,user). |
| 52 | PayrollAdjustment | `payroll_adjustments` | 🔵 | Bonus/deduction overlay on a payout. |

## M08 — Asset & Maintenance (5 entities)
| # | Entity | Table | Kind | Purpose |
|---|---|---|---|---|
| 53 | Asset | `assets` | 🟢 | A trackable item (hardware/license/domain). |
| 54 | AssetAssignment | `asset_assignments` | 🟣 | Asset → project/client assignment. |
| 55 | MaintenanceTicket | `maintenance_tickets` | 🟢 | A unit of maintenance work. |
| 56 | SlaPolicy | `sla_policies` | ⚪ | SLA targets per ticket type. |
| 57 | AssetCategory | `asset_categories` | ⚪ | Classification of asset. |

## M09 — Notification (5 entities)
| # | Entity | Table | Kind | Purpose |
|---|---|---|---|---|
| 58 | NotificationTemplate | `notification_templates` | 🟢 | Templated message per channel. |
| 59 | Notification | `notifications` | 🟢 | A queued/sent message instance. |
| 60 | NotificationLog | `notification_logs` | 🟤 | Per-attempt delivery record. |
| 61 | NotificationPreference | `notification_preferences` | 🔵 | Per-user channel opt-in. |
| 62 | NotificationChannel | `notification_channels` | ⚪ | Provider config per channel (WhatsApp creds, etc.). |

## M10 — Knowledge Base (4 entities)
| # | Entity | Table | Kind | Purpose |
|---|---|---|---|---|
| 63 | Article | `articles` | 🟢 | A knowledge article (versioned). |
| 64 | ArticleRevision | `article_revisions` | 🟤 | Version history of an article. |
| 65 | ArticleCategory | `article_categories` | ⚪ | Article grouping. |
| 66 | ArticleTag | `article_tags` | 🟣 | Tag on article (reuses Tag). |

## M11 — Audit & Activity (2 entities)
| # | Entity | Table | Kind | Purpose |
|---|---|---|---|---|
| 67 | AuditLog | `audit_logs` | 🟤 | Immutable technical change trail. |
| 68 | ActivityTimelineEntry | `activity_timeline` | 🟤 | Human-readable business event feed. |

## M12 — Platform / System (8 entities)
| # | Entity | Table | Kind | Purpose |
|---|---|---|---|---|
| 69 | Tag | `tags` | 🟢 | Label (polymorphic attach). |
| 70 | Taggable | `taggables` | 🟣 | Polymorphic tag attach. |
| 71 | Attachment | `attachments` | 🟢 | File attached to anything (polymorphic). |
| 72 | Comment | `comments` | 🔵 | Threadable comment (polymorphic). |
| 73 | Reminder | `reminders` | 🔵 | Time-based reminder (polymorphic subject). |
| 74 | Setting | `settings` | ⚪ | Typed key/value config. |
| 75 | NumberSequence | `number_sequences` | ⚪ | Document number generator (INV-, PRJ-, …). |
| 76 | EnumValue | `enum_values` | ⚪ | Config-driven status/category catalog. |

---

## Cross-cutting conventions applied to ALL entities

Unless stated otherwise in Phase 4, every table has:

| Field | Type | Notes |
|---|---|---|
| `id` | `BIGINT UNSIGNED` PK, auto-increment | Surrogate key. API exposes prefixed string. |
| `created_at` | `TIMESTAMP` default `CURRENT_TIMESTAMP` | UTC. |
| `updated_at` | `TIMESTAMP` ON UPDATE `CURRENT_TIMESTAMP` | UTC. |
| `created_by` | `BIGINT UNSIGNED NULL` → `users.id` | Actor that created. |
| `updated_by` | `BIGINT UNSIGNED NULL` → `users.id` | Actor that last updated. |
| `deleted_at` | `TIMESTAMP NULL` | Soft delete (omitted on append-only & pure join tables). |

Foreign keys: real, indexed, `ON DELETE RESTRICT` by default (business data is never cascade-deleted; we soft-delete). `ON DELETE CASCADE` only on pure child-of relationships where the parent owns the child entirely (e.g. `invoice_items`).

> Total: **76 entities / 60 tables**. (Some "entities" above are value objects realized as columns, not tables; the table count is the authoritative DB surface.)
