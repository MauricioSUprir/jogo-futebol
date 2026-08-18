/* ===== api.js — conversa com o servidor do StudyLab =====
   Só entra em ação quando produto.js → SERVIDOR está preenchido. Sem servidor,
   o app continua funcionando sozinho (conta local e Pro por código no aparelho). */
import { SERVIDOR } from './produto.js';
import { st, set } from './store.js';

export const temServidor = () => !!SERVIDOR;
const url = (rota) => `${SERVIDOR.replace(/\/$/, '')}${rota}`;

async function chamar(rota, { metodo = 'GET', corpo = null, comToken = true, timeout = 150000 } = {}) {
  if (!SERVIDOR) throw new Error('Servidor do StudyLab não configurado.');
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

export const buscarEu = () => chamar('/eu').then(aplicarConta);

export const ativarCodigoNoServidor = (codigo) =>
  chamar('/codigo', { metodo: 'POST', corpo: { codigo } }).then(aplicarConta);

export const cancelarNoServidor = () => chamar('/cancelar', { metodo: 'POST' }).then(aplicarConta);

export const perguntarAoServidor = (pedido) => chamar('/ia', { metodo: 'POST', corpo: pedido });
