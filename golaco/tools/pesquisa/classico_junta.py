# Junta os conjuntos (grupo A) por variancia inversa no log da razao (EP pelo IC de 95% do bootstrap).
import json, math, sys
arqs = sys.argv[1:]
MET = ['faltas', 'amarelos', 'vermelhos', 'tackles', 'intercept', 'chutes', 'gols', 'passes', 'amarelo/falta', 'falta/(tackle+falta)', 'falta/disputa ajustada', 'amarelo/falta ajustado']
dados = {a.split('/')[-1]: json.load(open(a))['A'] for a in arqs}
print('conjunto'.ljust(14), ' '.join(m[:13].rjust(14) for m in MET))
for k, d in dados.items():
    print(k[:14].ljust(14), ' '.join((f"{d[m][0]-1:+.0%} (n={d[m][3]})" if m in d else '-').rjust(14) for m in MET))
print()
for m in MET:
    num = den = 0; n = 0
    for k, d in dados.items():
        if m not in d: continue
        r, lo, hi, nn = d[m]
        if r <= 0 or lo <= 0 or hi <= 0: continue
        ep = (math.log(hi) - math.log(lo)) / 3.92
        if ep <= 0: continue
        w = 1 / ep ** 2; num += w * math.log(r); den += w; n += nn
    if den:
        mu = num / den; ep = 1 / math.sqrt(den)
        print(f'{m:22s} junto {math.exp(mu)-1:+6.1%} [{math.exp(mu-1.96*ep)-1:+.1%}; {math.exp(mu+1.96*ep)-1:+.1%}]  ({n} classicos)')
