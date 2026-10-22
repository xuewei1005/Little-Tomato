import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns';
import { Lunar, Solar } from 'lunar-javascript';
import type { TodoItem } from './types';

export interface TodoDateSnapshot {
  daysRemaining: number | null;
  label: string;
  targetDateLabel: string;
  isOverdue: boolean;
  isToday: boolean;
}

function parseTodoDate(date: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date) || date.startsWith('0000-')) return new Date(NaN);
  const parsed = parseISO(`${date}T00:00:00`);
  return isValid(parsed) && format(parsed, 'yyyy-MM-dd') === date ? parsed : new Date(NaN);
}

interface LunarDateParts {
  year: number;
  month: number;
  day: number;
}

function parseLunarDate(value: string | undefined): LunarDateParts | null {
  // A negative month denotes a leap month, e.g. 2025--06-01.
  const match = value?.match(/^(\d{4})-(-?\d{1,2})-(\d{1,2})$/u);
  if (!match) return null;
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  return parts.year > 0 && Math.abs(parts.month) >= 1 && Math.abs(parts.month) <= 12 && parts.day >= 1 && parts.day <= 30 ? parts : null;
}

function lunarToSolarKey(parts: LunarDateParts): string | undefined {
  try {
    const lunar = Lunar.fromYmd(parts.year, parts.month, parts.day);
    const solar = lunar.getSolar();
    const key = solar.toYmd();
    const roundTrip = solar.getLunar();
    return isValid(parseTodoDate(key)) && roundTrip.getYear() === parts.year && roundTrip.getMonth() === parts.month && roundTrip.getDay() === parts.day ? key : undefined;
  } catch {
    return undefined;
  }
}

export function lunarDateToSolarDateKey(value: string | undefined): string | undefined {
  const parts = parseLunarDate(value);
  return parts ? lunarToSolarKey(parts) : undefined;
}

export function solarDateToLunarDateKey(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const solar = parseTodoDate(value);
  if (!isValid(solar)) return undefined;
  try {
    const lunar = Solar.fromYmd(solar.getFullYear(), solar.getMonth() + 1, solar.getDate()).getLunar();
    const month = lunar.getMonth();
    return `${String(lunar.getYear()).padStart(4, '0')}-${month < 0 ? '-' : ''}${String(Math.abs(month)).padStart(2, '0')}-${String(lunar.getDay()).padStart(2, '0')}`;
  } catch {
    return undefined;
  }
}

function lunarDisplay(parts: LunarDateParts): string {
  try {
    const text = Lunar.fromYmd(parts.year, parts.month, parts.day).toString().replace(/^.*?年/u, '');
    return `${parts.year}年${text}`;
  } catch {
    return `${parts.year}年${parts.month}月${parts.day}日`;
  }
}

function resolvedTargetDate(todo: TodoItem, nowMs: number): Date | null {
  if (todo.calendarType === 'lunar' && todo.lunarDate) {
    const parts = parseLunarDate(todo.lunarDate);
    const original = parts ? lunarToSolarKey(parts) : undefined;
    if (!parts || !original) return null;
    if (todo.repeatRule === 'yearly') {
      try {
        const today = new Date(nowMs);
        const todayLunar = Solar.fromYmd(today.getFullYear(), today.getMonth() + 1, today.getDate()).getLunar();
        // Skip years without this day or this leap month rather than substitute
        // another date. The bounded search also protects against corrupt input.
        for (let year = todayLunar.getYear(); year <= Math.min(todayLunar.getYear() + 200, 9999); year += 1) {
          const key = lunarToSolarKey({ ...parts, year });
          if (key && differenceInCalendarDays(parseTodoDate(key), today) >= 0) return parseTodoDate(key);
        }
      } catch {
        return null;
      }
      return null;
    }
    return parseTodoDate(original);
  }
  if (!todo.targetDate) return null;
  const date = parseTodoDate(todo.targetDate);
  if (!isValid(date)) return null;
  if (todo.repeatRule === 'yearly') {
    const today = new Date(nowMs);
    // February 29 recurs only in leap years, including century boundaries.
    for (let year = today.getFullYear(); year <= Math.min(today.getFullYear() + 8, 9999); year += 1) {
      const candidate = parseTodoDate(`${String(year).padStart(4, '0')}${todo.targetDate.slice(4)}`);
      if (isValid(candidate) && differenceInCalendarDays(candidate, today) >= 0) return candidate;
    }
    return null;
  }
  return date;
}

function validTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/u.test(value);
}

function unconfirmed(label: string, value: string): TodoDateSnapshot {
  return { daysRemaining: null, label, targetDateLabel: value, isOverdue: false, isToday: false };
}

export function getLocalDateKey(date = new Date()): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Resolves a local target instant, or null for an absent/invalid target.
 * Clock-only tasks start at the first clock instant at/after creation; explicit
 * repeats advance from the last reminder using the policy's calendar arithmetic.
 * A one-off retains its original instant even after delivery; nudge scheduling
 * and delivery eligibility remain the reminder policy's responsibility.
 */
