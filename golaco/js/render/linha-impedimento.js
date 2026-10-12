// Linha de impedimento desenhada no gramado (pedido do dono, seção 8: "impedimento com a linha desenhada").
//  - no apito do impedimento: a linha DO LANCE (a do instante do passe) fica parada, amarela e mais grossa, por
//    IMPEDIMENTO.linhaCongela s (a marcação, sem texto na tela; o replay mostra a mesma linha);
//  - a linha VIVA (com a bola rolando no campo de ataque de quem tem a bola: amarelo-clara, na linha de impedimento
//    DESTE time — impedimento.js linhaImpedimento) só com IMPEDIMENTO.linhaViva: DESLIGADA desde 11/10 (dono: "não
//    quero a linha de impedimento durante o jogo"); o código fica para o replay e para conferências.
// Uma malha (1 draw call quando visível). Só lê o mundo: não muda o hash.
import * as THREE from 'three';
import { CAMPO, IMPEDIMENTO, PASSO } from '../config.js';
import { linhaImpedimento } from '../impedimento.js';
import { jogadorPorId } from '../sim.js';

const VIVA = new THREE.Color(0xfff2a8), AMARELA = new THREE.Color(0xffd84a);
const OPACA_VIVA = 0.55, OPACA_LANCE = 0.95;

/** Time com a bola: o dono (pé ou mão), senão o do passe/chute no ar, senão null. */
function timeComBola(m) {
  const id = m.naMao ?? m.posse;
  if (id != null) { const j = jogadorPorId(m, id); return j ? j.time : null; }
  return m.voo ? m.voo.time ?? null : null;
}

export function criarLinhaImpedimento(cena) {
  const mat = new THREE.MeshBasicMaterial({
    color: VIVA, opacity: 0, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8,
  });
  const malha = new THREE.Mesh(new THREE.PlaneGeometry(0.16, CAMPO.largura), mat);
  malha.rotation.x = -Math.PI / 2;
  malha.renderOrder = 3;
  malha.visible = false;
  malha.name = 'linha-impedimento';
  cena.add(malha);
  const _l = { u: 0, x: 0, defensor: null };
  let vis = 0, x = 0, lance = false, timeLinha = null;

  return {
    malha,
    /** Estado da linha (testes): {visivel, x, lance (a do apito), opacidade}. */
    get estado() { return { visivel: malha.visible, x, lance, opacidade: mat.opacity }; },
    /** mundo: estado da simulação; dt: s do quadro. */
    atualizar(mundo, dt) {
      const p = mundo?.partida;
      let alvo = 0, xAlvo = x, ehLance = false, t = null;
      if (p) {
        const ui = p.ultimoImped;
        if (ui && mundo.tick >= ui.tick && (mundo.tick - ui.tick) * PASSO < IMPEDIMENTO.linhaCongela) {
          alvo = OPACA_LANCE; xAlvo = ui.linhaX; ehLance = true;
        } else if (IMPEDIMENTO.linhaViva && p.estado === 'jogo' && !(mundo.parada && !mundo.parada.rolou)) {
          t = timeComBola(mundo);
          if (t != null && mundo.bola.p.x * mundo.ataca[t] > 0) {
            linhaImpedimento(mundo, t, _l);
            if (_l.u > 0) { alvo = OPACA_VIVA; xAlvo = _l.x; }
          }
        }
      }
      // a linha do lance aparece na hora; a viva acompanha a defesa sem degrau (a simulação anda a 60 Hz) e,
      // trocando de time, nasce no lugar novo
      const k = 1 - Math.exp(-(dt > 0 ? dt : 0) * 18);
      if (ehLance || !malha.visible || vis < 0.02 || (t != null && t !== timeLinha)) x = xAlvo;
      else x += (xAlvo - x) * k;
      if (t != null) timeLinha = t;
      const passo = (dt > 0 ? dt : 0) / IMPEDIMENTO.linhaMostra;
      vis = ehLance ? alvo : vis + Math.max(-passo, Math.min(passo, alvo - vis));
      lance = ehLance;
      malha.visible = vis > 0.005;
      if (!malha.visible) return;
      mat.color.copy(ehLance ? AMARELA : VIVA);
      mat.opacity = vis;
      malha.scale.x = ehLance ? 1.8 : 1;
      malha.position.set(x, 0.021, 0);
    },
  };
}
