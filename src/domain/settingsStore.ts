import { DEFAULT_FOCUS_TIMER_CONFIG } from './focusTimer';
import { APP_LANGUAGES, type AppLanguage, type AppSettings, type StorageLike } from './types';

export const SETTINGS_STORAGE_KEY = 'xiaofanqie.settings.v1';

export const DEFAULT_SETTINGS: AppSettings = {
  version: 1,
  productName: '小番茄',
  language: 'zh-CN',
  displayName: '主人',
  petName: '小番茄',
  petGender: 'unspecified',
  petTheme: 'tomato',
  themeMode: 'system',
  focus: DEFAULT_FOCUS_TIMER_CONFIG,
  standUpMinutes: 3,
  reminderMode: 'standard',
  quietHours: { enabled: true, start: '22:30', end: '08:00' },
  scheduledReminders: [],
  petPosition: { x: 24, y: 24 },
  opacity: 1,
  soundEnabled: true,
  animationEnabled: true,
  holidayReminderEnabled: true,
  startOnBoot: false,
  showPetOnStartup: true,
  todoItems: [],
  todoGroups: [],
  activeTodoView: 'active',
  todoSyncEnabled: false,
  todoSyncPath: '',
};

function isAppLanguage(value: unknown): value is AppLanguage {
  return APP_LANGUAGES.includes(value as AppLanguage);
}

function cloneDefaults(): AppSettings {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as AppSettings;
}

function validDuration(value: number | undefined, fallback: number, maximum: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= maximum ? value : fallback;
}

export function normalizeSettings(input: Partial<AppSettings>): AppSettings {
  const base = cloneDefaults();
  const sanitizedInput = { ...input } as Partial<AppSettings> & { wechatNotificationsEnabled?: unknown };
  delete sanitizedInput.wechatNotificationsEnabled;
  const focus = { ...base.focus, ...(input.focus ?? {}) };
  const todoItems = (input.todoItems ?? base.todoItems).map((todo) => ({
    ...todo,
    // 早期版本把“置顶”单独存成 pinned；迁移后统一由星标表达重要和置顶。
    starred: Boolean(todo.starred || todo.pinned),
    updatedAtMs: todo.updatedAtMs ?? todo.createdAtMs,
  }));
  const todoGroups = (input.todoGroups ?? base.todoGroups).map((group) => ({
    ...group,
    updatedAtMs: group.updatedAtMs ?? group.createdAtMs,
  }));
  return {
    ...base,
    ...sanitizedInput,
    language: isAppLanguage(input.language) ? input.language : base.language,
    displayName: !input.displayName || input.displayName === '小伙伴' ? '主人' : input.displayName,
    focus: {
      ...focus,
      focusMinutes: validDuration(focus.focusMinutes, base.focus.focusMinutes, 180),
      shortBreakMinutes: validDuration(focus.shortBreakMinutes, base.focus.shortBreakMinutes, 60),
      longBreakMinutes: validDuration(focus.longBreakMinutes, base.focus.longBreakMinutes, 60),
      longBreakEvery: validDuration(focus.longBreakEvery, base.focus.longBreakEvery ?? 4, 12),
      autoStartNext: focus.autoStartNext === true,
    },
    quietHours: { ...base.quietHours, ...(input.quietHours ?? {}) },
    petPosition: { ...base.petPosition, ...(input.petPosition ?? {}) },
    scheduledReminders: input.scheduledReminders ?? base.scheduledReminders,
    todoItems,
    todoGroups,
    activeTodoView: input.activeTodoView === 'today' || input.activeTodoView === 'ungrouped' || input.activeTodoView === 'all'
      ? 'active'
      : input.activeTodoView ?? base.activeTodoView,
    todoSyncEnabled: input.todoSyncEnabled ?? base.todoSyncEnabled,
    todoSyncPath: input.todoSyncPath ?? base.todoSyncPath,
  };
}

export function loadSettings(storage?: StorageLike): AppSettings {
  const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!target) return cloneDefaults();
  const raw = target.getItem(SETTINGS_STORAGE_KEY);
  if (!raw) return cloneDefaults();
  try {
    return normalizeSettings(JSON.parse(raw) as Partial<AppSettings>);
  } catch {
    return cloneDefaults();
  }
}

export function saveSettings(settings: AppSettings, storage?: StorageLike): void {
  const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  target?.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalizeSettings(settings)));
}
