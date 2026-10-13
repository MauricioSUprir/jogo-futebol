// Mundo da simulação: estado completo + passo fixo. Sem three.js nem DOM.
// O mundo é um objeto simples (copiável); a mesma semente e as mesmas entradas geram a
// mesma partida bit a bit (ver hashMundo).

import { profundidadeVeu } from './rede-forma.js';
import { PASSO, ENTRADA, BOTAO, CONDUCAO, JOGADOR, TREINO, CAMPO, GOLEIRO, IA, AEREO } from './config.js';
import { criarRng, entre, uniforme } from './rng.js';
import { criarBola, passoBola, chutarRasteiro, copiarBola } from './bola.js';
import { criarJogador, passoCorpo, passoPassada, passoPeDesenhado, faseLocal } from './jogador.js';
import { alturaQuadril } from './anim.js';
import { clamp, difAng, quantizar, lerp } from './mat.js';
import {
  criarCond, controlarComBola, movimentoComBola, movimentoBase, movimentoRecepcao, tentarDominio, verificarPerda,
  executarToque, saidaParaToque, atualizarGesto, peLivre,
} from './conducao.js';
import { MD } from './matdet.js';
import { atualizarBotoesAcao, processarPedido, executarAcao, bolaAltaPassando, executarCabeceio, ataca, assumirControle } from './acoes.js';
import { lerChute, aplicarDefesa, movimentoGoleiro, bolaNaMao, soltarDaMao, linhaDoGol, mergulhoAtivo, passoMergulho, fixarMergulho, pesMergulho, maoNaBola } from './goleiro.js';
import { entradaIA } from './ia.js';
import { ACOES } from './config.js';
// Etapa 3 (partida 11×11): tudo isto só liga com m.times — o treino continua bit a bit igual
// (tools/hash-igual.mjs). Exceção: os botões de defesa do humano (defesa.js), que só agem com
// CONTER/DIVIDIDA/PRESSÃO apertados (nenhum roteiro do treino aperta).
import { entradaIATatica, olhaBolaPartida, entradaGoleiroPe } from './ia-tatica.js';
import { trocaAerea, alvoAereo } from './troca.js';
import { entradaConter, dividida, pedidoPressao, rumoConter, chanceDividida } from './defesa.js';
import { misturarTimes } from './escalacao.js';
import { misturarPartida, paredeParada } from './partida.js';
import { planejarRecepcao } from './recepcao.js';
import { faltaNoBote, faltaTatica, faltaNaCarga, registrarFalta } from './faltas.js';
// Regras da mão do goleiro e o goleiro jogando com o pé (pedido do dono, 11/10; só na partida)
import { maoPermitida, motivoSemMao, registrarToque, estadoMao, paredeAreaMao, naPropriaArea, goleiroNoPe } from './regras-goleiro.js';
import { lateralSegurando, segurarLateral } from './lateral.js';
import { notaAerea, colisaoBarreira } from './bolas-paradas.js';

const BOTOES_DEFESA = BOTAO.CONTER | BOTAO.DIVIDIDA | BOTAO.PRESSAO;
/** Parada da partida ainda não cobrada: só o cobrador toca a bola. */
const naParada = m => m.parada && !m.parada.rolou;

/**
 * Cria o mundo. opcoes:
 *   semente      inteiro
 *   jogadores    [{id, x, z, rumo, attr, time, papel}]  papel: 'humano' | 'marcador' | 'parado'
 *   bola         {x, z} (posição inicial); posse: id do jogador com a bola
 */
export function criarMundo(opcoes = {}) {
  const semente = opcoes.semente ?? 1;
  const m = {
    tick: 0,
    semente,
    rng: criarRng(semente),
    bola: criarBola(opcoes.bola?.x ?? 0.4, opcoes.bola?.z ?? 0),
    jogadores: [],
    posse: opcoes.posse ?? null,
    eventos: [],
    log: opcoes.log ? [] : null,
    stats: { perdas: 0, roubadas: 0, passes: 0, chutes: 0, defesas: 0, gols: 0 },
    ataca: opcoes.ataca ?? { 0: 1, 1: -1 },
    controlado: {},
    humanos: [],
    placar: { 0: 0, 1: 0 },
    voo: null,
    naMao: null,
    proximaTroca: {},
    botoesTimeAgora: {},       // botões do humano de cada time neste passo e no anterior
    botoesTimeAnt: {},
  };
  for (const d of opcoes.jogadores ?? [{ id: 0, x: 0, z: 0, rumo: 0 }]) {
    const j = criarJogador(d.id, d.x, d.z, d.rumo ?? 0, d.attr ?? {}, d.time ?? 0);
    j.papel = d.papel ?? 'humano';
    j.posicao = d.posicao ?? 'MEI';
    if (d.vaga) j.vaga = { x: d.vaga.x, z: d.vaga.z };
    j.cond = criarCond();
    m.jogadores.push(j);
    if (j.papel === 'humano' && m.controlado[j.time] == null) {
      m.controlado[j.time] = j.id;
      if (!m.humanos.includes(j.time)) m.humanos.push(j.time);
    }
  }
  if (opcoes.controlado) Object.assign(m.controlado, opcoes.controlado);
  return m;
}

/** Desliga a recepção assistida de j neste passo (devolve null). */
function semRecepcao(j) {
  if (j.recep) j.recep.ativo = false;
  return null;
}

/** O jogador j é o controlado pelo humano do time dele? */
export function ehControlado(m, j) {
  return m.humanos.includes(j.time) && m.controlado[j.time] === j.id;
}

export function jogadorPorId(m, id) {
  for (const j of m.jogadores) if (j.id === id) return j;
  return null;
}

/** Aplica a entrada (analógico já em coordenadas do mundo, |v| ≤ 1). */
export function aplicarEntrada(j, e, tick) {
  const q = ENTRADA.quant;
  let x = quantizar(e?.x ?? 0, q), z = quantizar(e?.z ?? 0, q);
  let mag = MD.hypot(x, z);
  if (mag > 1) { x /= mag; z /= mag; mag = 1; }
  // um limiar só para andar e para virar: abaixo dele o pedido é zero
  if (mag <= ENTRADA.magDirecao) { x = 0; z = 0; mag = 0; }
  j.botoesAnt = j.botoes;
  j.botoes = (e?.botoes ?? 0) | 0;
  if (mag > 0) {
    const r = MD.atan2(z, x);
    const d = difAng(j.intRumo, r);
    if (j.imag > 0 && Math.abs(d) < 0.12) {
      // giro contínuo do analógico: mede a velocidade angular pedida
      const w = d / PASSO;
      j.intW += (w - j.intW) * Math.min(1, PASSO / 0.12);
    } else {
      j.intW = 0; // salto (tecla, flick): não extrapola
      // o analógico pulou neste tick (o toque marcado para agora espera o fim do gesto: conducao.js)
      if (j.imag > 0 && Math.abs(d) > CONDUCAO.saltoGesto) j.saltoTick = tick;
    }
    j.intRumo = r;
    j.ix = x / mag; j.iz = z / mag;
  } else {
    j.intW *= MD.exp(-PASSO / 0.1);
  }
  // `repete`: a MESMA leitura do analógico do passo anterior (main.js: a 30 qps os 2 passos do quadro usam a leitura do
  // 1º). Um gesto que pulou no passo anterior pode estar no meio do caminho: sem leitura nova, ele continua "pulando"
  // — o toque marcado para agora espera a leitura do próximo quadro (ou sai de freio), em vez de sair na direção do
  // meio do gesto (contraprova da condução curta: 4,2 m de deriva no giro de 180° a 30 qps)
  if (e?.repete && mag > 0 && j.saltoTick === tick - 1) j.saltoTick = tick;
  j.imag = mag;
  // pedalada: dois toques no modificador
  const sub = (j.botoes & BOTAO.MOD) && !(j.botoesAnt & BOTAO.MOD);
  if (sub) {
    if (j.ultMod != null && (tick - j.ultMod) * PASSO < CONDUCAO.pedaladaToqueDuplo) {
      j.pedidoPedalada = true;
      j.ultMod = null;
    } else j.ultMod = tick;
  }
}

