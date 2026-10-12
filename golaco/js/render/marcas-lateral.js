// Marcadores das 3 opções do lateral (pedido do dono, seção 8: "lateral: três opções de passe e marcadores nelas").
// Com o humano cobrando o lateral (a bola nas mãos dele, antes do arremesso): um anel no gramado sob cada uma das
// opções (lateral.js opcoesLateral) — a que o analógico escolhe (lateral.js opcaoMirada; solto, a 1ª) maior, amarela
// e pulsando; as outras finas e claras. Sem texto (sem narração). 3 anéis + 1 onda: até 4 draw calls quando visível.
// Só lê o mundo: não muda o hash.
import * as THREE from 'three';
import { lateralSegurando, opcoesLateral, opcaoMirada } from '../lateral.js';
import { jogadorPorId } from '../sim.js';

const AMARELA = 0xffd84a, CLARA = 0xe8fff1;

export function criarMarcasLateral(cena) {
  const comum = { transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 };
  const geo = new THREE.RingGeometry(0.62, 0.78, 48);
  const aneis = [], mats = [];
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: CLARA, opacity: 0, ...comum });
    const a = new THREE.Mesh(geo, mat);
    a.rotation.x = -Math.PI / 2; a.renderOrder = 4; a.visible = false; a.name = 'opcao-lateral-' + i;
    cena.add(a); aneis.push(a); mats.push(mat);
  }
  const matOnda = new THREE.MeshBasicMaterial({ color: AMARELA, opacity: 0, ...comum });
  const onda = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 48), matOnda);
  onda.rotation.x = -Math.PI / 2; onda.renderOrder = 4; onda.visible = false; onda.name = 'opcao-lateral-onda';
  cena.add(onda);
  const ops = [];
  let vis = 0, mirada = -1;
  const ids = [-1, -1, -1];

  return {
    /** Estado (testes): {visivel, ids (as opções), mirada (índice da escolhida)}. */
    get estado() { return { visivel: vis > 0.001 && ids[0] >= 0, ids: ids.filter(i => i >= 0), mirada }; },
    /**
     * mundo: estado da simulação; pos(id) → {x, z} desenhado (interpolado) ou null; humanos: times do humano; t: s; dt: s.
     */
    atualizar(mundo, pos, t, dt) {
      const pr = mundo?.parada;
      let ativo = false;
      ops.length = 0;
      if (pr && lateralSegurando(mundo) && !pr.arremesso) {
        const c = jogadorPorId(mundo, pr.cobrador);
        if (c && mundo.humanos?.includes(c.time) && mundo.controlado?.[c.time] === c.id) {
          opcoesLateral(mundo, c, ops);
          mirada = opcaoMirada(mundo, c, ops);
          ativo = ops.length > 0;
        }
      }
      vis = Math.max(0, Math.min(1, vis + (ativo ? dt / 0.15 : -dt / 0.15)));
      if (ativo) for (let i = 0; i < 3; i++) ids[i] = ops[i] ? ops[i].id : -1;
      const pulso = 1 + 0.06 * Math.sin(t * Math.PI * 2 / 0.7);
      let ondaPos = null;
      for (let i = 0; i < 3; i++) {
        const a = aneis[i], mat = mats[i];
        const p = ids[i] >= 0 && vis > 0.001 ? pos(ids[i]) : null;
        a.visible = !!p;
        if (!p) continue;
        const esc = i === mirada;
        a.position.set(p.x, 0.024, p.z);
        const s = esc ? 1.15 * pulso : 0.9;
        a.scale.set(s, s, 1);
        mat.color.setHex(esc ? AMARELA : CLARA);
        mat.opacity = (esc ? 0.95 : 0.55) * vis;
        if (esc) ondaPos = p;
      }
      onda.visible = !!ondaPos;
      if (ondaPos) {
        const f = (t / 0.9) % 1, so = 0.8 + 0.7 * f;
        onda.position.set(ondaPos.x, 0.023, ondaPos.z);
        onda.scale.set(so, so, 1);
        matOnda.opacity = 0.6 * (1 - f) * vis;
      }
      if (!ativo && vis <= 0.001) { ids[0] = ids[1] = ids[2] = -1; mirada = -1; }
    },
  };
}
