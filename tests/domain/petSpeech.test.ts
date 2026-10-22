import { describe, expect, it } from 'vitest';
import { personalizePetSpeech } from '../../src/domain/petSpeech';

describe('personalizePetSpeech', () => {
  it('keeps some lines concise', () => {
    expect(personalizePetSpeech('先喝口水。', '小陈', '番茄酱', 0)).toBe('先喝口水。');
  });

  it('can address both the user and the pet', () => {
    expect(personalizePetSpeech('先做一小步。', '小陈', '番茄酱', 3)).toBe('小陈，番茄酱陪你先做一小步。');
  });

});
