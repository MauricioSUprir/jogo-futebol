import * as THREE from 'three';
import { CELL, BLOCO, N, MEIO, CALCADA, bloco, celulaDe, centroDe, dentro, todasEsferas, retangulosPerto, chaoEm, empurrar } from './cidade.js';
import { criarHeroi } from './humano.js';
import { FACHADA_M, TELHADO_M, CALCADA_M, GRAMA_M, criarFachadas, criarLojas, texturaTelhado, texturaCalcada, texturaGrama, texturaAsfalto, texturaCopa } from './texturas.js';

// ---------- constantes ----------
const TOQUE = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const RAIO_CARGA = TOQUE ? 3 : 4;                 // quarteirões carregados em volta (Chebyshev)
const CORPO = { raio: 0.45, alt: 1.8 };
const MOV = { andar: 15, correr: 58, gravidade: 36, pulo: 14.5, puloCorrendo: 19, puloDuplo: 12.5, planeio: 7, giro: 12, escalar: 36, escalaMin: 24, escalaMax: 40, vibrarMin: 12 };
const ENERGIA = { gasto: 0.17, parede: 0.2, vibrar: 0.28, recarga: 0.05, esfera: 0.3 };
const DIA_SEGUNDOS = 480;
const CAM = { dist: 6.6, alvoY: 1.7, pitch: 0.32 };

// ---------- util ----------
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const suave = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const $ = (id) => document.getElementById(id);
const el = {
  corpo: document.body, cena: $('cena'), esferas: $('esferas'), total: $('total'), vel: $('vel'), hora: $('hora'), nivel: $('nivel'),
  aviso: $('aviso'), seta: $('seta'), dist: $('distEsfera'), mapa: $('mapa'), mapaBox: $('mapaBox'),
  inicio: $('telaInicio'), pausa: $('telaPausa'), fim: $('telaFim'), fimTexto: $('fimTexto'), btnJogar: $('btnJogar'), carga: $('barraCargaI'), carregando: $('carregando'),
};
if (TOQUE) el.corpo.classList.add('toque');

// ---------- renderizador, cena, céu ----------
const renderer = new THREE.WebGLRenderer({ canvas: el.cena, antialias: !TOQUE, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, TOQUE ? 1.75 : 2));
const cena = new THREE.Scene();
cena.fog = new THREE.Fog(0xbfdcff, 110, RAIO_CARGA * CELL * 0.92);
const camera = new THREE.PerspectiveCamera(62, 1, 0.2, RAIO_CARGA * CELL + 160);
const ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());

const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x403830, 1);
const sol = new THREE.DirectionalLight(0xffffff, 1.5);
cena.add(hemi, sol, sol.target);

const matCeu = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { topo: { value: new THREE.Color(0x4b8fe8) }, horizonte: { value: new THREE.Color(0xbfdcff) }, sol: { value: new THREE.Vector3(0, 1, 0) }, brilho: { value: new THREE.Color(0xffe8b0) } },
  vertexShader: 'varying vec3 vd; void main(){ vd = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 topo; uniform vec3 horizonte; uniform vec3 sol; uniform vec3 brilho; varying vec3 vd; void main(){ float h = clamp(vd.y, 0.0, 1.0); vec3 c = mix(horizonte, topo, pow(h, 0.6)); float s = max(dot(normalize(vd), sol), 0.0); c += brilho * (pow(s, 600.0) * 2.0 + pow(s, 14.0) * 0.28); gl_FragColor = vec4(c, 1.0); }',
});
const ceu = new THREE.Mesh(new THREE.SphereGeometry(RAIO_CARGA * CELL + 120, 32, 16), matCeu);
ceu.renderOrder = -10; cena.add(ceu);
const estrelasPos = new Float32Array(500 * 3);
for (let i = 0; i < 500; i++) { const a = Math.random() * 6.283, e = 0.08 + Math.random() * 1.45, r = RAIO_CARGA * CELL + 100; estrelasPos[i * 3] = Math.cos(a) * Math.cos(e) * r; estrelasPos[i * 3 + 1] = Math.sin(e) * r; estrelasPos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r; }
const estrelasGeo = new THREE.BufferGeometry(); estrelasGeo.setAttribute('position', new THREE.BufferAttribute(estrelasPos, 3));
const estrelas = new THREE.Points(estrelasGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.7, sizeAttenuation: false, fog: false, transparent: true, opacity: 0, depthWrite: false }));
cena.add(estrelas);

// oceano em volta da cidade
const mar = new THREE.Mesh(new THREE.PlaneGeometry(20000, 20000), new THREE.MeshLambertMaterial({ color: 0x1d4e7a }));
mar.rotation.x = -Math.PI / 2; mar.position.y = -2.5; cena.add(mar);

// ---------- ciclo de dia e noite ----------
const PALETAS = {
  noite: { topo: 0x03040c, horizonte: 0x101a35, hemiCeu: 0x2a3a6a, hemiChao: 0x232a40, hemi: 1.15, sol: 0x8aa0e0, solInt: 0.6, neblina: 0x0d1530 },
  crepusculo: { topo: 0x2c3a7a, horizonte: 0xff8f5e, hemiCeu: 0x9a8fb8, hemiChao: 0x3a2a30, hemi: 0.8, sol: 0xff9a60, solInt: 1.0, neblina: 0xc4795a },
  dia: { topo: 0x4b8fe8, horizonte: 0xc6e0ff, hemiCeu: 0xcfe2ff, hemiChao: 0x6a6258, hemi: 1.05, sol: 0xfff4de, solInt: 1.7, neblina: 0xbcd8f5 },
};
const tmpA = new THREE.Color(), tmpB = new THREE.Color();
function misturar(alvo, ca, cb, t) { tmpA.setHex(ca); tmpB.setHex(cb); alvo.copy(tmpA).lerp(tmpB, t); }
const mundo = { T: 0.4, elev: 1, noite: 0 };
const materiaisFachada = [];            // para acender as janelas à noite

function atualizarAmbiente(posCam) {
  const ang = (mundo.T - 0.25) * Math.PI * 2;
  const dir = new THREE.Vector3(Math.cos(ang) * 0.35, Math.sin(ang), Math.cos(ang) * 0.93).normalize();
  const elev = dir.y; mundo.elev = elev;
  // blend: noite (< -0.1) → crepúsculo (~0) → dia (> 0.3)
  const a = suave(-0.18, 0.02, elev), b = suave(0.04, 0.38, elev);
  const P = PALETAS;
  const mist = (campo, alvo) => { misturar(alvo, P.noite[campo], P.crepusculo[campo], a); tmpB.copy(alvo); tmpA.setHex(P.dia[campo]); alvo.copy(tmpB).lerp(tmpA, b); };
  const mistN = (campo) => lerp(lerp(P.noite[campo], P.crepusculo[campo], a), P.dia[campo], b);
  mist('topo', matCeu.uniforms.topo.value); mist('horizonte', matCeu.uniforms.horizonte.value);
  mist('neblina', cena.fog.color); mist('hemiCeu', hemi.color); mist('hemiChao', hemi.groundColor); mist('sol', sol.color);
  hemi.intensity = mistN('hemi'); sol.intensity = mistN('solInt') * (elev > -0.05 ? 1 : 0.4);
  // à noite a "luz do sol" vira a lua, do lado oposto
  const dl = elev > -0.05 ? dir : dir.clone().multiplyScalar(-1);
  sol.position.copy(posCam).addScaledVector(dl, 200); sol.target.position.copy(posCam);
  matCeu.uniforms.sol.value.copy(dir); matCeu.uniforms.brilho.value.setHex(elev > 0.1 ? 0xffe8b0 : 0xff9a60).multiplyScalar(suave(-0.12, 0.05, elev));
  ceu.position.copy(posCam); estrelas.position.copy(posCam);
  mundo.noite = 1 - suave(-0.15, 0.12, elev);
  estrelas.material.opacity = clamp(mundo.noite * 1.2, 0, 1);
  const lit = mundo.noite * 1.0;
  for (const m of materiaisFachada) m.emissiveIntensity = lit;
  matLampada.color.setRGB(0.55 + 0.45 * lit, 0.5 + 0.43 * lit, 0.38 + 0.3 * lit); cena.environmentIntensity = 0.15 + 0.85 * (1 - mundo.noite);
  renderer.setClearColor(cena.fog.color);
}

