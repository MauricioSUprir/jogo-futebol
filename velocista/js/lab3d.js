// LABORATÓRIOS ESTRELA — o desenho (three.js passado por parâmetro). Interior e exterior a partir do plano de lab.js.
// Tudo é geometria própria juntada por material (poucas chamadas de desenho) + um punhado de peças animadas.
import { PAREDES, SALAS, CELAS, BALCAO, COLUNAS, CONSOLES, MESA_HOLO, TUBO, ANEIS_ACEL, TORRES_ENERGIA, PLATAFORMA_ESTEIRA, ANEL_TELHADO, DOME, TELHADO_COISAS, FRENTE, LAJES, H, TOPO, PISO, PORTA_Y, CAMPUS, TORRE, ALAS, PASSARELAS, ANEL_PRACA, MONUMENTO, ANEXO_PAREDES, CORREDORES, CORREDOR, NUCLEO, ALA_TETO } from './lab.js';
import { criarTexturas, retanguloRotulo, ESTEIRA } from './lab-tex.js';

const PI = Math.PI;

// Névoa mais fraca para o que é alto e tem de ser visto de longe na cidade (a torre do S.T.A.R. Labs e o anel dela):
// a mesma névoa da cena, só que começando 3× mais longe e terminando 9× mais longe, e nunca tampando mais que 80%.
// A silhueta de longe (construirSilhueta) usa a MESMA conta (nevoaDe), então a troca de uma pela outra não salta.
export const nevoaDe = (d, perto, longe) => Math.min(0.8, Math.max(0, (d - perto * 3) / (longe * 9 - perto * 3)));
function nevoaLonge(m) {
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <fog_fragment>', `#ifdef USE_FOG
  float fogFactor = clamp((vFogDepth - fogNear * 3.0) / (fogFar * 9.0 - fogNear * 3.0), 0.0, 0.8);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
#endif`);
  };
  m.customProgramCacheKey = () => 'nevoaLonge';
  return m;
}

