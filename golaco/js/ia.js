// IA dos jogadores de linha que o humano não controla (Etapa 2: enxuta; a tática completa é a
// Etapa 3). A IA gera uma ENTRADA VIRTUAL {x, z, botoes} — anda e "aperta botões" pelas mesmas
// regras do humano (aplicarEntrada, condução, ações). Pura: sem three.js nem DOM.

import { BOTAO, CAMPO, PASSO, ACOES } from './config.js';
import { MD } from './matdet.js';
import { clamp, lerp } from './mat.js';
import { ataca } from './acoes.js';
import { preverBola } from './conducao.js';

const DT = PASSO;

function para(j, x, z, mag, correr = false, botoes = 0) {
  const dx = x - j.x, dz = z - j.z;
  const d = MD.hypot(dx, dz);
  if (d < 0.4) return { x: 0, z: 0, botoes };
  // chega devagar no ponto (sem passar e voltar)
  const m = Math.min(mag, Math.max(0.25, d / 4));
  return { x: (dx / d) * m, z: (dz / d) * m, botoes: botoes | (correr && d > 3 ? BOTAO.CORRER : 0) };
}

/**
 * Primeiro ponto do caminho da bola (física pura) a que o jogador chega antes ou junto com ela
 * (correndo no máximo). Recalculado a cada poucos ticks; guarda em j.intercepta.
 */
export function pontoInterceptacao(m, j) {
  if (j.intercepta && m.tick - j.intercepta.tick < 4) return j.intercepta;
  const n = 150;
  const pb = preverBola(m.bola, n);
  const vmax = j.par.vArrancada;
  const s0 = MD.hypot(j.vx, j.vz);
  let melhor = null;
  for (let i = 4; i <= n; i += 3) {
    if (pb.ys[i] > 2.3) continue; // alto demais para dominar ali
    const d = Math.max(0, MD.hypot(pb.xs[i] - j.x, pb.zs[i] - j.z) - 0.5);
    // tempo de corrida: aceleração até a velocidade máxima (perfil simples)
    const tAcel = Math.max(0, (vmax - s0) / 7);
    const dAcel = (s0 + vmax) / 2 * tAcel;
    const t = d <= dAcel ? d / Math.max((s0 + vmax) / 2, 1) : tAcel + (d - dAcel) / vmax;
    if (t <= i * DT + 0.05) { melhor = { x: pb.xs[i], z: pb.zs[i], i, tick: m.tick }; break; }
  }
  if (!melhor) melhor = { x: pb.xs[n], z: pb.zs[n], i: n, tick: m.tick };
  j.intercepta = melhor;
  return melhor;
}

function dono(m) {
  return m.posse != null ? m.jogadores.find(o => o.id === m.posse) : null;
}

/** Botões virtuais de uma ação da IA: segura pelo tempo da força e solta. */
function acaoIA(m, j, tipo, forca) {
  const bot = { passe: BOTAO.PASSE, enfiada: BOTAO.ENFIADA, lancamento: BOTAO.LANCAMENTO, chute: BOTAO.CHUTE }[tipo];
  j.iaAcao = { bot, ate: m.tick + Math.max(2, Math.round(forca * ACOES.cargaCheia / DT)) };
}

/** Entrada virtual do jogador j (não controlado) neste tick. */
export function entradaIA(m, j) {
  const b = m.bola;
  const lado = ataca(m, j.time);
  let extra = 0;
  if (j.iaAcao) {
    if (m.tick < j.iaAcao.ate) extra = j.iaAcao.bot;
    else j.iaAcao = null;
  }
  // recebendo um passe: vem ao encontro (passe) ou arranca para o ponto (enfiada, lançamento)
  if (j.recebe && m.posse !== j.id) {
    const r = j.recebe;
    if (m.tick - r.tick > 240 || (m.posse != null && m.posse !== j.id)) j.recebe = null;
    else if (r.tipo !== 'passe' && m.posse == null) {
      // enfiada/lançamento/cruzamento: corre para onde ELE e a BOLA chegam juntos
      const p = pontoInterceptacao(m, j);
      if (p) return { ...para(j, p.x, p.z, 1, true), botoes: extra | BOTAO.CORRER };
      return { ...para(j, r.x, r.z, 1, true), botoes: extra | BOTAO.CORRER };
    } else if (r.tipo === 'passe') {
      // vem ao encontro: alguns passos na direção da bola
      const dx = b.p.x - r.x, dz = b.p.z - r.z;
      const d = MD.hypot(dx, dz) || 1;
      const k = Math.min(1.5, d * 0.15);
      return { ...para(j, r.x + (dx / d) * k, r.z + (dz / d) * k, 0.6), botoes: extra };
    } else {
      return { ...para(j, r.x, r.z, 1, true), botoes: extra | BOTAO.CORRER };
    }
  }
  if (j.corrida) {
    if (m.tick > j.corrida.ate || MD.hypot(j.corrida.x - j.x, j.corrida.z - j.z) < 1) j.corrida = null;
    else return { ...para(j, j.corrida.x, j.corrida.z, 1, true), botoes: extra | BOTAO.CORRER };
  }
  const d0 = dono(m);
  // com a bola (IA): conduz para o gol e chuta; passa se apertado e houver companheiro livre
  if (m.posse === j.id) return comBola(m, j, lado, extra);
  const meuTimeTem = d0 && d0.time === j.time;
  if (meuTimeTem) return apoio(m, j, d0, lado, extra);
  return defesa(m, j, d0, lado, extra);
}

