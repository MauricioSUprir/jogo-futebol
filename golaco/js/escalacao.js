// Escalação da partida (Etapa 3): estado do time no mundo (m.times), rascunho da tela "Editar
// time" (regra dos dois toques), edição como ENTRADA da simulação (validar/aplicar antes do passo),
// substituições pendentes até a parada e o hash dos times. Puro: sem three.js nem DOM.
// Especificação: tela §4.1, §7.6 e §8; plano 1.4.4–1.4.7 e 3.6.
//
// Regras que valem aqui (tela §0 e §8):
//  - a tela NUNCA escreve no mundo: ela mexe num rascunho e gera uma edição (a ENTRADA), que a
//    partida aplica no início do tick (aplicarEdicao) e grava em m.log;
//  - formação, tática e troca de vaga entre titulares valem no próximo passo; substituição e troca
//    que mexe no goleiro ficam pendentes até a próxima parada (bola fora, gol, intervalo);
//  - IFAB, Regra 3: 5 substituições em 3 paradas (o intervalo não conta), quem sai não volta.

import { ELENCOS, FUNCAO, fichaDe, atributosDe } from './elenco.js';
import { FORMACOES, ORDEM_FORMACOES, encaixar } from './formacoes.js';
import { PARTIDA } from './config.js';
import { misturarHash, jogadorPorId } from './sim.js';
import { criarJogador } from './jogador.js';
import { criarCond } from './conducao.js';
import { assumirControle } from './acoes.js';

const TATICAS = ['mentalidade', 'pressao', 'largura', 'linha'];
const FAIXA_TATICA = { mentalidade: [-2, 2], pressao: [0, 2], largura: [0, 2], linha: [0, 2] };

/**
 * Estado inicial do time no mundo (m.times[t], tela §7.6):
 * {elenco, formacao, vagas: {vagaId: id} (os 11 em campo), tatica, pendente: null | {vagas,
 *  substituicoes: [{sai, entra}]}, saiu: [ids], subs: {feitas, paradas}, versao}
 * opc: {formacao, vagas, tatica} (padrão: os do elenco).
 */
export function estadoInicialTime(elencoId, opc = {}) {
  const el = ELENCOS[elencoId];
  const formacao = opc.formacao ?? el.formacaoPadrao;
  let vagas = opc.vagas;
  if (!vagas) {
    vagas = el.titularesPadrao;
    // formação diferente da padrão: encaixa os titulares padrão
    if (formacao !== el.formacaoPadrao) vagas = encaixar(Object.values(el.titularesPadrao), formacao, elencoId, el.titularesPadrao);
  }
  const ordenadas = {};
  for (const v of FORMACOES[formacao].vagas) ordenadas[v.id] = vagas[v.id];
  return {
    elenco: elencoId,
    formacao,
    vagas: ordenadas,
    tatica: { ...(opc.tatica ?? el.taticaPadrao) },
    pendente: null,
    saiu: [],
    subs: { feitas: 0, paradas: 0 },
    versao: 0,
  };
}

/**
 * Veste o jogador `j` (em campo, do time t) com a vaga `vagaId` da formação atual do time:
 * j.vagaId, j.vagaIdx (0–10, índice na formação), j.posDetalhe (= vaga.pos), j.posicao
 * (= FUNCAO[posDetalhe]) e j.vaga (o formato da IA clássica: deslocamento à frente da bola e z
 * absoluto, só usado por ia.js). Chamar de novo quando a formação, a vaga ou o lado mudam.
 */
export function vestirVaga(m, j, vagaId) {
  const f = FORMACOES[m.times[j.time].formacao];
  const v = f.porId[vagaId];
  const lado = m.ataca[j.time];
  j.vagaId = vagaId;
  j.vagaIdx = f.indice[vagaId];
  j.posDetalhe = v.pos;
  j.posicao = FUNCAO[v.pos];
  if (j.posicao === 'GOL') j.vaga = undefined;
  else j.vaga = { x: v.com.x, z: v.com.z * lado };
}

/** Vaga (id) em que o jogador `id` está no arranjo `vagas` ({vagaId: id}), ou null. */
function vagaDe(vagas, id) {
  for (const k in vagas) if (vagas[k] === id) return k;
  return null;
}

/** Arranjo na ordem fixa das vagas da formação (a ordem do hash). */
function ordenar(formacao, vagas) {
  const out = {};
  for (const v of FORMACOES[formacao].vagas) out[v.id] = vagas[v.id];
  return out;
}

