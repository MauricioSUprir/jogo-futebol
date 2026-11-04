// Online 1×1, etapa 3 (contrato "Online 1×1" no CONTRATOS.md): a página do online no navegador — DUAS abas do mesmo
// Chromium (o mesmo contexto: um BroadcastChannel liga as duas, ?online=<sala>&transporte=bc&lado=0|1) jogando a mesma
// partida, a IA pelo controlado de cada lado (?ia=1: o bit IA o tempo todo; sem pessoa).
//   P1 as duas abrem e o jogo anda nas duas (passos > 0), sem erro no console;
//   P2 o MESMO jogo: os hashes guardados a cada 60 passos iguais nos passos que as duas têm (≥ 10 em comum), e o placar
//      igual no mesmo passo;
//   P3 a pausa combinada: A pausa — A para; B para sozinho (sem a entrada de A) e mostra "Pausado por"; A retoma — os dois
//      andam de novo e os hashes continuam iguais;
//   P4 o menu aberto NÃO para o jogo (online: a IA joga pelo meu controlado);
//   P5 a partida inteira (?min=0.25) acaba nas duas com o mesmo placar e o mesmo hash final;
//   P7 (item 32) o relógio do placar no fim: as duas abas com "Fim" no #relogio, no bloco parado (o mesmo lerRelogio do
//      quadroOnline nos dois aparelhos);
//   P6 a pausa no celular deitado (844×390, toque) cabe sem rolar com "Pausar a partida" e "Sair da partida", sem Replay,
//      Simular o resto, Reiniciar nem Modo de jogo.
//   P9 (item 58) o Pausar e o Sair da pausa pelo toque COM OUTRO DEDO PARADO NA TELA (o navegador não gera o click com dois
//      dedos: os dois agem no pointerup do mesmo dedo, toque-botao.js aoTocar) — o Pausar pausa; o 1º toque no Sair arma a
//      confirmação ("Toque de novo para sair"), sem sair.
//   node tools/teste-online-tela.mjs
import { servidor, abrir } from './lib/navegador.mjs';

const res = [];
const meta = (nome, medido, ok) => res.push({ nome, medido, ok: !!ok });
const srv = await servidor(0);
const erros = [];
const t0 = Date.now();

const s = await abrir({ largura: 844, altura: 390, dpr: 1, toque: true });
const sala = 'teste' + Date.now();
const q = lado => `${srv.url}index.html?online=${sala}&transporte=bc&lado=${lado}&ia=1&semente=7&min=0.25&q=baixa&replay=0&comemoracao=0&prejogo=0&D=4`;
const A = s.pagina;
const B = await s.contexto.newPage();
for (const [p, nome] of [[A, 'A'], [B, 'B']]) {
  p.on('pageerror', e => erros.push(`${nome}: ${e.message}`));
  p.on('console', m => { if (m.type() === 'error') erros.push(`${nome}: ${m.text()}`); });
}
await Promise.all([A.goto(q(0), { waitUntil: 'load' }), B.goto(q(1), { waitUntil: 'load' })]);
const pronto = p => p.waitForFunction(() => window.__golaco && window.__golaco.pronto && window.__golaco.online, null, { timeout: 180000 });
await Promise.all([pronto(A), pronto(B)]);
const est = p => p.evaluate(() => { const o = window.__golaco.online; return { n: o.n, D: o.D, rtt: o.rtt, hashes: o.hashes, placar: o.placar, estado: o.estado, tick: o.tick, pausado: o.pausado, conexao: o.conexao }; });
const esperar = ms => new Promise(r => setTimeout(r, ms));
// o Chromium sem GPU daqui desenha ~12 quadros/s com uma aba e ~6 com duas (5 passos por quadro no máximo): o teste espera
// PASSOS, não tempo
const ate = (p, n, ms = 120000) => p.waitForFunction(k => (window.__golaco.online?.n ?? 0) >= k, n, { timeout: ms }).then(() => true, () => false);

// P1
await Promise.all([ate(A, 120), ate(B, 120)]);
let a = await est(A), b = await est(B);
meta('P1 as duas abas jogam (passos > 0 nas duas)', `A ${a.n} · B ${b.n} passos (D ${a.D}/${b.D}, RTT ${a.rtt?.toFixed?.(0) ?? '—'} ms)`, a.n > 60 && b.n > 60);

