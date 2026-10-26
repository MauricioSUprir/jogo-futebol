// LABORATÓRIOS ESTRELA — o desenho (three.js passado por parâmetro). Interior e exterior a partir do plano de lab.js.
// Tudo é geometria própria juntada por material (poucas chamadas de desenho) + um punhado de peças animadas.
import { PAREDES, SALAS, CELAS, BALCAO, COLUNAS, CONSOLES, MESA_HOLO, TUBO, ANEIS_ACEL, TORRES_ENERGIA, PLATAFORMA_ESTEIRA, ANEL_TELHADO, DOME, TELHADO_COISAS, FRENTE, LAJES, H, TOPO, PISO, PORTA_Y, CAMPUS, TORRE, ALAS, PASSARELAS, ANEL_PRACA, MONUMENTO } from './lab.js';
import { criarTexturas, retanguloRotulo } from './lab-tex.js';

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
  nevoaLonge(bas('torreFaixa', { color: 0x6f90bd }));
  nevoaLonge(bas('torreLetreiro', { map: T.letreiro }));
  bas('faixa', { color: 0x6f90bd });
  std('int', { ...ei(T.parede), roughness: 0.85 }, true);
  std('aco', { color: 0xaab4bd, roughness: 0.32, metalness: 0.85 });
  std('acoEsc', { color: 0x30373f, roughness: 0.45, metalness: 0.7 });
  std('mov', { color: 0xe8edf1, roughness: 0.5, emissive: 0xe8edf1, emissiveIntensity: 0 }, true);
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
  bas('teto', { map: T.teto, color: 0xd2d9df });
  std('vidro', { color: 0x3a5f88, transparent: true, opacity: 0.5, roughness: 0.1, metalness: 0.35, side: THREE.DoubleSide, depthWrite: false });   // um vidro só, azul-marinho translúcido
  std('vidroCela', { color: 0x66e0ff, transparent: true, opacity: 0.2, roughness: 0.05, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false });
  std('cupulaVidro', { color: 0x8cc8ff, transparent: true, opacity: 0.2, roughness: 0.05, metalness: 0.25, side: THREE.DoubleSide, depthWrite: false });
  bas('luz', { color: 0xeaf6ff });
  bas('ciano', { color: 0x3fe0ff });
  bas('cianoPulso', { color: 0x3fe0ff });
  bas('cupulaLuz', { color: 0x3fe0ff });
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
  };
  for (const p of PAREDES) {
    const t = p.t, c0 = p.c - t / 2, c1 = p.c + t / 2;
    const ext = p.ext;
    const keys = (extra) => {
      const K = ['int', 'int', 'ext', 'int', 'int', 'int'];
      if (ext) { const idx = p.eixo === 'x' ? (ext < 0 ? 5 : 4) : (ext < 0 ? 1 : 0); K[idx] = 'ext'; }
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
        bw(cursor, a, PISO, H); rodape(cursor, a);
        bw(a, b, PISO, p.jy[0]); bw(a, b, p.jy[1], H);
        // vidro + montantes de aço
        const vm = (c0 + c1) / 2, vd = 'vidro', mo = ext ? 'acoEsc' : 'aco';
        if (p.eixo === 'x') quad(vd, [a, p.jy[0], vm], [1, 0, 0], [0, 1, 0], b - a, p.jy[1] - p.jy[0], 4); else quad(vd, [vm, p.jy[0], a], [0, 0, 1], [0, 1, 0], b - a, p.jy[1] - p.jy[0], 4);
        const n = Math.max(1, Math.round((b - a) / 3.5));
        for (let k = 0; k <= n; k++) { const s = a + ((b - a) * k) / n; if (p.eixo === 'x') box(mo, s - 0.1, s + 0.1, p.jy[0], p.jy[1], c0 - 0.06, c1 + 0.06); else box(mo, c0 - 0.06, c1 + 0.06, p.jy[0], p.jy[1], s - 0.1, s + 0.1); }
        if (p.eixo === 'x') { box(mo, a, b, p.jy[0] - 0.12, p.jy[0], c0 - 0.1, c1 + 0.1); box(mo, a, b, p.jy[1], p.jy[1] + 0.12, c0 - 0.1, c1 + 0.1); }
        else { box(mo, c0 - 0.1, c1 + 0.1, p.jy[0] - 0.12, p.jy[0], a, b); box(mo, c0 - 0.1, c1 + 0.1, p.jy[1], p.jy[1] + 0.12, a, b); }
        cursor = b;
      }
      bw(cursor, s1, PISO, H); rodape(cursor, s1);
    }
    for (const [s0, s1] of vaos) {
      bw(s0, s1, PORTA_Y, H);
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
  box('faixa', -S - 0.08, S + 0.08, H - 0.1, H + 0.1, -S - 0.08, -S); box('faixa', -S - 0.08, S + 0.08, H - 0.1, H + 0.1, S, S + 0.08);
  box('faixa', -S - 0.08, -S, H - 0.1, H + 0.1, -S, S); box('faixa', S, S + 0.08, H - 0.1, H + 0.1, -S, S);
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
  box('faixa', M.u[0], M.u[1], M.y + 0.5, M.y + 0.6, M.v1, M.v1 + 0.1);
  placa('SAÍDA', 0, M.y - 1.15, M.v1 + 0.31, 1, 2.4, 1.2, 'z');
  { const g = FRENTE.guarita, y0 = PISO;
    box('acoEsc', g.u0, g.u1, y0, g.y1, g.v0, g.v1); box('vidro', g.u0 + 0.05, g.u1 - 0.05, y0 + 1.0, g.y1 - 0.2, g.v0 - 0.02, g.v1 + 0.02);
    box('acoEsc', g.u0 - 0.1, g.u1 + 0.1, g.y1, g.y1 + 0.15, g.v0 - 0.1, g.v1 + 0.1); }
  // canteiros, arbustos e árvores baixas junto do prédio
  for (const lado of [-1, 1]) for (let k = -24; k <= 24; k += 6) {
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
  for (const u of [-4.5, 4.5]) piso('faixa', u - 0.08, u + 0.08, -CM, -S - 1, 0.35, 1);
  for (let v = -CM + 6; v < -S - 2; v += 9) for (const u of [-6.5, 6.5]) { cil('acoEsc', u, 2.2, v, 0.09, 4.2, 0, 0, 0, 8); box('acoEsc', u - 0.3, u + 0.3, 4.3, 4.45, v - 0.3, v + 0.3); box('luz', u - 0.22, u + 0.22, 4.25, 4.3, v - 0.22, v + 0.22); }
  // o acelerador de partículas enterrado: um sulco escuro com uma linha de luz fina, e as tampas de acesso
  { const A = ANEL_PRACA;
    prim('acoEsc', new G.RingGeometry(A.R - A.larg / 2, A.R + A.larg / 2, 160, 1), 0, 0.36, 0, -PI / 2);
    prim('faixa', new G.RingGeometry(A.R - 0.14, A.R + 0.14, 160, 1), 0, 0.375, 0, -PI / 2);
    for (let k = 0; k < 16; k++) { const a = (k / 16) * PI * 2 + PI / 16; prim('pav', new G.BoxGeometry(3.4, 0.1, 2.2), A.R * Math.cos(a), 0.38, A.R * Math.sin(a), 0, -a, 0); } }
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
    faceX('extJan', a.v0, a.v1, PISO, a.y1, a.u0, -1, 8); faceX('extJan', a.v0, a.v1, PISO, a.y1, a.u1, 1, 8);
    box('acoEsc', a.u0 - 0.15, a.u1 + 0.15, PISO, 1.1, a.v0 - 0.15, a.v1 + 0.15);
    for (const u of [a.u0, a.u1]) for (const v of [a.v0, a.v1]) box('ext', u - 0.8, u + 0.8, PISO, a.y1 + 1.2, v - 0.8, v + 0.8);
    piso('telhado', a.u0, a.u1, a.v0, a.v1, a.y1 + 0.02, 8);
    box('ext', a.u0, a.u1, a.y1, a.y1 + 1, a.v0, a.v0 + 0.5); box('ext', a.u0, a.u1, a.y1, a.y1 + 1, a.v1 - 0.5, a.v1);
    box('ext', a.u0, a.u0 + 0.5, a.y1, a.y1 + 1, a.v0, a.v1); box('ext', a.u1 - 0.5, a.u1, a.y1, a.y1 + 1, a.v0, a.v1);
    box('faixa', a.u0 - 0.06, a.u1 + 0.06, a.y1 - 0.4, a.y1 - 0.25, a.v0 - 0.06, a.v0);
    const um = (a.u0 + a.u1) / 2; faceZ('logoL', um - 8.3, um + 8.3, a.y1 - 13, a.y1 - 3, a.v0 - 0.05, -1, 1, [0, 1, 0, 1]);
    for (const [du, dv] of [[0.3, 0.25], [0.7, 0.55], [0.4, 0.8]]) { const u = a.u0 + (a.u1 - a.u0) * du, v = a.v0 + (a.v1 - a.v0) * dv; box('acoEsc', u - 2.2, u + 2.2, a.y1, a.y1 + 1.6, v - 1.6, v + 1.6); }
  }
  // passarelas envidraçadas no alto (por baixo delas se passa)
  for (const p of PASSARELAS) {
    box(['extJan', 'extJan', 'telhado', 'acoEsc', 'extJan', 'extJan'], p.u0, p.u1, p.y0, p.y1, p.v0, p.v1, 8);
    const lz = p.u1 - p.u0 > p.v1 - p.v0;
    if (lz) { box('faixa', p.u0, p.u1, p.y0 - 0.02, p.y0 + 0.1, p.v0 - 0.05, p.v0); box('faixa', p.u0, p.u1, p.y0 - 0.02, p.y0 + 0.1, p.v1, p.v1 + 0.05); }
    else { box('faixa', p.u0 - 0.05, p.u0, p.y0 - 0.02, p.y0 + 0.1, p.v0, p.v1); box('faixa', p.u1, p.u1 + 0.05, p.y0 - 0.02, p.y0 + 0.1, p.v0, p.v1); }
  }
  // TORRE principal (a peça que se vê de longe; materiais com a névoa fraca): janelas em fita, pilastras nos cantos, a coroa,
  // o letreiro e o emblema no alto, o ANEL em volta do topo preso por quatro braços e o mastro com a luz vermelha
  const TR = TORRE, TC = TR.coroa, tcu = (TR.u0 + TR.u1) / 2, tcv = (TR.v0 + TR.v1) / 2;
  faceZ('torreJan', TR.u0, TR.u1, PISO, TR.y1, TR.v0, -1, 8); faceZ('torreJan', TR.u0, TR.u1, PISO, TR.y1, TR.v1, 1, 8);
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
  box('acoEsc', -10, 10, 5.2, 5.6, TR.v0 - 5, TR.v0); box('luz', -9.6, 9.6, 5.16, 5.2, TR.v0 - 4.6, TR.v0 - 0.3);
  quad('vidro', [-8, PISO, TR.v0 - 0.06], [1, 0, 0], [0, 1, 0], 16, 4.6, 4);

  // ------------------------------------------------------------------ TELHADO do prédio principal (em TOPO)
  for (const [a, b, c, d] of LAJES) piso('telhado', a, b, c, d, TOPO + 0.02, 8);
  box('ext', -S, S, TOPO, TOPO + 1, -S, -S + 0.5); box('ext', -S, S, TOPO, TOPO + 1, S - 0.5, S); box('ext', -S, -S + 0.5, TOPO, TOPO + 1, -S + 0.5, S - 0.5); box('ext', S - 0.5, S, TOPO, TOPO + 1, -S + 0.5, S - 0.5);
  box('faixa', -S, S, TOPO + 1, TOPO + 1.06, -S, -S + 0.5); box('faixa', -S, S, TOPO + 1, TOPO + 1.06, S - 0.5, S);
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
    toro('cupulaLuz', 0, cy + D.R * Math.cos(0.75), 0, D.R * Math.sin(0.75), 0.1, PI / 2, 0, 0, 8, 64);
    toro('cupulaLuz', 0, cy + D.R * Math.cos(0.42), 0, D.R * Math.sin(0.42), 0.08, PI / 2, 0, 0, 8, 64);
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
  placa('ALTA ENERGIA', 0, 3.6, 25.9, -1, 2.4, 1.2, 'x'); placa('ÁREA RESTRITA', 0, 3.6, 25.9, -1, 2.4, 1.2, 'x');

  // ------------------------------------------------------------------ ESTEIRA
  { const P = PLATAFORMA_ESTEIRA;
    box('acoEsc', P.u0 - 0.1, P.u1 + 0.1, PISO, P.y1 - 0.02, P.v0 - 0.4, P.v1 + 0.4);
    quad('correia', [P.u0, P.y1, P.v1], [1, 0, 0], [0, 0, -1], P.u1 - P.u0, P.v1 - P.v0, 2.5, 2.5);
    for (const u of [P.u0 - 0.1, P.u1 + 0.1]) { box('aco', u - 0.08, u + 0.08, PISO, 1.2, P.v0, P.v1); box('ciano', u - 0.09, u + 0.09, 1.2, 1.26, P.v0, P.v1); for (const v of [P.v0, P.v1]) box('aco', u - 0.1, u + 0.1, PISO, 1.3, v - 0.08, v + 0.08); }
    box('acoEsc', P.u0 + 1.2, P.u0 + 3.2, PISO, 1.0, P.v1 + 0.5, P.v1 + 1.3); box('luz', P.u0 + 1.25, P.u0 + 3.15, 1.0, 1.04, P.v1 + 0.55, P.v1 + 1.25); }
  for (const v of [-7.5, 0, 7.5]) { box('aco', E.u[0], E.u[1], 6.6, 6.9, v - 0.15, v + 0.15); box('luz', E.u[0] + 0.3, E.u[1] - 0.3, 6.55, 6.6, v - 0.08, v + 0.08); for (const u of [E.u[0] + 0.5, E.u[1] - 0.5]) cil('aco', u, 3.3, v, 0.1, 6.6, 0, 0, 0, 8); }
  for (const v of [-10, -5, 0, 5, 10]) for (const u of [E.u[0] + 0.4, E.u[1] - 0.4]) { box('acoEsc', u - 0.12, u + 0.12, PISO, 2.2, v - 0.12, v + 0.12); esf('cianoPulso', u, 2.3, v, 0.14, 1, 1, 1, 1); }
  for (const [v0, v1] of [[-11.5, -4.5], [4.5, 11.5]]) { box('acoEsc', -13.7, -13.54, 2.85, 7.15, v0 - 0.15, v1 + 0.15); quad('tela_vel', [-13.52, 3.0, v1], [0, 0, -1], [0, 1, 0], v1 - v0, 4.0, 1, 1, [0, 1, 0, 1]); }
  [0, 5, 10, 15, 20, 25].forEach((m, i) => { const v = -12.5 + m; const nome = `${m} m`; if (v <= 12.4) { box('luz', -25.95, -25.9, 0.8, 2.4, v - 0.04, v + 0.04); placa(nome, v + 1.0, 1.2, -25.9, 1, 1.2, 0.6, 'x'); } });
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
  placa('ACELERADOR', 0, 5.5, 25.95, -1, 3.6, 1.8, 'z'); placa('ALTA ENERGIA', -12, 3.2, 25.95, -1, 2.4, 1.2, 'z'); placa('ÁREA RESTRITA', 12, 3.2, 25.95, -1, 2.4, 1.2, 'z');
  for (const u of [-22, -10, 10, 22]) { box('luz', u - 0.1, u + 0.1, 12.6, 12.9, 14.0, 26.0); }
  for (const v of [14.5, 25.5]) box('cianoPulso', -25.5, 25.5, 0.36, 0.44, v - 0.04, v + 0.04);

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
  const beaconG = new THREE.SphereGeometry(0.28, 10, 8); geos.push(beaconG);
  const mBeacon = nevoaLonge(new THREE.MeshBasicMaterial({ color: 0xff3040 })); materiais.push(mBeacon);
  { const [u, v] = TELHADO_COISAS.mastro; const b = new THREE.Mesh(beaconG, mBeacon); b.position.set(u, TOPO + 14.2, v); grupo.add(b); }
  { const b = new THREE.Mesh(beaconG, mBeacon); b.scale.setScalar(2.2); b.position.set((TORRE.u0 + TORRE.u1) / 2, TORRE.coroa.y1 + 26.4, (TORRE.v0 + TORRE.v1) / 2); alto.add(b); }

  // ------------------------------------------------------------------ atualização por quadro
  let acumTela = 0;
  const MAXU = (nome) => nome;
  const atualizar = (dt, tempo, noite = 0, camera = null, jogador = null) => {
    const n = Math.max(0, Math.min(1, noite));
    for (const m of interiores) m.emissiveIntensity = 0.08 + 0.5 * n;
    mat.letreiro.color.setScalar(0.82 + 0.18 * n); mat.logoL.color.setScalar(0.85 + 0.15 * n);
    const pulso = 0.55 + 0.45 * Math.sin(tempo * 2.4);
    mat.cianoPulso.color.setRGB(0.1 + 0.15 * pulso, 0.55 + 0.4 * pulso, 0.75 + 0.25 * pulso);
    mat.cupulaLuz.color.setRGB(0.15, 0.6 + 0.3 * Math.sin(tempo * 1.7), 0.9);
    mat.vidro.opacity = 0.5 - 0.15 * n; mat.cupulaVidro.opacity = 0.2 - 0.06 * n;
    mat.extJan.emissiveIntensity = mat.torreJan.emissiveIntensity = 1.15 * n;            // à noite parte das janelas acende (luz quente)
    for (const k of ['faixa', 'torreFaixa']) mat[k].color.setRGB(0.36 + 0.2 * n, 0.5 + 0.24 * n, 0.68 + 0.26 * n);   // linhas discretas, um pouco mais vivas à noite
    mBeacon.color.setRGB(Math.sin(tempo * 3) > 0.2 ? 1 : 0.15, 0.1, 0.12);
    T.correia.offset.y = (tempo * 0.6) % 1;
    holo.rotation.y = tempo * 0.6; an1.rotation.x = tempo * 0.9; an2.rotation.z = -tempo * 1.2; holo.position.y = 2.6 + Math.sin(tempo * 1.4) * 0.06;
    dishG.rotation.y = tempo * 0.35;
    acumTela += dt;
    const perto = !jogador || (Math.abs(jogador.x - cx) < 70 && Math.abs(jogador.z - cz) < 70);
    if (perto && acumTela > (opc.intervaloTela ?? 0.2)) { acumTela = 0; TX.redesenhar(tempo); }
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
