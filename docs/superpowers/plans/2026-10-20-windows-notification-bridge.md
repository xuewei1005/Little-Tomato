# Windows 微信通知桥接 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在「小番茄」核心 MVP 之上增加一个明确授权、只展示发件人、不保存聊天正文的 Windows 系统通知桥接，并把微信通知转换成小番茄的轻量提示。

**Architecture:** 使用 Windows `UserNotificationListener` 能力读取系统通知，Rust bridge 负责权限状态、来源过滤和最小字段投影，TypeScript 负责纯函数解析与 UI 状态。原始通知只在一次事件处理期间存在于内存中，桥接层输出 `WechatNotice` 后立即丢弃原文；能力不可用时必须清晰降级，不尝试抓取微信窗口或数据库。

**Tech Stack:** Tauri 2、Rust stable、`windows` crate（`UI_Notifications_Management` 等 Windows Runtime API）、React/TypeScript、Vitest、Windows MSIX/Appx manifest capability。

**Spec:** `docs/superpowers/specs/2026-10-20-desktop-pet-focus-design.md`

## Global Constraints

- 只监听 Windows 系统通知，不读取微信数据库、聊天窗口、账号登录态或联系人列表。
- 默认只输出 `sender`；不得输出、记录或持久化消息正文。
- 首次启用必须展示权限说明和关闭入口；用户关闭后不再启动监听。
- 只接受 WeChat/微信来源标识；来源不确定时丢弃，不把其他应用误报成微信。
- 无权限、系统不支持、微信通知格式变化都必须能回退到“当前不可用”或通用“微信有新消息”。
- 核心番茄钟、提醒和设置在桥接失败时必须继续工作。
- 不把 Windows 通知原文写入日志、崩溃报告、设置文件或测试快照。
- 当前工作区不是 Git 仓库；以自动化测试、构建和人工授权检查作为检查点。

## 文件地图

- `src-tauri/src/notification_bridge.rs`：Windows Runtime listener、权限状态和来源过滤。
- `src-tauri/src/main.rs`：注册桥接命令和事件转发。
- `src-tauri/Cargo.toml`：Windows API feature 依赖。
- `src/domain/wechatParser.ts`：纯函数的发件人解析与正文丢弃。
- `src/domain/notificationBridge.ts`：前端能力状态和事件类型。
- `src/ui/settings/NotificationSettings.tsx`：权限说明、连接状态和开关。
- `src/ui/pet/PetWindow.tsx`：消费 `wechat-notice` 并显示 message 状态。
- `tests/domain/wechatParser.test.ts`：通知格式 fixture 和隐私断言。
- `tests/domain/notificationBridge.test.ts`：能力状态转换和去重。
- `tests/ui/notificationSettings.test.tsx`：授权 UI 和关闭行为。
- `src-tauri/capabilities/default.json`：最小 Tauri 权限。
- `src-tauri/manifest/Package.appxmanifest`：MSIX identity 和 `userNotificationListener` capability。
- `docs/qa/windows-notification-checklist.md`：实际 Windows/微信版本验收记录。

---

### Task 1: 完成通知桥接可行性探针

