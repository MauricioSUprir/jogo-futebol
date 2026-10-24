// Crimes pela cidade: assalto (ladrão fugindo a pé), carro em fuga, incêndio (apagar correndo em volta: vórtice) e
// pessoa caindo de um prédio (chegar embaixo a tempo) e gangue (bandidos na rua: derrotar todos no BATER e nos golpes
// especiais, ver combate.js). Um crime por vez; o próximo nasce a 150–380 m do herói.
import * as THREE from 'three';
import { CELL, N, MEIO, CALCADA, bloco, celulaDe, dentro } from './cidade.js';

const TIPOS = {
  assalto: { nome: 'Assalto', texto: 'Alcance o ladrão em fuga', tempo: 75 },
  fuga: { nome: 'Carro em fuga', texto: 'Alcance o carro e pare-o', tempo: 90 },
  incendio: { nome: 'Incêndio', texto: 'Corra em volta do prédio para apagar o fogo', tempo: 90 },
  queda: { nome: 'Pessoa caindo', texto: 'Chegue embaixo antes que ela caia', tempo: 12 },
  gangue: { nome: 'Gangue', texto: 'Derrote os bandidos', tempo: 150 },
};
const SORTEIO = ['assalto', 'fuga', 'incendio', 'queda', 'gangue', 'gangue'];     // a gangue sai com mais frequência
export const NOMES_CRIME = Object.fromEntries(Object.entries(TIPOS).map(([k, v]) => [k, v.nome]));

const eixo = (k) => k * CELL - MEIO;                          // eixo da k-ésima rua
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (v) => v[Math.floor(Math.random() * v.length)];