// ---------- materiais e texturas ----------
const fachadas = criarFachadas(ANISO), lojas = criarLojas(ANISO);
const TONS = [0xffffff, 0xe9dfcc, 0xcfd9ea];
const matFachada = [];
for (let k = 0; k < fachadas.length; k++) {
  matFachada.push(TONS.map((c) => {
    const vidro = k === 0;
    const m = new THREE.MeshStandardMaterial({ map: fachadas[k].mapa, color: c, emissive: 0xffffff, emissiveMap: fachadas[k].emissiva, emissiveIntensity: 0,
      bumpMap: fachadas[k].mapa, bumpScale: vidro ? 0.4 : 1.6, roughness: vidro ? 0.18 : 0.82, metalness: vidro ? 0.55 : 0.05, envMapIntensity: vidro ? 1.3 : 0.25 });
    materiaisFachada.push(m); return m;
  }));
}
const matLoja = lojas.map((t) => { const m = new THREE.MeshStandardMaterial({ map: t.mapa, emissive: 0xffffff, emissiveMap: t.emissiva, emissiveIntensity: 0, roughness: 0.55, metalness: 0.1, bumpMap: t.mapa, bumpScale: 1.2 }); materiaisFachada.push(m); return m; });
const texTelhado = texturaTelhado(ANISO);
const matTelhado = new THREE.MeshStandardMaterial({ map: texTelhado, bumpMap: texTelhado, bumpScale: 1.5, roughness: 0.95, metalness: 0 });
const texCalcada = texturaCalcada(ANISO); texCalcada.repeat.set(BLOCO / CALCADA_M, BLOCO / CALCADA_M);
const texGrama = texturaGrama(ANISO); texGrama.repeat.set(BLOCO / GRAMA_M, BLOCO / GRAMA_M);
const matMeioFio = new THREE.MeshStandardMaterial({ color: 0x8a8d93, roughness: 0.9 });
const matCalcada = new THREE.MeshStandardMaterial({ map: texCalcada, bumpMap: texCalcada, bumpScale: 1.2, roughness: 0.9 });
const matGrama = new THREE.MeshStandardMaterial({ map: texGrama, roughness: 1 });
const texAsfalto = texturaAsfalto(ANISO); texAsfalto.wrapS = texAsfalto.wrapT = THREE.RepeatWrapping; texAsfalto.repeat.set(N, N);
const matAsfalto = new THREE.MeshStandardMaterial({ map: texAsfalto, roughness: 0.85, metalness: 0.05 });
const matProps = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.35 });
const matCopa = new THREE.MeshStandardMaterial({ map: texturaCopa(), roughness: 1 });
const matLampada = new THREE.MeshBasicMaterial({ color: 0xffe9b0 });

// o asfalto é um plano só para a cidade inteira (a textura de uma célula se repete N × N)
const asfaltoGeral = new THREE.Mesh(new THREE.PlaneGeometry(N * CELL, N * CELL), matAsfalto); asfaltoGeral.rotation.x = -Math.PI / 2; cena.add(asfaltoGeral);

// reflexo do céu nos vidros: ambiente gerado do próprio céu (de dia); a intensidade cai à noite
{
  const pm = new THREE.PMREMGenerator(renderer), cs = new THREE.Scene();
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { topo: { value: new THREE.Color(0x4b8fe8) }, horizonte: { value: new THREE.Color(0xe4efff) } }, vertexShader: 'varying vec3 vd; void main(){ vd = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }', fragmentShader: 'uniform vec3 topo; uniform vec3 horizonte; varying vec3 vd; void main(){ float h = vd.y; vec3 c = h > 0.0 ? mix(horizonte, topo, pow(h, 0.5)) : mix(horizonte, vec3(0.28,0.27,0.26), clamp(-h*3.0, 0.0, 1.0)); gl_FragColor = vec4(c, 1.0); }' });
  cs.add(new THREE.Mesh(new THREE.SphereGeometry(50, 24, 12), m));
  cena.environment = pm.fromScene(cs, 0.02).texture; pm.dispose();
}

// ---------- baldes de geometria: uma malha por material em cada quarteirão ----------
class Balde {
  constructor(cor = false) { this.pos = []; this.nor = []; this.uv = []; this.col = cor ? [] : null; this.idx = []; this.n = 0; }
  quad(p, nx, ny, nz, u, v, c) {
    for (let k = 0; k < 4; k++) { this.pos.push(p[k][0], p[k][1], p[k][2]); this.nor.push(nx, ny, nz); this.uv.push(k === 1 || k === 2 ? u : 0, k >= 2 ? v : 0); if (this.col) this.col.push(c[0], c[1], c[2]); }
    this.idx.push(this.n, this.n + 1, this.n + 2, this.n, this.n + 2, this.n + 3); this.n += 4;
  }
  geo(g, m, c) {                                   // anexa uma BufferGeometry transformada (m: Matrix4 só com rotação/escala uniforme em xz)
    const p = g.attributes.position, nn = g.attributes.normal, uv = g.attributes.uv, ix = g.index, v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3().getNormalMatrix(m);
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m); this.pos.push(v.x, v.y, v.z); n.fromBufferAttribute(nn, i).applyMatrix3(nm).normalize(); this.nor.push(n.x, n.y, n.z); this.uv.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0); if (this.col) this.col.push(c[0], c[1], c[2]); }
    if (ix) for (let i = 0; i < ix.count; i++) this.idx.push(this.n + ix.getX(i)); else for (let i = 0; i < p.count; i++) this.idx.push(this.n + i);
    this.n += p.count;
  }
  gerar() {
    if (!this.n) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.col) g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere(); return g;
  }
}
const geoCaixa = new THREE.BoxGeometry(1, 1, 1), geoCil = new THREE.CylinderGeometry(1, 1, 1, 8), geoCopaBase = new THREE.IcosahedronGeometry(1, 1), geoCone = new THREE.ConeGeometry(1, 1, 8);
const M4 = new THREE.Matrix4(), Q4 = new THREE.Quaternion(), V4 = new THREE.Vector3(), S4 = new THREE.Vector3(), UPV = new THREE.Vector3(0, 1, 0);
const compor = (x, y, z, sx, sy, sz, rot = 0) => M4.compose(V4.set(x, y, z), Q4.setFromAxisAngle(UPV, rot), S4.set(sx, sy, sz));
const rgb = (c) => [c[0] / 255, c[1] / 255, c[2] / 255];

