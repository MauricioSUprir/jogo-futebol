// Teste da SUPER RESOLUÇÃO (js/superres.js, o "DLSS" possível no navegador): com o jogo parado (pausa, sem a tela por
// cima), a mesma imagem em três jeitos — NATIVA, EQUILIBRADO (cena a 67% e reconstrução EASU + nitidez RCAS) e a mesma
// resolução interna só ESTICADA (bilinear, sem o passe) —, lidas pixel a pixel. A reconstrução tem de ficar mais perto da
// nativa que a esticada (erro médio menor) e mais nítida que ela (gradiente médio maior); a resolução interna é a do
// preset; a escolha da pausa fica guardada; sem erros no console. Com --celular: 844×390 com toque (Lambert, padrão
// Equilibrado). Uso: node velocista/tools/teste-superres.mjs [--celular] [pasta-de-prints]
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), celular = args.includes('--celular'), saida = args.find((a) => !a.startsWith('--'));
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? 'OK ' : 'ERRO'} ${msg}`); if (!c) falhas++; };
if (saida) fs.mkdirSync(saida, { recursive: true });

const { servidor, abrir } = await import(pathToFileURL(path.join(AQUI, '../../golaco/tools/lib/navegador.mjs')).href);
const srv = await servidor(0, path.join(AQUI, '..'));
const { navegador, pagina, erros } = await abrir(celular ? { largura: 844, altura: 390, dpr: 2, toque: true } : { largura: 960, altura: 540 });
await pagina.goto(srv.url + '?missao=velocidade', { timeout: 1200000 });
await pagina.waitForSelector('#btnJogar:not([hidden])', { timeout: 1200000 });
ok(await pagina.evaluate(() => window.__rel.presetImagem) === (celular ? 'equilibrado' : 'qualidade'), `o padrão é ${celular ? 'Equilibrado no celular' : 'Qualidade no PC'}`);
await pagina.evaluate(() => { Element.prototype.requestFullscreen = undefined; document.getElementById('btnJogar').click(); });
await pagina.evaluate(() => { const R = window.__rel; R.mundo.T = 0.5; R.crimes.adiantar(-1e9); R.historia.calarRadio?.(); });
// num cruzamento perto do S.T.A.R. Labs (faixas, prédios, árvores: bordas de todo tipo), olhando a rua
await pagina.evaluate(() => { const R = window.__rel; R.C.yaw = 0.7; R.C.pitch = 0.22; });
await pagina.waitForFunction(() => window.__rel.carregados.size >= 9, null, { timeout: 900000, polling: 500 });
await pagina.waitForTimeout(3000);
// pausa e tira a tela da pausa e o HUD da frente (só a imagem 3D)
await pagina.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' })); window.dispatchEvent(new KeyboardEvent('keyup', { key: 'p' })); });
await pagina.addStyleTag({ content: '#telaPausa, #hud, #toque { display:none !important; }' });
const quadros = (n) => pagina.evaluate((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const captura = async (nome) => { await quadros(3); const b = await pagina.screenshot({ timeout: 600000 }); if (saida) fs.writeFileSync(path.join(saida, `${nome}.png`), b); return b.toString('base64'); };
// lê os pixels de duas capturas na própria página e mede: erro médio (0–255) e o gradiente médio da luminância
const medir = (a, b) => pagina.evaluate(async ([a, b]) => {
  const ler = async (s) => { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); return { d: g.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height }; };
  const A = await ler(a), B = await ler(b);
  let erro = 0, gA = 0, gB = 0, n = 0;
  const L = (d, k) => 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2];
  for (let y = 1; y < A.h - 1; y += 1) for (let x = 1; x < A.w - 1; x += 1) {
    const k = (y * A.w + x) * 4; erro += Math.abs(L(A.d, k) - L(B.d, k));
    gA += Math.abs(L(A.d, k + 4) - L(A.d, k - 4)) + Math.abs(L(A.d, k + A.w * 4) - L(A.d, k - A.w * 4));
    gB += Math.abs(L(B.d, k + 4) - L(B.d, k - 4)) + Math.abs(L(B.d, k + B.w * 4) - L(B.d, k - B.w * 4)); n++;
  }
  return { erro: erro / n, nitA: gA / n, nitB: gB / n };
}, [a, b]);

await pagina.evaluate(() => window.__rel.escolherImagem('nativa'));
const nativa = await captura('nativa');
await pagina.evaluate(() => window.__rel.escolherImagem('equilibrado'));
const info = await pagina.evaluate(() => { const R = window.__rel, c = R.renderer.domElement, rt = R.posfx.composer.renderTarget1; return { cw: c.width, ch: c.height, iw: rt.width, ih: rt.height, sr: R.posfx.superres.enabled }; });
ok(info.sr && Math.abs(info.iw / info.cw - 0.67) < 0.02 && Math.abs(info.ih / info.ch - 0.67) < 0.02, `Equilibrado: a cena a ${info.iw}×${info.ih} para uma tela de ${info.cw}×${info.ch} (${Math.round(100 * info.iw * info.ih / (info.cw * info.ch))}% dos pixels)`);
const fsr = await captura('equilibrado');
await pagina.evaluate(() => { window.__rel.posfx.superres.enabled = false; });     // a mesma resolução interna, só esticada
const esticada = await captura('esticada');
await pagina.evaluate(() => { window.__rel.posfx.superres.enabled = true; });
const mF = await medir(nativa, fsr), mE = await medir(nativa, esticada);
console.log(`     erro médio contra a nativa: reconstruída ${mF.erro.toFixed(2)} · esticada ${mE.erro.toFixed(2)}; nitidez (gradiente médio): nativa ${mF.nitA.toFixed(2)} · reconstruída ${mF.nitB.toFixed(2)} · esticada ${mE.nitB.toFixed(2)}`);
ok(mF.erro < mE.erro, `a reconstrução fica mais perto da imagem nativa que a esticada (${mF.erro.toFixed(2)} × ${mE.erro.toFixed(2)})`);
ok(mF.nitB > mE.nitB * 1.04, `a reconstrução é mais nítida que a esticada (${mF.nitB.toFixed(2)} × ${mE.nitB.toFixed(2)})`);
ok(mF.nitB > mF.nitA * 0.8 && mF.nitB < mF.nitA * 1.35, `a nitidez fica perto da nativa, sem exagero (${(mF.nitB / mF.nitA * 100).toFixed(0)}%)`);
// os outros presets e a escolha guardada
for (const [p, e] of [['qualidade', 0.77], ['desempenho', 0.5]]) {
  await pagina.evaluate((p) => window.__rel.escolherImagem(p), p);
  const r = await pagina.evaluate(() => window.__rel.posfx.composer.renderTarget1.width / window.__rel.renderer.domElement.width);
  ok(Math.abs(r - e) < 0.02, `${p}: escala ${r.toFixed(2)}`);
}
await pagina.evaluate(() => { window.__rel.escolherImagem('nativa'); });
ok(await pagina.evaluate(() => !window.__rel.posfx.superres.enabled && window.__rel.posfx.composer.renderTarget1.width === window.__rel.renderer.domElement.width), 'Nativa: sem reconstrução, a cena na resolução da tela');
await pagina.evaluate(() => document.querySelector('#imagem button[data-p="desempenho"]').click());
ok(await pagina.evaluate(() => localStorage.getItem('theflash.imagem.v1') === 'desempenho' && document.querySelector('#imagem button.sel')?.dataset.p === 'desempenho'), 'o botão da pausa escolhe e guarda');
ok(!erros.length, `sem erros no console (${erros.slice(0, 3).join(' | ')})`);
await navegador.close(); await srv.fechar();
process.exit(falhas ? 1 : 0);
