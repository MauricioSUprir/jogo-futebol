// Força um gol e fotografa a comemoração e o replay.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { routeCDN } from './cdn-route.mjs';
const S = '/tmp/claude-0/-home-user-jogo-futebol/9805b587-e422-5403-9106-8bf9d9184706/scratchpad/goal';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
await routeCDN(ctx); const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:8790/index.html'); await p.waitForTimeout(2000);
await p.evaluate(async () => { const T = await import('./js/teams.js'); const k = T.resolveKits(T.TEAMS[1], T.TEAMS[2]);
  await window.__golaco.startMatch({ mode: 'amistoso', home: T.TEAMS[1], away: T.TEAMS[2], ...k, userSide: 'home', settings: { ...window.__golaco.settings(), quality: 'alta', timeOfDay: 'noite' } }); });
await p.waitForTimeout(1500);
const r = await p.evaluate(() => {
  const G = window.__golaco, g = G.game, m = g.match;
  m.phase = 'play'; m.sp = null;
  const t = m.userTeam, gx = m.goalX(t), s = Math.sign(gx);
  const sh = t.players[9];
  for (let tries = 0; tries < 8 && m.phase !== 'goal'; tries++) {
    m.phase = 'play'; m.sp = null;
    for (const q of m.players) if (!q.isGK && q !== sh) q.teleport(-s * 20, (q.idx % 11) * 3 - 15, 0);
    t.opp.gk.teleport(gx - s * 0.5, 3, s > 0 ? Math.PI : 0);
    sh.teleport(gx - s * 17, 4, s > 0 ? 0 : Math.PI);
    m.ball.place(gx - s * 16.4, 0.11, 4); m.owner = sh;
    sh.startAction('shot', { target: { x: gx, y: 0.6, z: -2.9 }, power: 0.75, face: Math.atan2(-6.9, s * 16.4) });
    for (let i = 0; i < 240 && m.phase !== 'goal'; i++) G.advance(1 / 60);
  }
  const out = { phase: m.phase, score: m.teams.map(x => x.score), ball: [m.ball.p.x, m.ball.p.y, m.ball.p.z].map(v => v.toFixed(1)), owner: m.owner && m.owner.data.name, shots: t.stats.shots, gx, shx: sh.x.toFixed(1), act: sh.action && sh.action.type };
  G.advance(2.2);
  return out;
});
console.log(JSON.stringify(r));
await p.waitForTimeout(16000);
console.log(await p.evaluate(() => { const g = window.__golaco.game; const c = g.camera; const sc = g.match.goalInfo?.scorer; return JSON.stringify({ cam: c.position.toArray().map(v => v.toFixed(1)), look: g.rig.look.toArray().map(v => v.toFixed(1)), fov: c.fov.toFixed(0), scorer: sc && [sc.x.toFixed(1), sc.z.toFixed(1)], cut: g.celebCutT, fps: g.fps, frames: g.frames, cine: g.rig.cine && g.rig.cine.type, phase: g.match.phase }); }));
await p.screenshot({ path: S + '-celebra.png' });
await p.evaluate(() => { const G = window.__golaco; G.replayNow(); const rp = G.game.replay; rp.pos = rp.len * 0.62; rp.speed = 0.0001; });
await p.waitForTimeout(6000);
await p.screenshot({ path: S + '-replay.png' });
console.log('erros', errs.join('\n') || 'nenhum');
await b.close();