function moverMarcador(m, j) {
  // marcador de treino: vai na bola; encostado no condutor, contorna pelo lado da bola
  const b = m.bola;
  const dono = m.posse != null ? jogadorPorId(m, m.posse) : null;
  let tx = b.p.x, tz = b.p.z, contorna = false;
  if (dono && dono !== j) {
    const dx = j.x - dono.x, dz = j.z - dono.z;
    const d = MD.hypot(dx, dz);
    if (d < 1.3) {
      // contorna: gira em volta do condutor na direção da bola
      const aM = MD.atan2(dz, dx);
      const aB = MD.atan2(b.p.z - dono.z, b.p.x - dono.x);
      const dif = difAng(aM, aB);
      if (Math.abs(dif) < TREINO.marcadorBote) {
        // a bola ficou do lado dele: vai nela (bote)
        tx = b.p.x; tz = b.p.z;
      } else {
        const a2 = aM + (dif >= 0 ? 1 : -1) * 0.9;
        tx = dono.x + MD.cos(a2) * 0.75;
        tz = dono.z + MD.sin(a2) * 0.75;
      }
      contorna = true;
    }
  }
  const dx = tx - j.x, dz = tz - j.z;
  const d = MD.hypot(dx, dz) || 1;
  // contornando, corre em volta do condutor (não anda devagar até o ponto)
  const vel = Math.min(TREINO.marcadorVel, contorna ? (j.contorno ?? TREINO.marcadorContorno) : 0.6 + d * 2.2);
  return { dx: dx / d, dz: dz / d, vel, rumoAlvo: MD.atan2(b.p.z - j.z, b.p.x - j.x) };
}

function colisaoCorpos(m) {
  const js = m.jogadores;
  const r2 = JOGADOR.raio * 2;
  for (let a = 0; a < js.length; a++) {
    for (let c = a + 1; c < js.length; c++) {
      const p = js[a], q = js[c];
      const dx = q.x - p.x, dz = q.z - p.z;
      const d = MD.hypot(dx, dz);
      if (d >= r2 || d < 1e-9) continue;
      const nx = dx / d, nz = dz / d;
      const fp = p.par.attr.forca, fq = q.par.attr.forca;
      const wp = fq / (fp + fq), wq = fp / (fp + fq); // quem é mais forte se mexe menos
      const pen = r2 - d;
      p.x -= nx * pen * wp; p.z -= nz * pen * wp;
      q.x += nx * pen * wq; q.z += nz * pen * wq;
      const rv = (q.vx - p.vx) * nx + (q.vz - p.vz) * nz;
      // Etapa 4 (só na partida): carga por trás no condutor (faltas.js; o árbitro decide nas regras)
      if (rv < 0 && m.partida && m.posse != null && (p.id === m.posse || q.id === m.posse) && !m.faltaPendente) {
        const f = faltaNaCarga(m, p, q, -rv);
        if (f) registrarFalta(m, f);
      }
      if (rv < 0) {
        p.vx += nx * rv * wp; p.vz += nz * rv * wp;
        q.vx -= nx * rv * wq; q.vz -= nz * rv * wq;
      }
    }
  }
}

/** Bola batendo nas pernas de quem não está conduzindo. */
function colisaoBolaCorpo(m) {
  const b = m.bola;
  if (b.p.y > 0.9) return;
  for (const j of m.jogadores) {
    if (j.id === m.posse) continue;
    if (naParada(m) && j.id !== m.parada.cobrador) continue; // partida: bola parada não bate em ninguém
    // quem acabou de bater na bola não a rebate no próprio corpo; o goleiro com a defesa já
    // decidida (sorteio da leitura) também não: o resultado é o da leitura
    if (m.ultimoToque && m.ultimoToque.id === j.id && m.tick - m.ultimoToque.tick < 10) continue;
    if (j.defesa && !j.defesa.fora && m.tick <= j.defesa.tick + 2) continue;
    const dx = b.p.x - j.x, dz = b.p.z - j.z;
    const d = MD.hypot(dx, dz);
    const lim = 0.2 + 0.11;
    if (d >= lim || d < 1e-9) continue;
    const nx = dx / d, nz = dz / d;
    b.p.x = j.x + nx * lim; b.p.z = j.z + nz * lim;
    const vn = (b.v.x - j.vx) * nx + (b.v.z - j.vz) * nz;
    if (vn < 0) {
      b.v.x -= 1.35 * vn * nx; b.v.z -= 1.35 * vn * nz;
      if (b.rolando) { b.w.x = b.v.z / 0.11; b.w.z = -b.v.x / 0.11; }
      m.eventos.push({ tipo: 'bateuCorpo', id: j.id });
      registrarToque(m, j, 'corpo');
      m.desvio = m.tick; // o goleiro relê o chute desviado (goleiro.js lerChute)
      // a bola desviada não passa mais onde o domínio aéreo / cabeceio marcado esperava: o plano cai (o jogador ia
      // para o ponto antigo enquanto a bola fugia — contraprova M4: até 3 m em lançamento que bate no corpo)
      for (const o of m.jogadores) if (o.cond && o.cond.toque && o.cond.toque.tipo === 'aereo') o.cond.toque = null;
      const dono = m.posse != null ? jogadorPorId(m, m.posse) : null;
      if (dono) dono.cond.bolaDesviada = true;
    }
  }
}

/**
 * Pedalada: o pé de fora é o pé livre do arco por cima da bola e o outro segura o corpo
 * (travaApoio: não sai do chão até o fim do arco). Sem salto de fase nem pé teletransportado:
 * com os dois pés no chão, a passada tira o pé de fora do chão pelo ritmo (como no toque); se o
 * outro pé estava no ar, ele termina o passo e fica no chão. Devolve o pedido de saída para a
 * passada (jogador.js passoPassada) ou null.
 */
function pesDaPedalada(m, j) {
  const pd = j.cond.pedalada;
  const t = (m.tick - pd.tick0) * PASSO;
  if (t >= 0.8 * CONDUCAO.pedaladaDuracao) { j.travaApoio = null; return null; }
  const fora = pd.lado > 0 ? 0 : 1;
  j.travaApoio = 1 - fora;
  // no ar, o pé de fora só pousa no fim do arco (o passo fica mais lento, sem salto de fase; o
  // arco por cima da bola é desenhado em anim.js)
  return { pe: fora, em: PASSO, pousoEm: PEDALADA_POUSO * CONDUCAO.pedaladaDuracao - t };
}
const PEDALADA_POUSO = 0.85; // fração da pedalada em que o pé de fora pousa

/**
 * Lado da pedalada: o pé de fora (o do arco por cima da bola; lado > 0 = pé 0) é o que está livre
 * agora (no ar, com o outro no chão), ou o que a passada tira do chão primeiro (os dois no chão),
 * ou o que pousa por último (os dois no ar). Assim o arco começa já, sem esperar o outro pé pousar.
 */
function ladoPedalada(j) {
  const a0 = j.pes[0].apoio, a1 = j.pes[1].apoio;
  let fora;
  if (a0 !== a1) fora = a0 ? 1 : 0;
  else if (a0) fora = faseLocal(j.fase, 1) > faseLocal(j.fase, 0) ? 1 : 0;
  else fora = j.pes[0].fasePouso >= j.pes[1].fasePouso ? 0 : 1;
  return fora === 0 ? 1 : -1;
}

function roubarComMarcador(m, j) {
  const b = m.bola;
  if (m.posse == null) return; // bola livre não é roubada (quem chegar primeiro domina)
  if (b.p.y > 0.5) return;
  const d = MD.hypot(b.p.x - j.x, b.p.z - j.z);
  if (d > TREINO.marcadorAlcance + 0.11) return;
  const dono = jogadorPorId(m, m.posse);
  // tira a bola: empurra na direção em que o marcador está virado
  const v = 3.2;
  chutarRasteiro(b, MD.cos(j.rumo) * v, MD.sin(j.rumo) * v);
  // quem perdeu não domina de novo no tick seguinte (a bola ainda está ao alcance dele)
  if (dono) { dono.cond.toque = null; dono.cond.busca = false; dono.cond.semDominioAte = m.tick + 30; }
  m.posse = null;
  m.stats.roubadas++;
  m.eventos.push({ tipo: 'roubada', id: j.id });
  j.descanso = 60; // 1 s sem tentar de novo
}

/**
 * Bote da IA defensora: com a bola do adversário ao alcance do pé e solta do pé dele, tenta tirar
 * (sorteio por passo, com descanso depois). A bola sai para longe de quem conduzia.
 */
