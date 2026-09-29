#!/usr/bin/env python3
"""Gera os assets do simulador a partir de dados reais do Rio de Janeiro.

Relevo:  Copernicus GLO-30 DEM (ESA, 30 m) — tiles S23/S24 × W044/W043 (AWS Open Data)
Imagem:  Sentinel-2 cloudless 2020 da EOX (s2maps.eu), CC BY-NC-SA 4.0
Pistas:  OurAirports (domínio público)

Uso: python3 build_assets.py <pasta_downloads> <pasta_aviao>
"""
import io, json, math, os, sys, time, urllib.request
import numpy as np, tifffile
from PIL import Image
from scipy import ndimage

SRC, OUT = sys.argv[1], sys.argv[2]
LAT0, LON0 = -22.905, -43.200           # centro do mapa (entre Santos Dumont, Galeão e Corcovado)
R_EARTH = 6371000.0
NEAR_SIZE, NEAR_N = 32000.0, 1024       # 32 km, células de 31,25 m
FAR_SIZE, FAR_N = 128000.0, 512         # 128 km, células de 250 m
IMG_NEAR, IMG_FAR = 4096, 2048
rng = np.random.default_rng(2226)
M_LAT = math.pi / 180 * R_EARTH
M_LON = M_LAT * math.cos(math.radians(LAT0))

def to_latlon(x, z):   # mundo: +x leste, +z sul (metros a partir do centro)
    return LAT0 - z / M_LAT, LON0 + x / M_LON

# ---------------------------------------------------------------- DEM (mosaico 2x2)
dem = np.zeros((7200, 7200), np.float32)
for (r, c, name) in [(0, 0, 'S23_00_W044'), (0, 1, 'S23_00_W043'), (1, 0, 'S24_00_W044'), (1, 1, 'S24_00_W043')]:
    p = os.path.join(SRC, name + '.tif')
    if os.path.exists(p): dem[r*3600:(r+1)*3600, c*3600:(c+1)*3600] = tifffile.imread(p)
def sample_dem(lat, lon):
    row = (-22.0 - lat) * 3600 - 0.5; col = (lon + 44.0) * 3600 - 0.5
    return ndimage.map_coordinates(dem, [row, col], order=1, mode='nearest')

def grid(size, n):
    c = (np.arange(n + 1) - n / 2) * (size / n)
    x, z = np.meshgrid(c, c)
    return x, z

# ---------------------------------------------------------------- pistas (OurAirports)
import csv
runways = []
for row in csv.DictReader(open(os.path.join(SRC, 'runways.csv'), encoding='utf-8')):
    if row['airport_ident'] in ('SBRJ', 'SBGL') and row['closed'] == '0':
        la1, lo1, la2, lo2 = (float(row[k]) for k in ('le_latitude_deg', 'le_longitude_deg', 'he_latitude_deg', 'he_longitude_deg'))
        x1, z1 = (lo1 - LON0) * M_LON, -(la1 - LAT0) * M_LAT
        x2, z2 = (lo2 - LON0) * M_LON, -(la2 - LAT0) * M_LAT
        runways.append(dict(airport=row['airport_ident'], le=row['le_ident'], he=row['he_ident'],
                            x1=x1, z1=z1, x2=x2, z2=z2, width=float(row['width_ft']) * 0.3048,
                            length=math.hypot(x2 - x1, z2 - z1), elev=float(row['le_elevation_ft'] or 10) * 0.3048,
                            surface=row['surface']))
print('pistas', [(r['airport'], r['le'], round(r['length'])) for r in runways])

def flatten(h, x, z, pad=70.0):
    """Aplaina o relevo sob as pistas (o DEM tem ruído e prédios)."""
    for r in runways:
        dx, dz = r['x2'] - r['x1'], r['z2'] - r['z1']; L = r['length']; ux, uz = dx / L, dz / L
        px, pz = x - r['x1'], z - r['z1']
        along = px * ux + pz * uz; across = np.abs(-px * uz + pz * ux)
        inside_a = np.clip(np.maximum(-along - 60, along - L - 60), 0, None)
        dist = np.maximum(inside_a, across - (r['width'] / 2 + pad))
        w = np.clip(1 - dist / 250.0, 0, 1) ** 2
        w[dist <= 0] = 1
        h[:] = h * (1 - w) + r['elev'] * w
    return h

