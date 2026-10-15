// GOLAÇO como motor 3D do Total Match (?tm=<id>; js/ponte-tm.js): a CARA DO TOTAL MATCH na página (dono: "deixa os
// botões, menu, tudo com a cara do total match"). O visual é todo do css/tm.css (regras sob html.tm); aqui só o que o CSS
// não alcança:
//   - os textos com o nome do jogo: título da aba, cor da barra do navegador, ícone, a marca do carregamento (na tela vira
//     a logo pelo CSS; o texto fica para o leitor de tela) e o "Gire o celular";
//   - a Inter do TM ('Inter TM', assets/tm/fontes): pedida já (o canvas que mede os nomes dos botões não pede fonte
//     nenhuma) e, quando chega, o aviso 'tm:fontes' na window — a página mede de novo os nomes dos botões de toque
//     (entrada.js mede pelo canvas) e o topo do HUD (hud.js ajustarTopo). <html data-fontes-tm="ok|falhou"> para os testes.
// Só é baixado com ?tm: o <script> do <head> do index.html põe html.tm e importa este arquivo. Sem ?tm nada daqui existe.
// Página (DOM); nada aqui chega ao mundo (hash igual).

export const FONTE_TM = 'Inter TM';
const PESOS = [400, 600, 700, 800, 900];
const TEXTO_GIRAR = 'A partida do Total Match só roda com o celular deitado.';

/** Os textos com o nome do jogo trocados pelo Total Match (só o que está no index.html; a abertura do pré-jogo é do prejogo-tela.js). */
export function trocarTextos(doc = document) {
  doc.title = 'Total Match — partida 3D';
  const cor = doc.querySelector('meta[name="theme-color"]');
  if (cor) cor.setAttribute('content', '#050807');
  const icone = doc.querySelector('link[rel="icon"]');
  if (icone) icone.setAttribute('href', 'assets/tm/simbolo.png');
  const marca = doc.querySelector('.carregando-marca');
  if (marca) marca.textContent = 'Total Match';
  const girar = doc.getElementById('girar-texto');
  if (girar) girar.textContent = TEXTO_GIRAR;
}

/** A folha css/tm.css já lida (as @font-face estão nela)? Espera o load dela se ainda não. */
function folhaPronta(doc = document) {
  const link = [...doc.querySelectorAll('link[rel="stylesheet"]')].find(l => /(^|\/)css\/tm\.css(\?|$)/.test(l.getAttribute('href') || ''));
  if (!link || link.sheet) return Promise.resolve();
  return new Promise(ok => {
    link.addEventListener('load', ok, { once: true });
    link.addEventListener('error', ok, { once: true });
  });
}

/** Pede os pesos da Inter do TM e avisa a página ('tm:fontes') quando chegarem (ou falharem: a página fica na do sistema). */
export async function carregarFontes(doc = document, win = window) {
  let ok = false;
  try {
    await folhaPronta(doc);
    if (doc.fonts && typeof doc.fonts.load === 'function') {
      const r = await Promise.all(PESOS.map(p => doc.fonts.load(`${p} 16px "${FONTE_TM}"`, 'Placar 0123 ÇÃÉ')));
      ok = r.every(lista => lista.length > 0);
    }
  } catch (_) { ok = false; }
  doc.documentElement.dataset.fontesTm = ok ? 'ok' : 'falhou';
  // com ou sem a fonte: a medida do 1º layout pode ter sido com a reserva — mede de novo
  try { win.dispatchEvent(new Event('tm:fontes')); } catch (_) { /* sem window: nada */ }
  return ok;
}

/** Liga a cara do TM (chamado na importação). */
function ligar() {
  if (!document.documentElement.classList.contains('tm')) return;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => trocarTextos(), { once: true });
  else trocarTextos();
  carregarFontes();
}
ligar();
