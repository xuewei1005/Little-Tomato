import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFocusTimerState } from '../../src/domain/focusTimer';
import { PetTimerBoard } from '../../src/ui/pet/PetTimerBoard';
import { ConfettiBurst } from '../../src/ui/pet/ConfettiBurst';

afterEach(cleanup);

describe('PetTimerBoard', () => {
  it('shows only countdown and pause icon while running', () => {
    const state = { ...createFocusTimerState({ focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15 }), status: 'running' as const, phase: 'focus' as const, remainingSec: 149 };
    render(<PetTimerBoard state={state} onPause={vi.fn()} onResume={vi.fn()} onConfirmStandUp={vi.fn()} />);

    expect(screen.getByTestId('pet-timer-board')).toHaveTextContent('02:29');
    expect(screen.getByRole('button', { name: '暂停番茄钟' })).toBeInTheDocument();
    expect(screen.queryByText('专注时间')).not.toBeInTheDocument();
  });

  it('switches to a start icon while paused and calls resume', () => {
    const onResume = vi.fn();
    const state = { ...createFocusTimerState(), status: 'paused' as const, phase: 'focus' as const, remainingSec: 90 };
    render(<PetTimerBoard state={state} onPause={vi.fn()} onResume={onResume} onConfirmStandUp={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '继续番茄钟' }));
    expect(onResume).toHaveBeenCalledOnce();
  });

  it('shows only the stand-up confirmation icon while waiting', () => {
    const onConfirmStandUp = vi.fn();
    const state = { ...createFocusTimerState(), status: 'awaitingStandUp' as const, phase: 'standUp' as const, remainingSec: 0, totalSec: 0, pendingBreakPhase: 'shortBreak' as const };
    render(<PetTimerBoard state={state} onPause={vi.fn()} onResume={vi.fn()} onConfirmStandUp={onConfirmStandUp} />);

    fireEvent.click(screen.getByRole('button', { name: '我站起来了' }));
    expect(onConfirmStandUp).toHaveBeenCalledOnce();
    expect(within(screen.getByTestId('pet-timer-board')).queryByText(/\d\d:\d\d/)).not.toBeInTheDocument();
  });
});

describe('ConfettiBurst', () => {
  it('renders a multi-wave celebration only when visible', () => {
    const { rerender } = render(<ConfettiBurst visible={false} />);
    expect(screen.queryByTestId('confetti-burst')).not.toBeInTheDocument();

    rerender(<ConfettiBurst visible />);
    expect(screen.getByTestId('confetti-burst').querySelectorAll('.confetti-piece')).toHaveLength(40);
  });
});
