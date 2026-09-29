#!/usr/bin/env python3
"""Gera os assets do jogo a partir de dados reais de Marte.

Terreno: HiRISE DTM 1 m/px da cratera Jezero (Mars 2020 TRN, USGS/NASA/JPL)
         + CTX DTM 20 m/px para o horizonte distante.
Texturas: ambientCG (CC0), recoloridas para o regolito marciano.

Uso: python3 build_assets.py <pasta_com_downloads> <pasta_marte>
Downloads esperados (ver README do jogo):
  dtm_n.tif  DTM_MOLAtopography_DeltaGeoid_Jezero_CR_NORTH_Edited_affine_1m_Eqc_latTs0_lon0.tif
  ctx.tif    JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif
  tex/Ground079S, tex/Ground096B, tex/Rocks011 (zips 2K-JPG extraídos)
"""
import json, math, sys, os
import numpy as np, tifffile
from PIL import Image
from scipy import ndimage

SRC, OUT = sys.argv[1], sys.argv[2]
N = 2048                      # células do mapa jogável (1 m cada) -> 2049 amostras
WIN_Y, WIN_X = 3840, 800      # janela escolhida: campo de megarriples + terreno rochoso + crista
R_MARS = 3396190.0
rng = np.random.default_rng(3710)

# ---------------------------------------------------------------- terreno 1 m
t = tifffile.TiffFile(os.path.join(SRC, 'dtm_n.tif')); pg = t.pages[0]
sx, sy, _ = pg.tags['ModelPixelScaleTag'].value
_, _, _, E0, N0, _ = pg.tags['ModelTiepointTag'].value
dtm = pg.asarray()
h = dtm[WIN_Y:WIN_Y + N + 1, WIN_X:WIN_X + N + 1].astype(np.float64)
assert (h > -30000).all(), 'janela com nodata'
h = ndimage.gaussian_filter(h, 0.8)        # tira o ruído da estereofotogrametria (~0.5 m)

# crateras pequenas (o piso de Jezero é salpicado delas; o DTM de 1 m suaviza as menores)
yy, xx = np.mgrid[0:N + 1, 0:N + 1].astype(np.float64)
craters = []
cx0, cz0 = N / 2, N / 2
for i in range(70):
    d = float(np.exp(rng.uniform(np.log(4), np.log(45))))   # diâmetro 4..45 m (lei de potência)
    x, z = rng.uniform(40, N - 40, 2)
    if math.hypot(x - cx0, z - cz0) < 60: continue        # área de pouso limpa
    r = d / 2; depth = d * rng.uniform(0.12, 0.2); rim = depth * 0.35
    x0, x1 = int(max(0, x - 2 * r)), int(min(N, x + 2 * r)) + 1
    z0, z1 = int(max(0, z - 2 * r)), int(min(N, z + 2 * r)) + 1
    dx = xx[z0:z1, x0:x1] - x; dz = yy[z0:z1, x0:x1] - z
    q = np.sqrt(dx * dx + dz * dz) / r
    bowl = np.where(q < 1, (q * q - 1) * depth + rim, 0)
    ejecta = np.where(q >= 1, rim * np.exp(-(q - 1) * 3.2), 0)
    h[z0:z1, x0:x1] += bowl + ejecta
    craters.append([round(x, 1), round(z, 1), round(d, 1)])

hmin, hmax = h.min(), h.max()
scale = (hmax - hmin) / 65535.0
q16 = np.round((h - hmin) / scale).astype(np.uint32)
rgb = np.zeros((N + 1, N + 1, 3), np.uint8)
rgb[..., 0] = q16 >> 8; rgb[..., 1] = q16 & 255
Image.fromarray(rgb).save(os.path.join(OUT, 'assets/terrain/height.png'), optimize=True)

# ---------------------------------------------------------------- máscaras 2 m (rocha, areia, AO)
hs = h[::2, ::2]
gy, gx = np.gradient(hs, 2.0)
slope = np.hypot(gx, gy)
hp = hs - ndimage.gaussian_filter(hs, 4.0)          # escala de 8 m: ignora as megaondulações de areia
rough = np.sqrt(ndimage.gaussian_filter(hp * hp, 3.0))
rock = np.clip((rough - 0.22) / 0.45, 0, 1) * 0.85 + np.clip((slope - 0.5) / 0.4, 0, 1) * 0.6
rock = np.clip(ndimage.gaussian_filter(rock, 1.0), 0, 1)
low = hs - ndimage.gaussian_filter(hs, 30)
sand = np.clip(1 - rock * 1.6, 0, 1) * np.clip(0.6 - low * 0.08, 0, 1)
ao = np.zeros_like(hs)
for sig, w in ((3, 0.5), (10, 0.35), (30, 0.25)):
    ao += w * (hs - ndimage.gaussian_filter(hs, sig))
