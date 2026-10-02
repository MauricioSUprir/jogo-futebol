# Monta o banco de rostos do jogo (pessoas que não existem):
#  - retratos gerados por IA (brutos/g*.png em grade 2×2 e ../rosto/ia1sq.jpg)
#  - rostos sintéticos do SFHQ (CC0) escolhidos à mão (escolhidos.json)
# Cada rosto é alinhado (olhos em 0,5×0,42, distância 0,27 da célula) e vai para um atlas
# de células C×C. Depois cada jogador recebe o rosto de tom de pele mais próximo (sem repetir
# no mesmo time). Saída: futebol3d/assets/rostos/rostos.jpg e rostos.json
import json, os, math, glob
import numpy as np
from PIL import Image
from alinhar import marcos
AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, '..', '..', 'assets', 'rostos')
SFHQ = '/tmp/claude-0/-home-user-jogo-futebol/9805b587-e422-5403-9106-8bf9d9184706/scratchpad/sfhq/'
os.makedirs(SAIDA, exist_ok=True)
C = 384; COLS = 12
# marcos da cabeça 3D no espaço da célula (marcos_cabeca.py): a foto é deformada por
# triângulos até cada ponto do rosto (olhos, nariz, boca, mandíbula) cair sobre o relevo
# — a "reprojeção" dos geradores de cabeça por foto; antes era só pelos olhos e não batia.
import cv2
HM0 = np.array(json.load(open(os.path.join(AQUI, 'cabeca-marcos.json')))['p'])[:468] * C
# pontos usados no encaixe: só os que independem de olho/boca abertos (no escaneamento as
# pálpebras e os lábios estão fechados; usar o contorno do olho esmagaria o olho da foto)
SEL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
       70, 63, 105, 66, 107, 300, 293, 334, 296, 336, 33, 133, 362, 263,
       1, 4, 5, 6, 197, 195, 168, 98, 327, 2, 48, 278, 64, 294,
       61, 291, 0, 17, 37, 267, 84, 314, 50, 280, 123, 352, 187, 411, 205, 425, 36, 266, 199, 175, 18, 32, 262, 151, 9, 108, 337]
def com_centros(P):
    # + centro de cada olho (média das pálpebras) e da boca (média dos lábios internos)
    return np.concatenate([P[SEL], [(P[159] + P[145]) / 2, (P[386] + P[374]) / 2, (P[13] + P[14]) / 2]])
HM = com_centros(HM0)
EX, EY = HM0[[33, 133, 362, 263], 0].mean() / C, HM0[[33, 133, 362, 263], 1].mean() / C
ED = (HM0[[362, 263], 0].mean() - HM0[[33, 133], 0].mean()) / C
OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
def _ancoras():
    # pontos fora do rosto: borda da célula e um anel em volta do contorno (seguem o encaixe geral)
    b = [(x, y) for t in np.linspace(0, 1, 9) for x, y in ((t * (C - 1), 0), (t * (C - 1), C - 1), (0, t * (C - 1)), (C - 1, t * (C - 1)))]
    ov = HM0[OVAL]; cc = ov.mean(0)
    anel = [cc + (p - cc) * 1.22 for p in ov[::2]]
    return np.unique(np.round(np.array(b + [tuple(p) for p in anel]), 2), axis=0)
ANC = _ancoras()
DST = np.concatenate([HM, ANC])
# triângulos (Delaunay) no espaço de destino
sub = cv2.Subdiv2D((-2, -2, C + 4, C + 4))
for x, y in DST: sub.insert((float(min(max(x, 0), C - 1)), float(min(max(y, 0), C - 1))))
key = {(round(float(min(max(x, 0), C - 1)), 2), round(float(min(max(y, 0), C - 1)), 2)): i for i, (x, y) in enumerate(DST)}
TRI = []
for t in sub.getTriangleList():
    ids = [key.get((round(float(t[k]), 2), round(float(t[k + 1]), 2))) for k in (0, 2, 4)]
    if None not in ids: TRI.append(ids)
TRI = np.array(TRI)
# mapa denso: para cada pixel da célula, triângulo e coordenadas baricêntricas
TID = np.full((C, C), -1, np.int32)
for k, (i, j, l) in enumerate(TRI):
    cv2.fillConvexPoly(TID, np.round(DST[[i, j, l]]).astype(np.int32), int(k))
