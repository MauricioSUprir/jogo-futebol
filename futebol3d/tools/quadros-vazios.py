# Analisa uma pasta de quadros (jpg/png): quadro "vazio" = canvas apagado, a tela mostra a cor
# de fundo da página (#070b16; também #04070e ou preto) por trás do HUD. Critério: mais de 35%
# dos pixels da tela com essa cor (±12 por canal, folga do JPEG). Um quadro normal do jogo
# (gramado, arquibancada, céu de noite) fica perto de 0%.
# Sai com código 1 se encontrar algum. python3 tools/quadros-vazios.py pasta
import sys, glob, os
from PIL import Image
FUNDOS = [(0x07, 0x0b, 0x16), (0x04, 0x07, 0x0e), (0, 0, 0)]
fs = sorted(glob.glob(os.path.join(sys.argv[1], 'f*.*')))
vazios, pior = [], 0.0
for f in fs:
    im = Image.open(f).convert('RGB')
    im.thumbnail((320, 320))
    px = list(getattr(im, 'get_flattened_data', im.getdata)())
    n = sum(1 for (r, g, b) in px if any(abs(r - a) <= 12 and abs(g - c) <= 12 and abs(b - d) <= 12 for (a, c, d) in FUNDOS))
    frac = n / len(px)
    pior = max(pior, frac)
    if frac > 0.35: vazios.append((os.path.basename(f), round(frac * 100)))
print(f'quadros analisados: {len(fs)} | vazios: {len(vazios)} | maior fração com a cor do fundo: {pior * 100:.0f}%',
      ('→ ' + ', '.join(f'{v[0]} ({v[1]}%)' for v in vazios)) if vazios else '')
sys.exit(1 if vazios else 0)
