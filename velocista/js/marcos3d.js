// O desenho dos LUGARES DA HISTÓRIA (marcos.js é o plano): o que não é prédio comum — colunas, frontão, relógio, toldo,
// mesinhas, viaturas, letreiros, telhado de duas águas, cerca, a ponte e o presídio na ilha. THREE passado por parâmetro.
// A geometria de cor sólida entra nos baldes do quarteirão (api.caixa/cil/cone/geo: um desenho a mais por material, não
// por peça); letreiros, relógio e luzes que piscam são malhas próprias com texturas de canvas guardadas uma vez só.
import { PONTE, ILHA, PRESIDIO } from './marcos.js';

const PI = Math.PI;
const PEDRA = [0.78, 0.77, 0.73], PEDRA_ESC = [0.55, 0.54, 0.51], BRANCO = [0.93, 0.93, 0.92], ACO = [0.32, 0.34, 0.38], ACO_ESC = [0.16, 0.17, 0.19];
const VIDRO = [0.07, 0.1, 0.15], PRETO = [0.06, 0.06, 0.07], VERDE_ESC = [0.1, 0.27, 0.2], CREME = [0.93, 0.87, 0.74];

// ---------- texturas (uma vez por página) ----------
const cacheTex = new Map();
function tela(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function texturaDe(THREE, chave, w, h, pinta, repete = false) {
  if (cacheTex.has(chave)) return cacheTex.get(chave);
  const [c, g] = tela(w, h); pinta(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repete) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  cacheTex.set(chave, t); return t;
}
const cacheMat = new Map();
function matBasico(THREE, chave, opc) { if (!cacheMat.has(chave)) cacheMat.set(chave, new THREE.MeshBasicMaterial(opc)); return cacheMat.get(chave); }
function letreiro(THREE, chave, texto, { fundo = '#13233f', cor = '#ffffff', borda = '#c9d6e6', w = 1024, h = 128, fonte = 'bold', sub = null } = {}) {
  return texturaDe(THREE, chave, w, h, (g) => {
    g.fillStyle = fundo; g.fillRect(0, 0, w, h);
    if (borda) { g.strokeStyle = borda; g.lineWidth = Math.max(3, h * 0.04); g.strokeRect(6, 6, w - 12, h - 12); }
    g.fillStyle = cor; g.textAlign = 'center'; g.textBaseline = 'middle';
    let px = Math.round(h * (sub ? 0.5 : 0.62)); g.font = `${fonte} ${px}px Arial, Helvetica, sans-serif`;
    if ('letterSpacing' in g) g.letterSpacing = `${Math.round(px * 0.08)}px`;
    while (g.measureText(texto).width > w * 0.9 && px > 10) { px -= 2; g.font = `${fonte} ${px}px Arial, Helvetica, sans-serif`; }
    g.fillText(texto, w / 2, sub ? h * 0.4 : h / 2);
    if (sub) { g.font = `600 ${Math.round(h * 0.2)}px Arial, Helvetica, sans-serif`; g.globalAlpha = 0.85; g.fillText(sub, w / 2, h * 0.78); g.globalAlpha = 1; }
  });
}
// placa plana voltada para `dir` (0: −z, 1: +x, 2: +z, 3: −x), centro (x, y, z), largura × altura
function placa(THREE, api, mat, x, y, z, w, h, dir = 0) {
  const g = new THREE.PlaneGeometry(w, h); api.geos.push(g);
  const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.rotation.y = [PI, -PI / 2, 0, PI / 2][dir]; api.grupo.add(m); return m;
}
// prisma (telhado de duas águas / frontão): base retangular w × d em y0, cumeeira na altura h, ao longo de x
function geoPrisma(THREE, w, d, h) {
  const s = new THREE.Shape(); s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false }); g.rotateY(PI / 2); g.translate(-w / 2, 0, 0);
  return g;
}

