// Condução curta (pedido do dono, 12/10: "em tese é uma condução mais curtinha, com a bola mais no pé"): mede a
// distância bola–pé, a bola–corpo e o comprimento do toque por faixa de velocidade, no humano sozinho e na IA, e
// confere as metas da especificação da condução curta (CONTRATOS.md, "Condução"; PESQUISA.md, "Condução curta").
//
//  A. Humano sozinho: andando (analógico 0,3), trote (0,5), corrida (1,0) e disparada (CORRER) × reta e curva de
//     30°/s × parado e embalado × dois sentidos. Por cena, só a faixa de velocidade dela (< 2 · 2–4 · 4–6,5 ·
//     > 6,5 m/s). Por tick: bola–corpo (centro do quadril), bola–pé na POSE (centro da bola ao segmento
//     tornozelo–ponta mais perto, no chão) e quanto a bola está à frente. Por intervalo entre dois toques seguidos:
//     metros do corpo, segundos, passadas e a folga (o maior "à frente" no intervalo). Toques por passada acima de
//     7 m/s contados como no teste-conducao.
//  B. Escada: os metros por toque crescem com a velocidade (andar < trote < corrida < disparada) e a disparada
//     fica ≥ 1,3× a corrida (com CORRER, um toque por passada, mais longo — como no jogo real).
//  C. IA × IA: N partidas de 2 × 2 min (semente 1000 + 17·s, s = 1…N; 48 no CI desde 28/10, em até 4 processos — 12 de
//     15/10 a 28/10; com 6, a mediana da corrida variava ±0,01 m só pelo sorteio dos lances): bola–corpo do condutor de
//     linha (bola no chão, jogo rolando) e a % do tempo com a bola a mais de 0,7 m, por faixa. AMOSTRA (C1, 28/10): a
//     mediana de uma partida varia ~2,2–2,4 cm de uma para outra — o erro-padrão de 12 partidas é ~0,65 cm, e o calculado
//     nas mesmas 12 oscila (0,38 cm nas sementes 1–12 do goleiro realista). Em 96 partidas a main 500c4b1a e o goleiro
//     realista 0537a78f dão o mesmo trote (0,5836 × 0,5840 m; pareado por semente −0,0004 ± 0,0027) e a mesma corrida
//     (0,5731 × 0,5715; −0,0015 ± 0,0025); com 12 o goleiro realista caiu em 0,5964 ± 0,0038 no trote (s 1–12 é o mais
//     alto dos 8 blocos de 12) e reprovou. Por reamostragem das 96, o trote reprova por sorteio em ~1% das mudanças de
//     estado da IA × IA com 12 partidas e em ~0% com 48. A CORRIDA fica em cima da meta: a main dá 0,5722 ± 0,0017 em
//     144 sementes (0,5726 nas 1–48, 0,568 nas 97–144; z 1,28 contra 0,57: provável, não provado) e, por reamostragem
//     das 144, reprova ~11% das mudanças de estado com 12 partidas e ~16% com 48 (o goleiro realista ~5%) — com mais
//     partidas a amostra vê melhor que ela está acima, a meta não fica mais frouxa. Nas mesmas 48 sementes 1–48: 0,5574 ± 0,0034 na #476 dc829fa5 (quando a
//     meta entrou) e 0,5570 ± 0,0030 logo antes da #481; a #481 278ff4b5 (faltas com sentido + "ninguém passa da bola
//     quase dominada", que mexeu na conducao.js) levou a 0,5711 ± 0,0032 (z ≈ 3,2; o trote 0,574 → 0,585) e a amostra de
//     12 não viu (0,566 ± 0,007 nas sementes 1–12); de lá à main 500c4b1a, 0,5711 → 0,5726. PENDENTE: decisão do dono
//     sobre a meta da corrida depois da #481 (a condução não se mexe sem ele).
//  D. Desenho: chuteira (cápsula tornozelo–ponta, na pose) dentro da bola, nos quadros das cenas A — trava contra
//     recuo (61,3% na base, medido no teste-conducao; a meta PENDENTE de ≤ 1% continua lá).
//
//   node tools/teste-conducao-curta.mjs [--js <pasta js>] [--ia N (48)] [--sem0 s (1)] [--par P (até 4)] [--detalhe]
//                                       [--json saida.json]
// Reprova (código 1) se alguma meta não passar. Com --js na lógica de antes do pedido (a base), REPROVA.
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fork } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const NIA = +arg('--ia', 48), SEM0 = +arg('--sem0', 1);
const nPar = Math.max(1, +arg('--par', Math.min(4, os.availableParallelism?.() ?? os.cpus().length)));
const MIN_IA = 2;
const detalhe = args.includes('--detalhe');
const imp = f => import(pathToFileURL(path.join(JS, f)).href);
const SIM = await imp('sim.js'), CFG = await imp('config.js'), ANIM = await imp('anim.js'), PA = await imp('partida.js');
const { PASSO, BOTAO, BOLA } = CFG;
const { pose, J, NJ, SEGMENTOS } = ANIM;
const P = new Float32Array(NJ * 3);
const R_CH = SEGMENTOS.find(sg => sg[0] === J.tornozeloE && sg[1] === J.pontaE)[2];

