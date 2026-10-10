// Tela "Editar time" no navegador (Etapa 3; tela "Editar time" §10.2, 13 itens), com mouse,
// teclado e toque DE VERDADE (eventos do Chromium; nada de chamar a lógica direto):
//   1  PC, mouse: Esc → Editar time → o editor abre, a pausa some e o tick fica parado; 7 depois 11
//      → [data-vaga=PD] tem o 11 → PRONTO → a pausa volta → Continuar → 1 quadro → PD = 11 no mundo.
//   2  Hash Node = Chromium: roteiro fixo + a mesma edição (troca, tática e substituição) no passo 300.
//   3  PC, só teclado: Esc, Tab, Enter, setas, Enter, setas, Enter, Esc (PRONTO), Esc → igual ao 1.
//   4  PC, nada vaza: com o editor aberto, J K R M H C não mexem no jogo (câmera, ajuda, recomeço,
//      hash de 60 passos igual ao de uma execução sem as teclas).
//   5  Celular 844×390, toque: 9 depois 22 → selos ↑/↓ e "1/5" → PRONTO → Continuar → pendente →
//      a bola sai (até 20 s) → evento substituicao, o 22 em campo, o 9 fora e o aviso no HUD.
//   6  Celular: arrastar 60 px na lista de reservas não escolhe ninguém.
//   7  Formação: 4-2-3-1 → 11 cartas nas vagas novas e ninguém fora; 3-5-2 → 2 com o selo "!";
//      PRONTO/Continuar → formação no mundo.
//   8  Táticas: Baixa → 2 × "›" → Alta e a prévia muda (soma dos pixels) → PRONTO → linha 2 no mundo.
//   9  Desfazer tudo: depois de uma troca, rascunho = mundo; PRONTO sem diferença não põe nada na fila.
//  10  Nada encosta (6 telas × 3 abas × 3 estados): alvos ≥ 48 px, folga ≥ 4 px, área segura, nomes
//      inteiros, sem rolagem horizontal, toda lista que rola alcança o último item.
//  11  Girar o celular (844×390 → 390×844) com uma carta escolhida: rascunho e escolha continuam, e o 10.
//  12  Treino (?modo=ataque): sem Editar time e sem Reiniciar partida no menu.
//  13  Sem erro no console em nenhuma tela.
// Saída PASSOU/REPROVOU por item; código 1 se algum reprovar.
//   node tools/teste-editor-tela.mjs [--raiz <pasta do jogo>]   (--raiz: mede outra cópia, ex.: a base)
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const raiz = path.resolve(arg('--raiz', RAIZ));
const res = [];
const meta = (nome, medido, ok) => res.push({ nome, medido, ok: !!ok });
const BIT = { CHUTE: 32, CORRER: 1 };

const srv = await servidor(0, raiz);

// lógica em Node da MESMA cópia que o navegador serve (item 2)
const imp = f => import(pathToFileURL(path.join(raiz, 'js', f)).href);

