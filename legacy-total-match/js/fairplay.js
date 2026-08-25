/* ================= TOTAL MATCH — Fair Play (abandono de partida) =================
   Controle local de abandonos em partidas online. Abandonar conta como derrota e,
   de forma recorrente, gera uma suspensão temporária do matchmaking (escalonada).
   Estado em storage "fairplay" = { abandons, banUntil, last, history:[ts...] }. */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;

  var KEY = "fairplay";
  // penalidade por nº de abandonos recentes (janela de 7 dias)
  var TIERS = [0, 0, 3 * 60000, 10 * 60000, 30 * 60000, 60 * 60000]; // ms
  var WINDOW = 7 * 24 * 60 * 60000;

  function now() { try { return Date.now(); } catch (e) { return 0; } }
  function read() { return TM.storage.read(KEY, { abandons: 0, banUntil: 0, last: 0, history: [] }) || { abandons: 0, banUntil: 0, last: 0, history: [] }; }
  function write(s) { TM.storage.write(KEY, s); }

  function recentCount(s) {
    var t = now();
    return (s.history || []).filter(function (ts) { return t - ts < WINDOW; }).length;
  }

  function status() {
    var s = read(), t = now();
    var recent = recentCount(s);
    var banned = s.banUntil && s.banUntil > t;
    return {
      abandons: s.abandons || 0,
      recent: recent,
      banned: !!banned,
      remainingMs: banned ? s.banUntil - t : 0,
      banUntil: s.banUntil || 0,
      // reputação simbólica (0-100): cai com abandonos recentes
      reputation: Math.max(0, 100 - recent * 20)
    };
  }

  // penalidade que SERÁ aplicada no próximo abandono
  function nextPenaltyMs() {
    var s = read();
    var idx = Math.min(TIERS.length - 1, recentCount(s) + 1);
    return TIERS[idx];
  }

  function recordAbandon() {
    var s = read(), t = now();
    s.abandons = (s.abandons || 0) + 1;
    s.history = (s.history || []).filter(function (ts) { return t - ts < WINDOW; });
    s.history.push(t);
    s.last = t;
    var idx = Math.min(TIERS.length - 1, s.history.length); // 1º abandono→TIERS[1]=0 (só aviso)
    var pen = TIERS[idx] || 0;
    if (pen > 0) s.banUntil = t + pen; else s.banUntil = 0;
    write(s);
    return { penaltyMs: pen, abandons: s.abandons, banUntil: s.banUntil };
  }

  function reset() { write({ abandons: 0, banUntil: 0, last: 0, history: [] }); }

  function fmt(ms) {
    if (ms <= 0) return "0s";
    var s = Math.ceil(ms / 1000);
    if (s < 60) return s + "s";
    var m = Math.floor(s / 60), r = s % 60;
    if (m < 60) return m + "min" + (r ? " " + r + "s" : "");
    var h = Math.floor(m / 60); return h + "h" + (m % 60 ? " " + (m % 60) + "min" : "");
  }

  // barra/cartão de reputação (para o hub online)
  function repCard() {
    var st = status();
    var card = el("div", { class: "fp-card" }, [
      el("div", { class: "fp-head" }, [
        el("span", { class: "fp-ic", text: st.reputation >= 80 ? "🟢" : st.reputation >= 50 ? "🟡" : "🔴" }),
        el("span", { class: "fp-title", text: "Fair Play" }),
        el("span", { class: "fp-score", text: st.reputation + "/100" })
      ]),
      el("div", { class: "fp-bar" }, [ el("div", { class: "fp-fill", style: "width:" + st.reputation + "%" }) ])
    ]);
    if (st.banned) {
      card.appendChild(el("div", { class: "fp-ban", text: "⛔ Suspenso do online por " + fmt(st.remainingMs) + " (abandono recorrente)" }));
    } else if (st.recent > 0) {
      card.appendChild(el("div", { class: "fp-warn", text: "⚠️ " + st.recent + " abandono(s) recente(s). Abandonar de novo pode gerar suspensão." }));
    } else {
      card.appendChild(el("div", { class: "fp-ok", text: "✅ Sem abandonos recentes. Continue assim!" }));
    }
    return card;
  }

  // porta de entrada do matchmaking: bloqueia se suspenso
  function gate(screen) {
    var st = status();
    if (!st.banned) return true;
    screen.appendChild(el("div", { class: "next-match" }, [
      el("div", { class: "nm-label", text: "⛔ Suspensão de Fair Play" }),
      el("p", { class: "intro-text", style: "text-align:center", text:
        "Você abandonou partidas recentemente e está temporariamente suspenso do matchmaking online." }),
      el("div", { class: "fp-countdown", text: "Libera em " + fmt(st.remainingMs) }),
      el("p", { class: "intro-text", style: "text-align:center", text:
        "Abandonar partidas prejudica quem está jogando com você. Termine seus jogos para manter a reputação alta." }),
      TM.ui.button("Voltar", function () { TM.ui.go("online"); }, "btn primary")
    ]));
    return false;
  }

  // confirmação de abandono durante a partida (aplica penalidade se confirmar)
  function confirmAbandon(onConfirmed) {
    var pen = nextPenaltyMs();
    var msg = pen > 0
      ? "Abandonar conta como DERROTA e, por ser recorrente, você ficará suspenso do online por " + fmt(pen) + "."
      : "Abandonar conta como DERROTA. Abandonos recorrentes geram suspensão temporária do online.";
    TM.ui.confirm("Abandonar a partida?", msg, "Abandonar", function () {
      var r = recordAbandon();
      if (r.penaltyMs > 0) TM.ui.toast("Você foi suspenso por " + fmt(r.penaltyMs));
      else TM.ui.toast("Partida abandonada (conta como derrota)");
      if (onConfirmed) onConfirmed(r);
    }, true);
  }

  TM.fairplay = {
    status: status, recordAbandon: recordAbandon, reset: reset, fmt: fmt,
    repCard: repCard, gate: gate, confirmAbandon: confirmAbandon, nextPenaltyMs: nextPenaltyMs
  };
})(window);
