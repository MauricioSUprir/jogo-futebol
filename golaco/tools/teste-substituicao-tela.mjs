// Cena de substituição no navegador (Chromium; pedido do dono de 12/10: "quando tiver substituição, quero que tenha a
// cena de substituição, só jogador saindo e entrando, e embaixo, no modelo, a informação de quem entra e quem sai"). Na
// página de verdade (main.js + js/substituicao.js + render/placa-subst.js + hud.js), relógio manual a 60 qps, com
// ?substituicao=1 (nos testes automatizados ela abre desligada, como o pré-jogo):
//   T1 hash no tick T + 700 igual com a cena ligada, desligada e em Node (a mesma troca, a mesma parada);
//   T2 mundo.tick parado do começo ao fim da cena e andando no 1º quadro depois; o tempo da parada não anda;
//   T3 a faixa com o texto exato (ENTRA 22 Wallace Pimenta, SAI 9 Diego Albuquerque, GLÇ) em ≤ 3 quadros do começo da
//      cena; ≥ 4,0 s na tela também com a cena pulada aos 0,6 s e com "só a faixa";
//   T4 pular: antes de 0,5 s nada pula; o botão segurado desde antes não pula; um aperto NOVO depois de 0,5 s acaba a
//      cena em ≤ 2 quadros; com o K (chute) segurado, 0 passe/chute/lançamento/enfiada do humano nos 60 ticks seguintes;
//   T5 gol + troca na mesma parada (gol roteirizado): em-comemoracao → em-replay (inteiro) → em-substituicao → jogo; a
//      faixa só depois do replay; o apito da saída é pedido depois do fim da cena;
//   T6 troca no intervalo: sem cena; a faixa ≥ 4 s na saída do 2º tempo;
//   T7 pausa, aba escondida e celular em pé: o tempo da cena não anda na interrupção e volta em ≤ 1 quadro; trocarMundo
//      cancela a cena e esvazia a fila;
//   T8 nada sobre nada: folga ≥ 4 px entre a faixa (na cena e no jogo) e o placar, o menu, o minimapa (ligado e
//      desligado), o aviso, o "Pular" e os botões de toque, em 1280×720, 844×390 com entalhe, 667×375 e 568×320; o número
//      e a palavra nunca cortados; a faixa cobre ≤ 10% da caixa do ator principal; a opção salva vale depois de recarregar;
//   T9 celular 844×390 Média: p95 da CPU do quadro na cena ≤ p95 do jogo + 1 ms; chamadas de desenho ≤ jogo + 3; os
//      programas de shader não aumentam na cena (pré-carga); 0 geometria e 0 textura a mais depois de 10 trocas;
//   T10 a placa com ≥ 40 px de largura no celular no plano ENTRA, com os números certos;
//   console sem erros.
// Na versão sem a cena (--raiz <cópia da base>) reprova (não há cena, a faixa nem a placa). Medida de TEMPO que reprovar
// repete sozinha (até 3 vezes; a máquina é dividida).
//   node tools/teste-substituicao-tela.mjs [--raiz <pasta do jogo>] [--so A,B,C,L] [--telas 1280,844,667,568]
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';
import { golRoteirizado } from './lib/gol-roteirizado.mjs';

const args = process.argv.slice(2);
const raiz = path.resolve(args.includes('--raiz') ? args[args.indexOf('--raiz') + 1] : RAIZ);
// --so A,B,C,L: só algumas partes (A = PC ligada, B = só a faixa, C = gol e intervalo, L = as 4 telas e o celular)
const so = args.includes('--so') ? new Set(args[args.indexOf('--so') + 1].split(',')) : null;
const roda = s => !so || so.has(s);
const res = [];
const meta = (nome, medido, alvo, ok, info = false) => { res.push({ nome, medido, alvo, ok: !!ok, info }); };
const f2 = v => (Number.isFinite(v) ? v.toFixed(2) : String(v));
const errosTodos = [];
const srv = await servidor(0, raiz);
const TEXTO = 'Golaço FC: entra 22 Wallace Pimenta, sai 9 Diego Albuquerque';

async function pagina(url, opc = {}) {
  const nav = await abrir({ largura: opc.largura ?? 1280, altura: opc.altura ?? 720, dpr: opc.dpr ?? 1, toque: opc.toque });
  await nav.pagina.goto(srv.url + url, { waitUntil: 'load', timeout: 600000 });
  await nav.pagina.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 600000 });
  await nav.pagina.evaluate(() => window.__golaco.relogio.usarManual(true));
  return { ...nav, fechar: async () => { errosTodos.push(...nav.erros); await nav.navegador.close(); } };
}
const temCena = pg => pg.evaluate(() => !!window.__golaco.cenaSubst && !!window.__golaco.substituicaoDeTeste);

/** Reinicia a partida, anda `antes` quadros e pede a troca (substituicaoDeTeste) com a parada; devolve o tick dela. */
async function trocar(pg, opc = {}) {
  return pg.evaluate(o => {
    const g = window.__golaco;
    if (o.reiniciar !== false) g.reiniciar({ modo: 'partida', semente: o.semente ?? 7 });
    for (let i = 0; i < (o.antes ?? 240); i++) g.relogio.avancar(1000 / 60, { desenhar: false });
    const tick0 = g.mundo.tick;
    const r = g.substituicaoDeTeste({ pares: o.pares, parada: o.parada === undefined ? 'lateral' : o.parada });
    return { tick0, r };
  }, opc);
}
/** Anda até a cena começar (ou a troca acontecer sem cena); devolve {q, tick, ativo}. */
async function ateCena(pg, max = 400) {
  return pg.evaluate(max => {
    const g = window.__golaco, m = g.mundo;
    const feitas0 = g.estadoTime(0).subs.feitas + g.estadoTime(1).subs.feitas;
    let q = 0;
    while (q < max && !g.cenaSubst.ativo && g.estadoTime(0).subs.feitas + g.estadoTime(1).subs.feitas === feitas0) { g.relogio.avancar(1000 / 60, { desenhar: false }); q++; }
    return { q, tick: m.tick, ativo: g.cenaSubst.ativo };
  }, max);
}

