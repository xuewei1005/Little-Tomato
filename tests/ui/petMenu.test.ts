import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPetContextMenu, resetPetContextMenuForTests } from '../../src/ui/window/petMenu';
import { PET_COMMAND_EVENT } from '../../src/ui/window/petCommands';

const menuApi = vi.hoisted(() => ({
  new: vi.fn(),
  lastOptions: null as { items?: Array<{ id?: string; text?: string; action?: (id: string) => void }> } | null,
  popup: vi.fn(),
}));
const coreApi = vi.hoisted(() => ({ invoke: vi.fn().mockResolvedValue(undefined) }));
const eventApi = vi.hoisted(() => ({ emit: vi.fn().mockResolvedValue(undefined) }));
const appApi = vi.hoisted(() => ({ exit: vi.fn().mockResolvedValue(undefined) }));

vi.mock('@tauri-apps/api/menu', () => ({ Menu: { new: menuApi.new } }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: coreApi.invoke }));
vi.mock('@tauri-apps/api/event', () => ({ emit: eventApi.emit }));
vi.mock('@tauri-apps/api/app', () => ({ exit: appApi.exit }));

describe('宠物原生右键菜单', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPetContextMenuForTests();
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
    menuApi.popup.mockResolvedValue(undefined);
    menuApi.new.mockImplementation(async (options: typeof menuApi.lastOptions) => {
      menuApi.lastOptions = options;
      return { popup: menuApi.popup };
    });
  });

  it('包含开始番茄钟、记一件事、打开、关闭宠物和退出软件', async () => {
    await createPetContextMenu();

    expect(menuApi.lastOptions?.items?.map((item) => item.text)).toEqual([
      '开始番茄钟',
      '记一件事',
      '转个圈圈',
      '打开小番茄',
      '关闭宠物',
      '退出软件',
    ]);
  });

  it('can play a circle without opening the main window', async () => {
    await createPetContextMenu();
    menuApi.lastOptions?.items?.find((item) => item.id === 'pet-spin')?.action?.('pet-spin');
    await waitFor(() => expect(eventApi.emit).toHaveBeenCalledWith('pet-play-action', 'spin'));
    expect(coreApi.invoke).not.toHaveBeenCalled();
  });

  it('菜单动作会打开主窗口并把命令发给主界面', async () => {
    await createPetContextMenu();
    const item = menuApi.lastOptions?.items?.find((candidate) => candidate.id === 'pet-start-timer');
    item?.action?.('pet-start-timer');

    await waitFor(() => {
      expect(coreApi.invoke).toHaveBeenCalledWith('show_main_window');
      expect(eventApi.emit).toHaveBeenCalledWith(PET_COMMAND_EVENT, 'start-timer');
    });
  });

  it('关闭宠物和退出软件使用对应的原生命令', async () => {
    await createPetContextMenu();
    menuApi.lastOptions?.items?.find((candidate) => candidate.id === 'pet-hide')?.action?.('pet-hide');
    menuApi.lastOptions?.items?.find((candidate) => candidate.id === 'pet-exit')?.action?.('pet-exit');

    await waitFor(() => {
      expect(coreApi.invoke).toHaveBeenCalledWith('hide_pet_window');
      expect(appApi.exit).toHaveBeenCalledWith(0);
    });
  });
});
