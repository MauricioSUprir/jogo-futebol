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
  esperaIfab: 0.8,            // s — no máximo, a pré-rolagem invisível de quem sai de perto do ponto do árbitro (A1, V2)
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

// ---------------------------------------------------------------- PR 3 — o guardador de lances (render/lances-guarda.js)
// Os lances da partida (gols e paradas A/B de js/lances.js) guardados para o intervalo ("lances do 1º tempo") e o fim
// ("Melhores momentos"): `lances` lances de no máximo `segundos` s a `hz` Hz, a pose em Int16 relativa ao x/z do jogador
// com a `escala` (1/4000 m: ±8,19 m, erro ≤ 0,13 mm — PLANO-CENAS.md R20: a 1/8000 o mergulho desenhado do goleiro ficava
// perto da borda) → ~0,58 MB por lance, ~3,5 MB fixos (o anel de 10 s tem 3,36 MB), alocados só na partida (main.js
// garantirGuarda: nunca nos treinos, onde a pré-carga também roda); a bola e o relógio de todo passo (60 Hz). A janela: [chave − `antes`, fim + `depois`] s (a do CENA_FIM.lances.tvAntes/
// depois), cortada a `segundos` pelo começo. O mini-anel de tocar: `mini` passos (6 s a 60 Hz) com as vagas/nj do anel, ~2 MB
export const LANCES_GUARDA = { lances: 6, segundos: 6, hz: 30, escala: 1 / 4000, mini: 360, antes: 2.5, depois: 0.5 };

