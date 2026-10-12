// Campo oficial (IFAB Lei 1, medidas em CAMPO): gramado com faixas de corte, linhas finas
// com antisserrilhado analítico (um único mesh), gols com rede que BALANÇA (malha subdividida, a
// deformação no vertex shader pela conta de rede-onda.js — uniforms de até 4 batidas), bandeirinhas,
// placas com marcas FICTÍCIAS e arquibancada (a torcida é de torcida.js). Poucos draw calls: tudo o que
// é estático vira um mesh só por material.
import * as THREE from 'three';
import { CAMPO, ESTADIO } from '../config.js';
import { juntarGeometrias, cilindroEntre, caixa } from './util.js';
import {
  GRAMA, texGramado, texDetalheGrama, texRede, texPlacas, PLACA, texArquibancada, ARQ, texBandeira, texBrilho,
} from './texturas.js';
import { REDE_GLSL, fixo as fixoRede, REDE } from './rede-onda.js';
import { cameraNoLadoDeCa } from './torcida-dados.js';
import { LUZ_FALSA_GLSL, UNIFORMS_LUZ } from './luz-falsa.js';

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

function criarGols(aniso) {
  const g = CAMPO.gol;
  const R = g.raioPoste;
  const zp = g.largura / 2 + R;          // centro do poste (igual a bola.js)
  const yt = g.altura + R;               // centro do travessão
  const geos = [], cores = [];
  const branco = new THREE.Color(0xf7f9f8), cinza = new THREE.Color(0x8b9396), preto = new THREE.Color(0x1a1d1e);
  for (const s of [-1, 1]) {
    const x = s * MX;
    const xf = s * (MX + g.profundidade);
    for (const t of [-1, 1]) {
      geos.push(cilindroEntre([x, 0, t * zp], [x, yt + R, t * zp], R, 16)); cores.push(branco);
      // estrutura de trás (fina, cinza)
      geos.push(cilindroEntre([xf, 0, t * g.largura / 2], [xf, g.altura, t * g.largura / 2], 0.03, 8)); cores.push(cinza);
      geos.push(cilindroEntre([x + s * R, g.altura, t * g.largura / 2], [xf, g.altura, t * g.largura / 2], 0.025, 8)); cores.push(cinza);
      geos.push(cilindroEntre([x + s * R, 0.02, t * g.largura / 2], [xf, 0.02, t * g.largura / 2], 0.022, 6)); cores.push(cinza);
      // mastro da bandeirinha
      geos.push(cilindroEntre([x, 0, t * MZ], [x, 1.55, t * MZ], 0.018, 8)); cores.push(branco);
      geos.push(cilindroEntre([x, 1.55, t * MZ], [x, 1.57, t * MZ], 0.022, 8)); cores.push(preto);
    }
    geos.push(cilindroEntre([x, yt, -zp - R], [x, yt, zp + R], R, 16)); cores.push(branco);
    geos.push(cilindroEntre([xf, g.altura, -g.largura / 2], [xf, g.altura, g.largura / 2], 0.03, 8)); cores.push(cinza);
    geos.push(cilindroEntre([xf, 0.02, -g.largura / 2], [xf, 0.02, g.largura / 2], 0.022, 6)); cores.push(cinza);
  }
  const estrutura = new THREE.Mesh(juntarGeometrias(geos, cores), new THREE.MeshLambertMaterial({ vertexColors: true }));
  estrutura.name = 'gols';
  const rede = criarRede(aniso);
  return { estrutura, rede: rede.mesh, uniformsRede: rede.uniforms };
}

/**
 * Rede dos dois gols: os 8 panos (fundo, teto e laterais de cada gol; a caixa igual à da física da bola)
 * numa malha subdividida a ~15 cm com dois atributos por vértice — o pano (0–7, a numeração de
 * rede-onda.js) e a fixação (0 na armação, 1 no meio: rede-onda.js fixo). O vertex shader empurra o
 * vértice pela normal do pano (para fora do gol) com redeDesloc (REDE_GLSL). A textura é a mesma de antes
 * (losango de 14 cm na mesma escala de UV).
 */
