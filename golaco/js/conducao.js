// Condução de bola SEM ímã: entre os toques a bola é física pura (bola.js). Em cada toque o
// impulso é calculado para a bola chegar, rolando, ao ponto onde o pé vai estar no PRÓXIMO
// toque — prevendo o caminho do próprio corpo com a mesma função de locomoção (jogador.js).
// O toque é sincronizado com a passada: o pé que toca está no balanço e o outro no chão.
//
// Estado em j.cond:
//   toque   próximo toque marcado {tick, pe, bx, bz, tipo}  (bx,bz = onde a bola vai estar)
//   ult     último toque {tick, pe, bx, bz, dx, dz, v, tipo}
//   ref     referência para replanejar {tick, intRumo, intW, vel, mod, prot}
//   busca   true quando a bola saiu do alcance e o corpo vai buscá-la
//   longeDesde  tick em que a bola ficou longe (perda)
//   pedalada {tick0, lado} | null

import { CONDUCAO, PASSO, BOTAO, SUBPASSOS_BOLA } from './config.js';
import { clamp, difAng, lerp, tabela } from './mat.js';
import { passoCorpo, infoPassada, faseLocal, copiaCinematica, velocidadeDesejada } from './jogador.js';
import { velParaDistancia, velParaParar, chutarRasteiro, copiarBola, passoBola, proxVelRolando, DT_BOLA, distAteParar } from './bola.js';
import { normal } from './rng.js';
import { MD } from './matdet.js';

const DT = PASSO;
const TAB_OFS = [[0, CONDUCAO.ofsFrente.curta], [3, CONDUCAO.ofsFrente.trote], [5.5, CONDUCAO.ofsFrente.corrida], [7.6, CONDUCAO.ofsFrente.arrancada]];

export function criarCond() {
  return { toque: null, ult: null, ref: null, busca: false, longeDesde: -1, pedalada: null, nToques: 0, cortePendente: null };
}

/** Distância de toque à frente do corpo pela velocidade. */
export function ofsFrente(s, curta) {
  return curta ? CONDUCAO.ofsFrente.curta : tabela(TAB_OFS, s, 1);
}

function temBotao(j, b) { return (j.botoes & b) !== 0; }

/** Adversário mais perto (para proteção e pressão). */
export function adversarioMaisPerto(m, j) {
  let melhor = null, dm = Infinity;
  for (const o of m.jogadores) {
    if (o.time === j.time) continue;
    const d = MD.hypot(o.x - j.x, o.z - j.z);
    if (d < dm) { dm = d; melhor = o; }
  }
  return melhor ? { o: melhor, d: dm } : null;
}

/** Em proteção? (modificador segurado e marcador perto) */
export function emProtecao(m, j) {
  if (!temBotao(j, BOTAO.MOD)) return null;
  const a = adversarioMaisPerto(m, j);
  if (!a || a.d > CONDUCAO.protecaoDist) return null;
  return a.o;
}

/**
 * Movimento pedido sem considerar a bola (o que o analógico manda). Usado pela simulação e
 * pela previsão. ctx: {marcador:{x,z}} quando protegendo.
 */
export function movimentoBase(j, ix, iz, imag, botoes, comBola, rumoAtual, ctx) {
  const correr = (botoes & BOTAO.CORRER) !== 0;
  const mod = (botoes & BOTAO.MOD) !== 0;
  let vel = velocidadeDesejada(j.par, imag, correr, mod, comBola);
  let rumoAlvo = imag > 0.1 ? MD.atan2(iz, ix) : rumoAtual;
  if (ctx && ctx.marcador) {
    if (ctx.bola) {
      // PROTEÇÃO: o corpo gira em volta da bola para ficar entre ela e o marcador, de
      // costas para ele (a bola quase não sai do lugar; o analógico a leva devagar)
      let ux = ctx.marcador.x - ctx.bola.x, uz = ctx.marcador.z - ctx.bola.z;
      const ul = MD.hypot(ux, uz) || 1;
      ux /= ul; uz /= ul;
      const k = imag > 0.1 ? 0.35 * imag : 0;
      // gira EM VOLTA da bola (pelo círculo), nunca por cima dela
      const aCorpo = MD.atan2(ctx.corpoZ - ctx.bola.z, ctx.corpoX - ctx.bola.x);
      const aAlvo = MD.atan2(uz, ux);
      const a = aCorpo + clamp(difAng(aCorpo, aAlvo), -0.9, 0.9);
      const r = CONDUCAO.protecaoOfs;
      const px = ctx.bola.x + MD.cos(a) * r + ix * k;
      const pz = ctx.bola.z + MD.sin(a) * r + iz * k;
      const dx = px - ctx.corpoX, dz = pz - ctx.corpoZ;
      const d = MD.hypot(dx, dz);
      const v = Math.min(CONDUCAO.vProtecao * 2.4, d * 8);
      return { dx: d > 1e-6 ? dx / d : ix, dz: d > 1e-6 ? dz / d : iz, vel: v, rumoAlvo: MD.atan2(-uz, -ux) };
    }
    vel = Math.min(vel, CONDUCAO.vProtecao);
    rumoAlvo = MD.atan2(ctx.corpoZ - ctx.marcador.z, ctx.corpoX - ctx.marcador.x);
  }
  if (ctx && ctx.pedalada) vel = Math.min(vel, 1.0);
  return { dx: ix, dz: iz, vel, rumoAlvo };
}

