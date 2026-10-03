// GOLAÇO — inicialização, renderer, pós-processamento, qualidade automática,
// laço de jogo com passo fixo de 60 Hz, eventos (áudio/HUD/estádio/câmera) e replay.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { QUALITY, DEFAULT_SETTINGS, PITCH, clamp } from './config.js';
import { Match } from './match.js';
import { Input, isTouchDevice } from './input.js';
import { CameraRig } from './camera.js';
import { Hud } from './hud.js';
import { Replay } from './replay.js';
import { BallMesh } from './ballmesh.js';
import { GameAudio } from './audio.js';
import { buildStadium } from './stadium.js';
import { PlayerMeshes, preloadHeads, preloadBody } from './players3d.js';
import { rootOffset, setMocap } from './anim.js';
let mocapLoaded = false;
import { StadiumFX } from './fx.js';
import { loadFacePool, matchFaces, portrait } from './faces.js';
import { CameraBlurPass } from './motionblur.js';
import { MobilePost, installMaterialGrade } from './mobilepost.js';
import { SunShadowFit, aimDaySun } from './sunshadow.js';
import { initMenus, showMainMenu, showPause, hidePause, showMatchResult } from './menus.js';

const $ = (id) => document.getElementById(id);
const canvas = $('c');
const SKEY = 'golaco.settings';
const STEP = 1 / 60;

// ------------------------------------------------------------ configurações
function loadSettings() {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SKEY) || '{}') }; } catch { return { ...DEFAULT_SETTINGS }; }
}
let settings = loadSettings();
function saveSettings(s) {
  settings = { ...settings, ...s };
  try { localStorage.setItem(SKEY, JSON.stringify(settings)); } catch { /* sem armazenamento */ }
  audio.setVolumes({ master: settings.volMaster, crowd: settings.volCrowd, sfx: settings.volSfx });
  if (game) { game.rig.setMode(settings.camera); applyQuality(true); }
}

// Qualidade automática: aparelho + medição de FPS com resolução dinâmica.
const touch = isTouchDevice();
function autoPreset() {
  const mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
  const small = Math.min(screen.width, screen.height) < 500;
  // iOS não informa memória; celulares atuais aguentam bem o preset alto com
  // resolução dinâmica. Só aparelhos claramente fracos caem para média/baixa.
  if (touch || small) return (navigator.deviceMemory && navigator.deviceMemory < 3) || cores <= 4 ? 'baixa' : 'media';
  // ultra (GTAO, sombra 4096) só quando o jogador escolhe: em muitas placas de PC ela
  // derrubava o jogo para poucos quadros por segundo
  return cores >= 6 && mem >= 8 ? 'alta' : 'media';
}
let presetKey = settings.quality === 'auto' ? autoPreset() : settings.quality;
let Q = QUALITY[presetKey];

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.info.autoReset = false;
let dynScale = 1;
// correção de cor dentro do tonemapping dos materiais (qualidade baixa, sem passe extra)
installMaterialGrade();
// vinheta da qualidade baixa: gradiente CSS sobre o canvas (o compositor do navegador
// desenha de graça; nada de passe de tela cheia no WebGL)
const vignette = document.createElement('div');
vignette.id = 'vinheta';
vignette.style.cssText = 'position:fixed;inset:0;pointer-events:none;display:none;background:radial-gradient(ellipse 75% 85% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,.30) 100%)';
canvas.after(vignette);
{ const st = document.createElement('style'); st.textContent = 'body:not(.in-game) #vinheta{display:none!important}'; document.head.appendChild(st); }
let vignetteOn = false;
function setVignette(on) { if (on !== vignetteOn) { vignetteOn = on; vignette.style.display = on ? 'block' : 'none'; } }

