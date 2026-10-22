import { describe, expect, it } from 'vitest';
import { createFocusTimerState } from '../../src/domain/focusTimer';
import { createTodo } from '../../src/domain/todoStore';
import { buildTodoReminderEvent, buildTimerStateEvent, pickTodoReminder } from '../../src/ui/settings/runtimeBridge';

describe('settings runtime bridge', () => {
  it('sends a minimal timer event to the pet', () => {
    const state = createFocusTimerState();
    expect(buildTimerStateEvent(state, 123)).toEqual({ type: 'timer-state', state, emittedAtMs: 123 });
  });

  it('prioritizes a starred due todo and never includes body-like fields', () => {
    const normal = createTodo({ title: '整理照片', targetDate: '2026-10-22' }, 1);
    const starred = createTodo({ title: '今天交材料', targetDate: '2026-10-20', starred: true }, 2);
    const selected = pickTodoReminder([normal, starred], new Date('2026-10-20T09:00:00+08:00').getTime(), 'standard');
    const event = selected && buildTodoReminderEvent(selected, 3_000);

    expect(selected?.id).toBe(starred.id);
    expect(event).toMatchObject({ type: 'reminder', priority: 'todo', message: '今天交材料，我们先做一小步？' });
    expect(JSON.stringify(event)).not.toContain('body');
  });

  it('sometimes includes both nicknames in a Todo reminder without changing the payload shape', () => {
    const todo = createTodo({ title: '整理照片' }, 1);
    const event = buildTodoReminderEvent(todo, 180_000, '小陈', '番茄酱');

    expect(event.message).toContain('小陈');
    expect(event.message).toContain('番茄酱');
  });
});
