// Torcida 3D: torcedores low-poly de verdade (cabeça, tronco, braços com cotovelo,
// coxas), instanciados em poucas chamadas de desenho. Toda a animação é no shader
// de vértice (stadium-crowd-glsl.js): cada torcedor tem semente própria e reage a
// `uExc` (tensão) e aos pulsos por torcida `uEvHome`/`uEvAway` (gol, chance, falta,
// defesa) — respira, olha em volta, levanta, pula, ergue os braços, põe a mão na
// cabeça, aplaude, protesta, gira o cachecol ou desaba no assento.
// Iluminação real (MeshStandardMaterial via onBeforeCompile) com a sombra
// analítica da cobertura (ROOF_GLSL). Inclui cachecóis e bandeiras tremulando.
import * as THREE from 'three';
import { BOWL, ROOF_GLSL, crowdSeats } from './stadium-bowl.js';
import { allTeams } from './teams.js';
import { buildBodyGeometry, buildScarfGeometry, triCount } from './stadium-crowd-body.js';
import {
  BODY_VERT_HEAD, BODY_VERT_MAIN, SCARF_VERT_HEAD, SCARF_VERT_MAIN, FRAG_HEAD, FRAG_COLOR,
} from './stadium-crowd-glsl.js';
import { buildFlags, buildBanners } from './stadium-crowd-flags.js';
import { buildTifo } from './stadium-crowd-tifo.js';

// quantidade por qualidade: anel inferior (malha mais detalhada) e superior
const CFG = {
  ultra: { lower: ['ultra', 13500], upper: ['media', 9500], scarf: 0.22, scarfSeg: 6, flags: 56, banners: 10 },
  alta: { lower: ['alta', 13500], upper: ['media', 9000], scarf: 0.2, scarfSeg: 6, flags: 50, banners: 10 },
  media: { lower: ['media', 8600], upper: ['baixa', 3500], scarf: 0.12, scarfSeg: 4, flags: 34, banners: 8 },
  baixa: { lower: ['baixa', 5500], upper: ['baixa', 2000], scarf: 0.06, scarfSeg: 3, flags: 20, banners: 6 },
};

// fatias do anel para o recorte pela câmera e o nível de detalhe por distância
const SECTORS = 16;
// abaixo desta fração da altura da tela (≈ 20 px em 720p) o torcedor usa a malha leve
const FAR_FRAC = 0.028;