/**
 * Posição prevista do marcador daqui a t segundos, girando em volta do ponto (cx, cz) (o
 * protetor) com a velocidade angular atual — sem extrapolar a aproximação em linha reta,
 * que "atravessaria" o protetor e inverteria o lado da bola.
 */
export function marcadorPrevisto(o, cx, cz, t) {
  const rx = o.x - cx, rz = o.z - cz;
  const r2 = rx * rx + rz * rz;
  if (r2 < 1e-6) return { x: o.x, z: o.z };
  const w = (rx * o.vz - rz * o.vx) / r2;
  const a = MD.atan2(rz, rx) + clamp(w * t, -1.2, 1.2);
  const r = Math.sqrt(r2);
  return { x: cx + MD.cos(a) * r, z: cz + MD.sin(a) * r };
}

/** Rumo pedido extrapolado t segundos à frente (o giro do analógico continua, amortecido). */
export function rumoExtrapolado(intRumo, intW, t) {
  const th = CONDUCAO.meiaVidaGiroPedido;
  let ang = intW * th * (1 - MD.exp(-t / th));
  ang = clamp(ang, -0.9, 0.9);
  return intRumo + ang;
}

/**
 * Previsão do corpo n ticks à frente com o analógico extrapolado. Devolve arrays planos.
 * Não muda j.
 */
export function preverCorpo(m, j, n, comBola, prot) {
  const k = copiaCinematica(j);
  const xs = new Float64Array(n + 1), zs = new Float64Array(n + 1), rs = new Float64Array(n + 1);
  const ss = new Float64Array(n + 1), fs = new Float64Array(n + 1);
  xs[0] = k.x; zs[0] = k.z; rs[0] = k.rumo; ss[0] = MD.hypot(k.vx, k.vz); fs[0] = k.fase;
  const mov = j.imag > 0.08;
  const ped = !!(j.cond && j.cond.pedalada);
  const ctx = { marcador: null, corpoX: 0, corpoZ: 0, pedalada: ped };
  // corte pendente: o corpo segura o rumo até o toque (só nos primeiros ticks)
  const reto = j.cond ? ticksCorteRestantes(j.cond, m.tick) : 0;
  const pbProt = prot ? preverBola(m.bola, n) : null;
  const s0 = MD.hypot(k.vx, k.vz);
  const rv0 = MD.atan2(k.vz, k.vx);
  for (let i = 1; i <= n; i++) {
    const t = i * DT;
    let ix = j.ix, iz = j.iz;
    if (mov) {
      const r = rumoExtrapolado(j.intRumo, j.intW, t);
      ix = MD.cos(r); iz = MD.sin(r);
    }
    if (prot) {
      const tp = Math.min(t, 0.5);
      ctx.marcador = marcadorPrevisto(prot, j.x, j.z, tp);
      ctx.corpoX = k.x; ctx.corpoZ = k.z;
      ctx.bola = { x: pbProt.xs[i - 1], z: pbProt.zs[i - 1] };
    } else ctx.marcador = null;
    const mv = movimentoBase(j, ix, iz, j.imag, j.botoes, comBola, k.rumo, ctx);
    if (i <= reto && s0 > 1) { mv.dx = MD.cos(rv0); mv.dz = MD.sin(rv0); mv.vel = Math.min(mv.vel, s0); }
    passoCorpo(k, mv.dx, mv.dz, mv.vel, mv.rumoAlvo, j.par, DT, comBola);
    const s = MD.hypot(k.vx, k.vz);
    const ativa = s > 0.22 || Math.abs(k.giro) > 1.6;
    if (ativa) k.fase += infoPassada(s, comBola).f * DT;
    xs[i] = k.x; zs[i] = k.z; rs[i] = k.rumo; ss[i] = s; fs[i] = k.fase;
  }
  return { n, xs, zs, rs, ss, fs };
}

