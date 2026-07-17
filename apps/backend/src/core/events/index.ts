type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;

/**
 * In-process synchronous typed event bus.
 *
 * Wave A uses sync-only dispatch. Async/queue wiring comes in Wave D/G.
 * Handlers must be idempotent — they may be called more than once in error recovery paths.
 */
class EventBus {
  private readonly handlers = new Map<string, EventHandler[]>();

  subscribe<T>(event: string, handler: EventHandler<T>): () => void {
    const existing = this.handlers.get(event) ?? [];
    existing.push(handler as EventHandler);
    this.handlers.set(event, existing);

    // Return unsubscribe function
    return () => {
      const current = this.handlers.get(event) ?? [];
      this.handlers.set(
        event,
        current.filter((h) => h !== (handler as EventHandler)),
      );
    };
  }

  emit<T>(event: string, payload: T): void {
    const handlers = this.handlers.get(event) ?? [];
    for (const handler of handlers) {
      // Errors in handlers are caught and logged, not thrown (bus isolation)
      try {
        const result = handler(payload);
        if (result instanceof Promise) {
          result.catch((err) => {
            console.error(`[EventBus] Handler error for event "${event}":`, err);
          });
        }
      } catch (err) {
        console.error(`[EventBus] Sync handler error for event "${event}":`, err);
      }
    }
  }
}

export const eventBus = new EventBus();

// ─── Well-known event names ────────────────────────────────────────
export const Events = {
  // IAM
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  USER_LOGGED_IN: 'user.logged_in',
  USER_LOGGED_OUT: 'user.logged_out',
  USER_LOGIN_FAILED: 'user.login_failed',
  USER_ROLE_ASSIGNED: 'user.role_assigned',
  USER_ROLE_REVOKED: 'user.role_revoked',
  ROLE_CREATED: 'role.created',
  ROLE_UPDATED: 'role.updated',
  ROLE_DELETED: 'role.deleted',
  PERMISSION_GRANTED: 'permission.granted',
  PERMISSION_REVOKED: 'permission.revoked',
} as const;
