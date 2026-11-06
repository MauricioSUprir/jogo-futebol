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
//      confirmação ("Toque de novo: sair"), sem sair.
//   P8 (item 30) a cena de substituição no online, em duas sessões próprias (568×320; a semente achada em Node em que as
//      trocas pedidas no 1º passo produzido saem numa bola morta cedo — hoje a 16, tick 380): cada aba pede a troca do SEU
//      time (A: 9 → 22; B: 109 → 122: a de B chega a A pelo canal confiável, como a do editor do outro jogador);
//      P8a a escolha do ANFITRIÃO vale nos dois (A ?substituicao=1, B ?substituicao=0): as duas abrem a cena no MESMO tick
//          (= o do Node), com os 2 pares e a faixa ENTRA/SAI;
//      P8b cada aba segura só a SUA simulação (0 passos com a cena) e a cena anda (não congela): a de B até o fim, sozinha;
//          depois as duas seguem;
//      P8c o "Pular" de A (aos ~1 s da cena) só pula a de A: B termina a sua; A espera parada no passo de B + D + 2 no máximo,
//          com "{B} ainda está vendo a cena" e nunca "A conexão parou", W.O. nem o selo "Conexão instável" aceso por ≥ 1 s;
//      P8d os hashes a cada 60 passos iguais (nenhuma dessincronia);
//      P8e com a opção desligada no anfitrião (A ?substituicao=0, B ?substituicao=1): nenhuma das duas abre a cena, as duas
//          mostram só a faixa ENTRA/SAI no mesmo tick e o jogo não para; hashes iguais;
//      (revisão do item 30, na sessão do P8a–P8d)
//      P8f o menu de A aberto na cena dele (aos ≥ 0,6 s): a cena segue andando (o menu não a congela no online) e nem um botão
//          do jogo (J = PASSE, segurado) nem o H a pulam — o H abre a Ajuda; Esc fecha a Ajuda e o menu, a cena continua;
//      P8g B em pé (320×568) por 6 s logo depois do fim da cena de A (o pulo), com a de B andando: a de B congela e A, esperando,
//          NÃO lê "Lado 1 ainda está vendo a cena" (B não a está vendo; a marca sai com o celular em pé);
//      P8h o fim da espera de A pela cena de B sem piscar: do último quadro da cena de B até o aviso de A sumir, nenhum
//          "ainda não voltou ao jogo" (a marca vai até o 1º passo de B depois da cena; com a entrada de B chegada o aviso sai
//          no mesmo quadro); e o aviso some;
//      P8i o selo "Conexão instável" escondido com a cena (html.em-substituicao): aceso à força dentro da cena, nas duas
//          abas, o estilo calculado dele é display: none.
//   node tools/teste-online-tela.mjs [--so principal|p8]
import { servidor, abrir } from './lib/navegador.mjs';

const args = process.argv.slice(2);
const SO = (() => { const i = args.indexOf('--so'); return i >= 0 ? String(args[i + 1] ?? '') : ''; })();
const roda = nome => !SO || SO.split(',').includes(nome);
const res = [];
const meta = (nome, medido, ok) => res.push({ nome, medido, ok: !!ok });
const srv = await servidor(0);
const erros = [];
const t0 = Date.now();
const esperar = ms => new Promise(r => setTimeout(r, ms));
function comparar(x, y) {
  const mx = new Map(x.hashes), comuns = y.hashes.filter(([n]) => mx.has(n));
  const difs = comuns.filter(([n, h]) => mx.get(n) !== h).length;
  return { comuns: comuns.length, difs, ultimo: comuns.length ? comuns[comuns.length - 1][0] : null };
}

