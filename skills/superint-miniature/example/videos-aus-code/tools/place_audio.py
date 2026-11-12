# Legt die vier Musikstuecke und den Gong in video.json. Alle Stellen kommen aus den Wortzeiten.
# Warum vier Stuecke: Lyria schreibt hoechstens drei Minuten, und die Stille an den Bruchstellen erzaehlt mit:
#   A  setzt beim Auftrag ein und bricht auf dem Wort 'gerade' ab, wenn die Lampe weiss wird.
#   B  kommt nach dem Aha zurueck und verklingt, bevor die Kugel rollt.
#   C  beginnt, wenn der Gong verklingt, und endet bei 'Ich vergesse'.
#   E  beginnt bei 'Jeder neue Film' und endet auf der letzten Sekunde: Es ist so lang, dass der Einsatz von selbst dort liegt.
# Aufruf: python tools/place_audio.py
import os, re, json, subprocess
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
cues = open('scenes/cues.js', encoding='utf8').read()
W = json.loads(re.search(r'WORDS\s*=\s*(\[.*?\]);', cues, re.S).group(1))
FILMF = int(re.search(r'FRAMES\s*=\s*(\d+)', cues).group(1))
DUR = FILMF / 30


def cue(p, w, n=0):
    w = w.lower()
    k = 0
    for x in W:
        if x[3] == p and x[0].lower() == w:
            if k == n:
                return x[1]
            k += 1
    raise SystemExit('Wort fehlt: ' + w)


def cueE(p, w, n=0):
    w = w.lower()
    k = 0
    for x in W:
        if x[3] == p and x[0].lower() == w:
            if k == n:
                return x[2]
            k += 1
    raise SystemExit('Wort fehlt: ' + w)


def seconds(f):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout)


A_HIT = 119.0   # lautester Schlag in Stueck A (gemessen)
A_CUT = 119.4   # dort wird hart abgebrochen
tGerade = cue(11, 'gerade')
tHit = cue(14, 'DIESEM')

clips = []
# A
a0 = tGerade + .05 - A_HIT
clips.append({'id': 'mus-a', 'src': 'audio/music/a/v3.mp3', 'startFrame': round(a0 * 30), 'durationFrames': round(A_CUT * 30), 'fadeOutFrames': 2})
# B: Einstieg in der Pause nach 'ich'
b0 = cue(13, 'Aber') - 2.0
clips.append({'id': 'mus-b', 'src': 'audio/music/b/v3.mp3', 'startFrame': round(b0 * 30), 'durationFrames': round(36.4 * 30), 'fadeOutFrames': 30})
# C: endet bei 'vergesse'
cLen = seconds('audio/music/c/v2.mp3')
c0 = cue(18, 'vergesse') + .1 - cLen
clips.append({'id': 'mus-c', 'src': 'audio/music/c/v2.mp3', 'startFrame': round(c0 * 30), 'durationFrames': round(cLen * 30) - 1, 'fadeInFrames': 12, 'fadeOutFrames': 45})
# E: endet mit dem Film, der letzte Akkord liegt auf dem Abspann
eLen = seconds('audio/music/e/v1.mp3')
eStart = max(FILMF - int(eLen * 30), round((cue(18, 'Jeder', 1) - .1) * 30))
clips.append({'id': 'mus-e', 'src': 'audio/music/e/v1.mp3', 'startFrame': eStart, 'durationFrames': FILMF - eStart, 'fadeInFrames': 6, 'fadeOutFrames': 12})
print({c['id']: (round(c['startFrame'] / 30, 2), round((c['startFrame'] + c['durationFrames']) / 30, 2)) for c in clips})

# Gong: erster Schlag aus dem Stueck 'gong/v2', Einsatz bei .12 s
GONG = 'audio/music/gong/gong.wav'
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', '0.1', '-t', '6.7', '-i', 'audio/music/gong/v2.mp3', '-af', 'highpass=f=130,equalizer=f=280:t=q:w=1.2:g=-5,afade=t=out:st=4.2:d=2.5', '-ar', '48000', GONG], check=True)
g0 = tHit - .02

