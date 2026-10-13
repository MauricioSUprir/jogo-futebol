// Cenas de CARTÃO e de FIM DE TEMPO e os cortes de TORCIDA e TREINADOR no gol (pedido do dono de 12/10: "temos que ter
// cenas de final de primeiro tempo, final de segundo tempo, cartão amarelo (3 cenas diferentes) e cartão vermelho (outras
// 3 cenas diferentes). Quando sai gol, pode ter cenas de torcida e treinador comemorando"). Contas PURAS em Node
// (js/cena-atores.js, js/cena-cartao.js, js/cena-fim.js, js/comemoracao.js, render/emocao.js):
//   A) canhão de cartões a partir de estados do MEIO da partida (montarFalta + regrasPartida, como o teste-faltas): 8
//      estados × 6 situações (amarelo; vermelho direto; 2º amarelo; pênalti com amarelo; vantagem → gol, com a cena
//      montada em gol + 149; goleiro expulso) × 3 variações forçadas = 144 cenas; por tick: árbitro (mão do cartão
//      ≥ 0,25 m acima do topo da cabeça ≥ 1,2 s contínuos, 1,5–3,2 m do punido, o cartão a ≤ 35° da câmera no plano
//      'arbitro'), IFAB (A1, V2: só o capitão e o punido a < 4 m do árbitro), as assinaturas das 6 variações, o expulso
//      (termina com z > 34, chegando ao túnel em todo o P3b), corpo (NaN, ossos ±0,5 cm, pé plantado ≤ 0,05 m/s, pé no ar
//      pela régua do teste-patinacao, pelves ≥ 0,4 m, todo salto > 0,5 m/tick junto com um corte), câmera (nunca dentro
//      de sólido nem do gol, ≤ 5,5 m além das linhas, lente ≥ 2,5 m, o punido no quadro ≥ 95% em 16:9 e 844/390 com
//      ≥ 25% da altura no plano 'reacao') e as durações;
//   B) variedade: escolherVariante em 2000 sequências (amarelo, vermelho e o enquadramento da torcida com memórias
//      separadas): nunca a mesma seguida; em 100 cartões seguidos cada variação ≥ 25%; exclusão por falta de companheiro
//      ≤ 10% no canhão A;
//   C) fim de tempo: 8 estados do meio × {intervalo, vitória da casa, derrota da casa, empate}: 2 s depois do apito
//      ninguém acima de 1,6 m/s; ≥ 60% com as mãos na cintura no P2; ≥ 2 (intervalo) / ≥ 3 (fim) apertos de mão; no P3
//      ≥ 80% chegando ao túnel; vitória: ≥ 3 com os dois pulsos acima da cabeça; derrota: ≥ 3 cabisbaixos ou com as mãos
//      na cabeça/joelhos; empate: ninguém com as duas mãos acima da cabeça por > 0,5 s; corpo e câmera; o treinador pelo
//      gancho (um técnico falso: +2,0 s; null: nenhum buraco);
//   D) gol: as 8 cenas do teste-comemoracao com a fase de câmera 'torcida' entre o abraço e a reação (0,8–1,5 s), os
//      atores e o kFim IDÊNTICOS aos da cena sem os cortes (opc.cortes = false), a câmera na torcida do time que marcou
//      (≤ 30°), baixa (≤ 2 m), fov 30–40, fora dos sólidos; o gancho do treinador (+90 ticks exatos, braços acima da
//      cabeça ≥ 0,5 s, dentro da área técnica; null: nada muda); a cena curta não muda;
//   E) pureza: hashMundo antes = depois de cada cena (A, C e D);
//   F) relógio do estádio: relogioEstadio anda com o laço segurado (a festa — bandeirão, fogo dos sinalizadores — anda
//      junto) e, sem espera, é o relógio de antes (idêntico);
//   G) custo: p95 ms/tick ≤ 0,6 (25 atores).
// Na base (sem os módulos) cada seção REPROVA com o motivo.
//   node tools/teste-cenas.mjs [--js <pasta js>] [--so A,B,...] [--detalhe]
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const pastaJs = args.includes('--js') ? path.resolve(args[args.indexOf('--js') + 1]) : path.resolve(AQUI, '../js');
const SO = args.includes('--so') ? new Set(args[args.indexOf('--so') + 1].split(',')) : null;
const detalhe = args.includes('--detalhe');
const imp = f => import(pathToFileURL(path.join(pastaJs, f)).href);
async function tentar(f) { try { return await imp(f); } catch (e) { if (detalhe) console.log(`(${f}: ${e.message})`); return null; } }
const roda = s => !SO || SO.has(s);

const linhas = [];
let falhas = 0;
const f2 = v => (Number.isFinite(v) ? v.toFixed(2) : String(v));
const f3 = v => (Number.isFinite(v) ? v.toFixed(3) : String(v));
function reg(nome, medido, meta, ok, info = false) { linhas.push({ nome, medido, meta, ok: !!ok, info }); if (!ok && !info) falhas++; }
function imprimir() {
  const larg = Math.max(...linhas.map(l => l.nome.length));
  for (const l of linhas) console.log(`${l.info ? 'INFO    ' : l.ok ? 'PASSOU  ' : 'REPROVOU'}  ${l.nome.padEnd(larg)}  ${l.medido}   (meta: ${l.meta})`);
  console.log(falhas ? `\nteste-cenas: REPROVOU (${falhas})` : '\nteste-cenas: PASSOU');
}

const C = await imp('config.js');
const { PASSO } = C;
const EMO = await tentar('render/emocao.js');
const FE = await tentar('render/festa.js');

// ------------------------------------------------------------------------------------------------ F) relógio do estádio
if (roda('F')) {
  if (!EMO || typeof EMO.relogioEstadio !== 'function') {
    reg('F relógio do estádio (render/emocao.js relogioEstadio)', 'não existe: com o laço segurado (cena, replay, comemoração parada) bandeiras, bandeirão, sinalizadores e ola ficam CONGELADOS no último passo', 'existe e anda no dt do desenho', false);
  } else {
    // F1: anda com o laço segurado (300 quadros de 1/60 s = 5 s), parado sem ele
    const est = EMO.criarRelogioEstadio();
    est.tSim = 42;
    let t0 = EMO.relogioEstadio(est, 0, false), mono = true, ult = t0;
    for (let i = 0; i < 300; i++) { const t = EMO.relogioEstadio(est, 1 / 60, true); if (!(t > ult)) mono = false; ult = t; }
    const andou = ult - t0;
    let parado = true;
    for (let i = 0; i < 60; i++) if (EMO.relogioEstadio(est, 1 / 60, false) !== ult) parado = false;
    reg('F1 relógio do estádio com o laço segurado: anda pelo dt do desenho', `${f3(andou)} s em 300 quadros de 1/60 s (sempre subindo: ${mono}); sem segurar, parado: ${parado}`, '5,000 s; subindo; parado sem segurar', Math.abs(andou - 5) < 1e-9 && mono && parado);
    // F2: sem espera é o relógio de antes (passos × 1/60 s), número a número
    const e2 = EMO.criarRelogioEstadio();
    let dif = 0;
    for (let k = 0; k < 20000; k++) { e2.tSim = k * PASSO; if (EMO.relogioEstadio(e2, 0, false) !== k * PASSO) dif++; }
    reg('F2 sem espera o relógio do estádio é o de antes (idêntico)', `${dif} diferentes em 20000 passos`, '0', dif === 0);
    // F3: a festa anda durante a espera — gol da casa, depois 4 s com o laço segurado: o bandeirão abre, o fogo dos
    // sinalizadores muda e a ola/os cantos andam (antes: o t da festa ficava no do último passo — tudo parado)
    const emo = EMO.criarEmocao(), rel = EMO.criarRelogioEstadio();
    const ctx = { t: 0, timeDe: () => 0, bola: { x: 50, y: 0.11, z: 0 }, ataca: { 0: 1, 1: -1 } };
    const passo = { t: 0, bola: ctx.bola, posseTime: 0, ataca: ctx.ataca, estado: 'jogo' };
    for (let k = 1; k <= 120; k++) { rel.tSim = k * PASSO; passo.t = EMO.relogioEstadio(rel, 0, false); EMO.emocaoPasso(emo, passo, PASSO); }
    ctx.t = rel.tSim; EMO.emocaoEvento(emo, { tipo: 'gol', time: 0 }, ctx);
    passo.estado = 'gol';
    const abre = new Set(), fogo = new Set(), tsF = new Set();
    for (let q = 0; q < 240; q++) {
      passo.t = EMO.relogioEstadio(rel, 1 / 60, true);
      EMO.emocaoPasso(emo, passo, 1 / 60);
      tsF.add(emo.festa.t);
      abre.add(FE.aberturaBandeirao(emo.festa, emo.t).toFixed(4));
      let f = 0; for (const s of emo.festa.flares) f += FE.fogoSinalizador(s, emo.t);
      fogo.add(f.toFixed(4));
    }
    reg('F3 a festa anda com o laço segurado (gol da casa e 4 s de espera)', `relógio da festa ${tsF.size} valores; abertura do bandeirão ${abre.size} valores; fogo dos sinalizadores ${fogo.size} valores (em 240 quadros)`, '≥ 200, ≥ 60, ≥ 100', tsF.size >= 200 && abre.size >= 60 && fogo.size >= 100);
  }
}

