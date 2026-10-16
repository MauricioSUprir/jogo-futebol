// Modo Livre 3D (pedido do dono de 16/10: "adicione tbm um modo livre, como no fifa, um modo de treino, onde pode ter a
// quantidade de jogadores que eu escolher, contra a quantidade de jogadores que eu escolher, pode ser adaptável durante a
// partida" — a Arena de Treino do EA FC). PURO: sem three.js nem DOM; só MD. Carregado por import dinâmico só no Livre
// (main.js; a parte da página é o livre-pagina.js). Contrato em CONTRATOS.md ("Modo Livre"); constantes em config.js LIVRE.
//
// O mundo é o da partida (criarPartida: os dois times, o estádio, a mesma simulação e a mesma IA) com m.modo = 'livre' e
// m.livre (FORA do hash: hashMundo não o lê) = {linha: [a, b] (de linha em campo por time), goleiro: [g0, g1], fora: {id:
// o jogador guardado quando saiu}, ajustes: quantas mudanças, pressao: [a da tática de cada time]}. A escolha vale por
// time: de 0 a LIVRE.linhaMax (10) de linha (o time do humano com ≥ 1: o humano precisa de alguém) e o goleiro liga e
// desliga à parte (as formações têm só 10 vagas de linha: 11 sem goleiro não existe). A 1ª vez: LIVRE.padrao (5 contra 5
// com os dois goleiros).
//
// Quem está em campo: cada time tem as 11 vagas da formação dele (m.times[t].vagas, os 11 titulares); quem está fora fica
// na vaga como "buraco" (m.times[t].expulsos — o mesmo buraco da expulsão, que a partida já sabe ler: cobradorDaSaida, o
// editor...). Os de linha ocupam SEMPRE as vagas de maior prioridade (prioridadeVagas, LIVRE.prioridade: ZAG central,
// ATA central, meio central, PE, 2º ZAG, PD, 2º meio, LE, LD, o resto — o PE vem antes do 2º zagueiro, ao contrário da
// sugestão do contrato: com 4 de linha, 2 zagueiros + meio + centroavante chutavam 3,7 vezes em 2 min, de 1 a 6 por
// semente, e ZAG, ATA, meio e PE, 5,6, de 5 a 7, com as mesmas trocas de posse; 12 sementes IA × IA). Todo jogador em
// campo tem vaga (vagaIdx válido) e a IA joga com as referências dessas vagas, juntas perto da bola com poucos de linha
// (comprimirLivre, LIVRE.compressao: kx 0,45/kz 0,55/bola 0,35 → o 3 contra 3 trocava a posse 7,3 vezes em 2 min com a
// bola rolando e o 5 contra 5 chutava 5,6 vezes; 0,35/0,45/0,5 → 8,7 e 5,9, com ninguém mais longe da bola). Time com até
// LIVRE.pressaoAlta (7) de linha joga com a pressão Alta (o 1º e o 2º homem apertam sempre, no campo todo: jogo reduzido
// é jogado em intensidade alta — na Média o 3 contra 3 trocava a posse ~4,5 vezes em 2 min, quase sempre por bola fora);
// acima disso, a tática do time (m.livre.pressao).
//
// A mudança (ajustarJogadores) é uma ação-objeto do passo ({tipo: 'livreAjuste', linha, goleiro}, como a 'editarTime'), sem
// recomeçar: quem fica continua onde está; quem sai some (a vaga de menor prioridade sai primeiro, LIVRE.saidaDist m mais
// longe da bola valem uma posição — nunca o controlado; a bola que estava no pé dele fica solta onde estava); quem entra
// aparece no ponto tático da vaga dele (teleporte: corpo e pés zerados — nada de corpo arrastado sem passada), a ≥
// LIVRE.afastar m de quem já está em campo. Com uma bola parada montada, ela é montada de novo com quem ficou.
//
// Regras (passoLivre = passoPartida com m.livre): sem relógio (minutos por tempo LIVRE.relogioMin: nunca acaba; o relógio
// fica escondido na página), sem intervalo, sem impedimento (impedimento.js; na IA a linha fica só como forma e nenhum
// passe é recusado por ela — com menos de 2 adversários ela fica a LIVRE.linhaSemDefesa m da linha de fundo: ia-ataque.js),
// sem faltas nem cartões (faltas.js, defesa.js). Gol vale e o placar conta; a saída é do time que sofreu se ele tiver
// alguém de linha, senão do outro (partida.js montarSaida); bola fora: lateral, escanteio e tiro de meta da partida quando
// o time que cobra tem alguém de linha (o tiro de meta pelo goleiro, ou pelo de linha sem ele), senão a cobrança passa
// para o outro time (cobrancaSemLinha). As regras do goleiro (8 s, recuo, a mão só na área) continuam. "Quem cobrou não
// toca de novo" (m.cobrou) não vale para quem é o único de linha do time: sozinho ele nunca mais tocaria a bola.
//
// Ganchos (partida.js ganchosLivre, ligados ao carregar este módulo, só rodam com m.livre): comprimirLivre (ia-tatica.js
// referencias) e cobrancaSemLinha (partida.js regrasPartida, na montagem da bola parada). Assim a partida não carrega o
// código do Livre (teste-carga).

