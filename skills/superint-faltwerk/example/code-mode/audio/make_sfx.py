# Writes sfx.json from process/turns.json (the leaf beats) and process/timing.json (the moments); run in the project.
# The event times follow the scene code (scenes/spreads/s01-s07, scenes/hall.js): spread time = film time - the landing
# of the leaf before it. Round 2 (24.11.2026): new opening (the cover lifts at once, the title page has its own pop-up)
# and new ending (index cards, booklet and message card on spread 7); spreads 2-6 as in round 1, moved.
import json
FPS = 30
T = json.load(open('process/turns.json', encoding='utf-8'))['turns']
M = json.load(open('process/timing.json', encoding='utf-8'))['moments']
fr = lambda s: int(round(s * FPS))
leaf = {t['leaf']: t for t in T}
cues = []
def cue(sec, role, under, note=None, take=None, layer=False):
    c = {'frame': fr(sec), 'role': role, 'under': under}
    if take: c['take'] = take
    if layer: c['layer'] = True
    if note: c['note'] = note
    cues.append(c)

# easeTurn 2.1u^2 - 1.1u^3: fastest at u = 0.636, half way (90 degrees) at u = 0.585
FAST, HALF = 0.55, 0.585
# ---- leaf 0, the cover. It now lifts while the voice speaks and lands on "er" (between "Ersetzt" and "MCP"), together
# with the music's second swell; the levels of round 1 (a low thud: the word's consonants stay free).
l = leaf[0]
cue(l['t0'] + 0.12, 'cover.open', 30, 'Blatt 0: der Einband löst sich vom Buchblock')
cue(l['lands'] + 0.02, 'cover.thud', 23.5, 'Blatt 0 liegt: weicher Schlag des Einbands')
cue(l['lands'] + 0.02, 'cover.slap', 25, 'die Deckelkante', layer=True)
cue(l['lands'] + 0.02, 'air', 30, 'die Luft unter dem Einband', take=1, layer=True)

# ---- the title page's pop-up (s01_titel.js). Only what carries, and quiet: the three plugs (the sound comes back on
# spread 3), the long listing of the usual way and the small slip of Code Mode, each in a pause of the voice where it can.
# Silent: the call card (under "Werkzeuge"), the brass plate "KI" and the program card (on their words), the three calls
# and their results (under "aufruft" and "Die KI selbst"), the printed line.
P = M['1']
for k in range(3):
    # plug k stands up at stecker + 0.1 + 0.3 k and slides into its socket from 0.45 s, seated at 0.70 s; on "MCP, den"
    cue(P['stecker'] + .1 + .3 * k + .68, 'plug', 30.5 + .5 * k, f'Titelblatt stecker: Stecker {k + 1} von 3 sitzt', take=k + 1)
d0 = P['direkt'] + .05; l0 = d0 + 1.0; lEnd = l0 + 1.05
# the listing's second leg (agent -> the KI's slot) runs l0 + 0.55 .. lEnd: its fastest point, in the pause after "Nein"
cue((l0 + .55 + lEnd) / 2, 'glide', 26, 'Titelblatt direkt: der lange Streifen Endlospapier gleitet über den Agenten in die KI')
c0 = P['aufrufe'] + .05; back2 = c0 + 2 * .3 + 2.0
slip0 = max(P['endergebnis'] - .1, back2 + .3); slipIn = slip0 + .95
# its fastest point is at 20.70, inside "Endergebnis"; the flick's peak waits for the word's end (20.84), just before the slot
cue(slipIn - .09, 'slip', 24, 'Titelblatt endergebnis: der kleine Zettel gleitet in die KI')

# ---- leaf 1, the thin title page
l = leaf[1]
cue(l['t0'] + FAST * l['dur'], 'sheet', 25, 'Blatt 1: das dünne Titelblatt')
# ---- boards 2-6: swing, stand-up in the second half, lock at lands + 0.06; materials and takes alternate
plan = {2: ('turn', 1, 'standup', 1, 'lock', 1, 1), 3: ('turn.b', 1, 'standup.b', 1, 'lock.c', 1, None),
        4: ('turn', 2, 'standup', 2, 'lock.b', 1, None), 5: ('turn.b', 2, 'standup.b', 2, 'lock', 2, 2),
        6: ('turn', 3, 'standup', 3, 'lock.c', 2, None)}
