"""Builds the film's music (audio/music/score.wav, 7108 frames = 236.93 s) from Lyria variant 3 by re-ordering whole bars.

v3: 65.01 BPM, 4/4, bar j starts at 0.143 + 3.69163*j s. Bars 28-31 (103.51-118.28 s) carry a plucked bass
and are never used, except the first 0.79 s of bar 28 (the held low note before the first pluck at 104.41 s),
which ends the heavy part over the page turn.

Round 2 (new opening and ending, 24.11.2026). Spreads 4-6 lie exactly 4.2616 s later than in round 1, so the middle of the
cut (heavy part, page-turn silence, Code Mode, night) is the round-1 cut moved by MID_SHIFT = LEAD + one bar.
Film order (source bars -> film seconds):
  bars 0-6            0.57 -  26.56  music and voice start together; the two opening swells, the second one lands with
                                     the cover (5.0); horn theme bars 2-3 from 8.10 ("Nein" 9.31); title page turns 23.03
  bars 5-11          26.56 -  52.40  seam 6->5 (wide chords on spread 2), D major from bar 8 (37.63, after "Sprachmodell")
  bars 11-25         52.40 - 107.77  seam 11->11 (one more open bar under "Fuer die Aufgabe ... MCP"); the pulse from
                                     bar 12 at 56.09 (after "MCP Dienste angeschlossen"), heavy part bar 20 at 85.62 ("Zuerst")
  bars 22-27, 28 head 107.77 - 130.71 seam 25->22; heaviest bars 26-27 on the third round; the held note dies by 130.71
  (pause)           130.71 - 131.93  leaf 4 lands 131.57
  bars 7-17         131.93 - 172.54  Code Mode: open chords, the pulse returns at 150.39 ("aufrufe" 151.95)
  bars 32-37 beat 2 172.54 - 192.84  seam 17->32: night ("acht Prozent"), weighing from 187.30; spread 7 lies open 190.13
  bars 37-43        192.84 - 218.68  bar 37 gets two beats more (1 2 | 1 2 3 4, no pulse there): warm from bar 40 at 203.92
                                     ("Claude"), bar 43 at 214.99 ("MCP", the booklet)
  bars 43-45, rest  218.68 - 230.34  seam 43->43: bar 44 at 222.38 ("Ende"), the dominant from 224.55, bar 45 on "Zukunft"
                                     (226.07); its rest after the last word
  rest, final chord 230.34 - 236.93  the rest 0.24 s longer; the final chord's downbeat at 231.84, where the back cover
                                     lifts; held through the fall and the landing (234.34), faded to silence by the film's end
Joins: equal-power crossfades that end on the downbeat (0.3 s; at 17->32 the night comes in over 0.06 s while the pulse fades
over 0.4 s, so nothing of bar 31 leaks in). Then high-pass 35 Hz, -3 dB at 2.2 kHz (room for the voice), -7 dB, 48 kHz 24-bit.
In bars 32-39 (172.54-203.92) the band under 250 Hz is 18 dB down: the single low notes there decay like the plucks of
bars 28-31.

usage (in the project): python audio/music/score.py   (needs numpy and scipy)
"""
import os
import subprocess
import sys

import numpy as np

SRC, OUT = "audio/music/v3.mp3", "audio/music/score.wav"
FPS, FRAMES = 30, 7108
FILM = FRAMES / FPS
SR = 44100
BAR0, BAR = 0.143, 3.69163
BEAT = BAR / 4
LEAD = 0.57                      # source 0 plays at film 0.57: bar 20 lands on "Zuerst" as in round 1
MID_SHIFT = LEAD + BAR           # the round-1 middle (from bar 20 on) plays this much later
CHORD = 231.84                   # the final chord's downbeat (bar 46, beat 3: source 171.80) when the back cover lifts
GP_CUT, GP_ADD = 170.30, 0.24    # inside the rest before the final chord (about -46 dBFS): 0.24 s more of it
END_FADE = 2.0                   # the held final chord fades out over the film's last two seconds


def bar(j):
    return BAR0 + BAR * j


raw = subprocess.run(["ffmpeg", "-v", "error", "-i", SRC, "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
                     capture_output=True, check=True).stdout
x = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)
src_end = len(x) / SR

