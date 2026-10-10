# A "retomada em ≤ 5 s depois da perda" do teste-pressao medida com a MESMA definição nos eventos
# abertos da Metrica (Sample Game 1 e 2): perda = o OUTRO time passa a ter a bola com ela rolando
# (passe, recuperação, chute ou bola perdida dele — qualquer toque com a bola, como o donoDaBola do
# medidor), fora os recomeços (bola fora, falta, tiro de meta, saída); retomada = o time que perdeu
# volta a tocar na bola (passe, recuperação, chute ou bola perdida dele) em ≤ 5 s.
# Uso: python3 -I tools/pesquisa/retomada_metrica.py <pasta-com-os-csv>
# (Etapa 3, integração: ver tools/teste-pressao.mjs.)
import sys
import pandas as pd

PASTA = sys.argv[1]
TOQUE = {'PASS', 'RECOVERY', 'SHOT', 'BALL LOST'}
PARA = {'BALL OUT', 'FAULT RECEIVED', 'SET PIECE', 'CARD'}

tot_perdas, tot_ret, tot_ret3 = 0, 0, 0
for g in (1, 2):
    ev = pd.read_csv(f'{PASTA}/g{g}_RawEventsData.csv').sort_values(['Period', 'Start Frame'], kind='stable')
    ev = ev.reset_index(drop=True)
    atual, parado, per_ant = None, True, None
    perdas = []  # (período, tempo, time que perdeu)
    toques = []  # (período, tempo, time) de todo toque em jogo corrido
    for _, e in ev.iterrows():
        tipo, time, per, t = e['Type'], e['Team'], e['Period'], e['Start Time [s]']
        if per != per_ant:
            atual, parado, per_ant = None, True, per
        if tipo in PARA:
            parado = True
            if tipo == 'SET PIECE':
                atual = time
            continue
        if tipo not in TOQUE:
            continue
        toques.append((per, t, time))
        if atual is not None and time != atual and not parado:
            perdas.append((per, t, atual))
        atual, parado = time, False
    for per, t, tm in perdas:
        tot_perdas += 1
        ok = any(p == per and t < tt <= t + 5 and q == tm for p, tt, q in toques)
        ok3 = any(p == per and t < tt <= t + 3 and q == tm for p, tt, q in toques)
        tot_ret += ok
        tot_ret3 += ok3
print(f'perdas com a bola rolando: {tot_perdas} (2 jogos)')
print(f'retomada em ≤ 5 s: {100 * tot_ret / tot_perdas:.1f}%  (em ≤ 3 s: {100 * tot_ret3 / tot_perdas:.1f}%)')
