import sys, os, json, glob, math
sys.path.insert(0, '/home/user/jogo-futebol/futebol3d/tools/rostos')
import numpy as np
from PIL import Image, ImageDraw
import mediapipe as mp
from alinhar import det
D = '/tmp/claude-0/-home-user-jogo-futebol/9805b587-e422-5403-9106-8bf9d9184706/scratchpad/sfhq/'
fs = sorted(glob.glob(D + 's4/*.jpg') + glob.glob(D + 't2i/*.jpg') + glob.glob(D + 'ss/*.jpg'))
ok = []
for f in fs:
    im = Image.open(f).convert('RGB'); W, H = im.size
    r = det().detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.asarray(im)))
    if len(r.face_landmarks) != 1: continue
    lm = r.face_landmarks[0]
    P = lambda i: np.array([lm[i].x * W, lm[i].y * H])
    oe = (P(33) + P(133)) / 2; od = (P(362) + P(263)) / 2; nariz = P(1)
    ed = np.linalg.norm(od - oe); mid = (oe + od) / 2
    yaw = (nariz[0] - mid[0]) / ed
    roll = math.degrees(math.atan2(od[1] - oe[1], od[0] - oe[0]))
    # olhos abertos
    ab = (np.linalg.norm(P(159) - P(145)) + np.linalg.norm(P(386) - P(374))) / 2 / ed
    # boca fechada
    boca = np.linalg.norm(P(13) - P(14)) / ed
    if abs(yaw) < 0.06 and abs(roll) < 8 and ab > 0.12 and boca < 0.06 and ed > W * 0.18:
        ok.append(os.path.relpath(f, D))
print(len(ok))
json.dump(ok, open(D + 'frontais.json', 'w'))
# folhas de contato com índice
for s in range(0, len(ok), 48):
    sh = Image.new('RGB', (8 * 160, 6 * 175), (20, 20, 20)); d = ImageDraw.Draw(sh)
    for k, n in enumerate(ok[s:s + 48]):
        im = Image.open(D + n).convert('RGB').resize((160, 160))
        sh.paste(im, ((k % 8) * 160, (k // 8) * 175)); d.text(((k % 8) * 160 + 4, (k // 8) * 175 + 160), str(s + k), fill=(30, 227, 122))
    sh.save(D + f'folha-{s // 48}.png')
