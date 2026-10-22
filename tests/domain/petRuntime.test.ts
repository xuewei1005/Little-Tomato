import { describe, expect, it } from 'vitest';
import { selectPetNotice, type PetNotice } from '../../src/domain/petRuntime';

function notice(priority: PetNotice['priority'], expiresAtMs = 10_000): PetNotice {
  return { priority, message: priority, createdAtMs: 1_000, expiresAtMs };
}

describe('petRuntime notice arbitration', () => {
  it('lets a due todo replace a tip', () => {
    expect(selectPetNotice(notice('tip'), notice('todo'), 2_000)?.priority).toBe('todo');
  });

  it('allows a new tip after the previous bubble expires', () => {
    expect(selectPetNotice(notice('todo', 2_000), notice('tip'), 2_001)).toEqual(notice('tip'));
  });

  it('uses the newer event when two notices have the same priority', () => {
    const current = notice('todo');
    const next = { ...notice('todo'), message: 'new', createdAtMs: 2_000 };

    expect(selectPetNotice(current, next, 2_000)).toEqual(next);
  });
});
