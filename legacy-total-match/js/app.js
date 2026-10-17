/* ================= TOTAL MATCH — inicialização ================= */
(function (global) {
  "use strict";
  var TM = global.TM;
  document.addEventListener("DOMContentLoaded", function () {
    TM.ui.init();
    // pré-gera o mundo (assíncrono leve, evita travar a splash)
    setTimeout(function () { TM.data.world(); }, 0);
    // confere se este aparelho está mesmo na versão publicada
    setTimeout(function () { try { TM.ui.conferirVersao(); } catch (e) {} }, 1500);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) { try { TM.ui.conferirVersao(); } catch (e) {} }
    });
    // link de convite (?join=CÓDIGO) → entra direto na sala online; ?online3d=CÓDIGO → a sala do Online 3D
    var joinCode = null, joinGc = null, sala3d = null;
    try { var q = new URLSearchParams(location.search); joinCode = q.get("join"); joinGc = q.get("joingc"); sala3d = q.get("online3d"); } catch (e) {}
    if (sala3d && TM.online3d) {
      TM.ui.go("online3d", { codigo: String(sala3d).toUpperCase(), auto: true });
    } else if (joinGc && TM.net) {
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
