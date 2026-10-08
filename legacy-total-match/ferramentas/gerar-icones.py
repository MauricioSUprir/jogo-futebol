#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Gera js/icones.js: os ícones da interface e o mapa emoji -> ícone.

O jogo não usa emoji como ícone: o conversor de js/icones.js troca qualquer
emoji da interface pelo ícone equivalente (ou tira, se for enfeite). Para mudar
qual ícone um emoji vira, edite MAPA abaixo e rode:

    python3 ferramentas/gerar-icones.py

Os ícones vêm do Lucide (lucide.dev, licença ISC), baixados do jsDelivr numa
versão fixa e guardados em cache (~/.cache/tm-lucide). Bola, estádio, moeda,
gol, cartão e ponto são desenhados aqui (PROPRIOS), no mesmo traço.
"""
import io
import json
import os
import re
import urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.path.join(RAIZ, "js", "icones.js")
LUCIDE_VER = "1.52.0"
CACHE = os.environ.get("TM_LUCIDE_CACHE", os.path.join(os.path.expanduser("~"), ".cache", "tm-lucide", LUCIDE_VER))

# Mapa emoji -> icone. "nome" ou "nome cor". "" = some (rostinhos, bichos, enfeites).
# Os nomes sao do Lucide (ISC); os que comecam com "tm-" sao desenhados aqui.
MAPA = {
 "🏆":"trophy", "🪙":"tm-moeda ouro", "🤝":"handshake", "✅":"circle-check ok", "🎯":"target",
 "💰":"wallet", "🔥":"flame", "🔁":"arrow-left-right", "🌍":"globe", "⚽":"tm-bola", "📋":"clipboard-list",
 "💼":"briefcase", "🔄":"refresh-cw", "👑":"crown ouro", "🌱":"sprout", "🔭":"telescope", "🔒":"lock",
 "⭐":"star ouro", "👥":"users", "💬":"message-circle", "📜":"scroll-text", "📰":"newspaper", "⚡":"zap",
 "🔍":"search", "✍":"pen-line", "⚔":"swords", "📊":"chart-column", "💎":"gem", "🚪":"door-open",
 "🏟":"tm-estadio", "🚫":"ban erro", "⏳":"hourglass", "🎲":"dices", "🔴":"tm-ponto erro", "📈":"trending-up ok",
 "👤":"user", "📝":"notebook-pen", "👀":"eye", "📨":"mail", "➕":"plus", "💾":"save", "🛡":"shield",
 "⚠":"triangle-alert alerta", "🟢":"tm-ponto ok", "📅":"calendar", "👕":"shirt", "📄":"file-text",
 "🏖":"tree-palm", "✏":"pencil", "🏛":"landmark", "📉":"trending-down erro", "👏":"thumbs-up", "🏅":"medal",
 "💪":"biceps-flexed", "❌":"circle-x erro", "🚑":"ambulance", "🔎":"search", "👔":"briefcase-business",
 "🚨":"siren erro", "💸":"banknote", "🟥":"tm-cartao erro", "🗣":"megaphone", "🎖":"award", "🌐":"globe",
 "🎤":"mic", "📺":"tv", "↩":"undo-2", "🎉":"party-popper", "🥇":"medal ouro", "📤":"upload", "🏠":"house",
 "📣":"megaphone", "🗑":"trash-2", "🎙":"mic", "🧭":"compass", "⚪":"tm-ponto", "❤":"heart", "🏋":"dumbbell",
 "🌟":"sparkles", "🎁":"gift", "💥":"zap", "📢":"megaphone", "⚙":"settings", "☁":"cloud", "👋":"hand",
 "🗞":"newspaper", "🏦":"landmark", "✋":"hand", "✈":"plane", "📦":"package", "📷":"camera", "📱":"smartphone",
 "🔔":"bell", "🧑‍🏫":"presentation", "🗂":"folder-open", "🏗":"construction", "👆":"pointer", "🌎":"globe",
 "🏷":"tag", "💵":"banknote", "🪑":"armchair", "✨":"sparkles", "🧤":"tm-luva", "💚":"heart ok", "🙅":"ban",
 "🎰":"dices", "🔑":"key-round", "🔀":"shuffle", "🏁":"flag", "🆓":"tag", "🔧":"wrench", "🩼":"bandage",
 "💳":"credit-card", "🙏":"hand-heart", "🥅":"tm-gol", "🚌":"bus", "🤍":"heart", "🎮":"gamepad-2", "👁":"eye",
 "☀":"sun", "🌧":"cloud-rain", "⛈":"cloud-lightning", "⏰":"alarm-clock", "🎽":"shirt", "🗓":"calendar-days",
 "⏩":"fast-forward", "🎟":"ticket", "📐":"ruler", "🕵":"user-search", "💀":"skull", "🧱":"brick-wall",
 "🔢":"hash", "➖":"minus", "🥈":"medal prata", "🟨":"tm-cartao alerta", "🆕":"sparkle", "🛠":"hammer",
 "🎥":"video", "🥊":"swords", "💡":"lightbulb", "📑":"files", "🧪":"flask-conical", "🧩":"puzzle",
 "⬇":"arrow-down", "🎼":"music", "🌤":"cloud-sun", "⛅":"cloud-sun", "🧳":"luggage", "🥵":"thermometer-sun",
 "🕐":"clock", "⚖":"scale", "🧠":"brain", "👍":"thumbs-up", "👎":"thumbs-down", "🏥":"hospital", "🧬":"dna",
 "🎓":"graduation-cap", "🎭":"drama", "☎":"phone", "🛒":"shopping-cart", "🟡":"tm-ponto alerta",
 "⛔":"octagon-x erro", "⏸":"pause", "🔚":"flag", "⌛":"hourglass", "🚀":"rocket", "🥉":"medal bronze",
 "🔵":"tm-ponto info", "🏢":"building-2", "🔙":"arrow-left", "🧑‍💼":"briefcase-business", "🏳":"flag",
 "🎬":"clapperboard", "🏹":"target", "💱":"arrow-left-right", "⬆":"arrow-up", "🖊":"pen", "↔":"arrow-left-right",
 "➡":"arrow-right", "ℹ":"info", "🌦":"cloud-sun-rain", "🟩":"tm-ponto ok", "🌡":"thermometer", "📖":"book-open",
 "🎨":"palette", "🧹":"brush", "🎂":"cake", "📭":"mailbox", "📍":"map-pin", "❄":"snowflake", "↗":"arrow-up-right",
 "↘":"arrow-down-right", "📞":"phone", "📡":"satellite-dish", "🤖":"bot", "💻":"laptop", "🍽":"utensils",
 "🚗":"car", "🚚":"truck", "🔌":"plug", "📁":"folder", "🟠":"tm-ponto alerta", "📮":"mailbox", "📲":"smartphone",
 "💔":"heart-crack", "🎊":"party-popper", "🚩":"flag", "🏴":"flag", "🩺":"stethoscope", "👨‍👩‍👦":"users-round",
 "🧮":"calculator", "🧾":"receipt", "🧒":"baby", "🌙":"moon", "📸":"camera", "🍿":"popcorn", "🔝":"arrow-up",
 "📌":"pin", "❤‍🔥":"flame", "💣":"bomb", "📶":"wifi", "🐞":"bug", "👉":"arrow-right", "▶":"play", "🌑":"moon",
 "🔗":"link", "⚓":"anchor", "✔":"check ok", "✖":"x", "☑":"square-check ok", "⏬":"arrow-down", "⏫":"arrow-up",
 "🪪":"id-card", "🗳":"vote", "📆":"calendar", "⏱":"timer", "🔊":"volume-2", "🔇":"volume-x", "🔕":"bell-off",
 "♻":"recycle", "🏃":"tm-corre", "👨‍⚖️":"scale", "🧑‍⚕️":"stethoscope",
}
# humor: rostinho vira expressao em traco (na interface; em post e chat o emoji fica)
for _e in "😀😃😁😊🙂😎🤩🥳😍😉😜🤗🙃😇🤑": MAPA[_e] = "smile ok"
for _e in "😂🤣😅😆": MAPA[_e] = "laugh ok"
for _e in "😐😕😯😮🤔😏🫤😶🙄": MAPA[_e] = "meh"
for _e in "😞😢😭😔😬😴🥶🥵😟😓😩😫😰😱": MAPA[_e] = "frown alerta"
for _e in "😡😠😤🤬🤯👿": MAPA[_e] = "angry erro"
MAPA["🎿"] = "send"   # "Jogo direto": lançamento longo


def interno(nome):
    """Conteúdo de dentro do <svg> de um ícone do Lucide (baixa se faltar)."""
    os.makedirs(CACHE, exist_ok=True)
    arq = os.path.join(CACHE, nome + ".svg")
    if not os.path.exists(arq) or not os.path.getsize(arq):
        url = "https://cdn.jsdelivr.net/npm/lucide-static@%s/icons/%s.svg" % (LUCIDE_VER, nome)
        req = urllib.request.Request(url, headers={"User-Agent": "TotalMatch/1.0 gerar-icones"})
        with urllib.request.urlopen(req, timeout=60) as r:
            io.open(arq, "wb").write(r.read())
    s = io.open(arq, encoding="utf-8").read()
    corpo = s[s.index(">", s.index("<svg")) + 1: s.rindex("</svg>")]
    corpo = re.sub(r"<!--.*?-->", "", corpo, flags=re.S)
    corpo = re.sub(r"\s+", " ", corpo).strip()
    corpo = re.sub(r"\s*/>", "/>", corpo).replace("> <", "><")
    if "<script" in corpo or re.search(r"\son\w+=", corpo):
        raise SystemExit("ícone suspeito: " + nome)
    return corpo


PROPRIOS = {
  # bola de futebol em traço (o Lucide nao tem)
  "tm-bola": '<circle cx="12" cy="12" r="10"/><path d="m12 7.2 3.4 2.5-1.3 4H9.9l-1.3-4z"/>'
             '<path d="M12 2v5.2M15.4 9.7l5.8-1.9M14.1 13.7l3.5 4.9M9.9 13.7l-3.5 4.9M8.6 9.7 2.8 7.8"/>',
  # estadio: anel da arquibancada + duas torres de luz
  "tm-estadio": '<ellipse cx="12" cy="13" rx="9" ry="3.6"/><path d="M3 13v3.2c0 2 4 3.8 9 3.8s9-1.8 9-3.8V13"/>'
                '<path d="M6.5 9.8V4.5M17.5 9.8V4.5M4.8 4.5h3.4M15.8 4.5h3.4"/>',
  # moeda do jogo (Total Coins): anel duplo com o T
  "tm-moeda": '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.6"/><path d="M10 10.2h4M12 10.2V14"/>',
  # gol com rede
  "tm-gol": '<path d="M3.5 19V6.5h17V19"/><path d="M1.5 19h21"/>'
            '<path d="M3.5 10.6h17M3.5 14.8h17M7.8 6.5V19M12 6.5V19M16.2 6.5V19" opacity=".45"/>',
  # cartao (vermelho/amarelo pela cor) e ponto de status: preenchidos
  "tm-cartao": '<rect x="7.2" y="3" width="9.6" height="15.5" rx="1.6" transform="rotate(10 12 10.75)"/>',
  "tm-ponto": '<circle cx="12" cy="12" r="5.5"/>',
}
CHEIOS = ["tm-cartao", "tm-ponto"]
APELIDOS = {"tm-luva": "hand", "tm-corre": "footprints"}

usados = set()
for v in MAPA.values():
    if v: usados.add(v.split()[0])
for a, b in APELIDOS.items():
    if a in usados: usados.add(b)
EXTRA = ["chevron-left", "chevron-right", "chevron-down", "x", "check", "menu", "ellipsis", "bell", "settings", "user", "message-circle", "house", "users", "clipboard-list", "arrow-left-right", "telescope", "globe", "log-out", "plus", "minus", "search", "sliders-horizontal", "arrow-up-down", "list", "grid-2x2", "store", "layers", "chart-line", "activity",
         "message-circle", "house", "users", "clipboard-list", "arrow-left-right", "telescope", "globe"]
usados.update(EXTRA)


def main():
    icones = {}
    for n in sorted(usados):
        if n in PROPRIOS:
            icones[n] = PROPRIOS[n]
        elif n in APELIDOS:
            continue
        else:
            icones[n] = interno(n)
    for a, b in APELIDOS.items():
        icones[a] = icones[b]
    mapa = {}
    for e, v in MAPA.items():
        if not v:
            continue
        partes = v.split()
        mapa[e] = [partes[0], partes[1] if len(partes) > 1 else ""]
    js = MODELO
    js = js.replace("/*ICONES*/{}", json.dumps(icones, ensure_ascii=False, separators=(",", ":")).replace('","', '",\n    "'))
    js = js.replace("/*MAPA*/{}", json.dumps(mapa, ensure_ascii=False, separators=(",", ":")).replace('],"', '],\n    "'))
    js = js.replace("/*CHEIOS*/[]", json.dumps(CHEIOS))
    io.open(SAIDA, "w", encoding="utf-8").write(js)
    print("js/icones.js: %d ícones, %d emojis mapeados, %d bytes" % (len(icones), len(mapa), len(js.encode("utf-8"))))


MODELO = r'''/* ================= TOTAL MATCH — ícones da interface =================
   Ícones em traço no lugar dos emojis. A maioria vem do Lucide (lucide.dev,
   licença ISC — aviso no fim deste comentário); bola, estádio, moeda, gol,
   cartão e ponto foram desenhados aqui, no mesmo traço.

   O conversor olha tudo o que entra na tela (MutationObserver) e troca cada
   emoji pelo ícone equivalente — ou tira, quando é enfeite (rostinho, bicho).
   Assim as ~190 telas mudam juntas, sem reescrever uma por uma, e qualquer
   emoji que alguém escrever no futuro já aparece como ícone.
   O emoji continua onde é CONTEÚDO escrito por alguém: post de torcedor,
   comentário e mensagem de chat (veja MANTER).
   ESTE ARQUIVO É GERADO por ferramentas/gerar-icones.py — mude o mapa lá.

   Lucide — ISC License. Copyright (c) Lucide Icons and Contributors.
   Permission to use, copy, modify, and/or distribute this software for any
   purpose with or without fee is hereby granted, provided that the above
   copyright notice and this permission notice appear in all copies.
   THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
   WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
   MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
   ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
   WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
   ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
   OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
   (Partes do Lucide vêm do Feather — MIT, Copyright (c) 2013-2023 Cole Bemis.)
*/
(function (global) {
  "use strict";
  var TM = (global.TM = global.TM || {});
  var NS = "http://www.w3.org/2000/svg";

  // nome -> conteúdo do SVG (caixa 24x24, traço)
  var ICONES = /*ICONES*/{};
  // emoji (sem o seletor de variação) -> [ícone, cor]
  var MAPA = /*MAPA*/{};
  // ícones desenhados com preenchimento, não com traço
  var CHEIOS = /*CHEIOS*/[];

  /* ---------- criar um ícone ---------- */
  var moldes = {};
  function molde(nome) {
    var m = moldes[nome];
    if (!m) {
      m = document.createElementNS(NS, "svg");
      m.setAttribute("viewBox", "0 0 24 24");
      m.setAttribute("aria-hidden", "true");
      m.setAttribute("focusable", "false");
      m.innerHTML = ICONES[nome];
      moldes[nome] = m;           // clonar é bem mais rápido do que interpretar de novo
    }
    return m;
  }
  function ic(nome, cls) {
    if (!ICONES[nome]) return document.createTextNode("");
    var s = molde(nome).cloneNode(true);
    s.setAttribute("class", "tm-ic ic-" + nome + (CHEIOS.indexOf(nome) >= 0 ? " cheio" : "") + (cls ? " " + cls : ""));
    return s;
  }

  /* ---------- reconhecer emoji ---------- */
  // Extended_Pictographic pega o emoji e também os símbolos que o iPhone desenha
  // como emoji mesmo sem o seletor (⚠ ⚙ ✈ ❤...). Bandeiras (letras regionais),
  // ★ ☆ ✓ ✕ · → ficam de fora: são tipografia, não emoji.
  var RE = null;
  try {
    RE = new RegExp("\\p{Extended_Pictographic}[\\uFE0E\\uFE0F]?[\\u{1F3FB}-\\u{1F3FF}]?" +
      "(?:\\u200D\\p{Extended_Pictographic}[\\uFE0E\\uFE0F]?[\\u{1F3FB}-\\u{1F3FF}]?)*", "gu");
  } catch (e) {
    // navegador antigo sem propriedades Unicode: pega as faixas principais
    RE = /(?:[☀-➿⬀-⯿]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDD00-\uDFFF])[︎️]?/g;
  }
  // símbolos tipográficos que o Unicode também classifica como pictográficos e
  // que ficam como texto: © ® ™ ‼ ⁉ e as estrelas ★ ☆ (nota, favorito do mercado).
  // O Chrome novo marca ★ como pictográfico; sem isto o botão de favoritar,
  // que alterna ★/☆, ficava vazio quando marcado.
  var TEXTO = { "©": 1, "®": 1, "™": 1, "‼": 1, "⁉": 1, "★": 1, "☆": 1 };
  function chave(e) { return e.replace(/[︎️]/g, "").replace(/[\u{1F3FB}-\u{1F3FF}]/gu, ""); }
  function achaIcone(e) {
    var k = chave(e);
    if (MAPA[k]) return MAPA[k];
    var base = k.split("‍")[0];          // sequência com ZWJ: vale o primeiro
    return MAPA[base] || null;
  }
  function temEmoji(v) { RE.lastIndex = 0; return RE.test(v); }

  /* ---------- onde trocar, onde só tirar, onde deixar ---------- */
  // conteúdo escrito por alguém: o emoji fica
  var MANTER = ".post-text, .pc-txt, .tm-bub-tx, .chat-bubble, [data-emoji]";
  // título de tela e lugares que não aceitam SVG: o emoji só some
  var SO_TIRA = ".tb-title, h1, title, option, select, textarea";

  var inseridos = new WeakMap();   // nó de texto -> nós que o conversor pôs logo depois dele

  function trataTexto(t) {
    var antigos = inseridos.get(t);
    if (antigos) {                 // o texto mudou: desfaz a conversão anterior
      for (var a = 0; a < antigos.length; a++) if (antigos[a].parentNode) antigos[a].parentNode.removeChild(antigos[a]);
      inseridos.delete(t);
    }
    var v = t.nodeValue;
    if (!v || !temEmoji(v)) return;
    var pai = t.parentNode;
    if (!pai || pai.nodeType !== 1 || pai.namespaceURI === NS) return;
    var tag = pai.nodeName;
    if (tag === "SCRIPT" || tag === "STYLE") return;
    if (pai.closest && pai.closest(MANTER)) return;
    var soTira = !!(pai.closest && pai.closest(SO_TIRA));

    // quebra em pedaços: texto, emoji, texto...
    var pedacos = [], ult = 0, m;
    RE.lastIndex = 0;
    while ((m = RE.exec(v))) {
      var e = m[0];
      if (TEXTO[chave(e)]) continue;
      pedacos.push(v.slice(ult, m.index));
      pedacos.push({ e: e });
      ult = m.index + e.length;
    }
    if (!pedacos.length) return;
    pedacos.push(v.slice(ult));

    // tira um espaço sobrando onde o emoji sumiu
    var nos = [];
    for (var i = 0; i < pedacos.length; i++) {
      var p = pedacos[i];
      if (typeof p === "string") { nos.push(p); continue; }
      var alvo = soTira ? null : achaIcone(p.e);
      if (alvo) { nos.push(ic(alvo[0], alvo[1] ? "ic-" + alvo[1] : "")); continue; }
      var antes = nos.length ? nos[nos.length - 1] : "";
      var depois = pedacos[i + 1];
      if (typeof depois === "string" && (antes === "" || /\s$/.test(antes))) pedacos[i + 1] = depois.replace(/^\s+/, "");
    }
    // o 1º pedaço fica no próprio nó de texto: quem guardou referência a ele continua valendo
    var primeiro = typeof nos[0] === "string" ? nos.shift() : "";
    t.nodeValue = primeiro;
    var novos = [], frag = document.createDocumentFragment();
    for (var j = 0; j < nos.length; j++) {
      var n = typeof nos[j] === "string" ? document.createTextNode(nos[j]) : nos[j];
      if (typeof nos[j] === "string" && !nos[j]) continue;
      frag.appendChild(n); novos.push(n);
    }
    if (novos.length) { pai.insertBefore(frag, t.nextSibling); inseridos.set(t, novos); }
  }

  var ATRIBUTOS = ["placeholder", "title", "aria-label"];
  function limpaAtributos(el) {
    for (var i = 0; i < ATRIBUTOS.length; i++) {
      var v = el.getAttribute(ATRIBUTOS[i]);
      if (v && temEmoji(v)) {
        RE.lastIndex = 0;
        el.setAttribute(ATRIBUTOS[i], v.replace(RE, function (e) { return TEXTO[chave(e)] ? e : ""; }).replace(/\s{2,}/g, " ").trim());
      }
    }
  }

  function trataNo(no) {
    if (!no) return;
    if (no.nodeType === 3) { trataTexto(no); return; }
    if (no.nodeType !== 1 || no.namespaceURI === NS) return;
    if (no.closest && no.closest(MANTER)) return;
    limpaAtributos(no);
    var com = no.querySelectorAll ? no.querySelectorAll("[placeholder],[title],[aria-label]") : [];
    for (var k = 0; k < com.length; k++) limpaAtributos(com[k]);
    var w = document.createTreeWalker(no, NodeFilter.SHOW_TEXT, null), lista = [], t;
    while ((t = w.nextNode())) if (t.nodeValue && temEmoji(t.nodeValue)) lista.push(t);
    for (var i = 0; i < lista.length; i++) trataTexto(lista[i]);
  }

  var obs = null;
  function liga() {
    if (obs || !global.MutationObserver || !document.body) return;
    obs = new MutationObserver(function (registros) {
      for (var i = 0; i < registros.length; i++) {
        var r = registros[i];
        if (r.type === "characterData") trataTexto(r.target);
        else for (var j = 0; j < r.addedNodes.length; j++) trataNo(r.addedNodes[j]);
      }
      obs.takeRecords();             // descarta as mudanças que o próprio conversor fez
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    trataNo(document.body);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", liga);
  else liga();

  TM.ic = ic;
  TM.icones = { tem: function (n) { return !!ICONES[n]; }, doEmoji: achaIcone, converte: trataNo };
})(window);
'''


if __name__ == "__main__":
    main()
