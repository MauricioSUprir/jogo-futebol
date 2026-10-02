# Monta o jogador realista: corpo masculino dos "Human Base Meshes" (Blender Studio, CC0),
# esqueleto de 17 ossos igual ao do jogo (anim.js), pesos de pele por distância aos ossos,
# regiões do uniforme (aMat) e posição de repouso no esqueleto do jogo (aRest, braços para
# baixo). Saída: assets/jogador/corpo-<lod>.bin + corpo.json (offsets e matrizes de ligação).
import numpy as np, json, os, sys, math
import fast_simplification
H = '/tmp/claude-0/-home-user-jogo-futebol/9805b587-e422-5403-9106-8bf9d9184706/scratchpad/humano/'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets', 'jogador')
d = np.load(H + 'corpo2.npz')   # multires nível 2
V0, F0 = d['vb'].astype(np.float64), d['fb'].astype(np.int64)
# o rosto do corpo base é só um molde de escultura (boca em bloco): troca cabeça e pescoço
# pela forma do escaneamento "Lee Perry-Smith" (Infinite-Realities, CC BY 3.0, exemplos do
# three.js), alinhada pelos olhos medidos (MediaPipe) — o rosto em si vem das fotos
import trimesh
sc = trimesh.load(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'rosto', 'LeePerrySmith.glb'), force='mesh')
SV, SF = np.asarray(sc.vertices).copy(), np.asarray(sc.faces).copy()
OE, OD = np.array([-0.716, 1.632]), np.array([0.49, 1.647])     # olhos na vista frontal do escaneamento
smid = (OE + OD) / 2; ks = 0.060 / np.linalg.norm(OD - OE)          # 6 cm entre olhos
near = np.linalg.norm(SV[:, :2] - smid, axis=1) < 0.5; zeye = np.percentile(SV[near, 2], 70)
VH = np.stack([(SV[:, 0] - smid[0]) * ks, (SV[:, 1] - smid[1]) * ks + 1.684, (SV[:, 2] - zeye) * ks + 0.125], axis=1)
FH = SF.astype(np.int64)
EYES = []
def cut(V, F, keep):
    F = F[np.all(keep[F], axis=1)]; u = np.unique(F); r = -np.ones(len(V), np.int64); r[u] = np.arange(len(u))
    return V[u], r[F]
V0, F0 = cut(V0, F0, V0[:, 1] < 1.535)          # corpo com o próprio pescoço até 1,535 m
VH, FH = cut(VH, FH, VH[:, 1] > 1.525)          # cabeça do escaneamento (sem o busto)
# o pescoço do escaneamento é mais largo que o do corpo: afina a base para encaixar
def raio(V, y, cx, cz):
    sel = V[np.abs(V[:, 1] - y) < 0.006]; return np.median(np.hypot(sel[:, 0] - cx, sel[:, 2] - cz))
nb = V0[(V0[:, 1] > 1.50) & (V0[:, 1] < 1.535)]; ncx, ncz = nb[:, 0].mean(), nb[:, 2].mean()
rb = raio(V0, 1.525, ncx, ncz)
for y0 in np.arange(1.525, 1.60, 0.005):
    sel = np.abs(VH[:, 1] - y0) < 0.0026
    if not sel.any(): continue
    rs = raio(VH, y0, ncx, ncz); k = rb / rs
    wgt = np.clip((1.60 - y0) / 0.075, 0, 1)            # 1 na base → 0 em 1,60 m
    f = 1 + (k - 1) * wgt
    VH[sel, 0] = ncx + (VH[sel, 0] - ncx) * f; VH[sel, 2] = ncz + (VH[sel, 2] - ncz) * f
# e nenhum ponto da base fica para fora do pescoço do corpo (os "ombros" do busto escaneado)
rr = np.hypot(VH[:, 0] - ncx, VH[:, 2] - ncz)
lim = rb * 0.97 + np.clip(VH[:, 1] - 1.545, 0, None) * 1.2
over = (VH[:, 1] < 1.60) & (rr > lim)
VH[over, 0] = ncx + (VH[over, 0] - ncx) * lim[over] / rr[over]; VH[over, 2] = ncz + (VH[over, 2] - ncz) * lim[over] / rr[over]
print('pescoço: corpo', round(rb, 3), 'escaneamento base', round(raio(VH, 1.53, ncx, ncz), 3))
print('cabeça nova: altura', VH[:, 1].min().round(3), '-', VH[:, 1].max().round(3), '| tris', len(FH))

PARENT = [-1, 0, 1, 2, 3, 2, 5, 6, 2, 8, 9, 0, 11, 12, 0, 14, 15]
OFF = np.array([0, 0.96, 0, 0, 0.08, 0, 0, 0.20, 0, 0, 0.27, -0.012, 0, 0.09, 0.012,
                0.178, 0.205, -0.012, 0, -0.30, 0, 0, -0.26, 0, -0.178, 0.205, -0.012, 0, -0.30, 0, 0, -0.26, 0,
                0.095, -0.03, 0, 0, -0.44, 0, 0, -0.42, 0, -0.095, -0.03, 0, 0, -0.44, 0, 0, -0.42, 0]).reshape(17, 3)
