/* ===== api.js — conversa com o servidor do StudyLab =====
   Só entra em ação quando produto.js → SERVIDOR está preenchido. Sem servidor,
   o app continua funcionando sozinho (conta local e Pro por código no aparelho). */
import { SERVIDOR } from './produto.js';
import { st, set } from './store.js';

/** Endereço do servidor: o que o dono digitou nas Configurações vence o padrão do código. */
export const enderecoServidor = () => (st().ia?.servidor || SERVIDOR || '').trim().replace(/\/$/, '');
export const temServidor = () => !!enderecoServidor();
const url = (rota) => `${enderecoServidor()}${rota}`;

async function chamar(rota, { metodo = 'GET', corpo = null, comToken = true, timeout = 150000 } = {}) {
  if (!temServidor()) throw new Error('Servidor do StudyLab não configurado.');
  const token = st().conta.token;
  if (comToken && !token) throw new Error('Entre com o Google para usar o Study AI.');

  const ctrl = new AbortController();
  const relogio = setTimeout(() => ctrl.abort(), timeout);
  let r;
  try {
    r = await fetch(url(rota), {
      method: metodo,
      headers: { 'content-type': 'application/json', ...(comToken ? { authorization: `Bearer ${token}` } : {}) },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(relogio);
    if (e.name === 'AbortError') throw new Error('A resposta demorou demais. Tente de novo.');
    throw new Error('Não consegui falar com o servidor do StudyLab. Verifique sua internet — e, se abriu o app '
      + 'dentro de um preview (Artifact, sandbox, iframe), a política de segurança bloqueia chamadas externas.');
  }
  clearTimeout(relogio);

  const dados = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401) { set((s) => { s.conta.token = null; }); }
    const e = new Error(dados.erro || `Erro ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return dados;
}

/** Guarda no app o que o servidor disse sobre a conta e o plano. */
export function aplicarConta(d) {
  set((s) => {
    if (d.token) s.conta.token = d.token;
    if (d.usuario) {
      s.conta.id = d.usuario.id;
      s.conta.nome = d.usuario.nome || s.conta.nome;
      s.conta.email = d.usuario.email || s.conta.email;
      if (d.usuario.foto) s.conta.foto = d.usuario.foto;
    }
    if (d.plano) {
      s.conta.plano = d.plano;
      s.conta.planoId = d.planoId ?? s.conta.planoId;
      s.conta.proAte = d.proAte ?? null;
    }
  });
  return d;
}

export const entrarNoServidor = (idToken) =>
  chamar('/entrar', { metodo: 'POST', corpo: { idToken }, comToken: false }).then(aplicarConta);

/** Identidade do aparelho: sorteada uma vez e guardada aqui mesmo. */
function credenciaisDoAparelho() {
  const c = st().conta;
  if (c.aparelhoId && c.aparelhoSegredo) return { id: c.aparelhoId, segredo: c.aparelhoSegredo };
  const aleatorio = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now().toString(36));
  const novo = { id: `ap_${aleatorio()}`, segredo: `${aleatorio()}${aleatorio()}` };
  set((s) => { s.conta.aparelhoId = novo.id; s.conta.aparelhoSegredo = novo.segredo; });
  return novo;
}

/** Entra sem Google: o suficiente para usar o Study AI e assinar. */
export function entrarPorAparelho(nome = 'Estudante') {
  const d = credenciaisDoAparelho();
  return chamar('/entrar', { metodo: 'POST', corpo: { dispositivo: { ...d, nome } }, comToken: false }).then(aplicarConta);
}

/** Garante que existe uma sessão válida no servidor antes de pedir algo pago. */
export async function garantirSessao() {
  if (!temServidor()) return null;
  if (st().conta.token) return st().conta.token;
  await entrarPorAparelho(st().perfil?.nome || 'Estudante');
  return st().conta.token;
}

export const buscarEu = () => chamar('/eu').then(aplicarConta);

export const ativarCodigoNoServidor = (codigo) =>
  chamar('/codigo', { metodo: 'POST', corpo: { codigo } }).then(aplicarConta);

export const cancelarNoServidor = () => chamar('/cancelar', { metodo: 'POST' }).then(aplicarConta);

export const perguntarAoServidor = (pedido) => chamar('/ia', { metodo: 'POST', corpo: pedido });

/**
 * Abre o pagamento no Mercado Pago e devolve o link do checkout.
 * forma 'unico' = Pix ou cartão (compra os dias) · 'recorrente' = cartão que renova sozinho.
 */
export const pagarNoServidor = (planoId, forma = 'unico') =>
  chamar('/pagar', { metodo: 'POST', corpo: { planoId, forma } });

/** Cria a cobrança Pix (QR + código copia-e-cola). */
export const criarPixNoServidor = (planoId, email) =>
  chamar('/pagar/pix', { metodo: 'POST', corpo: { planoId, email } });

/** Pergunta ao servidor se o pagamento já caiu. */
export const consultarPagamentoNoServidor = (id) =>
  chamar(`/pagamento/${id}`, { timeout: 20000 }).then((d) => { aplicarConta(d); return d; });

export const saudeDoServidor = () => chamar('/saude', { comToken: false, timeout: 15000 });
