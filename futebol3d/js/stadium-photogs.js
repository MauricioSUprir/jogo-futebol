// Estádio: fotógrafos atrás das linhas de fundo — gente de verdade (proporções de um
// adulto de ~1,75 m), colete de imprensa fictício (verde-limão com faixa refletiva e
// "IMPRENSA" nas costas, ou preto com faixa verde), câmera com teleobjetiva branca ou
// preta, monopé, segunda câmera pendurada e mochila. Três posturas: sentado no
// banquinho dobrável, ajoelhado num joelho só e de pé.
//
// Desempenho: todos numa ÚNICA malha mesclada (1 chamada de desenho, +1 na sombra).
// Cada vértice leva o "pivô" do seu fotógrafo (x, z, rumo, semente) e se pertence à
// parte de cima (tronco, braços, cabeça, câmera): o shader de vértice gira essa parte
// em volta do eixo vertical para seguir a bola (uBall) — panorâmica de verdade, sem
// nenhuma matriz por quadro na CPU (mesma ideia das multidões "vertex animated" do
// GPU Gems 3, cap. 2: instância barata + pose resolvida na GPU).
//
// API (usada por stadium.js e fx.js):
//   buildPhotographers(ctx) -> THREE.Mesh   (userData.uniforms: uTime, uBall, uGoalT)
//   photogFlashPoints(quality) -> Float32Array [x, y, z, semente, ...] (posição do flash
//     de cada câmera na pose de repouso) — o fx.js acende os flashes nesses pontos.
import * as THREE from 'three';
import { PITCH } from './config.js';
import { mulberry } from './stadium-geo.js';

// ---------------------------------------------------------------- distribuição
const COUNT = { baixa: 12, media: 22, alta: 30 };

export function photogQualityKey(q) {
  if (typeof q === 'string') return COUNT[q] ? q : q === 'ultra' ? 'alta' : 'media';
  const l = (q?.label || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (COUNT[l]) return l;
  if (l === 'ultra') return 'alta';
  const c = q?.crowd ?? 0.7;
  return c < 0.5 ? 'baixa' : c < 0.85 ? 'media' : 'alta';
}

// posições determinísticas (fx.js usa a mesma lista para os flashes)
function layout(qk) {
  const n = COUNT[qk] || COUNT.media;
  const rng = mulberry(4242);
  const out = [];
  // fileiras dos dois lados de cada gol (fora da rede: |z| > 6), do poste até a quina
  const slots = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      for (let k = 0; k < 9; k++) slots.push({ sx, z: sz * (6.4 + k * 1.55), k });
    }
  }
  // embaralha mantendo prioridade perto do gol (mais disputado)
  slots.forEach((s) => { s.w = s.k + rng() * 3.5; });
  slots.sort((a, b) => a.w - b.w);
  const pick = slots.slice(0, n);
  for (const s of pick) {
    const r = rng();
    // de pé fica mais atrás (não tapa quem está sentado); perto da quina, mais em pé
    const pose = r < 0.5 - s.k * 0.02 ? 0 : r < 0.78 ? 1 : 2;   // 0 banquinho, 1 ajoelhado, 2 de pé
    const back = pose === 2 ? 1.5 + rng() * 0.4 : 0.15 + rng() * 0.6;
    const x = s.sx * (PITCH.halfL + 2.25 + back);
    const z = s.z + (rng() - 0.5) * 0.5;
    // mira: área do gol mais próximo, puxando para o meio-campo
    const tx = s.sx * (PITCH.halfL - 14 - rng() * 12), tz = z * 0.25;
    const yaw = Math.atan2(tx - x, tz - z);
    out.push({ x, z, yaw, pose, seed: rng() });
  }
  return out;
}

// ---------------------------------------------------------------- acumulador
class Acc {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.piv = []; this.aux = []; }
  // geo em espaço local do fotógrafo; m = matriz local→mundo; aux = [rig, vest-v, costas, tipo]
  add(geo, color, rig, P, m, kind = 0) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.applyMatrix4(m);
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    const loc = geo.userData.loc;   // y local (para o padrão do colete)
    const c = color.isColor ? color : new THREE.Color(color);
    for (let i = 0; i < p.length; i += 3) {
      this.pos.push(p[i], p[i + 1], p[i + 2]);
      this.nor.push(n[i], n[i + 1], n[i + 2]);
      this.col.push(c.r, c.g, c.b);
      this.piv.push(P.x, P.z, P.yaw, P.seed);
      this.aux.push(rig, loc ? loc[(i / 3) * 2] : 0, loc ? loc[(i / 3) * 2 + 1] : 0, kind);
    }
    if (g !== geo) g.dispose();
    geo.dispose();
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aPiv', new THREE.Float32BufferAttribute(this.piv, 4));
    g.setAttribute('aAux', new THREE.Float32BufferAttribute(this.aux, 4));
    g.computeBoundingSphere();
    return g;
  }
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _q = new THREE.Quaternion(), _up = V(0, 1, 0);

