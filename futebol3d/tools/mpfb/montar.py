# Monta o jogador MakeHuman (MPFB 2, CC0) para o jogo a partir de jogador.npz (exportar.py):
# corpo + olhos + sobrancelhas numa malha (pele por UV nas texturas reais do MakeHuman),
# morphs de rosto/corpo (africano, asiático; base europeia), pesos nos 17 ossos do jogo,
# posição de repouso no esqueleto do jogo (aRest), regiões do uniforme (aMat) e cabelos.
# Saída: assets/jogador/mh.json, mh.bin, peles.jpg (atlas 4×2), cabelos.png (atlas 4×2)
import numpy as np, json, os, math
from PIL import Image
AQUI = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(AQUI, '..', '..', 'assets', 'jogador')
D = np.load('/tmp/claude-0/-home-user-jogo-futebol/9805b587-e422-5403-9106-8bf9d9184706/scratchpad/mpfb/jogador.npz')
DATA = '/root/.config/blender/5.0/extensions/.user/user_default/mpfb/data/'
HAIRS = ['short01', 'short02', 'short03', 'short04', 'afro01', 'long01', 'ponytail01']

PARENT = [-1, 0, 1, 2, 3, 2, 5, 6, 2, 8, 9, 0, 11, 12, 0, 14, 15]
OFF = np.array([0, 0.96, 0, 0, 0.08, 0, 0, 0.20, 0, 0, 0.27, -0.012, 0, 0.09, 0.012,
                0.178, 0.205, -0.012, 0, -0.30, 0, 0, -0.26, 0, -0.178, 0.205, -0.012, 0, -0.30, 0, 0, -0.26, 0,
                0.095, -0.03, 0, 0, -0.44, 0, 0, -0.42, 0, -0.095, -0.03, 0, 0, -0.44, 0, 0, -0.42, 0]).reshape(17, 3)
JO = np.zeros((17, 3))
for b in range(17): JO[b] = OFF[b] + (JO[PARENT[b]] if PARENT[b] >= 0 else 0)
B = dict(zip([str(x) for x in D['bone_names']], D['bones']))
def mir(v): return np.array([-v[0], v[1], v[2]])
# juntas na malha: tronco = juntas do jogo (sem deslocar o tronco); membros = juntas do MakeHuman
JM = JO.copy()
for side, (ua, fa, ha, th, sh, ft) in {0: (5, 6, 7, 11, 12, 13), 1: (8, 9, 10, 14, 15, 16)}.items():
    s = 'l' if side == 0 else 'r'
    JM[ua], JM[fa], JM[ha] = B['upperarm_' + s], B['lowerarm_' + s], B['hand_' + s]
    JM[th], JM[sh], JM[ft] = B['thigh_' + s], B['calf_' + s], B['foot_' + s]
END_M = {0: JM[1], 1: JM[2], 2: JM[3], 3: JM[4], 4: JM[4] + [0, 0.2, 0.02]}
END_O = {0: JO[1], 1: JO[2], 2: JO[3], 3: JO[4], 4: JO[4] + [0, 0.2, 0.02]}
for side, (ua, fa, ha, th, sh, ft) in {0: (5, 6, 7, 11, 12, 13), 1: (8, 9, 10, 14, 15, 16)}.items():
    s = 'l' if side == 0 else 'r'
    END_M[ua], END_M[fa], END_M[ha] = JM[fa], JM[ha], B['middle_01_' + s] + (B['middle_01_' + s] - JM[ha]) * 0.8
    END_O[ua], END_O[fa], END_O[ha] = JO[fa], JO[ha], JO[ha] + [0, -0.19, 0]
    END_M[th], END_M[sh], END_M[ft] = JM[sh], JM[ft], B['ball_' + s] + [0, 0, 0.06]
    END_O[th], END_O[sh], END_O[ft] = JO[sh], JO[ft], JO[ft] + [0, -0.06, 0.15]
def align(a, b):
    a = a / np.linalg.norm(a); b = b / np.linalg.norm(b); v = np.cross(a, b); c = np.dot(a, b)
    K = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + K + K @ K / (1 + c)
R = [align(END_O[b] - JO[b], END_M[b] - JM[b]) for b in range(17)]
RT = np.stack([r.T for r in R])

def rest_pos(P, idx, w):
    out = np.zeros_like(P)
    for k in range(idx.shape[1]):
        b = idx[:, k]
        out += w[:, k:k + 1] * (JO[b] + np.einsum('nij,nj->ni', RT[b], P - JM[b]))
    return out
