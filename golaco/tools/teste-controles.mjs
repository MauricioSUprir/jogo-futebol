// Controles na página (navegador): teclado no PC e toque no celular, de verdade (eventos do
// Chromium, não chamadas diretas): o jogador anda para o lado certo DA TELA (o deslocamento é
// projetado pela câmera: direita = direita, cima = para cima/longe da câmera), arrancada,
// condução curta, menu/ajuda/câmera/máquina/marcador/recomeço pelas teclas; no celular o
// analógico flutuante (arrastar na metade esquerda) para a direita e para cima, CORRER junto
// (dois dedos), CONDUÇÃO segurado (condução curta) e em dois toques (pedalada), botão de menu.
//   node tools/teste-controles.mjs
import { servidor, abrir } from './lib/navegador.mjs';

const res = [];
const meta = (nome, medido, ok) => res.push({ nome, medido, ok });
const srv = await servidor();

async function quadros(pagina, n) {
  return pagina.evaluate(n => { const g = window.__golaco; for (let i = 0; i < n; i++) g.relogio.avancar(1000 / 60, { desenhar: i === n - 1 }); return g.estado(); }, n);
}
/** Deslocamento NA TELA (px) entre duas posições do jogador, com a câmera de agora: confere
 *  "direita no controle = direita na tela; cima = para cima na tela (longe da câmera)". */
async function naTela(pagina, a, b) {
  return pagina.evaluate(([a, b]) => {
    const g = window.__golaco;
    const p = g.naTela(a.x, 0, a.z), q = g.naTela(b.x, 0, b.z);
    return { dx: q.x - p.x, dy: q.y - p.y };
  }, [a, b]);
}
const telaTxt = t => `tela dx ${t.dx.toFixed(0)} px, dy ${t.dy.toFixed(0)} px`;

