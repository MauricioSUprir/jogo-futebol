/* Teste de ponta a ponta do Online 3D no Total Match (pedido do dono de 16/10: "duas pessoas consigam jogar uma contra a
   outra"; js/online3d.js). Dois aparelhos = dois contextos do Chromium (armazenamento separado: Ana na edição pro, celular
   em pé; Bruno na pública, PC), com o WebRTC DE VERDADE entre eles no loopback (--disable-features=
   WebRtcHideLocalIpsWithMdns). O Firebase NUNCA é o de verdade: o SDK do gstatic é trocado por um falso que fala com um
   banco em memória aqui no Node (o mesmo js/net.js do TM roda por cima dele: login anônimo, número, presença…), com
   transação, ouvintes e onDisconnect (rodam quando a página recarrega ou fecha). O quadro do 3D é uma página de ensaio
   (__eco3d.html, servida aqui) que lê o pedido, recebe a porta e ecoa. Com --golaco, o GOLAÇO de verdade no lugar dele: a
   partida online entre os dois aparelhos (a IA joga pelos dois pelo bit IA do menu aberto) com o mesmo jogo nos dois —
   itens G1–G3, e o teste acaba ali.
   O site precisa estar montado como no GitHub Pages: o TM na raiz e o 3D em /golaco/. Ex.:
     mkdir -p /tmp/site && for f in legacy-total-match/*; do ln -sfn "$PWD/$f" /tmp/site/; done && ln -sfn "$PWD/golaco" /tmp/site/golaco
     (cd /tmp/site && python3 -m http.server 8283)
     TM_SENHA_VIVERDE=... node legacy-total-match/ferramentas/testar-online3d.mjs [http://127.0.0.1:8283] [pasta-dos-prints]
   A senha do Viverde FC vem SÓ da variável TM_SENHA_VIVERDE (nunca no código nem em arquivo); sem ela, o item 9 sai como
   "pulado" e a Ana joga com um clube comum.
   Confere:
     1 "Online 3D" em "Mais modos" (ícone Lucide + nome, sem emoji) e a grade com 12 atalhos (PC numa linha; tablet 6 + 6;
       celular 3 + 3 + 3 + 3);
     2 criar sala: código de 5 letras, link ?online3d=, QR; o nó salas3d/{código} no banco com a versão e o anfitrião;
     3 código inexistente, sala cheia e versão diferente: a mensagem certa na tela;
     4 entrar pelo código e o anfitrião RECUSAR: o convidado sai com o aviso e não entra de novo; o anfitrião volta a esperar;
     5 fechar a sala apaga o nó; entrar pelo LINK (?online3d=) e o anfitrião ACEITAR; a ligação que não dá (prazo forçado):
       a mensagem da seção 4.2 nos dois;
     6 "Tentar de novo" pelo convidado: os dois aparelhos ligam por WebRTC em ≤ 20 s, os dois canais abertos, o nó rtc (com
       os IPs) apagado;
     7 10 pings: a linha "Conexão boa (N ms)" nos dois e o D0 entre 3 e 10;
     8 times: cada um escolhe o SEU (a Ana com o Viverde FC e a senha; o Bruno um clube da edição pública) e vê o do outro;
     9 Pronto nos dois → os dois quadros abrem com o pedido online (modo, sala, semente igual, nomes, D0 igual, proto 1, lado
       0/1, userSide, os mesmos times, uniformes escolhidos pelo anfitrião) e a porta (estado 'aberto');
    10 a porta nos dois sentidos: pacotes binários (canal 'jogo') e controle (canal 'ctrl', inclusive um de 40 KB em pedaços);
    11 fim igual nas duas telas (os dois nomes, vitória × derrota, o placar) e o h2h/ranking gravados UMA vez (anfitrião);
    12 "Jogar de novo": a mesma sala liga de novo e abre outra partida; o Bruno SAI no meio (abandono: fair play no aparelho
       dele), a porta da Ana recebe 'fechado' e o W.O. dela conta (h2h 2);
    13 Sair apaga a sala; nada sobre nada nas telas do Online 3D (360, 390, 844×390, 1280); nenhum erro de página. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const { playwright, rotearCdn } = await import(path.join(AQUI, "../../golaco/tools/lib/navegador.mjs"));
const args = process.argv.slice(2).filter(a => !a.startsWith("--"));
const BASE = (args[0] || "http://127.0.0.1:8283").replace(/\/$/, "");
const PASTA = args[1] || "/tmp/testar-online3d";
const SENHA = process.env.TM_SENHA_VIVERDE || "";
// --golaco: no lugar do quadro de ensaio, o GOLAÇO de verdade (a partida online entre os dois aparelhos, a IA jogando pelos
// dois pelo bit IA do menu aberto): o mesmo jogo nos dois (os hashes a cada 60 passos), e o teste acaba ali (itens G)
const GOLACO = process.argv.includes("--golaco");
fs.mkdirSync(PASTA, { recursive: true });

/* ---------------- o banco falso (Firebase Realtime Database em memória) ---------------- */
const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, c) => (o[c] = x[c], o), {}) : x));
const copia = v => (v == null ? null : JSON.parse(JSON.stringify(v)));
class BancoFalso {
  constructor() { this.raiz = {}; this.ouvintes = new Map(); this.aoCair = new Map(); this.clientes = new Map(); this.gravacoes = 0; }
  partes(c) { return String(c || "").split("/").filter(Boolean); }
  ler(c) {
    if (c === ".info/connected") return true;
    if (c === ".info/serverTimeOffset") return 0;
    let x = this.raiz;
    for (const p of this.partes(c)) { if (x == null || typeof x !== "object") return null; x = x[p]; }
    return x === undefined ? null : copia(x);
  }
  carimbo(v) {
    if (v === undefined) return null;
    if (v && typeof v === "object") {
      if (v[".sv"] === "timestamp") return Date.now();
      const o = {};
      for (const [k, x] of Object.entries(v)) { const y = this.carimbo(x); if (y !== null && !(typeof y === "object" && !Object.keys(y).length)) o[k] = y; }
      return Object.keys(o).length ? o : null;
    }
    return v;
  }
  gravarSem(c, v) {
    v = this.carimbo(v);
    const ps = this.partes(c);
    if (!ps.length) { this.raiz = v && typeof v === "object" ? v : {}; return; }
    let x = this.raiz; const pilha = [];
    for (let i = 0; i < ps.length - 1; i++) {
      if (x[ps[i]] == null || typeof x[ps[i]] !== "object") { if (v === null) return; x[ps[i]] = {}; }
      pilha.push([x, ps[i]]); x = x[ps[i]];
    }
    const ult = ps[ps.length - 1];
    if (v === null) delete x[ult]; else x[ult] = v;
    for (let i = pilha.length - 1; i >= 0; i--) { const [pai, k] = pilha[i]; if (pai[k] && typeof pai[k] === "object" && !Object.keys(pai[k]).length) delete pai[k]; }
    this.gravacoes++;
  }
  gravar(c, v) { this.gravarSem(c, v); this.avisa(); }
  atualizar(c, o) { for (const [k, v] of Object.entries(o || {})) this.gravarSem(this.partes(c).concat(this.partes(k)).join("/"), v); this.avisa(); }
  trocar(c, antes, novo) {
    if (canon(this.ler(c)) !== canon(antes == null ? null : antes)) return { ok: false };
    this.gravar(c, novo);
    return { ok: true, valor: this.ler(c) };
  }
  entrega(o, carga) { o.pagina.evaluate(([id, cg]) => window.__fbEv && window.__fbEv(id, cg), [o.id, carga]).catch(() => {}); }
  ouvir(cid, pagina, caminho, id, ev) {
    const o = { cid, pagina, caminho, id, ev, ultimo: undefined, filhos: new Set() };
    this.ouvintes.set(cid + ":" + id, o);
    this.confere(o);
  }
  confere(o) {
    const v = this.ler(o.caminho);
    if (o.ev === "value") { const c = canon(v); if (c !== o.ultimo) { o.ultimo = c; this.entrega(o, { v }); } return; }
    if (o.ev === "child_added") {
      const ks = v && typeof v === "object" ? Object.keys(v).sort() : [];
      for (const k of [...o.filhos]) if (!ks.includes(k)) o.filhos.delete(k);
      for (const k of ks) if (!o.filhos.has(k)) { o.filhos.add(k); this.entrega(o, { k, v: v[k] }); }
    }
  }
  avisa() { for (const o of this.ouvintes.values()) this.confere(o); }
  // um aparelho caiu (página recarregou ou fechou): roda os onDisconnect dele e tira os ouvintes
  cair(cid) {
    for (const [k, o] of this.ouvintes) if (o.cid === cid) this.ouvintes.delete(k);
    for (const op of this.aoCair.get(cid) || []) { if (op.op === "gravar") this.gravarSem(op.caminho, op.v); else for (const [k, v] of Object.entries(op.v || {})) this.gravarSem(this.partes(op.caminho).concat(this.partes(k)).join("/"), v); }
    this.aoCair.delete(cid); this.clientes.delete(cid);
    this.avisa();
  }
  cairPagina(pagina) { for (const [cid, pg] of [...this.clientes]) if (pg === pagina) this.cair(cid); }
  chamada(pagina, cid, op, a) {
    // a página recarregou: o cliente velho dela caiu
    if (!this.clientes.has(cid)) { for (const [c2, pg] of [...this.clientes]) if (pg === pagina) this.cair(c2); this.clientes.set(cid, pagina); }
    switch (op) {
      case "ler": return this.ler(a[0]);
      case "gravar": this.gravar(a[0], a[1]); return true;
      case "atualizar": this.atualizar(a[0], a[1]); return true;
      case "trocar": return this.trocar(a[0], a[1], a[2]);
      case "ouvir": this.ouvir(cid, pagina, a[0], a[1], a[2]); return true;
      case "parar": this.ouvintes.delete(cid + ":" + a[0]); return true;
      case "aoCair": { const l = this.aoCair.get(cid) || []; l.push({ caminho: a[0], op: a[1], v: a[2] }); this.aoCair.set(cid, l); return true; }
      case "aoCairNao": { const p = this.partes(a[0]).join("/"); this.aoCair.set(cid, (this.aoCair.get(cid) || []).filter(x => { const q = this.partes(x.caminho).join("/"); return !(q === p || q.startsWith(p + "/")); })); return true; }
    }
    return null;
  }
}
const banco = new BancoFalso();

