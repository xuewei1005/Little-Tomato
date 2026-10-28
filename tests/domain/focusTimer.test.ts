import { describe, expect, it } from 'vitest';
import {
  createFocusTimerState,
  confirmStandUp,
  formatTimerSeconds,
  getStandUpPromptMood,
  pauseFocusTimer,
  resumeFocusTimer,
  skipFocusTimer,
  startFocusTimer,
  tickFocusTimer,
} from '../../src/domain/focusTimer';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, SETTINGS_STORAGE_KEY } from '../../src/domain/settingsStore';
import type { FocusTimerConfig, FocusTimerState } from '../../src/domain/types';

const customConfig: FocusTimerConfig = {
  focusMinutes: 37,
  shortBreakMinutes: 7,
  longBreakMinutes: 19,
  longBreakEvery: 2,
  autoStartNext: true,
};

describe('FocusTimer', () => {
  it.each(['shortBreak', 'longBreak'] as const)('stops after %s by default until started manually', (phase) => {
    const runningBreak: FocusTimerState = { ...createFocusTimerState(), phase, status: 'running', startedAtMs: 0, totalSec: 60, remainingSec: 60, completedFocusCount: 1 };
    const ended = tickFocusTimer(runningBreak, 60_000);
    expect(ended).toMatchObject({ phase, status: 'completed', remainingSec: 0, completedFocusCount: 1 });
    expect(startFocusTimer(ended, 70_000)).toMatchObject({ phase: 'focus', status: 'running', startedAtMs: 70_000 });
  });
  it('starts a focus session and calculates elapsed time from the clock', () => {
    const idle = createFocusTimerState({ focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15 }, 1_000);
    const running = startFocusTimer(idle, 1_000);
    const afterTenSeconds = tickFocusTimer(running, 11_000);

    expect(afterTenSeconds.status).toBe('running');
    expect(afterTenSeconds.remainingSec).toBe(24 * 60 + 50);
    expect(formatTimerSeconds(afterTenSeconds.remainingSec)).toBe('24:50');
  });

  it('stops at the stand-up confirmation gate when a focus session ends', () => {
    const idle = createFocusTimerState({ focusMinutes: 1, shortBreakMinutes: 5, longBreakMinutes: 15 }, 0);
    const running = startFocusTimer(idle, 0, { focusMinutes: 1, shortBreakMinutes: 5, longBreakMinutes: 15 });
    const ended = tickFocusTimer(running, 61_000);

    expect(ended.phase).toBe('standUp');
    expect(ended.status).toBe('awaitingStandUp');
    expect(ended.pendingBreakPhase).toBe('shortBreak');
    expect(ended.remainingSec).toBe(0);
    expect(ended.completedFocusCount).toBe(1);
  });

  it('only starts the short break after the user confirms standing up', () => {
    const waiting: FocusTimerState = {
      ...createFocusTimerState({ focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15 }),
      phase: 'standUp',
      status: 'awaitingStandUp',
      pendingBreakPhase: 'shortBreak',
      standUpRequestedAtMs: 1_000,
      remainingSec: 0,
      totalSec: 0,
    };
    const resumed = confirmStandUp(waiting, 5_000, { focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15 });

    expect(resumed.phase).toBe('shortBreak');
    expect(resumed.status).toBe('running');
    expect(resumed.remainingSec).toBe(5 * 60);
    expect(resumed.startedAtMs).toBe(5_000);
  });

  it('does not advance while waiting and becomes angry after the grace period', () => {
    const waiting: FocusTimerState = {
      ...createFocusTimerState(),
      phase: 'standUp',
      status: 'awaitingStandUp',
      pendingBreakPhase: 'shortBreak',
      standUpRequestedAtMs: 1_000,
      remainingSec: 0,
      totalSec: 0,
    };

    expect(tickFocusTimer(waiting, 30 * 60_000)).toEqual(waiting);
    expect(getStandUpPromptMood(waiting, 120_999)).toBe('waiting');
    expect(getStandUpPromptMood(waiting, 121_000)).toBe('angry');
  });

  it('uses the latest configuration when starting from an idle state with an old duration', () => {
    const running = startFocusTimer(createFocusTimerState(), 10_000, customConfig);

    expect(running).toMatchObject({ phase: 'focus', status: 'running', totalSec: 2_220, remainingSec: 2_220 });
    expect(tickFocusTimer(running, 20_000, customConfig).remainingSec).toBe(2_210);
  });

  it('uses the focus duration rather than the previous phase duration when restarting a completed timer', () => {
    const completed: FocusTimerState = { ...createFocusTimerState(), phase: 'shortBreak', status: 'completed', totalSec: 300, remainingSec: 0 };

    expect(startFocusTimer(completed, 10_000, customConfig)).toMatchObject({ phase: 'focus', totalSec: 2_220, remainingSec: 2_220 });
  });

  it('does not restart an already running session when configuration changes', () => {
    const running = startFocusTimer(createFocusTimerState(), 0);
    const progressed = tickFocusTimer(running, 10_000);

    expect(startFocusTimer(progressed, 20_000, customConfig)).toEqual(progressed);
    expect(tickFocusTimer(progressed, 20_000, customConfig)).toMatchObject({ totalSec: 1_500, remainingSec: 1_480 });
  });

  it('preserves elapsed work across repeated pauses and excludes paused wall-clock time', () => {
    const running = startFocusTimer(createFocusTimerState(), 0);
    const paused = pauseFocusTimer(running, 10_000);
    const resumed = resumeFocusTimer(paused, 100_000);
    const pausedAgain = pauseFocusTimer(resumed, 105_000, customConfig);
    const resumedAgain = resumeFocusTimer(pausedAgain, 200_000);

    expect(paused).toMatchObject({ status: 'paused', totalSec: 1_500, remainingSec: 1_490 });
    expect(tickFocusTimer(paused, 90_000)).toEqual(paused);
    expect(pausedAgain.remainingSec).toBe(1_485);
    expect(tickFocusTimer(resumedAgain, 201_000, customConfig)).toMatchObject({ totalSec: 1_500, remainingSec: 1_484 });
  });

  it('treats start on a paused session as resume without applying a new duration', () => {
    const paused = pauseFocusTimer(startFocusTimer(createFocusTimerState(), 0), 10_000);
    const resumed = startFocusTimer(paused, 100_000, customConfig);

    expect(tickFocusTimer(resumed, 101_000, customConfig)).toMatchObject({ totalSec: 1_500, remainingSec: 1_489 });
  });

  it('does not bypass stand-up confirmation or reset running time through repeated resume commands', () => {
    const running = startFocusTimer(createFocusTimerState(), 0);
    const progressed = tickFocusTimer(running, 10_000);
    const waiting = skipFocusTimer(progressed, 10_000);

    expect(resumeFocusTimer(progressed, 20_000)).toEqual(progressed);
    expect(resumeFocusTimer(createFocusTimerState(), 20_000).status).toBe('idle');
    expect(startFocusTimer(waiting, 20_000, customConfig)).toEqual(waiting);
    expect(resumeFocusTimer(waiting, 20_000)).toEqual(waiting);
  });

  it.each(['shortBreak', 'longBreak'] as const)('starts the next focus clock at the %s boundary with the latest duration', (phase) => {
    const runningBreak: FocusTimerState = { ...createFocusTimerState(), phase, status: 'running', startedAtMs: 100_000, totalSec: 60, remainingSec: 60 };
    const nextFocus = tickFocusTimer(runningBreak, 160_000, customConfig);

    expect(nextFocus).toMatchObject({ phase: 'focus', totalSec: 2_220, remainingSec: 2_220, startedAtMs: 160_000 });
    expect(tickFocusTimer(nextFocus, 161_000, customConfig).remainingSec).toBe(2_219);
  });

  it('uses custom break lengths and long-break frequency in the following sessions', () => {
    const first = startFocusTimer(createFocusTimerState(), 0, customConfig);
    const firstGate = tickFocusTimer(first, 2_220_000, customConfig);
    const shortBreak = confirmStandUp(firstGate, 2_230_000, customConfig);
    const second = skipFocusTimer(shortBreak, 2_240_000, customConfig);
    const secondGate = tickFocusTimer(second, 4_460_000, customConfig);
    const longBreak = confirmStandUp(secondGate, 4_470_000, customConfig);

    expect(shortBreak).toMatchObject({ phase: 'shortBreak', totalSec: 420, remainingSec: 420 });
    expect(secondGate).toMatchObject({ completedFocusCount: 2, pendingBreakPhase: 'longBreak', status: 'awaitingStandUp' });
    expect(longBreak).toMatchObject({ phase: 'longBreak', totalSec: 1_140, remainingSec: 1_140 });
  });

  it('does not turn a completed focus into a paused stand-up gate', () => {
    const oneMinute = { ...customConfig, focusMinutes: 1 };
    const pausedAtEnd = pauseFocusTimer(startFocusTimer(createFocusTimerState(), 0, oneMinute), 60_000, oneMinute);

    expect(pausedAtEnd).toMatchObject({ status: 'awaitingStandUp', remainingSec: 0, completedFocusCount: 1 });
  });
});

