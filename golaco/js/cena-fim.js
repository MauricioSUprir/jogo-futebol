// Cenas do FIM DE TEMPO (pedido do dono de 22/10: "a cena de intervalo" e "a cena de pós jogo"; antes, 12/10: "temos que ter
// cenas de final de primeiro tempo, final de segundo tempo"; PLANO-CENAS.md §4 e §5). PURA: sem three.js nem DOM, sem m.rng
// e sem Math.random — testada em Node (tools/teste-cenas.mjs, seção C) e desenhada pela página (main.js) no lugar dos
// jogadores da simulação. FORA do fecho do hash (tools/fecho-hash.mjs): só LÊ o mundo (cópias); chega sob demanda (main.js
// SOB.cenas). Porte da branch golaco/cenas-jogo (1df2ca34) para fora do fecho, com as constantes em js/cenas-config.js
// CENA_FIM. Contrato em CONTRATOS.md ("Cenas das paradas" §7.3); pesquisa em PESQUISA-CENAS-TV.md.
//
// Os 22 são COPIADOS no tick do apito (cena-atores.js), com o árbitro (200, perto da jogada), os dois assistentes (201,
// 202, na linha lateral, um em cada metade) e as cópias dos treinadores (tecnicos.js treinadorDoTime, 210/211: os vivos não
// são desenhados durante a cena). Todos desaceleram pela locomoção (ninguém para de uma vez). A bola da cena é uma CÓPIA da
// do mundo andando pela física de bola.js (a do apito no ar cai e rola; nada fica pendurado no ar com o mundo parado).
//
// INTERVALO (a página segura a simulação no tick do 'intervalo' até o plano 'geral'; ali solta, os 3 s de
// PARTIDA.intervalo correm por baixo com o desenho ainda da cena, e a 'saida' acaba a cena):
//   'apito'        1,5 s  plano alto; o árbitro apita e aponta o túnel;
//   'campo'        2,5 s  mãos na cintura (≥ 60%), dois com as mãos nos joelhos, quem perde de cabeça baixa, os pares de
//                         adversários mais perto se cumprimentam, o trio se junta;
//   'tunel'        3,5 s  ELIPSE: os 22 e o trio numa fila de CENA_FIM.funil.d m da boca do túnel, andando para ela (a
//                         câmera do lado da boca, olhando o campo; o vão das placas aberto: out.tunel); quem chega à boca
//                         (z ≥ funil.entra) some dentro dela; quem perde cabisbaixo, quem ganha conversando;
//   'torcida'      1,5 s  ELIPSE: ninguém mais em campo (os que não entraram são cortados aqui); a torcida pelo placar;
//   'lances'       0 s    a cena ESPERA (c.emLances) enquanto a página toca 0–2 lances do guardador (render/lances-guarda.js)
//                         pelo diretor do replay; seguirCenaFim(c) continua;
//   'estatisticas' 6 s    o plano geral do estádio vazio (a página mostra o painel: js/cenas-tela.js);
//   'geral'               o plano geral (o laço solto; a página acaba a cena na 'saida').
// A tarja do placar com os autores (a página) entra em CENA_FIM.placar.entra s e fica placar.dura s no relógio da cena
// (tarjaPlacarVisivel: parada enquanto os lances tocam).
// FIM DO JOGO (PR 4, pedido do dono de 22/10: "a cena de pós jogo"; PLANO-CENAS.md §5): fora do online a página segura a
// simulação no tick do 'fimDeJogo' (em 'fim' só o m.tick andaria; o resultado do TM já foi gravado no apito); no online
// não segura (o lockstep segue) e a cena só usa cópias. Os planos (CENA_FIM.planos.vitoria/empate/curto):
//   'apito'        1,5 s  plano alto; o árbitro apita e aponta o meio;
//   'vencedor'     3,0 s  quem ganhou: os dois braços para o céu, socos, pulos e o abraço em grupo (o goleiro vem correndo);
//   'perdedor'     2,5 s  agachados, mãos na cabeça e nos joelhos, um levanta o outro — no empate, 'neutro' (3,0 s: mãos
//                         na cintura);
//   'cumprimentos' 2,0 s  até 6 pares de adversários a ≤ 6 m apertam a mão e o árbitro cumprimenta um jogador (UEFA 50.04);
//   'troca'        1,5 s  ELIPSE: o par da troca de camisa (sorteado pelo hash do jogo) lado a lado, abraçados, andando
//                         para a câmera, cada um com a camisa do outro (atu.camisaDe: a página desenha o kit misto) — só com
//                         o par;
//   'treinador'    2,0 s  ELIPSE: os dois treinadores (as cópias do gancho) se cumprimentam na frente do túnel (sem o outro,
//                         o do vencedor comemora); só com o gancho;
//   'aplauso'      2,5 s  ELIPSE: o time da pessoa aplaude a própria torcida, ao lado do gol;
//   'torcida'      2,0 s  a torcida pelo placar (a festa de quem ganhou, a vaia e o silêncio de quem perdeu: emocao.js e
//                         festa.js 'cenaFim');
//   'melhor'       5,0 s  ELIPSE: o close do MELHOR EM CAMPO (opc.melhor: sumula.js melhorEmCampo) em pé, batendo palmas e
//                         erguendo o braço para a torcida (a página mostra a tarja: tarjaMelhorVisivel);
//   'placar'       8,0 s  o plano geral com a tarja do placar final com os autores (a página);
//   'estatisticas' 6,0 s  o plano geral com o painel de estatísticas da partida (a página; não no TM);
//   'geral'               o plano geral, os atores respirando onde estão, até "Jogar de novo" (a página mostra a faixa final
//                         com "Melhores momentos").
// 'curto' (o empate que continua no TM): apito → neutro → torcida → placar → geral. Toque = o próximo bloco (os planos de
// campo → o melhor → o placar → as estatísticas → o geral); "Pular" = o geral. Nada é alocado por tick.
import { PASSO, CAMPO, JOGADOR } from './config.js';
import { CENA_FIM, CENAS, CAMERA_GERAL } from './cenas-config.js';
import {
  criarBase, adicionarJogador, adicionarArbitro, adicionarNovo, poseInicial, recriarAtor, soltar, irPara, parar, para,
  desviar, passoAtores, tempoDe, planoNoTempo, hashGol, melhorCamera, definirPlano, definirPlanoGrupo, fugirDaLente,
  criarPlanoCena, clamp, suave, lerp, janela, s60, J, moverTudo, caberNoQuadro, marcarBola,
  gApito, gAponta, gCintura, gJoelhos, gAperto, gCeu, gSoco, gCabeca, gTapinha, gPalmasAlto, gPalmas, gAbraco, posturaCabisbaixo,
  posturaAgachado,
} from './cena-atores.js';
import { cameraDoPlano } from './prejogo-roteiro.js';
import { copiarBola, passoBola } from './bola.js';
import { solidoEm } from './estadio-forma.js';

const K = CENA_FIM;
const MX = CAMPO.meioX, MZ = CAMPO.meioZ;
const TUNEL = CENAS.tunel;
/** Os planos que vêm depois do campo no intervalo (o campo já vazio: ninguém em campo, a bola fora do desenho). */
const VAZIO = { torcida: true, lances: true, estatisticas: true, geral: true };

// ------------------------------------------------------------------------------------------------ plano
/** Os treinadores do gancho em {0, 1} (aceita [a, b] ou {0: a, 1: b}; null = sem treinadores). */
function treinadoresDe(tr) {
  if (!tr) return { 0: null, 1: null };
  return { 0: tr[0] ? { ...tr[0] } : null, 1: tr[1] ? { ...tr[1] } : null };
}

/**
 * Plano da cena (só LÊ o mundo). tipo = 'intervalo' | 'fimDeJogo'. opc = {placar ({0, 1}; padrão m.placar), timeHumano
 * (0), treinadores ([a, b] | {0, 1}: as cópias do gancho tecnicos.js treinadorDoTime; null = sem eles), lances (quantos
 * lances do guardador a página vai tocar: 0 = sem o bloco), estatisticas (false = sem o bloco: o fim no TM), curto (o fim:
 * o empate que continua no TM), melhor (o fim: o melhor em campo {id, time, nota, ...}; sem ele o plano sai), troca (o fim:
 * false = sem a troca de camisa), ajustePlano (a planta do estádio de forma própria: os trilhos da torcida dele),
 * cameraGeral ({de, para, fov}: o plano geral dele)}. Devolve {tick, tipo, resultado ('intervalo' | 'vitoria' | 'empate'),
 * vencedor (0 | 1 | null), placar, planos [{nome, t0, t1}], duracao (até o plano geral), geral (s do plano geral; 0 = até o
 * fim), tLances (s; null sem lances), lances, tarja ({de, ate} s: a tarja do placar), arb {x, z}, pares, troca ({a, b, sx}
 * | null: os ids do par da troca de camisa, a de time 0 e a de time 1, e o lado de x onde aparecem), timeHumano,
 * treinadores, hash, ...}.
 */
