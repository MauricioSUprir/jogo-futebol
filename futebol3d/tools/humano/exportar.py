# Exporta o corpo masculino realista dos "Human Base Meshes" do Blender Studio (CC0) para numpy:
# malha base + 1 nível de detalhe (multires), olhos, em metros, y para cima, 1,80 m, pés no chão.
import bpy, bmesh, numpy as np, sys
SRC = sys.argv[sys.argv.index('--') + 1]; OUT = sys.argv[sys.argv.index('--') + 2]; LEVEL = int(sys.argv[sys.argv.index('--') + 3])
bpy.ops.wm.open_mainfile(filepath=SRC)
dg = bpy.context.evaluated_depsgraph_get()
def grab(name, level):
    o = bpy.data.objects[name]
    for m in o.modifiers:
        if m.type == 'MULTIRES': m.levels = level; m.render_levels = level
    dg.update()
    oe = o.evaluated_get(dg); me = oe.to_mesh()
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.triangulate(bm, faces=bm.faces[:]); bm.to_mesh(me); bm.free()
    M = np.array(o.matrix_world)
    v = np.array([(M @ np.append(np.array(p.co), 1))[:3] for p in me.vertices])
    f = np.array([[l for l in p.vertices] for p in me.polygons])
    oe.to_mesh_clear()
    return v, f
body = 'GEO-body_male_realistic'
vb, fb = grab(body, LEVEL)
eyes = [grab(n, 0) for n in (body + '.eye.L', body + '.eye.R')]
# Blender: z para cima, -y para a frente → jogo: y para cima, +z para a frente, +x = esquerda do boneco
def conv(v): return np.stack([-v[:, 0], v[:, 2], -v[:, 1]], axis=1)
vb = conv(vb); eyes = [(conv(v), f) for v, f in eyes]
lo = vb[:, 1].min(); h = vb[:, 1].max() - lo; k = 1.80 / h
cx, cz = vb[:, 0].mean(), 0.0
def norm(v): return np.stack([(v[:, 0] - cx) * k, (v[:, 1] - lo) * k, v[:, 2] * k], axis=1)
vb = norm(vb); eyes = [(norm(v), f) for v, f in eyes]
np.savez(OUT, vb=vb, fb=fb, ve0=eyes[0][0], fe0=eyes[0][1], ve1=eyes[1][0], fe1=eyes[1][1])
print('corpo', vb.shape, fb.shape, 'altura', vb[:, 1].max().round(3), 'escala', round(k, 3), 'frente(z) max', vb[:, 2].max().round(3))
