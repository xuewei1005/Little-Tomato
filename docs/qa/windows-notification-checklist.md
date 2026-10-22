# 小番茄 Windows 通知桥接验收清单

## 当前状态

- 能力实现：已加入 `UserNotificationListener` 探针和只投影发件人的轮询桥接。
- 默认状态：关闭；核心番茄钟、Todo 和桌面宠物不依赖微信权限。
- 隐私边界：只读取 Windows 系统通知；不读取微信数据库、聊天窗口、联系人或登录态；消息正文只在系统 API 返回的临时对象中经过，不进入前端事件、设置文件或日志。
- 打包提示：`Package.appxmanifest` 已记录 `userNotificationListener` 能力。普通开发预览或没有应用身份的安装方式应显示“当前不可用”，不能误报为已连接。

## 实机记录

| 项目 | 结果 | 备注 |
| --- | --- | --- |
| Windows 版本 | 待实机填写 |  |
| 微信版本 | 待实机填写 |  |
| 安装方式 | 待实机填写 | MSIX/Appx 需带应用身份与 capability |
| 首次授权 | 待验证 | 只展示权限说明，不保存正文 |
| 发件人提示 | 待验证 | 只显示发件人或“微信有新消息” |
| 关闭后不响应 | 待验证 | 关闭开关后停止轮询 |
| 勿扰时段 | 待验证 | 不弹微信气泡，其他计时继续 |
| 格式变化降级 | 待验证 | 空标题时使用通用提示 |

## 验收命令

```powershell
pnpm exec vitest run tests/domain/wechatParser.test.ts tests/domain/notificationBridge.test.ts tests/ui/notificationSettings.test.tsx
pnpm build
pnpm tauri build
```
