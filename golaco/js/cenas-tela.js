// Tela das CENAS das paradas (DOM; pedido do dono de 22/10, PLANO-CENAS.md §1.4 e §3.1): a TARJA DE IDENTIFICAÇÃO do
// jogador com cartão — o cartão desenhado (amarelo, vermelho ou os dois no 2º amarelo), a cor, o escudo e a sigla do
// time, o número e o nome. Nem o motivo nem o minuto: é a identificação da transmissão (DFL International Rundown,
// "identificação do jogador com cartão", 6 s), uma exceção escrita à "sem narração" (CLAUDE.md, CONTRATOS.md "Cenas das
// paradas"), como a faixa ENTRA/SAI da substituição e o selo IMPEDIMENTO/POSIÇÃO LEGAL. Só aparece DENTRO da cena (com a
// simulação segura) e sai com ela: nunca por cima da bola rolando (teste-hud-minimo H2; PLANO-CENAS.md R10). Os PRs 3 e 4
// acrescentam aqui a tarja do placar com os autores e o painel de estatísticas.
// Sob demanda (main.js SOB.cenas, com o css/cenas.css): fora do download inicial. Nada escrito no mundo; texto sempre por
// textContent (nunca HTML de nome).
//   criarTelaCenas({raiz}) → {tarja(dados | null), estado(), caixa()}
//   dados = {cor: 'amarelo' | 'vermelho', segundo, sigla, nomeTime, cor1 (a cor do time), cor2 (o texto por cima dela),
//            escudo (o href do <symbol> do escudo, ex. '#escudo-golaco'), num, nome, curto}

const NS = 'http://www.w3.org/2000/svg';

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
    /** Estado (testes): {visivel, texto (o que a tela mostra), cartoes, sigla, num, nome}. */
    estado() {
      const vis = !el.hidden && el.getClientRects().length > 0;
      const visNome = [nome, curto].find(e => getComputedStyle(e).display !== 'none');
      return {
        visivel: vis, cartoes: c2.hidden ? 1 : 2, cor: c1.classList.contains('vermelho') ? 'vermelho' : 'amarelo',
        sigla: sigla.textContent, num: num.textContent, nome: visNome?.textContent ?? '',
        texto: vis ? `${sigla.textContent} ${num.textContent} ${visNome?.textContent ?? ''}`.trim() : '',
      };
    },
    /** A caixa na tela (px CSS) ou null escondida. */
    caixa() {
      if (el.hidden) return null;
      const r = el.getBoundingClientRect();
      return r.width > 0 ? { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom } : null;
    },
    get elemento() { return el; },
  };
}
