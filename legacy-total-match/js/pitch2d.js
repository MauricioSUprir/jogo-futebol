/* ================= TOTAL MATCH — Campo 2D (visão de cima) =================
   Animação tática dirigida pela simulação: 22 bolinhas que respeitam formação,
   posição e função, seguindo a bola. A simulação (TM.engine) decide o resultado;
   aqui a gente REPRESENTA o fluxo e pontua nos eventos (gol, chute, cartão...).
   API:
     var p = TM.pitch2d.create({ a, b, formationA, formationB });
     p.el                      -> elemento DOM (canvas + placar)
     p.start() / p.stop()
     p.tick(minute, events)    -> chamado a cada minuto pela matchview
     p.setSpeed(mult)          -> 1 / 2 / 4 (afeta suavização)
     p.pause() / p.resume()
     p.setScore([h,a]) / p.setClock(min)
==========================================================================*/
(function (global) {
  "use strict";
  var TM = (global.TM = global.TM || {});

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  // posições-base por formação, em coordenadas do campo (x = comprimento 0..1 da
  // esquerda p/ direita; y = largura 0..1). Deriva das FORMATIONS (slot [grp,sx,sy]).
  function basePositions(formation, side) {
    var FS = (TM.comp && TM.comp.FORMATIONS) || {};
    var slots = FS[formation] || FS["4-4-2"] || [];
    var out = [];
    for (var i = 0; i < 11; i++) {
      var s = slots[i] || ["MF", 50, 50];
      var sx = s[1], sy = s[2];                 // sx: largura 0-100 ; sy: profundidade (88=fundo)
      // profundidade do próprio gol (0) até o ataque (1)
      var depth = clamp((100 - sy) / 100, 0, 1);
      // mando: casa ataca p/ a direita (x cresce); visitante p/ a esquerda
      var x = side === 0 ? (0.05 + depth * 0.58) : (0.95 - depth * 0.58);
      var y = clamp(sy >= 86 ? 0.5 : (sx / 100), 0.06, 0.94); // goleiro no centro
      out.push({ x: x, y: y, grp: s[0], gk: (sy >= 86 && i === 0) });
    }
    out[0].gk = true; // 1º slot é sempre o goleiro
    return out;
  }

  function pickColors(t, fallback) {
    var c = (t.club && t.club.colors) || (t.nation && t.nation.colors) || null;
    return { primary: (c && c.primary) || fallback, secondary: (c && c.secondary) || "#ffffff" };
  }
  // garante contraste entre as duas equipes
  function hexToRgb(h) { h = (h || "#888").replace("#", ""); if (h.length === 3) h = h.replace(/(.)/g, "$1$1"); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; }
  function colDist(a, b) { var x = hexToRgb(a), y = hexToRgb(b); return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]); }

  function create(cfg) {
    var a = cfg.a, b = cfg.b;
    var colA = pickColors(a, "#2f6fed"), colB = pickColors(b, "#e0483a");
    if (colDist(colA.primary, colB.primary) < 140) colB.primary = "#e0483a"; // força contraste
    var formA = cfg.formationA || "4-4-2", formB = cfg.formationB || "4-4-2";
    var baseA = basePositions(formA, 0), baseB = basePositions(formB, 1);

    // estado dos 22 jogadores (posição atual + alvo)
    function mkTeam(base, side) {
      return base.map(function (p, i) {
        return { x: p.x, y: p.y, tx: p.x, ty: p.y, bx: p.x, by: p.y, grp: p.grp, gk: p.gk, side: side, num: i + 1 };
      });
    }
    var teamA = mkTeam(baseA, 0), teamB = mkTeam(baseB, 1);
    var all = teamA.concat(teamB);

    // bola e estado de jogo
    var ball = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, flying: false, speed: 0.02 };
    var poss = 0;                 // time com a posse (0=casa,1=fora)
    var carrier = teamA[6];       // jogador com a bola
    var phase = "kickoff";        // kickoff|build|attack|shot|goal|dead|celebrate
    var attackDir = 1;            // casa ataca +x
    var score = [0, 0], clock = 0;
    var speedMult = 1, paused = false, running = false, celebrateT = 0, flashT = 0;
    var lastShot = null, replayT = 0, goalText = "", goalSide = 0, confetti = [], ringT = 0;
    var setPiece = null; // {kind:'corner'|'free', side, wall:[]}

    // ---------- DOM ----------
    var wrap = document.createElement("div");
    wrap.className = "p2d-wrap";
    var head = document.createElement("div");
    head.className = "p2d-head";
    head.innerHTML =
      '<div class="p2d-team"><span class="p2d-dot" style="background:' + colA.primary + '"></span><span class="p2d-tn">' + escapeHtml(a.name) + '</span></div>' +
      '<div class="p2d-mid"><span class="p2d-score">0 - 0</span><span class="p2d-clock">0\'</span></div>' +
      '<div class="p2d-team p2d-team-r"><span class="p2d-tn">' + escapeHtml(b.name) + '</span><span class="p2d-dot" style="background:' + colB.primary + '"></span></div>';
    wrap.appendChild(head);
    var scoreEl = head.querySelector(".p2d-score"), clockEl = head.querySelector(".p2d-clock");

    var canvas = document.createElement("canvas");
    canvas.className = "p2d-canvas";
    wrap.appendChild(canvas);
    var ctx = canvas.getContext("2d");

    // barra de controles de velocidade
    var ctrl = document.createElement("div");
    ctrl.className = "p2d-ctrl";
    wrap.appendChild(ctrl);

    var eventLabel = document.createElement("div");
    eventLabel.className = "p2d-evt";
    wrap.appendChild(eventLabel);

    function escapeHtml(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }

    // ---------- dimensionamento ----------
    var W = 0, H = 0, PAD = 0, dpr = Math.min(2, global.devicePixelRatio || 1);
    function resize() {
      var cw = wrap.clientWidth || 340;
      // no PC a altura é limitada pela viewport p/ caber inteiro; no celular usa a proporção
      var ch = Math.min(Math.round(cw * 0.64), Math.round((global.innerHeight || 700) * 0.68));
      cw = Math.round(ch / 0.64); // mantém proporção do campo
      if (cw > wrap.clientWidth) { cw = wrap.clientWidth; ch = Math.round(cw * 0.64); }
      canvas.style.width = cw + "px"; canvas.style.height = ch + "px";
      canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
      W = canvas.width; H = canvas.height; PAD = Math.round(W * 0.03);
    }

    // campo -> pixels
    function px(x) { return PAD + x * (W - 2 * PAD); }
    function py(y) { return PAD + y * (H - 2 * PAD); }

    // ---------- desenho do campo ----------
    function drawPitch() {
      var x0 = PAD, y0 = PAD, w = W - 2 * PAD, h = H - 2 * PAD;
      // gramado PRETO com listras sutis (identidade Total Match)
      var stripes = 14, sw = w / stripes;
      for (var i = 0; i < stripes; i++) {
        ctx.fillStyle = i % 2 === 0 ? "#0a0f0c" : "#0d130f";
        ctx.fillRect(x0 + i * sw, y0, sw + 1, h);
      }
      // linhas VERDES
      var GLINE = "rgba(45,210,110,0.92)";
      ctx.strokeStyle = GLINE; ctx.lineWidth = Math.max(1.5, W * 0.0038); ctx.fillStyle = GLINE;
      // borda
      ctx.strokeRect(x0, y0, w, h);
      // linha central
      ctx.beginPath(); ctx.moveTo(x0 + w / 2, y0); ctx.lineTo(x0 + w / 2, y0 + h); ctx.stroke();
      // círculo central + ponto
      var r = h * 0.14;
      ctx.beginPath(); ctx.arc(x0 + w / 2, y0 + h / 2, r, 0, 7); ctx.stroke();
      dot(x0 + w / 2, y0 + h / 2, W * 0.006);
      // áreas (grande + pequena) + pênalti + arco, dos dois lados
      var baW = w * 0.16, baH = h * 0.58, saW = w * 0.055, saH = h * 0.28;
      // esquerda
      ctx.strokeRect(x0, y0 + (h - baH) / 2, baW, baH);
      ctx.strokeRect(x0, y0 + (h - saH) / 2, saW, saH);
      dot(x0 + w * 0.105, y0 + h / 2, W * 0.005);
      arc(x0 + baW, y0 + h / 2, r, -0.9, 0.9);
      // direita
      ctx.strokeRect(x0 + w - baW, y0 + (h - baH) / 2, baW, baH);
      ctx.strokeRect(x0 + w - saW, y0 + (h - saH) / 2, saW, saH);
      dot(x0 + w - w * 0.105, y0 + h / 2, W * 0.005);
      arc(x0 + w - baW, y0 + h / 2, r, Math.PI - 0.9, Math.PI + 0.9);
      // gols
      var gh = h * 0.18;
      ctx.lineWidth = Math.max(2, W * 0.006);
      ctx.strokeStyle = "rgba(60,230,130,0.98)";
      ctx.strokeRect(x0 - W * 0.012, y0 + (h - gh) / 2, W * 0.012, gh);
      ctx.strokeRect(x0 + w, y0 + (h - gh) / 2, W * 0.012, gh);
      // arcos de escanteio
      ctx.lineWidth = Math.max(1.2, W * 0.003); ctx.strokeStyle = "rgba(45,210,110,0.6)";
      arc(x0, y0, W * 0.014, 0, Math.PI / 2); arc(x0 + w, y0, W * 0.014, Math.PI / 2, Math.PI);
      arc(x0, y0 + h, W * 0.014, -Math.PI / 2, 0); arc(x0 + w, y0 + h, W * 0.014, Math.PI, Math.PI * 1.5);
    }
    // ---------- confete + overlays de gol/replay ----------
    function spawnConfetti(side) {
      confetti = [];
      var cols = [colA.primary, colB.primary, "#f5d020", "#ffffff", "#38d66a"];
      for (var i = 0; i < 60; i++) {
        confetti.push({ x: rnd(0.1, 0.9), y: rnd(-0.1, 0.4), vy: rnd(0.004, 0.012), vx: rnd(-0.003, 0.003),
          c: cols[Math.floor(Math.random() * cols.length)], s: rnd(0.004, 0.009), rot: rnd(0, 6) });
      }
    }
    function updateConfetti() {
      confetti.forEach(function (p) { p.y += p.vy; p.x += p.vx; p.rot += 0.2; });
      confetti = confetti.filter(function (p) { return p.y < 1.05; });
    }
    function drawConfetti() {
      confetti.forEach(function (p) {
        var x = px(p.x), y = py(p.y), s = W * p.s;
        ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c; ctx.fillRect(-s / 2, -s / 2, s, s * 1.6); ctx.restore();
      });
    }
    function drawGoalOverlay() {
      var cx = W / 2, cy = H / 2;
      // anéis expansivos a partir do local do gol
      if (ringT > 0 && lastShot) {
        var rx = px(lastShot.tx), ry = py(lastShot.ty), prog = (30 - ringT) / 30;
        for (var k = 0; k < 3; k++) {
          var rr = W * (0.03 + (prog + k * 0.14) * 0.28);
          ctx.beginPath(); ctx.arc(rx, ry, rr, 0, 7);
          ctx.lineWidth = Math.max(1.5, W * 0.004); ctx.strokeStyle = "rgba(255,235,90," + (0.5 * (1 - prog)) + ")"; ctx.stroke();
        }
      }
      // faixa "GOOOL" com a cor do time
      var col = goalSide === 0 ? colA.primary : colB.primary;
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(0, cy - H * 0.11, W, H * 0.22);
      ctx.fillStyle = col; ctx.fillRect(0, cy - H * 0.11, W, H * 0.012);
      ctx.fillRect(0, cy + H * 0.098, W, H * 0.012);
      ctx.globalAlpha = 1;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "#f5d020"; ctx.font = "900 " + Math.round(W * 0.075) + "px system-ui, sans-serif";
      ctx.fillText("G O O O L !", cx, cy - H * 0.02);
      ctx.fillStyle = "#fff"; ctx.font = "800 " + Math.round(W * 0.032) + "px system-ui, sans-serif";
      ctx.fillText(goalText, cx, cy + H * 0.055);
      ctx.restore();
    }
    function drawReplayOverlay() {
      if (!lastShot) return;
      // traço pontilhado da finalização
      ctx.save();
      ctx.setLineDash([W * 0.012, W * 0.01]);
      ctx.lineWidth = Math.max(1.5, W * 0.004); ctx.strokeStyle = "rgba(255,235,90,0.9)";
      ctx.beginPath(); ctx.moveTo(px(lastShot.fx), py(lastShot.fy)); ctx.lineTo(px(lastShot.tx), py(lastShot.ty)); ctx.stroke();
      ctx.setLineDash([]);
      // marcador de origem e alvo
      ctx.fillStyle = "rgba(255,235,90,0.95)"; dot(px(lastShot.fx), py(lastShot.fy), W * 0.008);
      ctx.fillStyle = "#e0483a"; dot(px(lastShot.tx), py(lastShot.ty), W * 0.009);
      // etiqueta REPLAY
      ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(PAD, PAD, W * 0.19, H * 0.07);
      ctx.fillStyle = "#fff"; ctx.font = "800 " + Math.round(W * 0.028) + "px system-ui, sans-serif";
      ctx.fillText("🔁 REPLAY", PAD + W * 0.012, PAD + H * 0.018);
      ctx.restore();
    }
    function dot(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
    function arc(x, y, r, s, e) { ctx.beginPath(); ctx.arc(x, y, r, s, e); ctx.stroke(); }

    function drawPlayer(p) {
      var x = px(p.x), y = py(p.y), r = W * 0.017;
      var col = p.side === 0 ? colA.primary : colB.primary;
      // destaque de posse
      if (carrier === p) {
        ctx.beginPath(); ctx.arc(x, y, r * 1.9, 0, 7);
        ctx.fillStyle = "rgba(255,255,120,0.28)"; ctx.fill();
        ctx.lineWidth = Math.max(1.5, W * 0.003); ctx.strokeStyle = "rgba(255,255,120,0.9)"; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7);
      ctx.fillStyle = p.gk ? "#f5d020" : col; ctx.fill();
      ctx.lineWidth = Math.max(1, W * 0.0025);
      ctx.strokeStyle = p.gk ? "#111" : "rgba(0,0,0,0.55)"; ctx.stroke();
      // número
      ctx.fillStyle = p.gk ? "#111" : "#fff";
      ctx.font = "700 " + Math.round(r * 1.15) + "px system-ui, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(p.num, x, y + 0.5);
    }
    function drawBall() {
      var x = px(ball.x), y = py(ball.y), r = W * 0.011;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7);
      ctx.fillStyle = "#fff"; ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.stroke();
    }

    // ---------- lógica de movimentação (alvos) ----------
    // define o alvo de cada jogador conforme posse, zona da bola e função
    function updateTargets() {
      var attackingRight = (poss === 0);       // casa ataca p/ direita
      var ballX = ball.x;
      var team = poss === 0 ? teamA : teamB;
      var opp = poss === 0 ? teamB : teamA;

      // deslocamento coletivo (linha do time sobe no ataque, recua na defesa)
      teamA.forEach(function (p, i) { shapeTarget(p, 0, ballX); });
      teamB.forEach(function (p, i) { shapeTarget(p, 1, ballX); });

      // marcação/pressão: os 2 defensores mais próximos da bola pressionam
      pressBall(opp);
      // opções de passe: alguns companheiros do portador buscam espaço
      offBall(team);
    }
    function shapeTarget(p, side, ballX) {
      var atk = (poss === side);
      // quanto o time avança conforme a bola
      var push = atk ? 0.12 : -0.08;
      var roleF = p.grp === "FW" ? 1.35 : p.grp === "MF" ? 1.0 : p.grp === "DF" ? 0.6 : 0.15;
      var dir = side === 0 ? 1 : -1;
      var tx = p.bx + push * roleF * dir;
      // acompanha a faixa vertical da bola de leve (compactação)
      var ty = lerp(p.by, ball.y, p.grp === "GK" ? 0.05 : 0.18);
      // goleiro acompanha a bola no eixo do gol
      if (p.gk) {
        var gx = side === 0 ? 0.03 : 0.97;
        tx = gx + (ball.x - 0.5) * 0.05 * dir;
        ty = clamp(0.5 + (ball.y - 0.5) * 0.5, 0.35, 0.65);
      }
      p.tx = clamp(tx, 0.02, 0.98); p.ty = clamp(ty, 0.05, 0.95);
    }
    function pressBall(oppTeam) {
      var arr = oppTeam.filter(function (p) { return !p.gk; }).slice();
      arr.sort(function (m, n) { return dist(m.x, m.y, ball.x, ball.y) - dist(n.x, n.y, ball.x, ball.y); });
      for (var i = 0; i < Math.min(2, arr.length); i++) {
        var p = arr[i];
        p.tx = lerp(p.tx, ball.x + (p.side === 0 ? 0.03 : -0.03), 0.7);
        p.ty = lerp(p.ty, ball.y, 0.7);
      }
    }
    function offBall(team) {
      // dá largura aos pontas e profundidade aos atacantes
      team.forEach(function (p) {
        if (p === carrier || p.gk) return;
        if (p.grp === "FW") p.tx = clamp(p.tx + (p.side === 0 ? 0.06 : -0.06), 0.02, 0.98);
      });
    }

    // ---------- fluxo cosmético entre eventos (posse trocando de pé) ----------
    var flowT = 0;
    function flowStep() {
      if (phase === "dead" || phase === "celebrate" || phase === "shot" || phase === "goal") return;
      // portador avança e passa para um companheiro bem posicionado
      var team = poss === 0 ? teamA : teamB;
      var dir = poss === 0 ? 1 : -1;
      // escolhe alvo do passe: companheiro à frente e livre
      var cand = team.filter(function (p) { return p !== carrier && !p.gk; });
      cand.sort(function (m, n) { return (n.x - m.x) * dir; });
      // 65% passa pra frente, senão mantém/curto
      var target = cand[Math.floor(rnd(0, Math.min(3, cand.length)))] || carrier;
      passTo(target, 0.03);
      // pequena chance de perder a posse (cosmético, não muda placar)
      if (Math.random() < 0.18) { poss = 1 - poss; }
    }
    function passTo(p, spd) {
      ball.tx = p.x + (p.side === 0 ? 0.01 : -0.01); ball.ty = p.y;
      ball.flying = true; ball.speed = spd || 0.03;
      carrier = p; poss = p.side;
    }
    function shootAt(side) {
      // chuta para o gol adversário
      phase = "shot";
      var gx = side === 0 ? 0.985 : 0.015;
      var ty = clamp(0.5 + rnd(-0.12, 0.12), 0.36, 0.64);
      lastShot = { fx: ball.x, fy: ball.y, tx: gx, ty: ty, side: side }; // guarda p/ replay
      ball.tx = gx; ball.ty = ty;
      ball.flying = true; ball.speed = 0.06; carrier = null;
      setTimeout(function () { if (phase === "shot") phase = "build"; }, 700);
    }
    // ---------- escanteio (cosmético) ----------
    function cornerKick(side) {
      phase = "dead"; setPiece = { kind: "corner", side: side };
      var atkRight = side === 0;
      var cx = atkRight ? 0.985 : 0.015;
      var cy = Math.random() < 0.5 ? 0.03 : 0.97;
      ball.x = ball.tx = cx; ball.y = ball.ty = cy; ball.flying = false;
      carrier = pickForward(side);
      // atacantes sobem à área; zaga adversária marca
      var team = side === 0 ? teamA : teamB, opp = side === 0 ? teamB : teamA;
      var boxX = atkRight ? 0.86 : 0.14;
      team.forEach(function (p) { if (!p.gk && p.grp !== "GK") { p.tx = clamp(boxX + rnd(-0.05, 0.05), 0.05, 0.95); p.ty = clamp(0.5 + rnd(-0.18, 0.18), 0.2, 0.8); } });
      opp.forEach(function (p) { if (!p.gk && p.grp === "DF") { p.tx = clamp(boxX + rnd(-0.04, 0.04) + (atkRight ? 0.02 : -0.02), 0.05, 0.95); p.ty = clamp(0.5 + rnd(-0.15, 0.15), 0.2, 0.8); } });
      showEvt("🚩 Escanteio", "sep");
      // cruzamento após 900ms → cabeçada/chute
      setTimeout(function () {
        if (paused) { setPiece = null; phase = "build"; return; }
        ball.tx = clamp(boxX, 0.05, 0.95); ball.ty = clamp(0.5 + rnd(-0.1, 0.1), 0.3, 0.7); ball.flying = true; ball.speed = 0.05;
        setTimeout(function () { setPiece = null; if (Math.random() < 0.4) shootAt(side); else phase = "build"; }, 500);
      }, 900);
    }
    // ---------- falta (cosmético, com barreira) ----------
    function freeKick(side) {
      phase = "dead"; setPiece = { kind: "free", side: side };
      var atkRight = side === 0;
      var fx = atkRight ? rnd(0.62, 0.74) : rnd(0.26, 0.38);
      var fy = clamp(0.5 + rnd(-0.22, 0.22), 0.2, 0.8);
      ball.x = ball.tx = fx; ball.y = ball.ty = fy; ball.flying = false;
      carrier = (side === 0 ? teamA : teamB)[Math.random() < 0.5 ? 7 : 9];
      // barreira: 3 defensores adversários entre a bola e o gol
      var opp = side === 0 ? teamB : teamA;
      var gx = atkRight ? 0.985 : 0.015;
      var wallX = fx + (gx - fx) * 0.18;
      var wall = opp.filter(function (p) { return !p.gk; }).slice(0, 3);
      wall.forEach(function (p, i) { p.tx = clamp(wallX, 0.05, 0.95); p.ty = clamp(fy - 0.05 + i * 0.05, 0.1, 0.9); });
      showEvt("🎯 Falta perigosa", "sep");
      setTimeout(function () {
        if (paused) { setPiece = null; phase = "build"; return; }
        setPiece = null;
        if (Math.random() < 0.45) shootAt(side); else { phase = "attack"; passTo(pickForward(side), 0.04); }
      }, 1000);
    }

    // ---------- eventos vindos da simulação ----------
    function tick(minute, events) {
      clock = minute; clockEl.textContent = minute + "'";
      (events || []).forEach(function (ev) { handleEvent(ev); });
      // a cada minuto, um "beat" de jogo
      if (phase === "build" || phase === "attack" || phase === "kickoff") { phase = "build"; flowStep(); }
    }
    function handleEvent(ev) {
      var t = ev.type;
      if (t === "goal" || t === "pengoal") {
        var side = ev.team != null ? ev.team : poss;
        poss = side; carrier = pickForward(side); shootAt(side);
        setTimeout(function () {
          score = ev.score ? ev.score.slice() : score; scoreEl.textContent = score[0] + " - " + score[1];
          phase = "celebrate"; celebrateT = 72; showEvt("⚽ GOL!  " + (ev.player || ""), "goal");
          goalText = ev.player ? String(ev.player).toUpperCase() : "GOL!"; goalSide = side; ringT = 30;
          spawnConfetti(side);
          // bola na rede
          ball.x = ball.tx = side === 0 ? 0.99 : 0.01;
        }, 650);
      } else if (t === "penalty") {
        poss = ev.team != null ? ev.team : poss; showEvt("🎯 Pênalti!", "pen"); phase = "dead";
        setTimeout(function () { phase = "build"; }, 900);
      } else if (t === "penmiss") {
        showEvt("❌ Perdeu!", "miss"); shootAt(poss);
      } else if (t === "red") {
        showEvt("🟥 Cartão vermelho", "red"); phase = "dead"; setTimeout(function () { phase = "build"; }, 900);
      } else if (t === "yellow") {
        showEvt("🟨 Amarelo", "yellow");
      } else if (t === "sub") {
        showEvt("🔄 Substituição", "sep");
      } else if (t === "var") {
        showEvt(ev.decision === "annulled" ? "📺 VAR: gol anulado" : "📺 VAR: gol validado", ev.decision === "annulled" ? "red" : "goal");
        phase = "dead"; setTimeout(function () { phase = "build"; }, 900);
      } else if (t === "injury") {
        showEvt("🚑 Lesão", "injury"); phase = "dead"; setTimeout(function () { phase = "build"; }, 900);
      } else if (t === "half") {
        showEvt("⏸️ Intervalo", "sep"); phase = "dead"; setTimeout(function () { resetKickoff(); }, 700);
      } else if (t === "full") {
        showEvt("🔚 Fim de jogo", "sep"); phase = "dead";
      } else if (t === "kickoff") {
        resetKickoff();
      } else {
        // lance/chance: às vezes vira escanteio/falta (cosmético), senão ameaça o gol
        var s = poss;
        var roll = Math.random();
        if (roll < 0.16) { cornerKick(s); return; }
        if (roll < 0.30) { freeKick(s); return; }
        phase = "attack";
        carrier = pickForward(s);
        ball.tx = s === 0 ? rnd(0.72, 0.86) : rnd(0.14, 0.28); ball.ty = clamp(rnd(0.25, 0.75), 0.1, 0.9);
        ball.flying = true; ball.speed = 0.05;
        if (Math.random() < 0.5) setTimeout(function () { if (!paused) shootAt(s); }, 500);
      }
    }
    function pickForward(side) {
      var team = side === 0 ? teamA : teamB, dir = side === 0 ? 1 : -1, best = team[9];
      team.forEach(function (p) { if (!p.gk && (p.x - best.x) * dir > 0) best = p; });
      return best;
    }
    function resetKickoff() {
      teamA.forEach(function (p) { p.tx = p.bx; p.ty = p.by; });
      teamB.forEach(function (p) { p.tx = p.bx; p.ty = p.by; });
      ball.tx = 0.5; ball.ty = 0.5; carrier = teamA[6]; poss = 0; phase = "build"; celebrateT = 0;
    }

    var evtTimer = null;
    function showEvt(text, kind) {
      eventLabel.textContent = text; eventLabel.className = "p2d-evt show " + (kind || "");
      if (evtTimer) clearTimeout(evtTimer);
      evtTimer = setTimeout(function () { eventLabel.className = "p2d-evt"; }, 1600);
    }

    // ---------- loop de animação (suave, 60fps) ----------
    var raf = null, lastT = 0;
    function frame(ts) {
      if (!running) return;
      raf = global.requestAnimationFrame(frame);
      if (paused) { render(); return; }
      var step = 1;
      updateTargets();
      // celebração: jogadores do time convergem perto da bola
      if (phase === "celebrate") {
        celebrateT--;
        if (ringT > 0) ringT--;
        updateConfetti();
        var team = poss === 0 ? teamA : teamB;
        team.forEach(function (p) { if (!p.gk) { p.tx = clamp(ball.x + rnd(-0.05, 0.05), 0.05, 0.95); p.ty = clamp(ball.y + rnd(-0.05, 0.05), 0.05, 0.95); } });
        if (celebrateT <= 0) { phase = "replay"; replayT = 40; }
      } else if (phase === "replay") {
        replayT--;
        if (replayT <= 0) { confetti = []; resetKickoff(); }
      }
      // move jogadores em direção ao alvo (velocidade limitada = sem teleporte)
      // ritmo mais lento/fluido por padrão; os botões 1x/2x/4x aceleram
      var pmax = 0.0065 * speedMult;
      all.forEach(function (p) {
        var d = dist(p.x, p.y, p.tx, p.ty);
        var v = Math.min(pmax, d);
        if (d > 0.0005) { p.x += (p.tx - p.x) / d * v; p.y += (p.ty - p.y) / d * v; }
      });
      // portador carrega a bola de leve à frente
      if (carrier && !ball.flying) {
        var dir = carrier.side === 0 ? 1 : -1;
        ball.tx = clamp(carrier.x + 0.02 * dir, 0.01, 0.99); ball.ty = carrier.y;
      }
      // move a bola (ritmo mais lento por padrão; 1x/2x/4x aceleram)
      var bd = dist(ball.x, ball.y, ball.tx, ball.ty);
      var bv = Math.min(ball.speed * speedMult * 0.6, bd);
      if (bd > 0.0008) { ball.x += (ball.tx - ball.x) / bd * bv; ball.y += (ball.ty - ball.y) / bd * bv; }
      else { ball.flying = false; }
      render();
    }
    function render() {
      if (!W) resize();
      ctx.clearRect(0, 0, W, H);
      drawPitch();
      // jogadores atrás, portador/bola por cima
      all.forEach(function (p) { if (p !== carrier) drawPlayer(p); });
      if (carrier) drawPlayer(carrier);
      if (phase !== "replay") drawBall();
      // overlays de gol / replay
      if (phase === "celebrate") { drawConfetti(); drawGoalOverlay(); }
      else if (phase === "replay") { drawReplayOverlay(); }
    }

    // ---------- controles ----------
    var speedBtns = [];
    ["⏸", "1x", "2x", "4x"].forEach(function (lab, i) {
      var btn = document.createElement("button");
      btn.className = "p2d-btn" + (lab === "1x" ? " on" : "");
      btn.textContent = lab;
      btn.addEventListener("click", function () {
        if (lab === "⏸") { paused = !paused; btn.textContent = paused ? "▶" : "⏸"; return; }
        speedMult = lab === "2x" ? 2 : lab === "4x" ? 4 : 1;
        speedBtns.forEach(function (x) { x.classList.remove("on"); }); btn.classList.add("on");
        if (api.onSpeed) api.onSpeed(speedMult);
      });
      if (lab !== "⏸") speedBtns.push(btn);
      ctrl.appendChild(btn);
    });

    var ro = null;
    var api = {
      el: wrap,
      onSpeed: null,
      start: function () { if (running) return; running = true; resize(); raf = global.requestAnimationFrame(frame); },
      stop: function () { running = false; if (raf) global.cancelAnimationFrame(raf); },
      pause: function () { paused = true; },
      resume: function () { paused = false; },
      isPaused: function () { return paused; },
      tick: tick,
      setSpeed: function (m) { speedMult = m; },
      setScore: function (s) { score = s.slice(); scoreEl.textContent = s[0] + " - " + s[1]; },
      setClock: function (m) { clock = m; clockEl.textContent = m + "'"; },
      resize: resize
    };
    // re-dimensiona quando o container muda
    if (global.ResizeObserver) { ro = new ResizeObserver(function () { resize(); }); ro.observe(wrap); }
    else global.addEventListener("resize", resize);
    return api;
  }

  TM.pitch2d = { create: create };
})(window);
