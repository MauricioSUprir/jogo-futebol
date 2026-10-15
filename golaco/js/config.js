// GOLAÇO — todas as constantes do jogo num lugar só.
// Unidades SI (metros, segundos, quilos, radianos). Coordenadas: x = comprimento (±52,5),
// z = largura (±34), y para cima. Rumo h → direção (cos h, 0, sin h).
// Nada aqui depende de three.js nem do DOM.

export const VERSAO = '0.1.0';

// Simulação em passo fixo; o desenho é interpolado entre dois passos.
export const PASSO = 1 / 60;
export const SUBPASSOS_BOLA = 2;          // a bola integra a 120 Hz dentro de cada passo
export const MAX_PASSOS_POR_QUADRO = 5;   // limite contra a "espiral da morte"

export const G = 9.81;
export const AR = { densidade: 1.2 };

// Campo oficial (IFAB Lei 1) — 105 × 68 m.
export const CAMPO = {
  comprimento: 105,
  largura: 68,
  meioX: 52.5,
  meioZ: 34,
  linha: 0.12,                // largura das linhas
  raioCirculo: 9.15,
  area: { profundidade: 16.5, largura: 40.32 },
  pequenaArea: { profundidade: 5.5, largura: 18.32 },
  marcaPenalti: 11,
  raioArco: 9.15,
  raioEscanteio: 1,
  // Rede VÉU DE NOIVA (pedido do dono, 11/10; forma em rede-forma.js, a MESMA na física da bola, na regra do gol e no
  // desenho): hastes curtas nos cantos de cima seguram a faixa de cima (haste) e a rede cai em parábola tangente ao
  // chão até as estacas (fundo); segmentos = a polilinha da curva. Sem caixa nem teto. `profundidade` = a maior
  // profundidade da rede (o fundo, no chão) — a forma por altura é rede-forma.js profundidadeVeu(y).
  gol: { largura: 7.32, altura: 2.44, profundidade: 2.8, raioPoste: 0.06, veu: { haste: 0.45, fundo: 2.8, segmentos: 40 } },
  entorno: 6,                 // faixa de grama fora das linhas
};

// Bola (IFAB Lei 2: circunferência 68–70 cm, 410–450 g).
export const BOLA = {
  massa: 0.43,
  raio: 0.11,
  // Arrasto: Cd cai na "crise do arrasto" (Asai & Seo 2013; Passmore et al. 2012): ~0,45
  // até ~9 m/s, rampa até ~0,18 por volta de 15 m/s e patamar depois.
  cdBaixo: 0.45,              // abaixo de vCrise1
  cdAlto: 0.18,               // acima de vCrise2
  vCrise1: 9,
  vCrise2: 15,
  // Magnus: CL = magnusK * S (S = r·|ω|/|v|), limitado em clMax (Passmore 2012: CL 0,135
  // em S 0,2 a 20 m/s; satura em ~0,3–0,35).
  magnusK: 0.75,
  clMax: 0.33,
  // Acréscimo de C_D pelo giro (PESQUISA §1.1: +0,07 a +0,10 em Sp 0,25 e +0,10 a +0,13 em
  // Sp ≥ 0,5 — Goff & Carré 2009; Asai et al. 2007). Usa a ponta de cima da faixa, a mais
  // perto da falta medida em vídeo (Goff & Carré 2009). Rampa de 0 até Sp 0,25, depois até 0,5.
  cdGiro25: 0.10,
  cdGiro50: 0.13,
  giroPorMetro: 0.006,        // 1/m — o giro cai ~10% em 18 m de voo (Tsukada & Sakurai 2008)
  // Contato com a grama.
  restituicao: 0.62,          // coeficiente de restituição vertical no quique
  atritoQuique: 0.55,         // atrito de deslizamento no impacto
  // Restituição horizontal e_x do ponto de contato no quique (Cross 2002; PESQUISA §1.1:
  // +0,1 a +0,4 no seco). Com 0 a bola sai rolando pura (v_x2/v_x1 = 0,60) e o quique oblíquo
  // de 13,9 m/s a 25° devolve 60,4% — acima da faixa do ensaio FIFA (45–60%).
  restituicaoTangencial: 0.2,
  vQuiqueMin: 0.6,            // abaixo disso o quique vira rolagem
  // Rolagem: desaceleração cresce com a velocidade, dec = c·v^n + piso (ensaio FIFA "ball
  // roll" e portões EN 12234 / UEFA-NBI): saindo a 3,2 m/s para em ~7 m; a 2,5 m/s perde
  // ~0,55 m/s no 1º metro. O arrasto do ar entra à parte.
  rolagemC: 0.33,
  rolagemN: 1.35,
  // Teto da resistência do gramado: a lei c·v^1,35 foi ajustada entre ~3 m/s (ensaio FIFA) e
  // ~16 m/s (Pfaff et al. 2022: passe a 16,2 m/s, perda média de 7,93 m/s²); acima disso ela
  // passaria de 20 m/s². A grama não freia a bola rolando mais que o atrito de deslizamento
  // (μ ≈ 0,5–0,6 no seco — Cross 2002/2008), então c·v^n fica limitado a 0,55·g (o corte cai
  // em ~7,9 m/s; abaixo disso nada muda). O arrasto do ar continua à parte.
  rolagemMax: 0.55 * G,
  rolagemPiso: 0.05,          // m/s² (a bola sempre acaba parando)
  atritoDeslize: 0.4,         // atrito cinético quando a bola desliza sem rolar
  giroVerticalDecai: 2.5,     // 1/s, giro em torno do eixo y no chão
  vParada: 0.04,              // abaixo disso a bola para
  // Traves e rede.
  restituicaoPoste: 0.55,
  amortecimentoRede: 0.02,    // fração da velocidade que volta ao bater na rede de fundo
};

// Jogador. Velocidades em m/s; os atributos (0–100) escalam estes valores.
export const JOGADOR = {
  raio: 0.3,                  // raio do corpo para colisão
  altura: 1.8,
  massa: 75,
  coxa: 0.45,
  canela: 0.45,
  alturaTornozelo: 0.08,
  larguraQuadril: 0.18,       // distância entre as articulações do quadril
  // Velocidades sem bola (atributo 75); com bola multiplica por fatorComBola.
  vAndar: 1.6,
  vTrote: 3.2,
  vCorrida: 6.0,
  vArrancada: 8.4,
  vArrancadaMin: 7.4,         // atributo 0
  vArrancadaMax: 9.4,         // atributo 100 (profissionais: 8,9 ± 0,2 m/s — Baumgart 2018)
  // Com a bola (Benhassen 2026: V0 −6%; Carling 2010: pico com bola em jogo ~0,8–0,85 do
  // pico sem bola).
  fatorComBola: { trote: 0.97, corrida: 0.93, arrancada: 0.87 },
  acelComBola: 0.78,          // A0 com a bola (Benhassen 2026: F0 −24%)
  vConducaoCurta: 2.6,        // com o modificador (bola colada)
  // Aceleração: perfil aceleração–velocidade a(v) = A0·(1 − v/S0), medido em jogo por GPS
  // (Alonso-Callejo 2022: A0 8,3–8,7 m/s², S0 9,2–9,5 m/s).
  acel0: 8.5,                 // m/s² partindo do parado (atributo 75)
  acel0Min: 7.0,
  acel0Max: 9.2,
  // Freada: média −4,5 m/s², pico −8,5 num apoio (Harper 2020). O jogo usa um valor entre
  // os dois (resposta) e o pico para inverter o sentido.
  freio: 6.2,                 // desaceleração máxima "normal"
  freioGiro: 8.0,             // desaceleração ao inverter o sentido (giro de 180°)
  latNormal: 6.5,             // aceleração lateral máxima na curva (~25° por passo a 5 m/s)
  latCorte: 11.0,             // no passo do corte (agilidade 75)
  angCorte: 0.75,             // rad — acima disso o pedido é um corte
  angInversao: 1.95,          // rad (~112°) — acima disso freia na linha antes de virar
  angInversaoEixo: 2.3,       // rad (~132°) — invertendo, acima disso também tira a velocidade de
                              // lado em relação ao eixo pedido (analógico que passou pela borda)
  vGiroLivre: 1.2,            // abaixo desta velocidade o corpo vira em qualquer direção
  tauVel: 0.18,               // s — constante de tempo do controle de velocidade
  // Giro do corpo (para onde o tronco aponta).
  giroCorpoParado: 14,        // rad/s máximo parado (a IA sem a bola usa IA.giroParado)
  giroCorpoCorrendo: 6,       // rad/s máximo a 8 m/s
  rigidezGiro: 260,           // mola crítica do rumo (1/s²)
};

// Passada — frequência de PASSOS (Hz) por velocidade e fator de carga (fração da passada
// com o pé no chão). Ciclo completo (passada) = 2 passos.
export const PASSADA = {
  // [velocidade m/s, passos por segundo, fator de carga]
  // Caminhada e transição: Hansen et al. 2017; corrida: Dorn, Schache & Pandy 2012 (tab. 1);
  // sprint de futebolistas: Takai et al. 2025 (4,5–4,7 passos/s, contato ≈ voo).
  tabela: [
    [0.0, 1.6, 0.66],
    [1.47, 1.96, 0.62],
    [2.1, 2.35, 0.48],
    [2.9, 2.7, 0.34],
    [3.5, 2.72, 0.32],
    [5.17, 2.94, 0.28],
    [6.96, 3.5, 0.255],
    [9.0, 4.4, 0.25],
    [9.5, 4.7, 0.245],
  ],
  fatorComBola: 1.08,         // conduzindo, passos um pouco mais curtos e rápidos
  alcancePlantado: 0.62,      // m — além disso o pé de apoio sai do chão (passo antecipado)
  alcanceMax: 0.8,            // m — perto disso (limite da perna) o pé de apoio sai depressa, até ritmoUrgente
  alcanceParado: 0.3,         // m — parado, o corpo que se afasta mais que isso de um pé faz dar um passo
  ajusteParado: 0.15,         // s — em quanto tempo esse pé sai do chão
  afastamentoLateral: 0.09,   // m — pé plantado ao lado do centro do corpo
  folgaEntrePes: 0.12,        // m — andando de lado sem a bola, o pé pousa pelo menos isto do lado dele do outro pé
  ladoMin: 0.3,               // m/s — ...quando a velocidade de lado (em relação ao tronco) passa disto
  ladoMaxV: 3.0,              // m/s — ...e o corpo anda a menos disto (passo lateral é coisa de quem anda/trota)
  ladoEmpurraMax: 0.6,        // m — o pouso anda no máximo isto para o lado...
  ladoOfsMax: 0.7,            // m — ...e nunca fica mais longe que isto do centro do corpo (de lado)
  cruzadoParado: 0.03,        // m — parado sem a bola, pés cruzados mais que isto (em relação ao tronco) dão um passo
  baseMaxParado: 0.5,         // m — parado sem a bola, base mais aberta que isto dá um passo
  alturaPasso: 0.12,          // m — altura do pé no meio do balanço (corrida)
  // A fase da passada nunca salta (o pé no balanço anda pela fase: salto de fase = pé que
  // teletransporta). Quando um pé precisa sair antes, só o RITMO aumenta, com estes limites.
  ritmoAdiantado: 1.6,        // × o ritmo normal — pé de apoio para trás ou torto demais
  ritmoFimPasso: 4,           // passos/s — parado com um pé no ar: termina o passo (sem pousar de uma vez)
  ritmoSaidaToque: 8,         // passos/s — os dois pés no chão e o toque pede um pé livre
  ritmoMinSaida: 0.25,        // × o ritmo normal — piso do ritmo que tira o pé do chão a pedido
  ritmoUrgente: 8,            // passos/s — pé de apoio no limite da perna
  ritmoGestoParado: 0.6,      // passos/s — parado, com o pé no gesto do toque (o passo espera)
  // m/s — com a passada acelerada, o pé no ar anda no máximo [0] + [1] × velocidade do corpo
  // (85% do limite físico do teste de patinação, 3 + 2,5·v; Clark et al. 2023)
  velPeBalanco: [2.5, 2.1],
  // Pé desenhado (jogador.js passoPeDesenhado): segue a trajetória do balanço com a velocidade de
  // um pé humano. Correndo, o pico do pé no balanço é 2,00 ± 0,15 × v (Clark et al. 2023);
  // andando, ~4,6 m/s a ~1,3 m/s (van der Straaten et al. 2020).
  velPeMax: [2.7, 2.25],      // m/s — [0] + [1] × v: 90% de 3 + 2,5·v (folga para o joelho/quadril da pose)
  velPeAterrissa: [0.77, 0.18], // m/s — no quadro do pouso: 95% de 0,81 + 0,19·v (Clark 2023, "GSD")
  velPeVertical: 1.5,         // m/s — subida/descida do pé no balanço curto (a altura do passo encolhe)
  perfilBalanco: 0.7,         // mistura linear/suave do caminho no balanço (1 = suave: pico 1,5× a média)
};

// Gesto do toque na bola (só visual). O peso com que o pé desenhado vai até a bola é
// integrado pela simulação com velocidade limitada (pé de cada jogador, `puxa`), para a pose
// continuar função pura do estado e o pé nunca saltar quando o toque é remarcado.
export const GESTO = {
  janela: 0.25,               // s antes do toque em que o pé começa a ir até a bola
  subida: [0.25, 0.2],        // s para o peso ir de 0 a 1 (o pé chega à bola): parado, a ≥ velRef
  acompanha: 0.05,            // s em que o pé acompanha a bola depois do toque
  descida: 0.25,              // s para o peso voltar a 0 (o pé volta à passada)
  desvio: [0.3, 0.3],         // m — desvio máximo do pé da passada no gesto: parado, a ≥ velRef
  velDesvio: [1.2, 2.4],      // m/s — perto da saída e do pouso o desvio encolhe com o tempo livre do pé
  velRef: 7.5,                // m/s — velocidade do corpo em que o gesto chega aos valores [1]
  recuo: 0.15,                // m — o pé encosta atrás da bola, na direção do corpo até ela
  recuoPerto: 0.4,            // m — bola mais perto do corpo que isso: o recuo diminui junto
  velPonto: [1.5, 1.2],       // m/s — o ponto do gesto anda no máximo a [0] + [1] × velocidade do corpo
  saidaAntes: 0.25,           // s — com os dois pés no chão, o pé do toque sai do chão antes disto
  pedidoSaida: 0.5,           // s antes do toque em que a passada começa a tirar o pé do chão
  esperaSaida: 10,            // ticks que o toque espera o pé sair do chão (depois remarca)
  // (só o desenho) no balanço, a chuteira (cápsula tornozelo–ponta) para na superfície da bola dele (jogador.js
  // passoPeDesenhado: centro a ≥ raio + raio da chuteira + `superficie` m). Com o toque mais frequente da condução curta
  // (12/10) o gesto fica ligado quase o tempo todo: sem isto a chuteira entrava na bola em ~61% dos quadros
  superficie: 0.005,
  velSuperficie: [2.82, 2.35], // m/s — o pé desenhado com esse ajuste anda no máximo [0] + [1] × v (94% do limite do
                              // teste-patinacao, 3 + 2,5·v: Clark et al. 2023)
  superficieV: [1.5, 2.5],    // m/s do corpo: abaixo de [0] sem o ajuste (girando no lugar o pé pousa embaixo da bola),
                              // inteiro a partir de [1]
  superficieVBola: 11,        // m/s — só com a bola dele (posse ou domínio) rolando abaixo disto (o pé acompanha)
};

