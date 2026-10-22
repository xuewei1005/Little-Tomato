import { getCurrentWindow } from '@tauri-apps/api/window';

export type WindowAction = 'minimize' | 'toggleMaximize' | 'close';

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function performWindowAction(action: WindowAction): Promise<boolean> {
  if (!isTauriRuntime()) return false;

  try {
    const currentWindow = getCurrentWindow();
    if (action === 'minimize') await currentWindow.minimize();
    if (action === 'toggleMaximize') await currentWindow.toggleMaximize();
    if (action === 'close') await currentWindow.hide();
    return true;
  } catch {
    return false;
  }
}

export async function startWindowDragging(): Promise<boolean> {
  if (!isTauriRuntime()) return false;

  try {
    await getCurrentWindow().startDragging();
    return true;
  } catch {
    return false;
  }
}
