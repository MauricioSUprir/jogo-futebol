// Recepção assistida (pedido do dono, 10/10: "quando a bola chega no jogador, e eu já mudo o analógico
// pro lado que eu quero, o jogador sai da bola, isso nunca pode acontecer"). Puro: sem three.js nem DOM.
//
// Quem: o jogador do humano que vai receber a bola — o passe é para ele (j.recebe) ou a bola está livre,
// sem passe (rebote, desvio, toque longo, bola espirrada), vai passar perto dele e ele chega nela antes
// dos companheiros.
// O quê: separa a INTENÇÃO do analógico do MOVIMENTO do corpo. O corpo vai ao encontro da bola — o ponto
// da linha dela a que ele chega primeiro (planejarRecepcao) — e o analógico decide a direção do 1º toque
// (domínio orientado: conducao.js executarToque 'dominio', ±20°) e abre o corpo para aquele lado (a
// "meia-volta" dos treinadores); CORRER ou o analógico para a bola apressam o encontro. Nenhum pedido
// do analógico afasta o corpo da linha da bola. Analógico solto = recebe de frente, como antes.
// Como no EA FC ("Pass Receiver Lock": o recebedor fica preso ao passe; "first touch" pelo analógico).
//
// Dois jeitos de encontrar a bola (o mesmo critério de conducao.js modoRecepcao):
//  - de frente (parado, ou a bola vem contra o sentido da corrida): o corpo entra na linha da bola, com a
//    bola chegando RECEPCAO.ofsFrente à frente dele, vindo ao encontro dela (trotando; correndo se pediu);
//  - em corrida (correndo, a bola vem por trás ou de lado no sentido da corrida): o 1º ponto em que ele, seguindo
//    reto no ritmo de agora (só corrigindo de lado e um pouco o ritmo), encontra a bola chegando à frente e ao
//    lado do pé, em até RECEPCAO.tCorrida; senão, recebe como de frente (vai ao encontro da linha da bola).
// A previsão do domínio (conducao.js preverCorpo com `assist`) usa a MESMA função de movimento
// (movimentoAssistido): o toque marcado acontece de verdade.

import { RECEPCAO, PASSO, BOTAO, ENTRADA, CAMPO } from './config.js';
import { MD } from './matdet.js';
import { clamp, difAng } from './mat.js';
import { preverBola } from './conducao.js';
import { velocidadeDesejada } from './jogador.js';

const DT = PASSO;
const R = RECEPCAO;
const H = Math.round(R.horizonte / DT);
const ALCANCE_TOQUE = R.folgaEncontro;

/**
 * Tempo (s) para o jogador chegar a (qx, qz) indo no máximo a vmax, a partir da velocidade de agora:
 * tira a velocidade de lado, freia o que vai no sentido contrário e acelera (aceleração média do perfil
 * a(v) = A0·(1 − v/S0)). Conta barata e um pouco conservadora (o encontro é refeito a cada passo).
 * parar: ele tem de chegar PARANDO lá (recepção de frente: chega freando, de frente para a bola) — embalado
 * na direção do ponto, ou já em cima dele, passa do ponto, para e volta (antes contava como já chegou, e o
 * corpo a 5–6 m/s freava passando do encontro e saía da linha da bola).
 */
export function tempoAlcance(j, qx, qz, vmax, parar = false) {
  const dx = qx - j.x, dz = qz - j.z;
  const dist = MD.hypot(dx, dz);
  const d0 = dist - ALCANCE_TOQUE;
  const par = j.par;
  if (d0 <= 0) {
    if (!parar) return 0;
    const s = MD.hypot(j.vx, j.vz), dp = (s * s) / (2 * par.freio);
    return dp <= ALCANCE_TOQUE ? 0 : s / par.freio + 2 * Math.sqrt(dp / (par.acel0 * 0.7));
  }
  const ex = dx / dist, ez = dz / dist;
  let vpar = j.vx * ex + j.vz * ez;
  const vperp = Math.abs(-j.vx * ez + j.vz * ex);
  if (parar && vpar > 0) {
    const dp = (vpar * vpar) / (2 * par.freio);
    if (dp > d0 + ALCANCE_TOQUE) {
      const volta = dp - d0;
      return (0.6 * vperp) / par.latCorte + vpar / par.freio + 2 * Math.sqrt(volta / (par.acel0 * 0.7));
    }
  }
  let t = (0.6 * vperp) / par.latCorte;
  let d = d0;
  if (vpar < 0) { t += -vpar / par.freioGiro; d += (vpar * vpar) / (2 * par.freioGiro); vpar = 0; }
  const vm = Math.max(vmax, vpar);
  if (vpar >= vm - 1e-6) return t + d / Math.max(vm, 0.1);
  const a = par.acel0 * 0.7;
  const tA = (vm - vpar) / a, dA = ((vpar + vm) / 2) * tA;
  if (d <= dA) return t + (-vpar + Math.sqrt(vpar * vpar + 2 * a * d)) / a;
  return t + tA + (d - dA) / vm;
}

