// Marcos do Rio: Cristo Redentor (30 m + pedestal, no alto do Corcovado),
// Ponte Rio–Niterói (13 km) e o Maracanã.
import * as THREE from 'three';
import { registerMaterial } from './materials.js';

const D2R = Math.PI / 180;

export function buildLandmarks(scene, terrain, meta, colliders) {
  const M_LAT = Math.PI / 180 * 6371000, M_LON = M_LAT * Math.cos(meta.lat0 * D2R);
  const xz = (lat, lon) => [(lon - meta.lon0) * M_LON, -(lat - meta.lat0) * M_LAT];
  const stone = registerMaterial(new THREE.MeshStandardMaterial({ color: 0xd9d4c8, roughness: 0.85 }), null, 'stone');
  const concrete = registerMaterial(new THREE.MeshStandardMaterial({ color: 0xb8b3a8, roughness: 0.9 }), null, 'concrete');
  const dark = registerMaterial(new THREE.MeshStandardMaterial({ color: 0x5b5a57, roughness: 0.8 }), null, 'dk');
  const white = registerMaterial(new THREE.MeshStandardMaterial({ color: 0xf0efe9, roughness: 0.6 }), null, 'wht');

  // ---- Cristo Redentor: acha o cume do Corcovado perto da coordenada
  {
    const lm = meta.landmarks.cristo;
    let bx = lm.x, bz = lm.z, bh = terrain.heightAt(bx, bz);
    for (let dx = -60; dx <= 60; dx += 10) for (let dz = -60; dz <= 60; dz += 10) { const h = terrain.heightAt(lm.x + dx, lm.z + dz); if (h > bh) { bh = h; bx = lm.x + dx; bz = lm.z + dz; } }
    const g = new THREE.Group();
    const ped = new THREE.Mesh(new THREE.BoxGeometry(9, 8, 9), concrete); ped.position.y = 4; g.add(ped);
    const robe = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 4.2, 19, 12), stone); robe.position.y = 8 + 9.5; g.add(robe);
    const chest = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 2.7, 5, 12), stone); chest.position.y = 8 + 21; g.add(chest);
    const arms = new THREE.Mesh(new THREE.BoxGeometry(28, 2.4, 2.2), stone); arms.position.y = 8 + 22.5; g.add(arms);
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.9, 14, 10), stone); head.position.y = 8 + 26.2; g.add(head);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.position.set(bx, bh - 1, bz);
    g.rotation.y = 12 * D2R;    // de braços abertos para a baía
    scene.add(g);
    colliders.push({ x: bx, z: bz, r: 14, top: bh + 36 });
    meta.landmarks.cristo.world = { x: bx, y: bh, z: bz };
  }

  // ---- Ponte Rio–Niterói: tabuleiro com vão central elevado (72 m) sobre o canal de navegação
  {
    const pl = meta.landmarks.ponte;
    const [x1, z1] = xz(pl.lat1, pl.lon1), [x2, z2] = xz(pl.lat2, pl.lon2);
    const L = Math.hypot(x2 - x1, z2 - z1), ux = (x2 - x1) / L, uz = (z2 - z1) / L;
    const n = Math.round(L / 80);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = i / n * L;
      const px = x1 + ux * a, pz = z1 + uz * a;
      // perfil: sobe para 72 m no vão central (~a 40% da extensão, lado do Rio)
      const c = (a / L - 0.42) / 0.12;
      let y = 22 + 50 * Math.exp(-c * c);
      const gh = terrain.heightAt(px, pz);
      if (gh > y - 4) y = gh + 6;
      pts.push(new THREE.Vector3(px, y, pz));
    }
    // tabuleiro de 26 m de largura (caixa seguindo o perfil)
    const px = -uz * 13, pz = ux * 13, vtx = [], ind = [];
    for (const p of pts) {
      vtx.push(p.x - px, p.y, p.z - pz, p.x + px, p.y, p.z + pz, p.x + px, p.y - 2.4, p.z + pz, p.x - px, p.y - 2.4, p.z - pz);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const a0 = i * 4, b0 = a0 + 4;
      for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4; ind.push(a0 + k, b0 + k, a0 + k2, a0 + k2, b0 + k, b0 + k2); }
    }
    const deckGeo = new THREE.BufferGeometry();
    deckGeo.setAttribute('position', new THREE.Float32BufferAttribute(vtx, 3)); deckGeo.setIndex(ind); deckGeo.computeVertexNormals();
    const deckMesh = new THREE.Mesh(deckGeo, concrete);
    concrete.side = THREE.DoubleSide;
    deckMesh.castShadow = true; deckMesh.receiveShadow = true;
    scene.add(deckMesh);
    // pilares
    const pil = new THREE.InstancedMesh(new THREE.BoxGeometry(6, 1, 4).translate(0, 0.5, 0), dark, n + 1);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(uz, ux));
    let k = 0;
    for (const p of pts) {
      const gh = Math.min(terrain.heightAt(p.x, p.z), 0) - 5;
      m.compose(new THREE.Vector3(p.x, gh, p.z), q, new THREE.Vector3(1, p.y - 2.4 - gh, 1));
      pil.setMatrixAt(k++, m);
    }
    pil.castShadow = true; pil.receiveShadow = true;
    scene.add(pil);
    for (const p of pts) colliders.push({ x: p.x, z: p.z, r: 45, top: p.y + 1, bottom: p.y - 3, deck: true });
  }

  // ---- Maracanã: anel elíptico com cobertura branca
  {
    const lm = meta.landmarks.maracana;
    const gh = terrain.heightAt(lm.x, lm.z);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.08, 1, 48, 1, true), concrete);
    ring.scale.set(150, 28, 125); ring.position.set(lm.x, gh + 14, lm.z);
    const roof = new THREE.Mesh(new THREE.RingGeometry(0.72, 1.0, 48).rotateX(-Math.PI / 2), white);
    roof.scale.set(150, 1, 125); roof.position.set(lm.x, gh + 28.2, lm.z);
    const field = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), registerMaterial(new THREE.MeshStandardMaterial({ color: 0x2f7d32, roughness: 0.9 }), null, 'field'));
    field.scale.set(105, 1, 80); field.position.set(lm.x, gh + 0.4, lm.z);
    for (const o of [ring, roof, field]) { o.castShadow = true; o.receiveShadow = true; o.material.side = THREE.DoubleSide; scene.add(o); }
    colliders.push({ x: lm.x, z: lm.z, r: 140, top: gh + 29 });
  }
}
