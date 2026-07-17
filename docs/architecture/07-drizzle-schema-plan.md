# Phase 7 — Drizzle Schema Plan

> **No implementation code.** This is the **plan** the implementation AI will turn into Drizzle TypeScript.
> For every table: **table name**, **columns** (name + Drizzle type mapping), **relations**, **indexes**, **constraints**.
>
> Conventions for the implementation:
> - One file per module under `src/db/schema/<module>.ts`, re-exported from `src/db/schema/index.ts`.
> - Use `mysqlTable` (Drizzle MySQL core).
> - Use `bigint('id', { mode: 'bigint', unsigned: true }).autoincrement().primaryKey()` everywhere.
> - Use `decimal('x', { precision: 18, scale: 2 })` for money; `decimal('x', { precision: 8, scale: 5 })` for percentages.
> - Use `varchar('status', { length: 32 })` + app enum (not Drizzle's `mysqlEnum` native DDL) — see Phase 6 §6.3 reasoning.
> - All timestamps `timestamp('x', { mode: 'date', fsp: 0 }).defaultNow()` / `.onUpdateNow()`; stored UTC.
> - Define `relations()` separately for query-builder joins; FKs are defined inline with `references()`.
> - Shared column helpers: define once — `id()`, `auditColumns()`, `softDelete()`, `moneyCol(name)`, `currencyCol()` — to keep consistency.

---

## 7.0 Shared column helpers (define in `src/db/schema/_helpers.ts`)

| Helper | Produces | Notes |
|---|---|---|
| `id()` | `bigint('id', unsigned).autoincrement().primaryKey()` | standard PK |
| `auditColumns()` | `createdAt`, `updatedAt`, `createdBy`, `updatedBy` | the 4 audit columns |
| `softDelete()` | `deletedAt timestamp nullable` | appended on business tables |
| `money(name)` | `decimal(name, { precision: 18, scale: 2 }).notNull()` | paired with `currency(name)` |
| `currency(name='currency')` | `char(name, { length: 3 }).notNull().default('USD')` | ISO-4217 |
| `percent(name)` | `decimal(name, { precision: 8, scale: 5 })` | revenue-share / rule percentages |
| `statusCol()` | `varchar('status', { length: 32 })` | app-validated against enum |

> Multi-tenant readiness: each helper optionally accepts `tenantId` later; today it's a no-op. No refactor needed when `tenant_id` arrives.

---

## 7.1 IAM tables

### `users`
- **Columns:** `id` (PK); `email varchar(255) notNull`; `emailVerifiedAt timestamp null`; `passwordHash varchar(255) notNull`; `passwordAlgo varchar(32) default('argon2id')`; `fullName varchar(150) notNull`; `displayName varchar(150) null`; `avatarUrl varchar(500) null`; `phone varchar(32) null`; `locale varchar(8) default('en')`; `timezone varchar(64) default('UTC')`; `status varchar(32) default('invited')`; `lastLoginAt timestamp null`; `lastLoginIp varchar(45) null`; `failedLoginCount int unsigned default(0)`; `lockedUntil timestamp null`; `isFounder boolean default(false)`; + audit + softDelete.
- **Relations:** `userRoles` (one-to-many), `sessions`, `refreshTokens`, `apiKeys`, `passwordResetTokens`, `ownedLeads/Clients/Projects…` (reverse).
- **Indexes:** unique `email`; `idx_users_status(status)`; `idx_users_deleted_at(deletedAt)`.
- **Constraints:** CHECK `failedLoginCount >= 0`.

### `roles`
- **Columns:** `id`; `key varchar(64) notNull`; `name varchar(120) notNull`; `description text null`; `isSystem boolean default(false)`; `priority int default(0)`; + audit + softDelete.
- **Relations:** `rolePermissions`, `userRoles`.
- **Indexes:** unique `key`; `idx_roles_deleted_at`.
- **Constraints:** none extra.

### `permissions`
- **Columns:** `id`; `key varchar(96) notNull`; `module varchar(32) notNull`; `action varchar(32) notNull`; `description varchar(255) null`; `isSystem boolean default(true)`.
- **Relations:** `rolePermissions`.
- **Indexes:** unique `key`; `idx_permissions_module(module)`.

### `role_permissions`
- **Columns:** `id`; `roleId → roles.id onDelete('cascade')`; `permissionId → permissions.id onDelete('cascade')`.
- **Indexes:** unique `(roleId, permissionId)`; `idx_rp_role(roleId)`; `idx_rp_perm(permissionId)`.

### `user_roles`
- **Columns:** `id`; `userId → users.id onDelete('cascade')`; `roleId → roles.id`; `assignedAt timestamp defaultNow()`; `assignedBy → users.id null`; + audit.
- **Indexes:** unique `(userId, roleId)`; `idx_ur_user(userId)`; `idx_ur_role(roleId)`.

### `sessions`
- **Columns:** `id`; `userId → users.id cascade`; `tokenHash varchar(255) notNull`; `ip varchar(45) null`; `userAgent varchar(500) null`; `issuedAt timestamp defaultNow()`; `expiresAt timestamp notNull`; `revokedAt timestamp null`; `createdAt`.
- **Indexes:** unique `tokenHash`; `idx_sessions_user(userId, expiresAt)`; `idx_sessions_expires(expiresAt)`.

### `refresh_tokens`
- **Columns:** `id`; `userId → users.id`; `sessionId → sessions.id cascade`; `tokenHash varchar(255)`; `expiresAt timestamp`; `usedAt timestamp null`; `rotatedTo bigint unsigned null`; `createdAt`.
- **Indexes:** unique `tokenHash`; `idx_rt_user(userId)`; `idx_rt_session(sessionId)`.

### `api_keys`
- **Columns:** `id`; `name varchar(120)`; `keyPrefix varchar(16)`; `keyHash varchar(255)`; `scopes json`; `ownerId → users.id`; `lastUsedAt timestamp null`; `expiresAt timestamp null`; `revokedAt timestamp null`; + audit + softDelete.
- **Indexes:** unique `keyHash`; `idx_apikeys_prefix(keyPrefix)`.

### `password_reset_tokens`
- **Columns:** `id`; `userId → users.id cascade`; `tokenHash varchar(255)`; `expiresAt timestamp`; `usedAt timestamp null`; `createdAt`.
- **Indexes:** unique `tokenHash`; `idx_prt_user(userId)`.

---

## 7.2 CRM tables

### `leads`
- **Columns:** `id`; `referenceNo varchar(32)`; `title varchar(255)`; `clientName varchar(255)`; `company varchar(255) null`; `email varchar(255) null`; `phone varchar(32) null`; `sourceId → lead_sources.id null`; `stageId → lead_stages.id notNull`; `ownerId → users.id null`; `estimatedValue decimal(18,2) null`; `estimatedValueCurrency char(3) default('USD')`; `expectedCloseDate date null`; `description text null`; `convertedClientId → clients.id null`; `convertedAt timestamp null`; `lostReason varchar(255) null`; + audit + softDelete.
- **Relations:** `stage`, `source`, `owner`, `convertedClient`, `contacts`.
- **Indexes:** unique `referenceNo`; `idx_leads_stage(stageId, deletedAt)`; `idx_leads_owner(ownerId)`; `idx_leads_close(expectedCloseDate)`; `idx_leads_email(email)`.
- **Constraints:** CHECK `(email is not null or phone is not null)`.

### `lead_stages`
- **Columns:** `id`; `key varchar(32)`; `name varchar(120)`; `position int notNull`; `isWon boolean default(false)`; `isLost boolean default(false)`; `isDefault boolean default(false)`; + audit + softDelete.
- **Indexes:** unique `key`; `idx_leadstage_position(position)`.

### `lead_sources`
- **Columns:** `id`; `name varchar(120)`; `isActive boolean default(true)`; + audit + softDelete.
- **Indexes:** unique `name`.

### `clients`
- **Columns:** `id`; `referenceNo varchar(32)`; `name varchar(255)`; `type varchar(32) default('organization')`; `legalName varchar(255) null`; `taxId varchar(64) null`; `email varchar(255) null`; `phone varchar(32) null`; `website varchar(255) null`; `addressLine varchar(255) null`; `city/state/postalCode varchar`; `country char(2) default('US')`; `defaultCurrency char(3) default('USD')`; `status varchar(32) default('active')`; `notes text null`; `ownerId → users.id null`; + audit + softDelete.
- **Relations:** `contacts`, `invoices`, `projects`, `subscriptions`, `mcoContracts`, `assets`, `maintenanceTickets`.
- **Indexes:** unique `referenceNo`; `idx_clients_name(name)`; `idx_clients_status(status, deletedAt)`; `idx_clients_email(email)`; `idx_clients_owner(ownerId)`.

### `contacts`
- **Columns:** `id`; `clientId → clients.id null cascade`; `leadId → leads.id null cascade`; `firstName varchar(120)`; `lastName varchar(120) null`; `email varchar(255)`; `phone varchar(32) null`; `position varchar(120) null`; `isPrimary boolean default(false)`; + audit + softDelete.
- **Indexes:** `idx_contacts_client(clientId)`; `idx_contacts_lead(leadId)`; unique `(clientId, email)` nulls not distinct (via generated col or app-enforced).
- **Constraints:** CHECK `(clientId is not null) <> (leadId is not null)` (exactly one).

---

## 7.3 Sales tables

### `pricelist_items`
- **Columns:** `id`; `serviceKey varchar(64)`; `name varchar(255)`; `description text null`; `unit varchar(32) default('item')`; `unitPrice decimal(18,2)`; `currency char(3) default('USD')`; `isActive boolean default(true)`; `effectiveFrom date null`; `effectiveTo date null`; + audit + softDelete.
- **Indexes:** unique `serviceKey`; `idx_pli_active(isActive, deletedAt)`.

### `quotations`
- **Columns:** `id`; `quotationNo varchar(32)`; `clientId → clients.id notNull`; `projectId → projects.id null`; `leadId → leads.id null`; `title varchar(255)`; `subject varchar(255) null`; `issueDate date notNull`; `validUntil date notNull`; `currency char(3)`; `subtotal/discountTotal/taxTotal/grandTotal decimal(18,2) default(0)`; `status varchar(32) default('draft')`; `sentAt/acceptedAt/rejectedAt/expiredAt timestamp null`; `notes/terms text null`; `ownerId → users.id`; `convertedContractId → contracts.id null`; + audit + softDelete.
- **Relations:** `client`, `items`, `project`, `lead`, `convertedContract`, `proposal`.
- **Indexes:** unique `quotationNo`; `idx_quo_client(clientId, deletedAt)`; `idx_quo_status(status)`; `idx_quo_owner(ownerId)`; `idx_quo_issue(issueDate)`.
- **Constraints:** CHECK `validUntil >= issueDate`.

### `quotation_items`
- **Columns:** `id`; `quotationId → quotations.id cascade`; `pricelistItemId → pricelist_items.id null`; `description varchar(500)`; `unit varchar(32)`; `quantity decimal(12,3) default(1)`; `unitPrice decimal(18,2)`; `currency char(3)`; `discountType varchar(16) default('none')`; `discountValue decimal(18,2) default(0)`; `taxRateId → tax_rates.id null`; `lineTotal decimal(18,2)`; `position int default(0)`; `createdAt`; `updatedAt`.
- **Indexes:** `idx_qi_quotation(quotationId, position)`.

### `proposals`
- **Columns:** `id`; `proposalNo varchar(32)`; `clientId → clients.id`; `quotationId → quotations.id null`; `title varchar(255)`; `version int default(1)`; `summary text`; `body longtext`; `status varchar(32) default('draft')`; `submittedAt/acceptedAt timestamp null`; `ownerId → users.id`; + audit + softDelete.
- **Indexes:** unique `(proposalNo, version)`; `idx_prop_client(clientId)`; `idx_prop_status(status)`.

### `contracts`
- **Columns:** `id`; `contractNo varchar(32)`; `clientId → clients.id notNull`; `projectId → projects.id null`; `quotationId → quotations.id null`; `proposalId → proposals.id null`; `title varchar(255)`; `scope text`; `totalValue decimal(18,2)`; `currency char(3)`; `startDate date notNull`; `endDate date null`; `signedAt timestamp null`; `signedByClient varchar(255) null`; `status varchar(32) default('draft')`; `terms text null`; `ownerId → users.id`; + audit + softDelete.
- **Indexes:** unique `contractNo`; `idx_ctr_client(clientId)`; `idx_ctr_status(status)`; `idx_ctr_dates(startDate, endDate)`.
- **Constraints:** CHECK `signedAt is null or startDate >= date(signedAt)`.

### `contract_documents`
- **Columns:** `id`; `contractId → contracts.id cascade`; `kind varchar(32)`; `fileUrl varchar(500)`; `fileName varchar(255)`; `mime varchar(100)`; `sizeBytes bigint`; `uploadedBy → users.id`; `createdAt`.
- **Indexes:** `idx_cd_contract(contractId, kind)`.

### `discounts`
- **Columns:** `id`; `name varchar(120)`; `scope varchar(32)`; `type varchar(16)`; `value decimal(18,2)`; `currency char(3) null`; `startsAt/endsAt date null`; `isActive boolean default(true)`; + audit + softDelete.
- **Indexes:** unique `(name, scope)`; `idx_disc_scope_active(scope, isActive)`.

---

## 7.4 Delivery tables

### `projects`
- **Columns:** `id`; `projectNo varchar(32)`; `clientId → clients.id notNull`; `contractId → contracts.id null`; `quotationId → quotations.id null`; `name varchar(255)`; `description text null`; `status varchar(32) default('planning')`; `priority varchar(16) default('medium')`; `startDate/dueDate date null`; `completedAt timestamp null`; `budgetHours decimal(10,2) null`; `budgetAmount decimal(18,2) null`; `currency char(3) default('USD')`; `progress tinyint unsigned default(0)`; `managerId → users.id null`; `templateId → project_templates.id null`; + audit + softDelete.
- **Indexes:** unique `projectNo`; `idx_prj_client(clientId, deletedAt)`; `idx_prj_status(status)`; `idx_prj_manager(managerId)`; `idx_prj_due(dueDate)`; `idx_prj_contract(contractId)`.
- **Constraints:** CHECK `progress between 0 and 100`.

### `project_members`
- **Columns:** `id`; `projectId → projects.id cascade`; `userId → users.id`; `roleInProject varchar(32) default('member')`; `allocatedHours decimal(10,2) null`; `revenueSharePct decimal(6,3) null`; + audit.
- **Indexes:** unique `(projectId, userId)`; `idx_pm_user(userId)`.

### `tasks`
- **Columns:** `id`; `taskNo varchar(32)`; `projectId → projects.id notNull`; `milestoneId → milestones.id null`; `title varchar(255)`; `description text null`; `status varchar(32) default('todo')`; `priority varchar(16) default('medium')`; `type varchar(32) default('task')`; `estimateHours decimal(10,2) null`; `loggedHours decimal(10,2) default(0)`; `startDate/dueDate date null`; `completedAt timestamp null`; `position int default(0)`; `parentTaskId → tasks.id null`; + audit + softDelete.
- **Indexes:** unique `taskNo`; `idx_task_project(projectId, status)`; `idx_task_milestone(milestoneId)`; `idx_task_due(dueDate)`; `idx_task_parent(parentTaskId)`.

### `task_assignments`
- **Columns:** `id`; `taskId → tasks.id cascade`; `userId → users.id`; `isPrimary boolean default(false)`; `assignedAt timestamp defaultNow()`; `assignedBy → users.id null`.
- **Indexes:** unique `(taskId, userId)`; `idx_ta_user(userId)`.

### `milestones`
- **Columns:** `id`; `projectId → projects.id cascade`; `name varchar(255)`; `description text null`; `position int`; `dueDate date null`; `isReached boolean default(false)`; `reachedAt timestamp null`; `isOptional boolean default(false)`; + audit.
- **Indexes:** `idx_ms_project(projectId, position)`.

### `checklists`
- **Columns:** `id`; `subjectType varchar(50)`; `subjectId bigint unsigned`; `title varchar(255)`; `position int`; + audit + softDelete.
- **Indexes:** `idx_chk_subject(subjectType, subjectId)`.

### `checklist_items`
- **Columns:** `id`; `checklistId → checklists.id cascade`; `content varchar(500)`; `isChecked boolean default(false)`; `checkedBy → users.id null`; `checkedAt timestamp null`; `position int`; `createdAt`; `updatedAt`.
- **Indexes:** `idx_chki_checklist(checklistId, position)`.

### `project_templates`
- **Columns:** `id`; `name varchar(255)`; `description text null`; `defaultTaskBlueprint json`; `defaultMilestones json`; `isActive boolean default(true)`; + audit + softDelete.
- **Indexes:** unique `name`; `idx_pt_active(isActive)`.

---

## 7.5 Finance tables

### `invoices`
- **Columns:** (per Phase 4) `id`; `invoiceNo varchar(32)`; `clientId`; `projectId`; `contractId`; `subscriptionId`; `billingCycleId`; `subject varchar(255) null`; `issueDate`; `dueDate`; `currency`; `subtotal/discountTotal/taxTotal/grandTotal/paidAmount/balance decimal(18,2)`; `paymentStatus varchar(32) default('unpaid')`; `status varchar(32) default('draft')`; `sentAt/paidAt/voidedAt/overdueAt timestamp null`; `externalRef varchar(120) null`; `notes/terms text null`; `ownerId`; + audit + softDelete.
- **Relations:** `client`, `project`, `contract`, `subscription`, `billingCycle`, `items`, `receiptAllocations`, `dpAllocations`.
- **Indexes:** unique `invoiceNo`; unique `externalRef` (partial — nulls allowed); `idx_inv_client(clientId, deletedAt)`; `idx_inv_project(projectId)`; `idx_inv_status(status, dueDate)`; `idx_inv_payment(paymentStatus)`; `idx_inv_due(dueDate)`; `idx_inv_issue(issueDate)`.
- **Constraints:** CHECK `dueDate >= issueDate`; CHECK `grandTotal >= 0`; CHECK `paidAmount >= 0`.

### `invoice_items`
- **Columns:** `id`; `invoiceId → invoices.id cascade`; `pricelistItemId`; `description`; `quantity decimal(12,3)`; `unitPrice decimal(18,2)`; `currency`; `discountType`; `discountValue`; `taxRateId`; `lineTotal decimal(18,2)`; `position`; `createdAt`; `updatedAt`.
- **Indexes:** `idx_ii_invoice(invoiceId, position)`.

### `receipts`
- **Columns:** `id`; `receiptNo varchar(32)`; `clientId`; `amount decimal(18,2)`; `currency`; `paymentMethod varchar(32)`; `paymentDate date`; `receivedAt timestamp defaultNow()`; `reference varchar(180) null`; `externalRef varchar(120) null`; `status varchar(32) default('confirmed')`; `voidedAt timestamp null`; `voidReason varchar(255) null`; `allocatedAmount decimal(18,2) default(0)`; `unallocatedAmount decimal(18,2) default(0)`; `notes text null`; `ownerId`; + audit + softDelete.
- **Indexes:** unique `receiptNo`; unique `externalRef` (partial); `idx_rct_client(clientId, paymentDate)`; `idx_rct_status(status)`; `idx_rct_date(paymentDate)`.
- **Constraints:** CHECK `amount > 0`.

### `receipt_allocations`
- **Columns:** `id`; `receiptId → receipts.id cascade`; `invoiceId → invoices.id`; `amount decimal(18,2)`; `allocatedAt timestamp defaultNow()`; `allocatedBy`; `isReversed boolean default(false)`; `reversedAt timestamp null`; `createdAt`.
- **Indexes:** `idx_ra_receipt(receiptId)`; `idx_ra_invoice(invoiceId)`.
- **Constraints:** CHECK `amount > 0`.

### `down_payments`
- **Columns:** `id`; `dpNo varchar(32)`; `clientId`; `projectId`; `contractId`; `amount decimal(18,2)`; `currency`; `collectedAt timestamp defaultNow()`; `paymentMethod varchar(32)`; `mode varchar(16) notNull`; `allocatedAmount decimal(18,2) default(0)`; `balance decimal(18,2) default(0)`; `status varchar(32) default('collected')`; `refundedAmount decimal(18,2) default(0)`; `notes text null`; `ownerId`; + audit + softDelete.
- **Indexes:** unique `dpNo`; `idx_dp_client(clientId)`; `idx_dp_project(projectId)`; `idx_dp_status(status)`.

### `dp_allocations`
- **Columns:** `id`; `downPaymentId → down_payments.id cascade`; `invoiceId → invoices.id`; `amount decimal(18,2)`; `isReversed boolean default(false)`; `reversedAt timestamp null`; `allocatedAt`; `allocatedBy`; `createdAt`.
- **Indexes:** `idx_dpa_dp(downPaymentId)`; `idx_dpa_invoice(invoiceId)`.

### `expenses`, `expense_categories`, `incomes`, `income_categories`, `cashflow_snapshots`, `profit_snapshots`, `tax_rates`
- **Plan:** columns per Phase 4; indexes per Phase 6 §6.5. Indexes of note:
  - `expenses`: unique `expenseNo`; `idx_exp_category(categoryId, paymentDate)`; `idx_exp_date(paymentDate)`.
  - `incomes`: unique `incomeNo`; `idx_inc_category(categoryId, receivedDate)`.
  - `cashflow_snapshots`: unique `(periodStart, periodEnd, granularity, currency)`; `idx_cf_period`.
  - `profit_snapshots`: same shape.
  - `tax_rates`: unique `(name, country, region)`.

---

## 7.6 Subscription tables

### `plans`
- **Columns:** `id`; `planCode varchar(64)`; `name`; `description`; `interval varchar(16)`; `intervalDays int null`; `amount`; `currency`; `isActive`; `trialDays int default(0)`; + audit + softDelete.
- **Indexes:** unique `planCode`.

### `subscriptions`
- **Columns:** `id`; `subscriptionNo varchar(32)`; `clientId`; `planId`; `status varchar(32) default('active')`; `currentPeriodStart date`; `currentPeriodEnd date`; `startedAt timestamp`; `cancelledAt/suspendedAt timestamp null`; `autoRenew boolean default(true)`; `currency`; `amount`; `mcoContractId`; + audit + softDelete.
- **Indexes:** unique `subscriptionNo`; `idx_sub_client(clientId)`; `idx_sub_status(status)`; `idx_sub_period_end(currentPeriodEnd)`.

### `subscription_items`
- **Columns:** `id`; `subscriptionId → subscriptions.id cascade`; `name`; `quantity decimal(12,3) default(1)`; `unitPrice`; `currency`; `createdAt`; `updatedAt`.
- **Indexes:** `idx_si_sub(subscriptionId)`.

### `mco_contracts`
- **Columns:** `id`; `mcoNo varchar(32)`; `clientId`; `projectId`; `subscriptionId`; `name`; `scope text`; `monthlyHours decimal(10,2) null`; `monthlyFee`; `currency`; `startDate date`; `endDate date null`; `status varchar(32) default('draft')`; `signedAt timestamp null`; `renewalReminderSent boolean default(false)`; + audit + softDelete.
- **Indexes:** unique `mcoNo`; `idx_mco_client(clientId)`; `idx_mco_status(status)`; `idx_mco_end(endDate)`.

### `billing_cycles`
- **Columns:** `id`; `subscriptionId → subscriptions.id cascade`; `periodStart`; `periodEnd`; `amount`; `currency`; `invoiceId`; `status varchar(32) default('pending')`; `generatedAt/invoicedAt/paidAt timestamp`.
- **Indexes:** unique `(subscriptionId, periodStart, periodEnd)`; `idx_bc_sub(subscriptionId, periodEnd)`; `idx_bc_status(status)`.

---

## 7.7 Payroll tables

### `payroll_rules`
- **Columns:** `id`; `name`; `key varchar(64)`; `type varchar(16) notNull`; `formula varchar(16) notNull`; `fixedAmount decimal(18,2) null`; `percentage decimal(8,5) null`; `currency`; `scope varchar(16) notNull default('global')`; `scopeRefId bigint unsigned null`; `base varchar(32) notNull`; `priority int default(0)`; `minPayout/maxPayout decimal(18,2) null`; `effectiveFrom date`; `effectiveTo date null`; `isActive boolean default(true)`; + audit + softDelete.
- **Indexes:** unique `key`; `idx_pr_type_scope(type, scope, isActive)`; `idx_pr_active(isActive, effectiveFrom, effectiveTo)`; `idx_pr_priority(priority)`.
- **Constraints:** CHECK `(formula='fixed' and fixedAmount is not null) or (formula='percent' and percentage is not null) or formula='hybrid'`.

### `payroll_runs`
- **Columns:** `id`; `runNo varchar(32)`; `type varchar(16)`; `periodStart date`; `periodEnd date`; `projectId`; `status varchar(32) default('draft')`; `totalAmount`; `currency`; `computedAt/approvedAt/postedAt/reversedAt timestamp null`; `approvedBy`; `reversalOf → payroll_runs.id null`; `notes`; audit.
- **Indexes:** unique `runNo`; `idx_run_type(type, status)`; `idx_run_period(periodStart, periodEnd)`; `idx_run_project(projectId)`.

### `payroll_distributions`
- **Columns:** `id`; `runId → payroll_runs.id cascade`; `userId`; `projectId`; `baseAmount`; `ruleId`; `formula varchar(32)`; `computedAmount`; `adjustmentAmount default(0)`; `finalAmount`; `currency`; `breakdown json`; `createdAt`.
- **Indexes:** `idx_pd_run(runId)`; `idx_pd_user(userId)`; `idx_pd_project(projectId)`.

### `payroll_history`
- **Columns:** `id`; `runId`; `userId`; `amount`; `currency`; `type varchar(32)`; `periodLabel varchar(50)`; `postedAt timestamp`; `isReversed boolean default(false)`; `reversedByRunId`; `notes`; `createdAt`.
- **Indexes:** `idx_ph_user(userId, postedAt)`; `idx_ph_run(runId)`; `idx_ph_type(type)`.

### `payroll_adjustments`
- **Columns:** `id`; `runId → payroll_runs.id cascade`; `userId`; `kind varchar(32)`; `amount`; `reason`; `createdAt`.
- **Indexes:** `idx_pa_run_user(runId, userId)`.

---

## 7.8 Asset & Maintenance tables

### `assets`
- **Columns:** `id`; `assetTag varchar(64)`; `name`; `categoryId`; `serial varchar(120) null`; `type varchar(32)`; `purchaseDate date null`; `purchaseCost decimal(18,2) null`; `currency`; `status varchar(32) default('in_stock')`; `clientId`; `projectId`; `licenseExpiresAt date null`; `notes`; + audit + softDelete.
- **Indexes:** unique `assetTag`; `idx_asset_status(status)`; `idx_asset_category(categoryId)`; `idx_asset_client(clientId)`; `idx_asset_license_exp(licenseExpiresAt)`.

### `asset_assignments`
- **Columns:** `id`; `assetId → assets.id cascade`; `assignableType varchar(40)`; `assignableId bigint unsigned`; `assignedAt timestamp defaultNow()`; `returnedAt timestamp null`; `assignedBy`; `notes`.
- **Indexes:** `idx_aa_asset(assetId, returnedAt)`; `idx_aa_subject(assignableType, assignableId)`.

### `maintenance_tickets`
- **Columns:** `id`; `ticketNo varchar(32)`; `clientId`; `projectId`; `mcoContractId`; `assetId`; `subscriptionId`; `title`; `description`; `status varchar(32) default('open')`; `priority varchar(16)`; `type varchar(16)`; `assigneeId`; `slaPolicyId`; `dueAt timestamp null`; `resolvedAt/closedAt/firstResponseAt timestamp null`; + audit + softDelete.
- **Indexes:** unique `ticketNo`; `idx_mnt_client(clientId, status)`; `idx_mnt_assignee(assigneeId, status)`; `idx_mnt_mco(mcoContractId)`; `idx_mnt_due(dueAt)`; `idx_mnt_status(status)`.

### `sla_policies`
- **Columns:** `id`; `name`; `priority varchar(32)`; `firstResponseHours int`; `resolutionHours int`; `isActive`; + audit + softDelete.
- **Indexes:** unique `priority`.

### `asset_categories`
- **Columns:** `id`; `name`; `type varchar(32)`; `isActive`; + audit + softDelete.
- **Indexes:** unique `name`.

---

## 7.9 Notification tables

### `notification_templates`
- **Columns:** `id`; `key varchar(96)`; `channel varchar(32)`; `name`; `subject varchar(255) null`; `body longtext`; `variables json`; `isActive boolean default(true)`; `locale varchar(8) default('en')`; + audit + softDelete.
- **Indexes:** unique `(key, channel, locale)`; `idx_tpl_active(isActive)`.

### `notifications`
- **Columns:** `id`; `templateId`; `templateKey varchar(96)`; `channel varchar(32)`; `recipientUserId`; `recipientAddress varchar(255)`; `subject varchar(255) null`; `body longtext`; `variables json`; `status varchar(32) default('queued')`; `priority tinyint default(5)`; `scheduledAt/sentAt/deliveredAt/failedAt timestamp null`; `externalId varchar(180) null`; `idempotencyKey varchar(120) null`; `subjectType varchar(50) null`; `subjectId bigint unsigned null`; `error text null`; `attempts int default(0)`; audit.
- **Indexes:** unique `idempotencyKey` (partial); `idx_notif_status_scheduled(status, scheduledAt)`; `idx_notif_recipient(recipientUserId)`; `idx_notif_subject(subjectType, subjectId)`.

### `notification_logs`
- **Columns:** `id`; `notificationId → notifications.id cascade`; `attempt int`; `provider varchar(64)`; `status varchar(32)`; `providerMessageId varchar(180) null`; `requestPayload/responsePayload longtext null`; `error text null`; `durationMs int null`; `createdAt`.
- **Indexes:** `idx_nl_notif(notificationId, attempt)`.

### `notification_preferences`
- **Columns:** `id`; `userId → users.id cascade`; `templateKey varchar(96) null`; `channel varchar(32)`; `enabled boolean default(true)`; `createdAt`; `updatedAt`.
- **Indexes:** unique `(userId, templateKey, channel)`.

### `notification_channels`
- **Columns:** `id`; `channel varchar(32)`; `provider varchar(64)`; `config json`; `isActive boolean default(true)`; `isDefault boolean default(false)`; + audit + softDelete.
- **Indexes:** unique `(channel, provider)`.

---

## 7.10 Knowledge tables

### `articles`
- **Columns:** `id`; `slug varchar(180)`; `title varchar(255)`; `summary varchar(500) null`; `body longtext`; `bodyFormat varchar(16) default('markdown')`; `categoryId`; `status varchar(32) default('draft')`; `visibility varchar(16) default('internal')`; `authorId`; `publishedAt timestamp null`; `currentRevisionId bigint unsigned null`; `viewCount int default(0)`; `helpfulnessScore int default(0)`; + audit + softDelete.
- **Indexes:** unique `slug`; `idx_art_status_vis(status, visibility)`; `idx_art_category(categoryId)`; **FULLTEXT** `ft_art_content(title, summary, body)`.

### `article_revisions`
- **Columns:** `id`; `articleId → articles.id cascade`; `revision int`; `title`; `body longtext`; `editorId`; `changeSummary varchar(255) null`; `createdAt`.
- **Indexes:** unique `(articleId, revision)`; `idx_ar_article(articleId, revision)`.

### `article_categories`
- **Columns:** `id`; `name`; `slug varchar(140)`; `parentId → article_categories.id null`; `position int default(0)`; `isActive`; + audit + softDelete.
- **Indexes:** unique `slug`; `idx_artcat_parent(parentId)`.

### `article_tags`
- **Columns:** `id`; `articleId → articles.id cascade`; `tagId → tags.id cascade`.
- **Indexes:** unique `(articleId, tagId)`; `idx_atat_tag(tagId)`.

---

## 7.11 Audit & Activity tables

### `audit_logs`
- **Columns:** `id`; `actorId`; `action varchar(48)`; `entityType varchar(60)`; `entityId bigint unsigned null`; `before json null`; `after json null`; `diff json null`; `ipAddress varchar(45) null`; `userAgent varchar(500) null`; `route varchar(255) null`; `method varchar(10) null`; `result varchar(16) default('success')`; `error text null`; `occurredAt timestamp defaultNow()`.
- **Indexes:** `idx_audit_actor_time(actorId, occurredAt)`; `idx_audit_entity(entityType, entityId, occurredAt)`; `idx_audit_action_time(action, occurredAt)`; `idx_audit_time(occurredAt)`.
- **Constraints:** **no UPDATE/DELETE in repository layer** (append-only).

### `activity_timeline`
- **Columns:** `id`; `actorId`; `verb varchar(64)`; `verbSubject varchar(64)`; `entityType varchar(60)`; `entityId bigint unsigned`; `projectId`; `clientId`; `description varchar(500)`; `metadata json null`; `isPublic boolean default(false)`; `occurredAt timestamp defaultNow()`.
- **Indexes:** `idx_act_project_time(projectId, occurredAt)`; `idx_act_client_time(clientId, occurredAt)`; `idx_act_entity(entityType, entityId)`; `idx_act_actor(actorId, occurredAt)`; `idx_act_time(occurredAt)`.
- **Constraints:** append-only.

---

## 7.12 Platform tables

### `tags`
- **Columns:** `id`; `name varchar(60)`; `slug varchar(80)`; `color varchar(9) null`; `scope varchar(40) null`; + audit + softDelete.
- **Indexes:** unique `(slug, scope)`; `idx_tag_scope(scope)`.

### `taggables`
- **Columns:** `id`; `tagId → tags.id cascade`; `taggableType varchar(50)`; `taggableId bigint unsigned`; `createdAt`.
- **Indexes:** unique `(tagId, taggableType, taggableId)`; `idx_tg_subject(taggableType, taggableId)`; `idx_tg_tag(tagId)`.

### `attachments`
- **Columns:** `id`; `attachableType varchar(50)`; `attachableId bigint unsigned`; `fileName`; `mime varchar(100)`; `sizeBytes bigint`; `storageProvider varchar(32)`; `storageKey varchar(500)`; `url varchar(1000)`; `isPrivate boolean default(false)`; `uploadedBy`; + audit + softDelete.
- **Indexes:** `idx_att_subject(attachableType, attachableId)`; `idx_att_storage(storageProvider, storageKey)`.

### `comments`
- **Columns:** `id`; `commentableType varchar(50)`; `commentableId bigint unsigned`; `authorId`; `parentId → comments.id null`; `body text`; `isInternal boolean default(false)`; `editedAt timestamp null`; + audit + softDelete.
- **Indexes:** `idx_cmt_subject(commentableType, commentableId, createdAt)`; `idx_cmt_parent(parentId)`; `idx_cmt_author(authorId)`.

### `reminders`
- **Columns:** `id`; `subjectType varchar(50)`; `subjectId bigint unsigned`; `title`; `body text null`; `remindAt timestamp notNull`; `timezone varchar(64) default('UTC')`; `status varchar(32) default('pending')`; `snoozedUntil timestamp null`; `assigneeId`; `createdBy`; + audit + softDelete.
- **Indexes:** `idx_rem_pending(status, remindAt)`; `idx_rem_subject(subjectType, subjectId)`; `idx_rem_assignee(assigneeId)`.

### `settings`
- **Columns:** `id`; `key varchar(120)`; `value text null`; `type varchar(16) default('string')`; `category varchar(60)`; `isPublic boolean default(false)`; `description varchar(255) null`; audit.
- **Indexes:** unique `key`; `idx_setting_category(category)`.

### `number_sequences`
- **Columns:** `id`; `entityType varchar(40)`; `prefix varchar(8)`; `nextValue bigint notNull default(1)`; `padding tinyint notNull default(5)`; `resetFrequency varchar(16) default('yearly')`; `lastResetAt date`; `currentYear int null`; `isActive boolean default(true)`; audit.
- **Indexes:** unique `(entityType, prefix)`.
- **Constraints:** CHECK `nextValue >= 1`.

### `enum_values`
- **Columns:** `id`; `group varchar(60)`; `value varchar(60)`; `label varchar(120)`; `color varchar(9) null`; `position int default(0)`; `isSystem boolean default(false)`; `isActive boolean default(true)`; + audit + softDelete.
- **Indexes:** unique `(group, value)`; `idx_enum_group(group, isActive, position)`.

---

## 7.13 Drizzle relations map (query-builder joins)

Define `relations()` for the key navigations used by the query API (not exhaustive — implement per the access paths in Phase 9):

- `users` ↔ many `userRoles` ↔ `roles` ↔ many `rolePermissions` ↔ `permissions` (for permission resolution).
- `clients` → many `leads`(converted), `contacts`, `quotations`, `contracts`, `projects`, `invoices`, `receipts`, `downPayments`, `subscriptions`, `mcoContracts`, `assets`, `maintenanceTickets`.
- `projects` → many `projectMembers`, `tasks`, `milestones`, `invoices`, `downPayments`, `payrollRuns`, `activityTimeline`.
- `tasks` → many `taskAssignments`, `checklists`.
- `invoices` → many `invoiceItems`, `receiptAllocations`, `dpAllocations`.
- `receipts` → many `receiptAllocations`.
- `downPayments` → many `dpAllocations`.
- `subscriptions` → many `subscriptionItems`, `billingCycles` → `invoices`.
- `payrollRuns` → many `payrollDistributions`, `payrollHistory`, `payrollAdjustments`.
- `notifications` → many `notificationLogs`.
- `articles` → many `articleRevisions`, `articleTags`.

> Polymorphic relations (tags/attachments/comments/reminders/checklists) are **not** expressible as Drizzle typed relations; they are loaded via explicit `(subjectType, subjectId)` queries through the Platform services.

---

## 7.14 Migration generation rules

- Use `drizzle-kit generate` to emit SQL migrations from the schema.
- Review each generated migration by hand before commit (Drizzle occasionally emits suboptimal DDL).
- Never edit a migrated migration; create a new one.
- Seed data (roles, permissions, enum_values, lead_stages, number_sequences, settings) lives in a separate `seed.ts` runnable via `drizzle-kit` or a custom script — **not** in migrations — so seeds are idempotent and re-runnable.
