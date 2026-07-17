# Phase 13 — Automation Flow

> The canonical business pipeline + the **complete automation event list** with triggers, conditions, and actions.

---

## 13.1 The spine (canonical pipeline)

```
LEAD ──(qualify)──▶ CLIENT ──(quote)──▶ QUOTATION ──(accept)──▶ CONTRACT
                                                      │
                                                      ▼
                                                 PROJECT ──(spawn)──▶ TASKS
                                                      │                   │
                                                      ▼                   ▼
                                                 DP collected      MILESTONES reached
                                                      │
                                                      ▼
                                       INVOICE ──(paid)──▶ RECEIPT ──▶ CASHFLOW/PROFIT
                                                      │
                                                      ▼
                                       REMINDER ──▶ MAINTENANCE / MCO RENEWAL
```

Each arrow is an **automation transition**: a domain event triggers downstream work.

---

## 13.2 Automation architecture

Two execution modes (implementation detail for the build AI):

1. **In-process event bus** (synchronous, same transaction) — for things that must be consistent with the triggering write: audit, activity, denormalized updates (invoice.paid_amount).
2. **Queue + workers** (asynchronous) — for side effects that can lag: notifications, snapshot recomputation, DP auto-allocation, reminder scheduling, payroll triggers.

**Event = named record** `{ name, payload, occurredAt, actorId }`. Producers emit; consumers subscribe by name (with module + handler id). Every consumer is idempotent (keyed) and retries with backoff.

This generalizes the Phase 2 "command → transaction → event → handlers" pattern.

---

## 13.3 Complete automation event list

Format: **Trigger Event** → conditions → **actions** (with target module/handler).

### CRM
| Trigger | Condition | Action |
|---|---|---|
| `lead.created` | has owner | notify owner; activity log |
| `lead.stage_changed` | stage.is_won | auto-create Client (or prompt convert); activity |
| `lead.stage_changed` | stage.is_lost | activity; mark lost_reason |
| `lead.converted` | — | create Client + (optionally) contact; activity; notify sales |
| `client.created` | — | activity; default settings applied |

### Sales
| Trigger | Condition | Action |
|---|---|---|
| `quotation.sent` | — | send to client via configured channel; schedule `quotation.expired` reminder at valid_until+1 |
| `quotation.viewed` (webhook/client-open) | — | set status viewed; notify sales |
| `quotation.accepted` | — | activity; enable convert; notify manager |
| `quotation.expired` | not accepted | status=expired; notify sales |
| `quotation.converted` | — | create Contract (signed/draft); optionally create Project; activity |
| `contract.signed` | — | set status active; activity; **kickoff flow** (enable project start, DP request) |
| `contract.expiring` (cron, 30d before end) | — | notify account manager; suggest renewal |
| `contract.terminated` | — | activity; cancel linked subscription? (prompt) |

### Delivery
| Trigger | Condition | Action |
|---|---|---|
| `project.created` | from template | seed tasks/milestones from template |
| `project.started` | — | activity; notify team; schedule kickoff reminder |
| `task.assigned` | — | notify assignee |
| `task.due_soon` (cron, 1d before) | not done | notify assignee |
| `task.overdue` (cron) | past due, not done | escalate to manager; activity |
| `task.completed` | — | recompute project.progress; if milestone's tasks all done → prompt milestone.reached |
| `milestone.reached` | — | activity; if billing milestone → suggest invoice creation |
| `project.completed` | all required milestones reached | activity; **trigger MCO offer**; archive optional; trigger final invoice? |

### Finance
| Trigger | Condition | Action |
|---|---|---|
| `invoice.issued` | — | activity; schedule overdue check; if client has `unlimited` DP → auto-allocate |
| `invoice.sent` | — | send via channel; activity |
| `invoice.overdue` (cron, daily) | due_date < today, payment_status≠paid | status=overdue; reminder to client (escalating cadence); activity |
| `invoice.paid` (allocation reaches total) | — | status=paid; activity; notify finance/client; **trigger project payroll eligibility** |
| `invoice.voided` | — | reverse allocations; activity |
| `receipt.created` | allocations provided | recompute invoices' paid state; activity |
| `receipt.allocation.created` | invoice = project invoice | **trigger project payroll run** (if enabled) |
| `dp.collected` | mode=unlimited | auto-allocate to open invoices |
| `expense.approved` | above threshold | notify finance to pay |
| `expense.paid` | — | recompute cashflow snapshot; activity |
| `cashflow.snapshot.due` (cron, daily) | — | recompute daily/period snapshots |
| `profit.snapshot.due` (cron, daily) | — | recompute profit snapshots |

