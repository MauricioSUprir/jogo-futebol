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
process.env.FREIO_IP = '5000';          // o freio por IP não atrapalha o teste
process.env.MP_ACCESS_TOKEN = 'APP_USR-falso';
process.env.MP_PUBLIC_KEY = 'APP_USR-publica';
delete process.env.DATABASE_URL;

const BASE = `http://localhost:${process.env.PORT}`;
const { montarBRCode } = await import('./brcode.js');

/* ---- dubla a Claude API (o resto passa direto) ---- */
const fetchReal = globalThis.fetch;
let chamadasClaude = 0;
let ultimoModelo = '';
let assinaturasMP = 0;
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
  conferir(ia.status === 200, 'e usa o Study AI normalmente');
}

console.log('\n== o que falta configurar ==');
{
  const { dados } = await pedir('GET', '/saude');
  conferir(Array.isArray(dados.falta), 'servidor diz o que ainda falta configurar');
  conferir(dados.studyAiPronto === true, 'checklist: Study AI pronto');
  conferir(dados.falta.some((f) => f.includes('DATABASE_URL')), 'checklist aponta o banco faltando no teste');
}

console.log('\n== paywall ==');
{
  const antes = chamadasClaude;
  const { status, dados } = await pedir('POST', '/ia', { token, corpo: { system: 'oi', conteudo: 'teste' } });
  conferir(status === 402, 'sem assinatura, o Study AI é bloqueado', `${status} ${dados.erro}`);
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

console.log('\n== Study AI ==');
{
  const antes = chamadasClaude;
  const { status, dados } = await pedir('POST', '/ia', { token, corpo: { system: 'Você é o Study AI', conteudo: 'o que estudo agora?' } });
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
  conferir(ia.status === 200, 'quem pagou consegue usar o Study AI');
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
  conferir(ia.status === 200, 'quem pagou por Pix usa o Study AI na hora');
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

console.log('\n== fotos no Study AI ==');
{
  const foto = { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'aGVsbG8=' } };
  const e = await pedir('POST', '/entrar', { corpo: { teste: { id: 'aluno-foto', email: 'foto@casa.com', nome: 'Foto' } } });
  const t = e.dados.token;
  await pedir('POST', '/codigo', { token: t, corpo: { codigo: 'STUDYLAB30' } });

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

console.log(`\n${falhas ? '❌' : '✅'} ${ok} passaram, ${falhas} falharam\n`);
process.exit(falhas ? 1 : 0);