import { LIVRE, CAMPO, BOLA, PARTIDA } from './config.js';
import { MD } from './matdet.js';
import { clamp } from './mat.js';
import { jogadorPorId } from './sim.js';
import { criarJogador } from './jogador.js';
import { criarCond } from './conducao.js';
import { atributosDe, fichaDe } from './elenco.js';
import { FORMACOES } from './formacoes.js';
import { vestirVaga } from './escalacao.js';
import { posicaoTatica } from './tatica.js';
import { assumirControle } from './acoes.js';
import { criarPartida, passoPartida, entradaDemoPartida, teleportar, montarSaida, bolaMorta, vagaDoJogador, temLinha, ganchosLivre } from './partida.js';

const ehLinha = o => o.posicao !== 'GOL';

// ------------------------------------------------------------------------------------ ganchos na partida e na IA

/**
 * As referências da IA com poucos de linha (ia-tatica.js referencias chama, só com m.livre: partida.js ganchosLivre): com
 * N < LIVRE.compressao.nCheio de linha no time t, as referências `ref` (Float64Array de 22: x, z por vaga) das vagas
 * OCUPADAS chegam ao centro delas — × kx na profundidade e × kz na largura com 1 de linha, até × 1 com nCheio — e o centro
 * anda a fração `bola` (com 1 de linha; 0 com nCheio) para a bola de referência. As vagas de 11 com 3 de linha deixavam o
 * time espalhado (um zagueiro 25 m atrás do resto, ninguém perto da bola). Só escreve nas vagas ocupadas. Pura.
 */
export function comprimirLivre(m, t, ref, bola) {
  const C = LIVRE.compressao;
  let n = 0, cx = 0, cz = 0;
  for (const o of m.jogadores) {
    if (o.time !== t || !ehLinha(o) || o.vagaIdx == null) continue;
    n++; cx += ref[2 * o.vagaIdx]; cz += ref[2 * o.vagaIdx + 1];
  }
  if (n === 0 || n >= C.nCheio) return;
  cx /= n; cz /= n;
  const f = (n - 1) / (C.nCheio - 1);
  const kx = C.kx + (1 - C.kx) * f, kz = C.kz + (1 - C.kz) * f, w = C.bola * (1 - f);
  const sx = (bola.x - cx) * w, sz = (bola.z - cz) * w;
  const MX = CAMPO.meioX - 1, MZ = CAMPO.meioZ - 1;
  for (const o of m.jogadores) {
    if (o.time !== t || !ehLinha(o) || o.vagaIdx == null) continue;
    const k = o.vagaIdx;
    ref[2 * k] = clamp(cx + (ref[2 * k] - cx) * kx + sx, -MX, MX);
    ref[2 * k + 1] = clamp(cz + (ref[2 * k + 1] - cz) * kz + sz, -MZ, MZ);
  }
}

