// Corpo do jogador: locomoção com limites humanos e passada com pés plantados no mundo.
// Sem three.js nem DOM. A MESMA função de passo é usada na simulação e na previsão do
// caminho do corpo (o planejador do toque prevê exatamente o que o corpo vai fazer).
//
// Estado cinemático (campos no próprio jogador):
//   x, z      centro do corpo (quadril projetado no chão)
//   vx, vz    velocidade
//   rumo      para onde o tronco aponta (rad); giro = velocidade angular do rumo
//   ax, az    aceleração suavizada (inclinação do tronco)
//   inv       true enquanto freia na linha para inverter o sentido (giro de 180°)
//   fase      passada em PASSOS (float): o pé j toca o chão quando fase cruza um inteiro n
//             com n ≡ j (mod 2); fica no chão por 2·carga passos.

import { JOGADOR, PASSADA, ATRIBUTOS_PADRAO, ENTRADA, PASSO } from './config.js';
import { clamp, difAng, normAng, tabela, porAtributo, lerp } from './mat.js';

/** Parâmetros derivados dos atributos (calculados uma vez). */
export function parametros(attr) {
  const a = { ...ATRIBUTOS_PADRAO, ...attr };
  const vArr = porAtributo(a.velocidade, JOGADOR.vArrancadaMin, JOGADOR.vArrancadaMax);
  const k = vArr / JOGADOR.vArrancada;
  return {
    attr: a,
    vAndar: JOGADOR.vAndar,
    vTrote: JOGADOR.vTrote * (0.92 + 0.08 * k),
    vCorrida: JOGADOR.vCorrida * (0.9 + 0.1 * k),
    vArrancada: vArr,
    vTeto: vArr * 1.04,
    acel0: porAtributo(a.aceleracao, JOGADOR.acel0Min, JOGADOR.acel0Max),
    // com a bola a arrancada perde força; quem conduz melhor perde menos (0,71–0,82)
    acelComBola: JOGADOR.acelComBola * (0.91 + 0.14 * a.drible / 100),
    freio: JOGADOR.freio * (0.9 + 0.2 * a.agilidade / 100),
    freioGiro: JOGADOR.freioGiro * (0.9 + 0.2 * a.agilidade / 100),
    latNormal: JOGADOR.latNormal * (0.9 + 0.2 * a.agilidade / 100),
    latCorte: JOGADOR.latCorte * (0.8 + 0.4 * a.agilidade / 100),
    tau: JOGADOR.tauVel,
  };
}

export function criarJogador(id, x, z, rumo, attr = {}, time = 0) {
  const par = parametros(attr);
  const j = {
    id, time,
    x, z, vx: 0, vz: 0, rumo, giro: 0, ax: 0, az: 0, inv: false,
    fase: 0,
    pes: [criarPe(x, z, rumo, 0), criarPe(x, z, rumo, 1)],
    par,
    // intenção (já em coordenadas do mundo)
    ix: Math.cos(rumo), iz: Math.sin(rumo), imag: 0, botoes: 0, botoesAnt: 0,
    intRumo: rumo, intW: 0,
    // controle de bola (preenchido por conducao.js)
    cond: null,
    // alvo de movimento sobrescrito pelo controlador (busca da bola, proteção, treino)
    alvo: null,
  };
  return j;
}

function criarPe(x, z, rumo, lado) {
  const s = lado === 0 ? -1 : 1;
  const rx = -Math.sin(rumo), rz = Math.cos(rumo);
  return {
    apoio: true,
    x: x + rx * s * PASSADA.afastamentoLateral,
    z: z + rz * s * PASSADA.afastamentoLateral,
    rumo,
    faseApoio: lado - 2, // fase em que tocou o chão
  };
}

/** Velocidade desejada pela inclinação do analógico e pelos botões. */
export function velocidadeDesejada(par, mag, correr, mod, comBola) {
  if (mag <= 0) return 0;
  let v;
  if (mag <= ENTRADA.magTrote) v = par.vTrote * (mag / ENTRADA.magTrote);
  else v = lerp(par.vTrote, par.vCorrida, (mag - ENTRADA.magTrote) / (1 - ENTRADA.magTrote));
  if (correr && mag > 0.3) v = par.vArrancada;
  if (comBola) {
    const f = JOGADOR.fatorComBola;
    const fator = v <= par.vTrote ? f.trote : v <= par.vCorrida ? lerp(f.trote, f.corrida, (v - par.vTrote) / (par.vCorrida - par.vTrote)) : lerp(f.corrida, f.arrancada, (v - par.vCorrida) / (par.vArrancada - par.vCorrida));
    v *= fator;
    if (mod) v = Math.min(v, JOGADOR.vConducaoCurta);
  }
  return v;
}

