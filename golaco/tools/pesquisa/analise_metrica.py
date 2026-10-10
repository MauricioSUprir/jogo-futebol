# Análise própria (Etapa 3 do GOLAÇO) sobre o rastreamento aberto da Metrica Sports
# (Sample Game 1 e 2, 25 Hz). Forma do time, intensidade, pressão, apoio, corredores,
# corridas sem bola, deslocamento do bloco com a bola e "vai-e-volta" de jogadores reais.
# Uso: python3 -I analise_metrica.py <pasta-com-os-csv>
import sys, json, math
import numpy as np
import pandas as pd

PASTA = sys.argv[1]
L, W = 105.0, 68.0
FPS = 25.0

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
    x = (X - 0.5) * L
    y = -(Y - 0.5) * W
    bx = (df['Ball_x'].values - 0.5) * L
    by = -(df['Ball_y'].values - 0.5) * W
    return df['Period'].values, df['Frame'].values, jog, x, y, bx, by

def suaviza(v, n=7):
    # média móvel centrada (ignora NaN localmente)
    k = np.ones(n) / n
    out = np.full_like(v, np.nan)
    for j in range(v.shape[1]):
        col = v[:, j]
        ok = ~np.isnan(col)
        if ok.sum() < n:
            continue
        c = np.where(ok, col, 0.0)
        s = np.convolve(c, k, 'same')
        w = np.convolve(ok.astype(float), k, 'same')
        r = np.where(w > 0.99, s / np.maximum(w, 1e-9), np.nan)
        out[:, j] = r
    return out

def casco_area(px, py):
    pts = sorted(zip(px, py))
    if len(pts) < 3:
        return 0.0
    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0:
            lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(up) >= 2 and cross(up[-2], up[-1], p) <= 0:
            up.pop()
        up.append(p)
    h = lo[:-1] + up[:-1]
    a = 0.0
    for i in range(len(h)):
        x1, y1 = h[i]; x2, y2 = h[(i + 1) % len(h)]
        a += x1 * y2 - x2 * y1
    return abs(a) / 2

def posse_por_quadro(ev, nq):
    # 0 = casa, 1 = fora, -1 = bola parada/desconhecida
    pos = np.full(nq + 2, -2, dtype=int)
    eventos = ev.sort_values('Start Frame')
    marcas = []
    for _, e in eventos.iterrows():
        t = 0 if e['Team'] == 'Home' else 1
        tipo = e['Type']; sub = str(e['Subtype'])
        f0 = int(e['Start Frame'])
        if tipo in ('PASS', 'SET PIECE', 'SHOT', 'RECOVERY'):
            marcas.append((f0, t))
        elif tipo == 'BALL LOST':
            marcas.append((max(int(e['End Frame']), f0), 1 - t))
        if tipo == 'BALL OUT' or (tipo == 'SHOT' and ('GOAL' in sub or 'OUT' in sub)) or tipo == 'FAULT RECEIVED':
            marcas.append((max(int(e['End Frame']), f0) + 1, -1))
    marcas.sort()
    atual = -1
    j = 0
    for f in range(1, nq + 1):
        while j < len(marcas) and marcas[j][0] <= f:
            atual = marcas[j][1]; j += 1
        pos[f] = atual
    return pos