yy, xx = np.mgrid[0:C, 0:C].astype(np.float64)
TID[TID < 0] = 0
A, B, Cc = DST[TRI[TID, 0]], DST[TRI[TID, 1]], DST[TRI[TID, 2]]
den = (B[..., 1] - Cc[..., 1]) * (A[..., 0] - Cc[..., 0]) + (Cc[..., 0] - B[..., 0]) * (A[..., 1] - Cc[..., 1])
den[np.abs(den) < 1e-9] = 1e-9
W0 = ((B[..., 1] - Cc[..., 1]) * (xx - Cc[..., 0]) + (Cc[..., 0] - B[..., 0]) * (yy - Cc[..., 1])) / den
W1 = ((Cc[..., 1] - A[..., 1]) * (xx - Cc[..., 0]) + (A[..., 0] - Cc[..., 0]) * (yy - Cc[..., 1])) / den
W2 = 1 - W0 - W1
from PIL import ImageDraw, ImageFilter
MK = Image.new('L', (C, C), 0)
ov = HM0[OVAL]; cc = ov.mean(0)
ImageDraw.Draw(MK).polygon([tuple(cc + (p - cc) * 1.02) for p in ov], fill=255)
MKF = np.asarray(MK.filter(ImageFilter.GaussianBlur(C * 0.02))).astype(np.float32) / 255
def tira_luz(arr, mk):
    # luz da foto (baixa frequência da luminância) fica simétrica e mais suave: a cabeça
    # 3D já recebe a luz do jogo, e sombra forte de um lado só fica falsa
    L = arr @ np.array([0.299, 0.587, 0.114]) + 1
    sg = C * 0.05
    Lb = cv2.GaussianBlur(L * mk, (0, 0), sg) / np.maximum(cv2.GaussianBlur(mk, (0, 0), sg), 1e-3)
    Lb = np.where(cv2.GaussianBlur(mk, (0, 0), sg) > 0.02, Lb, L).clip(1, None)
    cx = int(round(EX * C))
    Lm = np.roll(Lb[:, ::-1], 2 * cx - C + 1, axis=1)
    Ts = 0.5 * (Lb + Lm)
    med = np.median(L[mk > 0.5])
    T = med ** 0.35 * Ts ** 0.65
    g = np.clip(T / Lb, 0.72, 1.55)
    g = 1 + (g - 1) * mk
    return np.clip(arr * g[..., None], 0, 255)
def alinha(im, m):
    S = com_centros(np.asarray(m['todos'])[:468])
    # encaixe geral (semelhança por mínimos quadrados) para as âncoras fora do rosto
    M, _ = cv2.estimateAffinePartial2D(HM.astype(np.float32), S.astype(np.float32), method=cv2.LMEDS)
    SA = np.concatenate([S, ANC @ M[:, :2].T + M[:, 2]])
    sx = W0 * SA[TRI[TID, 0], 0] + W1 * SA[TRI[TID, 1], 0] + W2 * SA[TRI[TID, 2], 0]
    sy = W0 * SA[TRI[TID, 0], 1] + W1 * SA[TRI[TID, 1], 1] + W2 * SA[TRI[TID, 2], 1]
    src = np.asarray(im.convert('RGB'))
    arr = cv2.remap(src, sx.astype(np.float32), sy.astype(np.float32), cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE).astype(np.float32)
    arr = tira_luz(arr, MKF)
    # pele (bochechas) e cabelo (topo) medidos já no rosto encaixado
    pele = np.median(np.concatenate([arr[int(C * .58):int(C * .66), int(C * .27):int(C * .35)].reshape(-1, 3), arr[int(C * .58):int(C * .66), int(C * .65):int(C * .73)].reshape(-1, 3)]), axis=0)
    cab = np.median(arr[int(C * .05):int(C * .12), int(C * .42):int(C * .58)].reshape(-1, 3), axis=0)
    # fora do contorno: o cabelo da foto entra pela metade de cima; o resto vira cabelo/pele
    ey = EY * C
    ovs = [(cc[0] + (x - cc[0]) * (1.12 if y < ey else 1.0), (y * 0.08) if y < ey - 0.05 * C else y) for x, y in ov]
    mk = Image.new('L', (C, C), 0); ImageDraw.Draw(mk).polygon(ovs, fill=255); mk = mk.filter(ImageFilter.GaussianBlur(C * 0.015))
    g = np.linspace(0, 1, C)[:, None, None]
    t = np.clip((g - (EY - 0.04)) / 0.12, 0, 1)
    fundo = Image.fromarray((cab[None, None, :] * (1 - t) + pele[None, None, :] * t).repeat(C, axis=1).astype(np.uint8))
    out = Image.composite(Image.fromarray(arr.astype(np.uint8)), fundo, mk)
    alinha.cab = [int(x) for x in cab]
    return out, [int(x) for x in pele]
