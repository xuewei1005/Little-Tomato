import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFocusTimerState } from '../../src/domain/focusTimer';
import { usePetRuntime } from '../../src/ui/pet/usePetRuntime';
import { PET_RUNTIME_EVENT, PET_RUNTIME_SYNC_REQUEST, type PetRuntimeEvent } from '../../src/domain/petRuntime';

const listen = vi.hoisted(() => vi.fn());
const emit = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const listeners = vi.hoisted(() => new Map<string, (event: { payload: PetRuntimeEvent }) => void>());

vi.mock('@tauri-apps/api/event', () => ({
  listen: (event: string, handler: (event: { payload: PetRuntimeEvent }) => void) => {
    listen(event, handler);
    listeners.set(event, handler);
    return Promise.resolve(() => listeners.delete(event));
  },
  emit,
}));

function Harness() {
  const runtime = usePetRuntime({ displayName: '朋友' });
  return <output data-testid="runtime">{JSON.stringify({ message: runtime.message, visualState: runtime.visualState, showTip: runtime.showTip, showConfetti: runtime.showConfetti, standUpMood: runtime.standUpMood })}</output>;
}

function readRuntime() {
  return JSON.parse(screen.getByTestId('runtime').textContent ?? '{}') as Record<string, string | boolean>;
}

describe('usePetRuntime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    listeners.clear();
    listen.mockClear();
    emit.mockClear();
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  });

  it('requests a sync on mount and turns a focus completion into one celebration', () => {
    render(<Harness />);
    expect(emit).toHaveBeenCalledWith(PET_RUNTIME_SYNC_REQUEST);
    expect(listen).toHaveBeenCalledWith(PET_RUNTIME_EVENT, expect.any(Function));

    const waiting = { ...createFocusTimerState(), phase: 'standUp' as const, status: 'awaitingStandUp' as const, totalSec: 0, remainingSec: 0, pendingBreakPhase: 'shortBreak' as const, standUpRequestedAtMs: 10_000 };
    act(() => listeners.get(PET_RUNTIME_EVENT)?.({ payload: { type: 'timer-state', state: waiting, emittedAtMs: 10_000 } }));

    expect(readRuntime()).toMatchObject({ showConfetti: true, visualState: 'celebrate', standUpMood: 'waiting' });
    act(() => { vi.advanceTimersByTime(4_200); });
    expect(readRuntime().showConfetti).toBe(false);
  });

  it('turns the stand-up prompt angry after the grace period', () => {
    render(<Harness />);
    const waiting = { ...createFocusTimerState(), phase: 'standUp' as const, status: 'awaitingStandUp' as const, totalSec: 0, remainingSec: 0, pendingBreakPhase: 'shortBreak' as const, standUpRequestedAtMs: 10_000 };
    act(() => listeners.get(PET_RUNTIME_EVENT)?.({ payload: { type: 'timer-state', state: waiting, emittedAtMs: 10_000 } }));

    act(() => { vi.advanceTimersByTime(120_000); });
    expect(readRuntime()).toMatchObject({ standUpMood: 'angry', visualState: 'angry' });
    expect(readRuntime().message).toContain('起身');
  });

  it('lets a reminder replace a temporary tip', () => {
    render(<Harness />);
    act(() => { vi.advanceTimersByTime(800); });
    expect(readRuntime().showTip).toBe(true);

    act(() => listeners.get(PET_RUNTIME_EVENT)?.({ payload: { type: 'reminder', priority: 'todo', message: '先做一小步', createdAtMs: 11_000, expiresAtMs: 20_000 } }));
    expect(readRuntime()).toMatchObject({ message: '先做一小步', showTip: false });
  });

  it('shows tips again within about thirty seconds', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    render(<Harness />);
    act(() => { vi.advanceTimersByTime(800); });
    expect(readRuntime().showTip).toBe(true);
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(readRuntime().showTip).toBe(true);
    random.mockRestore();
  });

  it('discards a queued stand-up prompt after the user confirms while another reminder is visible', () => {
    render(<Harness />);
    act(() => listeners.get(PET_RUNTIME_EVENT)?.({ payload: { type: 'reminder', priority: 'todo', message: '先做一小步', createdAtMs: 10_000, expiresAtMs: 40_000 } }));
    const waiting = { ...createFocusTimerState(), phase: 'standUp' as const, status: 'awaitingStandUp' as const, totalSec: 0, remainingSec: 0, pendingBreakPhase: 'shortBreak' as const, standUpRequestedAtMs: 10_000 };
    act(() => listeners.get(PET_RUNTIME_EVENT)?.({ payload: { type: 'timer-state', state: waiting, emittedAtMs: 10_000 } }));
    const resting = { ...createFocusTimerState(), phase: 'shortBreak' as const, status: 'running' as const, startedAtMs: 10_000, totalSec: 300, remainingSec: 300 };
    act(() => listeners.get(PET_RUNTIME_EVENT)?.({ payload: { type: 'timer-state', state: resting, emittedAtMs: 10_000 } }));
    act(() => { vi.advanceTimersByTime(14_000); });
    expect(readRuntime().message).not.toContain('站起来');
  });
});
