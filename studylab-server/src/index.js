/* ===== index.js — servidor do StudyLab =====
   Rotas:
     GET  /saude          está no ar?
     POST /entrar         { idToken } -> sessão de 30 dias + assinatura
     GET  /eu             quem sou eu, meu plano e meu uso de hoje
     POST /codigo         { codigo } -> ativa o Pro
     POST /ia             o Study AI (só para assinante)
     POST /cancelar       cancela a assinatura
     GET  /admin/numeros  ?token=ADMIN_TOKEN
     POST /admin/codigo   cria um código                                       */
import http from 'node:http';
import {
  migrar, salvarUsuario, assinaturaAtiva, criarAssinatura, cancelarAssinatura,
  usarCodigo, criarCodigo, usoDoDia, usoDoMes, registrarUso, numeros, emMemoria,
} from './db.js';
import { verificarGoogle, criarSessao, alunoDaRequisicao } from './auth.js';
import { perguntar, modeloPadrao } from './ia.js';

const PORTA = Number(process.env.PORT) || 3000;
const LIMITE_DIARIO = Number(process.env.LIMITE_DIARIO) || 40;
const LIMITE_MENSAL = Number(process.env.LIMITE_MENSAL) || 400;
const MODO_TESTE = process.env.MODO_TESTE === '1';
const ORIGENS = (process.env.ORIGENS || 'https://mauriciosuprir.github.io')
  .split(',').map((o) => o.trim()).filter(Boolean);

/* ---------- utilidades ---------- */
function cors(req, res) {
  const origem = req.headers.origin || '';
  const ok = ORIGENS.includes('*') || ORIGENS.includes(origem);
  if (ok) res.setHeader('access-control-allow-origin', origem || '*');
  res.setHeader('vary', 'origin');
  res.setHeader('access-control-allow-headers', 'content-type, authorization');
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  res.setHeader('access-control-max-age', '86400');
  return ok;
}
function json(res, status, dados) {
  const corpo = JSON.stringify(dados);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(corpo) });
  res.end(corpo);
}
async function lerCorpo(req, limite = 300000) {
  const partes = []; let total = 0;
  for await (const p of req) {
    total += p.length;
    if (total > limite) throw Object.assign(new Error('Pedido grande demais'), { status: 413 });
    partes.push(p);
  }
  if (!partes.length) return {};
  try { return JSON.parse(Buffer.concat(partes).toString('utf8')); }
  catch { throw Object.assign(new Error('JSON inválido'), { status: 400 }); }
}
const resumoAssinatura = (a) => (a
  ? { plano: 'pro', planoId: a.plano, proAte: a.fim, origem: a.origem }
  : { plano: 'free', planoId: null, proAte: null, origem: null });

/* ---------- freio simples por IP (evita abuso na porta de entrada) ---------- */
const batidas = new Map();
function muitasBatidas(ip, limite = 60, janela = 60000) {
  const agora = Date.now();
  const lista = (batidas.get(ip) || []).filter((t) => agora - t < janela);
  lista.push(agora); batidas.set(ip, lista);
  if (batidas.size > 5000) batidas.clear();
  return lista.length > limite;
}

