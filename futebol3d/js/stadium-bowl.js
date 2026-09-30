// Estádio: anel de arquibancadas em dois anéis, cobertura com treliças de aço,
// placas de LED (geometria), fita de LED do anel superior, bancos de reservas e
// posições dos refletores. Tudo em poucas malhas mescladas.
import * as THREE from 'three';
import { PITCH } from './config.js';

// Anel: retângulo (A, B) na borda do gramado (onde ficam as placas); a
// arquibancada é o "offset" desse retângulo a uma distância d (cantos arredondados
// de raio d). S é a coordenada ao longo do anel (cantos contam como arco de raio rRef).
export const BOWL = {
  A: PITCH.halfL + PITCH.runoffX,   // 58,5
  B: PITCH.halfW + PITCH.runoffZ,   // 39
  rRef: 15,
  aisleSp: 18, aisleW: 1.3,         // escadas a cada 18 m
  vomSp: 36, vomW: 3.2,             // bocas de acesso no anel inferior
  lower: { d0: 3.3, y0: 0.8, rows: 24, depth: 0.8, rise: 0.42 },
  upper: { d0: 19.3, y0: 14.0, rows: 20, depth: 0.8, rise: 0.56 },
  roofIn: 12, roofOut: 37, roofY: 32.6,
  fasciaD: 19,
};

// GLSL compartilhado: sombra analítica da cobertura sobre arquibancada e torcida.
// d = distância do anel interno, y = altura, n = normal horizontal "para fora".
export const ROOF_GLSL = /* glsl */`
uniform vec3 uSunDir;
uniform float uShadeOn;
float roofLit( float d, float y, vec2 n ) {
  if ( uShadeOn < 0.5 ) return 1.0;
  vec3 L = uSunDir;
  if ( L.y < 0.02 ) return 0.0;
  float t = ( ${BOWL.roofY.toFixed(2)} - y ) / L.y;
  if ( t < 0.0 ) return 1.0;
  float dd = d + t * dot( L.xz, n );
  float m = smoothstep( ${(BOWL.roofIn - 1.2).toFixed(2)}, ${(BOWL.roofIn + 1.2).toFixed(2)}, dd )
          * ( 1.0 - smoothstep( ${(BOWL.roofOut - 1.0).toFixed(2)}, ${(BOWL.roofOut + 3.0).toFixed(2)}, dd ) );
  return 1.0 - m;
}`;

// amostras do anel: centro C (no retângulo), normal N para fora, S
export function ringSamples(sideStep = 4, cornerSteps = 10) {
  const { A, B, rRef } = BOWL;
  const sides = [
    { a: [-A, -B], b: [A, -B], n: [0, -1] },
    { a: [A, -B], b: [A, B], n: [1, 0] },
    { a: [A, B], b: [-A, B], n: [0, 1] },
    { a: [-A, B], b: [-A, -B], n: [-1, 0] },
  ];
  const out = [];
  let S = 0;
  for (let i = 0; i < 4; i++) {
    const sd = sides[i], nx = sd.n[0], nz = sd.n[1];
    const len = Math.hypot(sd.b[0] - sd.a[0], sd.b[1] - sd.a[1]);
    const n = Math.max(1, Math.round(len / sideStep));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push({ cx: sd.a[0] + (sd.b[0] - sd.a[0]) * t, cz: sd.a[1] + (sd.b[1] - sd.a[1]) * t, nx, nz, S: S + len * t });
    }
    S += len;
    // canto: N gira 90° no sentido anti-horário visto de cima (de n para o próximo n)
    const n2 = sides[(i + 1) % 4].n;
    const a0 = Math.atan2(nz, nx);
    let a1 = Math.atan2(n2[1], n2[0]);
    while (a1 < a0) a1 += Math.PI * 2;
    for (let k = 0; k < cornerSteps; k++) {
      const t = k / cornerSteps, a = a0 + (a1 - a0) * t;
      out.push({ cx: sd.b[0], cz: sd.b[1], nx: Math.cos(a), nz: Math.sin(a), S: S + rRef * (a1 - a0) * t });
    }
    S += rRef * Math.PI / 2;
  }
  out.total = S;
  return out;
}

