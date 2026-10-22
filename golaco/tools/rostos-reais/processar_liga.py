# Rostos REAIS de uma liga (a versão de teste do dono: edição pro do Total Match, trancada por chave) — a foto mais
# recente e boa de cada jogador (fotos_html.py: Wikimedia Commons, licença livre) levada à pele da cabeça do corpo humano
# (rosto_na_cabeca.py: os marcos do MediaPipe na foto e no render da cabeça, a malha canônica, o lado escondido
# espelhado, o tom passado à cabeça). Saída, para o jogo (golaco/assets/rostos-reais/):
#   <liga>/<chave>.webp   a textura da cabeça (512²) com o rosto; <chave> = o nome da foto do TM sem a extensão
#   <liga>.json           {chave: {nome, pele '#rrggbb' (o tom da foto, para o corpo), foto {titulo, data, autor,
#                          licenca, pagina}}}
#   CREDITOS-<liga>.md    autor, licença e página de cada foto (a textura é obra derivada da foto)
# Uso: python -I processar_liga.py <manifesto.json de fotos_html.py> <liga> <rb_frente.png> <rb_cabeca.npz>
#        <canonical_face_model.obj> <head_color_1024.png> <body_color_1024.png> <face_landmarker.task>
#        <selfie_multiclass.tflite> <rascunho_dir> <saida assets/rostos-reais> [max]
import sys, os, json, subprocess, numpy as np, cv2
(man_arq, liga, rend, npzf, obj, head, body, modelo, seg, rasc, saida) = sys.argv[1:12]
MAX = int(sys.argv[12]) if len(sys.argv) > 12 else 10 ** 9
AQUI = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable
man = json.load(open(man_arq))
os.makedirs(os.path.join(saida, liga), exist_ok=True); os.makedirs(rasc, exist_ok=True)
itens = [(k, v) for k, v in sorted(man.items()) if v.get('escolhida') and os.path.exists(v['escolhida']['arquivo'])][:MAX]
fotos = [v['escolhida']['arquivo'] for _, v in itens]
marcos = os.path.join(rasc, 'marcos.json')
subprocess.run([PY, '-I', os.path.join(AQUI, 'marcos_fotos.py'), modelo, marcos, rend, *fotos], check=True,
               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
M = json.load(open(marcos))
saida_json = os.path.join(saida, liga + '.json')
tab = json.load(open(saida_json)) if os.path.exists(saida_json) else {}

def lab_hex(lab):
    L, a, b = lab
    px = np.array([[[L * 255 / 100, a + 128, b + 128]]], np.float32).astype(np.uint8)
    r, g, bb = cv2.cvtColor(px, cv2.COLOR_Lab2RGB)[0, 0]
    return '#%02x%02x%02x' % (int(r), int(g), int(bb))

# portão de qualidade: a foto torta (de lado, de cima, com a cabeça inclinada ou a expressão forte) deforma o rosto na
# textura. Os marcos estáveis da foto alinhados (Procrustes) aos do render da cabeça de frente: o erro médio ÷ a distância
# entre os olhos ≤ RESID e o giro |yaw| ≤ YAW
RESID, YAW = 0.165, 21
REND = M[rend]
IDX = [33, 133, 362, 263, 1, 4, 61, 291, 152, 10, 234, 454, 168, 6, 13, 14, 70, 300, 105, 334, 127, 356, 172, 397]
def residuo(L):
    A = np.array(L)[:468, :2][IDX]; B = np.array(REND['L'])[:468, :2][IDX]
    a = A - A.mean(0); b = B - B.mean(0)
    U, Sg, Vt = np.linalg.svd(a.T @ b); sc = Sg.sum() / (a ** 2).sum()
    return float(np.linalg.norm(a @ (U @ Vt) * sc - b, axis=1).mean() / np.linalg.norm(B[3] - B[0]))
feitos = 0
rejeitadas = {}
for n, (k, v) in enumerate(itens):
    chave = k.rsplit('.', 1)[0]
    foto = v['escolhida']['arquivo']
    if not M.get(foto):
        print(f'{n + 1}/{len(itens)} {v["jogador"]}: sem marcos na foto', flush=True); continue
    res, yaw = residuo(M[foto]['L']), M[foto]['yaw']
    if res > RESID or abs(yaw) > YAW:
        rejeitadas[chave] = {'nome': v['jogador'], 'residuo': round(res, 3), 'yaw': round(yaw, 1)}
        tab.pop(chave, None)
        print(f'{n + 1}/{len(itens)} {v["jogador"]}: foto torta (resíduo {res:.3f}, yaw {yaw:.0f}°) — fica sem rosto real', flush=True); continue
    pasta = os.path.join(rasc, chave)
    r = subprocess.run([PY, '-I', os.path.join(AQUI, 'rosto_na_cabeca.py'), marcos, foto, rend, npzf, obj, head, body, pasta, seg],
                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    cab = os.path.join(pasta, 'cabeca_cor.png')
    if r.returncode != 0 or not os.path.exists(cab):
        print(f'{n + 1}/{len(itens)} {v["jogador"]}: FALHOU ({r.stdout.strip().splitlines()[-1] if r.stdout.strip() else r.returncode})', flush=True); continue
    img = cv2.resize(cv2.imread(cab), (512, 512), interpolation=cv2.INTER_AREA)
    cv2.imwrite(os.path.join(saida, liga, chave + '.webp'), img, [cv2.IMWRITE_WEBP_QUALITY, 86])
    info = json.load(open(os.path.join(pasta, 'rosto.json')))
    e = v['escolhida']
    tab[chave] = {'nome': v['jogador'], 'pele': lab_hex(info['tom_lab_foto']),
                  'foto': {'titulo': e['titulo'], 'data': e['data'], 'autor': e.get('autor', ''), 'licenca': e.get('licenca', ''), 'pagina': e.get('pagina', ''),
                           # a pose e a expressão da foto (MediaPipe; o teste-rostos-reais confere)
                           'av': {x: e.get('av', {}).get(x) for x in ('yaw', 'pitch', 'roll', 'sorriso', 'boca', 'bico', 'piscada', 'io')},
                           'id': e.get('id')}}
    feitos += 1
    json.dump(tab, open(saida_json, 'w'), ensure_ascii=False, indent=0)
    print(f'{n + 1}/{len(itens)} {v["jogador"]}: ok ({e["data"][0]}) pele {tab[chave]["pele"]}', flush=True)
# créditos
linhas = [f'# Rostos reais — {liga} (versão de teste: edição pro do Total Match)', '',
          'Cada textura em `' + liga + '/` é obra DERIVADA da foto abaixo (o rosto levado à pele da cabeça 3D por',
          '`golaco/tools/rostos-reais/rosto_na_cabeca.py`); vale a licença da foto (CC BY-SA: a derivada sai na mesma licença).', '']
for chave, t in sorted(tab.items()):
    f = t['foto']
    linhas.append(f"- `{chave}` ({t['nome']}) — {f['autor'] or 'autor na página'} — {f['licenca']} — {f['pagina']} — {f['data'][0]}")
open(os.path.join(saida, f'CREDITOS-{liga}.md'), 'w').write('\n'.join(linhas) + '\n')
json.dump(rejeitadas, open(os.path.join(rasc, 'rejeitadas.json'), 'w'), ensure_ascii=False, indent=0)
json.dump(tab, open(saida_json, 'w'), ensure_ascii=False, indent=0)
print(f'fim: {feitos} rostos novos, {len(tab)} na liga, {len(rejeitadas)} fotos tortas', flush=True)
