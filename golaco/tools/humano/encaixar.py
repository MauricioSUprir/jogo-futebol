# Encaixe do corpo do Rocketbox (Sports_Male_02, MIT) nas medidas do esqueleto do JOGO (anim.js), offline, em numpy.
# O jogo tem perna longa (coxa e canela 0,449) e tronco curto; o Rocketbox, o contrário (0,40/0,395 e tronco 7 cm mais
# longo). O desenho tem de pisar onde a simulação pisa (o pé plantado é o do jogo) e a cabeça tem de ficar onde está a
# esfera da física (anim.js RAIO_CABECA, sim.js cabecaNaBola), então:
#  - pernas: o comprimento do jogo, na direção de cada osso do Rocketbox (o leve afastamento e a dobra do joelho dele);
#    o tornozelo na altura do jogo; o pé sem escala (só sobe ELEVA_PE para a sola não entrar no chão);
#  - tronco: a altura do Rocketbox mapeada por trechos (quadril → ombro → base do crânio) nas alturas do jogo;
#  - cabeça, mão e pé: rígidos (só translação): o tamanho do Rocketbox;
#  - ombro: o do DESENHO, QUEDA abaixo e ABRE para fora do ombro do jogo (o "ombro" do jogo está 4–5 cm acima da
#    articulação de verdade — sem isso o pescoço some); o esqueleto do desenho (js/render/esqueleto.js) usa as MESMAS
#    duas constantes, gravadas no repouso.json, e refaz o cotovelo por IK com a mão do jogo (as luvas na bola);
#  - cada osso do Rocketbox vira uma semelhança (translação + rotação de menor arco + escala SÓ ao longo do osso: a perna
#    fica mais longa, não mais grossa); o vértice anda pela média ponderada dos pesos dele (a mesma pele linear do jogo),
#    então as emendas nas juntas ficam suaves.
# Saída: <saida>.npz com cada parte/LOD em coordenadas do JOGO (x = frente, y = cima, z = direita; de frente para +x,
# origem no chão sob a pelve) e os pesos já nos 19 ossos do desenho; e <saida>-repouso.json com as juntas do repouso.
# Uso: python -I encaixar.py <rb.npz de extrair.py> <saida_prefixo> [QUEDA=0.045] [ABRE=0.012]
import sys, json, numpy as np

ent, saida = sys.argv[1], sys.argv[2]
QUEDA = float(sys.argv[3]) if len(sys.argv) > 3 else 0.045
ABRE = float(sys.argv[4]) if len(sys.argv) > 4 else 0.012
d = np.load(ent)
NOMES = [str(n) for n in d['ossos']]
iR = {n.replace('Bip01 ', ''): i for i, n in enumerate(NOMES)}

def g(p):  # Blender (de frente para −Y, esquerda = +X, Z cima) → jogo (x frente, y cima, z direita)
    p = np.asarray(p, float)
    return np.stack([-p[..., 1], p[..., 2], -p[..., 0]], -1)

HB = g(d['cabecas_ossos'])
h = lambda n: HB[iR[n]].copy()

# medidas do jogo (anim.js; tools/humano/repouso-do-jogo.mjs mede a pose de pé)
COXA = CANELA = 0.4491
PE = 0.1834
TORN_Y = 0.08                        # o tornozelo do pé APOIADO na partida (JOGADOR.alturaTornozelo)
QUADRIL_Z = 0.09
PELVE_SOBE = 0.03
COLUNA = [0.17, 0.22, 0.13]          # pelve→lombar, lombar→peito, peito→pescoço
PESCOCO_CABECA = 0.1321
OMBRO_SOBE, OMBRO_Z = 0.07, 0.19     # ombro do jogo = peito + 0,07 para cima, ±0,19 para o lado
BRACO, ANTEBRACO = 0.2865, 0.2577
SOBE_TORN = 0.035                    # o tornozelo do DESENHO: 3,5 cm acima do do jogo, ao longo da canela (o do Rocketbox
                                     # fica 11,8 cm acima da sola; o do jogo, 8 cm)
