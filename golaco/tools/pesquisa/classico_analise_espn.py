# Classicos x jogos comuns pelos dados por partida da ESPN (uma liga, varias temporadas), bruto e ajustado pelo time na temporada.
import json, random, sys, itertools
arq, liga = sys.argv[1], sys.argv[2]
def pares(*grupos):
    s = set()
    for g in grupos: s |= {frozenset(p) for p in itertools.combinations(g, 2)}
    return s
if liga == 'bra':
    RIO = ['Flamengo','Fluminense','Vasco da Gama','Botafogo']; SP = ['Corinthians','Palmeiras','São Paulo','Santos']
    MG = ['Atlético-MG','Cruzeiro','América Mineiro']
    A = pares(RIO, SP, MG, ['Grêmio','Internacional'], ['Athletico Paranaense','Coritiba'], ['Bahia','Vitória'], ['Ceará','Fortaleza'], ['Goiás','Atlético Goianiense'], ['Sport','Náutico'])
    GR = RIO + SP + ['Grêmio','Internacional','Atlético-MG','Cruzeiro']
    B = pares(GR) - A
elif liga == 'arg':
    A = {frozenset(p) for p in [('Boca Juniors','River Plate'),('Racing Club','Independiente'),('Rosario Central',"Newell's Old Boys"),('Estudiantes de La Plata','Gimnasia La Plata'),('San Lorenzo','Huracán'),('Colón (Santa Fe)','Unión (Santa Fe)'),('Talleres (Córdoba)','Belgrano (Córdoba)'),('Talleres (Córdoba)','Instituto (Córdoba)'),('Belgrano (Córdoba)','Instituto (Córdoba)'),('Banfield','Lanús'),('Godoy Cruz Antonio Tomba','Independiente Rivadavia'),('Atlético Tucumán','San Martín de Tucumán')]}
    B = pares(['Boca Juniors','River Plate','Racing Club','Independiente','San Lorenzo']) - A
elif liga == 'eng':
    LON = ['Arsenal','Chelsea','Tottenham Hotspur','West Ham United','Crystal Palace','Fulham','Brentford']
    A = {frozenset(p) for p in [('Arsenal','Tottenham Hotspur'),('Liverpool','Everton'),('Manchester United','Manchester City'),('Liverpool','Manchester United'),('Aston Villa','Wolverhampton Wanderers'),('Newcastle United','Sunderland'),('Nottingham Forest','Leicester City'),('Southampton','AFC Bournemouth'),('Brighton & Hove Albion','Crystal Palace')]}
    B = pares(LON) - A
elif liga == 'esp':
    A = {frozenset(p) for p in [('Real Madrid','Atlético Madrid'),('Barcelona','Espanyol'),('Sevilla','Real Betis'),('Barcelona','Real Madrid'),('Athletic Club','Real Sociedad'),('Valencia','Levante'),('Celta Vigo','Deportivo La Coruña')]}
    B = pares(['Real Madrid','Atlético Madrid','Getafe','Rayo Vallecano','Leganés']) | pares(['Athletic Club','Real Sociedad','Alavés','Osasuna']) | pares(['Valencia','Villarreal','Levante']) | pares(['Sevilla','Real Betis','Cádiz','Granada','Almería'])
    B -= A
elif liga == 'ita':
    A = {frozenset(p) for p in [('Juventus','Torino'),('Internazionale','AC Milan'),('AS Roma','Lazio'),('Genoa','Sampdoria'),('Internazionale','Juventus')]}
    B = {frozenset(p) for p in [('AC Milan','Juventus'),('Napoli','Juventus'),('Napoli','AS Roma'),('Fiorentina','Juventus'),('Fiorentina','Empoli'),('Bologna','Fiorentina'),('Atalanta','Internazionale'),('Atalanta','AC Milan'),('Internazionale','Como'),('AC Milan','Como'),('Internazionale','Monza'),('AC Milan','Monza'),('Lecce','Salernitana'),('Napoli','Salernitana')]} - A
