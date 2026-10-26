import { describe, expect, it } from 'vitest';
import { createFocusTimerState } from '../../src/domain/focusTimer';
import * as petRuntime from '../../src/domain/petRuntime';
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

describe('petRuntime timer sound cues', () => {
  it('maps timer cues to bundled audio resources', () => {
    const getTimerSoundPath = (petRuntime as unknown as {
      getTimerSoundPath?: (cue: 'start' | 'complete') => string;
    }).getTimerSoundPath;

    expect(getTimerSoundPath?.('start')).toBe('/sounds/timer-start.mp3');
    expect(getTimerSoundPath?.('complete')).toBe('/sounds/timer-complete.mp3');
  });

  it('emits a start cue when an idle timer begins running', () => {
    const idle = createFocusTimerState();
    const running = { ...idle, phase: 'focus' as const, status: 'running' as const, startedAtMs: 1_000 };
    const getTimerSoundCue = (petRuntime as unknown as {
      getTimerSoundCue?: (previous: typeof idle, next: typeof running) => string | null;
    }).getTimerSoundCue;

    expect(getTimerSoundCue?.(idle, running)).toBe('start');
  });

  it('emits a completion cue when focus changes to the stand-up gate', () => {
    const focus = { ...createFocusTimerState(), phase: 'focus' as const, status: 'running' as const };
    const standUp = { ...focus, phase: 'standUp' as const, status: 'awaitingStandUp' as const, remainingSec: 0, totalSec: 0 };
    const getTimerSoundCue = (petRuntime as unknown as {
      getTimerSoundCue?: (previous: typeof focus, next: typeof standUp) => string | null;
    }).getTimerSoundCue;

    expect(getTimerSoundCue?.(focus, standUp)).toBe('complete');
  });
});
