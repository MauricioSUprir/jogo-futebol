# Intensidade por fase na Metrica (D8, item 25; PESQUISA-CATEGORIA-D.md §10): os m/min por jogador de linha no jogo
# organizado e nos lances rápidos com a MESMA definição do teste-intensidade — depois de o time recuperar a bola em jogo
# corrido (a posse muda sem bola parada no meio), a bola avança ≥ 15 m para o gol adversário em até 6 s; conta até 1 s depois
# de a bola parar de avançar (no máximo 10 s), para os 20 de linha.
# Duas contagens do começo do lance rápido:
#  - "em linha": como o teste conta hoje, quadro a quadro — o lance só passa a contar quando a bola já avançou os 15 m;
#  - "da recuperação": desde o quadro da recuperação (a definição escrita no cabeçalho do teste).
# Por partida e por time (o ataque rápido de um é a defesa rápida do outro: os 20 contam), mais o p90 por janela de 15 min.
#   python3 -I tools/pesquisa/intensidade_metrica.py <pasta-com-os-csv>
import sys, os, runpy, io, contextlib
import numpy as np

pasta = sys.argv[1]
aqui = os.path.dirname(os.path.abspath(__file__))
sys.argv = ['analise_metrica.py', pasta]
with contextlib.redirect_stdout(io.StringIO()):
    g = runpy.run_path(os.path.join(aqui, 'analise_metrica.py'), run_name='__main__')
jogos, suaviza, FPS = g['jogos'], g['suaviza'], g['FPS']


def velocidades(J):
    """Velocidade (m/s) de cada jogador de linha dos dois times por quadro: a mesma suavização da análise da intensidade."""
    vs = []
    for t, (jog, x, y) in enumerate(J['times']):
        gk = J['info'][t]['gk']
        xs = suaviza(x); ys = suaviza(y)
        sp = np.hypot(np.gradient(xs, axis=0), np.gradient(ys, axis=0)) * FPS
        sp = np.where(sp > 12, np.nan, sp)
        sp = suaviza(sp, 5)
        vs.append(np.delete(sp, gk, axis=1))
    return np.concatenate(vs, axis=1)


def fases(J):
    """Máscaras por quadro: rolando, rápido (em linha) e rápido (da recuperação)."""
    pos, em, n = J['pos'], J['em_jogo'], len(J['pos'])
    rap_linha = np.zeros(n, bool); rap_rec = np.zeros(n, bool)
    t_ant, rec = None, None
    for f in range(n):
        if not em[f]:
            rec = None
            continue
        tc = int(pos[f])
        d = J['info'][tc]['dir'][f]
        u = J['bx'][f] * d
        if tc != t_ant:
            # recuperação em jogo corrido: o quadro de antes também rolava (sem bola parada no meio)
            rec = {'f0': f, 'time': tc, 'u0': u, 'umax': -np.inf, 'fmax': f, 'ate': -1} if t_ant is not None and f > 0 and em[f - 1] else None
            t_ant = tc
        if rec and tc == rec['time'] and not np.isnan(u):
            if u > rec['umax'] + 0.5:
                rec['umax'] = u; rec['fmax'] = f
            if rec['umax'] - rec['u0'] >= 15 and rec['fmax'] - rec['f0'] <= 6 * FPS:
                ate = min(rec['fmax'] + int(FPS), rec['f0'] + int(10 * FPS))
                if ate > rec['ate']:
                    rap_rec[rec['f0']:ate + 1] = True
                    rec['ate'] = ate
        if rec and rec['f0'] <= f <= rec['ate']:
            rap_linha[f] = True
    # o "da recuperação" só vale onde a bola rola
    return em, rap_linha, rap_rec & em


print('m/min por jogador de linha com a bola rolando (a definição do teste-intensidade)')
print('jogo | organizado (em linha) | lances rápidos em linha (% do tempo) | organizado (da recuperação) | lances rápidos da recuperação (% do tempo)')
tot = {k: [0.0, 0] for k in ('org_l', 'rap_l', 'org_r', 'rap_r')}
jan = {'rap_l': [], 'rap_r': [], 'org_l': []}
for J in jogos:
    v = velocidades(J)
    em, rl, rr = fases(J)
    ok = ~np.isnan(v)
    vv = np.where(ok, v, 0.0)
    lin = {}
    for k, msk in (('org_l', em & ~rl), ('rap_l', rl), ('org_r', em & ~rr), ('rap_r', rr)):
        d = vv[msk].sum() / FPS; tmin = ok[msk].sum() / FPS / 60
        tot[k][0] += d; tot[k][1] += tmin
        lin[k] = d / max(tmin, 1e-9)
    print(f"{J['g']} | {lin['org_l']:.1f} | {lin['rap_l']:.1f} ({100 * rl.sum() / em.sum():.1f}%) | {lin['org_r']:.1f} | "
          f"{lin['rap_r']:.1f} ({100 * rr.sum() / em.sum():.1f}%)")
    # janelas de 15 min de jogo (o p90 entre janelas: o "time mais intenso" num trecho da partida)
    w = int(15 * 60 * FPS)
    for a in range(0, len(em) - w + 1, w):
        for k, msk in (('rap_l', rl), ('rap_r', rr), ('org_l', em & ~rl)):
            m = np.zeros(len(em), bool); m[a:a + w] = msk[a:a + w]
            tmin = ok[m].sum() / FPS / 60
            if tmin > 2: jan[k].append(vv[m].sum() / FPS / tmin)
print('total | ' + ' | '.join(f"{k} {tot[k][0] / tot[k][1]:.1f}" for k in tot))
for k, a in jan.items():
    a = np.array(a)
    print(f"janelas de 15 min, {k}: n {len(a)} · p10 {np.percentile(a, 10):.0f} · mediana {np.median(a):.0f} · p90 {np.percentile(a, 90):.0f} · máx {a.max():.0f}")
