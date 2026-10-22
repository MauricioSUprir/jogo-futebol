# Máscara de REGIÕES do uniforme na UV do corpo do Rocketbox: o shader do corpo humano (js/render/humano3d.js) pinta
# cada região com a cor do uniforme do time (os KITS do jogo e os do Total Match) — um corpo para todos, nenhuma textura
# por jogador. A região sai de três coisas, por texel da UV:
#   - o osso dominante e a altura de REPOUSO do triângulo que cobre o texel (rasterizados da malha LOD0 encaixada);
#   - a cor da textura original (pele × tecido; o vermelho dos acabamentos: gola, punho, barra do calção);
#   - a posição no corpo (gola perto do pescoço; punho no fim da manga; barra no fim do calção).
# Valores (um canal, 8 bits; o shader lê com texelFetch, sem filtro):
#   0 pele · 1 camisa · 2 manga · 3 gola · 4 punho · 5 calção · 6 barra do calção · 7 meião · 8 chuteira · 9 sola
#   10 acabamento da camisa (as laterais/recortes vermelhos do original)
# Também grava o mapa de normais do pano (as dobras, sem logotipo nem número) em 512² e a caixa da UV do número das
# costas (o "18" do original), onde o shader desenha o número de cada jogador.
# Uso: python -I regioes.py <lods.npz> <m301_body_color.tga> <m301_body_normal.tga> <pasta assets/jogador> [lado=512] [prévia.png]
import sys, os, json, numpy as np, cv2
from PIL import Image
ent, tcor, tnor, pasta = sys.argv[1:5]
N = int(sys.argv[5]) if len(sys.argv) > 5 else 512
d = np.load(ent)
pos, uv, tri = d['corpo_lod0_pos'], d['corpo_lod0_uv'], d['corpo_lod0_tri']
ossos, pesos = d['corpo_lod0_ossos'], d['corpo_lod0_pesos']
dom = ossos[np.arange(len(ossos)), np.argmax(pesos, axis=1)]
cor = np.asarray(Image.open(tcor).convert('RGB').resize((N, N), Image.LANCZOS)).astype(np.float32) / 255
# a UV vem do Blender (v para cima): a linha da imagem é (1 − v)·N (no jogo, a textura sobe com flipY, como no three)
px = np.stack([uv[:, 0] * N, (1 - uv[:, 1]) * N], 1)
osso_t = np.full((N, N), 255, np.uint8); y_t = np.zeros((N, N), np.float32); z_t = np.zeros((N, N), np.float32)
x_t = np.zeros((N, N), np.float32)
for t in tri:
    b = np.bincount(dom[t], minlength=25).argmax()
    pts = np.round(px[t] * 16).astype(np.int32)
    cv2.fillPoly(osso_t, [pts], int(b), lineType=cv2.LINE_8, shift=4)
    yy = float(pos[t, 1].mean()); zz = float(np.abs(pos[t, 2]).mean()); xx = float(pos[t, 0].mean())
    cv2.fillPoly(y_t, [pts], yy, shift=4); cv2.fillPoly(z_t, [pts], zz, shift=4); cv2.fillPoly(x_t, [pts], xx, shift=4)
# dilata os rótulos para dentro das margens da UV (o filtro do mipmap não pega o fundo)
vazio = osso_t == 255
for _ in range(6):
    m = cv2.dilate(np.where(vazio, 0, osso_t.astype(np.int32) + 1).astype(np.uint8), np.ones((3, 3), np.uint8))
    novo = vazio & (m > 0)
    osso_t[novo] = m[novo] - 1
    for arr in (y_t, z_t, x_t):
        arr[novo] = cv2.dilate(arr, np.ones((3, 3), np.uint8))[novo]
    vazio = osso_t == 255
