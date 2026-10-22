import type { FocusPhase, PetVisualState } from './types';

export interface PetStateInput {
  focusPhase: FocusPhase;
  hasReminder: boolean;
  hasIncomingNotification: boolean;
  isCelebrating?: boolean;
  ambientState?: PetVisualState;
}

const AMBIENT_PET_STATES: readonly PetVisualState[] = ['happy', 'wave', 'spin', 'stretch', 'wink', 'thinking', 'bounce', 'loved', 'sleepy'];

export function getPetVisualState(input: PetStateInput): PetVisualState {
  if (input.hasIncomingNotification) return 'notification';
  if (input.isCelebrating) return 'celebrate';
  if (input.focusPhase === 'standUp' || input.hasReminder) return 'stretch';
  if (input.focusPhase === 'focus') return 'focus';
  return input.ambientState ?? 'idle';
}

export function getAmbientPetState(random: () => number = Math.random): PetVisualState {
  const sample = random();
  const value = Number.isFinite(sample) ? Math.min(0.999999, Math.max(0, sample)) : 0;
  return AMBIENT_PET_STATES[Math.floor(value * AMBIENT_PET_STATES.length)] ?? 'happy';
}
