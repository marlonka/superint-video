# Huellkurve der echten Stimme, ein Wert je Filmbild (0..99). Fuer Zeiger, Schreiber und Papierstreifen.
import os, wave, json
import numpy as np
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
w = wave.open(os.path.join(ROOT, 'audio', 'voice.wav'))
n, sr, sw, ch = w.getnframes(), w.getframerate(), w.getsampwidth(), w.getnchannels()
raw = w.readframes(n)
if sw == 3:
    b = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3)
    a = (b[:, 0].astype(np.int32) | (b[:, 1].astype(np.int32) << 8) | (b[:, 2].astype(np.int32) << 16))
    a = np.where(a >= 1 << 23, a - (1 << 24), a).astype(np.float64) / (1 << 23)
elif sw == 2:
    a = np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768
else:
    a = np.frombuffer(raw, dtype=np.int32).astype(np.float64) / (1 << 31)
if ch > 1:
    a = a.reshape(-1, ch).mean(axis=1)
fps = 30
hop = sr // fps
env = []
for i in range(0, len(a), hop):
    s = a[i:i + hop]
    env.append(float(np.sqrt(np.mean(s * s))) if len(s) else 0.0)
env = np.array(env)
peak = np.percentile(env, 99.5) or 1
v = np.clip(env / peak, 0, 1) ** .6
out = [int(round(x * 99)) for x in v]
with open(os.path.join(ROOT, 'scenes', 'envelope.js'), 'w', encoding='utf8') as f:
    f.write('// Erzeugt von tools/bake_env.py aus audio/voice.wav.\nexport const ENV = ' + json.dumps(out, separators=(',', ':')) + ';\n')
print(len(out), 'Werte')
