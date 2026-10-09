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
//   semDominioAte  tick até o qual não domina (acabou de ter a bola roubada)
//   puxada  {tick0, rumo} | null — puxada de sola em andamento (ult.tipo === 'sola')

import { CONDUCAO, PASSO, BOTAO, SUBPASSOS_BOLA, ENTRADA } from './config.js';
import { clamp, difAng, lerp, tabela } from './mat.js';
import { passoCorpo, infoPassada, faseLocal, copiaCinematica, velocidadeDesejada } from './jogador.js';
import { velParaDistancia, velParaParar, chutarRasteiro, copiarBola, passoBola, proxVelRolando, DT_BOLA, distAteParar } from './bola.js';
import { normal } from './rng.js';
import { MD } from './matdet.js';

const DT = PASSO;
const PROT_INTERVALO = Math.round(0.3 / PASSO); // ticks — toque de proteção mais espaçado
const MAG_DIR = ENTRADA.magDirecao; // pedido de direção (sim.js zera o analógico abaixo disso)
const BUSCA_PEDIDO_MAX = 1.75;       // rad (~100°) — indo buscar a bola, pedido até aqui curva o corpo
const TAB_OFS = [[0, CONDUCAO.ofsFrente.curta], [3, CONDUCAO.ofsFrente.trote], [5.5, CONDUCAO.ofsFrente.corrida], [7.6, CONDUCAO.ofsFrente.arrancada]];

