from __future__ import annotations

import math
import os
import random
import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "outputs" / "小番茄-使用演示.mp4"
ICON_PATH = ROOT / "public" / "xiaofanqie-icon.png"
FEATURE_PATH = ROOT / "docs" / "images" / "feature-map.png"
FLOW_PATH = ROOT / "docs" / "images" / "usage-flow.png"

WIDTH, HEIGHT, FPS = 1280, 720, 30
DURATION = 28
FFMPEG = os.environ.get("FFMPEG_PATH") or shutil.which("ffmpeg") or "ffmpeg"
FONT_CN = r"C:\Windows\Fonts\msyh.ttc"
FONT_EN = r"C:\Windows\Fonts\segoeui.ttf"
FONT_EN_BOLD = r"C:\Windows\Fonts\segoeuib.ttf"

BG_TOP = (13, 14, 30)
BG_BOTTOM = (42, 27, 58)
WHITE = (250, 246, 244)
MUTED = (190, 181, 199)
PURPLE = (141, 124, 247)
CORAL = (255, 118, 94)
GREEN = (76, 202, 143)
GOLD = (225, 164, 88)


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def ease(value: float) -> float:
    value = clamp(value)
    return value * value * (3 - 2 * value)


def font(size: int, bold: bool = False, english: bool = False) -> ImageFont.FreeTypeFont:
    path = FONT_EN_BOLD if bold and english else FONT_EN if english else FONT_CN
    return ImageFont.truetype(path, size, index=0)


def text_width(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont) -> int:
    box = draw.textbbox((0, 0), text, font=fnt)
    return box[2] - box[0]


def centered_text(draw: ImageDraw.ImageDraw, text: str, y: int, fnt: ImageFont.FreeTypeFont, fill=WHITE) -> None:
    draw.text(((WIDTH - text_width(draw, text, fnt)) / 2, y), text, font=fnt, fill=fill)


def rounded_panel(frame: Image.Image, box: tuple[int, int, int, int], fill, outline=None, radius: int = 24, shadow=True) -> None:
    x1, y1, x2, y2 = box
    if shadow:
        shadow_layer = Image.new("RGBA", frame.size, (0, 0, 0, 0))
        shadow_draw = ImageDraw.Draw(shadow_layer)
        shadow_draw.rounded_rectangle((x1 + 8, y1 + 10, x2 + 8, y2 + 10), radius=radius, fill=(0, 0, 0, 110))
        shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(12))
        frame.alpha_composite(shadow_layer)
    draw = ImageDraw.Draw(frame)
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=2 if outline else 1)


def gradient_background() -> Image.Image:
    image = Image.new("RGBA", (WIDTH, HEIGHT))
    pixels = image.load()
    for y in range(HEIGHT):
        ratio = y / (HEIGHT - 1)
        color = tuple(int(BG_TOP[i] * (1 - ratio) + BG_BOTTOM[i] * ratio) for i in range(3)) + (255,)
        for x in range(WIDTH):
            pixels[x, y] = color
    return image


BACKGROUND = gradient_background()
ICON = Image.open(ICON_PATH).convert("RGBA")
FEATURE = Image.open(FEATURE_PATH).convert("RGBA")
FLOW = Image.open(FLOW_PATH).convert("RGBA")


def add_orbs(frame: Image.Image, phase: float) -> None:
    layer = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.ellipse((960, -210, 1390, 220), fill=(97, 74, 212, 48))
    draw.ellipse((-230, 520, 190, 940), fill=(255, 105, 95, 35))
    x = int(180 + math.sin(phase) * 35)
    y = int(120 + math.cos(phase * 0.8) * 24)
    draw.ellipse((x, y, x + 12, y + 12), fill=(255, 145, 109, 120))
    frame.alpha_composite(layer)


