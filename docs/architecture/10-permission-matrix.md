# Phase 10 — Permission Matrix

> **RBAC model:** Users have **one or more roles**; their effective permission set is the **union (merge)** of all roles' permissions. The **Founder is Super Admin** and bypasses all checks.

---

## 10.1 Permission key format

```
<module>.<action>[.<scope>]
```
- `module`: crm, sales, delivery, finance, subscription, payroll, asset, notification, knowledge, audit, activity, platform, iam.
- `action`: `view | create | update | delete | export | approve | manage` (plus custom per module).
- The brief mandates these 8 action types: **View, Create, Update, Delete, Export, Approve, Manage, Custom**.

### Action semantics (applied uniformly)
| Action | Meaning |
|---|---|
| `view` | Read / list / show. |
| `create` | Make new. |
| `update` | Edit existing (non-state-transition fields). |
| `delete` | Soft-delete / void / cancel. |
| `export` | Bulk export (CSV/PDF) of data. |
| `approve` | Move a record across a **gating** boundary (issue invoice, sign contract, post payroll, approve expense). Distinct from `update` because it has financial/legal weight. |
| `manage` | Power actions: restore, merge, blacklist, terminate, configure, assign roles, etc. The "admin lever" on a module. |
| `custom` | Module-specific (e.g., `task.transition`, `payroll.post`, `payroll.reverse`). Listed below. |

---

## 10.2 Default roles (seed)

| Role key | Description |
|---|---|
| `super_admin` | Founder/system. Implicit all-permissions bypass. |
| `admin` | Full operational access, no security-sensitive IAM changes. |
| `manager` | Project/delivery manager + reporting. |
| `sales` | CRM + Sales modules. |
| `finance` | Finance + Payroll. |
| `hr` | Payroll + IAM (users). |
| `developer` | Delivery (own tasks/projects) + KB. |
| `viewer` | Read-only across non-sensitive modules. |

Roles are editable; these are sensible defaults. A user may hold several (e.g., a dev who also sells → `developer` + `sales`).

---

## 10.3 The full matrix

Legend: ● granted, ○ not granted, ★ = `manage` (implicitly grants view/update). Super Admin = all ●.

### IAM (users/roles/permissions/api-keys)
| Action key | super | admin | manager | sales | finance | hr | developer | viewer |
|---|---|---|---|---|---|---|---|---|
| `user.view` | ● | ● | ● | ● | ● | ● | ● | ● |
| `user.create` | ● | ● | ○ | ○ | ○ | ● | ○ | ○ |
| `user.update` | ● | ● | ○ | ○ | ○ | ● | ○ | ○ |
| `user.delete` | ● | ● | ○ | ○ | ○ | ● | ○ | ○ |
| `user.manage` | ● | ● | ○ | ○ | ○ | ● | ○ | ○ |
| `user.permission_change` | ● | ● | ○ | ○ | ○ | ● | ○ | ○ |
| `user.export` | ● | ● | ○ | ○ | ○ | ● | ○ | ○ |
| `role.view` | ● | ● | ○ | ○ | ○ | ● | ○ | ○ |
| `role.create` | ● | ● | ○ | ○ | ○ | ○ | ○ | ○ |
| `role.update` | ● | ● | ○ | ○ | ○ | ○ | ○ | ○ |
| `role.delete` | ● | ● | ○ | ○ | ○ | ○ | ○ | ○ |
| `role.permission_change` | ● | ● | ○ | ○ | ○ | ○ | ○ | ○ |
| `permission.view` | ● | ● | ● | ○ | ○ | ● | ○ | ○ |
| `apikey.view/create/delete` | ● | ● | ○ | ○ | ○ | ○ | ○ | ○ |

### CRM (leads/clients/contacts)
| Action key | super | admin | manager | sales | finance | hr | developer | viewer |
|---|---|---|---|---|---|---|---|---|
| `lead.view` | ● | ● | ● | ● | ○ | ○ | ○ | ● |
| `lead.create` | ● | ● | ○ | ● | ○ | ○ | ○ | ○ |
| `lead.update` | ● | ● | ○ | ● | ○ | ○ | ○ | ○ |
| `lead.delete` | ● | ● | ○ | ● | ○ | ○ | ○ | ○ |
| `lead.manage` | ● | ● | ● | ● | ○ | ○ | ○ | ○ |
| `lead.export` | ● | ● | ● | ● | ○ | ○ | ○ | ○ |
| `client.view` | ● | ● | ● | ● | ● | ○ | ○ | ● |
| `client.create` | ● | ● | ○ | ● | ○ | ○ | ○ | ○ |
| `client.update` | ● | ● | ○ | ● | ○ | ○ | ○ | ○ |
| `client.delete` | ● | ● | ○ | ● | ○ | ○ | ○ | ○ |
| `client.manage` | ● | ● | ● | ● | ○ | ○ | ○ | ○ |
| `client.export` | ● | ● | ● | ● | ● | ○ | ○ | ○ |

