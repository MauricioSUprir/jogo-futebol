// JEZERO: sobrevivência em Marte. Fase 1: protótipo jogável.
import * as THREE from 'three';
import { CSM } from 'three/addons/csm/CSM.js';
import { GAME } from './config.js';
import { loadSettings, saveSettings, detectTier, TIERS, isTouch } from './settings.js';
import { setCSM, shared } from './materials.js';
import { Terrain, decodeHeightPNG } from './terrain.js';
import { Environment } from './sky.js';
import { initRapier, Physics } from './physics.js';
import { Rocks } from './rocks.js';
import { Player } from './player.js';
import { CameraRig } from './camera.js';
import { Input } from './input.js';
import { Dust, Footprints } from './dust.js';
import { SuitAudio } from './audio.js';
import { buildLander } from './props.js';
import { UI, setupMenus } from './ui.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const SAVE_KEY = 'jezero.save.v1';
const ASSETS = 'assets/';

const settings = loadSettings();
const detected = detectTier();
const tierName = params.get('quality') || (settings.quality === 'auto' ? detected.tier : settings.quality);
const tier = TIERS[tierName] || TIERS.medium;

function fail(err) {
  console.error(err);
  $('error-text').textContent = String(err && (err.stack || err.message) || err);
  $('error').classList.remove('hidden');
  $('loading').classList.add('hidden');
}
window.addEventListener('error', (e) => { if (!window.__jz?.ready) fail(e.error || e.message); });
window.addEventListener('unhandledrejection', (e) => { if (!window.__jz?.ready) fail(e.reason); });

// ---------------------------------------------------------------- carregamento
const progress = { done: 0, total: 1, set(text) { $('load-text').textContent = text; }, tick() { this.done++; $('load-fill').style.width = Math.min(100, this.done / this.total * 100) + '%'; } };

async function loadBitmap(url, raw) {
  const blob = await (await fetch(url)).blob();
  return createImageBitmap(blob, raw ? { colorSpaceConversion: 'none', premultiplyAlpha: 'none' } : {});
}

// 3 camadas (regolito, areia, rocha) numa textura-array: menos amostradores no shader
async function loadArray(kind, srgb) {
  const names = ['regolith', 'sand', 'rock'];
  const bmps = await Promise.all(names.map((n) => loadBitmap(`${ASSETS}textures/${n}_${kind}${tier.tex}.jpg`, !srgb).then((b) => { progress.tick(); return b; })));
  const res = bmps[0].width;
  const cv = document.createElement('canvas'); cv.width = cv.height = res;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const data = new Uint8Array(res * res * 4 * 3);
  bmps.forEach((b, i) => { ctx.clearRect(0, 0, res, res); ctx.drawImage(b, 0, 0, res, res); data.set(ctx.getImageData(0, 0, res, res).data, i * res * res * 4); b.close?.(); });
  const t = new THREE.DataArrayTexture(data, res, res, 3);
  t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true; t.anisotropy = tier.anisotropy;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  t.onUpdate = () => { t.image.data = null; };        // libera a cópia na CPU depois do envio à GPU
  return t;
}

async function loadTex2D(url, srgb) {
  const t = await new THREE.TextureLoader().loadAsync(url);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = tier.anisotropy;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  progress.tick();
  return t;
}

