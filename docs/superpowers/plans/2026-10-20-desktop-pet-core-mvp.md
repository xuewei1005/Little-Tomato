# 「小番茄」桌面宠物核心 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个可在 Windows 10/11 常驻桌面的 Tauri「小番茄」核心 MVP，包含透明宠物浮窗、动画状态、番茄钟、起身提醒、准点提醒、Todo 倒数、称呼/外观设置和本地暖心 tips。

**Architecture:** 使用 Tauri 2 承载真正透明的桌面窗口和托盘，React/TypeScript 负责设计感设置界面与宠物表现，Rust 只承载窗口、持久化和系统级外壳能力。业务逻辑拆成不依赖 UI 的纯 TypeScript 模块：`FocusTimer`、`ReminderScheduler`、`TodoStore`、`TodoReminderPolicy`、`TodoDateService`、`CalendarService`、`PetStateMachine` 和 `SettingsStore`；UI 只通过事件和明确的数据接口消费它们。

**Tech Stack:** Tauri 2、React、TypeScript、Vite、pnpm、Vitest、React Testing Library、Rust stable、Windows WebView2；日期使用 `date-fns`，农历节日使用 `lunar-javascript`，动画首版使用 PNG/WebP 帧或分层图层。

**Spec:** `docs/superpowers/specs/2026-10-20-desktop-pet-focus-design.md`

## Global Constraints

- 目标平台固定为 Windows 10/11。
- 采用 Tauri 2 + React + TypeScript + Vite；不改回 Electron。
- 第一版只做轻量 2D/2.5D 动画，不做实时 3D 骨骼渲染。
- 产品名固定为“小番茄”，宠物昵称默认“小番茄”，但必须允许用户修改。
- 宠物浮窗必须使用真正的透明背景，不显示矩形底板；设置中心可以使用实体卡片背景。
- 番茄钟、准点提醒、节日提醒和 tips 不依赖网络。
- Todo 和用户偏好只保存在本地；生日、房贷等不创建单独的数据类型。
- Todo 临近截止时提高随机提醒频率，但提醒只能在工作时段触发并受勿扰设置限制。
- Todo 支持自定义分组和 `starred` 星标；星标只影响智能视图和视觉标记，不自动改变提醒频率。
- 主界面提供“我的一天”“重要”“全部任务”三个智能视图，以及用户创建的分组。
- 界面主题支持 `light`、`dark` 和 `system`，默认跟随系统。
- 微信通知不在本计划实现；它属于独立的 `windows-notification-bridge` 计划。
- 不读取微信数据库、聊天记录、联系人或登录态。
- 微信相关原文不得落盘；核心 MVP 不创建微信数据结构。
- 任何提醒都必须遵守勿扰时段和用户选择的提醒强度。
- 设备睡眠/唤醒后按系统时间重算，不依赖前端 tick 次数。
- 当前工作区不是 Git 仓库；每个任务必须以自动化测试或明确的手工验收命令作为检查点，不执行不存在的 `git commit`。

## 文件地图

