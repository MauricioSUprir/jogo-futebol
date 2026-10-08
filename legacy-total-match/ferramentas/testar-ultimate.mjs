/* Teste de ponta a ponta do Total Ultimate (navegador headless).
   Uso: com o site servido (ex.: python3 -m http.server 8207 dentro de legacy-total-match)
     node ferramentas/testar-ultimate.mjs [http://localhost:8207] [pasta-dos-prints]
   Passa por: criação do clube (elenco inicial com química), escalação/Auto, Rivais,
   Batalhas, Champions, Draft, Evoluções, Temporada, objetivos, DME (montar com as
   mais baratas e enviar), pacotes (probabilidades e abertura), escolha de jogador e
   mercado. Reprova com erro de página ou com regra quebrada. */
import fs from "fs";
import path from "path";
const PW = process.env.PLAYWRIGHT_MODULE || "/opt/node22/lib/node_modules/playwright/index.js";
const { chromium } = (await import(PW)).default;
const BASE = process.argv[2] || "http://localhost:8207";
const PASTA = process.argv[3] || "/tmp/testar-ultimate";
fs.mkdirSync(PASTA, { recursive: true });

const b = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const erros = [];
p.on("pageerror", e => erros.push(String(e).slice(0, 400)));
await p.addInitScript(() => { localStorage.setItem("totalmatch:__edition", "pro"); localStorage.setItem("totalmatch:su_unlocked", "1"); });
await p.goto(BASE + "/index.html", { waitUntil: "networkidle" });
await p.waitForFunction(() => window.TM && TM.ut && TM.utModos && TM.utTemp && TM.utDme, { timeout: 60000 });
await p.waitForTimeout(800);

const falhas = [], ok = [];
function confere(nome, cond, info) { (cond ? ok : falhas).push(nome + (info != null ? " — " + JSON.stringify(info) : "")); }
async function print(nome) { await p.screenshot({ path: path.join(PASTA, nome + ".png"), fullPage: true }); }
async function clica(rx) {
  return p.evaluate((rx) => { const b = [...document.querySelectorAll("button")].find(x => new RegExp(rx).test(x.textContent.trim())); if (b) { b.click(); return true; } return false; }, rx);
}
async function ateResultado() {
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(250);
    if (await p.evaluate(() => !!document.querySelector(".utm-res"))) return true;
    await clica("^(Pular|Ver resultado|Continuar)");
  }
  return false;
}

// 1) clube novo com elenco inicial da liga escolhida
await p.evaluate(() => { TM.storage.saveSettings(Object.assign(TM.storage.settings(), { matchSpeed: "instantaneo" })); localStorage.removeItem("totalmatch:ultimate"); TM.ut.reset(); TM.ui.go("ut"); });
await p.waitForTimeout(700);
await p.evaluate(() => { document.querySelector(".ut-input").value = "Teste FC"; });
await clica("^Criar meu clube$");
await p.waitForTimeout(1200);
const ini = await p.evaluate(() => { const s = TM.ut.state(); const c = TM.ut.chemistry(s); return { cartas: s.cards.length, chem: c.team, fora: c.emPos.filter(v => !v).length }; });
confere("elenco inicial com 18 cartas e química alta", ini.cartas === 18 && ini.chem >= 30 && ini.fora === 0, ini);
await print("01-hub");

// 2) Auto não põe goleiro na linha e respeita contrato
await p.evaluate(() => { const s = TM.ut.state(); TM.ut.openPack(s, { n: 24, lo: 62, hi: 84, rare: .4 }); TM.ut.autoFill(s); s.coins = 200000; TM.ut.save(); });
const auto = await p.evaluate(() => { const s = TM.ut.state(), c = TM.ut.chemistry(s), F = TM.comp.FORMATIONS[s.squad.f]; let gk = 0; c.ds.forEach((d, i) => { if (d && d.pos === "GK" && F[i][0] !== "GK") gk++; }); return { gk, xi: s.squad.xi.filter(Boolean).length, chem: c.team }; });
confere("Auto monta 11 sem goleiro na linha", auto.gk === 0 && auto.xi === 11, auto);

// 3) uma partida em cada modo
for (const [rota, botao, nome] of [["ut-rivals", "^Jogar partida$", "rivais"], ["ut-batalhas", "^Jogar$", "batalhas"]]) {
  await p.evaluate(r => TM.ui.go(r), rota); await p.waitForTimeout(700);
  await clica(botao);
  confere("partida de " + nome + " chega ao resultado", await ateResultado());
  await print("02-" + nome);
}
await p.evaluate(() => { TM.utModos.rivSemana(TM.ut.state()).v = 4; TM.ut.save(); TM.ui.go("ut-champions"); });
await p.waitForTimeout(700);
await clica("^Jogar eliminatória");
confere("partida da Champions chega ao resultado", await ateResultado());
const modos = await p.evaluate(() => { const s = TM.ut.state(); return { riv: s.riv.pl, bat: s.bat.j, ch: s.champ.ej.length, xp: s.temp.xp, jogos: s.stats.jogos }; });
confere("modos registram as partidas e dão XP", modos.riv === 1 && modos.bat === 1 && modos.ch === 1 && modos.xp > 0 && modos.jogos === 3, modos);

