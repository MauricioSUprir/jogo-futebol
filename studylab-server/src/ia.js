/* ===== ia.js — a única parte que conhece as chaves de IA =====
   Dois provedores:
   - Claude (ANTHROPIC_API_KEY) — pago por uso; é o recomendado quando há assinantes.
   - Gemini (GEMINI_API_KEY) — tem faixa GRÁTIS em aistudio.google.com; perfeito
     para testar o MindTrack AI sem gastar nada. O limite do plano grátis é do app
     inteiro (não por aluno), então para escala use o Claude.
   Com as duas chaves, o Claude vence; PROVEDOR=gemini força o Gemini.          */
// URL_ANTHROPIC / URL_GEMINI existem para os testes apontarem para APIs dubladas.
import crypto from 'node:crypto';

const URL_API = process.env.URL_ANTHROPIC || 'https://api.anthropic.com/v1/messages';
const URL_GEMINI = () => process.env.URL_GEMINI || 'https://generativelanguage.googleapis.com';
const VERSAO = '2023-06-01';

const ESFORCOS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);
const MODELOS_OK = new Set(['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5']);
const TETO_TOKENS = 8000;
const TETO_TEXTO = 60000;      // caracteres de system + texto (fotos não contam aqui)
const TETO_FOTO = 2500000;     // ~1,8 MB por foto depois do base64
const MIMES_OK = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']);

/* O modelo padrão é o Haiku: é o que faz a conta dos planos fechar com lucro
   (~R$0,03 por pergunta). Suba para sonnet/opus pelas variáveis MODELO (todos)
   ou MODELO_PLUS (só assinantes Plus) quando a margem permitir. */
export function modeloPadrao() {
  const m = process.env.MODELO || 'claude-haiku-4-5';
  return MODELOS_OK.has(m) ? m : 'claude-haiku-4-5';
}
export function modeloPara(nivel) {
  const plus = process.env.MODELO_PLUS || '';
  if (nivel === 'plus' && MODELOS_OK.has(plus)) return plus;
  return modeloPadrao();
}

/* ---------- qual provedor está ligado ---------- */
export function provedor() {
  const forcado = (process.env.PROVEDOR || '').toLowerCase();
  if (forcado === 'gemini' && process.env.GEMINI_API_KEY) return 'gemini';
  if ((forcado === 'claude' || forcado === 'anthropic') && process.env.ANTHROPIC_API_KEY) return 'claude';
  if (process.env.ANTHROPIC_API_KEY) return 'claude';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  return null;
}
export const temChaveIA = () => !!provedor();
export const modeloGemini = () => escadaGemini('normal')[0];
/** O que aparece em /saude e nos logs. */
export const modeloEmUso = () => (provedor() === 'gemini' ? modeloGemini() : modeloPadrao());

/** Quantas fotos (ou PDFs) vêm dentro do pedido. */
export const contarFotos = (conteudo) => (Array.isArray(conteudo)
  ? conteudo.filter((b) => b?.type === 'image' || b?.type === 'document').length
  : 0);

/** Só o texto conta para o teto de tamanho — a foto tem teto próprio. */
function medirTexto(conteudo) {
  if (!Array.isArray(conteudo)) return JSON.stringify(conteudo || '').length;
  let n = 0;
  for (const b of conteudo) if (b?.type === 'text') n += String(b.text || '').length;
  return n;
}

function validarBlocos(conteudo) {
  if (!Array.isArray(conteudo)) return;
  for (const b of conteudo) {
    if (b?.type === 'text') continue;
    if (b?.type !== 'image' && b?.type !== 'document') {
      throw Object.assign(new Error('Bloco de conteúdo desconhecido.'), { status: 400 });
    }
    const fonte = b.source || {};
    if (fonte.type !== 'base64' || !MIMES_OK.has(fonte.media_type)) {
      throw Object.assign(new Error('Formato de foto não aceito. Use JPG, PNG, WebP ou PDF.'), { status: 400 });
    }
    if (String(fonte.data || '').length > TETO_FOTO) {
      throw Object.assign(new Error('Foto grande demais. Tire de novo ou diminua a qualidade.'), { status: 413 });
    }
  }
}

/**
 * Recebe o pedido já validado do app e chama a IA configurada.
 * O app nunca escolhe o modelo nem vê nenhuma chave.
 */
