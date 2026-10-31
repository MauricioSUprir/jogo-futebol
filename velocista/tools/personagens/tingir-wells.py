# Wells (edição pessoal, temporada da série): a partir do avatar do DeVoe (Rocketbox Male_Adult_03, MIT): cabelo escuro e roupa
# azul-marinho. Uso: python3 -I tingir-wells.py velocista/assets/personagens/devoe velocista/assets/personagens/wells (copie antes o corpo.json/.bin)
import sys
import numpy as np
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
cab = np.asarray(Image.open(f'{src}/cabeca.webp').convert('RGB')).astype(np.float32)
H, W, _ = cab.shape
r, g, b = cab[..., 0], cab[..., 1], cab[..., 2]
mx, mn = cab.max(-1), cab.min(-1)
yy = np.arange(H)[:, None] / H
# cabelo: cinza (pouca saturação), claro, na parte de cima da textura (o rosto e a pele têm R bem acima de B)
xx = np.arange(W)[None, :] / W
lado = np.clip((np.abs(xx - 0.5) - 0.15) / 0.2, 0, 1)
linha = 0.168 + 0.28 * lado                                   # a linha do cabelo: na testa no meio, desce atrás das orelhas
pele_sat = ((g / np.maximum(r, 1)) < 0.70) & ((r - b) > 70)    # as orelhas e a pele de verdade
cabelo = ((yy < linha) & (mx > 30) & ~(pele_sat & (yy > 0.24))) | ((g / np.maximum(r, 1) > 0.745) & (mx > 60) & (yy < 0.45) & ((r - b) < 62))
L = cab.mean(-1, keepdims=True)
escuro = np.concatenate([L * 0.30 + 6, L * 0.27 + 5, L * 0.25 + 4], -1)      # castanho-escuro grisalho
m = cabelo.astype(np.float32)[..., None]
# borda suave
from PIL import ImageFilter
mm = np.asarray(Image.fromarray((m[..., 0] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(5))).astype(np.float32)[..., None] / 255
out = cab * (1 - mm) + escuro * mm
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(f'{dst}/cabeca.webp', quality=86)
cor = np.asarray(Image.open(f'{src}/corpo.webp').convert('RGB')).astype(np.float32)
r, g, b = cor[..., 0], cor[..., 1], cor[..., 2]
mx, mn = cor.max(-1), cor.min(-1)
L = cor.mean(-1, keepdims=True)
pele = (r > 150) & (r - b > 45)                                                  # as mãos
vermelho = (r - g > 22) & (r - b > 12) & ~pele                                   # a camisa vinho → cinza-escuro
paleto = (mx - mn < 40) & (L[..., 0] > 40) & ~pele                               # o paletó de tweed → azul-marinho quase preto
saida = cor.copy()
saida[paleto] = (L[paleto] * np.array([0.42, 0.46, 0.58]) + np.array([4, 5, 9]))
saida[vermelho] = (L[vermelho] * np.array([0.55, 0.55, 0.58]))
Image.fromarray(np.clip(saida, 0, 255).astype(np.uint8)).save(f'{dst}/corpo.webp', quality=82)
print('ok', cabelo.mean(), paleto.mean(), vermelho.mean())
