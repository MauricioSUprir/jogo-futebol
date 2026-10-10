# Análise tática complementar (Etapa 3 do GOLAÇO) sobre o rastreamento aberto da Metrica Sports.
# Posição média por função (com/sem bola, por terço da bola), alinhamento da linha de 4, linha de impedimento,
# pressionadores por terço, contrapressão após a perda, jogadores na área no cruzamento, PPDA e disputa aérea.
# Uso: python3 -I tatica_metrica.py <pasta-com-os-csv> <saida.json>
import sys, json, math
import numpy as np
import pandas as pd

PASTA, SAIDA = sys.argv[1], sys.argv[2]
L, W, FPS = 105.0, 68.0, 25.0

def carrega_time(arq):
    df = pd.read_csv(arq, skiprows=2)
    cols = list(df.columns); ren = {}
    for i, c in enumerate(cols):
        if c.startswith('Player') or c == 'Ball':
            ren[c] = c + '_x'; ren[cols[i + 1]] = c + '_y'
    df = df.rename(columns=ren)
    jog = [c[:-2] for c in df.columns if c.endswith('_x') and c.startswith('Player')]
    X = np.stack([df[j + '_x'].values for j in jog], 1); Y = np.stack([df[j + '_y'].values for j in jog], 1)
    x = (X - 0.5) * L; y = -(Y - 0.5) * W
    bx = (df['Ball_x'].values - 0.5) * L; by = -(df['Ball_y'].values - 0.5) * W
    return df['Period'].values, df['Frame'].values, jog, x, y, bx, by

def posse_por_quadro(ev, nq):
    pos = np.full(nq + 2, -2, dtype=int); marcas = []
    for _, e in ev.sort_values('Start Frame').iterrows():
        t = 0 if e['Team'] == 'Home' else 1
        tipo = e['Type']; sub = str(e['Subtype']); f0 = int(e['Start Frame'])
        if tipo in ('PASS', 'SET PIECE', 'SHOT', 'RECOVERY'): marcas.append((f0, t))
        elif tipo == 'BALL LOST': marcas.append((max(int(e['End Frame']), f0), 1 - t))
        if tipo == 'BALL OUT' or (tipo == 'SHOT' and ('GOAL' in sub or 'OUT' in sub)) or tipo == 'FAULT RECEIVED':
            marcas.append((max(int(e['End Frame']), f0) + 1, -1))
    marcas.sort(); atual = -1; j = 0
    for f in range(1, nq + 1):
        while j < len(marcas) and marcas[j][0] <= f:
            atual = marcas[j][1]; j += 1
        pos[f] = atual
    return pos

def resumo(v, nd=1):
    v = np.asarray(v, float); v = v[~np.isnan(v)]
    if len(v) == 0: return None
    q = np.percentile(v, [10, 25, 50, 75, 90])
    return {'media': round(float(v.mean()), nd), 'p10': round(float(q[0]), nd), 'p25': round(float(q[1]), nd),
            'mediana': round(float(q[2]), nd), 'p75': round(float(q[3]), nd), 'p90': round(float(q[4]), nd), 'n': int(len(v))}

def jogo(g):
    per, fr, jogC, xC, yC, bx, by = carrega_time(f'{PASTA}/g{g}_RawTrackingData_Home_Team.csv')
    _, fr2, jogF, xF, yF, _, _ = carrega_time(f'{PASTA}/g{g}_RawTrackingData_Away_Team.csv')
    n = min(len(fr), len(fr2))
    per, fr = per[:n], fr[:n]; xC, yC, xF, yF, bx, by = xC[:n], yC[:n], xF[:n], yF[:n], bx[:n], by[:n]
    ev = pd.read_csv(f'{PASTA}/g{g}_RawEventsData.csv')
    pos = posse_por_quadro(ev, int(fr.max()))[fr]
    em_jogo = (pos >= 0) & ~np.isnan(bx)
    times = [(jogC, xC, yC), (jogF, xF, yF)]; info = []
    for t, (jog, x, y) in enumerate(times):
        mx = np.nanmean(x[per == 1], 0); gk = int(np.nanargmax(np.abs(mx))); dirs = {}
        for p in (1, 2): dirs[p] = 1.0 if np.nanmean(x[per == p, gk]) < 0 else -1.0
        info.append({'gk': gk, 'dir': np.where(per == 1, dirs[1], dirs[2])})
    return dict(g=g, per=per, fr=fr, bx=bx, by=by, pos=pos, em_jogo=em_jogo, times=times, info=info, ev=ev, n=n)

