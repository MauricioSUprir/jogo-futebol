// Rastro de raios do velocista (dono, 26/10: "nos raios quando ele corre, tem que ser mais realista"): relâmpagos de
// verdade em volta do corpo e no caminho atrás dele — cada um é uma linha quebrada por deslocamento do ponto médio
// (fractal, como os raios de tempestade), com GALHOS que saem dele, desenhada como fita virada para a câmera (com
// espessura, não a linha de 1 pixel do WebGL): um núcleo branco quente fino por dentro e o brilho colorido largo por
// fora, os dois somando luz (o bloom acende). Eles tremem (o zigue-zague muda a cada poucos centésimos), piscam e somem
// em ~0,1–0,25 s; uns nascem num membro e correm pelo corpo, outros ficam para trás no caminho. Mais o brilho do corpo.
import * as THREE from 'three';

const rnd = (a, b) => a + Math.random() * (b - a);
const MAXP = 17;                 // pontos de um raio (16 segmentos) — os galhos usam até 9

// cores: dourado (herói), azul (Zoom), vermelho (Flash Reverso); [r, g, b] do brilho e o degradê do halo do corpo
export const CORES_RAIO = {
  ouro: { raio: [1.25, 0.66, 0.12], brilho: ['255,240,190', '255,170,40', '255,120,0'] },
  azul: { raio: [0.25, 0.62, 1.7], brilho: ['200,230,255', '60,140,255', '20,60,255'] },
  vermelho: { raio: [1.7, 0.12, 0.07], brilho: ['255,200,190', '255,50,30', '200,0,0'] },
  branco: { raio: [1.45, 1.5, 1.7], brilho: ['255,255,255', '190,198,215', '90,96,112'] },        // o Corredor Negro: um raio pálido, sem cor
  prata: { raio: [1.7, 1.6, 1.2], brilho: ['255,252,235', '235,215,160', '170,140,70'] },         // o Godspeed: prata com reflexo de ouro
};
let cameraRaios = null;
/** a câmera para virar as fitas dos raios para ela (o jogo chama uma vez) */
export function definirCameraRaios(c) { cameraRaios = c; }

// um raio quebrado: o caminho de a até b com deslocamento do ponto médio, recursivo (a cada nível, metade da amplitude)
function quebrar(saida, n, ax, ay, az, bx, by, bz, amp) {
  saida[0] = ax; saida[1] = ay; saida[2] = az; saida[(n - 1) * 3] = bx; saida[(n - 1) * 3 + 1] = by; saida[(n - 1) * 3 + 2] = bz;
  const passo = (i0, i1, a) => {
    if (i1 - i0 < 2) return;
    const m = (i0 + i1) >> 1;
    for (let c = 0; c < 3; c++) saida[m * 3 + c] = (saida[i0 * 3 + c] + saida[i1 * 3 + c]) / 2 + rnd(-a, a) * (c === 1 ? 0.75 : 1);
    passo(i0, m, a * 0.55); passo(m, i1, a * 0.55);
  };
  passo(0, n - 1, amp);
}

