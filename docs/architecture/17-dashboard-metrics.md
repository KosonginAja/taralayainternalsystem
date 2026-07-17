# Phase 17 — Dashboard Metrics

> KPIs across: **Revenue, Project, Task, Invoice, Cashflow, Profit, Reminder, Maintenance.**
> Every metric states: definition, data source, refresh strategy, and intended audience.

---

## 17.1 Performance principle

Dashboards read **snapshots and indexed aggregates**, never heavy live joins on every page load. Expensive computations are precomputed by jobs (Phase 13) into `cashflow_snapshots` / `profit_snapshots` and per-entity rollup caches. Live endpoints exist for ad-hoc/drill-down but aren't the default feed.

---

## 17.2 Metric catalog

### Revenue
| Metric | Definition | Source | Refresh |
|---|---|---|---|
| Revenue (period) | Σ invoice.grand_total issued in period (accrual) **or** Σ receipts allocated (cash) | invoices / receipts + setting `finance.accounting_basis` | snapshot job daily; live on demand |
| Revenue by client | revenue grouped by client | invoices group-by | on demand |
| Revenue by project | revenue attributed to project | invoices.project_id group-by | on demand |
| Revenue MTD / QTD / YTD | period-to-date totals | snapshots | daily |
| Recognized vs outstanding | issued vs unpaid | invoices.payment_status | live |
| Recurring revenue (MRR) | Σ active subscriptions.amount normalized to monthly | subscriptions + plans | daily snapshot |

### Project
| Metric | Definition | Source |
|---|---|---|
| Active projects count | status=active | projects |
| Projects by status | distribution | projects group-by |
| On-time delivery rate | % projects completed on/before due_date | projects where status=completed |
| Average project duration | avg(completed_at − start_date) | projects |
| Budget burn | logged_hours/budget_hours, expenses/budget_amount | projects + tasks + expenses |
| Project profitability | revenue − expenses − payroll per project | finance per-project rollup |
| Overdue projects | past due_date, not completed | projects |

### Task
| Metric | Definition | Source |
|---|---|---|
| Tasks by status | board distribution | tasks group-by (project, status) |
| Tasks due today / overdue | per assignee | tasks + task_assignments |
| Throughput | tasks completed per day/week | tasks (status=done, completed_at) |
| Blocked tasks count | status=blocked | tasks |
| Workload per assignee | open tasks per user | tasks + task_assignments |

### Invoice
| Metric | Definition | Source |
|---|---|---|
| Outstanding (AR) | Σ balance across unpaid/partial invoices | invoices |
| AR Aging | buckets 0–30/31–60/61–90/90+ days by due_date | invoices (indexed) |
| Overdue invoices count/sum | status=overdue | invoices |
| Average time to pay | avg(receipt.payment_date − invoice.issue_date) | receipts + invoices |
| Collection rate | paid / issued (period) | invoices + receipts |
| Invoices draft vs issued | pipeline | invoices group-by status |
| DP outstanding | Σ down_payments.balance | down_payments |

### Cashflow
| Metric | Definition | Source |
|---|---|---|
| Net cash flow (period) | inflow − outflow | cashflow_snapshots |
| Cashflow trend | time series | cashflow_snapshots (granularity) |
| Inflow / outflow split | per category | snapshot metadata / live |
| Cash runway (if outflow > inflow) | months of reserve | derived |

### Profit
| Metric | Definition | Source |
|---|---|---|
| Net profit (period) | revenue − COGS − opex − payroll | profit_snapshots |
| Profit margin | net_profit / revenue | derived |
| Profit by project | per-project rollup | finance per-project |
| Expense breakdown | by category | expenses group-by |

### Reminder
| Metric | Definition | Source |
|---|---|---|
| Pending reminders count | status=pending | reminders |
| Due soon (next 24h) | remind_at within 24h | reminders (indexed) |
| Snoozed / dismissed rates | operational hygiene | reminders group-by |
| Overdue reminders (fired but unactioned) | for follow-up | reminders |

### Maintenance
| Metric | Definition | Source |
|---|---|---|
| Open tickets | status in (open, assigned, in_progress, waiting) | maintenance_tickets |
| Tickets by status / priority | distribution | group-by |
| SLA breach count / % | first_response or resolution past SLA | maintenance_tickets + sla_policies |
| Avg resolution time | avg(closed_at − created_at) | maintenance_tickets |
| Tickets per assignee | workload | group-by |
| Tickets per client | demand | group-by |
| Active MCO count / MRR from MCO | retention health | mco_contracts + subscriptions |

### Cross-cutting (CRM + Sales pipeline, optional on main dashboard)
| Metric | Definition |
|---|---|
| Leads by stage (pipeline value) | Σ estimated_value by stage |
| Conversion rate (lead→client) | converted leads / total leads (period) |
| Quotation win rate | accepted / sent (period) |
| Sales cycle length | avg(client.created − lead.created) for converted |

---

## 17.3 Dashboard layouts (who sees what)

| Dashboard | Audience | Widgets |
|---|---|---|
| **Executive** | founder/admin | Revenue MTD, Profit MTD, Cashflow chart, AR aging, Active projects, Open tickets, Pipeline value |
| **Sales** | sales role | Pipeline (leads by stage), Quotations to follow up, Win rate, Revenue by client |
| **PM / Delivery** | manager/developer | My projects, My/团队 tasks board, Overdue tasks, Budget burn, Project profitability |
| **Finance** | finance role | AR aging, Outstanding, Cashflow, Profit, Expenses pending approval, DP outstanding |
| **HR / Payroll** | hr role | Upcoming payroll run, Payroll expense trend, Headcount |
| **Operations** | ops role | Open maintenance tickets, SLA breaches, Asset license expirations, MCO renewals due |
| **Personal** | each user | My tasks, My reminders, My recent activity, My payslips |

Each dashboard is a **composition of metric widgets**; widgets are reusable and permission-aware (a viewer sees the read-only versions).

---

## 17.4 Refresh & caching

- **Snapshot-driven widgets** (cashflow/profit): read from snapshot tables; cache 1–5 min in app; rebuild nightly.
- **Live widgets** (my tasks, AR aging): query indexed reads; cache 30–60s.
- **Real-time-ish** (notifications count): push via the notification center (Phase 14 future in-app).
- Global cache invalidation on relevant domain events (e.g., a new receipt invalidates the AR widget).

---

## 17.5 Computation notes (avoiding pitfalls)

- **Accrual vs cash** must be consistent within a dashboard (toggle, not mix). Default per `finance.accounting_basis`.
- **Currency**: aggregates assume single base currency today; mixed-currency sums are flagged (future FX).
- **Period boundaries**: use the period-close setting (Phase 12 §12.13) — closed periods' numbers are frozen.
- **Excludes voided/reversed** unless explicitly included (a "gross vs net" toggle for some reports).

---

## 17.6 Export

Every dashboard supports CSV/PDF export of its underlying dataset (permission `<module>.export`), reusing the same query + the `*.export` audit action.

---

## 17.7 Future

- Custom dashboards (drag-drop widgets).
- Saved views / shared dashboards.
- Anomaly alerts (revenue dropped X% → notify).
- Predictive forecasting (revenue projection).
