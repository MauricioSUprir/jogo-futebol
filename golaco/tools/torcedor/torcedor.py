# Torcedor 3D (item 69, PR 2): do numpy do extrair.py (um avatar Rocketbox reduzido em 2 níveis de detalhe) às 8 POSES da
# torcida (as mesmas do quadro: render/torcida-dados.js POSE) assadas vértice a vértice — a textura de animação (VAT) do
# render/torcedor3d.js. Cada pose sai de um esqueleto posto por cinemática direta + inversa de 2 ossos (braços e pernas) e
# da pele por mistura linear dos pesos (LBS) nos 22 ossos; as regiões de cor (camisa, pele, cabelo, calça, sapato) saem
# da textura do avatar no centro de cada triângulo da malha original. O lugar é o da CADEIRA da grade
# (render/cadeiras-dados.js): a origem no piso, no centro do assento; z para a frente (o campo), x para a esquerda da
# pessoa, y para cima. Sentado: o quadril no assento (CADEIRA.assento.altura 0,43 m), os pés no piso, as costas na frente
# do encosto; em pé: na frente do assento (a passagem livre), os pés no piso.
# Uso: python -I torcedor.py <saida.bin> <relatorio.json> <var1.npz> <var1_corpo.tga> <var1_cabeca.tga> [<var2.npz> ...]
import sys, json, struct, numpy as np
from scipy.spatial import cKDTree
from PIL import Image

OSSOS = ['Bip01 Pelvis', 'Bip01 Spine', 'Bip01 Spine1', 'Bip01 Spine2', 'Bip01 Neck', 'Bip01 Head',
         'Bip01 L Clavicle', 'Bip01 L UpperArm', 'Bip01 L Forearm', 'Bip01 L Hand',
         'Bip01 R Clavicle', 'Bip01 R UpperArm', 'Bip01 R Forearm', 'Bip01 R Hand',
         'Bip01 L Thigh', 'Bip01 L Calf', 'Bip01 L Foot', 'Bip01 L Toe0',
         'Bip01 R Thigh', 'Bip01 R Calf', 'Bip01 R Foot', 'Bip01 R Toe0']
I = {n.replace('Bip01 ', ''): k for k, n in enumerate(OSSOS)}
# a hierarquia do jogo (as coxas presas na pelve)
PAI = {'Spine': 'Pelvis', 'Spine1': 'Spine', 'Spine2': 'Spine1', 'Neck': 'Spine2', 'Head': 'Neck',
       'L Clavicle': 'Spine2', 'R Clavicle': 'Spine2', 'L UpperArm': 'L Clavicle', 'R UpperArm': 'R Clavicle',
       'L Forearm': 'L UpperArm', 'R Forearm': 'R UpperArm', 'L Hand': 'L Forearm', 'R Hand': 'R Forearm',
       'L Thigh': 'Pelvis', 'R Thigh': 'Pelvis', 'L Calf': 'L Thigh', 'R Calf': 'R Thigh', 'L Foot': 'L Calf',
       'R Foot': 'R Calf', 'L Toe0': 'L Foot', 'R Toe0': 'R Foot'}
ORDEM = ['Pelvis', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'L Clavicle', 'L UpperArm', 'L Forearm', 'L Hand',
         'R Clavicle', 'R UpperArm', 'R Forearm', 'R Hand', 'L Thigh', 'L Calf', 'L Foot', 'L Toe0', 'R Thigh', 'R Calf',
         'R Foot', 'R Toe0']
POSES = ['SENTADO', 'SENTADO_PALMAS', 'EM_PE', 'EM_PE_PALMAS', 'BRACOS_V', 'UM_BRACO', 'CACHECOL', 'MAOS_CABECA']
REG = {'camisa': 0, 'pele': 1, 'cabelo': 2, 'calca': 3, 'sapato': 4, 'acento': 5}
ASSENTO = 0.43          # m (render/cadeiras-dados.js CADEIRA.assento.altura)
ENCOSTO_Z = -0.215      # m: a frente do encosto (zt − 0,02 + a concha; geometriaCadeira) — as costas ficam na frente
EM_PE_Z = 0.27          # m: o quadril de quem fica de pé (os pés na frente do lábio do assento, z = +0,2; o bico a ~0,51)


