# Phase 4 — Entity Definitions

> For **every entity**: Purpose, Columns, Primary Key, Foreign Keys, Indexes, Unique Constraints, Nullable Fields, Enum Fields, Soft Delete, Audit Fields, Relationships, Business Rules, Validation Rules, Future Extension.
>
> Conventions (apply to every table; not repeated unless overridden):
> - PK: `id BIGINT UNSIGNED AUTO_INCREMENT`.
> - Audit: `created_at`, `updated_at`, `created_by`, `updated_by`.
> - Soft delete: `deleted_at TIMESTAMP NULL` (business entities only).
> - Money: `DECIMAL(18,2)` + sibling `*_currency CHAR(3)` default `USD` (configurable per-tenant in future).
> - Status enums: stored as `VARCHAR(32)` with DB `CHECK` (MySQL 8 supports it) **and** mirrored in app-level enum for type safety. Configurable statuses live in `enum_values`, not hardcoded.
> - All FKs are `ON DELETE RESTRICT` unless noted; children fully owned by parent use `CASCADE`.
>
> To keep this document navigable, columns are shown as `name : TYPE | flags`.

---

# M01 — IAM

## 1. `users` 🟢
- **Purpose:** A person who can authenticate.
- **Columns:**
  - `id : BIGINT UNSIGNED PK AI`
  - `email : VARCHAR(255) NOT NULL`
  - `email_verified_at : TIMESTAMP NULL`
  - `password_hash : VARCHAR(255) NOT NULL`
  - `password_algo : VARCHAR(32) NOT NULL DEFAULT 'argon2id'`
  - `full_name : VARCHAR(150) NOT NULL`
  - `display_name : VARCHAR(150) NULL`
  - `avatar_url : VARCHAR(500) NULL`
  - `phone : VARCHAR(32) NULL`
  - `locale : VARCHAR(8) NOT NULL DEFAULT 'en'`
  - `timezone : VARCHAR(64) NOT NULL DEFAULT 'UTC'`
  - `status : ENUM('active','invited','suspended','deactivated') NOT NULL DEFAULT 'invited'`
  - `last_login_at : TIMESTAMP NULL`
  - `last_login_ip : VARCHAR(45) NULL`
  - `failed_login_count : INT UNSIGNED NOT NULL DEFAULT 0`
  - `locked_until : TIMESTAMP NULL`
  - `is_founder : BOOLEAN NOT NULL DEFAULT FALSE` (founder = super admin bypass)
  - audit + `deleted_at`
- **PK:** `id`
- **Unique:** `uq_users_email (email)` — and in future `(tenant_id, email)`.
- **FK:** none (root).
- **Indexes:** `idx_users_status (status)`; `idx_users_deleted_at (deleted_at)`.
- **Business rules:**
  - Email stored normalized (lowercase, trimmed).
  - `is_founder = TRUE` ⇒ Super Admin; cannot be deactivated by non-founders; always passes authorization.
  - Account lockout after N failed attempts (configurable) sets `locked_until`.
- **Validation:** email RFC-compliant; password ≥ policy min; full_name non-empty.
- **Future:** `tenant_id`, MFA columns, SSO identity link table.