**Files:**
- Create: `src-tauri/src/notification_bridge.rs`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/main.rs`
- Create: `tests/domain/wechatParser.test.ts`
- Create: `docs/qa/windows-notification-checklist.md`

**Interfaces:**
- Rust command `get_notification_capability() -> NotificationCapabilityStatus`
- Rust command `request_notification_access() -> NotificationCapabilityStatus`
- TypeScript `parseWechatSender(input: NotificationPayload): string | null`

- [ ] **Step 1: 写纯函数隐私测试**

使用固定 fixture 测试标题为发件人、正文包含聊天内容的通知，断言返回只包含发件人：

```ts
it('drops the WeChat message body', () => {
  const result = parseWechatSender({
    appId: 'WeChat',
    title: '阿宁',
    body: '明天会议改到十点，可以吗？'
  });
  expect(result).toBe('阿宁');
  expect(JSON.stringify(result)).not.toContain('会议');
});
```

- [ ] **Step 2: 添加 Windows API 依赖**

在 `Cargo.toml` 添加 `windows` crate，并只启用通知管理、通知数据和 XML/应用身份所需的 feature。不要添加网络、文件扫描或进程注入依赖。

- [ ] **Step 3: 实现能力探针**

实现 `NotificationCapabilityStatus`：`unsupported`、`needsPermission`、`ready`、`disabled`、`error`。探针只检查当前应用是否具备 listener 能力和授权状态，不在调用 `get_notification_capability` 时读取通知内容。

- [ ] **Step 4: 运行探针和解析测试**

```powershell
pnpm test -- tests/domain/wechatParser.test.ts
cargo check --manifest-path src-tauri/Cargo.toml
```

在不支持或没有打包 identity 的开发模式下，预期状态为 `unsupported` 或 `needsPermission`，而不是崩溃。

### Task 2: 实现来源过滤、权限和最小字段投影

**Files:**
- Modify: `src-tauri/src/notification_bridge.rs`
- Create: `src/domain/notificationBridge.ts`
- Create: `tests/domain/notificationBridge.test.ts`
- Modify: `src-tauri/src/main.rs`

**Interfaces:**
- `NotificationCapabilityStatus`：`{ state: 'unsupported' | 'needsPermission' | 'ready' | 'disabled' | 'error'; message?: string }`
- `WechatNotice`：`{ sender: string | null; receivedAtMs: number; isGeneric: boolean }`
- `startNotificationBridge(): Promise<NotificationCapabilityStatus>`
- `stopNotificationBridge(): Promise<void>`
- `subscribeToWechatNotice(handler: (notice: WechatNotice) => void): Unsubscribe`

- [ ] **Step 1: 写来源过滤和去重测试**

覆盖微信英文/中文来源标识、其他应用来源、同一通知重复投递、空标题和正文只有内容的场景。断言其他应用被丢弃，重复通知在短时间窗口内只产生一次。

- [ ] **Step 2: 实现来源过滤**

只接受经过明确映射的 WeChat app identity 或显示名。先提取标题作为潜在发件人；正文永远不进入 `WechatNotice`。无法确定标题是否为发件人时返回 `{ sender: null, isGeneric: true }`，不猜测正文。

- [ ] **Step 3: 实现启动/停止生命周期**

桥接启动时读取设置中的开关和勿扰策略；停止时取消 listener subscription、清理 handler 和临时字符串。重复启动必须幂等，关闭后必须不再订阅。

- [ ] **Step 4: 将 Rust 事件投影为前端事件**

Rust 事件只传递 `sender`、`receivedAtMs` 和 `isGeneric`；禁止通过 Tauri event 发送原始 toast XML、正文或通知 ID。前端收到后交给 runtime controller 生成 `wechat_notice`，沿用现有 `PetStateMachine` 的 message 状态。

- [ ] **Step 5: 运行测试**

```powershell
pnpm test -- tests/domain/wechatParser.test.ts tests/domain/notificationBridge.test.ts
cargo test --manifest-path src-tauri/Cargo.toml
```

### Task 3: 添加 Windows 打包 identity 和授权 UI

**Files:**
- Create: `src-tauri/manifest/Package.appxmanifest`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/capabilities/default.json`
- Create: `src/ui/settings/NotificationSettings.tsx`
- Create: `tests/ui/notificationSettings.test.tsx`
- Modify: `src/ui/settings/SettingsWindow.tsx`

**Interfaces:**
- `NotificationSettings` props：`status: NotificationCapabilityStatus; enabled: boolean; onToggle(enabled: boolean): void; onRequestAccess(): void`
- 设置页只显示桥接状态和开关，不显示或复制通知正文。

