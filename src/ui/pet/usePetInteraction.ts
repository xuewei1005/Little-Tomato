import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { startWindowDragging } from '../window/windowActions';

interface PetInteractionOptions {
  onClickReaction: () => void;
}

interface PointerPress {
  x: number;
  y: number;
  dragged: boolean;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('[data-pet-interactive="true"]'));
}

export function usePetInteraction({ onClickReaction }: PetInteractionOptions) {
  const pressRef = useRef<PointerPress | null>(null);
  const suppressClickRef = useRef(false);
  const releaseTimer = useRef<number | null>(null);
  const [interactionClass, setInteractionClass] = useState('');

  const finishPointer = useCallback(() => {
    if (!pressRef.current) return;
    suppressClickRef.current = pressRef.current.dragged;
    pressRef.current = null;
    if (releaseTimer.current !== null) window.clearTimeout(releaseTimer.current);
    setInteractionClass('interaction-released');
    releaseTimer.current = window.setTimeout(() => setInteractionClass(''), 850);
  }, []);

  useEffect(() => {
    // A native Windows move loop can consume WebView pointerup; these release its squish state too.
    window.addEventListener('pointerup', finishPointer);
    window.addEventListener('mouseup', finishPointer);
    window.addEventListener('blur', finishPointer);
    return () => {
      window.removeEventListener('pointerup', finishPointer);
      window.removeEventListener('mouseup', finishPointer);
      window.removeEventListener('blur', finishPointer);
      if (releaseTimer.current !== null) window.clearTimeout(releaseTimer.current);
    };
  }, [finishPointer]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || isInteractiveTarget(event.target)) return;
    event.preventDefault();
    if (releaseTimer.current !== null) window.clearTimeout(releaseTimer.current);
    pressRef.current = { x: event.clientX, y: event.clientY, dragged: false };
    suppressClickRef.current = false;
    setInteractionClass('interaction-pressed');
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, []);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const press = pressRef.current;
    if (!press) return;
    if (event.buttons === 0) { finishPointer(); return; }
    const distance = Math.hypot(event.clientX - press.x, event.clientY - press.y);
    if (press.dragged || distance < 4) return;
    press.dragged = true;
    suppressClickRef.current = true;
    event.preventDefault();
    setInteractionClass('interaction-dragging');
    // Give Windows the pointer only after movement, so a soft tap remains a click.
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    void startWindowDragging();
  }, [finishPointer]);

  const handlePointerUp = useCallback((_event: ReactPointerEvent<HTMLElement>) => finishPointer(), [finishPointer]);
  const handlePointerCancel = useCallback((_event: ReactPointerEvent<HTMLElement>) => finishPointer(), [finishPointer]);
  const handlePointerEnter = useCallback((event: ReactPointerEvent<HTMLElement>) => { if (event.buttons === 0) finishPointer(); }, [finishPointer]);

  const handleClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (isInteractiveTarget(event.target)) return;
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onClickReaction();
  }, [onClickReaction]);

  return { interactionClass, handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel, handlePointerEnter, handleClick };
}