for n in range(2, 7):
    l = leaf[n]; tr, tt, su, st, lk, lt, ck = plan[n]
    q = {4: 2, 5: 2}.get(n, 0)   # leaves 4 and 5 land 0.15 s before the voice ("Im", "Bei"): the knock stays out of the word
    cue(l['t0'] + FAST * l['dur'], tr, 24, f'Blatt {n}: die Karte schwingt um', take=tt)
    cue(l['t0'] + (HALF + 0.095) * l['dur'], su, 27, f'Blatt {n}: die Szene richtet sich auf', take=st)
    cue(l['lands'] + 0.06, lk, 24 + q, f'Blatt {n}: die Szene rastet ein', take=lt)
    if ck:
        cue(l['lands'] + 0.06 + 1 / FPS, 'click', 31 + q, 'die Lasche sitzt', take=ck, layer=True)
# ---- leaf 7, the back cover
l = leaf[7]
cue(l['t0'] + 0.12, 'cover.close', 26, 'Blatt 7: der Rückdeckel löst sich')
# The final chord holds through the fall (round 2), so the shut sits 2 dB higher than in round 1 (critic: "etwas zaghaft").
cue(l['lands'] + 0.02, 'book.shut', 19, 'das Buch ist zu: weicher, voller Schlag')
cue(l['lands'] + 0.02, 'book.slap', 20.5, 'die Deckel treffen sich', layer=True)   # the klack leads, or the thud reads as a drum
cue(l['lands'] + 0.02, 'air', 28, 'die Luft, die das Buch herausdrückt', take=2, layer=True)

# ---- events, only where something audible happens. Under the voice they sit 6 dB higher than the leaf beats' quietest
# layers: at 31-35 dB under the voice around them (50 ms against 400 ms) the critic heard none of them.
# spread 3: RECHNUNGEN and TABELLE plug in on "MCP" (mcp + 0.2 + 0.4 k), the other five on "Mail" (mail + 0.4 (k - 2));
# each plug slides into its plate from 0.45 s and is seated at 0.70 s (hall.js)
for k in range(7):
    t0 = M['3']['mcp'] + .2 + .4 * k if k < 2 else M['3']['mail'] + .4 * (k - 2)
    cue(t0 + 0.68, 'plug', 27 + (0.5 if k % 2 else 0) + (1 if k == 6 else 0),
        f'Doppelseite 3 {"mcp" if k < 2 else "mail"}: Stecker {k + 1} von 7 sitzt in seiner Platte', take=k % 4 + 1)
# The zweite tick goes one frame early, onto the end of "die": on the /ts/ of "zweite" it was masked.
# spread 4: the flap over the round counter swings open on "Runde" (0.5 s); the digit turns on "zweite" and 0.15 s
# after "dritten"
cue(M['4']['runde'] + 0.03, 'flap', 25, 'Doppelseite 4 runde: die Messingklappe über dem Rundenzähler klappt auf')
cue(M['4']['zweite'] - 1 / FPS, 'tick', 25, 'Doppelseite 4 zweite: der Zähler springt auf 2', take=1)
cue(M['4']['dritte'] + 0.15, 'tick', 25, 'Doppelseite 4 dritte: der Zähler springt auf 3', take=2)

# spread 5 (s05_codemode.js, spread time from leaf 4's landing): the same counter steps at r2 + 0.1 and r3 + 0.15, the
# sandbox wall stands at sbUp, its frame 0.2 s later, upright 0.29 s after that (standUp: 1 - e^-4.5k cos 5.5k).
# journey(): every hop adds its seconds, a change of page side 0.25 s more; slotPass and passInlet lie right, the rest left.
o5 = leaf[4]['lands']
t5 = {k: v - o5 for k, v in M['5'].items()}
def journey(t0, hops):
    t, side = t0, None
    for sd, d in hops:
        if side and sd != side: t += .25
        t += d; side = sd
    return t
