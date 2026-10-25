// Teste de navegador da história: prólogo (cartão do capítulo, a Caitlin, jogo parado, avança com Enter, uma vez só),
// rádio das missões, cartão do capítulo do Zoom, encontro de frente para ele com a câmera cortando entre quem fala,
// cena do encontro com o Zoom antes da perseguição, cena da derrota dele, e nada encostando no HUD do celular
// (pausa × painel do vilão × rádio; marcador do guia dentro da tela).
// Uso: node velocista/tools/teste-historia.mjs [pasta-de-prints] [--celular]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { servidor, abrir } from '../../golaco/tools/lib/navegador.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), celular = args.includes('--celular'), saida = args.find((a) => !a.startsWith('--'));
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? 'OK ' : 'ERRO'} ${msg}`); if (!c) falhas++; };
const srv = await servidor(0, path.join(AQUI, '..'));
const { navegador, pagina, erros } = await abrir(celular ? { largura: 844, altura: 390, dpr: 2, toque: true } : { largura: 1280, altura: 720 });
const foto = (n) => saida ? pagina.screenshot({ path: path.join(saida, `${celular ? 'cel' : 'pc'}-hist-${n}.png`), timeout: 400000 }) : null;
const espera = (fn, arg, t = 300000) => pagina.waitForFunction(fn, arg, { timeout: t }).then(() => true).catch(() => false);
const pular = () => pagina.evaluate(() => document.querySelector('#cenaHist .pular').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));   // o toque no Pular (no PC o mouse fica preso no jogo)
const tecla = (k) => pagina.evaluate((k) => { window.dispatchEvent(new KeyboardEvent('keydown', { key: k })); window.dispatchEvent(new KeyboardEvent('keyup', { key: k })); }, k);
const abrirJogo = async (q) => {
  await pagina.goto(srv.url + q, { timeout: 400000 });
  await pagina.waitForSelector('#btnJogar:not([hidden])', { timeout: 400000 });
  await pagina.evaluate(() => document.getElementById('btnJogar').click());
  await pagina.evaluate(() => document.fullscreenElement && document.exitFullscreen());
  await pagina.evaluate(() => { window.__rel.mundo.T = 0.45; });
};

// ---- prólogo ----
await pagina.goto(srv.url + '?historia=1', { timeout: 400000 });
await pagina.evaluate(() => localStorage.clear());
await abrirJogo('?historia=1');
const p0 = await pagina.evaluate(() => ({ modo: window.__rel.J.modo, cena: window.__rel.historia.cenaAtual, vis: !document.getElementById('cenaHist').hidden, hud: getComputedStyle(document.getElementById('hud')).display, cartao: window.__rel.historia.cartaoAtual }));
ok(p0.modo === 'cena' && p0.cena === 'prologo' && p0.vis && p0.hud === 'none', `prólogo: cena com o jogo parado e sem HUD (${p0.modo}, ${p0.cena})`);
ok(p0.cartao === 'Prólogo — O raio', `o prólogo abre com o cartão do capítulo (${p0.cartao})`);
await foto('cartao');
await espera(() => !window.__rel.historia.cartaoAtual, null, 300000);
const quem = await pagina.evaluate(() => document.querySelector('#cenaHist .fala b').textContent);
ok(quem === 'Caitlin', `a Caitlin conta a história (${quem})`);
await pagina.waitForTimeout(2500);
await foto('prologo');
for (let i = 0; i < 60 && await pagina.evaluate(() => window.__rel.J.modo === 'cena'); i++) { await tecla('enter'); await pagina.waitForTimeout(400); }
ok(await pagina.evaluate(() => window.__rel.J.modo === 'jogando'), 'Enter avança as falas e o jogo volta');

// ---- rádio da missão: concluir a 1ª (o Cortex) ----
await pagina.evaluate(() => { const R = window.__rel; R.P.x = R.LAB_B.cx; R.P.z = R.LAB_B.cz - 8; R.P.y = 0.3; });
const radio = await espera(() => document.getElementById('radio').classList.contains('vis') && /Cortex|velocímetro/.test(document.getElementById('radio').textContent), null, 300000);
ok(radio, `rádio ao concluir a missão (${(await pagina.evaluate(() => document.getElementById('radio').textContent)).slice(0, 60)}…)`);
await foto('radio');

// ---- o prólogo não volta ----
await abrirJogo('?historia=1');
ok(await pagina.evaluate(() => window.__rel.J.modo === 'jogando'), 'o prólogo só aparece uma vez');

// ---- encontro com o Zoom ----
await abrirJogo('?historia=1&capitulo=zoom');
ok(await espera(() => window.__rel.viloes.fase === 'aparece'), 'capítulo do Zoom');
ok(await espera(() => window.__rel.historia.cenaAtual === 'cap-zoom', null, 120000), 'o capítulo abre com o cartão');
await pular();
await espera(() => window.__rel.J.modo === 'jogando', null, 60000);
await espera(() => window.__rel.viloes.viloes[0]?.modelo, null, 300000);
await pagina.evaluate(() => { const R = window.__rel, v = R.viloes.viloes[0]; R.P.x = v.x - 20; R.P.z = v.z; R.P.y = 0; });
ok(await espera(() => window.__rel.historia.cenaAtual === 'encontro-zoom'), 'chegar perto abre a cena do encontro');
ok(await pagina.evaluate(() => window.__rel.viloes.fase === 'encontro' && window.__rel.J.modo === 'cena'), 'a perseguição espera a cena');
const perto = await pagina.evaluate(() => { const R = window.__rel, v = R.viloes.viloes[0]; return Math.hypot(R.P.x - v.x, R.P.z - v.z); });
ok(perto <= 5.5, `no encontro o herói fica de frente para o vilão (${perto.toFixed(1)} m)`);
await pagina.waitForTimeout(3000);
await foto('encontro');
// a câmera corta: outra fala, outro plano
const cam = () => pagina.evaluate(() => { const c = window.__rel.camera.position; return [c.x, c.y, c.z]; });
const c1 = await cam(); await tecla('enter'); await tecla('enter'); await pagina.waitForTimeout(2500); const c2 = await cam();
ok(Math.hypot(c1[0] - c2[0], c1[2] - c2[2]) > 0.8, `a câmera corta entre quem fala (${Math.hypot(c1[0] - c2[0], c1[2] - c2[2]).toFixed(1)} m)`);
await foto('encontro2');
await pular();
ok(await espera(() => window.__rel.viloes.fase === 'perseguicao' && window.__rel.J.modo === 'jogando', null, 60000), '"Pular" encerra a cena e a perseguição começa');

// ---- HUD do celular sem nada encostando ----
const enc = await pagina.evaluate(() => {
  const r = (id) => document.getElementById(id)?.getBoundingClientRect();
  const a = r('btPausa'), b = r('chefe'), m = document.getElementById('marcadorGuia').getBoundingClientRect();
  const toca = (p, q) => p && q && p.width && q.width && !(p.right <= q.left || q.right <= p.left || p.bottom <= q.top || q.bottom <= p.top);
  return { pausaChefe: toca(a, b), marcadorDentro: m.left >= 0 && m.right <= innerWidth };
});
ok(!enc.pausaChefe, 'o botão de pausa não encosta no painel do vilão');
ok(enc.marcadorDentro, 'o marcador do guia fica inteiro dentro da tela');

// ---- derrota do Zoom: cena ----
for (let k = 1; k <= 3; k++) {
  await espera(() => window.__rel.viloes.fase === 'perseguicao', null, 200000);
  await pagina.evaluate(() => { const R = window.__rel, v = R.viloes.viloes[0]; R.P.x = v.x - 9; R.P.z = v.z; R.P.y = 0; R.P.vx = R.P.vz = 0; });
  await tecla('f');
  await espera((k) => window.__rel.viloes.viloes[0].capturas >= k, k, 60000);
}
ok(await espera(() => window.__rel.viloes.fase === 'luta'), 'luta depois das capturas');
await pagina.evaluate(() => { const R = window.__rel, v = R.viloes.viloes[0]; v.vida = 3; v.acao = 'recupera'; v.at = 5; v.golpe('soco', R.P); });
ok(await espera(() => window.__rel.historia.cenaAtual === 'derrotado-zoom', null, 300000), 'derrotado, o Zoom fala na cena');
await pagina.waitForTimeout(3000);
await foto('derrota');
await pular();
ok(await espera(() => !window.__rel.viloes.ativo && window.__rel.J.modo === 'jogando', null, 60000), 'depois da cena o capítulo termina');
ok(await pagina.evaluate(() => /Ato 2/.test(window.__rel.historia.capitulo || '')), `a pausa mostra o capítulo da história (${await pagina.evaluate(() => window.__rel.historia.capitulo)})`);
ok(!erros.length, `sem erros no console (${erros.slice(0, 3).join(' | ')})`);
await navegador.close(); await srv.fechar();
process.exit(falhas ? 1 : 0);
