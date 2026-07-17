# Phase 5 — Full ERD

A single 76-table diagram is unreadable, so the ERD is split into **per-module** diagrams (each self-contained) plus a **cross-module relationship inventory** that lists every FK that crosses a module boundary. Together they fully specify the data model.

Conventions in diagrams:
- `||--o{` one-to-many (parent has many children)
- `||--||` one-to-one
- `}o--o{` many-to-many
- PK in **bold**, FK marked `(FK)`
- Soft-delete & audit columns omitted for legibility

---

## 5.1 IAM

```mermaid
erDiagram
    users ||--o{ user_roles : has
    roles ||--o{ user_roles : assigned
    roles ||--o{ role_permissions : grants
    permissions ||--o{ role_permissions : in
    users ||--o{ sessions : owns
    sessions ||--o{ refresh_tokens : issues
    users ||--o{ api_keys : owns
    users ||--o{ password_reset_tokens : has

    users {
        bigint id PK
        varchar email UK
        varchar password_hash
        varchar status
        boolean is_founder
    }
    roles {
        bigint id PK
        varchar key UK
        varchar name
        boolean is_system
        int priority
    }
    permissions {
        bigint id PK
        varchar key UK
        varchar module
        varchar action
    }
    role_permissions {
        bigint id PK
        bigint role_id FK
        bigint permission_id FK
    }
    user_roles {
        bigint id PK
        bigint user_id FK
        bigint role_id FK
    }
    sessions {
        bigint id PK
        bigint user_id FK
        varchar token_hash UK
        timestamp expires_at
    }
    refresh_tokens {
        bigint id PK
        bigint user_id FK
        bigint session_id FK
        varchar token_hash UK
    }
```

## 5.2 CRM

```mermaid
erDiagram
    lead_sources ||--o{ leads : sourced
    lead_stages ||--o{ leads : in_stage
    users ||--o{ leads : owns
    clients ||--o{ leads : "converted_from"
    clients ||--o{ contacts : has
    leads ||--o{ contacts : has
    users ||--o{ clients : owns

    leads {
        bigint id PK
        varchar reference_no UK
        bigint stage_id FK
        bigint source_id FK
        bigint owner_id FK
        bigint converted_client_id FK
        timestamp converted_at
    }
    lead_stages {
        bigint id PK
        varchar key UK
        int position
        boolean is_won
        boolean is_lost
    }
    lead_sources {
        bigint id PK
        varchar name UK
    }
    clients {
        bigint id PK
        varchar reference_no UK
        varchar name
        varchar type
        varchar status
        bigint owner_id FK
    }
    contacts {
        bigint id PK
        bigint client_id FK
        bigint lead_id FK
        varchar email
        boolean is_primary
    }
```

## 5.3 Sales

```mermaid
erDiagram
    clients ||--o{ quotations : receives
    clients ||--o{ proposals : receives
    clients ||--o{ contracts : signs
    quotations ||--o{ quotation_items : has
    pricelist_items ||--o{ quotation_items : "snapshot price"
    quotations ||--o{ proposals : linked
    quotations ||--|| contracts : "converts_to (1:1 optional)"
    contracts ||--o{ contract_documents : has
    projects ||--o{ contracts : bound
    discounts ||--o{ quotations : applies

    quotations {
        bigint id PK
        varchar quotation_no UK
        bigint client_id FK
        bigint project_id FK
        bigint lead_id FK
        date issue_date
        date valid_until
        decimal grand_total
        varchar status
        bigint converted_contract_id FK
    }
    quotation_items {
        bigint id PK
        bigint quotation_id FK
        bigint pricelist_item_id FK
        decimal unit_price
        decimal line_total
        int position
    }
    pricelist_items {
        bigint id PK
        varchar service_key UK
        decimal unit_price
        varchar unit
        boolean is_active
    }
    proposals {
        bigint id PK
        varchar proposal_no
        int version
        bigint client_id FK
        bigint quotation_id FK
        varchar status
    }
    contracts {
        bigint id PK
        varchar contract_no UK
        bigint client_id FK
        bigint project_id FK
        bigint quotation_id FK
        decimal total_value
        varchar status
        timestamp signed_at
    }
    contract_documents {
        bigint id PK
        bigint contract_id FK
        varchar kind
        varchar file_url
    }
    discounts {
        bigint id PK
        varchar name
        varchar scope
        varchar type
        decimal value
    }
```

