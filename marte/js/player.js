// Astronauta: modelo articulado, animação procedural e controlador físico.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PLAYER, MARS } from './config.js';
import { registerMaterial } from './materials.js';
import { groups, GROUP_PLAYER, GROUP_WORLD, GROUP_PROPS } from './physics.js';

const UP = new THREE.Vector3(0, 1, 0);
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// ---------------------------------------------------------------- modelo
function buildAstronaut(name, accentHex) {
  const suit = registerMaterial(new THREE.MeshStandardMaterial({ color: 0xe8e3da, roughness: 0.82 }), null, 'suit');
  const accent = registerMaterial(new THREE.MeshStandardMaterial({ color: new THREE.Color(accentHex), roughness: 0.6 }), null, 'accent');
  const dark = registerMaterial(new THREE.MeshStandardMaterial({ color: 0x56575c, roughness: 0.65 }), null, 'dark');
  const metal = registerMaterial(new THREE.MeshStandardMaterial({ color: 0xb9bdc5, roughness: 0.3, metalness: 0.9 }), null, 'metal');
  const boots = registerMaterial(new THREE.MeshStandardMaterial({ color: 0x3c3a3a, roughness: 0.9 }), null, 'boots');
  const visor = registerMaterial(new THREE.MeshPhysicalMaterial({ color: 0xd9a441, metalness: 1, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03 }), null, 'visor');
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff4e0 });

  const cap = (r, l, m, sx = 1, sy = 1, sz = 1) => { const g = new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 6, 14), m); g.scale.set(sx, sy, sz); return g; };
  const G = () => new THREE.Group();
  const root = G();
  const body = G(); root.add(body);
  const pelvis = G(); pelvis.position.y = 0.98; body.add(pelvis);
  const hips = cap(0.17, 0.14, suit, 1.25, 0.72, 0.95); hips.rotation.z = Math.PI / 2; pelvis.add(hips);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.025, 8, 28), dark); belt.rotation.x = Math.PI / 2; belt.position.y = 0.08; belt.scale.set(1.08, 0.85, 1); pelvis.add(belt);

  const spine = G(); spine.position.y = 0.1; pelvis.add(spine);
  const torso = cap(0.22, 0.26, suit, 1.08, 1, 0.82); torso.position.y = 0.26; spine.add(torso);
  const dcm = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.15, 0.08, 3, 0.02), dark); dcm.position.set(0, 0.3, 0.2); spine.add(dcm);
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 10), [accent, metal, metal][i]); b.rotation.x = Math.PI / 2; b.position.set(-0.07 + i * 0.07, 0.3, 0.245); spine.add(b); }
  // crachá com o nome
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.05), new THREE.MeshStandardMaterial({
    map: canvasTex(256, 64, (c, w, h) => { c.fillStyle = '#f2eee8'; c.fillRect(0, 0, w, h); c.fillStyle = '#222'; c.font = 'bold 40px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText((name || 'ASTRONAUTA').toUpperCase(), w / 2, h / 2 + 2); }),
    roughness: 0.8,
  }));
  tag.position.set(0, 0.43, 0.19); tag.rotation.x = -0.25; spine.add(tag);
  // mochila de suporte de vida (PLSS)
  const plss = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.62, 0.24, 4, 0.05), suit); plss.position.set(0, 0.32, -0.25); spine.add(plss);
  for (const sx of [-1, 1]) { const s = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.5, 0.2, 2, 0.01), accent); s.position.set(sx * 0.235, 0.32, -0.25); spine.add(s); }
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.34, 6), metal); ant.position.set(0.17, 0.75, -0.3); spine.add(ant);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.03, 10, 28), metal); ring.rotation.x = Math.PI / 2; ring.position.y = 0.56; spine.add(ring);

  const head = G(); head.position.y = 0.72; spine.add(head);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 20), suit); head.add(shell);
  const vis = new THREE.Mesh(new THREE.SphereGeometry(0.207, 32, 20, Math.PI * 0.5 - Math.PI * 0.36, Math.PI * 0.72, Math.PI * 0.28, Math.PI * 0.42), visor);   // centrado em +z (frente)
  vis.rotation.y = 0; head.add(vis);
  for (const sx of [-1, 1]) {
    const lampBox = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.05, 0.09, 2, 0.01), dark); lampBox.position.set(sx * 0.19, 0.06, 0.03); head.add(lampBox);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.018, 14), lampMat); lens.position.set(sx * 0.19, 0.06, 0.077); head.add(lens);
  }
  // bandeira do Brasil no ombro esquerdo
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.07), new THREE.MeshStandardMaterial({
    map: canvasTex(100, 70, (c) => { c.fillStyle = '#009c3b'; c.fillRect(0, 0, 100, 70); c.fillStyle = '#ffdf00'; c.beginPath(); c.moveTo(50, 7); c.lineTo(93, 35); c.lineTo(50, 63); c.lineTo(7, 35); c.fill(); c.fillStyle = '#002776'; c.beginPath(); c.arc(50, 35, 15, 0, 7); c.fill(); }),
    roughness: 0.8,
  }));

  const limbs = {};
  for (const side of [-1, 1]) {
    const k = side < 0 ? 'L' : 'R';
    const sh = G(); sh.position.set(side * 0.29, 0.44, 0); spine.add(sh);
    const sj = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), suit); sh.add(sj);
    const up = cap(0.075, 0.18, suit); up.position.y = -0.17; sh.add(up);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 16), accent); band.position.y = -0.1; sh.add(band);
    if (side < 0) { flag.position.set(-0.078, -0.08, 0.0); flag.rotation.y = -Math.PI / 2; sh.add(flag); }
    const el = G(); el.position.y = -0.33; sh.add(el);
    const fa = cap(0.066, 0.16, suit); fa.position.y = -0.13; el.add(fa);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 14), metal); cuff.position.y = -0.24; el.add(cuff);
    const glove = cap(0.058, 0.05, dark, 1, 1, 0.8); glove.position.y = -0.31; el.add(glove);

    const hip = G(); hip.position.set(side * 0.11, -0.03, 0); pelvis.add(hip);
    const th = cap(0.092, 0.25, suit); th.position.y = -0.21; hip.add(th);
    const tb = new THREE.Mesh(new THREE.CylinderGeometry(0.097, 0.097, 0.05, 16), accent); tb.position.y = -0.14; hip.add(tb);
    const kn = G(); kn.position.y = -0.44; hip.add(kn);
    const kj = new THREE.Mesh(new THREE.SphereGeometry(0.088, 14, 10), suit); kn.add(kj);
    const shin = cap(0.082, 0.25, suit); shin.position.y = -0.2; kn.add(shin);
    const ank = G(); ank.position.y = -0.43; kn.add(ank);
    const boot = new THREE.Mesh(new RoundedBoxGeometry(0.15, 0.11, 0.29, 3, 0.035), boots); boot.position.set(0, -0.02, 0.04); ank.add(boot);
    limbs['sh' + k] = sh; limbs['el' + k] = el; limbs['hip' + k] = hip; limbs['kn' + k] = kn; limbs['ank' + k] = ank;
  }
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  tag.castShadow = false; flag.castShadow = false;
  return { root, body, pelvis, spine, head, limbs, accent };
}

