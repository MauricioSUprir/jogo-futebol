// Teste de navegador dos vilões: capítulo do Zoom (aparece → perseguição com energia livre → 3 capturas no BATER →
// luta: desvia fora da janela, apanha cansado, investida fere o herói parado e não fere quem vibra → vitória salva),
// derrota recomeça a luta, Flash Reverso (desvia de quase tudo, fase 2) e a batalha final contra os dois.
// Uso: node velocista/tools/teste-viloes.mjs [pasta-de-prints] [--celular]
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
const tecla = (k) => pagina.evaluate((k) => { window.dispatchEvent(new KeyboardEvent('keydown', { key: k })); window.dispatchEvent(new KeyboardEvent('keyup', { key: k })); }, k);

await pagina.goto(srv.url + '?capitulo=zoom');
await pagina.waitForSelector('#btnJogar:not([hidden])', { timeout: 400000 });
await pagina.evaluate(() => { localStorage.clear(); document.getElementById('btnJogar').click(); });
await pagina.evaluate(() => document.fullscreenElement && document.exitFullscreen());
await pagina.evaluate(() => { window.__rel.mundo.T = 0.45; });

// ---- aparece ----
ok(await espera(() => window.__rel.viloes.fase === 'aparece'), 'capítulo do Zoom começa (?capitulo=zoom)');
const alvo = await pagina.evaluate(() => window.__rel.alvoMissao());
ok(alvo && alvo.rotulo === 'Zoom', `o guia leva até o Zoom (${alvo?.rotulo})`);
ok(await espera(() => window.__rel.viloes.viloes[0]?.modelo, null, 300000), 'o Zoom tem corpo (traje preto e azul)');
const perto = (dist) => pagina.evaluate((dist) => { const R = window.__rel, v = R.viloes.viloes[0]; R.P.x = v.x - dist; R.P.z = v.z; R.P.y = 0; R.P.vx = R.P.vz = 0; R.C.yaw = Math.PI / 2; }, dist);
await perto(6);
await pagina.evaluate(() => { window.__rel.CAM.dist = 4; });
await pagina.waitForTimeout(800);
await foto('zoom');

// ---- perseguição: energia livre ----
await perto(30);
ok(await espera(() => window.__rel.viloes.fase === 'perseguicao'), 'chegar perto começa a perseguição');
const e0 = await pagina.evaluate(() => { const R = window.__rel; R.P.energia = 0.3; R.teclas.add('w'); R.teclas.add('shift'); return 0.3; });
await pagina.waitForTimeout(4000);
const e1 = await pagina.evaluate(() => { const R = window.__rel; R.teclas.clear(); return R.P.energia; });
ok(e1 > e0, `na perseguição a energia não gasta correndo, e enche (${(e0 * 100).toFixed(0)}% → ${(e1 * 100).toFixed(0)}%)`);
await foto('perseguicao');

// ---- três capturas no BATER ----
for (let k = 1; k <= 3; k++) {
  await espera(() => window.__rel.viloes.fase === 'perseguicao', null, 200000);
  await perto(9);
  await tecla('f');
  const c = await espera((k) => window.__rel.viloes.viloes[0].capturas >= k, k, 60000);
  ok(c, `captura ${k}/3 apertando BATER a 9 m`);
}
ok(await espera(() => window.__rel.viloes.fase === 'luta'), 'depois da 3ª captura começa a luta');
const hud = await pagina.evaluate(() => ({ chefe: !document.getElementById('chefe').hidden, vida: !document.getElementById('vidaHeroi').hidden, missao: document.getElementById('missao').hidden }));
ok(hud.chefe && hud.vida && hud.missao, 'na luta: barra do Zoom e vida do herói na tela (o painel da missão sai)');

// ---- desvio fora da janela e dano na janela ----
const esq = await pagina.evaluate(() => {
  const R = window.__rel, v = R.viloes.viloes[0], P = R.P; let desviou = 0; const vida0 = v.vida;
  for (let i = 0; i < 60; i++) { v.acao = 'rodeia'; v.at = 5; if (!v.golpe('soco', P)) desviou++; }
  const vidaRodeia = v.vida; v.vida = vida0;
  v.acao = 'recupera'; v.at = 5; let acertou = 0;
  for (let i = 0; i < 5; i++) { v.acao = 'recupera'; if (v.golpe('soco', P)) acertou++; }
  return { desviou, acertou, cansado: vida0 - v.vida, vidaRodeia };
});
ok(esq.desviou >= 35 && esq.desviou <= 55, `fora da janela o Zoom desvia da maioria dos socos (${esq.desviou}/60)`);
ok(esq.acertou === 5 && esq.cansado >= 24, `cansado depois da investida ele apanha (5/5, −${esq.cansado})`);
await pagina.evaluate(() => { const v = window.__rel.viloes.viloes[0]; v.vida = v.perf.vida; });

