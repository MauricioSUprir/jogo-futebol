# Lê do GLB do Rocketbox (o de rocketbox_glb.py: 22 ossos, ≤ 4 influências) as malhas para o encaixe, em numpy: posições e
# normais no MUNDO (m), UV, triângulos e pesos por osso do Rocketbox; e as juntas do Rocketbox (cabeça de cada osso, o
# centro da cabeça e a ponta de cada pé). Os vértices são separados nas costuras da UV (um vértice por par posição+UV),
# como a GPU precisa. Sem textura.
# Uso: python -I extrair.py <lods.glb> <saida.npz>   (rodar com o Python do bpy: blender --python ou o venv do bpy)
import sys, bpy, numpy as np
glb, saida = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
NOMES = [b.name for b in arm.data.bones]
MW = arm.matrix_world
out = {'ossos': np.array(NOMES), 'cabecas_ossos': np.array([(MW @ b.head_local)[:] for b in arm.data.bones])}
for o in [o for o in bpy.data.objects if o.type == 'MESH' and o.name.split('_')[0] in ('corpo', 'cabeca')]:
    me = o.data
    me.calc_loop_triangles()
    mw = o.matrix_world
    nm = mw.to_3x3().inverted().transposed()
    uvl = me.uv_layers.active.data
    gid = {g.index: NOMES.index(g.name) for g in o.vertex_groups if g.name in NOMES}
    chave, pos, nor, uv, pes, tri = {}, [], [], [], [], []
    me_loops = me.loops
    for lt in me.loop_triangles:
        t = []
        for li in lt.loops:
            vi = me_loops[li].vertex_index
            u = uvl[li].uv
            k = (vi, round(u[0], 5), round(u[1], 5))
            if k not in chave:
                chave[k] = len(pos)
                v = me.vertices[vi]
                pos.append((mw @ v.co)[:])
                n = (nm @ me_loops[li].normal).normalized() if lt.use_smooth else (nm @ lt.normal).normalized()
                nor.append(n[:])
                uv.append((u[0], u[1]))
                w = np.zeros(len(NOMES), np.float32)
                for g in v.groups:
                    if g.group in gid: w[gid[g.group]] += g.weight
                s = w.sum()
                pes.append(w / s if s > 0 else w)
            t.append(chave[k])
        tri.append(t)
    nome = o.name.split('.')[0]
    out[nome + '_pos'] = np.array(pos, np.float32); out[nome + '_nor'] = np.array(nor, np.float32)
    out[nome + '_uv'] = np.array(uv, np.float32); out[nome + '_pes'] = np.array(pes, np.float32)
    out[nome + '_tri'] = np.array(tri, np.int32)
    print(nome, len(pos), 'vértices', len(tri), 'triângulos')
np.savez(saida, **out)
print('ok', saida)
