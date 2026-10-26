# Grava o corpo humano para o jogo: assets/jogador/corpo.json (o índice) + corpo.bin (os dados), lidos por
# js/render/corpo-dados.js (no navegador e em Node, nos testes). Por LOD e por parte (corpo, cabeça):
#   pos  int16 ×3, normalizado na caixa da parte (min/max no índice)   nor  int8 ×3 (×127)
#   uv   uint16 ×2 (×65535; a UV do Rocketbox fica em [0, 1])          ossos uint8 ×4 (os 25 de esqueleto.js)
#   pesos uint8 ×4 (soma 255)                                          idx  uint16 ×3 por triângulo
# Cada bloco começa alinhado em 4 bytes. O índice leva também o repouso (as juntas do jogo de pé e as duas constantes do
# ombro do desenho) e o sha256 do .bin (o manifesto.json confere os dois).
# Uso: python -I exportar_bin.py <lods.npz> <repouso.json> <pasta assets/jogador>
import sys, json, hashlib, os, numpy as np
ent, rep, pasta = sys.argv[1:4]
d = np.load(ent); R = json.load(open(rep))
os.makedirs(pasta, exist_ok=True)
NOMES = ['pelve', 'lombar', 'peito', 'pescoco', 'cabeca', 'claviculaE', 'bracoE', 'antebracoE', 'maoE',
         'claviculaD', 'bracoD', 'antebracoD', 'maoD', 'coxaE', 'canelaE', 'peE', 'coxaD', 'canelaD', 'peD',
         'ajJoelhoE', 'ajJoelhoD', 'ajCotoveloE', 'ajCotoveloD', 'ajQuadrilE', 'ajQuadrilD']
blocos, off = [], 0
def bloco(arr):
    global off
    b = np.ascontiguousarray(arr).tobytes()
    pad = (-len(b)) % 4
    blocos.append(b + b'\0' * pad)
    o = off; off += len(b) + pad
    return {'off': o, 'bytes': len(b)}
def soldar_normais(p, n, ang=60):
    """Os vértices no MESMO lugar (a costura da UV duplica o vértice) com normais a menos de `ang` graus ficam com a média:
    sem isso a luz dava um degrau na costura (a linha no alto da cabeça e no meio da testa). Superfícies diferentes que se
    encostam (os lábios, a pálpebra) ficam com a sua."""
    chave = np.round(p / 2e-4).astype(np.int64)
    _, grupo = np.unique(chave, axis=0, return_inverse=True)
    grupo = grupo.ravel(); out = n.copy(); c = np.cos(np.radians(ang))
    ordem = np.argsort(grupo, kind='stable'); g = grupo[ordem]
    cortes = np.flatnonzero(np.diff(g)) + 1
    for membros in np.split(ordem, cortes):
        if len(membros) < 2: continue
        resto = list(membros)
        while resto:
            base = resto[0]; junto = [v for v in resto if n[v] @ n[base] >= c]
            m = n[junto].sum(0); m /= np.linalg.norm(m) + 1e-12
            out[junto] = m; resto = [v for v in resto if v not in junto]
    return out
lods = []
nivel = 0
while f'corpo_lod{nivel}_pos' in d.files:
    partes = {}
    # as normais soldadas nas duas partes juntas (o pescoço: a borda da cabeça encosta na do corpo)
    _n = {pt: d[f'{pt}_lod{nivel}_nor'].astype(np.float64) for pt in ('corpo', 'cabeca')}
    for pt in _n: _n[pt] /= np.linalg.norm(_n[pt], axis=1, keepdims=True) + 1e-12
    _nc = len(_n['corpo'])
    _sold = soldar_normais(np.vstack([d[f'corpo_lod{nivel}_pos'], d[f'cabeca_lod{nivel}_pos']]).astype(np.float64), np.vstack([_n['corpo'], _n['cabeca']]))
    soldadas = {'corpo': _sold[:_nc], 'cabeca': _sold[_nc:]}
    for parte in ('corpo', 'cabeca'):
        k = f'{parte}_lod{nivel}_'
        p = d[k + 'pos'].astype(np.float64); mn, mx = p.min(0), p.max(0)
        q = np.round((p - mn) / np.maximum(mx - mn, 1e-9) * 65534 - 32767).astype(np.int16)
        n = soldadas[parte]
        tri = d[k + 'tri']
        assert tri.max() < 65536
        partes[parte] = {
            'nv': int(len(p)), 'ntri': int(len(tri)),
            'min': [round(float(x), 6) for x in mn], 'max': [round(float(x), 6) for x in mx],
            'pos': bloco(q), 'nor': bloco(np.round(n * 127).astype(np.int8)),
            'uv': bloco(np.round(np.clip(d[k + 'uv'], 0, 1) * 65535).astype(np.uint16)),
            'ossos': bloco(d[k + 'ossos'].astype(np.uint8)), 'pesos': bloco(d[k + 'pesos'].astype(np.uint8)),
            'idx': bloco(tri.astype(np.uint16)),
        }
    lods.append({'nivel': nivel, 'triangulos': sum(x['ntri'] for x in partes.values()), 'partes': partes})
    nivel += 1
binario = b''.join(blocos)
sha = hashlib.sha256(binario).hexdigest()
open(os.path.join(pasta, 'corpo.bin'), 'wb').write(binario)
indice = {
    'versao': 1,
    'fonte': 'Microsoft Rocketbox Sports_Male_02 (MIT), encaixado nas medidas do jogo — golaco/tools/humano',
    'ossos': NOMES, 'repouso': {k: R[k] for k in ('queda', 'abre', 'sobeTornozelo', 'braco', 'antebraco', 'juntas')},
    'bin': {'bytes': len(binario), 'sha256': sha}, 'lods': lods,
}
json.dump(indice, open(os.path.join(pasta, 'corpo.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
for l in lods: print(f"LOD{l['nivel']}: {l['triangulos']} tri ({', '.join(f'{k} {v[chr(110)+chr(118)]} v' for k, v in l['partes'].items())})")
print(f'corpo.bin {len(binario)} bytes, sha256 {sha[:16]}…')
