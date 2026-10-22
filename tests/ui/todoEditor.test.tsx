import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TodoEditor } from '../../src/ui/settings/TodoEditor';
import { createTodo } from '../../src/domain/todoStore';

describe('TodoEditor', () => {
  afterEach(() => cleanup());

  it('folds time settings and keeps the group above them', () => {
    const onRequestCreateGroup = vi.fn();
    render(<TodoEditor groups={[{ id: 'work', name: '工作', accentColor: '#f4775d', sortOrder: 0, archived: false, createdAtMs: 0 }]} onSave={vi.fn()} onRequestCreateGroup={onRequestCreateGroup} onClose={vi.fn()} />);

    expect(screen.queryByText('设置截止时间 / 倒数')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /时间设置/ })).toBeInTheDocument();
    expect(screen.getByLabelText('分组')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '＋ 新建分组' })).toBeInTheDocument();
    expect(screen.queryByLabelText('目标日')).not.toBeInTheDocument();
    expect(screen.queryByText('置顶显示')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /时间设置/ }));
    expect(screen.getByLabelText('目标日')).toBeInTheDocument();
    expect(screen.getByLabelText('重复')).toBeInTheDocument();
  });

  it('opens the group manager from the group selector', () => {
    const onRequestCreateGroup = vi.fn();
    render(<TodoEditor groups={[]} onSave={vi.fn()} onRequestCreateGroup={onRequestCreateGroup} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('分组'), { target: { value: '__new_group__' } });

    expect(onRequestCreateGroup).toHaveBeenCalledOnce();
  });

  it('saves a time without requiring a date', () => {
    const onSave = vi.fn();
    render(<TodoEditor groups={[]} onSave={onSave} onRequestCreateGroup={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('事情名称'), { target: { value: '喝水' } });
    fireEvent.click(screen.getByRole('button', { name: /时间设置/ }));
    const time = screen.getByLabelText('具体时间（可选）');
    expect(time).toBeEnabled();
    fireEvent.change(time, { target: { value: '09:30' } });
    expect(screen.getByRole('button', { name: /时间设置/ })).toHaveTextContent('09:30 · 不重复');
    expect(screen.getByRole('button', { name: /时间设置/ })).not.toHaveTextContent('每天');
    fireEvent.click(screen.getByRole('button', { name: '保存这件事' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ targetDate: undefined, lunarDate: undefined, targetTime: '09:30' }));
  });

  it('explains why a new task was not saved when its title is empty', () => {
    const onSave = vi.fn();
    render(<TodoEditor groups={[]} onSave={onSave} onRequestCreateGroup={vi.fn()} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '保存这件事' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('先写下事情名称');
  });

  it('shows a daily clock summary only when daily repetition is selected', () => {
    const onSave = vi.fn();
    render(<TodoEditor groups={[]} onSave={onSave} onRequestCreateGroup={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('事情名称'), { target: { value: '喝水' } });
    fireEvent.click(screen.getByRole('button', { name: /时间设置/ }));
    fireEvent.change(screen.getByLabelText('具体时间（可选）'), { target: { value: '09:30' } });
    fireEvent.change(screen.getByLabelText('重复'), { target: { value: 'daily' } });
    expect(screen.getByRole('button', { name: /时间设置/ })).toHaveTextContent('每天 09:30');
    fireEvent.click(screen.getByRole('button', { name: '保存这件事' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ targetDate: undefined, targetTime: '09:30', repeatRule: 'daily' }));
    fireEvent.change(screen.getByLabelText('重复'), { target: { value: 'none' } });
    expect(screen.getByRole('button', { name: /时间设置/ })).toHaveTextContent('09:30 · 不重复');
  });

  it('puts calendar type first, selects lunar days by clicking, and previews conversion', () => {
    const onSave = vi.fn();
    const initialTodo = createTodo({ title: '春节', targetDate: '2026-02-17' }, 0);
    render(<TodoEditor groups={[]} initialTodo={initialTodo} onSave={onSave} onRequestCreateGroup={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /时间设置/ }));
    const solarButton = screen.getByRole('button', { name: '公历' });
    expect(solarButton.compareDocumentPosition(screen.getByRole('grid', { name: '公历月历' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '农历' }));
    expect(screen.queryByRole('textbox', { name: /农历日期/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '农历 2026年正月初二' }));
    expect(screen.getByRole('status', { name: '日期转换预览' })).toHaveTextContent('公历 2026年2月18日');
    fireEvent.click(solarButton);
    expect(screen.getByRole('button', { name: '公历 2026年2月18日' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '农历' }));
    fireEvent.click(screen.getByRole('button', { name: '保存这件事' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ calendarType: 'lunar', lunarDate: '2026-01-02', targetDate: '2026-02-18' }));
    expect(screen.getByLabelText('标记星号')).toBeInTheDocument();
  });

  it('preserves time when clearing a date', () => {
    const onSave = vi.fn();
    render(<TodoEditor groups={[]} initialTodo={createTodo({ title: '喝水', targetDate: '2026-02-17', targetTime: '09:30' }, 0)} onSave={onSave} onRequestCreateGroup={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /时间设置/ }));
    fireEvent.click(screen.getByRole('button', { name: '清除日期' }));
    expect(screen.getByLabelText('具体时间（可选）')).toHaveValue('09:30');
    fireEvent.click(screen.getByRole('button', { name: '保存这件事' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ targetDate: undefined, targetTime: '09:30' }));
  });

  it('blocks invalid saved lunar dates instead of using the cached solar date', () => {
    const onSave = vi.fn();
    const initialTodo = createTodo({ title: '坏数据', calendarType: 'lunar', lunarDate: '2026-02-30', targetDate: '2026-03-01' }, 0);
    render(<TodoEditor groups={[]} initialTodo={initialTodo} onSave={onSave} onRequestCreateGroup={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '保存这件事' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('日期无效');
  });
});
