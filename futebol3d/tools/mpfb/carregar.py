# Carrega o MPFB 2 (MakeHuman para Blender, CC0) dentro do bpy sem interface.
import sys, os, importlib, bpy
BASE = '/tmp/claude-0/-home-user-jogo-futebol/9805b587-e422-5403-9106-8bf9d9184706/scratchpad/mpfb'
def carregar():
    src = os.path.join(BASE, 'mpfb2', 'src')
    if src not in sys.path: sys.path.insert(0, src)
    import mpfb
    try: mpfb.register()
    except Exception as e: print('registro:', e)
    LS = importlib.import_module('mpfb.services.locationservice').LocationService
    return mpfb
def svc(mod, cls): return getattr(importlib.import_module('mpfb.services.' + mod), cls)
