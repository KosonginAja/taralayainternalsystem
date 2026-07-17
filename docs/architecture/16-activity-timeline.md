# Phase 16 — Activity Timeline

> **Every important business event creates a timeline record.** A human-readable, append-only feed of "what happened," scoped per project / client / user / globally.

(Distinguished from the low-level Audit Log in Phase 15 — this is the *business* layer.)

---

## 16.1 Purpose

Users want to open a project (or client, or their own profile) and **see a story** of what happened: "Invoice issued," "Task completed," "Payment received," "Contract signed." That's the Activity Timeline. It's read-optimized for feeds, not forensics.

---

## 16.2 The record shape (`activity_timeline`)

| Field | Content |
|---|---|
| `actor_id` | who did it (null = system) |
| `verb` | the action verb: `issued`, `paid`, `completed`, `converted`, `signed`, `created`, `closed`, `assigned`, `renewed`, `commented`, `uploaded`, `reversed`, ... |
| `verb_subject` | what kind of thing: `invoice`, `receipt`, `task`, `project`, `lead`, `contract`, `quotation`, `maintenance_ticket`, `payroll_run`, ... |
| `entity_type` / `entity_id` | the primary entity this event is about (clickable link target) |
| `project_id` | optional — denormalized so the project feed query is a single index seek |
| `client_id` | optional — same for client feed |
| `description` | **pre-rendered human sentence**, written at creation time: `"Sarah issued invoice INV-2026-00042 for Acme Corp (₹12,000)."` |
| `metadata` | JSON — structured detail for rich rendering (amounts, links, before/after status) |
| `is_public` | visible to the client (future portal) or internal-only |
| `occurred_at` | UTC timestamp |

---

## 16.3 Why pre-rendered `description`?

Feeds are read **far** more than they're written. Pre-rendering the human sentence at event time means rendering a feed is a single indexed read — **zero joins**. The trade-off (denormalized text) is intentional and documented (Phase 6 §6.2). If a user renames "Acme Corp" later, old feed entries still read "Acme Corp" — acceptable (and even desirable for historical accuracy; mirrors how email/audit trails behave).

`metadata` carries the structured data for rich UI rendering (icons, amount formatting, deep links), so the UI isn't fully dependent on parsing the sentence.

---

## 16.4 What generates timeline entries

A **curated** set of business moments (not every CUD — that's the audit log's job). Each is an explicit `ActivityService.log(...)` call at the meaningful point:

| Event | verb + subject | Example description |
|---|---|---|
| Lead created | `created.lead` | "New lead 'Acme website' added." |
| Lead converted | `converted.lead` | "Lead 'Acme website' converted to client Acme Corp." |
| Client created | `created.client` | "Client Acme Corp created." |
| Quotation sent | `sent.quotation` | "Quotation QUO-2026-0010 sent to Acme Corp." |
| Quotation accepted | `accepted.quotation` | "Acme Corp accepted quotation QUO-2026-0010." |
| Contract signed | `signed.contract` | "Contract CTR-2026-0007 signed with Acme Corp." |
| Project created/started/completed | `created/started/completed.project` | "Project PRJ-2026-0003 'Acme Website' started." |
| Task assigned/completed | `assigned/completed.task` | "Task 'Design homepage' assigned to Sarah." |
| Milestone reached | `reached.milestone` | "Milestone 'Phase 1 delivery' reached." |
| DP collected | `collected.down_payment` | "Down payment of ₹50,000 collected from Acme Corp." |
| Invoice issued/sent/paid/voided | `issued/sent/paid/voided.invoice` | "Invoice INV-2026-00042 paid (₹12,000)." |
| Receipt recorded | `recorded.receipt` | "Payment RCT-2026-00031 received from Acme Corp." |
| Expense approved/paid | `approved/paid.expense` | "Expense 'Hosting renewal' paid (₹8,000)." |
| Subscription created/renewed/cancelled | `...subscription` | "Acme Corp subscribed to 'Care Plan'." |
| MCO signed/renewed | `signed/renewed.mco` | "MCO MCO-2026-0002 renewed for 12 months." |
| Maintenance ticket opened/resolved/closed | `opened/resolved/closed.maintenance_ticket` | "Maintenance ticket MNT-2026-0019 resolved." |
| Payroll run posted | `posted.payroll_run` | "Payroll run for 2026-06 posted (₹2,40,000)." |
| Role assigned | `assigned.role` | "Sarah was assigned the 'Manager' role." |
| Comment added | `commented.{entity}` | "John commented on task 'Design homepage'." |
| Attachment uploaded | `uploaded.attachment` | "Contract PDF uploaded." |

This list is the **canonical catalog**; new moments are added by calling `ActivityService.log()` and (for analytics) registering the verb in `enum_values` group `activity.verb`.

---

## 16.5 Feeds (read paths)

| Feed | Query (index) |
|---|---|
| Project activity | `WHERE project_id = ? ORDER BY occurred_at` → `idx_act_project_time` |
| Client activity | `WHERE client_id = ? ORDER BY occurred_at` → `idx_act_client_time` |
| Global feed | `ORDER BY occurred_at DESC` → `idx_act_time` |
| User activity ("Sarah's recent actions") | `WHERE actor_id = ? ORDER BY occurred_at` → `idx_act_actor` |
| Single-entity history | `WHERE entity_type=? AND entity_id=?` → `idx_act_entity` |

All single-index, no joins. Fast even at high volume.

---

## 16.6 Filtering & visibility

- `is_public` flag: internal-only entries (role changes, voids, reversals) are `is_public=false`; client-facing milestones (invoice paid, project completed) can be `is_public=true` for the future client portal.
- Permission `activity.view` gates the global feed; per-project/per-client feed visibility piggybacks on `project.view`/`client.view`.
- Sensitive entries (payroll amounts, reversals) are internal-only regardless of context.

---

## 16.7 Lifecycle & retention

- **Append-only** — no edits, no deletes (same rule as audit). Corrections are a new entry ("Reversed invoice INV-...").
- **Retention:** longer than audit, since it's user-valuable. Default: keep forever; archive to cold storage after N years (configurable `activity.retention_years`, default 10). Partitioning by month when large (Phase 6 §6.8).

---

## 16.8 Activity vs Audit — when to use which (decision guide)

| Question | Use |
|---|---|
| "What changed in this row's data?" | **Audit Log** (before/after/diff) |
| "What's the story of this project?" | **Activity Timeline** (human feed) |
| Compliance / forensic investigation | **Audit Log** |
| User-facing feed / "recent activity" widget | **Activity Timeline** |
| "Who logged in / exported data?" | **Audit Log** |
| "Sarah closed the project" | **Activity Timeline** |

They're complementary; many actions write **both** (audit always, activity when it's a "story-worthy" moment).

---

## 16.9 Implementation note

`ActivityService.log(verb, subject, { actor, entity, project?, client?, description, metadata, isPublic })` is the single entry point. It's called:
- explicitly from services at meaningful moments, and/or
- automatically by subscribing to selected domain events (e.g. on `invoice.paid`, emit an activity entry).

The catalog in §16.4 defines *which* events produce activity entries (curated), so the feed stays signal-rich rather than noisy.