def norm(v):
    return v / (np.linalg.norm(v) + 1e-12)


def arco(a, b):
    """A rotação mínima que leva a direção a na b (Rodrigues)."""
    a, b = norm(a), norm(b)
    v = np.cross(a, b); c = float(np.dot(a, b)); s = np.linalg.norm(v)
    if s < 1e-9:
        if c > 0: return np.eye(3)
        p = norm(np.cross(a, [1, 0, 0] if abs(a[0]) < 0.9 else [0, 1, 0]))
        return 2 * np.outer(p, p) - np.eye(3)
    k = v / s; K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    return np.eye(3) + s * K + (1 - c) * K @ K


def rx(t):
    c, s = np.cos(t), np.sin(t)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def ik2(raiz, alvo, l1, l2, polo):
    """Inversa de 2 ossos: o joelho/cotovelo do lado do `polo`. Devolve (meio, alvo alcançável)."""
    d = alvo - raiz; L = np.linalg.norm(d)
    L = min(max(L, abs(l1 - l2) + 1e-4), l1 + l2 - 1e-4)
    u = norm(d); alvo = raiz + u * L
    a = (l1 * l1 - l2 * l2 + L * L) / (2 * L); h = np.sqrt(max(l1 * l1 - a * a, 0))
    p = norm(polo - u * np.dot(polo, u))
    return raiz + u * a + p * h, alvo