SOLA_Y = 0.002                       # a sola no apoio: 2 mm acima do chão
ABRE_PE = np.radians(8.0)            # o pé plantado do jogo aponta para a frente: o do desenho abre 8° (o Rocketbox, 15,7°)
INCL_PE = np.radians(17.93)          # o pé APOIADO do jogo: tornozelo → ponta, 17,9° para baixo (medido na partida)

un = lambda v: v / np.linalg.norm(v)

# ---- pontos do Rocketbox (coordenadas do jogo)
P = d['corpo_lod0_pos']; W = d['corpo_lod0_pes']
C = d['cabeca_lod0_pos']; Wc = d['cabeca_lod0_pes']
mc = Wc[:, iR['Head']] > 0.6
cab = g(C[mc])
centro_rb = np.array([(cab[:, 0].min() + cab[:, 0].max()) / 2, cab[:, 1].max() - 0.122, 0.0])
ponta_rb = {}
sola_rb = g(P[(W[:, iR['L Foot']] + W[:, iR['L Toe0']]) > 0.5])[:, 1].min()
for s, l in (('E', 'L'), ('D', 'R')):
    m = (W[:, iR[l + ' Foot']] + W[:, iR[l + ' Toe0']]) > 0.5
    q = g(P[m]); ponta_rb[s] = q[q[:, 0].argmax()]

# ---- repouso (as juntas do jogo, em pé, braços como os do Rocketbox)
J = {}
DES = {}                             # juntas do DESENHO que diferem das do jogo (ombro, cotovelo, tornozelo)
lado = {'E': -1.0, 'D': 1.0}
for s, l in (('E', 'L'), ('D', 'R')):
    dth = un(h(l + ' Calf') - h(l + ' Thigh')); dsh = un(h(l + ' Foot') - h(l + ' Calf'))
    alt = COXA * -dth[1] + CANELA * -dsh[1]
    J['quadril' + s] = np.array([0.0, TORN_Y + alt, lado[s] * QUADRIL_Z])
    J['joelho' + s] = J['quadril' + s] + COXA * dth
    J['tornozelo' + s] = J['joelho' + s] + CANELA * dsh
    r = np.array([np.cos(INCL_PE) * np.cos(ABRE_PE), -np.sin(INCL_PE), lado[s] * np.cos(INCL_PE) * np.sin(ABRE_PE)])
    J['ponta' + s] = J['tornozelo' + s] + PE * r
    DES['tornozelo' + s] = J['tornozelo' + s] + SOBE_TORN * un(J['joelho' + s] - J['tornozelo' + s])
quadrilY = (J['quadrilE'][1] + J['quadrilD'][1]) / 2
J['pelve'] = np.array([0.0, quadrilY + PELVE_SOBE, 0.0])
J['lombar'] = J['pelve'] + [0, COLUNA[0], 0]
J['peito'] = J['lombar'] + [0, COLUNA[1], 0]
J['pescoco'] = J['peito'] + [0, COLUNA[2], 0]
dpc = un(centro_rb - h('Neck'))      # pescoço → centro da cabeça, a inclinação do Rocketbox (~15° para a frente)
J['cabeca'] = J['pescoco'] + PESCOCO_CABECA * dpc
for s, l in (('E', 'L'), ('D', 'R')):
    J['ombro' + s] = J['peito'] + [0, OMBRO_SOBE, lado[s] * OMBRO_Z]
    DES['ombro' + s] = J['ombro' + s] + [0, -QUEDA, lado[s] * ABRE]
    dup = un(h(l + ' Forearm') - h(l + ' UpperArm')); dfo = un(h(l + ' Hand') - h(l + ' Forearm'))
    DES['cotovelo' + s] = DES['ombro' + s] + BRACO * dup
    J['mao' + s] = DES['cotovelo' + s] + ANTEBRACO * dfo
    # o cotovelo do JOGO no repouso: a IK do jogo com o ombro do jogo e a mesma mão, dobrando no mesmo plano
    a, b = J['ombro' + s], J['mao' + s]
    L = np.linalg.norm(b - a); L = min(L, BRACO + ANTEBRACO - 1e-4)
    x = (BRACO ** 2 - ANTEBRACO ** 2 + L ** 2) / (2 * L); y = np.sqrt(max(BRACO ** 2 - x ** 2, 0))
    eix = un(b - a); pol = DES['cotovelo' + s] - a; pol = un(pol - eix * pol.dot(eix))
    J['cotovelo' + s] = a + eix * x + pol * y

