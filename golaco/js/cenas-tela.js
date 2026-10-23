// Tela das CENAS das paradas (DOM; pedido do dono de 22/10, PLANO-CENAS.md §1.4 e §3.1): a TARJA DE IDENTIFICAÇÃO do
// jogador com cartão — o cartão desenhado (amarelo, vermelho ou os dois no 2º amarelo), a cor, o escudo e a sigla do
// time, o número e o nome. Nem o motivo nem o minuto: é a identificação da transmissão (DFL International Rundown,
// "identificação do jogador com cartão", 6 s), uma exceção escrita à "sem narração" (CLAUDE.md, CONTRATOS.md "Cenas das
// paradas"), como a faixa ENTRA/SAI da substituição e o selo IMPEDIMENTO/POSIÇÃO LEGAL. Só aparece DENTRO da cena (com a
// simulação segura) e sai com ela: nunca por cima da bola rolando (teste-hud-minimo H2; PLANO-CENAS.md R10).
// PR 3 (o intervalo; PLANO-CENAS.md §4.1, §7.3): a TARJA DO PLACAR com os autores (escudo, sigla e placar dos dois times;
// embaixo, os autores de cada lado — "Nome 12', 38'", o gol contra "(c)" e o pênalti "(p)", como a tarja da DFL: o placar
// de transmissão, outra exceção escrita à "sem narração") e o PAINEL DE ESTATÍSTICAS (só rótulos e números, sem frase:
// wTVision). As duas só dentro da cena; no online (sem cena) a tarja do placar só nos 3 s da faixa do intervalo, com o
// mundo parado (R10), no centro, embaixo da faixa (o analógico fica embaixo à esquerda).
// Sob demanda (main.js SOB.cenas, com o css/cenas.css): fora do download inicial. Nada escrito no mundo; texto sempre por
// textContent (nunca HTML de nome).
//   criarTelaCenas({raiz}) → {tarja(dados | null), placar(dados | null), estatisticas(dados | null), estado(), caixa(),
//     caixas()}
//   tarja: dados = {cor: 'amarelo' | 'vermelho', segundo, sigla, nomeTime, cor1 (a cor do time), cor2 (o texto por cima
//          dela), escudo (o href do <symbol> do escudo, ex. '#escudo-golaco'), num, nome, curto}
//   placar: dados = {times: [{sigla, nome, escudo, cor1, cor2}, …], gols: [a, b], autores: {0: [{nome, gols: [{minuto,
//          penalti, contra}]}], 1: […]} | null, online (no centro, embaixo da faixa)}
//   estatisticas: dados = {titulo ('1º tempo' | 'Partida'), times: [{sigla, escudo, cor1, cor2}, …], itens (CENA_FIM.
//          estatisticas.itens), valores (sumula.js estatisticas: posse [%, %], chutes, noAlvo, escanteios, faltas,
//          amarelos, vermelhos)}

const NS = 'http://www.w3.org/2000/svg';

/** O texto de um autor na tarja do placar: "Nome 12', 38' (p)" (o gol contra "(c)", o pênalti "(p)"). Puro. */
export function textoAutor(a) {
  const mins = (a.gols ?? []).map(g => `${g.minuto}'${g.contra ? ' (c)' : g.penalti ? ' (p)' : ''}`);
  return `${a.nome ?? ''} ${mins.join(', ')}`.trim();
}
/** Os rótulos do painel de estatísticas (só rótulos e números). */
export const ROTULOS_EST = { posse: 'Posse de bola', chutes: 'Finalizações', noAlvo: 'No alvo', escanteios: 'Escanteios', faltas: 'Faltas', cartoes: 'Cartões' };

/** Escudo (svg com <use>) + sigla na cor do time; devolve {el, use, sigla}. */
function blocoTime(classe) {
  const time = document.createElement('span'); time.className = classe; time.setAttribute('aria-hidden', 'true');
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'tc-escudo'); svg.setAttribute('viewBox', '0 0 20 22');
  const use = document.createElementNS(NS, 'use'); svg.append(use);
  const sigla = document.createElement('b'); sigla.className = 'tc-sigla';
  time.append(svg, sigla);
  return { el: time, svg, use, sigla };
}
function pintarTime(b, t) {
  if (t?.escudo) { b.use.setAttribute('href', t.escudo); b.svg.style.display = ''; } else b.svg.style.display = 'none';
  b.sigla.textContent = t?.sigla ?? '';
  if (t?.cor1) { b.el.style.setProperty('--cor-time', t.cor1); b.el.style.setProperty('--cor-time-texto', t.cor2 || ''); }
  else { b.el.style.removeProperty('--cor-time'); b.el.style.removeProperty('--cor-time-texto'); }
}

