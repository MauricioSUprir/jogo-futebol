// Placas de LED em volta do gramado + fita de LED no anel superior, com anúncios
// fictícios desenhados em canvas (uma vez). Troca com "rolagem", alguns rolam na
// horizontal, e piscam "GOOOL" após um gol. Emissivo: brilha à noite (bloom).
import * as THREE from 'three';
import { BOWL } from './stadium-bowl.js';

const ROWS = 8;           // linhas do atlas: 0 = GOL, 1 = nome do estádio, 2..7 anúncios
const ASPECT = 16;        // cada anúncio: 16 × altura

// marcas inventadas (nenhuma real)
const BRANDS = [
  { name: 'VOLTARA', tag: 'energia que joga junto', bg: ['#07153a', '#0b62c4'], fg: '#ffe23a', mark: 'bolt' },
  { name: 'CAFÉ SERRANO', tag: 'torrado na montanha', bg: ['#2a1409', '#6b3a1c'], fg: '#f6e3c4', mark: 'bean' },
  { name: 'TUCANO AIR', tag: 'voe mais longe', bg: ['#111111', '#222222'], fg: '#ff8a1c', mark: 'wing' },
  { name: 'NIMBO BANK', tag: 'seu dinheiro nas nuvens', bg: ['#3b0f63', '#7a2bc0'], fg: '#ffffff', mark: 'cloud' },
  { name: 'BRASA BURGER', tag: 'no ponto certo', bg: ['#b3120e', '#e5321c'], fg: '#ffd84a', mark: 'fire' },
  { name: 'ÓRBITA TV', tag: 'todo jogo, ao vivo', bg: ['#02140c', '#053d22'], fg: '#39ff9c', mark: 'ring' },
];

function drawMark(g, kind, x, y, s, col) {
  g.save(); g.translate(x, y); g.fillStyle = col; g.strokeStyle = col; g.lineWidth = s * 0.12;
  g.beginPath();
  if (kind === 'bolt') { g.moveTo(s * 0.1, -s * 0.5); g.lineTo(-s * 0.3, s * 0.08); g.lineTo(0, s * 0.08); g.lineTo(-s * 0.1, s * 0.5); g.lineTo(s * 0.3, -s * 0.08); g.lineTo(0, -s * 0.08); g.closePath(); g.fill(); }
  else if (kind === 'bean') { g.ellipse(0, 0, s * 0.3, s * 0.42, 0.5, 0, 7); g.fill(); g.strokeStyle = '#2a1409'; g.beginPath(); g.moveTo(-s * 0.1, -s * 0.3); g.quadraticCurveTo(s * 0.12, 0, -s * 0.05, s * 0.3); g.stroke(); }
  else if (kind === 'wing') { g.moveTo(-s * 0.5, s * 0.2); g.quadraticCurveTo(0, -s * 0.6, s * 0.5, -s * 0.3); g.quadraticCurveTo(0, -s * 0.1, -s * 0.5, s * 0.2); g.fill(); }
  else if (kind === 'cloud') { for (const [cx, cy, r] of [[-0.2, 0.05, 0.22], [0.05, -0.1, 0.28], [0.28, 0.07, 0.2]]) { g.moveTo(cx * s + r * s, cy * s); g.arc(cx * s, cy * s, r * s, 0, 7); } g.fill(); }
  else if (kind === 'fire') { g.moveTo(0, -s * 0.5); g.quadraticCurveTo(s * 0.45, 0, s * 0.2, s * 0.45); g.quadraticCurveTo(0, s * 0.55, -s * 0.2, s * 0.45); g.quadraticCurveTo(-s * 0.45, 0, 0, -s * 0.5); g.fill(); }
  else if (kind === 'ring') { g.ellipse(0, 0, s * 0.45, s * 0.18, -0.4, 0, 7); g.stroke(); g.beginPath(); g.arc(0, 0, s * 0.18, 0, 7); g.fill(); }
  g.restore();
}

