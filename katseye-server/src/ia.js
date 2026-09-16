/* ===== ia.js — a conversa com o modelo =====
   Dois provedores, a mesma saída: texto. A chave nunca sai daqui.

   Decisão importante de segurança: o SISTEMA é definido NESTE arquivo e o
   que o app manda é ignorado. Sem isso, um servidor aberto na internet com
   a sua chave viraria um proxy de LLM genérico para qualquer um — bastaria
   mandar outro prompt. Assim ele só sabe ser o Conselheiro do KATSEYE.    */

const URL_GEMINI = () => process.env.URL_GEMINI || 'https://generativelanguage.googleapis.com';
const URL_ANTHROPIC = () => process.env.URL_ANTHROPIC || 'https://api.anthropic.com/v1/messages';
const VERSAO_ANTHROPIC = '2023-06-01';

/* Busca do Google e leitura de páginas. Não entram na camada gratuita do
   Gemini: sem faturamento ativo, a API responde 429 falando em billing. O
   servidor trata isso como caso normal — refaz sem ferramenta e avisa. */
export const FERRAMENTAS_WEB = [{ google_search: {} }, { url_context: {} }];
export const webLigada = () => process.env.WEB !== '0';

export const TETO_MENSAGENS = 24;
export const TETO_TEXTO = 60000;        // caracteres somados de todas as mensagens

export const SISTEMA = `Você é o Conselheiro Estratégico do KATSEYE Central — um app de gestão
criativa dedicado ao grupo KATSEYE (HYBE x Geffen).

Seu papel: sócio de negócios e parceiro criativo. Você analisa com franqueza, aponta o que
está fraco, propõe caminhos concretos e ajuda a destravar bloqueio criativo. Você também
responde dúvidas sobre como usar o próprio app, quando o contexto trouxer essa informação.

Regras:
- Responda em português do Brasil, direto, sem enrolação e sem bajulação.
- Use os dados reais do contexto. Se um dado não estiver lá, diga que não sabe — nunca invente
  números de streams, vendas, paradas, datas de lançamento ou fatos sobre as integrantes.
- Prefira resposta curta com passo concreto a texto longo e genérico.
- Quando fizer sentido, estruture com títulos curtos (##) e listas (-).
- Quando a pessoa pedir ideias, dê poucas e boas, cada uma com o porquê.
- Recuse pedidos que não tenham nada a ver com o KATSEYE Central, explicando em uma linha
  que você é o conselheiro deste app.`;

