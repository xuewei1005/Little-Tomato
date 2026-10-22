# 小番茄宠物互动与提醒升级实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 实现立体倒计时牌、撒花庆祝、强制起身确认、可感知的点击/拖动互动、短暂 tips、统一提醒优先级和带 Windows 应用身份的微信通知版。

**Architecture:** 主窗口继续作为番茄钟、Todo、准点提醒和通知桥接的唯一状态源；通过 Tauri 事件把最小化的运行时状态发送给透明宠物窗口。宠物窗口只负责呈现牌子、动作、气泡和交互，并通过命令事件请求主窗口改变计时状态。提醒文本经统一优先级仲裁后短暂显示，避免 tips 抢占高优先级消息。

**Tech Stack:** Tauri 2、React 19、TypeScript、Vite、Vitest、Rust `windows` crate、Windows SDK `makeappx.exe`/`signtool.exe`、CSS 2.5D 图层动画。

**Spec:** `docs/superpowers/specs/2026-10-20-pet-interaction-reminder-design.md`

## Global Constraints

- 牌子视觉上只显示倒计时和图标；状态文字通过气泡和 `aria-label` 提供。
- `FocusTimer` 必须在起身确认前停在 `awaitingStandUp`，不能自动跳过。
- 微信事件只传 `sender`、`receivedAtMs`、`isGeneric`，不得传递正文、XML、通知 ID 或聊天历史。
- 便携版继续可用；微信可靠读取使用额外的带 identity 的签名 MSIX 版。
- 所有新行为先写失败测试并观察 RED，再写最小实现；每个新增纯函数和交互边界都有自动化测试。
- 现有 Todo CSV 同步格式保持兼容；输出目录最终只包含便携版、通知版所需文件和 Todo CSV，不放 NSIS 安装包。
- 当前工作区没有 Git 仓库，因此不执行 git commit；每个任务以测试和构建检查点替代提交。

---

### Task 1: 扩展番茄钟状态机为“起身确认门”

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/focusTimer.ts`
- Modify: `src/domain/settingsStore.ts`
- Modify: `src/ui/settings/SettingsWindow.tsx`
- Test: `tests/domain/focusTimer.test.ts`

**Interfaces:**
- `FocusTimerStatus` 增加 `'awaitingStandUp'`。
- `FocusTimerState` 增加 `pendingBreakPhase?: 'shortBreak' | 'longBreak'`、`standUpRequestedAtMs?: number`。
- `FocusTimerConfig` 增加可选 `standUpMinutes?: number`，缺省使用 3 分钟，兼容旧设置。
- 新增 `confirmStandUp(state, nowMs, config): FocusTimerState`。
- 新增 `getStandUpPromptMood(state, nowMs, graceMs = 120_000): 'waiting' | 'angry'`。

- [ ] **Step 1: 写计时门的失败测试**

在 `tests/domain/focusTimer.test.ts` 增加：

```ts
it('专注结束后必须停在起身确认状态', () => {
  const running = startFocusTimer(createFocusTimerState({ focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15 }), 0);
  const done = tickFocusTimer(running, 25 * 60_000, { focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15 });

  expect(done.phase).toBe('standUp');
  expect(done.status).toBe('awaitingStandUp');
  expect(done.pendingBreakPhase).toBe('shortBreak');
  expect(tickFocusTimer(done, 30 * 60_000, { focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15 })).toEqual(done);
});

it('确认起身后才开始短休息', () => {
  const waiting = {
    ...createFocusTimerState({ focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15 }),
    phase: 'standUp' as const,
    status: 'awaitingStandUp' as const,
    pendingBreakPhase: 'shortBreak' as const,
    standUpRequestedAtMs: 1000,
    remainingSec: 0,
    totalSec: 0,
  };
  const resumed = confirmStandUp(waiting, 5000, { focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15 });

  expect(resumed.phase).toBe('shortBreak');
  expect(resumed.status).toBe('running');
  expect(resumed.remainingSec).toBe(5 * 60);
  expect(resumed.startedAtMs).toBe(5000);
});