F3 = LEAD + bar(7) + bar(12) - bar(5)          # 52.40: bar 11 again
F4 = F3 + bar(26) - bar(11)                    # 107.77: the second pass through the heavy part
MID = bar(32) + 50.0 + MID_SHIFT               # 172.54: the night (round 1: 168.28)
X0 = MID - (bar(18) - bar(7))                  # 131.93: the Code Mode part ends exactly where bar 32 begins
INS = bar(37) + 2 * BEAT                       # source point where bar 37 starts again (two beats more)
F8 = MID + INS - bar(32)                       # 192.84
F9 = F8 + bar(44) - bar(37)                    # 218.68: bar 43 again
F10 = CHORD - 171.80 + GP_CUT                  # 230.34: the rest, then the final chord
# source start, source end, film start, how it comes in: ('xf', incoming pre-roll s, outgoing fade s) or ('cut',)
SEG = [
    (0.0, bar(7), LEAD, None),
    (bar(5), bar(12), LEAD + bar(7), ("xf", 0.3, 0.3)),
    (bar(11), bar(26), F3, ("xf", 0.3, 0.3)),
    (bar(22), bar(28) + 0.79, F4, ("xf", 0.3, 0.3)),
    (bar(7), bar(18), X0, ("cut",)),
    (bar(32), INS, MID, ("xf", 0.06, 0.4)),
    (bar(37), bar(44), F8, ("xf", 0.3, 0.3)),
    (bar(43), GP_CUT + GP_ADD, F9, ("xf", 0.3, 0.3)),
    (GP_CUT, src_end, F10, ("xf", 0.2, 0.2)),
]
HELD_FADE = (F4 + bar(28) - bar(22) + 0.24, F4 + bar(28) - bar(22) + 0.79)  # the held note of bar 28 dies

s = lambda t: int(round(t * SR))
N = s(FILM)
out = np.zeros((N + s(10), 2))
for i, (a, b, f, join) in enumerate(SEG):
    pre = join[1] if join and join[0] == "xf" else 0.0
    seg = x[s(a - pre):s(b)].copy()
    g = np.ones(len(seg))
    if join and join[0] == "xf":
        k = s(pre)
        g[:k] = np.sin(0.5 * np.pi * np.arange(k) / k)
    elif join and join[0] == "cut":
        k = s(0.03)
        g[:k] = np.arange(k) / k
    nxt = SEG[i + 1][3] if i + 1 < len(SEG) else None
    if nxt and nxt[0] == "xf":
        k = s(nxt[2])
        g[-k:] *= np.cos(0.5 * np.pi * np.arange(k) / k)
    start = s(f - pre)
    out[start:start + len(seg)] += seg * g[:, None]
i0, i1 = s(HELD_FADE[0]), s(HELD_FADE[1])
out[i0:i1] *= np.cos(0.5 * np.pi * np.arange(i1 - i0) / (i1 - i0))[:, None]
out[i1:s(X0)] = 0.0
# The end: the chord still holds when the film ends, so it dies over the last two seconds (raised cosine), the last 20 ms silent.
i0, i1 = s(FILM - END_FADE), s(FILM - 0.02)
out[i0:i1] *= (0.5 + 0.5 * np.cos(np.pi * np.arange(i1 - i0) / (i1 - i0)))[:, None]
out[i1:] = 0.0
out = out[:N]

# Bars 32-39 (night and weighing) still carry single low notes with the envelope of the plucked bars 28-31: 40-60 ms
# attack, 20-30 dB down within a second (source 119.2, 121.1, 122.9, 126.6, 128.5, 137.7, 145.0 s). There the band
# under 250 Hz is taken down by 18 dB (zero-phase split, so the rest stays untouched): down over 0.25 s from the night's
# downbeat, back over the last beat before the warm part, whose low line enters in full on its downbeat.
from scipy.signal import butter, sosfiltfilt
LOW_HZ, LOW_DB = 250.0, -18.0
W40 = F8 + bar(40) - bar(37)                   # 203.92: the warm part, film time
la, lb = MID, W40 - 60.0 / 65.01
j0, j1 = s(la - 0.5), s(W40 + 0.5)
lo = sosfiltfilt(butter(4, LOW_HZ, btype="low", fs=SR, output="sos"), out[j0:j1], axis=0)
t = (np.arange(j0, j1) / SR)
k = 10 ** (LOW_DB / 20)
env = np.ones(len(t))
dn = (t >= la) & (t < la + 0.25)
env[dn] = 1 + (k - 1) * (0.5 - 0.5 * np.cos(np.pi * (t[dn] - la) / 0.25))
env[(t >= la + 0.25) & (t < lb)] = k
up = (t >= lb) & (t < W40)
env[up] = k + (1 - k) * (0.5 - 0.5 * np.cos(np.pi * (t[up] - lb) / (W40 - lb)))
out[j0:j1] += lo * (env - 1)[:, None]

tmp = OUT + ".raw.f32"
out.astype(np.float32).tofile(tmp)
try:
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", tmp, "-af",
                    "highpass=f=35,equalizer=f=2200:t=q:w=1:g=-3,volume=-7dB,aresample=48000:resampler=soxr",
                    "-t", f"{FILM:.6f}", "-c:a", "pcm_s24le", OUT], check=True)
finally:
    os.remove(tmp)
print(f"{OUT}: {FILM:.3f} s; joins at " + ", ".join(f"{seg[2]:.3f}" for seg in SEG[1:])
      + f"; pulse {F3 + BAR:.3f}, bar 20 {F3 + bar(20) - bar(11):.3f}, warm {W40:.3f}, bar 45 {F9 + bar(45) - bar(43):.3f},"
      + f" chord {CHORD:.3f}", file=sys.stderr)
