import { eq, and, gt, isNull } from 'drizzle-orm';
import { sessions, refreshTokens } from '@taralaya/db';
import type { DbClient } from '@taralaya/db';
import { JwtService } from './jwt.service';
import { UnauthorizedError } from '../errors';

export interface CreateSessionOptions {
  userId: bigint;
  ip?: string;
  userAgent?: string;
}

export interface SessionWithTokens {
  sessionId: bigint;
  accessToken: string;
  refreshToken: string;
  refreshTokenId: bigint;
}

export class SessionService {
  private readonly jwt = new JwtService();

  constructor(private readonly db: DbClient) {}

  async create(
    userId: bigint,
    isFounder: boolean,
    opts: CreateSessionOptions,
  ): Promise<SessionWithTokens> {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.jwt.getRefreshTtlSeconds() * 1000,
    );

    // Opaque session token (hash stored, raw discarded after session creation)
    const { raw: sessionTokenRaw, hash: sessionTokenHash } =
      this.jwt.issueRefreshToken();

    const [sessionResult] = await this.db.insert(sessions).values({
      userId,
      tokenHash: sessionTokenHash,
      ip: opts.ip,
      userAgent: opts.userAgent,
      issuedAt: now,
      expiresAt,
    });

    const sessionId = BigInt(sessionResult.insertId);

    // Refresh token (opaque, sha256 hash stored)
    const { raw: refreshRaw, hash: refreshHash } = this.jwt.issueRefreshToken();
    const refreshExpiresAt = new Date(
      now.getTime() + this.jwt.getRefreshTtlSeconds() * 1000,
    );

    const [rtResult] = await this.db.insert(refreshTokens).values({
      userId,
      sessionId,
      tokenHash: refreshHash,
      expiresAt: refreshExpiresAt,
    });

    const refreshTokenId = BigInt(rtResult.insertId);

    // Access token (short-lived JWT)
    const accessToken = this.jwt.issueAccessToken({
      sub: `usr_${userId}`,
      userId,
      sessionId,
      isFounder,
    });

    return { sessionId, accessToken, refreshToken: refreshRaw, refreshTokenId };
  }

  async rotateRefreshToken(
    rawRefreshToken: string,
    isFounder: boolean,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const hash = this.jwt.hashRefreshToken(rawRefreshToken);
    const now = new Date();

    const [rt] = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hash))
      .limit(1);

    if (!rt) throw new UnauthorizedError('Invalid refresh token');
    if (rt.usedAt !== null) {
      // Reuse detected: revoke entire session family
      await this.revokeSession(rt.sessionId);
      throw new UnauthorizedError('Refresh token reuse detected — session revoked');
    }
    if (rt.expiresAt < now) throw new UnauthorizedError('Refresh token expired');

    const [session] = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, rt.sessionId))
      .limit(1);

    if (!session || session.revokedAt !== null) {
      throw new UnauthorizedError('Session revoked');
    }

    // Mark old token as used
    await this.db
      .update(refreshTokens)
      .set({ usedAt: now })
      .where(eq(refreshTokens.id, rt.id));

    // Issue new refresh token
    const { raw: newRaw, hash: newHash } = this.jwt.issueRefreshToken();
    const newExpiresAt = new Date(
      now.getTime() + this.jwt.getRefreshTtlSeconds() * 1000,
    );

    const [newRtResult] = await this.db.insert(refreshTokens).values({
      userId: rt.userId,
      sessionId: rt.sessionId,
      tokenHash: newHash,
      expiresAt: newExpiresAt,
    });

    // Chain the old token to the new one
    await this.db
      .update(refreshTokens)
      .set({ rotatedTo: BigInt(newRtResult.insertId) })
      .where(eq(refreshTokens.id, rt.id));

    const accessToken = this.jwt.issueAccessToken({
      sub: `usr_${rt.userId}`,
      userId: rt.userId,
      sessionId: rt.sessionId,
      isFounder,
    });

    return { accessToken, refreshToken: newRaw };
  }

  async revokeSession(sessionId: bigint): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.id, sessionId));
  }

  async revokeAllUserSessions(userId: bigint): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  }
}
