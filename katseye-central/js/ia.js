/* ===== ia.js — o Conselheiro Estratégico =====

   Três modos, e o app SEMPRE diz em qual está:

   1. 'chave'    — a chave da Anthropic fica só neste aparelho e o navegador
                   fala direto com a API. Prático para uso pessoal; a chave
                   nunca sai do localStorage deste navegador.
   2. 'servidor' — o app manda a pergunta para um endereço seu (um proxy que
                   guarda a chave). É o caminho certo para publicar.
   3. 'local'    — o padrão. NÃO é IA e o app não finge que é: um motor
                   determinístico que aplica frameworks de estratégia sobre os
                   seus próprios dados (agenda, tarefas, projetos). Funciona
                   offline e nunca inventa número que você não tenha digitado.

   Regra de ouro deste arquivo: nada aqui pode alegar ser um modelo quando não
   é. `motivoIA()` devolve o texto que a tela mostra.                        */

import { st, set, integrantes, lancamentos } from './store.js';
import {
  metricas, ordemDoDia, proximosEventos, resumoDaSemana, resumoDoDia,
  corPrioridade, saudeDoPlano, aniversarios,
} from './engine.js';
import { GRUPO } from './dados.js';
import { fmtData, iso, hoje, cortar } from './util.js';

const ENDPOINT_ANTHROPIC = 'https://api.anthropic.com/v1/messages';
const LIMITE_DIA = 60;

/* ==========================================================
   ESTADO DA CONEXÃO
   ========================================================== */
export function modoIA() {
  const ia = st().ia;
  if (ia.modo === 'servidor' && ia.servidor.trim()) return 'servidor';
  if (ia.modo === 'chave' && ia.chave.trim()) return 'chave';
  return 'local';
}
export const temIA = () => modoIA() !== 'local';

export function motivoIA() {
  const m = modoIA();
  if (m === 'servidor') return { ok: true, txt: 'Conectado ao seu servidor.' };
  if (m === 'chave') return { ok: true, txt: 'Usando a chave guardada neste aparelho.' };
  return {
    ok: false,
    txt: 'Modo local: as respostas são montadas pelo motor do próprio app a partir dos seus dados — '
      + 'não é um modelo de IA. Para conversar com a Claude, configure em Configurações → Conselheiro.',
  };
}

function contarUso() {
  const dia = iso(hoje());
  set((s) => {
    if (s.ia.usoDia !== dia) { s.ia.usoDia = dia; s.ia.usoHoje = 0; }
    s.ia.usoHoje += 1;
  });
}
export function usoHoje() {
  const ia = st().ia;
  return ia.usoDia === iso(hoje()) ? ia.usoHoje : 0;
}

/* ==========================================================
   CONTEXTO — o que o conselheiro sabe
   ========================================================== */
/**
 * Monta o texto que vai junto com a pergunta. A tela tem um botão
 * "o que ele sabe" que mostra exatamente esta string — sem surpresa.
 */