// segmento troncocônico de a até b (raio ra em a, rb em b), seção elíptica (ex = escala x)
function segGeo(a, b, ra, rb, radial, ex = 1, ez = 1) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const g = new THREE.CylinderGeometry(rb, ra, len, radial, 1, false);
  g.scale(ex, 1, ez);
  g.translate(0, len / 2, 0);
  _q.setFromUnitVectors(_up, d.clone().normalize());
  g.applyQuaternion(_q);
  g.translate(a.x, a.y, a.z);
  return g;
}
function ballGeo(c, r, w = 6, h = 4, sx = 1, sy = 1, sz = 1) {
  const g = new THREE.SphereGeometry(r, w, h);
  g.scale(sx, sy, sz);
  g.translate(c.x, c.y, c.z);
  return g;
}
// calota (meia esfera) inclinada para trás: cabelo/boné sem cobrir o rosto
function domeGeo(c, rx, ry, rz, tilt, w = 9, h = 4) {
  const g = new THREE.SphereGeometry(1, w, h, 0, Math.PI * 2, 0, Math.PI * 0.55);
  g.scale(rx, ry, rz);
  g.rotateX(-tilt);
  g.translate(c.x, c.y, c.z);
  return g;
}
function boxGeo(w, h, d, c, rx = 0, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  g.translate(c.x, c.y, c.z);
  return g;
}
// guarda, para o colete, a altura relativa (0 barra .. 1 ombro) e se é costas
function tagVest(g, y0, y1, zc) {
  const p = g.attributes.position;
  const loc = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    loc[i * 2] = (p.getY(i) - y0) / (y1 - y0);
    loc[i * 2 + 1] = p.getZ(i) < zc ? 1 : 0;
  }
  if (g.index) {
    // toNonIndexed perde o userData: expande aqui
    const idx = g.index.array, out = new Float32Array(idx.length * 2);
    for (let k = 0; k < idx.length; k++) { out[k * 2] = loc[idx[k] * 2]; out[k * 2 + 1] = loc[idx[k] * 2 + 1]; }
    g.userData.loc = out;
  } else g.userData.loc = loc;
  return g;
}

// ---------------------------------------------------------------- posturas
// Esqueleto local: x = esquerda do fotógrafo (a direita fica em -x), y = cima,
// z = frente (para o campo). Medidas de um adulto de ~1,75 m.
function skeleton(pose) {
  if (pose === 0) {           // sentado no banquinho, cotovelo apoiado, monopé
    return {
      hip: V(0, 0.47, -0.02), chest: V(0, 0.78, 0.08), sh: 0.98, lean: 0.25,
      head: V(0, 1.15, 0.12),
      legs: [[V(0.1, 0.47, 0.0), V(0.15, 0.5, 0.44), V(0.17, 0.07, 0.46)], [V(-0.1, 0.47, 0.0), V(-0.17, 0.5, 0.42), V(-0.2, 0.07, 0.38)]],
      cam: V(-0.02, 1.13, 0.27), stool: true,
    };
  }
  if (pose === 1) {           // ajoelhado (joelho direito no chão)
    return {
      hip: V(0, 0.6, -0.08), chest: V(0, 0.92, 0.0), sh: 1.12, lean: 0.16,
      head: V(0, 1.3, 0.06),
      legs: [[V(0.1, 0.6, -0.06), V(0.12, 0.5, 0.36), V(0.13, 0.07, 0.38)], [V(-0.1, 0.6, -0.08), V(-0.12, 0.07, 0.02), V(-0.12, 0.08, -0.42)]],
      cam: V(-0.02, 1.27, 0.21), kneel: true,
    };
  }
  return {                    // de pé, câmera no monopé à altura do olho
    hip: V(0, 0.95, 0), chest: V(0, 1.26, 0.03), sh: 1.45, lean: 0.08,
    head: V(0, 1.63, 0.06),
    legs: [[V(0.1, 0.95, 0.0), V(0.11, 0.51, 0.04), V(0.12, 0.08, 0.02)], [V(-0.1, 0.95, 0.0), V(-0.12, 0.51, 0.0), V(-0.14, 0.08, -0.04)]],
    cam: V(-0.02, 1.6, 0.21),
  };
}