// ------------------------------------------------------------------------------------------------ Node (T1)
let hashNode = null;
try {
  const imp = f => import(pathToFileURL(path.join(raiz, 'js', f)).href);
  const P = await imp('partida.js'), S = await imp('sim.js'), C = await imp('config.js');
  hashNode = async (tick0, alvo) => {
    const m = P.criarPartida({ semente: 7 });
    const ent = { 0: { x: 0, z: 0, botoes: 0 } };
    Object.defineProperties(ent, { x: { value: 0 }, z: { value: 0 }, botoes: { value: 0 } });
    while (m.tick < tick0) P.passoPartida(m, ent, null);
    // a mesma troca e a mesma parada da página (main.js substituicaoDeTeste / bolaParadaDeTeste)
    const s = m.times[0], vagas = { ...s.vagas };
    const v = Object.keys(vagas).find(k => vagas[k] === 9); vagas[v] = 22;
    const ed = { tipo: 'editarTime', time: 0, base: s.versao, formacao: s.formacao, vagas, substituicoes: [{ sai: 9, entra: 22 }], tatica: { ...s.tatica } };
    const lado = m.ataca[0], j = m.jogadores.find(o => o.time === 1 && o.posicao !== 'GOL');
    m.posse = null; m.naMao = null; m.voo = null; m.parada = null; m.partida.estado = 'jogo'; m.golTick = null; m.foraDesde = null;
    Object.assign(m.bola.p, { x: lado * 14, y: C.BOLA.raio, z: C.CAMPO.meioZ + 0.5 }); Object.assign(m.bola.v, { x: 0, y: 0, z: 0 });
    m.partida.ultimoTime = 1; m.partida.ultimoId = j.id; m.partida.ultimoTick = m.tick;
    m.ultimoToque = { id: j.id, time: 1, tick: m.tick };
    P.passoPartida(m, ent, [ed]);
    while (m.tick < alvo) P.passoPartida(m, ent, null);
    return S.hashMundo(m);
  };
} catch (e) { hashNode = null; }

/** T1/T2/T3 numa página: a troca 9 → 22 num lateral; acompanha a cena; o hash no tick T + 700. */
async function rodadaHash(pg) {
  const { tick0 } = await trocar(pg, {});
  const ini = await ateCena(pg);
  const r = await pg.evaluate(() => {
    const g = window.__golaco, m = g.mundo;
    const out = { q: [], faixa: null, faixaQ: null };
    // a faixa em ≤ 3 quadros (a cena começa no quadro em que a troca acontece)
    for (let k = 0; k <= 3; k++) {
      const f = g.cenaSubst.faixa(), el = document.getElementById('faixa-subst');
      const vis = !!el && !el.hidden && getComputedStyle(el).display !== 'none';
      // o texto que se VÊ (sem a frase do leitor de tela, que fica fora da tela)
      const visto = el ? [...el.querySelectorAll('.fs-sigla, .fs-linha')].map(e => e.innerText).join(' ').replace(/\s+/g, ' ').trim() : '';
      if (vis && f.texto) { out.faixa = { texto: f.texto, visivel: visto, modo: f.modo }; out.faixaQ = k; break; }
      g.relogio.avancar(1000 / 60, { desenhar: false });
    }
    let n = 0;
    while (g.cenaSubst.ativo && n < 900) {
      const pr = m.parada;
      out.q.push({ tick: m.tick, parada: pr ? m.tick - pr.inicio : null, t: g.cenaSubst.estado.tempo });
      g.relogio.avancar(1000 / 60, { desenhar: false }); n++;
    }
    const tickFim = m.tick;
    g.relogio.avancar(1000 / 60, { desenhar: false });
    out.depois = m.tick; out.tickFim = tickFim;
    return out;
  });
  const h = await pg.evaluate(alvo => { const g = window.__golaco; let k = 0; while (g.mundo.tick < alvo - 3 && k < 2000) { g.relogio.avancar(1000 / 60, { desenhar: false }); k++; } return g.rodarPassos(alvo - g.mundo.tick, { x: 0, z: 0, botoes: 0 }); }, tick0 + 700);
  return { tick0, ini, r, h };
}

