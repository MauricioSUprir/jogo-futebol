// Cena do CARTÃO (pedido do dono de 22/10: "as cenas de cartões"; antes, 12/10: "cartão amarelo (3 cenas diferentes) e
// cartão vermelho (outras 3 cenas diferentes)"; PLANO-CENAS.md §3). PURA: sem three.js nem DOM, sem m.rng e sem
// Math.random — testada em Node (tools/teste-cenas.mjs, seções A, B, E e G) e desenhada pela página (main.js) no lugar
// dos jogadores da simulação, com o laço PARADO no tick do cartão (a simulação continua do mesmo tick depois: o hash não
// muda). FORA do fecho do hash; chega sob demanda (main.js SOB.cenas). Contrato em CONTRATOS.md ("Cenas das paradas");
// pesquisa em PESQUISA-CENAS-TV.md; constantes em js/cenas-config.js CENA_CARTAO.
//
// No tick do cartão os 22 (e o expulso, de m.expulsos) são COPIADOS para o mundo da cena (cena-atores.js) e o ÁRBITRO
// (criarJogador 200, uniforme 'arbitro') entra: começa a 6–8 m do punido, do lado da bola ou do centro, e anda
// (pré-rolagem invisível) até faltar CENA_CARTAO.arbitro.preRolagem m; no 1º quadro ele chega correndo (5,5 m/s; 6,5 na
// força excessiva e no DOGSO), para a 2,0–2,8 m do punido, de frente ("reasonable distance", US Soccer p. 38), tira o
// cartão do bolso (amarelo: o da frente da camisa; vermelho: o de trás do calção) e mostra com o braço RETO acima da
// cabeça por 1,3 s, apontando o punido com a outra mão. 2º amarelo: o amarelo 1,0 s, guarda, o vermelho 1,2 s.
// Quem não é do lance freia e fica parado respirando; nas cenas do IFAB ("only the captain": A1, V2) quem não é o
// capitão nem o punido fica a ≥ 4 m do árbitro.
//
// Variações (a reação muda, não só a câmera), escolhidas por hashGol(tick, id) sem repetir a anterior da mesma cor:
//   amarelo  A1 'abertos'    braços abertos e 2 passos para o árbitro, balançando a cabeça; o capitão entra entre os
//                            dois com a mão no ombro dele; o árbitro afasta (IFAB);
//            A2 'cabeca'     mãos na cabeça olhando o céu, vira de costas e anda; um companheiro dá tapinhas nas costas;
//            A3 'aceita'     mão erguida de desculpa e 2 acenos; volta trotando para a vaga sem olhar para trás;
//   vermelho V1 'cabisbaixo' cabeça baixa, braços soltos, sai devagar; um companheiro dá tapinhas; entra no túnel;
//            V2 'segurado'   avança apontando o árbitro; o capitão segura pelo peito e empurra para trás; o árbitro
//                            recua um passo e afasta; sai abanando a mão;
//            V3 'rosto'      as mãos na frente do rosto ("puxa a camisa", sem pano) e, perto da linha, palmas para a
//                            própria torcida (a torcida responde).
// A1, A2, V1 e V2 precisam de um companheiro a ≤ 15 m (sem ele, só A3 / V3).
// Planos (cortes secos; o nome muda = corte): amarelo 'arbitro' → 'reacao' → 'anota' (≈ 5,45 s); vermelho 'arbitro' →
// 'reacao' → 'saida' → 'tunel' (ELIPSE: o expulso reaparece a 10–14 m do túnel e termina fora do campo, z > 34) →
// 'torcida' (≈ 8,9 s; 2º amarelo +1,0 s). Nada é alocado por tick.
// Os treinadores (tecnicos.js treinadorDoTime, ids 210/211; PLANO-CENAS.md R1) entram como CÓPIAS paradas na área técnica
// (opc.treinadores): os vivos da página não andam nem são desenhados durante a cena — se andassem, o 1º passo gravado
// depois dela viraria corte no anel (REPLAY.saltoTecnico) e o replay da falta não atravessaria o corte.
import { PASSO, CAMPO } from './config.js';
import { CENA_CARTAO, CENAS } from './cenas-config.js';
import {
  criarBase, adicionarJogador, adicionarArbitro, adicionarNovo, poseInicial, passoSozinho, recriarAtor, soltar, para, irPara, parar, levar,
  desviar, passoAtores, avancarCom, tempoDe, planoNoTempo, escolherVariante, hashGol, camValida, melhorCamera,
  definirPlano, definirPlanoGrupo, criarPlanoCena, clamp, suave, lerp, janela, s60, J, TOPO_CABECA, caberNoQuadro,
  fugirDaLente, passoSozinho as andarSozinho, marcarBola,
  gTiraAmarelo, gTiraVermelho, gCartao, gAponta, gAnota, gAfasta, gAbertos, gCabeca, gDesculpa, gSegura, gTapinha,
  gAbana, gRosto, gPalmasAlto, posturaCabisbaixo, cabecaCeu, balancaCabeca,
} from './cena-atores.js';
import { cameraDoPlano } from './prejogo-roteiro.js';
import { maoEm } from './comemoracao.js';
import { posicaoTatica } from './tatica.js';

const K = CENA_CARTAO;
const MX = CAMPO.meioX, MZ = CAMPO.meioZ;
const TUNEL = CENAS.tunel;

export const AMARELOS = ['abertos', 'cabeca', 'aceita'];
export const VERMELHOS = ['cabisbaixo', 'segurado', 'rosto'];
const COM_APOIO = { abertos: true, cabeca: true, cabisbaixo: true, segurado: true };
const IFAB = { abertos: true, segurado: true };

// ------------------------------------------------------------------------------------------------ plano
/**
 * O cartão que ganha a cena entre os eventos 'cartao' do passo: o mais grave (vermelho > amarelo; empate pelo id menor).
 * O 2º amarelo (dois eventos do mesmo jogador: o amarelo com segundo e o vermelho 'segundoAmarelo') vira UM vermelho com
 * segundo = true. Devolve {id, time, cor, segundo, motivo, outros: [{id, cor}]} ou null.
 */
export function escolherCartao(eventos) {
  const por = new Map();
  for (const e of eventos) {
    if (!e || e.tipo !== 'cartao') continue;
    let p = por.get(e.id);
    if (!p) { p = { id: e.id, time: e.time, cor: 'amarelo', segundo: false, motivo: e.motivo }; por.set(e.id, p); }
    if (e.cor === 'vermelho') { p.cor = 'vermelho'; if (e.segundo || e.motivo === 'segundoAmarelo') p.segundo = true; else p.motivo = e.motivo; }
    else if (e.segundo) p.segundo = true;
  }
  const lista = [...por.values()];
  if (!lista.length) return null;
  lista.sort((a, b) => (b.cor === 'vermelho' ? 1 : 0) - (a.cor === 'vermelho' ? 1 : 0) || a.id - b.id);
  const c = lista[0];
  c.outros = lista.slice(1).map(x => ({ id: x.id, cor: x.cor }));
  return c;
}

/** O jogador punido: em campo (amarelo) ou o último expulso com esse id (vermelho). */
function acharPunido(m, id) {
  for (const j of m.jogadores) if (j.id === id) return j;
  const ex = m.expulsos ?? [];
  for (let i = ex.length - 1; i >= 0; i--) if (ex[i].id === id) return ex[i];
  return null;
}

/**
 * Onde o punido para (a freada dele: v²/2a) dentro do campo; com bp (a bola parada no chão), sem passar dela
 * (separarDaBola segura o centro dele a CENAS.bola dela).
 */
function paradaPrevista(j, out, bp = null) {
  const v = Math.hypot(j.vx, j.vz);
  let d = v > 0.05 ? (v * v) / (2 * 5.5) : 0;
  if (d > 0 && bp && bp.y < 0.6) {
    const ux = j.vx / v, uz = j.vz / v, ex = bp.x - j.x, ez = bp.z - j.z;
    const r = Math.min(CENAS.bola, Math.max(0, Math.hypot(ex, ez) - 0.01)), u = ex * ux + ez * uz, w2 = ex * ex + ez * ez - u * u;
    if (u > 0 && w2 < r * r) d = Math.min(d, Math.max(0, u - Math.sqrt(r * r - w2)));
  }
  out.x = clamp(j.x + (v > 0.05 ? (j.vx / v) * d : 0), -MX + 1.5, MX - 1.5);
  out.z = clamp(j.z + (v > 0.05 ? (j.vz / v) * d : 0), -MZ + 1.5, MZ - 1.5);
  return out;
}

const _pp = { x: 0, z: 0 };
/**
 * Plano da cena (só LÊ o mundo). cartao = escolherCartao(...). opc = {ultimaAmarelo, ultimaVermelho, variante (força:
 * testes), timeHumano, posAntes(id) → {x, z} | null (o expulso saiu do mundo no passo do cartão: a posição DESENHADA no
 * tick anterior, pelo anel do replay — como a cena de substituição), treinadores: [{id, time, x, z, rumo, kit} | null, …]
 * (tecnicos.js treinadorDoTime; cópias paradas na área técnica), ajustePlano (a planta do estádio de forma própria:
 * ajustarPlano — os trilhos de torcida dele)}. Devolve {tick, id, time, cor, segundo, motivo, forte, variante, apoio,
 * disponiveis, excluidas, arb: {x0, z0, x1, z1, theta, dPara}, saida: {x, z}, planos: [{nome, t0, t1}], duracao, tempos,
 * hash, posPunido, treinadores, ajustePlano} ou null.
 */