function qualityKey(q) {
  const l = (q?.label || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (CFG[l]) return l;
  const c = q?.crowd ?? 0.6;
  return c < 0.45 ? 'baixa' : c < 0.8 ? 'media' : 'alta';
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- paleta dos torcedores
const hex = (h) => new THREE.Color(h).getHSL({ h: 0, s: 0, l: 0 });
const lum = (h) => { const c = new THREE.Color(h); return 0.3 * c.r + 0.59 * c.g + 0.11 * c.b; };
const PAT = { plain: 0, stripes: 1, hoops: 2, halves: 3, sash: 4, pinstripe: 5 };

// Descobre o clube pela cor da camisa (times de teams.js, inclusive os do Total Match) para vestir a
// torcida com as cores certas; se não achar, deriva uma segunda cor.
function clubPalette(color) {
  const c = String(color).toLowerCase();
  for (const t of allTeams()) {
    for (const k of ['home', 'away']) {
      const kit = t.kits[k];
      if (kit.shirt.toLowerCase() === c) {
        const other = t.kits[k === 'home' ? 'away' : 'home'];
        return {
          kit, other, primary: t.colors.primary, secondary: t.colors.secondary,
          accent: kit.shirt.toLowerCase() === t.colors.primary.toLowerCase() ? t.colors.secondary : t.colors.primary,
        };
      }
    }
  }
  const L = lum(color), hsl = hex(color);
  // escuro → verde da casa; claro → quase preto; colorido → branco
  const second = L < 0.08 ? '#1f9d55' : L > 0.7 ? '#15171b' : hsl.s > 0.35 ? '#f2f2f2' : '#15171b';
  const kit = { shirt: color, second, trim: second, pattern: 'plain', sleeves: color };
  return { kit, other: { shirt: second, second: color, trim: color, pattern: 'plain', sleeves: second }, primary: color, secondary: second, accent: second };
}

const SKINS = ['#f3d2b8', '#e8b994', '#d49f78', '#c08457', '#a56b43', '#8a5533', '#6d4027', '#51301d', '#3d2416'];
const SKIN_W = [0.09, 0.14, 0.16, 0.16, 0.14, 0.12, 0.09, 0.06, 0.04];
const HAIRS = ['#120d0a', '#1f150e', '#2e1e12', '#43301d', '#5d4128', '#8a6a42', '#b8975f', '#7b3a1e', '#8d8b88', '#d8d4cc'];
const HAIR_W = [0.24, 0.2, 0.16, 0.1, 0.07, 0.05, 0.04, 0.03, 0.06, 0.04];
const PANTS = ['#1d2840', '#2c3e62', '#3d5582', '#15171b', '#2a2c31', '#4a4f57', '#6e6250', '#8c7a5c'];
const NEUTRAL = ['#111214', '#1c1d21', '#2b2d33', '#4d5058', '#7b7f87', '#b9bcc2', '#e9e9e6', '#1b2440', '#3b5680', '#6b5d4b', '#3c4a34'];

function pickW(rng, arr, w) {
  let r = rng() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < arr.length; i++) { r -= w[i]; if (r <= 0) return arr[i]; }
  return arr[arr.length - 1];
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];

// preenche as cores (bytes sRGB) de um torcedor
function dressFan(rng, pal, out, o, isUltra) {
  const col = new THREE.Color();
  // col.set(hex) dá valores lineares; guardamos sRGB (o shader converte)
  const putS = (i, h, w) => {
    col.set(h).convertLinearToSRGB();
    const k = 0.9 + rng() * 0.16;
    out[o + i * 4] = Math.min(255, col.r * k * 255);
    out[o + i * 4 + 1] = Math.min(255, col.g * k * 255);
    out[o + i * 4 + 2] = Math.min(255, col.b * k * 255);
    out[o + i * 4 + 3] = w;
  };
  const r = rng();
  const kit = pal.kit;
  let shirt, second, pattern = 0, sleeve = rng() < 0.18 ? 1 : 0;
  const repl = isUltra ? 0.62 : 0.42;
  if (r < repl) {                                   // camisa oficial
    shirt = kit.shirt; second = kit.second;
    pattern = PAT[kit.pattern] ?? 0;
    if (pattern === 0) { pattern = 7; second = kit.trim || kit.second; }
  } else if (r < repl + 0.1) {                      // cor principal lisa
    shirt = pal.primary; second = pal.secondary; pattern = rng() < 0.5 ? 7 : 0;
  } else if (r < repl + 0.19) {                     // cor secundária
    shirt = pal.accent; second = kit.shirt; pattern = rng() < 0.5 ? 7 : 0;
  } else if (r < repl + 0.25) {                     // outro uniforme do clube
    shirt = pal.other.shirt; second = pal.other.second;
    pattern = PAT[pal.other.pattern] ?? 0;
  } else if (r < repl + 0.36) {                     // jaqueta aberta com a camisa por baixo
    shirt = pick(rng, ['#121316', '#1d1f24', '#23293a', '#3a3d44', '#51402e']); second = kit.shirt;
    pattern = 6; sleeve = 1;
  } else {                                          // roupa neutra
    shirt = pick(rng, NEUTRAL); second = shirt; pattern = 0;
    if (rng() < 0.35) sleeve = 1;
    if (rng() < 0.05) shirt = pick(rng, ['#c9a227', '#8c2330', '#2f6f8f', '#d06a2c']);
  }
  if (sleeve === 0 && rng() < 0.05) sleeve = 2;
  putS(0, shirt, pattern * 32);
  putS(1, second, sleeve * 32);
  // cabelo: 0 curto, 1 raspado, 2 comprido, 3 careca, 4 boné, 5 black power
  const hr = rng();
  const hs = hr < 0.36 ? 0 : hr < 0.54 ? 1 : hr < 0.72 ? 2 : hr < 0.79 ? 3 : hr < 0.92 ? 4 : 5;
  const skin = pickW(rng, SKINS, SKIN_W);
  putS(2, skin, hs * 32);
  let hair = pickW(rng, HAIRS, HAIR_W);
  if (hs === 5) hair = pick(rng, ['#120d0a', '#1f150e', '#2e1e12']);
  if (hs === 4) hair = pick(rng, [kit.shirt, pal.primary, pal.secondary, '#111214', '#e9e9e6', '#1b2440']);
  putS(3, hair, Math.floor(rng() * 255));
  putS(4, pickW(rng, PANTS, [0.24, 0.2, 0.1, 0.16, 0.1, 0.08, 0.07, 0.05]), rng() < 0.04 ? 0 : 6 + Math.floor(rng() * 249));
}

// ---------------------------------------------------------------- material
function crowdMaterial(uniforms, vertHead, vertMain, key, side = THREE.FrontSide) {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0, side, envMapIntensity: 0.7 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + ROOF_GLSL + vertHead)
      .replace('#include <beginnormal_vertex>', vertMain)
      .replace('#include <begin_vertex>', 'vec3 transformed = crowdPos;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_HEAD)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_COLOR)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = rough;')
      .replace('#include <emissivemap_fragment>', /* glsl */`#include <emissivemap_fragment>
        {
          // brilho de borda (tecido sintético): mantém camisas pretas legíveis sob os refletores
          float fr = pow( 1.0 - clamp( dot( normal, normalize( vViewPosition ) ), 0.0, 1.0 ), 3.0 );
          float lu = dot( diffuseColor.rgb, vec3( 0.3, 0.59, 0.11 ) );
          totalEmissiveRadiance += uRim * fr * mix( 1.0, 0.25, smoothstep( 0.02, 0.2, lu ) ) * ( 0.35 + 0.65 * vInfo.w );
        }`)
      .replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin.replace(
        'getDirectionalLightInfo( directionalLight, directLight );',
        'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= vInfo.w;'));
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}