// ------------------------------------------------------------------------------------------------ A (PC, cena ligada)
let A = null, B = null;
if (roda('A')) try {
  const P = await pagina('?q=baixa&hora=dia&semente=7&substituicao=1&comemoracao=0&replay=0');
  try {
    const pg = P.pagina;
    if (!(await temCena(pg))) {
      meta('T1–T4 a cena de substituição na página', 'não existe (o reserva surge no lugar do outro; o aviso de texto sem número)', 'existe', false);
    } else {
      A = await rodadaHash(pg);
      const q = A.r.q;
      const ticks = new Set(q.map(x => x.tick)), paradas = new Set(q.map(x => x.parada));
      meta('T2 mundo.tick parado na cena inteira e andando no 1º quadro depois; o tempo da parada não anda',
        `${q.length} quadros de cena (${f2(q.length / 60)} s): ticks ${[...ticks].join(',')}; tempo da parada ${[...paradas].join(',')}; depois ${A.r.depois} (fim ${A.r.tickFim})`,
        '1 tick; 1 valor; depois > fim', A.ini.ativo && q.length >= 290 && ticks.size === 1 && paradas.size === 1 && A.r.depois > A.r.tickFim);
      const fx = A.r.faixa;
      const palavras = ['ENTRA', '22', 'Wallace Pimenta', 'SAI', '9', 'Diego Albuquerque', 'GLÇ'];
      meta('T3 a faixa com o texto exato em ≤ 3 quadros do começo da cena', fx ? `quadro ${A.r.faixaQ}: "${fx.texto}" / visível "${fx.visivel}" (${fx.modo})` : 'nenhuma faixa',
        `${TEXTO}; ${palavras.join(', ')}`, !!fx && A.r.faixaQ <= 3 && fx.texto === TEXTO && palavras.every(p => fx.visivel.includes(p)));

      // T4 + T3 (pulada aos 0,6 s): a 2ª troca (7 → 19)
      await trocar(pg, { reiniciar: false, antes: 120, pares: [{ sai: 7, entra: 19 }] });
      const i2 = await ateCena(pg);
      // um quadro de 1/60 s contando os quadros com a faixa na tela (desde o 1º quadro da cena)
      await pg.evaluate(() => {
        const g = window.__golaco;
        window.__fxQ = g.cenaSubst.faixa().visivel ? 1 : 0;
        window.__passo = () => { g.relogio.avancar(1000 / 60, { desenhar: false }); if (g.cenaSubst.faixa().visivel) window.__fxQ++; };
      });
      await pg.evaluate(() => { const g = window.__golaco; while (g.cenaSubst.estado.tempo < 0.2) window.__passo(); });
      // o K (chute) e o J (passe; no lateral, o arremesso) apertados antes de 0,5 s e SEGURADOS; o Enter antes de 0,5 s
      await pg.keyboard.down('KeyK');
      await pg.keyboard.down('KeyJ');
      await pg.keyboard.press('Enter');
      const antes05 = await pg.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 3; i++) window.__passo(); return { ativo: g.cenaSubst.ativo, t: g.cenaSubst.estado?.tempo }; });
      const segurado = await pg.evaluate(() => { const g = window.__golaco; while (g.cenaSubst.ativo && g.cenaSubst.estado.tempo < 0.6) window.__passo(); for (let i = 0; i < 3; i++) window.__passo(); return { ativo: g.cenaSubst.ativo, t: g.cenaSubst.estado?.tempo }; });
      const tPulo = await pg.evaluate(() => window.__golaco.cenaSubst.estado?.tempo ?? null);
      await pg.keyboard.press('Enter');
      const pulo = await pg.evaluate(() => {
        const g = window.__golaco, m = g.mundo;
        let q = 0;
        while (q < 5 && g.cenaSubst.ativo) { window.__passo(); q++; }
        // 60 ticks com o K e o J segurados: nada de carga, pedido nem bola no ar do controlado do humano
        const t0 = m.tick, ruins = [];
        for (let i = 0; i < 400; i++) {
          window.__passo();
          if (m.tick - t0 <= 60) {
            const id = m.controlado?.[0], j = m.jogadores.find(o => o.id === id);
            if (j && j.carga) ruins.push('carga');
            if (j && j.pedido && j.pedido.tick > t0) ruins.push('pedido ' + j.pedido.tipo);
            if (m.voo && m.voo.de === id && m.voo.tick0 > t0) ruins.push('bola ' + m.voo.tipo);
          }
          if (!g.cenaSubst.faixa().visivel && m.tick - t0 > 60) break;
        }
        return { q, ativo: g.cenaSubst.ativo, ruins: [...new Set(ruins)], fxQ: window.__fxQ, ticks: m.tick - t0 };
      });
      await pg.keyboard.up('KeyK');
      await pg.keyboard.up('KeyJ');
      meta('T4 antes de 0,5 s nada pula (o Enter, o K e o J apertados aos 0,2 s)', `cena ${antes05.ativo ? 'continua' : 'ACABOU'} (t ${f2(antes05.t)} s)`, 'continua', i2.ativo && antes05.ativo);
      meta('T4 o K e o J segurados desde antes de 0,5 s não pulam', `aos ${f2(segurado.t)} s a cena ${segurado.ativo ? 'continua' : 'ACABOU'}`, 'continua', segurado.ativo);
      meta('T4 um aperto NOVO (Enter) depois de 0,5 s acaba a cena em ≤ 2 quadros', `aos ${f2(tPulo)} s: ${pulo.q} quadro(s), ativa ${pulo.ativo}`, '≤ 2', pulo.q <= 2 && !pulo.ativo);
      meta('T4 o pulo (com o K e o J segurados) não vira jogada nos 60 ticks seguintes', `${pulo.ruins.length ? pulo.ruins.join(', ') : 'nenhuma carga, pedido ou bola no ar'} (${Math.min(60, pulo.ticks)} ticks)`, 'nenhum', pulo.ruins.length === 0 && pulo.ticks >= 60);
      meta('T3 cena pulada aos ~0,6 s: a faixa continua na tela (no jogo) até ≥ 4,0 s', `${f2(pulo.fxQ / 60)} s na tela (a cena durou ${f2(tPulo)} s)`, '≥ 4,0 s', pulo.fxQ >= 240);

      // T7 pausa, aba escondida e trocarMundo (a 3ª troca: 10 → 20)
      await trocar(pg, { reiniciar: false, antes: 120, pares: [{ sai: 10, entra: 20 }] });
      const i3 = await ateCena(pg);
      const t7 = await pg.evaluate(() => {
        const g = window.__golaco, out = {};
        while (g.cenaSubst.estado.tempo < 1.0) g.relogio.avancar(1000 / 60, { desenhar: false });
        let t0 = g.cenaSubst.estado.tempo;
        g.abrirMenu();
        for (let i = 0; i < 30; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
        out.pausa = g.cenaSubst.estado.tempo - t0;
        g.fecharMenu();
        g.relogio.avancar(1000 / 60, { desenhar: false });
        out.volta = g.cenaSubst.estado.tempo - t0;
        t0 = g.cenaSubst.estado.tempo;
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange'));
        for (let i = 0; i < 30; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
        out.oculta = g.cenaSubst.estado.tempo - t0;
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
        document.dispatchEvent(new Event('visibilitychange'));
        g.relogio.avancar(1000 / 60, { desenhar: false });
        out.voltaOculta = g.cenaSubst.estado.tempo - t0;
        g.reiniciar({ modo: 'partida', semente: 7 });
        out.depoisTroca = { ativo: g.cenaSubst.ativo, fila: g.cenaSubst.fila.length, faixa: g.cenaSubst.faixa().visivel, camada: document.documentElement.classList.contains('em-substituicao') };
        return out;
      });
      meta('T7 pausa: o tempo da cena não anda; volta em ≤ 1 quadro', `na pausa +${f2(t7.pausa)} s; 1 quadro depois +${f2(t7.volta)} s`, '0; ≤ 1/60 s', i3.ativo && t7.pausa === 0 && t7.volta > 0 && t7.volta <= 1 / 60 + 1e-6);
      meta('T7 aba escondida: o tempo da cena não anda; volta em ≤ 1 quadro', `escondida +${f2(t7.oculta)} s; 1 quadro depois +${f2(t7.voltaOculta)} s`, '0; ≤ 1/60 s', t7.oculta === 0 && t7.voltaOculta > 0 && t7.voltaOculta <= 1 / 60 + 1e-6);
      meta('T7 trocarMundo cancela a cena e esvazia a fila', JSON.stringify(t7.depoisTroca), 'tudo falso / 0', !t7.depoisTroca.ativo && t7.depoisTroca.fila === 0 && !t7.depoisTroca.faixa && !t7.depoisTroca.camada);
    }
  } finally { await P.fechar(); }
} catch (e) { meta('A execução', e.message.split('\n')[0], 'sem exceção', false); }

