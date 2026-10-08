// Vídeo de um impedimento NATURAL (IA x IA, nada montado): a simulação da partida usa um sorteio
// fixo (semente) só dentro de match.step — o desenho continua igual. 1ª passada: avança sem desenhar
// até o 1º impedimento marcado e anota o instante. 2ª passada, mesma semente: avança até ~SEG-5 s
// antes e grava quadro a quadro (relógio controlado, 1/FPS por quadro) até 5 s depois do apito.
// node tools/impedimento-clip.mjs [--semente 7] [--seg 25] [--fps 30] [--w 960 --h 540] [--q alta]
//      [--tod noite] [--port 8790] [--out /pasta]
import { mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { openGame, startMatch, pumpOn, stepFrame } from './pump.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SEM = +arg('semente', 7), SEG = +arg('seg', 25), FPS = +arg('fps', 30), out = arg('out', '/tmp/impedimento');
const opts = { w: +arg('w', 960), h: +arg('h', 540), dpr: 1, port: arg('port', '8790') };

// sorteio com semente só na simulação (mulberry32) — instalado antes do 1º passo da partida
async function semear(page, s) {
  await page.evaluate((seed) => {
    const m = window.__golaco.game.match;
    let st = seed >>> 0;
    const rng = () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const real = Math.random, step = m.step.bind(m);
    m.step = (dt, cmd) => { Math.random = rng; try { return step(dt, cmd); } finally { Math.random = real; } };
    // o que a criação da partida sorteou fora do passo (pontapé inicial, vento, tempo de reação)
    // também vira semente — as duas passadas começam idênticas
    Math.random = rng;
    try {
      for (const p of m.players) { p.aiTimer = rng() * 0.4; p.vx = p.vz = 0; }
      m.wind = { x: 0, z: 0 };
      m.time = 0; m.clock = 0;             // os quadros antes de ligar a semente não contam
      m.setupKickoff(m.teams[0]);
    } finally { Math.random = real; }
  }, s);
}
const imped = (page) => page.evaluate(() => { const m = window.__golaco.game.match; return { n: m.teams[0].stats.offsides + m.teams[1].stats.offsides, t: m.time, clock: m.clock }; });

async function partida() {
  const g = await openGame(opts);
  await startMatch(g.page, { quality: arg('q', 'alta'), timeOfDay: arg('tod', 'noite'), userSide: 'none' });
  await pumpOn(g.page);
  await semear(g.page, SEM);
  return g;
}

// 1ª passada: onde acontece o 1º impedimento (tempo de simulação da partida)
let g = await partida();
let tImp = null;
for (let s = 0; s < 900 && tImp === null; s++) {
  await g.page.evaluate(() => window.__golaco.advance(1));
  const r = await imped(g.page);
  if (r.n > 0) tImp = r.t;
}
await g.browser.close();
if (tImp === null) { console.log('nenhum impedimento em 15 min de jogo com esta semente'); process.exit(1); }
console.log(`1ª passada: impedimento perto de t=${tImp.toFixed(1)} s`);

// 2ª passada: mesma semente, avança até SEG-5 s antes e grava
g = await partida();
const ini = Math.max(0, tImp - (SEG - 5));
await g.page.evaluate((s) => window.__golaco.advance(s), Math.floor(ini));
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
const N = Math.round(SEG * FPS);
let visto = null;
for (let i = 0; i < N; i++) {
  await stepFrame(g.page, 1000 / FPS);
  await g.page.screenshot({ path: `${out}/f${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 88, timeout: 300000 });
  if (visto === null) { const r = await imped(g.page); if (r.n > 0) visto = i / FPS; }
}
await g.browser.close();
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `${out}/f%04d.jpg`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', `${out}.mp4`]);
console.log(`2ª passada: impedimento marcado em ${visto === null ? 'NÃO APARECEU (a simulação divergiu)' : visto.toFixed(1) + ' s do vídeo'} | ${N} quadros a ${FPS} qps → ${out}.mp4`);
process.exit(visto === null ? 1 : 0);