export function planejarFim(m, tipo, opc = {}) {
  const pl = opc.placar ?? m.placar ?? { 0: 0, 1: 0 };
  const g0 = pl[0] ?? 0, g1 = pl[1] ?? 0;
  const vencedor = g0 > g1 ? 0 : g1 > g0 ? 1 : null;
  const intervalo = tipo === 'intervalo';
  const resultado = intervalo ? 'intervalo' : vencedor == null ? 'empate' : 'vitoria';
  const curto = !intervalo && !!opc.curto;
  const tr = treinadoresDe(opc.treinadores);
  const temTreinador = !intervalo && !!(tr[0] || tr[1]);
  const nLances = Math.max(0, Math.floor(opc.lances ?? 0));
  const comEst = opc.estatisticas !== false;
  // o árbitro: perto da jogada (8 m da bola na direção do meio), dentro do campo e longe de todo mundo
  const b = m.bola.p;
  let ax = b.x * 0.85, az = b.z * 0.8;
  const l = Math.hypot(b.x, b.z);
  if (l > 9) { ax = b.x - (b.x / l) * 8; az = b.z - (b.z / l) * 8; }
  for (let it = 0; it < 30; it++) {
    let perto = null, dm = 1.6;
    for (const j of m.jogadores) { const d = Math.hypot(j.x - ax, j.z - az); if (d < dm) { dm = d; perto = j; } }
    if (!perto) break;
    const dx = ax - perto.x, dz = az - perto.z, d = Math.hypot(dx, dz) || 1;
    ax += (dx / d) * 0.8; az += (dz / d) * 0.8;
  }
  ax = clamp(ax, -MX + 3, MX - 3); az = clamp(az, -MZ + 3, MZ - 3);
  // pares de adversários para o aperto de mão (os mais perto primeiro; ≤ maxDist, ou a folga se faltar)
  const A = K.aperto;
  const js = m.jogadores.filter(j => j.posicao !== 'GOL');
  const cand = [];
  // (a distância é a dos pontos onde cada um para — quem corria no apito freia pela locomoção: o par que se afastava não
  // chega a tempo; no fim também, desde o PR 4)
  const px = new Map();
  for (const j of js) {
    const v = Math.hypot(j.vx, j.vz), f = K.solidos.freio * (j.par?.freio ?? JOGADOR.freio), k = v > 0.05 ? v / (2 * f) : 0;
    px.set(j, { x: j.x + j.vx * k, z: j.z + j.vz * k });
  }
  for (const a of js) for (const c of js) {
    if (a.time !== 0 || c.time !== 1) continue;
    const pa = px.get(a), pc = px.get(c);
    cand.push({ a: a.id, b: c.id, d: Math.hypot(pa.x - pc.x, pa.z - pc.z) });
  }
  cand.sort((p, q) => p.d - q.d || p.a - q.a || p.b - q.b);
  const usados = new Set(), pares = [];
  // (no intervalo só os pares ao alcance: o aperto acaba antes do túnel — CENA_FIM.aperto.maxDistIntervalo)
  // (o empate que continua no TM, a versão curta, não tem os cumprimentos)
  if (!curto) for (const lim of intervalo ? [A.maxDistIntervalo ?? A.maxDist] : [A.maxDist, A.maxDistFolga]) {
    for (const p of cand) {
      if (pares.length >= A.pares) break;
      if (p.d > lim || usados.has(p.a) || usados.has(p.b)) continue;
      usados.add(p.a); usados.add(p.b); pares.push(p);
    }
    if (pares.length >= 3) break;
  }
  const h = hashGol(m.tick, 200 + (intervalo ? 1 : 2));
  // a troca de camisa (o fim; não na versão curta): 1 par de adversários de linha — nunca goleiro (nem o de linha que foi
  // para o gol), expulso (já fora de m.jogadores), quem aperta a mão nos cumprimentos nem o melhor em campo — pelo hash do
  // JOGO (o tick do apito e a semente; sem m.rng)
  let troca = null;
  if (!intervalo && !curto && opc.troca !== false && (K.troca?.pares ?? 0) > 0) {
    const ht = hashGol((m.tick + Math.imul((m.semente ?? 0) | 0, 7919)) | 0, 400);
    const pode = j => j.posicao !== 'GOL' && j.vagaId !== 'GOL' && !usados.has(j.id) && j.id !== opc.melhor?.id;
    const c0 = js.filter(j => j.time === 0 && pode(j)).sort((x, y) => x.id - y.id);
    const c1 = js.filter(j => j.time === 1 && pode(j)).sort((x, y) => x.id - y.id);
    if (c0.length && c1.length) troca = { a: c0[ht % c0.length].id, b: c1[(ht >>> 9) % c1.length].id, sx: (ht >>> 20) & 1 ? 1 : -1 };
  }
  const def = K.planos[curto ? 'curto' : resultado];
  const planos = [];
  let t = 0, geral = 0, tLances = null, tPlacar = null;
  for (const [nome, d] of def) {
    if (nome === 'treinador' && !temTreinador) continue;
    if (nome === 'lances' && !nLances) continue;
    if (nome === 'estatisticas' && !comEst) continue;
    if (nome === 'melhor' && !opc.melhor) continue;
    if (nome === 'troca' && !troca) continue;
    if (nome === 'geral') {
      geral = d;
      planos.push({ nome, t0: t, t1: d > 0 ? t + d : Infinity });
      continue;
    }
    if (nome === 'lances') tLances = t;
    if (nome === 'placar') tPlacar = t;
    planos.push({ nome, t0: t, t1: t + d });
    t += d;
  }
  // a tarja do placar com os autores: no intervalo, placar.entra s depois do apito por placar.dura s (DFL); no fim, o plano
  // 'placar' inteiro
  const tarja = intervalo ? { de: K.placar.entra, ate: K.placar.entra + K.placar.dura }
    : tPlacar != null ? { de: tPlacar, ate: tPlacar + K.placar.dura } : null;
  return {
    tick: m.tick, tipo, resultado, vencedor, placar: { 0: g0, 1: g1 }, planos, duracao: t, geral, curto,
    tLances, lances: nLances, tarja, arb: { x: ax, z: az }, pares, troca,
    timeHumano: opc.timeHumano ?? 0, treinadores: tr, temTreinador, hash: h, ataca: { ...m.ataca },
    melhor: opc.melhor ? { ...opc.melhor } : null,
    ajustePlano: typeof opc.ajustePlano === 'function' ? opc.ajustePlano : null,
    cameraGeral: opc.cameraGeral ?? null,
  };
}

// ------------------------------------------------------------------------------------------------ cena
/** Cena a partir do mundo no tick do apito (só LÊ o mundo: cópias). */
export function criarCenaFim(plano, m) {
  const c = criarBase(m);
  c.plano = plano;
  const intervalo = plano.tipo === 'intervalo';
  c.kFim = s60(plano.duracao);
  // (no intervalo a página acaba a cena na 'saida': o plano geral não tem fim por si)
  c.kGeral = !intervalo && plano.geral > 0 ? s60(plano.duracao + plano.geral) : Infinity;
  // os lances: a cena espera no começo do bloco (c.emLances) até a página dizer que acabaram (seguirCenaFim)
  c.kLances = plano.tLances != null ? s60(plano.tLances) : null;
  c.iLances = plano.planos.findIndex(p => p.nome === 'lances');
  c.emLances = false; c.lancesVistos = c.kLances == null;
  // a bola: cópia da do mundo andando pela física (bola.js); com o goleiro segurando no apito, fora do desenho (ele a leva)
  c.mF.bola = copiarBola(m.bola);
  const bp = c.mF.bola.p;
  c.bola0 = { x: bp.x, y: bp.y, z: bp.z }; c.bola1 = { x: bp.x, y: bp.y, z: bp.z };
  c.bolaVisivel = m.naMao == null;
  c.bolaViva = c.bolaVisivel;
  for (const j of m.jogadores) {
    const a = adicionarJogador(c, j, plano.vencedor == null ? 'neutro' : j.time === plano.vencedor ? 'vencedor' : 'perdedor');
    a.cede = 0.8;
  }
  const arb = adicionarArbitro(c, CENAS.idArbitro, plano.arb.x, plano.arb.z, Math.atan2(-plano.arb.z, -plano.arb.x));
  arb.cede = 0.3; arb.podeFixar = false;
  c.arbitro = arb;
  c.assistentes = CENAS.assistentes.map(([x, z], i) => {
    const a = adicionarArbitro(c, CENAS.idAssistentes[i], x, z, Math.atan2(-z, -x), 'assistente');
    a.cede = 0.3;
    return a;
  });
  // os treinadores (o gancho; cópias paradas na área técnica, como no cartão): os vivos da página não são desenhados
  c.treinadores = [];
  for (const t of [0, 1]) {
    const o = plano.treinadores?.[t];
    if (!o) continue;
    const a = adicionarNovo(c, o, 'tecnico');
    a.podeFixar = !plano.temTreinador; a.cede = 0; a.timeT = t;
    c.treinadores.push(a);
  }
  // o fim: o par da troca de camisa (os dois atores; a camisa do outro só depois da elipse do plano 'troca': c.trocou), o
  // melhor em campo (o ator dele; o substituído, que não está em m.jogadores, vira um ator novo fora do desenho até a elipse
  // do plano 'melhor') e o aperto dos treinadores (c.trPar, na elipse do plano 'treinador')
  c.troca = null; c.trocou = false; c.trPar = null; c.melhorA = null;
  if (plano.troca) {
    const ta = c.porId.get(plano.troca.a), tb = c.porId.get(plano.troca.b);
    if (ta && tb) c.troca = { a: ta, b: tb, sx: plano.troca.sx };
  }
  if (plano.melhor) {
    let a = c.porId.get(plano.melhor.id);
    if (!a) {
      a = adicionarNovo(c, { id: plano.melhor.id, time: plano.melhor.time, x: 0, z: -20, rumo: Math.PI / 2 }, 'melhor', 'MEI');
      a.ativo = false;
    }
    c.melhorA = a;
  }
  // papéis: os pares do aperto de mão, quem fica com as mãos nos joelhos, o grupo do vencedor e o do perdedor
  c.pares = plano.pares.map((p, k) => ({ a: c.porId.get(p.a), b: c.porId.get(p.b), k, t0: -1, feito: false })).filter(p => p.a && p.b);
  for (const p of c.pares) { p.a.par = p; p.b.par = p; }
  // (o fim: onde cada par vai se encontrar — o meio dos dois, cada um a meia distância do aperto: as câmeras escolhidas
  // deixam a lente fora do caminho deles, que não fogem da lente por serem o assunto dos cumprimentos)
  if (plano.tipo === 'fimDeJogo') for (const p of c.pares) {
    const A = p.a.j, B = p.b.j, mx = (A.x + B.x) / 2, mz = (A.z + B.z) / 2, dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz) || 1, meia = K.aperto.dist / 2;
    p.a.alvoX = mx - (dx / d) * meia; p.a.alvoZ = mz - (dz / d) * meia; p.b.alvoX = mx + (dx / d) * meia; p.b.alvoZ = mz + (dz / d) * meia;
  }
  const livres = c.atores.filter(a => (a.tipo === 'vencedor' || a.tipo === 'perdedor' || a.tipo === 'neutro') && !a.par && !a.goleiro);
  livres.sort((x, y) => (hashGol(plano.tick, x.id) % 997) - (hashGol(plano.tick, y.id) % 997) || x.id - y.id);
  for (let k = 0; k < Math.min(K.joelhos, livres.length); k++) livres[k].joelhos = true;
  c.grupoV = null; c.grupoP = null;
  if (plano.resultado === 'vitoria') montarGrupos(c);
  for (const a of c.atores) poseInicial(c, a);
  // quem vinha correndo para o gol ou para as placas: no corte do começo, um pouco antes, andando (longeDosSolidos)
  for (const a of c.atores) if ((a.time === 0 || a.time === 1) && a.tipo !== 'tecnico') longeDosSolidos(c, a);
  // a bola da cena é VIVA (a cópia andando pela física): quem encosta nela a toca, e ela bate no corpo e volta
  // (passoBolaCena: bolaNosAtores) — nunca é ela quem empurra o jogador (o separarDaBola da cena do cartão é para a bola
  // parada do mundo, que a página desenha no lugar; aqui a página desenha a da cena). Escondida (o goleiro com ela nas mãos),
  // ninguém se afasta dela
  marcarBola(c);
  for (const a of c.atores) a.bolaMin = 0;
  c.ip = -1;
  entrarPlano(c, 0);
  return c;
}

/**
 * Fim com vencedor: o grupo da festa (o vencedor de linha mais perto do meio e até 5 companheiros mais perto dele; o
 * goleiro vem correndo) e o do lamento (os 4 perdedores mais perto do meio do campo; o 1º agacha, o 2º o levanta).
 */
function montarGrupos(c) {
  const v = c.atores.filter(a => a.tipo === 'vencedor' && !a.goleiro && !a.par);
  const p = c.atores.filter(a => a.tipo === 'perdedor' && !a.goleiro && !a.par);
  const meio = a => Math.hypot(a.j.x, a.j.z * 1.2);
  v.sort((x, y) => meio(x) - meio(y) || x.id - y.id);
  p.sort((x, y) => meio(x) - meio(y) || x.id - y.id);
  if (v.length) {
    const foco = v[0];
    const resto = v.slice(1).sort((x, y) => Math.hypot(x.j.x - foco.j.x, x.j.z - foco.j.z) - Math.hypot(y.j.x - foco.j.x, y.j.z - foco.j.z) || x.id - y.id).slice(0, 5);
    c.grupoV = { foco, membros: resto, x: foco.j.x, z: foco.j.z };
    foco.festa = 0; foco.podeFixar = false;
    const n = resto.length, f = foco.j;
    resto.forEach((a, i) => {
      a.festa = i + 1; a.podeFixar = false;
      // o lugar dele na roda (o mesmo do desejo): as câmeras escolhidas deixam a lente fora do caminho até lá
      const ang = Math.atan2(-f.z, -f.x) + (i - (n - 1) / 2) * 0.95;
      a.alvoX = f.x + Math.cos(ang) * 0.78; a.alvoZ = f.z + Math.sin(ang) * 0.78;
    });
    const gk = c.atores.find(a => a.tipo === 'vencedor' && a.goleiro);
    if (gk) {
      gk.corre = true; gk.podeFixar = false;
      const dx = f.x - gk.j.x, dz = f.z - gk.j.z, d = Math.hypot(dx, dz) || 1;
      gk.alvoX = f.x - (dx / d) * 1.6; gk.alvoZ = f.z - (dz / d) * 1.6;
    }
  }
  if (p.length >= 2) {
    // o do meio e os 3 perdedores mais perto DELE (um grupo junto: o close pega 2–3; o 2º, o mais perto, levanta o 1º)
    const f0 = p[0].j;
    const g = [p[0], ...p.slice(1).sort((x, y) => Math.hypot(x.j.x - f0.x, x.j.z - f0.z) - Math.hypot(y.j.x - f0.x, y.j.z - f0.z) || x.id - y.id).slice(0, 3)];
    c.grupoP = { membros: g.slice(0, 4) };
    g.slice(0, 4).forEach((a, i) => { a.lamento = i; a.podeFixar = false; });
    const o = g[0].j, b = g[1].j, dx = o.x - b.x, dz = o.z - b.z, d = Math.hypot(dx, dz) || 1;
    g[1].alvoX = o.x - (dx / d) * 0.62; g[1].alvoZ = o.z - (dz / d) * 0.62;
  }
}