const FAIXAS = [[0, 2, 'andando < 2 m/s'], [2, 4, 'trote 2–4 m/s'], [4, 6.5, 'corrida 4–6,5 m/s'], [6.5, 99, 'disparada > 6,5 m/s']];
const faixaDe = v => FAIXAS.findIndex(([a, b]) => v >= a && v < b);

function pct(arr, p) {
  if (!arr.length) return NaN;
  const a = Float64Array.from(arr).sort();
  return a[Math.min(a.length - 1, Math.max(0, Math.round((a.length - 1) * p)))];
}
const media = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const f2 = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d).replace('.', ',') : '—');

/** Distância do centro da bola ao segmento tornozelo–ponta do pé p na pose P (d3: em 3D; senão no chão). */
function dSeg(p, b, d3) {
  const a = p ? J.tornozeloD : J.tornozeloE, c = p ? J.pontaD : J.pontaE;
  const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
  const ux = P[c * 3] - ax, uy = d3 ? P[c * 3 + 1] - ay : 0, uz = P[c * 3 + 2] - az;
  const l2 = ux * ux + uy * uy + uz * uz;
  let k = l2 > 1e-12 ? ((b.x - ax) * ux + (d3 ? (b.y - ay) * uy : 0) + (b.z - az) * uz) / l2 : 0;
  k = k < 0 ? 0 : k > 1 ? 1 : k;
  const dx = ax + ux * k - b.x, dy = d3 ? ay + uy * k - b.y : 0, dz = az + uz * k - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Acompanhante de um mundo: chamar depois de cada passo. grupoDe(j, m) → nome do grupo ou null (não mede).
 * Amostras por tick em G[grupo].am = [v, bola–corpo, bola–pé (pose), à frente] e intervalos entre dois toques
 * seguidos do mesmo condutor (sem perder a posse no meio) em G[grupo].iv = [dt, metros do corpo, passadas, folga].
 */
function criarAcomp(G, grupoDe, comPose) {
  let posseAnt = null, seq = 0, caminho = 0;
  const ult = new Map();
  return (m, ev, valido) => {
    const dono = m.posse != null && m.naMao == null ? SIM.jogadorPorId(m, m.posse) : null;
    const id = dono && valido ? dono.id : null;
    if (id !== posseAnt) { seq++; posseAnt = id; caminho = 0; }
    if (id == null) return;
    const g = grupoDe(dono, m);
    if (!g) return;
    const j = dono, b = m.bola.p;
    if (b.y > 0.3) return;
    const v = Math.hypot(j.vx, j.vz);
    caminho += v * PASSO;
    const ex = b.x - j.x, ez = b.z - j.z;
    const fr = ex * Math.cos(j.rumo) + ez * Math.sin(j.rumo);
    let dPe = NaN;
    if (comPose) { pose(j, m, P); dPe = Math.min(dSeg(0, b, false), dSeg(1, b, false)); }
    const grp = (G[g] ??= { am: [], iv: [] });
    grp.am.push([v, Math.hypot(ex, ez), dPe, fr]);
    const u = ult.get(j.id);
    if (u && u.seq === seq && fr > u.folga) u.folga = fr;
    for (const e of ev) {
      if (e.tipo !== 'toque' || e.id !== j.id) continue;
      const cu = j.cond.ult;
      if (!cu) continue;
      if (u && u.seq === seq && ['conducao', 'ajuste', 'protecao', 'dominio'].includes(u.tipo)) {
        const dt = (cu.tick - u.tick) * PASSO;
        if (dt > 0 && dt <= 3) grp.iv.push([dt, caminho - u.caminho, (j.fase - u.fase) / 2, u.folga]);
      }
      ult.set(j.id, { seq, tick: cu.tick, fase: j.fase, caminho, folga: -Infinity, tipo: e.modo });
    }
  };
}

// ------------------------------------------------------------------ A. humano sozinho
const ANDARES = {
  andar: { mag: 0.3, botoes: 0, faixa: 0 },
  trote: { mag: 0.5, botoes: 0, faixa: 1 },
  corrida: { mag: 1, botoes: 0, faixa: 2 },
  disparada: { mag: 1, botoes: BOTAO.CORRER, faixa: 3 },
};
/** A parte A inteira: os grupos por andar e as contagens da disparada e da chuteira. */
function parteA() {
  const GS = {};
  let quadros = 0, dentro = 0, toques7 = 0, passadas7 = 0;
  let k = 0;
  for (const [nome, a] of Object.entries(ANDARES)) for (const caminho of ['reta', 'curva']) for (const partida of ['parado', 'embalado']) for (const sentido of [1, -1]) {
    const devagar = nome === 'andar' || nome === 'trote';
    const pos = caminho === 'curva' ? { x0: devagar ? 0 : -6, z0: -sentido * (devagar ? 3 : 8), r0: 0 }
      : sentido > 0 ? { x0: -52, z0: 20, r0: 0 } : { x0: 40, z0: -30, r0: Math.PI * 0.75 };
    const aquec = partida === 'embalado' ? 3 : 0;
    const m = SIM.criarMundo({ semente: 17 + k++, jogadores: [{ id: 0, x: pos.x0, z: pos.z0, rumo: pos.r0 }], bola: { x: pos.x0 + Math.cos(pos.r0) * 0.4, z: pos.z0 + Math.sin(pos.r0) * 0.4 }, posse: 0, log: true });
    const j = m.jogadores[0];
    const w = (30 / 180 * Math.PI) * sentido;
    const ac = criarAcomp(GS, (jj) => (Math.hypot(jj.vx, jj.vz) >= 0 ? nome : null), true);
    const N = Math.round((aquec + 9) / PASSO), i0 = Math.round((aquec + 0.5) / PASSO);
    let nLog = 0;
    for (let i = 0; i < N; i++) {
      const t = i * PASSO;
      const r = pos.r0 + (caminho === 'curva' && t >= aquec ? w * (t - aquec) : 0);
      const fase0 = j.fase;
      SIM.passo(m, { 0: { x: Math.cos(r) * a.mag, z: Math.sin(r) * a.mag, botoes: a.botoes } });
      const medir = i >= i0;
      ac(m, m.eventos, medir);
      if (!medir) { nLog = m.log.length; continue; }
      // toques por passada acima de 7 m/s (a mesma conta do teste-conducao)
      if (Math.hypot(j.vx, j.vz) > 7) passadas7 += (j.fase - fase0) / 2;
      for (; nLog < m.log.length; nLog++) if (m.log[nLog].s > 7) toques7++;
      // chuteira dentro da bola (pose do fim do passo, a mesma que o acompanhante desenhou)
      if (m.posse === 0) {
        quadros++;
        if (Math.min(dSeg(0, m.bola.p, true), dSeg(1, m.bola.p, true)) < BOLA.raio + R_CH) dentro++;
      }
    }
  }
  return { GS, quadros, dentro, toques7, passadas7 };
}

/** Resumo de um grupo na faixa k. */
function resumo(grp, k) {
  const am = grp ? grp.am.filter(a => faixaDe(a[0]) === k) : [];
  const iv = grp ? grp.iv.filter(x => faixaDe(x[1] / x[0]) === k) : [];
  const dts = iv.reduce((s, x) => s + x[0], 0), pas = iv.reduce((s, x) => s + x[2], 0);
  return {
    n: am.length, nI: iv.length,
    dC: [pct(am.map(a => a[1]), 0.5), pct(am.map(a => a[1]), 0.9)],
    dPe: [pct(am.map(a => a[2]), 0.5), pct(am.map(a => a[2]), 0.9)],
    longe: am.length ? am.filter(a => a[1] > 0.7).length / am.length : NaN,
    mMed: pct(iv.map(x => x[1]), 0.5), mMedia: media(iv.map(x => x[1])),
    toquesS: dts > 0 ? iv.length / dts : NaN, toquesPassada: pas > 0 ? iv.length / pas : NaN,
    folga: [pct(iv.map(x => x[3]), 0.5), pct(iv.map(x => x[3]), 0.9)],
  };
}

// ------------------------------------------------------------------ C. IA × IA
/** Uma partida IA × IA da parte C (semente 1000 + 17·s): as amostras e os intervalos dos condutores de linha. */
function partidaIA(s) {
  const GI = {};
  const m = PA.criarPartida({ semente: 1000 + s * 17, minutosPorTempo: MIN_IA });
  const ac = criarAcomp(GI, j => (j.posicao === 'GOL' ? null : 'IA'), false);
  const N = Math.round(2 * MIN_IA * 3600) + 600;
  for (let i = 0; i < N; i++) {
    const ev = PA.passoPartida(m, PA.entradaDemoPartida(m));
    const valido = m.partida.estado === 'jogo' && !(m.parada && !m.parada.rolou);
    ac(m, ev, valido);
    if (m.partida.estado === 'fim') break;
  }
  return GI.IA ?? null;
}

// processo filho (--par > 1): recebe a semente s de cada partida da parte C e devolve o resultado; null = acabou (o mesmo
// processo roda várias partidas: um processo por partida gastava ~2 s a mais em cada uma, carregando e aquecendo o código)
if (args.includes('--filho')) {
  process.on('message', s => { if (s == null) process.exit(0); else process.send(partidaIA(s)); });
  await new Promise(() => {}); // (o resto do arquivo é do pai)
}

// as NIA partidas em nPar processos (como o teste-intercepta e o teste-movimento; o rodar-testes passa --par k) e a parte
// A (~2 s) no pai enquanto isso; o resultado é o mesmo de rodar tudo num processo só (--par 1): cada partida começa do
// zero e as amostras são juntadas na ordem das sementes
const t0 = Date.now();
const resIA = new Array(NIA);
let filaIA = Promise.resolve();
if (nPar <= 1) for (let i = 0; i < NIA; i++) resIA[i] = partidaIA(SEM0 + i);
else {
  let prox = 0;
  const filhos = new Set();
  const sair = cod => { for (const c of filhos) c.kill(); process.exit(cod); };
  process.on('SIGINT', () => sair(130)); process.on('SIGTERM', () => sair(143));
  filaIA = Promise.all(Array.from({ length: Math.min(nPar, NIA) }, () => new Promise((ok, erro) => {
    // ('advanced': a bola–pé da IA, NaN, chega NaN — em JSON viraria null)
    const c = fork(fileURLToPath(import.meta.url), ['--filho', '--js', JS], { serialization: 'advanced' });
    filhos.add(c);
    let i = -1;
    const proxima = () => { if (prox >= NIA) { i = -1; c.send(null); } else { i = prox++; c.send(SEM0 + i); } };
    c.on('message', r => { resIA[i] = r; proxima(); });
    c.on('error', erro);
    c.on('exit', (cod, sinal) => { filhos.delete(c); if (cod || sinal || i >= 0) erro(new Error(`parte C: um processo saiu com ${cod ?? sinal}`)); else ok(); });
    proxima();
  })));
}
const { GS, quadros, dentro, toques7, passadas7 } = parteA();
const A = Object.fromEntries(Object.entries(ANDARES).map(([n, a]) => [n, resumo(GS[n], a.faixa)]));
const tPorPassada7 = passadas7 > 0 ? toques7 / passadas7 : NaN;
const pDentro = quadros ? 100 * dentro / quadros : NaN;
await filaIA;
const sTudo = (Date.now() - t0) / 1000;

const GI = {};
const bordasIA = [];   // onde cada partida começa em GI.IA.am (o erro-padrão da mediana pelas partidas)
for (const r of resIA) {
  bordasIA.push(GI.IA?.am.length ?? 0);
  if (!r) continue;
  GI.IA ??= { am: [], iv: [] };
  for (const x of r.am) GI.IA.am.push(x);
  for (const x of r.iv) GI.IA.iv.push(x);
}
const IA = FAIXAS.map((_, k) => resumo(GI.IA, k));
// a mediana de cada partida na faixa k e o erro-padrão entre elas: a meta da IA reprova quando a conta prova (a mediana
// acima do teto por mais de 1,645 erros-padrão) — a IA × IA muda de estado a cada mudança da IA e a mediana de N partidas
// oscila ~2,3/√N cm em volta do valor da versão (~0,65 cm com 12, ~0,33 com 48); o teto é o valor medido quando ele entrou
function epMediana(k) {
  const am = GI.IA?.am ?? [], meds = [];
  for (let i = 0; i < bordasIA.length; i++) {
    const v = am.slice(bordasIA[i], bordasIA[i + 1] ?? am.length).filter(a => faixaDe(a[0]) === k).map(a => a[1]);
    if (v.length >= 20) meds.push(pct(v, 0.5));
  }
  if (meds.length < 3) return NaN;
  const mu = meds.reduce((x, y) => x + y, 0) / meds.length;
  return Math.sqrt(meds.reduce((x, y) => x + (y - mu) ** 2, 0) / (meds.length - 1) / meds.length);
}
const epIA = FAIXAS.map((_, k) => epMediana(k));
const ateEp = (v, b, ep) => Number.isFinite(v) && Number.isFinite(ep) && v - 1.645 * ep <= b;

// ------------------------------------------------------------------ metas
const metas = [];
const meta = (nome, medido, alvo, ok) => metas.push([nome, medido, alvo, ok]);
const ent = (v, a, b) => Number.isFinite(v) && v >= a && v <= b;
const ate = (v, b) => Number.isFinite(v) && v <= b;
const desde = (v, a) => Number.isFinite(v) && v >= a;
// A. andando
meta('A andando: metros do corpo entre toques (mediana)', `${f2(A.andar.mMed)} m`, '≤ 0,90', ate(A.andar.mMed, 0.9));
meta('A andando: ritmo', `${f2(A.andar.toquesS)} toques/s`, '≥ 2,0', desde(A.andar.toquesS, 2.0));
// trote
meta('A trote: ritmo', `${f2(A.trote.toquesS)} toques/s`, '2,3–3,1 (Zago 2016)', ent(A.trote.toquesS, 2.3, 3.1));
meta('A trote: metros do corpo entre toques (mediana)', `${f2(A.trote.mMed)} m`, '≤ 1,2', ate(A.trote.mMed, 1.2));
meta('A trote: bola–corpo (mediana / p90)', `${f2(A.trote.dC[0])} / ${f2(A.trote.dC[1])} m`, '≤ 0,45 / ≤ 0,48', ate(A.trote.dC[0], 0.45) && ate(A.trote.dC[1], 0.48));
meta('A trote: folga (maior à frente entre toques, mediana)', `${f2(A.trote.folga[0])} m`, '≤ 0,45', ate(A.trote.folga[0], 0.45));
// (a especificação pedia mediana ≤ 0,08 m, medida com a chuteira ENTRANDO na bola; com ela parando na superfície —
// jogador.js passoPeDesenhado, commit 2/7 — o pé encostado fica a ~0,13 m do centro na horizontal: a mesma lógica de
// antes com o desenho novo dá 0,14 / 0,23)
meta('A trote: bola–pé na pose (mediana / p90)', `${f2(A.trote.dPe[0])} / ${f2(A.trote.dPe[1])} m`, '≤ 0,12 / ≤ 0,16 (o pé na superfície da bola)', ate(A.trote.dPe[0], 0.12) && ate(A.trote.dPe[1], 0.16));
// corrida
meta('A corrida: ritmo', `${f2(A.corrida.toquesS)} toques/s`, '2,2–2,9', ent(A.corrida.toquesS, 2.2, 2.9));
meta('A corrida: metros do corpo por toque (média)', `${f2(A.corrida.mMedia)} m`, '1,8–2,6', ent(A.corrida.mMedia, 1.8, 2.6));
meta('A corrida: toques por passada', f2(A.corrida.toquesPassada), '1,3–1,8', ent(A.corrida.toquesPassada, 1.3, 1.8));
meta('A corrida: bola–corpo (mediana / p90)', `${f2(A.corrida.dC[0])} / ${f2(A.corrida.dC[1])} m`, '≤ 0,52 / ≤ 0,64', ate(A.corrida.dC[0], 0.52) && ate(A.corrida.dC[1], 0.64));
meta('A corrida: folga (mediana / p90)', `${f2(A.corrida.folga[0])} / ${f2(A.corrida.folga[1])} m`, '≤ 0,55 / ≤ 0,65', ate(A.corrida.folga[0], 0.55) && ate(A.corrida.folga[1], 0.65));
meta('A corrida: bola–pé na pose (p90)', `${f2(A.corrida.dPe[1])} m`, '≤ 0,22', ate(A.corrida.dPe[1], 0.22));
// disparada
meta('A disparada: toques por passada acima de 7 m/s', f2(tPorPassada7), '0,8–1,20 (teste-conducao: 0,8–1,25)', ent(tPorPassada7, 0.8, 1.2));
meta('A disparada: metros do corpo por toque (média)', `${f2(A.disparada.mMedia)} m`, '≥ 2,9 (Preissler 2023: 2,5–4 m)', desde(A.disparada.mMedia, 2.9));
meta('A disparada: bola–corpo (mediana / p90)', `${f2(A.disparada.dC[0])} / ${f2(A.disparada.dC[1])} m`, '≤ 0,66 / ≤ 0,76', ate(A.disparada.dC[0], 0.66) && ate(A.disparada.dC[1], 0.76));
meta('A disparada: folga (p90; alcance do pé 0,78)', `${f2(A.disparada.folga[1])} m`, '≤ 0,78', ate(A.disparada.folga[1], 0.78));
// B. escada
const esc = [A.andar.mMedia, A.trote.mMedia, A.corrida.mMedia, A.disparada.mMedia];
meta('B escada: metros por toque andar < trote < corrida < disparada (médias)', esc.map(v => f2(v)).join(' < '), 'crescente', esc.every((v, i) => Number.isFinite(v) && (i === 0 || v > esc[i - 1])));
meta('B escada: disparada ÷ corrida (metros por toque)', f2(A.disparada.mMedia / A.corrida.mMedia), '≥ 1,3', desde(A.disparada.mMedia / A.corrida.mMedia, 1.3));
// C. IA
meta(`C IA × IA (${NIA} partidas): trote, bola–corpo (mediana)`, `${f2(IA[1].dC[0], 3)} ± ${f2(epIA[1], 3)} m`, '≤ 0,59 (reprova quando prova: z > 1,645)', ateEp(IA[1].dC[0], 0.59, epIA[1]));
meta(`C IA × IA: trote, tempo com a bola a mais de 0,7 m`, `${f2(100 * IA[1].longe, 0)}%`, '≤ 30%', ate(100 * IA[1].longe, 30));
meta(`C IA × IA: corrida, bola–corpo (mediana)`, `${f2(IA[2].dC[0], 3)} ± ${f2(epIA[2], 3)} m`, '≤ 0,57 (reprova quando prova: z > 1,645)', ateEp(IA[2].dC[0], 0.57, epIA[2]));
// D. desenho
meta('D chuteira dentro da bola (quadros das cenas A, pose)', `${f2(pDentro, 1)}%`, '≤ 61,3% (sem recuo; PENDENTE ≤ 1% no teste-conducao)', ate(pDentro, 61.3));

// ------------------------------------------------------------------ saída
const tab = l => { const w = []; for (const x of l) x.forEach((c, i) => { w[i] = Math.max(w[i] ?? 0, String(c).length); }); return l.map(x => x.map((c, i) => String(c).padEnd(w[i])).join('  ')).join('\n'); };
console.log(`Condução curta — lógica de ${JS}\n`);
const l1 = [['humano sozinho', 'toques/s', 'm entre toques (med · média)', 'toques/passada', 'bola–corpo med/p90', 'folga med/p90', 'bola–pé (pose) med/p90', 'intervalos']];
for (const [n, r] of Object.entries(A)) l1.push([`${n} (${FAIXAS[ANDARES[n].faixa][2]})`, f2(r.toquesS), `${f2(r.mMed)} · ${f2(r.mMedia)}`, f2(r.toquesPassada), `${f2(r.dC[0])} / ${f2(r.dC[1])}`, `${f2(r.folga[0])} / ${f2(r.folga[1])}`, `${f2(r.dPe[0])} / ${f2(r.dPe[1])}`, r.nI]);
console.log(tab(l1));
console.log('');
const l2 = [[`IA × IA (${NIA} × 2 × ${MIN_IA} min, s ${SEM0}–${SEM0 + NIA - 1}; ${f2(sTudo, 0)} s em ${Math.max(1, Math.min(nPar, NIA))} proc.)`, 'tempo', 'bola–corpo med/p90', 'bola > 0,7 m', 'm entre toques (med)', 'toques/s']];
const nIA = IA.reduce((s, r) => s + r.n, 0);
IA.forEach((r, k) => l2.push([FAIXAS[k][2], `${f2(100 * r.n / Math.max(1, nIA), 0)}%`, `${f2(r.dC[0])} / ${f2(r.dC[1])}`, `${f2(100 * r.longe, 0)}%`, f2(r.mMed), f2(r.toquesS)]));
console.log(tab(l2));
console.log('');
console.log(tab([['Meta', 'Medido', 'Alvo', 'Resultado'], ...metas.map(m => [m[0], m[1], m[2], m[3] ? 'PASSOU' : 'REPROVOU'])]));
const ok = metas.every(m => m[3]);
if (arg('--json', null)) fs.writeFileSync(arg('--json'), JSON.stringify({ js: JS, A, IA, toquesPorPassada7: tPorPassada7, chuteiraDentro: pDentro, metas: metas.map(m => ({ meta: m[0], medido: m[1], alvo: m[2], ok: m[3] })) }, null, 1));
if (detalhe) for (const [n, g] of Object.entries(GS)) console.log(n, 'amostras', g.am.length, 'intervalos', g.iv.length);
console.log(ok ? '\nteste-conducao-curta: PASSOU' : `\nteste-conducao-curta: REPROVOU (${metas.filter(m => !m[3]).length})`);
process.exit(ok ? 0 : 1);
