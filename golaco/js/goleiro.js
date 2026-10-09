// Goleiro (Etapa 2): posicionamento na bissetriz do ângulo bola–traves, leitura do chute (onde
// e quando a bola passa pelo plano do goleiro), tempo de reação pelo atributo, mergulho com
// alcance real, encaixe ou espalmada, bola nas mãos e reposição, e saída (botão GOLEIRO
// segurado ou 1×1). Puro: sem three.js nem DOM; sorteios pelo gerador do mundo.

import { GOLEIRO, CAMPO, PASSO, BOLA, BOTAO } from './config.js';
import { MD } from './matdet.js';
import { clamp, lerp } from './mat.js';
import { uniforme } from './rng.js';
import { criarBola, passoBola, chutar } from './bola.js';

const DT = PASSO;
const MEIO = CAMPO.gol.largura / 2;

/** x da linha do gol que o goleiro defende (o time ataca o lado oposto). */
export function linhaDoGol(m, j) {
  const lado = m.ataca ? m.ataca[j.time] : (j.time === 0 ? 1 : -1);
  return -lado * CAMPO.meioX;
}

/** Ponto na bissetriz do ângulo bola–traves, a d metros da linha. */
export function pontoBissetriz(bx, bz, gx, d) {
  const s = gx > 0 ? -1 : 1; // para dentro do campo
  const p1x = gx, p1z = -MEIO, p2x = gx, p2z = MEIO;
  let ax = p1x - bx, az = p1z - bz;
  let la = MD.hypot(ax, az) || 1; ax /= la; az /= la;
  let cx = p2x - bx, cz = p2z - bz;
  let lc = MD.hypot(cx, cz) || 1; cx /= lc; cz /= lc;
  let ux = ax + cx, uz = az + cz;
  const lu = MD.hypot(ux, uz) || 1; ux /= lu; uz /= lu;
  // reta B + t·u cruzando x = gx + s·d
  const xAlvo = gx + s * d;
  if (Math.abs(ux) < 1e-6) return { x: xAlvo, z: clamp(bz, -MEIO, MEIO) };
  const t = (xAlvo - bx) / ux;
  return { x: xAlvo, z: clamp(bz + uz * t, -MEIO - 0.4, MEIO + 0.4) };
}

/** Prevê onde a bola passa pelo plano x = xPlano: {ticks, y, z} ou null. */
export function preverPassagem(b, xPlano, max = 120) {
  const t = criarBola(b.p.x, b.p.z);
  Object.assign(t.p, b.p); Object.assign(t.v, b.v); Object.assign(t.w, b.w); t.rolando = b.rolando;
  const sentido = Math.sign(xPlano - b.p.x);
  let xAnt = t.p.x, yAnt = t.p.y, zAnt = t.p.z;
  for (let i = 1; i <= max; i++) {
    passoBola(t, null);
    if ((t.p.x - xPlano) * sentido >= 0) {
      const f = (xPlano - xAnt) / ((t.p.x - xAnt) || 1e-9);
      return { ticks: i, y: yAnt + (t.p.y - yAnt) * f, z: zAnt + (t.p.z - zAnt) * f, v: MD.hypot(t.v.x, t.v.y, t.v.z) };
    }
    if (MD.hypot(t.v.x, t.v.z) < 0.5) return null;
    xAnt = t.p.x; yAnt = t.p.y; zAnt = t.p.z;
  }
  return null;
}

/** Está segurando a bola nas mãos? */
export function comBolaNaMao(m, j) {
  return m.naMao === j.id;
}

/**
 * Lê um chute (bola livre vindo para o gol) e planeja a defesa. Chamar a cada tick antes de
 * integrar a bola. Decide uma vez por chute (sorteio único → determinístico).
 */