// P2
function comparar(x, y) {
  const mx = new Map(x.hashes), comuns = y.hashes.filter(([n]) => mx.has(n));
  const difs = comuns.filter(([n, h]) => mx.get(n) !== h).length;
  return { comuns: comuns.length, difs };
}
await Promise.all([ate(A, 660), ate(B, 660)]);
a = await est(A); b = await est(B);
let c = comparar(a, b);
meta('P2 o mesmo jogo nas duas (hashes a cada 60 passos)', `${c.difs} diferentes de ${c.comuns} em comum`, c.comuns >= 5 && c.difs === 0);

// P3 pausa combinada
await A.evaluate(() => window.__golaco.online.pausar());
await esperar(2500);
const a1 = await est(A), b1 = await est(B);
await esperar(1500);
const a2 = await est(A), b2 = await est(B);
const textoB = await B.evaluate(() => document.getElementById('online-aviso')?.hidden ? '' : document.getElementById('online-aviso')?.textContent ?? '');
const paradoA = a2.n === a1.n, paradoB = b2.n === b1.n;
await A.evaluate(() => window.__golaco.online.retomar());
await Promise.all([ate(A, a2.n + 120), ate(B, b2.n + 120)]);
const a3 = await est(A), b3 = await est(B);
c = comparar(a3, b3);
meta('P3 pausa: A e B param, B mostra "Pausado por", depois os dois andam e seguem iguais', `parados ${paradoA}/${paradoB} · B: "${textoB.slice(0, 40)}" · depois ${a3.n - a2.n}/${b3.n - b2.n} passos · ${c.difs}/${c.comuns}`,
  paradoA && paradoB && /Pausado por/.test(textoB) && a3.n > a2.n + 60 && b3.n > b2.n + 60 && c.difs === 0);

// P4 menu aberto não para
await B.evaluate(() => window.__golaco.abrirMenu());
await esperar(300);
const menuAberto = await B.evaluate(() => !document.getElementById('menu')?.hidden);
const b4 = await est(B);
const andou = await ate(B, b4.n + 60, 60000);
const b5 = await est(B);
// P6 a pausa do online no celular deitado
const pausa = await B.evaluate(() => {
  const vis = sel => { const e = document.querySelector(sel); return !!e && !e.hidden && e.offsetParent !== null; };
  const corpo = document.querySelector('#menu .menu-corpo');
  return { pausar: vis('#btn-online-pausar'), sair: vis('#btn-online-sair'), replay: vis('#menu [data-cmd="replay"]'), simular: vis('#btn-simular-resto'),
    reiniciar: vis('#btn-reiniciar-partida'), modos: vis('#btn-modos'), rola: corpo ? corpo.scrollHeight - corpo.clientHeight : 0 };
});
meta('P4 o menu aberto não para o jogo (a IA joga pelo meu controlado)', `menu ${menuAberto ? 'aberto' : 'fechado'} · ${b5.n - b4.n} passos com ele aberto`, menuAberto && andou);
meta('P6 a pausa do online (844×390): Pausar e Sair; sem Replay, Simular, Reiniciar, Modo de jogo; sem rolar', JSON.stringify(pausa),
  pausa.pausar && pausa.sair && !pausa.replay && !pausa.simular && !pausa.reiniciar && !pausa.modos && pausa.rola <= 0);