export function contexto({ curto = false } = {}) {
  const s = st();
  const m = metricas();
  const saude = saudeDoPlano();
  const linhas = [];

  linhas.push(`# Quem está perguntando`);
  linhas.push(`${s.perfil.nome || 'Usuário sem nome definido'} — ${s.perfil.papel || 'sem papel definido'}.`);
  linhas.push(`Hoje é ${fmtData(iso(hoje()), { relativo: false })}.`);

  linhas.push(`\n# O projeto`);
  linhas.push(`${GRUPO.nome} — ${GRUPO.gravadoras}. Estreia em ${fmtData(GRUPO.estreia, { relativo: false })}.`);
  linhas.push(`Integrantes: ${integrantes().map((i) => i.nome).join(', ')}.`);

  linhas.push(`\n# Situação do planejamento`);
  linhas.push(`Índice de controle: ${saude.nota}/100 (${saude.rot}).`);
  linhas.push(`${m.abertas} tarefas abertas · ${m.atrasadas} atrasadas · ${m.paraHoje} vencendo hoje · `
    + `${m.feitas7} concluídas nos últimos 7 dias · ${m.eventosSemana} compromissos nos próximos 7 dias.`);

  const top = ordemDoDia(curto ? 3 : 8);
  if (top.length) {
    linhas.push(`\n# Tarefas em aberto (ordem de prioridade)`);
    for (const t of top) {
      linhas.push(`- ${t.titulo} — prazo ${fmtData(t.prazo)} — prioridade ${corPrioridade(t.nota).rot}`
        + `${t.integranteId ? ` — envolve ${integrantes().find((i) => i.id === t.integranteId)?.nome || ''}` : ''}`);
    }
  }

  const evs = proximosEventos(curto ? 3 : 8, 60);
  if (evs.length) {
    linhas.push(`\n# Próximos compromissos`);
    for (const e of evs) {
      linhas.push(`- ${e.titulo} — ${fmtData(e.dataEfetiva)}${e.hora ? ` às ${e.hora}` : ''}${e.local ? ` — ${e.local}` : ''}`);
    }
  }

  if (!curto) {
    const rel = lancamentos().slice(0, 6);
    if (rel.length) {
      linhas.push(`\n# Discografia registrada no app`);
      for (const r of rel) linhas.push(`- ${r.titulo} (${r.tipo}, ${fmtData(r.data, { relativo: false })})`);
    }
    if (s.projetos.length) {
      linhas.push(`\n# Peças no Estúdio Criativo`);
      for (const p of s.projetos.slice(0, 6)) linhas.push(`- ${p.nome} (${p.formato})`);
    }
    const an = aniversarios(45);
    if (an.length) {
      linhas.push(`\n# Datas chegando`);
      for (const a of an.slice(0, 5)) linhas.push(`- ${a.texto}`);
    }
  }

  linhas.push(`\n# Observação importante`);
  linhas.push('Os dados do grupo neste app são uma semente editável, não uma base oficial. '
    + 'Não invente números de vendas, streams, posições de parada ou datas que não estejam acima.');

  return linhas.join('\n');
}

const SISTEMA = `Você é o Conselheiro Estratégico do KATSEYE Central — um app de gestão criativa
dedicado ao grupo KATSEYE (HYBE x Geffen).

Seu papel: sócio de negócios e parceiro criativo. Você analisa com franqueza, aponta o que
está fraco, propõe caminhos concretos e ajuda a destravar bloqueio criativo.

Regras:
- Responda em português do Brasil, direto, sem enrolação e sem bajulação.
- Use os dados reais do contexto. Se um dado não estiver lá, diga que não sabe — nunca invente
  números de streams, vendas, paradas, datas de lançamento ou fatos sobre as integrantes.
- Prefira resposta curta com passo concreto a texto longo e genérico.
- Quando fizer sentido, estruture com títulos curtos (##) e listas (-).
- Quando a pessoa pedir ideias, dê poucas e boas, cada uma com o porquê.`;

/* ==========================================================
   CHAMADA
   ========================================================== */
async function viaChave(mensagens) {
  const ia = st().ia;
  const r = await fetch(ENDPOINT_ANTHROPIC, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ia.chave.trim(),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: ia.modelo || 'claude-opus-5',
      max_tokens: 1400,
      system: SISTEMA,
      messages: mensagens,
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || `A API respondeu ${r.status}.`);
  return (d.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
}

async function viaServidor(mensagens) {
  const base = st().ia.servidor.trim().replace(/\/$/, '');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 120000);
  try {
    const r = await fetch(`${base}/conselho`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sistema: SISTEMA, mensagens, modelo: st().ia.modelo }),
      signal: ctrl.signal,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.erro || `O servidor respondeu ${r.status}.`);
    return String(d.texto || d.resposta || '').trim();
  } finally { clearTimeout(t); }
}

/**
 * Pergunta ao conselheiro. Devolve { texto, modo, local }.
 * `local: true` significa que a resposta veio do motor do app, não de IA —
 * a tela usa isso para etiquetar a mensagem com honestidade.
 */
export async function perguntar(historico, pergunta) {
  const modo = modoIA();
  if (modo === 'local') {
    return { texto: respostaLocal(pergunta), modo, local: true };
  }
  if (usoHoje() >= LIMITE_DIA) {
    return {
      texto: `Você já fez ${LIMITE_DIA} perguntas hoje — o app segura aqui para não estourar custo sem você ver. `
        + 'Amanhã o contador zera, e o limite fica em Configurações.',
      modo, local: true,
    };
  }

  const mensagens = [
    { role: 'user', content: `Contexto atual do app:\n\n${contexto()}` },
    { role: 'assistant', content: 'Contexto recebido. Pode perguntar.' },
    ...historico.slice(-10).map((m) => ({ role: m.de === 'me' ? 'user' : 'assistant', content: m.txt })),
    { role: 'user', content: pergunta },
  ];

  try {
    const texto = modo === 'chave' ? await viaChave(mensagens) : await viaServidor(mensagens);
    contarUso();
    if (!texto) throw new Error('A resposta veio vazia.');
    return { texto, modo, local: false };
  } catch (e) {
    const detalhe = e.name === 'AbortError' ? 'A resposta demorou demais.' : String(e.message || e);
    return {
      texto: `⚠️ **Não consegui falar com a IA.** ${detalhe}\n\n`
        + 'Respondendo pelo motor local enquanto isso:\n\n---\n\n'
        + respostaLocal(pergunta),
      modo, local: true, erro: detalhe,
    };
  }
}