/**
 * A bola morta `pr` é de um time sem ninguém de linha para cobrar (partida.js regrasPartida chama na montagem, só com
 * m.livre): o tiro de meta pelo goleiro dele vale; senão a cobrança passa para o outro time — o escanteio vira tiro de meta
 * dele, o tiro de meta sem goleiro vira escanteio dele, o lateral e o tiro livre ficam no mesmo ponto.
 */
export function cobrancaSemLinha(m, pr) {
  if (temLinha(m, pr.time)) return;
  const gk = t => m.jogadores.some(o => o.time === t && !ehLinha(o));
  if (pr.tipo === 'tiroDeMeta' && gk(pr.time)) return;
  const t = 1 - pr.time;
  if (!temLinha(m, t) && !(pr.tipo === 'escanteio' && gk(t))) return;
  if (pr.tipo === 'escanteio') pr.tipo = 'tiroDeMeta';
  else if (pr.tipo === 'tiroDeMeta') {
    pr.tipo = 'escanteio';
    pr.x = (pr.x >= 0 ? 1 : -1) * (CAMPO.meioX - 0.4); pr.z = (pr.z >= 0 ? 1 : -1) * (CAMPO.meioZ - 0.4);
  } else if (pr.tipo === 'penalti') pr.tipo = 'tiroLivre';
  pr.time = t;
  pr.raio = PARTIDA.raio[pr.tipo];
}

// ligados ao carregar o módulo (só rodam com m.livre)
ganchosLivre.comprimir = comprimirLivre;
ganchosLivre.cobranca = cobrancaSemLinha;
/** Time com a bola (no pé, nas mãos ou com o passe no ar) ou null. */
function timeDaBola(m) {
  const id = m.naMao ?? m.posse;
  if (id != null) { const j = jogadorPorId(m, id); return j ? j.time : null; }
  return m.voo && m.voo.time != null ? m.voo.time : null;
}

// ------------------------------------------------------------------------------------ a escolha

/**
 * A escolha {linha: [a, b], goleiro: [g0, g1]} dentro dos limites: inteiros de 0 a LIVRE.linhaMax, o time do humano
 * (`humano`; null = nenhum, IA × IA) com ≥ 1 de linha; o goleiro é booleano. Sem valor, o de `base` (ou LIVRE.padrao).
 */
export function normalizarEscolha(e, humano = 0, base = LIVRE.padrao) {
  const L = LIVRE.linhaMax;
  const linha = [0, 1].map(t => {
    const v = Math.round(Number(e?.linha?.[t] ?? base.linha[t]));
    const n = clamp(Number.isFinite(v) ? v : base.linha[t], 0, L);
    return t === humano ? Math.max(1, n) : n;
  });
  const goleiro = [0, 1].map(t => (typeof e?.goleiro?.[t] === 'boolean' ? e.goleiro[t] : !!base.goleiro[t]));
  return { linha, goleiro };
}

/** Total em campo do time t numa escolha (o número da pausa: linha + goleiro). */
export function totalDe(e, t) { return e.linha[t] + (e.goleiro[t] ? 1 : 0); }

/** A escolha de agora (o que está em campo) do mundo do Livre. */
export function escolhaDoMundo(m) {
  const linha = [0, 0], goleiro = [false, false];
  for (const o of m.jogadores) { if (ehLinha(o)) linha[o.time]++; else goleiro[o.time] = true; }
  return { linha, goleiro };
}

const _prio = new Map();
/**
 * Vagas de linha da formação na ordem de prioridade (a 1ª ocupada primeiro): cada item de LIVRE.prioridade pega a vaga
 * livre que casa com ele mais perto do meio (|z| sem a bola; empate pela ordem da formação); as que sobram vão no fim, na
 * ordem da formação. 4-3-3: ZE, ATA, VOL, ZD, PE, PD, MCE, LE, LD, MCD.
 */
