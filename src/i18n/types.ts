import type { AppLanguage } from '../domain/types';

export type I18nDirection = 'ltr' | 'rtl';

export interface TranslationVariables {
  [key: string]: string | number;
}

export interface LocaleFormatter {
  formatDate(value: Date | number, options?: Intl.DateTimeFormatOptions): string;
  formatTime(value: Date | number, options?: Intl.DateTimeFormatOptions): string;
  formatNumber(value: number): string;
  formatRelativeDays(value: number): string;
}

export type Translator = (key: string, variables?: TranslationVariables) => string;

export type SupportedLanguage = AppLanguage;
