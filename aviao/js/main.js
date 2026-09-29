// CÉU DO RIO: simulador de Cessna 172 sobre o Rio de Janeiro. Fase 1: protótipo de voo.
import * as THREE from 'three';
import { CSM } from 'three/addons/csm/CSM.js';
import { KT, FT, FPM } from './config.js';
import { loadSettings, saveSettings, detectTier, TIERS, isTouch } from './settings.js';
import { setCSM, shared } from './materials.js';
import { Terrain, decodePNG } from './terrain.js';
import { Buildings, loadBuildings } from './buildings.js';
import { Runways } from './runways.js';
import { buildLandmarks } from './landmarks.js';
import { Environment } from './sky.js';
import { Clouds } from './clouds.js';
import { FlightModel } from './flight.js';
import { buildAircraft } from './aircraft.js';
import { Panel } from './instruments.js';
import { CameraRig, MODE_LABEL } from './camera.js';
import { FlightInput } from './input.js';
import { FlightAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const A = 'assets/';
const settings = loadSettings();
const detected = detectTier();
const tierName = params.get('quality') || (settings.quality === 'auto' ? detected.tier : settings.quality);
const tier = TIERS[tierName] || TIERS.medium;
const D2R = Math.PI / 180;

function fail(err) {
  console.error(err);
  $('error-text').textContent = String(err && (err.stack || err.message) || err);
  $('error').classList.remove('hidden'); $('loading').classList.add('hidden');
}
addEventListener('error', (e) => { if (!window.__cr?.ready) fail(e.error || e.message); });
addEventListener('unhandledrejection', (e) => { if (!window.__cr?.ready) fail(e.reason); });

let loaded = 0; const TOTAL = 12;
const tick = (text) => { loaded++; $('load-fill').style.width = Math.min(100, loaded / TOTAL * 100) + '%'; if (text) $('load-text').textContent = text; };
async function tex(url, srgb, opts = {}) {
  const t = await new THREE.TextureLoader().loadAsync(url);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = tier.anisotropy;
  t.wrapS = t.wrapT = opts.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  tick(); return t;
}

async function main() {
  const canvas = $('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: tier.antialias, powerPreference: 'high-performance', logarithmicDepthBuffer: true, stencil: false });
  if (!renderer.capabilities.isWebGL2) throw new Error('Este navegador não tem WebGL 2.');
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(params.get('pr') ? parseFloat(params.get('pr')) : Math.min(devicePixelRatio, tier.maxPixelRatio));
  renderer.setSize(innerWidth, innerHeight, false);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.05, tier.far);
  if (isTouch()) document.body.classList.add('touch');

  $('load-text').textContent = 'Baixando o relevo do Rio (Copernicus 30 m)…';
  const meta = await (await fetch(A + 'terrain/meta.json')).json(); tick();
  const [hImg, farImg, maskImg, fwImg] = await Promise.all([
    decodePNG(A + 'terrain/height.png').then((r) => { tick(); return r; }),
    decodePNG(A + 'terrain/far.png').then((r) => { tick(); return r; }),
    decodePNG(A + 'terrain/mask.png').then((r) => { tick(); return r; }),
    decodePNG(A + 'terrain/far_water.png').then((r) => { tick(); return r; }),
  ]);
  $('load-text').textContent = 'Baixando a imagem de satélite (Sentinel-2)…';
  const [sat, satFar, detailLum, detailN, waterN, asphalt, bList] = await Promise.all([
    tex(A + `textures/sat_near${tier.sat}.jpg`, true, { clamp: true }), tex(A + 'textures/sat_far.jpg', true, { clamp: true }),
    tex(A + 'textures/detail_lum.jpg', false), tex(A + 'textures/detail_normal.jpg', false), tex(A + 'textures/water_normal.jpg', false),
    tex(A + 'textures/asphalt.jpg', true), loadBuildings(A + 'terrain/buildings.bin'),
  ]);
  // a imagem tem a linha 0 ao norte (z = −metade), igual às máscaras: sem inverter o eixo vertical
  sat.flipY = false; satFar.flipY = false; sat.needsUpdate = true; satFar.needsUpdate = true;
  const maskTex = new THREE.DataTexture(new Uint8Array(maskImg.px), maskImg.w, maskImg.h, THREE.RGBAFormat);
  maskTex.minFilter = THREE.LinearMipmapLinearFilter; maskTex.magFilter = THREE.LinearFilter; maskTex.generateMipmaps = true; maskTex.needsUpdate = true;
  const fwTex = new THREE.DataTexture(new Uint8Array(fwImg.px), fwImg.w, fwImg.h, THREE.RGBAFormat);
  fwTex.minFilter = THREE.LinearFilter; fwTex.magFilter = THREE.LinearFilter; fwTex.needsUpdate = true;

  const csm = new CSM({ maxFar: tier.shadowFar, cascades: tier.cascades, shadowMapSize: tier.shadowMap, lightDirection: new THREE.Vector3(-1, -1, -1).normalize(), camera, parent: scene, lightIntensity: 3, lightMargin: 400, lightFar: 6000, shadowBias: -0.0001, mode: 'practical' });
  csm.fade = true;
  for (const l of csm.lights) l.shadow.normalBias = 0.05;
  setCSM(csm);

  $('load-text').textContent = 'Montando a cidade…';
  await new Promise((r) => setTimeout(r, 0));
  const terrain = new Terrain(scene, meta, hImg, farImg, maskImg, fwImg, { sat, satFar, mask: maskTex, farWater: fwTex, detailLum, detailN, waterN }, tier); tick();
  const buildings = new Buildings(scene, terrain, bList, tier);
  const runways = new Runways(scene, terrain, meta.runways, asphalt, tier);
  const landmarkCols = [];
  buildLandmarks(scene, terrain, meta, landmarkCols);
  const env = new Environment(renderer, scene, meta, tier);
  const clouds = new Clouds(scene, tier);

  // avião
  const plane = buildAircraft('#1f4fa8', 'PR-JZR');
  scene.add(plane.root);
  const panel = new Panel(plane.panelCanvas);
  const world = {
    groundAt: (x, z) => {
      const h = terrain.heightAt(x, z);
      return { h, water: h < 2.5 && terrain.isWater(x, z) };
    },
    buildingHit: (p) => {
      if (p.y > 420) return false;
      if (buildings.hit(p)) return true;
      for (const c of landmarkCols) {
        const d = Math.hypot(p.x - c.x, p.z - c.z);
        if (d < c.r && p.y < c.top && (!c.bottom || p.y > c.bottom)) return c.deck ? d < 14 : true;
      }
      return false;
    },
  };
  const fm = new FlightModel(world);
  const rig = new CameraRig(camera, terrain, settings);
  const input = new FlightInput(canvas, {
    stickZone: $('stick-zone'), stickBase: $('stick-base'), stickKnob: $('stick-knob'),
    throttleBar: $('throttle-bar'), throttleFill: $('throttle-fill'), buttons: [...document.querySelectorAll('.tbtn')],
  }, settings);
  const audio = new FlightAudio(); audio.setVolume(settings.volume);

  // pré-compila shaders
  $('load-text').textContent = 'Compilando shaders…';
  camera.position.set(0, 800, 3000); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  terrain.update(camera.position, 0); buildings.update(camera.position);
  env.update(0, camera);
  await renderer.compileAsync(scene, camera); tick();

  // ---------------------------------------------------------------- partidas
  const M_LAT = Math.PI / 180 * 6371000, M_LON = M_LAT * Math.cos(meta.lat0 * D2R);
  const ll = (lat, lon) => ({ x: (lon - meta.lon0) * M_LON, z: -(lat - meta.lat0) * M_LAT });
  let lastStart = null;
  function placeStart(key) {
    lastStart = key;
    fm.ctl.flaps = 0; fm.ctl.trim = 0; fm.ctl.brake = 0; input.trim = 0;
    Object.assign(fm.ctl, { elevator: 0, aileron: 0, rudder: 0 });
    const onRunway = (ident) => {
      const s = runways.lineup(ident);
      fm.reset(new THREE.Vector3(s.x, terrain.heightAt(s.x, s.z) + 1.33, s.z), s.heading, 0, true);
      fm.ctl.throttle = input.throttle = 0; fm.flapDeg = 0;
      towerFor(s.r);
    };
    if (key === 'sdu20') onRunway('20L');
    else if (key === 'sdu02') onRunway('02R');
    else if (key === 'gig10') onRunway('10');
    else if (key === 'air-copa') {
      const p = ll(-22.972, -43.182);
      fm.reset(new THREE.Vector3(p.x, 457, p.z), 60 * D2R, 52, false); input.throttle = 0.68; input.trim = 0.05;
      towerFor(runways.list.find((r) => r.le === '02R'));
    } else if (key === 'final-sdu') {
      // final da 20L chegando pelo norte, sobre a baía (a reta da 02 passa colada no Pão de Açúcar)
      const r = runways.list.find((q) => q.he === '20L');
      const d = 5556;
      const x = r.x2 + r.ux * d, z = r.z2 + r.uz * d;
      fm.reset(new THREE.Vector3(x, r.elev + d * Math.tan(3 * D2R) + 15, z), r.heading + Math.PI, 36, false);
      input.throttle = 0.32; input.trim = 0.75; fm.ctl.flaps = 2; fm.flapDeg = 20;
      towerFor(r);
    } else if (key === 'cristo') {
      const c = meta.landmarks.cristo.world || meta.landmarks.cristo;
      fm.reset(new THREE.Vector3(c.x - 200, 762, c.z + 1600), -5 * D2R, 50, false); input.throttle = 0.66; input.trim = 0.05;
      towerFor(runways.list.find((r) => r.le === '02R'));
    }
    fm.ctl.trim = input.trim;
    const w = { calmo: [0, 0], moderado: [10, 0.4], forte: [20, 1.2] }[settings.wind] || [0, 0];
    // vento de sudeste (vem de 135°): sopra para noroeste
    const from = 135 * D2R, spd = w[0] / KT;
    fm.wind.set(-Math.sin(from) * spd, 0, Math.cos(from) * spd);
    fm.turb = w[1] * 1.6;
  }
  const tower = new THREE.Vector3();
  // torres de controle reais (Santos Dumont e Galeão); a câmera fica acima dos telhados vizinhos
  const TOWERS = { SBRJ: ll(-22.9107, -43.1659), SBGL: ll(-22.8137, -43.2489) };
  function towerFor(r) {
    const t = TOWERS[r.airport] || { x: (r.x1 + r.x2) / 2, z: (r.z1 + r.z2) / 2 };
    let top = terrain.heightAt(t.x, t.z) + 32;
    for (const b of buildings.list) if (Math.hypot(b.x - t.x, b.z - t.z) < 90) top = Math.max(top, b.top + 8);
    tower.set(t.x, top, t.z);
  }
  function applyTime() {
    const map = { manha: 8.5, meio: 12, tarde: 15.5, por: 17.67, noite: 20 };
    if (settings.time === 'agora') env.setLocalTime(((new Date().getUTCHours() - 3 + 24) % 24) + new Date().getUTCMinutes() / 60);
    else env.setLocalTime(map[settings.time] ?? 8.5);
    const cover = { limpo: 0.0, poucas: 0.35, nublado: 0.85 }[settings.weather] ?? 0.35;
    clouds.generate(cover, settings.weather === 'nublado' ? 700 : 950);
    env.visibility = settings.weather === 'nublado' ? 25000 : settings.weather === 'poucas' ? 55000 : 70000;
  }

  // ---------------------------------------------------------------- UI
  let playing = false, paused = false, lightsOn = settings.lights, crashTimer = -1;
  const screens = ['menu', 'credits', 'settings', 'crash'];
  const show = (id) => screens.forEach((s) => $(s).classList.toggle('hidden', s !== id));
  const hideAll = () => screens.forEach((s) => $(s).classList.add('hidden'));
  const bindSel = (id, key) => { const el = $(id); el.value = settings[key]; el.onchange = () => { settings[key] = el.value; saveSettings(settings); }; };
  bindSel('m-start', 'start'); bindSel('m-time', 'time'); bindSel('m-weather', 'weather'); bindSel('m-wind', 'wind'); bindSel('m-assist', 'assist');
  let toastT = 0;
  const toast = (m, s = 4) => { $('toast').textContent = m; $('toast').classList.add('show'); toastT = s; };

  function startFlight() {
    hideAll(); applyTime(); placeStart(settings.start);
    playing = true; paused = false; input.enabled = true; crashTimer = -1;
    $('hud').classList.remove('hidden');
    $('touch').classList.toggle('hidden', !isTouch());
    audio.start();
    if (settings.tilt) input.enableTilt();
    const names = { sdu20: 'Santos Dumont, pista 20L. Potência máxima e puxe a 55 nós.', sdu02: 'Santos Dumont, pista 02R. Potência máxima e puxe a 55 nós.', gig10: 'Galeão, pista 10. Pista longa, bom para treinar.', 'air-copa': 'Sobre Copacabana a 1.500 pés.', 'final-sdu': 'Final para a pista 20L, 3 milhas. Siga as luzes PAPI: duas brancas e duas vermelhas.', cristo: 'Perto do Corcovado a 2.500 pés.' };
    toast(names[settings.start] || '', 6);
    $('camlabel').textContent = MODE_LABEL[rig.mode];
    if (!settings.helpSeen && !params.has('autostart')) { paused = true; showHelp(() => { paused = false; settings.helpSeen = true; saveSettings(settings); }); }
  }
  function showHelp(cb) {
    $('help-body').innerHTML = isTouch()
      ? 'Manche à direita: puxe para subir, para os lados para inclinar<br>Barra à esquerda: potência (manete)<br>FLAPE +/−, FREIO, LEME e CÂM na parte de baixo<br>Arraste no céu para olhar em volta'
      : '<kbd>W</kbd>/<kbd>S</kbd> ou <kbd>↑</kbd>/<kbd>↓</kbd>: empurrar ou puxar o manche · <kbd>A</kbd>/<kbd>D</kbd>: inclinar<br><kbd>Q</kbd>/<kbd>E</kbd>: leme · <kbd>Shift</kbd>/<kbd>Ctrl</kbd>: potência · <kbd>1</kbd>, <kbd>9</kbd> e <kbd>0</kbd>: marcha lenta, 75% e máxima<br><kbd>F</kbd>/<kbd>V</kbd>: baixar ou subir o flape · <kbd>B</kbd>: freio · <kbd>[</kbd>/<kbd>]</kbd>: compensador<br><kbd>C</kbd>: câmera · arrastar o mouse: olhar · roda: zoom · <kbd>L</kbd>: luzes · <kbd>R</kbd>: reiniciar · <kbd>T</kbd>: acelerar o tempo · <kbd>Esc</kbd>: pausa<br>Gamepad e manche USB também funcionam.';
    $('help').classList.remove('hidden');
    $('help-ok').onclick = () => { $('help').classList.add('hidden'); cb?.(); };
  }
  $('btn-fly').onclick = startFlight;
  $('btn-credits').onclick = () => show('credits');
  document.querySelector('#credits [data-close]').onclick = () => show('menu');
  let settingsFrom = 'menu';
  const openSettings = (from) => { settingsFrom = from; $('set-restart').classList.toggle('hidden', from !== 'game'); $('set-menu').classList.toggle('hidden', from !== 'game'); $('set-title').textContent = from === 'game' ? 'Pausa' : 'Configurações'; show('settings'); };
  $('btn-settings-menu').onclick = () => openSettings('menu');
  $('btn-pause').onclick = () => { if (playing) { paused = true; openSettings('game'); } };
  $('set-close').onclick = () => { if (settingsFrom === 'game') { hideAll(); paused = false; } else show('menu'); };
  $('set-restart').onclick = () => { hideAll(); placeStart(lastStart || settings.start); paused = false; };
  $('set-menu').onclick = () => location.reload();
  $('crash-retry').onclick = () => { hideAll(); placeStart(lastStart || settings.start); paused = false; crashTimer = -1; };
  $('crash-menu').onclick = () => location.reload();
  const q = $('set-quality');
  const qInfo = () => { const t = settings.quality === 'auto' ? detected.tier : settings.quality; $('set-quality-info').textContent = `Em uso: ${TIERS[t].label}${settings.quality === 'auto' ? ' (automática)' : ''}. GPU: ${detected.gpu || 'desconhecida'}. Trocar recarrega o jogo.`; };
  q.value = settings.quality; qInfo();
  q.onchange = () => { settings.quality = q.value; saveSettings(settings); location.reload(); };
  const bind = (id, key, prop = 'checked', cb) => { const el = $(id); el[prop] = settings[key]; el.oninput = () => { settings[key] = prop === 'checked' ? el.checked : parseFloat(el.value); saveSettings(settings); cb?.(); }; };
  bind('set-fps', 'showFps', 'checked', () => $('fps').classList.toggle('hidden', !settings.showFps));
  bind('set-sens', 'sensitivity', 'value'); bind('set-invert', 'invertPitch');
  bind('set-tilt', 'tilt', 'checked', () => { if (settings.tilt) input.enableTilt(); });
  $('set-recenter').onclick = () => input.recenterTilt();
  const applyUi = () => { document.documentElement.style.setProperty('--ui', settings.uiScale); document.documentElement.classList.toggle('contrast', settings.contrast); };
  bind('set-ui', 'uiScale', 'value', applyUi); bind('set-contrast', 'contrast', 'checked', applyUi); applyUi();
  bind('set-vol', 'volume', 'value', () => audio.setVolume(settings.volume));
  $('fps').classList.toggle('hidden', !(settings.showFps || params.has('fps')));

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); csm.updateFrustums();
  }
  addEventListener('resize', resize); resize();

  $('loading').classList.add('hidden');
  if (params.has('autostart')) {
    if (params.get('start')) settings.start = params.get('start');
    if (params.get('time')) settings.time = params.get('time');
    if (params.get('weather')) settings.weather = params.get('weather');
    startFlight();
  } else show('menu');

  // ---------------------------------------------------------------- simulação
  const FIXED = 1 / 240;
  let acc = 0;
  function controls(dt) {
    input.poll(dt);
    const fl = input.consumeFlaps();
    if (fl) { fm.ctl.flaps = THREE.MathUtils.clamp(fm.ctl.flaps + fl, 0, 3); audio.beep(fl > 0 ? 500 : 700, 0.12); toast(`Flapes ${[0, 10, 20, 30][fm.ctl.flaps]}°`, 1.5); }
    let pitch = input.pitchCmd, roll = input.roll, yaw = input.yaw;
    const o = fm.out;
    const air = !fm.onGround || (o.ias || 0) > 25;
    if (settings.assist !== 'off' && air) {
      // leme automático: anula a derrapagem e amortece a guinada
      yaw = THREE.MathUtils.clamp(yaw + (o.beta || 0) * 4 - (o.r || 0) * 0.3, -1, 1);
    }
    if (settings.assist === 'full' && !fm.onGround) {
      if (Math.abs(roll) < 0.05) roll = THREE.MathUtils.clamp(-(o.roll || 0) * 1.4 - (o.p || 0) * 0.35, -0.6, 0.6);
      pitch = THREE.MathUtils.clamp(pitch - fm.omega.x * 0.35, -1, 1);
    }
    fm.ctl.elevator = pitch; fm.ctl.aileron = roll; fm.ctl.rudder = yaw;
    fm.ctl.throttle = input.throttle; fm.ctl.brake = input.brake; fm.ctl.trim = input.trim;
  }

  function step(dt) {
    acc += Math.min(dt, 0.1);
    while (acc >= FIXED) { fm.step(FIXED); acc -= FIXED; }
  }

  function handleEvents() {
    for (const e of fm.events) {
      if (e.type === 'touchdown') {
        const f = Math.round(e.fpm);
        const grade = f > -120 ? 'Manteiga! Pouso perfeito' : f > -300 ? 'Pouso suave' : f > -500 ? 'Pouso firme' : 'Pouso duro';
        toast(`${grade}: ${f} pés/min a ${Math.round(e.speed * KT)} nós`, 5);
        audio.burst('chirp', Math.min(1.5, -f / 300 + 0.3));
        rig.shake(Math.min(0.6, -f / 900));
      } else if (e.type === 'crash') {
        audio.burst('crash'); rig.shake(1); crashTimer = 1.4;
        $('crash-text').textContent = e.reason + ` Velocidade no impacto: ${Math.round(e.speed * KT)} nós.`;
      }
    }
    fm.events.length = 0;
  }

  // ---------------------------------------------------------------- laço
  const clock = new THREE.Clock();
  let fpsAcc = 0, fpsN = 0, fps = 0, panelT = 0, hudT = 0, menuT = 0, ema = 1 / 60, drT = 0, drCool = 0;
  const dynRes = !params.has('fixedres') && !params.get('pr');
  function frame() {
    const raw = clock.getDelta(), dt = Math.min(raw, 0.1), now = clock.elapsedTime;
    shared.uTime.value = now;
    if (playing) {
      if (input.take('pause')) { paused = !paused; if (paused) openSettings('game'); else hideAll(); }
      if (input.take('help')) showHelp();
      if (input.take('fps')) { settings.showFps = !settings.showFps; $('fps').classList.toggle('hidden', !settings.showFps); }
    }
    if (playing && !paused) {
      controls(dt);
      if (input.take('cam')) { const m = rig.next(); $('camlabel').textContent = MODE_LABEL[m]; }
      if (input.take('lights')) { lightsOn = !lightsOn; settings.lights = lightsOn; saveSettings(settings); toast(lightsOn ? 'Luzes ligadas' : 'Luzes desligadas', 1.5); }
      if (input.take('reset')) { placeStart(lastStart || settings.start); crashTimer = -1; hideAll(); }
      if (input.take('engine')) { fm.engineOn = !fm.engineOn; toast(fm.engineOn ? 'Motor ligado' : 'Motor desligado (simulação de pane)', 2.5); }
      env.timeScale = input.timeWarp ? 120 : 1;
      step(dt);
      handleEvents();
      if (crashTimer > 0) { crashTimer -= dt; if (crashTimer <= 0) { paused = true; show('crash'); } }
    }
    // avião na cena
    plane.root.position.copy(fm.pos); plane.root.quaternion.copy(fm.quat);
    plane.update(fm, playing && !paused ? dt : 0, now, lightsOn || env.night > 0.5);
    if (playing) {
      rig.zoom(input.consumeZoom());
      rig.update(dt, fm, input.consumeLook(), tower);
    } else {
      // fundo do menu: câmera girando sobre a baía de Guanabara, de olho no Pão de Açúcar
      menuT += dt * 0.03;
      const pa = meta.landmarks.paodeacucar;
      camera.position.set(pa.x + Math.sin(menuT) * 2600, 520, pa.z + Math.cos(menuT) * 2600);
      camera.lookAt(pa.x, 180, pa.z); camera.fov = 55; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    }
    const inside = playing && rig.mode === 'cabine';
    plane.cockpit.visible = inside;
    env.update(playing && !paused ? dt : dt * 0.2, camera);
    terrain.update(camera.position, now);
    buildings.update(camera.position);
    runways.update(env.night, innerHeight * renderer.getPixelRatio());
    clouds.update(dt, camera.position, env, fm.wind);
    csm.lightDirection.copy(env.sunDir).negate();
    for (const l of csm.lights) { l.intensity = env.sunIntensity; l.color.copy(env.sunColor); }
    csm.update();

    if (playing) {
      const o = fm.out;
      audio.update(o, inside, fm.onGround, !!o.stallWarn && !fm.crashed);
      panelT += dt;
      if (inside && panelT > 1 / 15) { panelT = 0; panel.draw(o, fm.ctl, env.night); plane.panelTex.needsUpdate = true; plane.panelMesh.material.emissiveIntensity = env.night * 0.25; }
      hudT += dt;
      if (hudT > 0.08) {
        hudT = 0;
        $('h-ias').textContent = Math.round((o.ias || 0) * KT);
        $('h-alt').textContent = Math.round((o.alt || 0) * FT).toLocaleString('pt-BR');
        $('h-vs').textContent = Math.round(((o.vs || 0) * FPM) / 10) * 10;
        $('h-hdg').textContent = String(Math.round((o.heading || 0) / D2R) % 360).padStart(3, '0');
        $('h-thr').style.width = Math.round(fm.ctl.throttle * 100) + '%'; $('h-thr-t').textContent = Math.round(fm.ctl.throttle * 100) + '%';
        $('h-flaps').textContent = Math.round(fm.flapDeg) + '°';
        $('h-trim').textContent = (fm.ctl.trim > 0 ? '+' : '') + Math.round(fm.ctl.trim * 100);
        $('h-rpm').textContent = Math.round(o.rpm || 0);
        $('warn').classList.toggle('hidden', !(o.stallWarn && !fm.crashed));
      }
      if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.remove('show'); }
    }
    renderer.render(scene, camera);

    fpsAcc += raw; fpsN++; ema += (raw - ema) * 0.05;
    if (fpsAcc > 0.5) {
      fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
      if (settings.showFps || params.has('fps')) { const i = renderer.info.render; $('fps').textContent = `${fps.toFixed(0)} FPS · ${tierName}\nres ${renderer.getPixelRatio().toFixed(2)}x · ${i.calls} draws\n${(i.triangles / 1000).toFixed(0)}k tri`; }
    }
    if (dynRes && playing) {
      drT += raw; drCool -= raw;
      if (drT > 1.5) {
        drT = 0; const pr = renderer.getPixelRatio(), maxPr = Math.min(devicePixelRatio, tier.maxPixelRatio);
        if (ema > 1 / 48 && pr > tier.minPixelRatio) { renderer.setPixelRatio(Math.max(tier.minPixelRatio, pr * 0.85)); resize(); drCool = 12; }
        else if (ema < 1 / 57 && pr < maxPr && drCool <= 0) { renderer.setPixelRatio(Math.min(maxPr, pr * 1.08)); resize(); drCool = 3; }
      }
    }
    window.__cr.frames = (window.__cr.frames || 0) + 1; window.__cr.fps = fps;
    requestAnimationFrame(frame);
  }

  // API para testes automáticos
  window.__cr = {
    ready: true, THREE, fm, terrain, buildings, runways, env, rig, camera, renderer, scene, meta, input, tierName, clouds,
    placeStart: (k) => placeStart(k),
    pause: (v) => { paused = v; },
    setCam: (m) => { rig.mode = m; $('camlabel').textContent = MODE_LABEL[m]; },
    setHour: (h) => env.setLocalTime(h),
    simulate(seconds, ctl = {}, auto) {
      const n = Math.round(seconds / FIXED);
      for (let i = 0; i < n && !fm.crashed; i++) {
        Object.assign(fm.ctl, ctl);
        if (auto) auto(fm, i * FIXED);
        fm.step(FIXED);
      }
      const ev = fm.events.slice(); fm.events.length = 0;
      return { x: fm.pos.x, y: fm.pos.y, z: fm.pos.z, ias: fm.out.ias * KT, alt: fm.out.alt * FT, vs: fm.out.vs * FPM, onGround: fm.onGround, crashed: fm.crashed, events: ev, pitch: fm.out.pitch / D2R, roll: fm.out.roll / D2R, hdg: fm.out.heading / D2R };
    },
    stats: () => ({ fps, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, pixelRatio: renderer.getPixelRatio(), buildings: bList.length, textures: renderer.info.memory.textures }),
  };
  requestAnimationFrame(frame);
}

main().catch(fail);
