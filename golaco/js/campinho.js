// Campinho (as linhas do campo de 105 × 68 em SVG): o MESMO desenho no "Editar time" (editor-time.js) e na
// escalação do pré-jogo (escalacao-tela.js), e a posição de cada vaga nele (posicaoNaTela). Puro: devolve o viewBox e
// o conteúdo do <svg> (sem DOM). Deitado: gol à esquerda; em pé: gol embaixo. Traço fino que não escala (o CSS de
// quem usa põe o estilo).
import { CAMPO } from './config.js';

/** {viewBox, html} das linhas do campinho (vertical = em pé). */
export function svgCampinho(vertical) {
  const L = CAMPO.meioX * 2, A = CAMPO.meioZ * 2;
  const ar = 16.5, al = 40.32, pr = 5.5, pl = 18.32, rc = 9.15;
  if (!vertical) {
    return {
      viewBox: `0 0 ${L} ${A}`,
      html: `<rect x="0.5" y="0.5" width="${L - 1}" height="${A - 1}"/><line x1="${L / 2}" y1="0.5" x2="${L / 2}" y2="${A - 0.5}"/>`
        + `<ellipse cx="${L / 2}" cy="${A / 2}" rx="${rc}" ry="${rc}"/>`
        + `<rect x="0.5" y="${(A - al) / 2}" width="${ar}" height="${al}"/><rect x="${L - ar - 0.5}" y="${(A - al) / 2}" width="${ar}" height="${al}"/>`
        + `<rect x="0.5" y="${(A - pl) / 2}" width="${pr}" height="${pl}"/><rect x="${L - pr - 0.5}" y="${(A - pl) / 2}" width="${pr}" height="${pl}"/>`,
    };
  }
  return {
    viewBox: `0 0 ${A} ${L}`,
    html: `<rect x="0.5" y="0.5" width="${A - 1}" height="${L - 1}"/><line x1="0.5" y1="${L / 2}" x2="${A - 0.5}" y2="${L / 2}"/>`
      + `<ellipse cx="${A / 2}" cy="${L / 2}" rx="${rc}" ry="${rc}"/>`
      + `<rect x="${(A - al) / 2}" y="0.5" width="${al}" height="${ar}"/><rect x="${(A - al) / 2}" y="${L - ar - 0.5}" width="${al}" height="${ar}"/>`
      + `<rect x="${(A - pl) / 2}" y="0.5" width="${pl}" height="${pr}"/><rect x="${(A - pl) / 2}" y="${L - pr - 0.5}" width="${pl}" height="${pr}"/>`,
  };
}

/**
 * Posição (px, centro) de cada vaga no campinho de largura W × altura H para cartas cw × ch
 * (tela §5): deitado/PC na horizontal (gol à esquerda; col positivo embaixo = lado direito do time);
 * em pé na vertical (gol embaixo; col positivo à direita). Pura (o teste de layout pode chamar).
 */
export function posicaoNaTela(vaga, W, H, cw, ch, vertical) {
  const Wc = W - 12, Hc = H - 12;
  if (!vertical) return { x: 6 + cw / 2 + vaga.fila * (Wc - cw) / 4, y: 6 + ch / 2 + (vaga.col + 2) * (Hc - ch) / 4 };
  return { x: 6 + cw / 2 + (vaga.col + 2) * (Wc - cw) / 4, y: Hc + 6 - ch / 2 - vaga.fila * (Hc - ch) / 4 };
}