// ------------------------------------------------------------------------------------------------ B (PC, só a faixa)
if (roda('B')) try {
  const P = await pagina('?q=baixa&hora=dia&semente=7&substituicao=0&comemoracao=0&replay=0');
  try {
    const pg = P.pagina;
    if (await temCena(pg)) {
      B = await rodadaHash(pg);
      const sf = await pg.evaluate(() => {
        const g = window.__golaco;
        g.substituicaoDeTeste({ pares: [{ sai: 7, entra: 19 }], parada: 'lateral' });
        let q = 0, vis = 0, cena = 0, texto = '';
        while (q < 900) {
          g.relogio.avancar(1000 / 60, { desenhar: false }); q++;
          if (g.cenaSubst.ativo) cena++;
          const f = g.cenaSubst.faixa();
          if (f.visivel) { vis++; texto = f.texto; } else if (vis) break;
        }
        return { vis, cena, texto };
      });
      meta('T3 "só a faixa": sem cena e a faixa ≥ 4,0 s na tela', `cena ${sf.cena} quadros; faixa ${f2(sf.vis / 60)} s ("${sf.texto}")`, '0; ≥ 4,0 s', sf.cena === 0 && sf.vis >= 240 && /entra 19 Yuri Monteiro, sai 7 Rafael Aguiar/.test(sf.texto));
    }
  } finally { await P.fechar(); }
} catch (e) { meta('B execução', e.message.split('\n')[0], 'sem exceção', false); }
if (A && B) {
  const hn = hashNode ? await hashNode(A.tick0, A.tick0 + 700) : null;
  meta('T1 hash no tick T + 700: cena ligada = desligada = Node', `${A.h} · ${B.h} · Node ${hn} (T ${A.tick0} / ${B.tick0})`, 'iguais', A.h === B.h && A.h === hn && A.tick0 === B.tick0);
} else if (roda('A') && roda('B')) meta('T1 hash com e sem a cena', 'sem a cena', 'iguais', false);

