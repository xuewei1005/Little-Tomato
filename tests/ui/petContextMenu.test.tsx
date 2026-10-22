import { cleanup, createEvent, fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PetWindow } from '../../src/ui/pet/PetWindow';
import { resetPetContextMenuForTests } from '../../src/ui/window/petMenu';

const menuApi = vi.hoisted(() => ({
  new: vi.fn(),
  popup: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/api/menu', () => ({ Menu: { new: menuApi.new } }));

describe('宠物右键入口', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    resetPetContextMenuForTests();
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
    menuApi.new.mockResolvedValue({ popup: menuApi.popup });
  });

  it('右键宠物时阻止浏览器菜单并弹出原生菜单', async () => {
    const { container } = render(<PetWindow />);
    const pet = container.querySelector('.pet-window-inner')!;

    const event = createEvent.contextMenu(pet);
    fireEvent(pet, event);

    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => expect(menuApi.new).toHaveBeenCalledOnce());
    expect(menuApi.popup).toHaveBeenCalledOnce();
  });
});
