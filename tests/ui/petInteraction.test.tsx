import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePetInteraction } from '../../src/ui/pet/usePetInteraction';

const startWindowDragging = vi.hoisted(() => vi.fn().mockResolvedValue(true));
vi.mock('../../src/ui/window/windowActions', () => ({ startWindowDragging }));

afterEach(() => {
  cleanup();
  startWindowDragging.mockClear();
});

function Harness({ onReaction = vi.fn() }: { onReaction?: () => void }) {
  const interaction = usePetInteraction({ onClickReaction: onReaction });
  return (
    <div>
      <div
        data-testid="pet"
        className={interaction.interactionClass}
        onPointerDown={interaction.handlePointerDown}
        onPointerMove={interaction.handlePointerMove}
        onPointerUp={interaction.handlePointerUp}
        onPointerCancel={interaction.handlePointerCancel}
        onClick={interaction.handleClick}
      />
      <button data-testid="board-button" data-pet-interactive="true" onPointerDown={interaction.handlePointerDown}>牌子按钮</button>
    </div>
  );
}

describe('pet drag and click interaction', () => {
  it('starts native dragging once and marks the pet as pressed/dragging', () => {
    render(<Harness />);
    const pet = screen.getByTestId('pet');

    fireEvent.pointerDown(pet, { button: 0, clientX: 10, clientY: 10 });
    expect(startWindowDragging).not.toHaveBeenCalled();
    expect(pet).toHaveClass('interaction-pressed');

    fireEvent.pointerMove(pet, { buttons: 1, clientX: 20, clientY: 10 });
    fireEvent.pointerMove(pet, { buttons: 1, clientX: 30, clientY: 10 });
    expect(startWindowDragging).toHaveBeenCalledOnce();
    expect(pet).toHaveClass('interaction-dragging');
  });

  it('does not start dragging from an interactive board button', () => {
    render(<Harness />);

    fireEvent.pointerDown(screen.getByTestId('board-button'), { button: 0, clientX: 10, clientY: 10 });
    expect(startWindowDragging).not.toHaveBeenCalled();
  });

  it('reacts to a click but suppresses the click after a drag', () => {
    const onReaction = vi.fn();
    render(<Harness onReaction={onReaction} />);
    const pet = screen.getByTestId('pet');

    fireEvent.pointerDown(pet, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(pet, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.click(pet);
    expect(onReaction).toHaveBeenCalledOnce();

    fireEvent.pointerDown(pet, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(pet, { buttons: 1, clientX: 20, clientY: 10 });
    fireEvent.pointerUp(pet, { button: 0, clientX: 20, clientY: 10 });
    fireEvent.click(pet);
    expect(onReaction).toHaveBeenCalledOnce();
    expect(pet).not.toHaveClass('interaction-dragging');
    expect(pet).toHaveClass('interaction-released');
  });

  it('recovers if Windows consumes the pointerup during a native drag', () => {
    render(<Harness />);
    const pet = screen.getByTestId('pet');
    fireEvent.pointerDown(pet, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(pet, { buttons: 1, clientX: 30, clientY: 10 });
    fireEvent.blur(window);
    expect(pet).toHaveClass('interaction-released');
    fireEvent.pointerDown(pet, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(pet, { buttons: 1, clientX: 30, clientY: 10 });
    expect(startWindowDragging).toHaveBeenCalledTimes(2);
  });
});