// ------------------------------------------------------------------------------------------------ C (PC: gol + troca; intervalo)
if (roda('C')) try {
  const P = await pagina('?q=baixa&hora=dia&semente=5&substituicao=1');
  try {
    const pg = P.pagina;
    if (!(await temCena(pg))) meta('T5/T6 gol + troca e troca no intervalo', 'sem a cena', '-', false);
    else {
      const gol = await golRoteirizado(pg, { semente: 5, time: 0 });
      const t5 = await pg.evaluate(() => {
        const g = window.__golaco, m = g.mundo, raiz = document.documentElement;
        // a troca pedida na pausa do gol: entra no recomeço (gol + 150, junto com a saída)
        const s = g.estadoTime(0), vagas = { ...s.vagas }; const v = Object.keys(vagas).find(k => vagas[k] === 9); vagas[v] = 22;
        g.editarTime({ tipo: 'editarTime', time: 0, base: s.versao, formacao: s.formacao, vagas, substituicoes: [{ sai: 9, entra: 22 }], tatica: { ...s.tatica } });
        const seq = [], faixaAntes = [];
        let apitoNaCena = null, apitoFim = null, q = 0, fimCena = null;
        const apito = () => g.estadio.sonsPedidos.apito ?? 0;
        const ap0 = apito();
        while (q < 3000) {
          g.relogio.avancar(1000 / 60, { desenhar: false }); q++;
          const c = raiz.classList.contains('em-comemoracao') ? 'comemoracao' : raiz.classList.contains('em-replay') ? 'replay' : raiz.classList.contains('em-substituicao') ? 'substituicao' : 'jogo';
          if (seq[seq.length - 1] !== c) seq.push(c);
          if (!seq.includes('substituicao') && g.cenaSubst.faixa().visivel) faixaAntes.push(c);
          if (c === 'substituicao' && apitoNaCena == null) apitoNaCena = apito() - ap0;
          if (c === 'substituicao') apitoNaCena = Math.max(apitoNaCena, apito() - ap0);
          if (seq.length >= 4 && c === 'jogo' && fimCena == null) { fimCena = q; apitoFim = apito() - ap0; }
          if (fimCena != null && q > fimCena + 5) break;
        }
        return { seq, faixaAntes, apitoNaCena, apitoFim, replayPulado: false, saiu: g.estadoTime(0).saiu };
      });
      meta('T5 gol + troca: comemoração → replay inteiro → substituição → jogo', `${t5.seq.join(' → ')} (gol ${gol.ok ? 'ok' : 'NÃO saiu'}; saiu [${t5.saiu}])`, 'comemoracao → replay → substituicao → jogo',
        gol.ok && ['jogo,comemoracao,replay,substituicao,jogo', 'comemoracao,replay,substituicao,jogo'].includes(t5.seq.join(',')));
      meta('T5 a faixa só depois do replay; o apito da saída pedido depois do fim da cena', `faixa antes: ${t5.faixaAntes.length ? [...new Set(t5.faixaAntes)].join(',') : 'nunca'}; apitos pedidos na cena ${t5.apitoNaCena}, depois ${t5.apitoFim}`,
        'nunca; 0 na cena, ≥ 1 depois', t5.faixaAntes.length === 0 && t5.apitoNaCena === 0 && t5.apitoFim >= 1);
      // T6: troca no intervalo
      const t6 = await pg.evaluate(() => {
        const g = window.__golaco, m = g.mundo;
        g.reiniciar({ modo: 'partida', semente: 5, minutosPorTempo: 0.25 });
        let q = 0;
        while (q < 6000 && g.mundo.partida.estado !== 'intervalo') { g.relogio.avancar(1000 / 60, { desenhar: false }); q++; }
        const mm = g.mundo, s = g.estadoTime(0), vagas = { ...s.vagas }; const v = Object.keys(vagas).find(k => vagas[k] === 9); vagas[v] = 22;
        g.editarTime({ tipo: 'editarTime', time: 0, base: s.versao, formacao: s.formacao, vagas, substituicoes: [{ sai: 9, entra: 22 }], tatica: { ...s.tatica } });
        let cena = 0, vis = 0, tempo2 = null, texto = '', k = 0;
        while (k < 2000) {
          g.relogio.avancar(1000 / 60, { desenhar: false }); k++;
          if (g.cenaSubst.ativo) cena++;
          if (tempo2 == null && mm.partida.tempo === 2) tempo2 = k;
          const f = g.cenaSubst.faixa();
          if (f.visivel) { vis++; texto = f.texto; } else if (vis) break;
        }
        return { intervalo: q, cena, vis, tempo2, texto, saiu: g.estadoTime(0).saiu };
      });
      meta('T6 troca no intervalo: sem cena; a faixa ≥ 4 s na saída do 2º tempo', `cena ${t6.cena} quadros; faixa ${f2(t6.vis / 60)} s ("${t6.texto}"); 2º tempo no quadro ${t6.tempo2}; saiu [${t6.saiu}]`,
        '0; ≥ 4 s', t6.cena === 0 && t6.vis >= 240 && t6.texto === TEXTO && t6.saiu.includes(9));
    }
  } finally { await P.fechar(); }
} catch (e) { meta('C execução', e.message.split('\n')[0], 'sem exceção', false); }