/* ---------------- o SDK falso do Firebase (compat 10), na página ---------------- */
const SDK_FALSO = `(function () {
  var cid = "c" + Math.random().toString(36).slice(2), uid = window.__fbUid || ("u" + Math.random().toString(36).slice(2));
  var ouvintes = {}, seq = 0, pushSeq = 0;
  function chamar(op) { var a = Array.prototype.slice.call(arguments, 1); return window.__fb(cid, op, a); }
  function norm(c) { return String(c || "").split("/").filter(Boolean).join("/"); }
  function clone(v) { return v == null ? null : JSON.parse(JSON.stringify(v)); }
  function snap(chave, v, caminho) {
    return { key: chave, val: function () { return clone(v); }, exists: function () { return v != null; },
      forEach: function (f) { if (!v || typeof v !== "object") return false; var ks = Object.keys(v).sort(); for (var i = 0; i < ks.length; i++) if (f(snap(ks[i], v[ks[i]], caminho + "/" + ks[i])) === true) return true; return false; },
      child: function (k) { var x = v; norm(k).split("/").forEach(function (p) { x = x && typeof x === "object" ? x[p] : null; }); return snap(norm(k).split("/").pop(), x == null ? null : x, caminho + "/" + norm(k)); },
      numChildren: function () { return v && typeof v === "object" ? Object.keys(v).length : 0; },
      get ref() { return ref(caminho); } };
  }
  window.__fbEv = function (id, cg) { var o = ouvintes[id]; if (!o) return; try { o.cb(cg.k != null ? snap(cg.k, cg.v, o.caminho + "/" + cg.k) : snap(o.chave, cg.v, o.caminho)); } catch (e) { console.error(e); } };
  function chavePush() { return "-" + ("000000000" + Date.now().toString(36)).slice(-9) + ("0000" + (pushSeq++).toString(36)).slice(-4) + Math.random().toString(36).slice(2, 6); }
  function ref(caminho) {
    caminho = norm(caminho);
    var r = {
      key: caminho ? caminho.split("/").pop() : null,
      toString: function () { return "falso:/" + caminho; },
      child: function (p) { return ref(caminho + "/" + p); },
      get parent() { return caminho ? ref(caminho.split("/").slice(0, -1).join("/")) : null; },
      get root() { return ref(""); },
      get ref() { return r; },
      once: function (ev, cb) { return chamar("ler", caminho).then(function (v) { var s = snap(r.key, v, caminho); if (typeof cb === "function") cb(s); return s; }); },
      on: function (ev, cb) { var id = ++seq; ouvintes[id] = { cb: cb, caminho: caminho, ev: ev, chave: r.key }; chamar("ouvir", caminho, id, ev); return cb; },
      off: function (ev, cb) { Object.keys(ouvintes).forEach(function (id) { var o = ouvintes[id]; if (o.caminho === caminho && (!ev || o.ev === ev) && (!cb || o.cb === cb)) { delete ouvintes[id]; chamar("parar", +id); } }); },
      set: function (v) { return chamar("gravar", caminho, v === undefined ? null : v).then(function () {}); },
      update: function (o) { return chamar("atualizar", caminho, o).then(function () {}); },
      remove: function () { return chamar("gravar", caminho, null).then(function () {}); },
      push: function (v) { var f = ref(caminho + "/" + chavePush()); var p = v === undefined ? Promise.resolve() : f.set(v); f.then = function (a, b) { return p.then(function () { return f; }).then(a, b); }; f.catch = function (b) { return p.catch(b); }; return f; },
      transaction: function (fn, fim) {
        function tenta(n) {
          return chamar("ler", caminho).then(function (atual) {
            var novo = fn(clone(atual));
            if (novo === undefined) { var s0 = snap(r.key, atual, caminho); if (fim) fim(null, false, s0); return { committed: false, snapshot: s0 }; }
            return chamar("trocar", caminho, atual, novo).then(function (res) {
              if (res.ok) { var s1 = snap(r.key, res.valor, caminho); if (fim) fim(null, true, s1); return { committed: true, snapshot: s1 }; }
              if (n > 25) { var e = new Error("disputa"); if (fim) fim(e, false, null); throw e; }
              return tenta(n + 1);
            });
          });
        }
        return tenta(0);
      },
      onDisconnect: function () { return {
        set: function (v) { return chamar("aoCair", caminho, "gravar", v); },
        update: function (o) { return chamar("aoCair", caminho, "atualizar", o); },
        remove: function () { return chamar("aoCair", caminho, "gravar", null); },
        cancel: function () { return chamar("aoCairNao", caminho); } }; },
      orderByChild: function () { return r; }, orderByKey: function () { return r; }, orderByValue: function () { return r; },
      limitToLast: function () { return r; }, limitToFirst: function () { return r; }, startAt: function () { return r; }, endAt: function () { return r; }, equalTo: function () { return r; }
    };
    return r;
  }
  var usuario = { uid: uid, isAnonymous: true }, cbs = [];
  var auth = { currentUser: null,
    onAuthStateChanged: function (cb) { cbs.push(cb); if (auth.currentUser) setTimeout(function () { cb(auth.currentUser); }, 0); return function () {}; },
    signInAnonymously: function () { return new Promise(function (ok) { setTimeout(function () { auth.currentUser = usuario; cbs.forEach(function (cb) { cb(usuario); }); ok({ user: usuario }); }, 30); }); } };
  var db = { ref: function (c) { return ref(c || ""); } };
  function database() { return db; }
  database.ServerValue = { TIMESTAMP: { ".sv": "timestamp" } };
  window.firebase = { initializeApp: function () { return {}; }, auth: function () { return auth; }, database: database, apps: [] };
})();`;