// ------------------------------------------------------------------------------------------------ medidas comuns
const A = await imp('anim.js');
const S = await imp('sim.js');
const G = await imp('goleiro.js');
const EF = await imp('estadio-forma.js');
const { J, NJ } = A;
const { JOGADOR, CAMPO } = C;
const MX = CAMPO.meioX, MZ = CAMPO.meioZ;
const TORN = JOGADOR.alturaTornozelo;
const TOPO = A.RAIO_CABECA * 1.1;   // o topo da cabeça desenhada (jogador3d.js: a esfera com 1,1·R na vertical)
const ossos = [[J.quadrilE, J.joelhoE, JOGADOR.coxa], [J.joelhoE, J.tornozeloE, JOGADOR.canela], [J.quadrilD, J.joelhoD, JOGADOR.coxa], [J.joelhoD, J.tornozeloD, JOGADOR.canela],
  [J.ombroE, J.cotoveloE, A.BRACO], [J.cotoveloE, J.maoE, A.ANTEBRACO], [J.ombroD, J.cotoveloD, A.BRACO], [J.cotoveloD, J.maoD, A.ANTEBRACO]];
const dist3 = (o, a, b) => Math.hypot(o[a * 3] - o[b * 3], o[a * 3 + 1] - o[b * 3 + 1], o[a * 3 + 2] - o[b * 3 + 2]);
const TORNS = [J.tornozeloE, J.tornozeloD];
const LENTE = [J.pelve, J.peito, J.cabeca, J.joelhoE, J.joelhoD];
const ASPECTOS = [['PC', false, 16 / 9], ['celular', true, 844 / 390]];
const p95 = arr => { if (!arr.length) return 0; const v = [...arr].sort((a, b) => a - b); return v[Math.min(v.length - 1, Math.floor(0.95 * v.length))]; };
const difAng = (a, b) => { let d = (b - a) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI; return d; };

/** Projeção (a do three.js lookAt + perspectiva) de um ponto no plano de câmera pc ({de, para, fov}) com o aspecto: [x, y, z]. */
function projetor(pc, aspecto) {
  const f = [pc.para[0] - pc.de[0], pc.para[1] - pc.de[1], pc.para[2] - pc.de[2]];
  const lf = Math.hypot(...f); f[0] /= lf; f[1] /= lf; f[2] /= lf;
  const lr = Math.hypot(f[2], f[0]) || 1, r = [-f[2] / lr, 0, f[0] / lr];
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const tv = Math.tan((pc.fov * Math.PI) / 360), th = tv * aspecto;
  return (x, y, z, out) => {
    const d0 = x - pc.de[0], d1 = y - pc.de[1], d2 = z - pc.de[2];
    const zz = d0 * f[0] + d1 * f[1] + d2 * f[2];
    out[0] = (d0 * r[0] + d1 * r[1] + d2 * r[2]) / (zz * th); out[1] = (d0 * u[0] + d1 * u[1] + d2 * u[2]) / (zz * tv); out[2] = zz;
    return out;
  };
}
const _pr = [0, 0, 0];
/** O ator (pose o) no quadro com margem m (fração): {dentro, altura (fração do quadro)}. */
function noQuadro(proj, o, margem = 0.05) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, atras = false;
  for (let i = 0; i <= NJ; i++) {
    const k = i < NJ ? i : J.cabeca;
    proj(o[k * 3], o[k * 3 + 1] + (i === NJ ? TOPO : 0), o[k * 3 + 2], _pr);
    if (_pr[2] <= 0.1) { atras = true; continue; }
    x0 = Math.min(x0, _pr[0]); x1 = Math.max(x1, _pr[0]); y0 = Math.min(y0, _pr[1]); y1 = Math.max(y1, _pr[1]);
  }
  const L = 1 - 2 * margem;
  return { dentro: !atras && x0 >= -L && x1 <= L && y0 >= -L && y1 <= L, altura: (y1 - y0) / 2 };
}

/**
 * Anda uma cena tick a tick medindo o comum (corpo e câmera): NaN, ossos, pé plantado e no ar (a régua do
 * teste-patinacao; fora do tick da elipse de quem foi recriado), pelves, saltos > 0,5 m num tick só com corte, câmera
 * (sólido, limites, gol, lente) e o assunto no quadro nos planos `planosAssunto`. por(c, t, fase) mede o específico.
 */
function andarCena(c, fns, opc) {
  const r = { nan: 0, osso: 0, plantado: 0, razao: 0, pelve: Infinity, saltoSemCorte: 0, piorSalto: null, piorPe: null, piorPelve: null, solido: 0, foraLimite: 0, noGol: 0, lente: Infinity, piorLente: null, quadro: {}, altura: [], ticks: 0, fases: [], ms: [] };
  const n0 = c.atores.length;
  const ant = new Map();
  const pcs = ASPECTOS.map(() => fns.criarPlano());
  let faseAnt = null;
  while (!c.acabou && r.ticks < (opc.max ?? 20 * 60)) {
    const nomeAntes = faseAnt;
    const t0 = performance.now();
    fns.passo(c);
    r.ms.push(performance.now() - t0);
    r.ticks++;
    const t = c.k * PASSO;
    c.alfa = 1;
    // câmera nos dois aspectos
    let nome = null;
    ASPECTOS.forEach(([nm, pequena, aspecto], k) => {
      const pc = fns.planoCamera(c, { pequena, aspecto }, pcs[k]);
      nome = pc.nome;
      if (pc.nome === 'fim' || pc.nome === 'geral') return;
      const [x, y, z] = pc.de;
      if (EF.solidoEm(x, y, z, 0.2, false)) { r.solido++; r.piorSolido = { nome: pc.nome, de: pc.de.map(v => +v.toFixed(2)), s: EF.solidoEm(x, y, z, 0.2, false) }; }
      if (Math.abs(x) > MX + 5.5 + 1e-6 || Math.abs(z) > MZ + 5.5 + 1e-6) r.foraLimite++;
      if (Math.abs(x) > MX - 0.5 && Math.abs(z) < 4.6) r.noGol++;
      for (const a of c.atores) {
        if (!a.ativo) continue;
        for (const i of LENTE) {
          const d = Math.hypot(a.atu[i * 3] - x, a.atu[i * 3 + 1] - y, a.atu[i * 3 + 2] - z);
          if (d < r.lente) { r.lente = d; r.piorLente = { id: a.id, tipo: a.tipo, plano: pc.nome, t: +t.toFixed(2), d: +d.toFixed(2) }; }
        }
      }
      const sujeito = fns.assunto ? fns.assunto(c, pc.nome) : null;
      if (sujeito) {
        const q = noQuadro(projetor(pc, aspecto), sujeito.atu);
        const ch = `${pc.nome}/${nm}`;
        const qq = r.quadro[ch] ?? (r.quadro[ch] = { n: 0, dentro: 0, altura: [] });
        qq.n++; if (q.dentro) qq.dentro++; qq.altura.push(q.altura);
      }
    });
    if (r.fases[r.fases.length - 1] !== nome) r.fases.push(nome);
    const cortou = nome !== nomeAntes && nomeAntes != null;
    faseAnt = nome;
    // corpo
    for (let i = 0; i < c.atores.length; i++) {
      const a = c.atores[i];
      if (!a.ativo) continue;
      const o = a.atu, j = a.j;
      for (let q = 0; q < NJ * 3; q++) if (!Number.isFinite(o[q])) { r.nan++; break; }
      for (const [x, y, L0] of ossos) r.osso = Math.max(r.osso, Math.abs(dist3(o, x, y) - L0));
      let s0 = ant.get(a);
      const recriado = a.recriado === c.k;
      const v0 = Math.hypot(j.vx, j.vz);
      const merg = a.goleiro && j.mergulho && G.mergulhoAtivo(j, c.mF.tick);
      const pel = [o[J.pelve * 3], o[J.pelve * 3 + 1], o[J.pelve * 3 + 2]];
      if (s0 && !recriado) {
        const salto = Math.hypot(pel[0] - s0.pel[0], pel[2] - s0.pel[2]);
        if (salto > 0.5 && !cortou) { r.saltoSemCorte++; r.piorSalto = { id: a.id, t: +t.toFixed(2), salto: +salto.toFixed(2) }; }
        // (no ar num pulo de festa: os pés saem do chão de propósito, como no pulo do grupo da comemoração)
        if (!merg && !s0.merg && !a.noAr && !s0.noAr) {
          const v = Math.max(v0, s0.v);
          for (let p = 0; p < 2; p++) {
            const it = TORNS[p];
            const d = Math.hypot(o[it * 3] - s0.t[p][0], o[it * 3 + 1] - s0.t[p][1], o[it * 3 + 2] - s0.t[p][2]);
            const vp = d / PASSO, pe = j.pes[p], pa = s0.pes[p];
            if (pa.apoio && pe.apoio && pa.x === pe.x && pa.z === pe.z && vp > r.plantado) { r.plantado = vp; r.piorPlantado = { id: a.id, tipo: a.tipo, t: +t.toFixed(2), vp: +vp.toFixed(3), fixo: a.fixo }; }
            const razao = vp / (2.5 * v + 3);
            if (razao > r.razao) { r.razao = razao; r.piorPe = { id: a.id, tipo: a.tipo, t: +t.toFixed(2), vp: +vp.toFixed(2), v: +v.toFixed(2) }; }
          }
        }
      } else if (s0 && recriado && !cortou) { r.saltoSemCorte++; r.piorSalto = { id: a.id, t: +t.toFixed(2), recriadoSemCorte: true }; }
      if (!s0) { s0 = { t: [[0, 0, 0], [0, 0, 0]], pes: [{}, {}], v: 0, pel: [0, 0, 0], merg: false, noAr: false }; ant.set(a, s0); }
      s0.v = v0; s0.pel = pel; s0.merg = merg; s0.noAr = !!a.noAr;
      for (let p = 0; p < 2; p++) { const it = TORNS[p]; s0.t[p][0] = o[it * 3]; s0.t[p][1] = o[it * 3 + 1]; s0.t[p][2] = o[it * 3 + 2]; s0.pes[p] = { apoio: j.pes[p].apoio, x: j.pes[p].x, z: j.pes[p].z }; }
    }
    // pelves
    const at = c.atores;
    for (let p = 0; p < at.length; p++) {
      if (!at[p].ativo) continue;
      for (let q = p + 1; q < at.length; q++) {
        if (!at[q].ativo) continue;
        const oa = at[p].atu, ob = at[q].atu;
        const d = Math.hypot(oa[J.pelve * 3] - ob[J.pelve * 3], oa[J.pelve * 3 + 2] - ob[J.pelve * 3 + 2]);
        if (d < r.pelve) { r.pelve = d; r.piorPelve = { a: at[p].id, b: at[q].id, t: +t.toFixed(2) }; }
      }
    }
    if (opc.por) opc.por(c, t, nome, pcs[0]);
  }
  r.duracao = c.kFim * PASSO;
  r.n = n0;
  return r;
}
const okCorpo = r => r.nan === 0 && r.osso <= 0.005 && r.plantado <= 0.05 && r.razao <= 1 && r.pelve >= 0.4 && r.saltoSemCorte === 0;
const okCamera = r => r.solido === 0 && r.foraLimite === 0 && r.noGol === 0 && r.lente >= 2.5;
const resumoCorpo = rs => `NaN ${rs.reduce((s, r) => s + r.nan, 0)}, osso ${f2(Math.max(...rs.map(r => r.osso)) * 1000)} mm, plantado ${f3(Math.max(...rs.map(r => r.plantado)))} m/s, ar ${f2(Math.max(...rs.map(r => r.razao)))}, pelve ${f3(Math.min(...rs.map(r => r.pelve)))} m, saltos sem corte ${rs.reduce((s, r) => s + r.saltoSemCorte, 0)}`;
const resumoCamera = rs => `sólido ${rs.reduce((s, r) => s + r.solido, 0)}, fora do limite ${rs.reduce((s, r) => s + r.foraLimite, 0)}, no gol ${rs.reduce((s, r) => s + r.noGol, 0)}, lente mín ${f2(Math.min(...rs.map(r => r.lente)))} m`;

