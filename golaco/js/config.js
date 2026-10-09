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
  giroPorMetro: 0.006,        // 1/m — o giro cai ~10% em 18 m de voo (Tsukada & Sakurai 2008)
  // Contato com a grama.
  restituicao: 0.62,          // coeficiente de restituição vertical no quique
  atritoQuique: 0.55,         // atrito de deslizamento no impacto
  vQuiqueMin: 0.6,            // abaixo disso o quique vira rolagem
  // Rolagem: desaceleração cresce com a velocidade, dec = c·v^n + piso (ensaio FIFA "ball
  // roll" e portões EN 12234 / UEFA-NBI): saindo a 3,2 m/s para em ~7 m; a 2,5 m/s perde
  // ~0,55 m/s no 1º metro. O arrasto do ar entra à parte.
  rolagemC: 0.33,
  rolagemN: 1.35,
  rolagemPiso: 0.05,          // m/s² (a bola sempre acaba parando)
  rolagemMax: 5.4,            // m/s² — teto da resistência do gramado (≈ μ·g, μ ≈ 0,55; Cross 2002)
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
  afastamentoLateral: 0.09,   // m — pé plantado ao lado do centro do corpo
  alturaPasso: 0.12,          // m — altura do pé no meio do balanço (corrida)
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
  // Pedalada.
  pedaladaDuracao: 0.42,      // s
  pedaladaToqueDuplo: 0.3,    // s — dois toques no modificador dentro disso
  // Puxada de sola.
  puxadaVel: 2.4,             // m/s da bola puxada para trás
};

// Entrada.
export const ENTRADA = {
  zonaMorta: 0.16,            // radial
  zonaExterna: 0.95,          // acima disso conta como inclinação máxima
  magTrote: 0.55,             // inclinação até aqui = andar→trote; acima = corrida
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
};

// Etapa 2 — ações com bola (passe, enfiada, lançamento, cruzamento, chute). Valores iniciais;
// a calibração vem da pesquisa da Etapa 2 (PESQUISA-ETAPA2.md) e das medidas dos testes.
export const ACOES = {
  cargaCheia: 0.8,            // s segurando para a força máxima
  cargaMax: 1.2,              // s — depois disso solta sozinho
  pedidoValidade: 0.6,        // s — pedido sem toque possível expira
  pedidoPrimeira: 1.6,        // s — esperando a bola chegar para bater de primeira
  toqueDuplo: 0.35,           // s — dois toques no LANÇAMENTO = cruzamento rasteiro
  passe: { cone: 0.55, dMin: 3, dMax: 42, vChegada: [4.5, 9.5], adiante: 0.9, erroBom: 0.012, erroRuim: 0.07 },
  enfiada: { cone: 0.7, dMin: 5, dMax: 48, lead: [4.5, 12], vNoPonto: [3.5, 7], vMax: 26, erroBom: 0.015, erroRuim: 0.08 },
  lancamento: { cone: 0.5, dMin: 16, dMax: 62, elev: [0.5, 0.66], erroBom: 1.2, erroRuim: 6 }, // erro em m a 40 m
  cruzamento: { terco: 17.5, faixa: 20, elevAlto: 0.42, elevTenso: 0.16, vRasteiro: 11, yAlto: 2.0, yTenso: 0.9, setor: 0.44 },
  chute: { v: [14, 31], yAlvo: [0.35, 1.7], erroBom: 0.016, erroRuim: 0.075, colocadoV: 0.8, colocadoErro: 0.6, giroColocado: 26 },
  cavadinha: { goleiroFora: 5, distMax: 26, elev: 0.72 },
  cabeceio: { alcanceSalto: 2.55, alturaPeito: [0.45, 1.7], v: [9, 17] },
  pressaoDist: 2.2,           // m — adversário mais perto que isso pressiona o batedor
  primeiraErro: 1.4,          // multiplica o erro de jogada de primeira
};

// Goleiro (Etapa 2: posicionamento, defesa e saída). Valores iniciais (pesquisa da Etapa 2).
export const GOLEIRO = {
  reacao: [0.32, 0.2],        // s (ruim → bom)
  alcanceMergulho: 2.6,       // m do centro do corpo ao alcance da mão
  alcanceEmPe: 0.9,
  vMergulho: 5.2,             // m/s médio no mergulho lateral
  alturaMax: 2.45,            // m alcançados com a mão no alto
  distLinha: [0.6, 3.5],      // m à frente da linha (bola longe → perto)
  saidaMax: 35,               // m da linha até onde sai com o botão
  encaixeVMax: 20,            // m/s — acima disso tende a espalmar
};