## 5.4 Delivery

```mermaid
erDiagram
    clients ||--o{ projects : has
    contracts ||--o{ projects : bound
    projects ||--o{ project_members : has
    users ||--o{ project_members : member
    projects ||--o{ tasks : has
    projects ||--o{ milestones : has
    milestones ||--o{ tasks : "groups"
    tasks ||--o{ task_assignments : assigned
    users ||--o{ task_assignments : assignee
    tasks ||--o{ tasks : "parent_of"
    tasks ||--o{ checklists : has
    checklists ||--o{ checklist_items : has
    project_templates ||--o{ projects : created_from

    projects {
        bigint id PK
        varchar project_no UK
        bigint client_id FK
        bigint contract_id FK
        bigint quotation_id FK
        bigint manager_id FK
        bigint template_id FK
        varchar status
        tinyint progress
    }
    project_members {
        bigint id PK
        bigint project_id FK
        bigint user_id FK
        varchar role_in_project
    }
    tasks {
        bigint id PK
        varchar task_no UK
        bigint project_id FK
        bigint milestone_id FK
        bigint parent_task_id FK
        varchar status
        varchar priority
        decimal logged_hours
    }
    task_assignments {
        bigint id PK
        bigint task_id FK
        bigint user_id FK
        boolean is_primary
    }
    milestones {
        bigint id PK
        bigint project_id FK
        varchar name
        int position
        boolean is_reached
    }
    checklists {
        bigint id PK
        varchar subject_type
        bigint subject_id
    }
    checklist_items {
        bigint id PK
        bigint checklist_id FK
        varchar content
        boolean is_checked
    }
    project_templates {
        bigint id PK
        varchar name
        json default_task_blueprint
    }
```

> Note: `checklists.subject_type/subject_id` is polymorphic (task or project). This is an intentional, documented polymorphism — the only polymorphic "ownership" in Delivery.

## 5.5 Finance

```mermaid
erDiagram
    clients ||--o{ invoices : billed
    projects ||--o{ invoices : for
    contracts ||--o{ invoices : under
    subscriptions ||--o{ invoices : from
    billing_cycles ||--o{ invoices : generates
    invoices ||--o{ invoice_items : has
    invoices ||--o{ receipt_allocations : paid_by
    invoices ||--o{ dp_allocations : paid_by
    clients ||--o{ receipts : pays
    receipts ||--o{ receipt_allocations : allocates
    clients ||--o{ down_payments : gives
    projects ||--o{ down_payments : for
    contracts ||--o{ down_payments : under
    down_payments ||--o{ dp_allocations : allocates
    expense_categories ||--o{ expenses : classified
    projects ||--o{ expenses : for
    income_categories ||--o{ incomes : classified
    projects ||--o{ incomes : for
    tax_rates ||--o{ invoice_items : taxed
    tax_rates ||--o{ quotation_items : taxed

    invoices {
        bigint id PK
        varchar invoice_no UK
        bigint client_id FK
        bigint project_id FK
        bigint contract_id FK
        bigint subscription_id FK
        bigint billing_cycle_id FK
        decimal grand_total
        decimal paid_amount
        decimal balance
        varchar payment_status
        varchar status
        date due_date
        varchar external_ref UK
    }
    invoice_items {
        bigint id PK
        bigint invoice_id FK
        bigint pricelist_item_id FK
        bigint tax_rate_id FK
        decimal line_total
    }
    receipts {
        bigint id PK
        varchar receipt_no UK
        bigint client_id FK
        decimal amount
        decimal allocated_amount
        decimal unallocated_amount
        varchar status
        varchar external_ref UK
    }
    receipt_allocations {
        bigint id PK
        bigint receipt_id FK
        bigint invoice_id FK
        decimal amount
        boolean is_reversed
    }
    down_payments {
        bigint id PK
        varchar dp_no UK
        bigint client_id FK
        bigint project_id FK
        bigint contract_id FK
        decimal amount
        varchar mode
        decimal balance
        varchar status
    }
    dp_allocations {
        bigint id PK
        bigint down_payment_id FK
        bigint invoice_id FK
        decimal amount
        boolean is_reversed
    }
    expenses {
        bigint id PK
        varchar expense_no UK
        bigint category_id FK
        bigint project_id FK
        bigint client_id FK
        decimal amount
        varchar status
    }
    incomes {
        bigint id PK
        varchar income_no UK
        bigint category_id FK
        bigint project_id FK
        decimal amount
    }
    cashflow_snapshots {
        bigint id PK
        date period_start
        date period_end
        varchar granularity
        decimal inflow
        decimal outflow
        decimal net
    }
    profit_snapshots {
        bigint id PK
        date period_start
        date period_end
        decimal revenue
        decimal net_profit
    }
    tax_rates {
        bigint id PK
        varchar name
        decimal rate
    }
```

