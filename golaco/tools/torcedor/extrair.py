# Torcedor 3D (item 69, PR 2): lê um avatar Rocketbox (FBX, MIT) no Blender sem janela e grava em numpy o que o
# torcedor.py precisa — a malha original (posições, triângulos, UV do centro de cada triângulo, material, pesos nos 22
# ossos do jogo), as juntas (cabeça e cauda de cada osso) e as malhas reduzidas por Decimate (colapso, simétrico em x)
# para os 2 níveis de detalhe. O cabelo em cartões e os cílios (material de opacidade) e as peças soltas pequenas (olhos,
# dentes, língua) saem antes da redução. Coordenadas do MODELO: x = a esquerda da pessoa, y para cima, z para a frente
# (o Blender: x = X, y = Z, z = −Y; o Rocketbox olha para −Y).
# Uso: python -I extrair.py <avatar.fbx> <saida.npz> <tri_lod0> <tri_lod1>   (o Python do bpy: veja o README)
import sys, bpy, bmesh, numpy as np

arq, saida = sys.argv[-4], sys.argv[-3]
ALVOS = [int(sys.argv[-2]), int(sys.argv[-1])]
FATOR = float(__import__('os').environ.get('TORC_FATOR', '3.0'))   # a força da proteção das dobras (o grupo invertido: o Decimate reduz onde o peso é baixo)

FICA = ['Bip01 Pelvis', 'Bip01 Spine', 'Bip01 Spine1', 'Bip01 Spine2', 'Bip01 Neck', 'Bip01 Head',
        'Bip01 L Clavicle', 'Bip01 L UpperArm', 'Bip01 L Forearm', 'Bip01 L Hand',
        'Bip01 R Clavicle', 'Bip01 R UpperArm', 'Bip01 R Forearm', 'Bip01 R Hand',
        'Bip01 L Thigh', 'Bip01 L Calf', 'Bip01 L Foot', 'Bip01 L Toe0',
        'Bip01 R Thigh', 'Bip01 R Calf', 'Bip01 R Foot', 'Bip01 R Toe0']

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=arq, automatic_bone_orientation=False)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
malha = next(o for o in bpy.data.objects if o.type == 'MESH')
MW = arm.matrix_world

def modelo(v):
    return (v[0], v[2], -v[1])

def ancestral(nome):
    b = arm.data.bones.get(nome)
    while b is not None and b.name not in FICA:
        b = b.parent
    return b.name if b else 'Bip01 Pelvis'

# 1) pesos nos 22 ossos (o grupo de um osso que sai vai para o ancestral que fica)
idx_nome = {g.index: g.name for g in malha.vertex_groups}
novos = {}
for v in malha.data.vertices:
    acc = {}
    for g in v.groups:
        n = idx_nome.get(g.group)
        if n is None or g.weight <= 0: continue
        alvo = n if n in FICA else ancestral(n)
        acc[alvo] = acc.get(alvo, 0.0) + g.weight
    s = sum(acc.values()) or 1.0
    novos[v.index] = {n: w / s for n, w in acc.items()}
for g in list(malha.vertex_groups):
    malha.vertex_groups.remove(g)
grupos = {n: malha.vertex_groups.new(name=n) for n in FICA}
for vi, d in novos.items():
    for n, w in d.items():
        grupos[n].add([vi], w, 'REPLACE')

# 2) fora: o material de opacidade (cabelo em cartões, cílios) e as peças soltas pequenas (olhos, dentes, língua)
bpy.context.view_layer.objects.active = malha
bpy.ops.object.mode_set(mode='EDIT')
bm = bmesh.from_edit_mesh(malha.data)
mats = [m.name if m else '' for m in malha.data.materials]
fora = [f for f in bm.faces if 'opacity' in mats[f.material_index]]
bmesh.ops.delete(bm, geom=fora, context='FACES')
# peças soltas
bm.verts.ensure_lookup_table()
visto, pecas = set(), []
for v0 in bm.verts:
    if v0.index in visto: continue
    pilha, comp = [v0], []
    visto.add(v0.index)
    while pilha:
        v = pilha.pop(); comp.append(v)
        for e in v.link_edges:
            o = e.other_vert(v)
            if o.index not in visto: visto.add(o.index); pilha.append(o)
    pecas.append(comp)
pecas.sort(key=len, reverse=True)
print('PECAS', [len(p) for p in pecas[:12]])
tot = sum(len(p) for p in pecas)
apaga = [v for p in pecas if len(p) < 0.03 * tot for v in p]
bmesh.ops.delete(bm, geom=apaga, context='VERTS')
# a costura do pescoço (a cabeça e o corpo são peças separadas que se encostam): solda
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0025)
bmesh.update_edit_mesh(malha.data)
bpy.ops.object.mode_set(mode='OBJECT')

