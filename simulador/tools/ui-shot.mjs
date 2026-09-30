// Percorre as telas no Chromium, tira prints e coleta erros do console.
// Servidor: python3 -m http.server 8791 (na pasta simulador/)
// Uso: node tools/ui-shot.mjs [--w 1440 --h 900] [--mobile] [--out prefixo] [--q alto] [--flow all|match|season]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const flag = (k) => process.argv.includes('--' + k);
const W = +arg('w', 1440), H = +arg('h', 900);
const out = arg('out', process.env.SHOTS || '/tmp/lal');
const port = arg('port', '8791');
const flow = arg('flow', 'all');
const mobile = flag('mobile');

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.addInitScript((q) => { if (q) localStorage.setItem('lal.settings.v1', JSON.stringify({ quality: q, sound: false })); else localStorage.setItem('lal.settings.v1', JSON.stringify({ sound: false })); }, arg('q', ''));
await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'load' });
await page.waitForSelector('#home');
await page.waitForTimeout(1200);
const shot = async (name) => { await page.screenshot({ path: `${out}-${name}.png` }); console.log('print', `${out}-${name}.png`); };
await shot('home');

if (flow === 'all' || flow === 'match') {
  await page.click('text=Partida rápida');
  await page.waitForSelector('#quick');
  await shot('quick');
  await page.click('text=Começar partida');
  await page.waitForSelector('#match');
  await page.waitForTimeout(600);
  // acelera para ver jogo corrido
  await page.keyboard.press('4');
  await page.waitForTimeout(6000);
  await shot('match');
  const st = await page.evaluate(() => { const m = window.__lal.app.matchView.match; return { clock: m.clockLabel, score: m.teams.map((t) => t.score), ev: m.events.length, fps: window.__lal.app.monitor.fps.toFixed(0) }; });
  console.log('estado', JSON.stringify(st));
  await page.click('#tab-stats'); await page.waitForTimeout(1300); await shot('stats');
  await page.click('#tab-mom'); await page.waitForTimeout(1300); await shot('mom');
  await page.click('#tab-teams'); await page.waitForTimeout(1300); await shot('teams');
  await page.click('#tab-feed');
  await page.keyboard.press('t');
  await page.waitForSelector('.sheet');
  await page.waitForTimeout(300);
  await shot('tactics');
  // faz uma substituição
  const outBtn = page.locator('.plist').nth(0).locator('button').nth(5);
  await outBtn.click();
  await page.locator('.plist').nth(1).locator('button').first().click();
  await page.click('text=Confirmar troca');
  await page.waitForTimeout(200);
  console.log('aviso troca:', await page.locator('.notice').first().textContent());
  await page.click('text=Voltar ao jogo');
  // pula até o intervalo
  await page.keyboard.press('n');
  await page.waitForSelector('.sheet >> text=Intervalo', { timeout: 20000 });
  await page.waitForTimeout(300);
  await shot('halftime');
  await page.click('text=Começar 2º tempo');
  await page.waitForTimeout(1500);
  await page.keyboard.press('n');
  await page.waitForSelector('.sheet >> text=Fim de jogo', { timeout: 30000 });
  await page.waitForTimeout(400);
  await shot('fulltime');
  await page.click('text=Menu');
  await page.waitForSelector('#home');
  // resultado direto (sem assistir)
  await page.click('text=Partida rápida');
  await page.click('text=Resultado direto');
  await page.waitForSelector('.sheet >> text=Fim de jogo', { timeout: 30000 });
  await page.waitForTimeout(500);
  await shot('instant');
  await page.click('text=Menu');
  await page.waitForSelector('#home');
  console.log('histórico:', await page.evaluate(() => localStorage.getItem('lal.history.v1')));
}

if (flow === 'all' || flow === 'season') {
  await page.click('text=Campeonato');
  await page.waitForSelector('#season');
  await shot('season-pick');
  await page.click('text=Começar temporada');
  await page.waitForSelector('#season .hub');
  await page.click('text=Simular rodada');
  await page.waitForSelector('text=Resultados da rodada 1', { timeout: 30000 });
  await page.waitForTimeout(300);
  await shot('season-hub');
  await page.click('text=Jogar e comandar');
  await page.waitForSelector('#match');
  await page.waitForTimeout(800);
  await page.keyboard.press('n');
  await page.waitForSelector('.sheet >> text=Intervalo', { timeout: 20000 });
  await page.click('text=Começar 2º tempo');
  await page.keyboard.press('n');
  await page.waitForSelector('.sheet >> text=Fim de jogo', { timeout: 30000 });
  await page.click('text=Continuar campeonato');
  await page.waitForSelector('text=Resultados da rodada 2', { timeout: 30000 });
  await page.waitForTimeout(300);
  await shot('season-hub2');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('lal.season.v1')).round);
  console.log('rodada salva:', saved);
  await page.click('[aria-label="Voltar"]');
  await page.click('text=Configurações');
  await page.waitForSelector('#settings');
  await shot('settings');
  await page.keyboard.press('Escape');
  await page.click('text=Diagnóstico');
  await page.waitForSelector('#diag');
  await shot('diag');
}
console.log('erros:', errors.length ? '\n' + errors.join('\n') : 'nenhum');
await b.close();
process.exit(errors.some((e) => e.startsWith('pageerror') || e.startsWith('error')) ? 1 : 0);
