// O VÃO das placas de publicidade do lado de cá na frente do túnel (desenho: three.js; nunca mexe no mundo). Saiu do
// render/prejogo.js (22/10, PLANO-CENAS.md §3.2) para as cenas das paradas abrirem o mesmo vão no plano do túnel (o
// expulso da cena do cartão sai por ele) sem depender do diretor do pré-jogo. Só desenho: no jogo as placas continuam
// inteiras (a bola bate nelas: bola.js).
import * as THREE from 'three';
import { CAMPO } from '../config.js';
import { FORA } from '../estadio-forma.js';
import { PLACA } from './texturas.js';
import { juntarGeometrias } from './util.js';

/**
 * O vão das placas de publicidade do lado de cá na frente do túnel (estadio-forma.js FORA.vaoPlacas): por ali passam
 * os árbitros e as duas colunas do cortejo (antes, por dentro das placas inteiras). Só no pré-jogo — no jogo as placas
 * são inteiras porque a bola bate nelas (bola.js). Recorte por planos da three.js (Material.clippingPlanes com
 * clipIntersection: some só o que está dentro dos três — |x| < meia e z além da linha das placas) nas duas malhas das
 * placas (a face de LED e a estrutura), com localClippingEnabled no renderizador, e dois arremates escuros nas pontas
 * (a caixa recortada ficaria oca). abrir()/fechar() devolvem tudo como estava. ctx = {campo, cena3d}. Usado pelo
 * pré-jogo (render/prejogo.js) e pelas cenas das paradas (main.js: o plano do túnel, com a simulação parada).
 */
export function criarVaoPlacas(ctx) {
  const g = FORA.vaoPlacas.meia, PZ = CAMPO.meioZ + CAMPO.entorno, A = PLACA.altura;
  const planos = [
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), -g),  // x > −meia
    new THREE.Plane(new THREE.Vector3(1, 0, 0), -g),   // x < meia
    new THREE.Plane(new THREE.Vector3(0, 0, -1), PZ - 1), // z > linha das placas − 1 m (só o lado de cá)
  ];
  let aberto = false, localAntes = false, pontas = null, recortadas = [];
  const malhas = () => ['placas', 'placas-estrutura'].map(n => ctx.campo.grupo?.getObjectByName(n)).filter(m => m && m.material);
  return {
    abrir() {
      if (aberto) return;
      aberto = true;
      const r = ctx.cena3d.renderer;
      localAntes = !!r.localClippingEnabled;
      r.localClippingEnabled = true;
      recortadas = malhas();
      for (const m of recortadas) { m.material.clippingPlanes = planos; m.material.clipIntersection = true; m.material.needsUpdate = true; }
      // as duas pontas numa malha só (1 chamada de desenho)
      const caixas = [-1, 1].map(s => new THREE.BoxGeometry(0.05, A + 0.04, 0.16).translate(s * (g + 0.025), (A + 0.04) / 2, PZ + 0.06));
      pontas = new THREE.Mesh(juntarGeometrias(caixas), new THREE.MeshLambertMaterial({ color: 0x0b0d0e }));
      for (const c of caixas) c.dispose();
      pontas.name = 'vao-placas';
      ctx.cena3d.cena.add(pontas);
    },
    fechar() {
      if (!aberto) return;
      aberto = false;
      for (const m of recortadas) { m.material.clippingPlanes = null; m.material.clipIntersection = false; m.material.needsUpdate = true; }
      recortadas = [];
      ctx.cena3d.renderer.localClippingEnabled = localAntes;
      if (pontas) {
        ctx.cena3d.cena.remove(pontas);
        pontas.geometry.dispose();
        pontas.material.dispose();
        pontas = null;
      }
    },
    /** Estado lido da cena (testes): as malhas das placas com o recorte agora, o renderizador e as pontas. */
    get info() {
      const ms = malhas();
      return { aberto, meia: g, malhas: ms.length, recortadas: ms.filter(m => m.material.clippingPlanes?.length).length, local: !!ctx.cena3d.renderer.localClippingEnabled, pontas: ctx.cena3d.cena.getObjectByName('vao-placas') ? 2 : 0 };
    },
  };
}