export function construirLab(THREE, cx, cz, opc = {}) {
  const aniso = opc.aniso ?? 4;
  const grupo = new THREE.Group(); grupo.position.set(cx, 0, cz); grupo.name = 'laboratorios-estrela';
  const cupula = new THREE.Group(); cupula.name = 'cupula'; grupo.add(cupula);
  const alto = new THREE.Group(); alto.name = 'torre'; grupo.add(alto);         // a torre (some quando a silhueta de longe assume)
  const geos = [], materiais = [];
  const TX = criarTexturas(THREE, aniso); const T = TX.T;
  materiais.push(...TX.texturas);

  // ------------------------------------------------------------------ materiais
  const mat = {}; const interiores = [];
  const std = (k, o, interior = false) => { const m = new THREE.MeshStandardMaterial(o); mat[k] = m; materiais.push(m); if (interior) interiores.push(m); return m; };
  const bas = (k, o) => { const m = new THREE.MeshBasicMaterial(o); mat[k] = m; materiais.push(m); return m; };
  const ei = (map) => ({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0 });
  // por fora: azul-marinho FOSCO (quase sem reflexo) e poucas luzes, discretas
  std('ext', { map: T.fachada, roughness: 0.9, metalness: 0.02 });
  std('extJan', { map: T.janelas, emissive: 0xffd6a0, emissiveMap: T.janelasLuz, emissiveIntensity: 0, roughness: 0.82, metalness: 0.04 });
  nevoaLonge(std('torreJan', { map: T.janelas, emissive: 0xffd6a0, emissiveMap: T.janelasLuz, emissiveIntensity: 0, roughness: 0.82, metalness: 0.04 }));
  nevoaLonge(std('torreExt', { map: T.fachada, roughness: 0.9, metalness: 0.02 }));
  nevoaLonge(std('torreAco', { color: 0x2a3446, roughness: 0.6, metalness: 0.5 }));
  nevoaLonge(bas('torreFaixa', { color: 0x6f90bd }));                       // (também as faixas de perto: uma chamada só)
  nevoaLonge(bas('torreLetreiro', { map: T.letreiro }));
  std('int', { ...ei(T.parede), roughness: 0.85 }, true);
  std('aco', { color: 0xaab4bd, roughness: 0.32, metalness: 0.85 });
  std('acoEsc', { color: 0x30373f, roughness: 0.45, metalness: 0.7 });
  std('mov', { color: 0xc9d5e6, roughness: 0.5, emissive: 0xc9d5e6, emissiveIntensity: 0 }, true);
  std('traje', { color: 0xb3121f, roughness: 0.55, metalness: 0.15, emissive: 0x3a0306, emissiveIntensity: 1 });      // os trajes das vitrines
  std('verde', { color: 0x2f7d46, roughness: 0.85 });
  std('tronco', { color: 0x5a4330, roughness: 0.95 });
  std('telhado', { map: T.telhado, roughness: 0.95 });
  std('pav', { map: T.pav, roughness: 0.9 });
  std('pisoAtrio', { ...ei(T.pisoAtrio), roughness: 0.28, metalness: 0.15 }, true);
  std('pisoCortex', { ...ei(T.pisoCortex), roughness: 0.25, metalness: 0.4 }, true);
  std('pisoCont', { ...ei(T.pisoCont), roughness: 0.4 }, true);
  std('pisoEsteira', { ...ei(T.pisoEsteira), roughness: 0.35 }, true);
  std('pisoAcel', { ...ei(T.pisoAcel), roughness: 0.6, metalness: 0.5 }, true);
  std('perigo', { ...ei(T.perigo), roughness: 0.7 }, true);
  std('correia', { map: T.correia, roughness: 0.8 });
  bas('teto', { map: T.teto, color: 0xe6edf6 });
  std('vidro', { color: 0x3a5f88, transparent: true, opacity: 0.5, roughness: 0.1, metalness: 0.35, side: THREE.DoubleSide, depthWrite: false });   // um vidro só, azul-marinho translúcido
  std('vidroCela', { color: 0x66e0ff, transparent: true, opacity: 0.2, roughness: 0.05, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false });
  std('cupulaVidro', { color: 0x8cc8ff, transparent: true, opacity: 0.2, roughness: 0.05, metalness: 0.25, side: THREE.DoubleSide, depthWrite: false });
  bas('luz', { color: 0xeaf6ff });
  bas('ciano', { color: 0x3fe0ff });
  bas('cianoPulso', { color: 0x3fe0ff });
  bas('portaCela', { color: 0x3fe0ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  bas('letreiro', { map: T.letreiro });
  bas('logoL', { map: T.logoL, transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  bas('atlas', { map: T.atlas });
  for (const k of Object.keys(TX.telas)) bas(`tela_${k}`, { map: TX.telas[k].t });

  // ------------------------------------------------------------------ baldes de geometria (um por material)
  const B = {};
  const bk = (k) => { if (!mat[k]) throw new Error(`material ausente: ${k}`); return B[k] || (B[k] = { p: [], n: [], u: [], i: [] }); };
  function quad(k, o, du, dv, w, h, tu = 4, tv = tu, rect = null) {
    const b = bk(k), base = b.p.length / 3;
    const nx = du[1] * dv[2] - du[2] * dv[1], ny = du[2] * dv[0] - du[0] * dv[2], nz = du[0] * dv[1] - du[1] * dv[0];
    const P = [o, [o[0] + du[0] * w, o[1] + du[1] * w, o[2] + du[2] * w], null, [o[0] + dv[0] * h, o[1] + dv[1] * h, o[2] + dv[2] * h]];
    P[2] = [P[1][0] + dv[0] * h, P[1][1] + dv[1] * h, P[1][2] + dv[2] * h];
    const UV = rect ? [[rect[0], rect[2]], [rect[1], rect[2]], [rect[1], rect[3]], [rect[0], rect[3]]]
      : P.map((q) => [(q[0] * du[0] + q[1] * du[1] + q[2] * du[2]) / tu, (q[0] * dv[0] + q[1] * dv[1] + q[2] * dv[2]) / tv]);
    for (let i = 0; i < 4; i++) { b.p.push(P[i][0], P[i][1], P[i][2]); b.n.push(nx, ny, nz); b.u.push(UV[i][0], UV[i][1]); }
    b.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  function box(keys, x0, x1, y0, y1, z0, z1, tile = 4) {
    const K = Array.isArray(keys) ? keys : [keys, keys, keys, keys, keys, keys];
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    if (K[0]) quad(K[0], [x1, y0, z1], [0, 0, -1], [0, 1, 0], dz, dy, tile);
    if (K[1]) quad(K[1], [x0, y0, z0], [0, 0, 1], [0, 1, 0], dz, dy, tile);
    if (K[2]) quad(K[2], [x0, y1, z1], [1, 0, 0], [0, 0, -1], dx, dz, tile);
    if (K[3]) quad(K[3], [x0, y0, z0], [1, 0, 0], [0, 0, 1], dx, dz, tile);
    if (K[4]) quad(K[4], [x0, y0, z1], [1, 0, 0], [0, 1, 0], dx, dy, tile);
    if (K[5]) quad(K[5], [x1, y0, z0], [-1, 0, 0], [0, 1, 0], dx, dy, tile);
  }
  const qm = new THREE.Matrix4(), qq = new THREE.Quaternion(), qe = new THREE.Euler(), qv = new THREE.Vector3(), qs = new THREE.Vector3(), qn = new THREE.Matrix3(), tv3 = new THREE.Vector3();
  function prim(k, geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const b = bk(k), base = b.p.length / 3;
    qe.set(rx, ry, rz, 'XYZ'); qq.setFromEuler(qe); qv.set(x, y, z); qs.set(sx, sy, sz); qm.compose(qv, qq, qs); qn.getNormalMatrix(qm);
    const pa = geo.attributes.position, na = geo.attributes.normal, ua = geo.attributes.uv;
    for (let i = 0; i < pa.count; i++) {
      tv3.fromBufferAttribute(pa, i).applyMatrix4(qm); b.p.push(tv3.x, tv3.y, tv3.z);
      tv3.fromBufferAttribute(na, i).applyMatrix3(qn).normalize(); b.n.push(tv3.x, tv3.y, tv3.z);
      b.u.push(ua ? ua.getX(i) : 0, ua ? ua.getY(i) : 0);
    }
    if (geo.index) for (let i = 0; i < geo.index.count; i++) b.i.push(base + geo.index.getX(i)); else for (let i = 0; i < pa.count; i++) b.i.push(base + i);
    geo.dispose();
  }
  const G = THREE;
  const cil = (k, x, y, z, r, h, rx = 0, ry = 0, rz = 0, seg = 16, r2 = r) => prim(k, new G.CylinderGeometry(r2, r, h, seg), x, y, z, rx, ry, rz);
  const toro = (k, x, y, z, R, tubo, rx, ry, rz, seg = 20, arc = 48, ang = PI * 2) => prim(k, new G.TorusGeometry(R, tubo, seg, arc, ang), x, y, z, rx, ry, rz);
  const esf = (k, x, y, z, r, sx = 1, sy = 1, sz = 1, det = 1) => prim(k, new G.IcosahedronGeometry(r, det), x, y, z, 0, 0, 0, sx, sy, sz);
  // faces voltadas para fora: normal +z / -z / +x / -x
  const faceZ = (k, u0, u1, y0, y1, v, dir, tile = 4, rect = null) => dir > 0 ? quad(k, [u0, y0, v], [1, 0, 0], [0, 1, 0], u1 - u0, y1 - y0, tile, tile, rect) : quad(k, [u1, y0, v], [-1, 0, 0], [0, 1, 0], u1 - u0, y1 - y0, tile, tile, rect);
  const faceX = (k, v0, v1, y0, y1, u, dir, tile = 4, rect = null) => dir > 0 ? quad(k, [u, y0, v1], [0, 0, -1], [0, 1, 0], v1 - v0, y1 - y0, tile, tile, rect) : quad(k, [u, y0, v0], [0, 0, 1], [0, 1, 0], v1 - v0, y1 - y0, tile, tile, rect);
  // uma face de fachada com o vão de uma porta [s0, s1] até a altura yv (os três pedaços em volta, com a mesma UV)
  const faceXVao = (k, v0, v1, y0, y1, u, dir, tile, vao) => { if (!vao) return faceX(k, v0, v1, y0, y1, u, dir, tile); const [s0, s1, yv] = vao; faceX(k, v0, s0, y0, y1, u, dir, tile); faceX(k, s1, v1, y0, y1, u, dir, tile); faceX(k, s0, s1, yv, y1, u, dir, tile); };
  const faceZVao = (k, u0, u1, y0, y1, v, dir, tile, vao) => { if (!vao) return faceZ(k, u0, u1, y0, y1, v, dir, tile); const [s0, s1, yv] = vao; faceZ(k, u0, s0, y0, y1, v, dir, tile); faceZ(k, s1, u1, y0, y1, v, dir, tile); faceZ(k, s0, s1, yv, y1, v, dir, tile); };
  const piso = (k, u0, u1, v0, v1, y, tile = 4, rect = null) => quad(k, [u0, y, v1], [1, 0, 0], [0, 0, -1], u1 - u0, v1 - v0, tile, tile, rect);
  const teto = (k, u0, u1, v0, v1, y, tile = 8) => quad(k, [u0, y, v0], [1, 0, 0], [0, 0, 1], u1 - u0, v1 - v0, tile, tile);
  const placa = (nome, centro, y, v, dir, w = 3.6, h = 1.8, eixo = 'z') => {
    const rect = retanguloRotulo(nome);
    if (eixo === 'z') faceZ('atlas', centro - w / 2, centro + w / 2, y, y + h, v, dir, 1, rect); else faceX('atlas', centro - w / 2, centro + w / 2, y, y + h, v, dir, 1, rect);
  };
  let sem = 5; const rnd = () => { sem = (sem * 1664525 + 1013904223) >>> 0; return sem / 4294967296; };
  const F0 = PISO + 0.04;   // piso interno por cima da laje do quarteirão

  // ------------------------------------------------------------------ paredes
  const ROTULO = {
    frente: { pos: { '-4,4': 'SAÍDA' } },
    atrio: { neg: { '-24,-16': 'ESTEIRA DE VELOCIDADE', '-3,3': 'CORTEX', '17,23': 'CONTENÇÃO' }, pos: { '-24,-16': 'RECEPÇÃO', '-3,3': 'RECEPÇÃO', '17,23': 'RECEPÇÃO' } },
    norte: { neg: { '-24,-16': 'ACELERADOR', '-3,3': 'ACELERADOR', '17,23': 'ACELERADOR' }, pos: { '-24,-16': 'ESTEIRA DE VELOCIDADE', '-3,3': 'CORTEX', '17,23': 'CONTENÇÃO' } },
    cortexO: { neg: { '-3,3': 'CORTEX' }, pos: { '-3,3': 'ESTEIRA DE VELOCIDADE' } },
    cortexL: { neg: { '-3,3': 'CONTENÇÃO' }, pos: { '-3,3': 'CORTEX' } },
    fundo: { neg: { '-3,3': 'NÚCLEO AURORA' } },
    oeste: { pos: { '-3,3': 'ALA OESTE' } },
    leste: { neg: { '-3,3': 'ALA LESTE' } },
    toFrente: { pos: { '-3,3': 'ACELERADOR' } },
    aoDentro: { neg: { '-3,3': 'ESTEIRA DE VELOCIDADE' } },
    alDentro: { pos: { '-3,3': 'CONTENÇÃO' } },
    aoSul: { neg: { '-52,-46': 'ALA OESTE' }, pos: { '-52,-46': 'ALA MÉDICA' } },
    aoNorte: { neg: { '-52,-46': 'OFICINA' }, pos: { '-52,-46': 'ALA OESTE' } },
    alSul: { neg: { '46,52': 'ALA LESTE' }, pos: { '46,52': 'SALA DOS TRAJES' } },
    alNorte: { neg: { '46,52': 'SALA DA FENDA' }, pos: { '46,52': 'ALA LESTE' } },
  };
  for (const p of [...PAREDES, ...ANEXO_PAREDES]) {
    const t = p.t, c0 = p.c - t / 2, c1 = p.c + t / 2;
    const ext = p.ext, topo = p.y1 ?? H;
    const keys = (extra) => {
      const K = ['int', 'int', 'ext', 'int', 'int', 'int'];
      if (ext) { const idx = p.eixo === 'x' ? (ext < 0 ? 5 : 4) : (ext < 0 ? 1 : 0); K[idx] = p.fachada ? null : 'ext'; }
      if (p.fachada) K[2] = null;
      return K;
    };
    const K = keys();
    const bw = (s0, s1, y0, y1) => { if (s1 - s0 < 1e-4 || y1 - y0 < 1e-4) return; if (p.eixo === 'x') box(K, s0, s1, y0, y1, c0, c1, 8); else box(K, c0, c1, y0, y1, s0, s1, 8); };
    const vaos = p.vaos.slice().sort((a, b) => a[0] - b[0]);
    const solidos = []; let cur = p.a; for (const [s0, s1] of vaos) { solidos.push([cur, s0]); cur = s1; } solidos.push([cur, p.b]);
    const rodape = (s0, s1) => {
      const faces = ext ? [-ext] : [-1, 1];
      for (const f of faces) {
        const o = f > 0 ? c1 : c0, o2 = f > 0 ? c1 + 0.05 : c0 - 0.05;
        if (p.eixo === 'x') { box('acoEsc', s0, s1, PISO, PISO + 0.16, Math.min(o, o2), Math.max(o, o2)); box('ciano', s0, s1, PISO + 0.16, PISO + 0.2, Math.min(o, o2), Math.max(o, o2)); }
        else { box('acoEsc', Math.min(o, o2), Math.max(o, o2), PISO, PISO + 0.16, s0, s1); box('ciano', Math.min(o, o2), Math.max(o, o2), PISO + 0.16, PISO + 0.2, s0, s1); }
      }
    };
    for (const [s0, s1] of solidos) {
      let cursor = s0;
      for (const [j0, j1] of p.janelas) {
        const a = Math.max(s0, j0), b = Math.min(s1, j1); if (b - a < 0.5) continue;
        bw(cursor, a, PISO, topo); rodape(cursor, a);
        bw(a, b, PISO, p.jy[0]); bw(a, b, p.jy[1], topo);
        // vidro + montantes de aço
        const vm = (c0 + c1) / 2, vd = 'vidro', mo = ext ? 'acoEsc' : 'aco';
        if (p.eixo === 'x') quad(vd, [a, p.jy[0], vm], [1, 0, 0], [0, 1, 0], b - a, p.jy[1] - p.jy[0], 4); else quad(vd, [vm, p.jy[0], a], [0, 0, 1], [0, 1, 0], b - a, p.jy[1] - p.jy[0], 4);
        const n = Math.max(1, Math.round((b - a) / 3.5));
        for (let k = 0; k <= n; k++) { const s = a + ((b - a) * k) / n; if (p.eixo === 'x') box(mo, s - 0.1, s + 0.1, p.jy[0], p.jy[1], c0 - 0.06, c1 + 0.06); else box(mo, c0 - 0.06, c1 + 0.06, p.jy[0], p.jy[1], s - 0.1, s + 0.1); }
        if (p.eixo === 'x') { box(mo, a, b, p.jy[0] - 0.12, p.jy[0], c0 - 0.1, c1 + 0.1); box(mo, a, b, p.jy[1], p.jy[1] + 0.12, c0 - 0.1, c1 + 0.1); }
        else { box(mo, c0 - 0.1, c1 + 0.1, p.jy[0] - 0.12, p.jy[0], a, b); box(mo, c0 - 0.1, c1 + 0.1, p.jy[1], p.jy[1] + 0.12, a, b); }
        cursor = b;
      }
      bw(cursor, s1, PISO, topo); rodape(cursor, s1);
    }
    for (const [s0, s1] of vaos) {
      bw(s0, s1, PORTA_Y, topo);
      // soleira de aço na espessura da parede (sem ela, aparecia o chão da praça entre um piso e outro)
      if (p.eixo === 'x') piso('acoEsc', s0, s1, c0 - 0.06, c1 + 0.06, F0 + 0.035, 1); else piso('acoEsc', c0 - 0.06, c1 + 0.06, s0, s1, F0 + 0.035, 1);
      const interno = !ext, aco = 'acoEsc';
      if (p.eixo === 'x') {
        for (const s of [s0 - 0.28, s1]) box(aco, s, s + 0.28, PISO, PORTA_Y, c0 - 0.08, c1 + 0.08);
        box(aco, s0 - 0.28, s1 + 0.28, PORTA_Y - 0.4, PORTA_Y, c0 - 0.08, c1 + 0.08); box('ciano', s0, s1, PORTA_Y - 0.46, PORTA_Y - 0.4, c0 + 0.05, c1 - 0.05);
      } else {
        for (const s of [s0 - 0.28, s1]) box(aco, c0 - 0.08, c1 + 0.08, PISO, PORTA_Y, s, s + 0.28);
        box(aco, c0 - 0.08, c1 + 0.08, PORTA_Y - 0.4, PORTA_Y, s0 - 0.28, s1 + 0.28); box('ciano', c0 + 0.05, c1 - 0.05, PORTA_Y - 0.46, PORTA_Y - 0.4, s0, s1);
      }
      // placas sobre os vãos
      const R = ROTULO[p.id]; const ch = `${s0},${s1}`; const cen = (s0 + s1) / 2;
      if (R) for (const lado of ['neg', 'pos']) {
        const nome = R[lado] && R[lado][ch]; if (!nome) continue;
        const dir = lado === 'neg' ? -1 : 1, off = dir < 0 ? c0 - 0.03 : c1 + 0.03;
        if (ext && ((ext < 0 && dir < 0) || (ext > 0 && dir > 0))) continue;
        if (p.eixo === 'x') placa(nome, cen, 6.3, off, dir, 3.6, 1.8, 'z'); else placa(nome, cen, 6.3, off, dir, 3.6, 1.8, 'x');
      }
    }
  }

  // ------------------------------------------------------------------ pisos e tetos
  const A = SALAS.atrio, C = SALAS.cortex, CT = SALAS.contencao, E = SALAS.esteira, AC = SALAS.acelerador;
  piso('pisoAtrio', A.u[0], A.u[1], A.v[0], A.v[1], F0, 4);
  piso('pisoCortex', C.u[0], C.u[1], C.v[0], C.v[1], F0, 25, [0, 1, 0, 1]);
  piso('pisoCont', CT.u[0], CT.u[1], CT.v[0], CT.v[1], F0, 4);
  piso('pisoEsteira', E.u[0], E.u[1], E.v[0], E.v[1], F0, 25, [0, 1, 0, 1]);
  piso('pisoAcel', AC.u[0], AC.u[1], AC.v[0], AC.v[1], F0, 4);
  // faixas de perigo no corredor da Contenção e em volta do tubo
  for (const u of [17.0, 22.65]) piso('perigo', u, u + 0.35, CT.v[0], CT.v[1], F0 + 0.01, 1.4, null);
  for (const v of [TUBO.v - 2.0, TUBO.v + 1.65]) piso('perigo', TUBO.u0 - 0.5, TUBO.u1 + 0.5, v, v + 0.35, F0 + 0.01, 1.4, null);
  teto('teto', A.u[0], A.u[1], A.v[0], A.v[1], A.teto); teto('teto', CT.u[0], CT.u[1], CT.v[0], CT.v[1], CT.teto);
  teto('teto', E.u[0], E.u[1], E.v[0], E.v[1], E.teto); teto('teto', AC.u[0], AC.u[1], AC.v[0], AC.v[1], AC.teto);

  // ------------------------------------------------------------------ EXTERIOR do prédio principal
  const S = 27;
  // os andares de cima (H até TOPO): fachada com janelas em fita nas quatro faces; uma faixa fina marca a divisa
  faceZ('extJan', -S, S, H, TOPO, -S, -1, 8); faceZ('extJan', -S, S, H, TOPO, S, 1, 8);
  faceX('extJan', -S, S, H, TOPO, -S, -1, 8); faceX('extJan', -S, S, H, TOPO, S, 1, 8);
  box('torreFaixa', -S - 0.08, S + 0.08, H - 0.1, H + 0.1, -S - 0.08, -S); box('torreFaixa', -S - 0.08, S + 0.08, H - 0.1, H + 0.1, S, S + 0.08);
  box('torreFaixa', -S - 0.08, -S, H - 0.1, H + 0.1, -S, S); box('torreFaixa', S, S + 0.08, H - 0.1, H + 0.1, -S, S);
  for (const [u, v] of [[-S, -S], [S, -S], [-S, S], [S, S]]) box('ext', u - 0.9, u + 0.9, PISO, TOPO + 0.4, v - 0.9, v + 0.9);
  // aletas verticais ao longo da frente (até o alto do prédio)
  for (const u of [-22, -16, -10, 10, 16, 22]) box('acoEsc', u - 0.12, u + 0.12, PISO, TOPO - 0.5, -S - 0.4, -S);
  // LETREIRO grande no alto da frente; o emblema sobre a porta; logos nas laterais e no fundo
  box('acoEsc', -22.4, 22.4, 19.2, 25.6, -S - 0.28, -S - 0.02);
  faceZ('letreiro', -22, 22, 19.6, 25.1, -S - 0.3, -1, 1, [0, 1, 0, 1]);
  faceZ('logoL', -5, 5, 9.4, 15.4, -S - 0.05, -1, 1, [0, 1, 0, 1]);
  faceX('logoL', -8.3, 8.3, 18.6, 28.6, S + 0.05, 1, 1, [0, 1, 0, 1]); faceX('logoL', -8.3, 8.3, 18.6, 28.6, -S - 0.05, -1, 1, [0, 1, 0, 1]);
  faceZ('logoL', -8.3, 8.3, 18.6, 28.6, S + 0.05, 1, 1, [0, 1, 0, 1]);
  // marquise e guarita
  const M = FRENTE.marquise;
  box(['acoEsc', 'acoEsc', 'acoEsc', 'acoEsc', 'acoEsc', 'acoEsc'], M.u[0], M.u[1], M.y, M.y + 0.5, M.v1, M.v0);
  box('luz', M.u[0] + 0.4, M.u[1] - 0.4, M.y - 0.04, M.y, M.v1 + 0.4, M.v0 - 0.5);
  for (const u of [-7.4, 7.4]) box('acoEsc', u - 0.3, u + 0.3, 0, M.y, M.v1 + 0.3, M.v1 + 0.9);
  box('torreFaixa', M.u[0], M.u[1], M.y + 0.5, M.y + 0.6, M.v1, M.v1 + 0.1);
  placa('SAÍDA', 0, M.y - 1.15, M.v1 + 0.31, 1, 2.4, 1.2, 'z');
  { const g = FRENTE.guarita, y0 = PISO;
    box('acoEsc', g.u0, g.u1, y0, g.y1, g.v0, g.v1); box('vidro', g.u0 + 0.05, g.u1 - 0.05, y0 + 1.0, g.y1 - 0.2, g.v0 - 0.02, g.v1 + 0.02);
    box('acoEsc', g.u0 - 0.1, g.u1 + 0.1, g.y1, g.y1 + 0.15, g.v0 - 0.1, g.v1 + 0.1); }
  // canteiros, arbustos e árvores baixas junto do prédio
  for (const lado of [-1, 1]) for (let k = -24; k <= 24; k += 6) {
    if (k === 0) continue;                                          // a porta do corredor da ala
    const u = lado * 28.3, v = k; box('pav', u - 0.7, u + 0.7, PISO, 0.8, v - 1.6, v + 1.6); box('tronco', u - 0.62, u + 0.62, 0.8, 0.84, v - 1.52, v + 1.52);
    for (let s = -1; s <= 1; s++) esf(rnd() < 0.5 ? 'verde' : 'verde', u + (rnd() - 0.5) * 0.4, 1.1, v + s * 0.9, 0.55 + rnd() * 0.2, 1, 0.8, 1, 1);
  }
  for (const k of [-24, -16, -8, 8, 16, 24]) { box('pav', k - 1.4, k + 1.4, PISO, 0.8, 28.2 - 0.7, 28.2 + 0.7); for (let s = -1; s <= 1; s++) esf('verde', k + s * 1.0, 1.1, 28.2, 0.55 + rnd() * 0.15, 1, 0.8, 1, 1); }
  for (const [u, v] of [[-28.3, -28.3], [28.3, -28.3], [-28.3, 28.3], [28.3, 28.3]]) { cil('tronco', u, 1.6, v, 0.18, 2.6, 0, 0, 0, 8, 0.24); esf('verde', u, 3.6, v, 1.5, 1, 0.9, 1, 1); esf('verde', u + 0.6, 4.4, v - 0.3, 1.0, 1, 0.9, 1, 1); }
  for (const u of [-18, -12, 12, 18]) { box('pav', u - 1.1, u + 1.1, PISO, 0.8, -28.6 - 0.45, -28.6 + 0.45); esf('verde', u, 1.15, -28.6, 0.6, 1.4, 0.8, 0.9, 1); }

  // ------------------------------------------------------------------ O CAMPUS: praça, anel do acelerador, alas, passarelas, torre
  const CM = CAMPUS.meio;
  // praça (cobre as ruas que sumiram) e o meio-fio da borda; o caminho de entrada mais claro
  piso('pav', -CM, CM, -CM, -S, 0.33, 6); piso('pav', -CM, CM, S, CM, 0.33, 6); piso('pav', -CM, -S, -S, S, 0.33, 6); piso('pav', S, CM, -S, S, 0.33, 6);
  faceZ('pav', -CM, CM, 0, 0.33, -CM, -1, 2); faceZ('pav', -CM, CM, 0, 0.33, CM, 1, 2); faceX('pav', -CM, CM, 0, 0.33, -CM, -1, 2); faceX('pav', -CM, CM, 0, 0.33, CM, 1, 2);
  box('pav', -CM, CM, 0.33, 0.36, -CM, -CM + 0.5); box('pav', -CM, CM, 0.33, 0.36, CM - 0.5, CM); box('pav', -CM, -CM + 0.5, 0.33, 0.36, -CM, CM); box('pav', CM - 0.5, CM, 0.33, 0.36, -CM, CM);
  piso('pav', -4.5, 4.5, -CM, -S, 0.345, 3);
  for (const u of [-4.5, 4.5]) piso('torreFaixa', u - 0.08, u + 0.08, -CM, -S - 1, 0.35, 1);
  for (let v = -CM + 6; v < -S - 2; v += 9) for (const u of [-6.5, 6.5]) { cil('acoEsc', u, 2.2, v, 0.09, 4.2, 0, 0, 0, 8); box('acoEsc', u - 0.3, u + 0.3, 4.3, 4.45, v - 0.3, v + 0.3); box('luz', u - 0.22, u + 0.22, 4.25, 4.3, v - 0.22, v + 0.22); }
  // o acelerador de partículas enterrado: um sulco escuro com uma linha de luz fina, e as tampas de acesso
  { const A = ANEL_PRACA;
    // só os arcos que ficam na praça: por baixo da torre e das alas (agora ocas no térreo) o anel não aparece
    const sob = (u, v, m = 1.6) => ALAS.some((a) => u > a.u0 - m && u < a.u1 + m && v > a.v0 - m && v < a.v1 + m) || (u > TORRE.u0 - m && u < TORRE.u1 + m && v > TORRE.v0 - m && v < TORRE.v1 + m);
    const NS = 720, livre = []; for (let i = 0; i < NS; i++) { const t = (i / NS) * PI * 2; livre.push(!sob(A.R * Math.cos(t), A.R * Math.sin(t))); }
    const arcos = []; for (let i = 0; i < NS; i++) if (livre[i] && !livre[(i + NS - 1) % NS]) { let j = i; while (livre[(j + 1) % NS] && j - i < NS) j++; arcos.push([(i / NS) * PI * 2, ((j + 1) / NS) * PI * 2]); }
    // (a RingGeometry deitada por −90° em x desenha o ângulo t no lugar de −t: o arco [t0, t1] vira [−t1, −t0])
    for (const [t0, t1] of arcos) { const n = Math.max(4, Math.round(((t1 - t0) / (PI * 2)) * 160));
      prim('acoEsc', new G.RingGeometry(A.R - A.larg / 2, A.R + A.larg / 2, n, 1, -t1, t1 - t0), 0, 0.36, 0, -PI / 2);
      prim('torreFaixa', new G.RingGeometry(A.R - 0.14, A.R + 0.14, n, 1, -t1, t1 - t0), 0, 0.375, 0, -PI / 2); }
    for (let k = 0; k < 16; k++) { const a = (k / 16) * PI * 2 + PI / 16, x = A.R * Math.cos(a), z = A.R * Math.sin(a); if (sob(x, z, 2.2)) continue; prim('pav', new G.BoxGeometry(3.4, 0.1, 2.2), x, 0.38, z, 0, -a, 0); } }
  // árvores pela borda do campus (o caminho de entrada fica livre)
  for (let k = -CM + 5; k <= CM - 5; k += 9) for (const [u, v] of [[k, -CM + 3.5], [k, CM - 3.5], [-CM + 3.5, k], [CM - 3.5, k]]) {
    if (Math.abs(u) < 9 && v < 0) continue;
    if (ALAS.some((a) => u > a.u0 - 2 && u < a.u1 + 2 && v > a.v0 - 2 && v < a.v1 + 2) || (u > TORRE.u0 - 2 && u < TORRE.u1 + 2 && v > TORRE.v0 - 2 && v < TORRE.v1 + 2)) continue;
    const e = 0.85 + rnd() * 0.35;
    cil('tronco', u, 0.3 + 1.3 * e, v, 0.16 * e, 2.6 * e, 0, 0, 0, 7, 0.22 * e); esf(rnd() < 0.5 ? 'verde' : 'verde', u, 0.3 + 3.6 * e, v, 1.7 * e, 1, 0.9, 1, 1); esf('verde', u + 0.5, 0.3 + 4.5 * e, v - 0.3, 1.05 * e, 1, 0.9, 1, 1);
  }
  // o letreiro de pedra na entrada do campus
  { const m = MONUMENTO; box('pav', m.u0, m.u1, PISO, m.y1, m.v0, m.v1); box('acoEsc', m.u0 - 0.1, m.u1 + 0.1, m.y1, m.y1 + 0.15, m.v0 - 0.1, m.v1 + 0.1);
    const w = m.u1 - m.u0 - 1.2, h = w / 8; faceZ('letreiro', m.u0 + 0.6, m.u1 - 0.6, (PISO + m.y1) / 2 - h / 2, (PISO + m.y1) / 2 + h / 2, m.v0 - 0.02, -1, 1, [0, 1, 0, 1]); }
  // ALAS: dois prédios compridos dos lados, com janelas em fita, platibanda e o emblema na ponta da frente
  for (const a of ALAS) {
    faceZ('extJan', a.u0, a.u1, PISO, a.y1, a.v0, -1, 8); faceZ('extJan', a.u0, a.u1, PISO, a.y1, a.v1, 1, 8);
    const vao = [-3, 3, PORTA_Y];                                  // a porta do corredor, no lado que olha o prédio principal
    faceXVao('extJan', a.v0, a.v1, PISO, a.y1, a.u0, -1, 8, a.lado > 0 ? vao : null); faceXVao('extJan', a.v0, a.v1, PISO, a.y1, a.u1, 1, 8, a.lado < 0 ? vao : null);
    // rodapé de aço só por fora (o térreo é oco: as salas ficam dentro), com o vão da porta
    box('acoEsc', a.u0 - 0.15, a.u1 + 0.15, PISO, 1.1, a.v0 - 0.15, a.v0); box('acoEsc', a.u0 - 0.15, a.u1 + 0.15, PISO, 1.1, a.v1, a.v1 + 0.15);
    for (const [uf, lado] of [[a.u0, -1], [a.u1, 1]]) { const q0 = lado < 0 ? uf - 0.15 : uf, q1 = lado < 0 ? uf : uf + 0.15;
      if (lado === -a.lado) { box('acoEsc', q0, q1, PISO, 1.1, a.v0, -3.3); box('acoEsc', q0, q1, PISO, 1.1, 3.3, a.v1); } else box('acoEsc', q0, q1, PISO, 1.1, a.v0, a.v1); }
    for (const u of [a.u0, a.u1]) for (const v of [a.v0, a.v1]) box('ext', u - 0.8, u + 0.8, PISO, a.y1 + 1.2, v - 0.8, v + 0.8);
    piso('telhado', a.u0, a.u1, a.v0, a.v1, a.y1 + 0.02, 8);
    box('ext', a.u0, a.u1, a.y1, a.y1 + 1, a.v0, a.v0 + 0.5); box('ext', a.u0, a.u1, a.y1, a.y1 + 1, a.v1 - 0.5, a.v1);
    box('ext', a.u0, a.u0 + 0.5, a.y1, a.y1 + 1, a.v0, a.v1); box('ext', a.u1 - 0.5, a.u1, a.y1, a.y1 + 1, a.v0, a.v1);
    box('torreFaixa', a.u0 - 0.06, a.u1 + 0.06, a.y1 - 0.4, a.y1 - 0.25, a.v0 - 0.06, a.v0);
    const um = (a.u0 + a.u1) / 2; faceZ('logoL', um - 8.3, um + 8.3, a.y1 - 13, a.y1 - 3, a.v0 - 0.05, -1, 1, [0, 1, 0, 1]);
    for (const [du, dv] of [[0.3, 0.25], [0.7, 0.55], [0.4, 0.8]]) { const u = a.u0 + (a.u1 - a.u0) * du, v = a.v0 + (a.v1 - a.v0) * dv; box('acoEsc', u - 2.2, u + 2.2, a.y1, a.y1 + 1.6, v - 1.6, v + 1.6); }
  }
  // passarelas envidraçadas no alto (por baixo delas se passa)
  for (const p of PASSARELAS) {
    box(['extJan', 'extJan', 'telhado', 'acoEsc', 'extJan', 'extJan'], p.u0, p.u1, p.y0, p.y1, p.v0, p.v1, 8);
    const lz = p.u1 - p.u0 > p.v1 - p.v0;
    if (lz) { box('torreFaixa', p.u0, p.u1, p.y0 - 0.02, p.y0 + 0.1, p.v0 - 0.05, p.v0); box('torreFaixa', p.u0, p.u1, p.y0 - 0.02, p.y0 + 0.1, p.v1, p.v1 + 0.05); }
    else { box('torreFaixa', p.u0 - 0.05, p.u0, p.y0 - 0.02, p.y0 + 0.1, p.v0, p.v1); box('torreFaixa', p.u1, p.u1 + 0.05, p.y0 - 0.02, p.y0 + 0.1, p.v0, p.v1); }
  }
  // TORRE principal (a peça que se vê de longe; materiais com a névoa fraca): janelas em fita, pilastras nos cantos, a coroa,
  // o letreiro e o emblema no alto, o ANEL em volta do topo preso por quatro braços e o mastro com a luz vermelha
  const TR = TORRE, TC = TR.coroa, tcu = (TR.u0 + TR.u1) / 2, tcv = (TR.v0 + TR.v1) / 2;
  faceZVao('torreJan', TR.u0, TR.u1, PISO, TR.y1, TR.v0, -1, 8, [-3, 3, PORTA_Y]); faceZ('torreJan', TR.u0, TR.u1, PISO, TR.y1, TR.v1, 1, 8);
  faceX('torreJan', TR.v0, TR.v1, PISO, TR.y1, TR.u0, -1, 8); faceX('torreJan', TR.v0, TR.v1, PISO, TR.y1, TR.u1, 1, 8);
  for (const u of [TR.u0, TR.u1]) for (const v of [TR.v0, TR.v1]) box('torreExt', u - 1.1, u + 1.1, PISO, TR.y1 + 1.5, v - 1.1, v + 1.1);
  for (const u of [-7, 7]) box('torreExt', u - 0.6, u + 0.6, PISO, TR.y1 - 20, TR.v0 - 0.7, TR.v0);
  box('torreExt', TR.u0 - 0.3, TR.u1 + 0.3, TR.y1 - 0.6, TR.y1 + 1.5, TR.v0 - 0.3, TR.v1 + 0.3);
  box('torreFaixa', TR.u0 - 0.35, TR.u1 + 0.35, TR.y1 - 0.9, TR.y1 - 0.7, TR.v0 - 0.35, TR.v1 + 0.35);
  box(['torreExt', 'torreExt', 'telhado', 'torreExt', 'torreExt', 'torreExt'], TC.u0, TC.u1, TR.y1 + 1.5, TC.y1, TC.v0, TC.v1, 8);
  for (let k = 0; k < 6; k++) { const u = TC.u0 + 2.5 + k * ((TC.u1 - TC.u0 - 5) / 5); box('torreFaixa', u - 0.12, u + 0.12, TR.y1 + 3, TC.y1 - 1.5, TC.v0 - 0.05, TC.v0); box('torreFaixa', u - 0.12, u + 0.12, TR.y1 + 3, TC.y1 - 1.5, TC.v1, TC.v1 + 0.05); }
  for (const [v, dir] of [[TR.v0 - 0.32, -1], [TR.v1 + 0.32, 1]]) { box('torreExt', -20.4, 20.4, 110.6, 116.4, Math.min(v, v - dir * 0.3), Math.max(v, v - dir * 0.3)); faceZ('torreLetreiro', -20, 20, 111, 116, v + dir * 0.02, dir, 1, [0, 1, 0, 1]); }
  for (const [u, dir] of [[TR.u0 - 0.05, -1], [TR.u1 + 0.05, 1]]) faceX('torreLetreiro', tcv - 11, tcv + 11, 111.6, 114.35, u, dir, 1, [0, 1, 0, 1]);
  { const R = 36, y = 120;
    toro('torreAco', tcu, y, tcv, R, 1.5, PI / 2, 0, 0, 12, 128);
    toro('torreFaixa', tcu, y + 1.4, tcv, R, 0.22, PI / 2, 0, 0, 6, 128);
    toro('torreFaixa', tcu, y, tcv, R + 1.45, 0.14, PI / 2, 0, 0, 6, 128);
    for (const [du, dv] of [[TR.u1, TR.v1], [TR.u0, TR.v1], [TR.u0, TR.v0], [TR.u1, TR.v0]]) {
      const ox = du - tcu, oz = dv - tcv, a = Math.atan2(oz, ox), d0 = Math.hypot(ox, oz), L = R - d0;
      prim('torreAco', new G.BoxGeometry(L, 1.3, 1.3), tcu + Math.cos(a) * (d0 + L / 2), y, tcv + Math.sin(a) * (d0 + L / 2), 0, -a, 0);
      prim('torreAco', new G.BoxGeometry(Math.hypot(L, 14), 0.8, 0.8), tcu + Math.cos(a) * (d0 + L / 2), y - 7, tcv + Math.sin(a) * (d0 + L / 2), 0, -a, Math.atan2(14, L));
    }
  }
  cil('torreAco', tcu, TC.y1 + 13, tcv, 0.35, 26, 0, 0, 0, 8, 0.6);
  for (let k = 0; k < 3; k++) box('torreAco', tcu - 2.2 + k * 0.4, tcu + 2.2 - k * 0.4, TC.y1 + 6 + k * 6, TC.y1 + 6.2 + k * 6, tcv - 0.06, tcv + 0.06);
  // entrada da torre: marquise baixa e portas de vidro escuro
  for (const [u0, u1] of [[-10, -3.8], [3.8, 10]]) { box('acoEsc', u0, u1, 5.2, 5.6, TR.v0 - 5, TR.v0); box('luz', u0 + 0.4, u1 - 0.4, 5.16, 5.2, TR.v0 - 4.6, TR.v0 - 0.3); }
  for (const u0 of [-8, 3.8]) quad('vidro', [u0, PISO, TR.v0 - 0.06], [1, 0, 0], [0, 1, 0], 4.2, 4.6, 4);

  // ------------------------------------------------------------------ TELHADO do prédio principal (em TOPO)
  for (const [a, b, c, d] of LAJES) piso('telhado', a, b, c, d, TOPO + 0.02, 8);
  box('ext', -S, S, TOPO, TOPO + 1, -S, -S + 0.5); box('ext', -S, S, TOPO, TOPO + 1, S - 0.5, S); box('ext', -S, -S + 0.5, TOPO, TOPO + 1, -S + 0.5, S - 0.5); box('ext', S - 0.5, S, TOPO, TOPO + 1, -S + 0.5, S - 0.5);
  box('torreFaixa', -S, S, TOPO + 1, TOPO + 1.06, -S, -S + 0.5); box('torreFaixa', -S, S, TOPO + 1, TOPO + 1.06, S - 0.5, S);
  // o poço do Cortex (de H − 1 até TOPO): paredes claras com luzes verticais; a borda de laje vista de baixo
  for (const [v, d] of [[-10, 1], [10, -1]]) faceZ('int', -10, 10, H - 1, TOPO, v, d, 4);
  for (const [u, d] of [[-10, 1], [10, -1]]) faceX('int', -10, 10, H - 1, TOPO, u, d, 4);
  for (const [u, v] of [[-9.85, -9.85], [9.85, -9.85], [-9.85, 9.85], [9.85, 9.85]]) box('ciano', u - 0.08, u + 0.08, H - 1, TOPO, v - 0.08, v + 0.08);
  for (const y of [H + 4, H + 9]) { box('luz', -9.95, 9.95, y, y + 0.12, -10, -9.92); box('luz', -9.95, 9.95, y, y + 0.12, 9.92, 10); box('luz', -10, -9.92, y, y + 0.12, -9.95, 9.95); box('luz', 9.92, 10, y, y + 0.12, -9.95, 9.95); }
  for (const [u0, u1, v0, v1] of [[-12.5, 12.5, -12.5, -10], [-12.5, 12.5, 10, 12.5], [-12.5, -10, -10, 10], [10, 12.5, -10, 10]]) teto('teto', u0, u1, v0, v1, H - 1);
  // anel do acelerador sobre o telhado
  const AN = ANEL_TELHADO;
  toro('acoEsc', 0, AN.y, 0, AN.R, AN.tubo, PI / 2, 0, 0, 20, 112);
  toro('cianoPulso', 0, AN.y + AN.tubo - 0.02, 0, AN.R, 0.12, PI / 2, 0, 0, 8, 112);
  for (let k = 0; k < 24; k++) { const a = (k / 24) * PI * 2, x = AN.R * Math.cos(a), z = AN.R * Math.sin(a); prim('ext', new G.BoxGeometry(2.6, 2.7, 3.2), x, AN.y, z, 0, -a, 0); prim('acoEsc', new G.BoxGeometry(2.7, 0.3, 3.3), x, AN.y + 0.7, z, 0, -a, 0); }
  for (let k = 0; k < AN.pilones; k++) { const a = (k / AN.pilones) * PI * 2, x = AN.R * Math.cos(a), z = AN.R * Math.sin(a); box('acoEsc', x - 0.6, x + 0.6, TOPO, AN.y - AN.tubo + 0.2, z - 0.6, z + 0.6); box('acoEsc', x - 0.8, x + 0.8, TOPO, TOPO + 0.4, z - 0.8, z + 0.8); }
  // torres de resfriamento, tanque, parabólica, mastro
  for (const [u, v, l] of TELHADO_COISAS.torres) { cil('ext', u, TOPO + 2.5, v, l / 2 - 0.1, 5, 0, 0, 0, 24, l / 2 - 0.4); cil('acoEsc', u, TOPO + 5.05, v, l / 2 - 0.5, 0.15); for (let k = 0; k < 4; k++) box('acoEsc', u - 0.2 + (k - 1.5) * 0.3, u + (k - 1.5) * 0.3, TOPO + 5.0, TOPO + 5.5, v - l / 2 + 0.6, v + l / 2 - 0.6); box('acoEsc', u - l / 2, u + l / 2, TOPO, TOPO + 0.4, v - l / 2, v + l / 2); }
  { const [u, v, l] = TELHADO_COISAS.tanque; for (const du of [-1, 1]) for (const dv of [-1, 1]) cil('acoEsc', u + du * 1.1, TOPO + 3, v + dv * 1.1, 0.12, 6); box('acoEsc', u - l / 2, u + l / 2, TOPO + 5.9, TOPO + 6, v - l / 2, v + l / 2); cil('ext', u, TOPO + 7.5, v, 1.5, 3, 0, 0, 0, 20); cil('acoEsc', u, TOPO + 9.35, v, 0.05, 0.7, 0, 0, 0, 6, 1.4); }
  { const [u, v, l] = TELHADO_COISAS.parabolica; box('acoEsc', u - 0.8, u + 0.8, TOPO, TOPO + 1.2, v - 0.8, v + 0.8); cil('acoEsc', u, TOPO + 2.2, v, 0.15, 2); }
  { const [u, v] = TELHADO_COISAS.mastro; cil('acoEsc', u, TOPO + 7, v, 0.14, 14, 0, 0, 0, 8, 0.2); for (let k = 0; k < 4; k++) box('acoEsc', u - 1.2 + k * 0.1, u + 1.2 - k * 0.1, TOPO + 5 + k * 2, TOPO + 5.1 + k * 2, v - 0.04, v + 0.04); box('acoEsc', u - 0.5, u + 0.5, TOPO, TOPO + 0.6, v - 0.5, v + 0.5); }
  for (const [u, v, w, d] of [[-8, -22, 4, 2.4], [8, -22, 4, 2.4], [-18, 12, 3, 3], [-6, 21, 5, 2.4], [6, 21, 5, 2.4]]) { box('acoEsc', u - w / 2, u + w / 2, TOPO, TOPO + 1.3, v - d / 2, v + d / 2); for (let k = 0; k < 3; k++) cil('acoEsc', u - w / 2 + (k + 0.5) * (w / 3), TOPO + 1.35, v, 0.5, 0.1); }

  // ------------------------------------------------------------------ CÚPULA do Cortex
  { const D = DOME, cy = D.cy;
    const sph = new G.SphereGeometry(D.R, 56, 24, 0, PI * 2, 0, D.theta);
    prim('cupulaVidro', sph, 0, cy, 0);
    for (let k = 0; k < 12; k++) toro('aco', 0, cy, 0, D.R, 0.11, 0, (k * PI) / 6, PI / 2 - D.theta, 8, 40, D.theta);
    for (const t of [0.3, 0.6, 0.9, 1.15, D.theta]) toro('aco', 0, cy + D.R * Math.cos(t), 0, D.R * Math.sin(t), 0.13, PI / 2, 0, 0, 8, 64);
    toro('cianoPulso', 0, cy + D.R * Math.cos(0.75), 0, D.R * Math.sin(0.75), 0.1, PI / 2, 0, 0, 8, 64);
    toro('cianoPulso', 0, cy + D.R * Math.cos(0.42), 0, D.R * Math.sin(0.42), 0.08, PI / 2, 0, 0, 8, 64);
    cil('aco', 0, cy + D.R + 0.2, 0, 0.5, 0.8, 0, 0, 0, 12, 0.7); }

  // ------------------------------------------------------------------ ÁTRIO
  { const b = BALCAO;
    box(['acoEsc', 'acoEsc', 'mov', 'acoEsc', 'acoEsc', 'acoEsc'], b.u0 - 0.2, b.u1 + 0.2, b.y1 - 0.12, b.y1, b.v0 - 0.2, b.v1 + 0.2);
    box('mov', b.u0, b.u1, PISO, b.y1 - 0.12, b.v0, b.v1); box('ciano', b.u0 + 0.2, b.u1 - 0.2, 0.6, 0.66, b.v0 - 0.02, b.v0 + 0.02); box('ciano', b.u0 + 0.2, b.u1 - 0.2, 0.28 + 0.34, 0.3 + 0.38, b.v1 - 0.02, b.v1 + 0.02);
    faceZ('logoL', (b.u0 + b.u1) / 2 - 1.1, (b.u0 + b.u1) / 2 + 1.1, 0.4, 2.6, b.v0 - 0.04, -1, 1, [0.2, 0.8, 0, 1]);
    for (const u of [-19.5, -16.5, -13.5]) { box('acoEsc', u - 0.4, u + 0.4, b.y1, b.y1 + 0.75, b.v1 - 0.5, b.v1 - 0.45); quad('tela_onda', [u + 0.38, b.y1 + 0.06, b.v1 - 0.43], [-1, 0, 0], [0, 1, 0], 0.76, 0.62, 1, 1, [0, 1, 0, 1]); }
  }
  piso('logoL', -7, 7, -26.5, -12.5, F0 + 0.02, 1, [0.2, 0.8, 0, 1]);
  faceZ('logoL', -1.9, 1.9, 7.9, 11.7, -13.55, -1, 1, [0.2, 0.8, 0, 1]);
  for (const [u, v] of COLUNAS) { box('int', u - 0.5, u + 0.5, PISO, A.teto, v - 0.5, v + 0.5, 4); box('aco', u - 0.6, u + 0.6, PISO, PISO + 0.35, v - 0.6, v + 0.6); box('ciano', u - 0.52, u + 0.52, 1.0, 1.08, v - 0.52, v + 0.52); box('ciano', u - 0.52, u + 0.52, A.teto - 1.2, A.teto - 1.12, v - 0.52, v + 0.52); }
  // sofás e plantas
  for (const [u, v, w] of [[18, -23.5, 5], [18, -16, 5], [-18.5, -15, 4.5]]) { box('acoEsc', u - w / 2, u + w / 2, PISO, 0.55, v - 0.5, v + 0.5); box('mov', u - w / 2 + 0.1, u + w / 2 - 0.1, 0.55, 0.75, v - 0.45, v + 0.45); box('acoEsc', u - w / 2, u + w / 2, 0.55, 1.1, v - 0.5, v - 0.3); }
  for (const [u, v] of [[-24.5, -24.5], [24.5, -24.5], [-24.5, -14.5], [24.5, -14.5], [-5.5, -25], [5.5, -25]]) { cil('pav', u, 0.75, v, 0.55, 0.9, 0, 0, 0, 12); for (let k = 0; k < 5; k++) esf(k % 2 ? 'verde' : 'verde', u + (rnd() - 0.5) * 0.7, 1.6 + k * 0.28, v + (rnd() - 0.5) * 0.7, 0.55 - k * 0.05, 1, 1, 1, 1); }
  // painel informativo na parede leste e vitrines na oeste
  box('acoEsc', 25.6, 25.9, 2.0, 7.0, -23.2, -15.8); quad('tela_mapa', [25.58, 2.2, -16.0], [0, 0, -1], [0, 1, 0], 7, 4.6, 1, 1, [0, 1, 0, 1]);
  for (const v of [-24, -19.5, -15]) { box('acoEsc', -25.9, -24.6, PISO, 1.0, v - 1.2, v + 1.2); box('vidro', -25.8, -24.7, 1.0, 2.9, v - 1.15, v + 1.15); box('luz', -25.88, -25.8, 2.8, 2.9, v - 1.1, v + 1.1); esf('ciano', -25.2, 1.7, v, 0.28, 1, 1, 1, 1); }
  // luminárias lineares pendentes
  for (const v of [-24, -19.5, -15]) { box('luz', -22, 22, A.teto - 0.5, A.teto - 0.42, v - 0.12, v + 0.12); for (const u of [-18, 0, 18]) cil('acoEsc', u, A.teto - 0.25, v, 0.02, 0.5, 0, 0, 0, 4); }

  // ------------------------------------------------------------------ CORTEX
  { const y0 = 2.2, y1 = 7.7;
    // telões na parede norte (face interna v = 12.5) e nas laterais
    for (const [u0, u1, nome] of [[-12.2, -3.4, 'tela_mapa'], [3.4, 12.2, 'tela_energia']]) { box('acoEsc', u0 - 0.15, u1 + 0.15, y0 - 0.15, y1 + 0.15, 12.34, 12.5); quad(nome, [u1, y0, 12.33], [-1, 0, 0], [0, 1, 0], u1 - u0, y1 - y0, 1, 1, [0, 1, 0, 1]); }
    box('acoEsc', -5.15, 5.15, 8.15, 11.65, 12.34, 12.5); quad('tela_relogio', [5, 8.3, 12.33], [-1, 0, 0], [0, 1, 0], 10, 3.3, 1, 1, [0, 1, 0, 1]);
    for (const [u, dir] of [[-12.5, 1], [12.5, -1]]) for (const [v0, v1] of [[-12.0, -3.5], [3.5, 12.0]]) {
      box('acoEsc', dir > 0 ? u : u - 0.16, dir > 0 ? u + 0.16 : u, y0 - 0.15, y1 + 0.15, v0 - 0.15, v1 + 0.15);
      quad('tela_onda', dir > 0 ? [u + 0.17, y0, v1] : [u - 0.17, y0, v0], dir > 0 ? [0, 0, -1] : [0, 0, 1], [0, 1, 0], v1 - v0, y1 - y0, 1, 1, [0, 1, 0, 1]);
    }
    for (const v of [-12.45, 12.45]) box('ciano', -12.4, 12.4, 12.6, 12.68, v - 0.02, v + 0.02);
    box('ciano', 12.42, 12.46, 12.6, 12.68, -12.4, 12.4); box('ciano', -12.46, -12.42, 12.6, 12.68, -12.4, 12.4);
    for (const [u, v] of [[-12.0, -12.0], [12.0, -12.0], [-12.0, 12.0], [12.0, 12.0]]) { cil('aco', u, 8, v, 0.28, 16, 0, 0, 0, 10); cil('ciano', u, 1.0, v, 0.32, 0.08, 0, 0, 0, 10); }
    box('acoEsc', -12.5, 12.5, 15.2, 16, -13, -12.5); box('acoEsc', -12.5, 12.5, 15.2, 16, 12.5, 13);
  }
  for (const c of CONSOLES) {
    box('acoEsc', c.u0, c.u1, PISO, 0.82, c.v0, c.v1); box(['mov', 'mov', 'mov', 'mov', 'mov', 'mov'], c.u0 - 0.1, c.u1 + 0.1, 0.82, 1.05, c.v0 - 0.2, c.v1 + 0.1);
    box('ciano', c.u0 + 0.1, c.u1 - 0.1, 0.84 + 0.0, 0.88, c.v0 - 0.205, c.v0 - 0.19);
    const n = 3, w = (c.u1 - c.u0) / n;
    for (let k = 0; k < n; k++) { const u = c.u0 + (k + 0.5) * w; box('acoEsc', u - 0.7, u + 0.7, 1.05, 2.0, c.v1 - 0.12, c.v1 - 0.02); quad('tela_onda', [u + 0.66, 1.1, c.v1 - 0.125], [-1, 0, 0], [0, 1, 0], 1.32, 0.86, 1, 1, [0, 1, 0, 1]); cil('acoEsc', u, 1.1, c.v1 - 0.2, 0.05, 0.2, 0, 0, 0, 6);
      const cu = u, cv = c.v0 - 1.1; cil('acoEsc', cu, 0.5, cv, 0.05, 0.4, 0, 0, 0, 6); cil('acoEsc', cu, 0.7, cv, 0.35, 0.12, 0, 0, 0, 12); box('acoEsc', cu - 0.3, cu + 0.3, 0.75, 1.35, cv - 0.38, cv - 0.28); }
  }
  { const m = MESA_HOLO;
    cil('acoEsc', 0, PISO + 0.4, 0, 2.2, 0.8, 0, 0, 0, 40, 1.9); cil('aco', 0, 1.0, 0, 2.2, 0.12, 0, 0, 0, 40); toro('ciano', 0, 1.07, 0, 1.95, 0.05, PI / 2, 0, 0, 8, 64);
    cil('ciano', 0, 1.08, 0, 1.1, 0.02, 0, 0, 0, 32); }
  toro('ciano', 0, 0.35, 0, 7.6, 0.05, PI / 2, 0, 0, 6, 96);

  // ------------------------------------------------------------------ CONTENÇÃO
  for (const v of [-12.2, 12.2]) { box('acoEsc', 13.6, 25.9, 0.9, 1.0, v - 0.02, v + 0.02); }
  for (const u of [18.4, 21.6]) cil('acoEsc', u, 7.3, 0, 0.17, 25, PI / 2, 0, 0, 10);
  cil('ciano', 20, 7.65, 0, 0.05, 25, PI / 2, 0, 0, 6);
  box('luz', 19.4, 20.6, CT.teto - 0.1, CT.teto - 0.04, -12, 12);
  for (const c of CELAS) {
    const uf = c.lado < 0 ? c.u1 : c.u0, ub = c.lado < 0 ? c.u0 : c.u1, vc = (c.v0 + c.v1) / 2, dir = c.lado < 0 ? 1 : -1;
    const y1 = c.y1, ux = (a) => (c.lado < 0 ? a : a);
    for (const u of [c.u0, c.u1]) for (const v of [c.v0, c.v1]) box('aco', u - 0.07, u + 0.07, PISO, y1, v - 0.07, v + 0.07);
    box('aco', c.u0, c.u1, y1 - 0.1, y1, c.v0 - 0.07, c.v0 + 0.07); box('aco', c.u0, c.u1, y1 - 0.1, y1, c.v1 - 0.07, c.v1 + 0.07); box('aco', uf - 0.07, uf + 0.07, y1 - 0.1, y1, c.v0, c.v1);
    box('acoEsc', c.u0, c.u1, PISO, PISO + 0.35, c.v0 - 0.08, c.v1 + 0.08);
    quad('vidroCela', [c.u0, PISO + 0.35, c.v0], [1, 0, 0], [0, 1, 0], c.u1 - c.u0, y1 - PISO - 0.4, 1); quad('vidroCela', [c.u0, PISO + 0.35, c.v1], [1, 0, 0], [0, 1, 0], c.u1 - c.u0, y1 - PISO - 0.4, 1);
    quad('vidroCela', [uf, PISO + 0.35, c.v0], [0, 0, 1], [0, 1, 0], c.v1 - c.v0, y1 - PISO - 0.4, 1);
    quad('vidroCela', [c.u0, y1 - 0.05, c.v1], [1, 0, 0], [0, 0, -1], c.u1 - c.u0, c.v1 - c.v0, 1);
    // porta luminosa voltada para o corredor
    const du = dir > 0 ? uf + 0.09 : uf - 0.09;
    box('aco', Math.min(uf, du) - 0.02, Math.max(uf, du) + 0.02, PISO + 0.35, 3.45, vc - 1.12, vc - 0.98); box('aco', Math.min(uf, du) - 0.02, Math.max(uf, du) + 0.02, PISO + 0.35, 3.45, vc + 0.98, vc + 1.12); box('aco', Math.min(uf, du) - 0.02, Math.max(uf, du) + 0.02, 3.35, 3.45, vc - 1.12, vc + 1.12);
    quad('portaCela', [du, PISO + 0.4, vc - 1.0], [0, 0, 1], [0, 1, 0], 2.0, 2.95, 1);
    box('ciano', Math.min(uf, du), Math.max(uf, du), 1.7, 1.78, vc - 0.9, vc + 0.9);
    placa(ROTULOS_CELA(c.n), vc, y1 - 1.05, dir > 0 ? uf + 0.1 : uf - 0.1, dir, 2.4, 1.2, 'x');
    // mobília da cela
    box('mov', ub + (dir > 0 ? 0.15 : -1.05), ub + (dir > 0 ? 1.05 : -0.15), PISO, 0.6, c.v0 + 0.3, c.v1 - 0.3); box('acoEsc', ub + (dir > 0 ? 0.15 : -1.05), ub + (dir > 0 ? 1.05 : -0.15), 0.6, 0.72, c.v0 + 0.3, c.v1 - 0.3);
    box('luz', Math.min(ub, uf) + 0.5, Math.max(ub, uf) - 0.5, y1 - 0.15, y1 - 0.1, vc - 0.15, vc + 0.15);
  }

  // ------------------------------------------------------------------ ESTEIRA
  { const P = PLATAFORMA_ESTEIRA;
    box('acoEsc', P.u0 - 0.1, P.u1 + 0.1, PISO, P.y1 - 0.02, P.v0 - 0.4, P.v1 + 0.4);
    quad('correia', [P.u0, P.y1, P.v1], [1, 0, 0], [0, 0, -1], P.u1 - P.u0, P.v1 - P.v0, 2.5, 2.5);
    for (const u of [P.u0 - 0.1, P.u1 + 0.1]) { box('aco', u - 0.08, u + 0.08, PISO, 1.2, P.v0, P.v1); box('ciano', u - 0.09, u + 0.09, 1.2, 1.26, P.v0, P.v1); for (const v of [P.v0, P.v1]) box('aco', u - 0.1, u + 0.1, PISO, 1.3, v - 0.08, v + 0.08); }
    box('acoEsc', P.u0 + 1.2, P.u0 + 3.2, PISO, 1.0, P.v1 + 0.5, P.v1 + 1.3); box('luz', P.u0 + 1.25, P.u0 + 3.15, 1.0, 1.04, P.v1 + 0.55, P.v1 + 1.25); }
  for (const v of [-7.5, 0, 7.5]) { box('aco', E.u[0], E.u[1], 6.6, 6.9, v - 0.15, v + 0.15); box('luz', E.u[0] + 0.3, E.u[1] - 0.3, 6.55, 6.6, v - 0.08, v + 0.08); if (v) for (const u of [E.u[0] + 0.5, E.u[1] - 0.5]) cil('aco', u, 3.3, v, 0.1, 6.6, 0, 0, 0, 8); }   // (em v = 0 ficam as portas)
  for (const v of [-10, -5, 5, 10]) for (const u of [E.u[0] + 0.4, E.u[1] - 0.4]) { box('acoEsc', u - 0.12, u + 0.12, PISO, 2.2, v - 0.12, v + 0.12); esf('cianoPulso', u, 2.3, v, 0.14, 1, 1, 1, 1); }
  for (const [v0, v1] of [[-11.5, -4.5], [4.5, 11.5]]) { box('acoEsc', -13.7, -13.54, 2.85, 7.15, v0 - 0.15, v1 + 0.15); quad('tela_vel', [-13.52, 3.0, v1], [0, 0, -1], [0, 1, 0], v1 - v0, 4.0, 1, 1, [0, 1, 0, 1]); }
  // marcas de distância na parede oeste (menos no vão da porta da ala oeste, no meio dela)
  [0, 5, 10, 15, 20, 25].forEach((m, i) => { const v = -12.5 + m; const nome = `${m} m`; if (v <= 12.4 && (v < -3.6 || v > 3.6)) { box('luz', -25.95, -25.9, 0.8, 2.4, v - 0.04, v + 0.04); placa(nome, v + 1.0, 1.2, -25.9, 1, 1.2, 0.6, 'x'); } });
  piso('perigo', E.u[0] + 0.5, E.u[1] - 0.5, 12.2, 12.32, F0 + 0.01, 1);

  // ------------------------------------------------------------------ ACELERADOR
  prim('aco', new G.CylinderGeometry(TUBO.r, TUBO.r, TUBO.u1 - TUBO.u0, 28), 0, TUBO.y, TUBO.v, 0, 0, PI / 2);
  for (let u = -24; u <= 24; u += 3) { cil('ciano', u, TUBO.y, TUBO.v, TUBO.r + 0.03, 0.22, 0, 0, PI / 2, 20); }
  for (let u = -24; u <= 24; u += 6) cil('acoEsc', u + 1.5, TUBO.y, TUBO.v, TUBO.r + 0.12, 0.5, 0, 0, PI / 2, 20);
  for (const a of ANEIS_ACEL) {
    toro('ext', a.u, 2.75, a.v, a.R, 0.38, 0, PI / 2, 0, 14, 40); toro('ciano', a.u - 0.38, 2.75, a.v, a.R, 0.05, 0, PI / 2, 0, 6, 40); toro('ciano', a.u + 0.38, 2.75, a.v, a.R, 0.05, 0, PI / 2, 0, 6, 40);
    box('acoEsc', a.u - 0.5, a.u + 0.5, PISO, 0.9, a.v - 1.6, a.v + 1.6); box('acoEsc', a.u - 0.5, a.u + 0.5, 4.6, 5.0, a.v - 0.6, a.v + 0.6);
    for (let k = 0; k < 6; k++) { const ang = (k / 6) * PI * 2 + 0.4; prim('aco', new G.BoxGeometry(0.9, 0.4, 0.7), a.u, 2.75 + Math.sin(ang) * a.R, a.v + Math.cos(ang) * a.R, ang, 0, 0); }
  }
  for (let u = -20; u <= 20; u += 8) { cil('acoEsc', u, 8.2, TUBO.v, 0.07, 9.6, 0, 0, 0, 6); }
  for (const v of [15.2, 24.8]) { cil('ext', 0, 11.6, v, 0.55, 51, 0, 0, PI / 2, 16); for (let u = -24; u <= 24; u += 8) { cil('acoEsc', u, 11.6, v, 0.62, 0.35, 0, 0, PI / 2, 16); if (v < 20) cil('aco', u, 6.3, v, 0.12, 10.5, 0, 0, 0, 8); } }
  for (const [u, v] of TORRES_ENERGIA) { box('acoEsc', u - 1, u + 1, PISO, 7, v - 1, v + 1); for (let y = 1; y < 7; y += 1.2) box('cianoPulso', u - 1.04, u + 1.04, y, y + 0.14, v - 1.04, v + 1.04); box('luz', u - 0.6, u + 0.6, 7, 7.2, v - 0.6, v + 0.6); }
  for (const u of [-16, 16]) { box('acoEsc', u - 1.4, u + 1.4, PISO, 1.1, 24.2, 25.8); }
  placa('ACELERADOR', 0, 9.4, 25.95, -1, 3.6, 1.8, 'z'); placa('ALTA ENERGIA', -12, 3.2, 25.95, -1, 2.4, 1.2, 'z'); placa('ÁREA RESTRITA', 12, 3.2, 25.95, -1, 2.4, 1.2, 'z');
  for (const u of [-22, -10, 10, 22]) { box('luz', u - 0.1, u + 0.1, 12.6, 12.9, 14.0, 26.0); }
  for (const v of [14.5, 25.5]) box('cianoPulso', -25.5, 25.5, 0.36, 0.44, v - 0.04, v + 0.04);

  // ------------------------------------------------------------------ ANEXOS (dono, 26/10: "não tem mais salas, o núcleo não está maior e mais marcante")
  const FA = F0 + 0.03;     // piso dos anexos um pouco acima do pavimento da praça (que passa por baixo deles)
  // CORREDORES envidraçados no térreo: piso, as duas paredes de vidro com montantes, rodapé com friso e o teto baixo com luz
  for (const k of CORREDORES) {
    const [c0, c1] = k.cs, T6 = CORREDOR.teto, z = k.eixo === 'z', L = k.b - k.a;
    const caixa = (keys, s0, s1, y0, y1, q0, q1) => (z ? box(keys, q0, q1, y0, y1, s0, s1) : box(keys, s0, s1, y0, y1, q0, q1));
    if (z) piso('pisoAtrio', c0, c1, k.a, k.b, FA, 4); else piso('pisoAtrio', k.a, k.b, c0, c1, FA, 4);
    caixa(['acoEsc', 'acoEsc', 'telhado', 'teto', 'acoEsc', 'acoEsc'], k.a, k.b, T6, T6 + 0.5, c0 - 0.15, c1 + 0.15);
    caixa('luz', k.a + 0.6, k.b - 0.6, T6 - 0.06, T6, -0.35, 0.35);
    caixa('torreFaixa', k.a, k.b, T6 + 0.5, T6 + 0.58, c0 - 0.15, c0 - 0.05); caixa('torreFaixa', k.a, k.b, T6 + 0.5, T6 + 0.58, c1 + 0.05, c1 + 0.15);
    for (const c of [c0, c1]) {
      if (z) quad('vidro', [c, 0.6, k.a], [0, 0, 1], [0, 1, 0], L, T6 - 0.6, 4); else quad('vidro', [k.a, 0.6, c], [1, 0, 0], [0, 1, 0], L, T6 - 0.6, 4);
      const n = Math.max(2, Math.round(L / 2.8));
      for (let i = 0; i <= n; i++) { const sv = k.a + (L * i) / n; caixa('aco', sv - 0.1, sv + 0.1, PISO, T6, c - 0.12, c + 0.12); }
      caixa('acoEsc', k.a, k.b, PISO, 0.6, c - 0.15, c + 0.15); caixa('ciano', k.a, k.b, 0.6, 0.64, c - 0.16, c + 0.16);
    }
  }

  // CÂMARA DO NÚCLEO AURORA (o térreo da torre): a coluna de energia do chão ao teto, a esfera do reator na gaiola, os seis
  // pilares de contenção com arcos de energia, o giroscópio (peça animada, mais abaixo), conduítes, telões e consoles
  { const N = NUCLEO, SN = SALAS.nucleo, nu = N.u, nv = N.v, ey = N.esfera.y, er = N.esfera.r, TT = N.teto;
    piso('pisoAcel', SN.u[0], SN.u[1], SN.v[0], SN.v[1], FA, 2); teto('teto', SN.u[0], SN.u[1], SN.v[0], SN.v[1], TT);
    // plataforma redonda e os anéis de luz no chão; faixa de perigo em volta
    cil('acoEsc', nu, FA + 0.05, nv, N.base, 0.1, 0, 0, 0, 56);
    for (const [r, k] of [[N.base - 0.2, 'ciano'], [4.7, 'cianoPulso'], [3.3, 'ciano']]) toro(k, nu, FA + 0.11, nv, r, 0.06, PI / 2, 0, 0, 4, 72);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; prim('ciano', new G.BoxGeometry(1.2, 0.03, 0.08), nu + Math.cos(a) * 5.65, FA + 0.11, nv + Math.sin(a) * 5.65, 0, -a, 0); }
    for (const [u0, u1, v0, v1] of [[-7.6, 7.6, -7.6, -7.25], [-7.6, 7.6, 7.25, 7.6], [-7.6, -7.25, -7.25, 7.25], [7.25, 7.6, -7.25, 7.25]]) piso('perigo', nu + u0, nu + u1, nv + v0, nv + v1, FA + 0.01, 1.4);
    // a coluna: luz pulsando por dentro, camisa de vidro, cintas e trilhos de aço
    cil('cianoPulso', nu, TT / 2, nv, N.coluna, TT, 0, 0, 0, 24);
    cil('vidroCela', nu, TT / 2, nv, N.camisa, TT, 0, 0, 0, 40);
    for (let y = 3.4; y < TT - 3; y += 2.6) toro('aco', nu, y, nv, N.camisa + 0.05, 0.1, PI / 2, 0, 0, 6, 36);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * PI * 2 + PI / 4; cil('aco', nu + Math.cos(a) * (N.camisa + 0.06), TT / 2, nv + Math.sin(a) * (N.camisa + 0.06), 0.08, TT, 0, 0, 0, 6); }
    // a base (a máquina que alimenta) e a tampa que se abre no teto
    cil('ext', nu, FA + 1.3, nv, 3.6, 2.6, 0, 0, 0, 40, 2.9); toro('ciano', nu, FA + 2.62, nv, 2.95, 0.07, PI / 2, 0, 0, 6, 64);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; prim('acoEsc', new G.BoxGeometry(0.5, 2.0, 0.7), nu + Math.cos(a) * 3.35, FA + 1.0, nv + Math.sin(a) * 3.35, 0, -a, 0); }
    cil('ext', nu, TT - 1.7, nv, 2.9, 3.4, 0, 0, 0, 40, 4.4); toro('ciano', nu, TT - 3.4, nv, 2.95, 0.07, PI / 2, 0, 0, 6, 64);
    // a esfera do reator e a gaiola (meridianos e paralelos)
    esf('cianoPulso', nu, ey, nv, er, 1, 1, 1, 3);
    for (let i = 0; i < 8; i++) toro('aco', nu, ey, nv, er + 0.45, 0.09, 0, (i * PI) / 8, 0, 5, 40);
    for (const t of [-0.95, -0.5, 0, 0.5, 0.95]) toro('aco', nu, ey + (er + 0.45) * Math.sin(t), nv, (er + 0.45) * Math.cos(t), 0.09, PI / 2, 0, 0, 5, 40);
    // os pilares de contenção, cada um com um arco de energia até a esfera
    for (let i = 0; i < N.pilares.n; i++) {
      const a = (i / N.pilares.n) * PI * 2, x = nu + N.pilares.R * Math.cos(a), zz = nv + N.pilares.R * Math.sin(a), y1 = N.pilares.y1;
      box('acoEsc', x - 0.7, x + 0.7, PISO, y1, zz - 0.7, zz + 0.7); box('aco', x - 0.85, x + 0.85, PISO, PISO + 0.5, zz - 0.85, zz + 0.85); box('aco', x - 0.8, x + 0.8, y1, y1 + 0.2, zz - 0.8, zz + 0.8);
      for (let y = 1.3; y < y1 - 0.6; y += 1.4) box('cianoPulso', x - 0.73, x + 0.73, y, y + 0.16, zz - 0.73, zz + 0.73);
      esf('ciano', x, y1 + 0.65, zz, 0.45, 1, 1, 1, 2);
      const r0 = N.pilares.R, r1 = er + 0.5, dR = r0 - r1, dy = ey - (y1 + 0.65), L = Math.hypot(dR, dy), mR = (r0 + r1) / 2;
      prim('ciano', new G.BoxGeometry(L, 0.08, 0.08), nu + Math.cos(a) * mR, (y1 + 0.65 + ey) / 2, nv + Math.sin(a) * mR, 0, PI - a, Math.atan2(dy, dR));
    }
    // a passarela de serviço no alto (anel a 20 m, presa nas paredes)
    toro('acoEsc', nu, 20, nv, 8.8, 0.3, PI / 2, 0, 0, 8, 64); toro('ciano', nu, 20.32, nv, 8.8, 0.05, PI / 2, 0, 0, 4, 64);
    for (const [a, ate] of [[0, 21], [PI, 21], [PI / 2, 11], [-PI / 2, 11]]) { const comp = ate - 8.8, m = 8.8 + comp / 2;
      if (Math.abs(Math.cos(a)) > 0.5) box('acoEsc', nu + Math.cos(a) * m - comp / 2, nu + Math.cos(a) * m + comp / 2, 19.8, 20.2, nv - 0.6, nv + 0.6);
      else box('acoEsc', nu - 0.6, nu + 0.6, 19.8, 20.2, nv + Math.sin(a) * m - comp / 2, nv + Math.sin(a) * m + comp / 2); }
    // tubulação do teto: das paredes até a tampa do reator
    for (const [a, comp] of [[0, 21 - 4.4], [PI, 21 - 4.4], [PI / 2, 11 - 4.4], [-PI / 2, 11 - 4.4]]) {
      const m = 4.4 + comp / 2, eixoX = Math.abs(Math.cos(a)) > 0.5;
      cil('acoEsc', nu + Math.cos(a) * m, TT - 2.6, nv + Math.sin(a) * m, 0.5, comp, eixoX ? 0 : PI / 2, 0, eixoX ? PI / 2 : 0, 16);
      cil('cianoPulso', nu + Math.cos(a) * m, TT - 2.6, nv + Math.sin(a) * m, 0.53, 0.2, eixoX ? 0 : PI / 2, 0, eixoX ? PI / 2 : 0, 16);
    }
    // conduítes grossos subindo pela parede do fundo, com anéis de luz
    for (const u of [-17, -11, 11, 17]) { cil('aco', u, TT / 2, 60.35, 0.5, TT, 0, 0, 0, 14); for (let y = 2.2; y < TT - 1; y += 3.6) toro('cianoPulso', u, y, 60.35, 0.53, 0.06, PI / 2, 0, 0, 4, 12); }
    // telões nas paredes dos lados e os consoles na frente deles
    for (const [u, dir, nome] of [[-20.95, 1, 'tela_energia'], [20.95, -1, 'tela_onda']]) {
      box('acoEsc', dir > 0 ? u - 0.05 : u - 0.15, dir > 0 ? u + 0.15 : u + 0.05, 3.85, 10.15, 43.85, 56.15);
      quad(nome, dir > 0 ? [u + 0.17, 4, 56] : [u - 0.17, 4, 44], dir > 0 ? [0, 0, -1] : [0, 0, 1], [0, 1, 0], 12, 6, 1, 1, [0, 1, 0, 1]);
      const u0 = dir > 0 ? -19.6 : 18.2, u1 = dir > 0 ? -18.2 : 19.6;
      box('acoEsc', u0, u1, PISO, 0.82, 45, 55); box('mov', u0 - 0.1, u1 + 0.1, 0.82, 1.05, 44.9, 55.1); box('ciano', dir > 0 ? u1 + 0.1 : u0 - 0.12, dir > 0 ? u1 + 0.12 : u0 - 0.1, 0.84, 0.9, 45, 55);
      for (const v of [46.5, 50, 53.5]) { const uu = dir > 0 ? u0 + 0.15 : u1 - 0.15; box('acoEsc', uu - 0.06, uu + 0.06, 1.05, 1.95, v - 0.7, v + 0.7); quad('tela_onda', dir > 0 ? [uu + 0.07, 1.1, v + 0.66] : [uu - 0.07, 1.1, v - 0.66], dir > 0 ? [0, 0, -1] : [0, 0, 1], [0, 1, 0], 1.32, 0.8, 1, 1, [0, 1, 0, 1]); }
    }
    // o letreiro do Núcleo e os avisos; o anel de luz no teto
    placa('NÚCLEO AURORA', 0, 23, 60.95, -1, 10, 5, 'z');
    placa('ALTA ENERGIA', -6, 3.4, 60.95, -1, 2.4, 1.2, 'z'); placa('PERIGO', 6, 3.4, 60.95, -1, 2.4, 1.2, 'z');
    toro('luz', nu, TT - 0.3, nv, 9.5, 0.14, PI / 2, 0, 0, 4, 72);
    for (const u of [-16, 16]) box('luz', u - 0.15, u + 0.15, TT - 0.12, TT, 40, 60);
  }

  // ALAS: tetos, pisos e luzes das seis salas
  for (const [nome, pk] of [['medica', 'pisoCont'], ['alaOeste', 'pisoAtrio'], ['oficina', 'pisoAcel'], ['trajes', 'pisoAtrio'], ['alaLeste', 'pisoAtrio'], ['fenda', 'pisoCont']]) {
    const s0 = SALAS[nome]; piso(pk, s0.u[0], s0.u[1], s0.v[0], s0.v[1], FA, pk === 'pisoAcel' ? 2 : 4); teto('teto', s0.u[0], s0.u[1], s0.v[0], s0.v[1], s0.teto);
    const um = (s0.u[0] + s0.u[1]) / 2;
    for (const du of [-6, 6]) box('luz', um + du - 0.14, um + du + 0.14, s0.teto - 0.1, s0.teto - 0.02, s0.v[0] + 1, s0.v[1] - 1);
  }
  // os saguões: o emblema na parede do fundo, banco, vasos e um telão
  // (edição pessoal: no leste, a parede da sala secreta do Wells fecha o fundo do saguão — o emblema vai nela, de disfarce;
  // banco e vasos ficam do lado de cá; o resto é a sala, desenhada em cofre3d.js)
  const cofre = !!SALAS.cofre;
  for (const lado of [-1, 1]) {
    const fundo = lado > 0 && cofre ? 51.68 : lado < 0 ? -60.97 : 60.97, uf = fundo, dir = -lado, ub = lado < 0 ? -53 : cofre ? 46 : 53;
    const naParede = lado > 0 && cofre;                     // (na parede secreta: o emblema acima da porta escondida)
    if (naParede) faceX('logoL', -1.2, 1.2, 5.4, 9.4, uf, dir, 1, [0.2, 0.8, 0, 1]); else faceX('logoL', -1.8, 1.8, 2.2, 8.2, uf, dir, 1, [0.2, 0.8, 0, 1]);
    box('acoEsc', ub - 2, ub + 2, PISO, 0.45, -1, 1); box('mov', ub - 1.9, ub + 1.9, 0.45, 0.55, -0.9, 0.9);
    for (const v of [-4.4, 4.4]) { const u = lado < 0 ? -59.6 : cofre ? 50.2 : 59.6; cil('pav', u, 0.75, v, 0.55, 0.9, 0, 0, 0, 12); for (let k = 0; k < 4; k++) esf('verde', u + (rnd() - 0.5) * 0.6, 1.6 + k * 0.3, v + (rnd() - 0.5) * 0.6, 0.55 - k * 0.06, 1, 1, 1, 1); }
    if (naParede) for (const [v0, v1] of [[-5.4, -1.35], [1.35, 5.4]]) box('ciano', fundo - 0.02, fundo + 0.02, 0.9, 0.96, v0, v1);
    else box('ciano', lado < 0 ? -60.99 : fundo - 0.02, lado < 0 ? -60.95 : fundo + 0.02, 0.9, 0.96, -5.4, 5.4);
  }
  // um manequim com traje: pernas, corpo, braços, capuz e a base (o material escolhe a cor)
  const manequim = (k, u, v, rumo = 0) => {
    const c = Math.cos(rumo), s = Math.sin(rumo), P = (dx, dz) => [u + dx * c - dz * s, v + dx * s + dz * c];
    cil('acoEsc', u, PISO + 0.04, v, 0.42, 0.08, 0, 0, 0, 20); cil('aco', u, PISO + 0.25, v, 0.04, 0.4, 0, 0, 0, 6);
    for (const d of [-0.11, 0.11]) { const [x, z] = P(0, d); cil(k, x, PISO + 0.95, z, 0.075, 0.95, 0, 0, 0, 10, 0.09); }
    cil(k, u, PISO + 1.75, v, 0.2, 0.7, 0, 0, 0, 14, 0.25);
    for (const d of [-0.33, 0.33]) { const [x, z] = P(0, d); cil(k, x, PISO + 1.68, z, 0.06, 0.66, 0, 0, d > 0 ? 0.1 : -0.1, 8, 0.07); }
    esf(k, u, PISO + 2.32, v, 0.14, 1, 1.15, 1, 2);
    cil('ciano', u, PISO + 1.43, v, 0.205, 0.05, 0, 0, 0, 14);
  };
  // ALA MÉDICA: leitos com monitor e divisórias de vidro, os armários, o tomógrafo e o telão de sinais vitais
  for (const v of [-26, -21, -16, -11]) {
    box('acoEsc', -60.6, -56.6, PISO, 0.5, v - 1.1, v + 1.1); box('mov', -60.5, -56.7, 0.5, 0.8, v - 1.0, v + 1.0); box('luz', -60.4, -59.5, 0.8, 0.94, v - 0.75, v + 0.75);
    box('acoEsc', -61, -60.88, 1.45, 2.75, v - 0.75, v + 0.75); quad('tela_onda', [-60.87, 1.5, v + 0.7], [0, 0, -1], [0, 1, 0], 1.4, 1.2, 1, 1, [0, 1, 0, 1]);
    quad('vidro', [-61, 0.4, v - 2.5], [1, 0, 0], [0, 1, 0], 4.8, 2.3, 4); box('aco', -61, -56.2, 2.7, 2.78, v - 2.54, v - 2.46);
  }
  box('mov', -60.6, -40, PISO, 2.4, -29, -27.8); box('ciano', -60.6, -40, 2.25, 2.3, -27.82, -27.78);
  for (let u = -58.5; u < -40; u += 2.15) box('acoEsc', u - 0.03, u + 0.03, PISO + 0.1, 2.2, -27.82, -27.76);
  box('acoEsc', -44.6, -43.4, PISO, 0.6, -21.4, -14.6); box('mov', -45.2, -42.8, 0.6, 0.95, -21.4, -14.6); box('acoEsc', -46.2, -41.8, PISO, 0.45, -18.5, -17.5);
  toro('mov', -44, 2.25, -18, 1.95, 0.42, 0, 0, 0, 10, 40); toro('ciano', -44, 2.25, -18.43, 1.95, 0.05, 0, 0, 0, 4, 40); toro('ciano', -44, 2.25, -17.57, 1.95, 0.05, 0, 0, 0, 4, 40);
  box('acoEsc', -37.15, -36.98, 2.2, 6.2, -26, -16); quad('tela_onda', [-37.17, 2.4, -26 + 0.2], [0, 0, 1], [0, 1, 0], 9.6, 3.6, 1, 1, [0, 1, 0, 1]);
  // OFICINA: bancadas com aparelhos e monitores, a parede de ferramentas, as prateleiras e o traje protótipo
  for (const [u0, u1] of [[-57, -51], [-47, -41]]) for (const v of [13, 22, 31]) {
    box('aco', u0, u1, 0.92, 1.0, v, v + 2); for (const uu of [u0 + 0.1, u1 - 0.3]) box('acoEsc', uu, uu + 0.2, PISO, 0.92, v + 0.1, v + 1.9);
    box('acoEsc', u0 + 0.2, u1 - 0.2, 0.32, 0.4, v + 0.2, v + 1.8);
    cil('ciano', u0 + 1.0, 1.15, v + 0.9, 0.14, 0.3, 0, 0, 0, 10); box('acoEsc', u0 + 1.8, u0 + 2.7, 1.0, 1.32, v + 0.5, v + 1.3); esf('cianoPulso', u0 + 2.25, 1.42, v + 0.9, 0.12, 1, 1, 1, 1);
    box('acoEsc', u0 + 3.4, u0 + 4.8, 1.0, 1.9, v + 1.82, v + 1.92); quad('tela_onda', [u0 + 4.76, 1.08, v + 1.81], [-1, 0, 0], [0, 1, 0], 1.32, 0.76, 1, 1, [0, 1, 0, 1]);
    cil('acoEsc', u1 - 0.6, 1.5, v + 1.6, 0.03, 1.0, 0, 0, 0, 6); cil('luz', u1 - 0.6, 2.0, v + 1.45, 0.16, 0.12, 0.6, 0, 0, 10);
  }
  box('acoEsc', -61, -60.2, PISO, 3.2, 9, 37);
  for (let v = 10; v < 36; v += 2.2) { box('ciano', -60.22, -60.17, 1.2, 1.24, v, v + 1.6); box('aco', -60.3, -60.18, 1.4, 2.6, v + 0.3, v + 0.5); box('aco', -60.3, -60.18, 1.8, 2.0, v + 0.7, v + 1.4); box('mov', -60.3, -60.18, 2.2, 2.9, v + 1.1, v + 1.5); }
  for (const y of [0.45, 1.45, 2.45, 3.45]) box('aco', -58, -40, y, y + 0.06, 37.8, 39);
  for (let u = -58; u <= -40; u += 3) box('acoEsc', u - 0.05, u + 0.05, PISO, 4.2, 37.8, 39);
  for (let u = -57.6; u < -40.6; u += 1.3) for (const y of [0.51, 1.51, 2.51, 3.51]) if (rnd() < 0.6) box(rnd() < 0.5 ? 'mov' : 'acoEsc', u, u + 0.9, y, y + 0.35 + rnd() * 0.3, 38.0, 38.8);
  manequim('traje', -44, 27.5, 0);
  box('acoEsc', -37.15, -36.98, 2.4, 6.4, 12, 22); quad('tela_mapa', [-37.17, 2.6, 12.2], [0, 0, 1], [0, 1, 0], 9.6, 3.6, 1, 1, [0, 1, 0, 1]);
  // SALA DOS TRAJES: as vitrines com os trajes de cada versão, iluminadas por cima, e o pedestal no meio
  [['traje', 58, -25], ['acoEsc', 58, -18.5], ['traje', 58, -12], ['mov', 37, -25], ['traje', 37, -18.5], ['ext', 37, -12]].forEach(([k, u0, v]) => {
    const u1 = u0 + 3, uc = u0 + 1.5;
    box('acoEsc', u0, u1, PISO, 0.5, v - 1.5, v + 1.5); box('ciano', u0 - 0.01, u1 + 0.01, 0.42, 0.46, v - 1.51, v + 1.51);
    box('acoEsc', u0, u1, 3.2, 3.4, v - 1.5, v + 1.5); box('luz', u0 + 0.3, u1 - 0.3, 3.16, 3.2, v - 1.2, v + 1.2);
    manequim(k, uc, v, 0);
    box('vidro', u0 + 0.06, u1 - 0.06, 0.5, 3.2, v - 1.44, v + 1.44);
  });
  cil('acoEsc', 49, PISO + 0.5, -18, 0.9, 1.0, 0, 0, 0, 24); toro('ciano', 49, PISO + 1.0, -18, 0.85, 0.04, PI / 2, 0, 0, 6, 40); esf('cianoPulso', 49, 2.0, -18, 0.35, 1, 1, 1, 2);
  box('acoEsc', 60.98, 61.15, 4.2, 7.6, -20, -10); quad('tela_vel', [60.97, 4.4, -20 + 0.2], [0, 0, 1], [0, 1, 0], 9.6, 3.0, 1, 1, [0, 1, 0, 1]);
  // SALA DA FENDA: o anel estabilizador em pé com a fenda presa dentro (a fenda gira: peça animada), pilares, cabos e consoles
  { const fu = 49, fy = 4.8, fv = 28, R = 4.0;
    toro('ext', fu, fy, fv, R, 0.55, 0, 0, 0, 10, 56); toro('ciano', fu, fy, fv - 0.56, R - 0.3, 0.06, 0, 0, 0, 4, 56); toro('ciano', fu, fy, fv + 0.56, R - 0.3, 0.06, 0, 0, 0, 4, 56);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2 + PI / 8; prim('aco', new G.BoxGeometry(0.7, 1.0, 1.4), fu + Math.cos(a) * R, fy + Math.sin(a) * R, fv, 0, 0, a); }
    prim('cianoPulso', new G.CircleGeometry(R - 0.45, 48), fu, fy, fv - 0.02, 0, 0, 0); prim('cianoPulso', new G.CircleGeometry(R - 0.45, 48), fu, fy, fv + 0.02, 0, PI, 0);
    box('acoEsc', 46.6, 51.4, PISO, 1.2, 26.6, 29.4); box('ciano', 46.58, 51.42, 1.0, 1.06, 26.58, 29.42);
    for (const u of [45, 53]) { box('acoEsc', u - 0.6, u + 0.6, PISO, fy + 0.3, 27.4, 28.6); box('cianoPulso', u - 0.62, u + 0.62, 2.0, 2.15, 27.38, 28.62); box('cianoPulso', u - 0.62, u + 0.62, 3.6, 3.75, 27.38, 28.62); }
    for (const [u0, u1, v0, v1] of [[45.6, 52.4, 25.2, 25.55], [45.6, 52.4, 30.45, 30.8]]) piso('perigo', u0, u1, v0, v1, FA + 0.01, 1.4);
    box('acoEsc', 44, 54, PISO, 0.82, 13, 14.4); box('mov', 43.9, 54.1, 0.82, 1.05, 12.9, 14.5);
    for (const u of [45.5, 49, 52.5]) { box('acoEsc', u - 0.7, u + 0.7, 1.05, 1.95, 13.05, 13.15); quad('tela_onda', [u - 0.66, 1.1, 13.16], [1, 0, 0], [0, 1, 0], 1.32, 0.8, 1, 1, [0, 1, 0, 1]); }
    for (const u of [46, 52]) cil('acoEsc', u, FA + 0.08, 20.3, 0.08, 11.8, PI / 2, 0, 0, 8);
    box('acoEsc', 60.98, 61.15, 3.0, 7.4, 18, 34); quad('tela_energia', [60.97, 3.2, 18.2], [0, 0, 1], [0, 1, 0], 15.6, 4.0, 1, 1, [0, 1, 0, 1]);
    placa('ÁREA RESTRITA', 49, 7.6, 38.95, -1, 2.4, 1.2, 'z'); placa('PERIGO', 42, 3.4, 38.95, -1, 2.4, 1.2, 'z'); }

  // ------------------------------------------------------------------ monta as malhas
  const malhas = {};
  for (const [k, b] of Object.entries(B)) {
    if (!b.p.length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(b.u, 2));
    g.setIndex(new THREE.BufferAttribute(b.i.length > 65000 || b.p.length / 3 > 65000 ? new Uint32Array(b.i) : new Uint16Array(b.i), 1));
    g.computeBoundingSphere(); geos.push(g);
    const m = new THREE.Mesh(g, mat[k]); m.name = `lab-${k}`;
    if (mat[k].transparent) m.renderOrder = 2;
    (k.startsWith('cupula') ? cupula : k.startsWith('torre') ? alto : grupo).add(m); malhas[k] = m;
  }

  // ------------------------------------------------------------------ peças animadas
  const holo = new THREE.Group(); holo.position.set(0, 2.6, 0); grupo.add(holo);
  const mHolo = new THREE.MeshBasicMaterial({ color: 0x3fe0ff, wireframe: true, transparent: true, opacity: 0.55, depthWrite: false }); materiais.push(mHolo);
  const mHoloS = new THREE.MeshBasicMaterial({ color: 0x3fe0ff, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }); materiais.push(mHoloS);
  const hGeos = [new THREE.IcosahedronGeometry(1.0, 2), new THREE.TorusGeometry(1.6, 0.03, 6, 48), new THREE.TorusGeometry(1.25, 0.03, 6, 48), new THREE.CylinderGeometry(1.8, 1.8, 0.02, 40, 1, true)]; geos.push(...hGeos);
  holo.add(new THREE.Mesh(hGeos[0], mHolo)); const an1 = new THREE.Mesh(hGeos[1], mHolo), an2 = new THREE.Mesh(hGeos[2], mHolo); holo.add(an1, an2);
  const cilHolo = new THREE.Mesh(hGeos[3], mHoloS); cilHolo.position.y = -1.45; holo.add(cilHolo);
  { // cidade em miniatura
    const bg = new THREE.BoxGeometry(1, 1, 1); geos.push(bg);
    const cidade = new THREE.InstancedMesh(bg, mHoloS, 28); const mm = new THREE.Matrix4(), pp = new THREE.Vector3(), ss = new THREE.Vector3(), qi = new THREE.Quaternion();
    for (let k = 0; k < 28; k++) { const a = k * 2.399, r = 0.25 + 1.3 * Math.sqrt(k / 28), h = 0.1 + 0.55 * rnd(); pp.set(Math.cos(a) * r, -1.45 + h / 2, Math.sin(a) * r); ss.set(0.16, h, 0.16); mm.compose(pp, qi, ss); cidade.setMatrixAt(k, mm); }
    cidade.frustumCulled = false; holo.add(cidade);
  }
  const dishG = new THREE.Group(); { const [u, v] = TELHADO_COISAS.parabolica; dishG.position.set(u, TOPO + 2.6, v); grupo.add(dishG);
    const dg = new THREE.SphereGeometry(1.6, 24, 10, 0, PI * 2, 0, 1.0); geos.push(dg); const dm = new THREE.Mesh(dg, mat.aco); dm.rotation.x = PI / 2 - 0.5; dm.scale.set(1, 0.5, 1); dishG.add(dm);
    const sg = new THREE.CylinderGeometry(0.03, 0.03, 1.2, 4); geos.push(sg); const sm = new THREE.Mesh(sg, mat.acoEsc); sm.position.set(0, 0.2, 0.6); sm.rotation.x = PI / 2 - 0.5; dishG.add(sm); }
  // o GIROSCÓPIO do Núcleo: três anéis inclinados numa malha só (uma chamada), girando em volta da esfera do reator, e o
  // redemoinho da Fenda (dois braços em espiral, translúcidos) girando dentro do anel
  const juntar = (lista) => {
    const p = [], n = [], u = [], ix = []; let base = 0;
    for (const g of lista) { p.push(...g.attributes.position.array); n.push(...g.attributes.normal.array); u.push(...g.attributes.uv.array); for (const i of g.index.array) ix.push(base + i); base += g.attributes.position.count; g.dispose(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
    g.setIndex(ix); g.computeBoundingSphere(); geos.push(g); return g;
  };
  const giro = new THREE.Mesh(juntar(NUCLEO.aneis.map((R, i) => new THREE.TorusGeometry(R, 0.17, 6, 72).rotateX(PI / 2 + [0.5, -0.35, 0.12][i]).rotateZ([0.35, -0.6, 1.1][i]))), mat.ciano);
  giro.position.set(NUCLEO.u, NUCLEO.esfera.y, NUCLEO.v); giro.name = 'lab-giroscopio'; grupo.add(giro);
  const espiral = (fase) => { const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40, a = fase + t * PI * 3, r = 0.3 + t * 3.1; pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0)); } return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.09 + 0.0, 5, false); };
  const redemoinho = new THREE.Mesh(juntar([espiral(0), espiral(PI)]), mat.portaCela);
  redemoinho.position.set(49, 4.8, 28); redemoinho.renderOrder = 2; redemoinho.name = 'lab-fenda'; grupo.add(redemoinho);
  const beaconG = new THREE.SphereGeometry(0.28, 10, 8); geos.push(beaconG);
  const mBeacon = nevoaLonge(new THREE.MeshBasicMaterial({ color: 0xff3040 })); materiais.push(mBeacon);
  { const [u, v] = TELHADO_COISAS.mastro; const b = new THREE.Mesh(beaconG, mBeacon); b.position.set(u, TOPO + 14.2, v); grupo.add(b); }
  { const b = new THREE.Mesh(beaconG, mBeacon); b.scale.setScalar(2.2); b.position.set((TORRE.u0 + TORRE.u1) / 2, TORRE.coroa.y1 + 26.4, (TORRE.v0 + TORRE.v1) / 2); alto.add(b); }

  // ------------------------------------------------------------------ atualização por quadro
  let acumTela = 0, correia = 0;
  const MAXU = (nome) => nome;
  const atualizar = (dt, tempo, noite = 0, camera = null, jogador = null) => {
    const n = Math.max(0, Math.min(1, noite));
    for (const m of interiores) m.emissiveIntensity = 0.08 + 0.5 * n;
    mat.letreiro.color.setScalar(0.82 + 0.18 * n); mat.logoL.color.setScalar(0.85 + 0.15 * n);
    const pulso = 0.55 + 0.45 * Math.sin(tempo * 2.4);
    mat.cianoPulso.color.setRGB(0.1 + 0.15 * pulso, 0.55 + 0.4 * pulso, 0.75 + 0.25 * pulso);
    mat.vidro.opacity = 0.5 - 0.15 * n; mat.cupulaVidro.opacity = 0.2 - 0.06 * n;
    mat.extJan.emissiveIntensity = mat.torreJan.emissiveIntensity = 1.15 * n;            // à noite parte das janelas acende (luz quente)
    for (const k of ['torreFaixa']) mat[k].color.setRGB(0.36 + 0.2 * n, 0.5 + 0.24 * n, 0.68 + 0.26 * n);   // linhas discretas, um pouco mais vivas à noite
    mBeacon.color.setRGB(Math.sin(tempo * 3) > 0.2 ? 1 : 0.15, 0.1, 0.12);
    // a correia corre na velocidade de quem está nela (uma repetição da textura = 4 m); sem ninguém, devagar
    correia = (correia + dt * (ESTEIRA.kmh != null ? ESTEIRA.kmh / 3.6 / 4 : 0.6)) % 1; T.correia.offset.y = correia;
    holo.rotation.y = tempo * 0.6; an1.rotation.x = tempo * 0.9; an2.rotation.z = -tempo * 1.2; holo.position.y = 2.6 + Math.sin(tempo * 1.4) * 0.06;
    dishG.rotation.y = tempo * 0.35;
    giro.rotation.y = tempo * 0.7; giro.rotation.x = Math.sin(tempo * 0.45) * 0.14;
    redemoinho.rotation.z = -tempo * 1.8;
    acumTela += dt;
    const perto = !jogador || (Math.abs(jogador.x - cx) < 70 && Math.abs(jogador.z - cz) < 70);
    if (perto && acumTela > (ESTEIRA.kmh != null ? 0.1 : opc.intervaloTela ?? 0.2)) { acumTela = 0; TX.redesenhar(tempo); }
  };
  return { grupo, cupula, alto, geos, materiais, atualizar, luzes: [], texturas: TX.texturas };
}
function ROTULOS_CELA(n) { return `CONTENÇÃO 0${n}`; }

