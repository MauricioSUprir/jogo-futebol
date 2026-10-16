/* Teste de ponta a ponta do modo Pênaltis 3D (Total Match → GOLAÇO → Total Match; pedido do dono de 15/10).
   O site precisa estar montado como no GitHub Pages: o TM na raiz e o 3D em /golaco/. Ex.:
     mkdir -p /tmp/site && cp -r legacy-total-match/. /tmp/site/ && ln -sfn "$PWD/golaco" /tmp/site/golaco
     (cd /tmp/site && python3 -m http.server 8231)
     TM_SENHA_VIVERDE=... node legacy-total-match/ferramentas/testar-penaltis.mjs [http://localhost:8231] [pasta-dos-prints]
   A senha do Viverde FC vem SÓ da variável de ambiente TM_SENHA_VIVERDE (nunca no código nem em arquivo); sem ela, o
   Viverde fica de fora (o item 3 sai como "pulado") e o "Seu time" é um clube comum.
   Passa por:
     1 "Pênaltis 3D" em "Mais modos" (ícone + nome, sem emoji) e a tela do modo (Seu time, Adversário, Jogar pênaltis em 3D);
     2 o seletor dos dois times (o do jogo rápido): o adversário é um clube das ligas;
     3 o Viverde FC em "Especiais" pede a senha: a errada é recusada, a certa libera e ele vira o "Seu time";
     4 "Jogar pênaltis em 3D" abre o GOLAÇO no quadro com o pedido modo "penaltis": o 3D abre na DISPUTA (m.modo
       'penaltis', os dois times do pedido, o humano no time 0), avisa o TM (pronto) e a pausa tem "Simular o resto" (sem
       Reiniciar nem Editar time);
     5 "Simular o resto": a disputa acaba (o vencedor pela Regra 10), a faixa "X venceu nos pênaltis" com "Voltar ao Total
       Match" e o resultado no contrato ({penaltis: {vencedor, placar, cobrancas}}, sem homeGoals);
     6 "Voltar ao Total Match" (clique): o TM mostra o resultado — "X venceu nos pênaltis", o placar e as cobranças iguais às
       do 3D (nomes do TM);
     7 "Jogar de novo" abre o 3D outra vez com os mesmos times;
     8 nada sobre nada nas duas telas do modo (360, 390 e 844×390 do celular; 1280 do PC): nenhum botão encostado em outro,
       nada fora da tela, sem rolagem de lado;
     9 nenhum erro de página (no TM e dentro do 3D);
    10 "Mais modos" com os 10 atalhos: numa linha só no PC (1280) e, no celular (360, grade de 3), nenhum sozinho num canto
       da última linha (revisão de 16/10: o "Perfil" ia sozinho para uma 2ª linha no PC);
    11 o quadro do 3D nos Pênaltis não promete simular: o X, a confirmação e o aviso de demora com os textos da disputa
       (revisão de 16/10: "Sair do 3D? A partida é simulada…" / "Simular a partida", e nada era simulado).
   O Chromium headless não passa pelo proxy: o three.js (jsdelivr) vem do cache de golaco/tools/lib/navegador.mjs. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const { abrir } = await import(path.join(AQUI, "../../golaco/tools/lib/navegador.mjs"));
const args = process.argv.slice(2).filter(a => !a.startsWith("--"));
const BASE = args[0] || "http://localhost:8231";
const PASTA = args[1] || "/tmp/testar-penaltis";
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
  localStorage.setItem("golaco.prefs.v1", JSON.stringify({ qualidade: "baixa", replay: false }));
});
await p.goto(BASE + "/index.html", { waitUntil: "networkidle" });
await p.waitForFunction(() => window.TM && TM.tm3d && TM.penaltis3d && TM.ui && TM.data, { timeout: 60000 });

const falhas = [], ok = [];
function confere(nome, cond, info) { (cond ? ok : falhas).push(nome + (info != null ? " — " + JSON.stringify(info) : "")); }
async function print(nome) { await p.screenshot({ path: path.join(PASTA, nome + ".png") }); }
const clicaTexto = (rx, sel = "button") => p.evaluate(([rx, sel]) => { const x = [...document.querySelectorAll(sel)].find(e => new RegExp(rx).test(e.textContent.trim()) && e.offsetParent !== null); if (x) x.click(); return !!x; }, [rx, sel]);

// nada sobre nada: os clicáveis visíveis da tela (o mesmo critério de ferramentas/testar-sobreposicao.mjs)
const sobreposicao = () => p.evaluate(() => {
  const sel = "button, a[href], [role=button], input, select, .chosen-team, .vit-mais-b, .pen3d-cob";
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
    await p.waitForTimeout(500);
    await p.evaluate(() => document.querySelectorAll(".toast").forEach(t => t.remove()));
    const s = await sobreposicao();
    r.push({ tela: w + "x" + h, n: s.n, sobre: s.sobre.slice(0, 4), fora: s.fora.slice(0, 4), rolaLado: s.rolaLado });
    await p.screenshot({ path: path.join(PASTA, `8-${rotulo}-${w}x${h}.png`), fullPage: true });
  }
  await p.setViewportSize({ width: 390, height: 844 });
  return r;
}

// 1) o modo no menu e a tela
await p.evaluate(() => TM.ui.go("modes"));
await p.waitForTimeout(800);
const mais = await p.evaluate(() => {
  const b = [...document.querySelectorAll(".vit-mais-b")].find(x => /Pênaltis 3D/.test(x.textContent));
  return b ? { texto: b.textContent.trim(), icone: !!b.querySelector(".tm-ic, svg"), emoji: /\p{Extended_Pictographic}/u.test(b.textContent) } : null;
});
confere("1 'Pênaltis 3D' em Mais modos (ícone + nome, sem emoji)", !!mais && mais.icone && !mais.emoji, mais);
// 10) a grade do "Mais modos": PC numa linha; celular sem um atalho sozinho num canto da última linha
const grade = [];
for (const [w, h] of [[1280, 800], [360, 740]]) {
  await p.setViewportSize({ width: w, height: h });
  await p.evaluate(() => TM.ui.go("modes"));
  await p.waitForTimeout(500);
  grade.push(await p.evaluate(w => {
    const bs = [...document.querySelectorAll(".vit-mais-b")].filter(b => b.offsetParent !== null).map(b => b.getBoundingClientRect());
    const linhas = [...new Set(bs.map(r => Math.round(r.top)))];
    const ult = bs.filter(r => Math.round(r.top) === linhas[linhas.length - 1]);
    const larg = Math.max(...bs.map(r => r.right)) - Math.min(...bs.map(r => r.left));
    return { tela: w, n: bs.length, linhas: linhas.length, ultima: ult.length, larguraUltima: ult.length === 1 ? Math.round(ult[0].width / larg * 100) : null };
  }, w));
}
await p.setViewportSize({ width: 390, height: 844 });
await p.evaluate(() => TM.ui.go("modes"));
await p.waitForTimeout(400);
confere("10 'Mais modos': os 10 atalhos numa linha no PC; no celular nenhum sozinho num canto da última linha",
  grade[0].n === 10 && grade[0].linhas === 1 && grade[1].n === 10 && (grade[1].ultima > 1 || grade[1].larguraUltima >= 95), grade);
await p.evaluate(() => [...document.querySelectorAll(".vit-mais-b")].find(x => /Pênaltis 3D/.test(x.textContent)).click());
await p.waitForTimeout(700);
const tela = await p.evaluate(() => ({ rota: TM.ui.current(), txt: document.querySelector(".screen.is-active, .screen")?.innerText || "" }));
confere("1 a tela do modo: Seu time, Adversário e 'Jogar pênaltis em 3D'", tela.rota === "penaltis3d" && /Seu time/.test(tela.txt) && /Adversário/.test(tela.txt) && /Jogar pênaltis em 3D/i.test(tela.txt), tela.rota);
await print("1-tela");

// 2) o adversário: um clube das ligas pelo seletor
await p.evaluate(() => [...document.querySelectorAll(".chosen-team")].find(x => /Adversário/.test(x.textContent)).click());
await p.waitForTimeout(600);
const nomeAdv = await p.evaluate(() => { const r = document.querySelector(".tp-row:not(.sel)"); const nome = r && r.querySelector(".tp-name")?.textContent; const rows = [...document.querySelectorAll(".tp-row")]; const outro = rows.find(x => !/Viverde/.test(x.textContent)); outro.click(); return outro.querySelector(".tp-name")?.textContent || nome; });
await p.waitForTimeout(600);
confere("2 o adversário escolhido no seletor do jogo rápido", await p.evaluate(n => TM.ui.current() === "penaltis3d" && !!TM.penaltis3d.setup.teamB && document.body.innerText.includes(n), nomeAdv), nomeAdv);

// 3) o Viverde FC (Especiais, com a senha) como o Seu time
let seu = null;
await p.evaluate(() => [...document.querySelectorAll(".chosen-team")].find(x => /Seu time/.test(x.textContent)).click());
await p.waitForTimeout(600);
const temEsp = await p.evaluate(() => /Especiais/i.test(document.body.innerText) && [...document.querySelectorAll(".tp-row")].some(x => /Viverde FC/.test(x.textContent)));
if (SENHA && temEsp) {
  await p.evaluate(() => [...document.querySelectorAll(".tp-row")].find(x => /Viverde FC/.test(x.textContent)).click());
  await p.waitForSelector(".vv-senha", { timeout: 5000 });
  await p.fill(".vv-senha", "senha-errada-de-teste");
  await clicaTexto("^Liberar$");
  await p.waitForTimeout(700);
  const recusou = await p.evaluate(() => !!document.querySelector(".vv-senha") && TM.ui.current() === "pick-team" && !TM.viverde.liberado());
  await p.fill(".vv-senha", SENHA);
  await clicaTexto("^Liberar$");
  await p.waitForFunction(() => TM.ui.current() === "penaltis3d", null, { timeout: 8000 }).catch(() => {});
  seu = await p.evaluate(() => TM.penaltis3d.setup.teamA);
  confere("3 Viverde FC em Especiais: a senha errada é recusada, a certa libera e ele é o Seu time", recusou && seu === "viverde" && await p.evaluate(() => TM.viverde.liberado()), { recusou, seu });
} else {
  confere("3 Viverde FC em Especiais (senha): " + (SENHA ? "SEM a linha Especiais" : "pulado (sem TM_SENHA_VIVERDE)"), !SENHA ? true : temEsp);
  await p.evaluate(() => { const rows = [...document.querySelectorAll(".tp-row")].filter(x => !/Viverde/.test(x.textContent)); rows[3].click(); });
  await p.waitForTimeout(600);
  seu = await p.evaluate(() => TM.penaltis3d.setup.teamA);
}
await print("3-times");

// 4) "Jogar pênaltis em 3D": o 3D abre na disputa
async function abre3d() {
  await clicaTexto("Jogar (pênaltis em 3D|de novo)");
  for (let i = 0; i < 240; i++) {
    await p.waitForTimeout(500);
    const fr = p.frames().find(f => /golaco\/index\.html\?tm=/.test(f.url()));
    if (fr && await fr.evaluate(() => !!(window.__golaco && window.__golaco.pronto && window.__golaco.tm)).catch(() => false)) { await p.waitForTimeout(1200); return fr; }
  }
  return null;
}
let fr = await abre3d();
confere("4 o GOLAÇO abre no quadro e avisa o TM (pronto)", !!fr && await p.evaluate(() => { const a = document.querySelector(".tm3d-aviso"); return !!a && getComputedStyle(a).display === "none"; }));
let res3d = null;
if (fr) {
  const info = await fr.evaluate(() => {
    const g = window.__golaco, T = g.tm, d = g.disputa;
    return { modo: T.pedido.modo, mundo: g.mundo.modo, humano: T.humano, trava: T.trava, estado: d && d.estado, times: [0, 1].map(t => g.mundo.jogadores.filter(j => j.time === t).length),
      siglas: [document.getElementById("sigla-0")?.textContent, document.getElementById("sigla-1")?.textContent], casa: T.pedido.home.name };
  });
  const nomeSeu = await p.evaluate(id => TM.data.club(id)?.name, seu);
  confere("4 a disputa com os times do pedido (modo 'penaltis', 11 × 11, o humano no time 0, sem trava)", info.modo === "penaltis" && info.mundo === "penaltis" && !!info.estado && info.times.join() === "11,11" && info.humano === 0 && info.trava == null && info.casa === nomeSeu, info);
  await p.waitForTimeout(2500);
  await print("4-disputa-3d");
  const pausa = await fr.evaluate(() => {
    window.__golaco.abrirMenu();
    const v = [...document.querySelectorAll("#menu-acoes button")].filter(x => !x.hidden && x.offsetParent !== null).map(x => x.textContent.trim().replace(/\s+/g, " "));
    const c = document.querySelector('#menu [data-cmd="continuar"]'); if (c) c.click();
    return v;
  });
  confere("4 pausa: Simular o resto (até o fim da disputa), sem Reiniciar, Editar time nem Modo de jogo", pausa.some(x => /^Simular o resto até o fim da disputa/.test(x)) && !pausa.some(x => /Reiniciar|Editar time|Modo de jogo|Cenas/.test(x)), pausa);
  // 5) "Simular o resto"
  const r = await fr.evaluate(async () => {
    const res = await window.__golaco.tm.simularResto();
    const d = window.__golaco.disputa;
    return { res, d, titulo: document.getElementById("faixa-titulo")?.textContent, botao: document.getElementById("faixa-botao")?.textContent?.trim(), gravado: window.__golaco.tm.resultadoGravado(), erros: window.__errosPagina.slice() };
  });
  erros.push(...r.erros.map(e => "3D: " + e));
  res3d = r.res;
  const P = r.res && r.res.penaltis;
  const vencOk = !!P && P.vencedor === r.d.vencedor && P.placar.join() === r.d.placar.join() && P.cobrancas.length === r.d.cobrancas.length;
  confere("5 'Simular o resto': a disputa acaba, faixa 'X venceu nos pênaltis' com 'Voltar ao Total Match', resultado no contrato e gravado",
    r.d.estado === "fim" && vencOk && /venceu nos pênaltis/i.test(r.titulo || "") && r.botao === "Voltar ao Total Match" && !("homeGoals" in (r.res || {})) && JSON.stringify(r.gravado) === JSON.stringify(r.res)
      && P.cobrancas.every(c => (c.lado === 0 || c.lado === 1) && c.tmId != null && c.nome && ["gol", "defesa", "fora"].includes(c.resultado)),
    { estado: r.d.estado, placar: P && P.placar, vencedor: P && P.vencedor, titulo: r.titulo, botao: r.botao, n: P && P.cobrancas.length });
  await print("5-fim-3d");
  // 6) "Voltar ao Total Match": o resultado no TM
  await fr.evaluate(() => document.getElementById("faixa-botao").click());
  await p.waitForFunction(() => TM.ui.current() === "penaltis3d-fim" && !document.querySelector(".tm3d-tela"), null, { timeout: 15000 }).catch(() => {});
  const tmRes = await p.evaluate(() => ({ rota: TM.ui.current(), poster: document.querySelector(".md-poster")?.innerText || "", cob: [...document.querySelectorAll(".pen3d-cob")].map(x => x.innerText.replace(/\s+/g, " ").trim()), aberto: !!document.querySelector(".tm3d-tela") }));
  const vencNome = P ? (P.vencedor === 0 ? info.casa : await p.evaluate(() => TM.penaltis3d.ultimo?.b?.name)) : "";
  confere("6 o TM mostra o resultado: 'X venceu nos pênaltis', o placar e as cobranças do 3D",
    tmRes.rota === "penaltis3d-fim" && !tmRes.aberto && P && tmRes.poster.includes(vencNome + " venceu nos pênaltis".toUpperCase().slice(0, 0)) && new RegExp(vencNome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " venceu nos pênaltis", "i").test(tmRes.poster)
      && tmRes.poster.includes(P.placar[0] + " × " + P.placar[1]) && tmRes.cob.length === P.cobrancas.length,
    { rota: tmRes.rota, poster: tmRes.poster.replace(/\s+/g, " ").slice(0, 120), cobrancas: tmRes.cob.length });
  await print("6-resultado-tm");
  // 7) "Jogar de novo": o 3D abre outra vez com os mesmos times
  fr = await abre3d();
  const de2 = fr ? await fr.evaluate(() => ({ modo: window.__golaco.tm.pedido.modo, casa: window.__golaco.tm.pedido.home.name, estado: window.__golaco.disputa?.estado })) : null;
  confere("7 'Jogar de novo' abre a disputa outra vez com os mesmos times", !!de2 && de2.modo === "penaltis" && de2.casa === info.casa && !!de2.estado, de2);
  if (fr) {
    const r2 = await fr.evaluate(async () => { const res = await window.__golaco.tm.simularResto(); return { res, erros: window.__errosPagina.slice() }; });
    erros.push(...r2.erros.map(e => "3D: " + e));
    await fr.evaluate(() => document.getElementById("faixa-botao").click());
    await p.waitForFunction(() => TM.ui.current() === "penaltis3d-fim" && !document.querySelector(".tm3d-tela"), null, { timeout: 15000 }).catch(() => {});
  }
}

// 11) o quadro do 3D nos Pênaltis: os textos da disputa (nada é simulado) — o 3D numa página que não existe e a demora curta
const quadroTxt = await p.evaluate(async () => {
  const A = TM.tm3d, pasta = A.PASTA, espera = A.ESPERA_MS;
  A.PASTA = "nada-aqui.html"; A.ESPERA_MS = 700;
  const saiu = { n: 0 };
  try {
    const S = TM.penaltis3d.setup, time = id => S.source === "nation" ? TM.engine.teamFromNation(id) : TM.engine.teamFromClub(id);
    A.jogarPenaltis({ teamA: time(S.teamA), teamB: time(S.teamB), userSide: 0 },
      { fim: () => {}, sair: () => { saiu.n++; } });
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
    r.fechou = !document.querySelector(".tm3d-tela"); r.sair = saiu.n; r.rota = TM.ui.current();
    return r;
  } finally { A.PASTA = pasta; A.ESPERA_MS = espera; A.fechar(); }
});
confere("11 quadro dos Pênaltis 3D: o X, a confirmação e o aviso de demora sem prometer simular",
  !!quadroTxt.titulo && !/simul/i.test(quadroTxt.titulo) && !/simul/i.test(quadroTxt.confirma || "simul") && /pênaltis/i.test(quadroTxt.confirma || "")
    && !/simul/i.test(quadroTxt.demora || "simul") && /demorando/i.test(quadroTxt.demora || "") && quadroTxt.fechou && quadroTxt.sair === 1 && /pênaltis/i.test(quadroTxt.quadro || ""), quadroTxt);

// 8) nada sobre nada nas duas telas
const n1 = await nadaSobreNada("penaltis3d", "tela");
const n2 = res3d ? await nadaSobreNada("penaltis3d-fim", "resultado") : [];
const ruins = [...n1, ...n2].filter(x => x.sobre.length || x.fora.length || x.rolaLado);
confere("8 nada sobre nada (360, 390, 844×390, 1280) nas duas telas", ruins.length === 0 && n1.length === 4 && n2.length === 4, ruins.length ? ruins : [...n1, ...n2].map(x => x.tela + ":" + x.n));

// 9) erros
const errosTM = await p.evaluate(() => window.__errosPagina.slice());
confere("9 nenhum erro de página (TM e 3D)", erros.length === 0 && errosTM.length === 0, [...erros, ...errosTM]);
console.log("OK:\n  " + ok.join("\n  "));
if (falhas.length) console.log("FALHOU:\n  " + falhas.join("\n  "));
console.log((falhas.length ? "testar-penaltis: REPROVOU" : "testar-penaltis: PASSOU") + " (" + ok.length + " ok, " + falhas.length + " falhas) · prints em " + PASTA);
await b.close();
process.exit(falhas.length ? 1 : 0);
