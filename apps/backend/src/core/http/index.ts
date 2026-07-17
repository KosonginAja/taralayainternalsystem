import express, {
  type Request,
  type Response,
  type NextFunction,
  type Express,
} from 'express';
import { v4 as uuid } from 'uuid';
import { logger } from '../logger';
import { isAppError } from '../errors';
import { buildPaginationMeta } from '../validation';

export { express };

/**
 * Uniform success envelope: { data, meta? }
 */
export function ok<T>(res: Response, data: T, meta?: object, statusCode = 200) {
  res.status(statusCode).json({ data, meta: meta ?? null });
}

/**
 * Uniform created envelope: 201 { data }
 */
export function created<T>(res: Response, data: T) {
  res.status(201).json({ data, meta: null });
}

/**
 * 204 No Content
 */
export function noContent(res: Response) {
  res.status(204).send();
}

/**
 * Builds a paginated list response.
 */
export function paginatedOk<T>(
  res: Response,
  items: T[],
  total: number,
  page: number,
  perPage: number,
) {
  ok(res, items, buildPaginationMeta(total, page, perPage));
}

/**
 * Middleware: attaches a unique request-id to every request and response.
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const id = (req.headers['x-request-id'] as string) ?? uuid();
  (req as any).requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}

/**
 * Central error handler. Maps AppErrors to HTTP responses; logs unexpected errors.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
) {
  if (isAppError(err)) {
    if (err.statusCode >= 500) {
      logger.error({ err, requestId: (req as any).requestId }, 'Server error');
    }
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details ?? null,
      },
    });
    return;
  }

  // Unknown errors
  logger.error({ err, requestId: (req as any).requestId }, 'Unhandled error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      details: null,
    },
  });
}

/**
 * Creates and configures the base Express app.
 */
export function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(requestIdMiddleware);
  return app;
}