// ---------- peças visuais ----------
function pessoa(corRoupa, corCalca, corPele = 0xd7a684) {
  const g = new THREE.Group(), m = (c) => new THREE.MeshLambertMaterial({ color: c });
  const corpo = new THREE.Group(); g.add(corpo);
  const tronco = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.45, 3, 8), m(corRoupa)); tronco.position.y = 1.2; corpo.add(tronco);
  const cab = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), m(corPele)); cab.position.y = 1.68; corpo.add(cab);
  const membro = (x, y, comp, r, c) => { const p = new THREE.Group(); p.position.set(x, y, 0); const s = new THREE.Mesh(new THREE.CapsuleGeometry(r, comp, 3, 6), m(c)); s.position.y = -comp / 2 - r / 2; p.add(s); corpo.add(p); return p; };
  g.userData = { corpo, pE: membro(-0.1, 0.92, 0.62, 0.08, corCalca), pD: membro(0.1, 0.92, 0.62, 0.08, corCalca), bE: membro(-0.27, 1.45, 0.5, 0.06, corRoupa), bD: membro(0.27, 1.45, 0.5, 0.06, corRoupa), fase: 0 };
  return g;
}
function animarPessoa(g, dt, v, caindo = 0) {
  const u = g.userData; u.fase += dt * (2 + v * 1.1);
  const a = Math.min(1, v / 6) * 0.9, s = Math.sin(u.fase);
  u.pE.rotation.x = s * a; u.pD.rotation.x = -s * a; u.bE.rotation.x = -s * a; u.bD.rotation.x = s * a;
  u.corpo.rotation.x = Math.min(0.35, v * 0.04);
  if (caindo) { u.bE.rotation.z = 2.6 + Math.sin(u.fase * 3) * 0.3; u.bD.rotation.z = -2.6 - Math.sin(u.fase * 3) * 0.3; u.pE.rotation.x = 0.4 + s * 0.4; u.pD.rotation.x = -0.4 - s * 0.4; }
  else { u.bE.rotation.z = u.bD.rotation.z = 0; }
}
function carroFuga() {
  const g = new THREE.Group(), m = (c, e = 0) => new THREE.MeshLambertMaterial({ color: c, emissive: e });
  const c1 = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.75, 4.4), m(0x18181c)); c1.position.y = 0.65; g.add(c1);
  const c2 = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.3), m(0x0b1018)); c2.position.set(0, 1.25, -0.2); g.add(c2);
  for (const [x, z] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10), m(0x050505)); r.rotation.z = Math.PI / 2; r.position.set(x, 0.36, z); g.add(r); }
  const pisca = [m(0xff2222, 0xff0000), m(0xffaa00, 0xff8800)];
  for (const [x, k] of [[-0.6, 0], [0.6, 1]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.06), pisca[k]); l.position.set(x, 0.75, -2.22); g.add(l); }
  g.userData = { pisca };
  return g;
}
function texFogo() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
function fogo(tex) {
  const n = 140, pos = new Float32Array(n * 3), vida = new Float32Array(n), base = new Float32Array(n * 3);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const chamas = new THREE.Points(geo, new THREE.PointsMaterial({ map: tex, color: 0xff7a1a, size: 2.4, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const nf = 70, posF = new Float32Array(nf * 3), vidaF = new Float32Array(nf);
  const geoF = new THREE.BufferGeometry(); geoF.setAttribute('position', new THREE.BufferAttribute(posF, 3));
  const fumaca = new THREE.Points(geoF, new THREE.PointsMaterial({ map: tex, color: 0x2a2a2e, size: 7, transparent: true, opacity: 0.55, depthWrite: false }));
  chamas.frustumCulled = fumaca.frustumCulled = false;
  const g = new THREE.Group(); g.add(chamas, fumaca);
  g.userData = { pos, vida, base, posF, vidaF, geo, geoF, n, nf, chamas, fumaca };
  return g;
}

// ---------- caminhante na grade de ruas ----------
function novoCaminho(x, z) { return { kx: Math.round((x + MEIO) / CELL), kz: Math.round((z + MEIO) / CELL), dir: Math.floor(Math.random() * 4), t: 0 }; }
function escolherDir(c, fugirDe) {
  const ops = [];
  for (let d = 0; d < 4; d++) {
    if (d === (c.dir + 2) % 4) continue;                     // não dá meia-volta
    const nx = c.kx + DIRS[d][0], nz = c.kz + DIRS[d][1];
    if (nx < 2 || nz < 2 || nx > N - 2 || nz > N - 2) continue;
    const dist = fugirDe ? Math.hypot(eixo(nx) - fugirDe.x, eixo(nz) - fugirDe.z) : 0;
    ops.push([d, dist + Math.random() * 60]);
  }
  if (!ops.length) return (c.dir + 2) % 4;
  ops.sort((a, b) => b[1] - a[1]); return ops[0][0];
}
// anda `dist` metros pela grade, numa faixa deslocada `faixa` m do eixo (mão direita); devolve {x, z, h}
function andarGrade(c, dist, faixa, fugirDe) {
  c.t += dist / CELL;
  while (c.t >= 1) { c.t -= 1; c.kx += DIRS[c.dir][0]; c.kz += DIRS[c.dir][1]; c.dir = escolherDir(c, fugirDe); }
  const [dx, dz] = DIRS[c.dir];
  const x = eixo(c.kx) + dx * c.t * CELL - dz * faixa, z = eixo(c.kz) + dz * c.t * CELL + dx * faixa;
  return { x, z, h: Math.atan2(dx, dz) };
}

/** Gerente de crimes. Devolve {atualizar(dt, P, opc) → evento|null, ativo, marcador(), forcar(tipo), dispose()}. */
export function criarCrimes(cena, { combate = null } = {}) {
  const tex = texFogo();
  const coluna = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 140, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xff2b3d, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  coluna.geometry.translate(0, 70, 0); coluna.visible = false; cena.add(coluna);
  let ativo = null, espera = 25, forcado = null;

  function lugarLonge(P, min = 150, max = 380) {
    for (let k = 0; k < 40; k++) {
      const a = Math.random() * Math.PI * 2, r = rnd(min, max);
      const kx = Math.round((P.x + Math.cos(a) * r + MEIO) / CELL), kz = Math.round((P.z + Math.sin(a) * r + MEIO) / CELL);
      if (kx >= 3 && kz >= 3 && kx <= N - 3 && kz <= N - 3) return { kx, kz, x: eixo(kx), z: eixo(kz) };
    }
    return { kx: N / 2 + 3, kz: N / 2 + 3, x: eixo(N / 2 + 3), z: eixo(N / 2 + 3) };
  }
  function predioPerto(x, z, minH, maxH = 999) {
    const ci = celulaDe(x), cj = celulaDe(z); let melhor = null;
    for (let i = ci - 2; i <= ci + 2; i++) for (let j = cj - 2; j <= cj + 2; j++) {
      if (!dentro(i, j)) continue; const b = bloco(i, j); if (b.tipo === 'lab') continue;
      for (const l of b.lotes) if (l.y0 <= CALCADA + 0.01 && l.y1 >= minH && l.y1 <= maxH && (!melhor || l.y1 > melhor.y1)) melhor = l;
    }
    return melhor;
  }

  function iniciar(tipo, P) {
    const lugar = lugarLonge(P), c = { tipo, ...TIPOS[tipo], restante: TIPOS[tipo].tempo, grupo: new THREE.Group() };
    if (tipo === 'assalto') {
      c.cam = novoCaminho(lugar.x, lugar.z); c.npc = pessoa(0x222222, 0x1b2a44); c.grupo.add(c.npc); c.v = 9.5;
      const p = andarGrade(c.cam, 0, 4, P); c.x = p.x; c.z = p.z;
    } else if (tipo === 'fuga') {
      c.cam = novoCaminho(lugar.x, lugar.z); c.npc = carroFuga(); c.grupo.add(c.npc); c.v = 27;
      const p = andarGrade(c.cam, 0, 2.2, P); c.x = p.x; c.z = p.z;
    } else if (tipo === 'incendio') {
      const l = predioPerto(lugar.x, lugar.z, 14) || predioPerto(lugar.x, lugar.z, 6);
      if (!l) return null;
      c.l = l; c.x = (l.x0 + l.x1) / 2; c.z = (l.z0 + l.z1) / 2; c.raio = Math.hypot(l.x1 - l.x0, l.z1 - l.z0) / 2;
      c.fogo = fogo(tex); c.fogo.position.set(c.x, l.y1 - 1, c.z); c.grupo.add(c.fogo); c.acum = 0; c.ang = null; c.meta = Math.PI * 2 * 3;
    } else if (tipo === 'gangue') {
      if (!combate) return null;
      c.x = lugar.x + rnd(-6, 6); c.z = lugar.z + rnd(-6, 6); c.total = 4 + Math.floor(Math.random() * 3);
      c.gangue = combate.gerarGangue(c.x, c.z, c.total);
    } else if (tipo === 'queda') {
      const l = predioPerto(lugar.x, lugar.z, 24, 70) || predioPerto(lugar.x, lugar.z, 14);
      if (!l) return null;
      // borda do telhado voltada para a rua mais perto
      const lado = pick([0, 1, 2, 3]), mx = (l.x0 + l.x1) / 2, mz = (l.z0 + l.z1) / 2;
      const [ox, oz] = lado === 0 ? [l.x1 + 1.6, mz] : lado === 1 ? [l.x0 - 1.6, mz] : lado === 2 ? [mx, l.z1 + 1.6] : [mx, l.z0 - 1.6];
      c.x = ox; c.z = oz; c.h0 = l.y1; c.y = l.y1; c.npc = pessoa(0x3a7bd5, 0x333333); c.grupo.add(c.npc); c.npc.position.set(ox, l.y1, oz);
      c.restante = 3 + l.y1 / 7;                                // queda lenta (cena de cinema): tempo para chegar
    }
    cena.add(c.grupo);
    return c;
  }
  function encerrar(ok) {
    const c = ativo; ativo = null; espera = forcado ? 12 : rnd(35, 60);
    setTimeout(() => cena.remove(c.grupo), ok ? 2500 : 0);
    if (c.gangue) combate.remover(c.gangue, ok ? 8 : 0.1);
    coluna.visible = false;
    return { tipo: c.tipo, nome: c.nome, ok };
  }

  function atualizar(dt, P, opc = {}) {
    if (opc.forcar && opc.forcar !== forcado) { forcado = opc.forcar; if (!ativo) espera = Math.min(espera, 10); }
    if (!opc.forcar) forcado = null;
    if (!ativo) {
      espera -= dt; if (espera > 0) return null;
      const tipo = forcado || pick(combate ? SORTEIO : SORTEIO.filter((t) => t !== 'gangue'));
      ativo = iniciar(tipo, P); if (!ativo) { espera = 5; return null; }
      return { inicio: true, tipo, nome: ativo.nome };
    }
    const c = ativo, vH = Math.hypot(P.vx, P.vz);
    c.restante -= dt;
    if (c.tipo === 'assalto' || c.tipo === 'fuga') {
      const perto = Math.hypot(P.x - c.x, P.z - c.z);
      const fuga = perto < 60 ? 1.25 : 1;                        // com o herói perto, acelera
      const p = andarGrade(c.cam, c.v * fuga * dt, c.tipo === 'fuga' ? 2.2 : 4, P);
      c.x = p.x; c.z = p.z; c.npc.position.set(c.x, 0, c.z); c.npc.rotation.y = p.h;
      if (c.tipo === 'assalto') animarPessoa(c.npc, dt, c.v * fuga);
      else { const lig = Math.floor(performance.now() / 250) % 2; c.npc.userData.pisca.forEach((m, k) => m.emissiveIntensity = (k === lig ? 1.5 : 0.2)); }
      if (perto < (c.tipo === 'fuga' ? 3.6 : 2.2) && (c.tipo === 'assalto' || vH > 12) && Math.abs(P.y - 0.15) < 3) {
        if (c.tipo === 'fuga') c.npc.rotation.y += 1.2; else { c.npc.rotation.x = -1.4; c.npc.position.y = 0.25; }
        return encerrar(true);
      }
    } else if (c.tipo === 'incendio') {
      const u = c.fogo.userData;
      for (let i = 0; i < u.n; i++) {
        u.vida[i] -= dt; if (u.vida[i] <= 0) { u.vida[i] = rnd(0.4, 1.1); u.pos[i * 3] = rnd(-c.raio * 0.6, c.raio * 0.6); u.pos[i * 3 + 1] = rnd(0, 1); u.pos[i * 3 + 2] = rnd(-c.raio * 0.6, c.raio * 0.6); }
        u.pos[i * 3 + 1] += dt * rnd(3, 6); u.pos[i * 3] *= 0.995; u.pos[i * 3 + 2] *= 0.995;
      }
      for (let i = 0; i < u.nf; i++) {
        u.vidaF[i] -= dt; if (u.vidaF[i] <= 0) { u.vidaF[i] = rnd(2, 4); u.posF[i * 3] = rnd(-c.raio * 0.4, c.raio * 0.4); u.posF[i * 3 + 1] = rnd(2, 4); u.posF[i * 3 + 2] = rnd(-c.raio * 0.4, c.raio * 0.4); }
        u.posF[i * 3 + 1] += dt * 4; u.posF[i * 3] += dt * 1.5;
      }
      u.geo.attributes.position.needsUpdate = true; u.geoF.attributes.position.needsUpdate = true;
      const f = 1 - c.acum / c.meta; u.chamas.material.size = 0.6 + 2.2 * f; u.fumaca.material.opacity = 0.15 + 0.4 * f;
      // vórtice: correr em volta do prédio, rápido, perto dele
      const dx = P.x - c.x, dz = P.z - c.z, r = Math.hypot(dx, dz), ang = Math.atan2(dz, dx);
      if (r < c.raio + 32 && r > c.raio * 0.5 && vH > 22) { if (c.ang !== null) { let d = ang - c.ang; d = Math.atan2(Math.sin(d), Math.cos(d)); c.acum += Math.abs(d); } c.ang = ang; }
      else c.ang = null;
      c.progresso = Math.min(1, c.acum / c.meta);
      if (c.acum >= c.meta) return encerrar(true);
    } else if (c.tipo === 'gangue') {
      const vivos = combate.vivos(c.gangue), ct = combate.centro(c.gangue);
      if (ct) { c.x = ct.x; c.z = ct.z; }
      c.progresso = 1 - vivos / c.total; c.restantes = vivos;
      if (vivos === 0) return encerrar(true);
    } else if (c.tipo === 'queda') {
      const total = 3 + c.h0 / 7, t = 1 - c.restante / total;
      c.y = Math.max(0, c.h0 * (1 - Math.min(1, t * t * 0.4 + t * 0.6))); c.npc.position.y = c.y;
      animarPessoa(c.npc, dt, 0, t > 0.15 ? 1 : 0);
      const d = Math.hypot(P.x - c.x, P.z - c.z), dy = Math.abs(P.y + 1 - c.y);
      if (t > 0.1 && d < 3 && dy < 3.5) { c.npc.position.set(P.x, P.y + 0.1, P.z); return encerrar(true); }
      if (c.y <= 0.01) return encerrar(false);
    }
    coluna.visible = false;          // o local agora é marcado pelo guia (guia.js)
    if (c.restante <= 0) return encerrar(false);
    return null;
  }
  return {
    atualizar,
    get ativo() { return ativo; },
    marcador: () => (ativo ? { x: ativo.x, z: ativo.z } : null),
    dispose() { if (ativo) cena.remove(ativo.grupo); cena.remove(coluna); },
  };
}
