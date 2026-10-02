# Marcos do rosto (MediaPipe, 478 pontos) da cabeça 3D do jogador no espaço da foto (aFace):
# rasteriza a cabeça escaneada de frente (projeção ortográfica = coordenada aFace) com a
# textura do próprio escaneamento e roda o Face Landmarker. processar.py usa esses pontos
# para deformar cada foto até olhos, nariz, boca e mandíbula caírem sobre o relevo da cabeça.
# Saída: tools/rostos/cabeca-marcos.json (u, v por ponto, 0..1 da célula)
import json, os, numpy as np
from PIL import Image
AQUI = os.path.dirname(os.path.abspath(__file__))
J = os.path.join(AQUI, '..', '..', 'assets', 'jogador')
meta = json.load(open(os.path.join(J, 'mh.json')))['body']; buf = open(os.path.join(J, 'mh.bin'), 'rb').read()
nv, ni = meta['nv'], meta['ni']
arr = lambda k, dt, n: np.frombuffer(buf, dt, n, meta[k])
P = arr('pos', np.float32, nv * 3).reshape(-1, 3); UV = arr('uv', np.float32, nv * 2).reshape(-1, 2)
FU = arr('face', np.float32, nv * 2).reshape(-1, 2); MAT = arr('mat', np.uint8, nv); I = arr('index', np.uint32, ni).reshape(-1, 3)
F = I[np.all(MAT[I] == 16, axis=1)]
tex = np.asarray(Image.open(os.path.join(AQUI, '..', 'rosto', 'Map-COL.jpg')).convert('RGB')).astype(np.float32)
TH, TW = tex.shape[:2]
S = 768
img = np.zeros((S, S, 3), np.float32) + 60; zb = np.full((S, S), -1e9)
for f in F:
    q = FU[f] * S; z = P[f, 2]; t = UV[f]
    x0, y0 = np.floor(q.min(0)).astype(int); x1, y1 = np.ceil(q.max(0)).astype(int)
    x0, y0 = max(x0, 0), max(y0, 0); x1, y1 = min(x1, S - 1), min(y1, S - 1)
    if x1 < x0 or y1 < y0: continue
    (ax, ay), (bx, by), (cx, cy) = q
    den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
    if abs(den) < 1e-9: continue
    xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
    w0 = ((by - cy) * (xs - cx) + (cx - bx) * (ys - cy)) / den
    w1 = ((cy - ay) * (xs - cx) + (ax - cx) * (ys - cy)) / den
    w2 = 1 - w0 - w1
    ins = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
    if not ins.any(): continue
    zz = w0 * z[0] + w1 * z[1] + w2 * z[2]
    tu = w0 * t[0, 0] + w1 * t[1, 0] + w2 * t[2, 0]; tv = w0 * t[0, 1] + w1 * t[1, 1] + w2 * t[2, 1]
    yy, xx = ys[ins].astype(int), xs[ins].astype(int)
    m = zz[ins] > zb[yy, xx]
    yy, xx = yy[m], xx[m]
    zb[yy, xx] = zz[ins][m]
    # UV do glTF: v para baixo (flipY falso)
    px = np.clip((tu[ins][m] % 1) * TW, 0, TW - 1).astype(int); py = np.clip((tv[ins][m] % 1) * TH, 0, TH - 1).astype(int)
    img[yy, xx] = tex[py, px]
out = Image.fromarray(img.clip(0, 255).astype(np.uint8))
dbg = '/tmp/claude-0/-home-user-jogo-futebol/9805b587-e422-5403-9106-8bf9d9184706/scratchpad/rosto/cabeca-frente.png'
out.save(dbg)
import mediapipe as mp
from alinhar import det
r = det().detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.asarray(out)))
assert r.face_landmarks, 'rosto não encontrado na cabeça'
lm = r.face_landmarks[0]
pts = [[round(p.x, 5), round(p.y, 5)] for p in lm]
json.dump({'fonte': 'MediaPipe Face Landmarker na cabeça escaneada (frente, espaço aFace)', 'p': pts}, open(os.path.join(AQUI, 'cabeca-marcos.json'), 'w'))
print('marcos:', len(pts), '| olhos', np.mean([pts[i] for i in (33, 133)], 0), np.mean([pts[i] for i in (362, 263)], 0), '| boca', np.mean([pts[i] for i in (61, 291)], 0), '| queixo', pts[152])
from PIL import ImageDraw
d = ImageDraw.Draw(out)
for x, y in pts: d.ellipse([x * S - 1.5, y * S - 1.5, x * S + 1.5, y * S + 1.5], fill=(0, 255, 0))
out.save(dbg.replace('.png', '-marcos.png'))
