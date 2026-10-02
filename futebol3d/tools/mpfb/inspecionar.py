import bpy, addon_utils, importlib
addon_utils.enable('bl_ext.user_default.mpfb', default_set=True)
S = lambda m, c: getattr(importlib.import_module('bl_ext.user_default.mpfb.services.' + m), c)
HS, TS = S('humanservice', 'HumanService'), S('targetservice', 'TargetService')
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
mac = TS.get_default_macro_info_dict(); mac.update({'gender': 1.0, 'muscle': 0.8, 'weight': 0.5, 'height': 0.5})
b = HS.create_human(macro_detail_dict=mac)
HS.add_builtin_rig(b, 'game_engine')
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
print('ossos', [(bn.name, bn.parent.name if bn.parent else '-', tuple(round(x, 2) for x in (arm.matrix_world @ bn.head_local))) for bn in arm.data.bones])
print('mods', [(m.type, m.name, getattr(m, 'vertex_group', '')) for m in b.modifiers])
print('uv', [u.name for u in b.data.uv_layers], 'vgs', len(b.vertex_groups))