function suave(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Um passo do corpo. k = estado cinemático (jogador ou cópia de previsão).
 * (dx, dz) direção pedida (unitária), vel = velocidade pedida, rumoAlvo = para onde o
 * tronco deve apontar. Muda k no lugar. Pura (só depende dos argumentos).
 */
export function passoCorpo(k, dx, dz, vel, rumoAlvo, par, dt, comBola = false) {
  const s = Math.sqrt(k.vx * k.vx + k.vz * k.vz);
  const tau = par.tau;
  let ax, az;
  const a0 = comBola ? par.acel0 * par.acelComBola : par.acel0;
  const acelMax = a0 * Math.max(0.06, 1 - s / par.vTeto);
  if (s < JOGADOR.vGiroLivre) {
    // devagar: o corpo vai em qualquer direção, com limite de aceleração
    k.inv = false;
    ax = (dx * vel - k.vx) / tau;
    az = (dz * vel - k.vz) / tau;
    const freando = ax * k.vx + az * k.vz < 0 && vel < s;
    const lim = freando ? par.freio : Math.max(acelMax, par.freio * 0.5);
    const am = Math.sqrt(ax * ax + az * az);
    if (am > lim) { ax *= lim / am; az *= lim / am; }
  } else {
    const hx = k.vx / s, hz = k.vz / s;      // direção da velocidade
    const nx = -hz, nz = hx;                 // perpendicular (+90°)
    const c = dx * hx + dz * hz;
    const sn = hx * dz - hz * dx;
    const th = Math.atan2(sn, c);
    const ath = Math.abs(th);
    if (vel > 0.05 && (ath > JOGADOR.angInversao || (k.inv && ath > JOGADOR.angInversao - 0.35))) {
      // inversão: freia na linha (sem arco, sem deriva lateral) e só depois vira
      k.inv = true;
      ax = -par.freioGiro * hx;
      az = -par.freioGiro * hz;
    } else {
      k.inv = false;
      let along = (vel * c - s) / tau;
      let lat = (vel * sn) / tau;
      const L = par.latNormal + (par.latCorte - par.latNormal) * suave(JOGADOR.angCorte - 0.2, JOGADOR.angCorte + 0.2, ath);
      along = clamp(along, -par.freio, acelMax);
      lat = clamp(lat, -L, L);
      ax = along * hx + lat * nx;
      az = along * hz + lat * nz;
    }
  }
  const vx0 = k.vx, vz0 = k.vz;
  k.vx += ax * dt;
  k.vz += az * dt;
  // a freada da inversão não passa do zero (o corpo para e vira no lugar)
  if (k.inv && k.vx * vx0 + k.vz * vz0 <= 0) { k.vx = 0; k.vz = 0; }
  k.x += k.vx * dt;
  k.z += k.vz * dt;
  const ka = Math.min(1, dt / 0.1);
  k.ax += (ax - k.ax) * ka;
  k.az += (az - k.az) * ka;

  // rumo do tronco: mola crítica com limite de velocidade angular
  let alvo = rumoAlvo;
  const s3 = Math.sqrt(k.vx * k.vx + k.vz * k.vz);
  if (s3 > 2.5) {
    // correndo, o tronco não se afasta muito do sentido da corrida: no máximo ~80° a
    // 2,5 m/s e ~40° a 8 m/s (freando para inverter, até 75°). Ele vira junto com o corpo.
    const rv = Math.atan2(k.vz, k.vx);
    const lim = k.inv ? 1.3 : lerp(1.4, 0.7, clamp((s3 - 2.5) / 5.5, 0, 1));
    const d = difAng(rv, alvo);
    alvo = rv + clamp(d, -lim, lim);
  }
  const err = difAng(k.rumo, alvo);
  const wMax = lerp(JOGADOR.giroCorpoParado, JOGADOR.giroCorpoCorrendo, clamp(s3 / 8, 0, 1));
  const kr = JOGADOR.rigidezGiro;
  k.giro += (kr * err - 2 * Math.sqrt(kr) * k.giro) * dt;
  k.giro = clamp(k.giro, -wMax, wMax);
  // sem passar do alvo
  const passo = k.giro * dt;
  if (Math.abs(passo) > Math.abs(err) && Math.sign(passo) === Math.sign(err)) {
    k.rumo = normAng(k.rumo + err);
    k.giro = 0;
  } else {
    k.rumo = normAng(k.rumo + passo);
  }
}

/** Frequência de passos (Hz) e fator de carga pela velocidade. */
export function infoPassada(s, comBola) {
  const f = tabela(PASSADA.tabela, s, 1) * (comBola ? PASSADA.fatorComBola : 1);
  const carga = tabela(PASSADA.tabela, s, 2);
  return { f, carga };
}

/** Fase local do pé j em [0, 2): 0 = tocou o chão. */
export function faseLocal(fase, j) {
  let p = (fase - j) % 2;
  if (p < 0) p += 2;
  return p;
}

/** O corpo está "andando" (a passada avança)? */
function passadaAtiva(k, s) {
  return s > 0.22 || Math.abs(k.giro) > 1.6;
}

/**
 * Avança a passada de um passo de simulação. Atualiza os pés (toque no chão e saída).
 * Devolve eventos de pé ('pisou' j / 'tirou' j) no array ev (opcional).
 */
export function passoPassada(j, comBola, dt, ev) {
  const s = Math.sqrt(j.vx * j.vx + j.vz * j.vz);
  const { f, carga } = infoPassada(s, comBola);
  const ambosNoChao = j.pes[0].apoio && j.pes[1].apoio;
  if (!passadaAtiva(j, s) && ambosNoChao) return; // parado com os dois pés no chão
  const f0 = j.fase;
  let f1 = f0 + f * dt;
  // pé de apoio que ficou para trás demais (ou torto demais) sai antes: adianta a fase
  for (let p = 0; p < 2; p++) {
    const pe = j.pes[p];
    if (!pe.apoio) continue;
    const lado = p === 0 ? -1 : 1;
    const hx = j.x + (-Math.sin(j.rumo)) * lado * PASSADA.afastamentoLateral;
    const hz = j.z + Math.cos(j.rumo) * lado * PASSADA.afastamentoLateral;
    const d = Math.hypot(pe.x - hx, pe.z - hz);
    const torto = Math.abs(difAng(pe.rumo, j.rumo)) > 1.2;
    if (d > PASSADA.alcancePlantado || torto) {
      const psi = faseLocal(f1, p);
      const sair = 2 * carga;
      if (psi < sair) f1 += sair - psi + 1e-6;
    }
  }
  j.fase = f1;
  for (let p = 0; p < 2; p++) {
    const pe = j.pes[p];
    const psi0 = faseLocal(f0, p), psi1 = faseLocal(f1, p);
    const virou = f1 - f0 >= 2 || psi1 < psi0; // cruzou o 0 da fase local
    if (pe.apoio) {
      if (psi1 >= 2 * carga || virou) {
        pe.apoio = false;
        if (ev) ev.push({ tipo: 'tirou', pe: p, id: j.id });
      }
    } else if (virou) {
      plantarPe(j, p, carga, f);
      if (ev) ev.push({ tipo: 'pisou', pe: p, id: j.id });
    }
  }
  // parando: se a passada não está mais ativa, o pé no ar desce ao chão já
  if (!passadaAtiva(j, s)) {
    for (let p = 0; p < 2; p++) if (!j.pes[p].apoio) {
      plantarPe(j, p, carga, f);
      if (ev) ev.push({ tipo: 'pisou', pe: p, id: j.id });
    }
  }
}

/** Onde o pé p vai pousar se pousar agora (usado também pela animação no balanço). */
export function pontoPouso(j, p, carga, f, tempoAtePouso = 0) {
  const tm = tempoAtePouso + carga / Math.max(f, 0.5); // meio do apoio
  const lado = p === 0 ? -1 : 1;
  // rumo previsto no pouso (o tronco continua girando)
  const rumo = j.rumo + clamp(j.giro, -6, 6) * Math.min(tempoAtePouso, 0.25);
  const rx = -Math.sin(rumo), rz = Math.cos(rumo);
  return {
    x: j.x + j.vx * tm + rx * lado * PASSADA.afastamentoLateral,
    z: j.z + j.vz * tm + rz * lado * PASSADA.afastamentoLateral,
    rumo,
  };
}

function plantarPe(j, p, carga, f) {
  const pt = pontoPouso(j, p, carga, f, 0);
  const pe = j.pes[p];
  pe.apoio = true;
  pe.x = pt.x; pe.z = pt.z; pe.rumo = pt.rumo;
  pe.faseApoio = p + 2 * Math.floor((j.fase - p) / 2);
}

/** Copia só o estado cinemático (para previsão). */
export function copiaCinematica(j) {
  return {
    x: j.x, z: j.z, vx: j.vx, vz: j.vz, rumo: j.rumo, giro: j.giro,
    ax: j.ax, az: j.az, inv: j.inv, fase: j.fase,
  };
}

export const DT = PASSO;
