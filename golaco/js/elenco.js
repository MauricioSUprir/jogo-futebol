// Elenco da partida (Etapa 3): posições, pesos da nota por posição, os dois times fictícios
// (23 jogadores cada: 11 + 12 reservas) e os atributos gerados de forma determinística.
// Puro: sem three.js nem DOM, sem Math.random (a mistura é inteira, com Math.imul).
// Especificação: tela "Editar time" §7.1–7.3 e §7.7 (PESQUISA-ETAPA3.md §11).
//
// Ids no mundo: Golaço FC = número da camisa (1–23); Ventania FC = 100 + número (101–123). Nunca o 0
// (humano do treino de condução) nem o 90 (marcador do treino).

import { clamp } from './mat.js';

/** Os 15 códigos de posição (os do FC em pt-BR), com a função usada pela simulação e o lado. */
export const POSICOES = {
  GOL: { nome: 'Goleiro', funcao: 'GOL', lado: null },
  LD: { nome: 'Lateral direito', funcao: 'LAT', lado: 'D' },
  LE: { nome: 'Lateral esquerdo', funcao: 'LAT', lado: 'E' },
  ZAG: { nome: 'Zagueiro', funcao: 'ZAG', lado: null },
  ADD: { nome: 'Ala direito', funcao: 'LAT', lado: 'D' },
  ADE: { nome: 'Ala esquerdo', funcao: 'LAT', lado: 'E' },
  VOL: { nome: 'Volante', funcao: 'VOL', lado: null },
  MC: { nome: 'Meia central', funcao: 'MEI', lado: null },
  MD: { nome: 'Meia direita', funcao: 'PON', lado: 'D' },
  ME: { nome: 'Meia esquerda', funcao: 'PON', lado: 'E' },
  MEI: { nome: 'Meia ofensivo', funcao: 'MEI', lado: null },
  PD: { nome: 'Ponta direita', funcao: 'PON', lado: 'D' },
  PE: { nome: 'Ponta esquerda', funcao: 'PON', lado: 'E' },
  SA: { nome: 'Segundo atacante', funcao: 'ATA', lado: null },
  ATA: { nome: 'Centroavante', funcao: 'ATA', lado: null },
};

/** Posição detalhada → j.posicao (a função que sim.js, acoes.js e goleiro.js já usam). */
export const FUNCAO = Object.fromEntries(Object.entries(POSICOES).map(([k, v]) => [k, v.funcao]));

/** Pesos da nota por posição (somam 1; nota = round(Σ peso·atributo)). Tela §7.1. */
export const PESOS = {
  GOL: { reflexo: 0.3, mergulho: 0.25, posicionamento: 0.25, impulsao: 0.1, passeLongo: 0.05, controle: 0.05 },
  ZAG: { marcacao: 0.25, desarme: 0.25, forca: 0.15, cabeceio: 0.15, passe: 0.1, velocidade: 0.05, impulsao: 0.05 },
  LD: { velocidade: 0.15, marcacao: 0.15, desarme: 0.15, passe: 0.15, passeLongo: 0.1, folego: 0.1, aceleracao: 0.1, drible: 0.1 },
  ADD: { velocidade: 0.15, passeLongo: 0.15, drible: 0.15, folego: 0.15, aceleracao: 0.1, marcacao: 0.1, desarme: 0.1, passe: 0.1 },
  VOL: { marcacao: 0.2, desarme: 0.2, passe: 0.2, passeLongo: 0.1, forca: 0.1, folego: 0.1, visao: 0.1 },
  MC: { passe: 0.25, visao: 0.2, passeLongo: 0.15, controle: 0.15, drible: 0.1, folego: 0.1, desarme: 0.05 },
  MD: { passeLongo: 0.2, drible: 0.2, velocidade: 0.15, passe: 0.15, controle: 0.1, folego: 0.1, aceleracao: 0.1 },
  MEI: { visao: 0.25, passe: 0.2, drible: 0.2, controle: 0.15, finalizacao: 0.15, agilidade: 0.05 },
  PD: { drible: 0.25, velocidade: 0.2, aceleracao: 0.15, finalizacao: 0.15, controle: 0.1, passeLongo: 0.1, agilidade: 0.05 },
  SA: { finalizacao: 0.25, drible: 0.2, controle: 0.15, passe: 0.15, visao: 0.1, aceleracao: 0.1, agilidade: 0.05 },
  ATA: { finalizacao: 0.35, cabeceio: 0.15, controle: 0.1, forca: 0.1, velocidade: 0.1, aceleracao: 0.1, impulsao: 0.1 },
};
PESOS.LE = PESOS.LD; PESOS.ADE = PESOS.ADD; PESOS.ME = PESOS.MD; PESOS.PE = PESOS.PD;

