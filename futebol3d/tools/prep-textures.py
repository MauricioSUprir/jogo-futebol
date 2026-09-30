#!/usr/bin/env python3
# Baixa e prepara as texturas CC0 do gramado (ambientCG) para o GOLAÇO.
# Uso: python3 tools/prep-textures.py   (a partir de futebol3d/; precisa de Pillow)
import io, os, sys, urllib.request, zipfile
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'textures')
ASSET = 'Grass005'  # ambientCG, CC0 1.0

def main():
    os.makedirs(OUT, exist_ok=True)
    url = f'https://ambientcg.com/get?file={ASSET}_1K-JPG.zip'
    print('baixando', url)
    req = urllib.request.Request(url, headers={'User-Agent': 'curl/8.0'})
    data = urllib.request.urlopen(req).read()
    z = zipfile.ZipFile(io.BytesIO(data))
    def load(suffix):
        name = next(n for n in z.namelist() if n.endswith(suffix))
        return Image.open(io.BytesIO(z.read(name)))
    col = load('_Color.jpg').convert('RGB').resize((1024, 1024), Image.LANCZOS)
    col.save(os.path.join(OUT, 'grass_color.jpg'), quality=86, optimize=True)
    nor = load('_NormalGL.jpg').convert('RGB').resize((512, 512), Image.LANCZOS)
    nor.save(os.path.join(OUT, 'grass_normal.jpg'), quality=88, optimize=True)
    for f in sorted(os.listdir(OUT)):
        print(f, os.path.getsize(os.path.join(OUT, f)) // 1024, 'KB')

if __name__ == '__main__':
    sys.exit(main())
