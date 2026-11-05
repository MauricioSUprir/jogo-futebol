// teste-tm-tela: a ponte com o Total Match no navegador (contrato "Ponte com o Total Match" no CONTRATOS.md). A página
// do TM é imitada por um quadro pai na MESMA origem (como o legacy-total-match/js/tm3d.js: grava o pedido em
// localStorage["tm3d:pedido:<id>"], abre golaco/index.html?tm=<id> num iframe e escuta o postMessage).
//   1  PC 1280×720, pedido A (o usuário é o mandante, sem trava): 'tm3d:pronto' chega ao pai; as siglas do placar são as
//      do pedido; o humano controla um jogador do time 0; o jogo anda uns segundos.
//   1c PC, pedido A (item 32; dono, 17/10: "o placar com mais a cara do Total Match, um pouco MAIOR e o relógio com os
//      SEGUNDOS"): o placar com 30 px, o #relogio em MM:SS na Inter TM (data-fontes-tm="ok") e o símbolo do TM na marca.
//   2  A pausa do TM: com "Simular o resto", "Editar time" e "Partida e cenas" (a duração e a dificuldade — item 33 —, o pré-jogo e
//      as cenas; era "Cenas da partida"), sem
//      "Reiniciar partida" nem os treinos.
//   3  "Simular o resto": a faixa "Simulando o resto da partida…" com minuto e placar, a partida chega ao apito, a faixa do
//      fim tem "Voltar ao Total Match", o resultado já está em localStorage["tm3d:resultado:<id>"] (formato do contrato,
//      placar = o do mundo, posse somando 100).
//   3b (item 32) Durante o "Simular o resto" o relógio MM:SS do placar é sempre o do mundo (≥ 20 leituras entre os pedaços
//      da simulação, todas iguais à conta do relogio-placar.js; antes da correção a página só o reescrevia quando mudava o
//      minuto da faixa) e termina em "Fim".
//   4  "Voltar ao Total Match" (clique de verdade): o pai recebe 'tm3d:fim' com o MESMO resultado gravado.
//   5  Celular 844×390 com toque, pedido B (Rumo ao Estrelato: o usuário é o visitante e controla SÓ o centroavante):
//      humano 1, o controlado é o travado; TROCAR, GOLEIRO e o TROCAR da bola na mão escondidos; TROCAR/GOLEIRO apertados
//      não tiram o controle dele; a pausa sem "Editar time", "Reiniciar partida" e os treinos (o submenu vira "Partida e cenas").
//   5b Celular (itens 59 e 60): o travado com a bola mostra o nome no canto de baixo à DIREITA (o humano é o visitante: o time
//      da direita do placar), com a fonte do TM (Inter TM) e a faixa da cor do time 1 do placar — inteira: o recorte do raio
//      do cartão deixa ≥ 85% da altura dela na coluna do meio (com o raio de 8 px, ~64%: a faixa virava um ")").
//   5c Celular (item 66, revisão R2): a TV de jogo com o travado parado (ninguém mexe nele) por 60 s: ele inteiro (os pés e a
//      cabeça) na tela em ≥ 85% dos instantes e a bola em todos (a TV que segue a bola o deixava fora sem a caixa dele).
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
  // (com a meta viewport, como o TM de verdade — legacy-total-match/index.html: sem ela, com isMobile, o caso de "844×390" media
  // 980 px de largura dentro do quadro)
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>TM</title></head><body style="margin:0;background:#000">
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
  // os treinos no submenu (no TM o submenu é "Partida e cenas": a duração e a dificuldade, o pré-jogo e as cenas)
  itens.treinos = await fr.evaluate(() => [...document.querySelectorAll('#menu-modos [data-cmd="modo"]')].some(b => !b.hidden));
  // (item 33: o nome do submenu e a linha "Duração | Dificuldade" dentro dele, sem ajustesFixos no pedido)
  const sub = await fr.evaluate(() => ({ nome: document.querySelector('#btn-modos .item-txt')?.textContent ?? '', linha: !document.getElementById('linha-ajustes')?.hidden }));
  itens.partidaECenas = sub.nome === 'Partida e cenas' && sub.linha;
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
  // 1c (item 32): o placar novo com a cara do TM no PC
  await fr.waitForFunction(() => !!document.documentElement.dataset.fontesTm, null, { timeout: 15000 }).catch(() => {});
  const pl = await fr.evaluate(() => {
    const p = document.querySelector('#hud .placar'), r = document.getElementById('relogio'), m = p?.querySelector('.placar-marca');
    const q = p?.getBoundingClientRect();
    return { h: q?.height ?? 0, txt: r?.textContent.trim() ?? '', fonte: r ? getComputedStyle(r).fontFamily : '', fontes: document.documentElement.dataset.fontesTm ?? '-',
      check: document.fonts.check('800 17px "Inter TM"'), marca: m && getComputedStyle(m).display !== 'none' ? getComputedStyle(m).backgroundImage : null };
  });
  meta('1c PC: o placar do item 32 com a cara do TM — 30 px, o relógio em MM:SS na Inter TM (fontes ok), o símbolo do TM na marca',
    `${pl.h.toFixed(1)} px · "${pl.txt}" em ${pl.fonte} (fontes ${pl.fontes}, Inter TM 800 ${pl.check ? 'carregada' : 'NÃO'}) · marca ${pl.marca ?? 'ausente'}`,
    Math.abs(pl.h - 30) <= 0.5 && /^\d{2}:\d{2}$/.test(pl.txt) && /^"?Inter TM/.test(pl.fonte) && pl.fontes === 'ok' && pl.check && /simbolo\.png/.test(pl.marca ?? ''));
  const it = await itensDaPausa(fr);
  meta(`2 PC: pausa do TM (Simular o resto${comTrava ? '' : ' e Editar time'}, Partida e cenas com a duração e a dificuldade; sem Reiniciar nem os treinos${comTrava ? ' nem Editar time' : ''})`, listaItens(it),
    it.simular && it.editar === !comTrava && !it.reiniciar && it.modos && !it.treinos && !it.voltar && it.partidaECenas);
  const tickSim0 = await fr.evaluate(() => window.__golaco.mundo.tick);
  // 3b (item 32): a conta do texto do relógio (relogio-placar.js, a mesma do hud) carregada ANTES (as leituras do 3b ficam
  // síncronas: nenhum pedaço da simulação entra entre ler o #relogio e ler o mundo)
  await fr.evaluate(async () => { window.__textoRel = (await import('./js/relogio-placar.js')).textoRelogio; });
  const tSim0 = Date.now();
  await fr.click('#btn-simular-resto');
  let simTexto = null;
  for (let i = 0; i < 40 && !simTexto; i++) {
    const t = await fr.evaluate(() => ({ titulo: document.getElementById('faixa-titulo')?.textContent, placar: document.getElementById('faixa-placar')?.textContent, vis: !document.getElementById('faixa').hidden }));
    if (t.vis && /Simulando/.test(t.titulo)) simTexto = `${t.titulo} ${t.placar}`;
    else await pg.waitForTimeout(50);
  }
  // 3b: enquanto simula, o #relogio é sempre o do mundo — o que a conta do relogio-placar.js dá para o estado da página
  // (cada leitura entre dois pedaços da simulação; antes da correção a página só reescrevia o relógio quando mudava o minuto
  // da faixa: os segundos ficavam parados até ~1 min de jogo)
  const rel3b = { leituras: 0, iguais: 0, dif: [], textos: new Set() };
  for (let i = 0; i < 4000; i++) {
    const x = await fr.evaluate(() => {
      const g = window.__golaco;
      if (!g.tm.simulando) return null;
      const r = g.estado().relogio;
      return { visto: document.getElementById('relogio').textContent.trim(), esperado: r ? window.__textoRel(r).texto : '' };
    });
    if (!x) break;
    rel3b.leituras++; rel3b.textos.add(x.visto);
    if (x.visto === x.esperado) rel3b.iguais++; else if (rel3b.dif.length < 4) rel3b.dif.push(`"${x.visto}" ≠ "${x.esperado}"`);
    await pg.waitForTimeout(20);
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
  const relFim = await fr.evaluate(() => document.getElementById('relogio').textContent.trim());
  meta('3b PC (item 32): durante o "Simular o resto" o relógio MM:SS do placar é sempre o do mundo (não só na troca do minuto da faixa); no fim, "Fim"',
    `${rel3b.iguais}/${rel3b.leituras} leituras iguais à conta do relogio-placar.js (${rel3b.textos.size} textos)${rel3b.dif.length ? ' — diferentes: ' + rel3b.dif.join(', ') : ''} · no fim "${relFim}"`,
    rel3b.leituras >= 20 && rel3b.iguais === rel3b.leituras && relFim === 'Fim');
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
  // 5b: o travado com a bola (a simulação parada; o desenho lê mundo.posse): o nome à direita, com a cara do TM
  const nm = await fr.evaluate(async () => {
    const g = window.__golaco, posse0 = g.mundo.posse;
    g.relogio.usarManual(true); g.pausar(true);
    g.mundo.posse = g.tm.trava; g.relogio.avancar(1000);
    const e = document.getElementById('nome-condutor'), cs = e ? getComputedStyle(e) : null;
    const vis = !!e && !e.hidden && cs.display !== 'none' && e.getBoundingClientRect().width > 0;
    const r = e?.getBoundingClientRect(), cor = e?.querySelector('.nc-cor'), pc = document.querySelector('#placar-time-1 .placar-cor');
    const s = document.createElement('div'); s.style.cssText = 'position:fixed;right:var(--sa-r);bottom:var(--sa-b);left:0;top:0;visibility:hidden'; document.body.append(s);
    const sa = s.getBoundingClientRect(); s.remove();
    const out = { vis, dir: !!e?.classList.contains('dir'), noHud: !!e?.closest('#hud'), fonte: cs?.fontFamily ?? '', fontes: document.documentElement.dataset.fontesTm ?? '-',
      cor: cor ? getComputedStyle(cor).backgroundColor : null, corPlacar: pc ? getComputedStyle(pc).backgroundColor : null,
      borda: r ? sa.right - r.right : NaN, base: r ? sa.bottom - r.bottom : NaN, texto: e?.textContent ?? '' };
    // a faixa da cor inteira (revisão): o recorte do raio do cartão (overflow hidden) na coluna do MEIO da faixa, nas duas
    // pontas — a fração da altura dela que sobra (raio 8 numa caixa de 15 px: ~64%, um ")"; raio 4: ~94%)
    if (cor && r) {
      const q = cor.getBoundingClientRect(), dir = q.left + q.width / 2 > r.left + r.width / 2;
      const raio = Math.min(...[dir ? cs.borderTopRightRadius : cs.borderTopLeftRadius, dir ? cs.borderBottomRightRadius : cs.borderBottomLeftRadius].map(parseFloat), r.height / 2);
      const ri = Math.max(0, raio - parseFloat(dir ? cs.borderRightWidth : cs.borderLeftWidth));
      const x = (dir ? r.right - parseFloat(cs.borderRightWidth) - (q.left + q.width / 2) : q.left + q.width / 2 - r.left - parseFloat(cs.borderLeftWidth));
      const corte = x >= ri ? 0 : ri - Math.sqrt(Math.max(0, ri * ri - (ri - x) ** 2));
      out.faixaInteira = q.height > 0 ? Math.max(0, q.height - 2 * corte) / q.height : 0;
      out.raio = raio;
    }
    g.mundo.posse = posse0; g.pausar(false); g.relogio.usarManual(false);
    return out;
  });
  meta('5b celular, Estrelato: o travado com a bola — o nome no canto de baixo à direita (o time da direita do placar), fonte Inter TM, a cor do time 1 do placar',
    `${nm.vis ? `"${nm.texto}" ${nm.dir ? 'à direita' : 'à ESQUERDA'}${nm.noHud ? '' : ' (fora do #hud)'}, a ${nm.borda.toFixed(0)} px da borda e ${nm.base.toFixed(0)} da base; fonte ${nm.fonte} (fontes ${nm.fontes}); cor ${nm.cor} × placar ${nm.corPlacar}; faixa inteira em ${((nm.faixaInteira ?? 0) * 100).toFixed(0)}% da altura (raio ${nm.raio ?? '-'} px)` : 'o nome não aparece'}`,
    nm.vis && nm.dir && nm.noHud && nm.borda <= 16 && nm.base <= 6.5 && /Inter TM/.test(nm.fonte) && !!nm.cor && nm.cor === nm.corPlacar && nm.faixaInteira >= 0.85);
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
  // 5c (item 66, revisão R2): a TV segue a bola e, sem troca, o travado (aqui parado: ninguém mexe nele) ficava fora do quadro;
  // agora os pés e a cabeça dele entram na conta quando cabem com a bola. 60 s de jogo no relógio manual, 1 instante a cada
  // 0,5 s com a câmera de jogo (sem a da bola parada): o travado inteiro na tela e a bola na tela. Depois do 6, na partida
  // nova da mesma semente (a mesma em toda versão: o começo do 5 anda no relógio de verdade)
  const t5c = await fr.evaluate(() => {
    const g = window.__golaco, r = g.render, W = innerWidth, H = innerHeight;
    const naQ = p => !p.atras && p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H;
    g.relogio.usarManual(true);
    g.reiniciar({ modo: 'partida', semente: 5 });
    let n = 0, jog = 0, bola = 0;
    for (let f = 0; f < 3600; f++) {
      g.relogio.avancar(1000 / 60, { desenhar: false });
      if (f % 30 || g.estadio.planoCamera !== 'jogo' || g.mundo.partida?.estado !== 'jogo' || (g.bolaParada?.estado?.mistura ?? 0) > 0.01) continue;
      n++;
      if (naQ(g.naTela(r.jogador.x, 0, r.jogador.z)) && naQ(g.naTela(r.jogador.x, 1.8, r.jogador.z))) jog++;
      if (naQ(g.naTela(r.bola.x, Math.max(0.11, r.bola.y), r.bola.z))) bola++;
    }
    g.relogio.usarManual(false);
    return { n, jog, bola };
  });
  meta('5c celular, Estrelato: o travado (parado) inteiro na tela da TV; a bola na tela (60 s, 1 instante a cada 0,5 s)',
    `${t5c.jog}/${t5c.n} (${(100 * t5c.jog / Math.max(1, t5c.n)).toFixed(1)}%); a bola ${t5c.bola}/${t5c.n}`,
    t5c.n >= 60 && t5c.jog >= 0.85 * t5c.n && t5c.bola >= t5c.n - 1);
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
