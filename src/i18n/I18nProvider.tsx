import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { AppLanguage } from '../domain/types';
import { createFormatter, directionForLanguage } from './formatters';
import { translate } from './catalog';
import type { I18nDirection, LocaleFormatter, TranslationVariables, Translator } from './types';

export interface I18nContextValue extends LocaleFormatter {
  language: AppLanguage;
  direction: I18nDirection;
  t: Translator;
}

const defaultLanguage: AppLanguage = 'zh-CN';
const defaultFormatter = createFormatter(defaultLanguage);
const defaultContext: I18nContextValue = {
  language: defaultLanguage,
  direction: 'ltr',
  t: (key: string, variables?: TranslationVariables) => translate(defaultLanguage, key, variables),
  ...defaultFormatter,
};

const I18nContext = createContext<I18nContextValue>(defaultContext);

export function I18nProvider({ language, children }: { language: AppLanguage; children: ReactNode }) {
  const formatter = useMemo(() => createFormatter(language), [language]);
  const value = useMemo<I18nContextValue>(() => ({
    language,
    direction: directionForLanguage(language),
    t: (key: string, variables?: TranslationVariables) => translate(language, key, variables),
    ...formatter,
  }), [formatter, language]);

  return <I18nContext.Provider value={value}><div className="i18n-root" data-language={language} dir={value.direction}>{children}</div></I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
