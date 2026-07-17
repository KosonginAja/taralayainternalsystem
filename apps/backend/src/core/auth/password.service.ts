import { hash, verify } from 'argon2';
import { config } from '../config';

export class PasswordService {
  async hash(plaintext: string): Promise<string> {
    return hash(plaintext, {
      memoryCost: config.ARGON2_MEMORY_COST,
      timeCost: config.ARGON2_TIME_COST,
      parallelism: config.ARGON2_PARALLELISM,
    });
  }

  async verify(hash: string, plaintext: string): Promise<boolean> {
    return verify(hash, plaintext);
  }
}
