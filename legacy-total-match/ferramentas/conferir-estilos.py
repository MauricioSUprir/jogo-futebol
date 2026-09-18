#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Aponta elementos que o jogo cria sem estilo nenhum no CSS.

Foi assim que apareceu o botão branco do navegador na tela de configuração
da carreira: a classe existia no JS e não existia no css/styles.css. Rode
antes de publicar:

    python3 ferramentas/conferir-estilos.py

Sai com código 1 se achar um controle visível (botão, select, input, textarea
ou link) cuja classe não tem NENHUMA regra no CSS — esses são os que o
navegador desenha com o visual padrão dele e destoam do jogo.
"""
import glob
import io
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTROLES = ("button", "select", "input", "textarea", "a")


def classes_do_css(caminho):
    css = io.open(caminho, encoding="utf-8").read()
    return set(re.findall(r"\.([a-zA-Z][\w-]*)", css))


def bloco_de_atributos(texto, inicio):
    """Devolve o objeto { ... } inteiro, respeitando as chaves de dentro."""
    profundidade = 0
    for i in range(inicio, min(inicio + 8000, len(texto))):
        if texto[i] == "{":
            profundidade += 1
        elif texto[i] == "}":
            profundidade -= 1
            if profundidade == 0:
                return texto[inicio:i + 1]
    return ""


def main():
    definidas = classes_do_css(os.path.join(RAIZ, "css", "styles.css"))
    sem_estilo, soltas = [], {}
    for arq in sorted(glob.glob(os.path.join(RAIZ, "js", "*.js"))):
        fonte = io.open(arq, encoding="utf-8").read()
        nome = os.path.basename(arq)
        for m in re.finditer(r'el\(\s*"(%s)"\s*,\s*\{' % "|".join(CONTROLES), fonte):
            attrs = bloco_de_atributos(fonte, m.end() - 1)
            achou = re.search(r'class:\s*"([^"]*)"', attrs)
            if not achou:
                continue
            # classes montadas com variável (" + x) não dá para conferir aqui
            base = [c for c in achou.group(1).split() if c and "+" not in c]
            if not base or any(c in definidas for c in base):
                continue
            linha = fonte[:m.start()].count("\n") + 1
            sem_estilo.append((nome, linha, m.group(1), " ".join(base)))
        for m in re.finditer(r'class:\s*"([^"]+)"', fonte):
            for c in m.group(1).split():
                if c and "+" not in c and c not in definidas and not c.endswith("-"):
                    soltas.setdefault(c, set()).add(nome)

    if sem_estilo:
        print("CONTROLES SEM ESTILO (aparecem com o visual padrão do navegador):")
        for nome, linha, tag, cls in sem_estilo:
            print("  %s:%d  <%s class=\"%s\">" % (nome, linha, tag, cls))
    else:
        print("Nenhum controle sem estilo. ✅")

    if soltas:
        print("\nClasses sem regra no CSS (nem sempre é problema — muitas são só divisórias):")
        for c in sorted(soltas):
            print("  .%-26s %s" % (c, ", ".join(sorted(soltas[c]))))

    return 1 if sem_estilo else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except BrokenPipeError:      # rodou com | head
        sys.exit(0)