// Condução (o toque planejado). Ver CONTRATOS.md.
export const CONDUCAO = {
  // Ponto de toque à frente do corpo (centro do quadril projetado), por modo.
  // (arrancada 0,42 → 0,38 com a condução curta de 12/10: a folga p90 da disparada passava do alcance do pé, 0,78)
  ofsFrente: { curta: 0.34, trote: 0.36, corrida: 0.33, arrancada: 0.38 },
  ofsLado: 0.06,              // para o lado do pé que toca
  // Passos entre toques pela velocidade do corpo (condução curta, pedido do dono de 12/10: "condução mais curtinha,
  // com a bola mais no pé"): [m/s, passos por toque]. 1 = um toque a cada passo, 2 = um por passada; no meio, 1 e 2
  // se alternam pela difusão do erro (passosDoToque, sem sorteio). Andando e no trote, um toque a cada passo: o
  // drible fechado de Zago et al. 2016 (2,3–3,0 toques/s, os mais rápidos tocam mais); na corrida, 1,5 passo por toque
  // (Preissler et al. 2023: arrancada reta com bola colada, 2,5–4 m e 1,4–2,3 toques/s); na disparada, um por
  // passada (dados abertos DFL/TRACAB, Bassek et al. 2025: em velocidade alta a bola anda 4–7 m por toque). Ajuste
  // fino para o dono: se o trote ficar "picotado", sobe o 3,5. A condução curta (MOD) e a proteção: 1 passo fixo; o
  // domínio, a inversão, a freada, a curva fora do rumo e o passe/chute carregando: 2 (como antes)
  passosPorToque: [[3.5, 1], [4.5, 1.25], [5.6, 1.5], [6.6, 1.75], [7.4, 2]],
  angRitmo: 0.35,             // rad — analógico além disto do rumo da velocidade: um toque por passada (o giro)
  faseToque: 0.8,             // fração do apoio do pé de apoio em que o outro pé toca
  antecedencia: 0.1,          // s — um toque é sempre marcado com essa antecedência
  alcance: 0.78,              // m — distância máxima bola–corpo para tocar
  folgaMax: 0.8,              // m — a bola não abre mais que isso à frente entre dois toques
  arcoMax: 0.15,              // m — curva fechada: o corpo sairia mais que isso da linha da bola
                              // até o próximo toque → toca a cada passo
  alcanceFrente: -0.15,       // m — a bola pode estar até 15 cm atrás do centro do corpo
  intervaloMin: 0.16,         // s entre dois toques
  angReplanejar: 0.35,        // rad — mudança de rumo pedido que antecipa o toque
  // (condução curta, 12/10) o analógico pulou mais que isto num tick (gesto rápido do polegar pela borda): o toque
  // marcado para esse tick espera 1 tick para ler o analógico já no fim do gesto; se ele ainda pula, sai um toque de
  // FREIO (a bola para onde o corpo para, pela mesma conta da rolagem) — antes, no meio do gesto, a bola saía de lado
  saltoGesto: 0.3,            // rad
  desvioReplanejar: 0.2,      // m — bola prevista longe do pé no próximo toque: antecipa o toque
  horizonte: 1.6,             // s — previsão máxima do caminho do corpo
  meiaVidaGiroPedido: 1.2,    // s — o giro do analógico é extrapolado com esta meia-vida
  angBusca: 0.61,             // rad (~35°) — fora disso o corpo vai buscar a bola
  perdaDist: 2.6,             // m — além disso (sem tocar por perdaTempo) a bola foi perdida
  perdaTempo: 1.2,
  // Erro do toque (desvio-padrão), escalado pelo atributo de drible/controle.
  erroAngBase: 0.007,         // rad com atributo 100
  erroAngRuim: 0.06,          // rad com atributo 0
  erroVelBase: 0.008,
  erroVelRuim: 0.05,
  // Domínio (primeiro toque).
  // σ (× a bola forte e a pressão) = lerp(ruim, bom, controle/100) entre `fraco.ate` e `craque.desde` (a conta
  // publicada: a maioria dos titulares tem controle 59–69 e qualquer erro a mais derrubava o ataque —
  // contraprova de 10/10: ~2,0 → ~1,4 gol por partida com a curva mais dura nessa faixa); acima de
  // craque.desde cai em linha reta até craque.ang / craque.vel no controle 100 — o bom domina mais limpo
  // (controle 90: 0,060 rad × 0,073 antes); abaixo de fraco.ate (nenhum titular) sobe em linha reta até
  // fraco.ang / fraco.vel no 0 — o fraco espirra a bola forte (controle 45: 0,207 rad × 0,177 antes)
  dominioErroAng: { bom: 0.05, ruim: 0.28 },
  dominioErroVel: { bom: 0.05, ruim: 0.35 },
  dominioCraque: { desde: 70, ang: 0.03, vel: 0.03 },
  dominioFraco: { ate: 55, ang: 0.45, vel: 0.55 },
  dominioVRef: 12,            // m/s — acima disso o domínio fica mais difícil
  // domínio orientado da recepção assistida (recepcao.js, conducao.js planejarAlvo): a bola sai na direção
  // pedida e entorta no máximo kmax passos de 2,5° (cada um custa como `entorta` m/rad de distância ao pé)
  // para passar a ≤ `lado` m de onde o pé vai estar; sem o ponto do próximo toque à frente, anda `curto` m.
  // Embalado (mais que vLivre m/s), a direção pedida é a do analógico limitada pelo embalo (conducao.js
  // anguloEmbalado): 90° do sentido da corrida a vLado m/s, menos `queda` rad a cada m/s, até angMin (a bola
  // para trás ou de lado fugia do corpo que ainda corre)
  dominioOrientado: { curto: 0.45, lado: 0.25, kmax: 2, entorta: 0.6, vLivre: 3.5, vLado: 4.5, queda: 0.3, angMin: 0.75 },
  dominioPressaoDist: 2.5,    // m — marcador mais perto que isso pressiona
  // Proteção.
  protecaoDist: 5,            // m — marcador a menos disso ativa a proteção (com o modificador)
  protecaoOfs: 0.42,          // m — bola do lado oposto ao marcador
  vProtecao: 1.6,             // m/s máximo protegendo
  giroProtecao: 3.5,          // rad/s — giro do corpo (e da bola, com a sola) em volta da bola
                              // protegendo, com agilidade 50 (×0,8–1,2 pela agilidade): um marcador
                              // que contorna mais rápido que isso chega à bola
  // Pedalada.
  pedaladaDuracao: 0.42,      // s
  pedaladaToqueDuplo: 0.3,    // s — dois toques no modificador dentro disso
  // Puxada de sola.
  puxadaVel: 1.6,             // m/s da bola puxada para trás (no chão; o corpo freia junto)
};

// Recepção assistida (pedido do dono, 10/10: "o jogador sai da bola, isso nunca pode acontecer"). Com a
// bola vindo para o jogador do humano (passe dele, ou bola livre sem passe que passa perto e ele alcança
// antes dos companheiros), o CORPO vai ao encontro da bola (o ponto da linha dela a que ele chega primeiro)
// e o analógico só decide para onde vai o 1º toque (domínio orientado, como o "directional first touch" do
// EA FC) e abre o corpo (meia-volta). Ver recepcao.js e PESQUISA-RECEPCAO-GOLEIRO.md.
export const RECEPCAO = {
  horizonte: 2.5,             // s — previsão da bola para achar o ponto de encontro
  ofsFrente: 0.42,            // m — de frente: a bola chega a esta distância à frente do corpo
  ofsCorrida: 0.3,            // m — em corrida: a bola chega um pouco à frente...
  ladoCorrida: 0.22,          // m — ...e deste lado do pé (nem nas pernas, nem longe)
  tLateral: 0.3,              // s — o desvio de lado até a linha da bola é feito com pressa (em até isto)
  corpoAberto: 0.5,           // rad (~29°) — de frente, o tronco abre até isto para o lado do analógico
  aLatCorrida: 6,             // m/s² — em corrida, o encontro em que ele segue reto, corrigindo de lado até isto...
  aRitmoCorrida: 2.5,         // m/s² — ...e o ritmo até isto (para mais ou para menos: sem frear para a bola)...
  tCorrida: 0.8,              // s — ...em até isto (mais longe, recebe como de frente: vai à linha da bola)
  perto: 3.0,                 // m — bola livre (sem passe) liga a assistência se o encontro fica a até isto dele...
  tLivre: 1.6,                // s — ...e acontece em até isto
  folgaCompanheiro: 0.15,     // s — companheiro que chega antes por mais que isto fica com a bola livre
  custoTempo: 1.5,            // m/s — sem pressa, o encontro escolhido é o de menor (metros andados + isto × s)
  janelaMarca: 45,            // ticks — o toque do domínio é marcado com até isto de antecedência
  folgaEncontro: 0.08,        // m — o corpo não precisa pisar no ponto exato do encontro
  bateCorpo: 0.48,            // m — a bola mais perto que isto do centro do corpo bateria nas pernas (0,3 + 0,11 + folga)
  alturaPe: 0.45,             // m — bola até esta altura dá para dominar com o pé (= noAlcance)
  // embalado (> 1,2 m/s), o movimento da recepção pede no máximo angCorteMax (rad) do sentido da corrida — corta
  // freando para o lado (jogador.js passoCorpo: acima de angInversao, 1,95 rad, ele freia na linha sem sair de
  // lado); só o ponto bem para trás (mais que angInverte) pede a inversão
  angCorteMax: 1.5,
  angInverte: 2.6,
  // finalização (chute, colocado, cavadinha, cabeceio) rumo ao gol não é bola livre para receber: mais forte que
  // chuteVForte, ou mais forte que chuteVMin e indo para a boca do gol (até chuteFolgaTrave por fora da trave)
  chuteVMin: 6,
  chuteVForte: 15,
  chuteFolgaTrave: 1.5,
  // bola livre: o adversário que chega antes dele por mais que isto (s) fica com ela — o controlado não é puxado
  folgaAdversario: 0.3,
};

// Entrada.
export const ENTRADA = {
  zonaMorta: 0.16,            // radial
  zonaExterna: 0.95,          // acima disso conta como inclinação máxima
  magTrote: 0.55,             // inclinação até aqui = andar→trote; acima = corrida
  // Limiar ÚNICO de direção: abaixo disso (depois da zona morta) o pedido vale zero — o corpo
  // nem anda no rumo antigo nem anda sem virar o tronco (analógico leve no celular).
  magDirecao: 0.1,
  quant: 1024,                // a entrada é quantizada (replay compacto e determinístico)
  // toque (DOM, entrada.js criarToqueOuSegura): DIVIDIDA solta antes disto = bote; segurada = CONTER (como o
  // "Sprint & Tackle" do FC Mobile: segurar perto = marca; tocar = bote em pé). Medido no relógio do jogo.
  toqueCurto: 0.25,           // s
};

// Botões (máscara de bits). Os da Etapa 2+ já têm número reservado.
export const BOTAO = {
  CORRER: 1,
  MOD: 2,
  PASSE: 4,
  ENFIADA: 8,
  LANCAMENTO: 16,
  CHUTE: 32,
  CONTER: 64,
  DIVIDIDA: 128,
  CARRINHO: 256,
  PRESSAO: 512,
  TROCAR: 1024,
  GOLEIRO: 2048,
  PEGAR: 4096,                // goleiro com a bola no pé, na área: pega com a mão (o "Pick Up Ball" do EA FC)
};

// Atributos padrão (0–100).
export const ATRIBUTOS_PADRAO = {
  velocidade: 75,
  aceleracao: 75,
  agilidade: 75,
  equilibrio: 75,
  drible: 75,
  controle: 75,
  forca: 70,
  altura: 180,
  passe: 72,                  // passe curto
  passeLongo: 68,             // lançamento e cruzamento
  finalizacao: 70,
  cabeceio: 65,
  impulsao: 65,
  peFraco: 50,                // 0 = só usa um pé; 100 = ambidestro
  pePreferido: 1,             // 0 = esquerdo, 1 = direito
  reflexo: 65,                // goleiro
  posicionamento: 65,
  mergulho: 65,
  // Etapa 3 (elenco da partida): ninguém do treino lê estes, então o treino e o hash não mudam
  marcacao: 65,
  desarme: 65,
  visao: 65,
  folego: 65,
};

// Câmera de TV. O enquadramento é pela LARGURA vista no foco (m), não pelo fov: o fov vertical
// sai da largura e do formato da tela (render/camera.js). Celular deitado (19,5:9) mantém a
// largura de um 16:9 e ganha jogadores maiores; em pé, perfil próprio (mais alto e inclinado,
// sem céu); tela pequena (celular) fecha mais 12%.
export const CAMERA = {
  largura: 45,                // m vistos na horizontal, no foco, num 16:9 (fov vertical ~32°)
  distancia: 40,              // do foco até a câmera, no chão (z)
  altura: 18.3,               // inclinação ~24,6°
  rigidez: 3.2,               // 1/s — mola crítica que segue o alvo
  telaPequena: 0.88,          // celular (menor lado < 520 px CSS): largura × 0,88
  // celular deitado (pedido do dono, 10/10): TV mais baixa e mais longe, a 15° do horizontal — o limite de cima da
  // câmera principal da UEFA (12–15° olhando o centro do campo) — para a torcida aparecer durante o jogo. O plano é
  // pela largura, então os jogadores não diminuem e a arquibancada do outro lado entra no alto do quadro.
  celular: { distancia: 46, altura: 12.3 },
  aproximada: { largura: 23, distancia: 16, altura: 8 },
  // celular em pé: câmera mais alta e inclinada (~40°), largura menor; nada de céu no quadro
  retrato: { largura: 22, distancia: 25.3, altura: 21.2 },
  retratoAproximada: { largura: 13, distancia: 12, altura: 9.6 },
};

// Qualidade gráfica.
export const QUALIDADE = {
  baixa: { pixelRatioMax: 1, sombras: false, mapaSombra: 0, antialias: false },
  media: { pixelRatioMax: 1.5, sombras: true, mapaSombra: 1024, antialias: false },
  alta: { pixelRatioMax: 2, sombras: true, mapaSombra: 2048, antialias: true },
};

// Treino (Etapa 1): máquina de passes e marcador.
export const TREINO = {
  maquinaDist: [10, 20],      // m
  maquinaVel: [6, 15],        // m/s — velocidade com que a bola CHEGA ao jogador
  marcadorVel: 6.2,
  marcadorAcel: 5.5,
  marcadorAlcance: 0.55,      // m — distância bola–marcador que conta como roubada
  marcadorContorno: 2.0,      // m/s — correndo em volta de quem protege a bola
  marcadorBote: 1.9,          // rad — bola a menos disso do lado dele (em volta do condutor): vai nela
};

// Etapa 2 — ações com bola (passe, enfiada, lançamento, cruzamento, chute). Valores iniciais;
// a calibração vem da pesquisa da Etapa 2 (PESQUISA-ETAPA2.md) e das medidas dos testes.
export const ACOES = {
  cargaCheia: 0.8,            // s segurando para a força máxima
  cargaMax: 1.2,              // s — depois disso solta sozinho
  pedidoValidade: 0.6,        // s — pedido sem toque possível expira
  pedidoPrimeira: 1.6,        // s — esperando a bola chegar para bater de primeira
  primeiraFolga: 0.3,         // s — o humano com o passe vindo (j.recebe): o pedido de primeira vale até a chegada + isto
  toqueDuplo: 0.35,           // s — dois toques no LANÇAMENTO = cruzamento rasteiro; no CHUTE = cavadinha (2º aperto até isso depois de soltar o 1º)
  passe: { cone: 0.55, dMin: 3, dMax: 42, vChegada: [4.5, 8.0], adiante: 0.9, erroBom: 0.012, erroRuim: 0.07 },
  enfiada: { cone: 0.7, dMin: 5, dMax: 48, lead: [4.5, 12], vNoPonto: [3.5, 7], vMax: 26, erroBom: 0.015, erroRuim: 0.08 },
  lancamento: { cone: 0.5, dMin: 16, dMax: 62, elev: [0.5, 0.72], erroBom: 1.2, erroRuim: 6 }, // erro em m a 40 m
  cruzamento: { terco: 17.5, faixa: 20, elevAlto: 0.42, elevTenso: 0.16, vRasteiro: 11, yAlto: 2.0, yTenso: 0.9, setor: 0.44 },
  // chute (pesquisa da Etapa 2): máximo de 30–34 m/s nos melhores (Shinkai 2008; DFL); colocado
  // a ~0,85 do forte e com 30–40 rad/s de efeito (Whiteside 2010); força máxima ×1,15 no erro
  // (Carlsson 2018); pressão só de perto e pouca; de primeira ×1,15 (StatsBomb)
  // penaltiErro: o erro do chute no pênalti (a pressão da cobrança; ~6% para fora — a meta do dono, seção 11)
  chute: { v: [14, 31], yAlvo: [0.35, 1.7], erroBom: 0.016, erroRuim: 0.075, colocadoV: 0.85, colocadoErro: 0.6, giroColocado: 35, forcaMaxErro: 1.15, pressaoErro: 0.2, primeiraErro: 1.15, penaltiErro: 1.8, penaltiCanto: 2.5, yBarreiraMax: 2.1, faltaErro: 2.0, giroFalta: 18 },
  // cavadinha (StatsBomb: 20% de gols, 41,8% no alvo; só funciona com o goleiro adiantado). A da IA sai sozinha com o
  // goleiro adiantado (goleiroFora/distMax); a do humano, com DOIS TOQUES no CHUTE (pedido do dono, 12/10), de qualquer
  // lugar: o 2º aperto antes de o chute do 1º tocar na bola. toqueRapido: 1º toque mais curto que isso pode ser o 1º de
  // dois — o contato espera até `janela` s depois de soltar (um toque duplo normal leva ~0,08–0,18 s entre os toques; o
  // chute carregado não espera). elevPedida: elevação da cavadinha pedida pela força do 2º toque (toque rápido → [0], a
  // mesma da IA; segurado → [1], mais alta). penalti: a Panenka (a pedida na cobrança do pênalti; acoes.js cavadinha) —
  // passa 0,4 m antes da linha a `y` m, descendo, com a elevação de elevPedida[0] (2º toque rápido) até `elevMax`
  // (segurado), erro próprio de força/direção (ruim → bom) e SEM a pressão do pênalti (ACOES.chute.penaltiErro): bola
  // parada a 11 m e sem marcador; Opta/Premier League: 95,7% de gols no alto do meio (PESQUISA-ETAPA2 §2.7a). Força
  // +7% (elevMax) a +9% (rápido) a mais já passa por cima do travessão
  cavadinha: { goleiroFora: 5, distMax: 26, elev: 0.72, alemDaLinha: 0.5, erroForca: [0.3, 0.15], erroDir: [0.14, 0.05],
    toqueRapido: 0.18, janela: 0.15, elevPedida: [0.72, 1.0],
    penalti: { y: 1.3, elevMax: 0.86, erroForca: [0.05, 0.025], erroDir: [0.06, 0.025] } },
  // cabeceio (pesquisa da Etapa 2): a cabeça chega ~0,56 m acima da estatura com corrida (Fílter
  // 2022) — com 1,80 m, centro da bola a ~2,45 m; força própria de 6,4–8,3 m/s (Becker 2021)
  // erroGolBolaParada: o cabeceio PARA O GOL na bola parada (escanteio, falta, lateral) espalha como o real (Opta: ~1/3
  // dos cabeceios a gol no alvo). Na bola rolando fica como antes até a entrega do cabeceio (valendo em todo cabeceio
  // derrubou os gols de bola rolando: painel de 144, 1,78 → 1,67)
  cabeceio: { alcanceSalto: 2.45, alturaPeito: [0.45, 1.7], v: [6, 17], potencia: [6, 8.5], redirecao: 0.35,
    erroGolBolaParada: [0.3, 0.1] }, // rad (cabeceio 0 → 100)
  // domínio no peito/coxa: a bola morre com ~5–10% da velocidade (Iga & Nunome 2016: 9,73 → 0,52 m/s)
  dominioAereo: { sobra: [0.12, 0.05] },
  pressaoDist: 2.2,           // m — adversário mais perto que isso pressiona o batedor
  // bote da IA defensora (Etapa 2, enxuto; os botões de defesa e a disputa completa são da Etapa 3):
  // acompanha a ~1,5 m, ataca a bola solta do pé e tenta tirar só com ela ao alcance do pé
  // (bolaSolta e colada × 0,87 com a condução curta de 12/10: a bola–condutor da IA no trote caiu 0,67 → 0,58 m —
  // a mesma régua relativa; sem isso o bote não chegava no condutor que empurra a bola no marcador colado)
  boteIA: { distAcompanha: 1.5, bolaSolta: 0.61, alcance: 0.65, chancePorPasso: 0.08, descanso: 45, vSai: 3.2,
    // (só na partida; pedido do dono, 11/10: "se eu deixo o meu jogador parado, ninguém pega a bola") com o condutor
    // abaixo de vParado m/s e sem tocar na bola há semToque s, a bola parada à frente do pé não está "colada": quem
    // chega ao alcance dela tenta tirar — e ganha pela mesma chance da DIVIDIDA do humano (defesa.js chanceDividida)
    vParado: 2.0, semToque: 0.1,
    // bola a menos disto do condutor: "colada" no pé dele — o bote não alcança (condução curta de 12/10: calibrável
    // aqui sem mexer no código; CONDUCAO.passosPorToque deixa a bola mais perto do pé)
    colada: 0.305,
    // bola a menos de `encostada` m do CORPO do marcador (raio do corpo 0,3 + raio da bola 0,11 + 0,01) com os dois
    // andando juntos (velocidade relativa ≤ `encostadaVrel` m/s): o condutor empurra a bola no marcador — ela não está
    // colada no pé dele, está entre os dois e é disputada. Sem isso, com a condução curta, o condutor que empurrava a
    // bola no marcador colado à frente (toques a cada 0,1 s) nunca perdia: a bola a 0,29 m dele e a 0,31 m do marcador
    // (teste-parado, "andando devagar"). Quem chega correndo numa bola colada continua sem alcançar (a PRESSÃO em
    // disparada fazia faltas de frente: teste-pressao-humano M4); nas costas do condutor não vale (sim.js boteIA)
    encostada: 0.42, encostadaVrel: 1.0 },
  primeiraErro: 1.4,          // multiplica o erro de jogada de primeira
};