/* ==========================================================
   MOTOR LOCAL — determinístico, sem rede
   ========================================================== */
const ROTEIROS = [
  {
    id: 'semana',
    quando: /(semana|agenda|plano|planejamento|cronograma|o que fazer|por onde come)/i,
    responde: () => [
      '## Leitura da sua semana', '', resumoDaSemana(), '', '## O que eu faria',
      ...recomendacoes().map((r) => `- ${r}`),
    ].join('\n'),
  },
  {
    id: 'hoje',
    quando: /(hoje|agora|prioridade|urgente|atrasad)/i,
    responde: () => [
      '## Hoje', '', resumoDoDia(), '', '## Regra prática',
      '- Comece pelo que está atrasado: atraso custa mais caro que tarefa nova.',
      '- Se der para fechar em menos de 10 minutos, feche agora em vez de agendar.',
    ].join('\n'),
  },
  {
    id: 'ideias',
    quando: /(ideia|campanha|conte[úu]do|post|criativ|brainstorm|lan[çc]amento|divulga)/i,
    responde: (p) => ideiasDeCampanha(p),
  },
  {
    id: 'evento',
    quando: /(evento|show|fanmeeting|encontro|festa|listening|organizar)/i,
    responde: () => planoDeEvento(),
  },
  {
    id: 'bloqueio',
    quando: /(bloquei|travad|sem ideia|n[ãa]o sei|parad|desanim|criativ.*trava)/i,
    responde: () => destravar(),
  },
  {
    id: 'analise',
    quando: /(an[áa]lise|analis|swot|diagn[óo]stico|como estou|avali)/i,
    responde: () => analiseSWOT(),
  },
];

function recomendacoes() {
  const m = metricas();
  const out = [];
  if (m.atrasadas) out.push(`Zerar as ${m.atrasadas} tarefas atrasadas antes de abrir frente nova.`);
  if (!m.eventosSemana) out.push('A semana está sem compromisso marcado — bom espaço para produção pesada (gravar, editar, escrever).');
  if (m.abertas > 15) out.push(`${m.abertas} tarefas abertas é mais do que cabe numa semana: escolha 5 e adie o resto com data.`);
  if (m.feitas7 === 0) out.push('Nenhuma tarefa concluída em 7 dias. Comece por uma pequena hoje só para destravar o ritmo.');
  if (m.sequencia >= 3) out.push(`Sequência de ${m.sequencia} dias entregando: mantenha o mesmo horário amanhã, é o que sustenta.`);
  if (!out.length) out.push('O planejamento está em ordem. Use a folga para adiantar a próxima data marcada.');
  return out;
}

