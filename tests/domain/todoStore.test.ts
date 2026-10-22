import { describe, expect, it } from 'vitest';
import { completeTodo, createTodo, deleteTodo, toggleTodoStar, updateTodo } from '../../src/domain/todoStore';

describe('TodoStore', () => {
  it('creates a generic todo with an optional deadline', () => {
    const todo = createTodo({ title: '妈妈生日', targetDate: '2026-11-02' }, 1_000);

    expect(todo.title).toBe('妈妈生日');
    expect(todo.targetDate).toBe('2026-11-02');
    expect(todo.status).toBe('active');
    expect(todo.starred).toBe(false);
    expect(todo.updatedAtMs).toBe(1_000);
  });

  it('toggles star and completion without changing the todo kind', () => {
    const todo = createTodo({ title: '交房贷' }, 1_000);
    const starred = toggleTodoStar(todo);
    const completed = completeTodo(starred, 2_000);

    expect(completed.starred).toBe(true);
    expect(completed.status).toBe('completed');
    expect(completed.completedAtMs).toBe(2_000);
    expect(starred.updatedAtMs).toBeGreaterThanOrEqual(todo.updatedAtMs ?? 0);
    expect(completed.updatedAtMs).toBe(2_000);
  });

  it('stamps an edited todo with the edit time', () => {
    const todo = createTodo({ title: '原来的事情' }, 1_000);
    const edited = updateTodo(todo, { title: '改过的事情', updatedAtMs: 2_500 });

    expect(edited.title).toBe('改过的事情');
    expect(edited.updatedAtMs).toBe(2_500);
  });

  it('archives a deleted todo so sync can propagate the deletion', () => {
    const todo = createTodo({ title: '删掉这件事' }, 1_000);
    const deleted = deleteTodo(todo, 3_000);

    expect(deleted.status).toBe('archived');
    expect(deleted.updatedAtMs).toBe(3_000);
  });
});
