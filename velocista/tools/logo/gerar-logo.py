# Gera a logo do jogo (velocista/assets/logo/logo.webp) no estilo da referência do dono (VELOCITY / BREAKPOINT):
# letras bem inclinadas e grossas, cada peça com moldura dourada chanfrada, face vermelha de metal amassado, extrusão
# escura para baixo e à direita, lâminas prateada e douradas subindo para a direita, rastros vermelhos de velocidade e
# brilho. As letras do FLASH são desenho próprio (polígonos), não uma fonte pronta.
# Uso: python3 -I velocista/tools/logo/gerar-logo.py <saída.webp> [--png <prévia.png>]   (Pillow + numpy)
#      python3 -I velocista/tools/logo/gerar-logo.py --icone <pasta>   → o ÍCONE do app (o F com as lâminas, quadrado, fundo
#      escuro): icone-512.png, icone-192.png, apple-touch-icon.png (180) e favicon-32.png
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops

ICONE = '--icone' in sys.argv
W, H = (1024, 1024) if ICONE else (2400, 980)   # tela de trabalho (a logo sai recortada nas bordas; o ícone fica quadrado)
SS = 2                           # superamostragem dos polígonos
CAP = 420 if ICONE else 270      # altura das letras grandes (px)
K = 1.7 if ICONE else 1.0        # espessura da moldura, da extrusão e do brilho (o ícone é visto pequeno: tudo mais grosso)
INCL = 0.62                      # inclinação (x += INCL * altura)
BASE_Y = 830 if ICONE else 650   # linha de base das letras
rng = np.random.default_rng(20261026)


def cisalha(pts, x0, y0, esc=CAP):
    """pontos (u, v) da letra (v = 0 embaixo, 1 em cima) → tela (x para a direita, y para baixo)."""
    return [(x0 + (u + INCL * v) * esc, y0 - v * esc) for u, v in pts]


def mascara(polys):
    im = Image.new('L', (W * SS, H * SS), 0)
    d = ImageDraw.Draw(im)
    for p in polys:
        d.polygon([(x * SS, y * SS) for x, y in p], fill=255)
    return np.asarray(im.resize((W, H), Image.LANCZOS), dtype=np.float32) / 255.0


def borra(a, r):
    return np.asarray(Image.fromarray(np.uint8(np.clip(a, 0, 1) * 255)).filter(ImageFilter.GaussianBlur(r)), dtype=np.float32) / 255.0


def dilata(a, r):
    if r <= 0: return a
    im = Image.fromarray(np.uint8(np.clip(a, 0, 1) * 255))
    while r > 0:
        k = min(r, 7); im = im.filter(ImageFilter.MaxFilter(2 * k + 1)); r -= k
    return np.asarray(im, dtype=np.float32) / 255.0


def erode(a, r):
    return 1 - dilata(1 - a, r)


