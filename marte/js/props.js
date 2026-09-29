// Objetos do local de pouso: a cápsula que trouxe o astronauta e o paraquedas.
import * as THREE from 'three';
import { registerMaterial } from './materials.js';

export function buildLander(scene, physics, terrain, at) {
  const g = new THREE.Group();
  const white = registerMaterial(new THREE.MeshStandardMaterial({ color: 0xdcd8d0, roughness: 0.55, metalness: 0.2 }), null, 'lander');
  const scorched = registerMaterial(new THREE.MeshStandardMaterial({ color: 0x2c1f18, roughness: 0.9, metalness: 0.1 }), null, 'heat');
  const metal = registerMaterial(new THREE.MeshStandardMaterial({ color: 0x9a9ea6, roughness: 0.35, metalness: 0.85 }), null, 'lmetal');
  const orange = registerMaterial(new THREE.MeshStandardMaterial({ color: 0xd8672a, roughness: 0.7 }), null, 'lorange');

  // cápsula cônica (perfil tipo Dragon/Orion)
  const prof = [[0, 0], [2.1, 0], [2.2, 0.25], [2.05, 0.6], [1.35, 2.6], [0.9, 3.05], [0, 3.1]].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), white);
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.05, 0.25, 48), scorched); shield.position.y = 0.12;
  const hatch = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.12), metal); hatch.position.set(0, 1.35, 1.72); hatch.rotation.x = -0.33;
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(1.72, 1.8, 0.2, 48, 1, true), orange); stripe.position.y = 1.7;
  g.add(body, shield, hatch, stripe);
  // pernas de pouso
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.3, 8), metal);
    leg.position.set(Math.cos(a) * 2.15, -0.25, Math.sin(a) * 2.15);
    leg.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.08, 16), metal);
    pad.position.set(Math.cos(a) * 2.45, -0.85, Math.sin(a) * 2.45);
    g.add(leg, pad);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const y = terrain.heightAt(at.x, at.z);
  g.position.set(at.x, y + 0.85, at.z);
  g.rotation.set(0.04, 0.6, -0.03);
  scene.add(g);
  physics.addCylinder(1.55, 2.05, { x: at.x, y: y + 0.85 + 1.5, z: at.z });

  // paraquedas caído no chão, ao lado
  const chute = new THREE.Mesh(new THREE.CircleGeometry(4.5, 40, 0, Math.PI * 1.2), registerMaterial(new THREE.MeshStandardMaterial({ color: 0xc9a58a, roughness: 0.95, side: THREE.DoubleSide }), null, 'chute'));
  const cp = chute.geometry.attributes.position;
  const cx = at.x + 9, cz = at.z - 6;
  for (let i = 0; i < cp.count; i++) {
    const px = cp.getX(i), py = cp.getY(i);
    cp.setZ(i, Math.sin(px * 1.3) * 0.18 + Math.cos(py * 1.7) * 0.14 + Math.sin(px * 4.1 + py * 3.3) * 0.05);
  }
  chute.geometry.rotateX(-Math.PI / 2);
  const q = chute.geometry.attributes.position;
  for (let i = 0; i < q.count; i++) q.setY(i, q.getY(i) + terrain.heightAt(cx + q.getX(i), cz + q.getZ(i)) + 0.06);
  chute.geometry.computeVertexNormals();
  chute.position.set(cx, 0, cz);
  chute.receiveShadow = true;
  scene.add(chute);
  return g;
}
