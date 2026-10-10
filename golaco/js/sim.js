// Mundo da simulação: estado completo + passo fixo. Sem three.js nem DOM.
// O mundo é um objeto simples (copiável); a mesma semente e as mesmas entradas geram a
// mesma partida bit a bit (ver hashMundo).

import { PASSO, ENTRADA, BOTAO, CONDUCAO, JOGADOR, TREINO, CAMPO, GOLEIRO } from './config.js';
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
import { lerChute, aplicarDefesa, movimentoGoleiro, bolaNaMao, soltarDaMao, linhaDoGol } from './goleiro.js';
import { entradaIA } from './ia.js';
import { ACOES } from './config.js';

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
    }
    j.intRumo = r;
    j.ix = x / mag; j.iz = z / mag;
  } else {
    j.intW *= MD.exp(-PASSO / 0.1);
  }
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
  const dono = jogadorPorId(m, m.posse);
  if (!dono || dono.time === j.time) return;
  const b = m.bola, cfg = ACOES.boteIA;
  if (b.p.y > 0.5) return;
  const dB = MD.hypot(b.p.x - j.x, b.p.z - j.z);
  if (dB > cfg.alcance) return;
  const dD = MD.hypot(b.p.x - dono.x, b.p.z - dono.z);
  if (dD < 0.35 || dB > dD) return; // colada no pé de quem conduz: não alcança
  if (uniforme(m.rng) >= cfg.chancePorPasso) return;
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
  }
  // 1) entradas: humano (o controlado de cada time humano) e IA (entrada virtual)
  for (const j of js) {
    if (j.papel === 'marcador' || j.papel === 'parado') continue;
    const e = m.humanos.includes(j.time) ? entradas?.[j.time] : null;
    j.botoesTime = e ? (e.botoes | 0) : 0;
    if (ehControlado(m, j)) {
      // recebendo um passe com o analógico solto: a assistência leva ao encontro da bola
      const assist = j.recebe && m.posse !== j.id && !(e && MD.hypot(e.x ?? 0, e.z ?? 0) > 0.25);
      if (assist) {
        const ia = entradaIA(m, j);
        aplicarEntrada(j, { ...ia, botoes: (e?.botoes ?? 0) | (ia.botoes & BOTAO.CORRER) }, m.tick);
      } else aplicarEntrada(j, e, m.tick);
    } else if (j.posicao === 'GOL') {
      aplicarEntrada(j, null, m.tick);
    } else {
      aplicarEntrada(j, entradaIA(m, j), m.tick);
    }
    atualizarBotoesAcao(m, j);
  }
  trocarJogador(m, entradas);
  // 2) movimento de cada corpo
  for (const j of js) {
    let mv;
    if (j.papel === 'marcador') {
      if (j.descanso > 0) { j.descanso--; mv = { dx: MD.cos(j.rumo), dz: MD.sin(j.rumo), vel: 0, rumoAlvo: j.rumo }; }
      else mv = moverMarcador(m, j);
    } else if (j.papel === 'parado') {
      mv = { dx: 1, dz: 0, vel: 0, rumoAlvo: j.rumo };
    } else if (j.posicao === 'GOL' && !(ehControlado(m, j) && m.naMao !== j.id && m.posse === j.id)) {
      mv = movimentoGoleiro(m, j, m.humanos.includes(j.time));
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
    }
    passoCorpo(j, mv.dx, mv.dz, mv.vel, mv.rumoAlvo, j.par, PASSO, m.posse === j.id);
  }
  colisaoCorpos(m);
  // a passada depois da trombada: o pé que sai do chão mira o pouso pela velocidade que o corpo
  // tem DEPOIS do contato (antes mirava pela de antes e o pé caía longe do corpo)
  for (const j of js) {
    const ped = j.cond && j.cond.pedalada ? pesDaPedalada(m, j) : null;
    if (!(j.cond && j.cond.pedalada) && j.travaApoio != null) j.travaApoio = null;
    passoPassada(j, m.posse === j.id, PASSO, null, ped || saidaParaToque(m, j));
  }
  // 3) ações e controle de bola
  for (const j of js) if (j.pedido) processarPedido(m, j);
  if (m.naMao != null) {
    const g = jogadorPorId(m, m.naMao);
    if (g) goleiroComBola(m, g);
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
    else if (j.papel === 'ia' && j.posicao !== 'GOL' && !ehControlado(m, j)) boteIA(m, j);
  }
  // 4) goleiros leem o chute e defendem
  for (const j of js) {
    if (j.posicao !== 'GOL') continue;
    lerChute(m, j);
    aplicarDefesa(m, j);
  }
  // 5) bola
  if (m.naMao != null) {
    const g = jogadorPorId(m, m.naMao);
    if (g) bolaNaMao(m, g);
  } else {
    passoBola(m.bola, m.eventos);
    colisaoBolaCorpo(m);
  }
  verificarGol(m);
  // 6) posse
  if (m.posse != null && m.naMao == null) {
    const dono = jogadorPorId(m, m.posse);
    if (dono) verificarPerda(m, dono);
  }
  if (m.voo && m.posse != null) m.voo = null;
  // 7) gesto do toque (só visual: o pé desenhado indo até a bola, com velocidade limitada)
  for (const j of js) if (j.cond) atualizarGesto(m, j);
  // 8) pé desenhado no balanço (trajetória + gesto, com a velocidade de um pé humano) e altura
  // do quadril da pose (sobe com velocidade limitada: anim.js alturaQuadril)
  for (const j of js) passoPeDesenhado(j, m, PASSO);
  m.tick++;
  for (const j of js) j.quadril = alturaQuadril(j, m);
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