class Esqueleto:
    def __init__(s, cab):
        s.J = {n: cab[I[n]].astype(np.float64) for n in ORDEM}
        J = s.J
        filho = {'Spine': 'Spine1', 'Spine1': 'Spine2', 'Spine2': 'Neck', 'Neck': 'Head', 'Pelvis': 'Spine'}
        for l in 'LR':
            filho.update({f'{l} Clavicle': f'{l} UpperArm', f'{l} UpperArm': f'{l} Forearm', f'{l} Forearm': f'{l} Hand',
                          f'{l} Thigh': f'{l} Calf', f'{l} Calf': f'{l} Foot', f'{l} Foot': f'{l} Toe0'})
        s.dir0 = {}
        for n in ORDEM:
            if n in filho: s.dir0[n] = norm(J[filho[n]] - J[n])
        for l in 'LR':
            s.dir0[f'{l} Hand'] = s.dir0[f'{l} Forearm']
            s.dir0[f'{l} Toe0'] = np.array([0, 0, 1.0])
        s.dir0['Head'] = np.array([0, 1.0, 0])
        s.comp = {n: np.linalg.norm(J[filho[n]] - J[n]) for n in filho}

    def pose(s, P):
        """P: {pelve: (posição da cabeça da pelve), pelvePitch, coluna: [pitch Spine, Spine1, Spine2, Neck, Head],
        maos: {L|R: (alvo, polo, direção da mão|None)}, tornozelos: {L|R: (alvo, polo, direção do pé)}, ombros: graus}."""
        J, R, Jp = s.J, {}, {}
        R['Pelvis'] = rx(P.get('pelvePitch', 0)); Jp['Pelvis'] = np.array(P['pelve'], float)
        col = P.get('coluna', [0, 0, 0, 0, 0])
        for n, pt in zip(['Spine', 'Spine1', 'Spine2', 'Neck', 'Head'], col):
            p = PAI[n]; Jp[n] = Jp[p] + R[p] @ (J[n] - J[p]); R[n] = R[p] @ rx(pt)
        # as pernas primeiro (as mãos podem mirar a coxa)
        for l in 'LR':
            th, ca, fo, to = f'{l} Thigh', f'{l} Calf', f'{l} Foot', f'{l} Toe0'
            Jp[th] = Jp['Pelvis'] + R['Pelvis'] @ (J[th] - J['Pelvis'])
            alvo, polo, dpe = P['tornozelos'][l]
            meio, alvo = ik2(Jp[th], np.array(alvo, float), s.comp[th], s.comp[ca], np.array(polo, float))
            R[th] = arco(s.dir0[th], meio - Jp[th])
            Jp[ca] = Jp[th] + R[th] @ (J[ca] - J[th])
            R[ca] = arco(R[th] @ s.dir0[ca], alvo - Jp[ca]) @ R[th]
            Jp[fo] = Jp[ca] + R[ca] @ (J[fo] - J[ca])
            R[fo] = arco(R[ca] @ s.dir0[fo], s.dir0[fo] if dpe is None else np.array(dpe, float)) @ R[ca]
            Jp[to] = Jp[fo] + R[fo] @ (J[to] - J[fo]); R[to] = R[fo]
        for l in 'LR':
            sg = 1 if l == 'L' else -1
            c = f'{l} Clavicle'; p = PAI[c]
            Jp[c] = Jp[p] + R[p] @ (J[c] - J[p])
            # a clavícula sobe com o braço para cima (ombros, graus)
            ombro = np.radians(P.get('ombros', {}).get(l, 0))
            R[c] = R[p] @ arco(np.array([1.0 * sg, 0, 0]), np.array([np.cos(ombro) * sg, np.sin(ombro), 0]))
            ua, fa, ha = f'{l} UpperArm', f'{l} Forearm', f'{l} Hand'
            Jp[ua] = Jp[c] + R[c] @ (J[ua] - J[c])
            alvo, polo, dmao = P['maos'][l]
            alvo = alvo(Jp) if callable(alvo) else np.array(alvo, float)
            meio, alvo = ik2(Jp[ua], alvo, s.comp[ua], s.comp[fa], np.array(polo, float))
            R[ua] = arco(R[c] @ s.dir0[ua], meio - Jp[ua]) @ R[c]
            Jp[fa] = Jp[ua] + R[ua] @ (J[fa] - J[ua])
            R[fa] = arco(R[ua] @ s.dir0[fa], alvo - Jp[fa]) @ R[ua]
            Jp[ha] = Jp[fa] + R[fa] @ (J[ha] - J[fa])
            R[ha] = (arco(R[fa] @ s.dir0[ha], np.array(dmao, float)) @ R[fa]) if dmao is not None else R[fa]
        return R, Jp

    def pele(s, R, Jp, pos, pes):
        out = np.zeros_like(pos, dtype=np.float64)
        for n in ORDEM:
            w = pes[:, I[n]]
            m = w > 0
            if not m.any(): continue
            out[m] += w[m, None] * ((pos[m] - s.J[n]) @ R[n].T + Jp[n])
        return out


