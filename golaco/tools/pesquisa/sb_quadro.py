# Quadro da transmissão pela StatsBomb 360 (visible_area = o quadro da TV projetado no gramado,
# nas coordenadas do evento: o time que age ataca para +x; campo 120 × 80).
# Uso: python3 -I sb_quadro.py <pasta com ev_*.json e 360_*.json>
import json, os, sys, glob, statistics as st

SX, SY = 105 / 120, 68 / 80          # unidades StatsBomb → metros (campo de 105 × 68)
AREA = (102.0, 18.0, 120.0, 62.0)    # grande área atacada (x0, y0, x1, y1)
PEQ = (114.0, 30.0, 120.0, 50.0)     # pequena área atacada
GOL = (120.0, 36.0, 120.0, 44.0)


def area_poli(p):
    s = 0.0
    for i in range(len(p)):
        x1, y1 = p[i]; x2, y2 = p[(i + 1) % len(p)]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2


def recorta(sujeito, corte):
    """Sutherland–Hodgman: sujeito recortado pelo polígono convexo `corte`."""
    def dentro(p, a, b, sinal):
        return sinal * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) >= -1e-9

    def cruza(p1, p2, a, b):
        x1, y1 = p1; x2, y2 = p2; x3, y3 = a; x4, y4 = b
        den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
        if abs(den) < 1e-12:
            return p2
        t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den
        return (x1 + t * (x2 - x1), y1 + t * (y2 - y1))
    # orientação do corte
    s = 0.0
    for i in range(len(corte)):
        x1, y1 = corte[i]; x2, y2 = corte[(i + 1) % len(corte)]
        s += x1 * y2 - x2 * y1
    sinal = 1 if s > 0 else -1
    saida = list(sujeito)
    for i in range(len(corte)):
        a, b = corte[i], corte[(i + 1) % len(corte)]
        ent, saida = saida, []
        if not ent:
            break
        for j in range(len(ent)):
            p, q = ent[j], ent[(j + 1) % len(ent)]
            dp, dq = dentro(p, a, b, sinal), dentro(q, a, b, sinal)
            if dq:
                if not dp:
                    saida.append(cruza(p, q, a, b))
                saida.append(q)
            elif dp:
                saida.append(cruza(p, q, a, b))
    return saida


def fatia(poli, eixo, v):
    """Intervalo do polígono na reta (eixo=1: y = v, devolve x min/max; eixo=0: x = v, devolve y)."""
    pts = []
    n = len(poli)
    for i in range(n):
        a, b = poli[i], poli[(i + 1) % n]
        if (a[eixo] - v) * (b[eixo] - v) <= 0 and a[eixo] != b[eixo]:
            t = (v - a[eixo]) / (b[eixo] - a[eixo])
            pts.append(a[1 - eixo] + t * (b[1 - eixo] - a[1 - eixo]))
    if len(pts) < 2:
        return None
    return min(pts), max(pts)


def ret(r):
    x0, y0, x1, y1 = r
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


def pct(xs, q):
    xs = sorted(xs)
    if not xs:
        return float('nan')
    k = (len(xs) - 1) * q
    i = int(k)
    return xs[i] if i + 1 >= len(xs) else xs[i] + (xs[i + 1] - xs[i]) * (k - i)