def ruido(oitavas=6, base=6):
    """ruído fractal 0..1 do tamanho da tela"""
    acc = np.zeros((H, W), np.float32); amp = 1.0; tot = 0
    for o in range(oitavas):
        n = base * 2 ** o
        g = rng.random((max(2, n * H // W), n)).astype(np.float32)
        acc += amp * np.asarray(Image.fromarray(np.uint8(g * 255)).resize((W, H), Image.BICUBIC), np.float32) / 255.0
        tot += amp; amp *= 0.55
    return acc / tot


def sombreado(m, raio, luz=(-0.55, -0.83)):
    """relevo de uma máscara: o quanto cada ponto olha para a luz (vinda de cima à esquerda), -1..1"""
    h = borra(m, raio)
    gy, gx = np.gradient(h)
    n = np.sqrt(gx * gx + gy * gy) + 1e-6
    return np.clip((gx * luz[0] + gy * luz[1]) / n, -1, 1) * np.clip(n * raio * 3, 0, 1)


def rampa(t, cores):
    """t 0..1 → cor por uma rampa de [(pos, (r,g,b))]"""
    t = np.clip(t, 0, 1)[..., None]
    out = np.zeros(t.shape[:-1] + (3,), np.float32)
    for (p0, c0), (p1, c1) in zip(cores, cores[1:]):
        k = np.clip((t - p0) / (p1 - p0), 0, 1)
        seg = (t >= p0) & (t <= p1)
        out = np.where(seg, np.array(c0, np.float32) + (np.array(c1, np.float32) - np.array(c0, np.float32)) * k, out)
    return out / 255.0


# ---------------------------------------------------------------- as letras (u, v), peça por peça
T = 0.30                         # espessura do traço
def F(x0):
    corpo = [(-0.62, 0.92), (0.06, 1.0), (1.05, 1.0), (1.05, 0.74), (T, 0.74), (T, 0.0), (0.0, 0.0), (0.0, 0.70), (-0.22, 0.80)]   # com uma asa curta e afiada para a esquerda
    if ICONE: corpo = [(-0.30, 0.95), (0.06, 1.0), (1.05, 1.0), (1.05, 0.74), (T, 0.74), (T, 0.0), (0.0, 0.0), (0.0, 0.72), (-0.08, 0.82)]   # no ícone, asa menor
    meio = [(T + 0.07, 0.60), (0.86, 0.60), (0.86, 0.38), (T + 0.07, 0.38)]
    return [cisalha(corpo, x0, BASE_Y), cisalha(meio, x0, BASE_Y)], 1.05
def L(x0):
    return [cisalha([(0, 1), (T, 1), (T, 0.26), (0.98, 0.26), (0.98, 0), (0, 0)], x0, BASE_Y)], 0.98
def A(x0):
    fora = [(0, 0), (0.46, 1), (0.82, 1), (1.24, 0), (0.92, 0), (0.83, 0.22), (0.43, 0.22), (0.33, 0)]
    furo = [(0.52, 0.44), (0.74, 0.44), (0.645, 0.70)]
    return [cisalha(fora, x0, BASE_Y)], 1.24, [cisalha(furo, x0, BASE_Y)]
def S_(x0):
    s = [(0.12, 1), (1.0, 1), (1.0, 0.76), (T, 0.76), (T, 0.62), (0.88, 0.62), (1.0, 0.50), (1.0, 0.12), (0.88, 0), (0, 0),
         (0, 0.24), (1.0 - T, 0.24), (1.0 - T, 0.38), (0.12, 0.38), (0, 0.50), (0, 0.88)]
    return [cisalha(s, x0, BASE_Y)], 1.0
def H_(x0):
    h = [(0, 0), (0, 1), (T, 1), (T, 0.62), (0.72, 0.62), (0.72, 1), (1.02, 1), (1.02, 0.26), (1.75, 0.0), (0.72, 0.0), (0.72, 0.38), (T, 0.38), (T, 0)]
    return [cisalha(h, x0, BASE_Y)], 1.02

pecas, furos = [], []
LARGS = [1.05, 0.98, 1.24, 1.0, 1.02]
total = (sum(LARGS) + 0.2 * 4 + INCL + 0.73 + 0.62) * CAP        # letras, espaços, inclinação, rabo do H, asa do F
X0 = (W - total) / 2 + 0.62 * CAP
if ICONE: X0 = (W - (1.05 + INCL + 0.30) * CAP) / 2 + 0.30 * CAP - 0.04 * CAP     # só o F, no meio
x = X0
for fn in ((F,) if ICONE else (F, L, A, S_, H_)):
    r = fn(x)
    pecas += r[0]
    if len(r) > 2: furos += r[2]
    x += (r[1] + 0.20) * CAP

# lâminas (prateada e douradas) subindo para a direita por cima do F, do L e do A: afiadas na ponta
def lamina(bx, by, comp, ang, larg):
    """base (bx, by) na altura do topo das letras; sobe para a direita com ângulo `ang` (graus); larga na base, ponta fina"""
    import math
    a = math.radians(ang); dx, dy = math.cos(a), -math.sin(a); nx, ny = -dy, dx
    corte = INCL                                        # a base é cortada na inclinação das letras
    p0 = (bx, by); p1 = (bx + larg / max(0.3, abs(dy * corte + dx)) , by)
    meio = (bx + dx * comp * 0.78 + nx * larg * 0.10, by + dy * comp * 0.78 + ny * larg * 0.10)
    ponta = (bx + dx * comp, by + dy * comp)
    q = (bx + dx * comp * 0.80 - nx * larg * 0.55, by + dy * comp * 0.80 - ny * larg * 0.55)
    return [p0, (p1[0], p1[1]), meio, ponta, q]
topo = BASE_Y - CAP * 1.06
laminas = [
    ('prata', lamina(X0 + 0.55 * CAP, topo, 760, 21, 95)),
    ('ouro', lamina(X0 + 1.30 * CAP, topo, 900, 19, 92)),
    ('ouro', lamina(X0 + 2.10 * CAP, topo, 560, 15, 70)),
] if not ICONE else [
    ('prata', lamina(X0 + 0.40 * CAP, topo, 400, 33, 112)),
    ('ouro', lamina(X0 + 0.98 * CAP, topo, 330, 30, 100)),
]

# ---------------------------------------------------------------- composição (sobre preto; o alfa sai do fim)
img = np.zeros((H, W, 3), np.float32)
solido = np.zeros((H, W), np.float32)
furo_m = mascara(furos) if furos else np.zeros((H, W), np.float32)
tex = ruido(7, 5)
vinco = 1 - np.abs(ruido(6, 9) * 2 - 1)            # vincos de metal amassado (ruído "em crista")
vinco = np.clip((vinco - 0.72) * 4, 0, 1)
fino = 1 - np.abs(ruido(5, 28) * 2 - 1)
vinco = np.maximum(vinco * 0.8, np.clip((fino - 0.86) * 7, 0, 1) * 0.7)

def pinta_peca(m, tipo='vermelho'):
    global img, solido
    m = np.clip(m - furo_m, 0, 1)
    ys, xs = np.nonzero(m > 0.5)
    if not len(ys): return
    y0, y1 = ys.min(), ys.max()
    # extrusão escura (para baixo e à direita)
    ext = np.zeros_like(m)
    for k in range(1, int(19 * K)): ext = np.maximum(ext, np.roll(np.roll(m, k, 0), int(k * 0.9), 1))
    ext = dilata(ext, int(10 * K)) * (1 - dilata(m, int(10 * K)))
    img = img * (1 - ext[..., None]) + ext[..., None] * np.array([0.16, 0.03, 0.03]) * (0.6 + 0.4 * tex[..., None])
    # moldura dourada chanfrada
    ouro = dilata(m, int(11 * K))
    sh = sombreado(ouro, 6 * K)
    tvert = (np.arange(H, dtype=np.float32)[:, None] - y0) / max(1, (y1 - y0))
    cor_ouro = rampa(np.clip(0.55 + 0.45 * sh - 0.25 * tvert + 0.15 * (tex - 0.5), 0, 1),
                     [(0, (52, 24, 2)), (0.3, (140, 80, 12)), (0.55, (214, 150, 42)), (0.78, (255, 214, 110)), (1.0, (255, 248, 210))])
    anel = ouro - dilata(m, int(5 * K))                          # filete escuro no meio da moldura (o chanfro)
    cor_ouro = cor_ouro * (1 - 0.45 * np.clip(anel * (1 - dilata(m, int(4 * K))), 0, 1)[..., None] * (sh[..., None] < 0))
    img = img * (1 - ouro[..., None]) + ouro[..., None] * cor_ouro
    # filete escuro entre a moldura e a face
    fil = dilata(m, max(1, int(K)))
    img = img * (1 - fil[..., None] * 0.85)
    # a face
    face = erode(m, int(2 * K))
    if tipo == 'vermelho':
        base = rampa(np.clip(0.80 - 0.75 * tvert + 0.55 * (tex - 0.5), 0, 1),
                     [(0, (34, 0, 6)), (0.3, (96, 2, 14)), (0.58, (172, 10, 26)), (0.82, (226, 30, 44)), (1.0, (255, 104, 96))])
        borda = 1 - erode(face, int(9 * K))                          # chanfro interno: a borda da face escurece embaixo e clareia em cima
        shf = sombreado(face, 7 * K)
        base = base * (1 + 0.45 * shf[..., None] * borda[..., None])
        base = base * (0.78 + 0.44 * tex[..., None]) + vinco[..., None] * np.array([0.42, 0.10, 0.10]) * 0.9
        brilho = np.clip(1 - np.abs((np.arange(W)[None, :] * 0.35 + np.arange(H)[:, None]) % 900 - 200) / 160, 0, 1) * 0.25   # faixa diagonal de reflexo
        base = base + brilho[..., None] * np.array([1.0, 0.65, 0.6])
    else:
        prata = tipo == 'prata'
        shf = sombreado(face, 6)
        t = np.clip(0.55 + 0.4 * shf + 0.25 * (tex - 0.5) - 0.2 * tvert, 0, 1)
        base = rampa(t, [(0, (38, 40, 44)), (0.35, (104, 108, 114)), (0.65, (176, 180, 186)), (0.85, (226, 228, 232)), (1.0, (255, 255, 255))]) if prata else \
               rampa(t, [(0, (90, 50, 6)), (0.4, (190, 128, 30)), (0.7, (240, 196, 92)), (1.0, (255, 244, 196))])
        base = base + vinco[..., None] * (0.25 if prata else 0.2)
    img = img * (1 - face[..., None]) + face[..., None] * np.clip(base, 0, 1.4)
    solido = np.maximum(solido, ouro)

# rastros vermelhos de velocidade (atrás de tudo): poucos, grossos perto das lâminas e afinando para a direita
rastro = Image.new('L', (W, H), 0); dr = ImageDraw.Draw(rastro)
import math
for (tipo, p), (comp, sob, esp) in zip(laminas, [(560, 30, 7), (720, 34, 8), (620, 26, 6)] if not ICONE else [(300, 36, 11), (300, 40, 12)]):
    xt, yt = p[3]
    for k in range(2):
        y = yt + sob + k * 28; x0r = xt - 260 - k * 40; c = comp - k * 160
        dr.polygon([(x0r, y - esp + k * 2), (x0r + c, y - 6 - k * 4), (x0r + c, y - 5 - k * 4), (x0r, y + esp - k * 2)], fill=255)
rastro = np.asarray(rastro, np.float32) / 255.0
for r, ganho in [(2, 1.0), (7, 0.9), (22, 0.8), (50, 0.4)]:
    img += borra(rastro, r)[..., None] * np.array([1.0, 0.12, 0.05]) * ganho
img += rastro[..., None] * np.array([1.0, 0.7, 0.5]) * 0.9

# as lâminas e as letras
for tipo, p in laminas:
    pinta_peca(mascara([p]), tipo)
for p in pecas:
    pinta_peca(mascara([p]), 'vermelho')

# subtítulo prateado espaçado, com os filetes vermelhos dos lados (só na logo)
sub = '' if ICONE else 'BREAKPOINT'
fonte = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 64)
camada = Image.new('L', (W, H), 0); dc = ImageDraw.Draw(camada)
esp = 52; larg = sum(dc.textlength(c, font=fonte) for c in sub) + esp * (len(sub) - 1)
xs = (W - larg) / 2 + 60; ys = BASE_Y + 52
if ICONE: larg = -10000                                 # (sem filetes)
for c in sub:
    dc.text((xs, ys), c, font=fonte, fill=255); xs += dc.textlength(c, font=fonte) + esp
camada = camada.transform((W, H), Image.AFFINE, (1, 0.28, -0.28 * (ys + 40), 0, 1, 0), Image.BICUBIC)   # inclina um pouco
subm = np.asarray(camada, np.float32) / 255.0
cont = dilata(subm, 2)
img = img * (1 - cont[..., None] * 0.9)
t = (np.arange(H, dtype=np.float32)[:, None] - ys) / 64
cromo = rampa(np.clip(np.broadcast_to(np.where(t < 0.5, 1 - t * 0.9, 0.35 + (t - 0.5) * 1.1), (H, W)), 0, 1),
              [(0, (70, 72, 78)), (0.45, (150, 152, 158)), (0.7, (225, 226, 230)), (1.0, (255, 255, 255))])
img = img * (1 - subm[..., None]) + subm[..., None] * cromo
solido = np.maximum(solido, cont * 0.95)
for lado in (-1, 1):
    cx = W / 2 + 60 + lado * (larg / 2 + 120); cy = ys + 40
    fio = Image.new('L', (W, H), 0); ImageDraw.Draw(fio).polygon([(cx - 90, cy - 2), (cx + 90, cy - 2), (cx + 90, cy + 2), (cx - 90, cy + 2)], fill=255)
    f = np.asarray(fio, np.float32) / 255.0
    img += (borra(f, 6) * 1.5 + f)[..., None] * np.array([1.0, 0.2, 0.1])

# brilho geral (o vermelho e o dourado "acendem" em volta) e reflexos de luz em algumas quinas
lum = img.max(axis=2) * solido
for r, ganho in [(10 * K, 0.35), (40 * K, 0.30)]:
    img += borra(lum, r)[..., None] * np.array([1.0, 0.35, 0.12]) * ganho
flare = np.zeros((H, W), np.float32)
for fx, fy in ([(X0 - 0.62 * CAP + INCL * 0.92 * CAP, BASE_Y - 0.92 * CAP), (X0 + (1.25 + 0.98) * CAP, BASE_Y - 3), laminas[1][1][3], (X0 + total - 0.62 * CAP - 0.05 * CAP, BASE_Y - 4)]
               if not ICONE else [laminas[1][1][3], (X0 - 0.30 * CAP + INCL * 0.95 * CAP, BASE_Y - 0.95 * CAP)]):
    yy, xx = np.mgrid[0:H, 0:W]
    flare += np.exp(-(((xx - fx) / 16) ** 2 + ((yy - fy) / 10) ** 2)) + 0.35 * np.exp(-(((xx - fx) / 220) ** 2 + ((yy - fy) / 2.5) ** 2))
img += flare[..., None] * np.array([1.0, 0.85, 0.6])

# ---------------------------------------------------------------- o ícone: quadrado opaco, fundo escuro com o brilho vermelho atrás do F
if ICONE:
    import os
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt(((xx - W * 0.52) / (W * 0.62)) ** 2 + ((yy - H * 0.55) / (H * 0.62)) ** 2)
    fundo = np.array([7, 8, 15], np.float32) / 255 + np.clip(1 - d, 0, 1)[..., None] ** 1.6 * np.array([0.42, 0.04, 0.07])
    rgb = np.clip(img, 0, 1); a = np.clip(np.maximum(solido, rgb.max(axis=2) * 1.15), 0, 1)[..., None]
    final = Image.fromarray(np.uint8(np.clip(fundo * (1 - a) + rgb + fundo * 0 * a, 0, 1) * 255), 'RGB')
    pasta = sys.argv[sys.argv.index('--icone') + 1]; os.makedirs(pasta, exist_ok=True)
    for nome, lado in [('icone-512.png', 512), ('icone-192.png', 192), ('apple-touch-icon.png', 180), ('favicon-32.png', 32)]:
        final.resize((lado, lado), Image.LANCZOS).save(os.path.join(pasta, nome), optimize=True)
    print('ícones em', pasta); sys.exit(0)

# ---------------------------------------------------------------- alfa: sólido onde há peça; nos brilhos, o próprio brilho
rgb = np.clip(img, 0, 1)
alfa = np.clip(np.maximum(solido, rgb.max(axis=2) * 1.15), 0, 1)
cor = np.where(alfa[..., None] > 1e-4, rgb / np.maximum(alfa[..., None], 1e-4), 0)
out = Image.fromarray(np.uint8(np.clip(np.dstack([cor, alfa]), 0, 1) * 255), 'RGBA')
bb = Image.fromarray(np.uint8(alfa * 255)).point(lambda v: 255 if v > 6 else 0).getbbox()
out = out.crop((max(0, bb[0] - 20), max(0, bb[1] - 20), min(W, bb[2] + 20), min(H, bb[3] + 20)))
destino = sys.argv[1]
out.save(destino, 'WEBP', quality=90, method=6)
if '--png' in sys.argv:
    fundo = Image.new('RGBA', out.size, (0, 0, 0, 255)); fundo.alpha_composite(out)
    fundo.convert('RGB').save(sys.argv[sys.argv.index('--png') + 1])
print(destino, out.size)
