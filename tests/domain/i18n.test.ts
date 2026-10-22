import { describe, expect, it } from 'vitest';
import { APP_LANGUAGES } from '../../src/domain/types';
import { getCatalog, getTranslationKeys, translate } from '../../src/i18n/catalog';
import { createFormatter, directionForLanguage } from '../../src/i18n/formatters';

describe('i18n catalog', () => {
  it('provides a non-empty value for every base key in every supported language', () => {
    const keys = getTranslationKeys();

    for (const language of APP_LANGUAGES) {
      const catalog = getCatalog(language);
      for (const key of keys) expect(catalog[key], `${language}:${key}`).toBeTruthy();
    }
  });

  it('interpolates variables and falls back without exposing an unknown key', () => {
    expect(translate('en', 'pet.greeting', { name: 'Alex' })).toContain('Alex');
    expect(translate('ja', 'pet.greeting', { name: 'アレックス' })).toContain('アレックス');
    expect(translate('en', 'missing.key')).not.toBe('missing.key');
  });

  it('uses right-to-left direction only for Arabic', () => {
    expect(directionForLanguage('ar')).toBe('rtl');
    expect(APP_LANGUAGES.filter((language) => language !== 'ar').every((language) => directionForLanguage(language) === 'ltr')).toBe(true);
  });
});

describe('locale formatters', () => {
  it('formats dates, times, numbers, and relative days for the selected locale', () => {
    const date = new Date('2026-10-22T09:05:00+08:00');
    for (const language of APP_LANGUAGES) {
      const formatter = createFormatter(language);
      expect(formatter.formatDate(date)).toBeTruthy();
      expect(formatter.formatTime(date)).toBeTruthy();
      expect(formatter.formatNumber(1234)).toBeTruthy();
      expect(formatter.formatRelativeDays(-1)).toBeTruthy();
    }
  });
});
