// Times do Total Match (TM) → elencos e times da partida do GOLAÇO (ponte com o TM; contrato em CONTRATOS.md,
// "Ponte com o Total Match"). Puro: sem three.js nem DOM, sem Math.random (o mesmo pedido = os mesmos times, sempre).
//
// timesDoPedido(pedido) → {elencos: [elCasa, elFora], times: {0: {formacao, vagas, tatica}, 1: {...}}, humano (0|1),
//   trava (id | null), mapa: {id: {tmId, nome, lado}}}
//  - o time 0 é o MANDANTE do TM (`home`) e o 1 o visitante (`away`): estádio, torcida da casa e o lado do resultado
//    seguem o índice; o humano é o time do usuário (`userSide`);
//  - ids no mundo: casa 1001–1018, fora 2001–2018 (inteiros fora dos reservados do jogo); o mapa leva de volta ao tmId;
//  - formação do TM → uma das 6 do GOLAÇO (FORMACAO_TM); os 11 titulares (os 11 primeiros do pedido, na ordem das vagas
//    da prancheta) vão para as vagas pelo algoritmo húngaro (custo = posição + distância entre a vaga da prancheta e a
//    vaga do GOLAÇO); o goleiro fica sempre no GOL;
//  - atributos (ficha com `attr` explícito, elenco.js atributosDe): o nível sai do overall do TM COMPRIMIDO para a faixa em
//    que o jogo foi calibrado (NIVEL_TM: 74 + (overall − 74) × 0,5 — os elencos do jogo têm 65–80) e o gerador do GOLAÇO
//    faz a base pela posição; o perfil do TM (pac/sho/pas/dri/def/phy/gk, em relação ao overall do próprio jogador) puxa
//    cada chave até ±6 e a nota na posição volta ao nível (a mesma correção do gerador): o time forte segue mais forte,
//    o rápido segue rápido, e o equilíbrio de gols da partida não sai da faixa.

import { gerarAtributos, notaNaPosicao, PESOS, CHAVES } from './elenco.js';
import { FORMACOES, hungaro } from './formacoes.js';
import { TATICA_PADRAO } from './tatica.js';
import { clamp } from './mat.js';

/** Ids dos elencos do TM e a base dos ids dos jogadores (casa, fora). */
export const ELENCOS_TM = ['tmcasa', 'tmfora'];
export const BASE_ID = [1000, 2000];

/** Formação do TM (as 16 da prancheta) → a mais parecida das 6 do GOLAÇO. */
export const FORMACAO_TM = {
  '4-3-3': '4-3-3', '4-2-3-1': '4-2-3-1', '4-4-2': '4-4-2', '4-1-4-1': '4-1-4-1', '3-5-2': '3-5-2', '5-3-2': '5-3-2',
  '4-5-1': '4-1-4-1', '4-4-1-1': '4-2-3-1', '4-1-2-1-2': '4-4-2', '4-2-2-2': '4-4-2', '4-2-4': '4-4-2',
  '3-4-3': '3-5-2', '3-4-1-2': '3-5-2', '3-4-2-1': '3-5-2', '5-4-1': '5-3-2', '5-2-3': '5-3-2',
};

/** Posição do pedido (a do 3D do TM) → código do GOLAÇO; o setor da prancheta é a reserva. */
const POS_TM = {
  GOL: 'GOL', ZAG: 'ZAG', LD: 'LD', LE: 'LE', ADD: 'ADD', ADE: 'ADE', VOL: 'VOL', MC: 'MC', MEI: 'MEI', MD: 'MD', ME: 'ME',
  PD: 'PD', PE: 'PE', SA: 'SA', CA: 'ATA', ATA: 'ATA',
};
const POS_SETOR = { GK: 'GOL', DF: 'ZAG', MF: 'MC', FW: 'ATA' };
/** Posições alternativas por posição (o encaixe e o "fora de posição" do Editar time). */
const ALT = {
  GOL: [], ZAG: ['VOL'], LD: ['ADD'], LE: ['ADE'], ADD: ['LD', 'MD'], ADE: ['LE', 'ME'], VOL: ['MC', 'ZAG'], MC: ['VOL', 'MEI'],
  MEI: ['MC', 'SA'], MD: ['PD', 'ADD'], ME: ['PE', 'ADE'], PD: ['MD', 'SA'], PE: ['ME', 'SA'], SA: ['ATA', 'MEI'], ATA: ['SA'],
};