// Goleiro (Etapa 2). Pesquisa da Etapa 2 (PESQUISA-ETAPA2.md): reação de 0,19–0,25 s após o
// toque (Higueras-Herbada et al. 2020; Navia 2017); mergulho com o centro de massa a 3,6–4,0 m/s
// no pico e ~1,5 m de deslocamento, e a mão a ~3,5 m do ponto de partida (Monteiro et al. 2022;
// Ibrahim et al. 2019); profundidade no chute 1,2 m (pequena área), 1,8 m (área) e 2,1 m (fora),
// e chance de defesa pela distância lateral (StatsBomb Open Data, logística ajustada).
export const GOLEIRO = {
  // pênalti (Regra 14; goleiro.js lerChute): o goleiro escolhe o lado ANTES do chute (z do mergulho, m, e o peso de
  // cada escolha; o humano escolhe com o analógico na hora da cobrança). Lado certo: ganha `antecipa` s; lado errado
  // (ou ficou no meio e a bola foi no canto, a > `meio` m): não defende; lado certo: chance × `fator`. Meta do dono: ~76% gol, 18% defesa, 6% fora.
  // Panenka (a cavadinha do pênalti, ~1,3–1,6 s até o goleiro): longe do lado escolhido (> `meio` m) entra — ele já
  // mergulhou e fica no chão até ela passar (o mergulho desenhado tem o pico `picoPanenka` s depois do chute, o tempo
  // de um pênalti chegar ao canto); quem ficou no meio pega a que alcança (sem sorteio, como o recuo)
  // `ladoMin`: o humano só escolhe o canto com a componente do analógico AO LONGO da linha do gol (|iz|) ≥ ladoMin × o
  // módulo (0,38 ≈ sen 22,5°: o setor de 45° em volta do horizontal da tela de TV — para o batedor ou para o gol — não
  // escolhe; a diagonal do teclado, 45°, escolhe); abaixo disso, ou solto, fica no meio (partida.js ladoPenaltiHumano)
  penalti: { palpite: [[-2.2, 0.44], [0, 0.12], [2.2, 0.44]], meio: 1.0, antecipa: 0.08, fator: 0.72, passo: 0.5, ladoMin: 0.38, picoPanenka: 0.5 },
  reacao: [0.25, 0.19],       // s depois do toque (ruim → bom)
  alcanceEmPe: 0.9,           // m: mão de lado sem mergulhar
  bracoReflexo: 1.6,          // m: perna/braço esticados no reflexo, sem tirar o corpo do lugar
  tReflexo: 0.15,             // s para o reflexo
  bracoEsticado: 2.0,         // m: braço e corpo esticados no mergulho (somam ao deslocamento)
  tEsticar: 0.6,              // s para esticar por completo
  aMergulho: 9.5,             // m/s² do centro de massa na impulsão
  vMergulho: 3.8,             // m/s: pico do centro de massa
  deslocMax: 1.5,             // m: deslocamento máximo do centro de massa
  folgaAlcance: 0.4,          // m: além do alcance a chance cai a zero nessa faixa
  // logit(defesa) = c0 + cLat·lateral + cDist·distância + cAlt·altura (+ atributos)
  // c0Partida: só na partida (o treino não muda). Com as regras de 11/10 (adversário fora da área no tiro de meta, sem
  // recuo agarrado) saíram gols fáceis de 6 a 16,5 m e as defesas nessa faixa foram a 60,8% (meta 55–60%; painel de 144
  // partidas); −0,1 no logit → 59,0%, total 68,0%, de fora da área 86,8% (todas na meta)
  logit: { c0: -0.35, cLat: -1.15, cDist: 0.2186, cAlt: -0.219, attr: 2.0, c0Partida: -0.1 },
  // segurar × espalmar (StatsBomb): em pé, de longe ~60%; no mergulho ~25%; de perto ~23%
  segurar: { emPe: 0.6, mergulho: 0.25, perto: 0.23 },
  alturaMax: 2.45,            // m alcançados com a mão no alto
  profundidade: [1.2, 2.1],   // m da linha: bola a 6 m → a 20 m ou mais
  profundidadeLonge: 3.5,     // m com a bola a 40 m ou mais
  saida1x1Max: 4,             // m: contra quem domina a bola, fecha o ângulo sem passar disso
  vRecuo: 4.2,                // m/s voltando para o gol (bola por cima: cavadinha)
  recuoDefesa: [0.3, 0.75],   // chance de tirar a bola por cima ao chegar (sem folga → com 0,3 s)
  saidaMax: 35,               // m da linha até onde sai com o botão
  esperaHumano: 3.0,          // s com a bola nas mãos do goleiro do humano sem botão de ação: a IA repõe por ele (só no
                              // treino e na demo — na partida o humano repõe quando quiser, com os 8 s da Regra 12.3)
  esperaIA: 1.5,              // s que o goleiro da IA segura antes de repor
  // Regras da mão (IFAB 2025/26 — regras-goleiro.js; pedido do dono, 11/10). Regra 12.3: mais de oitoSegundos s com a
  // bola nas mãos (de pé, bola em jogo) = escanteio para o adversário; o anel no chão conta os últimos `contagem` s.
  oitoSegundos: 8,
  contagem: 5,
  // o goleiro do humano anda com a bola nas mãos (o analógico; CORRER mais depressa) até a borda da área — parede pela
  // locomoção a `margem` m da linha, freando a `freio` m/s²: ele nunca sai da área com a bola na mão
  maoAnda: { v: 3.2, vCorrer: 4.5, margem: 0.6, freio: 3 },
  trocarGoleiro: 0.4,         // s com TROCAR segurado: o controle vai para o goleiro (o "Switch to Goalkeeper")
  pegaPe: 1.0,                // m — PEGAR alcança a bola no pé até isto do corpo
  // PEGAR só na bola no pé ou solta e devagar (até pegaVMax m/s): a bola rápida (chute, passe) é da defesa automática
  // (logística + mão desenhada). Contraprova: martelando PEGAR com o goleiro controlado, todo chute a ≤ 1 m dele virava
  // "pegou" (48/48 chutes de 9 m a 28–36 m/s que eram gol sem o botão)
  pegaVMax: 3,
  soltaLinha: 0.25,           // m — a bola que sai das mãos (reposição, ENFIADA) fica no mínimo isto aquém da linha do gol
  // goleiro da IA com a bola no pé (recuo, bola que ele não pode pegar): passa curto para um companheiro livre a dMin–dMax
  // m depois de `espera` s; com um adversário a menos de `pressao` m, chutão para a frente (nunca conduz sob pressão)
  // (e vai com o pé à bola livre que não pode pegar com a mão — o passe para ele, ou a até `busca` m sendo o 1º do time a
  // chegar e antes dos adversários, ou ela na área dele)
  pe: { espera: 0.5, pressao: 6, dMin: 6, dMax: 35, forcaPasse: 0.45, forcaChutao: 0.9, busca: 16 },
  // a IA de linha só recua para o goleiro rasteiro, com ele livre (nenhum adversário a menos de `livre` m dele nem da
  // linha do passe) e com a bola que erra o goleiro passando longe do gol (|z| na linha do gol ≥ `foraGol` m)
  recuoIA: { livre: 8, foraGol: 6 },
  // bola nas mãos de pé: frente (m à frente do centro) e altura (m), palmas a ±palma m do meio da bola; no fim
  // do encaixe desenhado a bola vai do peito a esse ponto nos últimos tJunta s (sem salto de bola nem de braço);
  // a bola pega solta (ou no chão, no tiro de meta) chega às mãos a vJunta m/s, sem salto
  bolaMao: { frente: 0.32, altura: 1.05, palma: 0.12, tJunta: 0.3, vJunta: 4 },
  // m: a bola, no tick da defesa, longe disso do ponto lido (desvio depois da leitura) → não há defesa
  desvioMax: 0.3,
  pegaMergulho: 0.3,          // m da mão desenhada à bola para pegar a bola solta no meio da defesa desenhada
  // s depois de espalmar em que o goleiro não pega a própria espalmada: antes ~metade das espalmadas (publicada e
  // 10/10) voltava para as mãos 1 tick depois (a bola saía da mão a < 9 m/s, a < 1 m dele) — a espalmada virava encaixe
  reagarra: 0.5,
  // espalmada (pedido do dono, 10/10: "nem espalma direito"): a bola sai a fracaoV da velocidade (entre vMin
  // e vMax), por cima do travessão com ela acima de alturaTravessao, pela linha de fundo por fora da trave com
  // o contato a menos de `perto` m da linha, ou bem aberta (|z| ≥ zAberta) mais longe; conferida pela física
  // (até `tentativas` direções, cada uma mais aberta e mais alta): não entra no gol e, depois de tSai s, não
  // fica jogável (abaixo de jogavelAlt m e de jogavelV m/s) na zona perigosa (a menos de zonaX m da linha e
  // |z| < zonaZ) nos tConfere s seguintes. Treinadores de goleiro: "nunca espalmar para a frente; para fora =
  // escanteio" (PESQUISA-RECEPCAO-GOLEIRO.md)
  espalmada: {
    fracaoV: 0.45, vMin: 8, vMax: 13, alturaTravessao: 1.85, perto: 4, zAberta: 10, tentativas: 8,
    tSai: 0.1, tConfere: 2, jogavelAlt: 1.5, jogavelV: 7, zonaX: 11, zonaZ: 9,
  },
  // defesa desenhada (mergulho, salto ou em pé): começa no máximo antecipaMergulho s antes do contato (o
  // mergulho real leva ~0,4–0,6 s do primeiro movimento à bola); antes disso o goleiro anda de lado para a
  // linha da bola (passos de lado, até vLado m/s) — batido, ele para a ~1,2 m dela
  antecipaMergulho: 0.5,
  vLado: 3.5,
  // bola por cima do goleiro adiantado (cavadinha): ele volta correndo e salta para trás até a bola nos
  // últimos antecipaSalto s
  antecipaSalto: 0.5,
  // o corpo do goleiro começa a se mexer isto antes do fim da reação (reacao, acima: a chance de defesa é a
  // mesma): o goleiro lê o corpo do chutador (handebol: goleiros experientes começam o movimento ~0,19 s antes
  // de a bola sair — PMC3590836) e a defesa desenhada tem tempo de chegar à bola sem teletransporte
  leitura: 0.1,
  // limites físicos da defesa desenhada (goleiro.js; pesquisa: PESQUISA-RECEPCAO-GOLEIRO.md — Monteiro 2022,
  // Ibrahim 2019: centro de massa até 3,6–4,0 m/s no mergulho; contraprova de 10/10: sem teto o corpo andava
  // até 64 m/s quando a reação acabava em cima da hora)
  mergulho: {
    vPico: 4.6,       // m/s — o centro de lado (folga do braço curto do boneco sobre os 4,0 da pesquisa)
    vFrente: 2.5,     // m/s — o centro para a frente/para trás
    giro: 7,          // rad/s — o tronco inclinando de lado (o mergulho inteiro deita em ~0,3 s)
    dobra: 9,         // rad/s — o tronco curvando para a frente (defesa em pé, bola baixa)
    sobe: 3.5,        // m/s — o quadril subindo (impulsão: salto de ~0,6 m sai a ~3,4 m/s)
    saltoMax: 0.6,    // m — o quadril sobe no máximo isto acima de em pé no salto (bola alta)
    agacha: 2.5,      // m/s — o quadril descendo na defesa em pé
    vMao: 12,         // m/s — pico da mão em relação ao corpo, da espera até a bola (reflexo de braço)
    maoOk: 0.22,      // m — a defesa sorteada só vale se a mão desenhada chega a isto da bola no contato...
    corpoLado: 0.35,  // m — ...menos a bola no corpo (em pé, a até isto de lado e abaixo de corpoAlto): o corpo
    corpoAlto: 1.7,   //   bloqueia
    margemLinha: 0.35, // m — o centro nunca chega mais perto que isto da linha do gol
    tMinFalha: 0.32,  // s — batido em cima da hora: o mergulho atrasado leva pelo menos isto até o pico
    tGiro: 0.2,       // s — o tronco gira do rumo de antes até ficar de frente para o campo
    tChao: 0.12,      // s deitado depois de cair
    tLevanta: 0.5,    // s para levantar
    recua: 0.3,       // m que o corpo volta de lado ao levantar (sobe por cima dos pés)
    tSaltoPouso: 0.3, // s do contato até os pés pousarem no salto
    tEmPe: 0.45,      // s da defesa em pé (baixa / peito) depois do contato
    tAbraca: 0.25,    // s para trazer a bola encaixada para junto do peito
    tMaoRebote: 0.15, // s para as mãos irem de onde estavam (defesa anterior) às da defesa nova no rebote
  },
};

// IA sem a bola: chegar ao ponto sem tremedeira (dono, 09/10: "o movimento dos jogadores tá meio
// estranho"). Com pressa = bola livre, passe chegando, pressão no condutor, corrida nas costas;
// sem pressa = apoio, marcação e cobertura.
export const IA = {
  chegou: 0.4,                // m: para no ponto
  // Modos de chegar ao ponto (ia.js para): vAlvo = m/s máximos do ponto pedido (salto de alvo vira
  // caminho; null = direto), retoma = m: parado, só volta a andar com o ponto além disto, dist = m:
  // intensidade do analógico d/dist, magMin = piso da intensidade, corre = [liga, desliga] m,
  // freia = pedido que inverte o sentido freia na linha antes de virar
  modos: {
    // (marcação e cobertura usam a calma: um modo "marca" mais urgente fazia o tronco tremer e
    // não aumentava a pressão — medido)
    pressa: { vAlvo: null, retoma: 0.6, dist: 4, magMin: 0.25, corre: [3, 1.5], freia: false },
    calma: { vAlvo: 9, retoma: 1.2, dist: 14, magMin: 0.2, corre: [14, 10], freia: true },
  },
  giroParado: 8,              // rad/s: giro máximo do tronco parado da IA sem a bola (o humano: JOGADOR.giroCorpoParado)
  trocaMarcacao: 3,           // m: a marcação só troca de homem se a nova for isto melhor (antes trocava ~18×/min)
  cobreLado: 4,               // m: quem sobra cobre de lado (perpendicular à linha bola–gol), um de cada lado
  // sem a bola, o tronco vira para a bola: até vLivre todo (até de costas); acima, só o que deixa
  // a velocidade de lado em até vLado; some entre vSome − 1 e vSome (m/s; contínuo)
  olhaBola: { vLivre: 1.2, vLado: 1.5, vSome: 6.0 },
  antecipaPressao: 0.7,       // s: quem pressiona mira à frente do condutor pela velocidade dele...
  filtroCondutor: 0.5,        // s: ...filtrada por esta constante...
  antecipaMax: 3,             // m: ...e com avanço de no máximo isto
  saidaGoleiro: 25,           // m: com a bola no goleiro, as vagas do time se medem a partir daqui (do meu gol)
  recuoMin: 12,               // m: com a bola no meu time, jogador de linha não recua mais perto do meu gol que isto
  pressaoArranca: 6,          // m: quem pressiona só aperta CORRER com o ponto além disto
  trocaPressao: 2,            // m: outro só assume a pressão se estiver isto mais perto da bola que quem pressiona
  freiaLinha: [2.5, -0.17],   // acima de 2,5 m/s, pedido a mais de ~100° do movimento: freia na linha antes de virar
};