export function planejarCartao(m, cartao, opc = {}) {
  if (!cartao) return null;
  const j = acharPunido(m, cartao.id);
  if (!j) return null;
  // o expulso (fora de m.jogadores): onde ele foi desenhado no tick anterior (a diferença é de um passo; nunca um salto)
  let posPunido = null;
  if (!m.jogadores.includes(j) && typeof opc.posAntes === 'function') {
    const q = opc.posAntes(j.id);
    if (q && Number.isFinite(q.x) && Number.isFinite(q.z) && Math.hypot(q.x - j.x, q.z - j.z) < 2) posPunido = { x: q.x, z: q.z };
  }
  const vermelho = cartao.cor === 'vermelho', segundo = vermelho && !!cartao.segundo;
  const h = hashGol(m.tick, j.id);
  // o companheiro mais perto (de linha), a ≤ CENA_CARTAO.companheiro m
  let apoio = null, dm = Infinity;
  for (const q of m.jogadores) {
    if (q.time !== j.time || q.id === j.id || q.posicao === 'GOL') continue;
    const d = Math.hypot(q.x - j.x, q.z - j.z);
    if (d < dm) { dm = d; apoio = q; }
  }
  const temApoio = !!apoio && dm <= K.companheiro;
  const lista = vermelho ? VERMELHOS : AMARELOS;
  const disponiveis = lista.filter(v => temApoio || !COM_APOIO[v]);
  const excluidas = lista.filter(v => !disponiveis.includes(v));
  const variante = opc.variante && disponiveis.includes(opc.variante)
    ? opc.variante : escolherVariante(m.tick, j.id, vermelho ? (opc.ultimaVermelho ?? null) : (opc.ultimaAmarelo ?? null), disponiveis);
  const forte = cartao.motivo === 'forcaExcessiva' || cartao.motivo === 'dogso';
  // o árbitro: chega do lado da bola (ou do centro), de preferência do lado de lá do punido (a câmera do plano 'arbitro'
  // fica do lado da TV, sobre o ombro dele: ninguém atravessa a linha dos 180°); para a dPara m dele, dentro do campo
  const P = paradaPrevista(posPunido ? { x: posPunido.x, z: posPunido.z, vx: j.vx, vz: j.vz } : j, _pp), px = P.x, pz = P.z;
  const b = m.bola.p;
  let rx = b.x - px, rz = b.z - pz;
  if (Math.hypot(rx, rz) < 2) { rx = -px; rz = -pz; }
  if (Math.hypot(rx, rz) < 1) { rx = 0; rz = -1; }
  const thPref = Math.atan2(rz, rx);
  const dPara = lerp(K.arbitro.para[0], K.arbitro.para[1], ((h >>> 3) & 1023) / 1023);
  const dIni = lerp(K.arbitro.distIni[0], K.arbitro.distIni[1], ((h >>> 13) & 1023) / 1023);
  let melhor = null, nota = -Infinity;
  for (let k = 0; k < 24; k++) {
    const th = (k / 24) * 2 * Math.PI;
    const cx = Math.cos(th), cz = Math.sin(th);
    const sx = px + cx * dPara, sz = pz + cz * dPara, ax = px + cx * dIni, az = pz + cz * dIni;
    if (Math.abs(sx) > MX - 0.6 || Math.abs(sz) > MZ - 0.6) continue;
    if (Math.abs(ax) > MX + 2 || Math.abs(az) > MZ + 2) continue;
    // a câmera do plano 'arbitro' (do árbitro, passando pelo punido): dentro dos limites e fora dos sólidos
    const C = K.camera.arbitro;
    let camOk = 0;
    for (const s of [1, -1]) {
      const a2 = Math.atan2(pz - sz, px - sx) + s * C.ang;
      const qx = sx + Math.cos(a2) * C.dist, qz = sz + Math.sin(a2) * C.dist;
      if (camValida(qx, C.altura, qz) && Math.abs(qx) <= MX + 3 && Math.abs(qz) <= MZ + 4) camOk++;
    }
    let n = Math.cos(th - thPref) * 1.0 + (-cz) * 0.9 + camOk * 0.6;
    if (!camOk) n -= 5;
    // (nem em cima da bola parada: ninguém passa por cima dela — cena-atores.js separarDaBola)
    if (b.y < 0.6 && Math.hypot(sx - b.x, sz - b.z) < CENAS.bola + 0.5) n -= 3;
    if (n > nota) { nota = n; melhor = { th, sx, sz, ax, az }; }
  }
  if (!melhor) {
    const th = Math.atan2(-pz, -px);
    melhor = { th, sx: clamp(px + Math.cos(th) * dPara, -MX + 1, MX - 1), sz: clamp(pz + Math.sin(th) * dPara, -MZ + 1, MZ - 1), ax: px + Math.cos(th) * dIni, az: pz + Math.sin(th) * dIni };
  }
  // tempos (s): tira, cartão no alto, guarda; o 2º amarelo: amarelo, guarda, vermelho
  const T = {};
  T.tira = K.tira; T.alto = K.tira + K.tiraDur;
  if (segundo) {
    T.altoFim1 = T.alto + K.segundo.alto1; T.tira2 = T.altoFim1 + K.segundo.guarda; T.alto2 = T.tira2 + K.tiraDur;
    T.altoFim = T.alto2 + K.segundo.alto2;
  } else T.altoFim = T.alto + K.alto;
  const def = K.planos[segundo ? 'segundo' : cartao.cor];
  const planos = [];
  let t = 0;
  for (const [nome, d] of def) { planos.push({ nome, t0: t, t1: t + d }); t += d; }
  T.reacao = planos[1].t0;
  T.fimReacao = planos[1].t1;
  // a saída do expulso: a lateral do lado do túnel (z +), na direção do meio
  const saida = { x: clamp(px * 0.65, -38, 38), z: MZ + 1.2 };
  return {
    tick: m.tick, id: j.id, time: j.time, cor: cartao.cor, segundo, motivo: cartao.motivo, forte, variante,
    apoio: temApoio ? apoio.id : null, apoioDist: apoio ? dm : Infinity, disponiveis, excluidas, outros: cartao.outros ?? [],
    arb: { x0: melhor.ax, z0: melhor.az, x1: melhor.sx, z1: melhor.sz, theta: melhor.th, dPara, dIni },
    parada: { x: px, z: pz }, saida, planos, duracao: t, tempos: T, hash: h, timeHumano: opc.timeHumano ?? 0,
    posPunido, treinadores: (opc.treinadores ?? []).filter(Boolean).map(o => ({ ...o })),
    // o estádio de forma própria (TM, edição pro): a câmera dos trilhos de torcida do pré-jogo dele (estadio-planta.js /
    // estadio-generico.js ajustarPlano; a página passa IDENT.forma3d.planta.ajustarPlano)
    ajustePlano: typeof opc.ajustePlano === 'function' ? opc.ajustePlano : null,
    // o cartão da vantagem que virou gol: o mundo do gol + 149 tem todos voltando correndo para a saída (≈ 8 m/s)
    assentar: m.partida?.estado === 'gol',
  };
}

// ------------------------------------------------------------------------------------------------ cena
/**
 * Cena a partir do mundo no tick do cartão (só LÊ o mundo: cópias). plano = planejarCartao(...). O árbitro anda a
 * pré-rolagem aqui, uma vez.
 */
