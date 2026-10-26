// O DESENHO dos objetos da rua (objetos.js): hidrante, lixeira, caixa de jornal do Picture News, carrinho de
// cachorro-quente com guarda-sol, os pombos (corpo e as duas asas batendo) e as gotas do jato d'água. Um InstancedMesh por
// peça (cor por vértice), preenchido a cada quadro com o que está perto do herói. THREE vem por parâmetro (sem DOM).
import { CALCADA } from './cidade.js';
import { OBJ, pomboNoAr } from './objetos.js';

function pintar(THREE, g, cor) {
  g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv');
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set(cor, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
}
function juntar(THREE, gs) {
  let n = 0; for (const g of gs) n += g.attributes.position.count;
  const r = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'color']) { const a = new Float32Array(n * 3); let o = 0; for (const g of gs) { a.set(g.attributes[k].array, o); o += g.attributes[k].array.length; } r.setAttribute(k, new THREE.BufferAttribute(a, 3)); }
  for (const g of gs) g.dispose(); r.computeBoundingSphere(); return r;
}
const cil = (THREE, r0, r1, h, y, cor, seg = 12, x = 0, z = 0) => pintar(THREE, new THREE.CylinderGeometry(r0, r1, h, seg).translate(x, y, z), cor);
const cx = (THREE, w, h, d, x, y, z, cor) => pintar(THREE, new THREE.BoxGeometry(w, h, d).translate(x, y, z), cor);

// as peças (frente em +z, no chão em y = 0)
function hidrante(THREE) {
  const V = [0.72, 0.08, 0.06], E = [0.5, 0.05, 0.04], P = [0.75, 0.72, 0.62];
  const bocal = new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8); bocal.rotateZ(Math.PI / 2); bocal.translate(0, 0.42, 0);
  const frente = new THREE.CylinderGeometry(0.08, 0.08, 0.12, 8); frente.rotateX(Math.PI / 2); frente.translate(0, 0.38, 0.17);
  return juntar(THREE, [cil(THREE, 0.2, 0.22, 0.08, 0.04, E), cil(THREE, 0.14, 0.15, 0.62, 0.35, V), cil(THREE, 0.17, 0.17, 0.06, 0.66, E),
    pintar(THREE, new THREE.SphereGeometry(0.14, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.68, 0), V), cil(THREE, 0.03, 0.05, 0.08, 0.84, P, 6),
    pintar(THREE, bocal, E), pintar(THREE, frente, P)]);
}
function lixeira(THREE) {
  const C = [0.16, 0.3, 0.2], E = [0.1, 0.18, 0.12], T = [0.3, 0.32, 0.34];
  return juntar(THREE, [cil(THREE, 0.3, 0.26, 0.9, 0.45, C, 14), cil(THREE, 0.31, 0.31, 0.06, 0.2, E, 14), cil(THREE, 0.31, 0.31, 0.06, 0.7, E, 14),
    pintar(THREE, new THREE.SphereGeometry(0.31, 14, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.4, 1).translate(0, 0.9, 0), T), cx(THREE, 0.2, 0.08, 0.06, 0, 0.95, 0.27, [0.05, 0.05, 0.05])]);
}
function jornal(THREE) {
  const A = [0.1, 0.25, 0.6], E = [0.07, 0.16, 0.4], V = [0.75, 0.82, 0.86], J = [0.92, 0.9, 0.84];
  return juntar(THREE, [cx(THREE, 0.5, 0.55, 0.45, 0, 0.62, 0, A), cx(THREE, 0.06, 0.34, 0.06, -0.18, 0.17, 0, E), cx(THREE, 0.06, 0.34, 0.06, 0.18, 0.17, 0, E),
    cx(THREE, 0.38, 0.28, 0.02, 0, 0.66, 0.23, V), cx(THREE, 0.3, 0.2, 0.02, 0, 0.64, 0.24, J), cx(THREE, 0.52, 0.08, 0.47, 0, 0.93, 0, E), cx(THREE, 0.4, 0.06, 0.03, 0, 0.84, 0.24, [0.95, 0.85, 0.2])]);
}
function lanche(THREE) {
  const M = [0.72, 0.74, 0.76], V = [0.75, 0.1, 0.08], A = [0.95, 0.78, 0.15], P = [0.12, 0.12, 0.13];
  const roda = new THREE.CylinderGeometry(0.25, 0.25, 0.08, 12); roda.rotateX(Math.PI / 2);
  const guarda = new THREE.ConeGeometry(1.25, 0.45, 8, 1, true); guarda.translate(0, 2.35, 0);
  const g2 = guarda.clone(); g2.rotateY(Math.PI / 8);
  return juntar(THREE, [cx(THREE, 1.5, 0.75, 0.75, 0, 0.75, 0, M), cx(THREE, 1.52, 0.08, 0.77, 0, 1.15, 0, P), cx(THREE, 1.4, 0.2, 0.02, 0, 0.75, 0.39, V),
    pintar(THREE, roda.clone().translate(-0.45, 0.25, 0.4), P), pintar(THREE, roda.clone().translate(0.45, 0.25, 0.4), P), pintar(THREE, roda.clone().translate(-0.45, 0.25, -0.4), P), pintar(THREE, roda.translate(0.45, 0.25, -0.4), P),
    cil(THREE, 0.03, 0.03, 1.3, 1.75, M, 6), pintar(THREE, guarda, V), pintar(THREE, g2.scale(0.995, 1.01, 0.995), A), cx(THREE, 0.5, 0.25, 0.3, -0.4, 1.3, 0, [0.85, 0.6, 0.3])]);
}
function pombo(THREE) {
  const C = [0.42, 0.44, 0.48], E = [0.28, 0.3, 0.34];
  return juntar(THREE, [pintar(THREE, new THREE.SphereGeometry(0.11, 8, 6).scale(1, 0.8, 1.5), C), pintar(THREE, new THREE.SphereGeometry(0.06, 8, 6).translate(0, 0.08, 0.14), E), pintar(THREE, new THREE.ConeGeometry(0.015, 0.05, 4).rotateX(Math.PI / 2).translate(0, 0.07, 0.21), [0.8, 0.6, 0.3]), cx(THREE, 0.08, 0.02, 0.12, 0, 0.0, -0.2, E)]);
}
function asa(THREE, lado) {                         // uma asa (o eixo de bater fica no corpo, em x = 0)
  const g = new THREE.BufferGeometry(), s = lado;
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0.02, 0.08, s * 0.32, 0.02, 0.0, 0, 0.02, -0.1, 0, 0.02, 0.08, 0, 0.02, -0.1, s * 0.32, 0.02, 0.0]), 3));
  g.computeVertexNormals(); return pintar(THREE, g, [0.36, 0.38, 0.42]);
}

