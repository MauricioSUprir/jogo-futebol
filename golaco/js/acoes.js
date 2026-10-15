// Ações com bola (Etapa 2): passe rasteiro, enfiada (bola no espaço), enfiada alta, lançamento,
// cruzamento (alto, tenso, rasteiro), chute (força, colocado, cavadinha) e cabeceio. Puro: sem
// three.js nem DOM; aleatoriedade só pelo gerador do mundo; matemática pelo MD (determinística).
//
// Fluxo: apertar um botão começa a carregar a força (j.carga); soltar cria o pedido (j.pedido).
// Com a bola, a ação sai no próximo toque possível (toque marcado com tipo 'acao', o pé de apoio
// no chão); com a bola chegando, sai de primeira no tick do domínio.

import { ACOES, BOTAO, CAMPO, PASSO, JOGADOR, GOLEIRO, LATERAL, AEREO, RECEPCAO, CABECEIO } from './config.js';
import { MD } from './matdet.js';
import { clamp, lerp, difAng } from './mat.js';
import { normal } from './rng.js';
import {
  chutarRasteiro, chutar, velParaChegarCom, velParaDistancia, velRolandoApos, velParaPousar, elevacaoParaAltura,
  alturaNaDistancia, simularVoo,
} from './bola.js';
import { procurarOportunidade, preverBola } from './conducao.js';
import { passoCorpo, copiaCinematica, infoPassada } from './jogador.js';
import { registrarChute } from './regras-goleiro.js';

const DT = PASSO;
const BOTOES_ACAO = [
  [BOTAO.PASSE, 'passe'], [BOTAO.ENFIADA, 'enfiada'], [BOTAO.LANCAMENTO, 'lancamento'], [BOTAO.CHUTE, 'chute'],
];

/**
 * O humano do time passa a controlar `novo`. O que o humano já estava fazendo vai junto: a carga
 * de um botão segurado e o pedido ainda não executado (ex.: CHUTE apertado enquanto o passe ia,
 * para bater de primeira). Os botões segurados contam como já apertados no novo jogador (não viram
 * carga nem troca falsa), e a ação virtual que a IA segurava nele é descartada.
 * Trava "só o meu jogador" (m.trava = {time: id}; o Rumo ao Estrelato do Total Match, partida.js criarPartida): o controle
 * nunca sai do travado — a troca para outro é recusada (devolve false; sem m.trava, sempre true, como antes).
 */
export function assumirControle(m, time, novo) {
  const trava = m.trava?.[time];
  if (trava != null && novo.id !== trava) return false;
  const antigo = m.jogadores.find(o => o.id === m.controlado[time]);
  m.controlado[time] = novo.id;
  const mask = m.botoesTimeAgora?.[time] ?? 0;
  novo.botoes = mask; novo.botoesAnt = mask;
  novo.iaAcao = null; novo.carga = null;
  if (antigo && antigo !== novo) {
    if (antigo.carga) { novo.carga = antigo.carga; antigo.carga = null; }
    if (antigo.pedido && m.posse !== antigo.id) { novo.pedido = antigo.pedido; antigo.pedido = null; }
    if (antigo.mira) { novo.mira = antigo.mira; antigo.mira = null; }
  }
  return true;
}

/** Lado do gol que o time ataca (+1 ataca x = +52,5). */
export function ataca(m, time) {
  return m.ataca ? m.ataca[time] : (time === 0 ? 1 : -1);
}

// ------------------------------------------------------------------ botões → carga e pedido

/**
 * Os botões de j são os do humano? (o controlado do time, com a entrada vinda da pessoa — j.porHumano, marcado pelo
 * sim.js/partida.js; a demo e a IA jogando pelo humano mandam a entrada com `ia: true` e contam como IA)
 */
function botoesDoHumano(m, j) {
  return !!j.porHumano && !!m.humanos && m.humanos.includes(j.time) && !!m.controlado && m.controlado[j.time] === j.id;
}

/**
 * O botão b foi apertado AGORA pela pessoa (o time não o segurava no passo anterior)? A borda do jogador também
 * aparece quando o controle troca com o botão segurado (o novo controlado não o via apertado) — isso não é um toque
 * rápido, é o mesmo aperto de antes. sim.js: botoesTimeAgora = este passo, botoesTimeAnt = o anterior; o `cobrar` da
 * bola parada (o cobrador 'parado') roda ANTES do passo, com o anterior ainda em botoesTimeAgora.
 */
function apertoNovoDoTime(m, j, b) {
  const ant = j.papel === 'parado' ? m.botoesTimeAgora?.[j.time] : m.botoesTimeAnt?.[j.time];
  return !((ant ?? 0) & b);
}

/**
 * Cavadinha por dois toques no CHUTE (pedido do dono, 12/10): o 2º aperto vale enquanto o chute do 1º ainda não
 * tocou na bola (o pedido está de pé) e chega até ACOES.toqueDuplo s depois de soltar o 1º. Só o humano (a IA não
 * aperta duas vezes; a cavadinha dela continua a automática, com o goleiro adiantado).
 */
function cavadinhaPorDoisToques(m, j) {
  const p = j.pedido;
  return !!p && p.tipo === 'chute' && !!p.humano && !p.cavadinha && m.naMao !== j.id
    && (m.tick - p.tick) * DT <= ACOES.toqueDuplo;
}

/**
 * Atualiza carga/pedido pelas bordas dos botões de ação (chamar depois de aplicarEntrada).
 * Vale para o humano e para a IA (que aperta botões virtuais).
 */
export function atualizarBotoesAcao(m, j) {
  const agora = j.botoes, antes = j.botoesAnt;
  for (const [b, tipo] of BOTOES_ACAO) {
    const apertou = (agora & b) && !(antes & b);
    const soltou = !(agora & b) && (antes & b);
    if (apertou) {
      if (tipo === 'chute' && cavadinhaPorDoisToques(m, j)) {
        // 2º toque: o chute vira cavadinha. A mira do 1º fica; o pedido espera este botão ser solto (a força da
        // cavadinha é a do 2º toque) — o toque da ação já marcado é desfeito e volta a ser marcado no soltar
        j.pedido.cavadinha = true;
        j.pedido.segura = true;
        if (j.cond && j.cond.toque && j.cond.toque.tipo === 'acao') j.cond.toque = null;
        j.carga = { tipo, t0: m.tick, mod: false, cavadinha: true, humano: true };
      } else {
        j.carga = { tipo, t0: m.tick, mod: (agora & BOTAO.MOD) !== 0 };
        if (botoesDoHumano(m, j)) {
          j.carga.humano = true;
          // só o aperto novo pode ser o 1º de dois toques (o segurado que veio na troca de controle chuta na hora)
          if (apertoNovoDoTime(m, j, b)) j.carga.novo = true;
        }
        j.mira = null;
      }
    } else if (soltou && j.carga && j.carga.tipo === tipo) {
      soltarCarga(m, j);
    }
  }
  // guarda a mira enquanto carrega ou espera o toque
  if ((j.carga || j.pedido) && j.imag > 0.2) j.mira = { x: j.ix, z: j.iz, mag: j.imag };
  if (j.carga && (m.tick - j.carga.t0) * DT >= ACOES.cargaMax) soltarCarga(m, j);
  // (a cavadinha com o 2º toque ainda segurado não expira: a idade conta de novo quando ele é solto)
  if (j.pedido && !j.pedido.segura) {
    const idade = (m.tick - j.pedido.tick) * DT;
    const esperandoBola = j.cond && j.cond.toque && (j.cond.toque.tipo === 'dominio' || j.cond.toque.tipo === 'aereo');
    // o humano com um passe vindo para ele (j.recebe): o pedido de primeira vale enquanto o passe para ele está a caminho
    // (o rasteiro não tem hora de chegada marcada) ou até a hora de chegada (+ ACOES.primeiraFolga s) — no passe longo
    // (24–30 m) a bola chegava depois dos 1,6 s e ele só dominava (auditoria dos botões, 12/10)
    const ateChegar = !!j.recebe && ehHumano(m, j) && m.posse == null
      && ((!!m.voo && m.voo.para === j.id) || (j.recebe.chega > 0 && m.tick <= j.recebe.chega + Math.round(ACOES.primeiraFolga / DT)));
    if (idade > (esperandoBola || bolaVindo(m, j) ? ACOES.pedidoPrimeira : ACOES.pedidoValidade) && m.posse !== j.id && !ateChegar) j.pedido = null;
    else if (idade > ACOES.pedidoValidade * 2 && m.posse === j.id && !(j.cond.toque && j.cond.toque.tipo === 'acao')) j.pedido = null;
  }
}