export function prioridadeVagas(formacao) {
  let r = _prio.get(formacao);
  if (r) return r;
  const vagas = FORMACOES[formacao].vagas.filter(v => v.grupo !== 'gol');
  const usadas = new Set();
  r = [];
  for (const posicoes of LIVRE.prioridade) {
    let mel = null;
    for (const v of vagas) {
      if (usadas.has(v.id) || !posicoes.includes(v.pos)) continue;
      if (!mel || Math.abs(v.sem.z) < Math.abs(mel.sem.z)) mel = v;
    }
    if (mel) { usadas.add(mel.id); r.push(mel.id); }
  }
  for (const v of vagas) if (!usadas.has(v.id)) { usadas.add(v.id); r.push(v.id); }
  r = Object.freeze(r);
  _prio.set(formacao, r);
  return r;
}

// ------------------------------------------------------------------------------------ criação

/**
 * Cria o Livre. opc: {semente, elencos, times (os do Total Match), humano (o time do humano: 0|1), linha, goleiro (a
 * escolha; sem eles, LIVRE.padrao), log}. O mundo é o da partida (sem a trava "só o meu jogador") com o relógio que nunca
 * acaba, m.modo = 'livre' e m.livre; a escolha já aplicada e a saída do time do humano montada com quem ficou (evento
 * 'saida' em m.eventos, como a partida).
 */
export function criarLivre(opc = {}) {
  const h = opc.humano === 1 ? 1 : 0;
  const m = criarPartida({ semente: opc.semente ?? 1, elencos: opc.elencos, times: opc.times, humano: h, saida: h, minutosPorTempo: LIVRE.relogioMin, log: opc.log });
  m.modo = 'livre';
  // pressao: a da tática de cada time (a de quando tem mais de LIVRE.pressaoAlta de linha)
  m.livre = { linha: [LIVRE.linhaMax, LIVRE.linhaMax], goleiro: [true, true], fora: {}, ajustes: 0, pressao: [m.times[0].tatica.pressao, m.times[1].tatica.pressao] };
  const e = normalizarEscolha({ linha: opc.linha, goleiro: opc.goleiro }, h);
  ajustarJogadores(m, e, { inicio: true });
  // a saída do começo de novo, com quem ficou (todos nos lugares; o controlado no cobrador do time do humano)
  m.eventos = [];
  montarSaida(m, h);
  m.livre.ajustes = 0;
  return m;
}

// ------------------------------------------------------------------------------------ tirar e pôr

/**
 * Tira o jogador j do campo: sai de m.jogadores e fica guardado em m.livre.fora; a vaga vira buraco (m.times[t].expulsos).
 * A posse (a bola fica solta onde estava), a mão do goleiro, o passe para ele e a cobrança que era dele saem junto; o
 * controle passa ao de linha do time mais perto da bola (como a expulsão: partida.js).
 */
function tirar(m, j) {
  const t = j.time, s = m.times[t];
  (s.expulsos ??= []).includes(j.id) || s.expulsos.push(j.id);
  const idx = m.jogadores.indexOf(j);
  if (idx >= 0) m.jogadores.splice(idx, 1);
  m.livre.fora[j.id] = j;
  if (m.posse === j.id) m.posse = null;
  if (m.naMao === j.id) { m.naMao = null; m.posse = null; }
  if (m.voo && m.voo.para === j.id) m.voo.para = null;
  if (m.parada && m.parada.cobrador === j.id) { m.parada.cobrador = null; m.parada.papel = null; }
  if (m.controlado[t] === j.id) {
    let mel = null, dm = Infinity;
    for (const o of m.jogadores) {
      if (o.time !== t) continue;
      // de linha primeiro (o goleiro só sem ninguém de linha)
      const d = MD.hypot(o.x - m.bola.p.x, o.z - m.bola.p.z) + (ehLinha(o) ? 0 : 1e4);
      if (d < dm) { dm = d; mel = o; }
    }
    if (mel) { if (m.humanos.includes(t)) assumirControle(m, t, mel); else m.controlado[t] = mel.id; }
  }
}

const _r = { x: 0, z: 0 };
const _ref = new Float64Array(22);
/**
 * Põe em campo o titular da vaga `vagaId` do time t (que estava fora): um jogador novo (criarJogador, papel 'ia', sem o
 * estado de IA de antes) no ponto tático da vaga — a referência da IA com a bola de agora e a fase do time, juntada como a
 * do Livre (comprimirLivre) —, afastado LIVRE.afastar m de quem já está em campo (corpos coincidentes não se separam), de
 * frente para o gol que o time ataca.
 */
