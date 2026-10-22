import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PetAvatar } from '../../src/ui/pet/PetAvatar';

describe('PetAvatar 表情动作', () => {
  it('把动作状态呈现为可识别的视觉 class 和辅助文本', () => {
    const { container } = render(<PetAvatar visualState="wave" />);
    const avatar = container.querySelector('.pet-avatar');

    expect(avatar).toHaveClass('state-wave');
    expect(avatar).toHaveAttribute('aria-label', '小番茄正在挥挥手');
  });

  it('关闭动画陪伴时会停用所有动作动画', () => {
    const { container } = render(<PetAvatar visualState="happy" animationEnabled={false} />);

    expect(container.querySelector('.pet-avatar')).toHaveClass('motion-disabled');
  });

  it('为生气状态和立体质感提供独立图层', () => {
    const { container } = render(<PetAvatar visualState="angry" />);

    expect(container.querySelector('.pet-avatar')).toHaveClass('state-angry');
    expect(container.querySelectorAll('.pet-arm')).toHaveLength(2);
    expect(container.querySelector('.pet-gloss')).toBeInTheDocument();
    expect(container.querySelector('.pet-rim')).not.toBeInTheDocument();
  });

  it('gives the angry state several performances instead of one frozen pose', () => {
    const { container, rerender } = render(<PetAvatar visualState="angry" actionSeed={0} />);
    expect(container.querySelector('.pet-avatar')).toHaveAttribute('data-gesture', 'cheek-puff');
    rerender(<PetAvatar visualState="angry" actionSeed={1} />);
    expect(container.querySelector('.pet-avatar')).toHaveAttribute('data-gesture', 'angry-stomp');
    rerender(<PetAvatar visualState="angry" actionSeed={2} />);
    expect(container.querySelector('.pet-avatar')).toHaveAttribute('data-gesture', 'angry-cross');
  });

  it('varies a repeated action with its seed and keeps the chosen gesture stable on rerender', () => {
    const { container, rerender } = render(<PetAvatar visualState="thinking" actionSeed={0} />);
    const firstGesture = container.querySelector('.pet-avatar')?.getAttribute('data-gesture');
    expect(firstGesture).toBe('head-tilt');

    rerender(<PetAvatar visualState="thinking" actionSeed={1} />);
    expect(container.querySelector('.pet-avatar')).toHaveAttribute('data-gesture', 'curious-peek');
    rerender(<PetAvatar visualState="thinking" actionSeed={1} theme="mint" />);
    expect(container.querySelector('.pet-avatar')).toHaveAttribute('data-gesture', 'curious-peek');
  });

  it('keeps held timer controls mounted and usable when a spin replays', () => {
    const { container, rerender } = render(<PetAvatar visualState="spin" actionSeed={1} heldItem={<button>暂停</button>} />);
    const button = container.querySelector('button');
    button?.focus();

    rerender(<PetAvatar visualState="spin" actionSeed={2} heldItem={<button>暂停</button>} />);

    expect(container.querySelector('button')).toBe(button);
    expect(button).toHaveFocus();
    expect(container.querySelector('.pet-avatar')).toHaveAttribute('data-gesture', 'timer-sway');
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1, 1.5])('selects a valid gesture for seed %s', (actionSeed) => {
    const { container } = render(<PetAvatar visualState="loved" actionSeed={actionSeed} />);
    expect(container.querySelector('.pet-avatar')?.getAttribute('data-gesture')).toMatch(/^(bashful|snuggle)$/u);
  });
});
