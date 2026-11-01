# O elenco da temporada (edição pessoal; dono, 31/10: "todos os personagens terem seu boneco"): cada personagem que fala
# nas cenas ganha um corpo do Rocketbox (MIT; pessoas genéricas da biblioteca, só os nomes são da história). Converte com
# os mesmos passos do README (glb → extrair → encaixar → pesos → lods → exportar_bin) e grava as texturas em WebP,
# tingindo a roupa quando o papel pede (o macacão laranja de Iron Heights, o pelo escuro do Grodd).
# Uso: python -I elenco.py <rocketbox> <rascunho> <velocista/assets/personagens> [nome ...]
import sys, os, glob, subprocess
import numpy as np
from PIL import Image

RB, TMP, DEST = sys.argv[1:4]
SO = set(sys.argv[4:])
AQUI = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable

# nome → (avatar, tinta da roupa: None ou (tira a cor, multiplica RGB))
ELENCO = {
  'oliver':   ('Adults/Male_Adult_06', (0.5, (0.62, 0.78, 0.6))),     # jaqueta escura puxada para o verde-oliva
  'pai':      ('Adults/Male_Adult_14', (0.75, (1.35, 0.78, 0.42))),   # o macacão de Iron Heights
  'nora':     ('Adults/Female_Adult_04', None),
  'crianca':  ('Children/Male_Child_01', None),
  'eddie':    ('Professions/Business_Male_02', None),
  'singh':    ('Professions/Business_Male_03', None),
  'felicity': ('Professions/Business_Female_02', None),
  'ronnie':   ('Adults/Male_Adult_09', None),
  'stein':    ('Professions/Medical_Male_01', None),
  'eiling':   ('Professions/Military_Male_02', None),
  'stagg':    ('Professions/Business_Male_06', None),
  'bette':    ('Professions/Military_Female_01', None),
  'tony':     ('Professions/Construction_Male_02', None),
  'hartley':  ('Adults/Male_Adult_13', None),
  'linda':    ('Professions/Business_Female_04', None),
  'mason':    ('Adults/Male_Adult_16', None),
  'lisa':     ('Adults/Female_Adult_12', None),
  'tina':     ('Professions/Medical_Female_01', None),
  'lance':    ('Professions/Police_Male_01', None),
  'ray':      ('Professions/Business_Male_01', None),
  'grodd':    ('Professions/Sports_Male_01', 'grodd'),
}

def roda(*a):
    r = subprocess.run([PY, '-I', *a], capture_output=True, text=True)
    if r.returncode: print(r.stdout[-2000:], r.stderr[-3000:]); raise SystemExit(f'falhou: {a[0]}')

def tingir(img, tinta, pele_fica=True):
    a = np.asarray(img.convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    pele = (r > 120) & (r - b > 35) & (r - g > 12) & (r - g < 75)       # mãos e braços à mostra ficam
    L = a.mean(-1, keepdims=True)
    tira, mult = tinta
    t = (a * (1 - tira) + L * tira) * np.array(mult)
    out = np.where((pele & pele_fica)[..., None], a, t)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))

def grodd(img, cabeca=False):
    # pelo castanho quase preto em tudo (a pele inclusive), com a textura da malha dando o relevo
    a = np.asarray(img.convert('RGB')).astype(np.float32)
    L = a.mean(-1, keepdims=True) / 255
    out = np.concatenate([L * 70 + 18, L * 52 + 13, L * 40 + 10], -1)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))

for nome, (av, tinta) in ELENCO.items():
    if SO and nome not in SO: continue
    pasta = os.path.join(RB, 'Assets/Avatars', av)
    fbx = os.path.join(pasta, 'Export', os.path.basename(av) + '.fbx')
    o = os.path.join(TMP, nome); os.makedirs(o, exist_ok=True)
    print('==', nome, av, flush=True)
    roda(f'{AQUI}/glb.py', fbx, f'{o}/rb')
    roda(f'{AQUI}/extrair.py', f'{o}/rb_lods.glb', f'{o}/rb.npz')
    roda(f'{AQUI}/encaixar.py', f'{o}/rb.npz', f'{o}/enc')
    roda(f'{AQUI}/pesos.py', f'{o}/enc.npz', f'{o}/enc-repouso.json', f'{o}/pesos.npz')
    r = subprocess.run([PY, '-I', f'{AQUI}/lods.py', f'{o}/pesos.npz', f'{o}/lods.npz'], cwd=o, capture_output=True, text=True)
    if r.returncode: print(r.stderr[-3000:]); raise SystemExit('lods')
    d = np.load(f'{o}/lods.npz'); np.savez(f'{o}/sem.npz', **{k: d[k] for k in d.files if not k.startswith('cabelo')})
    dest = os.path.join(DEST, nome); os.makedirs(dest, exist_ok=True)
    roda(f'{AQUI}/exportar_bin.py', f'{o}/sem.npz', f'{o}/enc-repouso.json', dest, f'Microsoft Rocketbox {av} (MIT), encaixado nas medidas do jogo')
    corpo = Image.open(glob.glob(os.path.join(pasta, 'Textures', '*_body_color*.tga'))[0])
    cab = Image.open(glob.glob(os.path.join(pasta, 'Textures', '*_head_color*.tga'))[0])
    if tinta == 'grodd': corpo, cab = grodd(corpo), grodd(cab, True)
    elif tinta: corpo = tingir(corpo, tinta)
    corpo.convert('RGB').resize((1024, 1024), Image.LANCZOS).save(f'{dest}/corpo.webp', quality=82)
    cab.convert('RGB').resize((1024, 1024), Image.LANCZOS).save(f'{dest}/cabeca.webp', quality=86)
    print('   ok', sorted(os.listdir(dest)), flush=True)
