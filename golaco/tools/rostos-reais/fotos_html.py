# A foto MAIS RECENTE e boa de cada jogador de uma liga do TM no Wikimedia Commons (licença livre), pelas PÁGINAS do
# Commons (a API está limitada para o IP desta máquina; as páginas vêm do cache e respondem): o item do Wikidata (a
# identidade que o TM já guarda em assets/CREDITOS-imagens.md) dá a foto principal (P18) e a categoria (P373); a
# categoria e as subcategorias dela com o nome do jogador ("X in 2025", "X by year", "X with Flamengo") dão os arquivos;
# o ano vem da subcategoria, do nome do arquivo ou da página do arquivo ("Date" do modelo Information). As mais novas são
# baixadas (miniatura de 1280 px, ou 2560 se o rosto ficar pequeno) e conferidas pelo MediaPipe (de frente, olhos
# abertos, boca fechada, olhos a ≥ 45 px). Fica a mais nova que passa, com o autor e a licença para os créditos.
# Uso: python -I fotos_html.py <CREDITOS-imagens.md> <prefixo, ex. br ou br-flamengo> <modelo.task> <saida_dir> [max]
import sys, os, re, json, time, math, html, urllib.parse, urllib.request
import numpy as np, cv2, mediapipe as mp
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision
cred, liga, modelo, saida = sys.argv[1:5]
MAX = int(sys.argv[5]) if len(sys.argv) > 5 else 10 ** 9
os.makedirs(os.path.join(saida, 'fotos'), exist_ok=True)
UA = 'GolacoTM/1.0 (https://github.com/MauricioSUprir/jogo-futebol)'
CW = 'https://commons.wikimedia.org/wiki/'
LIVRES = re.compile(r'^(cc0|cc[ -]by(-sa)?( \d\.\d)?( [a-z]{2,3})?|public domain|pd.*|attribution.*|gfdl.*|fal)$', re.I)
det = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
    base_options=mpt.BaseOptions(model_asset_path=modelo), num_faces=3, output_face_blendshapes=True,
    output_facial_transformation_matrixes=True))
_ult = {}
N429 = [0]
def pegar(url, binario=True, tent=4):
    host = urllib.parse.urlparse(url).netloc
    passo = 0.3 if 'upload' in host or 'thumb' in host else 0.5
    for k in range(tent):
        espera = passo - (time.time() - _ult.get(host, 0.0))
        if espera > 0: time.sleep(espera)
        _ult[host] = time.time()
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                dado = r.read()
            return dado if binario else json.loads(dado)
        except urllib.error.HTTPError as e:
            if e.code in (429, 503): N429[0] += 1; time.sleep(min(30, 2 * 2 ** k)); continue
            if e.code in (404, 400): return None
            time.sleep(2)
        except Exception:
            time.sleep(2)
    return None
def pagina(titulo):
    b = pegar(CW + urllib.parse.quote(titulo.replace(' ', '_'), safe='/:(),\'!'))
    return b.decode('utf-8', 'replace') if b else ''
nome_arq = lambda href: urllib.parse.unquote(href).replace('_', ' ')
IMG = re.compile(r'\.(jpe?g|png)$', re.I)

def arquivos_de(s, ano, arquivos):
    i1 = s.find('id="mw-category-media"')
    for href in re.findall(r'href="/wiki/(File:[^"#?]+)"', s[i1:] if i1 >= 0 else ''):
        t = nome_arq(href)
        if IMG.search(t) and t not in arquivos: arquivos[t] = ano