J = [jogo(1), jogo(2)]
R = {}

# Coordenadas no padrão do GOLAÇO: u = rumo do ataque (+), z = direita de quem ataca (+).
def uz(Jg, t, ref=None):
    # posições do time t no referencial do time ref (padrão: o próprio t)
    ref = t if ref is None else ref
    jog, x, y = Jg['times'][t]; d = Jg['info'][ref]['dir']
    return x * d[:, None], -y * d[:, None], Jg['bx'] * d, -Jg['by'] * d

# ---------- 1) posição média por função, com/sem bola, bola no terço do meio e por terço ----------
pos_fun = {}
for Jg in J:
    for t in (0, 1):
        u, z, ub, zb = uz(Jg, t); gk = Jg['info'][t]['gk']
        for p in (1, 2):
            mp = (Jg['per'] == p) & Jg['em_jogo']
            mu = np.nanmean(u[mp], 0); mz = np.nanmean(z[mp], 0); pres = np.mean(~np.isnan(u[mp]), 0)
            campo = [i for i in range(u.shape[1]) if i != gk and pres[i] > 0.6]
            if len(campo) != 10: continue
            campo.sort(key=lambda i: mu[i])
            defe = sorted(campo[:4], key=lambda i: mz[i]); meio = sorted(campo[4:8], key=lambda i: mz[i]); ataq = sorted(campo[8:], key=lambda i: mz[i])
            nomes = {defe[0]: 'LE', defe[1]: 'ZE', defe[2]: 'ZD', defe[3]: 'LD', meio[0]: 'ME', meio[1]: 'MCE', meio[2]: 'MCD', meio[3]: 'MD', ataq[0]: 'ATE', ataq[1]: 'ATD', gk: 'GOL'}
            for fase, cod in (('com', t), ('sem', 1 - t)):
                for terco in ('t1', 't2', 't3', 'meio_centro'):
                    m = mp & (Jg['pos'] == cod) & ~np.isnan(ub)
                    if terco == 't1': m &= ub < -17.5
                    elif terco == 't2': m &= (ub >= -17.5) & (ub < 17.5)
                    elif terco == 't3': m &= ub >= 17.5
                    else: m &= (np.abs(ub) < 10) & (np.abs(zb) < 10)
                    if m.sum() < 250: continue
                    for i, nm in nomes.items():
                        k = f'{fase}|{terco}|{nm}'
                        pos_fun.setdefault(k, []).append((float(np.nanmean(u[m, i])), float(np.nanmean(z[m, i]))))
R['posicao_media_funcao'] = {k: [round(float(np.mean([a for a, b in v])), 1), round(float(np.mean([b for a, b in v])), 1), len(v)] for k, v in sorted(pos_fun.items())}

# ---------- 2) forma por terço com bola; linha de 4; impedimento; pressionadores ----------
F = {k: [] for k in ['comp_com_t1', 'comp_com_t2', 'comp_com_t3', 'larg_com_t1', 'larg_com_t2', 'larg_com_t3',
                     'larg_sem_t1', 'larg_sem_t2', 'larg_sem_t3', 'linha_com_t1', 'linha_com_t2', 'linha_com_t3',
                     'espalha_linha4_sem', 'espalha_linha4_sem_t1', 'espalha_linha4_sem_t2', 'espalha_linha4_sem_t3',
                     'dp_linha4_sem', 'linha_atras_da_bola_sem_t1', 'linha_atras_da_bola_sem_t2', 'linha_atras_da_bola_sem_t3',
                     'atacante_ate_linha_impedimento', 'pct_impedido', 'def_a_10m_portador_t1', 'def_a_10m_portador_t2', 'def_a_10m_portador_t3',
                     'def_a_5m_portador_t1', 'def_a_5m_portador_t2', 'def_a_5m_portador_t3', 'marcador_portador_t1', 'marcador_portador_t2', 'marcador_portador_t3',
                     'segundo_marcador_portador', 'centroides_distancia_u', 'def_a_10m_portador', 'marcador_portador']}