/* ---------- rotas ---------- */
const rotas = {
  'GET /saude': async () => ({
    ok: true, banco: emMemoria ? 'memoria' : 'postgres', modelo: modeloPadrao(),
    chaveConfigurada: !!process.env.ANTHROPIC_API_KEY, googleConfigurado: !!process.env.GOOGLE_CLIENT_ID,
  }),

  'POST /entrar': async (req) => {
    const corpo = await lerCorpo(req);
    let dados;
    if (MODO_TESTE && corpo.teste) {
      // atalho SÓ para os testes automatizados (MODO_TESTE=1). Nunca em produção.
      dados = { id: String(corpo.teste.id), email: corpo.teste.email || '', nome: corpo.teste.nome || '', foto: '' };
    } else {
      const { idToken } = corpo;
      if (!idToken) throw Object.assign(new Error('Falta o idToken do Google'), { status: 400 });
      try { dados = await verificarGoogle(idToken); }
      catch (e) { throw Object.assign(new Error(`Login do Google recusado: ${e.message}`), { status: 401 }); }
    }
    const usuario = await salvarUsuario(dados);
    const token = await criarSessao(dados);
    const assinatura = await assinaturaAtiva(dados.id);
    return { token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, foto: usuario.foto }, ...resumoAssinatura(assinatura) };
  },

  'GET /eu': async (req) => {
    const aluno = await exigirAluno(req);
    const [assinatura, uso] = await Promise.all([assinaturaAtiva(aluno.id), usoDoDia(aluno.id)]);
    return {
      usuario: { id: aluno.id, nome: aluno.nome, email: aluno.email },
      ...resumoAssinatura(assinatura),
      uso: { chamadasHoje: uso.chamadas, limiteDiario: LIMITE_DIARIO, limiteMensal: LIMITE_MENSAL },
    };
  },

  'POST /codigo': async (req) => {
    const aluno = await exigirAluno(req);
    const { codigo } = await lerCorpo(req);
    const achado = await usarCodigo(codigo);
    if (!achado) throw Object.assign(new Error('Código inválido ou já esgotado'), { status: 404 });
    const a = await criarAssinatura({
      usuarioId: aluno.id, plano: 'codigo', dias: achado.dias, origem: 'codigo', referencia: achado.codigo,
    });
    return { ...resumoAssinatura(a), dias: achado.dias };
  },

  'POST /cancelar': async (req) => {
    const aluno = await exigirAluno(req);
    await cancelarAssinatura(aluno.id);
    return resumoAssinatura(null);
  },

  'POST /ia': async (req) => {
    const aluno = await exigirAluno(req);
    const assinatura = await assinaturaAtiva(aluno.id);
    if (!assinatura) throw Object.assign(new Error('O Study AI faz parte do plano Pro.'), { status: 402 });

    const [uso, doMes] = await Promise.all([usoDoDia(aluno.id), usoDoMes(aluno.id)]);
    if (uso.chamadas >= LIMITE_DIARIO) {
      throw Object.assign(new Error(`Você usou as ${LIMITE_DIARIO} perguntas de hoje. Volte amanhã.`), { status: 429 });
    }
    if (doMes >= LIMITE_MENSAL) {
      throw Object.assign(new Error(`Você chegou ao limite de ${LIMITE_MENSAL} perguntas do mês.`), { status: 429 });
    }

    const { system, conteudo, schema, maxTokens, esforco } = await lerCorpo(req);
    if (!system || !conteudo) throw Object.assign(new Error('Pedido incompleto'), { status: 400 });

    const r = await perguntar({ system, conteudo, schema, maxTokens, esforco });
    await registrarUso(aluno.id, r.uso);
    return { texto: r.texto, restamHoje: Math.max(0, LIMITE_DIARIO - uso.chamadas - 1) };
  },

  'GET /admin/numeros': async (req, url) => {
    exigirAdmin(url);
    return numeros();
  },

  'POST /admin/codigo': async (req, url) => {
    exigirAdmin(url);
    const { codigo, dias, usosMax } = await lerCorpo(req);
    if (!codigo || !dias) throw Object.assign(new Error('Informe codigo e dias'), { status: 400 });
    return criarCodigo({ codigo, dias: Number(dias), usosMax: Number(usosMax) || 1 });
  },
};

async function exigirAluno(req) {
  const aluno = await alunoDaRequisicao(req);
  if (!aluno) throw Object.assign(new Error('Faça login de novo.'), { status: 401 });
  return aluno;
}
function exigirAdmin(url) {
  const esperado = process.env.ADMIN_TOKEN;
  if (!esperado || url.searchParams.get('token') !== esperado) {
    throw Object.assign(new Error('Não autorizado'), { status: 401 });
  }
}

/* ---------- servidor ---------- */
const servidor = http.createServer(async (req, res) => {
  const permitido = cors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(permitido ? 204 : 403); return res.end(); }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const chave = `${req.method} ${url.pathname.replace(/\/+$/, '') || '/saude'}`;
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?';

  if (!permitido && req.headers.origin) return json(res, 403, { erro: 'Origem não autorizada' });
  if (muitasBatidas(ip)) return json(res, 429, { erro: 'Calma aí — muitas chamadas seguidas.' });

  const rota = rotas[chave];
  if (!rota) return json(res, 404, { erro: 'Rota não encontrada' });

  try {
    const saida = await rota(req, url);
    json(res, 200, saida);
  } catch (e) {
    const status = e.status || 500;
    if (status >= 500) console.error(chave, e);
    json(res, status, { erro: e.message || 'Erro inesperado' });
  }
});

migrar()
  .then(() => servidor.listen(PORTA, () => {
    console.log(`StudyLab no ar em :${PORTA}`);
    console.log(`  banco: ${emMemoria ? 'MEMÓRIA (só para testes)' : 'postgres'}`);
    console.log(`  modelo: ${modeloPadrao()} · limites: ${LIMITE_DIARIO}/dia, ${LIMITE_MENSAL}/mês`);
    console.log(`  chave da Claude: ${process.env.ANTHROPIC_API_KEY ? 'ok' : 'FALTANDO'}`);
    console.log(`  origens liberadas: ${ORIGENS.join(', ')}`);
    if (MODO_TESTE) console.warn('  ⚠️  MODO_TESTE=1 — o login pode ser simulado. NUNCA use isso em produção.');
  }))
  .catch((e) => { console.error('Falha ao preparar o banco:', e); process.exit(1); });
