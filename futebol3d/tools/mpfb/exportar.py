# Exporta do MPFB 2 (MakeHuman, CC0) os dados crus do jogador para numpy:
#  - corpo masculino atlético em 3 variações (africana, europeia, asiática) — mesma topologia,
#    usadas como "morphs" no jogo; UV; pesos do rig game_engine somados nos 17 ossos do jogo;
#  - olhos, sobrancelhas e cabelos (malhas ajustadas à cabeça) com UV.
# Coordenadas já no jogo: x = esquerda do boneco, y = cima, z = frente (metros).
import bpy, bmesh, addon_utils, importlib, numpy as np, sys
addon_utils.enable('bl_ext.user_default.mpfb', default_set=True)
S = lambda m, c: getattr(importlib.import_module('bl_ext.user_default.mpfb.services.' + m), c)
HS, TS, AS = S('humanservice', 'HumanService'), S('targetservice', 'TargetService'), S('assetservice', 'AssetService')
OUT = sys.argv[1]
MAP = {'Root': 0, 'pelvis': 0, 'spine_01': 1, 'spine_02': 1, 'spine_03': 2, 'clavicle_l': 2, 'clavicle_r': 2, 'neck_01': 3, 'head': 4,
       'upperarm_l': 5, 'lowerarm_l': 6, 'hand_l': 7, 'upperarm_r': 8, 'lowerarm_r': 9, 'hand_r': 10,
       'thigh_l': 11, 'calf_l': 12, 'foot_l': 13, 'ball_l': 13, 'thigh_r': 14, 'calf_r': 15, 'foot_r': 16, 'ball_r': 16}
def bone17(name):
    if name in MAP: return MAP[name]
    for k in ('index', 'middle', 'pinky', 'ring', 'thumb'):
        if name.startswith(k): return 7 if name.endswith('_l') else 10
    return None
G = lambda v: np.stack([v[:, 0], v[:, 2], -v[:, 1]], axis=1)       # blender → jogo
HAIRS = ['short01', 'short02', 'short03', 'short04', 'afro01', 'long01', 'ponytail01']

def human(race):
    for o in list(bpy.data.objects): bpy.data.objects.remove(o)
    mac = TS.get_default_macro_info_dict()
    mac.update({'gender': 1.0, 'age': 0.5, 'muscle': 0.75, 'weight': 0.45, 'height': 0.55, 'proportions': 0.85})
    mac['race'] = race
    b = HS.create_human(macro_detail_dict=mac)
    HS.add_builtin_rig(b, 'game_engine')
    return b

def mesh_data(obj, groups=True):
    dg = bpy.context.evaluated_depsgraph_get(); dg.update()
    # sem o modificador de armadura (pose de repouso), com a máscara dos ajudantes
    arm = [m for m in obj.modifiers if m.type == 'ARMATURE']
    for m in arm: m.show_viewport = False
    dg.update()
    oe = obj.evaluated_get(dg); me = oe.to_mesh()
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.triangulate(bm, faces=bm.faces[:]); bm.to_mesh(me); bm.free()
    M = np.array(obj.matrix_world)
    P = np.array([(M @ np.append(np.array(v.co), 1))[:3] for v in me.vertices])
    uvl = me.uv_layers.active.data
    W = None
    if groups:
        names = {g.index: g.name for g in obj.vertex_groups}
        W = np.zeros((len(me.vertices), 17))
        for v in me.vertices:
            for g in v.groups:
                b = bone17(names.get(g.group, ''))
                if b is not None: W[v.index, b] += g.weight
    # vértice único por (posição, uv)
    key = {}; vidx = []; uvs = []; F = []
    for p in me.polygons:
        tri = []
        for li in p.loop_indices:
            vi = me.loops[li].vertex_index; uv = tuple(np.round(uvl[li].uv, 5))
            k = (vi, uv)
            if k not in key: key[k] = len(vidx); vidx.append(vi); uvs.append(uv)
            tri.append(key[k])
        F.append(tri)
    oe.to_mesh_clear()
    for m in arm: m.show_viewport = True
    vidx = np.array(vidx)
    mesh_data.raw = G(P); mesh_data.vidx = vidx
    return G(P[vidx]), np.array(uvs, np.float32), np.array(F, np.int64), (W[vidx] if W is not None else None)

out = {}
races = {'af': {'african': 1, 'caucasian': 0, 'asian': 0}, 'eu': {'african': 0, 'caucasian': 1, 'asian': 0}, 'as': {'african': 0, 'caucasian': 0, 'asian': 1}}
for rk, race in races.items():
    b = human(race)
    P, UV, F, W = mesh_data(b)
    out['raw_' + rk] = mesh_data.raw
    if rk == 'eu': out['vidx'] = mesh_data.vidx
    # acessórios em todas as variações (o rosto muda de forma; olhos e cabelo acompanham)
    for sub, f, t, key in [('eyes', 'low-poly.mhclo', 'Eyes', 'eyes'), ('eyebrows', 'eyebrow001.mhclo', 'Eyebrows', 'brows')] + [('hair', h + '.mhclo', 'Hair', 'hair_' + h) for h in HAIRS]:
        p = AS.find_asset_absolute_path(f, asset_subdir=sub)
        before = set(bpy.data.objects)
        HS.add_mhclo_asset(p, b, asset_type=t, material_type='GAMEENGINE')
        new = [o for o in bpy.data.objects if o not in before and o.type == 'MESH'][0]
        Pa, UVa, Fa, _ = mesh_data(new, groups=False)
        out[key + '_p_' + rk] = Pa
        if rk == 'eu': out[key + '_uv'] = UVa; out[key + '_f'] = Fa
        bpy.data.objects.remove(new)
    if rk == 'eu':
        out['uv'] = UV; out['faces'] = F; out['w'] = W
        arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
        out['bones'] = np.array([[*G(np.array([arm.matrix_world @ bn.head_local]))[0]] for bn in arm.data.bones])
        out['bone_names'] = np.array([bn.name for bn in arm.data.bones])
    print(rk, P.shape, F.shape if rk == 'eu' else '')
np.savez(OUT, **out)
print('salvo', OUT, sorted(out.keys()))
