import { format } from 'date-fns';
import type { TodoGroup, TodoItem, TodoSmartView } from './types';

const GROUP_COLORS = ['#f47d5b', '#8b86e8', '#65bfa8', '#e7a75e', '#df7eae'];

export function createTodoGroup(name: string, nowMs = Date.now(), sortOrder = 0): TodoGroup {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('分组名称不能为空');
  return {
    id: `group-${nowMs}-${Math.random().toString(36).slice(2, 7)}`,
    name: trimmed,
    accentColor: GROUP_COLORS[sortOrder % GROUP_COLORS.length],
    sortOrder,
    archived: false,
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
  };
}

export function renameTodoGroup(groups: TodoGroup[], id: string, name: string, updatedAtMs = Date.now()): TodoGroup[] {
  const trimmed = name.trim();
  if (!trimmed) return groups;
  return groups.map((group) => (group.id === id ? { ...group, name: trimmed, updatedAtMs } : group));
}

export function reorderTodoGroups(groups: TodoGroup[], orderedIds: string[], updatedAtMs = Date.now()): TodoGroup[] {
  const order = new Map(orderedIds.map((id, index) => [id, index]));
  return [...groups]
    .sort((a, b) => (order.get(a.id) ?? a.sortOrder) - (order.get(b.id) ?? b.sortOrder))
    .map((group, index) => ({ ...group, sortOrder: index, updatedAtMs }));
}

export function deleteTodoGroup(
  groups: TodoGroup[],
  todos: TodoItem[],
  id: string,
): { groups: TodoGroup[]; todos: TodoItem[] } {
  return {
    groups: groups.filter((group) => group.id !== id),
    todos: todos.map((todo) => (todo.groupId === id ? { ...todo, groupId: undefined, updatedAtMs: Date.now() } : todo)),
  };
}

export function filterTodosByView(
  todos: TodoItem[],
  view: TodoSmartView,
  now = new Date(),
): TodoItem[] {
  const visible = todos.filter((todo) => todo.status !== 'archived');
  const active = visible.filter((todo) => todo.status === 'active');
  if (view === 'active' || view === 'all') return active;
  if (view === 'completed') return visible.filter((todo) => todo.status === 'completed');
  if (view === 'important') return active.filter((todo) => todo.starred);
  if (view === 'ungrouped') return active.filter((todo) => !todo.groupId);
  if (view === 'today') {
    const today = format(now, 'yyyy-MM-dd');
    return active.filter((todo) => todo.targetDate === today);
  }
  const groupId = view.replace(/^group:/, '');
  return active.filter((todo) => todo.groupId === groupId);
}

export function sortTodosForDisplay(todos: TodoItem[]): TodoItem[] {
  return [...todos].sort((left, right) => {
    if (left.starred !== right.starred) return Number(right.starred) - Number(left.starred);
    if (left.status !== right.status) return left.status === 'active' ? -1 : 1;
    return (right.updatedAtMs ?? right.createdAtMs) - (left.updatedAtMs ?? left.createdAtMs);
  });
}

export function getTodoCounts(todos: TodoItem[], _now = new Date()): Record<string, number> {
  const active = todos.filter((todo) => todo.status === 'active');
  const completed = todos.filter((todo) => todo.status === 'completed');
  const counts: Record<string, number> = {
    important: active.filter((todo) => todo.starred).length,
    all: active.length,
    active: active.length,
    completed: completed.length,
  };
  for (const todo of active) {
    if (todo.groupId) counts[`group:${todo.groupId}`] = (counts[`group:${todo.groupId}`] ?? 0) + 1;
  }
  return counts;
}
