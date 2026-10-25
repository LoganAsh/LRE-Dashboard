#!/usr/bin/env python3
"""Draws the app icons: the LRE logo in white and grey on the brand orange, over faint contour lines.
   Source artwork: tools/icon-source/logo.png (blue mountains, grey excavator arm, transparent background).
   Run from the repo root:  python3 tools/make-icons.py"""
import math, sys
import numpy as np
from PIL import Image, ImageDraw

ORANGE, RING = (194, 84, 10), (212, 112, 44)
WHITE, GREY = (255, 255, 255), (178, 181, 186)          # mountains, excavator arm

def recolored_logo(path):
    im = Image.open(path).convert('RGBA'); a = np.array(im).astype(float)
    rgb, alpha = a[..., :3], a[..., 3]
    centers = np.array([[44, 110, 231], [165, 166, 165], [255, 255, 255]], float)      # blue, grey, white
    out_colors = np.array([WHITE, GREY, WHITE], float)
    nearest = ((rgb[:, :, None, :] - centers[None, None, :, :]) ** 2).sum(-1).argmin(-1)  # which of the three each pixel is
    out = np.zeros_like(a); out[..., :3] = out_colors[nearest]; out[..., 3] = alpha
    logo = Image.fromarray(out.astype('uint8'), 'RGBA')
    return logo.crop(logo.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox())

def make(size, logo, width_frac, rings=True):
    S = size * 4                                         # draw large, then shrink for smooth edges
    im = Image.new('RGB', (S, S), ORANGE); d = ImageDraw.Draw(im)
    if rings:                                            # the brand's contour lines, kept faint behind the logo
        cx, cy = S * 0.72, S * 0.30
        for i in range(1, 9):
            r = S * 0.075 * i
            pts = [(cx + (r + math.sin(t * 3 + i) * S * 0.008) * math.cos(t), cy + (r * 0.82 + math.cos(t * 2 + i) * S * 0.008) * math.sin(t)) for t in [k * math.pi / 90 for k in range(181)]]
            d.line(pts, fill=RING, width=max(2, S // 200))
    w = int(S * width_frac); h = int(logo.height * w / logo.width)
    big = logo.resize((w, h), Image.LANCZOS)
    im.paste(big, ((S - w) // 2, (S - h) // 2 + int(S * 0.01)), big)
    return im.resize((size, size), Image.LANCZOS)

if __name__ == '__main__':
    logo = recolored_logo('tools/icon-source/logo.png')
    print('logo artwork:', logo.size)
    outs = {'icon-192.png': (192, 0.76), 'icon-512.png': (512, 0.76), 'apple-touch-icon.png': (180, 0.76), 'favicon-32.png': (32, 0.86), 'icon-maskable-512.png': (512, 0.62)}
    for name, (size, frac) in outs.items():
        make(size, logo, frac, rings=size >= 150).save(f'public/icons/{name}'); print('wrote', name)