// ---------- cada lugar da cidade ----------
/** Desenha os extras do lugar b.marco no quarteirão b. api: {caixa, cil, cone, geo, luz, grupo, geos, THREE, compor}. Devolve {atualizar}. */
export function desenharMarco(THREE, b, api) {
  const id = b.marco.id, X = (u) => b.cx + u, Z = (v) => b.cz + v, y0 = 0.3;
  const anima = [];
  if (id === 'delegacia') {
    // pórtico: 4 colunas, a viga com o nome, degraus; mastros com bandeiras; as viaturas; a antena no telhado
    for (const u of [-10, -3.5, 3.5, 10]) { api.cil(X(u), y0 + 4.35, Z(-21.2), 0.42, 8.7, PEDRA); api.caixa(X(u), y0 + 0.15, Z(-21.2), 1.2, 0.3, 1.2, PEDRA_ESC); api.caixa(X(u), 8.9, Z(-21.2), 1.1, 0.4, 1.1, PEDRA_ESC); }
    api.caixa(X(0), 9.6, Z(-20), 22, 1.2, 4, PEDRA); api.caixa(X(0), 10.3, Z(-20), 22.6, 0.2, 4.4, PEDRA_ESC);
    for (let k = 0; k < 3; k++) api.caixa(X(0), y0 + 0.08 + k * 0.1, Z(-22.6 - k * 0.6), 20 - k * 1.5, 0.16, 1.2, PEDRA_ESC);
    placa(THREE, api, matBasico(THREE, 'del-nome', { map: letreiro(THREE, 'del-nome', 'DELEGACIA CENTRAL', { fundo: '#d8d6cf', cor: '#1b2b4a', borda: null, sub: 'POLÍCIA DA CIDADE' }) }), X(0), 9.6, Z(-22.02), 17, 1.15, 0);
    for (const u of [-14, 14]) { api.cil(X(u), y0 + 6, Z(-25.5), 0.08, 12, ACO); api.caixa(X(u + 1.1), y0 + 10.9, Z(-25.5), 2.2, 1.3, 0.04, u < 0 ? [0.12, 0.25, 0.55] : [0.9, 0.9, 0.9]); }
    api.cil(X(18), 22.3 + 7, Z(18), 0.18, 14, ACO); for (let k = 0; k < 3; k++) api.caixa(X(18), 22.3 + 5 + k * 3, Z(18), 2.4 - k * 0.6, 0.08, 0.08, ACO);
    for (const u of b.marco.viaturas) {
      const x = X(u), z = Z(-26.25);
      api.caixa(x, 0.62, z, 1.85, 0.72, 4.3, BRANCO); api.caixa(x, 0.66, z, 1.87, 0.22, 2.6, [0.1, 0.22, 0.55]);
      api.caixa(x, 1.2, z + 0.2, 1.6, 0.62, 2.2, VIDRO); api.caixa(x, 1.5, z + 0.2, 1.5, 0.08, 2.0, BRANCO);
      for (const [a, c] of [[0.92, 1.4], [-0.92, 1.4], [0.92, -1.4], [-0.92, -1.4]]) api.caixa(x + a, 0.34, z + c, 0.26, 0.68, 0.68, PRETO);
    }
    // o giroflex: as luzes vermelhas numa malha só e as azuis em outra (piscam trocando)
    const mr = matBasico(THREE, 'giroflex-r', { color: 0xff2030 }), ma = matBasico(THREE, 'giroflex-a', { color: 0x2050ff });
    for (const [dx, mat] of [[-0.35, mr], [0.35, ma]]) {
      const g = caixas(THREE, b.marco.viaturas.map((u) => [X(u) + dx, 1.62, Z(-26.05)]), 0.5, 0.14, 0.3); api.geos.push(g);
      api.grupo.add(new THREE.Mesh(g, mat));
    }
    anima.push((dt, t) => { const f = Math.sin(t * 9) > 0; mr.color.setHex(f ? 0xff2030 : 0x3a0608); ma.color.setHex(f ? 0x0a1440 : 0x2a5cff); });
  } else if (id === 'jornal') {
    // o letreiro corrido das notícias em volta do pódio e o letreiro grande de treliça no alto da torre
    const tex = texturaDe(THREE, 'jornal-faixa', 2048, 64, (g, w, h) => {
      g.fillStyle = '#050608'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffcf4a'; g.font = 'bold 40px Arial, Helvetica, sans-serif'; g.textBaseline = 'middle';
      g.fillText('PICTURE NEWS  •  BORRÃO VERMELHO SALVA MAIS UM  •  S.T.A.R. LABS REABRE O CORTEX  •  APAGÃO NO CENTRO  •  QUEM É O HOMEM MAIS RÁPIDO DO MUNDO?  •', 10, h / 2 + 2);
    }, true);
    const mFaixa = matBasico(THREE, 'jornal-faixa', { map: tex });
    for (const [x, z, w, dir] of [[X(0), Z(-24.03), 52, 0], [X(26.03), Z(0), 48, 1], [X(0), Z(24.03), 52, 2], [X(-26.03), Z(0), 48, 3]]) placa(THREE, api, mFaixa, x, 10.4, z, w, 1.4, dir);
    tex.repeat.set(2.6, 1);
    anima.push((dt, t) => { tex.offset.x = (t * 0.05) % 1; });
    const topo = 12.3 + 66;
    for (const u of [-15, -7.5, 0, 7.5, 15]) api.caixa(X(u), topo + 4.2, Z(-13.6), 0.25, 8.4, 0.25, ACO);
    for (const y of [topo + 0.6, topo + 8.2]) api.caixa(X(0), y, Z(-13.6), 30.4, 0.25, 0.25, ACO);
    for (let k = 0; k < 6; k++) api.caixa(X(-15 + k * 6 + 3), topo + 4.2, Z(-13.4), 0.12, 7.8, 0.12, ACO_ESC);
    const mNome = matBasico(THREE, 'jornal-nome', { map: letreiro(THREE, 'jornal-nome', 'PICTURE NEWS', { fundo: '#0c1220', cor: '#ff3b3b', borda: '#ffd9a0' }), toneMapped: false });
    placa(THREE, api, mNome, X(0), topo + 4.4, Z(-13.85), 29, 3.6, 0); placa(THREE, api, mNome, X(0), topo + 4.4, Z(-13.35), 29, 3.6, 2);
    placa(THREE, api, matBasico(THREE, 'jornal-porta', { map: letreiro(THREE, 'jornal-porta', 'PICTURE NEWS', { fundo: '#2a2216', cor: '#e8c77a', borda: '#e8c77a' }) }), X(0), 6.2, Z(-24.05), 12, 1.5, 0);
  } else if (id === 'cafe') {
    // toldo listrado, o letreiro com a xícara, mesinhas e guarda-sóis na calçada
    const tToldo = texturaDe(THREE, 'cafe-toldo', 256, 64, (g, w, h) => { for (let k = 0; k < 16; k++) { g.fillStyle = k % 2 ? '#efe4c8' : '#1e4d36'; g.fillRect(k * 16, 0, 16, h); } g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, h - 10, w, 10); }, true);
    tToldo.repeat.set(3, 1);
    const toldo = placa(THREE, api, matBasico(THREE, 'cafe-toldo', { map: tToldo, side: THREE.DoubleSide }), X(-14), 4.25, Z(-28.1), 24, 2.4, 0);
    toldo.rotation.x = -0.55;
    api.caixa(X(-14), 5.2, Z(-27.1), 24.4, 0.12, 0.25, VERDE_ESC);
    const mNome = matBasico(THREE, 'cafe-nome', { map: texturaDe(THREE, 'cafe-nome', 1024, 192, (g, w, h) => {
      g.fillStyle = '#1e4d36'; g.fillRect(0, 0, w, h); g.strokeStyle = '#efe4c8'; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
      g.fillStyle = '#efe4c8'; g.beginPath(); g.ellipse(150, 108, 54, 40, 0, 0, PI); g.fill(); g.fillRect(96, 70, 108, 40);   // a xícara
      g.lineWidth = 10; g.beginPath(); g.arc(214, 94, 20, -PI / 2, PI / 2); g.stroke();
      for (const dx of [-20, 0, 20]) { g.lineWidth = 5; g.beginPath(); g.moveTo(150 + dx, 58); g.bezierCurveTo(140 + dx, 40, 162 + dx, 30, 150 + dx, 14); g.stroke(); }
      g.font = 'bold 104px Georgia, "Times New Roman", serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('Jitters', 290, 92);
      g.font = '600 30px Arial, Helvetica, sans-serif'; g.fillText('CAFÉ  ·  DESDE 1989', 300, 160);
    }) });
    placa(THREE, api, mNome, X(-14), 7.1, Z(-27.06), 10, 1.9, 0);
    for (const u of [-24, -18.5, -9.5, -4]) {
      const x = X(u), z = Z(-28.9);
      api.cil(x, y0 + 0.37, z, 0.05, 0.74, ACO_ESC); api.cil(x, y0 + 0.75, z, 0.45, 0.04, CREME);
      for (const d of [-0.8, 0.8]) { api.caixa(x + d, y0 + 0.45, z, 0.42, 0.06, 0.42, VERDE_ESC); api.caixa(x + d * 1.22, y0 + 0.75, z, 0.06, 0.6, 0.42, VERDE_ESC); }
      api.cil(x, y0 + 1.25, z, 0.03, 2.5, ACO_ESC); api.cone(x, y0 + 2.45, z, 1.25, 0.5, VERDE_ESC);
    }
  } else if (id === 'prefeitura') {
    // pórtico de 6 colunas, frontão, degraus, a torre do relógio (4 mostradores com os ponteiros na hora do jogo) e a fonte
    for (const u of [-12.5, -7.5, -2.5, 2.5, 7.5, 12.5]) { api.cil(X(u), y0 + 6.85, Z(-3), 0.5, 13.7, BRANCO); api.caixa(X(u), y0 + 0.2, Z(-3), 1.3, 0.4, 1.3, PEDRA); api.caixa(X(u), 13.8, Z(-3), 1.2, 0.4, 1.2, PEDRA); }
    api.caixa(X(0), 14.6, Z(-2), 28, 1.2, 4, BRANCO);
    { const g = geoPrisma(THREE, 28.4, 4.6, 3.6); api.geo(g, api.compor(X(0), 15.2, Z(-2), 1, 1, 1), BRANCO); g.dispose(); }
    for (let k = 0; k < 4; k++) api.caixa(X(0), y0 + 0.06 + k * 0.12, Z(-4.3 - k * 0.7), 30 - k * 1.2, 0.12, 1.4, PEDRA);
    placa(THREE, api, matBasico(THREE, 'pref-nome', { map: letreiro(THREE, 'pref-nome', 'PREFEITURA', { fundo: '#e6e2d8', cor: '#3a3326', borda: null }) }), X(0), 14.6, Z(-4.02), 12, 1.05, 0);
    const torre = { u: 0, v: 10, l: 10, y0: 17.3, y1: 47.3 };
    api.caixa(X(0), torre.y1 + 0.4, Z(torre.v), 11, 0.8, 11, PEDRA);
    api.cil(X(0), torre.y1 + 3.3, Z(torre.v), 3.6, 5, BRANCO); api.cone(X(0), torre.y1 + 8.8, Z(torre.v), 4.2, 6, [0.24, 0.36, 0.3]);
    api.cil(X(0), torre.y1 + 13.6, Z(torre.v), 0.08, 3.6, ACO);
    // os 4 mostradores usam a mesma textura; os ponteiros são pintados nela quando o minuto do jogo muda
    const tRel = texturaDe(THREE, 'pref-relogio', 256, 256, () => {});
    const pintaRelogio = (h) => {
      const g = tRel.image.getContext('2d');
      g.clearRect(0, 0, 256, 256);
      g.fillStyle = '#f2ecdc'; g.beginPath(); g.arc(128, 128, 122, 0, 2 * PI); g.fill(); g.strokeStyle = '#2b2620'; g.lineWidth = 8; g.stroke();
      g.fillStyle = '#2b2620'; for (let k = 0; k < 12; k++) { const a = (k / 12) * 2 * PI; g.save(); g.translate(128 + Math.sin(a) * 100, 128 - Math.cos(a) * 100); g.rotate(a); g.fillRect(-3, -10, 6, k % 3 ? 14 : 22); g.restore(); }
      const ponteiro = (ang, comp, larg) => { g.save(); g.translate(128, 128); g.rotate(ang); g.fillRect(-larg / 2, -comp, larg, comp + 12); g.restore(); };
      g.fillStyle = '#1d1a16'; ponteiro(((h % 12) / 12) * 2 * PI, 62, 10); ponteiro((((h * 60) % 60) / 60) * 2 * PI, 92, 6);
      g.beginPath(); g.arc(128, 128, 9, 0, 2 * PI); g.fill();
      tRel.needsUpdate = true;
    };
    const mRel = matBasico(THREE, 'pref-relogio', { map: tRel, transparent: true });
    const yR = 42.5;
    for (const [x, z, dir] of [[X(0), Z(torre.v - 5.06), 0], [X(5.06), Z(torre.v), 1], [X(0), Z(torre.v + 5.06), 2], [X(-5.06), Z(torre.v), 3]]) placa(THREE, api, mRel, x, yR, z, 6.4, 6.4, dir);
    let minuto = -1;
    anima.push((dt, t, mundo) => {
      const h = ((mundo?.T ?? 0.5) * 24) % 24, m = Math.floor(h * 60);
      if (m !== minuto) { minuto = m; pintaRelogio(h); }
    });
    // a fonte da praça
    api.cil(X(0), y0 + 0.3, Z(-16), 3.2, 0.6, PEDRA); api.cil(X(0), y0 + 0.56, Z(-16), 2.9, 0.06, [0.2, 0.42, 0.62]);
    api.cil(X(0), y0 + 1.2, Z(-16), 0.35, 2.4, PEDRA); api.cil(X(0), y0 + 2.4, Z(-16), 1.1, 0.25, PEDRA);
    for (const u of [-6, 0, 6]) { api.cil(X(u), y0 + 5, Z(-26), 0.07, 10, ACO); api.caixa(X(u + 0.9), y0 + 9.2, Z(-26), 1.8, 1.1, 0.04, u ? [0.85, 0.85, 0.82] : [0.15, 0.35, 0.6]); }
  } else if (id === 'casa') {
    // telhado de duas águas, varanda com pilares, porta, a cerca branca do quintal e a caixa de correio
    { const g = geoPrisma(THREE, 13, 11, 3.4); api.geo(g, api.compor(X(0), 6.7, Z(2), 1, 1, 1), [0.45, 0.18, 0.14]); g.dispose(); }
    api.caixa(X(0), 3.0, Z(-4.3), 12, 0.2, 2.6, BRANCO); for (const u of [-5.6, -2, 2, 5.6]) api.cil(X(u), y0 + 1.35, Z(-5.4), 0.1, 2.7, BRANCO);
    api.caixa(X(0), y0 + 0.12, Z(-4.3), 12, 0.24, 2.6, [0.6, 0.5, 0.4]);
    api.caixa(X(0), y0 + 1.15, Z(-3.04), 1.2, 2.3, 0.08, [0.36, 0.2, 0.12]);
    const cerca = (x0, x1, z0, z1) => {
      const L = Math.hypot(x1 - x0, z1 - z0), n = Math.round(L / 0.55), rot = Math.atan2(-(z1 - z0), x1 - x0);
      for (let k = 0; k <= n; k++) { const f = k / n; api.caixa(X(x0 + (x1 - x0) * f), y0 + 0.45, Z(z0 + (z1 - z0) * f), 0.09, 0.9, 0.05, BRANCO, rot); }
      for (const y of [0.35, 0.75]) api.caixa(X((x0 + x1) / 2), y0 + y, Z((z0 + z1) / 2), L, 0.07, 0.04, BRANCO, rot);
    };
    cerca(-11, -1.2, -9, -9); cerca(1.2, 11, -9, -9); cerca(-11, -11, -9, 11); cerca(11, 11, -9, 11); cerca(-11, 11, 11, 11);
    api.cil(X(2.4), y0 + 0.55, Z(-9.6), 0.05, 1.1, ACO_ESC); api.caixa(X(2.4), y0 + 1.2, Z(-9.6), 0.35, 0.3, 0.55, [0.2, 0.3, 0.55]);
    placa(THREE, api, matBasico(THREE, 'casa-nome', { map: letreiro(THREE, 'casa-nome', 'WEST', { fundo: '#24365f', cor: '#ffffff', borda: null, w: 256, h: 96 }) }), X(2.4), y0 + 1.2, Z(-9.88), 0.5, 0.19, 0);
    api.caixa(X(0), y0 + 0.02, Z(-6.5), 1.6, 0.04, 5, [0.62, 0.6, 0.56]);     // o caminho até a porta
  }
  return { atualizar: (dt, t, mundo) => { for (const f of anima) f(dt, t, mundo); } };
}
// várias caixas iguais numa geometria só (centros dados)
function caixas(THREE, centros, sx, sy, sz) {
  const base = new THREE.BoxGeometry(sx, sy, sz).toNonIndexed(), p = base.attributes.position.array, n = base.attributes.normal.array, k = p.length;
  const pos = new Float32Array(k * centros.length), nor = new Float32Array(k * centros.length);
  centros.forEach(([x, y, z], c) => { for (let i = 0; i < k; i += 3) { pos[c * k + i] = p[i] + x; pos[c * k + i + 1] = p[i + 1] + y; pos[c * k + i + 2] = p[i + 2] + z; nor.set(n.subarray(i, i + 3), c * k + i); } });
  base.dispose();
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.computeBoundingSphere(); return g;
}

