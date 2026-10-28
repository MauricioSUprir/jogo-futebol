// Replays nas paradas (pedido do dono de 22/10: "os replays de faltas e jogadas passando na tela enquanto o jogo tá
// parado"): o CLASSIFICADOR de lances. Puro (sem three.js nem DOM) e FORA do fecho do hash (tools/fecho-hash.mjs: nenhum
// módulo da simulação importa este arquivo; ele só importa constantes e a matemática do fecho). A cada passo da partida
// só LÊ o mundo e os eventos do passo (main.js rodarPasso; tools/teste-replay-paradas.mjs) e, na bola morta, diz qual
// lance vale um replay (L.lance): o pênalti, o vermelho, a bola na trave, o amarelo, a falta onde o jogo monta a
// barreira, a defesa espalmada, o chute bloqueado por um adversário que vira escanteio, o chute de dentro da área que
// passou perto e o chute de dentro da área que saiu pela linha de fundo (tiro de meta). Também diz se o PRÓXIMO passo
// monta a bola parada (montaNoProximoPasso: a mesma conta do partida.js regrasPartida) — o main.js segura a simulação ali e
// o replay toca: ao vivo (1 s de bola saindo, os jogadores chegando) → vinheta → replay → vinheta → o corte da montagem (a
// ordem da TV, patente US7657836). Plano em PLANO-CENAS.md §2; pesquisa em PESQUISA-CENAS-TV.md §4; contrato "Cenas das
// paradas" no CONTRATOS.md.
// Nada é alocado por passo (o lance e os registros são reaproveitados) e não há sorteio; as distâncias passam pelo MD
// (matdet.js): no online os dois aparelhos classificam igual (PLANO-CENAS.md R15).
import { BARREIRA, CAMPO, PARTIDA, PASSO } from './config.js';
import { MD } from './matdet.js';

// Constantes (PLANO-CENAS.md §6; FORA do fecho: o config.js é do fecho e não muda — rev. R4: ficam aqui, que já está no
// download inicial, e não no cenas-config.js dos módulos sob demanda).
export const REPLAY_PARADA = {
  ligado: true,          // padrão (?replayParada=0|1; desligado com webdriver, ?prints=1 e ?demo=1); vale com "Replays: Ligado"
  // teto e espaço: SoccerNet-v2 (500 jogos) — 86,7% dos planos ao vivo, 10,9% + 2,4% em replay → ~13% do ar. Em 8 min de
  // jogo (480 s) com gol (~21 s) e impedimento (~8 s) já no ar, sobram ~40 s para as paradas → ~6 de ~6,8 s por partida
  porTempo: 3,           // replays de parada por tempo (a classe A fura o teto)
  espaco: 30,            // s de bola rolando desde o último replay automático (gol, impedimento ou parada): "nunca dois seguidos"
  maximo: 8.0,           // s por parada — SoccerNet: 6,8 s por plano de replay, 1–3 ângulos; LaLiga (Carranza, COPE
                         // 20/10/2026): "se dá para resolver em dois ângulos, melhor que em três"
  // P1: a jogada na câmera de TV, velocidade real (antesMin: até onde o começo encolhe no orçamento)
  tv: { antes: 2.5, antesMin: 1.0, depois: 1.0, depoisChance: 0.5, vel: 1 },
  // P2: mais fechado e mais lento (patente US7657836: ao vivo → reação → replay fechado e lento); 0,5× = a câmera de
  // trás do gol do replay de hoje (REPLAY.gol.vel[1]). fov: fração do da TV na câmera 'fechada'
  // mistura: o olhar da 'fechada' fica entre o ponto do lance (0) e a bola (1), a no máximo `quadro` da meia-largura do quadro
  // do ponto do lance (render/replay.js; com a bola longe, o lance ia à borda da tela)
  lento: { antes: 0.8, depois: 0.6, antesChance: 0.5, depoisChance: 0.4, vel: 0.5, fov: 0.5, mistura: 0.45, quadro: 0.4 },
  // gatilhos (classe B): chute de dentro da área (ou a ≥ vMin m/s) espalmado ou BLOQUEADO por um adversário com a bola
  // morta em escanteio; chute de dentro da área que saiu a ≤ perto m da trave/travessão ou que saiu pela linha de fundo
  // (tiro de meta; o de fora da área não: o orçamento do ar, em classificar); a bola morta até mortaAte s depois do chute.
  // (28/10) O que a TV repete — SoccerNet-v2, rótulos públicos (SoccerNet/SN-Labels: Labels-v2 + Labels-cameras, 498 jogos;
  // o replay ligado à ação; PESQUISA-CENAS-TV.md §4): o chute no alvo que vira escanteio 82% (687/836: a espalmada), o
  // chute fora do alvo que vira escanteio 66% (298/454: o desvio, o bloqueio de um defensor) e o fora do alvo que vira
  // tiro de meta 72% (2551/3560); o chute com a bola morta em ≤ 2 s 73%, em 2–4 s 65%. O bloqueio só no ESCANTEIO (a
  // fonte não cobre o desvio que vira lateral ou falta); a barreira conta (o chute de tiro livre direto que vira
  // escanteio: 68%, 27/40).
  chance: { vMin: 22, perto: 1.5, mortaAte: 4 },
  // (28/10) falta perto = a cobrança a ≤ faltaPerto m do centro do gol atacado, do ponto da bola: onde o jogo monta a
  // BARREIRA (config.js BARREIRA.longe; bolas-paradas.js barreiraDoTiroLivre). No SoccerNet-v2 o "Direct free-kick" é o
  // tiro livre "with the intention to score or if the other team forms a wall" (material suplementar, §7.1): a TV o
  // repete na parada em 74,3% (1609/2166; sem cartão 67,4%, 1087/1613). Antes 25 m do ponto da falta, sem fonte.
  faltaPerto: BARREIRA.longe,
};

