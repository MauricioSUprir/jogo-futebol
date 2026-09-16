/* ===== engine.js — o motor do KATSEYE Central =====

   Tudo que é "inteligência" sem IA mora aqui e é determinístico:
     · interpretar()   lê "reunião sexta 15h com a Sophia" e devolve o compromisso
     · notaPrioridade() ordena tarefas por prazo, importância e esforço
     · resumoDoDia()   escreve o resumo executivo sem chamar servidor nenhum
     · metricas()      números do Command Center
     · feed()          a linha do tempo do painel
   Nada aqui depende de rede: se a internet cair, o app continua inteiro.   */

import {
  iso, hoje, addDias, parseISO, diasEntre, clamp, norm, uid,
  DIAS, DIAS_S, MESES, MESES_S, fmtData, horasAte, round,
} from './util.js';
import { st, integrantes, lancamentos, TIPOS_EVENTO } from './store.js';
import { GRUPO } from './dados.js';

/* ==========================================================
   1. INTERPRETADOR DE LINGUAGEM NATURAL
   ========================================================== */

const DIAS_CHAVE = [
  { i: 0, nomes: ['domingo', 'dom'] },
  { i: 1, nomes: ['segunda-feira', 'segunda', 'seg'] },
  { i: 2, nomes: ['terca-feira', 'terca', 'ter'] },
  { i: 3, nomes: ['quarta-feira', 'quarta', 'qua'] },
  { i: 4, nomes: ['quinta-feira', 'quinta', 'qui'] },
  { i: 5, nomes: ['sexta-feira', 'sexta', 'sex'] },
  { i: 6, nomes: ['sabado', 'sab'] },
];

const TIPO_CHAVE = [
  { tipo: 'aniversario', termos: ['aniversario', 'aniversário', 'comemorar', 'data especial', 'debut anniversary'] },
  { tipo: 'comeback', termos: ['comeback', 'lancamento', 'lançamento', 'album', 'álbum', 'single', 'ep ', 'mv', 'clipe', 'teaser', 'estreia'] },
  { tipo: 'show', termos: ['show', 'turne', 'turnê', 'concerto', 'festival', 'palco', 'apresentacao', 'apresentação', 'fanmeeting', 'fan meeting'] },
  { tipo: 'reuniao', termos: ['reuniao', 'reunião', 'call', 'meeting', 'alinhamento', 'briefing', 'conversa com', 'apresentar para'] },
  { tipo: 'conteudo', termos: ['gravacao', 'gravação', 'gravar', 'conteudo', 'conteúdo', 'video', 'vídeo', 'foto', 'ensaio', 'edicao', 'edição', 'making of'] },
];

const MARCA_TAREFA = ['lembrar', 'preciso', 'tarefa', 'fazer', 'terminar', 'entregar', 'revisar', 'comprar', 'mandar', 'enviar', 'responder', 'escrever'];
const MARCA_URGENTE = ['urgente', 'urgentissimo', 'agora', 'prioridade alta', 'importante', 'critico', 'crítico', 'asap'];
const MARCA_BAIXA = ['quando der', 'sem pressa', 'algum dia', 'se sobrar tempo', 'baixa prioridade'];

/**
 * Remove do título os trechos que já viraram data/hora/local.
 * Os trechos chegam normalizados (sem acento), então a comparação é feita
 * sobre a versão normalizada do texto — que tem o mesmo comprimento do
 * original, porque `norm` só tira os acentos, nunca letras.
 */
function tirar(txt, ...pedacos) {
  let out = txt;
  for (const p of pedacos.filter(Boolean)) {
    const alvo = norm(p).trim();
    if (!alvo) continue;
    const i = norm(out).indexOf(alvo);
    if (i < 0) continue;
    out = `${out.slice(0, i)} ${out.slice(i + alvo.length)}`;
  }
  return out.replace(/\s{2,}/g, ' ').trim();
}