// perfil (d, y, tipo) da arquibancada, do gramado para fora
// tipos: 0 piso, 1 muro, 2 degrau (assento), 3 espelho do degrau, 4 concreto,
//        5 escuro (vão do corredor), 6 fachada, 7 teto
function standProfile() {
  const P = [];
  const L = BOWL.lower, U = BOWL.upper;
  P.push([0, 0, 0], [3, 0, 1], [3, 1.2, 4], [3.3, 1.2, 1], [3.3, L.y0, 2]);
  for (let i = 0; i < L.rows; i++) {
    const d = L.d0 + i * L.depth, y = L.y0 + i * L.rise;
    if (i > 0) P.push([d, y, 2]);
    P.push([d + L.depth, y, i < L.rows - 1 ? 3 : 4]);
  }
  const yTop = L.y0 + (L.rows - 1) * L.rise, dTop = L.d0 + L.rows * L.depth;
  P.push([dTop + 1.5, yTop, 5], [dTop + 1.5, 13.2, 7], [BOWL.fasciaD, 13.2, 1], [BOWL.fasciaD, 14.9, 4], [U.d0, 14.9, 1], [U.d0, U.y0, 2]);
  for (let j = 0; j < U.rows; j++) {
    const d = U.d0 + j * U.depth, y = U.y0 + j * U.rise;
    if (j > 0) P.push([d, y, 2]);
    P.push([d + U.depth, y, j < U.rows - 1 ? 3 : 1]);
  }
  const dEnd = U.d0 + U.rows * U.depth;
  P.push([dEnd, 29.2, 4], [BOWL.roofOut, 29.2, 6], [BOWL.roofOut, 0, 6]);
  return P;
}

const roofProfile = () => [
  [BOWL.roofIn, BOWL.roofY - 0.9, 1], [BOWL.roofIn, BOWL.roofY + 0.5, 0],
  [BOWL.roofOut, BOWL.roofY - 1.6, 1], [BOWL.roofOut, BOWL.roofY - 2.9, 2],
  [BOWL.roofIn, BOWL.roofY - 0.9, 2],
];

// varre um perfil ao longo do anel; cada segmento do perfil vira uma faixa com
// normais próprias (quinas vivas entre degraus, suaves ao longo do anel)
function sweep(samples, profile, colorOf, extra) {
  const segs = profile.length - 1, ns = samples.length;
  const pos = [], nor = [], col = [], bowl = [], idx = [];
  const c = new THREE.Color();
  for (let j = 0; j < segs; j++) {
    const [d0, y0, kind] = profile[j], [d1, y1] = profile[j + 1];
    let pd = -(y1 - y0), py = d1 - d0;
    const pl = Math.hypot(pd, py) || 1; pd /= pl; py /= pl;
    colorOf(kind, c);
    const base = pos.length / 3;
    for (let k = 0; k < ns; k++) {
      const s = samples[k];
      for (const [d, y] of [[d0, y0], [d1, y1]]) {
        pos.push(s.cx + s.nx * d, y, s.cz + s.nz * d);
        nor.push(s.nx * pd, py, s.nz * pd);
        col.push(c.r, c.g, c.b);
        if (extra) bowl.push(d, s.S, kind, y);
      }
    }
    for (let k = 0; k < ns; k++) {
      const k2 = (k + 1) % ns;
      const a = base + k * 2, b = base + k2 * 2, cc = b + 1, dd = a + 1;
      idx.push(a, b, cc, a, cc, dd);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  if (extra) g.setAttribute('aBowl', new THREE.Float32BufferAttribute(bowl, 4));
  g.setIndex(idx);
  return g;
}

// viga (caixa) entre dois pontos, anexada a arrays de posição/normal/cor
function pushBeam(arr, a, b, w, h, color) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const box = new THREE.BoxGeometry(w, h, len).toNonIndexed();
  const m = new THREE.Matrix4().lookAt(a, b, Math.abs(dir.y / len) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0));
  m.setPosition(a.clone().addScaledVector(dir, 0.5));
  box.applyMatrix4(m);
  arr.pos.push(...box.attributes.position.array);
  arr.nor.push(...box.attributes.normal.array);
  for (let i = 0; i < box.attributes.position.count; i++) arr.col.push(color.r, color.g, color.b);
  box.dispose();
}

