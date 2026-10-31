// Campo oficial (IFAB Lei 1, medidas em CAMPO): gramado com faixas de corte, linhas finas
// com antisserrilhado analítico (um único mesh), gols com a rede VÉU DE NOIVA branca que BALANÇA (malha subdividida, a
// deformação no vertex shader pela conta de rede-onda.js — uniforms de até 4 batidas), bandeirinhas,
// placas com marcas FICTÍCIAS e arquibancada (a torcida é de torcida.js). Poucos draw calls: tudo o que
// é estático vira um mesh só por material.
import * as THREE from 'three';
import { CAMPO, ESTADIO } from '../config.js';
import { juntarGeometrias, cilindroEntre, caixa } from './util.js';
import {
  GRAMA, texGramado, texDetalheGrama, texPlacas, PLACA, texArquibancada, ARQ, texBandeira, texBrilho, mascaraTexto,
} from './texturas.js';
import { imagemEscudo } from './escudo-desenho.js';
import { REDE_GLSL, fixo as fixoRede, REDE } from './rede-onda.js';
import { VEU, COMPRIMENTO_PERFIL, pontoPerfil, profundidadeVeu } from '../rede-forma.js';
// trama da rede (m): colmeia de 12 cm com fio de 6 mm; o fio não afina abaixo de ~1 px, só fica até uRedeMin mais
// transparente; longe (célula < ~2 px) vira um véu branco de opacidade `longe`
export const REDE_TRAMA = { celula: 0.12, fio: 0.006, opacMin: 0.85, longe: 0.32 };
// luz própria (emissive) da rede e da armação, de dia e de noite: a face que a câmera vê fica de costas para o sol e,
// à noite, só pega a luz fraca dos refletores — sem isto o fio saía cinza (L* 79 de dia, 50 à noite, de perto)
export const LUZ_GOL = { redeDia: 0xaaadab, redeNoite: 0xaaadab, armDia: 0x2a2c2b, armNoite: 0x5a5c5b };
import { cameraNoLadoDeCa } from './torcida-dados.js';
import { LUZ_FALSA_GLSL, UNIFORMS_LUZ } from './luz-falsa.js';
import { retasAreaTecnica } from '../estadio-forma.js';
import { fileirasGolaco, gradeGolaco, pintorGolaco, TUNEL, CADEIRAS3D, DEGRAU_LOD } from './cadeiras-dados.js';

const MX = CAMPO.meioX, MZ = CAMPO.meioZ;
const L = CAMPO.linha, h = L / 2;
// meia-largura da GEOMETRIA da linha (a linha pintada tem h = 6 cm; o resto é margem para o
// antisserrilhado quando a linha fica com menos de 1 px na tela — "phone-wire AA", Humus)
const HG = 0.45;

// ------------------------------------------------------------------ material da grama

// 0 = dia, 1 = noite (compartilhado pelos materiais do chão): à noite a luz dos refletores
// forma um "poço" de luz — gramado mais claro no meio e caindo para as bordas e o entorno.
const uNoite = { value: 0 };
const LUZ_NOITE_GLSL = `
  float luzNoite(vec2 p) {
    vec2 q = vec2(p.x / 62.0, p.y / 41.0);
    float r2 = q.x * q.x * 0.75 + q.y * q.y;
    return mix(1.04, 0.5, smoothstep(0.3, 1.35, r2));
  }`;

/** Injeta o grão (textura de detalhe em coordenadas do mundo, duas escalas) num material. */
function comDetalhe(mat, detalhe, forca) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uDetalhe = { value: detalhe };
    sh.uniforms.uForca = { value: forca };
    sh.uniforms.uNoite = uNoite;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vMundoXZ;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvMundoXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uDetalhe;\nuniform float uForca;\nuniform float uNoite;\nvarying vec2 vMundoXZ;' + LUZ_NOITE_GLSL)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          float d1 = texture2D(uDetalhe, vMundoXZ * 0.55).r;
          float d2 = texture2D(uDetalhe, vMundoXZ * 0.137 + 0.31).r;
          float d = d1 * d2 * 4.0;
          diffuseColor.rgb *= mix(1.0, d, uForca);
          diffuseColor.rgb *= mix(1.0, luzNoite(vMundoXZ), uNoite);
        }`);
  };
  mat.customProgramCacheKey = () => 'grama-detalhe-' + forca;
  return mat;
}

// ------------------------------------------------------------------ linhas

function criarLinhas(detalhe) {
  const pos = [], cruz = [], idx = [];
  const y = 0.012;
  function quad(ax, az, bx, bz, ca, cb) {
    // segmento reto da linha central A→B; ca/cb = deslocamento lateral de cada borda
    const dx = bx - ax, dz = bz - az;
    const l = Math.hypot(dx, dz) || 1;
    const nx = -dz / l, nz = dx / l;
    const i0 = pos.length / 3;
    pos.push(ax + nx * ca, y, az + nz * ca, bx + nx * ca, y, bz + nz * ca, bx + nx * cb, y, bz + nz * cb, ax + nx * cb, y, az + nz * cb);
    cruz.push(ca, ca, cb, cb);
    idx.push(i0, i0 + 2, i0 + 1, i0, i0 + 3, i0 + 2);
  }
  function reta(ax, az, bx, bz) {
    // estende h nas pontas para os cantos fecharem
    const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz);
    const ux = dx / l, uz = dz / l;
    quad(ax - ux * h, az - uz * h, bx + ux * h, bz + uz * h, -HG, HG);
  }
  function arco(cx, cz, rc, a0, a1, n) {
    if (a1 < a0) { const t = a0; a0 = a1; a1 = t; } // sempre no sentido que mantém a face para cima
    const r0 = Math.max(0, rc - HG), r1 = rc + HG;
    for (let i = 0; i < n; i++) {
      const t0 = a0 + (a1 - a0) * (i / n), t1 = a0 + (a1 - a0) * ((i + 1) / n);
      const i0 = pos.length / 3;
      const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
      pos.push(cx + c0 * r0, y, cz + s0 * r0, cx + c1 * r0, y, cz + s1 * r0, cx + c1 * r1, y, cz + s1 * r1, cx + c0 * r1, y, cz + s0 * r1);
      cruz.push(r0 - rc, r0 - rc, r1 - rc, r1 - rc);
      idx.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
    }
  }
  // linhas laterais e de fundo (a linha pertence à área que delimita: borda externa na medida)
  reta(-MX, -(MZ - h), MX, -(MZ - h));
  reta(-MX, MZ - h, MX, MZ - h);
  reta(-(MX - h), -MZ, -(MX - h), MZ);
  reta(MX - h, -MZ, MX - h, MZ);
  // linha do meio, círculo central e marca central
  reta(0, -MZ + L, 0, MZ - L);
  arco(0, 0, CAMPO.raioCirculo - h, 0, Math.PI * 2, 160);
  arco(0, 0, 0.055, 0, Math.PI * 2, 20);
  for (const s of [-1, 1]) {
    // grande área
    const ax = s * (MX - CAMPO.area.profundidade + h), az = CAMPO.area.largura / 2 - h;
    reta(ax, -az, ax, az);
    reta(s * MX, -az, ax, -az);
    reta(s * MX, az, ax, az);
    // pequena área
    const px = s * (MX - CAMPO.pequenaArea.profundidade + h), pz = CAMPO.pequenaArea.largura / 2 - h;
    reta(px, -pz, px, pz);
    reta(s * MX, -pz, px, -pz);
    reta(s * MX, pz, px, pz);
    // marca do pênalti
    const mx = s * (MX - CAMPO.marcaPenalti);
    arco(mx, 0, 0.055, 0, Math.PI * 2, 20);
    // meia-lua: parte do círculo de 9,15 m em volta da marca que fica fora da área
    const rc = CAMPO.raioArco - h;
    const lim = Math.acos((CAMPO.area.profundidade - CAMPO.marcaPenalti) / rc);
    const centro = s > 0 ? Math.PI : 0;
    arco(mx, 0, rc, centro - lim, centro + lim, 64);
    // arcos de escanteio (quarto de círculo para dentro do campo)
    for (const t of [-1, 1]) {
      const cx = s * MX, cz = t * MZ;
      const a0 = Math.atan2(-t, 0), a1 = Math.atan2(0, -s);
      let da = a1 - a0;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      arco(cx, cz, CAMPO.raioEscanteio - h, a0, a0 + da, 16);
    }
  }
  // as duas ÁREAS TÉCNICAS (IFAB Regra 1; estadio-forma.js retasAreaTecnica: 3 linhas de cada, para dentro da área, na
  // mesma malha — nenhuma chamada de desenho a mais): cada retângulo vira a linha central dele, sem esticar as pontas
  for (const r of retasAreaTecnica()) {
    if (r.x1 - r.x0 >= r.z1 - r.z0) { const zc = (r.z0 + r.z1) / 2; quad(r.x0, zc, r.x1, zc, -HG, HG); }
    else { const xc = (r.x0 + r.x1) / 2; quad(xc, r.z0, xc, r.z1, -HG, HG); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  geo.setAttribute('aCruz', new THREE.Float32BufferAttribute(cruz, 1));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  const mat = new THREE.MeshLambertMaterial({
    color: 0xf3f6f1, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
  });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uMeia = { value: h };
    sh.uniforms.uDetalhe = { value: detalhe };
    sh.uniforms.uNoite = uNoite;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aCruz;\nvarying float vCruz;\nvarying vec2 vMundoXZ;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvCruz = aCruz;\nvMundoXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uMeia;\nuniform sampler2D uDetalhe;\nuniform float uNoite;\nvarying float vCruz;\nvarying vec2 vMundoXZ;' + LUZ_NOITE_GLSL)
      .replace('#include <alphatest_fragment>', `
        {
          // cobertura analítica da linha no pixel; abaixo de ~1,5 px a linha não afina mais,
          // só fica mais transparente (não some nem pisca à distância)
          float w = max(fwidth(vCruz), 1e-5);
          float hw = max(uMeia, 0.75 * w);
          float cob = clamp((hw - abs(vCruz)) / w + 0.5, 0.0, 1.0) * (uMeia / hw);
          diffuseColor.a *= cob;
          if (diffuseColor.a < 0.004) discard;
          float d = texture2D(uDetalhe, vMundoXZ * 0.55).r * 2.0;
          diffuseColor.rgb *= mix(1.0, d, 0.35);
          diffuseColor.rgb *= mix(1.0, luzNoite(vMundoXZ), uNoite);
        }
        #include <alphatest_fragment>`);
  };
  mat.customProgramCacheKey = () => 'linhas-aa';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.renderOrder = 1;
  mesh.name = 'linhas';
  return mesh;
}

