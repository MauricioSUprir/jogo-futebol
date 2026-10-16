// teste-tm-tela: a ponte com o Total Match no navegador (contrato "Ponte com o Total Match" no CONTRATOS.md). A página
// do TM é imitada por um quadro pai na MESMA origem (como o legacy-total-match/js/tm3d.js: grava o pedido em
// localStorage["tm3d:pedido:<id>"], abre golaco/index.html?tm=<id> num iframe e escuta o postMessage).
//   1  PC 1280×720, pedido A (o usuário é o mandante, sem trava): 'tm3d:pronto' chega ao pai; as siglas do placar são as
//      do pedido; o humano controla um jogador do time 0; o jogo anda uns segundos.
//   2  A pausa do TM: com "Simular o resto", "Editar time" e "Cenas da partida" (pré-jogo e substituição), sem
//      "Reiniciar partida" nem os treinos.
//   3  "Simular o resto": a faixa "Simulando o resto da partida…" com minuto e placar, a partida chega ao apito, a faixa do
//      fim tem "Voltar ao Total Match", o resultado já está em localStorage["tm3d:resultado:<id>"] (formato do contrato,
//      placar = o do mundo, posse somando 100).
//   4  "Voltar ao Total Match" (clique de verdade): o pai recebe 'tm3d:fim' com o MESMO resultado gravado.
//   5  Celular 844×390 com toque, pedido B (Rumo ao Estrelato: o usuário é o visitante e controla SÓ o centroavante):
//      humano 1, o controlado é o travado; TROCAR, GOLEIRO e o TROCAR da bola na mão escondidos; TROCAR/GOLEIRO apertados
//      não tiram o controle dele; a pausa sem "Editar time", "Reiniciar partida" e os treinos (o submenu vira "Cenas da partida").
//   6  Celular: "Simular o resto" → o resultado traz `jogador` com o tmId do travado e a nota (4,5–10).
//   7  Sem ?tm: nada do TM (sem "Simular o resto" nem "Voltar ao Total Match" na pausa, "Reiniciar partida" e "Modo de jogo"
//      à vista, __golaco.tm null, nenhuma mensagem ao pai).
//   8  Sem erro no console em nenhuma tela.
// Saída PASSOU/REPROVOU por item; código 1 se algum reprovar.
//   node tools/teste-tm-tela.mjs [--raiz <pasta do jogo>] [--pedido <arquivo.json>]  (um pedido de verdade do TM no lugar do A)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const raiz = path.resolve(arg('--raiz', RAIZ));
const { PED_A, PED_B } = await import(pathToFileURL(path.join(AQUI, 'lib/pedidos-tm.mjs')).href);
const arqPedido = arg('--pedido', null);
// (um pedido de verdade traz as imagens do site do TM com o endereço absoluto dele — outra origem aqui, onde só o golaco/ é
// servido: viram null, e o jogo desenha o escudo com a sigla, como faz com os times sem identidade)
const semImagensDeFora = o => JSON.parse(JSON.stringify(o), (k, v) => (typeof v === 'string' && /^https?:\/\//.test(v) && ['escudo', 'bandeira', 'foto'].includes(k) ? null : v));
const PEDIDO_A = arqPedido ? { ...semImagensDeFora(JSON.parse(fs.readFileSync(arqPedido, 'utf8'))), id: 'tA' } : PED_A;
const res = [];
const meta = (nome, medido, ok) => res.push({ nome, medido, ok: !!ok });
const BIT = { TROCAR: 1024, GOLEIRO: 2048 };

const srv = await servidor(0, raiz);
// ?min=1: tempos de 1 min (o "Simular o resto" mais curto); replay e comemoração desligados (como nos outros testes de tela)
const Q = 'q=baixa&replay=0&comemoracao=0&min=1';

/** Página do "TM": grava o pedido, abre o jogo num iframe e guarda as mensagens dele em window.__msgs. */
function htmlQuadro(pedido, q) {
  const json = JSON.stringify(JSON.stringify(pedido)).replace(/</g, '\\u003c');
  const id = JSON.stringify(pedido.id);
  return `<!doctype html><html><head><meta charset="utf-8"><title>TM</title></head><body style="margin:0;background:#000">
<script>
localStorage.setItem('tm3d:pedido:' + ${id}, ${json});
localStorage.removeItem('tm3d:resultado:' + ${id});
window.__msgs = [];
addEventListener('message', e => { const f = document.getElementById('q'); if (e.origin === location.origin && f && e.source === f.contentWindow) window.__msgs.push(e.data); });
const f = document.createElement('iframe');
f.id = 'q'; f.src = 'index.html?tm=' + encodeURIComponent(${id}) + '&${q}';
f.allow = 'fullscreen; autoplay; gamepad';
f.style.cssText = 'border:0;width:100vw;height:100vh;display:block';
document.body.appendChild(f);
</script></body></html>`;
}

async function abrirTM(pedido, t) {
  const s = await abrir({ largura: t.largura, altura: t.altura, dpr: t.dpr ?? 1, toque: !!t.toque });
  const url = `${srv.url}__quadro-tm-${pedido.id}.html`;
  await s.contexto.route(url, r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: htmlQuadro(pedido, Q) }));
  await s.pagina.goto(url, { waitUntil: 'load' });
  let fr = null;
  for (let i = 0; i < 200 && !fr; i++) { fr = s.pagina.frames().find(f => /[?&]tm=/.test(f.url())); if (!fr) await s.pagina.waitForTimeout(50); }
  if (!fr) throw new Error('o quadro do jogo não abriu');
  await fr.waitForFunction(() => window.__golaco && window.__golaco.pronto && (window.__golaco.sobDemanda?.ja() ?? true), null, { timeout: 180000 });
  return { ...s, fr };
}
const msgs = pg => pg.evaluate(() => window.__msgs.map(m => ({ ...m })));
const visivel = (fr, sel) => fr.evaluate(sel => { const e = document.querySelector(sel); if (!e || e.hidden) return false; const st = getComputedStyle(e); return st.display !== 'none' && st.visibility !== 'hidden' && e.getBoundingClientRect().width > 0; }, sel);
const textoDe = (fr, sel) => fr.evaluate(sel => document.querySelector(sel)?.textContent?.trim() ?? null, sel);
async function esperar(fr, fn, arg, ms = 240000) { await fr.waitForFunction(fn, arg, { timeout: ms, polling: 200 }); }
function formatoOk(r, placar) {
  const e = [];
  if (!r) return ['sem resultado'];
  for (const k of ['homeGoals', 'awayGoals', 'gols', 'cartoes', 'stats']) if (!(k in r)) e.push(`sem ${k}`);
  if (placar && (r.homeGoals !== placar[0] || r.awayGoals !== placar[1])) e.push('placar ≠ mundo');
  if (r.stats && r.stats.possession[0] + r.stats.possession[1] !== 100) e.push('posse ≠ 100');
  for (const g of r.gols ?? []) if (!(g.minuto >= 1 && g.minuto <= 90) || typeof g.contra !== 'boolean' || typeof g.penalti !== 'boolean' || !('assist' in g)) e.push('gol fora do formato');
  for (const c of r.cartoes ?? []) if (c.cor !== 'yellow' && c.cor !== 'red') e.push('cor do cartão');
  return e;
}
/** Pausa pelo botão do menu (clique de verdade) e os itens visíveis dela. */
async function itensDaPausa(fr) {
  await fr.click('#btn-menu');
  await esperar(fr, () => !document.getElementById('menu').hidden, null, 10000);
  const itens = {};
  for (const [k, sel] of Object.entries({ simular: '#btn-simular-resto', editar: '#menu [data-cmd="editar-time"]', reiniciar: '#btn-reiniciar-partida', modos: '#btn-modos', voltar: '#btn-voltar-tm', continuar: '#btn-continuar' })) itens[k] = await visivel(fr, sel);
  // os treinos no submenu (no TM o submenu é "Cenas da partida": só o pré-jogo e a substituição)
  itens.treinos = await fr.evaluate(() => [...document.querySelectorAll('#menu-modos [data-cmd="modo"]')].some(b => !b.hidden));
  return itens;
}
const listaItens = it => Object.entries(it).filter(([, v]) => v).map(([k]) => k).join(', ') || 'nada';