// ---------------------------------------------------------------- jogador
export class Player {
  constructor(scene, physics, terrain, opts) {
    this.physics = physics; this.terrain = terrain;
    const R = physics.R, world = physics.world;
    this.model = buildAstronaut(opts.name, opts.color);
    scene.add(this.model.root);

    const start = opts.position || new THREE.Vector3(0, 0, 0);
    const feetY = terrain.heightAt(start.x, start.z) + 0.05;
    this.centerOffset = PLAYER.halfHeight + PLAYER.radius;       // do pé ao centro da cápsula
    this.body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(start.x, feetY + this.centerOffset + 0.02, start.z));
    this.collider = world.createCollider(
      R.ColliderDesc.capsule(PLAYER.halfHeight, PLAYER.radius).setCollisionGroups(groups(GROUP_PLAYER, GROUP_WORLD | GROUP_PROPS)).setFriction(0),
      this.body);
    const cc = world.createCharacterController(0.03);
    cc.setUp({ x: 0, y: 1, z: 0 });
    cc.setMaxSlopeClimbAngle(PLAYER.maxClimbDeg * Math.PI / 180);
    cc.setMinSlopeSlideAngle(PLAYER.slideDeg * Math.PI / 180);
    cc.enableAutostep(PLAYER.stepHeight, 0.12, false);
    cc.enableSnapToGround(0.35);
    cc.setSlideEnabled(true);
    cc.setApplyImpulsesToDynamicBodies(true);
    this.cc = cc;
    this.filterGroups = groups(GROUP_PLAYER, GROUP_WORLD | GROUP_PROPS);

