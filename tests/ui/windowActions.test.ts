import { beforeEach, describe, expect, it, vi } from 'vitest';
import { performWindowAction, startWindowDragging } from '../../src/ui/window/windowActions';

const windowApi = vi.hoisted(() => ({
  minimize: vi.fn().mockResolvedValue(undefined),
  toggleMaximize: vi.fn().mockResolvedValue(undefined),
  hide: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  startDragging: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => windowApi,
}));

describe('window actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  });

  it('does nothing in the browser preview', async () => {
    await expect(performWindowAction('minimize')).resolves.toBe(false);
    expect(windowApi.minimize).not.toHaveBeenCalled();
  });

  it('routes a desktop action to the current Tauri window', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });

    await expect(performWindowAction('toggleMaximize')).resolves.toBe(true);
    expect(windowApi.toggleMaximize).toHaveBeenCalledOnce();
  });

  it('hides the main window when the custom close button is used', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });

    await expect(performWindowAction('close')).resolves.toBe(true);
    expect(windowApi.hide).toHaveBeenCalledOnce();
    expect(windowApi.close).not.toHaveBeenCalled();
  });

  it('starts native dragging from a custom chrome surface', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });

    await expect(startWindowDragging()).resolves.toBe(true);
    expect(windowApi.startDragging).toHaveBeenCalledOnce();
  });
});
