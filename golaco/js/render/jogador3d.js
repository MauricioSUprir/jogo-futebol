// Manequim provisório (o modelo humano realista é a Etapa 5), desenhado a partir das juntas
// da animação pura (anim.js). Cada SEGMENTO vira uma cápsula afunilada entre as juntas A e B,
// e TODAS as cápsulas de TODOS os jogadores saem num único InstancedMesh (1 draw call + 1 na
// sombra): o afunilamento, o comprimento e o achatamento vêm de atributos por instância e são
// aplicados no vertex shader; as cores (camisa, pele, detalhes verdes) e os padrões (manga,
// gola, listras, meião, sola) são resolvidos no fragment shader. Cabeça e cabelo: mais dois
// InstancedMesh. Indicador do jogador controlado: anel com seta no chão + seta acima da cabeça.
import * as THREE from 'three';
import { SEGMENTOS, RAIO_CABECA, J } from '../anim.js';
import { texMancha, texIndicador } from './texturas.js';

const MAX_JOG = 24;
const NSEG = SEGMENTOS.length;

// Uniformes (cores) por time. Time 0 = GOLAÇO (preto com detalhes verdes); time 1 = marcador
// de treino (branco/cinza). Tudo fictício.
const KITS = [
  { camisa: '#15191b', calcao: '#0e1112', meiao: '#15191b', chuteira: '#19e07a', acento: '#19e07a', sola: '#0b0d0e', pele: '#b9825c', cabelo: '#1c1410' },
  { camisa: '#e7eaec', calcao: '#c4c9cd', meiao: '#e7eaec', chuteira: '#1d2123', acento: '#7b858b', sola: '#e0e3e5', pele: '#8d5d3f', cabelo: '#2a1e16' },
];

// Padrões (ver o fragment shader).
const P = { liso: 0, manga: 1, tronco: 3, gola: 4, coxa: 5, meiao: 6, chuteira: 7 };

function nomeJ(i) { return Object.keys(J).find(k => J[k] === i) ?? ''; }

/** Estilo de cada segmento pelo nome das juntas (robusto a mudanças na ordem de SEGMENTOS). */
function estilo(seg) {
  const a = nomeJ(seg[0]), b = nomeJ(seg[1]), parte = seg[4];
  const tem = (x, y) => (a === x && b === y) || (a === y && b === x);
  if (tem('pelve', 'lombar')) return { achata: 0.74, pad: P.liso, c: ['calcao', 'pele', 'acento'], sup: false };
  if (tem('lombar', 'peito')) return { achata: 0.68, pad: P.tronco, c: ['camisa', 'pele', 'acento'], sup: true };
  if (tem('peito', 'pescoco')) return { achata: 0.78, pad: P.gola, c: ['camisa', 'pele', 'acento'], sup: true };
  if (tem('ombroE', 'ombroD')) return { achata: 0.85, pad: P.liso, c: ['camisa', 'pele', 'acento'], sup: true };
  if (/^ombro/.test(a) && /^cotovelo/.test(b)) return { achata: 1, pad: P.manga, c: ['camisa', 'pele', 'acento'], sup: true };
  if (tem('quadrilE', 'quadrilD')) return { achata: 0.8, pad: P.liso, c: ['calcao', 'pele', 'acento'], sup: false };
  if (/^quadril/.test(a) && /^joelho/.test(b)) return { achata: 1, pad: P.coxa, c: ['calcao', 'pele', 'acento'], sup: false };
  if (/^joelho/.test(a) && /^tornozelo/.test(b)) return { achata: 1, pad: P.meiao, c: ['meiao', 'pele', 'acento'], sup: false };
  if (/^tornozelo/.test(a) && /^ponta/.test(b)) return { achata: 0.8, pad: P.chuteira, c: ['chuteira', 'pele', 'sola'], sup: false };
  const sup = !/quadril|joelho|tornozelo|ponta|pelve/.test(a + b);
  return { achata: 1, pad: P.liso, c: [parte, 'pele', 'acento'], sup };
}
const ESTILOS = SEGMENTOS.map(estilo);

