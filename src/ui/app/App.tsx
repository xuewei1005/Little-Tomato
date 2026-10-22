import { useState } from 'react';
import { loadSettings } from '../../domain/settingsStore';
import { I18nProvider } from '../../i18n/I18nProvider';
import { SettingsWindow } from '../settings/SettingsWindow';

export function App() {
  const [language, setLanguage] = useState(() => loadSettings().language);
  return <I18nProvider language={language}><SettingsWindow onLanguageChange={setLanguage} /></I18nProvider>;
}
