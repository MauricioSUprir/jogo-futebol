/* Teste de ponta a ponta das partidas em 3D (Total Match → motor 3D → Total Match).
   O site precisa estar montado como no GitHub Pages: o TM na raiz e o 3D em /futebol3d/. Ex.:
     mkdir -p /tmp/site && cp -r legacy-total-match/. /tmp/site/ && ln -sfn "$PWD/futebol3d" /tmp/site/futebol3d
     (cd /tmp/site && python3 -m http.server 8207)
     node legacy-total-match/ferramentas/testar-3d.mjs [http://localhost:8207] [pasta-dos-prints]
   Passa por: Ultimate (Rivais) com a escolha Jogar em 3D / Simular, carreira de técnico (escalação do
   adversário, resultado registrado) e Rumo ao Estrelato ("só o meu jogador": controle travado, câmera Pro,
   nota/gols do 3D). Em cada um usa "Simular o resto" da pausa do 3D. Reprova com erro de página ou regra quebrada.
   O Chromium headless não passa pelo proxy: o three.js (jsdelivr) vem do cache de futebol3d/tools/cdn-route.mjs. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const PW = process.env.PLAYWRIGHT_MODULE || "/opt/node22/lib/node_modules/playwright/index.mjs";
const { chromium } = await import(PW);
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const { routeCDN } = await import(path.join(AQUI, "../../futebol3d/tools/cdn-route.mjs"));
const BASE = process.argv[2] || "http://localhost:8207";
const PASTA = process.argv[3] || "/tmp/testar-3d";
fs.mkdirSync(PASTA, { recursive: true });

const b = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const cx = await b.newContext({ viewport: { width: 960, height: 540 } });
await routeCDN(cx);
const p = await cx.newPage();
const erros = [];
p.on("pageerror", e => erros.push(String(e).slice(0, 300)));
await p.addInitScript(() => { localStorage.setItem("totalmatch:__edition", "pro"); localStorage.setItem("totalmatch:su_unlocked", "1"); });
await p.goto(BASE + "/index.html", { waitUntil: "networkidle" });
await p.waitForFunction(() => window.TM && TM.tm3d && TM.ut && TM.rae && TM.comp, { timeout: 60000 });
// 3D leve para o teste: qualidade baixa, sem abertura e tempos de 2 minutos
await p.evaluate(() => {
  localStorage.setItem("golaco.settings", JSON.stringify({ quality: "baixa", intro: false, halfMinutes: 2 }));
  TM.storage.saveSettings(Object.assign(TM.storage.settings(), { partidas3d: "perguntar", matchSpeed: "instantaneo" }));
});

const falhas = [], ok = [];
function confere(nome, cond, info) { (cond ? ok : falhas).push(nome + (info != null ? " — " + JSON.stringify(info) : "")); }
async function print(nome) { await p.screenshot({ path: path.join(PASTA, nome + ".png") }); }
async function abre3d() {
  await p.evaluate(() => document.querySelector(".tm3d-op.tres").click());
  for (let i = 0; i < 300; i++) {
    await p.waitForTimeout(500);
    const fr = p.frames().find(f => /futebol3d\/index\.html\?tm=/.test(f.url()));
    if (fr && await fr.evaluate(() => !!(window.__golaco && window.__golaco.game && window.__golaco.ponte)).catch(() => false)) { await p.waitForTimeout(2500); return fr; }
  }
  return null;
}
async function ate(fn, n = 400) { for (let i = 0; i < n; i++) { await p.waitForTimeout(500); if (await p.evaluate(fn)) return true; } return false; }
const timesDo3d = (fr) => fr.evaluate(() => __golaco.game.match.teams.map(t => ({ nome: t.data.name, gks: t.players.filter(q => q.isGK).length,
  xi: t.players.map(q => q.data.pos), lados: t.players.filter(q => /^(LD|LE)$/.test(q.data.pos)).map(q => q.data.pos + (q.data.slot ? ":" + q.data.slot[1] : "")), kit: t.kit.shirt })));

// 1) Ultimate · Rivais: escolha aparece, 3D abre com os dois times, "Simular o resto" e o placar volta
await p.evaluate(() => { const s = TM.ut._new("Teste 3D"); TM.ut.openPack(s, { n: 26, lo: 70, hi: 84, rare: .4 }); TM.ut.autoFill(s); TM.ut.save(); TM.ui.go("ut-rivals"); });
await p.waitForTimeout(800);
await p.evaluate(() => [...document.querySelectorAll("button")].find(x => /^Jogar partida$/.test(x.textContent)).click());
await p.waitForTimeout(600);
const op = await p.evaluate(() => [...document.querySelectorAll(".tm3d-op b")].map(x => x.textContent));
confere("Ultimate: escolha Jogar em 3D / Simular", op.join("|") === "Jogar em 3D|Simular", op);
await print("01-escolha");
let fr = await abre3d();
confere("Ultimate: o 3D abre", !!fr);
if (fr) {
  const ts = await timesDo3d(fr);
  confere("Ultimate: 1 goleiro por time e laterais no lado certo (LD à direita, LE à esquerda)",
    ts.every(t => t.gks === 1 && t.lados.every(l => (l.startsWith("LD") ? +l.split(":")[1] >= 50 : +l.split(":")[1] <= 50) || !l.includes(":"))), ts);
  confere("Ultimate: uniformes diferentes", ts[0].kit !== ts[1].kit, ts.map(t => t.kit));
  await print("02-ultimate-3d");
  const pausa = await fr.evaluate(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true })); return [...document.querySelectorAll(".gm-pause button")].map(x => x.textContent.trim()); });
  confere("Ultimate: pausa com Simular o resto (sem Reiniciar/Sair)", pausa.includes("Simular o resto") && !pausa.includes("Reiniciar") && !pausa.includes("Sair"), pausa);
  await fr.evaluate(() => __golaco.simularResto());
  confere("Ultimate: resultado do 3D aparece no TM", await ate(() => !!document.querySelector(".utm-res") && !document.querySelector(".tm3d-tela")));
  await print("03-ultimate-resultado");
}

// 2) Carreira de técnico: adversário escalado direito e resultado registrado
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
  confere("Carreira: 1 goleiro por time", ts.every(t => t.gks === 1), ts.map(t => t.nome + " " + t.xi.join(" ")));
  await print("04-carreira-3d");
  await fr.evaluate(() => __golaco.simularResto());
  const fim = await ate(() => TM.ui.current() === "coach-match");
  const jogos = await p.evaluate(() => (TM.storage.coachCareer() || {}).matchNo);
  confere("Carreira: partida registrada (tela de resultado e rodada nova)", fim && jogos === 1, { fim, jogos });
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
  const tr = await fr.evaluate(() => { const m = __golaco.game.match, eu = m.controlled; const outro = m.userTeam.players.find(q => q !== eu && !q.isGK); m.setControlled(outro);
    return { travado: __golaco.ponte.travado, eu: eu && eu.data.tmId, depois: m.controlled && m.controlled.data.tmId, camera: __golaco.game.rig.mode }; });
  confere("Estrelato: controle travado no meu jogador e câmera Pro", tr.travado && tr.eu === "rae-me" && tr.depois === "rae-me" && tr.camera === "pro", tr);
  const anda = await fr.evaluate(() => { for (let k = 0; k < 20; k++) __golaco.advance(1); const m = __golaco.game.match; return { fase: m.phase, relogio: Math.round(m.clock), eu: m.controlled && m.controlled.data.tmId }; });
  confere("Estrelato: o jogo anda sozinho nas bolas paradas do meu time", anda.relogio > 0 && anda.eu === "rae-me", anda);
  await print("06-estrelato-3d");
  await fr.evaluate(() => __golaco.simularResto());
  await ate(() => !!document.querySelector(".rae-res"));
  const res = await p.evaluate(() => ({ sub: [...document.querySelectorAll(".rae-res-s")].map(x => x.textContent), nota: (document.querySelector(".rae-minha .tile-val") || {}).textContent }));
  confere("Estrelato: súmula diz 'Partida jogada em 3D' e traz a nota", res.sub.includes("Partida jogada em 3D") && +res.nota >= 3, res);
  await print("07-estrelato-resultado");
}

confere("nenhum erro de página", erros.length === 0, erros);
console.log("OK:\n  " + ok.join("\n  "));
if (falhas.length) console.log("FALHOU:\n  " + falhas.join("\n  "));
console.log("prints em " + PASTA);
await b.close();
process.exit(falhas.length ? 1 : 0);