def analisa_jogo(g):
    per, fr, jogC, xC, yC, bx, by = carrega_time(f'{PASTA}/g{g}_RawTrackingData_Home_Team.csv')
    per2, fr2, jogF, xF, yF, _, _ = carrega_time(f'{PASTA}/g{g}_RawTrackingData_Away_Team.csv')
    n = min(len(fr), len(fr2))
    per, fr = per[:n], fr[:n]
    xC, yC, xF, yF, bx, by = xC[:n], yC[:n], xF[:n], yF[:n], bx[:n], by[:n]
    ev = pd.read_csv(f'{PASTA}/g{g}_RawEventsData.csv')
    pos = posse_por_quadro(ev, int(fr.max()))[fr]
    em_jogo = (pos >= 0) & ~np.isnan(bx)
    times = [(jogC, xC, yC), (jogF, xF, yF)]
    # goleiro = jogador com média de x mais extrema no 1º tempo; sentido de ataque por período
    info = []
    for t, (jog, x, y) in enumerate(times):
        m1 = per == 1
        mx = np.nanmean(x[m1], 0)
        gk = int(np.nanargmax(np.abs(mx)))
        dirs = {}
        for p in (1, 2):
            mp = per == p
            gx = np.nanmean(x[mp, gk])
            dirs[p] = 1.0 if gx < 0 else -1.0
        d = np.where(per == 1, dirs[1], dirs[2])
        info.append({'gk': gk, 'dir': d})
    return dict(g=g, per=per, fr=fr, bx=bx, by=by, pos=pos, em_jogo=em_jogo, times=times, info=info, ev=ev)

def resumo(v, nd=1):
    v = np.asarray(v, float)
    v = v[~np.isnan(v)]
    if len(v) == 0:
        return None
    q = np.percentile(v, [10, 25, 50, 75, 90])
    return {'media': round(float(v.mean()), nd), 'p10': round(float(q[0]), nd), 'p25': round(float(q[1]), nd),
            'mediana': round(float(q[2]), nd), 'p75': round(float(q[3]), nd), 'p90': round(float(q[4]), nd), 'n': int(len(v))}

R = {}
jogos = [analisa_jogo(1), analisa_jogo(2)]

# ---------- 1) forma do time ----------
forma = {k: [] for k in ['comp_com', 'larg_com', 'area_com', 'comp_sem', 'larg_sem', 'area_sem',
                         'linha_com', 'linha_sem', 'defmeio_sem', 'meioatq_sem', 'defmeio_com', 'meioatq_com',
                         'linha_sem_terco1', 'linha_sem_terco2', 'linha_sem_terco3',
                         'comp_sem_terco1', 'comp_sem_terco2', 'comp_sem_terco3',
                         'gk_def_sem', 'gk_def_com', 'larg_sem_bolalado', 'larg_sem_bolacentro']}