JO = np.zeros((17, 3))                       # juntas de repouso do jogo
for b in range(17): JO[b] = OFF[b] + (JO[PARENT[b]] if PARENT[b] >= 0 else 0)
# juntas na malha (medidas: perfis do corpo; braços em pose A)
ax = np.array([0.343, -0.902, 0.262]); ax /= np.linalg.norm(ax)
sh = np.array([0.19, 1.43, -0.03]); el = sh + 0.29 * ax; wr = el + 0.255 * ax; ht = wr + 0.19 * ax
JM = np.array([
    [0, 0.96, 0.01], [0, 1.04, 0.02], [0, 1.24, 0.0], [0, 1.50, -0.01], [0, 1.59, 0.0],
    sh, el, wr, sh * [-1, 1, 1], el * [-1, 1, 1], wr * [-1, 1, 1],
    [0.095, 0.93, 0.01], [0.142, 0.50, -0.005], [0.18, 0.09, -0.055],
    [-0.095, 0.93, 0.01], [-0.142, 0.50, -0.005], [-0.18, 0.09, -0.055]])
# ponta de cada osso (filho principal, ou ponta própria)
END_M = {0: JM[1], 1: JM[2], 2: JM[3], 3: JM[4], 4: np.array([0, 1.80, 0.02]), 5: JM[6], 6: JM[7], 7: ht,
         8: JM[9], 9: JM[10], 10: ht * [-1, 1, 1], 11: JM[12], 12: JM[13], 13: np.array([0.19, 0.02, 0.15]),
         14: JM[15], 15: JM[16], 16: np.array([-0.19, 0.02, 0.15])}
END_O = {0: JO[1], 1: JO[2], 2: JO[3], 3: JO[4], 4: JO[4] + [0, 0.2, 0.02], 5: JO[6], 6: JO[7], 7: JO[7] + [0, -0.19, 0],
         8: JO[9], 9: JO[10], 10: JO[10] + [0, -0.19, 0], 11: JO[12], 12: JO[13], 13: JO[13] + [0, -0.06, 0.15],
         14: JO[15], 15: JO[16], 16: JO[16] + [0, -0.06, 0.15]}
def align(a, b):
    a = a / np.linalg.norm(a); b = b / np.linalg.norm(b); v = np.cross(a, b); c = np.dot(a, b)
    K = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + K + K @ K / (1 + c)
# R[b] leva a direção do osso no jogo para a direção na malha (ligação = T(JM) R)
R = [align(END_O[b] - JO[b], END_M[b] - JM[b]) for b in range(17)]
SIDE = np.array([0, 0, 0, 0, 0, 1, 1, 1, -1, -1, -1, 1, 1, 1, -1, -1, -1])

def seg_dist(P, a, b):
    ab = b - a; t = np.clip(((P - a) @ ab) / (ab @ ab), 0, 1)
    return np.linalg.norm(P - (a + t[:, None] * ab), axis=1)

def weights(P):
    # distância à SUPERFÍCIE de uma cápsula por osso (raio aproximado do membro): assim o
    # lado do peito não vai para o braço e a coxa não puxa a barriga
    RAD = [0.12, 0.12, 0.13, 0.05, 0.085, 0.045, 0.04, 0.03, 0.045, 0.04, 0.03, 0.075, 0.05, 0.04, 0.075, 0.05, 0.04]
    D = np.stack([np.maximum(seg_dist(P, JM[b], END_M[b]) - RAD[b], 0) for b in range(17)], axis=1)
    side = np.sign(P[:, 0]) * (np.abs(P[:, 0]) > 0.03)
    for b in range(17):
        if SIDE[b]: D[(side == -SIDE[b]), b] = 9   # não mistura esquerda/direita
    # braço não pega o tronco perto da axila e vice-versa: penaliza por região
    W = 1 / (D + 0.008) ** 4
    idx = np.argsort(-W, axis=1)[:, :4]
    w = np.take_along_axis(W, idx, axis=1); w /= w.sum(1, keepdims=True)
    w[w < 0.03] = 0; w /= w.sum(1, keepdims=True)
    return idx.astype(np.uint8), w.astype(np.float32)

def rest_pos(P, idx, w):
    out = np.zeros_like(P)
    for k in range(4):
        b = idx[:, k]
        loc = np.einsum('nij,nj->ni', np.stack([R[x].T for x in range(17)])[b], P - JM[b])
        out += w[:, k:k + 1] * (JO[b] + loc)
    return out

def normals(P, F):
    n = np.zeros_like(P); fn = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]])
    for k in range(3): np.add.at(n, F[:, k], fn)
    return n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)