/**
 * j é o controlado de um time humano, com o humano jogando? (A IA jogando pelo humano — a demo, entrada com `ia`, como
 * no painel de equilíbrio — não: ela não espera o 2º toque nem precisa da primeira estendida, e a partida IA × IA fica
 * a mesma para os dois times.)
 */
function ehHumano(m, j) {
  return !!m.humanos && m.humanos.includes(j.time) && m.controlado?.[j.time] === j.id && !m.iaJoga?.[j.time];
}

/** j, com a bola, está onde o LANÇAMENTO vira cruzamento (ponta no último terço: lancamentoOuCruzamento)? */
function naZonaDeCruzamento(m, j) {
  const cc = ACOES.cruzamento;
  return (j.x * ataca(m, j.time)) > cc.terco && Math.abs(j.z) > cc.faixa;
}

function soltarCarga(m, j) {
  const c = j.carga;
  const forca = clamp((m.tick - c.t0) * DT / ACOES.cargaCheia, 0.08, 1);
  const mod = c.mod || (j.botoes & BOTAO.MOD) !== 0;
  if (c.cavadinha) {
    // 2º toque da cavadinha solto: a força dele vale (mais tempo = mais alta) e o pedido volta a valer daqui. Se o
    // chute já saiu enquanto ele segurava (de primeira, com a bola chegando), não sobra pedido nenhum
    const p = j.pedido;
    if (p && p.cavadinha && p.segura) { p.forca = forca; p.segura = false; p.espera = null; p.tick = m.tick; }
    j.carga = null;
    return;
  }
  // dois toques no lançamento = cruzamento rasteiro
  if (c.tipo === 'lancamento' && j.ultLanc != null && (m.tick - j.ultLanc) * DT < ACOES.toqueDuplo && j.pedido && j.pedido.tipo === 'lancamento') {
    j.pedido.rasteiro = true;
  } else {
    j.pedido = { tipo: c.tipo, forca, mod, tick: m.tick };
    if (c.humano) {
      j.pedido.humano = true;
      // chute de toque rápido do humano (aperto novo): pode ser o 1º de dois toques — o contato não sai antes de
      // ACOES.cavadinha.janela s (o 2º toque chega a tempo). O chute carregado sai na hora, como antes; o botão que
      // vinha segurado de antes da troca de controle também (carga sem `novo`)
      if (c.tipo === 'chute' && c.novo && (m.tick - c.t0) * DT < ACOES.cavadinha.toqueRapido) {
        j.pedido.espera = m.tick + Math.round(ACOES.cavadinha.janela / DT);
      }
    }
  }
  if (c.tipo === 'lancamento') j.ultLanc = m.tick;
  j.carga = null;
}

/** A bola (livre) está vindo para perto do jogador? (no ar: o voo passa por ele) */
function bolaVindo(m, j) {
  if (m.posse != null) return false;
  const b = m.bola;
  if (!b.rolando && b.p.y > 0.45 && bolaAltaPassando(m, j, 150)) return true;
  const dx = j.x - b.p.x, dz = j.z - b.p.z;
  const d = MD.hypot(dx, dz);
  const vb = MD.hypot(b.v.x, b.v.z);
  return vb > 1 && d < 25 && (b.v.x * dx + b.v.z * dz) / (vb * Math.max(d, 1e-6)) > 0.8;
}

// ------------------------------------------------------------------ pedido → toque marcado

/**
 * Com a bola: marca o toque da ação no primeiro momento possível (pé de apoio no chão, bola
 * no alcance). Chamar a cada tick para quem tem pedido e a posse.
 */
export function processarPedido(m, j) {
  if (!j.pedido || m.posse !== j.id) return;
  if (j.pedido.segura) return; // cavadinha: o 2º toque ainda segurado (sai quando ele é solto)
  // toque rápido do humano no CHUTE: o contato fica para depois da janela do 2º toque — até lá a condução segue, e o
  // toque da ação é marcado 2 ticks antes do fim dela (a previsão curta, a mesma do chute de agora: marcado longe, o
  // corpo previsto com o analógico do aperto errava o pé de apoio e a bola escapava). O cobrador da bola parada
  // (papel 'parado') chuta pela cobrança (partida.js cobrar), nunca pelo toque da condução
  const esp = j.pedido.espera;
  if (esp != null && (m.tick < esp - 2 || j.papel === 'parado')) return;
  const c = j.cond;
  if (c.toque && c.toque.tipo === 'acao') return;
  // LANÇAMENTO do humano na zona do cruzamento: espera a janela do 2º toque (ACOES.toqueDuplo, contada do soltar) antes de
  // marcar o toque — senão o 1º toque já cruzava alto e o 2º virava um pedido do recebedor (dois toques = rasteiro)
  const p0 = j.pedido;
  if (p0.tipo === 'lancamento' && !p0.rasteiro && ehHumano(m, j) && naZonaDeCruzamento(m, j)
    && (m.tick - p0.tick) * DT < ACOES.toqueDuplo) return;
  let op = procurarOportunidade(m, j, 2, 24, true, null, true);
  // perna boa: parado (os dois pés no chão) com a bola à frente, bate com ela; sem pressão,
  // ajeita o passo para bater com ela
  const pref = j.par.attr.pePreferido ?? 1;
  if (op && op.pe !== pref) {
    const la = -(op.bx - j.x) * MD.sin(j.rumo) + (op.bz - j.z) * MD.cos(j.rumo);
    const parado = MD.hypot(j.vx, j.vz) < 1 && j.pes[0].apoio && j.pes[1].apoio;
    if (parado && Math.abs(la) < 0.35) op = { ...op, pe: pref };
    else if (pressaoSobre(m, j) < 0.3) {
      // andando, a passada é mais lenta: espera até um passo a mais (~0,33 s); correndo, ~0,15 s
      const espera = MD.hypot(j.vx, j.vz) < 3 ? 20 : 9;
      const op2 = procurarOportunidade(m, j, op.i + 1, op.i + espera, true, null, true);
      if (op2 && op2.pe === pref) op = op2;
    }
  }
  if (op) c.toque = { tick: m.tick + op.i, pe: op.pe, bx: op.bx, bz: op.bz, tipo: 'acao' };
}

// ------------------------------------------------------------------ escolha do alvo

/**
 * Mira da ação: o analógico de agora ou, se ele já foi solto, o último segurado durante a carga
 * (quem solta o botão e o analógico juntos não perde a direção). {x, z, mag} ou null.
 */
function mira(j) {
  if (j.miraAuto) return { x: j.miraAuto.x, z: j.miraAuto.z, mag: 1 }; // reposição automática
  if (j.imag > 0.2) return { x: j.ix, z: j.iz, mag: j.imag };
  return j.mira ?? null;
}

function dirPedida(j) {
  const a = mira(j);
  if (a) return { x: a.x, z: a.z };
  return { x: MD.cos(j.rumo), z: MD.sin(j.rumo) };
}