// =====================================================================================================
// Etapa 3 — partida 11×11, tática e IA. Um bloco por parte (cada parte edita só o seu); valores
// iniciais do plano (seções 2.7 e 3.2) e da pesquisa (PESQUISA-ETAPA3.md). Quem calibra é o teste.
// Nada daqui é lido no treino (a lógica nova só liga com m.times).
// =====================================================================================================

// ----------------------------------------------------------------------------- Parte 1: partida
// Partida (plano 3.2): 2 tempos curtos com relógio acelerado (0'–45' e 45'–90'), recomeços
// simplificados (a regra IFAB completa é da Etapa 4) e substituições da Regra 3 (5 em 3 paradas).
export const PARTIDA = {
  minutosPorTempo: 4,         // minutos REAIS por tempo (o relógio mostra 45' por tempo)
  intervalo: 3,               // s de faixa "Intervalo" antes da saída do 2º tempo
  golPausa: 2.5,              // s entre o gol e a saída (os 150 ticks do treino)
  foraEspera: 1.0,            // s com a bola fora antes de montar o recomeço
  montagem: 1.2,              // s de montagem do recomeço (corte de câmera na saída)
  // s de montagem por recomeço, depois da bola morta (o cobrador já no ponto; os outros se ajeitam):
  // a saída e o escanteio esperam o time se posicionar; o lateral é rápido; no tiro de meta os zagueiros abrem
  montagemPor: { saida: 1.2, lateral: 0.3, escanteio: 1.2, tiroDeMeta: 1.0, tiroLivre: 1.0, penalti: 1.5 },
  cobrancaIA: [0.6, 1.4],     // s que a IA espera para cobrar (sorteio pelo m.rng)
  cobrancaHumanoMax: 6,       // s desde a bola morta — depois disso a IA cobra pelo humano
  paradaMax: 8,               // s — nenhuma parada dura mais que isto (trava proibida)
  teleporteCobrador: 8,       // m — o cobrador é levado ao ponto na montagem; o evento do recomeço leva a
                              // distância (`levado`) e o HUD avisa acima disto (andar até lá: Etapa 4)
  raio: { saida: 9.15, lateral: 2, escanteio: 9.15, tiroDeMeta: 'area', tiroLivre: 9.15, penalti: 9.15 }, // m dos adversários ('area' = fora da área; pênalti: todos fora da área e da meia-lua)
  folgaRaio: 0.5,             // m a mais que o raio na restrição (a IA mira fora; a parede segura aqui)
  empurrao: 7,                // m/s — quem está dentro do raio sai andando/correndo a até esta velocidade
  // parede da parada pela locomoção (partida.js paredeParada): o pedido para dentro fica limitado a
  // √(2·freioParede·(distância à borda − margemParede)) — freia antes da borda com metade da freada
  // normal (JOGADOR.freio 6,2); quem está dentro sai a √(2·freioParede·(fundo + margem)), entre
  // saiParede e empurrao; "dentro" = mais de dentroParede m além da borda
  freioParede: 3,             // m/s²
  margemParede: 0.3,          // m
  saiParede: 1.0,             // m/s
  dentroParede: 0.02,         // m
  forcaCobranca: { saida: 0.35, lateral: 0.45, lateralLonga: 0.6, escanteio: 0.65, tiroLivre: 0.45, tiroLivreLongo: 0.65, tiroDeMetaLongo: 0.85 }, // força do botão da IA
  // pênalti da IA (Regra 14): canto sorteado pelo m.rng — z da mira (m do meio do gol) com o peso de cada um; força
  // sorteada na faixa (a dispersão do chute do acoes.js faz o resto: fora e na trave)
  penaltiIA: { mira: [[-2.75, 0.32], [-1.6, 0.12], [0, 0.12], [1.6, 0.12], [2.75, 0.32]], forca: [0.62, 0.9] },
  // tiro livre DIRETO da IA: chuta a gol a até `chuteMax` m (fora disso, passa/lança)
  tiroLivreDireto: { chuteMax: 30, forca: [0.7, 0.9] },
  repeteCobranca: 1.0,        // s — se a cobrança não saiu (pedido expirou), a IA aperta de novo
  livreAte: 1.5,              // s antes de paradaMax: a IA cobra mesmo sem a zona livre (trava proibida)
  subsMax: 5,                 // IFAB Regra 3: 5 substituições...
  paradasMax: 3,              // ...em 3 paradas (o intervalo não conta)
  // Acréscimos (IFAB Regra 7.3: substituições, atendimento, cera, cartões, comemoração...), em minutos DO JOGO,
  // anunciados aos 45' e aos 90'. Premier League (dados oficiais): o jogo dura ~101,7 min em 2023/24 e ~99,9 em
  // 2024/25 (~10–12 min de acréscimo somando os dois tempos, mais no 2º). Base sorteada pelo m.rng + o que parou
  // naquele tempo; arredondado e limitado.
  acrescimos: {
    base: { 1: [1, 3], 2: [3, 5] },  // min sorteados (uniforme)
    porGol: 0.5,                      // comemoração (a PL tira os primeiros 30 s desde 2024/25)
    porSubstituicao: 0.25,            // as trocas saem em janelas de 2–3 (IFAB: ~30 s cada janela)
    porImpedimento: 0,                // a parada do impedimento é rápida (tiro livre na hora)
    max: { 1: 5, 2: 10 },
  },
};

// Bolas paradas da Etapa 4 (lateral.js; partida.js). Lateral (IFAB Regra 15): de frente para o campo, parte de cada pé
// na linha ou fora dela, as duas mãos levando a bola de trás e por cima da cabeça; adversários a 2 m. Arremesso de
// 12–19 m/s entre jogadores homens, solto a ~2,3 m de altura, alcance máximo com ~30° (Linthorne & Everett 2006, que
// citam Messier & Brody 1986, Kollath & Schwirtz 1988 e Bray & Kerwin 2004). O esqueleto daqui é mais baixo (ombro a
// ~1,42 m, braço de 0,55 m: a mão alcança ~1,96 m): a bola fica e sai onde as mãos desenhadas alcançam.
export const LATERAL = {
  tras: 0.1,                  // m — segurando: a bola atrás do meio da cabeça...
  altura: 1.84,               // ...nesta altura (as palmas dos dois lados dela)
  topo: 1.94,                 // m — o arco passa por cima da cabeça nesta altura...
  soltaFrente: 0.24,          // ...e solta à frente do corpo...
  soltaAltura: 1.85,          // ...nesta altura
  tempo: 0.22,                // s do arco (de trás da cabeça até a soltura)
  seguimento: 0.35,           // s — os braços seguem o arremesso depois da soltura (só desenho)
  linha: 0.12,                // m — o centro do cobrador fora da linha (o pé da frente sobre ela)
  vMax: [12, 19],             // m/s — arremesso mais forte, pela força e pelo passe longo (12–19 m/s medidos)
  elevCurto: 0.3,             // rad — arremesso curto: chega ao recebedor na altura yRecebe
  elevLongo: 0.52,            // rad (~30°: o alcance máximo medido)
  yRecebe: 0.9,               // m — o curto chega na coxa/peito de quem recebe
  adiante: 1.5,               // m — no máximo isto à frente de quem recebe (o arremesso no pé)
  erroBom: 0.025,             // rad — dispersão do arremesso (passe 100)...
  erroRuim: 0.07,             // ...e (passe 0)
  dMin: 4, dMax: 28, dIdeal: 11, // m — as opções: companheiros a dMin–dMax m, de preferência a ~dIdeal m
  risco: 20,                  // peso do risco da linha (acoes.js riscoLinha) na nota de cada opção
  frente: 0.1,                // ganho por metro à frente da bola (até 15 m)
  pesos: [0.6, 0.27, 0.13],   // IA: chance de arremessar para a 1ª, 2ª e 3ª opção
  longaNaArea: 0.3,           // IA a ≤ longaDist m da linha de fundo atacada: chance do arremesso longo na área
  longaDist: 25,
  preferirLateral: 8,         // m de vantagem para o lateral/ala do time cobrar (é quem cobra no jogo de verdade)
};

// Tiro de meta (IFAB Regra 16, desde 2019/20): a bola parada em qualquer ponto da pequena área, chutada pelo goleiro; está
// em jogo quando é chutada e se move claramente; adversários fora da área até então, companheiros podem receber dentro
// dela. A saída curta com os zagueiros abertos nos cantos da área virou o padrão (pedido do dono, seção 8).
export const TIRO_DE_META = {
  dentro: 0.3,                // m para dentro da linha da pequena área
  z: 6,                       // m — no máximo isto do meio (do lado em que a bola saiu)
  curta: 0.55,                // IA: chance de sair curto (sorteada na montagem; só com um zagueiro livre)
  curtoLivre: 7,              // m — o zagueiro está livre se nenhum adversário está a menos disto
  esperaMax: 5,               // s da bola morta — na saída curta o goleiro espera os zagueiros abrirem até isto...
  chegou: 3,                  // ...(a esta distância do lugar deles)
  // zagueiros abertos: a ~aberto.u m da própria linha de fundo, a aberto.z m do meio (dentro da área, nos cantos);
  // o volante encosta na meia-lua; os laterais sobem pelos lados
  aberto: { u: 12.5, z: 17 }, volante: { u: 21, z: 0 }, laterais: { u: 30, z: 29 },
};

// Escanteio (pedido do dono, seção 8: "atacantes em zonas — 1º pau, 2º pau, marca do pênalti, entrada da área — e defesa
// mista, zona + individual"; bolas-paradas.js). Kubayi & Larkin 2020 (600 escanteios da Copa de 2018): a defesa mista
// sofreu menos gols (3,7%) que a só por zona (6,0%); os gols saem mais do meio e do 1º pau. Premier League ("which clubs
// are best at defending corners"): a maioria mistura zona e individual, com 4 na zona da pequena área (2 no 1º pau, 1 no
// meio, 1 no 2º pau). Copa de 2022 (570 escanteios): 2,6% viram gol. Montagem com corte de câmera (como a TV): cada um
// no seu lugar; na cobrança os atacantes atacam as zonas (escanteio.corrida s depois do chute, no máximo).
// Pontos em m: u = da linha de fundo atacada para dentro do campo; w = para o lado do escanteio (+) ou o outro (−).
export const ESCANTEIO = {
  // zonas do ataque (as 3 primeiras são as do cruzamento: acoes.js zonasCruzamento) e de onde cada um sai
  zonas: [
    { nome: 'centro', u: 7.5, w: 0, sai: { u: 11.5, w: -1.5 } },
    { nome: 'primeiroPau', u: 5.5, w: 2.2, sai: { u: 10, w: 3 } },
    { nome: 'segundoPau', u: 6.5, w: -3.2, sai: { u: 11, w: -5 } },
    { nome: 'marcaPenalti', u: 11, w: 0, sai: { u: 14, w: 1 } },
    { nome: 'entradaArea', u: 18.5, w: -2, sai: { u: 20.5, w: -3 } },
  ],
  segundaBola: [{ u: 24, w: 10 }, { u: 24, w: -12 }],   // quem sobra do ataque, na frente da área
  ficam: { u: 48, w: 11 },                               // os 2 que ficam atrás (contra o contra-ataque)
  // defesa: zona na pequena área (as 3 primeiras sempre; a 4ª com gente sobrando) e a sobra
  zonasDefesa: [
    { nome: 'meio', u: 4.5, w: -0.5 },
    { nome: 'primeiroPau', u: 2.2, w: 3.0 },
    { nome: 'frentePrimeiroPau', u: 5.5, w: 4.5 },
    { nome: 'segundoPau', u: 4.2, w: -4.2 },
  ],
  marca: 0.9,                 // m — o marcador individual fica do lado do gol do atacante, a esta distância
  borda: { u: 17, w: -1 },    // o da entrada da área (rebote; marca quem está lá)
  frente: { u: 38, w: 4 },    // quem fica lá na frente para o contra-ataque (1, ou 2 com gente sobrando)
  janela: 3,                  // s depois do chute em que os lugares do escanteio ainda valem (até alguém tocar)
  zonaIA: [0.35, 0.35, 0.3],  // IA: chance de cruzar no 1º pau, no 2º pau e na marca do pênalti
};

// Barreira no tiro livre direto (IFAB Regra 13: a 9,15 m da bola; com 3 ou mais na barreira, os atacantes a ≥ 1 m dela;
// bolas-paradas.js). Tamanho pela conta da Plus Magazine (Universidade de Cambridge, "The wall"): a largura que tapa o
// gol visto da bola (2/3 dele, a partir do 1º pau) ÷ ~0,45 m por defensor — no meio a 22 m dá ~4,5 (eles usam 4); perto
// e no meio, 5 ou 6 são comuns; de lado, menos. Opta (The Analyst): faltas no terço final chutadas a gol a ~27,6 m de
// mediana; ~2,4–4,4% dos chutes de falta viram gol nas grandes ligas.
export const BARREIRA = {
  distancia: 9.15,            // m da bola
  espaco: 0.5,                // m entre os centros de dois da barreira (ombro com ombro)
  cobre: 2 / 3,               // fração do gol que a barreira tapa, a partir do 1º pau...
  foraPau: 0.3,               // ...começando um pouco por fora dele (m)
  max: 5, min: 1,             // tamanho
  longe: 33,                  // m do gol — mais longe, sem barreira (ninguém chuta dali)
  deLado: 0.9,                // rad (~52°) — a bola mais longe que isto do eixo do gol (falta de lado, de cruzamento): no máximo 2
  ataque: 1.0,                // m — atacantes longe disto da barreira (Regra 13)
  corpo: 0.3,                 // m — raio do corpo na barreira (o atacante a ataque + corpo do centro de cada um)
  topo: 1.86,                 // m — topo da cabeça em pé
  salto: { altura: 0.4, tempo: 0.6 }, // pulo no chute: sobe até ~altura m (pela impulsão) em tempo/2 s
  restituicao: 0.35,          // a bola que bate na barreira volta com isso da velocidade normal...
  amortece: 0.55,             // ...e perde isso do resto
  alturaPassar: 2.32,         // m — o chute de falta mira para passar com o centro da bola acima disto na barreira
                              // (o topo do pulo fica a ~2,2 m + o raio da bola: o erro para baixo bate nela)
  goleiro: 0.6,               // m — o goleiro fica isto para o lado do 2º pau (a barreira cobre o 1º; mais longe, o chute
                              // por cima dela no canto do 1º pau entrava demais)
};

// Disputa pelo alto (Etapa 4, só na partida; sim.js bolaAltaNoCorpo): no toque aéreo de quem ia na bola (o recebedor
// do cruzamento, do lançamento...), um adversário a ≤ raio m do ponto que também alcança a altura dela disputa: ganha
// pela nota no alto (bolas-paradas.js notaAerea: cabeceio, impulsão, altura), com vantagem para quem está do lado do
// gol. O atacante ganha o 1º contato em ~40–53% dos escanteios (Copa América 2021: 52,6%; Premier League: a defesa
// ganha mais; FIFA Training Centre, Copas femininas 2019/2023). Quem perde não toca; quem ganha cabeceia — o atacante
// pressionado, com erroDisputa × a dispersão.
export const AEREO = {
  raio: 1.3,                  // m do ponto do toque até o adversário que disputa
  yMin: 0.9,                  // m — abaixo disto não é disputa no alto (peito/coxa: o domínio de sempre)
  k: 3.0,                     // ganho da diferença de nota (por 100 pontos) no logit
  ladoGol: 0.35,              // vantagem (logit) de quem está do lado do próprio gol
  erroDisputa: 1.8,           // o cabeceio de quem ganhou a disputa espreme mais (pressão no salto)
  perdeuSalto: 0.6,           // s — quem perdeu a disputa não toca na bola alta por isto (ainda no ar, caindo)
};

