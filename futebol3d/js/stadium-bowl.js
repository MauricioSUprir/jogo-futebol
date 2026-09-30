// Estádio: anel de arquibancadas em dois anéis com a faixa de camarotes (vidro,
// janelas acesas à noite) entre eles, cadeiras de verdade (perfil varrido e recortado
// no shader, nas cores do clube), escadas, vomitórios, túnel dos jogadores, cobertura
// esculpida com anel interno de policarbonato, treliças de aço, passarela técnica e
// guarda-corpos. Tudo em poucas malhas mescladas (arquibancada, estrutura, vidros).
import * as THREE from 'three';
import { PITCH } from './config.js';
import { Parts } from './stadium-geo.js';

// Anel: retângulo (A, B) na borda do gramado (onde ficam as placas); a
// arquibancada é o "offset" desse retângulo a uma distância d (cantos arredondados
// de raio d). S é a coordenada ao longo do anel (cantos contam como arco de raio rRef).
export const BOWL = {
  A: PITCH.halfL + PITCH.runoffX,   // 58,5
  B: PITCH.halfW + PITCH.runoffZ,   // 39
  rRef: 15,
  aisleSp: 18, aisleW: 1.3,         // escadas a cada 18 m
  vomSp: 36, vomW: 3.2,             // bocas de acesso no anel inferior
  lower: { d0: 3.3, y0: 0.8, rows: 22, depth: 0.8, rise: 0.42 },
  upper: { d0: 19.3, y0: 14.0, rows: 20, depth: 0.8, rise: 0.56 },
  vip: { d: 23.6, y1: 13.2 },       // fachada de vidro dos camarotes (entre os anéis)
  roofIn: 12, roofOut: 37, roofY: 32.6,
  polyD: 19,                        // anel translúcido de policarbonato: roofIn..polyD
  fasciaD: 19,
  // túnel dos jogadores: no lado dos bancos (z < 0), no meio-campo
  tunnel: { S: PITCH.halfL + PITCH.runoffX, halfW: 2.0, d: 6.2 },
};

