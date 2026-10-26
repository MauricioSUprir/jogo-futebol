// SUPERVELOCIDADE (dono, 26/10: "não dá pra passar a mais de 300 por hora, ajeite"): segurando CORRER numa linha quase reta,
// no chão, o EMBALO sobe (0 → 1 em ~3 s) e o teto da corrida vai de 58 m/s (~210 km/h) até 230 m/s (~830 km/h). Curva
// fechada, soltar o CORRER, vibrar, escalar ou um vilão em cena (as perseguições e as lutas continuam justas) derrubam o
// embalo. No embalo a corrida gasta menos energia (o raio alimenta). PURO: sem three.js nem DOM (testado em Node).
export const SUPER = { base: 58, max: 230, sobe: 0.34, cai: 1.4, curva: 0.42, curvaCai: 2.2, expoente: 1.6, economia: 0.6 };

/** o embalo (0..1) depois de dt segundos. angulo = entre a velocidade e a direção pedida (rad) */
export function passoEmbalo(e, { correndo, noChao, m, angulo = 0, bloqueado = false }, dt) {
  if (!correndo || bloqueado || m < 0.7) return Math.max(0, e - SUPER.cai * dt);
  if (angulo > SUPER.curva) return Math.max(0, e - SUPER.curvaCai * dt * (angulo / SUPER.curva));
  if (!noChao) return e;                                       // no ar (um pulo por cima de um carro) o embalo fica
  return Math.min(1, e + SUPER.sobe * dt);
}
/** o teto da corrida (m/s) para um embalo */
export const tetoCorrida = (e, base = SUPER.base) => base + (SUPER.max - base) * Math.pow(Math.max(0, Math.min(1, e)), SUPER.expoente);
/** fator do gasto de energia da corrida (1 parado no embalo zero; menos no embalo cheio) */
export const gastoCorrida = (e) => 1 - SUPER.economia * Math.max(0, Math.min(1, e));
