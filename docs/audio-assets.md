# 小番茄音效资源 / Little Tomato Audio Assets

- `todo-complete.mp3`: [Soft Bell Ding](https://pixabay.com/sound-effects/technology-soft-bell-ding-485895/) by Universfield, Pixabay Content License.

番茄钟开始和结束音效均为本地资源，软件运行时不需要联网下载。

## 开始音效

- 文件：`public/sounds/timer-start.mp3`
- 来源：[Level Up 06 by Universfield](https://pixabay.com/sound-effects/film-special-effects-level-up-06-370051/)
- 用途：番茄钟开始或进入下一段计时
- 处理：保留原音，重新编码为项目内 MP3

## 结束音效

- 文件：`public/sounds/timer-complete.mp3`
- 来源：[1gift-confetti by u_jspnqv1glx](https://pixabay.com/sound-effects/people-1gift-confetti-447240/)
- 用途：番茄钟结束、宠物撒花时播放
- 处理：移除开头短促音段，仅保留后面的彩纸声，补偿约 10 dB 音量，并加入极短淡入淡出

两个来源页面均标注可依据 Pixabay Content License 使用。软件默认使用设置中的声音开关控制播放。