/** Os tipos de lance, do mais forte ao mais fraco (o peso: os melhores momentos dos PRs 3 e 4 escolhem por ele). */
export const TIPOS_LANCE = ['penalti', 'vermelho', 'trave', 'amarelo', 'faltaPerto', 'espalmada', 'bloqueio', 'passouPerto', 'chuteFora'];
const PESO = { penalti: 7, vermelho: 6, trave: 5, amarelo: 4, faltaPerto: 3, espalmada: 2, bloqueio: 1.5, passouPerto: 1, chuteFora: 0.5 };
const CLASSE_A = new Set(['penalti', 'vermelho', 'trave']);
/** O lance é de chance (o desfecho é um chute: trave, espalmada, bloqueio, passou perto, chute fora) — o P2 é atrás do gol. */
export const ehChance = tipo => tipo === 'trave' || tipo === 'espalmada' || tipo === 'bloqueio' || tipo === 'passouPerto' || tipo === 'chuteFora';

const s60 = s => Math.round(s / PASSO);
const NFALTAS = 4;
// gol: o centro dos postes e do travessão (bola.js: o eixo da trave fica a raioPoste da boca)
const RP = CAMPO.gol.raioPoste, ZP = CAMPO.gol.largura / 2 + RP, YT = CAMPO.gol.altura + RP;
const AREA_U = CAMPO.meioX - CAMPO.area.profundidade, AREA_Z = CAMPO.area.largura / 2;

function novoLance() {
  return { classe: null, tipo: null, chave: -1, fim: -1, morta: -1, ateMax: null, time: 0, ids: [], x: 0, z: 0, lado: 1, peso: 0, parada: null };
}

