// Trânsito da cidade: carros andando pela mão direita nas ruas (eixos em x/z = k·CELL − MEIO, k = 0..N), virando nas
// esquinas por curvas de Bézier, guardando distância do carro da frente e cedendo a pedestres na frente. Só existem num
// raio do jogador; quem sai do raio renasce longe, de preferência atrás dele. Desenho: 3 InstancedMesh (carroceria com
// cores de vértice + cor por instância, faróis/lanternas e o facho dos faróis no chão à noite).
// THREE é passado por parâmetro (o mesmo módulo do jogo); a lógica não usa DOM.
import { CELL, N, MEIO, arestaNoCampus } from './cidade.js';

const FAIXA = 2.2;              // distância do eixo da rua ao centro da faixa (mão direita)
const T_ESQ = 8;                // a curva começa/termina a 8 m do centro do cruzamento (meia rua)
const VMIN = 8, VMAX = 16;
const GAP = 7.5;                // distância (centro a centro) mínima atrás do carro da frente
const COMP = 4.3, LARG = 1.85;

const eixo = (k) => k * CELL - MEIO;                       // posição do eixo da rua k
const noDe = (v) => Math.round((v + MEIO) / CELL);         // eixo mais próximo

// ---------- geometrias com cor de vértice ----------
function caixa(THREE, w, h, d, x, y, z, cor) {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z);
  return comCor(THREE, g, cor);
}
function cil(THREE, r, h, x, y, z, cor) {
  const g = new THREE.CylinderGeometry(r, r, h, 10); g.rotateX(Math.PI / 2); g.translate(x, y, z);
  return comCor(THREE, g, cor);
}
function comCor(THREE, g, cor) {
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = cor[0]; c[i * 3 + 1] = cor[1]; c[i * 3 + 2] = cor[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g.index ? g.toNonIndexed() : g;
}
function juntar(THREE, gs) {
  let n = 0; for (const g of gs) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const g of gs) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; g.dispose(); }
  const r = new THREE.BufferGeometry();
  r.setAttribute('position', new THREE.BufferAttribute(pos, 3)); r.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); r.setAttribute('color', new THREE.BufferAttribute(col, 3));
  r.computeBoundingSphere(); return r;
}
// carro com a frente em +x (como os estacionados de jogo.js)
function geoCarro(THREE) {
  const B = [1, 1, 1], VIDRO = [0.07, 0.09, 0.13], PRETO = [0.05, 0.05, 0.06], CINZA = [0.32, 0.33, 0.36];
  return juntar(THREE, [
    caixa(THREE, COMP, 0.62, LARG, 0, 0.6, 0, B),                // carroceria (tingida por instância)
    caixa(THREE, COMP + 0.06, 0.2, LARG + 0.04, 0, 0.36, 0, CINZA),   // saia/para-choques
    caixa(THREE, 2.25, 0.6, 1.62, -0.25, 1.2, 0, VIDRO),          // cabine de vidro
    caixa(THREE, 2.05, 0.08, 1.52, -0.25, 1.53, 0, B),            // teto
    caixa(THREE, 0.5, 0.08, 1.7, 1.5, 0.93, 0, B),                // capô (leve degrau)
    ...[[1.38, 0.88], [1.38, -0.88], [-1.38, 0.88], [-1.38, -0.88]].map(([x, z]) => cil(THREE, 0.34, 0.26, x, 0.34, z, PRETO)),
  ]);
}
function geoLuzes(THREE) {
  const F = [1, 0.95, 0.78], R = [1, 0.08, 0.06];
  return juntar(THREE, [
    caixa(THREE, 0.08, 0.16, 0.36, COMP / 2 + 0.01, 0.74, 0.6, F), caixa(THREE, 0.08, 0.16, 0.36, COMP / 2 + 0.01, 0.74, -0.6, F),
    caixa(THREE, 0.08, 0.14, 0.34, -COMP / 2 - 0.01, 0.78, 0.62, R), caixa(THREE, 0.08, 0.14, 0.34, -COMP / 2 - 0.01, 0.78, -0.62, R),
  ]);
}
function geoFacho(THREE) {           // dois fachos no chão à frente (plano em y = 0,04)
  const g = new THREE.PlaneGeometry(9, 3.2); g.rotateX(-Math.PI / 2); g.translate(COMP / 2 + 4.6, 0.04, 0);
  return g;
}
function texFacho(THREE) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d');
  g.save(); g.scale(1, 0.5);                       // elipse: some nas laterais e no fim (sem borda dura)
  const gr = g.createRadialGradient(0, 64, 4, 0, 64, 128); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); g.restore();
  return new THREE.CanvasTexture(c);
}
const CORES = [[0.62, 0.08, 0.1], [0.1, 0.22, 0.52], [0.86, 0.86, 0.88], [0.09, 0.09, 0.1], [0.45, 0.47, 0.5], [0.14, 0.36, 0.25], [0.82, 0.62, 0.16], [0.36, 0.12, 0.4], [0.95, 0.95, 0.95], [0.7, 0.72, 0.75]];