    this.vel = new THREE.Vector3();
    this.grounded = true;
    this.facing = opts.yaw ?? 0;       // direção do corpo (rad, 0 = -z)
    this.prevPos = new THREE.Vector3();
    this.pos = new THREE.Vector3();    // pés
    this.renderPos = new THREE.Vector3();
    this._readPos(); this.prevPos.copy(this.pos);
    this.coyote = 0; this.jumpBuffer = 0;
    this.airTime = 0; this.maxJumpY = 0; this.lastJumpHeight = 0; this.lastAirTime = 0;
    this.landImpact = 0; this.landSpring = 0;
    this.phase = 0; this.gaitBlend = 0; this.moveAmt = 0;
    this.events = [];                  // eventos de pisada/pouso para poeira, som e pegadas
    this.lastFoot = 0;
    this.rescues = 0;
    this._anim = { lean: 0, bob: 0, armOut: 0, tuck: 0 };
  }

  _readPos() {
    const t = this.body.translation();
    this.pos.set(t.x, t.y - this.centerOffset, t.z);
  }

  // passo fixo de física (60 Hz)
  fixedUpdate(dt, input, camYaw) {
    this.prevPos.copy(this.pos);
    // direção desejada relativa à câmera
    const ix = input.moveX, iz = input.moveY;
    const mag = Math.min(1, Math.hypot(ix, iz));
    // câmera olha para (-sin yaw, -cos yaw); direita = (cos yaw, -sin yaw)
    const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
    const dirx = -sin * iz + cos * ix, dirz = -cos * iz - sin * ix;
    const speed = (input.run ? PLAYER.runSpeed : PLAYER.walkSpeed) * mag;
    const tx = mag > 0.01 ? dirx / Math.max(Math.hypot(dirx, dirz), 1e-6) * speed : 0;
    const tz = mag > 0.01 ? dirz / Math.max(Math.hypot(dirx, dirz), 1e-6) * speed : 0;

    const accel = this.grounded ? (mag > 0.01 ? PLAYER.groundAccel : PLAYER.groundDecel) : PLAYER.airAccel;
    const ex = tx - this.vel.x, ez = tz - this.vel.z;
    const el = Math.hypot(ex, ez), maxDv = accel * dt;
    if (el > maxDv) { this.vel.x += ex / el * maxDv; this.vel.z += ez / el * maxDv; } else { this.vel.x = tx; this.vel.z = tz; }

    // pulo com tolerância (coyote time) e buffer
    this.coyote = this.grounded ? 0.12 : Math.max(0, this.coyote - dt);
    if (input.jump) this.jumpBuffer = 0.15; else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    let jumped = false;
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vel.y = PLAYER.jumpSpeed; this.coyote = 0; this.jumpBuffer = 0; jumped = true;
      this.grounded = false; this.maxJumpY = this.pos.y; this.jumpStartY = this.pos.y; this.airTime = 0;
      this.events.push({ type: 'jump', x: this.pos.x, y: this.pos.y, z: this.pos.z });
    }
    this.vel.y -= MARS.g * dt;

    const desired = { x: this.vel.x * dt, y: this.vel.y * dt, z: this.vel.z * dt };
    this.cc.computeColliderMovement(this.collider, desired, this.physics.R.QueryFilterFlags.EXCLUDE_SENSORS, this.filterGroups);
    const mv = this.cc.computedMovement();
    const t = this.body.translation();
    this.body.setNextKinematicTranslation({ x: t.x + mv.x, y: t.y + mv.y, z: t.z + mv.z });
    const wasGrounded = this.grounded;
    this.grounded = this.cc.computedGrounded() && !jumped;

    // velocidade horizontal real (bateu numa rocha? perde o impulso)
    const ax = mv.x / dt, az = mv.z / dt;
    const want = Math.hypot(this.vel.x, this.vel.z), got = Math.hypot(ax, az);
    if (got < want * 0.95) { this.vel.x = damp(this.vel.x, ax, 12, dt); this.vel.z = damp(this.vel.z, az, 12, dt); }
    if (!this.grounded && this.vel.y > 0 && mv.y < desired.y * 0.5) this.vel.y = 0;    // bateu a cabeça

    if (!this.grounded) {
      this.airTime += dt;
      this.maxJumpY = Math.max(this.maxJumpY ?? this.pos.y, this.pos.y + mv.y);
    }
    if (this.grounded) {
      if (!wasGrounded && this.airTime > 0.15) {
        this.landImpact = Math.min(1, Math.abs(this.vel.y) / 5);
        this.lastAirTime = this.airTime;
        if (this.jumpStartY !== undefined) this.lastJumpHeight = this.maxJumpY - this.jumpStartY;
        this.events.push({ type: 'land', x: this.pos.x, y: this.pos.y, z: this.pos.z, impact: this.landImpact });
      }
      this.airTime = 0;
      if (this.vel.y < 0) this.vel.y = -0.5;          // mantém colado ao chão em descidas
    }
    this.moveAmt = Math.hypot(this.vel.x, this.vel.z);
    // gira o corpo para a direção do movimento (lento: o traje é pesado)
    if (this.moveAmt > 0.15 && mag > 0.01) {
      const target = Math.atan2(this.vel.x, this.vel.z);   // o modelo olha para +z local
      let d = target - this.facing; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += THREE.MathUtils.clamp(d, -PLAYER.turnRate * dt, PLAYER.turnRate * dt);
    }
  }

  // depois do passo do mundo físico
  postPhysics() {
    this._readPos();
    // rede de segurança: nunca atravessar o chão nem sair do mapa
    const gh = this.terrain.heightAt(this.pos.x, this.pos.z);
    const bad = !Number.isFinite(this.pos.x + this.pos.y + this.pos.z);
    if (bad || this.pos.y < gh - 0.6 || !this.terrain.inside(this.pos.x, this.pos.z, 2)) {
      const sx = bad ? 0 : THREE.MathUtils.clamp(this.pos.x, -this.terrain.half + 12, this.terrain.half - 12);
      const sz = bad ? 0 : THREE.MathUtils.clamp(this.pos.z, -this.terrain.half + 12, this.terrain.half - 12);
      const y = this.terrain.heightAt(sx, sz) + 0.3;
      this.body.setTranslation({ x: sx, y: y + this.centerOffset, z: sz }, true);
      this.vel.set(0, 0, 0);
      this.rescues++;
      this._readPos(); this.prevPos.copy(this.pos);
    }
  }

  teleport(x, z, yaw) {
    const y = this.terrain.heightAt(x, z) + 0.2;
    this.body.setTranslation({ x, y: y + this.centerOffset, z }, true);
    this.vel.set(0, 0, 0);
    if (yaw !== undefined) this.facing = yaw;
    this._readPos(); this.prevPos.copy(this.pos);
  }

  // animação e posição visual (interpolada entre passos físicos)
  update(dt, alpha) {
    this.renderPos.lerpVectors(this.prevPos, this.pos, alpha);
    const m = this.model;
    m.root.position.copy(this.renderPos);
    m.root.rotation.y = this.facing;

    const sp = this.moveAmt;
    const running = sp > 2.0;
    this.gaitBlend = damp(this.gaitBlend, running ? 1 : 0, 4, dt);
    const stride = THREE.MathUtils.lerp(1.35, 2.3, this.gaitBlend);     // metros por ciclo
    const prev = this.phase;
    if (this.grounded) this.phase += (sp / stride) * Math.PI * 2 * dt;
    const moving = THREE.MathUtils.smoothstep(sp, 0.05, 0.6);
    const a = this._anim;
    const air = this.grounded ? 0 : 1;
    a.tuck = damp(a.tuck, air, 8, dt);
    a.armOut = damp(a.armOut, air * 0.5 + this.gaitBlend * 0.15 * moving, 5, dt);
    a.lean = damp(a.lean, moving * (0.06 + this.gaitBlend * 0.14), 4, dt);
    this.landSpring = damp(this.landSpring, 0, 6, dt);
    if (this.landImpact > 0) { this.landSpring += this.landImpact; this.landImpact = 0; }

    const ph = this.phase, gb = this.gaitBlend;
    // caminhada: pernas alternadas; "lope": as duas quase juntas, como um galope curto
    const swingL = Math.sin(ph), swingR = THREE.MathUtils.lerp(Math.sin(ph + Math.PI), Math.sin(ph + 0.7), gb);
    const amp = (0.42 + 0.18 * gb) * moving;
    const L = m.limbs;
    L.hipL.rotation.x = -swingL * amp - a.tuck * 0.5;
    L.hipR.rotation.x = -swingR * amp - a.tuck * 0.35;
    const kneeL = Math.max(0, Math.cos(ph)) * 0.9 * moving, kneeR = Math.max(0, Math.cos(ph + (gb > 0.5 ? 0.7 : Math.PI))) * 0.9 * moving;
    const squat = Math.min(this.landSpring, 1) * 0.6;
    L.knL.rotation.x = kneeL + a.tuck * 0.7 + squat + 0.05;
    L.knR.rotation.x = kneeR + a.tuck * 0.55 + squat + 0.05;
    L.ankL.rotation.x = -kneeL * 0.3 - squat * 0.3; L.ankR.rotation.x = -kneeR * 0.3 - squat * 0.3;
    L.hipL.rotation.x -= squat * 0.4; L.hipR.rotation.x -= squat * 0.4;
    // braços: balanço pequeno (o traje é rígido) e abertos no ar para equilibrar
    L.shL.rotation.x = swingR * 0.28 * moving; L.shR.rotation.x = swingL * 0.28 * moving;
    L.shL.rotation.z = -0.12 - a.armOut * 0.5; L.shR.rotation.z = 0.12 + a.armOut * 0.5;
    L.elL.rotation.x = -0.35 - 0.3 * gb * moving; L.elR.rotation.x = -0.35 - 0.3 * gb * moving;
    // corpo: sobe e desce; no lope há uma fase de voo
    const walkBob = Math.abs(Math.cos(ph)) * 0.035 * moving * (1 - gb);
    const lopeBob = Math.max(0, Math.sin(ph * 1.0)) * 0.1 * moving * gb;
    const breathe = Math.sin(performance.now() * 0.0016) * 0.006;
    m.body.position.y = walkBob + lopeBob - squat * 0.16 + breathe;
    m.spine.rotation.x = a.lean + squat * 0.25;
    m.head.rotation.x = -a.lean * 0.5;

    // pisadas (para poeira, pegadas e som)
    if (this.grounded && sp > 0.25) {
      const stepsPerCycle = gb > 0.5 ? 1 : 2;
      const before = Math.floor(prev / (Math.PI * 2 / stepsPerCycle));
      const after = Math.floor(this.phase / (Math.PI * 2 / stepsPerCycle));
      if (after > before) {
        this.lastFoot = 1 - this.lastFoot;
        const side = gb > 0.5 ? 0 : (this.lastFoot ? 1 : -1);
        const f = this.facing;
        const fx = this.renderPos.x + Math.cos(f) * 0.12 * side + Math.sin(f) * 0.1;
        const fz = this.renderPos.z - Math.sin(f) * 0.12 * side + Math.cos(f) * 0.1;
        this.events.push({ type: 'step', x: fx, y: this.renderPos.y, z: fz, yaw: f, run: gb > 0.5, side, speed: sp });
      }
    }
  }

  setFirstPerson(fp) {
    // em primeira pessoa o corpo continua projetando sombra, mas some da câmera
    this.model.root.traverse((o) => { if (o.isMesh) o.layers.set(fp ? 1 : 0); });
  }

  get headPos() { return new THREE.Vector3(this.renderPos.x, this.renderPos.y + 1.68 + this.model.body.position.y, this.renderPos.z); }
}
