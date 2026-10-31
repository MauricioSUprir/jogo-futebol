// Teste da TELA ORGANIZADA (dono, 31/10: "tem muita informação na tela, organize melhor"): com um capítulo de vilão começando
// (o painel do vilão no alto) e um aviso e uma fala de rádio chegando ao mesmo tempo, mede a tela por uns segundos: nenhuma
// caixa do HUD cobre outra (painel, rádio, aviso, minimapa, pausa, energia, marcador do guia, joystick e botões), o rádio
// espera o aviso sair (nunca os dois juntos) e depois aparece, logo abaixo do painel; os botões não mostram porcentagens.
// Uso: node velocista/tools/teste-tela.mjs [--celular] [--raiz <pasta do velocista>] (a raiz de outra versão: medir o antes)
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), celular = args.includes('--celular');
const raiz = args.includes('--raiz') ? args[args.indexOf('--raiz') + 1] : path.join(AQUI, '..');
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? 'OK ' : 'ERRO'} ${msg}`); if (!c) falhas++; };

const { servidor, abrir } = await import(pathToFileURL(path.join(AQUI, '../../golaco/tools/lib/navegador.mjs')).href);
const srv = await servidor(0, raiz);
const { navegador, pagina, erros } = await abrir(celular ? { largura: 844, altura: 390, dpr: 2, toque: true } : { largura: 1280, altura: 720 });
pagina.setDefaultTimeout(1200000);
await pagina.goto(srv.url + '?missao=cap-frio');
await pagina.waitForSelector('#btnJogar:not([hidden])');
await pagina.evaluate(() => { Element.prototype.requestFullscreen = undefined; document.getElementById('btnJogar').click(); });
await pagina.waitForFunction(() => window.__rel.carregados.size >= 9, null, { polling: 500 });
// o capítulo começa (painel do vilão) e chega tudo junto: o aviso e duas falas de rádio
await pagina.waitForFunction(() => window.__rel.viloes.ativo, null, { polling: 500 });
await pagina.evaluate(() => { const R = window.__rel; R.historia.pular?.(); R.historia.calarRadio(); R.avisar('Capitão Frio apareceu', 'Alerta na cidade', 'crime'); R.historia.radio('capitulo-frio', { sempre: true }); });

// as caixas visíveis do HUD (opacidade > 0,3), com o retângulo de cada uma
const medir = () => pagina.evaluate(() => {
  const sel = ['#missao', '#chefe', '#radio', '#aviso', '#mapaBox', '#btPausa', '#energia', '#marcadorGuia', '#stick', '.bt', '.esp', '#acao'];
  const caixas = [];
  for (const s of sel) for (const e of document.querySelectorAll(s)) {
    let vis = true;
    for (let x = e; x && x !== document.body; x = x.parentElement) { const c = getComputedStyle(x); if (x.hidden || c.display === 'none' || c.visibility === 'hidden' || Number(c.opacity) < 0.3) { vis = false; break; } }
    if (!vis) continue;
    const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    // o marcador: só o desenho e o rótulo
    caixas.push({ id: e.id || s, x0: r.left, y0: r.top, x1: r.right, y1: r.bottom });
  }
  const av = document.getElementById('aviso'), ra = document.getElementById('radio');
  return { caixas, radio: ra.classList.contains('vis'), aviso: Number(getComputedStyle(av).opacity) > 0.3, t: performance.now(),
    det: `aviso ${av.className} ${getComputedStyle(av).opacity} J.aviso=${window.__rel.J.aviso?.toFixed?.(2)} · rádio ${ra.className} ${getComputedStyle(ra).opacity} "${ra.textContent.slice(0, 30)}"` };
});
const cobre = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 2 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 2;
const sobreposicoes = new Set(); let juntos = 0, viuAviso = false, radioDepois = false, amostras = 0, topo = null;
const t0 = Date.now();
while (Date.now() - t0 < 600000) {
  const m = await medir(); amostras++;
  for (let i = 0; i < m.caixas.length; i++) for (let j = i + 1; j < m.caixas.length; j++) if (cobre(m.caixas[i], m.caixas[j])) sobreposicoes.add(`${m.caixas[i].id} × ${m.caixas[j].id}`);
  if (m.radio && m.aviso && ++juntos <= 3) console.log('     juntos:', m.det);
  if (m.aviso) viuAviso = true;
  if (viuAviso && !m.aviso && m.radio) { radioDepois = true; const r = m.caixas.find((c) => c.id === 'radio'), p = m.caixas.find((c) => c.id === 'chefe'); if (r && p) topo = r.y0 - p.y1; }
  if (radioDepois && topo !== null && amostras > 6) break;
  await pagina.waitForTimeout(150);
}
console.log(`     ${amostras} amostras`);
ok(!sobreposicoes.size, `nenhuma caixa do HUD cobre outra (${[...sobreposicoes].slice(0, 6).join(', ')})`);
ok(!juntos, `o aviso e o rádio nunca aparecem juntos (${juntos} amostras com os dois)`);
ok(viuAviso && radioDepois, 'o aviso aparece primeiro e o rádio fala depois que ele sai');
ok(topo !== null && topo >= 2 && topo <= 24, `o rádio logo abaixo do painel do vilão (${topo?.toFixed(0)} px)`);
ok(await pagina.evaluate(() => ![...document.querySelectorAll('.esp, .chip')].some((e) => /%/.test(e.textContent))), 'os botões e as fichas dos especiais sem porcentagens');
ok(!erros.length, `sem erros no console (${erros.slice(0, 3).join(' | ')})`);
await navegador.close(); await srv.fechar();
process.exit(falhas ? 1 : 0);