const camisa = id => fichaDe(id)?.camisa ?? String(id);

// ------------------------------------------------------------------------------- rascunho (tela)
/**
 * Rascunho da tela (nunca é o mundo):
 * {time, elenco, base (= versao lida), formacao, vagas, tatica, substituicoes: [{sai, entra}],
 *  saiu, subs: {feitas, paradas}, escolhido: id | null, historico: [estados para o Desfazer],
 *  original: {formacao, vagas, tatica, substituicoes} (para o Desfazer tudo)}
 * timeEstado = cópia de m.times[t]; edicaoNaFila (opcional) = a edição que está na fila (a tela
 * mostra o que vai valer, não o mundo antigo).
 */
export function rascunhoDe(timeEstado, edicaoNaFila = null, time = 0) {
  const ed = edicaoNaFila;
  const pend = timeEstado.pendente;
  const formacao = ed?.formacao ?? timeEstado.formacao;
  const vagas = { ...(ed?.vagas ?? pend?.vagas ?? timeEstado.vagas) };
  const tatica = { ...(ed?.tatica ?? timeEstado.tatica) };
  const substituicoes = (ed?.substituicoes ?? pend?.substituicoes ?? []).map(s => ({ sai: s.sai, entra: s.entra }));
  const r = {
    time, elenco: timeEstado.elenco, base: timeEstado.versao, formacao, vagas, tatica, substituicoes,
    saiu: [...timeEstado.saiu], subs: { ...timeEstado.subs }, escolhido: null, historico: [], original: null,
  };
  r.original = { formacao, vagas: { ...vagas }, tatica: { ...tatica }, substituicoes: substituicoes.map(s => ({ ...s })) };
  return r;
}

function copiaRasc(r) {
  return { ...r, vagas: { ...r.vagas }, tatica: { ...r.tatica }, substituicoes: r.substituicoes.map(s => ({ ...s })), historico: r.historico };
}
function guardar(r) {
  return { formacao: r.formacao, vagas: { ...r.vagas }, tatica: { ...r.tatica }, substituicoes: r.substituicoes.map(s => ({ ...s })) };
}
/** Cópia do rascunho com o estado atual empilhado no histórico (para o Desfazer). */
function mudanca(rasc) {
  const r = copiaRasc(rasc);
  r.historico = [...rasc.historico, guardar(rasc)];
  return r;
}

/**
 * Situação de um jogador no rascunho: 'titular' (em uma vaga; inclui quem entra), 'reserva'
 * (disponível no banco), 'sai' (↓ sai na próxima parada), 'saiu' (substituído: não volta) ou
 * null (não é do elenco). Mais: entra (é o ↑ de um par pendente) e par ({sai, entra} | null).
 */
export function situacao(rasc, id) {
  const par = rasc.substituicoes.find(s => s.sai === id || s.entra === id) ?? null;
  if (rasc.saiu.includes(id)) return { tipo: 'saiu', par: null, entra: false };
  if (vagaDe(rasc.vagas, id) != null) return { tipo: 'titular', par, entra: !!par && par.entra === id };
  if (par && par.sai === id) return { tipo: 'sai', par, entra: false };
  if (!ELENCOS[rasc.elenco].jogadores.some(j => j.id === id)) return { tipo: null, par: null, entra: false };
  return { tipo: 'reserva', par: null, entra: false };
}

/** Reservas disponíveis do rascunho (ordem de id; a tela ordena por posição). */
export function reservasDe(rasc) {
  return ELENCOS[rasc.elenco].jogadores.map(j => j.id).filter(id => situacao(rasc, id).tipo === 'reserva');
}

/** Motivo de não poder fazer mais uma substituição no rascunho (ou null). */
function limiteSubs(rasc) {
  if (rasc.subs.paradas >= PARTIDA.paradasMax) return { motivo: 'paradas', texto: `Sem paradas para substituir (${rasc.subs.paradas}/${PARTIDA.paradasMax})` };
  if (rasc.subs.feitas + rasc.substituicoes.length >= PARTIDA.subsMax) return { motivo: 'limite', texto: `Limite de ${PARTIDA.subsMax} substituições` };
  return null;
}