/** Bola prevista n ticks à frente (física pura). */
export function preverBola(b, n) {
  const c = copiarBola(b);
  const xs = new Float64Array(n + 1), zs = new Float64Array(n + 1), ys = new Float64Array(n + 1);
  xs[0] = c.p.x; zs[0] = c.p.z; ys[0] = c.p.y;
  for (let i = 1; i <= n; i++) {
    passoBola(c, null);
    xs[i] = c.p.x; zs[i] = c.p.z; ys[i] = c.p.y;
  }
  return { xs, zs, ys };
}

/** Situação dos pés pela fase (para previsão): devolve [apoio0, apoio1]. */
function apoioPrevisto(fase, s, comBola) {
  const { carga } = infoPassada(s, comBola);
  const st = 2 * carga;
  return [faseLocal(fase, 0) < st, faseLocal(fase, 1) < st];
}

/** A bola (bx,bz) está no alcance de um pé do corpo (x,z,rumo)? */
export function noAlcance(x, z, rumo, bx, bz, by, relaxado) {
  if (by > 0.45) return false;
  const hx = MD.cos(rumo), hz = MD.sin(rumo);
  const dx = bx - x, dz = bz - z;
  const fr = dx * hx + dz * hz;
  const la = -dx * hz + dz * hx;
  const d = MD.hypot(dx, dz);
  // no domínio vale a parte de dentro/fora do pé, de lado
  if (relaxado) return d <= CONDUCAO.alcance && fr >= -0.3 && Math.abs(la) <= 0.68;
  return d <= CONDUCAO.alcance && fr >= CONDUCAO.alcanceFrente && Math.abs(la) <= 0.55;
}

/**
 * Procura o primeiro tick (a partir de `lead`) em que um pé pode tocar a bola: o pé está no
 * balanço, o outro no chão, e a bola no alcance. Devolve {i, pe} ou null.
 */
export function procurarOportunidade(m, j, lead, max, comBola, prot, relaxado) {
  const pc = preverCorpo(m, j, max, comBola, prot);
  const pb = preverBola(m.bola, max);
  for (let i = Math.max(1, lead); i <= max; i++) {
    if (!noAlcance(pc.xs[i], pc.zs[i], pc.rs[i], pb.xs[i], pb.zs[i], pb.ys[i], relaxado)) continue;
    const ap = apoioPrevisto(pc.fs[i], pc.ss[i], comBola);
    let pe = -1;
    if (ap[0] && !ap[1]) pe = 1;
    else if (ap[1] && !ap[0]) pe = 0;
    else if (ap[0] && ap[1]) pe = ladoDaBola(pc.xs[i], pc.zs[i], pc.rs[i], pb.xs[i], pb.zs[i]);
    else if (relaxado) pe = ladoDaBola(pc.xs[i], pc.zs[i], pc.rs[i], pb.xs[i], pb.zs[i]);
    if (pe < 0) continue;
    return { i, pe, bx: pb.xs[i], bz: pb.zs[i] };
  }
  return null;
}

function ladoDaBola(x, z, rumo, bx, bz) {
  const la = -(bx - x) * MD.sin(rumo) + (bz - z) * MD.cos(rumo);
  return la >= 0 ? 1 : 0; // direita (+z local) = pé direito
}

/** Velocidade pedida agora (referência para replanejar). */
function velPedida(j, comBola) {
  return velocidadeDesejada(j.par, j.imag, temBotao(j, BOTAO.CORRER), temBotao(j, BOTAO.MOD), comBola);
}

function marcarReferencia(m, j, prot) {
  const c = j.cond;
  c.ref = {
    tick: m.tick, intRumo: j.intRumo, intW: j.intW, vel: velPedida(j, true),
    mod: temBotao(j, BOTAO.MOD), prot: !!prot, mov: j.imag > 0.08,
  };
}

/**
 * Planeja onde a bola deve estar no próximo toque: prevê o corpo até o tick em que o pé do
 * próximo toque estará no balanço (com o outro no chão) e mira à frente dele.
 * forcarI: força o tick do próximo toque (≤ previsão).
 */