// ------------------------------------------------------------------------------------------------ A) canhão de cartões
const CC = await tentar('cena-cartao.js');
const CA = await tentar('cena-atores.js');
const LC = await import(pathToFileURL(path.join(AQUI, 'lib/cenas-node.mjs')).href);
const SITUACOES = ['amarelo', 'vermelho', 'segundo', 'penalti', 'vantagemGol', 'goleiro'];
const ESTADOS = [[3, 1500], [5, 2600], [7, 900], [11, 3400], [13, 1900], [17, 4300], [19, 2200], [23, 3000]];
const cenasA = [];
const custosA = [];
if (roda('A') || roda('E') || roda('G')) {
  if (!CC || !CA) {
    reg('A cena do cartão (js/cena-cartao.js)', 'não existe: o cartão é só o ícone em cima de quem levou', 'existe', false);
  } else {
    const L = await LC.carregarCenas(pastaJs);
    let faltou = 0, excluidas = 0, total = 0;
    for (const [sem, tk] of ESTADOS) {
      // o estado do meio uma vez por semente; cada cena parte de uma cópia (structuredClone: anda igual, mesmo hash)
      const base = LC.estadoDoMeio(L, sem, tk);
      for (const sit of SITUACOES) {
        const variantes = sit === 'amarelo' || sit === 'penalti' || (sit === 'vantagemGol') ? CC.AMARELOS : CC.VERMELHOS;
        for (const vf of variantes) {
          const m = structuredClone(base);
          const ev = LC.forcarCartao(L, m, sit);
          if (!ev) { faltou++; continue; }
          const cartao = CC.escolherCartao(ev.eventos);
          const h0 = S.hashMundo(ev.m);
          const plano = CC.planejarCartao(ev.m, cartao, { variante: vf });
          total++;
          if (plano.variante !== vf) excluidas++;
          const c = CC.criarCenaCartao(plano, ev.m);
          const medida = medirCartao(c);
          medida.hashIgual = S.hashMundo(ev.m) === h0;
          medida.sit = sit; medida.sem = sem; medida.tk = tk; medida.vf = vf; medida.variante = plano.variante;
          cenasA.push(medida);
          custosA.push(...medida.r.ms);
        }
      }
    }
    cenasA.faltou = faltou; cenasA.excluidas = excluidas; cenasA.total = total;
  }
}

/** Uma cena de cartão: as medidas comuns + árbitro, IFAB, assinaturas e expulso. */
function medirCartao(c) {
  const P = c.plano, T = P.tempos;
  const pun = c.punido, arb = c.arbitro;
  const x = {
    plano: P, maoTicks: [], corTicks: [], distAlto: [Infinity, -Infinity], angCartao: 0, ifab: Infinity, piorIfab: null,
    abertos: 0, capPerto: 0, cabecaMaos: 0, giro: 0, tapinha: 0, trote: 0, troteMax: 0, v1Vel: 0, v1Cab: 0, v1N: 0, segura: 0, avanco: -Infinity, recuo: 0, rosto: 0, palmas: 0, palmasDepois: false,
    zFim: null, tunelSobe: 0, tunelN: 0, tunelAnt: null, rumo0: null,
  };
  const tReacao = T.reacao, tFimP2 = T.fimReacao;
  const fx = (o, h) => [Math.cos(h), Math.sin(h)];
  x.r = andarCena(c, {
    passo: CC.passoCenaCartao, planoCamera: CC.planoCameraCartao, criarPlano: CC.criarPlanoCameraCartao,
    assunto: (cc, nome) => (nome === 'arbitro' || nome === 'reacao' ? cc.punido : null),
  }, {
    por: (cc, t, nome, pc) => {
      const o = arb.atu, po = pun.atu;
      const topo = o[J.cabeca * 3 + 1] + TOPO;
      const alto = o[J.maoD * 3 + 1] - topo >= 0.25;
      x.maoTicks.push(alto ? 1 : 0);
      x.corTicks.push(alto ? cc.corVisivel : null);
      if (alto) {
        const d = Math.hypot(o[J.pelve * 3] - po[J.pelve * 3], o[J.pelve * 3 + 2] - po[J.pelve * 3 + 2]);
        x.distAlto[0] = Math.min(x.distAlto[0], d); if (d > x.distAlto[1]) { x.distAlto[1] = d; x.tAlto = +t.toFixed(2); }
        if (nome === 'arbitro') {
          // o cartão de frente para o punido: o ângulo entre a face e a direção da câmera
          let nx = po[J.peito * 3] - o[J.peito * 3], nz = po[J.peito * 3 + 2] - o[J.peito * 3 + 2];
          const ln = Math.hypot(nx, nz) || 1; nx /= ln; nz /= ln;
          const cx = pc.de[0] - o[J.maoD * 3], cy = pc.de[1] - o[J.maoD * 3 + 1], cz = pc.de[2] - o[J.maoD * 3 + 2], lc = Math.hypot(cx, cy, cz) || 1;
          const ang = Math.acos(Math.max(-1, Math.min(1, (nx * cx + nz * cz) / lc))) * 180 / Math.PI;
          x.angCartao = Math.max(x.angCartao, ang);
        }
      }
      // IFAB (A1, V2): de cartão no alto + 1,0 s até o fim de P2, só o capitão e o punido a < 4 m do árbitro
      if ((P.variante === 'abertos' || P.variante === 'segurado') && t >= T.alto + 1.0 && t <= tFimP2) {
        for (const a of cc.atores) {
          if (!a.ativo || a === arb || a === pun || a === cc.apoio) continue;
          const d = Math.hypot(a.atu[J.pelve * 3] - o[J.pelve * 3], a.atu[J.pelve * 3 + 2] - o[J.pelve * 3 + 2]);
          if (d < x.ifab) { x.ifab = d; x.piorIfab = { id: a.id, t: +t.toFixed(2), d: +d.toFixed(2) }; }
        }
      }
      const h = pun.j.rumo;
      const naP2 = t >= tReacao && t < tFimP2;
      const ombroY = Math.max(po[J.ombroE * 3 + 1], po[J.ombroD * 3 + 1]);
      if (P.variante === 'abertos' && naP2) {
        let ok = true;
        for (const im of [J.maoE, J.maoD]) {
          const dh = Math.hypot(po[im * 3] - po[J.peito * 3], po[im * 3 + 2] - po[J.peito * 3 + 2]);
          if (dh < 0.35 || po[im * 3 + 1] < ombroY - 0.4 || po[im * 3 + 1] > ombroY + 0.15) ok = false;
        }
        if (ok) x.abertos++;
        if (cc.apoio && Math.hypot(cc.apoio.j.x - pun.j.x, cc.apoio.j.z - pun.j.z) <= 1.2) x.capPerto++;
      }
      if (P.variante === 'cabeca' && naP2) {
        const c3 = J.cabeca * 3;
        const ok = [J.maoE, J.maoD].every(im => Math.hypot(po[im * 3] - po[c3], po[im * 3 + 1] - po[c3 + 1], po[im * 3 + 2] - po[c3 + 2]) <= 0.2);
        if (ok) x.cabecaMaos++;
        if (x.rumo0 == null) x.rumo0 = h;
        x.giro = Math.max(x.giro, Math.abs(difAng(x.rumo0, h)));
      }
      if (x.rumo0 == null && P.variante !== 'cabeca' && naP2) x.rumo0 = h;
      if ((P.variante === 'cabeca' || P.variante === 'cabisbaixo') && cc.apoio && t >= tReacao) {
        const k = CA.costas(po, h, { x: 0, y: 0, z: 0 });
        const ao = cc.apoio.atu;
        const dm = Math.min(...[J.maoE, J.maoD].map(im => Math.hypot(ao[im * 3] - k.x, ao[im * 3 + 1] - k.y, ao[im * 3 + 2] - k.z)));
        if (dm <= 0.15) x.tapinha++;
      }
      if (P.variante === 'aceita' && t >= tReacao) {
        const v = Math.hypot(pun.j.vx, pun.j.vz), rx = pun.j.x - arb.j.x, rz = pun.j.z - arb.j.z, rl = Math.hypot(rx, rz) || 1;
        const radial = (pun.j.vx * rx + pun.j.vz * rz) / rl;
        if (v >= 3 && radial > 0) { x.trote++; x.troteMax = Math.max(x.troteMax, x.trote); } else x.trote = 0;
      }
      if (P.cor === 'vermelho' && t >= tReacao) {
        const pl = nome;
        if (P.variante === 'cabisbaixo' && (pl === 'reacao' || pl === 'saida' || pl === 'tunel')) {
          x.v1N++;
          x.v1Vel = Math.max(x.v1Vel, Math.hypot(pun.j.vx, pun.j.vz));
          if (CA.anguloCabeca(po, h) >= 20 * Math.PI / 180) x.v1Cab++;
        }
        if (P.variante === 'segurado' && cc.apoio) {
          const ao = cc.apoio.atu, pe = J.peito * 3;
          const ok = [J.maoE, J.maoD].every(im => Math.hypot(ao[im * 3] - po[pe], ao[im * 3 + 1] - po[pe + 1], ao[im * 3 + 2] - po[pe + 2]) <= 0.2);
          if (ok) x.segura++;
          // avanço e recuo na direção do árbitro (do ponto em que estava no começo da reação)
          if (x.p0 == null) { const ux = arb.j.x - pun.j.x, uz = arb.j.z - pun.j.z, l = Math.hypot(ux, uz) || 1; x.p0 = { x: pun.j.x, z: pun.j.z, ux: ux / l, uz: uz / l }; }
          if (pl === 'reacao') {
            const s = (pun.j.x - x.p0.x) * x.p0.ux + (pun.j.z - x.p0.z) * x.p0.uz;
            if (s > x.avanco) x.avanco = s;
            x.recuo = Math.max(x.recuo, x.avanco - s);
          }
        }
        if (P.variante === 'rosto') {
          const k = CA.rosto(po, h, { x: 0, y: 0, z: 0 });
          const ok = [J.maoE, J.maoD].every(im => Math.hypot(po[im * 3] - k.x, po[im * 3 + 1] - k.y, po[im * 3 + 2] - k.z) <= 0.15);
          if (ok && !x.palmas) x.rosto++;
          const topoP = po[J.cabeca * 3 + 1] + TOPO;
          if (po[J.maoE * 3 + 1] >= topoP + 0.1 && po[J.maoD * 3 + 1] >= topoP + 0.1) { x.palmas++; }
        }
        if (pl === 'tunel') {
          const d = Math.hypot(pun.j.x - 0, pun.j.z - 44.5);
          if (x.tunelAnt != null) { x.tunelN++; if (d < x.tunelAnt - 1e-5) x.tunelSobe++; }
          x.tunelAnt = d;
          x.zFim = pun.j.z;
        }
      }
    },
  });
  return x;
}