def main(pasta):
    zonas = {'1/3 defensivo': [], 'meio': [], '1/3 final (fora da área)': [], 'na área': []}
    todos = []
    for f360 in sorted(glob.glob(os.path.join(pasta, '360_*.json'))):
        mid = os.path.basename(f360)[4:-5]
        ev = {e['id']: e for e in json.load(open(os.path.join(pasta, f'ev_{mid}.json')))}
        for fr in json.load(open(f360)):
            e = ev.get(fr['event_uuid'])
            va = fr.get('visible_area') or []
            if not e or 'location' not in e or len(va) < 6:
                continue
            poli = [(va[i], va[i + 1]) for i in range(0, len(va) - 1, 2)]
            if len(poli) > 1 and poli[0] == poli[-1]:
                poli = poli[:-1]
            if len(poli) < 3:
                continue
            bx, by = e['location'][:2]
            tipo = e['type']['name']
            lin = fatia(poli, 1, by)        # largura do quadro na profundidade da bola
            col = fatia(poli, 0, bx)        # profundidade vista na reta da bola
            if not lin or not col:
                continue
            larg = (lin[1] - lin[0]) * SX
            if larg <= 0:
                continue
            u = (bx - lin[0]) / (lin[1] - lin[0])      # 0 = borda de trás (o próprio gol), 1 = borda da frente (o ataque)
            # lado perto da câmera = o lado do polígono mais estreito em x
            l0, l1 = fatia(poli, 1, 0.5), fatia(poli, 1, 79.5)
            perto_y0 = (l0[1] - l0[0] if l0 else 1e9) < (l1[1] - l1[0] if l1 else 1e9)
            vprof = (by - col[0]) / (col[1] - col[0]) if col[1] > col[0] else 0.5
            if not perto_y0:
                vprof = 1 - vprof                      # 0 = borda de baixo (perto da câmera), 1 = de cima
            a_vis = area_poli(poli) * SX * SY
            area_vis = area_poli(recorta(ret(AREA), poli)) / area_poli(ret(AREA)) if True else 0
            peq_vis = area_poli(recorta(ret(PEQ), poli)) / area_poli(ret(PEQ))
            gl = fatia(poli, 0, 119.99)
            gol_vis = 0.0
            if gl:
                gol_vis = max(0.0, min(gl[1], 44) - max(gl[0], 36)) / 8
            corte_x = lin[0] <= 0.2 or lin[1] >= 119.8       # o quadro passa da linha de fundo (recortado)
            corte_y = col[0] <= 0.2 or col[1] >= 79.8        # passa da lateral
            sub = (e.get('pass') or {}).get('type', {}).get('name') if tipo == 'Pass' else None
            reg = dict(pp=e.get('play_pattern', {}).get('name'), tipo=tipo, sub=sub, x=bx, y=by, larg=larg, u=u, v=vprof, a=a_vis, cx=corte_x, cy=corte_y,
                       area=area_vis, peq=peq_vis, gol=gol_vis, xmax=max(p[0] for p in poli))
            todos.append(reg)
            if AREA[0] <= bx <= 120 and AREA[1] <= by <= AREA[3]:
                zonas['na área'].append(reg)
            elif bx >= 80:
                zonas['1/3 final (fora da área)'].append(reg)
            elif bx >= 40:
                zonas['meio'].append(reg)
            else:
                zonas['1/3 defensivo'].append(reg)
    print(f'eventos com quadro: {len(todos)}')
    print('zona | n | largura na prof. da bola (m) p10/p50/p90 | n sem recorte | u (0=atrás,1=frente) p10/p50/p90 | '
          'terço do meio |u−0,5|≤1/6 | metade do meio ≤1/4 | v (0=perto) p50 | grande área ≥95% | área vista p50 | gol inteiro')
    for z, rs in list(zonas.items()) + [('todas', todos)]:
        if not rs:
            continue
        L = [r['larg'] for r in rs]
        ru = [r for r in rs if not r['cx']]
        U = [r['u'] for r in ru]
        V = [r['v'] for r in rs if not r['cy']]
        meio = sum(1 for x in U if abs(x - 0.5) <= 1 / 6) / max(1, len(U))
        meio2 = sum(1 for x in U if abs(x - 0.5) <= 0.25) / max(1, len(U))
        a95 = sum(1 for r in rs if r['area'] >= 0.95) / len(rs)
        g = sum(1 for r in rs if r['gol'] >= 0.999) / len(rs)
        print(f"{z} | {len(rs)} | {pct(L,.1):.1f}/{pct(L,.5):.1f}/{pct(L,.9):.1f} | {len(ru)} | "
              f"{pct(U,.1):.2f}/{pct(U,.5):.2f}/{pct(U,.9):.2f} | {meio*100:.0f}% | {meio2*100:.0f}% | {pct(V,.5):.2f} | "
              f"{a95*100:.0f}% | {pct([r['area'] for r in rs],.5)*100:.0f}% | {g*100:.0f}%")
    print('\nbola no 1/3 final, por faixa de distância à linha de fundo atacada:')
    for a, b in [(80, 90), (90, 102), (102, 108), (108, 114), (114, 120.1)]:
        rs = [r for r in todos if a <= r['x'] < b]
        if rs:
            A = [r['area'] for r in rs]
            ru = [r['u'] for r in rs if not r['cx']]
            print(f"  {(120-b)*SX:4.1f}–{(120-a)*SX:4.1f} m: n={len(rs)}, área vista p10 {pct(A,.1)*100:.0f}% p50 {pct(A,.5)*100:.0f}%, "
                  f"inteira (≥95%) {sum(1 for x in A if x>=.95)/len(A)*100:.0f}%, gol inteiro {sum(1 for r in rs if r['gol']>=.999)/len(rs)*100:.0f}%, "
                  f"largura p50 {pct([r['larg'] for r in rs],.5):.1f} m, quadro passa da linha de fundo {sum(1 for r in rs if r['cx'])/len(rs)*100:.0f}%, "
                  f"u sem recorte p50 {pct(ru,.5):.2f} (n={len(ru)})")
    print('\nbola nas bordas e quadro à frente (sem recorte em x):')
    for z, rs in list(zonas.items()) + [('todas', todos)]:
        U = [r['u'] for r in rs if not r['cx']]
        if U:
            print(f"  {z}: n={len(U)}, u<0,15 ou >0,85: {sum(1 for x in U if x<.15 or x>.85)/len(U)*100:.1f}%, "
                  f"u<0,10 ou >0,90: {sum(1 for x in U if x<.1 or x>.9)/len(U)*100:.1f}%, u≤0,5 (mais quadro à frente): {sum(1 for x in U if x<=.5)/len(U)*100:.0f}%, "
                  f"média u {sum(U)/len(U):.2f}")
    print('\npor padrão de jogada (fora do 1/3 final e sem recorte):')
    for pp in ['Regular Play', 'From Counter', 'From Throw In', 'From Goal Kick', 'From Keeper', 'From Free Kick', 'From Corner']:
        rs = [r for r in todos if r['pp'] == pp and r['x'] < 80 and not r['cx']]
        if rs:
            print(f"  {pp}: n={len(rs)}, largura p50 {pct([r['larg'] for r in rs],.5):.1f} m (p90 {pct([r['larg'] for r in rs],.9):.1f}), u p50 {pct([r['u'] for r in rs],.5):.2f}")
    print('\nlances especiais:')
    for nome, filtro in [('escanteio (cobrança)', lambda r: r['sub'] == 'Corner'),
                         ('tiro livre (cobrança)', lambda r: r['sub'] == 'Free Kick'),
                         ('chute', lambda r: r['tipo'] == 'Shot'),
                         ('cruzamento/passe a partir do 1/3 final p/ a área', lambda r: r['tipo'] == 'Pass' and r['x'] >= 80 and r['sub'] is None)]:
        rs = [r for r in todos if filtro(r)]
        if rs:
            A = [r['area'] for r in rs]
            print(f"  {nome}: n={len(rs)}, largura p50 {pct([r['larg'] for r in rs],.5):.1f} m (p10 {pct([r['larg'] for r in rs],.1):.1f}), "
                  f"área vista p50 {pct(A,.5)*100:.0f}% p10 {pct(A,.1)*100:.0f}%, inteira {sum(1 for x in A if x>=.95)/len(A)*100:.0f}%, "
                  f"gol inteiro {sum(1 for r in rs if r['gol']>=.999)/len(rs)*100:.0f}%, área do campo vista p50 {pct([r['a'] for r in rs],.5):.0f} m²")


if __name__ == '__main__':
    main(sys.argv[1])