function planejarAlvo(m, j, pe, passos, pc, prot, curta, forcarI, dominio) {
  const b = m.bola;
  const H = pc.n;
  const apoio = 1 - pe;
  const nApoio = j.pes[apoio].apoio ? j.pes[apoio].faseApoio : apoio + 2 * Math.floor((j.fase - apoio) / 2);
  const minI = Math.ceil(CONDUCAO.intervaloMin / DT);
  let iN = -1;
  const proxPe = passos === 2 ? pe : apoio;
  if (forcarI) iN = Math.max(minI, Math.min(H, forcarI));
  else {
    for (let i = minI; i <= H; i++) {
      const { carga } = infoPassada(pc.ss[i], true);
      const alvoFase = nApoio + passos + CONDUCAO.faseToque * 2 * carga;
      if (pc.fs[i] >= alvoFase) { iN = i; break; }
    }
    if (iN < 0) iN = H; // corpo parado: a bola para no ponto e espera
  }
  const xN = pc.xs[iN], zN = pc.zs[iN], rN = pc.rs[iN], sN = pc.ss[iN];
  const hx = MD.cos(rN), hz = MD.sin(rN);
  const lado = proxPe === 0 ? -1 : 1;
  let tx, tz;
  if (prot) {
    const mp = marcadorPrevisto(prot, j.x, j.z, Math.min(iN * DT, 0.5));
    let ux = xN - mp.x, uz = zN - mp.z;
    const ul = MD.hypot(ux, uz) || 1;
    ux /= ul; uz /= ul;
    tx = xN + ux * CONDUCAO.protecaoOfs;
    tz = zN + uz * CONDUCAO.protecaoOfs;
  } else {
    const fr = ofsFrente(sN, curta);
    tx = xN + hx * fr + (-hz) * lado * CONDUCAO.ofsLado;
    tz = zN + hz * fr + hx * lado * CONDUCAO.ofsLado;
  }
  let dx = tx - b.p.x, dz = tz - b.p.z;
  let dist = MD.hypot(dx, dz);
  // CORTE (a bola iria longe do rumo pedido, correndo): a bola sai NA DIREÇÃO PEDIDA (±20°)
  // e o próximo toque é marcado no ponto dessa linha mais perto de onde o pé vai estar. Sem
  // isso o embalo do corpo mandaria a bola na diagonal.
  let tolerancia = CONDUCAO.desvioReplanejar;
  if (!prot && (tipoCorte(j, dx, dz) || (dominio && j.imag > 0.3))) {
    const aPed = MD.atan2(j.iz, j.ix);
    let melhor = null;
    for (let k = -8; k <= 8; k++) {
      const a = aPed + k * 0.04363; // passos de 2,5°
      const ux = MD.cos(a), uz = MD.sin(a);
      const sProj = (tx - b.p.x) * ux + (tz - b.p.z) * uz;
      if (sProj < 0.15) continue;
      const e = Math.abs(-(tx - b.p.x) * uz + (tz - b.p.z) * ux);
      const custo = e + 0.15 * Math.abs(k) * 0.04363;
      if (!melhor || custo < melhor.custo) melhor = { custo, ux, uz, sProj };
    }
    if (melhor) {
      dx = melhor.ux * melhor.sProj; dz = melhor.uz * melhor.sProj;
      tx = b.p.x + dx; tz = b.p.z + dz;
      dist = melhor.sProj;
      // o pé vai encontrar a bola a ~e da linha: não replaneja por isso
      tolerancia = Math.max(tolerancia, melhor.custo + 0.12);
    }
  }
  return { iN, proxPe, tx, tz, dx, dz, dist, tolerancia, violacao: -1, folgaMax: 0 };
}

/**
 * A bola, rolando até o alvo, fica sempre à frente do corpo previsto? (o corpo não pode
 * passar por cima da bola entre dois toques). Marca plano.violacao com o 1º tick ruim.
 */
function semUltrapassar(b, plano, pc) {
  const { iN, dist } = plano;
  if (dist < 0.05) return true;
  const ux = plano.dx / dist, uz = plano.dz / dist;
  const v0 = velParaDistancia(dist, iN);
  let s = v0, d = 0;
  plano.folgaMax = 0;
  for (let i = 1; i < iN; i++) {
    for (let k = 0; k < SUBPASSOS_BOLA; k++) { s = proxVelRolando(s, DT_BOLA); d += s * DT_BOLA; }
    const bx = b.p.x + ux * d, bz = b.p.z + uz * d;
    const ex = bx - pc.xs[i], ez = bz - pc.zs[i];
    const fr = ex * MD.cos(pc.rs[i]) + ez * MD.sin(pc.rs[i]);
    if (fr < 0.14 || ex * ex + ez * ez < 0.04) { plano.violacao = i; return false; }
    if (fr > plano.folgaMax) plano.folgaMax = fr;
  }
  return true;
}

/**
 * Executa o toque agora (tick atual, antes de integrar a bola). Planeja o próximo.
 * tipo: 'conducao' | 'dominio' | 'ajuste' | 'protecao'
 */
