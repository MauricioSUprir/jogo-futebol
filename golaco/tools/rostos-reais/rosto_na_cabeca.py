# A foto do jogador na pele da cabeça do Rocketbox (UV da própria cabeça): os 468 marcos do MediaPipe na foto e no
# render de frente da cabeça; cada marco do render vira um ponto da UV pelo raio (a câmera é ortográfica); os 898
# triângulos da malha canônica levam a foto para a UV. O lado escondido do rosto sai do lado visível ESPELHADO (o par
# simétrico de cada marco); a borda do rosto se mistura com a pele da cabeça, que ganha o tom da foto.
# Uso: python -I rosto_na_cabeca.py <marcos.json> <foto> <render_da_cabeca.png> <cabeca.npz> <canonical.obj>
#        <head_color.tga> <body_color.tga> <saida_dir>
import sys, os, json, math, functools, numpy as np, cv2
print = functools.partial(print, flush=True)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from canon import carregar
marcos, foto, rend, npzf, obj, headtex, bodytex, saida, segmod = sys.argv[1:10]
os.makedirs(saida, exist_ok=True)
D = json.load(open(marcos))
Lf = np.array(D[foto]['L']); Lr = np.array(D[rend]['L'])
V, cuv, tri, _ = carregar(obj)
Z = np.load(npzf); P, T3, TUV = Z['P'], Z['tri'], Z['tuv']; cx, cz, esc, RR = float(Z['cx']), float(Z['cz']), float(Z['esc']), int(Z['R'])

# 1) cada marco do render -> ponto da UV da cabeça (raio ortográfico ao longo de +Y; o triângulo mais da frente)
A2 = P[T3][:, :, [0, 2]]          # (n, 3, 2) em x, z
Ay = P[T3][:, :, 1]
def uv_do_ponto(x, z):
    a, b, c = A2[:, 0], A2[:, 1], A2[:, 2]
    d = (b[:, 1] - c[:, 1]) * (a[:, 0] - c[:, 0]) + (c[:, 0] - b[:, 0]) * (a[:, 1] - c[:, 1])
    ok = np.abs(d) > 1e-12
    l1 = ((b[:, 1] - c[:, 1]) * (x - c[:, 0]) + (c[:, 0] - b[:, 0]) * (z - c[:, 1])) / np.where(ok, d, 1)
    l2 = ((c[:, 1] - a[:, 1]) * (x - c[:, 0]) + (a[:, 0] - c[:, 0]) * (z - c[:, 1])) / np.where(ok, d, 1)
    l3 = 1 - l1 - l2
    dentro = ok & (l1 >= -1e-6) & (l2 >= -1e-6) & (l3 >= -1e-6)
    if not dentro.any(): return None
    y = l1 * Ay[:, 0] + l2 * Ay[:, 1] + l3 * Ay[:, 2]
    y = np.where(dentro, y, np.inf)
    k = int(np.argmin(y))
    uv_do_ponto.p3 = l1[k] * P[T3[k, 0]] + l2[k] * P[T3[k, 1]] + l3[k] * P[T3[k, 2]]
    return l1[k] * TUV[k, 0] + l2[k] * TUV[k, 1] + l3[k] * TUV[k, 2]
uvr = np.zeros((468, 2)); Q3 = np.zeros((468, 3))
for i in range(468):
    px, py = Lr[i, 0], Lr[i, 1]
    x = cx + (px / RR - 0.5) * esc; z = cz - (py / RR - 0.5) * esc
    u = uv_do_ponto(x, z)
    if u is None:
        # sem triângulo exatamente embaixo: o vizinho mais perto
        for r in (0.001, 0.002, 0.004):
            for dx, dz in ((r, 0), (-r, 0), (0, r), (0, -r)):
                u = uv_do_ponto(x + dx, z + dz)
                if u is not None: break
            if u is not None: break
    uvr[i] = u if u is not None else np.nan
    Q3[i] = uv_do_ponto.p3 if u is not None else np.nan
print('marcos sem UV:', int(np.isnan(uvr[:, 0]).sum()))

