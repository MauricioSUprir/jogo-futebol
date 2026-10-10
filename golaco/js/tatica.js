// Tática da partida (Etapa 3): ponto de referência de cada vaga pela formação, pela bola, pela fase
// e pelos 4 controles do "Editar time" (mentalidade, pressão, largura, altura da linha).
// Puro: sem three.js nem DOM. A tela usa a MESMA posicaoTatica na prévia (bola em 0, 0) — é o
// contrato entre a prévia e a IA (tela §7.5).
//
// 1ª versão (Parte 0; a Parte 2 refina): interpolação por terço (k por função entre t1→t2 e
// t2→t3, pesquisa §1.2), largura, mentalidade e linha de defesa alinhada (plano 2.3).

import { TATICA, IA_DEFESA, CAMPO, PASSO } from './config.js';
import { FORMACOES } from './formacoes.js';
import { clamp, tabela } from './mat.js';

/** Tática padrão: Equilibrada, pressão Média, largura Normal, linha Média. */
export const TATICA_PADRAO = Object.freeze({ mentalidade: 0, pressao: 1, largura: 1, linha: 1 });

/** Função de cada posição para os coeficientes de deslocamento (TATICA.k / kz). */
export const FUNCAO_K = {
  GOL: 'goleiro', LD: 'lateral', LE: 'lateral', ADD: 'lateral', ADE: 'lateral', ZAG: 'zagueiro',
  VOL: 'meioCentral', MC: 'meioCentral', MEI: 'meioCentral', MD: 'meiaAberto', ME: 'meiaAberto',
  PD: 'meiaAberto', PE: 'meiaAberto', SA: 'atacante', ATA: 'atacante',
};
const LATERAIS = { LD: 1, LE: 1, ADD: 1, ADE: 1 };
const H_MEDIA = 32.5; // altura da linha de referência das tabelas (bola no centro, sem bola)
// largura da curva da Metrica com a bola em u = 0 (a largura entra pela razão; a altura, pela
// diferença para H_MEDIA)
const W0 = tabela(TATICA.formaPelaBola, 0, 2);

/** Terço da bola no referencial de quem ataca para `ataca`: 1 (meu terço), 2 (meio) ou 3 (ataque). */
export function tercoDaBola(bx, ataca) {
  const x = bx * ataca;
  return x < -TATICA.terco ? 1 : x >= TATICA.terco ? 3 : 2;
}

/**
 * Ponto de referência da vaga (metros, mundo). Pura e sem alocar: escreve em `out` (se não vier,
 * cria um objeto).
 *  formacao  id ('4-3-3' …)          vaga   id da vaga ('MCE') ou o objeto Vaga da formação
 *  tatica    {mentalidade −2..2, pressao 0..2, largura 0..2, linha 0..2}
 *  bola      {x, z} no mundo          fase   'sem' | 'com'          ataca  ±1 (lado que o time ataca)
 */