def paste_icon(frame: Image.Image, center: tuple[int, int], size: int, angle: float = 0.0, alpha: int = 255) -> None:
    icon = ICON.resize((size, size), Image.Resampling.LANCZOS)
    if angle:
        icon = icon.rotate(angle, Image.Resampling.BICUBIC, expand=True)
    if alpha < 255:
        icon.putalpha(icon.getchannel("A").point(lambda value: value * alpha // 255))
    x = center[0] - icon.width // 2
    y = center[1] - icon.height // 2
    frame.alpha_composite(icon, (x, y))


def pet_with_shadow(frame: Image.Image, center: tuple[int, int], size: int, phase: float, angle: float = 0.0) -> None:
    x, y = center
    draw = ImageDraw.Draw(frame)
    shadow_w = int(size * 0.62)
    shadow_h = max(10, int(size * 0.12))
    draw.ellipse((x - shadow_w // 2, y + size // 2 - 8, x + shadow_w // 2, y + size // 2 + shadow_h), fill=(0, 0, 0, 85))
    bob = int(math.sin(phase * 2.4) * size * 0.035)
    scale = int(size * (1 + math.sin(phase * 1.7) * 0.025))
    paste_icon(frame, (x, y + bob), scale, angle=angle)


def cursor(frame: Image.Image, start: tuple[int, int], end: tuple[int, int], progress: float) -> None:
    progress = ease(progress)
    x = int(start[0] + (end[0] - start[0]) * progress)
    y = int(start[1] + (end[1] - start[1]) * progress)
    draw = ImageDraw.Draw(frame)
    points = [(x, y), (x + 5, y + 29), (x + 13, y + 21), (x + 25, y + 38), (x + 31, y + 34), (x + 18, y + 16), (x + 30, y + 14)]
    draw.polygon(points, fill=WHITE, outline=(40, 29, 55))


def pill(frame: Image.Image, box: tuple[int, int, int, int], label: str, fill, text_fill=WHITE, size: int = 16) -> None:
    draw = ImageDraw.Draw(frame)
    draw.rounded_rectangle(box, radius=(box[3] - box[1]) // 2, fill=fill)
    fnt = font(size, bold=True)
    tw = text_width(draw, label, fnt)
    draw.text((box[0] + (box[2] - box[0] - tw) / 2, box[1] + 8), label, font=fnt, fill=text_fill)


def draw_intro(frame: Image.Image, local: float) -> None:
    draw = ImageDraw.Draw(frame)
    reveal = ease(local / 1.0)
    icon_y = 245 + int(math.sin(local * 3) * 7)
    paste_icon(frame, (WIDTH // 2, icon_y), int(150 + 10 * math.sin(local * 2.2)), alpha=int(255 * reveal))
    centered_text(draw, "小番茄 · Little Tomato", 365, font(46, bold=True), WHITE)
    centered_text(draw, "专注 · Todo · 番茄钟 · 温和提醒", 430, font(24), MUTED)
    centered_text(draw, "Focus · Tasks · Rest · Gentle reminders", 466, font(20, english=True), PURPLE)
    chips = [("桌面宠物", CORAL), ("番茄钟", PURPLE), ("Todo", GREEN), ("多语言", GOLD)]
    total = sum(text_width(draw, label, font(17, bold=True)) + 42 for label, _ in chips) + 18 * (len(chips) - 1)
    x = (WIDTH - total) // 2
    for index, (label, color) in enumerate(chips):
        width = text_width(draw, label, font(17, bold=True)) + 42
        pill(frame, (x, 535, x + width, 574), label, (*color, 210))
        x += width + 18


def draw_todo(frame: Image.Image, local: float) -> None:
    draw = ImageDraw.Draw(frame)
    draw.text((72, 58), "01  ·  记一件事", font=font(22, bold=True), fill=CORAL)
    draw.text((72, 95), "Create a task, then let the pet stay beside you.", font=font(18, english=True), fill=MUTED)
    rounded_panel(frame, (54, 150, 790, 655), (34, 30, 41, 245), (80, 70, 87, 255), 28)
    draw.text((94, 184), "TODO", font=font(37, bold=True, english=True), fill=WHITE)
    draw.text((94, 232), "待做任务", font=font(22), fill=MUTED)
    pill(frame, (600, 187, 742, 232), "+ 记一件事", (*CORAL, 235), size=16)
    tasks = [("完成项目介绍", "今天 · ssfg", CORAL), ("整理桌面", "明天 · 工作", PURPLE), ("喝水休息", "无截止时间", GREEN)]
    for index, (title, meta, color) in enumerate(tasks):
        y = 295 + index * 98
        appear = ease(clamp((local - index * 0.38) / 0.7))
        x = int(94 + (1 - appear) * 90)
        rounded_panel(frame, (x, y, x + 620, y + 72), (47, 42, 51, 255), None, 16, shadow=False)
        draw.ellipse((x + 22, y + 22, x + 48, y + 48), outline=(*color, 255), width=3)
        draw.text((x + 70, y + 13), title, font=font(21, bold=True), fill=WHITE)
        draw.text((x + 70, y + 43), meta, font=font(15), fill=MUTED)
        if index == 0:
            draw.text((x + 550, y + 20), "☆", font=font(29), fill=GOLD)
    pet_with_shadow(frame, (1005, 365), 188, local, angle=math.sin(local * 2.2) * 3)
    bubble = (850, 500, 1190, 590)
    rounded_panel(frame, bubble, (49, 38, 67, 240), (114, 91, 190, 255), 22, shadow=False)
    draw.text((882, 523), "嘿，主人！", font=font(24, bold=True), fill=WHITE)
    draw.text((882, 558), "点我或右键试试", font=font(18), fill=PURPLE)
    cursor(frame, (160, 330), (1010, 365), clamp((local - 1.2) / 2.2))
    draw.text((850, 628), "点击 · 拖动 · 右键", font=font(18, bold=True), fill=PURPLE)


def timer_board(frame: Image.Image, local: float) -> None:
    draw = ImageDraw.Draw(frame)
    appear = ease(clamp(local / 0.8))
    x = 704
    y = int(220 + (1 - appear) * 80)
    rounded_panel(frame, (x, y, x + 430, y + 270), (47, 39, 70, 250), (149, 127, 247, 255), 32)
    draw.text((x + 42, y + 34), "番茄钟 / Pomodoro", font=font(22, bold=True), fill=CORAL)
    draw.rounded_rectangle((x + 42, y + 82, x + 388, y + 169), radius=20, fill=(65, 51, 99, 255), outline=(181, 155, 255, 255), width=3)
    remaining = max(0, int(25 * 60 - max(0, local - 1.2)))
    timer = f"{remaining // 60:02d}:{remaining % 60:02d}"
    fnt = font(47, bold=True, english=True)
    draw.text((x + 122, y + 96), timer, font=fnt, fill=WHITE)
    draw.ellipse((x + 172, y + 190, x + 258, y + 276), fill=(255, 118, 94, 240))
    if int(local * 2) % 2:
        draw.polygon([(x + 207, y + 211), (x + 207, y + 255), (x + 240, y + 233)], fill=WHITE)
    else:
        draw.rounded_rectangle((x + 199, y + 213, x + 211, y + 251), radius=4, fill=WHITE)
        draw.rounded_rectangle((x + 222, y + 213, x + 234, y + 251), radius=4, fill=WHITE)
    progress = clamp((local - 0.8) / 4.1)
    draw.rounded_rectangle((x + 42, y + 235, x + 388, y + 245), radius=5, fill=(83, 70, 98, 255))
    draw.rounded_rectangle((x + 42, y + 235, x + 42 + int(346 * progress), y + 245), radius=5, fill=CORAL)


def draw_timer(frame: Image.Image, local: float) -> None:
    draw = ImageDraw.Draw(frame)
    draw.text((72, 58), "02  ·  开始专注", font=font(22, bold=True), fill=PURPLE)
    draw.text((72, 95), "Right-click the pet to start a focused session.", font=font(18, english=True), fill=MUTED)
    pet_with_shadow(frame, (410, 385), 230, local, angle=math.sin(local * 2) * 2)
    draw.text((250, 550), "主人，我们专注一小段吧", font=font(24, bold=True), fill=WHITE)
    draw.text((290, 590), "Focus for a small, comfortable block.", font=font(18, english=True), fill=PURPLE)
    timer_board(frame, local)


def confetti(frame: Image.Image, local: float) -> None:
    draw = ImageDraw.Draw(frame)
    rng = random.Random(22)
    colors = [CORAL, PURPLE, GREEN, GOLD, (255, 191, 102)]
    for index in range(34):
        start_x = 120 + (index * 83) % 1040
        speed = 90 + (index % 5) * 23
        x = int(start_x + math.sin(index * 1.7 + local * 4) * 34)
        y = int(110 + ((local * speed + index * 29) % 460))
        size = 7 + index % 5
        color = colors[index % len(colors)]
        draw.rounded_rectangle((x, y, x + size, y + size * 2), radius=3, fill=color)


def draw_celebrate(frame: Image.Image, local: float) -> None:
    draw = ImageDraw.Draw(frame)
    confetti(frame, local)
    centered_text(draw, "完成啦！撒花！", 74, font(42, bold=True), CORAL)
    centered_text(draw, "Finished · Take a healthy break", 128, font(20, english=True), MUTED)
    pet_with_shadow(frame, (420, 390), 245, local * 1.7, angle=math.sin(local * 5) * 5)
    draw.text((250, 555), "小番茄为你感到骄傲", font=font(26, bold=True), fill=WHITE)
    draw.text((284, 598), "The pet is proud of you.", font=font(18, english=True), fill=PURPLE)
    rounded_panel(frame, (710, 230, 1165, 535), (45, 37, 55, 245), (255, 118, 94, 255), 30)
    draw.text((760, 280), "起身动一动", font=font(32, bold=True), fill=WHITE)
    draw.text((760, 330), "Stand up and move", font=font(19, english=True), fill=MUTED)
    draw.text((760, 390), "完成番茄钟后，手动确认", font=font(20), fill=WHITE)
    draw.text((760, 430), "Confirm after you stand up.", font=font(18, english=True), fill=PURPLE)
    pill(frame, (760, 470, 1060, 520), "我已经站起来了", (*GREEN, 230), size=18)


def draw_sync(frame: Image.Image, local: float) -> None:
    draw = ImageDraw.Draw(frame)
    draw.text((72, 58), "04  ·  同步与语言", font=font(22, bold=True), fill=GREEN)
    draw.text((72, 95), "Keep your tasks close, wherever you work.", font=font(18, english=True), fill=MUTED)
    rounded_panel(frame, (70, 180, 455, 560), (36, 32, 45, 248), (83, 70, 98, 255), 28)
    draw.text((112, 224), "Todo 文件同步", font=font(28, bold=True), fill=WHITE)
    draw.text((112, 266), "CSV file sync", font=font(19, english=True), fill=PURPLE)
    rounded_panel(frame, (112, 330, 410, 420), (55, 45, 66, 255), (141, 124, 247, 255), 18, shadow=False)
    draw.text((142, 350), "小番茄-Todo.csv", font=font(20, bold=True), fill=WHITE)
    draw.text((142, 386), "tasks · groups · stars", font=font(16, english=True), fill=MUTED)
    draw.text((112, 472), "OneDrive / 坚果云", font=font(18), fill=GREEN)
    rounded_panel(frame, (545, 180, 930, 560), (36, 32, 45, 248), (83, 70, 98, 255), 28)
    draw.text((590, 224), "换电脑继续用", font=font(28, bold=True), fill=WHITE)
    draw.text((590, 266), "Continue on another computer", font=font(17, english=True), fill=MUTED)
    draw.rounded_rectangle((650, 345, 825, 465), radius=16, fill=(52, 46, 65, 255), outline=PURPLE, width=3)
    draw.rectangle((672, 370, 803, 438), outline=(190, 181, 199, 255), width=2)
    draw.line((710, 465, 765, 465), fill=PURPLE, width=6)
    draw.line((738, 465, 738, 485), fill=PURPLE, width=6)
    draw.arc((720, 290, 770, 340), 180, 360, fill=GREEN, width=5)
    for step in range(3):
        px = 470 + int((local * 120 + step * 58) % 180)
        draw.ellipse((px, 396, px + 10, 406), fill=GREEN)
    rounded_panel(frame, (1000, 180, 1210, 560), (36, 32, 45, 248), (83, 70, 98, 255), 28)
    draw.text((1030, 224), "语言", font=font(28, bold=True), fill=WHITE)
    draw.text((1030, 266), "Languages", font=font(18, english=True), fill=MUTED)
    labels = [("中文", CORAL), ("EN", PURPLE), ("日本語", GREEN), ("한국어", GOLD), ("العربية", (190, 120, 230))]
    for index, (label, color) in enumerate(labels):
        y = 325 + index * 42
        pill(frame, (1030, y, 1180, y + 31), label, (*color, 220), size=15)


def draw_outro(frame: Image.Image, local: float) -> None:
    draw = ImageDraw.Draw(frame)
    alpha = int(255 * ease(clamp(local / 1.0)))
    paste_icon(frame, (WIDTH // 2, 224), 145, alpha=alpha)
    centered_text(draw, "小番茄 · Little Tomato", 340, font(44, bold=True), WHITE)
    centered_text(draw, "让专注有陪伴，让休息有提醒。", 405, font(25), MUTED)
    centered_text(draw, "A gentle desktop pet for focus, Todo, and healthy breaks.", 445, font(19, english=True), PURPLE)
    pill(frame, (458, 520, 822, 570), "下载便携版 · Download portable build", (*CORAL, 235), size=17)
    draw.text((445, 625), "github.com/xuewei1005/Little-Tomato", font=font(16, english=True), fill=(165, 154, 185))


def render(time: float) -> Image.Image:
    frame = BACKGROUND.copy()
    add_orbs(frame, time * 0.7)
    if time < 3:
        draw_intro(frame, time)
    elif time < 8:
        draw_todo(frame, time - 3)
    elif time < 13:
        draw_timer(frame, time - 8)
    elif time < 18:
        draw_celebrate(frame, time - 13)
    elif time < 23:
        draw_sync(frame, time - 18)
    else:
        draw_outro(frame, time - 23)
    return frame


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    command = [
        FFMPEG,
        "-y",
        "-loglevel",
        "error",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgba",
        "-s",
        f"{WIDTH}x{HEIGHT}",
        "-r",
        str(FPS),
        "-i",
        "-",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        str(OUT),
    ]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    assert process.stdin is not None
    try:
        for index in range(DURATION * FPS):
            frame = render(index / FPS)
            process.stdin.write(frame.tobytes())
    finally:
        process.stdin.close()
    result = process.wait()
    if result != 0:
        raise SystemExit(result)
    print(f"WROTE {OUT}")


if __name__ == "__main__":
    main()