/** As 19 chaves geradas, em ordem fixa (a ordem entra na mistura: não mudar). */
export const CHAVES = [
  'velocidade', 'aceleracao', 'agilidade', 'equilibrio', 'drible', 'controle', 'forca', 'passe', 'passeLongo',
  'finalizacao', 'cabeceio', 'impulsao', 'reflexo', 'posicionamento', 'mergulho', 'marcacao', 'desarme', 'visao', 'folego',
];
const GOL_FRACO = ['finalizacao', 'drible', 'marcacao', 'desarme', 'cabeceio', 'velocidade', 'aceleracao'];
const SO_GOL = ['reflexo', 'posicionamento', 'mergulho'];
const ALTURA = { GOL: 188, ZAG: 186, ATA: 182, VOL: 180, SA: 176, MEI: 176, MC: 176, LD: 176, LE: 176, ADD: 176, ADE: 176, PD: 174, PE: 174, MD: 174, ME: 174 };

// ------------------------------------------------------------------------------------- times
// Formato (tela §7.2): Jog = {id, num, nome, camisa (≤ 10 caracteres), pos, alt: [pos], nivel, pe: 'D'|'E'}.
// Os nomes são comuns e combinados à mão (fictícios); o dono confere a lista.
const J = (base, num, nome, camisa, pos, alt, nivel, pe) => ({ id: base + num, num, nome, camisa, pos, alt, nivel, pe });