/** Direção (unitária) da bola prevista no tick i (pela diferença dos vizinhos); null se quase parada. */
function dirBola(pb, i, n, out) {
  const i0 = Math.max(0, i - 1), i1 = Math.min(n, i + 1);
  const dx = pb.xs[i1] - pb.xs[i0], dz = pb.zs[i1] - pb.zs[i0];
  const l = MD.hypot(dx, dz);
  const v = l / ((i1 - i0) * DT);
  if (v < 0.8) return null;
  out.x = dx / l; out.z = dz / l; out.v = v;
  return out;
}
const _u = { x: 0, z: 0, v: 0 };

/**
 * Procura o ponto de encontro de j com a bola prevista pb: o 1º tick i (a partir de i0) em que a bola está
 * baixa (pé) e o corpo chega ao ponto de contato até lá, indo no máximo a vmax. modo: 'frente' | 'corrida'.
 * Escreve em `out` {i, qx, qz, bx, bz, ux, uz} e devolve true, ou false.
 */
function acharEncontro(j, pb, n, i0, vmax, modo, out, calmo, esforco) {
  const s = MD.hypot(j.vx, j.vz);
  let melhor = Infinity;
  // a bola vem para ele: sem pressa, o encontro é antes de ela passar por ele (deixar passar ao lado e
  // "receber por trás" sairia barato na conta do deslocamento)
  const vindo = calmo && pb.xs[1] !== undefined && (pb.xs[1] - pb.xs[0]) * (j.x - pb.xs[0]) + (pb.zs[1] - pb.zs[0]) * (j.z - pb.zs[0]) > 0;
  const hx = s > 0.5 ? j.vx / s : MD.cos(j.rumo), hz = s > 0.5 ? j.vz / s : MD.sin(j.rumo);
  for (let i = Math.max(1, i0); i <= n; i++) {
    if (pb.ys[i] > R.alturaPe) continue;
    const bx = pb.xs[i], bz = pb.zs[i];
    const u = dirBola(pb, i, n, _u);
    let qx, qz, ux, uz;
    if (!u) {
      // bola (quase) parada: o corpo chega de frente para ela, pelo lado de onde vem
      let dx = bx - j.x, dz = bz - j.z;
      const l = MD.hypot(dx, dz) || 1;
      dx /= l; dz /= l;
      ux = dx; uz = dz;
      qx = bx - dx * R.ofsFrente; qz = bz - dz * R.ofsFrente;
    } else if (modo === 'corrida') {
      // a bola chega à frente e ao lado do pé, no sentido da corrida
      ux = u.x; uz = u.z;
      const la = -(bx - j.x) * hz + (bz - j.z) * hx; // de que lado do caminho dele a bola está
      const lado = la >= 0 ? 1 : -1;
      qx = bx - hx * R.ofsCorrida + hz * lado * R.ladoCorrida;
      qz = bz - hz * R.ofsCorrida - hx * lado * R.ladoCorrida;
    } else if (u.x * (j.x - bx) + u.z * (j.z - bz) > 0) {
      // de frente (a bola vem para ele): na linha da bola, ela chegando ofsFrente à frente dele — ou, com o
      // analógico inclinado, do LADO para onde ele vai levar a bola (recebe com o pé de trás, de corpo aberto:
      // o 1º toque leva a bola pela frente do corpo e ela segue no caminho dele, sem abrir de lado)
      ux = u.x; uz = u.z;
      ladoDoToque(j, u, _c);
      qx = bx - _c.x; qz = bz - _c.z;
    } else {
      if (vindo) continue;
      // a bola indo embora ou cruzando à frente (espirrada, rebote): chega por trás/de lado, com a bola
      // ofsFrente à frente dele no sentido em que ele chega
      let ax = bx - j.x, az = bz - j.z;
      const l = MD.hypot(ax, az) || 1;
      ax /= l; az /= l;
      ux = u.x; uz = u.z;
      qx = bx - ax * R.ofsFrente; qz = bz - az * R.ofsFrente;
    }
    const t = i * DT;
    if (modo === 'corrida' && t > R.tCorrida) return false; // longe demais para seguir reto: de frente
    if (modo === 'corrida' && u) {
      // em corrida: o 1º encontro em que ele segue no ritmo de agora — o corpo seguindo reto, com a correção
      // de lado (aceleração lateral) e um pouco de ajuste no ritmo (sem frear para a bola chegar antes, o
      // que seria "parar"; a mesma ideia de conducao.js oportunidadeCorrida)
      const ex = qx - (j.x + j.vx * t), ez = qz - (j.z + j.vz * t);
      const ao = ex * hx + ez * hz, la = -ex * hz + ez * hx;
      if (Math.abs(la) <= 0.5 * R.aLatCorrida * t * t + 0.05 && ao <= 0.5 * R.aRitmoCorrida * t * t + 0.1 && ao >= -(0.5 * R.aRitmoCorrida * t * t + 0.1)) {
        out.i = i; out.qx = qx; out.qz = qz; out.bx = bx; out.bz = bz; out.ux = ux; out.uz = uz;
        return true;
      }
      continue;
    }
    if (esforco) {
      // nenhum encontro a tempo: o que fica mais perto de dar (menor atraso) — o corpo vai para lá a toda,
      // e nunca para longe da bola
      const atraso = tempoAlcance(j, qx, qz, vmax) - t;
      if (atraso < melhor) { melhor = atraso; out.i = i; out.qx = qx; out.qz = qz; out.bx = bx; out.bz = bz; out.ux = ux; out.uz = uz; }
      continue;
    }
    if (calmo && R.custoTempo * t >= melhor) break; // nada mais adiante fica mais barato
    const dq = MD.hypot(qx - j.x, qz - j.z);
    // sem pressa, ele chega PARANDO no encontro (o movimento de frente chega freando): embalado, o ponto em que
    // ele está agora não vale — passaria dele (a conta antes dava 0 s e o corpo freava saindo da linha da bola)
    if (tempoAlcance(j, qx, qz, vmax, calmo) <= t) {
      // sem pressa: o encontro que pede menos deslocamento (custo = metros + custoTempo × s) — a bola que
      // vem para ele é recebida onde ele está (ou no pé da perpendicular à linha dela); com pressa: o 1º
      const custo = calmo ? dq + R.custoTempo * t : 0;
      if (calmo && custo >= melhor) continue;
      melhor = custo;
      out.i = i; out.qx = qx; out.qz = qz; out.bx = bx; out.bz = bz; out.ux = ux; out.uz = uz;
      if (!calmo) return true;
    }
  }
  return melhor < Infinity;
}
const _enc = { i: 0, qx: 0, qz: 0, bx: 0, bz: 0, ux: 0, uz: 0 };
const _c = { x: 0, z: 0 };

