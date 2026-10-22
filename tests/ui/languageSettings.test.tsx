import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/domain/settingsStore';
import { AppearanceSettings } from '../../src/ui/settings/AppearanceSettings';

describe('language settings', () => {
  afterEach(() => cleanup());

  it('exposes the five language choices and persists a selection', () => {
    const onChange = vi.fn();
    render(<AppearanceSettings settings={DEFAULT_SETTINGS} onChange={onChange} />);

    const language = screen.getByLabelText('语言');
    expect(language).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '简体中文' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'العربية' })).toBeInTheDocument();

    fireEvent.change(language, { target: { value: 'ja' } });
    expect(onChange).toHaveBeenCalledWith({ language: 'ja' });
  });

  it('places the language control in the first settings section', () => {
    render(<AppearanceSettings settings={DEFAULT_SETTINGS} onChange={vi.fn()} />);

    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings[0]).toHaveTextContent('语言');
    expect(headings[0].closest('.settings-section')).toContainElement(screen.getByLabelText('语言'));
  });
});