def poses(esq, pos_lo, pes_lo, pos_hi, pes_hi, reg_hi):
    """As 8 poses (dict de parâmetros) ajustadas ao corpo: o quadril no assento, as costas na frente do encosto e os pés
    no piso (pela malha ORIGINAL posta: a reduzida segue)."""
    J = esq.J
    yP = J['Pelvis'][1]
    l_coxa, l_canela = esq.comp['L Thigh'], esq.comp['L Calf']
    ytorn = J['L Foot'][1]
    perna = lambda zt, sent: {l: ([(1 if l == 'L' else -1) * (0.13 if sent else 0.11), ytorn, zt], [0, 0.3, 1], None) for l in 'LR'}
    # sentado: a pelve (a cabeça do osso fica na altura das articulações do quadril) — y e z resolvidos abaixo
    def sentado(y, z, maos, coluna=(-0.06, 0.04, 0.05, 0.06, 0.16)):
        return {'pelve': [0, y, z], 'pelvePitch': -0.12, 'coluna': list(coluna), 'maos': maos,
                'tornozelos': perna(z + l_coxa * 0.98 - 0.09, True)}
    def em_pe(maos, coluna=(0.0, 0.0, 0.02, 0.04, 0.12), ombros=None):
        return {'pelve': [0, yP, EM_PE_Z], 'coluna': list(coluna), 'maos': maos, 'ombros': ombros or {},
                'tornozelos': perna(EM_PE_Z - 0.01, False)}
    # alvos das mãos (função do esqueleto posto: ombros, cabeça)
    def rel(base, d):
        return lambda Jp: Jp[base] + np.array(d)
    sg = {'L': 1, 'R': -1}
    coxa = lambda l, frac: (lambda Jp: Jp[f'{l} Thigh'] + (Jp[f'{l} Calf'] - Jp[f'{l} Thigh']) * frac + np.array([0, 0.09, 0]))
    maos_coxa = {l: (coxa(l, 0.62), [sg[l] * 0.6, -0.2, -0.6], [0, -0.35, 1]) for l in 'LR'}
    palmas = lambda alt: {l: (rel('Spine2', [sg[l] * 0.075, alt, 0.33]), [sg[l] * 1, -0.7, 0], [-sg[l] * 0.45, 0.55, 0.7]) for l in 'LR'}
    baixo = {l: (rel(f'{l} UpperArm', [sg[l] * 0.06, -0.55, 0.06]), [0, 0, -1], [0, -1, 0.05]) for l in 'LR'}
    cima = lambda l, ab: (rel(f'{l} UpperArm', [sg[l] * ab, 0.56, 0.08]), [sg[l] * 0.5, 0, -1], [sg[l] * 0.15, 1, 0])
    cachecol = {l: (rel('Head', [sg[l] * 0.3, 0.52, 0.14]), [sg[l] * 1, 0, -0.4], [sg[l] * 0.2, 1, 0.2]) for l in 'LR'}
    cabeca = {l: (rel('Head', [sg[l] * 0.1, 0.17, -0.02]), [sg[l] * 1, 0.3, 0.1], [-sg[l] * 1, 0.2, 0]) for l in 'LR'}
    um = {'L': baixo['L'], 'R': cima('R', 0.12)}
    P = [None] * 8
    P[2] = em_pe(baixo)
    P[3] = em_pe(palmas(0.02))
    P[4] = em_pe({l: cima(l, 0.32) for l in 'LR'}, ombros={'L': 22, 'R': 22})
    P[5] = em_pe(um, ombros={'R': 22})
    P[6] = em_pe(cachecol, coluna=(0, 0, -0.02, -0.04, -0.12), ombros={'L': 25, 'R': 25})
    P[7] = em_pe(cabeca, coluna=(0, 0.02, 0.04, 0.06, 0.18), ombros={'L': 12, 'R': 12})
    # sentado: acha a altura e o z da pelve pela malha original posta (as nádegas no assento, as costas no encosto)
    y, z = ASSENTO + 0.1, -0.08
    for _ in range(6):
        Q = sentado(y, z, maos_coxa)
        R, Jp = esq.pose(Q)
        v = esq.pele(R, Jp, pos_hi, pes_hi)
        nad = (np.abs(v[:, 0]) < 0.2) & (v[:, 2] > -0.25) & (v[:, 2] < 0.15) & (pes_hi[:, I['Pelvis']] + pes_hi[:, I['L Thigh']] + pes_hi[:, I['R Thigh']] > 0.5)
        y += ASSENTO - v[nad, 1].min()
        costas = (v[:, 1] > ASSENTO + 0.05) & (v[:, 1] < ASSENTO + 0.4) & (np.abs(v[:, 0]) < 0.18)
        z += (ENCOSTO_Z + 0.015) - v[costas, 2].min()
    P[0] = sentado(y, z, maos_coxa)
    P[1] = sentado(y, z, palmas(-0.02))
    # os pés no piso: desce/sobe o tornozelo até a sola encostar (em pé também)
    for k in range(8):
        for _ in range(4):
            R, Jp = esq.pose(P[k])
            v = esq.pele(R, Jp, pos_hi, pes_hi)
            pe = (pes_hi[:, I['L Foot']] + pes_hi[:, I['R Foot']] + pes_hi[:, I['L Toe0']] + pes_hi[:, I['R Toe0']]) > 0.5
            dy = -v[pe, 1].min()
            if abs(dy) < 1e-4: break
            if k >= 2: P[k]['pelve'][1] += dy
            for l in 'LR':
                a, p, d = P[k]['tornozelos'][l]
                P[k]['tornozelos'][l] = ([a[0], a[1] + dy, a[2]], p, d)
    return P


