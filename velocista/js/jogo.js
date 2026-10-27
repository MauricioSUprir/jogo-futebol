import * as THREE from 'three';
import { CELL, BLOCO, N, MEIO, CALCADA, LAB_CELULA, bloco, celulaDe, centroDe, dentro, ehCampus, todasEsferas, retangulosPerto, chaoEm, empurrar } from './cidade.js';
import { criarHeroi } from './humano.js';
import { criarRaios, definirCameraRaios } from './raios.js';
import { criarPosFx } from './posfx.js';
import { iniciarAtualizacao } from './atualizar.js';
import { criarMissoes, MISSOES } from './missoes.js';
import { criarCrimes } from './crimes.js';
import { criarPortais } from './portais.js';
import { criarTrafego } from './trafego.js';
import { criarPedestres } from './pedestres.js';
import { criarCombate, ESPECIAIS } from './combate.js';
import { criarGuia } from './guia.js';
import { criarViloes } from './viloes.js';
import { criarHistoria } from './historia.js';
import { criarEquipe } from './equipe.js';
import { criarTempo } from './tempo.js';
import { construirLab, construirSilhueta } from './lab3d.js';
import { CAMPUS, TORRE, ALAS, LAB, PLATAFORMA_ESTEIRA } from './lab.js';
import { ESTEIRA } from './lab-tex.js';
import { MARCOS, limitar, PONTE, ILHA, PRESIDIO, pontoMundo, SUBESTACOES } from './marcos.js';
import { criarAliados } from './aliados.js';
import { criarContencao } from './contencao.js';
import { criarRivais } from './rivais.js';
import { desenharMarco, blocoIlha, desenharFora } from './marcos3d.js';
import { INTERIORES, Y0 as Y_INT, noGatilhoFora, noGatilhoDentro } from './interiores.js';
import { construirInterior } from './interiores3d.js';
import { criarVida } from './vida.js';
import { salasAtrasDasJanelas } from './janelas.js';
import { geometriaCarro } from './carros3d.js';
import { criarObjetos } from './objetos.js';
import { criarObjetos3d } from './objetos3d.js';
import { FACHADA_M, TELHADO_M, CALCADA_M, GRAMA_M, criarFachadas, criarLojas, texturaTelhado, texturaCalcada, texturaGrama, texturaAsfalto, texturaCopa } from './texturas.js';
import { passoEmbalo, tetoCorrida, gastoCorrida } from './velocidade.js';

// ---------- constantes ----------
const TOQUE = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const MOBILE = TOQUE;                             // celular: materiais leves, menos quarteirões e resolução dinâmica
const RAIO_CARGA = MOBILE ? 2 : 4;                // quarteirões carregados em volta (Chebyshev)
const CORPO = { raio: 0.45, alt: 1.8 };
const MOV = { andar: 15, correr: 58, gravidade: 36, pulo: 14.5, puloCorrendo: 19, puloDuplo: 12.5, giro: 12, escalar: 36, escalaMin: 24, escalaMax: 40, vibrarMin: 12 };
const ENERGIA = { gasto: 0.17, parede: 0.2, vibrar: 0.28, recarga: 0.05, esfera: 0.3 };
const DIA_SEGUNDOS = 480;
const CAM = { dist: 4.3, alvoY: 1.55, pitch: 0.24, fov: 56 };   // câmera perto, por cima do ombro (o herói ~40% da altura da tela)

// ---------- util ----------
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const suave = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const $ = (id) => document.getElementById(id);
const el = {
  fade: document.getElementById('fade'),
  corpo: document.body, cena: $('cena'), esferas: $('esferas'), total: $('total'), vel: $('vel'), hora: $('hora'), nivel: $('nivel'),
  aviso: $('aviso'), avisoT: $('avisoTitulo'), avisoR: $('avisoRotulo'), coleta: $('coleta'), resumo: $('resumo'), dano: $('dano'), missao: $('missao'), capitulos: $('capitulos'), seta: $('seta'), dist: $('distEsfera'), mapa: $('mapa'), mapaBox: $('mapaBox'),
  missaoNum: $('missaoNum'), missaoTitulo: $('missaoTitulo'), missaoTexto: $('missaoTexto'), crimeLinha: $('crimeLinha'),
  inicio: $('telaInicio'), pausa: $('telaPausa'), fim: $('telaFim'), fimTexto: $('fimTexto'), btnJogar: $('btnJogar'), carga: $('barraCargaI'), carregando: $('carregando'),
};
if (TOQUE) el.corpo.classList.add('toque');

// ---------- renderizador, cena, céu ----------
const renderer = new THREE.WebGLRenderer({ canvas: el.cena, antialias: !TOQUE, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
// resolução dinâmica: começa no teto e desce/sobe pelo tempo de quadro (alvo ~45–60 qps no celular)
// o piso no celular é 1,3 (abaixo disso tudo fica borrado); o custo cai antes pelo borrão de velocidade e pelo bloom
const RES = { max: Math.min(devicePixelRatio || 1, 2), min: MOBILE ? 1.3 : 1, pr: 0, media: 1 / 60, conta: 0 };
RES.pr = RES.max; renderer.setPixelRatio(RES.pr);
const cena = new THREE.Scene();
cena.fog = new THREE.Fog(0xbfdcff, RAIO_CARGA * CELL * (MOBILE ? 0.45 : 0.36), RAIO_CARGA * CELL * (MOBILE ? 1.05 : 0.92));
const camera = new THREE.PerspectiveCamera(CAM.fov, 1, 0.2, RAIO_CARGA * CELL + 160);
const ANISO = Math.min(MOBILE ? 2 : 8, renderer.capabilities.getMaxAnisotropy());
// no celular, MeshStandard (PBR) vira MeshLambert: as mesmas texturas e emissivos, sem relevo nem reflexo — bem mais barato por pixel
const SO_PC = ['roughness', 'metalness', 'bumpMap', 'bumpScale', 'normalMap', 'normalScale', 'envMapIntensity', 'roughnessMap', 'metalnessMap', 'envMap'];
class MaterialLeve extends THREE.MeshLambertMaterial { constructor(p = {}) { const q = { ...p }; for (const k of SO_PC) delete q[k]; super(q); } }
const MatPadrao = MOBILE ? MaterialLeve : THREE.MeshStandardMaterial;
const THREE_LAB = MOBILE ? Object.create(THREE, { MeshStandardMaterial: { value: MaterialLeve }, MeshPhysicalMaterial: { value: MaterialLeve } }) : THREE;

const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x403830, 1);
const sol = new THREE.DirectionalLight(0xffffff, 1.5);
if (!MOBILE) {                                    // sombras de verdade no PC: uma caixa de 90 m que acompanha o herói
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 260 });
  sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.5;
}
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
  noite: { topo: 0x050816, horizonte: 0x16224a, hemiCeu: 0x4a5f9e, hemiChao: 0x353e5c, hemi: 1.9, sol: 0x9fb4f0, solInt: 1.0, neblina: 0x121c3e },
  crepusculo: { topo: 0x2c3a7a, horizonte: 0xff8f5e, hemiCeu: 0x9a8fb8, hemiChao: 0x3a2a30, hemi: 0.8, sol: 0xff9a60, solInt: 1.0, neblina: 0xc4795a },
  dia: { topo: 0x4b8fe8, horizonte: 0xc6e0ff, hemiCeu: 0xcfe2ff, hemiChao: 0x6a6258, hemi: 1.05, sol: 0xfff4de, solInt: 1.7, neblina: 0xbcd8f5 },
};
const tmpA = new THREE.Color(), tmpB = new THREE.Color();
function misturar(alvo, ca, cb, t) { tmpA.setHex(ca); tmpB.setHex(cb); alvo.copy(tmpA).lerp(tmpB, t); }
const mundo = { T: 0.4, elev: 1, noite: 0 };
const materiaisFachada = [];            // para acender as janelas à noite

const vSol = new THREE.Vector3();
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
  vSol.set(heroi.position.x, heroi.position.y, heroi.position.z); sol.position.copy(vSol).addScaledVector(dl, 150); sol.target.position.copy(vSol);
  matCeu.uniforms.sol.value.copy(dir); matCeu.uniforms.brilho.value.setHex(elev > 0.1 ? 0xffe8b0 : 0xff9a60).multiplyScalar(suave(-0.12, 0.05, elev));
  ceu.position.copy(posCam); estrelas.position.copy(posCam);
  mundo.noite = 1 - suave(-0.15, 0.12, elev);
  estrelas.material.opacity = clamp(mundo.noite * 1.2, 0, 1);
  const lit = mundo.noite * 1.0; renderer.toneMappingExposure = 1.05 + 0.3 * mundo.noite; matPoca.opacity = 0.34 * mundo.noite;
  for (const m of materiaisFachada) m.emissiveIntensity = lit * (1 - 0.85 * (J.apagao || 0));   // no "Apagão" a cidade fica escura
  matLampada.color.setRGB(0.55 + 0.45 * lit, 0.5 + 0.43 * lit, 0.38 + 0.3 * lit); cena.environmentIntensity = 0.15 + 0.85 * (1 - mundo.noite);
  renderer.setClearColor(cena.fog.color);
}

// ---------- materiais e texturas ----------
const fachadas = criarFachadas(ANISO, { alta: !MOBILE }), lojas = criarLojas(ANISO);
const TONS = [0xffffff, 0xe9dfcc, 0xcfd9ea];
const matFachada = [];
for (let k = 0; k < fachadas.length; k++) {
  matFachada.push(TONS.map((c) => {
    const vidro = k === 0;
    const m = new MatPadrao({ map: fachadas[k].mapa, color: c, emissive: 0xffffff, emissiveMap: fachadas[k].emissiva, emissiveIntensity: 0,
      bumpMap: fachadas[k].mapa, bumpScale: vidro ? 0.4 : 1.6, roughness: vidro ? 0.18 : 0.82, metalness: vidro ? 0.55 : 0.05, envMapIntensity: vidro ? 1.3 : 0.25 });
    // no PC, cada janela vira uma sala de verdade (janelas.js); o vidro reflete o céu
    if (!MOBILE) salasAtrasDasJanelas(m, { mascara: fachadas[k].mascara, grade: fachadas[k].grade, espelho: fachadas[k].espelho, reflexo: vidro ? 1 : 3.2 });
    materiaisFachada.push(m); return m;
  }));
}
const matLoja = lojas.map((t) => { const m = new MatPadrao({ map: t.mapa, emissive: 0xffffff, emissiveMap: t.emissiva, emissiveIntensity: 0, roughness: 0.55, metalness: 0.1, bumpMap: t.mapa, bumpScale: 1.2 }); materiaisFachada.push(m); return m; });
const texTelhado = texturaTelhado(ANISO);
const matTelhado = new MatPadrao({ map: texTelhado, bumpMap: texTelhado, bumpScale: 1.5, roughness: 0.95, metalness: 0 });
const texCalcada = texturaCalcada(ANISO); texCalcada.repeat.set(BLOCO / CALCADA_M, BLOCO / CALCADA_M);
const texGrama = texturaGrama(ANISO); texGrama.repeat.set(BLOCO / GRAMA_M, BLOCO / GRAMA_M);
const matMeioFio = new MatPadrao({ color: 0x8a8d93, roughness: 0.9 });
const matCalcada = new MatPadrao({ map: texCalcada, bumpMap: texCalcada, bumpScale: 1.2, roughness: 0.9 });
const matGrama = new MatPadrao({ map: texGrama, roughness: 1 });
const texAsfalto = texturaAsfalto(ANISO); texAsfalto.wrapS = texAsfalto.wrapT = THREE.RepeatWrapping; texAsfalto.repeat.set(N, N);
const matAsfalto = new MatPadrao({ map: texAsfalto, roughness: 0.85, metalness: 0.05 });
const matProps = new MatPadrao({ vertexColors: true, roughness: 0.42, metalness: 0.35 });
const matCopa = new MatPadrao({ map: texturaCopa(), roughness: 1 });
const matLampada = new THREE.MeshBasicMaterial({ color: 0xffe9b0 });
const texPoca = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const matPoca = new THREE.MeshBasicMaterial({ map: texPoca, color: 0xffd9a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
const geoPoca = new THREE.CircleGeometry(1, 20); geoPoca.rotateX(-Math.PI / 2);

// o asfalto é um plano só para a cidade inteira (a textura de uma célula se repete N × N)
const asfaltoGeral = new THREE.Mesh(new THREE.PlaneGeometry(N * CELL, N * CELL), matAsfalto); asfaltoGeral.rotation.x = -Math.PI / 2; asfaltoGeral.receiveShadow = !MOBILE; cena.add(asfaltoGeral);

// reflexo do céu nos vidros e no traje: ambiente gerado do próprio céu (de dia); a intensidade cai à noite. No celular só
// os materiais PBR (o herói) usam; a cidade em Lambert ignora
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
    // (com cor por vértice na geometria — os carros —, a cor `c` tinge a dela)
    const p = g.attributes.position, nn = g.attributes.normal, uv = g.attributes.uv, gc = g.attributes.color, gt = g.attributes.tinta, ix = g.index, v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3().getNormalMatrix(m);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m); this.pos.push(v.x, v.y, v.z); n.fromBufferAttribute(nn, i).applyMatrix3(nm).normalize(); this.nor.push(n.x, n.y, n.z); this.uv.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
      if (this.col) { if (gc) { const k = gt ? gt.getX(i) : 1; this.col.push(gc.getX(i) * (1 + (c[0] - 1) * k), gc.getY(i) * (1 + (c[1] - 1) * k), gc.getZ(i) * (1 + (c[2] - 1) * k)); } else this.col.push(c[0], c[1], c[2]); }
    }
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
const geosEstacionados = {};
const geoEstacionado = (tipo) => geosEstacionados[tipo] || (geosEstacionados[tipo] = geometriaCarro(THREE, tipo, { leve: true }));

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
const CINZA = [0.5, 0.52, 0.55], CINZA_ESC = [0.25, 0.26, 0.28], TRONCO = [0.34, 0.24, 0.17];

