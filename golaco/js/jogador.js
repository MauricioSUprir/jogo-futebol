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

import { JOGADOR, PASSADA, ATRIBUTOS_PADRAO, ENTRADA, PASSO, GESTO, CONDUCAO, BOLA, GOLEIRO } from './config.js';
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
    // a mira das ações (C6: a direção do analógico NA TELA levada ao gramado; sim.js aplicarEntrada)
    imx: MD.cos(rumo), imz: MD.sin(rumo),
    intRumo: rumo, intW: 0, saltoTick: -1, leituraTick: -1,
    // controle de bola (preenchido por conducao.js)
    cond: null,
    // alvo de movimento sobrescrito pelo controlador (busca da bola, proteção, treino)
    alvo: null,
    // pé que não sai do chão agora (pedalada: o outro passa por cima da bola) | null
    travaApoio: null,
    // Campos que os outros módulos põem no jogador DEPOIS de criado (sim, partida, escalação, IA,
    // ações, goleiro, defesa), já declarados aqui, na mesma ordem para todos e com o mesmo valor que
    // teriam antes da 1ª escrita (undefined): todos os jogadores ficam com a MESMA forma (classe oculta
    // do motor JS). Antes cada um ganhava os campos numa ordem (9 formas para 22 jogadores na partida):
    // os acessos ficavam megamórficos e cada leitura de número alocava (~300 KB de lixo por passo; a
    // coleta de lixo caía em 6% dos passos — o p95 do celular). Campo novo no jogador: declarar aqui.
    papel: undefined, posicao: undefined, vagaId: undefined, vagaIdx: undefined, posDetalhe: undefined,
    vaga: undefined, iaT: undefined, recebe: undefined, corrida: undefined, intercepta: undefined,
    carga: undefined, pedido: undefined, mira: undefined, miraAuto: undefined, iaAcao: undefined,
    defesa: undefined, mergulho: undefined, segura: undefined, saindo: undefined, ia: undefined,
    botoesTime: undefined, giroParado: undefined, quadril: undefined, iaA: undefined,
    pedidoPedalada: undefined, ladoOlha: undefined, ritmo: undefined, ultLanc: undefined,
    ultMod: undefined, descansoBote: undefined, defH: undefined, conter: undefined, descanso: undefined,
    contorno: undefined, recep: undefined,
    // cabeceio na bola rolando (cabeceio.js): o pulo, a disputa marcada, o tick da disputa ganha e o da perdida
    cab: undefined, disputaAlta: undefined, disputa: undefined, perdeuAlto: undefined,
    porHumano: undefined, // os botões deste passo vêm da pessoa (sim.js; cavadinha por dois toques, acoes.js)
    // goleiro realista (goleiro.js, só na partida): a base larga dos pés, parado na zona do ponto, a bola solta na área,
    // a saída no cruzamento lida, o descanso depois de tentar abafar e a base desenhada (0–1, a pose: anim.js)
    baseGk: undefined, gkParado: undefined, varre: undefined, altoLido: undefined, abafaAte: undefined, baseF: undefined, setGk: undefined,
    // (01/11, CI do #588: ficaram de fora o choque das faltas — faltas.js —, os braços do arremesso do lateral e do goleiro,
    // o pulo da barreira — bolas-paradas.js — e o pedido de movimento da corrida da cobrança e da disputa — j.guia —: a
    // partida chegava a 12 formas de jogador, a main a 9, e cada passo com a bola rolando custava ~40% mais depois da 1ª
    // cobrança com corrida; teste-custo 2,61× com a meta de 2,5×)
    choque: undefined, arremesso: undefined, arremessoGk: undefined, salto: undefined, guia: undefined,
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
    // só o DESENHO: deslocamento do pé desenhado no ar para a chuteira parar na superfície da bola (passoPeDesenhado).
    // A pose soma (ox, oz) ao pé desenhado; a física nunca lê (o pouso, o mergulho e o hash usam tx, tz)
    ox: 0, oz: 0,
    // pé DESENHADO no balanço (tornozelo: tx, ty, tz), integrado pela simulação com a
    // velocidade de um pé humano (passoPeDesenhado); bx, bz = ponto da trajetória do balanço
    // sem o gesto do toque, k = peso do perfil do balanço no último tick. pendente = a fase já
    // mandou pousar, mas o pé desenhado ainda não chegou ao ponto de pouso (pousa quando chegar).
    tx: x + rx * s * PASSADA.afastamentoLateral,
    ty: JOGADOR.alturaTornozelo,
    tz: z + rz * s * PASSADA.afastamentoLateral,
    bx: x + rx * s * PASSADA.afastamentoLateral,
    bz: z + rz * s * PASSADA.afastamentoLateral,
    k: 0,
    chegou: false,
    pendente: false,
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
      if (ath > JOGADOR.angInversaoEixo) {
        // pedido perto de 180°: tira também a velocidade de lado em relação ao eixo pedido
        // (a que sobrou do analógico passando pela borda), para frear na linha pedida
        const pv = -dz * k.vx + dx * k.vz;
        const lf = clamp(-pv / tau, -par.latCorte, par.latCorte);
        ax += -lf * dz; az += lf * dx;
      }
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
  const wMax = lerp(k.giroParado ?? JOGADOR.giroCorpoParado, JOGADOR.giroCorpoCorrendo, clamp(s3 / 8, 0, 1));
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