export function resolveTodoTargetTimestamp(todo: TodoItem, nowMs = Date.now()): number | null {
  if (!Number.isFinite(nowMs) || (todo.targetTime && !validTime(todo.targetTime))) return null;
  const [hours, minutes] = (todo.targetTime ?? '00:00').split(':').map(Number);
  if (todo.targetDate || todo.lunarDate) {
    const target = resolvedTargetDate(todo, nowMs);
    if (!target || !isValid(target)) return null;
    target.setHours(hours, minutes, 0, 0);
    return target.getTime();
  }
  if (!todo.targetTime) return null;
  const hasRepeatAnchor = todo.repeatRule !== 'none' && todo.lastRemindedAtMs !== undefined;
  const anchorMs = hasRepeatAnchor ? todo.lastRemindedAtMs! : todo.createdAtMs;
  const target = new Date(anchorMs);
  if (!isValid(target)) return null;
  target.setHours(hours, minutes, 0, 0);
  if (hasRepeatAnchor) {
    if (todo.repeatRule === 'daily') target.setDate(target.getDate() + 1);
    if (todo.repeatRule === 'weekly') target.setDate(target.getDate() + 7);
    if (todo.repeatRule === 'monthly') target.setMonth(target.getMonth() + 1);
    if (todo.repeatRule === 'yearly') target.setFullYear(target.getFullYear() + 1);
  } else if (target.getTime() < todo.createdAtMs) {
    target.setDate(target.getDate() + 1);
  }
  return target.getTime();
}

export function getTodoDateSnapshot(todo: TodoItem, nowMs = Date.now()): TodoDateSnapshot {
  if (!todo.targetDate && !todo.lunarDate) {
    if (todo.targetTime) {
      if (!validTime(todo.targetTime)) return unconfirmed('时间待确认', todo.targetTime);
      const today = new Date(nowMs);
      const timestamp = resolveTodoTargetTimestamp(todo, nowMs);
      if (timestamp === null) return unconfirmed('时间待确认', todo.targetTime);
      const target = new Date(timestamp);
      const delivered = todo.lastRemindedAtMs !== undefined
        && todo.lastRemindedAtMs >= Math.max(target.getTime(), todo.createdAtMs)
        && todo.lastRemindedAtMs <= nowMs;
      if (delivered && todo.repeatRule === 'none') {
        return { daysRemaining: null, label: `已提醒 ${todo.targetTime}`, targetDateLabel: todo.targetTime, isOverdue: false, isToday: false };
      }
      const daysRemaining = differenceInCalendarDays(target, today);
      // The selected occurrence remains current throughout its HH:mm minute.
      const isOverdue = target.getTime() + 60_000 <= nowMs;
      const label = daysRemaining < 0 ? `逾期${Math.abs(daysRemaining)}天`
        : daysRemaining === 0 ? isOverdue ? '已到时间' : '今天'
          : daysRemaining === 1 ? '明天' : `${daysRemaining}天后`;
      return { daysRemaining, label: `${label} ${todo.targetTime}`, targetDateLabel: todo.targetTime, isOverdue, isToday: daysRemaining === 0 };
    }
    return {
      daysRemaining: null,
      label: '无截止时间',
      targetDateLabel: '随时处理',
      isOverdue: false,
      isToday: false,
    };
  }

  const target = resolvedTargetDate(todo, nowMs);
  const today = new Date(nowMs);
  if (!target || !isValid(target)) {
    return {
      daysRemaining: null,
      label: '日期待确认',
      targetDateLabel: todo.lunarDate ?? todo.targetDate ?? '日期待确认',
      isOverdue: false,
      isToday: false,
    };
  }

  const daysRemaining = differenceInCalendarDays(target, today);
  const isOverdue = daysRemaining < 0;
  const isToday = daysRemaining === 0;
  let label = '今天';
  if (daysRemaining > 0) label = daysRemaining === 1 ? '明天' : `${daysRemaining}天后`;
  if (isOverdue) label = `逾期${Math.abs(daysRemaining)}天`;

  const dateLabel = format(target, 'M月d日');
  return { daysRemaining, label, targetDateLabel: dateLabel, isOverdue, isToday };
}

export function formatTodoDate(todo: Pick<TodoItem, 'calendarType' | 'lunarDate' | 'targetDate' | 'targetTime'> & Partial<Pick<TodoItem, 'repeatRule'>>): string {
  if (!todo.targetDate && !todo.lunarDate) {
    if (!todo.targetTime) return '未设置截止时间';
    if (!validTime(todo.targetTime)) return '时间待确认';
    const repeatLabel = { none: '不重复', daily: '每天', weekly: '每周', monthly: '每月', yearly: '每年' }[todo.repeatRule ?? 'none'];
    return todo.repeatRule === 'daily' ? `每天 ${todo.targetTime}` : `${todo.targetTime} · ${repeatLabel}`;
  }
  if (todo.calendarType === 'lunar' && todo.lunarDate) {
    const parts = parseLunarDate(todo.lunarDate);
    const solarKey = parts ? lunarToSolarKey(parts) : undefined;
    const solar = solarKey ? parseTodoDate(solarKey) : undefined;
    if (parts && solar && isValid(solar)) {
      return `农历 ${lunarDisplay(parts)}（公历 ${format(solar, 'yyyy年M月d日')}）${todo.targetTime ? ` ${todo.targetTime}` : ''}`;
    }
    return `日期待确认：${todo.lunarDate}`;
  }
  const target = todo.targetDate ? parseTodoDate(todo.targetDate) : undefined;
  if (!target || !isValid(target)) return `日期待确认：${todo.targetDate ?? todo.lunarDate ?? ''}`;
  return `公历 ${format(target, 'yyyy年M月d日')}${todo.targetTime ? ` ${todo.targetTime}` : ''}`;
}