/**
 * Regra dos dois toques (tela §4.1). Pura: devolve {rasc (novo), evento} — evento para o painel:
 * {tipo: 'escolheu' | 'desmarcou' | 'trocou' | 'substituiu' | 'recusou' | 'pendente', a, b, motivo?,
 *  texto?, gol?}. Tabela 4.1:
 *  - titular A → titular B: trocam de vaga (com o GOL no meio, o mundo só troca na parada: gol: true);
 *  - titular A ↔ reserva R: substituição (R na vaga de A; A em "Saem"); conta 1/5. Se A é quem já
 *    entraria por outra substituição, R toma o lugar dele no par (não conta de novo);
 *  - reserva → reserva: o 2º passa a ser o escolhido; o mesmo de novo: desmarca;
 *  - substituído (saiu): recusa sem escolher; quem sai (↓) ou entra (↑) sem nada escolhido: painel
 *    'pendente' com o par (a tela mostra "Cancelar substituição": cancelarSubstituicao).
 */
export function tocar(rasc, id) {
  const sit = situacao(rasc, id);
  if (sit.tipo == null) return { rasc, evento: null };
  if (sit.tipo === 'saiu') {
    return { rasc, evento: { tipo: 'recusou', a: id, motivo: 'saiu', texto: `${camisa(id)} já saiu e não pode voltar` } };
  }
  const esc = rasc.escolhido;
  // o mesmo de novo: desmarca
  if (esc === id) return { rasc: { ...rasc, escolhido: null }, evento: { tipo: 'desmarcou', a: id } };
  // quem sai (↓): só o painel do par
  if (sit.tipo === 'sai') return { rasc: { ...rasc, escolhido: null }, evento: { tipo: 'pendente', a: sit.par.sai, b: sit.par.entra } };
  if (esc == null) {
    if (sit.entra) return { rasc, evento: { tipo: 'pendente', a: sit.par.sai, b: sit.par.entra } };
    return { rasc: { ...rasc, escolhido: id }, evento: { tipo: 'escolheu', a: id } };
  }
  const se = situacao(rasc, esc);
  if (se.tipo !== 'titular' && se.tipo !== 'reserva') return { rasc: { ...rasc, escolhido: id }, evento: { tipo: 'escolheu', a: id } };
  // reserva → reserva: o 2º passa a ser o escolhido
  if (se.tipo === 'reserva' && sit.tipo === 'reserva') return { rasc: { ...rasc, escolhido: id }, evento: { tipo: 'escolheu', a: id } };
  // titular ↔ titular: trocam de vaga
  if (se.tipo === 'titular' && sit.tipo === 'titular') {
    const va = vagaDe(rasc.vagas, esc), vb = vagaDe(rasc.vagas, id);
    const r = mudanca(rasc);
    r.vagas[va] = id; r.vagas[vb] = esc;
    r.escolhido = null;
    return { rasc: r, evento: { tipo: 'trocou', a: esc, b: id, gol: va === 'GOL' || vb === 'GOL' } };
  }
  // titular ↔ reserva: substituição
  const tit = se.tipo === 'titular' ? esc : id;
  const res = se.tipo === 'titular' ? id : esc;
  const st = se.tipo === 'titular' ? se : sit;
  const vaga = vagaDe(rasc.vagas, tit);
  if (st.entra) {
    // o titular escolhido é quem ia entrar: o reserva toma o lugar dele no par (mesma contagem)
    const r = mudanca(rasc);
    r.vagas[vaga] = res;
    r.substituicoes = r.substituicoes.map(s => (s.entra === tit ? { sai: s.sai, entra: res } : s));
    r.escolhido = null;
    return { rasc: r, evento: { tipo: 'substituiu', a: st.par.sai, b: res } };
  }
  const lim = limiteSubs(rasc);
  if (lim) return { rasc, evento: { tipo: 'recusou', a: res, b: tit, motivo: lim.motivo, texto: lim.texto } };
  const r = mudanca(rasc);
  r.vagas[vaga] = res;
  r.substituicoes.push({ sai: tit, entra: res });
  r.escolhido = null;
  return { rasc: r, evento: { tipo: 'substituiu', a: tit, b: res } };
}

/**
 * Cancela a substituição pendente do rascunho em que `id` sai ou entra: quem sairia volta para a
 * vaga de quem entraria (tela §3.5, "Cancelar substituição"). Sem par: devolve o mesmo rascunho.
 */
export function cancelarSubstituicao(rasc, id) {
  const par = rasc.substituicoes.find(s => s.sai === id || s.entra === id);
  if (!par) return rasc;
  const r = mudanca(rasc);
  const vaga = vagaDe(r.vagas, par.entra);
  if (vaga != null) r.vagas[vaga] = par.sai;
  r.substituicoes = r.substituicoes.filter(s => s !== par && !(s.sai === par.sai && s.entra === par.entra));
  r.escolhido = null;
  return r;
}