const SKINS = ['#f1cfb2', '#e2b48c', '#c99470', '#a8714a', '#8a5636', '#5f3a24', '#3f2617'];
const PANTS = ['#1b1d22', '#23324f', '#2f3a2c', '#3b3f46', '#5a5246', '#151618'];
const SHIRTS = ['#15171b', '#e9e9e6', '#27406b', '#3a3d44', '#5d6a7a', '#1d4f2f'];

// monta um fotógrafo na lista
function addPhotographer(A, P, lod) {
  const rng = mulberry(Math.floor(P.seed * 1e6) + 7);
  const S = skeleton(P.pose);
  const rad = lod === 'baixa' ? 5 : 7;
  const m = new THREE.Matrix4().makeRotationY(P.yaw).setPosition(P.x, 0, P.z);
  const skin = new THREE.Color(SKINS[Math.floor(rng() * SKINS.length)]);
  const pants = PANTS[Math.floor(rng() * PANTS.length)];
  const shirt = SHIRTS[Math.floor(rng() * SHIRTS.length)];
  const longSleeve = rng() < 0.55;
  const darkVest = rng() < 0.3;
  const vest = darkVest ? '#111312' : '#6cf02a';
  const lensWhite = rng() < 0.6;
  const cap = rng() < 0.55;
  const hairC = ['#16110d', '#2a1d14', '#4a3524', '#8c8a86'][Math.floor(rng() * 4)];
  const add = (g, c, rig, kind = 0) => A.add(g, c, rig, P, m, kind);

  // ---- pernas (fixas)
  for (const [h, k, a] of S.legs) {
    add(segGeo(h, k, 0.085, 0.062, rad), pants, 0);
    add(ballGeo(k, 0.062, rad, 3), pants, 0);
    add(segGeo(k, a, 0.06, 0.048, rad), pants, 0);
    // tênis: para frente (ajoelhado: a perna de trás aponta o pé para trás)
    const back = S.kneel && a.z < -0.2;
    add(boxGeo(0.1, 0.08, 0.26, V(a.x, 0.04, a.z + (back ? -0.06 : 0.07)), 0, 0), '#1c1c1e', 0);
    add(boxGeo(0.105, 0.025, 0.27, V(a.x, 0.0125, a.z + (back ? -0.06 : 0.07))), '#d9d9d6', 0);
  }
  // ---- banquinho dobrável (fixo) ou joelheira
  if (S.stool) {
    add(boxGeo(0.34, 0.035, 0.28, V(0, 0.43, -0.03)), '#202326', 0);
    for (const sx of [-1, 1]) {
      add(segGeo(V(sx * 0.15, 0.0, -0.15), V(sx * 0.15, 0.42, 0.09), 0.012, 0.012, 4), '#8d9198', 0);
      add(segGeo(V(sx * 0.15, 0.0, 0.09), V(sx * 0.15, 0.42, -0.15), 0.012, 0.012, 4), '#8d9198', 0);
    }
  }
  // mochila / case no chão (fixa), ao lado
  if (rng() < 0.75) {
    const bx = (rng() < 0.5 ? -1 : 1) * (0.45 + rng() * 0.15);
    add(boxGeo(0.34, 0.24, 0.24, V(bx, 0.12, -0.1 - rng() * 0.2), 0, rng() * 0.8), rng() < 0.5 ? '#1a1c20' : '#2b3a2a', 0);
  }

  // ---- parte de cima (gira com a panorâmica): tronco, colete, braços, cabeça, câmera
  const hip = S.hip, ch = S.chest;
  const shY = S.sh;
  const shL = V(0.19, shY - 0.03, ch.z + 0.02), shR = V(-0.19, shY - 0.03, ch.z + 0.02);
  // quadril/pelve (calça) e tronco (camisa) com o colete por cima
  add(segGeo(V(hip.x, hip.y - 0.06, hip.z), V(hip.x, hip.y + 0.1, hip.z + 0.01), 0.15, 0.155, rad + 1, 1, 0.75), pants, 1);
  const torso = segGeo(V(hip.x, hip.y + 0.08, hip.z + 0.01), V(ch.x, shY - 0.02, ch.z + 0.02), 0.155, 0.175, rad + 1, 1, 0.68);
  add(torso, shirt, 1);
  const vestG = tagVest(segGeo(V(hip.x, hip.y + 0.1, hip.z + 0.01), V(ch.x, shY - 0.06, ch.z + 0.02), 0.166, 0.186, rad + 1, 1, 0.72), hip.y + 0.1, shY - 0.06, (hip.z + ch.z) / 2 + 0.015);
  add(vestG, vest, 1, darkVest ? 2 : 1);
  add(ballGeo(V(ch.x, shY - 0.02, ch.z + 0.02), 0.19, rad + 1, 4, 1, 0.42, 0.68), shirt, 1);   // ombros
  // pescoço e cabeça
  const hd = S.head;
  add(segGeo(V(ch.x, shY - 0.02, ch.z + 0.02), V(hd.x, hd.y - 0.08, hd.z - 0.01), 0.055, 0.05, rad), skin, 1);
  add(ballGeo(hd, 1, lod === 'baixa' ? 7 : 10, lod === 'baixa' ? 5 : 8, 0.094, 0.118, 0.105), skin, 1);
  add(ballGeo(V(hd.x, hd.y - 0.03, hd.z + 0.09), 0.022, 4, 3), skin.clone().multiplyScalar(0.9), 1);   // nariz
  if (cap) {
    const capC = rng() < 0.5 ? '#121314' : rng() < 0.5 ? '#2e7d32' : '#e8e8e4';
    add(domeGeo(V(hd.x, hd.y + 0.012, hd.z - 0.005), 0.102, 0.118, 0.112, -0.25), capC, 1);
    // aba virada para trás (comum com a câmera no olho)
    add(boxGeo(0.15, 0.012, 0.09, V(hd.x, hd.y + 0.0, hd.z - 0.14), 0.3), capC, 1);
  } else {
    add(domeGeo(V(hd.x, hd.y + 0.0, hd.z - 0.006), 0.1, 0.124, 0.112, 0.45), hairC, 1);
  }
  // câmera: corpo, empunhadura, pentaprisma, teleobjetiva (anel de montagem, corpo,
  // anel de foco, para-sol), pé do tripé da lente e monopé até o chão
  const c = S.cam;
  add(boxGeo(0.15, 0.115, 0.085, c), '#141416', 1);
  add(boxGeo(0.045, 0.1, 0.075, V(c.x - 0.075, c.y - 0.01, c.z + 0.01)), '#0e0e10', 1);
  add(boxGeo(0.06, 0.05, 0.06, V(c.x, c.y + 0.075, c.z - 0.005)), '#141416', 1);
  add(boxGeo(0.025, 0.02, 0.03, V(c.x + 0.03, c.y + 0.11, c.z)), '#202022', 1);   // flash/sapata
  const lc = V(c.x, c.y - 0.005, c.z + 0.045);
  const lensLen = 0.42 + rng() * 0.14;
  const lensC = lensWhite ? '#e9e8e2' : '#18181a';
  add(segGeo(lc, V(lc.x, lc.y, lc.z + 0.05), 0.045, 0.045, rad), '#0f0f10', 1);
  add(segGeo(V(lc.x, lc.y, lc.z + 0.05), V(lc.x, lc.y, lc.z + 0.05 + lensLen * 0.55), 0.05, 0.062, rad + 1), lensC, 1);
  add(segGeo(V(lc.x, lc.y, lc.z + 0.05 + lensLen * 0.55), V(lc.x, lc.y, lc.z + 0.05 + lensLen * 0.68), 0.064, 0.064, rad + 1), '#1a1a1c', 1);
  add(segGeo(V(lc.x, lc.y, lc.z + 0.05 + lensLen * 0.68), V(lc.x, lc.y, lc.z + 0.05 + lensLen), 0.066, 0.075, rad + 1), lensC, 1);
  add(segGeo(V(lc.x, lc.y, lc.z + 0.05 + lensLen), V(lc.x, lc.y, lc.z + 0.16 + lensLen), 0.082, 0.088, rad + 1), '#111113', 1);
  add(ballGeo(V(lc.x, lc.y, lc.z + 0.155 + lensLen), 1, rad + 1, 2, 0.07, 0.07, 0.004), '#2a3d5a', 1, 3);   // vidro
  const foot = V(lc.x, lc.y - 0.09, lc.z + 0.05 + lensLen * 0.45);
  add(boxGeo(0.04, 0.06, 0.07, V(foot.x, foot.y + 0.03, foot.z)), '#141416', 1);
  if (P.pose !== 1 || rng() < 0.5) {
    add(segGeo(V(foot.x, 0.0, foot.z + 0.04), foot, 0.016, 0.014, 5), '#1d1e20', 1);
    add(segGeo(V(foot.x, foot.y * 0.55, foot.z + 0.025), V(foot.x, foot.y - 0.02, foot.z + 0.005), 0.021, 0.021, 5), '#0c0c0d', 1);   // trava
  }
  // braços: direito (−x) na empunhadura, esquerdo (+x) por baixo da lente
  const handR = V(c.x - 0.085, c.y - 0.03, c.z + 0.0);
  const handL = V(lc.x + 0.02, lc.y - 0.07, lc.z + 0.05 + lensLen * 0.38);
  const elR = V(-0.27, (shR.y + handR.y) / 2 - 0.16, (shR.z + handR.z) / 2 - 0.05);
  const elL = V(0.17, (shL.y + handL.y) / 2 - 0.18, (shL.z + handL.z) / 2 + 0.02);
  if (S.stool) elL.set(0.16, S.legs[0][1].y + 0.12, S.legs[0][1].z - 0.06);   // cotovelo apoiado no joelho
  const sleeve = shirt;
  for (const [sh, el, hand] of [[shR, elR, handR], [shL, elL, handL]]) {
    add(segGeo(sh, el, 0.058, 0.048, rad), sleeve, 1);
    add(ballGeo(el, 0.048, rad, 3), longSleeve ? sleeve : skin, 1);
    add(segGeo(el, hand, 0.044, 0.036, rad), longSleeve ? sleeve : skin, 1);
    add(ballGeo(hand, 1, 5, 4, 0.045, 0.05, 0.06), skin, 1);
  }
  // segunda câmera pendurada no quadril (lente curta) e alça no ombro
  if (rng() < 0.65) {
    const s2 = V(0.2, hip.y + 0.1, hip.z + 0.07);
    add(boxGeo(0.13, 0.1, 0.08, s2, 0, 0.3), '#141416', 1);
    add(segGeo(V(s2.x + 0.02, s2.y, s2.z + 0.04), V(s2.x + 0.06, s2.y - 0.01, s2.z + 0.15), 0.04, 0.042, 6), '#18181a', 1);
    add(segGeo(V(s2.x, s2.y + 0.05, s2.z), V(-0.12, shY - 0.02, ch.z + 0.08), 0.012, 0.012, 3), '#0d0d0e', 1);
  }
}

