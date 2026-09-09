/* ================= TOTAL MATCH — salvamento local ================= */
/* Guarda configurações e carreiras no localStorage do navegador. */
(function (global) {
  "use strict";
  var TM = (global.TM = global.TM || {});
  var BASE = "totalmatch:";
  var EDITION_KEY = "totalmatch:__edition";
  var PRO_PREFIX = "totalmatch:pro:";
  // edição atual: "public" (padrão, vendável) ou "pro" (Season Update, pessoal/licenciado)
  var edition = "public";
  try { var _e = localStorage.getItem(EDITION_KEY); if (_e === "pro") edition = "pro"; } catch (e) {}
  // prefixo dos saves por edição: público mantém "totalmatch:" (não quebra carreiras já salvas),
  // Season Update usa "totalmatch:pro:" — assim as duas edições têm saves separados.
  function prefix() { return edition === "pro" ? PRO_PREFIX : BASE; }

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(prefix() + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(prefix() + key, JSON.stringify(value)); if (TM._onSave) { try { TM._onSave(key); } catch (e) {} } return true; }
    catch (e) { return false; }
  }
  function remove(key) {
    try { localStorage.removeItem(prefix() + key); if (TM._onSave) { try { TM._onSave(key); } catch (e) {} } } catch (e) {}
  }
  // pertence à edição ATUAL? (público exclui as chaves "pro:" e a flag de edição)
  function inCurrentEdition(k) {
    if (!k || k.indexOf(BASE) !== 0) return false;
    if (k === EDITION_KEY) return false;
    if (edition === "pro") return k.indexOf(PRO_PREFIX) === 0;
    return k.indexOf(PRO_PREFIX) !== 0; // público: tudo menos as chaves pro:
  }

  var DEFAULT_SETTINGS = {
    difficulty: "normal",   // facil | normal | dificil | lenda
    realism: 3,             // 1 (arcade) .. 5 (realista) — controla imprevisibilidade
    matchSpeed: "normal",   // instantaneo | rapido | normal
    commentary: true,
    dynamicOverall: false,  // overall sobe/desce por confiança e desempenho (carreira/competições)
    rivalry: true,          // rivalidades: clássicos + transferências raras entre rivais
    evoRate: "media",       // taxa de evolução dos atletas: rapida | media | demorada
    theme: "dark"           // dark (preto+verde) | light (branco+verde)
  };

  TM.storage = {
    read: read, write: write, remove: remove,
    settings: function () {
      var s = read("settings", {});
      return Object.assign({}, DEFAULT_SETTINGS, s);
    },
    saveSettings: function (s) { write("settings", s); },
    defaultSettings: function () { return Object.assign({}, DEFAULT_SETTINGS); },

    // carreiras
    coachCareer: function () { return read("coach", null); },
    saveCoachCareer: function (c) { write("coach", c); },
    clearCoachCareer: function () { remove("coach"); },

    playerCareer: function () { return read("player", null); },
    savePlayerCareer: function (c) { write("player", c); },
    clearPlayerCareer: function () { remove("player"); },

    // edição do jogo: "public" (vendável) ou "pro" (Season Update, pessoal)
    edition: function () { return edition; },
    setEdition: function (e) {
      edition = (e === "pro") ? "pro" : "public";
      try { localStorage.setItem(EDITION_KEY, edition); } catch (er) {}
      return edition;
    },

    // apaga os dados do jogo DA EDIÇÃO ATUAL (carreiras, saves, perfil, config) — "zerar o app"
    wipeAll: function () {
      try {
        var keys = [];
        for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (inCurrentEdition(k)) keys.push(k); }
        keys.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
        if (TM._onSave) { try { TM._onSave("*"); } catch (e) {} }
        return true;
      } catch (e) { return false; }
    },

    // ---- biblioteca de jogos salvos (várias carreiras/competições) ----
    listSaves: function () { return read("saves", []); },
    saveGame: function (rec) {
      var s = read("saves", []);
      rec.id = "sv" + Date.now() + Math.floor(Math.random() * 1000);
      rec.ts = Date.now();
      s.unshift(rec);
      write("saves", s);
      return rec.id;
    },
    getSave: function (id) { return read("saves", []).filter(function (r) { return r.id === id; })[0]; },
    removeSave: function (id) { write("saves", read("saves", []).filter(function (r) { return r.id !== id; })); }
  };
})(window);
