# Captura de movimento (CMU Graphics Lab Motion Capture Database, mocap.cs.cmu.edu — uso livre;
# conversão BVH de cgspeed/Bruce Hahne, cópia em github.com/una-dinosauria/cmu-mocap).
# Lê BVH de corrida/caminhada, acha UM ciclo de passada (do apoio do pé esquerdo ao próximo),
# reaproveita no esqueleto de 17 ossos do jogo casando a DIREÇÃO de cada osso (pelve e peito
# por base completa) e salva quatérnios locais por osso, 32 amostras por ciclo.
# Saída: assets/mocap/locomocao.json   Uso: python3 retarget.py arq1.bvh:nome arq2.bvh:nome ...
import sys, json, os, math
import numpy as np

def parse(path):
    tok = open(path).read().split()
    i = 0; joints = []; stack = []
    def nxt():
        nonlocal i; i += 1; return tok[i - 1]
    while True:
        t = nxt()
        if t in ('ROOT', 'JOINT'):
            name = nxt(); nxt()  # {
            j = {'name': name, 'parent': stack[-1] if stack else -1, 'offset': None, 'ch': []}
            joints.append(j); stack.append(len(joints) - 1)
        elif t == 'End':
            nxt(); nxt()
            assert nxt() == 'OFFSET'; off = [float(nxt()) for _ in range(3)]; nxt()
            joints[stack[-1]]['end'] = np.array(off)
        elif t == 'OFFSET':
            joints[stack[-1]]['offset'] = np.array([float(nxt()) for _ in range(3)])
        elif t == 'CHANNELS':
            n = int(nxt()); joints[stack[-1]]['ch'] = [nxt() for _ in range(n)]
        elif t == '}':
            stack.pop()
        elif t == 'MOTION':
            break
    nxt(); nf = int(nxt()); nxt(); nxt(); ft = float(nxt())
    data = np.array([float(x) for x in tok[i:]]).reshape(nf, -1)
    data = data[1:]          # o 1º quadro das conversões cgspeed é a pose T de referência
    return joints, data, ft

def rot(axis, deg):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)
    if axis == 'X': return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
    if axis == 'Y': return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])

def fk(joints, data):
    nf = len(data); P = np.zeros((nf, len(joints), 3)); W = np.zeros((nf, len(joints), 3, 3))
    for f in range(nf):
        k = 0
        for j, J in enumerate(joints):
            R = np.eye(3); pos = J['offset'].copy()
            for c in J['ch']:
                v = data[f, k]; k += 1
                if c.endswith('position'): pos[{'X': 0, 'Y': 1, 'Z': 2}[c[0]]] = v
                else: R = R @ rot(c[0], v)
            if J['parent'] < 0: W[f, j] = R; P[f, j] = pos
            else:
                pw = W[f, J['parent']]; W[f, j] = pw @ R; P[f, j] = P[f, J['parent']] + pw @ J['offset']
    return P, W

def nrm(v): return v / (np.linalg.norm(v) + 1e-9)
def basis(left, up):
    y = nrm(up); x = nrm(left - y * np.dot(left, y)); z = np.cross(x, y)
    return np.stack([x, y, z], axis=1)          # colunas = eixos do osso no mundo
def swing(a, b):
    a, b = nrm(a), nrm(b); v = np.cross(a, b); c = np.dot(a, b)
    if c < -0.9999: return -np.eye(3)
    K = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + K + K @ K / (1 + c)
def quat(M):
    t = np.trace(M)
    if t > 0:
        s = math.sqrt(t + 1) * 2; return [(M[2, 1] - M[1, 2]) / s, (M[0, 2] - M[2, 0]) / s, (M[1, 0] - M[0, 1]) / s, 0.25 * s]
    i = int(np.argmax([M[0, 0], M[1, 1], M[2, 2]]))
    if i == 0: s = math.sqrt(1 + M[0, 0] - M[1, 1] - M[2, 2]) * 2; return [0.25 * s, (M[0, 1] + M[1, 0]) / s, (M[0, 2] + M[2, 0]) / s, (M[2, 1] - M[1, 2]) / s]
    if i == 1: s = math.sqrt(1 + M[1, 1] - M[0, 0] - M[2, 2]) * 2; return [(M[0, 1] + M[1, 0]) / s, 0.25 * s, (M[1, 2] + M[2, 1]) / s, (M[0, 2] - M[2, 0]) / s]
    s = math.sqrt(1 + M[2, 2] - M[0, 0] - M[1, 1]) * 2; return [(M[0, 2] + M[2, 0]) / s, (M[1, 2] + M[2, 1]) / s, 0.25 * s, (M[1, 0] - M[0, 1]) / s]

