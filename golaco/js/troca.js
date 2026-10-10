// Troca automática no jogo aéreo (Etapa 3, Parte 4; plano 3.5): com a bola no ar e sem dono, o
// controle do humano vai para quem do time vai disputar (o primeiro ponto da trajetória a que ele
// chega a tempo, com y ≤ alcance do salto), reavaliado no voo com histerese (pesquisa §7: reavaliar
// até 0,5 s antes acerta ~97%). Pura: sem three.js nem DOM. Constantes em config.js TROCA_AEREA.
//
// Ganchos em sim.js (só com m.times):
//  - trocaAerea(m) depois de trocarJogador (toda troca passa por assumirControle; evento
//    `trocaAerea {id}`);
//  - alvoAereo(m, j, e) na entrada do controlado: com ele sendo o disputante e o analógico solto
//    (|e| ≤ TROCA_AEREA.analogicoSolto), devolve a entrada que o leva ao ponto de queda; senão null.
//
// ESQUELETO (Parte 0): não trocam nem ajudam.

/** Reavalia quem do time humano disputa a bola alta e troca o controle se for o caso. */
export function trocaAerea(m) {
}

/** Assistência do controlado na bola alta: entrada {x, z, botoes} ou null (o analógico manda). */
export function alvoAereo(m, j, e) {
  return null;
}