if (cenasA.length) {
  const rs = cenasA.map(x => x.r);
  const desc = `${cenasA.length} cenas (${cenasA.total} montadas; ${cenasA.faltou} situações sem cartão nos 8 estados)`;
  reg('A canhão: cenas de cartão a partir de estados do meio da partida', desc, '8 estados × 6 situações × 3 variações = 144', cenasA.length === 144);
  reg('A corpo: NaN, ossos ±0,5 cm, pé plantado ≤ 0,05 m/s, pé no ar ≤ 1,0, pelves ≥ 0,4 m, saltos só no corte', resumoCorpo(rs), '0, ≤ 5 mm, ≤ 0,05, ≤ 1,0, ≥ 0,40, 0', rs.every(okCorpo));
  if (detalhe) for (const x of cenasA) if (!okCorpo(x.r)) console.log('corpo', x.sit, x.sem, x.variante, JSON.stringify({ osso: x.r.osso, pl: x.r.piorPlantado, pe: x.r.piorPe, pelve: x.r.piorPelve, salto: x.r.piorSalto }));
  reg('A câmera: fora de sólidos, ≤ 5,5 m além das linhas, fora do gol, lente ≥ 2,5 m', resumoCamera(rs), '0, 0, 0, ≥ 2,5 m', rs.every(okCamera));
  if (detalhe) for (const x of cenasA) if (!okCamera(x.r)) console.log('camera', x.sit, x.sem, x.variante, JSON.stringify({ lente: x.r.piorLente, solido: x.r.piorSolido }));
  // o punido no quadro (arbitro e reacao), 16:9 e 844/390; altura ≥ 25% na reação
  const qs = {};
  for (const x of cenasA) for (const [k, q] of Object.entries(x.r.quadro)) { const a = qs[k] ?? (qs[k] = { n: 0, dentro: 0, alt: [] }); a.n += q.n; a.dentro += q.dentro; if (k.startsWith('reacao')) a.alt.push(...q.altura); }
  const porCena = cenasA.map(x => Object.entries(x.r.quadro).map(([k, q]) => q.dentro / q.n));
  const minCena = Math.min(...porCena.flat());
  const altBaixa = cenasA.map(x => Object.entries(x.r.quadro).filter(([k]) => k.startsWith('reacao')).map(([, q]) => q.altura.filter(a => a < 0.25).length / q.n)).flat();
  reg('A o punido no quadro (margem 5%) nos planos árbitro e reação, PC e celular', Object.entries(qs).map(([k, q]) => `${k} ${f2(100 * q.dentro / q.n)}%`).join(', ') + ` (pior cena ${f2(100 * minCena)}%)`, '≥ 95% em cada cena', minCena >= 0.95);
  if (detalhe) for (const x of cenasA) for (const [k, q] of Object.entries(x.r.quadro)) if (q.dentro / q.n < 0.95) console.log('quadro', x.sit, x.sem, x.variante, k, f2(q.dentro / q.n));
  reg('A o punido com ≥ 25% da altura do quadro no plano da reação', `pior cena: ${f2(100 * Math.max(...altBaixa))}% dos ticks abaixo`, '≤ 5% dos ticks', Math.max(...altBaixa) <= 0.05);
  // árbitro: mão do cartão ≥ 0,25 m acima do topo da cabeça por ≥ 1,2 s contínuos (2º amarelo: amarelo ≥ 0,9 e vermelho ≥ 1,2)
  const seqs = x => { const out = []; let cor = null, n = 0; for (const k of x.corTicks) { if (k === cor && k) n++; else { if (cor) out.push([cor, n]); cor = k; n = k ? 1 : 0; } } if (cor) out.push([cor, n]); return out; };
  const okArb = x => {
    const s = seqs(x);
    if (x.plano.segundo) return s.length >= 2 && s[0][0] === 'amarelo' && s[0][1] >= 54 && s[1][0] === 'vermelho' && s[1][1] >= 72;
    return s.length >= 1 && s[0][0] === x.plano.cor && s[0][1] >= 72;
  };
  const ruinsArb = cenasA.filter(x => !okArb(x));
  reg('A árbitro: o cartão no alto (mão ≥ 0,25 m acima do topo da cabeça) com a cor certa', `${cenasA.length - ruinsArb.length}/${cenasA.length} cenas; menor: ${f2(Math.min(...cenasA.map(x => Math.min(...seqs(x).map(q => q[1])))) / 60)} s`, '≥ 1,2 s (2º amarelo: amarelo ≥ 0,9 s, depois vermelho ≥ 1,2 s)', !ruinsArb.length);
  if (detalhe) for (const x of ruinsArb) console.log('arbitro', x.sit, x.sem, x.variante, JSON.stringify(seqs(x)));
  const dmin = Math.min(...cenasA.map(x => x.distAlto[0])), dmax = Math.max(...cenasA.map(x => x.distAlto[1]));
  reg('A árbitro: distância ao punido com o cartão no alto', `${f2(dmin)}–${f2(dmax)} m`, '1,5–3,2 m', dmin >= 1.5 && dmax <= 3.2);
  if (detalhe) for (const x of cenasA) if (x.distAlto[0] < 1.5 || x.distAlto[1] > 3.2) console.log('distancia', x.sit, x.sem, x.variante, x.distAlto.map(f2).join('–'), x.tAlto);
  const ang = Math.max(...cenasA.map(x => x.angCartao));
  reg('A o cartão de frente para a câmera no plano do árbitro', `pior ${f2(ang)}°`, '≤ 35°', ang <= 35);
  const ifab = cenasA.filter(x => x.plano.variante === 'abertos' || x.plano.variante === 'segurado');
  const pifab = Math.min(...ifab.map(x => x.ifab));
  reg('A IFAB (A1, V2): só o capitão e o punido a < 4 m do árbitro (cartão no alto + 1 s até o fim da reação)', `${ifab.length} cenas; o mais perto ${f2(pifab)} m${detalhe ? ' ' + JSON.stringify(ifab.reduce((a, x) => (x.ifab < a.ifab ? x : a)).piorIfab) : ''}`, '≥ 4 m', ifab.length > 0 && pifab >= 4);
  // assinaturas
  const de = v => cenasA.filter(x => x.plano.variante === v);
  const A1 = de('abertos'), A2 = de('cabeca'), A3 = de('aceita'), V1 = de('cabisbaixo'), V2 = de('segurado'), V3 = de('rosto');
  reg('A1 braços abertos ≥ 1,0 s e o capitão a ≤ 1,2 m do punido ≥ 0,5 s', `${A1.length} cenas; abertos mín ${f2(Math.min(...A1.map(x => x.abertos)) / 60)} s; capitão perto mín ${f2(Math.min(...A1.map(x => x.capPerto)) / 60)} s`, '≥ 1,0 s; ≥ 0,5 s', A1.length > 0 && A1.every(x => x.abertos >= 60 && x.capPerto >= 30));
  reg('A2 mãos na cabeça ≥ 0,8 s, giro ≥ 120°, tapinha nas costas ≥ 0,3 s', `${A2.length} cenas; mãos ${f2(Math.min(...A2.map(x => x.cabecaMaos)) / 60)} s; giro ${f2(Math.min(...A2.map(x => x.giro)) * 180 / Math.PI)}°; tapinha ${f2(Math.min(...A2.map(x => x.tapinha)) / 60)} s`, '≥ 0,8 s; ≥ 120°; ≥ 0,3 s', A2.length > 0 && A2.every(x => x.cabecaMaos >= 48 && x.giro >= 2.094 && x.tapinha >= 18));
  reg('A3 volta trotando: ≥ 3 m/s afastando-se do árbitro', `${A3.length} cenas; mín ${f2(Math.min(...A3.map(x => x.troteMax)) / 60)} s contínuos`, '≥ 1,0 s', A3.length > 0 && A3.every(x => x.troteMax >= 60));
  reg('V1 cabisbaixo: velocidade ≤ 1,4 m/s, cabeça ≥ 20° baixa ≥ 70% da reação à saída; tapinha', `${V1.length} cenas; vel máx ${f2(Math.max(...V1.map(x => x.v1Vel)))} m/s; cabeça baixa mín ${f2(100 * Math.min(...V1.map(x => x.v1Cab / Math.max(1, x.v1N))))}%; tapinha mín ${f2(Math.min(...V1.map(x => x.tapinha)) / 60)} s`, '≤ 1,4; ≥ 70%; ≥ 0,3 s', V1.length > 0 && V1.every(x => x.v1Vel <= 1.4 && x.v1Cab / Math.max(1, x.v1N) >= 0.7 && x.tapinha >= 18));
  reg('V2 segurado: as mãos do capitão ≤ 0,2 m do peito ≥ 0,8 s e o punido recua ≥ 0,8 m', `${V2.length} cenas; segura mín ${f2(Math.min(...V2.map(x => x.segura)) / 60)} s; recuo mín ${f2(Math.min(...V2.map(x => x.recuo)))} m`, '≥ 0,8 s; ≥ 0,8 m', V2.length > 0 && V2.every(x => x.segura >= 48 && x.recuo >= 0.8));
  reg('V3 rosto: mãos ≤ 0,15 m do rosto ≥ 1,5 s e depois palmas acima da cabeça', `${V3.length} cenas; rosto mín ${f2(Math.min(...V3.map(x => x.rosto)) / 60)} s; palmas mín ${f2(Math.min(...V3.map(x => x.palmas)) / 60)} s`, '≥ 1,5 s; ≥ 0,3 s', V3.length > 0 && V3.every(x => x.rosto >= 90 && x.palmas >= 18));
  const verm = cenasA.filter(x => x.plano.cor === 'vermelho');
  reg('A expulso: termina fora do campo (z > 34) e a distância ao túnel cai em todo o plano do túnel', `${verm.length} cenas; z final mín ${f2(Math.min(...verm.map(x => x.zFim ?? -99)))}; caindo em ${f2(100 * Math.min(...verm.map(x => x.tunelSobe / Math.max(1, x.tunelN))))}% dos ticks (pior)`, 'z > 34; 100%', verm.length > 0 && verm.every(x => x.zFim > 34 && x.tunelSobe === x.tunelN && x.tunelN > 60));
  // durações
  const dur = x => x.r.duracao, am = cenasA.filter(x => x.plano.cor === 'amarelo'), vs = verm.filter(x => !x.plano.segundo), sg = verm.filter(x => x.plano.segundo);
  reg('A durações (amarelo / vermelho / 2º amarelo)', `${f2(Math.min(...am.map(dur)))}–${f2(Math.max(...am.map(dur)))} / ${f2(Math.min(...vs.map(dur)))}–${f2(Math.max(...vs.map(dur)))} / ${f2(Math.min(...sg.map(dur)))}–${f2(Math.max(...sg.map(dur)))} s`, '4,8–5,6 / 8,5–9,0 / 9,5–10,0 s',
    am.every(x => dur(x) >= 4.8 && dur(x) <= 5.6) && vs.every(x => dur(x) >= 8.5 && dur(x) <= 9.0) && sg.length > 0 && sg.every(x => dur(x) >= 9.5 && dur(x) <= 10.0));
  reg('A situações: amarelo, vermelho, 2º amarelo, pênalti com cartão, vantagem → gol, goleiro expulso', SITUACOES.map(s => `${s} ${cenasA.filter(x => x.sit === s).length}`).join(', '), '24 de cada', SITUACOES.every(s => cenasA.filter(x => x.sit === s).length === 24));
}