// material das arquibancadas: cores por vértice + escadas, bocas de acesso,
// fileiras de cadeiras e sombra da cobertura
function standMaterial(U) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.0 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSunDir = U.uSunDir; sh.uniforms.uShadeOn = U.uShadeOn;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aBowl;\nvarying vec4 vBowl;\nvarying vec2 vNOut;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBowl = aBowl;\nvNOut = normalize( vec2( position.x, position.z ) - clamp( vec2( position.x, position.z ), vec2( -58.5, -39.0 ), vec2( 58.5, 39.0 ) ) + 1e-4 );');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vBowl;\nvarying vec2 vNOut;\n' + ROOF_GLSL)
      .replace('#include <color_fragment>', /* glsl */`
        #include <color_fragment>
        float kind = floor( vBowl.z + 0.5 );
        float S = vBowl.y, dB = vBowl.x;
        if ( kind > 1.5 && kind < 3.5 ) {
          // escadas: faixa de concreto claro subindo o degrau
          float fa = fract( S / ${BOWL.aisleSp.toFixed(1)} ) * ${BOWL.aisleSp.toFixed(1)};
          float aw = fwidth( S ) + 0.02;
          float aisle = smoothstep( -aw, aw, fa ) * ( 1.0 - smoothstep( ${BOWL.aisleW.toFixed(2)} - aw, ${BOWL.aisleW.toFixed(2)} + aw, fa ) );
          // fileiras de cadeiras: encostos repetidos a cada 0,5 m
          float seat = abs( fract( S / 0.5 ) - 0.5 ) * 2.0;
          float sw = clamp( fwidth( S / 0.5 ) * 1.5, 0.0, 1.0 );
          diffuseColor.rgb *= mix( 1.0, mix( 0.75, 1.0, smoothstep( 0.7, 0.9, seat ) ), 1.0 - sw );
          diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.34, 0.34, 0.33 ), aisle );
          // bocas de acesso (vomitórios) no anel inferior
          float fv = fract( ( S + 9.0 ) / ${BOWL.vomSp.toFixed(1)} ) * ${BOWL.vomSp.toFixed(1)};
          float vom = step( fv, ${BOWL.vomW.toFixed(2)} ) * step( 10.0, dB ) * step( dB, 13.8 );
          diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.012 ), vom );
        }
        float sunLit = roofLit( dB, vBowl.w, vNOut );`)
      .replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin.replace(
        'getDirectionalLightInfo( directionalLight, directLight );',
        'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= sunLit;'));
  };
  return mat;
}

