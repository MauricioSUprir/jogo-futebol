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
  giroCorpoParado: 14,        // rad/s máximo parado
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