# ---- semelhança de cada osso do Rocketbox: (h, e) do Rocketbox → (H, E) do repouso
# coluna: altura do Rocketbox por trechos (quadril → ombro → base do crânio) → do jogo
cabeca_off = centro_rb - h('Head')
NOS_RB = [np.array([0.0, (h('L Thigh')[1] + h('R Thigh')[1]) / 2, 0.0]), None, h('Head')]
NOS_RB[1] = np.array([0.0, (h('L UpperArm')[1] + h('R UpperArm')[1]) / 2, 0.0])
NOS_J = [np.array([0.0, quadrilY, 0.0]), np.array([0.0, DES['ombroE'][1], 0.0]), J['cabeca'] - cabeca_off]
def coluna(p):
    y = p[1]
    if y <= NOS_RB[1][1]:
        t = (y - NOS_RB[0][1]) / (NOS_RB[1][1] - NOS_RB[0][1]); a, b, A, B = NOS_RB[0], NOS_RB[1], NOS_J[0], NOS_J[1]
    else:
        t = (y - NOS_RB[1][1]) / (NOS_RB[2][1] - NOS_RB[1][1]); a, b, A, B = NOS_RB[1], NOS_RB[2], NOS_J[1], NOS_J[2]
    base = A + (B - A) * t
    return np.array([p[0] + (base[0] - (a[0] + (b[0] - a[0]) * t)), base[1], p[2]])

def arco(a, b):
    a, b = un(a), un(b); v = np.cross(a, b); c = a.dot(b)
    if c < -0.999999: raise ValueError('arco degenerado')
    K = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + K + K @ K / (1 + c)

SEM = {}
def sem(n, hh, e, H, E, rigido=False):
    if rigido:
        SEM[n] = (hh, np.eye(3), H); return
    dd = un(e - hh); k = np.linalg.norm(E - H) / np.linalg.norm(e - hh)
    S = np.eye(3) + (k - 1) * np.outer(dd, dd)
    SEM[n] = (hh, arco(e - hh, E - H) @ S, H)
for n in ('Pelvis', 'Spine', 'Spine1', 'Spine2', 'Neck'):
    filho = {'Pelvis': 'Spine', 'Spine': 'Spine1', 'Spine1': 'Spine2', 'Spine2': 'Neck', 'Neck': 'Head'}[n]
    sem(n, h(n), h(filho), coluna(h(n)) if n != 'Pelvis' else NOS_J[0], coluna(h(filho)) if filho != 'Head' else NOS_J[2])
sem('Head', h('Head'), None, NOS_J[2], None, True)
for s, l in (('E', 'L'), ('D', 'R')):
    ch = h(l + ' Clavicle'); chJ = coluna(ch); chJ[2] = ch[2] * (OMBRO_Z + ABRE) / abs(h(l + ' UpperArm')[2])
    sem(l + ' Clavicle', ch, h(l + ' UpperArm'), chJ, DES['ombro' + s])
    sem(l + ' UpperArm', h(l + ' UpperArm'), h(l + ' Forearm'), DES['ombro' + s], DES['cotovelo' + s])
    sem(l + ' Forearm', h(l + ' Forearm'), h(l + ' Hand'), DES['cotovelo' + s], J['mao' + s])
    sem(l + ' Hand', h(l + ' Hand'), None, J['mao' + s], None, True)
    sem(l + ' Thigh', h(l + ' Thigh'), h(l + ' Calf'), J['quadril' + s], J['joelho' + s])
    sem(l + ' Calf', h(l + ' Calf'), h(l + ' Foot'), J['joelho' + s], DES['tornozelo' + s])
    # o pé (e o dedão) rígido no tornozelo do desenho, com a sola em SOLA_Y no apoio
    alt_sola = h(l + ' Foot')[1] - sola_rb
    sem(l + ' Foot', h(l + ' Foot'), None, np.array([DES['tornozelo' + s][0], SOLA_Y + alt_sola, DES['tornozelo' + s][2]]), None, True)
    SEM[l + ' Toe0'] = (SEM[l + ' Foot'][0], np.eye(3), SEM[l + ' Foot'][2])