// Impedimento (IFAB Regra 11; impedimento.js). Posição de impedimento: no campo adversário (sem a linha do meio) e
// mais perto da linha de fundo que a bola E o penúltimo adversário, no instante em que um companheiro joga ou toca
// a bola; "na mesma linha" não é impedimento. A posição do corpo (o centro) conta — braços e mãos não contam
// (IFAB 2025/26). Infração só se o impedido toca a bola (jogada do companheiro, rebote da trave, do corpo de um
// adversário ou de uma DEFESA do goleiro); jogada deliberada do adversário (domínio, passe, chutão) zera. Não há
// impedimento recebendo direto de tiro de meta, lateral ou escanteio. Recomeço: tiro livre INDIRETO do outro time
// onde ele tocou a bola (PARTIDA.raio.tiroLivre: adversários a 9,15 m).
// Faltas e cartões (IFAB Regra 12; faltas.js). Só na partida (o treino não tem árbitro: o hash dele não muda).
// Imprudente (sem cuidado) = tiro livre direto; temerário (sem ligar para o perigo) = amarelo; força excessiva =
// vermelho. Amarelo também por parar um ataque promissor (SPA); vermelho por tirar uma chance clara de gol (DOGSO: a
// ≤ dogso.dist do gol, indo para ele, com a bola dominada, sem defensor entre ele e o gol além do goleiro) — dentro da
// área, tentando jogar a bola, é amarelo + pênalti. Dois amarelos = vermelho (o expulso sai; o time joga com um a
// menos; não pode ser substituído). Vantagem: o time que sofreu segue com a bola no ataque; se perder em `vantagem` s,
// volta à falta; o cartão sai na próxima parada.
// Partida da Premier League: ~22,8 faltas, 4,3 amarelos, 0,15 vermelho e 0,23 pênalti por jogo. A partida daqui tem ~1/3
// dos lances de um jogo de 90 min (~270 passes × ~900): faixas escaladas no painel.
export const FALTAS = {
  // bote da IA (sim.js boteIA) que chega: chance de ser falta pela chegada ao condutor (frente/lado/trás pelo rumo do
  // condutor), × (1 + porVel · (v − vLivre)⁺) pela velocidade de quem chega, × lerp(desarme 40 → 90: 1,3 → 0,7)
  // (× lento com o condutor parado/lento, abaixo de ACOES.boteIA.vParado: o bote nele chega devagar e de perto — sem
  // isso ~30% das tentativas viravam falta e o humano ganhava tiro livre só por ficar parado)
  bote: { frente: 0.2, lado: 0.42, tras: 0.8, porVel: 0.12, vLivre: 4, desarme: [1.3, 0.7], lento: 0.4 },
  // DIVIDIDA do humano que não ganha a bola com o pé no condutor (defesa.js resolverBote): as mesmas chances
  dividida: { perdeu: 1.0, tocou: 0.6 },
  // carga por trás (sim.js colisaoCorpos): o marcador bate no condutor por trás fechando a ≥ vMin m/s
  carga: { vMin: 1.8, chance: 0.5, naChanceClara: 0.2 },
  // falta tática (o marcador batido segura o condutor no contra-ataque: SPA → amarelo): chance por passo colado (não
  // na chance clara de gol: seria vermelho, e o defensor sabe)
  tatica: { dist: 1.4, chancePorPasso: 0.012 },
  temerario: 6.0,             // m/s — chegando por trás acima disto: temerário (amarelo)
  excessivo: 7.6,             // m/s — por trás acima disto: força excessiva (sorteio pelo `excessivoP`)
  excessivoP: 0.25,
  dogso: { dist: 30, angulo: 0.8 }, // m do gol; rad entre a corrida e o gol
  spa: { u: 10, vFrente: 3.5, defensores: 2 }, // ataque promissor: a ≥ u m do meio no ataque, indo para a frente a ≥ vFrente m/s, com ≤ defensores de linha à frente
  vantagem: 2.5,              // s
  vantagemVel: 3.0,           // m/s — vantagem só se quem sofreu segue com a bola indo para a frente a pelo menos isto
  queda: 0.7,                 // s — quem sofre a falta perde o equilíbrio (sem domínio, devagar)
  icone: 2.5,                 // s — o cartão em cima do jogador (desenho)
};

export const IMPEDIMENTO = {
  tolerancia: 0.1,            // m — "na mesma linha": até isto além da linha ainda vale (o benefício da dúvida)
  linhaMostra: 0.3,           // s — a linha desenhada aparece/some em
  linhaCongela: 2.2,          // s — no apito, a linha do lance fica parada (destacada) por este tempo
  // linha VIVA (a da defesa com a bola rolando, desenho): desligada — dono, 11/10: "não quero a linha de impedimento
  // durante o jogo; quando o jogo parar por impedimento, aí no replay vai mostrar a linha". Fica só a do lance no apito.
  linhaViva: false,
};

// ------------------------------------------------------------------------ Parte 2: tática e defesa
// Posição de referência por formação (tatica.js posicaoTatica; plano 2.3). Funções do k: goleiro,
// lateral (LD/LE/ADD/ADE), zagueiro, meioCentral (VOL/MC/MEI), meiaAberto (MD/ME/PD/PE),
// atacante (SA/ATA). k = [bola atrás do meio (t1→t2), bola à frente (t2→t3)], pesquisa §1.2.
export const TATICA = {
  terco: 17.5,                // m — t1: x' < −17,5; t3: x' ≥ 17,5 (referencial do time)
  linhaAltura: [26, 32.5, 40], // m da própria linha de gol, bola no centro, sem bola (Baixa/Média/Alta)
  // fator do z da vaga (Estreita/Normal/Aberta). Sem a bola a Normal é 1,12: a tabela é de posições
  // MÉDIAS, que encolhem a largura (o bloco desliza; pesquisa §1.2) — no instante, a Metrica tem
  // ~37 m no bloco médio (33 / 37 / 41 m na Compacta / Normal / Aberta, pesquisa §8)
  // (com a bola, Normal 1,0 → 1,04 no PR "IA intensa": a largura com a bola medida no jogo ficava em ~43,8 m,
  // abaixo da faixa real 44–54 — Metrica 48,3 —, com o time voltando mais compacto da recomposição)
  largura: { com: [0.9, 1.04, 1.18], sem: [1.0, 1.12, 1.24] },
  // Sem a bola, a altura da linha e a largura do bloco pela posição da bola (u, referencial do time),
  // medidas na Metrica (2 jogos, 33 475 amostras a 5 Hz; scratchpad p2/scripts/forma_por_bola.py):
  // [u da bola, altura da linha (m do gol), largura (m)], faixas de 5 m. A curva não é reta: a linha
  // anda ~0,6 m por metro de bola no meio e quase para nas pontas (o k único de 0,5 deixava a linha
  // ~3 m alta com a bola entrando no meu terço). A tabela entra pela diferença para u = 0 (a altura
  // da tática e a largura da formação continuam valendo com a bola no centro).
  formaPelaBola: [
    [-47.5, 4.9, 28.9], [-42.5, 7.9, 30.4], [-37.5, 10.9, 31.6], [-32.5, 13.3, 32.9], [-27.5, 15.6, 33.5],
    [-22.5, 17.8, 34.5], [-17.5, 21.1, 35.1], [-12.5, 24.2, 35.9], [-7.5, 26.9, 36.7], [-2.5, 30.0, 37.4],
    [2.5, 32.7, 37.1], [7.5, 36.1, 38.2], [12.5, 39.0, 38.6], [17.5, 42.1, 39.4], [22.5, 45.5, 39.7],
    [27.5, 47.0, 39.5], [32.5, 48.7, 39.8], [37.5, 49.5, 39.7], [42.5, 50.2, 38.9], [47.5, 49.9, 37.2],
  ],
  linhasSem: { mei: -1.5, ata: -0.5 }, // m — sem a bola, deslocamento das linhas do meio e da frente (ver tatica.js); com a Parte 3 integrada, −1,5/+2 deixava o meio–ataque em ~16,5 m (Forcher 2024: 13,2) e a frente sobrando à frente da bola (atrás da bola < 8)
  kFrenteSem: 0.85,           // k da frente sem a bola com a bola no campo de lá (o do atacante é 0,66)
  mentalidadeBloco: 3,        // m por nível de mentalidade (−2..+2), bloco inteiro
  lateralSobe: 1,             // m a mais por nível acima de 0, com a bola, para os laterais/alas
  naArea: [2, 2, 3, 4, 5],    // atacantes na área no cruzamento, por mentalidade (−2..+2)
  blocoSegueLinha: 0.8,       // o resto do bloco acompanha 80% da diferença da altura da linha
  linhaPiso: -46.5,           // x' mínimo da linha de defesa (≥ 6 m do gol)
  linhaTeto: 3.5,             // x' máximo (≤ 56 m do gol)
  linhaAtrasDaBola: 2,        // m — sem bola, com a bola atrás da linha: linha ≤ x'bola − 2
  limiteX: 51.5,
  limiteZ: 32.5,
  k: {
    goleiro: { sem: [0.2, 0.23], com: [0.23, 0.23] },
    lateral: { sem: [0.51, 0.6], com: [0.69, 0.54] },
    zagueiro: { sem: [0.51, 0.49], com: [0.57, 0.49] },
    meiaAberto: { sem: [0.6, 0.71], com: [0.66, 0.54] },
    meioCentral: { sem: [0.54, 0.57], com: [0.63, 0.49] },
    atacante: { sem: [0.43, 0.66], com: [0.49, 0.51] },
  },
  kz: {
    sem: { goleiro: 0.1, lateral: 0.3, zagueiro: 0.32, meiaAberto: 0.29, meioCentral: 0.41, atacante: 0.34 },
    com: { goleiro: 0.1, lateral: 0.23, zagueiro: 0.29, meiaAberto: 0.21, meioCentral: 0.35, atacante: 0.27 },
  },
  mistura: 0.8,               // s — ao trocar de fase, as referências com/sem se misturam nesse tempo
  antecipa: 0,                // s — a referência usa a bola onde ela estará (velocidade filtrada de quem a conduz)...
  antecipaDef: 0,             // s — ...a da linha de defesa (que tem de recuar a tempo)...
  antecipaMax: 6,             // m — ...no máximo isto à frente
  // Quem segue a referência (ia-tatica.js alvoCalmo). O alvo passa por um filtro de tau s (e a
  // velocidade dele por um de tauVel s). recuo: com o alvo andando para o meu gol, o ponto vai à
  // frente dele SÓ na profundidade, a velocidade × s s (no máximo max m; subindo, a fração sobeLinha /
  // recuoFrente[1] disso). quieto: parado a menos de [0] m do ponto até ele passar de [1] m. marcha:
  // anda (intensidade [2], ~1 m/s, abaixo da faixa de ~1,2–1,8 m/s em que o tronco treme) a menos de
  // [0] m até passar de [1] m, se o alvo anda a menos de [3] m/s. trote: mais longe, intensidade d / 14
  // no máximo [0] até [1] m e no mínimo [2] (~1,9 m/s, acima da faixa); corre além de corre m. giro:
  // rad/s do rumo pedido andando com a bola atrás do caminho (além de [2] rad), trotando e andando com
  // a bola à frente ([0], [1], [3]); virada além de [4] rad vai de uma vez. ajusta: com o alvo abaixo
  // de vParado m/s há [0] s, vai até ele com intensidade d / dist e fica a [1] m (retoma além de [2]).
  // tauPressa, tauVelPressa: filtros do ponto de quem pressiona e da velocidade dele (s). volta: com o
  // alvo a menos de [0] m do lado de trás do movimento (> 120°), freia e espera [1] s antes de voltar.
  // recomp: com o alvo recuando a mais de [0] m/s, vai à velocidade dele + [1] (no máximo [2] m/s).
  // passinho: quieto perto do alvo, anda até ele com intensidade [0] enquanto estiver a mais de [1] m.
  suave: { tau: 1.2, tauVel: 0.5, volta: [8, 1.0], passinho: [0.1, 0.6], recuo: { s: 3.6, max: 6 }, quieto: [1.5, 2.6], marcha: [3.5, 4.5, 0.18, 1.2],
    trote: [0.45, 12, 0.33], giro: [0.7, 1.4, 2.2, 6, 1.75], vParado: 0.25, ajusta: [0.5, 0.5, 1.0], dist: 6, corre: 12,
    tauPressa: 0.2, tauVelPressa: 0.3 },
  // a linha de defesa recua mais à frente da bola (Metrica: altura da linha por faixa)
  suaveLinha: { tau: 1.2, tauVel: 0.5, volta: [8, 1.0], passinho: [0.1, 0.6], recomp: [2.0, 0.5, 6.0], recuo: { s: 4.5, max: 7 }, quieto: [1.5, 2.6], marcha: [3.5, 4.5, 0.18, 1.2],
    trote: [0.45, 12, 0.33], giro: [0.7, 1.4, 2.2, 6, 1.75], vParado: 0.25, ajusta: [0.5, 0.5, 1.0], dist: 6, corre: 12 },
  // o apoio com a bola pela referência (sem a Parte 3): o mesmo, sem recuo
  suaveApoio: { tau: 1.2, tauVel: 0.5, volta: [8, 1.0], passinho: [0.1, 0.6], recuo: { s: 0, max: 0 }, quieto: [1.5, 2.6], marcha: [3.5, 4.5, 0.18, 1.2],
    trote: [0.45, 12, 0.33], giro: [0.7, 1.4, 2.2, 6, 1.75], vParado: 0.25, ajusta: [0.5, 0.5, 1.0], dist: 6, corre: 12 },
  sobeLinha: 0.5,             // fração do avanço (suave.recuo) da linha de defesa subindo com a bola
  recuoFrente: [0.5, 1],      // frações do recuo da linha da frente sem a bola, recuando e subindo (Forcher 2024: meio–ataque 11–15 m)
  avaliaTicks: 6,             // a IA tática reavalia a cada 6 ticks (10 Hz), escalonada por vagaIdx
  // quem trocou de vaga (Editar time) corre para a nova até chega m da referência dela (no máximo max s)
  reposiciona: { chega: 5, max: 8 },
  // arranque calmo (ia-tatica.js alvoCalmo): quem passou de rapido m/s e parou (< parado m/s) retoma um
  // ajuste de até dMax m trotando devagar (suave.trote[2]) por s s — anda-para-anda (teste-movimento)
  arranque: { rapido: 2.2, parado: 0.5, s: 2.0, dMax: 12 },
  // olhar da IA sem a bola na partida (ia-tatica.js olhaBolaPartida): velocidade filtrada em tauVel s
  // (o limite do desvio do tronco) e o desvio girando no máximo giro rad/s (o tremor é > 1,5 rad/s)
  olhar: { tauVel: 0.5, giro: 1.2 },
  // ---- intensidade e recomposição (PR "IA intensa", dono 10/10: "a IA não corre para trás";
  // PESQUISA-ETAPA3.md, "Intensidade e recomposição")
  // o meio atrás da bola no meu campo (tatica.js): referência do meio ≤ bola − [0] m, mas não a menos de
  // [1] + [2] × (distância natural da vaga até a linha) m à frente da linha de defesa, nem a menos de [3] m
  // do meu gol (a entrada da área)
  meioAtras: [2, 2.5, 0.2, 18],
  // RECOMPOSIÇÃO EM DISPARADA (ia-tatica.js recompor): sem a bola, quem está mais de `liga` m à frente do
  // alvo (a referência; para quem não é da frente, também atrás da bola em `atras` m) volta correndo até
  // ficar a menos de `desliga` m dele — CORRER (sprint) com mais de `corre` m de atraso; a frente que
  // fica para o contra-ataque (vaga com x ≥ 0 sem a bola) volta sem o sprint. Enquanto está à frente da
  // bola, o caminho é pelo lado do gol: o z anda só `lateral` do caminho até a referência. No máximo
  // `max` s seguidos (depois, o ponto calmo de sempre, por `pausa` s).
  // (liga também, nos `janela` s depois da perda, com mais de `ligaBola` m à frente da bola, para quem tem a
  // referência atrás dela)
  // (no jogo organizado, fora da janela, só liga com mais de `ligaOrganizado` m: a bola longa por cima)
  // (`respiro` s depois de uma recomposição acabada, a volta pela linha da bola espera)
  // (sprint só com urgência: bola a menos de `urgente` m do meio para o lado do meu gol, ou vindo para ele a mais
  // de `vUrgente` m/s)
  // (voltando, o ponto vai `marca` para o lado do gol do adversário que a zona dele reivindicou: acha o homem)
  recomp: { liga: 8, ligaOrganizado: 15, ligaBola: 1, janela: 6, respiro: 1.5, desliga: 3, atras: 2, corre: 11, urgente: 10, vUrgente: 4, lateral: 0.5, max: 10, pausa: 2, marca: 0.6 },
};

