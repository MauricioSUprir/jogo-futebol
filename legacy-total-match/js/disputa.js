/* ================= TOTAL MATCH — Disputa de mercado e rivalidade =================
   Quem mais está atrás do jogador. Vale para os DOIS lados:
   · vendendo: vários clubes entram na disputa pelo seu jogador, sobem o lance, observam, desistem ou avisam
     que NÃO entram em leilão (dão um ultimato);
   · comprando: clubes concorrem com você pelo alvo e podem fechar antes se você enrolar.
   Rivalidade: clube rival quase nunca negocia com você, e a torcida odeia reforçar o rival. */
(function (global) {
  "use strict";
  var TM = global.TM;
  var el = TM.ui.el;
  var C = function () { return TM.comp; };

  function R(n) { return Math.round(n * 100) / 100; }
  function mult(c) { return c.money ? c.money.mult : 1; }
  function cur(c, eur) { return R(eur * mult(c)); }
  function money(c, v) { try { return C().fmtMoney(c, v); } catch (e) { return v + "M"; } }
  function rating(id) { try { return TM.data.clubRating(id); } catch (e) { return 70; } }
  function rivalryOn() { try { return TM.storage.settings().rivalry !== false; } catch (e) { return true; } }
  function areRivals(a, b) { try { return rivalryOn() && !!TM.data.areRivals(a, b); } catch (e) { return false; } }
  function isRival(c, id) { return areRivals(c.teamId, id); }
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function budgetOf(id) { var r = rating(id); return r >= 87 ? 180 : r >= 84 ? 120 : r >= 81 ? 80 : r >= 78 ? 50 : r >= 75 ? 30 : r >= 72 ? 16 : r >= 68 ? 8 : 4; }
  function leagueOf(id) { var cl = TM.data.club(id); return cl ? cl.leagueId : null; }

  /* ---------- quem se interessa por um jogador ---------- */
  // Lista estável (mesma semente por jogador+temporada). Rival do dono quase nunca aparece.
  function suitorsFor(c, p, opts) {
    opts = opts || {};
    var ownerId = opts.ownerId || p.clubId || null;
    var exclude = opts.exclude || [];
    var W = TM.data.world(), val = TM.data.marketValue(p), ov = p.overall || 70;
    var cands = W.clubs.filter(function (cl) {
      if (cl.id === ownerId || exclude.indexOf(cl.id) >= 0) return false;
      if (opts.excludeMine && cl.id === c.teamId) return false;
      var r = rating(cl.id);
      if (r < ov - 5) return false;                       // clube muito pior não sonha com ele
      if (budgetOf(cl.id) < val * 0.55) return false;     // precisa de caixa plausível
      return true;
    });
    var seed = "suit:" + p.id + ":" + (c.season || 1);
    var out = cands.map(function (cl) {
      var h = hash(seed + cl.id);
      var score = (rating(cl.id) - ov) * 3 + (h % 40);
      if (leagueOf(cl.id) === leagueOf(ownerId)) score += 8;          // mesma liga se mexe mais
      if (areRivals(cl.id, ownerId)) score -= 70;                     // rival do dono: quase nunca
      if (budgetOf(cl.id) >= val * 2) score += 10;
      return { id: cl.id, name: cl.name, score: score, h: h };
    }).filter(function (x) { return x.score > 14; })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, opts.max || 4);
    return out;
  }

  /* ---------- DISPUTA pelo SEU jogador (propostas recebidas) ---------- */
  // off.race = { suitors: [{id,name,bid,stance,ceil,mood}], round }
  function ensureRace(c, n, p) {
    var off = n.offer; if (!off) return null;
    if (off.race && off.race.suitors) return off.race;
    var val = cur(c, TM.data.marketValue(p));
    var list = suitorsFor(c, p, { ownerId: c.teamId, exclude: [off.buyerId], max: 3 });
    var suitors = list.map(function (s, i) {
      var h = s.h;
      var teto = R(val * (1.0 + ((h >>> 3) % 90) / 100));            // teto de cada clube
      var entra = (h % 100) < (i === 0 ? 72 : 48);                   // nem todo interessado entra de fato
      var semLeilao = ((h >>> 7) % 100) < 28;                        // alguns avisam que não entram em leilão
      return { id: s.id, name: s.name, ceil: teto, bid: entra ? R(Math.min(teto, off.fee * (0.9 + ((h >>> 11) % 25) / 100))) : 0,
        stance: entra ? "in" : "watch", noAuction: semLeilao, rival: isRival(c, s.id) };
    });
    off.race = { suitors: suitors, round: 0 };
    return off.race;
  }
  // avança a disputa depois de uma contraproposta sua (ask = valor pedido)
  function raceRound(c, n, p, ask) {
    var off = n.offer, race = ensureRace(c, n, p); if (!race) return [];
    race.round++;
    var news = [];
    race.suitors.forEach(function (s) {
      if (s.stance === "out") return;
      var h = hash("rr" + p.id + s.id + race.round + Math.floor(ask * 100));
      if (s.stance === "watch") {
        // observando: pode entrar na disputa se o preço ainda couber
        if (ask <= s.ceil * 0.9 && (h % 100) < 40) {
          s.stance = "in"; s.bid = R(Math.min(s.ceil, ask * 0.97));
          news.push({ kind: "entrou", s: s, text: s.name + " entrou na disputa por " + p.name + " e ofereceu " + money(c, s.bid) + "." });
        }
        return;
      }
      // na disputa
      if (ask > s.ceil) {
        s.stance = "out";
        news.push({ kind: "saiu", s: s, text: s.name + " desistiu de " + p.name + ": o pedido passou do teto do clube." });
        return;
      }
      if (s.noAuction) {
        s.stance = "final"; s.bid = R(Math.min(s.ceil, Math.max(s.bid, ask * 0.95)));
        news.push({ kind: "ultimato", s: s, text: s.name + " avisou que NÃO entra em leilão: oferta final de " + money(c, s.bid) + " por " + p.name + "." });
        return;
      }
      if ((h % 100) < 62) {
        var novo = R(Math.min(s.ceil, Math.max(s.bid * 1.08, ask * 0.98)));
        if (novo > s.bid) { s.bid = novo; news.push({ kind: "subiu", s: s, text: s.name + " cobriu e ofereceu " + money(c, s.bid) + " por " + p.name + "." }); }
      } else if ((h % 100) > 92) {
        s.stance = "out";
        news.push({ kind: "saiu", s: s, text: s.name + " saiu da disputa por " + p.name + "." });
      }
    });
    if (news.length) {
      var t = news.map(function (x) { return x.text; }).join(" ");
      TM.notify.push(c, { icon: "⚔️", title: "Disputa por " + p.name, news: true, text: t });
      try { if (TM.social && TM.social.marketPost) TM.social.marketPost(c, { name: p.name, ov: p.overall, toName: news[0].s.name, fromName: (TM.data.club(c.teamId) || {}).name, free: true, val: 0 }); } catch (e) {}
    }
    return news;
  }
  function bestSuitor(off) {
    if (!off.race) return null;
    var best = null;
    off.race.suitors.forEach(function (s) { if ((s.stance === "in" || s.stance === "final") && s.bid > 0 && (!best || s.bid > best.bid)) best = s; });
    return best;
  }

  /* ---------- CONCORRÊNCIA quando VOCÊ compra ---------- */
  // st.race = { suitors:[...], round, lost }
  function buyRace(c, p, sellClub) {
    var val = cur(c, TM.data.marketValue(p));
    var list = suitorsFor(c, p, { ownerId: sellClub ? sellClub.id : p.clubId, exclude: [c.teamId], max: 3 });
    var suitors = list.map(function (s, i) {
      var h = s.h;
      var teto = R(val * (1.0 + ((h >>> 5) % 80) / 100));
      var ativo = (h % 100) < (i === 0 ? 58 : 34);
      return { id: s.id, name: s.name, ceil: teto, bid: ativo ? R(Math.min(teto, val * (0.85 + ((h >>> 9) % 30) / 100))) : 0,
        stance: ativo ? "in" : "watch", noAuction: ((h >>> 13) % 100) < 25, rival: isRival(c, s.id) };
    });
    return { suitors: suitors, round: 0, lost: null };
  }
  // reage à sua proposta; devolve eventos e, se o alvo foi perdido, { lost: clube }
  function buyRound(c, p, race, myBid, sellClub) {
    race.round++;
    var news = [];
    race.suitors.forEach(function (s) {
      if (s.stance === "out" || race.lost) return;
      var h = hash("br" + p.id + s.id + race.round + Math.floor(myBid * 100));
      if (s.stance === "watch") {
        if (myBid <= s.ceil * 0.85 && (h % 100) < 30) { s.stance = "in"; s.bid = R(Math.min(s.ceil, myBid * 1.05)); news.push(s.name + " entrou na disputa e ofereceu " + money(c, s.bid) + "."); }
        return;
      }
      if (myBid > s.ceil) { s.stance = "out"; news.push(s.name + " desistiu: a disputa passou do teto deles."); return; }
      if (s.noAuction) { s.stance = "final"; news.push(s.name + " avisou que não entra em leilão e manteve " + money(c, s.bid) + "."); return; }
      if ((h % 100) < 55) { var novo = R(Math.min(s.ceil, Math.max(s.bid * 1.1, myBid * 1.04))); if (novo > s.bid) { s.bid = novo; news.push(s.name + " cobriu a sua proposta: " + money(c, s.bid) + "."); } }
    });
    // o clube dono pode fechar com quem pagar bem mais que você
    var best = null;
    race.suitors.forEach(function (s) { if (s.stance !== "out" && s.bid > 0 && (!best || s.bid > best.bid)) best = s; });
    if (best && best.bid > myBid * 1.22 && race.round >= 2 && !race.lost) {
      race.lost = best;
      news.push("O " + (sellClub ? sellClub.name : "clube") + " fechou com o " + best.name + " por " + money(c, best.bid) + ".");
      TM.notify.push(c, { icon: "❌", title: "Alvo perdido", news: true, text: best.name + " levou " + p.name + " por " + money(c, best.bid) + ". Você ficou para trás na disputa." });
    }
    return news;
  }

  /* ---------- UI ---------- */
  var STANCE = {
    in: { lbl: "na disputa", cls: "in" }, watch: { lbl: "observando", cls: "watch" },
    final: { lbl: "oferta final", cls: "final" }, out: { lbl: "fora", cls: "out" }
  };
  function panel(c, title, suitors, opts) {
    opts = opts || {};
    if (!suitors || !suitors.length) return null;
    var box = el("div", { class: "disp-box" }, [ el("div", { class: "disp-h", text: title }) ]);
    suitors.forEach(function (s) {
      var cl = TM.data.club(s.id); if (!cl) return;
      var st = STANCE[s.stance] || STANCE.watch;
      var row = el("div", { class: "disp-row " + st.cls }, [
        TM.img.clubImg(cl, "disp-crest"),
        el("div", { class: "disp-mid" }, [
          el("div", { class: "disp-name", text: cl.name + (s.rival ? " 🔥" : "") }),
          el("div", { class: "disp-note", text: (s.noAuction && s.stance !== "out" ? "não entra em leilão · " : "") + st.lbl })
        ]),
        el("div", { class: "disp-bid", text: s.bid > 0 && s.stance !== "out" ? money(c, s.bid) : "—" })
      ]);
      if (opts.onPick && s.bid > 0 && (s.stance === "in" || s.stance === "final")) {
        row.classList.add("clickable");
        row.addEventListener("click", function () { opts.onPick(s); });
      }
      box.appendChild(row);
    });
    if (opts.hint) box.appendChild(el("div", { class: "disp-hint", text: opts.hint }));
    return box;
  }
  // painel passivo de interesse (perfil do jogador)
  function interestPanel(c, p) {
    if (!p || (c.roster || []).indexOf(p.id) < 0) return null;
    var list = suitorsFor(c, p, { ownerId: c.teamId, max: 4 });
    if (!list.length) return null;
    var suitors = list.map(function (s) { return { id: s.id, name: s.name, bid: 0, stance: (s.h % 100) < 45 ? "in" : "watch", rival: isRival(c, s.id), noAuction: false }; });
    return panel(c, "👀 Quem está de olho em " + p.name.split(" ")[0], suitors, { hint: "Clubes que acompanham o jogador. Se um deles fizer proposta, ela chega em Propostas." });
  }

  /* ---------- rivalidade nas negociações ---------- */
  // multiplicador de preço e chance de recusa quando você negocia com um RIVAL
  function rivalSellerInfo(c, sellClubId) {
    if (!sellClubId || !isRival(c, sellClubId)) return null;
    var cl = TM.data.club(sellClubId);
    return {
      club: cl, priceMult: 1.9,
      line: "O " + (cl ? cl.name : "clube") + " é seu maior rival. Vender para você é quase impossível: o preço sobe muito e a diretoria deles pode simplesmente encerrar a conversa.",
      refuseChance: 0.62
    };
  }
  function rivalBuyerInfo(c, buyerId) {
    if (!buyerId || !isRival(c, buyerId)) return null;
    var cl = TM.data.club(buyerId);
    return { club: cl, line: "Vender para o " + (cl ? cl.name : "rival") + " vai revoltar a torcida. Só aceite por um valor muito acima do normal." };
  }

  TM.disp = {
    suitorsFor: suitorsFor, ensureRace: ensureRace, raceRound: raceRound, bestSuitor: bestSuitor,
    buyRace: buyRace, buyRound: buyRound, panel: panel, interestPanel: interestPanel,
    isRival: isRival, areRivals: areRivals, rivalSellerInfo: rivalSellerInfo, rivalBuyerInfo: rivalBuyerInfo
  };
})(window);