## 2. `roles` 🟢
- **Purpose:** Named permission bundle.
- **Columns:** `id`; `key : VARCHAR(64) NOT NULL` (e.g. `admin`, `sales`); `name : VARCHAR(120) NOT NULL`; `description : TEXT NULL`; `is_system : BOOLEAN NOT NULL DEFAULT FALSE` (system roles can't be deleted); `priority : INT NOT NULL DEFAULT 0` (higher wins conflicts); audit + `deleted_at`.
- **Unique:** `uq_roles_key (key)`.
- **Indexes:** `idx_roles_deleted_at`.
- **Business rules:** system roles immutable except name/description; delete blocked while users assigned.
- **Future:** `tenant_id`.

## 3. `permissions` ⚪
- **Purpose:** Catalog of all permission keys (see Phase 10). Seed data.
- **Columns:** `id`; `key : VARCHAR(96) NOT NULL` (e.g. `invoice.view`); `module : VARCHAR(32) NOT NULL`; `action : VARCHAR(32) NOT NULL`; `description : VARCHAR(255) NULL`; `is_system : BOOLEAN NOT NULL DEFAULT TRUE`.
- **Unique:** `uq_permissions_key (key)`.
- **Indexes:** `idx_permissions_module (module)`.
- **Business rules:** keys derived from Phase 10 matrix; app bootstraps missing keys into this table.

## 4. `role_permissions` 🟣
- **Purpose:** Grant a permission to a role.
- **Columns:** `id`; `role_id → roles.id ON DELETE CASCADE`; `permission_id → permissions.id ON DELETE CASCADE`.
- **Unique:** `uq_role_perm (role_id, permission_id)`.
- **Indexes:** `idx_rp_role (role_id)`; `idx_rp_perm (permission_id)`.
- **No soft delete** (pure grant table; revoke = delete row, which is itself audited).

## 5. `user_roles` 🟣
- **Purpose:** Assign role(s) to a user. (Users may have multiple roles; permissions merged.)
- **Columns:** `id`; `user_id → users.id ON DELETE CASCADE`; `role_id → roles.id ON DELETE RESTRICT`; `assigned_at : TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`; `assigned_by → users.id NULL`; audit.
- **Unique:** `uq_user_role (user_id, role_id)`.
- **Indexes:** `idx_ur_user (user_id)`; `idx_ur_role (role_id)`.
- **Business rules:** at least one role required when `users.status='active'`; founder implicit super-admin role not stored as a row (bypass).

## 6. `sessions` 🔵
- **Purpose:** Server-side session record (revocable).
- **Columns:** `id`; `user_id → users.id ON DELETE CASCADE`; `token_hash : VARCHAR(255) NOT NULL`; `ip : VARCHAR(45) NULL`; `user_agent : VARCHAR(500) NULL`; `issued_at : TIMESTAMP`; `expires_at : TIMESTAMP NOT NULL`; `revoked_at : TIMESTAMP NULL`; `created_at`.
- **Unique:** `uq_sessions_token (token_hash)`.
- **Indexes:** `idx_sessions_user (user_id, expires_at)`; `idx_sessions_expires (expires_at)`.
- **Business rules:** expired or revoked sessions never authenticate.

## 7. `refresh_tokens` 🔵
- **Purpose:** JWT refresh tokens.
- **Columns:** `id`; `user_id → users.id`; `session_id → sessions.id ON DELETE CASCADE`; `token_hash : VARCHAR(255)`; `expires_at : TIMESTAMP`; `used_at : TIMESTAMP NULL`; `rotated_to : BIGINT UNSIGNED NULL`; `created_at`.
- **Unique:** `uq_rt_token (token_hash)`.
- **Indexes:** `idx_rt_user (user_id)`; `idx_rt_session (session_id)`.
- **Business rules:** rotation: using a token invalidates it and chains to `rotated_to`; reuse of used token revokes the whole session family (theft detection).

## 8. `api_keys` 🔵
- **Purpose:** Machine credentials for integrations.
- **Columns:** `id`; `name : VARCHAR(120)`; `key_prefix : VARCHAR(16)`; `key_hash : VARCHAR(255)`; `scopes : JSON` (permission keys); `owner_id → users.id`; `last_used_at : TIMESTAMP NULL`; `expires_at : TIMESTAMP NULL`; `revoked_at : TIMESTAMP NULL`; audit + `deleted_at`.
- **Unique:** `uq_apikeys_hash (key_hash)`.
- **Indexes:** `idx_apikeys_prefix (key_prefix)`.
- **Future:** per-tenant scoping.

## 9. `password_reset_tokens` 🔵
- **Purpose:** Self-serve reset.
- **Columns:** `id`; `user_id → users.id ON DELETE CASCADE`; `token_hash : VARCHAR(255)`; `expires_at : TIMESTAMP`; `used_at : TIMESTAMP NULL`; `created_at`.
- **Unique:** `uq_prt_token (token_hash)`.
- **Indexes:** `idx_prt_user (user_id)`.

---

# M02 — CRM

## 10. `leads` 🟢
- **Purpose:** A prospect.
- **Columns:**
  - `id`; `reference_no : VARCHAR(32)` (e.g. `LEAD-2026-00001`);
  - `title : VARCHAR(255) NOT NULL`;
  - `client_name : VARCHAR(255) NOT NULL` (prospective);
  - `company : VARCHAR(255) NULL`; `email : VARCHAR(255) NULL`; `phone : VARCHAR(32) NULL`;
  - `source_id → lead_sources.id NULL`;
  - `stage_id → lead_stages.id NOT NULL`;
  - `owner_id → users.id NULL` (sales rep);
  - `estimated_value : DECIMAL(18,2) NULL`; `estimated_value_currency : CHAR(3) NOT NULL DEFAULT 'USD'`;
  - `expected_close_date : DATE NULL`;
  - `description : TEXT NULL`;
  - `converted_client_id → clients.id NULL` (set on conversion);
  - `converted_at : TIMESTAMP NULL`;
  - `lost_reason : VARCHAR(255) NULL`;
  - audit + `deleted_at`.
- **Unique:** `uq_leads_ref (reference_no)` (tenant-scoped seq in future).
- **FK:** source, stage, owner, converted_client.
- **Indexes:** `idx_leads_stage (stage_id, deleted_at)`; `idx_leads_owner (owner_id)`; `idx_leads_expected_close (expected_close_date)`; `idx_leads_email (email)`.
- **Enum-like:** stage is FK (configurable pipeline), not a fixed enum.
- **Business rules:** once `converted_at` set, lead is read-only except notes; status derived from `lead_stages.is_won/is_lost`.
- **Validation:** at least one of email/phone required.

## 11. `lead_stages` ⚪
- **Purpose:** Configurable pipeline stages.
- **Columns:** `id`; `key : VARCHAR(32)`; `name : VARCHAR(120)`; `position : INT NOT NULL`; `is_won : BOOLEAN DEFAULT FALSE`; `is_lost : BOOLEAN DEFAULT FALSE`; `is_default : BOOLEAN DEFAULT FALSE`; audit + `deleted_at`.
- **Unique:** `uq_leadstage_key (key)`.
- **Indexes:** `idx_leadstage_position (position)`.

## 12. `lead_sources` ⚪
- **Purpose:** Lead origin catalog.
- **Columns:** `id`; `name : VARCHAR(120)`; `is_active : BOOLEAN DEFAULT TRUE`; audit + `deleted_at`.
- **Unique:** `uq_leadsource_name (name)`.

## 13. `clients` 🟢
- **Purpose:** A paying client.
- **Columns:**
  - `id`; `reference_no : VARCHAR(32)` (e.g. `CL-2026-00001`);
  - `name : VARCHAR(255) NOT NULL`;
  - `type : ENUM('individual','organization') NOT NULL DEFAULT 'organization'`;
  - `legal_name : VARCHAR(255) NULL`; `tax_id : VARCHAR(64) NULL`;
  - `email : VARCHAR(255) NULL`; `phone : VARCHAR(32) NULL`;
  - `website : VARCHAR(255) NULL`;
  - `address_line : VARCHAR(255) NULL`; `city : VARCHAR(120) NULL`; `state : VARCHAR(120) NULL`; `postal_code : VARCHAR(32) NULL`; `country : CHAR(2) NOT NULL DEFAULT 'US'`;
  - `default_currency : CHAR(3) NOT NULL DEFAULT 'USD'`;
  - `status : ENUM('active','inactive','blacklisted') NOT NULL DEFAULT 'active'`;
  - `notes : TEXT NULL`;
  - `owner_id → users.id NULL`;
  - audit + `deleted_at`.
- **Unique:** `uq_clients_ref (reference_no)`.
- **FK:** owner.
- **Indexes:** `idx_clients_name (name)`; `idx_clients_status (status, deleted_at)`; `idx_clients_email (email)`; `idx_clients_owner (owner_id)`.
- **Business rules:** cannot hard-delete if any project/invoice exists; soft-delete allowed. Blacklisting blocks new invoicing.
- **Validation:** org requires `legal_name`; email valid if present.

## 14. `contacts` 🔵
- **Purpose:** A person within a lead/client.
- **Columns:** `id`; `client_id → clients.id NULL ON DELETE CASCADE`; `lead_id → leads.id NULL ON DELETE CASCADE`; `first_name : VARCHAR(120)`; `last_name : VARCHAR(120) NULL`; `email : VARCHAR(255)`; `phone : VARCHAR(32) NULL`; `position : VARCHAR(120) NULL`; `is_primary : BOOLEAN DEFAULT FALSE`; audit + `deleted_at`.
- **Check:** exactly one of `client_id`/`lead_id` non-null (enforced in app + DB CHECK).
- **Indexes:** `idx_contacts_client (client_id)`; `idx_contacts_lead (lead_id)`; `uq_contacts_email_client (client_id, email)` NULLs distinct.
- **Business rules:** at most one `is_primary` per client (app-enforced atomic swap).

---

# M03 — Sales

## 15. `pricelist_items` 🟢
- **Purpose:** Service/product with a rate.
- **Columns:** `id`; `service_key : VARCHAR(64)` (e.g. `web-development`); `name : VARCHAR(255)`; `description : TEXT NULL`; `unit : ENUM('hour','day','item','month','project') NOT NULL DEFAULT 'item'`; `unit_price : DECIMAL(18,2) NOT NULL`; `currency : CHAR(3) NOT NULL DEFAULT 'USD'`; `is_active : BOOLEAN DEFAULT TRUE`; `effective_from : DATE NULL`; `effective_to : DATE NULL`; audit + `deleted_at`.
- **Unique:** `uq_pli_key (service_key)`.
- **Indexes:** `idx_pli_active (is_active, deleted_at)`.
- **Business rules:** historical quotations/ invoices must **snapshot** price (never re-derive from this table).

## 16. `quotations` 🟢
- **Purpose:** Priced offer.
- **Columns:**
  - `id`; `quotation_no : VARCHAR(32)` (e.g. `QUO-2026-00001`);
  - `client_id → clients.id NOT NULL`;
  - `project_id → projects.id NULL` (optional pre-project);
  - `lead_id → leads.id NULL`;
  - `title : VARCHAR(255)`; `subject : VARCHAR(255) NULL`;
  - `issue_date : DATE NOT NULL`; `valid_until : DATE NOT NULL`;
  - `currency : CHAR(3) NOT NULL DEFAULT 'USD'`;
  - `subtotal : DECIMAL(18,2) NOT NULL DEFAULT 0`; `discount_total : DECIMAL(18,2) NOT NULL DEFAULT 0`; `tax_total : DECIMAL(18,2) NOT NULL DEFAULT 0`; `grand_total : DECIMAL(18,2) NOT NULL DEFAULT 0`;
  - `status : ENUM('draft','sent','viewed','accepted','rejected','expired','converted') NOT NULL DEFAULT 'draft'`;
  - `sent_at : TIMESTAMP NULL`; `accepted_at : TIMESTAMP NULL`; `rejected_at : TIMESTAMP NULL`; `expired_at : TIMESTAMP NULL`;
  - `notes : TEXT NULL`; `terms : TEXT NULL`;
  - `owner_id → users.id`;
  - `converted_contract_id → contracts.id NULL`;
  - audit + `deleted_at`.
- **Unique:** `uq_quo_no (quotation_no)`.
- **FK:** client, project, lead, owner, converted_contract.
- **Indexes:** `idx_quo_client (client_id, deleted_at)`; `idx_quo_status (status)`; `idx_quo_owner (owner_id)`; `idx_quo_issue (issue_date)`.
- **Business rules:** totals always recomputed from items on save; cannot `accept` after `valid_until`; cannot edit after `accepted`.
- **Validation:** `valid_until >= issue_date`.

## 17. `quotation_items` 🔵
- **Purpose:** Line in a quotation (price snapshot).
- **Columns:** `id`; `quotation_id → quotations.id ON DELETE CASCADE`; `pricelist_item_id → pricelist_items.id NULL`; `description : VARCHAR(500)`; `unit : VARCHAR(32)`; `quantity : DECIMAL(12,3) NOT NULL DEFAULT 1`; `unit_price : DECIMAL(18,2) NOT NULL` (snapshot); `currency : CHAR(3)`; `discount_type : ENUM('none','fixed','percent') DEFAULT 'none'`; `discount_value : DECIMAL(18,2) DEFAULT 0`; `tax_rate_id → tax_rates.id NULL`; `line_total : DECIMAL(18,2) NOT NULL DEFAULT 0`; `position : INT NOT NULL DEFAULT 0`; `created_at`; `updated_at`.
- **Indexes:** `idx_qi_quotation (quotation_id, position)`.
- **Business rules:** `line_total` = computed; `unit_price` frozen even if pricelist changes.

## 18. `proposals` 🟢
- **Purpose:** Narrative/strategic offer.
- **Columns:** `id`; `proposal_no : VARCHAR(32)`; `client_id → clients.id`; `quotation_id → quotations.id NULL`; `title : VARCHAR(255)`; `version : INT NOT NULL DEFAULT 1`; `summary : TEXT`; `body : LONGTEXT` (markdown); `status : ENUM('draft','submitted','accepted','rejected','archived') DEFAULT 'draft'`; `submitted_at : TIMESTAMP NULL`; `accepted_at : TIMESTAMP NULL`; `owner_id → users.id`; audit + `deleted_at`.
- **Unique:** `uq_prop_no_ver (proposal_no, version)`.
- **Indexes:** `idx_prop_client (client_id)`; `idx_prop_status (status)`.

## 19. `contracts` 🟢
- **Purpose:** Signed agreement.
- **Columns:**
  - `id`; `contract_no : VARCHAR(32)` (e.g. `CTR-2026-00001`);
  - `client_id → clients.id NOT NULL`; `project_id → projects.id NULL`;
  - `quotation_id → quotations.id NULL`; `proposal_id → proposals.id NULL`;
  - `title : VARCHAR(255)`; `scope : TEXT`;
  - `total_value : DECIMAL(18,2)`; `currency : CHAR(3)`;
  - `start_date : DATE NOT NULL`; `end_date : DATE NULL`;
  - `signed_at : TIMESTAMP NULL`; `signed_by_client : VARCHAR(255) NULL`;
  - `status : ENUM('draft','sent','signed','active','terminated','expired','cancelled') DEFAULT 'draft'`;
  - `terms : TEXT NULL`;
  - `owner_id → users.id`; audit + `deleted_at`.
- **Unique:** `uq_ctr_no (contract_no)`.
- **Indexes:** `idx_ctr_client (client_id)`; `idx_ctr_status (status)`; `idx_ctr_dates (start_date, end_date)`.
- **Business rules:** `signed_at <= start_date`; a contract must be `active` to bind a project (configurable to allow draft).

## 20. `contract_documents` 🔵
- **Purpose:** Signed/uploaded artifacts.
- **Columns:** `id`; `contract_id → contracts.id ON DELETE CASCADE`; `kind : ENUM('unsigned','signed','amendment','addendum')`; `file_url : VARCHAR(500)`; `file_name : VARCHAR(255)`; `mime : VARCHAR(100)`; `size_bytes : BIGINT`; `uploaded_by → users.id`; `created_at`.
- **Indexes:** `idx_cd_contract (contract_id, kind)`.

## 21. `discounts` 🔵
- **Purpose:** Discount definition (line/total). Often realized as columns on items; this table supports named/reusable discounts.
- **Columns:** `id`; `name : VARCHAR(120)`; `scope : ENUM('quotation','invoice')`; `type : ENUM('fixed','percent')`; `value : DECIMAL(18,2)`; `currency : CHAR(3) NULL`; `starts_at : DATE NULL`; `ends_at : DATE NULL`; `is_active : BOOLEAN DEFAULT TRUE`; audit + `deleted_at`.
- **Unique:** `uq_disc_name_scope (name, scope)`.
- **Indexes:** `idx_disc_scope_active (scope, is_active)`.

---

# M04 — Delivery

## 22. `projects` 🟢
- **Purpose:** Unit of work.
- **Columns:**
  - `id`; `project_no : VARCHAR(32)` (e.g. `PRJ-2026-00001`);
  - `client_id → clients.id NOT NULL`; `contract_id → contracts.id NULL`;
  - `quotation_id → quotations.id NULL`;
  - `name : VARCHAR(255)`; `description : TEXT NULL`;
  - `status : ENUM('planning','active','on_hold','completed','cancelled','archived') DEFAULT 'planning'`;
  - `priority : ENUM('low','medium','high','urgent') DEFAULT 'medium'`;
  - `start_date : DATE NULL`; `due_date : DATE NULL`; `completed_at : TIMESTAMP NULL`;
  - `budget_hours : DECIMAL(10,2) NULL`; `budget_amount : DECIMAL(18,2) NULL`; `currency : CHAR(3) NOT NULL DEFAULT 'USD'`;
  - `progress : TINYINT UNSIGNED NOT NULL DEFAULT 0` (0–100, derived);
  - `manager_id → users.id NULL`;
  - `template_id → project_templates.id NULL`;
  - audit + `deleted_at`.
- **Unique:** `uq_prj_no (project_no)`.
- **Indexes:** `idx_prj_client (client_id, deleted_at)`; `idx_prj_status (status)`; `idx_prj_manager (manager_id)`; `idx_prj_due (due_date)`; `idx_prj_contract (contract_id)`.
- **Business rules:** `completed` requires all non-optional milestones reached (configurable); cannot start without client.

## 23. `project_members` 🟣
- **Purpose:** Team assignment.
- **Columns:** `id`; `project_id → projects.id ON DELETE CASCADE`; `user_id → users.id`; `role_in_project : ENUM('manager','lead','member','viewer') DEFAULT 'member'`; `allocated_hours : DECIMAL(10,2) NULL`; `revenue_share_pct : DECIMAL(6,3) NULL` (cache for payroll display; source of truth = payroll_rules); audit.
- **Unique:** `uq_pm_project_user (project_id, user_id)`.
- **Indexes:** `idx_pm_user (user_id)`; `idx_pm_project (project_id)`.

## 24. `tasks` 🟢
- **Purpose:** Unit of delivery.
- **Columns:**
  - `id`; `task_no : VARCHAR(32)` (e.g. `TASK-PRJ1-0001`);
  - `project_id → projects.id NOT NULL`; `milestone_id → milestones.id NULL`;
  - `title : VARCHAR(255)`; `description : TEXT NULL`;
  - `status : ENUM('backlog','todo','in_progress','blocked','review','done','cancelled') DEFAULT 'todo'`;
  - `priority : ENUM('low','medium','high','urgent') DEFAULT 'medium'`;
  `type : ENUM('task','bug','feature','improvement','epic') DEFAULT 'task'`;
  - `estimate_hours : DECIMAL(10,2) NULL`; `logged_hours : DECIMAL(10,2) NOT NULL DEFAULT 0`;
  - `start_date : DATE NULL`; `due_date : DATE NULL`; `completed_at : TIMESTAMP NULL`;
  - `position : INT NOT NULL DEFAULT 0`; `parent_task_id → tasks.id NULL`;
  - `created_by`; `updated_by`; `created_at`; `updated_at`; `deleted_at`.
- **Unique:** `uq_task_no (task_no)`.
- **Indexes:** `idx_task_project (project_id, status)`; `idx_task_milestone (milestone_id)`; `idx_task_assignee_lookup` (via task_assignments); `idx_task_due (due_date)`; `idx_task_parent (parent_task_id)`.
- **Business rules:** `done` requires acceptance criteria (checklist) complete (configurable); parent/child cycle prevention.

## 25. `task_assignments` 🟣
- **Purpose:** Many-to-many assignee.
- **Columns:** `id`; `task_id → tasks.id ON DELETE CASCADE`; `user_id → users.id`; `is_primary : BOOLEAN DEFAULT FALSE`; `assigned_at : TIMESTAMP DEFAULT CURRENT_TIMESTAMP`; `assigned_by → users.id NULL`.
- **Unique:** `uq_ta_task_user (task_id, user_id)`.
- **Indexes:** `idx_ta_user (user_id)`; `idx_ta_task (task_id)`.

## 26. `milestones` 🔵
- **Purpose:** Ordered checkpoint.
- **Columns:** `id`; `project_id → projects.id ON DELETE CASCADE`; `name : VARCHAR(255)`; `description : TEXT NULL`; `position : INT`; `due_date : DATE NULL`; `is_reached : BOOLEAN DEFAULT FALSE`; `reached_at : TIMESTAMP NULL`; `is_optional : BOOLEAN DEFAULT FALSE`; audit.
- **Indexes:** `idx_ms_project (project_id, position)`.

## 27. `checklists` 🔵
- **Purpose:** Checklist container.
- **Columns:** `id`; `subject_type : VARCHAR(50)` (task|project); `subject_id : BIGINT UNSIGNED`; `title : VARCHAR(255)`; `position : INT`; audit + `deleted_at`.
- **Indexes:** `idx_chk_subject (subject_type, subject_id)`.

## 28. `checklist_items` 🔵
- **Purpose:** Checklist to-do.
- **Columns:** `id`; `checklist_id → checklists.id ON DELETE CASCADE`; `content : VARCHAR(500)`; `is_checked : BOOLEAN DEFAULT FALSE`; `checked_by → users.id NULL`; `checked_at : TIMESTAMP NULL`; `position : INT`; `created_at`; `updated_at`.
- **Indexes:** `idx_chki_checklist (checklist_id, position)`.

## 29. `project_templates` ⚪
- **Purpose:** Reusable blueprint.
- **Columns:** `id`; `name : VARCHAR(255)`; `description : TEXT NULL`; `default_task_blueprint : JSON` (array of task seeds); `default_milestones : JSON`; `is_active : BOOLEAN DEFAULT TRUE`; audit + `deleted_at`.
- **Unique:** `uq_pt_name (name)`.
- **Indexes:** `idx_pt_active (is_active)`.

---

# M05 — Finance

## 30. `invoices` 🟢
- **Purpose:** Demand for payment.
- **Columns:**
  - `id`; `invoice_no : VARCHAR(32)` (e.g. `INV-2026-00001`);
  - `client_id → clients.id NOT NULL`; `project_id → projects.id NULL`; `contract_id → contracts.id NULL`; `subscription_id → subscriptions.id NULL`;
  - `billing_cycle_id → billing_cycles.id NULL`;
  - `subject : VARCHAR(255) NULL`;
  - `issue_date : DATE NOT NULL`; `due_date : DATE NOT NULL`;
  - `currency : CHAR(3)`;
  - `subtotal : DECIMAL(18,2)`; `discount_total : DECIMAL(18,2)`; `tax_total : DECIMAL(18,2)`; `grand_total : DECIMAL(18,2)`;
  - `paid_amount : DECIMAL(18,2) NOT NULL DEFAULT 0`; `balance : DECIMAL(18,2) NOT NULL DEFAULT 0`;
  - `payment_status : ENUM('unpaid','partial','paid','overpaid','voided') NOT NULL DEFAULT 'unpaid'`;
  - `status : ENUM('draft','issued','sent','paid','partial','voided','overdue','uncollectible') NOT NULL DEFAULT 'draft'`;
  - `sent_at : TIMESTAMP NULL`; `paid_at : TIMESTAMP NULL`; `voided_at : TIMESTAMP NULL`; `overdue_at : TIMESTAMP NULL`;
  - `external_ref : VARCHAR(120) NULL` (gateway id; idempotency);
  - `notes : TEXT NULL`; `terms : TEXT NULL`;
  - `owner_id → users.id`; audit + `deleted_at`.
- **Unique:** `uq_inv_no (invoice_no)`; `uq_inv_external (external_ref)` partial (non-null only).
- **FK:** client, project, contract, subscription, billing_cycle, owner.
- **Indexes:** `idx_inv_client (client_id, deleted_at)`; `idx_inv_project (project_id)`; `idx_inv_status (status, due_date)`; `idx_inv_payment (payment_status)`; `idx_inv_due (due_date)`; `idx_inv_issue (issue_date)`.
- **Business rules:**
  - Totals recomputed from items.
  - `paid_amount = sum(receipt_allocations + dp_allocations)`; `balance = grand_total - paid_amount`.
  - `payment_status`: paid_amount == 0 → unpaid; 0 < < grand → partial; == grand → paid; > grand → overpaid.
  - Voiding an invoice reverses all allocations and voids linked receipt allocations (not the receipts themselves).
  - Cannot edit financial fields after `issued` (only metadata).
- **Validation:** `due_date >= issue_date`; grand_total ≥ 0.

## 31. `invoice_items` 🔵
- **Purpose:** Invoice line.
- **Columns:** `id`; `invoice_id → invoices.id ON DELETE CASCADE`; `pricelist_item_id → pricelist_items.id NULL`; `description : VARCHAR(500)`; `quantity : DECIMAL(12,3) DEFAULT 1`; `unit_price : DECIMAL(18,2)`; `currency : CHAR(3)`; `discount_type : ENUM('none','fixed','percent') DEFAULT 'none'`; `discount_value : DECIMAL(18,2) DEFAULT 0`; `tax_rate_id → tax_rates.id NULL`; `line_total : DECIMAL(18,2)`; `position : INT DEFAULT 0`; `created_at`; `updated_at`.
- **Indexes:** `idx_ii_invoice (invoice_id, position)`.
- **Business rules:** once invoice `issued`, items immutable except via void+reissue.

## 32. `receipts` 🟢
- **Purpose:** Proof of payment received.
- **Columns:**
  - `id`; `receipt_no : VARCHAR(32)` (e.g. `RCT-2026-00001`);
  - `client_id → clients.id NOT NULL`;
  - `amount : DECIMAL(18,2) NOT NULL`; `currency : CHAR(3)`;
  - `payment_method : ENUM('cash','bank_transfer','card','ewallet','crypto','cheque','other')`;
  - `payment_date : DATE NOT NULL`; `received_at : TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`;
  - `reference : VARCHAR(180) NULL` (client bank ref / gateway); `external_ref : VARCHAR(120) NULL` (idempotency);
  - `status : ENUM('confirmed','pending','voided') DEFAULT 'confirmed'`;
  - `voided_at : TIMESTAMP NULL`; `void_reason : VARCHAR(255) NULL`;
  - `allocated_amount : DECIMAL(18,2) NOT NULL DEFAULT 0`; `unallocated_amount : DECIMAL(18,2) NOT NULL DEFAULT 0`;
  - `notes : TEXT NULL`; `owner_id → users.id`; audit + `deleted_at`.
- **Unique:** `uq_rct_no (receipt_no)`; `uq_rct_external (external_ref)` partial.
- **Indexes:** `idx_rct_client (client_id, payment_date)`; `idx_rct_status (status)`; `idx_rct_date (payment_date)`.
- **Business rules:** amount > 0; voiding reverses all `receipt_allocations`; `unallocated = amount - sum(allocations)`; a receipt may have unallocated remainder (DP-able or to-be-allocated).

## 33. `receipt_allocations` 🔵
- **Purpose:** Receipt → invoice allocation.
- **Columns:** `id`; `receipt_id → receipts.id ON DELETE CASCADE`; `invoice_id → invoices.id ON DELETE RESTRICT`; `amount : DECIMAL(18,2) NOT NULL`; `allocated_at : TIMESTAMP DEFAULT CURRENT_TIMESTAMP`; `allocated_by → users.id NULL`; `is_reversed : BOOLEAN DEFAULT FALSE`; `reversed_at : TIMESTAMP NULL`; `created_at`.
- **Indexes:** `idx_ra_receipt (receipt_id)`; `idx_ra_invoice (invoice_id)`.
- **Check:** `amount > 0`.
- **Business rules:** sum of active allocations per invoice ≤ invoice.grand_total (enforced in service, with row lock).

## 34. `down_payments` 🟢
- **Purpose:** DP collected (supports unlimited & manual modes — Phase 12).
- **Columns:**
  - `id`; `dp_no : VARCHAR(32)` (e.g. `DP-2026-00001`);
  - `client_id → clients.id NOT NULL`; `project_id → projects.id NULL`; `contract_id → contracts.id NULL`;
  - `amount : DECIMAL(18,2)`; `currency : CHAR(3)`;
  - `collected_at : TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`; `payment_method : VARCHAR(32)`;
  - `mode : ENUM('unlimited','manual') NOT NULL` (unlimited: auto-applied to next invoices; manual: applied explicitly);
  - `allocated_amount : DECIMAL(18,2) NOT NULL DEFAULT 0`; `balance : DECIMAL(18,2) NOT NULL DEFAULT 0`;
  - `status : ENUM('collected','partially_allocated','fully_allocated','refunded') DEFAULT 'collected'`;
  - `refunded_amount : DECIMAL(18,2) DEFAULT 0`;
  - `notes : TEXT NULL`; `owner_id → users.id`; audit + `deleted_at`.
- **Unique:** `uq_dp_no (dp_no)`.
- **Indexes:** `idx_dp_client (client_id)`; `idx_dp_project (project_id)`; `idx_dp_status (status)`.

## 35. `dp_allocations` 🔵
- **Purpose:** DP → invoice allocation.
- **Columns:** `id`; `down_payment_id → down_payments.id ON DELETE CASCADE`; `invoice_id → invoices.id`; `amount : DECIMAL(18,2)`; `is_reversed : BOOLEAN DEFAULT FALSE`; `reversed_at : TIMESTAMP NULL`; `allocated_at : TIMESTAMP DEFAULT CURRENT_TIMESTAMP`; `allocated_by → users.id NULL`; `created_at`.
- **Indexes:** `idx_dpa_dp (down_payment_id)`; `idx_dpa_invoice (invoice_id)`.

## 36. `expenses` 🟢
- **Purpose:** Money spent.
- **Columns:**
  - `id`; `expense_no : VARCHAR(32)` (e.g. `EXP-2026-00001`);
  - `category_id → expense_categories.id`; `project_id → projects.id NULL`; `client_id → clients.id NULL`; `vendor : VARCHAR(255) NULL`;
  - `amount : DECIMAL(18,2)`; `currency : CHAR(3)`; `payment_method : VARCHAR(32)`; `payment_date : DATE`;
  - `status : ENUM('draft','pending_approval','approved','paid','voided') DEFAULT 'draft'`; `approved_by → users.id NULL`; `approved_at : TIMESTAMP NULL`; `paid_at : TIMESTAMP NULL`;
  - `is_reimbursable : BOOLEAN DEFAULT FALSE`; `receipt_url : VARCHAR(500) NULL`;
  - `description : TEXT NULL`; `owner_id → users.id`; audit + `deleted_at`.
- **Unique:** `uq_exp_no (expense_no)`.
- **Indexes:** `idx_exp_category (category_id, payment_date)`; `idx_exp_project (project_id)`; `idx_exp_status (status)`; `idx_exp_date (payment_date)`.
- **Business rules:** approval required above threshold (configurable); void reverses cashflow impact.

## 37. `expense_categories` ⚪
- **Columns:** `id`; `name : VARCHAR(120)`; `kind : ENUM('operating','cost_of_goods','payroll','tax','other') DEFAULT 'operating'`; `is_active : BOOLEAN DEFAULT TRUE`; audit + `deleted_at`.
- **Unique:** `uq_expcat_name (name)`.
- **Indexes:** `idx_expcat_kind (kind, is_active)`.

## 38. `incomes` 🟢
- **Purpose:** Non-invoice money received (grants, interest, etc.).
- **Columns:** `id`; `income_no : VARCHAR(32)`; `category_id → income_categories.id`; `client_id → clients.id NULL`; `project_id → projects.id NULL`; `amount : DECIMAL(18,2)`; `currency : CHAR(3)`; `received_date : DATE`; `payment_method : VARCHAR(32)`; `description : TEXT NULL`; `owner_id → users.id`; audit + `deleted_at`.
- **Unique:** `uq_inc_no (income_no)`.
- **Indexes:** `idx_inc_category (category_id, received_date)`; `idx_inc_date (received_date)`.

## 39. `income_categories` ⚪
- **Columns:** `id`; `name : VARCHAR(120)`; `kind : ENUM('operating','investment','other') DEFAULT 'operating'`; `is_active : BOOLEAN DEFAULT TRUE`; audit + `deleted_at`.
- **Unique:** `uq_inccat_name (name)`.

## 40. `cashflow_snapshots` 🟤
- **Purpose:** Period cash in/out.
- **Columns:** `id`; `period_start : DATE`; `period_end : DATE`; `granularity : ENUM('daily','weekly','monthly','quarterly','yearly')`; `inflow : DECIMAL(18,2)`; `outflow : DECIMAL(18,2)`; `net : DECIMAL(18,2)`; `currency : CHAR(3)`; `computed_at : TIMESTAMP`; `metadata : JSON NULL`.
- **Unique:** `uq_cf_period (period_start, period_end, granularity, currency)`.
- **Indexes:** `idx_cf_period (period_start, period_end)`.

## 41. `profit_snapshots` 🟤
- **Purpose:** Period profit.
- **Columns:** `id`; `period_start : DATE`; `period_end : DATE`; `granularity : ENUM(...)`; `revenue : DECIMAL(18,2)`; `cost_of_goods : DECIMAL(18,2)`; `operating_expenses : DECIMAL(18,2)`; `payroll : DECIMAL(18,2)`; `net_profit : DECIMAL(18,2)`; `currency : CHAR(3)`; `computed_at : TIMESTAMP`.
- **Unique:** `uq_pf_period (period_start, period_end, granularity, currency)`.
- **Indexes:** `idx_pf_period (period_start, period_end)`.

## 42. `tax_rates` ⚪ (reserved/future)
- **Purpose:** Tax rate catalog.
- **Columns:** `id`; `name : VARCHAR(120)`; `rate : DECIMAL(6,4)`; `is_inclusive : BOOLEAN DEFAULT FALSE`; `country : CHAR(2) NULL`; `region : VARCHAR(120) NULL`; `effective_from : DATE`; `effective_to : DATE NULL`; `is_active : BOOLEAN DEFAULT TRUE`; audit + `deleted_at`.
- **Unique:** `uq_tax_name_country (name, country, region)`.

---

# M06 — Subscription / Billing

## 43. `plans` ⚪
- **Columns:** `id`; `plan_code : VARCHAR(64)`; `name : VARCHAR(255)`; `description : TEXT NULL`; `interval : ENUM('monthly','quarterly','yearly','custom')`; `interval_days : INT NULL` (custom); `amount : DECIMAL(18,2)`; `currency : CHAR(3)`; `is_active : BOOLEAN DEFAULT TRUE`; `trial_days : INT DEFAULT 0`; audit + `deleted_at`.
- **Unique:** `uq_plan_code (plan_code)`.

## 44. `subscriptions` 🟢
- **Purpose:** Client's subscription.
- **Columns:** `id`; `subscription_no : VARCHAR(32)`; `client_id → clients.id`; `plan_id → plans.id`; `status : ENUM('trialing','active','suspended','cancelled','expired') DEFAULT 'active'`; `current_period_start : DATE`; `current_period_end : DATE`; `started_at : TIMESTAMP`; `cancelled_at : TIMESTAMP NULL`; `suspended_at : TIMESTAMP NULL`; `auto_renew : BOOLEAN DEFAULT TRUE`; `currency : CHAR(3)`; `amount : DECIMAL(18,2)`; `mco_contract_id → mco_contracts.id NULL`; audit + `deleted_at`.
- **Unique:** `uq_sub_no (subscription_no)`.
- **Indexes:** `idx_sub_client (client_id)`; `idx_sub_status (status)`; `idx_sub_period_end (current_period_end)` (for renewal cron).

## 45. `subscription_items` 🔵
- **Purpose:** Line within a subscription.
- **Columns:** `id`; `subscription_id → subscriptions.id ON DELETE CASCADE`; `name : VARCHAR(255)`; `quantity : DECIMAL(12,3) DEFAULT 1`; `unit_price : DECIMAL(18,2)`; `currency : CHAR(3)`; `created_at`; `updated_at`.
- **Indexes:** `idx_si_sub (subscription_id)`.

## 46. `mco_contracts` 🟢
- **Purpose:** Maintenance Contract Order.
- **Columns:** `id`; `mco_no : VARCHAR(32)`; `client_id → clients.id`; `project_id → projects.id NULL` (origin project); `subscription_id → subscriptions.id NULL`; `name : VARCHAR(255)`; `scope : TEXT`; `monthly_hours : DECIMAL(10,2) NULL`; `monthly_fee : DECIMAL(18,2)`; `currency : CHAR(3)`; `start_date : DATE`; `end_date : DATE NULL`; `status : ENUM('draft','active','suspended','expired','terminated') DEFAULT 'draft'`; `signed_at : TIMESTAMP NULL`; `renewal_reminder_sent : BOOLEAN DEFAULT FALSE`; audit + `deleted_at`.
- **Unique:** `uq_mco_no (mco_no)`.
- **Indexes:** `idx_mco_client (client_id)`; `idx_mco_status (status)`; `idx_mco_end (end_date)`.

## 47. `billing_cycles` 🔵
- **Purpose:** One billing period instance.
- **Columns:** `id`; `subscription_id → subscriptions.id ON DELETE CASCADE`; `period_start : DATE`; `period_end : DATE`; `amount : DECIMAL(18,2)`; `currency : CHAR(3)`; `invoice_id → invoices.id NULL`; `status : ENUM('pending','invoiced','paid','failed') DEFAULT 'pending'`; `generated_at : TIMESTAMP DEFAULT CURRENT_TIMESTAMP`; `invoiced_at : TIMESTAMP NULL`; `paid_at : TIMESTAMP NULL`.
- **Unique:** `uq_bc_sub_period (subscription_id, period_start, period_end)`.
- **Indexes:** `idx_bc_sub (subscription_id, period_end)`; `idx_bc_status (status)`.

---

# M07 — Payroll

## 48. `payroll_rules` 🟢
- **Purpose:** Configurable payroll rule. **Never hardcode percentages.**
- **Columns:**
  - `id`; `name : VARCHAR(255)`; `key : VARCHAR(64)`;
  - `type : ENUM('internal','project') NOT NULL`;
  - `formula : ENUM('fixed','percent','hybrid') NOT NULL`;
  - `fixed_amount : DECIMAL(18,2) NULL`; `percentage : DECIMAL(8,5) NULL`; `currency : CHAR(3)`;
  - `scope : ENUM('global','role','user','project','department') NOT NULL DEFAULT 'global'`;
  - `scope_ref_id : BIGINT UNSIGNED NULL` (user_id/role_id/project_id depending on scope);
  - `base : ENUM('gross_revenue','net_revenue','profit','salary_base','fixed_value') NOT NULL` (what the % applies to);
  - `priority : INT NOT NULL DEFAULT 0` (higher wins; used in resolution);
  - `min_payout : DECIMAL(18,2) NULL`; `max_payout : DECIMAL(18,2) NULL`;
  - `effective_from : DATE`; `effective_to : DATE NULL`; `is_active : BOOLEAN DEFAULT TRUE`;
  - audit + `deleted_at`.
- **Unique:** `uq_pr_key (key)`.
- **Indexes:** `idx_pr_type_scope (type, scope, is_active)`; `idx_pr_active (is_active, effective_from, effective_to)`; `idx_pr_priority (priority)`.
- **Business rules:** hybrid = fixed + percent of base; archived not deleted; future-dated rules don't apply until `effective_from`.

## 49. `payroll_runs` 🟢
- **Purpose:** One payroll execution.
- **Columns:**
  - `id`; `run_no : VARCHAR(32)`;
  - `type : ENUM('internal','project') NOT NULL`;
  - `period_start : DATE` (internal: 1st of month; project: project close date range);
  - `period_end : DATE`; `project_id → projects.id NULL` (for project type);
  - `status : ENUM('draft','computing','computed','approved','posted','reversed') DEFAULT 'draft'`;
  - `total_amount : DECIMAL(18,2) DEFAULT 0`; `currency : CHAR(3)`;
  - `computed_at : TIMESTAMP NULL`; `approved_by → users.id NULL`; `approved_at : TIMESTAMP NULL`; `posted_at : TIMESTAMP NULL`; `reversed_at : TIMESTAMP NULL`; `reversal_of → payroll_runs.id NULL`;
  - `notes : TEXT NULL`; audit.
- **Unique:** `uq_run_no (run_no)`.
- **Indexes:** `idx_run_type (type, status)`; `idx_run_period (period_start, period_end)`; `idx_run_project (project_id)`.

## 50. `payroll_distributions` 🔵
- **Purpose:** Computed payout line per contributor per run.
- **Columns:** `id`; `run_id → payroll_runs.id ON DELETE CASCADE`; `user_id → users.id`; `project_id → projects.id NULL`; `base_amount : DECIMAL(18,2)`; `rule_id → payroll_rules.id NULL`; `formula : VARCHAR(32)`; `computed_amount : DECIMAL(18,2)`; `adjustment_amount : DECIMAL(18,2) DEFAULT 0`; `final_amount : DECIMAL(18,2)`; `currency : CHAR(3)`; `breakdown : JSON` (computation trace); `created_at`.
- **Indexes:** `idx_pd_run (run_id)`; `idx_pd_user (user_id)`; `idx_pd_project (project_id)`.

## 51. `payroll_history` 🟤
- **Purpose:** Posted, immutable payout record per (run, user).
- **Columns:** `id`; `run_id → payroll_runs.id`; `user_id → users.id`; `amount : DECIMAL(18,2)`; `currency : CHAR(3)`; `type : ENUM('salary','revenue_share','bonus','deduction','reimbursement')`; `period_label : VARCHAR(50)` (e.g. "2026-06" or "PRJ-2026-0001 share"); `posted_at : TIMESTAMP`; `is_reversed : BOOLEAN DEFAULT FALSE`; `reversed_by_run_id → payroll_runs.id NULL`; `notes : TEXT NULL`; `created_at`.
- **Indexes:** `idx_ph_user (user_id, posted_at)`; `idx_ph_run (run_id)`; `idx_ph_type (type)`.
- **Business rules:** once posted, only reversible by a new reversing run (never edited).

## 52. `payroll_adjustments` 🔵
- **Purpose:** Bonus/deduction overlay.
- **Columns:** `id`; `run_id → payroll_runs.id ON DELETE CASCADE`; `user_id → users.id`; `kind : ENUM('bonus','deduction','reimbursement','correction')`; `amount : DECIMAL(18,2)`; `reason : VARCHAR(255)`; `created_at`.
- **Indexes:** `idx_pa_run_user (run_id, user_id)`.

---

# M08 — Asset & Maintenance

## 53. `assets` 🟢
- **Purpose:** Trackable item.
- **Columns:** `id`; `asset_tag : VARCHAR(64)`; `name : VARCHAR(255)`; `category_id → asset_categories.id`; `serial : VARCHAR(120) NULL`; `type : ENUM('hardware','software_license','domain','hosting','subscription','other')`; `purchase_date : DATE NULL`; `purchase_cost : DECIMAL(18,2) NULL`; `currency : CHAR(3)`; `status : ENUM('in_stock','assigned','in_repair','retired') DEFAULT 'in_stock'`; `client_id → clients.id NULL` (owned-by-client); `project_id → projects.id NULL`; `license_expires_at : DATE NULL`; `notes : TEXT NULL`; audit + `deleted_at`.
- **Unique:** `uq_asset_tag (asset_tag)`.
- **Indexes:** `idx_asset_status (status)`; `idx_asset_category (category_id)`; `idx_asset_client (client_id)`; `idx_asset_license_exp (license_expires_at)`.

## 54. `asset_assignments` 🟣
- **Purpose:** Asset → project/client/user.
- **Columns:** `id`; `asset_id → assets.id ON DELETE CASCADE`; `assignable_type : VARCHAR(40)` (project|client|user); `assignable_id : BIGINT UNSIGNED`; `assigned_at : TIMESTAMP DEFAULT CURRENT_TIMESTAMP`; `returned_at : TIMESTAMP NULL`; `assigned_by → users.id NULL`; `notes : TEXT NULL`.
- **Indexes:** `idx_aa_asset (asset_id, returned_at)`; `idx_aa_subject (assignable_type, assignable_id)`.

## 55. `maintenance_tickets` 🟢
- **Purpose:** Maintenance work unit.
- **Columns:**
  - `id`; `ticket_no : VARCHAR(32)` (e.g. `MNT-2026-00001`);
  - `client_id → clients.id`; `project_id → projects.id NULL`; `mco_contract_id → mco_contracts.id NULL`; `asset_id → assets.id NULL`; `subscription_id → subscriptions.id NULL`;
  - `title : VARCHAR(255)`; `description : TEXT`;
  - `status : ENUM('open','assigned','in_progress','waiting_on_client','resolved','closed','reopened','cancelled') DEFAULT 'open'`;
  - `priority : ENUM('low','medium','high','urgent') DEFAULT 'medium'`;
  - `type : ENUM('request','incident','change','renewal') DEFAULT 'request'`;
  - `assignee_id → users.id NULL`; `sla_policy_id → sla_policies.id NULL`;
  - `due_at : TIMESTAMP NULL`; `resolved_at : TIMESTAMP NULL`; `closed_at : TIMESTAMP NULL`;
  - `first_response_at : TIMESTAMP NULL`;
  - audit + `deleted_at`.
- **Unique:** `uq_mnt_no (ticket_no)`.
- **Indexes:** `idx_mnt_client (client_id, status)`; `idx_mnt_assignee (assignee_id, status)`; `idx_mnt_mco (mco_contract_id)`; `idx_mnt_due (due_at)`; `idx_mnt_status (status)`.

## 56. `sla_policies` ⚪
- **Columns:** `id`; `name : VARCHAR(120)`; `priority : VARCHAR(32)`; `first_response_hours : INT`; `resolution_hours : INT`; `is_active : BOOLEAN DEFAULT TRUE`; audit + `deleted_at`.
- **Unique:** `uq_sla_priority (priority)`.

## 57. `asset_categories` ⚪
- **Columns:** `id`; `name : VARCHAR(120)`; `type : VARCHAR(32)`; `is_active : BOOLEAN DEFAULT TRUE`; audit + `deleted_at`.
- **Unique:** `uq_assetcat_name (name)`.

---

# M09 — Notification

## 58. `notification_templates` 🟢
- **Purpose:** Templated message per channel.
- **Columns:** `id`; `key : VARCHAR(96)` (e.g. `invoice.issued`); `channel : ENUM('whatsapp','email','discord','telegram')`; `name : VARCHAR(255)`; `subject : VARCHAR(255) NULL` (email); `body : LONGTEXT` (handlebars/liquid); `variables : JSON` (declared var names); `is_active : BOOLEAN DEFAULT TRUE`; `locale : VARCHAR(8) DEFAULT 'en'`; audit + `deleted_at`.
- **Unique:** `uq_tpl_key_channel_locale (key, channel, locale)`.
- **Indexes:** `idx_tpl_active (is_active)`.

## 59. `notifications` 🟢
- **Purpose:** Queued/sent message instance.
- **Columns:**
  - `id`; `template_id → notification_templates.id NULL`; `template_key : VARCHAR(96)`; `channel : VARCHAR(32)`;
  - `recipient_user_id → users.id NULL`; `recipient_address : VARCHAR(255)` (phone/email/webhook);
  - `subject : VARCHAR(255) NULL`; `body : LONGTEXT`; `variables : JSON`;
  - `status : ENUM('queued','sending','sent','delivered','failed','suppressed','skipped') DEFAULT 'queued'`;
  - `priority : TINYINT DEFAULT 5`; `scheduled_at : TIMESTAMP NULL`; `sent_at : TIMESTAMP NULL`; `delivered_at : TIMESTAMP NULL`; `failed_at : TIMESTAMP NULL`;
  - `external_id : VARCHAR(180) NULL`; `idempotency_key : VARCHAR(120) NULL`;
  - `subject_type : VARCHAR(50) NULL`; `subject_id : BIGINT UNSIGNED NULL` (polymorphic link to triggering entity);
  - `error : TEXT NULL`; `attempts : INT DEFAULT 0`;
  - audit.
- **Unique:** `uq_notif_idem (idempotency_key)` partial.
- **Indexes:** `idx_notif_status_scheduled (status, scheduled_at)`; `idx_notif_recipient (recipient_user_id)`; `idx_notif_subject (subject_type, subject_id)`.

## 60. `notification_logs` 🟤
- **Purpose:** Per-attempt delivery record.
- **Columns:** `id`; `notification_id → notifications.id ON DELETE CASCADE`; `attempt : INT`; `provider : VARCHAR(64)`; `status : VARCHAR(32)`; `provider_message_id : VARCHAR(180) NULL`; `request_payload : LONGTEXT NULL`; `response_payload : LONGTEXT NULL`; `error : TEXT NULL`; `duration_ms : INT NULL`; `created_at`.
- **Indexes:** `idx_nl_notif (notification_id, attempt)`.

## 61. `notification_preferences` 🔵
- **Purpose:** Per-user channel opt-in.
- **Columns:** `id`; `user_id → users.id ON DELETE CASCADE`; `template_key : VARCHAR(96) NULL` (null = global channel pref); `channel : VARCHAR(32)`; `enabled : BOOLEAN DEFAULT TRUE`; `created_at`; `updated_at`.
- **Unique:** `uq_np_user_tpl_ch (user_id, template_key, channel)`.

## 62. `notification_channels` ⚪
- **Purpose:** Provider config per channel (credentials stored as encrypted JSON).
- **Columns:** `id`; `channel : VARCHAR(32)`; `provider : VARCHAR(64)` (e.g. `twilio`, `sendgrid`, `discord_webhook`); `config : JSON` (encrypted); `is_active : BOOLEAN DEFAULT TRUE`; `is_default : BOOLEAN DEFAULT FALSE`; audit + `deleted_at`.
- **Unique:** `uq_nc_channel_provider (channel, provider)`.

---

# M10 — Knowledge Base

## 63. `articles` 🟢
- **Columns:** `id`; `slug : VARCHAR(180)`; `title : VARCHAR(255)`; `summary : VARCHAR(500) NULL`; `body : LONGTEXT`; `body_format : ENUM('markdown','html') DEFAULT 'markdown'`; `category_id → article_categories.id NULL`; `status : ENUM('draft','published','archived') DEFAULT 'draft'`; `visibility : ENUM('internal','client','public') DEFAULT 'internal'`; `author_id → users.id`; `published_at : TIMESTAMP NULL`; `current_revision_id : BIGINT UNSIGNED NULL` (self-ref to article_revisions); `view_count : INT DEFAULT 0`; `helpfulness_score : INT DEFAULT 0`; audit + `deleted_at`.
- **Unique:** `uq_art_slug (slug)`.
- **Indexes:** `idx_art_status_vis (status, visibility)`; `idx_art_category (category_id)`; `FULLTEXT ft_art_content (title, summary, body)`.

## 64. `article_revisions` 🟤
- **Columns:** `id`; `article_id → articles.id ON DELETE CASCADE`; `revision : INT`; `title : VARCHAR(255)`; `body : LONGTEXT`; `editor_id → users.id`; `change_summary : VARCHAR(255) NULL`; `created_at`.
- **Unique:** `uq_ar_article_rev (article_id, revision)`.
- **Indexes:** `idx_ar_article (article_id, revision)`.

## 65. `article_categories` ⚪
- **Columns:** `id`; `name : VARCHAR(120)`; `slug : VARCHAR(140)`; `parent_id → article_categories.id NULL`; `position : INT DEFAULT 0`; `is_active : BOOLEAN DEFAULT TRUE`; audit + `deleted_at`.
- **Unique:** `uq_artcat_slug (slug)`.
- **Indexes:** `idx_artcat_parent (parent_id)`.

## 66. `article_tags` 🟣
- **Columns:** `id`; `article_id → articles.id ON DELETE CASCADE`; `tag_id → tags.id ON DELETE CASCADE`.
- **Unique:** `uq_atat_pair (article_id, tag_id)`.
- **Indexes:** `idx_atat_tag (tag_id)`.

---

# M11 — Audit & Activity

## 67. `audit_logs` 🟤
- **Purpose:** Immutable technical trail.
- **Columns:**
  - `id`; `actor_id → users.id NULL` (null = system);
  - `action : VARCHAR(48)` (insert|update|delete|restore|login|logout|permission_change|export|view_sensitive|...);
  - `entity_type : VARCHAR(60)`; `entity_id : BIGINT UNSIGNED NULL`;
  - `before : JSON NULL`; `after : JSON NULL`; `diff : JSON NULL`;
  - `ip_address : VARCHAR(45) NULL`; `user_agent : VARCHAR(500) NULL`; `route : VARCHAR(255) NULL`; `method : VARCHAR(10) NULL`;
  - `result : ENUM('success','failure') DEFAULT 'success'`; `error : TEXT NULL`;
  - `occurred_at : TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`.
- **Indexes:** `idx_audit_actor_time (actor_id, occurred_at)`; `idx_audit_entity (entity_type, entity_id, occurred_at)`; `idx_audit_action_time (action, occurred_at)`; `idx_audit_time (occurred_at)`.
- **Business rules:** **append-only**; no UPDATE/DELETE except admin break-glass (which itself writes an audit row).

## 68. `activity_timeline` 🟤
- **Purpose:** Human-readable business feed.
- **Columns:**
  - `id`; `actor_id → users.id NULL`;
  - `verb : VARCHAR(64)` (e.g. `issued`, `closed`, `converted`); `verb_subject : VARCHAR(64)` (e.g. `invoice`);
  - `entity_type : VARCHAR(60)`; `entity_id : BIGINT UNSIGNED`;
  - `project_id → projects.id NULL`; `client_id → clients.id NULL`;
  - `description : VARCHAR(500)` (pre-rendered human text); `metadata : JSON NULL`;
  - `is_public : BOOLEAN DEFAULT FALSE` (visible to client?);
  - `occurred_at : TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`.
- **Indexes:** `idx_act_project_time (project_id, occurred_at)`; `idx_act_client_time (client_id, occurred_at)`; `idx_act_entity (entity_type, entity_id)`; `idx_act_actor (actor_id, occurred_at)`; `idx_act_time (occurred_at)`.
- **Business rules:** append-only; description rendered at creation time (denormalized for fast reads).

---

# M12 — Platform / System

## 69. `tags` 🟢
- **Columns:** `id`; `name : VARCHAR(60)`; `slug : VARCHAR(80)`; `color : VARCHAR(9) NULL` (hex); `scope : VARCHAR(40) NULL` (optional namespace, e.g. `project`); audit + `deleted_at`.
- **Unique:** `uq_tag_slug_scope (slug, scope)`.
- **Indexes:** `idx_tag_scope (scope)`.

## 70. `taggables` 🟣
- **Purpose:** Polymorphic tag attach.
- **Columns:** `id`; `tag_id → tags.id ON DELETE CASCADE`; `taggable_type : VARCHAR(50)`; `taggable_id : BIGINT UNSIGNED`; `created_at`.
- **Unique:** `uq_taggable (tag_id, taggable_type, taggable_id)`.
- **Indexes:** `idx_tg_subject (taggable_type, taggable_id)`; `idx_tg_tag (tag_id)`.

## 71. `attachments` 🟢
- **Purpose:** File attached to anything.
- **Columns:** `id`; `attachable_type : VARCHAR(50)`; `attachable_id : BIGINT UNSIGNED`; `file_name : VARCHAR(255)`; `mime : VARCHAR(100)`; `size_bytes : BIGINT`; `storage_provider : VARCHAR(32)` (local|s3|...); `storage_key : VARCHAR(500)`; `url : VARCHAR(1000)`; `is_private : BOOLEAN DEFAULT FALSE`; `uploaded_by → users.id`; audit + `deleted_at`.
- **Indexes:** `idx_att_subject (attachable_type, attachable_id)`; `idx_att_storage (storage_provider, storage_key)`.

## 72. `comments` 🔵
- **Purpose:** Threadable, polymorphic.
- **Columns:** `id`; `commentable_type : VARCHAR(50)`; `commentable_id : BIGINT UNSIGNED`; `author_id → users.id`; `parent_id → comments.id NULL`; `body : TEXT`; `is_internal : BOOLEAN DEFAULT FALSE` (staff-only note vs client-visible); `edited_at : TIMESTAMP NULL`; audit + `deleted_at`.
- **Indexes:** `idx_cmt_subject (commentable_type, commentable_id, created_at)`; `idx_cmt_parent (parent_id)`; `idx_cmt_author (author_id)`.

## 73. `reminders` 🔵
- **Purpose:** Time-based reminder.
- **Columns:** `id`; `subject_type : VARCHAR(50)`; `subject_id : BIGINT UNSIGNED`; `title : VARCHAR(255)`; `body : TEXT NULL`; `remind_at : TIMESTAMP NOT NULL`; `timezone : VARCHAR(64) DEFAULT 'UTC'`; `status : ENUM('pending','fired','snoozed','dismissed','cancelled') DEFAULT 'pending'`; `snoozed_until : TIMESTAMP NULL`; `assignee_id → users.id NULL`; `created_by → users.id`; audit + `deleted_at`.
- **Indexes:** `idx_rem_pending (status, remind_at)`; `idx_rem_subject (subject_type, subject_id)`; `idx_rem_assignee (assignee_id)`.

## 74. `settings` ⚪
- **Purpose:** Typed config.
- **Columns:** `id`; `key : VARCHAR(120)`; `value : TEXT NULL`; `type : ENUM('string','integer','decimal','boolean','json','enum') DEFAULT 'string'`; `category : VARCHAR(60)`; `is_public : BOOLEAN DEFAULT FALSE`; `description : VARCHAR(255) NULL`; audit.
- **Unique:** `uq_setting_key (key)`.
- **Indexes:** `idx_setting_category (category)`.

## 75. `number_sequences` ⚪
- **Purpose:** Document-number generator.
- **Columns:** `id`; `entity_type : VARCHAR(40)` (invoice|project|quotation|...); `prefix : VARCHAR(8)` (INV, PRJ, QUO...); `next_value : BIGINT NOT NULL DEFAULT 1`; `padding : TINYINT NOT NULL DEFAULT 5`; `reset_frequency : ENUM('never','yearly','monthly') DEFAULT 'yearly'`; `last_reset_at : DATE`; `current_year : INT NULL`; `is_active : BOOLEAN DEFAULT TRUE`; audit.
- **Unique:** `uq_seq_entity_prefix (entity_type, prefix)`.
- **Business rules:** allocation under row-level lock; (tenant_id added in future to make sequences tenant-scoped).

## 76. `enum_values` ⚪
- **Purpose:** Config-driven status/category catalog (so labels/colors are editable without code).
- **Columns:** `id`; `group : VARCHAR(60)` (e.g. `task.status`); `value : VARCHAR(60)`; `label : VARCHAR(120)`; `color : VARCHAR(9) NULL`; `position : INT DEFAULT 0`; `is_system : BOOLEAN DEFAULT FALSE`; `is_active : BOOLEAN DEFAULT TRUE`; audit + `deleted_at`.
- **Unique:** `uq_enum_group_value (group, value)`.
- **Indexes:** `idx_enum_group (group, is_active, position)`.

---

## Summary of cross-entity invariant enforcement locations

| Invariant | Enforced in |
|---|---|
| Money totals consistency (invoice/quotation) | Service recompute + DB trigger (belt & braces) |
| Paid amount ≤ invoice total | Service with row lock on allocations |
| User has ≥1 role when active | `UserService.activate()` |
| Contract signed_at ≤ start_date | Validation + DB CHECK |
| Lead stage transitions | `LeadService.transition()` allow-list |
| Append-only audit/activity | Repository layer (no update/delete API) |
| Document numbers unique & gapless | `NumberSequenceService` row lock |
| Payroll posted → immutable | `PayrollHistoryService` write-once |