// faces de um prédio (y0..y1): quatro laterais com a textura da fachada em ladrilhos inteiros; o topo no balde do telhado
function lote(lat, topo, loja, l) {
  const { x0, x1, y0, y1, z0, z1 } = l, h = y1 - y0, w = x1 - x0, d = z1 - z0;
  const nu = (m) => Math.max(1, Math.round(m / FACHADA_M)), nv = Math.max(1, Math.round(h / FACHADA_M));
  lat.quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], 1, 0, 0, nu(d), nv);
  lat.quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], -1, 0, 0, nu(d), nv);
  lat.quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], 0, 0, 1, nu(w), nv);
  lat.quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], 0, 0, -1, nu(w), nv);
  topo.quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], 0, 1, 0, Math.max(1, w / TELHADO_M), Math.max(1, d / TELHADO_M));
  if (loja) {                                                   // térreo comercial: 5 m de vitrines um pouco à frente da fachada
    const e = 0.12, ya = y0, yb = y0 + 5, a0 = x0 - e, a1 = x1 + e, b0 = z0 - e, b1 = z1 + e, un = (m) => Math.max(1, Math.round(m / 16));
    loja.quad([[a1, ya, b1], [a1, ya, b0], [a1, yb, b0], [a1, yb, b1]], 1, 0, 0, un(d), 1);
    loja.quad([[a0, ya, b0], [a0, ya, b1], [a0, yb, b1], [a0, yb, b0]], -1, 0, 0, un(d), 1);
    loja.quad([[a0, ya, b1], [a1, ya, b1], [a1, yb, b1], [a0, yb, b1]], 0, 0, 1, un(w), 1);
    loja.quad([[a1, ya, b0], [a0, ya, b0], [a0, yb, b0], [a1, yb, b0]], 0, 0, -1, un(w), 1);
    topo.quad([[a0, yb, b1], [a1, yb, b1], [a1, yb, b0], [a0, yb, b0]], 0, 1, 0, Math.max(1, (a1 - a0) / TELHADO_M), Math.max(1, (b1 - b0) / TELHADO_M));   // marquise
  }
}

// ---------- quarteirões carregados ----------
const carregados = new Map();      // chave -> {grupo, geos, orbes:[{o,mesh}], instancias}
const esferasColetadas = new Set();
const orbesAtivos = [];
const geoOrbe = new THREE.IcosahedronGeometry(0.42, 1), geoHalo = new THREE.SphereGeometry(0.75, 12, 8);
const matOrbe = new THREE.MeshBasicMaterial({ color: 0x3fd0ff }), matHalo = new THREE.MeshBasicMaterial({ color: 0x3fd0ff, transparent: true, opacity: 0.25, depthWrite: false, fog: false });
const matFeixe = new THREE.MeshBasicMaterial({ color: 0x3fd0ff, transparent: true, opacity: 0.18, depthWrite: false });
const geoFeixe = new THREE.CylinderGeometry(0.12, 0.12, 60, 6); geoFeixe.translate(0, 30, 0);

const geoLajeTopo = new THREE.PlaneGeometry(BLOCO, BLOCO); geoLajeTopo.rotateX(-Math.PI / 2); geoLajeTopo.translate(0, CALCADA, 0);
const geoMeioFio = (() => { const g = new THREE.BoxGeometry(BLOCO, CALCADA, BLOCO); g.translate(0, CALCADA / 2, 0); const ix = g.index.array, keep = []; for (let i = 0; i < ix.length; i += 3) { if (Math.floor(ix[i] / 4) !== 2 && Math.floor(ix[i] / 4) !== 3) keep.push(ix[i], ix[i + 1], ix[i + 2]); } g.setIndex(keep); g.clearGroups(); return g; })();
const PRETO = [0.08, 0.08, 0.09], CINZA = [0.5, 0.52, 0.55], CINZA_ESC = [0.25, 0.26, 0.28], TRONCO = [0.34, 0.24, 0.17], VIDRO = [0.07, 0.1, 0.15];

