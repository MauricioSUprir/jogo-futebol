# Malha canônica do MediaPipe (Apache 2.0): vértices 3D (cm), UV por vértice e triângulos.
import numpy as np
def carregar(caminho):
    V, T, F = [], [], []
    for l in open(caminho):
        p = l.split()
        if not p: continue
        if p[0] == 'v': V.append([float(x) for x in p[1:4]])
        elif p[0] == 'vt': T.append([float(x) for x in p[1:3]])
        elif p[0] == 'f': F.append([tuple(int(y) - 1 for y in x.split('/')) for x in p[1:4]])
    V, T = np.array(V), np.array(T)
    uv = np.full((len(V), 2), np.nan); conflito = 0
    for f in F:
        for vi, ti in f:
            if not np.isnan(uv[vi, 0]) and np.abs(uv[vi] - T[ti]).max() > 1e-6: conflito += 1
            uv[vi] = T[ti]
    tri = np.array([[c[0] for c in f] for f in F])
    return V, uv, tri, conflito
