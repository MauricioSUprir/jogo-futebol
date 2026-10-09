// Câmera de TV: na lateral do lado de cá (z positivo), olhando para z negativo (yaw = −π/2 no
// chão — o mesmo que controle.js/paraMundo usa para converter o analógico). Segue um ALVO
// (jogador + bola, com antecipação pela velocidade) por uma mola crítica exata (não treme e não
// acompanha cada passada: o alvo usa o centro do corpo e a bola interpolados, nunca a pélvis
// que sobe e desce), limitada ao campo. Modo "aproximada" (CAMERA.aproximada) com transição.
//
// Enquadramento pela LARGURA vista no foco (como o diretor de TV fecha o plano), não pelo fov:
// tela mais larga que 16:9 (celular deitado) mantém a largura e fecha na altura — jogadores
// maiores sem perder o que se vê dos lados; tela mais estreita (4:3) perde só metade da
// largura; em pé (retrato) entra um perfil próprio, mais alto e inclinado, para o quadro não
// virar metade céu. Tela pequena (celular) fecha mais (CAMERA.telaPequena).
//
// Bola longe (lançamento, defesa): a bola manda — o foco nunca fica a mais de ~0,31 da largura
// vista do "ponto da bola", e a bola nunca sai do quadro. Com a bola no ar (m.voo), o ponto da
// bola antecipa a queda (vai parte do caminho até m.voo.alvo); a mola deixa tudo suave.
import * as THREE from 'three';
import { CAMERA, CAMPO } from '../config.js';
import { molaCritica } from './util.js';

export const MODOS_CAMERA = ['tv', 'aproximada'];

