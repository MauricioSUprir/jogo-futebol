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

import { JOGADOR, PASSADA, ATRIBUTOS_PADRAO, ENTRADA, PASSO, GESTO, CONDUCAO } from './config.js';
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
    contorno: undefined,
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

/**
 * O corpo está "andando" (a passada avança)? Também quando um pé ficou torto em relação ao
 * tronco (girando devagar no lugar): o pé dá um passo de verdade para se alinhar, em vez de
 * ficar plantado com a perna torcida.
 */
function passadaAtiva(k, s) {
  if (s > 0.22 || Math.abs(k.giro) > 1.6) return true;
  if (k.pes) for (const pe of k.pes) if (Math.abs(difAng(pe.rumo, k.rumo)) > PE_TORTO_PASSO) return true;
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
  let pedido = saida && ambosNoChao ? saida : null;
  if (!ativa && ambosNoChao && !pedido) {
    // parado (ou andando bem devagar, como o goleiro ajeitando a posição) com o corpo se
    // afastando de um pé: dá um passo com esse pé (antes os pés ficavam para trás e a perna
    // esticada arrastava o pé plantado)
    let longe = -1, dl = PASSADA.alcanceParado;
    for (let p = 0; p < 2; p++) {
      const d = distanciaDoApoio(j, p);
      if (d > dl) { dl = d; longe = p; }
    }
    // sem a bola, parado depois de virar o tronco (olhando a bola): pés cruzados em relação ao
    // tronco ou base aberta demais também pedem um passo (o pé mais longe do lugar dele)
    if (longe < 0 && !comBola) {
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
  // no limite da perna, o passo sai (o pé desenhado no ar segue com a velocidade de um pé humano)
  ritmo = Math.max(ritmo, ritmoUrgente);
  if (saida && saida.pousoEm != null && !j.pes[saida.pe].apoio) {
    // o pé `pe` no ar pousa daqui a pousoEm segundos (pedalada: só no fim do arco por cima da
    // bola) — o passo fica mais lento ou mais rápido, sem salto de fase
    const resta = j.pes[saida.pe].fasePouso - f0;
    if (resta > 0) ritmo = clamp(resta / Math.max(saida.pousoEm, dt), 0.3 * f, PASSADA.ritmoSaidaToque);
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
      } else if (psi1 >= sair && j.travaApoio !== p) {
        // (travaApoio: este pé segura o corpo — pedalada: o outro passa por cima da bola)
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
      const pt = pontoPouso(j, p, carga, f, Math.max((pe.fasePouso - f1) / Math.max(ritmo, 0.3), dt), !comBola);
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

/**
 * Onde o pé p pousa se pousar daqui a tempoAtePouso segundos (o centro do apoio à frente).
 * semCruzar (sem a bola): andando de lado, o pé pousa sempre do lado dele em relação ao outro pé
 * plantado (passo lateral: um abre, o outro fecha sem passar) — antes o pé de trás passava pela
 * frente do outro e as pernas cruzavam (~40% do tempo andando de lado).
 */
export function pontoPouso(j, p, carga, f, tempoAtePouso = 0, semCruzar = false) {
  const tm = tempoAtePouso + carga / Math.max(f, 0.5); // meio do apoio
  const lado = p === 0 ? -1 : 1;
  // rumo previsto no pouso (o tronco continua girando)
  const rumo = j.rumo + clamp(j.giro, -6, 6) * Math.min(tempoAtePouso, 0.25);
  const rx = -MD.sin(rumo), rz = MD.cos(rumo);
  let x = j.x + j.vx * tm + rx * lado * PASSADA.afastamentoLateral;
  let z = j.z + j.vz * tm + rz * lado * PASSADA.afastamentoLateral;
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
  return { x, z, rumo };
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
// Arco do pé de fora na pedalada (por cima da bola): raio para o lado, altura do tornozelo acima
// do normal, recuo atrás do centro da bola e as frações da pedalada em que o pé entra no arco,
// começa a sair dele e pousa (sim.js: o pé de fora pousa a 0,85 da pedalada). A chuteira (cápsula
// tornozelo–ponta, a ponta mais baixa no balanço) passa a mais de raio da bola + raio da chuteira.
const PEDALADA = { raio: 0.24, altura: 0.27, atras: 0.06, entra: 0.2, sai: 0.68, pouso: 0.85 };

function suaveU(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

/**
 * Progresso do balanço do pé p (0 na saída, 1 no pouso), UM TICK ADIANTADO: no último tick do
 * balanço o pé desenhado já está no ponto de pouso, e a passada planta o pé no fim do tick em que
 * a fase cruza o inteiro. Usa o ritmo natural, que muda devagar com a velocidade. Também devolve
 * o tempo livre do pé (s desde que saiu ou até pousar, o menor): o gesto do toque cabe nisso.
 */
export function progressoBalanco(j, p, comBola) {
  const pe = j.pes[p];
  const s = Math.sqrt(j.vx * j.vx + j.vz * j.vz);
  const { f, carga } = infoPassada(s, comBola);
  const fp = Math.max(f, 0.5);
  // ritmo da passada no último tick (o passo acelerado — toque, pé no limite, pedalada — também
  // adianta o balanço: o pé desenhado chega ao ponto de pouso quando a fase cruza o inteiro)
  const r = Math.max(j.ritmo ?? fp, 0.3);
  const total = Math.max(pe.fasePouso - pe.faseSaida, 1e-3);
  const falta = Math.max(0, pe.fasePouso - j.fase);
  return {
    u: clamp(1 - (falta - r * PASSO) / total, 0, 1),
    livre: Math.min(j.fase - pe.faseSaida, Math.max(0, falta - r * PASSO)) / r,
    total: total / r,
    meioApoio: carga / fp, // s do pouso ao meio do apoio (o pé pousa à frente do corpo: v × isto)
    s,
  };
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
  for (let p = 0; p < 2; p++) {
    const pe = j.pes[p];
    if (pe.apoio) { pe.tx = pe.x; pe.ty = TORN; pe.tz = pe.z; continue; }
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
  }
}

/** Copia só o estado cinemático (para previsão). */
export function copiaCinematica(j) {
  return {
    x: j.x, z: j.z, vx: j.vx, vz: j.vz, rumo: j.rumo, giro: j.giro,
    ax: j.ax, az: j.az, inv: j.inv, fase: j.fase,
  };
}

export const DT = PASSO;