// ------------------------------------------------------------------ gols

function criarGols() {
  const g = CAMPO.gol;
  const R = g.raioPoste;
  const zp = g.largura / 2 + R;          // centro do poste (igual a bola.js)
  const yt = g.altura + R;               // centro do travessão
  const geos = [], cores = [];
  const branco = new THREE.Color(0xf7f9f8), preto = new THREE.Color(0x1a1d1e);
  const zl = g.largura / 2, H = VEU.haste, F = VEU.fundo;
  for (const s of [-1, 1]) {
    const x = s * MX;
    for (const t of [-1, 1]) {
      geos.push(cilindroEntre([x, 0, t * zp], [x, yt + R, t * zp], R, 16)); cores.push(branco);
      // haste do canto de cima (véu de noiva): do alto do poste para trás, segura a faixa de cima da rede
      geos.push(cilindroEntre([x, yt, t * zp], [x + s * H, g.altura + 0.02, t * zl], 0.028, 8)); cores.push(branco);
      // pé da lateral no chão (corda presa por estacas), do poste até o fundo do véu
      geos.push(cilindroEntre([x + s * R, 0.012, t * zl], [x + s * F, 0.012, t * zl], 0.012, 5)); cores.push(branco);
      // mastro da bandeirinha
      geos.push(cilindroEntre([x, 0, t * MZ], [x, 1.55, t * MZ], 0.018, 8)); cores.push(branco);
      geos.push(cilindroEntre([x, 1.55, t * MZ], [x, 1.57, t * MZ], 0.022, 8)); cores.push(preto);
    }
    geos.push(cilindroEntre([x, yt, -zp - R], [x, yt, zp + R], R, 16)); cores.push(branco);
    // fundo do véu preso no chão (corda e estacas)
    geos.push(cilindroEntre([x + s * F, 0.012, -zl], [x + s * F, 0.012, zl], 0.014, 5)); cores.push(branco);
  }
  const matArm = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: LUZ_GOL.armDia });
  const estrutura = new THREE.Mesh(juntarGeometrias(geos, cores), matArm);
  estrutura.name = 'gols';
  const rede = criarRede();
  return { estrutura, rede: rede.mesh, uniformsRede: rede.uniforms, matArm, matRede: rede.mesh.material };
}

/**
 * Rede VÉU DE NOIVA dos dois gols (forma de ../rede-forma.js, a mesma da física da bola): o véu (faixa de cima +
 * a curva até o chão, na largura toda) e as duas laterais (do poste até o véu), numa malha a ~15 cm com dois
 * atributos por vértice — aFixo (0 na armação: rede-onda.js fixo) e aUvM (coordenadas em METROS sobre o tecido,
 * para a trama colmeia do fragment shader). O vertex shader empurra o vértice com o campo vetorial redeDesloc
 * (REDE_GLSL) e refaz a normal pela inclinação da bolsa. A trama é procedural (sem textura): hexágonos com fio
 * que nunca fica mais fino que ~1 px (só mais transparente) e, longe, um véu branco uniforme (sem moiré).
 */