function boteIA(m, j) {
  if (j.descansoBote > 0) { j.descansoBote--; return; }
  if (m.posse == null || m.naMao != null) return;
  if (naParada(m)) return; // partida: ninguém dá bote na cobrança
  const dono = jogadorPorId(m, m.posse);
  if (!dono || dono.time === j.time) return;
  const b = m.bola, cfg = ACOES.boteIA;
  // Etapa 4 (só na partida): o marcador batido, colado atrás do condutor no ataque promissor, segura (falta tática)
  if (m.partida && !m.faltaPendente) {
    const ft = faltaTatica(m, j, dono);
    if (ft) { registrarFalta(m, ft); dono.vx *= 0.3; dono.vz *= 0.3; j.descansoBote = cfg.descanso; return; }
  }
  if (b.p.y > 0.5) return;
  const dB = MD.hypot(b.p.x - j.x, b.p.z - j.z);
  if (dB > cfg.alcance) return;
  const dD = MD.hypot(b.p.x - dono.x, b.p.z - dono.z);
  // (só na partida) condutor parado ou lento (abaixo de vParado m/s) e sem tocar na bola há semToque s: a bola parada à
  // frente do pé dele (a condução a deixa a ~0,345 m do corpo) não está "colada" — quem chega ao alcance dela tenta
  // tirar. Antes o bote nunca chegava ao sorteio contra quem ficava parado (o defensor não fica mais perto da bola que
  // o condutor: corpos de 0,3 m de raio) — pedido do dono, 11/10: "se eu deixo o meu jogador parado, ninguém pega a bola"
  const ultT = dono.cond?.ult;
  const lento = !!m.partida && MD.hypot(dono.vx, dono.vz) < cfg.vParado && !(ultT && (m.tick - ultT.tick) * PASSO < cfg.semToque);
  // colada no pé de quem conduz: não alcança — a não ser que ela esteja ENCOSTADA no corpo do marcador com os dois
  // andando juntos (o condutor empurrando a bola nele): aí ela está entre os dois e é disputada
  const encostada = dB <= cfg.encostada && MD.hypot(j.vx - dono.vx, j.vz - dono.vz) <= cfg.encostadaVrel;
  if (!lento && !encostada && (dD < cfg.colada || dB > dD)) return;
  if (uniforme(m.rng) >= cfg.chancePorPasso) return;
  // Etapa 4 (só na partida): o bote que chega pode ser falta (faltas.js: chegada, velocidade, desarme) — a bola fica
  // com o condutor (desequilibrado) e o árbitro decide nas regras (vantagem, tiro livre, pênalti, cartão)
  if (m.partida && !m.faltaPendente) {
    const f = faltaNoBote(m, j, dono);
    if (f) { registrarFalta(m, f); dono.vx *= 0.5; dono.vz *= 0.5; j.descansoBote = cfg.descanso; return; }
  }
  // contra o condutor parado/lento o bote em pé ganha pela mesma chance da DIVIDIDA do humano (desarme × drible/controle,
  // 35–65%: simetria — o humano já tirava a bola do condutor parado da IA); errou, descansa (o condutor que reage escapa)
  if (lento && uniforme(m.rng) >= chanceDividida(j, dono, b.p.x, b.p.z)) {
    j.descansoBote = cfg.descanso;
    m.eventos.push({ tipo: 'boteErrado', id: j.id });
    return;
  }
  // tira: para longe de quem conduzia
  let ux = b.p.x - dono.x, uz = b.p.z - dono.z;
  const l = MD.hypot(ux, uz) || 1; ux /= l; uz /= l;
  chutarRasteiro(b, ux * cfg.vSai, uz * cfg.vSai);
  dono.cond.toque = null; dono.cond.busca = false;
  m.posse = null;
  m.voo = null;
  m.ultimoToque = { id: j.id, time: j.time, tick: m.tick };
  m.stats.roubadas++;
  m.eventos.push({ tipo: 'roubada', id: j.id, ia: true });
  registrarToque(m, j, 'roubada');
  j.descansoBote = cfg.descanso;
}

/**
 * Um passo de simulação (1/60 s). entradas: { [time]: {x, z, botoes} } — o analógico já no
 * mundo; vai para o jogador CONTROLADO daquele time (m.controlado). Os demais são da IA.
 */
