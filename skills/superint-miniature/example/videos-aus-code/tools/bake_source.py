#!/usr/bin/env python3
"""Backt den Quelltext dieses Films in scenes/source-text.js.
Wenn in der Eroeffnung alles zu Text wird, ist es genau dieser Text. Lauf: python tools/bake_source.py"""
import json, re
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
ORDER = ['shaders.js', 'schreib.js', 'house.js', 'exterior.js', 'story.js', 'camera.js', 'engine.js', 'geo.js', 'props.js', 'kit.js', 'm.js']
parts = []
for name in ORDER + sorted(p.name for p in (ROOT / 'scenes').glob('*.js') if p.name not in ORDER and p.name not in ('source-text.js', 'cues.js', 'main.js', 'baked-images.js', 'envelope.js')):
    p = ROOT / 'scenes' / name
    if p.exists():
        parts.append(f'// {name}  ' + p.read_text(encoding='utf8'))
txt = '  '.join(parts)
txt = re.sub(r'\s*\n\s*', '  ', txt)
txt = txt.encode('latin-1', 'replace').decode('latin-1')
out = 'export const SOURCE=' + json.dumps(txt, ensure_ascii=False) + ';\n'
(ROOT / 'scenes/source-text.js').write_text(out, encoding='utf8')
print(len(txt), 'Zeichen')