export function criarCenaCartao(plano, m) {
  const c = criarBase(m);
  c.plano = plano;
  c.kFim = s60(plano.duracao);
  for (const j of m.jogadores) adicionarJogador(c, j, 'resto');
  let pun = c.porId.get(plano.id);
  if (!pun) {
    pun = adicionarJogador(c, acharPunido(m, plano.id), 'resto');
    if (plano.posPunido) levar(pun.j, plano.posPunido.x - pun.j.x, plano.posPunido.z - pun.j.z);
  }
  // os treinadores (cópias paradas na área técnica, olhando o lance; ninguém os empurra)
  c.treinadores = [];
  for (const o of plano.treinadores ?? []) {
    const a = adicionarNovo(c, o, 'tecnico');
    a.cede = 0;
    c.treinadores.push(a);
  }
  // (o punido não é empurrado por quem passa: quem chega perto dele cede — V1 anda a ≤ 1,4 m/s)
  pun.tipo = 'punido'; pun.cede = 0; pun.podeFixar = false;
  c.punido = pun;
  // ELIPSE do gol (a vantagem que virou gol): a cena começa num corte depois da comemoração, e na TV o árbitro mostra o
  // cartão com os jogadores já parados — eles freiam FORA do quadro (a mesma locomoção, com a separação), antes do 1º plano
  // (sem isso, a lente de todo plano ficava no caminho de quem ainda vinha correndo)
  if (plano.assentar) { marcarBola(c); assentar(c, s60(K.assentar)); }
  c.apoio = plano.apoio != null ? c.porId.get(plano.apoio) ?? null : null;
  if (c.apoio) {
    c.apoio.tipo = 'apoio'; c.apoio.podeFixar = false; c.apoio.cede = 0.4;
    // o capitão/companheiro longe (até 15 m) já vem correndo: pré-rolagem invisível até faltar CENA_CARTAO.apoioPerto m
    // (no 1º quadro ele já está chegando; o V2 segura o punido ≥ 0,8 s)
    const q = c.apoio.j, pj = pun.j;
    for (let t = 0; t < 300; t++) {
      const ex = pj.x - q.x, ez = pj.z - q.z, d = Math.hypot(ex, ez);
      if (d <= K.apoioPerto) break;
      andarSozinho(q, c.mF, ex / d, ez / d, 6.2, Math.atan2(ez, ex));
    }
  }
  // o árbitro: do ponto de partida, anda sozinho até faltar `preRolagem` m para o ponto onde para
  const A = plano.arb;
  const arb = adicionarArbitro(c, CENAS.idArbitro, A.x0, A.z0, Math.atan2(A.z1 - A.z0, A.x1 - A.x0));
  arb.podeFixar = false; arb.cede = 0.15;
  c.arbitro = arb;
  const vel = plano.forte ? K.arbitro.velForte : K.arbitro.vel;
  {
    const j = arb.j;
    for (let t = 0; t < 400; t++) {
      const ex = A.x1 - j.x, ez = A.z1 - j.z, d = Math.hypot(ex, ez);
      if (d <= K.arbitro.preRolagem) break;
      passoSozinho(j, c.mF, ex / d, ez / d, vel, Math.atan2(ez, ex));
    }
    c.mF.tick = m.tick;
  }
  // a bola parada: ninguém passa por cima dela (quem começou mais perto que CENAS.bola fica no máximo onde está)
  marcarBola(c);
  // quem fica perto do árbitro sai do caminho (as cenas do IFAB: ≥ 4 m; nas outras um pouco): o ponto de cada um é
  // refeito a cada tick pelo árbitro de agora (desejo)
  c.limAfasta = IFAB[plano.variante] ? K.afasta : K.afastaLeve;
  // (o alvo de cada um nasce onde ele vai parar — a freada dele, v²/2a: a câmera de cada plano é escolhida com a lente
  // longe de onde ele está, de onde vai parar e do caminho até lá; na vantagem que virou gol, o mundo do gol + 149 tem
  // todos andando de volta para a saída e a lente parava no caminho de quem ainda vinha)
  for (const a of c.atores) {
    if (a.tipo === 'tecnico' || a === arb) { a.alvoX = a.j.x; a.alvoZ = a.j.z; }
    else { paradaPrevista(a.j, _pp); a.alvoX = _pp.x; a.alvoZ = _pp.z; }
    if (a.tipo === 'resto') a.afasta = false;
  }
  // a vaga do A3 (a posição tática da cópia) e a direção da saída do expulso
  c.vagaA3 = vagaAceita(c, m);
  // (as câmeras escolhidas depois deixam a lente fora do caminho dele até a vaga)
  if (plano.variante === 'aceita') { pun.alvoX = c.vagaA3.x; pun.alvoZ = c.vagaA3.z; }
  for (const a of c.atores) poseInicial(c, a);
  c.ip = -1;
  entrarPlano(c, 0);
  c.alto = 0; c.corAlto = null; c.cartaoNoAlto = false;
  c.mao = { x: 0, y: 0, z: 0 };
  c.apoioToca = 0; c.empurra = 0; c.avancou = 0; c.recuou = 0; c.palmas = false;
  return c;
}

const _semGestos = () => {};
const _desejoParar = (c, a) => parar(c, a);
/** Os atores freiam até parar fora do quadro (n ticks no máximo; acaba antes se todos pararam) e a cena volta ao tick 0. */
function assentar(c, n) {
  for (let i = 0; i < n; i++) {
    passoAtores(c, _desejoParar, _semGestos);
    let anda = false;
    for (const a of c.atores) if (Math.hypot(a.j.vx, a.j.vz) > 0.05) { anda = true; break; }
    if (!anda) break;
  }
  c.k = 0; c.recriados.length = 0;
  for (const a of c.atores) if (a.fixo) a.tFixo = 0;
}

/** Para onde o punido do A3 volta trotando: a posição tática dele (se ela fica longe do árbitro), senão a própria meta. */
function vagaAceita(c, m) {
  const p = c.punido.j, A = c.plano.arb;
  const ax = p.x - A.x1, az = p.z - A.z1, al = Math.hypot(ax, az) || 1;
  let tx = null, tz = null;
  const tm = m.times?.[p.time];
  if (tm && p.vagaId) {
    try {
      const q = posicaoTatica(tm.formacao, p.vagaId, tm.tatica, m.bola.p, 'sem', m.ataca[p.time], { x: 0, z: 0 });
      const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      if (d > 8 && (dx * ax + dz * az) / (d * al) > 0.35) { tx = q.x; tz = q.z; }
    } catch (_) { /* sem tática: a própria meta */ }
  }
  if (tx == null) {
    // a própria meta, puxada para longe do árbitro
    const gx = -(m.ataca?.[p.time] ?? 1) * MX;
    let dx = gx - p.x, dz = -p.z;
    const d = Math.hypot(dx, dz) || 1;
    dx = dx / d + (ax / al) * 0.9; dz = dz / d + (az / al) * 0.9;
    const l = Math.hypot(dx, dz) || 1;
    tx = p.x + (dx / l) * 22; tz = p.z + (dz / l) * 22;
  }
  return { x: clamp(tx, -MX + 3, MX - 3), z: clamp(tz, -MZ + 3, MZ - 3) };
}

// ------------------------------------------------------------------------------------------------ desejos
const _q = { x: 0, z: 0 }, _ev = { x: 0, z: 0, r: 0 };
/** Onde o capitão/companheiro fica em relação ao punido (frente/lado no referencial do punido → árbitro). */
function pontoApoio(c, f, l, out) {
  const p = c.punido.j, A = c.arbitro.j;
  let ux = A.x - p.x, uz = A.z - p.z;
  const d = Math.hypot(ux, uz) || 1; ux /= d; uz /= d;
  const sg = c.ladoApoio ?? 1;
  out.x = p.x + ux * f - uz * l * sg; out.z = p.z + uz * f + ux * l * sg;
  // (a bola parada no ponto: separarDaBola o segurava encostado nela, a 1,28 m do punido — o ponto gira em volta do punido,
  // à mesma distância, até a borda dela, para o lado do árbitro; só depois que ele encosta na bola DESSE lado (do outro, o
  // caminho até o ponto girado passava pelo vão fechado entre a bola e o punido e ele ficava colado nas costas do punido) e,
  // daí em diante, sempre para esse lado)
  const bp = c.mF.bola.p, ap = c.apoio, bx = bp.x - p.x, bz = bp.z - p.z, b = Math.hypot(bx, bz), r = Math.hypot(f, l);
  if (ap && bp.y < 0.6 && b > 0.05) {
    const cos0 = (r * r + b * b - (ap.bolaMin + 0.1) ** 2) / (2 * r * b);
    if (cos0 > -1 && cos0 < 1 && ((out.x - p.x) * bx + (out.z - p.z) * bz) / (r * b) > cos0) {
      const ab = Math.atan2(bz, bx), th0 = Math.acos(cos0), q = ap.j;
      const g = c.giroBola ?? (Math.cos(ab + th0) * ux + Math.sin(ab + th0) * uz >= Math.cos(ab - th0) * ux + Math.sin(ab - th0) * uz ? 1 : -1);
      if (c.giroBola != null || (Math.hypot(q.x - bp.x, q.z - bp.z) < ap.bolaMin + 0.05 && (bx * (q.z - p.z) - bz * (q.x - p.x)) * g > 0)) {
        c.giroBola = g;
        out.x = p.x + Math.cos(ab + g * th0) * r; out.z = p.z + Math.sin(ab + g * th0) * r;
      }
    }
  }
  return out;
}

/**
 * O árbitro: até guardar o cartão, o ponto dele acompanha o punido (dPara m dele, na direção da chegada: ele se ajeita
 * se o punido ainda anda); A1/V2: com o cartão guardado, recua um passo (0,5 m) e afasta o grupo; depois fica.
 */
function alvoArbitro(c, out) {
  const P = c.plano, T = P.tempos, t = c.k * PASSO, pun = c.punido.j, A = P.arb;
  const ux = Math.cos(A.theta), uz = Math.sin(A.theta);
  if (t <= T.altoFim + 0.05 || c.arbFixo == null) {
    let d = A.dPara;
    // (A1, V2: um passo para trás com o cartão ainda no alto — sem passar de 3,05 m do punido)
    if (IFAB[P.variante] && t >= T.reacao) d = Math.min(d + 0.5, 3.05);
    out.x = clamp(pun.x + ux * d, -MX - 1, MX + 1); out.z = clamp(pun.z + uz * d, -MZ - 1, MZ + 1);
    if (t > T.altoFim) c.arbFixo = { x: out.x, z: out.z };
    return out;
  }
  out.x = c.arbFixo.x; out.z = c.arbFixo.z;
  return out;
}

