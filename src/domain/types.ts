export type ThemeMode = 'light' | 'dark' | 'system';
export const APP_LANGUAGES = ['zh-CN', 'en', 'ja', 'ko', 'ar'] as const;
export type AppLanguage = typeof APP_LANGUAGES[number];
export type PetGender = 'unspecified' | 'female' | 'male';
export type PetTheme = 'tomato' | 'peach' | 'mint' | 'lavender';
export type TodoStatus = 'active' | 'completed' | 'archived';
export type CalendarType = 'solar' | 'lunar';
export type RepeatRule = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type TodoReminderMode = 'gentle' | 'standard' | 'active';
/** The legacy values remain readable during migration; the UI exposes pending/completed tasks. */
export type TodoSmartView = 'today' | 'important' | 'active' | 'completed' | 'all' | 'ungrouped' | `group:${string}`;
export type PetVisualState = 'idle' | 'focus' | 'stretch' | 'notification' | 'celebrate' | 'sleepy' | 'happy' | 'wave' | 'wink' | 'thinking' | 'angry' | 'bounce' | 'spin' | 'loved' | 'sad' | 'dizzy';

export interface TodoItem {
  id: string;
  title: string;
  note: string;
  targetDate?: string;
  /** Canonical lunar date in YYYY-MM-DD form when calendarType is lunar. */
  lunarDate?: string;
  targetTime?: string;
  calendarType: CalendarType;
  groupId?: string;
  pinned: boolean;
  starred: boolean;
  repeatRule: RepeatRule;
  createdAtMs: number;
  updatedAtMs?: number;
  completedAtMs?: number;
  status: TodoStatus;
  snoozedUntilMs?: number;
  reminderMode?: TodoReminderMode;
  lastRemindedAtMs?: number;
}

export interface TodoDraft {
  title: string;
  note?: string;
  targetDate?: string;
  lunarDate?: string;
  targetTime?: string;
  calendarType?: CalendarType;
  groupId?: string;
  pinned?: boolean;
  starred?: boolean;
  repeatRule?: RepeatRule;
  reminderMode?: TodoReminderMode;
}

export interface TodoGroup {
  id: string;
  name: string;
  accentColor: string;
  sortOrder: number;
  archived: boolean;
  createdAtMs: number;
  updatedAtMs?: number;
}

export interface FocusTimerConfig {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakEvery?: number;
  standUpMinutes?: number;
}

export type FocusPhase = 'idle' | 'focus' | 'shortBreak' | 'longBreak' | 'standUp';
export type FocusBreakPhase = 'shortBreak' | 'longBreak';
export type FocusTimerStatus = 'idle' | 'running' | 'paused' | 'completed' | 'awaitingStandUp';

export interface FocusTimerState {
  phase: FocusPhase;
  status: FocusTimerStatus;
  remainingSec: number;
  totalSec: number;
  startedAtMs?: number;
  completedFocusCount: number;
  pendingBreakPhase?: FocusBreakPhase;
  standUpRequestedAtMs?: number;
}

export interface QuietHours {
  enabled: boolean;
  start: string;
  end: string;
}

export interface ScheduledReminder {
  id: string;
  title: string;
  time: string;
  enabled: boolean;
  weekdays: number[];
}

export interface AppSettings {
  version: number;
  productName: string;
  language: AppLanguage;
  displayName: string;
  petName: string;
  petGender: PetGender;
  petTheme: PetTheme;
  themeMode: ThemeMode;
  focus: FocusTimerConfig;
  standUpMinutes: number;
  reminderMode: TodoReminderMode;
  quietHours: QuietHours;
  scheduledReminders: ScheduledReminder[];
  petPosition: { x: number; y: number };
  opacity: number;
  soundEnabled: boolean;
  animationEnabled: boolean;
  holidayReminderEnabled: boolean;
  startOnBoot: boolean;
  showPetOnStartup: boolean;
  todoItems: TodoItem[];
  todoGroups: TodoGroup[];
  activeTodoView: TodoSmartView;
  todoSyncEnabled: boolean;
  todoSyncPath: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