/* ---------- qual provedor está ligado ---------- */
export function provedor() {
  const forcado = (process.env.PROVEDOR || '').toLowerCase();
  if (forcado === 'gemini' && process.env.GEMINI_API_KEY) return 'gemini';
  if ((forcado === 'anthropic' || forcado === 'claude') && process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  return null;
}
export const temChave = () => !!provedor();
/* Apelido de propósito: o Google aposenta versão numerada sem aviso — o
   gemini-2.5-flash deixou de aceitar chave nova — e o apelido acompanha. */
export const MODELO_SOCORRO = 'gemini-flash-latest';
/* O Google tem picos: o mesmo modelo responde 200, 503 e 200 em segundos.
   Insistir com espera resolve quase sempre; trocar para o leve resolve o
   resto. Só depois disso o erro sobe para o app. */
const MODELO_LEVE = 'gemini-flash-lite-latest';
const ESPERAS_503 = [900, 2800];
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
export const modeloGemini = () => process.env.MODELO_GEMINI || MODELO_SOCORRO;
export const modeloAnthropic = () => process.env.MODELO_ANTHROPIC || 'claude-haiku-4-5-20251001';
export const modeloEmUso = () => (provedor() === 'anthropic' ? modeloAnthropic() : modeloGemini());

const erro = (status, msg) => Object.assign(new Error(msg), { status });

/** Confere o que chegou antes de gastar chamada de API. */
export function validar(mensagens) {
  if (!Array.isArray(mensagens) || !mensagens.length) {
    throw erro(400, 'Mande "mensagens": uma lista de { role, content }.');
  }
  if (mensagens.length > TETO_MENSAGENS) {
    throw erro(400, `Conversa longa demais (máximo de ${TETO_MENSAGENS} mensagens).`);
  }
  let tamanho = 0;
  for (const m of mensagens) {
    if (typeof m?.content !== 'string' || !m.content.trim()) {
      throw erro(400, 'Cada mensagem precisa de "content" em texto.');
    }
    if (m.role !== 'user' && m.role !== 'assistant') {
      throw erro(400, '"role" precisa ser "user" ou "assistant".');
    }
    tamanho += m.content.length;
  }
  if (tamanho > TETO_TEXTO) {
    throw erro(413, `Texto grande demais (${tamanho} caracteres, o teto é ${TETO_TEXTO}).`);
  }
  return mensagens;
}

/* ---------- Gemini ---------- */
async function viaGemini(mensagens, sinal, { modelo: forcado = null, tentativa = 0, jaTrocou = false, web = null } = {}) {
  const modelo = forcado || modeloGemini();
  const comWeb = web === null ? webLigada() : web;
  const url = `${URL_GEMINI()}/v1beta/models/${encodeURIComponent(modelo)}:generateContent`
    + `?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;

  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: sinal,
    body: JSON.stringify({
      system_instruction: { parts: [{ text: comWeb ? `${SISTEMA}\n\n${SISTEMA_WEB}` : SISTEMA }] },
      contents: mensagens.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      generationConfig: { maxOutputTokens: 2048, temperature: 0.8 },
      ...(comWeb ? { tools: FERRAMENTAS_WEB } : {}),
    }),
  });

  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = d?.error?.message || `o Gemini respondeu ${r.status}`;
    // Modelo aposentado: o Google responde 404 dizendo qual usar. Troca pelo
    // apelido que acompanha as versões e tenta uma vez, em vez de falhar.
    if (r.status === 404 && modelo !== MODELO_SOCORRO) {
      console.warn(`[ia] modelo "${modelo}" indisponível, caindo para ${MODELO_SOCORRO}`);
      return viaGemini(mensagens, sinal, { modelo: MODELO_SOCORRO, web: comWeb });
    }
    if (r.status === 503) {
      if (tentativa < ESPERAS_503.length) {
        await dormir(ESPERAS_503[tentativa]);
        return viaGemini(mensagens, sinal, { modelo, tentativa: tentativa + 1, jaTrocou, web: comWeb });
      }
      if (!jaTrocou && modelo !== MODELO_LEVE) {
        console.warn(`[ia] "${modelo}" sobrecarregado, tentando ${MODELO_LEVE}`);
        return viaGemini(mensagens, sinal, { modelo: MODELO_LEVE, jaTrocou: true, web: comWeb });
      }
      throw erro(503, 'O Gemini está sobrecarregado agora — insisti e troquei de modelo. Costuma passar em poucos minutos.');
    }
    // ferramenta recusada por faturamento: a mesma pergunta sem ela funciona
    if (r.status === 429 && comWeb && /billing/i.test(msg)) {
      console.warn('[ia] ferramentas de web indisponíveis nesta chave; respondendo sem elas');
      const saida = await viaGemini(mensagens, sinal, { modelo, web: false });
      return { ...saida, semWeb: true };
    }
    if (r.status === 429) {
      if (tentativa === 0) {
        await dormir(2500);
        return viaGemini(mensagens, sinal, { modelo, tentativa: 1, jaTrocou, web: comWeb });
      }
      throw erro(429, `Limite de uso da chave atingido: ${msg}`);
    }
    if (r.status === 400 && /api key/i.test(msg)) throw erro(500, 'A chave do servidor foi recusada pelo Google.');
    if (r.status === 404) throw erro(500, `O modelo "${modelo}" não está disponível para esta chave.`);
    throw erro(r.status >= 500 ? 502 : 400, msg);
  }

  const cand = d.candidates?.[0];
  if (!cand && d.promptFeedback?.blockReason) {
    throw erro(400, `O Gemini bloqueou a resposta (${d.promptFeedback.blockReason}).`);
  }
  // Modelos novos devolvem também blocos de raciocínio; só o texto importa.
  const texto = (cand?.content?.parts || [])
    .filter((x) => !x.thought && typeof x.text === 'string' && x.text)
    .map((x) => x.text).join('\n').trim();
  if (!texto) throw erro(502, 'A resposta veio vazia.');

  const fontes = [];
  for (const c of cand?.groundingMetadata?.groundingChunks || []) {
    if (c.web?.uri) fontes.push({ titulo: c.web.title || c.web.uri, url: c.web.uri });
  }
  for (const u of cand?.urlContextMetadata?.urlMetadata || []) {
    const url = u.retrievedUrl || u.retrieved_url;
    const ok = String(u.urlRetrievalStatus || u.url_retrieval_status || '').includes('SUCCESS');
    if (url && ok && !fontes.some((x) => x.url === url)) fontes.push({ titulo: url, url });
  }
  return { texto, fontes, buscas: cand?.groundingMetadata?.webSearchQueries || [] };
}

const SISTEMA_WEB = `Você tem acesso à busca do Google e à leitura de páginas web.
Use quando a pergunta depender de informação atual, de um link que a pessoa mandou, ou de
qualquer dado que você não tenha certeza. Diga de onde tirou o que afirmar, e não invente:
se a busca não achar, diga que não achou.`;

/* ---------- Anthropic ---------- */
async function viaAnthropic(mensagens, sinal) {
  const r = await fetch(URL_ANTHROPIC(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': VERSAO_ANTHROPIC,
    },
    signal: sinal,
    body: JSON.stringify({
      model: modeloAnthropic(),
      max_tokens: 2048,
      system: SISTEMA,
      messages: mensagens.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = d?.error?.message || `a Anthropic respondeu ${r.status}`;
    if (r.status === 429) throw erro(429, 'Limite da API atingido. Tente daqui a pouco.');
    throw erro(r.status >= 500 ? 502 : 400, msg);
  }
  const texto = (d.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
  if (!texto) throw erro(502, 'A resposta veio vazia.');
  return texto;
}

/** Pergunta ao provedor ligado. Devolve só o texto. */
export async function perguntar(mensagens, { timeout = 90000 } = {}) {
  const qual = provedor();
  if (!qual) throw erro(503, 'Este servidor está sem chave de IA configurada.');

  const ctrl = new AbortController();
  const relogio = setTimeout(() => ctrl.abort(), timeout);
  try {
    if (qual === 'anthropic') return { texto: await viaAnthropic(mensagens, ctrl.signal) };
    return viaGemini(mensagens, ctrl.signal);
  } catch (e) {
    if (e.name === 'AbortError') throw erro(504, 'O modelo demorou demais para responder.');
    if (e.status) throw e;
    throw erro(502, `Não consegui falar com o provedor: ${e.message}`);
  } finally {
    clearTimeout(relogio);
  }
}
