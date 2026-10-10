# Confere os laços depois do MP3: o sinal decodificado é periódico em volta de loopFim (o trecho logo
# depois de loopFim repete o de depois de loopInicio) — sem estalo na volta.
#   python3 -I conferir_laco.py <pasta_sons>
import json, os, subprocess, sys
import numpy as np
P = sys.argv[1]
info = json.load(open(os.path.join(P, 'sons.json')))
SR = 44100
for nome, d in info.items():
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(P, d['arquivo']), '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    if not d.get('laco'):
        print(f'{nome}: {len(x)/SR:.3f} s decodificado (arquivo {d["duracao"]} s)')
        continue
    a, b = int(d['loopInicio'] * SR), int(d['loopFim'] * SR)
    w = int(0.2 * SR)
    seg1 = x[a - w // 2:a + w // 2]
    seg2 = x[b - w // 2:b + w // 2]
    erro = np.sqrt(np.mean((seg1 - seg2) ** 2)) / (np.sqrt(np.mean(seg1 ** 2)) + 1e-12)
    # salto na emenda (amostra antes de loopFim → amostra em loopInicio) comparado ao passo típico
    salto = abs(x[b - 1] - x[a])
    passo = np.median(np.abs(np.diff(x[a:b])))
    print(f'{nome}: decodificado {len(x)/SR:.3f} s, laço {d["loopInicio"]}–{d["loopFim"]} s; erro relativo na emenda {erro:.3f}; salto {salto:.4f} (passo típico {passo:.4f})')