function desejo(c, a, t) {
  const P = c.plano;
  const arb = c.arbitro.j, pun = c.punido.j;
  if (a === c.arbitro) {
    alvoArbitro(c, _q);
    const ex = _q.x - arb.x, ez = _q.z - arb.z, dd = Math.hypot(ex, ez);
    // perto do ponto: anda (1,6 m/s), mas acompanha o punido que ainda freia (o ponto anda com ele)
    const vel = dd > 1.2 ? (P.forte ? K.arbitro.velForte : K.arbitro.vel) : Math.max(1.6, Math.hypot(pun.vx, pun.vz) + 1.2);
    const d = irPara(c, a, _q.x, _q.z, vel, Math.atan2(pun.z - arb.z, pun.x - arb.x), 0.08, K.arbitro.freio);
    // ajeitando-se perto do ponto: de frente para o punido (passo de lado), sem virar as costas
    if (dd < 1.0) d.rumo = Math.atan2(pun.z - arb.z, pun.x - arb.x);
    return d;
  }
  if (a === c.punido) return desejoPunido(c, a, t);
  // os treinadores ficam na área técnica (Regra 1), parados
  if (a.tipo === 'tecnico') return parar(c, a);
  // no plano do árbitro ninguém entra na frente do cartão (a reta da lente até o árbitro; o capitão também, enquanto chega)
  if (a === c.apoio) { const fl0 = foraDaLinha(c, a, 1.2); return fl0 ?? desejoApoio(c, a, t); }
  // quem está na frente da lente sai dela
  _ev.x = arb.x; _ev.z = arb.z; _ev.r = c.limAfasta + 0.7;
  const fl = fugirDaLente(c, a, undefined, _ev);
  if (fl) return desviar(c, a, fl);
  // os outros: quem está perto do árbitro sai (radial, para lim + 0,6 m dele); todos freiam e olham o lance
  const ex = a.j.x - arb.x, ez = a.j.z - arb.z, d = Math.hypot(ex, ez), lim = c.limAfasta;
  if (d < lim + 0.25 || (a.afasta && d < lim + 0.55)) {
    a.afasta = true; soltar(a);
    let ux = d > 0.05 ? ex / d : 1, uz = d > 0.05 ? ez / d : 0;
    // longe da reta árbitro–punido (não passa por cima do lance)
    const lx = pun.x - arb.x, lz = pun.z - arb.z, ll = Math.hypot(lx, lz) || 1;
    if ((ux * lx + uz * lz) / ll > 0.6) { const sg = ux * -lz + uz * lx >= 0 ? 1 : -1; ux = ux * 0.4 - (lz / ll) * sg; uz = uz * 0.4 + (lx / ll) * sg; const l = Math.hypot(ux, uz) || 1; ux /= l; uz /= l; }
    // fora do caminho do capitão que vem andando (à frente dele, a < 0,9 m da reta): sai de lado, para o lado longe do
    // árbitro (de frente, o desvio trocava de lado a cada tick e ele, que cede menos, empurrava o outro de volta para o árbitro)
    const ap = c.apoio?.j;
    if (ap) {
      const va = Math.hypot(ap.vx, ap.vz);
      if (va > 0.6) {
        const vx = ap.vx / va, vz = ap.vz / va, wx = a.j.x - ap.x, wz = a.j.z - ap.z;
        const fr = wx * vx + wz * vz, la = -wx * vz + wz * vx;
        if (fr > -0.2 && fr < 2.5 && Math.abs(la) < 0.9) {
          const sg = -vz * ex + vx * ez >= 0 ? 1 : -1;
          ux += -vz * sg * 1.5; uz += vx * sg * 1.5;
          const l = Math.hypot(ux, uz) || 1; ux /= l; uz /= l;
        }
      }
    }
    a.alvoX = arb.x + ux * (lim + 0.7); a.alvoZ = arb.z + uz * (lim + 0.7);
    return desviar(c, a, irPara(c, a, a.alvoX, a.alvoZ, K.velAfasta, Math.atan2(-ez, -ex), 0.1, 3));
  }
  a.afasta = false;
  const fl1 = foraDaLinha(c, a);
  if (fl1) return desviar(c, a, fl1);
  return parar(c, a, arb.x, arb.z);
}

/**
 * No plano do árbitro (a lente em c.camDe): quem está a menos de 0,75 m da reta da lente até o árbitro (entre os dois)
 * sai de lado — o cartão no alto nunca fica atrás de ninguém (perto do árbitro, a menos de minArb m, manda a roda do
 * IFAB). Devolve o desejo ou null.
 */
function foraDaLinha(c, a, minArb = c.limAfasta + 0.6) {
  if (!c.camDe || c.planoAgora !== 'arbitro') return null;
  const ar = c.arbitro.j, cx = c.camDe.x, cz = c.camDe.z;
  const sx = ar.x - cx, sz = ar.z - cz, l2 = sx * sx + sz * sz;
  if (l2 < 1) return null;
  const j = a.j, w = ((j.x - cx) * sx + (j.z - cz) * sz) / l2;
  if (w <= 0.05 || w >= 1.0) return null;
  // perto do árbitro manda a roda do IFAB (quem afasta) e o papel de quem está com ele
  if (Math.hypot(j.x - ar.x, j.z - ar.z) < minArb) return null;
  const qx = cx + sx * w, qz = cz + sz * w, ex = j.x - qx, ez = j.z - qz, d = Math.hypot(ex, ez);
  if (d >= 0.75) return null;
  soltar(a);
  const l = Math.sqrt(l2), nx = -sz / l, nz = sx / l, sg = d > 0.02 ? (ex * nx + ez * nz >= 0 ? 1 : -1) : 1;
  return irPara(c, a, qx + nx * sg * 1.0, qz + nz * sg * 1.0, 3.0, Math.atan2(ar.z - j.z, ar.x - j.x), 0.05, 4);
}

/** O destino de quem sai: a lateral do lado do túnel; depois da elipse, a frente do vão e a boca do túnel. */
function destinoSaida(c, out) {
  if (c.saidaTunel) {
    const j = c.punido.j;
    if (j.z < c.saidaTunel.z - 0.4) { out.x = c.saidaTunel.x; out.z = c.saidaTunel.z; }
    else { out.x = TUNEL.x; out.z = TUNEL.z + 2; }
    return out;
  }
  out.x = c.plano.saida.x; out.z = c.plano.saida.z;
  return out;
}

function desejoPunido(c, a, t) {
  const P = c.plano, T = P.tempos, v = P.variante, j = a.j, arb = c.arbitro.j;
  const rArb = Math.atan2(arb.z - j.z, arb.x - j.x);
  const tR = T.reacao;
  if (t < tR) return para(c, 0, rArb);
  const u = t - tR;
  switch (v) {
    case 'abertos': {
      // 2 passos para o árbitro (até K.a1.passos m do ponto onde parou, sem chegar a menos de 1,7 m dele), depois fica
      if (c.pA1 == null) c.pA1 = { x: j.x, z: j.z };
      const dx = arb.x - c.pA1.x, dz = arb.z - c.pA1.z, d = Math.hypot(dx, dz) || 1;
      const passo = Math.min(K.a1.passos, Math.max(0, d - 1.7));
      if (u < 1.4) return irPara(c, a, c.pA1.x + (dx / d) * passo, c.pA1.z + (dz / d) * passo, K.a1.vel, rArb, 0.08, 2.5);
      return para(c, 0, rArb);
    }
    case 'cabeca': {
      // mãos na cabeça (parado) e depois vira de costas e anda devagar
      if (u < 0.8) return para(c, 0, rArb);
      if (c.dirA2 == null) { const dx = j.x - arb.x, dz = j.z - arb.z, l = Math.hypot(dx, dz) || 1; c.dirA2 = { x: dx / l, z: dz / l, x0: j.x, z0: j.z }; }
      const D = c.dirA2;
      return desviar(c, a, irPara(c, a, D.x0 + D.x * K.a2.anda, D.z0 + D.z * K.a2.anda, K.a2.vel, Math.atan2(D.z, D.x), 0.1, 1.2));
    }
    case 'aceita': {
      // trota para a vaga a partir do cartão guardado, sem olhar para trás
      if (t < T.altoFim) return para(c, 0, rArb);
      const V = c.vagaA3;
      return desviar(c, a, irPara(c, a, V.x, V.z, K.a3.vel, null, 0.3, 4));
    }
    case 'cabisbaixo':
      destinoSaida(c, _q);
      return desviar(c, a, irPara(c, a, _q.x, _q.z, K.v1.vel, null, 0.2, 1.5));
    case 'segurado': {
      // avança apontando o árbitro; segurado pelo capitão, é empurrado para trás; depois sai abanando a mão
      if (c.pV2 == null) c.pV2 = { x: j.x, z: j.z, ux: Math.cos(rArb), uz: Math.sin(rArb) };
      const D = c.pV2;
      if (u < 0.95) {
        const d = Math.hypot(arb.x - D.x, arb.z - D.z);
        const passo = Math.min(K.v2.avanca, Math.max(0, d - 1.6));
        return irPara(c, a, D.x + D.ux * passo, D.z + D.uz * passo, K.v2.vel, rArb, 0.06, 2.5);
      }
      if (u < 2.25) {
        // empurrado: recua de frente para o árbitro, no passo de quem segura
        if (c.pV2b == null) c.pV2b = { x: j.x, z: j.z };
        const rx = c.pV2b.x - D.ux * (K.v2.recua + 0.2), rz = c.pV2b.z - D.uz * (K.v2.recua + 0.2);
        return irPara(c, a, rx, rz, 0.8, rArb, 0.05, 2.5);
      }
      destinoSaida(c, _q);
      return desviar(c, a, irPara(c, a, _q.x, _q.z, K.v2.vSai, null, 0.2, 1.5));
    }
    case 'rosto':
      destinoSaida(c, _q);
      return desviar(c, a, irPara(c, a, _q.x, _q.z, K.v3.vel, null, 0.2, 1.5));
    default:
      return para(c, 0, rArb);
  }
}