// ---------- caminho de um carro: trechos retos entre cruzamentos e curvas de Bézier neles ----------
// direção d ∈ {(1,0),(-1,0),(0,1),(0,-1)}; direita (mão) = (-dz, dx)
function pontoFaixa(ki, kj, dx, dz, frac) {         // ponto na faixa do trecho que sai do nó (ki,kj) em d, a `frac` do caminho
  const ax = eixo(ki), az = eixo(kj), rx = -dz, rz = dx, L = CELL - 2 * T_ESQ;
  const s = T_ESQ + frac * L;
  return [ax + dx * s + rx * FAIXA, az + dz * s + rz * FAIXA];
}

export function criarTrafego(THREE, cena, { mobile = false, semente = 7 } = {}) {
  const NC = mobile ? 14 : 26, RAIO = mobile ? 120 : 180;
  let sd = semente >>> 0 || 1;
  const rnd = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };

  // desenho
  const matCarro = new THREE.MeshLambertMaterial({ vertexColors: true });
  const malha = new THREE.InstancedMesh(geoCarro(THREE), matCarro, NC);
  const matLuz = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const luzes = new THREE.InstancedMesh(geoLuzes(THREE), matLuz, NC);
  const tf = texFacho(THREE);
  const matFacho = new THREE.MeshBasicMaterial({ color: 0xfff1c8, map: tf, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const fachos = new THREE.InstancedMesh(geoFacho(THREE), matFacho, NC);
  for (const m of [malha, luzes, fachos]) { m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); cena.add(m); }
  const cor = new THREE.Color();
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), E = new THREE.Euler();

  // estado
  const carros = [];
  const ocupado = new Map();
  const jogadorVirt = { x: 0, z: 0, vx: 0, vz: 0 };

  function novoTrecho(c, ki, kj, dx, dz, frac) {
    c.ki = ki; c.kj = kj; c.dx = dx; c.dz = dz; c.modo = 'reto'; c.t = frac;
    const [x, z] = pontoFaixa(ki, kj, dx, dz, frac); c.x = x; c.z = z; c.h = Math.atan2(dz, dx);
  }
  function direcoesValidas(ki, kj, dx, dz) {           // no nó (ki,kj) chegando em d: para onde pode seguir
    const v = [];
    for (const [ex, ez] of [[dx, dz], [-dz, dx], [dz, -dx]]) {   // reto, esquerda, direita
      const ni = ki + ex, nj = kj + ez; if (ni < 0 || nj < 0 || ni > N || nj > N || arestaNoCampus(ki, kj, ni, nj)) continue; v.push([ex, ez]);
    }
    if (!v.length) v.push([-dx, -dz]);                               // beco (canto do mapa): retorno
    return v;
  }
  function comecarCurva(c) {
    const ni = c.ki + c.dx, nj = c.kj + c.dz;                       // o nó que chegou
    const ops = direcoesValidas(ni, nj, c.dx, c.dz);
    let k = 0; const r = rnd();
    if (ops.length > 1) k = r < 0.55 ? 0 : 1 + Math.floor(rnd() * (ops.length - 1));
    if (k >= ops.length) k = 0;
    const [ex, ez] = ops[k];
    const bx = eixo(ni), bz = eixo(nj), rx = -c.dz, rz = c.dx, r2x = -ez, r2z = ex;
    const p0 = [bx - c.dx * T_ESQ + rx * FAIXA, bz - c.dz * T_ESQ + rz * FAIXA];
    const p2 = [bx + ex * T_ESQ + r2x * FAIXA, bz + ez * T_ESQ + r2z * FAIXA];
    let p1;
    if (ex === c.dx && ez === c.dz) p1 = [(p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2];
    else if (ex === -c.dx && ez === -c.dz) p1 = [bx + c.dx * 6 + rx * 0, bz + c.dz * 6];        // retorno: laço largo
    else p1 = [bx + rx * FAIXA + r2x * FAIXA, bz + rz * FAIXA + r2z * FAIXA];
    // comprimento aproximado
    let L = 0, px = p0[0], pz = p0[1];
    for (let i = 1; i <= 8; i++) { const t = i / 8, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, cc = t * t; const qx = a * p0[0] + b * p1[0] + cc * p2[0], qz = a * p0[1] + b * p1[1] + cc * p2[1]; L += Math.hypot(qx - px, qz - pz); px = qx; pz = qz; }
    c.modo = 'curva'; c.t = 0; c.bz = [p0, p1, p2]; c.L = Math.max(1, L); c.prox = [ni, nj, ex, ez]; c.no = ni * 1000 + nj; c.entrada = c.dx * 3 + c.dz;
  }
  function avancar(c, ds) {
    if (c.modo === 'reto') {
      c.t += ds / (CELL - 2 * T_ESQ);
      if (c.t >= 1) {
        // só entra no cruzamento se ninguém de outra direção estiver dentro dele (reserva no momento de entrar)
        const no = (c.ki + c.dx) * 1000 + (c.kj + c.dz), ent = c.dx * 3 + c.dz, l = ocupado.get(no);
        if (l && l.some((o) => o !== c && o.modo === 'curva' && o.no === no && o.entrada !== ent)) { c.t = 1; c.v = 0; const [x, z] = pontoFaixa(c.ki, c.kj, c.dx, c.dz, 1); c.x = x; c.z = z; return; }
        const sobra = (c.t - 1) * (CELL - 2 * T_ESQ); comecarCurva(c);
        if (l) l.push(c); else ocupado.set(c.no, [c]);
        avancar(c, sobra); return;
      }
      const [x, z] = pontoFaixa(c.ki, c.kj, c.dx, c.dz, c.t); c.x = x; c.z = z; c.h = Math.atan2(c.dz, c.dx);
    } else {
      const [p0, p1, p2] = c.bz;
      const vel = (t) => Math.hypot(2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]), 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1])) || 1;
      let resto = ds;
      for (let k = 0; k < 4 && resto > 1e-6; k++) {           // passos curtos: dt = ds / |B'(t)|
        const passo = Math.min(resto, 0.25), dtc = passo / vel(c.t);
        if (c.t + dtc >= 1) { const usado = (1 - c.t) * vel(c.t); const [ni, nj, ex, ez] = c.prox; novoTrecho(c, ni, nj, ex, ez, 0); avancar(c, Math.max(0, resto - usado)); return; }
        c.t += dtc; resto -= passo;
      }
      if (resto > 1e-6) c.t = Math.min(0.999, c.t + resto / vel(c.t));
      const t = c.t, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, cc = t * t;
      c.x = a * p0[0] + b * p1[0] + cc * p2[0]; c.z = a * p0[1] + b * p1[1] + cc * p2[1];
      const tx = 2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]), tz = 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
      if (tx * tx + tz * tz > 1e-8) c.h = Math.atan2(tz, tx);
    }
  }
  // nasce num trecho com o meio a [rMin, rMax] do jogador, de preferência atrás dele e longe de outros carros
  function nascer(c, j, rMin, rMax, atras) {
    const vj = Math.hypot(j.vx, j.vz), fx = vj > 1 ? j.vx / vj : 0, fz = vj > 1 ? j.vz / vj : 0;
    for (let tent = 0; tent < 40; tent++) {
      const ang = rnd() * Math.PI * 2, rr = rMin + rnd() * (rMax - rMin);
      const x = j.x + Math.cos(ang) * rr, z = j.z + Math.sin(ang) * rr;
      if (atras && vj > 1 && tent < 30 && (Math.cos(ang) * fx + Math.sin(ang) * fz) > -0.2) continue;
      // trecho mais perto desse ponto: escolhe eixo vertical ou horizontal
      const horiz = rnd() < 0.5;
      let ki, kj, dx, dz;
      if (horiz) { kj = noDe(z); ki = Math.floor((x + MEIO) / CELL); dx = rnd() < 0.5 ? 1 : -1; dz = 0; if (dx < 0) ki += 1; }
      else { ki = noDe(x); kj = Math.floor((z + MEIO) / CELL); dz = rnd() < 0.5 ? 1 : -1; dx = 0; if (dz < 0) kj += 1; }
      const ni = ki + dx, nj = kj + dz;
      if (ki < 0 || kj < 0 || ki > N || kj > N || ni < 0 || nj < 0 || ni > N || nj > N || arestaNoCampus(ki, kj, ni, nj)) continue;
      const frac = 0.1 + rnd() * 0.8;
      const [px, pz] = pontoFaixa(ki, kj, dx, dz, frac);
      if (Math.hypot(px - j.x, pz - j.z) < rMin) continue;
      if (carros.some((o) => o !== c && o.vivo && Math.hypot(o.x - px, o.z - pz) < 14)) continue;
      novoTrecho(c, ki, kj, dx, dz, frac); c.vivo = true; c.renasceu = true;
      c.v = c.vAlvo = VMIN + rnd() * (VMAX - VMIN); c.susto = 0; c.tremor = 0;
      return true;
    }
    return false;
  }

  for (let i = 0; i < NC; i++) {
    const c = { x: 0, z: 0, h: 0, v: 0, vAlvo: 10, vivo: false, susto: 0, tremor: 0, renasceu: false, cor: CORES[i % CORES.length] };
    carros.push(c);
    cor.setRGB(c.cor[0], c.cor[1], c.cor[2]); malha.setColorAt(i, cor);
  }
  malha.instanceColor.needsUpdate = true;
  let iniciado = false;

  function atualizar(dt, jogador = jogadorVirt, noite = 0, pessoas = null) {
    dt = Math.min(dt, 0.1);
    if (!iniciado) { iniciado = true; for (const c of carros) nascer(c, jogador, 20, RAIO, false); }
    const vj = Math.hypot(jogador.vx, jogador.vz);
    ocupado.clear();                                             // nó → carros que estão fazendo a curva nele
    for (const c of carros) if (c.vivo && c.modo === 'curva') { const l = ocupado.get(c.no); if (l) l.push(c); else ocupado.set(c.no, [c]); }
    for (const c of carros) {
      c.renasceu = false;
      if (!c.vivo || Math.hypot(c.x - jogador.x, c.z - jogador.z) > RAIO + 25) { nascer(c, jogador, RAIO * 0.6, RAIO, true); continue; }
      // velocidade alvo: carro da frente, pedestre na frente, susto com o herói
      const fx = Math.cos(c.h), fz = Math.sin(c.h);
      let alvo = c.vAlvo;
      for (const o of carros) {
        if (o === c || !o.vivo) continue;
        const ox = o.x - c.x, oz = o.z - c.z, fr = ox * fx + oz * fz;
        if (fr <= 0 || fr > 20) continue;
        const lat = Math.abs(-ox * fz + oz * fx);
        if (lat > 1.9) continue;
        const folga = fr - GAP;
        alvo = Math.min(alvo, folga <= 0 ? 0 : Math.min(o.v + folga * 0.9, alvo));
      }
      if (pessoas) for (const p of pessoas) {
        const ox = p.x - c.x, oz = p.z - c.z, fr = ox * fx + oz * fz;
        if (fr <= 0 || fr > 11) continue;
        if (Math.abs(-ox * fz + oz * fx) > 1.8) continue;
        alvo = Math.min(alvo, Math.max(0, (fr - 4) * 1.2));
      }
      if (c.modo === 'reto') {                                  // perto da esquina: cruzamento ocupado por quem vem de outra direção → para antes
        const rest = (1 - c.t) * (CELL - 2 * T_ESQ), no = (c.ki + c.dx) * 1000 + (c.kj + c.dz), ent = c.dx * 3 + c.dz;
        const l = rest < 14 ? ocupado.get(no) : null;
        if (l && l.some((o) => o.entrada !== ent)) alvo = Math.min(alvo, Math.max(0, (rest - 1) * 1.4));
      }
      const dj = Math.hypot(jogador.x - c.x, jogador.z - c.z);
      if (dj < 3 && vj > 25 && c.susto <= 0) { c.susto = 0.9; c.tremor = 1; }
      if (c.susto > 0) { c.susto -= dt; alvo = Math.min(alvo, c.vAlvo * 0.25); }
      c.tremor = Math.max(0, c.tremor - dt * 1.6);
      const acel = alvo < c.v ? 9 : 2.5;
      c.v += Math.sign(alvo - c.v) * Math.min(Math.abs(alvo - c.v), acel * dt);
      avancar(c, c.v * dt);
    }
    // desenho
    const lit = 0.45 + 0.55 * noite;
    matLuz.color.setRGB(lit, lit, lit);
    matFacho.opacity = 0.28 * noite;
    const t = performance.now() / 1000;
    carros.forEach((c, i) => {
      const tr = c.tremor;
      E.set(tr * 0.06 * Math.sin(t * 40 + i), -c.h, tr * 0.05 * Math.sin(t * 31 + i) - (c.susto > 0 ? 0.04 : 0), 'YXZ');
      Q.setFromEuler(E); P.set(c.x, 0, c.z); M.compose(P, Q, S);
      malha.setMatrixAt(i, M); luzes.setMatrixAt(i, M); fachos.setMatrixAt(i, M);
    });
    malha.instanceMatrix.needsUpdate = luzes.instanceMatrix.needsUpdate = fachos.instanceMatrix.needsUpdate = true;
  }

  function dispose() {
    for (const m of [malha, luzes, fachos]) { cena.remove(m); m.geometry.dispose(); m.dispose(); }
    matCarro.dispose(); matLuz.dispose(); matFacho.dispose(); tf?.dispose();
  }
  return { atualizar, carros, dispose, malhas: [malha, luzes, fachos], RAIO };
}