ao = np.clip(1 + ao * 0.18, 0.35, 1.0)
m = np.stack([rock, sand, ao], -1)
Image.fromarray((m[:1024, :1024] * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, 'assets/terrain/mask.png'), optimize=True)

# ---------------------------------------------------------------- horizonte 20 m (CTX)
tc = tifffile.TiffFile(os.path.join(SRC, 'ctx.tif')); pc = tc.pages[0]
_, _, _, CE0, CN0, _ = pc.tags['ModelTiepointTag'].value
ctx = pc.asarray().astype(np.float64)
bad = ~(ctx > -1e30)
if bad.any():
    idx = ndimage.distance_transform_edt(bad, return_distances=False, return_indices=True)
    ctx = ctx[tuple(idx)]
FAR_N, FAR_RES = 640, 20.0                # 12,8 km
cE = E0 + (WIN_X + N / 2) * sx; cN = N0 - (WIN_Y + N / 2) * sy
col0 = (cE - FAR_N / 2 * FAR_RES - CE0) / 20.0
row0 = (CN0 - (cN + FAR_N / 2 * FAR_RES)) / 20.0
rows = row0 + np.arange(FAR_N + 1); cols = col0 + np.arange(FAR_N + 1)
far = ndimage.map_coordinates(ctx, np.meshgrid(rows, cols, indexing='ij'), order=1, mode='nearest')
# alinha a média do CTX ao HiRISE na área de sobreposição
a0 = FAR_N // 2 - int(N / 2 / FAR_RES); a1 = FAR_N // 2 + int(N / 2 / FAR_RES)
off = h[::20, ::20].mean() - far[a0:a1 + 1, a0:a1 + 1].mean()
far += off
fmin, fmax = far.min(), far.max(); fscale = (fmax - fmin) / 65535.0
f16 = np.round((far - fmin) / fscale).astype(np.uint32)
frgb = np.zeros((FAR_N + 1, FAR_N + 1, 3), np.uint8); frgb[..., 0] = f16 >> 8; frgb[..., 1] = f16 & 255
Image.fromarray(frgb).save(os.path.join(OUT, 'assets/terrain/far.png'), optimize=True)

lon = math.degrees(cE / R_MARS); lat = math.degrees(cN / R_MARS)
meta = dict(size=N, res=1.0, hmin=hmin, scale=scale, farSize=FAR_N, farRes=FAR_RES, farMin=fmin,
            farScale=fscale, lat=lat, lon=lon, maskRes=2.0, craters=craters,
            source='HiRISE DTM 1 m Jezero (USGS Astrogeology / NASA / JPL / UArizona) + CTX DTM 20 m')
json.dump(meta, open(os.path.join(OUT, 'assets/terrain/meta.json'), 'w'), indent=1)
print('terreno ok', meta['lat'], meta['lon'], hmin, hmax, 'craters', len(craters))

# ---------------------------------------------------------------- texturas
MARS = {  # cor média alvo (sRGB) e quanto da cor original preservar
    'Ground079S': ((0.56, 0.36, 0.24), 0.25, 'regolith'),
    'Ground096B': ((0.66, 0.44, 0.29), 0.15, 'sand'),
    'Rocks011':   ((0.40, 0.31, 0.26), 0.35, 'rock'),
}
for sid, (tint, keep, name) in MARS.items():
    base = os.path.join(SRC, 'tex', sid, f'{sid}_2K-JPG_')
    col = np.asarray(Image.open(base + 'Color.jpg').convert('RGB')).astype(np.float64) / 255
    lum = col @ np.array([0.299, 0.587, 0.114])
    rel = lum / lum.mean()
    chroma = col - lum[..., None]
    out = np.clip(np.array(tint)[None, None] * rel[..., None] + chroma * keep, 0, 1)
    ao = np.asarray(Image.open(base + 'AmbientOcclusion.jpg').convert('L'))
    rough = np.asarray(Image.open(base + 'Roughness.jpg').convert('L'))
    disp = np.asarray(Image.open(base + 'Displacement.jpg').convert('L'))
    nrm = Image.open(base + 'NormalGL.jpg').convert('RGB')
    orm = Image.fromarray(np.stack([ao, rough, disp], -1))
    alb = Image.fromarray((out * 255 + 0.5).astype(np.uint8))
    for res in (2048, 1024):
        sfx = '' if res == 2048 else '_1k'
        alb.resize((res, res), Image.LANCZOS).save(os.path.join(OUT, f'assets/textures/{name}_albedo{sfx}.jpg'), quality=88)
        nrm.resize((res, res), Image.LANCZOS).save(os.path.join(OUT, f'assets/textures/{name}_normal{sfx}.jpg'), quality=92)
        orm.resize((res, res), Image.LANCZOS).save(os.path.join(OUT, f'assets/textures/{name}_orm{sfx}.jpg'), quality=90)
print('texturas ok')
