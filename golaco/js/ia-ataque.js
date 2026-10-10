// IA com a bola na partida (Etapa 3, Parte 3): apoio ao condutor (linhas de passe, largura e
// corredores), corridas nas costas da defesa com o impedimento como forma, ataque à área no
// cruzamento e a decisão do condutor por utilidade (ameaça esperada, xT). Pura: sem three.js nem
// DOM; só MD e m.rng. Plano 2.5 e 2.6; constantes em config.js IA_ATAQUE.
//
// Contrato com ia-tatica.js: ela chama estas funções com o time na fase 'com' (faseDoTime) e
// depois de tratar recebe / corrida / bola livre. Devolvem a ENTRADA VIRTUAL {x, z, botoes} (a mesma
// forma do ia.js, de preferência pelo para() com os modos) ou null — null = a IA clássica decide.
//
// ESQUELETO (Parte 0): devolvem null (a IA clássica joga com a bola até a Parte 3 entrar).

/** Jogador do time com a bola que não é o condutor: ponto de apoio, corrida ou ataque à área. */
export function apoioTatico(m, j) {
  return null;
}

/** O condutor (m.posse === j.id): passe/enfiada/lançamento, chute, cruzamento, conduzir ou proteger. */
export function condutorTatico(m, j) {
  return null;
}
