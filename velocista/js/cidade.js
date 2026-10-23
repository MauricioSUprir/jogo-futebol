// Cidade de RELÂMPAGO: geração determinística por quarteirão. PURO (sem three.js nem DOM).
// Coordenadas: x e z no plano, y para cima. A cidade é uma grade N×N de células CELL×CELL;
// cada célula tem um quarteirão BLOCO×BLOCO no meio e meia rua (RUA/2) em cada borda.
export const CELL = 76;
export const RUA = 16;
export const BLOCO = CELL - RUA;       // 60
export const N = 30;                   // 30 × 76 m = 2,28 km de lado
export const MEIO = (N * CELL) / 2;
export const CALCADA = 0.3;            // altura do meio-fio
export const SEMENTE = 20261023;

const GAP = 3;                         // vielas entre prédios
const PROB_ESFERA = 0.1;

function hash(i, j, sal) {
  let h = (Math.imul(i + 1013, 374761393) ^ Math.imul(j + 7919, 668265263) ^ Math.imul(sal + SEMENTE, 2246822519)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
function mulberry(a) {
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const celulaDe = (v) => Math.floor((v + MEIO) / CELL);
export const centroDe = (i) => (i + 0.5) * CELL - MEIO;
export const dentro = (i, j) => i >= 0 && j >= 0 && i < N && j < N;

const cache = new Map();

/** Dados (puros) do quarteirão (i,j). */
export function bloco(i, j) {
  const chave = i * 1000 + j;
  if (cache.has(chave)) return cache.get(chave);
  const r = mulberry(hash(i, j, 1));
  const cx = centroDe(i), cz = centroDe(j);
  const d = Math.hypot(i - (N - 1) / 2, j - (N - 1) / 2);
  const centro = Math.exp(-d / 7);                       // 1 no centro, cai para a periferia
  const sorteio = r();
  const tipo = sorteio < 0.12 ? 'parque' : sorteio < 0.2 + centro * 0.12 ? 'torre' : 'predios';
  const b = { i, j, cx, cz, tipo, lotes: [], arvores: [], orbes: [], rects: [], topo: [], carros: [], postes: [] };
  b.rects.push({ x0: cx - BLOCO / 2, x1: cx + BLOCO / 2, z0: cz - BLOCO / 2, z1: cz + BLOCO / 2, y0: -5, y1: CALCADA });

  const interno = BLOCO - 4;
  const x0 = cx - interno / 2, z0 = cz - interno / 2;
  const add = (lote) => { b.lotes.push(lote); b.rects.push({ x0: lote.x0, x1: lote.x1, z0: lote.z0, z1: lote.z1, y0: lote.y0, y1: lote.y1 }); };

  if (tipo === 'parque') {
    const n = 22 + Math.floor(r() * 18);
    for (let k = 0; k < n; k++) b.arvores.push({ x: cx + (r() - 0.5) * (BLOCO - 6), z: cz + (r() - 0.5) * (BLOCO - 6), s: 0.8 + r() * 0.9 });
  } else if (tipo === 'torre') {
    const w = 22 + r() * 8, p = 22 + r() * 8;
    const h = 70 + r() * 70 + centro * 90;
    const lx = cx + (r() - 0.5) * 8, lz = cz + (r() - 0.5) * 8;
    add({ x0: lx - w / 2, x1: lx + w / 2, z0: lz - p / 2, z1: lz + p / 2, y0: CALCADA, y1: h, estilo: r() < 0.5 ? 0 : 2, tom: Math.floor(r() * 3) });
    // coroa menor no topo
    add({ x0: lx - w * 0.3, x1: lx + w * 0.3, z0: lz - p * 0.3, z1: lz + p * 0.3, y0: h, y1: h + 12 + r() * 14, estilo: 0, tom: Math.floor(r() * 3) });
    for (let k = 0; k < 10; k++) { const ax = cx + (r() - 0.5) * (BLOCO - 4), az = cz + (r() - 0.5) * (BLOCO - 4); if (ax < lx - w / 2 - 2 || ax > lx + w / 2 + 2 || az < lz - p / 2 - 2 || az > lz + p / 2 + 2) b.arvores.push({ x: ax, z: az, s: 0.6 + r() * 0.5 }); }
  } else {
    const nx = 1 + Math.floor(r() * 3), nz = 1 + Math.floor(r() * 2);
    const w = (interno - GAP * (nx - 1)) / nx, p = (interno - GAP * (nz - 1)) / nz;
    for (let a = 0; a < nx; a++) for (let c = 0; c < nz; c++) {
      if (r() < 0.12) continue;                                // praça no lugar do prédio
      const base = 10 + r() * 22;
      const h = base + centro * r() * 100;
      const lx0 = x0 + a * (w + GAP), lz0 = z0 + c * (p + GAP);
      const estilo = Math.floor(r() * 6), tom = Math.floor(r() * 3);
      add({ x0: lx0, x1: lx0 + w, z0: lz0, z1: lz0 + p, y0: CALCADA, y1: h, estilo, tom });
      if (h > 34 && r() < 0.45) {                               // recuo: torre menor em cima do pódio
        const m = 0.2 + r() * 0.15;
        add({ x0: lx0 + w * m, x1: lx0 + w * (1 - m), z0: lz0 + p * m, z1: lz0 + p * (1 - m), y0: h, y1: h + h * (0.3 + r() * 0.5), estilo, tom });
      }
    }
    if (nx * nz < 3 || r() < 0.4) for (let k = 0; k < 4; k++) { const ax = cx + (r() - 0.5) * (BLOCO - 4), az = cz + (r() - 0.5) * (BLOCO - 4); if (!b.rects.some((q, idx) => idx > 0 && ax > q.x0 - 1.5 && ax < q.x1 + 1.5 && az > q.z0 - 1.5 && az < q.z1 + 1.5)) b.arvores.push({ x: ax, z: az, s: 0.6 + r() * 0.5 }); }
  }

  // esferas de energia: na rua ou no telhado de prédios baixos
  if (r() < PROB_ESFERA * 3) {
    const baixos = b.lotes.filter((l) => l.y0 === CALCADA && l.y1 <= 17);
    if (baixos.length && r() < 0.5) {
      const l = baixos[Math.floor(r() * baixos.length)];
      b.orbes.push({ id: `${i},${j},t`, x: (l.x0 + l.x1) / 2, y: l.y1 + 1.4, z: (l.z0 + l.z1) / 2 });
    } else if (r() < 0.4) {
      const ao = r() < 0.5;
      b.orbes.push({ id: `${i},${j},r`, x: ao ? cx + (r() - 0.5) * (BLOCO - 8) : cx - CELL / 2 + (r() - 0.5) * 6, y: 1.4, z: ao ? cz - CELL / 2 + (r() - 0.5) * 6 : cz + (r() - 0.5) * (BLOCO - 8) });
    }
  }
  detalhes(b, i, j);
  cache.set(chave, b);
  return b;
}

/** Todas as esferas do mapa (para o total e a bússola). */
export function todasEsferas() {
  const v = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) v.push(...bloco(i, j).orbes);
  return v;
}

/** Retângulos sólidos (quarteirão e prédios) das células ao redor de (x,z). */
export function retangulosPerto(x, z, raio = 1) {
  const ci = celulaDe(x), cj = celulaDe(z), v = [];
  for (let i = ci - raio; i <= ci + raio; i++) for (let j = cj - raio; j <= cj + raio; j++) if (dentro(i, j)) v.push(...bloco(i, j).rects);
  return v;
}

/** Altura do chão sob (x,z) para quem está em y (sobe degrau de até `degrau`). */
export function chaoEm(rects, x, z, y, degrau = 0.7) {
  let h = 0;
  for (const q of rects) if (x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1 && q.y1 <= y + degrau && q.y1 > h) h = q.y1;
  return h;
}

/** Empurra um círculo (x,z,raio) para fora dos sólidos que o corpo (y..y+alt) atravessa. Devolve {x,z,bateu}. */
export function empurrar(rects, x, z, raio, y, alt = 1.8) {
  let bateu = false, nx = 0, nz = 0, golpe = null;
  for (let it = 0; it < 3; it++) {
    for (const q of rects) {
      if (y + alt <= q.y0 + 0.05 || y >= q.y1 - 0.05) continue;       // por cima ou por baixo
      if (q.y1 <= CALCADA + 0.01 && q.y0 < 0) continue;                 // o quarteirão em si é só chão
      const px = Math.max(q.x0, Math.min(x, q.x1)), pz = Math.max(q.z0, Math.min(z, q.z1));
      let dx = x - px, dz = z - pz, d2 = dx * dx + dz * dz;
      if (d2 >= raio * raio) continue;
      bateu = true; golpe = q;
      if (d2 > 1e-9) { const d = Math.sqrt(d2); nx = dx / d; nz = dz / d; x = px + nx * raio; z = pz + nz * raio; }
      else {                                                             // centro dentro do retângulo: sai pelo lado mais perto
        const e = x - q.x0, dd = q.x1 - x, f = z - q.z0, t = q.z1 - z, m = Math.min(e, dd, f, t);
        if (m === e) { x = q.x0 - raio; nx = -1; nz = 0; } else if (m === dd) { x = q.x1 + raio; nx = 1; nz = 0; } else if (m === f) { z = q.z0 - raio; nx = 0; nz = -1; } else { z = q.z1 + raio; nx = 0; nz = 1; }
      }
    }
  }
  return { x, z, bateu, nx, nz, q: golpe };
}

// ---------- detalhes urbanos: equipamentos de telhado, carros estacionados e postes (outra sequência de sorteio) ----------
const CORES_CARRO = [[168, 30, 36], [30, 60, 130], [225, 225, 228], [28, 28, 32], [120, 124, 130], [40, 96, 70], [214, 168, 52], [92, 36, 100]];
function detalhes(b, i, j) {
  const r = mulberry(hash(i, j, 2));
  // telhados: caixas de ar-condicionado, casa de máquinas, caixas d'água e antenas
  for (const l of b.lotes) {
    const coberto = (x, z, m) => b.lotes.some((o) => o !== l && Math.abs(o.y0 - l.y1) < 0.01 && x > o.x0 - m && x < o.x1 + m && z > o.z0 - m && z < o.z1 + m);
    const w = l.x1 - l.x0, d = l.z1 - l.z0, n = Math.min(7, 2 + Math.floor((w * d) / 220));
    for (let k = 0; k < n; k++) {
      const x = l.x0 + 2.5 + r() * (w - 5), z = l.z0 + 2.5 + r() * (d - 5), t = r();
      if (coberto(x, z, 3)) continue;
      if (t < 0.5) { const sx = 1.4 + r() * 2.2, sz = 1.2 + r() * 1.8, sy = 0.9 + r() * 1.3; b.topo.push({ t: 'caixa', x, y: l.y1, z, w: sx, h: sy, d: sz }); b.rects.push({ x0: x - sx / 2, x1: x + sx / 2, z0: z - sz / 2, z1: z + sz / 2, y0: l.y1, y1: l.y1 + sy }); }
      else if (t < 0.72 && w > 9) { const rr = 1 + r() * 0.7, h = 2.2 + r(); b.topo.push({ t: 'tanque', x, y: l.y1, z, w: rr, h, d: rr }); b.rects.push({ x0: x - rr, x1: x + rr, z0: z - rr, z1: z + rr, y0: l.y1, y1: l.y1 + h }); }
      else if (l.y1 > 40 || t > 0.9) b.topo.push({ t: 'antena', x, y: l.y1, z, w: 0.12, h: 6 + r() * 12, d: 0.12 });
      else { const sx = 3 + r() * 3, sz = 3 + r() * 3, sy = 2.6; b.topo.push({ t: 'caixa', x, y: l.y1, z, w: sx, h: sy, d: sz }); b.rects.push({ x0: x - sx / 2, x1: x + sx / 2, z0: z - sz / 2, z1: z + sz / 2, y0: l.y1, y1: l.y1 + sy }); }
    }
  }
  // carros estacionados junto ao meio-fio das duas ruas do quarteirão (norte e oeste; as outras duas são de quem vem depois)
  const faixa = BLOCO / 2 + 2.3;
  for (let lado = 0; lado < 2; lado++) {
    for (let u = -25; u <= 25; u += 7.2) {
      if (r() < 0.45) continue;
      const jit = (r() - 0.5) * 1.6, cor = CORES_CARRO[Math.floor(r() * CORES_CARRO.length)];
      const px = lado === 0 ? b.cx + u + jit : b.cx - faixa, pz = lado === 0 ? b.cz - faixa : b.cz + u + jit;
      const rot = lado === 0 ? 0 : Math.PI / 2, hx = lado === 0 ? 2.15 : 0.95, hz = lado === 0 ? 0.95 : 2.15;
      b.carros.push({ x: px, z: pz, rot, cor });
      b.rects.push({ x0: px - hx, x1: px + hx, z0: pz - hz, z1: pz + hz, y0: 0, y1: 1.45 });
    }
  }
  // postes de luz na calçada (norte e oeste)
  for (let lado = 0; lado < 2; lado++) for (let u = -22; u <= 22; u += 14.5) {
    const x = lado === 0 ? b.cx + u : b.cx - BLOCO / 2 + 1.1, z = lado === 0 ? b.cz - BLOCO / 2 + 1.1 : b.cz + u;
    b.postes.push({ x, z, lado });
    b.rects.push({ x0: x - 0.15, x1: x + 0.15, z0: z - 0.15, z1: z + 0.15, y0: CALCADA, y1: 7.5 });
  }
}
