import { describe, expect, it } from 'vitest';
import { getMoodVisualState, getPetMood } from '../../src/domain/petEmotion';

describe('pet feelings', () => {
  it('cheers up after a touch, settles, then misses you after ten minutes', () => {
    expect(getPetMood(15_000, 0, 10)).toBe('loved');
    expect(getPetMood(60_000, 0, 10)).toBe('content');
    expect(getPetMood(600_000, 0, 10)).toBe('lonely');
    expect(getMoodVisualState(getPetMood(600_001, 600_000, 10))).toBe('loved');
  });

  it('looks sleepy late at night but a touch still cheers it up', () => {
    expect(getPetMood(60_000, 0, 23)).toBe('sleepy');
    expect(getPetMood(60_000, 59_000, 23)).toBe('loved');
  });
});