desloc = {'sem': {'cx': [], 'bx': [], 'cy': [], 'by': []}, 'com': {'cx': [], 'bx': [], 'cy': [], 'by': []}}
papeis = {}  # (papel, fase) -> listas (u_jog, u_bola, z_jog, z_bola)
for J in jogos:
    idx = np.where(J['em_jogo'])[0][::5]  # 5 Hz
    # papéis por jogo/tempo: ranking da profundidade média (4 defesa, 4 meio, 2 ataque)
    for t, (jog, x, y) in enumerate(J['times']):
        d = J['info'][t]['dir']; gk = J['info'][t]['gk']
        u = x * d[:, None]; z = y * d[:, None]
        ub = J['bx'] * d; zb = J['by'] * d
        papel_de = {}
        for p in (1, 2):
            mp = (J['per'] == p) & J['em_jogo']
            mu = np.nanmean(u[mp], 0); mz = np.nanmean(z[mp], 0)
            pres = np.mean(~np.isnan(u[mp]), 0)
            campo = [i for i in range(len(jog)) if i != gk and pres[i] > 0.6]
            campo.sort(key=lambda i: mu[i])
            # 4 mais recuados = defesa; dos 4: 2 mais abertos = laterais
            defe = campo[:4]; meio = campo[4:8]; ataq = campo[8:]
            dl = sorted(defe, key=lambda i: abs(mz[i]))
            for i in dl[:2]: papel_de[(p, i)] = 'zagueiro'
            for i in dl[2:]: papel_de[(p, i)] = 'lateral'
            ml = sorted(meio, key=lambda i: abs(mz[i]))
            for i in ml[:2]: papel_de[(p, i)] = 'meio-central'
            for i in ml[2:]: papel_de[(p, i)] = 'meia-aberto'
            for i in ataq: papel_de[(p, i)] = 'atacante'
        J.setdefault('papel', {})[t] = papel_de
        for f in idx:
            com = J['pos'][f] == t
            fase = 'com' if com else 'sem'
            uu = u[f]; zz = z[f]
            campo = [i for i in range(len(jog)) if i != gk and not np.isnan(uu[i])]
            if len(campo) < 9:
                continue
            cu = uu[campo]; cz = zz[campo]
            comp = cu.max() - cu.min(); larg = cz.max() - cz.min()
            area = casco_area(cu, cz)
            srt = np.sort(cu)
            linha = srt[0] + 52.5  # altura da linha (último defensor) a partir do próprio gol
            dm = srt[4:8].mean() - srt[0:4].mean()
            ma = srt[8:].mean() - srt[4:8].mean()
            forma['comp_' + fase].append(comp); forma['larg_' + fase].append(larg)
            forma['area_' + fase].append(area); forma['linha_' + fase].append(linha)
            forma['defmeio_' + fase].append(dm); forma['meioatq_' + fase].append(ma)
            if not np.isnan(uu[gk]):
                forma['gk_def_' + fase].append(srt[0] - uu[gk])
            if fase == 'sem' and not np.isnan(ub[f]):
                terco = 1 if ub[f] < -17.5 else (2 if ub[f] < 17.5 else 3)
                forma[f'linha_sem_terco{terco}'].append(linha)
                forma[f'comp_sem_terco{terco}'].append(comp)
                if abs(zb[f]) > 20.16: forma['larg_sem_bolalado'].append(larg)
                elif abs(zb[f]) < 9.16: forma['larg_sem_bolacentro'].append(larg)
            if not np.isnan(ub[f]):
                desloc[fase]['cx'].append(cu.mean()); desloc[fase]['bx'].append(ub[f])
                desloc[fase]['cy'].append(cz.mean()); desloc[fase]['by'].append(zb[f])
                pr = J['per'][f]
                for i in campo:
                    pp = papel_de.get((pr, i))
                    if pp is None: continue
                    k = (pp, fase)
                    papeis.setdefault(k, ([], [], [], [], []))
                    papeis[k][0].append(uu[i]); papeis[k][1].append(ub[f])
                    # lateral: z do jogador "espelhado" para o lado médio dele
                    papeis[k][2].append(zz[i]); papeis[k][3].append(zb[f])
                    papeis[k][4].append((J['g'], t, pr, i))
R['forma'] = {k: resumo(v) for k, v in forma.items()}

def reta(xs, ys):
    xs = np.asarray(xs); ys = np.asarray(ys)
    A = np.vstack([xs, np.ones_like(xs)]).T
    a, b = np.linalg.lstsq(A, ys, rcond=None)[0]
    r = np.corrcoef(xs, ys)[0, 1]
    return {'inclinacao': round(float(a), 3), 'intercepto': round(float(b), 2), 'r': round(float(r), 3)}

R['bloco_segue_bola'] = {f: {'comprimento(x)': reta(desloc[f]['bx'], desloc[f]['cx']),
                             'largura(z)': reta(desloc[f]['by'], desloc[f]['cy'])} for f in desloc}
# por papel: inclinação de u_jog ~ u_bola, e de z_jog ~ z_bola (por jogador, depois mediana)
pap = {}
for (pp, fase), (uj, ub, zj, zb, ids) in papeis.items():
    uj = np.array(uj); ub = np.array(ub); zj = np.array(zj); zb = np.array(zb)
    keys = {}
    for k_i, key in enumerate(ids):
        keys.setdefault(key, []).append(k_i)
    sx, sz, mu, mz = [], [], [], []
    for key, ii in keys.items():
        ii = np.array(ii)
        if len(ii) < 200: continue
        sx.append(reta(ub[ii], uj[ii])['inclinacao']); sz.append(reta(zb[ii], zj[ii])['inclinacao'])
        mu.append(float(np.mean(uj[ii]))); mz.append(float(np.mean(np.abs(zj[ii]))))
    pap[f'{pp}|{fase}'] = {'incl_x_mediana': round(float(np.median(sx)), 2), 'incl_z_mediana': round(float(np.median(sz)), 2),
                           'u_medio': round(float(np.median(mu)), 1), 'abs_z_medio': round(float(np.median(mz)), 1), 'n_jog': len(sx)}