export function criarRaios(cena, { mobile = false, cor: corNome = 'ouro' } = {}) {
  const C = CORES_RAIO[corNome] || CORES_RAIO.ouro;
  const MAX = mobile ? 22 : 40;
  // cada raio: o tronco (16 segmentos) e até 2 galhos (8 cada) = 32 segmentos; cada segmento = 2 fitas (brilho e núcleo) de 2 triângulos
  const SEGS = MAX * 32 * 2, pos = new Float32Array(SEGS * 6 * 3), uv = new Float32Array(SEGS * 6 * 2), cor = new Float32Array(SEGS * 6 * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setAttribute('color', new THREE.BufferAttribute(cor, 3));
  // o perfil da fita: forte no meio e sumindo nas bordas (o halo do raio)
  const tc = document.createElement('canvas'); tc.width = 64; tc.height = 4;
  const tg = tc.getContext('2d'), grad = tg.createLinearGradient(0, 0, 64, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)'); grad.addColorStop(0.35, 'rgba(255,255,255,0.35)'); grad.addColorStop(0.5, 'rgba(255,255,255,1)'); grad.addColorStop(0.65, 'rgba(255,255,255,0.35)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  tg.fillStyle = grad; tg.fillRect(0, 0, 64, 4);
  const mapa = new THREE.CanvasTexture(tc);
  const mat = new THREE.MeshBasicMaterial({ map: mapa, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const fitas = new THREE.Mesh(geo, mat); fitas.frustumCulled = false; cena.add(fitas);

  // brilho do corpo (sprite) — cresce com a velocidade
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${C.brilho[0]},0.9)`); gr.addColorStop(0.3, `rgba(${C.brilho[1]},0.45)`); gr.addColorStop(1, `rgba(${C.brilho[2]},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const brilho = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  brilho.scale.setScalar(2.4); cena.add(brilho);

  const raios = Array.from({ length: MAX }, () => ({ vida: 0, total: 1, forca: 1, a: [0, 0, 0], b: [0, 0, 0], amp: 0.3, larg: 0.05, treme: 0, pts: new Float32Array(MAXP * 3), galhos: [{ n: 0, pts: new Float32Array(9 * 3), de: 0 }, { n: 0, pts: new Float32Array(9 * 3), de: 0 }] }));
  let prox = 0, acum = 0;

  function refazer(r) {                                         // novo zigue-zague (o raio "treme") e galhos novos
    quebrar(r.pts, MAXP, r.a[0], r.a[1], r.a[2], r.b[0], r.b[1], r.b[2], r.amp);
    for (const gal of r.galhos) {
      if (Math.random() < 0.55 * r.forca + 0.15) {
        gal.de = 4 + Math.floor(Math.random() * 9); gal.n = 9;
        const ox = r.pts[gal.de * 3], oy = r.pts[gal.de * 3 + 1], oz = r.pts[gal.de * 3 + 2], L = Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1], r.b[2] - r.a[2]) * rnd(0.25, 0.5);
        const dx = (r.b[0] - r.a[0]) / (L * 3 || 1) + rnd(-0.8, 0.8), dy = rnd(-0.7, 0.5), dz = (r.b[2] - r.a[2]) / (L * 3 || 1) + rnd(-0.8, 0.8), dn = Math.hypot(dx, dy, dz) || 1;
        quebrar(gal.pts, 9, ox, oy, oz, ox + (dx / dn) * L, Math.max(0.03, oy + (dy / dn) * L), oz + (dz / dn) * L, r.amp * 0.5);
      } else gal.n = 0;
    }
  }
  function disparar(ax, ay, az, bx, by, bz, forca, larg) {
    const r = raios[prox]; prox = (prox + 1) % MAX;
    r.vida = r.total = rnd(0.08, 0.2) * (0.75 + forca * 0.5); r.forca = forca; r.larg = larg;
    r.a[0] = ax; r.a[1] = ay; r.a[2] = az; r.b[0] = bx; r.b[1] = Math.max(0.03, by); r.b[2] = bz;
    r.amp = Math.hypot(bx - ax, by - ay, bz - az) * rnd(0.12, 0.2); r.treme = 0;
    refazer(r);
  }

  const vc = new THREE.Vector3();
  let n = 0;
  // uma fita de p0 a p1 virada para a câmera, com a largura e a cor dadas (uv.x atravessa a fita, para o perfil)
  function fita(x0, y0, z0, x1, y1, z1, w, cr, cg, cb) {
    if (n >= SEGS) return;
    let sx = x1 - x0, sy = y1 - y0, sz = z1 - z0;
    let vx = (x0 + x1) / 2 - vc.x, vy = (y0 + y1) / 2 - vc.y, vz = (z0 + z1) / 2 - vc.z;
    let px = sy * vz - sz * vy, py = sz * vx - sx * vz, pz = sx * vy - sy * vx;            // perpendicular ao segmento e à visão
    const pl = Math.hypot(px, py, pz) || 1; px = (px / pl) * w; py = (py / pl) * w; pz = (pz / pl) * w;
    const i = n * 18, j = n * 12;
    const V = [x0 - px, y0 - py, z0 - pz, x0 + px, y0 + py, z0 + pz, x1 + px, y1 + py, z1 + pz, x0 - px, y0 - py, z0 - pz, x1 + px, y1 + py, z1 + pz, x1 - px, y1 - py, z1 - pz];
    pos.set(V, i);
    uv.set([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], j);
    for (let k = 0; k < 6; k++) { cor[i + k * 3] = cr; cor[i + k * 3 + 1] = cg; cor[i + k * 3 + 2] = cb; }
    n++;
  }
  function desenharCaminho(p, np, w, brilhoK, forca) {
    const [cr, cg, cb] = C.raio;
    for (let k = 0; k < np - 1; k++) {
      const a = k * 3, b = a + 3, afina = 1 - (k / (np - 1)) * 0.6;          // a ponta vai afinando
      fita(p[a], p[a + 1], p[a + 2], p[b], p[b + 1], p[b + 2], w * 2.6 * afina, cr * brilhoK * 0.38, cg * brilhoK * 0.38, cb * brilhoK * 0.38);     // halo colorido
      fita(p[a], p[a + 1], p[a + 2], p[b], p[b + 1], p[b + 2], w * 0.7 * afina, (0.6 + cr * 0.3) * brilhoK, (0.6 + cg * 0.3) * brilhoK, (0.55 + cb * 0.3) * brilhoK);   // núcleo quase branco
    }
  }

  /** P: o herói {x,y,z,vx,vz,h}; v: velocidade; vibrando: raios em volta do corpo; parede: escalando. */
  function atualizar(dt, P, v, { vibrando = false, parede = null } = {}) {
    const forca = Math.min(1, Math.max(0, (v - 12) / 40));
    const taxa = vibrando ? 45 : forca > 0 ? 12 + forca * (mobile ? 26 : 50) : 0;
    acum += taxa * dt;
    const hx = Math.sin(P.h), hz = Math.cos(P.h);
    while (acum >= 1) {
      acum -= 1;
      const tipo = Math.random();
      if (vibrando) {                                         // vibrando: arcos curtos colados no corpo, para todo lado
        const a = rnd(0, 6.28), y = P.y + rnd(0.2, 1.7), r0 = 0.25, r1 = rnd(0.5, 1.0);
        disparar(P.x + Math.cos(a) * r0, y, P.z + Math.sin(a) * r0, P.x + Math.cos(a + rnd(-1, 1)) * r1, y + rnd(-0.6, 0.6), P.z + Math.sin(a + rnd(-1, 1)) * r1, 0.6, 0.03);
      } else if (parede) {                                    // escalando: escorrem pela parede para baixo
        disparar(P.x, P.y + rnd(0.3, 1.5), P.z, P.x + parede.nx * 0.2 + rnd(-0.5, 0.5), P.y - rnd(1, 2.5), P.z + parede.nz * 0.2 + rnd(-0.5, 0.5), forca, 0.035);
      } else if (tipo < 0.4) {                                // no corpo: de um membro a outro, por fora do corpo (arco)
        const lado = Math.random() < 0.5 ? -1 : 1, y0 = P.y + rnd(1.0, 1.6), y1 = P.y + rnd(0.1, 0.8);
        disparar(P.x - hz * lado * 0.3, y0, P.z + hx * lado * 0.3, P.x - hx * rnd(0.2, 0.9) - hz * lado * rnd(0.3, 0.6), y1, P.z - hz * rnd(0.2, 0.9) + hx * lado * rnd(0.3, 0.6), forca, 0.03);
      } else {                                                // para trás, no caminho: longos, perto do chão e das pernas
        const lado = rnd(-0.35, 0.35), alt = rnd(0.15, 1.5), comp = rnd(1.5, 2.6 + forca * 6);
        disparar(P.x - hz * lado, P.y + alt, P.z + hx * lado, P.x - hx * comp + rnd(-0.7, 0.7), P.y + alt * rnd(0.2, 0.9), P.z - hz * comp + rnd(-0.7, 0.7), forca, 0.04 + forca * 0.02);
      }
    }
    // desenha (a câmera do jogo, ou a de cima por padrão)
    if (cameraRaios) vc.copy(cameraRaios.position); else vc.set(P.x, P.y + 50, P.z);
    n = 0;
    for (const r of raios) {
      if (r.vida <= 0) continue;
      r.vida -= dt; r.treme -= dt;
      if (r.treme <= 0) { r.treme = rnd(0.03, 0.06); refazer(r); }       // treme: outro zigue-zague a cada 3–6 centésimos
      const f = Math.max(0, r.vida / r.total), pisca = Math.random() < 0.15 ? 0.35 : 1, k = Math.min(1.8, (0.55 + r.forca * 0.9) * (0.35 + f * 0.65) * pisca);
      desenharCaminho(r.pts, MAXP, r.larg, k, r.forca);
      for (const gal of r.galhos) if (gal.n) desenharCaminho(gal.pts, gal.n, r.larg * 0.6, k * 0.7, r.forca);
    }
    geo.setDrawRange(0, n * 6);
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; geo.attributes.uv.needsUpdate = true;
    brilho.visible = forca > 0.05 || vibrando;
    brilho.position.set(P.x - hx * 0.3, P.y + 1.05, P.z - hz * 0.3);
    const pulso = 0.85 + Math.random() * 0.3;
    brilho.material.opacity = Math.min(0.85, (vibrando ? 0.6 : forca * 0.6)) * pulso;
    brilho.scale.setScalar((1.5 + forca * 1.4) * pulso);
  }
  return { atualizar, dispose() { cena.remove(fitas, brilho); geo.dispose(); mat.dispose(); mapa.dispose(); } };
}
