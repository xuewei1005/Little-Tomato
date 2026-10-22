import { useId, useState } from 'react';
import { LunarMonth, LunarYear, Solar } from 'lunar-javascript';
import type { CalendarType } from '../../domain/types';
import { getLocalDateKey, lunarDateToSolarDateKey, solarDateToLunarDateKey } from '../../domain/todoDateService';
import { useI18n } from '../../i18n/I18nProvider';
import './todoCalendar.css';

interface TodoCalendarProps {
  calendarType: CalendarType;
  value: string;
  onChange: (value: string) => void;
}

const lunarMonths = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const pad = (value: number) => String(value).padStart(2, '0');
const dateKey = (year: number, month: number, day: number) => `${String(year).padStart(4, '0')}-${month < 0 ? '-' : ''}${pad(Math.abs(month))}-${pad(day)}`;
const monthLabel = (month: number) => `${month < 0 ? '闰' : ''}${lunarMonths[Math.abs(month) - 1]}月`;

function localDate(year: number, month: number, day: number): Date {
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function initialMonth(calendarType: CalendarType, value: string): { year: number; month: number } {
  const solarKey = calendarType === 'lunar'
    ? lunarDateToSolarDateKey(value)
    : solarDateToLunarDateKey(value) ? value : undefined;
  const [year, month, day] = (solarKey ?? getLocalDateKey()).split('-').map(Number);
  if (calendarType === 'solar') return { year, month };
  const lunar = Solar.fromYmd(year, month, day).getLunar();
  return { year: lunar.getYear(), month: lunar.getMonth() };
}

export function TodoCalendar({ calendarType, value, onChange }: TodoCalendarProps) {
  const { t, formatDate } = useI18n();
  const [view, setView] = useState(() => initialMonth(calendarType, value));
  const id = useId();
  const isLunar = calendarType === 'lunar';
  const typeLabel = isLunar ? t('task.lunar') : t('task.solar');
  const weekdays = Array.from({ length: 7 }, (_, index) => formatDate(new Date(2024, 0, 7 + index), { weekday: 'short' }));
  const months = isLunar
    ? LunarYear.fromYear(view.year).getMonthsInYear().map((month) => ({ value: month.getMonth(), label: monthLabel(month.getMonth()) }))
    : Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: `${index + 1}月` }));
  const lunarMonth = isLunar ? LunarMonth.fromYm(view.year, view.month) : null;
  const dayCount = lunarMonth?.getDayCount() ?? localDate(view.year, view.month + 1, 0).getDate();
  const firstSolarKey = isLunar ? lunarDateToSolarDateKey(dateKey(view.year, view.month, 1)) : dateKey(view.year, view.month, 1);
  const [firstYear, firstMonth, firstDay] = (firstSolarKey ?? getLocalDateKey()).split('-').map(Number);
  const offset = localDate(firstYear, firstMonth, firstDay).getDay();
  const cells = Array.from({ length: Math.ceil((offset + dayCount) / 7) * 7 }, (_, index) => {
    const day = index - offset + 1;
    return day > 0 && day <= dayCount ? day : null;
  });

  const changeYear = (year: number) => {
    if (!Number.isInteger(year) || year < 1 || year > 9999) return;
    // A year without the displayed leap month opens its ordinary counterpart.
    const month = isLunar && !LunarMonth.fromYm(year, view.month) ? Math.abs(view.month) : view.month;
    setView({ year, month });
  };

  const moveMonth = (step: number) => {
    if (lunarMonth) {
      const next = lunarMonth.next(step);
      if (next.getYear() >= 1 && next.getYear() <= 9999) setView({ year: next.getYear(), month: next.getMonth() });
    } else {
      const next = localDate(view.year, view.month + step, 1);
      if (next.getFullYear() >= 1 && next.getFullYear() <= 9999) setView({ year: next.getFullYear(), month: next.getMonth() + 1 });
    }
  };

  return (
    <div className="todo-calendar" role="group" aria-label={t('calendar.target')}>
      <div className="todo-calendar-heading"><strong>{t('calendar.optionalDate', { type: typeLabel })}</strong><button type="button" className="text-button" disabled={!value} onClick={() => onChange('')}>{t('calendar.clear')}</button></div>
      <div className="todo-calendar-navigation">
        <button type="button" aria-label={t('calendar.previousYear')} disabled={view.year === 1} onClick={() => changeYear(view.year - 1)}>«</button>
        <button type="button" aria-label={t('calendar.previousMonth')} disabled={view.year === 1 && view.month === 1} onClick={() => moveMonth(-1)}>‹</button>
        <div className="todo-calendar-period">
          <label className="todo-calendar-sr-only" htmlFor={`${id}-year`}>{t('calendar.yearLabel')}</label>
          <input id={`${id}-year`} type="number" min="1" max="9999" value={view.year} onChange={(event) => changeYear(Number(event.target.value))} />
          <span>{t('calendar.year')}</span>
          <label className="todo-calendar-sr-only" htmlFor={`${id}-month`}>{t('calendar.monthLabel')}</label>
          <select id={`${id}-month`} value={view.month} onChange={(event) => setView({ ...view, month: Number(event.target.value) })}>{months.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}</select>
        </div>
        <button type="button" aria-label={t('calendar.nextMonth')} disabled={view.year === 9999 && view.month === 12} onClick={() => moveMonth(1)}>›</button>
        <button type="button" aria-label={t('calendar.nextYear')} disabled={view.year === 9999} onClick={() => changeYear(view.year + 1)}>»</button>
      </div>
      <div role="grid" aria-label={t('calendar.monthly', { type: typeLabel })}>
        <div className="todo-calendar-week" role="row">{weekdays.map((day) => <span key={day} role="columnheader">{day}</span>)}</div>
        {Array.from({ length: cells.length / 7 }, (_, week) => <div className="todo-calendar-week" role="row" key={week}>
          {cells.slice(week * 7, week * 7 + 7).map((day, index) => {
            if (!day) return <span role="gridcell" key={index} />;
            const key = dateKey(view.year, view.month, day);
            const solarKey = isLunar ? lunarDateToSolarDateKey(key) : key;
            const [year, month, solarDay] = (solarKey ?? '').split('-').map(Number);
            const lunar = solarKey ? Solar.fromYmd(year, month, solarDay).getLunar() : null;
            const label = isLunar ? `${view.year}年${monthLabel(view.month)}${lunar?.getDayInChinese() ?? day}` : `${view.year}年${view.month}月${day}日`;
            const selected = isLunar ? lunarDateToSolarDateKey(value) === solarKey && Boolean(solarKey) : value === key;
            return <div role="gridcell" aria-selected={selected} key={index}><button type="button" className="todo-calendar-day" aria-label={`${typeLabel} ${label}`} aria-pressed={selected} disabled={!solarKey} onClick={() => onChange(key)}><span>{isLunar ? lunar?.getDayInChinese() : day}</span><small>{isLunar ? `${month}/${solarDay}` : lunar?.getDay() === 1 ? `${lunar.getMonthInChinese()}月` : lunar?.getDayInChinese()}</small></button></div>;
          })}
        </div>)}
      </div>
    </div>
  );
}
