# Raumton und Regen. Earshot hat keine Flaechen, und Lyria liefert Regen nur mit Klavier darueber.
# Darum sind diese beiden Spuren gefiltertes Rauschen: Sie sollen man nicht hoeren, sondern nur vermissen.
# Aufruf: python tools/make_ambience.py
import os, wave
import numpy as np
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'audio', 'ambience')
os.makedirs(OUT, exist_ok=True)
SR = 24000


def band(n, lo, hi, slope, seed):
    """Rauschen mit Bandpass und Neigung, im Frequenzraum."""
    rng = np.random.default_rng(seed)
    s = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    f[0] = 1
    g = (f / 1000) ** slope
    g *= 1 / (1 + (lo / f) ** 4)
    g *= 1 / (1 + (f / hi) ** 4)
    x = np.fft.irfft(s * g, n)
    return x / np.sqrt((x * x).mean())


def slow(n, hz, seed):
    """Langsam schwankender Pegel um 1."""
    rng = np.random.default_rng(seed)
    k = max(4, int(n / SR * hz))
    pts = rng.standard_normal(k)
    return np.interp(np.arange(n), np.linspace(0, n, k), pts)


def write(name, l, r, peak_db):
    s = np.stack([l, r], 1)
    s = s / np.abs(s).max() * 10 ** (peak_db / 20)
    with wave.open(os.path.join(OUT, name), 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((s * 32767).astype(np.int16).tobytes())
    print(name, round(len(l) / SR), 's')


# Raum: tiefes, warmes Rauschen, kaum Hoehen
n = SR * 120
room_l = band(n, 40, 900, -1.0, 1)
room_r = band(n, 40, 900, -1.0, 2)
fade = np.minimum(1, np.minimum(np.arange(n), n - np.arange(n)) / (SR * 2))
write('raum.wav', room_l * fade, room_r * fade, -6)

# Regen: helles, dichtes Rauschen ueber fernem Stadtgrummeln, leicht schwankend wie echte Schauer
n = SR * 60
for name, seed in (('regen.wav', 10),):
    l = band(n, 900, 9000, -.35, seed) * (1 + .18 * slow(n, .5, seed + 1)) + .55 * band(n, 40, 320, -1, seed + 2)
    r = band(n, 900, 9000, -.35, seed + 3) * (1 + .18 * slow(n, .5, seed + 4)) + .55 * band(n, 40, 320, -1, seed + 5)
    fade = np.minimum(1, np.minimum(np.arange(n), n - np.arange(n)) / (SR * .5))
    write(name, l * fade, r * fade, -6)
