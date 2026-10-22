import { act, cleanup, fireEvent, render as renderComponent, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FOCUS_TIMER_CONFIG } from '../../src/domain/focusTimer';
import { createTodoGroup } from '../../src/domain/todoGroupStore';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../../src/domain/settingsStore';
import { createTodo } from '../../src/domain/todoStore';
import type { FocusTimerConfig } from '../../src/domain/types';
import { FocusDurationSettings } from '../../src/ui/settings/FocusDurationSettings';
import { SettingsWindow } from '../../src/ui/settings/SettingsWindow';

afterEach(() => { cleanup(); localStorage.clear(); vi.useRealTimers(); });

function render(ui: ReactNode) {
  const result = renderComponent(ui);
  const toggle = result.queryByRole('button', { name: '调整番茄钟时长' });
  if (toggle) fireEvent.click(toggle);
  return result;
}

describe('FocusDurationSettings', () => {
  it('keeps the editor compact until the user expands it', () => {
    renderComponent(<FocusDurationSettings config={DEFAULT_FOCUS_TIMER_CONFIG} timerStatus="idle" onSave={() => undefined} />);
    const toggle = screen.getByRole('button', { name: '调整番茄钟时长' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByRole('spinbutton', { name: '专注时长（分钟）' })).toBeVisible();
    fireEvent.click(toggle);
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });
  it.each([15, 25, 45, 60])('selects the %i-minute preset and saves it explicitly', (minutes) => {
    let saved: FocusTimerConfig | undefined;
    render(<FocusDurationSettings config={DEFAULT_FOCUS_TIMER_CONFIG} timerStatus="idle" onSave={(config) => { saved = config; }} />);

    fireEvent.click(screen.getByRole('button', { name: `${minutes} 分钟` }));
    expect(screen.getByRole('spinbutton', { name: '专注时长（分钟）' })).toHaveValue(minutes);
    expect(screen.getByRole('button', { name: `${minutes} 分钟` })).toHaveAttribute('aria-pressed', 'true');
    expect(saved).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: '保存时长' }));

    expect(saved).toMatchObject({ focusMinutes: minutes, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4 });
    expect(screen.getByRole('status')).toHaveTextContent('已保存');
  });

  it('saves arbitrary minute inputs and retains unrelated focus configuration', () => {
    let saved: FocusTimerConfig | undefined;
    render(<FocusDurationSettings config={{ ...DEFAULT_FOCUS_TIMER_CONFIG, standUpMinutes: 6 }} timerStatus="paused" onSave={(config) => { saved = config; }} />);

    fireEvent.change(screen.getByRole('spinbutton', { name: '专注时长（分钟）' }), { target: { value: '37' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: '短休息（分钟）' }), { target: { value: '7' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: '长休息（分钟）' }), { target: { value: '19' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: '长休息间隔（轮）' }), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: '保存时长' }));

    expect(saved).toEqual({ focusMinutes: 37, shortBreakMinutes: 7, longBreakMinutes: 19, longBreakEvery: 3, standUpMinutes: 6 });
    expect(screen.getByRole('status')).toHaveTextContent(/本轮.*不变.*下一轮/);
  });

  it.each([
    ['专注时长（分钟）', ''], ['专注时长（分钟）', '0'], ['专注时长（分钟）', '181'], ['专注时长（分钟）', '2.5'],
    ['短休息（分钟）', '0'], ['短休息（分钟）', '61'], ['长休息（分钟）', '61'],
    ['长休息间隔（轮）', '0'], ['长休息间隔（轮）', '13'], ['长休息间隔（轮）', '2.5'],
  ])('rejects invalid %s = %s without saving', (name, value) => {
    let saved = false;
    render(<FocusDurationSettings config={DEFAULT_FOCUS_TIMER_CONFIG} timerStatus="idle" onSave={() => { saved = true; }} />);

    const input = screen.getByRole('spinbutton', { name });
    fireEvent.change(input, { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: '保存时长' }));

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent(/整数/);
    expect(saved).toBe(false);
  });

  it.each([[1, 1, 1, 1], [180, 60, 60, 12]])('accepts inclusive limits %j', (focus, shortBreak, longBreak, every) => {
    let saved: FocusTimerConfig | undefined;
    render(<FocusDurationSettings config={DEFAULT_FOCUS_TIMER_CONFIG} timerStatus="idle" onSave={(config) => { saved = config; }} />);
    const values = [focus, shortBreak, longBreak, every];
    screen.getAllByRole('spinbutton').forEach((input, index) => fireEvent.change(input, { target: { value: String(values[index]) } }));
    fireEvent.click(screen.getByRole('button', { name: '保存时长' }));

    expect(saved).toMatchObject({ focusMinutes: focus, shortBreakMinutes: shortBreak, longBreakMinutes: longBreak, longBreakEvery: every });
  });

  it('refreshes inputs from new settings without losing a draft on an unrelated rerender', () => {
    const props = { config: DEFAULT_FOCUS_TIMER_CONFIG, timerStatus: 'running' as const, onSave: () => undefined };
    const { rerender } = render(<FocusDurationSettings {...props} />);
    fireEvent.change(screen.getByRole('spinbutton', { name: '专注时长（分钟）' }), { target: { value: '37' } });
    rerender(<FocusDurationSettings {...props} config={{ ...props.config }} />);
    expect(screen.getByRole('spinbutton', { name: '专注时长（分钟）' })).toHaveValue(37);

    rerender(<FocusDurationSettings {...props} config={{ ...props.config, focusMinutes: 60 }} />);
    expect(screen.getByRole('spinbutton', { name: '专注时长（分钟）' })).toHaveValue(60);
  });
});