xn, zn = grid(NEAR_SIZE, NEAR_N)
la, lo = to_latlon(xn, zn)
hn = sample_dem(la, lo).astype(np.float64)
hn = flatten(hn, xn, zn)
xf, zf = grid(FAR_SIZE, FAR_N)
la2, lo2 = to_latlon(xf, zf)
hf = sample_dem(la2, lo2).astype(np.float64)
hf = flatten(hf, xf, zf)

def save16(h, path):
    lo_, hi_ = float(h.min()), float(h.max()); sc = (hi_ - lo_) / 65535.0
    q = np.round((h - lo_) / sc).astype(np.uint32)
    rgb = np.zeros(h.shape + (3,), np.uint8); rgb[..., 0] = q >> 8; rgb[..., 1] = q & 255
    Image.fromarray(rgb).save(path, optimize=True)
    return lo_, sc
nmin, nsc = save16(hn, os.path.join(OUT, 'assets/terrain/height.png'))
fmin, fsc = save16(hf, os.path.join(OUT, 'assets/terrain/far.png'))

# ---------------------------------------------------------------- imagem de satélite (web mercator -> local)
TILE_URL = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg'
cache = os.path.join(SRC, 'tiles'); os.makedirs(cache, exist_ok=True)
def tile(z, x, y):
    p = os.path.join(cache, f'{z}_{x}_{y}.jpg')
    if not os.path.exists(p):
        for k in range(4):
            try:
                req = urllib.request.Request(TILE_URL.format(z=z, x=x, y=y), headers={'User-Agent': 'jezero-flight-build/1.0'})
                data = urllib.request.urlopen(req, timeout=30).read(); open(p, 'wb').write(data); break
            except Exception as e:
                time.sleep(1 + k); err = e
        else: raise err
    return np.asarray(Image.open(p).convert('RGB'))

def merc(lat, lon, z):
    n = 2 ** z
    x = (lon + 180) / 360 * n
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    return x, y

def render_image(size_m, npx, z):
    c = (np.arange(npx) + 0.5 - npx / 2) * (size_m / npx)
    X, Z = np.meshgrid(c, c)
    lat, lon = to_latlon(X, Z)
    n = 2 ** z
    mx = (lon + 180) / 360 * n
    my = (1 - np.log(np.tan(np.radians(lat)) + 1 / np.cos(np.radians(lat))) / np.pi) / 2 * n
    tx0, tx1 = int(mx.min()), int(mx.max()); ty0, ty1 = int(my.min()), int(my.max())
    mos = np.zeros(((ty1 - ty0 + 1) * 256, (tx1 - tx0 + 1) * 256, 3), np.uint8)
    for ty in range(ty0, ty1 + 1):
        for tx in range(tx0, tx1 + 1):
            mos[(ty - ty0) * 256:(ty - ty0 + 1) * 256, (tx - tx0) * 256:(tx - tx0 + 1) * 256] = tile(z, tx, ty)
    px = (mx - tx0) * 256 - 0.5; py = (my - ty0) * 256 - 0.5
    out = np.stack([ndimage.map_coordinates(mos[..., k].astype(np.float32), [py, px], order=1, mode='nearest') for k in range(3)], -1)
    return np.clip(out, 0, 255).astype(np.uint8)

t0 = time.time()
img_near = render_image(NEAR_SIZE, IMG_NEAR, 14)
img_far = render_image(FAR_SIZE, IMG_FAR, 11)
print('imagens ok', round(time.time() - t0), 's')

# ---------------------------------------------------------------- água (DEM + cor)
def water_mask(h_img, img):
    f = img.astype(np.float32) / 255
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    darkblue = (lum < 0.22) & (b >= r * 0.95)
    m = (h_img <= 0.6) | (darkblue & (h_img < 3))
    m = ndimage.binary_opening(m, iterations=1)
    m = ndimage.binary_closing(m, iterations=2)
    return ndimage.gaussian_filter(m.astype(np.float32), 1.0)

