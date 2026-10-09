// Campo oficial (IFAB Lei 1, medidas em CAMPO): gramado com faixas de corte, linhas finas
// com antisserrilhado analítico (um único mesh), gols com rede, bandeirinhas, placas com marcas
// FICTÍCIAS e arquibancada simples. Poucos draw calls: tudo o que é estático vira um mesh só
// por material.
import * as THREE from 'three';
import { CAMPO } from '../config.js';
import { juntarGeometrias, cilindroEntre, caixa } from './util.js';
import {
  GRAMA, texGramado, texDetalheGrama, texRede, texPlacas, PLACA, texArquibancada, ARQ, texBandeira, texBrilho,
} from './texturas.js';

const MX = CAMPO.meioX, MZ = CAMPO.meioZ;
const L = CAMPO.linha, h = L / 2;
// meia-largura da GEOMETRIA da linha (a linha pintada tem h = 6 cm; o resto é margem para o
// antisserrilhado quando a linha fica com menos de 1 px na tela — "phone-wire AA", Humus)
const HG = 0.45;

// ------------------------------------------------------------------ material da grama

/** Injeta o grão (textura de detalhe em coordenadas do mundo, duas escalas) num material. */
function comDetalhe(mat, detalhe, forca) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uDetalhe = { value: detalhe };
    sh.uniforms.uForca = { value: forca };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vMundoXZ;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvMundoXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uDetalhe;\nuniform float uForca;\nvarying vec2 vMundoXZ;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          float d1 = texture2D(uDetalhe, vMundoXZ * 0.55).r;
          float d2 = texture2D(uDetalhe, vMundoXZ * 0.137 + 0.31).r;
          float d = d1 * d2 * 4.0;
          diffuseColor.rgb *= mix(1.0, d, uForca);
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
  const meiaGol = CAMPO.gol.largura / 2;
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
    void meiaGol;
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
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aCruz;\nvarying float vCruz;\nvarying vec2 vMundoXZ;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvCruz = aCruz;\nvMundoXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uMeia;\nuniform sampler2D uDetalhe;\nvarying float vCruz;\nvarying vec2 vMundoXZ;')
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
  const redeGeo = { pos: [], nrm: [], uv: [] };
  const CEL = 0.14; // tamanho do losango da rede (m)
  function plano(p0, p1, p2, p3, n, ul, vl) {
    const o = redeGeo;
    const i = o.pos.length / 3;
    o.pos.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3);
    for (let k = 0; k < 6; k++) o.nrm.push(...n);
    const u = ul / CEL, v = vl / CEL;
    o.uv.push(0, 0, u, 0, u, v, 0, 0, u, v, 0, v);
    void i;
  }
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
    // rede: fundo, teto e laterais (caixa igual à da física)
    const zl = g.largura / 2, ya = g.altura;
    plano([xf, 0, -zl], [xf, 0, zl], [xf, ya, zl], [xf, ya, -zl], [-s, 0, 0], g.largura, ya);
    plano([x, ya, -zl], [x, ya, zl], [xf, ya, zl], [xf, ya, -zl], [0, -1, 0], g.largura, g.profundidade);
    for (const t of [-1, 1]) {
      plano([x, 0, t * zl], [xf, 0, t * zl], [xf, ya, t * zl], [x, ya, t * zl], [0, 0, -t], g.profundidade, ya);
    }
  }
  const estrutura = new THREE.Mesh(juntarGeometrias(geos, cores), new THREE.MeshLambertMaterial({ vertexColors: true }));
  estrutura.name = 'gols';
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute(redeGeo.pos, 3));
  rg.setAttribute('normal', new THREE.Float32BufferAttribute(redeGeo.nrm, 3));
  rg.setAttribute('uv', new THREE.Float32BufferAttribute(redeGeo.uv, 2));
  rg.computeBoundingSphere();
  const rede = new THREE.Mesh(rg, new THREE.MeshLambertMaterial({
    map: texRede(aniso), transparent: true, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.02, color: 0xeef2f0,
  }));
  rede.name = 'rede';
  rede.renderOrder = 2;
  return { estrutura, rede };
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
  face(-PX, -PZ, PX, -PZ, 0, 1);
  face(PX, PZ, -PX, PZ, 0, -1);
  face(PX, -PZ, PX, PZ, -1, 0);
  face(-PX, PZ, -PX, -PZ, 1, 0);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.computeBoundingSphere();
  // LED: material sem luz (a placa brilha sozinha), mais forte à noite
  const mat = new THREE.MeshBasicMaterial({ map: texPlacas(aniso), color: 0xdddddd });
  const frente = new THREE.Mesh(geo, mat);
  frente.name = 'placas';
  const E = 0.12;
  const caixas = [
    caixa(0, A / 2, -PZ - E / 2, PX * 2 + E * 2, A, E), caixa(0, A + 0.02, -PZ - E / 2, PX * 2 + E * 2, 0.04, E + 0.02),
    caixa(0, A / 2, PZ + E / 2, PX * 2 + E * 2, A, E), caixa(0, A + 0.02, PZ + E / 2, PX * 2 + E * 2, 0.04, E + 0.02),
    caixa(PX + E / 2, A / 2, 0, E, A, PZ * 2), caixa(PX + E / 2, A + 0.02, 0, E + 0.02, 0.04, PZ * 2),
    caixa(-PX - E / 2, A / 2, 0, E, A, PZ * 2), caixa(-PX - E / 2, A + 0.02, 0, E + 0.02, 0.04, PZ * 2),
  ];
  const corpo = new THREE.Mesh(juntarGeometrias(caixas), new THREE.MeshLambertMaterial({ color: 0x0b0d0e }));
  corpo.name = 'placas-estrutura';
  return { frente, corpo, mat };
}

