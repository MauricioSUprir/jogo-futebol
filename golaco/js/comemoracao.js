// Cena de COMEMORAÇÃO do gol (pedido do dono de 11/10: "não tem cena de comemoração!!!"). PURA: sem three.js nem DOM,
// testada em Node (tools/teste-comemoracao.mjs) e desenhada pela página (main.js) no lugar dos jogadores da simulação.
// Contrato em CONTRATOS.md ("Comemoração"); pesquisa em PESQUISA-ESTADIO.md §10; constantes em config.js COMEMORACAO.
//
// O mundo NÃO é tocado: no tick do gol os 22 são COPIADOS (estado cinemático e pés) para um mundo de cena à parte, que
// anda com a MESMA locomoção do jogo (jogador.js passoCorpo, passoPassada, passoPeDesenhado; anim.js alturaQuadril e
// pose): pé plantado não patina, pé no ar anda na velocidade de um pé humano; o goleiro que estava voando termina a
// defesa (goleiro.js passoMergulho/pesMergulho). Por cima da pose da locomoção:
//  - GESTOS por IK do braço (anim.js ikBraco): braços abertos, punho cerrado, mão no peito, apontar para o céu, braços em
//    V, soco no ar, mão no ombro do autor (abraço), mãos na cintura ou na cabeça e cabeça baixa (quem sofreu);
//  - GOLPES de corpo inteiro: de joelhos (o corpo desliza pela conta dele e para no alvo; joelhos a 6,5 cm do chão por IK
//    da perna), pulo (agacha, estende, voo balístico com as pernas encolhendo, aterrissa), giro (o pulo com uma volta
//    inteira no ar), agachado (goleiro batido, autor do gol contra) e o pulo do grupo no abraço.
// Roteiro no tempo t desde o gol: REDE (a câmera do gol do jogo, 1,2 s) → CORRIDA (o autor corre para o alvo:
// bandeirinha, linha de fundo diante da torcida ou lateral do lado da TV; até 4 colegas saem atrás dele) → FINALIZAÇÃO
// (1,5 s) → ABRAÇO (até 6,5 s) → REAÇÃO de quem sofreu (1 s) → fim (a página passa para o replay). Gol da IA contra o time
// do humano: cena curta (~4,5 s, sem abraço). Gol contra: comemora o jogador de linha do time que marcou mais perto da
// bola; o autor do gol contra fica agachado com as mãos na cabeça. A finalização sai de um hash do (tick do gol, autor) —
// nunca do m.rng — e nunca repete a última.
// Câmera (planoCamera): função pura das posições guardadas por tick (média do autor nos últimos 0,3 s): steadicam à
// frente e de lado do autor (do lado da câmera de TV), contraplano no gramado atrás do grupo com a torcida no fundo e
// plano médio de quem sofreu. Nada é alocado por tick neste módulo (vetores e objetos reaproveitados).
import { PASSO, CAMPO, JOGADOR, COMEMORACAO } from './config.js';
import { difAng } from './mat.js';
import { passoCorpo, passoPassada, passoPeDesenhado } from './jogador.js';
import { pose, alturaQuadril, J, NJ, ik, ikBraco } from './anim.js';
import { mergulhoAtivo, passoMergulho, fixarMergulho, pesMergulho } from './goleiro.js';

const C = COMEMORACAO;
const MX = CAMPO.meioX, MZ = CAMPO.meioZ;
const L1 = JOGADOR.coxa, L2 = JOGADOR.canela, TORN = JOGADOR.alturaTornozelo;
const GRAV = 9.81;

/** Finalizações (cena normal e curta), formas de corrida e fases, na ordem. */
export const FINAIS = ['joelhos', 'pulo', 'ceu', 'bracos', 'giro'];
export const FINAIS_CURTA = ['bracos', 'ceu'];
export const CORRIDAS = ['aviao', 'punho', 'peito'];
export const FASES = ['rede', 'corrida', 'final', 'abraco', 'reacao', 'fim'];
/** Papéis dos atores. */
export const PAPEIS = ['autor', 'colega', 'resto', 'sofreu', 'goleiroSofreu', 'contra'];
const AUTOR = 0, COLEGA = 1, RESTO = 2, SOFREU = 3, GOLEIRO_SOFREU = 4, CONTRA = 5;

