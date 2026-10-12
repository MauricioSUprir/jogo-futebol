# Monta os sons NOVOS da festa da torcida (pedido de 11/10: cantos, batucada, vaia, mais um "uuuh") a partir de
# gravações livres do freesound (CC0 e CC BY 4.0 — ver golaco/assets/sons/CREDITOS.md): laços sem estalo
# (cruzamento de potência igual + margem periódica dos dois lados, como fazer_sons.py), recortes com entrada/saída
# suaves, mono 44,1 kHz, MP3 48 kbps. Nível: −16 LUFS (EBU R128, medido pelo ffmpeg) sem passar de −1 dBFS de pico;
# o LUFS final de cada arquivo vai para sons-festa.json (o jogo nivela pelo LUFS medido: som.js SOM.arquivos).
# A batucada tem o laço com um número PAR de batidas (o pulo da organizada no ritmo não salta na emenda).
#   python3 -I fazer_sons_festa.py <pasta_das_gravacoes> <pasta_saida>
# <pasta_das_gravacoes> com as prévias do freesound (fsNNNNNN.mp3, NNNNNN = o número do som; endereços em
# CREDITOS.md: https://cdn.freesound.org/previews/... -hq.mp3, a mesma licença do original).
import json, os, re, subprocess, sys
import numpy as np

B = sys.argv[1]
SAIDA = sys.argv[2]
os.makedirs(SAIDA, exist_ok=True)
SR = 44100
MARGEM = 0.25   # s de margem periódica dos laços
ALVO = -16.0    # LUFS
PICO = -1.0     # dBFS
fs = lambda n: os.path.join(B, f'fs{n}.mp3')


def ler(arq, ini, fim):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(ini), '-t', str(fim - ini), '-i', arq,
                          '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def lufs(arq_ou_x):
    if isinstance(arq_ou_x, str):
        e = subprocess.run(['ffmpeg', '-nostats', '-hide_banner', '-i', arq_ou_x, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                           capture_output=True, text=True).stderr
    else:
        e = subprocess.run(['ffmpeg', '-nostats', '-hide_banner', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-',
                            '-af', 'ebur128=peak=true', '-f', 'null', '-'], input=arq_ou_x.astype(np.float32).tobytes(),
                           capture_output=True).stderr.decode()
    i = re.findall(r'I:\s+(-?[\d.]+) LUFS', e)
    p = re.findall(r'Peak:\s+(-?[\d.]+) dBFS', e)
    return float(i[-1]), float(p[-1]) if p else None


def laco(x, P, X):
    """Laço periódico de período P s a partir de x (≥ P + X s): a cauda entra por cima da cabeça (potência igual)."""
    p, xs = int(round(P * SR)), int(X * SR)
    assert len(x) >= p + xs, (len(x) / SR, P, X)
    s = x[:p + xs]
    t = np.arange(xs) / xs
    out = s[:p].copy()
    out[:xs] = s[:xs] * np.sin(t * np.pi / 2) + s[p:p + xs] * np.cos(t * np.pi / 2)
    m = int(MARGEM * SR)
    ext = np.concatenate([out[p - m:], out, out[:m]])
    return ext, MARGEM, MARGEM + p / SR


def suaviza(x, ent, sai):
    x = x.copy()
    a, b = int(ent * SR), int(sai * SR)
    if a: x[:a] *= np.sin(np.linspace(0, np.pi / 2, a))
    if b: x[-b:] *= np.cos(np.linspace(0, np.pi / 2, b))
    return x


def nivelar(x):
    """−16 LUFS sem passar de −1 dBFS de pico (o que vier primeiro)."""
    l, _ = lufs(x)
    g = 10 ** ((ALVO - l) / 20)
    pk = np.abs(x).max() * g
    if pk > 10 ** (PICO / 20):
        g *= 10 ** (PICO / 20) / pk
    return x * g


def gravar(nome, x, kbps=48):
    x = np.clip(x, -0.999, 0.999).astype(np.float32)
    mp3 = os.path.join(SAIDA, nome + '.mp3')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-',
                    '-c:a', 'libmp3lame', '-b:a', f'{kbps}k', '-ar', str(SR), '-ac', '1', mp3], input=x.tobytes(), check=True)
    l, p = lufs(mp3)
    return {'arquivo': nome + '.mp3', 'duracao': round(len(x) / SR, 3), 'bytes': os.path.getsize(mp3), 'lufs': l, 'pico_dbtp': p}


