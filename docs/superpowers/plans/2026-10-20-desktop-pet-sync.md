# Desktop Pet, Tray, and Todo Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 Windows 透明桌面宠物，加入隐藏到托盘的窗口生命周期、可用的托盘菜单和圆角宠物图标，并用可被 Excel 打开的 CSV 文件在不同电脑之间合并同步 Todo。

**Architecture:** 把 CSV 格式化和按更新时间合并放在无 UI 的 `todoSync` 领域模块中，先用 Vitest 验证；把文件读写、默认路径、透明宠物显示、托盘和开机启动放在 Tauri/Rust 桥接中。React 只负责设置项、同步状态和调用桥接，主窗口关闭由 Rust 拦截为隐藏，托盘负责重新显示或退出。

**Tech Stack:** Tauri 2.12、React、TypeScript、Vite、Vitest、Rust、Windows Registry、UTF-8 CSV。

**Spec:** `docs/superpowers/specs/2026-10-20-desktop-pet-sync-design.md`

## Global Constraints

- 目标平台固定为 Windows 10/11。
- 产品名固定为“小番茄”，同步文件名默认为 `小番茄-Todo.csv`。
- 打包版不把透明宠物失败静默降级成浏览器预览；错误必须可见。
- Todo 同步按单条 `id` 和 `updatedAtMs` 合并，不整表覆盖。
- CSV 使用 UTF-8 BOM；字段必须正确转义逗号、双引号和换行。
- 浏览器预览不执行文件系统、托盘或注册表操作。
- 当前工作区不是 Git 仓库；用自动化测试、TypeScript 检查和 Tauri 构建作为检查点，不执行不存在的提交命令。

## File Map

- `src/domain/types.ts`：增加 Todo/设置同步字段。
- `src/domain/todoStore.ts`：所有 Todo 变更写入更新时间。
- `src/domain/todoSync.ts`：CSV 行格式、解析、序列化和三方记录合并。
- `src/domain/todoFileBridge.ts`：Tauri 文件命令的前端安全封装。
- `src/domain/settingsStore.ts`：保存同步开关和路径。
- `src/ui/settings/TodoSyncSettings.tsx`：同步路径、开关、立即同步和状态展示。
- `src/ui/settings/SettingsWindow.tsx`：接入同步生命周期、宠物显示错误和同步设置。
- `src/ui/window/petWindow.ts`：可测试的桌面宠物显示动作。
- `src/ui/window/windowActions.ts`、`WindowTitlebar.tsx`：关闭语义和按钮反馈。
- `src/main.tsx`、`src/ui/theme/tokens.css`：宠物窗口的透明 DOM 背景。
- `src-tauri/src/commands.rs`：文件桥接、宠物窗口、开机启动命令。
- `src-tauri/src/lib.rs`、`src-tauri/Cargo.toml`：托盘和主窗口关闭拦截。
- `src-tauri/capabilities/default.json`：允许前端调用必要的 core 权限。
- `src-tauri/tauri.conf.json`：Windows 透明窗口参数。
- `src-tauri/icons/icon.svg` 及生成资源：圆角宠物图标。
- `tests/domain/todoSync.test.ts`、`tests/domain/todoStore.test.ts`、`tests/ui/windowActions.test.ts`：自动化回归覆盖。

### Task 1: Add Todo timestamps and tested CSV merge

**Files:**
- Create: `src/domain/todoSync.ts`
- Create: `tests/domain/todoSync.test.ts`
- Modify: `src/domain/types.ts`
- Modify: `src/domain/todoStore.ts`
- Modify: `src/domain/todoGroupStore.ts`
- Modify: `src/domain/settingsStore.ts`
- Test: `tests/domain/todoStore.test.ts`

**Interfaces:**
- `serializeTodoSyncDocument(todos: TodoItem[], groups: TodoGroup[]): string`
- `parseTodoSyncDocument(csv: string): { todos: TodoItem[]; groups: TodoGroup[] }`
- `mergeTodoSyncDocuments(local, remote): { todos: TodoItem[]; groups: TodoGroup[]; importedCount: number; conflictCount: number }`

- [x] Write failing tests for comma/quote/newline escaping, missing optional dates, group rows, and newer-record-wins merge.
- [x] Run `pnpm vitest run tests/domain/todoSync.test.ts tests/domain/todoStore.test.ts`; confirm it fails because the sync module and timestamps do not exist.
- [x] Add optional backward-compatible `updatedAtMs` fields and stamp every create/update/complete/reopen/star/snooze/group mutation with the mutation time.
- [x] Implement UTF-8-BOM CSV serialization and a small state-machine parser; skip malformed data rows while preserving valid rows.
- [x] Implement per-id merge: newer timestamp wins, equal timestamps keep local, new records from either side are retained, and groups are merged independently.
- [x] Run the focused tests and then the full `pnpm test` suite; keep the output green before moving on.

### Task 2: Add native CSV bridge and settings UI

