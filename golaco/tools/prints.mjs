// Prints da Etapa 1 (navegador): PC 1280×720 Alta de dia e de noite; celular 844×390 dpr 2
// Média (toque, entalhe simulado) de dia e de noite; extras: câmera aproximada, celular em pé,
// menu e ajuda, e dois de conferência com a câmera livre (manequim de perto e o gol).
// Roda alguns segundos de simulação com o relógio manual (?demo=1: o jogador conduz em curva
// sozinho) e salva em tools/saida/. Confere também: erros no console e caixas do HUD que se
// sobrepõem ou passam da área segura.
//   node tools/prints.mjs [--so pc-dia,celular-noite] [--segundos 5]
import fs from 'node:fs';
import path from 'node:path';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const so = arg('--so', '') ? new Set(arg('--so', '').split(',')) : null;
const segundos = +arg('--segundos', 5);
const SAIDA = path.join(RAIZ, 'tools', 'saida');
fs.mkdirSync(SAIDA, { recursive: true });

const PC = { largura: 1280, altura: 720, dpr: 1, toque: false };
const CEL = { largura: 844, altura: 390, dpr: 2, toque: true };
const CENAS = [
  { nome: 'pc-dia', ...PC, url: 'q=alta&hora=dia' },
  { nome: 'pc-noite', ...PC, url: 'q=alta&hora=noite&marcador=1' },
  { nome: 'celular-dia', ...CEL, url: 'q=media&hora=dia&toque=1&entalhe=1' },
  { nome: 'celular-noite', ...CEL, url: 'q=media&hora=noite&toque=1&entalhe=1&marcador=1' },
  { nome: 'pc-aproximada', ...PC, url: 'q=alta&hora=dia&camera=aproximada&marcador=1' },
  { nome: 'celular-baixa', ...CEL, url: 'q=baixa&hora=dia&toque=1&entalhe=1' },
  { nome: 'celular-retrato', largura: 390, altura: 844, dpr: 2, toque: true, url: 'q=media&hora=dia&toque=1' },
  { nome: 'pc-menu', ...PC, url: 'q=alta&hora=dia', depois: 'menu' },
  { nome: 'celular-menu', ...CEL, url: 'q=media&hora=noite&toque=1&entalhe=1', depois: 'menu' },
  { nome: 'celular-ajuda', ...CEL, url: 'q=media&hora=dia&toque=1&entalhe=1', depois: 'ajuda' },
  // conferência de perto (câmera livre): manequim correndo (juntas, listras, chuteira na bola)
  // e gol/linhas da grande área
  { nome: 'pc-manequim', ...PC, url: 'q=alta&hora=dia&marcador=1', livre: { rel: [0, 1.2, 6], fov: 22 } },
  { nome: 'pc-gol', ...PC, url: 'q=alta&hora=noite', livre: { de: [38, 5, 14], para: [52.5, 1.2, 0], fov: 40 } },
];

/** Caixas do HUD: nenhuma encosta em outra e todas ficam dentro da área segura. */
async function conferirLayout(pagina) {
  return pagina.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    const px = v => { const d = document.createElement('div'); d.style.cssText = `position:fixed;left:${v};width:0;height:0`; document.body.appendChild(d); const x = d.getBoundingClientRect().left; d.remove(); return x; };
    const sa = { t: px(css.getPropertyValue('--sa-t')), r: px(css.getPropertyValue('--sa-r')), b: px(css.getPropertyValue('--sa-b')), l: px(css.getPropertyValue('--sa-l')) };
    const W = innerWidth, H = innerHeight;
    const caixas = [...document.querySelectorAll('[data-caixa]')]
      .filter(e => e.offsetParent !== null && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden')
      .map(e => ({ nome: e.dataset.caixa, r: e.getBoundingClientRect() }))
      .filter(c => c.r.width > 0 && c.r.height > 0);
    const problemas = [];
    for (let i = 0; i < caixas.length; i++) {
      const a = caixas[i];
      if (a.r.left < sa.l - 0.5 || a.r.top < sa.t - 0.5 || a.r.right > W - sa.r + 0.5 || a.r.bottom > H - sa.b + 0.5) problemas.push(`${a.nome} fora da área segura`);
      for (let k = i + 1; k < caixas.length; k++) {
        const b = caixas[k];
        const folga = 4;
        if (a.r.left < b.r.right + folga && b.r.left < a.r.right + folga && a.r.top < b.r.bottom + folga && b.r.top < a.r.bottom + folga) problemas.push(`${a.nome} encosta em ${b.nome}`);
      }
    }
    return { caixas: caixas.map(c => `${c.nome} ${Math.round(c.r.left)},${Math.round(c.r.top)} ${Math.round(c.r.width)}×${Math.round(c.r.height)}`), problemas, sa };
  });
}

