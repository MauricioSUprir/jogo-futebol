// Pedestres da cidade: pessoas andando nas calçadas (em volta dos quarteirões, nos dois sentidos), virando nas esquinas e
// às vezes atravessando a rua na faixa de pedestre. Só existem num raio do jogador; quem sai renasce longe, de preferência
// atrás dele. Reagem ao herói: com ele passando rápido perto, giram com o vento ou caem sentadas e levantam; com ele
// parado perto, param e olham. Desenho: UMA InstancedMesh; a caminhada (pernas e braços), a queda e as roupas de cada um
// vêm do shader (atributos por instância), então o custo de CPU por pessoa é só a posição e 3 números.
// THREE é passado por parâmetro; a lógica não usa DOM.
import { CELL, N, BLOCO, CALCADA, centroDe, celulaDe, dentro, LAB_CELULA } from './cidade.js';

const MEIA = BLOCO / 2;
const SX = [-1, 1, 1, -1], SZ = [-1, -1, 1, 1];     // cantos do quarteirão em sentido anti-horário (vistos de cima)
const ESPELHO_X = [1, 0, 3, 2], ESPELHO_Z = [3, 2, 1, 0];

const PELES = [[0.96, 0.8, 0.66], [0.87, 0.67, 0.5], [0.72, 0.52, 0.36], [0.55, 0.38, 0.25], [0.4, 0.27, 0.18], [0.3, 0.2, 0.14]];
const CAMISAS = [[0.75, 0.12, 0.12], [0.12, 0.3, 0.62], [0.92, 0.92, 0.9], [0.1, 0.1, 0.12], [0.2, 0.5, 0.3], [0.85, 0.65, 0.2], [0.45, 0.2, 0.5], [0.55, 0.58, 0.62], [0.95, 0.5, 0.15], [0.3, 0.65, 0.75]];
const CALCAS = [[0.12, 0.17, 0.3], [0.08, 0.08, 0.09], [0.35, 0.3, 0.24], [0.5, 0.52, 0.55], [0.22, 0.28, 0.42], [0.6, 0.5, 0.35]];
const CABELOS = [[0.06, 0.05, 0.04], [0.2, 0.12, 0.06], [0.42, 0.28, 0.14], [0.7, 0.55, 0.3], [0.55, 0.55, 0.55], [0.12, 0.08, 0.06]];

// ---------- geometria de uma pessoa (frente em +x, lado em z): parte 0 corpo, 1/2 pernas E/D, 3/4 braços E/D;
// região 0 pele, 1 camisa, 2 calça, 3 sapato, 4 cabelo ----------
function geoPessoa(THREE) {
  const pecas = [];
  const box = (w, h, d, x, y, z, parte, reg) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); pecas.push([g, parte, reg]); };
  const bola = (r, sx, sy, sz, x, y, z, parte, reg) => { const g = new THREE.IcosahedronGeometry(r, 1); g.scale(sx, sy, sz); g.translate(x, y, z); pecas.push([g, parte, reg]); };
  for (const [lado, parte] of [[-1, 1], [1, 2]]) {
    box(0.15, 0.8, 0.15, 0, 0.48, lado * 0.1, parte, 2);          // perna (calça)
    box(0.27, 0.09, 0.14, 0.05, 0.045, lado * 0.1, parte, 3);     // sapato
  }
  box(0.22, 0.14, 0.36, 0, 0.92, 0, 0, 2);                        // quadril
  box(0.24, 0.56, 0.4, 0, 1.2, 0, 0, 1);                          // tronco
  box(0.09, 0.08, 0.09, 0, 1.51, 0, 0, 0);                        // pescoço
  bola(0.112, 1, 1.12, 0.95, 0.01, 1.64, 0, 0, 0);                // cabeça
  bola(0.12, 1.02, 0.72, 1.0, -0.02, 1.69, 0, 0, 4);              // cabelo
  for (const [lado, parte] of [[-1, 3], [1, 4]]) {
    box(0.11, 0.3, 0.11, 0, 1.3, lado * 0.26, parte, 1);          // braço (manga)
    box(0.09, 0.34, 0.09, 0.01, 0.98, lado * 0.26, parte, 0);     // antebraço e mão
  }
  let n = 0; const ngs = pecas.map(([g, p, r]) => { const ng = g.index ? g.toNonIndexed() : g; n += ng.attributes.position.count; return [ng, p, r]; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), parte = new Float32Array(n), reg = new Float32Array(n);
  let o = 0;
  for (const [g, p, r] of ngs) { const c = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); parte.fill(p, o, o + c); reg.fill(r, o, o + c); o += c; g.dispose(); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('aParte', new THREE.BufferAttribute(parte, 1)); g.setAttribute('aReg', new THREE.BufferAttribute(reg, 1));
  g.computeBoundingSphere();
  return g;
}