function ideiasDeCampanha(pergunta = '') {
  const s = st();
  const membros = integrantes();
  const rel = lancamentos()[0];
  const tema = cortar(String(pergunta).replace(/.*(ideia[s]? (de|para|sobre)?|campanha (de|para)?)/i, '').trim(), 60);
  const proximo = proximosEventos(1)[0];

  const ideias = [
    {
      t: 'Seis ângulos, seis vozes',
      p: `Uma peça por integrante (${membros.map((m) => m.nome).join(', ')}), cada uma contando o mesmo fato pelo ângulo dela. `
        + 'Funciona porque multiplica o alcance sem multiplicar a produção: é um roteiro, seis recortes.',
    },
    {
      t: 'Contagem regressiva com objeto',
      p: proximo
        ? `Faltam poucos dias para "${proximo.titulo}". Escolha UM objeto que represente a data e publique-o mudando a cada dia.`
        : 'Escolha a próxima data importante e crie uma contagem regressiva com um único objeto que muda a cada dia.',
    },
    {
      t: 'O ingresso que não existe',
      p: 'Use o Estúdio Criativo para gerar um ingresso colecionável do evento (real ou imaginário) com o nome de quem interage. '
        + 'Material personalizado é o que mais circula em fandom.',
    },
    {
      t: 'Antes e depois',
      p: rel
        ? `Compare o momento de "${rel.titulo}" com hoje. Linha do tempo curta, sem narração — deixa o público completar.`
        : 'Monte uma linha do tempo curta do projeto e deixe o público completar a narração.',
    },
    {
      t: 'A pergunta que ninguém faz',
      p: 'Publique uma pergunta específica demais para ser genérica ("qual segundo exato da música te pegou?"). '
        + 'Pergunta estreita gera resposta longa; pergunta larga gera emoji.',
    },
  ];

  return [
    tema ? `## Ideias para: ${tema}` : '## Cinco ideias de campanha',
    '',
    ...ideias.map((i, n) => `**${n + 1}. ${i.t}**\n${i.p}\n`),
    '## Como escolher',
    '- Elimine as que você não conseguiria produzir esta semana. Ideia boa que não sai não vale nada.',
    '- Das que sobrarem, fique com a que o público consegue **refazer** — isso é o que vira volume.',
    '',
    `_Modo local: essas ideias saem de um repertório fixo do app cruzado com os seus dados (${s.projetos.length} peças no estúdio, ${s.eventos.length} compromissos). Não é IA generativa._`,
  ].join('\n');
}

function planoDeEvento() {
  return [
    '## Plano de evento em 3 blocos',
    '',
    '### 1. 30 dias antes — definir e travar',
    '- Data, local e capacidade. Sem isso, nada mais avança.',
    '- Orçamento com teto: quanto você perde se ninguém aparecer?',
    '- Uma frase que explica o evento para quem nunca ouviu falar do grupo.',
    '',
    '### 2. 14 dias antes — encher',
    '- Cartaz e ingresso colecionável prontos (o Estúdio gera os dois).',
    '- Confirmação nominal, não "curtiu o post": lista com nome.',
    '- Um motivo para ir que só existe ali (algo que não se vê online).',
    '',
    '### 3. Semana do evento — executar',
    '- Roteiro minuto a minuto, com quem é responsável por cada bloco.',
    '- Plano B para som, chuva e atraso — os três que mais quebram evento.',
    '- Alguém registrando: o evento acaba, o conteúdo dele fica.',
    '',
    '**Erro mais comum:** caprichar na divulgação e esquecer a operação do dia. '
    + 'Se o evento for bom e a fila for ruim, o que sobra é a fila.',
  ].join('\n');
}

function destravar() {
  const m = metricas();
  return [
    '## Destravar agora (10 minutos)',
    '',
    '**1. Diminua o problema.** Você não precisa da campanha inteira — precisa da primeira frase. '
    + 'Escreva só o título. Só isso.',
    '',
    '**2. Roube a estrutura.** Pegue algo que já funcionou e troque o conteúdo, mantendo o formato. '
    + 'Originalidade quase sempre nasce de repetição com desvio.',
    '',
    '**3. Piore de propósito.** Escreva a pior versão possível, sem julgar. '
    + 'É muito mais fácil consertar algo ruim do que criar algo bom do zero.',
    '',
    '**4. Mude o canal.** Se travou escrevendo, fale em voz alta e transcreva. O bloqueio costuma ser do meio, não da ideia.',
    '',
    m.abertas
      ? `**Atalho no seu caso:** você tem ${m.abertas} tarefas abertas. Bloqueio criativo com lista cheia costuma ser `
        + 'ansiedade de lista, não falta de ideia. Feche a menor delas primeiro.'
      : '**No seu caso:** a lista está limpa. O bloqueio aqui é de direção, não de carga — escolha uma data-alvo e trabalhe para trás.',
  ].join('\n');
}

