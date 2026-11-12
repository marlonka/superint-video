# Aus einem ersten Durchlauf des Films entstehen die Bilder, die der Film von sich selbst zeigt:
# der Filmstreifen (Atlas) und der Turm (eine Zeile je Bild, die Durchschnittsfarbe).
# Aufruf: python tools/bake_thumbs.py renders/thumbsrc
import os, sys, glob
from PIL import Image, ImageDraw, ImageStat, ImageEnhance

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, sys.argv[1] if len(sys.argv) > 1 else 'renders/thumbsrc')
OUT = os.path.join(ROOT, 'assets', 'thumbs')
os.makedirs(OUT, exist_ok=True)

files = sorted(glob.glob(os.path.join(SRC, 'frame-*.png')))
want = [int(x) for x in open(os.path.join(ROOT, 'renders', 'thumb-frames.txt')).read().split(',')]
paths = [os.path.join(SRC, 'frame-%06d.png' % f) for f in want]
missing = [p for p in paths if not os.path.exists(p)]
if missing:
    sys.exit('Es fehlen %d Bilder, zum Beispiel %s' % (len(missing), missing[0]))

AC, AR, S = 12, 18, 2048
CW, CH = S / AC, S / AR
IH, IB = 96, 8.9
atlas = Image.new('RGB', (S, S), (6, 6, 8))
draw = ImageDraw.Draw(atlas)
means = []
for i, p in enumerate(paths):
    im = Image.open(p).convert('RGB')
    means.append(ImageStat.Stat(im.resize((64, 36), Image.BILINEAR)).mean)
    th = im.resize((round(CW), IH), Image.LANCZOS)
    x, y = (i % AC) * CW, (i // AC) * CH
    atlas.paste(th, (round(x), round(y + IB)))
    # Perforation im schwarzen Rand ueber und unter dem Bild
    for k in range(4):
        hx = x + (k + .5) * CW / 4 - 6
        draw.rectangle([hx, y + 1.8, hx + 12, y + 7], fill=(168, 160, 142))
        draw.rectangle([hx, y + IB + IH + 2, hx + 12, y + IB + IH + 7], fill=(168, 160, 142))
atlas.save(os.path.join(OUT, 'atlas.jpg'), quality=88)

# Der Turm: Zeile 0 ist Bild 0. Die Farben sind heller als im Film, sonst wuerde der Turm im Raum versinken.
N = 1024
bar = Image.new('RGB', (N, N))
px = bar.load()
for y in range(N):
    u = y / (N - 1) * (len(means) - 1)
    a = int(u)
    b = min(a + 1, len(means) - 1)
    f = u - a
    c = [means[a][k] * (1 - f) + means[b][k] * f for k in range(3)]
    l = max(c)
    gain = 1.0 if l < 1 else min(2.6, 150 / l)
    # Jede Zeile ist ein Bild: leichte Schwankung, wie bei echten Filmbildern.
    wob = 1 + .06 * (((y * 2654435761) >> 7) % 100) / 100 - .03
    c = [min(255, v * gain * wob + 8) for v in c]
    for x in range(N):
        px[x, y] = tuple(int(v) for v in c)
bar.save(os.path.join(OUT, 'barcode.png'))

# Entwurf 3 auf der Leinwand: ein Bild aus diesem Film.
WIDE = 11100  # das ganze Haus von draussen, kurz vor dem Ende
tile = os.path.join(ROOT, 'renders', 'thumbsrc', 'frame-%06d.png' % min(want, key=lambda f: abs(f - WIDE)))
Image.open(tile).convert('RGB').resize((1024, 576), Image.LANCZOS).save(os.path.join(OUT, 'wide.jpg'), quality=88)
print('atlas', os.path.getsize(os.path.join(OUT, 'atlas.jpg')) // 1024, 'KB, barcode', os.path.getsize(os.path.join(OUT, 'barcode.png')) // 1024, 'KB')