export function buildBowl(ctx) {
  const { U, homeColor } = ctx;
  const group = new THREE.Group();
  group.name = 'arquibancadas';
  const samples = ringSamples(4, 12);

  // ---- arquibancadas (1 malha)
  const seatCol = new THREE.Color(homeColor).multiplyScalar(0.3).lerp(new THREE.Color(0x15171c), 0.4);
  const seatColUp = seatCol.clone().lerp(new THREE.Color(0x2a2e36), 0.45);
  const standGeo = sweep(samples, standProfile(), (kind, c) => {
    switch (kind) {
      case 0: c.setRGB(0.045, 0.085, 0.05); break;          // piso sintético verde-escuro
      case 1: c.setRGB(0.05, 0.055, 0.065); break;          // muros
      case 2: c.copy(seatCol); break;                        // assentos
      case 3: c.setRGB(0.20, 0.20, 0.21); break;             // espelhos de concreto
      case 4: c.setRGB(0.28, 0.28, 0.29); break;
      case 5: c.setRGB(0.012, 0.012, 0.014); break;          // vão escuro do corredor
      case 6: c.setRGB(0.30, 0.31, 0.33); break;             // fachada
      case 7: c.setRGB(0.10, 0.10, 0.11); break;
    }
  }, true);
  // assentos do anel superior num tom mais neutro
  {
    const col = standGeo.attributes.color, b = standGeo.attributes.aBowl;
    for (let i = 0; i < col.count; i++) if (b.getZ(i) === 2 && b.getX(i) > 18) col.setXYZ(i, seatColUp.r, seatColUp.g, seatColUp.b);
  }
  const stands = new THREE.Mesh(standGeo, standMaterial(U));
  stands.name = 'arquibancada';
  group.add(stands);

  // ---- cobertura + treliças (1 malha)
  const roofGeo = sweep(samples, roofProfile(), (kind, c) => {
    if (kind === 0) c.setRGB(0.46, 0.48, 0.5);        // telhado
    else if (kind === 1) c.setRGB(0.07, 0.075, 0.085); // testeiras
    else c.setRGB(0.42, 0.43, 0.45);                   // forro
  }, false);
  const tr = { pos: [], nor: [], col: [] };
  const steel = new THREE.Color(0.42, 0.44, 0.48);
  const P = (s, d, y) => new THREE.Vector3(s.cx + s.nx * d, y, s.cz + s.nz * d);
  const Ry = BOWL.roofY;
  const yTop = (d) => THREE.MathUtils.lerp(Ry - 0.9, Ry - 2.9, (d - BOWL.roofIn) / (BOWL.roofOut - BOWL.roofIn)) - 0.15;
  const yBot = (d) => THREE.MathUtils.lerp(Ry - 1.7, 26.2, (d - BOWL.roofIn) / (BOWL.roofOut - BOWL.roofIn));
  const yRoofTop = (d) => THREE.MathUtils.lerp(Ry + 0.5, Ry - 1.6, (d - BOWL.roofIn) / (BOWL.roofOut - BOWL.roofIn)) + 0.12;
  const rib = new THREE.Color(0.36, 0.37, 0.4);
  samples.forEach((s, i) => {
    // nervuras sobre o telhado (visíveis da câmera aérea)
    pushBeam(tr, P(s, BOWL.roofIn + 0.2, yRoofTop(BOWL.roofIn + 0.2)), P(s, BOWL.roofOut - 0.2, yRoofTop(BOWL.roofOut - 0.2)), 0.25, 0.22, rib);
    if (i % 2) return;
    const dd = [BOWL.roofIn + 0.3, 16, 20, 24, 28, 32, BOWL.roofOut - 0.3];
    for (let k = 0; k < dd.length - 1; k++) {
      const a = dd[k], b = dd[k + 1];
      pushBeam(tr, P(s, a, yTop(a)), P(s, b, yTop(b)), 0.35, 0.35, steel);
      pushBeam(tr, P(s, a, yBot(a)), P(s, b, yBot(b)), 0.3, 0.3, steel);
      pushBeam(tr, P(s, a, yBot(a)), P(s, a, yTop(a)), 0.16, 0.16, steel);
      pushBeam(tr, P(s, a, yBot(a)), P(s, b, yTop(b)), 0.14, 0.14, steel);
    }
  });
  // longarinas contínuas sob a cobertura (ligam as treliças)
  for (const d of [BOWL.roofIn + 0.5, 20, 28]) {
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i], s2 = samples[(i + 1) % samples.length];
      pushBeam(tr, P(s, d, yBot(d)), P(s2, d, yBot(d)), 0.22, 0.22, steel);
    }
  }
  {
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(tr.pos, 3));
    tg.setAttribute('normal', new THREE.Float32BufferAttribute(tr.nor, 3));
    tg.setAttribute('color', new THREE.Float32BufferAttribute(tr.col, 3));
    const rg = roofGeo.toNonIndexed();
    const merged = mergeSimple([rg, tg]);
    rg.dispose(); tg.dispose(); roofGeo.dispose();
    const roof = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.35, side: THREE.DoubleSide }));
    roof.name = 'cobertura';
    group.add(roof);
    group.userData.roof = roof;
  }
  group.userData.stands = stands;
  group.userData.samples = samples;
  return group;
}