export function criarObjetos3d(THREE, cena, { mobile = false } = {}) {
  const mat = mobile ? new THREE.MeshLambertMaterial({ vertexColors: true }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15 });
  const matAsa = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const MAX = { hidrante: 40, lixeira: 70, jornal: 20, lanche: 8, pombo: 120 };
  const peca = (g, n, m = mat) => { const im = new THREE.InstancedMesh(g, m, n); im.count = 0; im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); cena.add(im); return im; };
  const M = { hidrante: peca(hidrante(THREE), MAX.hidrante), lixeira: peca(lixeira(THREE), MAX.lixeira), jornal: peca(jornal(THREE), MAX.jornal), lanche: peca(lanche(THREE), MAX.lanche),
    pombo: peca(pombo(THREE), MAX.pombo), asaE: peca(asa(THREE, -1), MAX.pombo, matAsa), asaD: peca(asa(THREE, 1), MAX.pombo, matAsa) };
  if (!mobile) for (const k of ['hidrante', 'lixeira', 'jornal', 'lanche']) M[k].castShadow = true;
  // as gotas do jato d'água (até 4 hidrantes estourados de uma vez)
  const NG = mobile ? 160 : 320, gp = new Float32Array(NG * 3).fill(-999);
  const gGotas = new THREE.BufferGeometry(); gGotas.setAttribute('position', new THREE.BufferAttribute(gp, 3));
  const gotas = new THREE.Points(gGotas, new THREE.PointsMaterial({ color: 0xcfe8ff, size: mobile ? 0.16 : 0.12, transparent: true, opacity: 0.8, depthWrite: false }));
  gotas.frustumCulled = false; cena.add(gotas);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3(1, 1, 1);
  const por = (im, k, x, y, z, h, rx = 0, rz = 0) => { e3.set(rx, h, rz, 'YXZ'); q.setFromEuler(e3); im.setMatrixAt(k, m4.compose(p3.set(x, y, z), q, s3)); };

  /** desenha os objetos da lista (objetos.js perto) com o estado de cada um; `t` é o relógio dos objetos */
  function atualizar(lista, estado, t) {
    const n = { hidrante: 0, lixeira: 0, jornal: 0, lanche: 0, pombo: 0 };
    let ng = 0;
    for (const o of lista) {
      const e = estado(o);
      if (o.tipo === 'hidrante' && n.hidrante < MAX.hidrante) {
        por(M.hidrante, n.hidrante++, o.x, CALCADA, o.z, o.h);
        if (e?.jato) {                                         // o jato sobe uns 5 m e as gotas caem em volta (parábolas)
          const forca = Math.min(1, (e.fim - t) / 2);
          for (let k = 0; k < 80 && ng < NG; k++, ng++) {
            const f = ((t * 1.7 + k / 80) % 1), a = k * 2.39996, r = (0.25 + (k % 7) * 0.12) * f * 2.2;
            gp[ng * 3] = o.x + Math.cos(a) * r; gp[ng * 3 + 1] = CALCADA + 0.85 + (11 * f - 12 * f * f) * 2.0 * forca; gp[ng * 3 + 2] = o.z + Math.sin(a) * r;
          }
        }
      } else if ((o.tipo === 'lixeira' || o.tipo === 'jornal') && n[o.tipo] < MAX[o.tipo]) {
        if (e) por(M[o.tipo], n[o.tipo]++, e.x, e.y + (e.caido ? (o.tipo === 'lixeira' ? 0.3 : 0.25) : 0), e.z, o.h, e.rx, e.rz);   // (deitado, apoiado no lado)
        else por(M[o.tipo], n[o.tipo]++, o.x, CALCADA, o.z, o.h);
      } else if (o.tipo === 'lanche' && n.lanche < MAX.lanche) por(M.lanche, n.lanche++, o.x, CALCADA, o.z, o.h);
      else if (o.tipo === 'pombos') {
        const nb = 7;
        for (let k = 0; k < nb && n.pombo < MAX.pombo; k++) {
          const i = n.pombo++;
          if (e?.voando) {
            const tt = t - e.t0; if (tt > OBJ.pombos.voo) { n.pombo--; continue; }
            const p = pomboNoAr(o, e, k, nb, tt), bate = Math.sin(t * 30 + k) * 0.9;
            por(M.pombo, i, p.x, p.y, p.z, Math.PI / 2 - p.h, -0.3); por(M.asaE, i, p.x, p.y, p.z, Math.PI / 2 - p.h, -0.3, bate); por(M.asaD, i, p.x, p.y, p.z, Math.PI / 2 - p.h, -0.3, -bate);
          } else {                                              // no chão, ciscando (a cabeça sobe e desce)
            const a = o.h + k * 0.9, r = 0.35 + (k % 3) * 0.35, x = o.x + Math.cos(a) * r, z = o.z + Math.sin(a) * r, cisca = Math.max(0, Math.sin(t * 3 + k * 1.7)) * 0.5;
            por(M.pombo, i, x, CALCADA + 0.09, z, a + k, cisca); por(M.asaE, i, x, CALCADA + 0.09, z, a + k, cisca); por(M.asaD, i, x, CALCADA + 0.09, z, a + k, cisca);
          }
        }
      }
    }
    for (const k of ['hidrante', 'lixeira', 'jornal', 'lanche']) { M[k].count = n[k]; M[k].instanceMatrix.needsUpdate = true; }
    for (const k of ['pombo', 'asaE', 'asaD']) { M[k].count = n.pombo; M[k].instanceMatrix.needsUpdate = true; }
    for (let k = ng; k < NG; k++) gp[k * 3 + 1] = -999;
    gGotas.attributes.position.needsUpdate = true; gotas.visible = ng > 0;
  }
  return { atualizar, malhas: [...Object.values(M), gotas] };
}
