/* ================= TOTAL MATCH — salvamento local ================= */
/* Guarda configurações e carreiras no localStorage do navegador. */
(function (global) {
  "use strict";
  var TM = (global.TM = global.TM || {});
  var PREFIX = "totalmatch:";

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); if (TM._onSave) { try { TM._onSave(key); } catch (e) {} } return true; }
    catch (e) { return false; }
  }
  function remove(key) {
    try { localStorage.removeItem(PREFIX + key); if (TM._onSave) { try { TM._onSave(key); } catch (e) {} } } catch (e) {}
  }

  var DEFAULT_SETTINGS = {
    difficulty: "normal",   // facil | normal | dificil | lenda
    realism: 3,             // 1 (arcade) .. 5 (realista) — controla imprevisibilidade
    matchSpeed: "normal",   // instantaneo | rapido | normal
    commentary: true,
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