// ---------------------------------------------------------------- PR 3 (e a interface do PR 4) — intervalo e pós-jogo
// (js/cena-fim.js; PLANO-CENAS.md §4 e §5, contrato "Cenas das paradas" §7.3). Pesquisa em PESQUISA-CENAS-TV.md.
export const CENA_FIM = {
  planos: {
    // intervalo (18–30 s): os planos de campo (9 s) ≈ DFL 1:00 de "jogadores saindo / autores / técnicos / clima" ÷ 11,25 (o
    // relógio do jogo) ≈ 5,3 s, arredondado para caber o túnel; depois os blocos de tela — 'lances' (0 s no relógio da cena:
    // a cena ESPERA ali enquanto a página toca 0–2 lances do guardador pelo diretor do replay) e 'estatisticas' — e o 'geral'
    // com o laço SOLTO (os 3 s de PARTIDA.intervalo correm por baixo; a 'saida' acaba a cena)
    intervalo: [['apito', 1.5], ['campo', 2.5], ['tunel', 3.5], ['torcida', 1.5], ['lances', 0], ['estatisticas', 6.0], ['geral', 3.0]],
    // fim (PR 4; PLANO-CENAS.md §5.1): os planos de campo (15,5 s) ≈ DFL 2:30 de campo ÷ 11,25 = 13,3 s; + 'troca' (1,5 s, a
    // troca de camisa — um plano só dela, depois de uma ELIPSE: 2,0 s de cumprimentos não cabiam o aperto de mão E o par
    // trocado) quando há o par; os blocos de tela (melhor em campo, placar, estatísticas) mantêm o tempo de leitura (não
    // encolhem com o relógio do jogo). Automático: vitória 34,5 s (36 com a troca), empate 32 s (33,5), sem os treinadores
    // −2 s, no TM sem as estatísticas −6 s
    vitoria: [['apito', 1.5], ['vencedor', 3.0], ['perdedor', 2.5], ['cumprimentos', 2.0], ['troca', 1.5], ['treinador', 2.0], ['aplauso', 2.5], ['torcida', 2.0], ['melhor', 5.0], ['placar', 8.0], ['estatisticas', 6.0], ['geral', 0]],
    empate: [['apito', 1.5], ['neutro', 3.0], ['cumprimentos', 2.0], ['troca', 1.5], ['treinador', 2.0], ['aplauso', 2.5], ['torcida', 2.0], ['melhor', 5.0], ['placar', 8.0], ['estatisticas', 6.0], ['geral', 0]],
    curto: [['apito', 1.5], ['neutro', 3.0], ['torcida', 2.0], ['placar', 8.0], ['geral', 0]],   // TM: o empate que continua (14,5 s)
  },
  // a tarja do placar com os autores (js/cenas-tela.js): DFL — +20 s do apito, 8 s, no intervalo e no fim (o atraso de campo
  // ÷ 11,25 ≈ 1,8 s; aqui depois dos dois primeiros planos, para não cobrir os jogadores); a leitura não encolhe com o relógio
  // do jogo. Conta no relógio da CENA (parado enquanto um lance do guardador toca: no replay ela some)
  placar: { entra: 4.0, dura: 8.0 },
  autores: true,              // false = a tarja só com o placar (PLANO-CENAS.md §9.1: a regra "GOL! sem autor nem minuto" é do
                              // lance ao vivo, não da tarja de transmissão)
  // estatísticas: wTVision — "os melhores gráficos escolhem os números que explicam a fase do jogo"; 6 s = o gráfico de evento
  // da DFL. Só rótulos e números (sem frase)
  estatisticas: { dura: 6.0, itens: ['posse', 'chutes', 'noAlvo', 'escanteios', 'faltas', 'cartoes'] },
  // lances do guardador (render/lances-guarda.js escolherLances; a janela de cada um: LANCES_GUARDA.antes/depois): no
  // intervalo até 2 (os gols do tempo primeiro, depois a parada A/B mais forte); "Melhores momentos" no fim até 6 e ≤ 30 s
  // (EA FC 25: replay dos gols no pós-jogo; FC 24: introduções longas cortadas porque a maioria pulava → no fim é botão)
  lances: { intervalo: 2, fim: 6, fimMax: 30 },
  // PR 4 — o MELHOR EM CAMPO (Premier League: o voto da torcida no apito; Globo: o "Craque do Jogo" no gramado logo depois
  // do jogo): ELIPSE — ele em pé num lugar livre do lado da TV (`x` m do meio para o lado do time da pessoa, `z`), de frente
  // para a câmera um pouco virado para a torcida, batendo palmas (`palmas` s) e depois o braço erguido para ela; quem
  // estiver a menos de `livre` m dele reaparece no meio-campo. A tarja (js/cenas-tela.js): número, nome, "Melhor em campo"
  // e a nota com uma casa — a do resultado do TM (sumula.js notaDe)
  melhor: { dura: 5.0, x: 18, z: 12, livre: 7, palmas: 3.0, vira: 0.45 },
  // PR 4 — a TROCA DE CAMISA (costume do fim de jogo; nenhuma regra proíbe): 1 par de adversários de linha (nunca goleiro,
  // expulso, quem aperta a mão no plano dos cumprimentos nem o melhor em campo) sorteado pelo hash do jogo (sem m.rng); na
  // ELIPSE do plano 'troca' os dois aparecem lado a lado (`lado` m entre os centros), abraçados (o braço de dentro nas
  // costas do outro), andando para a câmera a `vel` m/s, cada um com a camisa do outro (o kit misto: camisa — com o
  // patrocínio dela na versão de teste — do adversário, calção e meião próprios; render/jogador3d.js e humano3d.js, sem
  // chamada a mais) até o fim da cena. `x`/`z`: onde aparecem (o lado de x pelo hash)
  troca: { pares: 1, x: 7, z: 13, lado: 0.56, vel: 1.05 },
  // PR 4 — os TREINADORES se cumprimentam (o plano 'treinador'; só com o gancho tecnicos.js): ELIPSE — os dois entre as
  // áreas técnicas, na frente do túnel (x = ±`x`, `z`), andando um para o outro e apertando a mão (sem o outro, o do
  // vencedor comemora sozinho na área técnica)
  treinadores: { x: 1.25, z: 36.4, vel: 1.2 },
  // (da branch golaco/cenas-jogo) atores
  velAnda: 1.4,               // m/s — os pares caminham para o aperto de mão
  lenteLivre: 4.6,            // m — quem não é do plano sai de perto da câmera (os closes têm a lente fechada)
  lenteDura: 3.3,             // m — PR 4: no fim nem o assunto do plano chega mais perto que isso da lente (sai de lado)
  // (no intervalo só os pares ao ALCANCE: a distância entre os pontos onde cada um para ≤ maxDistIntervalo m, andando um para
  // o outro a velAnda desde tIntervalo s — o aperto de 1 s acaba antes do túnel, aos 4 s; sem a folga: o par mais longe
  // sairia andando no corte)
  aperto: { dist: 0.92, altura: 1.06, pares: 6, maxDist: 6, maxDistFolga: 14, maxDistIntervalo: 4.8, tIntervalo: 0.6, sacode: 2.4, amp: 0.035 },
  cintura: 0.62,              // fração com as mãos na cintura no 'campo' do intervalo / no 'neutro'
  joelhos: 2,                 // quantos com as mãos nos joelhos
  // a ELIPSE do túnel (intervalo): os 22 e o trio numa fila de `d` m da boca, andando para ela a `vel` m/s; quem chega à boca
  // (z ≥ entra) some dentro dela (a câmera fica do lado da boca, olhando o campo: eles passam por ela). O resto é cortado
  // pela elipse seguinte (a torcida): o campo fica vazio no 'geral'
  funil: { d: [2.6, 22], vel: [1.3, 1.5], entra: 44.0 },
  aplauso: { d: [8, 10], z0: 7.2, zMeio: 12.5 },    // PR 4 — a elipse do aplauso à torcida, ao lado do gol
  // a bola da cena (a cópia do mundo andando pela física): bate no corpo de quem está a `bola.raio` m do centro dele e
  // volta com `bola.volta` da velocidade (quem anda nela a toca para a frente) — nunca é ela quem empurra o jogador
  bola: { raio: 0.42, volta: 0.25 },
  // no corte do começo (o apito): quem vinha correndo para um sólido do estádio (o gol, as placas) e não pararia antes dele
  // recomeça `solidos.folga` m antes do ponto onde pararia, andando a velAnda (a freada pela locomoção: `solidos.freio` do
  // freio do jogador)
  solidos: { folga: 0.8, freio: 0.8, raio: 0.35 },
  // câmera
  camera: {
    apito: { altura: 16, recuo: 30, fov: 34 },
    campo: { dist: 13.5, altura: 2.4, fov: 34 },
    tunel: { x: 6.5, y: 1.6, z: 38.3, fov: 40 },
    grupo: { dist: 8, altura: 1.8, fov: 32 },
    close: { dist: 5.2, altura: 1.55, fov: 30 },
    aplauso: { atras: 9, altura: 1.8, fov: 40 },
    cumprimentos: { dist: 8.5, altura: 1.8, fov: 34 },
    treinador: { fov: 30, altura: 1.5 },
    // PR 4: os dois treinadores do campo (de lado, um pouco aberto); o par da troca de frente (andando para ela); o close
    // do melhor em campo (da cintura para cima: o rosto)
    treinadores: { x: 2.4, z: 31.2, altura: 1.6, fov: 32 },
    troca: { frente: 6.4, lado: 1.1, altura: 1.6, fov: 30 },
    melhor: { frente: 3.6, lado: 0.9, altura: 1.62, olhar: 1.38, fov: 25 },
  },
};