/**
 * Onde a bola chega em relação ao corpo na recepção de frente (vetor corpo → bola, em `out`): sem o analógico,
 * ofsFrente à frente (contra o sentido u da bola); com ele, na direção do analógico — se ela aponta para
 * trás do corpo (a bola teria de passar por ele), para o lado do analógico, que é o máximo que o pé alcança.
 */
function ladoDoToque(j, u, out) {
  const fx = -u.x, fz = -u.z; // o corpo de frente para a bola
  if (!(j.imag > 0.3)) { out.x = fx * R.ofsFrente; out.z = fz * R.ofsFrente; return out; }
  let ax = j.ix, az = j.iz;
  const fr = ax * fx + az * fz;
  if (fr < 0) {
    // para trás: o lado do analógico (perpendicular à bola)
    ax -= fr * fx; az -= fr * fz;
    const l = MD.hypot(ax, az);
    if (l < 1e-3) { out.x = fx * R.ofsFrente; out.z = fz * R.ofsFrente; return out; }
    ax /= l; az /= l;
  }
  out.x = ax * R.ofsFrente; out.z = az * R.ofsFrente;
  return out;
}

/** Modo da recepção (a mesma regra de conducao.js modoRecepcao) — e o analógico não pede o contrário. */
function modoDe(j, b) {
  const s = MD.hypot(j.vx, j.vz);
  if (s < 2.0) return 'frente';
  const sb = MD.hypot(b.v.x, b.v.z);
  if (sb >= 1.0 && (b.v.x * j.vx + b.v.z * j.vz) / (sb * s) < MD.cos(1.92)) return 'frente';
  // analógico inclinado para trás da corrida: quer parar/virar — recebe de frente
  if (j.imag > ENTRADA.magDirecao && j.ix * j.vx + j.iz * j.vz < 0) return 'frente';
  return 'corrida';
}

