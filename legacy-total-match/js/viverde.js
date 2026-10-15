/* ================= VIVERDE FC — time especial (pedido do dono, 15/10) =================
   Um time fixo, nas duas edições (pro e pública), com o elenco montado pelo dono. Para jogar com ele é preciso a
   senha, no jogo rápido e na carreira; acertou uma vez, o aparelho lembra. A senha NÃO fica no código: só o SHA-256
   dela (conferido por crypto.subtle; reserva em JS puro onde ele não existe).
   - Jogo rápido: o clube "viverde" (fora das ligas: não entra em campeonato, mercado nem convocação — `especial`).
   - Carreira: o Viverde FC entra no lugar de um clube da liga escolhida (o mesmo caminho do "Criar meu próprio
     clube": customClub com fixo = "viverde"; data.js applyCustomClub monta o elenco daqui).
   Posições: `posicoes` = funções em que o jogador atua sem perder nota; `notaPos` = nota própria numa função (Para:
   84 de zagueiro); `todas` = nenhuma penalidade em posição nenhuma (Guilherme). competitions.js lê esses campos. */
(function (global) {
  "use strict";
  var TM = global.TM = global.TM || {};

  var ID = "viverde";
  var HASH = "78205d6cb1dbb83879cfbcb2c893d768729ec3df69420323276ada2882f9ea61";
  var CHAVE_OK = "tm:viverde:liberado";
  var ESCUDO = "assets/viverde/escudo.svg";
  var CORES = { primary: "#16a34a", secondary: "#ffffff" };
  var ESTADIO = { name: "Arena Viverde", capacity: 40000 };

  var GRUPO = { GOL: "GK", ZAG: "DF", LD: "DF", LE: "DF", VOL: "MF", MC: "MF", MEI: "MF", MD: "MF", ME: "MF", PD: "FW", PE: "FW", CA: "FW", SA: "FW" };
  // o elenco do dono: [nome, posições (a 1ª é a principal), overall, idade, camisa, extras]
  var ELENCO = [
    ["Miguel", ["GOL"], 79, 24, 1],
    ["Bernardo", ["LD", "VOL", "MC"], 83, 22, 2],
    ["Alexandre", ["ZAG", "LE"], 86, 25, 3],
    ["Matheus", ["ZAG", "CA"], 81, 21, 4],
    ["Pedrete", ["MC", "VOL"], 85, 23, 5],
    ["Alberto", ["LE", "MC"], 87, 26, 6],
    ["Pedro", ["PE", "PD", "CA"], 92, 24, 7],
    ["Andrey", ["LD", "LE", "VOL", "MEI"], 92, 25, 8],
    ["Henrique", ["CA", "PE"], 87, 23, 9],
    ["Leo", ["MEI"], 88, 22, 10],
    ["Gustavo", ["MEI", "LE", "LD", "PE"], 89, 24, 11],
    ["Para", ["GOL", "ZAG"], 87, 26, 12, { notaPos: { ZAG: 84 } }],
    ["Luquinhas", ["ZAG", "PD", "PE"], 82, 20, 13],
    ["Mauricio", ["LD", "LE", "PD", "PE"], 84, 21, 14, { fixos: { pac: 99 } }],
    ["Mini Messi", ["PE", "PD", "CA"], 83, 19, 15],
    ["Guilherme", ["MEI"], 99, 27, 16, { todas: true, fixos: { pac: 98, sho: 99, pas: 99, dri: 99, def: 99, phy: 99 } }],
    ["JV", ["GOL", "ZAG"], 87, 23, 17]
  ];
  // pesos da nota por grupo (os mesmos de data.js overallFrom)
  var PESOS = {
    GK: { def: .7, phy: .2, pas: .1, pac: 0, sho: 0, dri: 0 },
    DF: { def: .5, phy: .25, pac: .15, pas: .1, sho: 0, dri: 0 },
    FW: { sho: .4, pac: .2, dri: .25, phy: .1, pas: .05, def: 0 },
    MF: { pas: .3, dri: .25, phy: .15, def: .15, sho: .1, pac: .05 }
  };
  // perfil por grupo (atributos fora do peso, só para o desenho e o 3D): quanto fica abaixo da nota
  var FORA = { GK: { sho: -30, pac: -10, dri: -25 }, DF: { sho: -14, dri: -8 }, FW: { def: -25 }, MF: {} };
  function nota(a, g) { var w = PESOS[g], s = 0; Object.keys(w).forEach(function (k) { s += (a[k] || 0) * w[k]; }); return Math.round(s); }
  // atributos que dão EXATAMENTE a nota pedida no grupo principal (pela conta do TM), respeitando os fixos
  function atributos(ov, g, fixos) {
    fixos = fixos || {};
    var a = {}, w = PESOS[g], f = FORA[g] || {};
    ["pac", "sho", "pas", "dri", "def", "phy"].forEach(function (k) { a[k] = fixos[k] != null ? fixos[k] : Math.max(20, Math.min(99, ov + (w[k] ? 0 : (f[k] || -6)))); });
    // o atributo livre de maior peso corrige a diferença (até bater a nota)
    var livres = Object.keys(w).filter(function (k) { return w[k] > 0 && fixos[k] == null; }).sort(function (x, y) { return w[y] - w[x]; });
    for (var it = 0; it < 40 && nota(a, g) !== ov && livres.length; it++) {
      var d = ov - nota(a, g), k = livres[it % livres.length];
      a[k] = Math.max(20, Math.min(99, a[k] + (d > 0 ? 1 : -1) * Math.max(1, Math.round(Math.abs(d) / w[k] / livres.length))));
    }
    return a;
  }
  /** Os jogadores do Viverde (objetos de jogador do TM) para o clube `clubId`, com ids `prefixo + n`. */
  function jogadores(clubId, prefixo, extra) {
    return ELENCO.map(function (e, i) {
      var pos2 = e[1][0], g = GRUPO[pos2], x = e[5] || {};
      var p = {
        id: prefixo + i, name: e[0], clubId: clubId, pos: g, pos2: pos2, age: e[3], overall: e[2],
        potential: Math.min(99, e[2] + (e[3] <= 21 ? 3 : e[3] <= 24 ? 1 : 0)), attrs: atributos(e[2], g, x.fixos),
        nationId: null, nationName: "Brasil", height: g === "GK" ? 188 : 178, weight: g === "GK" ? 82 : 74, form: 0, goals: 0,
        number: e[4], posicoes: e[1].slice()
      };
      if (x.notaPos) p.notaPos = x.notaPos;
      if (x.todas) p.todas = true;
      if (extra) Object.keys(extra).forEach(function (k) { p[k] = extra[k]; });
      return p;
    });
  }
  /** O clube do jogo rápido (fora das ligas) no mundo recém-gerado (data.js generateWorld). Edições pro e pública. */
  function registrar(clubsById, playersById, nations) {
    if (clubsById[ID]) return;
    var bra = null; (nations || []).forEach(function (n) { if (!bra && (n.key === "Brazil" || n.name === "Brasil")) bra = n; });
    var ps = jogadores(ID, "vvd", { especial: true, nationId: bra ? bra.id : null, nationName: bra ? bra.name : "Brasil" });
    ps.forEach(function (p) { playersById[p.id] = p; });
    clubsById[ID] = {
      id: ID, name: "Viverde FC", origName: "Viverde FC", short: "VFC", colors: { primary: CORES.primary, secondary: CORES.secondary },
      crestData: ESCUDO, leagueId: "br", homeLeagueId: "br", strength: 90, playerIds: ps.map(function (p) { return p.id; }),
      especial: true, estadio: ESTADIO, coach: "Técnico Viverde"
    };
  }
  /** Carreira: põe o Viverde no lugar do clube `club` (customClub com fixo "viverde"; data.js applyCustomClub). */
  function aplicarNoSlot(club, playersById, nations) {
    var bra = null; (nations || []).forEach(function (n) { if (!bra && (n.key === "Brazil" || n.name === "Brasil")) bra = n; });
    club.name = "Viverde FC"; club.short = "VFC"; club.colors = { primary: CORES.primary, secondary: CORES.secondary };
    club.crestData = ESCUDO; club.custom = true; club.viverde = true; club.estadio = ESTADIO; club.strength = 90;
    var ps = jogadores(club.id, "ccv", { nationId: bra ? bra.id : null, nationName: bra ? bra.name : "Brasil" });
    ps.forEach(function (p) { playersById[p.id] = p; });
    club.playerIds = ps.map(function (p) { return p.id; });
  }

  /* ---------- senha ---------- */
  function liberado() { try { return localStorage.getItem(CHAVE_OK) === "1"; } catch (e) { return false; } }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return (b < 16 ? "0" : "") + b.toString(16); }).join(""); }
  // SHA-256 em JS puro (reserva para quando crypto.subtle não existe: página fora de https)
  function sha256(txt) {
    var b = unescape(encodeURIComponent(txt)), K = [], H = [], i, j;
    function frac(x) { return ((x - Math.floor(x)) * 4294967296) | 0; }
    for (var n = 2, c = 0; c < 64; n++) { var pr = true; for (j = 2; j * j <= n; j++) if (n % j === 0) { pr = false; break; } if (pr) { if (c < 8) H[c] = frac(Math.pow(n, 1 / 2)); K[c++] = frac(Math.pow(n, 1 / 3)); } }
    var l = b.length, w = [];
    for (i = 0; i < l; i++) w[i >> 2] |= b.charCodeAt(i) << (24 - (i % 4) * 8);
    w[l >> 2] |= 0x80 << (24 - (l % 4) * 8);
    w[((l + 8) >> 6 << 4) + 15] = l * 8;
    function r(x, s) { return (x >>> s) | (x << (32 - s)); }
    for (i = 0; i < w.length; i += 16) {
      var W = [], a = H[0], bb = H[1], cc = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (j = 0; j < 64; j++) {
        if (j < 16) W[j] = w[i + j] | 0;
        else { var s0 = r(W[j - 15], 7) ^ r(W[j - 15], 18) ^ (W[j - 15] >>> 3), s1 = r(W[j - 2], 17) ^ r(W[j - 2], 19) ^ (W[j - 2] >>> 10); W[j] = (W[j - 16] + s0 + W[j - 7] + s1) | 0; }
        var t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[j] + W[j]) | 0;
        var t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & bb) ^ (a & cc) ^ (bb & cc))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = cc; cc = bb; bb = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + bb) | 0; H[2] = (H[2] + cc) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(function (x) { return ("00000000" + (x >>> 0).toString(16)).slice(-8); }).join("");
  }
  function conferir(txt) {
    try {
      if (global.crypto && global.crypto.subtle && global.TextEncoder) {
        return global.crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt)).then(function (b) { return hex(b) === HASH; }, function () { return sha256(txt) === HASH; });
      }
    } catch (e) {}
    return Promise.resolve(sha256(txt) === HASH);
  }
  /** Pede a senha (se ainda não liberado) e chama ok() quando estiver liberado. */
  function pedirSenha(ok) {
    if (liberado()) { ok(); return; }
    var el = TM.ui.el;
    var campo = el("input", { class: "text-input vv-senha", type: "password", autocomplete: "off", placeholder: "Senha", "aria-label": "Senha do Viverde FC" });
    var ov = el("div", { class: "ut-sheet vv-sheet" });
    function fecha() { ov.classList.remove("show"); setTimeout(function () { ov.remove(); }, 200); }
    function tenta() {
      var v = campo.value || "";
      conferir(v).then(function (certo) {
        if (!certo) { TM.ui.toast("Senha incorreta", "erro"); campo.value = ""; campo.focus(); return; }
        try { localStorage.setItem(CHAVE_OK, "1"); } catch (e) {}
        fecha(); TM.ui.toast("Viverde FC liberado", "ok"); ok();
      });
    }
    campo.addEventListener("keydown", function (e) { if (e.key === "Enter") tenta(); });
    ov.appendChild(el("div", { class: "ut-sheet-in vv-sheet-in" }, [
      el("div", { class: "ut-sheet-h" }, [el("span", { text: "Viverde FC" }), el("button", { class: "ut-x", type: "button", "aria-label": "Fechar", on: { click: fecha } }, [TM.ic("x")])]),
      el("div", { class: "vv-topo" }, [el("img", { class: "vv-escudo", src: ESCUDO, alt: "" }),
        el("p", { class: "vv-txt", text: "Time protegido. Digite a senha para jogar com o Viverde FC." })]),
      campo,
      el("div", { class: "vv-bts" }, [
        el("button", { class: "btn ghost", type: "button", text: "Cancelar", on: { click: fecha } }),
        el("button", { class: "btn primary", type: "button", text: "Liberar", on: { click: tenta } })
      ])
    ]));
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add("show"); campo.focus(); });
  }

  TM.viverde = {
    ID: ID, ESCUDO: ESCUDO, ELENCO: ELENCO,
    registrar: registrar, aplicarNoSlot: aplicarNoSlot, jogadores: jogadores, atributos: atributos, nota: nota,
    liberado: liberado, pedirSenha: pedirSenha, conferir: conferir, _sha256: sha256
  };
})(window);