def bpm_e_fase(x, lo=60, hi=200):
    """BPM (autocorrelação do fluxo espectral) e o tempo da 1ª batida (s) — para o laço da batucada."""
    H, N = 256, 2048
    E, ant = [], None
    for k in range(0, len(x) - N, H):
        m = np.log1p(100 * np.abs(np.fft.rfft(x[k:k + N] * np.hanning(N))))
        if ant is not None: E.append(np.maximum(m - ant, 0).sum())
        ant = m
    E = np.array(E); E -= E.mean()
    fps = SR / H
    ac = np.correlate(E, E, 'full')[len(E) - 1:]; ac /= ac[0]
    melhor = (0, 0)
    for lag in range(int(fps * 60 / hi), int(fps * 60 / lo)):
        if ac[lag] > ac[lag - 1] and ac[lag] >= ac[lag + 1] and ac[lag] > melhor[0]:
            a, b, c = ac[lag - 1], ac[lag], ac[lag + 1]
            d = 0.5 * (a - c) / (a - 2 * b + c) if (a - 2 * b + c) != 0 else 0
            melhor = (b, 60 * fps / (lag + d))
    bpm = melhor[1]
    per = fps * 60 / bpm
    fase = np.zeros(64)
    for i, e in enumerate(E):
        fase[int((i % per) / per * 64) % 64] += max(e, 0)
    return bpm, float(np.argmax(fase) / 64 * 60 / bpm + N / 2 / SR)


info = {}
# cantos (laços de durações diferentes: a variedade não cansa) — [nome, som, início, período, cruzamento, papel]
for nome, n, ini, P, X, papel in [
    ('torcida-canto-a', 424354, 16.0, 22.0, 2.0, 'geral e setor visitante (clássico no San Siro, de longe)'),
    ('torcida-canto-b', 503091, 9.5, 24.0, 2.0, 'incentivo (organizada brasileira com bateria)'),
    ('torcida-canto-c', 503094, 99.0, 26.0, 2.0, 'festa (organizada brasileira: "já ganhou")'),
]:
    x = ler(fs(n), ini, ini + P + X + 0.05)
    ext, li, lf = laco(x, P, X)
    d = gravar(nome, nivelar(ext))
    d.update({'laco': True, 'loopInicio': li, 'loopFim': round(lf, 6), 'fonte': f'freesound {n}', 'trecho': [ini, ini + P + X], 'papel': papel})
    info[nome] = d

# batucada: laço com número PAR de batidas (o surdo no meio-tempo marca o pulo da organizada)
n, ini = 74720, 18.0
x = ler(fs(n), ini, ini + 24)
bpm, fase = bpm_e_fase(x)
batidas = 42
P = batidas * 60 / bpm
ext, li, lf = laco(x, P, 2.0)
d = gravar('torcida-batucada', nivelar(ext))
d.update({'laco': True, 'loopInicio': li, 'loopFim': round(lf, 6), 'fonte': f'freesound {n}', 'trecho': [ini, round(ini + P + 2, 3)],
          'bpm': round(bpm, 2), 'batidas': batidas, 'batida0': round(fase, 3), 'pulo_bpm': round(bpm / 2, 2)})
info['torcida-batucada'] = d

# reações de uma vez
for nome, n, ini, fim, ent, sai in [
    ('torcida-uuuh-2', 612131, 29.6, 40.2, 0.15, 2.2),   # "huuuu" de 60 mil no Mineirão (felix.blume, CC0)
    ('torcida-vaia', 557189, 1.0, 12.5, 0.4, 2.5),       # vaia num jogo (Julien_Matthey, CC0)
]:
    x = suaviza(ler(fs(n), ini, fim), ent, sai)
    d = gravar(nome, nivelar(x))
    d.update({'laco': False, 'fonte': f'freesound {n}', 'trecho': [ini, fim]})
    info[nome] = d

json.dump(info, open(os.path.join(SAIDA, 'sons-festa.json'), 'w'), ensure_ascii=False, indent=1)
for k, v in info.items():
    print(k, v)
print('total', sum(v['bytes'] for v in info.values()), 'bytes')