function criarRede() {
  const g = CAMPO.gol;
  const PASSO_MALHA = 0.15;
  const zl = g.largura / 2, ya = g.altura;
  const pos = [], nrm = [], uvm = [], fixa = [], idx = [];
  const _o = { X: 0, y: 0, nx: 0, ny: 0, s: 0 };
  for (const s of [-1, 1]) {
    // véu: u na largura (z), v ao longo do perfil (s)
    const na = Math.round(g.largura / PASSO_MALHA), nb = Math.round(COMPRIMENTO_PERFIL / PASSO_MALHA);
    let base = pos.length / 3;
    for (let b = 0; b <= nb; b++) {
      pontoPerfil(b / nb * COMPRIMENTO_PERFIL, _o);
      for (let a = 0; a <= na; a++) {
        const z = -zl + a / na * g.largura, x = s * (MX + _o.X), y = _o.y;
        pos.push(x, y, z); nrm.push(-s * _o.nx, -_o.ny, 0); uvm.push(z + zl, _o.s);
        fixa.push(fixoRede(x, y, z));
      }
    }
    for (let b = 0; b < nb; b++) for (let a = 0; a < na; a++) {
      const k = base + b * (na + 1) + a;
      idx.push(k, k + 1, k + na + 2, k, k + na + 2, k + na + 1);
    }
    // laterais: X = a · profundidade(y) (colunas em leque), y de 0 a HG
    for (const t of [-1, 1]) {
      const nx = Math.round(VEU.fundo / PASSO_MALHA), ny = Math.round(ya / PASSO_MALHA);
      base = pos.length / 3;
      for (let b = 0; b <= ny; b++) {
        const y = b / ny * ya, prof = profundidadeVeu(y);
        for (let a = 0; a <= nx; a++) {
          const X = a / nx * prof, x = s * (MX + X), z = t * zl;
          pos.push(x, y, z); nrm.push(0, 0, -t); uvm.push(X, y);
          fixa.push(fixoRede(x, y, z));
        }
      }
      for (let b = 0; b < ny; b++) for (let a = 0; a < nx; a++) {
        const k = base + b * (nx + 1) + a;
        idx.push(k, k + 1, k + nx + 2, k, k + nx + 2, k + nx + 1);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('aUvM', new THREE.Float32BufferAttribute(uvm, 2));
  geo.setAttribute('aFixo', new THREE.Float32BufferAttribute(fixa, 1));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  geo.boundingSphere.radius += REDE.ampMax + 0.2;
  const mat = new THREE.MeshLambertMaterial({
    color: 0xf2f4f3, emissive: LUZ_GOL.redeDia, transparent: true, side: THREE.DoubleSide, depthWrite: false,
  });
  const uniforms = {
    uRedeA: { value: new Float32Array(4 * REDE.maxImpactos) }, uRedeB: { value: new Float32Array(4 * REDE.maxImpactos).fill(-1) },
    uRedeCel: { value: REDE_TRAMA.celula }, uRedeFio: { value: REDE_TRAMA.fio }, uRedeMin: { value: REDE_TRAMA.opacMin }, uRedeLonge: { value: REDE_TRAMA.longe },
  };
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aFixo;\nattribute vec2 aUvM;\nvarying vec2 vUvM;' + REDE_GLSL)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        vec3 redeD = vec3(0.0);
        if (aFixo > 0.0) {
          redeD = redeDesloc(position) * aFixo;
          if (dot(redeD, redeD) > 0.0) {
            vec3 nP = -objectNormal;
            vec3 ta = normalize(abs(nP.y) < 0.9 ? cross(nP, vec3(0.0, 1.0, 0.0)) : cross(nP, vec3(1.0, 0.0, 0.0)));
            vec3 tb = cross(nP, ta);
            vec3 da = redeDesloc(position + ta * 0.1) * aFixo - redeD;
            vec3 db = redeDesloc(position + tb * 0.1) * aFixo - redeD;
            vec3 n2 = normalize(cross(ta * 0.1 + da, tb * 0.1 + db));
            objectNormal = dot(n2, objectNormal) < 0.0 ? -n2 : n2;
          }
        }
        vUvM = aUvM;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed += redeD;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vUvM;
        uniform float uRedeCel, uRedeFio, uRedeMin, uRedeLonge;
        // trama colmeia (hexágonos de ponta para cima, distância entre lados = 1 célula)
        float redeHexBorda(vec2 p) {
          vec2 r = vec2(1.0, 1.7320508), h = r * 0.5;
          vec2 a = mod(p, r) - h, b = mod(p - h, r) - h;
          vec2 g = dot(a, a) < dot(b, b) ? a : b;
          g = abs(g);
          return 0.5 - max(dot(g, vec2(0.5, 0.8660254)), g.x);
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec2 pc = vUvM / uRedeCel;
          float e = redeHexBorda(pc);
          float fw = max(length(vec2(dFdx(pc.x), dFdy(pc.x))), length(vec2(dFdx(pc.y), dFdy(pc.y))));
          float w = 0.5 * uRedeFio / uRedeCel;
          float wd = max(w, 0.6 * fw);
          float a = 1.0 - smoothstep(wd - 0.5 * fw, wd + 0.5 * fw, e);
          a *= clamp(w / wd, uRedeMin, 1.0);
          a = mix(a, uRedeLonge, smoothstep(0.3, 0.75, fw));
          diffuseColor.a *= a;
          if (diffuseColor.a < 0.01) discard;
        }`);
  };
  mat.customProgramCacheKey = () => 'rede-veu';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'rede';
  mesh.renderOrder = 2;
  return { mesh, uniforms };
}

// ------------------------------------------------------------------ bandeirinhas

function criarBandeiras(ident = null) {
  const pos = [], uv = [], nrm = [], ond = [];
  const W = 0.42, H = 0.3, NS = 6;
  for (const s of [-1, 1]) for (const t of [-1, 1]) {
    const x = s * MX, z = t * MZ;
    // a bandeira aponta para fora do campo, na direção da linha de fundo
    const dx = s, dz = 0;
    for (let i = 0; i < NS; i++) {
      const u0 = i / NS, u1 = (i + 1) / NS;
      const quadr = [[u0, 0], [u1, 0], [u1, 1], [u0, 0], [u1, 1], [u0, 1]];
      for (const [u, v] of quadr) {
        pos.push(x + dx * u * W, 1.55 - H + v * H, z + dz * u * W);
        uv.push(s > 0 ? u : 1 - u, v);
        nrm.push(0, 0, 1);
        ond.push(u);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('aOnda', new THREE.Float32BufferAttribute(ond, 1));
  geo.computeBoundingSphere();
  const mat = new THREE.MeshLambertMaterial({ map: texBandeira(ident ? ident.escanteio : null), side: THREE.DoubleSide });
  const tempo = { value: 0 };
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTempo = tempo;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aOnda;\nuniform float uTempo;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float fase = transformed.x * 1.7 + transformed.z * 0.9;
        transformed.z += sin(uTempo * 6.0 - aOnda * 7.0 + fase) * 0.05 * aOnda;
        transformed.y -= aOnda * aOnda * 0.03;`);
  };
  mat.customProgramCacheKey = () => 'bandeira';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'bandeiras';
  return { mesh, tempo };
}

// ------------------------------------------------------------------ placas

function criarPlacas(aniso, ident = null) {
  const PX = MX + CAMPO.entorno, PZ = MZ + CAMPO.entorno;
  const A = PLACA.altura;
  const pos = [], uv = [], nrm = [];
  let u0 = 0;
  function face(ax, az, bx, bz, nx, nz) {
    const l = Math.hypot(bx - ax, bz - az);
    const u1 = u0 + l / PLACA.periodo;
    pos.push(ax, 0, az, bx, 0, bz, bx, A, bz, ax, 0, az, bx, A, bz, ax, A, az);
    uv.push(u0, 0, u1, 0, u1, 1, u0, 0, u1, 1, u0, 1);
    for (let k = 0; k < 6; k++) nrm.push(nx, 0, nz);
    u0 = u1;
  }
  // lado de lá (z−), lado de cá (z+) e fundos (x±), viradas para o campo
  const d = 0.02; // a face de LED fica 2 cm à frente da caixa (sem z-fighting)
  face(-PX, -PZ + d, PX, -PZ + d, 0, 1);
  face(PX, PZ - d, -PX, PZ - d, 0, -1);
  face(PX - d, -PZ, PX - d, PZ, -1, 0);
  face(-PX + d, PZ, -PX + d, -PZ, 1, 0);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.computeBoundingSphere();
  // LED: material sem luz (a placa brilha sozinha), mais forte à noite
  const mat = new THREE.MeshBasicMaterial({ map: ident ? texPlacas(aniso, ident.paineis, [imagemEscudo(ident, 0), imagemEscudo(ident, 1)]) : texPlacas(aniso), color: 0xdddddd, fog: false });
  const frente = new THREE.Mesh(geo, mat);
  frente.name = 'placas';
  const E = 0.12;
  const preto = new THREE.Color(0x0b0d0e);
  const caixas = [
    caixa(0, A / 2, -PZ - E / 2, PX * 2 + E * 2, A, E), caixa(0, A + 0.02, -PZ - E / 2, PX * 2 + E * 2, 0.04, E + 0.02),
    caixa(PX + E / 2, A / 2, 0, E, A, PZ * 2), caixa(PX + E / 2, A + 0.02, 0, E + 0.02, 0.04, PZ * 2),
    caixa(-PX - E / 2, A / 2, 0, E, A, PZ * 2), caixa(-PX - E / 2, A + 0.02, 0, E + 0.02, 0.04, PZ * 2),
  ];
  const cores = caixas.map(() => preto);
  // lado de cá: a câmera de TV vê as COSTAS destas placas embaixo da tela (lateral e escanteio do lado de cá) —
  // antes uma faixa preta; agora o acolchoado verde da cor do gramado de fora (a face vertical recebe ~0,7 da luz do
  // chão: o verde é ~1,4× mais claro que o 0x2c5a26 do chão) em painéis de 6 m alternados, com um friso verde —
  // some no gramado atrás delas (pedido de 11/10)
  const verdes = [new THREE.Color(0x3b7a35), new THREE.Color(0x36722f)], friso = new THREE.Color(0x4f9a47);
  const painel = PLACA.periodo / 4, x0 = -PX - E, total = 2 * (PX + E);
  for (let k = 0, x = x0; x < x0 + total - 1e-6; k++, x += painel) {
    const w = Math.min(painel, x0 + total - x);
    caixas.push(caixa(x + w / 2, A / 2, PZ + E / 2, w, A, E)); cores.push(verdes[k % 2]);
  }
  caixas.push(caixa(0, A + 0.02, PZ + E / 2, PX * 2 + E * 2, 0.04, E + 0.02)); cores.push(friso);
  const corpo = new THREE.Mesh(juntarGeometrias(caixas, cores), new THREE.MeshLambertMaterial({ vertexColors: true }));
  corpo.name = 'placas-estrutura';
  return { frente, corpo, mat };
}

/**
 * Bancos de reservas (config.js ESTADIO.bancos): um de cada lado do túnel, atrás das placas do lado de cá, abertos para
 * o campo (parede do fundo, laterais, cobertura, assento e encosto verdes). Vão na MALHA do lado de cá (`L`, retalhos da
 * textura das cadeiras × cor por vértice): com a câmera de TV dentro da arquibancada de cá eles saem do desenho junto
 * com ela — no celular a TV fica mais alta e mais atrás, e a cobertura aparecia como uma placa lisa no canto de baixo.
 */
function bancosDeReservas(L, CU, CV, VERDE) {
  const B = ESTADIO.bancos;
  const [za, zb] = B.z, h = B.altura, prof = zb - za, zc = (za + zb) / 2;
  const concreto = (cx, cy, cz, w, a, d, c) => caixaL(L, cx, cy, cz, w, a, d, CU, CV, c);
  const verde = (cx, cy, cz, w, a, d, c) => caixaL(L, cx, cy, cz, w, a, d, [0.2, 0.21], VERDE, c);
  for (const s of [-1, 1]) {
    const xa = s * B.x[0], xb = s * B.x[1], xc = (xa + xb) / 2, larg = Math.abs(xb - xa);
    concreto(xc, h / 2, zb - 0.1, larg, h, 0.2, 0.3);              // parede do fundo
    concreto(xa, h / 2, zc, 0.15, h, prof, 0.3);                    // laterais
    concreto(xb, h / 2, zc, 0.15, h, prof, 0.3);
    concreto(xc, h + 0.06, zc - 0.25, larg + 0.4, 0.12, prof + 0.6, 0.42); // cobertura
    verde(xc, 0.45, zb - 0.75, larg - 0.6, 0.1, 0.5, 0.9);           // assento
    verde(xc, 0.82, zb - 0.45, larg - 0.6, 0.62, 0.08, 0.55);        // encosto
    concreto(xc, 0.02, zc, larg, 0.04, prof, 0.5);                  // piso
  }
}

/** Caixa de 6 faces na malha da arquibancada (`L.quad`), toda no mesmo retalho (u, v) da textura e cor c. */
function caixaL(L, cx, cy, cz, w, a, d, [u0, u1], [v0, v1], c) {
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - a / 2, y1 = cy + a / 2, z0 = cz - d / 2, z1 = cz + d / 2;
  L.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], u0, u1, v0, v1, c);
  L.quad([x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], u0, u1, v0, v1, c);
  L.quad([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], u0, u1, v0, v1, c);
  L.quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], u0, u1, v0, v1, c);
  L.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], u0, u1, v0, v1, c);
  L.quad([x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0], u0, u1, v0, v1, c);
}