### Sales (pricelist/quotation/proposal/contract)
| Action key | super | admin | manager | sales | finance | hr | developer | viewer |
|---|---|---|---|---|---|---|---|---|
| `pricelist.view` | ● | ● | ● | ● | ● | ○ | ○ | ● |
| `pricelist.create/update` | ● | ● | ○ | ● | ○ | ○ | ○ | ○ |
| `pricelist.delete` | ● | ● | ○ | ○ | ○ | ○ | ○ | ○ |
| `quotation.view` | ● | ● | ● | ● | ● | ○ | ○ | ● |
| `quotation.create` | ● | ● | ○ | ● | ○ | ○ | ○ | ○ |
| `quotation.update` | ● | ● | ○ | ● | ○ | ○ | ○ | ○ |
| `quotation.delete` | ● | ● | ○ | ● | ○ | ○ | ○ | ○ |
| `quotation.approve` | ● | ● | ● | ● | ○ | ○ | ○ | ○ |
| `quotation.manage` | ● | ● | ● | ● | ○ | ○ | ○ | ○ |
| `quotation.export` | ● | ● | ● | ● | ● | ○ | ○ | ○ |
| `proposal.view/create/update/delete/approve` | ● | ● | ● | ● | ○ | ○ | ○ | ○/●(view) |
| `contract.view` | ● | ● | ● | ● | ● | ○ | ○ | ● |
| `contract.create/update` | ● | ● | ○ | ● | ○ | ○ | ○ | ○ |
| `contract.delete` | ● | ● | ○ | ● | ○ | ○ | ○ | ○ |
| `contract.approve` (sign) | ● | ● | ● | ● | ○ | ○ | ○ | ○ |
| `contract.manage` (terminate) | ● | ● | ● | ● | ○ | ○ | ○ | ○ |

### Delivery (projects/tasks/milestones)
| Action key | super | admin | manager | sales | finance | hr | developer | viewer |
|---|---|---|---|---|---|---|---|---|
| `project.view` | ● | ● | ● | ● | ● | ○ | ● | ● |
| `project.create` | ● | ● | ● | ○ | ○ | ○ | ○ | ○ |
| `project.update` | ● | ● | ● | ○ | ○ | ○ | ○(own) | ○ |
| `project.delete` | ● | ● | ● | ○ | ○ | ○ | ○ | ○ |
| `project.manage` (start/hold/cancel) | ● | ● | ● | ○ | ○ | ○ | ○ | ○ |
| `project.approve` (complete) | ● | ● | ● | ○ | ○ | ○ | ○ | ○ |
| `project.export` | ● | ● | ● | ○ | ○ | ○ | ● | ○ |
| `task.view` | ● | ● | ● | ○ | ○ | ○ | ● | ● |
| `task.create` | ● | ● | ● | ○ | ○ | ○ | ● | ○ |
| `task.update` | ● | ● | ● | ○ | ○ | ○ | ●(own) | ○ |
| `task.delete` | ● | ● | ● | ○ | ○ | ○ | ○ | ○ |
| `task.transition` (custom) | ● | ● | ● | ○ | ○ | ○ | ●(own) | ○ |

> **"own" scoping note:** For developers, `task.update`/`task.transition` are scoped to tasks where they're an assignee or project member. This is the one place we need **scoped permissions**. Implementation: the permission check returns true, then the service additionally enforces ownership. (Future: encode as `task.update.own` vs `task.update.any`; today, service-layer scoping.)

