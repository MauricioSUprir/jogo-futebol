// Corrida contra o relógio: 8 portais nos cruzamentos em volta do S.T.A.R. Labs; o relógio começa no 1º.
import * as THREE from 'three';
import { CELL, MEIO, LAB_CELULA } from './cidade.js';

const eixo = (k) => k * CELL - MEIO;
const [LI, LJ] = LAB_CELULA;
const ROTA = [[LI, LJ], [LI + 3, LJ], [LI + 3, LJ + 3], [LI + 6, LJ + 3], [LI + 6, LJ + 6], [LI + 3, LJ + 6], [LI, LJ + 6], [LI, LJ + 3]].map(([i, j]) => ({ x: eixo(i), z: eixo(j) }));
const TEMPO = 70;

export function criarPortais(cena) {
  const grupo = new THREE.Group(); grupo.visible = false; cena.add(grupo);
  const matA = new THREE.MeshBasicMaterial({ color: 0xffd23f }), matB = new THREE.MeshBasicMaterial({ color: 0x3fd0ff, transparent: true, opacity: 0.35 });
  const aneis = ROTA.map((p, k) => {
    const prox = ROTA[(k + 1) % ROTA.length], ant = ROTA[(k + ROTA.length - 1) % ROTA.length];
    const g = new THREE.Group(); g.position.set(p.x, 4.2, p.z);
    g.add(new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.28, 10, 40), matB));
    const dx = prox.x - ant.x, dz = prox.z - ant.z; g.rotation.y = Math.atan2(dx, dz);
    grupo.add(g); return g;
  });
  let indice = 0, restante = 0, ligado = false, correndo = false;
  function pintar() { aneis.forEach((a, k) => { a.children[0].material = k === indice ? matA : matB; a.visible = k >= indice; }); }
  return {
    ativar() { if (ligado) return; ligado = true; grupo.visible = true; indice = 0; correndo = false; restante = TEMPO; pintar(); },
    desativar() { ligado = false; grupo.visible = false; },
    get ligado() { return ligado; },
    alvo: () => (ligado ? ROTA[indice] : null),
    estado: () => ({ indice, total: ROTA.length, restante, correndo }),
    atualizar(dt, P) {
      if (!ligado) return null;
      aneis.forEach((a) => { a.children[0].rotation.z += dt * 0.8; });
      if (correndo) { restante -= dt; if (restante <= 0) { indice = 0; correndo = false; restante = TEMPO; pintar(); return { falhou: true }; } }
      const p = ROTA[indice];
      if (Math.hypot(P.x - p.x, P.z - p.z) < 5.5 && P.y < 9) {
        if (indice === 0) { correndo = true; restante = TEMPO; }
        indice++;
        if (indice >= ROTA.length) { this.desativar(); return { feito: true }; }
        pintar(); return { passou: indice };
      }
      return null;
    },
  };
}
