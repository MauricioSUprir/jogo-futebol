import * as THREE from 'three';

// ---------- constantes ----------
const FAIXAS = [-3.2, 0, 3.2];
const PISTA = { largura: 11, segmento: 40, qtd: 8 };      // asfalto reciclado
const LONGE = -PISTA.segmento * (PISTA.qtd - 2);           // onde nascem as coisas
const ATRAS = 14;
const PREDIO_VOLTA = 338;                                  // volta do anel de prédios                                          // atrás da câmera: some
const FISICA = { gravidade: 34, pulo: 13.2, alturaNormal: 1.8, alturaDeslize: 0.75, duracaoDeslize: 0.7 };
const VEL = { inicio: 20, max: 52, aceleracao: 0.45 };    // m/s (o "km/h" da tela é só escala)
const FORCA = { escala: 0.35, gasto: 0.2, orbe: 0.1 };
const VIDAS = 3;
const CHAVE_RECORDE = 'relampago.recorde.v1';

// ---------- util ----------
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (v) => v[Math.floor(Math.random() * v.length)];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;

function lerSeguro(chave) { try { return localStorage.getItem(chave); } catch { return null; } }
function gravarSeguro(chave, v) { try { localStorage.setItem(chave, String(v)); } catch { /* sem armazenamento */ } }

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const el = {
  corpo: document.body, cena: $('cena'), dist: $('dist'), vel: $('vel'), pts: $('pts'), vidas: $('vidas'),
  nivel: $('nivel'), combo: $('combo'), btnForca: $('btnForca'), inicio: $('telaInicio'), fim: $('telaFim'),
  fimPts: $('fimPts'), fimDetalhe: $('fimDetalhe'), fimRecorde: $('fimRecorde'), recorde: $('recorde'),
};
if (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) el.corpo.classList.add('toque');

// ---------- cena ----------
const renderer = new THREE.WebGLRenderer({ canvas: el.cena, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setClearColor(0x07080f);
const cena = new THREE.Scene();
cena.fog = new THREE.Fog(0x0a0d1c, 40, 210);
const camera = new THREE.PerspectiveCamera(66, 1, 0.1, 400);
const FOV_BASE = 66;

cena.add(new THREE.HemisphereLight(0x8aa4ff, 0x1a1020, 0.9));
const sol = new THREE.DirectionalLight(0xbfd0ff, 1.1);
sol.position.set(-12, 24, 10);
cena.add(sol);
const luzHeroi = new THREE.PointLight(0xff4d5e, 40, 18, 1.6);
cena.add(luzHeroi);

// céu: gradiente simples numa esfera invertida
{
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'); const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#05060e'); grad.addColorStop(0.55, '#1b1840'); grad.addColorStop(0.8, '#5a2a52'); grad.addColorStop(1, '#ff7a5c');
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const ceu = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 16), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false }));
  ceu.name = 'ceu'; cena.add(ceu);
  // estrelas
  const n = 260, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2), e = rnd(0.25, 1.3), r = 280;
    pos[i * 3] = Math.cos(a) * Math.cos(e) * r; pos[i * 3 + 1] = Math.sin(e) * r; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  cena.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false })));
}

