/* ===== index.js — servidor do KATSEYE Central =====
   Rotas:
     GET  /saude       está no ar? qual provedor e modelo estão ligados?
     POST /conselho    { mensagens } -> { texto }

   É só isso. Sem contas, sem banco, sem pagamento: este app não tem usuários,
   tem uma pessoa com uma chave que não quer publicar a chave.

   O contrato com o app é o que `katseye-central/js/ia.js` já espera:
   POST /conselho, corpo { sistema, mensagens, modelo }, resposta { texto }.
   `sistema` e `modelo` são aceitos e IGNORADOS — quem manda neles é o
   servidor (veja o comentário no topo de ia.js).                           */

import http from 'node:http';
import { perguntar, validar, provedor, temChave, modeloEmUso, SISTEMA } from './ia.js';
import { cobrar, estornar, ipDe, numeros } from './limites.js';

const PORTA = Number(process.env.PORT) || 3000;
const TETO_CORPO = 200000;           // bytes
const SENHA = (process.env.SENHA || '').trim();
const ORIGENS = (process.env.ORIGENS || 'https://mauriciosuprir.github.io')
  .split(',').map((o) => o.trim()).filter(Boolean);

/* ---------- utilidades ---------- */
function cors(req, res) {
  const origem = req.headers.origin || '';
  const liberada = ORIGENS.includes('*') || ORIGENS.includes(origem);
  if (liberada) res.setHeader('access-control-allow-origin', origem || '*');
  res.setHeader('vary', 'origin');
  res.setHeader('access-control-allow-headers', 'content-type, x-senha');
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  res.setHeader('access-control-max-age', '86400');
  return liberada;
}

function json(res, status, dados) {
  const corpo = JSON.stringify(dados);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(corpo),
  });
  res.end(corpo);
}

function lerCorpo(req) {
  return new Promise((ok, falhou) => {
    let total = 0;
    const partes = [];
    req.on('data', (p) => {
      total += p.length;
      if (total > TETO_CORPO) {
        falhou(Object.assign(new Error('Pedido grande demais.'), { status: 413 }));
        req.destroy();
        return;
      }
      partes.push(p);
    });
    req.on('end', () => {
      if (!partes.length) { ok({}); return; }
      try { ok(JSON.parse(Buffer.concat(partes).toString('utf8'))); }
      catch { falhou(Object.assign(new Error('O corpo não é JSON válido.'), { status: 400 })); }
    });
    req.on('error', falhou);
  });
}

/* ---------- rotas ---------- */
async function conselho(req, res) {
  if (SENHA && req.headers['x-senha'] !== SENHA) {
    return json(res, 401, { erro: 'Senha do servidor incorreta.' });
  }

  const ip = ipDe(req);
  const vez = cobrar(ip);
  if (!vez.ok) {
    if (vez.esperar) res.setHeader('retry-after', String(vez.esperar));
    return json(res, vez.status, { erro: vez.erro });
  }

  try {
    const corpo = await lerCorpo(req);
    const mensagens = validar(corpo.mensagens);
    const texto = await perguntar(mensagens);
    return json(res, 200, { texto, modelo: modeloEmUso(), restanteHoje: vez.restanteHoje });
  } catch (e) {
    // erro de validação é culpa de quem chamou e a cobrança fica de pé;
    // erro do provedor não é, então devolve a vez.
    const status = e.status || 500;
    if (status >= 500 || status === 429 || status === 504) estornar(ip);
    if (status >= 500) console.error('[conselho]', e.message);   // nunca loga a chave nem o texto
    return json(res, status, { erro: e.message || 'Erro inesperado.' });
  }
}

const servidor = http.createServer(async (req, res) => {
  const liberada = cors(req, res);

  if (req.method === 'OPTIONS') { res.writeHead(liberada ? 204 : 403); return res.end(); }

  const rota = (req.url || '/').split('?')[0].replace(/\/+$/, '') || '/';

  if (req.method === 'GET' && (rota === '/saude' || rota === '/')) {
    return json(res, 200, {
      ok: true,
      app: 'katseye-server',
      ia: temChave() ? { provedor: provedor(), modelo: modeloEmUso() } : null,
      aviso: temChave() ? undefined : 'Sem GEMINI_API_KEY nem ANTHROPIC_API_KEY: defina uma nas variáveis.',
      origensLiberadas: ORIGENS,
      senhaExigida: !!SENHA,
      uso: numeros(),
      sistemaTem: SISTEMA.length,
    });
  }

  if (req.method === 'POST' && rota === '/conselho') {
    if (!liberada) return json(res, 403, { erro: `Origem "${req.headers.origin || '—'}" não liberada. Ajuste ORIGENS.` });
    return conselho(req, res);
  }

  return json(res, 404, { erro: 'Rota não encontrada. Existem GET /saude e POST /conselho.' });
});

servidor.listen(PORTA, () => {
  const p = provedor();
  console.log(`katseye-server no ar na porta ${PORTA}`);
  console.log(p ? `IA: ${p} (${modeloEmUso()})` : 'IA: NENHUMA CHAVE CONFIGURADA — defina GEMINI_API_KEY');
  console.log(`Origens liberadas: ${ORIGENS.join(', ')}`);
});
