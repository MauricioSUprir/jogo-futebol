# GOLAÇO — contratos entre módulos

Jogo de futebol 3D no navegador (PC + celular), sem etapa de build. ES modules,
three.js 0.170 por importmap (CDN jsdelivr), igual ao `marte/` e ao `aviao/`.
Tudo em pt-BR (textos visíveis e comentários). Times, jogadores, marcas e anúncios
são **fictícios** — nada de nome, escudo ou marca real.

```
futebol3d/
  index.html            (núcleo)  importmap, contêineres de tela
  css/game.css          (núcleo)  HUD, controles de toque
  css/menus.css         (menus)
  js/config.js          (núcleo)  constantes compartilhadas — LEIA ANTES
  js/main.js            (núcleo)  renderer, laço, pós-processamento, qualidade
  js/ball.js js/match.js js/ai.js js/input.js js/camera.js js/hud.js js/replay.js  (núcleo)
  js/stadium.js         (estádio)
  js/audio.js           (áudio)
  js/teams.js js/menus.js js/tournament.js  (menus)
  js/anim.js js/players3d.js  (jogadores)
  assets/textures/      texturas (CC0) e geradas
  tools/                páginas de teste e scripts (não vão para o site)
```

Coordenadas: ver `js/config.js`. x = comprimento (-52,5..52,5), z = largura
(-34..34), y para cima. Heading h aponta para (cos h, 0, sin h).

Import three: `import * as THREE from 'three'` e addons por `three/addons/...`.

---

## Estádio — `js/stadium.js`

```js
export function buildStadium(renderer, scene, opts) -> Stadium
// opts: { quality: QUALITY[...] (objeto de config.js), timeOfDay: 'dia'|'tarde'|'noite',
//         homeColor: '#hex', awayColor: '#hex', stadiumName: string, wind: {x,z} m/s }
Stadium = {
  sunDir: THREE.Vector3,             // direção PARA a luz principal (normalizada)
  mainLight: THREE.DirectionalLight, // já com sombra configurada cobrindo o campo
  envMap: THREE.Texture | null,      // PMREM p/ reflexos (scene.environment já setado)
  isNight: boolean,
  update(dt, time, excitement /*0..1*/, camera),
  crowdReact(kind /*'goal'|'chance'|'foul'|'save'*/, side /*'home'|'away'*/),
  netImpact(goalSign /*-1 gol oeste, +1 gol leste*/, point /*Vector3*/, strength /*0..1*/),
  setWind({x,z}),                    // bandeirinhas
  dispose(),
}
```
Inclui: gramado (padrão de corte, variação, desgaste na pequena área), linhas
oficiais, traves/travessão/rede animada, bandeirinhas de escanteio, placas de LED
com anúncios fictícios animados, bancos de reservas, arquibancadas com torcida
instanciada animada pelo shader (reage a `excitement` e a `crowdReact`), cobertura,
refletores (noite), céu (dia/tarde/noite), luzes, ambiente PMREM. A torcida da
casa (metade oeste e laterais) usa `homeColor`; um setor visitante usa `awayColor`.

## Áudio — `js/audio.js`

```js
export class GameAudio {
  unlock()                              // chamar num gesto do usuário (click/touch)
  setVolumes({ master, crowd, sfx })    // 0..1
  update(dt, { excitement /*0..1*/, attackThreat /*0..1*/ })
  kick(power /*0..1*/, kind /*'pass'|'shot'|'long'|'header'|'volley'|'chip'|'throw'|'gk'*/)
  bounce(strength), post(strength), net(strength), tackle(strength), bodyHit(strength), catchBall()
  whistle(kind /*'short'|'foul'|'long'|'half'|'end'*/)
  crowd(kind /*'goal'|'ooh'|'save'|'boo'|'cheer'|'groan'*/, strength)
  chant(on /*bool*/)
  suspend(), resume()
}
```

## Menus/times/torneio — `js/teams.js`, `js/menus.js`, `js/tournament.js`