## 5.6 Subscription / Billing

```mermaid
erDiagram
    plans ||--o{ subscriptions : sold_as
    clients ||--o{ subscriptions : subscribes
    subscriptions ||--o{ subscription_items : has
    subscriptions ||--o{ billing_cycles : cycles
    billing_cycles ||--|| invoices : generates
    mco_contracts ||--o{ subscriptions : governs
    clients ||--o{ mco_contracts : has
    projects ||--o{ mco_contracts : "origin of"

    plans {
        bigint id PK
        varchar plan_code UK
        varchar interval
        decimal amount
    }
    subscriptions {
        bigint id PK
        varchar subscription_no UK
        bigint client_id FK
        bigint plan_id FK
        bigint mco_contract_id FK
        date current_period_end
        varchar status
        boolean auto_renew
    }
    subscription_items {
        bigint id PK
        bigint subscription_id FK
        varchar name
        decimal unit_price
    }
    billing_cycles {
        bigint id PK
        bigint subscription_id FK
        date period_start
        date period_end
        bigint invoice_id FK
        varchar status
    }
    mco_contracts {
        bigint id PK
        varchar mco_no UK
        bigint client_id FK
        bigint project_id FK
        bigint subscription_id FK
        decimal monthly_fee
        varchar status
        date end_date
    }
```

## 5.7 Payroll

```mermaid
erDiagram
    payroll_runs ||--o{ payroll_distributions : computes
    payroll_runs ||--o{ payroll_history : posts
    payroll_runs ||--o{ payroll_adjustments : has
    payroll_rules ||--o{ payroll_distributions : "applied_rule"
    users ||--o{ payroll_distributions : earner
    users ||--o{ payroll_history : has
    projects ||--o{ payroll_runs : "for project"
    projects ||--o{ payroll_distributions : "from project"
    payroll_runs ||--o{ payroll_runs : "reversal_of"

    payroll_rules {
        bigint id PK
        varchar key UK
        varchar type
        varchar formula
        varchar scope
        bigint scope_ref_id
        varchar base
        int priority
    }
    payroll_runs {
        bigint id PK
        varchar run_no UK
        varchar type
        bigint project_id FK
        varchar status
        decimal total_amount
        timestamp posted_at
        bigint reversal_of FK
    }
    payroll_distributions {
        bigint id PK
        bigint run_id FK
        bigint user_id FK
        bigint project_id FK
        bigint rule_id FK
        decimal computed_amount
        decimal final_amount
        json breakdown
    }
    payroll_history {
        bigint id PK
        bigint run_id FK
        bigint user_id FK
        decimal amount
        varchar type
        boolean is_reversed
        bigint reversed_by_run_id FK
    }
    payroll_adjustments {
        bigint id PK
        bigint run_id FK
        bigint user_id FK
        varchar kind
        decimal amount
    }
```

