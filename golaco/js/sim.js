// Mundo da simulação: estado completo + passo fixo. Sem three.js nem DOM.
// O mundo é um objeto simples (copiável); a mesma semente e as mesmas entradas geram a
// mesma partida bit a bit (ver hashMundo).

import { PASSO, ENTRADA, BOTAO, CONDUCAO, JOGADOR, TREINO, CAMPO } from './config.js';
import { criarRng, entre } from './rng.js';
import { criarBola, passoBola, chutarRasteiro, copiarBola } from './bola.js';
import { criarJogador, passoCorpo, passoPassada } from './jogador.js';
import { clamp, difAng, quantizar } from './mat.js';
import {
  criarCond, controlarComBola, movimentoComBola, movimentoBase, movimentoRecepcao, tentarDominio, verificarPerda,
} from './conducao.js';

/**
 * Cria o mundo. opcoes:
 *   semente      inteiro
 *   jogadores    [{id, x, z, rumo, attr, time, papel}]  papel: 'humano' | 'marcador' | 'parado'
 *   bola         {x, z} (posição inicial); posse: id do jogador com a bola
 */
export function criarMundo(opcoes = {}) {
  const semente = opcoes.semente ?? 1;
  const m = {
    tick: 0,
    semente,
    rng: criarRng(semente),
    bola: criarBola(opcoes.bola?.x ?? 0.4, opcoes.bola?.z ?? 0),
    jogadores: [],
    posse: opcoes.posse ?? null,
    eventos: [],
    log: opcoes.log ? [] : null,
    stats: { perdas: 0, roubadas: 0 },
  };
  for (const d of opcoes.jogadores ?? [{ id: 0, x: 0, z: 0, rumo: 0 }]) {
    const j = criarJogador(d.id, d.x, d.z, d.rumo ?? 0, d.attr ?? {}, d.time ?? 0);
    j.papel = d.papel ?? 'humano';
    j.cond = criarCond();
    m.jogadores.push(j);
  }
  return m;
}

export function jogadorPorId(m, id) {
  for (const j of m.jogadores) if (j.id === id) return j;
  return null;
}

/** Aplica a entrada (analógico já em coordenadas do mundo, |v| ≤ 1). */
export function aplicarEntrada(j, e, tick) {
  const q = ENTRADA.quant;
  let x = quantizar(e?.x ?? 0, q), z = quantizar(e?.z ?? 0, q);
  let mag = Math.hypot(x, z);
  if (mag > 1) { x /= mag; z /= mag; mag = 1; }
  j.botoesAnt = j.botoes;
  j.botoes = (e?.botoes ?? 0) | 0;
  if (mag > 0.08) {
    const r = Math.atan2(z, x);
    const d = difAng(j.intRumo, r);
    if (j.imag > 0.08 && Math.abs(d) < 0.12) {
      // giro contínuo do analógico: mede a velocidade angular pedida
      const w = d / PASSO;
      j.intW += (w - j.intW) * Math.min(1, PASSO / 0.12);
    } else {
      j.intW = 0; // salto (tecla, flick): não extrapola
    }
    j.intRumo = r;
    j.ix = x / mag; j.iz = z / mag;
  } else {
    j.intW *= Math.exp(-PASSO / 0.1);
  }
  j.imag = mag;
  // pedalada: dois toques no modificador
  const sub = (j.botoes & BOTAO.MOD) && !(j.botoesAnt & BOTAO.MOD);
  if (sub) {
    if (j.ultMod != null && (tick - j.ultMod) * PASSO < CONDUCAO.pedaladaToqueDuplo) {
      j.pedidoPedalada = true;
      j.ultMod = null;
    } else j.ultMod = tick;
  }
}