// GLSL compartilhado: sombra analítica da cobertura sobre arquibancada e torcida.
// d = distância do anel interno, y = altura, n = normal horizontal "para fora".
// O anel de policarbonato (roofIn..polyD) deixa passar parte da luz.
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
  m *= mix( 0.55, 1.0, smoothstep( ${(BOWL.polyD - 0.8).toFixed(2)}, ${(BOWL.polyD + 0.8).toFixed(2)}, dd ) );
  return 1.0 - m;
}`;

// amostras do anel: centro C (no retângulo), normal N para fora, S (de referência),
// e S0/th para o comprimento de arco físico a uma distância d: S0 + th·d
export function ringSamples(sideStep = 4, cornerSteps = 10) {
  const { A, B, rRef } = BOWL;
  const sides = [
    { a: [-A, -B], b: [A, -B], n: [0, -1] },
    { a: [A, -B], b: [A, B], n: [1, 0] },
    { a: [A, B], b: [-A, B], n: [0, 1] },
    { a: [-A, B], b: [-A, -B], n: [-1, 0] },
  ];
  const out = [];
  let S = 0, S0 = 0;
  for (let i = 0; i < 4; i++) {
    const sd = sides[i], nx = sd.n[0], nz = sd.n[1];
    const len = Math.hypot(sd.b[0] - sd.a[0], sd.b[1] - sd.a[1]);
    const n = Math.max(1, Math.round(len / sideStep));
    const th0 = i * Math.PI / 2;
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push({ cx: sd.a[0] + (sd.b[0] - sd.a[0]) * t, cz: sd.a[1] + (sd.b[1] - sd.a[1]) * t, nx, nz, S: S + len * t, S0: S0 + len * t, th: th0 });
    }
    S += len; S0 += len;
    // canto: N gira 90° no sentido anti-horário visto de cima (de n para o próximo n)
    const n2 = sides[(i + 1) % 4].n;
    const a0 = Math.atan2(nz, nx);
    let a1 = Math.atan2(n2[1], n2[0]);
    while (a1 < a0) a1 += Math.PI * 2;
    for (let k = 0; k < cornerSteps; k++) {
      const t = k / cornerSteps, a = a0 + (a1 - a0) * t;
      out.push({ cx: sd.b[0], cz: sd.b[1], nx: Math.cos(a), nz: Math.sin(a), S: S + rRef * (a1 - a0) * t, S0, th: th0 + (a1 - a0) * t });
    }
    S += rRef * Math.PI / 2;
  }
  out.total = S;
  return out;
}

// ponto do anel para uma coordenada S de referência e distância d (x, z, nx, nz)
export function ringPoint(S, d) {
  const { A, B, rRef } = BOWL;
  const segs = [
    { len: 2 * A, p: (t) => [-A + t, -B, 0, -1] },
    { corner: [A, -B], a0: -Math.PI / 2 },
    { len: 2 * B, p: (t) => [A, -B + t, 1, 0] },
    { corner: [A, B], a0: 0 },
    { len: 2 * A, p: (t) => [A - t, B, 0, 1] },
    { corner: [-A, B], a0: Math.PI / 2 },
    { len: 2 * B, p: (t) => [-A, B - t, -1, 0] },
    { corner: [-A, -B], a0: Math.PI },
  ];
  const arc = rRef * Math.PI / 2;
  let s = ((S % 1e9) + 1e9) % (4 * (A + B) + 4 * arc);
  for (const g of segs) {
    const L = g.len ?? arc;
    if (s <= L) {
      if (g.len) { const [x, z, nx, nz] = g.p(s); return { x: x + nx * d, z: z + nz * d, nx, nz }; }
      const a = g.a0 + (s / arc) * Math.PI / 2;
      const nx = Math.cos(a), nz = Math.sin(a);
      return { x: g.corner[0] + nx * d, z: g.corner[1] + nz * d, nx, nz };
    }
    s -= L;
  }
  return { x: -A, z: -B - d, nx: 0, nz: -1 };
}

// perfil (d, y, tipo) da arquibancada, do gramado para fora. Um ponto com tipo -1
// encerra a polilinha atual (sem segmento a partir dele).
// tipos: 0 piso, 1 muro, 2 degrau (piso da fileira), 3 espelho do degrau, 4 concreto,
//        5 escuro, 6 fachada externa, 7 forro sob o anel superior, 8 vidro dos camarotes,
//        9 passarela dos camarotes, 10 cadeira
function standProfile(seats) {
  const P = [];
  const L = BOWL.lower, U = BOWL.upper;
  const seatRows = [];
  P.push([0, 0, 0], [3, 0, 1], [3, 1.2, 4], [3.3, 1.2, 1], [3.3, L.y0, 2]);
  const rows = (T, last) => {
    for (let i = 0; i < T.rows; i++) {
      const d = T.d0 + i * T.depth, y = T.y0 + i * T.rise;
      if (i > 0) P.push([d, y, 2]);
      P.push([d + T.depth, y, i < T.rows - 1 ? 3 : last]);
      seatRows.push([d, y]);
    }
  };
  rows(L, 9);
  const yTop = L.y0 + (L.rows - 1) * L.rise;
  P.push([BOWL.vip.d, yTop, 8], [BOWL.vip.d, BOWL.vip.y1, 7], [BOWL.fasciaD, BOWL.vip.y1, 1],
    [BOWL.fasciaD, 14.9, 4], [U.d0, 14.9, 1], [U.d0, U.y0, 2]);
  rows(U, 1);
  const dEnd = U.d0 + U.rows * U.depth;
  P.push([dEnd, 29.2, 4], [BOWL.roofOut, 29.2, 6], [BOWL.roofOut, 0, -1]);
  // cadeiras: bloco contínuo (assento + encosto) recortado no shader entre as cadeiras
  if (seats) {
    for (const [d, y] of seatRows) {
      P.push([d + 0.30, y, 10], [d + 0.30, y + 0.36, 10], [d + 0.62, y + 0.42, 10], [d + 0.69, y + 0.84, 10],
        [d + 0.75, y + 0.84, 10], [d + 0.75, y + 0.3, -1]);
    }
  }
  return P;
}

// varre um perfil ao longo do anel (malha indexada com atributos para o shader)
function sweepStand(samples, profile, colorOf) {
  const ns = samples.length;
  const pos = [], nor = [], col = [], bowl = [], seat = [], idx = [];
  const c = new THREE.Color();
  for (let j = 0; j < profile.length - 1; j++) {
    const [d0, y0, kind] = profile[j], [d1, y1] = profile[j + 1];
    if (kind < 0) continue;
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
        bowl.push(d, s.S, kind, y);
        seat.push(s.S0 + s.th * d);
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
  g.setAttribute('aBowl', new THREE.Float32BufferAttribute(bowl, 4));
  g.setAttribute('aSeat', new THREE.Float32BufferAttribute(seat, 1));
  g.setIndex(idx);
  return g;
}

// varre um perfil ao longo do anel direto num acumulador Parts (triângulos soltos)
export function sweepInto(parts, samples, profile, colorOf, closed = true) {
  const ns = samples.length, c = new THREE.Color();
  const kEnd = closed ? ns : ns - 1;
  for (let j = 0; j < profile.length - 1; j++) {
    const [d0, y0, kind] = profile[j], [d1, y1] = profile[j + 1];
    if (kind < 0) continue;
    let pd = -(y1 - y0), py = d1 - d0;
    const pl = Math.hypot(pd, py) || 1; pd /= pl; py /= pl;
    const alpha = colorOf(kind, c) ?? 1;
    for (let k = 0; k < kEnd; k++) {
      const s = samples[k], s2 = samples[(k + 1) % ns];
      const v = [
        [s.cx + s.nx * d0, y0, s.cz + s.nz * d0, s], [s2.cx + s2.nx * d0, y0, s2.cz + s2.nz * d0, s2],
        [s2.cx + s2.nx * d1, y1, s2.cz + s2.nz * d1, s2], [s.cx + s.nx * d1, y1, s.cz + s.nz * d1, s],
      ];
      for (const i of [0, 1, 2, 0, 2, 3]) {
        const p = v[i];
        parts.pos.push(p[0], p[1], p[2]);
        parts.nor.push(p[3].nx * pd, py, p[3].nz * pd);
        parts.col.push(c.r, c.g, c.b);
        if (parts.alpha) parts.col.push(alpha);
      }
    }
  }
}

// material das arquibancadas: cores por vértice + cadeiras (recorte e cores do clube),
// escadas, vomitórios, túnel, camarotes envidraçados e sombra da cobertura
function standMaterial(ctx) {
  const { U } = ctx;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.0 });
  const uni = {
    uSeatA: { value: new THREE.Color(ctx.seatA) }, uSeatB: { value: new THREE.Color(ctx.seatB) },
    uNight: { value: ctx.isNight ? 1 : 0 }, uAccent: { value: new THREE.Color(ctx.accent) },
  };
  const L = BOWL.lower, T = BOWL.tunnel;
  const f = (v) => v.toFixed(3);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSunDir = U.uSunDir; sh.uniforms.uShadeOn = U.uShadeOn;
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aBowl;\nattribute float aSeat;\nvarying vec4 vBowl;\nvarying float vSeatS;\nvarying vec3 vWP;\nvarying vec2 vNOut;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vBowl = aBowl; vSeatS = aSeat; vWP = position;
        vNOut = normalize( vec2( position.x, position.z ) - clamp( vec2( position.x, position.z ), vec2( -${f(BOWL.A)}, -${f(BOWL.B)} ), vec2( ${f(BOWL.A)}, ${f(BOWL.B)} ) ) + 1e-4 );`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec4 vBowl;
        varying float vSeatS;
        varying vec3 vWP;
        varying vec2 vNOut;
        uniform vec3 uSeatA;
        uniform vec3 uSeatB;
        uniform vec3 uAccent;
        uniform float uNight;
        float bh( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }
        float bn( vec2 p ) {
          vec2 i = floor( p ), u = fract( p ); u = u * u * ( 3.0 - 2.0 * u );
          return mix( mix( bh( i ), bh( i + vec2( 1, 0 ) ), u.x ), mix( bh( i + vec2( 0, 1 ) ), bh( i + vec2( 1, 1 ) ), u.x ), u.y );
        }
        ${ROOF_GLSL}`)
      .replace('#include <color_fragment>', /* glsl */`
        #include <color_fragment>
        float kind = floor( vBowl.z + 0.5 );
        float S = vBowl.y, dB = vBowl.x, yB = vBowl.w;
        float kRough = -1.0, kMetal = -1.0;
        vec3 kEmis = vec3( 0.0 );
        // manchas e variação do concreto
        float grime = bn( vWP.xz * 0.23 + vWP.y * 0.31 ) * 0.6 + bn( vWP.xz * 1.9 + vWP.y ) * 0.4;
        // escadas, vomitórios e túnel (em S de referência: alinhados na radial)
        float fa = fract( S / ${f(BOWL.aisleSp)} ) * ${f(BOWL.aisleSp)};
        float aw = fwidth( S ) + 0.02;
        float aisle = smoothstep( -aw, aw, fa ) * ( 1.0 - smoothstep( ${f(BOWL.aisleW)} - aw, ${f(BOWL.aisleW)} + aw, fa ) );
        float fv = fract( ( S + 9.0 ) / ${f(BOWL.vomSp)} ) * ${f(BOWL.vomSp)};
        float vom = step( fv, ${f(BOWL.vomW)} ) * step( 10.0, dB ) * step( dB, 13.8 );
        float tun = ( 1.0 - smoothstep( ${f(T.halfW - 0.1)}, ${f(T.halfW + 0.1)}, abs( S - ${f(T.S)} ) ) ) * step( dB, ${f(T.d)} ) * step( 2.9, dB );
        float rowF = fract( ( dB - ${f(L.d0)} ) / ${f(L.depth)} );
        if ( kind > 9.5 ) {
          // ---- cadeiras: recorte entre elas (de perto) e mosaico nas cores do clube
          if ( aisle > 0.5 || vom > 0.5 || tun > 0.5 ) discard;
          float su = vSeatS / 0.5;
          float fw = fwidth( su );
          float gu = fract( su );
          float gap = min( gu, 1.0 - gu );
          float nearF = 1.0 - smoothstep( 0.12, 0.3, fw );
          if ( nearF > 0.5 && gap < 0.05 ) discard;
          // desenho nas cores do clube: anel inferior na cor secundária com duas
          // faixas da principal; anel superior na principal com uma "onda" da secundária
          float pB;
          float rowL = floor( ( dB - ${f(L.d0)} ) / ${f(L.depth)} + 0.01 );
          float aaR = clamp( fwidth( dB ) * 1.5, 0.02, 1.0 );
          if ( yB < 12.0 ) {
            float band = step( 7.0, rowL ) * step( rowL, 8.0 ) + step( 15.0, rowL ) * step( rowL, 15.0 );
            pB = 1.0 - band;
          } else {
            float wave = 17.5 + 2.2 * sin( S * ${f(2 * Math.PI / 72)} ) + 1.2 * sin( S * ${f(2 * Math.PI / 23)} + 1.3 );
            pB = 1.0 - smoothstep( wave - aaR * 8.0, wave + aaR * 8.0, yB );
          }
          vec3 sc = mix( uSeatA, uSeatB, pB );
          // plástico: menos saturado e mais escuro que a cor pura do clube
          float sl = dot( sc, vec3( 0.2126, 0.7152, 0.0722 ) );
          sc = mix( vec3( sl ), sc, 0.8 ) * 0.62;
          float edge = smoothstep( 0.05, 0.14, gap );
          diffuseColor.rgb = sc * mix( 0.5, 1.0, mix( 0.8, edge, nearF ) );
          kRough = 0.36;
        } else if ( kind > 1.5 && kind < 3.5 ) {
          // ---- piso e espelho das fileiras
          diffuseColor.rgb *= 0.82 + 0.3 * grime;
          vec3 aisleCol = vec3( 0.36, 0.36, 0.35 ) * ( 0.85 + 0.25 * grime );
          // faixa amarela antiderrapante na borda do degrau da escada
          float nose = ( 1.0 - smoothstep( 0.06, 0.09, rowF ) ) * step( kind, 2.5 );
          aisleCol = mix( aisleCol, vec3( 0.62, 0.48, 0.05 ), nose );
          diffuseColor.rgb = mix( diffuseColor.rgb, aisleCol, aisle );
          // vomitórios: boca escura com fundo iluminado
          float vIn = smoothstep( 0.0, 0.6, fv ) * ( 1.0 - smoothstep( ${f(BOWL.vomW - 0.6)}, ${f(BOWL.vomW)}, fv ) );
          diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.012 ), vom );
          kEmis += vec3( 1.0, 0.85, 0.62 ) * vom * vIn * smoothstep( 12.6, 13.8, dB ) * ( 0.08 + 0.35 * uNight );
          diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.006 ), tun );
        } else if ( kind > 7.5 && kind < 8.5 ) {
          // ---- camarotes: vidro reflexivo com caixilhos e interior aceso à noite
          float u = vSeatS;
          float mu = fract( u / 2.5 );
          float mull = 1.0 - smoothstep( 0.012, 0.025, min( mu, 1.0 - mu ) );
          float box = floor( u / 7.5 );
          float mb = fract( u / 7.5 );
          float wall = 1.0 - smoothstep( 0.006, 0.012, min( mb, 1.0 - mb ) );
          float hy = ( yB - ${f(L.y0 + (L.rows - 1) * L.rise)} ) / ${f(BOWL.vip.y1 - (L.y0 + (L.rows - 1) * L.rise))};
          float tran = 1.0 - smoothstep( 0.012, 0.03, abs( hy - 0.78 ) );
          float sill = 1.0 - smoothstep( 0.1, 0.13, hy );
          float frame = max( max( mull, wall ), max( tran, sill ) );
          float hb = bh( vec2( box, 3.1 ) );
          float on = step( 0.14, hb );
          vec3 warm = mix( vec3( 1.0, 0.72, 0.45 ), vec3( 0.85, 0.9, 1.0 ), step( 0.8, hb ) );
          // interior: linha de luz no teto, brilho quente difuso e silhuetas de gente
          float ceil = 1.0 - smoothstep( 0.0, 0.035, abs( hy - 0.9 ) );
          float lamps = ceil * ( 0.5 + 0.5 * step( 0.5, fract( u / 1.25 ) ) );
          float glow = 0.1 + 0.3 * smoothstep( 0.15, 0.9, hy );
          float ppl = step( 0.52, bn( vec2( u * 1.7, box ) ) ) * smoothstep( 0.12, 0.16, hy ) * ( 1.0 - smoothstep( 0.5, 0.56, hy + 0.08 * bn( vec2( u * 5.0, 1.0 ) ) ) );
          float inside = ( glow + 2.2 * lamps ) * ( 1.0 - 0.85 * ppl );
          diffuseColor.rgb = mix( vec3( 0.05, 0.06, 0.07 ), vec3( 0.02 ), frame );
          kRough = mix( 0.05, 0.45, frame );
          kMetal = mix( 0.9, 0.6, frame );
          kEmis += warm * inside * ( 0.35 + 0.8 * hb ) * on * ( 1.0 - frame ) * ( 0.04 + 0.7 * uNight );
        } else if ( kind > 8.5 ) {
          // passarela dos camarotes: piso claro com linha de luz na borda
          diffuseColor.rgb *= 0.9 + 0.2 * grime;
          float lip = 1.0 - smoothstep( 0.06, 0.12, abs( dB - ${f(L.d0 + L.rows * L.depth + 0.15)} ) );
          kEmis += uAccent * lip * ( 0.15 + 1.6 * uNight );
        } else if ( kind > 6.5 ) {
          // forro sob o anel superior: spots embutidos
          vec2 q = vec2( fract( vSeatS / 3.0 ) - 0.5, ( dB - 21.4 ) / 3.0 );
          float spot = 1.0 - smoothstep( 0.035, 0.06, length( q ) );
          diffuseColor.rgb *= 0.9 + 0.2 * grime;
          kEmis += vec3( 1.0, 0.9, 0.75 ) * spot * ( 0.4 + 2.6 * uNight );
        } else if ( kind > 5.5 ) {
          // fachada externa: aletas verticais de metal, lavadas de luz à noite
          float fin = abs( fract( vSeatS / 1.6 ) - 0.5 ) * 2.0;
          diffuseColor.rgb *= mix( 0.55, 1.1, smoothstep( 0.3, 0.9, fin ) );
          kRough = 0.45; kMetal = 0.5;
          kEmis += uAccent * smoothstep( 22.0, 0.0, yB ) * 0.12 * uNight;
        } else {
          diffuseColor.rgb *= 0.85 + 0.28 * grime;
          diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.006 ), tun * step( kind, 1.5 ) );
        }
        float sunLit = roofLit( dB, yB, vNOut );`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif ( kRough >= 0.0 ) roughnessFactor = kRough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nif ( kMetal >= 0.0 ) metalnessFactor = kMetal;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += kEmis;')
      .replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin.replace(
        'getDirectionalLightInfo( directionalLight, directLight );',
        'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= sunLit;'));
  };
  mat.customProgramCacheKey = () => 'golaco-arquibancada';
  return mat;
}

// ---------------------------------------------------------------- cobertura
const Ry = BOWL.roofY;
// face de baixo da cobertura (onde as treliças se apoiam)
const UNDER = [[12.7, Ry - 1.0], [BOWL.polyD, Ry - 0.3], [30, Ry - 2.4], [38.2, Ry - 4.2]];
export function roofUnderY(d) {
  for (let i = 0; i < UNDER.length - 1; i++) {
    const [d0, y0] = UNDER[i], [d1, y1] = UNDER[i + 1];
    if (d <= d1 || i === UNDER.length - 2) return y0 + (y1 - y0) * THREE.MathUtils.clamp((d - d0) / (d1 - d0), 0, 1);
  }
  return Ry;
}
const trussDepth = (d) => THREE.MathUtils.lerp(1.1, 2.3, THREE.MathUtils.clamp((d - 12.7) / (35.3 - 12.7), 0, 1));
export const CATWALK = { d0: 13.9, d1: 15.0, y: roofUnderY(14.5) - 0.12 - trussDepth(14.5) - 0.12 };

function roofProfile() {
  const pd = BOWL.polyD, ri = BOWL.roofIn;
  return [
    // anel de compressão (viga-caixão da borda interna; recebe a fita de LED)
    [ri, Ry - 1.0, 1], [ri, Ry + 0.6, 0], [ri + 0.7, Ry + 0.6, 1], [ri + 0.7, Ry - 1.0, 2], [ri, Ry - 1.0, -1],
    // cobertura opaca esculpida (dorso curvo e beiral externo arredondado)
    [pd, Ry + 1.0, 0], [24, Ry + 1.9, 0], [30, Ry + 1.8, 0], [35, Ry + 0.7, 0], [38.4, Ry - 1.4, 1],
    [39, Ry - 3.2, 1], [38.2, Ry - 4.2, 2], [30, Ry - 2.4, 2], [pd, Ry - 0.3, 1], [pd, Ry + 1.0, -1],
  ];
}

// guarda-corpos, corrimãos, passarela técnica e treliças: tudo no acumulador `st`
function buildStructure(st, glass, samples, detail) {
  const steel = new THREE.Color(0.5, 0.52, 0.56);
  const dark = new THREE.Color(0.08, 0.085, 0.095);
  const rail = new THREE.Color(0.62, 0.64, 0.68);
  const P = (s, d, y) => new THREE.Vector3(s.cx + s.nx * d, y, s.cz + s.nz * d);

  // cobertura (opaca)
  sweepInto(st, samples, roofProfile(), (kind, c) => {
    if (kind === 0) c.setRGB(0.52, 0.54, 0.57);        // painéis do telhado
    else if (kind === 1) c.setRGB(0.07, 0.075, 0.085); // bordas
    else c.setRGB(0.26, 0.27, 0.29);                   // forro
  });
  // policarbonato do anel interno (vidro fosco) + guarda-corpos de vidro
  const pd = BOWL.polyD, ri = BOWL.roofIn;
  sweepInto(glass, samples, [[ri + 0.7, Ry + 0.6, 0], [pd, Ry + 1.0, -1]], (k, c) => { c.setRGB(0.82, 0.88, 0.92); return 0.5; });
  const L = BOWL.lower, yTopL = L.y0 + (L.rows - 1) * L.rise, dTopL = L.d0 + L.rows * L.depth;
  sweepInto(glass, samples, [[dTopL + 0.05, yTopL, 0], [dTopL + 0.05, yTopL + 1.0, -1]], (k, c) => { c.setRGB(0.6, 0.7, 0.75); return 0.22; });
  sweepInto(glass, samples, [[BOWL.fasciaD + 0.06, 14.9, 0], [BOWL.fasciaD + 0.06, 15.9, -1]], (k, c) => { c.setRGB(0.6, 0.7, 0.75); return 0.22; });
  // corrimãos contínuos sobre os vidros
  const tube = (d, y, w, h, col) => sweepInto(st, samples, [[d - w / 2, y, 0], [d + w / 2, y, 0], [d + w / 2, y - h, 0], [d - w / 2, y - h, 0], [d - w / 2, y, -1]], (k, c) => c.copy(col));
  tube(dTopL + 0.05, yTopL + 1.05, 0.08, 0.06, rail);
  tube(BOWL.fasciaD + 0.06, 15.95, 0.08, 0.06, rail);

  // treliças em balanço (a cada 2 amostras; menos na qualidade baixa)
  const step = detail === 0 ? 4 : 2;
  const yT = (d) => roofUnderY(d) - 0.12;
  const yB = (d) => yT(d) - trussDepth(d);
  const dd = [ri + 0.7, 16, pd, 23, 27, 31, 35.3];
  samples.forEach((s, i) => {
    // nervuras sobre o policarbonato (visíveis por transparência e de cima)
    if (detail > 0 || i % 2 === 0) {
      st.beam(P(s, ri + 0.7, Ry + 0.72), P(s, (ri + pd) / 2, Ry + 1.25), 0.14, 0.16, steel);
      st.beam(P(s, (ri + pd) / 2, Ry + 1.25), P(s, pd, Ry + 1.12), 0.14, 0.16, steel);
    }
    if (i % step) return;
    for (let k = 0; k < dd.length - 1; k++) {
      const a = dd[k], b = dd[k + 1];
      st.beam(P(s, a, yT(a)), P(s, b, yT(b)), 0.34, 0.34, steel);
      st.beam(P(s, a, yB(a)), P(s, b, yB(b)), 0.3, 0.3, steel);
      st.beam(P(s, a, yB(a)), P(s, a, yT(a)), 0.16, 0.16, steel);
      if (detail > 0) st.beam(P(s, a, yB(a)), P(s, b, yT(b)), 0.13, 0.13, steel);
    }
    // pilar de apoio atrás da última fileira
    st.beam(P(s, 35.3, yB(35.3)), P(s, 35.3, 29.2), 0.4, 0.4, dark);
  });
  // longarinas contínuas (ligam as treliças) sob a cobertura
  const ring = (d, y, w) => sweepInto(st, samples, [[d - w / 2, y + w / 2, 0], [d + w / 2, y + w / 2, 0], [d + w / 2, y - w / 2, 0], [d - w / 2, y - w / 2, 0], [d - w / 2, y + w / 2, -1]], (k, c) => c.copy(steel));
  for (const d of detail === 0 ? [20, 28] : [16, 20, 24, 28, 32]) ring(d, yT(d) - 0.1, 0.22);
  ring(20, yB(20), 0.2);

  // passarela técnica (com os refletores) sob a borda interna
  const cw = CATWALK;
  sweepInto(st, samples, [[cw.d0, cw.y, 0], [cw.d1, cw.y, 0], [cw.d1, cw.y - 0.12, 0], [cw.d0, cw.y - 0.12, 0], [cw.d0, cw.y, -1]], (k, c) => c.setRGB(0.2, 0.21, 0.23));
  tube(cw.d0 + 0.03, cw.y + 1.05, 0.05, 0.05, rail);
  tube(cw.d1 - 0.03, cw.y + 1.05, 0.05, 0.05, rail);
  if (detail > 0) tube(cw.d0 + 0.03, cw.y + 0.55, 0.035, 0.035, rail);
  samples.forEach((s, i) => {
    if (i % step) return;
    // pendurais da passarela
    st.beam(P(s, cw.d0 + 0.03, cw.y), P(s, cw.d0 + 0.03, yB(cw.d0)), 0.06, 0.06, steel);
    st.beam(P(s, cw.d1 - 0.03, cw.y), P(s, cw.d1 - 0.03, yB(cw.d1)), 0.06, 0.06, steel);
  });
}

// corrimãos das escadas e dos vomitórios (geometria real, poucos triângulos)
function buildRails(st, detail) {
  if (detail === 0) return;
  const rail = new THREE.Color(0.36, 0.37, 0.4);
  const Pt = (S, d, y) => { const p = ringPoint(S, d); return new THREE.Vector3(p.x, y, p.z); };
  const total = 4 * (BOWL.A + BOWL.B) + 2 * Math.PI * BOWL.rRef;
  for (const T of [BOWL.lower, BOWL.upper]) {
    for (let S = 0; S < total - 1; S += BOWL.aisleSp) {
      const Sc = S + BOWL.aisleW / 2;
      const dA = T.d0 + T.depth * 1.5, dB = T.d0 + T.depth * (T.rows - 0.5);
      const yA = T.y0 + T.rise * 1 + 0.95, yB = T.y0 + T.rise * (T.rows - 1) + 0.95;
      st.beam(Pt(Sc, dA, yA), Pt(Sc, dB, yB), 0.05, 0.05, rail);
      for (let r = 1; r < T.rows; r += 3) {
        const d = T.d0 + T.depth * (r + 0.5), y = T.y0 + T.rise * r;
        st.beam(Pt(Sc, d, y), Pt(Sc, d, y + 0.95 + (T.rise / T.depth) * 0), 0.045, 0.045, rail);
      }
    }
  }
  // vomitórios: corrimãos laterais e na frente da boca
  for (let S = 27; S < total; S += BOWL.vomSp) {
    for (const e of [0, BOWL.vomW]) {
      const Sx = S + e;
      const d0 = 10, d1 = 13.8, y0 = BOWL.lower.y0 + BOWL.lower.rise * Math.floor((d0 - 3.3) / 0.8), y1 = BOWL.lower.y0 + BOWL.lower.rise * Math.floor((d1 - 3.3) / 0.8);
      st.beam(Pt(Sx, d0, y0 + 1.0), Pt(Sx, d1, y1 + 1.0), 0.05, 0.05, rail);
      st.beam(Pt(Sx, d0, y0), Pt(Sx, d0, y0 + 1.0), 0.05, 0.05, rail);
    }
    const yv = BOWL.lower.y0 + BOWL.lower.rise * Math.floor((9.9 - 3.3) / 0.8) + 1.0;
    st.beam(Pt(S, 9.95, yv), Pt(S + BOWL.vomW, 9.95, yv), 0.05, 0.05, rail);
  }
}

export function buildBowl(ctx, st, glass) {
  const detail = ctx.detail ?? 2;
  const group = new THREE.Group();
  group.name = 'arquibancadas';
  const samples = ringSamples(4, 12);

  // ---- arquibancadas (1 malha)
  const standGeo = sweepStand(samples, standProfile(detail > 0), (kind, c) => {
    switch (kind) {
      case 0: c.setRGB(0.045, 0.085, 0.05); break;          // piso sintético verde-escuro
      case 1: c.setRGB(0.05, 0.055, 0.065); break;          // muros
      case 2: c.setRGB(0.17, 0.17, 0.175); break;           // piso das fileiras
      case 3: c.setRGB(0.21, 0.21, 0.22); break;            // espelhos de concreto
      case 4: c.setRGB(0.28, 0.28, 0.29); break;
      case 5: c.setRGB(0.012, 0.012, 0.014); break;
      case 6: c.setRGB(0.36, 0.37, 0.4); break;             // fachada
      case 7: c.setRGB(0.16, 0.16, 0.17); break;            // forro
      case 9: c.setRGB(0.3, 0.3, 0.31); break;              // passarela
      default: c.setRGB(1, 1, 1);
    }
  });
  const stands = new THREE.Mesh(standGeo, standMaterial(ctx));
  stands.name = 'arquibancada';
  group.add(stands);

  buildStructure(st, glass, samples, detail);
  buildRails(st, detail);

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
// Devolve posições de pares de torcedores (instâncias com 2 pessoas):
// [x, y, z, d, nx, nz, semente, flags(1 = visitante, 2 = anel superior)] por instância.
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
        if (tier === 0 && d < BOWL.tunnel.d + 0.4 && Math.abs(S - BOWL.tunnel.S) < BOWL.tunnel.halfW + 0.6) return;
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

// posições dos refletores: duas fileiras presas à passarela técnica (lados retos)
export function floodlightSpots() {
  const { A, B } = BOWL;
  const d = CATWALK.d0 - 0.25, out = [];
  const y = CATWALK.y - 0.55;
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