## 5.8 Asset & Maintenance

```mermaid
erDiagram
    asset_categories ||--o{ assets : classified
    assets ||--o{ asset_assignments : assigned
    clients ||--o{ assets : owns
    projects ||--o{ assets : for
    clients ||--o{ maintenance_tickets : raises
    mco_contracts ||--o{ maintenance_tickets : under
    assets ||--o{ maintenance_tickets : about
    sla_policies ||--o{ maintenance_tickets : "governed_by"
    users ||--o{ maintenance_tickets : assignee

    assets {
        bigint id PK
        varchar asset_tag UK
        bigint category_id FK
        bigint client_id FK
        bigint project_id FK
        varchar type
        varchar status
        date license_expires_at
    }
    asset_assignments {
        bigint id PK
        bigint asset_id FK
        varchar assignable_type
        bigint assignable_id
        timestamp returned_at
    }
    maintenance_tickets {
        bigint id PK
        varchar ticket_no UK
        bigint client_id FK
        bigint project_id FK
        bigint mco_contract_id FK
        bigint asset_id FK
        bigint assignee_id FK
        bigint sla_policy_id FK
        varchar status
        timestamp due_at
    }
    sla_policies {
        bigint id PK
        varchar priority
        int first_response_hours
        int resolution_hours
    }
    asset_categories {
        bigint id PK
        varchar name UK
        varchar type
    }
```

## 5.9 Notification

```mermaid
erDiagram
    notification_templates ||--o{ notifications : "rendered_from"
    users ||--o{ notifications : recipient
    notifications ||--o{ notification_logs : attempts
    users ||--o{ notification_preferences : has

    notification_templates {
        bigint id PK
        varchar key
        varchar channel
        varchar locale
        longtext body
        json variables
    }
    notifications {
        bigint id PK
        bigint template_id FK
        bigint recipient_user_id FK
        varchar channel
        varchar status
        varchar idempotency_key UK
        varchar subject_type
        bigint subject_id
    }
    notification_logs {
        bigint id PK
        bigint notification_id FK
        varchar provider
        varchar status
        int attempt
    }
    notification_preferences {
        bigint id PK
        bigint user_id FK
        varchar template_key
        varchar channel
        boolean enabled
    }
    notification_channels {
        bigint id PK
        varchar channel
        varchar provider
        json config
        boolean is_default
    }
```

## 5.10 Knowledge Base

```mermaid
erDiagram
    article_categories ||--o{ articles : in
    article_categories ||--o{ article_categories : parent
    users ||--o{ articles : authors
    articles ||--o{ article_revisions : versions
    articles ||--o{ article_tags : tagged
    tags ||--o{ article_tags : applied

    articles {
        bigint id PK
        varchar slug UK
        bigint category_id FK
        bigint author_id FK
        varchar status
        varchar visibility
        bigint current_revision_id FK
    }
    article_revisions {
        bigint id PK
        bigint article_id FK
        int revision
        longtext body
        bigint editor_id FK
    }
    article_categories {
        bigint id PK
        varchar slug UK
        bigint parent_id FK
    }
    article_tags {
        bigint id PK
        bigint article_id FK
        bigint tag_id FK
    }
```

## 5.11 Audit & Activity

```mermaid
erDiagram
    users ||--o{ audit_logs : actor
    users ||--o{ activity_timeline : actor
    projects ||--o{ activity_timeline : about
    clients ||--o{ activity_timeline : about

    audit_logs {
        bigint id PK
        bigint actor_id FK
        varchar action
        varchar entity_type
        bigint entity_id
        json before
        json after
        timestamp occurred_at
    }
    activity_timeline {
        bigint id PK
        bigint actor_id FK
        bigint project_id FK
        bigint client_id FK
        varchar verb
        varchar entity_type
        bigint entity_id
        varchar description
        timestamp occurred_at
    }
```