/**
 * O jogador j (do humano) vai receber a bola agora? 'passe' (o passe é para ele), 'livre' (bola livre
 * sem passe: falta ver se passa perto e se ele chega antes dos companheiros) ou null.
 */
export function tipoRecepcao(m, j) {
  if (m.posse != null || m.naMao != null) return null;
  if (j.posicao === 'GOL' || !j.cond) return null;
  if (m.parada && !m.parada.rolou) return null;
  if (j.cond.semDominioAte != null && m.tick < j.cond.semDominioAte) return null;
  const v = m.voo;
  if (j.recebe) return 'passe';
  if (v && v.para != null) return null;                          // passe para outro: não é dele
  if (v && v.de === j.id && m.tick - (v.tick0 ?? 0) < 30) return null; // a bola que ele acabou de bater
  // finalização indo para o gol (do companheiro ou do adversário): não é bola para receber — a assistência
  // puxava o controlado para a linha do chute (cortava o chute do próprio time; bloqueava sozinho o do
  // adversário, com o analógico para longe). Bloquear é com o botão de defesa. Chute desviado (lento ou
  // indo para fora) volta a ser bola livre.
  if (v && FINALIZACAO.has(v.tipo) && chuteNoGol(m.bola)) return null;
  return 'livre';
}
const FINALIZACAO = new Set(['chute', 'colocado', 'cavadinha', 'cabeceio']);

/** A bola vai (em linha reta, no sentido em que anda) para a boca de um dos gols, forte? */
function chuteNoGol(b) {
  const vx = b.v.x, vz = b.v.z, v = MD.hypot(vx, vz);
  if (v < R.chuteVMin) return false;
  if (v >= R.chuteVForte) return true;
  if (Math.abs(vx) < 1e-6) return false;
  const gx = vx > 0 ? CAMPO.meioX : -CAMPO.meioX;
  const z = b.p.z + (vz / vx) * (gx - b.p.x);
  return Math.abs(z) < CAMPO.gol.largura / 2 + R.chuteFolgaTrave;
}

/** Tick (relativo) em que o jogador o chega na bola prevista pb (no máximo a toda), ou Infinity. */
function encontroCompanheiro(o, pb, n) {
  for (let i = 2; i <= n; i += 2) {
    if (pb.ys[i] > R.alturaPe) continue;
    if (tempoAlcance(o, pb.xs[i], pb.zs[i], o.par.vArrancada) <= i * DT) return i;
  }
  return Infinity;
}

/**
 * Planeja (a cada passo) a recepção assistida de j: escreve em j.recep {tick (deste plano), alvo (tick do
 * encontro), qx, qz, bx, bz, ux, uz, modo, vmax, livre} e devolve j.recep, ou null (sem assistência).
 */
