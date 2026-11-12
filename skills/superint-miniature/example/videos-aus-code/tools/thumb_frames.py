# Welche Bilder der Vorlauf rendert: 216 gleichmaessig ueber den Film, passend zum Atlas (12 x 18).
# Aufruf: python tools/thumb_frames.py
import os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cues = open(os.path.join(ROOT, 'scenes', 'cues.js'), encoding='utf8').read()
frames = int(re.search(r'FRAMES\s*=\s*(\d+)', cues).group(1))
n = 216
want = [round(i * (frames - 1) / (n - 1)) for i in range(n)]
text = ','.join(str(f) for f in want)
for name in ('thumb-frames.txt', 'thumb-frames2.txt'):
    open(os.path.join(ROOT, 'renders', name), 'w').write(text)
print(frames, 'Bilder im Film,', n, 'im Vorlauf, letztes', want[-1])