// IA sem a bola (plano 2.4; pesquisa §4). Por nível de pressão: [Baixa, Média, Alta].
export const IA_DEFESA = {
  contencao: [5.5, 2.75, 1.5], // m do condutor — 1º homem fora do gatilho, entre ele e o meu gol
  aperto: [1.5, 1.5, 0.6],    // m da bola — 1º homem no gatilho (e o boteIA do sim.js tenta tirar); na Alta, colado...
  apertoArranca: [6, 6, 2.5], // m — ...e aperta CORRER com o ponto além disto (IA.pressaoArranca = 6)
  engaja: [42, 66, 105],      // m do meu gol: com a bola mais longe que isto o 1º homem não sai do bloco (FM: linha de engajamento); Média 66 (era 60): com a saída de bola guardando a bola, o marcador a ≤ 3 m caía abaixo de 40%
  perigo: 30,                 // m do meu gol: bola mais perto que isto, o 1º homem aperta (todos os níveis)
  apertaSempre: [false, false, true], // pressão Alta: o 1º homem aperta sempre que engajado...
  doisApertam: [false, false, true],  // ...e o 2º aperta junto (nas outras, o 2º só aperta com gatilho na Alta)...
  segundoNoGatilho: [false, true, true], // ...e na Média também com gatilho (correções da contraprova: pressão coordenada)
  cobertura: 8.5,             // m — 2º homem (Média e Alta) atrás do 1º, do lado do gol (real: 2º marcador a 9,6 m)...
  coberturaLado: 3,           // m — ...e por dentro (na diagonal)
  desvio: [3, 1.4],           // m — quem segue a referência contorna o condutor adversário a menos de [0] m que está no caminho (a [1] m dele)
  coberturaFundo: 1.5,        // m — quem cobre sendo da linha de defesa fica no máximo isto atrás da própria referência (cobre de lado)
  apertoLado: 2,              // m — na Alta com gatilho o 2º aperta junto, fechando o lado de dentro
  antecipaContem: 0,          // s — a contenção e a contrapressão miram este tanto à frente pela velocidade do condutor (o aperto, IA.antecipaPressao)
  giroPressa: [3, 1.75],      // rad/s do rumo de quem pressiona (bola livre, aperto, contenção); virada além de [1] rad vai de uma vez
  livre: { histerese: 0.25, margem: 0.2, disputa: null }, // s — bola livre: vantagem de quem já ia; no passe deles, chegar isto antes do recebedor; disputa: só arranca (CORRER) com um adversário chegando até isto depois dele — null: arranca em toda bola solta (com 0,6 s o trote na bola solta custava ~0,5 chute por partida e o pedido do dono é jogo MAIS intenso; medido com 32 partidas)
  contemLead: 0.9,            // s — quem contém mira à frente pela velocidade do ponto (tira o atraso do filtro, 0,2 s, e do modo pressa, ~0,7 s: sem isso ele corria ao lado do condutor, a 0,6 m)
  // contrapressão: janela (s), quantos, a ≤ raio m da bola, e só com a perda fora do meu terço (u >
  // campo; ou perto da lateral) e sem estar em inferioridade a ≤ raio m (no máximo `inferioridade` a
  // menos que eles)
  // (PR "IA intensa": janela da Média 3 → 4 s e da Alta 5 → 7 s — FIFA 23 "pressão após perda"; com 5 s na Média,
  // como a regra dos 5 s de Bauer & Anzer 2021, o PPDA da Média caía para ~7, o dos times mais intensos da Europa,
  // abaixo da faixa 8–16 da pressão Equilibrada)
  contrapressao: { s: [0, 3, 5], max: [0, 2, 3], raio: 10, campo: -17.5, inferioridade: 1, dist: 1.6 }, // ...e vão a dist m da bola (1,6: a 0,8 m o desarme vinha em < 1 s e a retomada em ≤ 5 s ia a ~45%; Metrica 36,5%)
  zona: { raio: 7, peso: 0.6, frente: 1 }, // adversário a ≤ 7 m da referência, no máximo 1 m à frente dela, puxa 60% para o lado do gol dele
  marcaDist: 1.5,             // m do lado do gol do atacante marcado (individual e puxada da zona)
  // pressão Alta: a zona fecha a linha de passe do condutor para o adversário reivindicado (a até
  // alcance m do condutor), num ponto a `ponto` do caminho; e reivindica também quem está até
  // `frente` m à frente da referência (sobe para pressionar a construção)
  linhaDePasse: { pressao: [false, false, true], alcance: 25, ponto: 0.65, frente: 6 },
  individualArea: 20,         // m do meu gol: dentro disso, marcação individual dos atacantes na área
  frentePaga: 7,              // m a mais na distância ao condutor para ser o 1º homem vindo da frente da bola
  defesaPaga: 4,              // m a mais para quem é da linha de defesa, com a bola à frente da referência dele
  gatilhos: { janela: 1.5, passeTras: 3, toquePesado: 1.5, costas: 1.92, lateral: 27, alcance: 8, recepcao: true }, // s, m, m, rad (110°), |z|, m do 1º homem ao condutor; recepcao = a recepção de passe é gatilho
  transOf: 3,                 // s de transição ofensiva depois da retomada
  // gatilho de ESTADO "condutor lento" (pedido do dono, 11/10: "se eu deixo o meu jogador parado, ninguém pega a bola"):
  // o condutor adversário de linha com a velocidade filtrada abaixo de v m/s por s[pressão] s (+ longe s fora da linha
  // de engajamento) → o 1º homem sai do bloco e aperta a `aperto` m da bola (ao alcance do bote: com 1,5 m ele parava
  // fora dele) e o 2º cobre, em todos os níveis de pressão. Os gatilhos de BORDA (recepção, costas...) não pegam quem
  // fica parado: a contenção durava para sempre (Sportsessionplanner, 1 × 1: fechar, conter e dar o bote quando o
  // atacante dá a chance)
  lento: { v: 2.0, s: [0.8, 0.5, 0.3], longe: 0.5, aperto: 0.2 },
};

// ----------------------------------------------------------------------------- Parte 3: com bola
// IA com a bola (plano 2.5 e 2.6; pesquisa §5, §9 e §12 — ameaça esperada, xT). ia-ataque.js.
export const IA_ATAQUE = {
  // Apoio curto (Steiner 2018; Buckland 2004): os n mais perto do condutor procuram um ponto em
  // `direcoes` direções × `aneis` m em volta dele, a ≤ raioRef m da própria referência; distância ideal
  // `dist` m; linha livre no cone de Steiner (rad); histerese e compromisso (s) do ponto escolhido.
  apoio: { n: 2, dist: [8, 16], aneis: [12, 16], direcoes: 8, raioRef: 3, cone: 0.209, histerese: 1.3, compromisso: 0.75, antecipa: 0.8, pressa: 1000, colado: 6 },
  // Corridas nas costas (Ju 2023; SkillCorner; Metrica): começam até `folga` m atrás da linha, com
  // campoMin m às costas da defesa, o condutor de frente (< angFrente rad), andando (≥ vCondutor m/s) e sem adversário a
  // < marcadorLivre m, e a linha do passe até o destino com risco ≤ linhaMax; destino = linha + `alem`
  // m; recarga (s) por corredor; no máximo max[mentalidade ≥ +1] ao mesmo tempo; acabam se o condutor
  // não armar a enfiada/o lançamento em `espera` s (o corredor ficava impedido à toa) ou se, passada a linha, o
  // passe não sai em `alemMax` s.
  corridas: { folga: 15, alem: [8, 12], recarga: 8, campoMin: 15, angFrente: 1.05, marcadorLivre: 1.5, vCondutor: 1.5, max: [2, 3], espera: 2.0, linhaMax: 1, alemMax: 1.5 }, // alemMax 1,5 s (era 0,5: a corrida acabava antes do passe e o ataque perdia ~0,5 chute por partida)
  // Condutor: reavalia a cada avaliaTicks (10 Hz), histerese 1,25× e compromisso 0,5 s; chute até
  // chuteMax m (chuteMaxOfensivo com mentalidade ≥ +1); lançamento ≥ lancamentoMin m; transição
  // ofensiva: +transOfBonus nas opções à frente.
  condutor: { avaliaTicks: 6, histerese: 1.25, compromisso: 0.5, chuteMax: 28, chuteMaxOfensivo: 30, lancamentoMin: 30, transOfBonus: 0.2 },
  // Contra-ataque (ia-ataque.js contraAtaque; correções da contraprova, PR "IA intensa"): retomada em jogo corrido
  // com a bola a mais de `campo` m do meio para o lado de cá (u, referencial de quem retoma) e no máximo `atras`
  // jogadores de linha deles entre a bola e o gol deles → por `s` s o time joga o contra-ataque: transição
  // ofensiva com bônus `bonus` nas opções à frente e sem a posse da retomada (utilidade.posseRetomada).
  // Tenga 2010; Armatas 2022; PESQUISA-ETAPA3.md §16.5.
  contra: { atras: 6, campo: -30, s: 6, bonus: 0.5 },
  // Finalização de primeira (ia-ataque.js primeiraIA): recebendo passe rasteiro na área num ponto com chance de gol
  // ≥ xg, aperta CHUTE com a força `forca` para o pedido nascer `folga` s antes da bola (bola até alturaMax m).
  primeira: { xg: 0.12, forca: 0.6, folga: 0.25, alturaMax: 0.6 },
  // Utilidade do condutor (ia-ataque.js decidir): U = P·(V + posse) − (1 − P)·(C + posse), V = xT do
  // destino, C = xT do adversário onde a bola seria perdida ÷ risco aceito, posse = valor de ter a bola
  // (+ posseMeuCampo com o condutor no próprio campo: cheio até −10 m, zero a partir de +10 m; +
  // posseRetomada[0] nos posseRetomada[1] s depois de o time recuperar a bola).
  //  - passe: velocidade média vPasse (m/s); até passeMax m; longo perde precisão (erroDist por 20 m
  //    além de 20 m); recebedor com adversário a < pressaoRecebe m: −passePress na chance e
  //    −pressaoValor no valor; para impedido vale impedido×;
  //  - enfiada: no ponto da corrida a enfiadaLeads m do corredor (a força sai do ponto): rasteira a
  //    vEnfiada m/s (cortável no caminho) ou alta por cima da linha a vEnfiadaAlta m/s (× enfiadaAltaP);
  //  - lançamento: chance lancamentoP (bola alta disputada);
  //  - cruzamento: chance cruzamentoP[n] com n de linha na área (ou a ≤ cruzamentoRaio m dela, entrando)
  //    e valor cruzamentoV;
  //  - chute: xG = xgA·θ^xgB (θ = ângulo da boca do gol, teto xgMax) × (1 − bloqueio·risco da linha)
  //    × chute (× chuteLonge de fora da área) − chutePosse·posse; mira a miraPoste m do poste longe do
  //    goleiro; força chuteForca (perto → longe);
  //  - conduzir: 7 direções a passoAngConduz rad, conduzDist m à frente, × conduz (o tempo que leva);
  //    chance de manter pelos adversários a < manterRaio m do caminho (manterPeso; de lado/atrás
  //    manterLado), × manterArea[0] dentro da área e [1] a < manterPerto m do gol; quem segura a bola
  //    perde valor (conduzSolta: de [0] s a [1] s, até [2]×); analógico magConduz; CORRER com
  //    correrLivre m livres à frente (transição ou antes de correrAte m), condução curta com < curtaPerto m;
  //  - proteger: adversário a < protegeDist m, chance protegeP, no máximo protegeMax s por posse.
  utilidade: {
    posse: 0, posseMeuCampo: 0.025, posseRetomada: [0.02, 2], vPasse: 12, vEnfiada: 15, vChute: 25, passeMax: 40, erroDist: 0.25, pressaoRecebe: 3.5, pressaoValor: 0.5,
    passePress: 0.2, impedido: 0.3, enfiadaLeads: [6, 10, 14], vEnfiadaAlta: 13, enfiadaAltaP: 0.7, lancamentoP: 0.5, cruzamentoV: 0.25,
    cruzamentoP: [0.01, 0.06, 0.35, 0.4], cruzamentoRaio: 1,
    xgA: 0.4, xgB: 1.6, xgMax: 0.7, chute: 2.5, chuteLonge: 0.3, bloqueio: 0.4, chutePosse: 0.5, miraPoste: 2.6, chuteForca: [0.5, 0.75],
    passoAngConduz: 0.5, conduzDist: 5, conduz: 0.85, conduzSolta: [1.5, 4, 0.35], vConduz: 5.5, magConduz: 0.9,
    manterRaio: 3, manterPeso: 0.7, manterLado: 0.4, manterArea: [0.95, 0.7], manterPerto: 9,
    protegeDist: 1.5, protegeP: 0.7, protegeMax: 1.0, correrLivre: 10, correrAte: 25, curtaPerto: 2.5,
  },
  riscoMentalidade: [0.8, 0.9, 1.0, 1.1, 1.25], // risco de passe aceito, por mentalidade (−2..+2)
  // faixa do cruzamento (|z| > zLateral, u > xTerco); o ataque à área começa com a bola em u > xAtiva e
  // |z| > zAtiva (quem vai precisa de tempo para chegar)
  cruzamento: { zLateral: 20.16, xTerco: 30, zAtiva: 15, xAtiva: 17.5 },
  areaCorre: 6,               // m — quem vai à área e está mais longe que isto do ponto vai correndo (pressa)
  sobeCorrendo: 1000,         // m — alvo mais que isto à frente: sobe correndo (pressa; desligado: o tronco tremia)
  antecipa: 0.9,              // s — as referências usam a bola daqui a isto (o time anda com o passe)...
  antecipaFiltro: 0.5,        // s — ...filtrada (constante de tempo; sem saltos a cada toque)
  pressaMin: 0.6,             // s — quem entra na pressa fica nela por isto (sem trocar de modo a cada tick)
  impedimentoFolga: 1,        // m — fora da corrida, a referência não passa da linha adversária − isto
  naLinha: 5,                 // m — com a bola fora do nosso terço, os centroavantes ficam até isto atrás da linha
  // sobreposição: condutor de lado (|z| > w) no campo adversário → o lateral do lado passa por fora,
  // frente m à frente dele, a linha m da lateral
  sobreposicao: { w: 15, frente: 8, linha: 3 },
  oscila: { amp: 0, periodo: 6 }, // m, s — vem e vai do apoio (0 = desliga: com o ponto calmo da Parte 2 ele só fazia o apoio ir e voltar)
  rebote: { raio: 25, frente: 7 }, // chute meu no ar: quem está a < raio m do gol corre para frente m da linha do gol
  empurraRaio: 4,             // m — se quem faz a linha é o marcador (até isto), o atacante a empurra...
  empurraFolga: 0.2,          // m — ...ficando só isto atrás dela
  // desmarque: adversário a ≤ raio m e a menos de cone rad do caminho (alvo a ≥ longe m) → o alvo do
  // momento passa a lado m do lado dele (o lado fica por tempo s)
  contorna: { raio: 2.5, cone: 0.7, longe: 3, lado: 2.2, tempo: 1.0 },
  corredores: [9.16, 20.16],  // |z| — centro, meio-espaço e corredor lateral
  // Ameaça esperada (xT; Karun Singh 2018, grade aberta 12×8, Premier League 2017/18): chance de a
  // posse virar gol a partir da zona. Linha = faixa da largura (8 × 8,5 m, de w = −34 a +34; a grade
  // é simétrica), coluna = faixa do comprimento (12 × 8,75 m, do meu gol ao gol adversário), no
  // referencial do time com a bola: col = floor((u + 52,5) / 8,75), lin = floor((w + 34) / 8,5).
  xT: [
    [0.0064, 0.0078, 0.0084, 0.0098, 0.0113, 0.0125, 0.0147, 0.0175, 0.0212, 0.0276, 0.0349, 0.0379],
    [0.0075, 0.0088, 0.0094, 0.0106, 0.0121, 0.0138, 0.0161, 0.0187, 0.0240, 0.0295, 0.0407, 0.0465],
    [0.0089, 0.0098, 0.0100, 0.0111, 0.0127, 0.0143, 0.0169, 0.0194, 0.0241, 0.0286, 0.0549, 0.0644],
    [0.0094, 0.0108, 0.0102, 0.0113, 0.0126, 0.0148, 0.0169, 0.0200, 0.0239, 0.0351, 0.1081, 0.2575],
    [0.0094, 0.0108, 0.0102, 0.0113, 0.0126, 0.0148, 0.0169, 0.0200, 0.0239, 0.0351, 0.1081, 0.2575],
    [0.0089, 0.0098, 0.0100, 0.0111, 0.0127, 0.0143, 0.0169, 0.0194, 0.0241, 0.0286, 0.0549, 0.0644],
    [0.0075, 0.0088, 0.0094, 0.0106, 0.0121, 0.0138, 0.0161, 0.0187, 0.0240, 0.0295, 0.0407, 0.0465],
    [0.0064, 0.0078, 0.0084, 0.0098, 0.0113, 0.0125, 0.0147, 0.0175, 0.0212, 0.0276, 0.0349, 0.0379],
  ],
};

// -------------------------------------------------------------- Parte 4: humano na defesa e troca
// Botões de defesa do humano (plano 2.8; defesa.js): CONTER, DIVIDIDA e PRESSÃO. CARRINHO fica na Etapa 4.
// Mapa dos controles como no EA FC 25 (FIFPlay, KeenGamer, TeamGullit): segurar A = conter, B = bote em pé,
// segurar RB = companheiro pressiona. Taxa de acerto do bote em pé: 44–71% entre os titulares da Premier League
// 2022/23 (premierleague.com; definição Opta: tirar a bola do adversário num desarme legal no chão).
export const DEFESA_HUMANO = {
  // CONTER (segurar): o controlado acompanha o condutor sozinho, entre ele e o meu gol (a conta do 1º homem
  // da IA: ponto na linha condutor → gol; o corpo anda com a velocidade do condutor + a correção), sem bote.
  conter: {
    dist: [1.5, 2.2],         // m do condutor: parado → embalado (vRef)
    vRef: 6,                  // m/s do condutor em que a distância chega a dist[1]
    folgaBola: 0.9,           // m — o ponto fica pelo menos isto à frente da bola (na linha do gol)
    filtro: 0.1,              // s — velocidade e aceleração do corpo do condutor filtradas
    antecipa: 0.25,           // s — a velocidade pedida vai à frente pela aceleração do condutor
    ganho: 3,                 // 1/s — velocidade pedida = a do condutor + ganho × (ponto − corpo)
    aproxMax: 1.2,            // m/s — do lado do gol e a até perto m além do ponto, chega no condutor no máximo
    perto: 3,                 //       a esta velocidade relativa (recua a tempo quando ele arranca)
    lado: 0.8,                // m — o analógico de lado desloca o ponto (mostra o lado ao condutor)
    recua: 0.5,               // m — o analógico para o meu gol afasta (e para longe dele aproxima) até isto
    folgaCorrer: 0.25,        // m/s — pedido acima da corrida: CORRER liga abaixo do pedido − isto, solta acima + isto
  },
  // DIVIDIDA (borda): bote em pé. O pé sai na direção da bola e chega nela `tempo` s depois do aperto; ganha
  // se a bola estiver a ≤ alcance m do pé (que estica até `perna` m do corpo) e o condutor não tiver tocado
  // nos últimos semToque s; a chance sai do desarme × drible/controle (e da bola solta do pé), pelo m.rng.
  // Errar = semReacao s parado. Bola a mais de `longe` m no aperto: nunca ganha. tempo e semToque: 0,1 s (o
  // plano dizia ~0,15 s; o condutor apertado toca a cada 0,18–0,33 s e com 0,15 s sobravam ~2 ticks de
  // janela "entre toques" — medido no teste-defesa-humano).
  dividida: {
    alcance: 0.65, perna: 0.55, tempo: 0.1, semToque: 0.1, longe: 1.5, semReacao: 0.75,
    chance: [0.35, 0.65],     // limites da chance de ganhar (bote na hora certa)
    base: 0.55,               // chance com atributos iguais (meio da faixa de acerto real, 44–71%)
    porAttr: 0.01,            // por ponto de desarme acima da média de drible e controle do condutor
    solta: 0.12,              // a mais com a bola solta do pé do condutor (soltaIni → soltaIni + soltaFaixa m dele)
    soltaIni: 0.39, soltaFaixa: 0.435, // (0,45 e 0,5 × 0,87 com a condução curta de 12/10: a bola mais perto do pé)
    vSai: 3.2,                // m/s — a bola tirada sai para longe do condutor (como o boteIA)
    semDominio: 0.5,          // s — quem perdeu a bola não a domina de novo logo em seguida
  },
  // PRESSÃO (segurar): grava m.pedidoPressao[time] = tick (contrato da Parte 0). Pedido do dono, 11/10 ("o botão de
  // pressão não funciona"), como o "teammate pressure" do EA FC: vai quem CHEGA PRIMEIRO (defesa.js pressionadorDe:
  // tempo de chegada com aceleração `acel` m/s² e freada `freio` m/s² ao ponto a `colado` m do corpo do condutor, do lado
  // do gol, adiantado pela corrida dele até `leadMax` s; quem já vai leva `histerese` s de vantagem) — com o 1º homem da
  // IA já apertando, o botão chama o segundo. Aproximação em disparada até `chega` m do condutor (vindo por trás,
  // contorna a `contorno` m dele) e disputa na bola, pelo lado do gol (`naBola` m antes dela, adiantada `leadDisputa` s),
  // e vai na bola solta a mais de `bolaSolta` m do pé dele. Na disputa o corpo anda pela velocidade (a do condutor +
  // `ganho` × (ponto − corpo), até `aproxMax` m/s mais rápido que ele; por trás dele, a menos de `trasPerto` m, fechando
  // no máximo a `trasAprox` m/s: abaixo da carga por trás, FALTAS.carga.vMin). `filtro`: s da velocidade do condutor.
  pressao: {
    validade: 1, acel: 7, freio: 6.2, histerese: 0.3, colado: 0.5, leadMax: 1.2, chega: 2.5, contorno: 1.2,
    naBola: 0.3, leadDisputa: 0.15, bolaSolta: 0.435, filtro: 0.2, ganho: 3, aproxMax: 4, trasPerto: 1.5, trasAprox: 1.4,
  },
};

