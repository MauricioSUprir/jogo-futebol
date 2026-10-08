#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Recorta as CENAS do jogo a partir das capas dos modos (artes do dono).

Cada capa tem várias cenas dentro (o quadro tático, os armários, os livros de
transferências, as moedas, o troféu, o mapa-múndi...). Daqui saem as faixas largas
(assets/cenas/b-*.jpg) para o topo das telas. (As mini cenas dos atalhos saíram:
o dono preferiu ícone + nome.)
Tudo no mesmo estilo das capas, sem imagem de fora.

    python3 ferramentas/gerar-cenas.py

Coordenadas em pixels das capas originais (941x1672, em ferramentas/capas-originais).
"""
import os
from PIL import Image, ImageEnhance

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIG = os.path.join(RAIZ, "ferramentas", "capas-originais")
SAIDA = os.path.join(RAIZ, "assets", "cenas")

# faixas largas (2,6:1) para o topo das telas
FAIXAS = {
    "escritorio":  ("treinador", 0, 200, 941, 562),
    "quadro":      ("treinador", 0, 430, 941, 792),
    "mesa":        ("treinador", 0, 880, 941, 1242),
    "tunel":       ("estrelato", 0, 330, 941, 692),
    "camisa":      ("estrelato", 0, 800, 941, 1162),
    "bola":        ("rapida", 0, 720, 941, 1082),
    "estadio":     ("rapida", 0, 200, 941, 562),
    "trofeu":      ("competicoes", 150, 420, 941, 724),   # sem o banner da esquerda (marca de terceiro)
    "cartas":      ("ultimate", 0, 600, 941, 962),
    "moedas":      ("ultimate", 0, 880, 941, 1242),
    "mapa":        ("online", 0, 560, 941, 922),
    "gamer":       ("online", 0, 980, 941, 1342),
    "chave":       ("copa", 0, 150, 540, 358),
}
FAIXA_TAM = (780, 300)


def abre(capa):
    return Image.open(os.path.join(ORIG, capa + ".jpg")).convert("RGB")


def main():
    os.makedirs(SAIDA, exist_ok=True)
    cache, total = {}, 0
    for tipo, tabela, tam in (("b", FAIXAS, FAIXA_TAM),):
        for nome, (capa, x0, y0, x1, y1) in tabela.items():
            im = cache.get(capa) or cache.setdefault(capa, abre(capa))
            corte = im.crop((x0, y0, x1, y1))
            # mesmo enquadramento sempre: preenche o alvo e corta o que sobrar no meio
            alvo_r = tam[0] / tam[1]
            r = corte.width / corte.height
            if r > alvo_r:
                w = int(corte.height * alvo_r); dx = (corte.width - w) // 2
                corte = corte.crop((dx, 0, dx + w, corte.height))
            elif r < alvo_r:
                h = int(corte.width / alvo_r); dy = (corte.height - h) // 2
                corte = corte.crop((0, dy, corte.width, dy + h))
            corte = corte.resize(tam, Image.LANCZOS)
            corte = ImageEnhance.Sharpness(corte).enhance(1.15)   # recorte ampliado fica mole
            arq = os.path.join(SAIDA, "%s-%s.jpg" % (tipo, nome))
            corte.save(arq, "JPEG", quality=82, optimize=True, progressive=True)
            total += os.path.getsize(arq)
    print("cenas: %d faixas = %d KB" % (len(FAIXAS), total // 1024))


if __name__ == "__main__":
    main()
