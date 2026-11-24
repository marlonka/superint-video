#!/usr/bin/env python3
"""Everything the voice decides, in one run after `voice assemble`:

1. tools/pauses.py puts the real pauses into audio/voice.wav and shifts the word times (config: PAUSES there).
2. process/timing.json: start, end and text of every paragraph, and the named moments of every spread,
   each on the first word of its trigger phrase (beats.md).
3. tools/make_timing.py writes scenes/timing.js and process/turns.json.
4. video.json gets the film's real length.

Run: python tools/after_voice.py [--fresh]   (--fresh right after voice assemble)
It prints the distances between the moments, so a pause that is too short shows at once.
"""
import json, re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FPS = 30

# spread: [(moment, trigger phrase, which word of the phrase carries the moment, which occurrence in the paragraph[, paragraph of voice.md])]
# The paragraph defaults to spread + 1; the title spread also hears the end of the cover's paragraph.
MOMENTS = {
    1: [('stecker', 'MCP', 0, 1, 1), ('direkt', 'Werkzeuge', 0, 1, 1), ('nein', 'Nein', 0, 1), ('ki', 'KI', 0, 1), ('programm', 'Programm', 0, 1),
        ('aufrufe', 'aufruft', 0, 1), ('endergebnis', 'Endergebnis', 0, 1), ('zukunft', 'Zukunft', 0, 1)],
    2: [('frage', 'bittet', 0, 1), ('agent', 'Der Agent', 1, 1), ('modell', 'Sprachmodell', 0, 1), ('tokens', 'Tokens', 0, 1),
        ('fenster', 'Kontextfenster', 0, 1), ('kostet', 'kostet', 0, 1)],
    3: [('mcp', 'MCP', 0, 1), ('mail', 'Mail', 0, 1), ('karte', 'Beschreibung', 0, 1), ('stapel', 'Kontextfenster', 0, 1), ('zahl', 'fünfundfünfzigtausend', 0, 1)],
    4: [('aufruf', 'Aufruf', 0, 1), ('ergebnis', 'fünfhundert', 0, 1), ('runde', 'Runde', 0, 1), ('zweite', 'zweite', 0, 1), ('liest', 'liest', 0, 1),
        ('abschreiben', 'Zeile', 0, 1), ('zweimal', 'zweimal', 0, 1), ('dritte', 'dritten', 0, 1)],
    5: [('nachschlagen', 'schlägt', 0, 1), ('programm', 'Programm', 0, 1), ('sandbox', 'Sandbox', 0, 1), ('aufrufe', 'dieselben', 0, 1),
        ('zeile', 'Ergebnis', 0, 1), ('nie', 'nie', 0, 1)],
    6: [('einfach', 'einfachen', 0, 1), ('acht', 'acht', 0, 1), ('viele', 'Werkzeugen', 0, 1), ('zwanzig', 'zwanzig', 0, 1), ('schluss', 'Je mehr', 0, 1)],
    7: [('tabelle', 'Tabelle', 0, 1), ('cloudflare', 'Cloudflare', 0, 1), ('anthropic', 'Anthropic', 0, 1), ('claude', 'In Claude', 1, 1), ('andere', 'andere', 0, 1),
        ('mcp', 'MCP', 0, 1), ('botschaft', 'Ende', 0, 1), ('gross', 'großen', 0, 1), ('zukunft', 'Zukunft', 0, 1)],
}

# Leaves that turn on a word while the voice goes on: leaf -> (paragraph of voice.md, trigger phrase, word of the phrase, occurrence).
# The turn starts on that word's start. All other leaves turn in the pause after their paragraph.
TURN_AT = {0: (1, 'sparsamer', 0, 1)}

def norm(s):
    return re.sub(r'[^\wäöüÄÖÜß]+', '', s, flags=re.UNICODE).lower()

def find(words, idx, phrase, occurrence):
    toks = [norm(t) for t in phrase.split()]
    n = 0
    for i in idx:
        if i + len(toks) > len(words):
            continue
        got = [norm(words[i + k]['word']) for k in range(len(toks))]
        if all(g == t or g.startswith(t) for g, t in zip(got, toks)):
            n += 1
            if n == occurrence:
                return i
    return None

def main():
    r = subprocess.run([sys.executable, str(ROOT / 'tools/pauses.py')] + [a for a in sys.argv[1:] if a == '--fresh'], capture_output=True, text=True)
    print(r.stdout.strip() or r.stderr.strip())
    if r.returncode:
        raise SystemExit(r.stderr)
    words = json.loads((ROOT / 'audio/words.json').read_text(encoding='utf8'))
    paras = {}
    for i, w in enumerate(words):
        paras.setdefault(w['paragraph'], []).append(i)
    out = {'paragraphs': [], 'moments': {}}
    for p in sorted(paras):
        idx = paras[p]
        out['paragraphs'].append({'spread': p - 1, 'start': words[idx[0]]['start'], 'end': words[idx[-1]]['end'], 'text': ' '.join(words[i]['word'] for i in idx)})
    missing = []
    for spread, rows in MOMENTS.items():
        m = {}
        for name, phrase, k, occ, *pp in rows:
            i = find(words, paras.get(pp[0] if pp else spread + 1, []), phrase, occ)
            if i is None:
                missing.append(f'{spread}.{name}: "{phrase}"')
                continue
            m[name] = words[i + k]['start']
        out['moments'][str(spread)] = m
    out['turnAt'] = {}
    for leaf, (p, phrase, k, occ) in TURN_AT.items():
        i = find(words, paras.get(p, []), phrase, occ)
        if i is None:
            missing.append(f'Blatt {leaf}: "{phrase}"')
            continue
        out['turnAt'][str(leaf)] = words[i + k]['start']
    out['lastWord'] = words[-1]['end']
    (ROOT / 'process/timing.json').write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf8', newline='\n')
    r = subprocess.run([sys.executable, str(ROOT / 'tools/make_timing.py')], capture_output=True, text=True)
    print(r.stdout.strip() or r.stderr.strip())
    if r.returncode:
        raise SystemExit(r.stderr)
    turns = json.loads((ROOT / 'process/turns.json').read_text(encoding='utf8'))
    vp = ROOT / 'video.json'
    v = json.loads(vp.read_text(encoding='utf8'))
    v['durationFrames'] = turns['frames']
    for c in v['clips']:
        if c['id'] == 'film':
            c['durationFrames'] = turns['frames']
    vp.write_text(json.dumps(v, ensure_ascii=False, indent=2) + '\n', encoding='utf8', newline='\n')
    # The distances the picture depends on: from each moment to the next, and to the end of its paragraph.
    par = {p['spread']: p for p in out['paragraphs']}
    lands = {t['leaf'] + 1: t['lands'] for t in turns['turns']}
    for spread, m in out['moments'].items():
        s = int(spread); names = sorted(m, key=m.get)
        row = [f"{n} {m[n] - lands.get(s, 0):.1f}" for n in names]
        gaps = [f"{m[b] - m[a]:.1f}" for a, b in zip(names, names[1:])] + [f"{par[s]['end'] - m[names[-1]]:.1f} bis Absatzende"] if names else []
        print(f"Doppelseite {s} (liegt {lands.get(s, 0):.2f}, Absatz {par[s]['start']:.2f} bis {par[s]['end']:.2f}): " + ', '.join(row))
        print('   Abstände: ' + ' · '.join(gaps))
    if missing:
        print('NICHT GEFUNDEN: ' + '; '.join(missing))
    print(f"Film: {turns['frames']} Bilder, {turns['end']:.2f} s")

if __name__ == '__main__':
    main()