describe('persisted focus durations', () => {
  it('round-trips arbitrary durations and preserves unrelated settings', () => {
    const storage = new Map<string, string>();
    const target = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); } };

    saveSettings({ ...DEFAULT_SETTINGS, petName: '测试伙伴', focus: customConfig }, target);

    expect(loadSettings(target)).toMatchObject({ petName: '测试伙伴', focus: customConfig });
  });

  it.each([
    { focusMinutes: 0, shortBreakMinutes: 61, longBreakMinutes: -1, longBreakEvery: 13 },
    { focusMinutes: 181, shortBreakMinutes: 0, longBreakMinutes: 1.5, longBreakEvery: 0 },
    { focusMinutes: 2.5, shortBreakMinutes: null, longBreakMinutes: '10', longBreakEvery: 1.5 },
  ])('replaces invalid persisted duration fields with safe defaults: %j', (focus) => {
    const target = { getItem: () => JSON.stringify({ focus }), setItem: () => undefined };

    expect(loadSettings(target).focus).toMatchObject({ focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4 });
  });

  it.each([
    { focusMinutes: 1, shortBreakMinutes: 1, longBreakMinutes: 1, longBreakEvery: 1 },
    { focusMinutes: 180, shortBreakMinutes: 60, longBreakMinutes: 60, longBreakEvery: 12 },
  ])('keeps valid inclusive duration boundaries: %j', (focus) => {
    const target = { getItem: (key: string) => key === SETTINGS_STORAGE_KEY ? JSON.stringify({ focus }) : null, setItem: () => undefined };

    expect(loadSettings(target).focus).toMatchObject(focus);
  });
});
