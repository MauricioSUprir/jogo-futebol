# Coleta as estatisticas por partida de uma liga na API publica da ESPN (placar por dia + resumo por partida).
# uso: python3 espn_coleta.py <liga> <AAAA-MM-DD ini> <AAAA-MM-DD fim> <saida.jsonl>
import sys, json, subprocess, datetime, concurrent.futures as cf
liga, ini, fim, saida = sys.argv[1:5]
def get(url):
    r = subprocess.run(['curl', '-sS', '--compressed', '-m', '40', url], capture_output=True, text=True)
    try: return json.loads(r.stdout)
    except Exception: return None
d0 = datetime.date.fromisoformat(ini); d1 = datetime.date.fromisoformat(fim)
dias = [d0 + datetime.timedelta(n) for n in range((d1 - d0).days + 1)]
eventos = {}
def dia(d):
    j = get(f'https://site.api.espn.com/apis/site/v2/sports/soccer/{liga}/scoreboard?dates={d.strftime("%Y%m%d")}')
    out = []
    for e in (j or {}).get('events', []):
        st = e.get('status', {}).get('type', {})
        if st.get('completed'): out.append((e['id'], e['date']))
    return out
with cf.ThreadPoolExecutor(2) as ex:
    for lst in ex.map(dia, dias):
        for i, dt in lst: eventos[i] = dt
sys.stderr.write(f'{liga}: {len(eventos)} partidas\n')
ja = set()
try:
    for l in open(saida): ja.add(json.loads(l)['id'])
except FileNotFoundError: pass
def resumo(i):
    j = get(f'https://site.api.espn.com/apis/site/v2/sports/soccer/{liga}/summary?event={i}')
    if not j or 'boxscore' not in j: return None
    times = []
    for t in j['boxscore'].get('teams', []):
        st = {s['name']: s.get('displayValue') for s in t.get('statistics', [])}
        times.append({'nome': t['team']['displayName'], 'st': st})
    comp = j.get('header', {}).get('competitions', [{}])[0]
    placar = {c['team']['displayName']: c.get('score') for c in comp.get('competitors', [])}
    casa = [c['team']['displayName'] for c in comp.get('competitors', []) if c.get('homeAway') == 'home']
    return {'id': i, 'liga': liga, 'data': eventos[i], 'casa': casa[0] if casa else None, 'placar': placar, 'times': times}
with open(saida, 'a') as f, cf.ThreadPoolExecutor(2) as ex:
    for r in ex.map(resumo, [i for i in eventos if i not in ja]):
        if r: f.write(json.dumps(r, ensure_ascii=False) + '\n'); f.flush()