// ------------------------------------------------------------------------------------------------ B) variedade
if (roda('B')) {
  if (!CA || typeof CA.escolherVariante !== 'function') {
    reg('B variedade (cena-atores.js escolherVariante)', 'não existe', 'existe', false);
  } else {
    let rep = 0;
    const conta = { amarelo: {}, vermelho: {}, torcida: {} };
    const listas = { amarelo: ['abertos', 'cabeca', 'aceita'], vermelho: ['cabisbaixo', 'segurado', 'rosto'], torcida: ['fundo', 'lateral', 'close'] };
    let piorFrac = 1;
    for (let k = 0; k < 2000; k++) {
      const ult = { amarelo: null, vermelho: null, torcida: null }, pen = { amarelo: null, vermelho: null, torcida: null };
      const n = { amarelo: {}, vermelho: {}, torcida: {} };
      for (let i = 0; i < 100; i++) {
        for (const cor of ['amarelo', 'vermelho', 'torcida']) {
          const v = CA.escolherVariante(5000 + k * 7919 + i * 613, (k * 13 + i * 5) % 46 + (cor === 'torcida' ? 300 : 1), ult[cor], listas[cor], pen[cor]);
          if (v === ult[cor]) rep++;
          pen[cor] = ult[cor]; ult[cor] = v;
          n[cor][v] = (n[cor][v] ?? 0) + 1; conta[cor][v] = (conta[cor][v] ?? 0) + 1;
        }
      }
      for (const cor of ['amarelo', 'vermelho', 'torcida']) for (const v of listas[cor]) piorFrac = Math.min(piorFrac, (n[cor][v] ?? 0) / 100);
    }
    reg('B 2000 sequências de 100: nunca a mesma em seguida (amarelo, vermelho, enquadramento da torcida)', `${rep} repetidas; ${Object.entries(conta).map(([c, o]) => `${c} ${Object.values(o).map(v => f2(v / 2000)).join('/')}`).join('; ')}`, '0', rep === 0);
    reg('B em 100 cartões seguidos cada variação ≥ 25%', `pior ${f2(100 * piorFrac)}%`, '≥ 25%', piorFrac >= 0.25);
    if (cenasA.length) reg('B variação excluída por falta de companheiro a ≤ 15 m (canhão A)', `${cenasA.excluidas}/${cenasA.total} (${f2(100 * cenasA.excluidas / Math.max(1, cenasA.total))}%)`, '≤ 10%', cenasA.excluidas / Math.max(1, cenasA.total) <= 0.1);
  }
}

// ------------------------------------------------------------------------------------------------ C) fim de tempo
const CF = await tentar('cena-fim.js');
const cenasC = [];
// os técnicos falsos do gancho (a frente dos treinadores entrega os de verdade): na área técnica de cada banco
const TECNICOS = { 0: { id: 301, time: 0, x: 11, z: 36, rumo: -Math.PI / 2, kit: null }, 1: { id: 302, time: 1, x: -11, z: 36, rumo: -Math.PI / 2, kit: null } };
const RESULTADOS = [['intervalo', 'intervalo', null], ['vitoriaCasa', 'fimDeJogo', { 0: 2, 1: 1 }], ['derrotaCasa', 'fimDeJogo', { 0: 0, 1: 1 }], ['empate', 'fimDeJogo', { 0: 1, 1: 1 }]];
if (roda('C') || roda('E') || roda('G')) {
  if (!CF) reg('C cena de fim de tempo (js/cena-fim.js)', 'não existe: no apito do intervalo e do fim a câmera só abre no plano geral com a faixa', 'existe', false);
  else {
    const L = await LC.carregarCenas(pastaJs);
    for (const [sem, tk] of ESTADOS) {
      const base = LC.estadoDoMeio(L, sem, tk);
      for (const [nome, tipo, placar] of RESULTADOS) {
        for (const tec of [false, true]) {
          if (tec && nome === 'intervalo') continue;
          const m = structuredClone(base);
          const h0 = S.hashMundo(m);
          const plano = CF.planejarFim(m, tipo, { placar: placar ?? undefined, timeHumano: 0, treinadores: tec ? TECNICOS : null });
          const c = CF.criarCenaFim(plano, m);
          const x = medirFim(c);
          x.hashIgual = S.hashMundo(m) === h0;
          x.nome = nome; x.sem = sem; x.comTec = tec;
          cenasC.push(x);
        }
      }
    }
  }
}

