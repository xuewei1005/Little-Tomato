import type { FocusBreakPhase, FocusPhase, FocusTimerConfig, FocusTimerState } from './types';

export const DEFAULT_FOCUS_TIMER_CONFIG: FocusTimerConfig = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
  standUpMinutes: 3,
};

function phaseDurationSec(phase: FocusPhase, config: FocusTimerConfig): number {
  switch (phase) {
    case 'shortBreak':
      return config.shortBreakMinutes * 60;
    case 'longBreak':
      return config.longBreakMinutes * 60;
    case 'standUp':
      return (config.standUpMinutes ?? 3) * 60;
    case 'focus':
    case 'idle':
    default:
      return config.focusMinutes * 60;
  }
}

export function createFocusTimerState(
  config: FocusTimerConfig = DEFAULT_FOCUS_TIMER_CONFIG,
  _nowMs = Date.now(),
): FocusTimerState {
  return {
    phase: 'idle',
    status: 'idle',
    remainingSec: phaseDurationSec('idle', config),
    totalSec: phaseDurationSec('idle', config),
    completedFocusCount: 0,
  };
}

export function startFocusTimer(
  state: FocusTimerState,
  nowMs: number,
  config: FocusTimerConfig = DEFAULT_FOCUS_TIMER_CONFIG,
): FocusTimerState {
  if (state.status === 'running' || state.status === 'awaitingStandUp') return state;
  if (state.status === 'paused') return resumeFocusTimer(state, nowMs);
  const phase = state.phase === 'idle' || state.status === 'completed' ? 'focus' : state.phase;
  const totalSec = phaseDurationSec(phase, config);
  return {
    ...state,
    phase,
    status: 'running',
    totalSec,
    remainingSec: totalSec,
    startedAtMs: nowMs,
    pendingBreakPhase: undefined,
    standUpRequestedAtMs: undefined,
  };
}

function nextPhase(state: FocusTimerState, config: FocusTimerConfig, nowMs: number): FocusTimerState {
  if (state.phase === 'focus') {
    const completedFocusCount = state.completedFocusCount + 1;
    const pendingBreakPhase: FocusBreakPhase = completedFocusCount % (config.longBreakEvery ?? 4) === 0 ? 'longBreak' : 'shortBreak';
    return {
      ...state,
      phase: 'standUp',
      status: 'awaitingStandUp',
      totalSec: 0,
      remainingSec: 0,
      completedFocusCount,
      pendingBreakPhase,
      startedAtMs: undefined,
      standUpRequestedAtMs: nowMs,
    };
  }

  const totalSec = phaseDurationSec('focus', config);
  return {
    ...state,
    phase: 'focus',
    status: 'running',
    totalSec,
    remainingSec: totalSec,
    startedAtMs: nowMs,
    pendingBreakPhase: undefined,
    standUpRequestedAtMs: undefined,
  };
}

export function tickFocusTimer(
  state: FocusTimerState,
  nowMs: number,
  config: FocusTimerConfig = DEFAULT_FOCUS_TIMER_CONFIG,
): FocusTimerState {
  if (state.status !== 'running' || state.startedAtMs === undefined) return state;

  const elapsedSec = Math.max(0, Math.floor((nowMs - state.startedAtMs) / 1000));
  const remainingSec = Math.max(0, state.totalSec - elapsedSec);
  if (remainingSec > 0) return { ...state, remainingSec };

  return nextPhase(state, config, nowMs);
}

export function confirmStandUp(
  state: FocusTimerState,
  nowMs: number,
  config: FocusTimerConfig = DEFAULT_FOCUS_TIMER_CONFIG,
): FocusTimerState {
  if (state.phase !== 'standUp' || state.status !== 'awaitingStandUp' || !state.pendingBreakPhase) return state;
  const totalSec = phaseDurationSec(state.pendingBreakPhase, config);
  return {
    ...state,
    phase: state.pendingBreakPhase,
    status: 'running',
    totalSec,
    remainingSec: totalSec,
    startedAtMs: nowMs,
    pendingBreakPhase: undefined,
    standUpRequestedAtMs: undefined,
  };
}

export function getStandUpPromptMood(
  state: FocusTimerState,
  nowMs: number,
  graceMs = 120_000,
): 'waiting' | 'angry' {
  if (state.status !== 'awaitingStandUp' || state.standUpRequestedAtMs === undefined) return 'waiting';
  return nowMs - state.standUpRequestedAtMs >= graceMs ? 'angry' : 'waiting';
}

export function pauseFocusTimer(
  state: FocusTimerState,
  nowMs: number,
  config: FocusTimerConfig = DEFAULT_FOCUS_TIMER_CONFIG,
): FocusTimerState {
  if (state.status !== 'running') return state;
  const ticked = tickFocusTimer(state, nowMs, config);
  return { ...ticked, status: ticked.status === 'running' ? 'paused' : ticked.status, startedAtMs: undefined };
}

export function resumeFocusTimer(state: FocusTimerState, nowMs: number): FocusTimerState {
  if (state.status !== 'paused') return state;
  // tick measures from the session's origin, so retain work done before pausing.
  const elapsedSec = state.totalSec - state.remainingSec;
  return { ...state, status: 'running', startedAtMs: nowMs - elapsedSec * 1_000 };
}

export function skipFocusTimer(
  state: FocusTimerState,
  nowMs: number,
  config: FocusTimerConfig = DEFAULT_FOCUS_TIMER_CONFIG,
): FocusTimerState {
  if (state.phase === 'standUp' && state.status === 'awaitingStandUp') return confirmStandUp(state, nowMs, config);
  return nextPhase(state, config, nowMs);
}

export function formatTimerSeconds(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60).toString().padStart(2, '0');
  const remainder = (safeSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}