r1 = max(.1, t5['nachschlagen'] - .85)
ask = journey(max(r1 + .5, t5['nachschlagen']), [('R', .5), ('L', .45), ('L', .4)])
ts = journey(ask + 2.0 + .1, [('L', .5), ('L', .6), ('R', .7)])
r2 = max(ts + .1, t5['programm'] - 1.2); out = r2 + 1.2
hold = min(5.2, max(3.5, t5['sandbox'] - out - .9)); lie = out + hold
sbUp = max(t5['sandbox'], lie + 2.0)
tile = journey(sbUp - 1.85, [('R', .7), ('L', .6), ('L', .8)])
c1 = journey(max(t5['aufrufe'], tile + .5), [('L', .7), ('L', .7)])
l1 = journey(c1 + .25, [('L', .8), ('L', .7)])
c2 = journey(l1 + 1.0, [('L', .7), ('L', .8)])
c3 = journey(c2 + .2, [('L', .7), ('L', .8)])
res = journey(max(t5['zeile'], c3 + .3), [('L', .7), ('L', .6), ('R', .7)])
r3 = res + .1
cue(o5 + r2 + .1, 'tick', 25, 'Doppelseite 5: der Zähler springt auf 2 (das Programm)', take=3)
cue(o5 + sbUp, 'standup', 23, 'Doppelseite 5 sandbox: die Sandbox richtet sich auf (das hellere Papier: das dunklere ging im "abgeschottet" unter)', take=5)
cue(o5 + sbUp + 0.2 + 0.29, 'lock', 26, 'ihr Rahmen steht', take=3)
cue(o5 + r3 + .15, 'tick', 25, 'Doppelseite 5 zeile: die eine Zeile ist durch die Luke, der Zähler springt auf 3', take=4)

# ---- spread 7 (s07_kommt.js): three index cards stand on their names (rise: upright 0.29 s after it starts), the MCP
# booklet's cover lifts on "MCP" (upright after 0.40 s), the message card rises on "Ende". All of it on words, so nothing
# with a body loud enough to cover them: a rustle or a knock there was 10-19 dB under the voice in every band. Every card
# gets the small cardboard click (4-8 kHz, where the voice leaves room) when it stands, 23-24 dB under the voice (at 26-28
# it was still masked on "Cloudflare", "andere" and "Ende"); the message card its rustle too.
# Silent: the monitor (tabelle) and the laptop (claude) light up, the index cards lie down again, lines 2 and 3 of the
# card are printed on their words (gross, zukunft).
S7 = M['7']
for k, (name, word) in enumerate([('cloudflare', 'Cloudflare'), ('anthropic', 'Anthropic'), ('andere', 'Andere Agenten')]):
    cue(S7[name] + .29, 'click', 24, f'Doppelseite 7 {name}: die Karteikarte „{word}“ steht', take=(2, 3, 1)[k])
cue(S7['mcp'] + .02, 'cover.open', 29, 'Doppelseite 7 mcp: der Deckel des MCP-Hefts hebt sich')
# The card rises empty 1.2 s before "Ende" (s07_kommt.js msgUp), so it stands when the camera arrives.
cue(S7['botschaft'] - 1.2, 'standup', 26, 'Doppelseite 7: die Botschaftskarte richtet sich leer auf, kurz vor „Ende“', take=4)
cue(S7['botschaft'] - 1.2 + 0.29, 'click', 23, 'die Karte steht', take=3)
cues.sort(key=lambda c: (c['frame'], c.get('layer', False)))
json.dump({'under': 26, 'cues': cues}, open('sfx.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
for c in cues: print(c['frame'], round(c['frame'] / FPS, 2), c['role'], c['under'], c.get('take', ''), 'L' if c.get('layer') else '')
print(len(cues), 'cues', sum(1 for c in cues if not c.get('layer')), 'hits')
