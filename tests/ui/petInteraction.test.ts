import { describe, expect, it } from 'vitest';
import { pickPetReaction } from '../../src/ui/pet/petInteraction';

describe('pet interaction reactions', () => {
  it('returns a stable reaction for a supplied random value', () => {
    expect(pickPetReaction(() => 0)).toEqual({ state: 'happy', message: '嘿嘿，叶子都开心得翘起来啦！' });
    expect(pickPetReaction(() => 0.99)).toEqual({ state: 'happy', message: '我的终极梦想，是拥有自己的小花盆！' });
  });

  it('includes the supplied expressive actions and keeps reaction messages brief', () => {
    const reactions = Array.from({ length: 100 }, (_, index) => pickPetReaction(() => index / 100));

    expect(reactions).toHaveLength(100);
    expect(reactions.some(({ state }) => state === 'stretch')).toBe(true);
    expect(reactions.some(({ state }) => state === 'celebrate')).toBe(true);
    expect(reactions.some(({ state }) => state === 'sleepy')).toBe(true);
    for (const { message } of reactions) expect(Array.from(message).length).toBeLessThanOrEqual(24);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1])('safely handles reaction RNG %s', (sample) => {
    expect(pickPetReaction(() => sample).state).toBe('happy');
  });
});
