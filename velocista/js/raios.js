// Rastro de raios do velocista: faíscas elétricas finas e tortas que saem do corpo e ficam para trás no caminho
// (como relâmpagos em miniatura), mais um brilho em volta do corpo. Tudo em linhas com cor acima de 1 (o bloom acende).
import * as THREE from 'three';

const NB = 48;                 // raios vivos no máximo
const SEG = 9;                 // segmentos por raio
const rnd = (a, b) => a + Math.random() * (b - a);

export function criarRaios(cena, { mobile = false } = {}) {
  const maxRaios = mobile ? 26 : NB;
  const pos = new Float32Array(maxRaios * SEG * 2 * 3), cor = new Float32Array(maxRaios * SEG * 2 * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(cor, 3));
  const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const linhas = new THREE.LineSegments(geo, mat); linhas.frustumCulled = false; cena.add(linhas);

  // brilho do corpo (sprite) — cresce com a velocidade
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,240,190,0.9)'); gr.addColorStop(0.3, 'rgba(255,170,40,0.45)'); gr.addColorStop(1, 'rgba(255,120,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const brilho = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  brilho.scale.setScalar(2.4); cena.add(brilho);

  const raios = Array.from({ length: maxRaios }, () => ({ vida: 0, total: 1, pts: new Float32Array((SEG + 1) * 3), forca: 1 }));
  let prox = 0, acum = 0;

  // um raio torto: do ponto do corpo até um ponto atrás, com deslocamento no meio (ponto médio recursivo simplificado)
  function disparar(ox, oy, oz, dx, dy, dz, comp, forca) {
    const r = raios[prox]; prox = (prox + 1) % maxRaios;
    r.vida = r.total = rnd(0.09, 0.22) * (0.7 + forca * 0.6); r.forca = forca;
    const ex = ox + dx * comp + rnd(-0.6, 0.6), ey = Math.max(0.05, oy + dy * comp + rnd(-0.7, 0.4)), ez = oz + dz * comp + rnd(-0.6, 0.6);
    for (let k = 0; k <= SEG; k++) {
      const t = k / SEG, amp = Math.sin(t * Math.PI) * 0.45 * (0.5 + forca);
      r.pts[k * 3] = ox + (ex - ox) * t + (k && k < SEG ? rnd(-amp, amp) : 0);
      r.pts[k * 3 + 1] = oy + (ey - oy) * t + (k && k < SEG ? rnd(-amp, amp) * 0.8 : 0);
      r.pts[k * 3 + 2] = oz + (ez - oz) * t + (k && k < SEG ? rnd(-amp, amp) : 0);
    }
  }

  /** P: o herói {x,y,z,vx,vz,h}; v: velocidade; vibrando: raios em volta do corpo. */
  function atualizar(dt, P, v, { vibrando = false, parede = null } = {}) {
    const forca = Math.min(1, Math.max(0, (v - 12) / 40));
    const taxa = vibrando ? 70 : forca > 0 ? 18 + forca * (mobile ? 50 : 110) : 0;
    acum += taxa * dt;
    const hx = Math.sin(P.h), hz = Math.cos(P.h);
    while (acum >= 1) {
      acum -= 1;
      // ponto de saída: tronco, braços ou pernas
      const alt = rnd(0.25, 1.65), lado = rnd(-0.35, 0.35);
      let ox = P.x - hz * lado, oy = P.y + alt, oz = P.z + hx * lado;
      let dx = -hx, dy = rnd(-0.15, 0.25), dz = -hz;
      if (parede) { ox = P.x; oy = P.y; oz = P.z; dx = parede.nx * 0.3; dy = -1; dz = parede.nz * 0.3; }
      if (vibrando) { const a = Math.random() * 6.28; dx = Math.cos(a); dz = Math.sin(a); dy = rnd(-0.5, 0.5); }
      disparar(ox, oy, oz, dx, dy, dz, vibrando ? rnd(0.4, 1.1) : rnd(1.2, 2.2 + forca * 5.5), vibrando ? 0.6 : forca);
    }
    // escreve as linhas
    let n = 0;
    for (const r of raios) {
      if (r.vida <= 0) continue;
      r.vida -= dt;
      const f = Math.max(0, r.vida / r.total), cr = 1.8 * f * (0.6 + r.forca), cg = 1.15 * f * (0.5 + r.forca * 0.6), cb = 0.35 * f;
      for (let k = 0; k < SEG; k++) {
        const i = n * 6;
        pos[i] = r.pts[k * 3]; pos[i + 1] = r.pts[k * 3 + 1]; pos[i + 2] = r.pts[k * 3 + 2];
        pos[i + 3] = r.pts[k * 3 + 3]; pos[i + 4] = r.pts[k * 3 + 4]; pos[i + 5] = r.pts[k * 3 + 5];
        cor[i] = cor[i + 3] = cr; cor[i + 1] = cor[i + 4] = cg; cor[i + 2] = cor[i + 5] = cb;
        n++;
      }
    }
    geo.setDrawRange(0, n * 2);
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    brilho.visible = forca > 0.05 || vibrando;
    brilho.position.set(P.x - hx * 0.3, P.y + 1.05, P.z - hz * 0.3);
    const pulso = 0.85 + Math.random() * 0.3;
    brilho.material.opacity = Math.min(0.9, (vibrando ? 0.7 : forca * 0.75)) * pulso;
    brilho.scale.setScalar((1.6 + forca * 1.6) * pulso);
  }
  return { atualizar, dispose() { cena.remove(linhas, brilho); geo.dispose(); mat.dispose(); } };
}