function desejoApoio(c, a, t) {
  const P = c.plano, T = P.tempos, v = P.variante, j = a.j, pun = c.punido.j;
  // depois da ELIPSE do túnel o expulso está a 30–60 m: o companheiro fica no campo olhando ele sair (antes atravessava o
  // campo em disparada atrás dele e entrava no quadro do túnel)
  if (c.saidaTunel) return parar(c, a, pun.x, pun.z);
  const rPun = Math.atan2(pun.z - j.z, pun.x - j.x);
  if (c.ladoApoio == null) {
    // de que lado do punido ele chega (o lado em que já está)
    const arb = c.arbitro.j;
    const ux = arb.x - pun.x, uz = arb.z - pun.z;
    c.ladoApoio = (j.x - pun.x) * -uz + (j.z - pun.z) * ux >= 0 ? 1 : -1;
  }
  const longe = Math.hypot(pun.x - j.x, pun.z - j.z);
  switch (v) {
    case 'abertos': {
      // entra entre os dois (do lado do árbitro), a ~0,9 m do punido, de frente para ele; vem correndo se está longe
      pontoApoio(c, K.a1.capitao * 0.8, K.a1.capitao * 0.55, _q);
      return desviar(c, a, irPara(c, a, _q.x, _q.z, longe > 4 ? 6.2 : K.a1.vCap, rPun, 0.08, 3.5));
    }
    case 'segurado': {
      // entre os dois, colado no punido (0,55 m), de frente para ele
      pontoApoio(c, 0.56, 0.05, _q);
      return desviar(c, a, irPara(c, a, _q.x, _q.z, longe > 4 ? 6.4 : 3.6, rPun, 0.04, 4));
    }
    case 'cabeca': case 'cabisbaixo': {
      // vai para o lado e um pouco atrás do punido (onde ele vai estar) e o acompanha
      const h = pun.rumo, fx = Math.cos(h), fz = Math.sin(h), rx = -fz, rz = fx;
      const sg = c.ladoApoio;
      _q.x = pun.x - fx * 0.34 + rx * 0.52 * sg + pun.vx * 0.15; _q.z = pun.z - fz * 0.34 + rz * 0.52 * sg + pun.vz * 0.15;
      const ex = _q.x - j.x, ez = _q.z - j.z, dq = Math.hypot(ex, ez);
      if (dq < 1.5) {
        // ao lado dele: acompanha a velocidade dele e corrige o resto
        const vx = pun.vx + ex * 1.6, vz = pun.vz + ez * 1.6, vv = Math.hypot(vx, vz);
        const d = c._d;
        if (vv < 0.05) return para(c, 0, h);
        d.dx = vx / vv; d.dz = vz / vv; d.vel = Math.min(vv, 3); d.rumo = h;
        // (a bola parada entre os dois: contorna — sem isso ele escorregava em volta dela e chegava depois do tapinha)
        return desviar(c, a, d);
      }
      return desviar(c, a, irPara(c, a, _q.x, _q.z, longe > 5 ? 5.5 : 3.4, null, 0.05, 3));
    }
    default:
      return parar(c, a, pun.x, pun.z);
  }
}

// ------------------------------------------------------------------------------------------------ gestos
function gestos(c, a, t) {
  const P = c.plano, T = P.tempos, v = P.variante, o = a.atu, h = a.j.rumo;
  if (a === c.arbitro) { gestosArbitro(c, a, t); return; }
  if (a === c.punido) {
    const u = t - T.reacao;
    switch (v) {
      case 'abertos': {
        const w = janela(t, T.reacao, T.reacao + 2.3, 0.25, 0.4);
        gAbertos(o, h, w);
        balancaCabeca(o, h, u, janela(t, T.reacao + 0.2, T.reacao + 1.7, 0.15, 0.2));
        break;
      }
      case 'cabeca': {
        const w = janela(t, T.reacao, T.reacao + 1.35, 0.25, 0.35);
        gCabeca(o, h, w);
        cabecaCeu(o, h, janela(t, T.reacao, T.reacao + 0.85, 0.2, 0.2) * 0.85);
        break;
      }
      case 'aceita': {
        const w = janela(t, T.alto + 0.5, T.altoFim, 0.2, 0.25);
        gDesculpa(o, h, w);
        balancaCabeca(o, h, t - T.alto - 0.5, janela(t, T.alto + 0.6, T.alto + 1.4, 0.05, 0.05), true);
        break;
      }
      case 'cabisbaixo':
        posturaCabisbaixo(o, h, suave(u / 0.45));
        break;
      case 'segurado': {
        // aponta o árbitro com o braço direito avançando; depois de sair, abana a mão
        const arb = c.arbitro.atu, ic = J.cabeca * 3;
        gAponta(o, h, 1, arb[ic], arb[ic + 1] - 0.15, arb[ic + 2], janela(t, T.reacao, T.reacao + 1.5, 0.2, 0.3));
        gAbana(o, h, u, janela(t, T.reacao + 2.3, 1e9, 0.3, 0.3));
        break;
      }
      case 'rosto': {
        const tb = c.plano.planos[3].t0;   // o túnel (P3b): solta o rosto e bate palmas para a torcida
        gRosto(o, h, janela(t, T.reacao, tb, 0.3, 0.05));
        gPalmasAlto(o, h, t, janela(t, tb + 0.35, 1e9, 0.3, 0.3));
        if (!c.palmas && t >= tb + 0.45) { c.palmas = true; c.eventos.push({ tipo: 'aplausoExpulso', time: a.time, id: a.id }); }
        break;
      }
      default: break;
    }
    return;
  }
  if (a === c.apoio) {
    const pun = c.punido;
    switch (v) {
      case 'abertos': {
        // a mão no ombro do punido (a mão do lado dele)
        const d = Math.hypot(a.j.x - pun.j.x, a.j.z - pun.j.z);
        const w = suave((1.6 - d) / 0.5) * janela(t, T.reacao - 0.2, 1e9, 0.2, 0.2);
        if (w > 0) {
          // (o ombro do punido que está do lado da mão: com a bola parada no ponto ele pode parar do outro lado da reta
          // punido–árbitro, e o ombro mais perto ficava do lado de lá — a mão cruzava o corpo)
          const po = pun.atu, lado = c.ladoApoio > 0 ? -1 : 1;
          const fx = Math.cos(h), fz = Math.sin(h);
          const doLado = io => ((po[io * 3] - a.j.x) * -fz + (po[io * 3 + 2] - a.j.z) * fx) * lado;
          const ombro = doLado(J.ombroE) > doLado(J.ombroD) ? J.ombroE : J.ombroD;
          gTapinhaOmbro(o, h, lado, po, ombro, fx, fz, w);
        }
        break;
      }
      case 'segurado': {
        const d = Math.hypot(a.j.x - pun.j.x, a.j.z - pun.j.z);
        const w = suave((0.95 - d) / 0.25) * janela(t, T.reacao + 0.55, T.reacao + 2.35, 0.15, 0.25);
        gSegura(o, h, pun.atu, w);
        if (w > 0.95) c.segurando = (c.segurando ?? 0) + PASSO;
        break;
      }
      case 'cabeca': case 'cabisbaixo': {
        const t0 = v === 'cabeca' ? T.reacao + 1.2 : T.reacao + 0.5;
        const d = Math.hypot(a.j.x - pun.j.x, a.j.z - pun.j.z);
        const w = suave((1.0 - d) / 0.25) * janela(t, t0, t0 + 1.4, 0.2, 0.25);
        gTapinha(o, h, -c.ladoApoio, pun.atu, pun.j.rumo, t, w);
        break;
      }
      default: break;
    }
    return;
  }
}