export function executarToque(m, j, pe, tipo) {
  const c = j.cond;
  const b = m.bola;
  c.cortePendente = null;
  const prot = emProtecao(m, j);
  const curta = temBotao(j, BOTAO.MOD);
  const H = Math.round(CONDUCAO.horizonte / DT);
  const pc = preverCorpo(m, j, H, true, prot);
  // um toque por passada; se o corpo for passar a bola no meio do caminho (freada forte),
  // toca a cada passo — como quem freia com a bola
  const dom = tipo === 'dominio';
  let plano = planejarAlvo(m, j, pe, prot || curta ? 1 : 2, pc, prot, curta, 0, dom);
  // também toca a cada passo se a bola fosse abrir demais (saindo do parado): assim ela
  // está sempre ao alcance de um corte pedido no meio do caminho
  if (!prot && !curta && (!semUltrapassar(b, plano, pc) || plano.folgaMax > CONDUCAO.folgaMax)) {
    plano = planejarAlvo(m, j, pe, 1, pc, prot, curta, 0, dom);
  }
  if (!semUltrapassar(b, plano, pc)) {
    // nem a cada passo: marca o próximo toque antes do ponto em que o corpo alcançaria a bola
    const iv = plano.violacao;
    if (iv > Math.ceil(CONDUCAO.intervaloMin / DT)) plano = planejarAlvo(m, j, pe, 1, pc, prot, curta, iv, dom);
  }
  let { iN, proxPe, tx, tz, dx, dz, dist, tolerancia } = plano;
  const apoio = 1 - pe;
  const hx = MD.cos(pc.rs[iN]), hz = MD.sin(pc.rs[iN]);
  // erro do toque: cresce com a velocidade e cai com o atributo
  const attr = tipo === 'dominio' ? j.par.attr.controle : j.par.attr.drible;
  const sAgora = MD.hypot(j.vx, j.vz);
  let sigAng = lerp(CONDUCAO.erroAngRuim, CONDUCAO.erroAngBase, attr / 100) * (1 + 0.3 * (sAgora / 7) * (sAgora / 7)) * (curta ? 0.7 : 1);
  let sigVel = lerp(CONDUCAO.erroVelRuim, CONDUCAO.erroVelBase, attr / 100);
  if (tipo === 'dominio') {
    const sIn = MD.hypot(b.v.x, b.v.z);
    const q = CONDUCAO;
    const pressao = (() => { const a = adversarioMaisPerto(m, j); return a && a.d < q.dominioPressaoDist ? 1.6 : 1; })();
    const dif = (1 + Math.max(0, sIn - 6) / q.dominioVRef) * pressao;
    sigAng = lerp(q.dominioErroAng.ruim, q.dominioErroAng.bom, attr / 100) * dif;
    sigVel = lerp(q.dominioErroVel.ruim, q.dominioErroVel.bom, attr / 100) * dif;
  }
  const ea = normal(m.rng) * sigAng;
  const ev = normal(m.rng) * sigVel;
  if (dist > 1e-4) { dx /= dist; dz /= dist; } else { dx = hx; dz = hz; dist = 0; }
  const ca = MD.cos(ea), sa = MD.sin(ea);
  const ddx = dx * ca - dz * sa, ddz = dx * sa + dz * ca;
  // protegendo, a bola é rolada de leve com a sola e para no ponto (não foge do corpo)
  let v0 = (prot ? velParaParar(dist) : velParaDistancia(dist, iN)) * Math.max(0.5, 1 + ev);
  v0 = Math.min(v0, 14);
  chutarRasteiro(b, ddx * v0, ddz * v0);
  c.ult = { tick: m.tick, pe, bx: b.p.x, bz: b.p.z, dx: ddx, dz: ddz, v: v0, tipo };
  c.toque = { tick: m.tick + iN, pe: proxPe, bx: tx, bz: tz, tipo: 'conducao', tol: tolerancia };
  c.busca = false;
  c.longeDesde = -1;
  c.nToques++;
  marcarReferencia(m, j, prot);
  m.posse = j.id;
  m.eventos.push({ tipo: 'toque', id: j.id, pe, modo: tipo, v: v0 });
  if (m.log) m.log.push({ t: m.tick, id: j.id, pe, tipo, bx: b.p.x, bz: b.p.z, dx: ddx, dz: ddz, v: v0, ir: j.intRumo, s: sAgora, apoio: j.pes[apoio].apoio });
}

const CORTE_MAX = 15; // ticks (0,25 s) no máximo segurando o rumo à espera do toque

export function ticksCorteRestantes(c, tick) {
  if (c.cortePendente == null) return 0;
  return Math.max(0, CORTE_MAX - (tick - c.cortePendente));
}