for Jg in J:
    idx = np.where(Jg['em_jogo'])[0][::5]
    for t in (0, 1):
        u, z, ub, zb = uz(Jg, t); gk = Jg['info'][t]['gk']
        uA, zA, _, _ = uz(Jg, 1 - t, t); gkA = Jg['info'][1 - t]['gk']
        for f in idx:
            com = Jg['pos'][f] == t
            camp = [i for i in range(u.shape[1]) if i != gk and not np.isnan(u[f, i])]
            campA = [i for i in range(uA.shape[1]) if i != gkA and not np.isnan(uA[f, i])]
            if len(camp) < 10 or len(campA) < 10 or np.isnan(ub[f]): continue
            cu = u[f, camp]; cz = z[f, camp]
            terco = 't1' if ub[f] < -17.5 else ('t2' if ub[f] < 17.5 else 't3')
            srt = np.sort(cu)
            if com:
                F['comp_com_' + terco].append(cu.max() - cu.min()); F['larg_com_' + terco].append(cz.max() - cz.min())
                F['linha_com_' + terco].append(srt[0] + 52.5)
                # impedimento: o adversário defende o gol em u = +52,5. Penúltimo defensor (com o goleiro)
                todos = np.sort(np.concatenate([uA[f, campA], [uA[f, gkA]] if not np.isnan(uA[f, gkA]) else []]))
                if len(todos) >= 2:
                    linha_imp = max(todos[-2], ub[f], 0.0)
                    F.setdefault('linha_imp_menos_ultimo_def_linha', []).append(todos[-2] - (todos[-1] if np.isnan(uA[f, gkA]) else np.sort(uA[f, campA])[-1]))
                    mais_adiant = cu.max()
                    F['atacante_ate_linha_impedimento'].append(linha_imp - mais_adiant)
                    F['pct_impedido'].append(100.0 * float(np.any((cu > linha_imp + 0.0) & (cu > 0))))
            else:
                F['larg_sem_' + terco].append(cz.max() - cz.min())
                l4 = srt[:4]
                F['espalha_linha4_sem'].append(l4.max() - l4.min()); F['espalha_linha4_sem_' + terco].append(l4.max() - l4.min())
                F['dp_linha4_sem'].append(float(np.std(l4)))
                F['linha_atras_da_bola_sem_' + terco].append(ub[f] - srt[0])
                # portador adversário = jogador do outro time mais perto da bola, se a ≤ 1,5 m
                dA = np.hypot(uA[f, campA] - ub[f], zA[f, campA] - zb[f])
                if dA.min() <= 1.5:
                    dd = np.sort(np.hypot(cu - ub[f], cz - zb[f]))
                    tB = 't1' if ub[f] < -17.5 else ('t2' if ub[f] < 17.5 else 't3')  # terço pelo time que defende
                    F['marcador_portador_' + tB].append(dd[0]); F['segundo_marcador_portador'].append(dd[1])
                    F['marcador_portador'].append(dd[0]); F['def_a_10m_portador'].append(float(np.sum(dd <= 10)))
                    F['def_a_10m_portador_' + tB].append(float(np.sum(dd <= 10))); F['def_a_5m_portador_' + tB].append(float(np.sum(dd <= 5)))
            F['centroides_distancia_u'].append(abs(cu.mean() - uA[f, campA].mean()))
R['forma_extra'] = {k: resumo(v) for k, v in F.items()}

# ---------- 3) contrapressão: depois da perda em jogo corrido ----------
cp = {'d_mais_perto_t0': [], 'd_mais_perto_t1': [], 'd_mais_perto_t2': [], 'd_mais_perto_t3': [], 'd_mais_perto_t5': [],
      'outro_mais_perto_t0': [], 'n_a_10m_t0': [], 'n_a_10m_t2': [], 'n_a_5m_t2': [], 'tempo_ate_2m': [], 'retomou_5s': [], 'retomou_10s': [], 'pressao_2m_em_3s': []}
