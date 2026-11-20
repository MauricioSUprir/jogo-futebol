/* ================= TOTAL MATCH — RNG determinístico ================= */
/* Gerador de números pseudoaleatórios com semente, para que o "mundo"
   do jogo (ligas, clubes, jogadores) seja SEMPRE o mesmo a cada abertura.
   Isso é essencial para salvar carreiras e para as fotos por convenção de nome. */
(function (global) {
  "use strict";

  // mulberry32 — rápido e estável
  function makeRng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // FNV-1a de 32 bits de um texto (a semente de um sorteio que todo aparelho refaz igual)
  function hashStr(s) {
    var h = 2166136261; s = String(s);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  // roda fn() com o Math.random preso à semente (um texto) e devolve o que ela retornar;
  // o Math.random volta ao original mesmo com erro. Iguais aos de copa.js (o mesmo sorteio)
  function comSemente(semente, fn) {
    var orig = Math.random;
    Math.random = makeRng(hashStr(semente));
    try { return fn(); } finally { Math.random = orig; }
  }

  var TM = (global.TM = global.TM || {});
  TM.rng = {
    make: makeRng,
    hashStr: hashStr,
    comSemente: comSemente,
    // helpers construídos sobre uma função rng()
    int: function (rng, min, max) { return Math.floor(rng() * (max - min + 1)) + min; },
    pick: function (rng, arr) { return arr[Math.floor(rng() * arr.length)]; },
    chance: function (rng, p) { return rng() < p; },
    // distribuição aproximadamente normal (soma de uniformes), útil p/ atributos
    gaussian: function (rng, mean, spread) {
      var s = (rng() + rng() + rng() + rng() - 2) / 2; // ~[-1,1]
      return Math.round(mean + s * spread);
    }
  };
})(window);