// junta geometrias não indexadas com position/normal/color
export function mergeSimple(geos) {
  const names = ['position', 'normal', 'color', 'uv'].filter((n) => geos.every((g) => g.attributes[n]));
  const out = new THREE.BufferGeometry();
  for (const n of names) {
    const sz = geos[0].attributes[n].itemSize;
    const total = geos.reduce((a, g) => a + g.attributes[n].count * sz, 0);
    const arr = new Float32Array(total);
    let o = 0;
    for (const g of geos) { arr.set(g.attributes[n].array, o); o += g.attributes[n].array.length; }
    out.setAttribute(n, new THREE.BufferAttribute(arr, sz));
  }
  return out;
}

// ---------------------------------------------------------------- assentos da torcida
// Devolve posições de pares de torcedores (instâncias com 2 pessoas).
export function crowdSeats(occupancy, rng) {
  const { A, B, rRef } = BOWL;
  const out = [];
  const addRow = (d, y, tier) => {
    const sides = [
      { a: [-A, -B], dir: [1, 0], len: 2 * A, n: [0, -1], S0: 0 },
      { a: [A, -B], dir: [0, 1], len: 2 * B, n: [1, 0], S0: 2 * A + rRef * Math.PI / 2 },
      { a: [A, B], dir: [-1, 0], len: 2 * A, n: [0, 1], S0: 2 * A + 2 * B + rRef * Math.PI },
      { a: [-A, B], dir: [0, -1], len: 2 * B, n: [-1, 0], S0: 4 * A + 2 * B + rRef * Math.PI * 1.5 },
    ];
    const pair = 1.1; // 2 pessoas por instância, 0,55 m cada
    for (let i = 0; i < 4; i++) {
      const sd = sides[i];
      const place = (x, z, nx, nz, S) => {
        const fa = ((S % BOWL.aisleSp) + BOWL.aisleSp) % BOWL.aisleSp;
        if (fa < BOWL.aisleW + 0.55 || fa > BOWL.aisleSp - 0.5) return;
        const fv = (((S + 9) % BOWL.vomSp) + BOWL.vomSp) % BOWL.vomSp;
        if (tier === 0 && d > 9.6 && d < 14.2 && fv < BOWL.vomW + 0.6) return;
        if (rng() > occupancy) return;
        // setor visitante: atrás do gol leste, anel inferior
        const away = tier === 0 && x > A - 1 && Math.abs(z) < 22 ? 1 : 0;
        out.push(x, y, z, d, nx, nz, rng(), away + tier * 2);
      };
      for (let s = pair / 2; s < sd.len; s += pair) {
        place(sd.a[0] + sd.dir[0] * s + sd.n[0] * d, sd.a[1] + sd.dir[1] * s + sd.n[1] * d, sd.n[0], sd.n[1], sd.S0 + s);
      }
      // canto
      const cx = sd.a[0] + sd.dir[0] * sd.len, cz = sd.a[1] + sd.dir[1] * sd.len;
      const a0 = Math.atan2(sd.n[1], sd.n[0]);
      const arc = Math.PI / 2 * d;
      const m = Math.floor(arc / pair);
      for (let k = 0; k < m; k++) {
        const t = (k + 0.5) / m, a = a0 + t * Math.PI / 2;
        const nx = Math.cos(a), nz = Math.sin(a);
        place(cx + nx * d, cz + nz * d, nx, nz, sd.S0 + sd.len + t * rRef * Math.PI / 2);
      }
    }
  };
  const L = BOWL.lower, Uu = BOWL.upper;
  for (let i = 0; i < L.rows; i++) addRow(L.d0 + i * L.depth + 0.5, L.y0 + i * L.rise, 0);
  for (let j = 0; j < Uu.rows; j++) addRow(Uu.d0 + j * Uu.depth + 0.5, Uu.y0 + j * Uu.rise, 1);
  return new Float32Array(out);
}