// ------------------------------------------------------------------ PC: teclado
{
  const { navegador, pagina, erros } = await abrir({ largura: 1280, altura: 720 });
  try {
    await pagina.goto(srv.url + '?q=baixa', { waitUntil: 'load' });
    await pagina.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 120000 });
    await pagina.evaluate(() => { window.__golaco.reiniciar({ semente: 2 }); window.__golaco.relogio.usarManual(true); });
    await pagina.mouse.click(640, 400);
    const e0 = await quadros(pagina, 2);
    await pagina.keyboard.down('KeyW');
    const e1 = await quadros(pagina, 90);
    const tW = await naTela(pagina, e0.jogador, e1.jogador);
    meta('W: anda para cima na tela (z diminui)', `z ${e0.jogador.z.toFixed(2)} → ${e1.jogador.z.toFixed(2)}, ${telaTxt(tW)}, ${e1.kmh.toFixed(1)} km/h, ${e1.modo}`, e1.jogador.z < e0.jogador.z - 2 && tW.dy < -20 && Math.abs(tW.dx) < -tW.dy * 0.3 && e1.kmh > 12 && e1.modo === 'Conduzindo');
    await pagina.keyboard.up('KeyW');
    await pagina.keyboard.down('KeyD');
    await pagina.keyboard.down('Shift');
    const e2 = await quadros(pagina, 120);
    const tD = await naTela(pagina, e1.jogador, e2.jogador);
    meta('D + Shift: arrancada para a direita da tela (x aumenta)', `x ${e1.jogador.x.toFixed(2)} → ${e2.jogador.x.toFixed(2)}, ${telaTxt(tD)}, ${e2.kmh.toFixed(1)} km/h, ${e2.modo}`, e2.jogador.x > e1.jogador.x + 3 && tD.dx > 20 && e2.kmh > 24 && e2.modo === 'Arrancada');
    await pagina.keyboard.up('Shift');
    await pagina.keyboard.down('KeyE');
    const e3 = await quadros(pagina, 90);
    meta('E: condução curta (devagar)', `${e3.kmh.toFixed(1)} km/h, ${e3.modo}`, e3.modo === 'Condução curta' && e3.kmh < 11);
    await pagina.keyboard.up('KeyE');
    await pagina.keyboard.up('KeyD');
    await pagina.keyboard.press('Escape');
    const menu = await pagina.evaluate(() => !document.getElementById('menu').hidden);
    const t0 = (await quadros(pagina, 30)).tick;
    const t1 = (await quadros(pagina, 30)).tick;
    await pagina.keyboard.press('Escape');
    const menuFechou = await pagina.evaluate(() => document.getElementById('menu').hidden);
    meta('Esc abre o menu e pausa; Esc fecha', `menu ${menu ? 'aberto' : 'fechado'}, ticks parados ${t0 === t1}, fechou ${menuFechou}`, menu && t0 === t1 && menuFechou);
    await pagina.keyboard.press('KeyH');
    const ajuda = await pagina.evaluate(() => !document.getElementById('ajuda').hidden);
    await pagina.keyboard.press('KeyH');
    const ajudaFechou = await pagina.evaluate(() => document.getElementById('ajuda').hidden);
    meta('H abre e fecha a ajuda', `${ajuda} / ${ajudaFechou}`, ajuda && ajudaFechou);
    await pagina.keyboard.press('KeyC');
    await quadros(pagina, 2);
    const cam = await pagina.evaluate(() => window.__golaco.camera);
    await pagina.keyboard.press('KeyC');
    await quadros(pagina, 2);
    const cam2 = await pagina.evaluate(() => window.__golaco.camera);
    meta('C alterna a câmera', `${cam} → ${cam2}`, cam === 'aproximada' && cam2 === 'tv');
    await pagina.keyboard.press('KeyN');
    const eN = await quadros(pagina, 3);
    await pagina.keyboard.press('KeyM');
    const eM = await quadros(pagina, 3);
    meta('N liga o marcador; M lança a bola (máquina)', `marcador ${eN.marcador}, posse depois da máquina ${eM.posse}`, eN.marcador && eM.posse === null);
    await pagina.keyboard.press('KeyR');
    const eR = await quadros(pagina, 3);
    meta('R: bola no pé', `posse ${eR.posse}`, eR.posse === 0);
    // controle (Gamepad API simulada: analógico para a direita + RT; depois Y = máquina)
    const gp = await pagina.evaluate(() => {
      const g = window.__golaco;
      g.reiniciar({ semente: 4 });
      const bt = n => Array.from({ length: 17 }, (_, i) => ({ pressed: n.includes(i), value: n.includes(i) ? 1 : 0, touched: false }));
      let botoes = [7];
      navigator.getGamepads = () => [{ connected: true, mapping: 'standard', axes: [0.9, 0.05, 0, 0], buttons: bt(botoes) }];
      const x0 = g.estado().jogador.x;
      for (let i = 0; i < 120; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
      const e1 = g.estado();
      botoes = [3];
      g.relogio.avancar(1000 / 60, { desenhar: false });
      botoes = [];
      for (let i = 0; i < 3; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
      const e2 = g.estado();
      navigator.getGamepads = () => [];
      return { x0, x1: e1.jogador.x, kmh: e1.kmh, modo: e1.modo, posse: e2.posse };
    });
    meta('Controle: analógico + RT = arrancada; Y = máquina', `x ${gp.x0.toFixed(2)} → ${gp.x1.toFixed(2)}, ${gp.kmh.toFixed(1)} km/h, ${gp.modo}; posse depois do Y ${gp.posse}`, gp.x1 > gp.x0 + 3 && gp.kmh > 24 && gp.modo === 'Arrancada' && gp.posse === null);
    meta('PC sem erro no console', erros.length ? erros.join(' | ') : '0', erros.length === 0);
  } finally { await navegador.close(); }
}