// ------------------------------------------------------------------ arquibancada e entorno

function criarArquibancada(aniso) {
  const V_PAREDE = 0.975, vMax = 1 - 24 / 512;
  function construtor() {
    const pos = [], uv = [], nrm = [];
    const a = new THREE.Vector3(), b = new THREE.Vector3(), n = new THREE.Vector3();
    function tri(p0, p1, p2, t0, t1, t2) {
      a.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
      b.set(p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]);
      n.crossVectors(a, b).normalize();
      pos.push(...p0, ...p1, ...p2);
      uv.push(...t0, ...t1, ...t2);
      for (let k = 0; k < 3; k++) nrm.push(n.x, n.y, n.z);
    }
    function quad(p0, p1, p2, p3, u0, u1, v0, v1) {
      tri(p0, p1, p2, [u0, v0], [u1, v0], [u1, v1]);
      tri(p0, p2, p3, [u0, v0], [u1, v1], [u0, v1]);
    }
    function mesh(tex) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
      geo.computeBoundingSphere();
      return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
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
  const lado = L1.mesh(texArquibancada(aniso, true));
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
  const fundos = L2.mesh(texArquibancada(aniso, false));
  lado.name = 'arquibancada-lado';
  fundos.name = 'arquibancada-fundos';
  const g = new THREE.Group();
  g.add(lado, fundos);
  return g;
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
  const fora = new THREE.Mesh(gf, new THREE.MeshLambertMaterial({ color: 0x1b2022 }));
  fora.name = 'chao-fora';
  grupo.add(fora);
  grupo.add(criarLinhas(detalhe));
  const gols = criarGols(aniso);
  grupo.add(gols.estrutura, gols.rede);
  const band = criarBandeiras();
  grupo.add(band.mesh);
  const placas = criarPlacas(aniso);
  grupo.add(placas.frente, placas.corpo);
  grupo.add(criarArquibancada(aniso));
  const refl = criarRefletores();
  grupo.add(refl.grupo);
  return {
    grupo,
    definirHora(hora) {
      const noite = hora === 'noite';
      placas.mat.color.setHex(noite ? 0xffffff : 0xd4d4d4);
      refl.matLamp.color.setHex(noite ? 0xf4f8ff : 0x3a4044);
      for (const b of refl.brilhos) b.visible = noite;
    },
    atualizar(t) { band.tempo.value = t; },
  };
}