/**
 * No corte do começo da cena (o apito; ELIPSE do corte, como as de cena-atores.js recriarAtor): quem vinha correndo para um
 * sólido do estádio (o gol, as placas) e não pararia antes dele pela locomoção (a freada: CENA_FIM.solidos.freio do freio
 * dele) recomeça `solidos.folga` m antes do ponto onde, andando a velAnda, ele para — com a passada viva. O goleiro numa
 * defesa desenhada termina a defesa (fica).
 */
function longeDosSolidos(c, a) {
  const j = a.j, v = Math.hypot(j.vx, j.vz), S = K.solidos;
  if (a.goleiro && j.mergulho) return;
  // já DENTRO de um sólido no apito (quem correu atrás da bola para dentro do gol) ou atrás das placas (quem foi buscar a
  // bola lá fora): reaparece do lado de dentro, para o meio do campo, `folga` m além da borda, parado — senão andava através
  // delas para voltar
  const fora = (x, z) => solidoEm(x, 0.9, z, S.raio, false) || Math.abs(x) > MX + 4.2 || Math.abs(z) > MZ + 4.2;
  if (fora(j.x, j.z)) {
    const l = Math.hypot(j.x, j.z) || 1, ux = -j.x / l, uz = -j.z / l;
    let x = j.x, z = j.z;
    for (let k = 0; k < 80 && fora(x, z); k++) { x += ux * 0.25; z += uz * 0.25; }
    x += ux * S.folga; z += uz * S.folga;
    recriarAtor(c, a, x, z, Math.atan2(uz, ux));
    return;
  }
  if (v < 0.2) return;
  const dx = j.vx / v, dz = j.vz / v, fr = S.freio * (j.par?.freio ?? JOGADOR.freio);
  const pare = (v * v) / (2 * fr);
  let bate = Infinity;
  for (let s = 0.2; s <= pare + S.folga + 1e-9; s += 0.2) {
    if (solidoEm(j.x + dx * s, 0.9, j.z + dz * s, S.raio, false)) { bate = s; break; }
  }
  if (bate === Infinity) return;
  const va = Math.min(v, K.velAnda), pareA = (va * va) / (2 * fr);
  const recuo = Math.max(0, pareA + S.folga - bate);
  const x = j.x - dx * recuo, z = j.z - dz * recuo;
  // (o ponto de trás também no sólido: fica onde está, parado)
  if (solidoEm(x, 0.9, z, S.raio, false)) { recriarAtor(c, a, j.x, j.z, j.rumo); return; }
  recriarAtor(c, a, x, z, j.rumo, { dx, dz, vel: va, ticks: 30 });
}

/**
 * A bola viva da cena nos corpos: a ≤ CENA_FIM.bola.raio m do centro de alguém (no chão), ela sai para a borda e a
 * velocidade dela para dentro dele volta com `bola.volta` (relativa à dele: quem anda nela a toca para a frente).
 */
function bolaNosAtores(c) {
  const b = c.mF.bola, p = b.p, v = b.v, R = K.bola.raio;
  if (p.y > 0.5) return;
  for (const a of c.atores) {
    if (!a.ativo) continue;
    const j = a.j, dx = p.x - j.x, dz = p.z - j.z, d2 = dx * dx + dz * dz;
    if (d2 >= R * R) continue;
    const d = Math.sqrt(d2);
    let nx = Math.cos(j.rumo), nz = Math.sin(j.rumo);
    if (d > 1e-6) { nx = dx / d; nz = dz / d; }
    p.x = j.x + nx * R; p.z = j.z + nz * R;
    const vr = (v.x - j.vx) * nx + (v.z - j.vz) * nz;
    if (vr < 0) { const k = (1 + K.bola.volta) * vr; v.x -= k * nx; v.z -= k * nz; }
  }
}

// ------------------------------------------------------------------------------------------------ desejos
function tPlano(c, nome) { const p = c.plano.planos.find(q => q.nome === nome); return p ? p.t0 : null; }

function desejo(c, a, t) {
  const P = c.plano, arb = c.arbitro.j, j = a.j;
  const tCump = tPlano(c, 'cumprimentos');
  // depois da elipse do túnel (intervalo): todos andam para a boca do túnel (a frente do vão primeiro)
  if (c.noTunel && a.tipo !== 'tecnico') return andarTunel(c, a);
  // o fim: o melhor em campo em pé no lugar dele (de frente para a câmera, um pouco virado para a torcida)
  if (c.noMelhor && a === c.melhorA) return para(c, 0, a.rumoMelhor);
  if (c.noAplauso && a.aplaude) return irPara(c, a, a.alvoX, a.alvoZ, 1.25, a.rumoAlvo, 0.2, 1.2);
  // o par da troca de camisa: lado a lado, andando juntos até o ponto dele (e para ali)
  if (a.trocaAlvo) return irPara(c, a, a.trocaAlvo.x, a.trocaAlvo.z, K.troca.vel, Math.PI / 2, 0.08, 1.0);
  if (a.tipo === 'tecnico') {
    // o aperto dos treinadores (o fim): cada um anda até a metade dele e para de frente para o outro
    if (a.trAlvo) return irPara(c, a, a.trAlvo.x, a.trAlvo.z, K.treinadores.vel, a.trAlvo.rumo, 0.03, 1.4);
    return parar(c, a, 0, 0);
  }
  if (a === c.arbitro) {
    // (o fim: ele sai da frente da lente como os outros — o caminho até quem vai cumprimentá-lo é escolhido depois da câmera
    // do plano; no aperto de mão ele fica)
    if (P.tipo === 'fimDeJogo' && !(c.parArbitro && c.parArbitro.t0 >= 0 && !c.parArbitro.cortado)) {
      const fl = fugirDaLente(c, a, K.lenteLivre);
      if (fl) return desviar(c, a, fl);
    }
    // no fim: anda ao encontro de quem vem cumprimentá-lo (até 2,4 m dele) e para de frente
    if (c.parArbitro && !c.parArbitro.cortado) {
      const g = c.parArbitro.jog.j, dx = g.x - j.x, dz = g.z - j.z, d = Math.hypot(dx, dz) || 1;
      if (c.parArbitro.t0 < 0 && d > 2.4) return irPara(c, a, g.x - (dx / d) * 2.2, g.z - (dz / d) * 2.2, 1.5, Math.atan2(dz, dx), 0.15, 1.5);
      return parar(c, a, g.x, g.z);
    }
    if (P.resultado === 'intervalo' || t < (tCump ?? Infinity)) return parar(c, a, 0, TUNEL.z);
    return parar(c, a, j.x - 1, j.z);
  }
  if (a.tipo === 'assistente') {
    const fl = fugirDaLente(c, a, K.lenteLivre);
    if (fl) return desviar(c, a, fl);
    // o trio se junta: os assistentes andam para perto do árbitro
    if (t < 1.2) return parar(c, a, arb.x, arb.z);
    const dx = arb.x - j.x, dz = arb.z - j.z, d = Math.hypot(dx, dz) || 1;
    const k = Math.max(0, d - 2.2);
    return desviar(c, a, irPara(c, a, j.x + (dx / d) * Math.min(k, 30), j.z + (dz / d) * Math.min(k, 30), K.velAnda, Math.atan2(dz, dx), 0.3, 1.2));
  }
  // quem não é do plano sai da frente da lente (a de agora e, perto do corte, a do próximo)
  // (os assuntos do plano de agora ficam: a festa no 'vencedor', o lamento no 'perdedor'; os pares e quem vai ao árbitro
  // sempre)
  const nomeAgora = c.ip >= 0 && c.ip < P.planos.length ? P.planos[c.ip].nome : '';
  // (quem vai cumprimentar o árbitro também foge: ele é escolhido depois da câmera do plano — o caminho dele não entrou na
  // escolha — e não é o assunto de plano nenhum)
  const assunto = a.par || ((a.festa != null || a.corre) && nomeAgora === 'vencedor') || (a.lamento != null && nomeAgora === 'perdedor')
    || (a === c.melhorA && nomeAgora === 'melhor');
  if (!assunto) {
    // (os closes do fim têm a lente fechada: a 4,6 m quem passa já enche o quadro; até 2,05 s depois do apito, andando —
    // todos desaceleram: quem tinha acabado de frear ia a 2,8 m/s para trás, fugindo da lente do próximo plano)
    const fl = fugirDaLente(c, a, K.lenteLivre);
    if (fl) { if (t < 2.05) fl.vel = Math.min(fl.vel, K.velAnda); return desviar(c, a, fl); }
  } else if (P.tipo === 'fimDeJogo') {
    // (o fim: nem o assunto chega na lente — quem corria para a roda da festa ou andava para o par não freava a tempo)
    const fl = fugirDaLente(c, a, K.lenteDura);
    if (fl) return desviar(c, a, fl);
  }
  // o jogador que cumprimenta o árbitro no fim: vai até ele (0,86 m), de frente
  if (a.vaiArbitro) {
    const dx = arb.x - j.x, dz = arb.z - j.z, d = Math.hypot(dx, dz) || 1, meia = K.aperto.dist;
    // (até 2,05 s depois do apito, andando: todos desaceleram; depois trota se está longe)
    return desviar(c, a, irPara(c, a, arb.x - (dx / d) * meia, arb.z - (dz / d) * meia, t < 2.05 ? K.velAnda : d > 6 ? 2.6 : K.velAnda + 0.2, Math.atan2(dz, dx), 0.03, 1.4));
  }
  // os pares do aperto de mão: andam um para o outro (a partir de 1,0 s; os da vitória, de 2,2 s: até 2,0 s depois do
  // apito todos desaceleram)
  if (a.par) {
    const p = a.par, o = p.a === a ? p.b : p.a;
    // (no intervalo a partir de 0,6 s: o aperto de 1 s acaba antes do túnel, aos 4 s)
    const t0 = P.resultado === 'intervalo' ? K.aperto.tIntervalo : P.resultado === 'empate' ? 1.0 : 2.2;
    if (t < t0 || p.feito) return parar(c, a, o.j.x, o.j.z);
    const mx = (j.x + o.j.x) / 2, mz = (j.z + o.j.z) / 2, dx = o.j.x - j.x, dz = o.j.z - j.z, d = Math.hypot(dx, dz) || 1;
    const meia = K.aperto.dist / 2;
    return irPara(c, a, mx - (dx / d) * meia, mz - (dz / d) * meia, K.velAnda, Math.atan2(dz, dx), 0.03, 1.4);
  }
  // fim com vencedor: o grupo da festa (abraço em volta do foco; o goleiro vem correndo)
  // (só depois de 2,05 s: até 2,0 s depois do apito todos desaceleram — ninguém acima de 1,6 m/s)
  if (P.resultado === 'vitoria' && t >= 2.05 && t < (tCump ?? 99)) {
    const G = c.grupoV;
    if (G && a.festa != null && a.festa > 0) {
      const f = G.foco.j, k = a.festa - 1, n = G.membros.length;
      const ang = Math.atan2(-f.z, -f.x) + (k - (n - 1) / 2) * 0.95;
      const vx = f.x + Math.cos(ang) * 0.78, vz = f.z + Math.sin(ang) * 0.78;
      return desviar(c, a, irPara(c, a, vx, vz, Math.hypot(vx - j.x, vz - j.z) > 4 ? 4.2 : 2.2, Math.atan2(f.z - j.z, f.x - j.x), 0.1, 3));
    }
    if (a.corre && G) {
      const f = G.foco.j, dx = f.x - j.x, dz = f.z - j.z, d = Math.hypot(dx, dz) || 1;
      return irPara(c, a, f.x - (dx / d) * 1.6, f.z - (dz / d) * 1.6, t > 2.2 ? 5.5 : 1.2, null, 0.4, 3);
    }
  }
  // o lamento: o 2º do grupo vai até o 1º (agachado) para levantá-lo — até os cumprimentos (o tapinha acaba ali) e só com o
  // 1º ainda no lamento (a elipse da troca ou a do melhor o tira do grupo: antes o 2º corria atrás dele até o fim da cena,
  // passando no close da troca)
  if (P.resultado === 'vitoria' && a.lamento === 1 && c.grupoP && t >= tPlano(c, 'perdedor') - 0.6 && t < (tCump ?? Infinity)
    && c.grupoP.membros[0].lamento === 0) {
    const o = c.grupoP.membros[0].j, dx = o.x - j.x, dz = o.z - j.z, d = Math.hypot(dx, dz) || 1;
    return irPara(c, a, o.x - (dx / d) * 0.62, o.z - (dz / d) * 0.62, 2.4, Math.atan2(dz, dx), 0.05, 2);
  }
  return parar(c, a, arb.x, arb.z);
}