const VERT_DECL = `
attribute float aParte; attribute float aReg;
attribute vec3 iPel; attribute vec3 iCam; attribute vec3 iCal; attribute vec3 iCab; attribute vec3 iAnim;
varying vec3 vCorP;
float anguloParte() {
  float s = sin(iAnim.x), amp = iAnim.y, q = iAnim.z;
  if (aParte > 0.5 && aParte < 1.5) return mix(amp * s, 1.45, q);
  if (aParte > 1.5 && aParte < 2.5) return mix(-amp * s, 1.45, q);
  if (aParte > 2.5 && aParte < 3.5) return mix(-0.9 * amp * s, -0.55, q);
  if (aParte > 3.5) return mix(0.9 * amp * s, -0.55, q);
  return 0.0;
}
float pivoParte() { return aParte > 2.5 ? 1.44 : 0.88; }
vec2 girar(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(v.x * c - v.y * s, v.x * s + v.y * c); }
`;

export function criarPedestres(THREE, cena, { mobile = false, semente = 11 } = {}) {
  const NP = mobile ? 30 : 60, RAIO = 120;
  let sd = semente >>> 0 || 1;
  const rnd = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
  const pick = (v) => v[Math.floor(rnd() * v.length)];

  const geo = geoPessoa(THREE);
  const atr = (nome) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(NP * 3), 3); geo.setAttribute(nome, a); return a; };
  const aPel = atr('iPel'), aCam = atr('iCam'), aCal = atr('iCal'), aCab = atr('iCab'), aAnim = atr('iAnim');
  aAnim.setUsage(THREE.DynamicDrawUsage);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_DECL)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        { float a = anguloParte(); objectNormal.xy = girar(objectNormal.xy, a); if (aParte < 0.5 || aParte > 2.5) objectNormal.xy = girar(objectNormal.xy, -0.3 * iAnim.z); }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { float a = anguloParte(), py = pivoParte();
          vec2 v = transformed.xy - vec2(0.0, py); transformed.xy = girar(v, a) + vec2(0.0, py);
          if (aParte < 0.5 || aParte > 2.5) { vec2 w = transformed.xy - vec2(0.0, 0.88); transformed.xy = girar(w, -0.3 * iAnim.z) + vec2(0.0, 0.88); }
          transformed.y -= 0.4 * iAnim.z;
          vCorP = aReg < 0.5 ? iPel : aReg < 1.5 ? iCam : aReg < 2.5 ? iCal : aReg < 3.5 ? vec3(0.07, 0.06, 0.06) : iCab; }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCorP;')
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse * vCorP, opacity );');
  };
  const malha = new THREE.InstancedMesh(geo, mat, NP);
  malha.frustumCulled = false; malha.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cena.add(malha);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), E = new THREE.Euler();

  const pessoas = [];
  const jogVirt = { x: 0, z: 0, vx: 0, vz: 0 };
  const quarteiraoOk = (i, j) => dentro(i, j) && !(i === LAB_CELULA[0] && j === LAB_CELULA[1]);
  const canto = (p, k) => [centroDe(p.i) + SX[k] * (MEIA - p.o), centroDe(p.j) + SZ[k] * (MEIA - p.o)];

  function nascer(p, j, rMin, rMax, atras) {
    const vj = Math.hypot(j.vx, j.vz), fx = vj > 1 ? j.vx / vj : 0, fz = vj > 1 ? j.vz / vj : 0;
    for (let t = 0; t < 40; t++) {
      const ang = rnd() * Math.PI * 2, rr = rMin + rnd() * (rMax - rMin);
      if (atras && vj > 1 && t < 30 && Math.cos(ang) * fx + Math.sin(ang) * fz > -0.2) continue;
      const x = j.x + Math.cos(ang) * rr, z = j.z + Math.sin(ang) * rr, i = celulaDe(x), jj = celulaDe(z);
      if (!quarteiraoOk(i, jj)) continue;
      p.i = i; p.j = jj; p.o = 1.0 + rnd() * 0.8; p.s = rnd() < 0.5 ? 1 : -1; p.c = Math.floor(rnd() * 4);
      const ant = (p.c - p.s + 4) % 4, [ax, az] = canto(p, ant), [bx, bz] = canto(p, p.c), f = rnd();
      p.x = ax + (bx - ax) * f; p.z = az + (bz - az) * f;
      if (Math.hypot(p.x - j.x, p.z - j.z) < rMin * 0.8) continue;
      p.estado = 'anda'; p.v = 1.1 + rnd() * 0.5; p.vivo = true; p.queda = 0; p.tq = 0; p.giro = 0; p.vg = 0; p.incl = 0; p.alvo = null;
      return true;
    }
    return false;
  }
  for (let k = 0; k < NP; k++) {
    const p = { x: 0, z: 0, h: 0, estado: 'anda', vivo: false, fase: rnd() * 6.28, i: 0, j: 0, o: 1.2, s: 1, c: 0, v: 1.3, queda: 0, tq: 0, giro: 0, vg: 0, incl: 0, alvo: null };
    pessoas.push(p);
    aPel.setXYZ(k, ...pick(PELES)); aCam.setXYZ(k, ...pick(CAMISAS)); aCal.setXYZ(k, ...pick(CALCAS)); aCab.setXYZ(k, ...pick(CABELOS));
  }
  let iniciado = false;

  function proximoAlvo(p) {
    if (p.estado === 'cruza') { p.i = p.ni; p.j = p.nj; p.c = (p.nc + p.s + 4) % 4; p.estado = 'anda'; return; }
    // chegou ao canto p.c: atravessa em frente (às vezes) ou segue em volta do quarteirão
    const ant = (p.c - p.s + 4) % 4, [ax, az] = canto(p, ant), [bx, bz] = canto(p, p.c);
    const dx = Math.sign(Math.round(bx - ax)), dz = Math.sign(Math.round(bz - az));
    const ni = p.i + dx, nj = p.j + dz;
    if (rnd() < 0.3 && quarteiraoOk(ni, nj)) {
      p.estado = 'cruza'; p.ni = ni; p.nj = nj; p.nc = dx !== 0 ? ESPELHO_X[p.c] : ESPELHO_Z[p.c];
      p.alvo = [centroDe(ni) + SX[p.nc] * (MEIA - p.o), centroDe(nj) + SZ[p.nc] * (MEIA - p.o)];
      return;
    }
    if (rnd() < 0.06) { p.s = -p.s; p.c = ant; return; }      // muda de ideia e volta
    p.c = (p.c + p.s + 4) % 4;
  }

  function atualizar(dt, jogador = jogVirt, noite = 0) {
    dt = Math.min(dt, 0.1);
    if (!iniciado) { iniciado = true; for (const p of pessoas) nascer(p, jogador, 6, RAIO, false); }
    const vj = Math.hypot(jogador.vx, jogador.vz);
    pessoas.forEach((p, k) => {
      if (!p.vivo || Math.hypot(p.x - jogador.x, p.z - jogador.z) > RAIO + 15) { nascer(p, jogador, RAIO * 0.6, RAIO, true); }
      const dxj = jogador.x - p.x, dzj = jogador.z - p.z, dj = Math.hypot(dxj, dzj);
      // reações ao herói
      if (dj < 4 && vj > 20 && p.estado !== 'caido' && p.estado !== 'vento') {
        if (rnd() < 0.35) { p.estado = 'caido'; p.tq = 0; } else { p.estado = 'vento'; p.tq = 1.3; p.vg = (rnd() < 0.5 ? -1 : 1) * (5 + rnd() * 4); p.incl = (rnd() < 0.5 ? -1 : 1) * 0.3; }
      }
      let anda = 1;
      if (p.estado === 'caido') {
        p.tq += dt; anda = 0;
        p.queda = p.tq < 0.3 ? p.tq / 0.3 : p.tq < 2.3 ? 1 : Math.max(0, 1 - (p.tq - 2.3) / 0.6);
        if (p.tq > 2.9) { p.queda = 0; p.estado = p.cruzando ? 'cruza' : 'anda'; }
      } else if (p.estado === 'vento') {
        p.tq -= dt; anda = 0.4; p.giro += p.vg * dt; p.vg *= Math.exp(-2.2 * dt); p.incl *= Math.exp(-2.5 * dt);
        if (p.tq <= 0) { p.estado = p.cruzando ? 'cruza' : 'anda'; p.incl = 0; }
      } else if (vj < 1 && dj < 6 && p.estado !== 'cruza') {
        p.olhando = true; anda = 0;
        const alvoH = Math.atan2(dzj, dxj); let d = alvoH - p.h; d = Math.atan2(Math.sin(d), Math.cos(d)); p.h += d * (1 - Math.exp(-4 * dt));
      } else p.olhando = false;
      p.giro *= p.estado === 'vento' ? 1 : Math.exp(-3 * dt);
      p.cruzando = p.estado === 'cruza' || (p.estado !== 'anda' && p.cruzando);
      // caminhada até o alvo
      if (anda > 0) {
        const alvo = (p.estado === 'cruza' || p.cruzando) && p.alvo ? p.alvo : canto(p, p.c);
        const ax = alvo[0] - p.x, az = alvo[1] - p.z, d = Math.hypot(ax, az), passo = p.v * anda * dt;
        if (d <= passo + 1e-4) { p.x = alvo[0]; p.z = alvo[1]; if (p.estado === 'anda' || p.estado === 'cruza') proximoAlvo(p); }
        else { p.x += (ax / d) * passo; p.z += (az / d) * passo; const alvoH = Math.atan2(az, ax); let dh = alvoH - p.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); p.h += dh * (1 - Math.exp(-10 * dt)); }
        p.fase += dt * p.v * anda * 4.2;
      }
      const amp = p.olhando || p.estado === 'caido' ? 0 : 0.42 * anda;
      aAnim.setXYZ(k, p.fase, amp, p.queda);
      // altura: em cima da laje (calçada) ou no asfalto (atravessando)
      const ci = celulaDe(p.x), cj = celulaDe(p.z), naLaje = Math.abs(p.x - centroDe(ci)) <= MEIA && Math.abs(p.z - centroDe(cj)) <= MEIA;
      E.set(p.incl * Math.sin(p.giro * 2), -(p.h + p.giro), p.incl, 'YXZ'); Q.setFromEuler(E);
      P.set(p.x, naLaje ? CALCADA : 0, p.z); M.compose(P, Q, S); malha.setMatrixAt(k, M);
    });
    aAnim.needsUpdate = true; malha.instanceMatrix.needsUpdate = true;
  }
  aPel.needsUpdate = aCam.needsUpdate = aCal.needsUpdate = aCab.needsUpdate = true;

  function dispose() { cena.remove(malha); geo.dispose(); mat.dispose(); malha.dispose(); }
  return { atualizar, pessoas, dispose, malha, RAIO };
}
