// Cenas das paradas (pedido do dono de 22/10: "a cena de pós jogo, e a cena de intervalo, as cenas de cartões, e os
// replays de faltas e jogadas passando na tela enquanto o jogo tá parado"; PLANO-CENAS.md §6). FORA do fecho do hash
// (tools/fecho-hash.mjs): nenhum módulo da simulação importa este arquivo, e o main.js também não — ele só é importado
// pelos módulos que chegam sob demanda (js/cena-atores.js, js/cena-cartao.js; main.js SOB.cenas). O REPLAY_PARADA (PR 1)
// mora no js/lances.js, que está no download inicial. Pesquisa e fontes em PESQUISA-CENAS-TV.md.

// ---------------------------------------------------------------- PR 2 — cartão (porte da branch golaco/cenas-jogo)
/** Plano geral do estádio no intervalo e no fim (a torcida inteira no quadro, também no celular): o último plano das cenas de fim de tempo (PR 3/4). */
export const CAMERA_GERAL = { de: [0, 34, 78], para: [0, 3, -16], fov: 31 };

export const CENAS = {
  ligadas: true,              // padrão ("Cenas" no Modo de jogo; ?cenas=0|1; desligadas com webdriver, ?prints=1 e ?demo=1;
                              // no online o cartão e o intervalo ficam fora — só o ícone e a faixa de hoje —, e o pós-jogo
                              // entra sem segurar no PR 4: PLANO-CENAS.md R22)
  pularDepois: 0.5,           // s — antes disso nenhum aperto pula (o mesmo da comemoração e da substituição)
  separacao: 0.5,             // m entre os centros dos corpos (a mesma da comemoração)
  parado: 12,                 // ticks parado e plantado para ficar fixo (respirando, sem custo de locomoção)
  respira: { sobe: 0.01, lado: 0.012 },          // m — o peito sobe e desce e o peso passa de um pé para o outro
  lente: 2.5,                 // m — ninguém mais perto que isto da câmera
  bola: 0.75,                 // m — ninguém chega mais perto que isto do centro da bola parada (a do mundo, que a página
                              // desenha no lugar do apito): quem começou mais perto fica no máximo onde estava (nunca por cima)
  camLimite: 5.5,             // m além das linhas (a mesma regra da comemoração)
  // árbitro e assistentes (cortejo.js: 200, 201, 202; o quarto árbitro, 203, só na substituição)
  idArbitro: 200, idAssistentes: [201, 202],
  assistentes: [[26, -34.5], [-26, 34.5]],      // um em cada metade, na linha lateral
  tunel: { x: 0, z: 44.5 },   // a boca do túnel (config.js ESTADIO.tunel)
  // tarja de identificação do jogador com cartão — DFL International Rundown (Bayern × Union, 26/02/2023): "identificação
  // do jogador com cartão", 6 s. Aqui ela entra com o cartão no alto e sai COM a cena (nunca por cima da bola rolando: o
  // H2 do teste-hud-minimo cobra 0 caractere fora do placar no jogo; PLANO-CENAS.md R10), no máximo `tarja` s
  tarja: 6,
};

