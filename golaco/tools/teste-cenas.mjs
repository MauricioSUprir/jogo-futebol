// Cena do CARTÃO (pedido do dono de 22/10: "as cenas de cartões"; PLANO-CENAS.md §3.6; porte do teste da branch
// golaco/cenas-jogo, com o fim de tempo e os cortes do gol fora — PRs 3/4 e §9.8). Contas PURAS em Node (js/cena-atores.js,
// js/cena-cartao.js, render/emocao.js):
//   A) canhão de cartões a partir de estados do MEIO da partida (montarFalta + regrasPartida, como o teste-faltas): 8
//      estados × 6 situações (amarelo; vermelho direto; 2º amarelo; pênalti com amarelo; vantagem → gol, com a cena
//      montada no passo antes da saída, gol + 149, como a página; goleiro expulso) × 3 variações forçadas = 144 cenas, com
//      as cópias dos treinadores na área técnica (tecnicos.js treinadorDoTime, ids 210/211; PLANO-CENAS.md R1); por tick:
//      árbitro (mão do cartão ≥ 0,25 m acima do topo da cabeça ≥ 1,2 s contínuos, 1,5–3,2 m do punido, o cartão a ≤ 35° da
//      câmera e sem ninguém na frente no plano 'arbitro'), IFAB (A1, V2: só o capitão e o punido a < 4 m do árbitro), as
//      assinaturas das 6 variações, o expulso (termina com z > 34, chegando ao túnel em todo o plano do túnel), corpo (NaN,
//      ossos ±0,5 cm, pé plantado ≤ 0,05 m/s, pé no ar pela régua do teste-patinacao, pelves ≥ 0,4 m, todo salto > 0,5
//      m/tick junto com um corte), câmera (nunca dentro de sólido nem do gol, ≤ 5,5 m além das linhas, lente ≥ 2,5 m, o
//      punido no quadro ≥ 95% em 16:9 e 844/390 com ≥ 25% da altura no plano 'reacao'), os treinadores sem sair do lugar
//      (as cópias onde os vivos ficam: 6 s de passoTecnicos com o mundo parado), a bola parada (quem começou a > 0,6 m dela
//      não pisa nem passa por cima), o cartão no alto ≥ 1,0 s no plano do árbitro com a mão + 6 cm no quadro do PC e do
//      celular, o companheiro parado depois da elipse do túnel e as durações; A-L: 48 vermelhos na lateral de cá (z = 30),
//      a câmera, o corpo, a bola, o expulso e o companheiro;
//   B) variedade: escolherVariante em 2000 sequências (amarelo e vermelho com memórias separadas): nunca a mesma seguida;
//      em 100 cartões seguidos cada variação ≥ 25%; exclusão por falta de companheiro ≤ 10% no canhão A;
//   E) pureza: hashMundo antes = depois de cada cena, m.tick igual e NADA escrito no mundo (o mundo inteiro serializado
//      antes = depois); a cena com a página lendo cada passo (escolherCartao) não muda a partida;
//   F) relógio do estádio: relogioEstadio anda com o laço segurado (a festa — bandeirão, fogo dos sinalizadores — anda
//      junto) e, sem espera, é o relógio de antes (idêntico);
//   G) custo: CPU do fio por tick ≤ 0,6 ms (a meta da comemoração, teste-comemoracao 12): a mediana de 5 medidas por
//      situação, a parede MENOS a espera na fila do escalonador (/proc/thread-self/schedstat);
//   P) o plano da torcida do vermelho no trilho do pré-jogo do estádio (a planta: Maracanã e 6 genéricos, e o padrão);
//   C) o INTERVALO (PR 3, PLANO-CENAS.md §4.6; js/cena-fim.js): 56 intervalos de partidas IA × IA (do jeito que acabaram,
//      gol no último lance, vermelho e amarelo no último apito — o time com 10 —, goleiro expulso; metade com o bloco dos
//      lances): os planos e os tempos do plano, as fases na ordem, a espera dos lances (9,0 s, a cena parada), a tarja do
//      placar em [4, 12) s, o árbitro apita, corpo e câmera (as contas do A), ninguém dentro de sólido, 2 s depois do apito
//      ninguém acima de 1,6 m/s, mãos na cintura ≥ 60%, os apertos de mão (todo par planejado — só os ao alcance — aperta;
//      ≥ 60% das cenas com algum), o túnel (cada um entrou na boca ou anda para ela), o campo vazio depois, a bola do apito
//      no ar cai, os treinadores na área técnica, o toque = o próximo bloco e o pulo = o geral; E (pureza e a saída do 2º
//      tempo no mesmo tick) e G (custo) também cobrem o intervalo.
//   FIM) o PÓS-JOGO (PR 4, PLANO-CENAS.md §5.6; js/cena-fim.js 'fimDeJogo', sumula.js melhorEmCampo): 56 fins de partidas IA × IA
//      (do jeito que acabaram, gol no último lance, vermelho e amarelo no último apito — o time com 10 —, goleiro expulso e o
//      empate que continua no TM, a versão curta) em vitória, derrota e empate: os planos e os tempos (vitória 34,5 s, empate
//      32 s, +1,5 s com a troca de camisa, −2 s sem os treinadores, curto 14,5 s), as fases na ordem, o árbitro apita, corpo e
//      câmera, ninguém em sólido, os cumprimentos (os pares, o árbitro), a troca de camisa (o par permitido, lado a lado,
//      abraçados, cada um com a camisa do outro), o melhor em campo = o argmax de um código independente e a nota = a do
//      resultado do TM, o close dele no quadro, o aperto dos treinadores, as tarjas no plano delas, o toque = o próximo bloco
//      e a festa/vaia do fim (festa.js/emocao.js 'cenaFim'); E (pureza) e G (custo) também cobrem o pós-jogo.
// Na base (sem os módulos) cada seção REPROVA com o motivo.
//   node tools/teste-cenas.mjs [--js <pasta js>] [--so A,B,C,E,F,FIM,G,P] [--detalhe] [--sem-fim 700] [--min-fim 0.3]
import fs from 'node:fs';
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
  // a bola do mundo (parada no lugar do apito: a página a desenha durante a cena): quem começou a mais de 0,6 m dela não
  // pisa nem passa por cima dela — o tornozelo e a ponta do pé fora dela (≥ o raio, do centro) e o centro do corpo a
  // ≥ 0,25 m (antes os atores andavam por cima dela: 41 de 120 cenas do canhão)
  const bp = c.mF.bola.p, RB = C.BOLA.raio;
  const longeDaBola = c.atores.filter(a => a.ativo && Math.hypot(a.j.x - bp.x, a.j.z - bp.z) > 0.6);
  r.bolaPe = Infinity; r.bolaCorpo = Infinity; r.naBola = 0; r.piorBola = null;
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
      // (o plano geral do estádio — camera.js CAMERA_GERAL, o mesmo do jogo — também na espera dos lances e nas estatísticas
      // do intervalo: fora das contas de câmera de cena)
      // (e o do placar do pós-jogo)
      if (pc.nome === 'fim' || pc.nome === 'geral' || pc.nome === 'lances' || pc.nome === 'estatisticas' || pc.nome === 'placar') return;
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
    // a bola
    if (bp.y < 0.6) for (const a of longeDaBola) {
      if (!a.ativo) continue;
      const o = a.atu;
      let pe = Infinity;
      for (const k of [J.tornozeloE, J.pontaE, J.tornozeloD, J.pontaD]) pe = Math.min(pe, Math.hypot(o[k * 3] - bp.x, o[k * 3 + 1] - bp.y, o[k * 3 + 2] - bp.z));
      const dc = Math.hypot(a.j.x - bp.x, a.j.z - bp.z);
      if (pe < r.bolaPe) r.bolaPe = pe;
      if (dc < r.bolaCorpo) r.bolaCorpo = dc;
      if (pe < RB || dc < 0.25) { r.naBola++; if (!r.piorBola || pe < r.piorBola.pe) r.piorBola = { id: a.id, tipo: a.tipo, plano: nome, t: +t.toFixed(2), pe: +pe.toFixed(3), corpo: +dc.toFixed(3) }; }
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
    if (opc.por) opc.por(c, t, nome, pcs[0], pcs);
  }
  r.duracao = c.kFim * PASSO;
  r.n = n0;
  return r;
}
const okCorpo = r => r.nan === 0 && r.osso <= 0.005 && r.plantado <= 0.05 && r.razao <= 1 && r.pelve >= 0.4 && r.saltoSemCorte === 0;
const okCamera = r => r.solido === 0 && r.foraLimite === 0 && r.noGol === 0 && r.lente >= 2.5;
const okBola = r => r.naBola === 0;
const resumoBola = rs => `${rs.filter(r => !okBola(r)).length} cenas com alguém na bola; o pé mais perto ${f3(Math.min(...rs.map(r => r.bolaPe)))} m do centro, o corpo ${f3(Math.min(...rs.map(r => r.bolaCorpo)))} m`;
const resumoCorpo = rs => `NaN ${rs.reduce((s, r) => s + r.nan, 0)}, osso ${f2(Math.max(...rs.map(r => r.osso)) * 1000)} mm, plantado ${f3(Math.max(...rs.map(r => r.plantado)))} m/s, ar ${f2(Math.max(...rs.map(r => r.razao)))}, pelve ${f3(Math.min(...rs.map(r => r.pelve)))} m, saltos sem corte ${rs.reduce((s, r) => s + r.saltoSemCorte, 0)}`;
const resumoCamera = rs => `sólido ${rs.reduce((s, r) => s + r.solido, 0)}, fora do limite ${rs.reduce((s, r) => s + r.foraLimite, 0)}, no gol ${rs.reduce((s, r) => s + r.noGol, 0)}, lente mín ${f2(Math.min(...rs.map(r => r.lente)))} m`;

// ------------------------------------------------------------------------------------------------ A) canhão de cartões
const CC = await tentar('cena-cartao.js');
const CA = await tentar('cena-atores.js');
const TEC = await tentar('tecnicos.js');
/**
 * O mundo inteiro numa string (a pureza: nada escrito no mundo — nem o que o hashMundo não cobre). Typed arrays viram listas,
 * Map e Set viram as entradas; funções ficam de fora.
 */
function serializar(m) {
  const vistos = new WeakSet();
  return JSON.stringify(m, (k, v) => {
    if (typeof v === 'function') return undefined;
    if (ArrayBuffer.isView(v)) return Array.from(v);
    if (v instanceof Map) return ['Map', ...v.entries()];
    if (v instanceof Set) return ['Set', ...v.values()];
    if (v && typeof v === 'object') { if (vistos.has(v)) return '[ref]'; vistos.add(v); }
    return v;
  });
}
/**
 * As cópias dos treinadores da página ONDE OS VIVOS ESTÃO (tecnicos.js): criados com os times do mundo e andando 6 s com o
 * mundo parado no apito — seguem a bola na área técnica e recuam com ela perto da linha de cá, como na partida (antes
 * ficavam no ponto de partida, ±11 m, e a lente dos planos do túnel nunca passava perto deles). Um por mundo (as 3 variações
 * de uma situação partem do mesmo mundo).
 */
