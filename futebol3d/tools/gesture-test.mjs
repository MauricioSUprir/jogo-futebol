// Controles de toque simplificados (4 botões + gestos): confere cada gesto e tira prints
// do ataque e da defesa. node tools/gesture-test.mjs [--out prefixo]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { routeCDN } from './cdn-route.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const out = arg('out', '/tmp/gesto');
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
await routeCDN(ctx); const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:8790/index.html'); await p.waitForTimeout(2000);
await p.evaluate(async () => { const T = await import('./js/teams.js'); const k = T.resolveKits(T.TEAMS[0], T.TEAMS[3]);
  await window.__golaco.startMatch({ mode: 'amistoso', home: T.TEAMS[0], away: T.TEAMS[3], ...k, userSide: 'home', settings: { ...window.__golaco.settings(), quality: 'baixa', intro: false } }); });
await p.waitForFunction(() => window.__golaco.game, null, { timeout: 120000 });
await p.waitForTimeout(1500);
// congela o jogo para os botões não dispararem ações de verdade durante o teste
await p.evaluate(() => { window.__golaco.game.paused = true; });
// trava o contexto escolhido (o laço do jogo chama setContext a cada quadro)
await p.evaluate(() => { const I = window.__golaco.input; I._set = I.setContext.bind(I); I.setContext = () => {}; });
const setCtx = (c) => p.evaluate((c) => { const I = window.__golaco.input; I.context = ''; I._set(c); }, c);
const edges = () => p.evaluate(() => { const I = window.__golaco.input, g = window.__golaco.game; const c = I.poll(g.rig.right, g.rig.fwd);
  const r = { press: Object.keys(c.press), release: Object.keys(c.release) }; I.consume(); return r; });
const center = async (sel) => { const bx = await p.locator(sel).boundingBox(); return [bx.x + bx.width / 2, bx.y + bx.height / 2]; };
let ok = true;
const check = (name, cond, info) => { console.log((cond ? 'ok   ' : 'FALHA'), name, JSON.stringify(info)); if (!cond) ok = false; };
async function drag(sel, dx, dy) {
  const [x, y] = await center(sel);
  await p.mouse.move(x, y); await p.mouse.down(); const e0 = await edges();
  await p.mouse.move(x + dx, y + dy, { steps: 6 }); await p.waitForTimeout(150);
  await p.mouse.up(); await p.waitForTimeout(50);
  const e1 = await edges();
  return { press: [...e0.press, ...e1.press], release: e1.release };
}
await setCtx('attack');
// a GPU simulada deixa cada quadro com segundos: o limite de tempo do deslize não vale aqui
await p.evaluate(() => { window.__golaco.input.swipeMs = 1e6; });
check('4 botões no ataque', (await p.locator('.tc-btn:visible').count()) === 4, await p.locator('.tc-btn span').allTextContents());
let e = await drag('.tc-pass', 0, 0); check('toque no passe = passe', e.release.includes('pass'), e);
e = await drag('.tc-pass', 0, -60); check('passe arrastado ↑ = lançamento', e.release.includes('long') && !e.release.includes('pass'), e);
e = await drag('.tc-shoot', 0, -60); check('chute ↑ = cavadinha', e.release.includes('chip') && !e.release.includes('shoot'), e);
e = await drag('.tc-shoot', 60, 0); check('chute → = colocado', e.release.includes('finesse'), e);
e = await drag('.tc-third', 0, 0); check('3º botão no ataque = enfiada', e.release.includes('through'), e);
// deslizar na área livre da direita = drible
await edges(); await p.mouse.move(560, 120); await p.mouse.down(); await p.mouse.move(640, 110, { steps: 3 }); await p.mouse.up(); await p.waitForTimeout(30);
e = await edges(); check('deslizar à direita = drible', e.press.includes('skill'), e);
await p.screenshot({ path: `${out}-ataque.png` });
await setCtx('defend');
e = await drag('.tc-third', 0, 0); check('3º botão na defesa = TROCAR', e.press.includes('switch'), e);
check('5 botões na defesa (com DIVIDIDA)', (await p.locator('.tc-btn:visible').count()) === 5, await p.locator('.tc-btn:visible span').allTextContents());
e = await drag('.tc-tackle', 0, 0); check('DIVIDIDA', e.press.includes('tackle'), e);
e = await drag('.tc-third', -70, 0); check('TROCAR arrastado = troca direcional', e.press.includes('switchdir') && !e.press.includes('switch'), e);
await p.screenshot({ path: `${out}-defesa.png` });
await setCtx('loose');
e = await drag('.tc-third', 0, 0); check('bola solta: 3º = TROCAR', e.press.includes('switch'), e);
check('sem erros de página', errs.length === 0, errs);
console.log(ok ? 'GESTOS OK' : 'HÁ FALHAS');
await b.close();
process.exit(ok ? 0 : 1);
