/* ===== testes/roda.js — testa o servidor de ponta a ponta =====
   Roda em memória, com login simulado e a Claude API dublada.
   Uso: npm run teste                                                          */
process.env.MODO_TESTE = '1';
process.env.SEGREDO = 'segredo-de-teste';
process.env.ANTHROPIC_API_KEY = 'sk-ant-falsa';
process.env.PORT = process.env.PORT || '4711';
process.env.ORIGENS = '*';
process.env.LIMITE_DIARIO = '3';        // limite do Pro no teste
process.env.LIMITE_DIARIO_PLUS = '8';   // limite do Plus no teste
process.env.FOTOS_DIA = '2';            // fotos/dia do Pro no teste
process.env.FOTOS_DIA_PLUS = '10';
process.env.FREIO_IP = '5000';
process.env.CACHE_IA = '0';             // cada seção liga o cache só quando testa ele          // o freio por IP não atrapalha o teste
process.env.MP_ACCESS_TOKEN = 'APP_USR-falso';
process.env.MP_PUBLIC_KEY = 'APP_USR-publica';
delete process.env.DATABASE_URL;
process.env.GOOGLE_CLIENT_ID = 'cliente-teste.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'segredo-google-teste';
process.env.URL_SERVIDOR = `http://localhost:${process.env.PORT}`;
process.env.DUELO_ESCALA = '0.02';      // duelos 50× mais rápidos no teste

const BASE = `http://localhost:${process.env.PORT}`;
const { montarBRCode } = await import('./brcode.js');

