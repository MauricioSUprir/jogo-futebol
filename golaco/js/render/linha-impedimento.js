// Linha de impedimento desenhada no gramado (pedido do dono, seção 8: "impedimento com a linha desenhada").
//  - com a bola rolando no campo de ataque de quem tem a bola: linha amarelo-clara discreta (branca se confundia com
//    as linhas do campo) de lado a lado na linha de
//    impedimento DESTE time (impedimento.js linhaImpedimento: o penúltimo adversário, a bola ou o meio) — vale para
//    os dois times (o humano vê a linha da defesa adversária quando ataca e a da própria defesa quando defende);
//  - no apito do impedimento: a linha DO LANCE (a do instante do passe) fica parada, amarela e mais grossa, por
//    IMPEDIMENTO.linhaCongela s (o "replay" da marcação, sem texto na tela).
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
        } else if (p.estado === 'jogo' && !(mundo.parada && !mundo.parada.rolou)) {
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
    /**
     * Desenho COMANDADO (o replay do impedimento, render/replay.js): l = null (some) ou {visivel, x, opacidade} — a
     * linha do lance (amarela e grossa) em x, sem ler o mundo nem depender da linha do jogo ao vivo.
     */
    mostrar(l) {
      const vis = !!(l && l.visivel && l.opacidade > 0.005);
      malha.visible = vis;
      lance = vis;
      if (!vis) { mat.opacity = 0; return; }
      x = l.x;
      mat.color.copy(AMARELA);
      mat.opacity = Math.min(1, l.opacidade);
      malha.scale.x = 1.8;
      malha.position.set(x, 0.021, 0);
    },
  };
}
