// Traves, travessão, armação de trás, redes animadas (impacto da bola + vento) e
// bandeirinhas de escanteio tremulando. Traves/armação/redes/bandeiras: 5 draws.
import * as THREE from 'three';
import { PITCH, GOAL } from './config.js';
import { mergeSimple } from './stadium-bowl.js';

const MAX_IMP = 4;

function tube(a, b, r, seg = 12) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const g = new THREE.CylinderGeometry(r, r, dir.length(), seg, 1, false);
  g.translate(0, dir.length() / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
  g.translate(a.x, a.y, a.z);
  const n = g.toNonIndexed(); g.dispose();
  return n;
}
function ball(p, r) {
  const g = new THREE.SphereGeometry(r, 12, 8);
  g.translate(p.x, p.y, p.z);
  const n = g.toNonIndexed(); g.dispose();
  return n;
}

// textura da rede: malha quadrada, 4×4 células por repetição
function netTexture() {
  const S = 128, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  g.strokeStyle = 'rgba(255,255,255,1)';
  g.lineWidth = 3.2;
  for (let i = 0; i <= 4; i++) {
    const p = i * S / 4;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, S); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(S, p); g.stroke();
  }
  g.fillStyle = '#fff';
  for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) { g.beginPath(); g.arc(i * S / 4, j * S / 4, 3, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildGoals(ctx) {
  const { U, anisotropy, shadows } = ctx;
  const group = new THREE.Group();
  group.name = 'gols';
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const r = GOAL.postRadius, hw = GOAL.halfWidth + r, top = GOAL.height + r;
  const posts = [], frame = [];
  const nets = { pos: [], uv: [], nrm: [], pin: [], idx: [] };
  const rf = 0.022;

  for (const s of [-1, 1]) {
    const x = s * PITCH.halfL;
    // traves e travessão: medida interna 7,32 × 2,44
    for (const z of [-hw, hw]) {
      posts.push(tube(V(x, 0, z), V(x, top, z), r, 20));
      posts.push(ball(V(x, top, z), r));
    }
    posts.push(tube(V(x, top, -hw), V(x, top, hw), r, 20));
    // armação de trás
    const xb = x + s * GOAL.depth, xt = x + s * GOAL.topDepth, yt = GOAL.height;
    for (const z of [-hw, hw]) {
      frame.push(tube(V(x, 0.02, z), V(xb, 0.02, z), rf));
      frame.push(tube(V(x, yt, z), V(xt, yt, z), rf));
      frame.push(tube(V(xt, yt, z), V(xb, 0.02, z), rf));
    }
    frame.push(tube(V(xb, 0.02, -hw), V(xb, 0.02, hw), rf));
    frame.push(tube(V(xt, yt, -hw), V(xt, yt, hw), rf));

    // rede: teto, fundo inclinado e laterais
    const panel = (nu, nv, fn, nrm, lenU, lenV) => {
      const base = nets.pos.length / 3;
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
        const u = i / nu, v = j / nv, p = fn(u, v);
        nets.pos.push(p.x, p.y, p.z);
        nets.uv.push(u * lenU / 0.48, v * lenV / 0.48);
        nets.nrm.push(nrm.x, nrm.y, nrm.z);
        nets.pin.push(Math.pow(Math.sin(Math.PI * u) * Math.sin(Math.PI * v), 0.7));
      }
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
        const a = base + j * (nu + 1) + i, b = a + 1, c = a + nu + 2, d = a + nu + 1;
        nets.idx.push(a, b, c, a, c, d);
      }
    };
    const W = 2 * hw, yTop = GOAL.height + 0.03;
    panel(24, 5, (u, v) => V(x + s * (0.05 + v * (GOAL.topDepth - 0.05)), yTop, -hw + u * W), V(0, 1, 0), W, GOAL.topDepth);
    const sl = Math.hypot(GOAL.depth - GOAL.topDepth, GOAL.height);
    const bn = new THREE.Vector3(s * GOAL.height, GOAL.depth - GOAL.topDepth, 0).normalize();
    panel(24, 10, (u, v) => V(xt + s * v * (GOAL.depth - GOAL.topDepth), yTop * (1 - v) + 0.01, -hw + u * W), bn, W, sl);
    for (const sz of [-1, 1]) {
      panel(8, 10, (u, v) => {
        const y = v * yTop, dep = THREE.MathUtils.lerp(GOAL.depth, GOAL.topDepth, v);
        return V(x + s * (0.05 + u * (dep - 0.05)), y, sz * hw);
      }, V(0, 0, sz), GOAL.depth, GOAL.height);
    }
  }

  const postMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.28, metalness: 0.15 });
  const postMesh = new THREE.Mesh(mergeSimple(posts), postMat);
  posts.forEach((g) => g.dispose());
  postMesh.castShadow = shadows; postMesh.receiveShadow = true;
  postMesh.name = 'traves';
  group.add(postMesh);
  const frameMesh = new THREE.Mesh(mergeSimple(frame), new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.35, metalness: 0.85 }));
  frame.forEach((g) => g.dispose());
  frameMesh.castShadow = shadows;
  frameMesh.name = 'armacao';
  group.add(frameMesh);

  // ---- rede
  const ng = new THREE.BufferGeometry();
  ng.setAttribute('position', new THREE.Float32BufferAttribute(nets.pos, 3));
  ng.setAttribute('uv', new THREE.Float32BufferAttribute(nets.uv, 2));
  ng.setAttribute('normal', new THREE.Float32BufferAttribute(nets.nrm, 3));
  ng.setAttribute('aNrm', new THREE.Float32BufferAttribute(nets.nrm, 3));
  ng.setAttribute('aPin', new THREE.Float32BufferAttribute(nets.pin, 1));
  ng.setIndex(nets.idx);
  const netTex = netTexture();
  netTex.anisotropy = anisotropy;
  const netMat = new THREE.MeshStandardMaterial({
    map: netTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 0.85, metalness: 0,
    color: 0xffffff,
  });
  const imp = Array.from({ length: MAX_IMP }, () => new THREE.Vector4(0, 0, 0, -1e4));
  const impS = Array.from({ length: MAX_IMP }, () => new THREE.Vector2(0, 0));
  const uImp = { value: imp }, uImpS = { value: impS };
  netMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uTime: U.uTime, uWind: U.uWind, uImp, uImpS });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec3 aNrm;
