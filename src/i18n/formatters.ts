import type { AppLanguage } from '../domain/types';
import type { I18nDirection, LocaleFormatter } from './types';

const locales: Record<AppLanguage, string> = {
  'zh-CN': 'zh-CN',
  en: 'en-US',
  ja: 'ja-JP',
  ko: 'ko-KR',
  ar: 'ar',
};

export function directionForLanguage(language: AppLanguage): I18nDirection {
  return language === 'ar' ? 'rtl' : 'ltr';
}

export function createFormatter(language: AppLanguage): LocaleFormatter {
  const locale = locales[language];
  return {
    formatDate(value, options = { year: 'numeric', month: 'long', day: 'numeric' }) {
      return new Intl.DateTimeFormat(locale, options).format(value);
    },
    formatTime(value, options = { hour: '2-digit', minute: '2-digit' }) {
      return new Intl.DateTimeFormat(locale, options).format(value);
    },
    formatNumber(value) {
      return new Intl.NumberFormat(locale).format(value);
    },
    formatRelativeDays(value) {
      return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-value, 'day');
    },
  };
}