/** O pedido é um corte em relação a para onde a bola (ou o corpo) está indo? */
function tipoCorte(j, dx, dz) {
  // a bola iria (dx,dz) longe demais do rumo pedido — a bola tem que seguir o analógico
  if (j.imag < 0.3) return false;
  const s = MD.hypot(j.vx, j.vz);
  if (s < 2.5) return false;
  if (MD.hypot(dx, dz) < 0.05) return false;
  const d = Math.abs(difAng(MD.atan2(dz, dx), MD.atan2(j.iz, j.ix)));
  return d > 0.35 && d < 1.92;
}

/** Precisa antecipar o toque? (o analógico mudou, a velocidade pedida mudou, etc.) */
function precisaReplanejar(m, j, prot) {
  const c = j.cond, r = c.ref;
  if (!r) return true;
  const mov = j.imag > 0.08;
  if (mov !== r.mov) return true;
  if (temBotao(j, BOTAO.MOD) !== r.mod) return true;
  if (!!prot !== r.prot) return true;
  if (Math.abs(velPedida(j, true) - r.vel) > 1.2) return true;
  if (mov) {
    const esp = rumoExtrapolado(r.intRumo, r.intW, (m.tick - r.tick) * DT);
    if (Math.abs(difAng(esp, j.intRumo)) > CONDUCAO.angReplanejar) return true;
  }
  if (c.bolaDesviada) return true;
  // o corpo está alcançando a bola antes da hora
  const hx = MD.cos(j.rumo), hz = MD.sin(j.rumo);
  const fr = (m.bola.p.x - j.x) * hx + (m.bola.p.z - j.z) * hz;
  if (fr < 0.2 && c.toque && c.toque.tick - m.tick > 4) return true;
  // onde o pé vai estar no toque marcado × onde a bola vai estar (física pura)
  const n = c.toque ? c.toque.tick - m.tick : 0;
  if (n > 6 && (m.tick & 1) === 0) {
    const pc = preverCorpo(m, j, n, true, prot);
    const pb = preverBola(m.bola, n);
    const curta = temBotao(j, BOTAO.MOD);
    const ofs = prot ? CONDUCAO.protecaoOfs : ofsFrente(pc.ss[n], curta);
    const cx = pc.xs[n] + MD.cos(pc.rs[n]) * ofs, cz = pc.zs[n] + MD.sin(pc.rs[n]) * ofs;
    const lim = prot ? CONDUCAO.desvioReplanejar * 1.5 : (c.toque.tol ?? CONDUCAO.desvioReplanejar);
    if (MD.hypot(cx - pb.xs[n], cz - pb.zs[n]) > lim + 0.06) return true;
  }
  return false;
}

/**
 * Controle de bola do jogador com a posse, a cada tick (depois do passo do corpo, antes da
 * bola integrar).
 */
export function controlarComBola(m, j) {
  const c = j.cond;
  const b = m.bola;
  const prot = emProtecao(m, j);
  // toque marcado para agora
  if (c.toque && m.tick >= c.toque.tick) {
    const pe = c.toque.pe, apoio = 1 - pe;
    const alc = noAlcance(j.x, j.z, j.rumo, b.p.x, b.p.z, b.p.y);
    if (alc && j.pes[apoio].apoio) { executarToque(m, j, pe, 'conducao'); return; }
    if (alc && j.pes[pe].apoio && !j.pes[apoio].apoio) { executarToque(m, j, apoio, 'conducao'); return; }
    // sem pé de apoio agora (fase de voo) ou fora do alcance: remarca para a próxima
    // oportunidade real (a passada de verdade pode estar uns ticks fora da prevista)
    const op = procurarOportunidade(m, j, 1, 20, true, prot, false);
    if (op) { c.toque = { tick: m.tick + op.i, pe: op.pe, bx: op.bx, bz: op.bz, tipo: 'ajuste' }; return; }
    c.toque = null; // procura de novo abaixo (ou vai buscar a bola)
  }
  if (c.toque && !precisaReplanejar(m, j, prot)) { c.bolaDesviada = false; return; }
  // replanejar: procura a primeira oportunidade de toque
  c.bolaDesviada = false;
  // mudança grande de rumo pedido (corte): o toque tem que sair já (a janela é curta)
  const grande = c.ref && j.imag > 0.3 && Math.abs(difAng(c.ref.intRumo, j.intRumo)) > 0.6;
  if (grande && !prot) {
    // corte correndo: o corpo segura o rumo até o toque (planta, toca e só então vira)
    const s = MD.hypot(j.vx, j.vz);
    const ab = MD.atan2(m.bola.v.z, m.bola.v.x);
    const d = Math.abs(difAng(ab, j.intRumo));
    if (s > 2.5 && d > 0.6 && d < 1.92) c.cortePendente = m.tick;
  }
  const lead = grande ? 2 : Math.round(0.067 / DT);
  const op = procurarOportunidade(m, j, lead, 45, true, prot, false);
  marcarReferencia(m, j, prot);
  if (op) {
    if (!c.toque || m.tick + op.i < c.toque.tick - 1) {
      c.toque = { tick: m.tick + op.i, pe: op.pe, bx: op.bx, bz: op.bz, tipo: 'ajuste' };
    }
    c.busca = false;
  } else if (!c.toque || !toqueMarcadoViavel(m, j, prot)) {
    // nenhum toque possível tão cedo e o marcado não vai alcançar a bola: vai buscá-la
    c.toque = null;
    c.busca = true;
  }
}