// ---------------------------------------------------------------- jogo
async function main() {
  const canvas = $('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: tier.antialias, powerPreference: 'high-performance', stencil: false });
  if (!renderer.capabilities.isWebGL2) throw new Error('Este navegador não tem WebGL 2.');
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let pixelRatio = Math.min(devicePixelRatio, tier.maxPixelRatio);
  if (params.get('pr')) pixelRatio = parseFloat(params.get('pr'));
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(innerWidth, innerHeight, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.12, tier.far);
  camera.position.set(0, 50, 0);

  progress.total = 4 + 9 + 4 + 2;
  progress.set('Baixando o relevo da cratera Jezero (HiRISE)…');
  const meta = await (await fetch(ASSETS + 'terrain/meta.json')).json();
  progress.tick();
  const [hImg, farImg, maskImg] = await Promise.all([
    decodeHeightPNG(ASSETS + 'terrain/height.png').then((r) => { progress.tick(); return r; }),
    decodeHeightPNG(ASSETS + 'terrain/far.png').then((r) => { progress.tick(); return r; }),
    decodeHeightPNG(ASSETS + 'terrain/mask.png').then((r) => { progress.tick(); return r; }),
  ]);
  progress.set('Carregando texturas do regolito…');
  const [alb, nrm, orm, rockAlb, rockOrm, rockNrm, dustAlb] = await Promise.all([
    loadArray('albedo', true), loadArray('normal', false), loadArray('orm', false),
    loadTex2D(`${ASSETS}textures/rock_albedo${tier.tex}.jpg`, true),
    loadTex2D(`${ASSETS}textures/rock_orm${tier.tex}.jpg`, false),
    loadTex2D(`${ASSETS}textures/rock_normal${tier.tex}.jpg`, false),
    loadTex2D(`${ASSETS}textures/regolith_albedo_1k.jpg`, true),
  ]);
  progress.set('Iniciando o motor de física…');
  await initRapier(); progress.tick();

  // sombras em cascata: nítidas perto, cobrindo longe
  const csm = new CSM({
    maxFar: tier.shadowFar, cascades: tier.cascades, shadowMapSize: tier.shadowMap, lightDirection: new THREE.Vector3(-1, -1, -1).normalize(),
    camera, parent: scene, lightIntensity: 1, lightMargin: 150, lightFar: 1200, shadowBias: -0.00015, mode: 'practical',
  });
  csm.fade = true;
  for (const l of csm.lights) { l.shadow.normalBias = 0.035; l.shadow.camera.layers.enable(1); }
  setCSM(csm);

  progress.set('Montando o terreno…');
  await new Promise((r) => setTimeout(r, 0));
  const maskTex = new THREE.DataTexture(new Uint8Array(maskImg.px.buffer.slice(0)), maskImg.w, maskImg.h, THREE.RGBAFormat);
  maskTex.magFilter = THREE.LinearFilter; maskTex.minFilter = THREE.LinearMipmapLinearFilter; maskTex.generateMipmaps = true; maskTex.needsUpdate = true;
  const terrain = new Terrain(scene, meta, hImg, maskTex, farImg, { alb, nrm, orm }, tier);
  progress.tick();
  const physics = new Physics(terrain);

  const SPAWN = { x: 0, z: 0 };
  const LANDER = { x: -8, z: -11 };
  progress.set('Espalhando rochas…');
  await new Promise((r) => setTimeout(r, 0));
  const rocks = new Rocks(scene, terrain, physics, maskImg, { albedo: rockAlb, orm: rockOrm, normal: rockNrm, dust: dustAlb }, tier,
    [{ x: SPAWN.x, z: SPAWN.z, r: 3 }, { x: LANDER.x, z: LANDER.z, r: 4 }]);
  buildLander(scene, physics, terrain, LANDER);
  progress.tick();

  const env = new Environment(renderer, scene, meta, tier);
  scene.environmentIntensity = 1.0;
  const dust = new Dust(scene, terrain, tier);
  const prints = new Footprints(scene, terrain, tier.footprints);
  const audio = new SuitAudio(); audio.setVolume(settings.volume);
  const ui = new UI(settings);
  const input = new Input(canvas, {
    stickZone: $('stick-zone'), stickBase: $('stick-base'), stickKnob: $('stick-knob'),
    buttons: [...document.querySelectorAll('.tbtn')],
  });
  const rig = new CameraRig(camera, physics, terrain, settings);

  // lanterna do capacete
  const lamp = new THREE.SpotLight(0xfff1dc, 0, 45, 0.5, 0.55, 1.6);
  lamp.castShadow = tier.lampShadow;
  if (lamp.castShadow) { lamp.shadow.mapSize.set(1024, 1024); lamp.shadow.bias = -0.0005; lamp.shadow.camera.near = 0.3; lamp.shadow.camera.layers.enable(1); }
  scene.add(lamp, lamp.target);
  let lampOn = false;

  // compila os shaders antes de mostrar (evita travadas no primeiro quadro)
  progress.set('Compilando shaders…');
  terrain.update(camera, new THREE.Vector3(0, terrain.heightAt(0, 0), 0), 0);
  rocks.update(new THREE.Vector3(0, 0, 0));
  env.update(0.016, camera.position, camera);
  await renderer.compileAsync(scene, camera);
  progress.tick();

  // ---------------------------------------------------------------- estado
  let player = null;
  let playing = false, paused = false;
  const hasSave = () => { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } };
  const save = () => {
    if (!player) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 1, name: player.name, color: player.color, x: player.pos.x, z: player.pos.z, yaw: player.facing,
        camYaw: rig.yaw, hour: env.hour, sol: env.sol, lamp: lampOn, t: Date.now(),
      }));
    } catch { /* sem armazenamento */ }
  };

  function startGame(opts) {
    const s = opts.save;
    player = new Player(scene, physics, terrain, {
      name: opts.name, color: opts.color,
      position: new THREE.Vector3(s ? s.x : SPAWN.x, 0, s ? s.z : SPAWN.z), yaw: s ? s.yaw : Math.PI * 1.85,   // de costas para a câmera
    });
    player.name = opts.name; player.color = opts.color;
    if (s) { env.sol = s.sol; env.setHour(s.hour); rig.yaw = s.camYaw ?? rig.yaw; lampOn = !!s.lamp; }
    else { env.sol = 1; env.setHour(params.has('hour') ? parseFloat(params.get('hour')) : GAME.startHour); rig.yaw = Math.PI * 0.85; }
    settings.lastName = opts.name; saveSettings(settings);
    rig.firstPerson = !!settings.firstPerson;
    player.setFirstPerson(rig.firstPerson);
    ui.showVisor(rig.firstPerson);
    playing = true; paused = false;
    input.enabled = true;
    ui.show(true);
    const touch = isTouch();
    ui.showTouch(touch);
    audio.start();
    audio.beep(660, 0.1); setTimeout(() => audio.beep(990, 0.12), 140);
    ui.toast(s ? `Bem-vindo de volta, ${opts.name}. Sol ${env.sol}.` : 'Sol 1. Cratera Jezero, 18,6° N 77,3° L. Pressão 0,7 kPa, sem ar respirável.', 6);
    if (!settings.helpSeen && !params.has('autostart')) {
      paused = true;
      ui.showHelp(touch, input.usingPad, () => { paused = false; settings.helpSeen = true; saveSettings(settings); });
    }
    save();
  }

  const menus = setupMenus({
    settings, hasSave, detected,
    onNew: (o) => { try { localStorage.removeItem(SAVE_KEY); } catch { /* */ } startGame(o); },
    onContinue: () => { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); startGame({ name: s.name, color: s.color, save: s }); } catch (e) { fail(e); } },
    onSettingsChange: (key) => {
      saveSettings(settings);
      if (key === 'uiScale' || key === 'contrast') ui.applyAccessibility();
      if (key === 'volume') audio.setVolume(settings.volume);
      if (key === 'showFps') ui.toggleFps(settings.showFps);
    },
    onQualityChange: () => { saveSettings(settings); save(); location.reload(); },
    onResume: () => { paused = false; },
    onMainMenu: () => { save(); location.reload(); },
  });
  ui.toggleFps(settings.showFps || params.has('fps'));

  $('btn-pause').onclick = () => { if (playing) { paused = true; document.exitPointerLock?.(); menus.openPause(); } };
  document.addEventListener('pointerlockchange', () => {
    if (playing && !paused && document.pointerLockElement !== canvas && !input.usingTouch && lockedOnce) { paused = true; menus.openPause(); }
    if (document.pointerLockElement === canvas) lockedOnce = true;
  });
  let lockedOnce = false;
  document.addEventListener('visibilitychange', () => { if (document.hidden) { save(); } });
  addEventListener('pagehide', save);
  setInterval(() => { if (playing) save(); }, 20000);

  // ---------------------------------------------------------------- redimensionar
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // tela em pé: campo de visão maior para não perder o horizonte
    camera.fov = w / h < 1 ? 74 : 62;
    camera.updateProjectionMatrix();
    csm.updateFrustums();
    dust.setViewport(h * renderer.getPixelRatio());
  }
  addEventListener('resize', resize);
  resize();

  $('loading').classList.add('hidden');
  if (params.has('autostart')) {
    startGame({ name: params.get('name') || 'Teste', color: '#e8702a' });
    if (params.has('x')) player.teleport(parseFloat(params.get('x')), parseFloat(params.get('z')), params.has('yaw') ? parseFloat(params.get('yaw')) : undefined);
    if (params.has('camyaw')) rig.yaw = parseFloat(params.get('camyaw'));
    if (params.has('pitch')) rig.pitch = parseFloat(params.get('pitch'));
    if (params.has('dist')) rig.dist = rig.targetDist = parseFloat(params.get('dist'));
    if (params.has('fp')) { rig.firstPerson = true; player.setFirstPerson(true); ui.showVisor(true); }
  } else {
    menus.showMain();
  }

  // ---------------------------------------------------------------- laço principal
  const clock = new THREE.Clock();
  let acc = 0, pendingJump = false;
  let fpsAcc = 0, fpsFrames = 0, fps = 0, frameEma = 1 / 60, drTimer = 0, drCooldown = 0;
  const dynamicRes = !params.has('fixedres') && !params.get('pr');
  let nightWarned = false, edgeWarned = false;
  let menuAngle = 0;
  const tmpV = new THREE.Vector3();

  function frame() {
    const rawDt = clock.getDelta();
    const dt = Math.min(rawDt, 0.1);
    const now = clock.elapsedTime;
    input.poll(dt);
    shared.uTime.value = now;

    if (playing) {
      if (input.take('pause')) { paused = !paused; if (paused) { document.exitPointerLock?.(); menus.openPause(); } else menus.hideAll(); }
      if (input.take('fps')) { settings.showFps = !settings.showFps; ui.toggleFps(settings.showFps); saveSettings(settings); }
      if (input.take('help')) ui.showHelp(input.usingTouch, input.usingPad);
    }

    if (playing && !paused) {
      if (input.take('cam')) { const fp = rig.toggle(); player.setFirstPerson(fp); ui.showVisor(fp); audio.beep(fp ? 1200 : 800, 0.05); }
      if (input.take('lamp')) { lampOn = !lampOn; audio.beep(lampOn ? 1500 : 700, 0.05); document.querySelector('[data-act="lamp"]')?.classList.toggle('on', lampOn); }
      env.timeScale = input.timeWarp ? 60 : 1;

      // física em passo fixo (60 Hz), com interpolação visual
      acc += dt; pendingJump = pendingJump || input.jump;
      let steps = 0;
      while (acc >= GAME.fixedDt && steps < 6) {
        player.fixedUpdate(GAME.fixedDt, { moveX: input.moveX, moveY: input.moveY, run: input.run, jump: pendingJump }, rig.yaw);
        pendingJump = false;
        physics.step();
        player.postPhysics();
        acc -= GAME.fixedDt; steps++;
      }
      if (steps === 6) acc = 0;
      player.update(dt, acc / GAME.fixedDt);

      // eventos do astronauta
      for (const e of player.events) {
        if (e.type === 'step') {
          dust.kick(e.x, e.y, e.z, e.run ? 0.8 : 0.35, Math.sin(e.yaw) * e.speed * 0.3, Math.cos(e.yaw) * e.speed * 0.3);
          prints.add(e.x, e.z, e.yaw);
          audio.step(e.run ? 0.8 : 0.45);
        } else if (e.type === 'land') {
          dust.kick(e.x, e.y, e.z, 0.6 + e.impact);
          prints.add(e.x + 0.1, e.z, player.facing); prints.add(e.x - 0.1, e.z, player.facing);
          audio.step(0.6 + e.impact * 0.6);
          rig.kick(e.impact * 0.8);
        } else if (e.type === 'jump') {
          dust.kick(e.x, e.y, e.z, 0.4);
        }
      }
      player.events.length = 0;

      rig.zoom(input.consumeZoom());
      rig.update(dt, player, input.consumeLook());

      // lanterna segue o olhar
      const head = player.headPos;
      lamp.position.copy(head).add(tmpV.set(Math.sin(player.facing) * 0.15, 0.05, Math.cos(player.facing) * 0.15));
      camera.getWorldDirection(tmpV);
      lamp.target.position.copy(lamp.position).addScaledVector(tmpV, 10);
      lamp.intensity = lampOn ? 60 : 0;

      // avisos
      const night = env.sunDir.y < -0.05;
      if (night && !lampOn && !nightWarned) { ui.toast('Está escurecendo. Ligue a lanterna do capacete (L ou botão LUZ).', 6); nightWarned = true; }
      if (!night) nightWarned = false;
      const nearEdge = !terrain.inside(player.pos.x, player.pos.z, 60);
      if (nearEdge && !edgeWarned) { ui.toast('Limite do alcance de rádio do módulo. Volte para a área de pouso.', 5); edgeWarned = true; audio.beep(440, 0.2); }
      if (!nearEdge) edgeWarned = false;

      audio.update(dt, env.windSpeed, Math.min(1, player.moveAmt / 2.9 + (player.grounded ? 0 : 0.3)));
    } else if (!playing) {
      // fundo do menu: câmera girando devagar em volta do módulo de pouso
      menuAngle += dt * 0.05;
      const cx = LANDER.x + Math.sin(menuAngle) * 16, cz = LANDER.z + Math.cos(menuAngle) * 16;
      camera.position.set(cx, terrain.heightAt(cx, cz) + 3.2, cz);
      camera.lookAt(LANDER.x, terrain.heightAt(LANDER.x, LANDER.z) + 1.6, LANDER.z);
      camera.updateMatrixWorld();
    }

    const tscale = playing && !paused ? 1 : (playing ? 0 : 1);
    env.update(dt * tscale, camera.position, camera);
    const focus = player ? player.renderPos : camera.position;
    terrain.update(camera, camera.position, now);
    rocks.update(focus);
    if (tscale) dust.update(dt, env, camera.position);

    // sol → luzes das cascatas
    csm.lightDirection.copy(env.sunDir).negate();
    for (const l of csm.lights) { l.intensity = env.sunIntensity; l.color.copy(env.sunColor); }
    csm.update();

    if (playing) {
      const alt = meta.hmin + player.pos.y;
      ui.update(dt, env, rig.heading, alt);
    }
    renderer.render(scene, camera);

    // FPS e resolução dinâmica
    fpsAcc += rawDt; fpsFrames++;
    frameEma += (rawDt - frameEma) * 0.05;
    if (fpsAcc >= 0.5) {
      fps = fpsFrames / fpsAcc; fpsAcc = 0; fpsFrames = 0;
      if (settings.showFps || params.has('fps')) {
        const inf = renderer.info.render;
        ui.setFps(`${fps.toFixed(0)} FPS · ${tierName}\nres ${(renderer.getPixelRatio()).toFixed(2)}x · ${inf.calls} draws\n${(inf.triangles / 1000).toFixed(0)}k tri`);
      }
    }
    if (dynamicRes && playing) {
      drTimer += rawDt; drCooldown -= rawDt;
      if (drTimer > 1.5) {
        drTimer = 0;
        const pr = renderer.getPixelRatio();
        const maxPr = Math.min(devicePixelRatio, tier.maxPixelRatio);
        if (frameEma > 1 / 48 && pr > tier.minPixelRatio) { renderer.setPixelRatio(Math.max(tier.minPixelRatio, pr * 0.85)); resize(); drCooldown = 12; }
        else if (frameEma < 1 / 57 && pr < maxPr && drCooldown <= 0) { renderer.setPixelRatio(Math.min(maxPr, pr * 1.08)); resize(); drCooldown = 3; }
      }
    }
    window.__jz.fps = fps; window.__jz.frames = (window.__jz.frames || 0) + 1;
    requestAnimationFrame(frame);
  }

  // API de depuração/testes automáticos
  // simulação sem renderizar (testes automáticos de física e jogabilidade)
  const simulate = (seconds, inp = {}) => {
    const n = Math.round(seconds / GAME.fixedDt);
    let jump = !!inp.jump;
    for (let i = 0; i < n; i++) {
      player.fixedUpdate(GAME.fixedDt, { moveX: inp.moveX || 0, moveY: inp.moveY || 0, run: !!inp.run, jump }, inp.yaw ?? rig.yaw);
      jump = false;
      physics.step();
      player.postPhysics();
      player.update(GAME.fixedDt, 1);
      player.events.length = 0;
    }
    return { x: player.pos.x, y: player.pos.y, z: player.pos.z, grounded: player.grounded, ground: terrain.heightAt(player.pos.x, player.pos.z), rescues: player.rescues, lastJumpHeight: player.lastJumpHeight, lastAirTime: player.lastAirTime, speed: player.moveAmt };
  };
  window.__jz = {
    ready: true, simulate, THREE, env, terrain, physics, rocks, dust, renderer, scene, camera, rig, tierName, meta,
    get player() { return player; },
    setHour: (h) => env.setHour(h),
    teleport: (x, z, yaw) => player?.teleport(x, z, yaw),
    stats: () => ({ fps, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, pixelRatio: renderer.getPixelRatio(), rocks: rocks.list.length, rockColliders: rocks.colliders, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries }),
    input,
  };
  requestAnimationFrame(frame);
}

main().catch(fail);
