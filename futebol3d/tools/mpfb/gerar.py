# Gera um jogador com o MPFB 2 (MakeHuman, CC0): corpo de atleta, pele, olhos, sobrancelhas,
# cílios e rig "game_engine"; exporta GLB. Uso: python3 gerar.py <saida.glb> <pele> <cabelo|-> <musculo 0..1> <peso 0..1> <altura 0..1> <etnia a,c,as>
import bpy, addon_utils, importlib, sys, os
addon_utils.enable('bl_ext.user_default.mpfb', default_set=True)
S = lambda m, c: getattr(importlib.import_module('bl_ext.user_default.mpfb.services.' + m), c)
HumanService, AssetService, TargetService = S('humanservice', 'HumanService'), S('assetservice', 'AssetService'), S('targetservice', 'TargetService')
out, pele, cabelo, musc, peso, alt, et = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4]), float(sys.argv[5]), float(sys.argv[6]), sys.argv[7]
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
macros = TargetService.get_default_macro_info_dict()
a, c, s = [float(x) for x in et.split(',')]
macros.update({'gender': 1.0, 'age': 0.5, 'muscle': musc, 'weight': peso, 'height': alt, 'proportions': 0.8})
macros['race'] = {'african': a, 'caucasian': c, 'asian': s}
basemesh = HumanService.create_human(macro_detail_dict=macros)
sp = AssetService.find_asset_absolute_path(pele + '.mhmat', asset_subdir='skins')
HumanService.set_character_skin(sp, basemesh, skin_type='GAMEENGINE')
HumanService.add_builtin_rig(basemesh, 'game_engine')
for sub, f, t in [('eyes', 'high-poly.mhclo', 'Eyes'), ('eyebrows', 'eyebrow001.mhclo', 'Eyebrows'), ('eyelashes', 'eyelashes01.mhclo', 'Eyelashes')] + ([('hair', cabelo + '.mhclo', 'Hair')] if cabelo != '-' else []):
    p = AssetService.find_asset_absolute_path(f, asset_subdir=sub)
    if p: HumanService.add_mhclo_asset(p, basemesh, asset_type=t, material_type='GAMEENGINE')
    else: print('faltou', f)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_apply=True, export_skins=True, export_animations=False)
print('salvo', out)
