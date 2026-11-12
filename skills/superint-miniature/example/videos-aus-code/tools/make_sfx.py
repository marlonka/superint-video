# Schreibt sfx.json aus den Wortzeiten und den Zeiten der Szenen. Keine Sekunde ist von Hand getippt.
# Aufruf: python tools/make_sfx.py
import os, re, json, math
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cues = open(os.path.join(ROOT, 'scenes', 'cues.js'), encoding='utf8').read()
W = json.loads(re.search(r'WORDS\s*=\s*(\[.*?\]);', cues, re.S).group(1))
SC = json.loads(re.search(r'SCENES\s*=\s*(\{.*?\});', cues, re.S).group(1))
FILMF = int(re.search(r'FRAMES\s*=\s*(\d+)', cues).group(1))
DUR = FILMF / 30


def _find(p, w, n):
    w = w.lower()
    k = 0
    for x in W:
        if x[3] == p and x[0].lower() == w:
            if k == n:
                return x
            k += 1
    raise SystemExit('Wort nicht gefunden: %s %s %s' % (p, w, n))


def cue(p, w, n=0):
    return _find(p, w, n)[1]


def cueE(p, w, n=0):
    return _find(p, w, n)[2]


def hash1(x):
    return (math.sin(x * 12.9898) * 43758.5453) % 1


def smooth(a, b, t):
    u = max(0, min(1, (t - a) / (b - a)))
    return u * u * (3 - 2 * u)


def mix(a, b, u):
    return a + (b - a) * u


out = []


def add(t, role, under, note=''):
    out.append({'frame': int(round(t * 30)), 'role': role, 'under': under, 'note': note})


def typing(t0, t1, rate, under, note, role='key.soft'):
    t = t0
    i = 0
    while t < t1:
        add(t, role, under + (hash1(i * 3.1) - .5) * 2, note)
        t += (1 + (hash1(i * 7.7) - .5) * .5) / rate
        i += 1


# ---------------------------------------------------------------- Hook: keine Musik, nur die Stimme und die Nacht draussen
tOut1, tOut2, tOut3 = cueE(1, 'nicht', 1) - .6, cueE(1, 'nicht', 2), cue(2, 'gefilmt')
add(tOut1, 'wind', 26, 'raus aus dem Fenster')
add(tOut2, 'wind', 30, 'Nachtluft am Haus')
add(tOut3 + 2.4, 'wind', 28, 'hinunter zur Strasse')
add(cue(3, 'Das') + .1, 'typerun', 24, 'die Welt wird Code')
add(cue(3, 'Das') + 1.3, 'typerun', 27, 'die Welt wird Code')

# Einzelne Tropfen, solange die Kamera draussen ist.
tMachinesOut = cue(6, 'in') - .25
tMachinesIn = cue(6, 'Hier', 0) + .3
tEndOut = cue(24, 'Wer') + 1.2
for a, b in ((tOut1 + .5, cue(4, 'Ich') - .5), (tMachinesOut + .4, tMachinesIn), (tEndOut + 1.5, DUR - 16)):
    t = a
    while t < b:
        add(t, 'drop', 33 + 4 * hash1(t * 3.3), 'Tropfen')
        t += .22 + .7 * hash1(t * 9.1)

# ---------------------------------------------------------------- Die Schreibmaschine tippt synchron zur Stimme
TXT = 'Ich bin Claude, eine KI. Ich habe keine Kamera und keine Hände. Ich kann nur eines: schreiben. Trotzdem ist dieser Film von mir, jedes einzelne Bild. Ich zeige dir, wie das geht. Und wie du es selbst machst.'.split(' ')
P4 = [x for x in W if x[3] == 4]
endP4 = P4[-1][2]
for i, x in enumerate(P4):
    s = TXT[i] if i < len(TXT) else x[0]
    d = (x[2] - x[1]) / max(1, len(s))
    fade = 5 * smooth(endP4 - 3.5, endP4 - 1.9, x[1])
    for j in range(0, len(s), 3):
        add(x[1] + j * d, 'key', 28 + fade + (hash1(i * 3 + j) - .5) * 2, 'Taste')
    if s[-1] in ',:':
        add(x[2] - .02, 'key.space', 28 + fade, 'Leertaste')
    if s[-1] == '.':
        add(x[2] + .22, 'return', 28 + fade, 'Wagenruecklauf')
        add(x[2] + .22 + .34, 'stop', 30 + fade, 'Wagen schlaegt an')