def categoria(cat, prof, base, vistos, arquivos):
    """Arquivos da categoria (e das subcategorias com o nome do jogador), com o ano da subcategoria quando houver."""
    if cat in vistos or len(vistos) >= 20: return
    vistos.add(cat)
    m = re.search(r'\bin (\d{4})\b', cat); ano = int(m.group(1)) if m else 0
    s1 = s = pagina('Category:' + cat)
    if not s: return
    arquivos_de(s, ano, arquivos)
    for _ in range(4):  # páginas seguintes da categoria (200 arquivos por página)
        prox = re.search(r'href="(/w/index\.php\?title=Category:[^"]*filefrom=[^"]*)"[^>]*>next page', s)
        if not prox: break
        b = pegar('https://commons.wikimedia.org' + html.unescape(prox.group(1)))
        if not b: break
        s = b.decode('utf-8', 'replace'); arquivos_de(s, ano, arquivos)
    if prof >= 3: return
    # subcategorias (da 1ª página)
    i0 = s1.find('id="mw-subcategories"'); i1 = s1.find('id="mw-category-media"')
    sub = s1[i0:i1 if i1 > i0 else len(s1)] if i0 >= 0 else ''
    for href in re.findall(r'href="/wiki/Category:([^"#?]+)"', sub):
        c = nome_arq(href)
        if c.lower().startswith(base.lower()): categoria(c, prof + 1, base, vistos, arquivos)

def data_do_nome(t):
    m = re.search(r'(20[012]\d)[-_ .]?([01]\d)[-_ .]?([0-3]\d)', t)
    if m and 1 <= int(m.group(2)) <= 12 and 1 <= int(m.group(3)) <= 31: return (int(m.group(1)), int(m.group(2)), int(m.group(3)))
    m = re.search(r'\b(20[012]\d)\b', t)
    return (int(m.group(1)), 0, 0) if m else None

MESES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
def info_arquivo(titulo):
    s = pagina(titulo)
    if not s or 'mw-imagepage-nofile' in s: return None
    r = {'pagina': CW + urllib.parse.quote(titulo.replace(' ', '_'))}
    m = re.search(r'fileinfotpl(?:_|&#95;)date"[^>]*>[^<]*</td>\s*<td[^>]*>(.*?)</td>', s, re.S)
    if m:
        md = re.search(r'datetime="(\d{4})-(\d\d)-(\d\d)', m.group(1)) or re.search(r'(\d{4})-(\d\d)-(\d\d)', m.group(1))
        if md: r['data'] = (int(md.group(1)), int(md.group(2)), int(md.group(3))); r['fonte_data'] = 'Date'
        else:
            my = re.search(r'\b(19|20)(\d\d)\b', re.sub(r'<[^>]+>', ' ', m.group(1)))
            if my: r['data'] = (int(my.group(1) + my.group(2)), 0, 0); r['fonte_data'] = 'Date (ano)'
    if 'data' not in r:
        m = re.search(r'exif-datetimeoriginal"><th>[^<]*</th><td>[^<]*?(\d{1,2}) (\w+) (\d{4})', s)
        if m and m.group(2).lower() in MESES:
            r['data'] = (int(m.group(3)), MESES.index(m.group(2).lower()) + 1, int(m.group(1))); r['fonte_data'] = 'EXIF'
    m = re.search(r'licensetpl(?:_|&#95;)short"[^>]*>([^<]*)<', s)
    r['licenca'] = html.unescape(m.group(1)).strip() if m else ''
    m = re.search(r'fileinfotpl(?:_|&#95;)aut"[^>]*>[^<]*</td>\s*<td[^>]*>(.*?)</td>', s, re.S)
    r['autor'] = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', m.group(1)))).strip()[:120] if m else ''
    m = re.search(r'class="fullImageLink"[^>]*><a href="([^"?]+)', s)
    r['original'] = m.group(1) if m else None
    m = re.search(r'\(([\d,.]+) × ([\d,.]+) pixels', s)
    if m: r['w'], r['h'] = int(re.sub(r'\D', '', m.group(1))), int(re.sub(r'\D', '', m.group(2)))
    return r

import hashlib
def miniatura(titulo, largura):
    # o caminho do Commons pelo md5 do nome; as miniaturas vêm de thumb.wikimedia.org (o upload está limitado aqui)
    n = titulo[5:].replace(' ', '_'); h = hashlib.md5(n.encode('utf-8')).hexdigest(); q = urllib.parse.quote(n)
    return f'https://thumb.wikimedia.org/wikipedia/commons/thumb/{h[0]}/{h[:2]}/{q}/{largura}px-{q}'
