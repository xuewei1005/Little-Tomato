import { invoke } from '@tauri-apps/api/core';

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function readTodoSyncFile(path: string): Promise<string | null> {
  if (!isTauriRuntime() || !path.trim()) return null;
  try {
    return await invoke<string>('read_text_file', { path });
  } catch {
    return null;
  }
}

export async function writeTodoSyncFile(path: string, csv: string): Promise<boolean> {
  if (!isTauriRuntime() || !path.trim()) return false;
  try {
    await invoke('write_text_file', { path, contents: csv });
    return true;
  } catch {
    return false;
  }
}

export async function getDefaultTodoSyncPath(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  try {
    return await invoke<string>('default_todo_sync_path');
  } catch {
    return null;
  }
}
