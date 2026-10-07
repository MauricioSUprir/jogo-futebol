// Vídeos de movimento da auditoria (Fase 2), gravados quadro a quadro com relógio controlado
// (pump.mjs: passo fixo, sem câmera lenta), torcida e HUD ligados, MP4 H.264:
//   a  arrancada conduzindo ~30 m, câmera lateral próxima (vai e volta, 20 s)
//   b  giros de 180° e cortes de 90° conduzindo, câmera lateral alta
//   c  passe, domínio e chute (câmera de TV do jogo)
// Nos cenários a e b só o jogador com a bola se mexe (os outros ficam parados longe), para o
// movimento dele aparecer limpo. O jogador é controlado por um "dedo" de teste (direcional de
// toque e botões), como um humano.
// node tools/cenas.mjs --cena a|b|c [--seg 20] [--fps 30] [--w 960 --h 540] [--q alta]
//      [--tod dia] [--port 8790] [--out /pasta/video]
import { mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { openGame, startMatch, pumpOn, stepFrame } from './pump.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const cena = arg('cena', 'a'), SEG = +arg('seg', 20), FPS = +arg('fps', 30), out = arg('out', '/tmp/cena');
const N = Math.round(SEG * FPS);
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
const { browser, page, errors } = await openGame({ w: +arg('w', 960), h: +arg('h', 540), dpr: 1, port: arg('port', '8790') });
await startMatch(page, { quality: arg('q', 'alta'), timeOfDay: arg('tod', 'dia'), userSide: 'home' });
await pumpOn(page);
// saída de bola pelo comando da partida (vale em qualquer versão)
await page.evaluate(() => window.__golaco.advance(1));
await page.evaluate(() => window.__golaco.advance(0.1, () => ({ mx: 0, mz: 0, held: { pass: true }, press: { pass: true }, release: {}, hold: {}, rx: 0, rz: 0 })));
await page.evaluate(() => window.__golaco.advance(2, () => ({ mx: 0, mz: 0, held: {}, press: {}, release: { pass: true }, hold: { pass: 0.1 }, rx: 0, rz: 0 })));

// prepara o lance: jogador da casa com a bola num ponto; os demais longe e parados (a, b)
await page.evaluate((cena) => {
  const g = window.__golaco.game, m = g.match, us = m.userTeam;
  const me = us.players[9], dir = m.goalX(us) > 0 ? 1 : -1;
  const x0 = cena === 'c' ? dir * 14 : -dir * 22, z0 = cena === 'c' ? -9 : -16;
  window.__cena = { me: me.idx, dir, x0, z0 };
  m.phase = 'play';
  for (const q of m.players) { q.action = null; q.stun = 0; q.vx = q.vz = 0; }
  me.x = x0; me.z = z0; me.heading = dir > 0 ? 0 : Math.PI;
  m.ball.place(x0 + dir * 0.4, 0.11, z0 + 0.1 * me.foot);
  m.takeBall(me, 'control'); m.setControlled(me);
  if (cena === 'c') {
    // companheiro para receber; adversários de linha longe (só o goleiro defende)
    const mate = us.players[10];
    mate.x = dir * 26; mate.z = 6; mate.vx = mate.vz = 0;
    // dois zagueiros ficam na linha de fundo, abertos perto das bandeirinhas (parados até o chute):
    // assim o companheiro está em posição legal e ninguém atrapalha o lance. Antes todos iam para
    // o outro campo e o passe virava impedimento
    us.opp.players.filter(q => !q.isGK).forEach((q, k) => {
      if (k < 2) { q.x = dir * 51; q.z = k ? 30 : -30; } else { q.x = -dir * 30 + (q.idx % 5) * 3; q.z = (q.idx % 11) * 5 - 25; }
    });
    window.__cena.fundo = us.opp.players.filter(q => !q.isGK).slice(0, 2).map(q => m.players.indexOf(q));
    // registra os lances (chute, gol, impedimento…) para o relatório do vídeo
    window.__lances = [];
    const emit = m.emit.bind(m);
    m.emit = (type, d) => {
      if (['kick', 'goal', 'offside', 'banner', 'save', 'catch'].includes(type)) window.__lances.push(`${m.time.toFixed(1)}s ${type}${d?.src ? ':' + d.src : d?.text ? ':' + d.text : ''}`);
      return emit(type, d);
    };
    for (const q of us.players) if (q !== me && q !== mate && !q.isGK) { q.x = -dir * 20 + (q.idx % 5) * 2; q.z = (q.idx % 11) * 5 - 25; }
  } else {
    for (const q of m.players) if (q !== me && !q.isGK) { q.x = (q.team === us ? -1 : 1) * dir * 40 + (q.idx % 4) * 2; q.z = 22 + (q.idx % 11) * 1.2; }
  }
}, cena);

// roteiro: direção pedida (mundo, em unidades do sentido de ataque) + arrancada + botões
const ROTEIRO = {
  a: (t) => t < 0.4 ? null : t < 5 ? [1, 0, true] : t < 7 ? [1, 0, false] : t < 7.8 ? null : t < 12.5 ? [-1, 0, true] : t < 14 ? [-1, 0, false] : t < 14.6 ? null : [1, 0, true],
  b: (t) => t < 0.4 ? null : t < 2.5 ? [1, 0, false] : t < 5 ? [-1, 0, false] : t < 7.5 ? [0, 1, false] : t < 10 ? [1, 0, true] : t < 12.5 ? [-1, 0, true] : t < 15 ? [0, -1, false] : t < 17.5 ? [1, 0, false] : [0, 1, false],
};
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const t = i / FPS;
  await page.evaluate(({ cena, t, r }) => {
    const G = window.__golaco, g = G.game, m = g.match, I = G.input, C = window.__cena;
    const me = m.players[C.me];
    // os outros ficam parados (a, b)
    if (cena !== 'c') for (const q of m.players) if (q !== me && !q.isGK) { q.stun = 0.3; q.dx = q.dz = 0; }
    if (cena === 'c' && t < 4.5) for (const i of C.fundo) { const q = m.players[i]; q.stun = 0.3; q.dx = q.dz = 0; }
    let dx = 0, dz = 0, spr = false;
    const btn = {};
    if (cena === 'c') {
      // 0,3 s: passe para o companheiro · domina · conduz rumo ao gol · 3,6 s: chute
      const c = m.controlled;
      const gx = m.goalX(c.team);
      if (t < 0.6) { const mate = m.players.find(q => q.team === c.team && q.idx !== c.idx && Math.hypot(q.x - c.x, q.z - c.z) < 25 && !q.isGK) || c; dx = mate.x - c.x; dz = mate.z - c.z; btn.pass = t > 0.3 && t < 0.45; }
      else if (t < 3.6) { dx = gx - c.x; dz = -c.z * 0.5; spr = true; }
      else if (t < 4.2) { dx = gx - c.x; dz = -c.z; btn.shoot = t < 3.95; }
      else { dx = gx - c.x; dz = -c.z; btn.pass = (Math.floor(t * 2) % 6 === 0); }   // depois: segue o jogo (e dá a saída se precisar)
    } else if (r) { dx = r[0] * C.dir; dz = r[1]; spr = r[2]; }
    const L = Math.hypot(dx, dz);
    if (L > 0.01) {
      const R = g.rig.right, F = g.rig.fwd;
      I.touchStick.id = 99; I.touchStick.x = (dx * R.x + dz * R.z) / L; I.touchStick.y = (dx * F.x + dz * F.z) / L; I.touchStick.sprint = spr;
    } else { I.touchStick.id = null; I.touchStick.x = 0; I.touchStick.y = 0; I.touchStick.sprint = false; }
    I.touchBtn.pass = !!btn.pass; I.touchBtn.shoot = !!btn.shoot;
    // câmera: lateral próxima (a) / lateral alta (b) acompanhando quem tem a bola
    if (cena !== 'c') {
      const p = m.owner || me, b = m.ball.p;
      const cx = (p.x + b.x) / 2, cz = (p.z + b.z) / 2;
      const mk = (o) => ({ ...o, copy() {}, set() {} });
      const pos = cena === 'a' ? { x: cx - C.dir * 1.2, y: 1.35, z: cz - 6.4 } : { x: cx, y: 5.2, z: cz - 10.5 };
      const look = cena === 'a' ? { x: cx + C.dir * 0.8, y: 0.85, z: cz } : { x: cx, y: 0.4, z: cz };
      if (!g.rig.cine || g.rig.cine.type !== 'manual') { g.rig.setCinematic({ type: 'manual', pos: mk(pos), look: mk(look), fov: cena === 'a' ? 40 : 46, lam: 9 }); g.rig.snap = true; }
      else { Object.assign(g.rig.cine.pos, pos); Object.assign(g.rig.cine.look, look); }
    }
  }, { cena, t, r: ROTEIRO[cena] ? ROTEIRO[cena](t) : null });
  await stepFrame(page, 1000 / FPS);
  await page.screenshot({ path: `${out}/f${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 88, timeout: 300000 });
  if (i % 60 === 0) console.log(`quadro ${i}/${N} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
const lances = await page.evaluate(() => window.__lances || []);
if (lances.length) console.log('lances:', lances.join(' | '));
await browser.close();
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', `${out}/f%04d.jpg`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', `${out}.mp4`]);
const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', `${out}.mp4`]).toString().trim();
console.log(`vídeo ${out}.mp4: ${N} quadros a ${FPS} qps = ${(+dur).toFixed(1)} s`, errors.length ? 'ERROS: ' + errors.join(' | ') : 'sem erros de página');
