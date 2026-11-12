#!/usr/bin/env python3
"""Echte Pausen in die Stimme setzen.

`voice assemble` kuerzt jede Pause auf sentencePause. Dieser Film braucht an ein paar Stellen mehr Luft:
die Kamera faehrt, ein Bild steht, jemand soll lachen duerfen. Das Skript liest die frisch montierte
Stimme, setzt Stille hinter bestimmten Woertern ein und verschiebt alle Wortzeiten mit. Danach schreibt
es scenes/cues.js und traegt Laenge und Stimme in video.json ein.

Lauf: python tools/pauses.py   (immer direkt nach voice assemble, das die Pausen wieder entfernt)
"""
import json, sys, wave, shutil, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FPS = 30
LEAD = 2.2        # Stille vor dem ersten Wort: das erste Bild darf stehen
END_CARD = 11.85    # nach dem letzten Wort: Dach-Schild, dann die Endkarte

# (Absatz, letzte Woerter vor der Pause, Sekunden extra)
PAUSES = [
    (1, 'gibt es nicht', .55),
    (1, 'Zimmer auch nicht', .55),
    (1, 'schon gar nicht', .8),
    (2, 'einem KI Videogenerator', .35),
    (3, 'ist Code', 1.5),
    (4, 'wie du es selbst machst', .3),
    (5, 'ins Mikrofon gesprochen', .25),
    (5, 'hast ja Geschmack', .5),
    (6, 'ein anderer Film', .3),
    (6, 'Code geschrieben', .2),
    (6, 'diese eine Sache', .7),
    (10, 'genau dieser Sekunde', 2.2),
    (11, 'siehst du gerade', .8),
    (12, 'schreiben kann ich', 1.5),
    (14, 'DIESEM Wort passieren', .5),
    (16, 'doch keine Frau', .7),
    (18, 'Programm. Der Ordner', .8),
    (20, 'Dieses Haus', .35),
    (20, 'kommt von Superintelligenz', .45),
    (22, 'die Freiheit lassen', .25),
    (22, 'Klingt albern', .15),
    (23, 'reicht völlig', .25),
    (23, 'keine Zeile Code', .6),
    (24, 'wie diesen machen', .9),
    (24, 'aus Code', .6),
]

def norm(s):
    return re.sub(r'[^\wäöüÄÖÜß]+', '', s, flags=re.UNICODE).lower()

def main():
    src_wav = ROOT / 'audio/voice.wav'
    src_words = ROOT / 'audio/words.json'
    raw_wav = ROOT / 'audio/voice.assembled.wav'
    raw_words = ROOT / 'audio/words.assembled.json'
    # Immer von der frisch montierten Fassung ausgehen.
    # Nur mit --fresh: direkt nach voice assemble. Sonst immer von der gesicherten Fassung ausgehen.
    if '--fresh' in sys.argv or not raw_wav.exists():
        shutil.copy2(src_wav, raw_wav)
        shutil.copy2(src_words, raw_words)
    words = json.loads(raw_words.read_text(encoding='utf8'))
    with wave.open(str(raw_wav), 'rb') as w:
        params = w.getparams()
        data = w.readframes(w.getnframes())
    sr = params.framerate
    bps = params.sampwidth * params.nchannels

    # Einfuegepunkte: Mitte der Luecke hinter dem Wort.
    inserts = []  # (sekunde im Original, dauer, wortindex des naechsten Worts)
    inserts.append((0.0, LEAD, 0))
    for para, phrase, extra in PAUSES:
        toks = [norm(t) for t in phrase.split()]
        idx = [i for i, w in enumerate(words) if w['paragraph'] == para]
        hit = None
        for i in idx:
            if i + len(toks) > len(words):
                continue
            if [norm(words[i + k]['word']) for k in range(len(toks))] == toks:
                hit = i + len(toks) - 1
                break
        if hit is None:
            raise SystemExit(f'Nicht gefunden: Absatz {para}: {phrase}')
        end = words[hit]['end']
        nxt = words[hit + 1]['start'] if hit + 1 < len(words) else end + .3
        inserts.append(((end + nxt) / 2, extra, hit + 1))
    inserts.sort(key=lambda a: a[0])

    # Audio zusammensetzen: echte Nullen in den Stellen, an denen ohnehin Stille ist.
    out = bytearray()
    pos = 0
    for at, dur, _ in inserts:
        cut = int(at * sr) * bps
        out += data[pos:cut]
        out += b'\0' * (int(dur * sr) * bps)
        pos = cut
    out += data[pos:]
    with wave.open(str(src_wav), 'wb') as w:
        w.setparams(params)
        w.writeframes(bytes(out))

    # Wortzeiten verschieben.
    shifted = []
    for i, wd in enumerate(words):
        add = sum(d for at, d, nxt in inserts if nxt <= i)
        n = dict(wd)
        n['start'] = round(wd['start'] + add, 3)
        n['end'] = round(wd['end'] + add, 3)
        n['startFrame'] = int(round(n['start'] * FPS))
        n['endFrame'] = int(round(n['end'] * FPS))
        shifted.append(n)
    src_words.write_text(json.dumps(shifted, ensure_ascii=False, indent=1), encoding='utf8')

    seconds = len(out) / bps / sr
    total_frames = int(round((shifted[-1]['end'] + END_CARD) * FPS))

    # cues.js: Alles, was die Stimme entscheidet.
    rows = ','.join(json.dumps([w['word'], w['start'], w['end'], w['paragraph']], ensure_ascii=False, separators=(',', ':')) for w in shifted)
    scenes = {}
    paras = {}
    for w in shifted:
        scenes.setdefault(w['scene'], w['start'])
        paras.setdefault(w['paragraph'], w['start'])
    js = (
        '// scenes/cues.js: generiert von tools/pauses.py aus audio/words.json. Nicht von Hand aendern.\n'
        f'export const WORDS=[{rows}];\n'
        f'export const SCENES={json.dumps(scenes, ensure_ascii=False)};\n'
        f'export const PARAS={json.dumps(paras)};\n'
        f'export const DURATION={total_frames / FPS:.4f};\n'
        f'export const FRAMES={total_frames};\n'
        'export const FPS=30;\n'
    )
    (ROOT / 'scenes/cues.js').write_text(js, encoding='utf8')

    # video.json
    vp = ROOT / 'video.json'
    v = json.loads(vp.read_text(encoding='utf8'))
    v['durationFrames'] = total_frames
    for c in v['clips']:
        if c['id'] == 'film':
            c['durationFrames'] = total_frames
    voice_frames = int(seconds * FPS)
    clips = [c for c in v['clips'] if c['id'] != 'voice']
    clips.append({
        'id': 'voice', 'type': 'audio', 'src': 'audio/voice.wav', 'track': 'voice',
        'startFrame': 0, 'durationFrames': voice_frames, 'sourceOffsetFrames': 0,
        'gain': 1,
    })
    v['clips'] = clips
    vp.write_text(json.dumps(v, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print(json.dumps({'voiceSeconds': round(seconds, 2), 'lastWordEnd': shifted[-1]['end'], 'frames': total_frames, 'filmSeconds': round(total_frames / FPS, 2), 'inserted': round(sum(d for _, d, _ in inserts), 2)}))

if __name__ == '__main__':
    main()
