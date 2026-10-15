// Ponte com o Total Match (TM): o GOLAÇO é o motor 3D das partidas do TM (mesmo site, mesmo armazenamento).
//   TM → localStorage["tm3d:pedido:<id>"] = { v, id, titulo, home, away, userSide, controle, partida }
//        e abre golaco/index.html?tm=<id> num quadro (iframe) por cima do TM
//   3D → window.parent.postMessage({ tipo: 'tm3d:pronto' | 'tm3d:fim' | 'tm3d:sair', id, resultado }, location.origin)
//        (o resultado também fica em localStorage["tm3d:resultado:<id>"], se a mensagem se perder)
// Lado do TM: legacy-total-match/js/tm3d.js. Sem ?tm na página, nada daqui é usado (PEDIDO_TM = null).
// Página (lê a URL e o localStorage): a lógica pura da conversão fica em tm-times.js e sumula.js.

function lerId() {
  try { return new URLSearchParams(location.search).get('tm') || null; } catch (_) { return null; }
}
function lerPedido(id) {
  if (!id) return null;
  try {
    const t = localStorage.getItem('tm3d:pedido:' + id);
    const p = t ? JSON.parse(t) : null;
    return p && p.home && p.away ? p : null;
  } catch (_) { return null; }
}

/** Id da partida do TM (?tm=<id>) ou null; e o pedido (ou null se não veio/sumiu). Lidos na importação. */
export const ID_TM = lerId();
export const PEDIDO_TM = lerPedido(ID_TM);
