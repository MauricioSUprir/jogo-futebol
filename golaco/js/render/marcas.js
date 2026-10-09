// Marcas no gramado: ponto de queda da bola alta (lançamento, cruzamento, enfiada pelo alto).
// Anel verde pulsando em m.voo.alvo enquanto a bola está no ar (m.voo.alto); some quando a bola
// chega (voo encerrado, tick de chegada passado ou bola no chão perto do alvo). Dois anéis
// (um fixo e um que abre e apaga) + ponto no meio, num grupo só — 3 draw calls quando visível.
import * as THREE from 'three';

// chute pelo alto (cavadinha) não ganha marca: o alvo é o gol, não um ponto de recepção
const SEM_MARCA = new Set(['chute', 'colocado', 'cavadinha']);

export function criarMarcas(cena) {
  const verde = 0x19e07a;
  const comum = { transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 };
  const matFixo = new THREE.MeshBasicMaterial({ color: verde, opacity: 0.9, ...comum });
  const matOnda = new THREE.MeshBasicMaterial({ color: 0xb9ffd9, opacity: 0.6, ...comum });
  const matPonto = new THREE.MeshBasicMaterial({ color: verde, opacity: 0.75, ...comum });
  const fixo = new THREE.Mesh(new THREE.RingGeometry(0.8, 0.96, 56), matFixo);
  const onda = new THREE.Mesh(new THREE.RingGeometry(1.08, 1.18, 56), matOnda);
  const ponto = new THREE.Mesh(new THREE.CircleGeometry(0.17, 20), matPonto);
  const grupo = new THREE.Group();
  for (const m of [fixo, onda, ponto]) { m.rotation.x = -Math.PI / 2; m.renderOrder = 4; grupo.add(m); }
  grupo.visible = false;
  grupo.name = 'queda-da-bola';
  cena.add(grupo);
  let vis = 0;          // 0–1 (aparece e some suave)
  let ultimo = null;    // último alvo mostrado (some no mesmo lugar)

  return {
    grupo,
    /**
     * mundo: estado da simulação (lê m.voo, m.tick, m.bola). bola: posição DESENHADA (interpolada).
     * t: tempo em s (pulso); dt: s do quadro.
     */
    atualizar(mundo, bola, t, dt) {
      const v = mundo?.voo;
      let ativo = !!(v && v.alto && !SEM_MARCA.has(v.tipo) && v.alvo && Number.isFinite(v.alvo.x) && Number.isFinite(v.alvo.z));
      if (ativo && v.tickChegada != null && mundo.tick > v.tickChegada + 6) ativo = false;
      if (ativo && bola && bola.y < 0.3 && Math.hypot(bola.x - v.alvo.x, bola.z - v.alvo.z) < 1.2) ativo = false;
      if (ativo) ultimo = { x: v.alvo.x, z: v.alvo.z };
      vis = Math.max(0, Math.min(1, vis + (ativo ? dt / 0.12 : -dt / 0.2)));
      grupo.visible = vis > 0.001 && !!ultimo;
      if (!grupo.visible) return;
      grupo.position.set(ultimo.x, 0.022, ultimo.z);
      // pulso: o anel fixo respira; a onda abre de 0,7 a 1,5 e apaga (1 por 0,8 s)
      const f = (t / 0.8) % 1;
      const s = 0.95 + 0.06 * Math.sin(t * Math.PI * 2 / 0.8);
      fixo.scale.set(s, s, 1);
      const so = 0.7 + f * 0.8;
      onda.scale.set(so, so, 1);
      matOnda.opacity = 0.6 * (1 - f) * vis;
      matFixo.opacity = 0.9 * vis;
      matPonto.opacity = 0.75 * vis;
    },
  };
}