function construirBloco(b) {
  const grupo = new THREE.Group(), geos = [], dados = { grupo, geos, orbes: [], instancias: [] };
  const topoLaje = new THREE.Mesh(geoLajeTopo, b.tipo === 'parque' ? matGrama : matCalcada); topoLaje.position.set(b.cx, 0, b.cz); grupo.add(topoLaje);
  const baldes = new Map(), pega = (k, cor) => { if (!baldes.has(k)) baldes.set(k, new Balde(cor)); return baldes.get(k); };
  const props = pega('props', true), roof = pega('roof'), copas = pega('copas'), lamp = pega('lamp');
  // meio-fio entra no balde dos adereços (um desenho a menos): quatro faixas finas
  for (const [x, z, sx, sz] of [[0, -BLOCO / 2 + 0.2, BLOCO, 0.4], [0, BLOCO / 2 - 0.2, BLOCO, 0.4], [-BLOCO / 2 + 0.2, 0, 0.4, BLOCO], [BLOCO / 2 - 0.2, 0, 0.4, BLOCO]]) props.geo(geoCaixa, compor(b.cx + x, CALCADA / 2, b.cz + z, sx, CALCADA, sz), [0.5, 0.51, 0.53]);
  for (const l of b.lotes) {
    const lat = pega(`l${l.estilo}-${l.tom}`);
    const loja = l.y0 <= CALCADA + 0.01 && l.x1 - l.x0 > 8 ? pega(`loja${(Math.abs(b.i * 7 + b.j * 3 + Math.round(l.x0)) % 3)}`) : null;
    lote(lat, roof, loja, l);
  }
  for (const t of b.topo) {
    if (t.t === 'caixa') { props.geo(geoCaixa, compor(t.x, t.y + t.h / 2, t.z, t.w, t.h, t.d), CINZA); props.geo(geoCaixa, compor(t.x, t.y + t.h + 0.06, t.z, t.w + 0.1, 0.12, t.d + 0.1), CINZA_ESC); }
    else if (t.t === 'tanque') { props.geo(geoCil, compor(t.x, t.y + t.h / 2, t.z, t.w, t.h, t.w), [0.55, 0.4, 0.28]); props.geo(geoCone, compor(t.x, t.y + t.h + 0.35, t.z, t.w * 1.05, 0.7, t.w * 1.05), CINZA_ESC); }
    else { props.geo(geoCil, compor(t.x, t.y + t.h / 2, t.z, 0.07, t.h, 0.07), CINZA); lamp.geo(geoCaixa, compor(t.x, t.y + t.h, t.z, 0.28, 0.28, 0.28), null); }
  }
  for (const a of b.arvores) {
    props.geo(geoCil, compor(a.x, CALCADA + 1.3 * a.s, a.z, 0.2 * a.s, 2.6 * a.s, 0.2 * a.s), TRONCO);
    copas.geo(geoCopaBase, compor(a.x, CALCADA + 3.9 * a.s, a.z, 1.7 * a.s, 1.55 * a.s, 1.7 * a.s, (a.x * 7.3) % 6.28), null);
  }
  for (const c of b.carros) {                                   // carros: carroceria, cabine, vidros e rodas
    const cr = rgb(c.cor), co = c.rot, ca = Math.cos(co), sa = Math.sin(co), at = (u, w) => [c.x + u * ca + w * sa, c.z - u * sa + w * ca];
    props.geo(geoCaixa, compor(c.x, 0.62, c.z, 4.3, 0.72, 1.85, co), cr);
    const [cx, cz] = at(-0.2, 0); props.geo(geoCaixa, compor(cx, 1.2, cz, 2.2, 0.62, 1.6, co), VIDRO);
    props.geo(geoCaixa, compor(cx, 1.5, cz, 2.0, 0.08, 1.5, co), cr);
    for (const [u, w] of [[1.4, 0.92], [1.4, -0.92], [-1.4, 0.92], [-1.4, -0.92]]) { const [wx, wz] = at(u, w); props.geo(geoCil, compor(wx, 0.34, wz, 0.34, 0.26, 0.34, co + Math.PI / 2), PRETO); }
    const [fx, fz] = at(2.17, 0.62), [gx, gz] = at(2.17, -0.62); lamp.geo(geoCaixa, compor(fx, 0.75, fz, 0.1, 0.16, 0.34, co), null); lamp.geo(geoCaixa, compor(gx, 0.75, gz, 0.1, 0.16, 0.34, co), null);
  }
  for (const p of b.postes) {                                   // poste de luz com braço sobre a rua
    props.geo(geoCil, compor(p.x, CALCADA + 3.6, p.z, 0.11, 7.2, 0.11), CINZA_ESC);
    const dx = p.lado === 0 ? 0 : -1.1, dz = p.lado === 0 ? -1.1 : 0;
    props.geo(geoCaixa, compor(p.x + dx * 0.5, CALCADA + 7.2, p.z + dz * 0.5, p.lado === 0 ? 0.1 : 1.2, 0.1, p.lado === 0 ? 1.2 : 0.1), CINZA_ESC);
    lamp.geo(geoCaixa, compor(p.x + dx, CALCADA + 7.1, p.z + dz, p.lado === 0 ? 0.5 : 0.7, 0.12, p.lado === 0 ? 0.7 : 0.5), null);
  }
  for (const [k, bd] of baldes) {
    const g = bd.gerar(); if (!g) continue; geos.push(g);
    let mat;
    if (k === 'props') mat = matProps; else if (k === 'roof') mat = matTelhado; else if (k === 'copas') mat = matCopa; else if (k === 'lamp') mat = matLampada;
    else if (k.startsWith('loja')) mat = matLoja[+k.slice(4)];
    else { const [e, t] = k.slice(1).split('-').map(Number); mat = matFachada[e][t]; }
    const m = new THREE.Mesh(g, mat); grupo.add(m);
  }
  for (const o of b.orbes) {
    if (esferasColetadas.has(o.id)) continue;
    const g = new THREE.Group(); g.add(new THREE.Mesh(geoOrbe, matOrbe), new THREE.Mesh(geoHalo, matHalo));
    if (o.y < 3) { const f = new THREE.Mesh(geoFeixe, matFeixe); f.position.y = -1.2; g.add(f); }
    g.position.set(o.x, o.y, o.z); grupo.add(g);
    const reg = { o, mesh: g }; dados.orbes.push(reg); orbesAtivos.push(reg);
  }
  cena.add(grupo);
  return dados;
}
function descarregar(chave) {
  const d = carregados.get(chave); if (!d) return;
  cena.remove(d.grupo); d.geos.forEach((g) => g.dispose()); d.instancias.forEach((i) => i.dispose());
  for (const r of d.orbes) { const k = orbesAtivos.indexOf(r); if (k >= 0) orbesAtivos.splice(k, 1); }
  carregados.delete(chave);
}
function desejados(ci, cj, raio) {
  const v = [];
  for (let i = ci - raio; i <= ci + raio; i++) for (let j = cj - raio; j <= cj + raio; j++) if (dentro(i, j)) v.push([i, j, Math.max(Math.abs(i - ci), Math.abs(j - cj)) + Math.hypot(i - ci, j - cj) * 0.01]);
  return v.sort((a, b) => a[2] - b[2]);
}
let celAtual = [-999, -999];
function atualizarQuarteiroes(x, z, orcamento) {
  const ci = celulaDe(x), cj = celulaDe(z);
  if (ci !== celAtual[0] || cj !== celAtual[1]) {
    celAtual = [ci, cj];
    for (const [k, d] of carregados) { const [i, j] = k.split(',').map(Number); if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) > RAIO_CARGA + 1) descarregar(k); }
    rectsPerto = retangulosPerto(x, z, 1);
  }
  let feitos = 0;
  for (const [i, j] of desejados(ci, cj, RAIO_CARGA)) {
    const k = `${i},${j}`; if (carregados.has(k)) continue;
    carregados.set(k, construirBloco(bloco(i, j)));
    if (++feitos >= orcamento) break;
  }
  return feitos;
}
let rectsPerto = [];

// ---------- herói (fictício) ----------
const heroi = new THREE.Group(); const partes = {};
{
  const vermelho = new THREE.MeshStandardMaterial({ color: 0xd9172b, roughness: 0.45, metalness: 0.2, emissive: 0x330005 });
  const ouro = new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.3, metalness: 0.5, emissive: 0x6a4a00 });
  const pele = new THREE.MeshStandardMaterial({ color: 0xe0b08a, roughness: 0.7 });
  const corpo = new THREE.Group(); heroi.add(corpo); partes.corpo = corpo;
  const tronco = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.5, 4, 10), vermelho); tronco.position.y = 1.15; tronco.scale.set(1.05, 1, 0.7); corpo.add(tronco);
  const cinto = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.1, 12), ouro); cinto.position.y = 0.88; cinto.scale.set(1.05, 1, 0.72); corpo.add(cinto);
  const raio = new THREE.Shape(); raio.moveTo(0.06, 0.2); raio.lineTo(-0.1, -0.02); raio.lineTo(0, -0.02); raio.lineTo(-0.06, -0.2); raio.lineTo(0.1, 0.02); raio.lineTo(0, 0.02); raio.closePath();
  const emb = new THREE.Mesh(new THREE.ShapeGeometry(raio), new THREE.MeshBasicMaterial({ color: 0xffd23f, side: THREE.DoubleSide })); emb.position.set(0, 1.25, 0.25); corpo.add(emb);
  const cabeca = new THREE.Group(); cabeca.position.y = 1.85; corpo.add(cabeca);
  cabeca.add(new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), vermelho));
  const rosto = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 8, 0, Math.PI * 2, 0.5, 1.3), pele); rosto.position.set(0, -0.04, 0.1); rosto.scale.set(1, 0.8, 0.7); cabeca.add(rosto);
  for (const l of [-1, 1]) {
    const asa = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.32, 5), ouro); asa.position.set(l * 0.25, 0.05, -0.02); asa.rotation.set(0.2, 0, -l * 1.15); cabeca.add(asa);
    const olho = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.025, 0.02), new THREE.MeshBasicMaterial({ color: 0xffffff })); olho.position.set(l * 0.075, 0.0, 0.205); cabeca.add(olho);
  }
  const membro = (x, y, comp, rm, mat, bota) => {
    const pivo = new THREE.Group(); pivo.position.set(x, y, 0);
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(rm, comp, 3, 8), mat); m.position.y = -comp / 2 - rm / 2; pivo.add(m);
    if (bota) { const b = new THREE.Mesh(new THREE.BoxGeometry(rm * 2, rm * 1.6, rm * 3), ouro); b.position.set(0, -comp - rm * 0.9, rm * 0.5); pivo.add(b); }
    corpo.add(pivo); return pivo;
  };
  partes.pernaE = membro(-0.16, 0.85, 0.5, 0.13, vermelho, true); partes.pernaD = membro(0.16, 0.85, 0.5, 0.13, vermelho, true);
  partes.bracoE = membro(-0.42, 1.5, 0.45, 0.1, vermelho, false); partes.bracoD = membro(0.42, 1.5, 0.45, 0.1, vermelho, false);
}
cena.add(heroi);
let modelo = null;
criarHeroi({ aniso: ANISO, lod: TOQUE ? 2 : 1 }).then((m) => { modelo = m; partes.corpo.visible = false; heroi.add(m.grupo); }).catch((e) => console.warn('corpo realista indisponível', e));
const sombra = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
sombra.rotation.x = -Math.PI / 2; cena.add(sombra);

