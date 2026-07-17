# Phase 9 — REST API Design

> Resource-oriented REST over JSON. One conventions section, then per-module endpoints.

---

## 9.0 Global conventions

### Base URL & versioning
- Base: `/api/v1`.
- Versioning via URL path (semver major). Breaking change → `/api/v2`.

### Naming
- Resource names: **plural, kebab-case** nouns. `/api/v1/invoices`, `/api/v1/maintenance-tickets`.
- Nested routes express ownership and nothing else: `/clients/{id}/projects`. Max depth 2.
- IDs: prefixed string in URLs (`/invoices/inv_123`), mapped to internal `bigint`.

### Standard methods & semantics
| Method | Meaning | Idempotent | Body |
|---|---|---|---|
| GET | read (list or single) | yes | none |
| POST | create / perform action | no | JSON |
| PATCH | partial update | no | JSON |
| PUT | replace (rare; full update) | yes | JSON |
| DELETE | soft delete | yes (repeated = no-op) | none |

### Status codes
- `200 OK` (GET/PATCH/PUT success + action endpoints)
- `201 Created` (POST create)
- `204 No Content` (DELETE / action with no body)
- `400 Bad Request` (validation)
- `401 Unauthorized` (no/invalid token)
- `403 Forbidden` (authenticated but lacking permission)
- `404 Not Found`
- `409 Conflict` (duplicate, invalid state transition, optimistic-lock conflict)
- `422 Unprocessable Entity` (business rule violation)
- `429 Too Many Requests` (rate limit)

### Envelope (consistent response shape)
```jsonc
// success, single
{ "data": { ... }, "meta": { "requestId": "..." } }
// success, list (paginated)
{ "data": [ ... ], "meta": { "requestId":"...", "page":1, "pageSize":25, "total":130, "totalPages":6 } }
// error
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [ { "field":"email","issue":"invalid" } ] } }
```

### List query params (uniform)
- `page`, `pageSize` (default 25, max 100)
- `sort=field` / `sort=-field` (desc)
- `q=` full-text where supported
- Filters: `?status=paid&clientId=cli_5&issueDateFrom=2026-01-01`
- Sparse fieldset: `?fields=id,invoiceNo,grandTotal` (optional)
- `include=items,client` (compound documents; opt-in)

### Auth & permissions
- Bearer token in `Authorization` header (JWT access token; short-lived).
- Every endpoint documents the required **permission key** (Phase 10). Enforced by middleware.
- Founder/Super Admin bypasses all permission checks.

### Soft delete
- `DELETE` soft-deletes (sets `deletedAt`). Response `204`.
- `GET` lists exclude soft-deleted unless `?includeDeleted=true` (admin-only).
- Restore: `POST /resource/{id}/restore` (admin-only).

### Audit
- Every mutating request writes an `audit_logs` row automatically (actor, action, entity, before/after, ip, userAgent).
- Significant business events also write `activity_timeline`.

### Idempotency
- POST endpoints that create money/payment/payroll accept `Idempotency-Key` header → stored in `external_ref`/`idempotency_key`; duplicate key returns the original result.

### Concurrency
- Optimistic locking via `If-Match: <updatedAt>` header on PATCH for high-contention resources (invoices, payroll runs). Mismatch → `409`.

### Validation
- Per-endpoint Zod schema; validation errors → `400` with field-level `details`.

---

# M01 — IAM

### Auth
| Method | Path | Purpose | Body | Permission |
|---|---|---|---|---|
| POST | `/auth/login` | Login | `{email,password}` | public |
| POST | `/auth/refresh` | Refresh token | `{refreshToken}` | public (valid RT) |
| POST | `/auth/logout` | Logout (revoke session) | — | authenticated |
| GET | `/auth/me` | Current user + resolved permissions | — | authenticated |
| POST | `/auth/password/forgot` | Request reset | `{email}` | public |
| POST | `/auth/password/reset` | Reset | `{token,password}` | public |
| PATCH | `/auth/me` | Update own profile (name, locale, tz, avatar) | partial | authenticated |

