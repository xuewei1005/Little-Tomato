import type { AppLanguage, FocusTimerState, PetTheme, PetVisualState } from './types';

export const PET_RUNTIME_EVENT = 'pet-runtime';
export const PET_RUNTIME_SYNC_REQUEST = 'pet-runtime-sync-request';

export type PetReminderPriority = 'timer' | 'todo' | 'scheduled' | 'interaction' | 'tip';

export interface PetNotice {
  priority: PetReminderPriority;
  message: string;
  createdAtMs: number;
  expiresAtMs: number;
  visualState?: PetVisualState;
}

export interface PetSettingsSnapshot {
  language: AppLanguage;
  petName: string;
  displayName: string;
  petTheme: PetTheme;
  opacity: number;
  animationEnabled: boolean;
  soundEnabled: boolean;
}

export type TimerSoundCue = 'start' | 'complete';

const TIMER_SOUND_PATHS: Record<TimerSoundCue, string> = {
  start: '/sounds/timer-start.mp3',
  complete: '/sounds/timer-complete.mp3',
};

export function getTimerSoundPath(cue: TimerSoundCue): string {
  return TIMER_SOUND_PATHS[cue];
}

export function getTimerSoundCue(previous: FocusTimerState, next: FocusTimerState): TimerSoundCue | null {
  if (previous.phase !== 'standUp' && next.phase === 'standUp' && next.status === 'awaitingStandUp') return 'complete';
  if (next.status === 'running' && previous.status !== 'running') return 'start';
  return null;
}

export type PetRuntimeEvent =
  | { type: 'timer-state'; state: FocusTimerState; emittedAtMs: number }
  | { type: 'settings-state'; settings: PetSettingsSnapshot; emittedAtMs: number }
  | { type: 'reminder'; priority: Exclude<PetReminderPriority, 'tip'>; message: string; createdAtMs: number; expiresAtMs?: number; visualState?: PetVisualState }
  | { type: 'tip'; message: string; createdAtMs: number; expiresAtMs?: number };

const PRIORITY_WEIGHT: Record<PetReminderPriority, number> = {
  timer: 50,
  todo: 40,
  scheduled: 30,
  interaction: 20,
  tip: 10,
};

export function getPetReminderPriority(priority: PetReminderPriority): number {
  return PRIORITY_WEIGHT[priority];
}

export function isPetNoticeActive(notice: PetNotice | null | undefined, nowMs = Date.now()): notice is PetNotice {
  return Boolean(notice && notice.expiresAtMs > nowMs);
}

export function selectPetNotice(current: PetNotice | null, candidate: PetNotice, nowMs = Date.now()): PetNotice | null {
  if (!isPetNoticeActive(candidate, nowMs)) return isPetNoticeActive(current, nowMs) ? current : null;
  if (!isPetNoticeActive(current, nowMs)) return candidate;

  const candidateWeight = getPetReminderPriority(candidate.priority);
  const currentWeight = getPetReminderPriority(current.priority);
  if (candidateWeight > currentWeight || (candidateWeight === currentWeight && candidate.createdAtMs >= current.createdAtMs)) {
    return candidate;
  }
  return current;
}

export function petNoticeFromRuntimeEvent(event: Exclude<PetRuntimeEvent, { type: 'timer-state' } | { type: 'settings-state' }>, nowMs = Date.now()): PetNotice | null {
  if (event.type === 'reminder') {
    return {
      priority: event.priority,
      message: event.message,
      createdAtMs: event.createdAtMs,
      expiresAtMs: event.expiresAtMs ?? nowMs + 10_000,
      visualState: event.visualState,
    };
  }
  return { priority: 'tip', message: event.message, createdAtMs: event.createdAtMs, expiresAtMs: event.expiresAtMs ?? nowMs + 8_000 };
}