// rastro de raios (partículas em coordenadas do mundo)
const RASTRO_N = 160;
const rPos = new Float32Array(RASTRO_N * 3), rVel = new Float32Array(RASTRO_N * 3), rVida = new Float32Array(RASTRO_N);
const rGeo = new THREE.BufferGeometry(); rGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3));
const bolinha = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,230,120,0.8)'); gr.addColorStop(1, 'rgba(255,200,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
const rastro = new THREE.Points(rGeo, new THREE.PointsMaterial({ map: bolinha, color: 0xffe066, size: 0.55, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
rastro.frustumCulled = false; cena.add(rastro);
let rIdx = 0;
for (let k = 0; k < RASTRO_N; k++) rPos[k * 3 + 1] = -100;
function emitir(x, y, z, n, v) {
  for (let i = 0; i < n; i++) {
    const k = rIdx++ % RASTRO_N;
    rPos[k * 3] = x + (Math.random() - 0.5) * 0.7; rPos[k * 3 + 1] = y + (Math.random() - 0.5) * 1.6; rPos[k * 3 + 2] = z + (Math.random() - 0.5) * 0.7;
    rVel[k * 3] = (Math.random() - 0.5) * 2; rVel[k * 3 + 1] = Math.random() * 2; rVel[k * 3 + 2] = (Math.random() - 0.5) * 2;
    rVida[k] = 0.25 + Math.random() * 0.5;
  }
}
function passoRastro(dt) {
  for (let k = 0; k < RASTRO_N; k++) {
    if (rVida[k] <= 0) { rPos[k * 3 + 1] = -100; continue; }
    rVida[k] -= dt; rPos[k * 3] += rVel[k * 3] * dt; rPos[k * 3 + 1] += rVel[k * 3 + 1] * dt; rPos[k * 3 + 2] += rVel[k * 3 + 2] * dt;
  }
  rGeo.attributes.position.needsUpdate = true;
}

// ---------- estado ----------
const P = { x: 0, y: 0, z: 0, vx: 0, vz: 0, vy: 0, h: 0, noChao: true, pulos: 0, energia: 0.6, correndo: false, fase: 0, t: 0, parede: null, vibrando: false };
const C = { yaw: 0, pitch: CAM.pitch, dist: CAM.dist };
const J = { modo: 'menu', coletadas: 0, total: 0, aviso: 0, inicioT: 0, alinhar: 0 };
const teclas = new Set();
const stick = { x: 0, y: 0 };
const toque = { correr: false, vibrar: false };
let pedidoPulo = false;
let esferas = [];

function reiniciar() {
  esferasColetadas.clear();
  for (const k of [...carregados.keys()]) descarregar(k);
  celAtual = [-999, -999];
  Object.assign(P, { x: 0, y: 0, z: 0, vx: 0, vz: 0, vy: 0, h: 0, noChao: true, pulos: 0, energia: 0.6, parede: null, vibrando: false });
  C.yaw = 0; C.pitch = CAM.pitch;
  J.coletadas = 0; J.modo = 'jogando'; J.inicioT = performance.now();
  mundo.T = 0.4;
  atualizarQuarteiroes(P.x, P.z, 999);
  esconderTelas(); el.corpo.classList.add('jogando');
  el.esferas.textContent = '0';
  if (!TOQUE) pedirCaptura();
}
function esconderTelas() { el.inicio.hidden = el.pausa.hidden = el.fim.hidden = true; }
function avisar(txt) { el.aviso.textContent = txt; el.aviso.style.opacity = '1'; J.aviso = 1.4; }

// ---------- entrada ----------
function pedirCaptura() { try { el.cena.requestPointerLock?.(); } catch { /* sem captura */ } }
let tinhaCaptura = false;
document.addEventListener('pointerlockchange', () => {
  const tem = document.pointerLockElement === el.cena;
  if (!tem && tinhaCaptura && J.modo === 'jogando') { J.modo = 'pausa'; el.pausa.hidden = false; }
  tinhaCaptura = tem;
});
el.cena.addEventListener('click', () => { if (J.modo === 'jogando' && !TOQUE && document.pointerLockElement !== el.cena) pedirCaptura(); });
$('btnContinuar').addEventListener('click', () => { J.modo = 'jogando'; el.pausa.hidden = true; if (!TOQUE) pedirCaptura(); });
$('btnJogar').addEventListener('click', reiniciar);
$('btnDeNovo').addEventListener('click', reiniciar);

addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
  if (e.repeat) return;
  teclas.add(k);
  if (k === ' ') pedidoPulo = true;
  else if (k === 'm') el.mapaBox.classList.toggle('grande');
  else if (k === 'h') mundo.T = (mundo.T + 0.08) % 1;
  else if (k === 'enter' && J.modo === 'menu' && !el.btnJogar.hidden) reiniciar();
});
addEventListener('keyup', (e) => teclas.delete(e.key.toLowerCase()));
addEventListener('blur', () => teclas.clear());
function girar(dx, dy, kx, ky) { C.yaw -= dx * kx; C.pitch = clamp(C.pitch + dy * ky, -0.25, 1.35); }
addEventListener('mousemove', (e) => { if (J.modo !== 'jogando') return; if (document.pointerLockElement === el.cena || e.buttons) girar(e.movementX, e.movementY, 0.0028, 0.0024); });

// toque: joystick à esquerda, arrastar para olhar, botões
if (TOQUE) {
  const caixa = $('stick'), bola = $('stickBola'); let idStick = null, idOlhar = null, ult = null;
  const alvoStick = (e) => { const r = caixa.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2); const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; } stick.x = Math.abs(dx) < 0.12 ? 0 : dx; stick.y = Math.abs(dy) < 0.12 ? 0 : -dy; bola.style.transform = `translate(${dx * 38}px,${dy * 38}px)`; };
  caixa.addEventListener('pointerdown', (e) => { idStick = e.pointerId; caixa.setPointerCapture(e.pointerId); alvoStick(e); });
  caixa.addEventListener('pointermove', (e) => { if (e.pointerId === idStick) alvoStick(e); });
  const soltaStick = (e) => { if (e.pointerId !== idStick) return; idStick = null; stick.x = stick.y = 0; bola.style.transform = ''; };
  caixa.addEventListener('pointerup', soltaStick); caixa.addEventListener('pointercancel', soltaStick);
  addEventListener('pointerdown', (e) => { if (J.modo !== 'jogando' || e.target.closest('#stick,.bt,button,.tela')) return; idOlhar = e.pointerId; ult = [e.clientX, e.clientY]; });
  addEventListener('pointermove', (e) => { if (e.pointerId !== idOlhar || !ult) return; girar(e.clientX - ult[0], e.clientY - ult[1], 0.006, 0.0045); ult = [e.clientX, e.clientY]; });
  const soltaOlhar = (e) => { if (e.pointerId === idOlhar) { idOlhar = null; ult = null; } };
  addEventListener('pointerup', soltaOlhar); addEventListener('pointercancel', soltaOlhar);
  const bt = (id, ao, solta) => { const b = $(id); b.addEventListener('pointerdown', (e) => { e.stopPropagation(); b.setPointerCapture(e.pointerId); b.classList.add('ativo'); ao(); }); const s = () => { b.classList.remove('ativo'); solta?.(); }; b.addEventListener('pointerup', s); b.addEventListener('pointercancel', s); };
  bt('btVibrar', () => { toque.vibrar = true; }, () => { toque.vibrar = false; });
  bt('btCorrer', () => { toque.correr = true; }, () => { toque.correr = false; });
  bt('btPular', () => { pedidoPulo = true; teclas.add(' '); }, () => teclas.delete(' '));
}

