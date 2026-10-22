import type { PointerEvent } from 'react';
import { performWindowAction, startWindowDragging } from './windowActions';
import { AppIcon } from '../branding/AppIcon';
import { useI18n } from '../../i18n/I18nProvider';

function handleTitlebarPointerDown(event: PointerEvent<HTMLDivElement>) {
  if (event.button !== 0) return;
  if (event.target instanceof HTMLElement && event.target.closest('button')) return;
  void startWindowDragging();
}

export function WindowTitlebar() {
  const { t } = useI18n();
  return <div className="window-titlebar" data-tauri-drag-region="deep" onPointerDown={handleTitlebarPointerDown}>
    <div className="window-titlebar-brand">
      <AppIcon className="window-titlebar-mark" />
      <span>{t('app.name')}</span>
      <span className="window-titlebar-subtitle">{t('app.subtitle')}</span>
    </div>
    <div className="window-controls" data-tauri-drag-region="false" onMouseDown={(event) => event.stopPropagation()}>
      <button type="button" className="window-control" data-tauri-drag-region="false" aria-label={t('window.minimize')} title={t('window.minimize')} onClick={() => void performWindowAction('minimize')}>−</button>
      <button type="button" className="window-control" data-tauri-drag-region="false" aria-label={t('window.maximize')} title={t('window.maximize')} onClick={() => void performWindowAction('toggleMaximize')}>□</button>
      <button type="button" className="window-control close" data-tauri-drag-region="false" aria-label={t('window.close')} title={t('window.close')} onClick={() => void performWindowAction('close')}>×</button>
    </div>
  </div>;
}
