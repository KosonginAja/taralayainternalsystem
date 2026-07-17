import { auditLogs, activityTimeline } from '@taralaya/db';
import type { DbClient, NewAuditLog, NewActivityEntry } from '@taralaya/db';

export interface AuditRecordInput {
  actorId?: bigint;
  action: string;
  entityType: string;
  entityId?: bigint;
  before?: unknown;
  after?: unknown;
  diff?: unknown;
  ipAddress?: string;
  userAgent?: string;
  route?: string;
  method?: string;
  result?: 'success' | 'failure';
  error?: string;
}

/**
 * AuditService — append-only audit log recorder.
 *
 * Fulfils Phase 15 §15.4: every CUD and sensitive action gets a row.
 * The repository layer auto-calls this via the interceptor.
 * Routes/services call record() explicitly for non-CUD events (login, etc.).
 */
export class AuditService {
  constructor(private readonly db: DbClient) {}

  async record(input: AuditRecordInput): Promise<void> {
    const entry: NewAuditLog = {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: input.before != null ? JSON.stringify(input.before) : undefined,
      after: input.after != null ? JSON.stringify(input.after) : undefined,
      diff: input.diff != null ? JSON.stringify(input.diff) : undefined,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      route: input.route,
      method: input.method,
      result: input.result ?? 'success',
      error: input.error,
    };

    await this.db.insert(auditLogs).values(entry);
  }
}

export interface ActivityLogInput {
  verb: string;
  verbSubject?: string;
  actorId?: bigint;
  entityType: string;
  entityId: bigint;
  projectId?: bigint;
  clientId?: bigint;
  description: string;
  metadata?: unknown;
  isPublic?: boolean;
}

/**
 * ActivityService — append-only activity timeline recorder.
 *
 * Fulfils Phase 16: pre-rendered description at call site.
 */
export class ActivityService {
  constructor(private readonly db: DbClient) {}

  async log(input: ActivityLogInput): Promise<void> {
    const entry: NewActivityEntry = {
      actorId: input.actorId,
      verb: input.verb,
      verbSubject: input.verbSubject,
      entityType: input.entityType,
      entityId: input.entityId,
      projectId: input.projectId,
      clientId: input.clientId,
      description: input.description,
      metadata: input.metadata != null ? JSON.stringify(input.metadata) : undefined,
      isPublic: input.isPublic ?? false,
    };

    await this.db.insert(activityTimeline).values(entry);
  }
}