function moverMarcador(m, j) {
  // marcador de treino: vai na bola; encostado no condutor, contorna pelo lado da bola
  const b = m.bola;
  const dono = m.posse != null ? jogadorPorId(m, m.posse) : null;
  let tx = b.p.x, tz = b.p.z;
  if (dono && dono !== j) {
    const dx = j.x - dono.x, dz = j.z - dono.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.3) {
      // contorna: gira em volta do condutor na direção da bola
      const aM = Math.atan2(dz, dx);
      const aB = Math.atan2(b.p.z - dono.z, b.p.x - dono.x);
      const sentido = difAng(aM, aB) >= 0 ? 1 : -1;
      const a2 = aM + sentido * 0.9;
      tx = dono.x + Math.cos(a2) * 0.75;
      tz = dono.z + Math.sin(a2) * 0.75;
    }
  }
  const dx = tx - j.x, dz = tz - j.z;
  const d = Math.hypot(dx, dz) || 1;
  const vel = Math.min(TREINO.marcadorVel, 0.6 + d * 2.2);
  return { dx: dx / d, dz: dz / d, vel, rumoAlvo: Math.atan2(b.p.z - j.z, b.p.x - j.x) };
}

function colisaoCorpos(m) {
  const js = m.jogadores;
  const r2 = JOGADOR.raio * 2;
  for (let a = 0; a < js.length; a++) {
    for (let c = a + 1; c < js.length; c++) {
      const p = js[a], q = js[c];
      const dx = q.x - p.x, dz = q.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d >= r2 || d < 1e-9) continue;
      const nx = dx / d, nz = dz / d;
      const fp = p.par.attr.forca, fq = q.par.attr.forca;
      const wp = fq / (fp + fq), wq = fp / (fp + fq); // quem é mais forte se mexe menos
      const pen = r2 - d;
      p.x -= nx * pen * wp; p.z -= nz * pen * wp;
      q.x += nx * pen * wq; q.z += nz * pen * wq;
      const rv = (q.vx - p.vx) * nx + (q.vz - p.vz) * nz;
      if (rv < 0) {
        p.vx += nx * rv * wp; p.vz += nz * rv * wp;
        q.vx -= nx * rv * wq; q.vz -= nz * rv * wq;
      }
    }
  }
}

/** Bola batendo nas pernas de quem não está conduzindo. */
function colisaoBolaCorpo(m) {
  const b = m.bola;
  if (b.p.y > 0.9) return;
  for (const j of m.jogadores) {
    if (j.id === m.posse) continue;
    const dx = b.p.x - j.x, dz = b.p.z - j.z;
    const d = Math.hypot(dx, dz);
    const lim = 0.2 + b.p.y * 0 + 0.11;
    if (d >= lim || d < 1e-9) continue;
    const nx = dx / d, nz = dz / d;
    b.p.x = j.x + nx * lim; b.p.z = j.z + nz * lim;
    const vn = (b.v.x - j.vx) * nx + (b.v.z - j.vz) * nz;
    if (vn < 0) {
      b.v.x -= 1.35 * vn * nx; b.v.z -= 1.35 * vn * nz;
      if (b.rolando) { b.w.x = b.v.z / 0.11; b.w.z = -b.v.x / 0.11; }
      m.eventos.push({ tipo: 'bateuCorpo', id: j.id });
      const dono = m.posse != null ? jogadorPorId(m, m.posse) : null;
      if (dono) dono.cond.bolaDesviada = true;
    }
  }
}

function roubarComMarcador(m, j) {
  const b = m.bola;
  if (b.p.y > 0.5) return;
  const d = Math.hypot(b.p.x - j.x, b.p.z - j.z);
  if (d > TREINO.marcadorAlcance + 0.11) return;
  const dono = m.posse != null ? jogadorPorId(m, m.posse) : null;
  // tira a bola: empurra na direção em que o marcador está virado
  const v = 3.2;
  chutarRasteiro(b, Math.cos(j.rumo) * v, Math.sin(j.rumo) * v);
  if (dono) { dono.cond.toque = null; dono.cond.busca = false; }
  m.posse = null;
  m.stats.roubadas++;
  m.eventos.push({ tipo: 'roubada', id: j.id });
  j.descanso = 60; // 1 s sem tentar de novo
}

