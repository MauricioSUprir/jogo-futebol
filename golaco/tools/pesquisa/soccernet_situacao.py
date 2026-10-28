# Replays nas paradas (28/10; PESQUISA-CENAS-TV.md §4 "Por situação"; a tabela TV_SIT do tools/teste-replay-paradas.mjs):
# nos rótulos públicos do SoccerNet-v2 (https://huggingface.co/datasets/SoccerNet/SN-Labels — Labels-v2.json e
# Labels-cameras.json de cada jogo; 498 jogos com os dois), a fração das paradas com um plano de replay entre o lance que
# parou a bola e o recomeço (replay em [apito − 1 s, recomeço + 1 s); sem gol nem impedimento), separada pelo que veio
# antes: cartão entre o apito e o recomeço (apito − 1 s .. recomeço) e chute ("Shots on/off target") nos 15 s antes do
# apito (apito − 15 s .. apito + 0,5 s). Também a causa do tiro livre (Foul × Ball out of play). Intervalo de Wilson 95%.
# Uso: python3 -I tools/pesquisa/soccernet_situacao.py <pasta com os jogos (Labels-v2.json + Labels-cameras.json)>
import json, glob, os, sys, collections, math
raiz = sys.argv[1]
jogos = sorted(set(os.path.dirname(f) for f in glob.glob(os.path.join(raiz, '**/Labels-cameras.json'), recursive=True)))
REC = {'Throw-in', 'Corner', 'Clearance', 'Indirect free-kick', 'Direct free-kick', 'Penalty'}
CART = {'Yellow card', 'Red card', 'Yellow->red card'}
n = collections.Counter(); r = collections.Counter(); jg = 0
def wilson(k, nn, z=1.96):
    if not nn: return (0, 0)
    p = k / nn; d = 1 + z * z / nn; c = (p + z * z / (2 * nn)) / d; h = z * math.sqrt(p * (1 - p) / nn + z * z / (4 * nn * nn)) / d
    return (c - h, c + h)
for g in jogos:
    v2p = os.path.join(g, 'Labels-v2.json')
    if not os.path.exists(v2p): continue
    jg += 1
    cam = json.load(open(os.path.join(g, 'Labels-cameras.json'))); v2 = json.load(open(v2p))
    acs = sorted((int(a['gameTime'].split(' - ')[0]), int(a['position']) / 1000, a['label']) for a in v2['annotations'])
    reps = collections.defaultdict(list)
    for c in cam['annotations']:
        if c.get('replay') == 'replay': reps[int(c['gameTime'].split(' - ')[0])].append(int(c['position']) / 1000)
    for i, (h, t, lab) in enumerate(acs):
        if lab not in REC: continue
        prev = [(tt, ll) for (hh, tt, ll) in acs[max(0, i - 10):i] if hh == h and 0 <= t - tt <= 120 and ll in ('Ball out of play', 'Foul', 'Offside', 'Goal')]
        if not prev or prev[-1][1] in ('Goal', 'Offside'): continue
        t0, mot = prev[-1]
        entre = [ll for (hh, tt, ll) in acs[max(0, i - 12):i] if hh == h and t0 - 1 <= tt <= t]
        card = any(x in CART for x in entre)
        antes = [ll for (hh, tt, ll) in acs[max(0, i - 12):i] if hh == h and t0 - 15 <= tt <= t0 + 0.5]
        chute = any(x in ('Shots on target', 'Shots off target') for x in antes)
        rr = any(t0 - 1 <= p < t + 1 for p in reps[h])
        chaves = [f'{lab} | cartão {"S" if card else "N"} | chute {"S" if chute else "N"}',
                  f'{lab} | cartão {"S" if card else "N"}', f'{lab} | chute {"S" if chute else "N"}', f'{lab} | (todos)']
        if lab in ('Direct free-kick', 'Indirect free-kick'):
            chaves.append(f'{lab} | cartão {"S" if card else "N"} | após {mot}')
        for k in chaves: n[k] += 1; r[k] += rr
print(f'{jg} jogos')
for k in sorted(n):
    lo, hi = wilson(r[k], n[k])
    print(f'{k:62s} n {n[k]:6d} replay {r[k]:6d} {100*r[k]/n[k]:5.1f}%  [{100*lo:4.1f}–{100*hi:4.1f}]')