# 1b) a FORMA da pessoa: os marcos 3D da foto alinhados aos da cabeça (Procrustes com escala, sem o contorno do queixo
# que o MediaPipe chuta), a diferença espalhada nos vértices da cabeça por pesos gaussianos (σ 1,6 cm) e sumindo longe
# do rosto; 70% da diferença (o MediaPipe 3D de uma foto só é uma estimativa)
Pf = np.stack([Lf[:468, 0], Lf[:468, 2], -Lf[:468, 1]], 1)       # x, profundidade (+ para trás: o z do MediaPipe cresce para longe da câmera), altura
ok3 = ~np.isnan(Q3[:, 0])
def procrustes(X, Y):
    mx, my = X.mean(0), Y.mean(0); A, B = X - mx, Y - my
    U, Sg, Vt = np.linalg.svd(A.T @ B); Dd = np.eye(3); Dd[2, 2] = np.sign(np.linalg.det(U @ Vt))
    Rm = U @ Dd @ Vt; sc = (Sg * np.diag(Dd)).sum() / (A ** 2).sum()
    return lambda Z: (Z - mx) @ Rm * sc + my
al = procrustes(Pf[ok3], Q3[ok3])
dlt = np.where(ok3[:, None], al(Pf) - Q3, 0) * 0.9
dlt[:, 1] *= 0.75                                                  # a profundidade estimada é a mais incerta
dd = np.linalg.norm(P[:, None, :] - np.where(ok3[:, None], Q3, 1e3)[None], axis=2)
wgt = np.exp(-(dd / 0.016) ** 2)
somaw = wgt.sum(1, keepdims=True)
desl = (wgt @ dlt) / np.maximum(somaw, 1e-9)
desl *= np.clip(somaw / 0.6, 0, 1)                               # longe dos marcos (nuca, cabelo) não mexe
np.save(os.path.join(saida, 'cabeca_pos.npy'), P + desl)
print('forma: deslocamento máx %.1f mm, médio no rosto %.1f mm' % (np.linalg.norm(desl, axis=1).max() * 1000, np.linalg.norm(dlt[ok3], axis=1).mean() * 1000))

# 2) a textura da cabeça (2048²) e a da foto
H = cv2.imread(headtex, cv2.IMREAD_UNCHANGED)[:, :, :3].astype(np.float32) / 255
S = H.shape[0]
F = cv2.imread(foto).astype(np.float32) / 255
# balanço de branco e exposição pela ESCLERA (o branco dos olhos é quase branco em qualquer pessoa): a foto de estádio,
# de sombra ou de câmera fria deixava o rosto escuro e cinza no jogo. Os pixels dentro do contorno dos olhos, fora da
# íris, os 40% mais claros; ganho por canal (no linear) para levar à esclera de referência, limitado
OLHO_E = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
OLHO_D = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]
msc = np.zeros(F.shape[:2], np.uint8)
for ol in (OLHO_E, OLHO_D): cv2.fillPoly(msc, [Lf[ol, :2].astype(np.int32)], 255)
for ci in (468, 473):
    raio = np.mean([np.hypot(*(Lf[ci + j, :2] - Lf[ci, :2])) for j in range(1, 5)])
    cv2.circle(msc, tuple(int(x) for x in Lf[ci, :2]), max(1, int(raio * 1.15)), 0, -1)
px = F[msc > 0]
if len(px) >= 12:
    lum = px.mean(1); claro = px[lum >= np.percentile(lum, 60)]
    lin = lambda x: np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)
    srgb = lambda x: np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(np.maximum(x, 0), 1 / 2.4) - 0.055)
    alvo = lin(np.array([0.74, 0.76, 0.80]))          # BGR: a esclera de referência, levemente fria
    ganho = np.clip(alvo / np.maximum(lin(claro.mean(0)), 1e-3), 0.8, 1.7)
    # o ganho de exposição comum (média) inteiro, o desvio de cor de cada canal pela metade (a esclera também é amarelada)
    gm = np.exp(np.log(ganho).mean()); ganho = gm * (ganho / gm) ** 0.5
    F = np.clip(srgb(lin(F) * ganho), 0, 1).astype(np.float32)
    print('esclera: ganho BGR', ganho.round(2))
# a exposição conferida pela PELE (olho escuro ou apertado mostra pouca esclera e o ganho clareava o rosto até o branco):
# o L* da pele das bochechas e da testa fica entre 24 e 72 (a faixa das peles de verdade sob luz de jogo)
_m = np.zeros(F.shape[:2], np.uint8)
for _g in ([116, 117, 118, 119, 100, 142, 203, 206, 216, 192, 213, 147, 123], [345, 346, 347, 348, 329, 371, 423, 426, 436, 416, 433, 376, 352], [109, 10, 338, 337, 336, 9, 107, 108, 151, 299, 69]):
    cv2.fillPoly(_m, [cv2.convexHull(Lf[_g, :2].astype(np.int32))], 255)
