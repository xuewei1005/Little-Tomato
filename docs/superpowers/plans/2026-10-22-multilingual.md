# 小番茄多语言 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为小番茄增加可持久化的简体中文、English、日本語、한국어、العربية五种界面与宠物内容语言，并为阿拉伯语提供 RTL 布局。

**Architecture:** 在现有本地设置模型中增加 `AppLanguage`，使用无第三方依赖的静态翻译目录和 React Context 提供 `t()`、语言和方向。设置窗口与桌面宠物共享同一语言快照；所有用户可见固定文案通过 key 获取，用户输入内容原样保留，缺失翻译回退简体中文。

**Tech Stack:** React 18、TypeScript、Vite、Vitest、Tauri、CSS variables、`Intl.DateTimeFormat`。

**Spec:** `docs/superpowers/specs/2026-10-22-multilingual-design.md`

## Global Constraints

- 第一版支持简体中文、English、日本語、한국어、العربية。
- 设置页增加“语言”选项，默认简体中文。
- 语言切换后立即刷新当前窗口和桌面宠物的文案，不需要重启。
- 不改变 Todo、番茄钟、提醒、同步文件和宠物动画的业务逻辑。
- 不引入在线翻译、远程语言包或第三方账号同步。
- 阿拉伯语启用 `dir="rtl"`；数字、时间、快捷键、代码路径和 Todo 标题保持可读方向。
- 未完成或缺失的翻译通过语言包回退到简体中文，不显示 key。
- 当前工作区尚未初始化 Git；每个任务的提交步骤在仓库初始化后执行，实施阶段先用测试和构建结果作为 checkpoint。

---

### Task 1: 添加语言设置模型和旧数据迁移

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/settingsStore.ts`
- Test: `tests/domain/settingsStore.test.ts`

**Interfaces:**
- Produces `AppLanguage = 'zh-CN' | 'en' | 'ja' | 'ko' | 'ar'`。
- Produces `AppSettings.language`，默认值为 `'zh-CN'`。
- `normalizeSettings` 对缺失或非法语言值回退到 `'zh-CN'`。

- [ ] **Step 1: Write the failing tests**

在 `tests/domain/settingsStore.test.ts` 增加：

```ts
it('defaults the language to simplified Chinese and round-trips a supported language', () => {
  const storage = createStorage();
  expect(loadSettings(storage).language).toBe('zh-CN');
  saveSettings({ ...DEFAULT_SETTINGS, language: 'ja' }, storage);
  expect(loadSettings(storage).language).toBe('ja');
});