/** Frequência de passos (Hz) pela velocidade (a mesma conta de infoPassada, sem alocar). */
export function freqPassada(s, comBola) {
  return tabela(PASSADA.tabela, s, 1) * (comBola ? PASSADA.fatorComBola : 1);
}

/** Fator de carga da passada pela velocidade (o mesmo de infoPassada, sem alocar). */
export function cargaPassada(s) {
  return tabela(PASSADA.tabela, s, 2);
}

/** Frequência de passos (Hz) e fator de carga pela velocidade. (No caminho quente use
 * freqPassada/cargaPassada: este devolve um objeto novo a cada chamada.) */
export function infoPassada(s, comBola) {
  return { f: freqPassada(s, comBola), carga: cargaPassada(s) };
}

/** Fase local do pé j em [0, 2): 0 = tocou o chão. */
export function faseLocal(fase, j) {
  let p = (fase - j) % 2;
  if (p < 0) p += 2;
  return p;
}

/**
 * O corpo está "andando" (a passada avança)? Também quando um pé ficou torto em relação ao
 * tronco (girando devagar no lugar): o pé dá um passo de verdade para se alinhar, em vez de
 * ficar plantado com a perna torcida.
 */
function passadaAtiva(k, s) {
  if (s > 0.22 || Math.abs(k.giro) > 1.6) return true;
  const pes = k.pes;
  if (pes) for (let p = 0; p < pes.length; p++) if (Math.abs(difAng(pes[p].rumo, k.rumo)) > PE_TORTO_PASSO) return true;
  return false;
}
const PE_TORTO_PASSO = 1.0; // rad — pé plantado mais torto que isso em relação ao tronco dá um passo
const PE_TORTO = 1.2;       // rad — torção máxima do pé plantado: além disso ele gira no lugar (pivô)

/**
 * Avança a passada de um passo de simulação. Atualiza os pés (toque no chão e saída).
 * Devolve eventos de pé ('pisou' j / 'tirou' j) no array ev (opcional).
 * saida (opcional) = {pe, em, pousoEm?}: um toque na bola vem aí com o pé `pe` (conducao.js
 * saidaParaToque). Com os dois pés no chão, a passada tira esse pé do chão em até `em` segundos
 * (o toque sai sempre do pé livre); parado, o pé que vai tocar não é apressado para pousar.
 * pousoEm (pedalada, sim.js): com o pé `pe` no ar, o ritmo faz ele pousar daqui a pousoEm s.
 * ritmoVoo (a corrida da cobrança, corrida.js saidaCorrida): com os dois pés no ar, o ritmo é este; com um pé no chão, o da
 * passada de sempre ou este, o mais rápido (o apoio nunca mais longo que o natural).
 *
 * A fase NUNCA salta: o pé no balanço é desenhado pela fase (anim.js), então um salto de fase
 * era um pé que teletransportava. Quando um pé precisa sair antes (ficou para trás, torto, ou
 * vai tocar a bola), só o ritmo aumenta, com limite (PASSADA.ritmo*). Também não há mais pouso
 * instantâneo: parando com um pé no ar, ele termina o passo (ritmoFimPasso).
 */
