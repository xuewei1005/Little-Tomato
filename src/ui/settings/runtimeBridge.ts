import { getNextTodoReminderAt, getTodoReminderPolicy } from '../../domain/todoReminderPolicy';
import { personalizePetSpeech } from '../../domain/petSpeech';
import type { PetRuntimeEvent, PetSettingsSnapshot } from '../../domain/petRuntime';
import type { AppLanguage, FocusTimerState, TodoItem, TodoReminderMode } from '../../domain/types';
import { translate } from '../../i18n/catalog';

export function buildTimerStateEvent(state: FocusTimerState, emittedAtMs = Date.now()): Extract<PetRuntimeEvent, { type: 'timer-state' }> {
  return { type: 'timer-state', state, emittedAtMs };
}

export function buildPetSettingsEvent(settings: PetSettingsSnapshot, emittedAtMs = Date.now()): Extract<PetRuntimeEvent, { type: 'settings-state' }> {
  return { type: 'settings-state', settings, emittedAtMs };
}

export function buildTodoReminderEvent(
  todo: TodoItem,
  createdAtMs = Date.now(),
  displayName?: string,
  petName?: string,
  language: AppLanguage = 'zh-CN',
): Extract<PetRuntimeEvent, { type: 'reminder' }> {
  const baseMessage = translate(language, 'todo.reminder', { title: todo.title });
  const variation = Math.floor((createdAtMs + todo.createdAtMs) / 60_000);
  return {
    type: 'reminder',
    priority: 'todo',
    message: personalizePetSpeech(baseMessage, displayName, petName, variation, language),
    createdAtMs,
    expiresAtMs: createdAtMs + 12_000,
    visualState: 'stretch',
  };
}

export function buildScheduledReminderEvent(message: string, createdAtMs = Date.now()): Extract<PetRuntimeEvent, { type: 'reminder' }> {
  return { type: 'reminder', priority: 'scheduled', message, createdAtMs, expiresAtMs: createdAtMs + 12_000, visualState: 'notification' };
}

export function pickTodoReminder(todos: TodoItem[], nowMs: number, defaultMode: TodoReminderMode): TodoItem | null {
  const candidates = todos.filter((todo) => {
    const nextAt = getNextTodoReminderAt(todo, nowMs, defaultMode);
    return nextAt !== null && nextAt <= nowMs;
  });
  return candidates.sort((left, right) => {
    const rightPolicy = getTodoReminderPolicy(right, nowMs, defaultMode);
    const leftPolicy = getTodoReminderPolicy(left, nowMs, defaultMode);
    if (rightPolicy.weight !== leftPolicy.weight) return rightPolicy.weight - leftPolicy.weight;
    if (right.starred !== left.starred) return Number(right.starred) - Number(left.starred);
    return (right.updatedAtMs ?? right.createdAtMs) - (left.updatedAtMs ?? left.createdAtMs);
  })[0] ?? null;
}