/** Risco de um adversário cortar a linha de passe de (ax,az) a (bx,bz) com a bola a v. */
export function riscoLinha(m, j, ax, az, bx, bz, v) {
  let risco = 0;
  const dx = bx - ax, dz = bz - az;
  const L = MD.hypot(dx, dz) || 1;
  const ux = dx / L, uz = dz / L;
  for (const o of m.jogadores) {
    if (o.time === j.time) continue;
    const ox = o.x - ax, oz = o.z - az;
    const s = clamp(ox * ux + oz * uz, 0, L);
    const lat = Math.abs(-ox * uz + oz * ux);
    // tempo da bola até s × tempo do adversário até a linha (reação 0,25 s + corrida)
    const tBola = s / Math.max(v, 3);
    const tAdv = 0.25 + Math.max(0, lat - 0.9) / 6.5;
    if (tAdv < tBola + 0.15) risco = Math.max(risco, clamp((tBola + 0.15 - tAdv) / 0.6, 0, 1));
  }
  return risco;
}

/**
 * Companheiro alvo pelo analógico (cone), distância e risco da linha. Devolve o jogador ou null.
 * tipo: 'passe' | 'enfiada' | 'lancamento'
 */
export function escolherAlvo(m, j, tipo) {
  const cfg = ACOES[tipo];
  const d = dirPedida(j);
  const lado = ataca(m, j.time);
  let melhor = null, mScore = Infinity;
  for (let tent = 0; tent < 2 && !melhor; tent++) {
    const cone = cfg.cone * (tent === 0 ? 1 : 1.8);
    for (const o of m.jogadores) {
      if (o.time !== j.time || o.id === j.id) continue;
      if (o.posicao === 'GOL' && tipo !== 'passe') continue;
      // partida: a IA só recua para o goleiro rasteiro e seguro (ele não pode usar a mão: Regra 12.2) — livre e com a
      // bola que erra o goleiro passando longe do gol
      if (o.posicao === 'GOL' && m.partida && !(m.humanos.includes(j.time) && m.controlado[j.time] === j.id) && !recuoSeguro(m, j, o)) continue;
      const ox = o.x - j.x, oz = o.z - j.z;
      const L = MD.hypot(ox, oz);
      if (L < cfg.dMin || L > cfg.dMax) continue;
      const a = Math.abs(difAng(MD.atan2(d.z, d.x), MD.atan2(oz, ox)));
      if (a > cone) continue;
      // nota em "graus equivalentes": passe = ângulo + 0,3 × distância (Metrica: acerta o recebedor
      // real em 92,6% dos passes, contra ~86% de "o mais perto no cone")
      let score = a * (180 / Math.PI);
      if (tipo === 'passe') score += 0.3 * L;
      if (tipo === 'enfiada') score -= 31.5 * (clamp((o.x - j.x) * lado / 30, -0.3, 0.6) + clamp((o.vx * lado) / 8, 0, 0.4));
      if (tipo === 'lancamento') score += 31.5 * Math.abs(L - 35) / 60;
      const v = tipo === 'lancamento' ? 20 : 12;
      score += 38 * riscoLinha(m, j, j.x, j.z, o.x, o.z, v);
      if (score < mScore) { mScore = score; melhor = o; }
    }
  }
  return melhor;
}

/**
 * Recuo da IA para o goleiro g é seguro? Nenhum adversário a menos de GOLEIRO.recuoIA.livre m do goleiro nem da linha do
 * passe, e a reta do passe, passando do goleiro, cruza a linha do gol a ≥ recuoIA.foraGol m do meio (o passe que erra o
 * goleiro não vai para dentro do gol).
 */
function recuoSeguro(m, j, g) {
  const R = GOLEIRO.recuoIA;
  const dx = g.x - j.x, dz = g.z - j.z, L = MD.hypot(dx, dz) || 1;
  for (const o of m.jogadores) {
    if (o.time === j.time) continue;
    if (MD.hypot(o.x - g.x, o.z - g.z) < R.livre) return false;
    const ox = o.x - j.x, oz = o.z - j.z, s = clamp((ox * dx + oz * dz) / L, 0, L);
    if (Math.abs(-ox * dz + oz * dx) / L < R.livre * 0.5 && s > 0 && s < L) return false;
  }
  const gx = -ataca(m, g.time) * CAMPO.meioX;
  if (Math.abs(dx) < 1e-6) return true;
  const t = (gx - j.x) / dx;
  if (t <= 0) return true;
  return Math.abs(j.z + dz * t) >= R.foraGol;
}

// ------------------------------------------------------------------ utilidades

function pressaoSobre(m, j) {
  let dm = Infinity;
  for (const o of m.jogadores) {
    if (o.time === j.time) continue;
    const d = MD.hypot(o.x - j.x, o.z - j.z);
    if (d < dm) dm = d;
  }
  return clamp((ACOES.pressaoDist - dm) / ACOES.pressaoDist, 0, 1);
}

/**
 * Perna ruim: mais dispersão e menos velocidade. Pesquisa da Etapa 2: erro +40% (Carlsson 2018)
 * e velocidade a 84% (Nunome 2006) em jogadores bons de perna ruim mediana.
 */
function multPeFraco(j, pe) {
  const a = j.par.attr;
  if (pe === a.pePreferido) return 1;
  return lerp(1.8, 1.1, (a.peFraco ?? 50) / 100);
}

function velPeFraco(j, pe) {
  const a = j.par.attr;
  if (pe === a.pePreferido) return 1;
  return lerp(0.78, 0.95, (a.peFraco ?? 50) / 100);
}

/** Tempo (ticks) para o jogador chegar correndo a (px,pz), pela mesma locomoção do jogo. */
export function ticksAteChegar(j, px, pz, max = 360) {
  const k = copiaCinematica(j);
  const vel = j.par.vArrancada;
  for (let i = 1; i <= max; i++) {
    const dx = px - k.x, dz = pz - k.z;
    const d = MD.hypot(dx, dz);
    if (d < 0.6) return i;
    passoCorpo(k, dx / d, dz / d, vel, MD.atan2(dz, dx), j.par, DT, false);
  }
  return max;
}

function dentroDoCampo(x, z, margem = 1) {
  return {
    x: clamp(x, -CAMPO.meioX + margem, CAMPO.meioX - margem),
    z: clamp(z, -CAMPO.meioZ + margem, CAMPO.meioZ - margem),
  };
}

function girar(ux, uz, a) {
  const c = MD.cos(a), s = MD.sin(a);
  return { x: ux * c - uz * s, z: ux * s + uz * c };
}

function finalizarChute(m, j, pe, tipo, v, w, alvo, para, extra = {}) {
  const b = m.bola;
  chutar(b, v, w);
  // a batida para baixo (ou reta) só vira bola ROLANDO com a bola no chão ou na altura do pé: no ar ela sai voando de onde
  // está (antes o cabeceio a gol, com elevação negativa, aparecia no chão aos pés de quem cabeceou no mesmo quadro — o
  // "teleporte" da contraprova de 11/10: 200 de 200 cabeceios a gol)
  if (v.y <= 0.01 && (b.rolando || b.p.y <= RECEPCAO.alturaPe)) chutarRasteiro(b, v.x, v.z);
  const c = j.cond;
  const sv = MD.hypot(v.x, v.z) || 1;
  c.ult = { tick: m.tick, pe, bx: b.p.x, bz: b.p.z, dx: v.x / sv, dz: v.z / sv, v: MD.hypot(v.x, v.y, v.z), tipo };
  c.toque = null; c.busca = false; c.longeDesde = -1;
  m.posse = null;
  m.ultimoToque = { id: j.id, time: j.time, tick: m.tick };
  registrarChute(m, j, tipo); // regra da mão do goleiro (partida): chute/passe de um companheiro = recuo
  m.voo = { tipo, de: j.id, time: j.time, para: para ? para.id : null, alvo: { x: alvo.x, z: alvo.z }, tick0: m.tick, tickChave: m.tick, tickChegada: m.tick + (extra.ticks ?? 0), alto: v.y > 1.5, ...extra.voo };
  const ev = tipo === 'chute' || tipo === 'colocado' || tipo === 'cavadinha' ? 'chute' : 'passe';
  m.eventos.push({ tipo: ev, id: j.id, modo: tipo, v: MD.hypot(v.x, v.y, v.z), para: para ? para.id : null });
  if (m.stats) { m.stats[ev === 'chute' ? 'chutes' : 'passes'] = (m.stats[ev === 'chute' ? 'chutes' : 'passes'] ?? 0) + 1; }
  if (m.log) m.log.push({ t: m.tick, id: j.id, pe, tipo, bx: b.p.x, bz: b.p.z, dx: v.x / sv, dz: v.z / sv, v: MD.hypot(v.x, v.y, v.z), alvoX: alvo.x, alvoZ: alvo.z, para: para ? para.id : null, rx: para ? para.x : null, rz: para ? para.z : null, acao: true });
}