export function passo(m, entradas) {
  m.eventos = [];
  const js = m.jogadores;
  // botões de cada time humano (bordas de TROCAR e botões segurados na troca)
  for (const t of m.humanos) {
    m.botoesTimeAnt[t] = m.botoesTimeAgora[t] ?? 0;
    m.botoesTimeAgora[t] = (entradas?.[t]?.botoes ?? 0) | 0;
    // a IA jogando pelo humano (demo, e.ia): o goleiro dele repõe sozinho, como antes (sim.js goleiroComBola)
    if (m.partida) (m.iaJoga ??= {})[t] = !!entradas?.[t]?.ia;
  }
  // 1) entradas: humano (o controlado de cada time humano) e IA (entrada virtual)
  for (const j of js) {
    if (j.papel === 'marcador' || j.papel === 'parado') continue;
    const e = m.humanos.includes(j.time) ? entradas?.[j.time] : null;
    j.botoesTime = e ? (e.botoes | 0) : 0;
    if (ehControlado(m, j)) {
      // passe chegando com o analógico solto: a assistência de antes (a IA leva ao encontro / ao ponto da
      // enfiada) — vale quando a recepção assistida não acha encontro (bola alta longe de descer)
      const antiga = j.recebe && m.posse !== j.id && !(e && MD.hypot(e.x ?? 0, e.z ?? 0) > 0.25);
      // Etapa 3: CONTER (defesa.js) e a assistência na bola alta (troca.js, só na partida)
      const ed = !antiga && (j.defH || (e && (e.botoes & BOTOES_DEFESA))) ? entradaConter(m, j, e) : null;
      const ea = !antiga && !ed && m.times ? alvoAereo(m, j, e) : null;
      // recepção assistida (recepcao.js; pedido do dono, 10/10): a bola vindo para ele, o CORPO vai ao
      // encontro dela (passo 2, movimentoRecepcao) e o analógico fica para o 1º toque — nada de sair da
      // bola. O plano usa o analógico do passo anterior (j.ix, j.iz, j.botoes): um passo de atraso no
      // modo/pressa da recepção, nunca no corpo
      // (a entrada da demo — a IA jogando pelo humano, e.ia — recebe como a IA, sem a assistência)
      const rp = !ed && !ea && !(e && e.ia) ? planejarRecepcao(m, j) : semRecepcao(j);
      if (!rp && antiga) {
        const ia = m.times ? entradaIATatica(m, j) : entradaIA(m, j);
        aplicarEntrada(j, { ...ia, botoes: (e?.botoes ?? 0) | (ia.botoes & BOTAO.CORRER) }, m.tick);
      } else {
        aplicarEntrada(j, ed ?? ea ?? e, m.tick);
      }
      if (e && (e.botoes & BOTAO.PRESSAO)) pedidoPressao(m, j);
    } else if (j.posicao === 'GOL') {
      // partida: o goleiro da IA com a bola no pé (ou indo à bola que não pode pegar com a mão) joga com o pé
      aplicarEntrada(j, m.partida && goleiroNoPe(m, j) ? entradaGoleiroPe(m, j) : null, m.tick);
    } else {
      aplicarEntrada(j, m.times ? entradaIATatica(m, j) : entradaIA(m, j), m.tick);
    }
    atualizarBotoesAcao(m, j);
  }
  trocarJogador(m, entradas);
  if (m.partida) pegarDoHumano(m); // PEGAR (goleiro do humano com a bola no pé, na área)
  if (m.times) trocaAerea(m); // Etapa 3: troca automática para quem disputa a bola alta
  // 2) movimento de cada corpo
  for (const j of js) {
    let mv;
    if (j.papel === 'marcador') {
      if (j.descanso > 0) { j.descanso--; mv = { dx: MD.cos(j.rumo), dz: MD.sin(j.rumo), vel: 0, rumoAlvo: j.rumo }; }
      else mv = moverMarcador(m, j);
    } else if (j.papel === 'parado') {
      mv = { dx: 1, dz: 0, vel: 0, rumoAlvo: j.rumo };
    } else if (j.posicao === 'GOL' && !goleiroComoLinha(m, j)) {
      mv = movimentoGoleiro(m, j, m.humanos.includes(j.time));
      // defesa desenhada (mergulho, salto, em pé): o corpo anda pela conta do mergulho, não pela locomoção
      if (mergulhoAtivo(j, m.tick + 1)) { passoMergulho(m, j); continue; }
      // partida: o goleiro do humano com a bola nas mãos anda pelo analógico até a borda da área (nunca sai dela)
      if (m.partida && m.naMao === j.id && ehControlado(m, j) && !m.iaJoga?.[j.time] && !(m.parada && !m.parada.rolou)) mv = andarComBolaNaMao(m, j);
    } else if (m.posse === j.id) {
      if (j.pedidoPedalada) {
        j.pedidoPedalada = false;
        j.cond.pedalada = { tick0: m.tick, lado: ladoPedalada(j) };
        j.cond.ref = null; // replaneja: a bola para junto do corpo
      }
      if (j.cond.pedalada && (m.tick - j.cond.pedalada.tick0) * PASSO > CONDUCAO.pedaladaDuracao) {
        j.cond.pedalada = null; j.cond.ref = null;
      }
      mv = movimentoComBola(m, j);
    } else {
      j.pedidoPedalada = false;
      mv = movimentoAereo(m, j, movimentoRecepcao(m, j, movimentoBase(j, j.ix, j.iz, j.imag, j.botoes, false, j.rumo, null)));
      // IA sem a bola andando/trotando olha para a bola (passo de lado ou de costas, como no jogo de
      // verdade); antes andava de costas para o lance. Contínuo: quanto mais devagar, mais o tronco
      // pode se afastar do sentido do movimento (parado: todo; IA.olhaBola[1] m/s ou mais: nada) —
      // um liga/desliga na velocidade do trote fazia o tronco ir e voltar
      // (Etapa 3, só na partida: o olhar com a velocidade filtrada, o ponto de chegada do passe no ar
      // e o giro do olhar limitado — ia-tatica.js olhaBolaPartida; o treino continua com o de baixo)
      if (m.times && guiadoPelaIA(m, j) && !j.recebe && !j.cond?.toque) mv = olhaBolaPartida(m, j, mv, desvioOlhaBola);
      else if (guiadoPelaIA(m, j) && !j.recebe && !j.cond?.toque) {
        const v = Math.max(mv.vel, MD.hypot(j.vx, j.vz));
        const lim = desvioOlhaBola(v);
        if (lim > 0) {
          const aB = MD.atan2(m.bola.p.z - j.z, m.bola.p.x - j.x);
          let d = difAng(mv.rumoAlvo, aB);
          // bola quase atrás: mantém o lado escolhido (sem o tronco cruzar de um lado para o outro)
          if (Math.abs(d) > 2.6 && j.ladoOlha) d = j.ladoOlha * Math.abs(d);
          j.ladoOlha = d >= 0 ? 1 : -1;
          mv = { ...mv, rumoAlvo: mv.rumoAlvo + clamp(d, -lim, lim) };
        }
      }
    }
    // a IA sem a bola gira o tronco parado mais devagar (o tronco rodopiava no lugar); o jogador do
    // humano mantém o giro rápido (virar 90° parado em ~0,12 s)
    j.giroParado = guiadoPelaIA(m, j) && m.posse !== j.id ? IA.giroParado : null;
    // CONTER (defesa.js): o controlado acompanhando o condutor fica de frente para ele (j.conter só
    // existe depois do CONTER apertado: o treino não muda)
    if (j.conter && m.posse !== j.id) mv = troncoConter(m, j, mv);
    // partida: na bola parada, ninguém entra no raio (e quem está dentro sai) pela locomoção
    if (m.parada) mv = paredeParada(m, j, mv);
    passoCorpo(j, mv.dx, mv.dz, mv.vel, mv.rumoAlvo, j.par, PASSO, m.posse === j.id);
  }
  colisaoCorpos(m);
  // a passada depois da trombada: o pé que sai do chão mira o pouso pela velocidade que o corpo
  // tem DEPOIS do contato (antes mirava pela de antes e o pé caía longe do corpo)
  for (const j of js) {
    // goleiro na defesa desenhada: o corpo e os pés são os do quadro do mergulho (trombada não o tira dele)
    if (j.posicao === 'GOL' && mergulhoAtivo(j, m.tick + 1)) { fixarMergulho(m, j); pesMergulho(m, j); continue; }
    const ped = j.cond && j.cond.pedalada ? pesDaPedalada(m, j) : null;
    if (!(j.cond && j.cond.pedalada) && j.travaApoio != null) j.travaApoio = null;
    passoPassada(j, m.posse === j.id, PASSO, null, ped || saidaParaToque(m, j));
  }
  // 3) ações e controle de bola
  for (const j of js) if (j.pedido) processarPedido(m, j);
  if (m.naMao != null) {
    const g = jogadorPorId(m, m.naMao);
    if (g) goleiroComBola(m, g);
  } else if (m.parada && lateralSegurando(m)) {
    // lateral (Etapa 4): a bola está nas mãos do cobrador — nada de condução até o arremesso (partida.js cobrar)
  } else if (m.posse != null) {
    const dono = jogadorPorId(m, m.posse);
    if (dono) {
      const t = dono.cond.toque;
      if (t && t.tipo === 'acao' && m.tick >= t.tick) {
        if (!executarAcaoMarcada(m, dono)) controlarComBola(m, dono);
      } else controlarComBola(m, dono);
    }
  } else {
    bolaLivre(m);
  }
  for (const j of js) {
    if (j.papel === 'marcador' && !(j.descanso > 0) && m.posse !== j.id) roubarComMarcador(m, j);
    else if (j.posicao !== 'GOL' && guiadoPelaIA(m, j)) boteIA(m, j);
    else if ((j.defH || ((j.botoes | j.botoesAnt) & BOTAO.DIVIDIDA)) && ehControlado(m, j)) dividida(m, j); // Etapa 3
  }
  // 4) goleiros leem o chute e defendem
  for (const j of js) {
    if (j.posicao !== 'GOL') continue;
    lerChute(m, j);
    const antes = m.naMao;
    aplicarDefesa(m, j);
    // encaixou: com o goleiro do time humano, o controle vai para ele como no "pegou" (antes o encaixe
    // deixava o controle na linha e o pegou o passava ao goleiro: dois comportamentos para a mesma bola)
    if (m.naMao === j.id && antes !== j.id && m.humanos.includes(j.time) && m.controlado[j.time] !== j.id) {
      assumirControle(m, j.time, j);
      m.eventos.push({ tipo: 'troca', id: j.id, auto: true });
    }
  }
  // 5) bola
  if (m.naMao != null) {
    const g = jogadorPorId(m, m.naMao);
    if (g) bolaNaMao(m, g);
  } else if (m.parada && segurarLateral(m)) {
    // lateral (Etapa 4): a bola nas duas mãos (atrás da cabeça ou no arco do arremesso), sem física
  } else {
    passoBola(m.bola, m.eventos);
    colisaoBolaCorpo(m);
    if (m.partida && m.partida.barreira) colisaoBarreira(m); // tiro livre: a bola na barreira que pula (Etapa 4)
  }
  verificarGol(m);
  // 6) posse
  if (m.posse != null && m.naMao == null && !(m.parada && lateralSegurando(m))) {
    const dono = jogadorPorId(m, m.posse);
    if (dono) verificarPerda(m, dono);
  }
  if (m.voo && m.posse != null) m.voo = null;
  // passe que morreu (a bola rolando a menos de 1 m/s meio segundo depois da hora de chegar): vira bola livre.
  // Antes o passe continuava "do recebedor" para sempre: ele já tinha desistido (j.recebe vence em 4 s) e os
  // companheiros mais perto não iam na bola do passe de outro — os 22 ficavam parados em volta dela (medido
  // na partida IA × IA, semente 7: 40% do tempo com a bola parada no meio-campo)
  else if (m.voo && m.voo.para != null && m.naMao == null && m.bola.rolando && m.tick > (m.voo.tickChegada ?? m.voo.tick0) + 30
    && MD.hypot(m.bola.v.x, m.bola.v.z) < 1) m.voo = null;
  // 7) gesto do toque (só visual: o pé desenhado indo até a bola, com velocidade limitada)
  for (const j of js) if (j.cond) atualizarGesto(m, j);
  // 8) pé desenhado no balanço (trajetória + gesto, com a velocidade de um pé humano) e altura
  // do quadril da pose (sobe com velocidade limitada: anim.js alturaQuadril)
  for (const j of js) if (!(j.posicao === 'GOL' && mergulhoAtivo(j, m.tick + 1))) passoPeDesenhado(j, m, PASSO);
  m.tick++;
  for (const j of js) j.quadril = alturaQuadril(j, m);
}