hn_img = np.asarray(Image.fromarray(hn.astype(np.float32)).resize((IMG_NEAR // 2, IMG_NEAR // 2), Image.BILINEAR))
img_half = np.asarray(Image.fromarray(img_near).resize((IMG_NEAR // 2, IMG_NEAR // 2), Image.BILINEAR))
wm = water_mask(hn_img, img_half)
hf_img = np.asarray(Image.fromarray(hf.astype(np.float32)).resize((IMG_FAR, IMG_FAR), Image.BILINEAR))
wf = water_mask(hf_img, img_far)

# máscara de urbanização (cinza/rosado, pouco verde, plano, não é água)
f = img_half.astype(np.float32) / 255
r, g, b = f[..., 0], f[..., 1], f[..., 2]
lum = 0.3 * r + 0.59 * g + 0.11 * b
green = g - (r + b) / 2
gy, gx = np.gradient(hn_img, NEAR_SIZE / (IMG_NEAR // 2))
slope = np.hypot(gx, gy)
urban = np.clip((lum - 0.16) / 0.1, 0, 1) * np.clip((0.09 - green) / 0.05, 0, 1) * (wm < 0.3) * np.clip((0.3 - slope) / 0.15, 0, 1) * (hn_img < 250)
urban = ndimage.gaussian_filter(urban, 1.0)

# textura de máscara: R = água, G = urbano (para o shader)
mask = np.stack([wm, urban, np.zeros_like(wm)], -1)
Image.fromarray((mask * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, 'assets/terrain/mask.png'), optimize=True)
Image.fromarray((np.stack([wf, wf, wf], -1) * 255).astype(np.uint8)).convert('L').save(os.path.join(OUT, 'assets/terrain/far_water.png'), optimize=True)

# ajuste de cor leve: o mosaico Sentinel é um pouco lavado
def grade(img):
    x = img.astype(np.float32) / 255
    x = np.clip((x - 0.02) * 1.1, 0, 1) ** 1.05
    return (x * 255 + 0.5).astype(np.uint8)
Image.fromarray(grade(img_near)).save(os.path.join(OUT, 'assets/textures/sat_near.jpg'), quality=90)
Image.fromarray(grade(img_near)).resize((2048, 2048), Image.LANCZOS).save(os.path.join(OUT, 'assets/textures/sat_near_2k.jpg'), quality=90)
Image.fromarray(grade(img_far)).save(os.path.join(OUT, 'assets/textures/sat_far.jpg'), quality=88)

# ---------------------------------------------------------------- prédios procedurais sobre a mancha urbana
cell = 55.0
ncell = int(NEAR_SIZE // cell)
scale_px = (IMG_NEAR // 2) / NEAR_SIZE
water_dist = ndimage.distance_transform_edt(wm < 0.5) / scale_px     # metros até a água
recs = []
def runway_clear(x, z):
    for rw in runways:
        dx, dz = rw['x2'] - rw['x1'], rw['z2'] - rw['z1']; L = rw['length']; ux, uz = dx / L, dz / L
        px, pz = x - rw['x1'], z - rw['z1']
        a = px * ux + pz * uz; c = abs(-px * uz + pz * ux)
        if -900 < a < L + 900 and c < 260: return False
    return True
# centros de prédios altos conhecidos (Centro, Copacabana/Leme, Botafogo, Barra fica fora)
hubs = [(-22.905, -43.178, 1.0, 1400), (-22.970, -43.185, 0.8, 1300), (-22.950, -43.183, 0.6, 1000), (-22.983, -43.205, 0.6, 900), (-22.895, -43.120, 0.5, 900)]
hubs_xz = [((lo_ - LON0) * M_LON, -(la_ - LAT0) * M_LAT, k, rad) for la_, lo_, k, rad in hubs]
for j in range(ncell):
    for i in range(ncell):
        x = -NEAR_SIZE / 2 + (i + rng.random()) * cell; z = -NEAR_SIZE / 2 + (j + rng.random()) * cell
        pi_, pj = int((x + NEAR_SIZE / 2) * scale_px), int((z + NEAR_SIZE / 2) * scale_px)
        if not (0 <= pi_ < urban.shape[1] and 0 <= pj < urban.shape[0]): continue
        u = urban[pj, pi_]
        if u < 0.35 or rng.random() > u: continue
        if not runway_clear(x, z): continue
        hub = 0.0
        for hx, hz, k, rad in hubs_xz:
            hub = max(hub, k * math.exp(-((x - hx) ** 2 + (z - hz) ** 2) / (rad * rad)))
        coast = math.exp(-water_dist[pj, pi_] / 450.0) * 0.5
        tall = min(1.0, hub + coast * u)
        floors = 1 + rng.integers(1, 4) if rng.random() > tall else 4 + int(rng.gamma(2.0, 4.0 + 10 * tall))
        floors = min(floors, 45)
        h = floors * 3.0 + rng.random() * 1.5
        w = 10 + rng.random() * (16 + 14 * tall); d = 10 + rng.random() * (16 + 12 * tall)
        rot = rng.random() * math.pi
        # alinha com a quadra vizinha de vez em quando
        if rng.random() < 0.6: rot = (round(rot / (math.pi / 2)) * (math.pi / 2)) % math.pi
        base = hn_img[pj, pi_]
        col = img_half[pj, pi_]
        recs.append((x, z, w, d, h, rot, base, *col))
recs = np.array(recs, np.float32)
print('prédios', len(recs), 'altos(>40m)', int((recs[:, 4] > 40).sum()))
# formato compacto: int16 x,z (m), uint8 w,d (0,25 m), uint16 h (0,1 m), uint8 rot, uint8 rgb
nb = len(recs)
buf = io.BytesIO()
buf.write(np.array([nb], np.uint32).tobytes())
buf.write(np.round(recs[:, 0]).astype(np.int16).tobytes()); buf.write(np.round(recs[:, 1]).astype(np.int16).tobytes())
buf.write(np.clip(np.round(recs[:, 2] * 4), 0, 255).astype(np.uint8).tobytes()); buf.write(np.clip(np.round(recs[:, 3] * 4), 0, 255).astype(np.uint8).tobytes())
buf.write(np.clip(np.round(recs[:, 4] * 10), 0, 65535).astype(np.uint16).tobytes())
buf.write(np.round(recs[:, 5] / math.pi * 255).astype(np.uint8).tobytes())
buf.write(np.clip(recs[:, 7:10], 0, 255).astype(np.uint8).tobytes())
open(os.path.join(OUT, 'assets/terrain/buildings.bin'), 'wb').write(buf.getvalue())

landmarks = dict(
    cristo=dict(lat=-22.95192, lon=-43.21048),
    paodeacucar=dict(lat=-22.94866, lon=-43.15653),
    maracana=dict(lat=-22.91218, lon=-43.23016),
    ponte=dict(lat1=-22.8778, lon1=-43.2150, lat2=-22.8744, lon2=-43.1122),
)
for k, v in landmarks.items():
    if 'lat' in v: v['x'] = (v['lon'] - LON0) * M_LON; v['z'] = -(v['lat'] - LAT0) * M_LAT
meta = dict(lat0=LAT0, lon0=LON0, nearSize=NEAR_SIZE, nearN=NEAR_N, nearMin=nmin, nearScale=nsc,
            farSize=FAR_SIZE, farN=FAR_N, farMin=fmin, farScale=fsc, runways=runways, landmarks=landmarks,
            buildings=int(nb),
            credits='Copernicus GLO-30 DEM (ESA) · Sentinel-2 cloudless 2020 by EOX IT Services GmbH (CC BY-NC-SA 4.0) · OurAirports')
json.dump(meta, open(os.path.join(OUT, 'assets/terrain/meta.json'), 'w'), indent=1)
print('ok', nmin, nmin + nsc * 65535)
