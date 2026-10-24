// Combate: bandidos (gangues pela cidade), o BATER do herói (avanço relâmpago até o bandido mais perto + combo de três
// golpes, o 3º é um gancho que derruba) e os golpes especiais pagos com a energia:
//   RAIO     (25%) — arremessa um raio no bandido (pula para mais um perto dele);
//   CICLONE  (35%) — corre em círculo em volta de si: o vórtice levanta todos os bandidos perto e os joga longe;
//   SÔNICO   (50%) — some numa arrancada e volta na velocidade máxima: um soco com onda de choque.
// Os bandidos chegam perto, cercam, ameaçam e batem (dois de cada vez); cada golpe que acerta o herói tira energia.
import * as THREE from 'three';

export const ESPECIAIS = {
  raio: { nome: 'Raio', custo: 0.25, teclas: ['1', 'q'] },
  ciclone: { nome: 'Ciclone', custo: 0.35, teclas: ['2', 'e'] },
  sonico: { nome: 'Sônico', custo: 0.5, teclas: ['3', 'r'] },
};
const AVANCO_MAX = 16;          // até onde o BATER alcança com o avanço relâmpago (m)
const ALCANCE_SOCO = 1.6;
const DANO_HEROI = 0.07;        // energia que um golpe do bandido tira
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ang = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ---------- o bandido (corpo articulado de peças simples, geometria compartilhada) ----------
const GEO = {
  tronco: new THREE.CapsuleGeometry(0.21, 0.4, 4, 10), quadril: new THREE.CapsuleGeometry(0.17, 0.12, 3, 10),
  cabeca: new THREE.SphereGeometry(0.12, 14, 10), touca: new THREE.SphereGeometry(0.128, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
  mascara: new THREE.CylinderGeometry(0.125, 0.125, 0.07, 14, 1, true),
  braco: new THREE.CapsuleGeometry(0.072, 0.24, 3, 8), antebraco: new THREE.CapsuleGeometry(0.062, 0.22, 3, 8), mao: new THREE.SphereGeometry(0.07, 8, 6),
  coxa: new THREE.CapsuleGeometry(0.095, 0.34, 3, 8), canela: new THREE.CapsuleGeometry(0.075, 0.34, 3, 8), pe: new THREE.BoxGeometry(0.12, 0.08, 0.26),
};
const ROUPAS = [[0x3b3f48, 0x2f3d55], [0x6a2a26, 0x22252b], [0x3e4f36, 0x2d2d33], [0x2b3d62, 0x1d2433], [0x55555e, 0x5a4a35], [0x6b5a2a, 0x23262d]];
const PELES = [0xd7a684, 0xb07a55, 0x8a5a3c, 0xe2b896, 0x6e4630];

function criarBandido(mats) {
  const [cr, cc] = ROUPAS[Math.floor(Math.random() * ROUPAS.length)];
  const moletom = new THREE.MeshLambertMaterial({ color: cr, emissive: 0x000000 });
  const calca = mats.cor(cc), pele = mats.cor(PELES[Math.floor(Math.random() * PELES.length)]), preto = mats.cor(0x111114), mascara = mats.cor(0x1a1a1e);
  const g = new THREE.Group(), corpo = new THREE.Group(); g.add(corpo);
  const malha = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
  const quadril = new THREE.Group(); quadril.position.y = 0.95; corpo.add(quadril);
  quadril.add(malha(GEO.quadril, calca, 0, 0.02, 0));
  const tronco = new THREE.Group(); tronco.position.y = 0.08; quadril.add(tronco);
  tronco.add(malha(GEO.tronco, moletom, 0, 0.32, 0));
  const cab = new THREE.Group(); cab.position.y = 0.7; tronco.add(cab);
  cab.add(malha(GEO.cabeca, pele, 0, 0, 0), malha(GEO.touca, preto, 0, 0.012, -0.005), malha(GEO.mascara, mascara, 0, -0.035, 0.008));
  const membro = (pai, x, y, gA, gB, gP, mat, matP, pB) => {
    const a = new THREE.Group(); a.position.set(x, y, 0); pai.add(a);
    a.add(malha(gA, mat, 0, -gA.parameters.length / 2 - gA.parameters.radius * 0.6, 0));
    const b = new THREE.Group(); b.position.y = -gA.parameters.length - gA.parameters.radius * 1.2; a.add(b);
    b.add(malha(gB, mat, 0, -gB.parameters.length / 2 - gB.parameters.radius * 0.6, 0));
    b.add(malha(gP, matP, 0, -gB.parameters.length - gB.parameters.radius * 1.4, pB));
    return { a, b };
  };
  const bE = membro(tronco, -0.27, 0.56, GEO.braco, GEO.antebraco, GEO.mao, moletom, pele, 0);
  const bD = membro(tronco, 0.27, 0.56, GEO.braco, GEO.antebraco, GEO.mao, moletom, pele, 0);
  const pE = membro(quadril, -0.11, -0.02, GEO.coxa, GEO.canela, GEO.pe, calca, preto, 0.06);
  const pD = membro(quadril, 0.11, -0.02, GEO.coxa, GEO.canela, GEO.pe, calca, preto, 0.06);
  g.traverse((o) => { if (o.isMesh) o.castShadow = !mats.mobile; });
  return { g, corpo, quadril, tronco, cab, bE, bD, pE, pD, moletom };
}

// pose do bandido: andar (fase/velocidade), guarda, preparar e soltar o golpe, levar golpe, voar e cair
function poseBandido(b, e, dt) {
  const v = Math.hypot(e.vx, e.vz);
  e.fase += dt * (2.2 + v * 1.6);
  const s = Math.sin(e.fase), a = Math.min(1, v / 5) * 0.85;
  const guarda = e.estado === 'guarda' || e.estado === 'prepara' || e.estado === 'golpe' || (e.estado === 'vem' && e.dist < 6);
  // pernas
  b.pE.a.rotation.x = -s * a; b.pD.a.rotation.x = s * a;
  b.pE.b.rotation.x = Math.max(0, Math.sin(e.fase + 1.2)) * a * 1.3 + (guarda ? 0.25 : 0.05);
  b.pD.b.rotation.x = Math.max(0, Math.sin(e.fase + 1.2 + Math.PI)) * a * 1.3 + (guarda ? 0.25 : 0.05);
  b.pE.a.rotation.z = guarda ? -0.12 : 0; b.pD.a.rotation.z = guarda ? 0.12 : 0;
  b.quadril.position.y = 0.95 - (guarda ? 0.06 : 0) + Math.abs(Math.cos(e.fase)) * 0.03 * a;
  // braços
  let oE = s * a * 0.8, cE = -0.35, oD = -s * a * 0.8, cD = -0.35, zE = 0.12, zD = -0.12;
  if (guarda) { oE = -0.7; cE = -1.9; oD = -0.55; cD = -2.0; zE = 0.3; zD = -0.3; }
  if (e.estado === 'ronda') { const t = e.t * 2.5; oD = -0.4 + Math.sin(t) * 0.15; cD = -1.2 - Math.sin(t * 1.3) * 0.4; zD = -0.15; }   // ameaçando, gesticulando
  if (e.estado === 'prepara') { const k = clamp(e.t / 0.45, 0, 1); oD = lerp(-0.55, 0.5, k); cD = lerp(-2.0, -2.3, k); b.tronco.rotation.y = lerp(0, 0.5, k); }
  else if (e.estado === 'golpe') { const k = clamp(e.t / 0.12, 0, 1); oD = lerp(0.5, -1.55, k); cD = lerp(-2.3, -0.1, k); zD = lerp(-0.3, 0.12, k); b.tronco.rotation.y = lerp(0.5, -0.45, k); }
  else b.tronco.rotation.y *= 0.85;
  b.bE.a.rotation.set(oE, 0, zE); b.bE.b.rotation.x = cE; b.bD.a.rotation.set(oD, 0, zD); b.bD.b.rotation.x = cD;
  b.tronco.rotation.x = guarda ? 0.18 : Math.min(0.3, v * 0.04);
  // golpe recebido: tronco e cabeça vão para trás
  if (e.estado === 'atordoado') { const k = Math.sin(clamp(e.t / 0.45, 0, 1) * Math.PI); b.tronco.rotation.x = -0.55 * k; b.cab.rotation.x = -0.4 * k; b.bE.a.rotation.x = 0.6 * k; b.bD.a.rotation.x = 0.6 * k; }
  else b.cab.rotation.x *= 0.8;
  // voando / caído / preso no vórtice: o corpo todo gira
  if (e.estado === 'voando' || e.estado === 'preso') {
    e.giro += dt * (e.estado === 'preso' ? 9 : 7); b.corpo.rotation.set(-1.2 - Math.sin(e.giro) * 0.4, 0, Math.sin(e.giro * 0.7) * 0.6);
    b.corpo.position.y = 0.5; b.bE.a.rotation.set(-2.4, 0, 0.6); b.bD.a.rotation.set(-2.6, 0, -0.6); b.pE.a.rotation.x = 0.5; b.pD.a.rotation.x = -0.3;
  } else if (e.estado === 'caido') {
    const k = clamp(e.t / 0.35, 0, 1);
    b.corpo.rotation.x = lerp(b.corpo.rotation.x, -Math.PI / 2, k); b.corpo.rotation.z = lerp(b.corpo.rotation.z, 0, k);
    b.corpo.position.y = lerp(b.corpo.position.y, 0.2, k);
    b.bE.a.rotation.set(-2.8, 0, 0.9); b.bD.a.rotation.set(-0.3, 0, -0.5); b.pE.a.rotation.x = 0.15; b.pD.a.rotation.x = -0.25;
  } else { b.corpo.rotation.set(0, 0, 0); b.corpo.position.y = 0; }
}

// ---------- efeitos: raios (linhas com cor acima de 1 para o bloom), clarões e ondas de choque ----------
function criarEfeitos(cena, mobile) {
  const NB = mobile ? 40 : 80, SEG = 12;
  const pos = new Float32Array(NB * SEG * 2 * 3), cor = new Float32Array(NB * SEG * 2 * 3);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(cor, 3));
  const linhas = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  linhas.frustumCulled = false; cena.add(linhas);
  const bolts = Array.from({ length: NB }, () => ({ vida: 0, total: 1, pts: new Float32Array((SEG + 1) * 3), r: 1, g: 1, b: 1 }));
  let prox = 0;
  function raio(ax, ay, az, bx, by, bz, { vida = 0.25, desvio = 0.5, r = 2, g = 1.5, b = 0.35 } = {}) {
    const o = bolts[prox]; prox = (prox + 1) % NB;
    o.vida = o.total = vida; o.r = r; o.g = g; o.b = b;
    for (let k = 0; k <= SEG; k++) {
      const t = k / SEG, amp = Math.sin(t * Math.PI) * desvio;
      o.pts[k * 3] = ax + (bx - ax) * t + (k && k < SEG ? rnd(-amp, amp) : 0);
      o.pts[k * 3 + 1] = ay + (by - ay) * t + (k && k < SEG ? rnd(-amp, amp) : 0);
      o.pts[k * 3 + 2] = az + (bz - az) * t + (k && k < SEG ? rnd(-amp, amp) : 0);
    }
  }
  // clarões
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const gc = c.getContext('2d'), gr = gc.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.25, 'rgba(255,210,90,0.7)'); gr.addColorStop(1, 'rgba(255,140,0,0)');
  gc.fillStyle = gr; gc.fillRect(0, 0, 64, 64);
  const texClarao = new THREE.CanvasTexture(c);
  const claroes = Array.from({ length: 8 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texClarao, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); s.visible = false; cena.add(s); return { s, vida: 0, total: 1, tam: 1 }; });
  let pc = 0;
  function clarao(x, y, z, tam = 2.5, vida = 0.22) { const o = claroes[pc]; pc = (pc + 1) % claroes.length; o.s.position.set(x, y, z); o.vida = o.total = vida; o.tam = tam; o.s.visible = true; }
  // ondas de choque (anel no chão que cresce)
  const geoOnda = new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2);
  const ondas = Array.from({ length: 4 }, () => { const m = new THREE.Mesh(geoOnda, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.7, 0.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide })); m.visible = false; cena.add(m); return { m, vida: 0, total: 1, raio: 1 }; });
  let po = 0;
  function onda(x, y, z, raioMax = 12, vida = 0.55) { const o = ondas[po]; po = (po + 1) % ondas.length; o.m.position.set(x, y + 0.15, z); o.vida = o.total = vida; o.raio = raioMax; o.m.visible = true; }

  function atualizar(dt) {
    let n = 0;
    for (const o of bolts) {
      if (o.vida <= 0) continue;
      o.vida -= dt; const f = Math.max(0, o.vida / o.total) * (0.6 + Math.random() * 0.4);
      for (let k = 0; k < SEG; k++) {
        const i = n * 6;
        for (let q = 0; q < 6; q++) pos[i + q] = o.pts[k * 3 + q];
        cor[i] = cor[i + 3] = o.r * f; cor[i + 1] = cor[i + 4] = o.g * f; cor[i + 2] = cor[i + 5] = o.b * f;
        n++;
      }
    }
    geo.setDrawRange(0, n * 2); geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    for (const o of claroes) { if (!o.s.visible) continue; o.vida -= dt; if (o.vida <= 0) { o.s.visible = false; continue; } const f = o.vida / o.total; o.s.scale.setScalar(o.tam * (1.4 - f * 0.4)); o.s.material.opacity = f; }
    for (const o of ondas) { if (!o.m.visible) continue; o.vida -= dt; if (o.vida <= 0) { o.m.visible = false; continue; } const f = 1 - o.vida / o.total; o.m.scale.setScalar(0.5 + o.raio * Math.pow(f, 0.6)); o.m.material.opacity = 1 - f; }
  }
  return { raio, clarao, onda, atualizar };
}