/** Marca o recebedor: ele vem ao encontro (passe) ou arranca para o ponto (enfiada, lançamento). */
function marcarRecebedor(m, r, x, z, tipo, tick) {
  if (!r) return;
  r.recebe = { tick: m.tick, x, z, tipo, chega: tick };
  // recuo para o goleiro: o controle só vai para ele quando pegar a bola (no caminho o analógico não
  // move o goleiro — o jogador ficava com o controle "morto" durante o passe)
  if (r.posicao === 'GOL') return;
  if (m.humanos && m.humanos.includes(r.time) && m.controlado) {
    // o controle passa para quem vai receber (como nos jogos de futebol atuais)
    if (m.controlado[r.time] !== r.id && assumirControle(m, r.time, r)) m.eventos.push({ tipo: 'troca', id: r.id, auto: true });
  }
}

// ------------------------------------------------------------------ execução

/**
 * Executa a ação pedida agora (tick do toque, antes de integrar a bola). pe = pé que bate.
 * primeira = de primeira (bola chegando, sem domínio).
 */
export function executarAcao(m, j, pe, primeira = false) {
  const p = j.pedido;
  j.pedido = null;
  if (!p) return false;
  if (p.segura) {
    // cavadinha de primeira com o 2º toque ainda segurado: a força é a carregada até aqui
    if (j.carga && j.carga.cavadinha) { p.forca = clamp((m.tick - j.carga.t0) * DT / ACOES.cargaCheia, 0.08, 1); j.carga = null; }
    p.segura = false;
  }
  j.miraAuto = p.dir ?? null; // reposição automática do goleiro: direção fixa, sem o analógico
  const b = m.bola;
  // de cabeça só com a bola acima de CABECEIO.alturaPedido (abaixo: o voleio/passe de primeira com o pé, da altura dela)
  if (b.p.y > CABECEIO.alturaPedido) return executarCabeceio(m, j, p);
  if (p.tipo === 'chute') {
    // no chute a pressão só pesa de perto (< 12 m) e pouco; de primeira, ×1,15 (StatsBomb)
    const lado = ataca(m, j.time);
    const perto = MD.hypot(lado * CAMPO.meioX - b.p.x, b.p.z) < 12;
    // (a Panenka — cavadinha pedida no pênalti — tem o erro próprio, ACOES.cavadinha.penalti, sem a pressão do pênalti)
    const em = (primeira ? ACOES.chute.primeiraErro : 1) * (1 + (perto ? ACOES.chute.pressaoErro : 0) * pressaoSobre(m, j)) * multPeFraco(j, pe)
      * (p.penalti && !p.cavadinha ? ACOES.chute.penaltiErro : 1) // a pressão da cobrança do pênalti
      * (p.barreira ? ACOES.chute.faltaErro : 1); // o tiro livre por cima da barreira: subir e descer no gol é difícil
    return chute(m, j, pe, p, em);
  }
  const erroMult = (primeira ? ACOES.primeiraErro : 1) * (1 + 0.8 * pressaoSobre(m, j)) * multPeFraco(j, pe);
  switch (p.tipo) {
    case 'passe': return passeRasteiro(m, j, pe, p, erroMult);
    case 'enfiada': return enfiada(m, j, pe, p, erroMult);
    case 'lancamento': return lancamentoOuCruzamento(m, j, pe, p, erroMult);
    case 'chute': return chute(m, j, pe, p, erroMult);
    default: return false;
  }
}

function passeRasteiro(m, j, pe, p, erroMult) {
  const b = m.bola;
  const cfg = ACOES.passe;
  const r = escolherAlvo(m, j, 'passe');
  let tx, tz, para = null;
  if (r) {
    para = r;
    const L0 = MD.hypot(r.x - b.p.x, r.z - b.p.z);
    const tVoo = L0 / 11;
    // vai na frente do recebedor no máximo 1 m (passe no pé, não no espaço)
    let lx = r.vx * tVoo, lz = r.vz * tVoo;
    const ll = MD.hypot(lx, lz);
    if (ll > cfg.adiante) { lx *= cfg.adiante / ll; lz *= cfg.adiante / ll; }
    tx = r.x + lx; tz = r.z + lz;
  } else {
    const d = dirPedida(j);
    const L = lerp(8, 25, p.forca);
    tx = j.x + d.x * L; tz = j.z + d.z * L;
  }
  ({ x: tx, z: tz } = dentroDoCampo(tx, tz, 0.3));
  let dx = tx - b.p.x, dz = tz - b.p.z;
  const L = MD.hypot(dx, dz) || 1;
  dx /= L; dz /= L;
  // a força se ajusta à distância; a barra corrige (mais fraca / mais forte)
  // chegada mais firme já nos passes médios (StatsBomb: 10,8 m/s de média a 12,5 m, 13,6 a 22,5 m)
  const vChegada = lerp(cfg.vChegada[0], cfg.vChegada[1], Math.sqrt(clamp(L / 35, 0, 1))) * lerp(0.75, 1.3, p.forca);
  let v0 = Math.min(30, velParaChegarCom(Math.max(0, L - 0.3), vChegada));
  const attr = j.par.attr.passe;
  const sig = lerp(cfg.erroRuim, cfg.erroBom, attr / 100) * erroMult;
  const ea = normal(m.rng) * sig;
  v0 *= 1 + normal(m.rng) * sig * 0.8;
  const u = girar(dx, dz, ea);
  finalizarChute(m, j, pe, 'passe', { x: u.x * v0, y: 0, z: u.z * v0 }, { x: 0, y: 0, z: 0 }, { x: tx, z: tz }, para, { voo: { alto: false } });
  if (para) marcarRecebedor(m, para, tx, tz, 'passe', 0);
  tabela(m, j, p);
  return true;
}

