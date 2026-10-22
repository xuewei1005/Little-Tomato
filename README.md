# 小番茄

一个可以浮在 Windows 桌面上的可爱专注宠物：番茄钟、起身提醒、暖心 tips、Todo 倒数、自定义分组/星标、节日与准点提醒都保存在本地。

## 本地运行

```powershell
pnpm install
pnpm dev
```

## 语言

设置中支持简体中文、English、日本語、한국어和العربية。默认使用简体中文；切换后设置界面和桌面宠物会立即更新。阿拉伯语会启用从右到左布局。Todo 标题、分组名称、昵称和备注等用户输入内容会原样保留，不会被自动翻译。

## 测试与构建

```powershell
pnpm test
pnpm build
pnpm tauri build
```

Windows 发布使用便携版，不需要安装向导。运行下面的命令后，`outputs` 目录只保留：

- `小番茄-安装（v2610-A）.exe`：可直接双击运行的便携版
- `小番茄-Todo.csv`：可在不同电脑之间复制同步的 Todo 数据表

```powershell
pnpm tauri build --no-bundle
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-portable.ps1
```

Tauri 的 `pet` 窗口使用无边框、透明、置顶配置；开发预览中的“打开桌面宠物”会显示内嵌预览。应用只处理本地 Todo、番茄钟和提醒，不读取系统通知或聊天数据。