def tri(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)

def dados(o, com_uv):
    me = o.data
    me.calc_loop_triangles()
    mw = o.matrix_world
    gid = {g.index: FICA.index(g.name) for g in o.vertex_groups if g.name in FICA}
    pos = np.array([modelo(mw @ v.co) for v in me.vertices], np.float32)
    pes = np.zeros((len(me.vertices), len(FICA)), np.float32)
    for v in me.vertices:
        for g in v.groups:
            if g.group in gid: pes[v.index, gid[g.group]] += g.weight
    s = pes.sum(1, keepdims=True); s[s == 0] = 1
    pes /= s
    tris = np.array([[me.loops[li].vertex_index for li in lt.loops] for lt in me.loop_triangles], np.int32)
    mat = np.array([lt.material_index for lt in me.loop_triangles], np.int32)
    out = {'pos': pos, 'tri': tris, 'pes': pes, 'mat': mat}
    if com_uv:
        uvl = me.uv_layers.active.data
        out['uv'] = np.array([[tuple(uvl[li].uv) for li in lt.loops] for lt in me.loop_triangles], np.float32)
    return out

out = {}
hi = dados(malha, True)
for k, v in hi.items(): out['hi_' + k] = v
out['materiais'] = np.array([m.name if m else '' for m in malha.data.materials])
print('HI', len(hi['pos']), 'v', len(hi['tri']), 'tri')

# 3) os níveis de detalhe (Decimate colapso, simétrico em x; o modificador de armadura fica depois). As DOBRAS (joelho,
#    cotovelo, punho, tornozelo, quadril, ombro) ficam protegidas por um grupo de vértices: sem elas, a perna do nível 1
#    virava um tubo reto que não dobra no sentado (a cunha da coxa à canela)
R_DOBRA = float(__import__('os').environ.get('TORC_RAIO', '0.09'))   # m: o raio da dobra protegida (o anel do joelho e do cotovelo)
DOBRAS = {'Bip01 L Calf': R_DOBRA, 'Bip01 R Calf': R_DOBRA, 'Bip01 L Forearm': R_DOBRA * 0.85, 'Bip01 R Forearm': R_DOBRA * 0.85}
gd = malha.vertex_groups.new(name='dobras')
mwm = malha.matrix_world
for v in malha.data.vertices:
    p = mwm @ v.co
    w = 0.0
    for n, r in DOBRAS.items():
        j = MW @ arm.data.bones[n].head_local
        dd = (p - j).length
        if dd < 2 * r: w = max(w, 1.0 - max(0.0, dd - r) / r)
    if w > 0: gd.add([v.index], w, 'REPLACE')
# nível 0 direto da malha original; nível 1 a partir do nível 0 (as dobras do nível 0 têm poucos vértices: protegê-las
# custa pouco; na original o anel do joelho tem dezenas e o Decimate não chegava a 120 triângulos)
fonte, base = malha, tri(malha)
for k, alvo in enumerate(ALVOS):
    d = fonte.copy(); d.data = fonte.data.copy(); bpy.context.collection.objects.link(d)
    m = d.modifiers.new('dec', 'DECIMATE'); m.decimate_type = 'COLLAPSE'
    m.ratio = alvo / tri(fonte)
    m.use_collapse_triangulate = True
    m.use_symmetry = True; m.symmetry_axis = 'X'
    if k > 0:
        m.vertex_group = 'dobras'; m.invert_vertex_group = True; m.vertex_group_factor = FATOR
    bpy.context.view_layer.objects.active = d
    while d.modifiers[0].name != 'dec':
        bpy.ops.object.modifier_move_up(modifier='dec')
    bpy.ops.object.modifier_apply(modifier='dec')
    lo = dados(d, False)
    for kk, v in lo.items(): out[f'lod{k}_' + kk] = v
    print(f'LOD{k}', len(lo['pos']), 'v', len(lo['tri']), 'tri')
    fonte = d

# 4) as juntas: cabeça e cauda de cada osso que fica e o pai
out['ossos'] = np.array(FICA)
out['cabecas'] = np.array([modelo(MW @ arm.data.bones[n].head_local) for n in FICA], np.float32)
out['caudas'] = np.array([modelo(MW @ arm.data.bones[n].tail_local) for n in FICA], np.float32)
out['pais'] = np.array([FICA.index(ancestral(arm.data.bones[n].parent.name)) if arm.data.bones[n].parent and n != 'Bip01 Pelvis' else -1 for n in FICA], np.int32)
np.savez(saida, **out)
print('ok', saida)
