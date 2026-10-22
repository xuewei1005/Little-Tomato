import { describe, expect, it } from 'vitest';
import { getNextTodoReminderAt, getTodoReminderPolicy } from '../../src/domain/todoReminderPolicy';
import { createTodo } from '../../src/domain/todoStore';

describe('TodoReminderPolicy', () => {
  it('reminds a time-only task at its next clock time, not after the generic nudge delay', () => {
    const createdAt = new Date(2026, 9, 21, 14, 0).getTime();
    const todo = createTodo({ title: '去取快递', targetTime: '17:30' }, createdAt);
    expect(getNextTodoReminderAt(todo, createdAt)).toBe(new Date(2026, 9, 21, 17, 30).getTime());
    const passed = createTodo({ title: '明早喝水', targetTime: '09:00' }, createdAt);
    expect(getNextTodoReminderAt(passed, createdAt)).toBe(new Date(2026, 9, 22, 9, 0).getTime());
    const daily = { ...todo, repeatRule: 'daily' as const, lastRemindedAtMs: new Date(2026, 9, 21, 17, 30, 5).getTime() };
    expect(getNextTodoReminderAt(daily, daily.lastRemindedAtMs)).toBe(new Date(2026, 9, 22, 17, 30).getTime());
  });
  it('increases reminder frequency as the deadline approaches', () => {
    const soon = createTodo({ title: '今天要交的材料', targetDate: '2026-10-20' }, 0);
    const later = createTodo({ title: '下月计划', targetDate: '2026-11-20' }, 0);
    const now = new Date('2026-10-20T09:00:00+08:00').getTime();

    expect(getTodoReminderPolicy(soon, now).intervalMinutes).toBeLessThan(
      getTodoReminderPolicy(later, now).intervalMinutes,
    );
  });

  it('does not schedule repeated nudges for a completed todo', () => {
    const todo = createTodo({ title: '已完成', targetDate: '2026-10-20' }, 0);
    todo.status = 'completed';

    expect(getTodoReminderPolicy(todo, Date.now()).enabled).toBe(false);
  });

  it('gives an undated todo a stable first reminder in the 3–5 minute window', () => {
    const todo = createTodo({ title: '整理桌面' }, 10_000);
    const again = { ...todo };
    const firstAt = getNextTodoReminderAt(todo, 10_000);
    const secondAt = getNextTodoReminderAt(again, 10_000);

    expect(firstAt).toBe(secondAt);
    expect(firstAt! - todo.createdAtMs).toBeGreaterThanOrEqual(3 * 60_000);
    expect(firstAt! - todo.createdAtMs).toBeLessThanOrEqual(5 * 60_000);
    expect(getTodoReminderPolicy(todo).initialDelayMinutes).toBeGreaterThanOrEqual(3);
    expect(getTodoReminderPolicy(todo).initialDelayMinutes).toBeLessThanOrEqual(5);
    expect(getTodoReminderPolicy(todo).intervalMinutes).toBe(45);
  });

  it('uses a shorter interval and higher weight for a due or starred todo', () => {
    const far = createTodo({ title: '下月计划', targetDate: '2026-11-20' }, 0);
    const due = createTodo({ title: '今天要交的材料', targetDate: '2026-10-20' }, 0);
    const starred = createTodo({ title: '今天要交的重要材料', targetDate: '2026-10-20', starred: true }, 0);
    const now = new Date('2026-10-20T09:00:00+08:00').getTime();

    expect(getTodoReminderPolicy(due, now).intervalMinutes).toBeLessThan(getTodoReminderPolicy(far, now).intervalMinutes);
    expect(getTodoReminderPolicy(starred, now).weight).toBeGreaterThan(getTodoReminderPolicy(due, now).weight);
  });

  it('makes a newly created undated todo eligible during a normal work session', () => {
    const todo = createTodo({ title: '回家前买东西' }, 0);
    const firstReminderAt = getNextTodoReminderAt(todo, 12 * 60_000);

    expect(firstReminderAt).not.toBeNull();
    expect(firstReminderAt).toBeLessThanOrEqual(12 * 60_000);
  });

  it('speeds up reminders as the deadline enters the final day', () => {
    const now = new Date('2026-10-21T09:00:00+08:00').getTime();
    const tomorrow = createTodo({ title: '明天到期', targetDate: '2026-10-22' }, now);
    const today = createTodo({ title: '今天到期', targetDate: '2026-10-21' }, now);
    const overdue = createTodo({ title: '已经逾期', targetDate: '2026-10-20' }, now);

    expect(getTodoReminderPolicy(tomorrow, now).intervalMinutes).toBe(90);
    expect(getTodoReminderPolicy(today, now).intervalMinutes).toBe(30);
    expect(getTodoReminderPolicy(overdue, now).intervalMinutes).toBe(20);
  });
});