/** Bola livre: quem vai recebê-la? Recebedor marcado primeiro; depois, os mais perto. */
function bolaLivre(m) {
  const b = m.bola;
  const cands = m.jogadores.filter(j => j.papel !== 'marcador' && j.papel !== 'parado' && j.posicao !== 'GOL');
  const alvo = m.voo && m.voo.para != null ? m.voo.para : null;
  cands.sort((a, c) => (a.id === alvo ? -1 : 0) - (c.id === alvo ? -1 : 0) || MD.hypot(a.x - b.p.x, a.z - b.p.z) - MD.hypot(c.x - b.p.x, c.z - b.p.z));
  const passou = m.voo && m.voo.de != null && m.tick - (m.voo.tick0 ?? 0) < 6 ? m.voo.de : null;
  for (const j of cands) {
    if (j.id === passou) continue; // quem acabou de bater não domina a própria bola
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
    const gx = linhaDoGol(m, g);
    const naArea = Math.abs(b.p.x - gx) < 16.5 && Math.abs(b.p.z) < 20.16;
    if (naArea && MD.hypot(b.p.x - g.x, b.p.z - g.z) < 1.0 && b.p.y < 2.2 && MD.hypot(b.v.x, b.v.z) < 9) {
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
    ganhouPosse(m, j);
    return true;
  }
  const r = bolaAltaPassando(m, j, 60);
  if (!r) return false;
  const alcanceY = ACOES.cabeceio.alcanceSalto * (0.92 + 0.12 * j.par.attr.impulsao / 100);
  if (r.y > alcanceY || r.y < 0.2) return false;
  c.toque = { tick: m.tick + r.i, pe: j.par.attr.pePreferido, bx: r.x, bz: r.z, tipo: 'aereo', y: r.y };
  return true;
}

/** O jogador ganhou a posse: o controle humano vai para ele (time humano). */
function ganhouPosse(m, j) {
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

/** Goleiro com a bola nas mãos: segura e repõe (humano: PASSE/LANÇAMENTO; IA: depois de 1,5 s). */
function goleiroComBola(m, g) {
  const humano = ehControlado(m, g);
  // IA: repõe depois de 1,5 s. Humano: se não apertar botão de ação (nem estiver carregando um),
  // a IA repõe por ele depois de GOLEIRO.esperaHumano — antes o goleiro ficava com a bola para
  // sempre (o analógico não o move, TROCAR é bloqueado com a bola na mão): "trava"
  const espera = Math.round((humano ? GOLEIRO.esperaHumano : GOLEIRO.esperaIA) / PASSO);
  if (!g.pedido && !g.carga && m.tick - (g.segura?.desde ?? m.tick) > espera) {
    // lança para o companheiro mais adiantado ou na direção do analógico/do corpo
    g.pedido = { tipo: 'lancamento', forca: 0.7, mod: false, tick: m.tick };
  }
  if (g.pedido && m.tick - (g.segura?.desde ?? m.tick) > 20) {
    soltarDaMao(m, g);
    const b = m.bola;
    b.p.x = g.x + MD.cos(g.rumo) * 0.45; b.p.z = g.z + MD.sin(g.rumo) * 0.45;
    executarAcao(m, g, g.par.attr.pePreferido, false);
    // sem recebedor (bola no espaço), o humano não fica controlando o goleiro sem a bola (o
    // analógico não o move): o controle vai para o jogador de linha mais perto de onde ela cai
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

/** Gol: a bola passou inteira da linha entre as traves e por baixo do travessão. */
function verificarGol(m) {
  const b = m.bola;
  if (m.golTick != null) return;
  const R = 0.11;
  if (Math.abs(b.p.x) < CAMPO.meioX + R) return;
  // atrás da rede de fundo não é gol (a bola que roda por trás do gol fica lá)
  if (Math.abs(b.p.x) > CAMPO.meioX + CAMPO.gol.profundidade) return;
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
  return h >>> 0;
}

/** Cópia profunda do mundo (replay, previsão, comparação). */
export function copiarMundo(m) {
  return structuredClone(m);
}
