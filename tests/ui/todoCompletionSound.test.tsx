import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, saveSettings } from '../../src/domain/settingsStore';
import { createTodo } from '../../src/domain/todoStore';
import { SettingsWindow } from '../../src/ui/settings/SettingsWindow';

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

describe('task completion sound', () => {
  it.each([true, false])('plays only when marking a task completed and sounds enabled is %s', (enabled) => {
    const play = vi.fn().mockResolvedValue(undefined);
    const audio = vi.fn(function () { return { play, volume: 1, preload: '' }; });
    vi.stubGlobal('Audio', audio);
    saveSettings({ ...DEFAULT_SETTINGS, soundEnabled: enabled, todoItems: [createTodo({ title: '整理照片' }, Date.now())] });
    render(<SettingsWindow />);
    fireEvent.click(screen.getByRole('button', { name: '完成 整理照片' }));
    expect(play).toHaveBeenCalledTimes(enabled ? 1 : 0);
    fireEvent.click(screen.getByRole('button', { name: /已完成任务/ }));
    fireEvent.click(screen.getByRole('button', { name: '重新打开 整理照片' }));
    expect(play).toHaveBeenCalledTimes(enabled ? 1 : 0);
  });
});
