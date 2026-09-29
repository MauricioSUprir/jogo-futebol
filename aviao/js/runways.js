// Pistas com sinalização ICAO desenhada no shader, luzes de borda/cabeceira e PAPI.
import * as THREE from 'three';
import { registerMaterial } from './materials.js';

function numbersTexture(le, he) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, 512, 256);
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const draw = (txt, cx) => {
    const num = txt.replace(/[LRC]/, ''), side = txt.replace(/\d/g, '');
    x.font = 'bold 150px "Arial Narrow", Arial, sans-serif';
    x.save(); x.translate(cx, 128); x.scale(0.6, 1.0);
    x.fillText(num, 0, side ? 30 : 0);
    if (side) { x.font = 'bold 90px Arial, sans-serif'; x.fillText(side, 0, -85); }
    x.restore();
  };
  draw(le, 128); draw(he, 384);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8; return t;
}

export class Runways {
  constructor(scene, terrain, runways, asphaltTex, tier) {
    this.list = [];
    this.lights = [];
    const lightPos = [], lightCol = [], lightKind = [];
    for (const r of runways) {
      const dx = r.x2 - r.x1, dz = r.z2 - r.z1, L = r.length, W = r.width;
      const ux = dx / L, uz = dz / L;
      const heading = Math.atan2(dx, -dz);      // rumo verdadeiro do sentido le -> he
      const segs = Math.max(4, Math.round(L / 40));
      const geo = new THREE.PlaneGeometry(W + 6, L + 20, 2, segs).rotateX(-Math.PI / 2);
      // alinha com a pista e acompanha o terreno aplainado
      const pos = geo.attributes.position, uvs = geo.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        const lx = pos.getX(i), lz = pos.getZ(i);
        const along = L / 2 - lz, across = lx;           // along: 0 na cabeceira le
        const px = r.x1 + ux * along - uz * across, pz = r.z1 + uz * along + ux * across;
        pos.setXYZ(i, px, terrain.heightAt(px, pz) + 0.06, pz);
        uvs.setXY(i, across, along);
      }
      geo.computeVertexNormals();
      const numTex = numbersTexture(r.le, r.he);
      const mat = registerMaterial(new THREE.MeshStandardMaterial({ roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), (sh) => {
        sh.uniforms.tAsph = { value: asphaltTex }; sh.uniforms.tNum = { value: numTex };
        sh.uniforms.uLen = { value: L }; sh.uniforms.uWid = { value: W };
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vRw;')
          .replace('#include <uv_vertex>', '#include <uv_vertex>\nvRw = uv;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vRw; uniform sampler2D tAsph; uniform sampler2D tNum; uniform float uLen; uniform float uWid;')
          .replace('#include <map_fragment>', RUNWAY_FRAG);
      }, 'rwy-' + r.le);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.receiveShadow = true;
      scene.add(mesh);

      // luzes: borda branca a cada 60 m, cabeceira verde, fim vermelho, PAPI à esquerda
      for (let a = 0; a <= L; a += 60) for (const s of [-1, 1]) {
        const off = s * (W / 2 + 1.5);
        const px = r.x1 + ux * a - uz * off, pz = r.z1 + uz * a + ux * off;
        lightPos.push(px, terrain.heightAt(px, pz) + 0.5, pz); lightCol.push(1, 0.95, 0.8); lightKind.push(0);
      }
      for (let k = -W / 2; k <= W / 2; k += 3) for (const [a, cl] of [[-2, [0.2, 1, 0.35]], [L + 2, [1, 0.15, 0.1]], [2, [1, 0.15, 0.1]], [L - 2, [0.2, 1, 0.35]]]) {
        const px = r.x1 + ux * a - uz * k, pz = r.z1 + uz * a + ux * k;
        lightPos.push(px, terrain.heightAt(px, pz) + 0.4, pz); lightCol.push(...cl); lightKind.push(0);
      }
      // PAPI para as duas cabeceiras: 4 luzes, 300 m após a cabeceira, lado esquerdo
      for (const [start, dir] of [[0, 1], [L, -1]]) {
        const a = start + dir * 300;
        for (let i = 0; i < 4; i++) {
          const off = -dir * (W / 2 + 15 + i * 9);
          const px = r.x1 + ux * a - uz * off, pz = r.z1 + uz * a + ux * off;
          lightPos.push(px, terrain.heightAt(px, pz) + 1.0, pz); lightCol.push(1, 1, 1);
          lightKind.push(1 + i);   // 1..4 -> limiares de 3,5° / 3,17° / 2,83° / 2,5°
        }
      }
      this.list.push({ ...r, heading, ux, uz, mesh });
    }
    // sprites de luz (o tamanho aparente cresce à noite; o PAPI calcula a cor pelo ângulo de visão)
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(lightPos, 3));
    g.setAttribute('aCol', new THREE.Float32BufferAttribute(lightCol, 3));
    g.setAttribute('aKind', new THREE.Float32BufferAttribute(lightKind, 1));
    this.lightUniforms = { uNightL: { value: 0 }, uScale: { value: 800 } };
    const pm = new THREE.ShaderMaterial({
      uniforms: this.lightUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        attribute vec3 aCol; attribute float aKind; varying vec3 vCol; varying float vA;
        uniform float uNightL; uniform float uScale;
        #include <common>
        #include <logdepthbuf_pars_vertex>
        void main() {
          vec4 mv = modelViewMatrix * vec4( position, 1.0 );
          // curvatura da Terra
          vec3 rel = transpose( mat3( viewMatrix ) ) * mv.xyz;
          mv.xyz -= mat3( viewMatrix ) * vec3( 0.0, dot( rel.xz, rel.xz ) / 12742000.0, 0.0 );
          gl_Position = projectionMatrix * mv;
          float d = length( mv.xyz );
          vCol = aCol;
          if ( aKind > 0.5 ) {
            // PAPI: branco acima do ângulo da luz, vermelho abaixo (2,5° a 3,5°)
            float thr = 3.5 - ( aKind - 1.0 ) * 0.333;
            float ang = degrees( atan( ( cameraPosition.y - position.y ), max( length( cameraPosition.xz - position.xz ), 1.0 ) ) );
            vCol = ang > thr ? vec3( 1.0, 0.95, 0.9 ) : vec3( 1.0, 0.1, 0.05 );
          }
          float papi = step( 0.5, aKind );
          vA = mix( 0.15 + 0.85 * uNightL, 1.0, papi );
          gl_PointSize = clamp( uScale * ( 1.3 + papi * 1.5 ) / d, 1.5, 22.0 ) * mix( 0.6, 1.0, max( uNightL, papi ) );
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vCol; varying float vA;
        #include <logdepthbuf_pars_fragment>
        void main() {
          #include <logdepthbuf_fragment>
          float d = length( gl_PointCoord - 0.5 );
          float a = smoothstep( 0.5, 0.0, d );
          gl_FragColor = vec4( vCol * 3.0 * a * vA, a * vA );
          #include <colorspace_fragment>
        }`,
    });
    this.points = new THREE.Points(g, pm);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    scene.add(this.points);
  }

  update(night, heightPx) { this.lightUniforms.uNightL.value = night; this.lightUniforms.uScale.value = heightPx * 0.9; }

  // posição de alinhamento para decolagem numa cabeceira
  lineup(ident) {
    for (const r of this.list) {
      if (r.le === ident) return { x: r.x1 + r.ux * 40, z: r.z1 + r.uz * 40, heading: r.heading, r };
      if (r.he === ident) return { x: r.x2 - r.ux * 40, z: r.z2 - r.uz * 40, heading: r.heading + Math.PI, r };
    }
    return null;
  }
}

const RUNWAY_FRAG = /* glsl */`
  float ac = vRw.x, al = vRw.y;              // metros: através e ao longo
  float hw = uWid * 0.5;
  vec3 asph = texture( tAsph, vec2( ac, al ) / 7.0 ).rgb * 0.75;
  // marcas de pneu na zona de toque
  float tire = smoothstep( 1.0, 0.0, abs( abs( ac ) - 3.0 ) ) * ( smoothstep( 80.0, 250.0, al ) * smoothstep( 800.0, 350.0, al ) + smoothstep( uLen - 80.0, uLen - 250.0, al ) * smoothstep( uLen - 800.0, uLen - 350.0, al ) );
  asph *= 1.0 - tire * 0.45;
  float paint = 0.0;
  // bordas
  paint += step( hw - 0.9, abs( ac ) ) * step( abs( ac ), hw );
  // eixo: traços de 30 m com intervalos de 20 m
  paint += step( abs( ac ), 0.45 ) * step( 0.0, sin( al / 50.0 * 6.2832 ) ) * step( 100.0, al ) * step( al, uLen - 100.0 );
  // faixas de cabeceira ("piano")
  float thrA = step( 6.0, al ) * step( al, 36.0 ) + step( uLen - 36.0, al ) * step( al, uLen - 6.0 );
  float bars = step( 3.0, abs( ac ) ) * step( abs( ac ), hw - 2.0 ) * step( 0.5, fract( ( abs( ac ) - 3.0 ) / 3.6 ) + 0.0 );
  paint += thrA * ( 1.0 - bars * 0.0 ) * step( 0.5, fract( ( abs( ac ) - 3.0 ) / 3.6 ) ) * step( 3.0, abs( ac ) ) * step( abs( ac ), hw - 2.0 );
  // ponto de visada (dois retângulos grandes a 300 m) e zona de toque
  float aim = step( abs( abs( ac ) - hw * 0.45 ), 3.0 );
  paint += aim * ( step( 300.0, al ) * step( al, 345.0 ) + step( uLen - 345.0, al ) * step( al, uLen - 300.0 ) );
  float tdz = step( abs( abs( ac ) - hw * 0.45 ), 1.5 ) * step( 0.5, fract( al / 150.0 ) ) * step( 0.66, fract( al / 150.0 ) + 0.16 );
  paint += tdz * ( step( 150.0, al ) * step( al, 600.0 ) + step( uLen - 600.0, al ) * step( al, uLen - 150.0 ) ) * step( 1500.0, uLen );
  // números da cabeceira
  vec2 nUv = vec2( ac / ( uWid * 0.8 ) + 0.5, ( al - 45.0 ) / 30.0 );
  if ( nUv.y > 0.0 && nUv.y < 1.0 && nUv.x > 0.0 && nUv.x < 1.0 ) paint += texture( tNum, vec2( nUv.x * 0.5, nUv.y ) ).r;
  vec2 nUv2 = vec2( -ac / ( uWid * 0.8 ) + 0.5, ( uLen - al - 45.0 ) / 30.0 );
  if ( nUv2.y > 0.0 && nUv2.y < 1.0 && nUv2.x > 0.0 && nUv2.x < 1.0 ) paint += texture( tNum, vec2( 0.5 + nUv2.x * 0.5, nUv2.y ) ).r;
  paint = clamp( paint, 0.0, 1.0 ) * step( abs( ac ), hw );
  vec3 shoulder = vec3( 0.32, 0.31, 0.28 );
  vec3 rw = mix( asph, vec3( 0.82 ), paint * 0.9 );
  rw = mix( shoulder * 0.8, rw, step( abs( ac ), hw ) );
  diffuseColor.rgb *= rw;
`;