for Jg in J:
    ev = Jg['ev']; fr2i = {int(f): i for i, f in enumerate(Jg['fr'])}
    perdas = ev[(ev['Type'] == 'BALL LOST') & ~ev['Subtype'].astype(str).str.contains('END HALF|OFFSIDE|HAND|GOAL KICK', regex=True)]
    for _, e in perdas.iterrows():
        t = 0 if e['Team'] == 'Home' else 1
        f0 = int(e['End Frame']) if not np.isnan(e['End Frame']) else int(e['Start Frame'])
        if f0 not in fr2i: continue
        i0 = fr2i[f0]
        u, z, ub, zb = uz(Jg, t); gk = Jg['info'][t]['gk']
        camp = [i for i in range(u.shape[1]) if i != gk]
        jogs = Jg['times'][t][0]; quem = str(e['From']).replace(' ', '')
        camp2 = [i for i in camp if jogs[i] != quem]
        def dist2(i):
            if i >= Jg['n'] or np.isnan(ub[i]): return None
            d = np.hypot(u[i, camp2] - ub[i], z[i, camp2] - zb[i]); d = d[~np.isnan(d)]
            return np.sort(d) if len(d) >= 8 else None
        def dist(i):
            if i >= Jg['n'] or np.isnan(ub[i]): return None
            d = np.hypot(u[i, camp] - ub[i], z[i, camp] - zb[i]); d = d[~np.isnan(d)]
            return np.sort(d) if len(d) >= 8 else None
        d0 = dist(i0)
        if d0 is None: continue
        for s, k in ((0, 't0'), (1, 't1'), (2, 't2'), (3, 't3'), (5, 't5')):
            dd = dist(i0 + int(s * FPS))
            if dd is not None: cp['d_mais_perto_' + k].append(dd[0])
        cp['n_a_10m_t0'].append(float(np.sum(d0 <= 10)))
        o0 = dist2(i0)
        if o0 is not None: cp['outro_mais_perto_t0'].append(o0[0])
        d2 = dist(i0 + 50)
        if d2 is not None: cp['n_a_10m_t2'].append(float(np.sum(d2 <= 10))); cp['n_a_5m_t2'].append(float(np.sum(d2 <= 5)))
        tt = None
        for k in range(0, int(5 * FPS)):
            dd = dist2(i0 + k)
            if dd is not None and dd[0] <= 2.0: tt = k / FPS; break
        if tt is not None: cp['tempo_ate_2m'].append(tt)
        cp['pressao_2m_em_3s'].append(100.0 * (tt is not None and tt <= 3.0))
        jan5 = Jg['pos'][i0 + 5: min(i0 + int(5 * FPS), Jg['n'])]; jan10 = Jg['pos'][i0 + 5: min(i0 + int(10 * FPS), Jg['n'])]
        cp['retomou_5s'].append(100.0 * float(np.any(jan5 == t))); cp['retomou_10s'].append(100.0 * float(np.any(jan10 == t)))
R['contrapressao'] = {k: resumo(v) for k, v in cp.items()}
R['contrapressao']['n_perdas'] = len(cp['retomou_5s'])

# ---------- 4) cruzamentos: quantos atacantes/defensores na área ----------
cz_ = {'atq_area_no_cruzamento': [], 'def_area_no_cruzamento': [], 'atq_area_na_chegada': [], 'def_area_na_chegada': [],
       'atq_area_escanteio': [], 'def_area_escanteio': []}
for Jg in J:
    ev = Jg['ev']; fr2i = {int(f): i for i, f in enumerate(Jg['fr'])}
    sub = ev['Subtype'].astype(str)
    crz = ev[sub.str.contains('CROSS') & ev['Type'].isin(['PASS', 'BALL LOST', 'BALL OUT'])]
    esc = ev[(ev['Type'] == 'SET PIECE') & sub.str.contains('CORNER')]
    def conta(e, chave_atq, chave_def, quadro):
        t = 0 if e['Team'] == 'Home' else 1
        if quadro not in fr2i: return
        i = fr2i[quadro]
        u, z, _, _ = uz(Jg, t); uA, zA, _, _ = uz(Jg, 1 - t, t)
        na = np.sum((u[i] > 36.0) & (np.abs(z[i]) < 20.16)); nd = np.sum((uA[i] > 36.0) & (np.abs(zA[i]) < 20.16))
        cz_[chave_atq].append(float(na)); cz_[chave_def].append(float(nd))
    for _, e in crz.iterrows():
        conta(e, 'atq_area_no_cruzamento', 'def_area_no_cruzamento', int(e['Start Frame']))
        if not np.isnan(e['End Frame']): conta(e, 'atq_area_na_chegada', 'def_area_na_chegada', int(e['End Frame']))
    # escanteio: conta no quadro da cobrança (def inclui o goleiro)
    for _, e in esc.iterrows():
        conta(e, 'atq_area_escanteio', 'def_area_escanteio', int(e['Start Frame']))
R['cruzamentos'] = {k: resumo(v) for k, v in cz_.items()}