if (roda('principal')) {
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
// o Chromium sem GPU daqui desenha ~12 quadros/s com uma aba e ~6 com duas (5 passos por quadro no máximo): o teste espera
// PASSOS, não tempo
const ate = (p, n, ms = 120000) => p.waitForFunction(k => (window.__golaco.online?.n ?? 0) >= k, n, { timeout: ms }).then(() => true, () => false);

// P1
await Promise.all([ate(A, 120), ate(B, 120)]);
let a = await est(A), b = await est(B);
meta('P1 as duas abas jogam (passos > 0 nas duas)', `A ${a.n} · B ${b.n} passos (D ${a.D}/${b.D}, RTT ${a.rtt?.toFixed?.(0) ?? '—'} ms)`, a.n > 60 && b.n > 60);

// P2
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
  const sair = await B.evaluate(() => ({ texto: (document.querySelector('#btn-online-sair .item-txt') ?? document.getElementById('btn-online-sair')?.firstChild)?.textContent ?? '', estado: window.__golaco.online.estado }));
  meta('P9 o Pausar e o Sair da pausa pelo toque com outro dedo parado na tela (item 58)',
    `Pausar ${tocouP ? 'tocado' : 'NÃO achado'}: pausado ${pz.pausado}, pausas ${p0} → ${pz.restam}, pausa ${pz.menu ? 'aberta' : 'fechada'} · Sair ${tocouS ? 'tocado' : 'NÃO achado'}: "${sair.texto.trim()}" (${sair.estado})`,
    tocouP && pz.pausado && pz.restam === p0 - 1 && tocouS && /Toque de novo: sair/.test(sair.texto) && sair.estado !== 'fim');
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
void hf;

await s.navegador.close();
}

if (roda('p8')) await secaoP8();