export const ELENCOS = {
  golaco: {
    id: 'golaco', nome: 'Golaço FC', sigla: 'GLÇ',
    uniforme: { linha: 'linha0', goleiro: 'goleiro0' },
    formacaoPadrao: '4-3-3',
    titularesPadrao: { GOL: 1, LE: 6, ZE: 4, ZD: 3, LD: 2, VOL: 5, MCE: 10, MCD: 8, PE: 11, ATA: 9, PD: 7 },
    taticaPadrao: { mentalidade: 0, pressao: 1, largura: 1, linha: 1 },
    jogadores: [
      J(0, 1, 'Davi Moreira', 'Moreira', 'GOL', [], 78, 'D'),
      J(0, 2, 'Renan Couto', 'Renan', 'LD', ['ADD'], 75, 'D'),
      J(0, 3, 'Heitor Lacerda', 'Heitor', 'ZAG', [], 76, 'D'),
      J(0, 4, 'Breno Valadares', 'Valadares', 'ZAG', [], 77, 'D'),
      J(0, 5, 'Elias Furtado', 'Elias', 'VOL', ['MC'], 76, 'D'),
      J(0, 6, 'Júlio Matias', 'Júlio', 'LE', ['ADE'], 74, 'E'),
      J(0, 7, 'Rafael Aguiar', 'Aguiar', 'PD', ['MD', 'SA'], 78, 'D'),
      J(0, 8, 'Bernardo Lins', 'Bernardo', 'MC', ['VOL', 'MEI'], 77, 'D'),
      J(0, 9, 'Diego Albuquerque', 'Diego', 'ATA', ['SA'], 79, 'D'),
      J(0, 10, 'Lucas Ventura', 'Ventura', 'MEI', ['MC', 'SA'], 80, 'E'),
      J(0, 11, 'Matheus Bastos', 'Bastos', 'PE', ['ME'], 77, 'D'),
      J(0, 12, 'Caio Brandão', 'Brandão', 'GOL', [], 72, 'D'),
      J(0, 13, 'Murilo Teixeira', 'Murilo', 'LD', ['ADD', 'ZAG'], 69, 'D'),
      J(0, 14, 'Otávio Rangel', 'Rangel', 'ZAG', [], 71, 'D'),
      J(0, 15, 'Samuel Paiva', 'Samuel', 'ZAG', ['VOL'], 68, 'D'),
      J(0, 16, 'Kauã Ribeiro', 'Kauã', 'LE', ['ADE', 'ME'], 68, 'E'),
      J(0, 17, 'Gustavo Arruda', 'Arruda', 'VOL', ['ZAG'], 70, 'D'),
      J(0, 18, 'Vinícius Prado', 'Vinícius', 'MC', ['MEI'], 71, 'D'),
      J(0, 19, 'Yuri Monteiro', 'Yuri', 'PD', ['MD'], 70, 'D'),
      J(0, 20, 'Enzo Cardoso', 'Enzo', 'MEI', ['PE'], 70, 'D'),
      J(0, 21, 'Pietro Damasceno', 'Pietro', 'PE', ['ME', 'MEI'], 69, 'E'),
      J(0, 22, 'Wallace Pimenta', 'Wallace', 'ATA', ['SA'], 71, 'D'),
      J(0, 23, 'Ícaro Santana', 'Ícaro', 'GOL', [], 66, 'D'),
    ],
  },
  ventania: {
    id: 'ventania', nome: 'Ventania FC', sigla: 'VNT',
    uniforme: { linha: 'linha1', goleiro: 'goleiro1' },
    formacaoPadrao: '4-2-3-1',
    titularesPadrao: { GOL: 101, LE: 106, ZE: 104, ZD: 103, LD: 102, VOLE: 108, VOLD: 105, ME: 111, MEI: 110, MD: 107, ATA: 109 },
    taticaPadrao: { mentalidade: 0, pressao: 1, largura: 1, linha: 1 },
    jogadores: [
      J(100, 1, 'Bruno Sampaio', 'Sampaio', 'GOL', [], 76, 'D'),
      J(100, 2, 'Anderson Lobato', 'Lobato', 'LD', ['ADD'], 72, 'D'),
      J(100, 3, 'Rodrigo Tavares', 'Tavares', 'ZAG', [], 75, 'D'),
      J(100, 4, 'Leandro Cunha', 'Leandro', 'ZAG', [], 74, 'E'),
      J(100, 5, 'Rogério Bezerra', 'Rogério', 'VOL', ['MC'], 75, 'D'),
      J(100, 6, 'Ezequiel Mesquita', 'Ezequiel', 'LE', ['ADE'], 73, 'E'),
      J(100, 7, 'Henrique Bittencourt', 'Henrique', 'PD', ['MD'], 76, 'D'),
      J(100, 8, 'André Nogueira', 'Nogueira', 'MC', ['VOL'], 76, 'D'),
      J(100, 9, 'Márcio Godoy', 'Godoy', 'ATA', ['SA'], 78, 'D'),
      J(100, 10, 'Gabriel Toledo', 'Toledo', 'MEI', ['MC', 'SA'], 78, 'E'),
      J(100, 11, 'Caetano Freire', 'Caetano', 'PE', ['ME'], 75, 'E'),
      J(100, 12, 'Fábio Quintela', 'Quintela', 'GOL', [], 71, 'D'),
      J(100, 13, 'Patrick Seabra', 'Patrick', 'LD', ['ADD'], 67, 'D'),
      J(100, 14, 'Marcelo Dutra', 'Dutra', 'ZAG', [], 70, 'D'),
      J(100, 15, 'Nícolas Fontes', 'Nícolas', 'ZAG', ['LD'], 67, 'D'),
      J(100, 16, 'Danilo Siqueira', 'Siqueira', 'LE', ['ADE'], 67, 'E'),
      J(100, 17, 'Hugo Peixoto', 'Peixoto', 'VOL', ['ZAG'], 69, 'D'),
      J(100, 18, 'Felipe Barreto', 'Barreto', 'MC', ['MEI'], 70, 'D'),
      J(100, 19, 'Alan Rezende', 'Alan', 'PD', ['MD'], 68, 'D'),
      J(100, 20, 'Igor Valente', 'Igor', 'MEI', ['SA'], 69, 'D'),
      J(100, 21, 'Luan Medeiros', 'Luan', 'PE', ['ME'], 68, 'D'),
      J(100, 22, 'Ramon Vilela', 'Ramon', 'ATA', ['SA', 'PD'], 70, 'D'),
      J(100, 23, 'Josué Amaral', 'Josué', 'GOL', [], 65, 'D'),
    ],
  },
};

const FICHAS = new Map();
for (const t of Object.values(ELENCOS)) for (const jog of t.jogadores) FICHAS.set(jog.id, { jog, elenco: t.id });

/** Ficha do jogador pelo id do mundo (ou null). */
export function fichaDe(id) {
  return FICHAS.get(id)?.jog ?? null;
}

/** Id do elenco do jogador (ou null). */
export function elencoDoJogador(id) {
  return FICHAS.get(id)?.elenco ?? null;
}

