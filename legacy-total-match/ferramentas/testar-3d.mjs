/* Teste de ponta a ponta das partidas em 3D (Total Match → GOLAÇO novo → Total Match).
   O site precisa estar montado como no GitHub Pages: o TM na raiz e o 3D em /golaco/. Ex.:
     mkdir -p /tmp/site && cp -r legacy-total-match/. /tmp/site/ && ln -sfn "$PWD/golaco" /tmp/site/golaco
     (cd /tmp/site && python3 -m http.server 8207)
     node legacy-total-match/ferramentas/testar-3d.mjs [http://localhost:8207] [pasta-dos-prints] [--publica]
   Passa por: Ultimate (Rivais), carreira de técnico (escalação, escudo e estádio do clube, resultado registrado) e Rumo ao
   Estrelato ("só o meu jogador": controle travado, nota/gols do 3D). A carreira e o Rumo ao Estrelato entram pelo "Jogar
   partida" da tela antes do jogo, abrem a pausa do 3D (cara do TM: Simular o resto, sem Reiniciar nem Modo de jogo), usam
   "Simular o resto" e "Voltar ao Total Match", e conferem que o placar do 3D é o que o TM registrou. Reprova com erro de
   página (no TM ou dentro do 3D) ou regra quebrada. --publica roda na edição pública (escudos gerados) em vez da pro.
   Item 124 (dono, 05/11: "essa tela pré jogo é no lugar daqueles dois botões de jogar 3d ou simular; quando clica em jogar,
   já entra essa tela, e é em todos os modos"): o "Jogar" do TM abre o quadro do 3D SEM a janela .tm3d-escolha e o 3D abre na
   tela antes do jogo (TM.tm3d.PARAMS = "&prepartida=1": com o webdriver a tela fica desligada sem o parâmetro); o "Simular
   partida" dela (2 toques) fecha o 3D com 'tm3d:sair' {motivo: 'simular'} e nenhum 'tm3d:fim', e o TM simula lance a lance o
   result de sempre (o placar de antes, sem em3d, sem o aviso "Partida simulada."); a migração única (o partidas3d antigo —
   perguntar, 3d, simular — vira a tela; a Config nova "Tela antes do jogo | Sempre simular" em partidasTela); "Sempre simular"
   pula o 3D; sem WebGL 2 simula com um aviso só; e, com uma página de ensaio no lugar do 3D (TM.tm3d.PASTA), um caso por modo
   (Partida rápida, Arena · Chefão, Batalha do Ultimate, Partida de Base com ≥ 11 — e < 11 no 2D —, Rumo ao Estrelato), o
   'tm3d:sair' {motivo: 'erro'} com o aviso de falha e o X "Voltar e simular" com a confirmação POR CIMA do quadro.
   Item 31 (a foto do autor na comemoração): na pro o pedido leva `foto` (as fotos reais do TM em endereço absoluto ou a importada
   em data:image) — a carreira com ≥ 9/11 titulares do meu clube com foto (o adversário depende do calendário: no Brasileirão,
   6–11), todas carregadas pelo 3D em ≤ 10 s (prontas = pedidas ≥ 12, 0 erros), o Ultimate com fotos, o "rae-me" sem foto e os
   outros com; na pública nenhum campo `foto` em pedido nenhum.
   Item 33 (o tempo de jogo e a dificuldade): o pedido leva partida.minutosPorTempo (a Config "Duração em 3D") e partida.dificuldade
   (a Config "Dificuldade"; nas Batalhas, a delas com ajustesFixos) e o 3D joga com eles (ticksPorTempo, mundo.dificuldade); o
   resultado volta com os dois; a pausa do 3D diz "Partida e cenas". O Ultimate com o padrão (4 min, Normal) e a carreira e o
   Rumo ao Estrelato com 6 min e Difícil.
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
// item 124: as mensagens do quadro do 3D (tm3d:*) que a página do TM recebe
await p.addInitScript(() => {
  if (window !== window.top) return;
  window.__msgs3d = [];
  addEventListener("message", e => { const d = e.data; if (d && typeof d.tipo === "string" && d.tipo.indexOf("tm3d:") === 0) window.__msgs3d.push({ tipo: d.tipo, motivo: d.motivo || null, t: Date.now() }); });
});
await p.goto(BASE + "/index.html", { waitUntil: "networkidle" });
await p.waitForFunction(() => window.TM && TM.tm3d && TM.ut && TM.rae && TM.comp, { timeout: 60000 });
// (item 124) os avisos (TM.ui.toast) e o cfg de cada partida da tela de jogo do TM (com o placar de antes do 3D); a tela antes do
// jogo ligada no 3D aberto pelo TM (com o webdriver ela fica desligada sem o parâmetro); a Config ANTIGA com "Sempre simular"
// (partidas3d: "simular", sem a chave nova): a migração única leva à tela
await p.evaluate(() => {
  window.__toasts = [];
  const t = TM.ui.toast; TM.ui.toast = function (m) { window.__toasts.push(String(m)); return t.apply(this, arguments); };
  window.__cfgs = [];
  const o = TM.matchview.play;
  TM.matchview.play = function (screen, cfg) { window.__cfgs.push({ cfg, placar: cfg && cfg.result && cfg.result.score ? cfg.result.score.slice() : null }); return o.apply(this, arguments); };
  TM.tm3d.PARAMS = "&prepartida=1";
  const s = TM.storage.settings(); delete s.partidasTela; s.partidas3d = "simular"; s.matchSpeed = "instantaneo"; TM.storage.saveSettings(s);
});

const falhas = [], ok = [];
function confere(nome, cond, info) { (cond ? ok : falhas).push(nome + (info != null ? " — " + JSON.stringify(info) : "")); }
async function print(nome) { await p.screenshot({ path: path.join(PASTA, nome + ".png") }); }
// o 3D que o "Jogar" do TM abriu (item 124: direto, sem a janela): null se nenhum quadro aparece em ~3 s
async function espera3d() {
  for (let i = 0; i < 6 && !(await p.evaluate(() => !!document.querySelector(".tm3d-tela iframe"))); i++) await p.waitForTimeout(500);
  if (!(await p.evaluate(() => !!document.querySelector(".tm3d-tela iframe")))) return null;
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
// as fotos do pedido (item 31): por lado, quantos titulares e quantos no total têm `foto`, as inválidas (nem absoluta da origem em
// /assets/jogadores/ nem data:image/), a edição, e o estado das fotos no 3D (golaco: __golaco.tm.fotos)
const fotosDoPedido = (fr) => fr.evaluate(() => {
  const T = window.__golaco.tm, P = T.pedido, o = location.origin;
  const ok = u => typeof u === "string" && (u.startsWith(o + "/assets/jogadores/") || /^data:image\/(jpeg|png|webp);base64,/.test(u));
  const lados = [P.home, P.away].map(t => ({ tit: t.players.slice(0, 11).filter(p => p.foto).length, total: t.players.filter(p => p.foto).length, ruins: t.players.filter(p => p.foto && !ok(p.foto)).map(p => String(p.foto).slice(0, 60)) }));
  const rae = [P.home, P.away].flatMap(t => t.players).find(p => p.tmId === "rae-me");
  const f = T.fotos;
  return { edicao: P.edicao, lados, raeFoto: rae ? !!rae.foto : null, fotos: f ? { n: f.n, pedidas: f.pedidas, prontas: f.prontas, erros: f.erros } : null };
});
const esperaFotos = (fr) => fr.waitForFunction(() => { const f = window.__golaco.tm.fotos; return !!f && f.pedidas > 0 && f.prontas + f.erros >= f.pedidas; }, null, { timeout: 10000 }).then(() => true).catch(() => false);
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
// (item 124) a tela antes do jogo no 3D: aberta, as abas, as fichas "VOCÊ" e o tick do mundo
const telaDo3d = (fr) => fr.evaluate(() => {
  const g = window.__golaco, pp = g.prepartida;
  return { aberta: !!(pp && pp.aberta), abas: pp && pp.estado ? pp.estado.abas : null, voce: document.querySelectorAll("#prepartida .pp-ficha.voce").length, tick: g.mundo.tick };
}).catch(e => ({ aberta: false, abas: null, erro: String(e).slice(0, 120) }));
// o "Jogar" do TM: a janela antiga (.tm3d-escolha) e o quadro do 3D
const janelaOuQuadro = () => p.evaluate(() => ({ janela: !!document.querySelector(".tm3d-escolha, .tm3d-op"), quadro: !!document.querySelector(".tm3d-tela iframe") }));
// a aba da tela (o toque do dedo: click no botão)
const abaDaTela = (fr, id) => fr.evaluate((id) => { const b = document.querySelector('#prepartida [data-aba="' + id + '"]'); if (b) b.click(); return !!b; }, id).catch(() => false);
// "Simular partida" (2 toques): o armado no 1º (a tela e o quadro ficam), no 2º o quadro fecha. msg / s = do toque (o relógio do
// quadro, no clique) até o 'tm3d:sair' chegar à página do TM / o quadro sair dela (um MutationObserver, depois da tarefa que tira o
// quadro e monta a tela de jogo do TM); remocao = só o remove() do quadro (desmontar a página do 3D). A meta é a da mensagem (≤ 2 s;
// medido 0,001 s): o resto é o Chromium sem GPU desmontando o WebGL — o quadro fechado de 1,1 s a 9 s depois do toque (o remove()
// sozinho até 6,5 s) conforme a carga da máquina (até 17) —, informativo. O que separa do caminho antigo (o motor 3D simulando ~11 s e mandando tm3d:fim) são as mensagens e o tick 0
async function simularNaTela(fr) {
  await p.evaluate(() => {
    window.__msgs3d.length = 0; window.__toasts.length = 0; window.__fechouEm = null;
    const ob = new MutationObserver(() => { if (!document.querySelector(".tm3d-tela")) { window.__fechouEm = Date.now(); ob.disconnect(); } });
    ob.observe(document.body, { childList: true });
  });
  const t1 = await abaDaTela(fr, "simular");
  await p.waitForTimeout(300);
  const arm = await fr.evaluate(() => ({ armado: window.__golaco.prepartida.estado.armado, aberta: !!window.__golaco.prepartida.aberta, tick: window.__golaco.mundo.tick })).catch(() => null);
  const quadro1 = await p.evaluate(() => !!document.querySelector(".tm3d-tela"));
  await p.evaluate(() => {
    window.__rem = null;
    const t = document.querySelector(".tm3d-tela"); if (!t) return;
    const orig = t.remove.bind(t);
    t.remove = () => { const a = Date.now(); orig(); window.__rem = (Date.now() - a) / 1000; };
  });
  const tToque = await fr.evaluate(() => { const b = document.querySelector('#prepartida [data-aba="simular"]'); const t = Date.now(); if (b) b.click(); return t; }).catch(() => null);
  let fechou = false;
  for (let i = 0; i < 100 && !fechou; i++) { await p.waitForTimeout(100); fechou = await p.evaluate(() => !document.querySelector(".tm3d-tela")); }
  const tFim = await p.evaluate(() => window.__fechouEm);
  const tMsg = await p.evaluate(() => { const m = window.__msgs3d.find(x => x.tipo === "tm3d:sair"); return m ? m.t : null; });
  const dt = t => tToque && t ? +((t - tToque) / 1000).toFixed(3) : null;
  const remocao = await p.evaluate(() => window.__rem);
  return { t1, arm, quadro1, fechou, msg: dt(tMsg), s: dt(tFim), remocao };
}
// a última partida da tela de jogo do TM: o result (o mesmo objeto), o placar de antes, as mensagens do quadro e os avisos
const ultimaPartida = () => p.evaluate(() => {
  const c = window.__cfgs[window.__cfgs.length - 1] || null;
  return { msgs: window.__msgs3d.map(m => m.tipo + (m.motivo ? "/" + m.motivo : "")), toasts: window.__toasts.slice(),
    em3d: !!(c && c.cfg.result && c.cfg.result.em3d), placar: c && c.cfg.result ? c.cfg.result.score.slice() : null, antes: c ? c.placar : null, titulo: c ? c.cfg.title || null : null };
});
const simulouNoTM = (u) => !!u && u.msgs.includes("tm3d:sair/simular") && !u.msgs.some(m => m.indexOf("tm3d:fim") === 0) && !u.em3d && !!u.placar && !!u.antes && u.placar.join() === u.antes.join()
  && !u.toasts.some(t => /Partida simulada/.test(t));

// 0) item 124: a migração única e a Config nova (antes de abrir o 3D). O partidas3d antigo (perguntar, 3d, simular — a janela e o
// "Lembrar minha escolha" que gravava "simular"), sem a chave nova, vira a tela; a Config mostra "Tela antes do jogo | Sempre
// simular" com a tela marcada
{
  const mig = await p.evaluate(() => ["perguntar", "3d", "simular", null].map(v => {
    const s = TM.storage.settings(); delete s.partidasTela; if (v == null) delete s.partidas3d; else s.partidas3d = v;
    TM.storage.saveSettings(s);
    return (v || "nada") + "→" + (TM.tm3d.preferencia ? TM.tm3d.preferencia() : "?");
  }));
  confere("item 124: a migração — o partidas3d antigo (perguntar, 3d, simular; e nada salvo) vira a tela", mig.every(x => /→tela$/.test(x)), mig);
  await p.evaluate(() => { const s = TM.storage.settings(); delete s.partidasTela; s.partidas3d = "simular"; TM.storage.saveSettings(s); TM.ui.go("settings"); });
  await p.waitForTimeout(500);
  const cf = await p.evaluate(() => {
    const st = [...document.querySelectorAll(".setting")].find(x => /Partidas do seu time/.test(x.textContent));
    return st ? { ops: [...st.querySelectorAll(".seg-btn")].map(b => b.textContent.trim()), ativo: (st.querySelector(".seg-btn.active") || {}).textContent || null } : null;
  });
  confere("item 124: Config \"Partidas do seu time\" = Tela antes do jogo | Sempre simular, a tela marcada (o \"simular\" antigo migrado)", !!cf && cf.ops.join("|") === "Tela antes do jogo|Sempre simular" && cf.ativo === "Tela antes do jogo", cf);
  await print("00-config");
}

// 1) Ultimate · Rivais (com o "simular" ANTIGO salvo: item 124): o Jogar abre o 3D direto, na tela antes do jogo, com os dois times e o
// escudo desenhado; o "Simular partida" da tela (2 toques) volta ao TM sem resultado 3D e o TM simula o result de sempre
await p.evaluate(() => { const s = TM.ut._new("Teste 3D"); TM.ut.openPack(s, { n: 26, lo: 70, hi: 84, rare: .4 }); TM.ut.autoFill(s); TM.ut.save(); TM.ui.go("ut-rivals"); });
await p.waitForTimeout(800);
await p.evaluate(() => [...document.querySelectorAll("button")].find(x => /^Jogar partida$/.test(x.textContent)).click());
await p.waitForTimeout(600);
const jq = await janelaOuQuadro();
confere("Ultimate: o Jogar abre o quadro do 3D direto, sem a janela Jogar em 3D / Simular (com o \"simular\" antigo salvo; item 124)", !jq.janela && jq.quadro, jq);
await print("01-jogar");
let fr = await espera3d();
confere("Ultimate: o GOLAÇO novo abre no quadro e avisa o TM (pronto)", !!fr && await p.evaluate(() => { const a = document.querySelector(".tm3d-aviso"); return !!a && getComputedStyle(a).display === "none"; }));
if (fr) {
  const tu = await telaDo3d(fr);
  confere("Ultimate: o 3D abre na tela antes do jogo (Jogar partida · Visão tática · Personalizar · Simular partida), parado no tick 0 (item 124)", tu.aberta && (tu.abas || []).join() === "jogar,visao,personalizar,simular" && tu.tick === 0, tu);
  const ts = await timesDo3d(fr);
  confere("Ultimate: 11 por time e 1 goleiro em cada", ts.every(t => t.n === 11 && t.gols === 1), ts);
  confere("Ultimate: uniformes diferentes", ts[0].camisa !== ts[1].camisa, ts.map(t => t.camisa));
  confere("Ultimate: escudo desenhado do Ultimate no placar (imagem)", ts.every(t => t.escudoImg) && ts.some(t => t.tipo === "ultimate"), ts.map(t => [t.escudo, t.tipo]));
  const ped = await fr.evaluate(() => ({ v: window.__golaco.tm.pedido.v, neutro: window.__golaco.tm.pedido.partida && window.__golaco.tm.pedido.partida.neutro, empCont: (window.__golaco.tm.pedido.partida || {}).empateContinua }));
  confere("Ultimate: pedido v2 com jogo neutro", ped.v === 2 && ped.neutro === true, ped);
  // (Rivais não é mata-mata: o empate é o resultado — a cena do pós-jogo inteira no 3D)
  confere("Ultimate: o pedido diz que o empate não continua (partida.empateContinua false)", ped.empCont === false, ped);
  // (na pro, espera o 3D carregar as fotos de quem está em campo antes de ler: a pré-carga sai com o navegador ocioso, até 1,5 s
  // depois do pronto — lido antes, o estado das fotos dependia do momento; revisão O1)
  if (!PUBLICA) await esperaFotos(fr);
  const fu = await fotosDoPedido(fr);
  confere("Ultimate: as fotos no pedido (item 31) — " + (PUBLICA ? "nenhuma na pública" : "as cartas com foto real na pro, todas válidas e as de quem está em campo carregadas pelo 3D"),
    PUBLICA ? fu.lados.every(l => l.total === 0) : fu.lados[0].total + fu.lados[1].total >= 1 && fu.lados.every(l => l.ruins.length === 0)
      && (fu.lados[0].tit + fu.lados[1].tit === 0 || (!!fu.fotos && fu.fotos.pedidas >= 1 && fu.fotos.prontas === fu.fotos.pedidas && fu.fotos.erros === 0)), fu);
  await print("02-ultimate-tela");
  // item 33: a duração e a dificuldade da Config (o padrão: 4 min, Normal) no pedido e no mundo
  const aj = await fr.evaluate(() => { const g = window.__golaco, pt = g.tm.pedido.partida || {}; return { min: pt.minutosPorTempo, dif: pt.dificuldade, fixos: !!pt.ajustesFixos, ticks: g.mundo.partida.ticksPorTempo, mundo: g.ajustes ? g.ajustes.estado.dificuldadeMundo : null }; });
  confere("Ultimate: o pedido com a Config (4 min, Normal) e o 3D com eles (item 33)", aj.min === 4 && aj.dif === "normal" && !aj.fixos && aj.ticks === 14400 && aj.mundo === "normal", aj);
  const jogos0 = await p.evaluate(() => TM.ut.state().stats.jogos || 0);
  const sm = await simularNaTela(fr);
  confere("Ultimate: \"Simular partida\" arma no 1º toque (a tela e o quadro ficam, tick 0) e no 2º o tm3d:sair chega ao TM em ≤ 2 s e o quadro fecha (item 124)", sm.t1 && !!sm.arm && sm.arm.armado === "simular" && sm.arm.aberta && sm.arm.tick === 0 && sm.quadro1 && sm.fechou && sm.msg != null && sm.msg <= 2, sm);
  const chegou = await ate(() => !!document.querySelector(".utm-res") && !document.querySelector(".tm3d-tela"), "^(Ver resultado|Pular)", 120);
  const u = await ultimaPartida();
  const jogos1 = await p.evaluate(() => TM.ut.state().stats.jogos || 0);
  confere("Ultimate: o Simular volta ao TM SEM resultado 3D (tm3d:sair \"simular\", nenhum tm3d:fim) e o TM simula o result de sempre (o placar de antes, sem em3d, sem \"Partida simulada.\"), registrado", chegou && simulouNoTM(u) && jogos1 === jogos0 + 1, { chegou, ...u, jogos0, jogos1 });
  await print("03-ultimate-resultado-simulado");
}

// 2) Carreira de técnico: o clube com o escudo e o estádio do TM, adversário escalado direito e resultado registrado
// (item 33: a Config com 6 min e Difícil daqui em diante)
await p.evaluate(() => TM.storage.saveSettings(Object.assign(TM.storage.settings(), { tempo3d: 6, difficulty: "dificil" })));
await p.evaluate(() => {
  const w = TM.data.world(), clubId = w.leagues[0].clubIds[0];
  const c = TM.comp.newClubCareer(clubId, { clubId, currency: "eur", injection: 0, coachName: "Teste", coachMode: "create", board: "intermediaria", role: "treinador", allowRestart: false, noSack: false, sackMode: "propostas" });
  TM.storage.saveCoachCareer(c); TM.ui.go("coach-play");
});
await p.waitForTimeout(900);
{ const j = await janelaOuQuadro(); confere("Carreira: o Jogar abre o quadro do 3D direto, sem a janela (item 124)", j.quadro && !j.janela, j); }
fr = await espera3d();
confere("Carreira: o 3D abre", !!fr);
if (fr) {
  const tc = await telaDo3d(fr);
  confere("Carreira: a tela antes do jogo com as 4 abas (item 124)", tc.aberta && (tc.abas || []).join() === "jogar,visao,personalizar,simular", tc);
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
  if (!PUBLICA) await esperaFotos(fr);
  const fc = await fotosDoPedido(fr);
  if (PUBLICA) confere("Carreira: nenhuma foto no pedido da pública (item 31)", fc.edicao !== "pro" && fc.lados.every(l => l.total === 0) && (!fc.fotos || fc.fotos.pedidas === 0), fc);
  else {
    const meu = fc.lados[est.humano === 1 ? 1 : 0];
    confere("Carreira: ≥ 9/11 titulares do meu clube com foto no pedido; todas as fotos válidas (item 31)", fc.edicao === "pro" && meu.tit >= 9 && fc.lados.every(l => l.ruins.length === 0), fc);
    confere("Carreira: as fotos dos que estão em campo carregadas pelo 3D em ≤ 10 s (prontas = pedidas ≥ 12, 0 erros)", !!fc.fotos && fc.fotos.pedidas >= 12 && fc.fotos.prontas === fc.fotos.pedidas && fc.fotos.erros === 0, fc.fotos);
  }
  const ajC = await fr.evaluate(() => { const g = window.__golaco, pt = g.tm.pedido.partida || {}; return { min: pt.minutosPorTempo, dif: pt.dificuldade, ticks: g.mundo.partida.ticksPorTempo, mundo: g.mundo.dificuldade || "normal" }; });
  confere("Carreira: o pedido com a Config (6 min, Difícil) e o 3D com eles (item 33)", ajC.min === 6 && ajC.dif === "dificil" && ajC.ticks === 21600 && ajC.mundo === "dificil", ajC);
  await print("04-carreira-3d");
  // "Jogar partida" segue como antes: a tela fecha e o jogo anda (com o webdriver o pré-jogo fica desligado: o apito)
  await abaDaTela(fr, "jogar");
  await fr.waitForFunction(() => !window.__golaco.prepartida.aberta && window.__golaco.mundo.tick > 0, null, { timeout: 20000 }).catch(() => {});
  const jg = await fr.evaluate(() => ({ aberta: !!window.__golaco.prepartida.aberta, tick: window.__golaco.mundo.tick }));
  confere("Carreira: \"Jogar partida\" fecha a tela e o jogo anda (como antes)", !jg.aberta && jg.tick > 0, jg);
  const pausa = await pausaDo3d(fr);
  confere("Carreira: pausa com Simular o resto e \"Partida e cenas\" (sem Reiniciar nem Modo de jogo)", pausa.some(x => /^Simular o resto/.test(x)) && pausa.some(x => /^Partida e cenas/.test(x)) && !pausa.some(x => /Reiniciar|Modo de jogo/.test(x)), pausa);
  await p.evaluate(() => { window.__msgs3d.length = 0; });
  const r = await simulaEVolta(fr);
  confere("Carreira: resultado do 3D = placar do jogo e botão Voltar ao Total Match", r.res && r.res.homeGoals === r.placar[0] && r.res.awayGoals === r.placar[1] && r.botao === "Voltar ao Total Match", { res: r.res && [r.res.homeGoals, r.res.awayGoals], placar: r.placar, botao: r.botao });
  confere("Carreira: o resultado volta com a duração e a dificuldade (item 33)", !!r.res && r.res.minutosPorTempo === 6 && r.res.dificuldade === "dificil", r.res && { min: r.res.minutosPorTempo, dif: r.res.dificuldade });
  const fim = await ate(() => TM.ui.current() === "coach-match", "^(Ver resultado|Pular|Avançar)");
  const reg = await p.evaluate(() => { const c = TM.storage.coachCareer() || {}; return { jogos: c.matchNo }; });
  confere("Carreira: partida registrada (tela de resultado e rodada nova)", fim && reg.jogos === 1, { fim, reg, placar3d: r.placar });
  const uc = await ultimaPartida();
  confere("Carreira: o result do TM é o do 3D (tm3d:fim, em3d, o placar do jogo)", uc.msgs.includes("tm3d:fim") && uc.em3d && !!uc.placar && uc.placar.join() === r.placar.join(), uc);
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
{ const j = await janelaOuQuadro(); confere("Estrelato: o Jogar a partida abre o quadro do 3D direto, sem a janela (item 124)", j.quadro && !j.janela, j); }
fr = await espera3d();
confere("Estrelato: o 3D abre", !!fr);
if (fr) {
  const tr0 = await telaDo3d(fr);
  confere("Estrelato: a tela antes do jogo sem Personalizar (Jogar partida · Visão tática · Simular partida) e a ficha VOCÊ (item 124)", tr0.aberta && (tr0.abas || []).join() === "jogar,visao,simular" && tr0.voce === 1, tr0);
  await abaDaTela(fr, "jogar");
  await fr.waitForFunction(() => !window.__golaco.prepartida.aberta, null, { timeout: 20000 }).catch(() => {});
  const tr = await fr.evaluate(() => {
    const T = window.__golaco.tm, id = T.trava;
    return { trava: id, controlado: T.controlado, tmId: id != null && T.mapa[id] ? T.mapa[id].tmId : null, humano: T.humano };
  });
  confere("Estrelato: controle travado no meu jogador", tr.trava != null && tr.controlado === tr.trava && tr.tmId === "rae-me", tr);
  const ajR = await fr.evaluate(() => { const g = window.__golaco, pt = g.tm.pedido.partida || {}; return { min: pt.minutosPorTempo, dif: pt.dificuldade, ticks: g.mundo.partida.ticksPorTempo, mundo: g.mundo.dificuldade || "normal" }; });
  confere("Estrelato: a duração e a dificuldade da Config também (6 min, Difícil; item 33)", ajR.min === 6 && ajR.dif === "dificil" && ajR.ticks === 21600 && ajR.mundo === "dificil", ajR);
  if (!PUBLICA) await esperaFotos(fr);
  const fr2 = await fotosDoPedido(fr);
  const fotoTrava = !PUBLICA ? await fr.evaluate(() => { const T = window.__golaco.tm; return T.fotos ? T.fotos.de(T.trava) : null; }) : null;
  confere("Estrelato: o meu jogador (rae-me) sem foto; " + (PUBLICA ? "nenhuma foto na pública" : "os outros com foto na pro, carregadas pelo 3D") + " (item 31)",
    fr2.raeFoto === false && (PUBLICA ? fr2.lados.every(l => l.total === 0) : fr2.lados[0].total + fr2.lados[1].total >= 9 && fr2.lados.every(l => l.ruins.length === 0) && !!fr2.fotos && fr2.fotos.prontas >= 9 && fr2.fotos.erros === 0 && fotoTrava && fotoTrava.url === null), { ...fr2, fotoTrava });
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

// 5) item 33: a Batalha de Elenco manda a dificuldade DELA, travada (o "Craque Mundial" = Difícil), e a duração da Config — o
// pedido montado como o do 3D (TM.tm3d.novoPedido com o cfg que a tela de jogo do Ultimate passa), sem abrir o quadro
{
  await p.evaluate(() => {
    window.__pedBatalha = null;
    window.__playOrig = TM.matchview.play;
    TM.matchview.play = (screen, cfg) => {
      window.__pedBatalha = TM.tm3d.novoPedido({ teamA: cfg.teamA, teamB: cfg.teamB, formation: cfg.formation, formationB: cfg.formationB,
        userSide: cfg.pauseSide === 1 ? 1 : 0, controle: cfg.controle, title: cfg.title, simOpts: cfg.simOpts, empateContinua: cfg.empateContinua });
    };
    const adv = TM.utModos.elencoCPU(12345, 80, { reforco: 2 });
    TM.utModos.jogar({ modo: "batalha", titulo: "Batalhas · teste", adv, voltar: "ut-batalhas", dif: "mundial", onFim: () => ({}) });
  });
  await p.waitForFunction(() => !!window.__pedBatalha, null, { timeout: 15000 }).catch(() => {});
  const bt = await p.evaluate(() => { TM.matchview.play = window.__playOrig; const pd = window.__pedBatalha; return pd ? JSON.parse(JSON.stringify(pd.partida)) : null; });
  confere("Batalha (Craque Mundial): o pedido com a dificuldade dela (Difícil) travada e a duração da Config (item 33)", !!bt && bt.dificuldade === "dificil" && bt.ajustesFixos === true && bt.minutosPorTempo === 6, bt);
}

// 6) item 124 — um caso por modo com uma página de ENSAIO no lugar do 3D (TM.tm3d.PASTA; debaixo de golaco/, que o service worker do
// TM deixa ir pela rede — fora dela o sw.js buscava a página sem passar pela rota do Playwright): ela grava o que o pedido trouxe e responde
// como o golaco ('tm3d:pronto' e, 250 ms depois, 'tm3d:sair' {motivo: 'simular'} — o "Simular partida" da tela; 'erro' = a falha do
// 3D; 'parado' = não responde: o X do TM fica à vista). O golaco de verdade, com a tela, está nas seções 1–3 (e no
// golaco/tools/teste-prepartida-tela.mjs E14)
{
  const ENSAIO = `<!doctype html><meta charset="utf-8"><title>ensaio</title><script>
(function () {
  var id = new URLSearchParams(location.search).get("tm"), modo = localStorage.getItem("ensaio3d:modo") || "simular", ped = null;
  try { ped = JSON.parse(localStorage.getItem("tm3d:pedido:" + id)); } catch (e) {}
  localStorage.setItem("ensaio3d:ultimo", JSON.stringify({ id: id, url: location.search, titulo: ped && ped.titulo, casa: ped && ped.home && ped.home.name,
    fora: ped && ped.away && ped.away.name, nCasa: ped && ped.home ? ped.home.players.length : 0, nFora: ped && ped.away ? ped.away.players.length : 0,
    userSide: ped && ped.userSide, controle: ped && ped.controle }));
  if (modo === "parado") return;
  parent.postMessage({ tipo: "tm3d:pronto", id: id }, location.origin);
  setTimeout(function () { parent.postMessage({ tipo: "tm3d:sair", id: id, motivo: modo === "erro" ? "erro" : "simular" }, location.origin); }, 250);
})();
</script>`;
  const ROTA_ENSAIO = /\/golaco\/ensaio-3d\.html(\?|$)/;
  await cx.route(ROTA_ENSAIO, r => r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: ENSAIO }));
  const pastaReal = await p.evaluate(() => { const v = TM.tm3d.PASTA; TM.tm3d.PASTA = "golaco/ensaio-3d.html"; return v; });
  await p.evaluate(() => { const s = TM.storage.settings(); s.partidasTela = "tela"; TM.storage.saveSettings(s); });
  // (um quadro que sobrou de um caso que não voltou sai antes do próximo: senão o próximo caso o via como "o quadro abriu")
  const limpa = () => p.evaluate(() => { document.querySelectorAll(".sheet-overlay").forEach(x => x.remove()); if (TM.tm3d.fechar) TM.tm3d.fechar(); });
  // um modo: o início (no TM), o quadro (ou a falta dele), a volta e a tela final do modo
  async function modoEnsaio(nome, { inicia, final, modo = "simular", arg = null, clica = "^(Ver resultado|Pular|Avançar)" }) {
    await limpa();
    await p.evaluate((m) => { localStorage.setItem("ensaio3d:modo", m); localStorage.removeItem("ensaio3d:ultimo"); window.__msgs3d.length = 0; window.__toasts.length = 0; }, modo);
    const n0 = await p.evaluate(() => window.__cfgs.length);
    await p.evaluate(inicia, arg);
    let quadro = false, janela = false;
    for (let i = 0; i < 16 && !quadro; i++) { await p.waitForTimeout(150); const j = await janelaOuQuadro(); quadro = j.quadro; janela = janela || j.janela; }
    const chegou = await ate(final, clica, 80);
    const u = await ultimaPartida();
    const ped = await p.evaluate(() => JSON.parse(localStorage.getItem("ensaio3d:ultimo") || "null"));
    const n1 = await p.evaluate(() => window.__cfgs.length);
    return { nome, quadro, janela, chegou, ped, novaPartida: n1 > n0, ...u };
  }
  const rapida = (k) => { const ids = TM.data.world().leagues[0].clubIds; TM.ui.go("quick-match", { a: TM.engine.teamFromClub(ids[k % ids.length]), b: TM.engine.teamFromClub(ids[(k + 1) % ids.length]) }); };
  const naRapida = () => TM.ui.current() === "quick-result";
  const resumo = e => ({ quadro: e.quadro, janela: e.janela, chegou: e.chegou, msgs: e.msgs, toasts: e.toasts, em3d: e.em3d, placar: e.placar, antes: e.antes, ped: e.ped && { titulo: e.ped.titulo, casa: e.ped.casa, n: [e.ped.nCasa, e.ped.nFora], url: e.ped.url } });

  let e = await modoEnsaio("Partida rápida", { inicia: rapida, arg: 3, final: naRapida });
  confere("item 124 · Partida rápida: o Jogar abre o 3D (sem a janela) e o Simular volta ao lance a lance do TM com o result de sempre", e.quadro && !e.janela && e.chegou && e.novaPartida && simulouNoTM(e), resumo(e));
  confere("item 124: o quadro leva os parâmetros dos testes (TM.tm3d.PARAMS) depois do ?tm=", !!e.ped && /^\?tm=[^&]+&prepartida=1$/.test(e.ped.url || ""), e.ped && e.ped.url);

  e = await modoEnsaio("Arena · Chefão", { inicia: (id) => TM.ui.go("arena-boss", { clubId: id }), arg: await p.evaluate(() => TM.data.world().leagues[0].clubIds[5]),
    final: () => [...document.querySelectorAll(".sheet-title")].some(x => /LENDAS|empate|Lendas venceram/i.test(x.textContent)) });
  confere("item 124 · Arena (Chefão das Lendas): o Jogar abre o 3D e o Simular volta ao TM, que simula o result de sempre", e.quadro && !e.janela && e.chegou && simulouNoTM(e), resumo(e));

  e = await modoEnsaio("Ultimate · Batalha", {
    inicia: () => { const adv = TM.utModos.elencoCPU(777, 78, { reforco: 1 }); TM.utModos.jogar({ modo: "batalha", titulo: "Batalhas · ensaio", adv, voltar: "ut-batalhas", dif: "pro", onFim: () => ({}) }); },
    final: () => !!document.querySelector(".utm-res") });
  confere("item 124 · Ultimate (Batalha de Elenco): o Jogar abre o 3D e o Simular volta ao TM, que simula o result de sempre", e.quadro && !e.janela && e.chegou && simulouNoTM(e), resumo(e));

  e = await modoEnsaio("Partida de Base (14)", {
    inicia: () => { const c = TM.storage.coachCareer(); c.youth = TM.comp.generateYouth(c.teamId); TM.storage.saveCoachCareer(c); TM.ui.go("coach-youth-match"); },
    final: () => TM.ui.current() === "coach-match" });
  confere("item 124 · Partida de Base com ≥ 11 (FILA 39): agora abre o 3D (o time Sub-19 no pedido) e o Simular volta ao TM", e.quadro && !e.janela && e.chegou && simulouNoTM(e) && !!e.ped && /Sub-19/.test(e.ped.casa || "") && e.ped.nCasa >= 11, resumo(e));
  e = await modoEnsaio("Partida de Base (8)", {
    inicia: () => { const c = TM.storage.coachCareer(); c.youth = TM.comp.generateYouth(c.teamId).slice(0, 8); TM.storage.saveCoachCareer(c); TM.ui.go("coach-youth-match"); },
    final: () => TM.ui.current() === "coach-match" });
  confere("item 124 · Partida de Base com < 11 (a tela permite 7): sem 3D, o 2D de sempre", !e.quadro && !e.janela && e.chegou && !e.em3d, resumo(e));

  e = await modoEnsaio("Rumo ao Estrelato (Simular)", {
    inicia: () => {
      const c = TM.rae.carreira(); c.status = "intocavel";
      if (c.semana) c.semana.plano = new Array(c.semana.dias).fill("descanso");
      TM.rae.salva(c); TM.ui.go("rae-jogo");
      const b = [...document.querySelectorAll("button")].find(x => /Jogar a partida/.test(x.textContent)); if (b) b.click();
    },
    final: () => !!document.querySelector(".rae-res"), clica: "^(Ver resultado|Pular)" });
  const raeSub = await p.evaluate(() => [...document.querySelectorAll(".rae-res-s")].map(x => x.textContent));
  confere("item 124 · Rumo ao Estrelato titular: o Jogar a partida abre o 3D (o meu jogador no pedido) e o Simular volta à simulação do Estrelato (sem \"Partida jogada em 3D\")",
    e.quadro && !e.janela && e.chegou && e.msgs.includes("tm3d:sair/simular") && !e.msgs.some(m => m.indexOf("tm3d:fim") === 0) && !!e.ped && !!e.ped.controle && e.ped.controle.tmId === "rae-me"
      && !raeSub.includes("Partida jogada em 3D") && !e.toasts.some(t => /Partida simulada/.test(t)), { ...resumo(e), controle: e.ped && e.ped.controle, raeSub });

  // a falha do 3D ('tm3d:sair' {motivo: 'erro'}): o aviso e a simulação de sempre; o "Simular" da tela fica calado (acima)
  e = await modoEnsaio("Falha do 3D", { inicia: rapida, arg: 5, final: naRapida, modo: "erro" });
  confere("item 124: a falha do 3D (tm3d:sair \"erro\") avisa \"O 3D não abriu: partida simulada.\" e o TM simula o result de sempre",
    e.quadro && e.chegou && e.msgs.includes("tm3d:sair/erro") && e.toasts.some(t => /O 3D não abriu/.test(t)) && !e.em3d && !!e.placar && e.placar.join() === (e.antes || []).join(), resumo(e));

  // o X "Voltar e simular" do TM com o 3D ainda abrindo: a confirmação POR CIMA do quadro (o ponto do meio dela e o do botão são dela)
  // e o "Simular" dela volta ao lance a lance sem resultado 3D
  await limpa();
  await p.evaluate(() => { localStorage.setItem("ensaio3d:modo", "parado"); window.__msgs3d.length = 0; window.__toasts.length = 0; });
  await p.evaluate(rapida, 7);
  await p.waitForTimeout(800);
  const x0 = await p.evaluate(() => { const b = document.querySelector(".tm3d-sair"); return { x: !!b && getComputedStyle(b).display !== "none", titulo: b ? b.title : null, aviso: ((document.querySelector(".tm3d-aviso") || {}).textContent || "").trim() }; });
  await p.evaluate(() => { const b = document.querySelector(".tm3d-sair"); if (b) b.click(); });
  await p.waitForTimeout(400);
  const xs = await p.evaluate(() => {
    const sh = document.querySelector(".sheet-overlay .sheet"); if (!sh) return null;
    const r = sh.getBoundingClientRect(), no = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const bt = [...sh.querySelectorAll("button")].find(b => !b.classList.contains("cancel"));
    const rb = bt.getBoundingClientRect(), cx = rb.left + rb.width / 2, cy = rb.top + rb.height / 2, nb = document.elementFromPoint(cx, cy);
    return { titulo: (sh.querySelector(".sheet-title") || {}).textContent, msg: (sh.querySelector(".sheet-msg") || {}).textContent, botao: bt.textContent,
      porCima: !!no && sh.contains(no), noBotao: !!nb && (nb === bt || bt.contains(nb)), cx, cy, noMeio: no ? (no.className || no.tagName) : null };
  });
  await print("06-x-confirmacao");
  if (xs) await p.mouse.click(xs.cx, xs.cy);
  const xFim = await ate(naRapida, "^(Ver resultado|Pular|Avançar)", 80);
  const ux = await ultimaPartida();
  confere("item 124 (E5): o X \"Voltar e simular\" com o 3D abrindo — a confirmação \"Sair do 3D?\" POR CIMA do quadro (o toque chega ao botão \"Simular\")",
    x0.x && x0.titulo === "Voltar e simular" && /Abrindo o estádio 3D/.test(x0.aviso) && !!xs && xs.titulo === "Sair do 3D?" && xs.porCima && xs.noBotao && xs.botao === "Simular" && /lance a lance/.test(xs.msg || ""), { x0, xs });
  confere("item 124 (E5): o \"Simular\" da confirmação fecha o 3D e o TM simula o result de sempre, calado", !!xs && xs.noBotao && xFim && !ux.em3d && !!ux.placar && ux.placar.join() === (ux.antes || []).join() && !ux.toasts.some(t => /Partida simulada|O 3D não abriu/.test(t)) && !ux.msgs.some(m => m.indexOf("tm3d:fim") === 0), ux);

  // "Sempre simular" escolhido NA Config (depois da migração) vale: o Jogar não abre o 3D
  await limpa();
  await p.evaluate(() => TM.ui.go("settings"));
  await p.waitForTimeout(500);
  await p.evaluate(() => {
    const st = [...document.querySelectorAll(".setting")].find(x => /Partidas do seu time/.test(x.textContent));
    const b = st && [...st.querySelectorAll(".seg-btn")].find(x => /Sempre simular/.test(x.textContent)); if (b) b.click();
    const sv = [...document.querySelectorAll("button")].find(x => /^Salvar$/.test(x.textContent.trim())); if (sv) sv.click();
  });
  const pref = await p.evaluate(() => ({ pref: TM.tm3d.preferencia ? TM.tm3d.preferencia() : null, salvo: TM.storage.settings().partidasTela || null }));
  e = await modoEnsaio("Sempre simular", { inicia: rapida, arg: 9, final: naRapida });
  confere("item 124: \"Sempre simular\" escolhido na Config (partidasTela) vale — o Jogar não abre o 3D e o TM simula o result de sempre", pref.pref === "simular" && pref.salvo === "simular" && !e.quadro && !e.janela && e.chegou && !e.em3d && !!e.placar && e.placar.join() === (e.antes || []).join(), { pref, ...resumo(e) });
  await p.evaluate(() => { const s = TM.storage.settings(); s.partidasTela = "tela"; TM.storage.saveSettings(s); });

  // sem WebGL 2: simula como hoje, com UM aviso por sessão
  await p.evaluate(() => { window.__gc = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t) { if (t === "webgl2") return null; return window.__gc.apply(this, arguments); }; });
  const w1 = await modoEnsaio("Sem WebGL 2", { inicia: rapida, arg: 11, final: naRapida });
  const w2 = await modoEnsaio("Sem WebGL 2 (2ª)", { inicia: rapida, arg: 13, final: naRapida });
  await p.evaluate(() => { HTMLCanvasElement.prototype.getContext = window.__gc; });
  const av = [w1, w2].map(w => w.toasts.filter(t => /WebGL 2/.test(t)));
  confere("item 124: sem WebGL 2 o Jogar simula (sem quadro nem janela) e avisa uma vez só", !w1.quadro && !w2.quadro && !w1.janela && !w2.janela && w1.chegou && w2.chegou && !w1.em3d && !w2.em3d && av[0].length === 1 && av[1].length === 0, { av, w1: resumo(w1), w2: resumo(w2) });

  await limpa();
  await p.evaluate((v) => { TM.tm3d.PASTA = v; localStorage.removeItem("ensaio3d:modo"); localStorage.removeItem("ensaio3d:ultimo"); }, pastaReal);
  await cx.unroute(ROTA_ENSAIO);
}

confere("nenhum erro de página (TM e 3D)", erros.length === 0, erros);
console.log("OK:\n  " + ok.join("\n  "));
if (falhas.length) console.log("FALHOU:\n  " + falhas.join("\n  "));
console.log("prints em " + PASTA);
await b.close();
process.exit(falhas.length ? 1 : 0);
