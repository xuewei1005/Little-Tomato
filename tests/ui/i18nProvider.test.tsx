import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { I18nProvider, useI18n } from '../../src/i18n/I18nProvider';

function Consumer() {
  const { t, direction, language } = useI18n();
  return <div data-testid="consumer" data-direction={direction} data-language={language}>{t('pet.greeting', { name: 'Alex' })} · {t('missing.key')}</div>;
}

describe('I18nProvider', () => {
  afterEach(() => cleanup());

  it('provides translated text and interpolation to descendants', () => {
    render(<I18nProvider language="en"><Consumer /></I18nProvider>);

    expect(screen.getByTestId('consumer')).toHaveTextContent('Alex');
    expect(screen.getByTestId('consumer')).toHaveTextContent('Little Tomato');
  });

  it('exposes the selected language and RTL direction', () => {
    render(<I18nProvider language="ar"><Consumer /></I18nProvider>);

    expect(screen.getByTestId('consumer')).toHaveAttribute('data-language', 'ar');
    expect(screen.getByTestId('consumer')).toHaveAttribute('data-direction', 'rtl');
    expect(screen.getByTestId('consumer').parentElement).toHaveAttribute('dir', 'rtl');
  });
});