function por(m, t, vagaId) {
  const s = m.times[t], id = s.vagas[vagaId];
  s.expulsos = (s.expulsos ?? []).filter(x => x !== id);
  delete m.livre.fora[id];
  const lado = m.ataca[t], rumo = lado > 0 ? 0 : Math.PI;
  const j = criarJogador(id, 0, 0, rumo, atributosDe(fichaDe(id)), t);
  j.papel = 'ia';
  j.cond = criarCond();
  j.iaT = null;
  m.jogadores.push(j);
  vestirVaga(m, j, vagaId);
  // o ponto: a referência das vagas ocupadas (com ele) pela bola e pela fase (com a bola: no pé ou nas mãos de alguém do
  // time, ou um passe dele no ar), juntada como a da IA
  const f = FORMACOES[s.formacao], fase = timeDaBola(m) === t ? 'com' : 'sem';
  const bola = m.bola.p;
  for (const v of f.vagas) {
    posicaoTatica(s.formacao, v, s.tatica, bola, fase, lado, _r);
    const k = f.indice[v.id];
    _ref[2 * k] = _r.x; _ref[2 * k + 1] = _r.z;
  }
  if (ehLinha(j)) comprimirLivre(m, t, _ref, bola);
  let x = _ref[2 * j.vagaIdx], z = _ref[2 * j.vagaIdx + 1];
  if (!ehLinha(j)) { x = -lado * (CAMPO.meioX - 2); z = 0; } // o goleiro entra no gol dele
  // ninguém em cima de ninguém (nem da bola)
  const A = LIVRE.afastar;
  for (let k = 0; k < 12; k++) {
    let perto = MD.hypot(bola.x - x, bola.z - z) < A;
    for (const o of m.jogadores) if (o !== j && MD.hypot(o.x - x, o.z - z) < A) { perto = true; break; }
    if (!perto) break;
    z += (z >= 0 ? -1 : 1) * A * (k % 2 ? -1 : 1) * (1 + (k >> 1));
  }
  x = clamp(x, -CAMPO.meioX + 0.5, CAMPO.meioX - 0.5); z = clamp(z, -CAMPO.meioZ + 0.5, CAMPO.meioZ - 0.5);
  teleportar(j, x, z, rumo);
  return j;
}

/** Troca as vagas dos ids a e b no time t (os dois mapeados em s.vagas) e veste quem está em campo. */
function trocarVagas(m, t, va, vb) {
  const s = m.times[t];
  const a = s.vagas[va], b = s.vagas[vb];
  s.vagas[va] = b; s.vagas[vb] = a;
  for (const id of [a, b]) { const j = jogadorPorId(m, id); if (j) vestirVaga(m, j, vagaDoJogador(s, id)); }
}

/**
 * Aplica a escolha `e` ({linha: [a, b], goleiro: [g0, g1]}; normalizada aqui) ao mundo do Livre, sem recomeçar (ver o
 * cabeçalho). opc.inicio: na criação (o controlado também pode sair). Devolve {ok, linha, goleiro, saiu: [ids],
 * entrou: [ids]}. Evento 'livreAjuste' {linha, goleiro, saiu, entrou}.
 */
