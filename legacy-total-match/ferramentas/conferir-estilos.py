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

A regra precisa casar com a COMBINAÇÃO de classes: "primary" sozinha não
conta só porque existe ".btn.primary" (foi assim que os botões principais do
Rumo ao Estrelato ficaram cinza-claros por meses). Também confere os botões
criados por TM.ui.button(rótulo, ação, "classes").
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


def regras_do_css(caminho):
    """Para cada seletor, o "sujeito" (último trecho): (tag ou None, classes)."""
    css = re.sub(r"/\*.*?\*/", "", io.open(caminho, encoding="utf-8").read(), flags=re.S)
    regras = []
    for m in re.finditer(r"([^{}@;]+)\{", css):
        for sel in m.group(1).split(","):
            sel = re.sub(r"::?[\w-]+(\([^)]*\))?", "", sel.strip())     # tira :hover, ::before, :not(...)
            sel = re.sub(r"\[[^\]]*\]", "", sel)                           # tira [atributos]
            partes = re.split(r"\s*[>+~]\s*|\s+", sel.strip())
            if not partes or not partes[-1]:
                continue
            ult = partes[-1]
            cls = frozenset(re.findall(r"\.([a-zA-Z][\w-]*)", ult))
            tag = re.match(r"^([a-zA-Z][\w-]*)", ult)
            if cls:
                regras.append((tag.group(1).lower() if tag else None, cls))
    return regras


def tem_regra(regras, tag, classes):
    cj = set(classes)
    return any(c <= cj and (t is None or t == tag) for t, c in regras)


def chamadas_button(fonte):
    """TM.ui.button(rótulo, ação, "classes") -> [(posição, classes)]"""
    saida = []
    for m in re.finditer(r"(?:TM\.ui\.button|\bbutton)\(", fonte):
        i, prof = m.end(), 1
        while i < len(fonte) and prof:
            ch = fonte[i]
            if ch in "\"'":                      # pula strings
                q = ch; i += 1
                while i < len(fonte) and fonte[i] != q:
                    i += 2 if fonte[i] == "\\" else 1
            elif ch == "(":
                prof += 1
            elif ch == ")":
                prof -= 1
            i += 1
        chamada = fonte[m.start():i]
        fim = re.search(r',\s*"([^"+]*)"\s*\)$', chamada)
        if fim and chamada.count(",") >= 2:
            saida.append((m.start(), fim.group(1)))
    return saida


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
    regras = regras_do_css(os.path.join(RAIZ, "css", "styles.css"))
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
            if not base or tem_regra(regras, m.group(1), base):
                continue
            linha = fonte[:m.start()].count("\n") + 1
            sem_estilo.append((nome, linha, m.group(1), " ".join(base)))
        for pos, cls in chamadas_button(fonte):
            base = [c for c in cls.split() if c]
            if not base or tem_regra(regras, "button", base):
                continue
            linha = fonte[:pos].count("\n") + 1
            sem_estilo.append((nome, linha, "button", " ".join(base)))
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