// ------------------------------------------------------------------ arquibancada e entorno

/**
 * Máscara das cadeiras 3D de perto (item 69; render/cadeiras3d.js escreve): até `CADEIRAS3D.blocosMax` caixas orientadas
 * (os blocos que viraram cadeira 3D) onde o material das arquibancadas troca a cadeira PINTADA pelo concreto do degrau
 * (o piso e o espelho pela normal) — a cadeira 3D fica sozinha em cima do degrau, sem a pintada embaixo. Uniforms
 * compartilhados por todos os materiais de arquibancada (nada recompila); sem bloco perto (n = 0) a conta nem roda.
 */
const NPERTO = CADEIRAS3D.blocosMax;
export const UNIFORMS_PERTO = {
  uPertoN: { value: 0 },
  uPertoC: { value: Array.from({ length: NPERTO }, () => new THREE.Vector4()) },   // centro (x, y, z) e 0
  uPertoE: { value: Array.from({ length: NPERTO }, () => new THREE.Vector4()) },   // meia-extensão (ao longo, y, de lado)
  uPertoA: { value: Array.from({ length: NPERTO }, () => new THREE.Vector4()) },   // eixo ao longo (x, z)
  uConcPiso: { value: new THREE.Color(0x43494c) }, uConcEspelho: { value: new THREE.Color(0x3b4043) },
};
const PERTO_GLSL = `
uniform int uPertoN;
uniform vec4 uPertoC[${NPERTO}];
uniform vec4 uPertoE[${NPERTO}];
uniform vec4 uPertoA[${NPERTO}];
uniform vec3 uConcPiso;
uniform vec3 uConcEspelho;
varying vec3 vNormMundo;
bool cadeiraPerto(vec3 p) {
  for (int i = 0; i < ${NPERTO}; i++) {
    if (i >= uPertoN) break;
    vec3 q = p - uPertoC[i].xyz;
    vec2 ax = uPertoA[i].xy;
    float al = dot(q.xz, ax), at = dot(q.xz, vec2(-ax.y, ax.x));
    if (abs(al) <= uPertoE[i].x && abs(q.y) <= uPertoE[i].y && abs(at) <= uPertoE[i].z) return true;
  }
  return false;
}`;