it('falls back to Chinese for a missing or unsupported language', () => {
  const storage = createStorage(JSON.stringify({ ...DEFAULT_SETTINGS, language: 'fr' }));
  expect(loadSettings(storage).language).toBe('zh-CN');
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm vitest run tests/domain/settingsStore.test.ts --maxWorkers=1`

Expected: TypeScript/test failure because `AppSettings.language` and the default normalization do not exist.

- [ ] **Step 3: Implement the minimal settings change**

Add the union type and field, then normalize with an explicit allow-list:

```ts
const SUPPORTED_LANGUAGES = ['zh-CN', 'en', 'ja', 'ko', 'ar'] as const;
const language = SUPPORTED_LANGUAGES.includes(input.language as AppLanguage)
  ? input.language as AppLanguage
  : base.language;
```

Return `language` from `normalizeSettings` and add `language: 'zh-CN'` to `DEFAULT_SETTINGS`.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `pnpm vitest run tests/domain/settingsStore.test.ts --maxWorkers=1`

Expected: all settings store tests pass.

### Task 2: Build the translation catalog and formatting primitives

**Files:**
- Create: `src/i18n/types.ts`
- Create: `src/i18n/catalog.ts`
- Create: `src/i18n/formatters.ts`
- Test: `tests/domain/i18n.test.ts`

**Interfaces:**
- `TranslationKey` is the union of all fixed UI, reminder, pet and Tips keys.
- `TranslationCatalog` is `Record<TranslationKey, string>`.
- `getCatalog(language: AppLanguage): TranslationCatalog` returns a complete catalog with Chinese fallback.
- `createFormatter(language: AppLanguage)` returns `formatDate`, `formatTime`, `formatNumber`, and `formatRelativeDays`.

- [ ] **Step 1: Write the failing catalog tests**

Create tests that enumerate every key from the Chinese catalog and assert every locale returns a non-empty string, verifies `{name}` interpolation, and checks `ar` uses `rtl` while the other four use `ltr`.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm vitest run tests/domain/i18n.test.ts --maxWorkers=1`

Expected: module-not-found or missing catalog failure.

- [ ] **Step 3: Implement the catalog and fallback lookup**

Create namespaced keys such as `nav.pending`, `nav.important`, `nav.completed`, `settings.language`, `todo.new`, `todo.delete`, `timer.start`, `timer.pause`, `reminder.standUp`, `pet.focus`, `pet.completed`, and `tip.body.001`. Keep user-provided names and Todo titles outside the catalog. Each locale must contain the UI strings used by the existing screen; missing locale entries must resolve through `zh-CN` before returning an empty string.

- [ ] **Step 4: Implement locale-aware formatters**

Use `Intl.DateTimeFormat(language, options)` for dates and times. Keep relative-day values numeric and readable, for example `formatRelativeDays(-1) => '昨天'` in Chinese and the corresponding localized phrase in other catalogs. Expose `directionForLanguage(language)` as `'rtl'` only for `ar`.

- [ ] **Step 5: Run the focused test and verify it passes**

Run: `pnpm vitest run tests/domain/i18n.test.ts --maxWorkers=1`

Expected: catalog completeness, fallback, interpolation, direction, and formatter tests pass.

### Task 3: Add the React i18n provider and persist language changes immediately

**Files:**
- Create: `src/i18n/I18nProvider.tsx`
- Modify: `src/ui/app/App.tsx`
- Modify: `src/ui/settings/SettingsWindow.tsx`
- Test: `tests/ui/i18nProvider.test.tsx`

**Interfaces:**
- `I18nProvider({ language, children })` supplies `{ language, direction, t, formatDate, formatTime, formatNumber, formatRelativeDays }`.
- `t(key, variables?)` performs catalog lookup and interpolation.
- `SettingsWindow` remains the owner of `AppSettings`; the provider receives `settings.language` so changing settings re-renders descendants immediately.

- [ ] **Step 1: Write the failing provider tests**

Render a small consumer under `I18nProvider` for `en` and `ar`; assert translated text, `dir="rtl"` for Arabic, and fallback text for an unknown key.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm vitest run tests/ui/i18nProvider.test.tsx --maxWorkers=1`

Expected: provider module or context failure.

- [ ] **Step 3: Implement the provider and root direction attributes**

Use `useMemo` for the translator and return a `<div data-language={language} dir={direction}>` boundary around the settings UI. The provider must not write to storage itself; `SettingsWindow` continues to call `patchSettings`, and its existing persistence effect saves the selected language.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `pnpm vitest run tests/ui/i18nProvider.test.tsx --maxWorkers=1`

Expected: provider and direction tests pass.

### Task 4: Add the language selector to settings

**Files:**
- Modify: `src/ui/settings/AppearanceSettings.tsx`
- Modify: `src/ui/settings/SettingsWindow.tsx`
- Modify: `src/ui/theme/tokens.css`
- Test: `tests/ui/languageSettings.test.tsx`

**Interfaces:**
- `AppearanceSettings` receives the existing `AppSettings` and emits `onChange({ language })`.
- Selector labels are localized, while each language keeps its native name: `简体中文`, `English`, `日本語`, `한국어`, `العربية`.

- [ ] **Step 1: Write the failing UI tests**

Assert the settings modal exposes a labeled language control, selecting `日本語` calls the settings update path, and a second render with `language: 'ar'` sets the RTL root attribute.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm vitest run tests/ui/languageSettings.test.tsx --maxWorkers=1`

Expected: no language control is found.

- [ ] **Step 3: Implement the selector and wire the provider**

Add a settings section near theme controls. Refactor the settings window into a small state-owning wrapper and a translated view if needed so all descendants can call `useI18n`. Selecting a language updates `settings.language`; the existing save effect persists it and the provider re-renders without restarting.

- [ ] **Step 4: Style the selector for LTR and RTL**

Use existing field, segmented-control, and modal styles; add only scoped language selector rules. Keep native language labels readable in every locale.

- [ ] **Step 5: Run the focused test and verify it passes**

Run: `pnpm vitest run tests/ui/languageSettings.test.tsx --maxWorkers=1`

Expected: selector persistence and direction tests pass.

### Task 5: Migrate the settings window and task interface to translation keys

**Files:**
- Modify: `src/ui/settings/SidebarNav.tsx`
- Modify: `src/ui/settings/TodoListPanel.tsx`
- Modify: `src/ui/settings/TodoEditor.tsx`
- Modify: `src/ui/settings/GroupEditor.tsx`
- Modify: `src/ui/settings/FocusDurationSettings.tsx`
- Modify: `src/ui/settings/TodoCalendar.tsx`
- Modify: `src/ui/settings/SettingsWindow.tsx`
- Test: `tests/ui/localizedInterface.test.tsx`

**Interfaces:**
- Components consume `useI18n()` and never hardcode user-visible fixed labels.
- Dynamic values such as counts, Todo titles, group names, nicknames, dates, and times remain component data and are passed as interpolation variables or formatter inputs.

- [ ] **Step 1: Write the failing interface tests**

Render the sidebar, editor, and settings sections for English and Korean; assert the navigation labels, add/delete actions, timer labels, empty states, and calendar controls are translated rather than Chinese literals. Add a test that a user-entered Todo title remains unchanged after switching language.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm vitest run tests/ui/localizedInterface.test.tsx --maxWorkers=1`

Expected: current hardcoded Chinese labels remain visible under non-Chinese language.

- [ ] **Step 3: Replace fixed labels by catalog keys**

Convert one component at a time, starting with `SidebarNav` and `TodoListPanel`, then editor/group/calendar/settings sections. Use `t('key')` and `t('key', { count })`; do not translate `todo.title`, `group.name`, `settings.displayName`, or `settings.petName`.

- [ ] **Step 4: Replace date and countdown display paths**

Use the formatter from `useI18n()` for weekday/month labels, target dates, lunar/solar captions, and relative-day labels while preserving the existing calendar calculations.

- [ ] **Step 5: Run the focused test and verify it passes**

Run: `pnpm vitest run tests/ui/localizedInterface.test.tsx --maxWorkers=1`

Expected: translated fixed labels, preserved user data, and localized date labels pass.

### Task 6: Localize Tips, pet interaction text, and runtime messages

**Files:**
- Modify: `src/domain/tipsLibrary.ts`
- Modify: `src/domain/petRuntime.ts`
- Modify: `src/ui/settings/TipsLyrics.tsx`
- Modify: `src/ui/pet/PetWindow.tsx`
- Modify: `src/ui/pet/usePetRuntime.ts`
- Modify: `src/ui/settings/runtimeBridge.ts`
- Test: `tests/domain/tipsLibrary.test.ts`
- Test: `tests/ui/petLanguageRuntime.test.ts`

**Interfaces:**
- `getRandomTip(language?: AppLanguage)` returns a localized tip with Chinese fallback.
- `PetSettingsSnapshot` carries `language` and `direction` alongside names, theme, opacity, and animation state.
- Runtime reminder builders receive translated message text or a language-aware translator; they keep existing reminder weights and timing.

- [ ] **Step 1: Write failing localization tests**

Assert random tips and interaction lines are non-empty in all five languages, that a missing localized tip falls back to Chinese, and that the settings-to-pet runtime event includes `language`.

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `pnpm vitest run tests/domain/tipsLibrary.test.ts tests/ui/petLanguageRuntime.test.ts --maxWorkers=1`

Expected: existing tip library has no language parameter and runtime snapshots have no language field.

- [ ] **Step 3: Add localized tip and interaction catalogs**

Keep the existing random-selection behavior, split text resources by locale, and preserve the user-provided 200 practical tips plus interaction categories. Use concise translations; no language resource may return an empty string.

- [ ] **Step 4: Propagate language to the desktop pet**

Include `language` in `buildPetSettingsEvent`, send it whenever settings language changes, and have `usePetRuntime` select localized pet phrases and set its root direction. Keep the green-envelope/message behavior and all animation states unchanged.

- [ ] **Step 5: Run focused tests and verify they pass**

Run: `pnpm vitest run tests/domain/tipsLibrary.test.ts tests/ui/petLanguageRuntime.test.ts --maxWorkers=1`

Expected: five-language tips, fallback behavior, and runtime propagation pass.

### Task 7: Complete RTL layout coverage and responsive checks

**Files:**
- Modify: `src/ui/theme/tokens.css`
- Modify: `src/ui/settings/SidebarNav.tsx`
- Modify: `src/ui/settings/TodoListPanel.tsx`
- Modify: `src/ui/settings/TodoEditor.tsx`
- Modify: `src/ui/settings/SettingsWindow.tsx`
- Modify: `src/ui/pet/pet.css`
- Test: `tests/ui/rtlLayout.test.tsx`

**Interfaces:**
- `data-language="ar"` and `dir="rtl"` are the only switches needed to activate RTL styling.
- Direction-neutral controls remain visually stable; arrow/chevron controls are explicitly mirrored only where their meaning is directional.

- [ ] **Step 1: Write the failing RTL tests**

Render representative sidebar, task row, editor, timer board, and pet message states in Arabic; assert the root direction, RTL data attribute, preserved LTR class on numeric/time fields, and no horizontal overflow class or style regression.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm vitest run tests/ui/rtlLayout.test.tsx --maxWorkers=1`

Expected: current tree has no RTL data attribute or direction-specific layout rules.

- [ ] **Step 3: Add scoped logical CSS rules**

Prefer `margin-inline`, `padding-inline`, `inset-inline`, and `text-align: start`. Add narrowly scoped `[dir="rtl"]` rules for flex direction, search icons, close controls, task metadata, and directional arrows. Apply `dir="ltr"` to time, number, path, and user-content spans.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `pnpm vitest run tests/ui/rtlLayout.test.tsx --maxWorkers=1`

Expected: Arabic direction and LTR numeric content tests pass.

### Task 8: Full verification, documentation, and portable delivery

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-10-22-multilingual-design.md` only if implementation decisions need clarification
- Modify: `scripts/installer/README.md` only if delivery instructions change

- [ ] **Step 1: Run the full test suite**

Run: `pnpm vitest run --maxWorkers=1`

Expected: every test file passes, including all existing Todo, timer, pet, packaging, and new i18n tests.

- [ ] **Step 2: Run the production build**

Run: `pnpm tauri build --no-bundle`

Expected: TypeScript, Vite, and Rust release build exit with code 0.

- [ ] **Step 3: Update README language documentation**

Document the five supported languages, the default Chinese fallback, Arabic RTL behavior, and that user-entered Todo content is not automatically translated.

- [ ] **Step 4: Rebuild the single portable delivery**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-portable.ps1`

Expected: only `outputs/小番茄-安装（v2610-A）.exe` and `outputs/小番茄-Todo.csv` remain in the delivery directory.

- [ ] **Step 5: Smoke-test the portable executable**

Launch the generated executable, verify it owns a main window for at least three seconds, then close the process started by the test. Record the SHA256 and final absolute path in the handoff.