# esqueleto do jogo: ordem dos ossos, pai, direção de repouso (para o filho)
PARENT = [-1, 0, 1, 2, 3, 2, 5, 6, 2, 8, 9, 0, 11, 12, 0, 14, 15]
REST = {1: (0, 0.2, 0), 2: (0, 0.27, -0.012), 3: (0, 0.09, 0.012), 4: (0, 1, 0.1), 5: (0, -0.3, 0), 6: (0, -0.26, 0), 7: (0, -1, 0),
        8: (0, -0.3, 0), 9: (0, -0.26, 0), 10: (0, -1, 0), 11: (0, -0.44, 0), 12: (0, -0.42, 0), 13: (0, -0.45, 1),
        14: (0, -0.44, 0), 15: (0, -0.42, 0), 16: (0, -0.45, 1)}
# osso do jogo -> (articulação de origem, de destino) no BVH
DIR = {1: ('LowerBack', 'Spine'), 3: ('Neck1', 'Head'), 4: ('Head', '@Head'),
       5: ('LeftArm', 'LeftForeArm'), 6: ('LeftForeArm', 'LeftHand'), 7: ('LeftHand', 'LeftFingerBase'),
       8: ('RightArm', 'RightForeArm'), 9: ('RightForeArm', 'RightHand'), 10: ('RightHand', 'RightFingerBase'),
       11: ('LeftUpLeg', 'LeftLeg'), 12: ('LeftLeg', 'LeftFoot'), 13: ('LeftFoot', 'LeftToeBase'),
       14: ('RightUpLeg', 'RightLeg'), 15: ('RightLeg', 'RightFoot'), 16: ('RightFoot', 'RightToeBase')}
N = 32

def process(path):
    joints, data, ft = parse(path)
    P, W = fk(joints, data)
    J = {j['name']: k for k, j in enumerate(joints)}
    pos = lambda n: P[:, J[n]]
    # ponta da cabeça (End Site)
    hk = J['Head']; head_end = np.array([P[f, hk] + W[f, hk] @ joints[hk].get('end', np.array([0, 2, 0])) for f in range(len(P))])
    leg = np.linalg.norm(joints[J['LeftLeg']]['offset']) + np.linalg.norm(joints[J['LeftFoot']]['offset'])
    scale = 0.86 / leg
    # contatos do pé esquerdo: mínimos de altura com velocidade horizontal baixa
    ly = pos('LeftFoot')[:, 1]; ground = min(ly.min(), pos('RightFoot')[:, 1].min())
    vel = np.linalg.norm(np.diff(pos('LeftFoot')[:, [0, 2]], axis=0), axis=1) / ft * scale
    vel = np.append(vel, vel[-1])
    # pouso do pé: quando a altura do tornozelo cai abaixo de 4 cm do mínimo dele (descendo)
    lmin = ly.min()
    low = (ly - lmin) * scale < 0.04
    starts = [f for f in range(2, len(ly)) if low[f] and not low[f - 1]]
    if len(starts) >= 2:
        # ciclo mais central
        mid = len(ly) / 2; k = min(range(len(starts) - 1), key=lambda i: abs((starts[i] + starts[i + 1]) / 2 - mid))
        f0, f1 = starts[k], starts[k + 1]
    else:
        # clipe curto: um só pouso esquerdo; a duração vem do pouso direito (meio ciclo)
        ry = pos('RightFoot')[:, 1]; rlow = (ry - ry.min()) * scale < 0.04
        rs = [f for f in range(2, len(ry)) if rlow[f] and not rlow[f - 1]]
        if not starts or not rs: raise SystemExit(f'{path}: poucos apoios')
        l0 = starts[0]; r0 = min(rs, key=lambda f: abs(f - l0)); T = 2 * abs(r0 - l0)
        if l0 + T < len(ly): f0, f1 = l0, l0 + T
        elif l0 - T >= 1: f0, f1 = l0 - T, l0
        else: raise SystemExit(f'{path}: ciclo não cabe')
    hips = pos('Hips')
    travel = hips[f1, [0, 2]] - hips[f0, [0, 2]]
    dur = (f1 - f0) * ft; speed = np.linalg.norm(travel) * scale / dur
    yaw = math.atan2(travel[0], travel[1])           # direção da corrida (do eixo +z)
    Ry = rot('Y', -math.degrees(yaw))                 # tira a direção: corre para +z
    out = sample(P, J, head_end, Ry, ground, scale, f0, f1, N)
    return {'speed': round(float(speed), 3), 'cycle': round(float(speed * dur), 3), 'dur': round(dur, 3), 'frames': out}