banco = []   # (img, pele, origem)
CABS = []
for f in sorted(glob.glob(os.path.join(AQUI, 'brutos', 'g*.png'))):
    im = Image.open(f).convert('RGB'); W, H = im.size
    for m in sorted(marcos(im), key=lambda m: (int((m['oe'][1] > H / 2)), m['oe'][0])):
        o, p = alinha(im, m); banco.append((o, p, 'ia:' + os.path.basename(f))); CABS.append(alinha.cab)
im = Image.open(os.path.join(AQUI, '..', 'rosto', 'ia1sq.jpg')).convert('RGB')
o, p = alinha(im, marcos(im)[0]); banco.append((o, p, 'ia:ia1')); CABS.append(alinha.cab)
fr = json.load(open(SFHQ + 'frontais.json'))
for i in json.load(open(os.path.join(AQUI, 'escolhidos.json')))['sfhq']:
    im = Image.open(SFHQ + fr[i]).convert('RGB'); ms = marcos(im)
    if not ms: print('sem rosto', i); continue
    o, p = alinha(im, ms[0]); banco.append((o, p, 'sfhq:' + os.path.basename(fr[i]))); CABS.append(alinha.cab)
N = len(banco); rows = math.ceil(N / COLS)
atl = Image.new('RGB', (C * COLS, C * rows), (120, 90, 70))
for k, (o, p, s) in enumerate(banco): atl.paste(o, ((k % COLS) * C, (k // COLS) * C))
atl.save(os.path.join(SAIDA, 'rostos.jpg'), quality=82, optimize=True, progressive=True)
# distribuição por tom de pele (Lab aproximado pela luminância + matiz)
import subprocess
looks = json.loads(subprocess.check_output(['node', '-e', "import('../../js/teams.js').then(T=>console.log(JSON.stringify(T.TEAMS.map(t=>t.players.map(p=>p.look.skin)))))"], cwd=AQUI))
def lab(rgb):
    r, g, b = [x / 255 for x in rgb]
    L = 0.299 * r + 0.587 * g + 0.114 * b
    return np.array([L * 2.2, (r - g) * 1.0, (g - b) * 0.6])
hexrgb = lambda h: [int(h[i:i + 2], 16) for i in (1, 3, 5)]
# o tom do "look" é a cor da pele já sob luz média do jogo; os retratos têm luz de estúdio —
# compara pela ordem (percentil) da luminância, não pelo valor absoluto
pl = np.array([lab(p)[0] for _, p, _ in banco]); rank_b = pl.argsort().argsort() / max(N - 1, 1)
allL = sorted(lab(hexrgb(h))[0] for t in looks for h in t)
def rank_l(h):
    v = lab(hexrgb(h))[0]; return sum(1 for x in allL if x < v) / max(len(allL) - 1, 1)
times = []
usos = np.zeros(N)
for t in looks:
    livres = set(range(N)); esc = []
    for h in t:
        r = rank_l(h)
        k = min(livres, key=lambda j: abs(rank_b[j] - r) + 0.04 * usos[j])
        livres.discard(k); usos[k] += 1; esc.append(int(k))
    times.append(esc)
json.dump({'cell': C, 'cols': COLS, 'rows': rows, 'n': N, 'eye': [EX, EY, ED], 'pele': [p for _, p, _ in banco], 'cabelo': CABS,
           'origem': [s for _, _, s in banco], 'times': times}, open(os.path.join(SAIDA, 'rostos.json'), 'w'))
print('rostos no banco:', N, '| atlas', atl.size, '| bytes', os.path.getsize(os.path.join(SAIDA, 'rostos.jpg')))
