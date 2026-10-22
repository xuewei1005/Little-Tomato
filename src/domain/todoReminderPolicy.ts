import { getTodoDateSnapshot, resolveTodoTargetTimestamp } from './todoDateService';
import type { TodoItem, TodoReminderMode } from './types';

export interface TodoReminderPolicy {
  enabled: boolean;
  intervalMinutes: number;
  initialDelayMinutes: number;
  maxPerDay: number;
  weight: number;
  explanation: string;
}

function applyMode(intervalMinutes: number, mode: TodoReminderMode): number {
  if (mode === 'gentle') return Math.round(intervalMinutes * 1.5);
  if (mode === 'active') return Math.max(30, Math.round(intervalMinutes * 0.7));
  return intervalMinutes;
}

function stableHash(value: string): number {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export function getTodoInitialDelayMinutes(todo: TodoItem, mode: TodoReminderMode = todo.reminderMode ?? 'standard'): number {
  // 新记下的、没有截止时间的事情，第一次提醒要在用户仍然记得它时出现。
  // 用稳定散列保留一点随机感，但把窗口控制在约 3–5 分钟，避免像“没有提醒”。
  const stableMinutes = 3 + (stableHash(todo.id) % 3);
  return Math.max(4, applyMode(stableMinutes, mode));
}

function getWeight(days: number | null, starred: boolean): number {
  const base = days === null ? 1 : days > 7 ? 2 : days >= 3 ? 3 : days >= 1 ? 4 : days === 0 ? 5 : 6;
  return base + (starred ? 2 : 0);
}

export function getTodoReminderPolicy(
  todo: TodoItem,
  nowMs = Date.now(),
  defaultMode: TodoReminderMode = 'standard',
): TodoReminderPolicy {
  if (todo.status !== 'active') {
    return { enabled: false, intervalMinutes: 0, initialDelayMinutes: 0, maxPerDay: 0, weight: 0, explanation: '完成的事情先不打扰你' };
  }

  const days = getTodoDateSnapshot(todo, nowMs).daysRemaining;
  const mode = todo.reminderMode ?? defaultMode;
  if (days === null || days > 7) {
    const intervalMinutes = days === null ? 45 : 6 * 60;
    return {
      enabled: true,
      intervalMinutes: applyMode(intervalMinutes, mode),
      initialDelayMinutes: days === null ? getTodoInitialDelayMinutes(todo, mode) : applyMode(intervalMinutes, mode),
      maxPerDay: days === null ? 6 : 3,
      weight: getWeight(days, todo.starred),
      explanation: days === null ? '没有截止时间，先轻轻提醒一下' : '还有时间，偶尔提醒一下',
    };
  }
  if (days >= 3) {
    const intervalMinutes = applyMode(6 * 60, mode);
    return { enabled: true, intervalMinutes, initialDelayMinutes: intervalMinutes, maxPerDay: 3, weight: getWeight(days, todo.starred), explanation: '还有时间，偶尔提醒一下' };
  }
  if (days >= 1) {
    const intervalMinutes = applyMode(90, mode);
    return { enabled: true, intervalMinutes, initialDelayMinutes: intervalMinutes, maxPerDay: 4, weight: getWeight(days, todo.starred), explanation: '临近截止，提醒会更有存在感' };
  }
  if (days === 0) {
    const intervalMinutes = applyMode(30, mode);
    return { enabled: true, intervalMinutes, initialDelayMinutes: intervalMinutes, maxPerDay: 8, weight: getWeight(days, todo.starred), explanation: '今天要完成，记得给它一个位置' };
  }
  const intervalMinutes = applyMode(20, mode);
  return { enabled: true, intervalMinutes, initialDelayMinutes: intervalMinutes, maxPerDay: 8, weight: getWeight(days, todo.starred), explanation: '已经过期，先处理最重要的一小步' };
}

export function getNextTodoReminderAt(todo: TodoItem, nowMs = Date.now(), defaultMode: TodoReminderMode = 'standard'):
  number | null {
  const policy = getTodoReminderPolicy(todo, nowMs, defaultMode);
  if (!policy.enabled || (todo.snoozedUntilMs && todo.snoozedUntilMs > nowMs)) return null;
  if (!todo.targetDate && !todo.lunarDate && todo.targetTime && /^([01]\d|2[0-3]):[0-5]\d$/u.test(todo.targetTime)) {
    if (todo.lastRemindedAtMs === undefined || todo.repeatRule !== 'none') return resolveTodoTargetTimestamp(todo, nowMs);
  }
  const anchor = todo.lastRemindedAtMs ?? todo.createdAtMs;
  const delayMinutes = todo.lastRemindedAtMs === undefined ? policy.initialDelayMinutes : policy.intervalMinutes;
  return anchor + delayMinutes * 60_000;
}