def sample(P, J, head_end, Ry, ground, scale, f0, f1, N, closed=True):
    out = []
    pos = lambda n: P[:, J[n]]
    for s in range(N):
        u = f0 + (f1 - f0) * s / (N if closed else N - 1); fa = int(u); w = u - fa; fb = min(fa + 1, len(P) - 1)
        L = lambda n: Ry @ (pos(n)[fa] * (1 - w) + pos(n)[fb] * w)
        G = {n: L(n) for n in J}; G['@Head'] = Ry @ (head_end[fa] * (1 - w) + head_end[fb] * w)
        Wd = [None] * 17; Q = [None] * 17
        Wd[0] = basis(G['LeftUpLeg'] - G['RightUpLeg'], G['Spine'] - G['Hips'] + (G['Spine1'] - G['Spine']))
        Q[0] = quat(Wd[0])
        for b in range(1, 17):
            pw = Wd[PARENT[b]]
            if b == 2:      # peito: base completa (ombros + coluna)
                Wb = basis(G['LeftArm'] - G['RightArm'], G['Neck1'] - G['Spine'])   # Neck = Spine1 no CMU: usa Neck1
                Lb = pw.T @ Wb
            else:
                a, c = DIR[b]
                d = G[c] - G[a]
                Lb = swing(np.array(REST[b], float), pw.T @ d)
                Wb = pw @ Lb
            Wd[b] = Wb; Q[b] = quat(Lb)
        # altura da pelve do jogo: quadris (coxas) do BVH acima do chão + 3 cm
        hipY = ((G['LeftUpLeg'][1] + G['RightUpLeg'][1]) / 2 - ground) * scale + 0.03 + 0.07
        out.append({'q': [round(v, 4) for qq in Q for v in qq], 'y': round(float(hipY), 4)})
    return out

# chute (não cíclico): janela em volta do contato (pico de velocidade do bico direito),
# com o contato em u = CONTATO e duração DUR — iguais a ANIM.kick do jogo
def kick(path, DUR=0.5, CONTATO=0.42, NK=30):
    joints, data, ft = parse(path)
    P, W = fk(joints, data)
    J = {j['name']: k for k, j in enumerate(joints)}
    hk = J['Head']; head_end = np.array([P[f, hk] + W[f, hk] @ joints[hk].get('end', np.array([0, 2, 0])) for f in range(len(P))])
    leg = np.linalg.norm(joints[J['LeftLeg']]['offset']) + np.linalg.norm(joints[J['LeftFoot']]['offset'])
    scale = 0.86 / leg
    toe = P[:, J['RightToeBase']]
    v = np.linalg.norm(np.diff(toe, axis=0), axis=1); c = int(np.argmax(v))
    # direção do corpo no contato (frente da pelve), não a do pé: o chute vem na diagonal
    lft = P[c, J['LeftUpLeg']] - P[c, J['RightUpLeg']]
    fwd = np.cross(lft, np.array([0.0, 1.0, 0.0]))     # esquerda × cima = frente
    yaw = math.atan2(fwd[0], fwd[2])
    Ry = rot('Y', -math.degrees(yaw))
    ground = P[:, J['LeftFoot'], 1][c - 60:c + 60].min()
    f0 = c - CONTATO * DUR / ft; f1 = c + (1 - CONTATO) * DUR / ft
    fr = sample(P, J, head_end, Ry, ground, scale, f0, f1, NK, closed=False)
    print('chute', path.split('/')[-1], 'contato no quadro', c, '| bico', round(float(v[c] / ft * scale), 1), 'm/s')
    return {'dur': DUR, 'contact': CONTATO, 'frames': fr}

clips = {}; chute = None
for a in sys.argv[1:]:
    f, name = a.split(':')
    if name == 'chute': chute = kick(f); continue
    c = process(f); clips[name] = c
    print(name, 'velocidade', c['speed'], 'm/s | ciclo', c['cycle'], 'm em', c['dur'], 's | pelve', min(x['y'] for x in c['frames']), '-', max(x['y'] for x in c['frames']))
dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets', 'mocap', 'locomocao.json')
json.dump({'fonte': 'CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu), uso livre', 'n': N,
           'clips': sorted(clips.values(), key=lambda c: c['speed']), 'kick': chute}, open(dst, 'w'), separators=(',', ':'))
print('salvo', dst, os.path.getsize(dst), 'bytes')