/**
 * Na fila do túnel (intervalo): até a frente do vão das placas (|x| ≤ 1,6 m, z 39,5: o vão tem ±3 m) e depois para dentro
 * da boca do túnel (z 47,5); quem chega a funil.entra some dentro dela (passoCenaFim).
 */
function andarTunel(c, a) {
  const j = a.j;
  const wx = clamp(j.x * 0.3, -1.6, 1.6), wz = 39.5;
  const antes = j.z < wz - 0.6;
  const x = antes ? wx : TUNEL.x, z = antes ? wz : TUNEL.z + 3;
  return desviar(c, a, irPara(c, a, x, z, a.velTunel ?? K.velAnda, null, 0.2, 1.2));
}

// ------------------------------------------------------------------------------------------------ gestos
function gestos(c, a, t) {
  const P = c.plano, o = a.atu, h = a.j.rumo;
  const tCampo = tPlano(c, 'campo'), tVenc = tPlano(c, 'vencedor'), tPerd = tPlano(c, 'perdedor'), tNeutro = tPlano(c, 'neutro');
  const tCump = tPlano(c, 'cumprimentos'), tApl = tPlano(c, 'aplauso'), tTr = tPlano(c, 'treinador');
  if (a === c.arbitro) {
    gApito(o, h, janela(t, 0.08, 0.9, 0.12, 0.2));
    const alvoX = P.tipo === 'intervalo' ? TUNEL.x : 0, alvoZ = P.tipo === 'intervalo' ? TUNEL.z : 0;
    gAponta(o, h, 1, alvoX, P.tipo === 'intervalo' ? 2 : 0.3, alvoZ, janela(t, 0.95, 2.6, 0.2, 0.3));
    apertoArbitro(c, a, t);
    return;
  }
  if (a.tipo === 'assistente') return;
  if (a.tipo === 'tecnico') { gestosTreinador(c, a, t, tTr); return; }
  // o melhor em campo (o fim): palmas na frente do peito e depois o braço erguido para a torcida
  if (c.noMelhor && a === c.melhorA) {
    const t0 = tPlano(c, 'melhor') ?? 0, P0 = K.melhor.palmas;
    gPalmas(o, h, t, janela(t, t0 + 0.25, t0 + P0, 0.3, 0.35));
    gSoco(o, h, 1, janela(t, t0 + P0 + 0.2, t0 + K.melhor.dura + 1, 0.4, 0.3));
    return;
  }
  // o par da troca (o fim): abraçados (o braço de dentro nas costas do outro) enquanto andam juntos
  if (a.trocaAlvo && c.trocou && c.troca) {
    const o2 = a === c.troca.a ? c.troca.b : c.troca.a;
    if (o2.trocaAlvo && !o2.aplaude) {
      const t0 = tPlano(c, 'troca') ?? 0;
      gAbraco(o, h, a.trocaLado, o2.atu, o2.j.rumo, janela(t, t0 - 0.1, t0 + 3.0, 0.05, 0.4));
      return;
    }
  }
  if (c.noTunel) {
    if (a.cabisbaixo) posturaCabisbaixo(o, h, 1);
    else if (a.conversa != null) conversar(c, a);
    return;
  }
  if (c.noAplauso && a.aplaude) { gPalmasAlto(o, h, t, suave((t - tApl - 0.2) / 0.35)); return; }
  // o aperto com o árbitro (fim)
  if (a.vaiArbitro && c.parArbitro && c.parArbitro.t0 >= 0) {
    const p = c.parArbitro, w = janela(t, p.t0, p.t0 + 1.0, 0.25, 0.3);
    if (w > 0) {
      const pa = a.atu, pb = c.arbitro.atu, pe = J.pelve * 3;
      const my = K.aperto.altura + K.aperto.amp * Math.sin(2 * Math.PI * K.aperto.sacode * (t - p.t0));
      gAperto(pa, a.j.rumo, (pa[pe] + pb[pe]) / 2, my, (pa[pe + 2] + pb[pe + 2]) / 2, w);
      return;
    }
  }
  // quem perde no intervalo: a cabeça baixa no campo (o placar pesa no gesto), antes das mãos na cintura
  const perdeIntervalo = P.resultado === 'intervalo' && P.vencedor != null && a.time === 1 - P.vencedor;
  if (perdeIntervalo) posturaCabisbaixo(o, h, janela(t, 1.0, 1e9, 0.5, 0.3));
  if (a.par) { aperto(c, a, t); if (!a.par.ativo) cintura(c, a, t); return; }
  if (P.resultado === 'intervalo' || P.resultado === 'empate') {
    // mãos na cintura (ou nos joelhos) depois do apito, enquanto o plano é de campo
    const t0 = 1.0, t1 = P.resultado === 'intervalo' ? tCampo + 2.5 + 0.1 : tNeutro + 3.0 + 0.6;
    if (a.joelhos) gJoelhos(o, a.j, janela(t, t0 + 0.4, t1, 0.5, 0.4));
    else gCintura(o, h, janela(t, t0, t1, 0.45, 0.4));
    return;
  }
  // vitória: a festa do grupo (os dois braços para o céu, socos e pulos) e o lamento
  if (a.festa != null) { festa(c, a, t, tVenc); return; }
  if (a.corre) { gCeu(o, h, janela(t, tVenc + 0.6, tCump, 0.3, 0.4)); return; }
  if (a.lamento != null) { lamento(c, a, t, tPerd, tCump); return; }
  if (a.tipo === 'vencedor') { gSoco(o, h, a.id % 2 ? 1 : -1, janela(t, tVenc + 0.4, tCump, 0.4, 0.4)); return; }
  if (a.tipo === 'perdedor') {
    if (a.joelhos) gJoelhos(o, a.j, janela(t, 1.2, tCump + 1.5, 0.5, 0.4));
    else { posturaCabisbaixo(o, h, janela(t, 1.0, 1e9, 0.5, 0.3)); gCintura(o, h, janela(t, 1.0, tCump, 0.5, 0.4)); }
  }
}

/** Mãos na cintura (os pares antes e depois do aperto). */
function cintura(c, a, t) {
  if (c.plano.resultado === 'vitoria') return;
  gCintura(a.atu, a.j.rumo, janela(t, 1.0, 1e9, 0.45, 0.3) * (a.par && a.par.ativo ? 0 : 1));
}

/** O aperto de mão de um par: as mãos direitas no meio dos dois (a ~1,06 m), sacudindo duas vezes. */
function aperto(c, a, t) {
  const p = a.par, o = p.a === a ? p.b : p.a;
  // (cortado por uma elipse: encerrarAperto)
  if (p.cortado) { p.ativo = false; return; }
  const d = Math.hypot(a.j.x - o.j.x, a.j.z - o.j.z);
  // (no fim — vitória e empate — o aperto é no plano dos cumprimentos: os pares esperam um de frente para o outro, no empate
  // com as mãos na cintura; antes o empate apertava a mão no 'neutro' ou até no 'apito' e a câmera dos cumprimentos pegava o
  // par já parado)
  const tMin = c.plano.tipo === 'fimDeJogo' ? (tPlano(c, 'cumprimentos') ?? 7) - 0.2 : 1.0;
  if (!p.feito && p.t0 < 0 && t >= tMin && d >= 0.8 && d <= K.aperto.dist + 0.12 && Math.hypot(a.j.vx, a.j.vz) < 0.35 && Math.hypot(o.j.vx, o.j.vz) < 0.35) p.t0 = t;
  const dur = 1.0;
  p.ativo = p.t0 >= 0 && t < p.t0 + dur + 0.3;
  if (p.t0 >= 0 && t > p.t0 + dur + 0.3) p.feito = true;
  if (p.t0 < 0) return;
  const w = janela(t, p.t0, p.t0 + dur, 0.25, 0.3);
  if (w <= 0) return;
  // o ponto: o meio das duas pelves, a ~1,06 m, sacudindo
  const pa = a.atu, pb = o.atu, pe = J.pelve * 3;
  const mx = (pa[pe] + pb[pe]) / 2, mz = (pa[pe + 2] + pb[pe + 2]) / 2;
  const my = K.aperto.altura + K.aperto.amp * Math.sin(2 * Math.PI * K.aperto.sacode * (t - p.t0)) * suave((t - p.t0) / 0.3);
  gAperto(pa, a.j.rumo, mx, my, mz, w);
}

/** O árbitro cumprimenta um jogador no fim (o 1º do par que já apertou a mão chega nele). */
function apertoArbitro(c, a, t) {
  const p = c.parArbitro;
  if (!p || p.t0 < 0 || p.cortado) return;
  const w = janela(t, p.t0, p.t0 + 1.0, 0.25, 0.3);
  if (w <= 0) return;
  const o = p.jog, pa = a.atu, pb = o.atu, pe = J.pelve * 3;
  const my = K.aperto.altura + K.aperto.amp * Math.sin(2 * Math.PI * K.aperto.sacode * (t - p.t0));
  gAperto(pa, a.j.rumo, (pa[pe] + pb[pe]) / 2, my, (pa[pe + 2] + pb[pe + 2]) / 2, w);
}

/** A festa do vencedor: os dois braços para o céu, depois socos alternados; o foco pula. */
function festa(c, a, t, tVenc) {
  const o = a.atu, h = a.j.rumo, k = a.festa;
  const w = janela(t, tVenc + 0.1 + 0.08 * k, tPlano(c, 'cumprimentos') ?? 99, 0.3, 0.4);
  if (w <= 0) return;
  if (k % 3 === 2) { gSoco(o, h, -1, w, 0.08 * Math.sin(2 * Math.PI * 2.2 * t)); gSoco(o, h, 1, w, -0.08 * Math.sin(2 * Math.PI * 2.2 * t)); }
  else gCeu(o, h, w);
  // pulos do grupo (os pés saem do chão: a régua do pé plantado não vale aqui, como no pulo do grupo da comemoração),
  // só parado no lugar dele
  const G = c.grupoV, f = G ? G.foco.j : null;
  const noLugar = k === 0 ? Math.hypot(a.j.vx, a.j.vz) < 0.3 : f && Math.hypot(a.j.x - f.x, a.j.z - f.z) < 1.0 && Math.hypot(a.j.vx, a.j.vz) < 0.4;
  if (noLugar && w > 0.5) {
    const sn = Math.sin(2 * Math.PI * 1.8 * (t - tVenc));
    const dy = sn > 0 ? 0.13 * sn * w : 0;
    if (dy > 0) { moverTudo(o, dy); a.noAr = true; }
  }
}

