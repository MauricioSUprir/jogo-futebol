// GOLAÇO — escalação do PRÉ-JOGO (DOM). Pedido do dono de 11/10: "aparece a escalação dos dois times em um campinho:
// primeiro um time, aparece grande na tela, com o mesmo fundo, uns 10 seg, aí sai da tela, e entra a escalação do outro
// time, da mesma forma". Cada time numa folha que ocupa a tela: a coluna do time (faixa na cor do uniforme, o nome e a
// formação) e o campinho grande com as 11 cartas (número, nome de camisa e posição de cada titular) — os dados da
// escalação (m.times, lidos antes do 1º passo: só leitura), nenhum outro texto (sem narração). O campinho é o do
// "Editar time" (campinho.js e posicaoNaTela de editor-time.js); nada encosta de 568×320 a 1920×1080 (folga ≥ 8 px,
// letra ≥ 10 px; tools/teste-prejogo.mjs confere).
//
// O movimento sai do relógio do roteiro (prejogo-roteiro.js escalacaoEm: entrando/saindo 0–1), não de transição do
// CSS: com o relógio manual dos testes e prints a tela fica no mesmo ponto que o 3D. Entra deslizando da esquerda
// (cubic-bezier(.2,.8,.2,1)), as cartas em cascata de 40 ms do goleiro ao ataque; sai para a direita enquanto a
// outra entra. Com "reduzir movimento" do sistema: só esmaece.
import { ELENCOS, fichaDe } from './elenco.js';
import { FORMACOES } from './formacoes.js';
import { posicaoNaTela } from './editor-time.js';
import { svgCampinho } from './campinho.js';

// cor da faixa do time pelo uniforme de linha (fictícios: o Golaço FC preto e verde, o Ventania FC branco)
const COR_UNIFORME = { linha0: '#19e07a', linha1: '#e9ecee' };
const PROPORCAO = 105 / 68;
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const reduz = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Curva de saída rápida e chegada suave (o cubic-bezier(.2, .8, .2, 1) do CSS, aproximado). */
function entrada(x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return 1 - Math.pow(1 - x, 3.2); }

/**
 * Tamanho das cartas e do campinho numa área W × H (px): o campo na proporção 105:68 quando sobra espaço; senão a
 * área inteira (celular pequeno) — o passo da grade (5 × 5) é sempre ≥ carta + 8 px. Pura (os testes podem chamar).
 */
export function tamanhoEscalacao(W, H, vertical = false) {
  const cw = Math.max(56, Math.min(120, Math.floor((W - 12 - 40) / 5)));
  const ch = Math.max(44, Math.min(76, Math.floor((H - 12 - 40) / 5)));
  const P = vertical ? 1 / PROPORCAO : PROPORCAO;
  let w = W, h = H;
  const passoOk = (ww, hh) => (ww - 12 - cw) / 4 >= cw + 10 && (hh - 12 - ch) / 4 >= ch + 10;
  if (W / H > P * 1.12) { const w2 = Math.round(H * P * 1.12); if (passoOk(w2, H)) w = w2; }
  else if (W / H < P * 0.94) { const h2 = Math.round(W / (P * 0.94)); if (passoOk(W, h2)) h = h2; }
  return { cw, ch, w, h };
}

/**
 * Cria a escalação dentro de `raiz` (o #prejogo). Devolve {montar(times), mostrar(e), esconder(), estado}.
 * e = prejogo-roteiro.js escalacaoEm(r, t) ({time, entrando, saindo, saiTime, cheia}) mais tau (s desde que a folha
 * começou a entrar) para a cascata das cartas.
 */