export function ajustarJogadores(m, e, opc = {}) {
  const h = m.timeHumano ?? 0;
  const esc = normalizarEscolha(e, m.humanos.includes(h) ? h : null, escolhaDoMundo(m));
  const saiu = [], entrou = [];
  const bola = m.bola.p;
  for (const t of [0, 1]) {
    const s = m.times[t], f = FORMACOES[s.formacao];
    const prio = prioridadeVagas(s.formacao);
    const ctrl = m.humanos.includes(t) && !opc.inicio ? m.controlado[t] : null;
    // 1) o goleiro
    const gk = m.jogadores.find(o => o.time === t && !ehLinha(o));
    if (gk && !esc.goleiro[t]) { tirar(m, gk); saiu.push(gk.id); }
    else if (!gk && esc.goleiro[t]) {
      // a vaga GOL pode estar com um de linha (nunca no Livre: o goleiro só sai pela escolha) — entra o titular dela
      const vGol = f.vagas[0].id;
      if (!jogadorPorId(m, s.vagas[vGol])) entrou.push(por(m, t, vGol).id);
    }
    // 2) os de linha que saem: os de maior "prioridade de saída" (a vaga de menor prioridade; LIVRE.saidaDist m mais
    //    longe da bola valem uma posição), nunca o controlado
    let lin = m.jogadores.filter(o => o.time === t && ehLinha(o));
    let sobra = lin.length - esc.linha[t];
    if (sobra > 0) {
      const nota = o => prio.indexOf(o.vagaId) + MD.hypot(o.x - bola.x, o.z - bola.z) / LIVRE.saidaDist;
      const cand = lin.filter(o => o.id !== ctrl).sort((a, b) => nota(b) - nota(a) || b.id - a.id);
      for (const o of cand) { if (sobra <= 0) break; tirar(m, o); saiu.push(o.id); sobra--; }
    }
    // 3) os que ficaram vão para as vagas de maior prioridade (quem está fora delas troca com a vaga vazia mais perto da
    //    referência — a IA o leva correndo até lá: ia-tatica.js reposicionando)
    lin = m.jogadores.filter(o => o.time === t && ehLinha(o));
    const alvo = prio.slice(0, Math.min(esc.linha[t], prio.length));
    const vazias = alvo.filter(v => !lin.some(o => o.vagaId === v));
    const fora = lin.filter(o => !alvo.includes(o.vagaId)).sort((a, b) => prio.indexOf(a.vagaId) - prio.indexOf(b.vagaId) || a.id - b.id);
    for (const o of fora) {
      if (!vazias.length) break;
      let mk = 0, dm = Infinity;
      vazias.forEach((v, k) => {
        posicaoTatica(s.formacao, v, s.tatica, bola, 'sem', m.ataca[t], _r);
        const d = MD.hypot(_r.x - o.x, _r.z - o.z);
        if (d < dm) { dm = d; mk = k; }
      });
      trocarVagas(m, t, o.vagaId, vazias[mk]);
      vazias.splice(mk, 1);
    }
    // 4) quem entra: as vagas da prioridade ainda vazias, na ordem
    for (const v of vazias) entrou.push(por(m, t, v).id);
    // 5) a pressão: Alta no jogo reduzido (LIVRE.pressaoAlta), senão a da tática do time
    s.tatica.pressao = esc.linha[t] <= LIVRE.pressaoAlta ? 2 : (m.livre.pressao?.[t] ?? s.tatica.pressao);
    s.versao++;
  }
  m.livre.linha = esc.linha.slice(); m.livre.goleiro = esc.goleiro.slice();
  m.livre.ajustes++;
  // bola parada já montada: montada de novo com quem ficou (a saída pela montarSaida; as outras, bola morta de novo — a
  // montagem vem no tempo de sempre)
  const p = m.partida, pr = m.parada;
  if (!opc.inicio && p.estado === 'parada' && pr && !pr.rolou && (saiu.length || entrou.length)) {
    if (pr.tipo === 'saida') montarSaida(m, pr.time);
    else { bolaMorta(m, pr.tipo, pr.time, pr.x, pr.z); p.estado = 'parada'; p.desde = m.tick; }
  }
  m.eventos.push({ tipo: 'livreAjuste', linha: esc.linha.slice(), goleiro: esc.goleiro.slice(), saiu, entrou });
  return { ok: true, linha: esc.linha.slice(), goleiro: esc.goleiro.slice(), saiu, entrou };
}

// ------------------------------------------------------------------------------------ recomeço e passo

/**
 * Recomeça o lance (o placar fica): 'meio' = saída de bola do time do humano (montarSaida: todos nos lugares); 'pe' = a
 * bola no pé do controlado onde ele está, com a bola rolando (sem parada). Evento 'saida' ou 'recomeco'.
 */