function enfiada(m, j, pe, p, erroMult) {
  const b = m.bola;
  const cfg = ACOES.enfiada;
  const lado = ataca(m, j.time);
  let r = escolherAlvo(m, j, 'enfiada');
  const d = dirPedida(j);
  if (!r) {
    // ninguém no cone: o mais adiantado na direção do analógico
    let melhor = -Infinity;
    for (const o of m.jogadores) {
      if (o.time !== j.time || o.id === j.id || o.posicao === 'GOL') continue;
      const ox = o.x - j.x, oz = o.z - j.z;
      const s = ox * d.x + oz * d.z;
      if (s > melhor) { melhor = s; r = o; }
    }
  }
  if (!r) return passeRasteiro(m, j, pe, p, erroMult);
  // direção da corrida: a do recebedor se já corre; senão para o gol, puxada pelo analógico
  let rx, rz;
  const sr = MD.hypot(r.vx, r.vz);
  if (sr > 3 && (r.vx * lado) > 0.5 * sr) { rx = r.vx / sr; rz = r.vz / sr; }
  else {
    rx = lado * 0.65 + d.x * 0.35; rz = d.z * 0.35;
    const l = MD.hypot(rx, rz) || 1; rx /= l; rz /= l;
  }
  // bola no espaço: a força diz quanto à frente no mínimo (4,5–12 m) e com que velocidade, no
  // máximo, a bola passa pelo ponto (o "peso"). Procura o ponto da corrida em que a bola chega um
  // pouco antes do recebedor (ele corre para ela) sem passar forte demais; ele arranca já.
  const vNoPonto = lerp(cfg.vNoPonto[0], cfg.vNoPonto[1], p.forca);
  const alta = p.mod;
  const reacao = sr > 3 ? 0 : Math.round(0.15 / DT);
  const lead0 = lerp(cfg.lead[0], cfg.lead[1], p.forca);
  let { x: tx, z: tz } = dentroDoCampo(r.x + rx * lead0, r.z + rz * lead0, 1.5);
  // sem tempo de a bola chegar antes (corredor lançado): bate o mais forte que o peso permite
  // no ponto mínimo, e ele ajusta a corrida para encontrá-la
  let v0Rasteira = Math.min(cfg.vMax, velParaChegarCom(MD.hypot(tx - b.p.x, tz - b.p.z), vNoPonto));
  for (let lead = lead0; !alta && lead <= lead0 + 10; lead += 0.75) {
    const q = dentroDoCampo(r.x + rx * lead, r.z + rz * lead, 1.5);
    const Lp = MD.hypot(q.x - b.p.x, q.z - b.p.z);
    const nBola = Math.max(10, ticksAteChegar(r, q.x, q.z) + reacao - Math.round(0.1 / DT));
    const v0 = velParaDistancia(Lp, nBola);
    if (v0 > cfg.vMax) break; // a bola não chega antes nem indo mais longe
    if (velRolandoApos(v0, nBola) <= vNoPonto) { tx = q.x; tz = q.z; v0Rasteira = v0; break; }
  }
  let dx = tx - b.p.x, dz = tz - b.p.z;
  const L = MD.hypot(dx, dz) || 1;
  dx /= L; dz /= L;
  const attr = j.par.attr.passe;
  const sig = lerp(cfg.erroRuim, cfg.erroBom, attr / 100) * erroMult;
  if (alta) {
    // enfiada alta: por cima da defesa, quica um pouco antes do ponto
    const el = 0.6;
    const pp = { x: b.p.x, y: b.p.y, z: b.p.z };
    const Lq = Math.max(4, L - 3);
    let s = velParaPousar(pp, dx, dz, Lq, el, { x: dz * 10, y: 0, z: -dx * 10 });
    s *= 1 + normal(m.rng) * sig * 0.6;
    const u = girar(dx, dz, normal(m.rng) * sig);
    const ce = MD.cos(el), se = MD.sin(el);
    finalizarChute(m, j, pe, 'enfiadaAlta', { x: u.x * s * ce, y: s * se, z: u.z * s * ce }, { x: u.z * 10, y: 0, z: -u.x * 10 }, { x: b.p.x + dx * Lq, z: b.p.z + dz * Lq }, r, { voo: { alto: true } });
  } else {
    let v0 = v0Rasteira * (1 + normal(m.rng) * sig * 0.6);
    const u = girar(dx, dz, normal(m.rng) * sig);
    finalizarChute(m, j, pe, 'enfiada', { x: u.x * v0, y: 0, z: u.z * v0 }, { x: 0, y: 0, z: 0 }, { x: tx, z: tz }, r, { voo: { alto: false } });
  }
  marcarRecebedor(m, r, tx, tz, 'enfiada', m.tick);
  tabela(m, j, p);
  return true;
}

/** Zonas do cruzamento (1º pau, 2º pau, marca do pênalti) para quem cruza de (x,z). */
export function zonasCruzamento(lado, zCruzador) {
  const gx = lado * CAMPO.meioX;
  const sz = zCruzador >= 0 ? 1 : -1;
  return [
    { nome: 'primeiroPau', x: gx - lado * 5.5, z: sz * 2.2 },
    { nome: 'segundoPau', x: gx - lado * 6.5, z: -sz * 3.2 },
    { nome: 'marcaPenalti', x: gx - lado * 11, z: 0 },
  ];
}

function lancamentoOuCruzamento(m, j, pe, p, erroMult) {
  const b = m.bola;
  const lado = ataca(m, j.time);
  const cc = ACOES.cruzamento;
  const noTerco = (j.x * lado) > cc.terco && Math.abs(j.z) > cc.faixa;
  if (noTerco) return cruzamento(m, j, pe, p, erroMult);
  const cfg = ACOES.lancamento;
  const r = escolherAlvo(m, j, 'lancamento');
  let tx, tz;
  if (r) {
    const L0 = MD.hypot(r.x - b.p.x, r.z - b.p.z);
    const tVoo = 0.6 + L0 / 18;
    let lx = r.vx * tVoo, lz = r.vz * tVoo;
    const ll = MD.hypot(lx, lz);
    if (ll > 5) { lx *= 5 / ll; lz *= 5 / ll; }
    tx = r.x + lx; tz = r.z + lz;
  } else {
    const d = dirPedida(j);
    const L = lerp(20, 50, p.forca);
    tx = j.x + d.x * L; tz = j.z + d.z * L;
  }
  ({ x: tx, z: tz } = dentroDoCampo(tx, tz, 1));
  const L = MD.hypot(tx - b.p.x, tz - b.p.z) || 1;
  // erro no ponto de queda: ±erroBom m a 40 m para um bom lançador (cresce com a distância)
  const sig = lerp(cfg.erroRuim, cfg.erroBom, j.par.attr.passeLongo / 100) * (L / 40) * erroMult;
  const ex = tx + normal(m.rng) * sig * 0.7, ez = tz + normal(m.rng) * sig * 0.7;
  const qx = ex - b.p.x, qz = ez - b.p.z;
  const Lq = MD.hypot(qx, qz) || 1;
  const ux = qx / Lq, uz = qz / Lq;
  const el = lerp(cfg.elev[0], cfg.elev[1], clamp((L - 20) / 40, 0, 1));
  const w = { x: uz * 8, y: 0, z: -ux * 8 }; // um pouco de giro para trás
  const pp = { x: b.p.x, y: b.p.y, z: b.p.z };
  const s = velParaPousar(pp, ux, uz, Lq, el, w);
  const ce = MD.cos(el), se = MD.sin(el);
  const voo = simularVoo(pp, { x: ux * s * ce, y: s * se, z: uz * s * ce }, w);
  finalizarChute(m, j, pe, 'lancamento', { x: ux * s * ce, y: s * se, z: uz * s * ce }, w, { x: ex, z: ez }, r, { voo: { alto: true, alvoPedido: { x: tx, z: tz } }, ticks: voo.ticks });
  if (r) marcarRecebedor(m, r, ex, ez, 'lancamento', m.tick + voo.ticks);
  tabela(m, j, p);
  return true;
}