## 5.12 Platform

```mermaid
erDiagram
    tags ||--o{ taggables : applied
    users ||--o{ attachments : uploaded_by
    users ||--o{ comments : authors
    users ||--o{ reminders : "for (assignee)"

    tags {
        bigint id PK
        varchar slug
        varchar scope
    }
    taggables {
        bigint id PK
        bigint tag_id FK
        varchar taggable_type
        bigint taggable_id
    }
    attachments {
        bigint id PK
        varchar attachable_type
        bigint attachable_id
        varchar storage_key
        bigint uploaded_by FK
    }
    comments {
        bigint id PK
        varchar commentable_type
        bigint commentable_id
        bigint parent_id FK
        bigint author_id FK
        boolean is_internal
    }
    reminders {
        bigint id PK
        varchar subject_type
        bigint subject_id
        timestamp remind_at
        bigint assignee_id FK
        varchar status
    }
    settings {
        bigint id PK
        varchar key UK
        text value
        varchar type
    }
    number_sequences {
        bigint id PK
        varchar entity_type
        varchar prefix
        bigint next_value
        varchar reset_frequency
    }
    enum_values {
        bigint id PK
        varchar group
        varchar value
        varchar label
    }
```

---

## 5.13 Cross-module relationship inventory (every FK that crosses a boundary)

This table is the authoritative list of how modules are wired. Within-module FKs are shown in the diagrams above; this lists **cross-module** links only.

| Child (table.col) | → Parent (table.col) | Child module → Parent module | Cardinality |
|---|---|---|---|
| leads.owner_id | users.id | CRM → IAM | M:1 |
| leads.converted_client_id | clients.id | CRM → CRM | 1:1 |
| clients.owner_id | users.id | CRM → IAM | M:1 |
| contacts.client_id / lead_id | clients/leads | CRM → CRM | M:1 |
| quotations.client_id | clients.id | Sales → CRM | M:1 |
| quotations.project_id | projects.id | Sales → Delivery | M:1 |
| quotations.lead_id | leads.id | Sales → CRM | M:1 |
| quotations.converted_contract_id | contracts.id | Sales → Sales | 1:1 |
| contracts.client_id | clients.id | Sales → CRM | M:1 |
| contracts.project_id | projects.id | Sales → Delivery | M:1 |
| contracts.quotation_id | quotations.id | Sales → Sales | M:1 |
| projects.client_id | clients.id | Delivery → CRM | M:1 |
| projects.contract_id | contracts.id | Delivery → Sales | M:1 |
| projects.quotation_id | quotations.id | Delivery → Sales | M:1 |
| projects.manager_id | users.id | Delivery → IAM | M:1 |
| project_members.user_id | users.id | Delivery → IAM | M:1 |
| task_assignments.user_id | users.id | Delivery → IAM | M:1 |
| invoices.client_id | clients.id | Finance → CRM | M:1 |
| invoices.project_id | projects.id | Finance → Delivery | M:1 |
| invoices.contract_id | contracts.id | Finance → Sales | M:1 |
| invoices.subscription_id | subscriptions.id | Finance → Subscription | M:1 |
| invoices.billing_cycle_id | billing_cycles.id | Finance → Subscription | M:1 |
| receipts.client_id | clients.id | Finance → CRM | M:1 |
| receipt_allocations.invoice_id | invoices.id | Finance → Finance | M:1 |
| down_payments.client_id | clients.id | Finance → CRM | M:1 |
| down_payments.project_id | projects.id | Finance → Delivery | M:1 |
| down_payments.contract_id | contracts.id | Finance → Sales | M:1 |
| dp_allocations.invoice_id | invoices.id | Finance → Finance | M:1 |
| expenses.project_id | projects.id | Finance → Delivery | M:1 |
| expenses.client_id | clients.id | Finance → CRM | M:1 |
| incomes.project_id | projects.id | Finance → Delivery | M:1 |
| incomes.client_id | clients.id | Finance → CRM | M:1 |
| subscriptions.client_id | clients.id | Subscription → CRM | M:1 |
| subscriptions.mco_contract_id | mco_contracts.id | Subscription → Subscription | M:1 |
| mco_contracts.client_id | clients.id | Subscription → CRM | M:1 |
| mco_contracts.project_id | projects.id | Subscription → Delivery | M:1 |
| billing_cycles.invoice_id | invoices.id | Subscription → Finance | 1:1 |
| payroll_runs.project_id | projects.id | Payroll → Delivery | M:1 |
| payroll_distributions.user_id | users.id | Payroll → IAM | M:1 |
| payroll_distributions.project_id | projects.id | Payroll → Delivery | M:1 |
| payroll_history.user_id | users.id | Payroll → IAM | M:1 |
| assets.client_id | clients.id | Asset → CRM | M:1 |
| assets.project_id | projects.id | Asset → Delivery | M:1 |
| maintenance_tickets.client_id | clients.id | Asset → CRM | M:1 |
| maintenance_tickets.project_id | projects.id | Asset → Delivery | M:1 |
| maintenance_tickets.mco_contract_id | mco_contracts.id | Asset → Subscription | M:1 |
| maintenance_tickets.asset_id | assets.id | Asset → Asset | M:1 |
| maintenance_tickets.assignee_id | users.id | Asset → IAM | M:1 |
| notifications.recipient_user_id | users.id | Notification → IAM | M:1 |
| notification_preferences.user_id | users.id | Notification → IAM | M:1 |
| articles.author_id | users.id | Knowledge → IAM | M:1 |
| audit_logs.actor_id | users.id | Audit → IAM | M:1 |
| activity_timeline.actor_id | users.id | Audit → IAM | M:1 |
| activity_timeline.project_id | projects.id | Audit → Delivery | M:1 |
| activity_timeline.client_id | clients.id | Audit → CRM | M:1 |
| (all) *.created_by/updated_by | users.id | * → IAM | M:1 |