// Troca automática no jogo aéreo (plano 3.5; pesquisa §7: reavaliar no voo acerta ~97%).
export const TROCA_AEREA = {
  avaliaTicks: 6,             // reavalia a cada 0,1 s
  margem: 0.3,                // s — chega ao ponto da trajetória com esta folga (corrida real: reação e curva)
  janelaMarcado: 0.5,         // s — toque aéreo de um companheiro marcado para daqui a até isto: é ele que disputa...
  antecede: 3,                // ticks — ...salvo se a previsão confirmada põe outro na bola isto antes
  confirma: 2,                // avaliações seguidas com o mesmo melhor antes de trocar (0,2 s)
  folgaMin: 0.25,             // s de vantagem sobre o controlado
  correcoesMax: 1,            // trocas depois da primeira, por bola
  manualRecente: 0.5,         // s — TROCAR apertado há menos que isto: a escolha manual manda
  analogicoSolto: 0.25,       // |e| ≤ isto: assistência leva o controlado ao ponto de queda
};

// ------------------------------------------------------------------------ Replay (render: nunca muda o hash)
// Replay da transmissão (pedidos do dono de 11/10: "o replay não funciona"; "quando o jogo parar por impedimento, no
// replay vai mostrar a linha"). render/replay-anel.js grava os últimos `segundos` do que foi DESENHADO; os roteiros
// (render/replay-roteiro.js) escolhem o trecho, a velocidade e a câmera; render/replay.js posiciona as câmeras. A
// simulação fica parada durante o replay (como na pausa): o hash no mesmo tick é o mesmo com e sem replay. Tempos em s
// do jogo (60 passos = 1 s); vel = fração da velocidade real. Pesquisa: PESQUISA-ESTADIO.md §Replay.
export const REPLAY = {
  automatico: true,           // padrão do ajuste "Replays automáticos" da pausa (?replay=0 desliga)
  segundos: 10,               // s guardados no anel (600 passos; ~3,6 MB)
  vagas: 26,                  // por passo no anel: 22 em campo, os 2 treinadores (12/10) e folga (quem entra, 4º árbitro)
  // m — um treinador que andou mais que isto entre dois passos GRAVADOS (≤ 3 m/s: ~5 cm por passo) deu os passos de uma
  // cena com o mundo parado (substituição): o passo vira corte no anel e o replay não o desliza pelo gramado (contraprova)
  saltoTecnico: 0.25,
  // gol (na saída de bola; a comemoração entra antes): 1) TV na velocidade real, do chute − `antes` (ou do último corte)
  // até o gol + `depois`; 2) atrás do gol, alto, em câmera lenta, do chute − lentoAntes até o gol + lentoDepois;
  // 3) só no golaço (chute de ≥ `golaco` m do gol): lateral baixa bem lenta em volta do chute (FC 25: "3 ângulos").
  // TV + atrás ≤ `maximo` s; no golaço, os 3 planos ≤ `maximoGolaco` s (o começo do plano de TV encolhe, até `antesMin`
  // s antes do chute; depois o de trás do gol).
  gol: {
    antes: 4.0, antesMin: 1.5, depois: 0.8,
    lentoAntes: 1.0, lentoDepois: 1.0,
    lateralAntes: 0.6, lateralDepois: 0.5,
    vel: [1, 0.5, 0.35],      // TV, atrás do gol, lateral baixa
    maximo: 12, maximoGolaco: 14,
    golaco: 20,               // m do gol na hora do chute (fora da área)
    // 3ª e 4ª câmeras (pedidos do dono de 12/10: "uma é a visão em 1ª pessoa do jogador fazendo o gol"; "a 4ª pode ser a
    // visão do treinador"): entram DEPOIS de TV, atrás [e lateral], com orçamento PRÓPRIO (a parte antiga não muda):
    // extras ≤ `maximo` s; passando, encolhe nesta ordem: o começo da 1ª pessoa (até chute − primeiraMin), o fim da
    // parte 2 do treinador (até gol + parte2Min) e o começo da parte 1 (até chute − parte1Min)
    extras: { maximo: 7.0, primeiraMin: 0.4, parte2Min: 1.5, parte1Min: 0.3 },
  },
  // impedimento (no apito; pedido do dono de 12/10: "tipo aquelas cenas de replay do impedimento semiautomático"):
  // P1 'linha' — câmera ALINHADA com a linha (como o VAR: a linha fica em pé no quadro), `vel` de `antes` s antes do passe
  // (ou do último corte) até o passe; a linha entra em `linhaEntra` s no quadro do passe (sem congelar: só troca a
  // velocidade) e segue até o apito (o toque do impedido) em no máximo `depoisMax` s REAIS: a `velDepois` ou, com o apito
  // longe do passe (14% dos lances IA × IA: até 4,4 s), mais depressa, até `velDepoisMax` (a linha fica até o fim).
  // P2 'saot' — a ANÁLISE semiautomática congelada no passe (REPLAY.saot.impedimento.dura s). Total ≤ 7,5 s.
  impedimento: { antes: 1.0, vel: 0.6, linhaEntra: 0.25, velDepois: 1, velDepoisMax: 2, depoisMax: 2.2 },
  // Análise semiautomática (render/replay-saot.js; PESQUISA-ESTADIO.md §9.1): corte seco para o quadro do passe com só
  // os jogadores do lance (o impedido, o defensor da linha, quem passou e a bola), a câmera desce do alto (`elIni`°,
  // azimute final + `azIni`°, `distIni` × a distância final) em órbita até o quadro final oblíquo e fora do centro (PL:
  // "on an angle, off-centre"), a PAREDE do defensor (branco-gelo, translúcida, no x do quadril dele = a linha), o PLANO
  // do atacante (no x do quadril dele), pulsos no quadril (o ponto que vale na decisão do jogo: impedimento.js conta o
  // centro) e a decisão: vermelho (impedimento) ou verde (posição legal: parede, plano e linha do chão), com o selo.
  // Tempos em s desde o corte: [início, fim] de cada entrada; `decisao` = a cor e o selo; `dura` = o plano inteiro.
  saot: {
    impedimento: { dura: 3.6, orbita: [0.2, 2.0], parede: [0.2, 0.45], pulsoDef: [0.25, 2.0], plano: [0.85, 1.1], pulsoAtac: [0.85, 2.0], decisao: 2.0 },
    legal: { dura: 3.4, orbita: [0.15, 1.75], parede: [0.15, 0.35], pulsoDef: [0.15, 1.75], plano: [0.55, 0.75], pulsoAtac: [0.55, 1.75], decisao: 1.75 },
    cor: 0.15, selo: 0.2, batida: 0.6, // s — a cor da decisão entra em, o selo entra em, período do pulso
    // câmera: começa no alto e termina oblíqua (`elFim`° de elevação, `desvios`° fora do eixo da linha, do lado da TV;
    // tenta nessa ordem e fica na primeira que enquadra os dois — cilindros de `cilindro` m — com `folga` do quadro e
    // sobreposição ≤ `sobreposicaoMax`), distância ao ponto médio dos quadris em [`dist`] m, fov `fov`° (o do 16:9; mais
    // estreito abre), câmera ≥ `alturaMin` m e fora dos sólidos (placas, bancos: estadio-forma.js solidoEm)
    elIni: 68, azIni: 35, distIni: 1.3, elFim: [16, 22], desvios: [12, -12, 20, -20], dist: [9, 30], fov: 30,
    folga: 0.08, sobreposicaoMax: 0.30, alturaMin: 2, cilindro: { raio: 0.35, altura: 1.9 },
    // os dois longe na LARGURA do campo (~30+ m em z, um de cada lado): olhando pela linha, um fica perto e o outro longe
    // da câmera e o quadro de 12–24° não cabe os dois a ≤ 30 m (o perto sai por baixo). Então, nesta ordem: o mesmo
    // quadro mais longe (`longe`, até onde a arquibancada deixa) e, só se ainda não couber, a câmera sobe e abre
    // (`extra`, ainda oblíqua e fora do centro) — os dois sempre no quadro.
    longe: { elFim: [16, 22, 24], desvios: [12, -12, 20, -20, 25, -25], dist: [9, 45] },
    extra: { elFim: [30, 40, 52, 62], desvios: [12, -12, 25, -25, 40, -40], dist: [9, 75] },
    // ângulo de VERDADE do quadro final (câmera → ponto mirado, que sai do meio quando um está perto e o outro longe da
    // câmera): nos níveis da TV e `longe` o quadro só serve com a elevação em [el] e o desvio da linha em [desvio] graus
    meta: { el: [12, 24], desvio: [8, 25] },
    // parede do defensor (a faixa em z dos jogadores do lance ± margemZ; alfa de baixo para cima), plano do atacante
    // (± meiaLargura em z) e o anel do pulso (raio, largura e quanto cresce na batida)
    parede: { altura: 2.3, margemZ: 3, alfaBaixo: 0.35, alfaCima: 0.10, borda: 0.035 },
    plano: { meiaLargura: 1.2, alfaBaixo: 0.5, alfaCima: 0.16 },
    pulso: { raio: 0.36, largura: 0.06, cresce: 0.5 },
    cores: { gelo: 0xeef6ff, neutro: 0xd8dee2, impedimento: 0xff3b30, legal: 0x19e07a, pulso: 0x6fc3ff },
    // critério da POSIÇÃO LEGAL (replay-saot.js checagemLegal), margem pelo centro em m: "mesma linha" até `mesmaLinha`
    // (a tolerância do jogo, IMPEDIMENTO.tolerancia); apertado até `limite` (a faixa de alerta antiga da FIFA vai até
    // `alerta`; de 0,5 a 1,0 m o olho erra: 132 ms de atraso × 5–8 m/s, Bath 2022). No gol com checagem o replay ganha
    // até `extraGol` s (12 → 13 s; golaço 14 → 15 s).
    mesmaLinha: 0.10, alerta: 0.50, limite: 1.00, extraGol: 1.0,
  },
  // "Replay" na pausa: os últimos `segundos` (até o último corte), TV; pausa a menos de `minDepoisCorte` s de uma
  // montagem (falta, lateral...): o lance antes dela (o que parou o jogo)
  menu: { vel: 1, minDepoisCorte: 3 },
  transicao: 0.4,             // s — a faixa verde que cruza a tela na entrada e na saída do replay (CSS)
  // câmeras (m; fov vertical em graus para telas 16:9 ou mais largas: mais estreitas abrem para a mesma largura)
  // tv: a câmera de TV do jogo seguindo a BOLA gravada, antecipando pela velocidade dela `olhaFrente` s à frente no anel
  // (até `velMax` m/s; ao vivo ela antecipa pela do controlado)
  tv: { olhaFrente: 0.25, velMax: 10 },
  atras: { recuo: 13, altura: 6, lado: 0.35, ladoMax: 6, fov: 34, fovCelular: 30, mola: 5 },
  lateral: { recuo: 5, altura: 1.6, fora: 3.5, fov: 18 },
  // linha: na lateral do lado da TV, alta, no x da linha; o fov fecha no impedido e no defensor da linha (com folga)
  linha: { altura: 15, fora: 8, folga: 7, fovMin: 22, fovMax: 40 },
  // 1ª PESSOA do autor do gol (render/replay-olhos.js; PESQUISA-ESTADIO.md §13): olho = cabeça gravada + frente·`frente` +
  // cima·`cima` (o olho bruto); x/z por gaussiana σ `sigmaXZ` s presa a ≤ `prendeXZ` m do olho bruto na horizontal; y por
  // média móvel de `mediaY` s (um passo) e gaussiana σ `sigmaY` s — a cabeça do manequim sobe e desce até ±9 cm correndo e
  // o cérebro estabiliza o olhar (Pozzo & Berthoz 1991; nada de balançar no ritmo da passada) —, presa a [cabeça + yMin,
  // cabeça + yMax] e, por fim, dentro da esfera de raio `raioCabeca` em volta do centro da cabeça (o olho recua na
  // horizontal); rolagem 0.
  // Olhar: até chute − `baixaAntes` s a bola puxada `puxaAntes` para o centro da boca do gol (o autor vê o gol antes de
  // bater), sem descer mais que `arfagemAntes`° (a boca do gol no quadro também no celular deitado); de chute − baixaAntes a
  // chute + `baixaDepois`, a bola e o pé; depois a bola puxada `puxaGol` para o gol (cabeceio: a bola puxada `puxaAntes`
  // até `cabeceioOlhaGol` s antes do contato; perto do contato, `puxaCabeceio`); gaussiana σ `sigmaOlhar` s (`sigmaCabeceio`
  // no cabeceio); arfagem em [arfagem]; GIRO com limite de `giroMax` °/s no tempo do replay (ida e volta, a média) e
  // gaussiana σ `sigmaGiro` s por cima. Campo de visão HORIZONTAL `fovH`° fixo (exceção à regra do fov vertical: a faixa de
  // conforto é dada em graus horizontais); plano de recorte próximo `perto` m. 0,6× de chute − `antes` s a gol + `depois` s
  // (encolhe até chute − extras.primeiraMin). A bola some a < `bolaSome` m do olho; outro corpo a < `corpo` m da lente no
  // quadro corta o plano (fica se sobrar ≥ `sobraMin` s reais).
  primeira: {
    vel: 0.6, antes: 0.9, depois: 0.4, frente: 0.085, cima: 0.03, sigmaXZ: 0.08, mediaY: 0.33,
    prendeXZ: 0.02, yMin: -0.14, yMax: 0.16, sigmaY: 0.22, raioCabeca: 0.148,
    baixaAntes: 0.3, baixaDepois: 0.2, puxaAntes: 0.6, puxaGol: 0.35, sigmaOlhar: 0.10, sigmaCabeceio: 0.14,
    giroMax: 85, sigmaGiro: 0.05,
    arfagem: [-60, 15], arfagemAntes: -18, fovH: 90, perto: 0.10, bolaSome: 0.35, corpo: 0.3, sobraMin: 1.2,
    cabeceioOlhaGol: 0.15, puxaCabeceio: 0.5,
  },
  // VISÃO DO TREINADOR do time que marcou (render/replay-olhos.js): parte 1 = o que ele vê (olho na cabeça gravada,
  // gaussiana σ `sigmaOlho`; olhar a meio caminho da bola suavizada e do centro da boca do gol, σ `sigmaOlhar`;
  // teleobjetiva FIXA no plano com o quadro de `largura` m na distância do gol, fov vertical em [fovMin, fovMax]; ele sai da
  // lista de desenho), de chute − `antes` a gol + `corte`; parte 2 = corte seco para ele reagindo, de gol + corte a gol +
  // `fim`: câmera parada no gramado (z = meioZ − `recuoZ`, altura `altura`), girando por gaussiana σ `sigmaGiro` para
  // segui-lo, fov `fov`° (16:9; ×0,88 no celular), ele no terço esquerdo, a área técnica, o banco e a torcida de cá atrás.
  // Parte 2 com < `parte2Min` s sai; o plano com < `planoMin` s sai.
  treinador: {
    vel: 1, antes: 0.8, corte: 0.3, fim: 2.3, frente: 0.10, cima: 0.03, sigmaOlho: 0.1, sigmaOlhar: 0.12, puxaGol: 0.5,
    bolaNdc: 0.8, largura: 30, fovMin: 9, fovMax: 24,
    recuoZ: 0.7, altura: 1.5, fov: 30, sigmaGiro: 0.25, terco: 1 / 3, parte2Min: 0.8, planoMin: 1.0,
    dist: [4.5, 9], corpoMin: 0.6,
  },
};