function applyQuality(rebuildPost) {
  presetKey = settings.quality === 'auto' ? presetKey : settings.quality;
  Q = QUALITY[presetKey];
  const pr = clamp(Math.min(devicePixelRatio, Q.maxPR) * Q.pixelRatio * dynScale, 0.5, 3);
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.shadowMap.enabled = Q.shadows;
  // baixa: ACES + cor no próprio material; demais: ACES (a cor vem do pós)
  renderer.toneMapping = Q.grade === 'material' ? THREE.CustomToneMapping : THREE.ACESFilmicToneMapping;
  // PCF simples = 9 leituras (vs 17 do PCFSoft): bem mais barato no celular
  renderer.shadowMap.type = Q.shadowSoft === false ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  setVignette(!!game && Q.grade === 'material');
  if (game) {
    // sombra do sol/refletores seguindo o enquadramento (texel estável)
    const L = game.stadium.mainLight;
    if (!game.sunFit && L && !game.stadium.isNight && (settings.timeOfDay || 'noite') === 'dia' && !game.sunAimed) { game.sunAimed = true; aimDaySun(game.stadium, game.scene); }
    if (!game.sunFit && L && L.castShadow) game.sunFit = new SunShadowFit(L, game.stadium.sunDir, { halfL: PITCH.halfL + 4, halfW: PITCH.halfW + 4 });
    if (L && L.castShadow && L.shadow.mapSize.x !== Q.shadowSize) { L.shadow.mapSize.set(Q.shadowSize, Q.shadowSize); L.shadow.map?.dispose(); L.shadow.map = null; }
    if (L && L.castShadow) L.shadow.radius = Q.shadowSoft === false ? 1 : 2;
    game.camera.aspect = innerWidth / innerHeight; game.camera.updateProjectionMatrix();
    game.rig.aspect = game.camera.aspect;
    if (rebuildPost) buildPost();
    else if (game.composer) { game.composer.setPixelRatio(pr); game.composer.setSize(innerWidth, innerHeight); }
  }
}
addEventListener('resize', () => applyQuality(false));
addEventListener('orientationchange', () => setTimeout(() => applyQuality(false), 200));

function buildPost() {
  const g = game;
  if (g.composer) { g.composer.dispose?.(); g.composer = null; }
  g.mblur = null;
  // celular (média): um passe final só (ACES + cor + vinheta + nitidez + bloom barato)
  if (Q.lite && !Q.post) {
    g.composer = new MobilePost(renderer, g.scene, g.camera, {
      night: !!(g.stadium && g.stadium.isNight), bloom: !!Q.liteBloom, sharpen: Q.sharpen || 0, msaa: Q.msaa,
    });
    return;
  }
  if (!Q.post) return;
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const blur = !touch && settings.motionBlur !== false;
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: Q.msaa ? 4 : 0 });
  if (blur) rt.depthTexture = new THREE.DepthTexture(size.x, size.y);
  const comp = new EffectComposer(renderer, rt);
  comp.addPass(new RenderPass(g.scene, g.camera));
  // desfoque de movimento da câmera (lê a profundidade da cena recém-desenhada)
  g.mblur = null;
  if (blur) { g.mblur = new CameraBlurPass(g.camera, 0.55); comp.addPass(g.mblur); }
  // oclusão de ambiente (contato dos pés, arquibancada com profundidade): só no PC
  if (Q.ao && !touch) {
    const ao = new GTAOPass(g.scene, g.camera, size.x, size.y);
    ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: 12 });
    ao.blendIntensity = 0.85;
    comp.addPass(ao);
  }
  if (Q.bloom) {
    const night = g.stadium && g.stadium.isNight;
    g.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), night ? 0.32 : 0.14, 0.45, night ? 0.97 : 0.98);
    comp.addPass(g.bloom);
  }
  comp.addPass(new OutputPass());
  comp.addPass(new ShaderPass(GRADE));
  if (!Q.msaa) comp.addPass(new SMAAPass(size.x, size.y));
  g.composer = comp;
}