// ---------------------------------------------------------------- bancos de reservas
export function buildDugouts(ctx) {
  const { homeColor, awayColor } = ctx;
  const parts = [];
  const add = (geo, color, m) => {
    const g = geo.toNonIndexed();
    if (m) g.applyMatrix4(m);
    const c = new THREE.Color(color);
    const col = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < col.length; i += 3) { col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.deleteAttribute('uv');
    parts.push(g);
    geo.dispose();
  };
  const M = (x, y, z, ry = 0) => new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
  const zBack = -(BOWL.B + 2.7), zFront = -(BOWL.B + 0.35), depth = zFront - zBack;
  const glass = [];
  for (const [sx, team] of [[-1, homeColor], [1, awayColor]]) {
    const cx = sx * 12, w = 10;
    add(new THREE.BoxGeometry(w, 0.15, depth), 0x1b1d22, M(cx, 0.075, (zBack + zFront) / 2));
    add(new THREE.BoxGeometry(w, 3.0, 0.15), 0x23262d, M(cx, 1.5, zBack));
    for (const e of [-1, 1]) add(new THREE.BoxGeometry(0.12, 2.25, depth), 0x2a2d35, M(cx + e * w / 2, 1.125, (zBack + zFront) / 2));
    // cadeiras tipo concha em duas fileiras
    for (let r = 0; r < 2; r++) {
      const zr = zBack + 0.55 + r * 0.95, yr = 0.15 + r * 0.25;
      add(new THREE.BoxGeometry(w - 0.5, 0.2 + yr, 0.7), 0x15171b, M(cx, (0.2 + yr) / 2, zr));
      for (let k = 0; k < 16; k++) {
        const x = cx - w / 2 + 0.5 + k * ((w - 1) / 15);
        add(new THREE.BoxGeometry(0.5, 0.12, 0.48), team, M(x, 0.46 + yr, zr + 0.05));
        add(new THREE.BoxGeometry(0.5, 0.6, 0.1), team, M(x, 0.78 + yr, zr - 0.2));
      }
    }
    // cobertura curva de acrílico
    const shell = new THREE.CylinderGeometry(depth, depth, w, 20, 1, true, 0, Math.PI / 2);
    shell.rotateZ(Math.PI / 2);
    shell.scale(1, 0.3, 1);
    shell.translate(cx, 2.25, zBack);
    glass.push(shell);
  }
  // mesa do 4º árbitro
  add(new THREE.BoxGeometry(2.2, 0.8, 0.8), 0x2b2f38, M(0, 0.4, -(BOWL.B + 1.2)));
  const g = mergeSimple(parts);
  parts.forEach((p) => p.dispose());
  const group = new THREE.Group();
  group.name = 'bancos';
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.1 }));
  mesh.castShadow = true; mesh.receiveShadow = true;
  group.add(mesh);
  const gl = mergeSimple(glass.map((x) => { const y = x.toNonIndexed(); x.dispose(); return y; }));
  const glassMesh = new THREE.Mesh(gl, new THREE.MeshStandardMaterial({
    color: 0xcfe3ff, roughness: 0.08, metalness: 0.0, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false,
  }));
  glassMesh.renderOrder = 2;
  group.add(glassMesh);
  return group;
}

// posições dos refletores sob a borda da cobertura (ao longo dos lados retos)
export function floodlightSpots() {
  const { A, B } = BOWL;
  const d = BOWL.roofIn + 0.6, out = [];
  const y = BOWL.roofY - 1.35;
  const push = (x, z, yy) => {
    const tgt = new THREE.Vector3(x * 0.55, 0, z * 0.25);
    const p = new THREE.Vector3(x, yy, z);
    const aim = tgt.sub(p).normalize();
    out.push({ p, aim });
  };
  for (const s of [-1, 1]) {
    for (let x = -48; x <= 48.01; x += 2.4) for (const yy of [y, y - 0.75]) push(x, s * (B + d), yy);
    for (let z = -26; z <= 26.01; z += 2.6) for (const yy of [y, y - 0.75]) push(s * (A + d), z, yy);
  }
  return out;
}
