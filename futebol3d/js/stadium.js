// GOLAÇO — estádio: gramado, linhas, gols e redes, bandeirinhas, placas de LED,
// bancos, túnel, arquibancadas em dois anéis com camarotes e cadeiras nas cores do
// clube, torcida animada, cobertura esculpida com treliças e anel de policarbonato,
// passarela técnica, refletores (brilho + cones de luz), telões com placar, céu com
// nuvens, luzes e ambiente PMREM. API em tools/CONTRACTS.md.
//
// Premissas sobre o renderer (definidas pelo main.js, não alteradas aqui):
//   outputColorSpace = SRGBColorSpace, toneMapping = ACESFilmicToneMapping,
//   toneMappingExposure ≈ 1. Aqui só ajustamos renderer.shadowMap.enabled/type
//   (PCFSoftShadowMap) conforme quality.shadows. A câmera deve ter far ≥ 600.
// Também definimos scene.environment e scene.environmentIntensity.
// Extras (fora do contrato original):
//   stadium.ready (Promise das texturas do gramado), stadium.root (grupo raiz),
//   stadium.setScoreboard({ home, away, homeScore, awayScore, clock, homeColor, awayColor }),
//   stadium.showOnScreens('goal'|'replay'|'none', texto),
//   stadium.updateBall(dt, ballPos, ballVel) (repassa à rede, se ela tiver update;
//     também aponta as câmeras dos fotógrafos para a bola),
//   stadium.crowdChant(side, nivel, segundos) (força um canto), stadium.crowdWave(voltas) (ola).
// opts extras: homeColor2 (cor secundária do clube: cadeiras, LED), mowPattern
//   ('faixas' | 'xadrez' | 'diagonal').
//
// Chamadas de desenho do estádio (≈15 + gols/torcida): céu, gramado, arquibancada,
// estrutura (cobertura, treliças, passarela, corrimãos, bancos, túnel, molduras dos
// telões), fotógrafos (1 malha animada), vidros, placas/fitas de LED, telões, refletores (caixas,
// brilho, cones), gols (traves, armação, redes, mastros, bandeirinhas), torcida.
import * as THREE from 'three';
import { PITCH } from './config.js';
import { BOWL, buildBowl } from './stadium-bowl.js';
import { buildPitch } from './stadium-pitch.js';
import { buildGoals } from './stadium-goals.js';
import { buildAds } from './stadium-ads.js';
import { buildCrowd } from './stadium-crowd.js';
import { Parts } from './stadium-geo.js';
import { buildDetails } from './stadium-details.js';
import { buildPhotographers } from './stadium-photogs.js';
import { buildScreens, screenFrames } from './stadium-screens.js';
import { buildFloodlights } from './stadium-lights.js';
import { buildSky, buildEnv } from './stadium-sky.js';

const D2R = Math.PI / 180;

// ---------------------------------------------------------------- horários
const TOD = {
  dia: {
    el: 57, az: [-0.42, -0.91], skyEl: 57,
    sun: 0xfff4e6, sunI: 3.3, hemiSky: 0xbcd4ff, hemiGround: 0x4a6a34, hemiI: 0.35,
    envI: 0.75, amb: [0.34, 0.37, 0.42],
    sky: { turbidity: 2.0, rayleigh: 1.8, mieCoefficient: 0.004, mieDirectionalG: 0.8, gain: 0.55 },
    clouds: { cover: 0.45, lit: [1.05, 1.06, 1.1], shade: [0.62, 0.66, 0.74] },
  },
  tarde: {
    el: 24, az: [-0.62, -0.78], skyEl: 7,
    sun: 0xffbe82, sunI: 3.6, hemiSky: 0xc9d6ff, hemiGround: 0x4a4a2a, hemiI: 0.55,
    envI: 1.1, amb: [0.36, 0.30, 0.27],
    sky: { turbidity: 6, rayleigh: 2.4, mieCoefficient: 0.006, mieDirectionalG: 0.86, gain: 0.5 },
    clouds: { cover: 0.55, lit: [1.25, 0.86, 0.6], shade: [0.42, 0.36, 0.42] },
  },
  noite: {
    dir: [0.3, 1, -0.42],
    sun: 0xeef3ff, sunI: 2.9, hemiSky: 0xa9bbdc, hemiGround: 0x2a3a24, hemiI: 0.55,
    envI: 0.55, amb: [0.2, 0.21, 0.24], crowdSun: 0.5,
  },
};