// ---------- física do herói ----------
function entradaMov() {
  let ix = (teclas.has('d') ? 1 : 0) - (teclas.has('a') ? 1 : 0) + (teclas.has('arrowright') ? 1 : 0) - (teclas.has('arrowleft') ? 1 : 0);
  let iz = (teclas.has('w') ? 1 : 0) - (teclas.has('s') ? 1 : 0) + (teclas.has('arrowup') ? 1 : 0) - (teclas.has('arrowdown') ? 1 : 0);
  if (stick.x || stick.y) { ix = stick.x; iz = stick.y; }
  const m = Math.hypot(ix, iz); if (m > 1) { ix /= m; iz /= m; }
  return { ix, iz, m: Math.min(1, m) };
}

function passoHeroi(dt) {
  const { ix, iz, m } = entradaMov();
  const fx = Math.sin(C.yaw), fz = Math.cos(C.yaw), rx = -fz, rz = fx;
  const dx = fx * iz + rx * ix, dz = fz * iz + rz * ix;
  const querCorrer = (teclas.has('shift') || toque.correr) && (m > 0.1 || P.parede);
  P.correndo = querCorrer && P.energia > 0.02;
  const vh0 = Math.hypot(P.vx, P.vz);
  // vibração: atravessa prédios e objetos (precisa de velocidade para começar e de energia para continuar)
  const querVibrar = teclas.has('v') || toque.vibrar;
  const dentroSolido = P.vibrando && estaDentroDeSolido();
  if (P.vibrando) { if ((!querVibrar && !dentroSolido) || P.energia <= 0.001) { P.vibrando = false; } }
  else if (querVibrar && P.energia > 0.08 && vh0 >= MOV.vibrarMin && !P.parede) { P.vibrando = true; avisar('VIBRANDO — atravesse tudo'); }
  if (P.vibrando) P.energia = Math.max(0, P.energia - ENERGIA.vibrar * dt);
  else if (P.correndo) P.energia = Math.max(0, P.energia - (P.parede ? ENERGIA.parede : ENERGIA.gasto) * dt);
  else P.energia = Math.min(1, P.energia + ENERGIA.recarga * dt * (m < 0.1 ? 3 : 1));
  const vmax = ((P.correndo || P.vibrando) ? MOV.correr : MOV.andar) * m;
  const taxa = P.noChao ? (P.correndo ? 5 : 11) : 2.2;
  const k = 1 - Math.exp(-taxa * dt);
  if (!P.parede) { P.vx += (dx * vmax - P.vx) * k; P.vz += (dz * vmax - P.vz) * k; }

  // pulo, pulo duplo e planeio
  if (pedidoPulo) {
    pedidoPulo = false;
    if (P.parede) { desprender(true, dx, dz); }
    else if (P.noChao) { P.vy = P.correndo ? MOV.puloCorrendo : MOV.pulo; P.noChao = false; P.pulos = 1; }
    else if (P.pulos < 2) { P.vy = MOV.puloDuplo; P.pulos = 2; }
  }
  const planando = teclas.has(' ') && !P.noChao && !P.parede && P.vy < 0;

  const vh = Math.hypot(P.vx, P.vz);
  const veloc = P.parede ? P.parede.v : vh;
  const n = Math.max(1, Math.ceil(Math.max(veloc * dt / 0.6, Math.abs(P.vy) * dt / 0.5)));
  const sub = dt / n;
  for (let s = 0; s < n; s++) {
    if (P.parede) { escalarPasso(sub, ix, rx, rz); if (P.parede) continue; }
    P.vy -= (planando ? 8 : MOV.gravidade) * sub; if (planando) P.vy = Math.max(P.vy, -MOV.planeio);
    const ox = P.x, oz = P.z;
    P.x += P.vx * sub; P.z += P.vz * sub; P.y += P.vy * sub;
    const lim = MEIO - 4; P.x = clamp(P.x, -lim, lim); P.z = clamp(P.z, -lim, lim);
    if (!P.vibrando) {
      const r = empurrar(rectsPerto, P.x, P.z, CORPO.raio, P.y, CORPO.alt);
      if (r.bateu) {
        const antes = Math.hypot(P.vx, P.vz), vx0 = P.vx, vz0 = P.vz;
        P.x = r.x; P.z = r.z; P.vx = (P.x - ox) / sub * 0.98; P.vz = (P.z - oz) / sub * 0.98;
        const depois = Math.hypot(P.vx, P.vz); if (depois > antes) { P.vx *= antes / depois; P.vz *= antes / depois; }
        // de frente para a parede de um prédio, em velocidade: começa a escalar
        if (r.q && r.q.y0 > 0 && P.correndo && antes >= MOV.escalar && (r.nx * vx0 + r.nz * vz0) / (antes || 1) <= -0.55 && P.y < r.q.y1 - 1.2 && P.energia > 0.05) {
          P.parede = { nx: r.nx, nz: r.nz, q: r.q, v: clamp(antes * 0.85, MOV.escalaMin, MOV.escalaMax) };
          P.vx = P.vz = 0; P.vy = 0; P.noChao = false; P.pulos = 1; J.alinhar = 0.8; avisar('ESCALANDO');
          break;
        }
      }
    }
    const chao = chaoEm(rectsPerto, P.x, P.z, P.y);
    if (P.y <= chao && P.vy <= 0) { P.y = chao; P.vy = 0; P.noChao = true; P.pulos = 0; }
    else if (P.y > chao + 0.06) P.noChao = false;
  }
  // direção do corpo
  if (!P.parede && vh > 1.2) { const alvo = Math.atan2(P.vx, P.vz); let d = alvo - P.h; d = Math.atan2(Math.sin(d), Math.cos(d)); P.h += d * (1 - Math.exp(-MOV.giro * dt)); }
  P.t += dt;
}

function estaDentroDeSolido() {
  for (const q of rectsPerto) { if (q.y0 < 0) continue; if (P.x > q.x0 && P.x < q.x1 && P.z > q.z0 && P.z < q.z1 && P.y + 0.9 > q.y0 && P.y + 0.9 < q.y1) return true; }
  return false;
}