### Users
| Method | Path | Purpose | Body | Permission |
|---|---|---|---|---|
| GET | `/users` | List | query | `user.view` |
| POST | `/users` | Create/invite | `{email,fullName,roleIds[],...}` | `user.create` |
| GET | `/users/{id}` | Detail | — | `user.view` |
| PATCH | `/users/{id}` | Update | partial | `user.update` |
| DELETE | `/users/{id}` | Deactivate (soft) | — | `user.delete` |
| POST | `/users/{id}/restore` | Restore | — | `user.manage` |
| POST | `/users/{id}/activate` | Activate invited | — | `user.manage` |
| POST | `/users/{id}/suspend` | Suspend | `{reason?}` | `user.manage` |
| PATCH | `/users/{id}/roles` | Assign roles | `{roleIds[]}` | `user.permission_change` |
| GET | `/users/{id}/permissions` | Resolved permissions | — | `user.view` (self or `user.view`) |
| GET | `/users/{id}/sessions` | List sessions | — | `user.view` |
| DELETE | `/users/{id}/sessions` | Revoke all sessions | — | `user.manage` |

### Roles
| Method | Path | Purpose | Body | Permission |
|---|---|---|---|---|
| GET | `/roles` | List | — | `role.view` |
| POST | `/roles` | Create | `{key,name,permissionKeys[],priority}` | `role.create` |
| GET | `/roles/{id}` | Detail (with permissions) | — | `role.view` |
| PATCH | `/roles/{id}` | Update | partial | `role.update` |
| DELETE | `/roles/{id}` | Delete (if no users) | — | `role.delete` |
| PUT | `/roles/{id}/permissions` | Replace permissions | `{permissionKeys[]}` | `role.permission_change` |

### Permissions (catalog)
| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/permissions` | List all keys (grouped by module) | `permission.view` |

### API Keys
| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/api-keys` | List | `apikey.view` |
| POST | `/api-keys` | Create (returns secret once) | `apikey.create` |
| DELETE | `/api-keys/{id}` | Revoke | `apikey.delete` |

---

# M02 — CRM

### Leads
| Method | Path | Purpose | Body | Permission |
|---|---|---|---|---|
| GET | `/leads` | List (filter stage/owner/source) | — | `lead.view` |
| POST | `/leads` | Create | `{title,clientName,email\|phone,stageId,sourceId,estimatedValue,...}` | `lead.create` |
| GET | `/leads/{id}` | Detail | — | `lead.view` |
| PATCH | `/leads/{id}` | Update | partial | `lead.update` |
| DELETE | `/leads/{id}` | Soft delete | — | `lead.delete` |
| POST | `/leads/{id}/convert` | Convert → client | `{clientFields}` | `lead.manage` |
| POST | `/leads/{id}/stage` | Transition stage | `{stageId}` | `lead.update` |
| POST | `/leads/{id}/lost` | Mark lost | `{reason}` | `lead.update` |
| POST | `/leads/{id}/assign` | Reassign | `{ownerId}` | `lead.update` |
| GET | `/leads/{id}/activity` | Activity feed | — | `lead.view` |
| GET | `/leads/pipeline` | Pipeline board (grouped by stage) | — | `lead.view` |

### Lead Stages / Sources (catalog)
| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET / POST / PATCH / DELETE | `/lead-stages` | Manage pipeline | `setting.manage` |
| GET / POST / PATCH / DELETE | `/lead-sources` | Manage sources | `setting.manage` |

### Clients
| Method | Path | Purpose | Body | Permission |
|---|---|---|---|---|
| GET | `/clients` | List | — | `client.view` |
| POST | `/clients` | Create | `{name,type,...}` | `client.create` |
| GET | `/clients/{id}` | Detail (with summary: projects/invoices/balance) | — | `client.view` |
| PATCH | `/clients/{id}` | Update | partial | `client.update` |
| DELETE | `/clients/{id}` | Soft delete (blocked if has projects/invoices) | — | `client.delete` |
| POST | `/clients/{id}/merge` | Merge into another | `{targetClientId}` | `client.manage` |
| POST | `/clients/{id}/blacklist` | Blacklist | `{reason}` | `client.manage` |
| GET | `/clients/{id}/contacts` | Contacts | — | `client.view` |
| POST | `/clients/{id}/contacts` | Add contact | `{firstName,email,...}` | `client.update` |
| GET | `/clients/{id}/projects` | Projects | — | `project.view` |
| GET | `/clients/{id}/invoices` | Invoices | — | `invoice.view` |
| GET | `/clients/{id}/statement` | Account statement (AR) | `?from&to` | `invoice.view` |