R['papel_segue_bola'] = pap

# ---------- 2) intensidade ----------
faixas = [('parado', 0, 0.16), ('andando', 0.16, 1.98), ('trotando', 1.98, 3.98), ('correndo', 3.98, 5.48),
          ('alta_vel', 5.48, 7.0), ('sprint', 7.0, 99)]
tempo_faixa = {nm: 0 for nm, _, _ in faixas}; tempo_tot = 0
tempo_faixa_jogo = {nm: 0 for nm, _, _ in faixas}; tempo_tot_jogo = 0
dist90, sprints90, acel90, desac90, hsr90, vmed_com, vmed_sem = [], [], [], [], [], [], []
inversoes_min, giros90_min = [], []
corridas = {'com': {'frente': 0, 'lado': 0, 'tras': 0, 'nas_costas': 0}, 'sem': {'frente': 0, 'lado': 0, 'tras': 0}}
min_jogados_total = 0.0
dur_corrida = []
for J in jogos:
    for t, (jog, x, y) in enumerate(J['times']):
        d = J['info'][t]['dir']; gk = J['info'][t]['gk']
        xs = suaviza(x); ys = suaviza(y)
        vx = np.gradient(xs, axis=0) * FPS; vy = np.gradient(ys, axis=0) * FPS
        sp = np.hypot(vx, vy)
        sp = np.where(sp > 12, np.nan, sp)
        spS = suaviza(sp, 5)
        acc = np.gradient(spS, axis=0) * FPS
        # linha do último defensor adversário (para "nas costas")
        jogA, xA, yA = J['times'][1 - t]
        uA = xA * d[:, None]
        gkA = J['info'][1 - t]['gk']
        uA_campo = np.delete(uA, gkA, axis=1)
        ult_def = np.nanmax(uA_campo, 1)  # maior u do adversário = último defensor dele (ataco para +u)
        for i in range(len(jog)):
            if i == gk: continue
            s = spS[:, i]
            ok = ~np.isnan(s)
            nmin = ok.sum() / FPS / 60
            if nmin < 20: continue
            for nm, a, b in faixas:
                tempo_faixa[nm] += np.sum((s >= a) & (s < b))
                tempo_faixa_jogo[nm] += np.sum((s >= a) & (s < b) & J['em_jogo'])
            tempo_tot += ok.sum(); tempo_tot_jogo += np.sum(ok & J['em_jogo'])
            dist = np.nansum(s) / FPS
            fator = 90.0 / nmin
            dist90.append(dist * fator)
            hsr90.append(np.nansum(np.where(s >= 5.48, s, 0)) / FPS * fator)
            # sprints: > 7 m/s por >= 1 s
            def episodios(cond, mindur):
                c = np.concatenate([[False], cond, [False]])
                dd = np.diff(c.astype(int))
                ini = np.where(dd == 1)[0]; fim = np.where(dd == -1)[0]
                return [(a0, b0) for a0, b0 in zip(ini, fim) if (b0 - a0) / FPS >= mindur]
            spr = episodios(np.nan_to_num(s) > 7.0, 1.0)
            sprints90.append(len(spr) * fator)
            a3 = episodios(np.nan_to_num(acc[:, i]) > 3.0, 0.5)
            d3 = episodios(np.nan_to_num(acc[:, i]) < -3.0, 0.5)
            acel90.append(len(a3) * fator); desac90.append(len(d3) * fator)
            com = (J['pos'] == t) & J['em_jogo']; sem = (J['pos'] == 1 - t) & J['em_jogo']
            vmed_com.append(np.nanmean(s[com])); vmed_sem.append(np.nanmean(s[sem]))
            # corridas de alta intensidade (>= 5.5 m/s por >= 1 s): direção em relação ao ataque
            hi = episodios(np.nan_to_num(s) >= 5.5, 1.0)
            for a0, b0 in hi:
                dur_corrida.append((b0 - a0) / FPS)
                fase = 'com' if com[a0] else ('sem' if sem[a0] else None)
                if fase is None: continue
                dxu = (xs[b0 - 1, i] - xs[a0, i]) * d[a0]
                dyz = (ys[b0 - 1, i] - ys[a0, i])
                ang = math.degrees(math.atan2(abs(dyz), dxu))
                cls = 'frente' if ang < 45 else ('lado' if ang < 135 else 'tras')
                corridas[fase][cls] += fator
                if fase == 'com' and cls == 'frente':
                    ufim = xs[b0 - 1, i] * d[a0]
                    if not np.isnan(ult_def[b0 - 1]) and ufim > ult_def[b0 - 1] - 1.0 and ufim > 0:
                        corridas['com']['nas_costas'] += fator
            # "vai-e-volta": rumo da velocidade inverte > 135° em <= 1 s, andando a >= 1,5 m/s nos dois instantes
            rumo = np.arctan2(vy[:, i], vx[:, i])
            k = int(FPS)
            n_inv = 0; ff = 0
            mov = np.nan_to_num(sp[:, i]) >= 1.5
            T = len(rumo)
            while ff < T - k:
                if mov[ff] and mov[ff + k] and J['em_jogo'][ff]:
                    dr = abs((rumo[ff + k] - rumo[ff] + math.pi) % (2 * math.pi) - math.pi)
                    if dr > math.radians(135):
                        n_inv += 1; ff += k; continue
                ff += 1
            n90 = 0; ff = 0
            while ff < T - k:
                if mov[ff] and mov[ff + k] and J['em_jogo'][ff]:
                    dr = abs((rumo[ff + k] - rumo[ff] + math.pi) % (2 * math.pi) - math.pi)
                    if dr > math.radians(90):
                        n90 += 1; ff += k; continue
                ff += 1
            min_jogo = np.sum(ok & J['em_jogo']) / FPS / 60
            inversoes_min.append(n_inv / max(min_jogo, 1e-6))
            giros90_min.append(n90 / max(min_jogo, 1e-6))
            min_jogados_total += nmin

