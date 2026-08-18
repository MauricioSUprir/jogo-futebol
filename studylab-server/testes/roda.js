/* ===== testes/roda.js — testa o servidor de ponta a ponta =====
   Roda em memória, com login simulado e a Claude API dublada.
   Uso: npm run teste                                                          */
process.env.MODO_TESTE = '1';
process.env.SEGREDO = 'segredo-de-teste';
process.env.ANTHROPIC_API_KEY = 'sk-ant-falsa';
process.env.PORT = process.env.PORT || '4711';
process.env.ORIGENS = '*';
process.env.LIMITE_DIARIO = '3';
process.env.MP_ACCESS_TOKEN = 'APP_USR-falso';
delete process.env.DATABASE_URL;

const BASE = `http://localhost:${process.env.PORT}`;

/* ---- dubla a Claude API (o resto passa direto) ---- */
const fetchReal = globalThis.fetch;
let chamadasClaude = 0;
let assinaturasMP = 0;
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
  conferir(planos.dados.planos.length === 3, 'servidor publica os 3 planos');
  conferir(planos.dados.planos.find((p) => p.id === 'mensal').valor === 29.99, 'preço do mensal vem do servidor (R$ 29,99)');

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

console.log('\n== admin ==');
{
  const semToken = await pedir('GET', '/admin/numeros');
  conferir(semToken.status === 401, 'painel exige ADMIN_TOKEN');
  process.env.ADMIN_TOKEN = 'chave-admin';
  const r = await fetchReal(`${BASE}/admin/numeros?token=chave-admin`);
  const d = await r.json();
  conferir(r.status === 200 && d.usuarios === 5, `painel: ${d.usuarios} usuários, ${d.assinantes} assinante(s), receita R$ ${d.receita}`);
}

console.log(`\n${falhas ? '❌' : '✅'} ${ok} passaram, ${falhas} falharam\n`);
process.exit(falhas ? 1 : 0);
