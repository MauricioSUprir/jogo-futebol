// Estádio: dois telões gigantes pendurados sob a cobertura, em cantos opostos.
// Placar desenhado em canvas (só redesenha quando os valores mudam), emissivo,
// com grade de LED e reflexo do ambiente (material PBR). Animações de "GOL!" e
// "REPLAY" são feitas no shader sobre uma segunda textura (texto com alfa).
import * as THREE from 'three';
import { BOWL } from './stadium-bowl.js';

export const SCREEN = { W: 15, H: 15 / (1024 / 448), d: 12.9, y: 25.9, tilt: 0.14 };

// centro, normal "para fora" e matriz de cada telão (NE e SO)
export function screenSpots() {
  const out = [];
  for (const [sx, sz] of [[1, 1], [-1, -1]]) {
    const n = new THREE.Vector3(sx, 0, sz).normalize();
    const c = new THREE.Vector3(sx * BOWL.A, SCREEN.y, sz * BOWL.B).addScaledVector(n, SCREEN.d);
    const o = new THREE.Object3D();
    o.position.copy(c);
    o.lookAt(c.clone().addScaledVector(n, -100).add(new THREE.Vector3(0, -100 * Math.tan(SCREEN.tilt), 0)));
    o.updateMatrix();
    out.push({ c, n, m: o.matrix.clone() });
  }
  return out;
}

// moldura, pendurais e passarela de manutenção (vão para a malha de estrutura)
export function screenFrames(st) {
  const { W, H } = SCREEN;
  for (const s of screenSpots()) {
    const local = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(s.m);
    st.box(W + 0.7, H + 0.7, 0.9, 0x0c0d10, s.m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, -0.5)));
    // bisel prateado
    for (const [x, y, w, h] of [[0, H / 2 + 0.3, W + 0.7, 0.1], [0, -H / 2 - 0.3, W + 0.7, 0.1], [W / 2 + 0.3, 0, 0.1, H + 0.7], [-W / 2 - 0.3, 0, 0.1, H + 0.7]]) {
      st.box(w, h, 0.12, 0x8d9299, s.m.clone().multiply(new THREE.Matrix4().makeTranslation(x, y, -0.02)));
    }
    // passarela de manutenção embaixo
    st.box(W + 0.4, 0.08, 1.0, 0x1a1c20, s.m.clone().multiply(new THREE.Matrix4().makeTranslation(0, -H / 2 - 0.45, -0.3)));
    // pendurais até a cobertura
    for (const x of [-W * 0.42, -W * 0.14, W * 0.14, W * 0.42]) {
      const a = local(x, H / 2 + 0.35, -0.5);
      const b = a.clone(); b.y = BOWL.roofY - 1.0;
      st.beam(a, b, 0.12, 0.12, 0x6d7278);
    }
  }
}