/** Acha a hora no texto: "15h", "15h30", "às 9:45", "19 horas". */
function acharHora(bruto) {
  const m = norm(bruto).match(/(?:\b(?:as|às|ás)\s*)?\b([01]?\d|2[0-3])\s*(?:h|:|horas?\b)\s*([0-5]\d)?\b/i);
  if (!m) return { hora: '', trecho: '' };
  const hh = String(Number(m[1])).padStart(2, '0');
  const mm = (m[2] || '00').padStart(2, '0');
  return { hora: `${hh}:${mm}`, trecho: m[0] };
}

/** Acha a data no texto, em várias formas. Devolve ISO + o trecho consumido. */
function acharData(bruto) {
  const t = norm(bruto);
  const base = hoje();

  // 1. relativos diretos
  const diretos = [
    { re: /\bdepois de amanha\b/, dias: 2 },
    { re: /\bamanha\b/, dias: 1 },
    { re: /\bhoje\b/, dias: 0 },
    { re: /\bontem\b/, dias: -1 },
  ];
  for (const d of diretos) {
    const m = t.match(d.re);
    if (m) return { data: iso(addDias(base, d.dias)), trecho: m[0] };
  }

  // 2. "daqui a N dias/semanas/meses" | "em N dias"
  const rel = t.match(/\b(?:daqui a|daqui|em)\s+(\d{1,3})\s+(dias?|semanas?|mes(?:es)?|meses)\b/);
  if (rel) {
    const n = Number(rel[1]);
    const mult = /semana/.test(rel[2]) ? 7 : /mes/.test(rel[2]) ? 30 : 1;
    return { data: iso(addDias(base, n * mult)), trecho: rel[0] };
  }

  // 3. dd/mm[/aaaa]
  const barra = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (barra) {
    const dia = Number(barra[1]); const mes = Number(barra[2]);
    let ano = barra[3] ? Number(barra[3]) : base.getFullYear();
    if (ano < 100) ano += 2000;
    const d = new Date(ano, mes - 1, dia);
    if (!barra[3] && d < base) d.setFullYear(ano + 1);   // data já passada = ano que vem
    if (d.getMonth() === mes - 1) return { data: iso(d), trecho: barra[0] };
  }

  // 4. "28 de junho" | "dia 28 de junho de 2026"
  const extenso = t.match(/\b(?:dia\s+)?(\d{1,2})\s+de\s+([a-zç]+)(?:\s+de\s+(\d{4}))?\b/);
  if (extenso) {
    const mes = MESES.findIndex((mm) => norm(mm).startsWith(norm(extenso[2]).slice(0, 3)));
    if (mes >= 0) {
      const dia = Number(extenso[1]);
      const ano = extenso[3] ? Number(extenso[3]) : base.getFullYear();
      const d = new Date(ano, mes, dia);
      if (!extenso[3] && d < base) d.setFullYear(ano + 1);
      return { data: iso(d), trecho: extenso[0] };
    }
  }

  // 5. dia da semana ("sexta", "próxima terça")
  for (const d of DIAS_CHAVE) {
    for (const nome of d.nomes) {
      const re = new RegExp(`\\b(proxima|proximo|que vem)?\\s*${nome}(?:-feira)?\\b`);
      const m = t.match(re);
      if (!m) continue;
      let delta = (d.i - base.getDay() + 7) % 7;
      if (delta === 0) delta = 7;                         // "sexta" numa sexta = a que vem
      // Em português "próxima sexta" já é a sexta que está chegando, então
      // "próxima" não empurra mais uma semana — só reforça o mesmo dia.
      return { data: iso(addDias(base, delta)), trecho: m[0].trim() };
    }
  }

  // 6. "dia 28" solto
  const soDia = t.match(/\bdia\s+(\d{1,2})\b/);
  if (soDia) {
    const dia = Number(soDia[1]);
    const d = new Date(base.getFullYear(), base.getMonth(), dia);
    if (d < base) d.setMonth(d.getMonth() + 1);
    return { data: iso(d), trecho: soDia[0] };
  }

  return { data: '', trecho: '' };
}

