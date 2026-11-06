# Compara classicos x jogos comuns no StatsBomb Open Data 2015/16 (5 ligas), por partida e ajustado pelo time.
import json, glob, random, sys
S = sys.argv[1]
A = {
 'Premier League': [('Arsenal','Tottenham Hotspur'),('Liverpool','Everton'),('Manchester United','Manchester City'),('Newcastle United','Sunderland'),('Liverpool','Manchester United'),('Aston Villa','West Bromwich Albion')],
 'La Liga': [('Real Madrid','Atlético Madrid'),('Barcelona','Espanyol'),('Sevilla','Real Betis'),('Barcelona','Real Madrid'),('Athletic Club','Real Sociedad'),('Celta Vigo','RC Deportivo La Coruña'),('Valencia','Levante UD')],
 'Serie A': [('Juventus','Torino'),('Inter Milan','AC Milan'),('AS Roma','Lazio'),('Genoa','Sampdoria'),('Chievo','Hellas Verona'),('Inter Milan','Juventus')],
 '1. Bundesliga': [('Bayer Leverkusen','FC Köln')],
 'Ligue 1': [('Paris Saint-Germain','Olympique de Marseille'),('Lyon','Saint-Étienne'),('Bastia','Gazélec Ajaccio'),('OGC Nice','AS Monaco')],
}
LON = ['Arsenal','Chelsea','Tottenham Hotspur','West Ham United','Crystal Palace','Watford']
B = {
 'Premier League': [(a,b) for i,a in enumerate(LON) for b in LON[i+1:]] + [('Southampton','AFC Bournemouth')],
 'La Liga': [('Real Madrid','Rayo Vallecano'),('Real Madrid','Getafe'),('Atlético Madrid','Rayo Vallecano'),('Atlético Madrid','Getafe'),('Rayo Vallecano','Getafe'),('Athletic Club','Eibar'),('Real Sociedad','Eibar'),('Valencia','Villarreal'),('Levante UD','Villarreal'),('Málaga','Granada'),('Sevilla','Málaga'),('Real Betis','Málaga'),('Sevilla','Granada'),('Real Betis','Granada')],
 'Serie A': [('AC Milan','Juventus'),('Napoli','Juventus'),('Napoli','AS Roma'),('Fiorentina','Juventus'),('Fiorentina','Empoli'),('Sassuolo','Carpi'),('Bologna','Fiorentina')],
 '1. Bundesliga': [('Bayer Leverkusen','Borussia Mönchengladbach')],
 'Ligue 1': [('Rennes','Nantes'),('Rennes','Guingamp'),('Rennes','Lorient'),('Guingamp','Lorient'),('Nantes','Guingamp'),('Nantes','Lorient'),('Lyon','Olympique de Marseille'),('Bordeaux','Toulouse'),('OGC Nice','Olympique de Marseille')],
}
def chave(l, a, b): return (l, frozenset((a, b)))
SA = {chave(l, a, b) for l, ps in A.items() for a, b in ps}
SB = {chave(l, a, b) for l, ps in B.items() for a, b in ps} - SA
info = {}
for f in glob.glob(f'{S}/sb/m_*.json'):
    for x in json.load(open(f)):
        l = x['competition']['competition_name']; h = x['home_team']['home_team_name']; a = x['away_team']['away_team_name']
        info[str(x['match_id'])] = (l, h, a)
rows = []
for ln in open(f'{S}/sb/resumos.jsonl'):
    r = json.loads(ln)
    if 'erro' in r: continue
    l, h, a = info[r['id']]
    k = chave(l, h, a)
    grupo = 'A' if k in SA else 'B' if k in SB else 'N'
    T = r['times']
    def g(t, c): return T.get(t, {}).get(c, 0)
    lado = {}
    for t, o in ((h, a), (a, h)):
        lado[t] = {
          'faltas': g(t,'faltas'), 'amarelos': g(t,'amarelo_falta') + g(t,'amarelo_conduta') + g(t,'segundo_amarelo'),
          'amarelo_falta': g(t,'amarelo_falta'), 'vermelhos': g(t,'vermelho_direto') + g(t,'segundo_amarelo'),
          'tackles': g(t,'tackles'), 'tackles_ok': g(t,'tackles_ok'), 'aereos': g(t,'aereo_perdido') + g(o,'aereo_perdido'),
          'div5050': g(t,'dividida5050'), 'pressao': g(t,'pressao'), 'drib_sofridos': g(o,'dribles'), 'driblado': g(t,'driblado'),
          'intercept': g(t,'intercept'), 'recupera': g(t,'recupera'), 'chutes': g(t,'chutes'), 'gols': g(t,'gols'),
          'passes': g(t,'passes'), 'passes_ok': g(t,'passes_ok'), 'penalti': g(t,'penalti'), 'mao': g(t,'mao'), 'vantagem': g(t,'vantagem')}
    bip = r['min_total'] - r['min_morto']
    rows.append({'id': r['id'], 'liga': l, 'h': h, 'a': a, 'grupo': grupo, 'lado': lado, 'bip': bip, 'min_total': r['min_total'], 'reinicios': r['reinicios']})