/** O estado do classificador (um por partida; nada é alocado depois). */
export function criarLances() {
  const faltas = [];
  for (let k = 0; k < NFALTAS; k++) faltas.push({ tick: -1, def: -1, id: -1, time: 0, x: 0, z: 0, area: false, cartao: null });
  return {
    lance: null,             // o lance da bola morta DESTE passo (o objeto `_lance` reaproveitado) ou null
    _lance: novoLance(),
    tempo: 1,
    rolando: 1e9,            // passos de bola rolando desde o último replay automático (começa longe: o 1º pode)
    porTempo: [0, 0],        // replays de parada por tempo
    ultimoTick: -1, ultimoTipo: null,
    // o que aconteceu desde a última bola morta
    chute: { ativo: false, tick: -1, id: -1, time: 0, v: 0, x: 0, z: 0, lado: 1, area: false, bloqueado: false, segura: false, espalmada: -1, gk: -1, cruzou: -1, dist: Infinity,
      prim: -1, primId: -1, primAdv: false },
    trave: { tick: -1, x: 0, z: 0 },
    faltas, nFaltas: 0,
    bAnt: { x: 0, y: 0, z: 0, ok: false },
  };
}

function limparDesdeMorta(L) {
  L.chute.ativo = false; L.trave.tick = -1; L.nFaltas = 0;
}

function quemTime(m, id) {
  for (const j of m.jogadores) if (j.id === id) return j;
  return null;
}

function novoChute(L, m, id, v) {
  const j = quemTime(m, id);
  if (!j) return;
  const c = L.chute, lado = m.ataca[j.time] >= 0 ? 1 : -1;
  c.ativo = true; c.tick = m.tick; c.id = id; c.time = j.time; c.v = v; c.x = j.x; c.z = j.z; c.lado = lado;
  c.area = j.x * lado >= AREA_U && Math.abs(j.z) <= AREA_Z;
  c.bloqueado = false; c.segura = false; c.espalmada = -1; c.gk = -1; c.cruzou = -1; c.dist = Infinity;
  c.prim = -1; c.primId = -1; c.primAdv = false;
}

function guardarFalta(L, m, e) {
  const k = L.nFaltas % NFALTAS, f = L.faltas[k];
  f.tick = m.tick; f.def = e.def; f.id = e.id; f.time = e.time; f.x = e.x; f.z = e.z; f.area = !!e.area; f.cartao = e.cartao ?? null;
  L.nFaltas++;
}

/** A falta mais nova desde a última bola morta que passa no filtro (def = quem fez; time = quem sofreu), ou null. */
function faltaRecente(L, def, time) {
  for (let i = L.nFaltas - 1; i >= Math.max(0, L.nFaltas - NFALTAS); i--) {
    const f = L.faltas[i % NFALTAS];
    if ((def == null || f.def === def) && (time == null || f.time === time)) return f;
  }
  return null;
}

/** Distância (m) do ponto (z, y) em que o centro da bola cruzou a linha de fundo ao eixo da armação (postes e travessão). */
function distArmacao(z, y) {
  const az = Math.abs(z);
  // dos postes (segmento vertical y ∈ [0, YT] em z = ±ZP) e do travessão (y = YT, z ∈ [−ZP, ZP])
  const dPoste = MD.hypot(az - ZP, y > YT ? y - YT : y < 0 ? -y : 0);
  const dTrav = MD.hypot(az > ZP ? az - ZP : 0, y - YT);
  return Math.min(dPoste, dTrav);
}

/**
 * Um passo da partida (depois do passo; só lê): o que o lance precisa (chute, trave, defesa, bloqueio, falta) e, na bola
 * morta deste passo (estado 'parada' com a parada nova e sem cobrador; nunca o gol, o impedimento nem o fim do tempo),
 * o lance mais forte em L.lance (ou null). Devolve L.lance.
 */