R['intensidade'] = {
    'pct_tempo_total': {nm: round(100 * v / tempo_tot, 1) for nm, v in tempo_faixa.items()},
    'pct_tempo_bola_rolando': {nm: round(100 * v / tempo_tot_jogo, 1) for nm, v in tempo_faixa_jogo.items()},
    'distancia_por_90_m': resumo(dist90, 0), 'alta_vel_>=5,48_por_90_m': resumo(hsr90, 0),
    'sprints_>7ms_1s_por_90': resumo(sprints90, 1), 'aceleracoes_>3ms2_0,5s_por_90': resumo(acel90, 1),
    'desaceleracoes_<-3ms2_0,5s_por_90': resumo(desac90, 1),
    'vel_media_com_posse_ms': resumo(vmed_com, 2), 'vel_media_sem_posse_ms': resumo(vmed_sem, 2),
    'corridas_alta_int_>=5,5ms_1s_por_jogador_90': {f: {k: round(v / len(dist90), 1) for k, v in d.items()} for f, d in corridas.items()},
    'duracao_corrida_alta_int_s': resumo(dur_corrida, 2),
    'inversoes_rumo_>135_em_1s_por_min_bola_rolando': resumo(inversoes_min, 2),
    'mudancas_rumo_>90_em_1s_por_min_bola_rolando': resumo(giros90_min, 2),
}