print('partidas', len(rows), {g: sum(1 for x in rows if x['grupo'] == g) for g in 'ABN'})
MET = ['faltas','amarelos','amarelo_falta','vermelhos','tackles','div5050','pressao','drib_sofridos','driblado','intercept','recupera','chutes','gols','passes','penalti','vantagem']
# media por time (comprometido) nas partidas N
base = {}; sofre = {}; liga_m = {}
for x in rows:
    if x['grupo'] != 'N': continue
    for t in (x['h'], x['a']):
        o = x['a'] if t == x['h'] else x['h']
        d = base.setdefault((x['liga'], t), {'n': 0})
        e = sofre.setdefault((x['liga'], o), {'n': 0}); e['n'] += 1
        L = liga_m.setdefault(x['liga'], {'n': 0}); L['n'] += 1
        d['n'] += 1
        for m in MET:
            v = x['lado'][t][m]; d[m] = d.get(m, 0) + v; e[m] = e.get(m, 0) + v; L[m] = L.get(m, 0) + v
        d['bip'] = d.get('bip', 0) + x['bip']; d['aereos'] = d.get('aereos', 0) + x['lado'][t]['aereos']
        d['reinicios'] = d.get('reinicios', 0) + x['reinicios']
DUPLO = '--duplo' in sys.argv
def esperado(x, m):
    s = 0
    for t in (x['h'], x['a']):
        o = x['a'] if t == x['h'] else x['h']
        d = base[(x['liga'], t)]; c = d[m] / d['n']
        if DUPLO:
            L = liga_m[x['liga']][m] / liga_m[x['liga']]['n']; so = sofre[(x['liga'], o)][m] / sofre[(x['liga'], o)]['n']
            c = c * so / L if L else c
        s += c
    return s
def total(x, m):
    if m == 'bip': return x['bip']
    if m == 'aereos': return x['lado'][x['h']]['aereos']
    if m == 'reinicios': return x['reinicios']
    return x['lado'][x['h']][m] + x['lado'][x['a']][m]
def esp_total(x, m):
    if m in ('bip', 'aereos', 'reinicios'):
        return sum(base[(x['liga'], t)][m] / base[(x['liga'], t)]['n'] for t in (x['h'], x['a'])) / 2
    return esperado(x, m)
rows = [x for x in rows if x['liga'] != '1. Bundesliga']  # so as partidas do Leverkusen: sem a base dos outros times
print('sem a Bundesliga (so Leverkusen):', len(rows), {g: sum(1 for x in rows if x['grupo'] == g) for g in 'ABN'})
random.seed(1)
def boot(lst, m, n=4000):
    obs = [total(x, m) for x in lst]; esp = [esp_total(x, m) for x in lst]
    r0 = sum(obs) / sum(esp) if sum(esp) else float('nan')
    rs = []
    for _ in range(n):
        idx = [random.randrange(len(lst)) for _ in lst]
        se = sum(esp[i] for i in idx)
        if se: rs.append(sum(obs[i] for i in idx) / se)
    rs.sort()
    return r0, rs[int(0.025 * len(rs))], rs[int(0.975 * len(rs))]
