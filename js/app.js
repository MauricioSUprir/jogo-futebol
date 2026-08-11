/* ================= TOTAL MATCH — inicialização ================= */
(function (global) {
  "use strict";
  var TM = global.TM;
  document.addEventListener("DOMContentLoaded", function () {
    TM.ui.init();
    // pré-gera o mundo (assíncrono leve, evita travar a splash)
    setTimeout(function () { TM.data.world(); }, 0);
    // link de convite (?join=CÓDIGO) → entra direto na sala online
    var joinCode = null;
    try { joinCode = new URLSearchParams(location.search).get("join"); } catch (e) {}
    if (joinCode && TM.net) {
      TM.ui.go("online");
      TM.net.onReady(function () { TM.ui.go("online-join", { code: String(joinCode).toUpperCase(), auto: true }); });
    } else {
      TM.ui.go("splash");
    }
  });
})(window);
