// Estádio: refletores presos à passarela técnica — caixas emissivas (bloom),
// brilho com estrelas/rastro anamórfico (sprites instanciados) e, nas qualidades
// altas, cones de luz aditivos bem sutis no ar noturno. 3 draw calls no máximo.
import * as THREE from 'three';
import { floodlightSpots } from './stadium-bowl.js';

const glowVert = /* glsl */`
attribute vec3 aPos;
attribute vec3 aAim;
attribute float aSeed;
uniform float uTime;
varying vec2 vUv;
varying float vI;
void main() {
  vec3 toCam = normalize( cameraPosition - aPos );
  float f = max( dot( aAim, toCam ), 0.0 );
  float dist = length( cameraPosition - aPos );
  // tamanho em mundo cresce com a distância (mínimo aparente) e com o alinhamento
  float size = ( 0.8 + 3.0 * pow( f, 3.0 ) ) * clamp( dist / 90.0, 0.6, 1.6 );
  vI = ( 0.3 + 0.95 * pow( f, 2.0 ) ) * ( 0.94 + 0.06 * sin( uTime * 50.0 + aSeed * 40.0 ) );
  vUv = position.xy * vec2( 2.6, 1.0 );
  vec4 mv = viewMatrix * vec4( aPos, 1.0 );
  mv.xy += position.xy * vec2( 2.6, 1.0 ) * size;
  gl_Position = projectionMatrix * mv;
}`;
const glowFrag = /* glsl */`
uniform float uOn;
varying vec2 vUv;
varying float vI;
void main() {
  float r = length( vUv );
  float core = exp( -r * r * 80.0 ) * 4.5;
  float halo = exp( -r * 5.0 ) * 0.16;
  // rastro horizontal (anamórfico) e 6 raios finos
  float streak = exp( -abs( vUv.y ) * 42.0 ) * exp( -abs( vUv.x ) * 1.8 ) * 0.4;
  float a6 = atan( vUv.y, vUv.x );
  float rays = pow( abs( cos( a6 * 3.0 ) ), 40.0 ) * exp( -r * 5.0 ) * 0.6;
  float a = ( core + halo + ( streak + rays ) * vI ) * vI * uOn * ( 1.0 - smoothstep( 1.8, 2.6, r ) );
  gl_FragColor = vec4( vec3( 1.0, 0.97, 0.92 ) * a, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const coneVert = /* glsl */`
attribute float aT;
varying float vT;
varying vec3 vN;
varying vec3 vW;
void main() {
  vT = aT;
  vN = normalize( normal );
  vec4 w = modelMatrix * vec4( position, 1.0 );
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const coneFrag = /* glsl */`
uniform float uI;
uniform float uTime;
varying float vT;
varying vec3 vN;
varying vec3 vW;
void main() {
  vec3 V = normalize( cameraPosition - vW );
  float edge = pow( abs( dot( normalize( vN ), V ) ), 2.2 );
  float fall = mix( 1.0, 0.1, vT ) * smoothstep( 0.0, 0.25, vT );
  float ground = smoothstep( 0.5, 9.0, vW.y );
  // poeira/umidade no ar (ruído barato que se move devagar)
  float dust = 0.8 + 0.2 * sin( vW.x * 0.35 + uTime * 0.3 ) * sin( vW.z * 0.31 - uTime * 0.2 + vW.y * 0.2 );
  float a = uI * edge * fall * ground * dust * smoothstep( 0.0, 0.06, vT );
  gl_FragColor = vec4( vec3( 0.95, 0.96, 1.0 ) * a, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function buildFloodlights(ctx) {
  const { isNight, U } = ctx;
  const detail = ctx.detail ?? 2;
  const group = new THREE.Group();
  group.name = 'refletores';
  const spots = floodlightSpots();

  // caixas (instanciadas): corpo escuro + lente emissiva
  const box = new THREE.BoxGeometry(0.95, 0.6, 0.35);
  box.translate(0, 0, 0.1);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x2a2c30, roughness: 0.45, metalness: 0.6,
    emissive: isNight ? 0xfff6e8 : 0x000000, emissiveIntensity: isNight ? 2.4 : 0,
  });
  const inst = new THREE.InstancedMesh(box, mat, spots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
  const z = new THREE.Vector3(0, 0, 1);
  spots.forEach((s, i) => {
    q.setFromUnitVectors(z, s.aim);
    m.compose(s.p, q, one);
    inst.setMatrixAt(i, m);
  });
  inst.name = 'refletores-caixas';
  group.add(inst);
  if (!isNight) return group;

  // brilho (sprites instanciados)
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const pa = new Float32Array(spots.length * 3), aa = new Float32Array(spots.length * 3), sa = new Float32Array(spots.length);
  spots.forEach((s, i) => { s.p.clone().addScaledVector(s.aim, 0.35).toArray(pa, i * 3); s.aim.toArray(aa, i * 3); sa[i] = Math.random(); });
  g.setAttribute('aPos', new THREE.InstancedBufferAttribute(pa, 3));
  g.setAttribute('aAim', new THREE.InstancedBufferAttribute(aa, 3));
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(sa, 1));
  g.instanceCount = spots.length;
  const gm = new THREE.ShaderMaterial({
    uniforms: { uOn: { value: 1 }, uTime: U.uTime }, vertexShader: glowVert, fragmentShader: glowFrag,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  });
  const glow = new THREE.Mesh(g, gm);
  glow.frustumCulled = false;
  glow.renderOrder = 5;
  glow.name = 'refletores-brilho';
  group.add(glow);

  // cones de luz no ar (só alta/ultra)
  if (detail >= 2) {
    const pos = [], nor = [], tt = [], idx = [];
    // um cone por grupo de ~6 refletores
    const groups = new Map();
    spots.forEach((s) => {
      const k = `${Math.round(s.p.x / 14)}|${Math.round(s.p.z / 14)}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(s);
    });
    const up = new THREE.Vector3(0, 1, 0);
    for (const list of groups.values()) {
      const p = new THREE.Vector3(), aim = new THREE.Vector3();
      for (const s of list) { p.add(s.p); aim.add(s.aim); }
      p.divideScalar(list.length); aim.normalize();
      const len = -p.y / aim.y;                       // até o gramado
      const cg = new THREE.CylinderGeometry(1.0, len * Math.tan(0.16), len, 18, 1, true);
      const ty = [];
      const cp = cg.attributes.position;
      for (let i = 0; i < cp.count; i++) ty.push(0.5 - cp.getY(i) / len);
      cg.translate(0, -len / 2, 0);                   // ápice na origem, abre para -y
      const mm = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(up.clone().negate(), aim)).setPosition(p);
      cg.applyMatrix4(mm);
      const o = pos.length / 3;
      pos.push(...cg.attributes.position.array); nor.push(...cg.attributes.normal.array); tt.push(...ty);
      for (const i of cg.index.array) idx.push(i + o);
      cg.dispose();
    }
    const cgeo = new THREE.BufferGeometry();
    cgeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    cgeo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    cgeo.setAttribute('aT', new THREE.Float32BufferAttribute(tt, 1));
    cgeo.setIndex(idx);
    const cm = new THREE.ShaderMaterial({
      uniforms: { uI: { value: 0.011 }, uTime: U.uTime }, vertexShader: coneVert, fragmentShader: coneFrag,
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    const cones = new THREE.Mesh(cgeo, cm);
    cones.name = 'cones-de-luz';
    cones.renderOrder = 4;
    group.add(cones);
  }
  return group;
}