def normals(P, F):
    n = np.zeros_like(P); fn = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]])
    for k in range(3): np.add.at(n, F[:, k], fn)
    return n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)

# --- corpo e morphs (variações de etnia normalizadas para a mesma altura)
vidx = D['vidx']
def body(rk):
    r = D['raw_' + rk]; return r * (D['raw_eu'][:, 1].max() / r[:, 1].max())
P = body('eu')[vidx]; UV = D['uv']; F = D['faces']; W17 = D['w']
MA = body('af')[vidx] - P; MS = body('as')[vidx] - P
ka = D['raw_eu'][:, 1].max() / D['raw_af'][:, 1].max(); ks = D['raw_eu'][:, 1].max() / D['raw_as'][:, 1].max()
idx = np.argsort(-W17, axis=1)[:, :4].astype(np.uint8); w = np.take_along_axis(W17, idx.astype(np.int64), axis=1)
w[w < 0.02] = 0; w /= w.sum(1, keepdims=True)
Rr = rest_pos(P, idx, w)
SKIN, SHIRT, SLEEVE, SHORTS, SOCK, BOOT, EYE, BROW, HAND, FOREARM, SOLE = 0, 1, 2, 3, 4, 6, 8, 11, 12, 13, 14
dom = idx[:, 0]; y = Rr[:, 1]; mat = np.full(len(P), SKIN, np.uint8)
mat[np.isin(dom, [0, 1, 2, 3, 4]) & (y > 0.98) & (y < 1.535)] = SHIRT
up = np.isin(dom, [5, 8]); mat[up & (y > 1.27)] = SLEEVE; mat[up & (y <= 1.27)] = FOREARM
mat[np.isin(dom, [6, 9])] = FOREARM; mat[np.isin(dom, [7, 10])] = HAND
mat[np.isin(dom, [0, 11, 14]) & (y <= 0.98) & (y > 0.70)] = SHORTS
mat[np.isin(dom, [12, 15, 13, 16]) & (y < 0.44) & (y > 0.13)] = SOCK
mat[np.isin(dom, [12, 13, 15, 16]) & (y <= 0.13)] = BOOT
# roupa um pouco solta (suavizada entre vizinhos)
N = normals(P, F)
infl = np.where(np.isin(mat, [SHIRT, SLEEVE]), 0.008, np.where(mat == SHORTS, 0.014, np.where(mat == SOCK, 0.003, np.where(mat == BOOT, 0.006, 0.0))))
nb = [[] for _ in range(len(P))]
for f in F:
    for i in range(3): nb[f[i]] += [f[(i + 1) % 3], f[(i + 2) % 3]]
for _ in range(3): infl = np.array([0.5 * infl[i] + 0.5 * (infl[nb[i]].mean() if nb[i] else infl[i]) for i in range(len(P))])
P = P + N * infl[:, None]
Rr = rest_pos(P, idx, w)

# --- olhos e sobrancelhas presos à cabeça (com os mesmos morphs)
def acc(key, m):
    p = D[key + '_p_eu'] * 1.0; a = D[key + '_p_af'] * ka - p; s = D[key + '_p_as'] * ks - p
    return p, D[key + '_uv'], D[key + '_f'], a, s, np.full(len(p), m, np.uint8)
parts = [(P, UV, F, MA, MS, mat, idx, w)]
for key, m in [('eyes', EYE), ('brows', BROW)]:
    p, uv, f, a, s, mm = acc(key, m)
    i4 = np.tile(np.array([4, 0, 0, 0], np.uint8), (len(p), 1)); w4 = np.tile(np.array([1, 0, 0, 0], np.float64), (len(p), 1))
    parts.append((p, uv, f, a, s, mm, i4, w4))
Pa = []; UVa = []; Fa = []; Aa = []; Sa = []; Ma = []; Ia = []; Wa = []; o = 0
for p, uv, f, a, s, mm, i4, w4 in parts:
    Pa.append(p); UVa.append(uv); Fa.append(f + o); Aa.append(a); Sa.append(s); Ma.append(mm); Ia.append(i4); Wa.append(w4); o += len(p)
P, UV, F, MA, MS, MAT, IDX, WW = [np.concatenate(x) for x in (Pa, UVa, Fa, Aa, Sa, Ma, Ia, Wa)]
REST = rest_pos(P, IDX, WW)

# --- cabelos (presos à cabeça; um por estilo)
hairs = []
for hi, h in enumerate(HAIRS):
    p = D['hair_' + h + '_p_eu']
    hairs.append({'name': h, 'p': p, 'uv': D['hair_' + h + '_uv'], 'f': D['hair_' + h + '_f'],
                  'a': D['hair_' + h + '_p_af'] * ka - p, 's': D['hair_' + h + '_p_as'] * ks - p,
                  'rest': JO[4] + (p - JM[4])})

