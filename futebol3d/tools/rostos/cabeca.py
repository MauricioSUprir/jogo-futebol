# Cabeça 3D realista a partir do escaneamento "Lee Perry-Smith" (Infinite-Realities, CC BY 3.0,
# distribuído nos exemplos do three.js). Só a FORMA é usada (o rosto vem das fotos de pessoas
# que não existem). Recorta a cabeça, alinha aos olhos da cabeça do jogo, simplifica e salva
# em assets/cabeca/cabeca-<n>.json (posições já no espaço de repouso do jogador, 1,80 m).
import json, os, numpy as np, trimesh, fast_simplification
AQUI = os.path.dirname(os.path.abspath(__file__))
m = trimesh.load(os.path.join(AQUI, '..', 'rosto', 'LeePerrySmith.glb'), force='mesh')
V, F = np.asarray(m.vertices).copy(), np.asarray(m.faces).copy()
# marcos medidos numa vista ortogonal frontal (MediaPipe): olhos e queixo
OE, OD, QUEIXO = np.array([-0.716, 1.632]), np.array([0.49, 1.647]), np.array([-0.097, -0.482])
meio = (OE + OD) / 2
k = 0.0544 / np.linalg.norm(OD - OE)                  # olhos a 5,4 cm: crânio cabe nas cascas de cabelo do jogo
# profundidade do olho: z máximo perto dos olhos
perto = np.linalg.norm(V[:, :2] - meio, axis=1) < 0.5
zolho = np.percentile(V[perto, 2], 70)
P = np.empty_like(V)
P[:, 0] = (V[:, 0] - meio[0]) * k
P[:, 1] = (V[:, 1] - meio[1]) * k + 1.7149
P[:, 2] = (V[:, 2] - zolho) * k + 0.085
# recorte: só acima do meio do pescoço
corte = 1.585
keep = np.all(P[F][:, :, 1] > corte, axis=1)
F = F[keep]
usados = np.unique(F); remap = -np.ones(len(P), int); remap[usados] = np.arange(len(usados))
P = P[usados]; F = remap[F]
print('cabeça recortada:', len(P), 'vértices', len(F), 'triângulos | largura', np.ptp(P[:, 0]).round(3), 'altura', np.ptp(P[:, 1]).round(3), 'prof', np.ptp(P[:, 2]).round(3))
print('boca/queixo (y):', ((0.426 - meio[1]) * k + 1.7149).round(4), ((QUEIXO[1] - meio[1]) * k + 1.7149).round(4))
for n, alvo in [(1, 1800), (2, 3600)]:
    p2, f2 = fast_simplification.simplify(P.astype(np.float32), F.astype(np.int32), target_reduction=1 - alvo / len(F))
    json.dump({'fonte': 'Lee Perry-Smith head scan, Infinite-Realities, CC BY 3.0 (só a forma)',
               'p': [round(float(x), 5) for x in p2.reshape(-1)], 'i': [int(x) for x in f2.reshape(-1)]},
              open(os.path.join(AQUI, '..', '..', 'assets', 'cabeca', f'cabeca-{n}.json'), 'w'), separators=(',', ':'))
    print('nível', n, len(p2), 'vértices', len(f2), 'triângulos')
