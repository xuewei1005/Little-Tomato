import { describe, expect, it } from 'vitest';
import { getHolidayForDate, getHolidayReminderMessage } from '../../src/domain/calendarService';

describe('CalendarService', () => {
  it('recognizes a supported holiday', () => {
    expect(getHolidayForDate(new Date('2026-10-01T09:00:00+08:00'))?.name).toBe('国庆节');
  });

  it('creates a gentle reminder only for a holiday date', () => {
    expect(getHolidayReminderMessage(new Date('2026-10-01T09:00:00+08:00'))).toContain('国庆节');
    expect(getHolidayReminderMessage(new Date('2026-10-20T09:00:00+08:00'))).toBeNull();
  });
});
