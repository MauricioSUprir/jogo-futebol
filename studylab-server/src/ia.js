/* ===== ia.js — a única parte que conhece a chave da Claude API ===== */
// URL_ANTHROPIC existe para os testes automatizados apontarem para uma API dublada.
const URL_API = process.env.URL_ANTHROPIC || 'https://api.anthropic.com/v1/messages';
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
 * Recebe o pedido já validado do app e chama a Claude API.
 * O app nunca escolhe o modelo nem vê a chave.
 */
export async function perguntar({ system, conteudo, schema = null, maxTokens = 4000, esforco = 'medium', nivel = 'pro' }) {
  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) throw Object.assign(new Error('ANTHROPIC_API_KEY não configurada no servidor'), { status: 500 });

  validarBlocos(conteudo);
  const tamanho = (system || '').length + medirTexto(conteudo);
  if (tamanho > TETO_TEXTO) throw Object.assign(new Error('Material grande demais. Divida em partes menores.'), { status: 413 });

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
