// Prints da condução curta (pedido do dono, 12/10: "condução mais curtinha, com a bola mais no pé"), com o HUD e a
// torcida: o treino de condução (?modo=conducao) com o jogador em CORRIDA (analógico cheio) e em DISPARADA (CORRER) e
// a bola no pé, no PC 1280×720 Alta (dia) e no celular 844×390 dpr 2 Média (noite), na câmera da página e na
// aproximada; e uma folha com 6 quadros seguidos (a cada 3 ticks = 0,05 s, relógio manual) de cada marcha, para ver o
// toque a cada passo / a cada passada. Salva em tools/saida/conducao-*.png.
//   node tools/prints-conducao.mjs [--so pc-corrida,folha-disparada]
import fs from 'node:fs';
import path from 'node:path';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';
import { BOTAO } from '../js/config.js';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const so = arg('--so', '') ? new Set(arg('--so', '').split(',')) : null;
const SAIDA = path.join(RAIZ, 'tools', 'saida');
fs.mkdirSync(SAIDA, { recursive: true });

const PC = { largura: 1280, altura: 720, dpr: 1, toque: false };
const CEL = { largura: 844, altura: 390, dpr: 2, toque: true };
const CORRIDA = { mag: 1, botoes: 0, s: 3 }, DISPARADA = { mag: 1, botoes: BOTAO.CORRER, s: 3.5 };
const CENAS = [
  { nome: 'pc-corrida', ...PC, url: 'q=alta&hora=dia', marcha: CORRIDA },
  { nome: 'pc-disparada', ...PC, url: 'q=alta&hora=dia', marcha: DISPARADA },
  { nome: 'pc-corrida-aproximada', ...PC, url: 'q=alta&hora=dia&camera=aproximada', marcha: CORRIDA },
  { nome: 'pc-disparada-aproximada-noite', ...PC, url: 'q=alta&hora=noite&camera=aproximada', marcha: DISPARADA },
  { nome: 'celular-corrida-noite', ...CEL, url: 'q=media&hora=noite&toque=1&entalhe=1', marcha: CORRIDA },
  { nome: 'celular-disparada', ...CEL, url: 'q=media&hora=dia&toque=1&entalhe=1', marcha: DISPARADA },
  { nome: 'folha-corrida', ...PC, url: 'q=alta&hora=dia&camera=aproximada', marcha: CORRIDA, folha: 6 },
  { nome: 'folha-disparada', ...PC, url: 'q=alta&hora=dia&camera=aproximada', marcha: DISPARADA, folha: 6 },
];

const srv = await servidor();
let falhas = 0;
for (const c of CENAS) {
  if (so && !so.has(c.nome)) continue;
  const t0 = Date.now();
  const { navegador, pagina, erros } = await abrir({ largura: c.largura, altura: c.altura, dpr: c.dpr, toque: c.toque });
  try {
    await pagina.goto(`${srv.url}?prints=1&semente=3&modo=conducao&replay=0&${c.url}`, { waitUntil: 'load' });
    await pagina.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 180000 });
    // corre em linha reta (para o lado de lá do campo) até a marcha assentar, com o relógio manual
    const nota = await pagina.evaluate(mc => {
      const g = window.__golaco;
      g.relogio.usarManual(true);
      const m = g.mundo, j = m.jogadores[0];
      const sx = j.x > 0 ? -1 : 1;
      const e = { x: sx * mc.mag, z: 0, botoes: mc.botoes };
      for (let i = 0; i < Math.round(mc.s * 60); i++) { g.forcarEntrada(e); g.relogio.avancar(1000 / 60, { desenhar: false }); }
      window.__entradaPrint = e;
      return `v ${Math.hypot(j.vx, j.vz).toFixed(2)} m/s, bola–corpo ${Math.hypot(m.bola.p.x - j.x, m.bola.p.z - j.z).toFixed(2)} m, posse ${m.posse}`;
    }, c.marcha);
    const quadros = [];
    const n = c.folha ?? 1;
    for (let k = 0; k < n; k++) {
      // alguns quadros com desenho (a mola da câmera assenta); na folha, 3 ticks entre os quadros
      const info = await pagina.evaluate(({ k, folha }) => {
        const g = window.__golaco, e = window.__entradaPrint;
        const passos = folha ? (k === 0 ? 1 : 3) : 1;
        for (let i = 0; i < passos; i++) { g.forcarEntrada(e); g.relogio.avancar(1000 / 60, { desenhar: i === passos - 1 }); }
        const m = g.mundo, j = m.jogadores[0];
        return { tick: m.tick, v: Math.hypot(j.vx, j.vz), d: Math.hypot(m.bola.p.x - j.x, m.bola.p.z - j.z), toques: j.cond.nToques };
      }, { k, folha: !!c.folha });
      await pagina.evaluate(() => window.__golaco.desenhar());
      await pagina.waitForTimeout(200);
      const png = await pagina.screenshot({ timeout: 300000 });
      quadros.push({ png, info });
    }
    let arq;
    if (!c.folha) {
      arq = path.join(SAIDA, `conducao-${c.nome}.png`);
      fs.writeFileSync(arq, quadros[0].png);
    } else {
      // folha 3 × 2 com os quadros (recortados no meio da tela, onde a câmera aproximada põe o jogador), montada no navegador
      const html = `<html><body style="margin:0;background:#111;color:#eee;font:14px sans-serif">
        <div style="display:grid;grid-template-columns:repeat(3,640px);gap:4px;padding:4px">
        ${quadros.map((q, k) => `<div style="position:relative;width:640px;height:360px;overflow:hidden">
          <img src="data:image/png;base64,${q.png.toString('base64')}" style="position:absolute;left:-320px;top:-180px;width:1280px;height:720px">
          <div style="position:absolute;left:6px;top:4px;background:#000a;padding:2px 6px">${k + 1} · tick ${q.info.tick} · ${q.info.v.toFixed(1)} m/s · bola–corpo ${q.info.d.toFixed(2)} m · ${q.info.toques} toques</div></div>`).join('')}
        </div></body></html>`;
      const p2 = await pagina.context().newPage();
      await p2.setViewportSize({ width: 3 * 640 + 16, height: 2 * 360 + 12 });
      await p2.setContent(html);
      arq = path.join(SAIDA, `conducao-${c.nome}.png`);
      await p2.screenshot({ path: arq, timeout: 300000 });
      await p2.close();
    }
    const ok = erros.length === 0;
    if (!ok) falhas++;
    const ult = quadros[quadros.length - 1].info;
    console.log(`${ok ? 'OK  ' : 'FALHA'} ${c.nome.padEnd(30)} ${path.relative(RAIZ, arq)}  (${((Date.now() - t0) / 1000).toFixed(1)} s; ${nota}; último quadro ${ult.v.toFixed(2)} m/s, bola–corpo ${ult.d.toFixed(2)} m)`);
    for (const e of erros) console.log('      erro no console:', e);
  } catch (e) {
    falhas++;
    console.log(`FALHA ${c.nome}: ${e.message}`);
    for (const er of erros) console.log('      erro no console:', er);
  } finally {
    await navegador.close();
  }
}
await srv.fechar();
console.log(falhas ? `\nprints-conducao: ${falhas} com problema` : '\nprints-conducao: todos OK');
process.exit(falhas ? 1 : 0);
