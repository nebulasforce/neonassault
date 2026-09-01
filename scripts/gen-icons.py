#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""霓虹突袭 · NEON ASSAULT 全平台图标生成器

从 web/icons/na-512.png（或直接重绘）派生出：
  - PWA      web/icons/na-{192,512}.png、na-maskable-{192,512}.png
  - Electron electron/build/icon.icns、icon.ico、icon.png、icons/<n>x<n>.png
  - Android  android/app/src/main/res/mipmap-*/ic_launcher{,_round,_foreground}.png

依赖：Pillow（pip install pillow）
macOS 的 .icns 由系统自带 iconutil 生成，其他平台跳过。

用法：
    python3 scripts/gen-icons.py            # 只补缺失的
    python3 scripts/gen-icons.py --force    # 全部重生成
    python3 scripts/gen-icons.py --redraw   # 连源图也重绘后派生
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

# ----------------------------------------------------------------------------
# 1. 源图：512×512 霓虹六边形 + NA 字样
# ----------------------------------------------------------------------------
def hex_points(cx, cy, r):
    return [(cx + r * math.cos(math.pi / 3 * i - math.pi / 6),
             cy + r * math.sin(math.pi / 3 * i - math.pi / 6)) for i in range(6)]


def draw_source(size, maskable=False):
    pad = int(size * 0.18) if maskable else int(size * 0.08)
    img = Image.new('RGBA', (size, size), (5, 7, 15, 255))
    d = ImageDraw.Draw(img)

    # 背景网格
    step = max(4, size // 8)
    for i in range(0, size + 1, step):
        d.line((i, 0, i, size), fill=(125, 249, 255, 12), width=1)
        d.line((0, i, size, i), fill=(125, 249, 255, 12), width=1)

    cx = cy = size // 2
    r = (size - pad * 2) // 2

    # 外六边形辉光
    outer = hex_points(cx, cy, r)
    for k in range(6):
        d.polygon(outer, outline=(125, 249, 255, 35 - k * 5))
    d.polygon(outer, outline=(125, 249, 255, 255), width=max(2, size // 64))

    # 内六边形（紫）
    d.polygon(hex_points(cx, cy, r * 0.75),
              outline=(199, 125, 255, 200), width=max(1, size // 96))

    # NA 字样
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
    for off in range(1, 5):
        d.text((x, y), 'NA', font=font, fill=(125, 249, 255, 40 - off * 8))
    d.text((x, y), 'NA', font=font, fill=(255, 255, 255, 240))
    return img


def save(img, path):
    """仅在 --force 或文件缺失时写入"""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if FORCE or not os.path.exists(path):
        img.save(path, optimize=True)
        return True
    return False


# --- 源图 ---
SRC_PATH = os.path.join('web', 'icons', 'na-512.png')
if REDRAW or not os.path.exists(SRC_PATH):
    os.makedirs(os.path.dirname(SRC_PATH), exist_ok=True)
    draw_source(512).save(SRC_PATH, optimize=True)
    print('源图已重绘：' + SRC_PATH)
SRC = Image.open(SRC_PATH).convert('RGBA')

written = 0

# ----------------------------------------------------------------------------
# 2. PWA 图标
# ----------------------------------------------------------------------------
for sz in (192, 512):
    if save(SRC.resize((sz, sz), Image.LANCZOS), f'web/icons/na-{sz}.png'):
        written += 1
    if save(draw_source(sz, maskable=True), f'web/icons/na-maskable-{sz}.png'):
        written += 1

# ----------------------------------------------------------------------------
# 3. Electron 图标
# ----------------------------------------------------------------------------
BUILD = os.path.join('electron', 'build')
os.makedirs(BUILD, exist_ok=True)

# macOS .icns：先拼 .iconset，再用 iconutil
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

# Windows .ico（多尺寸）
ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
if FORCE or not os.path.exists(os.path.join(BUILD, 'icon.ico')):
    imgs = [SRC.resize((s, s), Image.LANCZOS) for s in ICO_SIZES]
    imgs[0].save(os.path.join(BUILD, 'icon.ico'), format='ICO',
                 sizes=[(s, s) for s in ICO_SIZES], append_images=imgs[1:])
    written += 1

# Linux
if save(SRC.resize((512, 512), Image.LANCZOS), os.path.join(BUILD, 'icon.png')):
    written += 1
for s in (16, 32, 48, 64, 128, 256, 512):
    if save(SRC.resize((s, s), Image.LANCZOS), os.path.join(BUILD, 'icons', f'{s}x{s}.png')):
        written += 1

# ----------------------------------------------------------------------------
# 4. Android 启动图标
# ----------------------------------------------------------------------------
RES = os.path.join('android', 'app', 'src', 'main', 'res')
if os.path.isdir(RES):
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

    # 自适应图标前景层：108dp 画布，安全区为中心 66dp（≈0.611）
    for folder, size in {'mipmap-mdpi': 108, 'mipmap-hdpi': 162, 'mipmap-xhdpi': 216,
                         'mipmap-xxhdpi': 324, 'mipmap-xxxhdpi': 432}.items():
        canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        inner = int(size * 0.611)
        logo = SRC.resize((inner, inner), Image.LANCZOS)
        canvas.paste(logo, ((size - inner) // 2, (size - inner) // 2), logo)
        if save(canvas, os.path.join(RES, folder, 'ic_launcher_foreground.png')):
            written += 1

# ----------------------------------------------------------------------------
# 5. 鸿蒙资源图标
# ----------------------------------------------------------------------------
HM = os.path.join('harmonyos', 'entry', 'src', 'main', 'resources', 'base', 'media')
if os.path.isdir(HM):
    size = 192
    if save(Image.new('RGBA', (size, size), (5, 7, 15, 255)), os.path.join(HM, 'background.png')):
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

print(f'图标生成完成，写入 {written} 个文件。')
print('提示：加 --force 强制重生成，加 --redraw 连源图一起重绘。')