export function lancesPasso(L, m, eventos) {
  L.lance = null;
  const p = m.partida;
  if (!p) return null;
  const b = m.bola.p, c = L.chute;
  if (p.tempo !== L.tempo) L.tempo = p.tempo;
  if (p.estado === 'jogo') L.rolando++;
  let cartaoV = null, cartaoA = null, penalti = false, gol = false, imped = false;
  // chuteAqui: o chute deste passo já passou na lista (o corpo que a bola acerta no MESMO passo do chute — o bloqueio da
  // perna, sim.js bloqueioPerna — vem depois dele; o que veio antes é de outra bola)
  let chuteAqui = false;
  for (const e of eventos) {
    switch (e.tipo) {
      case 'gol': gol = true; break;
      case 'chute': novoChute(L, m, e.id, e.v ?? 0); chuteAqui = true; break;
      // o cabeceio PARA O GOL é finalização (o mesmo critério do anel: replay-anel.js marcasDoPasso)
      case 'cabeceio': if (m.voo && m.voo.cabeceio === 'chute' && m.voo.de === e.id) { novoChute(L, m, e.id, MD.hypot(m.bola.v.x, m.bola.v.y, m.bola.v.z)); chuteAqui = true; } break;
      // só com a bola viva (ou morta NESTE passo: a física roda antes das regras): a bola que bate na trave depois do apito
      // (o impedimento que segue) não pode virar o lance da próxima bola morta
      case 'trave':
        if (p.estado === 'jogo' || (m.parada && m.parada.inicio === m.tick)) { L.trave.tick = m.tick; L.trave.x = b.x; L.trave.z = b.z; }
        break;
      case 'defesa':
        if (c.ativo) { if (e.modo === 'espalmada') { if (c.espalmada < 0) { c.espalmada = m.tick; c.gk = e.id; } } else c.segura = true; }
        break;
      // o chute que bate no corpo de outro antes da defesa (também no MESMO passo do chute, depois dele na lista) não é
      // espalmada nem chute fora (só a trave vale); o 1º corpo, se é de um adversário de linha, é o lance 'bloqueio'
      // (28/10; antes `m.tick > c.tick` nem via o bloqueio da perna, que é no passo do chute)
      case 'bateuCorpo':
        if (c.ativo && e.id !== c.id && (m.tick > c.tick || chuteAqui) && c.espalmada < 0) {
          c.bloqueado = true;
          if (c.prim < 0) {
            const q = quemTime(m, e.id);
            c.prim = m.tick; c.primId = e.id; c.primAdv = !!q && q.time !== c.time && q.posicao !== 'GOL';
          }
        }
        break;
      case 'falta': guardarFalta(L, m, e); break;
      case 'cartao': if (e.cor === 'vermelho') { if (!cartaoV) cartaoV = e; } else if (!e.segundo && !cartaoA) cartaoA = e; break;
      case 'penaltiMarcado': penalti = true; break;
      case 'impedimento': imped = true; break;
      default: break;
    }
  }
  // o chute cruzou a linha de fundo que ele ataca (sem gol): onde, perto da armação?
  const bA = L.bAnt;
  if (c.ativo && c.cruzou < 0 && bA.ok && m.tick > c.tick) {
    const X = CAMPO.meioX, u0 = bA.x * c.lado, u1 = b.x * c.lado;
    if (u0 < X && u1 >= X) {
      const t = (X - u0) / ((u1 - u0) || 1);
      const zc = bA.z + (b.z - bA.z) * t, yc = bA.y + (b.y - bA.y) * t;
      c.cruzou = m.tick; c.dist = distArmacao(zc, yc);
    }
  }
  bA.x = b.x; bA.y = b.y; bA.z = b.z; bA.ok = true;
  // gol, intervalo, fim: nada do que estava guardado vale para a próxima parada (o gol tem o replay dele)
  if (gol || (p.estado !== 'jogo' && p.estado !== 'parada')) { limparDesdeMorta(L); return null; }
  const pr = m.parada;
  if (p.estado !== 'parada' || !pr || pr.cobrador != null || pr.inicio !== m.tick) return null;
  // bola morta neste passo: o lance (o impedimento já tem o replay dele no apito: um replay por parada)
  const lance = imped ? null : classificar(L, m, pr, cartaoV, cartaoA, penalti);
  limparDesdeMorta(L);
  L.lance = lance;
  return lance;
}