function construirBloco(b) {
  const grupo = new THREE.Group(), geos = [], dados = { grupo, geos, orbes: [], instancias: [] };
  // o campus do laboratório desenha a própria praça (as 4 células são uma só, e só a "mestre" monta o desenho)
  if (b.tipo !== 'lab' && !b.semLaje) { const topoLaje = new THREE.Mesh(geoLajeTopo, b.tipo === 'parque' ? matGrama : matCalcada); topoLaje.position.set(b.cx, 0, b.cz); topoLaje.receiveShadow = !MOBILE; grupo.add(topoLaje); }
  const baldes = new Map(), pega = (k, cor) => { if (!baldes.has(k)) baldes.set(k, new Balde(cor)); return baldes.get(k); };
  const props = pega('props', true), roof = pega('roof'), copas = pega('copas'), lamp = pega('lamp'), poca = pega('poca');
  // meio-fio entra no balde dos adereços (um desenho a menos): quatro faixas finas
  if (b.tipo !== 'lab' && !b.semLaje) for (const [x, z, sx, sz] of [[0, -BLOCO / 2 + 0.2, BLOCO, 0.4], [0, BLOCO / 2 - 0.2, BLOCO, 0.4], [-BLOCO / 2 + 0.2, 0, 0.4, BLOCO], [BLOCO / 2 - 0.2, 0, 0.4, BLOCO]]) props.geo(geoCaixa, compor(b.cx + x, CALCADA / 2, b.cz + z, sx, CALCADA, sz), [0.5, 0.51, 0.53]);
  if (b.tipo === 'lab' && b.mestre) { const lab = construirLab(THREE_LAB, b.cx, b.cz, { aniso: ANISO, intervaloTela: MOBILE ? 1 : 0.2 }); grupo.add(lab.grupo); if (!MOBILE) lab.grupo.traverse((o) => { if (o.isMesh && !o.material?.transparent) { o.castShadow = true; o.receiveShadow = true; } }); geos.push(...lab.geos); dados.lab = lab; labAtivo = lab; }
  for (const l of b.lotes) {
    const lat = pega(`l${l.estilo}-${l.tom}`);
    const loja = !l.semLoja && l.y0 <= CALCADA + 0.01 && l.x1 - l.x0 > 8 ? pega(`loja${(Math.abs(b.i * 7 + b.j * 3 + Math.round(l.x0)) % 3)}`) : null;
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
  for (const c of b.carros) {                                   // carros estacionados: os modelos de carros3d.js (a versão leve), desligados
    const k = Math.abs(Math.round(c.x * 7.1 + c.z * 3.3)) % 20, tipo = k < 8 ? 'sedan' : k < 13 ? 'hatch' : k < 17 ? 'suv' : k < 19 ? 'van' : 'taxi';
    props.geo(geoEstacionado(tipo), compor(c.x, 0, c.z, 1, 1, 1, c.rot), tipo === 'taxi' ? [0.95, 0.75, 0.12] : rgb(c.cor));
  }
  for (const p of b.postes) {                                   // poste de luz com braço sobre a rua
    props.geo(geoCil, compor(p.x, CALCADA + 3.6, p.z, 0.11, 7.2, 0.11), CINZA_ESC);
    const dx = p.lado === 0 ? 0 : -1.1, dz = p.lado === 0 ? -1.1 : 0;
    props.geo(geoCaixa, compor(p.x + dx * 0.5, CALCADA + 7.2, p.z + dz * 0.5, p.lado === 0 ? 0.1 : 1.2, 0.1, p.lado === 0 ? 1.2 : 0.1), CINZA_ESC);
    lamp.geo(geoCaixa, compor(p.x + dx, CALCADA + 7.1, p.z + dz, p.lado === 0 ? 0.5 : 0.7, 0.12, p.lado === 0 ? 0.7 : 0.5), null);
    poca.geo(geoPoca, compor(p.x + dx * 3, 0.05, p.z + dz * 3, 7, 1, 7), null);
  }
  if (b.marco) {                                                // os lugares da história: colunas, letreiros, relógio, a ponte...
    const api = {
      THREE, grupo, geos, compor,
      caixa: (x, y, z, sx, sy, sz, cor, rot = 0) => props.geo(geoCaixa, compor(x, y, z, sx, sy, sz, rot), cor),
      cil: (x, y, z, r, h, cor) => props.geo(geoCil, compor(x, y, z, r, h, r), cor),
      cone: (x, y, z, r, h, cor) => props.geo(geoCone, compor(x, y, z, r, h, r), cor),
      geo: (g, m, cor) => props.geo(g, m, cor),
      luz: (x, y, z, sx, sy, sz) => lamp.geo(geoCaixa, compor(x, y, z, sx, sy, sz), null),
    };
    dados.extra = b.marco.id === 'fora' ? desenharFora(THREE, api) : desenharMarco(THREE, b, api);
    marcosAtivos.add(dados.extra);
    // a sala de dentro do lugar (no alto; só aparece com o herói lá dentro)
    if (INTERIORES[b.marco.id]) { const it = construirInterior(THREE, b.marco.id, b.cx, b.cz); Object.assign(it, { id: b.marco.id, cx: b.cx, cz: b.cz }); cena.add(it.grupo); interioresAtivos.add(it); dados.interior = it; }
  }
  for (const [k, bd] of baldes) {
    const g = bd.gerar(); if (!g) continue; geos.push(g);
    let mat;
    if (k === 'props') mat = matProps; else if (k === 'roof') mat = matTelhado; else if (k === 'copas') mat = matCopa; else if (k === 'lamp') mat = matLampada; else if (k === 'poca') mat = matPoca;
    else if (k.startsWith('loja')) mat = matLoja[+k.slice(4)];
    else { const [e, t] = k.slice(1).split('-').map(Number); mat = matFachada[e][t]; }
    const m = new THREE.Mesh(g, mat); grupo.add(m);
    if (!MOBILE && k !== 'lamp' && k !== 'poca') { m.receiveShadow = true; m.castShadow = true; }
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
let labAtivo = null;
const marcosAtivos = new Set();                   // extras animados dos lugares carregados (relógio, giroflex, letreiro...)
const interioresAtivos = new Set();               // as salas de dentro dos lugares carregados (interiores3d.js)
function descarregar(chave) {
  const d = carregados.get(chave); if (!d) return;
  if (d.extra) marcosAtivos.delete(d.extra);
  if (d.interior) { interioresAtivos.delete(d.interior); cena.remove(d.interior.grupo); d.interior.dispose(); }
  if (d.lab) { d.lab.materiais?.forEach((m) => m.dispose?.()); if (labAtivo === d.lab) labAtivo = null; }
  cena.remove(d.grupo); d.geos.forEach((g) => g.dispose()); d.instancias.forEach((i) => i.dispose());
  for (const r of d.orbes) { const k = orbesAtivos.indexOf(r); if (k >= 0) orbesAtivos.splice(k, 1); }
  carregados.delete(chave);
}
// distância (Chebyshev, em células) de (ci, cj) até a célula (i, j); para a célula mestre do campus, até a mais perto das 4
function distCel(i, j, ci, cj) {
  if (i === LAB_CELULA[0] && j === LAB_CELULA[1]) return Math.max(Math.max(0, i - ci, ci - (i + 1)), Math.max(0, j - cj, cj - (j + 1)));
  return Math.max(Math.abs(i - ci), Math.abs(j - cj));
}
function desejados(ci, cj, raio) {
  const v = [];
  // as células do campus viram a mestre: o laboratório inteiro carrega quando qualquer parte dele entra no raio
  for (let i = ci - raio; i <= ci + raio; i++) for (let j = cj - raio; j <= cj + raio; j++) if (dentro(i, j)) {
    if (ehCampus(i, j)) { if (!v.some((e) => e[0] === LAB_CELULA[0] && e[1] === LAB_CELULA[1])) v.push([LAB_CELULA[0], LAB_CELULA[1], distCel(LAB_CELULA[0], LAB_CELULA[1], ci, cj) - 0.5]); continue; }
    v.push([i, j, Math.max(Math.abs(i - ci), Math.abs(j - cj)) + Math.hypot(i - ci, j - cj) * 0.01]);
  }
  return v.sort((a, b) => a[2] - b[2]);
}
let celAtual = [-999, -999];
function atualizarQuarteiroes(x, z, orcamento) {
  const ci = celulaDe(x), cj = celulaDe(z);
  if (ci !== celAtual[0] || cj !== celAtual[1]) {
    celAtual = [ci, cj];
    for (const [k, d] of carregados) { const [i, j] = k.split(',').map(Number); if (distCel(i, j, ci, cj) > RAIO_CARGA + 1) descarregar(k); }
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
const raios = criarRaios(cena, { mobile: MOBILE }); definirCameraRaios(camera);
const posfx = criarPosFx(renderer, cena, camera, { mobile: MOBILE });
// o corpo do herói: o Flash de traje e o Barry Allen à paisana (as missões da vida dele: interiores.js, missoes.js `roupa`);
// os dois com o mesmo esqueleto e a mesma animação, um visível de cada vez (vestir)
let modelo = null, modeloTraje = null, modeloCivil = null, carregandoCivil = null;
const ligarCorpo = (m) => { heroi.add(m.grupo); m.grupo.traverse((o) => { if (o.isMesh) o.castShadow = true; }); };
criarHeroi({ aniso: ANISO, lod: 0, mobile: TOQUE }).then((m) => { modeloTraje = m; partes.corpo.visible = false; ligarCorpo(m); vestir(J.roupa || 'traje', false); }).catch((e) => console.warn('corpo realista indisponível', e));
function carregarCivil() {
  return carregandoCivil || (carregandoCivil = criarHeroi({ aniso: ANISO, lod: 0, mobile: TOQUE, traje: 'civil' }).then((m) => { modeloCivil = m; m.grupo.visible = false; ligarCorpo(m); vestir(J.roupa || 'traje', false); }).catch((e) => console.warn('Barry à paisana indisponível', e)));
}
/** a roupa do herói: 'traje' (o Flash) ou 'civil' (Barry à paisana). Com efeito: a troca relâmpago (raios em volta e o aviso) */
function vestir(roupa, efeito = true) {
  const mudou = roupa !== J.roupa; J.roupa = roupa;
  if (roupa === 'civil' && !modeloCivil) carregarCivil();
  const alvo = roupa === 'civil' && modeloCivil ? modeloCivil : modeloTraje;
  for (const m of [modeloTraje, modeloCivil]) if (m) m.grupo.visible = m === alvo;
  modelo = alvo;
  if (efeito && mudou) {
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; combate.efeitos.raio(P.x, P.y + 0.2 + Math.random() * 1.6, P.z, P.x + Math.cos(a) * 1.5, P.y + Math.random() * 2.2, P.z + Math.sin(a) * 1.5, { vida: 0.3, desvio: 0.5, r: 2.4, g: 1.8, b: 0.6 }); }
    if (!(J.aviso > 0)) avisar(roupa === 'civil' ? 'Barry Allen' : 'THE FLASH', 'Troca relâmpago', 'info');   // (o aviso de missão concluída fica)
  }
}
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
const LAB_B = bloco(LAB_CELULA[0], LAB_CELULA[1]);
// a ponte e a ilha do presídio ficam fora da grade de quarteirões: desenhadas uma vez só, e nunca descarregadas
const ILHA_B = construirBloco(blocoIlha());
// a torre do S.T.A.R. Labs se vê de qualquer lugar: longe (ou com o campus descarregado) entra a silhueta no lugar dela
const silhueta = construirSilhueta(THREE, LAB_B.cx, LAB_B.cz); cena.add(silhueta.grupo);
const TORRE_XZ = { x: LAB_B.cx + (TORRE.u0 + TORRE.u1) / 2, z: LAB_B.cz + (TORRE.v0 + TORRE.v1) / 2 };
function atualizarSilhueta() {
  const d = Math.hypot(camera.position.x - TORRE_XZ.x, camera.position.z - TORRE_XZ.z), longe = !labAtivo || d > camera.far * 0.82 - 60;
  if (labAtivo) labAtivo.alto.visible = !longe;            // só a torre troca de lugar com a silhueta (o resto do campus segue o seu)
  silhueta.atualizar(camera, cena.fog, mundo.noite, longe, P.t);
}
const INICIO = { x: LAB_B.plano.entrada.x, z: LAB_B.plano.entrada.z - 9 };     // na rua, de frente para a porta do S.T.A.R. Labs
const P = { x: INICIO.x, y: 0, z: INICIO.z, vx: 0, vz: 0, vy: 0, h: 0, noChao: true, pulos: 0, energia: 0.6, correndo: false, fase: 0, t: 0, parede: null, vibrando: false };
const C = { yaw: 0, pitch: CAM.pitch, dist: CAM.dist };
const J = { modo: 'menu', coletadas: 0, total: 0, aviso: 0, inicioT: 0, alinhar: 0, ignorarMov: 0 };
const teclas = new Set();
const stick = { x: 0, y: 0 };
const toque = { correr: false, vibrar: false };
let pedidoPulo = false, pedidoBater = false, pedidoEspecial = null;
let esferas = [];

function reiniciar() {
  esferasColetadas.clear(); objetos.zerar(); rivais.sumir();
  for (const k of [...carregados.keys()]) descarregar(k);
  celAtual = [-999, -999];
  Object.assign(P, { x: INICIO.x, y: 0, z: INICIO.z, vx: 0, vz: 0, vy: 0, h: 0, noChao: true, pulos: 0, energia: 0.6, parede: null, vibrando: false, embalo: 0 });
  C.yaw = 0; C.pitch = CAM.pitch;
  J.coletadas = 0; J.modo = 'jogando'; J.inicioT = performance.now();
  J.interior = null; J.porta = null; el.fade?.classList.remove('on');
  mundo.T = 0.4;
  atualizarQuarteiroes(P.x, P.z, 999);
  esconderTelas(); el.corpo.classList.add('jogando');
  viloes.abandonar();
  const missaoUrl = new URLSearchParams(location.search).get('missao');      // atalho de teste: ?missao=fendas|tunel|passado
  if (missaoUrl) missoes.irPara(missaoUrl);
  const capUrl = new URLSearchParams(location.search).get('capitulo');      // atalho de teste: ?capitulo=zoom|reverso|final
  if (capUrl) viloes.iniciar(capUrl);
  equipe.carregar();
  J.cron = null; J.cenaPasso = null;
  vestir(missoes.atual?.roupa || 'traje', false);
  // a história começa na noite do raio (uma vez só; os atalhos ?missao= dos testes vão direto ao passo) e segue no prólogo
  if (!missaoUrl && historia.vaiTocar('noite-do-raio')) noiteDoRaio(); else prologo();
  el.esferas.textContent = '0';
  if (!TOQUE) pedirCaptura();
}
function esconderTelas() { el.inicio.hidden = el.pausa.hidden = el.fim.hidden = true; }
// faixa de aviso: rótulo pequeno na cor do tipo + título; entra deslizando e some sozinha
// tipos: missao (dourado), crime (vermelho), ok (verde), alerta (laranja), info (azul), zoom, reverso
function avisar(titulo, rotulo = '', tipo = 'info') {
  el.avisoT.textContent = titulo; el.avisoR.textContent = rotulo; el.avisoR.hidden = !rotulo;
  el.aviso.className = `t-${tipo}`; void el.aviso.offsetWidth; el.aviso.classList.add('vis'); J.aviso = 2.6;
}

// ---------- entrada ----------
function pedirCaptura() { try { el.cena.requestPointerLock?.(); } catch { /* sem captura */ } }
let tinhaCaptura = false;
document.addEventListener('pointerlockchange', () => {
  const tem = document.pointerLockElement === el.cena;
  if (!tem && tinhaCaptura && J.modo === 'jogando') pausar();
  tinhaCaptura = tem; J.ignorarMov = 3;                 // o 1º movimento depois de capturar o mouse costuma vir com um salto
});
el.cena.addEventListener('click', () => { if (J.modo === 'jogando' && !TOQUE && document.pointerLockElement !== el.cena) pedirCaptura(); });
// com o mouse capturado, o clique esquerdo bate
addEventListener('mousedown', (e) => {
  if (e.button !== 0 || TOQUE || document.pointerLockElement !== el.cena) return;
  if (J.modo === 'jogando') pedidoBater = true; else if (J.modo === 'cena') historia.avancar();
});
$('btnContinuar').addEventListener('click', continuar);
function continuar() { J.modo = 'jogando'; el.pausa.hidden = true; if (!TOQUE) pedirCaptura(); }
// pausa com a lista dos capítulos dos vilões (jogar o liberado agora, ou de novo os vencidos)
function pausar() {
  if (J.modo !== 'jogando') return;
  J.modo = 'pausa'; el.pausa.hidden = false; document.exitPointerLock?.();
  armarRecomecar(false);
  // o que saiu da tela de jogo fica aqui: missão, pontos, esferas e hora
  const ma = missoes.atual;
  el.resumo.innerHTML = `${historia.capitulo ? `<span class="hist">${historia.capitulo}</span><br>` : ''}${ma ? `História ${missoes.indice + 1}/${missoes.total}: <b>${ma.titulo}</b>` : 'História concluída: a cidade é sua'}<br>${missoes.stats.pontos} pontos · esferas ${J.coletadas}/${J.total} · ${el.hora.textContent}`;
  el.capitulos.innerHTML = '';
  // os capítulos para jogar de novo só aparecem com a história terminada (durante a história tudo começa sozinho)
  if (!missoes.livre) el.capitulos.innerHTML = '<p class="cap-aviso">A história segue sozinha: cada capítulo começa quando chegar a hora. Ao terminar, todos ficam aqui para jogar de novo.</p>';
  else for (const c of viloes.lista(missoes.indice)) {
    const b = document.createElement('button'); b.type = 'button'; b.className = `cap ${c.estado}`;
    b.innerHTML = `<b>${c.titulo}</b><small>${c.estado === 'vencido' ? 'Vencido · jogar de novo' : c.estado === 'liberado' ? 'Jogar agora' : 'Bloqueado'}</small>`;
    b.disabled = c.estado === 'bloqueado';
    b.addEventListener('click', () => { viloes.iniciar(c.id); continuar(); });
    el.capitulos.appendChild(b);
  }
}
$('btPausa')?.addEventListener('click', pausar);
// recomeçar a história do zero (na pausa): o 1º toque pede confirmação por 4 s, o 2º zera o passo da história, as falas
// vistas e os vilões vencidos (na carga da página: veja PROGRESSO) e recarrega — volta à tela de início e o COMEÇAR abre o prólogo
const RECOMECAR = 'Recomeçar a história do zero';
let confirmaAte = 0;
function armarRecomecar(ligado) {
  const b = $('btnRecomecar'); confirmaAte = ligado ? performance.now() + 4000 : 0;
  b.classList.toggle('confirma', ligado); b.textContent = ligado ? 'Toque de novo para apagar o progresso da história' : RECOMECAR;
}
$('btnRecomecar').addEventListener('click', () => {
  if (performance.now() > confirmaAte) { armarRecomecar(true); setTimeout(() => { if (performance.now() >= confirmaAte) armarRecomecar(false); }, 4100); return; }
  try { sessionStorage.setItem('theflash.recomecar', '1'); } catch { missoes.zerar(); historia.zerar(); viloes.zerar(); }   // sem sessionStorage: zera direto
  location.reload();
});
$('btnJogar').addEventListener('click', () => { deitar(); reiniciar(); });
// no Android, tela cheia + trava deitada; no iPhone a tela "Gire o celular" cuida disso
function deitar() { if (!TOQUE) return; try { const p = document.documentElement.requestFullscreen?.(); p?.then?.(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {}); } catch { /* sem tela cheia */ } }
$('btnDeNovo').addEventListener('click', reiniciar);

addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
  if (e.repeat) return;
  teclas.add(k);
  if (k === ' ') pedidoPulo = true;
  else if (k === 'f') pedidoBater = true;
  else if (Object.values(ESPECIAIS).some((E) => E.teclas.includes(k))) pedidoEspecial = Object.keys(ESPECIAIS).find((t) => ESPECIAIS[t].teclas.includes(k));
  else if (k === 'm') el.mapaBox.classList.toggle('grande');
  else if (k === 'p') { if (J.modo === 'jogando') pausar(); else if (J.modo === 'pausa') continuar(); }
  else if (k === 'h') mundo.T = (mundo.T + 0.08) % 1;
  else if (k === 'enter' && J.modo === 'menu' && !el.btnJogar.hidden) reiniciar();
  if (J.modo === 'cena') { if (k === 'enter' || k === ' ' || k === 'f') historia.avancar(); else if (k === 'escape') historia.pular(); }
  else if (J.modo === 'creditos' && (k === 'enter' || k === 'escape' || k === ' ')) fecharCreditos();
});
addEventListener('keyup', (e) => teclas.delete(e.key.toLowerCase()));
addEventListener('blur', () => teclas.clear());
function girar(dx, dy, kx, ky) { C.yaw -= dx * kx; C.pitch = clamp(C.pitch + dy * ky, -0.25, 1.35); }
addEventListener('mousemove', (e) => { if (J.modo !== 'jogando') return; if (J.ignorarMov > 0) { J.ignorarMov--; return; } if (document.pointerLockElement === el.cena || e.buttons) girar(e.movementX, e.movementY, 0.0028, 0.0024); });

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
  bt('btBater', () => { pedidoBater = true; });
  for (const t of Object.keys(ESPECIAIS)) bt(`bt-${t}`, () => { pedidoEspecial = t; });
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
  if (combate.ocupado) {                     // golpe em andamento: o combate move o herói; aqui só a altura (gravidade e chão)
    P.parede = null; P.vibrando = false;
    P.vy -= MOV.gravidade * dt; P.y += P.vy * dt;
    const ch = chaoEm(rectsPerto, P.x, P.z, P.y + 1.5);
    if (P.y <= ch) { P.y = ch; P.vy = 0; P.noChao = true; P.pulos = 0; }
    P.t += dt; return;
  }
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
  // perto de uma fenda aberta a vibração começa parada
  else if (querVibrar && P.energia > 0.08 && (vh0 >= MOV.vibrarMin || tempo.pertoDeFenda(P)) && !P.parede) { P.vibrando = true; avisar('Atravesse tudo', 'Vibrando', 'info'); }
  if (viloes.energiaLivre || missoes.atual?.tipo === 'tunel') P.energia = Math.min(1, P.energia + 0.06 * dt);      // perseguição a um vilão / túnel do tempo: energia livre, e enchendo
  else if (P.vibrando) P.energia = Math.max(0, P.energia - ENERGIA.vibrar * dt);
  else if (P.correndo) P.energia = Math.max(0, P.energia - (P.parede ? ENERGIA.parede : ENERGIA.gasto * gastoCorrida(P.embalo || 0)) * dt);
  else if (!combate.pertoDeBandido(P, 12) && !viloes.emLuta) P.energia = Math.min(1, P.energia + ENERGIA.recarga * dt * (m < 0.1 ? 3 : 1));   // no meio da briga não recarrega
  // supervelocidade (velocidade.js): na reta, segurando CORRER, o embalo sobe o teto até ~830 km/h
  const angPedido = vh0 > 5 && m > 0.1 ? Math.acos(clamp((P.vx * dx + P.vz * dz) / (vh0 * (Math.hypot(dx, dz) || 1)), -1, 1)) : 0;
  P.embalo = passoEmbalo(P.embalo || 0, { correndo: P.correndo && !P.vibrando && !P.parede, noChao: P.noChao, m, angulo: angPedido, bloqueado: viloes.ativo || combate.ocupado }, dt);
  const vmax = ((P.correndo || P.vibrando) ? (P.vibrando ? MOV.correr : tetoCorrida(P.embalo, MOV.correr)) : MOV.andar) * m * viloes.lentidao * rivais.lentidao * (missoes.atual?.fraco || 1);   // (Parte 2: o raio se apagando)   // o gelo do Capitão Frio deixa lento
  const taxa = P.noChao ? (P.correndo ? 5 : 11) : 2.2;
  const k = 1 - Math.exp(-taxa * dt);
  // o Flash não voa (dono, 26/10: "o flash consegue voar pô"): no ar ele só mantém o embalo com que saiu do chão (vira e
  // freia, mas não acelera) e cai com a gravidade inteira — o antigo planeio (PULAR segurado no ar) saiu
  if (P.noChao) P.vSolo = Math.hypot(P.vx, P.vz);
  const vAlvo = P.noChao ? vmax : Math.min(vmax, Math.max(MOV.andar, P.vSolo || 0));
  if (!P.parede) { P.vx += (dx * vAlvo - P.vx) * k; P.vz += (dz * vAlvo - P.vz) * k; }

  // pulo e pulo duplo
  if (pedidoPulo) {
    pedidoPulo = false;
    if (P.parede) { desprender(true, dx, dz); }
    else if (P.noChao) { P.vy = P.correndo ? MOV.puloCorrendo : MOV.pulo; P.noChao = false; P.pulos = 1; }
    else if (P.pulos < 2) { P.vy = MOV.puloDuplo; P.pulos = 2; }
  }

  const vh = Math.hypot(P.vx, P.vz);
  const veloc = P.parede ? P.parede.v : vh;
  const n = Math.max(1, Math.ceil(Math.max(veloc * dt / 0.6, Math.abs(P.vy) * dt / 0.5)));
  const sub = dt / n;
  for (let s = 0; s < n; s++) {
    if (P.parede) { escalarPasso(sub, ix, rx, rz); if (P.parede) continue; }
    // (quem estava no chão não afunda nele por causa da gravidade de um quadro longo: a 20 qps ela descia 7 cm, e o piso
    // — o de dentro dos lugares, o telhado — virava parede e empurrava o herói para fora)
    const yApoio = P.noChao ? P.y - 0.03 : -Infinity;
    P.vy -= MOV.gravidade * sub;
    const ox = P.x, oz = P.z;
    P.x += P.vx * sub; P.z += P.vz * sub; P.y += P.vy * sub;
    { const L = limitar(P.x, P.z); P.x = L.x; P.z = L.z; }       // a cidade, a ponte e a ilha do presídio
    if (!P.vibrando) {
      // em velocidade, obstáculos baixos (carros, bancos) são pulados: o herói salta por cima em vez de parar
      const r = empurrar(rectsPerto, P.x, P.z, CORPO.raio, Math.max(P.y, yApoio), CORPO.alt, P.saltoAuto > 0 ? ehBaixo : null);
      if (r.bateu && r.q && ehBaixo(r.q) && Math.hypot(P.vx, P.vz) > 10 && !P.parede) { P.saltoAuto = 0.45; P.vy = Math.max(P.vy, 10.5); P.noChao = false; P.x = ox + P.vx * sub; P.z = oz + P.vz * sub; continue; }
      if (r.bateu) {
        const antes = Math.hypot(P.vx, P.vz), vx0 = P.vx, vz0 = P.vz;
        P.x = r.x; P.z = r.z; P.vx = (P.x - ox) / sub * 0.98; P.vz = (P.z - oz) / sub * 0.98;
        const depois = Math.hypot(P.vx, P.vz); if (depois > antes) { P.vx *= antes / depois; P.vz *= antes / depois; }
        // de frente para a parede de um prédio, em velocidade: começa a escalar
        if (r.q && !r.q.interior && r.q.y0 > 0 && r.q.y1 - r.q.y0 > 4 && r.q.x1 - r.q.x0 > 3 && r.q.z1 - r.q.z0 > 3 && P.correndo && antes >= MOV.escalar && (r.nx * vx0 + r.nz * vz0) / (antes || 1) <= -0.55 && P.y < r.q.y1 - 1.2 && P.energia > 0.05) {
          P.parede = { nx: r.nx, nz: r.nz, q: r.q, v: clamp(antes * 0.85, MOV.escalaMin, MOV.escalaMax) };
          P.vx = P.vz = 0; P.vy = 0; P.noChao = false; P.pulos = 1; J.alinhar = 0.8;
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
  if (P.saltoAuto > 0) P.saltoAuto -= dt;
  P.t += dt;
}

// a ESTEIRA do laboratório (dono, 26/10: "a esteira não funciona"): em cima dela, correndo ao longo da correia, o herói
// corre no lugar (a correia devolve o que ele andou) e ganha velocidade como numa reta; a correia e os telões da sala
// seguem a velocidade dele (lab-tex.js ESTEIRA) e o recorde fica gravado
function passoEsteira(dt) {
  const E = PLATAFORMA_ESTEIRA, u = P.x - LAB_B.cx, v = P.z - LAB_B.cz;
  const em = u > E.u0 && u < E.u1 && v > E.v0 && v < E.v1 && P.y < E.y1 + 0.6 && P.noChao && !P.parede && J.modo === 'jogando';
  if (!em) {
    if (J.esteira?.novo) { try { armazem?.setItem('theflash.esteira.v1', String(Math.round(ESTEIRA.recorde))); } catch { /* sem armazenamento */ } avisar('Recorde da esteira', `${Math.round(ESTEIRA.recorde).toLocaleString('pt-BR')} km/h`, 'ok'); }
    if (J.esteira) { J.esteira = null; ESTEIRA.kmh = null; }
    return;
  }
  if (!J.esteira) J.esteira = { z: P.z, novo: false };
  if (Math.abs(P.vz) > Math.abs(P.vx) && Math.abs(P.vz) > 2) { P.z = J.esteira.z; P.x = clamp(P.x, LAB_B.cx + E.u0 + 0.5, LAB_B.cx + E.u1 - 0.5); }
  else J.esteira.z = P.z;                                                      // parado ou saindo de lado: anda normal
  const kmh = Math.hypot(P.vx, P.vz) * 3.6; ESTEIRA.kmh = kmh;
  if (kmh > ESTEIRA.recorde) { ESTEIRA.recorde = kmh; J.esteira.novo = true; }
}

function ehBaixo(q) { return q.y0 >= -0.01 && q.y1 - Math.max(P.y, q.y0) <= 1.8 && q.y1 - q.y0 < 3; }
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
      el.esferas.textContent = J.coletadas; missoes.contar('esferas');
      el.coleta.textContent = `ESFERA ${J.coletadas}/${J.total}`; el.coleta.classList.add('vis'); clearTimeout(J.tColeta); J.tColeta = setTimeout(() => el.coleta.classList.remove('vis'), 1600);
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
  const v = J.corridaCena ? 48 : Math.hypot(P.vx, P.vz), amp = clamp(v / 10, 0, 1), forte = clamp((v - 15) / 40, 0, 1);   // no túnel do tempo ele corre
  if (modelo) {
    const vv = P.parede ? P.parede.v : v;
    const luta = combate.poseHeroi();
    modelo.aplicar({ v: luta.corrida ?? vv, noChao: P.noChao, parede: !!P.parede, vibrando: P.vibrando, golpe: luta.golpe, luta: Math.max(luta.luta, viloes.emLuta ? 1 : 0), fala: J.modo === 'cena' && historia.quemFala === 'heroi' }, dt);
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
    p.bracoE.rotation.x = lerp(p.bracoE.rotation.x, -2.2, 0.25); p.bracoD.rotation.x = lerp(p.bracoD.rotation.x, 0.6, 0.25);
  }
  p.bracoE.rotation.z = lerp(p.bracoE.rotation.z, 0, 0.2); p.bracoD.rotation.z = lerp(p.bracoD.rotation.z, 0, 0.2);
  heroi.position.set(P.x, P.y, P.z); heroi.rotation.y = P.h; }
  // sombra no chão logo abaixo
  const chao = chaoEm(rectsPerto, P.x, P.z, P.y + 40, 40);
  sombra.position.set(P.x, Math.min(chao, P.y) + 0.04, P.z); const e = clamp(1 - (P.y - chao) / 25, 0.25, 1); sombra.scale.setScalar(e); sombra.visible = MOBILE && !P.parede;
  raios.atualizar(dt, P, P.parede ? P.parede.v : v, { vibrando: P.vibrando, parede: P.parede });
}

// ---------- câmera ----------
function dentroDeSolido(x, y, z) {
  for (const q of rectsPerto) { if (q.y0 < 0) continue; if (x > q.x0 - 0.3 && x < q.x1 + 0.3 && z > q.z0 - 0.3 && z < q.z1 + 0.3 && y > q.y0 - 0.3 && y < q.y1 + 0.3) return true; }
  return false;
}
function atualizarCamera(dt) {
  const v = Math.hypot(P.vx, P.vz);
  const foco = combate.foco;
  if (foco) { J.foco = J.foco || { x: P.x, z: P.z }; J.foco.x = lerp(J.foco.x, foco.x, 1 - Math.exp(-8 * dt)); J.foco.z = lerp(J.foco.z, foco.z, 1 - Math.exp(-8 * dt)); }
  else if (J.foco) { J.foco.x = lerp(J.foco.x, P.x, 1 - Math.exp(-10 * dt)); J.foco.z = lerp(J.foco.z, P.z, 1 - Math.exp(-10 * dt)); if (Math.hypot(J.foco.x - P.x, J.foco.z - P.z) < 0.05) J.foco = null; }
  const alvo = new THREE.Vector3(J.foco ? J.foco.x : P.x, P.y + CAM.alvoY, J.foco ? J.foco.z : P.z);
  const cp = Math.cos(C.pitch), sp = Math.sin(C.pitch), fx = Math.sin(C.yaw), fz = Math.cos(C.yaw);
  const distIdeal = CAM.dist + clamp(v - 15, 0, 45) * 0.05 + Math.max(1.3 * combate.poseHeroi().luta, viloes.emLuta ? 2.4 : 0);
  let t = 1;
  if (P.parede && J.alinhar > 0) { J.alinhar -= dt; let d = P.h - C.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); C.yaw += d * (1 - Math.exp(-3 * dt)); }
  for (; t > 0.15 && !P.vibrando; t -= 0.07) { const d = distIdeal * t; if (!dentroDeSolido(alvo.x - fx * cp * d, alvo.y + sp * d, alvo.z - fz * cp * d)) break; }
  const dAlvo = distIdeal * Math.max(t, 0.15);
  C.dist = dAlvo < C.dist ? dAlvo : lerp(C.dist, dAlvo, 1 - Math.exp(-6 * dt));
  camera.position.set(alvo.x - fx * cp * C.dist, Math.max(0.6, alvo.y + sp * C.dist), alvo.z - fz * cp * C.dist);
  camera.lookAt(alvo);
  const tr = combate.tremor; if (tr > 0) { camera.position.x += (Math.random() - 0.5) * tr * 0.5; camera.position.y += (Math.random() - 0.5) * tr * 0.4; camera.position.z += (Math.random() - 0.5) * tr * 0.5; }
  const fovAlvo = CAM.fov + clamp(v - 15, 0, 45) * 0.38 + clamp(v - 60, 0, 170) * 0.045;   // na supervelocidade abre mais um pouco
  camera.fov = lerp(camera.fov, fovAlvo, 1 - Math.exp(-4 * dt)); camera.updateProjectionMatrix();
}

// ---------- minimapa e bússola ----------
const gm = el.mapa.getContext('2d');
let quadroMapa = 0, ultBussola = 0;
function desenharMapa() {
  const grande = el.mapaBox.classList.contains('grande');
  const W = el.mapa.width, H = el.mapa.height;
  const raioM = grande ? MEIO + 120 : 210, ppm = (W / 2) / raioM;
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
  { // a ponte e a ilha do presídio
    gm.fillStyle = '#4a5560'; gm.fillRect(PONTE.x0 - 8, PONTE.z - PONTE.larg / 2, PONTE.x1 - PONTE.x0 + 16, PONTE.larg);
    gm.fillStyle = '#3f5a3a'; gm.fillRect(ILHA.x0, ILHA.z0, ILHA.x1 - ILHA.x0, ILHA.z1 - ILHA.z0);
    const Q = PRESIDIO; gm.fillStyle = '#7d7f84'; gm.fillRect(Q.cx - Q.meio, Q.cz - Q.meio, Q.meio * 2, Q.meio * 2);
    gm.fillStyle = '#9a9ca2'; for (const b of Q.blocos) gm.fillRect(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0);
  }
  { // o campus do S.T.A.R. Labs (antes do guia e dos marcadores, que vão por cima): a praça, os prédios e a borda
    const cx = LAB_B.cx, cz = LAB_B.cz, M = CAMPUS.meio, L = LAB.meio;
    gm.fillStyle = '#34405a'; gm.fillRect(cx - M, cz - M, 2 * M, 2 * M);
    gm.fillStyle = '#5d79a8'; gm.fillRect(cx - L, cz - L, 2 * L, 2 * L); gm.fillRect(cx + TORRE.u0, cz + TORRE.v0, TORRE.u1 - TORRE.u0, TORRE.v1 - TORRE.v0);
    for (const a of ALAS) gm.fillRect(cx + a.u0, cz + a.v0, a.u1 - a.u0, a.v1 - a.v0);
    gm.strokeStyle = '#3fe0ff'; gm.lineWidth = grande ? 10 : 4; gm.strokeRect(cx - M, cz - M, 2 * M, 2 * M);
  }
  gm.fillStyle = '#3fd0ff'; const rr = grande ? 14 : 6;
  for (const o of esferas) if (!esferasColetadas.has(o.id) && Math.abs(o.x - P.x) < raioM * 1.1 && Math.abs(o.z - P.z) < raioM * 1.1) { gm.beginPath(); gm.arc(o.x, o.z, rr, 0, 6.3); gm.fill(); }
  // os carrinhos de cachorro-quente (energia): um quadradinho laranja no mapa de perto
  if (!grande) { gm.fillStyle = '#ff9a2e'; for (const o of objetos.perto(P.x, P.z, raioM)) if (o.tipo === 'lanche') gm.fillRect(o.x - 4, o.z - 4, 8, 8); }
  guia.desenharNoMapa(gm, grande ? 9 : 5);
  for (const e of combate.bandidos) if (e.estado !== 'caido' && e.estado !== 'fugiu') { gm.fillStyle = '#ff4d5e'; gm.beginPath(); gm.arc(e.x, e.z, grande ? 8 : 4, 0, 6.3); gm.fill(); }
  { const r = rivais.ativo; if (r) { gm.fillStyle = '#c86bff'; gm.beginPath(); gm.arc(r.x, r.z, grande ? 22 : 9, 0, 6.3); gm.fill(); gm.strokeStyle = '#fff'; gm.lineWidth = grande ? 4 : 2; gm.stroke(); } }   // o vilão do dia (roxo)
  { const a = alvoAtual(); if (a && a.cor !== '#3fd0ff') { gm.fillStyle = a.cor; gm.beginPath(); gm.arc(a.x, a.z, grande ? 30 : 11, 0, 6.3); gm.fill(); gm.strokeStyle = '#fff'; gm.lineWidth = grande ? 6 : 2.5; gm.stroke(); } }
  gm.setTransform(1, 0, 0, 1, 0, 0);
  { // nomes no mapa (texto sempre de pé): o laboratório e, no mapa grande, os lugares da história
    const nome = (x, z, texto, cor, px) => {
      const lx = (x - P.x) * rx + (z - P.z) * rz, ly = -((x - P.x) * fx + (z - P.z) * fz);
      if (Math.hypot(lx, ly) < raioM) { gm.fillStyle = cor; gm.font = `bold ${px}px sans-serif`; gm.textAlign = 'center'; gm.fillText(texto, W / 2 + lx * ppm, H / 2 + ly * ppm - (grande ? 14 : 24)); }
    };
    nome(LAB_B.cx, LAB_B.cz, 'S.T.A.R. LABS', '#3fe0ff', grande ? 22 : 20);
    if (grande) {
      for (const m of MARCOS) { const b = bloco(m.cel[0], m.cel[1]); nome(b.cx, b.cz, m.nome, '#ffd23f', 17); }
      nome(PRESIDIO.cx, PRESIDIO.cz, 'Iron Heights', '#ffd23f', 17); nome((PONTE.x0 + PONTE.x1) / 2, PONTE.z, 'Ponte da Baía', '#ffd23f', 15);
    }
  }
  const sx = Math.sin(P.h) * rx + Math.cos(P.h) * rz, sy = -(Math.sin(P.h) * fx + Math.cos(P.h) * fz);
  gm.translate(W / 2, H / 2); gm.rotate(Math.atan2(sx, -sy));
  gm.fillStyle = '#ff2b3d'; gm.strokeStyle = '#fff'; gm.lineWidth = 2; gm.beginPath(); gm.moveTo(0, -11); gm.lineTo(8, 9); gm.lineTo(0, 5); gm.lineTo(-8, 9); gm.closePath(); gm.fill(); gm.stroke();
}
function esferaMaisPerto() {
  let melhor = null, md = Infinity;
  for (const o of esferas) { if (esferasColetadas.has(o.id)) continue; const d = Math.hypot(o.x - P.x, o.z - P.z); if (d < md) { md = d; melhor = o; } }
  return melhor;
}
// prédio de 50 m ou mais mais perto (alvo da missão de escalar): o ponto da calçada em frente à fachada mais perto
let predioCache = null, predioT = 0;
function predioAltoPerto() {
  if (predioCache && P.t - predioT < 1.5) return predioCache;
  predioT = P.t; let melhor = null, md = Infinity;
  const ci = celulaDe(P.x), cj = celulaDe(P.z);
  for (let i = ci - 8; i <= ci + 8; i++) for (let j = cj - 8; j <= cj + 8; j++) {
    if (!dentro(i, j)) continue; const b = bloco(i, j); if (b.tipo === 'lab') continue;
    for (const l of b.lotes) {
      if (l.y1 < 52 || l.y0 > CALCADA + 0.01) continue;
      const px = clamp(P.x, l.x0, l.x1), pz = clamp(P.z, l.z0, l.z1), d = Math.hypot(px - P.x, pz - P.z);
      if (d < md) { md = d; melhor = l; }
    }
  }
  if (!melhor) return (predioCache = null);
  const l = melhor, mx = (l.x0 + l.x1) / 2, mz = (l.z0 + l.z1) / 2;
  let px = clamp(P.x, l.x0, l.x1), pz = clamp(P.z, l.z0, l.z1);
  if (px > l.x0 && px < l.x1 && pz > l.z0 && pz < l.z1) { px = P.x < mx ? l.x0 : l.x1; }
  const nx = px <= l.x0 ? -1 : px >= l.x1 ? 1 : 0, nz = nx ? 0 : pz <= l.z0 ? -1 : 1;
  return (predioCache = { x: px + nx * 3, z: pz + nz * 3 });
}
// objetivo do guia (feixe, marcador e caminho): crime > objetivo da missão; null quando a missão não tem lugar
// ---------- entrar e sair dos lugares (interiores.js): a porta da fachada leva à sala de dentro (no alto) e a de dentro devolve à calçada
function passoInteriores(dt) {
  for (const I of interioresAtivos) { I.grupo.visible = J.interior === I.id; if (I.grupo.visible) I.atualizar(mundo.noite); }
  if (J.porta) { J.porta.t += dt; if (J.porta.t >= 0.3 && !J.porta.feito) { J.porta.feito = true; J.porta.fazer(); } if (J.porta.t >= 0.62) { J.porta = null; el.fade.classList.remove('on'); } return; }
  if (J.modo !== 'jogando' || viloes.ativo) return;
  if (!J.interior) {
    if (P.y > 6) return;
    for (const I of interioresAtivos) if (noGatilhoFora(I.id, P.x - I.cx, P.z - I.cz)) { atravessarPorta(I, true); return; }
    return;
  }
  const I = [...interioresAtivos].find((k) => k.id === J.interior); if (!I) { J.interior = null; return; }
  const D = INTERIORES[I.id], [u0, u1, v0, v1] = D.sala;
  if (P.y < Y_INT - 3) { atravessarPorta(I, false); return; }                       // (nunca cai do alto)
  // dentro, a sala segura o herói: vibrando ele não atravessa para fora
  P.x = I.cx + clamp(P.x - I.cx, u0 + 0.3, u1 - 0.3); P.z = I.cz + clamp(P.z - I.cz, v0 - 0.2, v1 - 0.3);
  if (noGatilhoDentro(I.id, P.x - I.cx, P.z - I.cz) && P.vz <= 0.5) atravessarPorta(I, false);
}
function atravessarPorta(I, entrando) {
  el.fade.classList.add('on');
  J.porta = { t: 0, feito: false, fazer: () => {
    const D = INTERIORES[I.id];
    if (entrando) { const [u, v, h] = D.entrada; Object.assign(P, { x: I.cx + u, z: I.cz + v, y: Y_INT, h }); J.interior = I.id; avisar(D.nome, 'Entrou', 'info'); }
    else { const [u, v, h] = D.fora.volta, x = I.cx + u, z = I.cz + v; Object.assign(P, { x, z, y: chaoEm(retangulosPerto(x, z, 1), x, z, 2), h }); J.interior = null; }
    Object.assign(P, { vx: 0, vz: 0, vy: 0, noChao: true, parede: null, vibrando: false, embalo: 0 }); C.yaw = P.h; C.dist = 1.5;
    rectsPerto = retangulosPerto(P.x, P.z, 1);
  } };
}
const POS_CINZAS = MISSOES.findIndex((m) => m.id === 'p2-celas'), FORA_CINZAS = new Set(['zoom']);   // a cela do Zoom vazia, só cinza
const NOME_SALA = { contencao: 'Câmara de contenção', cortex: 'Cortex', nucleo: 'Câmara do Núcleo' };
function alvoMissao() {
  if (viloes.ativo) return viloes.alvo();                  // capítulo dos vilões: o guia leva até eles (na luta, nada)
  const c = crimes.ativo;
  if (c) return { x: c.x, z: c.z, cor: '#ff4d5e', rotulo: c.nome };
  const m = missoes.atual;
  // dentro de um lugar, o objetivo de fora (ou de outro lugar) fica atrás da porta de saída
  const pm = m?.ponto ? pontoMundo(m.ponto) : null;
  if (J.interior && pm?.interior !== J.interior) { const I = [...interioresAtivos].find((k) => k.id === J.interior); if (I) return { x: I.cx, z: I.cz + INTERIORES[I.id].sala[2], cor: '#ffd23f', rotulo: 'Saída' }; }
  if (pm?.interior && !J.interior) { const f = pontoMundo(pm.interior); return { x: f.x, z: f.z, cor: '#ffd23f', rotulo: INTERIORES[pm.interior].nome }; }
  if (m?.tipo === 'portais') { const p = portais.alvo(); if (p) return { x: p.x, z: p.z, cor: '#ffd23f', rotulo: 'Portal' }; }
  if (m?.alvo === 'cortex') {
    const dentroLab = LAB_B.plano.dentro(P.x, P.z, P.y);
    const e = LAB_B.plano.entrada;
    return dentroLab ? { x: LAB_B.cx, z: LAB_B.cz, cor: '#ffd23f', rotulo: 'Cortex' } : { x: e.x, z: e.z - 4, cor: '#ffd23f', rotulo: 'S.T.A.R. Labs' };
  }
  if (m?.alvoSala) {
    const s = LAB_B.plano.pontosDeInteresse.find((q) => q.nome === m.alvoSala), e = LAB_B.plano.entrada;
    return LAB_B.plano.dentro(P.x, P.z, P.y) && s ? { x: s.x, z: s.z, cor: '#ffd23f', rotulo: NOME_SALA[m.alvoSala] || m.titulo } : { x: e.x, z: e.z - 4, cor: '#ffd23f', rotulo: 'S.T.A.R. Labs' };
  }
  if (m?.alvo === 'fenda') { const f = tempo.alvoFenda(P); if (f) return f; }
  if (m?.pistas) { const k = Math.min(m.pistas.length - 1, missoes.progresso()?.n ?? 0), w = pontoMundo(m.ponto); return { x: w.x + m.pistas[k][0], z: w.z + m.pistas[k][1], cor: '#ffd23f', rotulo: `Pista ${k + 1}/${m.pistas.length}` }; }
  if (m?.ponto) { const w = pontoMundo(m.ponto); return { x: w.x + Math.sin(w.h) * 3, z: w.z + Math.cos(w.h) * 3, cor: '#ffd23f', rotulo: m.titulo }; }
  if (m?.alvo === 'subestacao') { const s = SUBESTACOES[Math.min(SUBESTACOES.length - 1, missoes.progresso()?.n ?? 0)]; return { x: s.x, z: s.z, cor: '#ffd23f', rotulo: 'Subestação' }; }
  if (m?.alvo === 'labPassado') { const e = LAB_B.plano.entrada; return { x: e.x, z: e.z - 4, cor: '#ffb347', rotulo: 'S.T.A.R. Labs — seis semanas atrás' }; }
  if (m?.alvo === 'predioAlto') { const p = predioAltoPerto(); if (p) return { ...p, cor: '#ffd23f', rotulo: 'Prédio de 50 m' }; }
  if (m?.alvo === 'esfera') { const o = esferaMaisPerto(); if (o) return { x: o.x, z: o.z, cor: '#3fd0ff', rotulo: 'Esfera' }; }
  return null;
}
// para onde a bússola aponta: o objetivo do guia ou a esfera mais perto
function alvoAtual() {
  const a = alvoMissao(); if (a) return a;
  const o = esferaMaisPerto(); return o ? { x: o.x, z: o.z, cor: '#3fd0ff' } : null;
}
function atualizarBussola() {
  const melhor = alvoAtual();
  if (!melhor) { el.dist.textContent = '—'; return; }
  const md = Math.hypot(melhor.x - P.x, melhor.z - P.z);
  el.seta.querySelector('path').setAttribute('fill', melhor.cor);
  const fx = Math.sin(C.yaw), fz = Math.cos(C.yaw), dx = melhor.x - P.x, dz = melhor.z - P.z;
  const sx = dx * -fz + dz * fx, sy = dx * fx + dz * fz;
  el.seta.style.transform = `rotate(${Math.atan2(sx, sy)}rad)`;
  el.dist.textContent = md >= 1000 ? `${(md / 1000).toFixed(1)} km` : `${Math.round(md)} m`;
}

// ---------- missões, crimes e portais ----------
let armazem = null; try { armazem = localStorage; } catch { armazem = null; }
try { ESTEIRA.recorde = Math.max(ESTEIRA.recorde, Number(armazem?.getItem('theflash.esteira.v1')) || 0); } catch { /* sem armazenamento */ }
// "Recomeçar a história do zero" (pausa): a página anterior marcou o pedido e recarregou; o progresso some AQUI, antes de
// qualquer módulo ler o que está gravado (assim nada que a página velha ainda grave antes de sair volta a valer)
const PROGRESSO = ['theflash.missoes.v2', 'theflash.missoes.v1', 'theflash.historia.v1', 'theflash.viloes.v1'];   // missoes.js, historia.js, viloes.js
try { if (sessionStorage.getItem('theflash.recomecar')) { sessionStorage.removeItem('theflash.recomecar'); for (const k of PROGRESSO) armazem?.removeItem(k); } } catch { /* sem armazenamento */ }
const missoes = criarMissoes(armazem);
const combate = criarCombate(cena, { mobile: MOBILE, colide: (x, z, y) => empurrar(rectsPerto, x, z, 0.35, y, 1.7), chao: (x, z, y) => chaoEm(rectsPerto, x, z, y) });
const crimes = criarCrimes(cena, { combate });
const guia = criarGuia(cena, { mobile: MOBILE });
const viloes = criarViloes(cena, { mobile: MOBILE, aniso: ANISO, combate, armazem, avisar: (t, r, k) => avisar(t, r, k),
  colide: (x, z, y) => empurrar(rectsPerto, x, z, 0.4, y, 1.8), chao: (x, z, y) => chaoEm(rectsPerto, x, z, y),
  labPos: { x: LAB_B.plano.entrada.x, z: LAB_B.plano.entrada.z - 9 } });
const portais = criarPortais(cena);
// os vilões do dia a dia (rivais.js): opcionais, só com nada em andamento
const rivais = criarRivais(cena, { mobile: MOBILE, aniso: ANISO, combate, fx: combate.efeitos, avisar: (t, r, k) => avisar(t, r, k) });
const trafego = criarTrafego(THREE, cena, { mobile: MOBILE });
const pedestres = criarPedestres(THREE, cena, { mobile: MOBILE });
// os objetos da rua: hidrantes, lixeiras, caixas de jornal, carrinhos de cachorro-quente e pombos (objetos.js)
const objetos = criarObjetos(), objetos3d = criarObjetos3d(THREE, cena, { mobile: MOBILE });
const LANCHES = ['O vendedor nem viu a nota sair da mão', 'Três cachorros-quentes em meio segundo', 'O metabolismo do velocista agradece', 'Com mostarda, sem parar de correr'];
function passoObjetos(dt) {
  const lista = objetos.perto(P.x, P.z);
  for (const ev of objetos.atualizar(dt, P, lista)) {
    if (ev.tipo === 'lanche') { P.energia = Math.min(1, P.energia + ev.energia); avisar('Cachorro-quente', `+${Math.round(ev.energia * 100)}% de energia · ${LANCHES[(J.lanches = (J.lanches || 0) + 1) % LANCHES.length]}`, 'ok'); }
    else if (ev.tipo === 'hidrante') combate.efeitos.clarao(ev.o.x, 1, ev.o.z, 1.6, 0.25);
  }
  objetos3d.atualizar(lista, objetos.estado, objetos.t);
}
function solidoEm() {
  for (const q of rectsPerto) if (q.y0 >= 0 && q.y1 - q.y0 > 4 && P.x > q.x0 && P.x < q.x1 && P.z > q.z0 && P.z < q.z1 && P.y + 0.9 > q.y0 && P.y + 0.9 < q.y1) return q;
  return null;
}
function passoMissoes(dt) {
  // prédios atravessados vibrando: conta ao sair do outro lado
  const q = P.vibrando ? solidoEm() : null;
  if (J.dentroQ && q !== J.dentroQ && !q) missoes.contar('atravessados');
  J.dentroQ = q;
  const m = missoes.atual;
  if (m?.tipo === 'portais') portais.ativar(); else portais.desativar();
  const rp = portais.atualizar(dt, P);
  if (rp?.falhou) avisar('Volte ao 1º portal', 'Tempo esgotado', 'alerta');
  // crimes: durante a história só os que o passo pede (e quaisquer no "Guardião da cidade"); com a história terminada, a cidade é livre
  const querCrime = m?.crime || m?.id === 'patrulha' || missoes.livre || crimes.ativo;   // um crime já em andamento sempre termina
  // um objetivo de cada vez (dono, 26/10: "não pode vir outra missão nem crime enquanto eu estiver dentro de uma missão ou
  // objetivo"): crime novo só com a cena e o rádio do passo terminados, sem cronômetro, corrida de portais ou vilão em cena
  const ocupado = !!(J.cenaPendente || J.cron || (m?.tipo === 'portais' && portais.estado().correndo) || !historia.radioLivre || J.esteira || rivais.ativo?.estado === 'luta');
  const crAntes = crimes.ativo && { x: crimes.ativo.x, z: crimes.ativo.z };
  const ev = viloes.ativo || tempo.epoca === 'passado' || J.interior || !querCrime || (!crimes.ativo && ocupado) ? null : crimes.atualizar(dt, P, { forcar: m?.crime });
  if (ev?.inicio) avisar(ev.nome, 'Crime na cidade', 'crime');
  else if (ev) {
    if (ev.ok) { missoes.contar('crimes'); missoes.contar(ev.tipo); missoes.contar('pontos', 250); avisar(`${ev.nome} impedido`, '+250 pontos', 'ok'); J.festaPed = crAntes || { x: P.x, z: P.z }; }
    else avisar(ev.tipo === 'queda' ? 'Não chegou a tempo' : 'O criminoso escapou', ev.nome, 'alerta');
  }
  const sala = LAB_B.plano.dentro(P.x, P.z, P.y);
  // Ato 3: fendas, túnel do tempo e a noite do acidente
  if (m?.id === 'fendas') {
    if (!tempo.fendasLigadas) tempo.ligarFendas(true);
    const n = tempo.passoFendas(dt, P);
    if (n) { missoes.contar('fendas', n); const pr = missoes.progresso(); avisar('Fenda fechada', pr ? pr.txt : '', 'ok'); }
  } else if (tempo.fendasLigadas) tempo.ligarFendas(false);
  if (m?.tipo === 'tunel') {
    if (m.id === 'tunel') tempo.prepararReverso();                    // o Reverso do passado já vai sendo carregado
    const v = Math.hypot(P.vx, P.vz) * 3.6;
    J.tunelT = v >= 180 && !P.parede ? (J.tunelT || 0) + dt : Math.max(0, (J.tunelT || 0) - dt * 0.6);
    if (J.tunelT > 0.5 && Math.random() < dt * J.tunelT * 4) { const a = Math.random() * 6.28; combate.efeitos.raio(P.x, P.y + 1, P.z, P.x + Math.cos(a) * 4, P.y + 1 + Math.random() * 3, P.z + Math.sin(a) * 4, { vida: 0.15, desvio: 0.6, r: 2.2, g: 1.6, b: 0.5 }); }
  }
  if (m?.id === 'passado' && tempo.epoca !== 'passado' && !J.cenaAcidente) irAoPassado(true);   // recarregou a página no meio: volta para lá
  if (m?.id === 'passado' && tempo.epoca === 'passado' && !J.cenaAcidente) {
    const e = LAB_B.plano.entrada;
    if (Math.hypot(P.x - e.x, P.z - (e.z - 6)) < 28 && tempo.focoReverso()) {
      J.cenaAcidente = true;
      // o herói fica 5 m à frente dele, do lado da rua (o laboratório e a cerca estão atrás do Reverso)
      const r = tempo.lugarDoReverso, q = empurrar(rectsPerto, r.x, r.z - 5, 0.4, 0, 1.8);
      P.x = q.x; P.z = q.z; P.y = chaoEm(rectsPerto, P.x, P.z, 1); P.vx = P.vz = 0;
      P.h = Math.atan2(r.x - P.x, r.z - P.z);
      rodarCena('acidente', { heroi: focoHeroi, reverso: () => tempo.focoReverso() }, () => rodarCena('volta-tunel', focosCena(), voltarDoPassado), { aoAcao: (a) => { if (a === 'explosao') tempo.explodir(); } });
    }
  }
  // Parte 2: a linha do tempo alterada (missoes.js `epoca`): o mundo entra nela quando o passo começa, depois da cena do
  // passo anterior (a viagem no túnel), e sai do mesmo jeito
  if (tempo.epoca !== 'passado' && !J.cenaPendente && !J.cenaPasso && J.modo === 'jogando') { const ep = m?.epoca || 'presente'; if (tempo.epoca !== ep) mudarEpoca(ep); }
  // o Corredor Negro atrás do herói: raios pálidos caindo logo atrás dele enquanto o cronômetro corre
  if (m?.id === 'p2-fuga' && J.cron && !J.interior && !J.cenaPendente) {
    J.raioNegro = (J.raioNegro ?? 1) - dt;
    if (J.raioNegro <= 0) {
      J.raioNegro = 0.8 + Math.random() * 0.8;
      const a = P.h + Math.PI + (Math.random() - 0.5) * 1.3, r = 7 + Math.random() * 10, x = P.x + Math.sin(a) * r, z = P.z + Math.cos(a) * r, y = chaoEm(rectsPerto, x, z, P.y + 2);
      combate.efeitos.raio(x, y + 30, z, x, y + 0.2, z, { vida: 0.35, desvio: 2.2, r: 1.45, g: 1.5, b: 1.7 }); combate.efeitos.clarao(x, y + 1, z, 3, 0.35);
    }
  }
  // "Apagão": religar as subestações na ordem (o guia leva à próxima); a cidade fica escura até a última
  const emEnergia = m?.alvo === 'subestacao', nSub = emEnergia ? Math.min(subest.length, missoes.progresso()?.n ?? 0) : 0;
  subest.forEach((s, k) => { s.g.visible = emEnergia; s.luz.material.color.setHex(k < nSub ? 0x30ff60 : 0xff2a20); });
  if (emEnergia && nSub < subest.length && Math.hypot(P.x - subest[nSub].x, P.z - subest[nSub].z) < 6) {
    const s = subest[nSub]; missoes.contar('subestacoes'); missoes.contar('pontos', 100);
    for (let i = 0; i < 10; i++) { const a = Math.random() * 6.28; combate.efeitos.raio(s.x, 2, s.z, s.x + Math.cos(a) * 5, 0.5 + Math.random() * 4, s.z + Math.sin(a) * 5, { vida: 0.35, desvio: 1, r: 2.2, g: 1.7, b: 0.6 }); }
    const pr = missoes.progresso(); avisar('Subestação religada', pr ? pr.txt : '', 'ok');
  }
  J.apagao = emEnergia ? 1 - nSub / subest.length : 0;
  // a vida do Barry (missoes.js): a roupa do passo (o traje em toda luta) e o cronômetro (acabou: recomeça, ou volta um passo)
  const roupa = viloes.ativo ? 'traje' : ((J.cenaPasso || m)?.roupa || 'traje');
  if (roupa !== J.roupa) vestir(roupa);
  if (m?.tempo && !J.cenaPendente) {
    if (J.cron?.id !== m.id) J.cron = { id: m.id, resto: m.tempo };
    J.cron.resto -= dt;
    if (J.cron.resto <= 0) {
      avisar('Tempo esgotado', m.falha ? 'Volte e tente de novo' : 'Mais uma chance', 'alerta'); historia.radio(`falhou-${m.id}`, { sempre: true });
      if (m.falha) { J.cron = null; missoes.irPara(m.falha); return; }
      J.cron.resto = m.tempo;
    }
  } else if (J.cron && J.cron.id !== m?.id) J.cron = null;
  // as pistas da perícia, uma de cada vez: parar em cima do marcador amarelo examina
  if (m?.pistas) {
    const k = Math.min(m.pistas.length - 1, missoes.progresso()?.n ?? 0), [du, dv, nome, desc] = m.pistas[k], w = pontoMundo(m.ponto), x = w.x + du, z = w.z + dv;
    if (J.pistaK !== `${m.id}:${k}`) { J.pistaK = `${m.id}:${k}`; J.pistaY = chaoEm(retangulosPerto(x, z, 0), x, z, 2); }
    vida.pista(x, J.pistaY, z, P.t);
    if (Math.hypot(P.x - x, P.z - z) < 2.6 && Math.abs(P.y - J.pistaY) < 3 && Math.hypot(P.vx, P.vz) < 15) {
      missoes.contar('pistas'); combate.efeitos.clarao(x, J.pistaY + 0.6, z, 2.2, 0.3);
      avisar(nome, `Pista ${k + 1}/${m.pistas.length} · ${desc}`, 'ok');
    }
  } else vida.pista(null);
  // as ameaças: o gelo sobe em volta da Iris com o relógio; a tempestade do Mago cerca a casa dos West
  if (m?.id === 'ameaca-iris' && J.cron) { const w = pontoMundo('mesaIris'); vida.poeGelo(w.x, w.y, w.z, 1 - J.cron.resto / m.tempo); }
  else if (!J.cenaPendente) vida.poeGelo(null);
  if (m?.id === 'ameaca-joe' && J.cron && !J.interior) { const w = pontoMundo('casa'); vida.tempestade(dt, w.x, w.z + 6, P, 1 - J.cron.resto / m.tempo); }
  // passo num lugar da cidade: chegou perto do ponto (raio do passo)
  const pw = m?.ponto ? pontoMundo(m.ponto) : null, perto = !!pw && Math.hypot(P.x - pw.x, P.z - pw.z) < (m.raio ?? 9) && Math.abs(P.y - (pw.y ?? P.y)) < 6;
  const feita = missoes.avaliar({ sala, v: Math.hypot(P.vx, P.vz), y: P.y, noChao: P.noChao, portaisFeitos: rp?.feito, perto,
    vencido: (id) => viloes.vencido(id), tunel: (J.tunelT || 0) / 5, voltouDoPassado: !!J.voltouDoPassado });
  if (feita) {
    avisar(feita.titulo, 'Missão concluída', 'missao'); historia.missao(feita.id, 'fecha');
    const abrir = () => { if (missoes.atual) historia.missao(missoes.atual.id, 'abre'); };
    // cena da história depois da missão: entra quando o rádio termina de falar (com o Joe/Iris, eles ficam até ela acabar)
    if (historia.tem(`depois-${feita.id}`) && !historia.viu(`cena:depois-${feita.id}`)) {
      J.cenaPendente = { id: `depois-${feita.id}`, depois: abrir, passo: feita.aliados ? feita : null };
      if (feita.aliados) J.cenaAliados = feita;
      J.cenaPasso = feita;                             // (a roupa do passo vale até a cena dele acabar)
    } else abrir();
  }
  // a cena que abre um passo (missoes.js `cenaAbre`: o começo da Parte 2), uma vez
  const mAgora = missoes.atual;
  if (mAgora?.cenaAbre && !J.cenaPendente && !J.cenaPasso && !historia.viu(`cena:${mAgora.cenaAbre}`)) J.cenaPendente = { id: mAgora.cenaAbre, depois: () => {}, passo: null };
  if (J.cenaPendente && historia.radioLivre && !viloes.emLuta) {
    const c = J.cenaPendente; J.cenaPendente = null;
    if (c.passo) {                                   // o herói para de frente para quem vai falar
      aliados.posicionar(c.passo.aliados); const d = aliados.diante();
      if (d) { const R = retangulosPerto(d.x, d.z, 1), q = empurrar(R, d.x, d.z, 0.4, d.y ?? 0, 1.8); Object.assign(P, { x: q.x, z: q.z, y: chaoEm(R, q.x, q.z, (d.y ?? 0) + 1), vx: 0, vz: 0, vy: 0, h: d.h, noChao: true, parede: null, vibrando: false }); C.yaw = d.h; }
    }
    rodarCena(c.id, focosCena(), () => { J.cenaAliados = null; J.cenaPasso = null; c.depois(); });
  }
  // painel
  const ma = missoes.atual, pr = missoes.progresso();
  el.missaoNum.textContent = ma ? `História ${missoes.indice + 1}/${missoes.total} · ${missoes.stats.pontos} pts` : `Cidade livre · ${missoes.stats.pontos} pts`;
  el.missaoTitulo.textContent = ma ? ma.titulo : 'História concluída';
  let txt = ma ? ma.texto + (pr ? ` (${pr.txt})` : '') : 'Impeça os crimes da cidade';
  const cron = J.cron && ma?.id === J.cron.id ? J.cron : null;
  if (cron) txt = `${ma.texto} · ${Math.max(0, Math.ceil(cron.resto))} s`;
  el.missao.classList.toggle('urgente', !!cron && cron.resto < 10);
  if (ma?.tipo === 'portais') { const e = portais.estado(); txt = e.correndo ? `Portal ${e.indice + 1}/${e.total} · ${Math.ceil(e.restante)} s` : ma.texto; }
  if (ma?.tipo === 'tunel') txt = `Túnel do tempo ${Math.round(Math.min(1, (J.tunelT || 0) / 5) * 100)}% · fique acima de 180 km/h`;
  el.missaoTexto.textContent = txt;
  const c = crimes.ativo;
  if (c) { const d = Math.round(Math.hypot(c.x - P.x, c.z - P.z)); el.crimeLinha.textContent = `${c.nome}: ${c.texto}${c.tipo === 'incendio' ? ` (${Math.round((c.progresso || 0) * 100)}%)` : ''}${c.tipo === 'gangue' ? ` (${c.restantes ?? c.total} de pé)` : ''} · ${d} m · ${Math.max(0, Math.ceil(c.restante))} s`; el.crimeLinha.hidden = false; }
  else el.crimeLinha.hidden = true;
}

// ---------- golpes ----------
function direcaoPedida() {
  const { ix, iz, m } = entradaMov();
  const fx = Math.sin(C.yaw), fz = Math.cos(C.yaw);
  if (m > 0.1) return [fx * iz - fz * ix, fz * iz + fx * ix];
  return [fx, fz];
}
function processarGolpes() {
  if (pedidoBater) { pedidoBater = false; if (!P.parede) { P.vibrando = false; const [dx, dz] = direcaoPedida(); combate.bater(P, dx, dz); } }
  if (pedidoEspecial) {
    // apertado no meio de um soco: espera o soco acabar (até 0,6 s)
    if (combate.ocupado) { if (!J.espT) J.espT = P.t; if (P.t - J.espT > 0.6) { pedidoEspecial = null; J.espT = 0; } return; }
    const t = pedidoEspecial; pedidoEspecial = null; J.espT = 0;
    if (P.parede) return;
    if (P.energia < ESPECIAIS[t].custo) { avisar(`${ESPECIAIS[t].nome} precisa de ${Math.round(ESPECIAIS[t].custo * 100)}%`, 'Energia insuficiente', 'alerta'); return; }
    P.vibrando = false; const [dx, dz] = direcaoPedida(); combate.especial(t, P, dx, dz);
  }
}
const botoesEsp = Object.keys(ESPECIAIS).map((t) => [t, $(`bt-${t}`), $(`chip-${t}`)]);
function atualizarBotoesEspeciais() {
  for (const [t, b, c] of botoesEsp) { const ok = P.energia >= ESPECIAIS[t].custo; b?.classList.toggle('pronto', ok); c?.classList.toggle('pronto', ok); }
}

// ---------- história: cenas e rádio (historia.js) ----------
const historia = criarHistoria({ armazem });
const focoHeroi = () => ({ x: P.x, y: P.y, z: P.z });
// a equipe do S.T.A.R. Labs (Caitlin e Cisco) no Cortex
const tempo = criarTempo(cena, { mobile: MOBILE, aniso: ANISO, fx: combate.efeitos, lab: { cx: LAB_B.cx, cz: LAB_B.cz, entrada: LAB_B.plano.entrada }, chao: (x, z, y) => chaoEm(rectsPerto, x, z, y) });
const equipe = criarEquipe(cena, { mobile: MOBILE, aniso: ANISO, renderer, lab: LAB_B, aoRetrato: (id, url) => historia.definirRetrato(id, url) });   // os retratos vão prontos (tools/gerar-retratos.mjs)
const noCortex = () => LAB_B.plano.dentro(P.x, P.z, P.y) === 'cortex';
// o Joe e a Iris, nos lugares da história (o passo atual diz onde; a cena do passo segura eles até acabar)
const contencao = criarContencao(cena, { mobile: MOBILE, aniso: ANISO, lab: LAB_B });     // os vilões vencidos presos nas celas
const aliados = criarAliados(cena, { mobile: MOBILE, aniso: ANISO, chao: (x, z) => chaoEm(retangulosPerto(x, z, 0), x, z, 2) });
// a vida do Barry: a pista da perícia, o gelo do Frio, a tempestade do Mago e os raios da noite do raio (vida.js)
const vida = criarVida(cena, { fx: combate.efeitos, mobile: MOBILE });
// as subestações do "Apagão": armário com a luz vermelha (desligada) ou verde (religada)
const subest = SUBESTACOES.map((s) => {
  const g = new THREE.Group(); g.position.set(s.x, CALCADA, s.z);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.9, 0.9).translate(0, 0.95, 0), new THREE.MeshStandardMaterial({ color: 0x55605a, roughness: 0.7, metalness: 0.3 })));
  const luz = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2a20 })); luz.position.set(0, 2.05, 0); g.add(luz);
  g.visible = false; cena.add(g); return { ...s, g, luz };
});
/** os focos de uma cena: o herói e, com ele no Cortex, a Caitlin e o Cisco (quem não está lá fala pelo rádio) */
const focosCena = () => {
  const fs = { heroi: focoHeroi, joe: () => aliados.foco('joe'), iris: () => aliados.foco('iris'), vulto: () => aliados.foco('vulto'), reverso: () => aliados.foco('reverso'), negro: () => aliados.foco('negro') };
  for (const id of ['caitlin', 'cisco']) fs[id] = () => (equipe.pronta && noCortex() && tempo.epoca !== 'ignicao' ? equipe.focos()[id]() : aliados.foco(id));
  return fs;
};
/** cenas que mexem no mundo: o túnel do tempo aparece em volta do herói correndo */
const GANCHOS_CENA = {
  // a noite do raio: o Joe vai embora, o vulto aparece no canto escuro da perícia, faíscas, e o raio do Núcleo atravessa tudo
  'noite-do-raio': { aoAcao: (a) => {
    if (a === 'joeSai') J.cenaAliados = { aliados: {} };
    if (a === 'vulto') J.cenaAliados = { aliados: { vulto: 'cantoCsi' } };
    if (a === 'tempestade') { vida.faiscas(P); clarear(0.15); }
    if (a === 'raio') { vida.raioNoite(P, INTERIORES.delegacia.teto); clarear(0.85); J.cenaAliados = { aliados: {} }; }
  } },
  'depois-ameaca-iris': { aoAcao: (a) => { if (a === 'quebraGelo') { const w = pontoMundo('mesaIris'); vida.quebrarGelo(w.x, w.y, w.z); } } },
  // o homem de amarelo some da cozinha num raio vermelho
  'depois-visita': { aoAcao: (a) => {
    if (a !== 'someReverso') return;
    const f = aliados.foco('reverso');
    if (f) for (let i = 0; i < 10; i++) { const g = Math.random() * 6.28; combate.efeitos.raio(f.x, f.y + 0.3 + Math.random() * 1.5, f.z, f.x + Math.cos(g) * 3, f.y + Math.random() * 2, f.z + Math.sin(g) * 3, { vida: 0.4, desvio: 0.7, r: 2.8, g: 0.35, b: 0.2 }); }
    J.cenaAliados = { aliados: {} };
  } },
  // Parte 2: a viagem à noite do fogo (o túnel em volta do herói; o clarão do raio na casa) e o Corredor Negro sumindo
  'depois-p2-tunel': { antes: () => { tempo.tunel = true; J.corridaCena = true; }, aoAcao: (a) => { if (a === 'raioCasa') clarear(0.7); }, depois: () => { tempo.tunel = false; J.corridaCena = false; } },
  'depois-p2-desfazer': { antes: () => { tempo.tunel = true; J.corridaCena = true; }, aoAcao: (a) => { if (a === 'raioCasa') clarear(0.9); }, depois: () => { tempo.tunel = false; J.corridaCena = false; } },
  'depois-p2-silhueta': { aoAcao: (a) => {
    if (a !== 'someNegro') return;
    const f = aliados.foco('negro');
    if (f) { for (let i = 0; i < 12; i++) { const g = Math.random() * 6.28; combate.efeitos.raio(f.x, f.y + 0.3 + Math.random() * 1.6, f.z, f.x + Math.cos(g) * 3.5, f.y + Math.random() * 2, f.z + Math.sin(g) * 3.5, { vida: 0.45, desvio: 0.8, r: 1.45, g: 1.5, b: 1.7 }); } combate.efeitos.onda(f.x, f.y, f.z, 8, 0.6); }
    J.cenaAliados = { aliados: {} };
  } },
  'depois-tunel': { antes: () => { tempo.tunel = true; J.corridaCena = true; }, depois: () => { tempo.tunel = false; J.corridaCena = false; irAoPassado(); } },
  'volta-tunel': { antes: () => { tempo.tunel = true; J.corridaCena = true; }, depois: () => { tempo.tunel = false; J.corridaCena = false; } },
  // o fim: o herói entra no Núcleo (túnel em volta dele), volta, e vêm o epílogo e os créditos
  'depois-nucleo': {
    aoAcao: (a) => { if (a === 'nucleo') { tempo.tunel = true; J.corridaCena = true; } if (a === 'volta') { tempo.tunel = false; J.corridaCena = false; tempo.explodir(); } },
    depois: () => { tempo.tunel = false; J.corridaCena = false; if (historia.viu('cena:depois-nucleo')) mostrarCreditos(); },
  },
};
/** um clarão branco na tela (o raio da noite do raio) */
function clarear(forca = 0.6) {
  el.fade.style.setProperty('--clarao', String(forca)); el.fade.classList.add('branco', 'on');
  setTimeout(() => el.fade.classList.remove('on'), 160); setTimeout(() => el.fade.classList.remove('branco'), 600);
}
/** o prólogo é no Cortex, com a Caitlin e o Cisco (seis semanas depois do raio) */
function prologo() {
  if (historia.vaiTocar('prologo')) { const l = equipe.lugarDoHeroi(); Object.assign(P, { x: l.x, y: l.y, z: l.z, h: l.h }); C.yaw = l.h; atualizarQuarteiroes(P.x, P.z, 999); }
  rodarCena('prologo', focosCena(), () => { if (missoes.atual) historia.missao(missoes.atual.id, 'abre'); });
}
/** a noite do raio (o começo da história, uma vez só): o Barry à paisana na perícia da Delegacia, às onze da noite, com o
 *  Joe; o vulto no canto escuro e o raio do Núcleo. Depois, seis semanas mais tarde, o prólogo no Cortex. */
