#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Recorta as CENAS do jogo a partir das capas dos modos (artes do dono).

Cada capa tem várias cenas dentro (o quadro tático, os armários, os livros de
transferências, as moedas, o troféu, o mapa-múndi...). Daqui saem:
  - mini cenas quadradas (assets/cenas/m-*.jpg) para os atalhos;
  - faixas largas (assets/cenas/b-*.jpg) para o topo das telas.
Tudo no mesmo estilo das capas, sem imagem de fora.

    python3 ferramentas/gerar-cenas.py

Coordenadas em pixels das capas originais (941x1672, em ferramentas/capas-originais).
"""
import os
from PIL import Image, ImageEnhance

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIG = os.path.join(RAIZ, "ferramentas", "capas-originais")
SAIDA = os.path.join(RAIZ, "assets", "cenas")

# mini cenas (quadradas): nome -> (capa, x0, y0, x1, y1)
MINIS = {
    "cadeira":     ("treinador", 270, 700, 590, 1020),   # cadeira do treinador com o TM
    "quadro":      ("treinador", 0, 400, 350, 750),      # quadro tático na parede
    "janela":      ("treinador", 400, 240, 800, 640),    # o estádio visto do escritório
    "livros":      ("treinador", 630, 860, 941, 1171),   # livros "TRANSFERÊNCIAS" e o notebook
    "mesa":        ("treinador", 30, 890, 410, 1270),    # caneca e prancheta
    "tunel":       ("estrelato", 160, 320, 720, 880),    # o jogador entrando no estádio
    "camisa10":    ("estrelato", 300, 800, 720, 1220),   # as costas da camisa 10
    "valores":     ("estrelato", 690, 160, 941, 411),    # DISCIPLINA · EVOLUÇÃO · CONQUISTA
    "bola":        ("rapida", 190, 700, 730, 1240),      # a bola no gramado
    "gol":         ("rapida", 700, 430, 941, 671),       # a rede do gol
    "arquibancada": ("rapida", 0, 250, 500, 750),        # arquibancada e refletores
    "trofeu":      ("competicoes", 200, 400, 740, 940),  # o troféu
    "cartas":      ("ultimate", 220, 580, 720, 1080),    # o leque de cartas
    "cartas-lado": ("ultimate", 0, 760, 320, 1080),      # cartas de jogador
    "moedas":      ("ultimate", 70, 880, 450, 1260),     # pilha de moedas TM
    "pacotes":     ("ultimate", 650, 930, 941, 1221),    # pacotes
    "mapa":        ("online", 320, 590, 700, 970),       # mapa-múndi com jogadores
    "gamer":       ("online", 180, 940, 780, 1540),      # jogando online
    "chave":       ("copa", 20, 200, 520, 700),          # chave do mata-mata (capa de 540x960)
    "globo":       ("competicoes", 560, 560, 820, 880),  # bandeira com o globo
    "divisoes":    ("ultimate", 20, 380, 330, 690),      # a escada de divisões (tabela)
    "retratos":    ("estrelato", 0, 420, 260, 900),      # retrato de jogador na parede do túnel
    "documentos":  ("treinador", 600, 1000, 941, 1341),  # pastas PLANEJAMENTO · TRANSFERÊNCIAS
    "placas":      ("rapida", 600, 860, 941, 1201),      # placas de publicidade TM atrás do gol
    "refletores":  ("rapida", 470, 150, 941, 621),       # refletores acesos (dia de jogo)
    "tv":          ("online", 600, 930, 941, 1271),      # o jogo na tela
    "ping":        ("online", 700, 700, 941, 960),       # lista de contatos com bandeiras
}
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
MINI_LADO = 280
FAIXA_TAM = (780, 300)


def abre(capa):
    return Image.open(os.path.join(ORIG, capa + ".jpg")).convert("RGB")


def main():
    os.makedirs(SAIDA, exist_ok=True)
    cache, total = {}, 0
    for tipo, tabela, tam in (("m", MINIS, (MINI_LADO, MINI_LADO)), ("b", FAIXAS, FAIXA_TAM)):
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
    print("cenas: %d mini + %d faixas = %d KB" % (len(MINIS), len(FAIXAS), total // 1024))


if __name__ == "__main__":
    main()