- `package.json`：脚本和前端依赖。
- `vite.config.ts`、`tsconfig*.json`、`vitest.config.ts`：构建与测试配置。
- `src/domain/types.ts`：设置、计时器、提醒、日历和宠物事件的共享类型。
- `src/domain/focusTimer.ts`：纯函数番茄钟状态机。
- `src/domain/reminderScheduler.ts`：准点提醒、勿扰时段和错过提醒规则。
- `src/domain/todoStore.ts`：Todo 增删改、完成、延后和本地序列化。
- `src/domain/todoGroupStore.ts`：自定义分组、智能视图、计数和删除迁移。
- `src/domain/todoReminderPolicy.ts`：按截止时间计算随机提醒频率和下一次提醒窗口。
- `src/domain/calendarService.ts`：传统节日、法定节假日数据和用户日期的读取接口。
- `src/domain/todoDateService.ts`：Todo 的公历/农历、倒数、重复和目标日期计算。
- `src/domain/tipsLibrary.ts`：本地暖心 tips 选择器。
- `src/domain/petStateMachine.ts`：事件到宠物动画状态的优先级决策。
- `src/domain/settingsStore.ts`：设置默认值、校验、迁移和 Tauri 持久化接口。
- `src/content/holidays.json`：可替换的节日/法定节假日数据。
- `src/content/tips.json`：本地暖心 tips 内容。
- `src/ui/pet/PetWindow.tsx`：宠物窗口的根组件。
- `src/ui/pet/PetAvatar.tsx`：小番茄的动画表现和交互。
- `src/ui/theme/tokens.css`：小番茄的颜色、间距、圆角和阴影设计 token。
- `src/ui/pet/PetBubble.tsx`：状态/提醒小字气泡。
- `src/ui/pet/pet.css`：透明浮窗、角色布局和低频动画。
- `src/ui/settings/SettingsWindow.tsx`：设置中心。
- `src/ui/settings/TodoEditor.tsx`：Todo 清单和截止时间编辑。
- `src/ui/settings/TodoListPanel.tsx`：Todo 列表、星标和倒数状态。
- `src/ui/settings/SidebarNav.tsx`：智能视图、自定义分组和未完成数量。
- `src/ui/settings/GroupEditor.tsx`：分组创建、改名、排序和删除确认。
- `src/ui/settings/AppearanceSettings.tsx`：宠物昵称、颜色、性别、透明度和动画设置。
- `src/ui/settings/settings.css`：设置中心样式。
- `src/ui/app/App.tsx`：窗口入口和事件连接。
- `src-tauri/src/main.rs`：Tauri 入口。
- `src-tauri/src/commands.rs`：设置读写和窗口控制命令。
- `src-tauri/src/tray.rs`：托盘菜单与退出/暂停/设置操作。
- `src-tauri/tauri.conf.json`：透明窗口、权限、打包设置。
- `tests/domain/*.test.ts`：纯业务逻辑测试。
- `tests/ui/*.test.tsx`：关键 UI 状态和设置行为测试。

---

### Task 1: 创建 Tauri/React 工程骨架和测试基础设施

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vitest.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/ui/app/App.tsx`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/main.rs`
- Create: `.gitignore`
- Create: `README.md`

**Interfaces:**
- Produces `pnpm dev` for a browser preview and `pnpm tauri dev` for the desktop shell.
- Produces `pnpm test` for Vitest and `pnpm test:watch` for local development.

- [ ] **Step 1: 检查并安装 Tauri 前置工具**

运行：

```powershell
node --version
pnpm --version
rustup --version
cargo --version
```

Node 和 pnpm 当前已存在；若 `rustup`/`cargo` 不存在，安装 Rust stable 后重新打开 PowerShell，并确认：

```powershell
rustup default stable
rustc --version
cargo --version
```

同时确认 WebView2 Runtime 已安装；Windows 11 通常自带，Windows 10 使用微软 WebView2 Runtime。

- [ ] **Step 2: 创建最小 Vite/React 文件并安装依赖**

执行：

```powershell
pnpm add react react-dom @tauri-apps/api date-fns lunar-javascript
pnpm add -D @vitejs/plugin-react typescript vite vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/react @types/react-dom @tauri-apps/cli
```

