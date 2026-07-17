import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';

export interface AccessTokenPayload {
  sub: string; // prefixed user id e.g. usr_1
  userId: bigint;
  sessionId: bigint;
  isFounder: boolean;
}

export interface RefreshTokenPayload {
  sub: string;
  sessionId: bigint;
  tokenId: bigint;
}

/**
 * Parse a TTL string like "15m", "7d" into seconds.
 */
function parseTtlToSeconds(ttl: string): number {
  const match = ttl.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid TTL format: ${ttl}`);
  const [, num, unit] = match;
  const n = parseInt(num, 10);
  return unit === 's' ? n : unit === 'm' ? n * 60 : unit === 'h' ? n * 3600 : n * 86400;
}

export class JwtService {
  private readonly secret = config.JWT_SECRET;
  private readonly accessTtlSec = parseTtlToSeconds(config.JWT_ACCESS_TTL);
  private readonly refreshTtlSec = parseTtlToSeconds(config.JWT_REFRESH_TTL);

  issueAccessToken(payload: AccessTokenPayload): string {
    return jwt.sign(
      {
        sub: payload.sub,
        uid: payload.userId.toString(),
        sid: payload.sessionId.toString(),
        founder: payload.isFounder,
      },
      this.secret,
      { expiresIn: this.accessTtlSec, algorithm: 'HS256' },
    );
  }

  /**
   * Issues an opaque refresh token (random 64-byte hex).
   * The hash of this value is stored in DB; raw value sent to client.
   */
  issueRefreshToken(): { raw: string; hash: string } {
    const raw = crypto.randomBytes(64).toString('hex');
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    return { raw, hash };
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    const decoded = jwt.verify(token, this.secret, { algorithms: ['HS256'] }) as {
      sub: string;
      uid: string;
      sid: string;
      founder: boolean;
    };
    return {
      sub: decoded.sub,
      userId: BigInt(decoded.uid),
      sessionId: BigInt(decoded.sid),
      isFounder: decoded.founder,
    };
  }

  hashRefreshToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  getRefreshTtlSeconds(): number {
    return this.refreshTtlSec;
  }

  getAccessTtlSeconds(): number {
    return this.accessTtlSec;
  }
}
