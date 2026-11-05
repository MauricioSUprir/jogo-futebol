// Fotos dos jogadores do pedido do Total Match (item 31: o cartão do autor na comemoração e as fichas da tela antes do jogo).
// SÓ da edição pro ("Season Update"), lidas do PRÓPRIO pedido pelo LADO + tmId — o tm-times.js (do fecho do hash) copia campos
// explícitos e não vê o campo `foto`: a foto nunca chega ao elenco nem ao mundo. Pelo lado + tmId (e não pelo índice nem só pelo
// tmId): o travado do Rumo ao Estrelato reordena os jogadores (tm-times.js travadoTitular) e o mesmo tmId aparece nos DOIS lados
// no online com o mesmo clube e no Ultimate — o mesmo caminho do ligarRostosReais (main.js). Puro: sem DOM nem three.js (Node:
// teste-ponte-tm P10). Entra só por import() com ?tm na edição pro (main.js agendarFotosTM): nunca no download inicial.

export const FOTO = {
  /** teto de uma foto importada (data:), em caracteres — o mesmo do TM (legacy-total-match/js/tm3d.js FOTO_MAX) */
  dataMax: 48000,
};

const DATA_OK = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;

/**
 * O endereço aceito (normalizado) ou null: `data:image/(jpeg|png|webp);base64,…` até FOTO.dataMax caracteres, ou http(s)
 * ABSOLUTO da MESMA origem da página (o pedido do online vem de outro aparelho: um endereço de fora seria um rastreador).
 * Relativo, outro esquema (javascript:, blob:), SVG e qualquer coisa que não seja texto → null.
 */
export function fotoAceita(u, origem) {
  if (typeof u !== 'string' || !u) return null;
  if (/^data:/i.test(u)) return u.length <= FOTO.dataMax && DATA_OK.test(u) ? u : null;
  let url;
  try { url = new URL(u); } catch (_) { return null; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (typeof origem !== 'string' || url.origin !== origem) return null;
  return url.href;
}

/**
 * Map<id do mundo, endereço> das fotos aceitas — vazio fora da edição pro. mapa = TM.mapa do tm-times.js (id → {tmId, nome,
 * lado}); origem = location.origin da página.
 */
export function fotosDoPedido(pedido, mapa, origem) {
  const out = new Map();
  if (!pedido || pedido.edicao !== 'pro' || !mapa) return out;
  for (const [id, e] of Object.entries(mapa)) {
    if (!e || e.tmId == null) continue;
    const t = e.lado === 1 ? pedido.away : pedido.home;
    const ps = Array.isArray(t?.players) ? t.players : [];
    const p = ps.find(q => q && q.tmId === e.tmId);
    const u = fotoAceita(p?.foto, origem);
    if (u) out.set(+id, u);
  }
  return out;
}
