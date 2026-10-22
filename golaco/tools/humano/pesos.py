# Pesos finais do corpo humano: os 19 ossos do encaixe (encaixar.py) + os 6 AJUDANTES de meio-giro do desenho
# (js/render/esqueleto.js: joelho E/D, cotovelo E/D, quadril E/D). Perto da junta (até RAIO), parte do peso que o
# vértice divide entre o osso de cima e o de baixo passa ao ajudante, que gira a METADE da dobra: a pele linear com só os
# dois ossos murcha a dobra (o "efeito embrulho de bala"); com o ajudante, o joelho a 90° guarda o volume. Depois: no
# máximo 4 influências por vértice, renormalizadas e quantizadas em 8 bits (soma 255).
# Uso: python -I pesos.py <enc.npz> <enc-repouso.json> <saida.npz> [K=1.0] [RAIO=0.11]
import sys, json, numpy as np
ent, rep, saida = sys.argv[1:4]
K = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0
RAIO = float(sys.argv[5]) if len(sys.argv) > 5 else 0.11
d = np.load(ent); R = json.load(open(rep))
J = {n: np.array(v) for n, v in R['juntas'].items()}
DES = {n: np.array(v) for n, v in R['desenho'].items()}
jd = lambda n: DES.get(n, J[n])
# [ajudante, osso de cima, osso de baixo, junta] — a ordem de esqueleto.js (19..24)
AJ = [(19, 13, 14, 'joelhoE'), (20, 16, 17, 'joelhoD'), (21, 6, 7, 'cotoveloE'), (22, 10, 11, 'cotoveloD'),
      (23, 0, 13, 'quadrilE'), (24, 0, 16, 'quadrilD')]
res = dict(d)
for chave in [k for k in d.files if k.endswith('_pes19')]:
    parte = chave[:-6]
    P = d[parte + '_pos']; W = np.zeros((len(P), 25), np.float64); W[:, :19] = d[chave]
    for a, cima, baixo, jn in AJ:
        dist = np.linalg.norm(P - jd(jn), axis=1)
        fall = np.clip(1 - dist / RAIO, 0, 1) ** 0.5
        t = K * 2 * np.minimum(W[:, cima], W[:, baixo]) * fall
        W[:, cima] -= t / 2; W[:, baixo] -= t / 2; W[:, a] += t
    W = np.clip(W, 0, None)
    idx = np.argsort(-W, axis=1)[:, :4]
    top = np.take_along_axis(W, idx, 1)
    top /= top.sum(1, keepdims=True) + 1e-12
    q = np.floor(top * 255 + 0.5).astype(np.int32)
    falta = 255 - q.sum(1)
    q[np.arange(len(q)), 0] += falta                       # o resto da quantização no maior
    res[parte + '_ossos'] = idx.astype(np.uint8); res[parte + '_pesos'] = q.astype(np.uint8)
    del res[chave]
    usam = (q > 0).sum(1)
    print(f'{parte}: {len(P)} v, influências {np.bincount(usam, minlength=5)[1:]}, ajudantes em {(np.isin(idx, range(19, 25)) & (q > 0)).any(1).sum()} v')
np.savez(saida, **res)
print('ok', saida)
