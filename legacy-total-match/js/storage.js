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
  function prefixFor(ed) { return ed === "pro" ? PRO_PREFIX : BASE; }
  // carimbo de modificação por chave (sincronização entre aparelhos: o mais novo vence)
  var TS = "totalmatch:__ts:";
  function stamp(fullKey, t) { try { localStorage.setItem(TS + fullKey, String(t || Date.now())); } catch (e) {} }
  function tsOf(fullKey) { try { return parseInt(localStorage.getItem(TS + fullKey) || "0", 10) || 0; } catch (e) { return 0; } }

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(prefix() + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(prefix() + key, JSON.stringify(value)); stamp(prefix() + key); if (TM._onSave) { try { TM._onSave(key, edition); } catch (e) {} } return true; }
    catch (e) { return false; }
  }
  function remove(key) {
    try { localStorage.removeItem(prefix() + key); stamp(prefix() + key); if (TM._onSave) { try { TM._onSave(key, edition); } catch (e) {} } } catch (e) {}
  }
  // acesso "cru" por edição, sem disparar a sincronização (usado pela própria sincronização)
  function readRaw(ed, key) { try { var raw = localStorage.getItem(prefixFor(ed) + key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
  function writeRaw(ed, key, value, t) { try { localStorage.setItem(prefixFor(ed) + key, JSON.stringify(value)); stamp(prefixFor(ed) + key, t); return true; } catch (e) { return false; } }
  function removeRaw(ed, key, t) { try { localStorage.removeItem(prefixFor(ed) + key); stamp(prefixFor(ed) + key, t); } catch (e) {} }
  function tsRaw(ed, key) { return tsOf(prefixFor(ed) + key); }
  function touchRaw(ed, key, t) { stamp(prefixFor(ed) + key, t); }
  // pertence à edição ATUAL? (público exclui as chaves "pro:" e a flag de edição)
  function inCurrentEdition(k) {
    if (!k || k.indexOf(BASE) !== 0) return false;
    if (k === EDITION_KEY) return false;
    if (edition === "pro") return k.indexOf(PRO_PREFIX) === 0;
    return k.indexOf(PRO_PREFIX) !== 0; // público: tudo menos as chaves pro:
  }

  var DEFAULT_SETTINGS = {
    difficulty: "normal",   // facil | normal | dificil | lenda
    realism: 4,             // 1 (arcade) .. 5 (simulação) — quanto a qualidade dos elencos pesa no resultado (média de gols não muda)
    matchSpeed: "normal",   // instantaneo | rapido | normal
    commentary: true,
    dynamicOverall: false,  // overall sobe/desce por confiança e desempenho (carreira/competições)
    rivalry: true,          // rivalidades: clássicos + transferências raras entre rivais
    evoRate: "media",       // taxa de evolução dos atletas: rapida | media | demorada
    theme: "dark"           // dark (preto+verde) | light (branco+verde)
  };

  TM.storage = {
    read: read, write: write, remove: remove,
    readRaw: readRaw, writeRaw: writeRaw, removeRaw: removeRaw, tsRaw: tsRaw, touchRaw: touchRaw,
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