// ------------------------------------------------------------------------------ ajudas
async function abrirPagina(t, q = '') {
  const s = await abrir({ largura: t.largura, altura: t.altura, dpr: t.dpr ?? 1, toque: !!t.toque });
  await s.pagina.goto(`${srv.url}?q=baixa${t.entalhe ? '&entalhe=1' : ''}${q}`, { waitUntil: 'load' });
  await s.pagina.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 120000 });
  await s.pagina.evaluate(() => window.__golaco.relogio.usarManual(true));
  return s;
}
const quadros = (pg, n) => pg.evaluate(n => { const g = window.__golaco; for (let i = 0; i < n; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); return g.estado(); }, n);
const temEditor = pg => pg.evaluate(() => !!(window.__golaco.editor && document.querySelector('[data-cmd="editar-time"]')));
// partida nova com o laço já andando (o 1º quadro depois de reiniciar só marca o tempo: sem isso o
// "Continuar → 1 quadro" do teste não teria passo nenhum)
const novaPartida = (pg, semente = 5, min) => pg.evaluate(([s, min]) => { const g = window.__golaco; const h = g.reiniciar({ modo: 'partida', semente: s, minutosPorTempo: min }); g.relogio.usarManual(true); g.relogio.avancar(1000 / 60, { desenhar: false }); return { ...g.estado(), h }; }, [semente, min]);
const editorAberto = pg => pg.evaluate(() => !document.getElementById('editar-time')?.hidden);
const menuAberto = pg => pg.evaluate(() => !document.getElementById('menu').hidden);
const pressionado = pg => pg.evaluate(() => [...document.querySelectorAll('#editar-time .carta[aria-pressed="true"]')].map(b => +b.dataset.jogador));
const jogadorNaVaga = (pg, v) => pg.evaluate(v => { const b = document.querySelector(`#editar-time [data-vaga="${v}"]`); return b ? +b.dataset.jogador : null; }, v);
async function centro(pg, sel) {
  return pg.evaluate(sel => {
    const e = document.querySelector(sel);
    if (!e) return null;
    e.scrollIntoView({ block: 'nearest' });
    const r = e.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, sel);
}
/** Toque de verdade (CDP) no centro do elemento. */
async function tocar(pg, sel) {
  const c = await centro(pg, sel);
  if (!c) throw new Error(`não achei ${sel}`);
  await pg.touchscreen.tap(c.x, c.y);
  await pg.waitForTimeout(30);
}
async function clicar(pg, sel) {
  const c = await centro(pg, sel);
  if (!c) throw new Error(`não achei ${sel}`);
  await pg.mouse.click(c.x, c.y);
  await pg.waitForTimeout(20);
}

/**
 * Geometria do editor (tela §5 e §10.2 item 10). Devolve {problemas, resumo}.
 * Interativos (botões) ≥ 48×48; interativos e caixas de texto com folga ≥ 4 px entre si (o que está
 * numa lista que rola é recortado pelo retângulo dela); tudo dentro da área segura; nomes inteiros;
 * sem rolagem horizontal da página; cada lista que rola alcança o último item.
 */
async function conferirEditor(pg) {
  return pg.evaluate(() => {
    const raiz = document.getElementById('editar-time');
    const W = innerWidth, H = innerHeight;
    const sonda = document.createElement('div');
    sonda.style.cssText = 'position:fixed;left:var(--sa-l);right:var(--sa-r);top:var(--sa-t);bottom:var(--sa-b);pointer-events:none';
    document.body.appendChild(sonda);
    const r0 = sonda.getBoundingClientRect();
    sonda.remove();
    const sa = { l: r0.left, t: r0.top, r: W - r0.right, b: H - r0.bottom };
    const problemas = [];
    const vis = e => {
      if (e.offsetParent === null && getComputedStyle(e).position !== 'fixed') return false;
      const cs = getComputedStyle(e);
      if (cs.visibility === 'hidden' || cs.display === 'none') return false;
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    // contêineres que rolam (dentro do editor)
    const rola = e => { const cs = getComputedStyle(e); return /(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 1; };
    const roladores = [...raiz.querySelectorAll('*')].filter(e => vis(e) && rola(e));
    const recorte = e => {
      let r = e.getBoundingClientRect();
      let rr = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      for (let p = e.parentElement; p && p !== raiz; p = p.parentElement) {
        if (!roladores.includes(p)) continue;
        const q = p.getBoundingClientRect();
        rr = { left: Math.max(rr.left, q.left), top: Math.max(rr.top, q.top), right: Math.min(rr.right, q.right), bottom: Math.min(rr.bottom, q.bottom) };
      }
      return rr.right - rr.left > 0.5 && rr.bottom - rr.top > 0.5 ? rr : null;
    };
    const nome = e => e.dataset.jogador ? `carta ${e.dataset.jogador}` : e.dataset.ed ?? e.dataset.aba ?? e.dataset.formacao ?? (e.dataset.tatica ? `${e.dataset.tatica}${e.dataset.passo}` : null) ?? e.dataset.previa ?? e.className.split(' ')[0];
    const botoes = [...raiz.querySelectorAll('button')].filter(vis);
    const textos = [...raiz.querySelectorAll('.ed-titulo, .ed-nota, .ed-info-linha, .ed-rotulo, .campinho-rotulo, .ed-passo-nome, .ed-passo-nivel, .ed-passo-desc, .ed-grupo')].filter(vis);
    const caixas = [];
    for (const b of botoes) {
      const r = b.getBoundingClientRect();
      if (r.width < 47.5 || r.height < 47.5) problemas.push(`${nome(b)} com ${r.width.toFixed(0)}×${r.height.toFixed(0)} px (< 48)`);
      const c = recorte(b);
      if (c) caixas.push({ n: nome(b), c, el: b });
    }
    for (const t of textos) { const c = recorte(t); if (c) caixas.push({ n: nome(t), c, el: t }); }
    for (let i = 0; i < caixas.length; i++) {
      const a = caixas[i].c;
      if (a.left < sa.l - 0.5 || a.top < sa.t - 0.5 || a.right > W - sa.r + 0.5 || a.bottom > H - sa.b + 0.5) problemas.push(`${caixas[i].n} fora da área segura`);
      for (let k = i + 1; k < caixas.length; k++) {
        const b = caixas[k].c;
        if (caixas[i].el.contains(caixas[k].el) || caixas[k].el.contains(caixas[i].el)) continue;
        if (a.left < b.right + 4 && b.left < a.right + 4 && a.top < b.bottom + 4 && b.top < a.bottom + 4) problemas.push(`${caixas[i].n} encosta em ${caixas[k].n}`);
      }
    }
    // nomes e rótulos inteiros
    for (const e of raiz.querySelectorAll('.c-nome, .c-pos, .ed-aba, .ed-btn, .ed-forma-nome, .ed-passo-nivel, .ed-seg, .ed-titulo')) {
      if (!vis(e)) continue;
      if (e.scrollWidth > e.clientWidth + 0.5) problemas.push(`texto cortado: "${e.textContent.trim()}" (${e.scrollWidth} > ${e.clientWidth})`);
    }
    if (document.documentElement.scrollWidth > innerWidth) problemas.push(`página rola na horizontal (${document.documentElement.scrollWidth} > ${innerWidth})`);
    // toda lista que rola alcança o último item
    for (const p of roladores) {
      const ant = p.scrollTop;
      p.scrollTop = p.scrollHeight;
      // o último na TELA (em pé a prévia vem antes dos seletores, fora da ordem do DOM)
      const itens = [...p.querySelectorAll('button, .ed-passo')].filter(vis);
      const ult = itens.reduce((a, e) => (!a || e.getBoundingClientRect().bottom > a.getBoundingClientRect().bottom ? e : a), null);
      if (ult) {
        const q = p.getBoundingClientRect(), u = ult.getBoundingClientRect();
        if (u.bottom > q.bottom + 0.5 || u.top < q.top - 0.5) problemas.push(`a lista ${p.className.split(' ')[0]} não alcança o último item`);
      }
      p.scrollTop = ant;
    }
    const camp = raiz.querySelector('.campinho');
    const cr = camp && vis(camp) ? camp.getBoundingClientRect() : null;
    const carta = raiz.querySelector('.carta.no-campo');
    const kr = carta && vis(carta) ? carta.getBoundingClientRect() : null;
    return {
      problemas,
      resumo: `${botoes.length} botões, ${textos.length} textos${cr ? `, campinho ${cr.width.toFixed(0)}×${cr.height.toFixed(0)}` : ''}${kr ? `, carta ${kr.width.toFixed(0)}×${kr.height.toFixed(0)}` : ''}, ${roladores.length} rola`,
    };
  });
}

// ====================================================================== PC 1280×720 (itens 1–4, 7–9)
{
  const PC = { largura: 1280, altura: 720 };
  const { navegador, pagina: pg, erros } = await abrirPagina(PC);
  try {
    const existe = await temEditor(pg);
    meta('0  A página tem o botão Editar time e window.__golaco.editor', String(existe), existe);
    if (!existe) throw new Error('sem Editar time na página (antes da Parte 5)');
    await novaPartida(pg);
    await pg.mouse.click(640, 400);

    // ---- 1) mouse
    await pg.keyboard.press('Escape');
    const botaoVis = await pg.evaluate(() => { const b = document.querySelector('[data-cmd="editar-time"]'); return !!b && !b.hidden && b.offsetParent !== null; });
    await clicar(pg, '[data-cmd="editar-time"]');
    const aberto = await editorAberto(pg), pausaSumiu = !(await menuAberto(pg));
    const tA = (await quadros(pg, 1)).tick;
    const tB = (await quadros(pg, 60)).tick;
    await clicar(pg, '#editar-time [data-jogador="7"]');
    const p7 = await pressionado(pg);
    await clicar(pg, '#editar-time [data-jogador="11"]');
    const naPD = await jogadorNaVaga(pg, 'PD');
    await clicar(pg, '#editar-time [data-ed="pronto"]');
    const pausaVoltou = await menuAberto(pg), fechou = !(await editorAberto(pg));
    await clicar(pg, '#menu [data-cmd="continuar"]');
    const e1 = await quadros(pg, 1);
    const v11 = await pg.evaluate(() => window.__golaco.mundo.jogadores.find(j => j.id === 11)?.vagaId ?? null);
    meta('1  PC mouse: Esc → Editar time abre, a pausa some e o tick para por 60 quadros',
      `botão ${botaoVis}, editor ${aberto}, pausa escondida ${pausaSumiu}, tick ${tA} → ${tB}`, botaoVis && aberto && pausaSumiu && tA === tB);
    meta('1  PC mouse: 7 escolhido (aria-pressed), depois 11 → a vaga PD tem o 11; PRONTO volta à pausa',
      `escolhidos [${p7}], PD = ${naPD}, pausa ${pausaVoltou}, editor fechado ${fechou}`, p7.length === 1 && p7[0] === 7 && naPD === 11 && pausaVoltou && fechou);
    meta('1  PC mouse: Continuar → 1 quadro → mundo com PD = 11 e o 11 na vaga PD',
      `times[0].vagas.PD = ${e1.times?.[0]?.vagas?.PD}, jogador 11 vagaId ${v11}`, e1.times?.[0]?.vagas?.PD === 11 && v11 === 'PD');

    // ---- 2) hash Node = Chromium com uma edição no passo 300
    const P = await imp('partida.js'), SIM = await imp('sim.js'), ESC = await imp('escalacao.js');
    const base = ESC.estadoInicialTime('golaco');
    const vagas = { ...base.vagas, PD: base.vagas.PE, PE: base.vagas.PD, ATA: 22 };
    const ed = { tipo: 'editarTime', time: 0, base: 0, formacao: base.formacao, vagas, substituicoes: [{ sai: base.vagas.ATA, entra: 22 }], tatica: { mentalidade: 1, pressao: 2, largura: 1, linha: 2 } };
    const rot = [];
    for (let i = 0; i < 600; i++) {
      const a = 0.6 * Math.sin(i / 50);
      const e = { x: Math.cos(a) * (i < 120 ? 0.5 : 0.9), z: Math.sin(a) * 0.9, botoes: (i >= 200 && i < 260 ? BIT.CORRER : 0) | (i >= 420 && i < 445 ? BIT.CHUTE : 0) };
      if (i === 300) e.acoes = [ed];
      rot.push(e);
    }
    const entradaDoTime = e => { const t = { 0: { x: e.x, z: e.z, botoes: e.botoes } }; Object.defineProperties(t, { x: { value: e.x }, z: { value: e.z }, botoes: { value: e.botoes } }); return t; };
    const m = P.criarPartida({ semente: 11 });
    const hsNode = [SIM.hashMundo(m)];
    for (let i = 0; i < rot.length; i++) { P.passoPartida(m, entradaDoTime(rot[i]), rot[i].acoes ?? null); if ((i + 1) % 100 === 0) hsNode.push(SIM.hashMundo(m)); }
    const nav = await pg.evaluate(rot => {
      const g = window.__golaco;
      const hs = [g.reiniciar({ modo: 'partida', semente: 11 })];
      for (let k = 0; k < rot.length; k += 100) hs.push(g.rodarPassos(100, rot.slice(k, k + 100)));
      return { hs, versao: g.mundo.times[0].versao, pend: !!g.mundo.times[0].pendente, linha: g.mundo.times[0].tatica.linha };
    }, rot);
    let difere = -1;
    for (let i = 0; i < hsNode.length; i++) if (hsNode[i] !== nav.hs[i]) { difere = i * 100; break; }
    const hx = h => (h >>> 0).toString(16).padStart(8, '0');
    meta('2  Hash Node = Chromium com a edição no passo 300 (troca, tática, substituição)',
      `Node ${hx(hsNode.at(-1))} · Chromium ${hx(nav.hs.at(-1))}${difere >= 0 ? ` (diverge até o passo ${difere})` : ''}; edição aplicada: versão ${nav.versao}, linha ${nav.linha}, pendente ${nav.pend}`,
      difere < 0 && nav.versao >= 1 && nav.linha === 2);

    // ---- 3) só teclado
    await novaPartida(pg);
    await pg.keyboard.press('Escape');
    let foco = '';
    for (let k = 0; k < 8 && foco !== 'editar-time'; k++) {
      await pg.keyboard.press('Tab');
      foco = await pg.evaluate(() => document.activeElement?.dataset?.cmd ?? '');
    }
    await pg.keyboard.press('Enter');
    await pg.waitForTimeout(30);
    const focoAba = await pg.evaluate(() => document.activeElement?.getAttribute('role') === 'tab' && document.activeElement.getAttribute('aria-selected') === 'true');
    await pg.keyboard.press('Tab');
    /** Leva o foco do campinho até a carta do jogador `id` só com as setas (até 12 toques). */
    async function irAte(id) {
      for (let k = 0; k < 12; k++) {
        const s = await pg.evaluate(id => {
          const a = document.activeElement, b = document.querySelector(`#editar-time .no-campo[data-jogador="${id}"]`);
          if (!a || !b || !a.classList.contains('no-campo')) return null;
          if (a === b) return 'ok';
          const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
          const dx = rb.left - ra.left, dy = rb.top - ra.top;
          return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : (dy > 0 ? 'ArrowDown' : 'ArrowUp');
        }, id);
        if (s === 'ok') return true;
        if (!s) return false;
        await pg.keyboard.press(s);
      }
      return false;
    }
    const chegou7 = await irAte(7);
    await pg.keyboard.press('Enter');
    const chegou11 = await irAte(11);
    await pg.keyboard.press('Enter');
    const naPDt = await jogadorNaVaga(pg, 'PD');
    await pg.keyboard.press('Escape');
    const pausaT = await menuAberto(pg), fechouT = !(await editorAberto(pg));
    const focoVolta = await pg.evaluate(() => document.activeElement?.dataset?.cmd ?? '');
    await pg.keyboard.press('Escape');
    const menuFechou = !(await menuAberto(pg));
    const e3 = await quadros(pg, 1);
    meta('3  PC teclado: Tab até Editar time, Enter → foco na aba; setas + Enter trocam 7 e 11',
      `foco ${foco}, aba focada ${focoAba}, chegou ao 7 ${chegou7}, ao 11 ${chegou11}, PD = ${naPDt}`, foco === 'editar-time' && focoAba && chegou7 && chegou11 && naPDt === 11);
    meta('3  PC teclado: Esc = PRONTO (volta à pausa, foco no Editar time), Esc fecha a pausa, PD = 11 no mundo',
      `pausa ${pausaT}, editor fechado ${fechouT}, foco ${focoVolta}, pausa fechou ${menuFechou}, PD ${e3.times?.[0]?.vagas?.PD}`, pausaT && fechouT && focoVolta === 'editar-time' && menuFechou && e3.times?.[0]?.vagas?.PD === 11);

    // ---- 4) nada vaza
    async function rodada(comTeclas) {
      await novaPartida(pg, 9);
      const cam0 = await pg.evaluate(() => window.__golaco.camera);
      await pg.evaluate(() => { const g = window.__golaco; g.abrirMenu(); });
      await clicar(pg, '[data-cmd="editar-time"]');
      if (comTeclas) for (const t of ['KeyJ', 'KeyK', 'KeyR', 'KeyM', 'KeyH', 'KeyC']) await pg.keyboard.press(t);
      await clicar(pg, '#editar-time [data-ed="pronto"]');
      await clicar(pg, '#menu [data-cmd="continuar"]');
      return pg.evaluate(cam0 => {
        const g = window.__golaco;
        const ajuda = !document.getElementById('ajuda').hidden;
        const aviso = document.getElementById('aviso').textContent;
        const h = g.rodarPassos(60, { x: 0.3, z: -0.4, botoes: 0 });
        return { cam: g.camera, cam0, ajuda, aviso, h, fila: g.edicaoNaFila };
      }, cam0);
    }
    const sem = await rodada(false), com = await rodada(true);
    meta('4  PC: J K R M H C com o editor aberto não vazam (câmera, ajuda, recomeço, hash de 60 passos)',
      `câmera ${com.cam0} → ${com.cam}, ajuda ${com.ajuda}, aviso "${com.aviso}", hash ${com.h === sem.h ? 'igual' : 'diferente'}`,
      com.cam === com.cam0 && !com.ajuda && !/recome|Bola no pé|treinos/i.test(com.aviso) && com.h === sem.h);

    // ---- 7) formação
    await novaPartida(pg);
    await pg.evaluate(() => window.__golaco.abrirMenu());
    await clicar(pg, '[data-cmd="editar-time"]');
    await clicar(pg, '#editar-time [data-aba="formacao"]');
    await clicar(pg, '#editar-time [data-formacao="4-2-3-1"]');
    const f1 = await pg.evaluate(() => ({ vagas: [...document.querySelectorAll('#editar-time .no-campo')].map(b => b.dataset.vaga).sort().join(','), fora: document.querySelectorAll('#editar-time .no-campo .c-fora').length }));
    await clicar(pg, '#editar-time [data-formacao="3-5-2"]');
    const f2 = await pg.evaluate(() => document.querySelectorAll('#editar-time .no-campo .c-fora').length);
    await clicar(pg, '#editar-time [data-formacao="4-2-3-1"]');
    await clicar(pg, '#editar-time [data-ed="pronto"]');
    await clicar(pg, '#menu [data-cmd="continuar"]');
    const e7 = await quadros(pg, 1);
    const esperadas = 'ATA,GOL,LD,LE,MD,ME,MEI,VOLD,VOLE,ZD,ZE';
    meta('7  Formação: 4-2-3-1 → 11 cartas nas vagas novas, 0 fora; 3-5-2 → 2 com "!"; vale no mundo',
      `vagas ${f1.vagas === esperadas ? 'certas' : f1.vagas}, fora ${f1.fora}; 3-5-2: ${f2} fora; mundo ${e7.times?.[0]?.formacao}`, f1.vagas === esperadas && f1.fora === 0 && f2 === 2 && e7.times?.[0]?.formacao === '4-2-3-1');

    // ---- 8) táticas
    await novaPartida(pg);
    await pg.evaluate(() => window.__golaco.abrirMenu());
    await clicar(pg, '[data-cmd="editar-time"]');
    await clicar(pg, '#editar-time [data-aba="taticas"]');
    await clicar(pg, '#editar-time [data-tatica="linha"][data-passo="-1"]');
    const somaCanvas = () => pg.evaluate(() => {
      const c = document.querySelector('#editar-time .ed-canvas');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let s = 0, sx = 0;
      for (let i = 0; i < d.length; i += 4) { s += d[i] + d[i + 1] + d[i + 2]; sx += (i / 4 % c.width) * d[i + 1]; }
      return { s, sx, nivel: document.querySelector('[data-nivel="linha"]').textContent };
    });
    const c0 = await somaCanvas();
    await clicar(pg, '#editar-time [data-tatica="linha"][data-passo="+1"]');
    await clicar(pg, '#editar-time [data-tatica="linha"][data-passo="+1"]');
    const c1 = await somaCanvas();
    await clicar(pg, '#editar-time [data-ed="pronto"]');
    await clicar(pg, '#menu [data-cmd="continuar"]');
    const e8 = await quadros(pg, 1);
    meta('8  Táticas: Baixa → 2 × "›" = Alta, a prévia muda e a linha 2 vale no mundo',
      `${c0.nivel} → ${c1.nivel}, prévia ${c0.s === c1.s && c0.sx === c1.sx ? 'igual' : 'mudou'}, mundo linha ${e8.times?.[0]?.tatica?.linha}`, c0.nivel === 'Baixa' && c1.nivel === 'Alta' && (c0.s !== c1.s || c0.sx !== c1.sx) && e8.times?.[0]?.tatica?.linha === 2);

    // ---- 9) desfazer tudo
    const h9a = (await novaPartida(pg, 13)).h;
    await pg.evaluate(() => window.__golaco.abrirMenu());
    await clicar(pg, '[data-cmd="editar-time"]');
    await clicar(pg, '#editar-time [data-jogador="7"]');
    await clicar(pg, '#editar-time [data-jogador="11"]');
    const trocou = (await jogadorNaVaga(pg, 'PD')) === 11;
    await clicar(pg, '#editar-time [data-ed="desfazer-tudo"]');
    const volta = await pg.evaluate(() => { const r = window.__golaco.editor.rascunho; const t = window.__golaco.estadoTime(0); return { igual: JSON.stringify(r.vagas) === JSON.stringify(t.vagas) && r.formacao === t.formacao && JSON.stringify(r.tatica) === JSON.stringify(t.tatica) && r.substituicoes.length === 0, esc: r.escolhido }; });
    await clicar(pg, '#editar-time [data-ed="pronto"]');
    const fila9 = await pg.evaluate(() => window.__golaco.edicaoNaFila);
    await clicar(pg, '#menu [data-cmd="continuar"]');
    const h9 = await pg.evaluate(() => { const g = window.__golaco; return { antes: g.hash(), depois: g.rodarPassos(120, 'demo') }; });
    const h9b = await novaPartida(pg, 13).then(() => pg.evaluate(() => { const g = window.__golaco; return { antes: g.hash(), depois: g.rodarPassos(120, 'demo') }; }));
    meta('9  Desfazer tudo: rascunho = mundo; PRONTO sem diferença não põe nada na fila (hash igual)',
      `trocou ${trocou}, voltou ${volta.igual}, fila ${fila9 ? 'com edição' : 'vazia'}, hash ${h9.antes === h9a && h9.depois === h9b.depois ? 'igual' : 'diferente'}`, trocou && volta.igual && fila9 === null && h9.antes === h9a && h9.depois === h9b.depois);
    meta('13 PC sem erro no console', erros.length ? erros.slice(0, 3).join(' | ') : '0', erros.length === 0);
  } catch (e) {
    meta('PC: execução', e.message, false);
  } finally { await navegador.close(); }
}

// ====================================================================== celular deitado (5, 6, 11)
{
  const CEL = { largura: 844, altura: 390, dpr: 2, toque: true, entalhe: true };
  const { navegador, pagina: pg, erros } = await abrirPagina(CEL);
  try {
    if (!(await temEditor(pg))) throw new Error('sem Editar time na página');
    // ---- 5) substituição pelo toque (tempo de 18 s: a próxima parada vem no máximo no intervalo)
    await novaPartida(pg, 3, 0.3);
    await tocar(pg, '#btn-menu');
    await tocar(pg, '[data-cmd="editar-time"]');
    await tocar(pg, '#editar-time [data-jogador="9"]');
    await tocar(pg, '#editar-time [data-jogador="22"]');
    const selos = await pg.evaluate(() => ({
      entra: !!document.querySelector('#editar-time .no-campo.entra[data-jogador="22"] .c-entra'),
      sai: !!document.querySelector('#editar-time .na-lista.sai[data-jogador="9"] .c-sai'),
      cont: document.querySelector('#editar-time .ed-contagem')?.textContent ?? '',
    }));
    await tocar(pg, '#editar-time [data-ed="pronto"]');
    await tocar(pg, '#menu [data-cmd="continuar"]');
    const e5 = await quadros(pg, 1);
    const pend = e5.times?.[0]?.pendente?.substituicoes ?? [];
    // a bola tem de parar (fora, gol ou intervalo): o controlado chuta sempre que pode (até 20 s)
    const sub = await pg.evaluate(BIT => {
      const g = window.__golaco;
      let carga = 0, aviso = '', ev = null;
      for (let i = 0; i < 1200; i++) {
        const e = g.estado();
        if (e.times[0].saiu.includes(9)) { ev = i; break; }
        const j = e.jogador;
        const comBola = e.posse != null && e.posse === e.controlado;
        let x = 0, z = 1, b = 0;
        if (comBola || carga > 0) { b = carga < 22 ? BIT.CHUTE : 0; carga = carga < 22 ? carga + 1 : 0; } else if (j) {
          const dx = e.bola.x - j.x, dz = e.bola.z - j.z, d = Math.hypot(dx, dz) || 1;
          x = dx / d; z = dz / d; b = BIT.CORRER;
        }
        g.forcarEntrada({ x, z, botoes: b });
        g.relogio.avancar(1000 / 60, { desenhar: false });
        const a = document.getElementById('aviso').textContent;
        if (/Substitui/.test(a)) aviso = a;
      }
      g.forcarEntrada(null);
      for (let i = 0; i < 3; i++) { g.relogio.avancar(1000 / 60, { desenhar: false }); const a = document.getElementById('aviso').textContent; if (/Substitui/.test(a)) aviso = a; }
      const m = g.mundo;
      return { quadro: ev, aviso, em22: m.jogadores.some(j => j.id === 22), em9: m.jogadores.some(j => j.id === 9), saiu: [...m.times[0].saiu], subs: { ...m.times[0].subs } };
    }, BIT);
    meta('5  Celular, toque: 9 depois 22 → selos ↑ (22 no campo) e ↓ (9 nas reservas), contagem 1/5',
      `entra ${selos.entra}, sai ${selos.sai}, "${selos.cont}"`, selos.entra && selos.sai && /1\/5/.test(selos.cont));
    meta('5  Celular: PRONTO → Continuar → pendente {sai 9, entra 22} no mundo',
      JSON.stringify(pend), pend.length === 1 && pend[0].sai === 9 && pend[0].entra === 22);
    meta('5  Celular: na parada → substituição feita: 22 em campo, 9 fora, aviso no HUD',
      `em ${sub.quadro ?? '-'} quadros; 22 em campo ${sub.em22}, 9 em campo ${sub.em9}, saiu [${sub.saiu}], subs ${JSON.stringify(sub.subs)}, aviso "${sub.aviso}"`,
      sub.quadro != null && sub.em22 && !sub.em9 && sub.saiu.includes(9) && /sai Diego, entra Wallace/.test(sub.aviso));

    // ---- 6) rolar a lista não escolhe
    await novaPartida(pg, 3);
    await tocar(pg, '#btn-menu');
    await tocar(pg, '[data-cmd="editar-time"]');
    const cdp = await pg.context().newCDPSession(pg);
    const r6 = await pg.evaluate(() => { const l = document.querySelector('#editar-time .ed-lista'); const c = document.querySelector('#editar-time .na-lista').getBoundingClientRect(); return { x: c.left + c.width / 2, y: c.top + c.height / 2, topo: l.scrollTop }; });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r6.x, y: r6.y, id: 1 }] });
    for (let k = 1; k <= 6; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: r6.x, y: r6.y - k * 10, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await pg.waitForTimeout(300);
    const p6 = await pressionado(pg);
    const rolou = await pg.evaluate(() => document.querySelector('#editar-time .ed-lista').scrollTop);
    meta('6  Celular: arrastar 60 px na lista de reservas não escolhe ninguém (a lista rola)',
      `escolhidos [${p6}], rolou ${rolou - r6.topo} px`, p6.length === 0);

    // ---- 11) girar com uma carta escolhida
    await tocar(pg, '#editar-time [data-jogador="10"]');
    const antes11 = await pg.evaluate(() => ({ esc: window.__golaco.editor.rascunho.escolhido, vagas: JSON.stringify(window.__golaco.editor.rascunho.vagas) }));
    await pg.setViewportSize({ width: 390, height: 844 });
    await pg.waitForTimeout(300);
    const depois11 = await pg.evaluate(() => ({ esc: window.__golaco.editor.rascunho.escolhido, vagas: JSON.stringify(window.__golaco.editor.rascunho.vagas), modo: window.__golaco.editor.modo, pres: [...document.querySelectorAll('#editar-time .carta[aria-pressed="true"]')].map(b => +b.dataset.jogador) }));
    const lay11 = await conferirEditor(pg);
    meta('11 Girar o celular (844×390 → 390×844) com a carta 10 escolhida: rascunho e escolha continuam',
      `escolhido ${antes11.esc} → ${depois11.esc}, marcadas [${depois11.pres}], modo ${depois11.modo}, rascunho ${antes11.vagas === depois11.vagas ? 'igual' : 'mudou'}`,
      antes11.esc === 10 && depois11.esc === 10 && depois11.pres.length === 1 && depois11.pres[0] === 10 && antes11.vagas === depois11.vagas && depois11.modo === 'empe');
    meta('11 Girado: nada encosta', `${lay11.resumo}${lay11.problemas.length ? ' — ' + lay11.problemas.slice(0, 6).join('; ') : ''}`, lay11.problemas.length === 0);
    meta('13 Celular sem erro no console', erros.length ? erros.slice(0, 3).join(' | ') : '0', erros.length === 0);
  } catch (e) {
    meta('Celular: execução', e.message, false);
  } finally { await navegador.close(); }
}