# --- texturas: peles (atlas 4×2 de 1024) e cabelos (4×2 de 512, com alfa)
SKINS = ['young_darkskinned_male_diffuse', 'middleage_darkskinned_male_diffuse', 'young_lightskinned_male_diffuse3',
         'young_lightskinned_male_diffuse2', 'young_lightskinned_male_diffuse', 'middleage_lightskinned_male_diffuse2',
         'middleage_lightskinned_male_diffuse']
import glob
atl = Image.new('RGB', (4096, 2048)); lum = []
for k, n in enumerate(SKINS):
    f = glob.glob(DATA + 'skins/*/' + n + '.png')[0]
    im = Image.open(f).convert('RGB').resize((1024, 1024), Image.LANCZOS)
    atl.paste(im, ((k % 4) * 1024, (k // 4) * 1024))
    a = np.asarray(im.resize((64, 64))).reshape(-1, 3).astype(float); lum.append(float(np.median(a @ [0.299, 0.587, 0.114])))
# célula 7: olho (metade de cima) e sobrancelha (metade de baixo)
eye = Image.open(DATA + 'eyes/materials/brown_eye.png').convert('RGBA').resize((1024, 512))
brow = Image.open(glob.glob(DATA + 'eyebrows/eyebrow001/*.png')[0]).convert('RGBA').resize((1024, 512))
cell = Image.new('RGBA', (1024, 1024)); cell.paste(eye, (0, 0)); cell.paste(brow, (0, 512))
atl.paste(cell.convert('RGB'), (3072, 1024))
atl.save(os.path.join(OUT, 'peles.jpg'), quality=86, optimize=True)
# alfa da sobrancelha vai num PNG pequeno (jpg não tem alfa)
brow.split()[3].resize((256, 128)).save(os.path.join(OUT, 'sobrancelha-alfa.png'))
hat = Image.new('RGBA', (2048, 1024))
for k, h in enumerate(HAIRS):
    f = [x for x in glob.glob(DATA + 'hair/' + h + '/*diffuse*.png')][0]
    hat.paste(Image.open(f).convert('RGBA').resize((512, 512), Image.LANCZOS), ((k % 4) * 512, (k // 4) * 512))
hat.save(os.path.join(OUT, 'cabelos.png'), optimize=True)

# --- binário
blob = bytearray(); meta = {'fonte': 'MakeHuman / MPFB 2 (CC0): corpo, peles, olhos, sobrancelhas e cabelos', 'skins': SKINS, 'skinLum': lum, 'hairs': HAIRS}
def put(name, arr, ent):
    while len(blob) % 4: blob.append(0)
    ent[name] = len(blob); blob.extend(arr.tobytes())
ent = {'nv': len(P), 'ni': int(F.size)}
for name, arr in [('pos', P.astype(np.float32)), ('rest', REST.astype(np.float32)), ('uv', UV.astype(np.float32)),
                  ('ma', MA.astype(np.float32)), ('ms', MS.astype(np.float32)), ('w', WW.astype(np.float32)),
                  ('idx', IDX.astype(np.uint8)), ('mat', MAT.astype(np.uint8)), ('index', F.astype(np.uint32))]:
    put(name, arr, ent)
meta['body'] = ent; meta['hair'] = []
for h in hairs:
    e = {'name': h['name'], 'nv': len(h['p']), 'ni': int(h['f'].size)}
    for name, arr in [('pos', (h['p'] - JM[4]).astype(np.float32)), ('rest', h['rest'].astype(np.float32)), ('uv', h['uv'].astype(np.float32)),
                      ('ma', h['a'].astype(np.float32)), ('ms', h['s'].astype(np.float32)), ('index', h['f'].astype(np.uint32))]:
        put(name, arr, e)
    meta['hair'].append(e)
inv = []
for b in range(17):
    M = np.eye(4); M[:3, :3] = R[b]; M[:3, 3] = JM[b]; inv.append(np.linalg.inv(M).T.reshape(-1).round(6).tolist())
meta['invBind'] = inv
meta['headJM'] = JM[4].tolist()
open(os.path.join(OUT, 'mh.bin'), 'wb').write(blob)
json.dump(meta, open(os.path.join(OUT, 'mh.json'), 'w'))
print('corpo', len(P), 'vértices', len(F), 'tris | cabelos', [(h['name'], len(h['f'])) for h in hairs], '| bin', len(blob), '| lum peles', [round(x) for x in lum])