describe('focus duration integration', () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-20T10:00:00+08:00')); });

  async function mountApp() {
    await act(async () => { render(<SettingsWindow />); });
  }

  function saveDuration(minutes: string) {
    const section = within(screen.getByRole('region', { name: '番茄钟时长' }));
    const toggle = section.getByRole('button', { name: '调整番茄钟时长' });
    if (toggle.getAttribute('aria-expanded') === 'false') fireEvent.click(toggle);
    fireEvent.change(section.getByRole('spinbutton', { name: '专注时长（分钟）' }), { target: { value: minutes } });
    fireEvent.click(section.getByRole('button', { name: '保存时长' }));
  }

  it('updates idle time immediately, persists all durations and restores them on reload', async () => {
    await mountApp();
    saveDuration('37');

    expect(screen.getByText('37:00')).toBeInTheDocument();
    expect(loadSettings().focus.focusMinutes).toBe(37);
    cleanup();
    await mountApp();
    expect(screen.getByText('37:00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '开始专注' }));
    act(() => { vi.advanceTimersByTime(1_000); });
    expect(screen.getByText('36:59')).toBeInTheDocument();
  });

  it('keeps running and paused time, then applies saved custom focus and breaks to the next sessions', async () => {
    saveSettings({ ...DEFAULT_SETTINGS, focus: { focusMinutes: 1, shortBreakMinutes: 1, longBreakMinutes: 1, longBreakEvery: 4 } });
    await mountApp();
    fireEvent.click(screen.getByRole('button', { name: '开始专注' }));
    act(() => { vi.advanceTimersByTime(10_000); });
    saveDuration('37');
    expect(screen.getByText('00:50')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '暂停一下' }));
    saveDuration('45');
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(screen.getByText('00:50')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '继续专注' }));
    act(() => { vi.advanceTimersByTime(50_000); });
    expect(screen.getByRole('button', { name: '我站起来了' })).toBeInTheDocument();

    const section = within(screen.getByRole('region', { name: '番茄钟时长' }));
    fireEvent.change(section.getByRole('spinbutton', { name: '长休息（分钟）' }), { target: { value: '7' } });
    fireEvent.change(section.getByRole('spinbutton', { name: '短休息（分钟）' }), { target: { value: '3' } });
    fireEvent.change(section.getByRole('spinbutton', { name: '长休息间隔（轮）' }), { target: { value: '1' } });
    fireEvent.click(section.getByRole('button', { name: '保存时长' }));
    fireEvent.click(screen.getByRole('button', { name: '我站起来了' }));
    expect(screen.getByText('03:00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '跳过' }));
    expect(screen.getByText('45:00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '跳过' }));
    fireEvent.click(screen.getByRole('button', { name: '我站起来了' }));
    expect(screen.getByText('07:00')).toBeInTheDocument();
  });

  it('falls back to pending tasks when the selected group is archived', async () => {
    const group = createTodoGroup('已删除分组', 1_000);
    saveSettings({ ...DEFAULT_SETTINGS, todoGroups: [{ ...group, archived: true }], activeTodoView: `group:${group.id}` });
    await mountApp();

    expect(screen.getByRole('heading', { name: '待做任务' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '已删除分组' })).not.toBeInTheDocument();
  });

  it('moves active tasks to pending when a group is deleted from the manager', async () => {
    vi.useRealTimers();
    const group = createTodoGroup('工作', 1_000);
    const todo = { ...createTodo({ title: '跟进客户', groupId: group.id }, 1_000), lastRemindedAtMs: Date.now() };
    saveSettings({ ...DEFAULT_SETTINGS, todoGroups: [group], todoItems: [todo], activeTodoView: `group:${group.id}` });
    await mountApp();

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '管理' })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '删除' })); });
    expect(screen.getByRole('heading', { name: '待做任务' })).toBeInTheDocument();
    expect(screen.getByText('跟进客户')).toBeInTheDocument();
    await waitFor(() => {
      expect(loadSettings().todoItems[0].groupId).toBeUndefined();
      expect(loadSettings().todoGroups[0].archived).toBe(true);
    });
    expect(screen.queryByRole('button', { name: /^工作/ })).not.toBeInTheDocument();
  });
});
