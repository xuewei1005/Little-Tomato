import { invoke } from '@tauri-apps/api/core';

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function showDesktopPet(): Promise<void> {
  if (!isTauriRuntime()) throw new Error('请在 Windows 打包版中打开透明桌面宠物');
  await invoke('show_pet_window');
}

export async function toggleDesktopPet(): Promise<boolean> {
  if (!isTauriRuntime()) throw new Error('请在 Windows 打包版中切换透明桌面宠物');
  return invoke<boolean>('toggle_pet_window');
}
