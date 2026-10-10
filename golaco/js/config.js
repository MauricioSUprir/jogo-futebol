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
  gol: { largura: 7.32, altura: 2.44, profundidade: 2.0, raioPoste: 0.06 },
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
};

// Condução (o toque planejado). Ver CONTRATOS.md.
export const CONDUCAO = {
  // Ponto de toque à frente do corpo (centro do quadril projetado), por modo.
  ofsFrente: { curta: 0.34, trote: 0.36, corrida: 0.33, arrancada: 0.42 },
  ofsLado: 0.06,              // para o lado do pé que toca
  // Passos entre toques, por modo (2 = um toque por passada).
  passosEntreToques: { curta: 1, trote: 2, corrida: 2, arrancada: 2 },
  faseToque: 0.8,             // fração do apoio do pé de apoio em que o outro pé toca
  antecedencia: 0.1,          // s — um toque é sempre marcado com essa antecedência
  alcance: 0.78,              // m — distância máxima bola–corpo para tocar
  folgaMax: 0.8,              // m — a bola não abre mais que isso à frente entre dois toques
  arcoMax: 0.15,              // m — curva fechada: o corpo sairia mais que isso da linha da bola
                              // até o próximo toque → toca a cada passo
  alcanceFrente: -0.15,       // m — a bola pode estar até 15 cm atrás do centro do corpo
  intervaloMin: 0.16,         // s entre dois toques
  angReplanejar: 0.35,        // rad — mudança de rumo pedido que antecipa o toque
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
  dominioErroAng: { bom: 0.05, ruim: 0.28 },
  dominioErroVel: { bom: 0.05, ruim: 0.35 },
  dominioVRef: 12,            // m/s — acima disso o domínio fica mais difícil
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

// Entrada.
export const ENTRADA = {
  zonaMorta: 0.16,            // radial
  zonaExterna: 0.95,          // acima disso conta como inclinação máxima
  magTrote: 0.55,             // inclinação até aqui = andar→trote; acima = corrida
  // Limiar ÚNICO de direção: abaixo disso (depois da zona morta) o pedido vale zero — o corpo
  // nem anda no rumo antigo nem anda sem virar o tronco (analógico leve no celular).
  magDirecao: 0.1,
  quant: 1024,                // a entrada é quantizada (replay compacto e determinístico)
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
  toqueDuplo: 0.35,           // s — dois toques no LANÇAMENTO = cruzamento rasteiro
  passe: { cone: 0.55, dMin: 3, dMax: 42, vChegada: [4.5, 8.0], adiante: 0.9, erroBom: 0.012, erroRuim: 0.07 },
  enfiada: { cone: 0.7, dMin: 5, dMax: 48, lead: [4.5, 12], vNoPonto: [3.5, 7], vMax: 26, erroBom: 0.015, erroRuim: 0.08 },
  lancamento: { cone: 0.5, dMin: 16, dMax: 62, elev: [0.5, 0.72], erroBom: 1.2, erroRuim: 6 }, // erro em m a 40 m
  cruzamento: { terco: 17.5, faixa: 20, elevAlto: 0.42, elevTenso: 0.16, vRasteiro: 11, yAlto: 2.0, yTenso: 0.9, setor: 0.44 },
  // chute (pesquisa da Etapa 2): máximo de 30–34 m/s nos melhores (Shinkai 2008; DFL); colocado
  // a ~0,85 do forte e com 30–40 rad/s de efeito (Whiteside 2010); força máxima ×1,15 no erro
  // (Carlsson 2018); pressão só de perto e pouca; de primeira ×1,15 (StatsBomb)
  chute: { v: [14, 31], yAlvo: [0.35, 1.7], erroBom: 0.016, erroRuim: 0.075, colocadoV: 0.85, colocadoErro: 0.6, giroColocado: 35, forcaMaxErro: 1.15, pressaoErro: 0.2, primeiraErro: 1.15 },
  // cavadinha (StatsBomb: 20% de gols, 41,8% no alvo; só funciona com o goleiro adiantado)
  cavadinha: { goleiroFora: 5, distMax: 26, elev: 0.72, alemDaLinha: 0.5, erroForca: [0.3, 0.15], erroDir: [0.14, 0.05] },
  // cabeceio (pesquisa da Etapa 2): a cabeça chega ~0,56 m acima da estatura com corrida (Fílter
  // 2022) — com 1,80 m, centro da bola a ~2,45 m; força própria de 6,4–8,3 m/s (Becker 2021)
  cabeceio: { alcanceSalto: 2.45, alturaPeito: [0.45, 1.7], v: [6, 17], potencia: [6, 8.5], redirecao: 0.35 },
  // domínio no peito/coxa: a bola morre com ~5–10% da velocidade (Iga & Nunome 2016: 9,73 → 0,52 m/s)
  dominioAereo: { sobra: [0.12, 0.05] },
  pressaoDist: 2.2,           // m — adversário mais perto que isso pressiona o batedor
  // bote da IA defensora (Etapa 2, enxuto; os botões de defesa e a disputa completa são da Etapa 3):
  // acompanha a ~1,5 m, ataca a bola solta do pé e tenta tirar só com ela ao alcance do pé
  boteIA: { distAcompanha: 1.5, bolaSolta: 0.7, alcance: 0.65, chancePorPasso: 0.08, descanso: 45, vSai: 3.2 },
  primeiraErro: 1.4,          // multiplica o erro de jogada de primeira
};

// Goleiro (Etapa 2). Pesquisa da Etapa 2 (PESQUISA-ETAPA2.md): reação de 0,19–0,25 s após o
// toque (Higueras-Herbada et al. 2020; Navia 2017); mergulho com o centro de massa a 3,6–4,0 m/s
// no pico e ~1,5 m de deslocamento, e a mão a ~3,5 m do ponto de partida (Monteiro et al. 2022;
// Ibrahim et al. 2019); profundidade no chute 1,2 m (pequena área), 1,8 m (área) e 2,1 m (fora),
// e chance de defesa pela distância lateral (StatsBomb Open Data, logística ajustada).
export const GOLEIRO = {
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
  logit: { c0: -0.35, cLat: -1.15, cDist: 0.2186, cAlt: -0.219, attr: 2.0 },
  // segurar × espalmar (StatsBomb): em pé, de longe ~60%; no mergulho ~25%; de perto ~23%
  segurar: { emPe: 0.6, mergulho: 0.25, perto: 0.23 },
  alturaMax: 2.45,            // m alcançados com a mão no alto
  profundidade: [1.2, 2.1],   // m da linha: bola a 6 m → a 20 m ou mais
  profundidadeLonge: 3.5,     // m com a bola a 40 m ou mais
  saida1x1Max: 4,             // m: contra quem domina a bola, fecha o ângulo sem passar disso
  vRecuo: 4.2,                // m/s voltando para o gol (bola por cima: cavadinha)
  recuoDefesa: [0.3, 0.75],   // chance de tirar a bola por cima ao chegar (sem folga → com 0,3 s)
  saidaMax: 35,               // m da linha até onde sai com o botão
  esperaHumano: 3.0,          // s com a bola nas mãos do goleiro do humano sem botão de ação: a IA repõe por ele
  esperaIA: 1.5,              // s que o goleiro da IA segura antes de repor
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
  // a saída e o escanteio esperam o time se posicionar; o lateral é rápido; o tiro de meta é do
  // goleiro com a bola nas mãos (a reposição que já existe: GOLEIRO.esperaIA / esperaHumano)
  montagemPor: { saida: 1.2, lateral: 0.3, escanteio: 1.2, tiroDeMeta: 0 },
  cobrancaIA: [0.6, 1.4],     // s que a IA espera para cobrar (sorteio pelo m.rng)
  cobrancaHumanoMax: 6,       // s desde a bola morta — depois disso a IA cobra pelo humano
  paradaMax: 8,               // s — nenhuma parada dura mais que isto (trava proibida)
  teleporteCobrador: 8,       // m — o cobrador é levado ao ponto na montagem; o evento do recomeço leva a
                              // distância (`levado`) e o HUD avisa acima disto (andar até lá: Etapa 4)
  raio: { saida: 9.15, lateral: 2, escanteio: 9.15, tiroDeMeta: 'area' }, // m dos adversários ('area' = fora da área)
  folgaRaio: 0.5,             // m a mais que o raio na restrição (a IA mira fora; a parede segura aqui)
  empurrao: 7,                // m/s — quem está dentro do raio na montagem sai a até esta velocidade
  forcaCobranca: { saida: 0.35, lateral: 0.45, lateralLonga: 0.6, escanteio: 0.65 }, // força do botão da IA
  repeteCobranca: 1.0,        // s — se a cobrança não saiu (pedido expirou), a IA aperta de novo
  livreAte: 1.5,              // s antes de paradaMax: a IA cobra mesmo sem a zona livre (trava proibida)
  subsMax: 5,                 // IFAB Regra 3: 5 substituições...
  paradasMax: 3,              // ...em 3 paradas (o intervalo não conta)
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
  largura: { com: [0.88, 1.0, 1.15], sem: [1.0, 1.12, 1.24] },
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
  linhasSem: { mei: -1.5, ata: 2 }, // m — sem a bola, deslocamento das linhas do meio e da frente (ver tatica.js)
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
  // tauPressa, tauVelPressa: filtros do ponto de quem pressiona e da velocidade dele (s).
  suave: { tau: 1.2, tauVel: 0.5, recuo: { s: 3.6, max: 6 }, quieto: [1.5, 2.6], marcha: [3.5, 4.5, 0.18, 1.2],
    trote: [0.45, 12, 0.33], giro: [0.7, 1.4, 2.2, 6, 1.75], vParado: 0.25, ajusta: [0.5, 0.5, 1.0], dist: 6, corre: 12,
    tauPressa: 0.2, tauVelPressa: 0.3 },
  // a linha de defesa recua mais à frente da bola (Metrica: altura da linha por faixa)
  suaveLinha: { tau: 1.2, tauVel: 0.5, recuo: { s: 4.5, max: 7 }, quieto: [1.5, 2.6], marcha: [3.5, 4.5, 0.18, 1.2],
    trote: [0.45, 12, 0.33], giro: [0.7, 1.4, 2.2, 6, 1.75], vParado: 0.25, ajusta: [0.5, 0.5, 1.0], dist: 6, corre: 12 },
  // o apoio com a bola pela referência (sem a Parte 3): o mesmo, sem recuo
  suaveApoio: { tau: 1.2, tauVel: 0.5, recuo: { s: 0, max: 0 }, quieto: [1.5, 2.6], marcha: [3.5, 4.5, 0.18, 1.2],
    trote: [0.45, 12, 0.33], giro: [0.7, 1.4, 2.2, 6, 1.75], vParado: 0.25, ajusta: [0.5, 0.5, 1.0], dist: 6, corre: 12 },
  sobeLinha: 0.5,             // fração do avanço (suave.recuo) da linha de defesa subindo com a bola
  recuoFrente: [0.5, 1],      // frações do recuo da linha da frente sem a bola, recuando e subindo (Forcher 2024: meio–ataque 11–15 m)
  avaliaTicks: 6,             // a IA tática reavalia a cada 6 ticks (10 Hz), escalonada por vagaIdx
};

// IA sem a bola (plano 2.4; pesquisa §4). Por nível de pressão: [Baixa, Média, Alta].
export const IA_DEFESA = {
  contencao: [5.5, 2.75, 1.5], // m do condutor — 1º homem fora do gatilho, entre ele e o meu gol
  aperto: [1.5, 1.5, 0.6],    // m da bola — 1º homem no gatilho (e o boteIA do sim.js tenta tirar); na Alta, colado...
  apertoArranca: [6, 6, 2.5], // m — ...e aperta CORRER com o ponto além disto (IA.pressaoArranca = 6)
  engaja: [42, 60, 105],      // m do meu gol: com a bola mais longe que isto o 1º homem não sai do bloco (FM: linha de engajamento)
  perigo: 30,                 // m do meu gol: bola mais perto que isto, o 1º homem aperta (todos os níveis)
  apertaSempre: [false, false, true], // pressão Alta: o 1º homem aperta sempre que engajado...
  doisApertam: [false, false, true],  // ...e o 2º aperta junto (nas outras, o 2º só aperta com gatilho na Alta)
  cobertura: 8.5,             // m — 2º homem (Média e Alta) atrás do 1º, do lado do gol (real: 2º marcador a 9,6 m)...
  coberturaLado: 3,           // m — ...e por dentro (na diagonal)
  apertoLado: 2,              // m — na Alta com gatilho o 2º aperta junto, fechando o lado de dentro
  antecipaContem: 0,          // s — a contenção e a contrapressão miram este tanto à frente pela velocidade do condutor (o aperto, IA.antecipaPressao)
  giroPressa: [3, 1.75],      // rad/s do rumo de quem pressiona (bola livre, aperto, contenção); virada além de [1] rad vai de uma vez
  livre: { histerese: 0.25, margem: 0.2 }, // s — bola livre: vantagem de quem já ia; no passe deles, chegar isto antes do recebedor
  contemLead: 0.9,            // s — quem contém mira à frente pela velocidade do ponto (tira o atraso do filtro, 0,2 s, e do modo pressa, ~0,7 s: sem isso ele corria ao lado do condutor, a 0,6 m)
  // contrapressão: janela (s), quantos, a ≤ raio m da bola, e só com a perda fora do meu terço (u >
  // campo; ou perto da lateral) e sem estar em inferioridade a ≤ raio m (no máximo `inferioridade` a
  // menos que eles)
  contrapressao: { s: [0, 3, 5], max: [0, 2, 3], raio: 10, campo: -17.5, inferioridade: 1, dist: 0.8 }, // ...e vão a dist m da bola
  zona: { raio: 7, peso: 0.6, frente: 1 }, // adversário a ≤ 7 m da referência, no máximo 1 m à frente dela, puxa 60% para o lado do gol dele
  marcaDist: 1.5,             // m do lado do gol do atacante marcado (individual e puxada da zona)
  // pressão Alta: a zona fecha a linha de passe do condutor para o adversário reivindicado (a até
  // alcance m do condutor), num ponto a `ponto` do caminho; e reivindica também quem está até
  // `frente` m à frente da referência (sobe para pressionar a construção)
  linhaDePasse: { pressao: [false, false, true], alcance: 25, ponto: 0.65, frente: 6 },
  individualArea: 20,         // m do meu gol: dentro disso, marcação individual dos atacantes na área
  frentePaga: 7,              // m a mais na distância ao condutor para ser o 1º homem vindo da frente da bola
  defesaPaga: 4,              // m a mais para quem é da linha de defesa, com a bola à frente da referência dele
  gatilhos: { janela: 1.5, passeTras: 3, toquePesado: 1.5, costas: 1.92, lateral: 27, alcance: 8 }, // s, m, m, rad (110°), |z|, m do 1º homem ao condutor
  transOf: 3,                 // s de transição ofensiva depois da retomada
};

// ----------------------------------------------------------------------------- Parte 3: com bola
// IA com a bola (plano 2.5 e 2.6; pesquisa §5, §9 e §12 — ameaça esperada, xT).
export const IA_ATAQUE = {
  apoio: { n: 2, dist: [8, 14], aneis: [9, 13], direcoes: 8, raioRef: 6, cone: 0.209, histerese: 1.3, compromisso: 0.75 },
  corridas: { folga: 2, alem: [8, 12], recarga: 6, campoMin: 15, angFrente: 1.05, marcadorLivre: 3, max: [1, 2] },
  condutor: { avaliaTicks: 6, histerese: 1.25, compromisso: 0.5, chuteMax: 28, chuteMaxOfensivo: 30, lancamentoMin: 30, transOfBonus: 0.2 },
  riscoMentalidade: [0.8, 0.9, 1.0, 1.1, 1.25], // risco de passe aceito, por mentalidade (−2..+2)
  cruzamento: { zLateral: 20.16, xTerco: 30 },
  impedimentoFolga: 1,        // m — fora da corrida, a referência não passa da linha adversária − isto
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
    solta: 0.12,              // a mais com a bola solta do pé do condutor (0,45 → 0,95 m dele)
    vSai: 3.2,                // m/s — a bola tirada sai para longe do condutor (como o boteIA)
    semDominio: 0.5,          // s — quem perdeu a bola não a domina de novo logo em seguida
  },
  // PRESSÃO (segurar): grava m.pedidoPressao[time] = tick (contrato da Parte 0). Leitor de referência em
  // defesa.js entradaPressao: o companheiro mais perto do condutor (≠ controlado e goleiro) aperta a
  // `aperto` m do lado do gol; troca de quem aperta só com outro `troca` m mais perto.
  pressao: { aperto: 1.5, troca: 2, validade: 1 },
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