/** O lamento do perdedor: o 1º agachado com as mãos na cabeça (levantado pelo 2º), o 3º com as mãos nos joelhos, o 4º cabisbaixo com as mãos na cabeça. */
function lamento(c, a, t, tPerd, tCump) {
  const o = a.atu, h = a.j.rumo, i = a.lamento;
  if (i === 0) {
    // agacha no apito e levanta quando o companheiro chega (a mão nas costas)
    const lev = c.levantou ?? Infinity;
    const w = janela(t, 1.0, Math.min(lev + 0.6, tCump), 0.6, 0.6);
    posturaAgachado(o, a.j, w);
    gCabeca(o, h, w);
    posturaCabisbaixo(o, h, Math.max(w, janela(t, 1.0, 1e9, 0.5, 0.5) * 0.8));
  } else if (i === 1) {
    const ag = c.grupoP.membros[0];
    const d = Math.hypot(a.j.x - ag.j.x, a.j.z - ag.j.z);
    const w = suave((1.0 - d) / 0.3) * janela(t, tPerd - 0.4, tCump, 0.2, 0.3);
    if (w > 0.9 && c.levantou == null) c.levantou = t;
    gTapinha(o, h, -1, ag.atu, ag.j.rumo, t, w);
    posturaCabisbaixo(o, h, janela(t, 1.0, 1e9, 0.5, 0.3) * (1 - w));
  } else if (i === 2) gJoelhos(o, a.j, janela(t, 1.0, tCump + 1.0, 0.5, 0.4));
  else { gCabeca(o, h, janela(t, 1.0, tCump, 0.5, 0.4)); posturaCabisbaixo(o, h, janela(t, 1.0, 1e9, 0.5, 0.3)); }
}

/** Conversando no túnel: a cabeça virada para o vizinho (o rumo do corpo segue o caminho). */
function conversar(c, a) {
  const o = a.atu, viz = c.atores[a.conversa];
  if (!viz || !viz.ativo) return;
  const ic = J.cabeca * 3, ip = J.pescoco * 3;
  const dx = viz.j.x - a.j.x, dz = viz.j.z - a.j.z, d = Math.hypot(dx, dz) || 1;
  const hx = o[ic] - o[ip], hy = o[ic + 1] - o[ip + 1], hz = o[ic + 2] - o[ip + 2];
  const lh = Math.hypot(hx, hz);
  o[ic] = o[ip] + (dx / d) * lh * 0.9 + hx * 0.1; o[ic + 2] = o[ip + 2] + (dz / d) * lh * 0.9 + hz * 0.1; o[ic + 1] = o[ip + 1] + hy;
}

/**
 * O treinador (gancho, só no fim): os dois se cumprimentam na frente do túnel (c.trPar: o aperto de mão quando os dois
 * chegam, parados e a 0,8–1,04 m); sem o outro, o do vencedor comemora (socos no ar).
 */
function gestosTreinador(c, a, t, tTr) {
  if (tTr == null) return;
  const p = c.trPar;
  if (p && (a === p.a || a === p.b)) {
    const o = p.a === a ? p.b : p.a;
    const d = Math.hypot(a.j.x - o.j.x, a.j.z - o.j.z);
    if (p.t0 < 0 && t >= tTr && d >= 0.8 && d <= K.aperto.dist + 0.12 && Math.hypot(a.j.vx, a.j.vz) < 0.35 && Math.hypot(o.j.vx, o.j.vz) < 0.35) p.t0 = t;
    if (p.t0 < 0) return;
    const w = janela(t, p.t0, p.t0 + 1.0, 0.25, 0.3);
    if (w <= 0) return;
    const pa = a.atu, pb = o.atu, pe = J.pelve * 3;
    const my = K.aperto.altura + K.aperto.amp * Math.sin(2 * Math.PI * K.aperto.sacode * (t - p.t0)) * suave((t - p.t0) / 0.3);
    gAperto(pa, a.j.rumo, (pa[pe] + pb[pe]) / 2, my, (pa[pe + 2] + pb[pe + 2]) / 2, w);
    return;
  }
  if (c.plano.vencedor !== a.timeT) return;
  const o = a.atu, h = a.j.rumo, w = janela(t, tTr + 0.1, tTr + 2.0, 0.2, 0.3);
  const s = Math.sin(2 * Math.PI * 1.5 * (t - tTr));
  gSoco(o, h, -1, w, 0.08 * s); gSoco(o, h, 1, w, 0.08 * s);
}

// ------------------------------------------------------------------------------------------------ passo e planos
/** O plano no tempo t (s): o de planoNoTempo, menos o bloco dos lances ainda por tocar (o plano de antes dele fica até a espera). */
function planoAgora(c, t) {
  const ip = planoNoTempo(c, t);
  return !c.lancesVistos && c.iLances >= 0 && ip >= c.iLances && ip < c.plano.planos.length ? c.iLances - 1 : ip;
}

/** A bola da cena: um passo da física (bola.js, a cópia) e o par anterior/atual para o desenho interpolar. */
function passoBolaCena(c) {
  const b = c.mF.bola.p;
  c.bola0.x = c.bola1.x; c.bola0.y = c.bola1.y; c.bola0.z = c.bola1.z;
  if (c.bolaViva) { bolaNosAtores(c); passoBola(c.mF.bola, null); }
  c.bola1.x = b.x; c.bola1.y = b.y; c.bola1.z = b.z;
}

/**
 * Um tick (1/60 s). Devolve false quando não andou: a cena acabou, ou espera os lances (c.emLances, até seguirCenaFim).
 * No fim do jogo a cena continua viva no plano geral (respirando) depois do último plano.
 */
export function passoCenaFim(c) {
  if (c.acabou || c.emLances) return false;
  // o bloco dos lances: a cena espera no começo dele (a página toca os lances e chama seguirCenaFim)
  if (!c.lancesVistos && c.k >= c.kLances) { c.emLances = true; return false; }
  // a lente do plano de agora e, 0,9 s antes do corte, a do próximo (escolhida já; fica para o plano): quem está na frente
  // dela sai (cena-atores.js fugirDaLente)
  lentes(c, c.k * PASSO);
  passoAtores(c, desejo, gestos);
  passoBolaCena(c);
  const t = c.k * PASSO, P = c.plano;
  // no túnel: quem chegou à boca some dentro dela
  if (c.noTunel) for (const a of c.atores) if (a.ativo && a.tipo !== 'tecnico' && a.j.z >= K.funil.entra) { a.ativo = false; a.entrou = c.k; }
  // o aperto com o árbitro (fim; UEFA Art. 50.04): a partir de 1,0 s, o jogador de linha livre (sem par, fora da festa e
  // do lamento) do time que NÃO vai aplaudir a torcida (a elipse do aplauso não o leva) mais perto dele vai até ele e ele
  // vem ao encontro; apertam a mão no plano dos cumprimentos
  const tc = tPlano(c, 'cumprimentos');
  if (P.tipo === 'fimDeJogo' && !c.parArbitro && tc != null && t >= 1.0) {
    let melhor = null, dm = Infinity;
    for (const a of c.atores) {
      if (!a.ativo || (a.time !== 0 && a.time !== 1) || a.tipo === 'tecnico' || a.par || a.goleiro || a.corre || a.festa === 0 || (a.lamento != null && a.lamento < 2)) continue;
      // (nem o par da troca de camisa nem o melhor em campo: a elipse deles os leva para outro lugar depois)
      if (c.troca && (a === c.troca.a || a === c.troca.b)) continue;
      if (a === c.melhorA) continue;
      const d = Math.hypot(a.j.x - c.arbitro.j.x, a.j.z - c.arbitro.j.z) + (a.time === P.timeHumano ? 25 : 0) + (a.festa != null || a.lamento != null ? 40 : 0);
      if (d < dm) { dm = d; melhor = a; }
    }
    if (melhor) {
      c.parArbitro = { jog: melhor, t0: -1 }; melhor.vaiArbitro = true; soltar(melhor);
      const A = c.arbitro.j, mx = (A.x + melhor.j.x) / 2, mz = (A.z + melhor.j.z) / 2;
      c.arbitro.alvoX = mx; c.arbitro.alvoZ = mz; melhor.alvoX = mx; melhor.alvoZ = mz;
      if (melhor.festa != null && c.grupoV) { c.grupoV.membros = c.grupoV.membros.filter(q => q !== melhor); melhor.festa = null; }
      if (melhor.lamento != null && c.grupoP) { c.grupoP.membros = c.grupoP.membros.filter(q => q !== melhor); melhor.lamento = null; }
    }
  }
  if (c.parArbitro && c.parArbitro.t0 < 0 && !c.parArbitro.cortado && tc != null && t >= tc + 0.2) {
    const jg = c.parArbitro.jog, d = Math.hypot(jg.j.x - c.arbitro.j.x, jg.j.z - c.arbitro.j.z);
    if (d <= K.aperto.dist + 0.12 && d >= 0.8 && Math.hypot(jg.j.vx, jg.j.vz) < 0.35) c.parArbitro.t0 = t;
  }
  const pl = P.planos;
  // (o bloco dos lances ainda por tocar: o plano de antes dele fica até a espera)
  const ip = planoAgora(c, t);
  if (ip !== c.ip && ip < pl.length) entrarPlano(c, ip);
  // eventos da torcida: no plano 'torcida' (o placar decide palmas, vaia ou festa)
  if (!c.evTorcida && ip < pl.length && pl[ip].nome === 'torcida') eventoTorcida(c);
  if (c.k >= c.kGeral) c.acabou = true;
  return true;
}

/** A reação da torcida pelo placar (emocao.js e festa.js 'cenaFim'), uma vez. */
function eventoTorcida(c) {
  c.evTorcida = true;
  c.eventos.push({ tipo: 'cenaFim', fim: c.plano.tipo, placar: { ...c.plano.placar }, vencedor: c.plano.vencedor });
}

/** Avança a cena dt s reais (relógio do desenho). Devolve alfa; os ticks em c.ticksUltimo. */
export function avancarCenaFim(c, dt) {
  c.ticksUltimo = 0;
  if (c.acabou || c.emLances) { c.alfa = 1; c.acum = 0; return 1; }
  c.acum += Math.max(0, dt);
  while (c.acum >= PASSO - 1e-9 && !c.acabou) {
    if (!passoCenaFim(c)) { c.acum = 0; break; }
    c.acum -= PASSO; c.ticksUltimo++;
  }
  if (c.acum < 0) c.acum = 0;
  c.alfa = c.acabou || c.emLances ? 1 : Math.min(1, c.acum / PASSO);
  return c.alfa;
}
export function tempoCenaFim(c) { return tempoDe(c); }
/** Duração até o plano geral (s, sem os lances, que tocam com a cena parada). */
export function duracaoCenaFim(c) { return c.kFim * PASSO; }
/** Os lances acabaram (ou foram pulados): a cena segue para o próximo bloco. */
export function seguirCenaFim(c) {
  c.lancesVistos = true;
  c.emLances = false;
  // o bloco seguinte já no tick da espera (o estado desenhado: c.ip)
  const ip = planoAgora(c, c.k * PASSO);
  if (ip !== c.ip && ip < c.plano.planos.length) entrarPlano(c, ip);
}

/**
 * O plano do estado desenhado: o do último tick andado (c.ip). (Pelo relógio desenhado, tempoDe, o 1º quadro depois de um
 * corte com alfa < 1 cairia ainda no plano de antes — a câmera dele com os atores já recriados pela elipse do novo.)
 */
function planoDesenhado(c) {
  const n = c.plano.planos.length;
  return c.ip >= 0 && c.ip < n ? c.ip : planoAgora(c, tempoDe(c));
}

