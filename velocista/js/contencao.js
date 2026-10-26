// A CONTENÇÃO do S.T.A.R. Labs com os vilões presos (dono, 26/10: "os vilões não aparecem na contenção"): cada vilão
// vencido na história fica numa cela (as 8 de lab.js CELAS), de frente para o corredor. Os velocistas (Zoom, Flash
// Reverso, Savitar) vibram de tempo em tempo contra o vidro, tentando atravessar; os outros andam de um lado para o
// outro. Os corpos só são carregados com o herói perto do laboratório e somem enquanto aquele vilão está solto na cidade
// (um capítulo jogado de novo pela pausa).
import * as THREE from 'three';
import { criarHeroi } from './humano.js';
import { colocarAderecos } from './aderecos.js';
import { CELAS, PISO } from './lab.js';
import { PERFIS } from './viloes.js';

// quem fica em qual cela (o "final" prende o Zoom e o Reverso de novo)
const ORDEM = ['zoom', 'reverso', 'frio', 'onda', 'mago', 'savitar', 'devoe'];
const VELOCISTA = new Set(['zoom', 'reverso', 'savitar']);

export function criarContencao(cena, { mobile = false, aniso = 2, lab } = {}) {
  const presos = {};                                          // id → {raiz, modelo, x, z, h, fase}
  const carregando = {};
  function carregar(id, k) {
    if (carregando[id]) return;
    const perf = PERFIS[id], c = CELAS[k], dir = c.lado < 0 ? 1 : -1;
    carregando[id] = criarHeroi({ aniso, lod: 1, mobile, traje: perf.traje, pessoa: perf.pessoa }).then((m) => {
      if (perf.arma || perf.aderecos) colocarAderecos(id, m);
      const raiz = new THREE.Group(); raiz.add(m.grupo); raiz.visible = false; cena.add(raiz);
      const u = (c.u0 + c.u1) / 2 + dir * 0.2, v = (c.v0 + c.v1) / 2;
      presos[id] = { id, raiz, modelo: m, x: lab.cx + u, z: lab.cz + v, h: dir > 0 ? Math.PI / 2 : -Math.PI / 2, dir, fase: k * 1.7, meia: (c.v1 - c.v0) / 2 - 0.7 };
    }).catch((e) => console.warn('preso sem corpo', id, e));
  }
  let t = 0;
  /** a cada quadro: quem está preso (vencido e não solto agora) aparece na cela dele, com o herói perto */
  function atualizar(dt, P, viloes) {
    t += dt;
    const perto = Math.abs(P.x - lab.cx) < 90 && Math.abs(P.z - lab.cz) < 90 && P.y < 60;
    const soltos = viloes.ativo ? new Set(viloes.ids) : new Set();
    ORDEM.forEach((id, k) => {
      const preso = (viloes.vencido(id) || ((id === 'zoom' || id === 'reverso') && viloes.vencido('final'))) && !soltos.has(id);
      if (preso && perto) carregar(id, k);
      const p = presos[id]; if (!p) return;
      p.raiz.visible = preso && perto; if (!p.raiz.visible) return;
      const vel = VELOCISTA.has(id), ciclo = (t + p.fase) % 9;
      // os velocistas encostam no vidro e vibram por 2 s a cada 9; os outros andam devagar de um lado para o outro
      const vibra = vel && ciclo > 6.5, anda = !vel && Math.sin((t + p.fase) * 0.35) > -0.2;
      const dz = vel ? 0 : Math.sin((t + p.fase) * 0.35) * p.meia, dx = vibra ? p.dir * 0.55 : 0;
      p.raiz.position.set(p.x + dx, PISO, p.z + dz);
      p.raiz.rotation.y = anda && !vel ? (Math.cos((t + p.fase) * 0.35) > 0 ? 0 : Math.PI) : p.h;
      p.modelo.aplicar({ v: anda && !vel ? 1.2 * Math.abs(Math.cos((t + p.fase) * 0.35)) : 0, noChao: true, vibrando: vibra }, dt);
    });
  }
  return { atualizar, presos };
}