function criarRede(aniso) {
  const g = CAMPO.gol;
  const CEL = 0.14;   // tamanho do losango da rede (m)
  const PASSO_MALHA = 0.15;
  const pos = [], nrm = [], uv = [], plano = [], fixa = [], idx = [];
  // pano: canto p0 e eixos (ea ao longo de u, eb ao longo de v), tamanhos ul × vl; n = normal do desenho
  // (a de antes, virada para dentro do gol: a luz fica igual)
  function pano(i, p0, ea, eb, ul, vl, n) {
    const na = Math.max(1, Math.round(ul / PASSO_MALHA)), nb = Math.max(1, Math.round(vl / PASSO_MALHA));
    const base = pos.length / 3;
    for (let b = 0; b <= nb; b++) {
      for (let a = 0; a <= na; a++) {
        const fu = a / na * ul, fv = b / nb * vl;
        const x = p0[0] + ea[0] * fu + eb[0] * fv, y = p0[1] + ea[1] * fu + eb[1] * fv, z = p0[2] + ea[2] * fu + eb[2] * fv;
        pos.push(x, y, z); nrm.push(...n); uv.push(fu / CEL, fv / CEL);
        plano.push(i); fixa.push(fixoRede(i, x, y, z));
      }
    }
    for (let b = 0; b < nb; b++) {
      for (let a = 0; a < na; a++) {
        const k = base + b * (na + 1) + a;
        idx.push(k, k + 1, k + na + 2, k, k + na + 2, k + na + 1);
      }
    }
  }
  const zl = g.largura / 2, ya = g.altura;
  for (const s of [-1, 1]) {
    const x = s * MX, xf = s * (MX + g.profundidade), base = s > 0 ? 4 : 0;
    pano(base + 0, [xf, 0, -zl], [0, 0, 1], [0, 1, 0], g.largura, ya, [-s, 0, 0]);
    pano(base + 1, [x, ya, -zl], [0, 0, 1], [s, 0, 0], g.largura, g.profundidade, [0, -1, 0]);
    for (const t of [-1, 1]) pano(base + (t < 0 ? 2 : 3), [x, 0, t * zl], [s, 0, 0], [0, 1, 0], g.profundidade, ya, [0, 0, -t]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aPlano', new THREE.Float32BufferAttribute(plano, 1));
  geo.setAttribute('aFixo', new THREE.Float32BufferAttribute(fixa, 1));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  // a bolsa sai até ~0,6 m da caixa: a esfera de corte cresce junto
  geo.boundingSphere.radius += REDE.ampMax + 0.2;
  const mat = new THREE.MeshLambertMaterial({
    map: texRede(aniso), transparent: true, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.02, color: 0xeef2f0,
  });
  const uniforms = { uRedeA: { value: new Float32Array(4 * REDE.maxImpactos) }, uRedeB: { value: new Float32Array(4 * REDE.maxImpactos).fill(-1) } };
  mat.onBeforeCompile = sh => {
    sh.uniforms.uRedeA = uniforms.uRedeA;
    sh.uniforms.uRedeB = uniforms.uRedeB;
    // deslocamento pela normal do pano E a normal refeita pela inclinação da bolsa (diferença finita a 10 cm
    // nos dois eixos do pano): a luz muda na dobra e o balanço aparece de qualquer ângulo — antes só o
    // escurecimento mostrava a bolsa e, na câmera de TV, ela mexia 2,5% dos pixels do gol (contraprova I2).
    // Superfície p + n·d(p): normal ∝ n − ∇d; o atributo normal aponta para DENTRO (−n), então fica normal + ∇d.
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aPlano;\nattribute float aFixo;\nvarying float vRedeD;' + REDE_GLSL)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        float redeD = 0.0;
        if (aFixo > 0.0) {
          redeD = redeDesloc(position, aPlano) * redeFixo(position, aPlano);
          if (redeD != 0.0) {
            vec3 nP = redeNormal(aPlano);
            vec3 ta = abs(nP.x) > 0.5 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
            vec3 tb = cross(nP, ta);
            vec3 pa = position + ta * 0.1;
            vec3 pb = position + tb * 0.1;
            float da = redeDesloc(pa, aPlano) * redeFixo(pa, aPlano);
            float db = redeDesloc(pb, aPlano) * redeFixo(pb, aPlano);
            objectNormal = normalize(objectNormal + (ta * (da - redeD) + tb * (db - redeD)) * 10.0);
          }
        }
        vRedeD = redeD;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed += redeNormal(aPlano) * redeD;`);
    // a bolsa escurece um pouco (a malha esticada e a sombra da dobra)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vRedeD;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        diffuseColor.rgb *= 1.0 - 0.45 * clamp(abs(vRedeD) * 2.2, 0.0, 1.0);`);
  };
  mat.customProgramCacheKey = () => 'rede-onda';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'rede';
  mesh.renderOrder = 2;
  return { mesh, uniforms };
}

// ------------------------------------------------------------------ bandeirinhas

function criarBandeiras() {
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
  const mat = new THREE.MeshLambertMaterial({ map: texBandeira(), side: THREE.DoubleSide });
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

function criarPlacas(aniso) {
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
  const mat = new THREE.MeshBasicMaterial({ map: texPlacas(aniso), color: 0xdddddd, fog: false });
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
 * Luz FALSA dos sinalizadores no concreto e nas cadeiras (luz-falsa.js: uniform vec4[8], nunca PointLight — uma luz de
 * verdade recompilaria todos os materiais do three.js no meio do gol). Sem sinalizador aceso, a conta nem roda.
 */
function comLuzFalsa(mat, chave) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uFlare = UNIFORMS_LUZ.uFlare;
    sh.uniforms.uFlareN = UNIFORMS_LUZ.uFlareN;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMundoFlare;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvMundoFlare = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMundoFlare;' + LUZ_FALSA_GLSL)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * luzFalsa(vMundoFlare);');
  };
  mat.customProgramCacheKey = () => 'arq-luz-falsa-' + chave;
  return mat;
}

