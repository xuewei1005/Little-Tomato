import type { TodoGroup, TodoItem, TodoStatus, CalendarType, RepeatRule, TodoReminderMode } from './types';

export interface TodoSyncDocument {
  todos: TodoItem[];
  groups: TodoGroup[];
}

export interface TodoSyncMergeResult extends TodoSyncDocument {
  importedCount: number;
  conflictCount: number;
}

const BOM = '\uFEFF';
const HEADERS = [
  'kind', 'id', 'title', 'note', 'targetDate', 'lunarDate', 'targetTime', 'calendarType', 'groupId', 'groupName',
  'groupAccentColor', 'groupSortOrder', 'groupArchived', 'pinned', 'starred', 'repeatRule', 'createdAtMs',
  'updatedAtMs', 'completedAtMs', 'status', 'snoozedUntilMs', 'reminderMode', 'lastRemindedAtMs',
] as const;

type CsvRow = Record<string, string>;

function csvCell(value: unknown): string {
  const text = value === undefined || value === null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function parseCsvRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (inQuotes) {
      if (character === '"' && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        inQuotes = false;
      } else {
        cell += character;
      }
      continue;
    }
    if (character === '"' && cell.length === 0) {
      inQuotes = true;
    } else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && input[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((value) => value.length > 0)) rows.push(row);
  }
  return rows;
}

function toNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toOptionalNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toBoolean(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1' || value.toLowerCase() === 'yes';
}

function asCalendarType(value: string | undefined): CalendarType {
  return value === 'lunar' ? 'lunar' : 'solar';
}

function asRepeatRule(value: string | undefined): RepeatRule {
  return value === 'daily' || value === 'weekly' || value === 'monthly' || value === 'yearly' ? value : 'none';
}

function asStatus(value: string | undefined): TodoStatus {
  return value === 'completed' || value === 'archived' ? value : 'active';
}

function asReminderMode(value: string | undefined): TodoReminderMode | undefined {
  return value === 'gentle' || value === 'standard' || value === 'active' ? value : undefined;
}

function rowMap(headers: string[], values: string[]): CsvRow {
  return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
}

function recordTime(record: { updatedAtMs?: number; createdAtMs: number }): number {
  return record.updatedAtMs ?? record.createdAtMs;
}

export function serializeTodoSyncDocument(todos: TodoItem[], groups: TodoGroup[]): string {
  const rows: string[][] = [Array.from(HEADERS)];
  for (const group of groups) {
    rows.push([
      'group', group.id, group.name, '', '', '', '', '', '', group.name, group.accentColor, group.sortOrder,
      group.archived, '', '', '', group.createdAtMs, group.updatedAtMs ?? group.createdAtMs, '', '', '', '',
    ].map(csvCell));
  }
  for (const todo of todos) {
    const group = todo.groupId ? groups.find((item) => item.id === todo.groupId) : undefined;
    rows.push([
      'todo', todo.id, todo.title, todo.note, todo.targetDate, todo.lunarDate, todo.targetTime, todo.calendarType, todo.groupId,
      group?.name, group?.accentColor, group?.sortOrder, group?.archived, todo.pinned, todo.starred, todo.repeatRule,
      todo.createdAtMs, todo.updatedAtMs ?? todo.createdAtMs, todo.completedAtMs, todo.status, todo.snoozedUntilMs,
      todo.reminderMode, todo.lastRemindedAtMs,
    ].map(csvCell));
  }
  return `${BOM}${rows.map((row) => row.join(',')).join('\r\n')}\r\n`;
}

export function parseTodoSyncDocument(csv: string): TodoSyncDocument {
  const rows = parseCsvRows(csv.replace(/^\uFEFF/, ''));
  if (rows.length < 2) return { todos: [], groups: [] };
  const headers = rows[0];
  if (!headers.includes('kind') || !headers.includes('id')) return { todos: [], groups: [] };

  const todos: TodoItem[] = [];
  const groups: TodoGroup[] = [];
  for (const values of rows.slice(1)) {
    const row = rowMap(headers, values);
    if (!row.id) continue;
    const createdAtMs = toNumber(row.createdAtMs, Date.now());
    const updatedAtMs = toNumber(row.updatedAtMs, createdAtMs);
    if (row.kind === 'group') {
      if (!row.title && !row.groupName) continue;
      groups.push({
        id: row.id,
        name: row.groupName || row.title,
        accentColor: row.groupAccentColor || '#f4775d',
        sortOrder: toNumber(row.groupSortOrder, groups.length),
        archived: toBoolean(row.groupArchived),
        createdAtMs,
        updatedAtMs,
      });
      continue;
    }
    if (row.kind !== 'todo' || !row.title) continue;
    todos.push({
      id: row.id,
      title: row.title,
      note: row.note,
      targetDate: row.targetDate || undefined,
      lunarDate: row.lunarDate || undefined,
      targetTime: row.targetTime || undefined,
      calendarType: asCalendarType(row.calendarType),
      groupId: row.groupId || undefined,
      pinned: toBoolean(row.pinned),
      starred: toBoolean(row.starred),
      repeatRule: asRepeatRule(row.repeatRule),
      createdAtMs,
      updatedAtMs,
      completedAtMs: toOptionalNumber(row.completedAtMs),
      status: asStatus(row.status),
      snoozedUntilMs: toOptionalNumber(row.snoozedUntilMs),
      reminderMode: asReminderMode(row.reminderMode),
      lastRemindedAtMs: toOptionalNumber(row.lastRemindedAtMs),
    });
  }
  return { todos, groups };
}

function mergeRecords<T extends { id: string; createdAtMs: number; updatedAtMs?: number }>(
  local: T[],
  remote: T[],
): { records: T[]; importedCount: number; conflictCount: number } {
  const result = [...local];
  const indexes = new Map(result.map((record, index) => [record.id, index]));
  let importedCount = 0;
  let conflictCount = 0;
  for (const incoming of remote) {
    const localIndex = indexes.get(incoming.id);
    if (localIndex === undefined) {
      indexes.set(incoming.id, result.length);
      result.push(incoming);
      importedCount += 1;
      continue;
    }
    conflictCount += 1;
    const current = result[localIndex];
    if (recordTime(incoming) > recordTime(current)) {
      result[localIndex] = incoming;
      importedCount += 1;
    }
  }
  return { records: result, importedCount, conflictCount };
}

export function mergeTodoSyncDocuments(local: TodoSyncDocument, remote: TodoSyncDocument): TodoSyncMergeResult {
  const todos = mergeRecords(local.todos, remote.todos);
  const groups = mergeRecords(local.groups, remote.groups);
  return {
    todos: todos.records,
    groups: groups.records,
    importedCount: todos.importedCount + groups.importedCount,
    conflictCount: todos.conflictCount + groups.conflictCount,
  };
}