/**
 * Tronco do controlado no CONTER (defesa.js rumoConter: de frente para a bola do condutor), limitado
 * pela velocidade com a mesma regra do "olha a bola" da IA (IA.olhaBola; função própria, para o CONTER
 * não mudar se o "olha a bola" da IA for recalibrado): devagar (o "jockey"), de frente; correndo atrás
 * do condutor, o tronco vai com a corrida (ninguém corre de lado a 3 m/s; acima de 2,5 m/s o passoCorpo
 * prende o tronco a ≤ 80° da corrida, e um limite que não chegasse antes disso faria o tronco virar de
 * uma vez nessa velocidade). Sem pedido: `mv`.
 */
function troncoConter(m, j, mv) {
  const r = rumoConter(m, j);
  if (r == null) return mv;
  const v = Math.max(mv.vel, MD.hypot(j.vx, j.vz));
  const { vLivre, vLado, vSome } = IA.olhaBola;
  const v1 = vLivre * 1.5;
  const lat = a => MD.asin(Math.min(1, vLado / a));
  const lim = v <= vLivre ? Math.PI : v < v1 ? lerp(Math.PI, lat(v1), (v - vLivre) / (v1 - vLivre)) : lat(v) * clamp((vSome - v) / 1.0, 0, 1);
  return { dx: mv.dx, dz: mv.dz, vel: mv.vel, rumoAlvo: mv.rumoAlvo + clamp(difAng(mv.rumoAlvo, r), -lim, lim) };
}

/** Executa a ação marcada para este tick (pé de apoio no chão, bola no alcance). */
function executarAcaoMarcada(m, j) {
  const t = j.cond.toque;
  const b = m.bola;
  const pe = t.pe, apoio = 1 - pe;
  const alc = MD.hypot(b.p.x - j.x, b.p.z - j.z) <= CONDUCAO.alcance + 0.1 && b.p.y < 0.7;
  if (!alc) { j.cond.toque = null; return false; }
  const peFinal = j.pes[apoio].apoio ? pe : (j.pes[pe].apoio ? apoio : pe);
  if (!j.pes[1 - peFinal].apoio && m.tick - t.tick < 8) return true; // espera o pé de apoio pisar
  return executarAcao(m, j, peFinal, false);
}

// candidatos da bola livre (vetores reaproveitados: nada alocado por passo)
const _cands = [], _candD = [];
/**
 * Candidatos da bola livre em _cands[0..n): os jogadores de linha (sem marcador nem parado), o
 * recebedor marcado (alvo) primeiro e depois pela distância até a bola, com empate na ordem de
 * m.jogadores — a MESMA ordem do antigo filter + sort (estável) com o comparador (alvo primeiro ||
 * distância), por inserção estável. Devolve n.
 */
function candidatosBolaLivre(m, alvo) {
  const b = m.bola, js = m.jogadores;
  let n = 0;
  for (let k = 0; k < js.length; k++) {
    const j = js[k];
    if (j.papel === 'marcador' || j.papel === 'parado') continue;
    // o goleiro só disputa a bola livre com o pé quando não pode pegá-la com a mão (partida: recuo, a bola que ele
    // soltou, fora da área — Regra 12)
    if (j.posicao === 'GOL' && !(m.partida && !maoPermitida(m, j, b.p.x, b.p.z))) continue;
    const d = MD.hypot(j.x - b.p.x, j.z - b.p.z);
    const pri = j.id === alvo;
    let i = n - 1;
    // anda para a direita quem vem DEPOIS de j na ordem (comparador > 0): não é o alvo sendo j o alvo,
    // ou mesma prioridade e mais longe
    while (i >= 0 && ((pri && _cands[i].id !== alvo) || ((_cands[i].id === alvo) === pri && _candD[i] - d > 0))) {
      _cands[i + 1] = _cands[i]; _candD[i + 1] = _candD[i]; i--;
    }
    _cands[i + 1] = j; _candD[i + 1] = d;
    n++;
  }
  return n;
}

/** Bola livre: quem vai recebê-la? Recebedor marcado primeiro; depois, os mais perto. */
function bolaLivre(m) {
  const b = m.bola;
  const alvo = m.voo && m.voo.para != null ? m.voo.para : null;
  const nc = candidatosBolaLivre(m, alvo);
  const passou = m.voo && m.voo.de != null && m.tick - (m.voo.tick0 ?? 0) < 6 ? m.voo.de : null;
  for (let k = 0; k < nc; k++) {
    const j = _cands[k];
    if (j.id === passou) continue; // quem acabou de bater não domina a própria bola
    if (naParada(m) && j.id !== m.parada.cobrador) continue; // partida: só o cobrador
    if (!b.rolando && b.p.y > 0.45) {
      if (bolaAltaNoCorpo(m, j)) return;
      continue;
    }
    const antes = m.posse;
    if (tentarDominio(m, j, primeira)) {
      if (m.posse === j.id && antes !== j.id) ganhouPosse(m, j);
      return;
    }
  }
  // o goleiro pega a bola solta perto dele (dentro da área)
  for (const g of m.jogadores) {
    if (g.posicao !== 'GOL') continue;
    if (naParada(m) && g.id !== m.parada.cobrador) continue; // partida: só o cobrador
    const gx = linhaDoGol(m, g);
    // (partida: só onde a mão vale — na área, com qualquer parte da bola sobre a linha, sem recuo nem a bola que ele
    // soltou: regras-goleiro.js)
    const naArea = m.partida ? maoPermitida(m, g, b.p.x, b.p.z) : Math.abs(b.p.x - gx) < 16.5 && Math.abs(b.p.z) < 20.16;
    // no meio da defesa desenhada (o corpo já está no quadro do próximo tick), só com a mão desenhada na bola
    // a própria espalmada não volta para as mãos logo depois (GOLEIRO.reagarra)
    const espalmou = m.ultimoToque && m.ultimoToque.id === g.id && (m.tick - m.ultimoToque.tick) * PASSO < GOLEIRO.reagarra;
    if (naArea && !espalmou && MD.hypot(b.p.x - g.x, b.p.z - g.z) < 1.0 && b.p.y < 2.2 && MD.hypot(b.v.x, b.v.z) < 9
      && (!mergulhoAtivo(g, m.tick + 1) || maoNaBola(g, m.tick + 1, b.p))) {
      m.naMao = g.id; m.posse = g.id; g.segura = { desde: m.tick };
      b.v.x = 0; b.v.y = 0; b.v.z = 0; m.voo = null;
      m.eventos.push({ tipo: 'defesa', id: g.id, modo: 'pegou' });
      ganhouPosse(m, g);
      return;
    }
  }
}

/** De primeira: com uma ação pedida, bate na bola que chega em vez de dominar. */
function primeira(m, j, pe) {
  if (!j.pedido) return false;
  const ok = executarAcao(m, j, pe, true);
  return ok;
}

/** Com cabeceio/domínio aéreo marcado: vai para o ponto marcado e chega na hora, de frente para a bola. */
function movimentoAereo(m, j, base) {
  const t = j.cond.toque;
  if (!t || t.tipo !== 'aereo' || m.posse === j.id) return base;
  const dx = t.bx - j.x, dz = t.bz - j.z, d = MD.hypot(dx, dz);
  const resta = Math.max(1, t.tick - m.tick) * PASSO;
  const b = m.bola;
  const rumo = MD.atan2(b.p.z - j.z, b.p.x - j.x);
  if (d < 0.05) return { dx: base.dx, dz: base.dz, vel: 0, rumoAlvo: rumo };
  return { dx: dx / d, dz: dz / d, vel: Math.min(j.par.vArrancada, d / resta), rumoAlvo: rumo };
}

