/* ================= TOTAL MATCH — notificações ================= */
/* Sistema genérico de avisos, usado nas duas carreiras. Cada aviso pode ter
   uma ação (ex: responder proposta). O caller salva a carreira depois. */
(function (global) {
  "use strict";
  var TM = (global.TM = global.TM || {});

  TM.notify = {
    push: function (career, note) {
      career.notifications = career.notifications || [];
      career._nseq = (career._nseq || 0) + 1;
      note.id = "n" + career._nseq;
      note.read = false;
      note.ts = career._nseq;
      career.notifications.unshift(note);
      if (career.notifications.length > 60) career.notifications.pop();
      return note;
    },
    unread: function (career) {
      return (career.notifications || []).filter(function (n) { return !n.read; }).length;
    },
    markAllRead: function (career) {
      (career.notifications || []).forEach(function (n) { n.read = true; });
    },
    remove: function (career, id) {
      career.notifications = (career.notifications || []).filter(function (n) { return n.id !== id; });
    },
    get: function (career, id) {
      return (career.notifications || []).filter(function (n) { return n.id === id; })[0];
    }
  };
})(window);
