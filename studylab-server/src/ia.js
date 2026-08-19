/* ===== ia.js — a única parte que conhece as chaves de IA =====
   Dois provedores:
   - Claude (ANTHROPIC_API_KEY) — pago por uso; é o recomendado quando há assinantes.
   - Gemini (GEMINI_API_KEY) — tem faixa GRÁTIS em aistudio.google.com; perfeito
     para testar o Study AI sem gastar nada. O limite do plano grátis é do app
     inteiro (não por aluno), então para escala use o Claude.
   Com as duas chaves, o Claude vence; PROVEDOR=gemini força o Gemini.          */
// URL_ANTHROPIC / URL_GEMINI existem para os testes apontarem para APIs dubladas.
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
export const modeloGemini = () => process.env.MODELO_GEMINI || 'gemini-2.5-flash';
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

  return quem === 'gemini' ? perguntarGemini(pedido) : perguntarClaude(pedido);
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
    throw Object.assign(new Error('O Study AI está temporariamente indisponível.'), { status: 503 });
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

async function perguntarGemini({ system, conteudo, schema = null, maxTokens = 4000 }) {
  const chave = process.env.GEMINI_API_KEY;
  const corpo = {
    system_instruction: { parts: [{ text: system || '' }] },
    contents: [{ role: 'user', parts: blocosParaGemini(conteudo) }],
    generationConfig: {
      maxOutputTokens: Math.min(Number(maxTokens) || 4000, TETO_TOKENS),
      ...(schema ? { responseMimeType: 'application/json', responseSchema: esquemaParaGemini(schema) } : {}),
    },
  };

  const ctrl = new AbortController();
  const relogio = setTimeout(() => ctrl.abort(), 150000);
  let r;
  try {
    r = await fetch(`${URL_GEMINI()}/v1beta/models/${modeloGemini()}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': chave },
      body: JSON.stringify(corpo),
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(relogio);
    if (e.name === 'AbortError') throw Object.assign(new Error('A resposta demorou demais. Tente de novo.'), { status: 504 });
    throw Object.assign(new Error('Não consegui falar com o Gemini.'), { status: 502 });
  }
  clearTimeout(relogio);

  const dados = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error('Erro do Gemini:', r.status, dados?.error?.message || '');
    if (r.status === 429) {
      // o limite do plano grátis é do app inteiro, não do aluno
      throw Object.assign(new Error('A fila do plano grátis da IA está cheia agora. Espere um pouco e tente de novo.'), { status: 429 });
    }
    throw Object.assign(new Error('O Study AI está temporariamente indisponível.'), { status: 503 });
  }
  if (dados.promptFeedback?.blockReason) {
    throw Object.assign(new Error('O modelo preferiu não responder a esse pedido.'), { status: 422 });
  }

  const texto = (dados.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || '').join('\n').trim();
  if (!texto) throw Object.assign(new Error('A resposta veio vazia. Tente de novo.'), { status: 502 });
  return {
    texto,
    uso: {
      entrada: dados.usageMetadata?.promptTokenCount || 0,
      saida: dados.usageMetadata?.candidatesTokenCount || 0,
    },
  };
}
