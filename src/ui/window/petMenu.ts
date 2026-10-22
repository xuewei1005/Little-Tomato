import { exit } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import { Menu } from '@tauri-apps/api/menu';
import { PET_COMMAND_EVENT, type PetCommand } from './petCommands';
import { PET_ACTION_EVENT } from '../pet/petInteraction';

const PET_MENU_ITEMS = [
  { id: 'pet-start-timer', text: '开始番茄钟' },
  { id: 'pet-add-todo', text: '记一件事' },
  { id: 'pet-spin', text: '转个圈圈' },
  { id: 'pet-show-main', text: '打开小番茄' },
  { id: 'pet-hide', text: '关闭宠物' },
  { id: 'pet-exit', text: '退出软件' },
] as const;

let petContextMenuPromise: Promise<Menu> | null = null;

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

async function runPetMenuAction(id: string): Promise<void> {
  try {
    if (id === 'pet-spin') {
      await emit(PET_ACTION_EVENT, 'spin');
      return;
    }
    if (id === 'pet-start-timer' || id === 'pet-add-todo') {
      const command: PetCommand = id === 'pet-start-timer' ? 'start-timer' : 'add-todo';
      await invoke('show_main_window');
      await emit(PET_COMMAND_EVENT, command);
      return;
    }
    if (id === 'pet-show-main') {
      await invoke('show_main_window');
      return;
    }
    if (id === 'pet-hide') {
      await invoke('hide_pet_window');
      return;
    }
    if (id === 'pet-exit') {
      await exit(0);
    }
  } catch {
    // Native menu actions are best-effort; the app remains usable if a window is already closing.
  }
}

export async function createPetContextMenu(): Promise<Menu> {
  if (!isTauriRuntime()) throw new Error('桌面宠物右键菜单只在 Windows 打包版中可用');
  if (!petContextMenuPromise) {
    petContextMenuPromise = Menu.new({
      items: PET_MENU_ITEMS.map((item) => ({
        ...item,
        action: () => { void runPetMenuAction(item.id); },
      })),
    }).catch((error) => {
      petContextMenuPromise = null;
      throw error;
    });
  }
  return petContextMenuPromise;
}

export async function showPetContextMenu(): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  try {
    const menu = await createPetContextMenu();
    await menu.popup();
    return true;
  } catch {
    return false;
  }
}

export function resetPetContextMenuForTests(): void {
  petContextMenuPromise = null;
}