### Finance (invoices/receipts/DP/expenses/incomes/reports)
| Action key | super | admin | manager | sales | finance | hr | developer | viewer |
|---|---|---|---|---|---|---|---|---|
| `invoice.view` | ● | ● | ● | ● | ● | ○ | ○ | ● |
| `invoice.create` | ● | ● | ○ | ● | ● | ○ | ○ | ○ |
| `invoice.update` | ● | ● | ○ | ○ | ● | ○ | ○ | ○ |
| `invoice.delete` (void) | ● | ● | ○ | ○ | ● | ○ | ○ | ○ |
| `invoice.approve` (issue) | ● | ● | ○ | ● | ● | ○ | ○ | ○ |
| `invoice.manage` (void+reissue) | ● | ● | ○ | ○ | ● | ○ | ○ | ○ |
| `invoice.export` | ● | ● | ● | ● | ● | ○ | ○ | ○ |
| `receipt.view` | ● | ● | ● | ○ | ● | ○ | ○ | ○ |
| `receipt.create` | ● | ● | ○ | ○ | ● | ○ | ○ | ○ |
| `receipt.update` (allocate) | ● | ● | ○ | ○ | ● | ○ | ○ | ○ |
| `receipt.delete` (void) | ● | ● | ○ | ○ | ● | ○ | ○ | ○ |
| `expense.view` | ● | ● | ● | ○ | ● | ○ | ○ | ○ |
| `expense.create` | ● | ● | ● | ○ | ● | ○ | ○ | ○ |
| `expense.update` | ● | ● | ● | ○ | ● | ○ | ○ | ○ |
| `expense.delete` (void) | ● | ● | ○ | ○ | ● | ○ | ○ | ○ |
| `expense.approve` | ● | ● | ○ | ○ | ● | ○ | ○ | ○ |
| `income.view/create/update/delete` | ● | ● | ○ | ○ | ● | ○ | ○ | ○ |

### Subscription (plans/subscriptions/mco/billing)
| Action key | super | admin | manager | sales | finance | hr | developer | viewer |
|---|---|---|---|---|---|---|---|---|
| `plan.view` | ● | ● | ● | ● | ● | ○ | ○ | ● |
| `plan.create/update/delete` | ● | ● | ○ | ○ | ○ | ○ | ○ | ○ |
| `subscription.view` | ● | ● | ● | ● | ● | ○ | ○ | ● |
| `subscription.create` | ● | ● | ○ | ● | ● | ○ | ○ | ○ |
| `subscription.update` | ● | ● | ○ | ○ | ● | ○ | ○ | ○ |
| `subscription.delete` (cancel) | ● | ● | ○ | ○ | ● | ○ | ○ | ○ |
| `subscription.manage` (suspend/reactivate) | ● | ● | ○ | ○ | ● | ○ | ○ | ○ |
| `mco.view` | ● | ● | ● | ● | ● | ○ | ○ | ● |
| `mco.create/update` | ● | ● | ○ | ● | ● | ○ | ○ | ○ |
| `mco.approve` (sign) | ● | ● | ○ | ● | ● | ○ | ○ | ○ |
| `mco.manage` (renew/terminate) | ● | ● | ● | ● | ● | ○ | ○ | ○ |

### Payroll
| Action key | super | admin | manager | sales | finance | hr | developer | viewer |
|---|---|---|---|---|---|---|---|---|
| `payroll.view` | ● | ● | ● | ○ | ● | ● | ○(own) | ○ |
| `payroll.create` (run) | ● | ● | ○ | ○ | ● | ● | ○ | ○ |
| `payroll.update` (adjustments) | ● | ● | ○ | ○ | ● | ● | ○ | ○ |
| `payroll.approve` (approve/post) | ● | ● | ○ | ○ | ● | ● | ○ | ○ |
| `payroll.delete` (reverse) | ● | ● | ○ | ○ | ● | ● | ○ | ○ |
| `payroll.manage` (rules) | ● | ● | ○ | ○ | ● | ● | ○ | ○ |
| `payroll.export` | ● | ● | ○ | ○ | ● | ● | ○ | ○ |
| `payroll.post` (custom) | ● | ● | ○ | ○ | ● | ● | ○ | ○ |

### Asset & Maintenance
| Action key | super | admin | manager | sales | finance | hr | developer | viewer |
|---|---|---|---|---|---|---|---|---|
| `asset.view` | ● | ● | ● | ○ | ● | ○ | ● | ● |
| `asset.create/update` | ● | ● | ● | ○ | ○ | ○ | ○ | ○ |
| `asset.delete` | ● | ● | ○ | ○ | ○ | ○ | ○ | ○ |
| `asset.manage` (assign/retire) | ● | ● | ● | ○ | ○ | ○ | ○ | ○ |
| `maintenance.view` | ● | ● | ● | ○ | ○ | ○ | ● | ● |
| `maintenance.create` | ● | ● | ● | ○ | ○ | ○ | ● | ○ |
| `maintenance.update` | ● | ● | ● | ○ | ○ | ○ | ●(own) | ○ |
| `maintenance.delete` | ● | ● | ○ | ○ | ○ | ○ | ○ | ○ |
| `maintenance.approve` (close) | ● | ● | ● | ○ | ○ | ○ | ○ | ○ |