### Contacts
| Method | Path | Purpose | Permission |
|---|---|---|---|
| PATCH / DELETE | `/contacts/{id}` | Update/delete | `client.update` / `client.delete` |

---

# M03 — Sales

### Pricelist
| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/pricelist` | List active | `pricelist.view` |
| POST | `/pricelist` | Create item | `pricelist.create` |
| GET/PATCH/DELETE | `/pricelist/{id}` | CRUD | view/update/delete |
| POST | `/pricelist/{id}/archive` | Archive | `pricelist.update` |

### Quotations
| Method | Path | Purpose | Body | Permission |
|---|---|---|---|---|
| GET | `/quotations` | List | — | `quotation.view` |
| POST | `/quotations` | Create (with items) | `{clientId,issueDate,validUntil,items[]}` | `quotation.create` |
| GET | `/quotations/{id}` | Detail (with items, totals) | — | `quotation.view` |
| PATCH | `/quotations/{id}` | Update (draft only) | partial | `quotation.update` |
| DELETE | `/quotations/{id}` | Soft delete (draft only) | — | `quotation.delete` |
| POST | `/quotations/{id}/items` | Add item | `{...}` | `quotation.update` |
| PATCH/DELETE | `/quotations/{id}/items/{itemId}` | Item CRUD | | `quotation.update` |
| POST | `/quotations/{id}/send` | Mark sent (optionally email client) | `{channel?}` | `quotation.update` |
| POST | `/quotations/{id}/accept` | Accept → enables convert | `{}` | `quotation.approve` |
| POST | `/quotations/{id}/reject` | Reject | `{reason}` | `quotation.update` |
| POST | `/quotations/{id}/convert` | Convert → contract + (optionally) project | `{createProject?,createContract?}` | `quotation.manage` |
| POST | `/quotations/{id}/duplicate` | Copy to new draft | — | `quotation.create` |
| GET | `/quotations/{id}/pdf` | Download PDF | — | `quotation.view` |

### Proposals
| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET / POST | `/proposals` | List/create | `proposal.view` / `proposal.create` |
| GET / PATCH / DELETE | `/proposals/{id}` | CRUD | view/update/delete |
| POST | `/proposals/{id}/submit` | Submit to client | `proposal.update` |
| POST | `/proposals/{id}/accept` | Mark accepted | `proposal.approve` |
| POST | `/proposals/{id}/version` | New version | `proposal.create` |

### Contracts
| Method | Path | Purpose | Body | Permission |
|---|---|---|---|---|
| GET | `/contracts` | List | — | `contract.view` |
| POST | `/contracts` | Create | `{clientId,projectId?,quotationId?,totalValue,startDate,...}` | `contract.create` |
| GET | `/contracts/{id}` | Detail | — | `contract.view` |
| PATCH | `/contracts/{id}` | Update (draft only) | partial | `contract.update` |
| DELETE | `/contracts/{id}` | Soft delete (draft only) | — | `contract.delete` |
| POST | `/contracts/{id}/sign` | Mark signed | `{signedAt,signedByClient}` | `contract.approve` |
| POST | `/contracts/{id}/terminate` | Terminate | `{reason,effectiveDate}` | `contract.manage` |
| POST | `/contracts/{id}/documents` | Upload signed doc | `{file}` | `contract.update` |
| GET | `/contracts/{id}/pdf` | PDF | — | `contract.view` |

---

# M04 — Delivery

### Projects
| Method | Path | Purpose | Body | Permission |
|---|---|---|---|---|
| GET | `/projects` | List (filter client/status/manager) | — | `project.view` |
| POST | `/projects` | Create (optionally from template) | `{clientId,contractId?,name,templateId?}` | `project.create` |
| GET | `/projects/{id}` | Detail (members, progress, milestones) | — | `project.view` |
| PATCH | `/projects/{id}` | Update | partial | `project.update` |
| DELETE | `/projects/{id}` | Soft delete | — | `project.delete` |
| POST | `/projects/{id}/start` | Start (planning→active) | — | `project.manage` |
| POST | `/projects/{id}/hold` | On hold | `{reason}` | `project.manage` |
| POST | `/projects/{id}/complete` | Complete (checks milestones) | — | `project.approve` |
| POST | `/projects/{id}/cancel` | Cancel | `{reason}` | `project.manage` |
| GET/POST/DELETE | `/projects/{id}/members` | Team mgmt | `{userId,roleInProject}` | `project.update` |
| GET | `/projects/{id}/timeline` | Project activity | — | `project.view` |
| GET | `/projects/{id}/board` | Tasks grouped by status | — | `task.view` |
| GET | `/projects/{id}/metrics` | Progress, hours, budget burn | — | `project.view` |

### Tasks
| Method | Path | Purpose | Body | Permission |
|---|---|---|---|---|
| GET | `/tasks` | List (filter project/status/assignee) | — | `task.view` |
| POST | `/tasks` | Create | `{projectId,title,...}` | `task.create` |
| GET | `/tasks/{id}` | Detail | — | `task.view` |
| PATCH | `/tasks/{id}` | Update | partial | `task.update` |
| DELETE | `/tasks/{id}` | Soft delete | — | `task.delete` |
| POST | `/tasks/{id}/assign` | Assign user(s) | `{userIds[],isPrimary?}` | `task.update` |
| POST | `/tasks/{id}/transition` | Status change (enforces allowed) | `{status}` | `task.update` |
| POST | `/tasks/{id}/log-time` | (future) log hours | `{hours}` | `task.update` |
| GET/POST | `/tasks/{id}/checklists` | Checklists | `{title,items[]}` | `task.update` |
| POST | `/tasks/{id}/checklists/{cid}/items` | Add item | `{content}` | `task.update` |
| PATCH | `/tasks/{id}/checklists/{cid}/items/{itemId}` | Toggle/update | `{isChecked?}` | `task.update` |

### Milestones
| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET / POST | `/projects/{id}/milestones` | List/create | `project.view` / `project.update` |
| PATCH / DELETE | `/milestones/{id}` | Update/delete | `project.update` / `project.delete` |
| POST | `/milestones/{id}/reach` | Mark reached | `project.approve` |

### Project Templates
| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET / POST / PATCH / DELETE | `/project-templates` | Manage | `setting.manage` |

---

# M05 — Finance

### Invoices
| Method | Path | Purpose | Body | Permission |
|---|---|---|---|---|
| GET | `/invoices` | List (rich filters) | — | `invoice.view` |
| POST | `/invoices` | Create (items inline) | `{clientId,items[],issueDate,dueDate}` | `invoice.create` |
| GET | `/invoices/{id}` | Detail | — | `invoice.view` |
| PATCH | `/invoices/{id}` | Update (draft only) | partial | `invoice.update` |
| DELETE | `/invoices/{id}` | Soft delete (draft only) | — | `invoice.delete` |
| POST | `/invoices/{id}/items` | Add item | | `invoice.update` |
| PATCH/DELETE | `/invoices/{id}/items/{itemId}` | Item CRUD | | `invoice.update` |
| POST | `/invoices/{id}/issue` | Draft → issued (locks financials) | — | `invoice.approve` |
| POST | `/invoices/{id}/send` | Send to client | `{channel}` | `invoice.update` |
| POST | `/invoices/{id}/void` | Void (reverses allocations) | `{reason}` | `invoice.manage` |
| GET | `/invoices/{id}/pdf` | PDF | — | `invoice.view` |
| GET | `/invoices/aging` | AR aging report | `?asOf` | `invoice.view` |

### Receipts
| Method | Path | Purpose | Body | Permission |
|---|---|---|---|---|
| GET | `/receipts` | List | — | `receipt.view` |
| POST | `/receipts` | Record payment (idempotent) | `{clientId,amount,paymentDate,method,externalRef?,allocations?}` | `receipt.create` |
| GET | `/receipts/{id}` | Detail | — | `receipt.view` |
| PATCH | `/receipts/{id}` | Update (pre-allocate) | partial | `receipt.update` |
| DELETE | `/receipts/{id}` | Void | `{reason}` | `receipt.delete` |
| POST | `/receipts/{id}/allocate` | Allocate to invoice(s) | `{allocations:[{invoiceId,amount}]}` | `receipt.update` |
| POST | `/receipts/{id}/unallocate` | Reverse an allocation | `{allocationId}` | `receipt.update` |

### Down Payments (DP)
| Method | Path | Purpose | Body | Permission |
|---|---|---|---|---|
| GET | `/down-payments` | List | — | `invoice.view` |
| POST | `/down-payments` | Collect DP | `{clientId,amount,mode,projectId?}` | `invoice.create` |
| GET | `/down-payments/{id}` | Detail | — | `invoice.view` |
| POST | `/down-payments/{id}/allocate` | Allocate to invoice | `{invoiceId,amount}` | `invoice.update` |
| POST | `/down-payments/{id}/refund` | Refund | `{amount,reason}` | `invoice.manage` |

### Expenses
| Method | Path | Purpose | Body | Permission |
|---|---|---|---|---|
| GET | `/expenses` | List | — | `expense.view` |
| POST | `/expenses` | Create | `{categoryId,amount,paymentDate,projectId?}` | `expense.create` |
| GET/PATCH/DELETE | `/expenses/{id}` | CRUD | | update/delete |
| POST | `/expenses/{id}/approve` | Approve | — | `expense.approve` |
| POST | `/expenses/{id}/pay` | Mark paid | — | `expense.update` |
| POST | `/expenses/{id}/void` | Void | `{reason}` | `expense.delete` |

### Incomes (analogous to expenses)
| Method | Path | Permission |
|---|---|---|
| GET/POST/GET/PATCH/DELETE | `/incomes`, `/incomes/{id}` | `income.view/create/update/delete` |

### Catalogs
| Method | Path | Permission |
|---|---|---|
| GET/POST/PATCH/DELETE | `/expense-categories`, `/income-categories`, `/tax-rates` | `setting.manage` |

### Reports
| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/reports/cashflow` | Cashflow (uses snapshots) | `invoice.view` |
| GET | `/reports/profit` | P&L | `invoice.view` |
| GET | `/reports/ar-aging` | Receivables aging | `invoice.view` |
| GET | `/reports/revenue-by-project` | Revenue attribution | `invoice.view` |

