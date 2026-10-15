// Escudo dos times do Total Match nos desenhos em canvas (placas de LED, bandeirões, bandeira de mastro, placa da
// fachada). A imagem já vem DECODIFICADA (render/identidade-pagina.js prepara antes de criarCampo/criarTorcida: o
// canvas é desenhado uma vez só). Sem imagem, nada é desenhado (quem chama desenha a sigla no lugar).

/** A imagem do escudo do time t na identidade (ou null). */
export function imagemEscudo(ident, t) {
  const img = ident && ident.times && ident.times[t] && ident.times[t].escudo ? ident.times[t].escudo.img : null;
  if (!img) return null;
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  return w > 0 && h > 0 ? img : null;
}

/** Desenha `img` dentro da caixa (x, y, w, h) sem deformar (centrada). Devolve false se não deu. */
export function desenharEscudo(g, img, x, y, w, h) {
  if (!img) return false;
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  if (!(iw > 0 && ih > 0)) return false;
  const k = Math.min(w / iw, h / ih), dw = iw * k, dh = ih * k;
  try { g.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); return true; } catch (_) { return false; }
}
