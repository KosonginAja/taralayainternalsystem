# Phase 14 — Notification Design

> **Provider Interface** abstraction; channels: **WhatsApp, Email, Discord, Telegram**. **Architecture only** (no provider SDK wiring details).

---

## 14.1 Design goals

1. **Provider-agnostic:** business code never knows whether a message goes to WhatsApp or Email.
2. **Template-driven:** message content is data (templates), not code.
3. **Reliable:** queue + retry + idempotency; never silently drop.
4. **Observable:** every attempt logged; delivery status queryable.
5. **Respectful:** per-user channel preferences; opt-out honored.
6. **Extensible:** adding a channel (e.g. SMS, push) = implementing one interface + one config row.

---

## 14.2 Component architecture

```
┌──────────────────────────────────────────────────────────┐
│  Domain modules (Finance, CRM, Delivery, ...)            │
│  call: NotificationService.notify(templateKey, recipient,│
│                                      variables, opts)    │
└──────────────┬───────────────────────────────────────────┘
               │  (or subscribe to domain events)
               ▼
┌──────────────────────────────────────────────────────────┐
│  NotificationService                                     │
│   - resolve template (key + channel + locale)            │
│   - check user preferences (enabled?)                    │
│   - render body (variables)                              │
│   - create Notification row (status=queued)              │
│   - dedupe via idempotency_key                           │
└──────────────┬───────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────┐
│  Dispatcher (queue worker)                               │
│   - pick queued/scheduled notifications                  │
│   - resolve channel → Provider (via NotificationChannel) │
│   - call provider.send()                                 │
│   - write NotificationLog per attempt                    │
│   - update Notification.status                           │
│   - retry with backoff on failure                        │
└──────────────┬───────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────┐
│  ProviderInterface (port)  ◀── implemented by adapters   │
│   + send(message): { providerMessageId, status }         │
│   WhatsAppProvider, EmailProvider, DiscordProvider,      │
│   TelegramProvider                                       │
└──────────────────────────────────────────────────────────┘
```

---

## 14.3 The Provider Interface (port)

A single contract every channel implements:

```
interface NotificationProvider {
  channel: 'whatsapp' | 'email' | 'discord' | 'telegram' | string  // extensible
  send(input: {
    to: string                 // phone / email / webhook / chat id
    subject?: string           // email only
    body: string               // rendered
    variables: Record<string,any>
    attachments?: Attachment[]
    idempotencyKey?: string
  }): Promise<{
    status: 'sent' | 'delivered' | 'failed' | 'queued'
    providerMessageId?: string
    error?: string
    rawResponse?: unknown
  }>
}
```

Each adapter wraps a vendor SDK (Twilio/WhatsApp Business, SendGrid/SES, Discord webhook, Telegram Bot API) and normalizes to this shape. Config (API keys, webhook URLs) lives encrypted in `notification_channels.config`.

**Why a port?** Swapping Twilio→Meta Cloud API, or SendGrid→SES, is a one-adapter change. The rest of the system is untouched.

---

## 14.4 Channel specifics

| Channel | Recipient format | Notes |
|---|---|---|
| **Email** | email address | supports subject + HTML/text body + attachments. Provider: SMTP/SendGrid/SES. |
| **WhatsApp** | E.164 phone | template-message compliance (Meta requires pre-approved message templates for business-initiated messages; transactional replies are freer). Provider: Twilio Content API / Meta Cloud. |
| **Discord** | webhook URL (per channel) | rich embeds; body as message content; good for internal alerts. |
| **Telegram** | chat id | Bot API; supports markdown. |

> WhatsApp's **template pre-approval** requirement means transactional message bodies may need to be registered with Meta first. The template system accommodates this: a `notification_templates` row whose `body` matches an approved Meta template, with the provider mapping `key ↔ template_name`.

---

## 14.5 Templates

- Keyed by `key + channel + locale` (unique). e.g. `invoice.issued` × `email` × `en`.
- Body uses a templating language (Liquid or Handlebars) with declared `variables`.
- Variables are validated before render (missing var → fail loud, not silent `undefined`).
- Multi-locale: a French user gets the `fr` template if present, else fallback `en`.
- Admins edit templates via UI; versioning optional (today: edit in place; audit trail via `audit_logs`).

**Example template (`invoice.issued` / email / en):**
```
Subject: New invoice {{invoiceNo}} from {{agencyName}}
Body: Hi {{clientName}}, invoice {{invoiceNo}} for {{grandTotal}} {{currency}} is due {{dueDate}}. Pay here: {{paymentLink}}
```

---

## 14.6 Notification lifecycle (state machine)

```
queued ──(dispatcher picks)──▶ sending ──┬──▶ sent ──▶ delivered
                                           │
                                           └──▶ failed (retry × N) ──▶ failed (dead-letter)
scheduled (future send) ──(at time)──▶ queued
suppressed (preference off / blocked)     skipped (no channel configured)
```

- **Idempotency:** `idempotency_key` unique; duplicate enqueue returns the existing notification (prevents storm duplicates from event retries).
- **Retry:** exponential backoff (e.g. 1m, 5m, 30m, 2h, 6h); max 5 attempts (configurable). After exhaustion → `failed` (dead-letter, admin-reviewable).
- **Priority:** lower number = higher priority; urgent (overdue/SLA breach) jumps the queue.

---

## 14.7 Preferences & suppression

`notification_preferences`: per (user, templateKey|null, channel) → enabled.
- Null templateKey = global channel opt-out (e.g. "no WhatsApp ever").
- Checked before enqueue; if disabled → status=`suppressed`, not sent.
- Clients (future portal) manage their own preferences too.

**Suppression list:** hard bounces / opted-out recipients recorded to never retry. Provider-level bounces update this.

---

## 14.8 Triggering model

Two ways a notification gets created:
1. **Explicit call:** a service calls `NotificationService.notify('invoice.issued', recipient, { invoiceNo, ... })`. Used when business logic decides a specific recipient/content.
2. **Event subscription:** the Notification module subscribes to domain events (e.g. `task.assigned`) and, if a matching template + routing rule exists, creates the notification. This decouples business modules from notification entirely.

Default: a hybrid — domain events are the primary trigger; explicit calls used for ad-hoc/manual sends.

---

## 14.9 Routing rules (who gets what)

A `routing` concept (settings/config, not a hard-coded table today): for each event key, define audience:
- `task.assigned` → the assignee (in-app + email).
- `invoice.overdue` → client contact (email/WhatsApp) + finance (internal Discord).
- `payroll.run.posted` → each paid employee (email, payslip).
- `maintenance.sla.breach` → assignee + manager (Discord).

Encodable as JSON in settings (`notification.routing`) or, in future, a `notification_routes` table.

---

## 14.10 Observability

- `notification_logs`: per-attempt record (request/response/error/duration).
- Admin dashboard: queue depth, success rate per channel, failed/dead-letter inbox with replay.
- Metrics feed into Phase 17 dashboards (delivery rate, latency).

---

## 14.11 Security

- Provider credentials in `notification_channels.config` are **encrypted at rest** (app-level encryption with a master key from env).
- Recipient PII (phone/email) access-logged when viewed in bulk.
- Rate limiting per channel/provider to avoid being flagged as spam; honor provider quotas.

---

## 14.12 Future expansion

- In-app notifications center (real-time via WebSocket/SSE) + bell icon.
- Mobile push (FCM/APNs).
- SMS channel.
- Provider failover (email→SMS if email bounces).
- Scheduled digest ("daily summary" instead of per-event).
- Templating visual editor + A/B testing.
