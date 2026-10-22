import type { QuietHours, ScheduledReminder } from './types';

function toMinutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return (hour || 0) * 60 + (minute || 0);
}

export function isInQuietHours(date: Date, quietHours: QuietHours): boolean {
  if (!quietHours.enabled) return false;
  const current = date.getHours() * 60 + date.getMinutes();
  const start = toMinutes(quietHours.start);
  const end = toMinutes(quietHours.end);
  return start <= end ? current >= start && current < end : current >= start || current < end;
}

export function getNextScheduledReminder(
  now: Date,
  reminders: ScheduledReminder[],
  quietHours: QuietHours,
): ScheduledReminder | null {
  if (isInQuietHours(now, quietHours)) return null;
  const day = now.getDay();
  const minute = now.getHours() * 60 + now.getMinutes();
  return (
    reminders.find((reminder) => reminder.enabled && reminder.weekdays.includes(day) && toMinutes(reminder.time) === minute) ?? null
  );
}