function noiteDoRaio() {
  const w = pontoMundo('csi');
  Object.assign(P, { x: w.x, y: w.y, z: w.z, h: w.h, vx: 0, vz: 0, vy: 0, noChao: true });
  C.yaw = w.h; J.interior = 'delegacia'; mundo.T = 0.955;
  atualizarQuarteiroes(P.x, P.z, 999); rectsPerto = retangulosPerto(P.x, P.z, 1);
  for (const I of interioresAtivos) I.grupo.visible = I.id === 'delegacia';
  vestir('civil', false); aliados.carregar('vulto');
  J.cenaAliados = { aliados: { joe: 'portaCsi' } };
  rodarCena('noite-do-raio', focosCena(), () => {
    J.cenaAliados = null; J.interior = null; mundo.T = 0.4;
    for (const I of interioresAtivos) I.grupo.visible = false;
    vestir(missoes.atual?.roupa || 'traje', false);
    // quem já viu o prólogo volta para a rua do S.T.A.R. Labs (o prólogo leva ao Cortex)
    if (!historia.vaiTocar('prologo')) { Object.assign(P, { x: INICIO.x, y: 0, z: INICIO.z, h: 0 }); C.yaw = 0; atualizarQuarteiroes(P.x, P.z, 999); rectsPerto = retangulosPerto(P.x, P.z, 1); }
    prologo();
  });
}
/** cena com o jogo parado; quando acaba (ou se já foi vista), `depois` */
function rodarCena(id, foco, depois, opc) {
  P.vx = P.vz = 0; teclas.clear(); stick.x = stick.y = 0; toque.correr = toque.vibrar = false;
  J.modo = 'cena';
  const g = GANCHOS_CENA[id]; g?.antes?.();
  historia.cena(id, foco, () => { J.modo = 'jogando'; g?.depois?.(); depois?.(); }, { ...(opc || {}), aoAcao: opc?.aoAcao || g?.aoAcao });
}
/** a noite do acidente: o relógio para à meia-noite, a coluna do Núcleo acende e o Reverso do passado espera no laboratório */
// ---------- créditos (depois do epílogo) ----------
const CREDITOS = [
  ['A Parte 1: uma história em quatro atos', ''],
  ['Personagens', 'Caitlin · Cisco · Joe · Iris · Zoom · Flash Reverso · Capitão Frio · Onda Térmica · Mago do Tempo · Savitar · DeVoe'],
  ['', 'Nomes inspirados nos personagens da DC. Trajes, rostos, cenários e enredo deste jogo são desenhos próprios. Jogo de fã, sem fins lucrativos.'],
  ['Corpos e rostos', 'Microsoft Rocketbox Avatar Library (licença MIT)'],
  ['Motor 3D', 'three.js (licença MIT)'], ['Fontes', 'Rajdhani e Inter (SIL Open Font License)'],
  ['Feito com', 'Claude'], ['', ''], ['Obrigado por jogar', 'Feche os créditos: a Parte 2 começa três meses depois.'],
];
function mostrarCreditos() {
  let c = document.getElementById('creditos');
  if (!c) {
    c = document.createElement('div'); c.id = 'creditos';
    c.innerHTML = `<div class="rolo"><img class="logo-fim" src="assets/logo/logo.webp" alt="THE FLASH">${CREDITOS.map(([t, d]) => `<section>${t ? `<h3>${t}</h3>` : ''}${d ? `<p>${d}</p>` : ''}</section>`).join('')}</div><button type="button" class="pular">Fechar</button>`;
    document.body.appendChild(c);
    c.addEventListener('pointerdown', (e) => { e.stopPropagation(); fecharCreditos(); });
  }
  c.hidden = false; c.classList.remove('rola'); void c.offsetWidth; c.classList.add('rola');
  J.modo = 'creditos'; J.creditosT = 0;
}
function fecharCreditos() {
  const c = document.getElementById('creditos'); if (!c || c.hidden) return;
  c.hidden = true; J.modo = 'jogando'; avisar('A cidade é sua', 'Patrulha livre', 'ok');
}
/** Parte 2: entra ou sai da linha do tempo alterada (o Ponto de Ignição): crepúsculo parado, outras cores, ninguém no Cortex */
function mudarEpoca(ep) {
  if (ep === 'ignicao') { J.tAntesIg = mundo.T; mundo.T = 0.77; tempo.definirEpoca('ignicao'); avisar('Ponto de Ignição', 'Uma linha do tempo que não deveria existir', 'info'); }
  else { tempo.definirEpoca('presente'); mundo.T = J.tAntesIg ?? 0.45; avisar('A linha do tempo de volta', 'Presente', 'info'); }
}
function irAoPassado(silencioso = false) {
  if (tempo.epoca === 'passado') return;
  J.tAntes = mundo.T; mundo.T = 0.02; tempo.prepararReverso(); tempo.definirEpoca('passado');
  if (!silencioso) avisar('A noite do acidente', 'Seis semanas atrás', 'info');
}
function voltarDoPassado() {
  tempo.definirEpoca('presente'); mundo.T = J.tAntes ?? 0.45; J.voltouDoPassado = true;
  avisar('De volta ao presente', 'Túnel do tempo', 'info');
}
/** os focos da câmera numa cena com os vilões: o herói e cada vilão do capítulo */
const focosVilao = () => ({ ...focosCena(), ...Object.fromEntries(viloes.ids.map((v) => [v, () => viloes.foco(v)])) });
/** no encontro, o herói fica a poucos metros do vilão, de frente para ele (a conversa cabe no quadro) */
function aproximarHeroi(d = 4.8) {
  const f = viloes.foco(); if (!f) return;
  const dx = P.x - f.x, dz = P.z - f.z, n = Math.hypot(dx, dz) || 1;
  if (n > d) {
    const r = empurrar(rectsPerto, f.x + (dx / n) * d, f.z + (dz / n) * d, 0.4, 0, 1.8);
    P.x = r.x; P.z = r.z; P.y = chaoEm(rectsPerto, P.x, P.z, 1); P.vy = 0; P.noChao = true; P.parede = null;
  }
  P.h = Math.atan2(f.x - P.x, f.z - P.z); P.vibrando = false;
  viloes.encarar(P);
}
function eventoVilao(ev) {
  const id = ev.id;
  if (ev.tipo === 'dano') J.danoVilao = 1;
  else if (ev.tipo === 'capitulo') rodarCena(`cap-${id}`, focosCena(), () => historia.radio(`capitulo-${id}`, { sempre: true }));
  else if (ev.tipo === 'encontro') { aproximarHeroi(); rodarCena(`encontro-${id}`, focosVilao(), () => { viloes.continuar(); historia.radio(`perseguicao-${id}`); }); }
  else if (ev.tipo === 'captura') historia.provocar(id, ev.n);
  else if (ev.tipo === 'luta') historia.radio(`luta-${id}`);
  else if (ev.tipo === 'fase2') historia.radio(`fase2-${id}`, { sempre: true });
  else if (ev.tipo === 'armadura') historia.radio(`armadura-${id}`, { sempre: true });
  else if (ev.tipo === 'escudo-caiu') historia.radio(`escudo-${id}`, { sempre: true });
  else if (ev.tipo === 'derrota') historia.radio(`derrota-${id}`, { sempre: true });
  else if (ev.tipo === 'escapou') historia.radio(`escapou-${id}`, { sempre: true });
  else if (ev.tipo === 'derrotado') rodarCena(`derrotado-${id}`, focosVilao(), () => viloes.continuar());
  else if (ev.tipo === 'vitoria') { missoes.contar('pontos', id === 'final' ? 5000 : 2000); J.festaPed = { x: P.x, z: P.z }; }
}

