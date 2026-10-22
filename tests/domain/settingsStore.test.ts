import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, SETTINGS_STORAGE_KEY } from '../../src/domain/settingsStore';

describe('SettingsStore', () => {
  it('provides the agreed default identity and appearance', () => {
    expect(DEFAULT_SETTINGS.petName).toBe('小番茄');
    expect(DEFAULT_SETTINGS.productName).toBe('小番茄');
    expect(DEFAULT_SETTINGS.themeMode).toBe('system');
    expect(DEFAULT_SETTINGS.language).toBe('zh-CN');
    expect(DEFAULT_SETTINGS.todoSyncEnabled).toBe(false);
    expect(DEFAULT_SETTINGS.todoSyncPath).toBe('');
  });

  it('round-trips settings through local storage', () => {
    const storage = new Map<string, string>();
    const fakeStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    };

    saveSettings({ ...DEFAULT_SETTINGS, petName: '小橘子' }, fakeStorage);
    expect(loadSettings(fakeStorage).petName).toBe('小橘子');
  });

  it('round-trips a supported language', () => {
    const storage = new Map<string, string>();
    const fakeStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    };

    saveSettings({ ...DEFAULT_SETTINGS, language: 'ja' }, fakeStorage);
    expect(loadSettings(fakeStorage).language).toBe('ja');
  });

  it('falls back to Chinese for a missing or unsupported language', () => {
    const storage = new Map<string, string>([[SETTINGS_STORAGE_KEY, JSON.stringify({ language: 'fr' })]]);
    const fakeStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    };

    expect(loadSettings(fakeStorage).language).toBe('zh-CN');
  });

  it('migrates settings from before Todo file sync was added', () => {
    const storage = new Map<string, string>([[SETTINGS_STORAGE_KEY, JSON.stringify({ petName: '小番茄', todoItems: [{ id: 'old', title: '旧事项', createdAtMs: 42 }] })]]);
    const fakeStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    };

    const settings = loadSettings(fakeStorage);

    expect(settings.todoSyncEnabled).toBe(false);
    expect(settings.todoSyncPath).toBe('');
    expect(settings.todoItems[0].updatedAtMs).toBe(42);
  });

  it('migrates the removed day view to pending tasks', () => {
    const storage = new Map<string, string>([[SETTINGS_STORAGE_KEY, JSON.stringify({ activeTodoView: 'today' })]]);
    const fakeStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    };

    expect(loadSettings(fakeStorage).activeTodoView).toBe('active');
  });
});
