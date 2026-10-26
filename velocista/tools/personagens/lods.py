# Níveis de detalhe do corpo humano: a partir do LOD0 já encaixado e com os pesos (pesos.py), o Blender dizima por colapso
# (os grupos de vértice — os 25 ossos — e a UV são interpolados no colapso) até o alvo de triângulos de cada nível, e
# relê tudo separado nas costuras da UV. Os pesos voltam a ≤ 4 influências quantizadas em 8 bits.
#   LOD0 ≥ 280 px: a malha do Rocketbox (corpo ~5,0 mil + cabeça ~3,1 mil)   LOD1 120–280 px: ~4 mil
#   LOD2 60–120 px: ~1,8 mil                                                  LOD3 < 60 px (TV do celular): ~0,9 mil
# Uso: <python do bpy> -I lods.py <pesos.npz> <saida.npz>
import sys, bpy, numpy as np
ent, saida = sys.argv[-2], sys.argv[-1]
ALVOS = {1: {'corpo': 2500, 'cabeca': 1500, 'cabelo': 450}}          # só o LOD1 (celular): os personagens aparecem de perto
d = np.load(ent)
res = {}
PARTES = [p for p in ('corpo', 'cabeca', 'cabelo') if f'{p}_lod0_pos' in d.files]
for parte in PARTES:
    for k in ('pos', 'nor', 'uv', 'tri', 'ossos', 'pesos'): res[f'{parte}_lod0_{k}'] = d[f'{parte}_lod0_{k}']

def montar(parte):
    p = d[f'{parte}_lod0_pos']; t = d[f'{parte}_lod0_tri']; uv = d[f'{parte}_lod0_uv']
    os_ = d[f'{parte}_lod0_ossos']; ps = d[f'{parte}_lod0_pesos'].astype(np.float64) / 255
    me = bpy.data.meshes.new(parte); me.from_pydata(p.tolist(), [], t.tolist()); me.update()
    # as costuras da UV vêm separadas (vértices repetidos): junta pela posição para o colapso enxergar a malha inteira
    o = bpy.data.objects.new(parte, me); bpy.context.collection.objects.link(o)
    lu = me.uv_layers.new()
    for poly in me.polygons:
        for li, vi in zip(poly.loop_indices, poly.vertices): lu.data[li].uv = uv[vi]
    for b in range(25): o.vertex_groups.new(name=f'o{b}')
    for vi in range(len(p)):
        for k in range(4):
            if ps[vi, k] > 0: o.vertex_groups[int(os_[vi, k])].add([vi], float(ps[vi, k]), 'ADD')
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=1e-5); bpy.ops.object.mode_set(mode='OBJECT')
    o.select_set(False)
    return o

def ler(o):
    me = o.data; me.calc_loop_triangles(); uvl = me.uv_layers.active.data
    chave, pos, nor, uv, W, tri = {}, [], [], [], [], []
    for lt in me.loop_triangles:
        tt = []
        for li in lt.loops:
            vi = me.loops[li].vertex_index; u = uvl[li].uv
            k = (vi, round(u[0], 5), round(u[1], 5))
            if k not in chave:
                chave[k] = len(pos); v = me.vertices[vi]
                pos.append(v.co[:]); nor.append(me.loops[li].normal[:] if lt.use_smooth else lt.normal[:]); uv.append((u[0], u[1]))
                w = np.zeros(25)
                for g in v.groups: w[g.group] += g.weight
                W.append(w)
            tt.append(chave[k])
        tri.append(tt)
    W = np.array(W); idx = np.argsort(-W, axis=1)[:, :4]; top = np.take_along_axis(W, idx, 1)
    top /= top.sum(1, keepdims=True) + 1e-12
    q = np.floor(top * 255 + 0.5).astype(np.int32); q[:, 0] += 255 - q.sum(1)
    return (np.array(pos, np.float32), np.array(nor, np.float32), np.array(uv, np.float32), np.array(tri, np.int32),
            idx.astype(np.uint8), q.astype(np.uint8))

bpy.ops.wm.read_factory_settings(use_empty=True)
for parte in PARTES:
    base = montar(parte)
    for p in base.data.polygons: p.use_smooth = True
    n0 = len(base.data.polygons)
    for nivel, alvo in ALVOS.items():
        o = base.copy(); o.data = base.data.copy(); bpy.context.collection.objects.link(o)
        m = o.modifiers.new('dec', 'DECIMATE'); m.decimate_type = 'COLLAPSE'; m.ratio = alvo[parte] / n0
        m.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier='dec')
        r = ler(o)
        for k, v in zip(('pos', 'nor', 'uv', 'tri', 'ossos', 'pesos'), r): res[f'{parte}_lod{nivel}_{k}'] = v
        print(f'{parte} LOD{nivel}: {len(r[0])} v, {len(r[3])} tri')
np.savez(saida, **res)
print('ok', saida)