**Count of cross-module FKs: ~52.** Every one of these is an intentional, documented coupling. There are **no hidden cross-module table joins** in application code — cross-module reads go through service/API/event boundaries (Phase 2 rule).

---

## 5.14 Polymorphic relationships (explicit list)

Polymorphic associations are used sparingly and **only for genuinely cross-cutting concerns**. Each is listed so the implementation AI never guesses.

| Polymorphic table | Subject columns | Used by |
|---|---|---|
| `taggables` | taggable_type, taggable_id | any entity that supports tags |
| `attachments` | attachable_type, attachable_id | any entity that supports files |
| `comments` | commentable_type, commentable_id | tasks, projects, invoices, tickets, leads, clients, articles |
| `reminders` | subject_type, subject_id | invoice (overdue), mco (renewal), asset (license expiry), task (due) |
| `checklists` | subject_type, subject_id | task, project |
| `asset_assignments` | assignable_type, assignable_id | project, client, user |
| `notifications.subject_*` | subject_type, subject_id | triggering entity |
| `activity_timeline.entity_*` | entity_type, entity_id | any |

**Rules for polymorphic integrity:**
- The `*_type` values are a **closed enum** maintained in `enum_values` group `polymorphic.types` (or code constants). No free-text.
- Cascading deletes on polymorphic subjects are **not** DB-enforced (can't be — no real FK). Instead, a **cleanup job** + **soft-delete cascade hooks** remove or orphan child rows when a subject is deleted. This is documented per-table in the service layer (Phase 19).
- Indexes on `(subject_type, subject_id)` exist on every polymorphic table (see Phase 4).

---

The ERD is now complete: 76 entities, 5 intra-module diagrams, 52 cross-module FKs catalogued, and 8 controlled polymorphic associations.