// ---------- laço ----------
const relogio = new THREE.Clock();
const RETRATO = matchMedia('(orientation: portrait)');
const emPe = () => TOQUE && RETRATO.matches;     // celular em pé: o jogo fica parado até deitar
function ajustarResolucao(dtBruto) {
  if (J.modo !== 'jogando' || dtBruto > 0.5) return;            // aba escondida, carga, pausa: não conta
  RES.media += (dtBruto - RES.media) * 0.05;
  if (++RES.conta < 45) return;                                  // decide a cada ~45 quadros
  RES.conta = 0;
  let pr = RES.pr;
  if (RES.media > 1 / 34 && pr > RES.min) pr = Math.max(RES.min, pr - 0.15);
  else if (RES.media < 1 / 56 && pr < RES.max) pr = Math.min(RES.max, pr + 0.1);
  if (pr !== RES.pr) { RES.pr = pr; renderer.setPixelRatio(pr); redimensionar(); }
}
function quadro() {
  requestAnimationFrame(quadro);
  const dtBruto = relogio.getDelta();
  let dt = Math.min(dtBruto, 0.05);
  if (combate.hitstop > 0) { combate.hitstop -= dt; dt *= 0.12; }      // impacto: o tempo quase para por um instante
  conferirTela();
  ajustarResolucao(dtBruto);
  if (emPe()) { teclas.clear(); stick.x = stick.y = 0; toque.correr = toque.vibrar = false; return; }
  if (J.modo === 'jogando') {
    if (tempo.epoca === 'presente') mundo.T = (mundo.T + dt / DIA_SEGUNDOS) % 1;   // no passado: a noite do acidente, parada
    processarGolpes();
    passoHeroi(dt); passoEsteira(dt); esferasProximas(dt);
    for (const ev of combate.passo(dt, P)) {
      if (ev.tipo === 'nocaute') { missoes.contar('nocautes'); missoes.contar('pontos', 50); if (ev.especial) missoes.contar('especiais'); }
      else if (ev.tipo === 'dano') { el.dano.style.opacity = '1'; }
    }
    for (const ev of viloes.atualizar(dt, P, { capitulo: missoes.atual?.capitulo, podeComecar: !crimes.ativo && !J.cenaPendente && !J.cron && !J.interior && historia.radioLivre && tempo.epoca !== 'passado' && rivais.ativo?.estado !== 'luta' })) eventoVilao(ev);
    J.danoVilao = Math.max(0, (J.danoVilao || 0) - dt * 2);
    el.missao.hidden = viloes.ativo; el.corpo.classList.toggle('capitulo', viloes.ativo);
    el.dano.style.opacity = String(Math.min(1, Math.max(combate.dano, J.danoVilao)));
    atualizarBotoesEspeciais();
    passoMissoes(dt); passoInteriores(dt);
    { // os vilões do dia a dia: aparecem só com o herói solto (depois do Zoom), nada em andamento
      const m = missoes.atual, livre = !J.cenaPendente && !J.cron && historia.radioLivre && !crimes.ativo && !viloes.ativo && !J.interior && !J.esteira && tempo.epoca === 'presente'
        && !(m?.tipo === 'portais' && portais.estado().correndo) && !m?.capitulo && (viloes.vencido('zoom') || missoes.livre);
      for (const ev of rivais.atualizar(dt, P, { pode: livre })) {
        if (ev.tipo === 'dano') J.danoVilao = 1;
        if (ev.tipo === 'vencido') { missoes.contar('pontos', 300); missoes.contar('rivais'); }
      }
    }
    { // as pessoas fogem do perigo (o vilão do dia, o crime, os vilões da história) e comemoram a vitória do herói
      const perigos = [], r = rivais.ativo, cr = crimes.ativo;
      if (r) { perigos.push(r); J.rivPos = { x: r.x, z: r.z }; }
      if (cr && cr.x != null && (cr.tipo === 'assalto' || cr.tipo === 'gangue' || cr.tipo === 'incendio')) perigos.push(cr);
      if (viloes.ativo && tempo.epoca !== 'passado') for (const v of viloes.viloes) if (v.x != null) perigos.push(v);
      J.rivVenc ??= rivais.vencidos;
      if (rivais.vencidos > J.rivVenc) { J.rivVenc = rivais.vencidos; J.festaPed = J.rivPos || { x: P.x, z: P.z }; }
      pedestres.atualizar(dt, P, mundo.noite, { perigos: J.interior ? [] : perigos, festa: J.festaPed }); J.festaPed = null;
    }
    trafego.atualizar(dt, P, mundo.noite, pedestres.pessoas); passoObjetos(dt);
    if (labAtivo) labAtivo.atualizar(dt, P.t, mundo.noite, camera, P);
    for (const e of marcosAtivos) e.atualizar(dt, P.t, mundo);
    atualizarQuarteiroes(P.x, P.z, carregados.size < 30 ? 8 : 2);
    if (J.aviso > 0) { J.aviso -= dt; if (J.aviso <= 0) { el.aviso.classList.remove('vis'); el.aviso.classList.add('sai'); } }
    el.vel.textContent = Math.round((P.parede ? P.parede.v : Math.hypot(P.vx, P.vz)) * 3.6);
    el.vel.parentElement.style.color = Math.hypot(P.vx, P.vz) >= MOV.escalar || P.parede ? '#ffd23f' : '';
    el.nivel.style.width = `${(P.energia * 100).toFixed(1)}%`;
    const h = Math.floor(mundo.T * 24), mi = Math.floor((mundo.T * 24 - h) * 60);
    el.hora.textContent = `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
    if ((quadroMapa++ % 4) === 0) desenharMapa();
    ultBussola += dt; if (ultBussola > 0.2) { ultBussola = 0; atualizarBussola(); }
  }
  historia.atualizar(Math.min(dtBruto, 0.1));
  equipe.atualizar(dt, P, { noCortex: noCortex(), quemFala: J.modo === 'cena' ? historia.quemFala : null, oculto: tempo.epoca === 'ignicao' });
  aliados.posicionar((J.cenaAliados || missoes.atual)?.aliados || null);
  aliados.atualizar(dt, P, { quemFala: J.modo === 'cena' ? historia.quemFala : null });
  contencao.atualizar(dt, P, viloes, { vazia: tempo.epoca === 'ignicao', fora: missoes.livre || missoes.indice >= POS_CINZAS ? FORA_CINZAS : null });
  tempo.atualizar(dt, camera, P, { quemFala: J.modo === 'cena' ? historia.quemFala : null });
  if (J.modo === 'cena') {
    viloes.posar(dt, historia.quemFala); animarHeroi(dt); if (!historia.camera(camera, dt)) atualizarCamera(dt);
    combate.efeitos.atualizar(dt);                                                  // (os raios das cenas)
    for (const I of interioresAtivos) if (I.grupo.visible) I.atualizar(mundo.noite);
  }
  else if (J.modo !== 'menu' || carregados.size) { animarHeroi(J.modo === 'jogando' ? dt : 0); atualizarCamera(dt); }
  if (J.modo === 'jogando') guia.atualizar(dt, alvoMissao(), P, camera);
  else if (J.modo === 'cena') guia.atualizar(dt, null, P, camera);          // na cena, sem feixe nem setas por cima de quem fala
  atualizarAmbiente(camera.position);
  posfx.ajustar(J.modo === 'jogando' ? Math.min(1, Math.max(0, (Math.hypot(P.vx, P.vz) - 20) / 35)) : 0, mundo.noite);
  atualizarSilhueta();
  posfx.render();
}

// O tamanho do desenho segue o tamanho REAL do canvas na tela, conferido a cada quadro. Só o evento 'resize' não bastava:
// ao girar o celular (e na tela cheia, e no app da tela de início do iPhone) ele chega com o innerWidth/innerHeight de
// antes do giro — o desenho ficava com a proporção do celular em pé, esticado na tela deitada ("achatado").
const TAM = new THREE.Vector2();
function medirTela() { return { w: el.cena.clientWidth || innerWidth, h: el.cena.clientHeight || innerHeight }; }
function redimensionar() {
  const { w, h } = medirTela(); if (!w || !h) return;
  renderer.setSize(w, h, false); posfx.tamanho(w, h, RES.pr); camera.aspect = w / h; camera.updateProjectionMatrix();
}
function conferirTela() {   // compara a tela com o que está valendo no desenho e na câmera (não com uma medida guardada)
  const { w, h } = medirTela(); renderer.getSize(TAM);
  if (w !== TAM.x || h !== TAM.y || Math.abs(camera.aspect - w / h) > 1e-3) redimensionar();
}
addEventListener('resize', redimensionar);
addEventListener('orientationchange', () => setTimeout(redimensionar, 300));
visualViewport?.addEventListener('resize', redimensionar);
redimensionar();

// ---------- carga inicial ----------
esferas = todasEsferas(); J.total = esferas.length; el.total.textContent = J.total;
heroi.position.set(INICIO.x, 0, INICIO.z);
camera.position.set(INICIO.x, 4, INICIO.z - 8);
(async function carregar() {
  atualizarQuarteiroes(INICIO.x, INICIO.z, 0);
  const lista = desejados(celulaDe(INICIO.x), celulaDe(INICIO.z), RAIO_CARGA);
  let feitos = 0;
  for (const [i, j] of lista) {
    const k = `${i},${j}`; if (!carregados.has(k)) carregados.set(k, construirBloco(bloco(i, j)));
    if (++feitos % 6 === 0) { el.carga.style.width = `${(feitos / lista.length) * 100}%`; await new Promise((r) => setTimeout(r, 0)); }
  }
  rectsPerto = retangulosPerto(INICIO.x, INICIO.z, 1);
  el.carga.style.width = '100%'; el.carregando.hidden = true; $('barraCarga').hidden = true; el.btnJogar.hidden = false;
  // câmera de vitrine: sobe devagar olhando a avenida
  C.yaw = 0.5; C.pitch = 0.5;
  renderer.compile(cena, camera);
})();
requestAnimationFrame(quadro);

// versão nova publicada: recarrega ao voltar para o jogo (ou no menu)
iniciarAtualizacao({ podeRecarregar: () => J.modo !== 'jogando' });

window.__rel = { equipe, aliados, contencao, rivais, vida, tempo,  avisar, historia, viloes, combate, guia, alvoMissao, ESPECIAIS, camera, cena, sol, posfx, hemi, trafego, pedestres, missoes, crimes, portais, LAB_B, RES, renderer, heroi, P, C, J, CAM, get modelo() { return modelo; }, teclas, stick, reiniciar, carregados, orbesAtivos, esferasColetadas, mundo, desenharMapa, get rects() { return rectsPerto; } };