def regioes(d, corpo, cabeca):
    """Região de cada triângulo da malha original pela cor da textura no centro dele e pelo osso que manda nele."""
    tri, uv, mat, pes, pos = d['hi_tri'], d['hi_uv'], d['hi_mat'], d['hi_pes'], d['hi_pos']
    mats = list(d['materiais'])
    ehCab = np.array(['head' in mats[m] for m in mat])
    c = uv.mean(1)
    cor = np.zeros((len(tri), 3))
    for img, m in ((corpo, ~ehCab), (cabeca, ehCab)):
        H, W = img.shape[:2]
        x = np.clip((c[m, 0] % 1) * W, 0, W - 1).astype(int); y = np.clip((1 - c[m, 1] % 1) * H, 0, H - 1).astype(int)
        cor[m] = img[y, x, :3] / 255.0
    osso = pes[tri].mean(1).argmax(1)
    nome = np.array([OSSOS[k].replace('Bip01 ', '') for k in osso])
    cen = pos[tri].mean(1)
    def lab(c):
        c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
        M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
        xyz = c @ M.T / np.array([0.9505, 1, 1.089])
        f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
        return np.stack([116 * f[:, 1] - 16, 500 * (f[:, 0] - f[:, 1]), 200 * (f[:, 1] - f[:, 2])], 1)
    L = lab(cor)
    med = lambda m: np.median(L[m], 0)
    # referências: a pele do rosto (cabeça, na frente, meia altura), o cabelo (o alto da cabeça), a camisa (o peito) e a
    # calça (o meio das coxas)
    yH = cen[ehCab, 1]; topo = yH.max()
    rosto = ehCab & (cen[:, 2] > np.percentile(cen[ehCab, 2], 80)) & (cen[:, 1] < topo - 0.1) & (cen[:, 1] > topo - 0.2)
    alto = ehCab & (cen[:, 1] > topo - 0.04)
    peito = ~ehCab & np.isin(nome, ['Spine2', 'Spine1']) & (cen[:, 2] > 0)
    coxas = ~ehCab & np.isin(nome, ['L Thigh', 'R Thigh'])
    mao = ~ehCab & np.isin(nome, ['L Hand', 'R Hand'])
    rp, rc, rca, rcl = med(rosto | mao), med(alto), med(peito), med(coxas)
    dist = lambda r: np.linalg.norm(L - r, axis=1)
    reg = np.zeros(len(tri), np.int32)
    # cabeça: pele ou cabelo (o pescoço é pele)
    cab = ehCab & (dist(rc) < dist(rp)) & (cen[:, 1] > topo - 0.28)
    reg[ehCab] = REG['pele']; reg[cab] = REG['cabelo']
    # corpo: pele pela cor (mãos sempre); o resto pelo osso — o tronco e os braços camisa, as pernas calça, os pés sapato;
    # na pelve, a camisa ou a calça pela cor mais perto
    corpo_m = ~ehCab
    pele = corpo_m & ((dist(rp) < np.minimum(dist(rca), dist(rcl)) - 4) | mao)
    sup = np.isin(nome, ['Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'L Clavicle', 'R Clavicle', 'L UpperArm', 'R UpperArm', 'L Forearm', 'R Forearm', 'L Hand', 'R Hand'])
    pes_ = np.isin(nome, ['L Foot', 'R Foot', 'L Toe0', 'R Toe0'])
    pern = np.isin(nome, ['L Thigh', 'R Thigh', 'L Calf', 'R Calf'])
    pel = nome == 'Pelvis'
    reg[corpo_m & sup] = REG['camisa']
    reg[corpo_m & pern] = REG['calca']
    reg[corpo_m & pel] = np.where(dist(rca)[corpo_m & pel] < dist(rcl)[corpo_m & pel], REG['camisa'], REG['calca'])
    reg[corpo_m & pes_] = REG['sapato']
    reg[pele] = REG['pele']
    # o pé: o sapato mesmo quando a cor parece pele (sandália, tênis claro)
    reg[corpo_m & pes_ & ~mao] = REG['sapato']
    return reg, {'pele': rp.tolist(), 'cabelo': rc.tolist(), 'camisa': rca.tolist(), 'calca': rcl.tolist()}


def regiao_lo(d, k, reg_hi):
    """A região de cada triângulo reduzido: a mais votada entre os triângulos originais mais perto de 4 pontos dele."""
    hi = d['hi_pos'][d['hi_tri']].mean(1)
    arv = cKDTree(hi)
    pos, tri = d[f'lod{k}_pos'], d[f'lod{k}_tri']
    T = pos[tri]
    pts = [T.mean(1)] + [T.mean(1) * 0.5 + T[:, j] * 0.5 for j in range(3)]
    votos = np.stack([reg_hi[arv.query(p)[1]] for p in pts], 1)
    out = np.array([np.bincount(v, minlength=6).argmax() for v in votos], np.int32)
    # o alto da cabeça: com poucos triângulos (o nível 1) o voto perde o cabelo — no alto, um voto de cabelo basta (o
    # quadro também tem o cabelo em cima)
    topo = d['hi_pos'][:, 1].max()
    alto = (T.mean(1)[:, 1] > topo - 0.1) & (votos == REG['cabelo']).any(1)
    out[alto] = REG['cabelo']
    return out


def normais(pos, tri):
    n = np.zeros_like(pos)
    f = np.cross(pos[tri[:, 1]] - pos[tri[:, 0]], pos[tri[:, 2]] - pos[tri[:, 0]])
    for j in range(3): np.add.at(n, tri[:, j], f)
    return n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)


def cachecol(Jp, esq):
    """O cachecol (8 triângulos: a faixa de frente e de trás entre as mãos e as duas pontas penduradas) — só no CACHECOL."""
    mL, mR = Jp['L Hand'] + (Jp['L Hand'] - Jp['L Forearm']) * 0.45, Jp['R Hand'] + (Jp['R Hand'] - Jp['R Forearm']) * 0.45
    e = norm(mL - mR)
    a, b = mL + e * 0.12, mR - e * 0.12
    up = np.array([0, 0.11, 0])
    f = np.array([0, 0, 0.012])
    pL, pR = a - np.array([0, 0.3, 0]) - e * 0.04, b - np.array([0, 0.3, 0]) + e * 0.04
    v = [a + f, b + f, b + up + f, a + up + f, a - f, b - f, b + up - f, a + up - f,
         a + f - e * 0.07, a + f, pL + f, pL + f - e * 0.07, b + f, b + f + e * 0.07, pR + f + e * 0.07, pR + f]
    t = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [8, 10, 9], [8, 11, 10], [12, 14, 13], [12, 15, 14]]
    return np.array(v), np.array(t)


