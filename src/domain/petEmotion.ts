import type { PetVisualState } from './types';

export type PetMood = 'content' | 'loved' | 'lonely' | 'sleepy';

/** Local, temporary feelings: touching the pet cheers it up; it never loses tasks or blocks work. */
export function getPetMood(nowMs: number, lastInteractionAtMs: number, hour = new Date(nowMs).getHours()): PetMood {
  const elapsed = Math.max(0, nowMs - lastInteractionAtMs);
  if (elapsed < 30_000) return 'loved';
  if (hour >= 22 || hour < 7) return 'sleepy';
  if (elapsed >= 10 * 60_000) return 'lonely';
  return 'content';
}

export function getMoodVisualState(mood: PetMood): PetVisualState {
  if (mood === 'loved') return 'loved';
  if (mood === 'lonely') return 'sad';
  if (mood === 'sleepy') return 'sleepy';
  return 'idle';
}
