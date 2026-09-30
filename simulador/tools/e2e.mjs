// Testes de robustez no navegador: entradas rápidas, redimensionamento, segundo plano,
// dados salvos corrompidos, sair no meio da partida, modo "só a bola".
// Servidor: python3 -m http.server 8791 (na pasta simulador/)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const out = process.env.SHOTS || '/tmp/lal';
let fails = 0;
const ok = (c, m) => { console.log(c ? '  ok ' : '  FALHOU ', m); if (!c) fails++; };

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

// 1) dados corrompidos no armazenamento
console.log('Dados corrompidos');
await page.goto('http://localhost:8791/index.html');
await page.evaluate(() => {
  localStorage.setItem('lal.settings.v1', '{isso não é json');
  localStorage.setItem('lal.season.v1', JSON.stringify({ v: 1, user: 'x', rounds: 3 }));
  localStorage.setItem('lal.history.v1', JSON.stringify([{ lixo: true }, 5, null]));
});
await page.reload();
await page.waitForSelector('#home', { timeout: 5000 });
ok(true, 'abre com configurações corrompidas');
await page.click('text=Campeonato');
await page.waitForSelector('#season');
ok(await page.locator('text=Começar temporada').count() === 1, 'campeonato corrompido é descartado e oferece novo');
ok(await page.evaluate(() => localStorage.getItem('lal.season.v1')) === null, 'temporada inválida removida');
await page.keyboard.press('Escape');
await page.waitForSelector('#home');

// 2) entradas rápidas e inesperadas durante a partida
console.log('Entradas rápidas');
await page.click('text=Partida rápida');
await page.click('text=Começar partida');
await page.waitForSelector('#match');
for (let i = 0; i < 40; i++) await page.keyboard.press(['1', '2', '3', '4', ' ', 'k'][i % 6]);
await page.keyboard.press('4');
for (let i = 0; i < 6; i++) { await page.keyboard.press('t'); await page.keyboard.press('Escape'); }
ok(await page.locator('.overlay').count() === 0, 'abrir/fechar táticas repetido não deixa diálogo preso');
const running = await page.evaluate(() => window.__lal.app.matchView.running);
if (!running) await page.keyboard.press(' ');
const t0 = await page.evaluate(() => window.__lal.app.matchView.match.tAll);
await page.waitForTimeout(1500);
const t1 = await page.evaluate(() => window.__lal.app.matchView.match.tAll);
ok(t1 > t0, `partida continua avançando depois de entradas rápidas (${t0.toFixed(1)} → ${t1.toFixed(1)} s)`);
// cliques repetidos no pular: só um pulo por vez
await Promise.all([page.keyboard.press('n'), page.keyboard.press('n'), page.keyboard.press('n')]);
await page.waitForSelector('.sheet >> text=Intervalo', { timeout: 20000 });
ok((await page.locator('.overlay').count()) === 1, 'um único diálogo de intervalo');
ok(await page.evaluate(() => window.__lal.app.matchView.match.phase) === 'halftime', 'parou no intervalo');
await page.keyboard.press('Escape');
ok((await page.locator('.overlay').count()) === 1, 'Esc não fecha o intervalo (precisa escolher)');
await page.click('text=Começar 2º tempo');

// 3) redimensionamento e orientação
console.log('Redimensionamento');
for (const [w, h] of [[390, 844], [844, 390], [1920, 1080], [320, 568], [1024, 768]]) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(250);
  const r = await page.evaluate(() => { const rr = window.__lal.app.matchView.renderer; const c = rr.canvas.getBoundingClientRect(); return { cw: c.width, ch: c.height, vertical: rr.vertical, w: rr.w, h: rr.h, sw: document.documentElement.scrollWidth, iw: innerWidth }; });
  ok(r.cw > 100 && r.ch > 100 && r.w > 0, `${w}x${h}: campo visível (${Math.round(r.cw)}x${Math.round(r.ch)}, ${r.vertical ? 'vertical' : 'horizontal'})`);
  ok(r.sw <= r.iw + 1, `${w}x${h}: sem rolagem horizontal`);
  if (w === 320) await page.screenshot({ path: `${out}-e2e-320.png` });
}

// 4) segundo plano: pausa sozinho
console.log('Perda de foco');
await page.evaluate(() => { if (!window.__lal.app.matchView.running) window.__lal.app.matchView.setRunning(true); });
await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
ok(await page.evaluate(() => window.__lal.app.matchView.running) === false, 'pausa ao ir para segundo plano');
await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
ok(await page.locator('.toast').count() === 1, 'avisa que pausou');

// 5) modo só a bola
console.log('Modo "só a bola"');
await page.evaluate(() => { window.__lal.app.settings.view = 'bola'; window.__lal.app.matchView.setRunning(true); });
await page.setViewportSize({ width: 1280, height: 800 });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}-e2e-bola.png` });
ok(true, 'print do modo só a bola');

// 6) sair no meio e começar outra: o laço antigo precisa parar
console.log('Sair no meio');
await page.evaluate(() => { window.__lal.app.settings.view = 'completo'; });
await page.keyboard.press('Escape');
await page.waitForSelector('text=Sair da partida?');
await page.click('.sheet button.danger');
await page.waitForSelector('#home');
const oldMatch = await page.evaluateHandle(() => window.__lal.app.matchView);
ok(await page.evaluate((m) => m === null, oldMatch), 'partida destruída ao sair');
await page.click('text=Partida rápida');
await page.click('text=Começar partida');
await page.waitForSelector('#match');
ok(await page.locator('#match').count() === 1 && await page.locator('#pitch').count() === 1, 'só uma tela de partida no DOM');
// rematch/menu várias vezes: memória não deve crescer sem parar
const heap = [];
for (let i = 0; i < 4; i++) {
  console.log('  iteração', i, JSON.stringify(await page.evaluate(() => { const mv = window.__lal.app.matchView; return { phase: mv.match.phase, skipping: mv.skipping, overlays: document.querySelectorAll('.overlay').length, active: document.activeElement?.tagName }; })));
  await page.keyboard.press('n');
  await page.waitForSelector('.sheet >> text=Intervalo', { timeout: 20000 });
  await page.click('text=Começar 2º tempo');
  await page.keyboard.press('n');
  await page.waitForSelector('.sheet >> text=Fim de jogo', { timeout: 30000 });
  await page.click('text=Revanche');
  await page.waitForSelector('#match');
  heap.push(await page.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0)));
}
console.log('  heap após cada revanche (MB):', heap.map((x) => x.toFixed(1)).join(' '));
ok(heap[3] < heap[0] * 2.5 + 5, 'memória estável entre partidas');
ok(await page.evaluate(() => JSON.parse(localStorage.getItem('lal.history.v1')).length) >= 4, 'histórico gravado');

console.log(errors.length ? 'erros:\n' + errors.join('\n') : 'sem erros no console');
if (errors.length) fails++;
await b.close();
console.log(fails ? `${fails} falha(s)` : 'tudo ok');
process.exit(fails ? 1 : 0);
