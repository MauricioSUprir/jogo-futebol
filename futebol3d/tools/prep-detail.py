#!/usr/bin/env python3
# Gera assets/textures/grass_detail.jpg: camada fina de detalhe do gramado.
# Fonte: ambientCG Grass001 (CC0 1.0). Canais: R = luminância passa-alta (0,5 = neutro),
# G/B = normal (x, y) em espaço tangente (OpenGL). Uma textura só para cor + relevo.
# Uso: python3 tools/prep-detail.py   (a partir de futebol3d/; precisa de Pillow e numpy)
import io, os, sys, urllib.request, zipfile
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'textures', 'grass_detail.jpg')
ASSET = 'Grass001'
S = 512

def main():
    url = f'https://ambientcg.com/get?file={ASSET}_1K-JPG.zip'
    print('baixando', url)
    req = urllib.request.Request(url, headers={'User-Agent': 'curl/8.0'})
    z = zipfile.ZipFile(io.BytesIO(urllib.request.urlopen(req).read()))
    def load(suffix):
        name = next(n for n in z.namelist() if n.endswith(suffix))
        return Image.open(io.BytesIO(z.read(name))).convert('RGB').resize((S, S), Image.LANCZOS)
    c = np.asarray(load('_Color.jpg')).astype(np.float32) / 255
    lum = c @ np.array([0.3, 0.59, 0.11], np.float32)
    # passa-alta com desfoque gaussiano circular (FFT) para continuar repetível
    fy = np.fft.fftfreq(S)[:, None]; fx = np.fft.fftfreq(S)[None, :]
    G = np.exp(-2 * (np.pi ** 2) * (12.0 ** 2) * (fx ** 2 + fy ** 2))
    blur = np.real(np.fft.ifft2(np.fft.fft2(lum) * G))
    r = np.clip(0.5 + (lum / np.maximum(blur, 1e-3) - 1) * 0.5, 0, 1)
    n = np.asarray(load('_NormalGL.jpg')).astype(np.float32) / 255
    out = np.stack([r, n[..., 0], n[..., 1]], -1)
    Image.fromarray((out * 255 + 0.5).astype(np.uint8)).save(OUT, quality=88, optimize=True)
    print(OUT, os.path.getsize(OUT) // 1024, 'KB')

if __name__ == '__main__':
    sys.exit(main())