/** Bola alta chegando ao corpo: cabeceio (com ação pedida) ou domínio no peito/coxa. */
function bolaAltaNoCorpo(m, j) {
  const c = j.cond;
  const b = m.bola;
  if (c.toque && c.toque.tipo === 'aereo') {
    if (m.tick < c.toque.tick) return true;
    c.toque = null;
    const d = MD.hypot(b.p.x - j.x, b.p.z - j.z);
    const alcanceY = ACOES.cabeceio.alcanceSalto * (0.92 + 0.12 * j.par.attr.impulsao / 100);
    if (d > 0.75 || b.p.y > alcanceY) return false;
    // disputa pelo alto (Etapa 4, só na partida e, por enquanto, só na bola que vem de uma bola parada — escanteio,
    // falta, lateral; no jogo corrido entra com o equilíbrio): o adversário que alcança a bola no ponto disputa
    if (m.partida && b.p.y >= AEREO.yMin && m.voo && m.voo.bolaParada) {
      const o = rivalNoAlto(m, j);
      if (o) {
        const venceu = ganhaDisputa(m, j, o);
        m.eventos.push({ tipo: 'disputaAerea', id: venceu ? j.id : o.id, perdeu: venceu ? o.id : j.id });
        if (!venceu) {
          // o rival ganhou: afasta de cabeça (para longe do gol dele); quem ia na bola não toca nela — nem logo depois,
          // ainda no ar (AEREO.perdeuSalto s: antes ele cabeceava a bola recém-afastada, colada nele, para o gol)
          j.pedido = null; j.perdeuAlto = m.tick;
          const p0 = o.pedido && o.pedido.tipo !== 'chute' ? o.pedido : { tipo: 'lancamento', forca: 0.8 };
          o.pedido = null; if (o.cond) o.cond.toque = null;
          executarCabeceio(m, o, p0);
          m.eventos.push({ tipo: 'cabeceio', id: o.id });
          return true;
        }
        j.disputa = m.tick; // ganhou disputando: o cabeceio sai mais impreciso (acoes.js)
      }
    }
    if (b.p.y > ACOES.cabeceio.alturaPeito[1] || j.pedido) {
      // sem botão: a IA na área cabeceia para o gol; fora dela (e o humano), cabeceia de passe
      const lado = ataca(m, j.time);
      const naArea = (lado * CAMPO.meioX - j.x) * lado < 16.5 && Math.abs(j.z) < 20.16;
      const p = j.pedido ?? (naArea && !ehControlado(m, j) ? { tipo: 'chute', forca: 0.7 } : { tipo: 'passe', forca: 0.5 });
      j.pedido = null;
      executarCabeceio(m, j, p);
      m.eventos.push({ tipo: 'cabeceio', id: j.id });
      return true;
    }
    // domínio no peito/coxa: a bola morre e cai no pé, e o toque leva para onde o analógico manda
    const sobra = lerp(ACOES.dominioAereo.sobra[0], ACOES.dominioAereo.sobra[1], j.par.attr.controle / 100);
    const vRel = MD.hypot(b.v.x - j.vx, b.v.y, b.v.z - j.vz);
    b.v.x = j.vx + (b.v.x - j.vx) * sobra; b.v.z = j.vz + (b.v.z - j.vz) * sobra; b.v.y = 0; b.p.y = 0.11; b.rolando = true;
    const peD = peLivre(j, j.par.attr.pePreferido, true);
    executarToque(m, j, peD >= 0 ? peD : j.par.attr.pePreferido, 'dominio');
    m.eventos.push({ tipo: 'dominioAereo', id: j.id, altura: b.p.y, vChegada: vRel, sobra: vRel * sobra });
    registrarToque(m, j, 'peito');
    ganhouPosse(m, j);
    return true;
  }
  if (j.perdeuAlto != null && (m.tick - j.perdeuAlto) * PASSO < AEREO.perdeuSalto) return false;
  const r = bolaAltaPassando(m, j, 60);
  if (!r) return false;
  const alcanceY = ACOES.cabeceio.alcanceSalto * (0.92 + 0.12 * j.par.attr.impulsao / 100);
  if (r.y > alcanceY || r.y < 0.2) return false;
  c.toque = { tick: m.tick + r.i, pe: j.par.attr.pePreferido, bx: r.x, bz: r.z, tipo: 'aereo', y: r.y };
  return true;
}

/**
 * Adversário de j que disputa a bola alta no toque dele: de linha, a ≤ AEREO.raio m da bola e alcançando a altura dela
 * (o salto pela impulsão); o mais perto. Só na partida.
 */
function rivalNoAlto(m, j) {
  const b = m.bola.p;
  let mel = null, dm = Infinity;
  for (const o of m.jogadores) {
    if (o.time === j.time || o.posicao === 'GOL' || o.papel === 'parado' || o.papel === 'marcador') continue;
    const d = MD.hypot(b.x - o.x, b.z - o.z);
    if (d > AEREO.raio) continue;
    const alcanceY = ACOES.cabeceio.alcanceSalto * (0.92 + 0.12 * o.par.attr.impulsao / 100);
    if (b.y > alcanceY) continue;
    // o controlado do humano ao alcance disputa (quem joga vê o próprio jogador subir); senão, o mais perto
    if (ehControlado(m, o)) return o;
    if (d < dm) { dm = d; mel = o; }
  }
  return mel;
}

/** j (quem ia na bola) ganha a disputa pelo alto contra o? Logística da diferença de nota, o lado do gol (m.rng). */
function ganhaDisputa(m, j, o) {
  const gx = ataca(m, o.time) * -CAMPO.meioX; // gol que o rival defende
  const oNoGol = MD.hypot(gx - o.x, o.z) < MD.hypot(gx - j.x, j.z);
  const x = AEREO.k * (notaAerea(j) - notaAerea(o)) / 100 + (oNoGol ? -AEREO.ladoGol : AEREO.ladoGol);
  const p = 1 / (1 + MD.exp(-x));
  return uniforme(m.rng) < p;
}

/** O jogador ganhou a posse: o controle humano vai para ele (time humano). */
function ganhouPosse(m, j) {
  registrarToque(m, j, 'posse');
  if (m.humanos.includes(j.time) && m.controlado[j.time] !== j.id) {
    assumirControle(m, j.time, j);
    m.eventos.push({ tipo: 'troca', id: j.id, auto: true });
  }
  j.recebe = null;
  m.voo = null;
  for (const t of m.humanos) {
    if (t === j.time) continue;
    // o time humano perdeu a bola: passa para o jogador de linha mais perto dela
    let mel = null, dm = Infinity;
    for (const o of m.jogadores) {
      if (o.time !== t || o.posicao === 'GOL') continue;
      const d = MD.hypot(o.x - m.bola.p.x, o.z - m.bola.p.z);
      if (d < dm) { dm = d; mel = o; }
    }
    if (mel && m.controlado[t] !== mel.id) { assumirControle(m, t, mel); m.eventos.push({ tipo: 'troca', id: mel.id, auto: true }); }
  }
}

/** Jogador de linha que a IA move neste tick (não é o controlado nem um boneco do treino). */
function guiadoPelaIA(m, j) {
  return j.papel !== 'marcador' && j.papel !== 'parado' && !ehControlado(m, j);
}

/**
 * Quanto o tronco da IA sem a bola pode se afastar do sentido do movimento para olhar a bola, pela
 * velocidade: devagar, todo (até de costas); depois, só o que deixa a velocidade de lado em até
 * IA.olhaBola.vLado (ninguém corre de lado a 3 m/s — o passo lateral é curto); some na arrancada.
 */
function desvioOlhaBola(v) {
  const { vLivre, vLado, vSome } = IA.olhaBola;
  const lat = a => MD.asin(Math.min(1, vLado / a));
  if (v <= vLivre) return Math.PI;
  const v1 = vLivre * 1.5;
  if (v < v1) return lerp(Math.PI, lat(v1), (v - vLivre) / (v1 - vLivre));
  return lat(v) * clamp((vSome - v) / 1.0, 0, 1);
}

/**
 * Goleiro com a bola nas mãos: segura e repõe. Quem repõe sozinho: a IA (GOLEIRO.esperaIA); no treino e na demo (a IA
 * jogando pelo humano), o goleiro do humano depois de GOLEIRO.esperaHumano. Na PARTIDA o humano repõe quando quiser
 * (pedido do dono, 11/10: "eu não consigo mexer com o goleiro") — anda com a bola até a borda da área, PASSE rola curto,
 * LANÇAMENTO (ou CHUTE) é o chutão, ENFIADA solta a bola no chão para sair jogando com o pé — e a Regra 12.3 (mais de
 * 8 s: escanteio, partida.js) é o limite (o tiro de meta é com o pé, no chão: partida.js montarTiroDeMeta).
 */