# ---------- 5) PPDA (aproximado com os eventos da Metrica) ----------
ppda = []
for Jg in J:
    ev = Jg['ev']; sub = ev['Subtype'].astype(str)
    for t, nome in ((0, 'Home'), (1, 'Away')):
        adv = 'Away' if nome == 'Home' else 'Home'
        # x dos eventos é 0..1 do campo; o sentido muda por tempo. Zona = 60% do campo mais perto do gol do adversário (onde ele constrói).
        def u_evento(e, time_idx):
            d = Jg['info'][time_idx]['dir'][0] if e['Period'] == 1 else Jg['info'][time_idx]['dir'][-1]
            return (e['Start X'] - 0.5) * L * d
        passes = ev[(ev['Team'] == adv) & (ev['Type'] == 'PASS')]
        n_pass = sum(1 for _, e in passes.iterrows() if u_evento(e, 1 - t) < 0.1 * L)  # u do adversário < +10,5 = 60% dele
        acoes = ev[(ev['Team'] == nome) & (((ev['Type'] == 'RECOVERY') & sub.str.contains('INTERCEPTION|THEFT')) |
                                           ((ev['Type'] == 'CHALLENGE') & sub.str.contains('TACKLE-WON|GROUND-WON|FAULT-LOST')))]
        n_ac = sum(1 for _, e in acoes.iterrows() if u_evento(e, t) > -0.1 * L)
        ppda.append({'jogo': Jg['g'], 'time': nome, 'passes_adv': n_pass, 'acoes_def': n_ac, 'ppda': round(n_pass / max(n_ac, 1), 1)})
R['ppda_aprox'] = ppda

# ---------- 6) disputa aérea: quem disputa era o mais perto do ponto no lançamento? ----------
ae = {'disputas': 0, 'mais_perto_no_lancamento': 0, 'entre_2_mais_perto': 0, 'mais_perto_0_5s_antes': 0}
duelos_por_jogo = {}
for Jg in J:
    ev = Jg['ev'].reset_index(drop=True); fr2i = {int(f): i for i, f in enumerate(Jg['fr'])}
    sub = ev['Subtype'].astype(str)
    aer = ev[(ev['Type'] == 'CHALLENGE') & sub.str.contains('AERIAL')]
    duelos_por_jogo[Jg['g']] = round(len(aer) / 2.0, 1)
    for k, e in aer.iterrows():
        t = 0 if e['Team'] == 'Home' else 1
        quem = str(e['From'])
        jog = Jg['times'][t][0]
        nome_col = quem.replace(' ', '')
        if nome_col not in jog: continue
        ij = jog.index(nome_col); f1 = int(e['Start Frame'])
        if f1 not in fr2i or np.isnan(e['Start X']): continue
        # lançamento = último PASS/SET PIECE/BALL LOST antes da disputa (até 4 s antes)
        ant = ev[(ev['Start Frame'] < f1) & (ev['Start Frame'] >= f1 - 4 * FPS) & ev['Type'].isin(['PASS', 'SET PIECE', 'BALL LOST', 'RECOVERY'])]
        if len(ant) == 0: continue
        f0 = int(ant.iloc[-1]['Start Frame'])
        if f0 not in fr2i or f1 - f0 < 0.6 * FPS: continue
        i0, i1 = fr2i[f0], fr2i[f1]
        u, z, ub, zb = uz(Jg, t); gk = Jg['info'][t]['gk']
        pu, pz = u[i1, ij], z[i1, ij]  # ponto da disputa ≈ onde o disputante está
        if np.isnan(pu): continue
        cand = [i for i in range(u.shape[1]) if i != gk and not np.isnan(u[i0, i])]
        d = sorted(((math.hypot(u[i0, i] - pu, z[i0, i] - pz), i) for i in cand))
        ae['disputas'] += 1
        if d[0][1] == ij: ae['mais_perto_no_lancamento'] += 1
        if ij in (d[0][1], d[1][1]): ae['entre_2_mais_perto'] += 1
        im = max(i1 - int(0.5 * FPS), i0)
        d2 = sorted(((math.hypot(u[im, i] - pu, z[im, i] - pz), i) for i in cand if not np.isnan(u[im, i])))
        if d2 and d2[0][1] == ij: ae['mais_perto_0_5s_antes'] += 1
R['disputa_aerea'] = dict(ae, duelos_aereos_por_jogo=duelos_por_jogo)

json.dump(R, open(SAIDA, 'w'), ensure_ascii=False, indent=1)
print(json.dumps(R, ensure_ascii=False)[:200])