// ====================================================================== 10) nada encosta (6 telas)
const TELAS = [
  { nome: '1280×720', largura: 1280, altura: 720 },
  { nome: '844×390 entalhe', largura: 844, altura: 390, dpr: 2, toque: true, entalhe: true },
  { nome: '812×375 entalhe', largura: 812, altura: 375, dpr: 2, toque: true, entalhe: true },
  { nome: '667×375', largura: 667, altura: 375, dpr: 2, toque: true },
  { nome: '390×844 entalhe', largura: 390, altura: 844, dpr: 2, toque: true, entalhe: true },
  { nome: '375×667', largura: 375, altura: 667, dpr: 2, toque: true },
];
for (const t of TELAS) {
  const { navegador, pagina: pg, erros } = await abrirPagina(t);
  try {
    if (!(await temEditor(pg))) throw new Error('sem Editar time na página');
    await novaPartida(pg, 2);
    await pg.evaluate(() => window.__golaco.editor.abrir());
    const toque = t.toque ? tocar : clicar;
    const textos = [];
    let ok = true;
    const conferir = async rot => {
      const l = await conferirEditor(pg);
      if (l.problemas.length) ok = false;
      textos.push(`${rot}: ${l.resumo}${l.problemas.length ? ' — ' + l.problemas.slice(0, 4).join('; ') : ''}`);
    };
    await conferir('escalação');
    await toque(pg, '#editar-time [data-jogador="10"]');
    await conferir('escolhida');
    await toque(pg, '#editar-time [data-jogador="10"]');
    await toque(pg, '#editar-time [data-jogador="9"]');
    await toque(pg, '#editar-time [data-jogador="22"]');
    const pendente = await pg.evaluate(() => window.__golaco.editor.rascunho.substituicoes.length);
    await conferir(`substituição (${pendente})`);
    await toque(pg, '#editar-time [data-aba="formacao"]');
    await conferir('formação');
    await toque(pg, '#editar-time [data-formacao="3-5-2"]');
    await conferir('3-5-2');
    await toque(pg, '#editar-time [data-aba="taticas"]');
    await conferir('táticas');
    await toque(pg, '#editar-time [data-previa="com"]');
    await conferir('com a bola');
    meta(`10 ${t.nome}: nada encosta (≥ 48 px, folga ≥ 4, área segura, nomes inteiros, listas)`, textos.join(' | '), ok && pendente === 1);
    meta(`13 ${t.nome}: sem erro no console`, erros.length ? erros.slice(0, 3).join(' | ') : '0', erros.length === 0);
  } catch (e) {
    meta(`10 ${t.nome}: execução`, e.message, false);
  } finally { await navegador.close(); }
}