// cor secundária padrão (quando o clube não informa): contraste claro/escuro
function defaultSecond(hex) {
  const c = new THREE.Color(hex);
  const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return l < 0.2 ? '#d9dcdf' : '#16181b';
}
// cor de destaque para LEDs/detalhes: a mais "viva" entre as duas do clube
function pickAccent(a, b) {
  const score = (hex) => { const h = {}; new THREE.Color(hex).getHSL(h); return h.s * (1 - Math.abs(h.l - 0.5) * 1.6); };
  const best = score(a) >= score(b) ? a : b;
  return score(best) > 0.12 ? best : '#19d27a';
}

// ---------------------------------------------------------------- principal
export function buildStadium(renderer, scene, opts = {}) {
  const quality = opts.quality || { shadows: true, shadowSize: 2048, crowd: 0.6, anisotropy: 4, grassDetail: 1 };
  const tod = TOD[opts.timeOfDay] ? opts.timeOfDay : 'noite';
  const P = TOD[tod];
  const isNight = tod === 'noite';
  const homeColor = opts.homeColor || '#c8102e';
  const homeColor2 = opts.homeColor2 || defaultSecond(homeColor);
  const awayColor = opts.awayColor || '#f2f2f2';
  const stadiumName = opts.stadiumName || 'Arena Vale do Sol';
  const shadows = !!quality.shadows;
  const detail = quality.grassDetail ?? 2;
  const anisotropy = Math.min(quality.anisotropy || 4, renderer.capabilities.getMaxAnisotropy());
  const accent = pickAccent(homeColor, homeColor2);
  // cadeiras pretas "somem": sobe um pouco o piso de brilho
  const seatCol = (hex) => { const c = new THREE.Color(hex); const m = Math.max(c.r, c.g, c.b); if (m < 0.02) c.addScalar(0.02 - m); return c; };

  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // direção PARA a luz principal
  const sunDir = new THREE.Vector3();
  if (isNight) sunDir.fromArray(P.dir).normalize();
  else sunDir.set(P.az[0] * Math.cos(P.el * D2R), Math.sin(P.el * D2R), P.az[1] * Math.cos(P.el * D2R)).normalize();

  const sunColor = new THREE.Color(P.sun);
  const U = {
    uTime: { value: 0 }, uExc: { value: 0.2 },
    uEvHome: { value: new THREE.Vector4(-1e4, -1e4, -1e4, -1e4) },
    uEvAway: { value: new THREE.Vector4(-1e4, -1e4, -1e4, -1e4) },
    uSunDir: { value: sunDir },
    uShadeOn: { value: isNight ? 0 : 1 },
    uSunCol: { value: sunColor.clone().multiplyScalar(P.sunI / Math.PI * (P.crowdSun ?? 1)) },
    uAmbCrowd: { value: new THREE.Color().fromArray(P.amb) },
    uWind: { value: new THREE.Vector2(opts.wind?.x ?? 2.5, opts.wind?.z ?? 1.2) },
    // cantos: nível da casa/visitante (0..1) e andamento (bpm); ola: início, sentido, m/s, voltas
    uChant: { value: new THREE.Vector4(0, 0, 130, 120) },
    uWave: { value: new THREE.Vector4(-1e4, -1, 14, 1) },
  };

  const root = new THREE.Group();
  root.name = 'estadio';
  scene.add(root);

  // ---- céu e ambiente
  const { sky, skyMat } = buildSky(isNight, P, detail);
  root.add(sky);
  const envRT = buildEnv(renderer, isNight, skyMat, { home: homeColor, accent });
  const envMap = envRT.texture;
  const prevEnv = scene.environment, prevEnvI = scene.environmentIntensity;
  scene.environment = envMap;
  scene.environmentIntensity = P.envI;

  // ---- luzes
  const mainLight = new THREE.DirectionalLight(sunColor, P.sunI);
  mainLight.name = isNight ? 'luz-refletores' : 'sol';
  mainLight.position.copy(sunDir).multiplyScalar(250);
  mainLight.target.position.set(0, 0, 0);
  mainLight.castShadow = shadows;
  if (shadows) {
    const sh = mainLight.shadow;
    sh.mapSize.set(quality.shadowSize, quality.shadowSize);
    // ajusta a câmera ortográfica da sombra ao gramado (+ margem e altura dos jogadores)
    const view = new THREE.Matrix4().lookAt(mainLight.position, mainLight.target.position, new THREE.Vector3(0, 1, 0));
    view.setPosition(mainLight.position);
    view.invert();
    const hx = PITCH.halfL + 4, hz = PITCH.halfW + 3;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const v = new THREE.Vector3();
    for (const x of [-hx, hx]) for (const z of [-hz, hz]) for (const y of [0, 3]) {
      v.set(x, y, z).applyMatrix4(view);
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    }
    const cam = sh.camera;
    cam.left = minX; cam.right = maxX; cam.bottom = minY; cam.top = maxY;
    cam.near = 1; cam.far = 500;
    cam.updateProjectionMatrix();
    const texel = Math.max(maxX - minX, maxY - minY) / quality.shadowSize;
    sh.bias = -0.0003;
    sh.normalBias = Math.max(0.012, texel * 0.9);
    sh.radius = 2;
  }
  scene.add(mainLight, mainLight.target);
  const hemi = new THREE.HemisphereLight(P.hemiSky, P.hemiGround, P.hemiI);
  hemi.name = 'luz-hemisferio';
  scene.add(hemi);

  // ---- peças
  const ctx = {
    U, quality, homeColor, homeColor2, awayColor, stadiumName, isNight, anisotropy, shadows, detail,
    accent, seatA: seatCol(homeColor), seatB: seatCol(homeColor2), mow: opts.mowPattern || 'faixas', tod,
  };
  const pitch = buildPitch(ctx);
  root.add(pitch);

  const st = new Parts(false), glass = new Parts(true);
  const bowl = buildBowl(ctx, st, glass);
  bowl.userData.stands.castShadow = shadows && !isNight;
  root.add(bowl);
  buildDetails(ctx, st, glass);
  screenFrames(st);

  const structMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.4 });
  const struct = new THREE.Mesh(st.geometry(), structMat);
  struct.name = 'estrutura';
  struct.castShadow = shadows && !isNight;
  struct.receiveShadow = shadows;
  root.add(struct);

  // vidros e policarbonato: um material translúcido (opacidade por vértice) que
  // reflete o ambiente e "acende" um pouco com a luz do céu atravessando
  const glassMat = new THREE.MeshStandardMaterial({
    vertexColors: true, transparent: true, roughness: 0.1, metalness: 0.15, side: THREE.DoubleSide, depthWrite: false,
  });
  const transl = { value: isNight ? 0.04 : tod === 'tarde' ? 0.3 : 0.4 };
  glassMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTransl = transl;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTransl;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * uTransl;');
  };
  glassMat.customProgramCacheKey = () => 'golaco-vidro';
  const glassMesh = new THREE.Mesh(glass.geometry(), glassMat);
  glassMesh.name = 'vidros';
  glassMesh.renderOrder = 2;
  root.add(glassMesh);

  const ads = buildAds({ ...ctx, samples: bowl.userData.samples });
  ads.castShadow = shadows;
  root.add(ads);

  const screens = buildScreens(ctx);
  root.add(screens);

  const goals = buildGoals(ctx);
  root.add(goals);
  const photogs = buildPhotographers(ctx);
  root.add(photogs);
  const crowd = buildCrowd(ctx);
  root.add(crowd);
  root.add(buildFloodlights(ctx));

  // ---- estado
  let lastTime = 0, goalAt = -1e4;
  // agendador da torcida: cada lado alterna cantos (12-22 s) e pausas; depois do gol a
  // torcida que comemorou canta forte; a ola aparece de vez em quando em jogo morno
  let rs = 917;
  const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
  const chant = {
    home: { on: false, until: 8, lvl: 0, force: -1e4, forceLvl: 0 },
    away: { on: false, until: 14, lvl: 0, force: -1e4, forceLvl: 0 },
  };
  const wave = { next: 70 + rnd() * 60, end: -1e4 };
  let prevT = null;
  const startWave = (t, laps = 1 + (rnd() < 0.35 ? 1 : 0), dir = rnd() < 0.75 ? -1 : 1) => {
    const w = U.uWave.value;
    w.set(t, dir, 14, laps);
    wave.end = t + (laps * 2 * Math.PI * 66) / 14 + 10;
    wave.next = wave.end + 90 + rnd() * 120;
  };
  const wind = U.uWind.value;

  const stadium = {
    sunDir, mainLight, envMap, isNight, root,
    ready: pitch.userData.ready,
    crowdCount: crowd.userData.count,

    update(dt, time, excitement = 0, camera) {
      lastTime = time;
      U.uTime.value = time;
      const e = THREE.MathUtils.clamp(excitement, 0, 1);
      U.uExc.value += (e - U.uExc.value) * Math.min(1, dt * 1.5);
      // cantos e ola (usa o relógio do estádio, que pode pular no replay)
      const dts = prevT === null ? 0 : THREE.MathUtils.clamp(time - prevT, 0, 0.5);
      prevT = time;
      const ex = U.uExc.value;
      for (const k of ['home', 'away']) {
        const c = chant[k];
        if (time > c.until || time < c.until - 60) {
          c.on = !c.on;
          c.until = time + (c.on ? 12 + rnd() * 10 : (14 + rnd() * 16) * (1.2 - 0.6 * ex));
        }
        let target = c.on ? 0.5 + 0.45 * ex : 0.04;
        if (time - c.force < 0) target = c.forceLvl;
        c.lvl += (target - c.lvl) * Math.min(1, dts * 0.8);
      }
      U.uChant.value.x = chant.home.lvl;
      U.uChant.value.y = chant.away.lvl;
      if (time > wave.next && ex < 0.5 && time - goalAt > 40) startWave(time);
      ads.userData.uniforms.uFlash.value = time - goalAt < 7 ? 1 : 0;
      screens.userData.update(time);
    },

    crowdReact(kind, side = 'home') {
      const v = (side === 'away' ? U.uEvAway : U.uEvHome).value;
      if (kind === 'goal') {
        v.x = lastTime; goalAt = lastTime;
        // depois da explosão, a torcida que comemorou emenda o canto com tudo
        const c = chant[side === 'away' ? 'away' : 'home'];
        c.force = lastTime + 50; c.forceLvl = 1;
        U.uWave.value.x = -1e4; wave.next = Math.max(wave.next, lastTime + 60);
      }
      else if (kind === 'chance') v.y = lastTime;
      else if (kind === 'foul') v.z = lastTime;
      else if (kind === 'save') v.w = lastTime;
    },

    // extras (fora do contrato): força um canto ('home'|'away', nível 0..1, segundos) —
    // ex.: sincronizar com audio.chant — e dispara a ola na hora
    crowdChant(side = 'home', level = 1, secs = 15) {
      const c = chant[side === 'away' ? 'away' : 'home'];
      c.force = lastTime + secs; c.forceLvl = level;
    },
    crowdWave(laps, dir) { startWave(lastTime, laps || 1, dir === 1 || dir === -1 ? dir : undefined); },

    netImpact(goalSign, point, strength = 1) {
      goals.userData.impact(goalSign, point, strength, lastTime);
    },

    // bola na trave/travessão: vibração da armação + rede sacudindo
    postHit(goalSign, point, strength = 1) {
      goals.userData.shake?.(goalSign, point, strength, lastTime);
    },

    // rede de pano (se o módulo dos gols expuser update): física com a bola
    updateBall(dt, ballPos, ballVel) {
      if (ballPos) photogs.userData.uniforms.uBall.value.set(ballPos.x, ballPos.y, ballPos.z);
      if (typeof goals.userData.update === 'function') goals.userData.update(dt, lastTime, ballPos, ballVel);
    },

    // placar dos telões: redesenha só quando algum valor muda
    setScoreboard(v) {
      return screens.userData.setScoreboard(v);
    },

    // animação nos telões: 'goal' (some sozinha em ~8 s), 'replay' (até 'none'), 'none'
    showOnScreens(kind, text) {
      screens.userData.show(kind, text, lastTime);
    },

    setWind(w) {
      if (w) wind.set(w.x || 0, w.z || 0);
    },

    dispose() {
      root.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        for (const m of mats) {
          for (const k of ['map', 'normalMap', 'emissiveMap']) if (m[k]) m[k].dispose();
          if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u && u.value && u.value.isTexture) u.value.dispose();
          m.dispose();
        }
      });
      screens.userData.dispose();
      pitch.userData.dispose?.();
      scene.remove(root, mainLight, mainLight.target, hemi);
      mainLight.dispose(); hemi.dispose();
      if (scene.environment === envMap) { scene.environment = prevEnv || null; scene.environmentIntensity = prevEnvI ?? 1; }
      envRT.dispose();
    },
  };
  return stadium;
}

export { BOWL };