/**
 * Um passo de simulação (1/60 s). entradas: { [id]: {x, z, botoes} } (analógico no mundo).
 */
export function passo(m, entradas) {
  m.eventos = [];
  const js = m.jogadores;
  // 1) entradas
  for (const j of js) {
    if (j.papel === 'humano') aplicarEntrada(j, entradas?.[j.id], m.tick);
  }
  // 2) movimento de cada corpo
  for (const j of js) {
    let mv;
    if (j.papel === 'marcador') {
      if (j.descanso > 0) { j.descanso--; mv = { dx: Math.cos(j.rumo), dz: Math.sin(j.rumo), vel: 0, rumoAlvo: j.rumo }; }
      else mv = moverMarcador(m, j);
    } else if (j.papel === 'parado') {
      mv = { dx: 1, dz: 0, vel: 0, rumoAlvo: j.rumo };
    } else if (m.posse === j.id) {
      if (j.pedidoPedalada) {
        j.pedidoPedalada = false;
        j.cond.pedalada = { tick0: m.tick, lado: (j.cond.nToques % 2) ? 1 : -1 };
        j.cond.ref = null; // replaneja: a bola para junto do corpo
      }
      if (j.cond.pedalada && (m.tick - j.cond.pedalada.tick0) * PASSO > CONDUCAO.pedaladaDuracao) {
        j.cond.pedalada = null; j.cond.ref = null;
      }
      mv = movimentoComBola(m, j);
    } else {
      j.pedidoPedalada = false;
      mv = movimentoRecepcao(m, j, movimentoBase(j, j.ix, j.iz, j.imag, j.botoes, false, j.rumo, null));
    }
    passoCorpo(j, mv.dx, mv.dz, mv.vel, mv.rumoAlvo, j.par, PASSO, m.posse === j.id);
    passoPassada(j, m.posse === j.id, PASSO, null);
  }
  colisaoCorpos(m);
  // 3) controle de bola
  if (m.posse != null) {
    const dono = jogadorPorId(m, m.posse);
    if (dono) controlarComBola(m, dono);
  } else {
    for (const j of js) {
      if (j.papel === 'humano') { if (tentarDominio(m, j)) break; }
    }
  }
  for (const j of js) {
    if (j.papel === 'marcador' && !(j.descanso > 0) && m.posse !== j.id) roubarComMarcador(m, j);
  }
  // 4) bola
  passoBola(m.bola, m.eventos);
  colisaoBolaCorpo(m);
  // 5) posse
  if (m.posse != null) {
    const dono = jogadorPorId(m, m.posse);
    if (dono) verificarPerda(m, dono);
  }
  m.tick++;
}

// ---------------------------------------------------------------- determinismo

const _buf = new DataView(new ArrayBuffer(8));
function misturar(h, x) {
  _buf.setFloat64(0, x);
  for (let i = 0; i < 8; i++) {
    h ^= _buf.getUint8(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/** Hash FNV-1a do estado relevante (bola, corpos, pés, posse, gerador). */
export function hashMundo(m) {
  let h = 2166136261 >>> 0;
  const b = m.bola;
  for (const v of [b.p.x, b.p.y, b.p.z, b.v.x, b.v.y, b.v.z, b.w.x, b.w.y, b.w.z, b.q.x, b.q.y, b.q.z, b.q.w]) h = misturar(h, v);
  for (const j of m.jogadores) {
    for (const v of [j.x, j.z, j.vx, j.vz, j.rumo, j.giro, j.fase, j.pes[0].x, j.pes[0].z, j.pes[1].x, j.pes[1].z]) h = misturar(h, v);
  }
  h = misturar(h, m.posse ?? -1);
  h = misturar(h, m.tick);
  for (const s of m.rng.s) h = misturar(h, s);
  return h >>> 0;
}

/** Cópia profunda do mundo (replay, previsão, comparação). */
export function copiarMundo(m) {
  return structuredClone(m);
}
