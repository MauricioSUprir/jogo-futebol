/* ===== social.js — amigos, chat e duelos (conversa com o servidor) =====
   O tempo real é um EventSource (SSE): uma conexão aberta enquanto o app está
   aberto. Quem quiser ouvir algo usa ouvir('mensagem', fn) — devolve o "parar". */
import { st, set } from './store.js';
import { temServidor, enderecoServidor, garantirSessao } from './api.js';

async function chamar(rota, { metodo = 'GET', corpo = null } = {}) {
  if (!temServidor()) throw new Error('O servidor do MindTrack não está configurado.');
  await garantirSessao();
  const r = await fetch(`${enderecoServidor()}${rota}`, {
    method: metodo,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${st().conta.token}` },
    body: corpo ? JSON.stringify(corpo) : undefined,
  }).catch(() => { throw new Error('Sem conexão com o servidor. Verifique a internet.'); });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.erro || `Erro ${r.status}`), { status: r.status });
  return d;
}

export const meuPerfil = () => chamar('/social/eu');
export const salvarPerfil = (p) => chamar('/social/perfil', { metodo: 'POST', corpo: p });
export const listarAmigos = () => chamar('/social/amigos');
export const buscar = (q) => chamar(`/social/buscar?q=${encodeURIComponent(q)}`);
export const pedirAmizade = (apelido) => chamar('/social/amizade', { metodo: 'POST', corpo: { apelido } });
export const responderPedido = (id, aceitar) => chamar('/social/amizade/responder', { metodo: 'POST', corpo: { id, aceitar } });
export const desfazerAmizade = (id) => chamar('/social/amizade/desfazer', { metodo: 'POST', corpo: { id } });
export const bloquear = (id) => chamar('/social/bloquear', { metodo: 'POST', corpo: { id } });
export const denunciar = (id, motivo, mensagemId = null) => chamar('/social/denunciar', { metodo: 'POST', corpo: { id, motivo, mensagemId } });
export const mensagens = (id) => chamar(`/social/mensagens/${encodeURIComponent(id)}`);
export const mandarMensagem = (para, texto) => chamar('/social/mensagem', { metodo: 'POST', corpo: { para, texto } });
export const marcarLidas = (de) => chamar('/social/lidas', { metodo: 'POST', corpo: { de } });
export const materiasDuelo = () => chamar('/duelos/materias');
export const desafiar = (amigo, { materia = '', tema = '' } = {}) => chamar('/duelos', { metodo: 'POST', corpo: { amigo, materia, tema } });
export const aceitarDuelo = (id) => chamar(`/duelos/${id}/aceitar`, { metodo: 'POST' });
export const recusarDuelo = (id) => chamar(`/duelos/${id}/recusar`, { metodo: 'POST' });
export const responderDuelo = (id, i, opcao) => chamar(`/duelos/${id}/responder`, { metodo: 'POST', corpo: { i, opcao } });
export const sairDuelo = (id) => chamar(`/duelos/${id}/sair`, { metodo: 'POST' });
export const placarCom = (amigo) => chamar(`/duelos/placar?amigo=${encodeURIComponent(amigo)}`);

/** Conta para o servidor quando o aluno estudou (o foguinho dos amigos). */
export function contarAtividade() {
  const s = st();
  if (!s.social?.apelido || !temServidor()) return Promise.resolve();
  return chamar('/social/atividade', { metodo: 'POST', corpo: { sequencia: s.jogo.streak || 0, ultimoDia: s.jogo.ultimoDia || null } }).catch(() => {});
}

/* ---------- tempo real ---------- */
const ouvintes = new Map();   // evento → Set<fn>
let fonte = null, tentando = null, abrindo = null;
export function ouvir(evento, fn) {
  if (!ouvintes.has(evento)) ouvintes.set(evento, new Set());
  ouvintes.get(evento).add(fn);
  return () => ouvintes.get(evento)?.delete(fn);
}
const EVENTOS = ['ola', 'mensagem', 'lidas', 'amizade', 'amigo:online', 'duelo:convite', 'duelo:preparando', 'duelo:inicio',
  'duelo:pergunta', 'duelo:respondeu', 'duelo:revelar', 'duelo:fim', 'duelo:cancelado'];

export const conectado = () => fonte?.readyState === 1;

/** Abre (ou mantém) a conexão. Reconecta sozinho se cair. */
export function conectar() {
  if (fonte && fonte.readyState !== 2) return Promise.resolve();
  if (!temServidor() || !st().social?.apelido) return Promise.resolve();
  // duas chamadas juntas (boot + tela de Amigos) abriam DUAS conexões e cada evento chegava em dobro
  if (!abrindo) abrindo = abrir().finally(() => { abrindo = null; });
  return abrindo;
}

async function abrir() {
  try {
    const { ticket } = await chamar('/tempo-real/ticket', { metodo: 'POST' });
    fonte = new EventSource(`${enderecoServidor()}/tempo-real?ticket=${encodeURIComponent(ticket)}`);
    for (const ev of EVENTOS) {
      fonte.addEventListener(ev, (e) => {
        let dados = null;
        try { dados = JSON.parse(e.data); } catch { return; }
        for (const fn of ouvintes.get(ev) || []) { try { fn(dados); } catch (err) { console.error(err); } }
        for (const fn of ouvintes.get('*') || []) { try { fn(ev, dados); } catch (err) { console.error(err); } }
      });
    }
    // o tíquete vale 2 min: se a conexão cair, abre outra com tíquete novo
    fonte.onerror = () => {
      if (fonte.readyState === 2) { fonte = null; clearTimeout(tentando); tentando = setTimeout(conectar, 4000); }
    };
  } catch { clearTimeout(tentando); tentando = setTimeout(conectar, 15000); }
}

export function desconectar() { clearTimeout(tentando); fonte?.close(); fonte = null; abrindo = null; }

export function guardarMeuPerfil(p) {
  set((s) => { s.social = p ? { apelido: p.apelido, nome: p.nome, avatar: p.avatar } : null; });
}