const NHIST = 640;   // ticks guardados da posição do autor (10,6 s; a cena dura ≤ 8,5 s)
const s60 = s => Math.round(s / PASSO);
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function suave(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
function lerp(a, b, t) { return a + (b - a) * t; }

// Gestos: alvo da mão em relação ao OMBRO, no referencial do rumo (f = frente, r = para fora do lado, y = para cima) e o
// polo do cotovelo no mesmo referencial (pf, pr, py). r < 0 = para dentro (mão no peito, na cabeça).
//                       f      r      y      pf    pr    py
const G_AVIAO = [-0.05, 0.53, 0.02, -0.3, 0.2, -1];
const G_V = [0.0, 0.3, 0.42, -0.2, 1, 0];
const G_CEU = [0.15, 0.1, 0.5, 0, 1, 0];
const G_SOCO = [0.1, 0.1, 0.52, 0, 1, 0];
const G_FORA = [0.15, 0.3, -0.15, -0.3, 1, -0.5];
const G_PEITO = [0.15, -0.24, -0.05, -0.2, 1, -0.6];
const G_CINTURA = [-0.02, 0.12, -0.47, -0.6, 1, 0];
const G_CABECA = [0.02, -0.1, 0.27, 0, 1, 0.4];
const G_PUNHO = [0.12, 0.12, 0.36, 0, 1, 0];   // o punho cerrado sobe e desce (y + 0,14·sen) na corrida

/** Hash de 32 bits de dois inteiros (a mesma conta em todo motor JS: Math.imul). */
export function hashGol(tick, id) {
  let h = Math.imul((tick | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(((id | 0) + 0x632be5ab) | 0, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Finalização pelo hash do (tick do gol, autor), nunca a mesma da última (ultima). */
export function escolherFinal(tick, id, ultima = null, curta = false) {
  const lista = curta ? FINAIS_CURTA : FINAIS;
  let n = 0;
  for (const v of lista) if (v !== ultima) n++;
  let k = hashGol(tick, id) % n;
  for (const v of lista) { if (v === ultima) continue; if (k-- === 0) return v; }
  return lista[0];
}

/**
 * Alvo da corrida: o mais perto a ≥ min m do autor entre a bandeirinha do lado dele, a linha de fundo diante da torcida
 * (ao lado da área) e a lateral do lado da câmera de TV; além de max m, o alvo vem para perto do autor (na mesma reta).
 * (ux, uz) = para onde o autor olha no fim (a torcida atrás do alvo).
 */
function escolherAlvo(autor, s, min, max) {
  const lz = autor.z >= 0 ? 1 : -1, r = Math.SQRT1_2;
  const cands = [
    { x: s * (MX - 2), z: lz * (MZ - 2), ux: s * r, uz: lz * r, nome: 'bandeirinha' },
    { x: s * (MX - 1.5), z: lz * 12, ux: s, uz: 0, nome: 'fundo' },
    { x: clamp(autor.x, -MX + 8, MX - 8), z: MZ - 1.5, ux: 0, uz: 1, nome: 'lateral' },
  ];
  let melhor = null, dm = Infinity, longe = null, dl = -1;
  for (const c of cands) {
    const d = Math.hypot(c.x - autor.x, c.z - autor.z);
    if (d >= min && d < dm) { dm = d; melhor = c; }
    if (d > dl) { dl = d; longe = c; }
  }
  const a = melhor ?? longe;
  const d = Math.hypot(a.x - autor.x, a.z - autor.z);
  a.perto = false;
  if (d > max) { const k = max / d; a.x = autor.x + (a.x - autor.x) * k; a.z = autor.z + (a.z - autor.z) * k; a.perto = true; }
  a.d0 = Math.min(d, max);
  return a;
}

/**
 * Plano da comemoração (no tick do gol; só LÊ o mundo). gol = {tick, time (que marcou), id (autor de verdade:
 * render/autor-gol.js), contra}. opc = {timeHumano (gol do outro time = cena curta), ultima (a finalização do gol
 * anterior), variante (força uma: testes e prints)}.
 */
export function planejarComemoracao(m, gol, opc = {}) {
  const time = gol.time === 1 ? 1 : 0;
  const s = (m.ataca?.[time] ?? (time === 0 ? 1 : -1)) >= 0 ? 1 : -1;
  const curta = opc.timeHumano != null && time !== opc.timeHumano;
  const js = m.jogadores;
  let autor = gol.id != null ? (js.find(j => j.id === gol.id) ?? null) : null;
  let contraId = null;
  if (autor && autor.time !== time) { contraId = autor.id; autor = null; }
  if (!autor) {
    // gol contra (ou sem autor): comemora o jogador de linha do time que marcou mais perto da bola
    const b = m.bola.p;
    let dm = Infinity;
    for (const j of js) {
      if (j.time !== time || j.posicao === 'GOL') continue;
      const d = Math.hypot(j.x - b.x, j.z - b.z);
      if (d < dm) { dm = d; autor = j; }
    }
    if (!autor) autor = js.find(j => j.time === time) ?? js[0];
  }
  const A = curta ? C.curta : C;
  const alvo = escolherAlvo(autor, s, A.alvoMin, A.alvoMax);
  const lista = curta ? FINAIS_CURTA : FINAIS;
  const variante = opc.variante && lista.includes(opc.variante) ? opc.variante : escolherFinal(gol.tick, autor.id, opc.ultima ?? null, curta);
  const h = hashGol(gol.tick, autor.id);
  const corrida = curta ? 'punho' : (opc.corrida && CORRIDAS.includes(opc.corrida) ? opc.corrida : CORRIDAS[(h >>> 7) % CORRIDAS.length]);
  // colegas: os de linha mais perto do alvo (a ≤ raioBusca)
  const cand = [];
  for (const j of js) {
    if (j.time !== time || j === autor || j.posicao === 'GOL') continue;
    const d = Math.hypot(j.x - alvo.x, j.z - alvo.z);
    if (d <= C.colegas.raioBusca) cand.push({ id: j.id, d });
  }
  cand.sort((a, b) => a.d - b.d || a.id - b.id);
  const colegas = cand.slice(0, C.colegas.max).map(o => o.id);
  // quem aparece no plano da reação: o autor do gol contra, senão o goleiro batido (perto do gol), senão o defensor
  // mais perto do gol
  let reacaoId = contraId;
  if (reacaoId == null) {
    const gk = js.find(j => j.time !== time && j.posicao === 'GOL');
    if (gk && Math.abs(gk.x - s * MX) < 20 && Math.abs(gk.z) < 20) reacaoId = gk.id;
  }
  if (reacaoId == null) {
    let dm = Infinity;
    for (const j of js) {
      if (j.time === time) continue;
      const d = Math.hypot(j.x - s * MX, j.z);
      if (d < dm) { dm = d; reacaoId = j.id; }
    }
  }
  return {
    golTick: gol.tick, time, s, curta, autorId: autor.id, contraId, contra: !!gol.contra || contraId != null,
    alvo, variante, corrida, colegas, colegasPerto: cand.length, reacaoId, hash: h,
  };
}

// ------------------------------------------------------------------------------------------------ atores
function clonar(o) { return o == null ? null : (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o))); }

/**
 * Cópia do jogador para a cena: o estado cinemático, os pés (cópias) e o mergulho em andamento; nada de bola. Exportada
 * (com criarAtor, separar, maoEm, gesto, limitarCamera e ajustarCelular) para a cena de substituição (substituicao.js).
 */
export function copiaJogador(j) {
  const c = { ...j };
  c.pes = [{ ...j.pes[0] }, { ...j.pes[1] }];
  c.mergulho = j.posicao === 'GOL' && j.mergulho ? clonar(j.mergulho) : null;
  c.cond = null; c.defesa = null; c.travaApoio = null; c.alvo = null; c.recebe = null; c.corrida = null; c.carga = null;
  c.pedido = null; c.mira = null; c.miraAuto = null; c.conter = null; c.defH = null; c.salto = null; c.arremesso = null;
  c.segura = null; c.saindo = null; c.ia = null; c.iaA = null; c.iaT = null; c.recep = null; c.contorno = null;
  c.intercepta = null; c.iaAcao = null; c.pedidoPedalada = null; c.botoes = 0; c.botoesAnt = 0;
  return c;
}

export function criarAtor(j, i) {
  return {
    j: copiaJogador(j), i, id: j.id, time: j.time, goleiro: j.posicao === 'GOL',
    papel: RESTO, t0: 0, slot: 0,
    ant: new Float32Array(NJ * 3), atu: new Float32Array(NJ * 3),
    x0: j.x, z0: j.z, r0: j.rumo, x1: j.x, z1: j.z, r1: j.rumo,
    noAr: false,         // os pés desenhados estão fora do chão por um golpe (deslize, pulo, giro, pulo do grupo)
    desliza: false, ajoelhado: false, mergulha: false, fixo: false,
    decel: 0, kGolpe: -1,
    // tornozelos e pontas no referencial do corpo no começo do golpe (o deslize parte deles)
    tf: new Float32Array(4), tr: new Float32Array(4), ty: new Float32Array(4),
    agacha: 0,           // peso do agachado (goleiro batido, autor do gol contra), guardado por tick
    gesto: 0,            // gesto do lamento (0 cintura, 1 cabeça)
  };
}

/**
 * Cena a partir do mundo no tick do gol (só LÊ o mundo: cópias). Devolve o estado da cena; passoCena anda um tick.
 */
export function criarCena(plano, m) {
  const atores = [];
  for (let i = 0; i < m.jogadores.length; i++) atores.push(criarAtor(m.jogadores[i], i));
  const b = m.bola.p;
  const mF = {
    tick: m.tick, posse: null, naMao: null, parada: null, voo: null,
    bola: { p: { x: b.x, y: b.y, z: b.z }, v: { x: 0, y: 0, z: 0 }, q: { x: 0, y: 0, z: 0, w: 1 } },
    jogadores: atores.map(a => a.j), ataca: m.ataca,
  };
  const c = {
    plano, mF, atores, ordem: null, autor: null, reacao: null,
    alvo: plano.alvo, s: plano.s, time: plano.time, curta: plano.curta, variante: plano.variante, corrida: plano.corrida,
    k: 0, acum: 0, alfa: 0, acabou: false,
    kFinal: -1, kFimFinal: -1, kFimAbraco: -1,
    // fim provisório (a finalização ainda não começou): o pior caso
    kFim: s60(plano.curta ? Math.max(C.curta.duracao, C.chegadaMax + C.curta.final + C.curta.reacao) : C.chegadaMax + C.final + C.abracoMin + C.reacao),
    kPulo: -1, rumoFinal: Math.atan2(plano.alvo.uz, plano.alvo.ux), ladoContra: null, giroReacao: 0,
    olhoY: 1.25,
    hx: new Float32Array(NHIST), hz: new Float32Array(NHIST),
    _d: { dx: 1, dz: 0, vel: 0, rumo: 0 },
  };
  const porId = new Map(atores.map(a => [a.id, a]));
  for (const a of atores) {
    if (a.time !== plano.time) a.papel = a.goleiro ? GOLEIRO_SOFREU : SOFREU;
    a.gesto = a.id % 2;
  }
  c.autor = porId.get(plano.autorId);
  c.autor.papel = AUTOR;
  plano.colegas.forEach((id, i) => {
    const a = porId.get(id);
    if (!a) return;
    a.papel = COLEGA; a.slot = i; a.t0 = C.colegas.atraso[0] + C.colegas.atraso[1] * i;
  });
  if (plano.contraId != null && porId.get(plano.contraId)) porId.get(plano.contraId).papel = CONTRA;
  c.nColegas = plano.colegas.length;
  c.reacao = porId.get(plano.reacaoId) ?? null;
  // o autor primeiro: os colegas abraçam a pose dele neste tick
  c.ordem = [c.autor, ...atores.filter(a => a !== c.autor)];
  c.hx[0] = c.autor.j.x; c.hz[0] = c.autor.j.z;
  for (const a of c.ordem) { poseAtor(c, a, 0); a.ant.set(a.atu); }
  c.olhoY = c.autor.atu[J.peito * 3 + 1] - 0.1;
  return c;
}

// ------------------------------------------------------------------------------------------------ desejos
function para(c, vel, rumo) {
  const d = c._d;
  d.dx = Math.cos(rumo); d.dz = Math.sin(rumo); d.vel = vel; d.rumo = rumo;
  return d;
}

/** Fronteiras das fases depois que a finalização começa (tick c.k). */
function iniciarFinal(c, a) {
  c.kFinal = c.k;
  const fin = c.curta ? C.curta.final : C.final;
  c.kFimFinal = c.kFinal + s60(fin);
  if (c.curta) {
    c.kFimAbraco = c.kFimFinal;
    c.kFim = Math.max(s60(C.curta.duracao), c.kFimFinal + s60(C.curta.reacao));
  } else {
    c.kFimAbraco = Math.max(s60(C.abracoAte), c.kFimFinal + s60(C.abracoMin));
    c.kFim = c.kFimAbraco + s60(C.reacao);
  }
  if (c.variante === 'joelhos') {
    // deslize de joelhos: desacelera até parar no alvo
    const j = a.j, v = Math.hypot(j.vx, j.vz), d = Math.hypot(c.alvo.x - j.x, c.alvo.z - j.z);
    a.decel = clamp((v * v) / (2 * Math.max(0.3, d)), C.deslize.decel[0], C.deslize.decel[1]);
    a.desliza = true; a.fixo = true; a.kGolpe = c.k;
    guardarPes(a);
  }
}

/** Guarda tornozelos e pontas da pose atual no referencial do corpo (o golpe parte deles, preso ao corpo). */
function guardarPes(a) {
  const j = a.j, o = a.atu, fx = Math.cos(j.rumo), fz = Math.sin(j.rumo);
  const idx = [J.tornozeloE, J.tornozeloD, J.pontaE, J.pontaD];
  for (let q = 0; q < 4; q++) {
    const i = idx[q], dx = o[i * 3] - j.x, dz = o[i * 3 + 2] - j.z;
    a.tf[q] = dx * fx + dz * fz; a.tr[q] = -dx * fz + dz * fx; a.ty[q] = o[i * 3 + 1];
  }
}

function desejo(c, a, t) {
  const j = a.j, au = c.autor.j;
  switch (a.papel) {
    case AUTOR: {
      const al = c.alvo, dx = al.x - j.x, dz = al.z - j.z, d = Math.hypot(dx, dz), r = Math.atan2(dz, dx);
      if (c.kFinal < 0) {
        const parar = c.variante === 'joelhos' ? C.deslize.inicio : C.parada;
        if ((t >= C.reage && d < parar) || t >= C.chegadaMax) {
          iniciarFinal(c, a);
          // (de joelhos: o deslize começa já neste tick; em pé: este tick ainda é de corrida)
          return para(c, Math.hypot(j.vx, j.vz), r);
        }
        let vel = Math.min(j.par.vArrancada * C.velCorrida, 1.2 + d * 1.1);
        if (t < C.reage) vel = Math.min(vel, Math.hypot(j.vx, j.vz));
        return para(c, vel, r);
      }
      // finalização em pé: para e vira para a torcida
      return para(c, 0, c.rumoFinal);
    }
    case COLEGA: {
      const rAut = Math.atan2(au.z - j.z, au.x - j.x);
      if (t < a.t0) return para(c, 0, rAut);
      const al = c.alvo;
      const perto = c.kFinal >= 0 || Math.hypot(au.x - al.x, au.z - al.z) < 4;
      const cx = perto ? au.x : al.x, cz = perto ? au.z : al.z;
      const base = Math.atan2(-al.uz, -al.ux); // do alvo para dentro do campo
      const ang = base + (a.slot - (c.nColegas - 1) / 2) * C.colegas.abertura;
      const vx = cx + Math.cos(ang) * C.colegas.vaga, vz = cz + Math.sin(ang) * C.colegas.vaga;
      const ex = vx - j.x, ez = vz - j.z, de = Math.hypot(ex, ez);
      if (de < 0.25) return para(c, 0, rAut);
      const dd = c._d;
      dd.dx = ex / de; dd.dz = ez / de; dd.vel = Math.min(j.par.vArrancada * C.colegas.vel, 0.6 + de * 1.6);
      dd.rumo = de < 3 ? rAut : Math.atan2(ez, ex);
      return dd;
    }
    case SOFREU: {
      if (t < C.sofreu.espera) return para(c, 0, j.rumo);
      // anda cabisbaixo para a saída de bola (o time que sofreu recomeça)
      const tx = c.s * C.sofreu.meio, tz = j.z * 0.6, dx = tx - j.x, dz = tz - j.z, d = Math.hypot(dx, dz);
      if (d < 0.5) return para(c, 0, j.rumo);
      return para(c, Math.min(C.sofreu.vel, d * 0.8), Math.atan2(dz, dx));
    }
    case RESTO: {
      const dx = au.x - j.x, dz = au.z - j.z, d = Math.hypot(dx, dz), r = Math.atan2(dz, dx);
      if (a.goleiro || t < C.resto.desde || d < C.resto.para) return para(c, 0, r);
      return para(c, Math.min(C.resto.vel, (d - C.resto.para) * 1.2 + 0.4), r);
    }
    default:
      // goleiro batido e autor do gol contra: ficam (agachados)
      return para(c, 0, j.rumo);
  }
}

/** Deslize de joelhos: o corpo desacelera na direção em que vinha (a perna não anda: os joelhos deslizam). */
function deslizar(a) {
  const j = a.j, v = Math.hypot(j.vx, j.vz);
  if (v > 1e-4) {
    const nv = Math.max(0, v - a.decel * PASSO);
    j.vx *= nv / v; j.vz *= nv / v;
  } else { j.vx = 0; j.vz = 0; }
  j.x += j.vx * PASSO; j.z += j.vz * PASSO;
  j.ax = 0; j.az = 0; j.giro = 0;
  if (j.vx === 0 && j.vz === 0) { a.desliza = false; a.ajoelhado = true; }
}

/**
 * Quanto o ator cede no encontrão: parado num golpe (deslize, ajoelhado, mergulho, agachado) não cede; quem sofreu cede
 * pouco (anda devagar, cabisbaixo: quem corre para o abraço é que desvia — antes ele levava o tranco e passava de
 * 3 m/s); o resto cede inteiro.
 */
function cede(a) { return a.fixo ? 0 : a.papel === SOFREU || a.papel === GOLEIRO_SOFREU || a.papel === CONTRA ? 0.25 : 1; }

/**
 * Ninguém dentro de ninguém: centros a ≥ min m (padrão C.separacao; antes da passada, como o colisaoCorpos do jogo).
 */
export function separar(c, min = C.separacao) {
  const at = c.atores, n = at.length, min2 = min * min;
  for (let it = 0; it < 2; it++) {
    for (let p = 0; p < n; p++) {
      const A = at[p], ja = A.j, fa = cede(A);
      for (let q = p + 1; q < n; q++) {
        const B = at[q], jb = B.j;
        const dx = jb.x - ja.x, dz = jb.z - ja.z, d2 = dx * dx + dz * dz;
        if (d2 >= min2) continue;
        const fb = cede(B), tot = fa + fb;
        if (!tot) continue;
        const d = Math.sqrt(d2);
        let nx = 1, nz = 0;
        if (d > 1e-6) { nx = dx / d; nz = dz / d; }
        const pen = min - d, ka = pen * fa / tot, kb = pen * fb / tot;
        ja.x -= nx * ka; ja.z -= nz * ka; jb.x += nx * kb; jb.z += nz * kb;
        // velocidade de aproximação sai (como no jogo): ninguém empurra o outro de novo no tick seguinte
        const rv = (jb.vx - ja.vx) * nx + (jb.vz - ja.vz) * nz;
        if (rv < 0) {
          ja.vx += nx * rv * fa / tot; ja.vz += nz * rv * fa / tot;
          jb.vx -= nx * rv * fb / tot; jb.vz -= nz * rv * fb / tot;
        }
      }
    }
  }
}

// ------------------------------------------------------------------------------------------------ passo
/** Um tick (1/60 s) da cena. Devolve false se ela já acabou. */
export function passoCena(c) {
  if (c.acabou) return false;
  const t = c.k * PASSO, mF = c.mF;
  for (const a of c.ordem) {
    const j = a.j;
    a.mergulha = false;
    if (a.desliza) { deslizar(a); continue; }
    if (a.ajoelhado) continue;
    if (a.goleiro && j.mergulho && mergulhoAtivo(j, mF.tick + 1)) { passoMergulho(mF, j); a.mergulha = true; a.fixo = true; continue; }
    if (a.papel === GOLEIRO_SOFREU || a.papel === CONTRA) a.fixo = a.agacha > 0.02;
    const d = desejo(c, a, t);
    if (a.desliza) { deslizar(a); continue; }
    passoCorpo(j, d.dx, d.dz, d.vel, d.rumo, j.par, PASSO, false);
  }
  separar(c);
  for (const a of c.ordem) {
    if (a.mergulha) { fixarMergulho(mF, a.j); pesMergulho(mF, a.j); continue; }
    if (a.desliza || a.ajoelhado) continue;
    passoPassada(a.j, false, PASSO, null, null);
  }
  for (const a of c.ordem) if (!a.mergulha && !a.desliza && !a.ajoelhado) passoPeDesenhado(a.j, mF, PASSO);
  mF.tick++;
  c.k++;
  for (const a of c.ordem) if (!a.desliza && !a.ajoelhado) a.j.quadril = alturaQuadril(a.j, mF);
  const tk = c.k * PASSO;
  // o pulo/giro começa quando o autor parou de frente para a torcida (ou depois de pulo.espera s)
  if ((c.variante === 'pulo' || c.variante === 'giro') && c.kFinal >= 0 && c.kPulo < 0) {
    const j = c.autor.j;
    if ((Math.hypot(j.vx, j.vz) < 0.35 && Math.abs(difAng(j.rumo, c.rumoFinal)) < 0.35) || c.k - c.kFinal >= s60(C.pulo.espera)) c.kPulo = c.k;
  }
  for (const a of c.ordem) {
    a.ant.set(a.atu);
    a.x0 = a.x1; a.z0 = a.z1; a.r0 = a.r1;
    // agachado (goleiro batido depois da defesa, autor do gol contra): entra devagar
    if ((a.papel === GOLEIRO_SOFREU || a.papel === CONTRA) && !(a.goleiro && a.j.mergulho && mergulhoAtivo(a.j, mF.tick)) && (a.agacha > 0 || Math.hypot(a.j.vx, a.j.vz) < 1)) {
      a.agacha = Math.min(1, a.agacha + PASSO / C.agacha.entra);
    }
    poseAtor(c, a, tk);
    a.x1 = a.j.x; a.z1 = a.j.z; a.r1 = a.j.rumo;
  }
  // o autor ajoelhado: os pés ficam plantados onde a pose os desenha (a régua do pé plantado vale)
  const au = c.autor;
  if (au.ajoelhado && au.kGolpe >= 0 && !au.noAr) {
    for (let p = 0; p < 2; p++) {
      const pe = au.j.pes[p], iT = p ? J.tornozeloD : J.tornozeloE;
      pe.apoio = true; pe.x = au.atu[iT * 3]; pe.z = au.atu[iT * 3 + 2];
    }
    au.kGolpe = -1;
  }
  // olho da câmera no peito do autor (sem acompanhar o voo do pulo) e a posição dele para a média da câmera
  const py = au.atu[J.peito * 3 + 1] - 0.1 - (au.noAr ? alturaGolpe(c, tk) : 0);
  c.olhoY += (py - c.olhoY) * (1 - Math.exp(-PASSO / 0.25));
  if (c.k < NHIST) { c.hx[c.k] = au.j.x; c.hz[c.k] = au.j.z; }
  if (c.k === c.kFimFinal && !c.curta) c.ladoContra = escolherLadoContra(c);
  if (c.k === c.kFimAbraco) c.giroReacao = escolherGiroReacao(c);
  if (c.k >= c.kFim) c.acabou = true;
  return true;
}

/**
 * Avança a cena dt s reais (o relógio do desenho: a página chama a cada quadro, parada na pausa). Roda os ticks inteiros
 * e guarda a sobra em alfa (o desenho interpola ant → atu). Devolve quantos ticks rodou.
 */
export function avancarCena(c, dt) {
  if (c.acabou) { c.alfa = 1; return 0; }
  c.acum += Math.max(0, dt);
  let n = 0;
  while (c.acum >= PASSO - 1e-9 && !c.acabou) { passoCena(c); c.acum -= PASSO; n++; }
  if (c.acum < 0) c.acum = 0;
  c.alfa = c.acabou ? 1 : Math.min(1, c.acum / PASSO);
  return n;
}

/** Tempo (s) da cena no estado desenhado. */
export function tempoCena(c) { return Math.max(0, c.k - 1 + c.alfa) * PASSO; }

/** Fase no tick (fracionário) tk. */
export function faseEm(c, tk) {
  if (tk >= c.kFim && c.kFinal >= 0) return 'fim';
  if (tk * PASSO < C.rede) return 'rede';
  if (c.kFinal < 0 || tk < c.kFinal) return 'corrida';
  if (tk < c.kFimFinal) return 'final';
  if (tk < c.kFimAbraco) return 'abraco';
  return 'reacao';
}
/** Fase do estado desenhado. */
export function faseCena(c) { return c.acabou ? 'fim' : faseEm(c, Math.max(0, c.k - 1 + c.alfa)); }
/** Duração da cena (s); antes da finalização começar, a do pior caso. */
export function duracaoCena(c) { return c.kFim * PASSO; }

// ------------------------------------------------------------------------------------------------ poses e gestos
const SUP = [J.pelve, J.lombar, J.peito, J.pescoco, J.cabeca, J.ombroE, J.cotoveloE, J.maoE, J.ombroD, J.cotoveloD, J.maoD, J.quadrilE, J.quadrilD];
const TRONCO = [J.lombar, J.peito, J.pescoco, J.cabeca, J.ombroE, J.cotoveloE, J.maoE, J.ombroD, J.cotoveloD, J.maoD];
const PERNAS = [J.joelhoE, J.tornozeloE, J.pontaE, J.joelhoD, J.tornozeloD, J.pontaD];

function moverJuntas(o, lista, dx, dy, dz) {
  for (let k = 0; k < lista.length; k++) { const i = lista[k] * 3; o[i] += dx; o[i + 1] += dy; o[i + 2] += dz; }
}
function moverTudo(o, dy) { for (let i = 1; i < o.length; i += 3) o[i] += dy; }

/** Gira o tronco (lombar para cima, com os braços) em volta da pelve, no eixo da direita: ang > 0 = para a frente. */
function inclinarTronco(o, fx, fz, ang) {
  if (ang === 0) return;
  const px = o[J.pelve * 3], py = o[J.pelve * 3 + 1], pz = o[J.pelve * 3 + 2];
  const ca = Math.cos(ang), sa = Math.sin(ang);
  for (let k = 0; k < TRONCO.length; k++) {
    const i = TRONCO[k] * 3;
    const vx = o[i] - px, vy = o[i + 1] - py, vz = o[i + 2] - pz;
    const f = vx * fx + vz * fz;
    const nf = f * ca + vy * sa, ny = -f * sa + vy * ca;
    o[i] = px + vx + (nf - f) * fx; o[i + 1] = py + ny; o[i + 2] = pz + vz + (nf - f) * fz;
  }
}

/** Gira o corpo inteiro em volta do eixo vertical da pelve (o giro no ar). */
function girarTudo(o, ang) {
  const px = o[J.pelve * 3], pz = o[J.pelve * 3 + 2], ca = Math.cos(ang), sa = Math.sin(ang);
  for (let i = 0; i < o.length; i += 3) {
    const vx = o[i] - px, vz = o[i + 2] - pz;
    o[i] = px + vx * ca - vz * sa; o[i + 2] = pz + vx * sa + vz * ca;
  }
}

const _alvo = { x: 0, y: 0, z: 0 };
/** Alvo do gesto g (lado −1 esquerda / +1 direita) em _alvo, no referencial do rumo h; dy = ajuste em y (o punho). */
function alvoGesto(o, h, lado, g, dy) {
  const iO = lado < 0 ? J.ombroE : J.ombroD;
  const fx = Math.cos(h), fz = Math.sin(h), rx = -fz, rz = fx;
  _alvo.x = o[iO * 3] + fx * g[0] + rx * lado * g[1];
  _alvo.y = o[iO * 3 + 1] + g[2] + dy;
  _alvo.z = o[iO * 3 + 2] + fz * g[0] + rz * lado * g[1];
  return _alvo;
}

/**
 * Mão do lado `lado` no ponto (tx, ty, tz), com peso w desde a mão da pose (0 = a pose da locomoção), e o cotovelo pelo
 * polo g (referencial do rumo h). IK do braço (anim.js): os ossos ficam com o comprimento certo.
 */
export function maoEm(o, h, lado, tx, ty, tz, w, g) {
  if (w <= 0) return;
  const iO = lado < 0 ? J.ombroE : J.ombroD, iC = lado < 0 ? J.cotoveloE : J.cotoveloD, iM = lado < 0 ? J.maoE : J.maoD;
  const fx = Math.cos(h), fz = Math.sin(h), rx = -fz, rz = fx;
  const mx = o[iM * 3] + (tx - o[iM * 3]) * w, my = o[iM * 3 + 1] + (ty - o[iM * 3 + 1]) * w, mz = o[iM * 3 + 2] + (tz - o[iM * 3 + 2]) * w;
  ikBraco(o[iO * 3], o[iO * 3 + 1], o[iO * 3 + 2], mx, my, mz,
    fx * g[3] + rx * lado * g[4], g[5], fz * g[3] + rz * lado * g[4], o, iC, iM);
}

/** Gesto g com peso w; ou a mistura de dois gestos (ga → gb por m) com peso w. */
export function gesto(o, h, lado, ga, gb, m, w, dya = 0, dyb = 0) {
  if (w <= 0) return;
  let a = alvoGesto(o, h, lado, ga, dya);
  let x = a.x, y = a.y, z = a.z, g = ga;
  if (gb && m > 0) {
    a = alvoGesto(o, h, lado, gb, dyb);
    x = lerp(x, a.x, m); y = lerp(y, a.y, m); z = lerp(z, a.z, m);
    if (m > 0.5) g = gb;
  }
  maoEm(o, h, lado, x, y, z, w, g);
}

/** Cabeça baixa (lamento: w > 0) ou para trás (olhando o céu: w < 0). */
function cabeca(o, h, w) {
  if (w === 0) return;
  const fx = Math.cos(h), fz = Math.sin(h), i = J.cabeca * 3, n = J.pescoco * 3;
  const f = w > 0 ? 0.06 * w : 0.05 * w, up = w > 0 ? 0.13 - 0.02 * w : 0.13 + 0.005 * w;
  o[i] = o[n] + fx * f; o[i + 1] = o[n + 1] + up; o[i + 2] = o[n + 2] + fz * f;
}

const _polo = { x: 0, y: 0, z: 0 };
/** IK da perna com o joelho nunca abaixo de `minY` (o polo sobe até o joelho sair do chão). */
function pernaIK(o, iQ, iJ, iT, tx, ty, tz, px, py, pz, minY) {
  let qy = py;
  for (let k = 0; k < 4; k++) {
    ik(o[iQ * 3], o[iQ * 3 + 1], o[iQ * 3 + 2], tx, ty, tz, px, qy, pz, o, iJ, iT);
    if (o[iJ * 3 + 1] >= minY) return;
    qy += 0.8;
  }
}

/** Ponta do pé a 0,17 m do tornozelo, na direção (dx, dy, dz) (normalizada aqui), nunca abaixo de 2,5 cm. */
function ponta(o, iT, iP, dx, dy, dz) {
  const l = Math.hypot(dx, dy, dz) || 1;
  o[iP * 3] = o[iT * 3] + (dx / l) * 0.17;
  o[iP * 3 + 1] = Math.max(0.025, o[iT * 3 + 1] + (dy / l) * 0.17);
  o[iP * 3 + 2] = o[iT * 3 + 2] + (dz / l) * 0.17;
}

/** De joelhos (peso w): pelve desce, tronco para trás, joelhos no chão e canelas deitadas para trás. */
function poseJoelhos(o, a, w) {
  const j = a.j, h = j.rumo, fx = Math.cos(h), fz = Math.sin(h), rx = -fz, rz = fx;
  const D = C.deslize, kf = 0.06;
  const pyK = D.joelho + Math.sqrt(L1 * L1 - kf * kf) + 0.03;
  // a pelve no centro do corpo (sem o balanço da passada) e na altura de joelhos
  const ex = (j.x - o[J.pelve * 3]) * w, ez = (j.z - o[J.pelve * 3 + 2]) * w;
  moverJuntas(o, SUP, ex, (pyK - o[J.pelve * 3 + 1]) * w, ez);
  inclinarTronco(o, fx, fz, -D.tronco * w);
  const sh = Math.sqrt(L2 * L2 - (TORN - D.joelho) * (TORN - D.joelho));
  for (let p = 0; p < 2; p++) {
    const lado = p === 0 ? -1 : 1;
    const iQ = p ? J.quadrilD : J.quadrilE, iJ = p ? J.joelhoD : J.joelhoE, iT = p ? J.tornozeloD : J.tornozeloE, iP = p ? J.pontaD : J.pontaE;
    const hx = o[iQ * 3], hy = o[iQ * 3 + 1], hz = o[iQ * 3 + 2];
    // joelho ajoelhado: kf à frente e 4 cm para fora do quadril, no chão; tornozelo atrás dele, rente ao chão
    const kx = hx + fx * kf + rx * lado * 0.04, kz = hz + fz * kf + rz * lado * 0.04;
    const ax = kx - fx * sh, az = kz - fz * sh;
    // tornozelo do começo do golpe (preso ao corpo) → o ajoelhado
    const bx = j.x + fx * a.tf[p] + rx * a.tr[p], bz = j.z + fz * a.tf[p] + rz * a.tr[p], by = a.ty[p];
    const tx = lerp(bx, ax, w), ty = lerp(by, TORN, w), tz = lerp(bz, az, w);
    // polo: para a frente no começo; no fim, do meio quadril–tornozelo até o joelho ajoelhado (exato)
    const mx = (hx + ax) / 2, my = (hy + TORN) / 2, mz = (hz + az) / 2;
    _polo.x = lerp(fx, kx - mx, w); _polo.y = lerp(0.05, D.joelho - my, w); _polo.z = lerp(fz, kz - mz, w);
    pernaIK(o, iQ, iJ, iT, tx, ty, tz, _polo.x, _polo.y, _polo.z, D.joelho - 0.01);
    // ponta: do pé do começo do golpe até deitada para trás
    const qx = j.x + fx * a.tf[p + 2] + rx * a.tr[p + 2] - bx, qy = a.ty[p + 2] - by, qz = j.z + fz * a.tf[p + 2] + rz * a.tr[p + 2] - bz;
    ponta(o, iT, iP, lerp(qx, -fx, w), lerp(qy, -0.3, w), lerp(qz, -fz, w));
  }
}

/** Agachado (peso w): pelve desce, tronco para a frente, joelhos para a frente; os pés ficam onde estão. */
function poseAgachado(o, j, w) {
  if (w <= 0) return;
  const h = j.rumo, fx = Math.cos(h), fz = Math.sin(h), rx = -fz, rz = fx;
  moverJuntas(o, SUP, 0, -C.agacha.desce * w, 0);
  inclinarTronco(o, fx, fz, C.agacha.tronco * w);
  for (let p = 0; p < 2; p++) {
    const lado = p === 0 ? -1 : 1;
    const iQ = p ? J.quadrilD : J.quadrilE, iJ = p ? J.joelhoD : J.joelhoE, iT = p ? J.tornozeloD : J.tornozeloE, iP = p ? J.pontaD : J.pontaE;
    const tx = o[iT * 3], ty = o[iT * 3 + 1], tz = o[iT * 3 + 2];
    const dx = o[iP * 3] - tx, dy = o[iP * 3 + 1] - ty, dz = o[iP * 3 + 2] - tz;
    pernaIK(o, iQ, iJ, iT, tx, ty, tz, fx + rx * lado * 0.25, 0.05, fz + rz * lado * 0.25, 0.1);
    ponta(o, iT, iP, dx, dy, dz);
  }
}

/** Pernas com o quadril abaixado dy (dy < 0) e os pés onde estão (agacha antes do pulo, aterrissa). */
function flexionar(o, j, dy) {
  if (dy >= 0) return;
  const fx = Math.cos(j.rumo), fz = Math.sin(j.rumo);
  moverJuntas(o, SUP, 0, dy, 0);
  for (let p = 0; p < 2; p++) {
    const iQ = p ? J.quadrilD : J.quadrilE, iJ = p ? J.joelhoD : J.joelhoE, iT = p ? J.tornozeloD : J.tornozeloE, iP = p ? J.pontaD : J.pontaE;
    const tx = o[iT * 3], ty = o[iT * 3 + 1], tz = o[iT * 3 + 2];
    const dx = o[iP * 3] - tx, dyp = o[iP * 3 + 1] - ty, dz = o[iP * 3 + 2] - tz;
    pernaIK(o, iQ, iJ, iT, tx, ty, tz, fx, 0.05, fz, 0.1);
    ponta(o, iT, iP, dx, dyp, dz);
  }
}

/** Tempo de voo do pulo (s) e a duração do pulo inteiro: agacha, estende, voo e aterrissa. */
function tempoVoo() { return 2 * Math.sqrt(2 * GRAV * C.pulo.altura) / GRAV; }
function duracaoPulo() { return C.pulo.agacha + C.pulo.estende + tempoVoo() + C.pulo.aterrissa; }
/** Altura do corpo no voo do pulo do autor no tempo t (0 fora do voo). */
function alturaGolpe(c, t) {
  if (c.kPulo < 0) return 0;
  const P = C.pulo, u = t - c.kPulo * PASSO - P.agacha - P.estende, T = tempoVoo();
  if (u <= 0 || u >= T) return 0;
  const v0 = Math.sqrt(2 * GRAV * P.altura);
  return Math.max(0, v0 * u - 0.5 * GRAV * u * u);
}

/** Pulo (e giro): agacha, estende, voa (as pernas encolhem; no giro, uma volta inteira), aterrissa. Braços à parte. */
function posePulo(c, a, t, giro) {
  const o = a.atu, j = a.j, P = C.pulo;
  const tf = t - c.kPulo * PASSO, T = tempoVoo();
  if (tf < 0) return;
  if (tf < P.agacha) { flexionar(o, j, -P.desce * Math.sin((Math.PI / 2) * tf / P.agacha)); return; }
  if (tf < P.agacha + P.estende) { flexionar(o, j, -P.desce * (1 - suave((tf - P.agacha) / P.estende))); return; }
  const u = tf - P.agacha - P.estende;
  if (u < T) {
    // voo: as pernas encolhem (tornozelos sobem em direção ao quadril), o corpo inteiro sobe
    const enc = P.encolhe * Math.sin(Math.PI * u / T), fx = Math.cos(j.rumo), fz = Math.sin(j.rumo);
    for (let p = 0; p < 2; p++) {
      const iQ = p ? J.quadrilD : J.quadrilE, iJ = p ? J.joelhoD : J.joelhoE, iT = p ? J.tornozeloD : J.tornozeloE, iP = p ? J.pontaD : J.pontaE;
      const tx = o[iT * 3], ty = o[iT * 3 + 1] + enc, tz = o[iT * 3 + 2];
      const dx = o[iP * 3] - o[iT * 3], dy = o[iP * 3 + 1] - o[iT * 3 + 1], dz = o[iP * 3 + 2] - o[iT * 3 + 2];
      pernaIK(o, iQ, iJ, iT, tx, ty, tz, fx, 0.3, fz, -10);
      ponta(o, iT, iP, dx, dy - 0.05, dz);
    }
    moverTudo(o, alturaGolpe(c, t));
    if (giro) girarTudo(o, 2 * Math.PI * suave(u / T));
    a.noAr = true;
    return;
  }
  const ul = u - T;
  if (ul < P.aterrissa) flexionar(o, j, -0.12 * Math.sin(Math.PI * ul / P.aterrissa));
}

/** Pose do ator no tick (t = tempo da cena): a da locomoção (anim.js) + golpes + gestos. Escreve a.atu. */
function poseAtor(c, a, t) {
  const o = a.atu, j = a.j, h = j.rumo;
  pose(j, c.mF, o);
  a.noAr = false;
  switch (a.papel) {
    case AUTOR: poseAutor(c, a, t); break;
    case COLEGA: poseColega(c, a, t); break;
    case RESTO: {
      // o resto do time que marcou: um punho no ar
      const w = suave((t - 1.0) / 0.5);
      gesto(o, h, a.id % 2 ? 1 : -1, G_SOCO, null, 0, w);
      break;
    }
    case SOFREU: {
      const w = suave((t - C.sofreu.gesto) / C.sofreu.gestoEntra);
      const g = a.gesto ? G_CABECA : G_CINTURA;
      gesto(o, h, -1, g, null, 0, w); gesto(o, h, 1, g, null, 0, w);
      cabeca(o, h, w);
      break;
    }
    case GOLEIRO_SOFREU:
    case CONTRA: {
      if (a.goleiro && j.mergulho && mergulhoAtivo(j, c.mF.tick)) break; // a defesa desenhada termina primeiro
      const w = suave(a.agacha);
      poseAgachado(o, j, w);
      gesto(o, h, -1, G_CABECA, null, 0, w); gesto(o, h, 1, G_CABECA, null, 0, w);
      cabeca(o, h, w);
      break;
    }
    default: break;
  }
}

/** Pulo do grupo no abraço (m): todos juntos, a ~1,8 Hz, só com o autor em pé. */
function puloGrupo(c, t) {
  if (c.kFimFinal < 0 || c.curta || c.variante === 'joelhos') return 0;
  const t0 = c.kFimFinal * PASSO;
  if (t < t0 || c.k >= c.kFimAbraco) return 0;
  const s = Math.sin(2 * Math.PI * C.festa.freq * (t - t0));
  return s > 0 ? C.festa.altura * s * suave((t - t0) / 0.3) : 0;
}

function poseAutor(c, a, t) {
  const o = a.atu, j = a.j, h = j.rumo;
  const tFinal = c.kFinal >= 0 ? c.kFinal * PASSO : Infinity;
  const corre = suave((t - C.reage) / 0.3);
  // gesto da corrida (até a finalização)
  let gE = G_AVIAO, gD = G_AVIAO, dyD = 0;
  if (c.corrida === 'punho') { gE = null; gD = G_PUNHO; dyD = 0.14 * Math.sin(2 * Math.PI * 2.2 * t); }
  else if (c.corrida === 'peito') { gE = G_CEU; gD = G_PEITO; }
  // gesto da finalização (e do abraço)
  const v = c.variante;
  let fE, fD;
  if (v === 'joelhos' || v === 'bracos') { fE = G_V; fD = G_V; }
  else if (v === 'ceu') { fE = G_CEU; fD = G_CEU; }
  else if (v === 'pulo') { fE = G_FORA; fD = G_SOCO; }
  else { fE = G_AVIAO; fD = G_AVIAO; } // giro: braços abertos no ar; em V depois de aterrissar
  if (v === 'giro' && c.kPulo >= 0 && t - c.kPulo * PASSO > C.pulo.agacha + C.pulo.estende + tempoVoo()) {
    const m = suave((t - c.kPulo * PASSO - C.pulo.agacha - C.pulo.estende - tempoVoo()) / 0.3);
    fE = m > 0.5 ? G_V : G_AVIAO; fD = fE;
  }
  const mf = suave((t - tFinal) / 0.3);
  // golpes de corpo inteiro (antes dos braços: os ombros mudam de lugar)
  if (v === 'joelhos' && c.kFinal >= 0 && (a.desliza || a.ajoelhado)) {
    const wj = suave((t - tFinal) / C.deslize.entra);
    poseJoelhos(o, a, wj);
    // os pés deslizam junto com o corpo (de propósito) até ele parar ajoelhado
    a.noAr = a.desliza || wj < 1;
    bracosAutor(o, h, gE, gD, fE, fD, corre, mf, dyD);
    return;
  }
  if (v === 'bracos' && c.kFinal >= 0) inclinarTronco(o, Math.cos(h), Math.sin(h), -0.12 * mf); // peito para fora
  // braços primeiro (no referencial do corpo); o voo do pulo levanta tudo e o giro gira tudo
  bracosAutor(o, h, gE, gD, fE, fD, corre, mf, dyD);
  if (v === 'ceu') cabeca(o, h, -mf);
  if ((v === 'pulo' || v === 'giro') && c.kPulo >= 0 && t - c.kPulo * PASSO < duracaoPulo()) { posePulo(c, a, t, v === 'giro'); return; }
  // pulo do grupo no abraço
  const dy = puloGrupo(c, t);
  if (dy > 0) { moverTudo(o, dy); a.noAr = true; }
}

/** Braços do autor: o gesto da corrida (peso `corre`) e o da finalização por cima (mistura mf). */
function bracosAutor(o, h, gE, gD, fE, fD, corre, mf, dyD) {
  // esquerdo
  if (gE) gesto(o, h, -1, gE, fE, mf, Math.max(corre, mf));
  else gesto(o, h, -1, fE, null, 0, mf);
  // direito
  gesto(o, h, 1, gD, fD, mf, Math.max(corre, mf), dyD * (1 - mf), 0);
}

function poseColega(c, a, t) {
  const o = a.atu, j = a.j, h = j.rumo, au = c.autor, oa = au.atu;
  const d = Math.hypot(j.x - au.j.x, j.z - au.j.z);
  const w = suave((C.colegas.abraco - d) / 0.5);
  if (w > 0) {
    // abraço: uma mão no ombro do autor (a mais perto), a outra com o punho no ar
    const lado = a.slot % 2 ? 1 : -1;
    const fx = Math.cos(h), fz = Math.sin(h);
    // o ombro do autor do lado de quem abraça
    const iOA = (oa[J.ombroE * 3] - j.x) ** 2 + (oa[J.ombroE * 3 + 2] - j.z) ** 2 < (oa[J.ombroD * 3] - j.x) ** 2 + (oa[J.ombroD * 3 + 2] - j.z) ** 2 ? J.ombroE : J.ombroD;
    const tx = oa[iOA * 3] - fx * 0.04, ty = oa[iOA * 3 + 1] + 0.05, tz = oa[iOA * 3 + 2] - fz * 0.04;
    maoEm(o, h, lado, tx, ty, tz, w, G_FORA);
    gesto(o, h, -lado, G_SOCO, null, 0, w);
  } else if (t > a.t0) {
    // correndo para o autor: punho no ar
    gesto(o, h, a.slot % 2 ? -1 : 1, G_SOCO, null, 0, suave((t - a.t0) / 0.4) * 0.8);
  }
  const dy = d < C.colegas.abraco ? puloGrupo(c, t) : 0;
  if (dy > 0) { moverTudo(o, dy); a.noAr = true; }
}

// ------------------------------------------------------------------------------------------------ câmera
const _p = { x: 0, z: 0 }, _q = { x: 0, z: 0 };
/** Sinal (±1) da perpendicular (−uz, ux) que aponta para o lado da câmera de TV (z +). */
function ladoTV(ux, uz) { return ux > 0 || (ux === 0 && -uz > 0) ? 1 : -1; }

/**
 * Lado do contraplano (±1 na perpendicular ao rumo da torcida), escolhido UMA vez no começo do abraço: o lado com menos
 * gente perto da lente nos próximos ~0,8 s (posição + velocidade × 0,8; quem ainda corre para o abraço não passa na
 * frente da câmera). Empate: o lado da TV.
 */
function escolherLadoContra(c) {
  const T = C.camera.contraplano, ux = c.alvo.ux, uz = c.alvo.uz, au = c.autor.j;
  const tv = ladoTV(ux, uz);
  let melhor = tv, menor = Infinity;
  for (const lado of [tv, -tv]) {
    const cx = au.x - ux * T.atras - uz * lado * T.lado, cz = au.z - uz * T.atras + ux * lado * T.lado;
    let custo = 0;
    for (const a of c.atores) {
      if (a === c.autor) continue;
      const x = a.j.x + a.j.vx * 0.8, z = a.j.z + a.j.vz * 0.8;
      const d = Math.hypot(x - cx, z - cz);
      if (d < 4.5) custo += 4.5 - d;
    }
    if (custo < menor - 1e-9) { menor = custo; melhor = lado; }
  }
  return melhor;
}
/** Direção (unitária, em _dirR) da câmera da reação a partir de quem reage: de frente para ele, puxada para o lado da TV. */
const _dirR = { x: 1, z: 0 };
function direcaoReacao(rumo, giro) {
  let vx = Math.cos(rumo), vz = Math.sin(rumo) + C.camera.reacao.ladoTV;
  const vl = Math.hypot(vx, vz) || 1;
  const a = Math.atan2(vz / vl, vx / vl) + giro;
  _dirR.x = Math.cos(a); _dirR.z = Math.sin(a);
  return _dirR;
}
const GIROS_REACAO = [0, 0.5, -0.5, 1.0, -1.0];
const _cr = { de: [0, 0, 0] };
/**
 * Giro da câmera da reação (rad em volta de quem reage), escolhido UMA vez no começo da reação: o primeiro de GIROS_REACAO
 * (0 = o plano de sempre, que só muda se tiver gente de verdade na frente) com menos gente na frente da lente (a < 2,2 m,
 * dentro do ângulo do quadro) ou entre a lente e quem reage no próximo segundo (posição + velocidade × t). Contraprova: um
 * jogador do time que sofreu, andando para a saída, passava colado na lente (um corpo a 2 m enche a altura do quadro) em
 * ~15% das cenas curtas.
 */
function escolherGiroReacao(c) {
  const r = c.reacao ?? c.autor, R = C.camera.reacao, rj = r.j;
  let melhor = 0, menor = Infinity;
  for (const giro of GIROS_REACAO) {
    const d = direcaoReacao(rj.rumo, giro), dx = d.x, dz = d.z;
    let custo = 0;
    // custo = integral no tempo (m·s): amostras a cada 0,1 s
    for (let t = 0, T = c.curta ? C.curta.reacao : C.reacao; t <= T + 1e-9; t += 0.1) {
      const sx = rj.x + rj.vx * t, sz = rj.z + rj.vz * t;
      _cr.de[0] = sx + dx * R.dist; _cr.de[1] = R.altura; _cr.de[2] = sz + dz * R.dist;
      limitarCamera(_cr);
      const cx = _cr.de[0], cz = _cr.de[2], ex = sx - cx, ez = sz - cz, el2 = ex * ex + ez * ez || 1, el = Math.sqrt(el2);
      for (const a of c.atores) {
        if (a === r) continue;
        const px = a.j.x + a.j.vx * t, pz = a.j.z + a.j.vz * t;
        // na frente da lente (distância ao longo do olhar) e de lado (perpendicular a ele)
        const u = ((px - cx) * ex + (pz - cz) * ez) / el2, frente = u * el, lado = Math.hypot(px - cx - ex * u, pz - cz - ez * u);
        // colado na lente, dentro do ângulo do quadro (meia largura ~0,6 da distância + o corpo)
        const dc = Math.hypot(px - cx, pz - cz);
        if (frente > 0 && dc < 2.2 && lado < frente * 0.6 + 0.4) custo += (2.2 - dc) * 0.1;
        // entre a lente e quem reage (perto da linha de visão)
        if (u > 0.05 && u < 0.95 && lado < 0.8) custo += (0.8 - lado) * 0.1;
      }
    }
    // o plano de sempre (giro 0) só muda com gente de verdade na frente (um corpo cruzando a linha de visão por ~0,2 s já
    // custa ~0,1 m·s; um colado na lente o plano inteiro, 1–3)
    if (giro === 0 && custo <= 0.03) return 0;
    if (custo < menor - 1e-9) { menor = custo; melhor = giro; }
  }
  return melhor;
}
function posAutor(c, tk, out) {
  const k = clamp(tk, 0, Math.min(c.k, NHIST - 1));
  const k0 = Math.floor(k), k1 = Math.min(k0 + 1, Math.min(c.k, NHIST - 1)), f = k - k0;
  out.x = lerp(c.hx[k0], c.hx[k1], f); out.z = lerp(c.hz[k0], c.hz[k1], f);
  return out;
}
/** Média da posição do autor nos `n` ticks até tk. */
function mediaAutor(c, tk, n, out) {
  let sx = 0, sz = 0;
  const N = Math.max(1, Math.round(n));
  for (let i = 0; i < N; i++) { posAutor(c, tk - i, _q); sx += _q.x; sz += _q.z; }
  out.x = sx / N; out.z = sz / N;
  return out;
}

export function limitarCamera(out) {
  const L = C.camera.limite;
  out.de[0] = clamp(out.de[0], -MX - L, MX + L);
  out.de[2] = clamp(out.de[2], -MZ - L, MZ + L);
  // nunca dentro do gol (a rede na frente da lente)
  if (Math.abs(out.de[0]) > MX - 0.5 && Math.abs(out.de[2]) < 4.6) out.de[2] = (out.de[2] >= 0 ? 1 : -1) * 4.6;
}

/** Celular: fecha o plano e põe o assunto no terço esquerdo (o "Pular" fica à direita). */
export function ajustarCelular(out, opc) {
  if (!opc.pequena) return;
  out.fov *= C.camera.celular;
  const fx = out.para[0] - out.de[0], fz = out.para[2] - out.de[2], d = Math.hypot(fx, fz) || 1;
  const a = Math.max(1, opc.aspecto ?? 16 / 9);
  const k = d * Math.tan((out.fov * Math.PI) / 360) * a * C.camera.terco;
  out.para[0] += (-fz / d) * k; out.para[2] += (fx / d) * k;
}

/**
 * Plano de câmera do estado desenhado: out = {nome ('rede' | 'steadicam' | 'contraplano' | 'reacao' | 'fim'), de:[x,y,z],
 * para:[x,y,z], fov (vertical, graus, para 16:9)}. 'rede': a página usa a câmera do gol do jogo. opc = {pequena,
 * aspecto}. Pura: só lê a cena (posições guardadas por tick e as poses).
 */
export function planoCamera(c, opc, out) {
  const tk = Math.max(0, c.k - 1 + c.alfa);
  const fase = c.acabou ? 'fim' : faseEm(c, tk);
  out.fase = fase;
  if (fase === 'rede' || fase === 'fim') { out.nome = fase; return out; }
  const K = C.camera;
  if (fase === 'corrida' || fase === 'final' || (c.curta && fase !== 'reacao')) {
    const S = K.steadicam;
    out.nome = 'steadicam';
    // média do autor nos últimos `media` s (tira o tremor) MAIS a velocidade média × meia janela (a média sozinha atrasa
    // ~1,2 m a 8 m/s): andando reto, é a posição de agora; o rumo é o da velocidade média em `rumo` s
    const nM = S.media / PASSO;
    const P = mediaAutor(c, tk, nM, _p), px0 = P.x, pz0 = P.z;
    const Q = mediaAutor(c, tk - nM, nM, _q);
    const vx = (px0 - Q.x) / S.media, vz = (pz0 - Q.z) / S.media;
    const px = px0 + vx * S.media / 2, pz = pz0 + vz * S.media / 2;
    const R = mediaAutor(c, tk - S.rumo / PASSO, nM, _q);
    let hx = px0 - R.x, hz = pz0 - R.z;
    const hl = Math.hypot(hx, hz), w = clamp(hl / 1.0, 0, 1);
    hx = hl > 1e-6 ? hx / hl : 0; hz = hl > 1e-6 ? hz / hl : 0;
    let dx = w * hx + (1 - w) * c.alvo.ux, dz = w * hz + (1 - w) * c.alvo.uz;
    const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
    // de lado: do lado da câmera de TV (z +)
    let lx = -dz, lz = dx;
    if (lz < 0 || (lz === 0 && lx < 0)) { lx = -lx; lz = -lz; }
    out.de[0] = px + dx * S.frente + lx * S.lado; out.de[1] = S.altura; out.de[2] = pz + dz * S.frente + lz * S.lado;
    out.para[0] = px + dx * 0.3; out.para[1] = c.olhoY; out.para[2] = pz + dz * 0.3;
    out.fov = S.fov;
    limitarCamera(out);
    ajustarCelular(out, opc);
    return out;
  }
  if (fase === 'abraco') {
    const T = K.contraplano;
    out.nome = 'contraplano';
    const P = mediaAutor(c, tk, 18, _p);
    const ux = c.alvo.ux, uz = c.alvo.uz;
    // o lado escolhido no começo do abraço (passoCena: o que tem menos gente perto da lente)
    const lado = c.ladoContra ?? ladoTV(ux, uz);
    const lx = -uz * lado, lz = ux * lado;
    out.de[0] = P.x - ux * T.atras + lx * T.lado; out.de[1] = T.altura; out.de[2] = P.z - uz * T.atras + lz * T.lado;
    out.para[0] = P.x + ux * T.alem; out.para[1] = T.olharY; out.para[2] = P.z + uz * T.alem;
    out.fov = T.fov;
    limitarCamera(out);
    ajustarCelular(out, opc);
    return out;
  }
  // reação de quem sofreu: plano médio, de frente para ele e puxado para o lado da TV (z +), girado em volta dele pelo giro
  // escolhido no começo da reação (passoCena: ninguém colado na lente nem entre ela e quem reage)
  const R = K.reacao, r = c.reacao ?? c.autor;
  out.nome = 'reacao';
  const x = lerp(r.x0, r.x1, c.alfa), z = lerp(r.z0, r.z1, c.alfa);
  const dr = direcaoReacao(r.r1, c.giroReacao), vx = dr.x, vz = dr.z;
  out.de[0] = x + vx * R.dist; out.de[1] = R.altura; out.de[2] = z + vz * R.dist;
  out.para[0] = x; out.para[1] = R.olharY; out.para[2] = z;
  out.fov = R.fov;
  limitarCamera(out);
  ajustarCelular(out, opc);
  return out;
}

/** Objeto de saída do planoCamera (um por página/teste, reaproveitado). */
export function criarPlanoCamera() { return { nome: 'rede', fase: 'rede', de: [0, 0, 0], para: [0, 0, 0], fov: 34 }; }

/** Informação para testes e API: por ator {id, time, papel, x, z, rumo, noAr, desliza, ajoelhado, agacha}. */
export function infoAtores(c) {
  return c.atores.map(a => ({
    id: a.id, time: a.time, papel: PAPEIS[a.papel], x: a.j.x, z: a.j.z, rumo: a.j.rumo, v: Math.hypot(a.j.vx, a.j.vz),
    noAr: a.noAr, desliza: a.desliza, ajoelhado: a.ajoelhado, agacha: a.agacha, goleiro: a.goleiro,
  }));
}