# ---------- 3) pressão e 4) apoio / corredores ----------
dist_marcador, def5, def10, comp15, comp20, livres, prox_comp = [], [], [], [], [], [], []
ang_apoio = {'frente': 0, 'lado': 0, 'tras': 0}
dist_apoio = []
corredor = {k: [] for k in ['aberto_esq', 'meia_esq', 'centro', 'meia_dir', 'aberto_dir', 'na_area', 'campo_adv_aberto_esq', 'campo_adv_meia_esq', 'campo_adv_centro', 'campo_adv_meia_dir', 'campo_adv_aberto_dir', 'campo_adv_total']}
recep_dist, tempo_ate_2m, vel_fecha = [], [], []
for J in jogos:
    idx = np.where(J['em_jogo'])[0][::5]
    for f in idx:
        t = J['pos'][f]
        jog, x, y = J['times'][t]; jogA, xA, yA = J['times'][1 - t]
        d = J['info'][t]['dir'][f]
        b = np.array([J['bx'][f], J['by'][f]])
        P = np.stack([x[f], y[f]], 1); Q = np.stack([xA[f], yA[f]], 1)
        okP = ~np.isnan(P[:, 0]); okQ = ~np.isnan(Q[:, 0])
        dP = np.hypot(*(P - b).T); dP[~okP] = 1e9
        c = int(np.argmin(dP))
        if dP[c] > 1.0:
            # corredores (sem portador definido também vale) quando a bola está no terço final
            pass
        else:
            car = P[c]
            dQ = np.hypot(*(Q - car).T); dQ[~okQ] = 1e9
            gkA = J['info'][1 - t]['gk']
            dist_marcador.append(np.min(dQ))
            def5.append(np.sum(dQ <= 5)); def10.append(np.sum(dQ <= 10))
            gk = J['info'][t]['gk']
            vivos = [i for i in range(len(jog)) if okP[i] and i != c and i != gk]
            dd = np.array([np.hypot(*(P[i] - car)) for i in vivos])
            prox_comp.append(dd.min()); comp15.append(np.sum(dd <= 15)); comp20.append(np.sum(dd <= 20))
            nliv = 0
            for i, di in zip(vivos, dd):
                if di > 30: continue
                lane = P[i] - car; ln = np.hypot(*lane); ul = lane / ln
                menor = 180.0
                for q in range(len(Q)):
                    if not okQ[q]: continue
                    w = Q[q] - car; proj = w @ ul
                    if proj <= 0 or proj >= ln + 1.0: continue
                    ang = math.degrees(math.atan2(abs(ul[0] * w[1] - ul[1] * w[0]), proj))
                    menor = min(menor, ang)
                if menor >= 12.0:
                    nliv += 1
                dist_apoio.append(di)
                aang = math.degrees(math.atan2(abs(lane[1]), lane[0] * d))
                ang_apoio['frente' if aang < 60 else ('lado' if aang < 120 else 'tras')] += 1
            livres.append(nliv)
        ub = J['bx'][f] * d
        if ub > 17.5:
            z = y[f] * d
            u = x[f] * d
            gk = J['info'][t]['gk']
            zz = np.array([z[i] for i in range(len(jog)) if okP[i] and i != gk])
            uu = np.array([u[i] for i in range(len(jog)) if okP[i] and i != gk])
            # corredores (do ponto de vista de quem ataca para +u; z>0 = esquerda)
            corredor['aberto_esq'].append(np.sum(zz > 20.16)); corredor['meia_esq'].append(np.sum((zz > 9.16) & (zz <= 20.16)))
            corredor['centro'].append(np.sum(np.abs(zz) <= 9.16)); corredor['meia_dir'].append(np.sum((zz < -9.16) & (zz >= -20.16)))
            corredor['aberto_dir'].append(np.sum(zz < -20.16))
            corredor['na_area'].append(np.sum((uu > 52.5 - 16.5) & (np.abs(zz) <= 20.16)))
            m = uu > 0
            corredor['campo_adv_aberto_esq'].append(np.sum(m & (zz > 20.16))); corredor['campo_adv_meia_esq'].append(np.sum(m & (zz > 9.16) & (zz <= 20.16)))
            corredor['campo_adv_centro'].append(np.sum(m & (np.abs(zz) <= 9.16))); corredor['campo_adv_meia_dir'].append(np.sum(m & (zz < -9.16) & (zz >= -20.16)))
            corredor['campo_adv_aberto_dir'].append(np.sum(m & (zz < -20.16))); corredor['campo_adv_total'].append(np.sum(m))
    # recepção de passes: distância do marcador mais próximo e tempo até ele chegar a 2 m
    ev = J['ev']
    fr2i = {int(fv): k for k, fv in enumerate(J['fr'])}
    for _, e in ev[(ev['Type'] == 'PASS')].iterrows():
        tm = 0 if e['Team'] == 'Home' else 1
        rec = e['To']
        if not isinstance(rec, str): continue
        jog, x, y = J['times'][tm]; jogA, xA, yA = J['times'][1 - tm]
        if rec not in jog: continue
        i = jog.index(rec)
        k = fr2i.get(int(e['End Frame']))
        if k is None or k + 75 >= len(J['fr']): continue
        pr = np.array([x[k, i], y[k, i]])
        if np.isnan(pr[0]): continue
        dq = np.hypot(xA[k] - pr[0], yA[k] - pr[1])
        if np.all(np.isnan(dq)): continue
        q = int(np.nanargmin(dq))
        recep_dist.append(dq[q])
        # tempo até algum adversário ficar a <= 2 m do recebedor (até 3 s)
        tt = None
        for s in range(0, 75):
            dqs = np.hypot(xA[k + s] - x[k + s, i], yA[k + s] - y[k + s, i])
            if np.nanmin(dqs) <= 2.0:
                tt = s / FPS; break
        if tt is not None: tempo_ate_2m.append(tt)
        # velocidade com que o marcador mais próximo fecha no 1º segundo (componente na direção do recebedor)
        a0 = np.array([xA[k, q], yA[k, q]]); a1 = np.array([xA[k + 25, q], yA[k + 25, q]])
        r0 = pr; r1 = np.array([x[k + 25, i], y[k + 25, i]])
        if not (np.isnan(a1[0]) or np.isnan(r1[0])):
            vel_fecha.append(np.hypot(*(a0 - r0)) - np.hypot(*(a1 - r1)))