在 `package.json` 固定脚本：

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "tauri": "tauri"
  }
}
```

- [ ] **Step 3: 配置 Vite、TypeScript 和 Vitest**

`vite.config.ts` 必须启用 React 插件；`vitest.config.ts` 必须使用 `jsdom` 环境并加载 `@testing-library/jest-dom`。先加入一个最小测试 `tests/ui/app.test.tsx`，渲染 `App` 并断言页面包含“小番茄”。

- [ ] **Step 4: 初始化 Tauri 窗口配置**

将主窗口设置为真正透明、无边框、可调整大小、始终置顶、不抢焦点；默认大小设为 `360x420`，应用标题和产品名为“小番茄”。`src-tauri/src/main.rs` 只负责创建应用、注册命令和托盘，不在 Rust 中承载业务计时器。

- [ ] **Step 5: 运行首个红/绿检查**

运行：

```powershell
pnpm test -- tests/ui/app.test.tsx
pnpm build
pnpm tauri dev
```

预期：测试通过，前端构建通过，桌面窗口打开且透明外壳可见；此时角色可以先使用临时纯色圆形，后续任务会替换为小番茄素材。

### Task 2: 定义领域类型、设置默认值和本地持久化

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/defaultSettings.ts`
- Create: `src/domain/settingsStore.ts`
- Create: `tests/domain/settingsStore.test.ts`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/main.rs`

**Interfaces:**
- `loadSettings(): Promise<AppSettings>`
- `saveSettings(next: AppSettings): Promise<void>`
- `validateSettings(input: unknown): AppSettings`
- `createDefaultSettings(): AppSettings`
- `SettingsStore` 不暴露文件路径；UI 只调用 `loadSettings`/`saveSettings`。

- [ ] **Step 1: 写设置校验的失败测试**

覆盖默认值、非法分钟数、无效时间字符串、重复提醒星期和旧版本配置迁移。示例断言：

```ts
it('clamps focus duration and restores missing fields', () => {
  const result = validateSettings({ focusMinutes: 0, displayName: '小林' });
  expect(result.focusMinutes).toBe(1);
  expect(result.displayName).toBe('小林');
  expect(result.shortBreakMinutes).toBe(5);
});
```

- [ ] **Step 2: 定义共享类型**

`AppSettings` 至少包含：`version`、`displayName`、`petName`、`petGender`、`petTheme`、`themeMode`、`focusMinutes`、`shortBreakMinutes`、`longBreakMinutes`、`cyclesBeforeLongBreak`、`reminderIntensity`、`todoReminderMode`、`quietHours`、`petPosition`、`opacity`、`soundEnabled`、`animationEnabled`、`startOnBoot`、`scheduledReminders`、`todoItems`、`todoGroups`、`activeTodoView`。

`ReminderIntensity` 使用 `'animation' | 'sound' | 'persistent'`；`RepeatRule` 使用 `'once' | 'daily' | 'weekdays' | 'weekly'`。

- [ ] **Step 3: 实现默认值、校验和迁移**

所有边界值必须在一个模块中定义：工作时长 `1..240` 分钟，休息时长 `1..120` 分钟，不透明度 `0.35..1`，用户称呼和宠物昵称各最多 24 个 Unicode 字符，Todo 标题最多 120 个 Unicode 字符，分组名称最多 24 个 Unicode 字符。`petGender` 使用 `'unspecified' | 'female' | 'male'`，`todoReminderMode` 使用 `'gentle' | 'standard' | 'active'`，`themeMode` 使用 `'light' | 'dark' | 'system'`。未知字段忽略，未知版本回退到当前版本默认值并保留可识别字段。

- [ ] **Step 4: 连接 Tauri 本地配置**

Rust 命令使用 Tauri `AppHandle` 获取应用配置目录，在 `settings.json` 原子写入：先写临时文件，再替换目标文件；读失败时返回默认值并在前端显示一次恢复提示。设置文件只存用户设置，不存微信通知。

- [ ] **Step 5: 运行测试**

运行：

```powershell
pnpm test -- tests/domain/settingsStore.test.ts
```

预期：非法输入、迁移和默认值测试全部通过。

### Task 3: 实现番茄钟状态机

**Files:**
- Create: `src/domain/focusTimer.ts`
- Create: `tests/domain/focusTimer.test.ts`
- Modify: `src/domain/types.ts`

**Interfaces:**
- `createFocusTimer(config: FocusTimerConfig, nowMs: number): FocusTimerState`
- `reduceFocusTimer(state: FocusTimerState, event: FocusTimerEvent, nowMs: number): FocusTimerState`
- `getRemainingMs(state: FocusTimerState, nowMs: number): number`
- `getNextPhase(state: FocusTimerState): FocusPhase`

- [ ] **Step 1: 写失败测试**

覆盖开始、暂停、恢复、跳过、工作结束、短休息结束、完成一轮进入长休息、睡眠唤醒后的剩余时间计算。测试使用固定 `nowMs`，禁止调用真实时钟。

```ts
it('uses wall-clock time after a long pause', () => {
  const initial = createFocusTimer({ focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, cyclesBeforeLongBreak: 4 }, 0);
  const started = reduceFocusTimer(initial, { type: 'start' }, 0);
  const paused = reduceFocusTimer(started, { type: 'pause' }, 5 * 60_000);
  const resumed = reduceFocusTimer(paused, { type: 'resume' }, 20 * 60_000);
  expect(getRemainingMs(resumed, 20 * 60_000)).toBe(20 * 60_000);
});
```

- [ ] **Step 2: 定义状态和事件**

`FocusPhase` 为 `'idle' | 'focus' | 'shortBreak' | 'longBreak' | 'paused' | 'completed'`。事件为 `'start' | 'pause' | 'resume' | 'skip' | 'reset' | 'tick'`；状态保存 `phase`、`startedAtMs`、`pausedAtMs`、`pausedTotalMs`、`phaseEndsAtMs`、`completedFocusCycles`。

- [ ] **Step 3: 实现最小纯函数状态机**

所有状态转换都返回新对象；`tick` 只根据 `nowMs` 判断是否跨过 `phaseEndsAtMs`，不累加 tick 次数。完成工作阶段时返回 `break_due` 所需的可观察结果或由上层比较前后 phase 得到事件。

- [ ] **Step 4: 运行测试并覆盖边界**

运行：

```powershell
pnpm test -- tests/domain/focusTimer.test.ts
```

预期：所有 phase 转换和睡眠唤醒测试通过。

### Task 4: 实现准点提醒、Todo 日期服务、节日服务和暖心 tips

**Files:**
- Create: `src/domain/reminderScheduler.ts`
- Create: `src/domain/calendarService.ts`
- Create: `src/domain/todoDateService.ts`
- Create: `src/domain/tipsLibrary.ts`
- Create: `src/content/holidays.json`
- Create: `src/content/tips.json`
- Create: `tests/domain/reminderScheduler.test.ts`
- Create: `tests/domain/calendarService.test.ts`
- Create: `tests/domain/todoDateService.test.ts`
- Create: `tests/domain/tipsLibrary.test.ts`

**Interfaces:**
- `getDueReminders(reminders: ScheduledReminder[], now: Date, lastCheck: Date | null): ReminderOccurrence[]`
- `isInQuietHours(now: Date, quietHours: QuietHours): boolean`
- `getFestivalDateOptions(year: number): CalendarDateOption[]`
- `getTodoDateSnapshot(todo: TodoItem, now: Date): TodoDateSnapshot`
- `getNextTip(context: TipContext, recentTipIds: string[], random: () => number): Tip`

- [ ] **Step 1: 写重复规则和勿扰时段失败测试**

覆盖一次性、每天、工作日、指定星期；跨午夜勿扰时段（例如 `22:00..08:00`）；同一分钟重复检查只返回一次；错过普通提醒不补发，重要提醒最多补发一次。

- [ ] **Step 2: 写节日数据和用户日期失败测试**

在 `holidays.json` 中提供传统节日、法定假期年度数据结构和可替换年份记录；它只负责提供日期选项，不产生生日/纪念日/房贷等特殊对象。测试必须验证公历/农历日期选项和 Todo 的倒数天数。

- [ ] **Step 3: 实现提醒计算**

使用 `date-fns` 处理公历日期和重复规则，使用 `lunar-javascript` 计算传统节日。调度器只返回 `ReminderOccurrence`，不直接播放声音或改 UI；调用方根据强度和勿扰状态决定表现。

- [ ] **Step 4: 实现本地 tips 选择器**

`tips.json` 至少包含工作、休息、饮水、眼睛、节日五类内容；每条有 `id`、`text`、`category`、`minIntervalMinutes`。选择器排除最近已展示的 id，并用注入的随机函数保证测试可重复。

- [ ] **Step 5: 实现 Todo 日期服务**

`TodoItem` 支持可选 `targetDate`、可选 `targetTime`、`calendarType`（`solar`/`lunar`）、可选 `groupId`、`pinned`、`starred` 和 `repeatRule`（`none`/`daily`/`weekly`/`monthly`/`yearly`）。`getTodoDateSnapshot` 返回 `daysRemaining`、`nextOccurrence`、`isToday` 和 `isOverdue`；没有目标日期时返回 `hasDate: false`，不生成倒数或临近截止频率。

- [ ] **Step 6: 运行测试**

```powershell
pnpm test -- tests/domain/reminderScheduler.test.ts tests/domain/calendarService.test.ts tests/domain/todoDateService.test.ts tests/domain/tipsLibrary.test.ts
```

### Task 5: 实现 Todo 清单与临近截止提醒策略

**Files:**
- Create: `src/domain/todoStore.ts`
- Create: `src/domain/todoGroupStore.ts`
- Create: `src/domain/todoReminderPolicy.ts`
- Create: `tests/domain/todoStore.test.ts`
- Create: `tests/domain/todoGroupStore.test.ts`
- Create: `tests/domain/todoReminderPolicy.test.ts`
- Modify: `src/domain/types.ts`
- Modify: `src/domain/settingsStore.ts`

**Interfaces:**
- `createTodo(input: NewTodoInput, nowMs: number): TodoItem`
- `updateTodo(todo: TodoItem, patch: TodoPatch): TodoItem`
- `completeTodo(todo: TodoItem, completedAtMs: number): TodoItem`
- `getTodoDateSnapshot(todo: TodoItem, now: Date): TodoDateSnapshot`
- `getNextTodoReminder(todo: TodoItem, now: Date, policy: TodoReminderMode, workWindow: WorkWindow, random: () => number): TodoReminderOccurrence | null`
- `createTodoGroup(input: NewTodoGroupInput, nowMs: number): TodoGroup`
- `renameTodoGroup(group: TodoGroup, name: string): TodoGroup`
- `deleteTodoGroup(groups: TodoGroup[], todos: TodoItem[], groupId: string): { groups: TodoGroup[]; todos: TodoItem[] }`
- `getTodoView(view: TodoView, todos: TodoItem[], now: Date): TodoItem[]`
- `TodoReminderMode`：`'gentle' | 'standard' | 'active'`

- [ ] **Step 1: 写 Todo 生命周期失败测试**

覆盖新增、编辑标题/目标日期、无日期 Todo、完成、延后、恢复未完成、已完成不再提醒、置顶、星标、分组、重复和本地序列化。标题为空或超长时返回校验错误，不静默创建空 Todo。

- [ ] **Step 2: 写截止时间与提醒频率失败测试**

用固定时间和固定随机函数覆盖：无目标日期每天最多一次；超过 7 天、3–7 天、1–2 天、截止当天和逾期状态的下一次提醒窗口。测试同时验证公历/农历倒数、工作时段外、勿扰时段内和已暂停单条 Todo 都返回 `null`。

- [ ] **Step 3: 实现 Todo 存储和状态变化**

`TodoItem` 保存 `id`、`title`、`note`、可选 `targetDate`、可选 `targetTime`、`calendarType`、可选 `groupId`、`pinned`、`starred`、`repeatRule`、`createdAtMs`、`priority`、`status`、`snoozedUntilMs`、`reminderMode` 和 `lastRemindedAtMs`。`TodoGroup` 保存 `id`、`name`、`accentColor`、`sortOrder` 和 `archived`；系统智能视图不作为普通分组持久化。数据通过 `SettingsStore` 的版本化结构落盘，不创建网络同步；“房贷”“生日”等只存在于 `title` 和日期字段中。

- [ ] **Step 4: 实现自定义分组和智能视图**

实现分组创建、改名、排序、归档和删除迁移；删除分组时将相关 Todo 的 `groupId` 设为 `null`。`getTodoView('today')` 返回今天到期或今天安排的未完成 Todo，`getTodoView('starred')` 返回 `starred: true` 的未完成 Todo，`getTodoView('all')` 返回全部未完成 Todo。计数只统计未完成项。

- [ ] **Step 5: 实现临近截止提醒策略**

按设计稿中的默认“标准”频率计算提醒；“轻柔”将各频率窗口放大 2 倍，“积极”将窗口缩短为 0.5 倍但仍受每天最大次数限制。随机只用于在合法窗口内选择具体触发时刻，测试通过注入 `random` 保持可重复。

- [ ] **Step 6: 运行 Todo 测试**

```powershell
pnpm test -- tests/domain/todoStore.test.ts tests/domain/todoGroupStore.test.ts tests/domain/todoReminderPolicy.test.ts
```

### Task 6: 实现宠物事件状态机和低频动画层

**Files:**
- Create: `src/domain/petStateMachine.ts`
- Create: `tests/domain/petStateMachine.test.ts`
- Create: `src/ui/pet/PetWindow.tsx`
- Create: `src/ui/pet/PetAvatar.tsx`
- Create: `src/ui/pet/PetBubble.tsx`
- Create: `src/ui/pet/pet.css`
- Create: `src/ui/pet/assets/` 下的小番茄 PNG/WebP 素材
- Modify: `src/domain/types.ts`

**Interfaces:**
- `reducePetState(state: PetVisualState, event: PetEvent, nowMs: number): PetVisualState`
- `PetAvatar` props：`mode: PetMode; animationEnabled: boolean; onInteract?: () => void`
- `PetBubble` props：`text: string | null; intensity: ReminderIntensity; visible: boolean`

- [ ] **Step 1: 写状态优先级失败测试**

测试 `message` 和 `stretch` 可覆盖 `idle`，`focus` 在事件结束后恢复，`attention` 为短暂状态，动画关闭时仍保留静态角色和必要文字。

- [ ] **Step 2: 准备原始 IP 素材**

基于已确认的小番茄概念稿制作一组无文字、透明背景的轻量素材：待机、专注、伸展、消息、庆祝至少各一组。素材不得包含品牌标志或第三方角色；文件名使用 `xiao-fanqie-<mode>-<frame>.webp`。

- [ ] **Step 3: 实现 CSS/帧动画**

使用 `prefers-reduced-motion`、设置中的 `animationEnabled` 和低频 `requestAnimationFrame`/CSS animation；待机动画不使用持续高频 JavaScript tick。动画状态由 `data-mode` 属性驱动，角色层和气泡层分离。

- [ ] **Step 4: 实现鼠标交互**

角色本体可拖动窗口；点击触发 `attention`，双击通过 Tauri 命令打开设置窗口；右键交给托盘/上下文菜单，不阻塞主窗口。

- [ ] **Step 5: 运行测试和人工检查**

```powershell
pnpm test -- tests/domain/petStateMachine.test.ts
pnpm tauri dev
```

人工检查：透明背景正确、拖动顺滑、动画关闭后静态显示、窗口不抢输入焦点、DPI 125% 下角色不被裁切。

### Task 7: 接入番茄钟、调度器、Todo 和宠物窗口

**Files:**
- Modify: `src/ui/app/App.tsx`
- Modify: `src/ui/pet/PetWindow.tsx`
- Create: `src/app/runtimeController.ts`
- Create: `src/app/eventBus.ts`
- Create: `tests/app/runtimeController.test.ts`
- Modify: `src/domain/todoReminderPolicy.ts`

**Interfaces:**
- `RuntimeController.start(): void`
- `RuntimeController.dispatch(event: RuntimeEvent): void`
- `RuntimeController.getSnapshot(): RuntimeSnapshot`
- `RuntimeSnapshot` 包含 `settings`、`focusTimer`、`petVisualState`、`activeBubble`、`nextReminderAt`、`activeTodoCount`、`todayTodoCount`、`starredTodoCount`、`activeTodoView`、`nearestCountdown`。

- [ ] **Step 1: 写端到端领域编排失败测试**

给定固定时间，启动番茄钟；当工作阶段结束时断言 snapshot 进入 `stretch` 并生成起身提示；当准点提醒或 Todo 随机窗口命中时断言只生成一个气泡；勿扰时段内断言没有气泡；今天/重要/全部任务的计数和最近倒数日正确暴露。

- [ ] **Step 2: 实现事件总线**

定义 `RuntimeEvent`：`focus/start`、`focus/pause`、`focus/resume`、`focus/skip`、`clock/tick`、`reminder/check`、`todo/complete`、`todo/snooze`、`pet/dismiss`、`settings/updated`。事件总线只在 runtime 层组合纯模块，不让 UI 直接修改状态。

- [ ] **Step 3: 实现运行时控制器**

启动时读取设置，初始化 timer/scheduler/todoStore/calendar/todoDateService/tips；每 500–1000ms 读取系统时间并计算快照。系统从休眠恢复后用当前时间做一次完整重算；组件卸载时清理 interval。没有目标日期的 Todo 只按普通随机提醒处理；有目标日期的 Todo 由 `todoDateService` 提供倒数和临近截止状态，不改变番茄钟 phase。

- [ ] **Step 4: 接入 PetWindow**

根据 snapshot 渲染 `PetAvatar` 和 `PetBubble`，并允许点击气泡上的“完成/稍后/今天不再提醒”。气泡显示完毕或用户点击后发送 `pet/dismiss`；提醒优先级由 `PetStateMachine` 统一处理。

- [ ] **Step 5: 运行编排测试**

```powershell
pnpm test -- tests/app/runtimeController.test.ts
pnpm tauri dev
```

### Task 8: 构建有设计感的设置中心和托盘操作

**Files:**
- Create: `src/ui/settings/SettingsWindow.tsx`
- Create: `src/ui/settings/settings.css`
- Create: `src/ui/theme/tokens.css`
- Create: `src/ui/settings/TodoEditor.tsx`
- Create: `src/ui/settings/TodoListPanel.tsx`
- Create: `src/ui/settings/TodoDateField.tsx`
- Create: `src/ui/settings/SidebarNav.tsx`
- Create: `src/ui/settings/GroupEditor.tsx`
- Create: `src/ui/settings/AppearanceSettings.tsx`
- Create: `src/ui/settings/ReminderEditor.tsx`
- Create: `tests/ui/settings.test.tsx`
- Modify: `src-tauri/src/tray.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src/ui/app/App.tsx`

**Interfaces:**
- `SettingsWindow` 读取/保存 `AppSettings`，不得直接操作 Tauri 文件 API。
- `TodoEditor` 输出通用 `TodoItem`，提供标题、可选目标日、公历/农历、分组、星标、置顶、重复、完成、延后和暂停提醒操作；不提供生日/房贷等特殊类型选择。
- `TodoListPanel` 显示所有 Todo、倒数状态、置顶项和可点击的星标。
- `TodoDateField` 输出 `targetDate`、`targetTime` 和 `calendarType`。
- `SidebarNav` 输出 `activeTodoView`，显示“我的一天”“重要”“全部任务”和自定义分组及未完成数量。
- `GroupEditor` 输出 `TodoGroup`，支持创建、改名、排序、归档和删除确认。
- `AppearanceSettings` 输出 `petName`、`petGender`、`petTheme`、`themeMode`、`opacity` 和 `animationEnabled`。
- `ReminderEditor` 输出 `ScheduledReminder`。
- 托盘事件：`open-settings`、`toggle-pause`、`start-focus`、`quit`。

- [ ] **Step 1: 写设置页面失败测试**

覆盖称呼输入、宠物昵称/性别/颜色预览、浅色/深色/跟随系统、工作/休息时长校验、声音/动画开关、勿扰时段、添加和禁用准点提醒、添加/完成/延后 Todo、可选目标日、公历/农历、分组、星标、置顶和重复，创建/改名/排序/删除分组，保存后调用 `saveSettings`。

- [ ] **Step 2: 实现设置分组**

设置页使用统一的暖象牙白、暖橙、奶油卡片、鼠尾草绿和薰衣草紫 token，采用左侧轻量导航和右侧卡片内容，分为“今天、专注、Todo、倒数本、外观、提醒与隐私”。Todo 主界面参考用户提供的侧栏结构：智能视图在上，自定义分组在下，右侧任务行包含完成圆圈、标题、星标和日期信息；主题可切换浅色、深色或跟随系统。Todo 编辑页参考表单结构：事件名称、可选目标日、公历/农历切换、分组、星标、置顶、重复；生日、房贷和纪念日不显示为特殊入口。每个分区提供即时预览或“测试提醒”，但测试提醒不写入日程；列表优先显示置顶项和最近到期项，避免做成密集表格。

- [ ] **Step 3: 实现托盘菜单**

托盘菜单显示当前阶段、剩余时间和未完成 Todo 数，支持暂停/继续、开始专注、打开设置、退出。退出前只保存设置，不保存临时微信或通知数据。

- [ ] **Step 4: 运行 UI 测试**

```powershell
pnpm test -- tests/ui/settings.test.tsx
```

### Task 9: Windows 行为、打包和验收

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/capabilities/default.json`
- Create: `docs/qa/windows-core-mvp-checklist.md`
- Modify: `README.md`