v = json.load(open('video.json', encoding='utf8'))
keep = [c for c in v['clips'] if not (c['id'].startswith('mus-') or c['id'] == 'fx-gong' or c['id'].startswith('amb-'))]
for c in clips:
    keep.append({'id': c['id'], 'type': 'audio', 'src': c['src'], 'track': 'music', 'startFrame': c['startFrame'], 'durationFrames': c['durationFrames'], 'sourceOffsetFrames': 0, 'gain': 1, 'fadeInFrames': c.get('fadeInFrames', 0), 'fadeOutFrames': c.get('fadeOutFrames', 0)})
keep.append({'id': 'fx-gong', 'type': 'audio', 'src': GONG, 'track': 'sfx', 'startFrame': round(g0 * 30), 'durationFrames': round(6.7 * 30), 'sourceOffsetFrames': 0, 'gain': .17})


# Raumton ueber den ganzen Film, Regen nur, wenn die Kamera draussen ist.
def amb(cid, src, start, dur, gain, off=0, fi=0, fo=0):
    keep.append({'id': cid, 'type': 'audio', 'src': src, 'track': 'sfx', 'startFrame': start, 'durationFrames': dur, 'sourceOffsetFrames': off, 'gain': gain, 'fadeInFrames': fi, 'fadeOutFrames': fo})


RAUM, REGEN = .016, .032
RS = 3600   # Das Band ist zwei Minuten lang.
n, f0 = 1, 0
while f0 < FILMF:
    dur = min(RS, FILMF - f0)
    amb('amb-raum-%d' % n, 'audio/ambience/raum.wav', f0, dur, RAUM, fi=30 if f0 == 0 else 0, fo=30 if f0 + dur >= FILMF else 0)
    f0 += RS - 60
    n += 1
    if FILMF - f0 < 60:
        break
# Draussen: am Anfang bis zur Schreibmaschine, in der Traumfabrik, am Ende.
r1a, r1b = cue(1, 'Zimmer') + .1, cue(4, 'Ich') - .05
amb('amb-regen-1', 'audio/ambience/regen.wav', round(r1a * 30), round((r1b - r1a) * 30), REGEN, fi=36, fo=18)
r2a, r2b = cue(6, 'in') - .4, cue(6, 'Hier', 0) + .4
amb('amb-regen-2', 'audio/ambience/regen.wav', round(r2a * 30), round((r2b - r2a) * 30), REGEN, off=300, fi=24, fo=30)
r3a, r3b = cue(24, 'Wer') + 1.5, cueE(24, 'ich') + .2
amb('amb-regen-3', 'audio/ambience/regen.wav', round(r3a * 30), round((r3b - r3a) * 30), REGEN, off=600, fi=45, fo=75)
v['clips'] = keep
json.dump(v, open('video.json', 'w', encoding='utf8', newline=''), ensure_ascii=False, indent=2)

tEnd = cueE(24, 'ich') + .3
mix = {
    'loudness': -14, 'ceiling': -3.4, 'musicUnder': 22, 'duckDb': 3,
    'rides': [
        {'from': round(a0 * 30), 'to': round(cue(5, 'Alles') * 30) + 750, 'db': 9, 'rampFrames': 30, 'note': 'Klavier allein ist leiser als das Trio'},
        {'from': round((a0 + 98.7) * 30), 'to': round((tGerade + .45) * 30), 'db': 3, 'rampFrames': 90, 'note': 'die Steigerung bis zum Blitz'},
        {'from': round(b0 * 30), 'to': round((b0 + 2.0) * 30), 'db': 6, 'rampFrames': 12, 'note': 'Einstieg in der Pause'},
        {'from': round(cue(24, 'Wer') * 30), 'to': round(tEnd * 30), 'db': 3, 'rampFrames': 45, 'note': 'die Botschaft'},
        {'from': round(tEnd * 30), 'to': FILMF, 'db': 8, 'rampFrames': 45, 'note': 'Abspann: nur noch Musik'},
    ],
}
json.dump(mix, open('mix.json', 'w', encoding='utf8', newline=''), ensure_ascii=False, indent=1)
print('ok')