export function lerChute(m, j) {
  if (m.posse != null || m.naMao != null) { j.defesa = null; return; }
  const b = m.bola;
  const gx = linhaDoGol(m, j);
  const sentido = Math.sign(gx);
  const vIn = b.v.x * sentido;
  if (vIn < 5) { if (j.defesa && m.tick > j.defesa.tick + 30) j.defesa = null; return; }
  if (j.defesa && j.defesa.chave === m.voo?.tickChave) return;
  // onde a bola cruza a linha do gol e o plano do goleiro
  const linha = preverPassagem(b, gx, 150);
  if (!linha) return;
  const noGol = Math.abs(linha.z) < MEIO + 0.25 && linha.y < CAMPO.gol.altura + 0.25;
  if (!noGol) { j.defesa = { chave: m.voo?.tickChave, fora: true, tick: m.tick + linha.ticks }; return; }
  const xPlano = Math.abs(j.x - gx) > 0.3 ? j.x : gx - sentido * 0.3;
  const plano = preverPassagem(b, xPlano, 150) ?? linha;
  const a = j.par.attr;
  const reac = Math.round(lerp(GOLEIRO.reacao[0], GOLEIRO.reacao[1], a.reflexo / 100) / DT);
  const tDisp = (plano.ticks - reac) * DT;            // tempo para se mexer depois de reagir
  const lat = plano.z - j.z;
  const dist = Math.abs(lat);
  const alcanceEmPe = GOLEIRO.alcanceEmPe;
  const alcanceTempo = alcanceEmPe + Math.max(0, tDisp) * GOLEIRO.vMergulho * lerp(0.85, 1.12, a.mergulho / 100);
  const alcance = Math.min(GOLEIRO.alcanceMergulho * lerp(0.9, 1.08, a.mergulho / 100), alcanceTempo);
  const alturaOk = plano.y < GOLEIRO.alturaMax + (dist < 1 ? 0.2 : 0);
  const chega = dist <= alcance && alturaOk && tDisp > -0.05;
  // dificuldade: perto do limite do alcance, bola forte, longe do corpo no alto/baixo
  const fracAlc = dist / Math.max(alcance, 0.1);
  const vel = plano.v;
  const alto = Math.max(0, plano.y - 1.9) / 0.6;
  let pDefesa = 0;
  if (chega) {
    const base = lerp(0.9, 0.99, a.reflexo / 100);
    const dif = 0.55 * fracAlc * fracAlc + 0.012 * Math.max(0, vel - 14) + 0.25 * alto + (tDisp < 0.15 ? 0.25 : 0);
    pDefesa = clamp(base - dif, 0.03, 0.98);
  }
  const ok = uniforme(m.rng) < pDefesa;
  const encaixe = ok && vel < GOLEIRO.encaixeVMax && dist < 1.4 && plano.y < 1.9 && uniforme(m.rng) < lerp(0.4, 0.8, a.reflexo / 100);
  j.defesa = {
    chave: m.voo?.tickChave, tick: m.tick + plano.ticks, inicio: m.tick + reac, z: plano.z, y: plano.y,
    sucesso: ok, tipo: ok ? (encaixe ? 'encaixe' : 'espalmada') : 'falhou', mergulha: dist > alcanceEmPe,
    lado: Math.sign(lat) || 1, xPlano,
  };
  m.eventos.push({ tipo: 'leituraGoleiro', id: j.id, chega, p: pDefesa });
}

/** Executa a defesa no tick planejado (antes de integrar a bola). */
export function aplicarDefesa(m, j) {
  const d = j.defesa;
  if (!d || d.fora || m.tick !== d.tick - 1) return;
  if (!d.sucesso) { m.eventos.push({ tipo: 'goleiroBatido', id: j.id }); return; }
  const b = m.bola;
  const sentido = Math.sign(linhaDoGol(m, j));
  if (d.tipo === 'encaixe') {
    b.v.x = 0; b.v.y = 0; b.v.z = 0; b.w.x = 0; b.w.y = 0; b.w.z = 0;
    m.naMao = j.id;
    m.posse = j.id;
    j.segura = { desde: m.tick };
    m.voo = null;
    m.eventos.push({ tipo: 'defesa', id: j.id, modo: 'encaixe' });
  } else {
    // espalmada: a bola volta para fora, para o lado (escanteio ou rebote longe do meio)
    const v = MD.hypot(b.v.x, b.v.y, b.v.z);
    const lado = d.z === 0 ? 1 : Math.sign(d.z);
    const fora = Math.abs(d.z) > MEIO * 0.45;
    const vx = -sentido * v * (fora ? 0.12 : 0.3);
    const vz = lado * v * (fora ? 0.42 : 0.35);
    const vy = Math.max(1.5, v * 0.18);
    chutar(b, { x: vx, y: vy, z: vz }, { x: 0, y: 0, z: 0 });
    b.rolando = false;
    m.voo = null;
    m.ultimoToque = { id: j.id, time: j.time, tick: m.tick };
    m.eventos.push({ tipo: 'defesa', id: j.id, modo: 'espalmada' });
  }
  if (m.stats) m.stats.defesas = (m.stats.defesas ?? 0) + 1;
}