/**
 * A malha de cada setor em escada só com a câmera perto dela (render/cadeiras-dados.js DEGRAU_LOD, com histerese): troca a
 * geometria do Mesh (a lisa ↔ a em escada) — o desenho e o corte pela câmera não mudam (a mesma malha, o mesmo material;
 * o vão da pré-carga do lado de cá, drawRange, passa junto). soLisa: a câmera de jogo (a TV, camera.js deJogo) fica sempre
 * com a lisa — de 30 m ou mais o degrau não aparece e o custo do jogo na TV não sobe (a do fundo chegava a < 52 m).
 */
export function trocarLod(malhas, pos, soLisa = false) {
  for (const m of malhas) {
    const l = m.userData.lod;
    if (!l) continue;
    let d = Infinity;
    if (!soLisa) for (const c of l.caixas) if (!c.isEmpty()) d = Math.min(d, c.distanceToPoint(pos));
    const quer = l.emDegrau ? d <= DEGRAU_LOD.sai : d <= DEGRAU_LOD.entra;
    if (quer === l.emDegrau) continue;
    const velha = m.geometry, nova = quer ? l.deg : l.liso;
    nova.setDrawRange(velha.drawRange.start, velha.drawRange.count);
    velha.setDrawRange(0, Infinity);
    m.geometry = nova;
    l.emDegrau = quer;
  }
}
/**
 * Luz FALSA dos sinalizadores no concreto e nas cadeiras (luz-falsa.js: uniform vec4[8], nunca PointLight — uma luz de
 * verdade recompilaria todos os materiais do three.js no meio do gol). Sem sinalizador aceso, a conta nem roda. Também a
 * máscara das cadeiras 3D de perto (UNIFORMS_PERTO): dentro de um bloco em 3D, o concreto do degrau no lugar da pintura.
 */
export function comLuzFalsa(mat, chave) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uFlare = UNIFORMS_LUZ.uFlare;
    sh.uniforms.uFlareN = UNIFORMS_LUZ.uFlareN;
    for (const k of Object.keys(UNIFORMS_PERTO)) sh.uniforms[k] = UNIFORMS_PERTO[k];
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMundoFlare;\nvarying vec3 vNormMundo;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvMundoFlare = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvNormMundo = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMundoFlare;' + LUZ_FALSA_GLSL + PERTO_GLSL)
      .replace('#include <map_fragment>', '#include <map_fragment>\nif (uPertoN > 0 && cadeiraPerto(vMundoFlare)) diffuseColor.rgb = diffuse * (abs(vNormMundo.y) > 0.5 ? uConcPiso : uConcEspelho);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * luzFalsa(vMundoFlare);');
  };
  mat.customProgramCacheKey = () => 'arq-luz-falsa-' + chave;
  return mat;
}

function criarArquibancada(aniso, qualidade, ident = null) {
  const larg = qualidade === 'baixa' ? 1024 : 2048;
  const V_PAREDE = 0.975, vMax = 1 - 24 / 512;
  function construtor(comCor = false) {
    const pos = [], uv = [], nrm = [], cor = [];
    const a = new THREE.Vector3(), b = new THREE.Vector3(), n = new THREE.Vector3();
    function tri(p0, p1, p2, t0, t1, t2, c = 1) {
      a.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
      b.set(p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]);
      n.crossVectors(a, b).normalize();
      pos.push(...p0, ...p1, ...p2);
      uv.push(...t0, ...t1, ...t2);
      for (let k = 0; k < 3; k++) { nrm.push(n.x, n.y, n.z); cor.push(c, c, c); }
    }
    function quad(p0, p1, p2, p3, u0, u1, v0, v1, c = 1) {
      tri(p0, p1, p2, [u0, v0], [u1, v0], [u1, v1], c);
      tri(p0, p2, p3, [u0, v0], [u1, v1], [u0, v1], c);
    }
    function mesh(tex, chave) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
      if (comCor) geo.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
      geo.computeBoundingSphere();
      return new THREE.Mesh(geo, comLuzFalsa(new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide, vertexColors: comCor }), chave));
    }
    return { tri, quad, mesh };
  }
  const frenteZ = MZ + CAMPO.entorno + 4.5;           // 44,5
  const fundoZ = frenteZ + 30, yBase = 1.4, yTopo = 20;
  const xA = ARQ.comprimento / 2;                       // ±62,5 (encosta nas de trás dos gols)
  // o DEGRAU em geometria (item 69): cada fileira da grade (render/cadeiras-dados.js) é um piso e um espelho, com a
  // célula dela na textura (o piso na faixa de baixo, o espelho na de cima)
  const FL = fileirasGolaco('lado'), FF = fileirasGolaco('fundo');
  // lado de lá (z negativo), de frente para a câmera de TV, com GOLAÇO nas cadeiras
  const L1 = construtor();
  {
    const z0 = -frenteZ, z1 = -fundoZ, z = d => z0 - d;
    L1.quad([-xA, 0, z0], [xA, 0, z0], [xA, yBase, z0], [-xA, yBase, z0], 0, 1, V_PAREDE, 1);
    for (const r of FL) {
      L1.quad([-xA, r.y, z(r.d0)], [xA, r.y, z(r.d0)], [xA, r.y, z(r.d1)], [-xA, r.y, z(r.d1)], 0, 1, r.v0, r.vm);
      L1.quad([-xA, r.y, z(r.d1)], [xA, r.y, z(r.d1)], [xA, r.y1, z(r.d1)], [-xA, r.y1, z(r.d1)], 0, 1, r.vm, r.v1);
    }
    L1.quad([-xA, yTopo, z1], [xA, yTopo, z1], [xA, yTopo + 5, z1], [-xA, yTopo + 5, z1], 0, 1, V_PAREDE, 1);
    L1.quad([-xA, yTopo + 5, z1], [xA, yTopo + 5, z1], [xA, yTopo + 6.5, z1 + 16], [-xA, yTopo + 6.5, z1 + 16], 0, 1, V_PAREDE, 1);
    // laterais (triângulos) fechando o fim da arquibancada nos cantos
    for (const s of [-1, 1]) {
      const x = s * xA;
      L1.tri([x, 0, z0], [x, yBase, z0], [x, yTopo + 5, z1], [0.5, V_PAREDE], [0.5, 1], [0.6, 1]);
      L1.tri([x, 0, z0], [x, yTopo + 5, z1], [x, 0, z1], [0.5, V_PAREDE], [0.6, 1], [0.6, V_PAREDE]);
    }
  }
  const g = new THREE.Group();
  // com ?tm: as cores das cadeiras, do friso e do mosaico pelo mandante, e o nome dele no mosaico (identidade.js)
  const coresArq = ident ? ident.arquibancada : null, mascaraTm = ident ? mascaraTexto(ident.mosaico.texto, 2.6) : null;
  const lado = L1.mesh(texArquibancada(aniso, true, larg, coresArq, mascaraTm), 'lado');
  // atrás dos gols (x±): do canto de lá (z −74,5) até o lado de cá (z +44,5); 30 fileiras (as da textura até 82%)
  const L2 = construtor();
  for (const s of [-1, 1]) {
    const x0 = s * (MX + CAMPO.entorno + 4), x1 = s * (MX + CAMPO.entorno + 4 + 26), x = d => x0 + s * d;
    const za = s > 0 ? frenteZ : -fundoZ, zb = s > 0 ? -fundoZ : frenteZ;
    const yT = 17;
    const u1 = (frenteZ + fundoZ) / ARQ.comprimento;
    L2.quad([x0, 0, za], [x0, 0, zb], [x0, yBase, zb], [x0, yBase, za], 0, u1, V_PAREDE, 1);
    for (const r of FF) {
      L2.quad([x(r.d0), r.y, za], [x(r.d0), r.y, zb], [x(r.d1), r.y, zb], [x(r.d1), r.y, za], 0, u1, r.v0, r.vm);
      L2.quad([x(r.d1), r.y, za], [x(r.d1), r.y, zb], [x(r.d1), r.y1, zb], [x(r.d1), r.y1, za], 0, u1, r.vm, r.v1);
    }
    L2.quad([x1, yT, za], [x1, yT, zb], [x1, yT + 5, zb], [x1, yT + 5, za], 0, u1, V_PAREDE, 1);
  }
  const texSemNome = texArquibancada(aniso, false, larg, coresArq);
  const fundos = L2.mesh(texSemNome, 'fundos');
  lado.name = 'arquibancada-lado';
  fundos.name = 'arquibancada-fundos';
  const ca = criarLadoDeCa(construtor, texSemNome, { frenteZ, fundoZ, yBase, yTopo, xA, V_PAREDE, vMax, FL });
  g.userData.materiais = [lado.material, fundos.material, ca.material];
  g.userData.ladoDeCa = ca;
  // a grade das cadeiras (as 3D de perto, sob demanda: render/cadeiras3d.js) com a MESMA cor de cada célula da textura
  const pintLado = pintorGolaco({ comTexto: true, cores: coresArq, mascara: mascaraTm ?? mascaraTexto('GOLAÇO') });
  const pintSem = pintorGolaco({ comTexto: false, cores: coresArq });
  g.userData.cadeiras = {
    grade: gradeGolaco(),
    cor: a => (a.setor === 0 ? pintLado : pintSem)(a.f, a.a)?.cor ?? '#14181a',
    concreto: { piso: 0x43494c, espelho: 0x3b4043 },
  };
  g.add(lado, fundos, ca);
  return g;
}