// ---------------------------------------------------------------- material
const VERT_HEAD = /* glsl */`
attribute vec4 aPiv;     // x, z do fotógrafo, rumo de repouso, semente
attribute vec4 aAux;     // parte de cima (1) ou fixa (0), altura no colete, costas, tipo
uniform float uTime;
uniform vec3 uBall;
uniform float uGoalT;
varying vec4 vAux;
vec3 pgYaw( vec3 p, float a ) {
  vec2 d = p.xz - aPiv.xy;
  float c = cos( a ), s = sin( a );
  return vec3( aPiv.x + c * d.x + s * d.y, p.y, aPiv.y - s * d.x + c * d.y );
}
float pgAngle() {
  // panorâmica seguindo a bola (com folga e limite), respiração e "conferir a foto"
  vec2 to = uBall.xz - aPiv.xy;
  float want = atan( to.x, to.y ) - aPiv.z;
  want = mod( want + 3.14159265, 6.2831853 ) - 3.14159265;
  float seed = aPiv.w;
  float a = clamp( want, -1.15, 1.15 ) * ( 0.75 + 0.25 * seed );
  a += 0.02 * sin( uTime * ( 0.9 + seed ) + seed * 40.0 );
  // depois do gol: todos viram para a comemoração (a bola está na rede, perto)
  return a;
}
`;
const VERT_NORMAL = /* glsl */`
#include <beginnormal_vertex>
float pgA = aAux.x > 0.5 ? pgAngle() : 0.0;
{
  float c = cos( pgA ), s = sin( pgA );
  objectNormal = vec3( c * objectNormal.x + s * objectNormal.z, objectNormal.y, -s * objectNormal.x + c * objectNormal.z );
}
`;
const VERT_POS = /* glsl */`
vec3 transformed = aAux.x > 0.5 ? pgYaw( position, pgA ) : position;
vAux = aAux;
`;