/** Uma cena de fim de tempo: as medidas comuns + as do fim (velocidade depois do apito, cintura, apertos, túnel, festa, lamento). */
function medirFim(c) {
  const P = c.plano;
  const pl = nm => P.planos.find(q => q.nome === nm);
  const jogs = c.atores.filter(a => a.time === 0 || a.time === 1).filter(a => a.tipo !== 'treinador');
  const x = { plano: P, v2: 0, piorV2: null, cintura: new Map(), cinturaMax: new Map(), apertos: new Map(), apertoArb: 0, tunel: new Map(), festa: new Map(), lamento: new Map(), maosAlto: new Map(), tec: { braco: 0, dentro: true, n: 0 } };
  const pCampo = pl('campo') ?? pl('neutro');
  const kMax = Math.round((P.duracao + 1.0) / PASSO);
  x.r = andarCena(c, {
    passo: CF.passoCenaFim, planoCamera: CF.planoCameraFim, criarPlano: CF.criarPlanoCameraFim,
  }, {
    max: kMax,
    por: (cc, t, nome) => {
      // 2,0 s depois do apito: ninguém acima de 1,6 m/s (todos desaceleram pela locomoção)
      if (Math.abs(t - 2.0) < PASSO / 2) for (const a of cc.atores) { if (!a.ativo) continue; const v = Math.hypot(a.j.vx, a.j.vz); if (v > x.v2) { x.v2 = v; x.piorV2 = { id: a.id, tipo: a.tipo, v: +v.toFixed(2) }; } }
      for (const a of jogs) {
        if (!a.ativo) continue;
        const o = a.atu;
        // mãos na cintura (≤ 0,12 m da articulação do quadril), contínuo
        if (pCampo && t >= pCampo.t0 && t < pCampo.t1) {
          const ok = Math.hypot(o[J.maoE * 3] - o[J.quadrilE * 3], o[J.maoE * 3 + 1] - o[J.quadrilE * 3 + 1], o[J.maoE * 3 + 2] - o[J.quadrilE * 3 + 2]) <= 0.12
            && Math.hypot(o[J.maoD * 3] - o[J.quadrilD * 3], o[J.maoD * 3 + 1] - o[J.quadrilD * 3 + 1], o[J.maoD * 3 + 2] - o[J.quadrilD * 3 + 2]) <= 0.12;
          const n = ok ? (x.cintura.get(a) ?? 0) + 1 : 0;
          x.cintura.set(a, n); x.cinturaMax.set(a, Math.max(x.cinturaMax.get(a) ?? 0, n));
        }
        // no túnel (intervalo, P3): a distância à boca caindo
        if (nome === 'tunel') {
          const d = Math.hypot(a.j.x - 0, a.j.z - 44.5), q = x.tunel.get(a) ?? { ant: null, cai: 0, n: 0 };
          if (q.ant != null && a.recriado !== cc.k) { q.n++; if (d < q.ant - 1e-6) q.cai++; }
          q.ant = d; x.tunel.set(a, q);
        }
        const topo = o[J.cabeca * 3 + 1] + TOPO;
        const alto = o[J.maoE * 3 + 1] >= topo + 0.1 && o[J.maoD * 3 + 1] >= topo + 0.1;
        if (nome === 'vencedor' && a.time === P.vencedor) x.festa.set(a, (x.festa.get(a) ?? 0) + (alto ? 1 : 0));
        if (nome === 'perdedor' && a.time !== P.vencedor) {
          const c3 = J.cabeca * 3;
          const maosCab = [J.maoE, J.maoD].every(im => Math.hypot(o[im * 3] - o[c3], o[im * 3 + 1] - o[c3 + 1], o[im * 3 + 2] - o[c3 + 2]) <= 0.22);
          const maosJoe = Math.hypot(o[J.maoE * 3] - o[J.joelhoE * 3], o[J.maoE * 3 + 1] - o[J.joelhoE * 3 + 1], o[J.maoE * 3 + 2] - o[J.joelhoE * 3 + 2]) <= 0.2
            && Math.hypot(o[J.maoD * 3] - o[J.joelhoD * 3], o[J.maoD * 3 + 1] - o[J.joelhoD * 3 + 1], o[J.maoD * 3 + 2] - o[J.joelhoD * 3 + 2]) <= 0.2;
          const cab = CA.anguloCabeca(o, a.j.rumo) >= 20 * Math.PI / 180;
          x.lamento.set(a, (x.lamento.get(a) ?? 0) + (maosCab || maosJoe || cab ? 1 : 0));
        }
        if (P.resultado === 'empate' && nome !== 'aplauso' && nome !== 'torcida' && nome !== 'geral') {
          const q = x.maosAlto.get(a) ?? { n: 0, max: 0 };
          q.n = alto ? q.n + 1 : 0; q.max = Math.max(q.max, q.n); x.maosAlto.set(a, q);
        }
      }
      // apertos de mão: as mãos direitas ≤ 0,15 m e as pelves a 0,8–1,2 m, contínuo
      const at = cc.atores;
      for (let p = 0; p < at.length; p++) {
        const A = at[p]; if (!A.ativo) continue;
        for (let q = p + 1; q < at.length; q++) {
          const B = at[q]; if (!B.ativo) continue;
          if (A.time === B.time) continue;
          const oa = A.atu, ob = B.atu;
          const dm = Math.hypot(oa[J.maoD * 3] - ob[J.maoD * 3], oa[J.maoD * 3 + 1] - ob[J.maoD * 3 + 1], oa[J.maoD * 3 + 2] - ob[J.maoD * 3 + 2]);
          const dp = Math.hypot(oa[J.pelve * 3] - ob[J.pelve * 3], oa[J.pelve * 3 + 2] - ob[J.pelve * 3 + 2]);
          const k = A.id * 1000 + B.id;
          const r = x.apertos.get(k) ?? { n: 0, max: 0, arb: A.time === 2 || B.time === 2 };
          r.n = dm <= 0.15 && dp >= 0.8 && dp <= 1.2 ? r.n + 1 : 0; r.max = Math.max(r.max, r.n);
          x.apertos.set(k, r);
        }
      }
      // o treinador do gancho: os braços acima da cabeça e dentro da área técnica
      for (const a of cc.treinadores ?? []) {
        if (nome !== 'treinador') continue;
        const o = a.atu, topo = o[J.cabeca * 3 + 1] + TOPO;
        if (a.timeT === P.vencedor && o[J.maoE * 3 + 1] >= topo + 0.1 && o[J.maoD * 3 + 1] >= topo + 0.1) x.tec.braco++;
        const ax = Math.abs(a.j.x);
        if (!(ax >= 4 && ax <= 18 && a.j.z >= 35 && a.j.z <= 41)) x.tec.dentro = false;
        x.tec.n++;
      }
    },
  });
  x.nApertos = [...x.apertos.values()].filter(r => !r.arb && r.max >= 24).length;
  x.nApertoArb = [...x.apertos.values()].filter(r => r.arb && r.max >= 24).length;
  return x;
}

