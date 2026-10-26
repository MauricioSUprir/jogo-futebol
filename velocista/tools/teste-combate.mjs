// Teste de navegador do combate e do guia: setas/feixe/marcador até o objetivo, BATER com avanço e combo, os três
// golpes especiais (energia cobrada, bandidos derrubados) e o bandido que bate no herói (tira energia).
// Uso: node velocista/tools/teste-combate.mjs [pasta-de-prints] [--celular]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { servidor, abrir } from '../../golaco/tools/lib/navegador.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), celular = args.includes('--celular'), saida = args.find((a) => !a.startsWith('--'));
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? 'OK ' : 'ERRO'} ${msg}`); if (!c) falhas++; };
const srv = await servidor(0, path.join(AQUI, '..'));
const { navegador, pagina, erros } = await abrir(celular ? { largura: 844, altura: 390, dpr: 2, toque: true } : { largura: 1280, altura: 720 });
const foto = (n) => saida ? pagina.screenshot({ path: path.join(saida, `${celular ? 'cel' : 'pc'}-${n}.png`), timeout: 400000 }) : null;
await pagina.goto(srv.url);
await pagina.waitForSelector('#btnJogar:not([hidden])', { timeout: 400000 });
await pagina.evaluate(() => { localStorage.clear(); document.getElementById('btnJogar').click(); });
await pagina.evaluate(() => document.fullscreenElement && document.exitFullscreen());
await pagina.waitForFunction(() => window.__rel.modelo, null, { timeout: 200000 }).catch(() => {});
await pagina.evaluate(() => { const R = window.__rel; R.mundo.T = 0.45; R.C.yaw = Math.PI * 0.75; });

// ---- guia: a 1ª missão (Cortex) tem lugar: setas no chão, rota e marcador (o herói vai para 60 m da porta) ----
await pagina.evaluate(() => { const R = window.__rel; R.P.z -= 60; });
await pagina.waitForFunction(() => window.__rel.guia.setas > 3, null, { timeout: 200000 }).catch(() => {});
const g = await pagina.evaluate(() => { const R = window.__rel; return { setas: R.guia.setas, rota: R.guia.rota?.length, marcador: getComputedStyle(R.guia.marcador).display, texto: R.guia.marcador.textContent }; });
ok(g.setas > 3 && g.rota >= 2 && g.marcador === 'flex', `guia até o objetivo (${g.setas} setas, rota de ${g.rota} pontos, marcador "${g.texto}")`);
// longe do alvo, a rota anda pelas ruas (cantos em ângulo reto)
const rotaLonge = await pagina.evaluate(() => { const R = window.__rel; R.P.x += 300; R.P.z -= 260; return new Promise((ok) => setTimeout(() => ok(R.guia.rota), 1500)); });
await pagina.waitForFunction(() => window.__rel.guia.rota && window.__rel.guia.rota.length >= 4, null, { timeout: 200000 }).catch(() => {});
const rl = await pagina.evaluate(() => window.__rel.guia.rota);
const retos = rl.slice(1, -1).every((p, i) => { const a = rl[i], b = rl[i + 2]; if (!b) return true; return Math.abs(p[0] - a[0]) < 0.01 || Math.abs(p[1] - a[1]) < 0.01; });
ok(rl.length >= 4 && retos, `rota pelas ruas com cantos retos (${rl.length} pontos)`);
await foto('guia');
void rotaLonge;

// ---- BATER: gangue de 4 a 10 m, o herói derruba todos ----
const preparar = (n, dist) => pagina.evaluate(({ n, dist }) => {
  const R = window.__rel, P = R.P;
  P.x = 0 * 0 + (Math.round((P.x + 1672) / 76) * 76 - 1672); P.z = Math.round((P.z + 1672) / 76) * 76 - 1672 + 20;   // numa rua
  P.vx = P.vz = 0; P.energia = 1; P.y = 0;
  for (const e of R.combate.bandidos) e.sair = 0;
  R.C.yaw = 0;
  return R.combate.gerarGangue(P.x, P.z + dist, n);
}, { n, dist });
const g1 = await preparar(4, 10);
await pagina.waitForFunction(() => window.__rel.combate.bandidos.some((e) => e.estado === 'vem' || e.estado === 'guarda'), null, { timeout: 200000 }).catch(() => {});
await foto('gangue');
const nocautesAntes = await pagina.evaluate(() => window.__rel.missoes?.stats?.nocautes ?? 0);
// aperta F em sequência até derrubar todos (ou o tempo acabar)
const r1 = await pagina.evaluate((g1) => new Promise((fim) => {
  const R = window.__rel; let socos = 0, avancos = 0, foto = null; const t0 = performance.now();
  const passo = () => {
    const A = R.combate.acao;
    if (!A) { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' })); window.dispatchEvent(new KeyboardEvent('keyup', { key: 'f' })); socos++; }
    else if (A.dash > 0 && A.t < A.dash) avancos++;
    if (R.combate.vivos(g1) === 0 || performance.now() - t0 > 240000) return fim({ vivos: R.combate.vivos(g1), socos, avancos, energia: R.P.energia });
    requestAnimationFrame(passo);
  };
  passo();
}), g1);
ok(r1.vivos === 0, `BATER derruba a gangue (${r1.socos} apertos, ${r1.vivos} de pé)`);
ok(r1.avancos > 0, `avanço relâmpago até o bandido (${r1.avancos} quadros de avanço)`);
await foto('nocaute');

// pose do soco: segura no meio de um soco para o print
if (saida) {
  await preparar(1, 1.3);
  await pagina.evaluate(() => { const R = window.__rel; R.C.yaw = 2.2; R.C.pitch = 0.15; window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' })); window.dispatchEvent(new KeyboardEvent('keyup', { key: 'f' })); });
  await pagina.waitForFunction(() => { const A = window.__rel.combate.acao; return A && A.t >= A.bate - 0.02; }, null, { timeout: 200000, polling: 'raf' }).catch(() => {});
  await pagina.evaluate(() => { window.__rel.J.modo = 'pausa-teste'; });
  await foto('soco');
  await pagina.evaluate(() => { window.__rel.J.modo = 'jogando'; });
}

// ---- especiais ----
for (const [tecla, tipo, custo] of [['2', 'ciclone', 0.35], ['3', 'sonico', 0.5], ['1', 'raio', 0.25]]) {
  const gid = await preparar(tipo === 'raio' ? 1 : 4, tipo === 'raio' ? 25 : 7);
  await pagina.waitForFunction(() => !window.__rel.combate.acao, null, { timeout: 200000 }).catch(() => {});
  const e0 = await pagina.evaluate(() => { window.__rel.P.energia = 1; return 1; });
  await pagina.evaluate((t) => { window.dispatchEvent(new KeyboardEvent('keydown', { key: t })); window.dispatchEvent(new KeyboardEvent('keyup', { key: t })); }, tecla);
  await pagina.waitForFunction((t) => window.__rel.combate.acao?.tipo === t, tipo, { timeout: 200000 }).catch(() => {});
  const e1 = await pagina.evaluate(() => window.__rel.P.energia);
  if (saida) { await pagina.waitForFunction((t) => { const A = window.__rel.combate.acao; return !A || A.t > (t === 'ciclone' ? 1.0 : t === 'sonico' ? 0.97 : 0.32); }, tipo, { timeout: 200000, polling: 'raf' }).catch(() => {}); await foto(tipo); }
  await pagina.waitForFunction(() => !window.__rel.combate.acao, null, { timeout: 200000 }).catch(() => {});
  await pagina.waitForTimeout(400);
  const vivos = await pagina.evaluate((g) => window.__rel.combate.vivos(g), gid);
  ok(Math.abs(e0 - e1 - custo) < 0.03 && vivos === 0, `${tipo}: custa ${(custo * 100).toFixed(0)}% (${((e0 - e1) * 100).toFixed(0)}%) e derruba todos (${vivos} de pé)`);
}
// sem energia o especial não sai
await preparar(2, 8);
const semEnergia = await pagina.evaluate(() => { const R = window.__rel; R.P.energia = 0.1; window.dispatchEvent(new KeyboardEvent('keydown', { key: '3' })); window.dispatchEvent(new KeyboardEvent('keyup', { key: '3' })); let n = 0; return new Promise((ok) => { const f = () => (++n < 4 ? requestAnimationFrame(f) : ok({ acao: !!R.combate.acao, energia: R.P.energia })); requestAnimationFrame(f); }); });   // espera o jogo processar o aperto (quadros, não tempo)
ok(!semEnergia.acao && Math.abs(semEnergia.energia - 0.1) < 0.02, 'sem energia o golpe especial não sai');

// ---- o bandido bate: tira energia ----
await preparar(2, 3);
const s0 = await pagina.evaluate(() => { window.__rel.P.energia = 0.8; return window.__rel.combate.sofridos; });
const golpeado = await pagina.waitForFunction((s0) => window.__rel.combate.sofridos > s0, s0, { timeout: 900000 }).then(() => true).catch(() => false);
await pagina.waitForTimeout(500);
const eDepois = await pagina.evaluate(() => window.__rel.P.energia);
ok(golpeado && eDepois < 0.8, `o bandido bate e tira energia do herói (energia 80% → ${(eDepois * 100).toFixed(0)}%, sem recarga no meio da briga)`);
await foto('apanhando');
ok(!erros.length, `sem erros no console (${erros.slice(0, 3).join(' | ')})`);
void nocautesAntes;
await navegador.close(); await srv.fechar();
process.exit(falhas ? 1 : 0);