/** Nome do plano no estado desenhado ('lances' na espera dos lances; 'fim' quando a cena do fim acaba). */
export function faseFim(c) {
  if (c.acabou) return 'fim';
  if (c.emLances) return 'lances';
  const ip = planoDesenhado(c);
  return ip < c.plano.planos.length ? c.plano.planos[ip].nome : 'geral';
}
/** A tarja do placar com os autores no estado desenhado (no relógio da cena; nunca na espera dos lances). */
export function tarjaPlacarVisivel(c) {
  const T = c.plano.tarja;
  if (!T || c.acabou || c.emLances) return false;
  // (o fim: o plano 'placar' do estado desenhado — o mesmo relógio das estatísticas e do melhor em campo, sem um quadro com
  // as duas peças juntas no corte)
  if (c.plano.tipo === 'fimDeJogo') return faseFim(c) === 'placar';
  const t = tempoDe(c);
  return t >= T.de - 1e-9 && t < T.ate - 1e-9;
}

/** A tarja do melhor em campo no estado desenhado (o fim: o plano 'melhor' inteiro). */
export function tarjaMelhorVisivel(c) {
  return !c.acabou && !c.emLances && !!c.melhorA && faseFim(c) === 'melhor';
}

/** Vai direto ao plano ip (os pulos: proximoBloco, pularParaGeral), sem interpolar. */
function irParaPlano(c, ip) {
  const pl = c.plano.planos[ip];
  if (!pl) return;
  const k = Math.round(pl.t0 / PASSO);
  if (c.k < k) c.k = k;
  c.acum = 0; c.alfa = 1;
  c.noTunel = false; c.noAplauso = false;
  if (ip > c.iLances && c.iLances >= 0) { c.lancesVistos = true; c.emLances = false; }
  entrarPlano(c, ip);
  for (const a of c.atores) { a.ant.set(a.atu); a.x0 = a.x1; a.z0 = a.z1; a.r0 = a.r1; }
  c.bola0.x = c.bola1.x; c.bola0.y = c.bola1.y; c.bola0.z = c.bola1.z;
}

/**
 * O pulo pedido (um aperto/toque novo depois de CENAS.pularDepois): o PRÓXIMO BLOCO, como o pré-jogo — os planos de campo
 * → os lances (ou as estatísticas) → as estatísticas → o geral. Nos lances quem pula é a página (o lance que toca; o
 * próximo bloco depois dele). Devolve o nome do plano em que a cena ficou.
 */
export function proximoBloco(c) {
  if (c.acabou) return 'fim';
  const pl = c.plano.planos, f = faseFim(c);
  const iEst = pl.findIndex(p => p.nome === 'estatisticas'), iGeral = pl.findIndex(p => p.nome === 'geral');
  if (f === 'geral') return 'geral';
  // o fim: os planos de campo → o melhor em campo → o placar → as estatísticas → o geral
  if (c.plano.tipo === 'fimDeJogo') {
    const ip = planoDesenhado(c);
    for (let i = ip + 1; i < pl.length; i++) {
      if (!BLOCOS_FIM[pl[i].nome]) continue;
      if (pl[i].nome === 'geral') pularParaGeral(c); else irParaPlano(c, i);
      return faseFim(c);
    }
    return faseFim(c);
  }
  if (f === 'lances') { seguirCenaFim(c); irParaPlano(c, iEst >= 0 ? iEst : iGeral); return faseFim(c); }
  if (f === 'estatisticas') { pularParaGeral(c); return faseFim(c); }
  // os planos de campo: o bloco dos lances (a espera) ou o seguinte
  if (c.iLances >= 0 && !c.lancesVistos) {
    // (vai para o fim da torcida: o passo seguinte entra na espera)
    const k = s60(c.plano.tLances);
    if (c.k < k) { irParaPlano(c, Math.max(0, c.iLances - 1)); c.k = k; }
    c.emLances = true;
    return 'lances';
  }
  irParaPlano(c, iEst >= 0 ? iEst : iGeral);
  return faseFim(c);
}

/**
 * Pulo para o plano geral (o "Pular" da cena): no intervalo o campo fica vazio (a página corre os passos do intervalo e a
 * saída acaba a cena); no fim os atores ficam onde estão, respirando.
 */
export function pularParaGeral(c) {
  if (c.acabou) return;
  const ig = c.plano.planos.findIndex(p => p.nome === 'geral');
  if (ig < 0) return;
  c.lancesVistos = true; c.emLances = false;
  if (c.ip === ig) return;
  irParaPlano(c, ig);
}

/** Os blocos do fim (o toque vai ao próximo deles). */
const BLOCOS_FIM = { melhor: true, placar: true, estatisticas: true, geral: true };
const LENTE_LIVRE = { campo: true, neutro: true, cumprimentos: true, vencedor: true, perdedor: true, treinador: true, troca: true, melhor: true };
const _opcLente = { pequena: false, aspecto: 16 / 9 }, _pcLente = criarPlanoCena(), _camDe = { x: 0, z: 0 }, _camDe2 = { x: 0, z: 0 };
function lentes(c, t) {
  const P0 = c.plano.planos, ia = planoAgora(c, t);
  c.camDe = null; c.camDe2 = null;
  if (ia < P0.length && LENTE_LIVRE[P0[ia].nome]) { planoIndice(c, ia, t, _opcLente, _pcLente); _camDe.x = _pcLente.de[0]; _camDe.z = _pcLente.de[2]; c.camDe = _camDe; }
  if (ia + 1 < P0.length && LENTE_LIVRE[P0[ia + 1].nome] && P0[ia + 1].t0 - t <= 0.9) {
    if (!c.cams[ia + 1]) c.cams[ia + 1] = escolherCamera(c, ia + 1);
    planoIndice(c, ia + 1, P0[ia + 1].t0, _opcLente, _pcLente); _camDe2.x = _pcLente.de[0]; _camDe2.z = _pcLente.de[2]; c.camDe2 = _camDe2;
  }
}

/** Entra no plano ip: as elipses (túnel, aplauso), o campo vazio do intervalo e a câmera dele. */
function entrarPlano(c, ip) {
  c.ip = ip;
  const nome = c.plano.planos[ip].nome;
  c.noTunel = false;
  if (nome === 'tunel') elipseTunel(c);
  if (nome === 'aplauso') elipseAplauso(c);
  if (nome === 'troca') elipseTroca(c);
  if (nome === 'treinador') elipseTreinadores(c);
  if (nome === 'melhor') elipseMelhor(c);
  if (nome === 'torcida' && c.plano.tipo === 'fimDeJogo') elipseTorcida(c, ip);
  if (nome !== 'aplauso' && c.noAplauso) c.noAplauso = nome === 'torcida' || nome === 'geral';
  // intervalo: depois do túnel ninguém mais em campo (quem não entrou é cortado pela elipse) e a bola sai do desenho
  if (c.plano.tipo === 'intervalo' && VAZIO[nome]) esvaziar(c);
  if (nome === 'tunel') c.noTunel = true;
  // (o fim: o plano da torcida pulado pelo toque — a torcida reage assim mesmo, no bloco seguinte)
  if (c.plano.tipo === 'fimDeJogo' && !c.evTorcida) { const it = c.plano.planos.findIndex(p => p.nome === 'torcida'); if (it >= 0 && ip > it) eventoTorcida(c); }
  // (a câmera do plano já pode ter sido escolhida 0,9 s antes do corte; as elipses escolhem de novo, com as posições novas)
  if (!c.cams[ip] || ELIPSES[nome]) c.cams[ip] = escolherCamera(c, ip);
  c.cortes++;
}

/** Os planos que começam com uma ELIPSE (a câmera é escolhida de novo no corte, com as posições novas). */
const ELIPSES = { tunel: true, aplauso: true, troca: true, treinador: true, melhor: true };

/** O campo vazio do intervalo: os atores fora (já no vestiário) e a bola fora do desenho (o árbitro a levou). */
function esvaziar(c) {
  for (const a of c.atores) a.ativo = false;
  c.bolaVisivel = false; c.bolaViva = false;
  c.vazio = true;
}

/**
 * ELIPSE do intervalo: os 22 e o trio numa fila de funil.d m da boca do túnel (o trio na frente, depois os jogadores pelo
 * hash, misturados como saem do campo), andando para ela. Os treinadores já entraram (saem antes: ficam fora do desenho).
 */
function elipseTunel(c) {
  const P = c.plano, F = K.funil;
  for (const a of c.treinadores) a.ativo = false;
  const lista = c.atores.filter(a => a.tipo !== 'tecnico' && a.ativo);
  lista.sort((x, y) => (x.time === 2 ? 0 : 1) - (y.time === 2 ? 0 : 1) || (hashGol(P.tick, x.id) % 1009) - (hashGol(P.tick, y.id) % 1009) || x.id - y.id);
  const n = lista.length;
  lista.forEach((a, i) => {
    const u = i / Math.max(1, n - 1);
    const d = lerp(F.d[0], F.d[1], u);
    // o funil abre com a distância: ±(0,9 + 0,42·(d − d0)) m de lado, em fileiras de 3
    const fila = i % 3, larg = 0.9 + 0.42 * (d - F.d[0]);
    const lado = (fila - 1) * larg * 0.55 + ((hashGol(P.tick, a.id + 7) % 100) / 100 - 0.5) * 0.5;
    const x = clamp(lado, -20, 20), z = TUNEL.z - Math.sqrt(Math.max(1, d * d - lado * lado));
    // o caminho dele (o mesmo de andarTunel): a câmera escolhida deixa a lente fora dele
    const wx = clamp(x * 0.3, -1.6, 1.6), antes = z < 39.5 - 0.6;
    const tx = antes ? wx : TUNEL.x, tz = antes ? 39.5 : TUNEL.z + 3;
    const dx = tx - x, dz = tz - z, l = Math.hypot(dx, dz) || 1;
    a.velTunel = lerp(F.vel[0], F.vel[1], ((hashGol(P.tick, a.id + 3) % 100) / 100));
    recriarAtor(c, a, x, z, Math.atan2(dz, dx), { dx: dx / l, dz: dz / l, vel: a.velTunel, ticks: 45 });
    a.podeFixar = false;
    a.alvoX = tx; a.alvoZ = tz;
    a.cabisbaixo = P.vencedor != null && a.time === 1 - P.vencedor;
    a.conversa = null;
  });
  // quem ganha (ou, no empate, todos) conversa com o vizinho da frente do mesmo time
  for (let i = 0; i < lista.length; i++) {
    const a = lista[i];
    if (a.cabisbaixo || a.time === 2) continue;
    for (let k = i + 1; k < Math.min(lista.length, i + 4); k++) if (lista[k].time === a.time) { a.conversa = c.atores.indexOf(lista[k]); break; }
  }
  // a bola fica no campo, fora do desenho (o árbitro a leva)
  c.bolaVisivel = false; c.bolaViva = false;
}

