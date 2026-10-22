import { describe, expect, it } from 'vitest';
import { createTodo } from '../../src/domain/todoStore';
import { mergeTodoSyncDocuments, parseTodoSyncDocument, serializeTodoSyncDocument } from '../../src/domain/todoSync';
import type { TodoGroup } from '../../src/domain/types';

const group: TodoGroup = {
  id: 'group-life',
  name: '生活,重要',
  accentColor: '#f4775d',
  sortOrder: 0,
  archived: false,
  createdAtMs: 1_000,
  updatedAtMs: 1_000,
};

describe('TodoSync', () => {
  it('round-trips commas, quotes, newlines, groups, stars, and deadlines', () => {
    const todo = createTodo({
      title: '给妈妈, 买“花”',
      note: '周末\n记得带卡',
      targetDate: '2026-11-02',
      targetTime: '18:30',
      groupId: group.id,
      starred: true,
      pinned: true,
      calendarType: 'solar',
    }, 2_000);

    const csv = serializeTodoSyncDocument([todo], [group]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    const restored = parseTodoSyncDocument(csv);

    expect(restored.todos).toEqual([todo]);
    expect(restored.groups).toEqual([group]);
  });

  it('keeps local records when timestamps tie and imports newer remote records', () => {
    const local = createTodo({ title: '本地标题' }, 1_000);
    const remote = { ...local, title: '家里电脑标题', updatedAtMs: 3_000 };
    const addedAtHome = createTodo({ title: '家里新增' }, 4_000);

    const merged = mergeTodoSyncDocuments(
      { todos: [local], groups: [] },
      { todos: [remote, addedAtHome], groups: [] },
    );

    expect(merged.todos.map((todo) => todo.title)).toEqual(['家里电脑标题', '家里新增']);
    expect(merged.importedCount).toBe(2);
    expect(merged.conflictCount).toBe(1);
  });

  it('does not let an older remote record overwrite a newer local record', () => {
    const local = { ...createTodo({ title: '最新本地事项' }, 5_000), updatedAtMs: 5_000 };
    const remote = { ...local, title: '旧电脑事项', updatedAtMs: 4_000 };

    const merged = mergeTodoSyncDocuments(
      { todos: [local], groups: [] },
      { todos: [remote], groups: [] },
    );

    expect(merged.todos[0].title).toBe('最新本地事项');
    expect(merged.importedCount).toBe(0);
    expect(merged.conflictCount).toBe(1);
  });
});