export function planejarRecepcao(m, j) {
  const tipo = tipoRecepcao(m, j);
  const st = j.recep;
  if (!tipo) { if (st) st.ativo = false; return null; }
  const b = m.bola;
  // bola alta longe de descer (lançamento, cruzamento): a assistência aérea cuida (troca.js / sim.js)
  const pb = preverBola(b, H);
  const modo = modoDe(j, b);
  const correr = (j.botoes & BOTAO.CORRER) !== 0;
  // o analógico apontando para a bola (contra o sentido dela) também apressa o encontro
  const sb = MD.hypot(b.v.x, b.v.z);
  const paraBola = j.imag > 0.3 && sb > 1 && (j.ix * b.v.x + j.iz * b.v.z) / sb < -0.5;
  let i0 = 1;
  const r = j.recebe;
  if (r && r.tipo === 'enfiada') {
    // enfiada: ele corre para o espaço, não volta para buscar (o encontro é do ponto marcado em diante)
    const ux = sb > 0.5 ? b.v.x / sb : 0, uz = sb > 0.5 ? b.v.z / sb : 0;
    const sP = (r.x - b.p.x) * ux + (r.z - b.p.z) * uz - 1.5;
    while (i0 < H && (pb.xs[i0] - b.p.x) * ux + (pb.zs[i0] - b.p.z) * uz < sP) i0++;
  }
  // a toda: CORRER e a enfiada (fica até o fim da recepção: sem vai e vem entre trote e arrancada); com
  // pressa (o 1º encontro possível): também o analógico apontando para a bola, no ritmo que ele pede
  const rapido = correr || (!!r && r.tipo === 'enfiada') || (!!st && st.ativo && st.rapido && st.tick === m.tick - 1);
  const pressa = rapido || paraBola;
  const s = MD.hypot(j.vx, j.vz);
  const vCalma = Math.max(j.par.vTrote, Math.min(s, j.par.vCorrida));
  let vmax = rapido ? j.par.vArrancada : paraBola ? Math.max(vCalma, velocidadeDesejada(j.par, j.imag, false, false, false)) : vCalma;
  let achou = acharEncontro(j, pb, H, i0, vmax, modo, _enc, !pressa);
  let modoF = modo;
  if (!achou && modo === 'corrida') { achou = acharEncontro(j, pb, H, i0, vmax, 'frente', _enc, !pressa); modoF = 'frente'; }
  let rap = rapido;
  // bola livre que ele só pega trotando tarde demais (espirrada, rebote indo embora): vai a toda
  if (achou && !rapido && tipo === 'livre' && _enc.i * DT > R.tLivre) achou = false;
  if (!achou && !rapido) {
    vmax = j.par.vArrancada; rap = true;
    achou = acharEncontro(j, pb, H, i0, vmax, modo, _enc);
    if (!achou && modo === 'corrida') { achou = acharEncontro(j, pb, H, i0, vmax, 'frente', _enc); modoF = 'frente'; }
    else modoF = modo;
  }
  if (!achou && (tipo === 'passe' || MD.hypot(b.p.x - j.x, b.p.z - j.z) <= R.perto)) {
    // a bola dele (ou livre e perto) sem encontro a tempo: o melhor esforço, de frente e a toda
    vmax = j.par.vArrancada; rap = true; modoF = 'frente';
    achou = acharEncontro(j, pb, Math.min(H, 90), i0, vmax, 'frente', _enc, false, true);
  }
  if (!achou) { if (st) st.ativo = false; return null; }
  if (tipo === 'livre') {
    // bola livre: só se o encontro é perto e logo, e ele chega antes dos companheiros
    const perto = MD.hypot(_enc.qx - j.x, _enc.qz - j.z) <= R.perto || MD.hypot(b.p.x - j.x, b.p.z - j.z) <= R.perto;
    if (_enc.i * DT > R.tLivre || !perto) { if (st) st.ativo = false; return null; }
    const meu = _enc.i;
    // o mais cedo que ele chega (a toda), para a corrida com o adversário
    let cedo = -1;
    for (const o of m.jogadores) {
      if (o === j || o.posicao === 'GOL' || o.papel === 'parado' || o.papel === 'marcador') continue;
      if (MD.hypot(o.x - _enc.bx, o.z - _enc.bz) > MD.hypot(j.x - _enc.bx, j.z - _enc.bz) + 12) continue;
      if (o.time === j.time) {
        if (encontroCompanheiro(o, pb, Math.min(H, meu + 2)) * DT < meu * DT - R.folgaCompanheiro) { if (st) st.ativo = false; return null; }
      } else {
        // o adversário chega nela bem antes (S3 da contraprova): a bola é dele — o controlado não é puxado
        if (cedo < 0) cedo = Math.min(meu, encontroCompanheiro(j, pb, meu));
        if (encontroCompanheiro(o, pb, Math.min(H, cedo + 2)) * DT < cedo * DT - R.folgaAdversario) { if (st) st.ativo = false; return null; }
      }
    }
  }
  const p = j.recep ?? (j.recep = { ativo: false, tick: -1, alvo: 0, qx: 0, qz: 0, bx: 0, bz: 0, ux: 0, uz: 0, modo: 'frente', vmax: 0, rapido: false, livre: false });
  p.ativo = true; p.tick = m.tick; p.alvo = m.tick + _enc.i;
  p.qx = _enc.qx; p.qz = _enc.qz; p.bx = _enc.bx; p.bz = _enc.bz; p.ux = _enc.ux; p.uz = _enc.uz;
  p.modo = modoF; p.vmax = vmax; p.rapido = rap; p.livre = tipo === 'livre';
  return p;
}