/**
 * Arquibancada do LADO DE CÁ (z +; pedido de 11/10): a de lá espelhada (36 fileiras, 125 m), com o TÚNEL dos times
 * no meio (config.js ESTADIO.tunel: boca de 7 × 3,2 m na frente da arquibancada, o corredor escuro entrando 12 m por
 * baixo das cadeiras e as cadeiras cortadas em cima da boca) e um teto curto (o plano geral do intervalo, de z = 78
 * a 34 m de altura, passa por cima). A câmera de TV fica DENTRO desta arquibancada: atualizar() a tira do desenho
 * com a câmera lá dentro (torcida-dados.js cameraNoLadoDeCa, a mesma conta da torcida).
 */
function criarLadoDeCa(construtor, tex, A) {
  const { frenteZ: z0, fundoZ: z1, yBase, yTopo, xA, V_PAREDE, vMax, FL } = A;
  const T = ESTADIO.tunel;
  const L = construtor(true);
  const ti = T.largura / 2, mt = ti + 0.4, ya = T.altura, ytt = T.altura + T.laje;
  void vMax;
  const z = d => z0 + d;
  // a 1ª fileira que passa por cima do teto do túnel (as de baixo não têm cadeira em cima da boca: a mesma conta da
  // grade, render/cadeiras-dados.js — o piso abaixo do topo do túnel com a folga)
  const jT = FL.findIndex(r => r.y >= TUNEL.topo);
  const zt = z(FL[jT].d0);
  const uX = x => (x + xA) / (2 * xA);
  // retalhos da textura das cadeiras: o concreto claro da escada (célula da cadeira 0, no meio da fileira 17) e o
  // friso verde do parapeito (o topo da faixa de parede)
  const CU = [0.002, 0.006], CV = [0.484, 0.49], VERDE = [0.996, 0.999];
  // mureta da frente dos dois lados da boca
  L.quad([-xA, 0, z0], [-mt, 0, z0], [-mt, yBase, z0], [-xA, yBase, z0], uX(-xA), uX(-mt), V_PAREDE, 1);
  L.quad([mt, 0, z0], [xA, 0, z0], [xA, yBase, z0], [mt, yBase, z0], uX(mt), uX(xA), V_PAREDE, 1);
  // degraus (piso + espelho): os dois lados inteiros; no meio, só os que passam por cima do teto do túnel
  for (const r of FL) {
    const trechos = r.j >= jT ? [[-xA, xA]] : [[-xA, -mt], [mt, xA]];
    for (const [xa, xb] of trechos) {
      L.quad([xa, r.y, z(r.d0)], [xb, r.y, z(r.d0)], [xb, r.y, z(r.d1)], [xa, r.y, z(r.d1)], uX(xa), uX(xb), r.v0, r.vm);
      L.quad([xa, r.y, z(r.d1)], [xb, r.y, z(r.d1)], [xb, r.y1, z(r.d1)], [xa, r.y1, z(r.d1)], uX(xa), uX(xb), r.vm, r.v1);
    }
  }
  // parede de trás e um teto curto
  L.quad([-xA, yTopo, z1], [xA, yTopo, z1], [xA, yTopo + 5, z1], [-xA, yTopo + 5, z1], 0, 1, V_PAREDE, 1);
  L.quad([-xA, yTopo + 5, z1], [xA, yTopo + 5, z1], [xA, yTopo + 5.6, z1 - 4.5], [-xA, yTopo + 5.6, z1 - 4.5], 0, 1, V_PAREDE, 1);
  for (const s of [-1, 1]) {
    const x = s * xA;
    L.tri([x, 0, z0], [x, yBase, z0], [x, yTopo + 5, z1], [0.5, V_PAREDE], [0.5, 1], [0.6, 1]);
    L.tri([x, 0, z0], [x, yTopo + 5, z1], [x, 0, z1], [0.5, V_PAREDE], [0.6, 1], [0.6, V_PAREDE]);
  }
  // a boca do túnel saliente entre os degraus: o teto (laje), o espelho dele até o degrau de cima e as paredes de fora
  // (de cada piso até a laje) em concreto, a moldura verde
  L.quad([-mt, ytt, z0], [mt, ytt, z0], [mt, ytt, zt], [-mt, ytt, zt], CU[0], CU[1], CV[0], CV[1], 1);
  L.quad([-mt, ytt, zt], [mt, ytt, zt], [mt, FL[jT].y, zt], [-mt, FL[jT].y, zt], CU[0], CU[1], CV[0], CV[1], 0.8);
  for (const s of [-1, 1]) {
    const x = s * mt;
    for (const r of FL.slice(0, jT)) L.quad([x, r.y, z(r.d0)], [x, ytt, z(r.d0)], [x, ytt, z(r.d1)], [x, r.y, z(r.d1)], CU[0], CU[1], CV[0], CV[1], 0.9);
    L.quad([s * ti, 0, z0], [s * mt, 0, z0], [s * mt, ytt, z0], [s * ti, ytt, z0], 0.2, 0.21, VERDE[0], VERDE[1], 0.8);
  }
  L.quad([-ti, ya, z0], [ti, ya, z0], [ti, ytt, z0], [-ti, ytt, z0], 0.2, 0.21, VERDE[0], VERDE[1], 0.8);
  // por dentro: o concreto cada vez mais escuro (cor por vértice), o fundo quase preto
  const zf = z0 + T.profundidade;
  for (const s of [-1, 1]) L.quad([s * ti, 0, z0], [s * ti, 0, zf], [s * ti, ya, zf], [s * ti, ya, z0], CU[0], CU[1], CV[0], CV[1], 0.45);
  L.quad([-ti, ya, z0], [ti, ya, z0], [ti, ya, zf], [-ti, ya, zf], CU[0], CU[1], CV[0], CV[1], 0.32);
  L.quad([-ti, 0.02, z0], [ti, 0.02, z0], [ti, 0.02, zf], [-ti, 0.02, zf], CU[0], CU[1], CV[0], CV[1], 0.55);
  L.quad([-ti, 0, zf], [ti, 0, zf], [ti, ya, zf], [-ti, ya, zf], CU[0], CU[1], CV[0], CV[1], 0.1);
  bancosDeReservas(L, CU, CV, VERDE);
  const m = L.mesh(tex, 'ca');
  m.name = 'arquibancada-ca';
  // o corte é o de atualizar(): a câmera dentro dela ou as caixas fora do quadro. Duas caixas (a faixa da frente, baixa,
  // e a de cima): uma caixa só, com a câmera de TV do PC na frente dela olhando para baixo, passava no teste plano a
  // plano do Frustum (falso positivo) — 1 chamada de desenho à toa, medida em 20 instantes do jogo
  m.frustumCulled = false;
  const zm = z0 + 0.4 * (z1 - z0);
  const yS = zz => yBase + (yTopo - yBase) * (zz - z0) / (z1 - z0);
  m.userData.caixas = [
    new THREE.Box3(new THREE.Vector3(-xA - 0.5, -0.5, z0 - 0.6), new THREE.Vector3(xA + 0.5, yS(zm) + 0.5, zm + 0.5)),
    new THREE.Box3(new THREE.Vector3(-xA - 0.5, yS(zm) - 0.5, zm - 0.5), new THREE.Vector3(xA + 0.5, yTopo + 6.2, z1 + 0.6)),
    // os bancos de reservas, na frente da arquibancada
    new THREE.Box3(new THREE.Vector3(-ESTADIO.bancos.x[1] - 0.5, -0.1, ESTADIO.bancos.z[0] - 0.8), new THREE.Vector3(ESTADIO.bancos.x[1] + 0.5, ESTADIO.bancos.altura + 0.3, z0)),
  ];
  return m;
}

