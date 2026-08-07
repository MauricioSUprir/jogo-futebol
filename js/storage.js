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
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }
  function remove(key) {
    try { localStorage.removeItem(PREFIX + key); } catch (e) {}
  }

  var DEFAULT_SETTINGS = {
    difficulty: "normal",   // facil | normal | dificil | lenda
    realism: 3,             // 1 (arcade) .. 5 (realista) — controla imprevisibilidade
    matchSpeed: "normal",   // instantaneo | rapido | normal
    commentary: true
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
    clearPlayerCareer: function () { remove("player"); }
  };
})(window);