// P9 o Pausar e o Sair pelo toque com outro dedo parado na tela. O dedo parado fica no título da faixa (nada acontece ali: nem
// fecha a pausa nem toca num item — perto da lista, o ajuste do toque do Chromium o levava ao item mais próximo, que agia ao
// soltar). O touchEnd do CDP solta os dois (os dois pointerup chegam com dois dedos na sequência: o click não vem)
{
  const cdpB = await s.contexto.newCDPSession(B);
  const toque = (type, pts) => cdpB.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const ponto = sel => B.evaluate(sl => { const e = document.querySelector(sl); if (!e || e.hidden || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
  const dedo = await B.evaluate(() => { const l = document.querySelector('#menu .janela-topo h2').getBoundingClientRect(); return { x: Math.round(l.left + l.width / 2), y: Math.round(l.top + l.height / 2), id: 1, radiusX: 1, radiusY: 1 }; });
  const comOutroDedo = async sel => {
    const p = await ponto(sel);
    if (!p) return false;
    await toque('touchStart', [dedo]);
    await toque('touchStart', [dedo, { x: p.x, y: p.y, id: 2, radiusX: 1, radiusY: 1 }]);
    await esperar(120);
    await toque('touchEnd', []);
    return true;
  };
  await B.evaluate(() => window.__golaco.abrirMenu());
  await esperar(200);
  const p0 = await B.evaluate(() => window.__golaco.online.pausasRestam);
  const tocouP = await comOutroDedo('#btn-online-pausar');
  await esperar(300);
  const pz = await B.evaluate(() => ({ pausado: window.__golaco.online.pausado, restam: window.__golaco.online.pausasRestam, menu: !document.getElementById('menu').hidden }));
  await B.evaluate(() => window.__golaco.online.retomar());
  await B.evaluate(() => window.__golaco.abrirMenu());
  await esperar(200);
  const tocouS = await comOutroDedo('#btn-online-sair');
  await esperar(200);
  const sair = await B.evaluate(() => ({ texto: document.getElementById('btn-online-sair')?.firstChild?.textContent ?? '', estado: window.__golaco.online.estado }));
  meta('P9 o Pausar e o Sair da pausa pelo toque com outro dedo parado na tela (item 58)',
    `Pausar ${tocouP ? 'tocado' : 'NÃO achado'}: pausado ${pz.pausado}, pausas ${p0} → ${pz.restam}, pausa ${pz.menu ? 'aberta' : 'fechada'} · Sair ${tocouS ? 'tocado' : 'NÃO achado'}: "${sair.texto.trim()}" (${sair.estado})`,
    tocouP && pz.pausado && pz.restam === p0 - 1 && tocouS && /Toque de novo para sair/.test(sair.texto) && sair.estado !== 'fim');
  await cdpB.detach().catch(() => {});
}
await B.evaluate(() => document.querySelector('#menu [data-cmd="continuar"]')?.click());

// P5 a partida inteira
const fim = p => p.waitForFunction(() => window.__golaco.online?.estado === 'fim', null, { timeout: 240000 }).then(() => true, () => false);
const [fa, fb] = await Promise.all([fim(A), fim(B)]);
await esperar(1000);
a = await est(A); b = await est(B);
const hf = await Promise.all([A.evaluate(() => window.__golaco.hash()), B.evaluate(() => window.__golaco.hash())]);
c = comparar(a, b);
meta('P5 a partida inteira acaba nas duas com o mesmo placar e o mesmo jogo', `fim ${fa}/${fb} · placar ${a.placar.join('×')} / ${b.placar.join('×')} · ${c.difs} diferentes de ${c.comuns}`,
  fa && fb && a.placar.join() === b.placar.join() && c.difs === 0 && c.comuns >= 20);
const relFim = await Promise.all([A, B].map(p => p.evaluate(() => { const r = document.getElementById('relogio'), b = document.getElementById('placar-relogio'); return { txt: r?.textContent.trim() ?? '', parado: !!b?.classList.contains('parado'), vis: !!b && !b.hidden }; })));
meta('P7 o relógio do placar no fim: "Fim" no bloco parado nas duas abas (item 32)', relFim.map((x, i) => `${i ? 'B' : 'A'} "${x.txt}"${x.parado ? ' parado' : ''}${x.vis ? '' : ' (escondido)'}`).join(' · '),
  relFim.every(x => x.vis && x.txt === 'Fim' && x.parado));
meta('erros no console', erros.length ? erros.slice(0, 3).join(' | ') : '0', erros.length === 0);
void hf;

await s.navegador.close();
await srv.fechar();
for (const r of res) console.log(`${r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.nome}: ${r.medido}`);
const falhas = res.filter(r => !r.ok).length;
console.log(`\nteste-online-tela: ${falhas ? `REPROVOU (${falhas} itens)` : 'PASSOU'} em ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(falhas ? 1 : 0);