/** Torres de refletores nos cantos (só aparecem em câmeras mais abertas) + brilho à noite. */
function criarRefletores() {
  const geos = [], lamp = [];
  const spots = [];
  for (const s of [-1, 1]) for (const t of [-1, 1]) {
    const x = s * 72, z = t * 56;
    geos.push(cilindroEntre([x, 0, z], [x, 38, z], 0.45, 8));
    // painel virado para o centro do campo
    const g = new THREE.BoxGeometry(7, 3.2, 0.4);
    g.rotateY(Math.atan2(-x, -z));
    g.translate(x, 39.5, z);
    lamp.push(g);
    spots.push(new THREE.Vector3(x * 0.985, 39.5, z * 0.985));
  }
  const torres = new THREE.Mesh(juntarGeometrias(geos), new THREE.MeshLambertMaterial({ color: 0x2a2f31 }));
  const matLamp = new THREE.MeshBasicMaterial({ color: 0x3a4044 });
  const lampadas = new THREE.Mesh(juntarGeometrias(lamp), matLamp);
  const grupo = new THREE.Group();
  grupo.add(torres, lampadas);
  const brilhos = [];
  const tex = texBrilho();
  for (const p of spots) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xdfeaff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    sp.position.copy(p);
    sp.scale.set(26, 26, 1);
    sp.visible = false;
    grupo.add(sp);
    brilhos.push(sp);
  }
  grupo.name = 'refletores';
  return { grupo, matLamp, brilhos };
}

/**
 * Monta o campo inteiro. opc: {qualidade, aniso, identidade (identidade.js; só a do Total Match — `tm` — muda as placas,
 * as cadeiras, o mosaico e as bandeiras de escanteio: só desenho, a geometria é a mesma)}. Devolve {grupo,
 * definirHora(h), atualizar(t)}.
 */
