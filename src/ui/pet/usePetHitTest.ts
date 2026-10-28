import { useEffect, useRef } from 'react';
import { cursorPosition, getCurrentWindow } from '@tauri-apps/api/window';
import { pointInPetRegion, type PetHitRegion } from './petInteraction';

const PET_PARTS = '.pet-body, .pet-leaf, .pet-arm, .pet-foot, .timer-board-action';

export function usePetHitTest(interactionClass: string) {
  const interactionRef = useRef(interactionClass);
  interactionRef.current = interactionClass;

  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return;
    let petWindow: ReturnType<typeof getCurrentWindow>;
    try {
      petWindow = getCurrentWindow();
    } catch {
      return;
    }
    let disposed = false;
    let timer: number | undefined;
    let ignoring = false;

    const update = async () => {
      try {
        const [cursor, position, scale] = await Promise.all([cursorPosition(), petWindow.innerPosition(), petWindow.scaleFactor()]);
        if (disposed) return;
        const x = (cursor.x - position.x) / scale;
        const y = (cursor.y - position.y) / scale;
        const regions: PetHitRegion[] = Array.from(document.querySelectorAll<HTMLElement>(PET_PARTS))
          .map((element) => ({ rect: element.getBoundingClientRect(), shape: element.matches('.timer-board-action') ? 'rectangle' : 'ellipse' }));
        const dragging = interactionRef.current === 'interaction-pressed' || interactionRef.current === 'interaction-dragging';
        const nextIgnore = !dragging && !pointInPetRegion(x, y, regions);
        if (nextIgnore !== ignoring) {
          await petWindow.setIgnoreCursorEvents(nextIgnore);
          if (disposed) {
            if (nextIgnore) await petWindow.setIgnoreCursorEvents(false).catch(() => undefined);
            return;
          }
          ignoring = nextIgnore;
        }
      } catch {
        if (ignoring) await petWindow.setIgnoreCursorEvents(false).catch(() => undefined);
        ignoring = false;
      }
      if (!disposed) timer = window.setTimeout(update, 30);
    };

    void update();
    return () => {
      disposed = true;
      if (timer !== undefined) window.clearTimeout(timer);
      if (ignoring) void petWindow.setIgnoreCursorEvents(false).catch(() => undefined);
    };
  }, []);
}
