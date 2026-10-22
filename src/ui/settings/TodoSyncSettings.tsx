import type { AppSettings } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';

interface TodoSyncSettingsProps {
  settings: AppSettings;
  status: string;
  onChange: (patch: Partial<AppSettings>) => void;
  onUseDefaultPath: () => void;
  onSyncNow: () => void;
}

export function TodoSyncSettings({ settings, status, onChange, onUseDefaultPath, onSyncNow }: TodoSyncSettingsProps) {
  const { t } = useI18n();
  return <section className="settings-section" aria-label={t('sync.title')}>
    <h3>{t('sync.title')}</h3>
    <p>{t('sync.hint')}</p>
    <div className="field">
      <label htmlFor="todo-sync-path">{t('sync.path')}</label>
      <input id="todo-sync-path" value={settings.todoSyncPath} onChange={(event) => onChange({ todoSyncPath: event.target.value })} placeholder={t('sync.placeholder')} />
      <small className="sync-hint">{t('sync.formatHint')}</small>
    </div>
    <div className="sync-actions">
      <button type="button" className="pill-button" onClick={onUseDefaultPath}>{t('sync.defaultPath')}</button>
      <button type="button" className="pill-button" onClick={onSyncNow} disabled={!settings.todoSyncPath.trim()}>{t('sync.now')}</button>
    </div>
    <div className="setting-line">
      <div><strong>{t('sync.auto')}</strong><small>{status}</small></div>
      <button type="button" className={`switch ${settings.todoSyncEnabled ? 'on' : ''}`} aria-label={t('sync.auto')} onClick={() => onChange({ todoSyncEnabled: !settings.todoSyncEnabled })} />
    </div>
  </section>;
}