function cruzamento(m, j, pe, p, erroMult) {
  const b = m.bola;
  const lado = ataca(m, j.time);
  const cc = ACOES.cruzamento;
  const zonas = zonasCruzamento(lado, j.z);
  // a zona pelo analógico, em setores largos (vistas da ponta, as três zonas ficam a ~6° uma da
  // outra): para a linha de fundo = 1º pau; atravessado = 2º pau; para trás = marca do pênalti.
  // Sem analógico: a zona com o companheiro mais perto.
  let zona = zonas[2];
  const mr = mira(j);
  if (mr && mr.mag > 0.3) {
    const sz = j.z >= 0 ? 1 : -1;
    const phi = MD.atan2(mr.x * lado, -mr.z * sz); // 0 = atravessado; + = para a linha de fundo
    zona = phi > cc.setor ? zonas[0] : phi < -cc.setor ? zonas[2] : zonas[1];
  } else {
    let mel = Infinity;
    for (const zz of zonas) for (const o of m.jogadores) {
      if (o.time !== j.time || o.id === j.id || o.posicao === 'GOL') continue;
      const d = MD.hypot(o.x - zz.x, o.z - zz.z);
      if (d < mel) { mel = d; zona = zz; }
    }
  }
  // quem ataca a zona: o companheiro mais perto dela
  let r = null, dr = Infinity;
  for (const o of m.jogadores) {
    if (o.time !== j.time || o.id === j.id || o.posicao === 'GOL') continue;
    const d = MD.hypot(o.x - zona.x, o.z - zona.z);
    if (d < dr) { dr = d; r = o; }
  }
  const L = MD.hypot(zona.x - b.p.x, zona.z - b.p.z) || 1;
  const sig = lerp(ACOES.lancamento.erroRuim, ACOES.lancamento.erroBom, j.par.attr.passeLongo / 100) * (L / 40) * erroMult;
  const ex = zona.x + normal(m.rng) * sig * 0.7, ez = zona.z + normal(m.rng) * sig * 0.7;
  const qx = ex - b.p.x, qz = ez - b.p.z;
  const Lq = MD.hypot(qx, qz) || 1;
  const ux = qx / Lq, uz = qz / Lq;
  const pp = { x: b.p.x, y: b.p.y, z: b.p.z };
  let tipo = 'cruzamento', v, w, ticks;
  if (p.rasteiro) {
    const v0 = Math.min(30, velParaChegarCom(Lq, cc.vRasteiro));
    v = { x: ux * v0, y: 0, z: uz * v0 }; w = { x: 0, y: 0, z: 0 }; ticks = Math.round(Lq / (v0 * 0.8) / DT);
  } else {
    const el = p.mod ? cc.elevTenso : cc.elevAlto;
    w = { x: uz * 6, y: 0, z: -ux * 6 };
    // a bola passa pela zona na altura do cabeceio (alto) ou da cintura (tenso), já descendo
    const s = velParaAlturaEm(pp, ux, uz, Lq, el, w, p.mod ? cc.yTenso : cc.yAlto);
    const ce = MD.cos(el), se = MD.sin(el);
    v = { x: ux * s * ce, y: s * se, z: uz * s * ce };
    ticks = simularVoo(pp, v, w).ticks;
  }
  finalizarChute(m, j, pe, tipo, v, w, { x: ex, z: ez }, r, { voo: { alto: !p.rasteiro, zona: zona.nome, rasteiro: !!p.rasteiro, tenso: !!p.mod }, ticks });
  if (r) marcarRecebedor(m, r, ex, ez, 'cruzamento', m.tick + ticks);
  return true;
}

/**
 * Arremesso do lateral (Regra 15; lateral.js): a bola sai das mãos (já no ponto da soltura) para o recebedor `r` ou,
 * sem ele, para o ponto `alvo` {x, z} (o arremesso longo na área) ou na direção a.dir. Curto (PASSE/ENFIADA): chega a r
 * na altura LATERAL.yRecebe (coxa/peito), no máximo LATERAL.adiante m à frente dele. Longo (LANÇAMENTO): ~30°, pousa no
 * ponto. A velocidade nunca passa da do braço dele (lateral.js vMaxArremesso): longe demais, a bola fica curta.
 * a = {tipo, forca, dir?}; vMax em m/s. Evento 'passe' com modo 'lateral'.
 */
export function arremessoLateral(m, j, a, r, alvo, vMax) {
  const b = m.bola;
  const L = LATERAL;
  const longo = a.tipo === 'lancamento';
  let tx, tz;
  if (r) {
    const L0 = MD.hypot(r.x - b.p.x, r.z - b.p.z);
    const tVoo = 0.3 + L0 / 13;
    let lx = r.vx * tVoo, lz = r.vz * tVoo;
    const ll = MD.hypot(lx, lz), lim = a.tipo === 'enfiada' ? 4 : L.adiante;
    if (ll > lim) { lx *= lim / ll; lz *= lim / ll; }
    if (a.tipo === 'enfiada' && ll < 1e-6) { const lado = ataca(m, j.time); lx = lado * lim; }
    tx = r.x + lx; tz = r.z + lz;
  } else if (alvo) { tx = alvo.x; tz = alvo.z; }
  else {
    const d = a.dir ?? { x: MD.cos(j.rumo), z: MD.sin(j.rumo) };
    const D = 8 + 17 * clamp(a.forca, 0, 1);
    tx = b.p.x + d.x * D; tz = b.p.z + d.z * D;
  }
  ({ x: tx, z: tz } = dentroDoCampo(tx, tz, 0.5));
  let ux = tx - b.p.x, uz = tz - b.p.z;
  const D = MD.hypot(ux, uz) || 1;
  ux /= D; uz /= D;
  const pp = { x: b.p.x, y: b.p.y, z: b.p.z };
  const w = { x: uz * 5, y: 0, z: -ux * 5 }; // um pouco de giro para trás (a bola sai das pontas dos dedos)
  const el = longo || !r ? L.elevLongo : L.elevCurto;
  let s = longo || !r ? velParaPousar(pp, ux, uz, D, el, w) : velParaAlturaEm(pp, ux, uz, D, el, w, L.yRecebe);
  s = Math.min(s, vMax);
  const sig = lerp(L.erroRuim, L.erroBom, j.par.attr.passe / 100);
  const u = girar(ux, uz, normal(m.rng) * sig);
  s *= 1 + normal(m.rng) * sig * 0.6;
  const ce = MD.cos(el), se = MD.sin(el);
  const v = { x: u.x * s * ce, y: s * se, z: u.z * s * ce };
  const voo = simularVoo(pp, v, w);
  finalizarChute(m, j, j.par.attr.pePreferido ?? 1, 'lateral', v, w, { x: tx, z: tz }, r, { voo: { alto: true, lateral: true }, ticks: voo.ticks });
  if (r) marcarRecebedor(m, r, tx, tz, 'lancamento', m.tick + voo.ticks);
  return true;
}

/** Velocidade para a bola (elevação el) passar a D metros na altura y. Busca binária. */
function velParaAlturaEm(pp, ux, uz, D, el, w, y) {
  let lo = 3, hi = 42;
  for (let i = 0; i < 26; i++) {
    const s = (lo + hi) / 2;
    if (alturaNaDistancia(pp, ux, uz, D, s, el, w).y < y) lo = s; else hi = s;
  }
  return (lo + hi) / 2;
}

/**
 * Ponto da mira na linha do gol (z) pelo analógico mr: o ângulo entre o analógico e a reta bola–gol escolhe o canto
 * ("lat" positivo = para a direita de quem chuta; no gol de +x a direita é +z), dentro da boca do gol.
 */
function zPeloAnalogico(b, gx, lado, meio, mr) {
  const dirGol = MD.atan2(-b.p.z, gx - b.p.x);
  const lat = MD.sin(difAng(dirGol, MD.atan2(mr.z, mr.x)));
  return clamp(lat * lado * meio * 1.4, -meio + 0.5, meio - 0.5);
}

/** Goleiro adversário (o mais perto do gol atacado). */
export function goleiroAdversario(m, time) {
  for (const o of m.jogadores) if (o.time !== time && o.posicao === 'GOL') return o;
  return null;
}