def media(lst, m): return sum(total(x, m) for x in lst) / len(lst)
print()
SAIDA = {}
for grupo in ('A', 'B', 'A+B'):
    lst = [x for x in rows if (x['grupo'] in grupo.split('+'))]
    N = [x for x in rows if x['grupo'] == 'N']
    print(f'=== grupo {grupo}: {len(lst)} partidas x {len(N)} comuns ===')
    for m in MET + ['aereos', 'bip', 'reinicios']:
        r0, lo, hi = boot(lst, m)
        SAIDA.setdefault(grupo, {})[m] = [r0, lo, hi, len(lst)]
        print(f'{m:14s} classico {media(lst, m):7.2f}  comum {media(N, m):7.2f}  bruto {media(lst, m)/media(N, m)-1:+6.1%}  ajustado pelo time {r0-1:+6.1%} [{lo-1:+.1%}, {hi-1:+.1%}]')
    # razoes
    def razao(lst, a, b):
        return sum(total(x, a) for x in lst) / sum(total(x, b) for x in lst)
    for nome, a, b in (('amarelo/falta', 'amarelo_falta', 'faltas'), ('falta/(tackle+falta)', 'faltas', None), ('falta/drible sofrido', 'faltas', 'drib_sofridos'), ('falta/pressao', 'faltas', 'pressao'), ('falta/min bola rolando', 'faltas', 'bip'), ('tackle/min bola rolando', 'tackles', 'bip'), ('pressao/min bola rolando', 'pressao', 'bip')):
        if b is None:
            f = lambda L: sum(total(x, 'faltas') for x in L) / sum(total(x, 'faltas') + total(x, 'tackles') for x in L)
        else:
            f = lambda L: razao(L, a, b)
        v1, v0 = f(lst), f(N)
        rs = sorted(f([random.choice(lst) for _ in lst]) / v0 for _ in range(2000))
        SAIDA.setdefault(grupo, {})[nome] = [v1 / v0, rs[50], rs[1949], len(lst)]
        print(f'{nome:24s} classico {v1:.4f}  comum {v0:.4f}  {v1/v0-1:+6.1%} [{rs[50]-1:+.1%}, {rs[1949]-1:+.1%}]')
    def fr_aj(L):
        of = sum(total(x, 'faltas') for x in L); ot = sum(total(x, 'tackles') for x in L)
        ef = sum(esp_total(x, 'faltas') for x in L); et = sum(esp_total(x, 'tackles') for x in L)
        return (of / (of + ot)) / (ef / (ef + et))
    def am_aj(L):
        return (sum(total(x, 'amarelo_falta') for x in L) / sum(total(x, 'faltas') for x in L)) / (sum(esp_total(x, 'amarelo_falta') for x in L) / sum(esp_total(x, 'faltas') for x in L))
    for nome, f in (('falta/disputa ajustada', fr_aj), ('amarelo/falta ajustado', am_aj)):
        v = f(lst); rs = sorted(f([random.choice(lst) for _ in lst]) for _ in range(2000))
        SAIDA.setdefault(grupo, {})[nome] = [v, rs[50], rs[1949], len(lst)]
        print(f'{nome:24s} {v-1:+6.1%} [{rs[50]-1:+.1%}, {rs[1949]-1:+.1%}]')
    print()
# por liga, grupo A
for l in sorted({x['liga'] for x in rows}):
    lst = [x for x in rows if x['liga'] == l and x['grupo'] == 'A']; N = [x for x in rows if x['liga'] == l and x['grupo'] == 'N']
    if not lst: continue
    s = ' '.join(f"{m} {media(lst, m)/media(N, m)-1:+.0%}" for m in ('faltas', 'amarelos', 'vermelhos', 'tackles', 'pressao', 'chutes', 'gols', 'bip'))
    print(f'{l:16s} A={len(lst):2d} N={len(N):3d}  {s}')
print()
for x in sorted([x for x in rows if x['grupo'] == 'A'], key=lambda x: (x['liga'], x['h'])):
    print(f"  {x['liga'][:10]:10s} {x['h'][:18]:18s} x {x['a'][:18]:18s} faltas {total(x,'faltas'):3d} (esp {esp_total(x,'faltas'):5.1f}) amarelos {total(x,'amarelos')} verm {total(x,'vermelhos')} tackles {total(x,'tackles')} gols {total(x,'gols')} bip {x['bip']:.1f}")

for a in sys.argv:
    if a.startswith('--json='): json.dump(SAIDA, open(a[7:], 'w'), ensure_ascii=False)