// ------------------------------------------------------------------ celular: toque
{
  const { navegador, contexto, pagina, erros } = await abrir({ largura: 844, altura: 390, dpr: 2, toque: true });
  try {
    await pagina.goto(srv.url + '?q=baixa&entalhe=1', { waitUntil: 'load' });
    await pagina.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 120000 });
    await pagina.evaluate(() => { window.__golaco.reiniciar({ semente: 2 }); window.__golaco.relogio.usarManual(true); });
    const visivel = await pagina.evaluate(() => !document.getElementById('toque').hidden);
    meta('Celular: controles de toque aparecem sozinhos', String(visivel), visivel);
    const cdp = await contexto.newCDPSession(pagina);
    const toque = (type, pontos) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pontos });
    const e0 = await quadros(pagina, 2);
    // dedo 1 encosta na metade esquerda e arrasta para a direita
    await toque('touchStart', [{ x: 200, y: 260, id: 1 }]);
    for (let k = 1; k <= 6; k++) await toque('touchMove', [{ x: 200 + k * 12, y: 260, id: 1 }]);
    const e1 = await quadros(pagina, 90);
    const ativo = await pagina.evaluate(() => document.getElementById('analogico').classList.contains('ativo'));
    const tt1 = await naTela(pagina, e0.jogador, e1.jogador);
    meta('Analógico flutuante: arrastar para a direita anda para a direita da tela', `x ${e0.jogador.x.toFixed(2)} → ${e1.jogador.x.toFixed(2)}, ${telaTxt(tt1)}, ${e1.kmh.toFixed(1)} km/h, base ativa ${ativo}`, e1.jogador.x > e0.jogador.x + 2 && tt1.dx > 20 && Math.abs(tt1.dy) < tt1.dx * 0.3 && e1.kmh > 12 && ativo);
    // dedo 2 no CORRER (com o dedo 1 ainda no analógico)
    const r = await pagina.evaluate(() => { const b = document.getElementById('btn-correr').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
    await toque('touchStart', [{ x: 272, y: 260, id: 1 }, { x: r.x, y: r.y, id: 2 }]);
    const e2 = await quadros(pagina, 120);
    meta('Dois dedos: analógico + CORRER = arrancada', `${e2.kmh.toFixed(1)} km/h, ${e2.modo}`, e2.kmh > 24 && e2.modo === 'Arrancada');
    await toque('touchEnd', []);
    const e3 = await quadros(pagina, 120);
    meta('Soltar os dedos: o jogador para', `${e3.kmh.toFixed(1)} km/h`, e3.kmh < 3);
    // arrastar para CIMA: o jogador vai para longe da câmera (sobe na tela)
    await toque('touchStart', [{ x: 200, y: 280, id: 3 }]);
    for (let k = 1; k <= 6; k++) await toque('touchMove', [{ x: 200, y: 280 - k * 12, id: 3 }]);
    const e4 = await quadros(pagina, 90);
    const tt4 = await naTela(pagina, e3.jogador, e4.jogador);
    meta('Analógico para cima: o jogador sobe na tela (longe da câmera)', `z ${e3.jogador.z.toFixed(2)} → ${e4.jogador.z.toFixed(2)}, ${telaTxt(tt4)}`, e4.jogador.z < e3.jogador.z - 2 && tt4.dy < -20 && Math.abs(tt4.dx) < -tt4.dy * 0.3);
    // segurar CONDUÇÃO com o dedo no analógico: condução curta (bola colada, devagar)
    const bm = await pagina.evaluate(() => { const b = document.getElementById('btn-mod').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
    await toque('touchStart', [{ x: 200, y: 208, id: 3 }, { x: bm.x, y: bm.y, id: 4 }]);
    const e5 = await quadros(pagina, 90);
    const modAtivo = await pagina.evaluate(() => document.getElementById('btn-mod').classList.contains('ativo'));
    meta('CONDUÇÃO segurado (com o analógico): condução curta', `${e5.kmh.toFixed(1)} km/h, ${e5.modo}, botão aceso ${modAtivo}`, e5.modo === 'Condução curta' && e5.kmh < 11 && modAtivo);
    // dois toques rápidos no CONDUÇÃO: pedalada (no touchEnd do CDP vai o dedo que SAIU)
    await toque('touchEnd', [{ x: bm.x, y: bm.y, id: 4 }]);
    await quadros(pagina, 6);
    await toque('touchStart', [{ x: 200, y: 208, id: 3 }, { x: bm.x, y: bm.y, id: 5 }]);
    await quadros(pagina, 4);
    await toque('touchEnd', [{ x: bm.x, y: bm.y, id: 5 }]);
    await quadros(pagina, 4);
    await toque('touchStart', [{ x: 200, y: 208, id: 3 }, { x: bm.x, y: bm.y, id: 6 }]);
    const ped = await pagina.evaluate(() => {
      const g = window.__golaco;
      let viu = false;
      for (let i = 0; i < 30; i++) { g.relogio.avancar(1000 / 60, { desenhar: false }); if (g.estado().modo === 'Pedalada') viu = true; }
      return viu;
    });
    await toque('touchEnd', []);
    meta('Dois toques rápidos no CONDUÇÃO: pedalada', String(ped), ped);
    const m = await pagina.evaluate(() => { const b = document.getElementById('btn-menu').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
    await pagina.touchscreen.tap(m.x, m.y);
    const menu = await pagina.evaluate(() => !document.getElementById('menu').hidden);
    meta('Botão de menu (toque) abre o menu', String(menu), menu);
    meta('Celular sem erro no console', erros.length ? erros.join(' | ') : '0', erros.length === 0);
  } finally { await navegador.close(); }
}
await srv.fechar();

const larg = Math.max(...res.map(r => r.nome.length));
for (const r of res) console.log(`${r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.nome.padEnd(larg)}  ${r.medido}`);
const ok = res.length > 0 && res.every(r => r.ok);
console.log(ok ? '\nteste-controles: PASSOU' : '\nteste-controles: REPROVOU');
process.exit(ok ? 0 : 1);