function comBola(m, j, lado, extra) {
  const gx = lado * CAMPO.meioX;
  const dGol = MD.hypot(gx - j.x, j.z);
  let botoes = extra;
  if (!j.iaAcao && !j.pedido && !j.carga) {
    // pressionado: tenta passar para o companheiro mais livre
    let pressao = Infinity;
    for (const o of m.jogadores) if (o.time !== j.time) pressao = Math.min(pressao, MD.hypot(o.x - j.x, o.z - j.z));
    if (dGol < 22 && Math.abs(j.z) < 18) acaoIA(m, j, 'chute', lerp(0.55, 0.85, (22 - dGol) / 22));
    else if (pressao < 2.2 && temCompanheiro(m, j)) acaoIA(m, j, 'passe', 0.5);
  }
  if (j.iaAcao && m.tick < j.iaAcao.ate) botoes |= j.iaAcao.bot;
  // conduz para o gol (um pouco para o meio)
  const tx = gx - lado * 6, tz = j.z * 0.6;
  const dx = tx - j.x, dz = tz - j.z;
  const d = MD.hypot(dx, dz) || 1;
  return { x: (dx / d) * 0.95, z: (dz / d) * 0.95, botoes: botoes | (dGol > 25 ? BOTAO.CORRER : 0) };
}

function temCompanheiro(m, j) {
  for (const o of m.jogadores) if (o.time === j.time && o.id !== j.id && o.posicao !== 'GOL') return true;
  return false;
}

/** Apoio sem bola (meu time com a bola): ocupa a vaga da posição, com corridas nas costas. */
function apoio(m, j, d0, lado, extra) {
  const v = j.vaga ?? { x: 0, z: 0 };
  // a vaga é relativa à bola: acompanha o avanço
  const bx = d0.x;
  let tx = bx + lado * v.x, tz = v.z;
  // atacante: de tempos em tempos corre nas costas da defesa (vem e vai)
  if (j.posicao === 'ATA') {
    const ciclo = (m.tick + j.id * 97) % 420;
    if (ciclo < 150) { tx = bx + lado * (v.x + 14); }
  }
  const lim = CAMPO.meioX - 2;
  tx = clamp(tx, -lim, lim);
  tz = clamp(tz, -CAMPO.meioZ + 2, CAMPO.meioZ - 2);
  const longe = MD.hypot(tx - j.x, tz - j.z) > 8;
  return { ...para(j, tx, tz, longe ? 1 : 0.6, longe), botoes: extra };
}

/** Defesa sem bola: o mais perto pressiona o condutor; os outros marcam entre o adversário e o gol. */
function defesa(m, j, d0, lado, extra) {
  const b = m.bola;
  const meuGol = -lado * CAMPO.meioX;
  // quem pressiona: o mais perto da bola no meu time (sem o goleiro)
  let maisPerto = null, dm = Infinity;
  for (const o of m.jogadores) {
    if (o.time !== j.time || o.posicao === 'GOL') continue;
    const d = MD.hypot(o.x - b.p.x, o.z - b.p.z);
    if (d < dm) { dm = d; maisPerto = o; }
  }
  if (maisPerto === j) {
    // fecha entre a bola e o meu gol, encostando
    const gx = meuGol - b.p.x, gz = -b.p.z;
    const g = MD.hypot(gx, gz) || 1;
    const tx = b.p.x + (gx / g) * 0.9, tz = b.p.z + (gz / g) * 0.9;
    return { ...para(j, tx, tz, 1, MD.hypot(tx - j.x, tz - j.z) > 4), botoes: extra };
  }
  // marca o atacante adversário mais perto do meu gol que ninguém marca (simples: o mais perto de mim)
  let alvo = null, da = Infinity;
  for (const o of m.jogadores) {
    if (o.time === j.time || o.posicao === 'GOL') continue;
    const d = MD.hypot(o.x - j.x, o.z - j.z);
    if (d < da) { da = d; alvo = o; }
  }
  if (!alvo) return { x: 0, z: 0, botoes: extra };
  const gx = meuGol - alvo.x, gz = -alvo.z;
  const g = MD.hypot(gx, gz) || 1;
  const tx = alvo.x + (gx / g) * 1.8, tz = alvo.z + (gz / g) * 1.8;
  return { ...para(j, tx, tz, 1, MD.hypot(tx - j.x, tz - j.z) > 5), botoes: extra };
}
