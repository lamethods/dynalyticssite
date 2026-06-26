#!/usr/bin/env python3
"""Slim self-contained tutorial HTML by shrinking embedded base64 images.

These Quarto exports inline their plots as base64 PNGs rendered at retina/high
DPI — often 4-7 MB each — which is ~90%+ of the file. This downscales each
embedded raster to a sane on-screen width and re-compresses it losslessly, in
place. No re-render, no toolchain, no loss of interactivity (there is none).

Usage:
    python3 build/optimize_tutorial.py [PATH ...] [--max-width N]

PATH may be an .html file or a directory (recursed for *.html). Defaults to the
tutorials/ folder. Idempotent: already-small images are left untouched.
"""
import sys, os, re, io, base64, glob
from PIL import Image

MAX_WIDTH = 1600
QUANTIZE = False   # --quantize: 256-colour palette (≈2× smaller PNGs, slight banding risk on smooth gradients)
Image.MAX_IMAGE_PIXELS = None   # these plots are legitimately huge; not a decompression bomb
DATA_URI = re.compile(rb'data:image/(png|jpeg|jpg);base64,([A-Za-z0-9+/=]+)')


def shrink_one(fmt: bytes, b64: bytes) -> bytes:
    """Return a replacement data-URI (same bytes if no gain)."""
    raw = base64.b64decode(b64)
    try:
        im = Image.open(io.BytesIO(raw))
        im.load()
    except Exception:
        return b'data:image/' + fmt + b';base64,' + b64
    w, h = im.size
    if w > MAX_WIDTH:
        im = im.resize((MAX_WIDTH, round(h * MAX_WIDTH / w)), Image.LANCZOS)
    out = io.BytesIO()
    if fmt in (b'jpeg', b'jpg'):
        im.convert('RGB').save(out, 'JPEG', quality=82, optimize=True)
        mime = b'jpeg'
    else:
        if QUANTIZE:
            im = im.convert('RGBA').quantize(colors=256, method=Image.FASTOCTREE, dither=Image.Dither.NONE)
        im.save(out, 'PNG', optimize=True)
        mime = b'png'
    new = out.getvalue()
    if len(new) >= len(raw):          # downscale/recompress didn't help — keep original
        return b'data:image/' + fmt + b';base64,' + b64
    return b'data:image/' + mime + b';base64,' + base64.b64encode(new)


def process(path: str) -> None:
    data = open(path, 'rb').read()
    before = len(data)
    out = DATA_URI.sub(lambda m: shrink_one(m.group(1), m.group(2)), data)
    if len(out) < before:
        open(path, 'wb').write(out)
    print(f"  {os.path.relpath(path):44} {before/1048576:7.1f} MB -> {len(out)/1048576:6.1f} MB")


def main(argv):
    global MAX_WIDTH, QUANTIZE
    paths = []
    i = 0
    while i < len(argv):
        if argv[i] == '--max-width':
            MAX_WIDTH = int(argv[i + 1]); i += 2
        elif argv[i] == '--quantize':
            QUANTIZE = True; i += 1
        else:
            paths.append(argv[i]); i += 1
    if not paths:
        paths = ['tutorials']
    files = []
    for p in paths:
        files.extend(sorted(glob.glob(os.path.join(p, '**', '*.html'), recursive=True)) if os.path.isdir(p) else [p])
    print(f"optimizing {len(files)} file(s), max-width={MAX_WIDTH}px")
    for f in files:
        process(f)


if __name__ == '__main__':
    main(sys.argv[1:])
