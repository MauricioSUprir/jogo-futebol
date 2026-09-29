// Constantes físicas de Marte e parâmetros do jogo.
export const MARS = {
  g: 3.71,                      // m/s²
  solSeconds: 88775.244,        // 24 h 39 min 35,244 s
  obliquityDeg: 25.19,
  sunAngularDiamDeg: 0.35,      // ~2/3 do visto da Terra
  solarFraction: 0.43,          // irradiância média relativa à Terra (1,52 UA)
  radius: 3389500,
  phobos: { a: 9376e3, periodH: 7.6533, radius: 11.1e3 },
  deimos: { a: 23463e3, periodH: 30.312, radius: 6.2e3 },
  pressureKPa: 0.72,            // piso de Jezero (~ -2,3 km): um pouco acima da média de 0,61 kPa
};

export const GAME = {
  solRealSeconds: 40 * 60,      // 1 sol dura 40 minutos reais
  startHour: 7.2,               // hora marciana local no início (LMST)
  startLs: 35,                  // longitude solar: primavera no norte
  fixedDt: 1 / 60,
};

export const PLAYER = {
  radius: 0.34,
  halfHeight: 0.56,             // cápsula: 2*0,56 + 2*0,34 = 1,80 m
  walkSpeed: 1.45,
  runSpeed: 2.9,                // "lope" do traje, como nas caminhadas das Apollo
  groundAccel: 3.2,             // o traje (mais de 60 kg na Terra) tem muita inércia
  groundDecel: 4.0,
  airAccel: 0.35,
  jumpSpeed: 2.25,              // ~0,68 m de altura e ~1,2 s no ar com 3,71 m/s²
  turnRate: 5.5,                // rad/s
  maxClimbDeg: 36,
  slideDeg: 40,
  stepHeight: 0.32,
};

export const SUIT_COLORS = [
  { id: 'laranja', hex: '#e8702a', name: 'Laranja' },
  { id: 'azul', hex: '#2f6fe0', name: 'Azul' },
  { id: 'verde', hex: '#2aa865', name: 'Verde' },
  { id: 'amarelo', hex: '#f0c030', name: 'Amarelo' },
  { id: 'vermelho', hex: '#d63a3a', name: 'Vermelho' },
  { id: 'grafite', hex: '#4a4f58', name: 'Grafite' },
];
