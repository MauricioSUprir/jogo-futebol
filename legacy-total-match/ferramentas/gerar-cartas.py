#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Peças das cartas do Total Ultimate (assets/cartas/).

- tm.svg / tm-mono.svg: a marca "TM" vetorizada da capa da Copa Online (arte do
  dono): o T branco e o M verde viram polígonos (OpenCV acha o contorno de cada
  letra numa ampliação da capa). A versão "mono" serve de máscara (marca d'água
  na cor da raridade).
- triangulos.svg: o fundo de triângulos (estilo "low poly") e as duas faixas
  diagonais, mais fortes atrás do jogador e sumindo à esquerda e embaixo, onde
  ficam a nota e o nome. Também é máscara: a cor vem da raridade, no CSS.

    python3 ferramentas/gerar-cartas.py
"""
import os, random
import numpy as np
import cv2

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.path.join(RAIZ, "assets", "cartas")


def marca_tm():
    im = cv2.imread(os.path.join(RAIZ, "ferramentas", "capas-originais", "copa.jpg"))
    x0, y0, x1, y1 = 212, 350, 328, 417          # o "TM" do meio da capa
    K = 10
    big = cv2.resize(im[y0:y1, x0:x1], None, fx=K, fy=K, interpolation=cv2.INTER_CUBIC)
    big = cv2.GaussianBlur(big, (0, 0), 2.2)
    b, g, r = [big[:, :, i].astype(int) for i in range(3)]
    branco = ((r > 150) & (g > 150) & (b > 150)).astype(np.uint8) * 255
    verde = ((g > 120) & (r < 110) & (g - r > 60)).astype(np.uint8) * 255
    H0, W0 = branco.shape

    def poligonos(mask):
        cs, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        out = []
        for c in cs:
            x, y, w, h = cv2.boundingRect(c)
            # o anel do círculo encosta na borda do recorte: fica de fora
            if cv2.contourArea(c) < 4000 or x <= 2 or y <= 2 or x + w >= W0 - 2 or y + h >= H0 - 2:
                continue
            out.append([(int(p[0][0]), int(p[0][1])) for p in cv2.approxPolyDP(c, 8, True)])
        return out

    pt, pm = poligonos(branco), poligonos(verde)
    pts = [q for p in pt + pm for q in p]
    mx, my = min(q[0] for q in pts), min(q[1] for q in pts)
    W, H = max(q[0] for q in pts) - mx, max(q[1] for q in pts) - my

    def d(p):
        return "M" + " L".join("%d %d" % (q[0] - mx, q[1] - my) for q in p) + "Z"
    duas = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d"><path fill="#fff" d="%s"/>'
            '<path fill="#22c55e" d="%s"/></svg>') % (W, H, "".join(d(p) for p in pt), "".join(d(p) for p in pm))
    mono = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d"><path d="%s"/></svg>' % (W, H, "".join(d(p) for p in pt + pm))
    open(os.path.join(SAIDA, "tm.svg"), "w").write(duas)
    open(os.path.join(SAIDA, "tm-mono.svg"), "w").write(mono)
    return W, H


def triangulos():
    rnd = random.Random(7)
    W, H, C, L = 100.0, 143.0, 7, 10
    pts = [[(min(W, max(0, i * W / C + (rnd.uniform(-5, 5) if 0 < i < C else 0))),
             min(H, max(0, j * H / L + (rnd.uniform(-5, 5) if 0 < j < L else 0)))) for i in range(C + 1)] for j in range(L + 1)]

    def peso(x, y):
        # forte atrás do jogador (direita, alto); some na coluna da nota e no texto
        px = min(1, max(0, (x - 18) / 60.0))
        py = min(1, max(0, 1 - (y - 20) / 85.0))
        return px * py
    tris = []
    for j in range(L):
        for i in range(C):
            a, b, c, dd = pts[j][i], pts[j][i + 1], pts[j + 1][i + 1], pts[j + 1][i]
            pares = [(a, b, c), (a, c, dd)] if (i + j) % 2 else [(a, b, dd), (b, c, dd)]
            for t in pares:
                cx = sum(p[0] for p in t) / 3; cy = sum(p[1] for p in t) / 3
                o = peso(cx, cy) * rnd.choice([0, .12, .2, .3, .42, .55, .75, 1])
                if o >= .04:
                    tris.append('<path fill-opacity="%.2f" d="M%.1f %.1fL%.1f %.1fL%.1f %.1fZ"/>' % (o, t[0][0], t[0][1], t[1][0], t[1][1], t[2][0], t[2][1]))
    faixas = ('<path fill-opacity=".9" d="M74 0L78 0L22 96L20 93Z"/>'
              '<path fill-opacity=".45" d="M92 0L100 0L100 4L40 104L36 100Z"/>')
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 143" preserveAspectRatio="none">%s%s</svg>'
           % ("".join(tris), faixas))
    open(os.path.join(SAIDA, "triangulos.svg"), "w").write(svg)
    return len(tris), len(svg)


if __name__ == "__main__":
    os.makedirs(SAIDA, exist_ok=True)
    print("marca TM:", marca_tm())
    print("triângulos:", triangulos())