/** Goleiro deve sair (1×1 da IA ou botão GOLEIRO do humano)? */
function deveSair(m, j, humano) {
  if (humano) return (j.botoesTime & BOTAO.GOLEIRO) !== 0;
  const b = m.bola;
  const gx = linhaDoGol(m, j);
  const dBolaGol = MD.hypot(b.p.x - gx, b.p.z);
  if (dBolaGol > 17) return false;
  const dono = m.posse != null ? m.jogadores.find(o => o.id === m.posse) : null;
  if (!dono || dono.time === j.time) return false;
  // ninguém do meu time mais perto da bola do que eu
  const dg = MD.hypot(j.x - b.p.x, j.z - b.p.z);
  for (const o of m.jogadores) {
    if (o.time !== j.time || o.id === j.id) continue;
    if (MD.hypot(o.x - b.p.x, o.z - b.p.z) < dg * 0.8) return false;
  }
  return true;
}

/**
 * Movimento do goleiro neste tick: {dx, dz, vel, rumoAlvo}. botoesTime = botões do humano do
 * time (para o botão GOLEIRO), quando há humano.
 */
export function movimentoGoleiro(m, j, humano) {
  const b = m.bola;
  const gx = linhaDoGol(m, j);
  const sentido = Math.sign(gx);
  const olhar = MD.atan2(b.p.z - j.z, b.p.x - j.x);
  if (comBolaNaMao(m, j)) return { dx: -sentido, dz: 0, vel: 0, rumoAlvo: MD.atan2(0, -sentido) };
  const d = j.defesa;
  if (d && d.sucesso !== undefined && !d.fora && m.tick >= d.inicio && m.tick < d.tick + 6) {
    // vai para o ponto da defesa (o mergulho é desenhado pela animação)
    const dz = d.z - j.z;
    const v = Math.min(GOLEIRO.vMergulho * 1.2, Math.abs(dz) / Math.max((d.tick - m.tick) * DT, 0.05));
    if (d.mergulha && !j.mergulho && m.tick >= d.inicio) {
      j.mergulho = { tick0: m.tick, lado: d.lado, alt: d.y, ate: d.tick + 30 };
    }
    return { dx: 0, dz: Math.sign(dz) || 1, vel: d.sucesso ? v : v * 0.8, rumoAlvo: MD.atan2(0, -sentido) };
  }
  if (j.mergulho && m.tick > j.mergulho.ate) j.mergulho = null;
  if (deveSair(m, j, humano)) {
    // sai na bola (até saidaMax da linha)
    const alvoX = clamp(b.p.x, gx - sentido * 0.5, gx - sentido * GOLEIRO.saidaMax);
    const tx = sentido > 0 ? Math.min(alvoX, gx) : Math.max(alvoX, gx);
    const dx = tx - j.x, dzz = b.p.z - j.z;
    const dd = MD.hypot(dx, dzz) || 1;
    if (!j.saindo) { j.saindo = true; m.eventos.push({ tipo: 'saidaGoleiro', id: j.id }); }
    return { dx: dx / dd, dz: dzz / dd, vel: j.par.vArrancada * 0.95, rumoAlvo: olhar };
  }
  j.saindo = false;
  // posição: bissetriz, mais adiantado com a bola longe
  const dBola = MD.hypot(b.p.x - gx, b.p.z);
  const dLinha = lerp(GOLEIRO.distLinha[0], GOLEIRO.distLinha[1], clamp((dBola - 6) / 30, 0, 1));
  const p = pontoBissetriz(b.p.x, b.p.z, gx, dLinha);
  const dx = p.x - j.x, dz = p.z - j.z;
  const dd = MD.hypot(dx, dz);
  const vel = Math.min(4.5, dd * 3);
  return { dx: dd > 1e-6 ? dx / dd : 0, dz: dd > 1e-6 ? dz / dd : 0, vel, rumoAlvo: olhar };
}

/** Bola nas mãos acompanha o goleiro (no meio das palmas, na altura do peito). */
export function bolaNaMao(m, j) {
  const b = m.bola;
  const f = 0.32;
  b.p.x = j.x + MD.cos(j.rumo) * f;
  b.p.z = j.z + MD.sin(j.rumo) * f;
  b.p.y = 1.05;
  b.v.x = 0; b.v.y = 0; b.v.z = 0;
  b.rolando = false;
}

/** Goleiro com a bola nas mãos a solta para a reposição (pé ou mão). */
export function soltarDaMao(m, j) {
  const b = m.bola;
  b.p.y = BOLA.raio;
  b.rolando = true;
  m.naMao = null;
  j.segura = null;
}