function preencher(L, m, pr, tipo, chave, fim, time, x, z, lado, id0, id1, ateMax) {
  const l = L._lance;
  // o expulso sai do mundo no passo da bola morta: com a falta no MESMO passo (vermelho direto, 2º amarelo sem vantagem,
  // pênalti com vermelho), o último passo desenhado com ele é o contato
  if (ateMax != null) { if (chave > ateMax) chave = ateMax; if (fim > ateMax) fim = ateMax; }
  l.tipo = tipo; l.classe = CLASSE_A.has(tipo) ? 'A' : 'B'; l.peso = PESO[tipo];
  l.chave = chave; l.fim = fim; l.morta = m.tick; l.ateMax = ateMax; l.time = time; l.x = x; l.z = z; l.lado = lado >= 0 ? 1 : -1;
  l.ids.length = 0; if (id0 != null && id0 >= 0) l.ids.push(id0); if (id1 != null && id1 >= 0) l.ids.push(id1);
  l.parada = pr.tipo;
  return l;
}

/**
 * O lance mais forte da bola morta (pênalti > vermelho > trave > amarelo > falta perto > espalmada > bloqueio > passou
 * perto > chute fora).
 */
function classificar(L, m, pr, cartaoV, cartaoA, penalti) {
  const R = REPLAY_PARADA, c = L.chute, agora = m.tick, morta = s60(R.chance.mortaAte);
  // o expulso sai do mundo neste passo (partida.js expulsar): o replay acaba no passo antes
  const ateMax = cartaoV ? agora - 1 : null;
  if (penalti && pr.tipo === 'penalti') {
    const f = faltaRecente(L, null, pr.time);
    if (f) return preencher(L, m, pr, 'penalti', f.tick, f.tick, f.time, f.x, f.z, m.ataca[f.time], f.def, f.id, ateMax);
  }
  if (cartaoV) {
    const f = faltaRecente(L, cartaoV.id, null);
    if (f) return preencher(L, m, pr, 'vermelho', f.tick, f.tick, f.time, f.x, f.z, m.ataca[f.time], f.def, f.id, ateMax);
  }
  const tr = L.trave;
  if (tr.tick >= 0 && agora - tr.tick <= morta) {
    const comChute = c.ativo && c.tick <= tr.tick && tr.tick - c.tick <= morta;
    const lado = tr.x >= 0 ? 1 : -1;
    const time = comChute ? c.time : (m.ataca[0] === lado ? 0 : 1);
    return preencher(L, m, pr, 'trave', comChute ? c.tick : tr.tick, tr.tick, time, tr.x, tr.z, lado, comChute ? c.id : -1, -1, ateMax);
  }
  if (cartaoA) {
    const f = faltaRecente(L, cartaoA.id, null);
    if (f) return preencher(L, m, pr, 'amarelo', f.tick, f.tick, f.time, f.x, f.z, m.ataca[f.time], f.def, f.id, ateMax);
  }
  if (pr.tipo === 'tiroLivre' && pr.direto) {
    const f = faltaRecente(L, null, pr.time);
    if (f) {
      // do ponto da cobrança (onde o jogo monta a barreira: bolas-paradas.js barreiraDoTiroLivre, a mesma conta)
      const lado = m.ataca[pr.time] >= 0 ? 1 : -1;
      if (MD.hypot(lado * CAMPO.meioX - pr.x, pr.z) <= R.faltaPerto) return preencher(L, m, pr, 'faltaPerto', f.tick, f.tick, f.time, f.x, f.z, lado, f.def, f.id, ateMax);
    }
  }
  const recente = c.ativo && !c.segura && agora - c.tick <= morta, criterio = c.area || c.v >= R.chance.vMin;
  const chance = recente && !c.bloqueado;
  if (chance && c.espalmada >= 0 && criterio) {
    return preencher(L, m, pr, 'espalmada', c.tick, c.espalmada, c.time, c.x, c.z, c.lado, c.id, c.gk, ateMax);
  }
  // bloqueado: o 1º corpo depois do chute é de um adversário de linha (a defesa que vem depois não muda o lance) e a bola
  // morreu em escanteio
  if (recente && c.primAdv && criterio && pr.tipo === 'escanteio') {
    return preencher(L, m, pr, 'bloqueio', c.tick, c.prim, c.time, c.x, c.z, c.lado, c.id, c.primId, ateMax);
  }
  if (chance && c.espalmada < 0 && c.area && c.cruzou >= 0 && c.dist <= R.chance.perto) {
    return preencher(L, m, pr, 'passouPerto', c.tick, c.cruzou, c.time, c.x, c.z, c.lado, c.id, -1, ateMax);
  }
  // o chute de dentro da área que saiu pela linha de fundo sem ninguém mais tocar (o último toque é o de quem chutou —
  // partida.js atualizarUltimoToque: nem o cabeceio de um companheiro no caminho): tiro de meta. (28/10) Só o de DENTRO da
  // área, não o critério da espalmada e do bloqueio (área OU ≥ chance.vMin m/s): a TV repete 72% de todo chute fora que
  // vira tiro de meta (SoccerNet-v2, 2551/3560), de qualquer distância, mas o orçamento do ar do dono (≤ 16% com 3,5 gols
  // por partida) não comporta o forte de fora — com ele o teto do ar ia a 15,8 / 15,9 / 16,3% nas sementes 1–48, 201–248
  // e 301–348 (só da área: 15,5 / 15,5 / 16,1%; o jogo repete 35–52% desses tiros de meta, a TV 69,0%; PLANO-CENAS.md §2.7)
  if (chance && c.espalmada < 0 && c.area && c.cruzou >= 0 && pr.tipo === 'tiroDeMeta' && m.partida.ultimoId === c.id) {
    return preencher(L, m, pr, 'chuteFora', c.tick, c.cruzou, c.time, c.x, c.z, c.lado, c.id, -1, ateMax);
  }
  return null;
}

