import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SidebarNav } from '../../src/ui/settings/SidebarNav';
import type { TodoGroup } from '../../src/domain/types';

const group: TodoGroup = { id: 'work', name: '工作', accentColor: '#f4775d', sortOrder: 0, archived: false, createdAtMs: 0 };

describe('SidebarNav', () => {
  afterEach(() => cleanup());

  it('shows pending and completed views instead of the old all-tasks label', () => {
    render(<SidebarNav activeView="active" groups={[]} counts={{ active: 2, completed: 1, important: 1 }} onSelect={vi.fn()} onOpenGroups={vi.fn()} onCreateGroup={vi.fn()} onDeleteGroup={vi.fn()} />);

    expect(screen.getByRole('button', { name: /待做任务/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /已完成任务/ })).toBeInTheDocument();
    expect(screen.queryByText('全部任务')).not.toBeInTheDocument();
    expect(screen.queryByText('我的一天')).not.toBeInTheDocument();
  });

  it('places completed tasks as a muted view above group management', () => {
    render(<SidebarNav activeView="active" groups={[]} counts={{ active: 2, completed: 1, important: 1 }} onSelect={vi.fn()} onOpenGroups={vi.fn()} onCreateGroup={vi.fn()} onDeleteGroup={vi.fn()} />);

    const completed = screen.getByRole('button', { name: /已完成任务/ });
    const manageGroups = screen.getByRole('button', { name: /新建.*管理分组/ });

    expect(completed).toHaveClass('completed-view');
    expect(completed.closest('.sidebar-nav')).toHaveClass('completed-nav');
    expect(completed.compareDocumentPosition(manageGroups) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('uses the same aligned svg icon slot for each smart view', () => {
    render(<SidebarNav activeView="active" groups={[]} counts={{ active: 2, completed: 1, important: 1 }} onSelect={vi.fn()} onOpenGroups={vi.fn()} onCreateGroup={vi.fn()} onDeleteGroup={vi.fn()} />);

    const expectedIcons = [
      ['重要', 'important'],
      ['待做任务', 'active'],
      ['已完成任务', 'completed'],
    ] as const;

    for (const [label, iconName] of expectedIcons) {
      const button = screen.getByRole('button', { name: new RegExp(label) });
      expect(button.querySelector('svg.nav-icon')).toHaveAttribute('data-icon', iconName);
    }

    expect(screen.getByRole('button', { name: /已完成任务/ }).closest('nav')).toHaveClass('sidebar-nav');
  });

  it('orders pending tasks before important tasks in the shared sidebar stack', () => {
    render(<SidebarNav activeView="active" groups={[]} counts={{ active: 2, completed: 1, important: 1 }} onSelect={vi.fn()} onOpenGroups={vi.fn()} onCreateGroup={vi.fn()} onDeleteGroup={vi.fn()} />);

    const pending = screen.getByRole('button', { name: /待做任务/ });
    const important = screen.getByRole('button', { name: /重要/ });
    const completed = screen.getByRole('button', { name: /已完成任务/ });
    const sharedStack = completed.closest('.sidebar-navigation');

    expect(pending.compareDocumentPosition(important) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(sharedStack).not.toBeNull();
    expect(sharedStack?.querySelector('[aria-label="智能视图"]')).not.toBeNull();
  });

  it('gives custom groups the same reserved icon slot as smart views', () => {
    render(<SidebarNav activeView="active" groups={[group]} counts={{ 'group:work': 1 }} onSelect={vi.fn()} onOpenGroups={vi.fn()} onCreateGroup={vi.fn()} onDeleteGroup={vi.fn()} />);

    expect(screen.getByRole('button', { name: /工作/ }).querySelector('.group-icon-slot')).not.toBeNull();
  });

  it('hides archived groups from the sidebar', () => {
    const archivedGroup = { ...group, id: 'archived', name: '已删除', archived: true };
    render(<SidebarNav activeView="active" groups={[group, archivedGroup]} counts={{}} onSelect={vi.fn()} onOpenGroups={vi.fn()} onCreateGroup={vi.fn()} onDeleteGroup={vi.fn()} />);

    expect(screen.getByRole('button', { name: /工作/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /已删除/ })).not.toBeInTheDocument();
  });

  it('creates a group from a blank-area context menu', () => {
    const onCreateGroup = vi.fn();
    render(<SidebarNav activeView="active" groups={[]} counts={{}} onSelect={vi.fn()} onOpenGroups={vi.fn()} onCreateGroup={onCreateGroup} onDeleteGroup={vi.fn()} />);

    fireEvent.contextMenu(screen.getByRole('complementary'));
    fireEvent.click(screen.getByRole('menuitem', { name: '新建分组' }));

    expect(onCreateGroup).toHaveBeenCalledOnce();
  });

  it('deletes a selected group directly from its context menu', () => {
    const onDeleteGroup = vi.fn();
    const onSelect = vi.fn();
    render(<SidebarNav activeView="active" groups={[group]} counts={{ 'group:work': 1 }} onSelect={onSelect} onOpenGroups={vi.fn()} onCreateGroup={vi.fn()} onDeleteGroup={onDeleteGroup} />);

    fireEvent.contextMenu(screen.getByRole('button', { name: /工作/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: '删除分组' }));

    expect(onSelect).toHaveBeenCalledWith('group:work');
    expect(onDeleteGroup).toHaveBeenCalledWith('work');
  });
});