---

# M06 — Subscription / Billing

### Plans
| Method | Path | Permission |
|---|---|---|
| GET/POST/PATCH/DELETE | `/plans`, `/plans/{id}` | `plan.view/create/update/delete` |

### Subscriptions
| Method | Path | Purpose | Body | Permission |
|---|---|---|---|---|
| GET | `/subscriptions` | List | — | `subscription.view` |
| POST | `/subscriptions` | Subscribe | `{clientId,planId,startDate}` | `subscription.create` |
| GET | `/subscriptions/{id}` | Detail (cycles) | — | `subscription.view` |
| PATCH | `/subscriptions/{id}` | Update (plan, autoRenew) | partial | `subscription.update` |
| POST | `/subscriptions/{id}/suspend` | Suspend | `{reason}` | `subscription.manage` |
| POST | `/subscriptions/{id}/reactivate` | Reactivate | — | `subscription.manage` |
| POST | `/subscriptions/{id}/cancel` | Cancel | `{reason,effectiveImmediately?}` | `subscription.delete` |
| GET | `/subscriptions/{id}/cycles` | Billing cycles | — | `subscription.view` |

### MCO Contracts
| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET/POST | `/mco-contracts` | List/create | `mco.view` / `mco.create` |
| GET/PATCH | `/mco-contracts/{id}` | Detail/update | view/update |
| POST | `/mco-contracts/{id}/sign` | Sign | `mco.approve` |
| POST | `/mco-contracts/{id}/renew` | Renew (new period) | `mco.manage` |
| POST | `/mco-contracts/{id}/terminate` | Terminate | `mco.delete` |

