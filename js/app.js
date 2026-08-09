/* ================= TOTAL MATCH — inicialização ================= */
(function (global) {
  "use strict";
  var TM = global.TM;
  document.addEventListener("DOMContentLoaded", function () {
    TM.ui.init();
    // pré-gera o mundo (assíncrono leve, evita travar a splash)
    setTimeout(function () { TM.data.world(); }, 0);
    TM.ui.go("splash");
  });
})(window);
