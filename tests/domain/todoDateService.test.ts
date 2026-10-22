import { describe, expect, it } from 'vitest';
import { formatTodoDate, getTodoDateSnapshot, lunarDateToSolarDateKey, resolveTodoTargetTimestamp, solarDateToLunarDateKey } from '../../src/domain/todoDateService';
import { createTodo } from '../../src/domain/todoStore';

describe('TodoDateService', () => {
  it('returns a readable countdown for an upcoming date', () => {
    const todo = createTodo({ title: '纪念日', targetDate: '2026-10-23' }, 0);
    const snapshot = getTodoDateSnapshot(todo, new Date('2026-10-20T10:00:00+08:00').getTime());

    expect(snapshot.daysRemaining).toBe(3);
    expect(snapshot.label).toBe('3天后');
    expect(snapshot.isOverdue).toBe(false);
  });

  it('does not treat a todo without a deadline as a countdown', () => {
    const todo = createTodo({ title: '随手记' }, 0);
    const snapshot = getTodoDateSnapshot(todo, Date.now());

    expect(snapshot.daysRemaining).toBeNull();
    expect(snapshot.label).toBe('无截止时间');
  });

  it('converts a lunar date before calculating the countdown', () => {
    const todo = createTodo({
      title: '春节',
      calendarType: 'lunar',
      lunarDate: '2026-01-01',
      // This is intentionally not the Gregorian equivalent. The date service
      // must use the stored lunar date as the source of truth.
      targetDate: '2026-01-01',
    }, 0);
    const snapshot = getTodoDateSnapshot(todo, new Date('2026-02-01T10:00:00+08:00').getTime());

    expect(snapshot.daysRemaining).toBe(16);
    expect(snapshot.label).toBe('16天后');
    expect(formatTodoDate(todo)).toContain('农历 2026年正月初一');
    expect(formatTodoDate(todo)).toContain('公历 2026年2月17日');
  });

  it('round trips negative leap months without confusing them with ordinary months', () => {
    expect(lunarDateToSolarDateKey('2025--06-01')).toBe('2025-07-25');
    expect(solarDateToLunarDateKey('2025-07-25')).toBe('2025--06-01');
    expect(lunarDateToSolarDateKey('2026--06-01')).toBeUndefined();
  });

  it.each(['2026-02-30', '2026-13-01', '2026-02-17junk', '2026-2-17'])('rejects invalid or noncanonical solar date %s', (value) => {
    expect(solarDateToLunarDateKey(value)).toBeUndefined();
    const todo = createTodo({ title: '无效日期', targetDate: value }, 0);
    expect(getTodoDateSnapshot(todo).label).toBe('日期待确认');
  });

  it.each(['2026-02-30', '2026--06-01', 'not-a-date'])('does not fall back to a cached solar date for invalid lunar date %s', (lunarDate) => {
    const todo = createTodo({ title: '无效农历', calendarType: 'lunar', lunarDate, targetDate: '2026-10-23' }, 0);
    expect(getTodoDateSnapshot(todo).label).toBe('日期待确认');
    expect(formatTodoDate(todo)).toContain('日期待确认');
    expect(formatTodoDate(todo)).not.toContain('公历');
  });

  it.each([
    [new Date(2026, 9, 20, 8, 0), 0, '今天 09:30'],
    [new Date(2026, 9, 20, 9, 30), 0, '今天 09:30'],
    [new Date(2026, 9, 20, 9, 30, 1), 0, '今天 09:30'],
    [new Date(2026, 9, 20, 9, 30, 59, 999), 0, '今天 09:30'],
    [new Date(2026, 9, 20, 9, 31), 0, '已到时间 09:30'],
  ])('keeps the first daily clock anchored to creation, including its full target minute at %s', (now, days, label) => {
    const todo = createTodo({ title: '喝水', targetTime: '09:30', repeatRule: 'daily' }, new Date(2026, 9, 20, 8).getTime());
    const result = getTodoDateSnapshot(todo, now.getTime());
    expect(result.daysRemaining).toBe(days);
    expect(result.label).toBe(label);
    expect(result.targetDateLabel).toBe('09:30');
    expect(result.isOverdue).toBe(label.startsWith('已到时间'));
    expect(result.isToday).toBe(days === 0);
    expect(formatTodoDate(todo)).toBe('每天 09:30');
  });

  it('anchors a one-off clock to creation rather than moving it to tomorrow after it is due', () => {
    const todo = createTodo({ title: '打电话', targetTime: '09:30' }, new Date(2026, 9, 20, 8).getTime());
    expect(getTodoDateSnapshot(todo, new Date(2026, 9, 20, 9, 30, 59, 999).getTime())).toMatchObject({ daysRemaining: 0, label: '今天 09:30', isOverdue: false });
    expect(getTodoDateSnapshot(todo, new Date(2026, 9, 20, 9, 31).getTime())).toMatchObject({ daysRemaining: 0, label: '已到时间 09:30', isOverdue: true });
    expect(getTodoDateSnapshot(todo, new Date(2026, 9, 21, 8).getTime())).toMatchObject({ daysRemaining: -1, label: '逾期1天 09:30', isOverdue: true });
    expect(formatTodoDate(todo)).toBe('09:30 · 不重复');
  });

  it('anchors a one-off to tomorrow when created after the clock minute', () => {
    const todo = createTodo({ title: '打电话', targetTime: '09:30' }, new Date(2026, 11, 31, 9, 31).getTime());
    expect(getTodoDateSnapshot(todo, new Date(2026, 11, 31, 10).getTime())).toMatchObject({ daysRemaining: 1, label: '明天 09:30' });
    expect(getTodoDateSnapshot(todo, new Date(2027, 0, 1, 9).getTime())).toMatchObject({ daysRemaining: 0, label: '今天 09:30' });
    expect(getTodoDateSnapshot(todo, new Date(2027, 0, 2, 9).getTime()).isOverdue).toBe(true);
  });

  it('uses tomorrow when creation is after the exact clock instant, even within that minute', () => {
    const createdAtMs = new Date(2026, 9, 20, 9, 30, 45).getTime();
    const todo = createTodo({ title: '打电话', targetTime: '09:30' }, createdAtMs);
    expect(getTodoDateSnapshot(todo, createdAtMs)).toMatchObject({ daysRemaining: 1, label: '明天 09:30' });
  });

  it('shows a delivered one-off clock without inventing another occurrence', () => {
    const todo = createTodo({ title: '打电话', targetTime: '09:30' }, new Date(2026, 9, 20, 8).getTime());
    todo.lastRemindedAtMs = new Date(2026, 9, 20, 9, 30, 10).getTime();
    expect(getTodoDateSnapshot(todo, new Date(2026, 9, 21, 8).getTime())).toMatchObject({ daysRemaining: null, label: '已提醒 09:30', isOverdue: false, isToday: false });
  });

  it('advances an already-delivered daily clock even within its target minute', () => {
    const todo = createTodo({ title: '喝水', targetTime: '09:30', repeatRule: 'daily' }, new Date(2026, 9, 20, 8).getTime());
    todo.lastRemindedAtMs = new Date(2026, 9, 20, 9, 30, 10).getTime();
    expect(getTodoDateSnapshot(todo, new Date(2026, 9, 20, 9, 30, 20).getTime())).toMatchObject({ daysRemaining: 1, label: '明天 09:30' });
    expect(getTodoDateSnapshot(todo, new Date(2026, 9, 21, 9).getTime())).toMatchObject({ daysRemaining: 0, label: '今天 09:30' });
  });

  it('does not count an earlier unrelated reminder as delivery of a future one-off clock', () => {
    const todo = createTodo({ title: '打电话', targetTime: '09:30' }, new Date(2026, 9, 20, 8).getTime());
    todo.lastRemindedAtMs = new Date(2026, 9, 20, 8, 30).getTime();
    expect(getTodoDateSnapshot(todo, new Date(2026, 9, 20, 9).getTime())).toMatchObject({ daysRemaining: 0, label: '今天 09:30' });
  });

  it('defaults to a one-off label when the formatter receives no repeat rule', () => {
    expect(formatTodoDate({ calendarType: 'solar', targetTime: '09:30' })).toBe('09:30 · 不重复');
  });

  it('resolves a one-off timestamp once from creation, independently of when it is read', () => {
    const todo = createTodo({ title: '打电话', targetTime: '09:30' }, new Date(2026, 9, 20, 10).getTime());
    const expected = new Date(2026, 9, 21, 9, 30).getTime();
    expect(resolveTodoTargetTimestamp(todo, new Date(2026, 9, 20, 11).getTime())).toBe(expected);
    expect(resolveTodoTargetTimestamp(todo, new Date(2026, 9, 22, 11).getTime())).toBe(expected);
  });

  it('keeps a missed daily occurrence due until an actual reminder advances its anchor', () => {
    const todo = createTodo({ title: '喝水', targetTime: '09:30', repeatRule: 'daily' }, new Date(2026, 9, 20, 8).getTime());
    const nowMs = new Date(2026, 9, 21, 8).getTime();
    expect(resolveTodoTargetTimestamp(todo, nowMs)).toBe(new Date(2026, 9, 20, 9, 30).getTime());
    expect(getTodoDateSnapshot(todo, nowMs)).toMatchObject({ daysRemaining: -1, isOverdue: true });
    todo.lastRemindedAtMs = nowMs;
    expect(resolveTodoTargetTimestamp(todo, nowMs)).toBe(new Date(2026, 9, 22, 9, 30).getTime());
    expect(getTodoDateSnapshot(todo, nowMs)).toMatchObject({ daysRemaining: 1, label: '明天 09:30' });
  });

  it.each([
    ['daily', new Date(2026, 9, 21, 9, 30)],
    ['weekly', new Date(2026, 9, 27, 9, 30)],
    ['monthly', new Date(2026, 10, 20, 9, 30)],
    ['yearly', new Date(2027, 9, 20, 9, 30)],
  ] as const)('resolves a %s clock occurrence from the last reminder, not the current day', (repeatRule, expected) => {
    const todo = createTodo({ title: '定时提醒', targetTime: '09:30', repeatRule }, new Date(2026, 9, 19, 8).getTime());
    todo.lastRemindedAtMs = new Date(2026, 9, 20, 9, 30, 15).getTime();
    const nowMs = new Date(2026, 9, 20, 10).getTime();
    expect(resolveTodoTargetTimestamp(todo, nowMs)).toBe(expected.getTime());
    expect(getTodoDateSnapshot(todo, nowMs).isOverdue).toBe(false);
  });

  it('resolves a converted lunar timestamp with its independent clock time', () => {
    const todo = createTodo({ title: '春节', calendarType: 'lunar', lunarDate: '2026-01-01', targetDate: '2026-01-01', targetTime: '09:30' }, 0);
    expect(resolveTodoTargetTimestamp(todo, new Date(2026, 0, 1).getTime())).toBe(new Date(2026, 1, 17, 9, 30).getTime());
    expect(resolveTodoTargetTimestamp({ ...todo, lunarDate: '2026-02-30' })).toBeNull();
    expect(resolveTodoTargetTimestamp({ ...todo, targetTime: '25:00' })).toBeNull();
    expect(resolveTodoTargetTimestamp(createTodo({ title: '随手记' }, 0))).toBeNull();
  });

  it('rejects malformed standalone clock times', () => {
    const todo = createTodo({ title: '无效时间', targetTime: '25:00' }, 0);
    expect(getTodoDateSnapshot(todo).label).toBe('时间待确认');
    expect(formatTodoDate(todo)).toContain('时间待确认');
  });

  it('advances yearly solar dates across a year boundary', () => {
    const todo = createTodo({ title: '生日', targetDate: '2020-01-03', repeatRule: 'yearly' }, 0);
    expect(getTodoDateSnapshot(todo, new Date(2026, 11, 31, 10).getTime()).daysRemaining).toBe(3);
    expect(getTodoDateSnapshot(todo, new Date(2027, 0, 3, 10).getTime()).label).toBe('今天');
  });

  it('waits until the next actual February 29 for yearly leap day events', () => {
    const todo = createTodo({ title: '闰日', targetDate: '2024-02-29', repeatRule: 'yearly' }, 0);
    expect(getTodoDateSnapshot(todo, new Date(2027, 11, 31).getTime()).daysRemaining).toBe(60);
  });

  it('advances yearly lunar dates after the lunar year occurrence', () => {
    const todo = createTodo({ title: '春节', calendarType: 'lunar', lunarDate: '2020-01-01', repeatRule: 'yearly' }, 0);
    expect(getTodoDateSnapshot(todo, new Date(2026, 1, 18, 10).getTime()).targetDateLabel).toBe('2月6日');
    expect(getTodoDateSnapshot(todo, new Date(2026, 1, 18, 10).getTime()).isOverdue).toBe(false);
  });

  it('finds the next real leap month occurrence for yearly lunar events', () => {
    const todo = createTodo({ title: '闰六月', calendarType: 'lunar', lunarDate: '2025--06-01', repeatRule: 'yearly' }, 0);
    const result = getTodoDateSnapshot(todo, new Date(2026, 0, 1).getTime());
    expect(result.daysRemaining).not.toBeNull();
    expect(result.isOverdue).toBe(false);
    expect(result.daysRemaining).toBeGreaterThan(365);
  });
});
