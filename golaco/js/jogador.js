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
import { MD } from './matdet.js';

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
    ix: MD.cos(rumo), iz: MD.sin(rumo), imag: 0, botoes: 0, botoesAnt: 0,
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
  const rx = -MD.sin(rumo), rz = MD.cos(rumo);
  return {
    apoio: true,
    x: x + rx * s * PASSADA.afastamentoLateral,
    z: z + rz * s * PASSADA.afastamentoLateral,
    rumo,
    // fase em que tocou o chão: com fase 0, o pé 0 acabou de pisar e o pé 1 pisou um passo antes
    faseApoio: lado === 0 ? 0 : -1,
    // no balanço: fase em que saiu do chão e fase em que vai pousar (a animação anda entre elas)
    // e o ponto onde vai pousar (lx, lz, lrumo) — a simulação planta o pé exatamente ali
    faseSaida: 0,
    fasePouso: 0,
    lx: x + rx * s * PASSADA.afastamentoLateral,
    lz: z + rz * s * PASSADA.afastamentoLateral,
    lrumo: rumo,
    // gesto do toque: peso (0–1) com que o pé desenhado vai até a bola e o ponto (gx, gz) aonde
    // ele vai. Só visual, mas integrado pela simulação com velocidade limitada (conducao.js
    // atualizarGesto) para a pose continuar função pura do estado e o pé nunca saltar.
    puxa: 0,
    gx: x + rx * s * PASSADA.afastamentoLateral,
    gz: z + rz * s * PASSADA.afastamentoLateral,
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
    const th = MD.atan2(sn, c);
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
    const rv = MD.atan2(k.vz, k.vx);
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
 * saida (opcional) = {pe, em}: um toque na bola vem aí com o pé `pe` (conducao.js
 * saidaParaToque). Com os dois pés no chão, a passada tira esse pé do chão em até `em` segundos
 * (o toque sai sempre do pé livre); parado, o pé que vai tocar não é apressado para pousar.
 *
 * A fase NUNCA salta: o pé no balanço é desenhado pela fase (anim.js), então um salto de fase
 * era um pé que teletransportava. Quando um pé precisa sair antes (ficou para trás, torto, ou
 * vai tocar a bola), só o ritmo aumenta, com limite (PASSADA.ritmo*). Também não há mais pouso
 * instantâneo: parando com um pé no ar, ele termina o passo (ritmoFimPasso).
 */
export function passoPassada(j, comBola, dt, ev, saida = null) {
  const s = Math.sqrt(j.vx * j.vx + j.vz * j.vz);
  const { f, carga } = infoPassada(s, comBola);
  const ambosNoChao = j.pes[0].apoio && j.pes[1].apoio;
  const ativa = passadaAtiva(j, s);
  const pedido = saida && ambosNoChao ? saida : null;
  const toqueVindo = !!saida;
  if (!ativa && ambosNoChao && !pedido) return; // parado com os dois pés no chão
  const f0 = j.fase;
  const sair = 2 * carga;
  // o pé no ar está no gesto do toque: a passada não acelera (o gesto acabaria de uma vez)
  const gesto = (!j.pes[0].apoio && j.pes[0].puxa > 0) || (!j.pes[1].apoio && j.pes[1].puxa > 0);
  let ritmo = f, ritmoFim = 0, gestoParado = false;
  for (let p = 0; p < 2; p++) {
    const pe = j.pes[p];
    if (pe.apoio) {
      if (gesto) continue; // o pé de apoio gira no lugar (pivô) até o gesto acabar
      // pé de apoio que ficou para trás demais (ou torto demais) sai antes: o passo acelera
      const lado = p === 0 ? -1 : 1;
      const hx = j.x + (-MD.sin(j.rumo)) * lado * PASSADA.afastamentoLateral;
      const hz = j.z + MD.cos(j.rumo) * lado * PASSADA.afastamentoLateral;
      const d = MD.hypot(pe.x - hx, pe.z - hz);
      const torto = Math.abs(difAng(pe.rumo, j.rumo)) > 1.2;
      if (d > PASSADA.alcancePlantado || torto) {
        const psi = faseLocal(f0, p);
        if (psi < sair) ritmo = Math.max(ritmo, Math.min((sair - psi + 1e-6) / dt, PASSADA.ritmoAdiantado * f));
      }
    } else if (!ativa) {
      // parado com o pé no gesto do toque (indo até a bola ou voltando dela) ou esperando o
      // toque que vem aí: o passo espera, para o pé não pousar antes nem voltar correndo. Os
      // outros pés no ar terminam o passo depressa (antes desciam ao chão num quadro só) —
      // inclusive o que não é o do toque: ajeita os pés antes de receber
      if (pe.puxa > 0 || (toqueVindo && saida.pe === p)) gestoParado = true;
      else ritmoFim = PASSADA.ritmoFimPasso;
    }
  }
  ritmo = gestoParado ? Math.min(ritmo, PASSADA.ritmoGestoParado) : Math.max(ritmo, ritmoFim);
  if (ritmo > f) {
    // a passada pode acelerar, mas sem o pé no ar passar da velocidade de um pé humano no
    // balanço (Clark et al. 2023: pico de 2,0 ± 0,15 × a velocidade do corpo). O pé anda pela
    // fase (anim.js): pico ≤ 1,5 × caminho × ritmo / (fase do balanço).
    const vMax = PASSADA.velPeBalanco[0] + PASSADA.velPeBalanco[1] * s;
    for (let p = 0; p < 2; p++) {
      const pe = j.pes[p];
      if (pe.apoio) continue;
      const caminho = MD.hypot(pe.lx - pe.x, pe.lz - pe.z);
      if (caminho < 1e-3) continue;
      ritmo = Math.max(f, Math.min(ritmo, vMax * (pe.fasePouso - pe.faseSaida) / (1.5 * caminho)));
    }
  }
  if (pedido) {
    // tira o pé do toque do chão a tempo (parado: no ritmo certo para sair `em` segundos depois)
    const psi = faseLocal(f0, pedido.pe);
    if (psi < sair) {
      const r = Math.min((sair - psi + 1e-6) / Math.max(pedido.em, dt), PASSADA.ritmoSaidaToque);
      ritmo = ativa ? Math.max(ritmo, r) : r;
    }
  }
  const f1 = f0 + ritmo * dt;
  j.fase = f1;
  const vPouso = (PASSADA.velPouso[0] + PASSADA.velPouso[1] * s) * dt;
  for (let p = 0; p < 2; p++) {
    const pe = j.pes[p];
    const psi0 = faseLocal(f0, p), psi1 = faseLocal(f1, p);
    const virou = f1 - f0 >= 2 || psi1 < psi0; // cruzou o 0 da fase local
    let saiu = false;
    if (pe.apoio) {
      if (virou) {
        // fez o ciclo inteiro no chão (passada muito lenta): conta como se tivesse pisado de novo
        pe.faseApoio = p + 2 * Math.floor((f1 - p) / 2);
      } else if (psi1 >= sair) {
        pe.apoio = false;
        pe.faseSaida = f1;
        pe.fasePouso = f1 + (2 - psi1); // o próximo inteiro n ≡ p (mod 2): é quando pousa
        saiu = true;
        if (ev) ev.push({ tipo: 'tirou', pe: p, id: j.id });
      }
    } else if (virou) {
      plantarPe(j, p);
      if (ev) ev.push({ tipo: 'pisou', pe: p, id: j.id });
    }
    if (!pe.apoio) {
      // ponto de pouso: onde o corpo vai estar no tick do pouso + meio apoio à frente. Segue o
      // previsto com velocidade limitada — não salta quando a velocidade do corpo muda de uma
      // vez (trombada) — e é exatamente onde o pé será plantado.
      const nt = Math.max(1, Math.ceil((pe.fasePouso - f1) / (Math.max(f, 0.5) * dt) - 1e-9));
      const pt = pontoPouso(j, p, carga, f, nt * dt);
      if (saiu) { pe.lx = pt.x; pe.lz = pt.z; }
      else {
        const dx = pt.x - pe.lx, dz = pt.z - pe.lz;
        const d = MD.hypot(dx, dz);
        const k = d > vPouso ? vPouso / d : 1;
        pe.lx += dx * k; pe.lz += dz * k;
      }
      pe.lrumo = pt.rumo;
    }
  }
}

/** Onde o pé p pousa se pousar daqui a tempoAtePouso segundos (o centro do apoio à frente). */
export function pontoPouso(j, p, carga, f, tempoAtePouso = 0) {
  const tm = tempoAtePouso + carga / Math.max(f, 0.5); // meio do apoio
  const lado = p === 0 ? -1 : 1;
  // rumo previsto no pouso (o tronco continua girando)
  const rumo = j.rumo + clamp(j.giro, -6, 6) * Math.min(tempoAtePouso, 0.25);
  const rx = -MD.sin(rumo), rz = MD.cos(rumo);
  return {
    x: j.x + j.vx * tm + rx * lado * PASSADA.afastamentoLateral,
    z: j.z + j.vz * tm + rz * lado * PASSADA.afastamentoLateral,
    rumo,
  };
}

/** Planta o pé p no ponto de pouso guardado (o mesmo que a animação mostrou no último tick). */
function plantarPe(j, p) {
  const pe = j.pes[p];
  pe.apoio = true;
  pe.x = pe.lx; pe.z = pe.lz; pe.rumo = pe.lrumo;
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