else:
    A = set(); B = set()
rows = []; vistos = set()
for l in (ln for a in arq.split(',') for ln in open(a)):
    r = json.loads(l)
    if r['id'] in vistos: continue
    vistos.add(r['id'])
    if len(r['times']) != 2: continue
    t0, t1 = r['times']
    def num(st, k):
        try: return float(st.get(k) or 0)
        except ValueError: return 0.0
    temp = r['data'][:4]
    if liga in ('eng', 'esp', 'ita') and int(r['data'][5:7]) < 7: temp = str(int(temp) - 1)  # temporada europeia: ago-mai
    k = frozenset((t0['nome'], t1['nome']))
    g = 'A' if k in A else 'B' if k in B else 'N'
    lado = {}
    for t in (t0, t1):
        st = t['st']; nome = t['nome']
        gols = float(r['placar'].get(nome) or 0)
        lado[nome] = {'faltas': num(st,'foulsCommitted'), 'amarelos': num(st,'yellowCards'), 'vermelhos': num(st,'redCards'),
                      'tackles': num(st,'totalTackles'), 'tackles_ok': num(st,'effectiveTackles'), 'intercept': num(st,'interceptions'),
                      'chutes': num(st,'totalShots'), 'no_alvo': num(st,'shotsOnTarget'), 'gols': gols, 'passes': num(st,'totalPasses'),
                      'cruzamentos': num(st,'totalCrosses'), 'impedimentos': num(st,'offsides')}
    if sum(v['faltas'] for v in lado.values()) == 0: continue
    # partida sem passes ou sem desarmes de um dos times: estatistica incompleta na ESPN (fica de fora)
    if any(v['passes'] == 0 or v['tackles'] == 0 for v in lado.values()): continue
    rows.append({'temp': temp, 'times': (t0['nome'], t1['nome']), 'g': g, 'lado': lado})
MET = ['faltas','amarelos','vermelhos','tackles','tackles_ok','intercept','chutes','no_alvo','gols','passes','cruzamentos','impedimentos']
base = {}; sofre = {}; liga_m = {}
for x in rows:
    if x['g'] != 'N': continue
    for t in x['times']:
        o = [u for u in x['times'] if u != t][0]
        d = base.setdefault((x['temp'], t), {'n': 0}); d['n'] += 1
        e = sofre.setdefault((x['temp'], o), {'n': 0}); e['n'] += 1
        L = liga_m.setdefault(x['temp'], {'n': 0}); L['n'] += 1
        for m in MET:
            v = x['lado'][t][m]; d[m] = d.get(m, 0) + v; e[m] = e.get(m, 0) + v; L[m] = L.get(m, 0) + v
def tot(x, m): return sum(x['lado'][t][m] for t in x['times'])
DUPLO = '--duplo' in sys.argv
def esp(x, m):
    s = 0
    for t in x['times']:
        o = [u for u in x['times'] if u != t][0]
        c = base[(x['temp'], t)][m] / base[(x['temp'], t)]['n']
        if DUPLO:
            L = liga_m[x['temp']][m] / liga_m[x['temp']]['n']
            so = sofre[(x['temp'], o)][m] / sofre[(x['temp'], o)]['n']
            c = c * so / L if L else c
        s += c
    return s
def ok(x): return all((x['temp'], t) in base and base[(x['temp'], t)]['n'] >= 5 for t in x['times'])
random.seed(2)
def razao_aj(lst, m):
    o = [tot(x, m) for x in lst]; e = [esp(x, m) for x in lst]
    r0 = sum(o) / sum(e) if sum(e) else float('nan'); rs = []
    for _ in range(4000):
        idx = [random.randrange(len(lst)) for _ in lst]; se = sum(e[i] for i in idx)
        if se: rs.append(sum(o[i] for i in idx) / se)
    rs.sort(); return r0, rs[100], rs[3899]