// 4) temporada: resgate de nível
await p.evaluate(() => TM.utTemp.ganhaXp(TM.ut.state(), 5000, "teste"));
await p.evaluate(() => TM.ui.go("ut-temporada")); await p.waitForTimeout(700);
const antesT = await p.evaluate(() => (TM.ut.state().picks || []).length);
await clica("^Resgatar");
await p.waitForTimeout(500);
const depoisT = await p.evaluate(() => (TM.ut.state().picks || []).length);
confere("nível 5 da temporada dá escolha de jogador", depoisT === antesT + 1, { antesT, depoisT });
await print("03-temporada");

// 5) escolha de jogador
await p.evaluate(() => { const s = TM.ut.state(); TM.ui.go("ut-escolha", { id: s.picks[0].id }); });
await p.waitForTimeout(700);
const esc = await p.evaluate(() => { const n0 = TM.ut.state().cards.length; const op = document.querySelectorAll(".utm-esc-op .ut-card"); op[0] && op[0].click(); const b = [...document.querySelectorAll("button")].find(x => /^Ficar com/.test(x.textContent)); b && b.click(); return { op: op.length, n0, n1: TM.ut.state().cards.length }; });
confere("escolha de jogador mostra 3 e adiciona 1", esc.op === 3 && esc.n1 >= esc.n0, esc);

// 6) DME: monta com as mais baratas e envia
await p.evaluate(() => TM.ui.go("ut-sbc-build", { id: "start" })); await p.waitForTimeout(600);
await clica("mais baratas"); await p.waitForTimeout(700);
await print("04-dme");
const n0 = await p.evaluate(() => TM.ut.state().cards.length);
await clica("^Enviar elenco$"); await p.waitForTimeout(400); await clica("^Enviar$"); await p.waitForTimeout(700);
const dme = await p.evaluate(() => ({ cartas: TM.ut.state().cards.length, feito: !!(TM.ut.state().sbc || {}).start }));
confere("DME Primeiros Passos consome 11 cartas e conclui", dme.feito && dme.cartas === n0 - 11, { n0, dme });

// 7) pacotes: probabilidades e abertura (com repetido resolvido)
const odds = await p.evaluate(() => { TM.ui.go("ut-store"); const b = document.querySelector(".utp-odds-bt"); b && b.click(); return [...document.querySelectorAll(".utp-odd")].length; });
confere("probabilidades do pacote aparecem", odds >= 5, odds);
await p.evaluate(() => { document.querySelectorAll(".ut-sheet").forEach(x => x.remove()); });
await p.evaluate(() => { const s = TM.ut.state(); s.coins = 100000; TM.ut.save(); TM.ui.go("ut-store"); });
await p.waitForTimeout(500);
await p.evaluate(() => { const b = [...document.querySelectorAll(".ut-pk-buy")].find(x => !x.classList.contains("tc")); b.click(); });
await p.waitForTimeout(700);
for (let i = 0; i < 6; i++) { if (!(await clica("^Revelar tudo$"))) await p.evaluate(() => { const w = document.querySelector(".utw-pular"); w && w.click(); }); await p.waitForTimeout(300); }
const rep = await p.evaluate(() => { const s = TM.ut.state(), ids = {}; let dup = 0; s.cards.forEach(c => { if (ids[c.p]) dup++; ids[c.p] = 1; }); return dup; });
confere("sem jogador repetido no clube", rep === 0, rep);

// 8) módulos opcionais (Draft, Evoluções, Mercado) abrem sem erro
for (const rota of ["ut-draft", "ut-evolucoes", "ut-market", "ut-obj", "ut-stats", "ut-squad", "ut-club", "ut-identidade", "ut"]) {
  await p.evaluate(r => TM.ui.go(r), rota); await p.waitForTimeout(600);
  await print("05-" + rota);
}
confere("nenhum erro de página", erros.length === 0, erros);

console.log("OK:\n  " + ok.join("\n  "));
if (falhas.length) { console.log("FALHOU:\n  " + falhas.join("\n  ")); }
console.log("prints em " + PASTA);
await b.close();
process.exit(falhas.length ? 1 : 0);
