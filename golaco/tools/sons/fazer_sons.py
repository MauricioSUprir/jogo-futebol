# Monta os sons do GOLAÇO a partir das gravações livres (ver golaco/assets/sons/CREDITOS.md):
# laços sem estalo (cruzamento de potência igual + margem periódica dos dois lados, para o atraso do
# decodificador de MP3 não abrir buraco), recortes com entrada/saída suaves, mono, MP3 64 kbps.
#   python3 -I fazer_sons.py <pasta_das_gravacoes> <pasta_saida>
# <pasta_das_gravacoes> com as originais (endereços em CREDITOS.md), cada uma na sua pasta:
#   dl_wws/wws.ogg (Work With Sounds), dl_quendel/mp3/03.mp3 e 06.mp3 (Gregor Quendel, faixas 03 e 06
#   do pacote), dl_apito/apito.wav (SpliceSound). Saída: os .mp3 + sons.json (laço, duração, nível).
import json, os, subprocess, sys
import numpy as np

B = sys.argv[1]
SAIDA = sys.argv[2]
os.makedirs(SAIDA, exist_ok=True)
SR = 44100
WWS = os.path.join(B, 'dl_wws', 'wws.ogg')
Q = lambda n: os.path.join(B, 'dl_quendel', 'mp3', f'{n}.mp3')
APITO = os.path.join(B, 'dl_apito', 'apito.wav')
MARGEM = 0.25  # s de margem periódica dos laços


def ler(arq, ini, fim):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(ini), '-t', str(fim - ini), '-i', arq,
                          '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)


def laco(x, P, X):
    """Laço periódico de período P s a partir de x (≥ P + X s): a cauda entra por cima da cabeça
    (potência igual). Devolve (sinal com margem dos dois lados, inicio, fim do laço em s)."""
    p, xs = int(P * SR), int(X * SR)
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


def nivel_rms(x, alvo_db):
    return x * 10 ** ((alvo_db - rms_db(x)) / 20)


def nivel_pico(x, alvo_db=-1.0):
    return x * 10 ** (alvo_db / 20) / (np.abs(x).max() + 1e-12)


def gravar(nome, x, kbps=64):
    x = np.clip(x, -0.999, 0.999).astype(np.float32)
    wav = os.path.join(SAIDA, nome + '.f32')
    x.tofile(wav)
    mp3 = os.path.join(SAIDA, nome + '.mp3')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', wav,
                    '-c:a', 'libmp3lame', '-b:a', f'{kbps}k', '-ar', str(SR), '-ac', '1', mp3], check=True)
    os.remove(wav)
    return {'arquivo': nome + '.mp3', 'duracao': round(len(x) / SR, 3), 'bytes': os.path.getsize(mp3),
            'rms_db': round(float(rms_db(x)), 1), 'pico_db': round(float(20 * np.log10(np.abs(x).max() + 1e-12)), 1)}


info = {}
# laços (nível RMS igual: o jogo mistura pelos ganhos)
for nome, arq, ini, P, X in [
    ('torcida-ambiente', WWS, 21.0, 18.0, 2.0),   # murmúrio calmo do estádio (WWS 21–41 s)
    ('torcida-agito', WWS, 77.0, 13.0, 2.0),      # estádio agitado, ataque perto do gol (WWS 77–92 s)
    ('torcida-canto', WWS, 188.5, 14.0, 2.0),     # torcida cantando junto (WWS 188,5–204,5 s)
]:
    x = ler(arq, ini, ini + P + X + 0.05)
    x = nivel_rms(x, -20)
    ext, li, lf = laco(x, P, X)
    d = gravar(nome, ext, 56)
    d.update({'laco': True, 'loopInicio': li, 'loopFim': round(lf, 6), 'fonte': os.path.basename(arq), 'trecho': [ini, ini + P + X]})
    info[nome] = d

# reações (um disparo): pico a −1 dBFS
for nome, arq, ini, fim, ent, sai in [
    ('torcida-gol', Q('03'), 0.6, 22.5, 0.15, 4.0),   # explosão longa (Quendel "Strong cheering - I")
    ('torcida-uuuh', WWS, 57.7, 66.5, 0.08, 3.0),     # reação a lance perigoso no estádio (WWS 57,7–66,5 s)
    ('torcida-palmas', Q('06'), 1.2, 12.8, 0.3, 2.5), # aplauso/incentivo (Quendel "Soft cheering - II")
]:
    x = ler(arq, ini, fim)
    x = nivel_pico(suaviza(x, ent, sai))
    d = gravar(nome, x, 64)
    d.update({'laco': False, 'fonte': os.path.basename(arq), 'trecho': [ini, fim]})
    info[nome] = d

# apito: um sopro (com a cauda da sala); o longo estica o meio do sopro (laço de 0,15–0,45 s)
a = ler(APITO, 0.0, 1.45)
i0 = int(np.argmax(np.abs(a) > 0.02))
a = a[max(0, i0 - int(0.005 * SR)):]
curto = suaviza(a, 0.004, 0.25)


def sopro_longo(dur):
    ini, fim, X = int(0.15 * SR), int(0.45 * SR), int(0.06 * SR)
    meio = a[ini:fim]
    t = np.arange(X) / X
    total = int(dur * SR)
    out = list(a[:ini])
    acc = np.array(out)
    while len(acc) < ini + total:
        # cola outro pedaço do meio com cruzamento
        prox = meio
        cauda = acc[-X:]
        mistura = cauda * np.cos(t * np.pi / 2) + prox[:X] * np.sin(t * np.pi / 2)
        acc = np.concatenate([acc[:-X], mistura, prox[X:]])
    # solta: o fim do sopro original (0,45 s em diante) com cruzamento
    rel = a[fim - X:]
    mistura = acc[-X:] * np.cos(t * np.pi / 2) + rel[:X] * np.sin(t * np.pi / 2)
    acc = np.concatenate([acc[:-X], mistura, rel[X:]])
    return suaviza(acc, 0.004, 0.25)


longo = sopro_longo(1.1)


def em_sequencia(partes):
    total = max(int(t * SR) + len(x) for t, x in partes)
    out = np.zeros(total)
    for t, x in partes:
        k = int(t * SR)
        out[k:k + len(x)] += x
    return out


for nome, x in [
    ('apito', curto),
    ('apito-intervalo', em_sequencia([(0.0, curto), (0.62, longo)])),
    ('apito-fim', em_sequencia([(0.0, curto), (0.55, curto), (1.15, longo)])),
]:
    d = gravar(nome, nivel_pico(x, -2.0), 64)
    d.update({'laco': False, 'fonte': os.path.basename(APITO)})
    info[nome] = d

json.dump(info, open(os.path.join(SAIDA, 'sons.json'), 'w'), ensure_ascii=False, indent=1)
for k, v in info.items():
    print(k, v)
print('total', sum(v['bytes'] for v in info.values()), 'bytes')
