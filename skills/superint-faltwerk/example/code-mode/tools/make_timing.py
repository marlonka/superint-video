# Writes scenes/timing.js from process/timing.json (the voice's measured paragraph and word times),
# and process/turns.json: when each leaf turns and each spread lands, for the sound effects.
import json, re
from pathlib import Path
P = Path(__file__).resolve().parent.parent
t = json.loads((P / 'process/timing.json').read_text(encoding='utf8'))
HOLD = {1: .25, 2: 1.2, 3: 2.0}   # 1: the title page turns 0.4 s after "Zukunft?", so the question is not lost in the paper
t['hold'] = {str(k): v for k, v in HOLD.items()}
(P / 'scenes/timing.js').write_text('// Written by tools/make_timing.py from process/timing.json. Do not edit.\nexport const TIMING = ' + json.dumps(t, ensure_ascii=False, indent=1) + ';\n', encoding='utf8', newline='\n')
L = int(re.search(r'LEAVES\s*=\s*(\d+)', (P / 'scenes/plan.js').read_text(encoding='utf8')).group(1))
DUR = [2.2 if j == 0 else 1.9 if j == 1 else 2.5 if j == L - 1 else 2.3 for j in range(L)]
par = {p['spread']: p for p in t['paragraphs']}
# Leaf j waits this much longer after its paragraph: something on the spread is still being read.
# The voice waits as long (PAUSES in pauses.py, at the end of that paragraph). HOLD stands above; timeline.js reads it from timing.js.
turns, prev = [], 0.0
at = t.get('turnAt', {})
for j, d in enumerate(DUR):
    t0 = at[str(j)] if str(j) in at else par[j]['end'] + (5.2 if j == L - 1 else .15) + HOLD.get(j, 0) if j in par else (1.6 if j == 0 else prev + (1.4 if j < 2 else 3))
    turns.append({'leaf': j, 't0': round(t0, 3), 'dur': d, 'lands': round(t0 + d, 3)}); prev = t0 + d
end = turns[-1]['lands'] + 2.6
(P / 'process/turns.json').write_text(json.dumps({'turns': turns, 'end': round(end, 3), 'frames': round(end * 30)}, indent=1), encoding='utf8', newline='\n')
print('turns', [(x['leaf'], x['t0']) for x in turns], 'end', round(end, 2), 'frames', round(end * 30))
