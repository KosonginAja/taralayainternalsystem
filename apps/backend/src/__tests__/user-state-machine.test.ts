import { describe, it, expect } from '@jest/globals';
import { assertUserTransition } from '../modules/iam/domain/user-state-machine';

describe('UserStateMachine', () => {
  it('allows invited → active', () => {
    expect(() => assertUserTransition('invited', 'active')).not.toThrow();
  });

  it('allows active → suspended', () => {
    expect(() => assertUserTransition('active', 'suspended')).not.toThrow();
  });

  it('allows suspended → active', () => {
    expect(() => assertUserTransition('suspended', 'active')).not.toThrow();
  });

  it('allows active → deactivated', () => {
    expect(() => assertUserTransition('active', 'deactivated')).not.toThrow();
  });

  it('throws on deactivated → active', () => {
    expect(() => assertUserTransition('deactivated', 'active')).toThrow('Cannot transition');
  });

  it('throws on deactivated → suspended', () => {
    expect(() => assertUserTransition('deactivated', 'suspended')).toThrow('Cannot transition');
  });

  it('allows same state (no-op)', () => {
    expect(() => assertUserTransition('active', 'active')).not.toThrow();
  });
});