const POLO_OMBRO = [0, 0, 0, -0.3, 1, -1];
/** A mão de quem chega no ombro do outro (o ombro `io` da pose po): um pouco acima dele, do lado de quem chega. */
function gTapinhaOmbro(o, h, lado, po, io, fx, fz, w) {
  const i = io * 3;
  maoEm(o, h, lado, po[i] - fx * 0.05, po[i + 1] + 0.04, po[i + 2] - fz * 0.05, w, POLO_OMBRO);
}

function gestosArbitro(c, a, t) {
  const P = c.plano, T = P.tempos, o = a.atu, h = a.j.rumo;
  const pun = c.punido.atu, ip = J.peito * 3;
  const ux = pun[ip] - o[ip], uz = pun[ip + 2] - o[ip + 2];
  // tira o cartão do bolso
  const amareloPrimeiro = P.cor === 'amarelo' || P.segundo;
  if (amareloPrimeiro) gTiraAmarelo(o, h, janela(t, T.tira, T.alto - 0.02, 0.18, 0.12));
  else gTiraVermelho(o, h, janela(t, T.tira, T.alto - 0.02, 0.18, 0.12));
  let cor = null, w = 0;
  if (P.segundo) {
    const w1 = janela(t, T.alto - 0.12, T.altoFim1, 0.12, 0.2);
    gTiraVermelho(o, h, janela(t, T.tira2, T.alto2 - 0.02, 0.18, 0.12));
    const w2 = janela(t, T.alto2 - 0.12, T.altoFim, 0.12, 0.25);
    if (w1 > 0) { cor = 'amarelo'; w = w1; } else if (w2 > 0) { cor = 'vermelho'; w = w2; }
  } else {
    w = janela(t, T.alto - 0.12, T.altoFim, 0.12, 0.25);
    if (w > 0) cor = P.cor;
  }
  if (w > 0) {
    gCartao(o, h, w, ux, uz, K.ombroSobe);
    // a outra mão aponta o punido
    gAponta(o, h, -1, pun[ip], pun[ip + 1] - 0.1, pun[ip + 2], w * 0.9);
  }
  c.corAlto = w > 0.999 ? cor : null;
  c.cartaoNoAlto = w > 0.999;
  c.corVisivel = w > 0 ? cor : null;
  // depois do cartão: A1/V2 afasta (virado para o grupo); o amarelo anota; o vermelho aponta o túnel
  const fimC = T.altoFim + 0.15;
  if (IFAB[P.variante]) {
    const u = (t - fimC) / 1.2;
    if (u > 0 && u < 1) gAfasta(o, h, u, janela(t, fimC, fimC + 1.2, 0.15, 0.2));
  }
  const tAnota = P.planos.find(p => p.nome === 'anota')?.t0;
  if (tAnota != null) gAnota(o, h, t, janela(t, tAnota - 0.15, tAnota + K.anota, 0.25, 0.25));
  if (P.cor === 'vermelho') {
    const t0 = IFAB[P.variante] ? fimC + 1.25 : fimC;
    gAponta(o, h, 1, TUNEL.x, 1.6, TUNEL.z, janela(t, t0, t0 + 1.3, 0.25, 0.3));
  }
}

// ------------------------------------------------------------------------------------------------ passo
/** Um tick (1/60 s) da cena. Devolve false se ela já acabou. */
export function passoCenaCartao(c) {
  if (c.acabou) return false;
  // quem parou (fixo) e ficou perto do árbitro volta a andar para sair do caminho dele
  const arb = c.arbitro.j, lim = c.limAfasta + 0.25;
  // a lente do plano de agora (a posição da câmera não depende do aspecto) e, 0,9 s antes do corte, a do próximo (a
  // equipe se posiciona: escolhida já, ela fica para o plano): quem está na frente de uma delas sai
  const t0 = c.k * PASSO, P0 = c.plano.planos, ia = planoNoTempo(c, t0);
  c.camDe = null; c.camDe2 = null;
  c.planoAgora = ia < P0.length ? P0[ia].nome : null;
  if (ia < P0.length && LENTE_LIVRE[P0[ia].nome]) { planoIndice(c, ia, t0, _opcLente, _pcLente); _camDe.x = _pcLente.de[0]; _camDe.z = _pcLente.de[2]; c.camDe = _camDe; }
  if (ia + 1 < P0.length && LENTE_LIVRE[P0[ia + 1].nome] && P0[ia + 1].t0 - t0 <= 0.9) {
    if (!c.cams[ia + 1]) c.cams[ia + 1] = escolherCamera(c, ia + 1);
    planoIndice(c, ia + 1, P0[ia + 1].t0, _opcLente, _pcLente); _camDe2.x = _pcLente.de[0]; _camDe2.z = _pcLente.de[2]; c.camDe2 = _camDe2;
  }
  // a câmera que ANDA com o punido (steadicam do A3, de frente, a de lado da saída): a lente daqui a 0,9 s (pela velocidade
  // dele) também conta — quem está parado no caminho dela sai antes de ela chegar (a 3,6 m/s ela alcançava quem saía do
  // lugar só quando a lente já estava a 3,4 m)
  else if (c.camDe && c.cams[ia]?.movel) {
    const pj = c.punido.j;
    _camDe2.x = c.camDe.x + pj.vx * 0.9; _camDe2.z = c.camDe.z + pj.vz * 0.9; c.camDe2 = _camDe2;
  }
  const lente = CENAS.lente + 0.9;
  for (const a of c.atores) {
    if (!a.fixo || a.tipo !== 'resto') continue;
    if (Math.hypot(a.j.x - arb.x, a.j.z - arb.z) < lim || (c.camDe && Math.hypot(a.j.x - c.camDe.x, a.j.z - c.camDe.z) < lente)
      || (c.camDe2 && Math.hypot(a.j.x - c.camDe2.x, a.j.z - c.camDe2.z) < lente)) soltar(a);
  }
  passoAtores(c, desejo, gestos);
  const t = c.k * PASSO, P = c.plano, T = P.tempos;
  // a mão do cartão (o cartão 3D da página vai preso a ela)
  const o = c.arbitro.atu, i = J.maoD * 3;
  c.mao.x = o[i]; c.mao.y = o[i + 1]; c.mao.z = o[i + 2];
  // eventos para a torcida (render/emocao.js): o cartão no alto; a saída do expulso
  if (!c.evAlto && t >= T.alto + 0.2) { c.evAlto = true; c.eventos.push({ tipo: 'cartaoCena', fase: 'alto', cor: P.segundo ? 'amarelo' : P.cor, time: P.time, id: P.id }); }
  if (P.segundo && !c.evAlto2 && t >= T.alto2 + 0.2) { c.evAlto2 = true; c.eventos.push({ tipo: 'cartaoCena', fase: 'alto', cor: 'vermelho', time: P.time, id: P.id }); }
  const pl = P.planos;
  const ip = planoNoTempo(c, t);
  if (P.cor === 'vermelho' && !c.evSaida && ip < pl.length && pl[ip].nome === 'saida') { c.evSaida = true; c.eventos.push({ tipo: 'cartaoCena', fase: 'saida', cor: 'vermelho', time: P.time, id: P.id }); }
  // plano novo: a câmera dele (e a elipse do túnel) no 1º tick
  if (ip !== c.ip && ip < pl.length) entrarPlano(c, ip);
  if (c.k >= c.kFim) c.acabou = true;
  return true;
}

/** Avança a cena dt s reais (relógio do desenho). Devolve alfa; os ticks em c.ticksUltimo. */
export function avancarCenaCartao(c, dt) { return avancarCom(c, dt, passoCenaCartao); }
export function tempoCenaCartao(c) { return tempoDe(c); }
export function duracaoCenaCartao(c) { return c.kFim * PASSO; }
/** Nome do plano no estado desenhado ('fim' depois do último). */
export function faseCartao(c) {
  const ip = planoNoTempo(c, tempoDe(c));
  return ip < c.plano.planos.length ? c.plano.planos[ip].nome : 'fim';
}

// ------------------------------------------------------------------------------------------------ planos e câmera
/** Entra no plano ip: escolhe a câmera dele (com as posições de agora) e, no 'tunel', a ELIPSE do expulso. */
function entrarPlano(c, ip) {
  c.ip = ip;
  const pl = c.plano.planos[ip];
  if (pl.nome === 'tunel') elipseTunel(c);
  // (a câmera do plano já pode ter sido escolhida 0,9 s antes do corte: a equipe se posicionou e quem estava na frente
  // da lente saiu)
  if (!c.cams[ip]) c.cams[ip] = escolherCamera(c, ip);
  c.cortes++;
}