const srv = await servidor();
let falhas = 0;
for (const c of CENAS) {
  if (so && !so.has(c.nome)) continue;
  const t0 = Date.now();
  const { navegador, pagina, erros } = await abrir({ largura: c.largura, altura: c.altura, dpr: c.dpr, toque: c.toque });
  try {
    await pagina.goto(`${srv.url}?prints=1&demo=1&semente=3&${c.url}`, { waitUntil: 'load' });
    await pagina.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 120000 });
    // N segundos de simulação a 60 Hz com relógio manual; só o último quadro é renderizado
    await pagina.evaluate(seg => {
      const g = window.__golaco;
      g.relogio.usarManual(true);
      const n = Math.round(seg * 60);
      for (let i = 0; i < n; i++) g.relogio.avancar(1000 / 60, { desenhar: i === n - 1 });
    }, segundos);
    if (c.livre) {
      await pagina.evaluate(l => {
        const g = window.__golaco;
        const j = g.estado().jogador;
        const de = l.rel ? [j.x + l.rel[0], l.rel[1], j.z + l.rel[2]] : l.de;
        const para = l.rel ? [j.x, 0.9, j.z] : l.para;
        g.cameraLivre({ de, para, fov: l.fov });
        g.desenhar();
      }, c.livre);
    }
    if (c.depois === 'menu') await pagina.evaluate(() => { document.documentElement.classList.remove('modo-prints'); window.__golaco.abrirMenu(); });
    if (c.depois === 'ajuda') await pagina.evaluate(() => { document.documentElement.classList.remove('modo-prints'); window.__golaco.abrirAjuda(); });
    if (c.depois) await pagina.evaluate(() => window.__golaco.desenhar());
    const arq = path.join(SAIDA, `${c.nome}.png`);
    await pagina.screenshot({ path: arq });
    const lay = c.depois ? { problemas: [], caixas: [] } : await conferirLayout(pagina);
    const est = await pagina.evaluate(() => {
      const g = window.__golaco;
      const e = g.estado();
      // altura do jogador controlado na tela (px CSS): pés → 1,8 m
      const j = g.render.jogador, a = g.naTela(j.x, 0, j.z), b = g.naTela(j.x, 1.8, j.z);
      e.alturaTela = Math.hypot(a.x - b.x, a.y - b.y);
      return e;
    });
    const ok = erros.length === 0 && lay.problemas.length === 0;
    if (!ok) falhas++;
    console.log(`${ok ? 'OK  ' : 'FALHA'} ${c.nome.padEnd(15)} ${path.relative(RAIZ, arq)}  (${((Date.now() - t0) / 1000).toFixed(1)} s, ${est.desenhoChamadas} chamadas, jogador ${est.alturaTela.toFixed(0)} px, modo ${est.modo}, ${est.kmh.toFixed(1)} km/h, q=${est.qualidade})`);
    for (const e of erros) console.log('      erro no console:', e);
    for (const p of lay.problemas) console.log('      layout:', p);
    if (args.includes('--caixas')) for (const cx of lay.caixas) console.log('      caixa:', cx);
  } catch (e) {
    falhas++;
    console.log(`FALHA ${c.nome}: ${e.message}`);
    for (const er of erros) console.log('      erro no console:', er);
  } finally {
    await navegador.close();
  }
}
await srv.fechar();
console.log(falhas ? `\nprints: ${falhas} com problema` : '\nprints: todos OK');
process.exit(falhas ? 1 : 0);
