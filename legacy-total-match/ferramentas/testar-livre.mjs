/* Teste de ponta a ponta do Modo Livre 3D (Total Match → GOLAÇO → Total Match; pedido do dono de 16/10).
   O site precisa estar montado como no GitHub Pages: o TM na raiz e o 3D em /golaco/. Ex.:
     mkdir -p /tmp/site && cp -r legacy-total-match/. /tmp/site/ && ln -sfn "$PWD/golaco" /tmp/site/golaco
     (cd /tmp/site && python3 -m http.server 8231)
     TM_SENHA_VIVERDE=... node legacy-total-match/ferramentas/testar-livre.mjs [http://localhost:8231] [pasta-dos-prints]
   A senha do Viverde FC vem SÓ da variável de ambiente TM_SENHA_VIVERDE (nunca no código nem em arquivo); sem ela, o
   Viverde fica de fora (o item 4 sai como "pulado") e o "Seu time" é um clube comum.
   Passa por:
     1 "Modo Livre 3D" em "Mais modos" (ícone + nome, sem emoji) e a tela do modo (Seu time, Adversário, Treinar em 3D);
     2 "Mais modos" com os 11 atalhos: numa linha no PC (1280); no tablet (820) nenhum sozinho numa linha; no celular (360,
       grade de 3) a última linha cheia, sem buraco no fim nem um atalho perdido no canto;
     3 o seletor dos dois times (o do jogo rápido): o adversário é um clube das ligas;
     4 o Viverde FC em "Especiais" pede a senha: a errada é recusada, a certa libera e ele vira o "Seu time";
     5 "Treinar em 3D" abre o GOLAÇO no quadro com o pedido modo "livre" (o humano no time 0, sem trava nem controle "só o
       meu jogador", o Seu time em casa) e o 3D avisa o TM (pronto: o aviso e o X do TM somem);
     6 o 3D abre no Modo Livre (window.__golaco.livre existe e o mundo é 'livre');
     7 jogadores e câmera pela API de teste do 3D: 4 contra 2 (3 + goleiro × 2 de linha) entra no campo ao sair da pausa;
       cada câmera do Livre fica escolhida;
     8 a pausa do Livre com o TM: "Voltar ao Total Match" à vista, sem "Simular o resto", Reiniciar nem Editar time;
     9 "Voltar ao Total Match" (clique): o TM volta à tela do modo, o quadro fecha e nada conta (o armazenamento do TM igual
       ao de antes do treino, sem tela de resultado);
    10 a escolha inicial pelo pedido (TM.tm3d.jogarLivre com livre): vai conferida no pedido (de linha 0–10, o meu time com
       ≥ 1) e o 3D abre com ela; o fim com { livre: { placar } } também só volta à tela do modo;
    11 o quadro do 3D no Livre não promete simular: o X, a confirmação e o aviso de demora com os textos do treino;
    12 nada sobre nada na tela do modo (360, 390 e 844×390 do celular; 1280 do PC): nenhum botão encostado em outro, nada
       fora da tela, sem rolagem de lado;
    13 nenhum erro de página (no TM e dentro do 3D).
   Os itens 6, 7 e 8 dependem do lado do GOLAÇO (golaco/js/livre.js e a pausa do Livre): sem ele, reprovam com o motivo.
   O Chromium headless não passa pelo proxy: o three.js (jsdelivr) vem do cache de golaco/tools/lib/navegador.mjs. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const { abrir } = await import(path.join(AQUI, "../../golaco/tools/lib/navegador.mjs"));
const args = process.argv.slice(2).filter(a => !a.startsWith("--"));
const BASE = args[0] || "http://localhost:8231";
const PASTA = args[1] || "/tmp/testar-livre";
const SENHA = process.env.TM_SENHA_VIVERDE || "";
fs.mkdirSync(PASTA, { recursive: true });

const { navegador: b, contexto: cx, pagina: p } = await abrir({ largura: 390, altura: 844, toque: true, dpr: 2 });
const erros = [];
p.on("pageerror", e => erros.push(String(e).slice(0, 300)));
await cx.addInitScript(() => {
  window.__errosPagina = [];
  addEventListener("error", e => window.__errosPagina.push(String(e.message || e).slice(0, 300)));
  addEventListener("unhandledrejection", e => window.__errosPagina.push("promessa: " + String(e.reason).slice(0, 300)));
});
await p.addInitScript(() => {
  localStorage.setItem("totalmatch:__edition", "pro"); localStorage.setItem("totalmatch:su_unlocked", "1");
  // 3D leve para o teste: qualidade baixa e sem replays automáticos
  if (!localStorage.getItem("golaco.prefs.v1")) localStorage.setItem("golaco.prefs.v1", JSON.stringify({ qualidade: "baixa", replay: false }));
});
await p.goto(BASE + "/index.html", { waitUntil: "networkidle" });
await p.waitForFunction(() => window.TM && TM.tm3d && TM.livre3d && TM.ui && TM.data, { timeout: 60000 });

const falhas = [], ok = [];
function confere(nome, cond, info) { (cond ? ok : falhas).push(nome + (info != null ? " — " + JSON.stringify(info) : "")); }
async function print(nome) { await p.screenshot({ path: path.join(PASTA, nome + ".png") }); }
const clicaTexto = (rx, sel = "button") => p.evaluate(([rx, sel]) => { const x = [...document.querySelectorAll(sel)].find(e => new RegExp(rx).test(e.textContent.trim()) && e.offsetParent !== null); if (x) x.click(); return !!x; }, [rx, sel]);
const espera = ms => p.waitForTimeout(ms);

// nada sobre nada: os clicáveis visíveis da tela (o mesmo critério de ferramentas/testar-sobreposicao.mjs)
const sobreposicao = () => p.evaluate(() => {
  const sel = "button, a[href], [role=button], input, select, .chosen-team, .vit-mais-b";
  const els = [...document.querySelectorAll(sel)].filter(e => {
    const cs = getComputedStyle(e); if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity < 0.05 || cs.pointerEvents === "none") return false;
    const rc = e.getBoundingClientRect(); if (rc.width < 4 || rc.height < 4) return false;
    let a = e.parentElement; while (a) { const c2 = getComputedStyle(a); if (c2.display === "none" || c2.visibility === "hidden" || +c2.opacity < 0.05) return false; a = a.parentElement; }
    return true;
  });
  const nome = e => (e.className && typeof e.className === "string" ? "." + e.className.trim().split(/\s+/).slice(0, 2).join(".") : e.tagName) + (e.textContent ? ' "' + e.textContent.trim().slice(0, 18) + '"' : "");
  const pares = [];
  for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
    const A = els[i], B = els[j];
    if (A.contains(B) || B.contains(A)) continue;
    const a = A.getBoundingClientRect(), bb = B.getBoundingClientRect();
    const ix = Math.min(a.right, bb.right) - Math.max(a.left, bb.left), iy = Math.min(a.bottom, bb.bottom) - Math.max(a.top, bb.top);
    if (ix > 1 && iy > 1) pares.push(nome(A) + " X " + nome(B));
  }
  const larg = document.documentElement.clientWidth;
  const fora = els.filter(e => { const rc = e.getBoundingClientRect(); return rc.right > larg + 1 || rc.left < -1; }).map(nome);
  return { n: els.length, sobre: pares, fora, rolaLado: document.documentElement.scrollWidth > larg + 1 };
});
async function nadaSobreNada(rota, rotulo) {
  const r = [];
  for (const [w, h] of [[360, 740], [390, 844], [844, 390], [1280, 800]]) {
    await p.setViewportSize({ width: w, height: h });
    await p.evaluate(r => TM.ui.go(r), rota);
    await espera(500);
    await p.evaluate(() => document.querySelectorAll(".toast").forEach(t => t.remove()));
    const s = await sobreposicao();
    r.push({ tela: w + "x" + h, n: s.n, sobre: s.sobre.slice(0, 4), fora: s.fora.slice(0, 4), rolaLado: s.rolaLado });
    await p.screenshot({ path: path.join(PASTA, `12-${rotulo}-${w}x${h}.png`), fullPage: true });
  }
  await p.setViewportSize({ width: 390, height: 844 });
  return r;
}
// o armazenamento do TM (sem o do 3D — golaco.* — nem o pedido/resultado do quadro, tm3d:*): o treino não pode mudar nada
const armazenamentoTM = () => p.evaluate(() => {
  const o = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (!/^(golaco\.|tm3d:)/.test(k)) o[k] = localStorage.getItem(k); }
  return o;
});
const difere = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => a[k] !== b[k]);

// 1) o modo no menu e a tela
await p.evaluate(() => TM.ui.go("modes"));
await espera(800);
const mais = await p.evaluate(() => {
  const b = [...document.querySelectorAll(".vit-mais-b")].find(x => /Modo Livre 3D/.test(x.textContent));
  return b ? { texto: b.textContent.trim(), icone: !!b.querySelector(".tm-ic, svg"), emoji: /\p{Extended_Pictographic}/u.test(b.textContent) } : null;
});
confere("1 'Modo Livre 3D' em Mais modos (ícone + nome, sem emoji)", !!mais && mais.icone && !mais.emoji, mais);

// 2) a grade do "Mais modos" com 11 atalhos
const grade = [];
for (const [w, h] of [[1280, 800], [820, 1180], [360, 740]]) {
  await p.setViewportSize({ width: w, height: h });
  await p.evaluate(() => TM.ui.go("modes"));
  await espera(500);
  grade.push(await p.evaluate(w => {
    const bs = [...document.querySelectorAll(".vit-mais-b")].filter(b => b.offsetParent !== null).map(b => b.getBoundingClientRect());
    const tops = [...new Set(bs.map(r => Math.round(r.top)))].sort((a, b) => a - b);
    const porLinha = tops.map(t => bs.filter(r => Math.round(r.top) === t));
    const esq = Math.min(...bs.map(r => r.left)), dir = Math.max(...bs.map(r => r.right));
    const ult = porLinha[porLinha.length - 1];
    return { tela: w, n: bs.length, linhas: porLinha.map(l => l.length),
      // a última linha cheia de ponta a ponta (sem buraco no fim)?
      ultimaCheia: Math.abs(Math.min(...ult.map(r => r.left)) - esq) <= 2 && Math.abs(Math.max(...ult.map(r => r.right)) - dir) <= 2 };
  }, w));
}
await p.setViewportSize({ width: 390, height: 844 });
await p.evaluate(() => TM.ui.go("modes"));
await espera(400);
await print("2-mais-modos-celular");
const [g1280, g820, g360] = grade;
confere("2 'Mais modos': 11 atalhos numa linha no PC; no tablet nenhum sozinho numa linha; no celular a última linha cheia",
  g1280.n === 11 && g1280.linhas.length === 1 && g820.n === 11 && g820.linhas.every(n => n > 1) && g360.n === 11 && g360.ultimaCheia, grade);

await p.evaluate(() => [...document.querySelectorAll(".vit-mais-b")].find(x => /Modo Livre 3D/.test(x.textContent)).click());
await espera(700);
const tela = await p.evaluate(() => ({ rota: TM.ui.current(), txt: document.querySelector(".screen.is-active, .screen")?.innerText || "" }));
confere("1 a tela do modo: Seu time, Adversário e 'Treinar em 3D'", tela.rota === "livre3d" && /Seu time/.test(tela.txt) && /Adversário/.test(tela.txt) && /Treinar em 3D/i.test(tela.txt), tela.rota);
await print("1-tela");

// 3) o adversário: um clube das ligas pelo seletor
await p.evaluate(() => [...document.querySelectorAll(".chosen-team")].find(x => /Adversário/.test(x.textContent)).click());
await espera(600);
const nomeAdv = await p.evaluate(() => { const rows = [...document.querySelectorAll(".tp-row")]; const outro = rows.find(x => !/Viverde/.test(x.textContent)); outro.click(); return outro.querySelector(".tp-name")?.textContent; });
await espera(600);
confere("3 o adversário escolhido no seletor do jogo rápido", await p.evaluate(n => TM.ui.current() === "livre3d" && !!TM.livre3d.setup.teamB && document.body.innerText.includes(n), nomeAdv), nomeAdv);

// 4) o Viverde FC (Especiais, com a senha) como o Seu time
let seu = null;
await p.evaluate(() => [...document.querySelectorAll(".chosen-team")].find(x => /Seu time/.test(x.textContent)).click());
await espera(600);
const temEsp = await p.evaluate(() => /Especiais/i.test(document.body.innerText) && [...document.querySelectorAll(".tp-row")].some(x => /Viverde FC/.test(x.textContent)));
if (SENHA && temEsp) {
  await p.evaluate(() => [...document.querySelectorAll(".tp-row")].find(x => /Viverde FC/.test(x.textContent)).click());
  await p.waitForSelector(".vv-senha", { timeout: 5000 });
  await p.fill(".vv-senha", "senha-errada-de-teste");
  await clicaTexto("^Liberar$");
  await espera(700);
  const recusou = await p.evaluate(() => !!document.querySelector(".vv-senha") && TM.ui.current() === "pick-team" && !TM.viverde.liberado());
  await p.fill(".vv-senha", SENHA);
  await clicaTexto("^Liberar$");
  await p.waitForFunction(() => TM.ui.current() === "livre3d", null, { timeout: 8000 }).catch(() => {});
  seu = await p.evaluate(() => TM.livre3d.setup.teamA);
  confere("4 Viverde FC em Especiais: a senha errada é recusada, a certa libera e ele é o Seu time", recusou && seu === "viverde" && await p.evaluate(() => TM.viverde.liberado()), { recusou, seu });
} else {
  confere("4 Viverde FC em Especiais (senha): " + (SENHA ? "SEM a linha Especiais" : "pulado (sem TM_SENHA_VIVERDE)"), !SENHA ? true : temEsp);
  await p.evaluate(() => { const rows = [...document.querySelectorAll(".tp-row")].filter(x => !/Viverde/.test(x.textContent)); rows[3].click(); });
  await espera(600);
  seu = await p.evaluate(() => TM.livre3d.setup.teamA);
}
await print("4-times");
const nomeSeu = await p.evaluate(id => TM.data.club(id)?.name, seu);

// abre o 3D (pelo botão ou por uma chamada) e espera o GOLAÇO avisar que está pronto
async function espera3d() {
  for (let i = 0; i < 240; i++) {
    await espera(500);
    const fr = p.frames().find(f => /golaco\/index\.html\?tm=/.test(f.url()));
    if (fr && await fr.evaluate(() => !!(window.__golaco && window.__golaco.pronto && window.__golaco.tm)).catch(() => false)) { await espera(1200); return fr; }
  }
  return null;
}
async function errosDoQuadro(fr) { if (fr) { const e = await fr.evaluate(() => window.__errosPagina.slice()).catch(() => []); erros.push(...e.map(x => "3D: " + x)); } }
// o 3D se joga com o celular deitado (em pé, com toque, a tela "Gire o celular" para o jogo)
await p.setViewportSize({ width: 844, height: 390 });
await p.evaluate(() => TM.ui.go("livre3d"));
await espera(400);
const antes = await armazenamentoTM();

// 5) "Treinar em 3D": o GOLAÇO no quadro com o pedido modo "livre"
await clicaTexto("^Treinar em 3D$");
let fr = await espera3d();
confere("5 o GOLAÇO abre no quadro e avisa o TM (pronto: o aviso e o X do TM somem)", !!fr && await p.evaluate(() => {
  const a = document.querySelector(".tm3d-aviso"), x = document.querySelector(".tm3d-sair");
  return !!a && getComputedStyle(a).display === "none" && !!x && getComputedStyle(x).display === "none";
}));
let info = null;
if (fr) {
  info = await fr.evaluate(() => {
    const g = window.__golaco, T = g.tm;
    return { modo: T.pedido.modo, controle: T.pedido.controle, livre: T.pedido.livre ?? null, humano: T.humano, trava: T.trava,
      casa: T.pedido.home.name, userSide: T.pedido.userSide, mundo: g.mundo.modo ?? null, temLivre: !!g.livre };
  });
  confere("5 o pedido do Livre: modo 'livre', o humano no time 0 (Seu time em casa), sem trava nem controle",
    info.modo === "livre" && info.controle == null && info.humano === 0 && info.trava == null && info.casa === nomeSeu && info.userSide === "home" && info.livre == null, info);
  // 6) o 3D no Modo Livre
  confere("6 o 3D abre no Modo Livre (__golaco.livre e o mundo 'livre')", info.temLivre && info.mundo === "livre", { temLivre: info.temLivre, mundo: info.mundo });
  await espera(1500);
  await print("6-livre-3d");

  // 7) jogadores e câmera pela API de teste do 3D
  const j = await fr.evaluate(async () => {
    const g = window.__golaco, L = g.livre, dorme = ms => new Promise(ok => setTimeout(ok, ms));
    const conta = () => [0, 1].map(t => g.mundo.jogadores.filter(o => o.time === t).length);
    const r = { antes: conta(), api: null };
    if (!L) return r;
    const nome = ["ajustar", "ajustarJogadores", "definirJogadores", "jogadores", "escolher", "definir", "mudar"].find(k => typeof L[k] === "function");
    r.api = nome || Object.keys(L).join(",");
    if (!nome) return r;
    L[nome]({ linha: [3, 2], goleiro: [true, false] });
    // a mudança vale ao sair da pausa ("Jogar"/"Continuar")
    const jogar = [...document.querySelectorAll("#menu button")].find(x => x.offsetParent !== null && /^(Jogar|Continuar)\b/.test(x.textContent.trim()));
    if (jogar) jogar.click(); else g.fecharMenu();
    for (let i = 0; i < 40 && conta().join() !== "4,2"; i++) await dorme(100);
    r.depois = conta();
    r.goleiros = [0, 1].map(t => g.mundo.jogadores.filter(o => o.time === t && o.posicao === "GOL").length);
    return r;
  });
  confere("7 jogadores pela API do 3D: 4 contra 2 (3 + goleiro × 2 de linha, sem goleiro) ao sair da pausa",
    !!j.depois && j.depois.join() === "4,2" && j.goleiros.join() === "1,0", j);
  const c = await fr.evaluate(async () => {
    const g = window.__golaco, dorme = ms => new Promise(ok => setTimeout(ok, ms));
    const lista = Array.isArray(g.livre?.cameras) ? g.livre.cameras.slice() : ["tv", "aproximada", "ampla", "alta", "atras", "jogador"];
    const r = [];
    for (const nome of lista.concat(["tv"])) { g.definirCamera(nome); await dorme(350); r.push([nome, g.camera]); }
    return r;
  });
  await print("7-camera");
  confere("7 cada câmera do Livre fica escolhida (6 câmeras)", c.length >= 7 && c.every(([a, b2]) => a === b2), c);

  // 8) a pausa do Livre com o TM
  const pausa = await fr.evaluate(async () => {
    window.__golaco.abrirMenu();
    await new Promise(ok => setTimeout(ok, 300));
    return [...document.querySelectorAll("#menu-acoes button")].filter(x => !x.hidden && x.offsetParent !== null).map(x => x.textContent.trim().replace(/\s+/g, " "));
  });
  await print("8-pausa");
  confere("8 pausa do Livre: 'Voltar ao Total Match' à vista, sem Simular o resto, Reiniciar nem Editar time",
    pausa.some(x => /^Voltar ao Total Match/.test(x)) && !pausa.some(x => /Simular o resto|Reiniciar|Editar time/.test(x)), pausa);

  // 9) "Voltar ao Total Match" (clique): de volta à tela do modo, sem resultado
  await errosDoQuadro(fr);
  const clicou = await fr.evaluate(() => { const v = document.getElementById("btn-voltar-tm"); if (v && !v.hidden && v.offsetParent !== null) { v.click(); return true; } return false; });
  if (!clicou) {
    // sem o botão (o lado do GOLAÇO ainda sem o Livre): o 3D avisa a saída por mensagem, para o resto do teste seguir
    await fr.evaluate(() => parent.postMessage({ tipo: "tm3d:sair", id: window.__golaco.tm.id }, location.origin));
  }
  await p.waitForFunction(() => TM.ui.current() === "livre3d" && !document.querySelector(".tm3d-tela"), null, { timeout: 15000 }).catch(() => {});
  const depois = await armazenamentoTM();
  const volta = await p.evaluate(() => ({ rota: TM.ui.current(), aberto: !!document.querySelector(".tm3d-tela"), poster: !!document.querySelector(".md-poster"),
    sobras: Object.keys(localStorage).filter(k => /^tm3d:/.test(k)) }));
  confere("9 'Voltar ao Total Match' (clique): o TM volta à tela do modo, o quadro fecha e nada conta",
    clicou && volta.rota === "livre3d" && !volta.aberto && !volta.poster && volta.sobras.length === 0 && difere(antes, depois).length === 0,
    { clicou, ...volta, mudou: difere(antes, depois) });
  await print("9-volta-tm");
}

// 10) a escolha inicial pelo pedido: conferida no TM e aplicada no 3D; o fim com { livre: { placar } } só volta
const conferida = await p.evaluate(() => {
  const S = TM.livre3d.setup, time = id => S.source === "nation" ? TM.engine.teamFromNation(id) : TM.engine.teamFromClub(id);
  const ped = l => TM.tm3d.novoPedido({ teamA: time(S.teamA), teamB: time(S.teamB), userSide: 0, modo: "livre", livre: l });
  const a = ped({ linha: [0, 15], goleiro: [false, 1] }), b2 = ped(null), c2 = ped({ linha: [2, 1] }), d = ped({ linha: [0, 0] });
  return { a: a.livre, b: b2.livre ?? null, c: c2.livre, d: d.livre, modo: a.modo, controle: a.controle };
});
const certo = JSON.stringify(conferida.a) === JSON.stringify({ linha: [1, 10], goleiro: [false, true] }) && conferida.b == null
  && JSON.stringify(conferida.c) === JSON.stringify({ linha: [2, 1], goleiro: [true, true] }) && JSON.stringify(conferida.d.linha) === "[1,0]"
  && conferida.modo === "livre" && conferida.controle == null;
const r10 = await p.evaluate(() => {
  const S = TM.livre3d.setup, time = id => S.source === "nation" ? TM.engine.teamFromNation(id) : TM.engine.teamFromClub(id);
  window.__fimLivre = null;
  return TM.tm3d.jogarLivre({ teamA: time(S.teamA), teamB: time(S.teamB), userSide: 0, livre: { linha: [2, 1], goleiro: [true, false] } },
    { fim: r => { window.__fimLivre = { r }; TM.ui.go("livre3d"); }, sair: () => { window.__fimLivre = { sair: true }; TM.ui.go("livre3d"); } });
});
fr = r10 ? await espera3d() : null;
let ini = null;
if (fr) {
  ini = await fr.evaluate(async () => {
    const g = window.__golaco, dorme = ms => new Promise(ok => setTimeout(ok, ms));
    const jogar = [...document.querySelectorAll("#menu button")].find(x => x.offsetParent !== null && /^(Jogar|Continuar)\b/.test(x.textContent.trim()));
    if (jogar) jogar.click(); else g.fecharMenu();
    await dorme(800);
    return { livre: g.tm.pedido.livre, times: [0, 1].map(t => g.mundo.jogadores.filter(o => o.time === t).length), modo: g.mundo.modo ?? null };
  });
  await print("10-escolha-inicial");
  await errosDoQuadro(fr);
  // o fim do 3D com o placar do treino (o lado do GOLAÇO manda assim ou 'tm3d:sair'; os dois só voltam)
  await fr.evaluate(() => parent.postMessage({ tipo: "tm3d:fim", id: window.__golaco.tm.id, resultado: { livre: { placar: [1, 0] } } }, location.origin));
  await p.waitForFunction(() => TM.ui.current() === "livre3d" && !document.querySelector(".tm3d-tela"), null, { timeout: 15000 }).catch(() => {});
}
const fim10 = await p.evaluate(() => ({ rota: TM.ui.current(), aberto: !!document.querySelector(".tm3d-tela"), fim: window.__fimLivre }));
confere("10 a escolha inicial vai conferida no pedido (0–10, o meu time ≥ 1) e o 3D abre com ela (3 × 1); o fim { livre } só volta",
  certo && !!ini && JSON.stringify(ini.livre) === JSON.stringify({ linha: [2, 1], goleiro: [true, false] }) && ini.modo === "livre" && ini.times.join() === "3,1"
    && fim10.rota === "livre3d" && !fim10.aberto && !!fim10.fim && JSON.stringify(fim10.fim.r) === JSON.stringify({ livre: { placar: [1, 0] } }),
  { conferida, ini, fim: fim10 });

// 11) o quadro do 3D no Livre: os textos do treino (nada é simulado) — o 3D numa página que não existe e a demora curta
const quadroTxt = await p.evaluate(async () => {
  const A = TM.tm3d, pasta = A.PASTA, espera = A.ESPERA_MS;
  A.PASTA = "nada-aqui.html"; A.ESPERA_MS = 700;
  const saiu = { n: 0 };
  try {
    const S = TM.livre3d.setup, time = id => S.source === "nation" ? TM.engine.teamFromNation(id) : TM.engine.teamFromClub(id);
    A.jogarLivre({ teamA: time(S.teamA), teamB: time(S.teamB), userSide: 0 }, { sair: () => { saiu.n++; } });
    const x = document.querySelector(".tm3d-sair"), q = document.querySelector(".tm3d-quadro");
    const r = { titulo: x?.title, quadro: q?.title };
    x?.click();
    await new Promise(ok => setTimeout(ok, 150));
    const sh = document.querySelector(".sheet-overlay .sheet");
    r.confirma = sh ? sh.innerText.replace(/\s+/g, " ").trim() : null;
    sh?.querySelector(".sheet-item.cancel")?.click();
    await new Promise(ok => setTimeout(ok, 900));
    r.demora = document.querySelector(".tm3d-aviso")?.innerText.replace(/\s+/g, " ").trim() ?? null;
    [...document.querySelectorAll(".tm3d-aviso button")].find(b => b.offsetParent !== null)?.click();
    await new Promise(ok => setTimeout(ok, 100));
    r.fechou = !document.querySelector(".tm3d-tela"); r.sair = saiu.n;
    return r;
  } finally { A.PASTA = pasta; A.ESPERA_MS = espera; A.fechar(); }
});
confere("11 quadro do Modo Livre 3D: o X, a confirmação e o aviso de demora sem prometer simular",
  !!quadroTxt.titulo && !/simul/i.test(quadroTxt.titulo) && !/simul/i.test(quadroTxt.confirma || "simul") && /Modo Livre/i.test(quadroTxt.confirma || "")
    && !/simul/i.test(quadroTxt.demora || "simul") && /demorando/i.test(quadroTxt.demora || "") && quadroTxt.fechou && quadroTxt.sair === 1 && /Livre/i.test(quadroTxt.quadro || ""), quadroTxt);

// 12) nada sobre nada na tela do modo
const n1 = await nadaSobreNada("livre3d", "tela");
const ruins = n1.filter(x => x.sobre.length || x.fora.length || x.rolaLado);
confere("12 nada sobre nada (360, 390, 844×390, 1280) na tela do modo", ruins.length === 0 && n1.length === 4, ruins.length ? ruins : n1.map(x => x.tela + ":" + x.n));

// 13) erros
const errosTM = await p.evaluate(() => window.__errosPagina.slice());
confere("13 nenhum erro de página (TM e 3D)", erros.length === 0 && errosTM.length === 0, [...erros, ...errosTM]);
console.log("OK:\n  " + ok.join("\n  "));
if (falhas.length) console.log("FALHOU:\n  " + falhas.join("\n  "));
console.log((falhas.length ? "testar-livre: REPROVOU" : "testar-livre: PASSOU") + " (" + ok.length + " ok, " + falhas.length + " falhas) · prints em " + PASTA);
await b.close();
process.exit(falhas.length ? 1 : 0);