/** Compressão do overall do TM para o nível do GOLAÇO. */
export const NIVEL_TM = { centro: 74, fator: 0.5, min: 58, max: 88 };
/** Quanto o perfil do TM puxa cada chave: fração do desvio (atributo − overall) e o teto em pontos. */
export const PERFIL_TM = { fator: 0.35, teto: 6 };
// atributo do TM → chaves do GOLAÇO (peso 1 = o desvio inteiro; 0,5 = metade)
const PUXA = {
  pac: { velocidade: 1, aceleracao: 1, agilidade: 0.5 },
  sho: { finalizacao: 1, cabeceio: 0.5 },
  pas: { passe: 1, passeLongo: 1, visao: 1 },
  dri: { drible: 1, controle: 1, agilidade: 0.5, equilibrio: 0.5 },
  def: { marcacao: 1, desarme: 1 },
  phy: { forca: 1, folego: 1, equilibrio: 0.5, impulsao: 0.5 },
};
const PUXA_GOL = { gk: { reflexo: 1, posicionamento: 1, mergulho: 1 } };

const num = (v, d) => (Number.isFinite(+v) ? +v : d);

/** Nível do GOLAÇO pelo overall do TM. */
export function nivelDoOverall(overall) {
  const o = num(overall, NIVEL_TM.centro);
  return Math.round(clamp(NIVEL_TM.centro + (o - NIVEL_TM.centro) * NIVEL_TM.fator, NIVEL_TM.min, NIVEL_TM.max));
}

/** Posição do GOLAÇO do jogador do pedido. */
export function posicaoDoTM(p) {
  return POS_TM[String(p?.pos ?? '').toUpperCase()] ?? POS_SETOR[p?.slot?.[0]] ?? 'MC';
}

/** Nome na camisa (≤ 10 caracteres): o sobrenome do nome curto do TM ("A. Rossi" → "Rossi"). */
function camisaDe(nome) {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
  const ult = partes.length ? partes[partes.length - 1] : 'Jogador';
  return ult.length > 10 ? ult.slice(0, 10) : ult;
}

/**
 * Atributos do GOLAÇO (19 chaves + altura, peFraco, pePreferido) de um jogador do TM: o gerador pelo nível e pela posição,
 * o perfil do TM puxando cada chave (até ±PERFIL_TM.teto) e a nota na posição de volta ao nível.
 */
export function atributosDoTM(p, id, pos, nivel) {
  const pe = p?.foot === 'E' ? 'E' : 'D';
  const a = gerarAtributos({ id, pos, nivel, pe });
  const at = p?.attrs ?? {};
  const ov = num(p?.overall, nivel);
  const tabela = pos === 'GOL' ? PUXA_GOL : PUXA;
  const soma = {};
  for (const k in tabela) {
    if (!Number.isFinite(+at[k])) continue;
    const d = +at[k] - ov;
    for (const c in tabela[k]) soma[c] = (soma[c] ?? 0) + d * tabela[k][c];
  }
  for (const c of CHAVES) {
    if (soma[c] == null) continue;
    a[c] = clamp(a[c] + clamp(Math.round(soma[c] * PERFIL_TM.fator), -PERFIL_TM.teto, PERFIL_TM.teto), 25, 97);
  }
  // a nota na posição volta ao nível (o perfil só redistribui; a força do time vem do nível)
  const pesos = PESOS[pos];
  for (let r = 0; r < 3; r++) {
    const d = nivel - notaNaPosicao(a, pos);
    if (d === 0) break;
    for (const k in pesos) a[k] = clamp(a[k] + d, 25, 97);
  }
  const alt = num(p?.look?.height, 0);
  if (alt > 1.4 && alt < 2.2) a.altura = Math.round(clamp(alt * 100, 160, 205));
  return a;
}