if (cenasC.length) {
  const rs = cenasC.map(x => x.r);
  reg('C canhão: cenas de fim de tempo a partir de estados do meio', `${cenasC.length} cenas (8 estados × intervalo, vitória da casa, derrota da casa, empate; o fim com e sem o técnico do gancho)`, '56', cenasC.length === 56);
  reg('C corpo: NaN, ossos, pé plantado, pé no ar, pelves, saltos só no corte', resumoCorpo(rs), '0, ≤ 5 mm, ≤ 0,05, ≤ 1,0, ≥ 0,40, 0', rs.every(okCorpo));
  if (detalhe) for (const x of cenasC) if (!okCorpo(x.r)) console.log('corpoC', x.nome, x.sem, x.comTec, JSON.stringify({ osso: x.r.osso, pl: x.r.piorPlantado, pe: x.r.piorPe, pelve: x.r.piorPelve, salto: x.r.piorSalto }));
  reg('C câmera: fora de sólidos, ≤ 5,5 m além das linhas, fora do gol, lente ≥ 2,5 m', resumoCamera(rs), '0, 0, 0, ≥ 2,5 m', rs.every(okCamera));
  if (detalhe) for (const x of cenasC) if (!okCamera(x.r)) console.log('cameraC', x.nome, x.sem, x.comTec, JSON.stringify({ lente: x.r.piorLente, solido: x.r.piorSolido }));
  const v2 = Math.max(...cenasC.map(x => x.v2));
  reg('C 2,0 s depois do apito ninguém acima de 1,6 m/s', `máx ${f2(v2)} m/s${detalhe ? ' ' + JSON.stringify(cenasC.reduce((a, x) => (x.v2 > a.v2 ? x : a)).piorV2) : ''}`, '≤ 1,6', v2 <= 1.6);
  const comCampo = cenasC.filter(x => x.plano.resultado === 'intervalo' || x.plano.resultado === 'empate');
  const fracC = x => [...x.cinturaMax.values()].filter(n => n >= 30).length / 22;
  reg('C mãos na cintura (≤ 0,12 m do quadril, ≥ 0,5 s) no P2 do intervalo / no neutro do empate', `pior ${f2(100 * Math.min(...comCampo.map(fracC)))}% dos 22`, '≥ 60%', comCampo.every(x => fracC(x) >= 0.6));
  const iv = cenasC.filter(x => x.plano.tipo === 'intervalo'), fj = cenasC.filter(x => x.plano.tipo === 'fimDeJogo');
  reg('C apertos de mão (mãos direitas ≤ 0,15 m ≥ 0,4 s, pelves 0,8–1,2 m): intervalo / fim / com o árbitro no fim', `mín ${Math.min(...iv.map(x => x.nApertos))} / ${Math.min(...fj.map(x => x.nApertos))} / ${Math.min(...fj.map(x => x.nApertoArb))}`, '≥ 2 / ≥ 3 / ≥ 1', iv.every(x => x.nApertos >= 2) && fj.every(x => x.nApertos >= 3 && x.nApertoArb >= 1));
  if (detalhe) for (const x of fj) if (x.nApertos < 3 || x.nApertoArb < 1) console.log('apertos', x.nome, x.sem, x.comTec, x.nApertos, x.nApertoArb, JSON.stringify([...x.apertos.entries()].filter(([, r]) => r.max > 0).map(([k, r]) => [k, r.max, r.arb])));
  const fracT = x => { const v = [...x.tunel.values()].filter(q => q.n > 30); return v.length ? v.filter(q => q.cai / q.n >= 0.9).length / v.length : 0; };
  reg('C túnel (intervalo, P3): a distância à boca caindo (≥ 90% dos ticks) para quem anda', `pior ${f2(100 * Math.min(...iv.map(fracT)))}% dos jogadores`, '≥ 80%', iv.every(x => fracT(x) >= 0.8));
  const vit = cenasC.filter(x => x.plano.resultado === 'vitoria');
  const nFesta = x => [...x.festa.values()].filter(n => n >= 18).length, nLam = x => [...x.lamento.values()].filter(n => n >= 30).length;
  reg('C vitória: ≥ 3 vencedores com os dois pulsos ≥ 0,10 m acima da cabeça (≥ 0,3 s)', `mín ${Math.min(...vit.map(nFesta))}`, '≥ 3', vit.every(x => nFesta(x) >= 3));
  reg('C derrota: ≥ 3 perdedores cabisbaixos (≥ 20°) ou com as mãos na cabeça/joelhos (≥ 0,5 s)', `mín ${Math.min(...vit.map(nLam))}`, '≥ 3', vit.every(x => nLam(x) >= 3));
  const emp = cenasC.filter(x => x.plano.resultado === 'empate');
  const maxAlto = Math.max(...emp.map(x => Math.max(...[...x.maosAlto.values()].map(q => q.max))));
  reg('C empate: ninguém com as duas mãos acima da cabeça por mais de 0,5 s', `máx ${f2(maxAlto / 60)} s`, '≤ 0,5 s', maxAlto <= 30);
  const dur = x => x.plano.duracao;
  const faixa = (l, a, b) => l.every(x => dur(x) >= a - 1e-9 && dur(x) <= b + 1e-9);
  const semT = fj.filter(x => !x.comTec), comT = fj.filter(x => x.comTec);
  reg('C durações: intervalo / fim (vitória ou derrota) / empate, sem o técnico', `${f2(dur(iv[0]))} / ${f2(dur(semT.find(x => x.plano.resultado === 'vitoria')))} / ${f2(dur(semT.find(x => x.plano.resultado === 'empate')))} s`, '8,5–9,5 / 12,5–14,0 / 10,5–11,5 s',
    faixa(iv, 8.5, 9.5) && faixa(semT.filter(x => x.plano.resultado === 'vitoria'), 12.5, 14) && faixa(semT.filter(x => x.plano.resultado === 'empate'), 10.5, 11.5));
  // o gancho do treinador: com o técnico, o plano 'treinador' (2,0 s) entra e a cena fica 2,0 s mais longa; sem ele, nenhum buraco
  const okGancho = comT.every(x => { const q = x.plano.planos.find(p => p.nome === 'treinador'); const s0 = semT.find(y => y.sem === x.sem && y.nome === x.nome); return q && Math.abs(q.t1 - q.t0 - 2) < 1e-9 && Math.abs(dur(x) - dur(s0) - 2) < 1e-9; })
    && semT.every(x => !x.plano.planos.some(p => p.nome === 'treinador') && x.plano.planos.every((p, i, a) => i === 0 || Math.abs(p.t0 - a[i - 1].t1) < 1e-9));
  const tecVit = comT.filter(x => x.plano.vencedor != null);
  reg('C gancho do treinador: com o técnico +2,0 s (braços acima da cabeça ≥ 0,5 s, dentro da área técnica); sem ele, nenhum buraco', `${okGancho ? 'planos ok' : 'planos errados'}; braços mín ${f2(Math.min(...tecVit.map(x => x.tec.braco)) / 60)} s; dentro: ${comT.every(x => x.tec.dentro && x.tec.n > 0)}`, '+2,0 s; ≥ 0,5 s; sim',
    okGancho && tecVit.every(x => x.tec.braco >= 30) && comT.every(x => x.tec.dentro && x.tec.n > 0));
}

