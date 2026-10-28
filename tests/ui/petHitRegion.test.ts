import { describe, expect, it } from 'vitest';
import * as interaction from '../../src/ui/pet/petInteraction';

const pointInPetRegion = (interaction as unknown as { pointInPetRegion?: (x: number, y: number, regions: Array<{ rect: { left: number; top: number; width: number; height: number }; shape: 'ellipse' | 'rectangle' }>) => boolean }).pointInPetRegion;

describe('pet hit region', () => {
  const body = { left: 40, top: 80, width: 140, height: 120 };
  it('keeps the body interactive while letting its transparent corners pass through', () => {
    expect(pointInPetRegion?.(110, 140, [{ rect: body, shape: 'ellipse' }])).toBe(true);
    expect(pointInPetRegion?.(42, 82, [{ rect: body, shape: 'ellipse' }])).toBe(false);
    expect(pointInPetRegion?.(5, 140, [{ rect: body, shape: 'ellipse' }])).toBe(false);
  });
  it('keeps timer buttons interactive even outside the body', () => {
    expect(pointInPetRegion?.(210, 120, [{ rect: body, shape: 'ellipse' }, { rect: { left: 200, top: 110, width: 24, height: 24 }, shape: 'rectangle' }])).toBe(true);
  });
});