function adAtlas(stadiumName, homeColor) {
  const W = 2048, H = 128 * ROWS;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const font = (px, w = 900) => `italic ${w} ${px}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
  const row = (i, draw) => { g.save(); g.beginPath(); g.rect(0, i * 128, W, 128); g.clip(); g.translate(0, i * 128); draw(); g.restore(); };
  // 0: GOOOL
  row(0, () => {
    g.fillStyle = homeColor; g.fillRect(0, 0, W, 128);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let x = -128; x < W; x += 96) { g.beginPath(); g.moveTo(x, 128); g.lineTo(x + 48, 128); g.lineTo(x + 176, 0); g.lineTo(x + 128, 0); g.fill(); }
    g.fillStyle = '#fff'; g.font = font(104); g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const x of [W * 0.25, W * 0.75]) g.fillText('GOOOOL!', x, 68);
  });
  // 1: nome do estádio (duas cópias por linha, como os anúncios)
  row(1, () => {
    const gr = g.createLinearGradient(0, 0, W / 2, 0);
    gr.addColorStop(0, '#0a0d14'); gr.addColorStop(0.5, '#1c2436'); gr.addColorStop(1, '#0a0d14');
    for (const ox of [0, W / 2]) {
      g.save(); g.translate(ox, 0);
      g.fillStyle = gr; g.fillRect(0, 0, W / 2, 128);
      g.fillStyle = homeColor; g.fillRect(0, 116, W / 2, 12); g.fillRect(0, 0, W / 2, 12);
      g.fillStyle = '#fff'; g.font = font(64, 800); g.textAlign = 'center'; g.textBaseline = 'middle';
      const name = stadiumName.toUpperCase();
      const w = g.measureText(name).width;
      if (w > W / 2 - 60) { g.translate(W / 4, 0); g.scale((W / 2 - 60) / w, 1); g.fillText(name, 0, 66); }
      else g.fillText(name, W / 4, 66);
      g.restore();
    }
  });
  BRANDS.forEach((b, k) => row(2 + k, () => {
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, b.bg[1]); gr.addColorStop(1, b.bg[0]);
    g.fillStyle = gr; g.fillRect(0, 0, W, 128);
    // dois blocos por anúncio (logo + nome + slogan)
    for (const ox of [0, W / 2]) {
      drawMark(g, b.mark, ox + 150, 64, 100, b.fg);
      g.fillStyle = b.fg; g.font = font(78); g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText(b.name, ox + 230, 58);
      const nw = g.measureText(b.name).width;
      g.font = font(28, 600); g.fillStyle = 'rgba(255,255,255,0.85)';
      g.fillText(b.tag, ox + 240 + Math.min(nw, 640) - g.measureText(b.tag).width, 106);
    }
  }));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

const vert = /* glsl */`
attribute float aLed;
attribute float aH;       // altura física do painel (m)
varying vec2 vUv;
varying float vLed;
varying float vH;
varying vec3 vN;
varying vec3 vW;
void main() {
  vUv = uv; vLed = aLed; vH = aH;
  vN = normalize( mat3( modelMatrix ) * normal );
  vec4 w = modelMatrix * vec4( position, 1.0 );
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const frag = /* glsl */`
uniform sampler2D uAds;
uniform float uTime;
uniform float uFlash;
uniform float uBright;
uniform vec3 uFrameLight;
varying vec2 vUv;
varying float vLed;
varying float vH;
varying vec3 vN;
varying vec3 vW;
vec3 adRow( float row, vec2 uv ) {
  return texture2D( uAds, vec2( uv.x, ( ${ROWS.toFixed(1)} - 1.0 - row + clamp( uv.y, 0.02, 0.98 ) ) / ${ROWS.toFixed(1)} ) ).rgb;
}
void main() {
  if ( vLed < 0.5 ) {
    // estrutura (verso/topo) cinza-escura
    float l = 0.35 + 0.65 * max( vN.y, 0.0 );
    gl_FragColor = vec4( vec3( 0.03 ) * uFrameLight * l + vec3( 0.004 ), 1.0 );
  } else {
    // u em unidades de anúncio (largura = 16 × altura)
    float u = vUv.x / ( vH * ${ASPECT.toFixed(1)} );
    float seg = floor( u );
    float cyc = uTime / 9.0;
    float k = floor( cyc );
    float ph = fract( cyc );
    float mode = mod( k, 4.0 );
    // modos: 0-1 = cada placa um anúncio; 2 = anúncio único rolando; 3 = nome do estádio
    float rowA = 2.0 + mod( k + ( mode < 1.5 ? seg : 0.0 ), 6.0 );
    float kn = k + 1.0, modeN = mod( kn, 4.0 );
    float rowB = modeN > 2.5 ? 1.0 : 2.0 + mod( kn + ( modeN < 1.5 ? seg : 0.0 ), 6.0 );
    if ( mode > 2.5 ) rowA = 1.0;
    float xA = mode > 1.5 && mode < 2.5 ? u * 0.5 + uTime * 0.06 : fract( u ) * 0.5;
    float xB = modeN > 1.5 && modeN < 2.5 ? u * 0.5 + uTime * 0.06 : fract( u ) * 0.5;
    // troca: "rolagem" vertical no fim do ciclo
    float tr = smoothstep( 0.945, 1.0, ph );
    vec3 c;
    if ( vUv.y > 1.0 - tr ) c = adRow( rowB, vec2( xB, vUv.y - ( 1.0 - tr ) ) );
    else c = adRow( rowA, vec2( xA, vUv.y + tr ) );
    if ( uFlash > 0.0 ) {
      float blink = step( 0.35, fract( uTime * 2.2 ) );
      c = mix( c, adRow( 0.0, vec2( u * 0.5 - uTime * 0.25, vUv.y ) ) * ( 0.55 + 0.45 * blink ), step( 0.01, uFlash ) );
    }
    // grade de pixels do LED (some com a distância)
    vec2 px = vec2( vUv.x, vUv.y * vH ) / 0.02;
    vec2 fw = fwidth( px );
    float fade = 1.0 - clamp( max( fw.x, fw.y ) * 0.6, 0.0, 1.0 );
    vec2 gp = abs( fract( px ) - 0.5 );
    float grid = smoothstep( 0.32, 0.5, max( gp.x, gp.y ) );
    c *= 1.0 - grid * 0.55 * fade;
    // LEDs perdem brilho em ângulos rasantes
    vec3 V = normalize( cameraPosition - vW );
    c *= mix( 0.45, 1.0, abs( dot( V, vN ) ) );
    gl_FragColor = vec4( c * uBright, 1.0 );
  }
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// quad vertical + estrutura (topo e verso inclinado) entre a e b (xz); a normal
// aponta para o centro do campo e a ordem é trocada para o texto ler da esquerda p/ direita
function boardRun(out, a, b, h, y0, uStart) {
  let dx = b[0] - a[0], dz = b[1] - a[1];
  let n = [-dz, dx];
  const nl = Math.hypot(n[0], n[1]); n = [n[0] / nl, n[1] / nl];
  if (n[0] * -(a[0] + b[0]) + n[1] * -(a[1] + b[1]) < 0) n = [-n[0], -n[1]];
  if (dx * n[1] - dz * n[0] < 0) { const t = a; a = b; b = t; }
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const back = 0.55;
  const q = (p0, p1, p2, p3, nrm, led, u0, u1, v0 = 0, v1 = 1) => {
    const base = out.pos.length / 3;
    for (const p of [p0, p1, p2, p3]) { out.pos.push(...p); out.nor.push(...nrm); out.led.push(led); out.h.push(h); }
    out.uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
    out.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const P = (p, d, y) => [p[0] - n[0] * d, y, p[1] - n[1] * d];
  // frente (LED): de a para b, visto do campo
  q(P(a, 0, y0), P(b, 0, y0), P(b, 0, y0 + h), P(a, 0, y0 + h), [n[0], 0, n[1]], 1, uStart, uStart + len);
  // topo
  q(P(a, 0, y0 + h), P(b, 0, y0 + h), P(b, 0.12, y0 + h), P(a, 0.12, y0 + h), [0, 1, 0], 0, 0, 1);
  // verso inclinado (para fora do campo)
  const bn = [-n[0] * 0.85, 0.5, -n[1] * 0.85];
  q(P(b, 0.12, y0 + h), P(b, back, 0), P(a, back, 0), P(a, 0.12, y0 + h), bn, 0, 0, 1);
  return len;
}

export function buildAds(ctx) {
  const { U, stadiumName, homeColor, isNight, samples } = ctx;
  const out = { pos: [], nor: [], uv: [], led: [], h: [], idx: [] };
  const { A, B } = BOWL;
  const h = 0.9, y0 = 0.02, e = 0.12;
  const zS = B - e, xE = A - e - 0.1;
  // laterais: lado oposto inteiro; lado dos bancos só fora da área técnica
  boardRun(out, [-55.5, zS], [55.5, zS], h, y0, 0);
  boardRun(out, [-55.5, -zS], [-21, -zS], h, y0, 0);
  boardRun(out, [21, -zS], [55.5, -zS], h, y0, 7.2);
  // atrás dos gols, com peças em ângulo nas quinas
  for (const s of [-1, 1]) {
    boardRun(out, [s * xE, -30], [s * xE, 30], h, y0, 0);
    for (const t of [-1, 1]) boardRun(out, [s * xE, t * 30], [s * 55.5, t * zS], h, y0, 3);
  }
  // fita de LED contínua na testeira do anel superior (segue o anel com cantos curvos)
  {
    const d = BOWL.fasciaD - 0.04, y0r = 13.3, hr = 1.45;
    let u = 0;
    for (let i = 0; i < samples.length; i++) {
      const s0 = samples[i], s1 = samples[(i + 1) % samples.length];
      const p0 = [s0.cx + s0.nx * d, s0.cz + s0.nz * d], p1 = [s1.cx + s1.nx * d, s1.cz + s1.nz * d];
      const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      if (len < 1e-3) continue;
      const base = out.pos.length / 3;
      for (const [p, s] of [[p0, s0], [p1, s1], [p1, s1], [p0, s0]]) out.nor.push(-s.nx, 0, -s.nz);
      out.pos.push(p0[0], y0r, p0[1], p1[0], y0r, p1[1], p1[0], y0r + hr, p1[1], p0[0], y0r + hr, p0[1]);
      out.uv.push(u, 0, u + len, 0, u + len, 1, u, 1);
      out.led.push(1, 1, 1, 1); out.h.push(hr, hr, hr, hr);
      out.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      u += len;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(out.nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2));
  g.setAttribute('aLed', new THREE.Float32BufferAttribute(out.led, 1));
  g.setAttribute('aH', new THREE.Float32BufferAttribute(out.h, 1));
  g.setIndex(out.idx);
  const atlas = adAtlas(stadiumName, homeColor);
  const uniforms = {
    uAds: { value: atlas }, uTime: U.uTime, uFlash: { value: 0 },
    uBright: { value: isNight ? 2.1 : 1.35 }, uFrameLight: { value: new THREE.Color(1, 1, 1).multiplyScalar(isNight ? 3 : 5) },
  };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'placas-led';
  mesh.userData.uniforms = uniforms;
  return mesh;
}
