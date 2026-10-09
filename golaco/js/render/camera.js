// Câmera de TV: na lateral do lado de cá (z positivo), olhando para z negativo (yaw = −π/2 no
// chão — o mesmo que controle.js/paraMundo usa para converter o analógico). Segue um ALVO
// (jogador + bola, com antecipação pela velocidade) por uma mola crítica exata (não treme e não
// acompanha cada passada: o alvo usa o centro do corpo e a bola interpolados, nunca a pélvis
// que sobe e desce), limitada ao campo. Modo "aproximada" (CAMERA.aproximada) com transição.
import * as THREE from 'three';
import { CAMERA, CAMPO } from '../config.js';
import { molaCritica } from './util.js';

export const MODOS_CAMERA = ['tv', 'aproximada'];

const PERFIS = {
  tv: {
    fov: CAMERA.fov, distancia: CAMERA.distancia, altura: CAMERA.altura,
    pesoBola: 0.45, antecipa: 0.55, limX: CAMPO.meioX - 14, limZ0: -CAMPO.meioZ + 12, limZ1: CAMPO.meioZ - 16, olharY: 0,
  },
  aproximada: {
    fov: CAMERA.aproximada.fov, distancia: CAMERA.aproximada.distancia, altura: CAMERA.aproximada.altura,
    pesoBola: 0.3, antecipa: 0.35, limX: CAMPO.meioX - 3, limZ0: -CAMPO.meioZ + 3, limZ1: CAMPO.meioZ - 2, olharY: 0.6,
  },
};

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

export function criarCamera(aspecto) {
  const camera = new THREE.PerspectiveCamera(CAMERA.fov, aspecto, 0.5, 900);
  const est = {
    modo: 'tv',
    mistura: 0,               // 0 = TV, 1 = aproximada (transição suave)
    x: 0, z: 0, vx: 0, vz: 0, // foco seguido pela mola
    iniciado: false,
    aspecto,
  };
  const yaw = -Math.PI / 2;
  function perfil() {
    const a = PERFIS.tv, b = PERFIS.aproximada, t = est.mistura;
    const s = t * t * (3 - 2 * t);
    const o = {};
    for (const k of Object.keys(a)) o[k] = lerp(a[k], b[k], s);
    return o;
  }
  function posicionar(p) {
    // fov vertical; em tela estreita (retrato) abre para manter a largura vista
    let fov = p.fov;
    if (est.aspecto < 1.5) {
      const t = Math.tan((fov * Math.PI) / 360) * (1.5 / est.aspecto);
      fov = (Math.atan(t) * 360) / Math.PI;
    }
    if (Math.abs(camera.fov - fov) > 1e-4 || camera.aspect !== est.aspecto) {
      camera.fov = fov;
      camera.aspect = est.aspecto;
      camera.updateProjectionMatrix();
    }
    camera.position.set(est.x, p.altura, est.z + p.distancia);
    camera.lookAt(est.x, p.olharY, est.z);
  }
  return {
    camera,
    get yaw() { return yaw; },
    get modo() { return est.modo; },
    definirModo(m) { if (PERFIS[m]) est.modo = m; },
    alternarModo() { est.modo = est.modo === 'tv' ? 'aproximada' : 'tv'; return est.modo; },
    redimensionar(a) { est.aspecto = a; },
    /**
     * dt do quadro (s). alvo = {jx, jz, jvx, jvz, bx, bz} (posições INTERPOLADAS).
     * corte = true reposiciona sem mola (recomeço).
     */
    atualizar(dt, alvo, corte = false) {
      const metaMistura = est.modo === 'aproximada' ? 1 : 0;
      est.mistura += clamp(metaMistura - est.mistura, -dt / 0.6, dt / 0.6);
      const p = perfil();
      // foco: entre jogador e bola, bola longe pesa menos (passe da máquina chegando)
      const dbx = alvo.bx - alvo.jx, dbz = alvo.bz - alvo.jz;
      const db = Math.hypot(dbx, dbz);
      const w = p.pesoBola * (db > 12 ? 12 / db : 1);
      let fx = alvo.jx + dbx * w + alvo.jvx * p.antecipa;
      let fz = alvo.jz + dbz * w + alvo.jvz * p.antecipa;
      fx = clamp(fx, -p.limX, p.limX);
      fz = clamp(fz, p.limZ0, p.limZ1);
      if (!est.iniciado || corte) {
        est.x = fx; est.z = fz; est.vx = 0; est.vz = 0; est.iniciado = true;
      } else {
        const wr = CAMERA.rigidez;
        [est.x, est.vx] = molaCritica(est.x, est.vx, fx, wr, dt);
        [est.z, est.vz] = molaCritica(est.z, est.vz, fz, wr * 0.8, dt);
      }
      posicionar(p);
    },
    /** Foco atual da câmera (para a sombra acompanhar a jogada). */
    foco() { return { x: est.x, z: est.z }; },
  };
}
