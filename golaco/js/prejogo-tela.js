// GOLAÇO — a camada de tela do PRÉ-JOGO (DOM): a abertura ("Toque para começar": o toque libera o som — a Web Audio
// só começa num gesto, MDN "Autoplay guide" — e, no Android, a tela cheia deitada), as faixas de cinema das cenas
// (2,39:1), o preto das transições, o botão Pular e a escalação (escalacao-tela.js). Cobre a tela inteira e pega o
// toque: no pré-jogo nada chega ao jogo (o analógico e os botões ficam escondidos; main.js bloqueia a entrada).
//
// Pular (PESQUISA-PREJOGO.md §5): toque/clique em qualquer lugar, Enter, Espaço ou A do controle → próximo BLOCO
// (cenas → escalação do mandante → do visitante → jogo); o botão Pular, Esc/P ou Start → direto para o jogo (Esc/P/
// Start chegam pela entrada bloqueada: main.js tratarAcao('pausa')). O botão some depois de 3 s parado e volta com
// qualquer toque, tecla ou movimento.
import { criarEscalacaoTela } from './escalacao-tela.js';
import { ELENCOS } from './elenco.js';

const SVG_PULAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6l7 6-7 6zM12 6l7 6-7 6z" fill="currentColor"/><path d="M20.5 5.5v13" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * opc = {aoProximo(), aoPularTudo(), aoComecar(), comToque: () => bool}. Devolve {raiz, escalacao, mostrar(v),
 * abertura(times | null), faixas(k), preto(a), modo(nome), atualizar(agoraMs), pularVisivel}.
 */
export function criarPrejogoTela(opc) {
  const raiz = document.createElement('div');
  raiz.id = 'prejogo';
  raiz.className = 'prejogo';
  raiz.hidden = true;
  raiz.setAttribute('role', 'region');
  raiz.setAttribute('aria-label', 'Pré-jogo');
  raiz.innerHTML = '<i class="pj-faixa pj-faixa-cima" aria-hidden="true"></i><i class="pj-faixa pj-faixa-baixo" aria-hidden="true"></i>'
    + '<i class="pj-esc-fundo" aria-hidden="true"></i>';
  document.body.appendChild(raiz);
  const escalacao = criarEscalacaoTela(raiz);
  const preto = document.createElement('i');
  preto.className = 'pj-preto';
  preto.setAttribute('aria-hidden', 'true');
  raiz.appendChild(preto);
  // abertura
  const ab = document.createElement('div');
  ab.className = 'pj-abertura';
  ab.hidden = true;
  ab.innerHTML = '<div class="pj-ab-marca">GOLAÇO</div><h1 class="pj-ab-jogo"></h1><p class="pj-ab-chama"></p>';
  raiz.appendChild(ab);
  // Pular
  const pular = document.createElement('button');
  pular.type = 'button';
  pular.className = 'pj-pular';
  pular.innerHTML = `${SVG_PULAR}<span>Pular</span>`;
  pular.setAttribute('aria-label', 'Pular o pré-jogo');
  raiz.appendChild(pular);
  const faixas = raiz.querySelectorAll('.pj-faixa');
  const fundoEsc = raiz.querySelector('.pj-esc-fundo');

  let naAbertura = false, ativo = false;
  let ultimoGesto = 0;
  const padAntes = [];
  const mostrarPular = () => { ultimoGesto = performance.now(); pular.classList.add('visivel'); };

  pular.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); });
  pular.addEventListener('click', e => { e.stopPropagation(); if (ativo && !naAbertura) opc.aoPularTudo(); });
  raiz.addEventListener('pointerdown', e => {
    if (!ativo || e.button > 0) return;
    e.preventDefault();
    mostrarPular();
    if (naAbertura) opc.aoComecar(); else opc.aoProximo();
  });
  raiz.addEventListener('pointermove', () => { if (ativo && !naAbertura) mostrarPular(); });
  raiz.addEventListener('contextmenu', e => e.preventDefault());
  // Enter / Espaço: próximo bloco (Esc, P e Start vêm pela entrada: pular tudo). Na captura, antes da entrada.
  window.addEventListener('keydown', e => {
    if (!ativo || e.repeat) return;
    if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') {
      e.preventDefault();
      mostrarPular();
      if (naAbertura) opc.aoComecar(); else opc.aoProximo();
    } else if (!naAbertura) mostrarPular();
  }, true);

  return {
    raiz, escalacao,
    get ativo() { return ativo; },
    mostrar(v) {
      ativo = !!v;
      raiz.hidden = !ativo;
      document.documentElement.classList.toggle('prejogo', ativo);
      if (ativo) mostrarPular(); else { escalacao.esconder(); ab.hidden = true; naAbertura = false; }
    },
    /** A abertura (times = m.times) ou null para tirar. */
    abertura(times) {
      naAbertura = !!times;
      ab.hidden = !times;
      raiz.classList.toggle('na-abertura', naAbertura);
      if (times) {
        const nome = t => ELENCOS[times[t].elenco]?.nome ?? '';
        ab.querySelector('.pj-ab-jogo').innerHTML = `<span>${esc(nome(0))}</span><i aria-hidden="true">×</i><span>${esc(nome(1))}</span>`;
        ab.querySelector('.pj-ab-chama').textContent = opc.comToque() ? 'Toque para começar' : 'Clique ou aperte Enter para começar';
        pular.classList.remove('visivel');
      }
    },
    get naAbertura() { return naAbertura; },
    /** Faixas de cinema: k = 0 (sem) a 1 (2,39:1). */
    faixas(k, proporcao) {
      const w = window.innerWidth, h = window.innerHeight;
      const alvo = Math.max(0, (h - w / proporcao) / 2);
      const px = Math.round(alvo * Math.max(0, Math.min(1, k)));
      faixas[0].style.height = `${px}px`; faixas[1].style.height = `${px}px`;
    },
    /** Preto por cima (0–1). */
    preto(a) { preto.style.opacity = String(Math.max(0, Math.min(1, a)).toFixed(3)); },
    /** O fundo escuro da escalação (0–1). */
    fundoEscalacao(a) { fundoEsc.style.opacity = String(Math.max(0, Math.min(1, a)).toFixed(3)); raiz.classList.toggle('na-escalacao', a > 0.01); },
    /** Uma vez por quadro: o A do controle (próximo bloco) e o botão Pular que some parado. */
    atualizar(agora) {
      if (!ativo) return;
      const lista = navigator.getGamepads ? navigator.getGamepads() : null;
      if (lista) {
        for (let i = 0; i < lista.length; i++) {
          const g = lista[i];
          if (!g || !g.connected) continue;
          const a = !!(g.buttons[0] && (g.buttons[0].pressed || g.buttons[0].value > 0.3));
          if (a && !padAntes[i]) { mostrarPular(); if (naAbertura) opc.aoComecar(); else opc.aoProximo(); }
          padAntes[i] = a;
        }
      }
      if (!naAbertura && pular.classList.contains('visivel') && agora - ultimoGesto > 3000) pular.classList.remove('visivel');
    },
    get pularVisivel() { return pular.classList.contains('visivel'); },
    get botaoPular() { return pular; },
  };
}