/** O toque marcado ainda vai encontrar a bola no alcance (corpo e bola previstos)? */
function toqueMarcadoViavel(m, j, prot) {
  const t = j.cond.toque;
  const n = t.tick - m.tick;
  if (n <= 0) return true;
  if (n > 110) return false;
  const pc = preverCorpo(m, j, n, true, prot);
  const pb = preverBola(m.bola, n);
  return noAlcance(pc.xs[n], pc.zs[n], pc.rs[n], pb.xs[n], pb.zs[n], pb.ys[n]);
}

/** Movimento do corpo do jogador com a posse neste tick. */
export function movimentoComBola(m, j) {
  const c = j.cond;
  const prot = emProtecao(m, j);
  const ctx = prot ? { marcador: prot, corpoX: j.x, corpoZ: j.z, bola: m.bola.p, pedalada: !!c.pedalada } : { pedalada: !!c.pedalada };
  const base = movimentoBase(j, j.ix, j.iz, j.imag, j.botoes, true, j.rumo, ctx);
  if (ticksCorteRestantes(c, m.tick) > 0 && !c.busca) {
    const s = MD.hypot(j.vx, j.vz);
    if (s > 1) {
      const rv = MD.atan2(j.vz, j.vx);
      return { dx: MD.cos(rv), dz: MD.sin(rv), vel: Math.min(base.vel, s), rumoAlvo: base.rumoAlvo };
    }
  }
  // com um toque marcado, o corpo faz o que o analógico pede (o toque já foi planejado para
  // esse corpo); sem toque marcado, não larga a bola que vai embora
  if (!c.busca) return c.toque ? base : acompanharBola(m, j, base);
  // a bola saiu do alcance: vai buscá-la. Se ela ainda está no corredor do rumo pedido
  // (±angBusca), o corpo segue o analógico e só corrige o mínimo para passar com a bola no pé.
  const b = m.bola;
  const s = MD.hypot(j.vx, j.vz);
  let dx = b.p.x - j.x, dz = b.p.z - j.z;
  const d = MD.hypot(dx, dz);
  const tp = clamp(d / Math.max(s + 1.5, 2), 0, 1.2);
  const px = b.p.x + b.v.x * tp, pz = b.p.z + b.v.z * tp;
  dx = px - j.x; dz = pz - j.z;
  const dl = MD.hypot(dx, dz) || 1;
  // velocidade para alcançar: a da bola (no sentido dela) + o que falta fechar em ~0,8 s,
  // sem passar da chegada suave (para não atropelar a bola)
  const vbAl = (b.v.x * dx + b.v.z * dz) / dl;
  const chegar = Math.sqrt(2 * j.par.freio * Math.max(0, dl - 0.45)) + Math.max(0, vbAl);
  const alcancar = Math.max(0, vbAl) + Math.max(1.0, (dl - 0.5) / 0.8);
  const velF = clamp(Math.min(Math.max(base.vel, alcancar), chegar), 0, j.par.vArrancada * 0.95);
  const aBola = MD.atan2(dz, dx);
  if (j.imag > 0.08) {
    const aPed = MD.atan2(j.iz, j.ix);
    const alfa = difAng(aPed, aBola);
    if (Math.abs(alfa) <= CONDUCAO.angBusca) {
      // desvio mínimo: passar com a bola a ≤ 0,3 m de lado
      const lado = dl * MD.sin(Math.abs(alfa));
      let beta = 0;
      if (lado > 0.3) beta = Math.sign(alfa) * (Math.abs(alfa) - MD.asin(Math.min(1, 0.3 / dl)));
      const r = aPed + beta;
      return { dx: MD.cos(r), dz: MD.sin(r), vel: velF, rumoAlvo: r };
    }
  }
  return { dx: dx / dl, dz: dz / dl, vel: velF, rumoAlvo: aBola };
}

