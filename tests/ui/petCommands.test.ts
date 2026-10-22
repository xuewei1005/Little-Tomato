import { describe, expect, it, vi } from 'vitest';
import { applyPetCommand, type PetCommand } from '../../src/ui/window/petCommands';

describe('宠物右键命令', () => {
  it.each([
    ['start-timer', 'startTimer'],
    ['add-todo', 'addTodo'],
  ] as Array<[PetCommand, 'startTimer' | 'addTodo']>)('把 %s 转发给主窗口动作', (command, action) => {
    const actions = { startTimer: vi.fn(), addTodo: vi.fn() };

    expect(applyPetCommand(command, actions)).toBe(true);
    expect(actions[action]).toHaveBeenCalledOnce();
    expect(actions[action === 'startTimer' ? 'addTodo' : 'startTimer']).not.toHaveBeenCalled();
  });

  it('忽略未知命令', () => {
    const actions = { startTimer: vi.fn(), addTodo: vi.fn() };

    expect(applyPetCommand('unknown' as PetCommand, actions)).toBe(false);
    expect(actions.startTimer).not.toHaveBeenCalled();
    expect(actions.addTodo).not.toHaveBeenCalled();
  });
});
