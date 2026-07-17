import 'dotenv/config';
import { config } from './core/config';
import { createApp, errorHandler } from './core/http';
import { createClient } from '@taralaya/db';
import { logger } from './core/logger';
import { PermissionResolver } from './core/rbac';
import { createAuthRouter } from './modules/iam/routes/auth.routes';
import { createUsersRouter } from './modules/iam/routes/users.routes';
import { createRolesRouter, createPermissionsRouter } from './modules/iam/routes/roles.routes';

async function bootstrap() {
  const db = createClient(config.DATABASE_URL);
  const resolver = new PermissionResolver(db);
  const app = createApp();

  // ─── Health Endpoints ────────────────────────
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/health/db', async (_req, res, next) => {
    try {
      await db.execute('SELECT 1' as any);
      res.json({ status: 'ok' });
    } catch (err) {
      next(err);
    }
  });

  // ─── API v1 Routes ───────────────────────────
  const v1 = '/api/v1';
  app.use(`${v1}/auth`, createAuthRouter(db, resolver));
  app.use(`${v1}/users`, createUsersRouter(db, resolver));
  app.use(`${v1}/roles`, createRolesRouter(db, resolver));
  app.use(`${v1}/permissions`, createPermissionsRouter(db, resolver));

  // ─── Error Handler (must be last) ────────────
  app.use(errorHandler);

  const port = config.PORT;
  app.listen(port, () => {
    logger.info({ port, env: config.NODE_ENV }, `🚀 Taralaya OS backend running on :${port}`);
  });
}

bootstrap().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
