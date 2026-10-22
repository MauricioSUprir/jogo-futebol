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
    ganho = np.clip(alvo / np.maximum(lin(claro.mean(0)), 1e-3), 0.75, 2.4)
    # o ganho de exposição comum (média) inteiro, o desvio de cor de cada canal pela metade (a esclera também é amarelada)
    gm = np.exp(np.log(ganho).mean()); ganho = gm * (ganho / gm) ** 0.5
    F = np.clip(srgb(lin(F) * ganho), 0, 1).astype(np.float32)
    print('esclera: ganho BGR', ganho.round(2))

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
a = np.clip((vp - 0.18) / 0.3, 0, 1)
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

# 5) a pele da cabeça (fora do rosto) ganha o tom da foto: deslocamento em Lab só onde é pele (perto do tom da cabeça)
HL = lab(H)
dist = np.sqrt(((HL[..., 1] - tr[1]) ** 2 + (HL[..., 2] - tr[2]) ** 2)) + np.maximum(0, (tr[0] - 25) - HL[..., 0]) * 0.6
pele = np.clip(1 - (dist - 10) / 12, 0, 1)
pele = cv2.GaussianBlur(pele.astype(np.float32), (0, 0), 3)
HL2 = HL.copy()
for c in range(3): HL2[..., c] = HL[..., c] + (tf[c] - tr[c]) * pele
H2 = cv2.cvtColor(HL2.astype(np.float32), cv2.COLOR_Lab2BGR)
HL2 = lab(H2)

# 5b) o cabelo: a cor do cabelo da foto (segmentador, classe 1) no cabelo da cabeça (o que não é pele, na metade de cima)
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
    m_cab = (1 - pele) * (yy0 < 0.5) * (HL2[..., 0] > 3)
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
ok_px = np.isin(cat, (1, 3, 5)).astype(np.float32)
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
cont, _ = cv2.findContours(cobre.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
cheio = np.zeros((S, S), np.uint8); cv2.drawContours(cheio, cont, -1, 1, -1)
buraco = (cheio > 0) & ~cobre
f8 = np.uint8(np.clip(face, 0, 1) * 255)
f8 = cv2.inpaint(f8, buraco.astype(np.uint8) * 255, 3, cv2.INPAINT_TELEA)
face = np.where(buraco[..., None], f8.astype(np.float32) / 255, face)
okuv = np.where(buraco, 1.0, okuv)
dt = cv2.distanceTransform(cheio, cv2.DIST_L2, 5)
alfa = np.clip((dt - S * 0.01) / (S * 0.035), 0, 1) * np.clip(okuv * 1.5 - 0.25, 0, 1)
alfa = cv2.GaussianBlur(alfa.astype(np.float32), (0, 0), 2.0)
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
