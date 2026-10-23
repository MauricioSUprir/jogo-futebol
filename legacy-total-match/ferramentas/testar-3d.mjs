/* Teste de ponta a ponta das partidas em 3D (Total Match → GOLAÇO novo → Total Match).
   O site precisa estar montado como no GitHub Pages: o TM na raiz e o 3D em /golaco/. Ex.:
     mkdir -p /tmp/site && cp -r legacy-total-match/. /tmp/site/ && ln -sfn "$PWD/golaco" /tmp/site/golaco
     (cd /tmp/site && python3 -m http.server 8207)
     node legacy-total-match/ferramentas/testar-3d.mjs [http://localhost:8207] [pasta-dos-prints] [--publica]
   Passa por: Ultimate (Rivais) com a escolha Jogar em 3D / Simular, carreira de técnico (escalação, escudo e estádio
   do clube, resultado registrado) e Rumo ao Estrelato ("só o meu jogador": controle travado, nota/gols do 3D). Em cada
   um abre a pausa do 3D (cara do TM: Simular o resto, sem Reiniciar nem Modo de jogo), usa "Simular o resto" e
   "Voltar ao Total Match", e confere que o placar do 3D é o que o TM registrou. Reprova com erro de página (no TM ou
   dentro do 3D) ou regra quebrada. --publica roda na edição pública (escudos gerados) em vez da pro.
   O Chromium headless não passa pelo proxy: o three.js (jsdelivr) vem do cache de golaco/tools/lib/navegador.mjs. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const { abrir } = await import(path.join(AQUI, "../../golaco/tools/lib/navegador.mjs"));
const args = process.argv.slice(2);
const PUBLICA = args.includes("--publica");
const pos = args.filter(a => !a.startsWith("--"));
const BASE = pos[0] || "http://localhost:8207";
const PASTA = pos[1] || "/tmp/testar-3d";
fs.mkdirSync(PASTA, { recursive: true });

const { navegador: b, contexto: cx, pagina: p } = await abrir({ largura: 960, altura: 540 });
const erros = [];
p.on("pageerror", e => erros.push(String(e).slice(0, 300)));
// erros dentro do quadro do 3D (o pageerror do Playwright é só da página de cima)
await cx.addInitScript(() => {
  window.__errosPagina = [];
  addEventListener("error", e => window.__errosPagina.push(String(e.message || e).slice(0, 300)));
  addEventListener("unhandledrejection", e => window.__errosPagina.push("promessa: " + String(e.reason).slice(0, 300)));
});
await p.addInitScript((pub) => {
  if (pub) localStorage.removeItem("totalmatch:__edition");
  else { localStorage.setItem("totalmatch:__edition", "pro"); localStorage.setItem("totalmatch:su_unlocked", "1"); }
  // 3D leve para o teste: qualidade baixa e sem replays automáticos
  localStorage.setItem("golaco.prefs.v1", JSON.stringify({ qualidade: "baixa", replay: false }));
}, PUBLICA);
await p.goto(BASE + "/index.html", { waitUntil: "networkidle" });
await p.waitForFunction(() => window.TM && TM.tm3d && TM.ut && TM.rae && TM.comp, { timeout: 60000 });
await p.evaluate(() => TM.storage.saveSettings(Object.assign(TM.storage.settings(), { partidas3d: "perguntar", matchSpeed: "instantaneo" })));

const falhas = [], ok = [];
function confere(nome, cond, info) { (cond ? ok : falhas).push(nome + (info != null ? " — " + JSON.stringify(info) : "")); }
async function print(nome) { await p.screenshot({ path: path.join(PASTA, nome + ".png") }); }
async function abre3d() {
  await p.evaluate(() => document.querySelector(".tm3d-op.tres").click());
  for (let i = 0; i < 240; i++) {
    await p.waitForTimeout(500);
    const fr = p.frames().find(f => /golaco\/index\.html\?tm=/.test(f.url()));
    if (fr && await fr.evaluate(() => !!(window.__golaco && window.__golaco.pronto && window.__golaco.tm)).catch(() => false)) {
      await p.waitForTimeout(1500);
      return fr;
    }
  }
  return null;
}
// espera a condição; com o 3D já fechado, avança a tela de jogo do TM ("Ver resultado"/"Pular"...)
async function ate(fn, clica, n = 400) {
  for (let i = 0; i < n; i++) {
    await p.waitForTimeout(500);
    if (await p.evaluate(fn)) return true;
    if (clica) await p.evaluate((rx) => { if (document.querySelector(".tm3d-tela")) return; const b = [...document.querySelectorAll("button")].find(x => new RegExp(rx).test(x.textContent.trim())); b && b.click(); }, clica);
  }
  return false;
}
// o que o 3D montou: times, goleiros, uniformes e o escudo do placar (o <symbol> com a imagem do TM)
const timesDo3d = (fr) => fr.evaluate(() => {
  const g = window.__golaco, m = g.mundo, I = g.identidade;
  return [0, 1].map(t => {
    const use = document.getElementById("escudo-" + t), ref = use && use.getAttribute("href");
    const sim = ref && document.querySelector(ref), img = sim && sim.querySelector("image");
    return { nome: I && I.times[t].nome, n: m.jogadores.filter(j => j.time === t).length,
      gols: m.jogadores.filter(j => j.time === t && j.posicao === "GOL").length,
      camisa: I && I.kits["linha" + t].camisa, escudo: ref || null, escudoImg: !!(img && img.getAttribute("href")),
      tipo: I && I.times[t].escudo.tipo };
  });
});
// a pausa do 3D: os botões que aparecem
const pausaDo3d = (fr) => fr.evaluate(() => {
  window.__golaco.abrirMenu();
  const v = [...document.querySelectorAll("#menu-acoes button")].filter(x => !x.hidden && x.offsetParent !== null).map(x => x.textContent.trim().replace(/\s+/g, " "));
  const c = document.querySelector('#menu [data-cmd="continuar"]'); if (c) c.click();
  return v;
});
// "Simular o resto" e "Voltar ao Total Match": devolve o resultado que o 3D mandou e o placar do mundo
async function simulaEVolta(fr) {
  const r = await fr.evaluate(async () => {
    const res = await window.__golaco.tm.simularResto();
    const pl = window.__golaco.mundo.placar;
    const faixa = document.getElementById("faixa-botao");
    return { res, placar: [pl[0], pl[1]], botao: faixa && !faixa.hidden ? faixa.textContent.trim() : null, erros: window.__errosPagina.slice() };
  });
  erros.push(...r.erros.map(e => "3D: " + e));
  await print("_fim-3d-" + Date.now());
  await fr.evaluate(() => document.getElementById("faixa-botao").click());
  return r;
}

// 1) Ultimate · Rivais: escolha aparece, 3D abre com os dois times e o escudo desenhado, "Simular o resto" e o placar volta
await p.evaluate(() => { const s = TM.ut._new("Teste 3D"); TM.ut.openPack(s, { n: 26, lo: 70, hi: 84, rare: .4 }); TM.ut.autoFill(s); TM.ut.save(); TM.ui.go("ut-rivals"); });
await p.waitForTimeout(800);
await p.evaluate(() => [...document.querySelectorAll("button")].find(x => /^Jogar partida$/.test(x.textContent)).click());
await p.waitForTimeout(600);
const op = await p.evaluate(() => [...document.querySelectorAll(".tm3d-op b")].map(x => x.textContent));
confere("Ultimate: escolha Jogar em 3D / Simular", op.join("|") === "Jogar em 3D|Simular", op);
await print("01-escolha");
let fr = await abre3d();
confere("Ultimate: o GOLAÇO novo abre no quadro e avisa o TM (pronto)", !!fr && await p.evaluate(() => { const a = document.querySelector(".tm3d-aviso"); return !!a && getComputedStyle(a).display === "none"; }));
if (fr) {
  const ts = await timesDo3d(fr);
  confere("Ultimate: 11 por time e 1 goleiro em cada", ts.every(t => t.n === 11 && t.gols === 1), ts);
  confere("Ultimate: uniformes diferentes", ts[0].camisa !== ts[1].camisa, ts.map(t => t.camisa));
  confere("Ultimate: escudo desenhado do Ultimate no placar (imagem)", ts.every(t => t.escudoImg) && ts.some(t => t.tipo === "ultimate"), ts.map(t => [t.escudo, t.tipo]));
  const ped = await fr.evaluate(() => ({ v: window.__golaco.tm.pedido.v, neutro: window.__golaco.tm.pedido.partida && window.__golaco.tm.pedido.partida.neutro, empCont: (window.__golaco.tm.pedido.partida || {}).empateContinua }));
  confere("Ultimate: pedido v2 com jogo neutro", ped.v === 2 && ped.neutro === true, ped);
  // (Rivais não é mata-mata: o empate é o resultado — a cena do pós-jogo inteira no 3D)
  confere("Ultimate: o pedido diz que o empate não continua (partida.empateContinua false)", ped.empCont === false, ped);
  await print("02-ultimate-3d");
  const pausa = await pausaDo3d(fr);
  confere("Ultimate: pausa com Simular o resto (sem Reiniciar nem Modo de jogo)", pausa.some(x => /^Simular o resto/.test(x)) && !pausa.some(x => /Reiniciar|Modo de jogo/.test(x)), pausa);
  const r = await simulaEVolta(fr);
  confere("Ultimate: resultado do 3D = placar do jogo e botão Voltar ao Total Match", r.res && r.res.homeGoals === r.placar[0] && r.res.awayGoals === r.placar[1] && r.botao === "Voltar ao Total Match", { res: r.res && [r.res.homeGoals, r.res.awayGoals], placar: r.placar, botao: r.botao });
  confere("Ultimate: o resultado aparece no TM", await ate(() => !!document.querySelector(".utm-res") && !document.querySelector(".tm3d-tela"), "^(Ver resultado|Pular)"));
  await print("03-ultimate-resultado");
}

// 2) Carreira de técnico: o clube com o escudo e o estádio do TM, adversário escalado direito e resultado registrado
await p.evaluate(() => {
  const w = TM.data.world(), clubId = w.leagues[0].clubIds[0];
  const c = TM.comp.newClubCareer(clubId, { clubId, currency: "eur", injection: 0, coachName: "Teste", coachMode: "create", board: "intermediaria", role: "treinador", allowRestart: false, noSack: false, sackMode: "propostas" });
  TM.storage.saveCoachCareer(c); TM.ui.go("coach-play");
});
await p.waitForTimeout(900);
fr = await abre3d();
confere("Carreira: o 3D abre", !!fr);
if (fr) {
  const ts = await timesDo3d(fr);
  confere("Carreira: 11 por time e 1 goleiro em cada", ts.every(t => t.n === 11 && t.gols === 1), ts.map(t => t.nome + " " + t.n + "/" + t.gols));
  confere("Carreira: escudos do TM no placar (" + (PUBLICA ? "gerados" : "reais") + ")", ts.every(t => t.escudoImg && t.tipo === (PUBLICA ? "gerado" : "real")), ts.map(t => [t.nome, t.tipo]));
  const est = await fr.evaluate(() => ({ nome: window.__golaco.identidade.estadio.nome, tm: (window.__golaco.tm.pedido.home.identidade.estadio || {}).nome, humano: window.__golaco.tm.humano, lado: window.__golaco.tm.pedido.userSide }));
  // (na edição pública o 3D usa o Estádio Total Match de propósito — o estádio real do mandante só na pro: golaco/CONTRATOS.md
  // "Estádio de cada clube no pré-jogo"; antes este teste esperava o nome do TM também na pública e reprovava desde então)
  confere("Carreira: estádio do mandante (" + (PUBLICA ? "o Estádio Total Match na pública" : "o do TM") + ") e o meu time no lado certo", !!est.nome && (PUBLICA ? est.nome === "Estádio Total Match" : (!est.tm || est.nome === est.tm)) && est.humano === (est.lado === "away" ? 1 : 0), est);
  // (o 1º jogo da carreira é de liga: o empate não vai a pênaltis — a cena do pós-jogo inteira)
  const ecC = await fr.evaluate(() => (window.__golaco.tm.pedido.partida || {}).empateContinua);
  confere("Carreira: jogo de liga = o empate não continua (partida.empateContinua false)", ecC === false, ecC);
  await print("04-carreira-3d");
  const r = await simulaEVolta(fr);
  const fim = await ate(() => TM.ui.current() === "coach-match", "^(Ver resultado|Pular|Avançar)");
  const reg = await p.evaluate(() => { const c = TM.storage.coachCareer() || {}; return { jogos: c.matchNo }; });
  confere("Carreira: partida registrada (tela de resultado e rodada nova)", fim && reg.jogos === 1, { fim, reg, placar3d: r.placar });
  await print("05-carreira-resultado");
}

// 3) Rumo ao Estrelato: só o meu jogador
await p.evaluate(() => {
  const w = TM.data.world();
  TM.rae.cria({ nome: "Caio Teste", pos: "FW", idade: 18, clubId: w.leagues[0].clubIds[2] });
  const c = TM.rae.carreira(); c.status = "intocavel"; c.semana.plano = new Array(c.semana.dias).fill("descanso"); TM.rae.salva(c);
  TM.ui.go("rae-jogo");
});
await p.waitForTimeout(900);
await p.evaluate(() => [...document.querySelectorAll("button")].find(x => /Jogar a partida/.test(x.textContent)).click());
await p.waitForTimeout(600);
const txt = await p.evaluate(() => (document.querySelector(".tm3d-op.tres") || {}).textContent || "");
confere("Estrelato: escolha fala em controlar só o seu jogador", /só o seu jogador/.test(txt), txt);
fr = await abre3d();
confere("Estrelato: o 3D abre", !!fr);
if (fr) {
  const tr = await fr.evaluate(() => {
    const T = window.__golaco.tm, id = T.trava;
    return { trava: id, controlado: T.controlado, tmId: id != null && T.mapa[id] ? T.mapa[id].tmId : null, humano: T.humano };
  });
  confere("Estrelato: controle travado no meu jogador", tr.trava != null && tr.controlado === tr.trava && tr.tmId === "rae-me", tr);
  const ecR = await fr.evaluate(() => (window.__golaco.tm.pedido.partida || {}).empateContinua);
  confere("Estrelato: jogo da liga = o empate não continua (partida.empateContinua false)", ecR === false, ecR);
  const pausa = await pausaDo3d(fr);
  confere("Estrelato: pausa sem Editar time", pausa.some(x => /^Simular o resto/.test(x)) && !pausa.some(x => /Editar time/.test(x)), pausa);
  // o jogo anda (passos de verdade) e o controle não sai do meu jogador
  const anda = await fr.evaluate(() => { window.__golaco.rodarPassos(600, "demo"); const T = window.__golaco.tm; return { tick: window.__golaco.mundo.tick, controlado: T.controlado, trava: T.trava }; });
  confere("Estrelato: 10 s de jogo e o controle continua no meu jogador", anda.tick >= 600 && anda.controlado === anda.trava, anda);
  await print("06-estrelato-3d");
  const r = await simulaEVolta(fr);
  confere("Estrelato: o resultado leva a nota do meu jogador", !!(r.res && r.res.jogador && r.res.jogador.tmId === "rae-me" && r.res.jogador.nota >= 4.5), r.res && r.res.jogador);
  await ate(() => !!document.querySelector(".rae-res"));
  const res = await p.evaluate(() => ({ sub: [...document.querySelectorAll(".rae-res-s")].map(x => x.textContent), nota: (document.querySelector(".rae-minha .tile-val") || {}).textContent }));
  confere("Estrelato: súmula diz 'Partida jogada em 3D' e traz a nota", res.sub.includes("Partida jogada em 3D") && +res.nota >= 3, res);
  await print("07-estrelato-resultado");
}

// 4) o empate que continua (golaco/PLANO-CENAS.md §5.2): a conta do pedido e o mata-mata da carreira (a mesma função do
// coach-play — TM.comp.userPenContext — com a partida pendente de mata-mata: o empate vai a pênaltis = a versão curta)
{
  const ec = await p.evaluate(() => {
    const f = TM.tm3d.empateContinuaDe;
    const conta = { t: f(true), f: f(false), u: f(undefined), fnT: f(() => true), fnF: f(() => false), fnV: f(h => h === 1), err: f(() => { throw new Error("x"); }) };
    const w = TM.data.world(), ids = w.leagues[0].clubIds, c = TM.storage.coachCareer();
    const pend = c.pending;
    const pedido = mata => {
      c.pending = mata ? { key: "inter", homeId: ids[0], awayId: ids[1], ko: true, name: "Teste" } : { key: "league", homeId: ids[0], awayId: ids[1], name: "Teste" };
      const fn = (hs, as) => !!TM.comp.userPenContext(c, hs, as);
      const ped = TM.tm3d.novoPedido({ teamA: TM.engine.teamFromClub(ids[0]), teamB: TM.engine.teamFromClub(ids[1]), userSide: 0, title: "Teste", simOpts: {}, empateContinua: fn });
      return JSON.parse(JSON.stringify(ped)).partida.empateContinua;
    };
    const r = { conta, mata: pedido(true), liga: pedido(false) };
    c.pending = pend;
    return r;
  });
  const k = ec.conta;
  confere("empateContinua: true/false, a função constante e a que depende do placar (sem o campo)", k.t === true && k.f === false && k.u === undefined && k.fnT === true && k.fnF === false && k.fnV === undefined && k.err === undefined, k);
  confere("empateContinua: o mata-mata da carreira = true, a liga = false (no pedido gravado)", ec.mata === true && ec.liga === false, { mata: ec.mata, liga: ec.liga });
}

confere("nenhum erro de página (TM e 3D)", erros.length === 0, erros);
console.log("OK:\n  " + ok.join("\n  "));
if (falhas.length) console.log("FALHOU:\n  " + falhas.join("\n  "));
console.log("prints em " + PASTA);
await b.close();
process.exit(falhas.length ? 1 : 0);