// ------------------------------------------------------------------------------------------------ T8 (layouts) + T9/T10 (celular)
/** Caixas (px) e encostos da faixa contra o HUD; e a cobertura do ator principal (na cena). */
const MEDIR_FAIXA = () => {
  // (checkVisibility: o offsetParent é null para position: fixed; a opacidade não conta — o relógio das animações CSS não
  // anda dentro de um evaluate, e o fade de entrada de 0,25 s ficaria parado no começo)
  const cx = el => { if (!el || el.hidden) return null; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && el.checkVisibility({ checkVisibilityCSS: true }) ? { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom } : null; };
  const f = cx(document.getElementById('faixa-subst'));
  if (!f) return { faixa: null };
  const folga = (a, b) => Math.max(b.x0 - a.x1, a.x0 - b.x1, b.y0 - a.y1, a.y0 - b.y1);
  const outros = { placar: cx(document.querySelector('#hud .placar')), menu: cx(document.getElementById('btn-menu')), minimapa: cx(document.getElementById('minimapa')), aviso: document.getElementById('aviso').classList.contains('visivel') ? cx(document.getElementById('aviso')) : null, pular: cx(document.getElementById('substituicao-pular')) };
  const enc = [];
  for (const [k, b] of Object.entries(outros)) if (b && folga(f, b) < 4) enc.push(`${k} (${folga(f, b).toFixed(0)} px)`);
  for (const b of document.querySelectorAll('#toque .btn-toque')) {
    const r = cx(b); if (!r) continue;
    const c = { x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 }, raio = (r.x1 - r.x0) / 2;
    const qx = Math.max(f.x0, Math.min(c.x, f.x1)), qy = Math.max(f.y0, Math.min(c.y, f.y1));
    if (Math.hypot(c.x - qx, c.y - qy) < raio + 4) enc.push(`${b.id}`);
  }
  // número e palavra inteiros (dentro da faixa e sem reticências)
  const cortados = [];
  for (const s of document.querySelectorAll('#faixa-subst .fs-num, #faixa-subst .fs-palavra')) {
    const r = cx(s); if (!r) continue;
    if (s.scrollWidth > s.clientWidth + 1 || r.x0 < f.x0 - 0.5 || r.x1 > f.x1 + 0.5) cortados.push(s.textContent);
  }
  const W = innerWidth, H = innerHeight;
  return { faixa: f, enc, cortados, fora: f.x0 < 0 || f.y0 < 0 || f.x1 > W || f.y1 > H, modo: document.getElementById('faixa-subst').classList.contains('jogo') ? 'jogo' : 'cena' };
};
const LAYOUTS = [
  { nome: '1280×720', largura: 1280, altura: 720, dpr: 1, toque: false, url: '' },
  { nome: '844×390 com entalhe', largura: 844, altura: 390, dpr: 2, toque: true, url: '&toque=1&entalhe=1', cel: true },
  { nome: '667×375 com entalhe', largura: 667, altura: 375, dpr: 2, toque: true, url: '&toque=1&entalhe=1' },
  { nome: '568×320 com entalhe', largura: 568, altura: 320, dpr: 2, toque: true, url: '&toque=1&entalhe=1' },
];
const t8 = [];
let t8Cobre = 0, t8Ok = true, t8Mapa = true;
// --telas 844,568: só essas telas (pelo começo do nome)
const telas = args.includes('--telas') ? args[args.indexOf('--telas') + 1].split(',') : null;
for (const L of roda('L') ? LAYOUTS.filter(L => !telas || telas.some(t => L.nome.startsWith(t))) : []) {
  try {
    const P = await pagina(`?q=${L.cel ? 'media' : 'baixa'}&hora=noite&semente=7&substituicao=1&comemoracao=0&replay=0${L.url}`, L);
    try {
      const pg = P.pagina;
      if (!(await temCena(pg))) { t8Ok = false; t8.push(`${L.nome}: sem a cena`); continue; }
      await pg.evaluate(() => window.__golaco.relogio.avancar(1000 / 60, { desenhar: true }));
      const progs0 = await pg.evaluate(() => window.__golaco.estado().programas);
      await trocar(pg, {});
      const ini = await ateCena(pg);
      // na cena: a faixa contra o HUD em vários instantes e a cobertura do ator principal; a placa (celular)
      const medidas = [];
      let placaMax = 0, placaNum = null, chamCena = 0;
      for (const t of [0.3, 1.0, 1.8, 2.8, 3.5, 4.3]) {
        const m = await pg.evaluate(([t, FS]) => {
          const g = window.__golaco;
          while (g.cenaSubst.ativo && g.cenaSubst.estado.tempo < t) g.relogio.avancar(1000 / 60, { desenhar: false });
          if (!g.cenaSubst.ativo) return null;
          g.relogio.avancar(1000 / 60, { desenhar: true });
          const r = eval(FS)();
          const a = g.cenaSubst.naTela();
          let cobre = 0;
          if (a && r.faixa) {
            const ix = Math.max(0, Math.min(a.x1, r.faixa.x1) - Math.max(a.x0, r.faixa.x0)), iy = Math.max(0, Math.min(a.y1, r.faixa.y1) - Math.max(a.y0, r.faixa.y0));
            cobre = (ix * iy) / Math.max(1, (a.x1 - a.x0) * (a.y1 - a.y0));
          }
          return { ...r, cobre, plano: g.cenaSubst.estado.plano, placa: g.cenaSubst.placa.naTela(), placaEst: g.cenaSubst.placa.estado, chamadas: g.estado().desenhoChamadas };
        }, [t, MEDIR_FAIXA.toString()]);
        if (!m) continue;
        medidas.push(m);
        t8Cobre = Math.max(t8Cobre, m.cobre);
        if (m.plano === 'entra' && m.placa && !m.placa.atras) { if (m.placa.largura > placaMax) { placaMax = m.placa.largura; placaNum = m.placaEst; } }
        chamCena = Math.max(chamCena, m.chamadas);
      }
      // outra troca, pulada aos 0,6 s: a faixa no jogo (minimapa ligado e desligado; com um aviso na tela)
      await trocar(pg, { pares: [{ sai: 7, entra: 19 }] });
      await ateCena(pg);
      await pg.evaluate(() => { const g = window.__golaco; while (g.cenaSubst.ativo && g.cenaSubst.estado.tempo < 0.6) g.relogio.avancar(1000 / 60, { desenhar: false }); g.cenaSubst.pular(); });
      const jogo = [];
      for (const mapa of ['ligado', 'desligado']) {
        jogo.push(await pg.evaluate(([mapa, FS]) => {
          const g = window.__golaco;
          // o minimapa pelo botão da pausa (o mesmo comando) e um aviso de comando na tela
          const ch = document.getElementById('chip-minimapa');
          if (ch && (ch.getAttribute('aria-pressed') === 'true') !== (mapa === 'ligado')) ch.click();
          g.mostrarEvento({ tipo: 'timeEditado' });
          g.relogio.avancar(1000 / 60, { desenhar: true });
          return { mapa, ...eval(FS)() };
        }, [mapa, MEDIR_FAIXA.toString()]));
      }
      const progs1 = await pg.evaluate(() => window.__golaco.estado().programas);
      for (const m of [...medidas, ...jogo]) {
        if (!m.faixa) { t8Ok = false; t8.push(`${L.nome} ${m.mapa ?? m.plano}: sem faixa`); continue; }
        if (m.enc.length || m.cortados.length || m.fora) { t8Ok = false; t8.push(`${L.nome} ${m.modo}${m.mapa ? ' mapa ' + m.mapa : ''}: ${[...m.enc, ...m.cortados.map(c => 'cortado ' + c), m.fora ? 'fora da tela' : ''].filter(Boolean).join(', ')}`); }
      }
      if (!jogo.some(j => j.mapa === 'ligado' && j.faixa)) t8Mapa = false;
      if (L.cel) {
        meta('T10 celular: a placa no plano ENTRA com ≥ 40 px e os números certos', `${f2(placaMax)} px; ▲${placaNum?.entra} ▼${placaNum?.sai}`, '≥ 40 px; ▲22 ▼9', placaMax >= 40 && placaNum?.entra === 22 && placaNum?.sai === 9);
        meta('T9 celular: programas de shader não aumentam com a cena (pré-carga)', `${progs0} → ${progs1}`, 'iguais', progs0 > 0 && progs1 === progs0);
        // CPU do quadro (sem o desenho): jogo × cena; chamadas de desenho; memória depois de 10 trocas
        let melhor = null;
        for (let tent = 0; tent < 3; tent++) {
          const r = await pg.evaluate(() => {
            const g = window.__golaco;
            g.reiniciar({ modo: 'partida', semente: 7 });
            for (let i = 0; i < 120; i++) g.relogio.avancar(1000 / 60, { desenhar: i % 4 === 0 });
            g.medirQuadro({ zerar: true });
            let cham = 0;
            for (let i = 0; i < 300; i++) { g.relogio.avancar(1000 / 60, { desenhar: false }); if (i % 50 === 0) { g.relogio.avancar(1000 / 60, { desenhar: true }); cham = Math.max(cham, g.estado().desenhoChamadas); } }
            const jogo = g.medirQuadro({ zerar: true });
            g.substituicaoDeTeste({ parada: 'lateral' });
            let q = 0;
            while (!g.cenaSubst.ativo && q < 400) { g.relogio.avancar(1000 / 60, { desenhar: false }); q++; }
            g.medirQuadro({ zerar: true }); g.cenaSubst.zerarCusto();
            let chamC = 0, n = 0;
            while (g.cenaSubst.ativo && n < 500) { g.relogio.avancar(1000 / 60, { desenhar: false }); n++; if (n % 25 === 0) { g.relogio.avancar(1000 / 60, { desenhar: true }); chamC = Math.max(chamC, g.estado().desenhoChamadas); } }
            return { jogo: jogo.cpu, cena: g.medirQuadro({ zerar: true }).cpu, custo: g.cenaSubst.custo, cham, chamC, n };
          });
          if (!melhor || r.cena.p95 - r.jogo.p95 < melhor.cena.p95 - melhor.jogo.p95) melhor = r;
          if (r.cena.p95 <= r.jogo.p95 + 1) break;
        }
        meta('T9 celular: p95 da CPU do quadro na cena ≤ p95 do jogo + 1 ms', `cena ${f2(melhor.cena.p95)} ms (média ${f2(melhor.cena.media)}; a cena ${f2(melhor.custo.msPorTick)} ms/tick) × jogo ${f2(melhor.jogo.p95)} ms`, '≤ jogo + 1', melhor.cena.p95 <= melhor.jogo.p95 + 1);
        meta('T9 celular: chamadas de desenho na cena ≤ jogo + 3 (lado de cá + placa)', `cena ${melhor.chamC} (a 1ª medida: ${chamCena}) × jogo ${melhor.cham}`, `≤ ${melhor.cham + 3}`, melhor.chamC <= melhor.cham + 3);
        // a mesma sequência duas vezes: "só a faixa" (o que o JOGO sobe para a GPU na 1ª vez que aparece — o anel do
        // "próximo da troca" na defesa — fica nesta) e depois com a cena (o que crescer aqui é da cena)
        const lotesMem = ligada => pg.evaluate(ligada => {
          const g = window.__golaco;
          g.cenaSubst.ligada(ligada);
          g.reiniciar({ modo: 'partida', semente: 7 });
          for (let i = 0; i < 60; i++) g.relogio.avancar(1000 / 60, { desenhar: i % 10 === 0 });
          const antes = { geo: g.estado().geometrias, tex: g.estado().texturas };
          // 10 trocas dentro da Regra 3 (5 por time em 3 paradas): 2 + 2, 2 + 2, 1 + 1
          const lotes = [
            [{ sai: 9, entra: 22 }, { sai: 7, entra: 19 }, { sai: 109, entra: 122, time: 1 }, { sai: 107, entra: 119, time: 1 }],
            [{ sai: 10, entra: 20 }, { sai: 11, entra: 21 }, { sai: 110, entra: 120, time: 1 }, { sai: 111, entra: 121, time: 1 }],
            [{ sai: 8, entra: 18 }, { sai: 108, entra: 118, time: 1 }],
          ];
          const feitas = () => g.estadoTime(0).subs.feitas + g.estadoTime(1).subs.feitas;
          let cenas = 0;
          for (const pares of lotes) {
            const f0 = feitas();
            g.substituicaoDeTeste({ pares, parada: 'lateral' });
            let q = 0;
            while (q < 1200 && !g.cenaSubst.ativo && feitas() === f0) { g.relogio.avancar(1000 / 60, { desenhar: q % 8 === 0 }); q++; }
            if (g.cenaSubst.ativo) cenas++;
            while (g.cenaSubst.ativo && q < 2400) { g.relogio.avancar(1000 / 60, { desenhar: q % 8 === 0 }); q++; }
            for (let i = 0; i < 60; i++) g.relogio.avancar(1000 / 60, { desenhar: i % 10 === 0 });
          }
          for (let i = 0; i < 30; i++) g.relogio.avancar(1000 / 60, { desenhar: true });
          const r = { antes, depois: { geo: g.estado().geometrias, tex: g.estado().texturas }, feitas: feitas(), cenas };
          g.cenaSubst.ligada(true);
          return r;
        }, ligada);
        const memSo = await lotesMem(false), mem = await lotesMem(true);
        meta('T9 celular: 0 geometria e 0 textura a mais depois de 10 trocas (com a cena)', `${mem.feitas} trocas em ${mem.cenas} cenas: geometrias ${mem.antes.geo} → ${mem.depois.geo}, texturas ${mem.antes.tex} → ${mem.depois.tex} (antes, a mesma sequência só com a faixa: geometrias ${memSo.antes.geo} → ${memSo.depois.geo}, texturas ${memSo.antes.tex} → ${memSo.depois.tex})`, 'iguais; 10 trocas; 3 cenas', mem.feitas === 10 && mem.cenas === 3 && memSo.cenas === 0 && mem.antes.geo === mem.depois.geo && mem.antes.tex === mem.depois.tex);
        // T7 celular em pé (a tela "Gire o celular"): o tempo da cena não anda; volta em ≤ 1 quadro
        await trocar(pg, { pares: [{ sai: 5, entra: 15 }] });
        await ateCena(pg);
        const t0 = await pg.evaluate(() => { const g = window.__golaco; while (g.cenaSubst.estado.tempo < 1) g.relogio.avancar(1000 / 60, { desenhar: false }); return g.cenaSubst.estado.tempo; });
        await pg.setViewportSize({ width: 390, height: 844 });
        const emPe = await pg.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 30; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); return g.cenaSubst.estado.tempo; });
        await pg.setViewportSize({ width: 844, height: 390 });
        const deitado = await pg.evaluate(() => { const g = window.__golaco; g.relogio.avancar(1000 / 60, { desenhar: false }); return g.cenaSubst.estado?.tempo ?? null; });
        meta('T7 celular em pé: o tempo da cena não anda; volta em ≤ 1 quadro', `em pé +${f2(emPe - t0)} s; deitado de novo +${f2(deitado - emPe)} s`, '0; ≤ 1/60 s', emPe - t0 === 0 && deitado - emPe > 0 && deitado - emPe <= 1 / 60 + 1e-6);
        // a opção da pausa salva e lida depois de recarregar
        const op = await pg.evaluate(() => {
          window.__golaco.abrirMenu();
          document.getElementById('btn-modos').click();
          const antes = document.getElementById('estado-subst').textContent;
          document.getElementById('btn-subst').click();
          const depois = document.getElementById('estado-subst').textContent;
          let salvo = null; try { salvo = JSON.parse(localStorage.getItem('golaco.prefs.v1') || '{}').substituicao; } catch (_) { salvo = null; }
          const j = document.querySelector('.janela-menu');
          return { antes, depois, salvo, rola: j.scrollHeight - j.clientHeight };
        });
        // a página aberta de novo (outra aba do MESMO navegador: o localStorage é o mesmo; navegar na aba velha às vezes
        // não termina no Chromium headless daqui com a máquina carregada)
        const p2 = await P.contexto.newPage();
        p2.on('pageerror', e => errosTodos.push(String(e)));
        await pg.close();
        await p2.goto(srv.url + '?q=media&hora=noite&semente=7&comemoracao=0&replay=0&toque=1&entalhe=1', { waitUntil: 'domcontentloaded', timeout: 600000 });
        await p2.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 600000 });
        const lido = await p2.evaluate(() => ({ texto: document.getElementById('estado-subst').textContent, ligada: window.__golaco.cenaSubst.ligada() }));
        meta('T8 a opção "Cena de substituição" (no "Modo de jogo", sem rolar) salva e lida depois de recarregar', `${op.antes} → ${op.depois} (salvo ${op.salvo}; o submenu rola ${op.rola} px); recarregada: "${lido.texto}" (${lido.ligada})`,
          'ligada → só a faixa; false; ≤ 0 px; só a faixa', op.antes === 'ligada' && op.depois === 'só a faixa' && op.salvo === false && op.rola <= 0 && lido.texto === 'só a faixa' && lido.ligada === false);
      }
    } finally { await P.fechar(); }
  } catch (e) { t8Ok = false; t8.push(`${L.nome}: ${e.message.split('\n')[0]}`); }
}
if (roda('L')) {
  meta('T8 nada sobre nada: a faixa (cena e jogo) a ≥ 4 px do placar, menu, minimapa, aviso, "Pular" e botões; número e palavra inteiros', t8.length ? t8.join('; ') : `${LAYOUTS.length} telas, sem encosto`, 'nenhum encosto', t8Ok && t8.length === 0 && t8Mapa);
  meta('T8 a faixa cobre ≤ 10% da caixa do ator principal (na cena)', `${f2(t8Cobre * 100)}% no pior quadro`, '≤ 10%', t8Cobre <= 0.1);
}

await srv.fechar();
meta('console sem erros', errosTodos.length ? errosTodos.slice(0, 3).join(' | ') : 'nenhum', 'nenhum', errosTodos.length === 0);
const larg = Math.max(...res.map(r => r.nome.length));
for (const r of res) console.log(`${r.info ? 'INFO    ' : r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.nome.padEnd(larg)}  ${r.medido}   (alvo: ${r.alvo})`);
const ok = res.length > 0 && res.every(r => r.ok || r.info);
console.log(ok ? '\nteste-substituicao-tela: PASSOU' : '\nteste-substituicao-tela: REPROVOU');
process.exit(ok ? 0 : 1);
