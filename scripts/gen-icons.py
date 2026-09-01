#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""霓虹突袭 · NEON ASSAULT 全平台图标生成器

源图固定为 web/icons/na-cool-1024.png，不会覆盖它。
派生：
  - PWA      na-{192,512}.png、na-maskable-{192,512}.png
  - Electron electron/build/icon.icns、icon.ico、icon.png、icons/<n>x<n>.png
  - Android  mipmap-*/ic_launcher{,_round,_foreground}.png
  - 鸿蒙     app_icon / startIcon / foreground / background

依赖：Pillow（pip install pillow）
macOS 的 .icns 由系统自带 iconutil 生成，其他平台跳过。

用法：
    python3 scripts/gen-icons.py            # 只补缺失的
    python3 scripts/gen-icons.py --force    # 全部重生成（仍不覆盖源图）
    python3 scripts/gen-icons.py --redraw   # 忽略源图，重绘几何 NA 后再派生
"""
import math
import os
import shutil
import subprocess
import sys

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit('需要 Pillow：pip install pillow')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

FORCE = '--force' in sys.argv
REDRAW = '--redraw' in sys.argv

BG = (10, 12, 16, 255)
SRC_MASTER = os.path.join('web', 'icons', 'na-cool-1024.png')
PWA_SIZES = (192, 512)


def hex_points(cx, cy, r):
    return [(cx + r * math.cos(math.pi / 3 * i - math.pi / 6),
             cy + r * math.sin(math.pi / 3 * i - math.pi / 6)) for i in range(6)]


def draw_source(size, maskable=False):
    pad = int(size * 0.18) if maskable else int(size * 0.08)
    img = Image.new('RGBA', (size, size), (5, 7, 15, 255))
    d = ImageDraw.Draw(img)

    step = max(4, size // 8)
    for i in range(0, size + 1, step):
        d.line((i, 0, i, size), fill=(125, 249, 255, 12), width=1)
        d.line((0, i, size, i), fill=(125, 249, 255, 12), width=1)

    cx = cy = size // 2
    r = (size - pad * 2) // 2
    outer = hex_points(cx, cy, r)
    d.polygon(outer, outline=(125, 249, 255, 255), width=max(2, size // 64))
    d.polygon(hex_points(cx, cy, r * 0.75),
              outline=(199, 125, 255, 200), width=max(1, size // 96))

    font_size = int(r * 0.65)
    font = None
    for fp in ('/System/Library/Fonts/Helvetica.ttc',
               '/System/Library/Fonts/PingFang.ttc',
               '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'):
        if os.path.exists(fp):
            try:
                font = ImageFont.truetype(fp, font_size)
                break
            except Exception:
                continue
    if font is None:
        font = ImageFont.load_default()

    bbox = d.textbbox((0, 0), 'NA', font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = cx - tw / 2 - bbox[0]
    y = cy - th / 2 - bbox[1]
    d.text((x, y), 'NA', font=font, fill=(255, 255, 255, 240))
    return img


def save(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if FORCE or not os.path.exists(path):
        img.save(path, optimize=True)
        return True
    return False


def make_padded(src, size, pad_ratio=0.18, bg=BG):
    canvas = Image.new('RGBA', (size, size), bg)
    inner = max(1, int(size * (1 - pad_ratio * 2)))
    logo = src.resize((inner, inner), Image.LANCZOS)
    canvas.paste(logo, ((size - inner) // 2, (size - inner) // 2), logo)
    return canvas


def as_square(img, bg=BG):
    w, h = img.size
    if w == h:
        return img
    side = max(w, h)
    canvas = Image.new('RGBA', (side, side), bg)
    canvas.paste(img, ((side - w) // 2, (side - h) // 2), img)
    return canvas


def sample_bg(img):
    px = img.load()
    w, h = img.size
    pts = [(2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3)]
    r = g = b = 0
    for x, y in pts:
        c = px[x, y]
        r += c[0]
        g += c[1]
        b += c[2]
    n = len(pts)
    return (r // n, g // n, b // n, 255)


def load_lockup():
    if REDRAW:
        img = draw_source(1024)
        print('源图已按几何 NA 重绘（--redraw）')
        return img
    if os.path.exists(SRC_MASTER):
        print('源图：' + SRC_MASTER)
        return as_square(Image.open(SRC_MASTER).convert('RGBA'))
    sys.exit('未找到源图 ' + SRC_MASTER)


SRC = load_lockup()
BG = sample_bg(SRC)

written = 0

# PWA：从 1024 源图派生标准尺寸与 maskable（给圆裁切留边）。
# na-cool-1024.png 是用户源图，不覆盖。
for sz in PWA_SIZES:
    if save(SRC.resize((sz, sz), Image.LANCZOS), f'web/icons/na-{sz}.png'):
        written += 1
    if save(make_padded(SRC, sz, 0.12, BG), f'web/icons/na-maskable-{sz}.png'):
        written += 1

# Electron
BUILD = os.path.join('electron', 'build')
os.makedirs(BUILD, exist_ok=True)

ICONSET = os.path.join(BUILD, 'icon.iconset')
if FORCE or not os.path.exists(os.path.join(BUILD, 'icon.icns')):
    shutil.rmtree(ICONSET, ignore_errors=True)
    os.makedirs(ICONSET, exist_ok=True)
    for name, size in [
        ('icon_16x16.png', 16), ('icon_16x16@2x.png', 32),
        ('icon_32x32.png', 32), ('icon_32x32@2x.png', 64),
        ('icon_128x128.png', 128), ('icon_128x128@2x.png', 256),
        ('icon_256x256.png', 256), ('icon_256x256@2x.png', 512),
        ('icon_512x512.png', 512), ('icon_512x512@2x.png', 1024),
    ]:
        SRC.resize((size, size), Image.LANCZOS).save(os.path.join(ICONSET, name))
    if shutil.which('iconutil'):
        subprocess.run(['iconutil', '-c', 'icns', ICONSET,
                        '-o', os.path.join(BUILD, 'icon.icns')], check=True)
        written += 1
    else:
        print('未找到 iconutil（仅 macOS 可用），跳过 .icns')
    shutil.rmtree(ICONSET, ignore_errors=True)

ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
if FORCE or not os.path.exists(os.path.join(BUILD, 'icon.ico')):
    imgs = [SRC.resize((s, s), Image.LANCZOS) for s in ICO_SIZES]
    imgs[0].save(os.path.join(BUILD, 'icon.ico'), format='ICO',
                 sizes=[(s, s) for s in ICO_SIZES], append_images=imgs[1:])
    written += 1

if save(SRC.resize((1024, 1024), Image.LANCZOS), os.path.join(BUILD, 'icon.png')):
    written += 1
for s in (16, 32, 48, 64, 128, 256, 512, 1024):
    if save(SRC.resize((s, s), Image.LANCZOS), os.path.join(BUILD, 'icons', f'{s}x{s}.png')):
        written += 1

# Android
RES = os.path.join('android', 'app', 'src', 'main', 'res')
if os.path.isdir(RES):
    bg_xml = os.path.join(RES, 'values', 'ic_launcher_background.xml')
    os.makedirs(os.path.dirname(bg_xml), exist_ok=True)
    if FORCE or not os.path.exists(bg_xml):
        hex_color = '#{:02X}{:02X}{:02X}'.format(*BG[:3])
        with open(bg_xml, 'w', encoding='utf-8') as f:
            f.write('<?xml version="1.0" encoding="utf-8"?>\n'
                    '<resources>\n'
                    f'    <color name="ic_launcher_background">{hex_color}</color>\n'
                    '</resources>\n')
        written += 1

    def make_round(img):
        size = img.size[0]
        mask = Image.new('L', (size, size), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
        out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        out.paste(img, (0, 0), mask)
        return out

    for folder, size in {'mipmap-mdpi': 48, 'mipmap-hdpi': 72, 'mipmap-xhdpi': 96,
                         'mipmap-xxhdpi': 144, 'mipmap-xxxhdpi': 192}.items():
        sq = SRC.resize((size, size), Image.LANCZOS)
        if save(sq, os.path.join(RES, folder, 'ic_launcher.png')):
            written += 1
        if save(make_round(sq), os.path.join(RES, folder, 'ic_launcher_round.png')):
            written += 1

    for folder, size in {'mipmap-mdpi': 108, 'mipmap-hdpi': 162, 'mipmap-xhdpi': 216,
                         'mipmap-xxhdpi': 324, 'mipmap-xxxhdpi': 432}.items():
        canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        inner = int(size * 0.611)
        logo = SRC.resize((inner, inner), Image.LANCZOS)
        canvas.paste(logo, ((size - inner) // 2, (size - inner) // 2), logo)
        if save(canvas, os.path.join(RES, folder, 'ic_launcher_foreground.png')):
            written += 1

# HarmonyOS
HM = os.path.join('harmonyos', 'entry', 'src', 'main', 'resources', 'base', 'media')
if os.path.isdir(HM):
    size = 192
    if save(Image.new('RGBA', (size, size), BG), os.path.join(HM, 'background.png')):
        written += 1
    fg = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    inner = int(size * 0.72)
    logo = SRC.resize((inner, inner), Image.LANCZOS)
    fg.paste(logo, ((size - inner) // 2, (size - inner) // 2), logo)
    if save(fg, os.path.join(HM, 'foreground.png')):
        written += 1
    if save(SRC.resize((size, size), Image.LANCZOS), os.path.join(HM, 'startIcon.png')):
        written += 1
    if save(SRC.resize((512, 512), Image.LANCZOS), os.path.join(HM, 'app_icon.png')):
        written += 1

print(f'图标生成完成，写入 {written} 个文件。源图 {SRC_MASTER} 未改动。')
print('提示：加 --force 强制重生成，加 --redraw 忽略源图重绘几何 NA。')
