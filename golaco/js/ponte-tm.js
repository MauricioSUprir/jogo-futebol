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

/**
 * Semente da partida pelo id do TM (FNV-1a de 32 bits; 1 a 999 999): cada partida do TM é outro jogo (sem ?semente, a
 * página usaria sempre a 1 — o "Simular o resto" dos mesmos times dava sempre o mesmo placar). Pura.
 */
export function sementeTM(id) {
  let h = 0x811c9dc5;
  for (const c of String(id ?? '')) { h ^= c.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return (h % 999999) + 1;
}

/** A página está dentro do quadro do TM (iframe)? Fora dele (aba solta, testes), o fim volta para o TM (../index.html). */
export const NO_QUADRO = (() => { try { return window.parent !== window; } catch (_) { return true; } })();

/** As mensagens mandadas ao TM (na ordem; os testes conferem por aqui quando não há quadro pai). */
export const MENSAGENS = [];

/** Manda {tipo, id, ...extra} ao TM (window.parent, mesma origem). Sem ?tm, nada. */
export function avisarTM(tipo, extra = {}) {
  if (!ID_TM) return false;
  const msg = { tipo, id: ID_TM, ...extra };
  MENSAGENS.push(msg);
  try { if (NO_QUADRO && window.parent) window.parent.postMessage(msg, location.origin); } catch (_) { /* o quadro pai sumiu */ }
  return true;
}

/** Grava o resultado em localStorage["tm3d:resultado:<id>"] (o TM lê de lá se a mensagem se perder). */
export function gravarResultadoTM(resultado) {
  if (!ID_TM) return false;
  try { localStorage.setItem('tm3d:resultado:' + ID_TM, JSON.stringify(resultado)); return true; } catch (_) { return false; }
}

/** Volta ao Total Match (aba solta: a página do TM, uma pasta acima do jogo). */
function voltarAoTM() {
  try { location.href = new URL('../index.html', location.href).href; } catch (_) { /* sem location: nada */ }
}

/** Fim da partida: grava o resultado, manda 'tm3d:fim' com ele e, fora do quadro, volta para o TM. */
export function fimTM(resultado) {
  if (!ID_TM) return false;
  gravarResultadoTM(resultado);
  avisarTM('tm3d:fim', { resultado });
  if (!NO_QUADRO) voltarAoTM();
  return true;
}

/** O 3D não roda aqui (sem WebGL 2, pedido inválido): 'tm3d:sair' (o TM simula a partida do começo). */
export function sairTM() {
  if (!ID_TM) return false;
  avisarTM('tm3d:sair');
  if (!NO_QUADRO) voltarAoTM();
  return true;
}