/** Troca a formação do rascunho, com o encaixe automático dos 11 (tela §3.2). */
export function mudarFormacao(rasc, formacao) {
  if (!FORMACOES[formacao] || formacao === rasc.formacao) return rasc;
  const r = mudanca(rasc);
  r.vagas = encaixar(Object.values(rasc.vagas), formacao, rasc.elenco, rasc.vagas);
  r.formacao = formacao;
  r.escolhido = null;
  return r;
}

/** Muda um controle da tática ('mentalidade' | 'pressao' | 'largura' | 'linha') para `nivel`. */
export function mudarTatica(rasc, chave, nivel) {
  if (!TATICAS.includes(chave) || rasc.tatica[chave] === nivel) return rasc;
  const [lo, hi] = FAIXA_TATICA[chave];
  if (!Number.isInteger(nivel) || nivel < lo || nivel > hi) return rasc;
  const r = mudanca(rasc);
  r.tatica[chave] = nivel;
  return r;
}

/** Desfaz a última mudança (troca, substituição, formação ou tática). Sem histórico: o mesmo. */
export function desfazer(rasc) {
  const n = rasc.historico.length;
  if (!n) return { ...rasc, escolhido: null };
  const h = rasc.historico[n - 1];
  return {
    ...rasc, formacao: h.formacao, vagas: { ...h.vagas }, tatica: { ...h.tatica },
    substituicoes: h.substituicoes.map(s => ({ ...s })), escolhido: null, historico: rasc.historico.slice(0, n - 1),
  };
}

/** Volta o rascunho ao estado da abertura. */
export function desfazerTudo(rasc) {
  const o = rasc.original;
  return { ...rasc, formacao: o.formacao, vagas: { ...o.vagas }, tatica: { ...o.tatica }, substituicoes: o.substituicoes.map(s => ({ ...s })), escolhido: null, historico: [] };
}

/**
 * Edição (a ENTRADA da simulação, tela §8.2) a partir do rascunho, ou null se nada mudou:
 * {tipo: 'editarTime', time, base, formacao, vagas: {...11}, substituicoes: [{sai, entra}], tatica}
 */
export function edicaoDe(rasc) {
  const o = rasc.original;
  const igual = rasc.formacao === o.formacao
    && TATICAS.every(k => rasc.tatica[k] === o.tatica[k])
    && Object.keys(rasc.vagas).length === Object.keys(o.vagas).length
    && Object.keys(rasc.vagas).every(k => rasc.vagas[k] === o.vagas[k])
    && JSON.stringify(rasc.substituicoes) === JSON.stringify(o.substituicoes);
  if (igual) return null;
  return {
    tipo: 'editarTime', time: rasc.time, base: rasc.base, formacao: rasc.formacao,
    vagas: ordenar(rasc.formacao, rasc.vagas), substituicoes: rasc.substituicoes.map(s => ({ sai: s.sai, entra: s.entra })), tatica: { ...rasc.tatica },
  };
}

// --------------------------------------------------------------------------- edição no mundo
const recusa = (codigo, motivo) => ({ ok: false, codigo, motivo });

/**
 * Valida a edição contra o estado do time (m.times[t]) — tela §8.3, 7 recusas (codigo 1–7):
 *  1 base velha (edição desatualizada); 2 formação inexistente ou vagas ≠ as 11 da formação;
 *  3 id fora do elenco, repetido ou em `saiu`; 4 substituição inválida (sai fora de campo, entra
 *  indisponível, pares repetidos); 5 conjunto de vagas ≠ (em campo − sai) ∪ entra; 6 limite de 5
 *  substituições em 3 paradas; 7 tática fora da faixa ou não inteira.
 * Devolve {ok: true} | {ok: false, codigo, motivo (texto do aviso)}. A tela usa a MESMA função.
 */