R['pressao'] = {'dist_marcador_mais_proximo_do_portador_m': resumo(dist_marcador),
                'adversarios_a_<=5m_do_portador': resumo(def5, 2), 'adversarios_a_<=10m_do_portador': resumo(def10, 2),
                'dist_marcador_na_recepcao_do_passe_m': resumo(recep_dist),
                'tempo_ate_marcador_a_<=2m_apos_recepcao_s(quando_acontece_em_3s)': resumo(tempo_ate_2m, 2),
                'pct_recepcoes_com_marcador_a_<=2m_em_3s': round(100 * len(tempo_ate_2m) / max(len(recep_dist), 1), 1),
                'quanto_o_marcador_fecha_no_1o_segundo_m': resumo(vel_fecha, 2)}
tot = sum(ang_apoio.values())
R['apoio'] = {'companheiro_mais_proximo_do_portador_m': resumo(prox_comp),
              'companheiros_a_<=15m': resumo(comp15, 2), 'companheiros_a_<=20m': resumo(comp20, 2),
              'linhas_de_passe_livres(<=30m, cone>=12graus)': resumo(livres, 2),
              'dist_companheiros_ate_30m_m': resumo([v for v in dist_apoio if v <= 30]),
              'direcao_dos_companheiros_(%)': {k: round(100 * v / tot, 1) for k, v in ang_apoio.items()}}
R['corredores_terco_final_com_posse'] = {k: resumo(v, 2) for k, v in corredor.items()}

json.dump(R, open(f'{PASTA}/../resultado_metrica.json', 'w'), ensure_ascii=False, indent=1)
print(json.dumps(R, ensure_ascii=False, indent=1))
