/* ===== ia.js — a única parte que conhece a chave da Claude API ===== */
// URL_ANTHROPIC existe para os testes automatizados apontarem para uma API dublada.
const URL_API = process.env.URL_ANTHROPIC || 'https://api.anthropic.com/v1/messages';
const VERSAO = '2023-06-01';

const ESFORCOS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);
const MODELOS_OK = new Set(['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5']);
const TETO_TOKENS = 8000;
const TETO_TEXTO = 60000;      // caracteres de system + conteúdo

export function modeloPadrao() {
  const m = process.env.MODELO || 'claude-opus-5';
  return MODELOS_OK.has(m) ? m : 'claude-opus-5';
}

/**
 * Recebe o pedido já validado do app e chama a Claude API.
 * O app nunca escolhe o modelo nem vê a chave.
 */
export async function perguntar({ system, conteudo, schema = null, maxTokens = 4000, esforco = 'medium' }) {
  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) throw Object.assign(new Error('ANTHROPIC_API_KEY não configurada no servidor'), { status: 500 });

  const tamanho = (system || '').length + JSON.stringify(conteudo || '').length;
  if (tamanho > TETO_TEXTO) throw Object.assign(new Error('Material grande demais. Divida em partes menores.'), { status: 413 });

  const corpo = {
    model: modeloPadrao(),
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