/** A recepção assistida de j vale neste passo? (planejada no passo de agora) */
export function recepcaoAtiva(m, j) {
  const p = j.recep;
  return !!p && p.ativo && p.tick === m.tick;
}

/**
 * Movimento da recepção assistida (pura): o corpo k vai ao ponto de encontro do plano pl, chegando no
 * tick pl.alvo. O desvio de lado até a linha da bola é feito com pressa (RECEPCAO.tLateral) e o resto no
 * ritmo do encontro; de frente, chega freando e de frente para a bola (bx, bz = a bola agora), com o tronco
 * aberto para o lado do analógico (ix, iz, imag); em corrida, segue correndo. Usada pela simulação (sim.js)
 * e pela previsão do domínio (conducao.js preverCorpo): a mesma conta. Escreve em out {dx, dz, vel, rumoAlvo}.
 */
export function movimentoAssistido(k, pl, tick, bx, bz, par, ix, iz, imag, out) {
  const n = Math.max(1, pl.alvo - tick + 1);
  const T = n * DT;
  const dx = pl.qx - k.x, dz = pl.qz - k.z;
  const d = MD.hypot(dx, dz);
  const al = dx * pl.ux + dz * pl.uz;            // ao longo da linha da bola
  const la = -dx * pl.uz + dz * pl.ux;           // de lado (até a linha)
  const vla = la / Math.max(DT, Math.min(T, R.tLateral));
  let val = al / T;
  let vx = val * pl.ux - vla * pl.uz, vz = val * pl.uz + vla * pl.ux;
  let v = MD.hypot(vx, vz);
  let cap = pl.vmax;
  if (pl.modo !== 'corrida') cap = Math.min(cap, Math.sqrt(2 * par.freio * Math.max(0, d - 0.03)) + 0.3);
  if (v > cap) { vx *= cap / v; vz *= cap / v; v = cap; }
  // embalado, com o ponto de lado e um pouco para trás: o pedido abre no máximo R.angCorteMax do sentido da
  // corrida — ele corta para a linha da bola freando (passoCorpo: freio + aceleração de lado), em vez de
  // "inverter" (frear na linha sem sair de lado: o corpo passava do encontro e saía da linha da bola).
  // Ponto bem para trás (mais que R.angInverte): inverte, como antes.
  const s = MD.hypot(k.vx, k.vz);
  if (s > 1.2 && v > 0.05) {
    const hx = k.vx / s, hz = k.vz / s;
    const c = (vx * hx + vz * hz) / v, sn = (hx * vz - hz * vx) / v;
    const th = MD.atan2(sn, c), ath = Math.abs(th);
    if (ath > R.angCorteMax && ath < R.angInverte) {
      const a = th > 0 ? R.angCorteMax : -R.angCorteMax;
      const ca = MD.cos(a), sa = MD.sin(a);
      vx = (hx * ca - hz * sa) * v; vz = (hz * ca + hx * sa) * v;
    }
  }
  let rumo;
  if (pl.modo === 'corrida') {
    const s = MD.hypot(k.vx, k.vz);
    rumo = v > 0.3 ? MD.atan2(vz, vx) : s > 0.3 ? MD.atan2(k.vz, k.vx) : k.rumo;
  } else {
    rumo = MD.atan2(bz - k.z, bx - k.x);
    if (imag > 0.3) rumo += clamp(difAng(rumo, MD.atan2(iz, ix)), -R.corpoAberto, R.corpoAberto);
  }
  if (!out) out = { dx: 0, dz: 0, vel: 0, rumoAlvo: 0 };
  if (v > 1e-6) { out.dx = vx / v; out.dz = vz / v; } else { out.dx = MD.cos(rumo); out.dz = MD.sin(rumo); }
  out.vel = v < 0.05 ? 0 : v;
  out.rumoAlvo = rumo;
  return out;
}