/** ELIPSE do fim: o time do humano a 8–10 m da própria torcida (fundo dele), andando para ela batendo palmas. */
function elipseAplauso(c) {
  const P = c.plano, th = P.timeHumano;
  const sx = th === 1 ? -1 : 1;     // a torcida do time 0 é a organizada (fundo +x); a do 1, o setor visitante (−x)
  const frente = 62.5;
  const time = c.atores.filter(a => a.time === th && a.tipo !== 'tecnico');
  time.sort((x, y) => x.id - y.id);
  // ao lado do gol (longe dele e da rede), num bloco em duas fileiras: a câmera atrás deles pega o time inteiro e a
  // arquibancada (o lado de z pelo hash)
  const zs = (P.hash >>> 5) & 1 ? 1 : -1;
  c.zAplauso = zs * K.aplauso.zMeio;
  time.forEach((a, i) => {
    const fila = i % 2, k = i >> 1;
    const d = lerp(K.aplauso.d[0], K.aplauso.d[1], fila);
    const z = zs * (K.aplauso.z0 + k * 2.1 + fila * 1.05);
    const x = sx * (frente - d) - sx * fila * 0.4;
    a.alvoX = sx * (frente - 4.6); a.alvoZ = z; a.rumoAlvo = sx > 0 ? 0 : Math.PI;
    encerrarAperto(c, a);
    recriarAtor(c, a, x, z, a.rumoAlvo, { dx: sx, dz: 0, vel: 1.2, ticks: 40 });
    a.aplaude = true; a.podeFixar = false; a.trocaAlvo = null;
  });
  // os outros (o outro time e o trio) perto da câmera ou na frente dela reaparecem no meio-campo (no mesmo corte)
  const cx = sx * (62.5 - 10 - K.camera.aplauso.atras);
  let k = 0;
  for (const a of c.atores) {
    if (a.aplaude || a.tipo === 'tecnico' || !a.ativo) continue;
    if (Math.abs(a.j.x - cx) < 16 && Math.abs(a.j.z) < 26 && a.j.x * sx > cx * sx - 14) {
      // (a vaga livre: a ≥ 1,2 m de quem está ativo — antes um podia reaparecer em cima de outro que já estava ali)
      let x = 0, z = 0;
      for (let tent = 0; tent < 40; tent++, k++) {
        x = -sx * (4 + (k % 5) * 2.2); z = (Math.floor(k / 5) - 1) * 3.1 + (k % 2) * 0.9;
        let livre = true;
        for (const b of c.atores) if (b !== a && b.ativo && Math.hypot(b.j.x - x, b.j.z - z) < 1.2) { livre = false; break; }
        if (livre) break;
      }
      encerrarAperto(c, a);
      recriarAtor(c, a, x, z, sx > 0 ? 0 : Math.PI);
      a.alvoX = x; a.alvoZ = z; a.trocaAlvo = null;
      k++;
    }
  }
  c.noAplauso = true;
}

/**
 * O corte de uma ELIPSE leva `a` para outro lugar: o aperto de mão dele — com o par ou com o árbitro, no meio ou ainda por
 * fazer — acaba no corte (os dois param onde estão; ninguém atravessa o campo para terminá-lo). Antes a elipse da troca (ou a
 * do aplauso) levava um dos dois no meio do aperto: o braço do outro esticava até o meio das pelves e quem foi levado voltava
 * andando para terminar.
 */
function encerrarAperto(c, a) {
  const p = a.par;
  if (p && !p.feito) { p.feito = true; p.cortado = true; p.ativo = false; }
  const pa = c.parArbitro;
  if (pa && (a === pa.jog || a === c.arbitro)) {
    // (já feito, só ninguém volta andando até o outro)
    if (!(pa.t0 >= 0 && c.k * PASSO > pa.t0 + 1.3)) pa.cortado = true;
    pa.jog.vaiArbitro = false;
  }
}

/**
 * Quem está a menos de `raio` m de algum dos pontos (o lugar do assunto, a lente) reaparece do outro lado do campo, em
 * fileiras livres (≥ 1,2 m de qualquer um), olhando para a TV — no mesmo corte da elipse que chama. `exceto`: os assuntos.
 */
function afastar(c, pts, raio, exceto) {
  let k = c.estacionados ?? 0;
  for (const a of c.atores) {
    if (!a.ativo || exceto.includes(a) || a.tipo === 'tecnico') continue;
    let perto = false;
    for (const [px, pz] of pts) if (Math.hypot(a.j.x - px, a.j.z - pz) < raio) { perto = true; break; }
    if (!perto) continue;
    let x = 0, z = 0;
    for (let tent = 0; tent < 60; tent++, k++) {
      x = ((k % 7) - 3) * 2.3; z = -15 - Math.floor(k / 7) * 2.4;
      let livre = true;
      for (const b of c.atores) if (b !== a && b.ativo && Math.hypot(b.j.x - x, b.j.z - z) < 1.2) { livre = false; break; }
      for (const [px, pz] of pts) if (Math.hypot(px - x, pz - z) < raio) livre = false;
      if (livre) break;
    }
    k++;
    encerrarAperto(c, a);
    recriarAtor(c, a, x, z, Math.PI / 2);
    a.alvoX = x; a.alvoZ = z; a.trocaAlvo = null; a.aplaude = false; a.podeFixar = false;
  }
  c.estacionados = k;
}

/** O lugar do par da troca de camisa e da câmera dele (pelo plano: o mesmo na escolha antecipada e na elipse). */
function lugarTroca(c) {
  const T = c.troca, x0 = T.sx * K.troca.x, z0 = K.troca.z, C = K.camera.troca;
  return { x0, z0, cx: x0 + T.sx * C.lado, cz: z0 + C.frente };
}

/**
 * ELIPSE da troca de camisa (o fim): o par lado a lado (o de time 0 à esquerda de quem anda), andando para a câmera, já
 * com a camisa do outro (camisaDe: a página desenha o kit misto) e abraçados; para `troca` m adiante. Quem está perto do
 * caminho ou da lente reaparece do outro lado.
 */
function elipseTroca(c) {
  const T = c.troca;
  if (!T) return;
  const L = lugarTroca(c), meia = K.troca.lado / 2, zf = L.z0 + 2.6, v = K.troca.vel;
  // (rumo +z: a direita de quem anda é −x; o de time 0 à esquerda, +x)
  recriarAtor(c, T.a, L.x0 + meia, L.z0, Math.PI / 2, { dx: 0, dz: 1, vel: v, ticks: 45 });
  recriarAtor(c, T.b, L.x0 - meia, L.z0, Math.PI / 2, { dx: 0, dz: 1, vel: v, ticks: 45 });
  T.a.trocaAlvo = { x: L.x0 + meia, z: zf }; T.b.trocaAlvo = { x: L.x0 - meia, z: zf };
  T.a.trocaLado = 1; T.b.trocaLado = -1;
  for (const a of [T.a, T.b]) { a.alvoX = a.trocaAlvo.x; a.alvoZ = a.trocaAlvo.z; a.podeFixar = false; a.aplaude = false; a.par = null; a.festa = null; a.lamento = null; a.corre = false; }
  T.a.camisaDe = T.b.id; T.b.camisaDe = T.a.id;
  c.trocou = true;
  afastar(c, [[L.x0, L.z0], [L.x0, zf], [L.cx, L.cz]], 4.5, [T.a, T.b]);
}

/**
 * ELIPSE dos treinadores (o fim, com os dois): entre as áreas técnicas, na frente do túnel, andando um para o outro (o
 * mandante vem do lado do banco dele, x < 0); apertam a mão (gestosTreinador). Com um só, nada muda.
 */
function elipseTreinadores(c) {
  const t0 = c.treinadores.find(a => a.timeT === 0), t1 = c.treinadores.find(a => a.timeT === 1);
  if (!t0 || !t1) return;
  const Kt = K.treinadores, z = Kt.z, meia = K.aperto.dist / 2;
  recriarAtor(c, t0, -Kt.x, z, 0, { dx: 1, dz: 0, vel: Kt.vel, ticks: 30 });
  recriarAtor(c, t1, Kt.x, z, Math.PI, { dx: -1, dz: 0, vel: Kt.vel, ticks: 30 });
  t0.trAlvo = { x: -meia, z, rumo: 0 }; t1.trAlvo = { x: meia, z, rumo: Math.PI };
  t0.alvoX = -meia; t0.alvoZ = z; t1.alvoX = meia; t1.alvoZ = z;
  c.trPar = { a: t0, b: t1, t0: -1 };
  const C = K.camera.treinadores, sx = (c.plano.hash >>> 3) & 1 ? 1 : -1;
  afastar(c, [[0, z], [sx * C.x, C.z]], 5, [t0, t1]);
}

/**
 * O plano da torcida do fim (um corte): quem está a menos de 4,5 m do trilho da câmera (prejogo-roteiro.js cameraDoPlano, o
 * da planta do estádio) reaparece do outro lado — no fim os jogadores ainda estão em campo (no intervalo o campo já está
 * vazio).
 */
const _cpT = {};
function elipseTorcida(c, ip) {
  const cam = c.cams[ip] ?? (c.cams[ip] = escolherCamera(c, ip));
  if (!cam.trilho) return;
  const pts = [];
  for (let k = 0; k <= 6; k++) { const q = cameraDoPlano(cam.trilho, k / 6, _cpT, cam.ajuste); if (q.py < 6) pts.push([q.px, q.pz]); }
  if (pts.length) afastar(c, pts, 4.5, []);
}

/** O lugar do melhor em campo e da câmera dele (pelo plano). */
function lugarMelhor(c) {
  const sx = c.plano.timeHumano === 1 ? -1 : 1, Km = K.melhor, C = K.camera.melhor;
  const x = sx * Km.x, z = Km.z;
  return { x, z, cx: x + sx * C.lado, cz: z + C.frente };
}

/**
 * ELIPSE do melhor em campo (o fim): em pé num lugar livre do lado da TV (entre o meio-campo e a torcida do time da
 * pessoa), de frente para a câmera e um pouco virado para a torcida do time dele; quem está perto dele ou da lente reaparece
 * do outro lado. Ele fica ali até o fim da cena.
 */
function elipseMelhor(c) {
  const a = c.melhorA;
  if (!a) return;
  const L = lugarMelhor(c), fx = a.time === 1 ? -1 : 1;
  const rumo = Math.atan2(L.cz - L.z, L.cx - L.x) - fx * K.melhor.vira;
  encerrarAperto(c, a);
  recriarAtor(c, a, L.x, L.z, rumo);
  a.ativo = true; a.rumoMelhor = rumo; a.trocaAlvo = null; a.aplaude = false; a.podeFixar = false; a.par = null; a.festa = null; a.lamento = null;
  a.alvoX = L.x; a.alvoZ = L.z;
  c.noMelhor = true;
  afastar(c, [[L.x, L.z], [L.cx, L.cz]], K.melhor.livre, [a]);
}

// ------------------------------------------------------------------------------------------------ câmera
const _a = [];
/**
 * melhorCamera com uma 2ª fileira: sem candidata livre na 1ª (alguém na lente ou no caminho até ela em todas), as mesmas
 * direções `fator`× mais longe e mais uma a cada meio passo de ângulo, com o fov fechado na mesma razão (o assunto do mesmo
 * tamanho) — antes a escolha caía na de maior folga só pela posição de agora, e quem corria passava na lente.
 */