// ====================================================================== 12) treino sem Editar time
{
  const { navegador, pagina: pg, erros } = await abrirPagina({ largura: 1280, altura: 720 }, '&modo=ataque');
  try {
    const r = await pg.evaluate(() => {
      const g = window.__golaco;
      g.abrirMenu();
      const vis = s => { const b = document.querySelector(s); return !!b && !b.hidden && b.offsetParent !== null; };
      return { modo: g.estado().modoTreino, editar: vis('[data-cmd="editar-time"]'), reiniciar: vis('#menu [data-cmd="reiniciar-partida"]'), recomecar: vis('[data-cmd="recomecar"]'), maquina: vis('[data-cmd="maquina"]'), abriu: g.editor?.abrir?.() ?? null };
    });
    meta('12 Treino (?modo=ataque): sem Editar time e sem Reiniciar partida; Recomeçar e Máquina aparecem',
      `modo ${r.modo}, Editar time ${r.editar}, Reiniciar ${r.reiniciar}, Recomeçar ${r.recomecar}, Máquina ${r.maquina}, editor pela API ${r.abriu}`,
      r.modo === 'ataque' && !r.editar && !r.reiniciar && r.recomecar && r.maquina && r.abriu === false);
    meta('13 Treino sem erro no console', erros.length ? erros.slice(0, 3).join(' | ') : '0', erros.length === 0);
  } catch (e) {
    meta('12 Treino: execução', e.message, false);
  } finally { await navegador.close(); }
}

await srv.fechar();
const larg = Math.max(...res.map(r => r.nome.length));
for (const r of res) console.log(`${r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.nome.padEnd(larg)}  ${r.medido}`);
const reprovou = res.filter(r => !r.ok);
console.log(reprovou.length ? `\nteste-editor-tela: REPROVOU (${reprovou.length} de ${res.length})` : `\nteste-editor-tela: PASSOU (${res.length} itens)`);
process.exit(reprovou.length ? 1 : 0);
