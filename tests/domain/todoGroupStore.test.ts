import { describe, expect, it } from 'vitest';
import {
  createTodoGroup,
  deleteTodoGroup,
  filterTodosByView,
  getTodoCounts,
} from '../../src/domain/todoGroupStore';
import { completeTodo, createTodo } from '../../src/domain/todoStore';

describe('Todo groups and smart views', () => {
  it('archives a deleted group for sync and moves its todos to pending without changing completion', () => {
    const group = createTodoGroup('日常', 1_000);
    const activeTodo = createTodo({ title: '软件同步', groupId: group.id, starred: true }, 1_000);
    const completedTodo = completeTodo(createTodo({ title: '已完成', groupId: group.id }, 1_000), 2_000);
    const deleted = deleteTodoGroup([group], [activeTodo, completedTodo], group.id, 3_000);

    expect(deleted.groups).toEqual([{ ...group, archived: true, updatedAtMs: 3_000 }]);
    expect(deleted.todos[0]).toMatchObject({ groupId: undefined, status: 'active', updatedAtMs: 3_000 });
    expect(deleted.todos[1]).toMatchObject({ groupId: undefined, status: 'completed', updatedAtMs: 3_000 });
  });

  it('supports pending and completed task smart views', () => {
    const normal = createTodo({ title: '普通任务' }, 1_000);
    const important = createTodo({ title: '重要任务', starred: true }, 1_000);
    const completed = completeTodo(createTodo({ title: '已完成任务' }, 1_000), 2_000);

    expect(filterTodosByView([normal, important, completed], 'important')).toEqual([important]);
    expect(filterTodosByView([normal, important, completed], 'active')).toEqual([normal, important]);
    expect(filterTodosByView([normal, important, completed], 'completed')).toEqual([completed]);
    expect(filterTodosByView([normal, important, completed], 'all')).toEqual([normal, important]);
    expect(getTodoCounts([normal, important, completed])).toMatchObject({ all: 2, active: 2, completed: 1, important: 1 });
  });
});