/** Acha repetição: "toda sexta", "todo dia", "todo mês". */
function acharRepeticao(bruto) {
  const t = norm(bruto);
  if (/\btodo dia\b|\bdiariamente\b|\btodos os dias\b/.test(t)) return { repete: 'diario', trecho: t.match(/\btodo dia\b|\bdiariamente\b|\btodos os dias\b/)[0] };
  if (/\btod[ao] (semana|sexta|segunda|terca|quarta|quinta|sabado|domingo)\b|\bsemanalmente\b/.test(t)) {
    return { repete: 'semanal', trecho: '' };
  }
  if (/\btodo mes\b|\bmensalmente\b|\btodo mês\b/.test(t)) return { repete: 'mensal', trecho: t.match(/\btodo mes\b|\bmensalmente\b/)?.[0] || '' };
  return { repete: '', trecho: '' };
}

/**
 * Lê uma frase e devolve um compromisso ou uma tarefa prontos para salvar.
 * Devolve sempre `explicacao` — o texto que a tela mostra antes de confirmar,
 * para a pessoa conferir se o app entendeu certo.
 */
export function interpretar(bruto) {
  const texto = String(bruto || '').trim();
  if (!texto) return null;
  const t = norm(texto);

  const { hora, trecho: trHora } = acharHora(texto);
  const { data, trecho: trData } = acharData(texto);
  const { repete } = acharRepeticao(texto);

  // tipo do compromisso
  let tipo = 'outro';
  for (const g of TIPO_CHAVE) {
    if (g.termos.some((termo) => t.includes(norm(termo)))) { tipo = g.tipo; break; }
  }

  // integrante citada
  let integranteId = '';
  let trMembro = '';
  for (const m of integrantes()) {
    const re = new RegExp(`\\b${norm(m.nome)}\\b`);
    if (re.test(t)) { integranteId = m.id; trMembro = m.nome; break; }
  }

  // Tarefa ou compromisso? Hora marcada é compromisso. Fora isso, um verbo de
  // tarefa vence — a menos que o texto nomeie um compromisso de verdade
  // (reunião, show, comeback, data especial). O que sobrar de dúvida a tela
  // resolve: o preview deixa trocar de um para o outro antes de salvar.
  const verboTarefa = MARCA_TAREFA.some((p) => t.startsWith(p) || t.includes(` ${p} `));
  const tipoForte = ['comeback', 'show', 'reuniao', 'aniversario'].includes(tipo);
  const pareceTarefa = verboTarefa && !hora && !tipoForte;
  const urgente = MARCA_URGENTE.some((p) => t.includes(norm(p)));
  const baixa = MARCA_BAIXA.some((p) => t.includes(norm(p)));

  // O que sobra depois de tirar data e hora — é aí que o local é procurado,
  // senão "em São Paulo dia 12 de outubro" viraria um local com data dentro.
  const resto = tirar(texto, trData, trHora);
  let local = '';
  const mLocal = resto.match(/\b(?:no|na|em|@)\s+([\wÀ-ÿ][\wÀ-ÿ' ]{2,28}?)\s*$/);
  if (mLocal) local = mLocal[1].trim();

  // título: a sobra, sem as marcações que já viraram campo
  let titulo = tirar(resto, mLocal?.[0] || '')
    .replace(/^(lembrar de|lembrar|preciso de|preciso|tarefa:?|marcar|agendar|criar)\s+/i, '')
    .replace(new RegExp(`\\s*\\b(${[...MARCA_URGENTE, ...MARCA_BAIXA].join('|')})\\b\\s*`, 'gi'), ' ')
    .replace(/\b(as|às|no dia|dia|com a|com o|toda|todo|ate|até|para|pra)\s*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s,;:-]+$/, '')
    .trim();
  if (!titulo) titulo = pareceTarefa ? 'Tarefa' : (TIPOS_EVENTO.find((x) => x.id === tipo)?.nome || 'Compromisso');
  titulo = titulo.charAt(0).toUpperCase() + titulo.slice(1);

  const dataFinal = data || iso(pareceTarefa ? addDias(hoje(), 1) : hoje());
  const quandoTxt = `${fmtData(dataFinal)}${hora ? ` às ${hora}` : ''}`;
  const membroTxt = trMembro ? ` · com ${trMembro}` : '';

  if (pareceTarefa) {
    return {
      kind: 'tarefa',
      dados: {
        titulo,
        prazo: dataFinal,
        importancia: urgente ? 5 : baixa ? 1 : 3,
        esforco: 2,
        integranteId,
        tags: [],
      },
      explicacao: `Tarefa · prazo ${quandoTxt}${urgente ? ' · urgente' : ''}${membroTxt}`,
      confianca: data ? 'alta' : 'media',
    };
  }

  return {
    kind: 'evento',
    dados: {
      titulo, data: dataFinal, hora, tipo, local, integranteId, repete,
    },
    explicacao: `${TIPOS_EVENTO.find((x) => x.id === tipo)?.emoji || '📌'} ${TIPOS_EVENTO.find((x) => x.id === tipo)?.nome || 'Compromisso'}`
      + ` · ${quandoTxt}${local ? ` · ${local}` : ''}${membroTxt}${repete ? ` · repete ${repete}` : ''}`,
    confianca: data || hora ? 'alta' : 'baixa',
  };
}

/** Exemplos mostrados embaixo do campo de captura rápida. */
export const EXEMPLOS = [
  'reunião de pauta sexta 15h',
  'comeback dia 28/06',
  'gravar conteúdo com a Lara amanhã 10h',
  'lembrar de fechar o cartaz até quinta',
  'show em São Paulo dia 12 de outubro',
];

/* ==========================================================
   2. PRIORIDADE
   ========================================================== */
/**
 * Nota 0–100. Combina prazo, importância e esforço.
 * Regra dura: tarefa atrasada nunca cai abaixo de 90 — ela tem que aparecer.
 */
export function notaPrioridade(t) {
  if (t.status === 'concluida') return 0;
  const dias = diasEntre(hoje(), parseISO(t.prazo) || hoje());
  if (dias < 0) return clamp(90 + Math.min(10, Math.abs(dias)), 90, 100);

  const urgencia = dias === 0 ? 40 : dias === 1 ? 33 : dias <= 3 ? 26 : dias <= 7 ? 17 : dias <= 14 ? 9 : 4;
  const peso = ((Number(t.importancia) || 3) / 5) * 38;
  const leve = (4 - clamp(Number(t.esforco) || 2, 1, 4)) * 4;    // tarefa curta sobe um pouco
  return clamp(Math.round(urgencia + peso + leve), 0, 89);
}

export function corPrioridade(nota) {
  if (nota >= 90) return { cor: '#ff6b6b', rot: 'atrasada', cls: 'bad' };
  if (nota >= 65) return { cor: '#ff9f45', rot: 'alta', cls: 'alert' };
  if (nota >= 40) return { cor: '#f7c948', rot: 'média', cls: 'warn' };
  return { cor: '#3ddc97', rot: 'baixa', cls: 'ok' };
}

/** Tarefas abertas em ordem de prioridade. */
export function ordemDoDia(limite = 0) {
  const lista = st().tarefas
    .filter((t) => t.status !== 'concluida')
    .map((t) => ({ ...t, nota: notaPrioridade(t) }))
    .sort((a, b) => b.nota - a.nota);
  return limite ? lista.slice(0, limite) : lista;
}

/* ==========================================================
   3. AGENDA — leitura da semana
   ========================================================== */
/** Eventos de um dia, incluindo os que se repetem. */
export function eventosNoDia(dataISO) {
  const alvo = parseISO(dataISO);
  if (!alvo) return [];
  return st().eventos.filter((e) => {
    if (e.data === dataISO) return true;
    if (!e.repete) return false;
    const base = parseISO(e.data);
    if (!base || alvo < base) return false;
    const d = diasEntre(base, alvo);
    if (e.repete === 'diario') return true;
    if (e.repete === 'semanal') return d % 7 === 0;
    if (e.repete === 'mensal') return base.getDate() === alvo.getDate();
    return false;
  }).sort((a, b) => String(a.hora || '99').localeCompare(String(b.hora || '99')));
}

export function proximosEventos(n = 5, diasAdiante = 60) {
  const out = [];
  for (let i = 0; i <= diasAdiante && out.length < n * 3; i += 1) {
    const dia = iso(addDias(hoje(), i));
    for (const e of eventosNoDia(dia)) out.push({ ...e, dataEfetiva: dia });
  }
  return out.slice(0, n);
}

export function proximoEvento() { return proximosEventos(1)[0] || null; }

/** Contagem regressiva para uma data, em dias/horas. */
export function contagem(dataISO, hora = '') {
  const horas = horasAte(dataISO, hora);
  if (horas < 0) return { passou: true, txt: 'já passou', dias: 0, horas: 0 };
  const dias = Math.floor(horas / 24);
  const restoH = Math.floor(horas % 24);
  if (dias > 0) return { passou: false, dias, horas: restoH, txt: `${dias}d ${restoH}h` };
  if (restoH > 0) return { passou: false, dias: 0, horas: restoH, txt: `${restoH}h` };
  return { passou: false, dias: 0, horas: 0, txt: `${Math.max(1, Math.round(horas * 60))}min` };
}

/* ==========================================================
   4. MÉTRICAS DE PRODUTIVIDADE
   ========================================================== */
export function metricas() {
  const s = st();
  const base = hoje();
  const concluidas = s.tarefas.filter((t) => t.status === 'concluida');
  const abertas = s.tarefas.filter((t) => t.status !== 'concluida');
  const atrasadas = abertas.filter((t) => diasEntre(base, parseISO(t.prazo) || base) < 0);
  const paraHoje = abertas.filter((t) => t.prazo === iso(base));

  const seteDias = Array.from({ length: 7 }, (_, i) => {
    const d = addDias(base, i - 6);
    const dISO = iso(d);
    return {
      rot: DIAS_S[d.getDay()],
      v: concluidas.filter((t) => String(t.concluidaEm || '').slice(0, 10) === dISO).length,
      dim: i === 6 ? false : undefined,
    };
  });

  const feitas7 = seteDias.reduce((a, b) => a + b.v, 0);
  const criadas7 = s.tarefas.filter((t) => diasEntre(parseISO(String(t.criadaEm).slice(0, 10)) || base, base) <= 6).length;
  const taxa = s.tarefas.length ? (concluidas.length / s.tarefas.length) * 100 : 0;

  // sequência: dias seguidos, até hoje, com pelo menos uma tarefa concluída
  let sequencia = 0;
  for (let i = 0; i < 60; i += 1) {
    const dISO = iso(addDias(base, -i));
    const teve = concluidas.some((t) => String(t.concluidaEm || '').slice(0, 10) === dISO);
    if (teve) sequencia += 1;
    else if (i > 0) break;                                  // hoje ainda pode não ter
  }

  const semana = {
    eventos: Array.from({ length: 7 }, (_, i) => eventosNoDia(iso(addDias(base, i))).length).reduce((a, b) => a + b, 0),
  };

  return {
    abertas: abertas.length,
    concluidas: concluidas.length,
    atrasadas: atrasadas.length,
    paraHoje: paraHoje.length,
    feitas7,
    criadas7,
    taxa: round(taxa),
    sequencia,
    seteDias,
    eventosSemana: semana.eventos,
    projetos: s.projetos.length,
    diasDesdeEstreia: Math.max(0, diasEntre(parseISO(GRUPO.estreia), base)),
  };
}

/* ==========================================================
   5. RESUMOS AUTOMÁTICOS (sem IA)
   ========================================================== */
export function resumoDoDia() {
  const m = metricas();
  const evs = eventosNoDia(iso(hoje()));
  const top = ordemDoDia(3);
  const linhas = [];

  if (evs.length) {
    const lista = evs.map((e) => `${e.hora ? `${e.hora} ` : ''}${e.titulo}`).join(' · ');
    linhas.push(`**${evs.length} compromisso${evs.length > 1 ? 's' : ''} hoje:** ${lista}.`);
  } else {
    linhas.push('**Nenhum compromisso marcado para hoje.**');
  }

  if (m.atrasadas) linhas.push(`⚠️ **${m.atrasadas} tarefa${m.atrasadas > 1 ? 's atrasadas' : ' atrasada'}** — resolve antes de abrir frente nova.`);
  if (m.paraHoje) linhas.push(`${m.paraHoje} tarefa${m.paraHoje > 1 ? 's vencem' : ' vence'} hoje.`);

  if (top.length) {
    linhas.push('**Ordem sugerida:**');
    top.forEach((t, i) => linhas.push(`- ${i + 1}. ${t.titulo} (${corPrioridade(t.nota).rot})`));
  } else if (!m.abertas) {
    linhas.push('Nenhuma tarefa aberta. Bom momento para planejar a próxima campanha.');
  }

  if (m.sequencia > 1) linhas.push(`🔥 Sequência de **${m.sequencia} dias** entregando alguma coisa.`);
  return linhas.join('\n');
}

export function resumoDaSemana() {
  const base = hoje();
  const inicio = addDias(base, -base.getDay());
  const linhas = [];
  let totalEv = 0;

  for (let i = 0; i < 7; i += 1) {
    const d = addDias(inicio, i);
    const evs = eventosNoDia(iso(d));
    totalEv += evs.length;
    if (evs.length) linhas.push(`- **${DIAS[d.getDay()]}**: ${evs.map((e) => e.titulo).join(', ')}`);
  }

  const m = metricas();
  const cabeca = [
    `**Semana de ${fmtData(iso(inicio), { relativo: false, curto: true })} a ${fmtData(iso(addDias(inicio, 6)), { relativo: false, curto: true })}**`,
    `${totalEv} compromisso${totalEv === 1 ? '' : 's'} · ${m.abertas} tarefa${m.abertas === 1 ? '' : 's'} em aberto · ${m.feitas7} concluída${m.feitas7 === 1 ? '' : 's'} nos últimos 7 dias.`,
  ];

  if (!linhas.length) cabeca.push('\nA agenda da semana está vazia — dá para usar o espaço para produção.');
  const rodape = m.atrasadas
    ? `\n⚠️ Atenção: ${m.atrasadas} tarefa(s) passaram do prazo.`
    : '\n✅ Nada atrasado.';

  return [...cabeca, '', ...linhas, rodape].join('\n');
}

/* ==========================================================
   6. NOTIFICAÇÕES E FEED
   ========================================================== */
export function notificacoes() {
  const out = [];
  const base = hoje();
  const m = metricas();

  if (m.atrasadas) {
    out.push({
      id: `atr_${m.atrasadas}_${iso(base)}`, icone: '⚠️', rota: '#/agenda',
      txt: `${m.atrasadas} tarefa${m.atrasadas > 1 ? 's' : ''} atrasada${m.atrasadas > 1 ? 's' : ''}.`,
    });
  }
  if (m.paraHoje) {
    out.push({
      id: `hoje_${m.paraHoje}_${iso(base)}`, icone: '⏰', rota: '#/agenda',
      txt: `${m.paraHoje} tarefa${m.paraHoje > 1 ? 's vencem' : ' vence'} hoje.`,
    });
  }
  for (const e of proximosEventos(4, 3)) {
    const c = contagem(e.dataEfetiva, e.hora);
    out.push({
      id: `ev_${e.id}_${e.dataEfetiva}`, icone: TIPOS_EVENTO.find((x) => x.id === e.tipo)?.emoji || '📌',
      rota: '#/agenda', txt: `${e.titulo} — ${c.passou ? 'agora' : `em ${c.txt}`}.`,
    });
  }
  for (const a of aniversarios(14)) {
    out.push({ id: `an_${a.id}_${a.ano}`, icone: '🎉', rota: '#/membros', txt: a.texto });
  }
  return out;
}

/** Aniversários de lançamento nos próximos `dias`. */
export function aniversarios(dias = 30) {
  const base = hoje();
  const out = [];
  const marcos = [
    { id: 'estreia', titulo: `estreia do ${GRUPO.nome}`, data: GRUPO.estreia },
    ...lancamentos().map((r) => ({ id: r.id, titulo: `"${r.titulo}"`, data: r.data })),
  ];
  for (const mk of marcos) {
    const d = parseISO(mk.data);
    if (!d) continue;
    const esteAno = new Date(base.getFullYear(), d.getMonth(), d.getDate());
    const alvo = esteAno < base ? new Date(base.getFullYear() + 1, d.getMonth(), d.getDate()) : esteAno;
    const falta = diasEntre(base, alvo);
    if (falta > dias) continue;
    const anos = alvo.getFullYear() - d.getFullYear();
    out.push({
      id: mk.id, ano: alvo.getFullYear(), dias: falta, data: iso(alvo),
      texto: falta === 0
        ? `Hoje, ${mk.titulo} faz ${anos} ano${anos === 1 ? '' : 's'}.`
        : `${mk.titulo} faz ${anos} ano${anos === 1 ? '' : 's'} em ${falta} dia${falta === 1 ? '' : 's'}.`,
    });
  }
  return out.sort((a, b) => a.dias - b.dias);
}

/**
 * O feed do Command Center: o registro de atividade misturado com o que
 * está chegando na agenda e com os aniversários da semana.
 */
export function feed(limite = 12) {
  const s = st();
  const itens = [];

  for (const e of proximosEventos(4, 30)) {
    const c = contagem(e.dataEfetiva, e.hora);
    itens.push({
      id: `f_${e.id}_${e.dataEfetiva}`,
      icone: TIPOS_EVENTO.find((x) => x.id === e.tipo)?.emoji || '📌',
      titulo: e.titulo,
      texto: `${fmtData(e.dataEfetiva)}${e.hora ? ` às ${e.hora}` : ''}${e.local ? ` · ${e.local}` : ''}`,
      quando: c.passou ? 'agora' : `em ${c.txt}`,
      rota: '#/agenda',
      peso: 0,
    });
  }
  for (const a of aniversarios(21)) {
    itens.push({
      id: `f_an_${a.id}_${a.ano}`, icone: '🎉', titulo: 'Data para lembrar',
      texto: a.texto, quando: a.dias === 0 ? 'hoje' : `em ${a.dias}d`, rota: '#/membros', peso: 1,
    });
  }
  for (const l of s.log.slice(0, limite)) {
    itens.push({
      id: l.id, icone: l.icone, titulo: l.titulo, texto: l.texto,
      quando: l.em, rota: l.rota, peso: 2, éLog: true,
    });
  }
  return itens.sort((a, b) => a.peso - b.peso).slice(0, limite);
}

/* ==========================================================
   7. SAÚDE DO PLANEJAMENTO
   ========================================================== */
/**
 * Um índice 0–100 do quanto o planejamento está sob controle.
 * Não é nota de esforço: é semáforo. Cai com atraso e com agenda vazia,
 * sobe com entrega constante.
 */
export function saudeDoPlano() {
  const m = metricas();
  let nota = 60;
  nota -= Math.min(35, m.atrasadas * 9);
  nota += Math.min(20, m.feitas7 * 3);
  nota += m.eventosSemana ? 10 : -6;
  nota += m.sequencia >= 3 ? 8 : 0;
  nota += m.abertas > 0 && m.abertas <= 12 ? 6 : m.abertas > 20 ? -8 : 0;
  nota = clamp(Math.round(nota), 0, 100);

  const leitura = nota >= 80 ? { rot: 'sob controle', cls: 'ok' }
    : nota >= 60 ? { rot: 'andando bem', cls: 'warn' }
      : nota >= 38 ? { rot: 'precisa de atenção', cls: 'alert' }
        : { rot: 'fora de controle', cls: 'bad' };

  return { nota, ...leitura };
}

export { uid };
