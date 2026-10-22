export interface HolidayEntry {
  date: string;
  name: string;
  kind: 'traditional' | 'official';
}

const HOLIDAYS: HolidayEntry[] = [
  { date: '01-01', name: '元旦', kind: 'official' },
  { date: '02-14', name: '情人节', kind: 'traditional' },
  { date: '05-01', name: '劳动节', kind: 'official' },
  { date: '06-01', name: '儿童节', kind: 'traditional' },
  { date: '10-01', name: '国庆节', kind: 'official' },
  { date: '12-25', name: '圣诞节', kind: 'traditional' },
];

export function getHolidayForDate(date: Date): HolidayEntry | undefined {
  const key = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return HOLIDAYS.find((holiday) => holiday.date === key);
}

export function getHolidays(): HolidayEntry[] {
  return [...HOLIDAYS];
}

export function getHolidayReminderMessage(date: Date): string | null {
  const holiday = getHolidayForDate(date);
  return holiday ? `今天是${holiday.name}，给自己和重要的人留一点温柔。` : null;
}
