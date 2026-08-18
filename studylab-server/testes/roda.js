/* ===== testes/roda.js — testa o servidor de ponta a ponta =====
   Roda em memória, com login simulado e a Claude API dublada.
   Uso: npm run teste                                                          */
process.env.MODO_TESTE = '1';
process.env.SEGREDO = 'segredo-de-teste';
process.env.ANTHROPIC_API_KEY = 'sk-ant-falsa';
process.env.PORT = process.env.PORT || '4711';
process.env.ORIGENS = '*';
process.env.LIMITE_DIARIO = '3';
delete process.env.DATABASE_URL;

const BASE = `http://localhost:${process.env.PORT}`;

/* ---- dubla a Claude API (o resto passa direto) ---- */
const fetchReal = globalThis.fetch;
let chamadasClaude = 0;
globalThis.fetch = async (url, opcoes) => {
  if (String(url).includes('api.anthropic.com')) {
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

console.log('\n== paywall ==');
{
  const { status, dados } = await pedir('POST', '/ia', { token, corpo: { system: 'oi', conteudo: 'teste' } });
  conferir(status === 402, 'sem assinatura, o Study AI é bloqueado', `${status} ${dados.erro}`);
  conferir(chamadasClaude === 0, 'nada é gasto na Claude API antes de pagar');
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
  const { status, dados } = await pedir('POST', '/ia', { token, corpo: { system: 'Você é o Study AI', conteudo: 'o que estudo agora?' } });
  conferir(status === 200, 'assinante consegue perguntar', `${status} ${dados.erro || ''}`);
  conferir(dados.texto?.includes('o que estudo agora?'), 'resposta chega no app');
  conferir(chamadasClaude === 1, 'a chamada foi para a Claude API uma única vez');
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

console.log('\n== admin ==');
{
  const semToken = await pedir('GET', '/admin/numeros');
  conferir(semToken.status === 401, 'painel exige ADMIN_TOKEN');
  process.env.ADMIN_TOKEN = 'chave-admin';
  const r = await fetchReal(`${BASE}/admin/numeros?token=chave-admin`);
  const d = await r.json();
  conferir(r.status === 200 && d.usuarios === 2, `painel mostra ${d.usuarios} usuários e ${d.assinantes} assinantes`);
}

console.log(`\n${falhas ? '❌' : '✅'} ${ok} passaram, ${falhas} falharam\n`);
process.exit(falhas ? 1 : 0);
