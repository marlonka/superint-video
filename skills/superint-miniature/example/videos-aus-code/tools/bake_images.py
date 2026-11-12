# Packt Bilder als data:-Adressen in ein Modul. Die Szene laeuft in einer Sandbox ohne eigene Herkunft:
# Ein geladenes Bild wuerde die Leinwand "verunreinigen", WebGL verweigert dann die Textur. data: geht immer.
import base64, os, json
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = {}
for rel in ['assets/old/luft.jpg', 'assets/old/kinder.jpg', 'assets/old/frau.jpg', 'assets/bogen/bogen1.jpg', 'assets/bogen/bogen2.jpg', 'assets/stil/stil1.jpg', 'assets/stil/stil2.jpg', 'assets/stil/stil3.jpg', 'assets/thumbs/atlas.jpg', 'assets/thumbs/barcode.png', 'assets/thumbs/wide.jpg']:
    p = os.path.join(ROOT, rel)
    if not os.path.exists(p):
        continue
    name = os.path.splitext(os.path.basename(p))[0]
    mime = 'image/png' if p.endswith('.png') else 'image/jpeg'
    out[name] = f'data:{mime};base64,' + base64.b64encode(open(p, 'rb').read()).decode('ascii')
with open(os.path.join(ROOT, 'scenes', 'baked-images.js'), 'w', encoding='utf8') as f:
    f.write('// Erzeugt von tools/bake_images.py. Nicht von Hand aendern.\nexport const IMG = ' + json.dumps(out) + ';\n')
print({k: len(v) // 1024 for k, v in out.items()}, 'KB')