function chute(m, j, pe, p, erroMult) {
  const b = m.bola;
  const cfg = ACOES.chute;
  const lado = ataca(m, j.time);
  const gx = lado * CAMPO.meioX;
  const gk = goleiroAdversario(m, j.time);
  const meio = CAMPO.gol.largura / 2;
  const dGol = MD.hypot(gx - b.p.x, b.p.z);
  // cavadinha pedida pelo humano (dois toques no CHUTE): de qualquer lugar
  if (p.cavadinha) return cavadinha(m, j, pe, p, erroMult, gx);
  // cavadinha da IA: goleiro adiantado entre a bola e o gol (o chute de um toque do humano nunca vira cavadinha)
  if (gk && dGol < ACOES.cavadinha.distMax && !p.humano) {
    const fora = (gx - gk.x) * lado;
    const entre = (gk.x - b.p.x) * lado > 1 && MD.hypot(gk.x - b.p.x, gk.z - b.p.z) < 14;
    if (fora > ACOES.cavadinha.goleiroFora && entre) return cavadinha(m, j, pe, p, erroMult, gx);
  }
  // mira: o analógico escolhe o canto; sem analógico, o lado mais longe do goleiro
  let zMira;
  const mr = mira(j);
  if (mr && mr.mag > 0.3) {
    zMira = zPeloAnalogico(b, gx, lado, meio, mr);
  } else {
    const gz = gk ? gk.z : 0;
    zMira = gz > 0 ? -meio + 0.6 : meio - 0.6;
  }
  // pênalti: a mira do humano vai no máximo a ±penaltiCanto m do meio — com o erro da cobrança (penaltiErro) a ±3,1 m
  // mandava 1/3 dos pênaltis para fora com qualquer analógico; a ±2,75 (o canto da IA, que bate 36% mais no meio), 16%;
  // a ±2,5, ~8% (teste-botoes B11; a meta do dono é ~6%). Só o humano: a IA mira o canto dela (PARTIDA.penaltiIA)
  if (p.penalti && ehHumano(m, j)) zMira = clamp(zMira, -cfg.penaltiCanto, cfg.penaltiCanto);
  const yMira = lerp(cfg.yAlvo[0], cfg.yAlvo[1], p.forca * p.forca);
  const colocado = p.mod;
  let s = lerp(cfg.v[0], cfg.v[1], p.forca) * lerp(0.86, 1.08, j.par.attr.finalizacao / 100) * velPeFraco(j, pe);
  if (colocado) s *= cfg.colocadoV;
  let ux = gx - b.p.x, uz = zMira - b.p.z;
  const D0 = MD.hypot(ux, uz) || 1;
  ux /= D0; uz /= D0;
  // a altura é medida 0,4 m antes da linha: na linha estão as traves, e um voo que bate no
  // travessão confundiria a busca da elevação
  const D = Math.max(1, D0 - 0.4);
  const pp = { x: b.p.x, y: b.p.y, z: b.p.z };
  // colocado: efeito para dentro (curva para o meio do gol)
  let w = { x: 0, y: 0, z: 0 };
  if (colocado) {
    // efeito de dentro do pé: a bola sai por fora e curva para dentro do gol (Magnus ∝ ω × v,
    // com ω no eixo y: a força lateral em z vale −ωy·vx)
    const sinal = (zMira >= 0 ? 1 : -1) * lado;
    w = { x: 0, y: sinal * cfg.giroColocado, z: 0 };
    // gira a saída até a bola cruzar na mira (o desvio é medido em relação à reta original)
    const ux0 = ux, uz0 = uz;
    let a = 0;
    for (let k = 0; k < 3; k++) {
      const g = girar(ux0, uz0, a);
      const el0 = elevacaoParaAltura(pp, g.x, g.z, D, s, yMira, w);
      const r0 = alturaNaDistancia(pp, g.x, g.z, D, s, el0, w);
      a -= (r0.lateral + D * MD.sin(a)) / D;
    }
    const g = girar(ux0, uz0, a);
    ux = g.x; uz = g.z;
  }
  // tiro livre com barreira (Regra 13; partida.js): com efeito por cima (giro para a frente: a bola desce), a elevação que
  // passa por cima dela (o centro da bola a p.barreira.altura m a p.barreira.dist m); chegando no gol acima de
  // yBarreiraMax, tira força até descer abaixo do travessão
  let elFalta = null;
  if (p.barreira && D > p.barreira.dist + 1) {
    w = { x: w.x + uz * cfg.giroFalta, y: w.y, z: w.z - ux * cfg.giroFalta };
    for (let k = 0; k < 18; k++) {
      const elW = elevacaoParaAltura(pp, ux, uz, p.barreira.dist, s, p.barreira.altura, w);
      const yG = alturaNaDistancia(pp, ux, uz, D, s, elW, w).y;
      if (yG <= cfg.yBarreiraMax) { elFalta = elW; break; }
      s *= 0.95;
    }
  }
  const el = elFalta ?? elevacaoParaAltura(pp, ux, uz, D, s, yMira, w);
  // erro: distância, pressão, pé fraco, força no máximo, de primeira
  const base = lerp(cfg.erroRuim, cfg.erroBom, j.par.attr.finalizacao / 100);
  // (no tiro livre com barreira o erro é o da falta, com ou sem efeito: ACOES.chute.faltaErro já está em erroMult)
  const sig = base * (1 + dGol / 25) * erroMult * (p.forca > 0.9 ? cfg.forcaMaxErro : 1) * (colocado && !p.barreira ? cfg.colocadoErro : 1);
  const ea = normal(m.rng) * sig, ee = normal(m.rng) * sig * 0.6;
  const u = girar(ux, uz, ea);
  const ce = MD.cos(el + ee), se = MD.sin(el + ee);
  const tipo = colocado ? 'colocado' : 'chute';
  const ticks = Math.round(D / (s * 0.9) / DT);
  finalizarChute(m, j, pe, tipo, { x: u.x * s * ce, y: s * se, z: u.z * s * ce }, w, { x: gx, z: zMira }, null, { voo: { alto: false, mira: { y: yMira, z: zMira } }, ticks });
  return true;
}

function cavadinha(m, j, pe, p, erroMult, gx) {
  const b = m.bola;
  const cfg = ACOES.cavadinha;
  const lado = ataca(m, j.time);
  // cai logo depois da linha: passa nela abaixo do travessão, descendo
  let ux = gx + lado * cfg.alemDaLinha - b.p.x, uz = -b.p.z * 0.6;
  let el = cfg.elev;
  if (p.cavadinha) {
    // pedida (dois toques no CHUTE): o canto pelo analógico, como o chute (sem analógico, por cima do goleiro, um
    // pouco para o meio — a mesma da IA); a força do 2º toque deixa a bola mais alta (o ponto de queda continua logo
    // depois da linha: de longe é um balão, de perto uma cavadinha curta)
    const meio = CAMPO.gol.largura / 2;
    const mr = mira(j);
    const zM = mr && mr.mag > 0.3 ? zPeloAnalogico(b, gx, lado, meio, mr) : clamp(b.p.z * 0.4, -meio + 0.6, meio - 0.6);
    uz = zM - b.p.z;
    // (a Panenka sobe no máximo até penalti.elevMax: mais em pé que isso, de 11 m, é um balão de ~5 m que 1% de força
    // muda 0,3 m na altura em que chega ao goleiro)
    el = lerp(cfg.elevPedida[0], p.penalti ? cfg.penalti.elevMax : cfg.elevPedida[1], clamp((p.forca - 0.08) / 0.92, 0, 1));
  }
  const D = MD.hypot(ux, uz) || 1;
  ux /= D; uz /= D;
  const pp = { x: b.p.x, y: b.p.y, z: b.p.z };
  const w = { x: uz * 12, y: 0, z: -ux * 12 };
  // Panenka (a pedida no pênalti, ACOES.cavadinha.penalti): a velocidade é a que passa na linha na altura `y`, descendo
  // (medida 0,4 m antes dela, como o chute: na linha estão as traves). A busca de "cair alemDaLinha m depois da linha"
  // não serve aqui: com o gol no caminho a distância do pouso não cresce com a velocidade (a bola bate no travessão ou no
  // teto da rede e volta) e a busca parava no travessão — sem erro nenhum, a Panenka passava a ~2,8 m na linha
  const pen = p.cavadinha && p.penalti ? cfg.penalti : null;
  const s = pen ? velParaAlturaEm(pp, ux, uz, Math.max(1, (gx - b.p.x) / ux - 0.4), el, w, pen.y) : velParaPousar(pp, ux, uz, D, el, w);
  // a cavadinha é difícil de dosar (StatsBomb: 41,8% no alvo): erro grande na força e na direção. A Panenka é a bola
  // parada a 11 m, sem marcador e sem a pressão do pênalti: erro próprio, pequeno (Opta: 95,7% de gols no alto do meio)
  const fin = j.par.attr.finalizacao / 100;
  const eDir = pen ? pen.erroDir : cfg.erroDir, eForca = pen ? pen.erroForca : cfg.erroForca;
  const u = girar(ux, uz, normal(m.rng) * lerp(eDir[0], eDir[1], fin) * erroMult);
  let s2 = s * (1 + normal(m.rng) * lerp(eForca[0], eForca[1], fin) * erroMult);
  // a pedida vale de qualquer lugar: nunca sai mais rápida que o chute mais forte dele (a mesma conta do chute com a
  // força cheia). De longe a busca pedia até 45 m/s e o erro de força somava (até ~70 m/s, contraprova 13/10): com o
  // teto, o balão de longe cai antes do gol. A da IA (até distMax) fica como era
  if (p.cavadinha) s2 = Math.min(s2, ACOES.chute.v[1] * lerp(0.86, 1.08, fin) * velPeFraco(j, pe));
  const ce = MD.cos(el), se = MD.sin(el);
  finalizarChute(m, j, pe, 'cavadinha', { x: u.x * s2 * ce, y: s2 * se, z: u.z * s2 * ce }, w, { x: b.p.x + ux * D, z: b.p.z + uz * D }, null, { voo: { alto: true } });
  return true;
}

