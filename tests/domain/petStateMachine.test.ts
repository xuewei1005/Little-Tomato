import { describe, expect, it } from 'vitest';
import { getAmbientPetState, getPetVisualState } from '../../src/domain/petStateMachine';

describe('PetStateMachine', () => {
  it('prioritizes an incoming notification over idle animation', () => {
    expect(
      getPetVisualState({ focusPhase: 'idle', hasReminder: false, hasIncomingNotification: true }),
    ).toBe('notification');
  });

  it('uses stretch state for a stand-up reminder', () => {
    expect(
      getPetVisualState({ focusPhase: 'standUp', hasReminder: true, hasIncomingNotification: false }),
    ).toBe('stretch');
  });

  it('keeps a low-frequency ambient action when there is no higher-priority reminder', () => {
    expect(
      getPetVisualState({
        focusPhase: 'idle',
        hasReminder: false,
        hasIncomingNotification: false,
        ambientState: 'wave',
      }),
    ).toBe('wave');
  });

  it('chooses expressive ambient states from a supplied random value', () => {
    expect(getAmbientPetState(() => 0)).toBe('happy');
    expect(getAmbientPetState(() => 0.99)).toBe('sleepy');
  });

  it('makes hops and affectionate gestures available during ambient play', () => {
    const states = new Set(Array.from({ length: 100 }, (_, index) => getAmbientPetState(() => index / 100)));

    expect(states).toEqual(new Set(['happy', 'wave', 'spin', 'stretch', 'wink', 'thinking', 'bounce', 'loved', 'sleepy']));
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1])('safely handles ambient RNG %s', (sample) => {
    expect(getAmbientPetState(() => sample)).toBe('happy');
  });

  it('keeps ambient actions below notification, celebration, reminder and focus priorities', () => {
    const base = { focusPhase: 'idle' as const, hasReminder: false, hasIncomingNotification: false, ambientState: 'spin' as const };

    expect(getPetVisualState({ ...base, hasIncomingNotification: true, isCelebrating: true })).toBe('notification');
    expect(getPetVisualState({ ...base, isCelebrating: true, hasReminder: true })).toBe('celebrate');
    expect(getPetVisualState({ ...base, hasReminder: true })).toBe('stretch');
    expect(getPetVisualState({ ...base, focusPhase: 'focus' })).toBe('focus');
  });
});