def med(lst, m): return sum(tot(x, m) for x in lst) / len(lst)
print(liga, 'partidas', len(rows), {g: sum(1 for x in rows if x['g'] == g) for g in 'ABN'}, 'temporadas', sorted({x['temp'] for x in rows}))
N = [x for x in rows if x['g'] == 'N']
SAIDA = {}
for grupo in ('A', 'B'):
    lst = [x for x in rows if x['g'] == grupo and ok(x)]
    if not lst: continue
    print(f'=== grupo {grupo}: {len(lst)} partidas x {len(N)} comuns ===')
    for m in MET:
        r0, lo, hi = razao_aj(lst, m)
        SAIDA.setdefault(grupo, {})[m] = [r0, lo, hi, len(lst)]
        print(f'{m:13s} classico {med(lst, m):7.2f} comum {med(N, m):7.2f} bruto {med(lst, m)/med(N, m)-1:+6.1%} ajustado {r0-1:+6.1%} [{lo-1:+.1%}, {hi-1:+.1%}]')
    for nome, a, b in (('amarelo/falta', 'amarelos', 'faltas'), ('vermelho/falta', 'vermelhos', 'faltas'), ('falta/(tackle+falta)', 'faltas', 'tackles')):
        f = (lambda L: sum(tot(x, a) for x in L) / sum(tot(x, b) for x in L)) if nome != 'falta/(tackle+falta)' else (lambda L: sum(tot(x, 'faltas') for x in L) / sum(tot(x, 'faltas') + tot(x, 'tackles') for x in L))
        v1, v0 = f(lst), f(N); rs = sorted(f([random.choice(lst) for _ in lst]) / v0 for _ in range(2000))
        SAIDA.setdefault(grupo, {})[nome] = [v1 / v0, rs[50], rs[1949], len(lst)]
        print(f'{nome:22s} classico {v1:.4f} comum {v0:.4f} {v1/v0-1:+6.1%} [{rs[50]-1:+.1%}, {rs[1949]-1:+.1%}]')
    # a fracao falta / (desarme + falta) com o esperado pelo estilo dos dois times (ajustada), e o amarelo por falta ajustado
    def fr_aj(L):
        of = sum(tot(x, 'faltas') for x in L); ot = sum(tot(x, 'tackles') for x in L)
        ef = sum(esp(x, 'faltas') for x in L); et = sum(esp(x, 'tackles') for x in L)
        return (of / (of + ot)) / (ef / (ef + et))
    def am_aj(L):
        return (sum(tot(x, 'amarelos') for x in L) / sum(tot(x, 'faltas') for x in L)) / (sum(esp(x, 'amarelos') for x in L) / sum(esp(x, 'faltas') for x in L))
    for nome, f in (('falta/disputa ajustada', fr_aj), ('amarelo/falta ajustado', am_aj)):
        v = f(lst); rs = sorted(f([random.choice(lst) for _ in lst]) for _ in range(2000))
        SAIDA.setdefault(grupo, {})[nome] = [v, rs[50], rs[1949], len(lst)]
        print(f'{nome:22s} {v-1:+6.1%} [{rs[50]-1:+.1%}, {rs[1949]-1:+.1%}]')
    if grupo == 'A':
        porpar = {}
        for x in lst: porpar.setdefault(' x '.join(sorted(x['times'])), []).append(x)
        for p, L in sorted(porpar.items(), key=lambda kv: -len(kv[1])):
            o = sum(tot(x, 'faltas') for x in L); e = sum(esp(x, 'faltas') for x in L)
            print(f'   {p:45s} n={len(L)} faltas {o/len(L):5.1f} (esperado {e/len(L):5.1f}, {o/e-1:+.0%}) amarelos {sum(tot(x,"amarelos") for x in L)/len(L):.1f} vermelhos {sum(tot(x,"vermelhos") for x in L)/len(L):.2f}')

for a in sys.argv:
    if a.startswith('--json='): json.dump(SAIDA, open(a[7:], 'w'), ensure_ascii=False)