export function criarTelaCenas(opc = {}) {
  const raiz = opc.raiz ?? document.getElementById('hud') ?? document.body;
  const el = document.createElement('div');
  el.className = 'tarja-cena';
  el.id = 'tarja-cena';
  el.dataset.caixa = 'tarja-cena';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.hidden = true;
  const sr = document.createElement('span'); sr.className = 'tc-sr';
  const cartoes = document.createElement('span'); cartoes.className = 'tc-cartoes'; cartoes.setAttribute('aria-hidden', 'true');
  const c1 = document.createElement('i'), c2 = document.createElement('i');
  cartoes.append(c1, c2);
  const time = document.createElement('span'); time.className = 'tc-time'; time.setAttribute('aria-hidden', 'true');
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'tc-escudo'); svg.setAttribute('viewBox', '0 0 20 22');
  const use = document.createElementNS(NS, 'use'); svg.append(use);
  const sigla = document.createElement('b'); sigla.className = 'tc-sigla';
  time.append(svg, sigla);
  const num = document.createElement('b'); num.className = 'tc-num'; num.setAttribute('aria-hidden', 'true');
  const nome = document.createElement('span'); nome.className = 'tc-nome tc-nome-completo'; nome.setAttribute('aria-hidden', 'true');
  const curto = document.createElement('span'); curto.className = 'tc-nome tc-nome-curto'; curto.setAttribute('aria-hidden', 'true');
  el.append(sr, cartoes, time, num, nome, curto);
  raiz.append(el);
  let atual = null;

  // ---- a tarja do placar com os autores (PR 3)
  const tp = document.createElement('div');
  tp.className = 'tarja-placar'; tp.id = 'tarja-placar'; tp.dataset.caixa = 'tarja-placar';
  tp.setAttribute('role', 'status'); tp.setAttribute('aria-live', 'polite'); tp.hidden = true;
  const tpSr = document.createElement('span'); tpSr.className = 'tc-sr';
  const tpLinha = document.createElement('div'); tpLinha.className = 'tp-linha'; tpLinha.setAttribute('aria-hidden', 'true');
  const tp0 = blocoTime('tc-time tp-time'), tp1 = blocoTime('tc-time tp-time');
  const tpGols = document.createElement('b'); tpGols.className = 'tp-gols';
  tpLinha.append(tp0.el, tpGols, tp1.el);
  const tpAut = document.createElement('div'); tpAut.className = 'tp-autores'; tpAut.setAttribute('aria-hidden', 'true');
  const tpA0 = document.createElement('div'), tpA1 = document.createElement('div');
  tpA0.className = 'tp-lado tp-lado0'; tpA1.className = 'tp-lado tp-lado1';
  tpAut.append(tpA0, tpA1);
  tp.append(tpSr, tpLinha, tpAut);
  raiz.append(tp);
  let atualPlacar = null;

  // ---- o painel de estatísticas (PR 3)
  const pe = document.createElement('div');
  pe.className = 'painel-est'; pe.id = 'painel-est'; pe.dataset.caixa = 'painel-est';
  pe.setAttribute('role', 'status'); pe.setAttribute('aria-live', 'polite'); pe.hidden = true;
  const peSr = document.createElement('span'); peSr.className = 'tc-sr';
  const peTopo = document.createElement('div'); peTopo.className = 'pe-topo'; peTopo.setAttribute('aria-hidden', 'true');
  const pe0 = blocoTime('tc-time pe-time'), pe1 = blocoTime('tc-time pe-time');
  const peTit = document.createElement('span'); peTit.className = 'pe-titulo';
  peTopo.append(pe0.el, peTit, pe1.el);
  const peLinhas = document.createElement('div'); peLinhas.className = 'pe-linhas'; peLinhas.setAttribute('aria-hidden', 'true');
  pe.append(peSr, peTopo, peLinhas);
  raiz.append(pe);
  let atualEst = null;
  const linhasTexto = [];

  const vis2 = e => !e.hidden && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
  const caixaDe = e => { if (e.hidden) return null; const r = e.getBoundingClientRect(); return r.width > 0 ? { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom } : null; };
  /** O valor de um item no painel: o número (a posse com %); os cartões como amarelos e vermelhos (mini cartões). */
  function valor(itm, v, t) {
    const span = document.createElement('span'); span.className = 'pe-valor';
    if (itm === 'cartoes') {
      for (const [cor, n] of [['amarelo', v.amarelos?.[t] ?? 0], ['vermelho', v.vermelhos?.[t] ?? 0]]) {
        if (cor === 'vermelho' && !n) continue;
        const i = document.createElement('i'); i.className = `pe-cartao ${cor}`;
        const b = document.createElement('b'); b.textContent = String(n);
        span.append(i, b);
      }
      return { el: span, texto: `${v.amarelos?.[t] ?? 0}${(v.vermelhos?.[t] ?? 0) ? `+${v.vermelhos[t]}` : ''}` };
    }
    const n = v[itm]?.[t] ?? 0;
    span.textContent = itm === 'posse' ? `${n}%` : String(n);
    return { el: span, texto: span.textContent };
  }

  return {
    /** Mostra a tarja (dados) ou tira (null). Escreve no DOM só quando muda. */
    tarja(d) {
      if (!d) {
        if (!el.hidden) { el.hidden = true; el.classList.remove('visivel'); }
        atual = null;
        return;
      }
      const chave = `${d.cor}|${d.segundo ? 1 : 0}|${d.sigla}|${d.num}|${d.nome}|${d.escudo}`;
      if (chave === atual && !el.hidden) return;
      atual = chave;
      c1.className = `tc-cartao ${d.segundo ? 'amarelo' : d.cor === 'vermelho' ? 'vermelho' : 'amarelo'}`;
      c2.className = 'tc-cartao vermelho';
      c2.hidden = !d.segundo;
      if (d.escudo) { use.setAttribute('href', d.escudo); svg.style.display = ''; } else svg.style.display = 'none';
      sigla.textContent = d.sigla ?? '';
      el.style.setProperty('--cor-time', d.cor1 || '');
      el.style.setProperty('--cor-time-texto', d.cor2 || '');
      if (!d.cor1) { el.style.removeProperty('--cor-time'); el.style.removeProperty('--cor-time-texto'); }
      num.textContent = d.num != null && d.num !== '' ? String(d.num) : '';
      nome.textContent = d.nome ?? '';
      curto.textContent = d.curto ?? d.nome ?? '';
      const cartao = d.segundo ? 'Segundo amarelo e cartão vermelho' : d.cor === 'vermelho' ? 'Cartão vermelho' : 'Cartão amarelo';
      sr.textContent = `${cartao}: ${num.textContent ? num.textContent + ' ' : ''}${d.nome ?? ''}${d.nomeTime ? ` (${d.nomeTime})` : ''}`;
      el.hidden = false;
      el.classList.remove('visivel'); void el.offsetWidth; el.classList.add('visivel');
    },
    /** A tarja do placar com os autores (dados) ou nada (null). Escreve no DOM só quando muda. */
    placar(d) {
      if (!d) {
        if (!tp.hidden) { tp.hidden = true; tp.classList.remove('visivel'); }
        atualPlacar = null;
        return;
      }
      const aut = d.autores ? [0, 1].map(t => (d.autores[t] ?? []).map(textoAutor)) : [[], []];
      const chave = JSON.stringify([d.times?.map(t => [t.sigla, t.escudo, t.cor1]), d.gols, aut, !!d.online]);
      if (chave === atualPlacar && !tp.hidden) return;
      atualPlacar = chave;
      pintarTime(tp0, d.times?.[0]); pintarTime(tp1, d.times?.[1]);
      tpGols.textContent = `${d.gols?.[0] ?? 0} – ${d.gols?.[1] ?? 0}`;
      for (const [k, box] of [[0, tpA0], [1, tpA1]]) {
        box.replaceChildren(...aut[k].map(tx => { const s = document.createElement('span'); s.className = 'tp-autor'; s.textContent = tx; return s; }));
      }
      tpAut.hidden = !aut[0].length && !aut[1].length;
      tp.classList.toggle('online', !!d.online);
      const nomes = [0, 1].map(t => d.times?.[t]?.nome ?? d.times?.[t]?.sigla ?? '');
      tpSr.textContent = `Placar: ${nomes[0]} ${d.gols?.[0] ?? 0}, ${nomes[1]} ${d.gols?.[1] ?? 0}.${aut[0].length || aut[1].length ? ` Gols: ${[...aut[0], ...aut[1]].join('; ')}.` : ''}`;
      tp.hidden = false;
      tp.classList.remove('visivel'); void tp.offsetWidth; tp.classList.add('visivel');
    },
    /** O painel de estatísticas (dados) ou nada (null). Escreve no DOM só quando muda. */
    estatisticas(d) {
      if (!d) {
        if (!pe.hidden) { pe.hidden = true; pe.classList.remove('visivel'); }
        atualEst = null;
        return;
      }
      const chave = JSON.stringify([d.titulo, d.times?.map(t => [t.sigla, t.escudo, t.cor1]), d.itens, d.valores]);
      if (chave === atualEst && !pe.hidden) return;
      atualEst = chave;
      pintarTime(pe0, d.times?.[0]); pintarTime(pe1, d.times?.[1]);
      peTit.textContent = d.titulo ?? '';
      linhasTexto.length = 0;
      const filhos = [];
      for (const itm of d.itens ?? []) {
        if (!(itm in ROTULOS_EST)) continue;
        const ln = document.createElement('div'); ln.className = `pe-linha pe-${itm}`;
        const a = valor(itm, d.valores, 0), b = valor(itm, d.valores, 1);
        const r = document.createElement('span'); r.className = 'pe-rotulo'; r.textContent = ROTULOS_EST[itm];
        a.el.classList.add('pe-a'); b.el.classList.add('pe-b');
        ln.append(a.el, r, b.el);
        filhos.push(ln);
        linhasTexto.push({ item: itm, rotulo: ROTULOS_EST[itm], a: a.texto, b: b.texto });
      }
      peLinhas.replaceChildren(...filhos);
      peSr.textContent = `${d.titulo ?? ''}: ${linhasTexto.map(l => `${l.rotulo} ${l.a} a ${l.b}`).join('; ')}.`;
      pe.hidden = false;
      pe.classList.remove('visivel'); void pe.offsetWidth; pe.classList.add('visivel');
    },
    /**
     * As caixas na tela (px CSS) de cada peça visível (testes: nada encosta): {tarja, placar, estatisticas} — null escondida.
     */
    caixas() { return { tarja: caixaDe(el), placar: caixaDe(tp), estatisticas: caixaDe(pe) }; },
    /** Estado (testes): {visivel, texto (o que a tela mostra), cartoes, sigla, num, nome, placar, estatisticas}. */
    estado() {
      const vis = !el.hidden && el.getClientRects().length > 0;
      const visNome = [nome, curto].find(e => getComputedStyle(e).display !== 'none');
      return {
        visivel: vis, cartoes: c2.hidden ? 1 : 2, cor: c1.classList.contains('vermelho') ? 'vermelho' : 'amarelo',
        sigla: sigla.textContent, num: num.textContent, nome: visNome?.textContent ?? '',
        texto: vis ? `${sigla.textContent} ${num.textContent} ${visNome?.textContent ?? ''}`.trim() : '',
        placar: {
          visivel: vis2(tp), gols: tpGols.textContent, siglas: [tp0.sigla.textContent, tp1.sigla.textContent],
          autores: [[...tpA0.children].map(e => e.textContent), [...tpA1.children].map(e => e.textContent)], online: tp.classList.contains('online'),
        },
        estatisticas: { visivel: vis2(pe), titulo: peTit.textContent, linhas: linhasTexto.map(l => ({ ...l })) },
      };
    },
    /** A caixa na tela (px CSS) ou null escondida. */
    caixa() {
      if (el.hidden) return null;
      const r = el.getBoundingClientRect();
      return r.width > 0 ? { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom } : null;
    },
    get elemento() { return el; },
    get elementos() { return { tarja: el, placar: tp, estatisticas: pe }; },
  };
}