export function validarEdicao(timeEstado, ed, elencoId = timeEstado?.elenco) {
  if (!timeEstado || !ed || ed.tipo !== 'editarTime') return recusa(2, 'Edição inválida');
  // 1) desatualizada
  if (ed.base !== timeEstado.versao) return recusa(1, 'O time mudou: abra o editor de novo');
  // 2) formação e vagas
  const f = FORMACOES[ed.formacao];
  if (!f || !ed.vagas || typeof ed.vagas !== 'object') return recusa(2, 'Formação inexistente');
  const chaves = Object.keys(ed.vagas);
  if (chaves.length !== f.vagas.length || !f.vagas.every(v => Object.prototype.hasOwnProperty.call(ed.vagas, v.id))) return recusa(2, 'A escalação não tem as 11 vagas da formação');
  // 3) ids: do elenco, sem repetir, nenhum que já saiu
  const elenco = ELENCOS[elencoId];
  const doElenco = new Set(elenco.jogadores.map(j => j.id));
  const vistos = new Set();
  for (const v of f.vagas) {
    const id = ed.vagas[v.id];
    if (!Number.isInteger(id) || !doElenco.has(id)) return recusa(3, 'Jogador fora do elenco');
    if (vistos.has(id)) return recusa(3, 'Jogador repetido na escalação');
    if (timeEstado.saiu.includes(id)) return recusa(3, `${camisa(id)} já saiu e não pode voltar`);
    vistos.add(id);
  }
  // 4) substituições
  const subs = Array.isArray(ed.substituicoes) ? ed.substituicoes : [];
  const emCampo = new Set(Object.values(timeEstado.vagas));
  const sais = new Set(), entras = new Set();
  for (const s of subs) {
    if (!s || !emCampo.has(s.sai)) return recusa(4, 'Quem sai não está em campo');
    if (!doElenco.has(s.entra) || emCampo.has(s.entra) || timeEstado.saiu.includes(s.entra)) return recusa(4, 'Quem entra não está disponível');
    if (sais.has(s.sai) || entras.has(s.entra)) return recusa(4, 'Substituição repetida');
    sais.add(s.sai); entras.add(s.entra);
  }
  // 5) quem fica em campo = (em campo − quem sai) ∪ quem entra
  const esperado = new Set([...emCampo].filter(id => !sais.has(id)));
  for (const id of entras) esperado.add(id);
  if (esperado.size !== vistos.size || [...vistos].some(id => !esperado.has(id))) return recusa(5, 'A escalação não bate com as substituições');
  // 6) limite IFAB
  if (timeEstado.subs.feitas + subs.length > PARTIDA.subsMax) return recusa(6, `Limite de ${PARTIDA.subsMax} substituições`);
  if (subs.length > 0 && timeEstado.subs.paradas >= PARTIDA.paradasMax) return recusa(6, `Sem paradas para substituir (${timeEstado.subs.paradas}/${PARTIDA.paradasMax})`);
  // 7) tática
  const t = ed.tatica;
  if (!t || typeof t !== 'object') return recusa(7, 'Tática inválida');
  for (const k of TATICAS) {
    const [lo, hi] = FAIXA_TATICA[k];
    if (!Number.isInteger(t[k]) || t[k] < lo || t[k] > hi) return recusa(7, 'Tática fora da faixa');
  }
  return { ok: true };
}

/**
 * Aplica a edição (chamada por partida.js passoPartida ANTES do passo do tick): formação e tática
 * já; vagas imediatas (quem sai joga até a parada; a vaga GOL não muda de dono antes da parada);
 * pendente = {vagas, substituicoes} se houver; versao++; vestirVaga em todos do time.
 * Devolve {ok, motivo?, codigo?, pendente: bool}. Os eventos (timeEditado/edicaoRecusada) são de
 * partida.js. A IA leva cada um à vaga nova correndo (sem teletransporte).
 */
export function aplicarEdicao(m, ed) {
  const t = m.times?.[ed?.time];
  if (!t) return { ok: false, codigo: 2, motivo: 'Time inexistente', pendente: false };
  const val = validarEdicao(t, ed, t.elenco);
  if (!val.ok) return { ok: false, codigo: val.codigo, motivo: val.motivo, pendente: false };
  const subs = (ed.substituicoes ?? []).map(s => ({ sai: s.sai, entra: s.entra }));
  // vagas imediatas: cada um que entra ainda é o que sai
  const imediatas = ordenar(ed.formacao, ed.vagas);
  for (const s of subs) { const k = vagaDe(imediatas, s.entra); if (k != null) imediatas[k] = s.sai; }
  // a vaga GOL não muda de dono antes da parada (Regra 3): o par volta como estava
  let golEspera = false;
  const gol0 = t.vagas.GOL;
  if (imediatas.GOL !== gol0) {
    const k = vagaDe(imediatas, gol0);
    if (k != null) { imediatas[k] = imediatas.GOL; imediatas.GOL = gol0; golEspera = true; }
  }
  t.formacao = ed.formacao;
  t.tatica = { mentalidade: ed.tatica.mentalidade, pressao: ed.tatica.pressao, largura: ed.tatica.largura, linha: ed.tatica.linha };
  t.vagas = imediatas;
  t.pendente = subs.length || golEspera ? { vagas: ordenar(ed.formacao, ed.vagas), substituicoes: subs } : null;
  t.versao++;
  t.editadoEm = m.tick; // o tick da edição entra no hash (a mesma edição um tick depois é outro jogo)
  for (const j of m.jogadores) if (j.time === ed.time) vestirVaga(m, j, vagaDe(t.vagas, j.id));
  return { ok: true, pendente: !!t.pendente };
}