def main():
    a = sys.argv[1:]
    saida, rel = a[0], a[1]
    vars_ = [a[i:i + 3] for i in range(2, len(a), 3)]
    blocos, relatorio = [], {'variacoes': []}
    for npz, tc, th in vars_:
        d = np.load(npz)
        corpo = np.asarray(Image.open(tc).convert('RGB')); cab = np.asarray(Image.open(th).convert('RGB'))
        reg_hi, refs = regioes(d, corpo, cab)
        esq = Esqueleto(d['cabecas'])
        P = poses(esq, None, None, d['hi_pos'].astype(np.float64), d['hi_pes'], reg_hi)
        rv = {'npz': npz, 'refs': refs, 'lods': [], 'poses': []}
        posados = [esq.pose(Q) for Q in P]
        for k in range(2):
            pos, tri, pes = d[f'lod{k}_pos'].astype(np.float64), d[f'lod{k}_tri'], d[f'lod{k}_pes']
            rf = regiao_lo(d, k, reg_hi)
            # vértices da GPU: um por (vértice, região) — a cor muda em degrau na borda das regiões
            chave, mapa, regv = {}, [], []
            ind = np.zeros_like(tri)
            for t in range(len(tri)):
                for j in range(3):
                    kk = (int(tri[t, j]), int(rf[t]))
                    if kk not in chave: chave[kk] = len(mapa); mapa.append(kk[0]); regv.append(kk[1])
                    ind[t, j] = chave[kk]
            mapa = np.array(mapa)
            # o cachecol: 16 vértices e 8 triângulos no fim (fechados num ponto do peito fora do CACHECOL)
            nV = len(mapa) + 16
            ind = np.concatenate([ind, len(mapa) + np.array(cachecol(posados[6][1], esq)[1])])
            regv = regv + [REG['acento']] * 16
            P_pos = np.zeros((8, nV, 3)); P_nor = np.zeros((8, nV, 3))
            for pi, (R, Jp) in enumerate(posados):
                v = esq.pele(R, Jp, pos, pes)
                if pi < 2:
                    # sentado: a malha reduzida perde o ponto mais baixo das nádegas (o triângulo grande passa por cima): o
                    # que fica embaixo do quadril encosta no assento (a carne amassa no assento, como na malha original)
                    nad = (np.abs(v[:, 0]) < 0.2) & (v[:, 2] > -0.25) & (v[:, 2] < 0.15) & (v[:, 1] > 0.25) & (v[:, 1] < ASSENTO + 0.14)
                    folga = v[nad, 1].min() - ASSENTO
                    if folga > 0.005:
                        w = np.clip(1 - (v[nad, 1] - (ASSENTO + folga)) / 0.12, 0, 1)
                        v[nad, 1] -= folga * w
                n = normais(v, tri)
                P_pos[pi, :len(mapa)] = v[mapa]; P_nor[pi, :len(mapa)] = n[mapa]
                cv, ct = cachecol(Jp, esq)
                if pi == 6:
                    P_pos[pi, len(mapa):] = cv
                    cn = np.zeros_like(cv); cn[:, 2] = 1; cn[4:8, 2] = -1
                    P_nor[pi, len(mapa):] = cn
                else:
                    P_pos[pi, len(mapa):] = Jp['Spine2']; P_nor[pi, len(mapa):] = [0, 0, 1]
            blocos.append({'ind': ind.astype(np.uint16), 'reg': np.array(regv, np.uint8), 'pos': P_pos, 'nor': P_nor})
            rv['lods'].append({'vertices': int(nV), 'triangulos': int(len(ind)), 'regioes': np.bincount(rf, minlength=6).tolist()})
        for pi, (R, Jp) in enumerate(posados):
            v = esq.pele(R, Jp, d['hi_pos'].astype(np.float64), d['hi_pes'])
            rv['poses'].append({'pose': POSES[pi], 'pelve': Jp['Pelvis'].round(4).tolist(), 'minY': float(v[:, 1].min()), 'maxY': float(v[:, 1].max()),
                                'minZ': float(v[:, 2].min()), 'maxZ': float(v[:, 2].max())})
        relatorio['variacoes'].append(rv)
    # o arquivo: 'TCD1', nVar, nLod, nPoses (+2 bytes); por (variação, nível): nV, nTri, índices u16, regiões u8 (alinhado
    # a 2), posições int16 (1/10000 m) e normais int8 (/127) por pose, alinhado a 4 no fim
    nVar = len(vars_)
    buf = bytearray(b'TCD1') + struct.pack('<HHH', nVar, 2, 8) + b'\0\0'
    for b in blocos:
        nV, nT = b['pos'].shape[1], len(b['ind'])
        buf += struct.pack('<HH', nV, nT)
        buf += b['ind'].astype('<u2').tobytes()
        r = b['reg'].tobytes(); buf += r + (b'\0' if len(r) % 2 else b'')
        q = np.round(b['pos'] * 10000).astype('<i2'); buf += q.tobytes()
        nn = np.round(b['nor'] * 127).astype('i1'); buf += nn.tobytes()
        while len(buf) % 4: buf += b'\0'
    open(saida, 'wb').write(buf)
    relatorio['bytes'] = len(buf)
    json.dump(relatorio, open(rel, 'w'), indent=1)
    print('ok', saida, len(buf), 'bytes')


if __name__ == '__main__':
    main()
