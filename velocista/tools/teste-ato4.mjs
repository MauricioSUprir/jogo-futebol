// Teste de navegador do Ato 4: Savitar (a armadura apanha antes da vida; os especiais racham mais; quebrada, a vida cai)
// e DeVoe (luta em frente ao laboratório, flutuando; 3 torres seguram tudo no escudo; derrubadas, ele apanha; o carro
// arremessado cai no círculo; o pulso mental pega quem está no chão e não quem pulou; as cópias somem com um golpe; na
// metade da vida as torres voltam); a vitória encerra o capítulo; e o final: a missão do Núcleo no Cortex abre a cena do
// fim (com ?historia=1: o túnel em volta do herói dentro do Núcleo) e os créditos.
// Uso: node velocista/tools/teste-ato4.mjs [pasta-de-prints] [--celular]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { servidor, abrir } from '../../golaco/tools/lib/navegador.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), celular = args.includes('--celular'), saida = args.find((a) => !a.startsWith('--'));
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? 'OK ' : 'ERRO'} ${msg}`); if (!c) falhas++; };
const srv = await servidor(0, path.join(AQUI, '..'));
const { navegador, pagina, erros } = await abrir(celular ? { largura: 844, altura: 390, dpr: 2, toque: true } : { largura: 1280, altura: 720 });
const foto = (n) => saida ? pagina.screenshot({ path: path.join(saida, `${celular ? 'cel' : 'pc'}-ato4-${n}.png`), timeout: 400000 }) : null;
const espera = (fn, arg, t = 400000) => pagina.waitForFunction(fn, arg, { timeout: t }).then(() => true).catch(() => false);
const tecla = (k) => pagina.evaluate((k) => { window.dispatchEvent(new KeyboardEvent('keydown', { key: k })); window.dispatchEvent(new KeyboardEvent('keyup', { key: k })); }, k);
const abrirJogo = async (q, vistas = null) => {
  await pagina.goto(srv.url + q, { timeout: 400000 });
  await pagina.evaluate((vistas) => { localStorage.clear(); if (vistas) localStorage.setItem('theflash.historia.v1', JSON.stringify({ vistas })); }, vistas);
  await pagina.goto(srv.url + q, { timeout: 400000 });
  await pagina.waitForSelector('#btnJogar:not([hidden])', { timeout: 400000 });
  await pagina.evaluate(() => { Element.prototype.requestFullscreen = undefined; document.getElementById('btnJogar').click(); });
  await pagina.evaluate(() => { window.__rel.mundo.T = 0.45; });
};
const pertoDo = (d) => pagina.evaluate((d) => { const R = window.__rel, v = R.viloes.viloes[0]; R.P.x = v.x - d; R.P.z = v.z; R.P.y = 0; R.P.vx = R.P.vz = 0; }, d);

// ---- Savitar ----
await abrirJogo('?capitulo=savitar');
ok(await espera(() => window.__rel.viloes.fase === 'aparece' && window.__rel.viloes.viloes[0]?.id === 'savitar'), 'capítulo 6: Savitar');
ok(await espera(() => window.__rel.viloes.viloes[0]?.modelo?.adereco), 'Savitar de armadura, com as ombreiras e a crista');
await pertoDo(6); await pagina.waitForTimeout(1500); await foto('savitar');
await pertoDo(30);
ok(await espera(() => window.__rel.viloes.fase === 'perseguicao'), 'perseguição ao Savitar');
for (let k = 1; k <= 3; k++) {
  await espera(() => window.__rel.viloes.fase === 'perseguicao', null, 200000);
  await pertoDo(9); await tecla('f');
  await espera((k) => window.__rel.viloes.viloes[0].capturas >= k, k, 120000);
}
ok(await espera(() => window.__rel.viloes.fase === 'luta'), 'luta depois das capturas');
const arm = await pagina.evaluate(() => {
  const R = window.__rel, v = R.viloes.viloes[0], P = R.P, a0 = v.armadura, vida0 = v.vida;
  v.acao = 'recupera'; v.at = 5; v.golpe('soco', P); const a1 = v.armadura, vida1 = v.vida;
  v.acao = 'recupera'; v.at = 5; v.golpe('raio', P, { especial: true }); const a2 = v.armadura;
  v.armadura = 1; v.acao = 'recupera'; v.at = 5; v.golpe('soco', P); const quebrou = v.armadura === 0;
  v.acao = 'recupera'; v.at = 5; v.golpe('soco', P); const vida2 = v.vida;
  return { a0, a1, a2, vida0, vida1, vida2, quebrou };
});
ok(arm.a0 === 70 && arm.a1 < arm.a0 && arm.vida1 === arm.vida0, `a armadura apanha antes da vida (${arm.a0} → ${arm.a1}, vida igual)`);
ok(arm.a1 - arm.a2 > arm.a0 - arm.a1, `o especial racha mais (${(arm.a0 - arm.a1).toFixed(1)} × ${(arm.a1 - arm.a2).toFixed(1)})`);
ok(arm.quebrou && arm.vida2 < arm.vida0, `quebrada a armadura, a vida cai (${arm.vida0} → ${arm.vida2})`);
await pagina.evaluate(() => { const R = window.__rel, v = R.viloes.viloes[0]; v.vida = 2; v.acao = 'recupera'; v.at = 5; v.golpe('soco', R.P); });
ok(await espera(() => !window.__rel.viloes.ativo), 'Savitar derrotado, capítulo encerrado');

// ---- DeVoe ----
await pagina.evaluate(() => window.__rel.viloes.iniciar('devoe'));
ok(await espera(() => window.__rel.viloes.fase === 'aparece' && window.__rel.viloes.viloes[0]?.id === 'devoe'), 'capítulo 7: DeVoe');
const lugar = await pagina.evaluate(() => { const R = window.__rel, v = R.viloes.viloes[0], e = R.LAB_B.plano.entrada; return Math.hypot(v.x - e.x, v.z - (e.z - 9)); });
ok(lugar < 8, `em frente ao S.T.A.R. Labs (${lugar.toFixed(1)} m da entrada)`);
ok(await espera(() => window.__rel.viloes.viloes[0]?.modelo?.adereco), 'DeVoe com a touca de pensar e o disco flutuante');
await pertoDo(20);
ok(await espera(() => window.__rel.viloes.fase === 'luta'), 'a luta começa');
await espera(() => { const R = window.__rel, v = R.viloes.viloes[0]; return v.y - R.P.y > 0.9; }, null, 60000);
const fl = await pagina.evaluate(() => { const R = window.__rel, v = R.viloes.viloes[0]; return { voa: v.y - (window.__rel.P.y || 0), torres: v.torres.filter((t) => t.vida > 0).length }; });
ok(fl.voa > 0.9, `ele flutua (${fl.voa.toFixed(2)} m)`);
ok(fl.torres === 3, 'três torres de pé');
await pertoDo(9); await pagina.waitForTimeout(1500); await foto('devoe');
const esc = await pagina.evaluate(() => { const R = window.__rel, v = R.viloes.viloes[0], vida0 = v.vida; let ac = 0; for (let i = 0; i < 10; i++) { v.acao = 'recupera'; v.at = 5; if (v.golpe('raio', R.P, { especial: true })) ac++; } R.P.vx = R.P.vz = 0; return { ac, vida: v.vida, vida0 }; });
ok(esc.ac === 0 && esc.vida === esc.vida0, 'com as torres de pé o escudo segura tudo (até especial)');
const der = await pagina.evaluate(() => { const R = window.__rel, v = R.viloes.viloes[0]; for (const t of v.torres) { for (let i = 0; i < 5 && t.vida > 0; i++) t.alvo.golpe('soco', R.P, {}); } return v.torres.filter((t) => t.vida > 0).length; });
ok(der === 0, 'socos derrubam as torres');
const aberto = await pagina.evaluate(() => { const R = window.__rel, v = R.viloes.viloes[0], vida0 = v.vida; v.acao = 'recupera'; v.at = 5; const ac = v.golpe('soco', R.P); return { ac, cai: vida0 - v.vida }; });
ok(aberto.ac && aberto.cai > 0, `sem o escudo ele apanha (−${aberto.cai})`);
// o carro: aviso no círculo, o carro sobe e cai onde o herói está parado
await pagina.evaluate(() => { const R = window.__rel, v = R.viloes.viloes[0]; R.P.vida = 1; v.acao = 'rodeia'; v.at = 0; v.ataques = 0; R.P.x = v.x - 9; R.P.z = v.z; R.P.vx = R.P.vz = 0; });
ok(await espera(() => { const v = window.__rel.viloes.viloes[0]; return v.acao === 'prepara' && v.golpeArma === 'carro' && !!v.carroNoAr; }), 'o carro sobe ao lado dele e o círculo marca onde vai cair');
await foto('carro');
ok(await espera(() => window.__rel.P.vida < 1 || window.__rel.viloes.perigos.some((p) => p.tipo === 'carro' && p.t > 0.7)), 'o carro cai no círculo');
const vCarro = await pagina.evaluate(() => window.__rel.P.vida);
ok(vCarro < 1, `parado no círculo, o herói apanha (vida ${(vCarro * 100).toFixed(0)}%)`);
// o pulso: no chão apanha
await pagina.evaluate(() => { const R = window.__rel, v = R.viloes.viloes[0]; R.P.vida = 1; v.acao = 'rodeia'; v.at = 0; v.ataques = 1; R.P.x = v.x - 7; R.P.z = v.z; R.P.vx = R.P.vz = 0; });
ok(await espera(() => window.__rel.viloes.perigos.some((p) => p.tipo === 'pulso')), 'o pulso mental sai em anel');
await espera(() => !window.__rel.viloes.perigos.some((p) => p.tipo === 'pulso'), null, 200000);
const vPulso = await pagina.evaluate(() => window.__rel.P.vida);
ok(vPulso < 1, `no chão, o pulso pega o herói (vida ${(vPulso * 100).toFixed(0)}%)`);
// as cópias
await pagina.evaluate(() => { const R = window.__rel, v = R.viloes.viloes[0]; v.acao = 'rodeia'; v.at = 0; v.ataques = 3; });
ok(await espera(() => (window.__rel.viloes.viloes[0].copias || []).filter((c) => c.vivo).length === 2), 'duas cópias aparecem (e ele troca de lugar)');
await pagina.waitForTimeout(800); await foto('copias');
const some = await pagina.evaluate(() => { const v = window.__rel.viloes.viloes[0], c = v.copias.find((x) => x.vivo); c.alvo.golpe('soco', window.__rel.P, {}); return v.copias.filter((x) => x.vivo).length; });
ok(some === 1, 'uma cópia some com um golpe');
// metade da vida: as torres voltam
const f2 = await pagina.evaluate(() => { const R = window.__rel, v = R.viloes.viloes[0]; v.fase2 = false; v.vida = v.perf.vida * 0.52; v.acao = 'recupera'; v.at = 5; v.golpe('raio', R.P, { especial: true }); return v.torres.filter((t) => t.vida > 0).length; });
ok(f2 === 3, 'na metade da vida ele reergue as torres');
await pagina.evaluate(() => { const R = window.__rel, v = R.viloes.viloes[0]; for (const t of v.torres) t.alvo.golpe('raio', R.P, { especial: true }); v.vida = 2; v.acao = 'recupera'; v.at = 5; v.golpe('soco', R.P); });
ok(await espera(() => !window.__rel.viloes.ativo), 'DeVoe derrotado, capítulo encerrado');
const lista = await pagina.evaluate(() => window.__rel.viloes.lista(0).map((c) => `${c.id}=${c.estado}`).join(', '));
ok(/savitar=vencido.*devoe=vencido/.test(lista), `progresso salvo: ${lista}`);

// ---- o fim ----
await abrirJogo('?historia=1&missao=nucleo', ['cena:prologo']);
ok(await espera(() => window.__rel.missoes.atual?.id === 'nucleo'), 'missão final: correr para o Cortex');
await pagina.evaluate(() => { const R = window.__rel, l = R.equipe.lugarDoHeroi(); Object.assign(R.P, { x: l.x, y: l.y, z: l.z, h: l.h }); });
ok(await espera(() => window.__rel.historia.cenaAtual === 'depois-nucleo'), 'no Cortex, a cena do fim');
let tunel = false;
for (let i = 0; i < 40 && !tunel; i++) { await tecla('enter'); await pagina.waitForTimeout(300); tunel = await pagina.evaluate(() => window.__rel.tempo.tunel); }
ok(tunel, '"Estou entrando": o herói corre dentro do Núcleo (túnel)');
await pagina.waitForTimeout(1500); await foto('nucleo');
await pagina.evaluate(() => document.querySelector('#cenaHist .pular').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
ok(await espera(() => { const c = document.getElementById('creditos'); return c && !c.hidden && window.__rel.J.modo === 'creditos'; }), 'depois do epílogo, os créditos');
await pagina.waitForTimeout(4000); await foto('creditos');
await tecla('enter');
ok(await espera(() => window.__rel.J.modo === 'jogando' && document.getElementById('creditos').hidden), 'fechar os créditos volta ao jogo (patrulha livre)');
ok(!erros.length, `sem erros no console (${erros.slice(0, 3).join(' | ')})`);
await navegador.close(); await srv.fechar();
process.exit(falhas ? 1 : 0);