// ------------------------------------------------------------------------ Comemoração do gol (render: nunca muda o hash)
// Pedido do dono de 11/10: "não tem cena de comemoração!!!". js/comemoracao.js (PURO) copia os 22 no tick do gol para um
// mundo de cena à parte e anda com a MESMA locomoção do jogo; por cima, gestos por IK e os golpes de corpo inteiro
// (joelhos, pulo, giro). A página (main.js) só SEGURA o laço antes do tick da montagem da saída (gol + 150) enquanto a
// cena e o replay rodam: a saída sai no mesmo tick, com o mesmo hash. Ordem: gol → comemoração → replay → saída de bola.
// Tempos em s desde o gol; distâncias em m. Pesquisa: PESQUISA-ESTADIO.md §10.
export const COMEMORACAO = {
  ligada: true,               // padrão (?comemoracao=0 desliga; os testes que não são dela abrem com ele)
  pularDepois: 0.5,           // s — antes disso nenhum aperto pula (o chute que fez o gol não pula a cena)
  passosCortina: 40,          // passos da simulação por quadro quando a cena é pulada antes da hora (cortina)
  rede: 1.2,                  // s — plano da rede (a câmera do gol do jogo) até o 1º corte; o "GOL!" sai no corte
  reage: 0.3,                 // s — o autor termina o chute antes de arrancar para o alvo
  velCorrida: 0.95,           // × vArrancada do autor
  parada: 1.2,                // m do alvo em que a finalização em pé começa (o autor para e vira para a torcida)
  alvoMin: 8, alvoMax: 22,    // m — o alvo mais perto a ≥ alvoMin; além de alvoMax ele vem para perto do autor
  chegadaMax: 4.3,            // s — a finalização começa mesmo sem chegar (nunca acontece com alvoMax)
  final: 1.5,                 // s de finalização (joelhos, pulo, céu, braços, giro)
  abracoAte: 6.5, abracoMin: 1.2, // s — o abraço vai até abracoAte, e dura ao menos abracoMin depois da finalização
  reacao: 1.0,                // s — plano de quem sofreu, antes do replay
  // gol da IA contra o time do humano: cena curta (EA FC: "Celebration Camera Focus" no time do usuário)
  curta: { duracao: 4.5, alvoMin: 6, alvoMax: 13, final: 0.9, reacao: 1.0 },
  // colegas: até `max` (os mais perto do alvo, a ≤ raioBusca), saindo com atraso[0] + atraso[1]·i s, para vagas a `vaga`
  // m do autor, `abertura` rad entre elas, do lado do campo
  colegas: { max: 4, raioBusca: 45, atraso: [0.35, 0.15], vaga: 0.72, abertura: 0.85, vel: 0.92, abraco: 1.3 },
  separacao: 0.5,             // m entre os centros dos corpos na cena (o jogo usa 0,6; no abraço ficam mais perto)
  sofreu: { vel: 1.3, espera: 0.8, gesto: 0.6, gestoEntra: 0.5, meio: 6 }, // anda para a saída (x = lado·meio)
  resto: { vel: 2.8, desde: 1.2, para: 10 },     // o resto do time que marcou trota até `para` m do grupo (atrás da câmera do contraplano)
  agacha: { desce: 0.3, entra: 0.5, tronco: 0.35 }, // goleiro batido e autor do gol contra: agachados
  // de joelhos: o deslize começa a `inicio` m do alvo e desacelera até parar nele (entre decel[0] e decel[1] m/s²); o
  // joelho a `joelho` m do chão (centro da junta), tronco `tronco` rad para trás, entra em `entra` s
  deslize: { inicio: 2.6, joelho: 0.065, decel: [2.5, 7], tronco: 0.32, entra: 0.28 },
  // pulo: agacha `agacha` s (desce `desce` m), estende em `estende` s, voo balístico de `altura` m (as pernas encolhem
  // `encolhe` m), aterrissa em `aterrissa` s; o giro dá uma volta inteira no voo
  pulo: { agacha: 0.2, estende: 0.1, desce: 0.14, altura: 0.5, encolhe: 0.16, aterrissa: 0.35, espera: 0.8 },
  festa: { altura: 0.13, freq: 1.8 },             // pulo do grupo no abraço (m, Hz)
  // câmera (fov vertical em graus para 16:9; o celular fecha `celular` e põe o autor no terço esquerdo)
  camera: {
    steadicam: { frente: 6.5, lado: 2.4, altura: 1.6, fov: 32, media: 0.3, rumo: 0.5 },
    contraplano: { atras: 7.5, lado: 2.5, altura: 1.3, alem: 6, olharY: 2.4, fov: 36 },
    reacao: { dist: 4.8, altura: 1.5, olharY: 0.95, fov: 30, ladoTV: 0.35 },
    celular: 0.88, terco: 1 / 3, limite: 5.5,
  },
};

// ------------------------------------------------------------------------ Cena de substituição (render: nunca muda o hash)
// Pedido do dono de 12/10: "quando tiver substituição, quero que tenha a cena de substituição, só jogador saindo e
// entrando, e embaixo, no modelo, a informação de quem entra e quem sai". js/substituicao.js (PURO) copia os 22 para um
// mundo de cena à parte (a receita da comemoração) e anda com a MESMA locomoção do jogo; a página (main.js) SEGURA o
// laço depois do passo que trouxe as trocas enquanto a cena roda (o mundo não muda: hash igual). Regra 3.3 da IFAB:
// quem sai vai pelo ponto MAIS PERTO da linha; quem entra só depois, pela linha do meio-campo, com o sinal do árbitro.
// Planos (s): SAI (câmera de ala, de fora da linha, no rosto de quem sai) → [SAI2 com 2 pares ou mais] → ENTRA (câmera
// baixa no gramado do lado de cá: o quarto árbitro com a placa, o banco ao fundo e os reservas cruzando a lateral no
// meio-campo) → corte seco para a câmera de TV. Pesquisa: PESQUISA-ESTADIO.md §11; contrato: CONTRATOS.md.
export const SUBST = {
  ligada: true,               // padrão da opção "Cena de substituição" (desligada com webdriver, ?prints=1 e ?demo=1)
  sai: 2.4,                   // s — plano de quem sai (1 par)
  sai1de2: 2.2,               // s — o 1º plano de quem sai com 2 pares ou mais
  sai2: 1.6,                  // s — o 2º plano de quem sai (o 2º par)
  entra: 2.6,                 // s — plano de quem entra (o quarto árbitro com a placa)
  sinal: 0.5,                 // s do plano ENTRA antes do 1º reserva sair (o "sinal" com a placa no alto)
  escalona: 0.35,             // s entre um reserva e o próximo
  teto: 6.5,                  // s — nenhuma cena passa disto (até 5 + 5 pares)
  velSai: 2.2,                // m/s — quem sai anda firme (IFAB 2026/27: sair em até 10 s)
  freioSai: 2.0,              // m/s² — freada depois de cruzar a linha (para a ~alemLinha m dela)
  velEntra: 3.2,              // m/s — quem entra trota para a vaga
  distSai: [3.0, 3.6],        // m da linha no 1º quadro do plano dele (pelo hash)
  alemLinha: 1.2,             // m além da linha em que quem sai para (e aplaude)
  preRolagem: 1.1,            // s de caminhada invisível do 1º que sai (ele já entra no plano andando a 2,2 m/s)
  arranque: 0.4,              // m que o arranque do repouso atrasa (2,2 m/s em ~1 s: a 1,5 s andou 2,9 m e não 3,3)
  quarto: { x: 0, z: 35.6 },  // o quarto árbitro com a placa, de frente para o campo
  espera: { x0: 0.7, passo: 0.8, z: 35.2 }, // reservas esperando na grama entre a lateral e as placas (x = ±(x0 + passo·k))
  cruzaX: 0.5,                // |x| do ponto em que o reserva cruza a lateral (Regra 3.3: pela linha do meio-campo)
  // outros pontos (× o lado do time; negativo = do outro lado da linha do meio, só se o outro time não troca) quando
  // alguém do jogo está parado a < cruzaFolga m do x (o cobrador do lateral no meio-campo)
  cruzaOpcoes: [0.5, 0.2, 0.85, -0.2, -0.5, -0.85], cruzaFolga: 0.85,
  // câmera de ala do plano SAI: altura, lado (m ao longo da linha a partir do ponto de saída), fora (m para fora da
  // linha, antes das placas) e fov (vertical, graus, para 16:9) que enquadra o corpo inteiro na distância de 7 m
  // (longe/foraMax: a 2ª grade, quando nenhuma da 1ª fica a ≥ lenteMin + 0,5 m de todos)
  camSai: { altura: 1.5, lado: [5, 7], fora: [1.5, 2.5], fov: 22, longe: [8, 9, 10, 4], foraMax: 3.2 },
  // câmera do plano ENTRA: no gramado do lado de cá, do lado contrário ao x da vaga, olhando o quarto árbitro
  camEntra: { x: 5, y: 1.4, z: 28, alvo: [0, 1.5, 35], fov: 26 },
  // enquadramento: os pés acima da faixa embaixo (fração da altura do quadro a partir de baixo) e a cabeça no alto
  pes: 0.27, cabeca: 0.92,
  lenteMin: 2.5,              // m — nenhum ator mais perto da lente que isto
  separacao: 0.55,            // m entre os centros dos corpos na cena (a comemoração usa 0,5; a régua do teste é 0,5)
  golRaio: 4.6,               // m do meio da linha de fundo: ninguém sai pela boca do gol (nem pela rede)
  golFolga: 0.15,             // m — quem sai pela linha de fundo perto do gol passa a golRaio + golFolga (o ruído do passo
                              // nunca o põe na boca do gol)
  pularDepois: 0.5,           // s — antes disso nenhum aperto pula
  placaTroca: 0.8,            // s — a placa passa de par em par (o do humano primeiro)
  aplauso: { freq: 2.4, entra: 0.3 }, // palmas de quem sai ao cruzar a linha (Hz; s para os braços subirem)
  idQuarto: 203,              // id do quarto árbitro (200–202: os árbitros do pré-jogo)
  // faixa ENTRA/SAI: ≥ min s na tela (mesmo com a cena pulada), porPar s por par (porParMuitos com 4 pares ou mais),
  // teto s, fade s
  faixa: { min: 4.0, porPar: 2.5, porParMuitos: 1.8, teto: 10, fade: 0.25 },
};

// Estádio (só desenho: nada da simulação usa). O TÚNEL por onde os times entram (o pré-jogo usa) fica no meio da
// arquibancada do lado de cá (z +, a da câmera de TV): a boca na frente dela (z = 44,5), 7 m de largura e 3,2 m de
// altura, e o corredor entra 12 m por baixo das cadeiras. Os BANCOS DE RESERVAS ficam na frente da arquibancada, atrás
// das placas, um de cada lado do túnel (x de ±5 a ±17).
export const ESTADIO = {
  tunel: { x: 0, z: 44.5, largura: 7, altura: 3.2, profundidade: 12, laje: 0.5 },
  bancos: { x: [5, 17], z: [41, 43.6], altura: 2.3 },
};
// ÁREA TÉCNICA (IFAB, Regra 1, "The Technical Area"; pedido do dono de 12/10: "quero a área técnica e o treinador"): vai
// 1 m além de cada lado dos assentos e, para a frente, até 1 m da linha lateral; demarcada, com linha da largura das
// outras (≤ 12 cm). Aqui: x de ±(bancos − 1) a ±(bancos + 1), a frente em z = meioZ + 1 (a borda de fora da linha) e o
// fundo encostado nas placas (z = placas − 0,3: a folga de estadio-forma.js solidoEm). Linha contínua (a Lei não diz o
// estilo; a Bundesliga usa um retângulo de giz), para dentro da área, nos 3 lados abertos (o 4º são as placas e o banco).
// O mandante (time 0) fica no banco de x < 0; o visitante, no de x > 0 (como as colunas do cortejo). Derivada, não digitada.
ESTADIO.areaTecnica = {
  x: [ESTADIO.bancos.x[0] - 1, ESTADIO.bancos.x[1] + 1],
  z: [CAMPO.meioZ + 1, CAMPO.meioZ + CAMPO.entorno - 0.3],
  linha: CAMPO.linha,
};

// ------------------------------------------------------------------------ Treinadores (render: nunca muda o hash)
// Os dois treinadores FICTÍCIOS em pé na área técnica (js/tecnicos.js, PURO): andam com a locomoção do jogo num mundo à
// parte, olham a bola, gesticulam por IK (os gestos da comemoração) e reagem ao jogo (instruem, aplaudem, reclamam,
// lamentam, comemoram o gol do time e sentem o gol sofrido). Pesquisa: PESQUISA-ESTADIO.md §12 (Smith & Cushion 2006:
// o silêncio é a maior categoria, ~40%; Copa 2022: 2,03 gestos táticos/min × 0,73 emocionais). Tempos em s; m; m/s.
export const TECNICOS = {
  ids: [210, 211],            // 200–203 são os árbitros
  estatura: [1.80, 1.76],     // m (nominal: o manequim é o mesmo dos jogadores, como a altura deles)
  // base: centro do corpo em z; em x, o centro do banco + `segue`·(bola.x − centro), preso em |x| ∈ xLim; o alvo vai por
  // mola crítica de `tau` s
  zBase: 36.2, segue: 0.3, xLim: [4.6, 17.4], tau: 1.5,
  // recuo (não tapar a TV): a bola prevista daqui a `previsao` s em z ≥ zBola a ≤ dx m em x dele, ou lateral/falta/
  // escanteio do lado de cá a ≤ `parada` m → z = `z` (1,85 m de corpo em z 39,2 não cruza o raio da TV do celular — 46 m
  // atrás do foco, 12,3 m de altura — nem com a bola na linha: z ≥ 39,14 m; tools/teste-tecnicos.mjs T11)
  recuo: { z: 39.2, previsao: 1.5, zBola: 24, dx: 16, parada: 18, segura: 1.2 },
  // velocidades: anda (≤ 1,4 m/s, ≤ 1,5 m/s²), recua de costas (≤ 2), comemora/esquiva (≤ 3, ≤ 6 m/s²)
  vel: { anda: 1.35, acel: 1.25, recua: 2.0, rapido: 3.0, acelRapida: 5.5, ganho: 1.6, freiaBorda: 2.5 },
  // margem do centro do corpo dentro da área em z e em x (os pés ficam a ≤ ~0,3 m do centro andando de lado; a régua
  // dos pés é 0,15 m); o recuo (z 39,2) cabe na de z
  margem: 0.5, margemX: 0.55,
  // esquiva: o caminho previsto da bola (rolagem exata de bola.js) a < `raio` m no próximo `janela` s → sai da linha
  // até `sai` m dela; jogador previsto a < `jogador` m → afasta
  esquiva: { raio: 0.75, janela: 1.0, sai: 1.25, alturaMax: 2.3, jogador: 1.6, prevJogador: 1.0 },
  // olhar: a cabeça segue a bola até `cabecaMax` rad do tronco; o tronco vem atrás (mola `tronco` s, até `troncoMax` rad
  // do quadril); o corpo de frente para o campo, virando até `corpoMax` rad para o lado da bola
  olhar: { cabecaMax: 1.22, tronco: 0.8, troncoMax: 0.6, corpoMax: 0.75, tau: 0.12, virarAnda: 0.7 },
  mistura: 0.35,              // s — toda troca de gesto mistura as juntas (smoothstep)
  maoPico: 6.5,               // m/s — o pico da mão na troca comum: a mistura cresce com a distância (1,5·d/maoPico)
  arcoMao: 0.25,              // m — a mão que iria pela cabeça na troca comum passa pela frente (o arco no meio dela)
  misturaGol: 0.2,            // s — o gol sofrido: as mãos vão para a cabeça (a comemoração usa comemora.sobe)
  misturaAgacha: 0.7,         // s — agachar e levantar (o corpo inteiro desce 0,3 m; as mãos vão junto)
  maoVel: [4, 7],             // m/s — teto da mão fora / dentro da comemoração
  // estados (durações em s, [mín, máx] sorteadas por hash01 no rng.js)
  postura: [6, 15], agachado: [2, 4], chanceAgachado: 0.08,
  anda: { cada: [20, 40], dist: [2, 5] },
  // instrui: na perda (chancePerda, em reage s), defendendo no próprio campo há > defendendo s, bola parada a favor no
  // ataque, lateral do lado dele e o time no terço final (chanceTerco por s); ≤ 1 a cada `intervalo` s
  instrui: { dura: [2.2, 3.2], reage: [0.3, 1.0], chancePerda: 0.6, intervalo: 12, defendendo: 6, construindo: 10, conchaDura: 1.0, terco: 17.5, chanceTerco: 0.25 },
  // aplaude: desarme do time (chance), defesa do goleiro, chute no alvo; incentivo: a bola recuperada (chanceRecupera) e
  // `passes` passes certos seguidos (chancePasses); ≥ `intervalo` s entre um e outro
  aplaude: { dura: [1.5, 2.0], freq: 2.5, intervalo: 5, chance: 0.85, chanceRecupera: 0.45, passes: 4, chancePasses: 0.7 },
  tensao: 22,                 // m do gol de lá: lance de perigo do time (sem palmas: ele olha a chance)
  reclama: { dura: [1.5, 2.5] },
  lamenta: { dura: [1.5, 2.5], janela: 2.5 },
  comemora: { comeca: [0.2, 0.23], dura: [4, 6], sobe: 0.2, levanta: 0.3, corre: [3, 6], socos: 2.0, pulo: 0.08, palmas: 2.5 },
  sofreu: { comeca: [0.25, 0.3], cabeca: [2, 3], depois: 2, vamos: 1.5 },
  intervalo: { dura: [2, 3] },
  // variantes de cada gesto (nomes para os testes; a ordem é a do sorteio)
  variantes: {
    observa: ['cruzados', 'cintura', 'queixo', 'costas', 'agachado'],
    instrui: ['aponta', 'concha', 'sobe', 'calma', 'gira'],
    aplaude: ['peito', 'cima', 'joinha'],
    reclama: ['abertos', 'cabecaAbre', 'pulso'],
    lamenta: ['cabeca', 'rosto', 'nuca'],
    comemora: ['socos', 'pulinhos', 'punho'],
    sofreu: ['cabecaCosta', 'cabecaAgacha', 'cabecaCruza'],
  },
};