/** O expulso reaparece a 10–14 m da boca do túnel (fora do campo ou a ≤ 3 m da linha), já andando para ela. */
function elipseTunel(c) {
  const a = c.punido, P = c.plano, j = a.j;
  const lado = (j.x >= 0 ? 1 : -1);
  // o lado: o mesmo em que ele estava (a câmera fica do outro); a distância pelo hash
  const d = lerp(K.tunel.dist[0], K.tunel.dist[1], ((P.hash >>> 17) & 255) / 255);
  const x = lado * Math.min(7.5, d * 0.62), z = TUNEL.z - Math.sqrt(Math.max(0, d * d - x * x));
  // anda para a frente do vão das placas (depois a boca do túnel)
  const wx = lado * 1.2, wz = 39.4;
  const dx = wx - x, dz = wz - z, l = Math.hypot(dx, dz) || 1;
  const vel = P.variante === 'segurado' ? K.v2.vSai : P.variante === 'rosto' ? K.v3.vel : K.v1.vel;
  recriarAtor(c, a, x, z, Math.atan2(dz, dx), { dx: dx / l, dz: dz / l, vel, ticks: 50 });
  c.tunelLado = lado;
  c.saidaTunel = { x: wx, z: wz };
  // o resto (que aparece ao fundo) não muda; o companheiro fica no campo (desejoApoio)
}

const _a = [], _pl = { x: 0, z: 0 }, _pb = { x: 0, z: 0 };
/** Câmera de um plano: {x, y, z, ...} escolhida no começo dele (fixa no plano; o olhar acompanha o assunto). */
function escolherCamera(c, ip) {
  const P = c.plano, pl = P.planos[ip], arb = c.arbitro, pun = c.punido;
  const C = K.camera;
  const cands = [];
  switch (pl.nome) {
    case 'arbitro': {
      const A = P.arb, ax = A.x1, az = A.z1;
      const base = Math.atan2(P.parada.z - az, P.parada.x - ax);
      // (a bola parada segura o punido que corre para ela antes da parada prevista — a 5 m/s ele parava 1,3 m antes e a
      // reta da lente até o cartão passava pela cabeça dele — e o árbitro para a dPara m dele, onde ele estiver: o cartão
      // não pode ficar atrás dele em nenhuma das duas paradas)
      paradaPrevista(pun.j, _pl); paradaPrevista(pun.j, _pb, c.mF.bola.p);
      const bx = _pb.x - _pl.x, bz = _pb.z - _pl.z;
      for (const da of [C.arbitro.ang, -C.arbitro.ang, C.arbitro.ang * 0.7, -C.arbitro.ang * 0.7, C.arbitro.ang * 0.4, -C.arbitro.ang * 0.4]) {
        for (const dist of [C.arbitro.dist, C.arbitro.dist - 0.8, C.arbitro.dist + 0.8]) {
          const x = ax + Math.cos(base + da) * dist, z = az + Math.sin(base + da) * dist;
          // do lado da TV (z maior que o punido) é a preferência; o ângulo maior custa um pouco; o cartão no alto não pode
          // ficar atrás da cabeça nem do ombro do punido (a reta da lente até ele passa longe deles)
          let tap = tampaCartao(x, C.arbitro.altura, z, ax, az, P.parada.x, P.parada.z);
          if (bx || bz) tap = Math.max(tap, tampaCartao(x, C.arbitro.altura, z, ax + bx, az + bz, P.parada.x + bx, P.parada.z + bz));
          cands.push({ x, y: C.arbitro.altura, z, pref: (z < P.parada.z ? 1.5 : 0) + Math.abs(da) * 0.4 + Math.abs(dist - C.arbitro.dist) * 0.2 + tap });
        }
      }
      _a.length = 0; _a.push(arb, pun);
      return melhorCamera(c, cands, _a);
    }
    case 'reacao': return cameraReacao(c);
    case 'anota': {
      const ax = arb.j.x, az = arb.j.z;
      for (const da of [0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5]) {
        const a0 = Math.PI / 2 + da; // do lado da TV
        cands.push({ x: ax + Math.cos(a0) * C.anota.dist, y: C.anota.altura, z: az + Math.sin(a0) * C.anota.dist, pref: Math.abs(da) * 0.3 });
      }
      _a.length = 0; _a.push(arb);
      return melhorCamera(c, cands, _a);
    }
    case 'saida': {
      // de lado (um pouco atrás), andando com ele: o lado e a distância sem ninguém perto da lente no caminho previsto
      destinoSaida(c, _q);
      const dx = _q.x - pun.j.x, dz = _q.z - pun.j.z, l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l;
      const vel = P.variante === 'segurado' ? K.v2.vSai : P.variante === 'rosto' ? K.v3.vel : K.v1.vel;
      let melhor = null, menor = Infinity;
      for (const lat of [C.saida.lado, C.saida.lado + 1.5, C.saida.lado + 3]) for (const sg of [1, -1]) {
        let custo = (sg * ux) > 0 ? 0.2 : 0; // (preferência: do lado da TV quando ele anda para z +)
        for (const u of [0, 0.5, 1.0, 1.5]) {
          const px = pun.j.x + ux * vel * u, pz = pun.j.z + uz * vel * u;
          const x = px - ux * C.saida.atras - uz * sg * lat, z = pz - uz * C.saida.atras + ux * sg * lat;
          if (!camValida(x, C.saida.altura, z)) { custo += 100; continue; }
          _a.length = 0; _a.push(pun);
          const cc = melhorCamera(c, [{ x, y: C.saida.altura, z }], _a).custo;
          custo += Number.isFinite(cc) ? cc : 100;
        }
        custo += (lat - C.saida.lado) * 0.3;
        if (custo < menor) { menor = custo; melhor = { lat, sg }; }
      }
      return { x: 0, y: C.saida.altura, z: 0, ux, uz, lado: melhor.sg, lat: melhor.lat, movel: true };
    }
    case 'tunel': {
      const lado = c.tunelLado ?? 1, Tc = K.tunel.cam;
      if (P.variante === 'cabisbaixo') {
        // de costas: atrás dele, no campo, olhando o túnel (a distância e o desvio de lado com a lente livre: quem ficou no
        // lance perto da lateral de cá não pode estar a < CENAS.lente da lente; a preferência é a de antes, 5,5 m e 0,8 m)
        const j = pun.j, dx = TUNEL.x - j.x, dz = TUNEL.z - j.z, l = Math.hypot(dx, dz) || 1;
        for (const k of [5.5, 6.5, 4.8, 7.5]) for (const lt of [0.8, -0.8, 2.0, -2.0, 3.2, -3.2]) {
          cands.push({ x: j.x - (dx / l) * k - (dz / l) * lt, y: 1.7, z: j.z - (dz / l) * k + (dx / l) * lt, pref: Math.abs(k - 5.5) * 0.1 + Math.abs(lt - 0.8) * 0.15 });
        }
        _a.length = 0; _a.push(pun);
        return { ...melhorCamera(c, cands, _a), olharTunel: true };
      }
      // junto do túnel, do outro lado do expulso, olhando para ele (o campo ao fundo); |x| de 4 a 10 m e z de 36,5 a 39 m (o
      // treinador do lado de lá, no recuo, fica a ~1 m do ponto de sempre: 6,5 m e 38,3 m)
      for (const zc of [Tc.z, 37.5, 38.9, 36.5, 39]) for (const xc of [Tc.x, 7.7, 5.3, 4, 9, 10]) {
        cands.push({ x: -lado * xc, y: Tc.y, z: zc, pref: (Math.abs(xc - Tc.x) + Math.abs(zc - Tc.z)) * 0.15 });
      }
      _a.length = 0; _a.push(pun);
      return melhorCamera(c, cands, _a);
    }
    case 'torcida': {
      const id = P.time === 1 ? 'visitantes' : 'organizada';
      return { trilho: id, ajuste: P.ajustePlano ?? null };
    }
    default: return { x: 0, y: 10, z: 30 };
  }
}

/**
 * Custo de o punido (em px, pz) tampar o cartão no alto (o árbitro em ax, az; o cartão a ~2,2 m) visto da lente (cx, cy,
 * cz): a reta da lente até o cartão perto da cabeça (1,72 m) ou dos ombros (1,45 m) dele.
 */
function tampaCartao(cx, cy, cz, ax, az, px, pz) {
  const tx = ax + (px - ax) * 0.06, ty = 2.2, tz = az + (pz - az) * 0.06;
  const dx = tx - cx, dy = ty - cy, dz = tz - cz, l2 = dx * dx + dy * dy + dz * dz;
  let custo = 0;
  for (const [hy, raio] of [[1.72, 0.42], [1.45, 0.5]]) {
    const w = Math.max(0, Math.min(1, ((px - cx) * dx + (hy - cy) * dy + (pz - cz) * dz) / l2));
    const d = Math.hypot(cx + dx * w - px, cy + dy * w - hy, cz + dz * w - pz);
    if (d < raio) custo += (raio - d) * 20;
  }
  return custo;
}