/* ---- dubla a Claude API (o resto passa direto) ---- */
const fetchReal = globalThis.fetch;
let chamadasClaude = 0;
let ultimoModelo = '';
let ultimoGemini = null;
let chamadasGemini = [];                // modelos chamados, em ordem
const geminiFalha = {};                 // modelo → { status, msg } para simular cota/sumiço
let assinaturasMP = 0;
const whatsappEnviados = [];
/* ---- Google dublado: o "code" diz quem entra e o que foi permitido ---- */
const google = { revogados: [], refreshPedidos: 0, codigos: {} };
const jwtFalso = (p) => ['e30', Buffer.from(JSON.stringify(p)).toString('base64url'), 'x'].join('.');
const resp = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json' } });
let pixConsultas = 0;
globalThis.fetch = async (url, opcoes) => {
  const alvo = String(url);

  // ---- Mercado Pago dublado ----
  if (alvo.includes('mercadopago.com')) {
    if (alvo.endsWith('/checkout/preferences') && opcoes?.method === 'POST') {
      const c = JSON.parse(opcoes.body);
      return new Response(JSON.stringify({
        id: 'PREF-1', init_point: 'https://www.mercadopago.com.br/checkout/PREF-1',
        external_reference: c.external_reference,
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (alvo.endsWith('/v1/payments') && opcoes?.method === 'POST') {
      const c = JSON.parse(opcoes.body);
      if (c.token) {   // pagamento com cartão
        const aprovado = c.token !== 'token-recusado';
        return new Response(JSON.stringify({
          id: aprovado ? 'CARD-OK' : 'CARD-NO', status: aprovado ? 'approved' : 'rejected',
          status_detail: aprovado ? 'accredited' : 'cc_rejected_insufficient_amount',
          external_reference: c.external_reference, transaction_amount: c.transaction_amount,
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({
        id: 'PIX-QR-1', status: 'pending', external_reference: c.external_reference,
        transaction_amount: c.transaction_amount,
        point_of_interaction: { transaction_data: {
          qr_code: montarBRCode(c.transaction_amount),
          qr_code_base64: 'iVBORw0KGgoAAAANSUhEUg==',
          ticket_url: 'https://www.mercadopago.com.br/payments/PIX-QR-1/ticket',
        } },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (alvo.includes('/v1/payments/PIX-QR-1')) {
      // primeira consulta: ainda pendente; depois: aprovado
      pixConsultas++;
      return new Response(JSON.stringify({
        id: 'PIX-QR-1', status: pixConsultas > 1 ? 'approved' : 'pending',
        external_reference: 'aluno-qr|semanal', transaction_amount: 5.99,
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (alvo.includes('/v1/payments/PG-PIX')) {
      return new Response(JSON.stringify({
        id: 'PG-PIX', status: 'approved', external_reference: 'aluno-pix|semanal',
        transaction_amount: 5.99, payment_method_id: 'pix',
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (alvo.endsWith('/preapproval') && opcoes?.method === 'POST') {
      assinaturasMP++;
      const c = JSON.parse(opcoes.body);
      return new Response(JSON.stringify({
        id: 'PA-1', init_point: 'https://www.mercadopago.com.br/checkout/PA-1',
        external_reference: c.external_reference, status: 'pending',
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (alvo.includes('/preapproval/PA-1')) {
      return new Response(JSON.stringify({
        id: 'PA-1', status: 'authorized', external_reference: 'aluno-pagante|mensal',
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (alvo.includes('/v1/payments/PG-9')) {
      return new Response(JSON.stringify({
        id: 'PG-9', status: 'approved', external_reference: 'aluno-pagante|mensal', transaction_amount: 29.99,
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response('{}', { status: 404 });
  }

  // ---- Gemini dublado ----
  if (alvo.includes('generativelanguage')) {
    const corpo = JSON.parse(opcoes.body);
    const modelo = (alvo.match(/models\/([^:]+):/) || [])[1] || '';
    chamadasGemini.push(modelo);
    const pensa = corpo.generationConfig.thinkingConfig?.thinkingLevel || null;
    const f = geminiFalha[modelo];
    if (f && !(f.soComPensar && !pensa)) {
      return new Response(JSON.stringify({ error: { code: f.status, message: f.msg, details: f.details || [] } }),
        { status: f.status, headers: { 'content-type': 'application/json' } });
    }
    ultimoGemini = {
      model: modelo,
      pensa,
      temFoto: JSON.stringify(corpo.contents).includes('inline_data'),
      schemaLimpo: corpo.generationConfig.responseSchema
        ? !JSON.stringify(corpo.generationConfig.responseSchema).includes('additionalProperties') : null,
    };
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: corpo.generationConfig.responseSchema ? '{"x":"ok"}' : 'o gemini disse: oi' }] } }],
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }

  if (alvo.includes('api.anthropic.com')) {
    chamadasClaude++;
    const corpo = JSON.parse(opcoes.body);
    ultimoModelo = corpo.model;
    return new Response(JSON.stringify({
      content: [{ type: 'text', text: `resposta para: ${corpo.messages[0].content}` }],
      usage: { input_tokens: 120, output_tokens: 45 },
      stop_reason: 'end_turn',
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (alvo.startsWith('https://graph.facebook.com/')) {
    whatsappEnviados.push({ url: alvo, corpo: JSON.parse(opcoes.body), auth: opcoes.headers.authorization });
    return resp({ messages: [{ id: 'wamid.1' }] });
  }
  if (alvo === 'https://oauth2.googleapis.com/token') {
    const c = new URLSearchParams(String(opcoes.body));
    if (c.get('client_secret') !== 'segredo-google-teste') return resp({ error: 'invalid_client' }, 401);
    if (c.get('grant_type') === 'refresh_token') {
      google.refreshPedidos++;
      if (c.get('refresh_token') === 'rt-revogado') return resp({ error: 'invalid_grant' }, 400);
      return resp({ access_token: `at-de-${c.get('refresh_token')}`, expires_in: 3599 });
    }
    const d = google.codigos[c.get('code')];
    if (!d || c.get('redirect_uri') !== `${process.env.URL_SERVIDOR}/conexoes/google/volta`) return resp({ error: 'invalid_grant' }, 400);
    return resp({
      access_token: 'at-1', expires_in: 3599, scope: d.scope, ...(d.refresh ? { refresh_token: d.refresh } : {}),
      id_token: jwtFalso({ iss: 'https://accounts.google.com', aud: d.aud || process.env.GOOGLE_CLIENT_ID,
        sub: d.sub, email: d.email, name: d.nome, exp: Math.floor(Date.now() / 1000) + 3600 }),
    });
  }
  if (alvo === 'https://oauth2.googleapis.com/revoke') { google.revogados.push(new URLSearchParams(String(opcoes.body)).get('token')); return resp({}); }
  if (alvo.startsWith('https://www.googleapis.com/calendar/v3/calendars/primary/events')) {
    if (opcoes?.headers?.authorization !== 'Bearer at-de-rt-agenda') return resp({}, 401);
    const d = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
    return resp({ items: [
      { id: 'e1', summary: 'Prova de Matemática', start: { date: d(5) }, end: { date: d(6) } },
      { id: 'e2', summary: 'Férias de julho', start: { date: d(30) }, end: { date: d(45) } },
      { id: 'e3', summary: 'Dentista', start: { dateTime: `${d(2)}T15:30:00-03:00` }, end: { dateTime: `${d(2)}T16:30:00-03:00` } },
      { id: 'e4', summary: 'Cancelado', status: 'cancelled', start: { date: d(3) } },
    ] });
  }
  if (alvo.startsWith('https://classroom.googleapis.com/v1/')) {
    if (opcoes?.headers?.authorization !== 'Bearer at-de-rt-class') return resp({}, 401);
    if (alvo.includes('/courses?')) return resp({ courses: [{ id: 'c1', name: 'Biologia 2º A' }] });
    if (alvo.includes('/studentSubmissions')) return resp({ studentSubmissions: [{ courseWorkId: 'w2', state: 'TURNED_IN' }] });
    const fut = new Date(Date.now() + 4 * 86400000);
    return resp({ courseWork: [
      { id: 'w1', title: 'Lista de genética', alternateLink: 'https://classroom.google.com/c/x/a/w1',
        dueDate: { year: fut.getUTCFullYear(), month: fut.getUTCMonth() + 1, day: fut.getUTCDate() } },
      { id: 'w2', title: 'Trabalho sobre células' },
      { id: 'w3', title: 'Atividade velha', dueDate: { year: 2020, month: 1, day: 1 } },
    ] });
  }
  return fetchReal(url, opcoes);
};

await import('../src/index.js');
await new Promise((r) => setTimeout(r, 400));

let ok = 0, falhas = 0;
const conferir = (certo, texto, extra = '') => {
  if (certo) { ok++; console.log(`  ✓ ${texto}`); }
  else { falhas++; console.log(`  ✗ ${texto}${extra ? ' → ' + extra : ''}`); }
};
const pedir = async (metodo, rota, { corpo, token } = {}) => {
  const r = await fetchReal(BASE + rota, {
    method: metodo,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  return { status: r.status, dados: await r.json().catch(() => ({})) };
};

console.log('\n== saúde ==');
{
  const { status, dados } = await pedir('GET', '/saude');
  conferir(status === 200 && dados.ok, 'servidor responde', JSON.stringify(dados));
  conferir(dados.banco === 'memoria', 'rodando em memória no teste');
}

console.log('\n== login ==');
let token;
{
  const { status, dados } = await pedir('POST', '/entrar', { corpo: { teste: { id: 'aluno-1', email: 'gui@escola.com', nome: 'Gui' } } });
  conferir(status === 200 && !!dados.token, 'login devolve sessão');
  conferir(dados.plano === 'free', 'aluno novo começa no plano grátis');
  token = dados.token;
}
{
  const { status } = await pedir('GET', '/eu');
  conferir(status === 401, 'sem token, /eu recusa');
  const r2 = await pedir('GET', '/eu', { token: 'token-inventado' });
  conferir(r2.status === 401, 'token falso é recusado');
}

console.log('\n== conta de aparelho (sem Google) ==');
{
  const cred = { id: 'ap_teste', segredo: 'segredo-do-aparelho', nome: 'Sem Conta' };
  const a = await pedir('POST', '/entrar', { corpo: { dispositivo: cred } });
  conferir(a.status === 200 && !!a.dados.token, 'entra sem Google, só com o aparelho');
  conferir(a.dados.plano === 'free', 'conta de aparelho começa no grátis');

  const devolta = await pedir('POST', '/entrar', { corpo: { dispositivo: cred } });
  conferir(devolta.dados.usuario.id === 'ap_teste', 'volta na mesma conta ao reabrir o app');

  const ladrao = await pedir('POST', '/entrar', { corpo: { dispositivo: { ...cred, segredo: 'chutei' } } });
  conferir(ladrao.status === 401, 'quem sabe só o id do aparelho não entra');

  const cod = await pedir('POST', '/codigo', { token: a.dados.token, corpo: { codigo: 'TESTE7' } });
  conferir(cod.dados.plano === 'pro', 'conta de aparelho consegue virar Pro');
  const ia = await pedir('POST', '/ia', { token: a.dados.token, corpo: { system: 'a', conteudo: 'b' } });
  conferir(ia.status === 200, 'e usa o MindTrack AI normalmente');
}

console.log('\n== o que falta configurar ==');
{
  const { dados } = await pedir('GET', '/saude');
  conferir(Array.isArray(dados.falta), 'servidor diz o que ainda falta configurar');
  conferir(dados.studyAiPronto === true, 'checklist: MindTrack AI pronto');
  conferir(dados.falta.some((f) => f.includes('DATABASE_URL')), 'checklist aponta o banco faltando no teste');
}

console.log('\n== paywall ==');
{
  const antes = chamadasClaude;
  const { status, dados } = await pedir('POST', '/ia', { token, corpo: { system: 'oi', conteudo: 'teste' } });
  conferir(status === 402, 'sem assinatura, o MindTrack AI é bloqueado', `${status} ${dados.erro}`);
  conferir(chamadasClaude === antes, 'nada é gasto na Claude API antes de pagar');
}

console.log('\n== código de acesso ==');
{
  const ruim = await pedir('POST', '/codigo', { token, corpo: { codigo: 'NAOEXISTE' } });
  conferir(ruim.status === 404, 'código inválido é recusado');
  const { status, dados } = await pedir('POST', '/codigo', { token, corpo: { codigo: 'teste7' } });
  conferir(status === 200 && dados.plano === 'pro', 'código válido libera o Pro (aceita minúsculo)');
  const hoje = new Date(); hoje.setDate(hoje.getDate() + 7);
  conferir(dados.proAte === hoje.toISOString().slice(0, 10), `assinatura vence em 7 dias (${dados.proAte})`);
}

console.log('\n== MindTrack AI ==');
{
  const antes = chamadasClaude;
  const { status, dados } = await pedir('POST', '/ia', { token, corpo: { system: 'Você é o MindTrack AI', conteudo: 'o que estudo agora?' } });
  conferir(status === 200, 'assinante consegue perguntar', `${status} ${dados.erro || ''}`);
  conferir(dados.texto?.includes('o que estudo agora?'), 'resposta chega no app');
  conferir(chamadasClaude === antes + 1, 'a chamada foi para a Claude API uma única vez');
  const eu = await pedir('GET', '/eu', { token });
  conferir(eu.dados.uso.chamadasHoje === 1, 'uso do dia é contabilizado');
}

console.log('\n== limite diário ==');
{
  await pedir('POST', '/ia', { token, corpo: { system: 'a', conteudo: 'b' } });
  await pedir('POST', '/ia', { token, corpo: { system: 'a', conteudo: 'c' } });
  const { status, dados } = await pedir('POST', '/ia', { token, corpo: { system: 'a', conteudo: 'd' } });
  conferir(status === 429, `passou do limite de ${process.env.LIMITE_DIARIO} e foi barrado`, dados.erro);
}

console.log('\n== isolamento entre alunos ==');
{
  const outro = await pedir('POST', '/entrar', { corpo: { teste: { id: 'aluno-2', email: 'ana@escola.com', nome: 'Ana' } } });
  conferir(outro.dados.plano === 'free', 'a assinatura de um aluno não vaza para outro');
  const r = await pedir('POST', '/ia', { token: outro.dados.token, corpo: { system: 'a', conteudo: 'b' } });
  conferir(r.status === 402, 'aluno sem plano continua bloqueado');
}

console.log('\n== cancelar ==');
{
  await pedir('POST', '/cancelar', { token });
  const { dados } = await pedir('GET', '/eu', { token });
  conferir(dados.plano === 'free', 'cancelamento volta para o grátis');
}

console.log('\n== pagamento ==');
{
  const e = await pedir('POST', '/entrar', { corpo: { teste: { id: 'aluno-pagante', email: 'pai@casa.com', nome: 'Pai' } } });
  const tokenPagante = e.dados.token;

  const planos = await pedir('GET', '/planos');
  conferir(planos.dados.planos.length === 5, 'servidor publica os 5 planos (Pro e Plus)');
  conferir(planos.dados.planos.find((p) => p.id === 'pro_mensal')?.valor === 24.90, 'preço do Pro mensal vem do servidor (R$ 24,90)');
  conferir(planos.dados.planos.find((p) => p.id === 'plus_mensal')?.valor === 44.90, 'Plus mensal custa R$ 20 a mais (R$ 44,90)');
  conferir(planos.dados.planos.find((p) => p.id === 'plus_mensal')?.nivel === 'plus', 'plano Plus vem marcado com o nível');
  conferir(planos.dados.limites?.pro?.dia > 0 && planos.dados.limites?.plus?.dia > planos.dados.limites?.pro?.dia,
    'limites por nível são publicados e o Plus tem mais perguntas');

  const ruim = await pedir('POST', '/pagar', { token: tokenPagante, corpo: { planoId: 'inventado' } });
  conferir(ruim.status === 400, 'plano inventado é recusado');

  const { status, dados } = await pedir('POST', '/pagar', { token: tokenPagante, corpo: { planoId: 'mensal', forma: 'recorrente' } });
  conferir(status === 200 && String(dados.link).includes('mercadopago'), 'gera o link da cobrança automática', dados.link || dados.erro);
  conferir(assinaturasMP === 1, 'assinatura recorrente criada no Mercado Pago');

  const pix = await pedir('POST', '/pagar', { token: tokenPagante, corpo: { planoId: 'mensal', forma: 'unico' } });
  conferir(pix.status === 200 && pix.dados.forma === 'unico', 'gera o checkout com Pix e cartão', pix.dados.link || pix.dados.erro);
  conferir(planos.dados.formas.includes('pix'), 'servidor anuncia que aceita Pix');

  const antes = await pedir('GET', '/eu', { token: tokenPagante });
  conferir(antes.dados.plano === 'free', 'antes de pagar continua no grátis');

  const aviso = await pedir('POST', '/webhook/mercadopago', { corpo: { type: 'subscription_preapproval', data: { id: 'PA-1' } } });
  conferir(aviso.dados.acao === 'pro liberado', 'webhook libera o Pro', JSON.stringify(aviso.dados));

  const depois = await pedir('GET', '/eu', { token: tokenPagante });
  const em30 = new Date(); em30.setDate(em30.getDate() + 30);
  conferir(depois.dados.plano === 'pro', 'aluno vira assinante');
  conferir(depois.dados.proAte === em30.toISOString().slice(0, 10), `assinatura de 30 dias (${depois.dados.proAte})`);

  const repetido = await pedir('POST', '/webhook/mercadopago', { corpo: { type: 'subscription_preapproval', data: { id: 'PA-1' } } });
  conferir(repetido.dados.acao === 'já processado', 'aviso repetido é ignorado');
  const conferindo = await pedir('GET', '/eu', { token: tokenPagante });
  conferir(conferindo.dados.proAte === depois.dados.proAte, 'a data não foi estendida duas vezes');

  const renov = await pedir('POST', '/webhook/mercadopago', { corpo: { type: 'subscription_authorized_payment', data: { id: 'PG-9' } } });
  conferir(renov.dados.acao === 'pro liberado', 'renovação estende a assinatura');
  const renovado = await pedir('GET', '/eu', { token: tokenPagante });
  conferir(renovado.dados.proAte > depois.dados.proAte, `renovação somou dias (${renovado.dados.proAte})`);

  const ignorado = await pedir('POST', '/webhook/mercadopago', { corpo: { type: 'plan', data: { id: 'X' } } });
  conferir(ignorado.status === 200, 'aviso desconhecido não quebra o servidor');

  const ia = await pedir('POST', '/ia', { token: tokenPagante, corpo: { system: 'a', conteudo: 'b' } });
  conferir(ia.status === 200, 'quem pagou consegue usar o MindTrack AI');
}

console.log('\n== pagamento por Pix ==');
{
  const e = await pedir('POST', '/entrar', { corpo: { teste: { id: 'aluno-pix', email: 'pix@casa.com', nome: 'Pix' } } });
  const t = e.dados.token;
  const p = await pedir('POST', '/pagar', { token: t, corpo: { planoId: 'semanal', forma: 'unico' } });
  conferir(p.status === 200, 'abre o checkout do plano semanal');

  const aviso = await pedir('POST', '/webhook/mercadopago', { corpo: { type: 'payment', data: { id: 'PG-PIX' } } });
  conferir(aviso.dados.acao === 'pro liberado', 'Pix aprovado libera o Pro na hora');

  const eu = await pedir('GET', '/eu', { token: t });
  const em7 = new Date(); em7.setDate(em7.getDate() + 7);
  conferir(eu.dados.plano === 'pro' && eu.dados.proAte === em7.toISOString().slice(0, 10), `7 dias de Pro pelo Pix (${eu.dados.proAte})`);

  const repetido = await pedir('POST', '/webhook/mercadopago', { corpo: { type: 'payment', data: { id: 'PG-PIX' } } });
  conferir(repetido.dados.acao === 'já processado', 'aviso de Pix repetido é ignorado');
}

console.log('\n== Pix com QR dentro do app ==');
{
  const e = await pedir('POST', '/entrar', { corpo: { teste: { id: 'aluno-qr', email: 'qr@casa.com', nome: 'QR' } } });
  const t = e.dados.token;

  const semEmail = await pedir('POST', '/pagar/pix', { token: t, corpo: { planoId: 'semanal', email: 'nao-e-email' } });
  conferir(semEmail.status === 400, 'e-mail inválido é recusado antes de criar a cobrança');

  const { status, dados } = await pedir('POST', '/pagar/pix', { token: t, corpo: { planoId: 'semanal' } });
  conferir(status === 200, 'cria a cobrança Pix');
  conferir(dados.codigo.startsWith('000201'), 'devolve o código copia-e-cola');
  conferir(dados.valorNoCodigo === 7.90, 'o valor já vem dentro do código Pix (R$ 7,90)', String(dados.valorNoCodigo));
  conferir(dados.qrBase64.length > 10, 'devolve a imagem do QR Code');
  conferir(dados.status === 'pending', 'começa como pendente');

  const primeira = await pedir('GET', `/pagamento/${dados.id}`, { token: t });
  conferir(primeira.dados.status === 'pending' && primeira.dados.plano === 'free', 'enquanto não paga, continua no grátis');

  const segunda = await pedir('GET', `/pagamento/${dados.id}`, { token: t });
  conferir(segunda.dados.status === 'approved', 'a consulta detecta o pagamento');
  conferir(segunda.dados.liberadoAgora === true, 'e libera o Pro na hora, sem esperar o webhook');
  const em7 = new Date(); em7.setDate(em7.getDate() + 7);
  conferir(segunda.dados.proAte === em7.toISOString().slice(0, 10), `7 dias liberados (${segunda.dados.proAte})`);

  const terceira = await pedir('GET', `/pagamento/${dados.id}`, { token: t });
  conferir(terceira.dados.liberadoAgora === false && terceira.dados.plano === 'pro', 'consultar de novo não soma dias de novo');

  const outro = await pedir('POST', '/entrar', { corpo: { teste: { id: 'bisbilhoteiro', email: 'x@x.com', nome: 'X' } } });
  const espiada = await pedir('GET', `/pagamento/${dados.id}`, { token: outro.dados.token });
  conferir(espiada.status === 403, 'ninguém consulta o pagamento de outra pessoa');

  const ia = await pedir('POST', '/ia', { token: t, corpo: { system: 'a', conteudo: 'b' } });
  conferir(ia.status === 200, 'quem pagou por Pix usa o MindTrack AI na hora');
}

console.log('\n== cartão dentro do app ==');
{
  const e = await pedir('POST', '/entrar', { corpo: { teste: { id: 'aluno-cartao', email: 'card@casa.com', nome: 'Card' } } });
  const t = e.dados.token;

  const chave = await pedir('GET', '/pagamento/chave-publica');
  conferir(chave.dados.chave === 'APP_USR-publica' && chave.dados.formularioNoApp, 'entrega a chave pública (a que pode ir para o navegador)');

  const semToken = await pedir('POST', '/pagar/cartao', { token: t, corpo: { planoId: 'mensal', cartao: {} } });
  conferir(semToken.status === 400, 'sem o token do cartão, recusa');

  const r = await pedir('POST', '/pagar/cartao', {
    token: t,
    corpo: { planoId: 'mensal', cartao: { token: 'tok-123', metodo: 'visa', parcelas: 1, email: 'card@casa.com' } },
  });
  conferir(r.status === 200 && r.dados.status === 'approved', 'cartão aprovado', r.dados.detalhe || r.dados.erro);
  conferir(r.dados.plano === 'pro', 'libera o Pro na mesma resposta, sem esperar webhook');

  const recusado = await pedir('POST', '/pagar/cartao', {
    token: t, corpo: { planoId: 'semanal', cartao: { token: 'token-recusado', metodo: 'visa', email: 'x@x.com' } },
  });
  conferir(recusado.dados.status === 'rejected', 'cartão recusado volta como recusado, sem liberar nada');

  const eu = await pedir('GET', '/eu', { token: t });
  const em30 = new Date(); em30.setDate(em30.getDate() + 30);
  conferir(eu.dados.proAte === em30.toISOString().slice(0, 10), `continua com os 30 dias do cartão aprovado (${eu.dados.proAte})`);
}

console.log('\n== plano Plus (código PROFESSOR) ==');
let tokenPlus;
{
  const e = await pedir('POST', '/entrar', { corpo: { teste: { id: 'aluno-plus', email: 'plus@casa.com', nome: 'Plus' } } });
  tokenPlus = e.dados.token;
  const cod = await pedir('POST', '/codigo', { token: tokenPlus, corpo: { codigo: 'PROFESSOR' } });
  conferir(cod.dados.plano === 'plus', 'código PROFESSOR libera o Plus', JSON.stringify(cod.dados));
  const eu = await pedir('GET', '/eu', { token: tokenPlus });
  conferir(eu.dados.uso.limiteDiario === 8, 'assinante Plus enxerga o limite maior do Plus', String(eu.dados.uso.limiteDiario));
  conferir(eu.dados.uso.limiteFotosPergunta === 4, 'Plus manda até 4 fotos por pergunta');

  // o Pro para nas 3 perguntas do teste; o Plus segue além
  for (let i = 0; i < 4; i++) await pedir('POST', '/ia', { token: tokenPlus, corpo: { system: 'a', conteudo: `p${i}` } });
  const quinta = await pedir('POST', '/ia', { token: tokenPlus, corpo: { system: 'a', conteudo: 'p5' } });
  conferir(quinta.status === 200, 'Plus continua depois do limite do Pro (5ª pergunta ok)', quinta.dados.erro);
}

console.log('\n== fotos no MindTrack AI ==');
{
  const foto = { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'aGVsbG8=' } };
  const e = await pedir('POST', '/entrar', { corpo: { teste: { id: 'aluno-foto', email: 'foto@casa.com', nome: 'Foto' } } });
  const t = e.dados.token;
  await pedir('POST', '/codigo', { token: t, corpo: { codigo: 'MINDTRACK30' } });

  const demais = await pedir('POST', '/ia', {
    token: t, corpo: { system: 'a', conteudo: [foto, foto, foto, { type: 'text', text: 'resolve' }] },
  });
  conferir(demais.status === 429, 'Pro com 3 fotos na mesma pergunta é barrado (limite 2)', demais.dados.erro);

  const uma = await pedir('POST', '/ia', { token: t, corpo: { system: 'a', conteudo: [foto, { type: 'text', text: 'resolve' }] } });
  conferir(uma.status === 200, 'Pro manda 1 foto numa pergunta', uma.dados.erro);
  conferir(uma.dados.fotosRestamHoje === 1, 'servidor conta as fotos que restam no dia', String(uma.dados.fotosRestamHoje));

  const eu = await pedir('GET', '/eu', { token: t });
  conferir(eu.dados.uso.fotosHoje === 1, 'fotos do dia aparecem no /eu');

  const duas = await pedir('POST', '/ia', { token: t, corpo: { system: 'a', conteudo: [foto, foto, { type: 'text', text: 'e essa?' }] } });
  conferir(duas.status === 429, 'estourar as fotos do dia é barrado (2/dia no teste)', duas.dados.erro);

  const formatoRuim = await pedir('POST', '/ia', {
    token: t, corpo: { system: 'a', conteudo: [{ type: 'image', source: { type: 'base64', media_type: 'image/bmp', data: 'x' } }, { type: 'text', text: 'oi' }] },
  });
  conferir(formatoRuim.status === 400, 'formato de imagem desconhecido é recusado');

  const plusFotos = await pedir('POST', '/ia', {
    token: tokenPlus, corpo: { system: 'a', conteudo: [foto, foto, foto, foto, { type: 'text', text: 'resolve tudo' }] },
  });
  conferir(plusFotos.status === 200, 'Plus manda 4 fotos de uma vez', plusFotos.dados.erro);
}

console.log('\n== modelo por nível ==');
{
  conferir(ultimoModelo === 'claude-haiku-4-5', 'sem configurar nada, o modelo é o Haiku (o que dá lucro)', ultimoModelo);
  process.env.MODELO_PLUS = 'claude-sonnet-5';
  await pedir('POST', '/ia', { token: tokenPlus, corpo: { system: 'a', conteudo: 'modelo?' } });
  conferir(ultimoModelo === 'claude-sonnet-5', 'MODELO_PLUS troca o modelo só do Plus', ultimoModelo);
  delete process.env.MODELO_PLUS;
}

console.log('\n== admin ==');
{
  const semToken = await pedir('GET', '/admin/numeros');
  conferir(semToken.status === 401, 'painel exige ADMIN_TOKEN');
  process.env.ADMIN_TOKEN = 'chave-admin';
  const r = await fetchReal(`${BASE}/admin/numeros?token=chave-admin`);
  const d = await r.json();
  conferir(r.status === 200 && d.usuarios === 10, `painel: ${d.usuarios} usuários, ${d.assinantes} assinante(s), receita R$ ${d.receita}`);
}

console.log('\n== Gemini (a IA grátis) ==');
{
  const e = await pedir('POST', '/entrar', { corpo: { teste: { id: 'aluno-gemini', email: 'gem@casa.com', nome: 'Gem' } } });
  const t = e.dados.token;
  await pedir('POST', '/codigo', { token: t, corpo: { codigo: 'TESTE7' } });

  const chaveClaude = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  process.env.GEMINI_API_KEY = 'AIza-falsa';

  const saude = await pedir('GET', '/saude');
  conferir(saude.dados.provedor === 'gemini' && saude.dados.studyAiPronto === true,
    'sem chave da Claude, o servidor usa o Gemini e o MindTrack AI segue pronto', JSON.stringify(saude.dados.falta));
  conferir(String(saude.dados.modelo).includes('gemini'), 'o modelo do Gemini aparece na saúde', saude.dados.modelo);

  const r = await pedir('POST', '/ia', { token: t, corpo: { system: 'a', conteudo: 'oi pelo gemini' } });
  conferir(r.status === 200 && r.dados.texto.includes('o gemini disse'), 'pergunta respondida pelo Gemini', r.dados.erro || r.dados.texto);
  conferir(ultimoGemini?.model === 'gemini-3.6-flash', 'começa pelo 1º degrau da escada normal (gemini-3.6-flash)', ultimoGemini?.model);
  conferir(ultimoGemini?.pensa === 'low', 'pergunta normal pensa pouco (thinkingLevel low)', String(ultimoGemini?.pensa));

  const foto = { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'aGVsbG8=' } };
  const rf = await pedir('POST', '/ia', { token: t, corpo: { system: 'a', conteudo: [foto, { type: 'text', text: 'que foto é essa?' }] } });
  conferir(rf.status === 200 && ultimoGemini?.temFoto === true, 'a foto vira inline_data no formato do Gemini', rf.dados.erro);

  const rs = await pedir('POST', '/ia', {
    token: t,
    corpo: {
      system: 'a', conteudo: 'me devolve um json',
      schema: { type: 'object', additionalProperties: false, required: ['x'], properties: { x: { type: 'string' } } },
    },
  });
  conferir(rs.status === 200 && rs.dados.texto === '{"x":"ok"}', 'resposta em formato JSON funciona no Gemini', rs.dados.erro);
  conferir(ultimoGemini?.schemaLimpo === true, 'o additionalProperties (que o Gemini rejeita) é removido do schema');

  process.env.ANTHROPIC_API_KEY = chaveClaude;
  const volta = await pedir('GET', '/saude');
  conferir(volta.dados.provedor === 'claude', 'com as duas chaves, a Claude vence (mais estável para assinantes)');
  process.env.PROVEDOR = 'gemini';
  const forcado = await pedir('GET', '/saude');
  conferir(forcado.dados.provedor === 'gemini', 'PROVEDOR=gemini força o Gemini mesmo com a chave da Claude');
  delete process.env.PROVEDOR;
  delete process.env.GEMINI_API_KEY;
}

console.log('\n== escada do Gemini: o modelo bom que dura ==');
{
  const { zerarEscada, limparCache } = await import('../src/ia.js');
  const chaveClaude = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  process.env.GEMINI_API_KEY = 'AIza-falsa';
  let n = 0;
  const aluno = async (codigo = 'TESTE7') => {
    const e = await pedir('POST', '/entrar', { corpo: { teste: { id: `escada-${n++}`, email: 'e@e.com', nome: 'E' } } });
    await pedir('POST', '/codigo', { token: e.dados.token, corpo: { codigo } });
    return e.dados.token;
  };
  const perguntaNova = (t, extra = {}) => pedir('POST', '/ia', { token: t, corpo: { system: 'a', conteudo: `p${Math.random()}`, ...extra } });

  // 1) o melhor esgotou a cota do dia → desce sem o aluno ver erro, e não insiste
  zerarEscada();
  geminiFalha['gemini-3.6-flash'] = { status: 429, msg: 'Quota exceeded for metric: generate_content_free_tier_requests, limit: 20, model: gemini-3.6-flash GenerateRequestsPerDayPerProjectPerModel-FreeTier' };
  let t = await aluno();
  chamadasGemini = [];
  let r = await perguntaNova(t);
  conferir(r.status === 200 && chamadasGemini.join(',') === 'gemini-3.6-flash,gemini-3.5-flash-lite',
    'cota do dia esgotada: desce para o gemini-3.5-flash-lite e responde', chamadasGemini.join(','));
  chamadasGemini = [];
  r = await perguntaNova(t);
  conferir(r.status === 200 && chamadasGemini.join(',') === 'gemini-3.5-flash-lite',
    'na pergunta seguinte nem tenta o esgotado (não gasta chamada)', chamadasGemini.join(','));
  const saude = await pedir('GET', '/saude');
  conferir(!!saude.dados.foraDaCota?.['gemini-3.6-flash'], 'a saúde mostra quem está sem cota e até quando', JSON.stringify(saude.dados.foraDaCota));
  delete geminiFalha['gemini-3.6-flash'];

  // 2) tarefa simples vai direto aos leves; o Plus começa no topo
  zerarEscada();
  chamadasGemini = [];
  r = await perguntaNova(t, { esforco: 'low' });
  conferir(chamadasGemini[0] === 'gemini-3.5-flash-lite' && ultimoGemini.pensa === 'minimal',
    'tarefa simples (esforço baixo) vai direto ao leve, pensando o mínimo', `${chamadasGemini[0]} ${ultimoGemini.pensa}`);
  const tp = await aluno('PROFESSOR');
  chamadasGemini = [];
  r = await perguntaNova(tp);
  conferir(chamadasGemini[0] === 'gemini-3.8-flash', 'assinante Plus começa no melhor (gemini-3.8-flash)', chamadasGemini[0]);

  // 3) modelo que saiu do ar é pulado; modelo que recusa o pensamento tenta de novo sem ele
  zerarEscada();
  geminiFalha['gemini-3.6-flash'] = { status: 404, msg: 'models/gemini-3.6-flash is not found for API version v1beta' };
  chamadasGemini = [];
  r = await perguntaNova(await aluno());
  conferir(r.status === 200 && chamadasGemini.join(',') === 'gemini-3.6-flash,gemini-3.5-flash-lite', 'modelo que sumiu é pulado', chamadasGemini.join(','));
  delete geminiFalha['gemini-3.6-flash'];
  zerarEscada();
  geminiFalha['gemini-3.6-flash'] = { status: 400, msg: 'thinking_level is not supported for this model', soComPensar: true };
  chamadasGemini = [];
  r = await perguntaNova(await aluno());
  conferir(r.status === 200 && chamadasGemini.join(',') === 'gemini-3.6-flash,gemini-3.6-flash' && ultimoGemini.pensa === null,
    'modelo que recusa o thinkingLevel: o mesmo modelo de novo, sem ele', `${chamadasGemini.join(',')} ${ultimoGemini.pensa}`);
  delete geminiFalha['gemini-3.6-flash'];

  // 4) todos sem cota → mensagem clara (e as perguntas rápidas continuam no app)
  zerarEscada();
  for (const m of ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite']) {
    geminiFalha[m] = { status: 429, msg: 'Quota exceeded GenerateRequestsPerDayPerProjectPerModel-FreeTier' };
  }
  r = await perguntaNova(await aluno());
  conferir(r.status === 429 && /limite de hoje/.test(r.dados.erro), 'escada inteira sem cota: aviso de limite do dia', r.dados.erro);
  for (const m of Object.keys(geminiFalha)) delete geminiFalha[m];
  zerarEscada();

  // 5) cache: a mesma pergunta não gasta a IA de novo nem o limite do aluno
  delete process.env.CACHE_IA;
  limparCache();
  t = await aluno();
  chamadasGemini = [];
  const igual = { system: 'Explique de forma simples.', conteudo: 'fotossíntese' };
  const r1 = await pedir('POST', '/ia', { token: t, corpo: igual });
  const r2 = await pedir('POST', '/ia', { token: t, corpo: igual });
  const eu = await pedir('GET', '/eu', { token: t });
  conferir(r1.dados.texto === r2.dados.texto && chamadasGemini.length === 1, 'pergunta repetida volta do cache (1 chamada só)', String(chamadasGemini.length));
  conferir(eu.dados.uso.chamadasHoje === 1, 'a resposta do cache não conta no limite do aluno', String(eu.dados.uso.chamadasHoje));
  const foto = { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'aGVsbG8=' } };
  chamadasGemini = [];
  await pedir('POST', '/ia', { token: t, corpo: { system: 'a', conteudo: [foto, { type: 'text', text: 'x' }] } });
  await pedir('POST', '/ia', { token: t, corpo: { system: 'a', conteudo: [foto, { type: 'text', text: 'x' }] } });
  conferir(chamadasGemini.length === 2, 'pergunta com foto nunca vem do cache', String(chamadasGemini.length));
  process.env.CACHE_IA = '0';

  process.env.ANTHROPIC_API_KEY = chaveClaude;
  delete process.env.GEMINI_API_KEY;
}

console.log('\n== conexões (Google e calendário por link) ==');
{
  const { decifrar } = await import('../src/conexoes.js');
  const volta = 'http://localhost:9999/studylab/';
  const G = 'https://www.googleapis.com/auth/';
  const voltar = async (urlGoogle, code) => {
    const estado = new URL(urlGoogle).searchParams.get('state');
    const r = await fetchReal(`${BASE}/conexoes/google/volta?code=${code}&state=${encodeURIComponent(estado)}`, { redirect: 'manual' });
    const loc = r.headers.get('location') || '';
    return { status: r.status, loc, p: new URLSearchParams(loc.split('?')[1] || '') };
  };

  const cfg = await pedir('GET', '/conexoes/config');
  conferir(cfg.dados.google === true && cfg.dados.drive === null, 'config diz que o Google está ligado (o seletor do Drive precisa da chave)', JSON.stringify(cfg.dados));

  // 1) conta de aparelho não usa as Conexões…
  const ap = await pedir('POST', '/entrar', { corpo: { dispositivo: { id: 'ap_conex', segredo: 's3', nome: 'Lia' } } });
  await pedir('POST', '/codigo', { token: ap.dados.token, corpo: { codigo: 'TESTE7' } });
  let r = await pedir('GET', '/conexoes', { token: ap.dados.token });
  conferir(r.status === 403 && /entre com o Google/i.test(r.dados.erro), 'sem conta Google, as Conexões recusam', `${r.status} ${r.dados.erro}`);
  r = await pedir('POST', '/conexoes/google/iniciar', { token: ap.dados.token, corpo: { servico: 'agenda', volta } });
  conferir(r.status === 403, 'nem dá para começar a ligar a Agenda sem conta');

  // 2) …até entrar com o Google: a conta de aparelho vira conta Google (o plano fica)
  r = await pedir('POST', '/conexoes/google/iniciar', { token: ap.dados.token, corpo: { servico: 'conta', volta } });
  const urlConta = new URL(r.dados.url);
  conferir(urlConta.origin === 'https://accounts.google.com' && urlConta.searchParams.get('redirect_uri') === `${BASE}/conexoes/google/volta`
    && urlConta.searchParams.get('scope') === 'openid email profile', 'entrar: leva ao Google só com nome e e-mail', r.dados.url.slice(0, 80));
  const ruim = await pedir('POST', '/conexoes/google/iniciar', { corpo: { servico: 'conta', volta: 'javascript:alert(1)' } });
  conferir(ruim.status === 400, 'endereço de volta esquisito é recusado');
  google.codigos['cod-lia'] = { sub: 'g-lia', email: 'lia@gmail.com', nome: 'Lia Souza', scope: 'openid email profile' };
  let v = await voltar(r.dados.url, 'cod-lia');
  conferir(v.status === 302 && v.loc.startsWith(`${volta}#/conexoes?entrou=`), 'Google volta para o app com um tíquete', v.loc.slice(0, 70));
  const troca = await pedir('POST', '/conta/troca', { corpo: { ticket: v.p.get('entrou') } });
  conferir(troca.status === 200 && troca.dados.usuario.id === 'ap_conex' && troca.dados.usuario.provedor === 'google'
    && troca.dados.usuario.email === 'lia@gmail.com', 'tíquete vira sessão na MESMA conta, agora Google', JSON.stringify(troca.dados.usuario));
  conferir(troca.dados.plano === 'pro', 'o plano da conta de aparelho continua valendo', troca.dados.plano);
  const deNovo = await pedir('POST', '/conta/troca', { corpo: { ticket: v.p.get('entrou') } });
  conferir(deNovo.status === 401, 'o tíquete só vale uma vez');
  const t = troca.dados.token;

  // 2b) entrar de novo pelo Google (outro aparelho) acha a mesma conta
  r = await pedir('POST', '/conexoes/google/iniciar', { corpo: { servico: 'conta', volta } });
  v = await voltar(r.dados.url, 'cod-lia');
  const outra = await pedir('POST', '/conta/troca', { corpo: { ticket: v.p.get('entrou') } });
  conferir(outra.dados.usuario?.id === 'ap_conex', 'em outro aparelho, o mesmo Google entra na mesma conta', outra.dados.usuario?.id);

  // 3) Google Agenda
  r = await pedir('POST', '/conexoes/google/iniciar', { token: t, corpo: { servico: 'agenda', volta } });
  const ua = new URL(r.dados.url).searchParams;
  conferir(ua.get('access_type') === 'offline' && ua.get('scope').includes(`${G}calendar.events.readonly`) && ua.get('login_hint') === 'lia@gmail.com',
    'Agenda: pede só leitura dos eventos, com acesso contínuo', ua.get('scope'));
  google.codigos['cod-agenda-sem'] = { sub: 'g-lia', email: 'lia@gmail.com', scope: 'openid email', refresh: 'rt-x' };
  v = await voltar(r.dados.url, 'cod-agenda-sem');
  conferir(v.p.get('erro') === 'faltou_permissao' && google.revogados.includes('rt-x'), 'desmarcou a permissão no Google: avisa e não guarda nada');
  google.codigos['cod-agenda'] = { sub: 'g-lia', email: 'lia@gmail.com', scope: `openid email ${G}calendar.events.readonly`, refresh: 'rt-agenda' };
  r = await pedir('POST', '/conexoes/google/iniciar', { token: t, corpo: { servico: 'agenda', volta } });
  v = await voltar(r.dados.url, 'cod-agenda');
  conferir(v.p.get('ok') === 'agenda', 'Agenda conectada', v.loc);
  r = await pedir('POST', '/conexoes/sincronizar', { token: t, corpo: { servico: 'agenda' } });
  const titulos = (r.dados.itens || []).map((i) => `${i.tipo}:${i.titulo}`);
  conferir(r.status === 200 && titulos.join('|') === 'prova:Prova de Matemática|ferias:Férias de julho|evento:Dentista',
    'sincroniza: prova vira prova, férias com período, cancelado fica de fora', titulos.join('|'));
  const ferias = r.dados.itens?.find((i) => i.tipo === 'ferias');
  conferir(ferias && ferias.ate > ferias.data && !r.dados.itens.find((i) => i.titulo === 'Prova de Matemática').ate, 'dia inteiro: o fim do Google (exclusivo) vira o último dia certo');
  conferir(r.dados.itens?.find((i) => i.titulo === 'Dentista')?.hora === '15:30', 'evento com horário guarda a hora');

  // 4) segredo cifrado no banco
  const { conexaoDe } = await import('../src/db.js');
  const guardada = await conexaoDe('ap_conex', 'agenda');
  conferir(guardada && !guardada.segredo.includes('rt-agenda') && decifrar(guardada.segredo) === 'rt-agenda', 'refresh token guardado cifrado');

  // 5) Classroom
  google.codigos['cod-class'] = { sub: 'g-lia-escola', email: 'lia@escola.edu.br', scope: `openid ${G}classroom.courses.readonly ${G}classroom.coursework.me.readonly`, refresh: 'rt-class' };
  r = await pedir('POST', '/conexoes/google/iniciar', { token: t, corpo: { servico: 'classroom', volta } });
  v = await voltar(r.dados.url, 'cod-class');
  r = await pedir('POST', '/conexoes/sincronizar', { token: t, corpo: { servico: 'classroom' } });
  const at = r.dados.atividades || [];
  conferir(at.length === 2 && at[0].materia === 'Biologia 2º A' && at[0].entrega && !at[0].feita && at[1].feita,
    'Classroom: atividades com a turma, a entrega e o que já foi entregue (a velha fica de fora)', JSON.stringify(at).slice(0, 160));
  const lista = await pedir('GET', '/conexoes', { token: t });
  const cl = lista.dados.conexoes?.find((c) => c.servico === 'classroom');
  conferir(cl?.conta === 'lia@escola.edu.br' && !!cl.sincronizadoEm && !JSON.stringify(lista.dados).includes('rt-'),
    'lista mostra a conta da escola (pode ser outro Google) e nunca o token', JSON.stringify(lista.dados).slice(0, 160));

  // 6) Drive: token curto para o seletor
  google.codigos['cod-drive'] = { sub: 'g-lia', email: 'lia@gmail.com', scope: `openid ${G}drive.file`, refresh: 'rt-agenda' };
  r = await pedir('POST', '/conexoes/google/iniciar', { token: t, corpo: { servico: 'drive', volta } });
  await voltar(r.dados.url, 'cod-drive');
  r = await pedir('POST', '/conexoes/google/token', { token: t, corpo: { servico: 'drive' } });
  conferir(r.status === 200 && r.dados.accessToken === 'at-de-rt-agenda', 'Drive: entrega só um acesso curto para escolher os arquivos');

  // 7) remover: só revoga no Google quando nenhuma outra conexão usa o mesmo login
  google.revogados = [];
  await pedir('POST', '/conexoes/remover', { token: t, corpo: { servico: 'drive' } });
  conferir(!google.revogados.includes('rt-agenda') && !!(await conexaoDe('ap_conex', 'agenda')), 'tirar o Drive não derruba a Agenda (mesmo Google)');
  await pedir('POST', '/conexoes/remover', { token: t, corpo: { servico: 'agenda' } });
  conferir(google.revogados.includes('rt-agenda') && !(await conexaoDe('ap_conex', 'agenda')), 'tirar a Agenda revoga no Google e apaga daqui');

  // 8) permissão tirada lá no Google → conexão sai e o app pede para conectar de novo
  const { salvarConexao } = await import('../src/db.js');
  const { cifrar } = await import('../src/conexoes.js');
  await salvarConexao({ usuarioId: 'ap_conex', servico: 'agenda', conta: 'x', segredo: cifrar('rt-revogado') });
  r = await pedir('POST', '/conexoes/sincronizar', { token: t, corpo: { servico: 'agenda' } });
  conferir(r.status === 410 && !(await conexaoDe('ap_conex', 'agenda')), 'permissão revogada no Google: 410 e a conexão some', `${r.status} ${r.dados.erro}`);

  // 9) calendário por link (.ics)
  const http = await import('node:http');
  const amanha = new Date(Date.now() + 86400000).toISOString().slice(0, 10).replace(/-/g, '');
  const ics = ['BEGIN:VCALENDAR', 'X-WR-CALNAME:Colégio Exemplo', 'BEGIN:VEVENT', 'UID:x1', 'SUMMARY:Simulado ENEM',
    `DTSTART;VALUE=DATE:${amanha}`, 'END:VEVENT', 'BEGIN:VEVENT', 'UID:x2', 'SUMMARY:Reunião de pais',
    `DTSTART:${amanha}T220000Z`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const srvIcs = http.createServer((q, s2) => {
    if (q.url === '/pula') { s2.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data' }); return s2.end(); }
    s2.writeHead(200, { 'content-type': 'text/calendar' }); s2.end(q.url === '/nada' ? '<html>oi</html>' : ics);
  });
  await new Promise((ok2) => srvIcs.listen(4799, ok2));
  r = await pedir('POST', '/conexoes/ics', { token: t, corpo: { url: 'http://127.0.0.1:4799/cal.ics' } });
  conferir(r.status === 400 && /não é público/.test(r.dados.erro), 'link para a rede interna é recusado', `${r.status} ${r.dados.erro}`);
  r = await pedir('POST', '/conexoes/ics', { token: t, corpo: { url: 'http://localhost:4799/cal.ics' } });
  conferir(r.status === 400, 'nome que aponta para a própria máquina também', `${r.status} ${r.dados.erro}`);
  process.env.ICS_PERMITIR_LOCAL = '1';     // só no teste: o "calendário da escola" roda aqui mesmo
  const { normalizarLinkIcs } = await import('../src/conexoes.js');
  conferir(normalizarLinkIcs('webcal://p01-caldav.icloud.com/x.ics').startsWith('https://'), 'link webcal (iCloud, Outlook) vira https');
  r = await pedir('POST', '/conexoes/ics', { token: t, corpo: { url: 'http://localhost:4799/cal.ics' } });
  conferir(r.status === 200 && r.dados.nome === 'Colégio Exemplo' && r.dados.itens.map((i) => i.tipo).join() === 'simulado,reuniao',
    'calendário por link: nome e eventos com tipo', JSON.stringify(r.dados).slice(0, 160));
  conferir(r.dados.itens[1].hora === '19:00', 'horário em UTC vira o de Brasília', r.dados.itens[1].hora);
  const icsGuardado = await conexaoDe('ap_conex', 'ics');
  conferir(icsGuardado && !icsGuardado.segredo.includes('4799'), 'o link privado do calendário também fica cifrado');
  r = await pedir('POST', '/conexoes/ics', { token: t, corpo: { url: 'http://localhost:4799/nada' } });
  conferir(r.status === 400 && /não devolveu um calendário/.test(r.dados.erro), 'página que não é calendário: erro claro');
  delete process.env.ICS_PERMITIR_LOCAL;
  r = await pedir('POST', '/conexoes/sincronizar', { token: t, corpo: { servico: 'ics' } });
  conferir(r.status === 400, 'mesmo um link já salvo não consegue ir para a rede interna');
  process.env.ICS_PERMITIR_LOCAL = '1';
  r = await pedir('POST', '/conexoes/ics', { token: t, corpo: { url: 'http://localhost:4799/pula' } });
  delete process.env.ICS_PERMITIR_LOCAL;
  conferir(r.status === 400 && /não é público/.test(r.dados.erro),
    'redirecionamento para endereço interno não é seguido', `${r.status} ${r.dados.erro}`);
  srvIcs.close();
}

console.log('\n== criar conta (nome, e-mail, número, senha, foto) e WhatsApp ==');
{
  const foto = 'data:image/jpeg;base64,' + Buffer.from('foto-fake').toString('base64');
  let r = await pedir('POST', '/conta/criar', { corpo: { nome: 'Gui', email: 'gui@', telefone: '11987654321', senha: '12345678' } });
  conferir(r.status === 400 && /e-mail/.test(r.dados.erro), 'e-mail errado é recusado');
  r = await pedir('POST', '/conta/criar', { corpo: { nome: 'Gui', email: 'gui@escola.com', telefone: '123', senha: '12345678' } });
  conferir(r.status === 400 && /DDD/.test(r.dados.erro), 'número sem DDD é recusado');
  r = await pedir('POST', '/conta/criar', { corpo: { nome: 'Gui', email: 'gui@escola.com', telefone: '11987654321', senha: '123' } });
  conferir(r.status === 400 && /8 caracteres/.test(r.dados.erro), 'senha curta é recusada');

  // o aluno já usava o app pelo aparelho, com o Pro: a conta nova é a MESMA (o plano fica)
  const ap = await pedir('POST', '/entrar', { corpo: { dispositivo: { id: 'ap_conta_email', segredo: 'segredo-123', nome: 'Gui' } } });
  await pedir('POST', '/codigo', { token: ap.dados.token, corpo: { codigo: 'TESTE7' } });
  r = await pedir('POST', '/conta/criar', { token: ap.dados.token, corpo: { nome: 'Guilherme Rodrigues', email: 'Gui@Escola.com', telefone: '(11) 98765-4321', senha: 'senha-forte-1', foto } });
  conferir(r.status === 200 && r.dados.usuario.id === 'ap_conta_email' && r.dados.usuario.provedor === 'email' && r.dados.plano === 'pro',
    'cria a conta na mesma conta do aparelho (o Pro continua)', JSON.stringify(r.dados.usuario));
  conferir(r.dados.usuario.telefone === '5511987654321' && r.dados.usuario.foto === foto, 'guarda o número no formato do WhatsApp e a foto');
  conferir(r.dados.whatsapp === 'desligado' && whatsappEnviados.length === 0, 'sem as chaves do WhatsApp, nada é enviado (e a conta é criada)');
  const { contaPorEmail } = await import('../src/db.js');
  const guardada = await contaPorEmail('gui@escola.com');
  conferir(guardada && !String(guardada.senha_hash).includes('senha-forte-1') && guardada.senha_hash.startsWith('scrypt$'), 'a senha é guardada só como hash');

  r = await pedir('POST', '/conta/criar', { corpo: { nome: 'Outro', email: 'gui@escola.com', telefone: '11911112222', senha: '12345678' } });
  conferir(r.status === 409, 'e-mail repetido: pede para entrar');
  r = await pedir('POST', '/conta/entrar', { corpo: { email: 'GUI@escola.com', senha: 'errada123' } });
  conferir(r.status === 401, 'senha errada não entra');
  r = await pedir('POST', '/conta/entrar', { corpo: { email: 'gui@escola.com', senha: 'senha-forte-1' } });
  conferir(r.status === 200 && r.dados.usuario.id === 'ap_conta_email' && r.dados.plano === 'pro', 'entra com e-mail e senha em outro aparelho (com o plano)');

  // com as chaves, a boas-vindas sai pelo WhatsApp
  process.env.WHATSAPP_TOKEN = 'token-whats'; process.env.WHATSAPP_NUMERO_ID = '1234567890'; process.env.WHATSAPP_TEMPLATE = 'boas_vindas';
  r = await pedir('POST', '/conta/criar', { corpo: { nome: 'Lara Souza', email: 'lara@escola.com', telefone: '21 99876-5432', senha: '12345678' } });
  const w = whatsappEnviados[0];
  conferir(r.dados.whatsapp === 'enviado' && w?.url.includes('/1234567890/messages') && w.corpo.to === '5521998765432'
    && w.corpo.template.name === 'boas_vindas' && w.corpo.template.language.code === 'pt_BR'
    && w.corpo.template.components[0].parameters[0].text === 'Lara' && w.auth === 'Bearer token-whats',
    'com as chaves, manda a boas-vindas no WhatsApp com o primeiro nome', JSON.stringify(w?.corpo));
  delete process.env.WHATSAPP_TOKEN; delete process.env.WHATSAPP_NUMERO_ID; delete process.env.WHATSAPP_TEMPLATE;

  // Conexões: conta de e-mail entra, mas só no Pro
  r = await pedir('POST', '/conexoes/google/iniciar', { token: r.dados.token, corpo: { servico: 'agenda', volta: 'http://localhost:9999/x/' } });
  conferir(r.status === 402 && /Pro/.test(r.dados.erro), 'Conexões são do Pro', `${r.status} ${r.dados.erro}`);
  const pro = await pedir('POST', '/conta/entrar', { corpo: { email: 'gui@escola.com', senha: 'senha-forte-1' } });
  r = await pedir('POST', '/conexoes/google/iniciar', { token: pro.dados.token, corpo: { servico: 'agenda', volta: 'http://localhost:9999/x/' } });
  conferir(r.status === 200 && r.dados.url.startsWith('https://accounts.google.com/'), 'com o Pro, a conta de e-mail liga a Agenda');
}

console.log('\n== amizades, chat, foguinho e duelo em tempo real ==');
{
  const entrar = async (id, nome) => (await pedir('POST', '/entrar', { corpo: { teste: { id, email: `${id}@x.com`, nome } } })).dados.token;
  const ta = await entrar('soc-ana', 'Ana'), tb = await entrar('soc-beto', 'Beto'), tc = await entrar('soc-caio', 'Caio');
  /** Abre o canal de tempo real como o celular faz e junta os eventos. */
  async function canal(token) {
    const { dados } = await pedir('POST', '/tempo-real/ticket', { token });
    const ctrl = new AbortController();
    const r = await fetchReal(`${BASE}/tempo-real?ticket=${encodeURIComponent(dados.ticket)}`, { signal: ctrl.signal });
    const eventos = [];
    (async () => {
      const leitor = r.body.getReader(); const dec = new TextDecoder(); let buf = '';
      try {
        for (;;) {
          const { value, done } = await leitor.read(); if (done) break;
          buf += dec.decode(value, { stream: true });
          let k; while ((k = buf.indexOf('\n\n')) >= 0) {
            const bloco = buf.slice(0, k); buf = buf.slice(k + 2);
            const ev = /^event: (.+)$/m.exec(bloco)?.[1]; const dt = /^data: (.+)$/m.exec(bloco)?.[1];
            if (ev) eventos.push({ ev, dados: JSON.parse(dt) });
          }
        }
      } catch { /* fechou */ }
    })();
    return { eventos, fechar: () => ctrl.abort(), status: r.status, esperar: async (nome, filtro = () => true, ms = 4000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) { const e = eventos.find((x) => x.ev === nome && filtro(x.dados)); if (e) return e.dados; await new Promise((ok) => setTimeout(ok, 15)); }
      return null;
    } };
  }

  // perfil
  let r = await pedir('GET', '/social/amigos', { token: ta });
  conferir(r.status === 412, 'sem perfil, pede para criar o apelido primeiro', String(r.status));
  r = await pedir('POST', '/social/perfil', { token: ta, corpo: { apelido: 'Ana Clara', nome: 'Ana' } });
  conferir(r.status === 400, 'apelido com espaço é recusado');
  r = await pedir('POST', '/social/perfil', { token: ta, corpo: { apelido: 'ana.clara', nome: 'Ana Clara', avatar: '🦊' } });
  conferir(r.status === 200 && r.dados.perfil.apelido === 'ana.clara' && r.dados.perfil.avatar === '🦊', 'cria o perfil com apelido e avatar');
  await pedir('POST', '/social/perfil', { token: tb, corpo: { apelido: 'beto_estuda', nome: 'Beto Silva', avatar: '🐼' } });
  await pedir('POST', '/social/perfil', { token: tc, corpo: { apelido: 'caio', nome: 'Caio' } });
  r = await pedir('POST', '/social/perfil', { token: tc, corpo: { apelido: 'ANA.CLARA', nome: 'x' } });
  conferir(r.status === 409, 'apelido de outra pessoa é recusado (sem diferenciar maiúscula)');

  // busca e pedido
  r = await pedir('GET', '/social/buscar?q=bet', { token: ta });
  conferir(r.dados.resultados?.length === 1 && r.dados.resultados[0].apelido === 'beto_estuda' && r.dados.resultados[0].relacao === 'nenhuma', 'acha pelo começo do apelido');
  r = await pedir('GET', '/social/buscar?q=silva', { token: ta });
  conferir(r.dados.resultados?.[0]?.apelido === 'beto_estuda', 'acha pelo nome');
  const ca = await canal(ta), cb = await canal(tb);
  conferir(ca.status === 200 && cb.status === 200, 'os dois celulares conectam no tempo real');
  r = await pedir('POST', '/social/mensagem', { token: ta, corpo: { para: 'soc-beto', texto: 'oi' } });
  conferir(r.status === 403, 'antes de ser amigo, não dá para mandar mensagem');
  r = await pedir('POST', '/social/amizade', { token: ta, corpo: { apelido: 'beto_estuda' } });
  const pedidoChegou = await cb.esperar('amizade', (d) => d.tipo === 'pedido');
  conferir(r.dados.status === 'enviado' && pedidoChegou?.de?.apelido === 'ana.clara', 'pedido de amizade chega na hora no outro celular');
  r = await pedir('GET', '/social/amigos', { token: tb });
  conferir(r.dados.recebidos?.[0]?.apelido === 'ana.clara', 'aparece em "pedidos recebidos"');
  r = await pedir('POST', '/social/amizade/responder', { token: tb, corpo: { id: 'soc-ana', aceitar: true } });
  const aceitou = await ca.esperar('amizade', (d) => d.tipo === 'aceita');
  conferir(r.dados.status === 'amigos' && !!aceitou, 'aceitar avisa quem pediu');

  // foguinho
  const hoje = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
  await pedir('POST', '/social/atividade', { token: ta, corpo: { sequencia: 5, ultimoDia: hoje } });
  await pedir('POST', '/social/atividade', { token: tb, corpo: { sequencia: 2, ultimoDia: hoje } });
  r = await pedir('GET', '/social/amigos', { token: ta });
  const beto = r.dados.amigos?.find((x) => x.apelido === 'beto_estuda');
  conferir(beto?.sequencia === 2 && beto.fogoJuntos === 1 && beto.online === true, 'mostra o foguinho do amigo, o foguinho juntos e se está online', JSON.stringify(beto));

  // chat
  r = await pedir('POST', '/social/mensagem', { token: ta, corpo: { para: 'soc-beto', texto: 'Bora estudar pra prova? 📚🔥 me chama no 11 98765-4321 ou www.site.com' } });
  const msg = await cb.esperar('mensagem', (d) => d.de === 'soc-ana');
  conferir(msg && msg.texto.includes('📚🔥') && !msg.texto.includes('98765') && msg.texto.includes('[número removido]') && msg.texto.includes('[link removido]'),
    'mensagem com emoji chega na hora, sem telefone e sem link', msg?.texto);
  r = await pedir('GET', '/social/amigos', { token: tb });
  conferir(r.dados.amigos?.[0]?.naoLidas === 1, 'conta a não lida');
  await pedir('POST', '/social/lidas', { token: tb, corpo: { de: 'soc-ana' } });
  r = await pedir('GET', '/social/mensagens/soc-ana', { token: tb });
  conferir(r.dados.mensagens?.length === 1 && r.dados.mensagens[0].lida === true, 'histórico da conversa, marcado como lido');
  r = await pedir('GET', '/social/mensagens/soc-ana', { token: tc });
  conferir(r.status === 403, 'quem não é amigo não lê a conversa');

  // duelo em tempo real
  r = await pedir('POST', '/duelos', { token: ta, corpo: { amigo: 'soc-beto', tema: 'Revolução Francesa' } });
  conferir(r.status === 402, 'duelo com tema livre (IA) é do Pro');
  r = await pedir('POST', '/duelos', { token: ta, corpo: { amigo: 'soc-beto', materia: 'História' } });
  const id = r.dados.duelo?.id;
  const convite = await cb.esperar('duelo:convite', (d) => d.id === id);
  conferir(!!id && convite?.jogadores?.['soc-ana']?.apelido === 'ana.clara', 'convite de duelo chega na hora');
  await pedir('POST', `/duelos/${id}/aceitar`, { token: tb });
  const [ia, ib] = [await ca.esperar('duelo:inicio'), await cb.esperar('duelo:inicio')];
  conferir(ia && ib && ia.total === 5, 'os dois recebem o início ao mesmo tempo');
  let fim = null;
  for (let i = 0; i < 5; i++) {
    const [pa, pb] = [await ca.esperar('duelo:pergunta', (d) => d.i === i), await cb.esperar('duelo:pergunta', (d) => d.i === i)];
    if (i === 0) conferir(pa && pb && pa.enunciado === pb.enunciado && JSON.stringify(pa.opcoes) === JSON.stringify(pb.opcoes) && pa.correta === undefined,
      'mesma pergunta nos dois celulares, sem a resposta certa', pa?.enunciado);
    // Ana responde certo (descobre pela revelação da rodada anterior não dá: chuta 0; Beto chuta 1)
    await pedir('POST', `/duelos/${id}/responder`, { token: ta, corpo: { i, opcao: 0 } });
    if (i === 0) conferir(!!(await cb.esperar('duelo:respondeu', (d) => d.i === 0 && d.quem === 'soc-ana')), 'o outro vê que você respondeu (não o quê)');
    await pedir('POST', `/duelos/${id}/responder`, { token: tb, corpo: { i, opcao: 1 } });
    const rev = await ca.esperar('duelo:revelar', (d) => d.i === i);
    if (i === 0) conferir(rev && typeof rev.correta === 'number' && rev.respostas['soc-ana'] && rev.respostas['soc-beto'], 'revela a certa e o que cada um marcou');
  }
  fim = await ca.esperar('duelo:fim', () => true, 5000);
  const fimB = await cb.esperar('duelo:fim', () => true, 5000);
  conferir(fim && fimB && JSON.stringify(fim.placar) === JSON.stringify(fimB.placar), 'placar final igual nos dois celulares', JSON.stringify(fim?.placar));
  r = await pedir('GET', '/duelos/placar?amigo=soc-beto', { token: ta });
  conferir(r.dados.eu + r.dados.ele + r.dados.empates === 1, 'o duelo fica no histórico');

  // amigo offline não recebe duelo; desistir dá a vitória ao outro
  r = await pedir('POST', '/duelos', { token: ta, corpo: { amigo: 'soc-caio' } });
  conferir(r.status === 403, 'não dá para duelar com quem não é amigo');

  // bloquear corta tudo
  await pedir('POST', '/social/bloquear', { token: tb, corpo: { id: 'soc-ana' } });
  r = await pedir('POST', '/social/mensagem', { token: ta, corpo: { para: 'soc-beto', texto: 'oi?' } });
  conferir(r.status === 403, 'bloqueado: não manda mais mensagem');
  r = await pedir('GET', '/social/buscar?q=beto', { token: ta });
  conferir(!r.dados.resultados?.length, 'e nem acha mais a pessoa na busca');
  r = await pedir('POST', '/social/denunciar', { token: tb, corpo: { id: 'soc-ana', motivo: 'spam' } });
  const { _denunciasMem } = await import('../src/social-db.js');
  conferir(r.status === 200 && _denunciasMem().length === 1, 'denúncia fica guardada');
  ca.fechar(); cb.fechar();
}

console.log(`\n${falhas ? '❌' : '✅'} ${ok} passaram, ${falhas} falharam\n`);
process.exit(falhas ? 1 : 0);
