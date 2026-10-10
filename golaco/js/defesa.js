// Botões de defesa do jogador do humano na partida (Etapa 3, Parte 4; plano 2.8): CONTER
// (segurar: acompanha o condutor entre a bola e o gol, de frente para ele), DIVIDIDA (borda: bote
// em pé, o pé sai na direção da bola) e PRESSÃO (segurar: um companheiro aperta o condutor).
// CARRINHO fica na Etapa 4 (precisa de falta e cartão). Pura: sem three.js nem DOM; só MD e m.rng.
//
// Ganchos em sim.js (valem também no treino, mas só agem com os bits CONTER/DIVIDIDA/PRESSÃO
// apertados ou com o estado j.defH ligado — nenhum roteiro do treino aperta esses bits):
//  - passo 1 (entradas), jogador controlado: entradaConter(m, j, e) → entrada que substitui a do
//    analógico (ou null = usa a do humano); pedidoPressao(m, j) com PRESSÃO segurado;
//  - passo 3 (desarmes), jogador controlado: dividida(m, j).
// Estado do humano na defesa: j.defH (null quando nada; ex.: o tempo sem reação depois de errar a
// dividida). Constantes em config.js DEFESA_HUMANO.
//
// ESQUELETO (Parte 0): entradaConter devolve null e dividida não faz nada; pedidoPressao já grava o
// contrato m.pedidoPressao[time] = tick (quem lê é a IA tática da Parte 2).

/** CONTER segurado: entrada {x, z, botoes} que leva o controlado a acompanhar o condutor, ou null. */
export function entradaConter(m, j, e) {
  return null;
}

/** DIVIDIDA (borda do botão): bote em pé do controlado. */
export function dividida(m, j) {
}

/** PRESSÃO segurado: pede à IA tática que o companheiro mais perto aperte o condutor. */
export function pedidoPressao(m, j) {
  (m.pedidoPressao ??= {})[j.time] = m.tick;
}