// escalada: o herói corre para cima pela parede (de lado para o chão), até o telhado
function escalarPasso(sub, ix, rx, rz) {
  const w = P.parede, q = w.q;
  if (!(teclas.has('shift') || toque.correr) || P.energia <= 0.02) { desprender(false); return; }
  const tx = -w.nz, tz = w.nx, lado = ix * ((rx * tx + rz * tz) >= 0 ? 1 : -1) * 9;
  P.x += tx * lado * sub; P.z += tz * lado * sub; P.y += w.v * sub;
  // continua colado: o ponto mais perto do retângulo tem que estar a ~raio; senão acabou a parede
  const px = clamp(P.x, q.x0, q.x1), pz = clamp(P.z, q.z0, q.z1);
  const ddx = P.x - px, ddz = P.z - pz, d = Math.hypot(ddx, ddz);
  if (d > CORPO.raio + 0.5) { desprender(false); return; }
  if (d > 1e-6) { w.nx = ddx / d; w.nz = ddz / d; P.x = px + w.nx * CORPO.raio; P.z = pz + w.nz * CORPO.raio; }
  P.h = Math.atan2(-w.nx, -w.nz);
  if (P.y >= q.y1 - 0.05) {                           // chegou ao topo: sobe no telhado
    P.y = q.y1; P.x -= w.nx * (CORPO.raio + 1.1); P.z -= w.nz * (CORPO.raio + 1.1);
    P.vx = -w.nx * 7; P.vz = -w.nz * 7; P.vy = 0; P.noChao = true; P.pulos = 0; P.parede = null;
    avisar('NO TOPO');
  }
}
function desprender(salto, dx = 0, dz = 0) {
  const w = P.parede; if (!w) return;
  P.parede = null;
  P.vx = w.nx * (salto ? 12 : 3) + (salto ? dx * 6 : 0); P.vz = w.nz * (salto ? 12 : 3) + (salto ? dz * 6 : 0);
  P.vy = salto ? 17 : Math.min(8, w.v * 0.3); P.noChao = false; P.pulos = 1;
}

function esferasProximas(dt) {
  for (let i = orbesAtivos.length - 1; i >= 0; i--) {
    const r = orbesAtivos[i], o = r.o;
    r.mesh.position.y = o.y + Math.sin(P.t * 3 + o.x) * 0.25; r.mesh.rotation.y += dt * 2;
    if (Math.abs(o.x - P.x) < 2.8 && Math.abs(o.z - P.z) < 2.8 && Math.abs(o.y - (P.y + 0.9)) < 2.6) {
      esferasColetadas.add(o.id); J.coletadas++; P.energia = Math.min(1, P.energia + ENERGIA.esfera);
      const grupo = r.mesh.parent; if (grupo) grupo.remove(r.mesh);
      for (const d of carregados.values()) { const k = d.orbes.indexOf(r); if (k >= 0) d.orbes.splice(k, 1); }
      orbesAtivos.splice(i, 1);
      el.esferas.textContent = J.coletadas; avisar(`ESFERA ${J.coletadas} / ${J.total}`);
      if (J.coletadas >= J.total) fimDeJogo();
    }
  }
}
function fimDeJogo() {
  J.modo = 'fim'; document.exitPointerLock?.();
  const s = Math.round((performance.now() - J.inicioT) / 1000);
  el.fimTexto.textContent = `Você recolheu as ${J.total} esferas de energia em ${Math.floor(s / 60)} min ${s % 60} s.`;
  el.corpo.classList.remove('jogando'); el.fim.hidden = false;
}

// ---------- animação do herói ----------
const mBase = new THREE.Matrix4(), vTmp = new THREE.Vector3(), vTmp2 = new THREE.Vector3(), vUp = new THREE.Vector3(0, 1, 0), vY = new THREE.Vector3(0, 1, 0), qAlvo = new THREE.Quaternion();
function animarHeroi(dt) {
  const v = Math.hypot(P.vx, P.vz), amp = clamp(v / 10, 0, 1), forte = clamp((v - 15) / 40, 0, 1);
  if (modelo) {
    const vv = P.parede ? P.parede.v : v;
    modelo.aplicar({ v: vv, noChao: P.noChao, planando: teclas.has(' ') && !P.noChao && P.vy < 0, parede: !!P.parede, vibrando: P.vibrando }, dt);
    modelo.setVisivelProfundo(P.vibrando && estaDentroDeSolido());
  }
  P.fase += dt * (4 + v * 0.55);
  const s = Math.sin(P.fase), p = partes;
  if (modelo) {
    // orientação: no chão, pelo rumo; na parede, os pés na parede e a cabeça para fora (corre para o alto)
    if (P.parede) { const w = P.parede; heroi.position.set(P.x - w.nx * (CORPO.raio - 0.06), P.y, P.z - w.nz * (CORPO.raio - 0.06)); mBase.makeBasis(vTmp.set(-w.nz, 0, w.nx), vTmp2.set(w.nx, 0, w.nz), vUp); qAlvo.setFromRotationMatrix(mBase); }
    else { heroi.position.set(P.x, P.y, P.z); qAlvo.setFromAxisAngle(vY, P.h); }
    heroi.quaternion.slerp(qAlvo, 1 - Math.exp(-(P.parede ? 12 : 30) * dt));
  } else {
  const alvoInc = P.noChao ? 0.12 + forte * 1.0 : 0.25 + forte * 0.5;
  p.corpo.rotation.x = lerp(p.corpo.rotation.x, alvoInc, 0.2);
  p.corpo.position.y = P.noChao ? Math.abs(Math.cos(P.fase)) * 0.09 * amp : 0;
  if (P.noChao) {
    const sw = (0.25 + 0.95 * amp) * (1 + forte * 0.4);
    p.pernaE.rotation.x = s * sw; p.pernaD.rotation.x = -s * sw;
    p.bracoE.rotation.x = -s * sw * 1.1; p.bracoD.rotation.x = s * sw * 1.1;
  } else {
    p.pernaE.rotation.x = lerp(p.pernaE.rotation.x, -0.9, 0.25); p.pernaD.rotation.x = lerp(p.pernaD.rotation.x, 0.55, 0.25);
    const planando = teclas.has(' ') && P.vy < 0;
    p.bracoE.rotation.x = lerp(p.bracoE.rotation.x, planando ? 0 : -2.2, 0.25); p.bracoD.rotation.x = lerp(p.bracoD.rotation.x, planando ? 0 : 0.6, 0.25);
    if (planando) { p.bracoE.rotation.z = lerp(p.bracoE.rotation.z, 1.3, 0.2); p.bracoD.rotation.z = lerp(p.bracoD.rotation.z, -1.3, 0.2); }
  }
  if (P.noChao || !teclas.has(' ')) { p.bracoE.rotation.z = lerp(p.bracoE.rotation.z, 0, 0.2); p.bracoD.rotation.z = lerp(p.bracoD.rotation.z, 0, 0.2); }
  heroi.position.set(P.x, P.y, P.z); heroi.rotation.y = P.h; }
  // sombra no chão logo abaixo
  const chao = chaoEm(rectsPerto, P.x, P.z, P.y + 40, 40);
  sombra.position.set(P.x, Math.min(chao, P.y) + 0.04, P.z); const e = clamp(1 - (P.y - chao) / 25, 0.25, 1); sombra.scale.setScalar(e); sombra.visible = !P.parede;
  if (v > 18) emitir(P.x - Math.sin(P.h) * 0.5, P.y + 1, P.z - Math.cos(P.h) * 0.5, Math.min(6, Math.floor(v / 14)), v);
  passoRastro(dt);
}

