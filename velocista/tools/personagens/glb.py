# Converte um avatar Rocketbox (FBX, MIT) num GLB enxuto para o GOLAÇO:
#  - esqueleto reduzido a 22 ossos (os do anim.js + clavículas e dedão do pé); pesos dos ossos tirados
#    (dedos, rosto, olhos) somados no ancestral que fica; no máximo 4 influências por vértice, normalizadas;
#  - corpo e cabeça (+ cabelo com transparência) em malhas separadas (a cabeça pode ser trocada);
#  - LOD0 = a malha original (~8 mil tri), LOD1 = Decimate (colapso) para a TV (~1,5–2 mil tri);
#  - sem texturas dentro (as texturas viram WebP/JPG à parte; o uniforme é pintado no shader por região).
# Uso: python -I rocketbox_glb.py <entrada.fbx> <saida_prefixo> [alvo_tri_lod1=1800]
import sys, bpy, bmesh

arq, saida = sys.argv[1], sys.argv[2]
alvo1 = int(sys.argv[3]) if len(sys.argv) > 3 else 1800

FICA = ['Bip01 Pelvis', 'Bip01 Spine', 'Bip01 Spine1', 'Bip01 Spine2', 'Bip01 Neck', 'Bip01 Head',
        'Bip01 L Clavicle', 'Bip01 L UpperArm', 'Bip01 L Forearm', 'Bip01 L Hand',
        'Bip01 R Clavicle', 'Bip01 R UpperArm', 'Bip01 R Forearm', 'Bip01 R Hand',
        'Bip01 L Thigh', 'Bip01 L Calf', 'Bip01 L Foot', 'Bip01 L Toe0',
        'Bip01 R Thigh', 'Bip01 R Calf', 'Bip01 R Foot', 'Bip01 R Toe0']

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=arq, automatic_bone_orientation=False)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
malha = next(o for o in bpy.data.objects if o.type == 'MESH')

# 1) pesos: cada grupo de osso tirado vai para o ancestral mais próximo que fica
def ancestral(nome):
    b = arm.data.bones.get(nome)
    while b is not None and b.name not in FICA:
        b = b.parent
    return b.name if b else 'Bip01 Pelvis'

me = malha.data
idx_nome = {g.index: g.name for g in malha.vertex_groups}
for nome in FICA:
    if nome not in malha.vertex_groups:
        malha.vertex_groups.new(name=nome)
novos = {}
for v in me.vertices:
    acc = {}
    for g in v.groups:
        n = idx_nome.get(g.group)
        if n is None or g.weight <= 0: continue
        alvo = n if n in FICA else ancestral(n)
        acc[alvo] = acc.get(alvo, 0.0) + g.weight
    top = sorted(acc.items(), key=lambda kv: -kv[1])[:4]
    s = sum(w for _, w in top) or 1.0
    novos[v.index] = [(n, w / s) for n, w in top]
for g in list(malha.vertex_groups):
    malha.vertex_groups.remove(g)
grupos = {n: malha.vertex_groups.new(name=n) for n in FICA}
for vi, lst in novos.items():
    for n, w in lst:
        grupos[n].add([vi], w, 'REPLACE')

# 2) esqueleto: apaga os ossos que não ficam (o filho de quem sai é re-parentado no ancestral)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
eb = arm.data.edit_bones
for b in list(eb):
    if b.name not in FICA and b.name not in ('Bip01',):
        for c in b.children:
            c.parent = b.parent
        eb.remove(b)
bpy.ops.object.mode_set(mode='OBJECT')

# 3) separa por material: corpo | cabeça | cabelo (com opacidade) — separados: os personagens do THE FLASH mostram o
#    rosto e o cabelo de verdade; o que não for dos três (o estetoscópio) sai
bpy.ops.object.select_all(action='DESELECT')
malha.select_set(True); bpy.context.view_layer.objects.active = malha
bpy.ops.mesh.separate(type='MATERIAL')
partes = [o for o in bpy.data.objects if o.type == 'MESH']
corpo = [o for o in partes if any('body' in (m.name if m else '') for m in o.data.materials) and len(o.data.polygons) > 0]
for o in partes:
    nomes = ' '.join(m.name for m in o.data.materials if m)
    if 'body' in nomes: o.name = 'corpo'
    elif 'opacity' in nomes: o.name = 'cabelo'
    elif 'head' in nomes: o.name = 'cabeca'
    else: bpy.data.objects.remove(o)

def tri(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)

# 4) LOD1 por decimação (colapso), cada parte na proporção dela
lod0 = [o for o in bpy.data.objects if o.type == 'MESH']
total0 = sum(tri(o) for o in lod0)
for o in lod0:
    o.name = o.name.split('.')[0] + '_lod0'
for o in list(lod0):
    d = o.copy(); d.data = o.data.copy(); bpy.context.collection.objects.link(d)
    d.name = o.name.replace('_lod0', '_lod1')
    m = d.modifiers.new('dec', 'DECIMATE'); m.decimate_type = 'COLLAPSE'
    m.ratio = alvo1 / total0
    m.use_collapse_triangulate = True
    # o modificador de armadura tem de vir DEPOIS da decimação na pilha para aplicar só a decimação
    bpy.context.view_layer.objects.active = d
    while d.modifiers[0].name != 'dec':
        bpy.ops.object.modifier_move_up(modifier='dec')
    bpy.ops.object.modifier_apply(modifier='dec')

for o in bpy.data.objects:
    if o.type == 'MESH':
        print(f'PARTE {o.name}: {len(o.data.vertices)} v, {tri(o)} tri, grupos={len(o.vertex_groups)}')
print('OSSOS', len(arm.data.bones), [b.name for b in arm.data.bones])

# 5) exporta: um GLB com LOD0+LOD1 (mesma armadura), sem textura nem animação
def exportar(caminho, filtro):
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True)
    for o in bpy.data.objects:
        if o.type == 'MESH' and filtro(o.name): o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=caminho, export_format='GLB', use_selection=True,
        export_animations=False, export_image_format='NONE', export_materials='EXPORT',
        export_skins=True, export_all_influences=False, export_yup=True, export_apply=False,
        export_texcoords=True, export_normals=True, export_tangents=False)
exportar(saida + '_lod0.glb', lambda n: n.endswith('_lod0'))
exportar(saida + '_lod1.glb', lambda n: n.endswith('_lod1'))
exportar(saida + '_lods.glb', lambda n: True)
print('OK', saida)