// ------------------------------------------------------------------ 1–4 PC, pedido A
{
  const s = await abrirTM(PEDIDO_A, { largura: 1280, altura: 720 });
  const { pagina: pg, fr } = s;
  await pg.waitForFunction(() => window.__msgs.some(m => m.tipo === 'tm3d:pronto'), null, { timeout: 10000 }).catch(() => {});
  const m0 = await msgs(pg);
  const siglas = [await textoDe(fr, '#sigla-0'), await textoDe(fr, '#sigla-1')];
  const info = await fr.evaluate(() => { const g = window.__golaco; const c = g.mundo.jogadores.find(j => j.id === g.estado().controlado); return { humano: g.tm?.humano, trava: g.tm?.trava, timeCtrl: c?.time, elenco: g.mundo.times[0].elenco }; });
  const tick0 = await fr.evaluate(() => window.__golaco.mundo.tick);
  await pg.waitForTimeout(2500);
  const tick1 = await fr.evaluate(() => window.__golaco.mundo.tick);
  const siglasPed = [PEDIDO_A.home.short, PEDIDO_A.away.short].map(x => String(x).toUpperCase().slice(0, 3));
  // (o pedido A: o usuário é o mandante, sem trava; um --pedido de verdade diz o lado e a trava dele)
  const hEsp = PEDIDO_A.userSide === 'away' ? 1 : 0, comTrava = !!PEDIDO_A.controle;
  meta(`1 PC: tm3d:pronto ao pai, siglas do pedido, humano no time ${hEsp}${comTrava ? ' (com a trava)' : ''}, o jogo anda`,
    `${m0.map(m => m.tipo).join(', ') || 'nenhuma'} (id ${m0[0]?.id}) · ${siglas.join(' × ')} · humano ${info.humano}, trava ${info.trava ?? 'nenhuma'}, controlado do time ${info.timeCtrl} · elenco ${info.elenco} · ${tick1 - tick0} passos em 2,5 s`,
    m0.length === 1 && m0[0].tipo === 'tm3d:pronto' && m0[0].id === PEDIDO_A.id && siglas.join() === siglasPed.join() && info.humano === hEsp && (info.trava != null) === comTrava && info.timeCtrl === hEsp && info.elenco === 'tmcasa' && tick1 - tick0 > 30);
  const it = await itensDaPausa(fr);
  meta(`2 PC: pausa do TM (Simular o resto${comTrava ? '' : ' e Editar time'}, Cenas da partida; sem Reiniciar nem os treinos${comTrava ? ' nem Editar time' : ''})`, listaItens(it),
    it.simular && it.editar === !comTrava && !it.reiniciar && it.modos && !it.treinos && !it.voltar);
  const tickSim0 = await fr.evaluate(() => window.__golaco.mundo.tick);
  const tSim0 = Date.now();
  await fr.click('#btn-simular-resto');
  let simTexto = null;
  for (let i = 0; i < 40 && !simTexto; i++) {
    const t = await fr.evaluate(() => ({ titulo: document.getElementById('faixa-titulo')?.textContent, placar: document.getElementById('faixa-placar')?.textContent, vis: !document.getElementById('faixa').hidden }));
    if (t.vis && /Simulando/.test(t.titulo)) simTexto = `${t.titulo} ${t.placar}`;
    else await pg.waitForTimeout(50);
  }
  await esperar(fr, () => window.__golaco.mundo.partida.estado === 'fim' && !window.__golaco.tm.simulando);
  const tSim = (Date.now() - tSim0) / 1000;
  const fimInfo = await fr.evaluate(() => {
    const g = window.__golaco, b = document.getElementById('faixa-botao');
    return { tick: g.mundo.tick, placar: g.estado().placar, gravado: g.tm.resultadoGravado(), agora: g.tm.resultado(), titulo: document.getElementById('faixa-titulo').textContent,
      botao: b && !b.hidden ? b.textContent.trim() : null, cmd: b?.dataset.cmd };
  });
  const e3 = formatoOk(fimInfo.gravado, fimInfo.placar);
  const igual = JSON.stringify(fimInfo.gravado) === JSON.stringify(fimInfo.agora);
  meta('3 PC: Simular o resto → aviso com minuto e placar, apito, faixa com "Voltar ao Total Match", resultado gravado',
    `${fimInfo.tick - tickSim0} passos em ${tSim.toFixed(1).replace('.', ',')} s · aviso "${simTexto ?? 'não visto'}" · ${fimInfo.titulo} ${fimInfo.placar.join(' × ')} · botão "${fimInfo.botao}" (${fimInfo.cmd}) · gravado ${fimInfo.gravado ? 'sim' : 'não'}${igual ? '' : ' (≠ agora)'}${e3.length ? ' · ' + e3.join('; ') : ''}`,
    !!simTexto && /\d+' · /.test(simTexto) && fimInfo.titulo === 'Fim de jogo' && fimInfo.botao === 'Voltar ao Total Match' && fimInfo.cmd === 'voltar-tm' && !!fimInfo.gravado && igual && !e3.length);
  await fr.click('#faixa-botao');
  await pg.waitForFunction(() => window.__msgs.some(m => m.tipo === 'tm3d:fim'), null, { timeout: 10000 }).catch(() => {});
  const m1 = await msgs(pg);
  const fimMsg = m1.find(m => m.tipo === 'tm3d:fim');
  meta('4 PC: "Voltar ao Total Match" manda tm3d:fim ao pai com o resultado gravado',
    `${m1.map(m => m.tipo).join(', ')} · resultado ${fimMsg ? (JSON.stringify(fimMsg.resultado) === JSON.stringify(fimInfo.gravado) ? 'igual ao gravado' : 'DIFERENTE do gravado') : 'ausente'}`,
    !!fimMsg && fimMsg.id === PEDIDO_A.id && JSON.stringify(fimMsg.resultado) === JSON.stringify(fimInfo.gravado));
  meta('8a PC: sem erro no console', s.erros.length ? s.erros.slice(0, 3).join(' | ') : 'nenhum', s.erros.length === 0);
  await s.navegador.close();
}

// ------------------------------------------------------------------ 5–6 celular, pedido B (Rumo ao Estrelato)
{
  const s = await abrirTM(PED_B, { largura: 844, altura: 390, dpr: 2, toque: true });
  const { pagina: pg, fr } = s;
  const info = await fr.evaluate(() => { const g = window.__golaco; return { humano: g.tm.humano, trava: g.tm.trava, ctrl: g.estado().controlado, tmIdTrava: g.tm.mapa[g.tm.trava]?.tmId }; });
  const escondidos = [];
  for (const id of ['btn-trocar', 'btn-goleiro', 'btn-trocar-mao']) if (!(await visivel(fr, '#' + id))) escondidos.push(id);
  // TROCAR e GOLEIRO apertados (pela entrada da página: o mesmo caminho do teclado/toque) não tiram o controle do travado
  const depois = await fr.evaluate(([b]) => {
    const g = window.__golaco;
    const ids = new Set();
    for (let k = 0; k < 12; k++) {
      g.rodarPassos(15, { x: (k % 3) - 1, z: ((k + 1) % 3) - 1, botoes: k % 2 ? b.TROCAR : b.TROCAR | b.GOLEIRO });
      g.rodarPassos(15, { x: 0, z: 0, botoes: 0 });
      ids.add(g.estado().controlado);
    }
    return [...ids];
  }, [BIT]);
  const it = await itensDaPausa(fr);
  meta('5 celular, Estrelato: humano 1, o controlado é o travado, sem TROCAR/GOLEIRO, a trava não solta, pausa sem Editar/Reiniciar/treinos',
    `humano ${info.humano} · travado ${info.trava} (${info.tmIdTrava}) · controlado ${info.ctrl} · escondidos ${escondidos.join(', ')} · controlados depois dos apertos [${depois.join(', ')}] · pausa: ${listaItens(it)}`,
    info.humano === 1 && info.trava != null && info.ctrl === info.trava && info.tmIdTrava === PED_B.controle.tmId && escondidos.length === 3
      && depois.length === 1 && depois[0] === info.trava && it.simular && !it.editar && !it.reiniciar && it.modos && !it.treinos);
  await fr.click('#btn-simular-resto');
  await esperar(fr, () => window.__golaco.mundo.partida.estado === 'fim' && !window.__golaco.tm.simulando);
  const r = await fr.evaluate(() => window.__golaco.tm.resultadoGravado());
  const e6 = formatoOk(r, null);
  meta('6 celular: Simular o resto → resultado com o jogador travado e a nota',
    r ? `${r.homeGoals} × ${r.awayGoals} · jogador ${r.jogador ? `${r.jogador.tmId} nota ${r.jogador.nota} (${r.jogador.toques} toques, ${r.jogador.passes} passes)` : 'ausente'}${e6.length ? ' · ' + e6.join('; ') : ''}` : 'sem resultado',
    !!r && !!r.jogador && r.jogador.tmId === PED_B.controle.tmId && r.jogador.nota >= 4.5 && r.jogador.nota <= 10 && !e6.length);
  meta('8b celular: sem erro no console', s.erros.length ? s.erros.slice(0, 3).join(' | ') : 'nenhum', s.erros.length === 0);
  await s.navegador.close();
}

// ------------------------------------------------------------------ 7 sem ?tm
{
  const s = await abrir({ largura: 1280, altura: 720 });
  const pg = s.pagina;
  await pg.goto(`${srv.url}?${Q}`, { waitUntil: 'load' });
  await pg.waitForFunction(() => window.__golaco && window.__golaco.pronto && (window.__golaco.sobDemanda?.ja() ?? true), null, { timeout: 180000 });
  const tm = await pg.evaluate(() => window.__golaco.tm);
  const it = await itensDaPausa(pg);
  const placar = [await textoDe(pg, '#sigla-0'), await textoDe(pg, '#sigla-1')];
  meta('7 sem ?tm: nada do TM (pausa de sempre, __golaco.tm null, placar GLÇ × VNT)', `tm ${tm === null ? 'null' : 'existe'} · pausa: ${listaItens(it)} · ${placar.join(' × ')}`,
    tm === null && !it.simular && !it.voltar && it.reiniciar && it.modos && it.treinos && it.editar && placar.join() === 'GLÇ,VNT');
  meta('8c sem ?tm: sem erro no console', s.erros.length ? s.erros.slice(0, 3).join(' | ') : 'nenhum', s.erros.length === 0);
  await s.navegador.close();
}

await srv.fechar();
const larg = Math.max(...res.map(r => r.nome.length));
for (const r of res) console.log(`${r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.nome.padEnd(larg)}  ${r.medido}`);
const falhas = res.filter(r => !r.ok).length;
console.log(falhas ? `\nteste-tm-tela: REPROVOU (${falhas})` : '\nteste-tm-tela: PASSOU');
process.exit(falhas ? 1 : 0);