/* ---------------- o quadro de ensaio do 3D (ecoa a porta) ---------------- */
const ECO_HTML = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Ensaio do 3D</title>
<body style="margin:0;background:#0b2a1a;color:#fff;font:16px sans-serif"><p style="padding:20px">Quadro de ensaio do Online 3D</p>
<script>
(function () {
  var id = new URLSearchParams(location.search).get("tm"), ped = null;
  try { ped = JSON.parse(localStorage.getItem("tm3d:pedido:" + id)); } catch (e) {}
  var E = window.__eco = { id: id, pedido: ped, porta: null, portas: 0, viaPorts: false, bin: [], ctrl: [], estados: [] };
  addEventListener("message", function (e) {
    var d = e.data;
    if (!d || d.tipo !== "tm3d:porta" || d.id !== id) return;
    var p = (e.ports && e.ports[0]) || d.porta;
    E.viaPorts = !!(e.ports && e.ports[0]); E.portas++; E.porta = p; E.protoPorta = d.proto;
    p.onmessage = function (ev) { var m = ev.data; if (!m) return;
      if (m.t === "j") E.bin.push(Array.from(new Uint8Array(m.b)));
      else if (m.t === "c") E.ctrl.push(m.m);
      else if (m.t === "estado") E.estados.push(m); };
  });
  E.manda = function (n, lado) { for (var i = 0; i < n; i++) { var b = new Uint8Array([lado, i, 7, 7]).buffer; E.porta.postMessage({ t: "j", b: b }, [b]); } };
  E.ctrlManda = function (m) { E.porta.postMessage({ t: "c", m: m }); };
  E.fim = function (resultado, online) { parent.postMessage({ tipo: "tm3d:fim", id: id, resultado: resultado, online: online }, location.origin); };
  E.sair = function (extra) { parent.postMessage(Object.assign({ tipo: "tm3d:sair", id: id }, extra || {}), location.origin); };
  parent.postMessage({ tipo: "tm3d:pronto", id: id }, location.origin);
})();
</script></body></html>`;

/* ---------------- os dois aparelhos ---------------- */
const { chromium } = playwright();
const nav = await chromium.launch({ headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-features=WebRtcHideLocalIpsWithMdns"] });
const erros = [];
async function aparelho(nome, uid, viewport, opc) {
  const cx = await nav.newContext({ viewport, deviceScaleFactor: 1, hasTouch: !!opc.toque, isMobile: !!opc.toque, serviceWorkers: "block" });
  await cx.route(/^https:\/\/www\.gstatic\.com\//, r => r.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
  await cx.route(/^https:\/\/www\.gstatic\.com\/firebasejs\/[^/]+\/firebase-app-compat\.js/, r => r.fulfill({ status: 200, contentType: "text/javascript", body: SDK_FALSO }));
  await cx.route(/__eco3d\.html/, r => r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: ECO_HTML }));
  if (GOLACO) await rotearCdn(cx);   // o three.js do GOLAÇO pelo cache local (o Chromium daqui não passa pelo proxy)
  await cx.exposeBinding("__fb", (src, cid, op, a) => banco.chamada(src.page, cid, op, a));
  await cx.addInitScript(([uid, nome, pro]) => {
    window.__fbUid = uid;
    try {
      localStorage.setItem("tm_online_name", nome);
      if (pro) { localStorage.setItem("totalmatch:__edition", "pro"); localStorage.setItem("totalmatch:su_unlocked", "1"); }
    } catch (e) {}
    window.__errosPagina = [];
    addEventListener("error", e => window.__errosPagina.push(String(e.message || e).slice(0, 300)));
    addEventListener("unhandledrejection", e => window.__errosPagina.push("promessa: " + String(e.reason).slice(0, 300)));
  }, [uid, nome, !!opc.pro]);
  const p = await cx.newPage();
  p.on("pageerror", e => erros.push(nome + ": " + String(e).slice(0, 300)));
  p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text())) erros.push(nome + " (console): " + m.text().slice(0, 300)); });
  return { nome, uid, cx, p, vp: viewport };
}
const A = await aparelho("Ana", "uidAna", { width: 390, height: 844 }, { toque: true, pro: true });
const B = await aparelho("Bruno", "uidBruno", { width: 1280, height: 800 }, { toque: false, pro: false });
for (const cl of [A, B]) {
  await cl.p.goto(BASE + "/index.html", { waitUntil: "load" });
  await cl.p.waitForFunction(() => window.TM && TM.online3d && TM.tm3d && TM.ui && TM.data, null, { timeout: 60000 });
  await cl.p.evaluate(g => { if (!g) TM.tm3d.PASTA = "__eco3d.html"; }, GOLACO);
}

const falhas = [], ok = [];
function confere(nome, cond, info) { (cond ? ok : falhas).push(nome + (info != null ? " — " + JSON.stringify(info).slice(0, 900) : "")); console.log((cond ? "ok    " : "FALHA ") + nome); }
const espera = ms => new Promise(r => setTimeout(r, ms));
const est = cl => cl.p.evaluate(() => TM.online3d.estado());
const tela = cl => cl.p.evaluate(() => (document.querySelector(".screen.is-active") || document.body).innerText.replace(/\s+/g, " "));
const clica = (cl, rx, sel = "button") => cl.p.evaluate(([rx, sel]) => { const x = [...document.querySelectorAll(sel)].find(e => new RegExp(rx).test(e.textContent.trim()) && e.offsetParent !== null); if (x) x.click(); return !!x; }, [rx, sel]);
async function ate(cl, fn, arg, ms = 15000) { try { await cl.p.waitForFunction(fn, arg, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } }
const fase = (cl, f, ms) => ate(cl, f => TM.online3d.estado().fase === f, f, ms);
async function print(cl, nome) { await cl.p.screenshot({ path: path.join(PASTA, nome + ".png"), fullPage: true }).catch(() => {}); }
async function confirmaSheet(cl, rotulo) { await espera(150); return cl.p.evaluate(r => { const b = [...document.querySelectorAll(".sheet-overlay .sheet-item")].find(x => x.textContent.trim() === r); if (b) b.click(); return !!b; }, rotulo); }
async function quadroDe(cl, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const fr = cl.p.frames().find(f => /__eco3d\.html\?tm=/.test(f.url()));
    if (fr && await fr.evaluate(() => !!(window.__eco && window.__eco.portas > 0)).catch(() => false)) return fr;
    await espera(150);
  }
  return null;
}

// nada sobre nada: os clicáveis visíveis da tela (o mesmo critério de ferramentas/testar-sobreposicao.mjs)
const sobreposicao = pg => pg.evaluate(() => {
  const sel = "button, a[href], [role=button], input, select, .chosen-team, .vit-mais-b, .o3d-con, .share-code, .o3d-link, .qr-box";
  const els = [...document.querySelectorAll(sel)].filter(e => {
    const cs = getComputedStyle(e); if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity < 0.05 || cs.pointerEvents === "none") return false;
    const rc = e.getBoundingClientRect(); if (rc.width < 4 || rc.height < 4) return false;
    let a = e.parentElement; while (a) { const c2 = getComputedStyle(a); if (c2.display === "none" || c2.visibility === "hidden" || +c2.opacity < 0.05) return false; a = a.parentElement; }
    return true;
  });
  const nome = e => (e.className && typeof e.className === "string" ? "." + e.className.trim().split(/\s+/).slice(0, 2).join(".") : e.tagName) + (e.textContent ? ' "' + e.textContent.trim().slice(0, 18) + '"' : "");
  const pares = [];
  for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
    const X = els[i], Y = els[j];
    if (X.contains(Y) || Y.contains(X)) continue;
    const a = X.getBoundingClientRect(), bb = Y.getBoundingClientRect();
    const ix = Math.min(a.right, bb.right) - Math.max(a.left, bb.left), iy = Math.min(a.bottom, bb.bottom) - Math.max(a.top, bb.top);
    if (ix > 1 && iy > 1) pares.push(nome(X) + " X " + nome(Y));
  }
  const larg = document.documentElement.clientWidth;
  const fora = els.filter(e => { const rc = e.getBoundingClientRect(); return rc.right > larg + 1 || rc.left < -1; }).map(nome);
  return { n: els.length, sobre: pares, fora, rolaLado: document.documentElement.scrollWidth > larg + 1 };
});
const nadaSobre = [];
async function nadaSobreNada(cl, rotulo) {
  for (const [w, h] of [[360, 740], [390, 844], [844, 390], [1280, 800]]) {
    await cl.p.setViewportSize({ width: w, height: h });
    await espera(350);
    await cl.p.evaluate(() => document.querySelectorAll(".toast").forEach(t => t.remove()));
    const s = await sobreposicao(cl.p);
    nadaSobre.push({ tela: rotulo + " " + w + "x" + h, n: s.n, sobre: s.sobre.slice(0, 4), fora: s.fora.slice(0, 4), rolaLado: s.rolaLado });
    await cl.p.screenshot({ path: path.join(PASTA, `nada-${rotulo}-${w}x${h}.png`), fullPage: true }).catch(() => {});
  }
  await cl.p.setViewportSize(cl.vp);
  await espera(200);
}

try {
  /* 1) Mais modos */
  await A.p.evaluate(() => TM.ui.go("modes"));
  await espera(600);
  const mais = await A.p.evaluate(() => {
    const b = [...document.querySelectorAll(".vit-mais-b")].find(x => /Online 3D/.test(x.textContent));
    return b ? { texto: b.textContent.trim(), icone: !!b.querySelector("svg.tm-ic"), emoji: /\p{Extended_Pictographic}/u.test(b.textContent) } : null;
  });
  confere("1 'Online 3D' em Mais modos (ícone Lucide + nome, sem emoji)", !!mais && mais.icone && !mais.emoji && mais.texto === "Online 3D", mais);
  const grade = [];
  for (const [w, h] of [[1280, 800], [1440, 900], [820, 1180], [360, 740]]) {
    await A.p.setViewportSize({ width: w, height: h });
    await A.p.evaluate(() => TM.ui.go("modes"));
    await espera(400);
    grade.push(await A.p.evaluate(w => {
      const bs = [...document.querySelectorAll(".vit-mais-b")].filter(b => b.offsetParent !== null);
      const tops = [...new Set(bs.map(b => Math.round(b.getBoundingClientRect().top)))].sort((a, b) => a - b);
      const quebra = bs.filter(b => b.lastElementChild && b.lastElementChild.getBoundingClientRect().height > 22).map(b => b.textContent.trim());
      return { tela: w, n: bs.length, linhas: tops.map(t => bs.filter(b => Math.round(b.getBoundingClientRect().top) === t).length), quebra };
    }, w));
  }
  await A.p.setViewportSize(A.vp);
  confere("1 grade de 12 atalhos: PC numa linha (1280 e 1440, sem nome quebrado), tablet 6 + 6, celular 3 + 3 + 3 + 3",
    grade.every(g => g.n === 12 && !g.quebra.length) && grade[0].linhas.join() === "12" && grade[1].linhas.join() === "12" && grade[2].linhas.join() === "6,6" && grade[3].linhas.join() === "3,3,3,3", grade);
  await A.p.evaluate(() => TM.ui.go("modes"));
  await espera(300);
  await A.p.evaluate(() => [...document.querySelectorAll(".vit-mais-b")].find(x => /Online 3D/.test(x.textContent)).click());
  const prontaA = await ate(A, () => TM.ui.current() === "online3d" && [...document.querySelectorAll("button")].some(b => b.textContent.trim() === "Criar sala"), null, 20000);
  confere("1 a tela do Online 3D abre pelo atalho, com a conta online (falsa) pronta e 'Criar sala'", prontaA);
  await print(A, "1-entrada");
  await nadaSobreNada(A, "entrada");

  /* 2) criar sala */
  await clica(A, "^Criar sala$");
  await fase(A, "esperando");
  let eA = await est(A);
  const cod1 = eA.codigo;
  const t2 = await tela(A);
  const no = banco.ler("salas3d/" + cod1);
  const temQr = await A.p.evaluate(() => !!document.querySelector(".o3d-qr svg"));
  confere("2 criar sala: código de 5 letras na tela, link ?online3d=, QR e o nó no banco (anfitrião, versão, esperando)",
    /^[A-HJ-NP-Z2-9]{5}$/.test(cod1 || "") && t2.includes(cod1) && t2.includes("?online3d=" + cod1) && temQr && !!no && no.anfitriao === "uidAna" && no.versaoTM === "v373" && no.estado === "esperando" && no.partidaN === 1 && no.nomeA === "Ana",
    { cod1, no });
  await print(A, "2-sala");
  await nadaSobreNada(A, "sala");

  /* 3) erros ao entrar */
  await B.p.evaluate(() => TM.ui.go("online3d"));
  await ate(B, () => !!document.querySelector(".o3d-codigo"), null, 20000);
  async function tentaEntrar(cl, codigo) {
    await cl.p.fill(".o3d-codigo", codigo);
    await cl.p.evaluate(() => { const e = document.querySelector(".o3d-erro"); if (e) { e.textContent = ""; e.hidden = true; } });
    await clica(cl, "^Entrar$");
    await ate(cl, () => { const e = document.querySelector(".o3d-erro"); return !!e && !e.hidden && e.textContent.length > 0; }, null, 8000);
    return cl.p.evaluate(() => document.querySelector(".o3d-erro")?.textContent || "");
  }
  const agora = Date.now();
  banco.gravar("salas3d/CHEAA", { anfitriao: "uidX", nomeA: "Xavier", criada: agora, versaoTM: "v373", proto: 1, estado: "esperando", partidaN: 1, convidado: "uidY", nomeC: "Yara", naSalaC: 1 });
  banco.gravar("salas3d/VERSA", { anfitriao: "uidZ", nomeA: "Zeca", criada: agora, versaoTM: "v1", proto: 1, estado: "esperando", partidaN: 1 });
  const e1 = await tentaEntrar(B, "ZZZZZ"), e2 = await tentaEntrar(B, "cheaa"), e3 = await tentaEntrar(B, "VERSA");
  confere("3 código inexistente / sala cheia / versão diferente: as mensagens certas (minúscula vale)",
    e1 === "Código não encontrado." && e2 === "Essa sala já tem dois jogadores." && e3 === "Versões diferentes do Total Match: atualizem a página nos dois aparelhos (v1 × v373).", [e1, e2, e3]);
  await print(B, "3-erro");
  banco.gravar("salas3d/CHEAA", null); banco.gravar("salas3d/VERSA", null);

  /* 4) entrar pelo código e o anfitrião recusar */
  await B.p.fill(".o3d-codigo", cod1.toLowerCase());
  await clica(B, "^Entrar$");
  const bEsp = await fase(B, "aguardaAceite");
  const aEntrou = await fase(A, "entrou");
  const t4 = await tela(A);
  confere("4 entrar pelo código: o Bruno espera o aceite e a Ana vê 'Bruno entrou na sala' com Aceitar e Recusar",
    bEsp && aEntrou && /Bruno entrou na sala/i.test(t4) && /Aceitar/.test(t4) && /Recusar/.test(t4) && banco.ler("salas3d/" + cod1 + "/convidado") === "uidBruno", t4.slice(0, 200));
  await print(A, "4-entrou");
  await nadaSobreNada(A, "entrou");
  await clica(A, "^Recusar$");
  const bFora = await ate(B, () => TM.online3d.estado().fase === null && /recusou/.test(document.body.innerText), null, 10000);
  const aEsp = await fase(A, "esperando");
  const rec = banco.ler("salas3d/" + cod1);
  const e4 = await tentaEntrar(B, cod1);
  confere("4 recusar: o Bruno sai com 'O anfitrião recusou a sua entrada.', não entra de novo, e a Ana volta a esperar",
    bFora && aEsp && rec && !rec.convidado && rec.recusados && rec.recusados.uidBruno === true && e4 === "O anfitrião recusou a sua entrada nesta sala.", { e4, rec });
  await print(B, "4-recusado");

  /* 5) fechar a sala; entrar pelo link e aceitar */
  await clica(A, "^Fechar a sala$");
  await confirmaSheet(A, "Sair");
  const fechou = await ate(A, () => TM.online3d.estado().fase === null, null, 8000);
  await espera(300);
  confere("5 fechar a sala apaga o nó do banco", fechou && banco.ler("salas3d/" + cod1) == null, banco.ler("salas3d/" + cod1));
  await clica(A, "^Criar sala$");
  await fase(A, "esperando");
  const cod2 = (await est(A)).codigo;
  await B.p.goto(BASE + "/index.html?online3d=" + cod2, { waitUntil: "load" });
  await B.p.waitForFunction(() => window.TM && TM.online3d, null, { timeout: 60000 });
  await B.p.evaluate(g => { if (!g) TM.tm3d.PASTA = "__eco3d.html"; }, GOLACO);
  const bLink = await fase(B, "aguardaAceite", 20000);
  const aEntrou2 = await fase(A, "entrou");
  confere("5 entrar pelo LINK (?online3d=): o Bruno entra direto e a Ana vê o pedido", bLink && aEntrou2 && (await est(B)).codigo === cod2);
  // a ligação que não dá (prazo curtíssimo nos dois): a tela da seção 4.2 nos dois; "Tentar de novo" pelo convidado
  await A.p.evaluate(() => { TM.online3d.api.PRAZO_MS = 1; });
  await B.p.evaluate(() => { TM.online3d.api.PRAZO_MS = 1; });
  await clica(A, "^Aceitar$");
  const falhouA = await fase(A, "falhou", 10000), falhouB = await fase(B, "falhou", 10000);
  const TXT_FALHA = "Não deu para ligar os dois aparelhos direto. A rede de um de vocês bloqueia a conexão direta (comum no 4G). Tentem os dois no mesmo Wi-Fi, ou outro Wi-Fi.";
  const tfA = await tela(A), tfB = await tela(B);
  confere("5 ligação que não dá: a mensagem clara da seção 4.2 nos dois, com Tentar de novo e Sair",
    falhouA && falhouB && tfA.includes(TXT_FALHA) && tfB.includes(TXT_FALHA) && /Tentar de novo/.test(tfA) && /Tentar de novo/.test(tfB), { falhouA, falhouB, tfA: tfA.slice(0, 160) });
  await print(A, "5-falhou");
  await nadaSobreNada(A, "falhou");
  await A.p.evaluate(() => { TM.online3d.api.PRAZO_MS = 15000; });
  await B.p.evaluate(() => { TM.online3d.api.PRAZO_MS = 15000; });
  const t0lig = Date.now();
  await clica(B, "^Tentar de novo$");

  /* 6) ligando */
  const ligouA = await fase(A, "times", 22000), ligouB = await fase(B, "times", 22000);
  const tLig = Date.now() - t0lig;
  eA = await est(A); let eB = await est(B);
  await espera(400);
  const rtc = banco.ler("salas3d/" + cod2 + "/rtc");
  confere("6 'Tentar de novo' (pedido pelo convidado): os dois aparelhos ligam por WebRTC (≤ 20 s), canais abertos e o nó rtc apagado do banco",
    ligouA && ligouB && tLig <= 20000 && eA.lig?.estado === "aberto" && eB.lig?.estado === "aberto" && rtc == null, { tLig, ligA: eA.lig, ligB: eB.lig, rtc: rtc ? Object.keys(rtc) : null });

  /* 7) pings */
  const medido = await ate(A, () => { const e = TM.online3d.estado(); return e.D0 != null && e.rtt != null; }, null, 8000);
  await ate(B, () => TM.online3d.estado().rtt != null, null, 5000);
  eA = await est(A); eB = await est(B);
  const linhaA = await A.p.evaluate(() => document.querySelector(".o3d-con")?.textContent || ""), linhaB = await B.p.evaluate(() => document.querySelector(".o3d-con")?.textContent || "");
  confere("7 10 pings: 'Conexão boa (N ms)' nos dois e D0 entre 3 e 10", medido && eA.D0 >= 3 && eA.D0 <= 10 && /^Conexão boa \(\d+ ms\)$/.test(linhaA) && /^Conexão boa \(\d+ ms\)$/.test(linhaB), { D0: eA.D0, rttA: eA.rtt, rttB: eB.rtt, linhaA, linhaB, par: eA.lig?.par });

  /* 8) os times */
  async function escolhe(cl, regra) {
    await clica(cl, "^Escolher o meu time$", "button");
    await ate(cl, () => TM.ui.current() === "pick-team" && document.querySelectorAll(".tp-row").length > 5, null, 8000);
    return regra(cl);
  }
  let viverde = false;
  const nomeA = await escolhe(A, async cl => {
    const temEsp = await cl.p.evaluate(() => [...document.querySelectorAll(".tp-row")].some(x => /Viverde FC/.test(x.textContent)));
    if (SENHA && temEsp) {
      await cl.p.evaluate(() => [...document.querySelectorAll(".tp-row")].find(x => /Viverde FC/.test(x.textContent)).click());
      await cl.p.waitForSelector(".vv-senha", { timeout: 5000 });
      await cl.p.fill(".vv-senha", "senha-errada-de-teste");
      await clica(cl, "^Liberar$");
      await espera(600);
      const recusou = await cl.p.evaluate(() => !!document.querySelector(".vv-senha") && !TM.viverde.liberado());
      await cl.p.fill(".vv-senha", SENHA);
      await clica(cl, "^Liberar$");
      await ate(cl, () => TM.ui.current() === "online3d", null, 8000);
      viverde = recusou && (await est(cl)).meu?.id === "viverde";
    } else {
      await cl.p.evaluate(() => [...document.querySelectorAll(".tp-row")].filter(x => !/Viverde/.test(x.textContent))[2].click());
      await ate(cl, () => TM.ui.current() === "online3d", null, 8000);
    }
    return (await est(cl)).meu?.nome;
  });
  const nomeB = await escolhe(B, async cl => {
    await cl.p.evaluate(() => [...document.querySelectorAll(".tp-row")].filter(x => !/Viverde/.test(x.textContent))[5].click());
    await ate(cl, () => TM.ui.current() === "online3d", null, 8000);
    return (await est(cl)).meu?.nome;
  });
  const veA = await ate(A, n => document.body.innerText.includes(n), nomeB, 8000), veB = await ate(B, n => document.body.innerText.includes(n), nomeA, 8000);
  eA = await est(A); eB = await est(B);
  confere("8 cada um escolhe o SEU time e vê o do outro ao vivo" + (SENHA ? " (a Ana com o Viverde FC: a senha errada é recusada, a certa libera)" : " (Viverde pulado: sem TM_SENHA_VIVERDE)"),
    !!nomeA && !!nomeB && veA && veB && eA.dele?.nome === nomeB && eB.dele?.nome === nomeA && (!SENHA || viverde), { nomeA, nomeB, viverde, deleA: eA.dele, deleB: eB.dele });
  await print(A, "8-times-ana"); await print(B, "8-times-bruno");
  await nadaSobreNada(A, "times"); await nadaSobreNada(B, "times-pc");

  /* 9) pronto → os dois quadros abrem com o pedido e a porta */
  await clica(B, "^Pronto$");
  const aViu = await ate(A, () => /Bruno está pronto/.test(document.body.innerText), null, 6000);
  await clica(A, "^Pronto$");
  if (GOLACO) {
    const quadroG = async (cl, ms = 180000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) {
        const fr = cl.p.frames().find(f => /golaco\/index\.html\?tm=/.test(f.url()));
        if (fr && await fr.evaluate(() => !!(window.__golaco && window.__golaco.pronto && window.__golaco.online)).catch(() => false)) return fr;
        await espera(300);
      }
      return null;
    };
    const [gA, gB] = await Promise.all([quadroG(A), quadroG(B)]);
    if (!gA || !gB) for (const cl of [A, B]) for (const f of cl.p.frames()) console.log("  quadro", cl.nome, f.url().slice(0, 140), JSON.stringify(await f.evaluate(() => ({ g: !!window.__golaco, pronto: window.__golaco?.pronto, online: !!window.__golaco?.online, erro: document.querySelector('#erro, .erro, #carregando')?.textContent?.slice(0, 200) ?? null, pedido: (() => { try { const id = new URLSearchParams(location.search).get('tm'); const p = JSON.parse(localStorage.getItem('tm3d:pedido:' + id)); return p ? { modo: p.modo, online: !!p.online, home: !!p.home } : null; } catch (e) { return String(e); } })() })).catch(e => String(e).slice(0, 200))));
    confere("G1 os dois GOLAÇOs abrem com o pedido online", !!gA && !!gB);
    if (gA && gB) {
      for (const g of [gA, gB]) await g.evaluate(() => window.__golaco.abrirMenu());   // a IA joga pelos dois (bit IA)
      const ateN = (g, n) => g.waitForFunction(k => (window.__golaco.online?.n ?? 0) >= k, n, { timeout: 360000 }).then(() => true, () => false);
      const [ra, rb] = await Promise.all([ateN(gA, 900), ateN(gB, 900)]);
      const ler = g => g.evaluate(() => { const o = window.__golaco.online; return { n: o.n, D: o.D, rtt: o.rtt, lado: o.lado, hashes: o.hashes, conexao: o.conexao, placar: o.placar }; });
      const oa = await ler(gA), ob = await ler(gB);
      const mh = new Map(oa.hashes), com = ob.hashes.filter(([n]) => mh.has(n)), dif = com.filter(([n, h]) => mh.get(n) !== h).length;
      confere("G2 a partida anda nos dois aparelhos (WebRTC de verdade pela porta do TM) com o mesmo jogo",
        ra && rb && com.length >= 5 && dif === 0 && oa.lado === 0 && ob.lado === 1,
        { n: [oa.n, ob.n], D: [oa.D, ob.D], rtt: [oa.rtt, ob.rtt], comuns: com.length, dif, conexao: [oa.conexao, ob.conexao], placar: [oa.placar, ob.placar] });
      await print(A, "G-ana"); await print(B, "G-bruno");
    }
    confere("G3 nenhum erro de página (nos dois aparelhos)", erros.length === 0, erros.slice(0, 4));
    console.log(`\nOK: ${ok.length}${falhas.length ? `  FALHAS: ${falhas.length}\n` + falhas.join("\n") : ""}`);
    console.log(`\ntestar-online3d --golaco: ${falhas.length ? "REPROVOU" : "PASSOU"} (${ok.length} ok, ${falhas.length} falhas)`);
    await nav.close();
    process.exit(falhas.length ? 1 : 0);
  }
  const [fA, fB] = await Promise.all([quadroDe(A), quadroDe(B)]);
  let pedA = null, pedB = null, portaA = null, portaB = null;
  if (fA && fB) {
    pedA = await fA.evaluate(() => window.__eco.pedido); pedB = await fB.evaluate(() => window.__eco.pedido);
    portaA = await fA.evaluate(() => ({ portas: __eco.portas, viaPorts: __eco.viaPorts, proto: __eco.protoPorta, estados: __eco.estados.map(e => e.estado), nome: __eco.estados[0]?.nome }));
    portaB = await fB.evaluate(() => ({ portas: __eco.portas, viaPorts: __eco.viaPorts, proto: __eco.protoPorta, estados: __eco.estados.map(e => e.estado), nome: __eco.estados[0]?.nome }));
  }
  const oA = pedA?.online, oB = pedB?.online;
  const pedidoOk = !!pedA && !!pedB && pedA.modo === "online" && pedB.modo === "online" && pedA.v === 2 && pedA.id !== pedB.id
    && oA.sala === cod2 && oB.sala === cod2 && Number.isInteger(oA.semente) && oA.semente > 0 && oA.semente <= 4294967295 && oA.semente === oB.semente
    && JSON.stringify(oA.nomes) === '["Ana","Bruno"]' && JSON.stringify(oB.nomes) === '["Ana","Bruno"]' && oA.D0 === oB.D0 && oA.D0 >= 3 && oA.D0 <= 10
    && oA.proto === 1 && oB.proto === 1 && oA.lado === 0 && oB.lado === 1 && pedA.userSide === "home" && pedB.userSide === "away"
    && pedA.controle == null && pedB.controle == null && pedA.home.name === nomeA && pedA.away.name === nomeB && pedB.home.name === nomeA && pedB.away.name === nomeB
    && JSON.stringify(pedA.home) === JSON.stringify(pedB.home) && JSON.stringify(pedA.away) === JSON.stringify(pedB.away)
    && [0, 1, 2].includes(pedA.home.kitEscolhido) && [0, 1, 2].includes(pedA.away.kitEscolhido) && pedA.home.players.length >= 11 && pedA.away.players.length >= 11
    && JSON.stringify(pedA.partida) === JSON.stringify(pedB.partida) && pedA.edicao === "pro";
  confere("9 Pronto nos dois: os dois quadros abrem com o MESMO pedido online (sala, semente u32, nomes, D0, proto 1, lado 0/1, userSide, times e uniformes)",
    aViu && pedidoOk, { aViu, A: pedA && { id: pedA.id, online: oA, userSide: pedA.userSide, home: pedA.home.name, away: pedA.away.name, kits: [pedA.home.kitEscolhido, pedA.away.kitEscolhido], edicao: pedA.edicao }, B: pedB && { id: pedB.id, online: oB, userSide: pedB.userSide } });
  confere("9 a porta chega nos dois quadros (tm3d:porta, e.ports[0], proto 1) com o estado 'aberto' e o nome do outro",
    !!portaA && !!portaB && portaA.portas >= 1 && portaB.portas >= 1 && portaA.viaPorts && portaB.viaPorts && portaA.proto === 1 && portaA.estados[0] === "aberto" && portaB.estados[0] === "aberto" && portaA.nome === "Bruno" && portaB.nome === "Ana", { portaA, portaB });
  await print(A, "9-quadro-ana");

  /* 10) a porta nos dois sentidos */
  if (fA && fB) {
    const grande = "x".repeat(40000);
    await fA.evaluate(g => { __eco.manda(50, 0); __eco.ctrlManda({ tipo: "teste", lado: 0, n: 1 }); __eco.ctrlManda({ tipo: "grande", lado: 0, s: g }); }, grande);
    await fB.evaluate(g => { __eco.manda(50, 1); __eco.ctrlManda({ tipo: "teste", lado: 1, n: 2 }); __eco.ctrlManda({ tipo: "grande", lado: 1, s: g }); }, grande);
    await espera(1500);
    const rA = await fA.evaluate(() => ({ bin: __eco.bin.filter(b => b[0] === 1 && b[2] === 7).length, ctrl: __eco.ctrl.map(m => m.tipo + ":" + m.lado + (m.s ? ":" + m.s.length : "")) }));
    const rB = await fB.evaluate(() => ({ bin: __eco.bin.filter(b => b[0] === 0 && b[2] === 7).length, ctrl: __eco.ctrl.map(m => m.tipo + ":" + m.lado + (m.s ? ":" + m.s.length : "")) }));
    confere("10 pela porta, nos dois sentidos: pacotes do canal 'jogo' (≥ 45 de 50 no loopback) e controle pelo 'ctrl' (o de 40 KB inteiro, em pedaços)",
      rA.bin >= 45 && rB.bin >= 45 && rA.ctrl.join() === "teste:1,grande:1:40000" && rB.ctrl.join() === "teste:0,grande:0:40000", { rA, rB });
  } else confere("10 pela porta, nos dois sentidos", false, "os quadros não abriram");

  /* 11) fim igual nas duas telas e o h2h uma vez */
  const R = pedA ? {
    homeGoals: 2, awayGoals: 1,
    gols: [{ lado: 0, tmId: pedA.home.players[9].tmId, nome: pedA.home.players[9].name, minuto: 12 }, { lado: 0, tmId: pedA.home.players[10].tmId, nome: pedA.home.players[10].name, minuto: 55 }, { lado: 1, tmId: pedA.away.players[9].tmId, nome: pedA.away.players[9].name, minuto: 70 }],
    cartoes: [], stats: { possession: [54, 46], shots: [9, 6], onTarget: [4, 2] }
  } : null;
  if (fA && fB) {
    await fA.evaluate(r => __eco.fim(r, { hashFinal: "abc123" }), R);
    await fB.evaluate(r => __eco.fim(r, { hashFinal: "abc123" }), R);
  }
  const resA = await fase(A, "resultado", 8000), resB = await fase(B, "resultado", 8000);
  await espera(2500);
  const tA = await tela(A), tB = await tela(B);
  const par = ["uidAna", "uidBruno"].sort().join("_");
  const h2h1 = banco.ler("h2h/" + par), rk1 = banco.ler("ranking/uidAna");
  confere("11 fim igual nas duas telas: os dois nomes, o placar 2 × 1, Vitória (Ana) × Derrota (Bruno)",
    resA && resB && /Ana × Bruno/.test(tA) && /Ana × Bruno/.test(tB) && /2 × 1/.test(tA) && /2 × 1/.test(tB) && /Vitória/i.test(tA) && /Derrota/i.test(tB) && tA.includes(nomeA) && tB.includes(nomeB), { tA: tA.slice(0, 300), tB: tB.slice(0, 300) });
  confere("11 o h2h e o ranking gravados UMA vez, pelo anfitrião; a ligação fecha depois do fim",
    h2h1?.wins?.uidAna === 1 && !h2h1?.draws && rk1?.wins === 1 && rk1?.played === 1 && banco.ler("ranking/uidBruno")?.played === 1 && (await est(A)).lig == null, { h2h1, rk1 });
  await print(A, "11-fim-ana"); await print(B, "11-fim-bruno");
  await nadaSobreNada(A, "fim");

  /* 12) jogar de novo; o Bruno sai no meio */
  await clica(A, "^Jogar de novo$");
  await espera(400);
  await clica(B, "^Jogar de novo$");
  const deNovoA = await fase(A, "times", 22000), deNovoB = await fase(B, "times", 22000);
  eA = await est(A); eB = await est(B);
  confere("12 'Jogar de novo': a mesma sala liga de novo (partida 2), os times escolhidos continuam, ninguém pronto",
    deNovoA && deNovoB && eA.partidaN === 2 && eB.partidaN === 2 && eA.codigo === cod2 && eA.meu?.nome === nomeA && !eA.prontoEu && !eB.prontoEu, { A: eA.fase, B: eB.fase, nA: eA.partidaN });
  await ate(A, () => TM.online3d.estado().dele != null, null, 6000);
  await ate(B, () => TM.online3d.estado().dele != null, null, 6000);
  await clica(A, "^Pronto$"); await espera(300); await clica(B, "^Pronto$");
  const [gA, gB] = await Promise.all([quadroDe(A), quadroDe(B)]);
  const fpAntes = await B.p.evaluate(() => TM.fairplay.status().abandons);
  if (gA && gB) {
    await gB.evaluate(() => __eco.sair({ abandono: true }));
    const bSaiu = await fase(B, "resultado", 8000);
    const fechadoA = await gA.evaluate(async () => { for (let i = 0; i < 60; i++) { if (__eco.estados.some(e => e.estado === "fechado")) return true; await new Promise(r => setTimeout(r, 100)); } return false; });
    const tB2 = await tela(B);
    const fpDepois = await B.p.evaluate(() => TM.fairplay.status().abandons);
    confere("12 o Bruno sai no meio: a tela dele diz derrota por W.O., o fair play conta o abandono e a porta da Ana recebe 'fechado'",
      bSaiu && /Você saiu da partida/i.test(tB2) && /derrota por W\.O\./i.test(tB2) && fpDepois === fpAntes + 1 && fechadoA, { fpAntes, fpDepois, fechadoA, tB2: tB2.slice(0, 200) });
    await gA.evaluate(() => __eco.fim({ homeGoals: 3, awayGoals: 0, gols: [], cartoes: [], stats: { possession: [50, 50], shots: [0, 0], onTarget: [0, 0] } }, { wo: { vencedor: 0, motivo: "abandono" } }));
    await fase(A, "resultado", 8000);
    await espera(800);
    const tA2 = await tela(A);
    const h2h2 = banco.ler("h2h/" + par);
    confere("12 a Ana fica com a vitória por W.O. (3 × 0) e o h2h vai a 2 (gravado pelo anfitrião)",
      /Vitória por W\.O\./i.test(tA2) && /3 × 0/.test(tA2) && h2h2?.wins?.uidAna === 2 && banco.ler("ranking/uidAna")?.wins === 2, { h2h2, tA2: tA2.slice(0, 200) });
    await print(A, "12-wo-ana"); await print(B, "12-saiu-bruno");
  } else confere("12 a 2ª partida abre", false, { gA: !!gA, gB: !!gB });

  /* 13) sair apaga a sala */
  await clica(B, "^Sair$");
  await clica(A, "^Sair$");
  const saiuA = await ate(A, () => TM.online3d.estado().fase === null, null, 6000);
  await espera(500);
  confere("13 Sair: a sala sai do banco e os dois voltam à entrada", saiuA && banco.ler("salas3d/" + cod2) == null && (await est(B)).fase === null, banco.ler("salas3d"));
} catch (e) {
  confere("o teste rodou até o fim", false, String(e && e.stack || e).slice(0, 600));
}

const ruins = nadaSobre.filter(x => x.sobre.length || x.fora.length || x.rolaLado);
confere("13 nada sobre nada nas telas do Online 3D (entrada, sala, entrou, falhou, times, fim × 360, 390, 844×390, 1280)", ruins.length === 0 && nadaSobre.length >= 20, ruins.length ? ruins : nadaSobre.length);
for (const cl of [A, B]) {
  const e = await cl.p.evaluate(() => window.__errosPagina.slice()).catch(() => []);
  erros.push(...e.map(x => cl.nome + ": " + x));
}
confere("13 nenhum erro de página (nos dois aparelhos)", erros.length === 0, erros);
console.log("\nOK: " + ok.length + "\n" + (falhas.length ? "FALHOU:\n  " + falhas.join("\n  ") + "\n" : ""));
console.log((falhas.length ? "testar-online3d: REPROVOU" : "testar-online3d: PASSOU") + " (" + ok.length + " ok, " + falhas.length + " falhas) · prints em " + PASTA);
await nav.close();
process.exit(falhas.length ? 1 : 0);
