import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PetWindow } from '../../src/ui/pet/PetWindow';
import { WindowTitlebar } from '../../src/ui/window/WindowTitlebar';

const windowApi = vi.hoisted(() => ({
  minimize: vi.fn().mockResolvedValue(undefined),
  toggleMaximize: vi.fn().mockResolvedValue(undefined),
  hide: vi.fn().mockResolvedValue(undefined),
  startDragging: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => windowApi,
}));

describe('窗口交互区域', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
  });

  it('让宠物内容使用显式交互 hook 拖动，避免和 Tauri 深层拖动区域重复', () => {
    const { container } = render(<PetWindow />);

    expect(container.querySelector('.pet-window-inner')).not.toHaveAttribute('data-tauri-drag-region');
  });

  it('把标题栏控件明确排除在拖动区域之外', () => {
    render(<WindowTitlebar />);

    expect(screen.getByRole('button', { name: '最小化' })).toHaveAttribute('data-tauri-drag-region', 'false');
    expect(screen.getByRole('button', { name: '最大化' })).toHaveAttribute('data-tauri-drag-region', 'false');
    expect(screen.getByRole('button', { name: '关闭窗口' })).toHaveAttribute('data-tauri-drag-region', 'false');
  });

  it('按住并移动宠物本体会调用原生窗口拖动', async () => {
    const { container } = render(<PetWindow />);

    const pet = container.querySelector('.pet-window-inner')!;
    fireEvent.pointerDown(pet, { button: 0, clientX: 10, clientY: 10 });
    expect(windowApi.startDragging).not.toHaveBeenCalled();
    fireEvent.pointerMove(pet, { buttons: 1, clientX: 30, clientY: 10 });

    await waitFor(() => expect(windowApi.startDragging).toHaveBeenCalledOnce());
  });

  it('标题栏按钮能调用原生窗口操作，而不是被拖动行为吞掉', async () => {
    const { getByRole } = render(<WindowTitlebar />);

    fireEvent.click(getByRole('button', { name: '最小化' }));
    fireEvent.click(getByRole('button', { name: '最大化' }));
    fireEvent.click(getByRole('button', { name: '关闭窗口' }));

    await waitFor(() => {
      expect(windowApi.minimize).toHaveBeenCalledOnce();
      expect(windowApi.toggleMaximize).toHaveBeenCalledOnce();
      expect(windowApi.hide).toHaveBeenCalledOnce();
    });
  });
});
