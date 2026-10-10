// Escalação da partida (Etapa 3): estado do time no mundo (m.times), rascunho da tela "Editar
// time" (regra dos dois toques), edição como ENTRADA da simulação (validar/aplicar antes do passo),
// substituições pendentes até a parada e o hash dos times. Puro: sem three.js nem DOM.
// Especificação: tela §4.1, §7.6 e §8; plano 1.4.4–1.4.7.
//
// ESQUELETO (Parte 0): estadoInicialTime, vestirVaga, rascunhoDe, mudarFormacao, mudarTatica,
// desfazerTudo, edicaoDe e misturarTimes já funcionam; tocar, desfazer, validarEdicao,
// aplicarEdicao e aplicarPendentes têm a assinatura final e ainda não fazem nada (Parte 1).

import { ELENCOS, FUNCAO } from './elenco.js';
import { FORMACOES, ORDEM_FORMACOES, encaixar } from './formacoes.js';
import { misturarHash } from './sim.js';

const TATICAS = ['mentalidade', 'pressao', 'largura', 'linha'];

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

/**
 * Regra dos dois toques (tela §4.1). Pura: devolve {rasc (novo), evento} — evento para o painel:
 * null | {tipo: 'escolheu' | 'desmarcou' | 'trocou' | 'substituiu' | 'recusou' | 'pendente', a, b, motivo}.
 * ESQUELETO: ainda não faz nada (Parte 1).
 */
export function tocar(rasc, id) {
  return { rasc, evento: null };
}

/** Troca a formação do rascunho, com o encaixe automático dos 11 (tela §3.2). */
export function mudarFormacao(rasc, formacao) {
  if (!FORMACOES[formacao] || formacao === rasc.formacao) return rasc;
  const r = copiaRasc(rasc);
  r.historico = [...rasc.historico, guardar(rasc)];
  r.vagas = encaixar(Object.values(rasc.vagas), formacao, rasc.elenco, rasc.vagas);
  r.formacao = formacao;
  r.escolhido = null;
  return r;
}

/** Muda um controle da tática ('mentalidade' | 'pressao' | 'largura' | 'linha') para `nivel`. */
export function mudarTatica(rasc, chave, nivel) {
  if (!TATICAS.includes(chave) || rasc.tatica[chave] === nivel) return rasc;
  const r = copiaRasc(rasc);
  r.historico = [...rasc.historico, guardar(rasc)];
  r.tatica[chave] = nivel;
  return r;
}

/** Desfaz a última mudança. ESQUELETO: ainda não faz nada (Parte 1). */
export function desfazer(rasc) {
  return rasc;
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
    vagas: { ...rasc.vagas }, substituicoes: rasc.substituicoes.map(s => ({ sai: s.sai, entra: s.entra })), tatica: { ...rasc.tatica },
  };
}

// --------------------------------------------------------------------------- edição no mundo
/**
 * Valida a edição contra o estado do time (m.times[t]) — tela §8.3, 7 recusas: base velha;
 * formação/vagas; ids fora do elenco, repetidos ou em `saiu`; substituição inválida; conjunto de
 * vagas ≠ (em campo − sai) ∪ entra; limite de 5 em 3 paradas; tática fora da faixa.
 * Devolve {ok: true} | {ok: false, motivo}. A tela usa a MESMA função antes do PRONTO.
 * ESQUELETO: recusa tudo (Parte 1).
 */
export function validarEdicao(timeEstado, ed, elencoId = timeEstado?.elenco) {
  return { ok: false, motivo: 'aguardando a Parte 1' };
}

/**
 * Aplica a edição (chamada por partida.js passoPartida ANTES do passo do tick): formação e tática
 * já; vagas imediatas (quem sai joga até a parada; a vaga GOL não muda de dono antes da parada);
 * pendente = {vagas, substituicoes} se houver; versao++; vestirVaga em todos do time.
 * Devolve {ok, motivo?, pendente: bool}. Os eventos (timeEditado/edicaoRecusada) são de partida.js.
 * ESQUELETO: recusa (validarEdicao), sem mexer no mundo (Parte 1).
 */
export function aplicarEdicao(m, ed) {
  const t = m.times?.[ed?.time];
  if (!t) return { ok: false, motivo: 'time inexistente', pendente: false };
  const v = validarEdicao(t, ed, t.elenco);
  if (!v.ok) return { ok: false, motivo: v.motivo, pendente: false };
  return { ok: true, pendente: false };
}

/**
 * Na parada (bola fora, gol, intervalo; chamada pelas regras da partida ANTES de escolher o
 * cobrador): cria quem entra no MESMO índice de m.jogadores (papel 'ia'; o controlado segue o novo
 * por assumirControle), aplica pendente.vagas, saiu += sai, feitas += n, paradas += 1 (não no
 * intervalo), evento `substituicao {time, sai, entra}`, pendente = null. Devolve quantas foram feitas.
 * ESQUELETO: não faz nada (Parte 1).
 */
export function aplicarPendentes(m, t, opc = {}) {
  return 0;
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
  }
  return h;
}
