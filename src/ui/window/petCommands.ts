export const PET_COMMAND_EVENT = 'pet-command';

export type PetCommand = 'start-timer' | 'pause-timer' | 'resume-timer' | 'confirm-stand-up' | 'add-todo';

export interface PetCommandActions {
  startTimer: () => void;
  pauseTimer?: () => void;
  resumeTimer?: () => void;
  confirmStandUp?: () => void;
  addTodo: () => void;
}

export function applyPetCommand(command: string, actions: PetCommandActions): boolean {
  if (command === 'start-timer') {
    actions.startTimer();
    return true;
  }
  if (command === 'pause-timer') {
    if (!actions.pauseTimer) return false;
    actions.pauseTimer();
    return true;
  }
  if (command === 'resume-timer') {
    if (!actions.resumeTimer) return false;
    actions.resumeTimer();
    return true;
  }
  if (command === 'confirm-stand-up') {
    if (!actions.confirmStandUp) return false;
    actions.confirmStandUp();
    return true;
  }
  if (command === 'add-todo') {
    actions.addTodo();
    return true;
  }
  return false;
}