### Subscription / MCO
| Trigger | Condition | Action |
|---|---|---|
| `billing.cycle.due` (cron) | period end reached | create Invoice via Finance; activity |
| `subscription.renewing` (cron, 7d before period_end) | auto_renew | extend period; activity |
| `subscription.expiring` | auto_renew=false | notify client/manager; will set expired |
| `mco.renewal_due` (cron, 30d before end) | — | reminder to account manager |
| `mco.expired` | — | status=expired; deactivate linked SLA; notify |

### Payroll
| Trigger | Condition | Action |
|---|---|---|
| `payroll.internal.run.due` (cron, monthly) | day = setting | create internal run; compute; (auto-approve if configured) |
| `payroll.run.posted` | — | post expense to finance; write history; notify employees (payslip) |
| `payroll.run.reversed` | — | reverse finance expense; reverse history entries |

### Asset & Maintenance
| Trigger | Condition | Action |
|---|---|---|
| `maintenance_ticket.created` | — | notify assignee/client; evaluate SLA; activity |
| `maintenance.sla.first_response_breach` (cron) | no first_response_at | escalate; notify manager |
| `maintenance.sla.resolution_breach` (cron) | past due_at | escalate; notify |
| `maintenance_ticket.resolved` | — | notify client; await confirmation; activity |
| `asset.license_expiring` (cron, 14d before) | — | notify asset owner/manager |
| `asset.assigned` | — | activity |

### IAM / Platform
| Trigger | Condition | Action |
|---|---|---|
| `user.logged_in` | — | audit; update last_login |
| `user.login_failed` × N (config) | — | lock account; notify user/admin |
| `user.role_assigned` | — | invalidate permission cache; audit; activity |
| `permission.granted/revoked` | — | invalidate affected users' caches; audit |
| `reminder.due` (cron, every minute) | remind_at ≤ now, status=pending | fire reminder → notification; status=fired |

### Notification
| Trigger | Condition | Action |
|---|---|---|
| (any domain event with a matching template) | — | queue Notification via NotificationService; respect user preferences |

---

## 13.4 Reminder / scheduler cadences (cron summary)

| Schedule | Job |
|---|---|
| Every minute | `reminder.fire` (due reminders) |
| Every 5 min | `notification.dispatch` (queued + scheduled) |
| Daily 00:05 UTC | `invoice.overdue.scan`, `cashflow.snapshot`, `profit.snapshot`, `asset.license.expiry.scan`, `maintenance.sla.scan` |
| Daily 06:00 UTC | `subscription.renewal.scan`, `mco.expiry.scan`, `contract.expiry.scan` |
| Monthly (25th 23:59) | `payroll.internal.run` |
| Hourly | `billing.cycle.generate` |

All schedulers are **idempotent** (re-running produces no duplicates) and **locked** (distributed lock so only one worker runs each at a time).

---

## 13.5 Escalation policy

For overdue/breach events, escalation follows tiers (configurable per category):
- Tier 1 (at breach): notify assignee.
- Tier 2 (+1d): notify assignee + manager.
- Tier 3 (+3d): notify admin / founder.

Encoded in `settings` as JSON per category (e.g. `automation.escalation.maintenance`).

---

## 13.6 Future: visual workflow designer

Phase 13's event list is currently **code-declared handlers**. The future "automation designer" generalizes this: each row becomes a user-editable rule `{ when: <event>, if: <condition>, do: <action> }` stored in a `workflow_rules` table, evaluated by a rule engine. The current architecture (event bus + named handlers) maps cleanly onto this future, so the migration is additive.