it('超过两分钟未确认后进入生气提示', () => {
  const waiting = { phase: 'standUp', status: 'awaitingStandUp', standUpRequestedAtMs: 1_000 } as FocusTimerState;

  expect(getStandUpPromptMood(waiting, 120_999)).toBe('waiting');
  expect(getStandUpPromptMood(waiting, 121_000)).toBe('angry');
});
```

- [ ] **Step 2: 运行单元测试确认 RED**

运行 `pnpm exec vitest run tests/domain/focusTimer.test.ts`，预期失败原因为缺少 `awaitingStandUp`、`confirmStandUp` 或错误的阶段转换，而不是测试导入错误。

- [ ] **Step 3: 实现最小状态机修改**

让 `tickFocusTimer` 在 focus 归零时增加完成次数、计算待进入的短休息/长休息，并返回 `standUp + awaitingStandUp`；让 `confirmStandUp` 创建带 `startedAtMs` 的 break 状态；让等待状态的 tick 不改变状态；让 `skipFocusTimer` 在等待状态下等价于确认起身。`SettingsWindow` 创建和操作 timer 时传入 `{ ...settings.focus, standUpMinutes: settings.standUpMinutes }`。

- [ ] **Step 4: 运行计时测试确认 GREEN**

运行 `pnpm exec vitest run tests/domain/focusTimer.test.ts`，确认所有计时测试通过，再运行已有 `tests/domain` 测试。

### Task 2: 建立提醒优先级和跨窗口运行时事件

**Files:**
- Create: `src/domain/petRuntime.ts`
- Modify: `src/ui/window/petCommands.ts`
- Modify: `src/domain/todoReminderPolicy.ts`
- Modify: `src/domain/types.ts`
- Test: `tests/domain/petRuntime.test.ts`
- Test: `tests/domain/todoReminderPolicy.test.ts`

**Interfaces:**
- `PET_RUNTIME_EVENT = 'pet-runtime'`、`PET_RUNTIME_SYNC_REQUEST = 'pet-runtime-sync-request'`。
- `PetReminderPriority = 'wechat' | 'timer' | 'todo' | 'scheduled' | 'interaction' | 'tip'`。
- `PetRuntimeEvent`：`timer-state`、`wechat-notice`、`reminder`、`tip` 四种 payload。
- `selectPetNotice(current, candidate, nowMs)`：高优先级事件替换低优先级事件，过期事件可被新事件替换。
- `PetCommand` 增加 `'pause-timer' | 'resume-timer' | 'confirm-stand-up'`。
- Todo reminder policy 暴露 `initialDelayMinutes` 与 `weight`，无截止 Todo 首次提醒不再固定等待 24 小时。

- [ ] **Step 1: 写优先级和 Todo 频率的失败测试**

覆盖：微信压过 tips、Todo 压过 tips、旧气泡过期后 tips 可显示、无截止 Todo 的首次提醒在 20～45 分钟窗口内、当天 Todo 比远期 Todo 权重高、星标在同等日期下提高权重。

- [ ] **Step 2: 运行定向测试确认 RED**

运行 `pnpm exec vitest run tests/domain/petRuntime.test.ts tests/domain/todoReminderPolicy.test.ts`，预期因模块或新策略不存在而失败。

- [ ] **Step 3: 实现纯函数和兼容字段**

在 `petRuntime.ts` 内集中定义事件、优先级数值、过期判断和替换逻辑；在 `todoReminderPolicy.ts` 中把无截止初次延迟设为基于 Todo ID 的稳定 20～45 分钟窗口、后续间隔设为 120 分钟，远期截止为 12 小时，3～7 天为 6 小时，1～2 天为 3 小时，当天为 60 分钟，过期为 45 分钟；`getNextTodoReminderAt` 使用 `createdAtMs` 作为首次提醒锚点，之后使用 `lastRemindedAtMs`，同一条 Todo 不因刷新而重新随机。

- [ ] **Step 4: 运行定向测试确认 GREEN**

运行同一条 Vitest 命令，确认提醒优先级和 Todo 频率测试通过。

### Task 3: 制作立体倒计时牌、宠物动作和撒花图层

**Files:**
- Create: `src/ui/pet/PetTimerBoard.tsx`
- Create: `src/ui/pet/ConfettiBurst.tsx`
- Create: `src/ui/pet/petInteraction.ts`
- Modify: `src/ui/pet/PetAvatar.tsx`
- Modify: `src/domain/types.ts`
- Modify: `src/ui/theme/tokens.css`
- Test: `tests/ui/petTimerBoard.test.tsx`
- Test: `tests/ui/petInteraction.test.ts`
- Modify: `tests/ui/petAvatar.test.tsx`

**Interfaces:**
- `PetTimerBoardProps = { state: FocusTimerState; onPause: () => void; onResume: () => void; onConfirmStandUp: () => void }`。
- `ConfettiBurst({ visible }: { visible: boolean })` 在 visible 时渲染 18 个可复用花瓣/星星节点，隐藏时不占视觉空间。
- `pickPetReaction(random?: () => number): { state: PetVisualState; message: string }`。
- `PetVisualState` 增加 `'angry'`；`PetAvatar` 增加手臂、轮廓高光和 angry 表情图层。

- [ ] **Step 1: 写牌子和互动的失败测试**

断言 running 只渲染 `mm:ss` 和暂停图标、paused 只渲染开始图标、awaitingStandUp 只渲染确认图标；点击相应按钮调用正确回调；`pickPetReaction` 在固定随机数下返回可预测动作；`ConfettiBurst` 渲染 18 个节点。

- [ ] **Step 2: 运行定向 UI 测试确认 RED**

运行 `pnpm exec vitest run tests/ui/petTimerBoard.test.tsx tests/ui/petInteraction.test.ts tests/ui/petAvatar.test.tsx`，确认失败来自缺少组件、状态或 class。

- [ ] **Step 3: 实现最小可用组件和 CSS 质感**

牌子使用圆角厚边框、渐变底色、内外阴影和 `board-draw`/`board-float`/`board-confirm` 动画；宠物增加 `pet-arm`、`pet-gloss`、`pet-rim`、`state-angry` 和 `interaction-pressed`/`interaction-dragging` class；撒花使用纯 CSS 变换，不引入图片或动画依赖。牌子按钮使用 `data-pet-interactive="true"` 和图标 `aria-label`，不在视觉上增加其它文字。

- [ ] **Step 4: 运行定向 UI 测试确认 GREEN**

运行定向命令，确认组件与 CSS class 断言通过。

### Task 4: 修复宠物拖动并接入点击/选择互动

**Files:**
- Create: `src/ui/pet/usePetInteraction.ts`
- Modify: `src/ui/pet/PetWindow.tsx`
- Modify: `src/ui/window/windowActions.ts`
- Test: `tests/ui/petInteraction.test.tsx`
- Modify: `tests/ui/windowChrome.test.tsx`

**Interfaces:**
- `usePetInteraction({ onClickReaction }): { interactionClass; handlePointerDown; handlePointerMove; handlePointerUp; handlePointerCancel; handleClick }`。
- `startWindowDragging` 只从一个非交互左键入口调用；可捕获的拖动失败返回 `false`，不会阻塞点击回应。

- [ ] **Step 1: 写拖动和点击的失败测试**

覆盖：牌子按钮 pointerdown 不调用 `startDragging`；宠物本体左键 pointerdown 调用一次 `startDragging` 并出现 dragging class；没有位移的点击触发一次随机回应；位移超过 4px 后不触发点击回应；pointerup/cancel 清理 dragging class。

- [ ] **Step 2: 运行测试确认 RED**

运行 `pnpm exec vitest run tests/ui/petInteraction.test.tsx tests/ui/windowChrome.test.tsx`，预期新拖动 seam 相关测试失败。

- [ ] **Step 3: 实现单入口拖动和交互状态**

在 `PetWindow` 父容器统一处理 pointer 事件：过滤非左键和 `[data-pet-interactive="true"]`，记录起点，调用 `preventDefault()` 与 `startWindowDragging()`，用 4px 阈值区分拖动和点击，pointerup/cancel 清理状态。点击时调用 `pickPetReaction`，只在没有发生拖动时更新短回应和 visual state。保留右键原生菜单，但不让右键触发拖动。

- [ ] **Step 4: 运行 UI 测试确认 GREEN**

运行同一条定向命令，确认拖动只调用一次、按钮可点击、拖动不会误触发动作。

### Task 5: 在宠物窗口实现计时牌、庆祝、起身确认和短暂 tips

**Files:**
- Create: `src/ui/pet/usePetRuntime.ts`
- Modify: `src/ui/pet/PetWindow.tsx`
- Modify: `src/ui/window/petWindow.ts`
- Test: `tests/ui/petRuntime.test.tsx`
- Modify: `tests/ui/petContextMenu.test.tsx`

**Interfaces:**
- `usePetRuntime(): { timerState; message; visualState; showTip; showConfetti; standUpMood }`。
- 宠物挂载后 `emit(PET_RUNTIME_SYNC_REQUEST)`；收到 `PET_RUNTIME_EVENT` 后更新计时状态、提醒气泡和庆祝状态。

- [ ] **Step 1: 写运行时集成失败测试**

覆盖：timer-state running 显示牌子；focus → awaitingStandUp 只触发一次撒花；awaitingStandUp 超过宽限时间使用 angry；reminder 会隐藏 tip；tip 在超时后隐藏；pet 挂载发送同步请求；牌子暂停/开始/确认动作发出 `pet-command`。

- [ ] **Step 2: 运行测试确认 RED**

运行 `pnpm exec vitest run tests/ui/petRuntime.test.tsx tests/ui/petContextMenu.test.tsx`，确认新运行时行为失败。

- [ ] **Step 3: 实现运行时控制器和短暂 tips**

`usePetRuntime` 只注册一套 Tauri event listener；使用 `selectPetNotice` 处理高优先级气泡；tips 首次展示 8 秒，后续使用 120～240 秒随机间隔展示 6～10 秒；wechat/reminder/timer 事件显示期间不启动 tip timer。收到 timer-state 时检测 focus → standUp 过渡，设置 `showConfetti` 约 2.2 秒后关闭。

- [ ] **Step 4: 将 PetWindow 组合为牌子、宠物和气泡**

保持透明窗口结构；牌子、ConfettiBurst 和 PetAvatar 在同一 `.pet-window-inner` 内按 z-index 分层。牌子按钮调用 `emit(PET_COMMAND_EVENT, ...)`，宠物点击调用 interaction hook，右键继续调用现有原生菜单。

- [ ] **Step 5: 运行测试确认 GREEN**

运行定向命令，再运行所有 `tests/ui` 测试。

### Task 6: 让主窗口成为计时、提醒和微信通知的唯一状态源

**Files:**
- Modify: `src/ui/settings/SettingsWindow.tsx`
- Modify: `src/domain/notificationBridge.ts`
- Modify: `src/domain/wechatParser.ts`
- Modify: `src-tauri/src/notification_bridge.rs`
- Test: `tests/ui/settingsRuntimeBridge.test.tsx`
- Modify: `tests/domain/notificationBridge.test.ts`
- Modify: `tests/domain/wechatParser.test.ts`

**Interfaces:**
- `SettingsWindow` 监听 `PET_COMMAND_EVENT` 并处理 `start-timer`、`pause-timer`、`resume-timer`、`confirm-stand-up`、`add-todo`。
- `SettingsWindow` 使用 `emitTo('pet', PET_RUNTIME_EVENT, event)` 同步 timer-state、Todo/准点/节日提醒和微信通知。
- 微信桥接只在主窗口启动；`PetWindow` 不再调用 `startNotificationBridge`。

- [ ] **Step 1: 写主窗口桥接失败测试**

使用 mock event API，断言主窗口收到 `confirm-stand-up` 后调用计时确认；Todo 提醒和微信通知都向 pet label 发送最小事件；初始化时 settings 已开启且 capability ready 会启动一次桥接；正文不出现在事件 payload。

- [ ] **Step 2: 运行测试确认 RED**

运行 `pnpm exec vitest run tests/ui/settingsRuntimeBridge.test.tsx tests/domain/notificationBridge.test.ts tests/domain/wechatParser.test.ts`，确认失败原因是主窗口尚未发送事件或仍由宠物窗口启动桥接。

- [ ] **Step 3: 修改 SettingsWindow 的 timer 同步**

在 timer 状态变化时发送 `timer-state`；处理 pet sync request，立即把当前 timer 状态发给 pet；主窗口自己的 timer UI 继续使用本地 state，不将 pet state 反向作为来源。

- [ ] **Step 4: 修改提醒检查和权重选择**

每分钟检查 Todo、准点和节日候选；使用 Todo 权重选择一个候选，更新 `lastRemindedAtMs` 后同时更新本地主窗口提示并发送 `reminder` runtime event。高优先级提醒不会因为 tips 正在隐藏而丢失。

- [ ] **Step 5: 集中启动微信桥接并增强解析**

SettingsWindow 在 `wechatNotificationsEnabled` 且能力为 ready 时启动桥接，关闭时停止；收到 notice 后执行现有新鲜度/去重检查，再发送 `wechat-notice`。Rust 侧读取 Windows toast binding 中的多个短文本元素，只把最可信的短标题投影为 sender；TypeScript 继续丢弃 body。

- [ ] **Step 6: 运行桥接测试确认 GREEN**

运行定向命令，再运行 `pnpm test`，确认 23 个以上测试文件全部通过且没有正文泄漏断言失败。

### Task 7: 生成带 Windows 应用身份的微信通知版

**Files:**
- Modify: `src-tauri/manifest/Package.appxmanifest`
- Create: `scripts/build-notification-package.ps1`
- Create: `docs/qa/windows-notification-package.md`
- Test: `tests/packaging/notificationPackageManifest.test.ts`

**Interfaces:**
- Script input: `src-tauri/target/release/xiaofanqie.exe`。
- Script output: `outputs/小番茄-通知版.msix`、`outputs/小番茄-通知版.cer`、`outputs/小番茄-通知版-安装说明.txt`。
- Package identity: `com.xiaofanqie.desktop`、publisher `CN=XiaoFanQie`、capability `userNotificationListener`。

- [ ] **Step 1: 写清单验证失败测试**

断言 manifest 包含 identity、`userNotificationListener`、四个 Logo 文件引用，并且最终 staging manifest 不含 `$targetnametoken$`。

- [ ] **Step 2: 运行清单测试确认 RED**

运行 `pnpm exec vitest run tests/packaging/notificationPackageManifest.test.ts`，先以最终 staging 文件不存在或仍含 token 的结果失败。

- [ ] **Step 3: 完成 manifest 和打包脚本**

让脚本创建受控的 `work\notification-package\Assets` staging 目录，复制 release EXE 和 Logo 资源，把 manifest 的 executable 替换为 `xiaofanqie.exe`，用 Windows SDK `makeappx.exe pack` 生成 MSIX；用 `New-SelfSignedCertificate` 创建 `CN=XiaoFanQie` 的代码签名证书，用 `signtool.exe sign /fd SHA256` 签名，导出只含公钥的 `.cer`，不把私钥或 PFX 放入 outputs；生成中文安装说明，说明先将 `.cer` 导入“受信任的人”再安装 MSIX。

- [ ] **Step 4: 运行脚本并验证包内容**

先执行 `pnpm tauri build` 生成 release EXE，再执行 `powershell -ExecutionPolicy Bypass -File scripts/build-notification-package.ps1`；使用 `makeappx.exe unpack` 到临时目录检查 manifest、EXE 和 Assets 均存在，并删除临时目录。

- [ ] **Step 5: 运行打包测试确认 GREEN**

运行清单测试，确认 package 产物和安装说明存在；不自动安装、不修改用户 Windows 应用状态。

### Task 8: 版本、构建和交付验证

**Files:**
- Modify: `package.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/manifest/Package.appxmanifest`
- Replace: `outputs/小番茄-便携版.exe`
- Keep: `outputs/小番茄-Todo.csv`

- [ ] **Step 1: 将版本提升到 0.1.5**

同步 package、Cargo、Tauri 和 Appx manifest 版本，确认 Cargo.lock 只修改根包 `xiaofanqie` 的版本。

- [ ] **Step 2: 运行完整前端检查**

依次运行：

```powershell
pnpm test
pnpm exec tsc --noEmit
& 'C:\Users\cxv52\.cargo\bin\cargo.exe' check --manifest-path src-tauri\Cargo.toml
```

- [ ] **Step 3: 构建便携版并生成通知版**

运行：

```powershell
$env:Path = 'C:\Users\cxv52\.cargo\bin;' + $env:Path
pnpm tauri build
Copy-Item -LiteralPath 'src-tauri\target\release\xiaofanqie.exe' -Destination 'outputs\小番茄-便携版.exe' -Force
powershell -ExecutionPolicy Bypass -File scripts/build-notification-package.ps1
```

- [ ] **Step 4: 做最终输出目录核验**

确认 outputs 只包含 `小番茄-便携版.exe`、`小番茄-通知版.msix`、`小番茄-通知版.cer`、`小番茄-通知版-安装说明.txt` 和 `小番茄-Todo.csv`；计算便携版和 MSIX SHA-256，确认构建版本为 0.1.5。

- [ ] **Step 5: 回归验收**

执行一次 fresh `pnpm test`、TypeScript 检查、Cargo check 和 `pnpm tauri build`；确认没有新增 `[DEBUG-...]` 日志、没有正文落盘、没有旧 NSIS 安装包被复制到 outputs，并在最终回复中分别链接便携版、通知版、证书、安装说明和 Todo CSV。