function patchVertex(sh, U) {
  Object.assign(sh.uniforms, U);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\n' + VERT_HEAD)
    .replace('#include <beginnormal_vertex>', VERT_NORMAL)
    .replace('#include <begin_vertex>', VERT_POS);
}

// colete: faixa refletiva (verde-limão) ou faixa verde (preto) e "IMPRENSA" nas costas
const FRAG = /* glsl */`
{
  float kind = floor( vAux.w + 0.5 );
  if ( kind > 0.5 && kind < 2.5 ) {
    float v = vAux.y;
    float band = step( 0.5, v ) * step( v, 0.6 );
    vec3 bandC = kind < 1.5 ? vec3( 0.72, 0.74, 0.74 ) : vec3( 0.08, 0.75, 0.2 );
    diffuseColor.rgb = mix( diffuseColor.rgb, bandC, band );
    // costas: tarja escura com letras claras (fictício, só a impressão de texto)
    if ( vAux.z > 0.5 ) {
      float tag = step( 0.66, v ) * step( v, 0.88 );
      vec3 tagC = kind < 1.5 ? vec3( 0.02 ) : vec3( 0.25, 0.9, 0.12 );
      float letters = step( 0.7, v ) * step( v, 0.84 ) * step( 0.45, fract( vWorldPg * 26.0 ) );
      diffuseColor.rgb = mix( diffuseColor.rgb, tagC, tag );
      diffuseColor.rgb = mix( diffuseColor.rgb, kind < 1.5 ? vec3( 0.75 ) : vec3( 0.02 ), letters * tag );
    }
  }
}
`;

