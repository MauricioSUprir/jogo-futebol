// Disputa de pênaltis — a tela (DOM; só no modo Pênaltis, importada sob demanda pelo main.js: fora do download do jogo
// sem ?modo=penaltis). Lê o mundo (m.disputa) e desenha, logo abaixo do placar:
//  - as bolinhas de cada time (convertido: verde; perdido: vermelho com um traço; a bater: vazia; a da vez pisca), 5 por
//    time e, nas alternadas, uma a mais por rodada (as últimas 7 quando passa disso);
//  - quem bate agora (número e nome, na cor do time).
// E as classes do <html>: modo-penaltis (nenhum botão de toque além do CHUTE), penaltis-bate (a cobrança do humano montada:
// o CHUTE aparece) e penaltis-defende (o humano defende: só o analógico). As cores são as da página (var(--verde)...: com ?tm,
// as do Total Match). Escreve no DOM só quando muda. Nada aqui mexe no mundo.

const CSS = `
.disputa { position: absolute; left: calc(var(--sa-l) + var(--m)); top: calc(var(--sa-t) + var(--m) + var(--placar-h) + 5px);
  display: grid; gap: 3px; padding: 5px 7px 6px; pointer-events: none; z-index: 1;
  background: rgba(7, 9, 10, 0.78); border: 1px solid var(--linha); border-radius: 6px; box-shadow: 0 1px 6px rgba(0, 0, 0, 0.35);
  font: 800 11px/1 var(--fonte); color: var(--texto); white-space: nowrap; }
.disputa[hidden] { display: none; }
.disputa-linha { display: flex; align-items: center; gap: 6px; height: 13px; }
.disputa-sigla { display: flex; align-items: center; gap: 4px; min-width: 34px; letter-spacing: 0.03em; }
.disputa-sigla i { display: block; width: 3px; height: 11px; border-radius: 1px; background: var(--cor-time, var(--verde)); }
.disputa-bolas { display: flex; gap: 4px; }
.disputa-bola { position: relative; display: block; width: 11px; height: 11px; border-radius: 50%; box-sizing: border-box;
  border: 1.5px solid rgba(234, 243, 238, 0.42); background: transparent; }
.disputa-bola.gol { background: var(--verde); border-color: var(--verde); }
.disputa-bola.erro { background: #e5484d; border-color: #e5484d; }
.disputa-bola.erro::after { content: ''; position: absolute; left: 1.5px; right: 1.5px; top: 3.25px; height: 1.5px; background: rgba(7, 9, 10, 0.85); border-radius: 1px; }
.disputa-bola.vez { border-color: var(--texto); animation: disputa-vez 1s ease-in-out infinite; }
@keyframes disputa-vez { 0%, 100% { box-shadow: 0 0 0 0 rgba(234, 243, 238, 0.55); } 50% { box-shadow: 0 0 0 3px rgba(234, 243, 238, 0); } }
.disputa-mais { font-size: 10px; color: var(--texto-2); }
.disputa-vez { display: flex; align-items: center; gap: 5px; margin-top: 2px; height: 14px; font-size: 11px; font-weight: 700; color: var(--texto-2); }
.disputa-vez b { font-weight: 900; color: var(--texto); }
.disputa-vez i { display: block; width: 3px; height: 11px; border-radius: 1px; background: var(--cor-time, var(--verde)); }
.disputa-vez[hidden] { display: none; }
@media (min-width: 1001px) { .disputa { font-size: 12px; } .disputa-bola { width: 12px; height: 12px; } .disputa-linha { height: 14px; } }
@media (prefers-reduced-motion: reduce) { .disputa-bola.vez { animation: none; box-shadow: 0 0 0 2px rgba(234, 243, 238, 0.5); } }
/* botões de toque na disputa: só o CHUTE quando o humano bate (a fase de ataque do jogo já o mostra); defendendo, nenhum */
html.modo-penaltis .toque .btn-toque:not(#btn-chute) { display: none !important; }
html.modo-penaltis:not(.penaltis-bate) .toque #btn-chute { display: none !important; }
html.modo-penaltis .dica { display: none; }
/* os avisos (as dicas da vez) descem para baixo das bolinhas: no celular o aviso largo passava por cima delas */
html.modo-penaltis .aviso { top: calc(var(--sa-t) + var(--m) + var(--placar-h) + 74px); }
/* o minimapa não diz nada na disputa (todos parados, a câmera atrás do cobrador) e tapava a bola na marca */
html.modo-penaltis .minimapa { display: none !important; }
`;

const JANELA = 7; // bolinhas visíveis por time (as alternadas longas mostram as últimas)

/**
 * opc = {raiz (onde o painel entra; padrão #hud), times: () => [{sigla, nome, cor?}] (os do placar), nome: id → {num, nome}}.
 * Devolve {atualizar(m, timeHumano), limpar(), estado()}.
 */