/** Cápsula unitária: anéis do cilindro (aAnel = 1) + calotas; aFim = 0 no lado A, 1 no B. */
function geoCapsula(nr, nc) {
  const linhas = [];
  for (let i = 0; i <= nc; i++) { const f = (i / nc) * Math.PI / 2; linhas.push({ y: -Math.cos(f), r: Math.sin(f), fim: 0, anel: 0 }); }
  linhas.push({ y: 0, r: 1, fim: 0, anel: 1 });
  linhas.push({ y: 0, r: 1, fim: 1, anel: 1 });
  for (let i = nc; i >= 0; i--) { const f = (i / nc) * Math.PI / 2; linhas.push({ y: Math.cos(f), r: Math.sin(f), fim: 1, anel: 0 }); }
  const pos = [], nrm = [], fim = [], anel = [], idx = [];
  for (const l of linhas) {
    for (let k = 0; k <= nr; k++) {
      const t = (k / nr) * Math.PI * 2;
      const c = Math.cos(t), s = Math.sin(t);
      pos.push(c * l.r, l.y, s * l.r);
      if (l.anel) nrm.push(c, 0, s); else nrm.push(c * l.r, l.y, s * l.r);
      fim.push(l.fim); anel.push(l.anel);
    }
  }
  const W = nr + 1;
  for (let i = 0; i < linhas.length - 1; i++) {
    for (let k = 0; k < nr; k++) {
      const a = i * W + k, b = (i + 1) * W + k, c = a + 1, d = b + 1;
      idx.push(a, b, c, c, b, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('aFim', new THREE.Float32BufferAttribute(fim, 1));
  g.setAttribute('aAnel', new THREE.Float32BufferAttribute(anel, 1));
  g.setIndex(idx);
  return g;
}

const DECL_V = `
attribute float aFim;
attribute float aAnel;
attribute vec4 iDim;   // raio A, raio B, comprimento, achatamento (frente–trás)
attribute vec3 iC1;
attribute vec3 iC2;
attribute vec3 iC3;
attribute float iPad;
varying vec3 vC1;
varying vec3 vC2;
varying vec3 vC3;
varying float vPad;
varying float vT;
varying vec2 vLocal;
`;
const CORPO_V = `
float _r = mix(iDim.x, iDim.y, aFim);
float _len = max(iDim.z, 1e-3);
vec3 transformed = vec3(position.x * _r, aFim * iDim.z + position.y * _r, position.z * _r * iDim.w);
vT = (aFim * iDim.z + position.y * _r) / _len;
vLocal = position.xz;
vC1 = iC1; vC2 = iC2; vC3 = iC3; vPad = iPad;
`;

function materialSegmentos() {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.72, metalness: 0 });
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + DECL_V)
      .replace('#include <beginnormal_vertex>', `
        vec3 objectNormal = normalize(vec3(normal.x,
          normal.y + aAnel * (iDim.x - iDim.y) / max(iDim.z, 1e-3),
          normal.z / max(iDim.w, 0.2)));
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3(tangent.xyz);
        #endif`)
      .replace('#include <begin_vertex>', CORPO_V);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vC1;
        varying vec3 vC2;
        varying vec3 vC3;
        varying float vPad;
        varying float vT;
        varying vec2 vLocal;
        float faixa(float t, float a, float w) { return smoothstep(a - w, a + w, t); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 cor = vC1;
          float t = vT;
          float w = fwidth(t) * 0.75 + 0.004;
          float lado = abs(vLocal.x);
          float wl = fwidth(lado) * 0.75 + 0.01;
          float p = vPad;
          if (p > 0.5 && p < 1.5) {            // manga curta: camisa, punho verde, braço
            cor = mix(cor, vC3, faixa(t, 0.54, w));
            cor = mix(cor, vC2, faixa(t, 0.63, w));
          } else if (p > 2.5 && p < 3.5) {     // tronco: listras laterais
            cor = mix(cor, vC3, faixa(lado, 0.8, wl) * (1.0 - faixa(t, 0.97, w)));
          } else if (p > 3.5 && p < 4.5) {     // gola e pescoço
            cor = mix(cor, vC3, faixa(t, 0.62, w));
            cor = mix(cor, vC2, faixa(t, 0.78, w));
          } else if (p > 4.5 && p < 5.5) {     // coxa: calção com listra, depois a pele
            cor = mix(cor, vC3, faixa(lado, 0.84, wl) * (1.0 - faixa(t, 0.5, w)));
            cor = mix(cor, vC2, faixa(t, 0.5, w));
          } else if (p > 5.5 && p < 6.5) {     // meião: joelho, faixa verde, meião
            cor = mix(vC2, vC3, faixa(t, 0.06, w));
            cor = mix(cor, vC1, faixa(t, 0.17, w));
          } else if (p > 6.5) {                // chuteira: sola
            cor = mix(cor, vC3, 1.0 - faixa(vLocal.y, -0.35, 0.08));
          }
          diffuseColor.rgb = cor;
        }`);
  };
  mat.customProgramCacheKey = () => 'manequim-v1';
  return mat;
}

function materialSombraSegmentos() {
  const mat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + DECL_V)
      .replace('#include <begin_vertex>', CORPO_V);
  };
  mat.customProgramCacheKey = () => 'manequim-sombra-v1';
  return mat;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

export function criarJogadores3D(cena, qualidade) {
  const alta = qualidade === 'alta';
  const geo = geoCapsula(alta ? 14 : 9, alta ? 4 : 2);
  const n = MAX_JOG * NSEG;
  const ig = new THREE.InstancedBufferGeometry();
  ig.index = geo.index;
  for (const k of Object.keys(geo.attributes)) ig.setAttribute(k, geo.attributes[k]);
  const aDim = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
  const aC1 = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  const aC2 = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  const aC3 = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  const aPad = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
  aDim.setUsage(THREE.DynamicDrawUsage);
  ig.setAttribute('iDim', aDim);
  ig.setAttribute('iC1', aC1);
  ig.setAttribute('iC2', aC2);
  ig.setAttribute('iC3', aC3);
  ig.setAttribute('iPad', aPad);
  const segs = new THREE.InstancedMesh(ig, materialSegmentos(), n);
  segs.customDepthMaterial = materialSombraSegmentos();
  segs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  segs.frustumCulled = false;
  segs.castShadow = true;
  segs.count = 0;
  segs.name = 'jogadores-segmentos';
  cena.add(segs);

  // cabeça e cabelo
  const geoCab = new THREE.SphereGeometry(1, alta ? 24 : 14, alta ? 16 : 10);
  const cabecas = new THREE.InstancedMesh(geoCab, new THREE.MeshStandardMaterial({ roughness: 0.6 }), MAX_JOG);
  const geoCabelo = new THREE.SphereGeometry(1, alta ? 20 : 12, alta ? 8 : 5, 0, Math.PI * 2, 0, Math.PI * 0.52);
  const cabelos = new THREE.InstancedMesh(geoCabelo, new THREE.MeshStandardMaterial({ roughness: 0.9 }), MAX_JOG);
  for (const im of [cabecas, cabelos]) {
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.frustumCulled = false;
    im.castShadow = true;
    im.count = 0;
    cena.add(im);
  }
  cabecas.name = 'jogadores-cabecas';
  cabelos.name = 'jogadores-cabelos';

  // sombra de contato (mancha) sob cada jogador
  const gm = new THREE.PlaneGeometry(1, 1);
  gm.rotateX(-Math.PI / 2);
  const matMancha = new THREE.MeshBasicMaterial({
    map: texMancha(), color: 0x000000, transparent: true, depthWrite: false, opacity: 0.5,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6,
  });
  const manchas = new THREE.InstancedMesh(gm, matMancha, MAX_JOG);
  manchas.frustumCulled = false;
  manchas.count = 0;
  manchas.renderOrder = 3;
  manchas.name = 'jogadores-manchas';
  cena.add(manchas);

  // indicador do jogador controlado: anel + seta no chão, seta acima da cabeça
  const verde = 0x19e07a;
  const anelGeo = new THREE.RingGeometry(0.46, 0.56, 48);
  const anelTodo = new THREE.Group();
  const matAnel = new THREE.MeshBasicMaterial({
    color: verde, transparent: true, opacity: 0.92, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8,
  });
  const anel = new THREE.Mesh(anelGeo, matAnel);
  // seta no chão apontando para +x local (o grupo gira pelo rumo do jogador)
  const forma = new THREE.Shape();
  forma.moveTo(0.62, -0.15); forma.lineTo(0.9, 0); forma.lineTo(0.62, 0.15); forma.closePath();
  const setaMesh = new THREE.Mesh(new THREE.ShapeGeometry(forma), matAnel);
  anel.rotation.x = -Math.PI / 2;
  setaMesh.rotation.x = -Math.PI / 2;
  anelTodo.add(anel, setaMesh);
  anel.renderOrder = 4; setaMesh.renderOrder = 4;
  anelTodo.visible = false;
  anelTodo.name = 'indicador';
  cena.add(anelTodo);
  const marca = new THREE.Sprite(new THREE.SpriteMaterial({ map: texIndicador(), depthWrite: false, transparent: true }));
  marca.visible = false;
  marca.renderOrder = 5;
  cena.add(marca);

  const kitsLin = KITS.map(k => Object.fromEntries(Object.entries(k).map(([nome, hex]) => [nome, new THREE.Color(hex)])));
  const coresFeitas = new Map(); // id → time (cores escritas para esta vaga)
  const vagaDe = new Map();

  function escreverCores(vaga, time) {
    const kit = kitsLin[time] ?? kitsLin[0];
    for (let s = 0; s < NSEG; s++) {
      const e = ESTILOS[s];
      const i = vaga * NSEG + s;
      const c1 = kit[e.c[0]] ?? kit.camisa, c2 = kit[e.c[1]] ?? kit.pele, c3 = kit[e.c[2]] ?? kit.acento;
      aC1.setXYZ(i, c1.r, c1.g, c1.b);
      aC2.setXYZ(i, c2.r, c2.g, c2.b);
      aC3.setXYZ(i, c3.r, c3.g, c3.b);
      aPad.setX(i, e.pad);
    }
    aC1.needsUpdate = aC2.needsUpdate = aC3.needsUpdate = aPad.needsUpdate = true;
    cabecas.setColorAt(vaga, kit.pele);
    cabelos.setColorAt(vaga, kit.cabelo);
    if (cabecas.instanceColor) cabecas.instanceColor.needsUpdate = true;
    if (cabelos.instanceColor) cabelos.instanceColor.needsUpdate = true;
  }

  const fSup = new THREE.Vector3(), fInf = new THREE.Vector3(), fCab = new THREE.Vector3();
  const A = new THREE.Vector3(), B = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), X = new THREE.Vector3();
  const CIMA = new THREE.Vector3(0, 1, 0);

  function frente(pose, iE, iD, out) {
    const rx = pose[iD * 3] - pose[iE * 3], rz = pose[iD * 3 + 2] - pose[iE * 3 + 2];
    const l = Math.hypot(rx, rz) || 1;
    return out.set(rz / l, 0, -rx / l);
  }

  return {
    segs, cabecas, cabelos,
    /**
     * lista: [{id, time, pose (Float32Array já interpolada), controlado, x, z, rumo}]
     * camera: para o tamanho constante da seta acima da cabeça.
     */
    atualizar(lista, camera) {
      const nj = Math.min(lista.length, MAX_JOG);
      const mat = segs.instanceMatrix.array;
      const dim = aDim.array;
      let controlado = null;
      for (let p = 0; p < nj; p++) {
        const jg = lista[p];
        // cores fixas por vaga (só reescreve quando a vaga muda de dono/time)
        const chave = jg.id * 8 + jg.time;
        if (vagaDe.get(p) !== chave) { vagaDe.set(p, chave); escreverCores(p, jg.time); }
        const pose = jg.pose;
        frente(pose, J.ombroE, J.ombroD, fSup);
        frente(pose, J.quadrilE, J.quadrilD, fInf);
        for (let s = 0; s < NSEG; s++) {
          const sg = SEGMENTOS[s], e = ESTILOS[s];
          const ia = sg[0] * 3, ib = sg[1] * 3;
          A.set(pose[ia], pose[ia + 1], pose[ia + 2]);
          B.set(pose[ib], pose[ib + 1], pose[ib + 2]);
          Y.subVectors(B, A);
          let len = Y.length();
          if (len < 1e-5) { Y.set(0, 1, 0); len = 1e-5; } else Y.multiplyScalar(1 / len);
          // referência "frente" perpendicular ao eixo; perto de paralela, mistura com "cima"
          const ref = e.sup ? fSup : fInf;
          const dp = Math.abs(ref.dot(Y));
          const k = Math.min(1, Math.max(0, (dp - 0.6) / 0.3));
          Z.copy(ref).multiplyScalar(1 - k).addScaledVector(CIMA, k);
          Z.addScaledVector(Y, -Z.dot(Y));
          if (Z.lengthSq() < 1e-8) Z.set(1, 0, 0).addScaledVector(Y, -Y.x);
          Z.normalize();
          X.crossVectors(Y, Z);
          const i = p * NSEG + s;
          const o = i * 16;
          mat[o] = X.x; mat[o + 1] = X.y; mat[o + 2] = X.z; mat[o + 3] = 0;
          mat[o + 4] = Y.x; mat[o + 5] = Y.y; mat[o + 6] = Y.z; mat[o + 7] = 0;
          mat[o + 8] = Z.x; mat[o + 9] = Z.y; mat[o + 10] = Z.z; mat[o + 11] = 0;
          mat[o + 12] = A.x; mat[o + 13] = A.y; mat[o + 14] = A.z; mat[o + 15] = 1;
          dim[i * 4] = sg[2]; dim[i * 4 + 1] = sg[3]; dim[i * 4 + 2] = len; dim[i * 4 + 3] = e.achata;
        }
        // cabeça: "cima" pelo pescoço, "frente" média de ombros e quadris
        const ic = J.cabeca * 3, ip = J.pescoco * 3;
        A.set(pose[ic], pose[ic + 1], pose[ic + 2]);
        Y.set(pose[ic] - pose[ip], pose[ic + 1] - pose[ip + 1], pose[ic + 2] - pose[ip + 2]).normalize();
        fCab.copy(fSup).add(fInf);
        Z.copy(fCab).addScaledVector(Y, -fCab.dot(Y)).normalize();
        X.crossVectors(Y, Z);
        const R = RAIO_CABECA;
        _m.makeBasis(X, Y, Z);
        _q.setFromRotationMatrix(_m);
        _s.set(R * 0.92, R * 1.1, R * 1.0);
        _m.compose(A, _q, _s);
        cabecas.setMatrixAt(p, _m);
        _v.copy(A).addScaledVector(Y, R * 0.12).addScaledVector(Z, -R * 0.1);
        _s.set(R * 0.98, R * 1.08, R * 1.08);
        _m.compose(_v, _q, _s);
        cabelos.setMatrixAt(p, _m);
        // mancha de contato
        const ang = Math.atan2(fInf.z, fInf.x);
        _q.setFromAxisAngle(CIMA, -ang);
        _m.compose(_v.set(jg.x, 0.016, jg.z), _q, _s.set(1.15, 1, 0.85));
        manchas.setMatrixAt(p, _m);
        if (jg.controlado) controlado = jg;
      }
      segs.count = nj * NSEG;
      cabecas.count = cabelos.count = manchas.count = nj;
      segs.instanceMatrix.needsUpdate = true;
      aDim.needsUpdate = true;
      cabecas.instanceMatrix.needsUpdate = true;
      cabelos.instanceMatrix.needsUpdate = true;
      manchas.instanceMatrix.needsUpdate = true;
      // indicador
      if (controlado) {
        anelTodo.visible = true;
        anelTodo.position.set(controlado.x, 0.02, controlado.z);
        anelTodo.rotation.y = -controlado.rumo;
        const ic2 = J.cabeca * 3;
        const pose = controlado.pose;
        marca.visible = true;
        marca.position.set(pose[ic2], pose[ic2 + 1] + 0.42, pose[ic2 + 2]);
        if (camera) {
          // tamanho constante na tela (~2,6% da altura)
          const d = camera.position.distanceTo(marca.position);
          const k = 2 * Math.tan((camera.fov * Math.PI) / 360) * d * 0.026;
          marca.scale.set(k, k, 1);
          marca.position.y += k * 0.3;
        }
      } else {
        anelTodo.visible = false;
        marca.visible = false;
      }
      void _c;
    },
    definirSombras(ligadas) {
      segs.castShadow = cabecas.castShadow = cabelos.castShadow = ligadas;
      matMancha.opacity = ligadas ? 0.32 : 0.5;
    },
  };
}