export function buildPhotographers(ctx) {
  const qk = photogQualityKey(ctx.quality);
  const lod = qk === 'baixa' ? 'baixa' : 'media';
  const A = new Acc();
  for (const P of layout(qk)) addPhotographer(A, P, lod);
  const geo = A.geometry();
  const U = {
    uTime: ctx.U?.uTime || { value: 0 },
    uBall: { value: new THREE.Vector3(0, 0, 0) },
    uGoalT: { value: -1e4 },
  };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.0 });
  mat.onBeforeCompile = (sh) => {
    patchVertex(sh, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldPg = cos( aPiv.z ) * ( position.x - aPiv.x ) - sin( aPiv.z ) * ( position.z - aPiv.y );')
      .replace('varying vec4 vAux;', 'varying vec4 vAux;\nvarying float vWorldPg;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vAux;\nvarying float vWorldPg;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif ( vAux.w > 2.5 ) roughnessFactor = 0.08;');
  };
  mat.customProgramCacheKey = () => 'golaco-fotografos';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'fotografos';
  mesh.receiveShadow = !!ctx.shadows;
  mesh.castShadow = !!ctx.shadows;
  if (ctx.shadows) {
    const dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    dm.onBeforeCompile = (sh) => patchVertex(sh, U);
    dm.customProgramCacheKey = () => 'golaco-fotografos-sombra';
    mesh.customDepthMaterial = dm;
  }
  // passes com material de substituição (normais do GTAO) não conhecem a panorâmica:
  // sem problema (só desloca alguns cm), então não precisa pular
  mesh.userData.uniforms = U;
  mesh.userData.count = COUNT[qk];
  mesh.userData.tris = geo.attributes.position.count / 3;
  return mesh;
}

// pontos dos flashes (sapata da câmera na pose de repouso) para o fx.js
export function photogFlashPoints(quality) {
  const list = layout(photogQualityKey(quality));
  const out = new Float32Array(list.length * 4);
  list.forEach((P, i) => {
    const c = skeleton(P.pose).cam;
    const cs = Math.cos(P.yaw), sn = Math.sin(P.yaw);
    // mesma rotação do makeRotationY: x' = c x + s z, z' = -s x + c z
    const lx = c.x + 0.03, lz = c.z + 0.05;
    out[i * 4] = P.x + cs * lx + sn * lz;
    out[i * 4 + 1] = c.y + 0.13;
    out[i * 4 + 2] = P.z - sn * lx + cs * lz;
    out[i * 4 + 3] = P.seed;
  });
  return out;
}
