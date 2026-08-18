/* ===== ai.js — Study AI =====
   Fala direto com a Claude API a partir do navegador (o app é 100% estático,
   não existe servidor). A chave fica só no aparelho do aluno, no localStorage.
   Sem chave, TODA função continua funcionando em "modo offline" com um
   fallback local — mais simples, porém honesto (nunca inventa conteúdo).      */
import { st, set } from './store.js';
import {
  frases, palavras, STOP, norm, iso, uid, clamp, round, sum,
} from './util.js';
import {
  dominioMateria, semaforo, preparoProva, filaRevisao, resumoPeriodo, nivelDe, prioridade,
} from './engine.js';

const URL_API = 'https://api.anthropic.com/v1/messages';
const VERSAO = '2023-06-01';
export const MODELOS = [
  { id: 'claude-opus-5', nome: 'Opus 5 — o mais capaz' },
  { id: 'claude-sonnet-5', nome: 'Sonnet 5 — rápido e barato' },
  { id: 'claude-haiku-4-5', nome: 'Haiku 4.5 — o mais leve' },
];

export const temIA = () => !!(st().ia.chave || '').trim();

/* ---------- chamada base ---------- */
export async function chamar({
  system, conteudo, schema = null, maxTokens = 8000, esforco = 'medium', timeout = 150000,
}) {
  const s = st();
  const chave = (s.ia.chave || '').trim();
  if (!chave) throw new Error('SEM_CHAVE');

  const body = {
    model: s.ia.modelo || 'claude-opus-5',
    max_tokens: maxTokens,
    output_config: { effort: esforco },
    system,
    messages: [{ role: 'user', content: conteudo }],
  };
  if (schema) body.output_config.format = { type: 'json_schema', schema };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let r;
  try {
    r = await fetch(URL_API, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': chave,
        'anthropic-version': VERSAO,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('A resposta demorou demais. Tente de novo (ou escolha um modelo mais leve nas Configurações).');
    throw new Error('Não consegui falar com a Claude API. Verifique sua internet — e, se você abriu o StudyLab dentro de '
      + 'um preview (Artifact, sandbox, iframe), a política de segurança dessa página bloqueia chamadas externas: '
      + 'use o link normal do app para o Study AI funcionar.');
  }
  clearTimeout(timer);

  if (!r.ok) {
    let det = '';
    try { det = (await r.json())?.error?.message || ''; } catch { /* ignora */ }
    if (r.status === 401) throw new Error('Chave da API inválida. Confira em Configurações → Study AI.');
    if (r.status === 429) throw new Error('Muitas chamadas seguidas. Espere alguns segundos e tente de novo.');
    if (r.status === 400 && /credit|balance/i.test(det)) throw new Error('Sua conta da Anthropic está sem créditos.');
    throw new Error(`Erro ${r.status} da API${det ? ': ' + det : ''}`);
  }

  const data = await r.json();
  set((x) => {
    if (x.ia.usoDia !== iso()) { x.ia.usoDia = iso(); x.ia.usoHoje = 0; }
    x.ia.usoHoje++;
  });
  if (data.stop_reason === 'refusal') throw new Error('O modelo preferiu não responder a esse pedido.');
  const txt = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  if (!schema) return txt;
  try { return JSON.parse(txt); } catch { throw new Error('A resposta veio fora do formato esperado. Tente novamente.'); }
}

/* ---------- contexto do aluno (o que a IA "sabe" sobre você) ---------- */
export function contextoDoAluno({ curto = false } = {}) {
  const s = st();
  const L = [];
  L.push(`Aluno: ${s.perfil.nome} (${s.perfil.serie}).`);
  const r = resumoPeriodo(7);
  L.push(`Últimos 7 dias: ${r.minutos} min de estudo, ${r.questoes} questões, ${r.taxa}% de acerto, sequência de ${s.jogo.streak} dia(s).`);
  L.push('MATÉRIAS E DOMÍNIO POR CONTEÚDO:');
  for (const m of s.materias) {
    const cs = s.conteudos.filter((c) => c.materiaId === m.id);
    if (!cs.length) { L.push(`- ${m.nome}: (sem conteúdos cadastrados)`); continue; }
    L.push(`- ${m.nome} (prof. ${m.professor || '—'}, domínio geral ${dominioMateria(m.id)}%): `
      + cs.map((c) => `${c.nome} ${c.dominio || 0}%`).join('; '));
  }
  const provas = s.provas.filter((p) => p.data >= iso()).slice(0, 6);
  if (provas.length) {
    L.push('PROVAS MARCADAS:');
    for (const p of provas) {
      const pr = preparoProva(p);
      L.push(`- ${p.titulo} (${s.materias.find((m) => m.id === p.materiaId)?.nome || '—'}) em ${p.data} — preparo estimado ${pr.preparo}%.`);
    }
  }
  const tarefas = s.tarefas.filter((t) => t.status !== 'concluido')
    .map((t) => ({ t, p: prioridade(t).nota })).sort((a, b) => b.p - a.p).slice(0, 8);
  if (tarefas.length) {
    L.push('TAREFAS EM ABERTO (prioridade calculada pelo app):');
    for (const { t, p } of tarefas) L.push(`- [${p}/100] ${t.titulo} — ${s.materias.find((m) => m.id === t.materiaId)?.nome || '—'}, prazo ${t.prazo}, ~${t.minutos}min.`);
  }
  if (!curto) {
    const erradas = s.tentativas.filter((x) => !x.acertou).slice(-12);
    if (erradas.length) {
      L.push('ERROS RECENTES (assunto das questões erradas):');
      const nomes = erradas.map((e) => s.conteudos.find((c) => c.id === e.conteudoId)?.nome).filter(Boolean);
      L.push('- ' + [...new Set(nomes)].join(', '));
    }
    if (s.ia.memoria?.length) L.push('OBSERVAÇÕES QUE VOCÊ JÁ ANOTOU SOBRE ESTE ALUNO:\n- ' + s.ia.memoria.join('\n- '));
  }
  const rev = filaRevisao();
  L.push(`Revisões vencidas hoje: ${rev.total}.`);
  return L.join('\n');
}

const REGRAS = `Você é o Study AI, tutor do aplicativo StudyLab, falando com um estudante brasileiro do ensino fundamental/médio.
Regras invioláveis:
- Responda SEMPRE em português do Brasil, com linguagem clara e direta, sem enrolação.
- Use os dados reais do aluno que forem fornecidos. NUNCA invente notas, porcentagens, datas ou desempenho que não estejam no contexto.
- Se faltar informação, diga o que falta em vez de supor.
- Seja específico e acionável: diga o que fazer, por quanto tempo e por quê.
- Não use formatação com asteriscos de markdown; escreva em texto corrido curto, listas com "•" quando ajudar.`;

/* ==========================================================
   CHAT / ME EXPLICA / SOCRÁTICO
   ========================================================== */
export async function chat(historico, pergunta) {
  const ctx = contextoDoAluno();
  const conversa = historico.slice(-10).map((m) => `${m.autor === 'me' ? 'ALUNO' : 'STUDY AI'}: ${m.txt}`).join('\n');
  return chamar({
    system: `${REGRAS}\n\nCONTEXTO DO ALUNO (dados reais do app):\n${ctx}`,
    conteudo: `${conversa ? `Conversa até agora:\n${conversa}\n\n` : ''}ALUNO: ${pergunta}`,
    esforco: 'medium', maxTokens: 3000,
  });
}

export const MODOS_EXPLICACAO = [
  { id: 'normal', rot: '📗 Explique normalmente', instr: 'Explique de forma clara e completa, no nível escolar do aluno.' },
  { id: 'simples', rot: '🧒 Explique de forma simples', instr: 'Explique com palavras muito simples, frases curtas.' },
  { id: 'zero', rot: '🌱 Como se eu nunca tivesse visto', instr: 'Assuma zero conhecimento prévio. Construa a ideia do absoluto zero, passo a passo.' },
  { id: 'exemplos', rot: '🧩 Dê exemplos', instr: 'Explique e use pelo menos 3 exemplos concretos do dia a dia.' },
  { id: 'analogia', rot: '🎭 Faça uma analogia', instr: 'Explique através de uma analogia forte e memorável, e depois amarre com o conteúdo real.' },
  { id: 'perguntando', rot: '❓ Me faça perguntas durante', instr: 'Explique em blocos curtos e, ao final de cada bloco, faça uma pergunta para o aluno responder antes de continuar.' },
];

export async function explicar(tema, modoId, materiaNome = '') {
  const modo = MODOS_EXPLICACAO.find((m) => m.id === modoId) || MODOS_EXPLICACAO[0];
  return chamar({
    system: `${REGRAS}\n\nModo de explicação pedido: ${modo.instr}`,
    conteudo: `Explique o seguinte conteúdo${materiaNome ? ` de ${materiaNome}` : ''}: "${tema}".`,
    esforco: 'medium', maxTokens: 3000,
  });
}

export async function socratico(historico, tema, materiaNome = '') {
  const conversa = historico.map((m) => `${m.autor === 'me' ? 'ALUNO' : 'PROFESSOR'}: ${m.txt}`).join('\n');
  return chamar({
    system: `${REGRAS}
Você é um PROFESSOR SOCRÁTICO. NUNCA entregue a resposta pronta.
Faça UMA pergunta de cada vez, curta, que leve o aluno a raciocinar.
Quando o aluno acertar, confirme em uma frase e faça a próxima pergunta.
Quando errar, não diga apenas "errado": faça uma pergunta mais simples que o aproxime.
Depois de 5 ou 6 trocas, feche amarrando o raciocínio que o próprio aluno construiu.`,
    conteudo: `Tema da conversa${materiaNome ? ` (${materiaNome})` : ''}: ${tema}\n\n${conversa || 'Comece fazendo a primeira pergunta.'}`,
    esforco: 'medium', maxTokens: 1200,
  });
}

/* ==========================================================
   QUESTÕES
   ========================================================== */
const SCHEMA_QUESTOES = {
  type: 'object', additionalProperties: false,
  required: ['questoes'],
  properties: {
    questoes: {
      type: 'array', minItems: 1,
      items: {
        type: 'object', additionalProperties: false,
        required: ['tipo', 'enunciado', 'alternativas', 'correta', 'explicacao'],
        properties: {
          tipo: { type: 'string', enum: ['objetiva', 'vf', 'discursiva', 'associacao', 'interpretacao'] },
          enunciado: { type: 'string' },
          alternativas: { type: 'array', items: { type: 'string' }, description: 'Vazio quando discursiva.' },
          correta: { type: 'integer', description: 'Índice da alternativa correta (0 quando discursiva).' },
          resposta: { type: 'string', description: 'Resposta esperada quando discursiva.' },
          explicacao: { type: 'string' },
        },
      },
    },
  },
};

export const TIPOS_QUESTAO = [
  { id: 'objetiva', rot: '🔘 Objetivas' }, { id: 'discursiva', rot: '✍️ Discursivas' },
  { id: 'mistas', rot: '🔀 Misturadas' }, { id: 'vf', rot: '🧠 Verdadeiro ou falso' },
  { id: 'associacao', rot: '🔗 Associação' }, { id: 'interpretacao', rot: '📖 Interpretação' },
];
export const NIVEIS_QUESTAO = [
  { id: 'facil', rot: '🟢 Fácil' }, { id: 'medio', rot: '🟡 Médio' }, { id: 'dificil', rot: '🟠 Difícil' },
  { id: 'muito_dificil', rot: '🔴 Muito difícil' }, { id: 'insano', rot: '⚫ Insano' },
];

export async function gerarQuestoes({ materiaNome, conteudoNome, quantidade = 5, tipo = 'objetiva', nivel = 'medio', material = '' }) {
  const desc = {
    facil: 'direta, cobra definição ou reconhecimento',
    medio: 'exige entender e aplicar o conceito',
    dificil: 'exige relacionar dois ou mais conceitos',
    muito_dificil: 'exige análise, comparação e conclusão própria',
    insano: 'nível olimpíada/vestibular difícil, com pegadinhas legítimas e raciocínio longo',
  }[nivel];
  const r = await chamar({
    system: `${REGRAS}
Você cria questões escolares em português do Brasil.
Nível pedido: ${nivel} (${desc}).
Para "objetiva" gere 4 alternativas plausíveis e apenas 1 correta; distratores devem refletir erros comuns.
Para "vf" use exatamente as alternativas ["Verdadeiro","Falso"].
Para "discursiva" deixe alternativas vazio e preencha "resposta" com a resposta esperada.
Sempre preencha "explicacao" ensinando o porquê — é o que o aluno vai ler depois de errar.`,
    conteudo: `Matéria: ${materiaNome}\nConteúdo: ${conteudoNome}\nQuantidade: ${quantidade}\nTipo: ${tipo === 'mistas' ? 'misture objetivas, verdadeiro/falso e discursivas' : tipo}
${material ? `\nBaseie-se NESTE material do aluno:\n"""\n${material.slice(0, 12000)}\n"""` : ''}`,
    schema: SCHEMA_QUESTOES, maxTokens: 8000, esforco: nivel === 'insano' ? 'high' : 'medium',
  });
  return r.questoes || [];
}

/** Fallback offline: monta questões a partir dos flashcards existentes. */
export function questoesLocais({ materiaId = null, conteudoId = null, quantidade = 5 }) {
  const s = st();
  let cards = s.flashcards.filter((f) => (!materiaId || f.materiaId === materiaId) && (!conteudoId || f.conteudoId === conteudoId));
  if (cards.length < 2) cards = s.flashcards.filter((f) => !materiaId || f.materiaId === materiaId);
  if (cards.length < 2) return [];
  const out = [];
  const emb = [...cards].sort(() => Math.random() - 0.5);
  for (const c of emb.slice(0, quantidade)) {
    const erradas = emb.filter((x) => x.id !== c.id).slice(0, 3).map((x) => resumoCurto(x.verso));
    if (erradas.length < 2) continue;
    const alts = [resumoCurto(c.verso), ...erradas].sort(() => Math.random() - 0.5);
    out.push({
      tipo: 'objetiva', enunciado: c.frente, alternativas: alts,
      correta: alts.indexOf(resumoCurto(c.verso)),
      explicacao: c.verso, origem: 'local',
    });
  }
  return out;
}
const resumoCurto = (t) => { const f = frases(t)[0] || String(t); return f.length > 140 ? f.slice(0, 137) + '…' : f; };

/* ==========================================================
   FLASHCARDS
   ========================================================== */
const SCHEMA_CARDS = {
  type: 'object', additionalProperties: false, required: ['cards'],
  properties: {
    cards: {
      type: 'array', minItems: 1,
      items: { type: 'object', additionalProperties: false, required: ['frente', 'verso'],
        properties: { frente: { type: 'string' }, verso: { type: 'string' } } },
    },
  },
};
export async function gerarFlashcards({ texto, quantidade = 8, materiaNome = '', conteudoNome = '' }) {
  const r = await chamar({
    system: `${REGRAS}
Você cria flashcards de estudo. Cada card tem uma FRENTE (pergunta curta e específica, nunca "o que é isso?")
e um VERSO (resposta completa mas enxuta, no máximo 3 linhas).
Não crie cards sobre curiosidades irrelevantes: foque no que cai em prova.`,
    conteudo: `Matéria: ${materiaNome || '—'} | Conteúdo: ${conteudoNome || '—'} | Quantidade: ${quantidade}
Material base:\n"""\n${String(texto).slice(0, 14000)}\n"""`,
    schema: SCHEMA_CARDS, maxTokens: 6000, esforco: 'low',
  });
  return r.cards || [];
}
/** Fallback offline: transforma linhas "termo: definição" em cards. */
export function flashcardsLocais(texto, quantidade = 8) {
  const linhas = String(texto).split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const out = [];
  for (const l of linhas) {
    const m = l.match(/^(.{3,80}?)\s*[:—–-]\s*(.{10,})$/);
    if (m) out.push({ frente: m[1].replace(/^[-•*]\s*/, ''), verso: m[2] });
    if (out.length >= quantidade) break;
  }
  if (out.length < 2) {
    for (const f of frases(texto).slice(0, quantidade)) {
      const ps = palavras(f).filter((w) => !STOP.has(w));
      const chave = ps.sort((a, b) => b.length - a.length)[0];
      if (chave) out.push({ frente: f.replace(new RegExp(chave, 'i'), '_______'), verso: chave });
    }
  }
  return out;
}

/* ==========================================================
   RESUMOS
   ========================================================== */
export const TIPOS_RESUMO = [
  { id: 'rapido', rot: '⚡ Ultra rápido', instr: 'No máximo 5 linhas, só o essencial.' },
  { id: 'completo', rot: '📚 Completo', instr: 'Resumo completo, organizado em seções com subtítulos.' },
  { id: 'prova', rot: '🎯 Para prova', instr: 'Foque no que costuma cair em prova: definições, datas, fórmulas, causas e consequências. Termine com "pegadinhas comuns".' },
  { id: 'explicado', rot: '🧠 Explicado', instr: 'Explique o conteúdo enquanto resume, como um professor faria.' },
  { id: 'topicos', rot: '📝 Em tópicos', instr: 'Só tópicos e subtópicos curtos, sem parágrafos.' },
  { id: 'mapa', rot: '🗺️ Mapa mental', instr: 'Devolva uma estrutura hierárquica em texto, usando indentação com "-", pronta para virar mapa mental.' },
];
export async function resumir(texto, tipoId = 'completo', materiaNome = '') {
  const t = TIPOS_RESUMO.find((x) => x.id === tipoId) || TIPOS_RESUMO[1];
  return chamar({
    system: `${REGRAS}\nVocê resume material escolar. Formato pedido: ${t.instr}\nNão acrescente informação que não esteja no material.`,
    conteudo: `${materiaNome ? `Matéria: ${materiaNome}\n` : ''}Material:\n"""\n${String(texto).slice(0, 20000)}\n"""`,
    esforco: 'low', maxTokens: 4000,
  });
}
/** Fallback offline: resumo extrativo (escolhe as frases mais representativas). */
export function resumoLocal(texto, linhas = 6) {
  const fs = frases(texto);
  if (fs.length <= linhas) return texto.trim();
  const freq = new Map();
  for (const w of palavras(texto)) if (!STOP.has(w)) freq.set(w, (freq.get(w) || 0) + 1);
  const pontuadas = fs.map((f, i) => {
    const ws = palavras(f).filter((w) => !STOP.has(w));
    const base = ws.length ? sum(ws.map((w) => freq.get(w) || 0)) / Math.sqrt(ws.length) : 0;
    return { f, i, p: base * (i < 2 ? 1.25 : 1) };  // valoriza o começo do texto
  });
  return pontuadas.sort((a, b) => b.p - a.p).slice(0, linhas).sort((a, b) => a.i - b.i)
    .map((x) => '• ' + x.f).join('\n');
}

/* ==========================================================
   MAPA MENTAL
   ========================================================== */
const SCHEMA_MAPA = {
  type: 'object', additionalProperties: false, required: ['centro', 'ramos'],
  properties: {
    centro: { type: 'string' },
    ramos: {
      type: 'array', items: {
        type: 'object', additionalProperties: false, required: ['titulo', 'itens'],
        properties: { titulo: { type: 'string' }, itens: { type: 'array', items: { type: 'string' } } },
      },
    },
  },
};
export async function mapaMental(texto, tema = '') {
  return chamar({
    system: `${REGRAS}\nVocê transforma conteúdo escolar em mapa mental: um centro, 4 a 7 ramos, cada ramo com 2 a 6 itens curtos.`,
    conteudo: `${tema ? `Tema: ${tema}\n` : ''}Conteúdo:\n"""\n${String(texto).slice(0, 14000)}\n"""`,
    schema: SCHEMA_MAPA, maxTokens: 3000, esforco: 'low',
  });
}
export function mapaLocal(texto, tema = 'Tema') {
  const fs = frases(texto);
  const ramos = [];
  for (let i = 0; i < fs.length && ramos.length < 6; i += 3) {
    const bloco = fs.slice(i, i + 3);
    const chave = palavras(bloco[0]).filter((w) => !STOP.has(w)).sort((a, b) => b.length - a.length)[0] || `Parte ${ramos.length + 1}`;
    ramos.push({ titulo: chave[0].toUpperCase() + chave.slice(1), itens: bloco.map((f) => (f.length > 90 ? f.slice(0, 87) + '…' : f)) });
  }
  return { centro: tema, ramos };
}

/* ==========================================================
   DIVISÃO DE TAREFA COM IA
   ========================================================== */
const SCHEMA_SUB = {
  type: 'object', additionalProperties: false, required: ['passos'],
  properties: {
    passos: {
      type: 'array', minItems: 3, items: {
        type: 'object', additionalProperties: false, required: ['titulo', 'minutos'],
        properties: { titulo: { type: 'string' }, minutos: { type: 'integer' } },
      },
    },
  },
};
export async function dividirComIA(titulo, minutos, materiaNome = '') {
  const r = await chamar({
    system: `${REGRAS}\nVocê quebra um trabalho escolar grande em passos pequenos e concretos (5 a 8 passos), cada um com uma estimativa em minutos. A soma deve ficar perto do tempo total informado.`,
    conteudo: `Tarefa: "${titulo}"${materiaNome ? ` (${materiaNome})` : ''}\nTempo total estimado: ${minutos} minutos.`,
    schema: SCHEMA_SUB, maxTokens: 1500, esforco: 'low',
  });
  return (r.passos || []).map((p) => ({ id: uid('sub'), titulo: p.titulo, minutos: p.minutos, feito: false }));
}

/* ==========================================================
   ARQUIVOS: foto de atividade e PDF
   ========================================================== */
export async function lerArquivo({ base64, mime, pergunta, nomeArquivo = '' }) {
  const bloco = mime === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
    : { type: 'image', source: { type: 'base64', media_type: mime, data: base64 } };
  return chamar({
    system: `${REGRAS}\nVocê está lendo um material enviado pelo aluno (${nomeArquivo || 'arquivo'}). Baseie-se apenas no que está no arquivo.`,
    conteudo: [bloco, { type: 'text', text: pergunta }],
    maxTokens: 8000, esforco: 'medium',
  });
}

/* ==========================================================
   ANÁLISE DE SIMULADO + MEMÓRIA DO ASSISTENTE
   ========================================================== */
export async function analisarSimulado(resultado) {
  return chamar({
    system: `${REGRAS}\nVocê analisa o resultado de um simulado e devolve, em no máximo 8 linhas: o que foi bem, o que precisa de atenção e um plano objetivo para os próximos dias.`,
    conteudo: `Resultado do simulado:\n${JSON.stringify(resultado, null, 1)}\n\nContexto:\n${contextoDoAluno({ curto: true })}`,
    esforco: 'low', maxTokens: 1200,
  });
}

/** Observações locais (sem IA) sobre o padrão de estudo — alimenta a "memória". */
export function observacoesLocais() {
  const s = st(); const out = [];
  const t = s.tentativas;
  if (t.length >= 20) {
    const porHora = {};
    for (const x of t) { const h = new Date(x.em).getHours(); (porHora[h] ||= { n: 0, ok: 0 }); porHora[h].n++; if (x.acertou) porHora[h].ok++; }
    const bons = Object.entries(porHora).filter(([, v]) => v.n >= 8).map(([h, v]) => ({ h: +h, taxa: v.ok / v.n }));
    if (bons.length >= 2) {
      const melhor = bons.sort((a, b) => b.taxa - a.taxa)[0];
      out.push(`Seu melhor desempenho acontece por volta das ${melhor.h}h (${Math.round(melhor.taxa * 100)}% de acerto).`);
    }
  }
  const porConteudo = {};
  for (const x of t) { if (!x.conteudoId) continue; (porConteudo[x.conteudoId] ||= { n: 0, ok: 0 }); porConteudo[x.conteudoId].n++; if (x.acertou) porConteudo[x.conteudoId].ok++; }
  const piores = Object.entries(porConteudo).filter(([, v]) => v.n >= 5).map(([id, v]) => ({ id, taxa: v.ok / v.n }))
    .sort((a, b) => a.taxa - b.taxa).slice(0, 2);
  for (const p of piores) {
    const c = s.conteudos.find((x) => x.id === p.id);
    if (c && p.taxa < 0.6) out.push(`Você erra bastante em "${c.nome}" (${Math.round(p.taxa * 100)}% de acerto).`);
  }
  const dias = {};
  for (const ses of s.sessoes) { const d = new Date(ses.em).getDay(); dias[d] = (dias[d] || 0) + ses.minutos; }
  const top = Object.entries(dias).sort((a, b) => b[1] - a[1])[0];
  if (top && s.sessoes.length > 8) out.push(`Seu dia mais produtivo costuma ser ${['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][top[0]]}.`);
  return out;
}
