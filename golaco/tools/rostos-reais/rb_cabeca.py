# Cabeça do Rocketbox (descanso): render ortográfico de frente com a textura (para os marcos do MediaPipe) e a malha em
# triângulos (posição no mundo + UV) para achar, por raio, o ponto da UV de cada marco.
# Uso: python -I rb_cabeca.py <lods.glb> <head_color.tga> <saida_png> <saida_npz>
import sys, bpy, math, mathutils, numpy as np
glb, tex, png, npz = sys.argv[1:5]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
for o in list(bpy.data.objects):
    if o.type == 'MESH' and o.name != 'cabeca_lod0': bpy.data.objects.remove(o)
c0 = bpy.data.objects['cabeca_lod0']
bpy.context.view_layer.update()
mw = c0.matrix_world.copy(); c0.parent = None; c0.modifiers.clear(); c0.matrix_world = mw
bpy.context.view_layer.update()
img = bpy.data.images.load(tex)
m = bpy.data.materials.new('m'); m.use_nodes = True
nt = m.node_tree; b = nt.nodes['Principled BSDF']; t = nt.nodes.new('ShaderNodeTexImage'); t.image = img
nt.links.new(t.outputs['Color'], b.inputs['Base Color']); b.inputs['Roughness'].default_value = 0.6
c0.data.materials.clear(); c0.data.materials.append(m)
for p in c0.data.polygons: p.use_smooth = True
# triângulos no mundo + UV por canto
me = c0.data; me.calc_loop_triangles()
uvl = me.uv_layers.active.data
P = np.array([(c0.matrix_world @ v.co)[:] for v in me.vertices])
tri = np.array([lt.vertices[:] for lt in me.loop_triangles])
tuv = np.array([[uvl[li].uv[:] for li in lt.loops] for lt in me.loop_triangles])
xs, ys, zs = P[:, 0], P[:, 1], P[:, 2]
# o rosto olha para −Y: câmera ortográfica em frente, enquadrando a cabeça
cx, cz = (xs.min() + xs.max()) / 2, (zs.min() + zs.max()) / 2
esc = max(xs.max() - xs.min(), zs.max() - zs.min()) * 1.05
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); bpy.context.collection.objects.link(cam)
cam.data.type = 'ORTHO'; cam.data.ortho_scale = esc
cam.location = (cx, ys.min() - 1.0, cz); cam.rotation_euler = (math.radians(90), 0, 0)
bpy.context.scene.camera = cam
w = bpy.data.worlds.new('w'); bpy.context.scene.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.9, 0.9, 0.9, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 1.0
s = bpy.data.objects.new('sol', bpy.data.lights.new('sol', 'SUN')); bpy.context.collection.objects.link(s)
s.rotation_euler = (math.radians(90), 0, 0); s.data.energy = 1.5
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 24
R = 1024; sc.render.resolution_x = R; sc.render.resolution_y = R; sc.render.filepath = png
sc.view_settings.view_transform = 'Standard'
bpy.ops.render.render(write_still=True)
np.savez(npz, P=P, tri=tri, tuv=tuv, cx=cx, cz=cz, esc=esc, R=R)
print('ok', len(tri), 'triangulos', 'escala', esc)
