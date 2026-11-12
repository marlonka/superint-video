"""Cuts music variant 2 (120.04 BPM, bar grid measured from its section attacks) to the film on bar lines.

Bars of the variant: intro 1-5, build 8-11, lift 16-20, peak 24-27, then the struck
final chord at bar 38 with its own ring-out to the end. Variant 3 was dropped: Lyria
fades its last chord out within half a second. Each join is a 40 ms equal-power crossfade that ends
just before the downbeat, so every new section starts on its own first hit.
Writes audio/music/cue.wav (48 kHz stereo, 24-bit) and prints the film's bar times.
"""
import subprocess, sys, wave
from pathlib import Path
import numpy as np

project = Path(__file__).resolve().parent.parent
source = project / "audio/music/v2.mp3"
rate, bar, first = 48000, 1.9993, -0.146  # attacks at 15.848, 31.846, 47.833 and 75.79 s
pieces = [(1, 5), (8, 11), (16, 20), (24, 27), (38, None)]
fade = 0.040

raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(source), "-f", "f32le", "-ac", "2", "-ar", str(rate), "-"],
                     capture_output=True, check=True).stdout
audio = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2)
at = lambda k: int(round((first + k * bar) * rate))
n = int(fade * rate)
ramp = np.linspace(0, np.pi / 2, n, endpoint=False)
fade_in, fade_out = np.sin(ramp)[:, None], np.cos(ramp)[:, None]

out = np.zeros((0, 2), dtype=np.float32)
for start, end in pieces:
    a = at(start) - n  # the crossfade sits just before the downbeat
    b = len(audio) if end is None else at(end) - n
    piece = audio[max(a, 0):b].copy()
    if len(out) == 0:
        out = audio[at(start):b].copy()
        continue
    out[-n:] = out[-n:] * fade_out + piece[:n] * fade_in
    out = np.concatenate([out, piece[n:]])

# trailing digital silence off, keep 0.3 s of the natural tail's end
level = np.abs(out).max(axis=1)
last = np.nonzero(level > 10 ** (-70 / 20))[0][-1]
out = out[: min(len(out), last + int(0.3 * rate))]

target = project / "audio/music/cue.wav"
pcm = (np.clip(out, -1, 1) * (2**23 - 1)).astype(np.int32)
data = np.stack([(pcm >> s) & 0xFF for s in (0, 8, 16)], axis=-1).astype(np.uint8).tobytes()
with wave.open(str(target), "wb") as w:
    w.setnchannels(2); w.setsampwidth(3); w.setframerate(rate); w.writeframes(data)

bars = sum((e - s) for s, e in pieces[:-1])
print(f"cue.wav {len(out) / rate:.3f} s; film bar length {bar:.5f} s; final chord at film {bars * bar:.3f} s (bar {bars})")