export async function perguntar(pedido) {
  const quem = provedor();
  if (!quem) throw Object.assign(new Error('Nenhuma chave de IA configurada no servidor (ANTHROPIC_API_KEY ou GEMINI_API_KEY).'), { status: 500 });

  validarBlocos(pedido.conteudo);
  const tamanho = (pedido.system || '').length + medirTexto(pedido.conteudo);
  if (tamanho > TETO_TEXTO) throw Object.assign(new Error('Material grande demais. Divida em partes menores.'), { status: 413 });

  const chave = chaveCache(pedido, quem);
  const guardada = chave && cache.get(chave);
  if (guardada && Date.now() - guardada.em < CACHE_TTL) {
    return { ...guardada.r, cache: true, uso: { entrada: 0, saida: 0 } };
  }
  const r = quem === 'gemini' ? await perguntarGemini(pedido) : await perguntarClaude(pedido);
  if (chave) {
    cache.delete(chave);
    cache.set(chave, { em: Date.now(), r });
    while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);   // sai o mais antigo
  }
  return r;
}

/* ---------- cache: a mesma pergunta com o mesmo material não gasta a IA de novo ----------
   Só texto (foto nunca entra), por 12 h, até 400 respostas na memória. A chave
   é o pedido inteiro (com o contexto do aluno), então só repete o que é igual. */
const cache = new Map();
const CACHE_MAX = 400, CACHE_TTL = 12 * 3600000;
export const tamanhoCache = () => cache.size;
export const limparCache = () => cache.clear();
function chaveCache(pedido, quem) {
  if (contarFotos(pedido.conteudo) || process.env.CACHE_IA === '0') return null;
  const txt = JSON.stringify([quem, escadaPara(pedido), pedido.system, pedido.conteudo, pedido.schema || null, pedido.maxTokens || 0]);
  return txt.length > 80000 ? null : crypto.createHash('sha256').update(txt).digest('hex');
}