// vaga da prancheta do TM ([setor, x%, y%]: x da esquerda para a direita de quem ataca, y do ataque, 0, ao próprio gol,
// 100) → metros no referencial das vagas do GOLAÇO (sem a bola, bola no centro, atacando para +x; a direita é +z)
const ANCORAS_Y = [[88, -42], [71, -20], [52, -10], [44, -6], [32, -1], [16, 4]];
function slotEmMetros(slot) {
  if (!Array.isArray(slot) || !Number.isFinite(+slot[1]) || !Number.isFinite(+slot[2])) return null;
  const xs = +slot[1], ys = +slot[2];
  let x = ANCORAS_Y[0][1];
  if (ys <= ANCORAS_Y[ANCORAS_Y.length - 1][0]) x = ANCORAS_Y[ANCORAS_Y.length - 1][1];
  else for (let i = 0; i < ANCORAS_Y.length - 1; i++) {
    const [y0, x0] = ANCORAS_Y[i], [y1, x1] = ANCORAS_Y[i + 1];
    if (ys <= y0 && ys >= y1) { x = x0 + (x1 - x0) * (ys - y0) / (y1 - y0); break; }
  }
  return { x, z: (xs - 50) * 0.5 };
}

/**
 * Custo (inteiro) do jogador na vaga: a distância (m) entre a vaga da prancheta do TM e a vaga do GOLAÇO manda (é onde o
 * usuário pôs o jogador: o zagueiro na lateral direita joga de lateral direito) e a posição desempata (natural 0,
 * alternativa 1, fora 3; cada ponto vale 2 m). Sem a vaga da prancheta, só a posição.
 */
function custoVaga(jog, v) {
  const pen = jog.pos === v.pos ? 0 : jog.alt.includes(v.pos) ? 1 : 3;
  const s = jog._slot;
  const d = s ? Math.hypot(s.x - v.sem.x, s.z - v.sem.z) : 0;
  return Math.round(d * 10) + pen * 20;
}

/**
 * O jogador da trava (Rumo ao Estrelato) tem de estar em campo: se o pedido o trouxe no banco, ele entra no lugar do
 * titular mais parecido (mesma posição, senão a mesma função, senão qualquer um de linha; o de menor overall) e fica com
 * a vaga da prancheta dele. Devolve a lista nova (cópias rasas só dos dois trocados).
 */
function travadoTitular(ps, tmId) {
  const k = ps.findIndex(p => p.tmId === tmId);
  if (k < 11 || k < 0) return ps;
  const eu = ps[k], posEu = posicaoDoTM(eu), gol = posEu === 'GOL';
  const funcao = pos => (pos === 'GOL' ? 'GOL' : pos === 'ZAG' ? 'ZAG' : ['LD', 'LE', 'ADD', 'ADE'].includes(pos) ? 'LAT' : ['VOL', 'MC', 'MEI'].includes(pos) ? 'MEI' : ['MD', 'ME', 'PD', 'PE'].includes(pos) ? 'PON' : 'ATA');
  let mel = -1, mc = Infinity;
  for (let i = 0; i < Math.min(11, ps.length); i++) {
    const pos = posicaoDoTM(ps[i]);
    if ((pos === 'GOL') !== gol) continue;
    const c = (pos === posEu ? 0 : funcao(pos) === funcao(posEu) ? 1000 : 2000) + num(ps[i].overall, 70);
    if (c < mc) { mc = c; mel = i; }
  }
  if (mel < 0) return ps;
  const out = ps.slice();
  out[mel] = { ...eu, slot: ps[mel].slot };
  out[k] = { ...ps[mel], slot: undefined };
  return out;
}

/** Tática do GOLAÇO pelo estilo do TM (0–1; ausente = o padrão). */
function taticaDoEstilo(st) {
  const t = { ...TATICA_PADRAO };
  if (!st || typeof st !== 'object') return t;
  const nivel3 = v => (Number.isFinite(+v) ? (+v < 0.34 ? 0 : +v > 0.66 ? 2 : 1) : 1);
  t.pressao = nivel3(st.press);
  t.largura = nivel3(st.width);
  return t;
}

/**
 * Um time do pedido → {elenco, time: {formacao, vagas, tatica}, mapa}. titular: o tmId que tem de estar em campo (a trava
 * do Rumo ao Estrelato).
 */