**Files:**
- Create: `src/domain/todoFileBridge.ts`
- Create: `src/ui/settings/TodoSyncSettings.tsx`
- Modify: `src/domain/types.ts`
- Modify: `src/domain/settingsStore.ts`
- Modify: `src/ui/settings/SettingsWindow.tsx`
- Modify: `src/ui/theme/tokens.css`
- Test: `tests/domain/settingsStore.test.ts`

**Interfaces:**
- `readTodoSyncFile(path: string): Promise<string | null>`
- `writeTodoSyncFile(path: string, csv: string): Promise<boolean>`
- `getDefaultTodoSyncPath(): Promise<string | null>`

- [x] Write failing settings normalization tests showing old settings load with sync disabled and new settings retain path/enabled values.
- [x] Run the focused settings test and confirm the new fields are absent/failing.
- [x] Add the three Tauri commands to the bridge wrapper, returning browser-safe no-op results when not running under Tauri.
- [x] Add sync settings with a path input, default Documents path action, enable switch, immediate sync button, status text, and clear OneDrive/坚果云 guidance.
- [x] On startup/path change, read and merge the CSV once; after Todo/group changes debounce an export; on window focus read and merge again.
- [x] Keep local Todo usable when the path is blank, Tauri is unavailable, or file I/O fails; never replace local state with an empty remote file.
- [x] Run focused and full tests plus TypeScript checking.

### Task 3: Make the desktop pet genuinely transparent and fix titlebar behavior

**Files:**
- Create: `src/ui/window/petWindow.ts`
- Modify: `src/ui/settings/SettingsWindow.tsx`
- Modify: `src/ui/window/windowActions.ts`
- Modify: `src/main.tsx`
- Modify: `src/ui/theme/tokens.css`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/capabilities/default.json`
- Test: `tests/ui/windowActions.test.ts`

**Interfaces:**
- `showPetWindow(): Promise<void>` in the Tauri command bridge.
- `performWindowAction('close')` continues to call the current window close, with Rust converting it to hide for `main`.

- [x] Add a failing UI/helper test that the Tauri pet action uses a native command and that browser preview remains the only browser fallback.
- [x] Run the focused test and confirm the current code still opens the preview fallback.
- [x] Add a Rust `show_pet_window` command that gets the configured `pet` webview window, shows it, unminimizes it, focuses it, and returns a meaningful error if missing.
- [x] Replace the silent `WebviewWindow` creation catch in React with the command; expose an in-app error message instead of showing the preview in a packaged build.
- [x] Add `data-window="pet"` and CSS rules for transparent `html`, `body`, and `#root`; add `noRedirectionBitmap` and the required webview-window permission.
- [x] Keep the titlebar buttons from starting drag gestures and add accessible action feedback when a browser preview cannot execute a native window action.
- [x] Run focused tests, `pnpm test`, `pnpm exec tsc --noEmit`, and a Vite build.

### Task 4: Add system tray, hide-on-close, and real Windows startup toggle

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`
- Modify: `src/ui/settings/SettingsWindow.tsx`
- Modify: `src/ui/theme/tokens.css`

**Interfaces:**
- Rust commands: `show_main_window`, `show_pet_window`, `hide_pet_window`, `toggle_start_on_boot`, `default_todo_sync_path`, `read_text_file`, `write_text_file`.
- Tray menu ids: `show-main`, `toggle-pet`, `toggle-startup`, `exit`.

- [x] Add `tray-icon` and `winreg` dependencies/configuration, then run `cargo check` to establish the failing/compilation checkpoint before implementation.
- [x] Build a tray icon with the default app icon and menu items for main window, pet visibility, startup toggle, and exit; left-click/double-click shows the main window.
- [x] Intercept `main` `CloseRequested`, prevent destruction, and hide the window; pet close requests hide the pet as well.
- [x] Store the Windows Run value under `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run`, quoting the current executable path and deleting it when disabled.
- [x] Wire tray menu state to the same registry helper and make `exit` call `app.exit(0)` so the user can truly quit.
- [x] Run `cargo check`, TypeScript checking, and the full frontend test suite.

### Task 5: Regenerate rounded pet icon and package

**Files:**
- Modify: `src-tauri/icons/icon.svg`
- Regenerate: `src-tauri/icons/icon.ico`, `icon.png`, size variants and bundle assets
- Create/update: `outputs/小番茄-0.1.0-x64-setup.exe`, `outputs/小番茄-0.1.0-portable-v3.exe`, `outputs/小番茄-说明.md`

- [x] Replace the transparent-only SVG with a rounded-rectangle background and the same tomato pet face used by the UI.
- [x] Run `pnpm tauri icon src-tauri/icons/icon.svg -o src-tauri/icons` and inspect the generated PNG visually.
- [x] Run `pnpm test`, `pnpm exec tsc --noEmit`, `cargo check`, and the Windows Tauri build.
- [x] Copy the fresh NSIS installer and portable executable to `outputs` using a new portable filename so locked old processes are not overwritten.
- [x] Write a short usage note explaining tray close, CSV path selection, cloud-sync folder placement, and the need to close old versions before testing the new package.