/** Combate. colide(x, z, y) → {x, z} empurra para fora dos prédios; chao(x, z, y) → altura do chão. */
export function criarCombate(cena, { mobile = false, colide = null, chao = null } = {}) {
  const cache = new Map();
  const mats = { mobile, cor: (c) => { if (!cache.has(c)) cache.set(c, new THREE.MeshLambertMaterial({ color: c })); return cache.get(c); } };
  const fx = criarEfeitos(cena, mobile);
  const bandidos = [];
  let proxGangue = 1;
  const H = { acao: null, combo: 0, ultimoGolpe: -9, tempo: 0, tremor: 0, hitstop: 0, dano: 0, luta: 0, sofridos: 0 };
  const eventos = [];

  function gerarGangue(x, z, n) {
    const id = proxGangue++;
    for (let i = 0; i < n; i++) {
      const b = criarBandido(mats), a = (i / n) * Math.PI * 2 + rnd(-0.3, 0.3), r = rnd(1.8, 4);
      const e = { b, gangue: id, x: x + Math.cos(a) * r, z: z + Math.sin(a) * r, y: 0, vx: 0, vz: 0, vy: 0, h: rnd(0, 6.28), vida: 3, estado: 'ronda', t: rnd(0, 2), fase: rnd(0, 6), giro: 0, dist: 99, espera: rnd(0.3, 1.2), ox: 0, oz: 0 };
      b.g.position.set(e.x, 0, e.z); cena.add(b.g); bandidos.push(e);
    }
    return id;
  }
  const deGangue = (id) => bandidos.filter((e) => e.gangue === id);
  const emPe = (e) => e.estado !== 'caido' && e.estado !== 'voando' && e.estado !== 'preso' && e.estado !== 'fugiu';
  /** quantos ainda de pé numa gangue */
  const vivos = (id) => deGangue(id).filter(emPe).length;
  function centro(id) {
    const v = deGangue(id).filter(emPe); if (!v.length) return null;
    return { x: v.reduce((s, e) => s + e.x, 0) / v.length, z: v.reduce((s, e) => s + e.z, 0) / v.length };
  }
  /** encerra a gangue: os de pé fogem (somem) e todos saem de cena em `atraso` s */
  function remover(id, atraso = 4) {
    for (const e of deGangue(id)) { if (emPe(e)) e.estado = 'fugiu'; e.sair = atraso; }
  }

  // ---------- dano ----------
  function acertar(e, tipo, P, { dano = 1, empurra = 3, alto = 0, especial = false } = {}) {
    if (!emPe(e) && e.estado !== 'preso') return;
    e.vida -= dano;
    const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz) || 1;
    if (e.vida <= 0) {
      e.estado = 'voando'; e.t = 0; e.vx = (dx / d) * empurra; e.vz = (dz / d) * empurra; e.vy = alto || 5; e.y = Math.max(e.y, 0.05);
      eventos.push({ tipo: 'nocaute', especial, gangue: e.gangue });
    } else { e.estado = 'atordoado'; e.t = 0; e.vx = (dx / d) * 2.2; e.vz = (dz / d) * 2.2; }
    e.b.moletom.emissive.setRGB(0.9, 0.55, 0.1); e.brilho = 0.15;
  }

  function alvoMaisPerto(P, dirX, dirZ, alcance, excluir = null) {
    let melhor = null, nota = Infinity;
    for (const e of bandidos) {
      if (!emPe(e) || e === excluir) continue;
      const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz);
      if (d > alcance || Math.abs(e.y - P.y) > 4) continue;
      const cos = d > 0.01 ? (dx * dirX + dz * dirZ) / d : 1;
      const n = d * (1.6 - cos * 0.6);                           // prefere quem está na direção pedida
      if (n < nota) { nota = n; melhor = e; }
    }
    return melhor;
  }

  // ---------- comandos do herói ----------
  /** BATER: dir = direção pedida (analógico) ou a frente da câmera. */
  function bater(P, dirX, dirZ) {
    if (H.acao && H.acao.tipo !== 'soco') return false;
    if (H.acao) { H.fila = true; return true; }                  // aperto durante o golpe: emenda o próximo (combo)
    const alvo = alvoMaisPerto(P, dirX, dirZ, AVANCO_MAX);
    H.combo = H.tempo - H.ultimoGolpe < 0.9 ? (H.combo + 1) % 3 : 0;
    const gancho = H.combo === 2;
    let dash = 0, de = { x: P.x, z: P.z, y: P.y }, para = de;
    if (alvo) {
      const dx = alvo.x - P.x, dz = alvo.z - P.z, d = Math.hypot(dx, dz);
      P.h = Math.atan2(dx, dz);
      if (d > ALCANCE_SOCO) { dash = clamp(d / 70, 0.07, 0.24); para = { x: alvo.x - (dx / d) * 1.05, z: alvo.z - (dz / d) * 1.05, y: alvo.y }; }
    } else if (Math.hypot(dirX, dirZ) > 0.1) P.h = Math.atan2(dirX, dirZ);
    H.acao = { tipo: 'soco', t: 0, dash, dur: dash + (gancho ? 0.42 : 0.3), bate: dash + (gancho ? 0.17 : 0.1), alvo, de, para, lado: H.combo === 1 ? -1 : 1, gancho, feito: false };
    H.fila = false;
    return true;
  }
  /** golpe especial (paga a energia aqui); devolve false se não pode */
  function especial(tipo, P, dirX, dirZ) {
    const E = ESPECIAIS[tipo]; if (!E || H.acao || P.energia < E.custo) return false;
    P.energia -= E.custo;
    const alvo = alvoMaisPerto(P, dirX, dirZ, tipo === 'raio' ? 45 : tipo === 'sonico' ? 40 : 14);
    let hx = Math.sin(P.h), hz = Math.cos(P.h);
    if (alvo) { const dx = alvo.x - P.x, dz = alvo.z - P.z, d = Math.hypot(dx, dz) || 1; hx = dx / d; hz = dz / d; P.h = Math.atan2(hx, hz); }
    else if (Math.hypot(dirX, dirZ) > 0.1) { const d = Math.hypot(dirX, dirZ); hx = dirX / d; hz = dirZ / d; P.h = Math.atan2(hx, hz); }
    if (tipo === 'raio') H.acao = { tipo, t: 0, dur: 0.62, bate: 0.3, alvo, hx, hz, feito: false };
    else if (tipo === 'ciclone') H.acao = { tipo, t: 0, dur: 1.9, cx: P.x, cz: P.z, a0: Math.atan2(-hz, -hx), feito: false, presos: [] };
    else {
      const ix = alvo ? alvo.x : P.x + hx * 10, iz = alvo ? alvo.z : P.z + hz * 10;
      H.acao = { tipo, t: 0, dur: 1.55, alvo, ix, iz, de: { x: P.x, z: P.z }, longe: { x: ix - hx * 42, z: iz - hz * 42 }, hx, hz, feito: false };
    }
    eventos.push({ tipo: 'especial', especial: tipo });
    return true;
  }

  // ---------- passo ----------
  function passo(dt, P) {
    H.tempo += dt;
    H.tremor = Math.max(0, H.tremor - dt * 3); H.dano = Math.max(0, H.dano - dt * 2.5);
    let perto = false;
    // ação do herói
    const A = H.acao;
    if (A) {
      A.t += dt;
      if (A.tipo === 'soco') {
        if (A.t < A.dash) {
          const k = A.t / A.dash, nx = lerp(A.de.x, A.para.x, k), nz = lerp(A.de.z, A.para.z, k);
          P.vx = (nx - P.x) / Math.max(dt, 1e-3); P.vz = (nz - P.z) / Math.max(dt, 1e-3);
          P.x = nx; P.z = nz; P.y = lerp(A.de.y, A.para.y ?? A.de.y, k);
          if (Math.random() < 0.8) fx.raio(P.x, P.y + rnd(0.4, 1.5), P.z, P.x - P.vx * 0.03 + rnd(-0.5, 0.5), P.y + rnd(0.2, 1.6), P.z - P.vz * 0.03 + rnd(-0.5, 0.5), { vida: 0.18, desvio: 0.35 });
        } else { P.vx *= 0.5; P.vz *= 0.5; if (A.alvo && emPe(A.alvo)) P.h += ang(Math.atan2(A.alvo.x - P.x, A.alvo.z - P.z) - P.h) * Math.min(1, dt * 20); }
        if (!A.feito && A.t >= A.bate) {
          A.feito = true; H.ultimoGolpe = H.tempo;
          const hx = Math.sin(P.h), hz = Math.cos(P.h), mx = P.x + hx * 0.9, mz = P.z + hz * 0.9;
          // acerta o alvo (se perto) e quem estiver na frente do punho
          for (const e of bandidos) {
            if (!emPe(e)) continue;
            const d = Math.hypot(e.x - mx, e.z - mz);
            if (d < 1.25 || (e === A.alvo && Math.hypot(e.x - P.x, e.z - P.z) < 2.2)) {
              acertar(e, 'soco', P, A.gancho ? { dano: 2, empurra: 9, alto: 7 } : { dano: 1 });
              fx.clarao(e.x, P.y + (A.gancho ? 1.5 : 1.35), e.z, A.gancho ? 2.6 : 1.6, 0.16);
              for (let i = 0; i < 3; i++) fx.raio(e.x, P.y + 1.4, e.z, e.x + rnd(-1.2, 1.2), P.y + rnd(0.6, 2.2), e.z + rnd(-1.2, 1.2), { vida: 0.15, desvio: 0.3 });
              H.hitstop = A.gancho ? 0.09 : 0.05; H.tremor = Math.max(H.tremor, A.gancho ? 0.35 : 0.18);
            }
          }
        }
        if (A.t >= A.dur) { H.acao = null; P.vx = P.vz = 0; if (H.fila) { H.fila = false; bater(P, Math.sin(P.h), Math.cos(P.h)); } }
      } else if (A.tipo === 'raio') {
        P.vx = P.vz = 0;
        if (A.t < A.bate) fx.raio(P.x + A.hx * 0.5, P.y + 1.4, P.z + A.hz * 0.5, P.x + A.hx * 0.5 + rnd(-0.6, 0.6), P.y + rnd(0.6, 2), P.z + A.hz * 0.5 + rnd(-0.6, 0.6), { vida: 0.08, desvio: 0.2 });
        if (!A.feito && A.t >= A.bate) {
          A.feito = true;
          const ox = P.x + A.hx * 0.7, oy = P.y + 1.45, oz = P.z + A.hz * 0.7;
          const alvo = A.alvo && emPe(A.alvo) ? A.alvo : null;
          const tx = alvo ? alvo.x : P.x + A.hx * 30, tz = alvo ? alvo.z : P.z + A.hz * 30, ty = alvo ? alvo.y + 1.2 : P.y + 1.2;
          for (let i = 0; i < 4; i++) fx.raio(ox, oy, oz, tx, ty, tz, { vida: 0.35, desvio: 1.4, r: 2.6, g: 2.1, b: 0.7 });
          fx.clarao(tx, ty, tz, 4, 0.3); fx.clarao(ox, oy, oz, 2, 0.15);
          if (alvo) {
            acertar(alvo, 'raio', P, { dano: 9, empurra: 14, alto: 6, especial: true });
            const outro = alvoMaisPerto(alvo, 0, 0, 7, alvo);            // o raio pula para mais um
            if (outro) { fx.raio(tx, ty, tz, outro.x, outro.y + 1.2, outro.z, { vida: 0.3, desvio: 0.8, r: 2.4, g: 1.9, b: 0.6 }); acertar(outro, 'raio', alvo, { dano: 9, empurra: 10, alto: 5, especial: true }); }
          }
          H.tremor = 0.4; H.hitstop = 0.06;
        }
        if (A.t >= A.dur) H.acao = null;
      } else if (A.tipo === 'ciclone') {
        // corre em círculo (raio 3,6 m) em volta do ponto de partida; o vórtice puxa e levanta quem está perto
        const w = 15 * Math.min(1, A.t / 0.25) * (A.t > A.dur - 0.25 ? (A.dur - A.t) / 0.25 : 1);
        A.a0 += w * dt;
        const R = 3.6, nx = A.cx + Math.cos(A.a0) * R, nz = A.cz + Math.sin(A.a0) * R;
        P.vx = (nx - P.x) / Math.max(dt, 1e-3); P.vz = (nz - P.z) / Math.max(dt, 1e-3); P.x = nx; P.z = nz;
        P.h = Math.atan2(P.vx, P.vz);
        for (let i = 0; i < (mobile ? 2 : 4); i++) { const a = rnd(0, 6.28), h0 = rnd(0, 7), rr = R + rnd(-0.5, 1.5); fx.raio(A.cx + Math.cos(a) * rr, P.y + h0, A.cz + Math.sin(a) * rr, A.cx + Math.cos(a + 0.9) * rr, P.y + h0 + rnd(0.5, 2), A.cz + Math.sin(a + 0.9) * rr, { vida: 0.2, desvio: 0.5 }); }
        for (const e of bandidos) {
          if ((emPe(e) && Math.hypot(e.x - A.cx, e.z - A.cz) < 13) && !A.presos.includes(e)) { e.estado = 'preso'; e.t = 0; e.orb = Math.atan2(e.z - A.cz, e.x - A.cx); e.r0 = Math.hypot(e.x - A.cx, e.z - A.cz); A.presos.push(e); }
        }
        for (const e of A.presos) {
          e.orb += dt * 6; e.r0 = lerp(e.r0, 5.5, Math.min(1, dt * 3)); e.y = lerp(e.y, 2.5 + Math.sin(e.orb * 0.5) * 0.8, Math.min(1, dt * 3));
          e.x = A.cx + Math.cos(e.orb) * e.r0; e.z = A.cz + Math.sin(e.orb) * e.r0;
        }
        H.tremor = Math.max(H.tremor, 0.12);
        if (A.t >= A.dur) {
          for (const e of A.presos) { e.estado = 'atordoado'; e.vida = 1; acertar(e, 'ciclone', { x: A.cx, z: A.cz, y: P.y }, { dano: 9, empurra: 13, alto: 7, especial: true }); }
          fx.onda(A.cx, P.y, A.cz, 14, 0.6); H.acao = null; P.vx = P.vz = 0;
        }
      } else if (A.tipo === 'sonico') {
        // 0–0,45 s: arrancada para longe (some); 0,45–0,95 s: volta na velocidade máxima; 0,95 s: o soco
        if (A.t < 0.45) {
          const k = A.t / 0.45, nx = lerp(A.de.x, A.longe.x, k * k), nz = lerp(A.de.z, A.longe.z, k * k);
          P.vx = (nx - P.x) / Math.max(dt, 1e-3); P.vz = (nz - P.z) / Math.max(dt, 1e-3); P.x = nx; P.z = nz; P.h = Math.atan2(-A.hx, -A.hz);
        } else if (A.t < 0.95) {
          const k = (A.t - 0.45) / 0.5, px = A.ix - A.hx * 1.0, pz = A.iz - A.hz * 1.0;
          const nx = lerp(A.longe.x, px, k), nz = lerp(A.longe.z, pz, k);
          P.vx = (nx - P.x) / Math.max(dt, 1e-3); P.vz = (nz - P.z) / Math.max(dt, 1e-3); P.x = nx; P.z = nz; P.h = Math.atan2(A.hx, A.hz);
          for (let i = 0; i < 2; i++) fx.raio(P.x, P.y + rnd(0.3, 1.7), P.z, P.x - A.hx * rnd(3, 7), P.y + rnd(0.2, 1.8), P.z - A.hz * rnd(3, 7), { vida: 0.22, desvio: 0.5 });
        } else { P.vx = P.vz = 0; }
        if (!A.feito && A.t >= 0.95) {
          A.feito = true;
          for (const e of bandidos) {
            if (!emPe(e)) continue;
            const d = Math.hypot(e.x - A.ix, e.z - A.iz);
            if (e === A.alvo || d < 10) acertar(e, 'sonico', P, { dano: 9, empurra: e === A.alvo ? 26 : 16 - d, alto: e === A.alvo ? 9 : 6, especial: true });
          }
          fx.onda(A.ix, P.y, A.iz, 16, 0.7); fx.clarao(A.ix, P.y + 1.4, A.iz, 7, 0.35);
          for (let i = 0; i < 10; i++) { const a = rnd(0, 6.28); fx.raio(A.ix, P.y + 1.3, A.iz, A.ix + Math.cos(a) * rnd(3, 7), P.y + rnd(0, 3), A.iz + Math.sin(a) * rnd(3, 7), { vida: 0.35, desvio: 0.7 }); }
          H.tremor = 0.9; H.hitstop = 0.14;
        }
        if (A.t >= A.dur) H.acao = null;
      }
    }

    // bandidos
    let atacando = bandidos.filter((e) => e.estado === 'prepara' || e.estado === 'golpe').length;
    for (let i = bandidos.length - 1; i >= 0; i--) {
      const e = bandidos[i];
      e.t += dt;
      if (e.brilho > 0) { e.brilho -= dt; if (e.brilho <= 0) e.b.moletom.emissive.setRGB(0, 0, 0); }
      const dx = P.x - e.x, dz = P.z - e.z, d = Math.hypot(dx, dz); e.dist = d;
      if (d < 30 && emPe(e)) perto = true;
      if (e.sair !== undefined) { e.sair -= dt; if (e.sair <= 0) { cena.remove(e.b.g); e.b.moletom.dispose(); bandidos.splice(i, 1); continue; } }
      const alturaOk = Math.abs(P.y - e.y) < 2.5;
      switch (e.estado) {
        case 'ronda': e.vx = e.vz = 0; if (d < 28 && alturaOk) { e.estado = 'vem'; e.t = 0; } break;
        case 'vem': {
          // vai para um lugar em volta do herói (cada um num ângulo, para cercar)
          const slot = (e.gangue * 7 + i * 2.3) % 6.28, alvoR = atacando < 2 ? 1.25 : 3.2;
          const gx = P.x + Math.cos(slot) * alvoR - e.x, gz = P.z + Math.sin(slot) * alvoR - e.z, gd = Math.hypot(gx, gz);
          const vmax = d > 8 ? 5.5 : 3.2;
          let vx = gd > 0.3 ? (gx / gd) * Math.min(vmax, gd * 3) : 0, vz = gd > 0.3 ? (gz / gd) * Math.min(vmax, gd * 3) : 0;
          // preso atrás de um carro ou de um poste: contorna por um lado por um instante
          if (e.desvio) { const c = Math.cos(1.3 * e.desvio), s = Math.sin(1.3 * e.desvio); [vx, vz] = [vx * c - vz * s, vx * s + vz * c]; e.desvioT -= dt; if (e.desvioT <= 0) e.desvio = 0; }
          e.vx = lerp(e.vx, vx, Math.min(1, dt * 6)); e.vz = lerp(e.vz, vz, Math.min(1, dt * 6));
          if (d < 1.9 && alturaOk) { e.estado = 'guarda'; e.t = 0; e.espera = rnd(0.35, 1.3); }
          if (d > 45 || !alturaOk && d > 10) { e.estado = 'ronda'; }
          break;
        }
        case 'guarda':
          e.vx *= 0.8; e.vz *= 0.8;
          if (d > 2.6) { e.estado = 'vem'; e.t = 0; }
          else if (e.t > e.espera && atacando < 2 && !H.acao) { e.estado = 'prepara'; e.t = 0; atacando++; e.b.moletom.emissive.setRGB(0.5, 0.05, 0.05); }
          break;
        case 'prepara': e.vx = e.vz = 0; if (e.t > 0.45) { e.estado = 'golpe'; e.t = 0; } break;
        case 'golpe':
          if (e.t > 0.06 && !e.bateu) {
            e.bateu = true;
            const atacado = H.acao && (H.acao.tipo !== 'soco' || H.acao.t < H.acao.dash);     // durante especiais e avanços o herói é rápido demais
            if (d < 2.1 && alturaOk && !atacado) { P.energia = Math.max(0, P.energia - DANO_HEROI); H.dano = 1; H.tremor = Math.max(H.tremor, 0.3); P.vx += (dx / (d || 1)) * 4; P.vz += (dz / (d || 1)) * 4; H.sofridos++; eventos.push({ tipo: 'dano' }); }
          }
          if (e.t > 0.3) { e.estado = 'guarda'; e.t = 0; e.espera = rnd(0.9, 2.2); e.bateu = false; e.b.moletom.emissive.setRGB(0, 0, 0); }
          break;
        case 'atordoado': e.vx *= Math.exp(-5 * dt); e.vz *= Math.exp(-5 * dt); if (e.t > 0.45) { e.estado = 'guarda'; e.t = 0; e.espera = rnd(0.5, 1.2); } break;
        case 'voando':
          e.vy -= 22 * dt; e.y += e.vy * dt;
          if (e.y <= 0 && e.vy < 0) { e.y = 0; if (Math.abs(e.vy) > 6) { e.vy = -e.vy * 0.25; e.vx *= 0.6; e.vz *= 0.6; } else { e.estado = 'caido'; e.t = 0; e.vx = e.vz = 0; } }
          break;
        case 'caido': e.vx = e.vz = 0; break;
        case 'fugiu': e.vx = -dx / (d || 1) * 7; e.vz = -dz / (d || 1) * 7; break;
        default: break;
      }
      const x0 = e.x, z0 = e.z;
      if (e.estado !== 'preso') { e.x += e.vx * dt; e.z += e.vz * dt; }
      if (colide && e.estado !== 'preso') { const r = colide(e.x, e.z, e.y); e.x = r.x; e.z = r.z; }
      if (e.estado === 'vem' && !e.desvio) {
        const quer = Math.hypot(e.vx, e.vz) * dt, andou = Math.hypot(e.x - x0, e.z - z0);
        e.travado = quer > 0.01 && andou < quer * 0.3 ? (e.travado || 0) + dt : 0;
        if (e.travado > 0.25) { e.desvio = Math.random() < 0.5 ? -1 : 1; e.desvioT = 0.9; e.travado = 0; }
      }
      if (chao && e.estado === 'caido') e.y = chao(e.x, e.z, e.y + 1);
      // rumo: olha para o herói quando luta; senão para onde anda
      const v = Math.hypot(e.vx, e.vz);
      let alvoH = e.h;
      if (e.estado === 'vem' || e.estado === 'guarda' || e.estado === 'prepara' || e.estado === 'golpe' || e.estado === 'ronda' && d < 40) alvoH = Math.atan2(dx, dz);
      else if (v > 0.5 && e.estado !== 'voando') alvoH = Math.atan2(e.vx, e.vz);
      if (e.estado !== 'voando' && e.estado !== 'caido' && e.estado !== 'preso') e.h += ang(alvoH - e.h) * Math.min(1, dt * 10);
      e.b.g.position.set(e.x, e.y, e.z); e.b.g.rotation.y = e.h;
      poseBandido(e.b, e, dt);
    }
    H.luta = lerp(H.luta, perto || H.acao ? 1 : 0, Math.min(1, dt * 5));
    fx.atualizar(dt);
    return eventos.splice(0);
  }

  /** para a animação do herói: {golpe:{tipo, lado, k}, corrida (v para a passada), luta (0..1)} */
  function poseHeroi() {
    const A = H.acao; let golpe = null, corrida = null;
    if (A?.tipo === 'soco') {
      if (A.t < A.dash) corrida = 40;
      else { const t = (A.t - A.dash) / (A.dur - A.dash), pico = (A.bate - A.dash) / (A.dur - A.dash); golpe = { tipo: A.gancho ? 'gancho' : 'soco', lado: A.lado, k: t < pico ? Math.pow(t / pico, 0.7) : Math.max(0, 1 - (t - pico) / (1 - pico)) }; }
    } else if (A?.tipo === 'raio') { const t = A.t / A.dur, pico = A.bate / A.dur; golpe = { tipo: 'raio', lado: 1, k: t < pico ? t / pico : Math.max(0, 1 - (t - pico) / (1 - pico) * 0.8) }; }
    else if (A?.tipo === 'ciclone') corrida = 50;
    else if (A?.tipo === 'sonico') { if (A.t < 0.95) corrida = 55; else golpe = { tipo: 'soco', lado: 1, k: Math.max(0, 1 - (A.t - 0.95) / 0.6) }; }
    return { golpe, corrida, luta: H.luta };
  }

  return {
    gerarGangue, vivos, centro, remover, bater, especial, passo, poseHeroi,
    get ocupado() { return !!H.acao; }, get acao() { return H.acao; }, get bandidos() { return bandidos; },
    // a câmera olha para o centro do vórtice e para o ponto do impacto do sônico (o herói some e volta no quadro)
    get foco() { const A = H.acao; return A?.tipo === 'ciclone' ? { x: A.cx, z: A.cz } : A?.tipo === 'sonico' ? { x: A.ix - A.hx * 3, z: A.iz - A.hz * 3 } : null; },
    get tremor() { return H.tremor; }, get sofridos() { return H.sofridos; }, get dano() { return H.dano; },
    get hitstop() { return H.hitstop; }, set hitstop(v) { H.hitstop = v; },
    pertoDeBandido: (P, r = 30) => bandidos.some((e) => emPe(e) && Math.hypot(e.x - P.x, e.z - P.z) < r),
  };
}