hsv = cv2.cvtColor((cor * 255).astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
H, S, V = hsv[..., 0] * 2, hsv[..., 1] / 255, hsv[..., 2] / 255
pele = (H >= 4) & (H <= 40) & (S >= 0.18) & (S <= 0.65) & (V >= 0.35)
vermelho = ((H <= 16) | (H >= 340)) & (S >= 0.7) & (V >= 0.45)
R = np.full((N, N), 1, np.uint8)
tronco = np.isin(osso_t, [0, 1, 2, 3, 5, 9, 23, 24])
braco = np.isin(osso_t, [6, 10, 21, 22])
antebraco = np.isin(osso_t, [7, 8, 11, 12])
coxa = np.isin(osso_t, [13, 16])
canela = np.isin(osso_t, [14, 17, 19, 20])
pe = np.isin(osso_t, [15, 18])
cintura = 0.93  # altura da cintura no repouso encaixado: acima é camisa, abaixo é calção (tronco)
R[:] = 1
R[tronco & (y_t < cintura)] = 5
R[coxa] = 5
R[braco] = 2
R[antebraco] = 0
R[canela] = 7
R[pe] = 8
R[pe & (y_t > 0.13)] = 7   # o fim do meião (o tornozelo do desenho segura com o pé, mas é meia)
R[pe & (y_t < 0.025)] = 9
R[pele & ~pe] = 0
# acabamentos vermelhos do original: gola (perto do pescoço), punho (manga), barra do calção, laterais da camisa
R[vermelho & tronco & (y_t >= 1.33) & (z_t < 0.12)] = 3
R[vermelho & braco] = 4
R[vermelho & (coxa | (tronco & (y_t < cintura)))] = 6
R[vermelho & tronco & (y_t >= cintura) & ~((y_t >= 1.33) & (z_t < 0.12)) & ((z_t >= 0.1) | (y_t >= 1.33))] = 10  # o logotipo do peito (no meio) não
R[osso_t == 4] = 0
# no tronco não há pele (o pescoço é da cabeça): o logotipo do peito (letras claras e vermelhas) volta a ser camisa
R[tronco & (y_t >= cintura) & np.isin(R, [0, 10]) & (z_t < 0.11) & (y_t < 1.33)] = 1
R[tronco & (y_t >= cintura) & (R == 0)] = 1
cv2.imwrite(os.path.join(pasta, 'regioes.png'), R)
# número das costas: os texels claros do "18" no meio de cima das costas (camisa, x de repouso < −0,05 = costas)
costas = (R == 1) & (x_t < -0.05) & (y_t > 1.15) & (y_t < 1.42)
claro = V > 0.7
ys, xs = np.nonzero(costas & claro & (np.abs(np.arange(N)[None, :] - N / 2) < N * 0.12))
caixa = None
if len(xs):
    caixa = [round(float(xs.min()) / N, 4), round(float(ys.min()) / N, 4), round(float(xs.max() + 1) / N, 4), round(float(ys.max() + 1) / N, 4)]
nor = Image.open(tnor).convert('RGB').resize((N, N), Image.LANCZOS)
nor.save(os.path.join(pasta, 'pano-normal.webp'), 'WEBP', quality=88, method=6)
nomes = ['pele', 'camisa', 'manga', 'gola', 'punho', 'calção', 'barra', 'meião', 'chuteira', 'sola', 'acabamento']
cont = {nomes[k]: int((R == k).sum()) for k in range(len(nomes))}
json.dump({'lado': N, 'regioes': nomes, 'texels': cont, 'numero': caixa}, open(os.path.join(pasta, 'regioes.json'), 'w'), ensure_ascii=False, indent=1)
# prévia colorida para conferir (opcional: 6º argumento)
if len(sys.argv) > 6:
    pal = np.array([[224, 172, 140], [40, 120, 220], [30, 90, 180], [250, 220, 40], [250, 140, 30], [30, 30, 30], [200, 40, 40],
                    [240, 240, 240], [120, 220, 80], [60, 60, 60], [230, 60, 200]], np.uint8)
    cv2.imwrite(sys.argv[6], cv2.cvtColor(np.hstack([pal[R], (cor * 255).astype(np.uint8)]), cv2.COLOR_RGB2BGR))
print(json.dumps({'texels': cont, 'numero': caixa}, ensure_ascii=False))