add(cueE(4, 'Bild') - .12, 'bell', 26, 'Zeilenende')

# ---------------------------------------------------------------- Foyer: Das Mikrofon hoert zu, der Kugelkopf schreibt mit
add(cue(5, 'Alles') - .3, 'move', 28, 'in den Flur')
add(cue(5, 'Mikrofon') - .05, 'switch', 27, 'Sprechanlage geht an')
TXT5 = ['Die', 'Leute', 'fragen,', 'wie', 'so', 'ein', 'Film', 'möglich', 'ist.', 'Zeig', 'es', 'ihnen', 'so,', 'dass', 'sie', 'es', 'selbst', 'verstehen.', 'Und', 'vielleicht', 'machst', 'du', 'einfach', 'einen', 'Stil,', 'der', 'unglaublich', 'kreativ', 'ist.', 'Du', 'hast', 'ja', 'Geschmack.']
P5 = [x for x in W if x[3] == 5]
i0 = next(i for i, x in enumerate(P5) if x[0] == 'Die')
for i, s in enumerate(TXT5):
    x = P5[i0 + i]
    d = (x[2] - x[1]) / max(1, len(s))
    for j in range(0, len(s), 2):
        add(x[1] + j * d, 'key.soft', 31 + (hash1(i * 5 + j) - .5) * 2, 'Kugelkopf')
    add(x[1], 'tick', 34, 'Kopf springt')
for k in range(3):
    add(cue(5, 'unglaublich') + k * .36, 'pen', 24, 'roter Strich')
tRoll = cue(5, 'Nur', 1) + .1
add(tRoll, 'paper', 23, 'Blatt rollt sich')
add(tRoll + .62, 'soft', 24, 'Blatt in der Kapsel')
add(tRoll + .84, 'stop', 25, 'Kapsel schnappt zu')
add(cue(6, 'in') - .35, 'move', 28, 'hinueber zur Fabrik')

# ---------------------------------------------------------------- Traumfabrik
add(cue(6, 'kaputt') - .2, 'scramble', 24, 'die Schrift zerfaellt')
add(cue(6, 'alles'), 'burst', 21, 'alles neu')
add(cue(6, 'alles') + .2, 'scramble', 26, 'alles neu')
add(cue(6, 'Hier', 0) + .05, 'move', 30, 'zurueck ins Haus')
# Code: schnell getippt, eine Zeile wird ueberschlagen, die Wand springt um.
typing(cue(6, 'Code'), cue(6, 'Ändere') - .1, 17, 29, 'Code auf dem Blatt', 'key.soft')
tS0 = cue(6, 'Zeile') - .2
typing(tS0, tS0 + .44, 22, 27, 'Zeile ueberschlagen', 'key')
tFlip = cue(6, 'ändert') - .03
typing(tS0 + .5, tFlip, 17, 28, 'neue Zeile', 'key.soft')
add(tFlip, 'lamp', 15, 'die Wand springt um')
add(tFlip, 'thud', 22, 'die Wand springt um')
tFire = cueE(6, 'Sache') + .28
add(tFire, 'capsule', 24, 'Rohrpost')
add(tFire + 1.5, 'stop', 25, 'Kapsel kommt an')

# ---------------------------------------------------------------- Daumenkino
tB0, tB1 = cue(7, 'Ein') - .4, cue(7, 'Aber', 1)


def rate(t):
    return mix(2.4, 30, smooth(cue(7, 'dreißig') - .3, cue(7, 'Sekunde'), t)) * (1 - smooth(tB1, tB1 + 1.2, t) * .92)


t = tB0
last_run = -9
i = 0
while t < tB1 + 1.4:
    r = rate(t)
    if r < 7:
        add(t, 'tick', 25 + (hash1(i) - .5) * 2, 'Seite')
    elif t - last_run > 1.45:
        add(t, 'riffle', 24, 'Daumenkino im Lauf')
        last_run = t
    t += 1 / max(r, 2.4)
    i += 1