PASSOS = [2560, 1920, 1280, 960, 500, 330]

def avaliar(img):
    h, w = img.shape[:2]
    r = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)))
    if not r.face_landmarks: return None
    k = max(range(len(r.face_landmarks)), key=lambda i: max(p.x for p in r.face_landmarks[i]) - min(p.x for p in r.face_landmarks[i]))
    L = np.array([[p.x * w, p.y * h, p.z * w] for p in r.face_landmarks[k]])
    M = np.array(r.facial_transformation_matrixes[k]); R = M[:3, :3] / np.linalg.norm(M[:3, 0])
    yaw = math.degrees(math.atan2(-R[2, 0], math.hypot(R[0, 0], R[1, 0])))
    pitch = math.degrees(math.atan2(R[2, 1], R[2, 2]))
    bs = {c.category_name: c.score for c in r.face_blendshapes[k]}
    io = float(np.hypot(*(L[33, :2] - L[263, :2])))
    return {'yaw': round(yaw, 1), 'pitch': round(pitch, 1), 'io': round(io, 1), 'rostos': len(r.face_landmarks),
            'boca': round(bs.get('jawOpen', 0), 2), 'piscada': round(max(bs.get('eyeBlinkLeft', 0), bs.get('eyeBlinkRight', 0)), 2),
            'caixa': [float(L[:, 0].min()), float(L[:, 1].min()), float(L[:, 0].max()), float(L[:, 1].max())]}
YAW, IO, NCAND = float(os.environ.get('FOTO_YAW', 18)), float(os.environ.get('FOTO_IO', 45)), int(os.environ.get('FOTO_N', 12))
SEGUNDA = os.environ.get('FOTO_SEGUNDA') == '1'   # refaz só quem ficou sem foto
bom = lambda av: av and abs(av['yaw']) <= YAW and abs(av['pitch']) <= 22 and av['io'] >= IO and av['boca'] < 0.4 and av['piscada'] < 0.5