export function passoPassada(j, comBola, dt, ev, saida = null) {
  const s = Math.sqrt(j.vx * j.vx + j.vz * j.vz);
  const f = freqPassada(s, comBola), carga = cargaPassada(s);
  const ambosNoChao = j.pes[0].apoio && j.pes[1].apoio;
  // (partida: o goleiro set — goleiro.js velPosicao, j.setGk — freando devagar não tira mais um pé do chão: planta os dois)
  const ativa = passadaAtiva(j, s) && !(j.setGk && s < GOLEIRO.realista.mov.vSetPes);
  let pedido = saida && ambosNoChao ? saida : null;
  if (!ativa && ambosNoChao && !pedido) {
    // parado (ou andando bem devagar, como o goleiro ajeitando a posição) com o corpo se
    // afastando de um pé: dá um passo com esse pé (antes os pés ficavam para trás e a perna
    // esticada arrastava o pé plantado)
    // (partida: o goleiro set — goleiro.js velPosicao, j.setGk — segura os pés plantados até `alcanceSet` m)
    let longe = -1, dl = j.setGk ? GOLEIRO.realista.mov.alcanceSet : PASSADA.alcanceParado;
    for (let p = 0; p < 2; p++) {
      const d = distanciaDoApoio(j, p);
      if (d > dl) { dl = d; longe = p; }
    }
    // sem a bola, parado depois de virar o tronco (olhando a bola): pés cruzados em relação ao
    // tronco ou base aberta demais também pedem um passo (o pé mais longe do lugar dele)
    if (longe < 0 && !comBola && !j.setGk) {
      const rx = -MD.sin(j.rumo), rz = MD.cos(j.rumo);
      const larg = (j.pes[1].x - j.pes[0].x) * rx + (j.pes[1].z - j.pes[0].z) * rz; // > 0: direito à direita
      if (larg < -PASSADA.cruzadoParado || larg > PASSADA.baseMaxParado) {
        longe = distanciaDoApoio(j, 0) >= distanciaDoApoio(j, 1) ? 0 : 1;
      }
    }
    if (longe >= 0) pedido = { pe: longe, em: PASSADA.ajusteParado };
  }
  const toqueVindo = !!saida;
  if (!ativa && ambosNoChao && !pedido) return; // parado com os dois pés no chão
  const f0 = j.fase;
  const sair = 2 * carga;
  // o pé no ar está no gesto do toque: a passada não acelera (o gesto acabaria de uma vez)
  const gesto = (!j.pes[0].apoio && j.pes[0].puxa > 0) || (!j.pes[1].apoio && j.pes[1].puxa > 0);
  let ritmo = f, ritmoFim = 0, gestoParado = false, ritmoUrgente = 0;
  for (let p = 0; p < 2; p++) {
    const pe = j.pes[p];
    if (pe.apoio) {
      // o pé travado (pedalada: o outro passa por cima da bola) não sai
      if (j.travaApoio === p) continue;
      // pé de apoio que ficou para trás demais (ou torto demais) sai antes: o passo acelera. Perto
      // do limite da perna (o corpo se afastando dele: arrancada, inversão, trombada) o passo
      // acelera mais e sai mesmo no gesto do toque — a perna não estica além do alcance
      const d = distanciaDoApoio(j, p);
      // torto só sai antes se o outro pé está no chão (nunca os dois no ar por isso)
      const torto = Math.abs(difAng(pe.rumo, j.rumo)) > PE_TORTO_PASSO && j.pes[1 - p].apoio;
      const urg = clamp((d - PASSADA.alcancePlantado) / (PASSADA.alcanceMax - PASSADA.alcancePlantado), 0, 1);
      if (gesto && !(urg > 0.5)) continue; // o pé de apoio gira no lugar (pivô) até o gesto acabar
      if (urg > 0 || torto) {
        const psi = faseLocal(f0, p);
        if (psi < sair) {
          const r = (sair - psi + 1e-6) / dt;
          ritmo = Math.max(ritmo, Math.min(r, PASSADA.ritmoAdiantado * f));
          ritmoUrgente = Math.max(ritmoUrgente, Math.min(r, lerp(PASSADA.ritmoAdiantado * f, PASSADA.ritmoUrgente, urg)));
        }
      }
    } else if (!ativa) {
      // parado com o pé no gesto do toque (indo até a bola ou voltando dela) ou esperando o
      // toque que vem aí: o passo espera, para o pé não pousar antes nem voltar correndo. Os
      // outros pés no ar terminam o passo depressa (antes desciam ao chão num quadro só) —
      // inclusive o que não é o do toque: ajeita os pés antes de receber
      if (pe.puxa > 0 || (toqueVindo && saida.pe === p)) gestoParado = true;
      // (partida: o goleiro parando na base termina o passo mais depressa — GOLEIRO.realista.mov.ritmoFim: fica "set")
      else ritmoFim = j.baseGk != null ? GOLEIRO.realista.mov.ritmoFim : PASSADA.ritmoFimPasso;
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
  // no limite da perna, o passo sai (o pé desenhado no ar segue com a velocidade de um pé humano)
  ritmo = Math.max(ritmo, ritmoUrgente);
  if (saida && saida.pousoEm != null && !j.pes[saida.pe].apoio) {
    // o pé `pe` no ar pousa daqui a pousoEm segundos (pedalada: só no fim do arco por cima da
    // bola) — o passo fica mais lento ou mais rápido, sem salto de fase
    const resta = j.pes[saida.pe].fasePouso - f0;
    if (resta > 0) ritmo = clamp(resta / Math.max(saida.pousoEm, dt), 0.3 * f, PASSADA.ritmoSaidaToque);
  }
  if (saida && saida.ritmoVoo != null) {
    // (a corrida da cobrança, item 70: corrida.js saidaCorrida) a regulagem estica ou encolhe só o VOO (os dois pés no ar);
    // com um pé no chão, o ritmo da passada — ou o da regulagem, se for mais rápido: o apoio nunca fica mais longo que o
    // natural (o pé plantado com o corpo andando por cima dele esticava a perna e o quadril caía até ~30 cm)
    const rv = clamp(saida.ritmoVoo, 0.3 * f, PASSADA.ritmoSaidaToque);
    ritmo = j.pes[0].apoio || j.pes[1].apoio ? Math.max(ritmo, rv) : rv;
  }
  if (pedido) {
    // tira o pé do toque do chão a tempo (parado: no ritmo certo para sair `em` segundos depois).
    // Com um piso: com a fase colada no ponto de saída (que muda um pouco com a velocidade), o
    // ritmo ia a quase zero e o pé nunca saía.
    const psi = faseLocal(f0, pedido.pe);
    if (psi < sair) {
      const r = Math.max(Math.min((sair - psi + 1e-6) / Math.max(pedido.em, dt), PASSADA.ritmoSaidaToque), PASSADA.ritmoMinSaida * f);
      ritmo = ativa ? Math.max(ritmo, r) : Math.max(r, ritmoUrgente);
    }
  }
  const f1 = f0 + ritmo * dt;
  j.fase = f1;
  j.ritmo = ritmo;
  for (let p = 0; p < 2; p++) {
    const pe = j.pes[p];
    const psi0 = faseLocal(f0, p), psi1 = faseLocal(f1, p);
    const virou = f1 - f0 >= 2 || psi1 < psi0; // cruzou o 0 da fase local
    let saiu = false;
    if (pe.apoio) {
      if (virou) {
        // fez o ciclo inteiro no chão (passada muito lenta): conta como se tivesse pisado de novo
        pe.faseApoio = p + 2 * Math.floor((f1 - p) / 2);
      } else if (j.travaApoio !== p && (psi1 >= sair || (!j.pes[1 - p].apoio && distanciaDoApoio(j, p) >= PASSADA.alcanceMax))) {
        // (travaApoio: este pé segura o corpo — pedalada: o outro passa por cima da bola)
        // Tropeço: empurrado numa trombada (o corpo inverte de uma vez), o pé de apoio chega ao limite da
        // perna antes de o outro pousar — sai mesmo assim (um pulinho, os dois no ar por um instante),
        // como quem leva um tranco; antes ficava plantado, o quadril afundava até ~8 cm do chão e o pé
        // arrastava (teste-patinacao, partida semente 11 com a IA intensa)
        pe.apoio = false;
        pe.faseSaida = f1;
        pe.fasePouso = f1 + (2 - psi1); // o próximo inteiro n ≡ p (mod 2): é quando pousa
        pe.tx = pe.bx = pe.x; pe.tz = pe.bz = pe.z; pe.ty = TORN; pe.k = 0; pe.chegou = false; pe.pendente = false;
        saiu = true;
        if (ev) ev.push({ tipo: 'tirou', pe: p, id: j.id });
      }
    } else if (virou || pe.pendente) {
      // pousa no ponto de pouso se o pé desenhado está a um quadro dele na velocidade de um pé
      // tocando o chão; senão continua no ar até chegar (o pé nunca desce de uma vez)
      const vA = (PASSADA.velPeAterrissa[0] + PASSADA.velPeAterrissa[1] * s) * dt;
      if (MD.hypot(pe.lx - pe.tx, pe.lz - pe.tz) + Math.abs(pe.ty - TORN) <= vA) {
        plantarPe(j, p);
        if (ev) ev.push({ tipo: 'pisou', pe: p, id: j.id });
      } else pe.pendente = true;
    }
    if (!pe.apoio && (saiu || !pe.chegou)) {
      // ponto de pouso: onde o corpo vai estar no pouso + meio apoio à frente — é exatamente onde
      // o pé será plantado. Segue a previsão a cada tick (trombada, freada, inversão): o pé
      // desenhado é que tem a velocidade limitada (passoPeDesenhado). O tempo até o pouso é o
      // mesmo do progresso do balanço (contínuo, ao menos um tick); com o pé desenhado já no ponto
      // de pouso (chegou), o ponto fica parado até a passada plantar o pé.
      const pt = pontoPouso(j, p, carga, f, Math.max((pe.fasePouso - f1) / Math.max(ritmo, 0.3), dt), !comBola, _pouso);
      pe.lx = pt.x; pe.lz = pt.z; pe.lrumo = pt.rumo;
    }
  }
  // pivô: o tronco girando mais rápido do que os pés conseguem dar passos (virando no lugar
  // para a bola, o outro pé no ar): o pé plantado gira no lugar com o tronco (na ponta do pé),
  // sem deslizar — a perna nunca fica torcida além de PE_TORTO. Os passos (PE_TORTO_PASSO)
  // realinham os pés depois.
  for (let p = 0; p < 2; p++) {
    const pe = j.pes[p];
    if (!pe.apoio) continue;
    const t = difAng(j.rumo, pe.rumo);
    if (Math.abs(t) > PE_TORTO) pe.rumo = j.rumo + Math.sign(t) * PE_TORTO;
  }
}

/** Distância do pé p ao ponto de apoio dele (ao lado do centro do corpo). */
function distanciaDoApoio(j, p) {
  const pe = j.pes[p];
  const lado = p === 0 ? -1 : 1;
  const hx = j.x + (-MD.sin(j.rumo)) * lado * PASSADA.afastamentoLateral;
  const hz = j.z + MD.cos(j.rumo) * lado * PASSADA.afastamentoLateral;
  return MD.hypot(pe.x - hx, pe.z - hz);
}

const _pouso = { x: 0, z: 0, rumo: 0 };

/**
 * Onde o pé p pousa se pousar daqui a tempoAtePouso segundos (o centro do apoio à frente).
 * out (opcional): objeto reaproveitado em que a resposta é escrita (a passada usa um só).
 * semCruzar (sem a bola): andando de lado, o pé pousa sempre do lado dele em relação ao outro pé
 * plantado (passo lateral: um abre, o outro fecha sem passar) — antes o pé de trás passava pela
 * frente do outro e as pernas cruzavam (~40% do tempo andando de lado).
 */
export function pontoPouso(j, p, carga, f, tempoAtePouso = 0, semCruzar = false, out = { x: 0, z: 0, rumo: 0 }) {
  const tm = tempoAtePouso + carga / Math.max(f, 0.5); // meio do apoio
  const lado = p === 0 ? -1 : 1;
  // rumo previsto no pouso (o tronco continua girando)
  const rumo = j.rumo + clamp(j.giro, -6, 6) * Math.min(tempoAtePouso, 0.25);
  const rx = -MD.sin(rumo), rz = MD.cos(rumo);
  // (partida: o goleiro andando devagar pousa os pés numa base mais larga — goleiro.js velPosicao, j.baseGk)
  const afast = j.baseGk != null && j.vx * j.vx + j.vz * j.vz < 4 ? j.baseGk : PASSADA.afastamentoLateral;
  let x = j.x + j.vx * tm + rx * lado * afast;
  let z = j.z + j.vz * tm + rz * lado * afast;
  const o = j.pes[1 - p];
  // só no passo lateral de verdade (devagar e de lado): recuando ou freando, empurrar o pouso para o
  // lado deixava a perna de apoio esticada além do alcance (pé plantado arrastado na pose)
  const vLat = j.vx * rx + j.vz * rz, v = MD.hypot(j.vx, j.vz);
  if (semCruzar && o.apoio && Math.abs(vLat) > PASSADA.ladoMin && v < PASSADA.ladoMaxV) {
    const sLado = ((x - o.x) * rx + (z - o.z) * rz) * lado; // > 0: do lado certo do outro pé
    if (sLado < PASSADA.folgaEntrePes) {
      // o empurrão nunca leva o pé além de PASSADA.ladoOfsMax para o lado do corpo previsto: se o
      // outro pé ficou para trás (tronco girando rápido), "do lado certo dele" era longe demais e a
      // perna esticava além do alcance (pé plantado arrastado na pose)
      const ofs = ((x - j.x - j.vx * tm) * rx + (z - j.z - j.vz * tm) * rz) * lado;
      const k = clamp(Math.min(PASSADA.folgaEntrePes - sLado, PASSADA.ladoOfsMax - ofs), 0, PASSADA.ladoEmpurraMax) * lado;
      x += rx * k; z += rz * k;
    }
  }
  out.x = x; out.z = z; out.rumo = rumo;
  return out;
}

/** Planta o pé p no ponto de pouso guardado (o mesmo que a animação mostrou no último tick). */
function plantarPe(j, p) {
  const pe = j.pes[p];
  pe.apoio = true;
  pe.pendente = false;
  pe.x = pe.lx; pe.z = pe.lz; pe.rumo = pe.lrumo;
  pe.tx = pe.x; pe.ty = TORN; pe.tz = pe.z;
  pe.faseApoio = p + 2 * Math.floor((j.fase - p) / 2);
}

const TORN = JOGADOR.alturaTornozelo;
const BOLA_RAIO = BOLA.raio;
// Arco do pé de fora na pedalada (por cima da bola): raio para o lado, altura do tornozelo acima
// do normal, recuo atrás do centro da bola e as frações da pedalada em que o pé entra no arco,
// começa a sair dele e pousa (sim.js: o pé de fora pousa a 0,85 da pedalada). A chuteira (cápsula
// tornozelo–ponta, a ponta mais baixa no balanço) passa a mais de raio da bola + raio da chuteira.
const PEDALADA = { raio: 0.24, altura: 0.27, atras: 0.06, entra: 0.2, sai: 0.68, pouso: 0.85 };

function suaveU(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

const _balanco = { u: 0, livre: 0, total: 0, meioApoio: 0, s: 0 };

/**
 * Progresso do balanço do pé p (0 na saída, 1 no pouso), UM TICK ADIANTADO: no último tick do
 * balanço o pé desenhado já está no ponto de pouso, e a passada planta o pé no fim do tick em que
 * a fase cruza o inteiro. Usa o ritmo natural, que muda devagar com a velocidade. Também devolve
 * o tempo livre do pé (s desde que saiu ou até pousar, o menor): o gesto do toque cabe nisso.
 * Devolve um objeto REAPROVEITADO (o mesmo a cada chamada): ler os campos na hora, sem guardá-lo.
 */
export function progressoBalanco(j, p, comBola) {
  const pe = j.pes[p];
  const s = Math.sqrt(j.vx * j.vx + j.vz * j.vz);
  const f = freqPassada(s, comBola), carga = cargaPassada(s);
  const fp = Math.max(f, 0.5);
  // ritmo da passada no último tick (o passo acelerado — toque, pé no limite, pedalada — também
  // adianta o balanço: o pé desenhado chega ao ponto de pouso quando a fase cruza o inteiro)
  const r = Math.max(j.ritmo ?? fp, 0.3);
  const total = Math.max(pe.fasePouso - pe.faseSaida, 1e-3);
  const falta = Math.max(0, pe.fasePouso - j.fase);
  // um objeto só, reaproveitado: quem chama lê os campos na hora (não guarda a resposta)
  const o = _balanco;
  o.u = clamp(1 - (falta - r * PASSO) / total, 0, 1);
  o.livre = Math.min(j.fase - pe.faseSaida, Math.max(0, falta - r * PASSO)) / r;
  o.total = total / r;
  o.meioApoio = carga / fp; // s do pouso ao meio do apoio (o pé pousa à frente do corpo: v × isto)
  o.s = s;
  return o;
}

/**
 * Pé desenhado no balanço (fim do tick, depois do gesto do toque). A trajetória vai de onde o pé
 * saiu até o ponto de pouso guardado (lx, lz — que pode mudar no caminho: a parte que falta é
 * refeita, sem salto), com o perfil do balanço, a altura do passo, o desvio do gesto do toque
 * (o pé livre indo até a bola: peso `puxa`, ponto `gx, gz`, desvio que encolhe perto da saída e
 * do pouso) e o arco da pedalada (o pé de fora por cima da bola). O pé desenhado segue essa
 * trajetória com a velocidade máxima de um pé humano no balanço (PASSADA.velPeMax, abaixo de
 * 2,5·v + 3 m/s: Clark et al. 2023; van der Straaten et al. 2020) — trombada, freada forte,
 * passo encurtado, gesto e pedalada juntos não fazem o pé saltar. Muda j.
 */
export function passoPeDesenhado(j, m, dt) {
  const comBola = m.posse === j.id;
  const pd = j.cond && j.cond.pedalada;
  // a bola é "do pé" dele (com a posse ou dominando, rolando devagar o bastante para o pé acompanhar): a chuteira para
  // na superfície dela (só o desenho: pe.ox, pe.oz)
  const bv = m.bola.v, ct = j.cond && j.cond.toque;
  const supBola = (comBola || !!(ct && ct.tipo === 'dominio')) && bv.x * bv.x + bv.z * bv.z < GESTO.superficieVBola * GESTO.superficieVBola;
  for (let p = 0; p < 2; p++) {
    const pe = j.pes[p];
    if (pe.apoio) { pe.tx = pe.x; pe.ty = TORN; pe.tz = pe.z; pe.ox = 0; pe.oz = 0; continue; }
    const { u, livre, total, s } = progressoBalanco(j, p, comBola);
    pe.chegou = u >= 1;
    const k = lerp(u, suaveU(u), PASSADA.perfilBalanco);
    // trajetória sem o gesto: a parte que falta do caminho até o pouso, pelo perfil
    if (k >= 1 || pe.k >= 1) { pe.bx = pe.lx; pe.bz = pe.lz; }
    else {
      const a = (k - pe.k) / (1 - pe.k);
      pe.bx += (pe.lx - pe.bx) * a; pe.bz += (pe.lz - pe.bz) * a;
    }
    pe.k = k;
    // altura do passo; num balanço curto o pé sobe menos (velocidade vertical limitada)
    let alt = lerp(0.07, PASSADA.alturaPasso + 0.1 * clamp((s - 4) / 4, 0, 1), clamp(s / 3, 0, 1));
    alt = Math.min(alt, PASSADA.velPeVertical * total / Math.PI);
    let x = pe.bx, z = pe.bz, y = TORN + alt * MD.sin(Math.PI * u);
    // gesto do toque: desvio limitado (GESTO.desvio) e que encolhe com o tempo livre do pé
    const w = suaveU(pe.puxa);
    if (w > 0) {
      const ks = clamp(s / GESTO.velRef, 0, 1);
      const dMax = lerp(GESTO.desvio[0], GESTO.desvio[1], ks);
      const lim = Math.min(dMax, lerp(GESTO.velDesvio[0], GESTO.velDesvio[1], ks) * livre);
      if (lim > 0) {
        let dx = pe.gx - x, dz = pe.gz - z;
        const d = MD.hypot(dx, dz);
        if (d > lim) { dx *= lim / d; dz *= lim / d; }
        x += w * dx; z += w * dz;
        y = lerp(y, TORN + 0.02, w * lim / dMax);
      }
    }
    if (pd && p === (pd.lado > 0 ? 0 : 1)) {
      // pedalada: o pé de fora faz um arco por cima da bola, de um lado dela ao outro, alto o
      // bastante para a chuteira não atravessar a bola; entra no arco logo depois de sair do
      // chão e volta à trajetória do passo antes de pousar (PEDALADA.pouso da duração)
      const tp = clamp((m.tick + 1 - pd.tick0) * PASSO / CONDUCAO.pedaladaDuracao, 0, 1);
      const wa = suaveU(tp / PEDALADA.entra) * (1 - suaveU((tp - PEDALADA.sai) / (PEDALADA.pouso - PEDALADA.sai)));
      if (wa > 0) {
        const ang = Math.PI * tp, b = m.bola.p;
        const rx = -MD.sin(j.rumo), rz = MD.cos(j.rumo), fx = MD.cos(j.rumo), fz = MD.sin(j.rumo);
        const lat = pd.lado * PEDALADA.raio * MD.cos(ang);
        const ax = b.x + rx * lat - fx * PEDALADA.atras, az = b.z + rz * lat - fz * PEDALADA.atras;
        const ay = TORN + PEDALADA.altura * MD.sin(ang);
        x = lerp(x, ax, wa); z = lerp(z, az, wa); y = lerp(y, ay, wa);
      }
    }
    // o pé desenhado segue a trajetória com a velocidade de um pé humano (vertical primeiro)
    const v = (PASSADA.velPeMax[0] + PASSADA.velPeMax[1] * s) * dt;
    const dy = clamp(y - pe.ty, -v, v);
    const vh = Math.sqrt(Math.max(0, v * v - dy * dy));
    let hx = x - pe.tx, hz = z - pe.tz;
    const dh = MD.hypot(hx, hz);
    if (dh > vh) { hx *= vh / dh; hz *= vh / dh; }
    pe.tx += hx; pe.ty += dy; pe.tz += hz;
    // SÓ O DESENHO (condução curta, 12/10): o pé no ar vai ATÉ a bola dele, nunca para dentro dela. O deslocamento
    // (ox, oz) que a pose soma ao pé desenhado persegue o que tira a chuteira da bola, com dois limites que fazem o pé
    // nunca saltar nem pousar fora do ponto plantado: (1) por tick, só o que sobra da velocidade de um pé humano
    // (GESTO.velSuperficie) depois do que o pé desenhado já andou; (2) no máximo o desvio do gesto pelo tempo livre do
    // pé (GESTO.velDesvio × livre: zero na saída do chão e no pouso). Não muda tx/tz: a passada (pouso), o goleiro e o
    // hash não o leem
    let qx = 0, qz = 0;
    // (devagar não: girando no lugar o pé pousa embaixo da bola — entra de superficieV[0] a superficieV[1] m/s)
    const ws = supBola ? clamp((s - GESTO.superficieV[0]) / (GESTO.superficieV[1] - GESTO.superficieV[0]), 0, 1) : 0;
    if (ws > 0 && chuteiraForaDaBola(pe.tx, pe.ty, pe.tz, MD.cos(pe.lrumo), MD.sin(pe.lrumo), -0.35 * MD.sin(Math.PI * u), m.bola.p)) {
      qx = _fora.x * ws; qz = _fora.z * ws;
    }
    if (qx !== 0 || qz !== 0 || pe.ox !== 0 || pe.oz !== 0) {
      const ks = clamp(s / GESTO.velRef, 0, 1);
      const sobra = Math.max(0, (GESTO.velSuperficie[0] + GESTO.velSuperficie[1] * s) * dt - Math.sqrt(hx * hx + dy * dy + hz * hz));
      let ex = qx - pe.ox, ez = qz - pe.oz;
      const el = MD.hypot(ex, ez);
      if (el > sobra) { ex *= sobra / el; ez *= sobra / el; }
      let ox = pe.ox + ex, oz = pe.oz + ez;
      const cap = lerp(GESTO.velDesvio[0], GESTO.velDesvio[1], ks) * livre, ol = MD.hypot(ox, oz);
      if (ol > cap) { ox *= cap / ol; oz *= cap / ol; }
      pe.ox = ox; pe.oz = oz;
    }
  }
}

// Chuteira (cápsula tornozelo–ponta) como a pose a desenha (anim.js: ponta 0,17 m à frente do tornozelo, 0,055 m
// abaixo dele, inclinada no balanço; raio do segmento da chuteira 0,045 m)
const PONTA = 0.17, PONTA_DESCE = 0.055, R_CHUTEIRA = 0.045;
const _fora = { x: 0, z: 0 };
/** Distância² do ponto (px, py, pz) ao segmento a → a + u (l2 = |u|²). */
function dist2Seg(px, py, pz, ax, ay, az, ux, uy, uz, l2) {
  let k = l2 > 1e-12 ? ((px - ax) * ux + (py - ay) * uy + (pz - az) * uz) / l2 : 0;
  k = k < 0 ? 0 : k > 1 ? 1 : k;
  const dx = ax + ux * k - px, dy = ay + uy * k - py, dz = az + uz * k - pz;
  return dx * dx + dy * dy + dz * dz;
}
/**
 * O pé no ar com o tornozelo em (ax, ay, az), a ponta pela direção (pfx, pfz) e a inclinação incl: se a chuteira entra
 * na bola b, escreve em _fora o deslocamento HORIZONTAL que a põe na superfície dela (centro a raio + R_CHUTEIRA +
 * GESTO.superficie) e devolve true. A direção é a do centro da bola para o tornozelo (o pé recua por onde veio: atrás
 * da bola, na direção do toque); a distância é a saída do centro da bola da cápsula ao longo dela (a cápsula é
 * convexa: a saída é única). Sem alocar.
 */
function chuteiraForaDaBola(ax, ay, az, pfx, pfz, incl, b) {
  const ci = MD.cos(incl);
  const ux = pfx * PONTA * ci, uz = pfz * PONTA * ci;
  const uy = Math.max(0.025, ay - PONTA_DESCE + PONTA * MD.sin(incl)) - ay;
  const l2 = ux * ux + uy * uy + uz * uz;
  const need = BOLA_RAIO + R_CHUTEIRA + GESTO.superficie, need2 = need * need;
  if (dist2Seg(b.x, b.y, b.z, ax, ay, az, ux, uy, uz, l2) >= need2) return false;
  // da bola para o tornozelo (um pouco de "para trás do pé" só decide com o tornozelo no centro da bola)
  let nx = ax - b.x - 0.02 * pfx, nz = az - b.z - 0.02 * pfz;
  const nl = MD.hypot(nx, nz) || 1;
  nx /= nl; nz /= nl;
  // saída do centro da bola da cápsula andando para −n (o mesmo que o pé andar +n): bisseção
  let lo = 0, hi = need + PONTA + 0.05;
  for (let it = 0; it < 16; it++) {
    const sm = 0.5 * (lo + hi);
    if (dist2Seg(b.x - nx * sm, b.y, b.z - nz * sm, ax, ay, az, ux, uy, uz, l2) < need2) lo = sm; else hi = sm;
  }
  _fora.x = nx * hi; _fora.z = nz * hi;
  return true;
}

/** Copia só o estado cinemático (para previsão). */
export function copiaCinematica(j) {
  return {
    x: j.x, z: j.z, vx: j.vx, vz: j.vz, rumo: j.rumo, giro: j.giro,
    ax: j.ax, az: j.az, inv: j.inv, fase: j.fase,
  };
}

export const DT = PASSO;