# Der Zaehler tickt, solange man ihn sieht.
t = cue(7, 'Dieser') + .3
while t < cue(7, 'Aber', 1) + .1:
    add(t, 'flap', 35, 'Klappzaehler')
    t += 1 / 3
add(cue(7, 'Programm') - .1, 'switch', 24, 'Bildschirm an')

# ---------------------------------------------------------------- Der Regler
add(cue(9, 'zwölf', 0), 'soft', 24, 'Regler')
add(cue(9, 'drei', 0), 'soft', 24, 'Regler')

# ---------------------------------------------------------------- Die Kamera auf Schienen
tRigIn = cue(11, 'Ein')
add(tRigIn, 'roll', 27, 'Kamera rollt herein')
add(tRigIn, 'thud', 24, 'Kamera steht')
tF = [cue(11, 'Foto', 0), cue(11, 'Foto', 1), cue(11, 'Foto', 2)]
for t in tF:
    add(t, 'shutter', 21, 'Foto')
    add(t + .28, 'paper', 25, 'Abzug faellt')
tN, tDann = cue(11, 'Elftausend'), cue(11, 'Dann')
tEnd = tDann + 1.6
t = tN
i = 0
while t < tEnd:
    u = (t - tN) / (tEnd - tN)
    add(t, 'shutter', 25 + 3 * u + (hash1(i) - .5), 'elftausend Mal')
    t += mix(.34, .1, min(1, u * 2.2))
    i += 1
add(tEnd, 'thud', 22, 'Turm fertig')
tK = cue(11, 'klebt')
add(tK + .1, 'riffle', 25, 'Film laeuft durch')
add(tK + 1.55, 'riffle', 26, 'Film laeuft durch')

# ---------------------------------------------------------------- Der weisse Moment und die Lampen
tD = cue(12, 'Damit')
add(tD - .02, 'riser', 17, 'die Lampe wird weiss')
add(tD, 'boom', 14, 'weiss')
add(tD, 'sub', 15, 'weiss, Tiefbass')
LAMPS = [tD, cue(12, 'ist'), cue(12, 'Video'), cue(12, 'plötzlich'), cue(12, 'eine'), cue(12, 'Schreibaufgabe'), cue(12, 'Schreibaufgabe') + .32, cue(12, 'Und')]
for i, t in enumerate(LAMPS):
    add(t, 'lamp', 17 if i else 15, 'Lampe %d' % (i + 1))

# ---------------------------------------------------------------- Zeichensaal
add(SC['planung'] + .05, 'move', 28, 'hinauf in den Zeichensaal')
T0, TE = cue(13, 'jede'), cueE(13, 'Beleg')
for i in range(8):
    add(mix(T0, TE, i / 7.2) + .05, 'stamp', 22, 'Beleg')
tX = cue(13, 'zwei') - .32
add(tX, 'scratch', 24, 'Konzept gestrichen')
tOut = cue(13, 'fliegen')
add(tOut + .16, 'paper', 23, 'Konzept fliegt')
add(tOut + .28, 'paper', 25, 'Konzept fliegt')
tDrop = cue(13, 'nur') - .1
add(tDrop + .08, 'thud', 23, 'Drehbuch faellt')
add(tDrop + .2, 'thud', 25, 'Drehbuch faellt')

# ---------------------------------------------------------------- Tonstudio
add(SC['ton'] - .15, 'move', 28, 'ins Tonstudio')
add(cue(14, 'Diese') - .1, 'switch', 25, 'ON AIR')
add(cue(14, 'beide') - .2, 'whip', 29, 'zum Klavier')
add(cue(14, 'drücken') + .1, 'soft', 25, 'Tasten gehen von selbst')
add(cue(14, 'höre') - .25, 'whip', 27, 'zu den Kopfhoerern')
add(cue(14, 'Aber') + .1, 'whip', 29, 'zum Schreiber')
tHit = cue(14, 'DIESEM')
add(tHit - .8, 'roll', 25, 'Kugel auf der Bahn')
add(tHit - .02, 'roll', 22, 'Kugel auf der Bahn')
tb = cue(14, 'Darum')
span = tHit - tb
while tb < tHit - .04:
    u = (tb - cue(14, 'Darum')) / span
    add(tb, 'tick', 23 - 3 * u, 'Kugel ueber die Schwellen')
    tb += mix(.2, .075, u)