_L = float(np.median(cv2.cvtColor(np.clip(F, 0, 1).astype(np.float32), cv2.COLOR_BGR2Lab)[..., 0][_m > 0]))
_alvoL = min(72.0, max(24.0, _L))
if abs(_alvoL - _L) > 0.5:
    _lin = lambda x: np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)
    _srgb = lambda x: np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(np.maximum(x, 0), 1 / 2.4) - 0.055)
    _Y = lambda L: ((L + 16) / 116) ** 3
    F = np.clip(_srgb(_lin(F) * (_Y(_alvoL) / _Y(_L))), 0, 1).astype(np.float32)
    print('exposição pela pele: L* %.1f -> %.1f' % (_L, _alvoL))

def rasterizar(uvp, S):
    """triângulo e baricêntricas de cada pixel da textura (y = (1 - v) * S)."""
    Pp = np.stack([uvp[:, 0] * S, (1 - uvp[:, 1]) * S], 1)
    tid = np.full((S, S), -1, np.int32); bar = np.zeros((S, S, 3), np.float32)
    ys, xs = np.mgrid[0:S, 0:S].astype(np.float32); xs += 0.5; ys += 0.5
    for k, (a, b, c) in enumerate(tri):
        if np.isnan(Pp[[a, b, c]]).any(): continue
        A, B, C = Pp[a], Pp[b], Pp[c]
        x0, x1 = int(max(0, math.floor(min(A[0], B[0], C[0])))), int(min(S - 1, math.ceil(max(A[0], B[0], C[0]))))
        y0, y1 = int(max(0, math.floor(min(A[1], B[1], C[1])))), int(min(S - 1, math.ceil(max(A[1], B[1], C[1]))))
        if x1 < x0 or y1 < y0 or (x1 - x0) * (y1 - y0) > S * S / 16: continue
        X, Y = xs[y0:y1 + 1, x0:x1 + 1], ys[y0:y1 + 1, x0:x1 + 1]
        d = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1])
        if abs(d) < 1e-9: continue
        l1 = ((B[1] - C[1]) * (X - C[0]) + (C[0] - B[0]) * (Y - C[1])) / d
        l2 = ((C[1] - A[1]) * (X - C[0]) + (A[0] - C[0]) * (Y - C[1])) / d
        l3 = 1 - l1 - l2
        dentro = (l1 >= -1e-4) & (l2 >= -1e-4) & (l3 >= -1e-4)
        sub = tid[y0:y1 + 1, x0:x1 + 1]; sb = bar[y0:y1 + 1, x0:x1 + 1]
        sub[dentro] = k; sb[dentro] = np.stack([l1, l2, l3], -1)[dentro]
    return tid, bar
tid, bar = rasterizar(uvr, S)
cobre = tid >= 0
tt = np.where(cobre, tid, 0)
def interp(val):  # val por vértice (468, c) -> por pixel
    return bar[..., 0:1] * val[tri[tt, 0]] + bar[..., 1:2] * val[tri[tt, 1]] + bar[..., 2:3] * val[tri[tt, 2]]

# 3) o par simétrico de cada marco (a malha canônica é simétrica em x) e a visibilidade de cada vértice na foto
par = np.array([int(np.argmin(np.linalg.norm(V - np.array([-v[0], v[1], v[2]]), axis=1))) for v in V])
P3 = np.stack([Lf[:468, 0], -Lf[:468, 1], -Lf[:468, 2]], 1)
N = np.zeros_like(P3)
for a, b, c in tri:
    n = np.cross(P3[b] - P3[a], P3[c] - P3[a]); N[a] += n; N[b] += n; N[c] += n
