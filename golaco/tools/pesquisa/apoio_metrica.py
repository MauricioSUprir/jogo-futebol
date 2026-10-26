# Apoio ao portador na Metrica (D7, item 24; PESQUISA-CATEGORIA-D.md §9): a conta do teste-apoio — companheiros a ≤ 30 m à
# frente (< 60°) / de lado / atrás (> 120°) — por FAIXA de 10 m do portador e por FUNÇÃO de quem conduz. A função sai da
# posição média com a bola: os 4 mais recuados = defesa (dos 4, os 2 mais abertos = laterais), os 3 mais adiantados = ataque,
# o resto = meio. Portador = o de linha mais perto da bola, a ≤ 1 m, do time com a posse (o goleiro não conta).
#   python3 -I tools/pesquisa/apoio_metrica.py <pasta-com-os-csv> [saida.json]
# A saída JSON (faixa → [n, frente, lado, atrás, à frente por instante, avanço mediano, mais à frente, ≥ 5 m à frente]) é a
# tabela METRICA de tools/apoio-faixa.mjs.
import sys, os, runpy, io, contextlib, json, math
import numpy as np

pasta = sys.argv[1]
saida = sys.argv[2] if len(sys.argv) > 2 else None
aqui = os.path.dirname(os.path.abspath(__file__))
sys.argv = ['analise_metrica.py', pasta]
with contextlib.redirect_stdout(io.StringIO()):
    g = runpy.run_path(os.path.join(aqui, 'analise_metrica.py'), run_name='__main__')
jogos = g['jogos']

# ---------------------------------------------------------------- função de cada titular (pela posição média com a bola)
for J in jogos:
    for t in (0, 1):
        jog, x, y = J['times'][t]
        gk = J['info'][t]['gk']
        com = (J['pos'] == t) & J['em_jogo']
        d = J['info'][t]['dir']
        u = x * d[:, None]; w = y * d[:, None]
        mu = np.nanmean(u[com], 0); mw = np.nanmean(np.abs(w[com]), 0)
        idx = [i for i in range(len(jog)) if i != gk and not np.isnan(mu[i])]
        pres = np.sum(~np.isnan(u[com]), 0)
        idx = sorted(idx, key=lambda i: -pres[i])[:10]   # os 10 com mais quadros
        ordem = sorted(idx, key=lambda i: mu[i])
        defe, mei, ata = ordem[:4], ordem[4:7], ordem[-3:]
        lat = sorted(defe, key=lambda i: -mw[i])[:2]
        fun = {}
        for i in defe: fun[i] = 'LAT' if i in lat else 'ZAG'
        for i in mei: fun[i] = 'MEI'
        for i in ata: fun[i] = 'ATA'
        J.setdefault('fun', {})[t] = fun

fx, dfr, por, mix = {}, {}, {}, {}
for J in jogos:
    for f in np.where(J['em_jogo'])[0][::5]:
        t = J['pos'][f]
        jog, x, y = J['times'][t]
        d = J['info'][t]['dir'][f]
        gk = J['info'][t]['gk']
        b = np.array([J['bx'][f], J['by'][f]])
        P = np.stack([x[f], y[f]], 1); ok = ~np.isnan(P[:, 0])
        dP = np.hypot(*(P - b).T); dP[~ok] = 1e9
        c = int(np.argmin(dP))
        if dP[c] > 1.0 or c == gk: continue
        car = P[c]; ub = car[0] * d
        k = max(0, min(10, int(np.floor((ub + 52.5) / 10))))
        r = fx.setdefault(k, [0, 0, 0, 0, 0, 0])
        r[3] += 1
        us = [P[i][0] * d for i in range(len(jog)) if ok[i] and i != c and i != gk]
        r[4] += sum(1 for v in us if v > ub)
        r[5] += sum(1 for v in us if v > ub + 5)
        for i in range(len(jog)):
            if not ok[i] or i == c or i == gk: continue
            lane = P[i] - car; di = np.hypot(*lane)
            if di > 30 or di < 1e-6: continue
            a = math.degrees(math.atan2(abs(lane[1]), lane[0] * d))
            r[0 if a < 60 else (1 if a < 120 else 2)] += 1
            if a < 60: dfr.setdefault(k, []).append(lane[0] * d)
        fc = J['fun'][t].get(c)
        mx = mix.setdefault(k, {}); mx[fc or '?'] = mx.get(fc or '?', 0) + 1
        # por função de quem conduz, com a bola de −2,5 a +17,5 (as faixas 2,5 e 12,5)
        if fc is None or k not in (5, 6): continue
        for i, fn in J['fun'][t].items():
            if i == c or not ok[i]: continue
            du = (P[i][0] - P[c][0]) * d; dw = abs(P[i][1] - P[c][1]); di = math.hypot(du, dw)
            q = por.setdefault((fc, fn), [0, 0.0, 0.0, 0])
            q[0] += 1; q[1] += du; q[2] += dw
            if di <= 30 and math.degrees(math.atan2(dw, du)) < 60: q[3] += 1

out = {}
for k in sorted(fx):
    a = fx[k]; s = a[0] + a[1] + a[2]; c = -52.5 + 10 * k + 5
    out[c] = [a[3], round(100 * a[0] / s, 1), round(100 * a[1] / s, 1), round(100 * a[2] / s, 1), round(a[0] / a[3], 2),
              round(float(np.median(dfr.get(k, [0]))), 1), round(a[4] / a[3], 2), round(a[5] / a[3], 2)]
    print(f'faixa {c:6.1f}: n {a[3]:5d} · frente {out[c][1]:5.1f} lado {out[c][2]:5.1f} atrás {out[c][3]:5.1f}% · '
          f'à frente por instante {out[c][4]:.2f} · mais à frente (qualquer dist.) {out[c][6]} · ≥ 5 m à frente {out[c][7]}')
    nm = sum(mix[k].values())
    print('      portador: ' + ' '.join(f'{fn} {100 * v / nm:.0f}%' for fn, v in sorted(mix[k].items(), key=lambda e: -e[1])))
tot = [sum(fx[k][i] for k in fx) for i in range(3)]; s = sum(tot)
print('total', ' / '.join(f'{100 * v / s:.1f}' for v in tot))
for fc in ['LAT', 'MEI', 'ATA']:
    print(f'portador {fc} (bola de −2,5 a +17,5):', ' · '.join(
        f"{fn} du {q[1] / q[0]:+.1f} |dw| {q[2] / q[0]:.1f} à frente {100 * q[3] / max(1, q[0]):.0f}%"
        for fn in ['ZAG', 'LAT', 'MEI', 'ATA'] for q in [por.get((fc, fn))] if q))
if saida:
    json.dump(out, open(saida, 'w'))