add(tHit - .01, 'gong.top', 22, 'Gong, Metall')

# ---------------------------------------------------------------- Schneideraum
for t in (cue(15, 'Bild', 0), cue(15, 'für'), cue(15, 'Bild', 1)):
    add(t, 'glass', 26, 'Lupe')
t0, t1 = cue(15, 'Nur') + .05, cueE(15, 'mir')
for i in range(0, 24, 3):
    add(mix(t0, t1, i / 24), 'scratch', 27, 'Haken')
for a, b in ((cue(16, 'Marlon'), cueE(16, 'nicht')), (cue(16, 'Häuser'), cueE(16, 'Luft')), (cue(16, 'wie'), cueE(16, 'gezeichnet')), (cue(16, 'viel'), cueE(16, 'laut')), (cue(16, 'Das'), cueE(16, 'Frau'))):
    t = a
    while t < b - .2:
        add(t, 'pen', 24, 'Fettstift')
        t += .62
tP = cue(17, 'kein') - .2
add(tP + .5, 'paper', 23, 'Abzuege weggeschoben')

# ---------------------------------------------------------------- Archiv
tCap = cue(18, 'jeder') + .25
add(tCap, 'capsule', 25, 'Rohrpost nach oben')
add(cue(18, 'zu') + .1, 'stop', 26, 'Kapsel oben')
add(cue(18, 'Aber') - .5, 'lamp', 26, 'Lampen im Archiv')
typing(cue(18, 'wurde') + .35, cueE(18, 'Regel') + .25, 6, 25, 'Karte wird getippt', 'key')
add(cue(18, 'Skill') - .04, 'lamp', 20, 'Schild geht an')
w0 = cue(18, 'nach') - .05
for k in range(3):
    add(w0 + k * .55, 'pen', 23, 'Tafel wird gewischt')
tDim = cue(18, 'vergesse')
for d in (.15, .65, 1.15):
    add(tDim + d, 'lamp.off', 24, 'Lampe aus')
tBack = cue(18, 'Jeder', 1) - .05
for d in (0, .45, .9):
    add(tBack + d, 'lamp', 18, 'Lampe wieder an')
tW0 = cue(18, 'Jeder', 1) - .1
for i in range(3):
    t = tW0 + .6 + i * 1.15
    add(t, 'tick', 25, 'Karte am Seil')
    add(t + .18, 'paper', 28, 'Karte')

# ---------------------------------------------------------------- Kino
add(SC['du'], 'move', 29, 'hinunter ins Kino')
tSag = cue(20, 'Sag')
typing(tSag - .35, tSag + .45, 7, 25, 'Installiere HyperFrames')
for i in range(4):
    add(cue(20, 'welche', 1) + i * .24 + .1, 'switch', 27, 'Schalter: ich selbst')
typing(cue(20, 'Ich', 1), cue(20, 'Ich', 1) + .85, 8, 27, 'Ich arbeite daran')
tTi, tV, tL1, tL2, tL3, tSh, tL4, tL4e = cue(21, 'Tippen'), cue(21, 'Vier'), cue(21, 'Was', 1), cue(21, 'Für'), cue(21, 'Wie'), cue(21, 'Beispielbildern'), cue(21, 'Und'), cueE(21, 'ungefähr')
for a, b in ((tTi + .15, tV + .25), (tL1, tL2 - .55), (tL2, tL3 - .1), (tL3, tSh - .1), (tL4, tL4e)):
    typing(a, b, 5.5, 28, 'die Mitschrift', 'key.soft')
for k in range(3):
    add(tSh - .1 + k * .09, 'soft', 25, 'Beispielbild')
for w in ('Schrift', 'Farbe', 'Code'):
    add(cue(22, w) + .06, 'scratch', 20, 'gestrichen')
