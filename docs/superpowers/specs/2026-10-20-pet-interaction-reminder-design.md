# 小番茄宠物互动与提醒升级设计

## 目标

把小番茄从“会显示消息的透明浮窗”升级为一个有明确反馈闭环的桌面宠物：番茄钟开始时拿出立体倒计时牌，完成后撒花庆祝并要求用户确认起身；宠物点击、拖动和选择都有可感知的动作反馈；tips 只短暂出现；Todo、准点提醒和微信通知按照优先级可靠地到达宠物窗口。

## 当前问题证据

1. `PetWindow` 固定把 `focusPhase` 设为 `idle`、`hasReminder` 设为 `false`，因此主窗口的番茄钟和 Todo 状态没有进入桌面宠物。
2. `PetWindow` 把 `tip` 作为没有微信通知时的永久气泡内容，导致 tips 一直展示。
3. 当前 Todo 无截止时间策略为 24 小时一次，且没有首个较短的提醒窗口；新记录在短时间内看不到提醒是预期结果。
4. 当前提醒检查只在 `SettingsWindow` 内设置本地 `reminderMessage`，没有发送给宠物窗口的统一运行时事件。
5. 微信桥接使用 Windows `UserNotificationListener`。该 API 需要 `userNotificationListener` capability 和用户授权；当前 NSIS/便携 EXE 没有 Windows package identity，因此可能返回 unsupported。可靠读取微信系统通知的版本必须使用带 identity 的 MSIX/Appx 包。参考：[Notification listener](https://learn.microsoft.com/en-us/windows/apps/develop/notifications/app-notifications/notification-listener)、[Packaged desktop app identity](https://learn.microsoft.com/en-us/windows/apps/desktop/modernize/modernize-packaged-apps)。
6. 宠物左键按下时父容器直接调用原生拖动，未来增加牌子按钮后会与按钮交互冲突；拖动区域、可点击区域和拖动反馈需要明确分层。

## 交互设计

### 1. 立体倒计时牌

新增 `PetTimerBoard`，由宠物窗口根据 `FocusTimerState` 显示：

- `running`：显示 `mm:ss` 和暂停图标。
- `paused`：显示当前 `mm:ss` 和开始图标。
- `awaitingStandUp`：显示起身确认图标，不显示文字。
- `idle`：隐藏牌子。

牌子本身不显示“专注中”“暂停”等文字，只保留倒计时和图标；可访问性名称通过 `aria-label` 提供。开始计时后，牌子从宠物身后滑出/翻出，宠物手臂从身体两侧出现并托住牌子。牌子使用多层渐变、内阴影、投影、高光、边缘厚度和轻微悬浮动画，保持当前 CSS 2.5D 资产方案，不引入网络素材或重型动画运行时。

牌子上的暂停/开始按钮发送 `pet-command` 到主窗口；主窗口仍是计时器唯一状态源，宠物只显示状态并请求动作。

### 2. 完成与起身确认闭环

番茄钟工作阶段归零时：

1. `FocusTimer` 将状态切换为 `phase: 'standUp'`、`status: 'awaitingStandUp'`，记录待进入的短休息/长休息阶段和起身请求时间；计时不会自行跳过确认。
2. 宠物进入庆祝状态，播放一次弹跳、叶子摆动和花瓣/星星撒花效果；撒花只存在有限时长，结束后进入起身提醒状态。
3. 气泡提示“起来动一动吧，确认后我再继续陪你”；牌子只显示确认图标，点击后调用 `confirmStandUp`。
4. 确认后进入待进入的短休息或长休息计时，并播放短暂的松弛/点头动作。
5. 超过宽限时间仍未确认时，宠物进入 `angry` 状态（皱眉、跺脚、红色小情绪线），并以受控间隔重复提醒；确认后立即恢复，不累计重复提示。

`FocusTimerStatus` 增加 `awaitingStandUp`；`FocusTimerState` 增加 `pendingBreakPhase` 和 `standUpRequestedAtMs`，从而让“必须手动确认”成为可测试的业务状态，而不是只做视觉效果。

### 3. 点击、拖动与选择反馈

- 普通点击宠物本体从 `happy`、`wave`、`wink`、`thinking`、`celebrate` 等动作中随机选一个，并显示 2～4 秒的短回应。
- 鼠标按下时设置 `pressed/selected` 视觉状态：宠物略微下沉、阴影收紧、叶片和高光有轻微响应。
- 拖动开始后设置 `dragging` 状态：宠物略放大、阴影偏移、牌子轻晃；松开时使用短回弹动画。
- 点击牌子按钮、确认图标和其它交互控件时不启动窗口拖动。
- 拖动事件只保留一个入口：左键、非交互子元素、明确的 `preventDefault` 和 Tauri `startDragging`；不再让多个父子节点重复抢夺指针事件。点击动作在确认没有实际拖动后触发，避免拖动结束误触发随机动作。

### 4. tips 与提醒优先级

新增统一的 `PetRuntimeEvent` 和提醒仲裁规则。优先级固定为：

1. 微信通知
2. 番茄钟完成、起身确认和休息状态
3. 已到期/即将到期的 Todo
4. 准点提醒和节日提醒
5. 用户点击回应
6. tips
7. 普通待机动作

高优先级事件暂时压住低优先级气泡，但不会丢弃 Todo 的下一次提醒计算。tips 默认隐藏；启动后可短暂展示一次，之后使用随机间隔展示约 6～10 秒。提醒气泡有明确的过期时间，过期后恢复无气泡待机，而不是继续显示旧文案。

Todo 提醒策略调整为：无截止时间的记录首次在较短的随机窗口后可提醒，之后低频提醒；距离截止越近，间隔越短；当天和过期项目优先级最高；星标项目在同等紧急度下提高权重；完成、暂停和勿扰时段不产生提醒。

### 5. 微信通知运行方式

主窗口负责通知桥接的启动、停止、权限状态和去重；宠物窗口只消费最小化的 `WechatNotice` 事件。这样不会因为主窗口和宠物窗口各自启动轮询而互相重置状态。

通知事件只包含 `sender`、`receivedAtMs` 和 `isGeneric`，不传递正文、XML、通知 ID 或聊天历史。便携版显示明确的能力状态；带 identity 的通知版使用已有 `Package.appxmanifest` 和 `userNotificationListener` capability，并生成签名 MSIX 及安装所需证书。

## 运行时接口

```ts
type PetCommand =
  | 'start-timer'
  | 'pause-timer'
  | 'resume-timer'
  | 'confirm-stand-up'
  | 'add-todo';

type PetRuntimeEvent =
  | { type: 'timer-state'; state: FocusTimerState; atMs: number }
  | { type: 'wechat-notice'; notice: WechatNotice }
  | { type: 'reminder'; message: string; priority: PetReminderPriority; atMs: number }
  | { type: 'tip'; message: string; atMs: number };
```

主窗口通过 Tauri event 将 `PetRuntimeEvent` 发送到 `pet` 窗口；宠物窗口挂载时发送同步请求，主窗口回传当前计时状态，避免宠物晚于主窗口打开时停留在 idle。

## 测试与验收

- 纯逻辑测试覆盖起身等待、确认后进入休息、未确认进入生气、牌子运行/暂停/确认图标状态和提醒优先级。
- UI 测试覆盖牌子按钮不触发拖动、点击触发随机动作、tips 自动隐藏、提醒事件替换 tips、撒花节点在庆祝状态出现。
- 通知测试覆盖主窗口单实例桥接、去重、权限不可用时降级以及不传播正文。
- 运行 `pnpm test`、`pnpm exec tsc --noEmit`、Cargo 检查和 Tauri 构建。
- 交付两个 Windows 版本：继续提供便携版 EXE；额外提供带应用身份的通知版 MSIX、签名证书和安装说明。Todo CSV 继续保持单独同步文件。