function criarArquibancada(aniso, qualidade) {
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
  // lado de lá (z negativo), de frente para a câmera de TV, com GOLAÇO nas cadeiras
  const L1 = construtor();
  {
    const z0 = -frenteZ, z1 = -fundoZ;
    L1.quad([-xA, 0, z0], [xA, 0, z0], [xA, yBase, z0], [-xA, yBase, z0], 0, 1, V_PAREDE, 1);
    L1.quad([-xA, yBase, z0], [xA, yBase, z0], [xA, yTopo, z1], [-xA, yTopo, z1], 0, 1, 0, vMax);
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
  const lado = L1.mesh(texArquibancada(aniso, true, larg), 'lado');
  // atrás dos gols (x±): do canto de lá (z −74,5) até o lado de cá (z +44,5)
  const L2 = construtor();
  for (const s of [-1, 1]) {
    const x0 = s * (MX + CAMPO.entorno + 4), x1 = s * (MX + CAMPO.entorno + 4 + 26);
    const za = s > 0 ? frenteZ : -fundoZ, zb = s > 0 ? -fundoZ : frenteZ;
    const yT = 17;
    const u1 = (frenteZ + fundoZ) / ARQ.comprimento;
    L2.quad([x0, 0, za], [x0, 0, zb], [x0, yBase, zb], [x0, yBase, za], 0, u1, V_PAREDE, 1);
    L2.quad([x0, yBase, za], [x0, yBase, zb], [x1, yT, zb], [x1, yT, za], 0, u1, 0, vMax * 0.82);
    L2.quad([x1, yT, za], [x1, yT, zb], [x1, yT + 5, zb], [x1, yT + 5, za], 0, u1, V_PAREDE, 1);
  }
  const texSemNome = texArquibancada(aniso, false, larg);
  const fundos = L2.mesh(texSemNome, 'fundos');
  lado.name = 'arquibancada-lado';
  fundos.name = 'arquibancada-fundos';
  const ca = criarLadoDeCa(construtor, texSemNome, { frenteZ, fundoZ, yBase, yTopo, xA, V_PAREDE, vMax });
  g.userData.materiais = [lado.material, fundos.material, ca.material];
  g.userData.ladoDeCa = ca;
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
  const { frenteZ: z0, fundoZ: z1, yBase, yTopo, xA, V_PAREDE, vMax } = A;
  const T = ESTADIO.tunel;
  const L = construtor(true);
  const ti = T.largura / 2, mt = ti + 0.4, ya = T.altura, ytt = T.altura + T.laje;
  const yS = z => yBase + (yTopo - yBase) * (z - z0) / (z1 - z0);
  const vS = z => vMax * (z - z0) / (z1 - z0);
  const zt = z0 + (ytt + 0.3 - yBase) * (z1 - z0) / (yTopo - yBase);   // o degrau passa do teto do túnel aqui
  const uX = x => (x + xA) / (2 * xA);
  // retalhos da textura das cadeiras: o concreto claro do corredor (célula da cadeira 0, no meio da fileira 17) e o
  // friso verde do parapeito (o topo da faixa de parede)
  const CU = [0.002, 0.006], CV = [0.484, 0.49], VERDE = [0.996, 0.999];
  // mureta da frente dos dois lados da boca
  L.quad([-xA, 0, z0], [-mt, 0, z0], [-mt, yBase, z0], [-xA, yBase, z0], uX(-xA), uX(-mt), V_PAREDE, 1);
  L.quad([mt, 0, z0], [xA, 0, z0], [xA, yBase, z0], [mt, yBase, z0], uX(mt), uX(xA), V_PAREDE, 1);
  // degraus: os dois lados inteiros; no meio, só de onde passam por cima do teto do túnel
  L.quad([-xA, yBase, z0], [-mt, yBase, z0], [-mt, yTopo, z1], [-xA, yTopo, z1], uX(-xA), uX(-mt), 0, vMax);
  L.quad([mt, yBase, z0], [xA, yBase, z0], [xA, yTopo, z1], [mt, yTopo, z1], uX(mt), uX(xA), 0, vMax);
  L.quad([-mt, yS(zt), zt], [mt, yS(zt), zt], [mt, yTopo, z1], [-mt, yTopo, z1], uX(-mt), uX(mt), vS(zt), vMax);
  // parede de trás e um teto curto
  L.quad([-xA, yTopo, z1], [xA, yTopo, z1], [xA, yTopo + 5, z1], [-xA, yTopo + 5, z1], 0, 1, V_PAREDE, 1);
  L.quad([-xA, yTopo + 5, z1], [xA, yTopo + 5, z1], [xA, yTopo + 5.6, z1 - 4.5], [-xA, yTopo + 5.6, z1 - 4.5], 0, 1, V_PAREDE, 1);
  for (const s of [-1, 1]) {
    const x = s * xA;
    L.tri([x, 0, z0], [x, yBase, z0], [x, yTopo + 5, z1], [0.5, V_PAREDE], [0.5, 1], [0.6, 1]);
    L.tri([x, 0, z0], [x, yTopo + 5, z1], [x, 0, z1], [0.5, V_PAREDE], [0.6, 1], [0.6, V_PAREDE]);
  }
  // a boca do túnel saliente entre os degraus: o teto (laje) e as paredes de fora em concreto, a moldura verde
  L.quad([-mt, ytt, z0], [mt, ytt, z0], [mt, ytt, zt], [-mt, ytt, zt], CU[0], CU[1], CV[0], CV[1], 1);
  for (const s of [-1, 1]) {
    const x = s * mt;
    L.quad([x, yBase, z0], [x, ytt, z0], [x, ytt, zt], [x, yS(zt), zt], CU[0], CU[1], CV[0], CV[1], 0.9);
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

/** Monta o campo inteiro. opc: {qualidade, aniso}. Devolve {grupo, definirHora(h), atualizar(t)}. */
export function criarCampo(opc) {
  const aniso = opc.aniso ?? 4;
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
  const gols = criarGols(aniso);
  grupo.add(gols.estrutura, gols.rede);
  // rede que balança: main.js escreve os impactos (rede-onda.js uniformsRede) nestes vetores
  const uRede = gols.uniformsRede;
  const band = criarBandeiras();
  grupo.add(band.mesh);
  const placas = criarPlacas(aniso);
  grupo.add(placas.frente, placas.corpo);
  const arq = criarArquibancada(aniso, opc.qualidade);
  grupo.add(arq);
  const refl = criarRefletores();
  grupo.add(refl.grupo);
  const ladoDeCa = arq.userData.ladoDeCa;
  const _frustum = new THREE.Frustum(), _mat = new THREE.Matrix4();
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
      placas.mat.color.setHex(noite ? 0xffffff : 0xd4d4d4);
      refl.matLamp.color.setHex(noite ? 0xf4f8ff : 0x3a4044);
      for (const b of refl.brilhos) b.visible = noite;
    },
    /** t: s; camera (opcional): o lado de cá só vai para a GPU com a câmera fora dele e a caixa no quadro. */
    atualizar(t, camera = null) {
      band.tempo.value = t;
      if (camera) {
        camera.updateMatrixWorld();
        _frustum.setFromProjectionMatrix(_mat.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
        const cx = ladoDeCa.userData.caixas;
        const ver = !cameraNoLadoDeCa(camera.position) && cx.some(c => _frustum.intersectsBox(c));
        if (restaurar) { restaurar = false; ladoDeCa.geometry.setDrawRange(0, Infinity); }
        if (precarga && !ver) { ladoDeCa.visible = true; ladoDeCa.geometry.setDrawRange(0, 0); restaurar = true; } else ladoDeCa.visible = ver;
        precarga = false;
      }
    },
    /** A arquibancada do lado de cá (testes: visível ou não neste quadro). */
    get ladoDeCa() { return ladoDeCa; },
  };
}