export function posicaoTatica(formacao, vaga, tatica, bola, fase, ataca, out = { x: 0, z: 0 }) {
  const f = FORMACOES[formacao];
  const v = typeof vaga === 'string' ? f.porId[vaga] : vaga;
  const t = tatica ?? TATICA_PADRAO;
  const ph = fase === 'com' ? 'com' : 'sem';
  // 1) referencial do time (quem ataca para −x troca x e z)
  const bx = bola.x * ataca, bz = bola.z * ataca;
  const base = v[ph];
  const func = FUNCAO_K[v.pos];
  const lado = bx < 0 ? 0 : 1;
  // 2–3) base com a bola no centro + deslocamento pela bola (não linear: k por terço). Sem a bola, a
  // frente (quem fica em x ≥ 0 na tabela sem a bola) sobe mais com a bola no campo de lá: pressiona a
  // saída e estica o bloco (Metrica: comprimento 32–36 m com a bola a 20–35 m do meio, ~5 m a mais que
  // com o k médio da função)
  const kx = ph === 'sem' && lado === 1 && v.grupo !== 'gol' && v.grupo !== 'def' && base.x >= 0 ? TATICA.kFrenteSem : TATICA.k[func][ph][lado];
  let x = base.x + kx * bx;
  // 4) largura (sem a bola, o bloco também estreita com a bola no meu terço e abre no ataque, pela
  // curva da Metrica)
  let fz = TATICA.largura[ph][t.largura];
  if (ph === 'sem') fz *= tabela(TATICA.formaPelaBola, bx, 2) / W0;
  let z = base.z * fz + TATICA.kz[ph][func] * bz;
  if (v.grupo !== 'gol') {
    // 5) mentalidade: o bloco inteiro; com a bola, os laterais sobem mais
    const ment = t.mentalidade * TATICA.mentalidadeBloco + (ph === 'com' && LATERAIS[v.pos] && t.mentalidade > 0 ? t.mentalidade * TATICA.lateralSobe : 0);
    const dH = TATICA.linhaAltura[t.linha] - H_MEDIA;
    if (v.grupo === 'def' && ph === 'sem') {
      // 6) linha de defesa alinhada: todos pela altura da linha e pela curva da Metrica (altura pela
      // bola). A altura da tática é relativa à da formação (a tabela é a linha Média: o 5-3-2 defende
      // ~2 m mais fundo que o 4-4-2). Na Média a altura é a da própria curva (a Metrica tem a linha a
      // 31,4 m com a bola no centro, 1,1 m abaixo dos 32,5 da tabela; com a da tabela, a linha ficava
      // ~2,5 m alta em toda a metade de cá: teste-forma, altura por faixa)
      let xLinha = f.xLinhaSem + dH + (tabela(TATICA.formaPelaBola, bx, 1) - H_MEDIA) + ment;
      xLinha = clamp(xLinha, TATICA.linhaPiso, TATICA.linhaTeto);
      if (bx < xLinha + TATICA.linhaAtrasDaBola) xLinha = Math.max(TATICA.linhaPiso, bx - TATICA.linhaAtrasDaBola);
      x = xLinha + (base.x - f.xLinhaSem);
    } else {
      x += ment + (v.grupo === 'def' ? dH : TATICA.blocoSegueLinha * dH);
      // sem a bola, as linhas do meio e da frente (frente = quem fica em x ≥ 0 na tabela sem a bola)
      // afastadas um pouco: o 1º homem e a cobertura saem da linha do meio para a bola, e o meio que
      // sobra fica mais perto da frente do que a tabela (medido no teste-forma; Forcher 2024)
      if (ph === 'sem') x += v.sem.x >= 0 ? TATICA.linhasSem.ata : TATICA.linhasSem.mei;
    }
  }
  // 7) limites
  x = clamp(x, -TATICA.limiteX, TATICA.limiteX);
  z = clamp(z, -TATICA.limiteZ, TATICA.limiteZ);
  out.x = x * ataca;
  out.z = z * ataca;
  return out;
}

const _p = { x: 0, z: 0 };
/**
 * Altura da linha de defesa (m do defensor de linha mais recuado do grupo 'def' até a própria
 * linha de gol) pela referência tática.
 */
export function alturaLinha(formacao, tatica, bola, fase, ataca) {
  let min = Infinity;
  for (const v of FORMACOES[formacao].vagas) {
    if (v.grupo !== 'def') continue;
    posicaoTatica(formacao, v, tatica, bola, fase, ataca, _p);
    min = Math.min(min, _p.x * ataca);
  }
  return min + CAMPO.meioX;
}

/**
 * Fase do time (uma vez por time e por tick, em m.iaTime[time]):
 *  fase       'com' (bola no pé/nas mãos de alguém do time, ou passe dele no ar) | 'sem'
 *             (bola sem dono e sem passe no ar: mantém a fase anterior)
 *  desde      tick da última troca de fase
 *  transicao  'def' (até contrapressao[pressão] s depois da perda) | 'of' (até IA_DEFESA.transOf s
 *             depois da retomada) | null
 *  mistura    0..1 — mistura das referências com/sem nos TATICA.mistura s depois da troca
 */
export function faseDoTime(m, time) {
  const cache = (m.iaTime ??= {});
  let s = cache[time];
  if (s && s.tick === m.tick) return s;
  // (criado já assentado: sem mistura nem transição no primeiro tick)
  if (!s) s = cache[time] = { tick: -1, fase: null, desde: m.tick - Math.round(Math.max(TATICA.mistura, IA_DEFESA.transOf, ...IA_DEFESA.contrapressao.s) / PASSO) - 1, transicao: null, mistura: 1 };
  let dono = m.naMao ?? m.posse;
  let timeBola = null;
  if (dono != null) {
    for (const o of m.jogadores) if (o.id === dono) { timeBola = o.time; break; }
  } else if (m.voo && m.voo.time != null) timeBola = m.voo.time;
  const fase = timeBola == null ? (s.fase ?? 'sem') : timeBola === time ? 'com' : 'sem';
  if (s.fase == null) s.fase = fase;
  else if (fase !== s.fase) { s.fase = fase; s.desde = m.tick; }
  const dt = (m.tick - s.desde) * PASSO;
  const pressao = m.times?.[time]?.tatica?.pressao ?? 1;
  s.transicao = s.fase === 'sem' ? (dt < IA_DEFESA.contrapressao.s[pressao] ? 'def' : null) : (dt < IA_DEFESA.transOf ? 'of' : null);
  s.mistura = Math.min(1, dt / TATICA.mistura);
  s.tick = m.tick;
  return s;
}