// Passes com material de substituição (ex.: normais do GTAOPass) não conhecem os
// atributos por instância: desenhariam milhares de cópias na origem. Pula esses passes.
function skipOverride(mesh) {
  let saved = 0;
  mesh.onBeforeRender = (r, s, c, geo, mat) => {
    if (mat !== mesh.material) { saved = geo.instanceCount; geo.instanceCount = 0; }
  };
  mesh.onAfterRender = (r, s, c, geo, mat) => {
    if (mat !== mesh.material) geo.instanceCount = saved;
  };
}

// ---------------------------------------------------------------- montagem
export function buildCrowd(ctx) {
  const { U, quality, homeColor, awayColor, isNight } = ctx;
  const qk = qualityKey(quality);
  const cfg = CFG[qk];
  const group = new THREE.Group();
  group.name = 'torcida';
  const rng = mulberry(ctx.rngSeed ?? 1234);
  // todas as vagas (pares de 1,1 m); ctx.seats (mesmo formato) só nas páginas de teste
  const seats = ctx.seats || crowdSeats(1, rng);
  const palH = clubPalette(homeColor), palA = clubPalette(awayColor);

  // ---- escolhe quem ocupa cada vaga: mais gente perto do meio-campo e nas
  // organizadas; o total bate com o alvo da qualidade em cada anel
  const slots = [[], []];
  for (let i = 0; i < seats.length; i += 8) {
    const x = seats[i], z = seats[i + 2], fl = seats[i + 7];
    const tier = fl >= 2 ? 1 : 0, away = fl % 2;
    const end = Math.abs(x) > BOWL.A - 1;
    const ultra = away || (tier === 0 && x < -(BOWL.A - 1) && Math.abs(z) < 22);
    const center = end ? 0.25 : 1 - Math.min(1, Math.abs(x) / 62);
    const row = tier ? (seats[i + 3] - BOWL.upper.d0) / (BOWL.upper.rows * BOWL.upper.depth)
      : (seats[i + 3] - BOWL.lower.d0) / (BOWL.lower.rows * BOWL.lower.depth);
    const w = (1 + 0.8 * center) * (ultra ? 2.2 : 1) * (1.25 - 0.5 * row);
    for (let s = 0; s < 2; s++) slots[tier].push({ i, s, w, ultra, away });
  }
  const chosen = [[], []];
  for (let tier = 0; tier < 2; tier++) {
    if (ctx.seats) { chosen[tier] = slots[tier]; continue; }
    const target = (tier ? cfg.upper : cfg.lower)[1];
    const sl = slots[tier];
    let lo = 0, hi = 5;
    for (let it = 0; it < 30; it++) {
      const k = (lo + hi) / 2;
      let sum = 0;
      for (const o of sl) sum += Math.min(0.97, k * o.w);
      if (sum > target) hi = k; else lo = k;
    }
    for (const o of sl) if (rng() < Math.min(0.97, lo * o.w)) chosen[tier].push(o);
  }

  // ---- atributos por instância
  const uniforms = {
    uTime: U.uTime, uExc: U.uExc, uEvHome: U.uEvHome, uEvAway: U.uEvAway,
    uChant: U.uChant || { value: new THREE.Vector4(0, 0, 130, 120) },
    uWave: U.uWave || { value: new THREE.Vector4(-1e4, -1, 14, 1) },
    uSunDir: U.uSunDir, uShadeOn: U.uShadeOn,
    uDirScale: { value: isNight ? 0.75 : 1.0 },
    uRim: { value: isNight ? new THREE.Color(0.1, 0.11, 0.13) : new THREE.Color(0.07, 0.075, 0.08) },
    uDebugPose: { value: -1 },
    uSegArm: { value: 0 },
  };
  const scarfList = [];
  const makeSet = (list, lod) => {
    const n = list.length;
    const P = new Float32Array(n * 8);
    const C = new Uint8Array(n * 20);
    list.forEach((o, j) => {
      const i = o.i, nx = seats[i + 4], nz = seats[i + 5];
      const tx = -nz, tz = nx;
      const off = (o.s - 0.5) * 0.55 + (rng() - 0.5) * 0.07, rad = (rng() - 0.5) * 0.06;
      P[j * 8] = seats[i] + tx * off + nx * rad;
      P[j * 8 + 1] = seats[i + 1];
      P[j * 8 + 2] = seats[i + 2] + tz * off + nz * rad;
      P[j * 8 + 3] = seats[i + 3] + rad;
      P[j * 8 + 4] = nx; P[j * 8 + 5] = nz;
      P[j * 8 + 6] = (seats[i + 6] + rng()) % 1;
      const scarf = rng() < (o.ultra ? 0.55 : ctx.seats ? 0.5 : cfg.scarf) ? 1 : 0;
      const stander = rng() < 0.05 ? 1 : 0;
      const ultra = o.ultra && rng() < 0.9 ? 1 : 0;
      P[j * 8 + 7] = o.away + (seats[i + 7] >= 2 ? 2 : 0) + ultra * 4 + scarf * 8 + stander * 16;
      const pal = o.away ? palA : palH;
      dressFan(rng, pal, C, j * 20, o.ultra);
      if (scarf) scarfList.push({ j, P, C, pal });
    });
    // ---- setores (fatias do anel em volta do campo): cada um com esfera envolvente
    // própria, então o recorte pelo campo de visão (frustum culling) do three.js
    // descarta o que está fora da tela — antes o anel inteiro era UMA malha sem
    // recorte e a torcida atrás da câmera era desenhada de graça. Cada setor tem
    // duas malhas que dividem os mesmos atributos por instância: a detalhada (lod)
    // e a leve ('baixa'), escolhida pela altura que um torcedor ocupa na tela.
    const bySec = Array.from({ length: SECTORS }, () => []);
    for (let j = 0; j < n; j++) {
      const a = Math.atan2(P[j * 8 + 2], P[j * 8]);
      bySec[Math.min(SECTORS - 1, Math.floor((a + Math.PI) / (2 * Math.PI) * SECTORS))].push(j);
    }
    const near = bodyFor(lod), far = lod === 'baixa' ? null : bodyFor('baixa');
    let tris = 0;
    for (const js of bySec) {
      if (!js.length) continue;
      const m = js.length, Ps = new Float32Array(m * 8), Cs = new Uint8Array(m * 20);
      const box = new THREE.Box3(), v = new THREE.Vector3();
      js.forEach((j, k) => {
        Ps.set(P.subarray(j * 8, j * 8 + 8), k * 8); Cs.set(C.subarray(j * 20, j * 20 + 20), k * 20);
        box.expandByPoint(v.set(P[j * 8], P[j * 8 + 1], P[j * 8 + 2]));
      });
      // folga para quem pula / ergue os braços / gira o cachecol
      box.min.y -= 0.5; box.max.y += 2.6; box.expandByScalar(0.8);
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      const ib = new THREE.InstancedInterleavedBuffer(Ps, 8, 1);
      const cb = new THREE.InstancedInterleavedBuffer(Cs, 20, 1);
      const mk = (B) => {
        const g = new THREE.InstancedBufferGeometry();
        g.index = B.geo.index;
        for (const k of ['position', 'normal', 'aPart']) g.setAttribute(k, B.geo.attributes[k]);
        g.setAttribute('aP', new THREE.InterleavedBufferAttribute(ib, 4, 0));
        g.setAttribute('aN', new THREE.InterleavedBufferAttribute(ib, 4, 4));
        ['aShirt', 'aSecond', 'aSkin', 'aHair', 'aPants'].forEach((k, q) => {
          g.setAttribute(k, new THREE.InterleavedBufferAttribute(cb, 4, q * 4, true));
        });
        g.instanceCount = m;
        g.boundingSphere = sphere;
        const mesh = new THREE.Mesh(g, B.mat);
        mesh.name = 'torcedores-' + B.lod;
        mesh.userData.tris = B.tris * m;
        group.add(mesh);
        return mesh;
      };
      const sec = { c: sphere.center, r: sphere.radius, near: mk(near), far: far ? mk(far) : null, useFar: false };
      // as duas ficam visíveis até o primeiro updateLOD: assim o compileAsync do início
      // já compila o shader da malha leve (sem engasgo na primeira troca)
      sectors.push(sec);
      tris += sec.near.userData.tris;
    }
    return tris;
  };
  // geometria + material compartilhados por todos os setores de um nível
  const bodies = {};
  const bodyFor = (lod) => {
    if (bodies[lod]) return bodies[lod];
    const geo = buildBodyGeometry(lod);
    const u = { ...uniforms, uSegArm: { value: lod === 'baixa' ? 1 : 0 } };
    return (bodies[lod] = { lod, geo, tris: triCount(geo), mat: crowdMaterial(u, BODY_VERT_HEAD, BODY_VERT_MAIN, 'torcida3d-corpo') });
  };
  const sectors = [];
  if (cfg.lower[0] === cfg.upper[0]) makeSet(chosen[0].concat(chosen[1]), cfg.lower[0]);
  else { makeSet(chosen[0], cfg.lower[0]); makeSet(chosen[1], cfg.upper[0]); }

  // ---- cachecóis (só de quem tem)
  if (scarfList.length) {
    const n = scarfList.length;
    const P = new Float32Array(n * 8), C = new Uint8Array(n * 20);
    const col = new THREE.Color();
    scarfList.forEach((s, k) => {
      P.set(s.P.subarray(s.j * 8, s.j * 8 + 8), k * 8);
      C.set(s.C.subarray(s.j * 20, s.j * 20 + 20), k * 20);
      // cores do cachecol nas duas primeiras cores (camisa/segunda)
      const a = rng() < 0.7 ? s.pal.primary : s.pal.kit.shirt;
      let b = s.pal.secondary;
      if (b.toLowerCase() === a.toLowerCase()) b = s.pal.accent;
      [a, b].forEach((h, q) => {
        col.set(h).convertLinearToSRGB();
        C[k * 20 + q * 4] = col.r * 255; C[k * 20 + q * 4 + 1] = col.g * 255; C[k * 20 + q * 4 + 2] = col.b * 255;
      });
    });
    const g = new THREE.InstancedBufferGeometry();
    const sg = buildScarfGeometry(cfg.scarfSeg);
    g.index = sg.index;
    g.setAttribute('position', sg.attributes.position);
    g.setAttribute('normal', sg.attributes.normal);
    const ib = new THREE.InstancedInterleavedBuffer(P, 8, 1);
    g.setAttribute('aP', new THREE.InterleavedBufferAttribute(ib, 4, 0));
    g.setAttribute('aN', new THREE.InterleavedBufferAttribute(ib, 4, 4));
    const cb = new THREE.InstancedInterleavedBuffer(C, 20, 1);
    ['aShirt', 'aSecond', 'aSkin', 'aHair', 'aPants'].forEach((k, q) => {
      g.setAttribute(k, new THREE.InterleavedBufferAttribute(cb, 4, q * 4, true));
    });
    g.instanceCount = n;
    const mesh = new THREE.Mesh(g, crowdMaterial(uniforms, SCARF_VERT_HEAD, SCARF_VERT_MAIN, 'torcida3d-cachecol', THREE.DoubleSide));
    mesh.frustumCulled = false;
    mesh.name = 'cachecois';
    mesh.userData.tris = triCount(sg) * n;
    group.add(mesh);
  }

  // ---- bandeiras
  if (!ctx.seats) {
    group.add(buildFlags({ U, seats, rng, count: cfg.flags, palH, palA }));
    group.add(buildBanners({ U, seats, rng, palH, palA, count: cfg.banners }));
    group.add(buildTifo({ U, palH }));
  }

  for (const m of group.children) skipOverride(m);

  const people = chosen[0].length + chosen[1].length;
  group.userData.count = people;
  group.userData.quality = qk;
  group.userData.tris = group.children.reduce((a, m) => a + (m.userData.tris || 0), 0)
    - sectors.reduce((a, sc) => a + (sc.far ? sc.far.userData.tris : 0), 0);
  // nível de detalhe por setor: malha leve quando um torcedor ocupa menos que
  // FAR_FRAC da altura da tela (com folga para não ficar trocando na divisa)
  group.userData.updateLOD = (camera) => {
    if (!camera || !camera.isPerspectiveCamera) return;
    const k = 1.7 / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) * (camera.zoom || 1);
    const cp = camera.position;
    for (const sc of sectors) {
      if (!sc.far) continue;
      const d = Math.max(1, cp.distanceTo(sc.c) - sc.r * 0.6);
      const frac = k / d;
      if (sc.useFar ? frac > FAR_FRAC * 1.15 : frac < FAR_FRAC) sc.useFar = !sc.useFar;
      sc.near.visible = !sc.useFar; sc.far.visible = sc.useFar;
    }
  };
  group.userData.sectors = sectors;
  group.userData.uniforms = uniforms;
  group.userData.ctx = ctx;
  group.userData.debugPose = (k) => { uniforms.uDebugPose.value = k; };   // página de teste
  return group;
}
