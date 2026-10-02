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
C = 192; EX, EY, ED = 0.5, 0.42, 0.27; COLS = 12
def alinha(im, m):
    oe, od = m['oe'], m['od']
    if oe[0] > od[0]: oe, od = od, oe
    cx, cy = (oe + od) / 2
    ang = math.atan2(od[1] - oe[1], od[0] - oe[0])
    esc = (ED * C) / math.hypot(*(od - oe))
    ca, sa = math.cos(ang) / esc, math.sin(ang) / esc
    a, b, d, e = ca, -sa, sa, ca
    c = cx - a * EX * C - b * EY * C; f = cy - d * EX * C - e * EY * C
    out = im.transform((C, C), Image.AFFINE, (a, b, c, d, e, f), resample=Image.BICUBIC)
    arr = np.asarray(out).astype(float)
    # fora do contorno do rosto vira pele (o fundo da foto não vaza para as laterais da cabeça)
    det = a * e - b * d
    inv = lambda x, y: ((e * (x - c) - b * (y - f)) / det, (-d * (x - c) + a * (y - f)) / det)
    ov = [inv(x, y) for x, y in m['oval']]
    cx0, cy0 = np.mean(ov, axis=0)
    ov = [(cx0 + (x - cx0) * 1.03, cy0 + (y - cy0) * 1.03) for x, y in ov]
    from PIL import ImageDraw, ImageFilter
    mk = Image.new('L', (C, C), 0); ImageDraw.Draw(mk).polygon(ov, fill=255); mk = mk.filter(ImageFilter.GaussianBlur(C * 0.02))
    y0, y1 = int(C * 0.55), int(C * 0.63)
    pele = np.concatenate([arr[y0:y1, int(C * .28):int(C * .36)].reshape(-1, 3), arr[y0:y1, int(C * .64):int(C * .72)].reshape(-1, 3)])
    pele = np.median(pele, axis=0)
    fundo = Image.new('RGB', (C, C), tuple(int(x) for x in pele))
    out = Image.composite(out, fundo, mk)
    return out, [int(x) for x in pele]
banco = []   # (img, pele, origem)
for f in sorted(glob.glob(os.path.join(AQUI, 'brutos', 'g*.png'))):
    im = Image.open(f).convert('RGB'); W, H = im.size
    for m in sorted(marcos(im), key=lambda m: (int((m['oe'][1] > H / 2)), m['oe'][0])):
        o, p = alinha(im, m); banco.append((o, p, 'ia:' + os.path.basename(f)))
im = Image.open(os.path.join(AQUI, '..', 'rosto', 'ia1sq.jpg')).convert('RGB')
o, p = alinha(im, marcos(im)[0]); banco.append((o, p, 'ia:ia1'))
fr = json.load(open(SFHQ + 'frontais.json'))
for i in json.load(open(os.path.join(AQUI, 'escolhidos.json')))['sfhq']:
    im = Image.open(SFHQ + fr[i]).convert('RGB'); ms = marcos(im)
    if not ms: print('sem rosto', i); continue
    o, p = alinha(im, ms[0]); banco.append((o, p, 'sfhq:' + os.path.basename(fr[i])))
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
json.dump({'cell': C, 'cols': COLS, 'rows': rows, 'n': N, 'eye': [EX, EY, ED], 'pele': [p for _, p, _ in banco],
           'origem': [s for _, _, s in banco], 'times': times}, open(os.path.join(SAIDA, 'rostos.json'), 'w'))
print('rostos no banco:', N, '| atlas', atl.size, '| bytes', os.path.getsize(os.path.join(SAIDA, 'rostos.jpg')))
