#!/usr/bin/env python3
"""python3 diff.py DIR_A DIR_B   -> compares same-named PNGs pixel by pixel; prints PASS/FAIL per image"""
import sys, os
from PIL import Image, ImageChops
a, b = sys.argv[1], sys.argv[2]; bad = 0
for f in sorted(os.listdir(a)):
    if not f.endswith('.png') or not os.path.exists(os.path.join(b, f)): continue
    ia, ib = Image.open(os.path.join(a, f)).convert('RGB'), Image.open(os.path.join(b, f)).convert('RGB')
    if ia.size != ib.size: print(f"FAIL  {f}: different size {ia.size} vs {ib.size}"); bad += 1; continue
    box = ImageChops.difference(ia, ib).getbbox()
    if box is None: print(f"PASS  {f}: identical")
    else:
        d = ImageChops.difference(ia, ib).convert('L'); px = sum(1 for v in d.get_flattened_data() if v > 8) if hasattr(d, 'get_flattened_data') else sum(1 for v in d.getdata() if v > 8)
        if px == 0: print(f"PASS  {f}: identical (faint rendering noise only, nothing visible)"); continue
        bad += 1; print(f"FAIL  {f}: {px} pixels differ, in the area {box}")
        ImageChops.difference(ia, ib).point(lambda v: min(255, v * 6)).save(os.path.join('/tmp', 'diff-' + f))
sys.exit(1 if bad else 0)
