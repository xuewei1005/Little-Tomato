import { beforeEach, describe, expect, it, vi } from 'vitest';
import { showDesktopPet, toggleDesktopPet } from '../../src/ui/window/petWindow';

const invoke = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('@tauri-apps/api/core', () => ({ invoke }));

describe('desktop pet window', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  });

  it('explains that browser preview cannot show a real desktop pet', async () => {
    await expect(showDesktopPet()).rejects.toThrow('Windows 打包版');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('asks Tauri to show the configured transparent pet window', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });

    await expect(showDesktopPet()).resolves.toBeUndefined();
    expect(invoke).toHaveBeenCalledWith('show_pet_window');
  });

  it('toggles the desktop pet and returns its new visibility', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
    invoke.mockResolvedValue(true);

    await expect(toggleDesktopPet()).resolves.toBe(true);
    expect(invoke).toHaveBeenCalledWith('toggle_pet_window');
  });
});