// ---------- texturas procedurais (janelas, asfalto) ----------
function texturaJanelas() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const g = c.getContext('2d'); g.fillStyle = '#10121f'; g.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 256; y += 16) for (let x = 8; x < 128; x += 16) {
    const acesa = Math.random() < 0.45;
    g.fillStyle = acesa ? pick(['#ffd98a', '#ffe9b8', '#9fd6ff', '#ffb36b']) : '#1b2036';
    g.fillRect(x, y, 8, 10);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
const TEX_JANELAS = [texturaJanelas(), texturaJanelas(), texturaJanelas()];

function texturaAsfalto() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512;
  const g = c.getContext('2d'); g.fillStyle = '#23252e'; g.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(${rnd(0, 255) | 0},${rnd(0, 255) | 0},${rnd(0, 255) | 0},0.04)`; g.fillRect(rnd(0, 256), rnd(0, 512), 2, 2); }
  // faixas tracejadas entre as pistas
  g.fillStyle = '#e9e6c8';
  for (const fx of [FAIXAS[0] + 1.6, FAIXAS[1] + 1.6]) {
    const px = ((fx + PISTA.largura / 2) / PISTA.largura) * 256;
    for (let y = 0; y < 512; y += 128) g.fillRect(px - 3, y + 10, 6, 70);
  }
  // linhas de borda
  g.fillStyle = '#ffd23f'; g.fillRect(6, 0, 4, 512); g.fillRect(246, 0, 4, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// ---------- pista ----------
const pistaGrupo = new THREE.Group(); cena.add(pistaGrupo);
const matAsfalto = new THREE.MeshLambertMaterial({ map: texturaAsfalto() });
const matCalcada = new THREE.MeshLambertMaterial({ color: 0x3a3d4d });
const segmentos = [];
for (let i = 0; i < PISTA.qtd; i++) {
  const s = new THREE.Group();
  const asf = new THREE.Mesh(new THREE.PlaneGeometry(PISTA.largura, PISTA.segmento), matAsfalto);
  asf.rotation.x = -Math.PI / 2; s.add(asf);
  for (const lado of [-1, 1]) {
    const calc = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, PISTA.segmento), matCalcada);
    calc.position.set(lado * (PISTA.largura / 2 + 3), 0.2 - 0.0, 0); s.add(calc);
    // faixa de neon na guia
    const neon = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, PISTA.segmento), new THREE.MeshBasicMaterial({ color: lado < 0 ? 0xff2b3d : 0x3fd0ff }));
    neon.position.set(lado * (PISTA.largura / 2 + 0.1), 0.45, 0); s.add(neon);
  }
  s.position.z = -i * PISTA.segmento + PISTA.segmento / 2 - 8;
  pistaGrupo.add(s); segmentos.push(s);
}

// ---------- prédios ----------
const predios = [];
function criarPredio(lado, z) {
  const w = rnd(8, 16), h = rnd(18, 70), d = rnd(14, 30);
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / 8), uv.getY(i) * (h / 8));
  const m = new THREE.MeshLambertMaterial({ map: pick(TEX_JANELAS), emissive: 0xffffff, emissiveMap: null, color: 0x9aa3c8 });
  m.emissiveMap = m.map; m.emissiveIntensity = 0.9;
  const mesh = new THREE.Mesh(g, m);
  mesh.userData = { lado, w, d };
  mesh.position.set(lado * (PISTA.largura / 2 + 6 + w / 2 + rnd(0, 6)), h / 2, z);
  cena.add(mesh); predios.push(mesh);
  return mesh;
}
function reposicionarPredio(p, z) {
  const { lado, w } = p.userData;
  p.position.z = z;
  p.position.x = lado * (PISTA.largura / 2 + 6 + w / 2 + rnd(0, 6));
}
for (let z = 20; z > -300; z -= 26) { criarPredio(-1, z + rnd(-4, 4)); criarPredio(1, z + rnd(-4, 4)); }

// ---------- herói (fictício) ----------
const heroi = new THREE.Group();
const partes = {};
{
  const vermelho = new THREE.MeshStandardMaterial({ color: 0xd9172b, roughness: 0.45, metalness: 0.2, emissive: 0x330005 });
  const ouro = new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.3, metalness: 0.5, emissive: 0x6a4a00 });
  const pele = new THREE.MeshStandardMaterial({ color: 0xe0b08a, roughness: 0.7 });
  const corpo = new THREE.Group(); heroi.add(corpo); partes.corpo = corpo;

  const tronco = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.5, 4, 10), vermelho); tronco.position.y = 1.15; tronco.scale.set(1.05, 1, 0.7); corpo.add(tronco);
  const cinto = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.1, 12), ouro); cinto.position.y = 0.88; cinto.scale.set(1.05, 1, 0.72); corpo.add(cinto);
  // emblema de raio (fictício) no peito
  const raio = new THREE.Shape(); raio.moveTo(0.06, 0.2); raio.lineTo(-0.1, -0.02); raio.lineTo(0, -0.02); raio.lineTo(-0.06, -0.2); raio.lineTo(0.1, 0.02); raio.lineTo(0, 0.02); raio.closePath();
  const emb = new THREE.Mesh(new THREE.ShapeGeometry(raio), new THREE.MeshBasicMaterial({ color: 0xffd23f, side: THREE.DoubleSide }));
  emb.position.set(0, 1.25, 0.25); corpo.add(emb);

  const cabeca = new THREE.Group(); cabeca.position.y = 1.85; corpo.add(cabeca);
  const capuz = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), vermelho); cabeca.add(capuz);
  const rosto = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 8, 0, Math.PI * 2, 0.5, 1.3), pele); rosto.position.set(0, -0.04, 0.1); rosto.scale.set(1, 0.8, 0.7); cabeca.add(rosto);
  for (const l of [-1, 1]) {
    const asa = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.32, 5), ouro);
    asa.position.set(l * 0.25, 0.05, -0.02); asa.rotation.set(0.2, 0, -l * 1.15); cabeca.add(asa);
    const olho = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.025, 0.02), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    olho.position.set(l * 0.075, 0.0, 0.205); cabeca.add(olho);
  }
  partes.cabeca = cabeca;

  function membro(x, y, comp, raioM, mat, bota) {
    const pivo = new THREE.Group(); pivo.position.set(x, y, 0);
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(raioM, comp, 3, 8), mat); m.position.y = -comp / 2 - raioM / 2; pivo.add(m);
    if (bota) { const b = new THREE.Mesh(new THREE.BoxGeometry(raioM * 2, raioM * 1.6, raioM * 3), ouro); b.position.set(0, -comp - raioM * 0.9, raioM * 0.5); pivo.add(b); }
    return pivo;
  }
  partes.pernaE = membro(-0.16, 0.85, 0.5, 0.13, vermelho, true); partes.pernaD = membro(0.16, 0.85, 0.5, 0.13, vermelho, true);
  partes.bracoE = membro(-0.42, 1.5, 0.45, 0.1, vermelho, false); partes.bracoD = membro(0.42, 1.5, 0.45, 0.1, vermelho, false);
  for (const p of [partes.pernaE, partes.pernaD, partes.bracoE, partes.bracoD]) corpo.add(p);
}
cena.add(heroi);

// ---------- rastro de raios ----------
const RASTRO_N = 90;
const rastroPos = new Float32Array(RASTRO_N * 3), rastroVel = new Float32Array(RASTRO_N * 3), rastroVida = new Float32Array(RASTRO_N);
const rastroGeo = new THREE.BufferGeometry(); rastroGeo.setAttribute('position', new THREE.BufferAttribute(rastroPos, 3));
const rastro = new THREE.Points(rastroGeo, new THREE.PointsMaterial({ color: 0xffe066, size: 0.16, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
rastro.frustumCulled = false; cena.add(rastro);
let rastroIdx = 0;
function emitirRastro(x, y, z, n) {
  for (let i = 0; i < n; i++) {
    const k = rastroIdx++ % RASTRO_N;
    rastroPos[k * 3] = x + rnd(-0.35, 0.35); rastroPos[k * 3 + 1] = y + rnd(-0.8, 0.8); rastroPos[k * 3 + 2] = z + rnd(0, 0.4);
    rastroVel[k * 3] = rnd(-1.5, 1.5); rastroVel[k * 3 + 1] = rnd(-1, 2); rastroVel[k * 3 + 2] = 0;
    rastroVida[k] = rnd(0.25, 0.6);
  }
}
function passoRastro(dt, vMundo) {
  for (let k = 0; k < RASTRO_N; k++) {
    if (rastroVida[k] <= 0) { rastroPos[k * 3 + 1] = -50; continue; }
    rastroVida[k] -= dt;
    rastroPos[k * 3] += rastroVel[k * 3] * dt; rastroPos[k * 3 + 1] += rastroVel[k * 3 + 1] * dt; rastroPos[k * 3 + 2] += vMundo * dt;
  }
  rastroGeo.attributes.position.needsUpdate = true;
}

// ---------- linhas de velocidade ----------
const LINHAS_N = 60;
const linhasGeo = new THREE.BufferGeometry();
const linhasPos = new Float32Array(LINHAS_N * 6);
const linhasBase = [];
for (let i = 0; i < LINHAS_N; i++) {
  const a = rnd(0, Math.PI * 2), r = rnd(5, 11);
  linhasBase.push({ x: Math.cos(a) * r, y: 3 + Math.sin(a) * r * 0.55, z: rnd(-120, 10) });
}
linhasGeo.setAttribute('position', new THREE.BufferAttribute(linhasPos, 3));
const linhas = new THREE.LineSegments(linhasGeo, new THREE.LineBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.0 }));
linhas.frustumCulled = false; cena.add(linhas);

// ---------- obstáculos e orbes ----------
const matCarro = [0x2a6df0, 0xf0a42a, 0x2ac98a, 0xb02af0, 0xe8e8ee].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.5 }));
const matVidro = new THREE.MeshStandardMaterial({ color: 0x0b1020, roughness: 0.1, metalness: 0.8 });
const matFarol = new THREE.MeshBasicMaterial({ color: 0xfff3b0 });
const matLanterna = new THREE.MeshBasicMaterial({ color: 0xff2020 });

function criarCarro() {
  const g = new THREE.Group();
  const corpo = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 4.2), pick(matCarro)); corpo.position.y = 0.65; g.add(corpo);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.65, 2.2), matVidro); cab.position.set(0, 1.3, -0.1); g.add(cab);
  for (const x of [-0.75, 0.75]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.08), matFarol); f.position.set(x, 0.7, 2.12); g.add(f);
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.08), matLanterna); l.position.set(x, 0.7, -2.12); g.add(l);
  }
  for (const [x, z] of [[-1.1, 1.4], [1.1, 1.4], [-1.1, -1.4], [1.1, -1.4]]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 12), new THREE.MeshLambertMaterial({ color: 0x111111 })); r.rotation.z = Math.PI / 2; r.position.set(x, 0.4, z); g.add(r);
  }
  g.userData = { tipo: 'carro', alt: 1.75, prof: 4.2, larg: 2.2 };
  return g;
}
function criarCaminhao() {
  const g = new THREE.Group();
  const cacamba = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.0, 6.5), new THREE.MeshStandardMaterial({ color: 0xcfd3dd, roughness: 0.6, metalness: 0.3 })); cacamba.position.set(0, 2.0, -1.0); g.add(cacamba);
  const cabine = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.0, 1.8), new THREE.MeshStandardMaterial({ color: 0xd04020, roughness: 0.4, metalness: 0.4 })); cabine.position.set(0, 1.5, 3.0); g.add(cabine);
  const vid = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 0.1), matVidro); vid.position.set(0, 2.0, 3.9); g.add(vid);
  g.userData = { tipo: 'caminhao', alt: 3.5, prof: 8.8, larg: 2.6 };
  return g;
}
function criarBarreira() {
  const g = new THREE.Group();
  const matL = new THREE.MeshStandardMaterial({ color: 0xff7a00, roughness: 0.5, emissive: 0x401800 });
  const matB = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 });
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.2, 0.18), i % 2 ? matB : matL); f.position.set(0, 0.45 + i * 0.0, 0); f.scale.x = 1; g.add(f);
  }
  g.children.forEach((c, i) => { c.position.y = 0.25 + (i % 2) * 0.25; c.position.x = 0; });
  for (const x of [-1.25, 1.25]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.12), matL); p.position.set(x, 0.4, 0); g.add(p); }
  const pisca = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffb000 })); pisca.position.set(0, 0.9, 0); g.add(pisca);
  g.userData = { tipo: 'barreira', alt: 0.85, prof: 0.6, larg: 2.8 };
  return g;
}
function criarViga() {
  const g = new THREE.Group();
  const matV = new THREE.MeshStandardMaterial({ color: 0x555a6e, roughness: 0.4, metalness: 0.7 });
  const viga = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.6, 0.7), matV); viga.position.y = 1.85; g.add(viga);
  for (const x of [-1.4, 1.4]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.2, 0.2), matV); p.position.set(x, 1.1, 0); g.add(p); }
  const faixa = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.12, 0.72), new THREE.MeshBasicMaterial({ color: 0xff2b3d })); faixa.position.y = 1.62; g.add(faixa);
  g.userData = { tipo: 'viga', alt: 2.15, baixo: 1.5, prof: 0.8, larg: 2.9 };
  return g;
}

const matOrbe = new THREE.MeshBasicMaterial({ color: 0x3fd0ff });
const matOrbeHalo = new THREE.MeshBasicMaterial({ color: 0x3fd0ff, transparent: true, opacity: 0.28, depthWrite: false });
const geoOrbe = new THREE.IcosahedronGeometry(0.38, 1), geoHalo = new THREE.SphereGeometry(0.62, 12, 8);
function criarOrbe() {
  const g = new THREE.Group(); g.add(new THREE.Mesh(geoOrbe, matOrbe), new THREE.Mesh(geoHalo, matOrbeHalo));
  g.userData = { tipo: 'orbe' }; return g;
}

const fabricas = { carro: criarCarro, caminhao: criarCaminhao, barreira: criarBarreira, viga: criarViga };
const ativos = [];          // obstáculos
const orbes = [];
const reserva = { carro: [], caminhao: [], barreira: [], viga: [], orbe: [] };
function obter(tipo) {
  const o = reserva[tipo].pop() || (tipo === 'orbe' ? criarOrbe() : fabricas[tipo]());
  o.visible = true; cena.add(o); return o;
}
function devolver(o) { cena.remove(o); reserva[o.userData.tipo].push(o); }

// ---------- estado do jogo ----------
const J = {
  modo: 'menu', t: 0, vel: VEL.inicio, dist: 0, pts: 0, vidas: VIDAS, orbes: 0, forca: 0.6, forcaAtiva: false,
  faixa: 1, x: 0, y: 0, vy: 0, noChao: true, deslizando: 0, imune: 0, tremor: 0,
  proxSpawn: -30, sequencia: 0, comboT: 0, rodou: 0, fase: 0,
};

function reiniciar() {
  for (const o of ativos.splice(0)) devolver(o);
  for (const o of orbes.splice(0)) devolver(o);
  Object.assign(J, {
    modo: 'jogando', t: 0, vel: VEL.inicio, dist: 0, pts: 0, vidas: VIDAS, orbes: 0, forca: 0.6, forcaAtiva: false,
    faixa: 1, x: 0, y: 0, vy: 0, noChao: true, deslizando: 0, imune: 1.2, tremor: 0, proxSpawn: -40, sequencia: 0, comboT: 0, rodou: 0, fase: 0,
  });
  el.corpo.classList.add('jogando'); el.inicio.hidden = true; el.fim.hidden = true;
  atualizarVidas(); semear();
}

function semear() {
  // enche a pista à frente de uma vez
  let z = -40;
  while (z > LONGE) { z = gerarFileira(z); }
  J.proxSpawn = z;
}

// gera uma fileira (ou padrão) em z e devolve o próximo z
function gerarFileira(z) {
  const dif = clamp(J.fase / 10, 0, 1);
  const tipos = ['carro', 'barreira', 'viga'];
  if (dif > 0.2) tipos.push('caminhao');
  const livre = Math.floor(Math.random() * 3);          // sempre existe uma faixa passável
  const livreTipo = Math.random();
  const preenche = Math.random() < 0.35 + dif * 0.5 ? 2 : 1;      // quantas faixas bloqueadas
  const bloq = [0, 1, 2].filter((i) => i !== livre);
  const usadas = preenche === 2 ? bloq : [pick(bloq)];
  // uma faixa livre pode ter obstáculo "passável" (barreira / viga)
  for (const i of usadas) {
    const tipo = pick(tipos);
    const o = obter(tipo); o.position.set(FAIXAS[i], 0, z + rnd(-1, 1)); ativos.push(o);
  }
  if (livreTipo < 0.35) {
    const tipo = pick(['barreira', 'viga']); const o = obter(tipo); o.position.set(FAIXAS[livre], 0, z); ativos.push(o);
  } else {
    // orbes na faixa livre, em linha
    const n = 3 + Math.floor(Math.random() * 3);
    for (let k = 0; k < n; k++) { const o = obter('orbe'); o.position.set(FAIXAS[livre], 1.1, z + 3 - k * 2.6); orbes.push(o); }
  }
  return z - rnd(15, 27) + dif * 5;
}

// ---------- entrada ----------
const teclas = new Set();
function mudarFaixa(d) { if (J.modo !== 'jogando') return; const n = clamp(J.faixa + d, 0, 2); if (n !== J.faixa) { J.faixa = n; som('troca'); } }
function pular() {
  if (J.modo !== 'jogando') return;
  if (J.noChao) { J.vy = FISICA.pulo; J.noChao = false; J.deslizando = 0; som('pulo'); }
}
function deslizar() {
  if (J.modo !== 'jogando') return;
  if (!J.noChao) { J.vy = Math.min(J.vy, -18); }     // cai mais rápido
  J.deslizando = FISICA.duracaoDeslize; som('desliza');
}
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') mudarFaixa(-1);
  else if (k === 'arrowright' || k === 'd') mudarFaixa(1);
  else if (k === 'arrowup' || k === 'w' || k === ' ') { pular(); e.preventDefault(); }
  else if (k === 'arrowdown' || k === 's') deslizar();
  else if (k === 'shift') teclas.add('forca');
  else if ((k === 'enter') && J.modo !== 'jogando') reiniciar();
});
addEventListener('keyup', (e) => { if (e.key === 'Shift') teclas.delete('forca'); });
addEventListener('blur', () => teclas.clear());

// gestos de toque
let toque = null;
addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; toque = { x: e.clientX, y: e.clientY, usado: false }; });
addEventListener('pointermove', (e) => {
  if (!toque || toque.usado) return;
  const dx = e.clientX - toque.x, dy = e.clientY - toque.y;
  if (Math.hypot(dx, dy) < 28) return;
  toque.usado = true;
  if (Math.abs(dx) > Math.abs(dy)) mudarFaixa(dx > 0 ? 1 : -1); else if (dy < 0) pular(); else deslizar();
});
addEventListener('pointerup', () => { toque = null; });
addEventListener('pointercancel', () => { toque = null; });
const btnF = el.btnForca;
btnF.addEventListener('pointerdown', (e) => { e.stopPropagation(); teclas.add('forca'); btnF.classList.add('ativo'); btnF.setPointerCapture?.(e.pointerId); });
const soltaF = () => { teclas.delete('forca'); btnF.classList.remove('ativo'); };
btnF.addEventListener('pointerup', soltaF); btnF.addEventListener('pointercancel', soltaF);
$('btnJogar').addEventListener('click', () => { iniciarAudio(); reiniciar(); });
$('btnDeNovo').addEventListener('click', () => { iniciarAudio(); reiniciar(); });

// ---------- som (sintetizado, sem arquivos) ----------
let ac = null;
function iniciarAudio() { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); ac.resume?.(); } catch { ac = null; } }
function bip(freq, dur, tipo = 'square', vol = 0.06, para = null) {
  if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain(); o.type = tipo; o.frequency.value = freq;
  if (para) o.frequency.exponentialRampToValueAtTime(para, ac.currentTime + dur);
  g.gain.value = vol; g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + dur);
}
function som(nome) {
  switch (nome) {
    case 'pulo': bip(320, 0.18, 'triangle', 0.08, 640); break;
    case 'troca': bip(520, 0.06, 'sine', 0.05, 380); break;
    case 'desliza': bip(240, 0.14, 'sawtooth', 0.04, 110); break;
    case 'orbe': bip(880 + Math.min(J.sequencia, 10) * 60, 0.1, 'sine', 0.07, 1500); break;
    case 'batida': bip(130, 0.35, 'sawtooth', 0.12, 40); break;
    case 'fim': bip(300, 0.7, 'sawtooth', 0.1, 60); break;
  }
}

// ---------- HUD ----------
function atualizarVidas() { el.vidas.textContent = '♥'.repeat(J.vidas) + '♡'.repeat(Math.max(0, VIDAS - J.vidas)); }
function mostrarCombo(txt) { el.combo.textContent = txt; el.combo.style.opacity = '1'; J.comboT = 0.9; }
let recorde = Number(lerSeguro(CHAVE_RECORDE)) || 0;
el.recorde.textContent = recorde ? `Recorde: ${recorde} pontos` : '';

// ---------- laço ----------
const relogio = new THREE.Clock();
let tempoVisual = 0;

function fimDeJogo() {
  J.modo = 'fim'; som('fim');
  const total = Math.floor(J.pts);
  const novo = total > recorde;
  if (novo) { recorde = total; gravarSeguro(CHAVE_RECORDE, recorde); }
  el.fimPts.textContent = total;
  el.fimDetalhe.textContent = `${Math.floor(J.dist)} m percorridos · ${J.orbes} esferas de energia`;
  el.fimRecorde.textContent = novo ? 'NOVO RECORDE!' : `Recorde: ${recorde} pontos`;
  el.recorde.textContent = `Recorde: ${recorde} pontos`;
  el.corpo.classList.remove('jogando'); el.fim.hidden = false;
}

function colidir(o) {
  const u = o.userData;
  const dx = Math.abs(o.position.x - J.x);
  if (dx > u.larg / 2 + 0.25) return false;
  const dz = Math.abs(o.position.z - 0);
  if (dz > u.prof / 2 + 0.35) return false;
  const alturaHeroi = J.deslizando > 0 ? FISICA.alturaDeslize : FISICA.alturaNormal;
  const base = J.y, topo = J.y + alturaHeroi;
  if (u.tipo === 'viga') return topo > u.baixo && base < u.alt;
  return base < u.alt - 0.05;
}

function atualizarJogo(dtReal) {
  // Força da Velocidade: tempo desacelera enquanto houver energia
  const querForca = teclas.has('forca') && J.forca > 0.001;
  J.forcaAtiva = querForca;
  if (querForca) J.forca = Math.max(0, J.forca - FORCA.gasto * dtReal);
  const escala = querForca ? FORCA.escala : 1;
  const dt = dtReal * escala;

  J.t += dt; J.fase = J.dist / 220;
  J.vel = Math.min(VEL.max, VEL.inicio + J.t * VEL.aceleracao);
  const v = J.vel;
  const avanco = v * dt;
  J.dist += avanco; J.pts += avanco * 0.5 * (1 + J.fase * 0.1);

  // movimento do herói
  J.x = lerp(J.x, FAIXAS[J.faixa], 1 - Math.exp(-16 * dtReal));
  if (!J.noChao) {
    J.vy -= FISICA.gravidade * dt; J.y += J.vy * dt;
    if (J.y <= 0) { J.y = 0; J.vy = 0; J.noChao = true; }
  }
  if (J.deslizando > 0) J.deslizando -= dt;
  if (J.imune > 0) J.imune -= dtReal;
  J.tremor = Math.max(0, J.tremor - dtReal * 2.4);

  // mundo anda para trás de nós
  for (const s of segmentos) { s.position.z += avanco; if (s.position.z > PISTA.segmento * 1.5) s.position.z -= PISTA.segmento * PISTA.qtd; }
  for (const p of predios) { p.position.z += avanco; if (p.position.z - p.userData.d / 2 > ATRAS + 20) reposicionarPredio(p, p.position.z - PREDIO_VOLTA); }

  // spawn
  J.proxSpawn += avanco;
  while (J.proxSpawn > LONGE) J.proxSpawn = gerarFileira(J.proxSpawn);

  // obstáculos
  for (let i = ativos.length - 1; i >= 0; i--) {
    const o = ativos[i]; o.position.z += avanco;
    if (o.position.z > ATRAS) { devolver(o); ativos.splice(i, 1); continue; }
    if (J.imune <= 0 && colidir(o)) {
      J.vidas--; J.imune = 1.6; J.tremor = 1; som('batida'); J.sequencia = 0; atualizarVidas();
      if (J.vidas <= 0) { fimDeJogo(); return; }
    }
  }
  // orbes
  for (let i = orbes.length - 1; i >= 0; i--) {
    const o = orbes[i]; o.position.z += avanco; o.rotation.y += dtReal * 3; o.rotation.x += dtReal * 1.7;
    if (o.position.z > ATRAS) { devolver(o); orbes.splice(i, 1); continue; }
    if (Math.abs(o.position.z) < 1.4 && Math.abs(o.position.x - J.x) < 1.3 && Math.abs((o.position.y) - (J.y + 0.9)) < 1.6) {
      devolver(o); orbes.splice(i, 1);
      J.orbes++; J.sequencia++; J.pts += 25 * Math.min(1 + Math.floor(J.sequencia / 5), 5);
      J.forca = Math.min(1, J.forca + FORCA.orbe); som('orbe');
      if (J.sequencia % 5 === 0) mostrarCombo(`SEQUÊNCIA ×${J.sequencia}`);
    }
  }

  // rastro e luz
  const cadencia = Math.floor(v / 8);
  emitirRastro(J.x, J.y + 1, 0.7, cadencia);
  passoRastro(dt, v);
  luzHeroi.position.set(J.x, J.y + 2.4, 3);
  luzHeroi.color.setHex(querForca ? 0x3fd0ff : 0xff4d5e);
}

function animarHeroi(dtReal) {
  const ritmo = (J.modo === 'jogando' ? 9 + J.vel * 0.22 : 6) * (J.forcaAtiva ? FORCA.escala + 0.25 : 1);
  tempoVisual += dtReal * ritmo;
  const p = partes, s = Math.sin(tempoVisual), amp = J.noChao ? 1.0 : 0.25;
  const deslize = J.deslizando > 0;
  if (deslize) {
    p.corpo.rotation.x = lerp(p.corpo.rotation.x, -1.15, 0.35);
    p.corpo.position.y = lerp(p.corpo.position.y, -0.35, 0.35);
    p.pernaE.rotation.x = p.pernaD.rotation.x = lerp(p.pernaD.rotation.x, 0.9, 0.3);
    p.bracoE.rotation.x = p.bracoD.rotation.x = lerp(p.bracoD.rotation.x, 2.4, 0.3);
  } else {
    p.corpo.rotation.x = lerp(p.corpo.rotation.x, J.modo === 'jogando' ? 0.5 : 0.05, 0.2);   // inclinado, correndo
    p.corpo.position.y = lerp(p.corpo.position.y, Math.abs(Math.cos(tempoVisual)) * 0.1 * amp, 0.4);
    if (J.noChao || J.modo !== 'jogando') {
      p.pernaE.rotation.x = s * 1.1 * amp; p.pernaD.rotation.x = -s * 1.1 * amp;
      p.bracoE.rotation.x = -s * 1.3 * amp; p.bracoD.rotation.x = s * 1.3 * amp;
    } else {   // no ar: um joelho dobrado, um braço à frente
      p.pernaE.rotation.x = lerp(p.pernaE.rotation.x, -1.0, 0.25); p.pernaD.rotation.x = lerp(p.pernaD.rotation.x, 0.5, 0.25);
      p.bracoE.rotation.x = lerp(p.bracoE.rotation.x, -2.2, 0.25); p.bracoD.rotation.x = lerp(p.bracoD.rotation.x, 0.6, 0.25);
    }
  }
  heroi.position.set(J.x, J.y, 0);
  heroi.rotation.y = Math.PI;                      // de costas para a câmera, correndo para -z
  heroi.rotation.z = (FAIXAS[J.faixa] - J.x) * -0.06;
  heroi.visible = J.modo !== 'jogando' || J.imune <= 0 || Math.floor(J.imune * 12) % 2 === 0;
}

function atualizarCamera(dtReal) {
  const alvoFov = FOV_BASE + (J.modo === 'jogando' ? (J.vel - VEL.inicio) * 0.28 + (J.forcaAtiva ? -6 : 0) : 0);
  camera.fov = lerp(camera.fov, alvoFov, 1 - Math.exp(-5 * dtReal)); camera.updateProjectionMatrix();
  const tx = J.x * 0.55, ty = 4.4 + (J.y * 0.35), tz = 9.2;
  const tre = J.tremor > 0 ? (Math.random() - 0.5) * 0.5 * J.tremor : 0;
  camera.position.x = lerp(camera.position.x, tx, 1 - Math.exp(-8 * dtReal)) + tre;
  camera.position.y = lerp(camera.position.y, ty, 1 - Math.exp(-8 * dtReal)) + tre;
  camera.position.z = tz;
  camera.lookAt(J.x * 0.7, 1.7 + J.y * 0.4, -14);
  // linhas de velocidade: cada linha anda junto com a velocidade real
  const intensidade = J.modo === 'jogando' ? clamp((J.vel - 24) / 24, 0, 1) * (J.forcaAtiva ? 0.15 : 1) : 0;
  linhas.material.opacity = intensidade * 0.55;
  for (let i = 0; i < LINHAS_N; i++) {
    const b = linhasBase[i];
    if (J.modo === 'jogando') b.z += J.vel * dtReal * (J.forcaAtiva ? FORCA.escala : 1) * 1.6;
    if (b.z > 14) b.z = -140 + rnd(0, 20);
    const comp = 6 + J.vel * 0.45;
    linhasPos[i * 6] = b.x + camera.position.x * 0.5; linhasPos[i * 6 + 1] = b.y; linhasPos[i * 6 + 2] = b.z;
    linhasPos[i * 6 + 3] = linhasPos[i * 6]; linhasPos[i * 6 + 4] = b.y; linhasPos[i * 6 + 5] = b.z - comp;
  }
  linhasGeo.attributes.position.needsUpdate = true;
}

function quadro() {
  requestAnimationFrame(quadro);
  if (el.corpo.classList.contains('toque') && matchMedia('(orientation: portrait)').matches) { relogio.getDelta(); return; }   // celular em pé: parado
  const dtReal = Math.min(relogio.getDelta(), 0.05);
  if (J.modo === 'jogando') {
    atualizarJogo(dtReal);
    el.dist.textContent = Math.floor(J.dist);
    el.vel.textContent = Math.round(J.vel * 3.6 * (J.forcaAtiva ? FORCA.escala : 1));
    el.pts.textContent = Math.floor(J.pts);
    el.nivel.style.width = `${(J.forca * 100).toFixed(1)}%`;
    if (J.comboT > 0) { J.comboT -= dtReal; if (J.comboT <= 0) el.combo.style.opacity = '0'; }
  } else if (J.modo === 'menu') {
    // pista corre devagar atrás do menu
    for (const s of segmentos) { s.position.z += 6 * dtReal; if (s.position.z > PISTA.segmento * 1.5) s.position.z -= PISTA.segmento * PISTA.qtd; }
    for (const p of predios) { p.position.z += 6 * dtReal; if (p.position.z - p.userData.d / 2 > ATRAS + 20) reposicionarPredio(p, p.position.z - PREDIO_VOLTA); }
  }
  animarHeroi(dtReal);
  atualizarCamera(dtReal);
  renderer.render(cena, camera);
}

function redimensionar() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', redimensionar); redimensionar();

camera.position.set(0, 4.4, 9.2);
// no menu: câmera mais baixa e de frente para o herói
J.modo = 'menu';
requestAnimationFrame(quadro);

// ganchos para testes
window.__relampago = { J, reiniciar, mudarFaixa, pular, deslizar, ativos, orbes, teclas };