// ------------------------------------------------------------------------------------------------ D) gol: torcida e treinador
const cenasD = [];
const CM = await tentar('comemoracao.js');
if (roda('D') || roda('E')) {
  const GN = await import(pathToFileURL(path.join(AQUI, 'lib/gol-node.mjs')).href);
  if (!CM || !CM.FASES || !CM.FASES.includes('torcida')) reg('D gol: o corte da torcida (comemoracao.js fase \'torcida\')', 'não existe: do abraço a câmera vai direto à reação de quem sofreu', 'existe', false);
  else {
    const LG = await GN.carregarNode(pastaJs);
    // os 8 gols do teste-comemoracao: 5 naturais (IA × IA) e 3 roteirizados (time 0, time 1 — a cena curta —, gol contra)
    const gols = [], usadas = new Set();
    const tentarG = sm => { if (usadas.has(sm)) return; usadas.add(sm); const g = GN.golNaturalNode(LG, sm, 4000); if (g) gols.push({ ...g, nome: `natural ${sm}` }); };
    for (const sm of [3, 35, 19, 22, 21, 40]) { if (gols.length >= 5) break; tentarG(sm); }
    for (let sm = 1; sm <= 80 && gols.length < 5; sm++) tentarG(sm);
    const r0 = GN.golRoteirizadoNode(LG, { semente: 5, time: 0 }); if (r0) gols.push({ ...r0, nome: 'roteirizado 0' });
    const r1 = GN.golRoteirizadoNode(LG, { semente: 5, time: 1 }); if (r1) gols.push({ ...r1, nome: 'roteirizado 1 (curta)' });
    const rc = GN.golRoteirizadoNode(LG, { semente: 7, time: 0, dist: 8, z0: -2 });
    if (rc) {
      const b = rc.m.bola.p; let z = null, dm = Infinity;
      for (const j of rc.m.jogadores) { if (j.time === 0 || j.posicao === 'GOL') continue; const d = Math.hypot(j.x - b.x, j.z - b.z); if (d < dm) { dm = d; z = j; } }
      gols.push({ ...rc, gol: { ...rc.gol, id: z.id, contra: true }, nome: 'roteirizado contra' });
    }
    const andar = (plano, m, porTick) => {
      const c = CM.criarCena(plano, m), pc = CM.criarPlanoCamera(), estados = [];
      while (!c.acabou && c.k < 12 * 60) {
        CM.passoCena(c); c.alfa = 1;
        const fase = CM.faseEm(c, c.k);
        estados.push(c.atores.filter(a => !a.treinador).map(a => Array.from(a.atu)).flat());
        if (porTick) porTick(c, fase, CM.planoCamera(c, { pequena: false, aspecto: 16 / 9 }, pc));
      }
      return { c, estados };
    };
    for (const g of gols) {
      const m = g.m, h0 = S.hashMundo(m);
      const x = { nome: g.nome, curta: false, fases: [], torcida: 0, cam: { y: 0, fovMin: Infinity, fovMax: -Infinity, ang: 0, solido: 0, dist: [Infinity, -Infinity] }, igual: true, kFim: [0, 0], tec: null };
      const plano = CM.planejarComemoracao(m, g.gol, { timeHumano: 0 });
      x.curta = plano.curta; x.time = plano.time; x.enq = plano.torcida;
      // os setores da torcida do time que marcou (torcida-dados.js): o 0 = organizada (fundo +x) e a arquibancada de lá
      // na metade +x; o 1 = o setor visitante (fundo −x)
      const alvos = plano.time === 1 ? [[-70, -2]] : [[70, 0], [25, -52]];
      const A1 = andar(plano, m, (c, fase, pc) => {
        if (x.fases[x.fases.length - 1] !== fase) x.fases.push(fase);
        if (fase !== 'torcida') return;
        x.torcida++;
        const [cx, cy, cz] = pc.de;
        x.cam.y = Math.max(x.cam.y, cy); x.cam.fovMin = Math.min(x.cam.fovMin, pc.fov); x.cam.fovMax = Math.max(x.cam.fovMax, pc.fov);
        if (EF.solidoEm(cx, cy, cz, 0.2, false) || Math.abs(cx) > MX + 5.5 || Math.abs(cz) > MZ + 5.5) x.cam.solido++;
        const lx = pc.para[0] - cx, lz = pc.para[2] - cz, ll = Math.hypot(lx, lz);
        let melhor = Infinity;
        for (const [ax, az] of alvos) { const dx = ax - cx, dz = az - cz; const a = Math.acos(Math.max(-1, Math.min(1, (lx * dx + lz * dz) / (ll * Math.hypot(dx, dz))))) * 180 / Math.PI; melhor = Math.min(melhor, a); }
        x.cam.ang = Math.max(x.cam.ang, melhor);
        // distância à frente da arquibancada (fundos em |x| = 62,5; a de lá em z = −44,5)
        const d = Math.min(62.5 - Math.abs(cx), 44.5 + cz);
        x.cam.dist[0] = Math.min(x.cam.dist[0], d); x.cam.dist[1] = Math.max(x.cam.dist[1], d);
      });
      x.kFim[0] = A1.c.kFim;
      // sem os cortes: os atores tick a tick e o kFim idênticos
      const B1 = andar(CM.planejarComemoracao(m, g.gol, { timeHumano: 0, cortes: false }), m, null);
      x.kFim[1] = B1.c.kFim;
      x.igual = A1.estados.length === B1.estados.length && A1.estados.every((e, k) => e.length === B1.estados[k].length && e.every((v, i) => v === B1.estados[k][i]));
      // o gancho do treinador: um técnico falso do time que marcou, na área técnica
      const tec = { ...TECNICOS[plano.time], id: 300 + plano.time };
      const comT = { braco: 0, max: 0, dentro: true, n: 0 };
      const C2 = andar(CM.planejarComemoracao(m, g.gol, { timeHumano: 0, treinador: tec }), m, (c, fase) => {
        if (fase !== 'treinador' || !c.treinador) return;
        const o = c.treinador.atu, topo = o[J.cabeca * 3 + 1] + TOPO;
        comT.braco = o[J.maoE * 3 + 1] >= topo + 0.1 && o[J.maoD * 3 + 1] >= topo + 0.1 ? comT.braco + 1 : 0; comT.max = Math.max(comT.max, comT.braco);
        const ax = Math.abs(c.treinador.j.x); if (!(ax >= 4 && ax <= 18 && c.treinador.j.z >= 35 && c.treinador.j.z <= 41)) comT.dentro = false;
        comT.n++;
      });
      const N1 = andar(CM.planejarComemoracao(m, g.gol, { timeHumano: 0, treinador: null }), m, null);
      x.tec = { dk: C2.c.kFim - A1.c.kFim, ...comT, nullIgual: N1.c.kFim === A1.c.kFim && N1.estados.length === A1.estados.length && N1.estados.every((e, k) => e.every((v, i) => v === A1.estados[k][i])) };
      x.hashIgual = S.hashMundo(m) === h0;
      cenasD.push(x);
    }
  }
}
if (cenasD.length) {
  const N = cenasD.filter(x => !x.curta), Cu = cenasD.filter(x => x.curta);
  reg('D gols: os 8 do teste-comemoracao (5 naturais e 3 roteirizados; a curta é o gol da IA contra o humano)', cenasD.map(x => `${x.nome}${x.curta ? '' : ' ' + x.enq}`).join(', '), '8', cenasD.length === 8);
  const ordem = ['rede', 'corrida', 'final', 'abraco', 'torcida', 'reacao', 'fim'];
  reg('D a fase \'torcida\' entre o abraço e a reação (cena normal), com 0,8–1,5 s', N.map(x => f2(x.torcida / 60)).join(' / ') + ' s', '0,8–1,5 s; abraço → torcida → reação',
    N.length > 0 && N.every(x => x.torcida >= 48 && x.torcida <= 90 && x.fases.indexOf('torcida') === x.fases.indexOf('abraco') + 1 && x.fases.indexOf('reacao') === x.fases.indexOf('torcida') + 1 && x.fases.every((f, i) => i === 0 || ordem.indexOf(f) > ordem.indexOf(x.fases[i - 1]))));
  reg('D sem os cortes (opc.cortes = false): os atores tick a tick e o kFim IDÊNTICOS', cenasD.map(x => `${x.igual ? 'igual' : 'DIFERENTE'} ${x.kFim[0]}/${x.kFim[1]}`).join(', '), 'todos iguais', cenasD.every(x => x.igual && x.kFim[0] === x.kFim[1]));
  const ang = Math.max(...N.map(x => x.cam.ang)), y = Math.max(...N.map(x => x.cam.y)), f0 = Math.min(...N.map(x => x.cam.fovMin)), f1 = Math.max(...N.map(x => x.cam.fovMax));
  const d0 = Math.min(...N.map(x => x.cam.dist[0])), d1 = Math.max(...N.map(x => x.cam.dist[1]));
  reg('D câmera da torcida: para a torcida do time que marcou (≤ 30°), baixa (≤ 2 m), fov 30–40, a 10–15 m da arquibancada, fora de sólidos', `${f2(ang)}°, ${f2(y)} m, fov ${f2(f0)}–${f2(f1)}, ${f2(d0)}–${f2(d1)} m, fora ${N.reduce((q, x) => q + x.cam.solido, 0)}`, '≤ 30°, ≤ 2 m, 30–40, 10–15 m, 0',
    ang <= 30 && y <= 2 && f0 >= 30 && f1 <= 40 && d0 >= 10 && d1 <= 15 && N.every(x => x.cam.solido === 0));
  // os 3 enquadramentos, nos dois times (sem depender do sorteio das 8 cenas)
  {
    let ruins = 0;
    const pc = { de: [0, 0, 0], para: [0, 0, 0] };
    for (const time of [0, 1]) for (const enq of ['fundo', 'lateral', 'close']) for (const hash of [0, 1 << 11]) {
      CM.planoTorcidaGol({ time, torcida: enq, hash }, pc);
      const [cx, cy, cz] = pc.de;
      const alvos = time === 1 ? [[-70, -2]] : [[70, 0], [25, -52]];
      const lx = pc.para[0] - cx, lz = pc.para[2] - cz, ll = Math.hypot(lx, lz);
      const a = Math.min(...alvos.map(([ax, az]) => Math.acos(Math.max(-1, Math.min(1, (lx * (ax - cx) + lz * (az - cz)) / (ll * Math.hypot(ax - cx, az - cz))))) * 180 / Math.PI));
      const d = Math.min(62.5 - Math.abs(cx), 44.5 + cz);
      if (a > 30 || cy > 2 || pc.fov < 30 || pc.fov > 40 || d < 10 || d > 15 || EF.solidoEm(cx, cy, cz, 0.2, false) || Math.abs(cx) > MX + 5.5 || Math.abs(cz) > MZ + 5.5 || (Math.abs(cx) > MX - 0.5 && Math.abs(cz) < 4.6)) ruins++;
    }
    reg('D os 3 enquadramentos da torcida nos dois times (e nos dois lados)', `${12 - ruins}/12 dentro das metas`, '12/12', ruins === 0);
  }
  reg('D gancho do treinador: +90 ticks exatos, braços acima da cabeça ≥ 0,5 s, dentro da área técnica; com null nada muda', N.map(x => `+${x.tec.dk} ${f2(x.tec.max / 60)} s ${x.tec.dentro ? 'dentro' : 'FORA'} ${x.tec.nullIgual ? 'null=igual' : 'null DIFERENTE'}`).join(' / '), '+90; ≥ 0,5 s; dentro; igual',
    N.length > 0 && N.every(x => x.tec.dk === 90 && x.tec.max >= 30 && x.tec.dentro && x.tec.n === 90 && x.tec.nullIgual));
  reg('D cena curta (gol da IA contra o humano): sem torcida e sem treinador, como antes', Cu.map(x => `${x.fases.join('→')} +${x.tec.dk}`).join(' / '), 'sem torcida, +0', Cu.length > 0 && Cu.every(x => !x.fases.includes('torcida') && x.tec.dk === 0));
}

// ------------------------------------------------------------------------------------------------ E) pureza
if (roda('E')) {
  if (!cenasA.length) reg('E pureza (o mundo não muda com a cena)', 'sem cenas', 'hashMundo igual', false);
  else reg('E pureza: hashMundo antes = depois (cenas de cartão)', `${cenasA.filter(x => x.hashIgual).length}/${cenasA.length}`, 'todas', cenasA.every(x => x.hashIgual));
  if (!cenasC.length) reg('E pureza (cenas de fim de tempo)', 'sem cenas', 'hashMundo igual', false);
  else reg('E pureza: hashMundo antes = depois (cenas de fim de tempo)', `${cenasC.filter(x => x.hashIgual).length}/${cenasC.length}`, 'todas', cenasC.every(x => x.hashIgual));
  if (!cenasD.length) reg('E pureza (gol com torcida e treinador)', 'sem cenas', 'hashMundo igual', false);
  else reg('E pureza: hashMundo antes = depois (gol com os cortes, sem eles e com o treinador)', `${cenasD.filter(x => x.hashIgual).length}/${cenasD.length}`, 'todas', cenasD.every(x => x.hashIgual));
}

// ------------------------------------------------------------------------------------------------ G) custo
if (roda('G')) {
  if (!custosA.length) reg('G custo por tick (p95)', 'sem cenas', '≤ 0,6 ms', false);
  else {
    // a melhor de 3 medidas por situação (a máquina é dividida: uma preempção não estraga a medida)
    const L = await LC.carregarCenas(pastaJs);
    const por = [];
    const base = LC.estadoDoMeio(L, 3, 1500);
    for (const sit of SITUACOES) {
      let melhor = Infinity;
      for (let rep = 0; rep < 3; rep++) {
        const m = structuredClone(base);
        const ev = LC.forcarCartao(L, m, sit);
        if (!ev) continue;
        const c = CC.criarCenaCartao(CC.planejarCartao(ev.m, CC.escolherCartao(ev.eventos)), ev.m);
        const ms = [];
        while (!c.acabou) { const t0 = performance.now(); CC.passoCenaCartao(c); ms.push(performance.now() - t0); }
        melhor = Math.min(melhor, p95(ms));
      }
      por.push(melhor);
    }
    reg('G custo da cena de cartão por tick (p95; a melhor de 3 por situação; 24–25 atores)', `${por.map(f3).join(' / ')} ms (no canhão, p95 de tudo: ${f3(p95(custosA))} ms)`, '≤ 0,6 ms', Math.max(...por) <= 0.6);
    if (cenasC.length) {
      const msC = cenasC.flatMap(x => x.r.ms);
      reg('G custo da cena de fim de tempo por tick (p95 de todas; 25–27 atores)', `${f3(p95(msC))} ms`, '≤ 0,6 ms', p95(msC) <= 0.6);
    }
  }
}

imprimir();
process.exit(falhas ? 1 : 0);