attribute float aPin;
uniform float uTime;
uniform vec2 uWind;
uniform vec4 uImp[ ${MAX_IMP} ];
uniform vec2 uImpS[ ${MAX_IMP} ];`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
float disp = 0.0;
for ( int i = 0; i < ${MAX_IMP}; i ++ ) {
  vec4 im = uImp[ i ]; vec2 st = uImpS[ i ];
  float t = uTime - im.w;
  if ( t < 0.0 || t > 3.5 || st.x <= 0.0 ) continue;
  float side = step( 0.0, position.x * st.y );
  vec3 dv = position - im.xyz;
  float r2 = dot( dv, dv );
  float env = ( t / 0.09 ) * exp( 1.0 - t / 0.09 );
  float osc = sin( t * 16.0 ) * exp( -t * 3.5 );
  float ring = cos( sqrt( r2 ) * 7.0 - t * 20.0 ) * exp( -t * 2.5 ) * exp( -r2 / 2.5 );
  disp += side * st.x * ( exp( -r2 / 0.45 ) * ( 0.55 * env + 0.14 * osc ) + 0.06 * ring );
}
float wAmp = length( uWind );
disp += ( sin( position.z * 2.3 + uTime * 2.1 + position.y * 1.7 ) + 0.5 * sin( position.z * 5.1 - uTime * 3.3 ) ) * 0.006 * wAmp;
transformed += aNrm * disp * aPin;`);
  };
  const netMesh = new THREE.Mesh(ng, netMat);
  netMesh.name = 'redes';
  netMesh.renderOrder = 3;
  group.add(netMesh);

  let slot = 0;
  function impact(goalSign, point, strength, time) {
    const i = slot++ % MAX_IMP;
    imp[i].set(point.x, point.y, point.z, time);
    impS[i].set(THREE.MathUtils.clamp(strength, 0, 1), goalSign >= 0 ? 1 : -1);
  }

  // ---- bandeirinhas de escanteio
  const poles = [];
  const flag = { pos: [], uv: [], pole: [], idx: [] };
  const NU = 10, NV = 6;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * PITCH.halfL, z = sz * PITCH.halfW;
    const g = tube(V(x, 0, z), V(x, 1.55, z), 0.018, 8);
    const col = new Float32Array(g.attributes.position.count * 3).fill(0.85);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    poles.push(g);
    const base = flag.pos.length / 3;
    for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
      flag.pos.push(i / NU, j / NV, 0);
      flag.uv.push(i / NU, j / NV);
      flag.pole.push(x, 1.55, z);
    }
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
      const a = base + j * (NU + 1) + i, b = a + 1, c = a + NU + 2, d = a + NU + 1;
      flag.idx.push(a, b, c, a, c, d);
    }
  }
  const poleMesh = new THREE.Mesh(mergeSimple(poles), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }));
  poles.forEach((g) => g.dispose());
  poleMesh.castShadow = shadows;
  poleMesh.name = 'mastros';
  group.add(poleMesh);

  const fc = document.createElement('canvas');
  fc.width = 64; fc.height = 64;
  const fg = fc.getContext('2d');
  fg.fillStyle = '#ffd21a'; fg.fillRect(0, 0, 64, 64);
  fg.fillStyle = '#e8261b'; fg.beginPath(); fg.moveTo(0, 64); fg.lineTo(64, 64); fg.lineTo(64, 0); fg.fill();
  const ftex = new THREE.CanvasTexture(fc);
  ftex.colorSpace = THREE.SRGBColorSpace;
  const fgeo = new THREE.BufferGeometry();
  fgeo.setAttribute('position', new THREE.Float32BufferAttribute(flag.pos, 3));
  fgeo.setAttribute('uv', new THREE.Float32BufferAttribute(flag.uv, 2));
  fgeo.setAttribute('aPole', new THREE.Float32BufferAttribute(flag.pole, 3));
  fgeo.setIndex(flag.idx);
  fgeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 80);
  const fmat = new THREE.MeshStandardMaterial({ map: ftex, side: THREE.DoubleSide, roughness: 0.8 });
  fmat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uTime: U.uTime, uWind: U.uWind });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aPole;\nuniform float uTime;\nuniform vec2 uWind;')
      .replace('#include <beginnormal_vertex>', `
float spd = length( uWind );
vec2 wd = spd > 0.05 ? uWind / spd : vec2( 0.7, 0.7 );
float lift = clamp( spd / 6.0, 0.15, 1.0 );
vec3 dir = normalize( vec3( wd.x, 0.0, wd.y ) * lift + vec3( 0.0, -1.0, 0.0 ) * ( 1.0 - lift ) * 0.8 );
vec3 side = normalize( cross( dir, vec3( 0.0, 1.0, 0.0 ) ) + 1e-4 );
float u = position.x, v = position.y;
float ph = uTime * ( 5.0 + spd * 1.6 ) - u * 6.0 + aPole.x * 0.37 + aPole.z * 0.21;
float amp = u * ( 0.03 + 0.012 * spd );
vec3 objectNormal = normalize( side + dir * cos( ph ) * u * 0.8 );`)
      .replace('#include <begin_vertex>', `
vec3 transformed = aPole - vec3( 0.0, ( 1.0 - v ) * 0.36, 0.0 ) + dir * u * 0.46 + side * sin( ph ) * amp
  + vec3( 0.0, sin( ph * 0.7 ) * 0.015 * u, 0.0 );`);
  };
  const flagMesh = new THREE.Mesh(fgeo, fmat);
  flagMesh.frustumCulled = false;
  flagMesh.castShadow = false;
  flagMesh.name = 'bandeirinhas';
  group.add(flagMesh);

  group.userData.impact = impact;
  return group;
}