export function criarCond() {
  return { toque: null, ult: null, ref: null, busca: false, longeDesde: -1, pedalada: null, nToques: 0, cortePendente: null, corteRumo: null, semDominioAte: -1, puxada: null };
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

/** Giro máximo (rad/s) do protetor em volta da bola, pela agilidade. */
function giroProtecao(j) {
  return CONDUCAO.giroProtecao * (0.8 + 0.4 * j.par.attr.agilidade / 100);
}

/**
 * Protegendo e andando: direção (unitária ou menor) e velocidade com que o grupo corpo+bola
 * anda pelo analógico — sem a parte na direção do marcador (ux, uz = unitário bola→marcador).
 */
function andarProtegendo(ix, iz, imag, vel, ux, uz) {
  if (!(imag > MAG_DIR)) return { wx: 0, wz: 0, v: 0 };
  let wx = ix, wz = iz;
  const pm = wx * ux + wz * uz;
  if (pm > 0) { wx -= pm * ux; wz -= pm * uz; }
  return { wx, wz, v: Math.min(vel, CONDUCAO.vProtecao) };
}

/**
 * Movimento pedido sem considerar a bola (o que o analógico manda). Usado pela simulação e
 * pela previsão. ctx: {marcador:{x,z}} quando protegendo.
 */
export function movimentoBase(j, ix, iz, imag, botoes, comBola, rumoAtual, ctx) {
  const correr = (botoes & BOTAO.CORRER) !== 0;
  const mod = (botoes & BOTAO.MOD) !== 0;
  let vel = velocidadeDesejada(j.par, imag, correr, mod, comBola);
  let rumoAlvo = imag > MAG_DIR ? MD.atan2(iz, ix) : rumoAtual;
  if (ctx && ctx.marcador) {
    if (ctx.bola) {
      // PROTEÇÃO: o corpo gira em volta da bola para ficar entre ela e o marcador, de
      // costas para ele. Andando (analógico), o grupo corpo+bola anda junto devagar: o corpo
      // ganha a velocidade do analógico por cima do giro (a sola leva a bola no toque de
      // proteção) — sem a parte que iria na direção do marcador (não atravessa o marcador)
      // e sem sair da linha bola–marcador.
      let ux = ctx.marcador.x - ctx.bola.x, uz = ctx.marcador.z - ctx.bola.z;
      const ul = MD.hypot(ux, uz) || 1;
      ux /= ul; uz /= ul;
      const { wx, wz, v: vAnda } = andarProtegendo(ix, iz, imag, vel, ux, uz);
      // gira EM VOLTA da bola (pelo círculo), nunca por cima dela
      const aCorpo = MD.atan2(ctx.corpoZ - ctx.bola.z, ctx.corpoX - ctx.bola.x);
      const aAlvo = MD.atan2(uz, ux);
      const a = aCorpo + clamp(difAng(aCorpo, aAlvo), -0.9, 0.9);
      const r = CONDUCAO.protecaoOfs;
      const px = ctx.bola.x + MD.cos(a) * r;
      const pz = ctx.bola.z + MD.sin(a) * r;
      const dx = px - ctx.corpoX, dz = pz - ctx.corpoZ;
      const d = MD.hypot(dx, dz);
      // o giro protegendo tem limite (a sola segura a bola): um marcador que contorna mais
      // rápido que isso acaba chegando à bola
      const vg = Math.min(giroProtecao(j) * r, d * 8);
      const vx = (d > 1e-6 ? dx / d : 0) * vg + wx * vAnda, vz = (d > 1e-6 ? dz / d : 0) * vg + wz * vAnda;
      const v = Math.min(MD.hypot(vx, vz), CONDUCAO.vProtecao * 2.4);
      return { dx: v > 1e-6 ? vx / v : ix, dz: v > 1e-6 ? vz / v : iz, vel: v, rumoAlvo: MD.atan2(-uz, -ux) };
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
 * Não muda j. rec (opcional) = bola prevista {xs, zs}: aplica a mesma regra de
 * movimentoRecepcao de frente (freia e vira para a bola), para o domínio marcado com esta
 * previsão acontecer de verdade.
 */
export function preverCorpo(m, j, n, comBola, prot, rec) {
  const k = copiaCinematica(j);
  const xs = new Float64Array(n + 1), zs = new Float64Array(n + 1), rs = new Float64Array(n + 1);
  const ss = new Float64Array(n + 1), fs = new Float64Array(n + 1);
  xs[0] = k.x; zs[0] = k.z; rs[0] = k.rumo; ss[0] = MD.hypot(k.vx, k.vz); fs[0] = k.fase;
  const mov = j.imag > MAG_DIR;
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
    if (i <= reto && s0 > 1) {
      const rc = rumosCorte(j.cond.corteRumo ?? rv0, MD.atan2(iz, ix), mv.rumoAlvo);
      mv.dx = MD.cos(rc.dir); mv.dz = MD.sin(rc.dir); mv.vel = Math.min(mv.vel, s0); mv.rumoAlvo = rc.tronco;
    }
    if (rec) { mv.vel = Math.min(mv.vel, VEL_RECEPCAO); mv.rumoAlvo = MD.atan2(rec.zs[i] - k.z, rec.xs[i] - k.x); }
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
 * balanço, o outro no chão, e a bola no alcance. Devolve {i, pe} ou null. recFrente: prevê o
 * corpo com a regra da recepção de frente (preverCorpo rec).
 */
export function procurarOportunidade(m, j, lead, max, comBola, prot, relaxado, recFrente) {
  const pb = preverBola(m.bola, max);
  const pc = preverCorpo(m, j, max, comBola, prot, recFrente ? pb : null);
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
    mod: temBotao(j, BOTAO.MOD), prot: !!prot, mov: j.imag > MAG_DIR,
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
    // protegendo, a sola mexe na bola pelo menos a cada PROT_INTERVALO (o marcador gira em
    // volta e a bola tem que continuar do lado de lá), mesmo com o corpo quase parado
    if (prot) iN = Math.max(minI, Math.min(iN, PROT_INTERVALO));
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
    // andando protegendo: o grupo anda pelo analógico no passo de proteção até o próximo
    // toque (a partir de onde o corpo está AGORA: sem realimentar a corrida atrás da bola)
    const w = andarProtegendo(j.ix, j.iz, j.imag, velPedida(j, true), -ux, -uz);
    const bx0 = w.v > 0 ? j.x + w.wx * w.v * iN * DT : xN, bz0 = w.v > 0 ? j.z + w.wz * w.v * iN * DT : zN;
    // a sola também não gira a bola em volta do corpo mais rápido que o giro de proteção
    const aAgora = MD.atan2(b.p.z - j.z, b.p.x - j.x);
    const aQuer = MD.atan2(uz, ux);
    const aBola = aAgora + clamp(difAng(aAgora, aQuer), -giroProtecao(j) * iN * DT, giroProtecao(j) * iN * DT);
    tx = bx0 + MD.cos(aBola) * CONDUCAO.protecaoOfs;
    tz = bz0 + MD.sin(aBola) * CONDUCAO.protecaoOfs;
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
 * Quanto a bola, rolando reta até o alvo, fica de lado em relação ao corpo previsto (pelo rumo
 * dele) até o próximo toque: numa curva fechada a bola segue reta e o corpo faz o arco.
 */
function desvioDoArco(b, plano, pc) {
  const { iN, dist } = plano;
  if (dist < 0.05) return 0;
  const ux = plano.dx / dist, uz = plano.dz / dist;
  let s = velParaDistancia(dist, iN), d = 0, dm = 0;
  for (let i = 1; i < iN; i++) {
    for (let k = 0; k < SUBPASSOS_BOLA; k++) { s = proxVelRolando(s, DT_BOLA); d += s * DT_BOLA; }
    const ex = b.p.x + ux * d - pc.xs[i], ez = b.p.z + uz * d - pc.zs[i];
    const la = Math.abs(-ex * MD.sin(pc.rs[i]) + ez * MD.cos(pc.rs[i]));
    if (la > dm) dm = la;
  }
  return dm;
}

/**
 * Executa o toque agora (tick atual, antes de integrar a bola). Planeja o próximo.
 * tipo: 'conducao' | 'dominio' | 'ajuste' | 'protecao' (a puxada de sola é executarPuxada)
 */
export function executarToque(m, j, pe, tipo) {
  const c = j.cond;
  const b = m.bola;
  c.cortePendente = null;
  const prot = emProtecao(m, j);
  const curta = temBotao(j, BOTAO.MOD);
  const H = Math.round(CONDUCAO.horizonte / DT);
  const pc = preverCorpo(m, j, H, true, prot);
  const sAgora0 = MD.hypot(j.vx, j.vz);
  // um toque por passada; se o corpo for passar a bola no meio do caminho (freada forte),
  // toca a cada passo — como quem freia com a bola
  const dom = tipo === 'dominio';
  let plano = planejarAlvo(m, j, pe, prot || curta ? 1 : 2, pc, prot, curta, 0, dom);
  // também toca a cada passo se a bola fosse abrir demais (saindo do parado): assim ela
  // está sempre ao alcance de um corte pedido no meio do caminho; e numa curva fechada, se a
  // bola rolando reta se afastaria demais do arco do corpo até o próximo toque
  // (curva = o analógico girando de forma contínua; um gesto brusco não conta)
  const curvando = Math.abs(j.intW) > 0.3;
  if (!prot && !curta && (!semUltrapassar(b, plano, pc) || plano.folgaMax > CONDUCAO.folgaMax || (curvando && desvioDoArco(b, plano, pc) > CONDUCAO.arcoMax))) {
    plano = planejarAlvo(m, j, pe, 1, pc, prot, curta, 0, dom);
  }
  if (!semUltrapassar(b, plano, pc)) {
    // nem a cada passo: marca o próximo toque antes do ponto em que o corpo alcançaria a bola.
    // Se isso cair antes do intervalo mínimo FREANDO (soltou o analógico ou pediu bem menos
    // velocidade), marca no intervalo mínimo e mira à frente de onde o corpo vai estar: a bola
    // sai mais rápida que o corpo freando (em vez de rolar devagar até o fim da previsão e ser
    // atropelada). Virando, não: a bola mais forte fugiria do corpo que está fazendo a curva.
    const iv = plano.violacao, minI = Math.ceil(CONDUCAO.intervaloMin / DT);
    if (iv > minI) plano = planejarAlvo(m, j, pe, 1, pc, prot, curta, iv, dom);
    else if (velPedida(j, true) < sAgora0 - 1.0) plano = planejarAlvo(m, j, pe, 1, pc, prot, curta, minI, dom);
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
  // protegendo parado, a bola é rolada de leve com a sola e para no ponto (não foge do corpo);
  // andando, chega ao ponto no próximo toque, no passo de proteção (sem disparar)
  let vBase;
  if (!prot) vBase = velParaDistancia(dist, iN);
  else if (j.imag > MAG_DIR) vBase = Math.min(velParaDistancia(dist, iN), CONDUCAO.vProtecao * 1.6);
  else vBase = velParaParar(dist);
  let v0 = vBase * Math.max(0.5, 1 + ev);
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
// Segurando o rumo à espera do toque do corte, o corpo já começa a ir para o lado pedido (a
// velocidade até CORTE_DESVIO do rumo em que estava; o tronco até CORTE_TRONCO): responde ao
// comando sem tirar a bola do alcance do pé.
const CORTE_DESVIO = 0.2;  // rad (~11°)
const CORTE_TRONCO = 0.6;  // rad (~34°)

/** Direção (rad) e rumo do tronco segurando o corte a partir do rumo da corrida rc. */
function rumosCorte(rc, aPed, rumoAlvo) {
  return {
    dir: rc + clamp(difAng(rc, aPed), -CORTE_DESVIO, CORTE_DESVIO),
    tronco: rc + clamp(difAng(rc, rumoAlvo), -CORTE_TRONCO, CORTE_TRONCO),
  };
}

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
  const mov = j.imag > MAG_DIR;
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
  // puxada de sola em andamento: a bola volta rolando por baixo/ao lado do corpo; o próximo
  // toque só é procurado depois (o corpo ainda está de frente para o lado antigo)
  if (c.puxada && m.tick - c.puxada.tick0 < PUXADA_TRONCO) return;
  if (c.puxada && m.tick - c.puxada.tick0 >= PUXADA_TRONCO + 20) c.puxada = null;
  if (!c.puxada && !prot && puxadaPedida(j) && noAlcance(j.x, j.z, j.rumo, b.p.x, b.p.z, b.p.y)) {
    // PUXADA DE SOLA: modificador + analógico para trás. A sola do pé do lado da bola puxa a
    // bola para onde o analógico manda, com o outro pé no chão (senão espera o apoio)
    const pe = ladoDaBola(j.x, j.z, j.rumo, b.p.x, b.p.z);
    if (j.pes[1 - pe].apoio) { executarPuxada(m, j, pe); return; }
    if (j.pes[pe].apoio) { executarPuxada(m, j, 1 - pe); return; }
  }
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
    if (s > 2.5 && d > 0.6 && d < 1.92) { c.cortePendente = m.tick; c.corteRumo = MD.atan2(j.vz, j.vx); }
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

// ------------------------------------------------------------ puxada de sola
const PUXADA_ANG = 2.1;      // rad (~120°) — analógico para trás em relação ao tronco
const PUXADA_TRONCO = 12;    // ticks (0,2 s) — o tronco segura o rumo enquanto a bola volta
const PUXADA_VMAX = 3.0;     // m/s — acima disso não dá para parar puxando a bola com a sola

/** Modificador segurado, devagar (condução curta) e o analógico pedindo para trás? */
function puxadaPedida(j) {
  if (!temBotao(j, BOTAO.MOD) || !(j.imag > 0.3) || (j.cond && j.cond.pedalada)) return false;
  if (j.vx * j.vx + j.vz * j.vz > PUXADA_VMAX * PUXADA_VMAX) return false;
  return Math.abs(difAng(j.rumo, MD.atan2(j.iz, j.ix))) > PUXADA_ANG;
}

/**
 * Puxada de sola: o pé passa por cima da bola e a puxa para onde o analógico manda (para trás
 * ou para trás e de lado) a CONDUCAO.puxadaVel, com o tronco ainda de frente para o lado antigo;
 * depois o corpo vira e vai com a bola (o próximo toque é planejado normalmente).
 */
export function executarPuxada(m, j, pe) {
  const c = j.cond;
  const b = m.bola;
  const ea = normal(m.rng) * lerp(CONDUCAO.erroAngRuim, CONDUCAO.erroAngBase, j.par.attr.drible / 100);
  const a = MD.atan2(j.iz, j.ix) + ea;
  const dx = MD.cos(a), dz = MD.sin(a), v = CONDUCAO.puxadaVel;
  chutarRasteiro(b, dx * v, dz * v);
  c.ult = { tick: m.tick, pe, bx: b.p.x, bz: b.p.z, dx, dz, v, tipo: 'sola' };
  c.toque = null; c.ref = null; c.busca = false; c.longeDesde = -1; c.cortePendente = null;
  c.puxada = { tick0: m.tick, rumo: j.rumo };
  c.nToques++;
  m.posse = j.id;
  m.eventos.push({ tipo: 'toque', id: j.id, pe, modo: 'sola', v });
  if (m.log) m.log.push({ t: m.tick, id: j.id, pe, tipo: 'sola', bx: b.p.x, bz: b.p.z, dx, dz, v, ir: j.intRumo, s: MD.hypot(j.vx, j.vz), apoio: j.pes[1 - pe].apoio, rumo: j.rumo });
}

/** Movimento do corpo do jogador com a posse neste tick. */
export function movimentoComBola(m, j) {
  const c = j.cond;
  const prot = emProtecao(m, j);
  const ctx = prot ? { marcador: prot, corpoX: j.x, corpoZ: j.z, bola: m.bola.p, pedalada: !!c.pedalada } : { pedalada: !!c.pedalada };
  const base = movimentoBase(j, j.ix, j.iz, j.imag, j.botoes, true, j.rumo, ctx);
  // puxada de sola: o corpo freia de frente para o lado antigo enquanto a bola volta (e
  // também enquanto espera o pé de apoio pisar para puxar)
  if (c.puxada && m.tick - c.puxada.tick0 < PUXADA_TRONCO) return { dx: base.dx, dz: base.dz, vel: 0, rumoAlvo: c.puxada.rumo };
  if (!c.puxada && !prot && puxadaPedida(j) && noAlcance(j.x, j.z, j.rumo, m.bola.p.x, m.bola.p.z, m.bola.p.y)) {
    return { dx: base.dx, dz: base.dz, vel: 0, rumoAlvo: j.rumo };
  }
  if (ticksCorteRestantes(c, m.tick) > 0 && !c.busca) {
    const s = MD.hypot(j.vx, j.vz);
    if (s > 1) {
      const rc = rumosCorte(c.corteRumo ?? MD.atan2(j.vz, j.vx), MD.atan2(j.iz, j.ix), base.rumoAlvo);
      return { dx: MD.cos(rc.dir), dz: MD.sin(rc.dir), vel: Math.min(base.vel, s), rumoAlvo: rc.tronco };
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
  if (j.imag > MAG_DIR) {
    const aPedido = MD.atan2(j.iz, j.ix);
    // o pedido perto do corredor (até ~100° da bola) vale até a borda do corredor (±angBusca): o
    // corpo já começa a ir para o lado pedido enquanto alcança a bola
    let alfa = difAng(aPedido, aBola);
    if (Math.abs(alfa) <= BUSCA_PEDIDO_MAX) {
      if (Math.abs(alfa) > CONDUCAO.angBusca) alfa = Math.sign(alfa) * CONDUCAO.angBusca;
      const aPed = aBola - alfa;
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

// ------------------------------------------------------------ recepção (domínio)
// Dois jeitos de receber:
//  - DE FRENTE (parado, ou a bola vem contra o sentido da corrida): freia e vira para a bola;
//  - EM CORRIDA (a bola vem por trás ou de lado, mais ou menos no sentido da corrida, ou está
//    quase parada à frente): não freia nem vira para a bola — corrige o caminho só o necessário
//    para a bola chegar ao pé e domina em velocidade, com o primeiro toque para a frente (na
//    direção do analógico: executarToque 'dominio').
// O domínio é marcado com a MESMA previsão do movimento que o corpo vai fazer depois.

const VEL_RECEPCAO = 1.0;          // m/s — teto de quem recebe de frente
const REC_VMIN_CORRIDA = 2.0;      // m/s — abaixo disso recebe "parado" (de frente)
const REC_COS_CORRIDA = MD.cos(1.92); // bola até ~110° do sentido da corrida = em corrida
const REC_LADO = 0.35;             // m — bola ao lado do corpo no toque, depois do desvio
const REC_ALCANCE = 0.72;          // m — distância bola–corpo no toque (no máximo)
const REC_ACEL_LAT = 6;            // m/s² — aceleração lateral para o desvio (previsão)
const REC_DESVIO = 0.42;           // ~seno de 25°: desvio máximo do caminho para ir na bola

/** 'corrida' ou 'frente' (ver acima). */
export function modoRecepcao(j, b) {
  const s = MD.hypot(j.vx, j.vz);
  if (s < REC_VMIN_CORRIDA) return 'frente';
  const sb = MD.hypot(b.v.x, b.v.z);
  if (sb < 1.0) return 'corrida';
  return (b.v.x * j.vx + b.v.z * j.vz) / (sb * s) >= REC_COS_CORRIDA ? 'corrida' : 'frente';
}

/**
 * Recepção em corrida: primeiro tick em que a bola fica ao alcance do corpo que segue o
 * analógico, depois de um pequeno desvio do caminho para a bola passar ao lado do pé (nem
 * longe demais, nem batendo nas pernas). O desvio respeita a aceleração lateral do corpo.
 * Devolve também o ponto (qx, qz) onde o corpo tem que estar nesse tick.
 */
function oportunidadeCorrida(m, j, max) {
  const pb = preverBola(m.bola, max);
  const pc = preverCorpo(m, j, max, false, null);
  for (let i = 1; i <= max; i++) {
    if (pb.ys[i] > 0.45) continue;
    const hx = MD.cos(pc.rs[i]), hz = MD.sin(pc.rs[i]);
    const dx = pb.xs[i] - pc.xs[i], dz = pb.zs[i] - pc.zs[i];
    const fr = dx * hx + dz * hz, la = -dx * hz + dz * hx;
    if (fr < -0.25 || fr > 0.55) continue;
    // bola ao lado do pé: entre 0,2 e REC_LADO para o lado dela
    const lado = la >= 0 ? 1 : -1;
    const laAlvo = lado * clamp(Math.abs(la), 0.2, REC_LADO);
    const t = i * DT;
    const sh = Math.min(pc.ss[i] * REC_DESVIO * t, 0.5 * REC_ACEL_LAT * t * t);
    const corr = clamp(la - laAlvo, -sh, sh);
    const la2 = la - corr;
    if (Math.abs(la2) > 0.55 || fr * fr + la2 * la2 > REC_ALCANCE * REC_ALCANCE) continue;
    return { i, pe: lado > 0 ? 1 : 0, bx: pb.xs[i], bz: pb.zs[i], qx: pc.xs[i] - hz * corr, qz: pc.zs[i] + hx * corr };
  }
  return null;
}

/**
 * Jogador sem a posse e bola livre: procura o primeiro toque (domínio). Devolve true se
 * marcou um domínio. primeira (opcional, Etapa 2): com uma ação pedida, bate de primeira.
 */
export function tentarDominio(m, j, primeira) {
  const c = j.cond;
  const b = m.bola;
  // acabou de ter a bola roubada: não recupera no tick seguinte
  if (c.semDominioAte != null && m.tick < c.semDominioAte) return false;
  if (c.toque && c.toque.tipo === 'dominio') {
    if (m.tick >= c.toque.tick) {
      if (noAlcance(j.x, j.z, j.rumo, b.p.x, b.p.z, b.p.y, true)) {
        // de primeira: com uma ação pedida, bate sem dominar
        if (primeira && primeira(m, j, c.toque.pe)) { c.toque = null; return true; }
        executarToque(m, j, c.toque.pe, 'dominio');
        return true;
      }
      c.toque = null;
    } else {
      // em corrida o plano é refeito de tempos em tempos (fora da janela da animação do pé)
      if (c.toque.modo === 'corrida' && c.toque.tick - m.tick > 10 && (m.tick - c.toque.desde) % 4 === 0) {
        const op = oportunidadeCorrida(m, j, 45);
        if (op) Object.assign(c.toque, { tick: m.tick + op.i, pe: op.pe, bx: op.bx, bz: op.bz, qx: op.qx, qz: op.qz });
      }
      return true;
    }
  }
  const d = MD.hypot(b.p.x - j.x, b.p.z - j.z);
  const vb = MD.hypot(b.v.x, b.v.z);
  const s = MD.hypot(j.vx, j.vz);
  if (d > 1.0 + (vb + s) * 0.8) return false;
  const modo = modoRecepcao(j, b);
  const op = modo === 'corrida' ? oportunidadeCorrida(m, j, 45) : procurarOportunidade(m, j, 1, 36, false, null, true, true);
  if (!op) return false;
  c.toque = { tick: m.tick + op.i, pe: op.pe, bx: op.bx, bz: op.bz, tipo: 'dominio', modo, desde: m.tick, qx: op.qx, qz: op.qz };
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
 * Movimento de quem vai receber (domínio marcado). De frente: fica de frente para a bola e
 * quase parado; o analógico decide para onde vai o primeiro toque, não para onde o corpo foge.
 * Em corrida: segue correndo e só corrige o caminho até o ponto marcado (qx, qz).
 */
export function movimentoRecepcao(m, j, base) {
  const c = j.cond;
  if (!c.toque || c.toque.tipo !== 'dominio') return base;
  const b = m.bola;
  if (c.toque.modo === 'corrida') {
    // passos de movimento até o tick do toque: este e mais n (o corpo anda antes do toque)
    const n = c.toque.tick - m.tick + 1;
    const dx = c.toque.qx - j.x, dz = c.toque.qz - j.z;
    const d = MD.hypot(dx, dz);
    if (n <= 0 || d < 0.05) return base;
    return { dx: dx / d, dz: dz / d, vel: Math.min(d / (n * DT), j.par.vTeto), rumoAlvo: base.rumoAlvo };
  }
  const rumo = MD.atan2(b.p.z - j.z, b.p.x - j.x);
  return { dx: base.dx, dz: base.dz, vel: Math.min(base.vel, VEL_RECEPCAO), rumoAlvo: rumo };
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