tGut = cue(22, 'Und')
typing(tGut + .15, cueE(22, 'soll') - .05, 8, 26, 'Und mach es richtig gut.')
tZu = cue(23, 'Zu')
typing(tZu, tZu + .45, 8, 25, 'Zu kindisch.')
add(tZu + .02, 'pen', 20, 'Zu kindisch')
for k in range(3):
    add(cue(23, 'Das', 1) + k * .22, 'soft', 26, 'Entwurf')

# ---------------------------------------------------------------- Botschaft und Abspann
add(cue(24, 'Wer') + 1.2, 'move', 31, 'die Kamera zieht zurueck')
add(cue(24, 'passt'), 'wind', 28, 'wieder draussen')
add(cue(24, 'machen'), 'wind', 30, 'wieder draussen')
# Dieselben Zeiten wie im Bild: jeder Buchstabe auf seinem Wort.
for w, n in (('Videos', 6), ('aus', 3), ('Code', 4)):
    a_, b_ = cue(24, w), cueE(24, w)
    for k in range(n):
        add(a_ + k / n * max(.12, b_ - a_ - .08), 'neon', 25, 'Dachschrift')
cA = DUR - 5.9
add(cA - .3, 'paper', 23, 'neues Blatt rollt heraus')
add(cA, 'typerun', 27, 'Titelseite')
add(cA + 1.3, 'typerun', 28, 'Titelseite')
CR = ['Videos aus Code.', '', 'Bild:    Claude', 'Regie:   Claude', 'Stimme:  Gemini', 'Musik:   Lyria', 'Klang:   Earshot', 'Urteil:  Marlon']
tc = 0
for ln in CR:
    tc += len(ln) * .026 + .1
# Wie in schreib.js: letzter Buchstabe plus .75 s.
tSiegel = tc - .1 - .026 + .75
add(cA + tc + .05, 'bell', 25, 'fertig')
# Das Siegel landet kurz nach der letzten Zeile.
add(cA + tSiegel, 'stamp', 23, 'Siegel')

out.sort(key=lambda c: c['frame'])
for c in out:
    c['under'] = round(c['under'], 1)
json.dump({'under': 24, 'cues': out}, open(os.path.join(ROOT, 'sfx.json'), 'w', encoding='utf8', newline=''), ensure_ascii=False, indent=0)
print(len(out), 'Einsaetze')

# In video.json legen. 'superint-video sfx place' rechnet genauso, schreibt aber das Projekt nach jedem Clip neu
# und braucht bei so vielen Einsaetzen ueber zehn Minuten.
VOICE_LUFS = json.load(open(os.path.join(ROOT, 'audio', 'master.json'), encoding='utf8'))['buses']['voice']['integratedLufs']
lock = json.load(open(os.path.join(ROOT, 'audio', 'sfx', 'kit.lock.json'), encoding='utf8'))['roles']
turn = {}
clips = []
for i, c in enumerate(out):
    role = lock[c['role']]
    k = turn.get(c['role'], 0)
    turn[c['role']] = k + 1
    take = role['takes'][k % len(role['takes'])]
    sync = {'onset': take['onset_s'], 'peak': take['peak_s'], 'end': take['end_s']}[role['align']]
    gain_db = VOICE_LUFS - c['under'] - take['lufs_m_max']
    start = max(0, c['frame'] - int(round(sync * 30)))
    dur = max(1, int(take['dur_s'] * 30))
    if start + dur > FILMF:
        dur = FILMF - start
    clips.append({'id': 'sfx-%03d-%s' % (i + 1, c['role'].replace('.', '-')), 'type': 'audio', 'src': 'audio/sfx/' + take['file'], 'track': 'sfx', 'startFrame': start, 'durationFrames': dur, 'sourceOffsetFrames': 0, 'gain': 10 ** (gain_db / 20)})
p = os.path.join(ROOT, 'video.json')
v = json.load(open(p, encoding='utf8'))
v['clips'] = [c for c in v['clips'] if not c['id'].startswith('sfx-')] + clips
json.dump(v, open(p, 'w', encoding='utf8', newline=''), ensure_ascii=False, indent=2)
print(len(clips), 'Clips auf der sfx-Spur')