# ---- osso do Rocketbox → osso do desenho (js/render/esqueleto.js OSSOS: 19 principais)
PARA = {'Pelvis': 0, 'Spine': 0, 'Spine1': 1, 'Spine2': 2, 'Neck': 3, 'Head': 4,
        'L Clavicle': 5, 'L UpperArm': 6, 'L Forearm': 7, 'L Hand': 8,
        'R Clavicle': 9, 'R UpperArm': 10, 'R Forearm': 11, 'R Hand': 12,
        'L Thigh': 13, 'L Calf': 14, 'L Foot': 15, 'L Toe0': 15,
        'R Thigh': 16, 'R Calf': 17, 'R Foot': 18, 'R Toe0': 18}

def encaixar(pos, nor, pes):
    pos = g(pos); nor = g(nor)
    out = np.zeros_like(pos); onr = np.zeros_like(nor)
    for n, (hh, M, H) in SEM.items():
        w = pes[:, iR[n]][:, None]
        if not w.any(): continue
        out += w * ((pos - hh) @ M.T + H)
        Mi = np.linalg.inv(M).T                           # normais: inversa transposta
        onr += w * (nor @ Mi.T)
    onr /= np.linalg.norm(onr, axis=1, keepdims=True) + 1e-12
    W19 = np.zeros((len(pos), 19), np.float32)
    for n, b in PARA.items(): W19[:, b] += pes[:, iR[n]]
    return out.astype(np.float32), onr.astype(np.float32), W19

res = {}
for chave in d.files:
    if not chave.endswith('_pos'): continue
    parte = chave[:-4]
    p, nr, w = encaixar(d[parte + '_pos'], d[parte + '_nor'], d[parte + '_pes'])
    res[parte + '_pos'] = p; res[parte + '_nor'] = nr; res[parte + '_pes19'] = w
    res[parte + '_uv'] = d[parte + '_uv']; res[parte + '_tri'] = d[parte + '_tri']
    print(f'{parte}: {len(p)} v; y {p[:, 1].min():.3f}..{p[:, 1].max():.3f}; z {p[:, 2].min():.3f}..{p[:, 2].max():.3f}')
np.savez(saida + '.npz', **res)
ORDEM = ['pelve', 'lombar', 'peito', 'pescoco', 'cabeca', 'ombroE', 'cotoveloE', 'maoE', 'ombroD', 'cotoveloD', 'maoD',
         'quadrilE', 'joelhoE', 'tornozeloE', 'pontaE', 'quadrilD', 'joelhoD', 'tornozeloD', 'pontaD']
r4 = lambda v: [round(float(x), 4) for x in v]
json.dump({
    'descricao': 'Repouso do corpo humano (tools/humano/encaixar.py): as juntas do JOGO (anim.js) em pé, x = frente, y = cima, '
                 'z = direita, origem no chão sob a pelve. desenho = as juntas que o desenho troca (ombro QUEDA abaixo e ABRE '
                 'para fora; o cotovelo pela IK com a mão do jogo; o tornozelo sobeTornozelo acima, ao longo da canela).',
    'queda': QUEDA, 'abre': ABRE, 'sobeTornozelo': SOBE_TORN, 'braco': BRACO, 'antebraco': ANTEBRACO,
    'juntas': {n: r4(J[n]) for n in ORDEM}, 'desenho': {n: r4(v) for n, v in DES.items()},
}, open(saida + '-repouso.json', 'w'), ensure_ascii=False, indent=1)
print('juntas:', {n: r4(J[n]) for n in ORDEM})
print('desenho:', {n: r4(v) for n, v in DES.items()})
print('centro da cabeça RB', r4(centro_rb), '→', r4(J['cabeca']))
