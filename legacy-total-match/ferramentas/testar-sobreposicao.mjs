// Teste "nada sobre nada": procura botões/cartões que se encostam ou saem da tela, em 7 larguras (celular, tablet, PC).
// uso (servidor na pasta do jogo, porta 8207): node ferramentas/testar-sobreposicao.mjs <pasta-dos-prints> [rota: modes|ut|ut-squad...]
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
import fs from 'fs';
const { chromium } = pkg;
const D = process.argv[2]; fs.mkdirSync(D, { recursive: true });
const ROTA = process.argv[3] || 'modes';
const TAMANHOS = [['cel360', 360, 740, 3, true], ['cel390', 390, 844, 3, true], ['cel430', 430, 932, 3, true], ['tablet', 820, 1180, 2, true], ['pc1280', 1280, 800, 1, false], ['pc1440', 1440, 900, 1, false], ['pc1920', 1920, 1080, 1, false]];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const resumo = {};
for (const [nome, w, h, dpr, mob] of TAMANHOS) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: mob, hasTouch: mob });
  const p = await ctx.newPage();
  if (mob) { const cdp = await ctx.newCDPSession(p); try { await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 47, left: 0, bottom: 34, right: 0 } }); } catch (e) {} }
  const erros = []; p.on('pageerror', e => erros.push(String(e).slice(0, 200)));
  await p.addInitScript(() => { localStorage.setItem('totalmatch:__edition', 'pro'); localStorage.setItem('totalmatch:su_unlocked', '1'); });
  await p.goto('http://localhost:8207/index.html', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.TM && TM.ui && TM.ui.go, { timeout: 40000 });
  await p.waitForTimeout(1200);
  if (ROTA.startsWith('ut')) await p.evaluate(() => { const s = TM.ut._new('Real Suprir'); TM.ut.openPack(s, { n: 26, lo: 66, hi: 82, rare: .4 }); TM.ut.autoFill(s); s.coins = 30000; TM.ut.save(); });
  await p.evaluate(r => TM.ui.go(r), ROTA); await p.waitForTimeout(1500);
  await p.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  const r = await p.evaluate(() => {
    const scr = document.querySelector('.screen.is-active') || document.querySelector('.screen');
    const sel = 'button, a[href], [role=button], input, select, .vit-carta, .vit-mais-b, .ut-card, .ut-slot-role, .ut-sem-contrato, .utm-adv, .uth-dest, .uth-modo, .ut-tile';
    const els = [...document.querySelectorAll(sel)].filter(e => {
      const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < 0.05 || cs.pointerEvents === 'none') return false;
      const rc = e.getBoundingClientRect(); if (rc.width < 4 || rc.height < 4) return false;
      // dentro de algo invisível?
      let a = e.parentElement; while (a) { const c2 = getComputedStyle(a); if (c2.display === 'none' || c2.visibility === 'hidden' || +c2.opacity < 0.05) return false; a = a.parentElement; }
      return true;
    });
    const nome = e => (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : e.tagName) + (e.textContent ? ' "' + e.textContent.trim().slice(0, 18) + '"' : '');
    const pares = [];
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
      const A = els[i], B = els[j];
      if (A.contains(B) || B.contains(A)) continue;
      const a = A.getBoundingClientRect(), bb = B.getBoundingClientRect();
      const ix = Math.min(a.right, bb.right) - Math.max(a.left, bb.left), iy = Math.min(a.bottom, bb.bottom) - Math.max(a.top, bb.top);
      if (ix > 1 && iy > 1) pares.push(nome(A) + '  X  ' + nome(B) + '  (' + Math.round(ix) + 'x' + Math.round(iy) + ')');
    }
    // conteúdo cortado na lateral (sai da tela) e rolagem lateral
    const larg = document.documentElement.clientWidth;
    const fora = els.filter(e => { const rc = e.getBoundingClientRect(); return rc.right > larg + 1 || rc.left < -1; }).map(nome).slice(0, 8);
    return { n: els.length, sobre: pares, fora, rolaLado: document.documentElement.scrollWidth > larg + 1 };
  });
  await p.screenshot({ path: `${D}/${nome}.png`, fullPage: true });
  resumo[nome] = { clicaveis: r.n, sobreposicoes: r.sobre.length, exemplos: r.sobre.slice(0, 12), foraDaTela: r.fora, rolaLado: r.rolaLado, erros: erros.length };
  await ctx.close();
}
console.log(JSON.stringify(resumo, null, 1));
await b.close();