export function criarEscalacaoTela(raiz) {
  const folhas = [0, 1].map(t => {
    const s = document.createElement('section');
    s.className = 'pj-esc';
    s.dataset.time = String(t);
    s.hidden = true;
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = `<div class="pj-esc-info"><i class="pj-esc-faixa"></i><span class="pj-esc-rotulo">Escalação</span><h2 class="pj-esc-nome"></h2><span class="pj-esc-forma"></span></div>`
      + `<div class="pj-esc-area"><div class="pj-esc-campo"><svg class="pj-esc-linhas" preserveAspectRatio="none" aria-hidden="true"></svg></div></div>`;
    raiz.appendChild(s);
    return { s, campo: s.querySelector('.pj-esc-campo'), area: s.querySelector('.pj-esc-area'), linhas: s.querySelector('.pj-esc-linhas'), cartas: [], vagas: [], vertical: null, tam: null };
  });
  const estado = { visivel: false, time: null, cheia: null };
  let ultimoTam = '';

  function montarFolha(f, tm) {
    const el = ELENCOS[tm.elenco];
    f.s.style.setProperty('--cor-time', COR_UNIFORME[el?.uniforme?.linha] ?? '#19e07a');
    f.s.querySelector('.pj-esc-nome').textContent = el?.nome ?? '';
    f.s.querySelector('.pj-esc-forma').textContent = tm.formacao;
    f.s.setAttribute('aria-label', `Escalação: ${el?.nome ?? ''}, ${tm.formacao}`);
    for (const c of f.cartas) c.remove();
    f.cartas = []; f.vagas = [];
    for (const v of FORMACOES[tm.formacao].vagas) {
      const id = tm.vagas[v.id];
      const j = fichaDe(id);
      if (!j) continue;  // vaga vazia (não acontece antes do 1º passo)
      const d = document.createElement('div');
      d.className = 'pj-carta';
      d.dataset.id = String(id);
      d.dataset.vaga = v.id;
      d.innerHTML = `<span class="pj-num">${j.num}</span><span class="pj-nome">${esc(j.camisa)}</span><span class="pj-pos">${esc(v.pos)}</span>`;
      f.campo.appendChild(d);
      f.cartas.push(d);
      f.vagas.push(v);
    }
    f.tam = null;
  }

  function layout(f) {
    const W = f.area.clientWidth, H = f.area.clientHeight;
    if (!(W > 0 && H > 0)) return;
    const vertical = W / H < 0.95;
    const chave = `${W}x${H}`;
    if (f.tam === chave) return;
    f.tam = chave;
    const { cw, ch, w, h } = tamanhoEscalacao(W, H, vertical);
    f.campo.style.width = `${w}px`; f.campo.style.height = `${h}px`;
    if (f.vertical !== vertical) {
      const s = svgCampinho(vertical);
      f.linhas.setAttribute('viewBox', s.viewBox);
      f.linhas.innerHTML = s.html;
      f.vertical = vertical;
    }
    f.campo.style.setProperty('--ch', `${ch}px`);
    f.campo.style.setProperty('--cw', `${cw}px`);
    f.cartas.forEach((d, i) => {
      const p = posicaoNaTela(f.vagas[i], w, h, cw, ch, vertical);
      d.style.left = `${(p.x - cw / 2).toFixed(1)}px`; d.style.top = `${(p.y - ch / 2).toFixed(1)}px`;
      d.style.width = `${cw}px`; d.style.height = `${ch}px`;
    });
  }

  function aplicar(f, mostra, x, tau) {
    const s = f.s;
    if (!mostra) { if (!s.hidden) { s.hidden = true; s.classList.remove('cheia'); } return; }
    if (s.hidden) { s.hidden = false; f.tam = null; }
    layout(f);
    if (reduz()) { s.style.transform = 'none'; s.style.opacity = String(Math.max(0, Math.min(1, 1 - Math.abs(x)))); }
    else { s.style.transform = `translate3d(${(x * 110).toFixed(2)}%, 0, 0)`; s.style.opacity = '1'; }
    // cartas em cascata (40 ms entre uma e outra, do goleiro ao ataque) enquanto a folha entra
    f.cartas.forEach((d, i) => {
      const k = tau == null ? 1 : entrada((tau - 0.12 - i * 0.04) / 0.32);
      const o = reduz() ? 1 : k;
      d.style.opacity = o.toFixed(3);
      d.style.transform = o >= 1 ? '' : `translate3d(0, ${((1 - o) * 14).toFixed(1)}px, 0)`;
    });
  }

  return {
    estado,
    /** Monta as duas folhas com os times da partida (m.times: só leitura). */
    montar(times) { folhas.forEach((f, t) => montarFolha(f, times[t])); },
    /**
     * Mostra pelo estado do roteiro: e = {time, entrando, saindo, saiTime, cheia, tau, tauSai}. A que entra vem da
     * esquerda (−110% → 0); a que sai vai para a direita (0 → 110%).
     */
    mostrar(e) {
      const tam = `${window.innerWidth}x${window.innerHeight}`;
      if (tam !== ultimoTam) { ultimoTam = tam; for (const f of folhas) f.tam = null; }
      for (const t of [0, 1]) {
        const f = folhas[t];
        if (e.time === t) aplicar(f, true, -(1 - entrada(e.entrando)), e.tau);
        else if (e.saiTime === t) aplicar(f, true, entrada(e.saindo), null);
        else aplicar(f, false);
        f.s.classList.toggle('cheia', e.cheia === t);
      }
      estado.visivel = e.time != null; estado.time = e.time; estado.cheia = e.cheia;
    },
    esconder() {
      for (const f of folhas) aplicar(f, false);
      estado.visivel = false; estado.time = null; estado.cheia = null;
    },
    /** Cartas da folha do time t (testes): [{id, vaga, num, nome, pos, rect, fonteMin}]. */
    cartas(t) {
      return folhas[t].cartas.map(d => {
        const r = d.getBoundingClientRect();
        const fonte = Math.min(...[...d.children].map(c => parseFloat(getComputedStyle(c).fontSize)));
        const nome = d.querySelector('.pj-nome');
        return {
          id: +d.dataset.id, vaga: d.dataset.vaga, num: d.querySelector('.pj-num').textContent, nome: nome.textContent, pos: d.querySelector('.pj-pos').textContent,
          rect: { x: r.left, y: r.top, w: r.width, h: r.height }, fonteMin: fonte, cortado: nome.scrollWidth > nome.clientWidth + 1,
        };
      });
    },
    /** A folha do time t (testes: o retângulo da coluna e do campo). */
    folha(t) { return folhas[t].s; },
  };
}
