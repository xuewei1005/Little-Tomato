# Windows 微信通知版验收

通知版通过 `scripts/build-notification-package.ps1` 生成，使用 `src-tauri/manifest/Package.appxmanifest` 中的
`com.xiaofanqie.desktop` identity 和 `userNotificationListener` capability。普通便携版仍然可用，
但 Windows 的 `UserNotificationListener` 可能因为没有应用身份而返回 unsupported。

验收顺序：

1. 运行 `pnpm tauri build`，确认 `src-tauri/target/release/xiaofanqie.exe` 存在。
2. 运行 `powershell -ExecutionPolicy Bypass -File scripts/build-notification-package.ps1`。
3. 在 Windows SDK 的 `makeappx.exe` 中解包 `outputs/小番茄-通知版.msix`，确认包含 `xiaofanqie.exe`、`AppxManifest.xml` 和 `Assets` 图标。
4. 确认证书发布者为 `CN=XiaoFanQie`，再按交付目录中的中文说明安装；不在构建脚本中自动安装。
5. 打开软件设置并授权微信通知。宠物收到的运行时事件只能包含 `sender`、`receivedAtMs`、`isGeneric`。

浏览器预览、未签名的普通便携版和没有用户通知权限时，应显示能力不可用或需要授权，而不是误报“已连接”。