export function criarTelaDisputa(opc = {}) {
  const doc = document;
  if (!doc.getElementById('disputa-estilo')) {
    const st = doc.createElement('style');
    st.id = 'disputa-estilo';
    st.textContent = CSS;
    doc.head.appendChild(st);
  }
  const raiz = opc.raiz ?? doc.getElementById('hud') ?? doc.body;
  let el = doc.getElementById('disputa');
  if (!el) {
    el = doc.createElement('div');
    el.id = 'disputa';
    el.className = 'disputa';
    el.dataset.caixa = 'disputa';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = '<div class="disputa-linha" data-time="0"><span class="disputa-sigla"><i></i><span></span></span><span class="disputa-bolas"></span></div>'
      + '<div class="disputa-linha" data-time="1"><span class="disputa-sigla"><i></i><span></span></span><span class="disputa-bolas"></span></div>'
      + '<div class="disputa-vez" hidden><i></i><span class="disputa-vez-rot">Bate:</span><b></b><span class="disputa-vez-nome"></span></div>';
    raiz.appendChild(el);
  }
  const linhas = [0, 1].map(t => el.querySelector(`.disputa-linha[data-time="${t}"]`));
  const vezEl = el.querySelector('.disputa-vez');
  let chave = '';
  const html = doc.documentElement;

  function corDe(t) {
    const ts = opc.times?.() ?? null;
    return ts?.[t]?.cor ?? (t === 0 ? 'var(--verde)' : '#e7eaec');
  }

  return {
    /** Um quadro: escreve só o que mudou. */
    atualizar(m, timeHumano = 0) {
      const D = m?.disputa;
      if (!D) { this.limpar(); return; }
      el.hidden = false;
      const vivo = D.estado === 'caminhada' || D.estado === 'cobranca' || D.estado === 'chute';
      // o CHUTE só com a cobrança dele montada (na caminhada, no chute e na reação ele assiste)
      html.classList.add('modo-penaltis');
      html.classList.toggle('penaltis-bate', D.estado === 'cobranca' && D.vez === timeHumano);
      html.classList.toggle('penaltis-defende', vivo && D.vez !== timeHumano);
      const k = `${D.cobrancas.length}|${D.estado}|${D.vez}|${D.cobrador}|${vivo}`;
      if (k === chave) return;
      chave = k;
      const ts = opc.times?.() ?? [{ sigla: 'CAS' }, { sigla: 'VIS' }];
      const rodadas = Math.max(5, D.chutes[0], D.chutes[1], vivo ? D.chutes[D.vez] + 1 : 0);
      const ini = Math.max(0, rodadas - JANELA);
      for (const t of [0, 1]) {
        const L = linhas[t];
        L.style.setProperty('--cor-time', corDe(t));
        L.querySelector('.disputa-sigla span').textContent = ts[t]?.sigla ?? '';
        const res = D.cobrancas.filter(c => c.time === t).map(c => c.resultado);
        const bolas = L.querySelector('.disputa-bolas');
        let h = ini > 0 ? '<span class="disputa-mais">+' + ini + '</span>' : '';
        for (let i = ini; i < rodadas; i++) {
          const r = res[i];
          const cls = r === 'gol' ? ' gol' : r ? ' erro' : vivo && t === D.vez && i === D.chutes[t] ? ' vez' : '';
          h += `<i class="disputa-bola${cls}"></i>`;
        }
        bolas.innerHTML = h;
        const g = res.filter(r => r === 'gol').length;
        L.setAttribute('aria-label', `${ts[t]?.nome ?? ts[t]?.sigla ?? ''}: ${g} de ${res.length}`);
      }
      if (vivo && D.cobrador != null) {
        const q = opc.nome?.(D.cobrador) ?? null;
        vezEl.hidden = false;
        vezEl.style.setProperty('--cor-time', corDe(D.vez));
        vezEl.querySelector('b').textContent = q?.num != null ? String(q.num) : '';
        vezEl.querySelector('.disputa-vez-nome').textContent = q?.nome ?? '';
      } else vezEl.hidden = true;
    },
    /** Sai da disputa (outro modo): o painel e as classes somem. */
    limpar() {
      el.hidden = true;
      chave = '';
      html.classList.remove('modo-penaltis', 'penaltis-bate', 'penaltis-defende');
    },
    /** Para os testes: as bolinhas como texto ('g' convertido, 'x' perdido, 'o' a bater, '*' a da vez) e quem bate. */
    estado() {
      const lin = linhas.map(L => [...L.querySelectorAll('.disputa-bola')].map(b => b.classList.contains('gol') ? 'g' : b.classList.contains('erro') ? 'x' : b.classList.contains('vez') ? '*' : 'o').join(''));
      return { visivel: !el.hidden, linhas: lin, vez: vezEl.hidden ? null : vezEl.textContent.replace(/\s+/g, ' ').trim(), caixa: el.getBoundingClientRect().toJSON?.() ?? null };
    },
  };
}