**Interfaces:**
- `pnpm tauri build` 生成 Windows 安装包。
- `docs/qa/windows-core-mvp-checklist.md` 是人工验收的唯一清单。

- [ ] **Step 1: 配置能力和打包元数据**

配置窗口、托盘、文件读写、启动行为所需的最小权限；应用名称、版本、图标和安装包架构固定为 `x64`。禁止添加网络权限作为核心 MVP 依赖。

- [ ] **Step 2: 实现开机启动和多屏位置保存**

保存屏幕工作区相对位置而不是绝对坐标；显示器断开时回退到主屏右下角。开机启动为设置项，默认关闭。

- [ ] **Step 3: 写人工验收清单**

至少包含：首次启动、产品名和默认昵称、透明背景、拖动、置顶、托盘、称呼、宠物颜色/性别、浅色/深色/跟随系统、番茄钟完整循环、暂停/恢复、无日期 Todo、带目标日 Todo、公历/农历、分组、星标、智能视图计数、重复、完成/延后/临近截止提醒、删除分组迁移、睡眠/唤醒、勿扰、节日日期选项、DPI 100/125/150%、双屏、退出重启、CPU/内存观察。

- [ ] **Step 4: 运行最终检查**

```powershell
pnpm test
pnpm build
pnpm tauri build
```

预期：自动化测试全部通过，前端构建通过，Windows 安装包生成；人工清单通过后，核心 MVP 阶段完成。
