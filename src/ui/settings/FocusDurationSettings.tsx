import { useEffect, useId, useState } from 'react';
import type { FocusTimerConfig, FocusTimerStatus } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';

interface FocusDurationSettingsProps {
  config: FocusTimerConfig;
  timerStatus: FocusTimerStatus;
  onSave: (config: FocusTimerConfig) => void;
}

const durationFields = [
  { key: 'focusMinutes', labelKey: 'focus.duration', max: 180 },
  { key: 'shortBreakMinutes', labelKey: 'focus.shortBreak', max: 60 },
  { key: 'longBreakMinutes', labelKey: 'focus.longBreak', max: 60 },
  { key: 'longBreakEvery', labelKey: 'focus.longBreakEvery', max: 12 },
] as const;

type DurationKey = typeof durationFields[number]['key'];
type DurationDraft = Record<DurationKey, string>;

function createDraft(config: FocusTimerConfig): DurationDraft {
  return {
    focusMinutes: String(config.focusMinutes),
    shortBreakMinutes: String(config.shortBreakMinutes),
    longBreakMinutes: String(config.longBreakMinutes),
    longBreakEvery: String(config.longBreakEvery ?? 4),
  };
}

export function FocusDurationSettings({ config, timerStatus, onSave }: FocusDurationSettingsProps) {
  const { t } = useI18n();
  const id = useId();
  const [draft, setDraft] = useState(() => createDraft(config));
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    setDraft(createDraft(config));
  }, [config.focusMinutes, config.shortBreakMinutes, config.longBreakMinutes, config.longBreakEvery]);

  const invalidFields = durationFields.filter(({ key, max }) => {
    const value = Number(draft[key]);
    return !draft[key].trim() || !Number.isInteger(value) || value < 1 || value > max;
  });
  const timingMessage = timerStatus === 'idle' || timerStatus === 'completed'
    ? t('focus.updateNow')
    : t('focus.updateNext');
  const update = (key: DurationKey, value: string) => {
    setSaved(false);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  return <section className="focus-duration-settings" aria-label={t('focus.timerLabel')}>
    <button type="button" className="focus-duration-toggle" aria-label={t('focus.adjustLabel')} aria-expanded={expanded} aria-controls={`${id}-form`} onClick={() => setExpanded((value) => !value)}>
      <span>{t('focus.customize')}</span><strong>{t('focus.summary', { focus: config.focusMinutes, break: config.shortBreakMinutes })}</strong><span className="focus-duration-chevron">{expanded ? t('focus.collapse') : t('focus.custom')}</span>
    </button>
    <form id={`${id}-form`} hidden={!expanded} className="form-grid focus-duration-form" noValidate onSubmit={(event) => {
      event.preventDefault();
      if (invalidFields.length) {
        const input = event.currentTarget.elements.namedItem(invalidFields[0].key);
        if (input instanceof HTMLElement) input.focus();
        return;
      }
      onSave({
        ...config,
        focusMinutes: Number(draft.focusMinutes),
        shortBreakMinutes: Number(draft.shortBreakMinutes),
        longBreakMinutes: Number(draft.longBreakMinutes),
        longBreakEvery: Number(draft.longBreakEvery),
      });
      setSaved(true);
    }}>
      <div className="segmented focus-duration-presets" role="group" aria-label={t('focus.presetLabel')}>
        {[15, 25, 45, 60].map((minutes) => <button
          type="button"
          key={minutes}
          className={Number(draft.focusMinutes) === minutes ? 'active' : ''}
          aria-pressed={Number(draft.focusMinutes) === minutes}
          onClick={() => update('focusMinutes', String(minutes))}
        >{t('focus.minutes', { minutes })}</button>)}
      </div>
      <div className="field-row focus-duration-fields">
        {durationFields.map(({ key, labelKey, max }) => {
          const invalid = invalidFields.some((field) => field.key === key);
          return <div className="field" key={key}>
            <label htmlFor={`${id}-${key}`}>{t(labelKey)}</label>
            <input id={`${id}-${key}`} name={key} type="number" inputMode="numeric" min={1} max={max} step={1} required
              value={draft[key]} onChange={(event) => update(key, event.target.value)}
              aria-invalid={invalid} aria-describedby={`${id}-${key}-hint`} />
            <small id={`${id}-${key}-hint`} className={invalid ? 'focus-duration-error' : 'focus-duration-hint'} role={invalid ? 'alert' : undefined}>
              {invalid ? t('focus.invalid', { max }) : key === 'longBreakEvery' ? t('focus.everyRounds', { max }) : t('focus.freeMinutes', { max })}
            </small>
          </div>;
        })}
      </div>
      <div className="focus-duration-actions">
        <button className="pill-button primary-button" type="submit">{t('focus.save')}</button>
        <small className="focus-duration-feedback" role="status">{saved ? t('focus.saved') : ''}{timingMessage}</small>
      </div>
    </form>
  </section>;
}