function goleiroComBola(m, g) {
  // ainda no chão depois do encaixe no mergulho: levanta antes de repor
  if (mergulhoAtivo(g, m.tick + 1)) return;
  // de pé com a bola nas mãos: começa o relógio da Regra 12.3 (partida.js; só conta com a bola em jogo)
  if (g.segura && g.segura.dePe == null) g.segura.dePe = m.tick;
  const humano = ehControlado(m, g);
  const pr = m.parada && !m.parada.rolou ? m.parada : null;
  const livre = humano && m.partida && !m.iaJoga?.[g.time];
  if (!livre) {
    // IA: repõe depois de 1,5 s. Treino e demo: se o humano não apertar botão de ação (nem estiver carregando um), a IA
    // repõe por ele depois de GOLEIRO.esperaHumano — antes o goleiro ficava com a bola para sempre: "trava"
    const espera = Math.round((humano ? GOLEIRO.esperaHumano : GOLEIRO.esperaIA) / PASSO);
    if (!g.pedido && !g.carga && m.tick - (g.segura?.desde ?? m.tick) > espera) {
      // lança para o companheiro mais adiantado ou na direção do analógico/do corpo
      // para a frente, sem o analógico: quem não sabe repor mexe justamente o analógico (para o próprio
      // gol o goleiro pegava a própria reposição de novo, em laço)
      g.pedido = { tipo: 'lancamento', forca: 0.7, mod: false, tick: m.tick, dir: { x: ataca(m, g.time), z: 0 } };
    }
  }
  if (g.pedido && m.tick - (g.segura?.desde ?? m.tick) > 20) {
    if (livre && !pr) {
      // ENFIADA: solta a bola no chão e sai jogando com o pé (Regra 12.2: não pega de novo com a mão antes de outro tocar)
      if (g.pedido.tipo === 'enfiada') { soltarNoChao(m, g); return; }
      // CHUTE com a bola nas mãos: o chutão (bate-pronto), o mesmo do LANÇAMENTO
      if (g.pedido.tipo === 'chute') g.pedido.tipo = 'lancamento';
    }
    soltarDaMao(m, g);
    const b = m.bola;
    b.p.x = g.x + MD.cos(g.rumo) * 0.45; b.p.z = g.z + MD.sin(g.rumo) * 0.45;
    if (m.partida) bolaAquemDaLinha(m, g, b);
    executarAcao(m, g, g.par.attr.pePreferido, false);
    g.miraAuto = null;
    // sem recebedor (bola no espaço), o humano não fica controlando o goleiro sem a bola: o controle vai para o
    // jogador de linha mais perto de onde ela cai
    if (ehControlado(m, g)) {
      const a = m.voo?.alvo ?? b.p;
      let mel = null, dm = Infinity;
      for (const o of m.jogadores) {
        if (o.time !== g.time || o.posicao === 'GOL') continue;
        const d = MD.hypot(o.x - a.x, o.z - a.z);
        if (d < dm) { dm = d; mel = o; }
      }
      if (mel) { assumirControle(m, g.time, mel); m.eventos.push({ tipo: 'troca', id: mel.id, auto: true }); }
    }
  }
}

/** ENFIADA com a bola nas mãos (partida): a bola no chão, no pé dele, e ele sai jogando (o "Drop Ball" do EA FC). */
function soltarNoChao(m, g) {
  soltarDaMao(m, g);
  const b = m.bola;
  b.p.x = g.x + MD.cos(g.rumo) * CONDUCAO.ofsFrente.curta; b.p.z = g.z + MD.sin(g.rumo) * CONDUCAO.ofsFrente.curta;
  bolaAquemDaLinha(m, g, b);
  b.v.x = 0; b.v.y = 0; b.v.z = 0; b.w.x = 0; b.w.y = 0; b.w.z = 0; b.rolando = true;
  m.posse = g.id;
  g.pedido = null; g.carga = null; g.miraAuto = null;
  const c = g.cond;
  if (c) { c.toque = null; c.ref = null; c.busca = false; c.longeDesde = -1; }
  estadoMao(m).soltou = g.id;
  m.eventos.push({ tipo: 'soltou', id: g.id });
}

/**
 * Partida: a bola que sai das mãos do goleiro (reposição, ENFIADA) nunca fica além da linha do próprio gol — no máximo a
 * GOLEIRO.soltaLinha m dela, do lado do campo. Com o humano andando com a bola nas mãos ele pode ficar de frente para o
 * gol: colado na linha (encaixe em cima dela), a bola caía dentro do gol (gol contra na hora — contraprova).
 */
function bolaAquemDaLinha(m, g, b) {
  const gx = linhaDoGol(m, g), s = gx > 0 ? 1 : -1;
  if ((gx - b.p.x) * s < GOLEIRO.soltaLinha) b.p.x = gx - s * GOLEIRO.soltaLinha;
}

/** Defesa automática do goleiro em andamento (chute lido, mergulho/salto/defesa em pé desenhados). */
function defesaDoGoleiro(m, j) {
  const d = j.defesa;
  return (d && !d.fora && d.sucesso !== undefined && m.tick < d.tick + 6) || mergulhoAtivo(j, m.tick + 1);
}

/**
 * O goleiro anda pela locomoção de jogador de linha neste tick (e não pela IA do goleiro, movimentoGoleiro)?
 * Treino: só o controlado com a bola no pé (como antes). Partida (a defesa automática — chute lido, mergulho — vem antes):
 * com a bola no pé; indo com o pé à bola que não pode pegar (goleiroNoPe); e o do humano sem a bola, com o analógico
 * mexido (pedido do dono, 11/10: "eu não consigo mexer com o goleiro"; o analógico solto devolve a posição à IA).
 */
function goleiroComoLinha(m, j) {
  if (ehControlado(m, j) && m.naMao !== j.id && m.posse === j.id) return true;
  if (!m.partida || m.naMao === j.id || defesaDoGoleiro(m, j)) return false;
  if (ehControlado(m, j) && !m.iaJoga?.[j.time]) return m.posse === j.id || j.imag > 0 || goleiroNoPe(m, j);
  return goleiroNoPe(m, j);
}

/**
 * Goleiro do humano com a bola nas mãos (partida): anda pelo analógico (até GOLEIRO.maoAnda.v m/s; com CORRER, vCorrer)
 * e a parede da área (regras-goleiro.js paredeAreaMao) o segura antes da linha — ele nunca sai da área com a bola na mão.
 */
function andarComBolaNaMao(m, j) {
  const A = GOLEIRO.maoAnda;
  const mv = movimentoBase(j, j.ix, j.iz, j.imag, j.botoes, false, j.rumo, null);
  mv.vel = Math.min(mv.vel, (j.botoes & BOTAO.CORRER) ? A.vCorrer : A.v);
  const out = paredeAreaMao(m, j, mv);
  // colado na linha do gol (encaixe em cima dela) ele não vira para o gol com a bola nas mãos: a bola, GOLEIRO.bolaMao.frente
  // m à frente do corpo, passaria a linha — gol contra só por virar (contraprova). O rumo pedido fica no arco em que a
  // mão fica a ≥ GOLEIRO.soltaLinha m aquém da linha
  const gx = linhaDoGol(m, j), s = gx > 0 ? 1 : -1, u = (gx - j.x) * s;
  const k = (u - GOLEIRO.soltaLinha) / GOLEIRO.bolaMao.frente; // máximo de cos(rumo)·s (a componente para o gol)
  if (k < 1 && MD.cos(out.rumoAlvo) * s > k) {
    const kk = Math.max(-1, k), sz = MD.sin(out.rumoAlvo) >= 0 ? 1 : -1;
    return { ...out, rumoAlvo: MD.atan2(sz * Math.sqrt(1 - kk * kk), s * kk) };
  }
  return out;
}

