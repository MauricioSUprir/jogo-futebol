// Teste de navegador dos vilões com arma (Capitão Frio, Onda Térmica, Mago do Tempo): cada capítulo começa num
// cruzamento da cidade com o cenário do elemento, a luta começa ao chegar perto, o ataque é avisado no chão e acerta
// quem fica parado nele (o gelo deixa lento; o fogo queima; o raio cai no círculo; o tornado puxa), o escudo segura
// parte dos golpes fora da recarga, na recarga ele apanha, e a vitória encerra o capítulo e libera o próximo.
// Uso: node velocista/tools/teste-viloes-arma.mjs [pasta-de-prints] [--celular]
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
const espera = (fn, arg, t = 300000) => pagina.waitForFunction(fn, arg, { timeout: t }).then(() => true).catch(() => false);

await pagina.goto(srv.url, { timeout: 400000 });
await pagina.waitForSelector('#btnJogar:not([hidden])', { timeout: 400000 });
await pagina.evaluate(() => { Element.prototype.requestFullscreen = undefined; localStorage.clear(); document.getElementById('btnJogar').click(); });
await pagina.evaluate(() => { window.__rel.mundo.T = 0.45; });

// roda N quadros de lógica com o herói parado onde está (dt fixo do jogo: o quadro real pode ser lento)
// espera N quadros com o herói sem entrada nenhuma (o puxão do tornado mexe nele)
const parado = (n) => pagina.evaluate((n) => new Promise((fim) => { let k = 0; const f = () => { if (++k < n) requestAnimationFrame(f); else fim(); }; requestAnimationFrame(f); }), n);

for (const id of ['frio', 'onda', 'mago']) {
  await pagina.evaluate((id) => window.__rel.viloes.iniciar(id), id);
  ok(await espera((id) => window.__rel.viloes.fase === 'aparece' && window.__rel.viloes.viloes[0]?.id === id, id), `${id}: o capítulo começa`);
  const longe = await pagina.evaluate(() => { const R = window.__rel, v = R.viloes.viloes[0]; return Math.hypot(R.P.x - v.x, R.P.z - v.z); });
  ok(longe > 150, `${id}: num cruzamento longe do herói (${longe.toFixed(0)} m); o guia mostra (${(await pagina.evaluate(() => window.__rel.alvoMissao()?.rotulo))})`);
  ok(await espera(() => window.__rel.viloes.viloes[0]?.modelo?.adereco, null, 300000), `${id}: corpo com a roupa e o adereço (arma)`);
  await pagina.evaluate(() => { const R = window.__rel, v = R.viloes.viloes[0]; R.P.x = v.x - 20; R.P.z = v.z; R.P.y = 0; R.P.vx = R.P.vz = 0; });
  ok(await espera(() => window.__rel.viloes.fase === 'luta'), `${id}: chegar perto começa a luta`);
  // o ataque: herói parado no alvo do aviso
  await pagina.evaluate(() => { const R = window.__rel, v = R.viloes.viloes[0]; R.P.vida = 1; v.vida = v.perf.vida; v.acao = 'rodeia'; v.at = 0; v.ataques = 0; R.P.x = v.x - 6; R.P.z = v.z; R.P.y = 0; });
  const aviso = await espera(() => { const v = window.__rel.viloes.viloes[0]; return v.acao === 'prepara' && v.efx && Object.values(v.efx).some((m) => m.visible); }, null, 400000);
  const vis = await pagina.evaluate(() => { const e = window.__rel.viloes.viloes[0].efx; return Object.entries(e).filter(([, m]) => m.visible).map(([k]) => k).join(','); });
  ok(aviso && vis.length > 0, `${id}: o ataque é avisado no chão (${vis})`);
  await foto(`${id}-aviso`);
  await espera(() => window.__rel.viloes.viloes[0].acao === 'dispara', null, 400000);
  await foto(`${id}-ataque`);
  await espera(() => window.__rel.viloes.viloes[0].acao === 'recupera', null, 400000);
  const r1 = await pagina.evaluate(() => ({ vida: window.__rel.P.vida, lento: window.__rel.viloes.lentidao }));
  ok(r1.vida < 1, `${id}: parado no aviso, o herói apanha (vida ${(r1.vida * 100).toFixed(0)}%)`);
  if (id === 'frio') ok(r1.lento < 1, `frio: o gelo deixa o herói lento (×${r1.lento})`);
  // escudo fora da recarga; na recarga ele apanha
  const g = await pagina.evaluate(() => {
    const R = window.__rel, v = R.viloes.viloes[0], P = R.P; let bloq = 0;
    for (let i = 0; i < 60; i++) { v.acao = 'rodeia'; v.at = 5; if (!v.golpe('soco', P)) bloq++; }
    v.vida = v.perf.vida; let ac = 0; for (let i = 0; i < 5; i++) { v.acao = 'recupera'; v.at = 5; if (v.golpe('soco', P)) ac++; }
    return { bloq, ac };
  });
  ok(g.bloq >= 18 && g.bloq <= 45, `${id}: o escudo segura parte dos golpes (${g.bloq}/60)`);
  ok(g.ac === 5, `${id}: recarregando, ele apanha (5/5)`);
  if (id === 'mago') {
    // o tornado puxa o herói parado
    await pagina.evaluate(() => { const R = window.__rel, v = R.viloes.viloes[0]; v.vida = v.perf.vida; R.P.vida = 1; v.acao = 'rodeia'; v.at = 0; v.ataques = 2; R.P.x = v.x - 9; R.P.z = v.z; });
    await espera(() => window.__rel.viloes.viloes[0].acao === 'dispara', null, 400000);
    // o tornado nasce onde o herói estava: o herói recua 5 m pela rua (para o lado havia carros parados) e é puxado de volta
    const d0 = await pagina.evaluate(() => { const R = window.__rel; R.P.x -= 5; R.P.vx = R.P.vz = 0; return { x: R.P.x, z: R.P.z }; });
    await parado(40);
    await foto('mago-tornado');
    const puxou = await pagina.evaluate((d0) => { const R = window.__rel; return Math.hypot(R.P.x - d0.x, R.P.z - d0.z); }, d0);
    ok(puxou > 0.3, `mago: o tornado puxa o herói (${puxou.toFixed(1)} m)`);
  }
  // vitória
  await pagina.evaluate(() => { const R = window.__rel, v = R.viloes.viloes[0]; v.vida = 2; v.acao = 'recupera'; v.at = 5; v.golpe('soco', R.P); });
  ok(await espera(() => window.__rel.viloes.fase === 'vitoria' || window.__rel.viloes.fase === 'fimcena' || !window.__rel.viloes.ativo, null, 400000), `${id}: derrotado`);
  ok(await espera(() => !window.__rel.viloes.ativo, null, 400000), `${id}: o capítulo termina`);
}
const lista = await pagina.evaluate(() => window.__rel.viloes.lista(0).map((c) => `${c.id}=${c.estado}`).join(', '));
ok(/frio=vencido.*onda=vencido.*mago=vencido/.test(lista), `progresso salvo: ${lista}`);
ok(!erros.length, `sem erros no console (${erros.slice(0, 3).join(' | ')})`);
await navegador.close(); await srv.fechar();
process.exit(falhas ? 1 : 0);