// Correção de cor de transmissão: contraste, saturação leve e vinheta.
const GRADE = {
  uniforms: { tDiffuse: { value: null }, uSat: { value: 1.08 }, uCon: { value: 1.06 }, uVig: { value: 0.22 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uSat, uCon, uVig; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, uSat);
      c.rgb = (c.rgb - 0.5) * uCon + 0.5;
      vec2 d = vUv - 0.5; c.rgb *= 1.0 - uVig * dot(d, d) * 2.2;
      gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), c.a);
    }`,
};

// ------------------------------------------------------------ áudio e menus
const audio = new GameAudio();
audio.setVolumes({ master: settings.volMaster, crowd: settings.volCrowd, sfx: settings.volSfx });
const unlockAudio = () => audio.unlock();
addEventListener('pointerdown', unlockAudio);
// tocar/clicar em qualquer lugar pula a abertura
addEventListener('pointerdown', () => { if (game && game.match.phase === 'intro' && game.t > 0.8) game.match.skipIntro(); });
addEventListener('keydown', unlockAudio);

const input = new Input();
const hud = new Hud($('hud'));
let game = null;

initMenus({ root: $('ui'), settings, saveSettings: (s) => saveSettings(s), onStartMatch: (cfg) => startMatch(cfg), audio });
$('loading').classList.add('hidden');
showMainMenu();
document.body.classList.add('in-menu');

// ------------------------------------------------------------ partida
async function startMatch(cfg) {
  settings = { ...settings, ...(cfg.settings || {}) };
  cfg.settings = settings;
  audio.unlock();
  $('ui').classList.add('hidden');
  const load = $('loading'); load.classList.remove('hidden');
  $('load-text').textContent = 'Preparando o estádio…';
  await new Promise(r => setTimeout(r, 30));
  if (game) endGame(true);
  presetKey = settings.quality === 'auto' ? autoPreset() : settings.quality;
  Q = QUALITY[presetKey];
  dynScale = 1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 1200);
  cfg.intro = settings.intro !== false && !cfg.noIntro;
  const match = new Match(cfg);
  const stadium = buildStadium(renderer, scene, {
    quality: Q, timeOfDay: settings.timeOfDay || 'noite',
    homeColor: cfg.home.colors?.primary || cfg.homeKit.shirt, homeColor2: cfg.home.colors?.secondary, awayColor: cfg.awayKit.shirt,
    stadiumName: cfg.home.stadium || `Arena ${cfg.home.city || cfg.home.name}`, wind: match.wind,
  });
  $('load-text').textContent = 'Aquecendo os jogadores…';
  await new Promise(r => setTimeout(r, 20));
  await preloadHeads(); await preloadBody();
  // passadas de captura de movimento (CMU) — sem elas a passada procedural continua valendo
  if (!mocapLoaded) { mocapLoaded = true; try { setMocap(await (await fetch('assets/mocap/locomocao.json')).json()); } catch (e) { console.warn('mocap indisponível', e); } }
  const players = new PlayerMeshes(scene, { count: 22, quality: Q, night: stadium.isNight });
  for (const p of match.players) {
    const t = p.team;
    const kit = p.isGK ? (t.i === 0 ? cfg.homeGK : cfg.awayGK) : (t.i === 0 ? cfg.homeKit : cfg.awayKit);
    players.setPlayer(p.idx, { kit, isGK: p.isGK, number: p.data.num, look: p.data.look });
  }
  // rostos com foto (pessoas que não existem) — também usados nas fotos da escalação
  const facePool = await loadFacePool();
  const faceCells = facePool ? matchFaces(facePool.meta, match) : [];
  if (facePool) players.setFaces(facePool, faceCells);
  let fx = null;
  try { fx = new StadiumFX(scene, { quality: Q, isNight: stadium.isNight, homeColor: cfg.homeKit.shirt, awayColor: cfg.awayKit.shirt, sunDir: stadium.sunDir, wind: match.wind }); } catch (e) { console.warn('efeitos indisponíveis', e); }
  const ball = new BallMesh(scene, Q);
  const rig = new CameraRig(camera);
  rig.setMode(settings.camera);
  rig.aspect = camera.aspect;
  rig.snap = true;
  const replay = new Replay(22, 12, 60);

  game = { cfg, scene, camera, match, stadium, players, ball, rig, replay, fx, facePool, faceCells, acc: 0, paused: false, t: 0,
    replaying: false, fps: 60, frames: 0, fpsT: 0, lastBounce: 0, chantT: 20 };
  applyQuality(true);

  hud.init(match, cfg, { touch });
  const tc = $('touch');
  if (touch) { tc.classList.remove('hidden'); input.buildTouch(tc); } else tc.classList.add('hidden');
  input.enabled = true;
  input.onPause = () => togglePause();
  input.onAny = () => {
    if (!game) return;
    if (game.match.phase === 'intro' && game.t > 0.8) { game.match.skipIntro(); return; }
    if (game.replaying && game.replayT > 0.6) finishReplay();
  };
  $('load-text').textContent = 'Preparando os gráficos…';
  try { if (renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera); } catch { /* opcional */ }
  last = performance.now();
  document.body.classList.remove('in-menu');
  document.body.classList.add('in-game');
  load.classList.add('hidden');
  if (match.phase !== 'intro') hud.banner(`${cfg.home.name} x ${cfg.away.name}`, stadiumLabel(cfg), 'period');
  audio.chant(true);
  last = performance.now();
}

function stadiumLabel(cfg) {
  const tod = { dia: 'Tarde de sol', tarde: 'Fim de tarde', noite: 'Noite de refletores' }[cfg.settings.timeOfDay] || '';
  return `${cfg.home.stadium || 'Arena ' + (cfg.home.city || '')} · ${tod}`;
}

function endGame(silent) {
  const g = game;
  if (!g) return;
  input.enabled = false;
  audio.chant(false);
  g.fx?.dispose?.();
  g.stadium.dispose?.();
  g.players.dispose?.();
  g.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(mt => { mt.map?.dispose(); mt.dispose(); }); });
  g.composer?.dispose?.();
  renderer.renderLists.dispose();
  game = null;
  hud.hide();
  $('touch').classList.add('hidden');
  document.body.classList.remove('in-game');
  if (!silent) { document.body.classList.add('in-menu'); $('ui').classList.remove('hidden'); }
}

function togglePause() {
  const g = game;
  if (!g || g.match.phase === 'ended') return;
  if (g.paused) { resume(); return; }
  g.paused = true;
  audio.suspend();
  $('ui').classList.remove('hidden');
  showPause({
    onResume: resume,
    onRestart: () => { const cfg = g.cfg; hidePause(); startMatch(cfg); },
    onQuit: () => { hidePause(); endGame(); showMainMenu(); },
    onSettings: () => {},
  });
}
function resume() {
  if (!game) return;
  hidePause();
  $('ui').classList.add('hidden');
  game.paused = false;
  audio.resume();
  last = performance.now();
}
document.addEventListener('visibilitychange', () => { if (document.hidden && game && !game.paused && game.match.phase !== 'ended') togglePause(); });

// ------------------------------------------------------------ eventos
function handleEvents(g) {
  const m = g.match;
  for (const e of m.events) {
    switch (e.type) {
      case 'kick':
        audio.kick(e.power, e.kind);
        if (e.kind === 'shot' || e.kind === 'volley') g.rig.kick(e.power);
        break;
      case 'bounce': if (g.t - g.lastBounce > 0.08) { audio.bounce(e.strength); g.lastBounce = g.t; } break;
      case 'board': audio.bounce(e.strength * 0.8); break;
      case 'post': case 'bar':
        audio.post(e.strength); audio.crowd('ooh', 0.9);
        g.stadium.postHit?.(e.goalSign, new THREE.Vector3(e.x, e.y, e.z), e.strength);
        g.rig.kick(0.35 + e.strength * 0.6); g.stadium.crowdReact('chance', m.lastTouch?.team.i === 0 ? 'home' : 'away');
        hud.banner(e.type === 'post' ? 'NA TRAVE!' : 'NO TRAVESSÃO!', '', 'chance'); input.vibrate(60);
        break;
      case 'net': audio.net(e.strength); g.stadium.netImpact(e.goalSign, new THREE.Vector3(e.x, e.y, e.z), e.strength); break;
      case 'sidenet': audio.net(e.strength * 0.6); audio.crowd('ooh', 0.7); g.stadium.netImpact(e.goalSign, new THREE.Vector3(e.x, e.y, e.z), e.strength * 0.5); break;
      case 'whistle': audio.whistle(e.kind); break;
      case 'crowd': audio.crowd(e.kind, e.strength); if (e.kind === 'goal') g.stadium.crowdReact('goal', e.side === 0 ? 'home' : 'away'); break;
      case 'tackle': audio.tackle(e.strength); break;
      case 'bodyHit': audio.bodyHit(e.strength); break;
      case 'block': audio.bodyHit(e.strength); break;
      case 'catch': audio.catchBall(); break;
      case 'save':
        g.stadium.crowdReact('save', e.side === 0 ? 'home' : 'away');
        if (e.kind === 'parry') hud.banner('QUE DEFESA!', m.teams[e.side].gk.data.name, 'chance');
        break;
      case 'banner': hud.banner(e.text, e.sub, e.kind); break;
      case 'card': hud.card(e.color, e.name); audio.crowd('card', 1); break;
      case 'switch': for (let i = 0; i < 22; i++) g.players.setIndicator(i, i === e.idx ? '#1ee37a' : null); break;
      case 'goal': {
        const t = m.teams[e.side];
        hud.goal(t.data.name, e.name, e.minute, e.own);
        input.vibrate(300);
        g.celebCutT = 1.6;   // deixa a bola entrar na rede (em câmera lenta) e corta para a comemoração
        g.slowmo = 1.1;
        g.stadium.crowdReact('goal', e.side === 0 ? 'home' : 'away');
        const kit = e.side === 0 ? g.cfg.homeKit : g.cfg.awayKit;
        g.fx?.goal(e.side === 0 ? 'home' : 'away', [kit.shirt, kit.second && kit.second !== kit.shirt ? kit.second : '#111111'], e.sign);
        g.stadium.showOnScreens?.('goal', 'GOL!');
        break;
      }
      case 'replay': startReplay(g); break;
      case 'shot': if (Math.random() < 0.5) g.fx?.chance(); break;
      case 'vibrate': input.vibrate(e.ms); break;
      case 'penaltyGoal': case 'penaltyMiss': hud.shootout(m.shootout, m.teams); break;
      case 'setpiece':
        if (e.type === 'setpiece') g.rig.snap = e.type === 'kickoff';
        if (m.shootout) hud.shootout(m.shootout, m.teams);
        break;
      case 'ended': endMatch(g, e.result); break;
      case 'intro': introEvent(g, e.stage); break;
    }
  }
  m.events.length = 0;
}

// --------------------------------------------------------- abertura (entrada em campo)
function introEvent(g, stage) {
  const m = g.match, cfg = g.cfg;
  const colors = (kit) => [kit.shirt, kit.second && kit.second !== kit.shirt ? kit.second : '#111111'];
  if (stage === 'start') {
    audio.prematch?.(true);
    audio.chant(true);
    hud.intro(true);
  } else if (stage === 'enter') {
    audio.teamsEnter?.();
    audio.crowd('cheer', 1);
    // festa na entrada (sem o 'goal', que acende os LEDs de GOOOOL)
    g.stadium.crowdReact('chance', 'home'); g.stadium.crowdReact('chance', 'away');
    g.fx?.goal('home', colors(cfg.homeKit), -1);
    g.stadium.showOnScreens?.('goal', 'BEM-VINDOS!');
  } else if (stage === 'lineup') {
    audio.anthem?.(true);
    hud.lineup(m.teams, cfg, (p) => portrait(g.facePool, g.faceCells?.[p.idx] ?? -1, 96));
  } else if (stage === 'break') {
    audio.anthem?.(false);
    hud.lineup(null);
    audio.crowd('cheer', 0.8);
  } else if (stage === 'end') {
    audio.anthem?.(false); audio.prematch?.(false);
    hud.lineup(null); hud.intro(false);
    g.stadium.showOnScreens?.('none');
    g.rig.setCinematic(null); g.rig.snap = true;
    g.mblur?.reset();
    hud.banner(`${cfg.home.name} x ${cfg.away.name}`, stadiumLabel(cfg), 'period');
  }
}

// Câmeras da abertura: túnel → grua acompanhando a fila → perfilamento de perto → aérea.
const _ip = new THREE.Vector3(), _il = new THREE.Vector3();
function introCamera(g) {
  const m = g.match, it = m.intro;
  if (!it) return;
  const t = it.t;
  let fov = 40, lam = 3;
  if (t < 6) {
    _ip.set(4.2, 1.6, -28.5); _il.set(0, 1.4, -36.5); fov = 42; lam = 6;
  } else if (t < 13) {
    // centro de quem já está andando
    let cx = 0, cz = 0, n = 0;
    for (const p of m.players) if (t >= p.introStart && p.introStage >= 0) { cx += p.x; cz += p.z; n++; }
    cx /= n || 1; cz /= n || 1;
    _ip.set(cx - 11, 5.5, cz - 6); _il.set(cx, 1.2, cz + 2); fov = 38; lam = 2;
  } else if (t < 19) {
    _ip.set(0, 4.2, -31); _il.set(0, 1.1, -14); fov = 60; lam = 1.5;
  } else if (t < 24) {
    // passeia de perto pelos rostos do perfilamento
    const u = (t - 19) / 5, x = 15 - u * 30;
    _ip.set(x, 1.62, -20.5); _il.set(x - 0.8, 1.4, -14); fov = 30; lam = 5;
  } else if (t < 27.5) {
    // torcida da lateral oposta (fundo da escalação): câmera baixa olhando a arquibancada
    const u = (t - 24) / 3.5;
    _ip.set(-22 + u * 9, 1.7, 33); _il.set(-14 + u * 9, 7.5, 52); fov = 42; lam = 4;
  } else if (t < 31) {
    // torcida atrás do gol da casa
    const u = (t - 27.5) / 3.5;
    _ip.set(-49, 1.8, 8 + u * 9); _il.set(-70, 7.5, 13 + u * 9); fov = 44; lam = 4;
  } else {
    // aérea por cima do gramado (fora da cobertura), abrindo o estádio
    const u = t - 31;
    _ip.set(-18 + u * 4, 46, -30 + u * 2); _il.set(0, 0, 4); fov = 55; lam = 2;
  }
  if (!g.rig.cine || g.rig.cine.type !== 'manual') { g.rig.setCinematic({ type: 'manual', pos: _ip, look: _il, fov, lam }); g.rig.snap = true; }
  const c = g.rig.cine;
  const st = t < 6 ? 0 : t < 13 ? 1 : t < 19 ? 2 : t < 24 ? 3 : t < 27.5 ? 4 : t < 31 ? 5 : 6;
  if (c.stage !== st) { c.stage = st; g.rig.snap = true; g.mblur?.reset(); }
  c.fov = fov; c.lam = lam;
}

function startReplay(g) {
  if (!g.replay.start(7.5, 0.4, 1)) { g.match.replayFinished(); return; }
  g.replaying = true; g.replayT = 0;
  const gi = g.match.goalInfo;
  const sign = gi ? gi.sign : 1;
  g.rig.setCinematic({ type: Math.random() < 0.5 ? 'goal' : 'low', target: new THREE.Vector3(), sign, side: Math.random() < 0.5 ? 1 : -1 });
  g.rig.snap = true;
  hud.setReplay(true);
  g.stadium.showOnScreens?.('replay', 'REPLAY');
}
function finishReplay() {
  const g = game;
  if (!g || !g.replaying) return;
  g.replaying = false; g.replay.stop();
  hud.setReplay(false);
  g.stadium.showOnScreens?.('none');
  g.rig.setCinematic(null); g.rig.snap = true;
  g.match.replayFinished();
}

function endMatch(g, result) {
  audio.chant(false);
  const cfg = g.cfg;
  setTimeout(() => {
    endGame(true);
    $('ui').classList.remove('hidden');
    document.body.classList.add('in-menu');
    showMatchResult(result, { onContinue: () => showMainMenu(), cfg });
  }, 400);
}

// ------------------------------------------------------------ laço
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const g = game;
  let dt = clamp((now - last) / 1000, 0, 0.25);
  last = now;
  if (!g) return;
  const m = g.match;
  g.t += dt;
  const cmd = input.poll(g.rig.right, g.rig.fwd);

  if (!g.paused) {
    if (g.replaying) {
      g.replayT += dt;
      if (!g.replay.update(dt)) finishReplay();
    } else {
      // câmera lenta curta quando a bola estufa a rede
      const ts = g.slowmo > 0 ? 0.32 : 1;
      if (g.slowmo > 0) g.slowmo -= dt;
      g.acc += dt * ts;
      let steps = 0;
      while (g.acc >= STEP && steps < 15) {
        m.step(STEP, cmd);
        input.consume();
        handleEvents(g);
        g.ball.spin(m.ball.w, STEP);
        g.replay.record(m, g.ball.q);
        g.acc -= STEP; steps++;
        if (g.replaying || !game) break;
      }
      if (steps >= 15) g.acc = 0;
    }
  }
  if (!game) return;
  render(g, dt);
  measure(g, dt);
}
requestAnimationFrame(frame);

const _t = new THREE.Vector3();
const _ro = { right: 0, forward: 0, up: 0 };
const _up = { x: 0, y: 0, z: 0, heading: 0, pose: null };
// O mergulho do goleiro é movido pela jogabilidade (alcance real); a translação
// lateral da animação é descontada para o corpo ficar onde a física está.
function placePlayer(g, i, x, y, z, heading, pose, height) {
  _up.x = x; _up.y = y; _up.z = z; _up.heading = heading; _up.pose = pose;
  if (pose.anim === 'gk_dive' || (pose.blendFrom && pose.blendFrom.anim === 'gk_dive')) {
    rootOffset(pose, _ro);
    const k = (height || 1.8) / 1.8, fx = Math.cos(heading), fz = Math.sin(heading);
    _up.x -= (-fz * _ro.right + fx * _ro.forward) * k;
    _up.z -= (fx * _ro.right + fz * _ro.forward) * k;
  }
  if (pose.anim === 'header') _up.y = 0;
  g.players.update(i, _up);
}

function render(g, dt) {
  const m = g.match;
  const alpha = g.replaying ? 1 : clamp(g.acc / STEP, 0, 1);
  // jogadores
  if (g.replaying) {
    for (let i = 0; i < 22; i++) {
      const r = g.replay.poses[i];
      g.players.setVisible(i, r.visible);
      if (r.visible) placePlayer(g, i, r.x, r.y, r.z, r.heading, r.pose, g.match.players[i].data.look.height);
    }
    const b = g.replay.ball;
    g.ball.set(b.x, b.y, b.z, new THREE.Quaternion(b.qx, b.qy, b.qz, b.qw));
    g.ball.trail(g.replay.ballVel || null);
    _t.set(b.x, b.y, b.z);
  } else {
    for (const p of m.players) {
      g.players.setVisible(p.idx, !p.sentOff);
      if (p.sentOff) continue;
      let dh = p.heading - p.ph;
      if (dh > Math.PI) dh -= Math.PI * 2; if (dh < -Math.PI) dh += Math.PI * 2;
      placePlayer(g, p.idx, p.px + (p.x - p.px) * alpha, p.y, p.pz + (p.z - p.pz) * alpha, p.ph + dh * alpha, p.pose, p.data.look.height);
    }
    const b = m.ball.p;
    const off = g.stadium.updateBall ? g.stadium.updateBall(dt, b, m.ball.v) : null;
    const ox = off ? off.x || 0 : 0, oy = off ? off.y || 0 : 0, oz = off ? off.z || 0 : 0;
    g.ball.set(b.x + ox + m.ball.v.x * g.acc * (m.ball.held ? 0 : 1), b.y + oy, b.z + oz + m.ball.v.z * g.acc * (m.ball.held ? 0 : 1));
    g.ball.trail(m.ball.held ? null : m.ball.v);
    _t.set(b.x, b.y, b.z);
  }
  g.players.commit();
  const sp = m.sp;
  const userTaking = sp && m.userTeam && sp.team === m.userTeam && m.phase === 'setpiece';
  g.ball.aim(m, sp, userTaking);

  // câmera: corte para a comemoração pouco depois do gol
  if (g.celebCutT > 0 && !g.replaying) {
    g.celebCutT -= dt;
    if (g.celebCutT <= 0 && m.phase === 'goal' && m.goalInfo) {
      const sc = m.goalInfo.scorer;
      g.rig.setCinematic({ type: 'celebrate', target: new THREE.Vector3(sc.x, 0, sc.z), follow: sc, side: sc.z > 0 ? -1 : 1 });
      g.rig.snap = true;
    }
  }
  const c = g.rig.cine;
  if (c) {
    if (c.type === 'celebrate' && c.follow) {
      // mira no grupo do abraço (autor + quem já chegou)
      let x = c.follow.x * 2, z = c.follow.z * 2, n = 2;
      for (const q of c.follow.team.players) if (q !== c.follow && Math.hypot(q.x - c.follow.x, q.z - c.follow.z) < 2.5) { x += q.x; z += q.z; n++; }
      c.target.set(x / n, 0, z / n);
      if (m.phase !== 'goal') g.rig.setCinematic(null);
    }
    else if (c.target && c.target.copy) c.target.copy(_t);
  }
  const ctl = m.controlled;
  const attackDir = m.userTeam ? m.userTeam.dir : 1;
  let lead = 0;
  if (m.owner) lead = m.owner.team.dir * 0.6;
  // pênalti: câmera atrás do cobrador
  if (!c && sp && sp.type === 'penalty' && m.phase === 'setpiece') g.rig.setCinematic({ type: 'penalty', target: new THREE.Vector3(sp.x, 0, sp.z), sign: Math.sign(m.goalX(sp.team)), pen: true });
  if (c && c.pen && (!sp || m.phase !== 'setpiece') && (!m.shootout || !m.shootout.active || m.time - (m.lastKick?.t || 0) > 1.6)) g.rig.setCinematic(null);
  if (m.phase === 'intro') introCamera(g);
  if (g.rig.snap && g.mblur) g.mblur.reset();
  g.rig.update(dt, m, { ball: _t, player: ctl, attackDir, lead, zoom: m.phase === 'setpiece' && sp && sp.type === 'corner' ? 1 : 0 });

  // estádio (telões com o placar), efeitos e HUD
  g.stadium.update(dt, g.t, m.excitement, g.camera);
  if (g.stadium.setScoreboard) {
    const mm = Math.floor(m.clock / 60), ss = Math.floor(m.clock % 60);
    g.stadium.setScoreboard({ home: m.teams[0].data.short, away: m.teams[1].data.short, homeScore: m.teams[0].score, awayScore: m.teams[1].score,
      clock: m.shootout ? 'PÊN' : `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`, homeColor: g.cfg.homeKit.shirt, awayColor: g.cfg.awayKit.shirt });
  }
  g.fx?.update(dt, g.camera);
  hud.update(dt, m, g.camera, {
    replay: g.replaying, names: settings.names !== false, radar: settings.radar !== false, charging: input.charging,
    right: g.rig.right, fwd: g.rig.fwd, hint: hintFor(g),
  });
  if (touch) input.setContext(touchContext(m));
  audio.update(dt, { excitement: m.excitement, attackThreat: m.threat });
  // torcida cantando de tempos em tempos
  g.chantT -= dt;
  if (g.chantT <= 0) {
    g.chantOn = !g.chantOn; audio.chant(g.chantOn && m.phase !== 'goal'); g.chantT = g.chantOn ? 25 + Math.random() * 20 : 12 + Math.random() * 15;
    // a arquibancada canta junto com o som (pulo/braços no compasso)
    if (g.chantOn && m.phase !== 'goal') g.stadium.crowdChant?.('home', 1, g.chantT);
  }

  g.sunFit?.update(g.camera);
  renderer.info.reset();
  if (g.composer) g.composer.render(dt);
  else renderer.render(g.scene, g.camera);
}

function touchContext(m) {
  const t = m.userTeam;
  if (!t) return 'loose';
  if (m.sp && m.phase === 'setpiece') return m.sp.team === t ? 'setpiece' : m.sp.type === 'penalty' ? 'penaltyDef' : 'defend';
  if (t.gk.holdingBall) return 'gk';
  if (m.owner && m.owner.team === t) return 'attack';
  if (m.owner) return 'defend';
  return 'loose';
}

function hintFor(g) {
  const m = g.match, sp = m.sp, t = m.userTeam;
  if (!t || m.phase !== 'setpiece' || !sp) return '';
  const kb = input.lastDevice === 'keyboard', gp = input.lastDevice === 'gamepad';
  const K = (k, p, tc) => (kb ? k : gp ? p : tc);
  if (sp.team === t) {
    if (sp.type === 'penalty') return `Mire com ${K('WASD', 'o analógico', 'o joystick')} · ${K('K', 'B', 'Chute')} segure para força`;
    if (sp.type === 'freekick' && Math.hypot(m.goalX(t) - sp.x, sp.z) < 35) return `Mire no gol · ${K('K', 'B', 'Chute')} chute com efeito · ${K('Espaço', 'A', 'Passe')} passe curto`;
    if (sp.type === 'corner') return `Direção com ${K('WASD', 'o analógico', 'o joystick')} · ${K('L', 'X', 'Longo')} cruzar · ${K('Espaço', 'A', 'Curto')} curto`;
    if (sp.type === 'throwin') return `${K('Espaço', 'A', 'Curto')} lateral curto · ${K('L', 'X', 'Longo')} lateral longo`;
    if (sp.type === 'kickoff') return `${K('Espaço', 'A', 'Passe')} para dar a saída`;
    if (sp.type === 'goalkick') return `${K('Espaço', 'A', 'Curto')} curto · ${K('L', 'X', 'Longo')} lançamento`;
    return `${K('Espaço', 'A', 'Passe')} passe · ${K('L', 'X', 'Longo')} lançamento`;
  }
  if (sp.type === 'penalty') return `Goleiro: escolha o lado com ${K('A/D', 'o analógico', 'o joystick')} na hora do chute`;
  return '';
}

// Resolução dinâmica: mantém ~60 fps (ou 30 no mínimo em aparelhos fracos).
function measure(g, dt) {
  g.frames++; g.fpsT += dt;
  if (g.fpsT < 1) return;
  const fps = g.frames / g.fpsT;
  g.fps = fps; g.frames = 0; g.fpsT = 0;
  if (window.__fps) window.__fps(fps);
  const old = dynScale;
  // prioridade à nitidez: antes de baixar a resolução, desliga o bloom barato (celular)
  const pc = g.composer;
  if (pc && pc.setBloom) {
    if (fps < 45 && pc.bloomOn) { pc.setBloom(false); return; }
    if (fps > 58 && dynScale >= 1 && !pc.bloomOn) pc.setBloom(true);
  }
  const minDyn = Q.minDyn ?? 0.7;
  if (fps < 45 && dynScale > minDyn) dynScale = Math.max(minDyn, dynScale - 0.1);
  else if (fps > 58 && dynScale < 1) dynScale = Math.min(1, dynScale + 0.05);
  // auto: cai de preset se nem com resolução menor aguenta (ou na hora, se estiver muito lento)
  if (settings.quality === 'auto' && (fps < 38 && dynScale <= minDyn || fps < 24)) {
    const order = ['ultra', 'alta', 'media', 'baixa'];
    const i = order.indexOf(presetKey);
    if (i < order.length - 1) { presetKey = order[i + 1]; dynScale = 0.85; applyQuality(true); return; }
  }
  if (old !== dynScale) applyQuality(false);
}

// Depuração/testes automatizados: avança a simulação sem desenhar
function advance(sec, cmdFn) {
  const g = game;
  if (!g) return null;
  for (let i = 0; i < sec * 60 && game; i++) {
    const cmd = cmdFn ? cmdFn(g.match) : { mx: 0, mz: 0, held: {}, press: {}, release: {}, hold: {}, rx: 0, rz: 0 };
    g.match.step(STEP, cmd);
    handleEvents(g);
    g.ball.spin(g.match.ball.w, STEP);
    g.replay.record(g.match, g.ball.q);
    if (g.replaying) finishReplay();
  }
  return { phase: g.match.phase, clock: g.match.clock, score: g.match.teams.map(t => t.score) };
}
window.__golaco = { get game() { return game; }, startMatch, settings: () => settings, advance, renderer, input, replayNow: () => startReplay(game) };