/**
 * PEGAR (partida; borda do botão, goleiro do humano com a bola no pé ou solta e devagar — até GOLEIRO.pegaVMax m/s —
 * ao alcance — GOLEIRO.pegaPe m —, na área):
 * com a mão permitida, a bola vai para as mãos ("pegou"); com o recuo, o lateral de companheiro ou a bola que ele soltou,
 * é a infração da Regra 12.2 — tiro livre INDIRETO do adversário (partida.js, m.infracaoMao). Fora da área não faz nada
 * (a mão lá é a de qualquer jogador).
 */
function pegarDoHumano(m) {
  for (const t of m.humanos) {
    const g = jogadorPorId(m, m.controlado[t]);
    if (!g || g.posicao !== 'GOL' || m.naMao != null || (m.parada && !m.parada.rolou)) continue;
    if (!((g.botoes & BOTAO.PEGAR) && !(g.botoesAnt & BOTAO.PEGAR))) continue;
    if (m.posse != null && m.posse !== g.id) continue;
    const b = m.bola;
    if (b.p.y > 1.2 || MD.hypot(b.p.x - g.x, b.p.z - g.z) > GOLEIRO.pegaPe) continue;
    // a bola rápida que passa (chute, passe) não: só a do pé ou a solta e devagar (a defesa é a automática)
    if (m.posse !== g.id && MD.hypot(b.v.x, b.v.y, b.v.z) > GOLEIRO.pegaVMax) continue;
    if (!naPropriaArea(m, g, b.p.x, b.p.z)) continue;
    if (maoPermitida(m, g, b.p.x, b.p.z)) {
      m.naMao = g.id; m.posse = g.id; g.segura = { desde: m.tick };
      b.v.x = 0; b.v.y = 0; b.v.z = 0; m.voo = null;
      if (g.cond) { g.cond.toque = null; g.cond.busca = false; }
      m.eventos.push({ tipo: 'defesa', id: g.id, modo: 'pegou' });
      registrarToque(m, g, 'defesa');
      continue;
    }
    // mão onde não podia: o árbitro apita na hora (a bola no ponto do toque)
    m.infracaoMao = { id: g.id, x: b.p.x, z: b.p.z, motivo: motivoSemMao(m, g, b.p.x, b.p.z) ?? 'recuo' };
    m.eventos.push({ tipo: 'maoGoleiro', id: g.id, motivo: m.infracaoMao.motivo });
  }
}

/** Gol: a bola passou inteira da linha entre as traves e por baixo do travessão. */
function verificarGol(m) {
  const b = m.bola;
  if (m.golTick != null) return;
  const R = 0.11;
  if (Math.abs(b.p.x) < CAMPO.meioX + R) return;
  // atrás do véu não é gol (a bola que escorrega por trás da rede fica lá)
  if (Math.abs(b.p.x) - CAMPO.meioX > profundidadeVeu(b.p.y < 0 ? 0 : b.p.y)) return;
  if (Math.abs(b.p.z) >= CAMPO.gol.largura / 2 || b.p.y >= CAMPO.gol.altura) return;
  const ladoGol = b.p.x > 0 ? 1 : -1;
  // marca quem ataca esse lado
  let time = 0;
  for (const t of Object.keys(m.ataca)) if (m.ataca[t] === ladoGol) time = +t;
  m.placar[time] = (m.placar[time] ?? 0) + 1;
  m.golTick = m.tick;
  m.stats.gols++;
  m.eventos.push({ tipo: 'gol', time, autor: m.ultimoToque?.id ?? null });
}

/** TROCAR (borda do botão): passa o controle para quem chega antes no caminho do condutor. */
function trocarJogador(m, entradas) {
  for (const t of m.humanos) {
    const melhor = candidatoTroca(m, t);
    m.proximaTroca[t] = melhor ? melhor.id : null;
    const j = jogadorPorId(m, m.controlado[t]);
    if (!j) continue;
    // a borda do botão é do TIME (não do jogador): segurar TROCAR troca uma vez só
    const agora = m.botoesTimeAgora[t] ?? 0, antes = m.botoesTimeAnt[t] ?? 0;
    const apertou = (agora & BOTAO.TROCAR) && !(antes & BOTAO.TROCAR);
    // partida: TROCAR segurado GOLEIRO.trocarGoleiro s leva o controle ao goleiro (o "Switch to Goalkeeper" do EA FC;
    // pedido do dono, 11/10: "eu não consigo mexer com o goleiro") — o toque curto continua trocando como antes
    if (m.partida) {
      const st = (m.trocarDesde ??= {});
      if (apertou) st[t] = m.tick;
      else if (!(agora & BOTAO.TROCAR)) st[t] = -1;
      if (st[t] >= 0 && m.tick - st[t] === Math.round(GOLEIRO.trocarGoleiro / PASSO)) {
        const g = m.jogadores.find(o => o.time === t && o.posicao === 'GOL');
        if (g && m.controlado[t] !== g.id && !(m.posse === j.id && m.naMao !== j.id)) {
          assumirControle(m, t, g);
          m.eventos.push({ tipo: 'troca', id: g.id, goleiro: true });
          continue;
        }
      }
    }
    // com a bola no pé o TROCAR não tira o controle de quem conduz; com a bola nas mãos do
    // goleiro, TROCAR passa o controle para um jogador de linha e a IA repõe
    const comBola = m.posse === j.id && m.naMao !== j.id;
    if (apertou && !comBola && melhor && melhor.id !== j.id) {
      assumirControle(m, t, melhor);
      m.eventos.push({ tipo: 'troca', id: melhor.id });
    }
  }
}

/** Melhor candidato à troca: quem chega antes num ponto entre a bola e o meu gol. */
export function candidatoTroca(m, t) {
  const b = m.bola;
  const lado = ataca(m, t);
  const meuGol = -lado * CAMPO.meioX;
  const gx = meuGol - b.p.x, gz = -b.p.z;
  const g = MD.hypot(gx, gz) || 1;
  const px = b.p.x + (gx / g) * 2.5, pz = b.p.z + (gz / g) * 2.5;
  let mel = null, mt = Infinity;
  for (const o of m.jogadores) {
    if (o.time !== t || o.posicao === 'GOL' || o.id === m.controlado[t]) continue;
    const d = MD.hypot(o.x - px, o.z - pz);
    // chega antes = distância / velocidade de arrancada, com bônus para quem já corre para lá
    const v = Math.max(1, (o.vx * (px - o.x) + o.vz * (pz - o.z)) / Math.max(d, 1e-6));
    const tt = d / o.par.vArrancada - Math.min(0.4, v * 0.04);
    if (tt < mt) { mt = tt; mel = o; }
  }
  return mel;
}

// ---------------------------------------------------------------- determinismo

const _buf = new DataView(new ArrayBuffer(8));
/** Mistura um número (float64) no hash FNV-1a (usada também por escalacao.js e partida.js). */
export function misturarHash(h, x) {
  return misturar(h, x);
}
function misturar(h, x) {
  _buf.setFloat64(0, x);
  for (let i = 0; i < 8; i++) {
    h ^= _buf.getUint8(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/** Hash FNV-1a do estado relevante (bola, corpos, pés, posse, gerador). */
export function hashMundo(m) {
  let h = 2166136261 >>> 0;
  const b = m.bola;
  for (const v of [b.p.x, b.p.y, b.p.z, b.v.x, b.v.y, b.v.z, b.w.x, b.w.y, b.w.z, b.q.x, b.q.y, b.q.z, b.q.w]) h = misturar(h, v);
  for (const j of m.jogadores) {
    for (const v of [j.x, j.z, j.vx, j.vz, j.rumo, j.giro, j.fase, j.pes[0].x, j.pes[0].z, j.pes[1].x, j.pes[1].z]) h = misturar(h, v);
  }
  h = misturar(h, m.posse ?? -1);
  h = misturar(h, m.naMao ?? -1);
  for (const t of Object.keys(m.placar ?? {})) h = misturar(h, m.placar[t]);
  for (const t of Object.keys(m.controlado ?? {})) h = misturar(h, m.controlado[t]);
  h = misturar(h, m.tick);
  for (const s of m.rng.s) h = misturar(h, s);
  // Etapa 3: escalação, formação, tática, relógio e parada (só na partida: o hash do treino não muda)
  if (m.times) { h = misturarTimes(h, m); h = misturarPartida(h, m); }
  return h >>> 0;
}

/** Cópia profunda do mundo (replay, previsão, comparação). */
export function copiarMundo(m) {
  return structuredClone(m);
}
