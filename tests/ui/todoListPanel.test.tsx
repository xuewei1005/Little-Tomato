import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTodo } from '../../src/domain/todoStore';
import { TodoListPanel } from '../../src/ui/settings/TodoListPanel';
import type { TodoGroup, TodoItem } from '../../src/domain/types';

function renderList(overrides: {
  onMoveToGroup?: (todo: TodoItem, groupId?: string) => void;
  onCreateGroup?: (todo: TodoItem) => void;
} = {}) {
  const todo = createTodo({ title: '整理照片' }, 0);
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const group: TodoGroup = { id: 'work', name: '工作', accentColor: '#f4775d', sortOrder: 0, archived: false, createdAtMs: 0 };
  render(<TodoListPanel todos={[todo]} groups={[group]} heading="全部任务" search="" onSearchChange={vi.fn()} onToggle={vi.fn()} onStar={vi.fn()} onEdit={onEdit} onDelete={onDelete} onAdd={vi.fn()} onMoveToGroup={overrides.onMoveToGroup ?? vi.fn()} onCreateGroup={overrides.onCreateGroup ?? vi.fn()} />);
  return { todo, onEdit, onDelete, group };
}

describe('TodoListPanel', () => {
  afterEach(() => cleanup());

  it('selects a task on click without opening the editor', () => {
    renderList();
    fireEvent.click(screen.getByRole('button', { name: /整理照片 无截止时间/ }));
    expect(screen.getByRole('article')).toHaveClass('selected');
  });

  it('opens settings and delete actions from the right-click menu', () => {
    const { onEdit, onDelete } = renderList();
    fireEvent.contextMenu(screen.getByRole('article'));
    fireEvent.click(screen.getByRole('menuitem', { name: '设置任务' }));
    expect(onEdit).toHaveBeenCalledOnce();

    fireEvent.contextMenu(screen.getByRole('article'));
    fireEvent.click(screen.getByRole('menuitem', { name: '删除任务' }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('moves a task to a group or starts creating a group from the right-click menu', () => {
    const onMoveToGroup = vi.fn();
    const onCreateGroup = vi.fn();
    const { todo, group } = renderList({ onMoveToGroup, onCreateGroup });

    fireEvent.contextMenu(screen.getByRole('article'));
    fireEvent.click(screen.getByRole('menuitem', { name: '工作' }));
    expect(onMoveToGroup).toHaveBeenCalledWith(todo, group.id);

    fireEvent.contextMenu(screen.getByRole('article'));
    fireEvent.click(screen.getByRole('menuitem', { name: '＋ 新建分组' }));
    expect(onCreateGroup).toHaveBeenCalledWith(todo);
  });
});
