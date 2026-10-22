import type { TodoDraft, TodoItem } from './types';

function createTodoId(nowMs: number): string {
  return `todo-${nowMs}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createTodo(draft: TodoDraft, nowMs = Date.now()): TodoItem {
  const title = draft.title.trim();
  if (!title) throw new Error('Todo 标题不能为空');

  return {
    id: createTodoId(nowMs),
    title,
    note: draft.note?.trim() ?? '',
    targetDate: draft.targetDate || undefined,
    lunarDate: draft.lunarDate || undefined,
    targetTime: draft.targetTime || undefined,
    calendarType: draft.calendarType ?? 'solar',
    groupId: draft.groupId || undefined,
    pinned: draft.pinned ?? false,
    starred: draft.starred ?? false,
    repeatRule: draft.repeatRule ?? 'none',
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
    status: 'active',
    reminderMode: draft.reminderMode ?? 'standard',
  };
}

export function updateTodo(todo: TodoItem, patch: Partial<TodoItem>): TodoItem {
  return { ...todo, ...patch, title: patch.title?.trim() || todo.title, updatedAtMs: patch.updatedAtMs ?? Date.now() };
}

export function completeTodo(todo: TodoItem, completedAtMs = Date.now()): TodoItem {
  return { ...todo, status: 'completed', completedAtMs, updatedAtMs: completedAtMs };
}

export function reopenTodo(todo: TodoItem, updatedAtMs = Date.now()): TodoItem {
  return { ...todo, status: 'active', completedAtMs: undefined, updatedAtMs };
}

/**
 * Deletes a Todo as a tombstone instead of removing the record outright.
 * Keeping the archived row lets the CSV sync propagate deletion to another device.
 */
export function deleteTodo(todo: TodoItem, deletedAtMs = Date.now()): TodoItem {
  return { ...todo, status: 'archived', updatedAtMs: deletedAtMs, lastRemindedAtMs: undefined };
}

export function toggleTodoStar(todo: TodoItem, updatedAtMs = Date.now()): TodoItem {
  return { ...todo, starred: !todo.starred, updatedAtMs };
}

export function snoozeTodo(todo: TodoItem, untilMs: number, updatedAtMs = Date.now()): TodoItem {
  return { ...todo, snoozedUntilMs: untilMs, updatedAtMs };
}

export function updateTodoInList(todos: TodoItem[], id: string, patch: Partial<TodoItem>): TodoItem[] {
  return todos.map((todo) => (todo.id === id ? updateTodo(todo, patch) : todo));
}

export function toggleTodoInList(todos: TodoItem[], id: string, nowMs = Date.now()): TodoItem[] {
  return todos.map((todo) => {
    if (todo.id !== id) return todo;
    return todo.status === 'completed' ? reopenTodo(todo, nowMs) : completeTodo(todo, nowMs);
  });
}

export function deleteTodoInList(todos: TodoItem[], id: string, deletedAtMs = Date.now()): TodoItem[] {
  return todos.map((todo) => (todo.id === id ? deleteTodo(todo, deletedAtMs) : todo));
}
