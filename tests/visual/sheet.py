#!/usr/bin/env python3
"""python3 sheet.py OUT.png label=path label=path ...   -> screenshots side by side with captions"""
import sys
from PIL import Image, ImageDraw, ImageFont
out, items = sys.argv[1], [a.split('=', 1) for a in sys.argv[2:]]
H = 1000; gap = 18; pad = 14; cap = 34
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 20)
except Exception: font = ImageFont.load_default()
ims = []
for label, path in items:
    im = Image.open(path).convert('RGB'); w, h = im.size; im = im.resize((max(1, int(w * H / h)), H), Image.LANCZOS); ims.append((label, im))
W = sum(i.size[0] for _, i in ims) + gap * (len(ims) - 1) + pad * 2
sheet = Image.new('RGB', (W, H + cap + pad * 2), (60, 60, 64)); d = ImageDraw.Draw(sheet); x = pad
for label, im in ims:
    d.text((x, pad), label, fill=(255, 255, 255), font=font); sheet.paste(im, (x, pad + cap)); x += im.size[0] + gap
sheet.save(out); print(out, sheet.size)