### Billing Cycles
| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/billing-cycles` | List (filter status, due) | `subscription.view` |
| POST | `/billing-cycles/{id}/invoice` | Generate invoice for cycle | `invoice.create` |

---

# M07 — Payroll

### Payroll Rules
| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/payroll/rules` | List (filter type/scope) | `payroll.view` |
| POST | `/payroll/rules` | Create rule | `payroll.manage` |
| GET/PATCH/DELETE | `/payroll/rules/{id}` | CRUD | view/manage/manage |
| POST | `/payroll/rules/{id}/archive` | Archive | `payroll.manage` |

### Payroll Runs
| Method | Path | Purpose | Body | Permission |
|---|---|---|---|---|
| GET | `/payroll/runs` | List | — | `payroll.view` |
| POST | `/payroll/runs` | Create run | `{type:'internal'\|'project',periodStart,periodEnd,projectId?}` | `payroll.create` |
| GET | `/payroll/runs/{id}` | Detail (distributions) | — | `payroll.view` |
| POST | `/payroll/runs/{id}/compute` | Compute distributions | — | `payroll.manage` |
| POST | `/payroll/runs/{id}/adjustments` | Add bonus/deduction | `{userId,kind,amount,reason}` | `payroll.update` |
| POST | `/payroll/runs/{id}/approve` | Approve | — | `payroll.approve` |
| POST | `/payroll/runs/{id}/post` | Post → payroll_history + finance expense | — | `payroll.approve` |
| POST | `/payroll/runs/{id}/reverse` | Reverse posted run | `{reason}` | `payroll.delete` |
| GET | `/payroll/runs/{id}/breakdown` | Per-user computation trace | — | `payroll.view` |