```js
// teams.js
export const TEAMS: Team[]            // 8 clubes fictícios
export function crestSVG(team, size): string
export function kitClash(kitA, kitB): boolean
Team = { id, name, short /*3 letras*/, city, formation /*chave de FORMATIONS*/,
  rating, style: { press /*0..1*/, width, tempo, directness },
  colors: { primary, secondary },
  kits: { home: Kit, away: Kit, gk: Kit, gkAway: Kit },
  players: Player[] /* 18: 11 titulares na ordem da formação, depois 7 reservas */ }
Kit = { shirt, sleeves, shorts, socks, pattern /*'plain'|'stripes'|'hoops'|'halves'|'sash'|'pinstripe'*/,
        second /*cor do padrão*/, trim, number /*cor do número*/ }
Player = { name /*como aparece: 'R. Moura'*/, num, pos /*'GOL','LD','ZAG','LE','VOL','MC','MEI','PD','PE','CA','ATA','ALD','ALE','MD','ME'*/,
  attrs: { pac, sho, pas, dri, def, phy, gk /*0..99*/ }, foot /*'D'|'E'*/,
  look: { skin /*#hex*/, hair /*'short'|'buzz'|'curly'|'long'|'bald'|'afro'|'bun'*/, hairColor, height /*m*/, build /*0..1*/, beard /*bool*/ } }

// menus.js
export function initMenus({ root /*HTMLElement*/, settings, saveSettings(settings), onStartMatch(cfg), audio })
export function showMainMenu()
export function showPause({ onResume, onRestart, onQuit, onSettings }) / hidePause()
export function showMatchResult(result, { onContinue })
MatchCfg = { mode: 'amistoso'|'copa'|'liga', home: Team, away: Team, homeKit: Kit, awayKit: Kit,
  homeGK: Kit, awayGK: Kit, userSide: 'home'|'away'|'none', knockout: boolean,
  settings /*snapshot*/, fixtureId?: string }
Result = { homeGoals, awayGoals, pens?: {home, away}, scorers: [{side, name, minute}],
  stats: { possession: [h,a], shots: [h,a], onTarget: [h,a], fouls: [h,a], corners: [h,a], offsides: [h,a], yellow: [h,a], red: [h,a] } }
```

## Jogadores — `js/anim.js`, `js/players3d.js`

```js
// anim.js — funções PURAS (o replay depende disso)
export function computePose(s, out /*Pose*/) -> Pose   // s = PoseState
PoseState = {
  anim: 'locomotion'|'idle'|'jockey'|'kick'|'pass'|'chip'|'volley'|'header'|'slide'|'tackle'|
        'throwin'|'gk_ready'|'gk_dive'|'gk_catch'|'gk_hold'|'gk_throw'|'gk_kick'|'fall'|'getup'|'celebrate'|'dejected',
  t,          // segundos desde o início da animação (ANIM[...] em config.js dá dur/contact)
  speed,      // m/s real
  moveAngle,  // ângulo do movimento relativo ao heading (0 = pra frente, ±π/2 lateral, π ré)
  stride,     // metros percorridos acumulados (fase da passada)
  lean,       // inclinação lateral nas curvas (rad, + = pra direita)
  foot,       // 1 = pé direito, -1 = esquerdo
  power,      // 0..1
  diveSide,   // 1 = à direita do goleiro, -1 = à esquerda
  diveHeight, // 0 (rasteira) .. 1 (ângulo)
  variant,    // inteiro para variações (tipo de comemoração etc.)
  lookYaw, lookPitch, // cabeça olhando para a bola, relativo ao corpo (rad)
  blendFrom: PoseState|null, blendW /*0..1 peso do estado atual*/
}
// players3d.js
export class PlayerMeshes {
  constructor(scene, { count: 22, quality, night: boolean })
  setPlayer(i, { kit: Kit, isGK: boolean, number, look })
  update(i, { x, y, z, heading, pose: PoseState })   // chama computePose internamente
  setIndicator(i, color /*'#hex'|null*/)   // anel no chão + seta sobre a cabeça
  setVisible(i, bool)
  footPos(i, foot, outVec3)                // posição do pé no mundo (após update)
  headPos(i, outVec3)
  handPos(i, side, outVec3)
  commit()                                 // envia matrizes à GPU uma vez por quadro
  dispose()
}
```