function melhorComFileira(c, cands, assuntos, sx, sz, fov, fator = 1.5) {
  const r = melhorCamera(c, cands, assuntos);
  if (r.custo < Infinity) return { ...r, fov };
  // (a 2ª fileira: a volta inteira, 16 direções, a do lado da TV com preferência)
  const mais = [], d0 = cands.length ? Math.hypot(cands[0].x - sx, cands[0].z - sz) : 8, d = d0 * fator, y = (cands[0]?.y ?? 1.8) + 0.4;
  for (let i = 0; i < 16; i++) {
    const a0 = (i / 16) * 2 * Math.PI, lado = Math.abs(Math.atan2(Math.sin(a0 - Math.PI / 2), Math.cos(a0 - Math.PI / 2)));
    mais.push({ x: sx + Math.cos(a0) * d, y, z: sz + Math.sin(a0) * d, pref: 0.5 + 0.4 * lado });
  }
  const r2 = melhorCamera(c, mais, assuntos);
  if (r2.custo < Infinity) return { ...r2, fov: (Math.atan(Math.tan((fov * Math.PI) / 360) / fator) * 360) / Math.PI };
  return { ...r, fov };
}
function escolherCamera(c, ip) {
  const P = c.plano, nome = P.planos[ip].nome, C = K.camera, arb = c.arbitro;
  switch (nome) {
    case 'apito': {
      // alto e aberto, do lado da TV, mais perto do árbitro que o plano geral
      const x = clamp(arb.j.x * 0.75, -40, 40), z = MZ + 4.5;
      return { x, y: C.apito.altura, z, fov: C.apito.fov };
    }
    case 'campo': case 'neutro': case 'cumprimentos': {
      // o 1º par do aperto (ou o árbitro) de lado, do lado da TV
      const p = c.pares[0];
      const sx = p ? (p.a.j.x + p.b.j.x) / 2 : arb.j.x, sz = p ? (p.a.j.z + p.b.j.z) / 2 : arb.j.z;
      const D = nome === 'cumprimentos' ? C.cumprimentos : C.campo;
      const cands = [];
      for (const da of [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1]) {
        const a0 = Math.PI / 2 + da;
        cands.push({ x: sx + Math.cos(a0) * D.dist, y: D.altura, z: sz + Math.sin(a0) * D.dist, pref: Math.abs(da) * 0.4 });
      }
      _a.length = 0; if (p) _a.push(p.a, p.b); else _a.push(arb);
      // (o fim: a 2ª fileira se a 1ª estiver tomada — o intervalo como era)
      if (P.tipo === 'fimDeJogo') return { ...melhorComFileira(c, cands, _a, sx, sz, D.fov), sx, sz };
      return { ...melhorCamera(c, cands, _a), sx, sz, fov: D.fov };
    }
    case 'tunel': {
      const T = C.tunel;
      const cands = [];
      for (const sg of [1, -1]) for (const dz of [0, -0.6, 0.5]) cands.push({ x: sg * T.x, y: T.y, z: T.z + dz });
      _a.length = 0;
      return { ...melhorCamera(c, cands, _a), fov: T.fov };
    }
    case 'vencedor': {
      const G = c.grupoV;
      const f = G ? G.foco.j : arb.j;
      const cands = [];
      for (const da of [0, 0.4, -0.4, 0.8, -0.8, 1.3, -1.3]) {
        const a0 = Math.PI / 2 + da;
        cands.push({ x: f.x + Math.cos(a0) * C.grupo.dist, y: C.grupo.altura, z: f.z + Math.sin(a0) * C.grupo.dist, pref: Math.abs(da) * 0.3 });
      }
      _a.length = 0; if (G) _a.push(G.foco);
      return melhorComFileira(c, cands, _a, f.x, f.z, C.grupo.fov);
    }
    case 'perdedor': {
      const g = c.grupoP;
      const f = g ? g.membros[0].j : arb.j;
      // (o 2º do lamento vai até o 1º, agachado — o destino dele de verdade, para a lente ficar fora do caminho: antes o alvo
      // era o da fuga da lente do plano anterior, e ele atravessava a câmera)
      if (g && g.membros[1]) {
        const b = g.membros[1], dx = f.x - b.j.x, dz = f.z - b.j.z, d = Math.hypot(dx, dz) || 1;
        b.alvoX = f.x - (dx / d) * 0.62; b.alvoZ = f.z - (dz / d) * 0.62;
      }
      const cands = [];
      for (const da of [0, 0.4, -0.4, 0.8, -0.8, 1.3, -1.3, 2.0, -2.0]) {
        const a0 = Math.PI / 2 + da;
        cands.push({ x: f.x + Math.cos(a0) * C.close.dist, y: C.close.altura, z: f.z + Math.sin(a0) * C.close.dist, pref: Math.abs(da) * 0.3 });
      }
      _a.length = 0; if (g) _a.push(g.membros[0]);
      return melhorComFileira(c, cands, _a, f.x, f.z, C.close.fov);
    }
    case 'treinador': {
      // os dois: de lado, do campo, olhando a frente do túnel (o lado de x pelo hash)
      if (c.trPar || (c.treinadores.some(a => a.timeT === 0) && c.treinadores.some(a => a.timeT === 1))) {
        const T = C.treinadores, sx = (P.hash >>> 3) & 1 ? 1 : -1;
        return { x: sx * T.x, y: T.altura, z: T.z, fov: T.fov, dois: true };
      }
      const tr = c.treinadores.find(a => a.timeT === P.vencedor) ?? c.treinadores[0];
      const sx = tr ? tr.j.x : 0;
      return { x: sx + (sx >= 0 ? -3 : 3), y: C.treinador.altura, z: 33, fov: C.treinador.fov, alvo: tr };
    }
    case 'troca': {
      if (!c.troca) return { geral: true };
      const L = lugarTroca(c);
      return { x: L.cx, y: C.troca.altura, z: L.cz, fov: C.troca.fov };
    }
    case 'melhor': {
      if (!c.melhorA) return { geral: true };
      const L = lugarMelhor(c);
      return { x: L.cx, y: C.melhor.altura, z: L.cz, fov: C.melhor.fov };
    }
    case 'aplauso': {
      const sx = P.timeHumano === 1 ? -1 : 1, z = c.zAplauso ?? 12;
      return { x: sx * (62.5 - 10 - C.aplauso.atras), y: C.aplauso.altura, z, fov: C.aplauso.fov, olharX: sx * 66, olharZ: z };
    }
    // a torcida pelo placar: a do mandante (a organizada) se ele não perde, a visitante se o visitante ganha
    case 'torcida': return { trilho: P.vencedor === 1 ? 'visitantes' : 'organizada', ajuste: P.ajustePlano ?? null };
    default: return { geral: true };
  }
}

/** O plano geral do estádio (o do estádio de forma própria, se veio; senão o de sempre). */
function planoGeral(c, out, nome) {
  const G = c.plano.cameraGeral ?? CAMERA_GERAL;
  out.nome = nome;
  out.de[0] = G.de[0]; out.de[1] = G.de[1]; out.de[2] = G.de[2]; out.para[0] = G.para[0]; out.para[1] = G.para[1]; out.para[2] = G.para[2]; out.fov = G.fov;
  return out;
}

/**
 * Plano de câmera do estado desenhado: out = {nome, de, para, fov, tunel (o vão das placas aberto)}. opc = {pequena,
 * aspecto}. Na espera dos lances, o plano geral ('lances'). Pura.
 */
export function planoCameraFim(c, opc, out) {
  out.tunel = false;
  if (c.acabou) { out.nome = 'fim'; return out; }
  if (c.emLances) return planoGeral(c, out, 'lances');
  return planoIndice(c, planoDesenhado(c), tempoDe(c), opc, out);
}

/** O plano ip no tempo t (s) com as posições desenhadas de agora. */
function planoIndice(c, ip, t, opc, out) {
  out.tunel = false;
  const pl = c.plano.planos[ip];
  if (!pl) { out.nome = 'fim'; return out; }
  const cam = c.cams[ip] ?? (c.cams[ip] = escolherCamera(c, ip));
  const al = c.alfa, arb = c.arbitro;
  switch (pl.nome) {
    case 'apito': {
      const ax = lerp(arb.x0, arb.x1, al), az = lerp(arb.z0, arb.z1, al);
      return definirPlano(out, 'apito', cam.x, cam.y, cam.z, ax, 0.5, az, cam.fov, opc);
    }
    case 'campo': case 'neutro': case 'cumprimentos': {
      const p = c.pares[0];
      _g.length = 0;
      if (p) _g.push(lerp(p.a.x0, p.a.x1, al), lerp(p.a.z0, p.a.z1, al), lerp(p.b.x0, p.b.x1, al), lerp(p.b.z0, p.b.z1, al));
      else _g.push(lerp(arb.x0, arb.x1, al), lerp(arb.z0, arb.z1, al));
      return definirPlanoGrupo(out, pl.nome, cam.x, cam.y, cam.z, _g, 1.0, cam.fov, opc);
    }
    case 'tunel': {
      definirPlano(out, 'tunel', cam.x, cam.y, cam.z, 0, 1.2, 28, cam.fov, opc);
      out.tunel = true;
      return out;
    }
    case 'vencedor': case 'perdedor': {
      const g = pl.nome === 'vencedor' ? c.grupoV : c.grupoP;
      _g.length = 0;
      // (o close do lamento: o agachado — quem chega para levantá-lo entra no quadro sozinho, sem a câmera pular)
      _l.length = 0;
      if (!g) _l.push(arb);
      else if (pl.nome === 'vencedor') _l.push(g.foco, ...g.membros.slice(0, 2));
      else _l.push(g.membros[0]);
      for (const a of _l) _g.push(lerp(a.x0, a.x1, al), lerp(a.z0, a.z1, al));
      definirPlanoGrupo(out, pl.nome, cam.x, cam.y, cam.z, _g, 1.0, cam.fov, opc);
      _cab.length = 0; for (const a of _l) _cab.push(a.atu);
      return caberNoQuadro(out, opc, _cab);
    }
    case 'treinador': {
      if (cam.dois && c.trPar) {
        const p = c.trPar;
        _g.length = 0;
        _g.push(lerp(p.a.x0, p.a.x1, al), lerp(p.a.z0, p.a.z1, al), lerp(p.b.x0, p.b.x1, al), lerp(p.b.z0, p.b.z1, al));
        return definirPlanoGrupo(out, 'treinador', cam.x, cam.y, cam.z, _g, 1.3, cam.fov, opc);
      }
      const tr = cam.alvo;
      return definirPlano(out, 'treinador', cam.x, cam.y, cam.z, tr ? lerp(tr.x0, tr.x1, al) : 0, 1.3, tr ? lerp(tr.z0, tr.z1, al) : 36, cam.fov, opc);
    }
    case 'troca': {
      const T = c.troca;
      if (!T || cam.geral) return planoGeral(c, out, 'troca');
      _g.length = 0;
      _g.push(lerp(T.a.x0, T.a.x1, al), lerp(T.a.z0, T.a.z1, al), lerp(T.b.x0, T.b.x1, al), lerp(T.b.z0, T.b.z1, al));
      return definirPlanoGrupo(out, 'troca', cam.x, cam.y, cam.z, _g, 1.3, cam.fov, opc);
    }
    case 'melhor': {
      const a = c.melhorA;
      if (!a || cam.geral) return planoGeral(c, out, 'melhor');
      return definirPlano(out, 'melhor', cam.x, cam.y, cam.z, lerp(a.x0, a.x1, al), K.camera.melhor.olhar, lerp(a.z0, a.z1, al), cam.fov, opc);
    }
    case 'aplauso': return definirPlano(out, 'aplauso', cam.x, cam.y, cam.z, cam.olharX, 5.5, cam.olharZ, cam.fov, opc);
    case 'torcida': {
      const u = clamp((t - pl.t0) / Math.max(0.1, pl.t1 - pl.t0), 0, 1);
      const q = cameraDoPlano(cam.trilho, u, _cp, cam.ajuste);
      out.nome = 'torcida';
      out.de[0] = q.px; out.de[1] = q.py; out.de[2] = q.pz; out.para[0] = q.lx; out.para[1] = q.ly; out.para[2] = q.lz; out.fov = q.fov;
      return out;
    }
    // os blocos de tela (as estatísticas, o placar e o melhor em campo do fim) e o geral: o plano geral do estádio
    default: return planoGeral(c, out, pl.nome);
  }
}
const _cp = {}, _g = [], _l = [], _cab = [];
export { criarPlanoCena as criarPlanoCameraFim };

/** Eventos novos da cena (a reação da torcida no plano dela); esvazia a fila. */
export function consumirEventosFim(c, out = []) {
  out.length = 0;
  for (const e of c.eventos) out.push(e);
  c.eventos.length = 0;
  return out;
}

/** Informação para testes e API: por ator {id, time, tipo, x, z, rumo, v, fixo, ativo, kit, goleiro, recriado, par, entrou}. */
export function infoAtoresFim(c) {
  return c.atores.map(a => ({
    id: a.id, time: a.time, tipo: a.tipo, x: a.j.x, z: a.j.z, rumo: a.j.rumo, v: Math.hypot(a.j.vx, a.j.vz), fixo: a.fixo,
    ativo: a.ativo, kit: a.kit, goleiro: a.goleiro, recriado: a.recriado, par: a.par ? a.par.k : null, entrou: a.entrou ?? null,
    camisaDe: a.camisaDe ?? null, melhor: a === c.melhorA,
  }));
}
