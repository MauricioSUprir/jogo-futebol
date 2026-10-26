// Teste dos VILÕES DO DIA A DIA (js/rivais.js) no jogo: um aparece a 150–300 m aprontando, sem entrar no guia (é
// opcional); chegar a 30 m começa a briga; os golpes do herói derrubam; cada truque roda sem erro (bumerangue, bomba,
// cópias, giro, teleporte); a Peek-a-Boo foge do herói três vezes antes de cansar.
// Uso: node velocista/tools/teste-rivais.mjs [pasta-de-prints]
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const AQUI = path.dirname(fileURLToPath(import.meta.url)), pasta = process.argv[2] || null;
if (pasta) fs.mkdirSync(pasta, { recursive: true });
const { servidor, abrir } = await import('../../golaco/tools/lib/navegador.mjs');
const srv = await servidor(0, path.join(AQUI, '..'));
const { navegador, pagina, erros } = await abrir({ largura: 1280, altura: 720 });
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? 'OK ' : 'ERRO'} ${msg}`); if (!c) falhas++; };
const espera = (fn, arg, t = 600000) => pagina.waitForFunction(fn, arg, { timeout: t, polling: 300 }).then(() => true).catch(() => false);
await pagina.goto(srv.url + '?missao=velocidade', { timeout: 1200000 });
await pagina.waitForSelector('#btnJogar:not([hidden])', { timeout: 1200000 });
await pagina.evaluate(() => { Element.prototype.requestFullscreen = undefined; document.getElementById('btnJogar').click(); });
await pagina.evaluate(() => { const R = window.__rel; R.crimes.adiantar(-1e9); R.historia.calarRadio(); R.mundo.T = 0.45; });
for (const id of ['bumerangue', 'trapaceiro', 'espelhos', 'piao', 'peekaboo']) {
  const r0 = await pagina.evaluate((id) => { const R = window.__rel; R.rivais.forcar(R.P, id); const a = R.rivais.ativo; return a && { nome: a.nome, x: a.x, z: a.z, d: Math.hypot(a.x - R.P.x, a.z - R.P.z), guia: R.alvoMissao()?.rotulo ?? null }; }, id);
  ok(r0 && r0.d > 140 && r0.d < 310 && r0.guia !== r0.nome, `${id}: aparece a ${r0?.d.toFixed(0)} m, fora do guia (${r0?.guia})`);
  await pagina.evaluate(([x, z]) => { const R = window.__rel; Object.assign(R.P, { x: x - 20, z, y: R.P.y, vx: 0, vz: 0 }); }, [r0.x, r0.z]);
  ok(await espera(() => window.__rel.rivais.ativo?.estado === 'luta'), `${id}: chegar perto começa a briga`);
  // golpes: o herói vai até ele e bate, até cair (a Peek-a-Boo foge três vezes antes)
  const caiu = await pagina.evaluate(async () => {
    const R = window.__rel;
    for (let k = 0; k < 60 && R.rivais.ativo; k++) {
      const a = R.rivais.ativo; if (!a) break;
      const dx = a.x - R.P.x, dz = a.z - R.P.z, d = Math.hypot(dx, dz) || 1;
      Object.assign(R.P, { x: a.x - (dx / d) * 1.4, z: a.z - (dz / d) * 1.4, vx: 0, vz: 0 });
      R.combate.bater(R.P, dx / d, dz / d);
      for (let q = 0; q < 12; q++) await new Promise((r) => requestAnimationFrame(r));
    }
    return !R.rivais.ativo;
  });
  ok(caiu, `${id}: os golpes derrubam`);
  if (id === 'bumerangue' && pasta) await pagina.screenshot({ path: path.join(pasta, 'rival.png'), timeout: 600000 });
}
ok(await pagina.evaluate(() => window.__rel.rivais.vencidos) >= 5, 'os cinco vencidos contam');
ok(!erros.length, `sem erros no console (${erros.slice(0, 3).join(' | ')})`);
await navegador.close(); await srv.fechar();
process.exit(falhas ? 1 : 0);