/** A câmera da reação de cada variação (plano de três, de frente, steadicam). */
function cameraReacao(c) {
  const P = c.plano, v = P.variante, pun = c.punido, arb = c.arbitro, C = K.camera, j = pun.j;
  const cands = [];
  if (v === 'abertos' || v === 'segurado') {
    // plano de três: perpendicular à reta punido–árbitro, do lado da TV de preferência
    const mx = (j.x + arb.j.x) / 2, mz = (j.z + arb.j.z) / 2;
    const ux = arb.j.x - j.x, uz = arb.j.z - j.z, l = Math.hypot(ux, uz) || 1;
    const nx = -uz / l, nz = ux / l, sg = nz >= 0 ? 1 : -1;
    for (const dist of [C.reacao3.dist, C.reacao3.dist + 1.2]) for (const da of [0, 0.3, -0.3, 0.6, -0.6]) for (const s of [sg, -sg]) {
      const a0 = Math.atan2(nz * s, nx * s) + da;
      cands.push({ x: mx + Math.cos(a0) * dist, y: C.reacao3.altura, z: mz + Math.sin(a0) * dist, pref: (s === sg ? 0 : 1.2) + Math.abs(da) * 0.5 + (dist - C.reacao3.dist) * 0.5 });
    }
    _a.length = 0; _a.push(pun, arb); if (c.apoio) _a.push(c.apoio);
    return { ...melhorCamera(c, cands, _a), tres: true };
  }
  // de frente para ele (o rumo em que vai andar) ou a steadicam do A3: a câmera anda com ele (o lado com menos gente)
  let dx, dz;
  if (v === 'cabeca') { dx = j.x - arb.j.x; dz = j.z - arb.j.z; }
  else if (v === 'aceita') { dx = c.vagaA3.x - j.x; dz = c.vagaA3.z - j.z; }
  else { dx = P.saida.x - j.x; dz = P.saida.z - j.z; }
  const l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l;
  const F = v === 'aceita' ? C.steadicam : C.frente;
  const frente0 = v === 'aceita' ? F.frente : F.dist, lat0 = v === 'aceita' ? F.lado : 1.1;
  let lado = 1, frente = frente0, lat = lat0, menor = Infinity;
  // o lado, a distância e o desvio de lado com menos gente na lente pelo caminho previsto (1,0 m/s; o A3 trotando) — no
  // corte (u = 0) a lente tem de estar livre
  const vv = v === 'aceita' ? 3.2 : 1.0;
  for (const fr of [frente0, frente0 + 0.8, frente0 + 1.6]) for (const lt of [lat0, lat0 + 1.2, lat0 - 0.9]) for (const sg of [1, -1]) {
    let custo = 0;
    for (const u of [0, 0.8, 1.6, 2.4]) {
      const px = j.x + ux * vv * u, pz = j.z + uz * vv * u;
      const x = px + ux * fr - uz * sg * lt, z = pz + uz * fr + ux * sg * lt;
      if (!camValida(x, F.altura, z)) { custo += 50; continue; }
      _a.length = 0; _a.push(pun);
      const cc = melhorCamera(c, [{ x, y: F.altura, z }], _a).custo;
      custo += Number.isFinite(cc) ? cc : (u === 0 ? 200 : 20);
    }
    // do lado da TV (z +) de preferência; o enquadramento padrão
    custo += (ux * sg) < 0 ? 0 : 0.3;
    custo += (fr - frente0) * 0.4 + Math.abs(lt - lat0) * 0.3;
    if (custo < menor) { menor = custo; lado = sg; frente = fr; lat = lt; }
  }
  return { x: 0, y: F.altura, z: 0, ux, uz, lado, frente, lat, movel: true, fov: F.fov, olharY: F.olharY };
}

/**
 * Plano de câmera do estado desenhado: out = {nome ('arbitro' | 'reacao' | 'anota' | 'saida' | 'tunel' | 'torcida' |
 * 'fim'), de, para, fov, tunel (o vão das placas aberto e o lado de cá desenhado)}. opc = {pequena, aspecto}. Pura.
 */
export function planoCameraCartao(c, opc, out) {
  const t = tempoDe(c);
  return planoIndice(c, planoNoTempo(c, t), t, opc, out);
}

/** O plano ip no tempo t (s) com as posições desenhadas de agora. */
function planoIndice(c, ip, t, opc, out) {
  const pl = c.plano.planos[ip];
  out.tunel = false;
  if (!pl) { out.nome = 'fim'; return out; }
  const cam = c.cams[ip] ?? (c.cams[ip] = escolherCamera(c, ip));
  const C = K.camera, al = c.alfa;
  const pun = c.punido, arb = c.arbitro;
  const px = lerp(pun.x0, pun.x1, al), pz = lerp(pun.z0, pun.z1, al);
  const ax = lerp(arb.x0, arb.x1, al), az = lerp(arb.z0, arb.z1, al);
  switch (pl.nome) {
    case 'arbitro': {
      _g.length = 0; _g.push(px, pz, ax, az);
      definirPlanoGrupo(out, 'arbitro', cam.x, cam.y, cam.z, _g, C.arbitro.olharY, C.arbitro.fov, opc);
      _cab.length = 0; _cab.push(pun.atu, arb.atu);
      return caberNoQuadro(out, opc, _cab);
    }
    case 'reacao': {
      if (cam.tres) {
        _g.length = 0; _g.push(px, pz, ax, az);
        if (c.apoio && Math.hypot(c.apoio.j.x - pun.j.x, c.apoio.j.z - pun.j.z) < 4) _g.push(lerp(c.apoio.x0, c.apoio.x1, al), lerp(c.apoio.z0, c.apoio.z1, al));
        definirPlanoGrupo(out, 'reacao', cam.x, cam.y, cam.z, _g, 0.95, C.reacao3.fov, opc);
        _cab.length = 0; _cab.push(pun.atu);
        return caberNoQuadro(out, opc, _cab);
      }
      const x = px + cam.ux * cam.frente - cam.uz * cam.lado * cam.lat, z = pz + cam.uz * cam.frente + cam.ux * cam.lado * cam.lat;
      definirPlano(out, 'reacao', x, cam.y, z, px, cam.olharY, pz, cam.fov, opc);
      _cab.length = 0; _cab.push(pun.atu);
      return caberNoQuadro(out, opc, _cab);
    }
    case 'anota': return definirPlano(out, 'anota', cam.x, cam.y, cam.z, ax, 1.15, az, C.anota.fov, opc);
    case 'saida': {
      const x = px - cam.ux * C.saida.atras - cam.uz * cam.lado * cam.lat, z = pz - cam.uz * C.saida.atras + cam.ux * cam.lado * cam.lat;
      return definirPlano(out, 'saida', x, C.saida.altura, z, px + cam.ux * 1.0, 1.0, pz + cam.uz * 1.0, C.saida.fov, opc);
    }
    case 'tunel': {
      out.tunel = true;
      if (cam.olharTunel) definirPlano(out, 'tunel', cam.x, cam.y, cam.z, lerp(px, TUNEL.x, 0.35), 1.6, lerp(pz, TUNEL.z, 0.35), C.tunel.fov, opc);
      else definirPlano(out, 'tunel', cam.x, cam.y, cam.z, px, 1.1, pz, C.tunel.fov, opc);
      out.tunel = true;
      return out;
    }
    case 'torcida': {
      const u = (t - pl.t0) / Math.max(0.1, pl.t1 - pl.t0);
      const q = cameraDoPlano(cam.trilho, u, _cp, cam.ajuste);
      out.nome = 'torcida';
      out.de[0] = q.px; out.de[1] = q.py; out.de[2] = q.pz; out.para[0] = q.lx; out.para[1] = q.ly; out.para[2] = q.lz; out.fov = q.fov;
      return out;
    }
    default: out.nome = 'fim'; return out;
  }
}
const _cp = {}, _g = [], _cab = [];
const _opcLente = { pequena: false, aspecto: 16 / 9 }, _pcLente = criarPlanoCena(), _camDe = { x: 0, z: 0 }, _camDe2 = { x: 0, z: 0 };
const LENTE_LIVRE = { arbitro: true, reacao: true, anota: true, saida: true };
export { criarPlanoCena as criarPlanoCameraCartao };

/**
 * A mão do cartão e o cartão no estado desenhado (para o cartão 3D da página): {visivel, cor, x, y, z (a mão desenhada da
 * pose `des` do árbitro), nx, nz (a face: para o punido)}.
 */
export function cartaoNaMao(c, des, out) {
  const o = des ?? c.arbitro.atu, i = J.maoD * 3, p = J.peito * 3;
  out.visivel = !!c.corVisivel; out.cor = c.corVisivel;
  out.x = o[i]; out.y = o[i + 1]; out.z = o[i + 2];
  const pu = c.punido.atu;
  let nx = pu[p] - o[p], nz = pu[p + 2] - o[p + 2];
  const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
  out.nx = nx; out.nz = nz;
  return out;
}

/** Eventos novos da cena (torcida: o cartão no alto, a saída do expulso, as palmas dele) para a página; esvazia a fila. */
export function consumirEventosCartao(c, out = []) {
  out.length = 0;
  for (const e of c.eventos) out.push(e);
  c.eventos.length = 0;
  return out;
}

/** Informação para testes e API: por ator {id, time, tipo, x, z, rumo, v, fixo, ativo, kit, recriado}. */
export function infoAtoresCartao(c) {
  return c.atores.map(a => ({
    id: a.id, time: a.time, tipo: a.tipo, x: a.j.x, z: a.j.z, rumo: a.j.rumo, v: Math.hypot(a.j.vx, a.j.vz), fixo: a.fixo,
    ativo: a.ativo, kit: a.kit, goleiro: a.goleiro, recriado: a.recriado,
  }));
}

export { TOPO_CABECA };