// ---- a investida fere o herói parado, e não fere quem vibra ----
const investida = (vibrar) => pagina.evaluate((vibrar) => new Promise((fim) => {
  const R = window.__rel, v = R.viloes.viloes[0], P = R.P;
  P.vida = 1; P.vx = P.vz = 0; v.x = P.x - 10; v.z = P.z; v.acao = 'prepara'; v.at = 0.05;
  if (vibrar) R.teclas.add('v');
  let n = 0; const f = () => { P.vx = P.vz = 0; if (vibrar) P.vibrando = true; if (++n < 400 && v.acao !== 'recupera') requestAnimationFrame(f); else { R.teclas.delete('v'); fim(P.vida); } };
  requestAnimationFrame(f);
}), vibrar);
const vParado = await investida(false);
ok(vParado < 1, `a investida fere o herói parado (vida ${(vParado * 100).toFixed(0)}%)`);
const vVibra = await investida(true);
ok(vVibra === 1, `vibrando a investida atravessa o herói (vida ${(vVibra * 100).toFixed(0)}%)`);
await pagina.evaluate(() => { const R = window.__rel; R.P.vibrando = false; R.CAM.dist = 4.3; });
await pagina.waitForTimeout(600);
await foto('luta');

// ---- derrota recomeça a luta ----
await pagina.evaluate(() => { window.__rel.P.vida = 0; });
ok(await espera(() => window.__rel.viloes.fase === 'derrota', null, 60000), 'vida zerada: derrota');
ok(await espera(() => window.__rel.viloes.fase === 'luta' && window.__rel.P.vida === 1, null, 300000), 'a luta recomeça com a vida cheia');

// ---- vitória ----
await pagina.evaluate(() => { const R = window.__rel, v = R.viloes.viloes[0]; v.vida = 3; v.acao = 'recupera'; v.at = 5; v.golpe('soco', R.P); });
ok(await espera(() => window.__rel.viloes.fase === 'vitoria', null, 60000), 'Zoom derrotado');
ok(await espera(() => !window.__rel.viloes.ativo, null, 400000), 'o capítulo termina');
const lista = await pagina.evaluate(() => window.__rel.viloes.lista(0));
ok(lista[0].estado === 'vencido' && lista[1].estado === 'liberado' && lista[2].estado === 'bloqueado', `progresso salvo: ${lista.map((c) => `${c.id}=${c.estado}`).join(', ')}`);

// ---- Flash Reverso ----
await pagina.evaluate(() => window.__rel.viloes.iniciar('reverso'));
ok(await espera(() => window.__rel.viloes.fase === 'aparece' && window.__rel.viloes.viloes[0]?.id === 'reverso'), 'capítulo do Flash Reverso começa');
await espera(() => window.__rel.viloes.viloes[0]?.modelo, null, 300000);
await perto(6); await pagina.evaluate(() => { window.__rel.CAM.dist = 4; }); await pagina.waitForTimeout(800); await foto('reverso');
const rev = await pagina.evaluate(() => {
  const R = window.__rel, v = R.viloes.viloes[0], P = R.P; v.estado = 'luta'; let desviou = 0;
  for (let i = 0; i < 60; i++) { v.acao = 'rodeia'; v.at = 5; if (!v.golpe('soco', P)) desviou++; }
  v.vida = v.perf.vida * 0.55; v.acao = 'recupera'; v.golpe('raio', P);
  return { desviou, fase2: v.fase2, capturas: v.perf.capturas, vida: v.perf.vida, raios: v.perf.raios };
});
ok(rev.desviou >= 50, `o Flash Reverso desvia de quase tudo (${rev.desviou}/60)`);
ok(rev.fase2 && rev.raios && rev.capturas > 3 && rev.vida > 100, `mais difícil: fase 2 na metade da vida, raios, ${rev.capturas} capturas, vida ${rev.vida}`);

// ---- batalha final ----
await pagina.evaluate(() => window.__rel.viloes.iniciar('final'));
ok(await espera(() => window.__rel.viloes.fase === 'aparece' && window.__rel.viloes.viloes.length === 2), 'batalha final: os dois juntos');
await espera(() => window.__rel.viloes.viloes.every((v) => v.modelo), null, 300000);
await pagina.evaluate(() => { const R = window.__rel, v = R.viloes.viloes[0]; R.P.x = v.x; R.P.z = v.z - 12; R.P.y = 0; R.C.yaw = 0; });
ok(await espera(() => window.__rel.viloes.fase === 'luta'), 'na frente do S.T.A.R. Labs a luta começa (sem perseguição)');
await pagina.waitForTimeout(1500);
await foto('final');
const fin = await pagina.evaluate(() => document.querySelectorAll('#chefe .chefe-barra').length);
ok(fin === 2, `duas barras de vida (${fin})`);
ok(!erros.length, `sem erros no console (${erros.slice(0, 3).join(' | ')})`);
await navegador.close(); await srv.fechar();
process.exit(falhas ? 1 : 0);