const font = (px, w = 900, it = true) => `${it ? 'italic ' : ''}${w} ${px}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;

function fitText(g, text, x, y, maxW, align = 'center') {
  g.textAlign = align;
  const w = g.measureText(text).width;
  if (w <= maxW) { g.fillText(text, x, y); return; }
  g.save(); g.translate(x, y); g.scale(maxW / w, 1); g.fillText(text, 0, 0); g.restore();
}

const lum = (hex) => { const c = new THREE.Color(hex); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; };

function drawBoard(g, W, H, s, name, accent) {
  const k = W / 1024;
  g.save(); g.scale(k, k);
  const bg = g.createLinearGradient(0, 0, 0, 448);
  bg.addColorStop(0, '#0b1016'); bg.addColorStop(1, '#030507');
  g.fillStyle = bg; g.fillRect(0, 0, 1024, 448);
  // padrão diagonal sutil na cor de destaque
  g.globalAlpha = 0.07; g.strokeStyle = accent; g.lineWidth = 10;
  for (let x = -448; x < 1024; x += 38) { g.beginPath(); g.moveTo(x, 448); g.lineTo(x + 448, 0); g.stroke(); }
  g.globalAlpha = 1;
  // faixa superior
  const band = g.createLinearGradient(0, 0, 1024, 0);
  band.addColorStop(0, s.homeColor); band.addColorStop(0.5, '#10151c'); band.addColorStop(1, s.awayColor);
  g.fillStyle = band; g.fillRect(0, 0, 1024, 14);
  // times e placar
  g.textBaseline = 'middle';
  const chip = (x, col) => {
    g.fillStyle = col; g.fillRect(x, 58, 26, 120);
    if (lum(col) < 0.05) { g.strokeStyle = '#6b737d'; g.lineWidth = 3; g.strokeRect(x + 1.5, 59.5, 23, 117); }
  };
  chip(34, s.homeColor); chip(1024 - 60, s.awayColor);
  g.fillStyle = '#ffffff'; g.font = font(100);
  fitText(g, String(s.home).toUpperCase(), 76, 122, 300, 'left');
  fitText(g, String(s.away).toUpperCase(), 1024 - 76, 122, 300, 'right');
  // caixa do placar
  g.fillStyle = '#f4f6f8'; g.beginPath(); g.roundRect(392, 52, 240, 140, 18); g.fill();
  g.fillStyle = '#05070a'; g.font = font(112, 900, false);
  fitText(g, String(s.homeScore), 452, 126, 100);
  fitText(g, String(s.awayScore), 572, 126, 100);
  g.fillRect(506, 118, 12, 10);
  // relógio numa pílula na cor de destaque
  g.fillStyle = accent; g.beginPath(); g.roundRect(412, 212, 200, 74, 37); g.fill();
  g.fillStyle = lum(accent) > 0.45 ? '#05070a' : '#ffffff'; g.font = font(58, 900, false);
  fitText(g, String(s.clock), 512, 251, 170);
  // rodapé: nome do estádio + AO VIVO
  g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(0, 330, 1024, 86);
  g.fillStyle = '#e8ecef'; g.font = font(44, 800);
  fitText(g, name.toUpperCase(), 40, 374, 700, 'left');
  g.fillStyle = '#ff2d2d'; g.beginPath(); g.arc(858, 374, 12, 0, 7); g.fill();
  g.fillStyle = '#ffffff'; g.font = font(38, 900, false);
  fitText(g, 'AO VIVO', 880, 376, 130, 'left');
  g.restore();
}

function drawOverlay(g, W, H, kind, text) {
  g.clearRect(0, 0, W, H);
  const k = W / 1024;
  g.save(); g.scale(k, k);
  g.textBaseline = 'middle';
  if (kind === 'goal') {
    g.font = font(250);
    const sc = Math.min(1, 900 / g.measureText(text).width);
    g.translate(512, 232); g.scale(sc, 1);
    g.textAlign = 'center'; g.lineJoin = 'round';
    g.lineWidth = 26; g.strokeStyle = 'rgba(0,0,0,0.85)';
    g.strokeText(text, 0, 0);
    g.fillStyle = '#ffffff';
    g.fillText(text, 0, 0);
  } else if (kind === 'replay') {
    g.fillStyle = 'rgba(0,0,0,0.78)'; g.fillRect(0, 150, 1024, 150);
    g.font = font(130); g.fillStyle = '#ffffff';
    fitText(g, text, 512, 232, 900);
  }
  g.restore();
}

export function buildScreens(ctx) {
  const { U, isNight, stadiumName, accent } = ctx;
  const low = (ctx.detail ?? 2) === 0;
  const CW = low ? 512 : 1024, CH = Math.round(CW * 448 / 1024);
  const mk = () => {
    const c = document.createElement('canvas'); c.width = CW; c.height = CH;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return { c, g: c.getContext('2d'), t };
  };
  const board = mk(), over = mk();
  const state = { home: 'CASA', away: 'VIS', homeScore: 0, awayScore: 0, clock: "0'", homeColor: ctx.homeColor, awayColor: ctx.awayColor };
  let key = '';
  const redraw = () => {
    const k = JSON.stringify(state);
    if (k === key) return false;
    key = k;
    drawBoard(board.g, CW, CH, state, stadiumName, accent);
    board.t.needsUpdate = true;
    return true;
  };
  redraw();

  const uni = {
    uOverlay: { value: over.t }, uMode: { value: 0 }, uStart: { value: -1e4 }, uTime: U.uTime,
    uAccent: { value: new THREE.Color(accent) }, uAccent2: { value: new THREE.Color(ctx.seatA) },
  };
  const mat = new THREE.MeshStandardMaterial({
    color: 0x030405, roughness: 0.22, metalness: 0.0,
    emissive: 0xffffff, emissiveMap: board.t, emissiveIntensity: isNight ? 1.9 : 2.4,
  });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uOverlay;
        uniform float uMode;
        uniform float uStart;
        uniform float uTime;
        uniform vec3 uAccent;
        uniform vec3 uAccent2;`)
      .replace('#include <emissivemap_fragment>', /* glsl */`
        vec2 suv = vEmissiveMapUv;
        vec3 scr = texture2D( emissiveMap, suv ).rgb;
        // brilho que atravessa o placar de tempos em tempos
        float sw = fract( uTime / 7.0 ) * 3.0 - 1.0;
        scr *= 1.0 + 0.35 * exp( -( ( ( suv.x + suv.y * 0.4 - sw ) * 9.0 ) * ( ( suv.x + suv.y * 0.4 - sw ) * 9.0 ) ) );
        float t = uTime - uStart;
        if ( uMode > 0.5 && uMode < 1.5 ) {
          // GOL: raios girando nas cores do clube + texto com "soco" de zoom e pulso
          float inT = smoothstep( 0.0, 0.3, t ), outT = 1.0 - smoothstep( 7.0, 7.8, t );
          vec2 p = ( suv - 0.5 ) * vec2( 2.29, 1.0 );
          float ang = atan( p.y, p.x ) + t * 1.4;
          float rays = step( 0.5, fract( ang * 2.5465 ) );
          vec3 bg = mix( uAccent2 * 0.6 + 0.02, uAccent, rays ) * ( 0.55 + 0.45 * sin( t * 10.0 ) * exp( -t * 0.3 ) );
          bg *= 1.0 - 0.5 * length( p );
          float sc = mix( 2.2, 1.0, smoothstep( 0.0, 0.35, t ) ) * ( 1.0 + 0.05 * sin( t * 8.0 ) );
          vec2 q = ( suv - 0.5 ) / sc + 0.5;
          q.x += sin( t * 30.0 ) * 0.006 * exp( -t * 2.0 );
          vec4 ov = texture2D( uOverlay, q );
          ov.a *= step( 0.0, q.x ) * step( q.x, 1.0 ) * step( 0.0, q.y ) * step( q.y, 1.0 );
          vec3 g = mix( bg, ov.rgb * ( 1.2 + 0.4 * sin( t * 12.0 ) ), ov.a );
          g += vec3( 1.0 ) * exp( -t * 5.0 ) * 1.5;   // clarão inicial
          scr = mix( scr, g, inT * outT );
        } else if ( uMode > 1.5 ) {
          // REPLAY: faixa com barras que varrem e selo piscando
          float inT = smoothstep( 0.0, 0.4, t );
          vec2 q = suv; q.x += ( 1.0 - inT ) * 1.2;
          vec4 ov = texture2D( uOverlay, q );
          ov.a *= step( 0.0, q.x ) * step( q.x, 1.0 );
          float bars = step( 0.5, fract( ( suv.x - suv.y * 0.35 ) * 6.0 - t * 1.5 ) );
          vec3 bg = scr * 0.35 + uAccent * bars * 0.08;
          scr = mix( bg, ov.rgb, ov.a );
          float dot = step( length( ( suv - vec2( 0.06, 0.88 ) ) * vec2( 2.29, 1.0 ) ), 0.035 ) * step( 0.5, fract( t * 1.2 ) );
          scr = mix( scr, vec3( 1.0, 0.1, 0.1 ), dot );
        }
        // grade de LED (some com a distância para não cintilar)
        vec2 px = suv * vec2( ${(SCREEN.W / 0.03).toFixed(1)}, ${(SCREEN.H / 0.03).toFixed(1)} );
        vec2 fw = fwidth( px );
        float fade = 1.0 - clamp( max( fw.x, fw.y ) * 0.7, 0.0, 1.0 );
        vec2 gp = abs( fract( px ) - 0.5 );
        scr *= 1.0 - smoothstep( 0.3, 0.5, max( gp.x, gp.y ) ) * 0.6 * fade;
        totalEmissiveRadiance *= scr;`);
  };
  mat.customProgramCacheKey = () => 'golaco-telao';

  // duas faces numa só geometria (1 draw call)
  const geos = screenSpots().map((s) => {
    const g = new THREE.PlaneGeometry(SCREEN.W, SCREEN.H);
    g.applyMatrix4(s.m);
    return g;
  });
  const pos = [], nor = [], uv = [], idx = [];
  geos.forEach((g) => {
    const o = pos.length / 3;
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); uv.push(...g.attributes.uv.array);
    for (const i of g.index.array) idx.push(i + o);
    g.dispose();
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'teloes';

  let overKey = '';
  mesh.userData.setScoreboard = (v = {}) => {
    for (const k of Object.keys(state)) if (v[k] !== undefined && v[k] !== null) state[k] = v[k];
    return redraw();
  };
  mesh.userData.show = (kind, text, time) => {
    const mode = kind === 'goal' ? 1 : kind === 'replay' ? 2 : 0;
    if (mode) {
      const tx = text || (mode === 1 ? 'GOL!' : 'REPLAY');
      const k = kind + '|' + tx;
      if (k !== overKey) { overKey = k; drawOverlay(over.g, CW, CH, kind, tx); over.t.needsUpdate = true; }
      if (uni.uMode.value !== mode || mode === 1) uni.uStart.value = time;
    }
    uni.uMode.value = mode;
  };
  // o GOL some sozinho; o REPLAY fica até 'none' (com um limite de segurança)
  mesh.userData.update = (time) => {
    const t = time - uni.uStart.value;
    if ((uni.uMode.value === 1 && t > 8) || (uni.uMode.value === 2 && t > 40)) uni.uMode.value = 0;
  };
  mesh.userData.dispose = () => { board.t.dispose(); over.t.dispose(); };
  return mesh;
}