export const CENA_CARTAO = {
  // o árbitro: começa a 6–8 m do punido (do lado da bola ou do centro), anda invisível (pré-rolagem) até faltar
  // `preRolagem` m para o ponto onde para (2,0–2,8 m do punido, de frente: "reasonable distance", US Soccer Guide to
  // Procedures p. 38) e ergue o cartão acima da cabeça
  arbitro: { distIni: [6, 8], vel: 5.5, velForte: 6.5, para: [2.0, 2.8], preRolagem: 2.6, freio: 4.2 },
  tira: 0.55, tiraDur: 0.4,   // s — a mão vai ao bolso (amarelo: o da frente da camisa; vermelho: o de trás do calção)
  alto: 1.3,                  // s com o cartão no alto (braço reto acima da cabeça)
  segundo: { alto1: 1.0, guarda: 0.35, alto2: 1.2 },  // 2º amarelo: o amarelo 1,0 s → guarda → o vermelho 1,2 s
  anota: 0.8,                 // s — o árbitro anota (amarelo)
  ombroSobe: 0.075,           // m — o ombro sobe com o braço reto no alto (elevação da escápula)
  // planos (s): amarelo 5,45 s (a proposta da pesquisa: 4–6 s); vermelho 8,9 s; 2º amarelo 9,9 s (proposta: 8–10 s). FC 26:
  // as cenas "gastam segundos" → curtas, puláveis e com opção de desligar. O cartão no alto cabe no plano do árbitro
  // (§3.6 A: ≥ 1,0 s nele): o vermelho direto sobe aos 0,95 s (o plano até 2,0 s); no 2º amarelo o vermelho sobe aos 2,7 s
  // e desce aos 3,9 s (o plano até 4,0 s — com 2,9 s ele caía quase todo na reação, que no celular não o mostrava); a
  // reação, a saída e o túnel do 2º amarelo encurtam para a cena seguir com 9,9 s
  planos: {
    amarelo: [['arbitro', 1.95], ['reacao', 2.5], ['anota', 1.0]],
    vermelho: [['arbitro', 2.0], ['reacao', 2.4], ['saida', 1.5], ['tunel', 2.0], ['torcida', 1.0]],
    segundo: [['arbitro', 4.0], ['reacao', 2.4], ['saida', 1.1], ['tunel', 1.4], ['torcida', 1.0]],
  },
  // s — a vantagem que virou gol: os jogadores, voltando correndo para a saída no gol + 149, freiam fora do quadro (a ELIPSE
  // do corte depois da comemoração) antes do 1º plano; acaba antes se todos pararam
  assentar: 2.0,
  companheiro: 15,            // m — A1, A2, V1 e V2 precisam de um companheiro até aqui
  apoioPerto: 6,              // m — o companheiro mais longe que isto já vem correndo (pré-rolagem invisível)
  ifab: 4,                    // m — só o capitão e o punido mais perto do árbitro ("só o capitão": UEFA EURO 2024, PL 2025-26)
  afasta: 5.4,                // m — os outros vão para esta distância do árbitro (A1, V2: o árbitro isola o jogador com o braço
                              // estendido — NISOA, askasoccerreferee); 3,6 nas outras
  afastaLeve: 3.6,
  velAfasta: 2.8,
  // reações (m/s, m, s)
  a1: { passos: 1.3, vel: 1.1, capitao: 0.95, vCap: 3.4 },
  a2: { vel: 1.0, anda: 2.6, giro: 2.4 },
  a3: { desculpa: 0.8, vel: 3.6 },
  v1: { vel: 1.0 },
  v2: { avanca: 1.7, vel: 1.4, recua: 1.0, vSai: 1.3 },
  v3: { vel: 1.1 },
  saida: { vel: 1.2 },
  // elipse do túnel (Lei 12: o expulso deixa as imediações do campo): ele aparece a 10–13 m da boca, fora do campo ou a
  // ≤ 3 m da linha
  tunel: { dist: [10.5, 13], cam: { x: 6.5, y: 1.6, z: 38.3 } },
  camera: {
    arbitro: { dist: 8, altura: 1.5, fov: 31, ang: 0.36, olharY: 1.12, pesoArbitro: 0.6 },
    reacao3: { dist: 7, altura: 1.55, fov: 36 },     // plano de três (A1, V2)
    frente: { dist: 4.8, altura: 1.25, olharY: 0.92, fov: 30 },     // de frente para o rosto (A2, V1, V3): o corpo inteiro
    steadicam: { frente: 6, lado: 2.4, altura: 1.6, olharY: 1.0, fov: 32 }, // A3 (como a da comemoração)
    anota: { dist: 11, altura: 2.2, fov: 30 },
    saida: { atras: 1.2, lado: 5.2, altura: 1.6, fov: 32 },   // de lado, um pouco atrás, andando com ele
    tunel: { fov: 34 },
  },
};