/**
 * Freada ou soltou o analógico com a bola indo embora (empurrada na arrancada): o corpo não
 * larga a bola — acompanha até o próximo toque, que então amortece a bola para o ritmo novo.
 */
function acompanharBola(m, j, base) {
  const b = m.bola;
  const sb = MD.hypot(b.v.x, b.v.z);
  if (sb < 0.8) return base;
  const s = MD.hypot(j.vx, j.vz);
  const bdx = b.v.x / sb, bdz = b.v.z / sb;
  const ex = b.p.x - j.x, ez = b.p.z - j.z;
  const fr = ex * bdx + ez * bdz;
  if (fr < 0.25) return base;
  // onde a bola para × onde o corpo para com o pedido atual
  const dBola = distAteParar(sb);
  const pedido = base.vel;
  const dCorpo = pedido < s ? (s * s - pedido * pedido) / (2 * j.par.freio) : 0;
  const folga = fr + dBola - dCorpo - (pedido > 0.2 ? 1e9 : 0);
  if (pedido <= 0.2 && folga > 0.9) {
    // soltou o analógico: vai até a bola e para com ela (chegada suave)
    const vel = Math.min(j.par.vArrancada * 0.9, Math.sqrt(2 * j.par.freio * Math.max(0, fr + dBola - 0.45)));
    return { dx: bdx, dz: bdz, vel, rumoAlvo: MD.atan2(bdz, bdx) };
  }
  // pediu menos velocidade que a da bola: segura o ritmo da bola até o toque
  const vAlong = sb;
  if (pedido > 0.2 && vAlong > pedido + 0.4 && fr > 0.45) {
    return { ...base, vel: Math.min(Math.max(pedido, Math.min(s, vAlong)), j.par.vArrancada) };
  }
  return base;
}

/**
 * Jogador sem a posse e bola livre: procura o primeiro toque (domínio). Devolve true se
 * marcou um domínio.
 */
export function tentarDominio(m, j, primeira) {
  const c = j.cond;
  const b = m.bola;
  if (c.toque && c.toque.tipo === 'dominio') {
    if (m.tick >= c.toque.tick) {
      if (noAlcance(j.x, j.z, j.rumo, b.p.x, b.p.z, b.p.y, true)) {
        // de primeira: com uma ação pedida, bate sem dominar
        if (primeira && primeira(m, j, c.toque.pe)) { c.toque = null; return true; }
        executarToque(m, j, c.toque.pe, 'dominio');
        return true;
      }
      c.toque = null;
    } else return true;
  }
  const d = MD.hypot(b.p.x - j.x, b.p.z - j.z);
  const vb = MD.hypot(b.v.x, b.v.z);
  if (d > 1.0 + vb * 0.8) return false;
  const op = procurarOportunidade(m, j, 1, 36, false, null, true);
  if (!op) return false;
  c.toque = { tick: m.tick + op.i, pe: op.pe, bx: op.bx, bz: op.bz, tipo: 'dominio' };
  if (op.i <= 1) {
    // a bola chega já: domina (ou bate de primeira) neste tick se estiver no alcance
    if (noAlcance(j.x, j.z, j.rumo, b.p.x, b.p.z, b.p.y, true)) {
      if (primeira && primeira(m, j, op.pe)) c.toque = null;
      else executarToque(m, j, op.pe, 'dominio');
    }
  }
  return true;
}

/**
 * Movimento de quem vai receber (domínio marcado): fica de frente para a bola e quase
 * parado; o analógico decide para onde vai o primeiro toque, não para onde o corpo foge.
 */
export function movimentoRecepcao(m, j, base) {
  const c = j.cond;
  if (!c.toque || c.toque.tipo !== 'dominio') return base;
  const b = m.bola;
  const rumo = MD.atan2(b.p.z - j.z, b.p.x - j.x);
  return { dx: base.dx, dz: base.dz, vel: Math.min(base.vel, 1.0), rumoAlvo: rumo };
}

/** Verifica perda de posse (bola longe por tempo demais). */
export function verificarPerda(m, j) {
  const c = j.cond;
  const b = m.bola;
  const d = MD.hypot(b.p.x - j.x, b.p.z - j.z);
  if (d > CONDUCAO.perdaDist) {
    if (c.longeDesde < 0) c.longeDesde = m.tick;
    else if ((m.tick - c.longeDesde) * DT > CONDUCAO.perdaTempo) {
      m.posse = null;
      c.toque = null; c.busca = false; c.longeDesde = -1;
      m.eventos.push({ tipo: 'perda', id: j.id });
      if (m.stats) m.stats.perdas++;
      return true;
    }
  } else c.longeDesde = -1;
  return false;
}