// ---------- fora da grade: a ponte e o presídio na ilha ----------
/** Quarteirão "de mentira" para a ilha (desenhado pelo construirBloco do jogo, como os outros): os pavilhões e as árvores. */
export function blocoIlha() {
  const Q = PRESIDIO, cx = (ILHA.x0 + ILHA.x1) / 2, cz = (ILHA.z0 + ILHA.z1) / 2;
  const lotes = Q.blocos.map((b) => ({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, y0: 0.3, y1: b.h, estilo: 2, tom: 2, semLoja: true }));
  const arvores = [];
  for (let k = 0; k < 26; k++) {
    const a = (k / 26) * 2 * PI, r = 118 + (k % 3) * 3, x = cx + Math.cos(a) * r * 1.0, z = cz + Math.sin(a) * r * 0.98;
    if (x < ILHA.x0 + 6 || x > ILHA.x1 - 6 || z < ILHA.z0 + 6 || z > ILHA.z1 - 6) continue;
    if (Math.abs(z - PONTE.z) < 14 && x < Q.cx - Q.meio) continue;
    arvores.push({ x, z, s: 0.8 + (k % 4) * 0.12 });
  }
  return { i: -1, j: -1, cx, cz, tipo: 'ilha', semLaje: true, lotes, arvores, orbes: [], rects: [], topo: [], carros: [], postes: [], marco: { id: 'fora' } };
}
/** Os extras de fora: chão da ilha, muralha, guaritas com holofotes, portão com o nome, e a ponte inteira. */
export function desenharFora(THREE, api) {
  const P = PONTE, Q = PRESIDIO, hz = P.larg / 2, anima = [];
  // a ilha: rochedo + chão
  api.caixa((ILHA.x0 + ILHA.x1) / 2, -1.6, (ILHA.z0 + ILHA.z1) / 2, ILHA.x1 - ILHA.x0 + 10, 2.4, ILHA.z1 - ILHA.z0 + 10, [0.36, 0.34, 0.31]);
  api.caixa((ILHA.x0 + ILHA.x1) / 2, -0.15, (ILHA.z0 + ILHA.z1) / 2, ILHA.x1 - ILHA.x0, 0.9, ILHA.z1 - ILHA.z0, [0.33, 0.4, 0.27]);
  api.caixa(Q.cx, 0.31, Q.cz, Q.meio * 2, 0.02, Q.meio * 2, [0.45, 0.45, 0.43]);                  // o pátio de dentro
  api.caixa((P.x1 + Q.cx - Q.meio) / 2 + 4, 0.315, P.z, Q.cx - Q.meio - P.x1 + 4, 0.03, 12, [0.2, 0.2, 0.22]);   // a estrada até o portão
  // a muralha (com o arame no alto) e as guaritas
  const m = Q.meio, e = Q.esp, h = Q.muro, CON = [0.62, 0.61, 0.58];
  const muro = (x0, x1, z0, z1, ya = 0.3) => { api.caixa((x0 + x1) / 2, (ya + h) / 2, (z0 + z1) / 2, x1 - x0, h - ya, z1 - z0, CON); api.caixa((x0 + x1) / 2, h + 0.15, (z0 + z1) / 2, x1 - x0 + 0.2, 0.3, z1 - z0 + 0.2, PEDRA_ESC); };
  const { cx, cz } = Q;
  muro(cx - m, cx + m, cz - m - e, cz - m); muro(cx - m, cx + m, cz + m, cz + m + e); muro(cx + m, cx + m + e, cz - m - e, cz + m + e);
  muro(cx - m - e, cx - m, cz - m - e, cz + Q.portao[0]); muro(cx - m - e, cx - m, cz + Q.portao[1], cz + m + e); muro(cx - m - e, cx - m, cz + Q.portao[0], cz + Q.portao[1], 7);
  for (const [x0, z0, x1, z1] of [[cx - m, cz - m - e / 2, cx + m, cz - m - e / 2], [cx - m, cz + m + e / 2, cx + m, cz + m + e / 2], [cx + m + e / 2, cz - m, cx + m + e / 2, cz + m]]) {
    const L = Math.hypot(x1 - x0, z1 - z0), rot = Math.atan2(-(z1 - z0), x1 - x0);
    api.caixa((x0 + x1) / 2, h + 0.75, (z0 + z1) / 2, L, 0.6, 0.6, ACO_ESC, rot);          // o arame no alto
  }
  placaNome(THREE, api, 'presidio-nome', 'PRESÍDIO IRON HEIGHTS', cx - m - e - 0.03, 8.6, cz, Q.portao[1] - Q.portao[0] + 8, 2.4, 3, { fundo: '#2b2b2b', cor: '#f2f2f2', borda: '#d0a000' });
  for (const s of [-1, 1]) api.caixa(cx - m - e - 2, 3.5, cz + s * (Q.portao[1] + 4.5), 0.25, 6.4, 8, ACO_ESC);           // folhas do portão, abertas
  const holo = matBasico(THREE, 'presidio-holofote', { color: 0xfff2c0, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const geoFacho = new THREE.ConeGeometry(9, 46, 16, 1, true); geoFacho.translate(0, -23, 0); geoFacho.rotateX(PI / 2.6); api.geos.push(geoFacho);
  const fachos = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = cx + sx * m, z = cz + sz * m, t = Q.ladoTorre / 2, H = Q.alturaTorre;
    api.caixa(x, H - 2.6, z, t * 2 + 2.4, 4.4, t * 2 + 2.4, [0.3, 0.3, 0.3]); api.caixa(x, H - 2.6, z, t * 2 + 2.5, 1.8, t * 2 + 2.5, VIDRO);
    api.caixa(x, H + 0.1, z, t * 2 + 3.2, 0.4, t * 2 + 3.2, PEDRA_ESC);
    const piv = new THREE.Group(); piv.position.set(x, H - 1, z); const f = new THREE.Mesh(geoFacho, holo); piv.add(f); api.grupo.add(piv); fachos.push({ piv, fase: sx * 1.3 + sz * 0.7 });
  }
  anima.push((dt, t, mundo) => { holo.opacity = 0.05 + 0.2 * (mundo?.noite ?? 0); for (const f of fachos) f.piv.rotation.y = f.fase + t * 0.35; });
  // a PONTE: tabuleiro, calçadas, faixas, guarda-corpos, pilares, duas torres, os cabos e os postes de luz
  const xm = (P.x0 + P.x1) / 2, L = P.x1 - P.x0 + 16;
  api.caixa(xm, 0.05, P.z, L, 0.5, P.larg, [0.18, 0.18, 0.2]); api.caixa(xm, -1.4, P.z, L, 2.4, P.larg - 3, ACO_ESC);
  for (const s of [-1, 1]) { api.caixa(xm, 0.38, P.z + s * (hz - 0.8), L, 0.16, 1.6, [0.55, 0.55, 0.53]); api.caixa(xm, 0.85, P.z + s * (hz + 0.2), L, 0.12, 0.12, ACO); api.caixa(xm, 1.35, P.z + s * (hz + 0.2), L, 0.1, 0.18, ACO); }
  for (let x = P.x0; x < P.x1; x += 2.5) for (const s of [-1, 1]) api.caixa(x, 0.85, P.z + s * (hz + 0.2), 0.06, 1.0, 0.06, ACO);
  for (let x = P.x0 + 3; x < P.x1; x += 7) api.caixa(x, 0.31, P.z, 3, 0.02, 0.18, BRANCO);
  for (let x = P.x0 + 20; x < P.x1; x += 40) api.cil(x, -6, P.z, 2.4, 12, PEDRA_ESC);
  const T = P.alturaTorre;
  for (const xt of P.torres) {
    for (const s of [-1, 1]) api.caixa(xt, (T - 4) / 2, P.z + s * (hz + 2), 3, T + 4, 3, [0.55, 0.16, 0.14]);
    for (const y of [T * 0.45, T - 2]) api.caixa(xt, y, P.z, 2.4, 2.4, P.larg + 7, [0.55, 0.16, 0.14]);
  }
  // cabo principal: das pontas às torres e entre elas (parábola), com os pendurais
  const yCabo = (x) => {
    const [a, b] = P.torres;
    if (x <= a) return 1.4 + (T - 1.4 - 1) * ((x - P.x0) / (a - P.x0)) ** 1.6;
    if (x >= b) return 1.4 + (T - 1.4 - 1) * ((P.x1 - x) / (P.x1 - b)) ** 1.6;
    const f = (x - (a + b) / 2) / ((b - a) / 2); return 6 + (T - 1 - 6) * f * f;
  };
  for (const s of [-1, 1]) {
    const z = P.z + s * (hz + 2);
    for (let x = P.x0; x < P.x1; x += 6) {
      const xa = x, xb = Math.min(P.x1, x + 6), ya = yCabo(xa), yb = yCabo(xb), Lc = Math.hypot(xb - xa, yb - ya);
      const g = ajustaCabo(THREE, Lc, Math.atan2(yb - ya, xb - xa));
      api.geo(g, api.compor((xa + xb) / 2, (ya + yb) / 2, z, 1, 1, 1), ACO_ESC); g.dispose();
      if (x % 12 < 6 && yCabo(x) > 2.2) api.cil(x, (0.4 + yCabo(x)) / 2, z, 0.05, yCabo(x) - 0.4, ACO);
    }
  }
  for (let x = P.x0 + 10; x < P.x1; x += 25) for (const s of [-1, 1]) { api.cil(x, 3.3, P.z + s * (hz - 0.4), 0.08, 6, ACO_ESC); api.luz(x, 6.3, P.z + s * (hz - 1.2), 0.5, 0.12, 1.4); }
  // pórtico de placas na entrada da ponte
  for (const s of [-1, 1]) api.caixa(P.x0 + 6, 3.5, P.z + s * (hz + 0.6), 0.4, 7, 0.4, ACO);
  api.caixa(P.x0 + 6, 6.9, P.z, 0.4, 0.4, P.larg + 1.6, ACO);
  placaNome(THREE, api, 'ponte-placa', 'PONTE DA BAÍA', P.x0 + 5.75, 5.9, P.z, 9, 1.8, 3, { fundo: '#13603a', cor: '#ffffff', borda: '#ffffff', sub: 'IRON HEIGHTS  →' });
  return { atualizar: (dt, t, mundo) => { for (const f of anima) f(dt, t, mundo); } };
}
// cilindro de comprimento L deitado ao longo de x, inclinado `ang` no plano xy (para os trechos do cabo)
function ajustaCabo(THREE, L, ang) { const g = new THREE.CylinderGeometry(0.28, 0.28, L, 6); g.rotateZ(-PI / 2 + ang); return g; }
function placaNome(THREE, api, chave, texto, x, y, z, w, h, dir, opc) {
  const mat = matBasico(THREE, chave, { map: letreiro(THREE, chave, texto, opc) });
  return placa(THREE, api, mat, x, y, z, w, h, dir);
}