const PERFIS = {
  tv: {
    largura: CAMERA.largura, distancia: CAMERA.distancia, altura: CAMERA.altura,
    pesoBola: 0.45, antecipa: 0.55, anteVoo: 0.42, limX: CAMPO.meioX - 14, limZ0: -CAMPO.meioZ + 12, limZ1: CAMPO.meioZ - 11, olharY: 0,
  },
  aproximada: {
    largura: CAMERA.aproximada.largura, distancia: CAMERA.aproximada.distancia, altura: CAMERA.aproximada.altura,
    pesoBola: 0.3, antecipa: 0.35, anteVoo: 0.3, limX: CAMPO.meioX - 3, limZ0: -CAMPO.meioZ + 3, limZ1: CAMPO.meioZ - 2, olharY: 0.6,
  },
};
// celular em pé: mesmos pesos, câmera mais alta/inclinada e limites que deixam chegar às linhas
const RETRATO = {
  tv: { ...PERFIS.tv, ...CAMERA.retrato, limX: CAMPO.meioX - 8, limZ0: -CAMPO.meioZ + 6, limZ1: CAMPO.meioZ - 6 },
  aproximada: { ...PERFIS.aproximada, ...CAMERA.retratoAproximada },
};
const ASPECTO_TV = 16 / 9;

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function suave(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

export function criarCamera(aspecto) {
  const camera = new THREE.PerspectiveCamera(32, aspecto, 0.5, 900);
  const est = {
    modo: 'tv',
    mistura: 0,               // 0 = TV, 1 = aproximada (transição suave)
    x: 0, z: 0, vx: 0, vz: 0, // foco seguido pela mola
    iniciado: false,
    aspecto,
    pequena: false,           // tela de celular (menor lado < 520 px CSS)
  };
  const yaw = -Math.PI / 2;
  const _p = {};
  function perfil() {
    // TV ↔ aproximada pela transição; paisagem ↔ retrato pelo formato da tela (1,25 → 0,75)
    const s = suave(est.mistura);
    const r = suave((1.25 - est.aspecto) / 0.5);
    for (const k of Object.keys(PERFIS.tv)) {
      const pais = lerp(PERFIS.tv[k], PERFIS.aproximada[k], s);
      const ret = lerp(RETRATO.tv[k], RETRATO.aproximada[k], s);
      _p[k] = lerp(pais, ret, r);
    }
    _p.retrato = r;
    return _p;
  }
  /** fov vertical que mostra a largura do perfil no foco, para o formato desta tela. */
  function fovPara(p) {
    const a = est.aspecto;
    let larg = p.largura;
    // paisagem mais estreita que 16:9 (4:3) perde só metade da largura; o retrato já tem a sua
    if (a < ASPECTO_TV) larg *= lerp(Math.sqrt(Math.max(a, 1.25) / ASPECTO_TV), 1, p.retrato);
    if (est.pequena) larg *= CAMERA.telaPequena;
    const d = Math.hypot(p.distancia, p.altura - p.olharY);
    return (2 * Math.atan(larg / 2 / d / a) * 180) / Math.PI;
  }
  function posicionar(p) {
    const fov = fovPara(p);
    if (Math.abs(camera.fov - fov) > 1e-4 || camera.aspect !== est.aspecto) {
      camera.fov = fov;
      camera.aspect = est.aspecto;
      camera.updateProjectionMatrix();
    }
    if (est.livre) {
      // câmera livre (prints de conferência: close do manequim, gol, linhas)
      const l = est.livre;
      camera.position.set(l.de[0], l.de[1], l.de[2]);
      camera.lookAt(l.para[0], l.para[1], l.para[2]);
      if (l.fov && Math.abs(camera.fov - l.fov) > 1e-4) { camera.fov = l.fov; camera.updateProjectionMatrix(); }
      return;
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
    /** a = largura/altura da tela; pequena = celular (fecha mais o plano). */
    redimensionar(a, pequena = false) { est.aspecto = a; est.pequena = !!pequena; },
    /**
     * dt do quadro (s). alvo = {jx, jz, jvx, jvz, bx, bz, ax?, az?} (posições INTERPOLADAS;
     * ax/az = ponto de queda do passe/lançamento em andamento, se houver).
     * corte = true reposiciona sem mola (recomeço).
     */
    atualizar(dt, alvo, corte = false) {
      const metaMistura = est.modo === 'aproximada' ? 1 : 0;
      est.mistura += clamp(metaMistura - est.mistura, -dt / 0.6, dt / 0.6);
      const p = perfil();
      // ponto da bola: no ar, antecipa a queda (parte do caminho até o alvo)
      let px = alvo.bx, pz = alvo.bz;
      if (Number.isFinite(alvo.ax) && Number.isFinite(alvo.az)) {
        px += (alvo.ax - alvo.bx) * p.anteVoo;
        pz += (alvo.az - alvo.bz) * p.anteVoo;
      }
      // foco: entre jogador e bola. Perto, a bola pesa pesoBola; um pouco longe (passe da
      // máquina chegando) pesa menos; muito longe, a bola manda (o foco fica a ≤ R dela)
      const dbx = px - alvo.jx, dbz = pz - alvo.jz;
      const db = Math.hypot(dbx, dbz);
      const R = p.largura * 0.31;
      const w = db > 12 ? Math.max(p.pesoBola * 12 / db, 1 - R / db) : p.pesoBola;
      let fx = alvo.jx + dbx * w + alvo.jvx * p.antecipa;
      let fz = alvo.jz + dbz * w + alvo.jvz * p.antecipa;
      // a bola (de verdade) nunca sai do quadro: na profundidade se vê menos que na largura
      const mx = p.largura * 0.38, mz = p.largura * 0.24;
      fx = clamp(fx, alvo.bx - mx, alvo.bx + mx);
      fz = clamp(fz, alvo.bz - mz, alvo.bz + mz);
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
    /** Câmera livre para prints de conferência: {de:[x,y,z], para:[x,y,z], fov?} ou null. */
    definirLivre(l) { est.livre = l ? { de: [...l.de], para: [...l.para], fov: l.fov } : null; },
  };
}
