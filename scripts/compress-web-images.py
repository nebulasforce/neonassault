#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""压缩 web/ 贴图：assets → WebP，icons 不透明 PNG 量化。

Boss 768 边长对局内绘制过大，先缩到 512 再编码。
用法：python3 scripts/compress-web-images.py
"""
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'web', 'assets')
ICONS = os.path.join(ROOT, 'web', 'icons')

BOSS = {'titan.png', 'sentinel.png', 'wraith.png'}
BOSS_EDGE = 512
WEBP_Q = 80
UNUSED_ICONS = {'na-cool-orange-1024.png'}


def kb(n):
    return f'{n / 1024:.1f} KB'


def to_webp(src, dst, edge=None):
    im = Image.open(src).convert('RGBA')
    if edge and max(im.size) > edge:
        im = im.resize((edge, edge), Image.LANCZOS)
    im.save(dst, format='WEBP', quality=WEBP_Q, method=6, alpha_quality=85)
    return os.path.getsize(dst)


def to_png8(src):
    im = Image.open(src)
    rgb = im.convert('RGB')
    p = rgb.quantize(colors=256, method=Image.Quantize.MEDIANCUT,
                     dither=Image.Dither.FLOYDSTEINBERG)
    tmp = src + '.tmp'
    p.save(tmp, format='PNG', optimize=True, compress_level=9)
    new = os.path.getsize(tmp)
    old = os.path.getsize(src)
    if new < old * 0.92:
        os.replace(tmp, src)
        return old, new
    os.remove(tmp)
    return old, old


def main():
    os.chdir(ROOT)
    saved = 0

    for name in UNUSED_ICONS:
        path = os.path.join(ICONS, name)
        if os.path.exists(path):
            n = os.path.getsize(path)
            os.remove(path)
            saved += n
            print(f'delete  {name:28s} {kb(n)}')

    for name in sorted(os.listdir(ASSETS)):
        if not name.endswith('.png'):
            continue
        src = os.path.join(ASSETS, name)
        dst = os.path.join(ASSETS, name[:-4] + '.webp')
        old = os.path.getsize(src)
        edge = BOSS_EDGE if name in BOSS else None
        new = to_webp(src, dst, edge)
        os.remove(src)
        saved += old - new
        tag = f'→{edge}' if edge else '    '
        print(f'webp    {name:28s} {kb(old):>10s} → {kb(new):>10s}  {tag}')

    for name in sorted(os.listdir(ICONS)):
        if not name.endswith('.png'):
            continue
        path = os.path.join(ICONS, name)
        old, new = to_png8(path)
        saved += old - new
        if new < old:
            print(f'png8    {name:28s} {kb(old):>10s} → {kb(new):>10s}')
        else:
            print(f'png8    {name:28s} {kb(old):>10s}   (keep)')

    print(f'共节省 {kb(saved)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