### Notification / Knowledge / Audit / Activity / Platform
| Action key | super | admin | manager | sales | finance | hr | developer | viewer |
|---|---|---|---|---|---|---|---|---|
| `notification.view` (own) | ● | ● | ● | ● | ● | ● | ● | ● |
| `notification.create` (manual send) | ● | ● | ○ | ○ | ○ | ○ | ○ | ○ |
| `notification.manage` (templates/channels) | ● | ● | ○ | ○ | ○ | ○ | ○ | ○ |
| `article.view` | ● | ● | ● | ● | ● | ● | ● | ● |
| `article.create/update` | ● | ● | ● | ● | ○ | ○ | ● | ○ |
| `article.delete` | ● | ● | ○ | ○ | ○ | ○ | ○ | ○ |
| `article.approve` (publish) | ● | ● | ● | ○ | ○ | ○ | ○ | ○ |
| `audit.view` | ● | ● | ○ | ○ | ○ | ○ | ○ | ○ |
| `audit.export` | ● | ● | ○ | ○ | ○ | ○ | ○ | ○ |
| `activity.view` | ● | ● | ● | ● | ● | ● | ● | ● |
| `tag.view/create/update/delete` | ● | ● | ● | ● | ● | ● | ● | ●(view) |
| `reminder.view/create/update` | ● | ● | ● | ● | ● | ● | ● | ●(view) |
| `attachment.*` | ● | ● | ● | ● | ● | ● | ● | ●(view) |
| `comment.*` | ● | ● | ● | ● | ● | ● | ● | ●(view) |
| `setting.view` | ● | ● | ○ | ○ | ○ | ○ | ○ | ○(public) |
| `setting.manage` | ● | ● | ○ | ○ | ○ | ○ | ○ | ○ |

---

## 10.4 Permission resolution algorithm

1. If `user.is_founder = true` → **allow** (Super Admin bypass).
2. Resolve `user`'s role IDs from `user_roles`.
3. Fetch all `role_permissions.permission_id` for those role IDs.
4. Map to permission keys → set `P`.
5. Required key `K` (from route definition) is **allowed** iff `K ∈ P` OR a wildcard like `<module>.manage ∈ P` (manage implies all actions in module) OR `<module>.*` is granted.
6. **Service-layer scope check** for `.own`-scoped permissions (developer/tasks): after step 5 passes, enforce ownership.
7. Cache `P` per user (TTL ~5 min, invalidated on role/permission change) to avoid re-querying every request.

### Wildcard / manage-imply rules
- Granting `<module>.manage` implies `view/create/update/delete/approve/export` for that module.
- Granting `*` (only super_admin effectively) implies everything. Stored as a single permission row `key='*'`.
- The permission resolver expands these into the concrete set for caching.

---

## 10.5 Custom permission examples (the "Custom" column from the brief)

- `task.transition` — move task between statuses (gated by allowed transitions).
- `payroll.post` / `payroll.reverse` — post/reverse runs (separate from `approve`).
- `invoice.issue` — issue a draft invoice (we used `invoice.approve` to denote this).
- `quotation.convert` — convert to contract (we used `quotation.manage`).
- `contract.sign` — sign a contract (`contract.approve`).
- `expense.approve` — approve above-threshold expense.

These are surfaced as distinct permission keys for granular assignment even if a default role bundles them.

---

## 10.6 Enforcement points

- **Route middleware:** declares required key per route; rejects with `403` if missing. This covers 95% of checks.
- **Service layer:** enforces business-conditional checks (e.g., can't edit an `issued` invoice even with `invoice.update`; `.own` scope).
- **Data filter:** list queries apply implicit filters (e.g., a developer's task list is filtered to assigned tasks) based on the resolved scope of the permission.

---

## 10.7 Future: scoped permissions

The current model is **coarse** (per-module, not per-record). Future extension (prepared, not built): add a `scope` dimension — `task.update.own` vs `.any`, `invoice.view.team` vs `.all` — encoded in the permission key suffix and resolved in the service layer. The `PermissionKey` VO already supports dotted suffixes, so this is additive.