function analiseSWOT() {
  const m = metricas();
  const s = st();
  const saude = saudeDoPlano();
  return [
    '## Diagnóstico do seu uso do app',
    '',
    `**Índice de controle:** ${saude.nota}/100 — ${saude.rot}.`,
    '',
    '### Forças',
    ...[
      m.feitas7 > 0 ? `- ${m.feitas7} entregas nos últimos 7 dias — há ritmo.` : null,
      s.projetos.length ? `- ${s.projetos.length} peça(s) criadas no Estúdio: a produção visual está andando.` : null,
      m.eventosSemana ? `- Agenda povoada (${m.eventosSemana} compromissos na semana).` : null,
    ].filter(Boolean),
    (m.feitas7 || s.projetos.length || m.eventosSemana) ? '' : '- Ainda não há histórico suficiente para apontar força.',
    '',
    '### Fraquezas',
    ...[
      m.atrasadas ? `- ${m.atrasadas} tarefa(s) atrasada(s).` : null,
      m.abertas > 15 ? `- Lista inflada (${m.abertas} abertas): o excesso vira ruído.` : null,
      !m.eventosSemana ? '- Semana sem compromisso: falta âncora de data.' : null,
      !s.projetos.length ? '- Nenhuma peça criada ainda no Estúdio.' : null,
    ].filter(Boolean),
    '',
    '### O movimento que muda mais',
    m.atrasadas
      ? '- Zerar o atraso. Enquanto ele existe, todo planejamento novo nasce devendo.'
      : '- Marcar a próxima data pública. Data marcada é o que organiza o resto sozinho.',
    '',
    '_Este diagnóstico é calculado pelo app com os seus números — não é opinião de um modelo de IA._',
  ].join('\n');
}

/** Resposta do motor local: acha o roteiro que combina, ou devolve o guia. */
export function respostaLocal(pergunta) {
  const p = String(pergunta || '');
  for (const r of ROTEIROS) if (r.quando.test(p)) return r.responde(p);
  return [
    '## Estou no modo local',
    '',
    'Não sou um modelo de IA agora — sou o motor do próprio app, e por isso respondo bem a temas '
    + 'que consigo calcular com os seus dados. Tente uma destas:',
    '',
    '- **"como está minha semana?"** — leitura da agenda e das tarefas',
    '- **"o que faço hoje?"** — ordem de prioridade calculada',
    '- **"me dá ideias de campanha"** — repertório cruzado com seus dados',
    '- **"monta um plano de evento"** — roteiro de 30/14/7 dias',
    '- **"estou travado"** — protocolo de desbloqueio',
    '- **"faz um diagnóstico"** — forças, fraquezas e o próximo movimento',
    '',
    'Para conversar de verdade com a Claude sobre qualquer assunto, ligue a IA em '
    + '**Configurações → Conselheiro**.',
  ].join('\n');
}

/* ==========================================================
   ATALHOS DA TELA
   ========================================================== */
export const PRESETS = [
  { id: 'semana', emoji: '📋', t: 'Analisar minha semana', p: 'Analise minha semana: o que está bem, o que está mal e o que eu deveria fazer primeiro.' },
  { id: 'hoje', emoji: '⏱️', t: 'O que faço hoje?', p: 'O que eu faço hoje? Me dê a ordem, com o motivo de cada posição.' },
  { id: 'ideias', emoji: '💡', t: 'Ideias de campanha', p: 'Me dê ideias de campanha de conteúdo para o próximo lançamento.' },
  { id: 'evento', emoji: '🎪', t: 'Planejar um evento', p: 'Monta um plano para eu organizar um evento de fãs.' },
  { id: 'bloqueio', emoji: '🧱', t: 'Estou travado', p: 'Estou travado criativamente. Me ajuda a destravar agora.' },
  { id: 'analise', emoji: '🔍', t: 'Diagnóstico', p: 'Faz um diagnóstico do meu planejamento: forças, fraquezas e o próximo movimento.' },
];

/* ==========================================================
   VOZ — ler a resposta em voz alta (opcional, tudo no navegador)
   ========================================================== */
export const temVoz = () => typeof speechSynthesis !== 'undefined';

/** Lê o texto em voz alta. Devolve false quando o navegador não tem voz. */
export function falar(texto) {
  if (!temVoz()) return false;
  pararDeFalar();
  const limpo = String(texto || '')
    .replace(/[#*_`>]/g, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .slice(0, 4000);
  const f = new SpeechSynthesisUtterance(limpo);
  f.lang = 'pt-BR';
  f.rate = 1.02;
  const voz = speechSynthesis.getVoices().find((v) => v.lang?.startsWith('pt'));
  if (voz) f.voice = voz;
  speechSynthesis.speak(f);
  return true;
}
export function pararDeFalar() {
  if (temVoz()) { try { speechSynthesis.cancel(); } catch { /* ignora */ } }
}
export const estaFalando = () => (temVoz() ? speechSynthesis.speaking : false);