export function recomecarLivre(m, onde = 'meio') {
  const h = m.timeHumano ?? 0;
  const p = m.partida;
  if (onde === 'meio') { montarSaida(m, h); return true; }
  const j = jogadorPorId(m, m.controlado[h]);
  if (!j) return false;
  // a parada em andamento acaba (o cobrador, parado nela, volta a se mexer — como partida.js encerrarParada)
  const pr = m.parada;
  if (pr && pr.cobrador != null && pr.papel != null) { const c = jogadorPorId(m, pr.cobrador); if (c && c.papel === 'parado') c.papel = pr.papel; }
  m.parada = null; p.estado = 'jogo'; p.desde = m.tick; m.golTick = null; m.foraDesde = null;
  m.voo = null; m.naMao = null; m.cobrou = null;
  for (const o of m.jogadores) { o.pedido = null; o.carga = null; o.recebe = null; o.segura = null; o.corrida = null; o.intercepta = null; }
  if (m.regraMao) { m.regraMao.semMao = -1; m.regraMao.soltou = -1; }
  const b = m.bola, r = j.rumo;
  b.p.x = clamp(j.x + MD.cos(r) * 0.4, -CAMPO.meioX + 0.3, CAMPO.meioX - 0.3);
  b.p.z = clamp(j.z + MD.sin(r) * 0.4, -CAMPO.meioZ + 0.3, CAMPO.meioZ - 0.3);
  b.p.y = BOLA.raio; b.v.x = 0; b.v.y = 0; b.v.z = 0; b.w.x = 0; b.w.y = 0; b.w.z = 0; b.rolando = true;
  if (j.cond) { j.cond.toque = null; j.cond.busca = false; }
  m.posse = j.id;
  p.ultimoTime = j.time; p.ultimoId = j.id; p.ultimoTick = m.tick;
  m.eventos.push({ tipo: 'recomeco', livre: 'pe' });
  return true;
}

/**
 * Um passo do Livre (1/60 s): as ações-objeto do Livre ANTES do passo ({tipo: 'livreAjuste', linha, goleiro} e
 * {tipo: 'livreRecomecar', onde}; gravadas em m.log) e o passo da partida (passoPartida, com as regras do Livre pelos
 * ramos de m.livre). Devolve os eventos do passo.
 */
export function passoLivre(m, entrada, acoes) {
  const antes = [];
  let resto = null;
  if (acoes) {
    for (const a of acoes) {
      if (a && typeof a === 'object' && (a.tipo === 'livreAjuste' || a.tipo === 'livreRecomecar')) {
        m.eventos = [];
        if (a.tipo === 'livreAjuste') ajustarJogadores(m, a);
        else recomecarLivre(m, a.onde);
        m.log?.push({ tick: m.tick, acao: a });
        for (const e of m.eventos) antes.push(e);
      } else (resto ??= []).push(a);
    }
  }
  // sozinho de linha no time, quem cobrou pode tocar de novo (senão nunca mais tocaria a bola)
  if (m.cobrou) {
    const c = jogadorPorId(m, m.cobrou.id);
    if (!c || !m.jogadores.some(o => o.time === c.time && o !== c && ehLinha(o))) m.cobrou = null;
  }
  const ev = passoPartida(m, entrada, resto);
  if (antes.length) m.eventos = antes.concat(ev);
  return m.eventos;
}

/** Demonstração e testes: a IA joga pelo controlado do humano (a mesma da partida). */
export function entradaDemoLivre(m) { return entradaDemoPartida(m); }

/** Resumo para a página e os testes: a escolha, o total por time, quem está fora, o placar. */
export function resumoLivre(m) {
  const e = escolhaDoMundo(m);
  return {
    linha: e.linha, goleiro: e.goleiro, total: [totalDe(e, 0), totalDe(e, 1)],
    fora: Object.keys(m.livre?.fora ?? {}).map(Number).sort((a, b) => a - b),
    placar: [m.placar?.[0] ?? 0, m.placar?.[1] ?? 0], ajustes: m.livre?.ajustes ?? 0,
  };
}

export { temLinha };