### Payroll History
| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/payroll/history` | List (filter user/type/period) | `payroll.view` |
| GET | `/payroll/history/{id}` | Payslip detail | `payroll.view` |
| GET | `/payroll/history/{id}/payslip.pdf` | PDF | `payroll.view` |

---

# M08 — Asset & Maintenance

### Assets
| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/assets` | List | `asset.view` |
| POST | `/assets` | Create | `asset.create` |
| GET/PATCH/DELETE | `/assets/{id}` | CRUD | view/update/delete |
| POST | `/assets/{id}/assign` | Assign | `{assignableType,assignableId}` | `asset.update` |
| POST | `/assets/{id}/return` | Return | — | `asset.update` |
| POST | `/assets/{id}/retire` | Retire | — | `asset.update` |

### Maintenance Tickets
| Method | Path | Purpose | Body | Permission |
|---|---|---|---|---|
| GET | `/maintenance-tickets` | List | — | `maintenance.view` |
| POST | `/maintenance-tickets` | Create | `{clientId,title,mcoContractId?,assetId?}` | `maintenance.create` |
| GET | `/maintenance-tickets/{id}` | Detail | — | `maintenance.view` |
| PATCH | `/maintenance-tickets/{id}` | Update | partial | `maintenance.update` |
| POST | `/maintenance-tickets/{id}/assign` | Assign | `{assigneeId}` | `maintenance.update` |
| POST | `/maintenance-tickets/{id}/transition` | Status change (SLA-aware) | `{status}` | `maintenance.update` |
| POST | `/maintenance-tickets/{id}/resolve` | Resolve | `{resolution}` | `maintenance.update` |
| POST | `/maintenance-tickets/{id}/close` | Close | — | `maintenance.approve` |
| GET | `/maintenance-tickets/breaching` | SLA breaches | — | `maintenance.view` |

### Catalogs
| Method | Path | Permission |
|---|---|---|
| GET/POST/PATCH/DELETE | `/asset-categories`, `/sla-policies` | `setting.manage` |

---

# M09 — Notification

> Most notifications are created by the system from domain events. The API is mostly admin/observability.

| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/notifications` | List (recipient or all for admin) | `notification.view` (self) |
| POST | `/notifications/send` | Manual send (admin) | `notification.create` |
| PATCH | `/notifications/{id}/read` | Mark read | self |
| GET | `/notifications/templates` | List templates | `notification.view` |
| POST/PATCH | `/notifications/templates` | Manage templates | `notification.manage` |
| GET/PATCH | `/notification-preferences` | Self preferences | self |
| GET | `/notifications/{id}/logs` | Delivery attempts | `notification.view` |
| GET/POST/PATCH | `/notification-channels` | Provider config | `setting.manage` |

---

# M10 — Knowledge Base

| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/articles` | List/search (`?q=` FULLTEXT) | `article.view` (respect visibility) |
| POST | `/articles` | Create | `article.create` |
| GET | `/articles/{id}` | Detail (current revision) | `article.view` |
| PATCH | `/articles/{id}` | Update (creates new revision) | `article.update` |
| DELETE | `/articles/{id}` | Soft delete | `article.delete` |
| POST | `/articles/{id}/publish` | Publish | `article.approve` |
| GET | `/articles/{id}/revisions` | Version history | `article.view` |
| POST | `/articles/{id}/revisions/{revId}/restore` | Restore old version | `article.update` |
| GET/POST/PATCH/DELETE | `/article-categories` | Manage | `setting.manage` |

---

# M11 — Audit & Activity

| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/audit-logs` | Query (filter actor/entity/action/time) | `audit.view` |
| GET | `/audit-logs/export` | Export CSV/JSON | `audit.export` |
| GET | `/activity` | Global feed | `activity.view` |
| GET | `/projects/{id}/activity` | Project feed | `project.view` |
| GET | `/clients/{id}/activity` | Client feed | `client.view` |

---

# M12 — Platform / System

### Tags
| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET/POST | `/tags` | List/create | `tag.view` / `tag.create` |
| PATCH/DELETE | `/tags/{id}` | Update/delete | `tag.update`/`tag.delete` |
| POST | `/tags/{id}/attach` | Attach to entity | `{entityType,entityId}` | depends on entity |
| POST | `/tags/{id}/detach` | Detach | same | depends on entity |

### Attachments (polymorphic)
| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/attachments` | List by `?entityType=&entityId=` | entity-dependent |
| POST | `/attachments` | Upload (multipart) `{entityType,entityId,file}` | entity-dependent |
| GET / DELETE | `/attachments/{id}` | Download / delete | entity-dependent |

### Comments (polymorphic)
| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/comments` | List by `?entityType=&entityId=` | entity-dependent |
| POST | `/comments` | Create | entity-dependent |
| PATCH/DELETE | `/comments/{id}` | Update/delete | entity-dependent |

### Reminders
| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/reminders` | List (mine / all) | `reminder.view` |
| POST | `/reminders` | Create | `reminder.create` |
| PATCH | `/reminders/{id}` | Update/snooze | `reminder.update` |
| POST | `/reminders/{id}/dismiss` | Dismiss | `reminder.update` |

### Settings (admin)
| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/settings` | List (public ones to all; all to admin) | `setting.view` |
| PATCH | `/settings/{key}` | Update | `setting.manage` |
| GET | `/number-sequences` | List | `setting.view` |
| PATCH | `/number-sequences/{id}` | Adjust (rare) | `setting.manage` |
| GET | `/enum-values` | List by group | `setting.view` |
| POST/PATCH/DELETE | `/enum-values` | Manage | `setting.manage` |

---

## 9.X Cross-cutting endpoint behaviors

- **`POST .../export`** on list endpoints → returns a signed download URL or streams CSV; permission `<entity>.export`.
- **Bulk operations**: where needed, `POST /invoices/bulk` with `{ids[],action}` (e.g., bulk send); permission per action.
- **Webhooks (future)**: `POST /webhooks` (outbound subscription) — out of v1 scope; events are internal.
- **Search**: `GET /search?q=&type=` global lightweight search across clients/projects/invoices/tasks/articles (permission-filtered).