export function criarCampo(opc) {
  const aniso = opc.aniso ?? 4;
  const ident = opc.identidade && opc.identidade.tm ? opc.identidade : null;
  const tamGrama = opc.qualidade === 'baixa' ? 1024 : 2048;
  const grupo = new THREE.Group();
  grupo.name = 'campo';
  const detalhe = texDetalheGrama(opc.qualidade === 'baixa' ? 256 : 512, aniso);
  // gramado (campo + entorno)
  const gg = new THREE.PlaneGeometry(GRAMA.lx, GRAMA.lz, 1, 1);
  gg.rotateX(-Math.PI / 2);
  const matGrama = comDetalhe(new THREE.MeshLambertMaterial({ map: texGramado(tamGrama, aniso) }), detalhe, 0.85);
  const grama = new THREE.Mesh(gg, matGrama);
  grama.receiveShadow = true;
  grama.name = 'gramado';
  grupo.add(grama);
  // chão de fora (concreto escuro), um pouco abaixo
  const gf = new THREE.PlaneGeometry(420, 420, 1, 1);
  gf.rotateX(-Math.PI / 2);
  gf.translate(0, -0.02, 0);
  // atrás das placas a grama continua até a arquibancada (mais escura, sem faixas)
  const fora = new THREE.Mesh(gf, comDetalhe(new THREE.MeshLambertMaterial({ color: 0x2c5a26 }), detalhe, 0.6));
  fora.name = 'chao-fora';
  grupo.add(fora);
  grupo.add(criarLinhas(detalhe));
  const gols = criarGols();
  grupo.add(gols.estrutura, gols.rede);
  // rede que balança: main.js escreve os impactos (rede-onda.js uniformsRede) nestes vetores
  const uRede = gols.uniformsRede;
  const band = criarBandeiras(ident);
  grupo.add(band.mesh);
  const placas = criarPlacas(aniso, ident);
  grupo.add(placas.frente, placas.corpo);
  // estádio com forma própria (render/estadio-real.js, sob demanda): a tigela e a cobertura dele, sem as torres
  const f3 = ident?.forma3d;
  const arq = f3 ? f3.real.criarTigela(f3.planta, { aniso, qualidade: opc.qualidade, ident, comLuzFalsa }) : criarArquibancada(aniso, opc.qualidade, ident);
  grupo.add(arq);
  const refl = criarRefletores();
  if (!f3) grupo.add(refl.grupo);
  const ladoDeCa = arq.userData.ladoDeCa;
  const _frustum = new THREE.Frustum(), _mat = new THREE.Matrix4();
  // cadeiras 3D de perto (item 69; render/cadeiras3d.js sob demanda: ligarCadeiras quando o módulo chega)
  let cad3d = null, alturaTela = 720, qualCad = opc.qualidade ?? 'media', horaCad = 'dia', torcidaCad = null;
  // pré-carga (como a torcida): no 1º quadro, se a câmera não a vê, a arquibancada do lado de cá vai para a GPU com
  // 0 triângulos (geometria e programa prontos) — o 1º corte de câmera que a mostra não engasga
  let precarga = true, restaurar = false;
  return {
    grupo,
    /** Vetores dos uniforms da rede (a = [x, y, z, amp]·4, b = [τ, pano, 0, 0]·4): rede-onda.js uniformsRede. */
    rede: { a: uRede.uRedeA.value, b: uRede.uRedeB.value, mesh: gols.rede },
    definirHora(hora) {
      const noite = hora === 'noite';
      uNoite.value = noite ? 1 : 0;
      // arquibancada à noite: só a luz que escapa dos refletores
      for (const m of arq.userData.materiais) m.color.setScalar(noite ? 0.42 : 1);
      arq.userData.definirHora?.(hora);
      placas.mat.color.setHex(noite ? 0xffffff : 0xd4d4d4);
      // rede e traves brancas também à noite (só a luz dos refletores deixava a rede cinza-escura)
      gols.matRede.emissive.setHex(noite ? LUZ_GOL.redeNoite : LUZ_GOL.redeDia);
      gols.matArm.emissive.setHex(noite ? LUZ_GOL.armNoite : LUZ_GOL.armDia);
      refl.matLamp.color.setHex(noite ? 0xf4f8ff : 0x3a4044);
      for (const b of refl.brilhos) b.visible = noite;
      horaCad = hora;
      cad3d?.definirHora(hora);
    },
    /**
     * t: s; camera (opcional): o lado de cá só vai para a GPU com a câmera fora dele e a caixa no quadro; desenha: este
     * quadro vai mesmo ser desenhado (com o celular em pé a tela de girar cobre tudo e nada é desenhado — a pré-carga
     * espera o 1º quadro desenhado de verdade); deJogo: é a câmera de jogo (a TV: camera.js deJogo) — sem cadeira 3D.
     */
    atualizar(t, camera = null, desenha = true, deJogo = false) {
      band.tempo.value = t;
      if (camera) {
        camera.updateMatrixWorld();
        _frustum.setFromProjectionMatrix(_mat.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
        const cx = ladoDeCa.userData.caixas;
        const dentroCa = cameraNoLadoDeCa(camera.position);
        const ver = !dentroCa && cx.some(c => _frustum.intersectsBox(c));
        if (restaurar) { restaurar = false; ladoDeCa.geometry.setDrawRange(0, Infinity); }
        if (precarga && desenha && !ver) { ladoDeCa.visible = true; ladoDeCa.geometry.setDrawRange(0, 0); restaurar = true; } else ladoDeCa.visible = ver;
        if (desenha) precarga = false;
        // o degrau das plantas curvas (lisa de longe e na TV, em escada de perto) e as cadeiras 3D dos blocos perto da câmera
        arq.userData.atualizarLod?.(camera.position, deJogo);
        cad3d?.atualizar(camera, alturaTela, dentroCa, deJogo);
      }
    },
    /** Liga as cadeiras 3D de perto (o módulo render/cadeiras3d.js chegou: main.js SOB.cadeiras). */
    ligarCadeiras(md) {
      if (cad3d || !arq.userData.cadeiras) return;
      cad3d = md.criarCadeiras3D({ grupo, info: arq.userData.cadeiras, uniforms: UNIFORMS_PERTO, qualidade: qualCad });
      cad3d.definirHora(horaCad);
      if (torcidaCad) cad3d.ligarTorcida(torcidaCad);
    },
    /** A torcida do estádio (render/torcida.js) ficou pronta: o torcedor 3D de perto senta nas cadeiras 3D (item 69, PR 2). */
    ligarTorcida(t) { torcidaCad = t; cad3d?.ligarTorcida(t); },
    /** Altura da tela em px CSS (a escolha dos blocos de perto é pelos px da cadeira). */
    definirAlturaTela(px) { if (px > 0) alturaTela = px; },
    definirQualidade(q) { qualCad = q; cad3d?.definirQualidade(q); },
    /** Mostra/esconde as cadeiras 3D (testes; escondidas, a cadeira pintada volta em todo bloco). */
    mostrarCadeiras(v) { cad3d?.ligar(v); },
    /** As cadeiras 3D neste quadro (testes): {carregado, blocos, instancias, teto} e a grade do estádio. */
    get cadeiras() { return { carregado: !!cad3d, blocos: cad3d?.blocos ?? 0, instancias: cad3d?.instancias ?? 0, teto: cad3d?.teto ?? null, mascara: UNIFORMS_PERTO.uPertoN.value, torcedores: cad3d?.torcedores ?? null }; },
    /** O torcedor 3D (testes: as malhas, o modelo e a VAT de render/torcedor3d.js), ou null. */
    get torcedor3d() { return cad3d?.torcedor3d ?? null; },
    get grade() { return arq.userData.cadeiras?.grade ?? null; },
    /** As malhas das arquibancadas agora (testes): {nome, visivel, triangulos, emDegrau (a malha em escada: DEGRAU_LOD)}. */
    get arquibancadas() {
      return arq.children.filter(m => /^arquibancada-/.test(m.name)).map(m => {
        const gg = m.geometry, n = gg.index ? gg.index.count : gg.attributes.position.count;
        return { nome: m.name, visivel: m.visible, triangulos: Math.round(Math.min(n, gg.drawRange.count) / 3), emDegrau: m.userData.lod ? m.userData.lod.emDegrau : true, trisLiso: m.userData.lod ? m.userData.lod.liso.index.count / 3 : null, trisDegrau: m.userData.lod ? m.userData.lod.deg.index.count / 3 : null };
      });
    },
    /** A arquibancada do lado de cá (testes: visível ou não neste quadro). */
    get ladoDeCa() { return ladoDeCa; },
  };
}