// ------------------------------------------------------------------------------- atributos
/** Mistura inteira de 32 bits (exata em todo motor JS). */
export function h32(a, b) {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(((b | 0) + 0x632be5ab) | 0, 0xc2b2ae35);
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15; h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}
const varia = (id, i) => (h32(id, i) % 9) - 4;

/** Nota na posição: round(Σ peso·atributo). */
export function notaNaPosicao(attr, pos) {
  const p = PESOS[pos];
  let s = 0;
  for (const k in p) s += p[k] * (attr[k] ?? 0);
  return Math.round(s);
}

const _attrCache = new Map();
/**
 * Atributos do jogador (tela §7.3), determinísticos: nível + bônus pelo peso na posição natural +
 * variação pelo id; corrigidos para a nota natural sair igual ao nível ± 1. Devolve um objeto NOVO
 * (cópia) com as 19 chaves + altura, peFraco e pePreferido.
 */
export function atributosDe(jog) {
  let a = _attrCache.get(jog.id);
  if (!a) {
    a = {};
    const pesos = PESOS[jog.pos];
    const gol = jog.pos === 'GOL';
    CHAVES.forEach((k, i) => {
      const w = pesos[k] ?? 0;
      let v = jog.nivel + (w >= 0.15 ? 3 : w > 0 ? 0 : -12) + varia(jog.id, i);
      if (gol && GOL_FRACO.includes(k)) v = jog.nivel - 30 + varia(jog.id, i);
      if (!gol && SO_GOL.includes(k)) v = 25 + varia(jog.id, i);
      a[k] = clamp(v, 25, 97);
    });
    for (let r = 0; r < 3; r++) {
      const d = jog.nivel - notaNaPosicao(a, jog.pos);
      if (d === 0) break;
      for (const k in pesos) a[k] = clamp(a[k] + d, 25, 97);
    }
    a.altura = ALTURA[jog.pos] + varia(jog.id, 19);
    a.peFraco = 35 + (h32(jog.id, 20) % 41);
    a.pePreferido = jog.pe === 'E' ? 0 : 1;
    _attrCache.set(jog.id, a);
  }
  return { ...a };
}

/** Encaixe do jogador numa vaga de posição `pos`: 'natural' | 'alternativa' | 'fora'. */
export function encaixeNaVaga(jog, pos) {
  if (jog.pos === pos) return 'natural';
  return jog.alt.includes(pos) ? 'alternativa' : 'fora';
}

/** Os 6 números da carta (RIT, FIN, PAS, DRI, DEF, FÍS), arredondados. */
export function numerosCarta(attr) {
  const r = Math.round;
  return {
    RIT: r(0.55 * attr.velocidade + 0.45 * attr.aceleracao),
    FIN: r(0.8 * attr.finalizacao + 0.2 * attr.cabeceio),
    PAS: r(0.5 * attr.passe + 0.3 * attr.passeLongo + 0.2 * attr.visao),
    DRI: r(0.45 * attr.drible + 0.35 * attr.controle + 0.2 * attr.agilidade),
    DEF: r(0.5 * attr.marcacao + 0.5 * attr.desarme),
    FIS: r(0.4 * attr.forca + 0.3 * attr.folego + 0.3 * attr.equilibrio),
  };
}

/**
 * Nota do time (tela §7.7): geral = média das 11 notas na vaga; ATA = vagas da fila 4; MEI = filas
 * 2–3; DEF = fila 1 + GOL. `vagas` = {vagaId: id}; `formacao` = objeto da formação (formacoes.js)
 * ou a lista de vagas dela.
 */
export function notaTime(vagas, formacao) {
  const lista = Array.isArray(formacao) ? formacao : formacao.vagas;
  const soma = { geral: [0, 0], ata: [0, 0], mei: [0, 0], def: [0, 0] };
  for (const v of lista) {
    const jog = fichaDe(vagas[v.id]);
    if (!jog) continue;
    const n = notaNaPosicao(atributosDe(jog), v.pos);
    const g = v.fila >= 4 ? 'ata' : v.fila >= 2 ? 'mei' : 'def';
    soma.geral[0] += n; soma.geral[1]++;
    soma[g][0] += n; soma[g][1]++;
  }
  const md = ([s, n]) => (n ? Math.round(s / n) : 0);
  return { geral: md(soma.geral), ata: md(soma.ata), mei: md(soma.mei), def: md(soma.def) };
}

/** Estrelas de ½ em ½ pela nota geral (82+ = 5; < 58 = ½). */
export function estrelas(geral) {
  return clamp(0.5 * (Math.floor((geral - 58) / 3) + 2), 0.5, 5);
}