const _tecCache = new Map();
function treinadoresDe(m, chave = null) {
  if (!TEC || !m.times) return null;
  if (chave != null && _tecCache.has(chave)) return _tecCache.get(chave).map(o => o && { ...o });
  const T = TEC.criarTecnicos(m.times, m.semente ?? 1);
  const L = TEC.leituraDoMundo(m, []);
  for (let k = 0; k < 360; k++) TEC.passoTecnicos(T, L);
  const out = [TEC.treinadorDoTime(T, 0), TEC.treinadorDoTime(T, 1)];
  if (chave != null) _tecCache.set(chave, out);
  return out.map(o => o && { ...o });
}
const LC = await import(pathToFileURL(path.join(AQUI, 'lib/cenas-node.mjs')).href);
const SITUACOES = ['amarelo', 'vermelho', 'segundo', 'penalti', 'vantagemGol', 'goleiro'];
const ESTADOS = [[3, 900], [5, 2600], [7, 900], [11, 3400], [13, 1900], [17, 4300], [19, 2200], [23, 3000]];
const cenasA = [];
const cenasL = [];
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
          const h0 = S.hashMundo(ev.m), t0 = ev.m.tick, s0 = serializar(ev.m);
          const plano = CC.planejarCartao(ev.m, cartao, { variante: vf, treinadores: treinadoresDe(ev.m, `${sem}|${tk}|${sit}`) });
          total++;
          if (plano.variante !== vf) excluidas++;
          const c = CC.criarCenaCartao(plano, ev.m);
          const medida = medirCartao(c);
          medida.hashIgual = S.hashMundo(ev.m) === h0 && ev.m.tick === t0;
          medida.mundoIgual = serializar(ev.m) === s0;
          medida.sit = sit; medida.sem = sem; medida.tk = tk; medida.vf = vf; medida.variante = plano.variante;
          cenasA.push(medida);
          custosA.push(...medida.r.ms);
        }
      }
    }
    cenasA.faltou = faltou; cenasA.excluidas = excluidas; cenasA.total = total;
    // A-L: o vermelho na lateral de CÁ (z = 30, perto do túnel e da área técnica): no x do lance e em x = 5 — o expulso sai
    // por perto de quem ficou no lance e a lente do túnel passa junto dos treinadores
    for (const [sem, tk] of ESTADOS) {
      const base = LC.estadoDoMeio(L, sem, tk);
      for (const xL of [null, 5]) {
        for (const vf of CC.VERMELHOS) {
          const m = structuredClone(base);
          const ev = LC.forcarCartao(L, m, 'vermelho', { z: 30, x: xL });
          if (!ev) continue;
          const plano = CC.planejarCartao(ev.m, CC.escolherCartao(ev.eventos), { variante: vf, treinadores: treinadoresDe(ev.m, `L|${sem}|${tk}|${xL}`) });
          const medida = medirCartao(CC.criarCenaCartao(plano, ev.m));
          medida.sit = 'lateral'; medida.sem = sem; medida.tk = tk; medida.vf = vf; medida.variante = plano.variante; medida.xL = xL;
          cenasL.push(medida);
        }
      }
    }
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
    tecN: c.treinadores?.length ?? 0, tecAnda: 0, tecX0: (c.treinadores ?? []).map(a => [a.j.x, a.j.z]),
    // o cartão no alto DENTRO do plano do árbitro com a mão + 6 cm no quadro (PC e celular), por cor; o companheiro depois
    // da elipse do túnel (0,5 s depois do corte)
    altoArbVisto: {}, apoioTunel: 0,
  };
  const tTunel = P.planos.find(p => p.nome === 'tunel')?.t0 ?? Infinity;
  const tReacao = T.reacao, tFimP2 = T.fimReacao;
  const fx = (o, h) => [Math.cos(h), Math.sin(h)];
  x.r = andarCena(c, {
    passo: CC.passoCenaCartao, planoCamera: CC.planoCameraCartao, criarPlano: CC.criarPlanoCameraCartao,
    assunto: (cc, nome) => (nome === 'arbitro' || nome === 'reacao' ? cc.punido : null),
  }, {
    por: (cc, t, nome, pc, pcs) => {
      const o = arb.atu, po = pun.atu;
      if (cc.apoio && cc.saidaTunel && t >= tTunel + 0.5) x.apoioTunel = Math.max(x.apoioTunel, Math.hypot(cc.apoio.j.vx, cc.apoio.j.vz));
      // os treinadores (cópias) ficam onde estavam: na área técnica, parados (Regra 1)
      (cc.treinadores ?? []).forEach((a, i) => { x.tecAnda = Math.max(x.tecAnda, Math.hypot(a.j.x - x.tecX0[i][0], a.j.z - x.tecX0[i][1])); });
      const topo = o[J.cabeca * 3 + 1] + TOPO;
      const alto = o[J.maoD * 3 + 1] - topo >= 0.25;
      x.maoTicks.push(alto ? 1 : 0);
      x.corTicks.push(alto ? cc.corVisivel : null);
      if (alto && nome === 'arbitro' && cc.corVisivel) {
        const tx = o[J.maoD * 3], ty = o[J.maoD * 3 + 1] + 0.06, tz = o[J.maoD * 3 + 2];
        const dentro = pcs.every((q, k) => { const pr = projetor(q, ASPECTOS[k][2])(tx, ty, tz, _pr); return pr[2] > 0.1 && Math.abs(pr[0]) <= 0.95 && Math.abs(pr[1]) <= 0.95; });
        if (dentro) x.altoArbVisto[cc.corVisivel] = (x.altoArbVisto[cc.corVisivel] ?? 0) + 1;
      }
      if (alto) {
        const d = Math.hypot(o[J.pelve * 3] - po[J.pelve * 3], o[J.pelve * 3 + 2] - po[J.pelve * 3 + 2]);
        x.distAlto[0] = Math.min(x.distAlto[0], d); if (d > x.distAlto[1]) { x.distAlto[1] = d; x.tAlto = +t.toFixed(2); }
        if (nome === 'arbitro') {
          // o cartão visível: a reta da lente até ele (a mão + 7 cm) longe da cabeça, do pescoço, dos ombros e do peito de
          // todo mundo (o punido e o capitão que entra entre os dois, sobretudo)
          {
            const tx = o[J.maoD * 3], ty = o[J.maoD * 3 + 1] + 0.07, tz = o[J.maoD * 3 + 2];
            const dx = tx - pc.de[0], dy = ty - pc.de[1], dz = tz - pc.de[2], l2 = dx * dx + dy * dy + dz * dz;
            let dmin = Infinity;
            for (const at of cc.atores) {
              if (!at.ativo || at === arb) continue;
              const pa = at.atu;
              for (const [k, raio] of [[J.cabeca, 0.13], [J.pescoco, 0.08], [J.ombroE, 0.08], [J.ombroD, 0.08], [J.peito, 0.14]]) {
                const qx = pa[k * 3], qy = pa[k * 3 + 1], qz = pa[k * 3 + 2];
                const w = Math.max(0, Math.min(1, ((qx - pc.de[0]) * dx + (qy - pc.de[1]) * dy + (qz - pc.de[2]) * dz) / l2));
                dmin = Math.min(dmin, Math.hypot(pc.de[0] + dx * w - qx, pc.de[1] + dy * w - qy, pc.de[2] + dz * w - qz) - raio);
              }
            }
            x.altoArb = (x.altoArb ?? 0) + 1;
            if (dmin < 0.1) x.tampado = (x.tampado ?? 0) + 1;   // (o cartão tem 11 × 16 cm: a 10 cm da borda já some parte dele)
          }
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
  reg('A bola parada: quem começou a > 0,6 m dela não pisa nela (tornozelo e ponta ≥ 11 cm do centro) nem passa por cima (corpo ≥ 0,25 m)', resumoBola(rs), '0 cenas', rs.every(okBola));
  if (detalhe) for (const x of cenasA) if (!okBola(x.r)) console.log('bola', x.sit, x.sem, x.tk, x.variante, x.r.naBola, JSON.stringify(x.r.piorBola));
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
  // (§3.6 A: o cartão no alto ≥ 1,0 s NO PLANO DO ÁRBITRO — o 2º amarelo: o amarelo ≥ 0,9 s, o vermelho ≥ 1,0 s —, com a mão
  // + 6 cm dentro do quadro no PC e no celular; antes o vermelho do 2º amarelo caía quase todo no plano da reação, que no
  // celular não o mostrava, e o vermelho direto ficava 0,95 s no do árbitro)
  const okAltoArb = x => {
    const v = x.altoArbVisto;
    if (x.plano.segundo) return (v.amarelo ?? 0) >= 54 && (v.vermelho ?? 0) >= 60;
    return (v[x.plano.cor] ?? 0) >= 60;
  };
  const ruinsAA = cenasA.filter(x => !okAltoArb(x));
  const minAA = (cor, f) => Math.min(...cenasA.filter(f).map(x => x.altoArbVisto[cor] ?? 0)) / 60;
  reg('A o cartão no alto dentro do plano do árbitro, a mão + 6 cm no quadro do PC e do celular', `${cenasA.length - ruinsAA.length}/${cenasA.length} cenas; menor: amarelo ${f2(minAA('amarelo', x => x.plano.cor === 'amarelo'))} s, vermelho ${f2(minAA('vermelho', x => x.plano.cor === 'vermelho' && !x.plano.segundo))} s, 2º amarelo ${f2(minAA('amarelo', x => x.plano.segundo))} + ${f2(minAA('vermelho', x => x.plano.segundo))} s`, '≥ 1,0 s (2º amarelo: o amarelo ≥ 0,9 s e o vermelho ≥ 1,0 s)', !ruinsAA.length);
  if (detalhe) for (const x of ruinsAA) console.log('alto no plano do arbitro', x.sit, x.sem, x.tk, x.variante, JSON.stringify(x.altoArbVisto));
  const dmin = Math.min(...cenasA.map(x => x.distAlto[0])), dmax = Math.max(...cenasA.map(x => x.distAlto[1]));
  reg('A árbitro: distância ao punido com o cartão no alto', `${f2(dmin)}–${f2(dmax)} m`, '1,5–3,2 m', dmin >= 1.5 && dmax <= 3.2);
  if (detalhe) for (const x of cenasA) if (x.distAlto[0] < 1.5 || x.distAlto[1] > 3.2) console.log('distancia', x.sit, x.sem, x.variante, x.distAlto.map(f2).join('–'), x.tAlto);
  const tamp = Math.max(...cenasA.map(x => (x.tampado ?? 0) / Math.max(1, x.altoArb ?? 0)));
  reg('A o cartão no alto não fica atrás de ninguém (cabeça, pescoço, ombros, peito) no plano do árbitro', `pior cena ${f2(100 * tamp)}% dos ticks com o cartão no alto`, '≤ 10%', tamp <= 0.1);
  if (detalhe) for (const x of cenasA) if ((x.tampado ?? 0) / Math.max(1, x.altoArb ?? 0) > 0.1) console.log('tampado', x.sit, x.sem, x.variante, x.tampado, x.altoArb);
  const ang = Math.max(...cenasA.map(x => x.angCartao));
  reg('A o cartão de frente para a câmera no plano do árbitro', `pior ${f2(ang)}°`, '≤ 35°', ang <= 35);
  const ifab = cenasA.filter(x => x.plano.variante === 'abertos' || x.plano.variante === 'segurado');
  const pifab = Math.min(...ifab.map(x => x.ifab));
  reg('A IFAB (A1, V2): só o capitão e o punido a < 4 m do árbitro (cartão no alto + 1 s até o fim da reação)', `${ifab.length} cenas; o mais perto ${f2(pifab)} m${detalhe ? ' ' + JSON.stringify(ifab.reduce((a, x) => (x.ifab < a.ifab ? x : a)).piorIfab) : ''}`, '≥ 4 m', ifab.length > 0 && pifab >= 4);
  if (detalhe) for (const x of ifab) if (x.ifab < 4) console.log('ifab', x.sit, x.sem, x.tk, x.variante, JSON.stringify(x.piorIfab));
  // assinaturas
  const de = v => cenasA.filter(x => x.plano.variante === v);
  const A1 = de('abertos'), A2 = de('cabeca'), A3 = de('aceita'), V1 = de('cabisbaixo'), V2 = de('segurado'), V3 = de('rosto');
  reg('A1 braços abertos ≥ 1,0 s e o capitão a ≤ 1,2 m do punido ≥ 0,5 s', `${A1.length} cenas; abertos mín ${f2(Math.min(...A1.map(x => x.abertos)) / 60)} s; capitão perto mín ${f2(Math.min(...A1.map(x => x.capPerto)) / 60)} s`, '≥ 1,0 s; ≥ 0,5 s', A1.length > 0 && A1.every(x => x.abertos >= 60 && x.capPerto >= 30));
  if (detalhe) for (const x of A1) if (x.abertos < 60 || x.capPerto < 30) console.log('A1', x.sit, x.sem, x.tk, x.abertos, x.capPerto);
  reg('A2 mãos na cabeça ≥ 0,8 s, giro ≥ 120°, tapinha nas costas ≥ 0,3 s', `${A2.length} cenas; mãos ${f2(Math.min(...A2.map(x => x.cabecaMaos)) / 60)} s; giro ${f2(Math.min(...A2.map(x => x.giro)) * 180 / Math.PI)}°; tapinha ${f2(Math.min(...A2.map(x => x.tapinha)) / 60)} s`, '≥ 0,8 s; ≥ 120°; ≥ 0,3 s', A2.length > 0 && A2.every(x => x.cabecaMaos >= 48 && x.giro >= 2.094 && x.tapinha >= 18));
  reg('A3 volta trotando: ≥ 3 m/s afastando-se do árbitro', `${A3.length} cenas; mín ${f2(Math.min(...A3.map(x => x.troteMax)) / 60)} s contínuos`, '≥ 1,0 s', A3.length > 0 && A3.every(x => x.troteMax >= 60));
  reg('V1 cabisbaixo: velocidade ≤ 1,4 m/s, cabeça ≥ 20° baixa ≥ 70% da reação à saída; tapinha', `${V1.length} cenas; vel máx ${f2(Math.max(...V1.map(x => x.v1Vel)))} m/s; cabeça baixa mín ${f2(100 * Math.min(...V1.map(x => x.v1Cab / Math.max(1, x.v1N))))}%; tapinha mín ${f2(Math.min(...V1.map(x => x.tapinha)) / 60)} s`, '≤ 1,4; ≥ 70%; ≥ 0,3 s', V1.length > 0 && V1.every(x => x.v1Vel <= 1.4 && x.v1Cab / Math.max(1, x.v1N) >= 0.7 && x.tapinha >= 18));
  reg('V2 segurado: as mãos do capitão ≤ 0,2 m do peito ≥ 0,8 s e o punido recua ≥ 0,8 m', `${V2.length} cenas; segura mín ${f2(Math.min(...V2.map(x => x.segura)) / 60)} s; recuo mín ${f2(Math.min(...V2.map(x => x.recuo)))} m`, '≥ 0,8 s; ≥ 0,8 m', V2.length > 0 && V2.every(x => x.segura >= 48 && x.recuo >= 0.8));
  reg('V3 rosto: mãos ≤ 0,15 m do rosto ≥ 1,5 s e depois palmas acima da cabeça', `${V3.length} cenas; rosto mín ${f2(Math.min(...V3.map(x => x.rosto)) / 60)} s; palmas mín ${f2(Math.min(...V3.map(x => x.palmas)) / 60)} s`, '≥ 1,5 s; ≥ 0,3 s', V3.length > 0 && V3.every(x => x.rosto >= 90 && x.palmas >= 18));
  if (detalhe) for (const x of V1) if (x.tapinha < 18) console.log('V1 tapinha', x.sit, x.sem, x.tk, f2(x.tapinha / 60), 'apoio', x.plano.apoio, f2(x.plano.apoioDist));
  if (detalhe) for (const x of V2) if (x.segura < 48 || x.recuo < 0.8) console.log('V2', x.sit, x.sem, x.tk, 'segura', f2(x.segura / 60), 'recuo', f2(x.recuo));
  const verm = cenasA.filter(x => x.plano.cor === 'vermelho');
  const comApoio = verm.filter(x => x.plano.apoio != null);
  const apT = Math.max(0, ...comApoio.map(x => x.apoioTunel));
  reg('A o companheiro fica no campo depois da elipse do túnel (velocidade 0,5 s depois do corte)', `${comApoio.length} cenas com companheiro; o mais rápido ${f2(apT)} m/s`, '≤ 1,0 m/s', comApoio.length > 0 && apT <= 1.0);
  if (detalhe) for (const x of comApoio) if (x.apoioTunel > 1.0) console.log('apoio no tunel', x.sit, x.sem, x.tk, x.variante, f2(x.apoioTunel));
  reg('A expulso: termina fora do campo (z > 34) e a distância ao túnel cai em todo o plano do túnel', `${verm.length} cenas; z final mín ${f2(Math.min(...verm.map(x => x.zFim ?? -99)))}; caindo em ${f2(100 * Math.min(...verm.map(x => x.tunelSobe / Math.max(1, x.tunelN))))}% dos ticks (pior)`, 'z > 34; 100%', verm.length > 0 && verm.every(x => x.zFim > 34 && x.tunelSobe === x.tunelN && x.tunelN > 60));
  // durações
  const dur = x => x.r.duracao, am = cenasA.filter(x => x.plano.cor === 'amarelo'), vs = verm.filter(x => !x.plano.segundo), sg = verm.filter(x => x.plano.segundo);
  reg('A durações (amarelo / vermelho / 2º amarelo)', `${f2(Math.min(...am.map(dur)))}–${f2(Math.max(...am.map(dur)))} / ${f2(Math.min(...vs.map(dur)))}–${f2(Math.max(...vs.map(dur)))} / ${f2(Math.min(...sg.map(dur)))}–${f2(Math.max(...sg.map(dur)))} s`, '4,8–5,6 / 8,5–9,0 / 9,5–10,0 s',
    am.every(x => dur(x) >= 4.8 && dur(x) <= 5.6) && vs.every(x => dur(x) >= 8.5 && dur(x) <= 9.0) && sg.length > 0 && sg.every(x => dur(x) >= 9.5 && dur(x) <= 10.0));
  reg('A situações: amarelo, vermelho, 2º amarelo, pênalti com cartão, vantagem → gol, goleiro expulso', SITUACOES.map(s => `${s} ${cenasA.filter(x => x.sit === s).length}`).join(', '), '24 de cada', SITUACOES.every(s => cenasA.filter(x => x.sit === s).length === 24));
  // os treinadores: as duas cópias em toda cena (PLANO-CENAS.md R1: os vivos ficam parados e fora do desenho na página) e
  // nenhuma sai do lugar (≤ 5 cm: o giro parado ajeita os pés)
  const tecAnda = Math.max(...cenasA.map(x => x.tecAnda));
  reg('A treinadores: as 2 cópias na cena, paradas na área técnica', `${cenasA.filter(x => x.tecN === 2).length}/${cenasA.length} cenas com as 2; o que mais andou: ${f3(tecAnda)} m`, 'todas; ≤ 0,05 m', cenasA.every(x => x.tecN === 2) && tecAnda <= 0.05);
}
if (cenasL.length) {
  const rs = cenasL.map(x => x.r);
  reg('A-L vermelho na lateral de cá (z = 30; no x do lance e em x = 5), os treinadores onde os vivos estão', `${cenasL.length} cenas (${['cabisbaixo', 'segurado', 'rosto'].map(v => `${v} ${cenasL.filter(x => x.variante === v).length}`).join(', ')})`, '48', cenasL.length === 48, true);
  reg('A-L câmera: fora de sólidos, ≤ 5,5 m além das linhas, fora do gol, lente ≥ 2,5 m (também a dos treinadores)', resumoCamera(rs), '0, 0, 0, ≥ 2,5 m', rs.every(okCamera));
  if (detalhe) for (const x of cenasL) if (!okCamera(x.r)) console.log('camera L', x.sem, x.tk, x.xL, x.variante, JSON.stringify({ lente: x.r.piorLente, solido: x.r.piorSolido }));
  reg('A-L corpo (as metas do canhão)', resumoCorpo(rs), '0, ≤ 5 mm, ≤ 0,05, ≤ 1,0, ≥ 0,40, 0', rs.every(okCorpo));
  if (detalhe) for (const x of cenasL) if (!okCorpo(x.r)) console.log('corpo L', x.sem, x.tk, x.xL, x.variante, JSON.stringify({ osso: x.r.osso, pl: x.r.piorPlantado, pe: x.r.piorPe, pelve: x.r.piorPelve, salto: x.r.piorSalto }));
  reg('A-L bola parada (as metas do canhão)', resumoBola(rs), '0 cenas', rs.every(okBola));
  if (detalhe) for (const x of cenasL) if (!okBola(x.r)) console.log('bola L', x.sem, x.tk, x.xL, x.variante, x.r.naBola, JSON.stringify(x.r.piorBola));
  reg('A-L expulso: termina fora do campo (z > 34) e a distância ao túnel cai em todo o plano do túnel', `z final mín ${f2(Math.min(...cenasL.map(x => x.zFim ?? -99)))}; caindo em ${f2(100 * Math.min(...cenasL.map(x => x.tunelSobe / Math.max(1, x.tunelN))))}% dos ticks (pior)`, 'z > 34; 100%', cenasL.every(x => x.zFim > 34 && x.tunelSobe === x.tunelN && x.tunelN > 60));
  const ap = cenasL.filter(x => x.plano.apoio != null);
  reg('A-L o companheiro fica no campo depois da elipse do túnel', `${ap.length} cenas com companheiro; o mais rápido ${f2(Math.max(0, ...ap.map(x => x.apoioTunel)))} m/s`, '≤ 1,0 m/s', ap.every(x => x.apoioTunel <= 1.0));
}

// ------------------------------------------------------------------------------------------------ B) variedade
if (roda('B')) {
  if (!CA || typeof CA.escolherVariante !== 'function') {
    reg('B variedade (cena-atores.js escolherVariante)', 'não existe', 'existe', false);
  } else {
    let rep = 0;
    const conta = { amarelo: {}, vermelho: {} };
    const listas = { amarelo: CC ? CC.AMARELOS : ['abertos', 'cabeca', 'aceita'], vermelho: CC ? CC.VERMELHOS : ['cabisbaixo', 'segurado', 'rosto'] };
    let piorFrac = 1;
    for (let k = 0; k < 2000; k++) {
      const ult = { amarelo: null, vermelho: null }, pen = { amarelo: null, vermelho: null };
      const n = { amarelo: {}, vermelho: {} };
      for (let i = 0; i < 100; i++) {
        for (const cor of ['amarelo', 'vermelho']) {
          const v = CA.escolherVariante(5000 + k * 7919 + i * 613, (k * 13 + i * 5) % 46 + 1, ult[cor], listas[cor], pen[cor]);
          if (v === ult[cor]) rep++;
          pen[cor] = ult[cor]; ult[cor] = v;
          n[cor][v] = (n[cor][v] ?? 0) + 1; conta[cor][v] = (conta[cor][v] ?? 0) + 1;
        }
      }
      for (const cor of ['amarelo', 'vermelho']) for (const v of listas[cor]) piorFrac = Math.min(piorFrac, (n[cor][v] ?? 0) / 100);
    }
    reg('B 2000 sequências de 100: nunca a mesma em seguida (amarelo, vermelho)', `${rep} repetidas; ${Object.entries(conta).map(([c, o]) => `${c} ${Object.values(o).map(v => f2(v / 2000)).join('/')}`).join('; ')}`, '0', rep === 0);
    reg('B em 100 cartões seguidos cada variação ≥ 25%', `pior ${f2(100 * piorFrac)}%`, '≥ 25%', piorFrac >= 0.25);
    if (cenasA.length) reg('B variação excluída por falta de companheiro a ≤ 15 m (canhão A)', `${cenasA.excluidas}/${cenasA.total} (${f2(100 * cenasA.excluidas / Math.max(1, cenasA.total))}%)`, '≤ 10%', cenasA.excluidas / Math.max(1, cenasA.total) <= 0.1);
  }
}

// ------------------------------------------------------------------------------------------------ C) intervalo
// (PLANO-CENAS.md §4.6) 56 intervalos de partidas IA × IA (2 × 0,5 min): 20 do jeito que acabaram, 12 com GOL no último lance
// (a bola entrando quando faltam ≤ 40 ticks: o apito vem no fim da pausa do gol), 10 com VERMELHO no último apito (o time com 10), 4
// com AMARELO no último apito e 10 com o GOLEIRO expulso (DOGSO: o de linha mais perto vai para o gol); metade com o bloco
// dos lances (2 lances: a cena espera e a página toca), metade sem; com as cópias dos treinadores. Os planos e os tempos
// são os do plano (não lidos do módulo).
const CF = await tentar('cena-fim.js');
const cenasC = [];
const custosC = [];
const PLANOS_INTERVALO = [['apito', 1.5], ['campo', 2.5], ['tunel', 3.5], ['torcida', 1.5], ['lances', 0], ['estatisticas', 6.0], ['geral', 3.0]];
const CASOS_C = [['natural', 20], ['gol', 12], ['vermelho', 10], ['amarelo', 4], ['goleiro', 10]];
const TARJA_C = [4.0, 12.0];      // a tarja do placar: 4 s depois do apito, 8 s (DFL; PLANO-CENAS.md §4.1)
const BOCA = 44.5, ENTRA = 44.0;  // a boca do túnel (config.js ESTADIO.tunel.z) e onde quem chega some dentro dela
const VAZIO_C = new Set(['torcida', 'lances', 'estatisticas', 'geral']);
if (roda('C') || roda('E') || roda('G')) {
  if (!CF) reg('C cena do intervalo (js/cena-fim.js)', 'não existe: no apito do 1º tempo só a faixa de 3 s com o mundo parado', 'existe', false);
  else {
    const L = await LC.carregarCenas(pastaJs);
    let sem = 300, falhou = [];
    for (const [caso, n] of CASOS_C) {
      for (let i = 0; i < n; i++) {
        let r = null, tent = 0;
        while (!r && tent < 6) {
          sem++; tent++;
          const forcar = caso === 'natural' ? null
            : caso === 'gol' ? m => LC.forcarGol(L, m)
              : m => !!LC.forcarCartao(L, m, caso === 'goleiro' ? 'goleiro' : caso, { semBusca: true });
          const x = LC.ateIntervalo(L, sem, { min: 0.5, forcar, margem: 40 });
          if (!x) continue;
          // o caso valeu? (o gol no último lance: o apito no fim da pausa do gol — PARTIDA.golPausa, ±1 tick do evento; o
          // cartão: o expulso fora, o time com 10)
          const exp = x.m.expulsos ?? [];
          if (caso === 'gol' && !(x.forcado && x.golTick != null && Math.abs(x.m.tick - x.golTick - Math.round(C.PARTIDA.golPausa / PASSO)) <= 1)) continue;
          if ((caso === 'vermelho' || caso === 'goleiro') && !(x.forcado && exp.length >= 1)) continue;
          if (caso === 'goleiro' && !exp.some(j => j.posicao === 'GOL' || j.vagaId === 'GOL')) continue;
          if (caso === 'amarelo' && !x.forcado) continue;
          r = x;
        }
        if (!r) { falhou.push(`${caso}#${i}`); continue; }
        const m = r.m;
        const h0 = S.hashMundo(m), t0 = m.tick, s0 = serializar(m);
        const nLances = cenasC.length % 2 ? 2 : 0;
        const tecs = treinadoresDe(m, `C|${sem}`);
        const plano = CF.planejarFim(m, 'intervalo', { placar: m.placar, timeHumano: 0, lances: nLances, treinadores: tecs });
        const c = CF.criarCenaFim(plano, m);
        const x = medirIntervalo(c);
        x.hashIgual = S.hashMundo(m) === h0 && m.tick === t0;
        x.mundoIgual = serializar(m) === s0;
        x.caso = caso; x.sem = sem; x.nLances = nLances; x.placar = { ...m.placar }; x.expulsos = (m.expulsos ?? []).length;
        x.time10 = [0, 1].some(t => m.jogadores.filter(j => j.time === t).length === 10);
        x.gkCampo = [0, 1].every(t => m.jogadores.some(j => j.time === t && j.posicao === 'GOL'));
        if (cenasC.length < 8) x.copia = structuredClone(m);
        cenasC.push(x);
        custosC.push(...x.r.ms);
      }
    }
    cenasC.falhou = falhou;
  }
}

/** Uma cena do intervalo: as medidas comuns + o apito, a cintura, os apertos, o túnel, o campo vazio, a bola e os tempos. */
function medirIntervalo(c) {
  const P = c.plano;
  const jogs = c.atores.filter(a => a.time === 0 || a.time === 1).filter(a => a.tipo !== 'tecnico');
  const arb = c.arbitro, tecs = c.treinadores;
  const x = {
    plano: P, v2: 0, piorV2: null, cintura: new Map(), apertos: new Map(), apito: 0, apitoMax: 0, tunel: new Map(), dentroTunel: 0,
    ativosDepois: 0, bolaDepois: 0, solido: 0, piorSolido: null, esperaK: null, esperaMexeu: false, esperas: 0, depoisEspera: null,
    tarjaErr: 0, tarjaN: 0, tecFora: 0, bolaNoAr: c.mF.bola.p.y > 0.5, bolaTunel: null, fases: [],
  };
  const pCampo = P.planos.find(q => q.nome === 'campo');
  let fAnt = null, espera = 0, kEspera = -1, poseEspera = null;
  x.r = andarCena(c, {
    passo: cc => {
      if (cc.emLances) {
        if (kEspera < 0) { kEspera = cc.k; poseEspera = cc.atores.map(a => a.atu.slice()); x.esperaK = cc.k; }
        espera++; x.esperas++;
        if (cc.k !== kEspera) x.esperaMexeu = true;
        if (espera >= 20) CF.seguirCenaFim(cc);
        return;
      }
      CF.passoCenaFim(cc);
    },
    planoCamera: CF.planoCameraFim, criarPlano: CF.criarPlanoCameraFim,
  }, {
    max: Math.round((P.duracao + 3.0) / PASSO) + 40,
    por: (cc, t, nome) => {
      const f = CF.faseFim(cc);
      if (f !== fAnt) { x.fases.push(f); fAnt = f; if (fAnt === 'estatisticas' && x.esperaK != null && x.depoisEspera == null) x.depoisEspera = cc.k; }
      // a tarja do placar exatamente em [4, 12) s do relógio da cena e nunca na espera dos lances
      const tc = cc.k * PASSO, devia = !cc.emLances && tc >= TARJA_C[0] - 1e-9 && tc < TARJA_C[1] - 1e-9;
      x.tarjaN++; if (CF.tarjaPlacarVisivel(cc) !== devia) x.tarjaErr++;
      // 2,0 s depois do apito: ninguém acima de 1,6 m/s (todos desaceleram pela locomoção)
      if (Math.abs(t - 2.0) < PASSO / 2) for (const a of cc.atores) { if (!a.ativo) continue; const v = Math.hypot(a.j.vx, a.j.vz); if (v > x.v2) { x.v2 = v; x.piorV2 = { id: a.id, tipo: a.tipo, v: +v.toFixed(2) }; } }
      // o árbitro apita: a mão direita na boca (≤ 0,22 m da cabeça) no plano do apito
      if (f === 'apito' && arb.ativo) {
        const o = arb.atu, ok = Math.hypot(o[J.maoD * 3] - o[J.cabeca * 3], o[J.maoD * 3 + 1] - o[J.cabeca * 3 + 1], o[J.maoD * 3 + 2] - o[J.cabeca * 3 + 2]) <= 0.22;
        x.apito = ok ? x.apito + 1 : 0; x.apitoMax = Math.max(x.apitoMax, x.apito);
      }
      // ninguém dentro de sólido do estádio (o corpo a 0,9 m; no túnel o vão das placas aberto)
      for (const a of cc.atores) {
        if (!a.ativo) continue;
        const sd = EF.solidoEm(a.j.x, 0.9, a.j.z, 0.2, f === 'tunel');
        if (sd) { x.solido++; x.piorSolido = { id: a.id, f, x: +a.j.x.toFixed(2), z: +a.j.z.toFixed(2), sd }; }
      }
      // os treinadores (cópias) na área técnica até entrarem
      for (const a of tecs) if (a.ativo && !EF.dentroAreaTecnica(a.timeT, a.j.x, a.j.z, 0.6)) x.tecFora++;
      for (const a of jogs) {
        const o = a.atu;
        // mãos na cintura (≤ 0,12 m da articulação do quadril), contínuo
        if (pCampo && t >= pCampo.t0 && t < pCampo.t1 && a.ativo) {
          const ok = Math.hypot(o[J.maoE * 3] - o[J.quadrilE * 3], o[J.maoE * 3 + 1] - o[J.quadrilE * 3 + 1], o[J.maoE * 3 + 2] - o[J.quadrilE * 3 + 2]) <= 0.12
            && Math.hypot(o[J.maoD * 3] - o[J.quadrilD * 3], o[J.maoD * 3 + 1] - o[J.quadrilD * 3 + 1], o[J.maoD * 3 + 2] - o[J.quadrilD * 3 + 2]) <= 0.12;
          const q = x.cintura.get(a) ?? { n: 0, max: 0 };
          q.n = ok ? q.n + 1 : 0; q.max = Math.max(q.max, q.n); x.cintura.set(a, q);
        }
        // no túnel: a distância à boca caindo (quem anda) e ninguém visível passando da boca
        if (f === 'tunel') {
          const q = x.tunel.get(a) ?? { ant: null, cai: 0, n: 0, entrou: false };
          if (a.ativo) {
            const d = Math.hypot(a.j.x, a.j.z - BOCA);
            if (q.ant != null && a.recriado !== cc.k) { q.n++; if (d < q.ant - 1e-6) q.cai++; }
            q.ant = d;
            if (a.j.z > ENTRA + 0.3) x.dentroTunel++;
          } else if (a.entrou != null) q.entrou = true;
          x.tunel.set(a, q);
        }
        // depois do túnel: ninguém em campo (o campo vazio até a saída)
        if (VAZIO_C.has(f) && a.ativo) x.ativosDepois++;
      }
      if (VAZIO_C.has(f) && cc.bolaVisivel) x.bolaDepois++;
      if (f === 'tunel' && x.bolaTunel == null) x.bolaTunel = cc.mF.bola.p.y;
      // apertos de mão: as mãos direitas ≤ 0,15 m e as pelves a 0,8–1,2 m, contínuo
      const at = cc.atores;
      for (let p = 0; p < at.length; p++) {
        const A = at[p]; if (!A.ativo || A.time === 2 || A.tipo === 'tecnico') continue;
        for (let q = p + 1; q < at.length; q++) {
          const B = at[q]; if (!B.ativo || B.time === 2 || B.tipo === 'tecnico' || A.time === B.time) continue;
          const oa = A.atu, ob = B.atu;
          const dm = Math.hypot(oa[J.maoD * 3] - ob[J.maoD * 3], oa[J.maoD * 3 + 1] - ob[J.maoD * 3 + 1], oa[J.maoD * 3 + 2] - ob[J.maoD * 3 + 2]);
          const dp = Math.hypot(oa[J.pelve * 3] - ob[J.pelve * 3], oa[J.pelve * 3 + 2] - ob[J.pelve * 3 + 2]);
          const k = A.id * 1000 + B.id;
          const r = x.apertos.get(k) ?? { n: 0, max: 0 };
          r.n = dm <= 0.15 && dp >= 0.8 && dp <= 1.2 ? r.n + 1 : 0; r.max = Math.max(r.max, r.n);
          x.apertos.set(k, r);
        }
      }
    },
  });
  x.nApertos = [...x.apertos.values()].filter(r => r.max >= 24).length;
  // os pares planejados (só os ao alcance no intervalo: CENA_FIM.aperto.maxDistIntervalo) — cada um apertou a mão?
  x.nPares = c.pares.length;
  x.paresFeitos = c.pares.filter(p => [p.a.id * 1000 + p.b.id, p.b.id * 1000 + p.a.id].some(k => (x.apertos.get(k)?.max ?? 0) >= 24)).length;
  void poseEspera;
  return x;
}

if (cenasC.length && roda('C')) {
  const rs = cenasC.map(x => x.r);
  const porCaso = Object.fromEntries(CASOS_C.map(([k]) => [k, cenasC.filter(x => x.caso === k).length]));
  reg('C canhão: 56 intervalos de partidas IA × IA', `${cenasC.length} (${Object.entries(porCaso).map(([k, v]) => `${k} ${v}`).join(', ')})${cenasC.falhou.length ? `; sem estado: ${cenasC.falhou.join(', ')}` : ''}`, '56 (natural 20, gol 12, vermelho 10, amarelo 4, goleiro 10)', cenasC.length === 56);
  // planos e tempos (os do plano: PLANO-CENAS.md §4.1)
  const errPl = cenasC.filter(x => {
    const esp = PLANOS_INTERVALO.filter(([n]) => n !== 'lances' || x.nLances > 0);
    let t = 0;
    return x.plano.planos.length !== esp.length || esp.some(([n, d], i) => { const p = x.plano.planos[i]; const ok = p.nome === n && Math.abs(p.t0 - t) < 1e-9 && Math.abs(p.t1 - (t + d)) < 1e-9; t += n === 'geral' ? 0 : d; return !ok; });
  });
  reg('C planos e tempos: apito 1,5 → campo 2,5 → túnel 3,5 → torcida 1,5 → [lances] → estatísticas 6,0 → geral 3,0', `${cenasC.length - errPl.length}/${cenasC.length} certas${errPl.length ? `; ex.: ${errPl[0].plano.planos.map(p => `${p.nome} ${f2(p.t0)}–${f2(p.t1)}`).join(', ')}` : ''}; até o geral ${f2(Math.min(...cenasC.map(x => x.plano.duracao)))}–${f2(Math.max(...cenasC.map(x => x.plano.duracao)))} s`, 'todas; 15,0 s', errPl.length === 0 && cenasC.every(x => Math.abs(x.plano.duracao - 15) < 1e-9));
  const fasesOk = cenasC.filter(x => x.fases.join() === (x.nLances ? 'apito,campo,tunel,torcida,lances,estatisticas,geral' : 'apito,campo,tunel,torcida,estatisticas,geral')).length;
  reg('C as fases na ordem (com lances: a espera entre a torcida e as estatísticas)', `${fasesOk}/${cenasC.length}${fasesOk < cenasC.length ? ` (ex.: ${cenasC.find(x => !x.fases.join().startsWith('apito'))?.fases ?? cenasC.find(x => x.fases.length < 6)?.fases})` : ''}`, 'todas', fasesOk === cenasC.length);
  const cl = cenasC.filter(x => x.nLances);
  reg('C a espera dos lances: no começo do bloco (9,0 s), o relógio da cena parado, depois as estatísticas', `${cl.filter(x => x.esperaK === 540 && !x.esperaMexeu && x.depoisEspera === 540).length}/${cl.length}`, `todas (${cl.length})`, cl.every(x => x.esperaK === 540 && !x.esperaMexeu && x.depoisEspera === 540));
  reg('C a tarja do placar: visível em [4, 12) s do relógio da cena, nunca na espera dos lances', `${cenasC.reduce((s, x) => s + x.tarjaErr, 0)} ticks errados de ${cenasC.reduce((s, x) => s + x.tarjaN, 0)}`, '0', cenasC.every(x => x.tarjaErr === 0));
  reg('C o árbitro apita (a mão direita na boca ≥ 0,4 s no plano do apito)', `mín ${f2(Math.min(...cenasC.map(x => x.apitoMax)) / 60)} s`, '≥ 0,4 s', cenasC.every(x => x.apitoMax >= 24));
  reg('C corpo: NaN, ossos, pé plantado, pé no ar, pelves, saltos só no corte', resumoCorpo(rs), '0, ≤ 5 mm, ≤ 0,05, ≤ 1,0, ≥ 0,40, 0', rs.every(okCorpo));
  if (detalhe) for (const x of cenasC) if (!okCorpo(x.r)) console.log('corpoC', x.caso, x.sem, JSON.stringify({ osso: x.r.osso, pl: x.r.piorPlantado, pe: x.r.piorPe, pelve: x.r.piorPelve, salto: x.r.piorSalto }));
  reg('C câmera: fora de sólidos, ≤ 5,5 m além das linhas, fora do gol, lente ≥ 2,5 m', resumoCamera(rs), '0, 0, 0, ≥ 2,5 m', rs.every(okCamera));
  if (detalhe) for (const x of cenasC) if (!okCamera(x.r)) console.log('cameraC', x.caso, x.sem, JSON.stringify({ lente: x.r.piorLente, solido: x.r.piorSolido }));
  reg('C ninguém dentro de sólido do estádio (o corpo a 0,9 m; no túnel com o vão das placas aberto)', `${cenasC.reduce((s, x) => s + x.solido, 0)} ticks${cenasC.find(x => x.solido) ? ` (ex.: ${JSON.stringify(cenasC.find(x => x.solido).piorSolido)})` : ''}`, '0', cenasC.every(x => x.solido === 0));
  const v2 = Math.max(...cenasC.map(x => x.v2));
  const pV2 = cenasC.find(x => x.v2 === v2);
  reg('C 2,0 s depois do apito ninguém acima de 1,6 m/s', `máx ${f2(v2)} m/s${v2 > 1.6 && pV2 ? ` (${pV2.caso} ${pV2.sem}: ${JSON.stringify(pV2.piorV2)})` : ''}`, '≤ 1,6', v2 <= 1.6);
  const fracC = x => [...x.cintura.values()].filter(q => q.max >= 30).length / Math.max(1, [...x.cintura.keys()].length);
  reg('C mãos na cintura (≤ 0,12 m do quadril, ≥ 0,5 s) no campo', `pior ${f2(100 * Math.min(...cenasC.map(fracC)))}% dos jogadores`, '≥ 60%', cenasC.every(x => fracC(x) >= 0.6));
  // (o intervalo só planeja os pares ao alcance — CENA_FIM.aperto.maxDistIntervalo: o aperto de 1 s acaba antes do túnel;
  // num apito com todo mundo longe de um adversário não há aperto, e o plano do campo enquadra o árbitro)
  const nPar = cenasC.reduce((s, x) => s + x.nPares, 0), feitos = cenasC.reduce((s, x) => s + x.paresFeitos, 0);
  const comAperto = cenasC.filter(x => x.nApertos >= 1).length;
  reg('C apertos de mão no campo (mãos direitas ≤ 0,15 m ≥ 0,4 s, pelves 0,8–1,2 m): os pares planejados (ao alcance) apertam; cenas com ≥ 1',
    `${feitos}/${nPar} pares; ${comAperto}/${cenasC.length} cenas (${cenasC.filter(x => x.nApertos >= 2).length} com ≥ 2)`, `todos; ≥ 60% das cenas`, feitos === nPar && comAperto >= 0.6 * cenasC.length);
  if (detalhe) for (const x of cenasC) if (x.paresFeitos < x.nPares) console.log('apertosC', x.caso, x.sem, x.nApertos, 'pares', x.plano.pares.map(p => `${p.a}-${p.b} ${f2(p.d)}`).join(', '), JSON.stringify([...x.apertos.entries()].filter(([, r]) => r.max > 0).map(([k, r]) => [k, r.max])));
  if (detalhe) for (const x of cenasC) if (!okCorpo(x.r)) console.log('arC', x.caso, x.sem, JSON.stringify(x.r.piorPe), 'bola', x.bolaNoAr);
  // no fim do túnel: cada um dos 22 (os que estão em campo) dentro da boca (sumiu nela) ou andando para ela; depois, cortado
  const tun = x => { const v = [...x.tunel.values()]; return { entrou: v.filter(q => q.entrou).length, andando: v.filter(q => !q.entrou && q.n > 30 && q.cai / q.n >= 0.9).length, n: v.length }; };
  const tunOk = cenasC.filter(x => { const q = tun(x); return q.entrou + q.andando === q.n && q.entrou >= 1; }).length;
  const ent = cenasC.map(x => tun(x).entrou);
  reg('C túnel: no fim dele cada um dos 22 entrou na boca (z ≥ 44,0) ou anda para ela (≥ 90% dos ticks); ninguém passa visível da boca', `${tunOk}/${cenasC.length}; entraram ${Math.min(...ent)}–${Math.max(...ent)} por cena; visíveis além da boca ${cenasC.reduce((s, x) => s + x.dentroTunel, 0)} ticks`, `todas; ≥ 1; 0`, tunOk === cenasC.length && cenasC.every(x => x.dentroTunel === 0));
  reg('C depois do túnel o campo vazio: ninguém e a bola fora do desenho (cortados pela elipse da torcida)', `${cenasC.reduce((s, x) => s + x.ativosDepois, 0)} atores-tick, bola ${cenasC.reduce((s, x) => s + x.bolaDepois, 0)} ticks`, '0, 0', cenasC.every(x => x.ativosDepois === 0 && x.bolaDepois === 0));
  const noAr = cenasC.filter(x => x.bolaNoAr);
  reg('C a bola do apito no ar cai (a física da cópia): no começo do túnel no chão (≤ 0,2 m)', noAr.length ? `${noAr.filter(x => x.bolaTunel <= 0.2).length}/${noAr.length} (a mais alta ${f2(Math.max(...noAr.map(x => x.bolaTunel)))} m)` : 'nenhum apito com a bola no ar nesta amostra', 'todas', noAr.every(x => x.bolaTunel <= 0.2), !noAr.length);
  reg('C os treinadores (cópias) na área técnica até entrarem', `${cenasC.reduce((s, x) => s + x.tecFora, 0)} ticks fora`, '0', cenasC.every(x => x.tecFora === 0));
  const gol = cenasC.filter(x => x.caso === 'gol'), ver = cenasC.filter(x => x.caso === 'vermelho' || x.caso === 'goleiro'), gk = cenasC.filter(x => x.caso === 'goleiro');
  reg('C os casos: gol no último lance (o apito no fim da pausa do gol) / time com 10 / goleiro expulso com um de linha no gol', `${gol.length} / ${ver.filter(x => x.time10).length} de ${ver.length} / ${gk.filter(x => x.gkCampo).length} de ${gk.length}`, '12 / todos / todos', gol.length === 12 && ver.every(x => x.time10) && gk.every(x => x.gkCampo));
  // o próximo bloco (o toque) e o pulo, nas cópias dos 8 primeiros mundos: campo → lances (ou estatísticas) → estatísticas →
  // geral; o pulo vai direto ao geral; depois de cada salto o campo vazio
  let blocosOk = 0, nb = 0;
  const ruinsB = [];
  for (const x of cenasC.filter(q => q.copia)) {
    const m = x.copia;
    const mk = () => CF.criarCenaFim(CF.planejarFim(m, 'intervalo', { placar: m.placar, lances: x.nLances }), m);
    const c = mk();
    for (let k = 0; k < 120; k++) CF.passoCenaFim(c);
    const seq = [CF.faseFim(c)];
    seq.push(CF.proximoBloco(c));
    const vazio1 = c.atores.every(a => !a.ativo) && !c.bolaVisivel;
    if (x.nLances) { CF.passoCenaFim(c); seq.push(CF.faseFim(c)); seq.push(CF.proximoBloco(c)); }
    seq.push(CF.proximoBloco(c));
    const c2 = mk();
    for (let k = 0; k < 60; k++) CF.passoCenaFim(c2);
    CF.pularParaGeral(c2);
    const esperado = x.nLances ? 'campo,lances,lances,estatisticas,geral' : 'campo,estatisticas,geral';
    nb++;
    const ok = seq.join() === esperado && vazio1 && CF.faseFim(c2) === 'geral' && c2.atores.every(a => !a.ativo) && !c2.bolaVisivel;
    if (ok) blocosOk++; else ruinsB.push(`${seq.join('→')} (vazio ${vazio1}, pulo ${CF.faseFim(c2)})`);
  }
  reg('C o toque = o próximo bloco (campo → lances → estatísticas → geral) e o pulo = o geral, com o campo vazio', `${blocosOk}/${nb}${ruinsB.length ? `; ex.: ${ruinsB[0]}` : ''}`, `todos (${nb})`, nb >= 6 && blocosOk === nb);
}

// ------------------------------------------------------------------------------------------------ FIM) pós-jogo
// (PLANO-CENAS.md §5.6) 56 fins de partidas IA × IA (2 × 0,5 min): 20 do jeito que acabaram, 12 com GOL no último lance, 10
// com VERMELHO no último apito (o time com 10), 4 com AMARELO, 6 com o GOLEIRO expulso e 4 com o EMPATE QUE CONTINUA no TM
// (a versão curta); o placar dos que não são de gol escrito no mundo do teste em rodízio (vitória da casa, derrota, empate),
// com as cópias dos treinadores e o melhor em campo da súmula (sumula.js melhorEmCampo) — conferido contra um código
// INDEPENDENTE escrito aqui (a nota de cada um que jogou pela fórmula do sumula.js notaDoJogador e o argmax). Os planos e os
// tempos são os do plano (não lidos do módulo).
const SU = await tentar('sumula.js');
const cenasFim = [];
const custosFim = [];
const regFim = [];
const PLANOS_FIM = {
  vitoria: [['apito', 1.5], ['vencedor', 3.0], ['perdedor', 2.5], ['cumprimentos', 2.0], ['troca', 1.5], ['treinador', 2.0], ['aplauso', 2.5], ['torcida', 2.0], ['melhor', 5.0], ['placar', 8.0], ['estatisticas', 6.0], ['geral', 0]],
  empate: [['apito', 1.5], ['neutro', 3.0], ['cumprimentos', 2.0], ['troca', 1.5], ['treinador', 2.0], ['aplauso', 2.5], ['torcida', 2.0], ['melhor', 5.0], ['placar', 8.0], ['estatisticas', 6.0], ['geral', 0]],
  curto: [['apito', 1.5], ['neutro', 3.0], ['torcida', 2.0], ['placar', 8.0], ['geral', 0]],
};
const CASOS_FIM = [['natural', 20], ['gol', 12], ['vermelho', 10], ['amarelo', 4], ['goleiro', 6], ['curto', 4]];
const PLACARES_FIM = [{ 0: 2, 1: 1 }, { 0: 0, 1: 1 }, { 0: 1, 1: 1 }];
/** A nota de um jogador pela fórmula do sumula.js (escrita de novo aqui, independente). */
function notaIndep(n, posicao, sofridos, saldo) {
  const e = Math.max(0, n.passes - n.passesCertos);
  let v = 6 + n.gols + 0.6 * n.assist + 0.15 * Math.max(0, n.noAlvo - n.gols) - 0.05 * Math.max(0, n.chutes - n.noAlvo)
    + Math.min(0.6, 0.025 * n.passesCertos) - 0.08 * e + Math.min(0.6, 0.12 * (n.roubadas + n.desarmes)) - 0.12 * n.perdas
    + 0.3 * n.defesas - 0.3 * n.amarelos - 1.5 * n.vermelhos - 0.1 * n.faltas - 0.8 * n.contra;
  if (posicao === 'GOL') v -= 0.3 * sofridos; else if (posicao === 'ZAG' || posicao === 'LAT') v -= 0.15 * sofridos;
  if (saldo > 0) v += 0.3; else if (saldo < 0) v -= 0.3;
  return Math.round(Math.min(10, Math.max(4.5, v)) * 10) / 10;
}
/** O melhor em campo pelo código independente: quem jogou (em campo + substituídos, sem os expulsos), a maior nota. */
function melhorIndep(s, m) {
  const zero = { toques: 0, passes: 0, passesCertos: 0, chutes: 0, noAlvo: 0, gols: 0, assist: 0, roubadas: 0, desarmes: 0, perdas: 0, defesas: 0, faltas: 0, amarelos: 0, vermelhos: 0, contra: 0 };
  const exp = new Set((m.expulsos ?? []).map(j => j.id));
  const lista = [];
  for (const j of m.jogadores) if (!exp.has(j.id) && (j.time === 0 || j.time === 1)) lista.push({ id: j.id, time: j.time, posicao: j.posicao });
  for (const t of [0, 1]) for (const id of m.times[t].saiu) if (!exp.has(id) && !lista.some(q => q.id === id)) lista.push({ id, time: t, posicao: null });
  let b = null;
  for (const q of lista) {
    const n = s.jog[q.id] ?? zero, sof = m.placar[1 - q.time], sal = m.placar[q.time] - m.placar[1 - q.time];
    const x = { id: q.id, nota: notaIndep(n, q.posicao, sof, sal), gols: n.gols, assist: n.assist };
    if (!b || x.nota > b.nota || (x.nota === b.nota && (x.gols > b.gols || (x.gols === b.gols && (x.assist > b.assist || (x.assist === b.assist && x.id < b.id)))))) b = x;
  }
  return b;
}
if (roda('FIM') || roda('E') || roda('G')) {
  if (!CF || !SU || typeof SU.melhorEmCampo !== 'function' || !CF.tarjaMelhorVisivel) reg('F-fim cena do pós-jogo (js/cena-fim.js fimDeJogo, sumula.js melhorEmCampo)', 'não existe: no apito final só a faixa, os 22 congelados', 'existe', false);
  else {
    const L = await LC.carregarCenas(pastaJs);
    // (--sem-fim N: outra amostra de sementes; --min-fim: os minutos por tempo)
    let sem = args.includes('--sem-fim') ? +args[args.indexOf('--sem-fim') + 1] : 700, falhou = [], kDesf = 0;
    const minFim = args.includes('--min-fim') ? +args[args.indexOf('--min-fim') + 1] : 0.3;
    for (const [caso, n] of CASOS_FIM) {
      for (let i = 0; i < n; i++) {
        let r = null, tent = 0;
        while (!r && tent < 6) {
          sem++; tent++;
          const forcar = caso === 'natural' || caso === 'curto' ? null
            : caso === 'gol' ? m => LC.forcarGol(L, m)
              : m => !!LC.forcarCartao(L, m, caso === 'goleiro' ? 'goleiro' : caso, { semBusca: true });
          const x = LC.ateFim(L, sem, { min: minFim, forcar, margem: 40, sumula: SU });
          if (!x) continue;
          const exp = x.m.expulsos ?? [];
          if (caso === 'gol' && !(x.forcado && x.golTick != null && Math.abs(x.m.tick - x.golTick - Math.round(C.PARTIDA.golPausa / PASSO)) <= 1)) continue;
          if ((caso === 'vermelho' || caso === 'goleiro') && !(x.forcado && exp.length >= 1)) continue;
          if (caso === 'goleiro' && !exp.some(j => j.posicao === 'GOL' || j.vagaId === 'GOL')) continue;
          if (caso === 'amarelo' && !x.forcado) continue;
          r = x;
        }
        if (!r) { falhou.push(`${caso}#${i}`); continue; }
        const m = r.m;
        // o desfecho: o gol no último lance fica como acabou; o curto é empate; o resto em rodízio (escrito no mundo do teste)
        if (caso === 'curto') { m.placar[0] = 1; m.placar[1] = 1; }
        else if (caso !== 'gol') { const pl = PLACARES_FIM[kDesf++ % 3]; m.placar[0] = pl[0]; m.placar[1] = pl[1]; }
        const melhor = caso === 'curto' ? null : SU.melhorEmCampo(r.sumula, m);
        const indep = melhorIndep(r.sumula, m);
        const h0 = S.hashMundo(m), t0 = m.tick, s0 = serializar(m);
        const tecs = treinadoresDe(m, `F|${sem}`);
        const plano = CF.planejarFim(m, 'fimDeJogo', { placar: m.placar, timeHumano: cenasFim.length % 2, curto: caso === 'curto', melhor, treinadores: tecs });
        const c = CF.criarCenaFim(plano, m);
        const x = medirFim(c);
        x.hashIgual = S.hashMundo(m) === h0 && m.tick === t0;
        x.mundoIgual = serializar(m) === s0;
        x.caso = caso; x.sem = sem; x.placar = { ...m.placar }; x.melhorSu = melhor; x.melhorIndep = indep;
        x.idsExpulsos = (m.expulsos ?? []).map(j => j.id);
        x.goleiros = m.jogadores.filter(j => j.posicao === 'GOL' || j.vagaId === 'GOL').map(j => j.id);
        x.time10 = [0, 1].some(t => m.jogadores.filter(j => j.time === t).length === 10);
        x.notaTM = melhor ? SU.notaDe(r.sumula, m, melhor.id, melhor.time) : null;
        if (cenasFim.length < 9) x.copia = { m: structuredClone(m), melhor, tecs: tecs?.map(o => o && { ...o }) ?? null, curto: caso === 'curto' };
        cenasFim.push(x);
        custosFim.push(...x.r.ms);
      }
    }
    cenasFim.falhou = falhou;
    // (revisão) os casos achados na revisão, do jeito dos scripts dela (2 × 0,3 min, o desfecho escrito no mundo, o time da
    // pessoa pela paridade da semente, os treinadores do gancho): 1427 (1×1) o aperto do árbitro no meio quando a elipse da
    // troca leva os dois; 1203, 1213 (0×1) e 1219 (2×1) o 2º do lamento correndo atrás do 1º depois dos cumprimentos
    if (roda('FIM')) for (const [sem2, pl] of [[1427, [1, 1]], [1203, [0, 1]], [1213, [0, 1]], [1219, [2, 1]]]) {
      const r = LC.ateFim(L, sem2, { min: 0.3, sumula: SU });
      if (!r) { regFim.push({ sem: sem2, falhou: true }); continue; }
      const m = r.m;
      m.placar[0] = pl[0]; m.placar[1] = pl[1];
      const melhor = SU.melhorEmCampo(r.sumula, m);
      const plano = CF.planejarFim(m, 'fimDeJogo', { placar: m.placar, timeHumano: sem2 % 2, melhor, treinadores: treinadoresDe(m) });
      const x = medirFim(CF.criarCenaFim(plano, m));
      x.sem = sem2; x.caso = 'revisao'; x.placar = { ...m.placar };
      regFim.push(x);
    }
  }
}

/**
 * Uma cena do pós-jogo: as medidas comuns + o apito, os apertos (os pares, o árbitro, os treinadores), a troca de camisa, o
 * melhor em campo no quadro, as tarjas no plano certo, ninguém em sólido e os tempos.
 */
function medirFim(c) {
  const P = c.plano;
  const arb = c.arbitro;
  const x = {
    plano: P, v2: 0, apito: 0, apitoMax: 0, apertos: new Map(), apertosArb: new Map(), apertoArbMax: 0, apertoTr: 0, apertoTrMax: 0,
    solido: 0, piorSolido: null, fases: [], tarjaErr: 0, tarjaMelhorErr: 0, troca: null, melhorQuadro: { n: 0, dentro: 0, altura: [] },
    trocaN: 0, trocaJuntos: 0, trocaAbraco: 0, trocaCamisa: 0, trocaVisto: false, melhorVisto: false, treinadorVisto: false,
    lamCorre: 0, lamCorreEx: null, arbEstica: 0, arbEsticaEx: null, arbCorte: null,
  };
  const cumP = P.planos.find(q => q.nome === 'cumprimentos');
  const pc = [CF.criarPlanoCameraFim(), CF.criarPlanoCameraFim()];
  let fAnt = null;
  x.r = andarCena(c, { passo: CF.passoCenaFim, planoCamera: CF.planoCameraFim, criarPlano: CF.criarPlanoCameraFim }, {
    max: Math.round((P.duracao + 1.0) / PASSO),
    por: (cc, t) => {
      const f = CF.faseFim(cc);
      if (f !== fAnt) { x.fases.push(f); fAnt = f; }
      if (Math.abs(t - 2.0) < PASSO / 2) for (const a of cc.atores) { if (!a.ativo) continue; const v = Math.hypot(a.j.vx, a.j.vz); if (v > x.v2) x.v2 = v; }
      if (f === 'apito' && arb.ativo) {
        const o = arb.atu, ok = Math.hypot(o[J.maoD * 3] - o[J.cabeca * 3], o[J.maoD * 3 + 1] - o[J.cabeca * 3 + 1], o[J.maoD * 3 + 2] - o[J.cabeca * 3 + 2]) <= 0.22;
        x.apito = ok ? x.apito + 1 : 0; x.apitoMax = Math.max(x.apitoMax, x.apito);
      }
      // as tarjas no plano delas (o placar no 'placar'; o melhor no 'melhor')
      if (CF.tarjaPlacarVisivel(cc) !== (f === 'placar')) x.tarjaErr++;
      if (CF.tarjaMelhorVisivel(cc) !== (f === 'melhor')) x.tarjaMelhorErr++;
      for (const a of cc.atores) {
        if (!a.ativo) continue;
        const sd = EF.solidoEm(a.j.x, 0.9, a.j.z, 0.2, false);
        if (sd) { x.solido++; x.piorSolido = { id: a.id, tipo: a.tipo, f, x: +a.j.x.toFixed(2), z: +a.j.z.toFixed(2), sd }; }
      }
      // apertos de mão: as mãos direitas ≤ 0,15 m e as pelves a 0,8–1,2 m, contínuo (adversários; o árbitro; os treinadores)
      const at = cc.atores;
      for (let p = 0; p < at.length; p++) {
        const A = at[p]; if (!A.ativo) continue;
        for (let q = p + 1; q < at.length; q++) {
          const B = at[q]; if (!B.ativo) continue;
          const tr = A.tipo === 'tecnico' && B.tipo === 'tecnico', ar = (A === arb || B === arb) && A.tipo !== 'tecnico' && B.tipo !== 'tecnico' && A.tipo !== 'assistente' && B.tipo !== 'assistente';
          const adv = A.tipo !== 'tecnico' && B.tipo !== 'tecnico' && A.time !== 2 && B.time !== 2 && A.time !== B.time;
          if (!tr && !ar && !adv) continue;
          const oa = A.atu, ob = B.atu;
          const dm = Math.hypot(oa[J.maoD * 3] - ob[J.maoD * 3], oa[J.maoD * 3 + 1] - ob[J.maoD * 3 + 1], oa[J.maoD * 3 + 2] - ob[J.maoD * 3 + 2]);
          const dp = Math.hypot(oa[J.pelve * 3] - ob[J.pelve * 3], oa[J.pelve * 3 + 2] - ob[J.pelve * 3 + 2]);
          const ok = dm <= 0.15 && dp >= 0.8 && dp <= 1.2;
          if (tr) { x.apertoTr = ok ? x.apertoTr + 1 : 0; x.apertoTrMax = Math.max(x.apertoTrMax, x.apertoTr); continue; }
          if (ar) { const k = A.id * 1000 + B.id, r = x.apertosArb.get(k) ?? { n: 0 }; r.n = ok ? r.n + 1 : 0; x.apertosArb.set(k, r); x.apertoArbMax = Math.max(x.apertoArbMax, r.n); continue; }
          const k = A.id * 1000 + B.id;
          const r = x.apertos.get(k) ?? { n: 0, max: 0 };
          r.n = ok ? r.n + 1 : 0; r.max = Math.max(r.max, r.n);
          x.apertos.set(k, r);
        }
      }
      // a troca de camisa: no plano dela, os dois lado a lado (pelves 0,4–0,8 m), cada um com a camisa do outro, abraçados (a
      // mão de dentro a ≤ 0,2 m das costas do outro)
      if (f === 'troca' && cc.troca) {
        x.trocaVisto = true;
        const { a, b } = cc.troca;
        x.trocaN++;
        const dp = Math.hypot(a.atu[J.pelve * 3] - b.atu[J.pelve * 3], a.atu[J.pelve * 3 + 2] - b.atu[J.pelve * 3 + 2]);
        if (dp >= 0.4 && dp <= 0.8) x.trocaJuntos++;
        if (a.camisaDe === b.id && b.camisaDe === a.id) x.trocaCamisa++;
        const mao = (o, lado) => (lado > 0 ? J.maoD : J.maoE) * 3;
        const dCost = (u, v) => { const k = mao(u.atu, u.trocaLado), p = J.peito * 3, h = v.j.rumo; return Math.hypot(u.atu[k] - (v.atu[p] - Math.cos(h) * 0.12), u.atu[k + 1] - (v.atu[p + 1] + 0.06), u.atu[k + 2] - (v.atu[p + 2] - Math.sin(h) * 0.12)); };
        if (t >= P.planos.find(q => q.nome === 'troca').t0 + 0.3 && dCost(a, b) <= 0.2 && dCost(b, a) <= 0.2) x.trocaAbraco++;
      }
      if (f === 'treinador') x.treinadorVisto = true;
      // (revisão) o 2º do lamento não corre depois dos cumprimentos (o tapinha acabou ali): antes ele perseguia o 1º — também
      // depois que a elipse da troca o levou — até o fim da cena, passando no close da troca
      if (cumP && t > cumP.t0 + 0.6) {
        for (const a of cc.atores) {
          if (!a.ativo || a.lamento !== 1 || a.aplaude || a.trocaAlvo || a === cc.melhorA) continue;
          const v = Math.hypot(a.j.vx, a.j.vz);
          if (v > 1.8) { x.lamCorre++; x.lamCorreEx ??= { id: a.id, t: +t.toFixed(2), f, v: +v.toFixed(2) }; }
        }
      }
      // (revisão) o aperto com o árbitro: no gesto as pelves a ≤ 1,2 m (sem o braço esticado até o outro); cortado por uma
      // elipse, quem foi levado não volta andando até o outro
      const pa = cc.parArbitro;
      if (pa && pa.t0 >= 0 && !pa.cortado && t >= pa.t0 + 0.25 && t <= pa.t0 + 0.7 && arb.ativo && pa.jog.ativo) {
        const d = Math.hypot(arb.atu[J.pelve * 3] - pa.jog.atu[J.pelve * 3], arb.atu[J.pelve * 3 + 2] - pa.jog.atu[J.pelve * 3 + 2]);
        if (d > 1.2) { x.arbEstica++; x.arbEsticaEx ??= { t: +t.toFixed(2), f, d: +d.toFixed(2) }; }
      }
      if (pa?.cortado && arb.ativo && pa.jog.ativo) {
        // (o quanto cada um ANDOU na direção do outro depois do corte — pela velocidade: as elipses seguintes, que levam um
        // deles para outro lugar no corte, não contam)
        const g = pa.jog.j, dx = arb.j.x - g.x, dz = arb.j.z - g.z, d = Math.hypot(dx, dz) || 1;
        const aprox = (Math.max(0, (g.vx * dx + g.vz * dz) / d) + Math.max(0, -(arb.j.vx * dx + arb.j.vz * dz) / d)) * PASSO;
        if (!x.arbCorte) x.arbCorte = { t: +t.toFixed(2), f, d0: +d.toFixed(2), anda: 0 };
        x.arbCorte.anda += aprox;
      }
      // o melhor em campo no close: a cabeça e o peito dentro do quadro (5% de margem) nos dois aspectos; a altura da cabeça
      // ao peito na tela
      if (f === 'melhor' && cc.melhorA) {
        x.melhorVisto = true;
        const o = cc.melhorA.atu;
        ASPECTOS.forEach(([, pequena, aspecto], k) => {
          const q = CF.planoCameraFim(cc, { pequena, aspecto }, pc[k]);
          const proj = projetor(q, aspecto);
          const pts = [[o[J.cabeca * 3], o[J.cabeca * 3 + 1] + TOPO, o[J.cabeca * 3 + 2]], [o[J.peito * 3], o[J.peito * 3 + 1], o[J.peito * 3 + 2]], [o[J.pelve * 3], o[J.pelve * 3 + 1], o[J.pelve * 3 + 2]]];
          let dentro = true, y0 = Infinity, y1 = -Infinity;
          for (const [px, py, pz] of pts) { proj(px, py, pz, _pr); if (_pr[2] <= 0.1 || Math.abs(_pr[0]) > 0.95 || Math.abs(_pr[1]) > 0.95) dentro = false; y0 = Math.min(y0, _pr[1]); y1 = Math.max(y1, _pr[1]); }
          x.melhorQuadro.n++; if (dentro) x.melhorQuadro.dentro++; x.melhorQuadro.altura.push((y1 - y0) / 2);
        });
      }
    },
  });
  x.nApertos = [...x.apertos.values()].filter(r => r.max >= 24).length;
  x.nPares = c.pares.length;
  // (revisão) quando cada par começou o aperto (no fim: no plano dos cumprimentos, vitória e empate)
  x.paresT0 = c.pares.map(p => p.t0);
  x.cump = cumP ? [cumP.t0, cumP.t1] : null;
  x.paresFeitos = c.pares.filter(p => [p.a.id * 1000 + p.b.id, p.b.id * 1000 + p.a.id].some(k => (x.apertos.get(k)?.max ?? 0) >= 24)).length;
  x.trocaPar = P.troca ? { ...P.troca } : null;
  return x;
}

if (cenasFim.length && roda('FIM')) {
  const rs = cenasFim.map(x => x.r);
  const porCaso = Object.fromEntries(CASOS_FIM.map(([k]) => [k, cenasFim.filter(x => x.caso === k).length]));
  const desf = { vitoria: 0, derrota: 0, empate: 0 };
  for (const x of cenasFim) { const g0 = x.placar[0], g1 = x.placar[1]; desf[g0 > g1 ? 'vitoria' : g0 < g1 ? 'derrota' : 'empate']++; }
  reg('F-fim canhão: 56 fins de partidas IA × IA', `${cenasFim.length} (${Object.entries(porCaso).map(([k, v]) => `${k} ${v}`).join(', ')}; vitórias ${desf.vitoria}, derrotas ${desf.derrota}, empates ${desf.empate})${cenasFim.falhou.length ? `; sem estado: ${cenasFim.falhou.join(', ')}` : ''}`,
    '56 (natural 20, gol 12, vermelho 10, amarelo 4, goleiro 6, curto 4); os 3 desfechos', cenasFim.length === 56 && desf.vitoria >= 10 && desf.derrota >= 10 && desf.empate >= 10);
  // planos e tempos (os do plano; sem o par da troca ou os treinadores, os planos saem sem deixar buraco)
  const esperado = x => {
    const k = x.plano.curto ? 'curto' : x.plano.resultado;
    return PLANOS_FIM[k].filter(([n]) => (n !== 'troca' || x.plano.troca) && (n !== 'treinador' || x.plano.temTreinador) && (n !== 'melhor' || x.plano.melhor));
  };
  const errPl = cenasFim.filter(x => {
    const esp = esperado(x);
    let t = 0;
    return x.plano.planos.length !== esp.length || esp.some(([n, d], i) => { const p = x.plano.planos[i]; const ok = p.nome === n && Math.abs(p.t0 - t) < 1e-9 && (n === 'geral' ? p.t1 === Infinity : Math.abs(p.t1 - (t + d)) < 1e-9); t += d; return !ok; });
  });
  const durs = k => cenasFim.filter(x => (x.plano.curto ? 'curto' : x.plano.resultado) === k).map(x => x.plano.duracao);
  const fmt = a => a.length ? [...new Set(a.map(f2))].join('/') : '-';
  reg('F-fim planos e tempos: vitória 34,5 s (+1,5 a troca), empate 32 s (+1,5), sem treinadores −2 s, curto 14,5 s; até o geral',
    `${cenasFim.length - errPl.length}/${cenasFim.length} certas${errPl.length ? `; ex.: ${errPl[0].plano.planos.map(p => `${p.nome} ${f2(p.t0)}`).join(', ')}` : ''}; vitória ${fmt(durs('vitoria'))} s, empate ${fmt(durs('empate'))} s, curto ${fmt(durs('curto'))} s`,
    'todas', errPl.length === 0 && durs('curto').every(d => Math.abs(d - 14.5) < 1e-9));
  const fasesOk = cenasFim.filter(x => x.fases.join() === esperado(x).map(([n]) => n).join()).length;
  reg('F-fim as fases na ordem (o estado desenhado: faseFim)', `${fasesOk}/${cenasFim.length}${fasesOk < cenasFim.length ? ` (ex.: ${cenasFim.find(x => x.fases.join() !== esperado(x).map(([n]) => n).join())?.fases.join('>')})` : ''}`, 'todas', fasesOk === cenasFim.length);
  reg('F-fim o árbitro apita (a mão direita na boca ≥ 0,4 s no plano do apito)', `mín ${f2(Math.min(...cenasFim.map(x => x.apitoMax)) / 60)} s`, '≥ 0,4 s', cenasFim.every(x => x.apitoMax >= 24));
  reg('F-fim corpo: NaN, ossos, pé plantado, pé no ar, pelves, saltos só no corte', resumoCorpo(rs), '0, ≤ 5 mm, ≤ 0,05, ≤ 1,0, ≥ 0,40, 0', rs.every(okCorpo));
  if (detalhe) for (const x of cenasFim) if (!okCorpo(x.r)) console.log('corpoFim', x.caso, x.sem, JSON.stringify({ osso: x.r.osso, pl: x.r.piorPlantado, pe: x.r.piorPe, pelve: x.r.piorPelve, salto: x.r.piorSalto }));
  reg('F-fim câmera: fora de sólidos, ≤ 5,5 m além das linhas, fora do gol, lente ≥ 2,5 m', resumoCamera(rs), '0, 0, 0, ≥ 2,5 m', rs.every(okCamera));
  if (detalhe) for (const x of cenasFim) if (!okCamera(x.r)) console.log('cameraFim', x.caso, x.sem, JSON.stringify({ lente: x.r.piorLente, solido: x.r.piorSolido }), 'placar', JSON.stringify(x.placar), 'th', x.plano.timeHumano);
  if (detalhe) for (const x of cenasFim) if (x.solido) console.log('solidoFim', x.caso, x.sem, JSON.stringify(x.piorSolido), 'placar', JSON.stringify(x.placar), 'th', x.plano.timeHumano);
  reg('F-fim ninguém dentro de sólido do estádio (o corpo a 0,9 m)', `${cenasFim.reduce((s, x) => s + x.solido, 0)} ticks${cenasFim.find(x => x.solido) ? ` (ex.: ${JSON.stringify(cenasFim.find(x => x.solido).piorSolido)})` : ''}`, '0', cenasFim.every(x => x.solido === 0));
  const v2 = Math.max(...cenasFim.map(x => x.v2));
  reg('F-fim 2,0 s depois do apito ninguém acima de 1,6 m/s', `máx ${f2(v2)} m/s`, '≤ 1,6', v2 <= 1.6);
  // os cumprimentos: os pares planejados apertam a mão (a ≤ 6 m, ou até 14 se faltarem pares perto); o árbitro cumprimenta um
  const comp = cenasFim.filter(x => !x.plano.curto);
  const nPar = comp.reduce((s, x) => s + x.nPares, 0), feitos = comp.reduce((s, x) => s + x.paresFeitos, 0);
  // (a ≤ 6 m primeiro; os de 6 a 14 m só entram quando não houve 3 pares a ≤ 6 m)
  const distOk = comp.every(x => { const ps = x.plano.pares, perto = ps.filter(p => p.d <= 6 + 1e-9).length; return ps.every(p => p.d <= 14 + 1e-9) && (perto >= 3 ? perto === ps.length : true); });
  reg('F-fim cumprimentos: os pares planejados (≤ 6 m; a folga até 14 m só se faltarem) apertam a mão (mãos ≤ 0,15 m ≥ 0,4 s, pelves 0,8–1,2 m); o árbitro com um',
    `${feitos}/${nPar} pares (${comp.filter(x => x.nPares >= 3).length}/${comp.length} cenas com ≥ 3; ${comp.reduce((s, x) => s + x.plano.pares.filter(p => p.d <= 6).length, 0)} a ≤ 6 m); árbitro em ${comp.filter(x => x.apertoArbMax >= 24).length}/${comp.length}`,
    'todos; o árbitro em ≥ 90%', feitos === nPar && distOk && comp.filter(x => x.apertoArbMax >= 24).length >= 0.9 * comp.length);
  // (revisão) no fim — vitória e EMPATE — os pares apertam a mão no plano dos cumprimentos (antes o empate apertava no
  // 'neutro' ou até no 'apito', e a câmera dos cumprimentos pegava o par já parado com as mãos na cintura)
  const t0Ruins = comp.filter(x => x.cump && x.paresT0.some(t0 => t0 >= 0 && (t0 < x.cump[0] - 0.2 - 1e-9 || t0 >= x.cump[1])));
  const t0s = comp.flatMap(x => (x.cump ? x.paresT0.filter(t0 => t0 >= 0).map(t0 => t0 - x.cump[0]) : []));
  reg('F-fim os pares apertam a mão no plano dos cumprimentos, na vitória e no empate (o aperto começa entre o corte − 0,2 s e o fim do plano)',
    `${comp.length - t0Ruins.length}/${comp.length} cenas${t0Ruins.length ? ` (ex.: ${t0Ruins[0].plano.resultado} ${t0Ruins[0].sem}: ${t0Ruins[0].paresT0.map(f2).join(', ')} s com os cumprimentos em ${t0Ruins[0].cump.map(f2).join('–')} s)` : ''}; o começo de ${f2(Math.min(...t0s))} a ${f2(Math.max(...t0s))} s do corte`,
    `todas (${comp.length})`, comp.length > 0 && t0Ruins.length === 0);
  {
    const todasR = [...cenasFim, ...regFim.filter(x => !x.falhou)];
    const lam = todasR.filter(x => x.lamCorre > 0), est = todasR.filter(x => x.arbEstica > 0);
    const cort = todasR.filter(x => x.arbCorte), volta = cort.filter(x => x.arbCorte.anda > 1.0);
    reg('F-fim (revisão) o 2º do lamento não corre depois dos cumprimentos; o aperto do árbitro sem o braço esticado (pelves ≤ 1,2 m); cortado por uma elipse, ninguém volta andando até o outro',
      `${lam.length} cenas com o 2º do lamento a > 1,8 m/s${lam.length ? ` (ex.: ${lam[0].sem}: ${JSON.stringify(lam[0].lamCorreEx)}, ${lam[0].lamCorre} ticks)` : ''}; ${est.length} com o aperto esticado${est.length ? ` (ex.: ${est[0].sem}: ${JSON.stringify(est[0].arbEsticaEx)})` : ''}; ${cort.length} cortados (${cort.map(x => `${x.sem} no ${x.arbCorte.f} a ${f2(x.arbCorte.d0)} m, ${f2(x.arbCorte.anda)} m andados um para o outro`).join(', ') || '-'}), ${volta.length} voltando; ${regFim.length} casos da revisão (${regFim.map(x => x.sem + (x.falhou ? ' FALHOU' : '')).join(', ')})`,
      '0; 0; 0', regFim.length === 4 && regFim.every(x => !x.falhou) && lam.length === 0 && est.length === 0 && volta.length === 0);
  }
  if (detalhe) for (const x of comp) if (x.paresFeitos < x.nPares) console.log('apertosFim', x.caso, x.sem, 'pares', x.plano.pares.map(p => `${p.a}-${p.b} ${f2(p.d)}`).join(', '), JSON.stringify([...x.apertos.entries()].filter(([, r]) => r.max > 0).map(([k, r]) => [k, r.max])));
  // a troca de camisa
  const ct = cenasFim.filter(x => x.trocaPar);
  const trRuim = ct.filter(x => {
    const T = x.trocaPar;
    return x.goleiros.includes(T.a) || x.goleiros.includes(T.b) || x.idsExpulsos.includes(T.a) || x.idsExpulsos.includes(T.b) || T.a === x.melhorSu?.id || T.b === x.melhorSu?.id
      || x.plano.pares.some(p => [p.a, p.b].includes(T.a) || [p.a, p.b].includes(T.b));
  });
  const trJ = ct.filter(x => x.trocaN > 0 && x.trocaJuntos === x.trocaN && x.trocaCamisa === x.trocaN && x.trocaAbraco >= 0.6 * x.trocaN).length;
  reg('F-fim troca de camisa: um par de adversários de linha (nunca goleiro, expulso, quem aperta a mão nem o melhor), em todo fim que não é o curto; no plano dela lado a lado, cada um com a camisa do outro, abraçados',
    `${ct.length}/${comp.length} com o par; ${trRuim.length} pares proibidos; ${trJ}/${ct.length} juntos/camisa/abraço (pior abraço ${f2(Math.min(...ct.map(x => x.trocaAbraco / Math.max(1, x.trocaN))))}); sem par no curto ${cenasFim.filter(x => x.plano.curto && x.trocaPar).length === 0}; lados ${[...new Set(ct.map(x => x.trocaPar.sx))].join('/')}`,
    'todos; 0; todos (abraço ≥ 60% do plano)', ct.length === comp.length && trRuim.length === 0 && trJ === ct.length && cenasFim.every(x => !x.plano.curto || !x.trocaPar));
  // o melhor em campo = o argmax independente; a nota = a do resultado do TM (sumula.js notaDe, a conta do `jogador`)
  const mc = cenasFim.filter(x => x.melhorSu);
  const mcRuim = mc.filter(x => x.melhorSu.id !== x.melhorIndep.id || x.melhorSu.nota !== x.melhorIndep.nota || x.notaTM !== x.melhorSu.nota || x.plano.melhor?.id !== x.melhorSu.id);
  reg('F-fim melhor em campo = o argmax da nota recalculada por um código independente (quem jogou, sem expulsos); a nota = a do resultado do TM',
    `${mc.length - mcRuim.length}/${mc.length}${mcRuim.length ? ` (ex.: sumula ${JSON.stringify(mcRuim[0].melhorSu)} × indep ${JSON.stringify(mcRuim[0].melhorIndep)})` : ''}; notas ${f2(Math.min(...mc.map(x => x.melhorSu.nota)))}–${f2(Math.max(...mc.map(x => x.melhorSu.nota)))}`,
    'todas', mc.length >= 50 && mcRuim.length === 0);
  const mq = cenasFim.filter(x => x.melhorVisto);
  const mqOk = mq.filter(x => x.melhorQuadro.n > 0 && x.melhorQuadro.dentro === x.melhorQuadro.n).length;
  const altMin = Math.min(...mq.flatMap(x => x.melhorQuadro.altura));
  reg('F-fim o close do melhor em campo: a cabeça, o peito e a pelve no quadro (PC e celular) o plano inteiro; grande na tela', `${mqOk}/${mq.length} cenas; a cabeça→pelve ocupa ≥ ${f2(100 * altMin)}% da altura`, `todas (${mc.length}); ≥ 25%`, mq.length === mc.length && mqOk === mq.length && altMin >= 0.25);
  // os treinadores: o plano entra com +2 s (só com os dois/um do gancho) e os dois apertam a mão
  const tr = cenasFim.filter(x => x.plano.temTreinador && !x.plano.curto);
  reg('F-fim os treinadores (210/211, as cópias do gancho) se cumprimentam na frente do túnel no plano deles (+2,0 s)', `${tr.filter(x => x.apertoTrMax >= 24).length}/${tr.length}`, `todos (${tr.length})`, tr.length > 0 && tr.every(x => x.apertoTrMax >= 24 && x.treinadorVisto));
  reg('F-fim as tarjas só no plano delas (o placar no "placar"; o melhor no "melhor")', `${cenasFim.reduce((s, x) => s + x.tarjaErr, 0)} / ${cenasFim.reduce((s, x) => s + x.tarjaMelhorErr, 0)} ticks errados`, '0 / 0', cenasFim.every(x => x.tarjaErr === 0 && x.tarjaMelhorErr === 0));
  const gol = cenasFim.filter(x => x.caso === 'gol'), ver = cenasFim.filter(x => x.caso === 'vermelho' || x.caso === 'goleiro');
  reg('F-fim os casos: gol no último lance / o time com 10', `${gol.length} / ${ver.filter(x => x.time10).length} de ${ver.length}`, '12 / todos', gol.length === 12 && ver.every(x => x.time10));
  // o toque = o próximo bloco (campo → melhor → placar → estatísticas → geral) e o pulo = o geral
  let blocosOk = 0, nb = 0;
  const ruinsB = [];
  for (const x of cenasFim.filter(q => q.copia)) {
    const { m, melhor, tecs, curto } = x.copia;
    const mk = () => CF.criarCenaFim(CF.planejarFim(m, 'fimDeJogo', { placar: m.placar, curto, melhor, treinadores: tecs }), m);
    const c = mk();
    for (let k = 0; k < 120; k++) CF.passoCenaFim(c);
    const seq = [CF.faseFim(c)];
    for (let k = 0; k < 5; k++) { const f = CF.proximoBloco(c); if (seq.at(-1) !== f) seq.push(f); CF.passoCenaFim(c); }
    const c2 = mk();
    for (let k = 0; k < 60; k++) CF.passoCenaFim(c2);
    CF.pularParaGeral(c2);
    const esp = [seq[0], ...(curto ? ['placar', 'geral'] : melhor ? ['melhor', 'placar', 'estatisticas', 'geral'] : ['placar', 'estatisticas', 'geral'])].join();
    nb++;
    const ok = seq.join() === esp && CF.faseFim(c2) === 'geral';
    if (ok) blocosOk++; else ruinsB.push(`${seq.join('→')} (esperado ${esp}; pulo ${CF.faseFim(c2)})`);
  }
  reg('F-fim o toque = o próximo bloco (campo → melhor → placar → estatísticas → geral) e o pulo = o geral', `${blocosOk}/${nb}${ruinsB.length ? `; ex.: ${ruinsB[0]}` : ''}`, `todos (${nb})`, nb >= 6 && blocosOk === nb);
  // a festa e a vaia do fim: no plano da torcida o setor visitante acende os sinalizadores na vitória dele e a casa abre o
  // bandeirão na dela (render/festa.js 'cenaFim'); a vaia de quem perdeu (render/emocao.js)
  if (EMO && FE) {
    const tr2 = [];
    for (const [pl, nome] of [[{ 0: 2, 1: 1 }, 'casa'], [{ 0: 0, 1: 1 }, 'visitante'], [{ 0: 1, 1: 1 }, 'empate']]) {
      const est = EMO.criarEmocao();
      const ctx = { t: 10, timeDe: () => 0, bola: { x: 0, y: 0, z: 0 }, ataca: { 0: 1, 1: -1 } };
      const f0 = est.festa.acesos ?? 0, b0 = est.festa.bandeirao.n, flares0 = est.festa.flares.filter(q => q.ativo).length;
      EMO.emocaoEvento(est, { tipo: 'cenaFim', fim: 'fimDeJogo', placar: pl }, ctx);
      const disp = EMO.consumirDisparos ? EMO.consumirDisparos(est).map(d => `${d.tipo}${d.grupo ?? ''}`) : [];
      tr2.push({ nome, band: est.festa.bandeirao.n - b0, flares: est.festa.flares.filter(q => q.ativo).length - flares0, vaia: disp.some(d => d.startsWith('vaia')), f0 });
    }
    const [cs, vi, em] = tr2;
    reg('F-fim a festa do fim (o plano da torcida): a casa abre o bandeirão; o visitante acende os sinalizadores; quem perde vaia',
      tr2.map(q => `${q.nome}: bandeirão +${q.band}, sinalizadores +${q.flares}, vaia ${q.vaia ? 'sim' : 'não'}`).join(' · '), 'casa +1; visitante ≥ 1; vaia na derrota de cada lado, sem vaia no empate',
      cs.band === 1 && vi.flares >= 1 && cs.vaia && vi.vaia && !em.vaia);
  }
}

// ------------------------------------------------------------------------------------------------ E) pureza
if (roda('E')) {
  if (!cenasA.length) reg('E pureza: o mundo não muda com a cena', 'sem cenas (a cena do cartão não existe)', 'hashMundo e m.tick iguais; nada escrito', false);
  else {
    reg('E pureza: hashMundo e m.tick antes = depois (cenas de cartão)', `${cenasA.filter(x => x.hashIgual).length}/${cenasA.length}`, 'todas', cenasA.every(x => x.hashIgual));
    reg('E pureza: nada escrito no mundo (o mundo inteiro serializado antes = depois)', `${cenasA.filter(x => x.mundoIgual).length}/${cenasA.length}`, 'todas', cenasA.every(x => x.mundoIgual));
    // E2: a partida continua do MESMO tick — com a cena (o que a página faz: escolher, planejar, criar e andar a cena
    // inteira com o mundo parado) e sem ela, os mesmos 600 passos dão o mesmo hash a cada 100
    const L = await LC.carregarCenas(pastaJs);
    const base = LC.estadoDoMeio(L, 29, 1700);
    let iguais = 0, total = 0;
    for (const sit of SITUACOES) {
      const m1 = structuredClone(base), m2 = structuredClone(base);
      const e1 = LC.forcarCartao(L, m1, sit), e2 = LC.forcarCartao(L, m2, sit);
      if (!e1 || !e2) continue;
      const c = CC.criarCenaCartao(CC.planejarCartao(e1.m, CC.escolherCartao(e1.eventos), { treinadores: treinadoresDe(e1.m) }), e1.m);
      while (!c.acabou) CC.passoCenaCartao(c);
      let ok = S.hashMundo(e1.m) === S.hashMundo(e2.m);
      for (let k = 0; k < 600; k++) {
        L.P.passoPartida(e1.m, L.P.entradaDemoPartida(e1.m), null);
        L.P.passoPartida(e2.m, L.P.entradaDemoPartida(e2.m), null);
        if ((k + 1) % 100 === 0 && S.hashMundo(e1.m) !== S.hashMundo(e2.m)) ok = false;
      }
      total++; if (ok) iguais++;
    }
    reg('E2 a partida continua do mesmo tick: com a cena × sem ela, 600 passos (hash a cada 100)', `${iguais}/${total} situações iguais`, 'todas (6)', total === SITUACOES.length && iguais === total);
  }
  if (!cenasC.length) reg('E pureza do intervalo: o mundo não muda com a cena', 'sem cenas (a cena do intervalo não existe)', 'hashMundo e m.tick iguais; nada escrito', false);
  else {
    reg('E pureza do intervalo: hashMundo e m.tick antes = depois; nada escrito no mundo', `${cenasC.filter(x => x.hashIgual).length}/${cenasC.length} · ${cenasC.filter(x => x.mundoIgual).length}/${cenasC.length}`, 'todas · todas', cenasC.every(x => x.hashIgual && x.mundoIgual));
    // E3: com a cena inteira (os blocos, a espera dos lances) e sem ela, a saída do 2º tempo no MESMO tick e os 600 passos
    // seguintes com o mesmo hash a cada 100 (o laço da página solta no geral: os 3 s do intervalo correm igual)
    const L = await LC.carregarCenas(pastaJs);
    let iguais = 0, total = 0;
    for (const sem of [41, 42, 43]) {
      const a = LC.ateIntervalo(L, sem, { min: 0.5 }), b = LC.ateIntervalo(L, sem, { min: 0.5 });
      if (!a || !b) continue;
      const c = CF.criarCenaFim(CF.planejarFim(a.m, 'intervalo', { lances: 2 }), a.m);
      for (let k = 0; k < 2000 && CF.faseFim(c) !== 'geral'; k++) { if (c.emLances) CF.seguirCenaFim(c); else CF.passoCenaFim(c); }
      let ok = S.hashMundo(a.m) === S.hashMundo(b.m), saidaA = null, saidaB = null;
      for (let k = 0; k < 800; k++) {
        const ea = L.P.passoPartida(a.m, L.P.entradaDemoPartida(a.m), null), eb = L.P.passoPartida(b.m, L.P.entradaDemoPartida(b.m), null);
        if (saidaA == null && ea.some(e => e.tipo === 'saida')) saidaA = a.m.tick;
        if (saidaB == null && eb.some(e => e.tipo === 'saida')) saidaB = b.m.tick;
        if ((k + 1) % 100 === 0 && S.hashMundo(a.m) !== S.hashMundo(b.m)) ok = false;
      }
      total++; if (ok && saidaA != null && saidaA === saidaB) iguais++;
    }
    reg('E3 intervalo: com a cena inteira × sem ela, a saída do 2º tempo no mesmo tick e 800 passos iguais (hash a cada 100)', `${iguais}/${total}`, 'todas (3)', total === 3 && iguais === total);
  }
  if (!cenasFim.length) reg('E pureza do pós-jogo: o mundo não muda com a cena', 'sem cenas (a cena do pós-jogo não existe)', 'hashMundo e m.tick iguais; nada escrito', false);
  else reg('E pureza do pós-jogo: hashMundo e m.tick antes = depois; nada escrito no mundo', `${cenasFim.filter(x => x.hashIgual).length}/${cenasFim.length} · ${cenasFim.filter(x => x.mundoIgual).length}/${cenasFim.length}`, 'todas · todas', cenasFim.every(x => x.hashIgual && x.mundoIgual));
}

// ------------------------------------------------------------------------------------------------ P) a torcida nos estádios reais
// O plano 'torcida' do vermelho anda nos trilhos de torcida do pré-jogo (prejogo-roteiro.js cameraDoPlano). Num estádio de
// forma própria (TM, edição pro: estadio-planta.js / estadio-generico.js) a planta troca a câmera desses planos
// (ajustarPlano): a cena tem de andar no MESMO trilho do pré-jogo daquele estádio (antes andava no do Estádio Golaço — a reta
// central passava por cima ou longe da torcida). Sem planta, o trilho de sempre.
if (roda('P')) {
  if (!CC) reg('P o plano da torcida pelos trilhos da planta do estádio', 'sem cenas (a cena do cartão não existe)', 'o trilho do pré-jogo do estádio', false);
  else {
    const R = await imp('prejogo-roteiro.js'), PL = await imp('estadio-planta.js'), GE = await imp('estadio-generico.js');
    const base = JSON.parse(fs.readFileSync(path.join(pastaJs, '../assets/tm/estadios.json'), 'utf8')).estadios;
    const chaves = [null, 'maracana', 'brinco de ouro', 'estadio da ressacada', 'estadio raulino de oliveira', 'estadio olimpico colosso da lagoa', 'moises lucarelli', 'novelli junior'];
    const L = await LC.carregarCenas(pastaJs);
    const mBase = LC.estadoDoMeio(L, 29, 1700);
    const rotPadrao = R.criarRoteiro('completo');
    let n = 0, iguais = 0, proprios = 0;
    const ruins = [];
    const pc = CC.criarPlanoCameraCartao();
    for (const k of chaves) {
      const e = k ? base[k] : null;
      const planta = !e ? null : e.forma?.entorno === 'maracana' ? PL.criarPlanta(PL.validarForma(e.forma)) : GE.criarPlantaGenerica(e.forma);
      if (k && !planta) { ruins.push(`${k}: sem planta`); continue; }
      const ajuste = planta ? planta.ajustarPlano : null;
      const rot = R.criarRoteiro('completo', ajuste);
      for (const time of [0, 1]) {
        const m = structuredClone(mBase);
        const j = m.jogadores.find(q => q.time === time && q.posicao !== 'GOL');
        const plano = CC.planejarCartao(m, { id: j.id, time, cor: 'vermelho', segundo: false, motivo: 'forcaExcessiva', outros: [] }, { ajustePlano: ajuste });
        const c = CC.criarCenaCartao(plano, m);
        const pl = plano.planos.find(p => p.nome === 'torcida'), id = time === 1 ? 'visitantes' : 'organizada';
        const pr = rot.planos.find(p => p.id === id), pp = rotPadrao.planos.find(p => p.id === id);
        let dif = 0, dPadrao = 0;
        while (!c.acabou) {
          CC.passoCenaCartao(c);
          c.alfa = 1;
          const t = c.k * PASSO;
          if (t < pl.t0 + 1e-9 || t >= pl.t1) continue;
          CC.planoCameraCartao(c, { pequena: false, aspecto: 16 / 9 }, pc);
          const u = (t - pl.t0) / Math.max(0.1, pl.t1 - pl.t0);
          const q = R.cameraEm(rot, pr.t0 + u * pr.dur, {}), q0 = R.cameraEm(rotPadrao, pp.t0 + u * pp.dur, {});
          const d = Math.max(...[pc.de[0] - q.px, pc.de[1] - q.py, pc.de[2] - q.pz, pc.para[0] - q.lx, pc.para[1] - q.ly, pc.para[2] - q.lz, pc.fov - q.fov].map(Math.abs));
          dif = Math.max(dif, d);
          dPadrao = Math.max(dPadrao, Math.hypot(q.px - q0.px, q.py - q0.py, q.pz - q0.pz));
        }
        n++;
        if (dif < 1e-6) iguais++; else ruins.push(`${k ?? 'padrão'}/${id}: ${f2(dif)} m`);
        if (dPadrao > 1) proprios++;
      }
    }
    reg('P o plano da torcida do vermelho no trilho do pré-jogo do estádio (a planta: Maracanã e 6 genéricos; e o padrão)', `${iguais}/${n} iguais${ruins.length ? ` (diferentes: ${ruins.slice(0, 4).join('; ')}${ruins.length > 4 ? '…' : ''})` : ''}; ${proprios} com trilho próprio da planta`, `todos; ≥ 1 próprio`, iguais === n && n === chaves.length * 2 && proprios >= 1);
  }
}

// ------------------------------------------------------------------------------------------------ G) custo
// CPU do fio por tick da cena: a mediana de 5 medidas por situação, a parede MENOS a espera do fio principal na fila do
// escalonador (2º campo de /proc/thread-self/schedstat, em ns — a conta do teste-comemoracao 12 e do teste-custo): o tempo
// em que o fio esteve fora da CPU porque outro processo a usava não é custo da cena. Sem o arquivo (outro sistema), a
// melhor parede de 5.
if (roda('G')) {
  if (!CC) reg('G custo da cena por tick', 'sem cenas (a cena do cartão não existe)', '≤ 0,6 ms', false);
  else {
    let espera = () => 0, comEspera = false;
    try {
      const fd = fs.openSync('/proc/thread-self/schedstat', 'r'), buf = Buffer.alloc(128);
      const ler = () => {
        const n = fs.readSync(fd, buf, 0, 128, 0);
        let k = 0; while (k < n && buf[k] !== 32) k++; k++;
        let v = 0; while (k < n && buf[k] >= 48 && buf[k] <= 57) { v = v * 10 + buf[k] - 48; k++; }
        return v / 1e6;
      };
      ler(); espera = ler; comEspera = true;
    } catch { /* sem schedstat: a parede */ }
    const L = await LC.carregarCenas(pastaJs);
    const base = LC.estadoDoMeio(L, 3, 1500);
    const por = [], parede = [];
    for (const sit of SITUACOES) {
      const med = [];
      let melhorParede = Infinity;
      for (let rep = 0; rep < 5; rep++) {
        const m = structuredClone(base);
        const ev = LC.forcarCartao(L, m, sit);
        if (!ev) continue;
        const c = CC.criarCenaCartao(CC.planejarCartao(ev.m, CC.escolherCartao(ev.eventos), { treinadores: treinadoresDe(ev.m) }), ev.m);
        const e0 = espera(), t0 = performance.now(); let n = 0;
        while (!c.acabou) { CC.passoCenaCartao(c); n++; }
        const pm = performance.now() - t0, e = espera() - e0;
        med.push(Math.max(0, pm - e) / n); melhorParede = Math.min(melhorParede, pm / n);
      }
      if (!med.length) continue;
      med.sort((x, y) => x - y);
      por.push(comEspera ? med[med.length >> 1] : melhorParede); parede.push(melhorParede);
    }
    reg(`G custo da cena do cartão por tick (${SITUACOES.length} situações, 24–25 atores; ${comEspera ? 'a mediana de 5, sem a espera na fila do escalonador' : 'a melhor de 5, parede'})`,
      `${por.map(f3).join(' / ')} ms${comEspera ? ` (a melhor parede ${parede.map(f3).join(' / ')}; no canhão, p95 da parede ${f3(p95(custosA))})` : ''}`, '≤ 0,6 ms (a meta da comemoração)', por.length === SITUACOES.length && Math.max(...por) <= 0.6);
    // o intervalo: 3 intervalos (27 atores), a mediana de 5 de cada, como o cartão
    if (CF) {
      const porC = [], parC = [];
      for (const sem of [51, 52, 53]) {
        const x = LC.ateIntervalo(L, sem, { min: 0.5 });
        if (!x) continue;
        const med = [];
        let mp = Infinity;
        for (let rep = 0; rep < 5; rep++) {
          const c = CF.criarCenaFim(CF.planejarFim(x.m, 'intervalo', { treinadores: treinadoresDe(x.m) }), x.m);
          const e0 = espera(), t0 = performance.now(); let n = 0;
          while (CF.faseFim(c) !== 'geral' && n < 2000) { CF.passoCenaFim(c); n++; }
          const pm = performance.now() - t0, e = espera() - e0;
          med.push(Math.max(0, pm - e) / n); mp = Math.min(mp, pm / n);
        }
        med.sort((a, b) => a - b);
        porC.push(comEspera ? med[med.length >> 1] : mp); parC.push(mp);
      }
      reg('G custo da cena do intervalo por tick (3 intervalos, 27 atores; até o geral)', `${porC.map(f3).join(' / ')} ms${custosC.length ? ` (no canhão C, p95 da parede ${f3(p95(custosC))})` : ''}`, '≤ 0,6 ms', porC.length === 3 && Math.max(...porC) <= 0.6);
    } else reg('G custo da cena do intervalo por tick', 'sem a cena do intervalo', '≤ 0,6 ms', false);
    // o pós-jogo: 3 fins (27 atores), a mediana de 5 de cada, a cena inteira até o geral
    if (CF && SU && typeof SU.melhorEmCampo === 'function') {
      const porF = [], parF = [];
      for (const sem of [61, 62, 63]) {
        const x = LC.ateFim(L, sem, { min: 0.5, sumula: SU });
        if (!x) continue;
        const melhor = SU.melhorEmCampo(x.sumula, x.m);
        const med = [];
        let mp = Infinity;
        for (let rep = 0; rep < 5; rep++) {
          const c = CF.criarCenaFim(CF.planejarFim(x.m, 'fimDeJogo', { treinadores: treinadoresDe(x.m), melhor }), x.m);
          const e0 = espera(), t0 = performance.now(); let n = 0;
          while (CF.faseFim(c) !== 'geral' && n < 4000) { CF.passoCenaFim(c); n++; }
          const pm = performance.now() - t0, e = espera() - e0;
          med.push(Math.max(0, pm - e) / n); mp = Math.min(mp, pm / n);
        }
        med.sort((a, b) => a - b);
        porF.push(comEspera ? med[med.length >> 1] : mp); parF.push(mp);
      }
      reg('G custo da cena do pós-jogo por tick (3 fins, 27 atores; até o geral)', `${porF.map(f3).join(' / ')} ms${custosFim.length ? ` (no canhão F-fim, p95 da parede ${f3(p95(custosFim))})` : ''}`, '≤ 0,6 ms', porF.length === 3 && Math.max(...porF) <= 0.6);
    } else reg('G custo da cena do pós-jogo por tick', 'sem a cena do pós-jogo', '≤ 0,6 ms', false);
  }
}

imprimir();
process.exit(falhas ? 1 : 0);
