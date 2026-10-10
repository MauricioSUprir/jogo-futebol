# A "agressão" do teste-pressao (recepção de passe com um adversário de linha a ≤ 4,6 m em ≤ 2 s)
# medida com a MESMA definição no rastreamento aberto da Metrica (Sample Game 1 e 2, 25 Hz).
# Uso: python3 -I tools/pesquisa/agressao_metrica.py <pasta-com-os-csv>
# (Etapa 3, integração: a faixa 19–29% do plano é a da StatsBomb, que conta eventos de pressão; com a
# definição do teste — proximidade — o jogo real dá 68,0%. Ver tools/teste-pressao.mjs.)
import sys
import numpy as np
import pandas as pd

PASTA = sys.argv[1]
L, W, FPS = 105.0, 68.0, 25


def carrega_time(arq):
    df = pd.read_csv(arq, skiprows=2)
    cols = list(df.columns)
    ren = {}
    for i, c in enumerate(cols):
        if c.startswith('Player') or c == 'Ball':
            ren[c] = c + '_x'
            ren[cols[i + 1]] = c + '_y'
    df = df.rename(columns=ren)
    jog = [c[:-2] for c in df.columns if c.endswith('_x') and c.startswith('Player')]
    X = np.stack([df[j + '_x'].values for j in jog], 1)
    Y = np.stack([df[j + '_y'].values for j in jog], 1)
    return df['Period'].values, df['Frame'].values, jog, (X - 0.5) * L, -(Y - 0.5) * W


tot = {'n': 0, 'agr': 0, 'agr46na': 0, 'agr_terco': {1: [0, 0], 2: [0, 0], 3: [0, 0]}, 'd0': [], 'dmin': []}
for g in (1, 2):
    per, fr, jogC, xC, yC = carrega_time(f'{PASTA}/g{g}_RawTrackingData_Home_Team.csv')
    _, fr2, jogF, xF, yF = carrega_time(f'{PASTA}/g{g}_RawTrackingData_Away_Team.csv')
    n = min(len(fr), len(fr2))
    times = [(jogC, xC[:n], yC[:n]), (jogF, xF[:n], yF[:n])]
    gk, dirs = [], []
    for t, (jog, x, y) in enumerate(times):
        m1 = per[:n] == 1
        mx = np.nanmean(x[m1], 0)
        k = int(np.nanargmax(np.abs(mx)))
        gk.append(k)
        # sentido do ataque no 1º tempo: o goleiro defende o lado dele
        dirs.append(-np.sign(mx[k]))
    ev = pd.read_csv(f'{PASTA}/g{g}_RawEventsData.csv')
    fr2i = {int(v): i for i, v in enumerate(fr[:n])}
    for _, e in ev[ev['Type'] == 'PASS'].iterrows():
        tm = 0 if e['Team'] == 'Home' else 1
        rec = e['To']
        jog, x, y = times[tm]
        _, xA, yA = times[1 - tm]
        if not isinstance(rec, str) or rec not in jog:
            continue
        i = jog.index(rec)
        k = fr2i.get(int(e['End Frame']))
        if k is None or k + 2 * FPS >= n or np.isnan(x[k, i]):
            continue
        sel = [q for q in range(len(times[1 - tm][0])) if q != gk[1 - tm]]
        dmin, d0 = 1e9, None
        for s in range(0, 2 * FPS + 1):
            dq = np.hypot(xA[k + s, sel] - x[k + s, i], yA[k + s, sel] - y[k + s, i])
            if np.all(np.isnan(dq)):
                continue
            v = np.nanmin(dq)
            if s == 0:
                d0 = v
            dmin = min(dmin, v)
        if d0 is None:
            continue
        d = dirs[tm] * (1 if per[k] == 1 else -1)
        u = x[k, i] * d
        terco = 1 if u < -17.5 else 3 if u >= 17.5 else 2
        tot['n'] += 1
        tot['d0'].append(d0)
        tot['dmin'].append(dmin)
        tot['agr_terco'][terco][1] += 1
        if dmin <= 4.6:
            tot['agr'] += 1
            tot['agr_terco'][terco][0] += 1
        if d0 <= 4.6:
            tot['agr46na'] += 1
pc = lambda a, b: f'{100 * a / max(b, 1):.1f}%'
print(f"recepções de passe: {tot['n']}")
print(f"adversário de linha a ≤ 4,6 m em ≤ 2 s (definição do teste-pressao): {pc(tot['agr'], tot['n'])}")
print(f"já a ≤ 4,6 m na recepção: {pc(tot['agr46na'], tot['n'])}")
print('por terço do recebedor (t1/t2/t3): ' + ' · '.join(f"{pc(a, b)} de {b}" for a, b in tot['agr_terco'].values()))
d0, dm = np.array(tot['d0']), np.array(tot['dmin'])
print(f'distância do mais perto na recepção: mediana {np.median(d0):.1f} m; mínimo em 2 s: mediana {np.median(dm):.1f} m')
for lim in (2, 3, 4.6, 6, 8):
    print(f'  mínimo em 2 s ≤ {lim} m: {pc(np.sum(dm <= lim), len(dm))}')
