import { useState } from 'react';
import { APP_LANGUAGES } from '../../domain/types';
import type { AppLanguage, AppSettings, PetGender, PetTheme, ThemeMode, TodoReminderMode } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';

interface AppearanceSettingsProps {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
}

export function AppearanceSettings({ settings, onChange }: AppearanceSettingsProps) {
  const { t } = useI18n();
  const [reminderTitle, setReminderTitle] = useState('休息一下');
  const [reminderTime, setReminderTime] = useState('10:30');
  const update = (patch: Partial<AppSettings>) => onChange(patch);
  const addReminder = () => {
    if (!reminderTime) return;
    update({ scheduledReminders: [...settings.scheduledReminders, { id: `reminder-${Date.now()}`, title: reminderTitle.trim() || t('settings.scheduledTime'), time: reminderTime, enabled: true, weekdays: [0, 1, 2, 3, 4, 5, 6] }] });
  };
  const genderLabels: Record<PetGender, string> = { unspecified: t('settings.unspecified'), female: t('settings.female'), male: t('settings.male') };
  const themeLabels: Record<ThemeMode, string> = { system: t('settings.systemTheme'), light: t('settings.lightTheme'), dark: t('settings.darkTheme') };
  const reminderLabels: Record<TodoReminderMode, string> = { gentle: t('settings.reminderGentle'), standard: t('settings.reminderStandard'), active: t('settings.reminderActive') };

  return <div className="settings-layout">
    <section className="settings-section settings-language-section">
      <h3>{t('settings.language')}</h3>
      <p>{t('settings.languageHint')}</p>
      <div className="field"><label htmlFor="language-select">{t('settings.language')}</label><select id="language-select" value={settings.language} onChange={(event) => update({ language: event.target.value as AppLanguage })}>{APP_LANGUAGES.map((language) => <option key={language} value={language}>{({'zh-CN': '简体中文', en: 'English', ja: '日本語', ko: '한국어', ar: 'العربية'} as Record<AppLanguage, string>)[language]}</option>)}</select></div>
    </section>

    <section className="settings-section">
      <h3>{t('settings.identity')}</h3>
      <p>{t('settings.identityHint')}</p>
      <div className="field-row">
        <div className="field"><label htmlFor="pet-name">{t('settings.petName')}</label><input id="pet-name" value={settings.petName} onChange={(event) => update({ petName: event.target.value || '小番茄' })} /></div>
        <div className="field"><label htmlFor="display-name">{t('settings.displayName')}</label><input id="display-name" value={settings.displayName} onChange={(event) => update({ displayName: event.target.value })} placeholder={t('settings.displayNamePlaceholder')} /></div>
      </div>
      <div className="field" style={{ marginTop: 14 }}><label>{t('settings.genderTone')}</label><div className="segmented">{(['unspecified', 'female', 'male'] as PetGender[]).map((value) => <button type="button" key={value} className={settings.petGender === value ? 'active' : ''} onClick={() => update({ petGender: value })}>{genderLabels[value]}</button>)}</div></div>
    </section>

    <section className="settings-section">
      <h3>{t('settings.appearance')}</h3>
      <div className="field"><label>{t('settings.petColor')}</label><div className="color-row">{([['tomato', '#f4775d'], ['peach', '#f29b6d'], ['mint', '#65bfa8'], ['lavender', '#8b86e8']] as Array<[PetTheme, string]>).map(([value, color]) => <button type="button" key={value} className={`color-swatch ${settings.petTheme === value ? 'selected' : ''}`} style={{ background: color }} onClick={() => update({ petTheme: value })} aria-label={`${t('settings.petColor')} ${value}`} />)}</div></div>
      <div className="field" style={{ marginTop: 14 }}><label>{t('settings.interfaceTheme')}</label><div className="segmented">{(['system', 'light', 'dark'] as ThemeMode[]).map((value) => <button type="button" key={value} className={settings.themeMode === value ? 'active' : ''} onClick={() => update({ themeMode: value })}>{themeLabels[value]}</button>)}</div></div>
      <div className="field" style={{ marginTop: 14 }}><label htmlFor="pet-opacity">{t('settings.petOpacity', { percent: Math.round(settings.opacity * 100) })}</label><input id="pet-opacity" type="range" min="0.55" max="1" step="0.05" value={settings.opacity} onChange={(event) => update({ opacity: Number(event.target.value) })} /></div>
      <div className="setting-line"><div><strong>{t('settings.showPetOnStartup')}</strong><small>{t('settings.showPetOnStartupHint')}</small></div><button type="button" className={`switch ${settings.showPetOnStartup ? 'on' : ''}`} aria-label={t('settings.showPetOnStartup')} onClick={() => update({ showPetOnStartup: !settings.showPetOnStartup })} /></div>
    </section>

    <section className="settings-section">
      <h3>{t('settings.reminderRhythm')}</h3>
      <p>{t('settings.reminderRhythmHint')}</p>
      <div className="field"><label>Todo</label><div className="segmented">{(['gentle', 'standard', 'active'] as TodoReminderMode[]).map((value) => <button type="button" key={value} className={settings.reminderMode === value ? 'active' : ''} onClick={() => update({ reminderMode: value })}>{reminderLabels[value]}</button>)}</div></div>
      <div className="setting-line"><div><strong>{t('settings.autoStartNext')}</strong><small>{t('settings.autoStartNextHint')}</small></div><button type="button" className={`switch ${settings.focus.autoStartNext ? 'on' : ''}`} aria-label={t('settings.autoStartNext')} aria-pressed={Boolean(settings.focus.autoStartNext)} onClick={() => update({ focus: { ...settings.focus, autoStartNext: !settings.focus.autoStartNext } })} /></div>
      <div className="field" style={{ marginTop: 15 }}><label>{t('settings.scheduledTime')}</label><div className="field-row"><input aria-label={t('settings.scheduledTime')} value={reminderTitle} onChange={(event) => setReminderTitle(event.target.value)} placeholder={t('settings.scheduledTime')} /><div style={{ display: 'flex', gap: 8 }}><input aria-label={t('settings.scheduledTime')} type="time" value={reminderTime} onChange={(event) => setReminderTime(event.target.value)} /><button type="button" className="pill-button" onClick={addReminder}>{t('common.add')}</button></div></div>{settings.scheduledReminders.length > 0 && <div className="group-editor-list" style={{ marginTop: 9 }}>{settings.scheduledReminders.map((reminder) => <div className="group-editor-row" key={reminder.id}><span style={{ flex: 1, fontSize: 12 }}>{reminder.time} · {reminder.title}</span><button type="button" className="mini-action danger" onClick={() => update({ scheduledReminders: settings.scheduledReminders.filter((item) => item.id !== reminder.id) })}>{t('common.remove')}</button></div>)}</div>}</div>
      <div className="setting-line"><div><strong>{t('settings.holiday')}</strong><small>{t('settings.holidayHint')}</small></div><button type="button" className={`switch ${settings.holidayReminderEnabled ? 'on' : ''}`} aria-label={t('settings.holiday')} onClick={() => update({ holidayReminderEnabled: !settings.holidayReminderEnabled })} /></div>
      <div className="setting-line"><div><strong>{t('settings.animation')}</strong><small>{t('settings.animationHint')}</small></div><button type="button" className={`switch ${settings.animationEnabled ? 'on' : ''}`} aria-label={t('settings.animation')} onClick={() => update({ animationEnabled: !settings.animationEnabled })} /></div>
      <div className="setting-line"><div><strong>{t('settings.sound')}</strong><small>{t('settings.soundHint')}</small></div><button type="button" className={`switch ${settings.soundEnabled ? 'on' : ''}`} aria-label={t('settings.sound')} onClick={() => update({ soundEnabled: !settings.soundEnabled })} /></div>
    </section>

    <section className="settings-section">
      <h3>{t('settings.quietHours')}</h3>
      <div className="field-row"><div className="field"><label htmlFor="quiet-start">{t('settings.quietStart')}</label><input id="quiet-start" type="time" value={settings.quietHours.start} onChange={(event) => update({ quietHours: { ...settings.quietHours, start: event.target.value } })} /></div><div className="field"><label htmlFor="quiet-end">{t('settings.quietEnd')}</label><input id="quiet-end" type="time" value={settings.quietHours.end} onChange={(event) => update({ quietHours: { ...settings.quietHours, end: event.target.value } })} /></div></div>
      <div className="setting-line"><div><strong>{t('settings.enableQuietHours')}</strong><small>{t('settings.quietHoursHint')}</small></div><button type="button" className={`switch ${settings.quietHours.enabled ? 'on' : ''}`} aria-label={t('settings.enableQuietHours')} onClick={() => update({ quietHours: { ...settings.quietHours, enabled: !settings.quietHours.enabled } })} /></div>
    </section>
  </div>;
}
