# Die beiden Kontaktboegen auf dem Leuchttisch: kleine Bilder aus dem Vorlauf dieses Films.
# Aufruf: python tools/bake_bogen.py renders/thumbsrc
import os, sys
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, sys.argv[1] if len(sys.argv) > 1 else 'renders/thumbsrc')
OUT = os.path.join(ROOT, 'assets', 'bogen')
want = [int(x) for x in open(os.path.join(ROOT, 'renders', 'thumb-frames.txt')).read().split(',')]
W, H, C, R, GAP = 1024, 679, 7, 8, 5
TW = (W - GAP * (C - 1)) / C
TH = (H - GAP * (R - 1)) / R
per = C * R
# Zwei Boegen, 112 Bilder: jedes zweite aus dem Vorlauf ergibt zusammen den ganzen Film.
step = (len(want) - 1) / (2 * per - 1)
pick = [want[round(i * step)] for i in range(2 * per)]
for b in range(2):
    sheet = Image.new('RGB', (W, H), (8, 8, 10))
    for i, f in enumerate(pick[b * per:(b + 1) * per]):
        im = Image.open(os.path.join(SRC, 'frame-%06d.png' % f)).convert('RGB')
        # Das Seitenverhaeltnis der Felder ist nicht ganz 16:9: mittig beschneiden statt verzerren.
        w, h = im.size
        tw, th = round(TW), round(TH)
        if w / h > tw / th:
            nw = round(h * tw / th); im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
        else:
            nh = round(w * th / tw); im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
        im = im.resize((tw, th), Image.LANCZOS)
        x, y = (i % C) * (TW + GAP), (i // C) * (TH + GAP)
        sheet.paste(im, (round(x), round(y)))
    sheet.save(os.path.join(OUT, 'bogen%d.jpg' % (b + 1)), quality=88)
print('Boegen neu')