N /= np.linalg.norm(N, axis=1, keepdims=True)
if N[:, 2].mean() < 0: N = -N
vis = np.clip(N[:, 2], 0, 1)
# a foto amostrada pelos marcos (o lado de cada pixel) e ESPELHADA (os marcos do par do outro lado)
src = interp(Lf[:468, :2]); srcm = interp(Lf[par, :2])
Fx = cv2.remap(F, src[..., 0].astype(np.float32) - 0.5, src[..., 1].astype(np.float32) - 0.5, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
Fm = cv2.remap(F, srcm[..., 0].astype(np.float32) - 0.5, srcm[..., 1].astype(np.float32) - 0.5, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
vp = interp(vis[:, None])[..., 0]; vm = interp(vis[par][:, None])[..., 0]
# onde o lado da foto está pouco visível e o simétrico está bem visível, entra o espelhado
a = np.clip((vp - 0.10) / 0.18, 0, 1)
a = np.where(vp >= vm, 1.0, a)
face = Fx * a[..., None] + Fm * (1 - a[..., None])
print('espelhado (pixels com < 50% da foto):', int(((a < 0.5) & cobre).sum()))

# 4) o tom da pele: mediana da foto nas bochechas e na testa; a mesma região no render da cabeça
BOCH = [116, 117, 118, 119, 100, 142, 203, 206, 216, 192, 213, 147, 123, 345, 346, 347, 348, 329, 371, 423, 426, 436, 416, 433, 376, 352]
TESTA = [109, 10, 338, 337, 336, 9, 107, 108, 151, 299, 69]
def regiao(img, L, idx):
    m = np.zeros(img.shape[:2], np.uint8)
    for grupo in (idx[:13], idx[13:26]) if len(idx) > 13 else (idx,):
        cv2.fillPoly(m, [cv2.convexHull(L[grupo, :2].astype(np.int32))], 255)
    return m > 0
def lab(img): return cv2.cvtColor(np.clip(img, 0, 1).astype(np.float32), cv2.COLOR_BGR2Lab)
Rimg = cv2.imread(rend).astype(np.float32) / 255
mf = regiao(F, Lf, BOCH) | regiao(F, Lf, TESTA); mr = regiao(Rimg, Lr, BOCH) | regiao(Rimg, Lr, TESTA)
tf = np.median(lab(F)[mf], 0); tr = np.median(lab(Rimg)[mr], 0)
print('tom foto Lab', tf.round(1), 'cabeça', tr.round(1))
# o tom de PELE de verdade fica numa faixa de cor (a* 7–24, b* 9–30, matiz 35–72°): a luz verde do gramado, o casaco ou a
# sombra azulada da foto puxavam o tom para o cinza-esverdeado; a cor vai para o ponto mais perto dentro da faixa (o L*
# fica: a exposição já foi conferida pela pele)
_c = float(np.hypot(tf[1], tf[2])); _h = math.degrees(math.atan2(tf[2], tf[1]))
_h2 = min(66.0, max(35.0, _h)); _c2 = min(32.0, max(15.0, _c))
_a, _b = _c2 * math.cos(math.radians(_h2)), _c2 * math.sin(math.radians(_h2))
_a, _b = min(24.0, max(9.0, _a)), min(30.0, max(10.0, _b))
if abs(_a - tf[1]) + abs(_b - tf[2]) > 0.5:
    tf = np.array([tf[0], _a, _b]); print('tom levado à faixa de pele:', tf.round(1))

# 5) a pele da cabeça (fora do rosto) ganha o tom da foto: deslocamento em Lab só onde é pele (perto do tom da cabeça)
HL = lab(H)
dist = np.sqrt(((HL[..., 1] - tr[1]) ** 2 + (HL[..., 2] - tr[2]) ** 2)) + np.maximum(0, (tr[0] - 25) - HL[..., 0]) * 0.6
pele = np.clip(1 - (dist - 10) / 12, 0, 1)
pele = cv2.GaussianBlur(pele.astype(np.float32), (0, 0), 3)
HL2 = HL.copy()
cont0, _ = cv2.findContours(cobre.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
ch0 = np.zeros((S, S), np.uint8); cv2.drawContours(ch0, cont0, -1, 1, -1)
pele = np.maximum(pele, cv2.GaussianBlur(ch0.astype(np.float32), (0, 0), S * 0.01))
for c in range(3): HL2[..., c] = HL[..., c] + (tf[c] - tr[c]) * pele
H2 = cv2.cvtColor(HL2.astype(np.float32), cv2.COLOR_Lab2BGR)
HL2 = lab(H2)

# o contorno de fora da malha do rosto na UV (sem os buracos dos olhos e da boca)
cont, _ = cv2.findContours(cobre.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
cheio = np.zeros((S, S), np.uint8); cv2.drawContours(cheio, cont, -1, 1, -1)
perto_rosto = cv2.dilate(cheio, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(S * 0.06) | 1,) * 2)) > 0
# 5b) o cabelo: a cor do cabelo da foto (segmentador, classe 1) no cabelo da cabeça (o que não é pele, na metade de cima,
# FORA do rosto: os olhos, as sobrancelhas e a boca da textura não são pele e ganhavam a cor do cabelo — as manchas
# marrons em volta dos olhos)
import mediapipe as mp
from mediapipe.tasks.python import vision, BaseOptions
seg0 = vision.ImageSegmenter.create_from_options(vision.ImageSegmenterOptions(base_options=BaseOptions(model_asset_path=segmod), output_category_mask=True))
cat0 = seg0.segment(mp.Image.create_from_file(foto)).category_mask.numpy_view().astype(np.uint8)
cat0 = cv2.resize(cat0, (F.shape[1], F.shape[0]), interpolation=cv2.INTER_NEAREST)
cab_px = cv2.erode((cat0 == 1).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
if cab_px.sum() > 200:
    # o brilho do sol no cabelo puxava a mediana para o cinza: o L de um tom mais escuro (30%) e a cor da metade escura
    LF = lab(F)[cab_px]
    l30, l50 = np.percentile(LF[:, 0], 30), np.percentile(LF[:, 0], 50)
    esc = LF[LF[:, 0] <= l50]
    cor_cab = np.array([l30, np.median(esc[:, 1]), np.median(esc[:, 2])])
    yy0 = np.arange(S)[:, None] / S
    m_cab = (1 - pele) * (yy0 < 0.5) * (HL2[..., 0] > 3) * (~perto_rosto)
    m_cab = cv2.GaussianBlur(m_cab.astype(np.float32), (0, 0), 2)
    cab_tex = np.median(HL2[(m_cab > 0.8)], 0) if (m_cab > 0.8).sum() > 100 else cor_cab
    for c in range(3): HL2[..., c] = HL2[..., c] + (cor_cab[c] - cab_tex[c]) * m_cab * (0.9 if c == 0 else 0.8)
    H2 = cv2.cvtColor(HL2.astype(np.float32), cv2.COLOR_Lab2BGR)
    print('cabelo foto Lab', cor_cab.round(1), 'textura', np.round(cab_tex, 1))

# 6) o rosto por cima. A borda da malha do MediaPipe passa rente ao contorno do rosto (pega fundo e gola da foto): a
# mistura começa 1% para dentro e sobe em 3,5%; e só onde o segmentador vê pele do rosto, cabelo ou barba na foto
import mediapipe as mp
from mediapipe.tasks.python import vision, BaseOptions
seg = vision.ImageSegmenter.create_from_options(vision.ImageSegmenterOptions(base_options=BaseOptions(model_asset_path=segmod), output_category_mask=True))
cat = seg.segment(mp.Image.create_from_file(foto)).category_mask.numpy_view().astype(np.uint8)
cat = cv2.resize(cat, (F.shape[1], F.shape[0]), interpolation=cv2.INTER_NEAREST)
ok_px = (~np.isin(cat, (0, 4))).astype(np.float32)
ok_px = cv2.erode(ok_px, np.ones((5, 5), np.uint8))
# o miolo do rosto (sobrancelhas, olhos, nariz, boca, queixo) vem sempre da foto: o contorno do rosto encolhido 18%
OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
cen = Lf[OVAL, :2].mean(0); miolo = np.zeros(F.shape[:2], np.uint8)
cv2.fillPoly(miolo, [((Lf[OVAL, :2] - cen) * 0.82 + cen).astype(np.int32)], 255)
miolo = cv2.GaussianBlur(miolo.astype(np.float32) / 255, (0, 0), 6)
ok_px = np.maximum(ok_px, miolo)
okuv = cv2.remap(ok_px, src[..., 0].astype(np.float32) - 0.5, src[..., 1].astype(np.float32) - 0.5, cv2.INTER_LINEAR)
# a malha do MediaPipe tem buracos nos olhos e na boca: o contorno de fora fechado (sem os buracos) manda na mistura, e o
# miolo dos buracos (pálpebras, lábios) é preenchido com a própria foto em volta (inpaint)
buraco = (cheio > 0) & ~cobre
f8 = np.uint8(np.clip(face, 0, 1) * 255)
f8 = cv2.inpaint(f8, buraco.astype(np.uint8) * 255, 3, cv2.INPAINT_TELEA)
face = np.where(buraco[..., None], f8.astype(np.float32) / 255, face)
okuv = np.where(buraco, 1.0, okuv)
dt = cv2.distanceTransform(cheio, cv2.DIST_L2, 5)
alfa = np.clip((dt - S * 0.01) / (S * 0.035), 0, 1) * np.clip(okuv * 1.5 - 0.25, 0, 1)
alfa = cv2.GaussianBlur(alfa.astype(np.float32), (0, 0), 2.0)
# 6a) TIRAR A LUZ DA FOTO (a luz do jogo vem por cima: sombra, brilho do flash e a cor do ambiente da foto ficavam
# gravados na pele — o rosto com metade escura, o nariz brilhando, manchas cinza-esverdeadas). A pele de verdade varia
# devagar: a média LOCAL da pele (só os pixels de pele perto do tom do rosto: a barba, os olhos, as sobrancelhas e a boca
# ficam de fora e ficam como estão) é a luz; ela sai e o tom do rosto fica. O brilho acima do tom é comprimido.
catuv = cv2.remap((cat == 3).astype(np.float32), src[..., 0].astype(np.float32) - 0.5, src[..., 1].astype(np.float32) - 0.5, cv2.INTER_LINEAR)
FL = lab(face)
Lm, am, bm = float(tf[0]), float(tf[1]), float(tf[2])
w = (catuv > 0.5) * (cheio > 0) * (FL[..., 0] > Lm - 32) * np.exp(-((FL[..., 0] - Lm) / 30) ** 2) * np.exp(-((FL[..., 1] - am) ** 2 + (FL[..., 2] - bm) ** 2) / 18 ** 2)
PEQ = 512
wp = cv2.resize(w.astype(np.float32), (PEQ, PEQ), interpolation=cv2.INTER_AREA)
sg = PEQ * 0.035
bw = cv2.GaussianBlur(wp, (0, 0), sg) + 1e-4
G = np.zeros_like(FL)
for c in range(3):
    fc = cv2.resize((FL[..., c] * w).astype(np.float32), (PEQ, PEQ), interpolation=cv2.INTER_AREA)
    G[..., c] = cv2.resize(cv2.GaussianBlur(fc, (0, 0), sg) / bw, (S, S), interpolation=cv2.INTER_LINEAR)
cob = cv2.resize(np.clip(cv2.GaussianBlur(wp, (0, 0), sg) / 0.05, 0, 1), (S, S), interpolation=cv2.INTER_LINEAR)
FL[..., 0] -= 0.85 * (G[..., 0] - Lm) * cob
FL[..., 1] -= 0.9 * (G[..., 1] - am) * cob
FL[..., 2] -= 0.9 * (G[..., 2] - bm) * cob
acima = FL[..., 0] - (Lm + 9)
FL[..., 0] = np.where(acima > 0, Lm + 9 + acima * 0.35, FL[..., 0])
face = cv2.cvtColor(FL.astype(np.float32), cv2.COLOR_Lab2BGR)
print('luz tirada: L local da pele %.1f–%.1f (tom %.1f)' % (np.percentile(G[..., 0][cob > 0.5], 5), np.percentile(G[..., 0][cob > 0.5], 95), Lm))
# a cor do rosto casa com a pele da cabeça no anel da emenda (a luz da foto x o albedo da textura): deslocamento em Lab
FL = lab(face); anel = cobre & (alfa > 0.15) & (alfa < 0.7) & (dt < S * 0.05)
dif = np.median(HL2[anel], 0) - np.median(FL[anel], 0)
print('ajuste do rosto (Lab) na emenda:', dif.round(1))
FL2 = FL.copy(); FL2[..., 0] += dif[0] * 0.25; FL2[..., 1] += dif[1] * 0.2; FL2[..., 2] += dif[2] * 0.2
face = cv2.cvtColor(FL2.astype(np.float32), cv2.COLOR_Lab2BGR)
out = H2 * (1 - alfa[..., None]) + face * alfa[..., None]
cv2.imwrite(os.path.join(saida, 'dbg_face.png'), np.uint8(np.clip(face, 0, 1) * 255))
cv2.imwrite(os.path.join(saida, 'dbg_alfa.png'), np.uint8(np.clip(alfa, 0, 1) * 255))
# a íris: a cor da íris da foto (marcos 468–477) no olho da textura (a ilha do olho embaixo: o círculo escuro no meio)
iris = np.zeros(F.shape[:2], np.uint8)
for ci in (468, 473):
    raio = np.mean([np.hypot(*(Lf[ci + j, :2] - Lf[ci, :2])) for j in range(1, 5)])
    cv2.circle(iris, tuple(int(x) for x in Lf[ci, :2]), max(1, int(raio * 0.75)), 255, -1)
cor_iris = np.median(lab(F)[iris > 0], 0)
y0, y1, x0, x1 = int(S * 0.82), S, int(S * 0.19), int(S * 0.37)
ilha = lab(out[y0:y1, x0:x1])
# a íris: o disco mais escuro e mais saturado da ilha, em volta do centro dela
Ly = ilha[..., 0]; croma = np.hypot(ilha[..., 1], ilha[..., 2])
# o olho do Rocketbox (a ilha embaixo à esquerda da textura da cabeça): a íris em (0,263; 0,931) da textura
cyx = (int(S * 0.931) - y0, int(S * 0.263) - x0)
yy, xx = np.mgrid[0:ilha.shape[0], 0:ilha.shape[1]]
rr = np.hypot(yy - cyx[0], xx - cyx[1]) / (S * 0.0165)
m_iris = np.clip((1.0 - rr) * 6, 0, 1) * (rr > 0.28)
ilha2 = ilha.copy()
ilha2[..., 0] = ilha[..., 0] * (1 - m_iris * 0.35) + cor_iris[0] * 0.8 * m_iris * 0.35
for c in (1, 2): ilha2[..., c] = ilha[..., c] * (1 - m_iris) + cor_iris[c] * m_iris
out[y0:y1, x0:x1] = cv2.cvtColor(ilha2.astype(np.float32), cv2.COLOR_Lab2BGR)
print('íris (Lab):', cor_iris.round(1), 'centro na ilha', cyx)
# margem de 24 px em volta das ilhas da UV (a cor da borda para fora): sem ela o mipmap do jogo puxava o preto de fora da
# ilha e aparecia uma linha escura na costura (no meio da testa, no alto da cabeça)
ilhas = np.zeros((S, S), np.uint8)
for k in range(len(TUV)):
    q = np.stack([TUV[k, :, 0] * S, (1 - TUV[k, :, 1]) * S], 1)
    if np.isfinite(q).all(): cv2.fillConvexPoly(ilhas, np.round(q * 4).astype(np.int32), 1, lineType=cv2.LINE_8, shift=2)
# a borda da ilha da cabeça na textura original é escura (até ~30 px no alto da cabeça): ela também é refeita a partir de dentro — era a
# linha no meio da testa, onde a borda de um lado encosta na do outro
borda = (ilhas > 0) & (cv2.erode(ilhas, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(S * 0.03) | 1,) * 2)) == 0)
ilhas |= (H.max(2) > 0.02).astype(np.uint8)  # as outras ilhas da textura (olhos, dentes) também ficam
desconhecido = (ilhas == 0) | borda
o8 = np.uint8(np.clip(out, 0, 1) * 255)
faixa = ((cv2.dilate(ilhas, np.ones((49, 49), np.uint8)) > 0) & (ilhas == 0)) | borda
pq = cv2.resize(o8, (S // 4, S // 4), interpolation=cv2.INTER_AREA)
mq = cv2.dilate(cv2.resize(desconhecido.astype(np.uint8), (S // 4, S // 4), interpolation=cv2.INTER_NEAREST), np.ones((3, 3), np.uint8))
pq = cv2.inpaint(pq, mq * 255, 3, cv2.INPAINT_TELEA)
cheia = cv2.resize(pq, (S, S), interpolation=cv2.INTER_LINEAR)
o8[faixa] = cheia[faixa]
out = o8.astype(np.float32) / 255
# 6b) a COSTURA: o mesmo ponto da cabeça aparece em duas ilhas da UV (o alto da cabeça e o meio da testa); cada lado
# saía com um tom (a luz tirada, a mistura com a cabeça e o espelhado são contas na UV, com vizinhos diferentes) e a
# linha aparecia no jogo. Ao longo de cada aresta da costura, os dois lados vão para a média, a correção sumindo em ~10 px
_uvv = np.zeros((len(P), 2)); _uvv[T3.ravel()] = TUV.reshape(-1, 2)
_pai = np.arange(len(P))
def _raiz(i):
    while _pai[i] != i: _pai[i] = _pai[_pai[i]]; i = _pai[i]
    return i
for a0, b0, c0 in T3:
    for x0, y0 in ((a0, b0), (b0, c0)):
        ra, rb = _raiz(x0), _raiz(y0)
        if ra != rb: _pai[ra] = rb
ilha_v = np.array([_raiz(i) for i in range(len(P))])
_pk = {}
for i, q in enumerate(np.round(P / 2e-4).astype(np.int64)): _pk.setdefault(tuple(q), []).append(i)
irmaos = {i: [j for j in g if j != i and ilha_v[j] != ilha_v[i]] for g in _pk.values() if len(g) > 1 for i in g}
arestas = {}
for t in T3:
    for x0, y0 in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])):
        if x0 in irmaos and y0 in irmaos: arestas[(min(x0, y0), max(x0, y0))] = t
pares = []
for (x0, y0), t in arestas.items():
    for x1 in irmaos[x0]:
        for y1 in irmaos[y0]:
            if ilha_v[x1] == ilha_v[y1] and (min(x1, y1), max(x1, y1)) in arestas: pares.append(((x0, y0, t), (x1, y1, arestas[(min(x1, y1), max(x1, y1))])))
idmap = np.zeros((S, S), np.int32)
_ids = {r: k + 1 for k, r in enumerate(sorted(set(ilha_v.tolist())))}
for t in T3:
    q = np.stack([_uvv[t, 0] * S, (1 - _uvv[t, 1]) * S], 1)
    cv2.fillConvexPoly(idmap, np.round(q * 4).astype(np.int32), _ids[ilha_v[t[0]]], lineType=cv2.LINE_8, shift=2)
def _px(v): return np.array([_uvv[v, 0] * S, (1 - _uvv[v, 1]) * S])
def _amostra(img, x, y):
    return cv2.getRectSubPix(img, (1, 1), (float(x), float(y)))[0, 0]
corr = {k: [np.zeros((S, S, 3), np.float32), np.zeros((S, S), np.float32)] for k in _ids.values()}
out32 = out.astype(np.float32)
for (x0, y0, t0), (x1, y1, t1) in pares:
    A0, B0, A1, B1 = _px(x0), _px(y0), _px(x1), _px(y1)
    c0 = np.array([_px(v) for v in t0]).mean(0); c1 = np.array([_px(v) for v in t1]).mean(0)
    n = int(max(2, np.hypot(*(B0 - A0)) / 2))
    for u in np.linspace(0, 1, n):
        p0 = A0 + (B0 - A0) * u; p1 = A1 + (B1 - A1) * u
        p0 = p0 + (c0 - p0) / (np.linalg.norm(c0 - p0) + 1e-9) * 2.0; p1 = p1 + (c1 - p1) / (np.linalg.norm(c1 - p1) + 1e-9) * 2.0
        if not (0 <= p0[0] < S and 0 <= p0[1] < S and 0 <= p1[0] < S and 0 <= p1[1] < S): continue
        k0 = _ids[ilha_v[x0]]; k1 = _ids[ilha_v[x1]]
        v0 = _amostra(out32, *p0); v1 = _amostra(out32, *p1); m = (v0 + v1) / 2
        for k, pp, dv in ((k0, p0, m - v0), (k1, p1, m - v1)):
            ix, iy = int(pp[0]), int(pp[1])
            corr[k][0][iy, ix] += dv; corr[k][1][iy, ix] += 1
SG = S * 0.005
for k, (Dc, Wc) in corr.items():
    if Wc.sum() == 0: continue
    Db = cv2.GaussianBlur(Dc, (0, 0), SG); Wb = cv2.GaussianBlur(Wc, (0, 0), SG)
    pico = 1 / (2 * math.pi * SG * SG) * 1.0
    cc = Db / np.maximum(Wb, pico)[..., None]
    out32 = np.where((idmap == k)[..., None], out32 + cc, out32)
out = np.clip(out32, 0, 1)
print('costura: %d pares de arestas igualados' % len(pares))
cv2.imwrite(os.path.join(saida, 'cabeca_cor.png'), np.uint8(np.clip(out, 0, 1) * 255))

# 7) o corpo: a pele (braços, pernas, pescoço) com o mesmo tom
B = cv2.imread(bodytex, cv2.IMREAD_UNCHANGED)[:, :, :3].astype(np.float32) / 255
BL = lab(B)
distb = np.sqrt(((BL[..., 1] - tr[1]) ** 2 + (BL[..., 2] - tr[2]) ** 2)) + np.abs(BL[..., 0] - tr[0]) * 0.25
peleb = np.clip(1 - (distb - 12) / 12, 0, 1)
peleb = cv2.GaussianBlur(peleb.astype(np.float32), (0, 0), 3)
BL2 = BL.copy()
for c in range(3): BL2[..., c] = BL[..., c] + (tf[c] - tr[c]) * peleb
cv2.imwrite(os.path.join(saida, 'corpo_cor.png'), np.uint8(np.clip(cv2.cvtColor(BL2.astype(np.float32), cv2.COLOR_Lab2BGR), 0, 1) * 255))
cv2.imwrite(os.path.join(saida, 'mascara_pele_corpo.png'), np.uint8(peleb * 255))
json.dump({'tom_lab_foto': tf.tolist(), 'tom_lab_cabeca': tr.tolist(), 'yaw': D[foto]['yaw']}, open(os.path.join(saida, 'rosto.json'), 'w'))
print('ok')
os._exit(0)
