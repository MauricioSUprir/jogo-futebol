/* ================= TOTAL MATCH — inicialização ================= */
(function (global) {
  "use strict";
  var TM = global.TM;
  document.addEventListener("DOMContentLoaded", function () {
    TM.ui.init();
    // pré-gera o mundo (assíncrono leve, evita travar a splash)
    setTimeout(function () { TM.data.world(); }, 0);
    // link de convite (?join=CÓDIGO) → entra direto na sala online
    var joinCode = null, joinGc = null;
    try { var q = new URLSearchParams(location.search); joinCode = q.get("join"); joinGc = q.get("joingc"); } catch (e) {}
    if (joinGc && TM.net) {
      TM.ui.go("online");
      TM.net.onReady(function () { TM.ui.go("groupcomp-join", { code: String(joinGc).toUpperCase(), auto: true }); });
    } else if (joinCode && TM.net) {
      TM.ui.go("online");
      TM.net.onReady(function () { TM.ui.go("online-join", { code: String(joinCode).toUpperCase(), auto: true }); });
    } else {
      TM.ui.go("splash");
    }
  });
})(window);