export function timeDoTM(tm, lado, titular = null) {
  const elId = ELENCOS_TM[lado];
  const base = BASE_ID[lado];
  let ps = (Array.isArray(tm?.players) ? tm.players : []).filter(Boolean).slice(0, 18);
  if (titular != null) ps = travadoTitular(ps, titular);
  const formacao = FORMACAO_TM[tm?.formacaoTM] ?? FORMACAO_TM[tm?.formation] ?? '4-4-2';
  const jogadores = [];
  const mapa = {};
  ps.forEach((p, i) => {
    const id = base + i + 1;
    const pos = posicaoDoTM(p);
    const nivel = nivelDoOverall(p.overall);
    const nome = String(p.nomeCompleto || p.name || `Jogador ${i + 1}`);
    const jog = {
      id, num: Number.isInteger(+p.num) && +p.num > 0 ? +p.num : i + 1, nome, camisa: camisaDe(p.name || nome), pos,
      alt: ALT[pos] ?? [], nivel, pe: p.foot === 'E' ? 'E' : 'D', attr: atributosDoTM(p, id, pos, nivel),
      tmId: p.tmId ?? null,
    };
    jogadores.push(jog);
    mapa[id] = { tmId: p.tmId ?? null, nome: String(p.name || nome), lado };
  });
  // os 11 titulares nas vagas: o goleiro (pela posição do TM, senão a vaga GK da prancheta, senão o melhor no gol) fica
  // no GOL; os outros 10 pelo húngaro
  const tit = jogadores.slice(0, 11);
  tit.forEach((j, i) => { j._slot = slotEmMetros(ps[i]?.slot); });
  const f = FORMACOES[formacao];
  let gol = tit.find(j => j.pos === 'GOL') ?? tit.find((j, i) => ps[i]?.slot?.[0] === 'GK');
  if (!gol && tit.length) gol = tit.reduce((a, b) => (num(ps[b.id - base - 1]?.attrs?.gk, 0) > num(ps[a.id - base - 1]?.attrs?.gk, 0) ? b : a));
  const resto = tit.filter(j => j !== gol);
  const vagasLinha = f.vagas.filter(v => v.id !== 'GOL');
  const vagas = {};
  if (gol) vagas.GOL = gol.id;
  if (resto.length === vagasLinha.length) {
    const col = hungaro(resto.map(j => vagasLinha.map(v => custoVaga(j, v))));
    resto.forEach((j, i) => { vagas[vagasLinha[col[i]].id] = j.id; });
  } else {
    // pedido sem 11 titulares (não deveria vir): completa na ordem
    vagasLinha.forEach((v, i) => { if (resto[i]) vagas[v.id] = resto[i].id; });
  }
  for (const j of tit) delete j._slot;
  const ordenadas = {};
  for (const v of f.vagas) ordenadas[v.id] = vagas[v.id];
  const tatica = taticaDoEstilo(tm?.style);
  const sigla = String(tm?.short || tm?.name || (lado ? 'VIS' : 'CAS')).replace(/[^0-9A-Za-zÀ-ÿ]/g, '').toUpperCase().slice(0, 3) || (lado ? 'VIS' : 'CAS');
  const elenco = {
    id: elId, nome: String(tm?.name || (lado ? 'Visitante' : 'Mandante')), sigla,
    uniforme: { linha: lado ? 'linha1' : 'linha0', goleiro: lado ? 'goleiro1' : 'goleiro0' },
    formacaoPadrao: formacao, titularesPadrao: ordenadas, taticaPadrao: tatica, jogadores,
    tm: { id: tm?.id ?? null },
  };
  return { elenco, time: { formacao, vagas: ordenadas, tatica: { ...tatica } }, mapa };
}

/** Pedido do TM → elencos, times, lado do humano, trava ("só o meu jogador") e o mapa id → {tmId, nome, lado}. */
export function timesDoPedido(pedido) {
  const humano = pedido?.userSide === 'away' ? 1 : 0;
  const tmTrava = pedido?.controle?.tmId ?? null;
  const casa = timeDoTM(pedido?.home, 0, humano === 0 ? tmTrava : null), fora = timeDoTM(pedido?.away, 1, humano === 1 ? tmTrava : null);
  const mapa = { ...casa.mapa, ...fora.mapa };
  let trava = null;
  const tmId = pedido?.controle?.tmId;
  if (tmId != null) {
    const t = humano ? fora : casa;
    const emCampo = new Set(Object.values(t.time.vagas));
    for (const j of t.elenco.jogadores) if (j.tmId === tmId && emCampo.has(j.id)) { trava = j.id; break; }
  }
  return { elencos: [casa.elenco, fora.elenco], times: { 0: casa.time, 1: fora.time }, humano, trava, mapa };
}
