# Le os eventos de UMA partida do StatsBomb Open Data pela entrada padrao e imprime uma linha JSON de resumo.
import sys, json
mid = sys.argv[1]
ev = json.load(sys.stdin)
def ts(e):
    h, m, s = e['timestamp'].split(':'); return int(h) * 3600 + int(m) * 60 + float(s)
REST_PASS = {'Throw-in', 'Goal Kick', 'Corner', 'Free Kick', 'Kick Off'}
REST_SHOT = {'Free Kick', 'Penalty'}
tot = {}
def inc(team, k, v=1):
    d = tot.setdefault(team, {}); d[k] = d.get(k, 0) + v
per = {}
for e in ev:
    t = e.get('team', {}).get('name'); tn = e['type']['name']; p = e['period']
    if p > 4: continue
    pr = per.setdefault(p, {'ini': None, 'fim': 0.0, 'morto': 0.0, 'vivoAte': None, 'rest': 0})
    x = ts(e)
    if pr['ini'] is None: pr['ini'] = x
    pr['fim'] = max(pr['fim'], x + (e.get('duration') or 0))
    restart = False
    if tn == 'Pass' and e['pass'].get('type', {}).get('name') in REST_PASS: restart = True
    if tn == 'Shot' and e['shot'].get('type', {}).get('name') in REST_SHOT: restart = True
    if tn == 'Referee Ball-Drop': restart = True
    if restart and pr['vivoAte'] is not None and x > pr['vivoAte']:
        pr['morto'] += x - pr['vivoAte']; pr['rest'] += 1
    if tn not in ('Starting XI', 'Half Start', 'Half End', 'Tactical Shift', 'Substitution', 'Player On', 'Player Off', 'Injury Stoppage', 'Referee Ball-Drop' if False else '__'):
        fimEv = x + (e.get('duration') or 0)
        pr['vivoAte'] = fimEv if (pr['vivoAte'] is None or restart) else max(pr['vivoAte'], fimEv)
    if t is None: continue
    if tn == 'Foul Committed':
        fc = e.get('foul_committed', {})
        tipo = fc.get('type', {}).get('name', '')
        if tipo == 'Handball': inc(t, 'mao')
        else: inc(t, 'faltas')
        if fc.get('advantage'): inc(t, 'vantagem')
        if fc.get('penalty'): inc(t, 'penalti')
        c = fc.get('card', {}).get('name')
        if c == 'Yellow Card': inc(t, 'amarelo_falta')
        elif c == 'Second Yellow': inc(t, 'segundo_amarelo')
        elif c == 'Red Card': inc(t, 'vermelho_direto')
    elif tn == 'Bad Behaviour':
        c = e.get('bad_behaviour', {}).get('card', {}).get('name')
        if c == 'Yellow Card': inc(t, 'amarelo_conduta')
        elif c == 'Second Yellow': inc(t, 'segundo_amarelo')
        elif c == 'Red Card': inc(t, 'vermelho_direto')
    elif tn == 'Duel':
        dt = e.get('duel', {}).get('type', {}).get('name')
        if dt == 'Tackle':
            inc(t, 'tackles')
            if e['duel'].get('outcome', {}).get('name') in ('Won', 'Success', 'Success In Play', 'Success Out'): inc(t, 'tackles_ok')
        elif dt == 'Aerial Lost': inc(t, 'aereo_perdido')
    elif tn == '50/50': inc(t, 'dividida5050')
    elif tn == 'Pressure': inc(t, 'pressao')
    elif tn == 'Dribble':
        inc(t, 'dribles')
        if e['dribble'].get('outcome', {}).get('name') == 'Complete': inc(t, 'dribles_ok')
    elif tn == 'Dribbled Past': inc(t, 'driblado')
    elif tn == 'Interception': inc(t, 'intercept')
    elif tn == 'Ball Recovery': inc(t, 'recupera')
    elif tn == 'Foul Won': inc(t, 'falta_sofrida')
    elif tn == 'Shot':
        st = e['shot'].get('type', {}).get('name')
        if st != 'Penalty': inc(t, 'chutes')
        if e['shot'].get('outcome', {}).get('name') == 'Goal': inc(t, 'gols')
    elif tn == 'Own Goal For': inc(t, 'gols')
    elif tn == 'Pass':
        if e['pass'].get('type', {}).get('name') not in REST_PASS:
            inc(t, 'passes')
            if 'outcome' not in e['pass']: inc(t, 'passes_ok')
    for k in ('pass', 'clearance', 'shot', 'miscontrol'):
        if isinstance(e.get(k), dict) and e[k].get('aerial_won'): inc(t, 'aereo_ganho')
total_min = sum(pr['fim'] - pr['ini'] for pr in per.values() if pr['ini'] is not None) / 60
morto_min = sum(pr['morto'] for pr in per.values()) / 60
rest = sum(pr['rest'] for pr in per.values())
print(json.dumps({'id': mid, 'times': tot, 'min_total': round(total_min, 2), 'min_morto': round(morto_min, 2), 'reinicios': rest}))