/**
 * Na parada (bola fora, gol, intervalo; chamada pelas regras da partida ANTES de escolher o
 * cobrador): cria quem entra no MESMO índice de m.jogadores (papel 'ia'; o controlado segue o novo
 * por assumirControle), aplica pendente.vagas, saiu += sai, feitas += n, paradas += 1 (não no
 * intervalo), evento `substituicao {time, sai, entra}`, pendente = null. Devolve quantas foram feitas.
 */
export function aplicarPendentes(m, t, opc = {}) {
  const s = m.times?.[t];
  if (!s || !s.pendente) return 0;
  const { vagas, substituicoes } = s.pendente;
  let n = 0;
  for (const par of substituicoes) {
    const velho = jogadorPorId(m, par.sai);
    if (!velho) continue;
    const idx = m.jogadores.indexOf(velho);
    const novo = criarJogador(par.entra, velho.x, velho.z, velho.rumo, atributosDe(fichaDe(par.entra)), t);
    novo.papel = 'ia';
    novo.posicao = velho.posicao;
    novo.cond = criarCond();
    novo.iaT = null;
    m.jogadores[idx] = novo;
    // referências ao id que sai (a bola está parada; nada disso deveria existir, mas não pode sobrar)
    if (m.posse === par.sai) m.posse = par.entra;
    if (m.naMao === par.sai) m.naMao = par.entra;
    if (m.voo && m.voo.para === par.sai) m.voo.para = null;
    if (m.parada && m.parada.cobrador === par.sai) m.parada.cobrador = par.entra;
    if (m.controlado[t] === par.sai) {
      if (m.humanos.includes(t)) assumirControle(m, t, novo);
      else m.controlado[t] = par.entra;
    }
    s.saiu.push(par.sai);
    m.eventos.push({ tipo: 'substituicao', time: t, sai: par.sai, entra: par.entra });
    n++;
  }
  s.vagas = ordenar(s.formacao, vagas);
  s.subs.feitas += n;
  if (n > 0 && !opc.intervalo) s.subs.paradas += 1;
  s.pendente = null;
  s.versao++;
  for (const j of m.jogadores) if (j.time === t) vestirVaga(m, j, vagaDe(s.vagas, j.id));
  return n;
}

// ------------------------------------------------------------------------------------- hash
const IDX_FORMACAO = Object.fromEntries(ORDEM_FORMACOES.map((f, i) => [f, i]));

/**
 * Mistura no hash o estado dos times (tela §7.6): para cada time em ordem (0, 1): índice da
 * formação, o id de cada vaga na ordem da formação, as 4 táticas, o pendente (vagas e pares),
 * saiu, subs e versao. Só é chamada com m.times (o hash do treino não muda).
 */
export function misturarTimes(h, m) {
  for (const t of [0, 1]) {
    const s = m.times[t];
    if (!s) continue;
    const f = FORMACOES[s.formacao];
    h = misturarHash(h, IDX_FORMACAO[s.formacao]);
    for (const v of f.vagas) h = misturarHash(h, s.vagas[v.id] ?? -1);
    for (const k of TATICAS) h = misturarHash(h, s.tatica[k]);
    if (s.pendente) {
      h = misturarHash(h, 1);
      for (const v of f.vagas) h = misturarHash(h, s.pendente.vagas?.[v.id] ?? -1);
      for (const p of s.pendente.substituicoes ?? []) { h = misturarHash(h, p.sai); h = misturarHash(h, p.entra); }
    } else h = misturarHash(h, 0);
    h = misturarHash(h, s.saiu.length);
    for (const id of s.saiu) h = misturarHash(h, id);
    h = misturarHash(h, s.subs.feitas);
    h = misturarHash(h, s.subs.paradas);
    h = misturarHash(h, s.versao);
    h = misturarHash(h, s.editadoEm ?? -1);
  }
  return h;
}
