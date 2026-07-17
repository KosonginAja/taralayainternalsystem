import { USER_STATUS } from '@taralaya/shared';
import type { UserStatus } from '@taralaya/shared';
import { InvalidTransitionError } from '../../../core/errors';

type Transition = { from: UserStatus[]; to: UserStatus };

const TRANSITIONS: Transition[] = [
  { from: ['invited'], to: 'active' },
  { from: ['active', 'invited'], to: 'suspended' },
  { from: ['suspended', 'invited'], to: 'active' },
  { from: ['active', 'suspended', 'invited'], to: 'deactivated' },
];

/**
 * Validates a user status transition.
 * Throws InvalidTransitionError if the transition is not allowed.
 */
export function assertUserTransition(from: UserStatus, to: UserStatus): void {
  if (from === to) return;

  const allowed = TRANSITIONS.find((t) => t.to === to && t.from.includes(from));
  if (!allowed) {
    throw new InvalidTransitionError(from, to, 'User');
  }
}

export function isValidUserStatus(value: string): value is UserStatus {
  return Object.values(USER_STATUS).includes(value as UserStatus);
}
