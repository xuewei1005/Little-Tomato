import { describe, expect, it } from 'vitest';
import { getNextScheduledReminder, isInQuietHours } from '../../src/domain/reminderScheduler';

describe('ReminderScheduler', () => {
  const quietHours = { enabled: true, start: '22:30', end: '08:00' };

  it('understands a quiet period that crosses midnight', () => {
    expect(isInQuietHours(new Date('2026-10-20T23:10:00+08:00'), quietHours)).toBe(true);
    expect(isInQuietHours(new Date('2026-10-20T10:10:00+08:00'), quietHours)).toBe(false);
  });

  it('returns an exact scheduled reminder only inside a working window', () => {
    const reminder = { id: 'r1', title: '起来走走', time: '10:30', enabled: true, weekdays: [2] };

    expect(getNextScheduledReminder(new Date('2026-10-20T10:30:00+08:00'), [reminder], quietHours)).toEqual(reminder);
    expect(getNextScheduledReminder(new Date('2026-10-20T23:30:00+08:00'), [reminder], quietHours)).toBeNull();
  });
});