/**
 * O lance aceito vira replay? A classe A (pênalti, vermelho, trave) sempre; a B só dentro do teto por tempo
 * (REPLAY_PARADA.porTempo) e com ≥ `espaco` s de bola rolando desde o último replay automático. o = {tempo, ligado}.
 */
export function decidirReplay(L, lance, o = {}) {
  if (!lance || o.ligado === false) return false;
  if (lance.classe === 'A') return true;
  const t = (o.tempo ?? L.tempo) === 2 ? 1 : 0;
  if (L.porTempo[t] >= REPLAY_PARADA.porTempo) return false;
  return L.rolando >= s60(REPLAY_PARADA.espaco);
}

/** Um replay automático passou (tipo 'gol' | 'impedimento' | 'parada'): o espaço recomeça; a parada conta no teto. */
export function registrarReplay(L, tick, tipo) {
  L.rolando = 0; L.ultimoTick = tick; L.ultimoTipo = tipo;
  if (tipo === 'parada') L.porTempo[L.tempo === 2 ? 1 : 0]++;
}

/**
 * O PRÓXIMO passo monta a bola parada? A mesma conta do partida.js regrasPartida, sem escrever nada: com o estado
 * 'parada' e a bola morta (sem cobrador), o fim do tempo vem ANTES da montagem (o relógio não para nas bolas paradas:
 * 'fimDoTempo') e a montagem sai quando a bola ficou PARTIDA.foraEspera s morta ('monta'); senão false.
 * (Acréscimo ainda não anunciado: o anúncio é no próprio passo e tem ≥ 1 min — com ticksPorTempo ≥ 23 o tempo não acaba
 * nele; abaixo disso, ?min ridículo, vale a conta com 1 min.) Teste: teste-replay-paradas P5.
 */
export function montaNoProximoPasso(m) {
  const p = m.partida, pr = m.parada;
  if (!p || p.estado !== 'parada' || !pr || pr.cobrador != null) return false;
  const t1 = m.tick + 1, T = p.ticksPorTempo;
  if (t1 - p.tick0Tempo >= T) {
    const ta = Math.round((p.acrescimo || 1) * T / 45);
    if (t1 - p.tick0Tempo >= T + ta) return 'fimDoTempo';
  }
  return t1 - pr.inicio >= s60(PARTIDA.foraEspera) ? 'monta' : false;
}