async function perguntarClaude({ system, conteudo, schema = null, maxTokens = 4000, esforco = 'medium', nivel = 'pro' }) {
  const chave = process.env.ANTHROPIC_API_KEY;

  const corpo = {
    model: modeloPara(nivel),
    max_tokens: Math.min(Number(maxTokens) || 4000, TETO_TOKENS),
    output_config: {
      effort: ESFORCOS.has(esforco) ? esforco : 'medium',
      ...(schema ? { format: { type: 'json_schema', schema } } : {}),
    },
    system,
    messages: [{ role: 'user', content: conteudo }],
  };

  const ctrl = new AbortController();
  const relogio = setTimeout(() => ctrl.abort(), 150000);
  let r;
  try {
    r = await fetch(URL_API, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': chave, 'anthropic-version': VERSAO },
      body: JSON.stringify(corpo),
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(relogio);
    if (e.name === 'AbortError') throw Object.assign(new Error('A resposta demorou demais. Tente de novo.'), { status: 504 });
    throw Object.assign(new Error('Não consegui falar com a Claude API.'), { status: 502 });
  }
  clearTimeout(relogio);

  const dados = await r.json().catch(() => ({}));
  if (!r.ok) {
    const detalhe = dados?.error?.message || '';
    console.error('Erro da Claude API:', r.status, detalhe);
    if (r.status === 429) throw Object.assign(new Error('Muitas perguntas ao mesmo tempo. Tente em alguns segundos.'), { status: 429 });
    // 401/400 de chave ou crédito é problema NOSSO — o aluno não tem o que fazer
    throw Object.assign(new Error('O MindTrack AI está temporariamente indisponível.'), { status: 503 });
  }
  if (dados.stop_reason === 'refusal') {
    throw Object.assign(new Error('O modelo preferiu não responder a esse pedido.'), { status: 422 });
  }

  const texto = (dados.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  return {
    texto,
    uso: {
      entrada: dados.usage?.input_tokens || 0,
      saida: dados.usage?.output_tokens || 0,
    },
  };
}

/* ==========================================================
   Gemini (Google) — a porta de entrada GRÁTIS
   ========================================================== */
/* ---------- a escada de modelos (o "modelo bom que dura") ----------
   O plano grátis do Gemini dá POUCAS perguntas por dia aos modelos melhores e
   bem mais aos leves (o limite é do projeto inteiro, não por aluno). Cada pedido
   sobe a escada do melhor para o mais leve: quando um modelo esgota a cota, o
   servidor anota até quando e pula direto para o próximo — sem gastar chamada
   testando de novo. Os nomes mudam com o tempo: troque pelas variáveis abaixo
   (listas separadas por vírgula) sem mexer no código.                         */
const ESCADAS = {
  topo: ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'],
  normal: ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'],
  leve: ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'],
};
const VAR_ESCADA = { topo: 'MODELOS_GEMINI_TOPO', normal: 'MODELOS_GEMINI', leve: 'MODELOS_GEMINI_LEVE' };

export function escadaGemini(nome) {
  const lista = (process.env[VAR_ESCADA[nome]] || '').split(',').map((x) => x.trim()).filter(Boolean);
  const base = lista.length ? lista : ESCADAS[nome] || ESCADAS.normal;
  // compatibilidade: MODELO_GEMINI (versão antiga) passa a ser o 1º degrau da escada normal
  const fixo = process.env.MODELO_GEMINI;
  return nome === 'normal' && fixo && !lista.length ? [fixo, ...base.filter((m) => m !== fixo)] : base;
}

/** Tarefa simples (esforço baixo) vai direto aos leves; difícil ou do Plus começa no topo. */
export function escadaPara({ esforco = 'medium', nivel = 'pro' } = {}) {
  if (esforco === 'low') return 'leve';
  if (esforco === 'high' || esforco === 'xhigh' || esforco === 'max' || nivel === 'plus') return 'topo';
  return 'normal';
}

/* quem está fora e até quando (ms); some sozinho quando passa a hora */
const fora = new Map();
const semPensar = new Set();   // modelos que recusaram o thinkingConfig
export const estadoEscada = () => Object.fromEntries([...fora].filter(([, ate]) => ate > Date.now())
  .map(([m, ate]) => [m, new Date(ate).toISOString()]));
export function zerarEscada() { fora.clear(); semPensar.clear(); }

/** A cota diária do Gemini renova à meia-noite do horário do Pacífico (~07–08h UTC). */
function proximaRenovacao(agora = Date.now()) {
  const d = new Date(agora);
  const alvo = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 8, 5);
  return alvo > agora ? alvo : alvo + 86400000;
}

function segundosDoRetry(dados) {
  const det = dados?.error?.details || [];
  for (const x of det) {
    const m = /^(\d+(?:\.\d+)?)s$/.exec(String(x?.retryDelay || ''));
    if (m) return Number(m[1]);
  }
  return null;
}

/** Nível de "pensamento" dos Gemini 3: pensar custa tokens da cota — só o necessário. */
const PENSAR = { low: 'minimal', medium: 'low', high: 'medium', xhigh: 'medium', max: 'high' };

function blocosParaGemini(conteudo) {
  if (!Array.isArray(conteudo)) return [{ text: String(conteudo ?? '') }];
  return conteudo.map((b) => (b.type === 'text'
    ? { text: String(b.text || '') }
    : { inline_data: { mime_type: b.source.media_type, data: b.source.data } }));
}

/** O Gemini aceita quase o mesmo JSON Schema, mas rejeita additionalProperties. */
function esquemaParaGemini(schema) {
  if (Array.isArray(schema)) return schema.map(esquemaParaGemini);
  if (schema && typeof schema === 'object') {
    const limpo = {};
    for (const [k, v] of Object.entries(schema)) {
      if (k === 'additionalProperties') continue;
      limpo[k] = esquemaParaGemini(v);
    }
    return limpo;
  }
  return schema;
}

async function chamarModeloGemini(modelo, { system, conteudo, schema, maxTokens, esforco }) {
  const pensar = modelo.startsWith('gemini-3') && !semPensar.has(modelo) ? PENSAR[esforco] || 'low' : null;
  const corpo = {
    system_instruction: { parts: [{ text: system || '' }] },
    contents: [{ role: 'user', parts: blocosParaGemini(conteudo) }],
    generationConfig: {
      maxOutputTokens: Math.min(Number(maxTokens) || 4000, TETO_TOKENS),
      ...(pensar ? { thinkingConfig: { thinkingLevel: pensar } } : {}),
      ...(schema ? { responseMimeType: 'application/json', responseSchema: esquemaParaGemini(schema) } : {}),
    },
  };
  const ctrl = new AbortController();
  const relogio = setTimeout(() => ctrl.abort(), 120000);
  try {
    const r = await fetch(`${URL_GEMINI()}/v1beta/models/${modelo}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify(corpo),
      signal: ctrl.signal,
    });
    const dados = await r.json().catch(() => ({}));
    return { r, dados, pensar };
  } finally {
    clearTimeout(relogio);
  }
}

async function perguntarGemini({ system, conteudo, schema = null, maxTokens = 4000, esforco = 'medium', nivel = 'pro' }) {
  const degraus = escadaGemini(escadaPara({ esforco, nivel }));
  let ultimoErro = null;

  for (const modelo of degraus) {
    if ((fora.get(modelo) || 0) > Date.now()) continue;      // sabidamente esgotado: nem tenta

    let resp;
    try { resp = await chamarModeloGemini(modelo, { system, conteudo, schema, maxTokens, esforco }); }
    catch (e) {
      ultimoErro = e.name === 'AbortError' ? 'demorou demais' : 'sem conexão';
      continue;                                               // tenta o próximo degrau
    }
    let { r, dados, pensar } = resp;

    // modelo que não aceita o nível de pensamento: tenta de novo sem ele (e lembra)
    if (r.status === 400 && pensar && /think/i.test(dados?.error?.message || '')) {
      semPensar.add(modelo);
      ({ r, dados } = await chamarModeloGemini(modelo, { system, conteudo, schema, maxTokens, esforco }));
    }

    if (r.ok) {
      if (dados.promptFeedback?.blockReason) {
        throw Object.assign(new Error('O modelo preferiu não responder a esse pedido.'), { status: 422 });
      }
      const texto = (dados.candidates?.[0]?.content?.parts || [])
        .filter((p) => !p.thought).map((p) => p.text || '').join('\n').trim();
      if (!texto) { ultimoErro = 'resposta vazia'; continue; }
      return {
        texto,
        modelo,
        uso: {
          entrada: dados.usageMetadata?.promptTokenCount || 0,
          saida: (dados.usageMetadata?.candidatesTokenCount || 0) + (dados.usageMetadata?.thoughtsTokenCount || 0),
        },
      };
    }

    const msg = dados?.error?.message || '';
    ultimoErro = `${modelo}: ${r.status} ${msg.slice(0, 120)}`;
    if (r.status === 429) {
      const porDia = /per ?day|daily|PerDay/i.test(msg) || /PerDay/.test(JSON.stringify(dados?.error?.details || []));
      const espera = segundosDoRetry(dados);
      fora.set(modelo, porDia ? proximaRenovacao() : Date.now() + 1000 * Math.min(Math.max(espera ?? 60, 10), 600));
      console.warn(`Gemini: ${modelo} sem cota (${porDia ? 'até amanhã' : 'por um minuto'}) — descendo a escada.`);
      continue;
    }
    if (r.status === 404 || /not found|not supported|is not available/i.test(msg)) {
      fora.set(modelo, Date.now() + 6 * 3600000);              // nome que saiu do ar: pula por 6 h
      console.warn(`Gemini: ${modelo} não existe mais — confira MODELOS_GEMINI.`);
      continue;
    }
    if (r.status >= 500) { fora.set(modelo, Date.now() + 30000); continue; }   // sobrecarga: o próximo
    if (r.status === 401 || r.status === 403) {
      console.error('Gemini: a chave GEMINI_API_KEY foi recusada.', msg);
      throw Object.assign(new Error('O MindTrack AI está temporariamente indisponível.'), { status: 503 });
    }
    console.error('Erro do Gemini:', r.status, msg);
    throw Object.assign(new Error('O MindTrack AI não entendeu esse pedido. Tente escrever de outro jeito.'), { status: 502 });
  }

  console.error('Gemini: todos os degraus da escada falharam.', ultimoErro, estadoEscada());
  throw Object.assign(new Error('O MindTrack AI atingiu o limite de hoje. Tente de novo mais tarde — as perguntas rápidas do chat continuam funcionando.'), { status: 429 });
}