linhas = [l for l in open(cred, encoding='utf-8') if re.match(r'- `' + re.escape(liga) + r'[-_]', l)]
man_arq = os.path.join(saida, 'manifesto.json')
manifesto = json.load(open(man_arq)) if os.path.exists(man_arq) else {}
t0 = time.time()
for n, l in enumerate(linhas[:MAX]):
    arq = re.search(r'`([^`]+)`', l).group(1)
    if arq in manifesto and manifesto[arq].get('v') == 2 and not (SEGUNDA and not manifesto[arq].get('escolhida') and manifesto[arq].get('candidatos')): continue
    mn = re.search(r'\(([^,]+),', l)
    if not mn: continue  # foto de estádio (sem jogador)
    nome = mn.group(1)
    q = re.search(r'wikidata\.org/wiki/(Q\d+)', l)
    ma = re.search(r'(https://commons\.wikimedia\.org/wiki/File:\S+)', l)
    ent = {'v': 2, 'jogador': nome, 'arquivo_tm': arq, 'wikidata': q.group(1) if q else None, 'atual': ma.group(1) if ma else None}
    if not q:
        ent['erro'] = 'sem wikidata'; manifesto[arq] = ent; continue
    d = pegar(f'https://www.wikidata.org/wiki/Special:EntityData/{q.group(1)}.json', binario=False)
    if not d:
        ent['erro'] = 'wikidata não respondeu'; manifesto[arq] = ent; continue
    e = next(iter(d['entities'].values())); c = e.get('claims', {})
    val = lambda p: [x['mainsnak'].get('datavalue', {}).get('value') for x in c.get(p, [])]
    ocup = [v.get('id') for v in val('P106') if isinstance(v, dict)]
    esporte = [v.get('id') for v in val('P641') if isinstance(v, dict)]
    ent['futebolista'] = 'Q937857' in ocup or 'Q2736' in esporte
    arquivos = {}
    for f in val('P18'):
        if isinstance(f, str) and IMG.search(f): arquivos['File:' + f] = 0
    cats = [v for v in val('P373') if isinstance(v, str)]
    if cats: categoria(cats[0], 0, cats[0], set(), arquivos)
    # data: subcategoria do ano < nome do arquivo < página do arquivo (lida só para os sem data, até 30)
    cands = []
    for t, ano in arquivos.items():
        dn = data_do_nome(t)
        dt = dn if dn and (not ano or dn[0] == ano) else ((ano, 0, 0) if ano else None)
        cands.append({'titulo': t, 'data': dt})
    for x in [x for x in cands if not x['data']][:30]:
        inf = info_arquivo(x['titulo'])
        if inf: x['info'] = inf; x['data'] = inf.get('data')
    cands = [x for x in cands if x['data']]
    cands.sort(key=lambda x: tuple(x['data']), reverse=True)
    ent['candidatos'] = len(arquivos); ent['com_data'] = len(cands)
    escolhida = None; vistos = []
    for cnd in cands[:NCAND]:
        # a miniatura de 1280 (sem ler a página: só a escolhida tem a página lida, para o autor e a licença); rosto
        # pequeno → 2560; foto menor que 1280 → o maior passo padrão que existir
        av = None; img = None
        fila = [1280, 960, 500]
        while fila:
            larg = fila.pop(0)
            b = pegar(miniatura(cnd['titulo'], larg))
            if not b: continue
            img = cv2.imdecode(np.frombuffer(b, np.uint8), cv2.IMREAD_COLOR)
            if img is None: break
            av = avaliar(img)
            fila = [2560] if larg == 1280 and av and av['io'] < 45 and img.shape[1] >= 1280 else []
        vistos.append({'titulo': cnd['titulo'], 'data': cnd['data'], 'av': av})
        if not bom(av): continue
        inf = cnd.get('info') or info_arquivo(cnd['titulo'])
        if not inf: continue
        if inf.get('data') and inf.get('fonte_data') == 'Date': cnd['data'] = inf['data']
        if not LIVRES.match(inf.get('licenca', '')): vistos[-1]['licenca'] = inf.get('licenca'); continue
        if bom(av):
            x0, y0, x1, y1 = av['caixa']; cxx, cyy = (x0 + x1) / 2, (y0 + y1) / 2; lado = max(x1 - x0, y1 - y0) * 2.4
            X0, Y0 = int(max(0, cxx - lado / 2)), int(max(0, cyy - lado * 0.55)); X1, Y1 = int(min(img.shape[1], cxx + lado / 2)), int(min(img.shape[0], cyy + lado * 0.45))
            rec = img[Y0:Y1, X0:X1]
            if max(rec.shape[:2]) > 1024: rec = cv2.resize(rec, None, fx=1024 / max(rec.shape[:2]), fy=1024 / max(rec.shape[:2]), interpolation=cv2.INTER_AREA)
            destino = os.path.join(saida, 'fotos', arq)
            cv2.imwrite(destino, rec, [cv2.IMWRITE_JPEG_QUALITY, 92])
            escolhida = {'titulo': cnd['titulo'], 'data': cnd['data'], 'licenca': inf['licenca'], 'autor': inf['autor'], 'passada': 2 if SEGUNDA else 1,
                         'pagina': inf['pagina'], 'av': av, 'arquivo': destino}
            break
    ent['escolhida'] = escolhida; ent['vistos'] = vistos
    manifesto[arq] = ent
    json.dump(manifesto, open(man_arq, 'w'), ensure_ascii=False, indent=1)
    dt = escolhida['data'] if escolhida else None
    print(f'{n + 1}/{len(linhas)} [{time.time() - t0:.0f} s, 429: {N429[0]}] {nome}: {len(arquivos)} arquivos, {len(cands)} com data; '
          f'escolhida {dt} {escolhida["titulo"][:70] if escolhida else "NENHUMA"}', flush=True)
json.dump(manifesto, open(man_arq, 'w'), ensure_ascii=False, indent=1)
print('fim', flush=True)
os._exit(0)
