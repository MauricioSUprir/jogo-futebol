# Monta folha de contato (PNG) e GIF animado a partir de uma pasta de quadros.
# Uso: python3 tools/sheet.py <pasta> <saida_prefixo> [colunas] [ms_por_quadro]
import sys, glob
from PIL import Image
d, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4
ms = int(sys.argv[4]) if len(sys.argv) > 4 else 100
fs = sorted(glob.glob(d + '/f*.png'))
ims = [Image.open(f).convert('RGB') for f in fs]
w, h = 480, int(480 * ims[0].height / ims[0].width)
th = [i.resize((w, h)) for i in ims]
rows = (len(th) + cols - 1) // cols
sheet = Image.new('RGB', (w * cols, h * rows))
for k, t in enumerate(th): sheet.paste(t, ((k % cols) * w, (k // cols) * h))
sheet.save(out + '-sheet.png')
g = [i.resize((640, int(640 * i.height / i.width))) for i in ims]
g[0].save(out + '.gif', save_all=True, append_images=g[1:], duration=ms, loop=0)
print('ok', out + '-sheet.png', out + '.gif')
