// Mundo físico (Rapier): terreno como heightfield, rochas como cascos convexos,
// paredes nos limites e o controlador de personagem do astronauta.
import RAPIER from 'rapier';
import { MARS } from './config.js';

export async function initRapier() { await RAPIER.init(); return RAPIER; }

export const GROUP_WORLD = 0x0001;
export const GROUP_PLAYER = 0x0002;
export const GROUP_PROPS = 0x0004;
// membros (16 bits altos) + filtro (16 bits baixos)
export const groups = (member, filter) => (member << 16) | filter;

export class Physics {
  constructor(terrain) {
    this.R = RAPIER;
    this.world = new RAPIER.World({ x: 0, y: -MARS.g, z: 0 });
    this.world.timestep = 1 / 60;
    const N = terrain.N, S = terrain.S, H = terrain.H;
    // o Rapier guarda as alturas em ordem de coluna: heights[iz + ix * S]
    const hf = new Float32Array(S * S);
    for (let iz = 0; iz < S; iz++) for (let ix = 0; ix < S; ix++) hf[iz + ix * S] = H[iz * S + ix];
    const desc = RAPIER.ColliderDesc.heightfield(N, N, hf, { x: N, y: 1, z: N })
      .setFriction(0.9).setCollisionGroups(groups(GROUP_WORLD, 0xffff));
    this.ground = this.world.createCollider(desc);

    // paredes invisíveis no limite do mapa (o horizonte continua visível)
    const half = N / 2, wallH = 400, t = 2;
    const cy = (terrain.maxY) / 2;
    for (const [x, z, hx, hz] of [[half - 8 + t, 0, t, half], [-half + 8 - t, 0, t, half], [0, half - 8 + t, half, t], [0, -half + 8 - t, half, t]]) {
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx, wallH, hz).setTranslation(x, cy, z).setCollisionGroups(groups(GROUP_WORLD, 0xffff)));
    }
  }

  addConvex(points, pos, quat, member = GROUP_WORLD) {
    const d = RAPIER.ColliderDesc.convexHull(points);
    if (!d) return null;
    d.setTranslation(pos.x, pos.y, pos.z).setRotation(quat).setFriction(0.8).setCollisionGroups(groups(member, 0xffff));
    return this.world.createCollider(d);
  }
  addCylinder(halfH, r, pos) {
    return this.world.createCollider(RAPIER.ColliderDesc.cylinder(halfH, r).setTranslation(pos.x, pos.y, pos.z).setCollisionGroups(groups(GROUP_WORLD, 0xffff)));
  }
  addCuboid(hx, hy, hz, pos, quat) {
    const d = RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(pos.x, pos.y, pos.z).setCollisionGroups(groups(GROUP_WORLD, 0xffff));
    if (quat) d.setRotation(quat);
    return this.world.createCollider(d);
  }

  // raio contra o mundo (ignora o jogador); devolve a distância ou null
  castRay(origin, dir, maxDist, excludeCollider) {
    const ray = new RAPIER.Ray(origin, dir);
    const hit = this.world.castRay(ray, maxDist, true, undefined, groups(0xffff, GROUP_WORLD | GROUP_PROPS), excludeCollider);
    return hit ? hit.timeOfImpact : null;
  }

  step() { this.world.step(); }
}