meta('erros no console', erros.length ? erros.slice(0, 3).join(' | ') : '0', erros.length === 0);
await srv.fechar();
for (const r of res) console.log(`${r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.nome}: ${r.medido}`);
const falhas = res.filter(r => !r.ok).length;
console.log(`\nteste-online-tela: ${falhas ? `REPROVOU (${falhas} itens)` : 'PASSOU'} em ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(falhas ? 1 : 0);

// ------------------------------------------------------------------------------------------------ P8 (item 30)
/**
 * A semente em Node, como as abas jogam com ?ia=1&D=4 (os 4 primeiros passos com as entradas neutras do atraso D e depois o
 * bit IA nos dois times: online.js passoOnline — hash Node = página), em que as duas trocas pedidas no 1º passo produzido (o
 * passo 4: a do time 0, 9 → 22, e a do time 1, 109 → 122) saem numa bola morta antes do intervalo e até o tick 1500. Começa
 * pela 16 (tick 380 hoje). {semente, tick} ou null.
 */
async function sementeSubst(min) {
  const P = await import('../js/partida.js'), O = await import('../js/online.js');
  const fns = { passoPartida: P.passoPartida, entradaDemoPartida: P.entradaDemoPartida };
  const ia = { 0: { x: 0, z: 0, botoes: 0, ia: true }, 1: { x: 0, z: 0, botoes: 0, ia: true } };
  const neutra = { 0: { x: 0, z: 0, botoes: 0 }, 1: { x: 0, z: 0, botoes: 0 } };
  const ed = (m, t, sai, entra) => {
    const st = m.times[t], vagas = { ...st.vagas }, v = Object.keys(vagas).find(k => vagas[k] === sai);
    if (v) vagas[v] = entra;
    return { tipo: 'editarTime', time: t, base: st.versao, formacao: st.formacao, vagas, substituicoes: [{ sai, entra }], tatica: { ...st.tatica } };
  };
  for (const semente of [16, ...Array.from({ length: 60 }, (_, i) => i + 1).filter(k => k !== 16)]) {
    const m = P.criarPartida({ semente, humanos: [0, 1], minutosPorTempo: min });
    m.online = true;
    for (let n = 0; m.tick < 1500; n++) {
      const ev = O.passoOnline(m, n < 4 ? neutra : ia, n === 4 ? [ed(m, 0, 9, 22), ed(m, 1, 109, 122)] : null, fns) ?? [];
      if (ev.some(e => e.tipo === 'intervalo')) break;
      const tr = ev.filter(e => e.tipo === 'substituicao');
      if (tr.length) { if (tr.length === 2 && m.partida.estado !== 'intervalo') return { semente, tick: m.tick }; break; }
    }
  }
  return null;
}

/**
 * Duas abas (568×320, toque; a tela pequena anda mais passos por segundo) jogando a semente com a IA pelos dois controlados.
 * Um vigia em cada aba (addInitScript: desde o 1º quadro) pede a troca do SEU time no 1º quadro com o jogo pronto (passo 0;
 * pela API de teste, o mesmo caminho do editor: edicaoNaFila) e anota por quadro [Date.now(), passo, tick, cena ativa,
 * tempo da cena, tick da cena, pares, aviso, selo aceso, faixa ENTRA/SAI (pares na faixa)]; em A, com `pularA`, pula a
 * própria cena pela API (o pularSubst do "Pular") quando o tempo dela passa de pularA s.
 */
async function sessaoSubst({ semente, min, substA, substB, pularA = null, tick, roteiro = null }) {
  const s = await abrir({ largura: 568, altura: 320, dpr: 1, toque: true });
  await s.contexto.addInitScript(cfg => {
    const V = window.__vigia = { log: [], pediu: null, pulou: null, total: null, sonda: null };
    const emPe = window.matchMedia('(orientation: portrait)');
    const lado = new URLSearchParams(location.search).get('lado');
    const volta = () => {
      requestAnimationFrame(volta);
      const g = window.__golaco;
      if (!g || !g.pronto || !g.online) return;
      const o = g.online, cs = g.cenaSubst;
      if (V.pediu == null) V.pediu = { n: o.n, r: g.substituicaoDeTeste({ parada: null, pares: lado === '0' ? [{ sai: 9, entra: 22, time: 0 }] : [{ sai: 109, entra: 122, time: 1 }] }) };
      let e = cs.estado;
      if (e && V.total == null) V.total = e.total;
      // (com o roteiro, A só pula depois dele: window.__roteiroA)
      if (lado === '0' && cfg.pularA != null && e && V.pulou == null && e.tempo >= cfg.pularA && (!cfg.roteiro || window.__roteiroA)) { V.pulou = { t: Date.now(), tempo: e.tempo, n: o.n }; cs.pular(); e = cs.estado; }
      const av = document.getElementById('online-aviso'), sel = document.getElementById('online-selo'), fx = cs.faixa();
      // P8i: na cena, o selo aceso à força (no mesmo quadro, sem desenhar): o estilo calculado dele
      if (cs.ativo && sel && V.sonda == null) { const h = sel.hidden; sel.hidden = false; V.sonda = getComputedStyle(sel).display; sel.hidden = h; }
      V.log.push([Date.now(), o.n, o.tick, cs.ativo ? 1 : 0, e ? e.tempo : null, e ? e.tick : null, e ? e.pares.length : 0,
        av && !av.hidden ? av.textContent.trim().slice(0, 120) : '', sel && !sel.hidden ? 1 : 0, fx.visivel ? fx.n : 0,
        emPe.matches && document.documentElement.classList.contains('com-toque') ? 1 : 0]);
    };
    requestAnimationFrame(volta);
  }, { pularA, roteiro: !!roteiro });
  const sala = 'subst' + Date.now();
  const url = (lado, sub) => `${srv.url}index.html?online=${sala}&transporte=bc&lado=${lado}&ia=1&semente=${semente}&min=${min}&q=baixa&replay=0&comemoracao=0&prejogo=0&D=4&substituicao=${sub ? 1 : 0}`;
  const pA = s.pagina, pB = await s.contexto.newPage();
  for (const [p, nome] of [[pA, 'A'], [pB, 'B']]) {
    p.on('pageerror', e => erros.push(`P8 ${nome}: ${e.message}`));
    p.on('console', m => { if (m.type() === 'error') erros.push(`P8 ${nome}: ${m.text()}`); });
  }
  const ler = p => p.evaluate(() => {
    const g = window.__golaco, o = g.online;
    return { n: o.n, D: o.D, dessinc: o.dessinc, hashes: o.hashes, ligada: g.cenaSubst.ligada(), V: window.__vigia,
      feitas: [g.estadoTime(0)?.subs?.feitas ?? 0, g.estadoTime(1)?.subs?.feitas ?? 0] };
  });
  try {
    await Promise.all([pA.goto(url(0, substA), { waitUntil: 'load' }), pB.goto(url(1, substB), { waitUntil: 'load' })]);
    await Promise.all([pA, pB].map(p => p.waitForFunction(() => window.__golaco && window.__golaco.pronto && window.__golaco.online, null, { timeout: 300000 })));
    // as duas trocas feitas e a cena (se houver) acabada nas duas, e as duas 120 passos depois do tick dela
    const depois = p => p.waitForFunction(k => {
      const g = window.__golaco, o = g.online;
      return !g.cenaSubst.ativo && (o?.n ?? 0) >= k;
    }, (tick ?? 1500) + 120, { timeout: 420000, polling: 250 }).then(() => true, () => false);
    // (o roteiro anda junto: ele age durante a cena, antes do `depois`)
    const rot = roteiro ? roteiro(pA, pB).catch(e => ({ erro: String(e?.message ?? e).slice(0, 200) })) : null;
    const ok = await Promise.all([depois(pA), depois(pB)]);
    const R = rot ? await rot : null;
    const [a, b] = await Promise.all([ler(pA), ler(pB)]);
    return { ok, a, b, R };
  } finally { await s.navegador.close(); }
}

/**
 * (revisão do item 30) O roteiro da sessão P8a–P8d, junto com ela: o menu de A aberto na cena dele (P8f: Esc, J segurado, H,
 * Esc até fechar; só depois A pula — window.__roteiroA) e, logo depois do pulo de A, B em pé por 6 s (P8g: 320×568, com toque =
 * o celular em pé). {menu: {antes, aberto, botao, ajuda, fechou}, retrato: {cenaIni, t0, t1, cenaFim}, erro}.
 */
async function roteiroP8(pA, pB) {
  const R = { menu: null, retrato: null, erro: null };
  const quadros = async (p, k) => {
    const n0 = await p.evaluate(() => window.__vigia.log.length);
    await p.waitForFunction(([n0, k]) => window.__vigia.log.length >= n0 + k, [n0, k], { timeout: 120000, polling: 'raf' });
  };
  const st = () => pA.evaluate(() => {
    const g = window.__golaco, e = g.cenaSubst.estado;
    return { cena: g.cenaSubst.ativo, tempo: e ? e.tempo : null, menu: !document.getElementById('menu').hidden, ajuda: !document.getElementById('ajuda').hidden };
  });
  try {
    await pA.waitForFunction(() => { const e = window.__golaco?.cenaSubst?.estado; return !!e && e.tempo >= 0.6; }, null, { timeout: 420000, polling: 'raf' });
    const M = R.menu = { antes: await st() };
    await pA.keyboard.press('Escape');
    await pA.waitForFunction(() => !document.getElementById('menu').hidden, null, { timeout: 60000, polling: 'raf' });
    M.aberto = await st();
    // um botão do jogo (J = PASSE) segurado com o menu aberto
    await pA.keyboard.down('KeyJ'); await quadros(pA, 3); await pA.keyboard.up('KeyJ'); await quadros(pA, 2);
    M.botao = await st();
    // H com o menu aberto = a Ajuda
    await pA.keyboard.press('KeyH'); await quadros(pA, 3);
    M.ajuda = await st();
    // Esc (voltar) até a Ajuda e o menu fecharem
    for (let k = 0; k < 4; k++) { const x = await st(); if (!x.menu && !x.ajuda) break; await pA.keyboard.press('Escape'); await quadros(pA, 2); }
    M.fechou = await st();
  } catch (e) { R.erro = `menu: ${String(e?.message ?? e).slice(0, 120)}`; }
  finally { await pA.evaluate(() => { window.__roteiroA = true; }).catch(() => {}); }
  try {
    // (a cena de A acabou — pelo pulo; numa versão em que o menu a pulasse, por ele — e A espera a de B)
    await pA.waitForFunction(() => !window.__golaco.cenaSubst.ativo && window.__vigia.log.some(l => l[3] === 1), null, { timeout: 120000, polling: 250 });
    const cenaB = () => pB.evaluate(() => window.__golaco.cenaSubst.ativo);
    const G = R.retrato = { cenaIni: await cenaB(), t00: Date.now() };
    await pB.setViewportSize({ width: 320, height: 568 });
    G.t0 = Date.now();
    await esperar(6000);
    G.cenaFim = await cenaB();
    G.t1 = Date.now();
    await pB.setViewportSize({ width: 568, height: 320 });
    G.t11 = Date.now();
  } catch (e) { R.erro = (R.erro ? `${R.erro} | ` : '') + `retrato: ${String(e?.message ?? e).slice(0, 120)}`; }
  return R;
}

/** As janelas (Date.now()) em que a cena esteve ativa no log de uma aba: [{i0, i1, t0, t1}] (i1 = o 1º quadro sem ela). */
function janelasCena(log) {
  const out = [];
  for (let i = 0; i < log.length; i++) {
    if (log[i][3] !== 1 || (i > 0 && log[i - 1][3] === 1)) continue;
    let k = i; while (k < log.length && log[k][3] === 1) k++;
    out.push({ i0: i, i1: k, t0: log[i][0], t1: k < log.length ? log[k][0] : log[log.length - 1][0] });
  }
  return out;
}
// (declarações de função: a seção roda antes desta linha do arquivo — o fim do teste fica no meio dele)
function f1(x) { return x == null ? '—' : x.toFixed(1); }
function f2(x) { return x == null ? '—' : x.toFixed(2); }

async function secaoP8() {
  const MIN = 1;
  const SS = await sementeSubst(MIN);
  if (!SS) { meta('P8 a semente com as duas trocas cedo (Node)', 'nenhuma das 60 sementes até o tick 1500', false); return; }
  // ---- P8a–P8d: a cena ligada no anfitrião
  try {
    const r = await sessaoSubst({ semente: SS.semente, min: MIN, substA: true, substB: false, pularA: 1.0, tick: SS.tick, roteiro: roteiroP8 });
    const { a, b, R } = r, LA = a.V.log, LB = b.V.log;
    const ja = janelasCena(LA), jb = janelasCena(LB);
    const ca = ja[0] ? LA[ja[0].i0] : null, cb = jb[0] ? LB[jb[0].i0] : null;
    // P8a: o mesmo tick nas duas (= Node), os 2 pares, a faixa na cena; B com ?substituicao=0 segue o anfitrião
    const faixaA = ja[0] ? LA.slice(ja[0].i0, ja[0].i1).some(l => l[9] >= 1) : false, faixaB = jb[0] ? LB.slice(jb[0].i0, jb[0].i1).some(l => l[9] >= 1) : false;
    meta('P8a a escolha do anfitrião vale nos dois (A ?substituicao=1, B ?substituicao=0): as duas abrem a cena no MESMO tick, com os 2 pares (a troca de B veio pelo canal) e a faixa ENTRA/SAI',
      `semente ${SS.semente} (Node: tick ${SS.tick}); pedidas no passo ${a.V.pediu?.n ?? '—'}/${b.V.pediu?.n ?? '—'}; ligada ${a.ligada}/${b.ligada}; cena A ${ca ? `tick ${ca[5]}, ${ca[6]} pares` : 'NÃO'} · B ${cb ? `tick ${cb[5]}, ${cb[6]} pares` : 'NÃO'}; faixa ${faixaA}/${faixaB}; trocas feitas ${a.feitas.join('+')} / ${b.feitas.join('+')}`,
      r.ok.every(Boolean) && a.ligada === true && b.ligada === true && !!ca && !!cb && ca[5] === cb[5] && ca[5] === SS.tick && ca[6] === 2 && cb[6] === 2 && faixaA && faixaB && ja.length === 1 && jb.length === 1);
    // P8b: cada aba segura só a sua (0 passos com a cena) e a cena anda; a de B até o fim (sozinha), a de A até o pulo
    const passos = (L, j) => (j ? new Set(L.slice(j.i0, j.i1).map(l => l[1])).size - 1 : null);
    const tempos = (L, j) => (j ? L.slice(j.i0, j.i1).map(l => l[4]).filter(x => x != null) : []);
    const tA = tempos(LA, ja[0]), tB = tempos(LB, jb[0]);
    // (o tempo da cena de A no quadro do pulo entra: depois do pulo o quadro já é anotado sem a cena)
    if (a.V.pulou) tA.push(a.V.pulou.tempo);
    const maxA = tA.length ? Math.max(...tA) : null, maxB = tB.length ? Math.max(...tB) : null, totB = b.V.total;
    const distA = new Set(tA).size, distB = new Set(tB).size;
    meta('P8b cada aba segura só a SUA simulação (0 passos com a cena) e a cena anda: a de B até o fim, sozinha; a de A até o pulo; depois as duas seguem',
      `A: ${passos(LA, ja[0]) ?? '—'} passos com a cena, tempo até ${f2(maxA)} s (${distA} valores), pulou ${a.V.pulou ? `aos ${f2(a.V.pulou.tempo)} s` : 'não'} · B: ${passos(LB, jb[0]) ?? '—'} passos, tempo até ${f2(maxB)} de ${f2(totB)} s (${distB} valores), pulou ${b.V.pulou ? 'sim' : 'não'}; depois ${a.n}/${b.n} passos (cena no ${ca?.[5] ?? '—'})`,
      !!ja[0] && !!jb[0] && passos(LA, ja[0]) === 0 && passos(LB, jb[0]) === 0 && !!a.V.pulou && maxA >= 1.0 && distA >= 3
      && !b.V.pulou && totB != null && maxB >= totB - 0.2 && distB >= 10 && r.ok.every(Boolean) && a.n >= ca[5] + 120 && b.n >= cb[5] + 120);
    // P8c: A pulou e espera a cena de B (do pulo ao fim da de B): parada no passo de B + D + 2 no máximo; o aviso diz que B
    // ainda está vendo a cena e nunca "A conexão parou" nem W.O.; o selo "Conexão instável" nunca aceso por ≥ 1 s
    let p8c = { ok: false, txt: 'sem as duas cenas' };
    if (ja[0] && jb[0] && a.V.pulou) {
      const tIni = a.V.pulou.t, tFim = jb[0].t1;
      const nB = LB[jb[0].i0][1], Dmax = Math.max(a.D ?? 0, b.D ?? 0);
      const janA = LA.filter(l => l[0] >= tIni && l[0] < tFim);
      const maxNA = janA.length ? Math.max(...janA.map(l => l[1])) : null;
      const avisos = [...new Set(janA.map(l => l[7]).filter(Boolean))];
      const ruins = avisos.filter(t => /conexão parou|W\.O\./i.test(t));
      const cena = avisos.some(t => /Lado 1 ainda está vendo a cena/.test(t));
      // o selo aceso por mais tempo seguido (ms) — fora do giro de B (P8g: o redimensionamento do Chromium sem GPU segura os
      // quadros de B por segundos — sem pacote; o giro é perturbação do teste, não a espera pela cena), que fica informativo
      const G = R?.retrato, noGiro = l => !!G && G.t00 != null && l[0] >= G.t00 - 500 && l[0] <= (G.t11 ?? G.t1 ?? G.t00) + 3000;
      const seloRun = L => {
        let max = 0, ini = null;
        for (const l of L) { if (l[8]) { if (ini == null) ini = l[0]; max = Math.max(max, l[0] - ini); } else ini = null; }
        return max;
      };
      const fora = janA.filter(l => !noGiro(l)), giro = janA.filter(noGiro);
      const seloMax = seloRun(fora), seloGiro = seloRun(giro);
      const seloQ = fora.filter(l => l[8]).length;
      p8c = {
        ok: maxNA != null && maxNA <= nB + Dmax + 2 && !ruins.length && cena && seloMax < 1000 && (tFim - tIni) >= 2000,
        txt: `espera de A ${f1((tFim - tIni) / 1000)} s: passo de A até ${maxNA ?? '—'} (B parado no ${nB}, D ${a.D}/${b.D}); avisos ${avisos.map(t => `"${t}"`).join(' · ') || 'nenhum'}; selo aceso em ${seloQ} quadros fora do giro de B (o maior trecho ${f1(seloMax / 1000)} s; no giro, informativo, ${f1(seloGiro / 1000)} s em ${giro.filter(l => l[8]).length} quadros)`,
      };
    }
    meta('P8c o "Pular" de A só pula a dele: A espera a cena de B parada (≤ o passo de B + D + 2), com "Lado 1 ainda está vendo a cena", nunca "A conexão parou" nem W.O., e sem o selo "Conexão instável" por ≥ 1 s', p8c.txt, p8c.ok);
    // P8d: hashes iguais passando do tick da cena
    const c = comparar(a, b);
    meta('P8d o mesmo jogo nas duas com a cena (hashes a cada 60 passos)', `${c.difs} diferentes de ${c.comuns} em comum (até o passo ${c.ultimo ?? '—'}); dessincronia ${a.dessinc ? 'SIM' : 'não'}/${b.dessinc ? 'SIM' : 'não'}`,
      c.comuns >= 5 && c.difs === 0 && c.ultimo != null && c.ultimo > SS.tick && !a.dessinc && !b.dessinc);
    // P8f: o menu de A aberto na cena dele
    {
      const M = R?.menu, tx = x => (x ? `${x.cena ? 'cena' : 'SEM cena'} ${f2(x.tempo)} s${x.menu ? ', menu' : ''}${x.ajuda ? ', Ajuda' : ''}` : '—');
      const ok = !!M && !!M.aberto && !!M.botao && !!M.ajuda && !!M.fechou && M.aberto.menu && M.aberto.cena && M.botao.cena && M.ajuda.cena
        && M.ajuda.ajuda && M.fechou.cena && !M.fechou.menu && !M.fechou.ajuda && M.ajuda.tempo > M.aberto.tempo && M.fechou.tempo > M.ajuda.tempo;
      meta('P8f o menu de A aberto na cena dele: a cena segue andando e nem o J (PASSE, segurado) nem o H a pulam — o H abre a Ajuda; o Esc fecha a Ajuda e o menu com a cena ainda andando',
        M ? `antes: ${tx(M.antes)} · menu aberto: ${tx(M.aberto)} · depois do J: ${tx(M.botao)} · depois do H: ${tx(M.ajuda)} · fechado: ${tx(M.fechou)}${R?.erro ? ` (${R.erro})` : ''}` : `sem o roteiro${R?.erro ? ` (${R.erro})` : ''}`, ok);
    }
    // P8g: B em pé com a cena andando — a de B congela e A não lê "vendo a cena" (folga de 1,5 s para o pacote)
    {
      const G = R?.retrato;
      let txt = `sem o roteiro${R?.erro ? ` (${R.erro})` : ''}`, ok = false;
      if (G && G.t0 != null && G.t1 != null) {
        const janB = LB.filter(l => l[0] >= G.t0 + 1000 && l[0] <= G.t1);
        const tB = janB.filter(l => l[3]).map(l => l[4]);
        const janA = LA.filter(l => l[0] >= G.t0 + 1500 && l[0] <= G.t1);
        const avisos = [...new Set(janA.map(l => l[7]).filter(Boolean))];
        const vendo = janA.filter(l => /vendo a cena/.test(l[7])).length;
        const congelou = tB.length >= 2 && Math.max(...tB) - Math.min(...tB) <= 0.05;
        ok = G.cenaIni === true && G.cenaFim === true && janB.length >= 2 && janB.every(l => l[10] === 1 && l[3] === 1) && congelou && janA.length >= 3 && vendo === 0;
        txt = `B em pé ${f1((G.t1 - G.t0) / 1000)} s com a cena ${G.cenaIni && G.cenaFim ? 'ativa' : 'NÃO ativa'} (${janB.filter(l => l[10] === 1).length}/${janB.length} quadros em pé; tempo da cena ${tB.length ? `${f2(Math.min(...tB))}–${f2(Math.max(...tB))} s` : '—'}); A em ${janA.length} quadros: avisos ${avisos.map(t => `"${t}"`).join(' · ') || 'nenhum'} ("vendo a cena" em ${vendo})`;
      }
      meta('P8g B em pé na cena dele: a cena de B congela e A, esperando, não lê "Lado 1 ainda está vendo a cena"', txt, ok);
    }
    // P8h: do último quadro da cena de B até o aviso de A sumir, nenhum "não voltou ao jogo"; e o aviso some
    {
      let txt = 'sem a cena de B', ok = false;
      if (jb[0]) {
        const tUlt = LB[jb[0].i1 - 1][0], tFim = jb[0].t1, G = R?.retrato;
        const ini = Math.max(tUlt, G?.t1 != null ? G.t1 + 2000 : 0);
        const depoisA = LA.filter(l => l[0] >= ini);
        const k = depoisA.findIndex(l => l[0] >= tFim && !l[7]);
        const jan = k >= 0 ? depoisA.slice(0, k) : depoisA;
        const nao = jan.filter(l => /não voltou/.test(l[7])).length;
        const avisos = [...new Set(jan.map(l => l[7]).filter(Boolean))];
        ok = k >= 0 && nao === 0 && ini < tFim;
        txt = `A de ${f1((tUlt - (a.V.pulou?.t ?? tUlt)) / 1000)} s depois do pulo até o aviso sumir (${k >= 0 ? `${f1((depoisA[k][0] - tFim) / 1000)} s depois do fim da cena de B` : 'NÃO sumiu'}): ${jan.length} quadros, avisos ${avisos.map(t => `"${t}"`).join(' · ') || 'nenhum'} ("não voltou" em ${nao})`;
      }
      meta('P8h o fim da espera de A pela cena de B: nenhum "ainda não voltou ao jogo" do último quadro da cena de B até o aviso sumir, e o aviso some', txt, ok);
    }
    // P8i: o selo escondido na cena (nas duas abas)
    meta('P8i o selo "Conexão instável" aceso à força dentro da cena: display none nas duas abas (html.em-substituicao)', `A ${a.V.sonda ?? '—'} · B ${b.V.sonda ?? '—'}`, a.V.sonda === 'none' && b.V.sonda === 'none');
  } catch (e) { meta('P8a–P8d execução', String(e?.message ?? e).slice(0, 200), false); }
  // ---- P8e: a cena desligada no anfitrião
  try {
    const r = await sessaoSubst({ semente: SS.semente, min: MIN, substA: false, substB: true, tick: SS.tick });
    const { a, b } = r, LA = a.V.log, LB = b.V.log;
    const cenaQ = LA.filter(l => l[3]).length + LB.filter(l => l[3]).length;
    // a faixa: o 1º quadro com ela e o tick dele (no máximo os passos do quadro depois da troca)
    const fA = LA.find(l => l[9] >= 1), fB = LB.find(l => l[9] >= 1);
    const c = comparar(a, b);
    meta('P8e com a opção desligada no anfitrião (A ?substituicao=0, B ?substituicao=1): nenhuma abre a cena, as duas mostram só a faixa ENTRA/SAI (2 pares) na troca, o jogo segue e os hashes ficam iguais',
      `ligada ${a.ligada}/${b.ligada}; quadros com cena ${cenaQ}; faixa A ${fA ? `no tick ${fA[2]} (${fA[9]} pares)` : 'NÃO'} · B ${fB ? `no tick ${fB[2]} (${fB[9]} pares)` : 'NÃO'} (Node: troca no ${SS.tick}); trocas ${a.feitas.join('+')} / ${b.feitas.join('+')}; depois ${a.n}/${b.n} passos; hashes ${c.difs} diferentes de ${c.comuns}`,
      r.ok.every(Boolean) && a.ligada === false && b.ligada === false && cenaQ === 0 && !!fA && !!fB && fA[2] >= SS.tick && fA[2] <= SS.tick + 6 && fB[2] >= SS.tick && fB[2] <= SS.tick + 6
      && fA[9] === 2 && fB[9] === 2 && a.feitas.join() === '1,1' && b.feitas.join() === '1,1' && c.comuns >= 5 && c.difs === 0 && !a.dessinc && !b.dessinc);
  } catch (e) { meta('P8e execução', String(e?.message ?? e).slice(0, 200), false); }
}