# materiais do shader do jogo (players3d.js: M)
SKIN, SHIRT, SLEEVE, SHORTS, SOCK, TRIM, BOOT, HAND, FOREARM, SOLE, EYE = 0, 1, 2, 3, 4, 5, 6, 12, 13, 14, 8
def materials(Rr, idx):
    dom = idx[:, 0]; y = Rr[:, 1]; m = np.full(len(Rr), SKIN, np.uint8)
    torso = np.isin(dom, [0, 1, 2, 3, 4]) & (y > 0.98)
    m[torso & (y < 1.535)] = SHIRT     # o recorte da gola é feito no shader (linha suave)
    up = np.isin(dom, [5, 8]); m[up & (y > 1.27)] = SLEEVE; m[up & (y <= 1.27)] = FOREARM
    m[np.isin(dom, [6, 9])] = FOREARM
    m[np.isin(dom, [7, 10])] = HAND
    m[(np.isin(dom, [0, 11, 14]) & (y <= 0.98) & (y > 0.70))] = SHORTS
    m[np.isin(dom, [12, 15, 13, 16]) & (y < 0.44) & (y > 0.13)] = SOCK
    m[np.isin(dom, [13, 16]) & (y <= 0.13)] = BOOT
    m[np.isin(dom, [12, 15]) & (y <= 0.13)] = BOOT
    m[(y < 0.018) & (m == BOOT)] = SOLE
    return m

meta = {'fonte': 'Human Base Meshes (Blender Studio, CC0) — corpo masculino realista', 'lods': []}
inv_bind = []
for b in range(17):
    M = np.eye(4); M[:3, :3] = R[b]; M[:3, 3] = JM[b]
    inv_bind.append(np.linalg.inv(M).T.reshape(-1).round(6).tolist())   # coluna-maior (three.js)
meta['invBind'] = inv_bind
blob = bytearray()
for lod, alvo in [(0, 3000), (1, 6000), (2, 10000)]:
    # corpo e cabeça simplificados à parte: o rosto fica com mais detalhe
    hb = {0: 1800, 1: 3500, 2: 6500}[lod]
    Pb, Fb = fast_simplification.simplify(V0.astype(np.float32), F0.astype(np.int32), target_reduction=1 - alvo / len(F0))
    Ph, Fh = fast_simplification.simplify(VH.astype(np.float32), FH.astype(np.int32), target_reduction=max(0, 1 - hb / len(FH)))
    P = np.vstack([Pb, Ph]).astype(np.float64); F = np.vstack([Fb, Fh + len(Pb)]).astype(np.int64)
    idx, w = weights(P)
    Rr = rest_pos(P, idx, w)
    mat = materials(Rr, idx)
    # roupa um pouco solta: camisa e calção saem da pele
    N = normals(P, F)
    infl = np.where(np.isin(mat, [SHIRT, SLEEVE]), 0.009, np.where(mat == SHORTS, 0.016, np.where(mat == SOCK, 0.004, np.where(np.isin(mat, [BOOT, SOLE]), 0.006, 0))))
    # suaviza a folga da roupa entre vizinhos (sem degraus/espinhos na borda dos materiais)
    nb = [[] for _ in range(len(P))]
    for f in F:
        for i in range(3): nb[f[i]] += [f[(i + 1) % 3], f[(i + 2) % 3]]
    infl = infl.astype(np.float64)
    for _ in range(4): infl = np.array([0.5 * infl[i] + 0.5 * (infl[nb[i]].mean() if nb[i] else infl[i]) for i in range(len(P))])
    P = P + N * infl[:, None]
    Rr = rest_pos(P, idx, w)
    # olhos (presos à cabeça)
    for ve, fe in EYES:
        o = len(P); P = np.vstack([P, ve]); F = np.vstack([F, fe + o])
        n = len(ve); idx = np.vstack([idx, np.tile([4, 0, 0, 0], (n, 1)).astype(np.uint8)]); w = np.vstack([w, np.tile([1, 0, 0, 0], (n, 1)).astype(np.float32)])
        mat = np.concatenate([mat, np.full(n, EYE, np.uint8)]); Rr = np.vstack([Rr, rest_pos(ve, np.tile([4, 0, 0, 0], (n, 1)), np.tile([1., 0, 0, 0], (n, 1)))])
    ent = {'lod': lod, 'nv': len(P), 'ni': int(F.size)}
    for name, arr in [('pos', P.astype(np.float32)), ('rest', Rr.astype(np.float32)), ('w', w.astype(np.float32)),
                      ('idx', idx.astype(np.uint8)), ('mat', mat.astype(np.uint8)), ('index', F.astype(np.uint32))]:
        while len(blob) % 4: blob.append(0)
        ent[name] = len(blob); blob += arr.tobytes()
    meta['lods'].append(ent)
    print('nível', lod, len(P), 'vértices', len(F), 'triângulos | materiais', {int(k): int(c) for k, c in zip(*np.unique(mat, return_counts=True))})
open(os.path.join(OUT, 'corpo.bin'), 'wb').write(blob)
json.dump(meta, open(os.path.join(OUT, 'corpo.json'), 'w'))
print('bytes', len(blob))
