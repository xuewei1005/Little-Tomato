import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GroupEditor } from '../../src/ui/settings/GroupEditor';
import type { TodoGroup } from '../../src/domain/types';

const group: TodoGroup = { id: 'work', name: '工作', accentColor: '#f4775d', sortOrder: 0, archived: false, createdAtMs: 0 };

describe('GroupEditor', () => {
  afterEach(() => cleanup());

  it('deletes a group without a browser confirmation dialog', () => {
    const onDelete = vi.fn();
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);
    render(<GroupEditor groups={[group]} onAdd={vi.fn()} onRename={vi.fn()} onDelete={onDelete} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '删除' }));

    expect(confirm).not.toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalledWith('work');
    vi.unstubAllGlobals();
  });
});
