// Teste de navegador do Ato 3 (o tempo): as 4 fendas temporais aparecem e o guia leva até elas; vibrando PARADO dentro
// de uma ela fecha e conta na missão; o túnel do tempo mostra o progresso e, cheio, leva à noite do acidente (relógio
// parado à meia-noite, coluna do Núcleo, tom de memória, crimes parados); lá o Reverso do passado espera na porta do
// laboratório; chegar perto abre a cena do acidente (com ?historia=1: a fala da explosão dispara o clarão e o túnel volta)
// e a volta traz o presente de novo e conclui a missão.
// Uso: node velocista/tools/teste-tempo.mjs [pasta-de-prints] [--celular]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { servidor, abrir } from '../../golaco/tools/lib/navegador.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), celular = args.includes('--celular'), saida = args.find((a) => !a.startsWith('--'));
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? 'OK ' : 'ERRO'} ${msg}`); if (!c) falhas++; };
const srv = await servidor(0, path.join(AQUI, '..'));
const { navegador, pagina, erros } = await abrir(celular ? { largura: 844, altura: 390, dpr: 2, toque: true } : { largura: 1280, altura: 720 });
const foto = (n) => saida ? pagina.screenshot({ path: path.join(saida, `${celular ? 'cel' : 'pc'}-tempo-${n}.png`), timeout: 400000 }) : null;
const espera = (fn, arg, t = 400000) => pagina.waitForFunction(fn, arg, { timeout: t }).then(() => true).catch(() => false);
const tecla = (k) => pagina.evaluate((k) => { window.dispatchEvent(new KeyboardEvent('keydown', { key: k })); window.dispatchEvent(new KeyboardEvent('keyup', { key: k })); }, k);
const abrirJogo = async (q, vistas = null) => {
  await pagina.goto(srv.url + q, { timeout: 400000 });
  await pagina.evaluate((vistas) => { localStorage.clear(); if (vistas) localStorage.setItem('theflash.historia.v1', JSON.stringify({ vistas })); }, vistas);
  await pagina.goto(srv.url + q, { timeout: 400000 });
  await pagina.waitForSelector('#btnJogar:not([hidden])', { timeout: 400000 });
  await pagina.evaluate(() => { Element.prototype.requestFullscreen = undefined; document.getElementById('btnJogar').click(); });
};

// ---- fendas ----
await abrirJogo('?missao=fendas');
ok(await espera(() => window.__rel.missoes.atual?.id === 'fendas'), 'missão das fendas (atalho ?missao=)');
ok(await espera(() => window.__rel.tempo.fendasAbertas === 4), 'as 4 fendas abrem pela cidade');
const guia = await pagina.evaluate(() => window.__rel.alvoMissao()?.rotulo);
ok(guia === 'Fenda temporal', `o guia leva até a fenda (${guia})`);
// para dentro da fenda mais perto, parado, segurando VIBRAR
await pagina.evaluate(() => { const R = window.__rel, f = R.tempo.alvoFenda(R.P); R.P.x = f.x + 1; R.P.z = f.z; R.P.y = 0; R.P.vx = R.P.vz = 0; R.P.energia = 1; R.teclas.add('v'); window.__fenda = f; });
ok(await espera(() => window.__rel.P.vibrando), 'perto da fenda a vibração começa parada');
await foto('fenda');
ok(await espera(() => window.__rel.tempo.fendasAbertas === 3), 'vibrando dentro, a fenda fecha');
await pagina.evaluate(() => window.__rel.teclas.delete('v'));
ok(await pagina.evaluate(() => window.__rel.missoes.progresso()?.n === 1), 'a fenda fechada conta na missão (1/4)');
await pagina.evaluate(() => { for (const f of window.__rel.tempo.fendas) if (f.aberta) f.progresso = 1.5; });
ok(await espera(() => window.__rel.missoes.atual?.id === 'tunel'), 'as 4 fechadas concluem a missão; vem o túnel do tempo');

// ---- túnel ----
await pagina.evaluate(() => { window.__rel.J.tunelT = 2.5; });
ok(await espera(() => /Túnel do tempo 50%/.test(document.getElementById('missaoTexto').textContent), 10000) || await pagina.evaluate(() => /Túnel do tempo \d+%/.test(document.getElementById('missaoTexto').textContent)), `o painel mostra o progresso do túnel (${await pagina.evaluate(() => document.getElementById('missaoTexto').textContent)})`);
await pagina.evaluate(() => { window.__rel.J.tunelT = 5.1; });
ok(await espera(() => window.__rel.tempo.epoca === 'passado'), 'o túnel cheio leva à noite do acidente');
const pas = await pagina.evaluate(() => ({ T: window.__rel.mundo.T, classe: document.body.classList.contains('passado'), missao: window.__rel.missoes.atual?.id, crime: !!window.__rel.crimes?.ativo }));
ok(pas.T < 0.05 && pas.classe && pas.missao === 'passado', `meia-noite, tom de memória, missão "A noite do acidente" (T ${pas.T.toFixed(3)})`);
ok(await espera(() => window.__rel.tempo.focoReverso()), 'o Flash Reverso do passado espera na porta do laboratório');
const g2 = await pagina.evaluate(() => window.__rel.alvoMissao()?.rotulo);
ok(/seis semanas atrás/.test(g2 || ''), `o guia leva ao laboratório (${g2})`);
await pagina.waitForTimeout(3000);
const T1 = await pagina.evaluate(() => window.__rel.mundo.T);
ok(Math.abs(T1 - pas.T) < 1e-6, 'no passado o relógio do dia fica parado');
await pagina.evaluate(() => { const R = window.__rel, e = R.LAB_B.plano.entrada; R.P.x = e.x - 18; R.P.z = e.z - 14; R.P.y = 0; R.C.yaw = 0.6; });
await pagina.waitForTimeout(2500);
await foto('passado');
await pagina.evaluate(() => { const R = window.__rel, e = R.LAB_B.plano.entrada; R.P.x = e.x - 8; R.P.z = e.z - 8; });
ok(await espera(() => window.__rel.tempo.epoca === 'presente' && window.__rel.missoes.atual?.id === 'cap-savitar'), 'perto do laboratório: a cena, a volta pelo túnel e a missão concluída (vem o Savitar)');
ok(await pagina.evaluate(() => !document.body.classList.contains('passado') && window.__rel.mundo.T > 0.1), 'de volta ao presente (sem o tom de memória, relógio de antes)');

// ---- a cena do acidente com a história ligada ----
await abrirJogo('?historia=1&missao=passado', ['cena:prologo']);
ok(await espera(() => window.__rel.tempo.epoca === 'passado' && window.__rel.tempo.focoReverso()), 'recarregar no meio da missão volta para a noite do acidente');
// o herói começa na porta do laboratório: a cena abre sozinha assim que o Reverso aparece (só leva o herói para perto se ainda não abriu)
await espera(() => window.__rel.historia.cenaAtual === 'acidente', null, 15000);
await pagina.evaluate(() => { const R = window.__rel, e = R.LAB_B.plano.entrada; if (R.historia.cenaAtual !== 'acidente') { R.P.x = e.x - 8; R.P.z = e.z - 8; R.P.y = 0; } });
ok(await espera(() => window.__rel.historia.cenaAtual === 'acidente'), 'cena do acidente, de frente para o Reverso do passado');
const d = await pagina.evaluate(() => { const R = window.__rel, r = R.tempo.focoReverso(); return Math.hypot(R.P.x - r.x, R.P.z - r.z); });
ok(d <= 5.5, `o herói fica a ${d.toFixed(1)} m dele`);
await pagina.waitForTimeout(2500);
await foto('acidente');
let clarao = false;
for (let i = 0; i < 40 && !clarao; i++) {
  await tecla('enter'); await pagina.waitForTimeout(300);
  clarao = await pagina.evaluate(() => document.body.classList.contains('clarao'));
}
ok(clarao, 'a fala "Está na hora" dispara a explosão do Núcleo (clarão)');
await pagina.waitForTimeout(600);
await foto('explosao');
await pagina.evaluate(() => document.querySelector('#cenaHist .pular').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
ok(await espera(() => window.__rel.historia.cenaAtual === 'volta-tunel' && window.__rel.tempo.tunel), 'depois do acidente, a volta pelo túnel do tempo');
await pagina.waitForTimeout(2500);
await foto('tunel');
await pagina.evaluate(() => document.querySelector('#cenaHist .pular').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
ok(await espera(() => window.__rel.tempo.epoca === 'presente' && !window.__rel.tempo.tunel && window.__rel.J.modo === 'jogando'), 'de volta ao presente, o jogo continua');
ok(!erros.length, `sem erros no console (${erros.slice(0, 3).join(' | ')})`);
await navegador.close(); await srv.fechar();
process.exit(falhas ? 1 : 0);
