# Replays nas paradas — QUANTO DURAM na TV (28/10; PLANO-CENAS.md §2.7, o orçamento do ar): nos rótulos públicos do
# SoccerNet-v2 (https://huggingface.co/datasets/SoccerNet/SN-Labels — Labels-v2.json e Labels-cameras.json de cada jogo;
# 498 jogos com os dois), a soma dos planos de replay de cada parada COM replay (o plano começa em [apito − 1 s, recomeço +
# 1 s), como em soccernet_situacao.py; sem gol nem impedimento), pelo recomeço × a situação (cartão entre o apito e o
# recomeço; senão chute nos 15 s antes do apito; senão nada). Cada plano dura até a troca de câmera seguinte do mesmo
# tempo (descarta ≥ 60 s): a média dos planos sai acima dos 6,8 s do artigo (Deliège et al. 2021) — vale a mediana.
# Uso: python3 -I tools/pesquisa/soccernet_duracao.py <pasta com os jogos (Labels-v2.json + Labels-cameras.json)>
import json, glob, os, sys, collections, statistics as st
raiz = sys.argv[1]
jogos = sorted(set(os.path.dirname(f) for f in glob.glob(os.path.join(raiz, '**/Labels-cameras.json'), recursive=True)))
REC = {'Throw-in', 'Corner', 'Clearance', 'Indirect free-kick', 'Direct free-kick', 'Penalty'}
CART = {'Yellow card', 'Red card', 'Yellow->red card'}
tot = collections.defaultdict(list); planos = collections.defaultdict(list); jg = 0
todos = []
for g in jogos:
    v2p = os.path.join(g, 'Labels-v2.json')
    if not os.path.exists(v2p): continue
    jg += 1
    cam = json.load(open(os.path.join(g, 'Labels-cameras.json'))); v2 = json.load(open(v2p))
    acs = sorted((int(a['gameTime'].split(' - ')[0]), int(a['position']) / 1000, a['label']) for a in v2['annotations'])
    cs = sorted((int(c['gameTime'].split(' - ')[0]), int(c['position']) / 1000, c.get('replay')) for c in cam['annotations'])
    reps = collections.defaultdict(list)
    for i, (h, p, rp) in enumerate(cs):
        if rp != 'replay' or i + 1 >= len(cs) or cs[i + 1][0] != h: continue
        d = cs[i + 1][1] - p
        if 0 < d < 60: reps[h].append((p, d)); todos.append(d)
    for i, (h, t, lab) in enumerate(acs):
        if lab not in REC: continue
        prev = [(tt, ll) for (hh, tt, ll) in acs[max(0, i - 10):i] if hh == h and 0 <= t - tt <= 120 and ll in ('Ball out of play', 'Foul', 'Offside', 'Goal')]
        if not prev or prev[-1][1] in ('Goal', 'Offside'): continue
        t0 = prev[-1][0]
        entre = [ll for (hh, tt, ll) in acs[max(0, i - 12):i] if hh == h and t0 - 1 <= tt <= t]
        antes = [ll for (hh, tt, ll) in acs[max(0, i - 12):i] if hh == h and t0 - 15 <= tt <= t0 + 0.5]
        ps = [d for (p, d) in reps[h] if t0 - 1 <= p < t + 1]
        if not ps: continue
        sit = 'cartão' if any(x in CART for x in entre) else 'chute' if any(x in ('Shots on target', 'Shots off target') for x in antes) else 'nada'
        for k in (f'{lab} | {sit}', f'(todas) | {sit}', '(todas)'):
            tot[k].append(sum(ps)); planos[k].append(len(ps))
print(f'{jg} jogos; planos de replay: {len(todos)}, média {st.mean(todos):.2f} s, mediana {st.median(todos):.2f} s')
for k in sorted(tot):
    v = sorted(tot[k]); q = lambda f: v[min(len(v) - 1, int(f * len(v)))]
    print(f'{k:36s} n {len(v):5d}  replay na parada: mediana {st.median(v):5.2f} s (p25 {q(.25):5.2f}, p75 {q(.75):5.2f}; média {st.mean(v):5.2f})  planos {st.mean(planos[k]):.2f}')
