// Bola 3D: esfera com textura procedural (icosaedro truncado, pentágonos pretos com contorno
// verde), orientada pelo quaternion da simulação (bola.q), sombra real (média/alta) e mancha
// de contato no chão que diminui com a altura.
import * as THREE from 'three';
import { BOLA } from '../config.js';
import { texBola, texMancha } from './texturas.js';

export function criarBola3D(cena, qualidade) {
  const alta = qualidade !== 'baixa';
  const geo = new THREE.SphereGeometry(BOLA.raio, alta ? 32 : 20, alta ? 20 : 12);
  const mat = new THREE.MeshStandardMaterial({ map: texBola(alta ? 512 : 256), roughness: 0.42, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.name = 'bola';
  cena.add(mesh);
  const gm = new THREE.PlaneGeometry(1, 1);
  gm.rotateX(-Math.PI / 2);
  const matMancha = new THREE.MeshBasicMaterial({
    map: texMancha(), color: 0x000000, transparent: true, depthWrite: false, opacity: 0.55,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6,
  });
  const mancha = new THREE.Mesh(gm, matMancha);
  mancha.renderOrder = 3;
  mancha.name = 'bola-mancha';
  cena.add(mancha);
  let forcaMancha = 0.55;
  return {
    mesh,
    /** p = {x,y,z}, q = THREE.Quaternion já interpolado. */
    atualizar(p, q) {
      mesh.position.set(p.x, p.y, p.z);
      mesh.quaternion.copy(q);
      const alt = Math.max(0, p.y - BOLA.raio);
      const s = 0.3 + alt * 0.22;
      mancha.position.set(p.x, 0.015, p.z);
      mancha.scale.set(s, 1, s);
      matMancha.opacity = forcaMancha / (1 + alt * 1.6);
    },
    /** Com sombra real a mancha fica só como oclusão de contato. */
    definirSombras(ligadas) {
      mesh.castShadow = ligadas;
      forcaMancha = ligadas ? 0.35 : 0.6;
    },
  };
}
