# 小番茄使用说明 / Little Tomato User Guide

这份说明按“第一次使用 → 日常操作 → 同步数据 → 个性化设置”的顺序编排。你可以把它当作软件内的帮助页，也可以直接发给第一次使用小番茄的人。

## 1. 第一次使用

### 下载与启动

1. 打开 [GitHub Release](https://github.com/xuewei1005/Little-Tomato/releases/tag/v2610-A)。
2. 下载 Windows 便携版 EXE。
3. 双击运行即可，不需要安装向导，也不会把个人 Todo 写入 GitHub 仓库。

### 先认识两个入口

- **番茄图标**：显示或隐藏桌面宠物。
- **齿轮图标**：打开设置，语言、昵称、提醒、动画和同步都在这里。

## 2. Todo 怎么用

### 新建任务

点击“记一件事”，输入任务标题并保存。任务可以设置分组、星标、截止日期、时间和重复规则。

### 任务列表

- **待做任务**：还没有完成的任务。
- **已完成任务**：已经完成的任务，视觉层级会弱一些，但仍然可以查看。
- **重要**：集中查看标记星号的任务。
- **自定义分组**：按工作、生活、学习等方式整理任务。

点击任务只负责选中，不会自动弹出设置窗口。对任务点右键，可以：

- 编辑任务
- 移动到其他分组
- 标记或取消星号
- 直接删除任务，不需要二次确认

在分组列表空白处右键可以新建分组；选中已有分组后右键可以删除分组。

## 3. 桌面宠物怎么用

### 显示、隐藏和退出

- 点击左侧番茄图标：显示或隐藏宠物。
- 关闭主窗口：默认隐藏到任务栏状态区域，软件仍在运行。
- 点击状态区域图标并右键：可以显示宠物、关闭宠物、打开设置、设置开机启动或退出软件。
- 对宠物右键：可以开启番茄钟、打开设置、隐藏宠物或退出软件。

### 和宠物互动

- 单击：歪头、眨眼或做一个随机小动作。
- 双击：开心蹦跳。
- 按住拖动：宠物会有弹性跟手的拖动反馈；松开后停在新位置。
- 连续点击：可能触发鼓脸、生气或调皮吐槽。
- 长时间不互动：宠物会安静休息，不会持续打扰你。

宠物的说话会根据互动、任务提醒、番茄钟和休息状态变化；主人昵称和宠物昵称可以在设置中点击修改。

## 4. 番茄钟怎么用

1. 对宠物右键，选择“开启番茄钟”。
2. 在设置中可以使用默认时长，也可以自定义专注和休息时间。
3. 开始后，宠物会拿出一个立体倒计时牌，牌子上只显示剩余时间和暂停/开始图标。
4. 点击牌子上的暂停/开始图标可以控制计时。
5. 倒计时结束时，宠物会撒花庆祝，并提醒你起身活动。
6. 你需要手动确认“我已经站起来了”。如果迟迟不确认，宠物会表现出生气或担心的情绪。

## 5. Tips 和提醒

Tips 会以滚动歌词式的方式出现：当前内容清晰放大，上下内容逐渐虚化。内容覆盖久坐、用眼、睡眠、饮食、工作效率、心理减压、人际关系、财务习惯和生活灵感。

小番茄会优先处理真正需要你行动的提醒：

1. 番茄钟结束与起身确认
2. 有截止时间的 Todo
3. 重复任务到点
4. 普通 Todo 轻提示
5. 随机 tips 和互动台词

Tips 不会遮挡任务，也不会阻止其他动作继续播放。

## 6. 日历与日期

设置截止时间时，可以先选择公历或农历，再从日历中选择具体日期。也可以只设置时间，不设置日期。Todo 列表会显示距离截止日期还有多少天。

## 7. 多语言

打开设置后，在顶部即可看到语言选项：

- 简体中文
- English
- 日本語
- 한국어
- العربية

切换后界面和宠物话语会立即更新。Todo 标题、分组名称、昵称和备注等用户输入内容会原样保留，不会被自动翻译；阿拉伯语会启用从右到左布局。

## 8. Todo 文件同步

同步文件是一个普通 CSV 表格，适合放进 OneDrive、坚果云或其他同步目录。

1. 设置 → Todo 文件同步。
2. 填写完整文件路径。
3. 点击“立即同步”进行手动合并。
4. 打开“自动同步 Todo”，让后续保存自动写入文件。
5. 在另一台电脑设置同一个文件路径，再点击“立即同步”。

同步内容包括任务、完成状态、分组、星标和日期。为了避免冲突，不要让两台电脑同时修改同一个 CSV；建议每次离开一台电脑前先保存并同步。

## 9. 通知说明

当前版本已经移除微信消息通知功能。小番茄不会读取微信、系统状态栏或其他聊天软件的消息；它只负责自己的 Todo、番茄钟、起身提醒和 tips。

## 10. 常见问题

### 关闭窗口后宠物不见了？

主窗口关闭默认只是隐藏到状态区域。右下角状态区域找到小番茄图标，右键可以重新显示宠物或退出软件。

### 为什么任务点击后没有设置弹窗？

这是设计如此：点击只选中任务；编辑、分组和删除统一放在任务右键菜单中。

### 换电脑后 Todo 怎么带走？

把 Todo CSV 放在云同步文件夹，在两台电脑设置同一个完整路径，再分别手动同步一次。

### 为什么 GitHub 上没有 Todo CSV？

Todo CSV 是个人数据，项目仓库会主动忽略它。请把它放在自己的同步文件夹中。

---

## English

### First run

Download the Windows portable EXE from the [GitHub Release](https://github.com/xuewei1005/Little-Tomato/releases/tag/v2610-A) and double-click it. No installer wizard is required.

- The tomato button shows or hides the desktop pet.
- The gear button opens settings.
- Closing the main window hides the app in the system tray area by default.

### Todo

Click **记一件事** to create a task. Click a task to select it. Right-click a task to edit it, move it to a group, toggle its star, or delete it immediately. Right-click empty space in the group list to create a group; right-click a selected group to delete it.

### Desktop pet and Pomodoro

Right-click the pet to start a Pomodoro, open settings, hide the pet, or quit. During a Pomodoro, the pet holds a small 3D countdown board with pause/start controls. When the timer ends, it celebrates with confetti and asks you to confirm that you stood up and moved. If you do not confirm, the pet becomes concerned or upset.

### Tips, languages, and sync

Tips rotate in a lyric-style view and cover health, sleep, psychology, productivity, relationships, finances, and everyday habits. Settings support Simplified Chinese, English, Japanese, Korean, and Arabic with RTL layout for Arabic.

Todo data can be merged through a CSV file stored in OneDrive or another synced folder. Do not edit the same file on two computers at the same time.

The current release does not read WeChat or system chat notifications. Personal Todo data stays local and is not included in the GitHub repository.
