// Cessna 172S Skyhawk: geometria, massa e derivadas aerodinâmicas
// (valores típicos da literatura: Roskam, Stengel e o modelo c172 do JSBSim).
export const C172 = {
  mass: 1043,            // kg (2300 lb, com piloto e ~75% de combustível)
  S: 16.17,              // área da asa, m²
  b: 10.91,              // envergadura, m
  c: 1.49,               // corda média, m
  I: { roll: 1285, pitch: 1825, yaw: 2667 },   // kg·m²
  power: 134000,         // W (180 hp, Lycoming IO-360)
  staticThrust: 2400,    // N
  propEff: 0.8,
  rpmIdle: 650, rpmMax: 2700,
  // sustentação
  CL0: 0.31, CLa: 5.0, CLq: 3.9, CLde: 0.43, CLflap: 0.0125,   // por grau de flape
  alphaStall: 15.5 * Math.PI / 180, alphaNegStall: -12 * Math.PI / 180,
  // arrasto
  CD0: 0.027, K: 0.0565, CDflap: 0.0011, CDbeta: 0.17,
  // lateral
  CYb: -0.31, CYdr: 0.187,
  // rolamento
  Clb: -0.089, Clp: -0.47, Clr: 0.096, Clda: 0.13, Cldr: 0.0147,
  // arfagem
  Cm0: 0.04, Cma: -1.8, Cmq: -12.4, Cmde: -1.28, Cmflap: 0.002,
  // guinada
  Cnb: 0.065, Cnr: -0.099, Cnp: -0.03, Cnda: -0.02, Cndr: -0.0657,
  maxElev: 25 * Math.PI / 180, maxAil: 20 * Math.PI / 180, maxRud: 16 * Math.PI / 180,
  flapSteps: [0, 10, 20, 30],
  vne: 163 / 1.94384,    // m/s
  // trem de pouso (coordenadas locais: +x direita, +y cima, -z frente), rodas no contato
  gear: [
    { name: 'nose', p: [0, -1.33, -1.55], k: 52000, c: 4200, steer: true },
    { name: 'left', p: [-1.25, -1.33, 0.32], k: 62000, c: 5200, brake: true },
    { name: 'right', p: [1.25, -1.33, 0.32], k: 62000, c: 5200, brake: true },
  ],
  // pontos que não podem tocar o chão
  hardpoints: [[-5.45, 0.55, 0.05], [5.45, 0.55, 0.05], [0, 0.35, 4.6], [0, -0.35, -2.3], [0, -0.75, 0.9], [0, 1.25, 4.2]],
};

export const KT = 1.943844, FT = 3.28084, FPM = 196.8504;
export const G = 9.80665;