/**
 * SILHUETA de longe do S.T.A.R. Labs: só o que é alto (a torre, a coroa, o anel e o mastro) em poucos triângulos, para a torre aparecer de
 * qualquer lugar da cidade (o laboratório de verdade só existe perto: os quarteirões carregam num raio do herói, e o fim da
 * câmera corta o que está além). Fica no lugar de verdade quando cabe na câmera; mais longe, é desenhada mais perto e menor
 * na MESMA direção (o tamanho na tela não muda). A cor mistura com a névoa pela mesma conta da torre de verdade (nevoaDe).
 * atualizar(camera, nevoa, noite, mostrar) → devolve se ficou visível.
 */
export function construirSilhueta(THREE, cx, cz) {
  const grupo = new THREE.Group(); grupo.name = 'silhueta-star-labs';
  const base = new THREE.Group(); grupo.add(base);
  const mCorpo = new THREE.MeshBasicMaterial({ color: 0x1a2846, fog: false });
  const mLuz = new THREE.MeshBasicMaterial({ color: 0x6f90bd, fog: false });
  const mFarol = new THREE.MeshBasicMaterial({ color: 0xff3040, fog: false });
  const geos = [];
  const peca = (g, m, x, y, z, rx = 0) => { geos.push(g); const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.x = rx; o.frustumCulled = false; base.add(o); return o; };
  const T = TORRE, C = T.coroa, tu = (T.u0 + T.u1) / 2, tv = (T.v0 + T.v1) / 2;
  peca(new THREE.BoxGeometry(T.u1 - T.u0, T.y1, T.v1 - T.v0), mCorpo, tu, T.y1 / 2, tv);
  peca(new THREE.BoxGeometry(C.u1 - C.u0, C.y1 - T.y1, C.v1 - C.v0), mCorpo, tu, (T.y1 + C.y1) / 2, tv);
  peca(new THREE.CylinderGeometry(0.5, 0.8, 26, 5), mCorpo, tu, C.y1 + 13, tv);
  peca(new THREE.TorusGeometry(36, 1.6, 5, 48), mCorpo, tu, 120, tv, Math.PI / 2);
  peca(new THREE.TorusGeometry(36, 0.5, 4, 48), mLuz, tu, 121.4, tv, Math.PI / 2);
  peca(new THREE.BoxGeometry(T.u1 - T.u0 + 0.8, 0.6, T.v1 - T.v0 + 0.8), mLuz, tu, T.y1 - 0.8, tv);
  const farol = peca(new THREE.SphereGeometry(1.2, 8, 6), mFarol, tu, C.y1 + 26.4, tv);
  grupo.visible = false;
  const corBase = new THREE.Color(0x1a2846), corLuz = new THREE.Color(), cTmp = new THREE.Color(), V = new THREE.Vector3();
  const centro = new THREE.Vector3(cx + tu, 0, cz + tv);
  function atualizar(camera, nevoa, noite = 0, mostrar = true, tempo = 0) {
    grupo.visible = !!mostrar; if (!mostrar) return false;
    const d = Math.hypot(camera.position.x - centro.x, camera.position.z - centro.z);
    const f = nevoaDe(d, nevoa.near, nevoa.far);
    mCorpo.color.copy(cTmp.copy(corBase).multiplyScalar(1 - 0.45 * noite)).lerp(nevoa.color, f);
    corLuz.setRGB(0.36 + 0.2 * noite, 0.5 + 0.24 * noite, 0.68 + 0.26 * noite); mLuz.color.copy(corLuz).lerp(nevoa.color, f * 0.7);
    mFarol.color.setRGB(Math.sin(tempo * 3) > 0.2 ? 1 : 0.15, 0.1, 0.12).lerp(nevoa.color, f * 0.5);
    // cabe na câmera: no lugar; senão, mais perto e menor na mesma direção (o mesmo ângulo na tela)
    const lim = camera.far * 0.82, k = d > lim ? lim / d : 1;
    V.set(cx, 0, cz).sub(camera.position).multiplyScalar(k).add(camera.position);
    grupo.position.copy(V); grupo.scale.setScalar(k);
    farol.visible = true;
    return true;
  }
  const dispose = () => { geos.forEach((g) => g.dispose()); mCorpo.dispose(); mLuz.dispose(); mFarol.dispose(); };
  return { grupo, atualizar, dispose };
}