// ---------- câmera ----------
function dentroDeSolido(x, y, z) {
  for (const q of rectsPerto) { if (q.y0 < 0) continue; if (x > q.x0 - 0.3 && x < q.x1 + 0.3 && z > q.z0 - 0.3 && z < q.z1 + 0.3 && y > q.y0 - 0.3 && y < q.y1 + 0.3) return true; }
  return false;
}
function atualizarCamera(dt) {
  const v = Math.hypot(P.vx, P.vz);
  const alvo = new THREE.Vector3(P.x, P.y + CAM.alvoY, P.z);
  const cp = Math.cos(C.pitch), sp = Math.sin(C.pitch), fx = Math.sin(C.yaw), fz = Math.cos(C.yaw);
  const distIdeal = CAM.dist + clamp(v - 15, 0, 45) * 0.07;
  let t = 1;
  if (P.parede && J.alinhar > 0) { J.alinhar -= dt; let d = P.h - C.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); C.yaw += d * (1 - Math.exp(-3 * dt)); }
  for (; t > 0.15 && !P.vibrando; t -= 0.07) { const d = distIdeal * t; if (!dentroDeSolido(alvo.x - fx * cp * d, alvo.y + sp * d, alvo.z - fz * cp * d)) break; }
  const dAlvo = distIdeal * Math.max(t, 0.15);
  C.dist = dAlvo < C.dist ? dAlvo : lerp(C.dist, dAlvo, 1 - Math.exp(-6 * dt));
  camera.position.set(alvo.x - fx * cp * C.dist, Math.max(0.6, alvo.y + sp * C.dist), alvo.z - fz * cp * C.dist);
  camera.lookAt(alvo);
  const fovAlvo = 62 + clamp(v - 15, 0, 45) * 0.38;
  camera.fov = lerp(camera.fov, fovAlvo, 1 - Math.exp(-4 * dt)); camera.updateProjectionMatrix();
}

// ---------- minimapa e bússola ----------
const gm = el.mapa.getContext('2d');
let quadroMapa = 0, ultBussola = 0;
function desenharMapa() {
  const grande = el.mapaBox.classList.contains('grande');
  const W = el.mapa.width, H = el.mapa.height;
  const raioM = grande ? 1250 : 210, ppm = (W / 2) / raioM;
  gm.setTransform(1, 0, 0, 1, 0, 0); gm.fillStyle = '#26303f'; gm.fillRect(0, 0, W, H);
  const fx = Math.sin(C.yaw), fz = Math.cos(C.yaw), rx = -fz, rz = fx;
  gm.setTransform(rx * ppm, -fx * ppm, rz * ppm, -fz * ppm, W / 2, H / 2);
  gm.translate(-P.x, -P.z);
  const ci = celulaDe(P.x), cj = celulaDe(P.z), rc = Math.ceil(raioM / CELL) + 1;
  for (let i = ci - rc; i <= ci + rc; i++) for (let j = cj - rc; j <= cj + rc; j++) {
    if (!dentro(i, j)) continue;
    const b = bloco(i, j), q = b.rects[0];
    gm.fillStyle = b.tipo === 'parque' ? '#3d7a3d' : '#59647a'; gm.fillRect(q.x0, q.z0, q.x1 - q.x0, q.z1 - q.z0);
    for (const l of b.lotes) { const c = Math.min(230, 120 + l.y1 * 0.9) | 0; gm.fillStyle = `rgb(${c},${c},${Math.min(255, c + 12)})`; gm.fillRect(l.x0, l.z0, l.x1 - l.x0, l.z1 - l.z0); }
  }
  gm.fillStyle = '#3fd0ff'; const rr = grande ? 14 : 6;
  for (const o of esferas) if (!esferasColetadas.has(o.id) && Math.abs(o.x - P.x) < raioM * 1.1 && Math.abs(o.z - P.z) < raioM * 1.1) { gm.beginPath(); gm.arc(o.x, o.z, rr, 0, 6.3); gm.fill(); }
  gm.setTransform(1, 0, 0, 1, 0, 0);
  const sx = Math.sin(P.h) * rx + Math.cos(P.h) * rz, sy = -(Math.sin(P.h) * fx + Math.cos(P.h) * fz);
  gm.translate(W / 2, H / 2); gm.rotate(Math.atan2(sx, -sy));
  gm.fillStyle = '#ff2b3d'; gm.strokeStyle = '#fff'; gm.lineWidth = 2; gm.beginPath(); gm.moveTo(0, -11); gm.lineTo(8, 9); gm.lineTo(0, 5); gm.lineTo(-8, 9); gm.closePath(); gm.fill(); gm.stroke();
}
function atualizarBussola() {
  let melhor = null, md = Infinity;
  for (const o of esferas) { if (esferasColetadas.has(o.id)) continue; const d = Math.hypot(o.x - P.x, o.z - P.z); if (d < md) { md = d; melhor = o; } }
  if (!melhor) { el.dist.textContent = '—'; return; }
  const fx = Math.sin(C.yaw), fz = Math.cos(C.yaw), dx = melhor.x - P.x, dz = melhor.z - P.z;
  const sx = dx * -fz + dz * fx, sy = dx * fx + dz * fz;
  el.seta.style.transform = `rotate(${Math.atan2(sx, sy)}rad)`;
  el.dist.textContent = md >= 1000 ? `${(md / 1000).toFixed(1)} km` : `${Math.round(md)} m`;
}

// ---------- laço ----------
const relogio = new THREE.Clock();
function quadro() {
  requestAnimationFrame(quadro);
  const dt = Math.min(relogio.getDelta(), 0.05);
  if (J.modo === 'jogando') {
    mundo.T = (mundo.T + dt / DIA_SEGUNDOS) % 1;
    passoHeroi(dt); esferasProximas(dt);
    atualizarQuarteiroes(P.x, P.z, carregados.size < 30 ? 8 : 2);
    if (J.aviso > 0) { J.aviso -= dt; if (J.aviso <= 0) el.aviso.style.opacity = '0'; }
    el.vel.textContent = Math.round((P.parede ? P.parede.v : Math.hypot(P.vx, P.vz)) * 3.6);
    el.vel.parentElement.style.color = Math.hypot(P.vx, P.vz) >= MOV.escalar || P.parede ? '#ffd23f' : '';
    el.nivel.style.width = `${(P.energia * 100).toFixed(1)}%`;
    const h = Math.floor(mundo.T * 24), mi = Math.floor((mundo.T * 24 - h) * 60);
    el.hora.textContent = `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
    if ((quadroMapa++ % 4) === 0) desenharMapa();
    ultBussola += dt; if (ultBussola > 0.2) { ultBussola = 0; atualizarBussola(); }
  }
  if (J.modo !== 'menu' || carregados.size) { animarHeroi(J.modo === 'jogando' ? dt : 0); atualizarCamera(dt); }
  atualizarAmbiente(camera.position);
  renderer.render(cena, camera);
}

function redimensionar() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', redimensionar); redimensionar();

// ---------- carga inicial ----------
esferas = todasEsferas(); J.total = esferas.length; el.total.textContent = J.total;
P.x = 0; P.z = 0; heroi.position.set(0, 0, 0);
camera.position.set(0, 4, -8);
(async function carregar() {
  atualizarQuarteiroes(0, 0, 0);
  const lista = desejados(celulaDe(0), celulaDe(0), RAIO_CARGA);
  let feitos = 0;
  for (const [i, j] of lista) {
    const k = `${i},${j}`; if (!carregados.has(k)) carregados.set(k, construirBloco(bloco(i, j)));
    if (++feitos % 6 === 0) { el.carga.style.width = `${(feitos / lista.length) * 100}%`; await new Promise((r) => setTimeout(r, 0)); }
  }
  rectsPerto = retangulosPerto(0, 0, 1);
  el.carga.style.width = '100%'; el.carregando.hidden = true; $('barraCarga').hidden = true; el.btnJogar.hidden = false;
  // câmera de vitrine: sobe devagar olhando a avenida
  C.yaw = 0.5; C.pitch = 0.5;
  renderer.compile(cena, camera);
})();
requestAnimationFrame(quadro);

window.__rel = { renderer, P, C, J, CAM, get modelo() { return modelo; }, teclas, stick, reiniciar, carregados, orbesAtivos, esferasColetadas, mundo, desenharMapa, get rects() { return rectsPerto; } };