- [ ] **Step 1: 写授权 UI 失败测试**

断言 `needsPermission` 显示权限说明和“允许读取系统通知”按钮，`ready` 显示已连接和关闭按钮，`unsupported` 显示当前系统/打包方式不支持，点击关闭调用 `onToggle(false)`。

- [ ] **Step 2: 配置最小 capability**

为 MSIX/Appx manifest 加入 `userNotificationListener` 能力和应用 identity；Tauri capability 只开放本应用需要的命令/event。权限文案明确说明：只读取系统通知中的发件人，不保存消息正文。

- [ ] **Step 3: 实现设置页开关**

关闭开关先调用 `stopNotificationBridge`，成功后再保存设置；开启开关先请求权限，只有状态为 `ready` 才保存 `enabled: true`。失败时保留开关关闭，并显示原因。

- [ ] **Step 4: 运行 UI 测试和前端构建**

```powershell
pnpm test -- tests/ui/notificationSettings.test.tsx
pnpm build
```

### Task 4: 接入小番茄消息提示和勿扰策略

**Files:**
- Modify: `src/app/runtimeController.ts`
- Modify: `src/ui/pet/PetWindow.tsx`
- Modify: `src/ui/settings/SettingsWindow.tsx`
- Modify: `tests/app/runtimeController.test.ts`

**Interfaces:**
- Runtime event `wechat_notice` payload：`{ sender: string | null; receivedAtMs: number; isGeneric: boolean }`
- 气泡文案：有 sender 时使用“{称呼}，{sender}找你啦”；无 sender 时使用“{称呼}，微信有新消息”。

- [ ] **Step 1: 写消息提示编排失败测试**

覆盖启用桥接时生成 message 状态、禁用桥接时忽略事件、勿扰时段静默、没有称呼时不产生多余前缀、重复通知不重复气泡。

- [ ] **Step 2: 接入 runtime controller**

将 `WechatNotice` 转为 `wechat_notice` 事件，复用已有 `PetBubble` 和 `PetStateMachine`；消息提示结束后回到 focus/idle，不改变番茄钟 phase。

- [ ] **Step 3: 增加用户可见的连接状态**

在设置页显示最后一次能力状态，不显示最后一条通知内容；桥接不可用不影响其他设置和计时器。

- [ ] **Step 4: 运行测试**

```powershell
pnpm test -- tests/app/runtimeController.test.ts
```

### Task 5: Windows 实机验收与隐私回归

**Files:**
- Modify: `docs/qa/windows-notification-checklist.md`
- Modify: `README.md`

**Interfaces:**
- `pnpm tauri build` 生成带 identity 的 Windows 安装包。
- 清单记录系统版本、微信版本、安装方式和 capability 状态，不记录聊天内容。

- [ ] **Step 1: 构建并安装 MSIX/Windows 安装包**

运行：

```powershell
pnpm tauri build
```

安装构建产物，首次启动进入设置页，确认状态从 `needsPermission` 变为 `ready` 的路径存在；开发模式不把 `unsupported` 误报成已连接。

- [ ] **Step 2: 验证实际微信通知**

在微信中让测试联系人发送一条消息，确认小番茄只显示发件人或通用提示；检查开发者日志、设置文件和临时目录均没有正文或原始 XML。

- [ ] **Step 3: 验证关闭和勿扰**

关闭微信监听后再次发送消息，小番茄不响应；在勿扰时段发送消息，小番茄不显示气泡；番茄钟和准点提醒继续工作。

- [ ] **Step 4: 验证异常降级**

撤销通知权限、使用不支持的系统/打包方式、改变微信通知格式，确认应用显示明确状态且不崩溃、不读取微信窗口、不影响核心功能。

- [ ] **Step 5: 运行最终检查**

```powershell
pnpm test
pnpm build
pnpm tauri build
```

只有自动化测试、安装包构建和 Windows 实机清单都通过，才将通知桥接标记为完成。
