import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDefaultTodoSyncPath, readTodoSyncFile, writeTodoSyncFile } from '../../src/domain/todoFileBridge';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/api/core', () => ({ invoke }));

describe('Todo file bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  });

  it('does not call native file APIs in browser preview', async () => {
    await expect(readTodoSyncFile('C:\\todo.csv')).resolves.toBeNull();
    await expect(writeTodoSyncFile('C:\\todo.csv', 'csv')).resolves.toBe(false);
    await expect(getDefaultTodoSyncPath()).resolves.toBeNull();
    expect(invoke).not.toHaveBeenCalled();
  });

  it('maps the selected file to Tauri read and write commands', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
    invoke.mockImplementation(async (command: string) => command === 'read_text_file' ? 'csv' : undefined);

    await expect(readTodoSyncFile('C:\\todo.csv')).resolves.toBe('csv');
    await expect(writeTodoSyncFile('C:\\todo.csv', 'csv')).resolves.toBe(true);
    expect(invoke).toHaveBeenNthCalledWith(1, 'read_text_file', { path: 'C:\\todo.csv' });
    expect(invoke).toHaveBeenNthCalledWith(2, 'write_text_file', { path: 'C:\\todo.csv', contents: 'csv' });
  });
});