/** Cabeceio (bola alta): PASSE = para um companheiro; CHUTE = no gol; LANÇAMENTO = afastar. */
export function executarCabeceio(m, j, p) {
  const b = m.bola;
  const lado = ataca(m, j.time);
  const cfg = ACOES.cabeceio;
  const attr = j.par.attr.cabeceio;
  // quem ganhou a disputa pelo alto agora (sim.js) cabeceia pressionado: mais dispersão. O cabeceio a gol na bola parada
  // (Etapa 4) espalha como o de verdade (Opta: ~1/3 no alvo)
  // (entrega "cabeceio na bola rolando", 12/10: o cabeceio a gol espalha como o de verdade em toda bola — Opta: ~40% no
  // alvo —, não só na bola parada; os outros cabeceios ficam com a dispersão de antes)
  const e0 = p.tipo === 'chute' ? cfg.erroGol : [0.12, 0.03];
  const sig = lerp(e0[0], e0[1], attr / 100) * (j.disputa === m.tick ? AEREO.erroDisputa : 1);
  let ux, uz, s, el;
  let para = null;
  if (p.tipo === 'chute') {
    const gx = lado * CAMPO.meioX;
    const meio = CAMPO.gol.largura / 2;
    const mr = mira(j);
    // sem o analógico, o lado longe do goleiro — sem procurar o canto: a cabeçada não tem a precisão do chute (Opta: ~40%
    // no alvo); a dispersão faz o resto
    const gk = goleiroAdversario(m, j.time);
    const zM = mr && mr.mag > 0.3 ? clamp(mr.z * meio, -meio + 0.4, meio - 0.4) : ((gk ? gk.z : b.p.z) > 0 ? -1 : 1) * CABECEIO.zGol;
    ux = gx - b.p.x; uz = zM - b.p.z;
    const D = MD.hypot(ux, uz) || 1; ux /= D; uz /= D;
    // força própria do cabeceio com corrida (Becker 2021: ~8,3 m/s) + parte da bola que chega
    const vIn = MD.hypot(b.v.x, b.v.y, b.v.z);
    s = clamp(lerp(cfg.potencia[0], cfg.potencia[1], attr / 100) + cfg.redirecao * vIn, cfg.v[0], cfg.v[1]);
    // a elevação que põe a bola BAIXA na linha do gol (CABECEIO.yGol; o melhor cabeceador mira mais baixo), como o chute
    // (antes −0,08 fixo: de ~2,1 m a bola descia nas pernas da defesa)
    const yM = lerp(CABECEIO.yGol[1], CABECEIO.yGol[0], attr / 100);
    el = elevacaoParaAltura({ x: b.p.x, y: b.p.y, z: b.p.z }, ux, uz, Math.max(1, D - 0.4), s, yM);
  } else if (p.tipo === 'passe') {
    para = escolherAlvo(m, j, 'passe');
    const tx = para ? para.x : j.x + dirPedida(j).x * 10, tz = para ? para.z : j.z + dirPedida(j).z * 10;
    ux = tx - b.p.x; uz = tz - b.p.z;
    const D = MD.hypot(ux, uz) || 1; ux /= D; uz /= D;
    s = clamp(D * 0.9 + 3, 6, 14);
    el = 0.25;
  } else if (p.auto) {
    // afastar sem botão (cabeceio.js intencaoCabeceio): para longe do meu gol e para o lado da bola — nunca de volta para
    // o meio da minha área (a bola que volta na frente do gol vira chance deles)
    const sz = b.p.z >= 0 ? 1 : -1;
    ux = lado; uz = sz * CABECEIO.ladoAfasta;
    const l = MD.hypot(ux, uz) || 1; ux /= l; uz /= l;
    s = CABECEIO.vAfasta; el = CABECEIO.elAfasta;
  } else {
    const d = dirPedida(j);
    ux = d.x * 0.4 + lado * 0.6; uz = d.z * 0.4;
    const l = MD.hypot(ux, uz) || 1; ux /= l; uz /= l;
    s = 16; el = 0.6;
  }
  const u = girar(ux, uz, normal(m.rng) * sig);
  el += normal(m.rng) * sig * 0.5;
  const ce = MD.cos(el), se = MD.sin(el);
  finalizarChute(m, j, j.par.attr.pePreferido, 'cabeceio', { x: u.x * s * ce, y: s * se, z: u.z * s * ce }, { x: 0, y: 0, z: 0 }, { x: b.p.x + u.x * 10, z: b.p.z + u.z * 10 }, para, { voo: { alto: el > 0.2, cabeceio: p.tipo } });
  if (para) marcarRecebedor(m, para, para.x, para.z, 'passe', 0);
  return true;
}

/** Tabela: depois do passe, segurando o modificador, o passador corre para o espaço. */
function tabela(m, j, p) {
  if (!(j.botoes & BOTAO.MOD) && !p.mod) return;
  const lado = ataca(m, j.time);
  const d = dirPedida(j);
  const x = j.x + lado * 12 + d.x * 4, z = j.z + d.z * 6;
  const q = dentroDoCampo(x, z, 2);
  j.corrida = { x: q.x, z: q.z, ate: m.tick + 150, tipo: 'tabela' };
}

// ------------------------------------------------------------------ bola alta: domínio no corpo

/**
 * Altura e ponto em que a bola (no ar) passa pelo jogador: o tick de maior aproximação entre os
 * que ficam a ≤ 0,6 m do corpo na horizontal (onde ela chega ao corpo). {i, y, x, z} ou null.
 * Pela previsão da bola compartilhada no passo (conducao.js preverBola: a mesma física, bit a bit) —
 * antes cada jogador simulava o voo inteiro de novo (até 150 ticks por jogador e por passo).
 */
export function bolaAltaPassando(m, j, max = 60) {
  const b = m.bola;
  if (b.rolando) return null;
  const pb = preverBola(b, max);
  let melhor = null;
  for (let i = 1; i <= max; i++) {
    const x = pb.xs[i], z = pb.zs[i];
    const d = MD.hypot(x - j.x, z - j.z);
    if (d < 0.6) {
      if (!melhor || d < melhor.d) melhor = { i, y: pb.ys[i], x, z, d };
      else break; // já se afastando
    } else if (melhor) break;
    if (pb.rol[i]) break;
  }
  // ainda se aproximando no fim do horizonte: o ponto de contato não está visto
  if (melhor && melhor.i >= max) return null;
  return melhor;
}

