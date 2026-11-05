/* ===== social.js — amizades, chat, foguinho e duelos (as regras) =====
   Segurança primeiro (o público é de estudantes):
   - só AMIGOS aceitos conversam e duelam; ninguém manda mensagem para estranho;
   - bloquear desfaz a amizade e corta tudo; denúncia fica guardada;
   - mensagem é só texto e emoji: links e números de telefone saem automaticamente;
   - limites de mensagens, pedidos e duelos por pessoa.                            */
import {
  perfilSocial, perfisPorIds, perfilPorApelido, salvarPerfilSocial, buscarPerfis, registrarAtividade, diasAtivos,
  amizade, amizadesDe, pedirAmizade, aceitarAmizade, apagarAmizade, bloquear, bloqueado, bloqueadosPor, denunciar,
  salvarMensagem, mensagensEntre, marcarLidas, resumoConversas, salvarDuelo, placarEntre,
} from './social-db.js';
import { enviar, estaOnline, abrirCanal, criarTicketTempoReal, lerTicketTempoReal } from './tempo-real.js';
import * as duelo from './duelo.js';
import { MATERIAS_BANCO } from './perguntas-banco.js';

const erro = (msg, status = 400) => Object.assign(new Error(msg), { status });
const hojeBR = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const diaAntes = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) - n * 86400000).toISOString().slice(0, 10);
export const AVATARES = ['🎓', '🦊', '🐼', '🐯', '🦁', '🐸', '🐧', '🦄', '🐙', '🐨', '🐶', '🐱', '🚀', '⚡', '🔥', '🌟', '🎧', '🎮', '⚽', '🏀', '🎨', '📚', '🧠', '💜'];

/* ---------- limites simples na memória ---------- */
const contadores = new Map();
function limite(chave, max, janelaMs, msg) {
  const agora = Date.now();
  const lista = (contadores.get(chave) || []).filter((t) => agora - t < janelaMs);
  if (lista.length >= max) throw erro(msg, 429);
  lista.push(agora);
  contadores.set(chave, lista);
  if (contadores.size > 20000) contadores.clear();
}

/** Mensagem segura: sem link, sem telefone, sem espaço sobrando, até 500 caracteres. */
export function limparTexto(t) {
  let s = String(t || '').replace(/\s+/g, ' ').trim().slice(0, 500);
  s = s.replace(/\b(?:https?:\/\/|www\.)\S+/gi, '[link removido]')
    .replace(/\b[\w.-]+\.(?:com|net|org|br|io|me|app|gg|xyz|link)(?:\/\S*)?\b/gi, '[link removido]')
    .replace(/(?:\+?\d[\s().-]?){8,}/g, '[número removido]');
  return s;
}

/** A sequência só vale se estudou hoje ou ontem. */
const sequenciaValida = (p) => (p && p.ultimoDia && p.ultimoDia >= diaAntes(hojeBR(), 1) ? p.sequencia : 0);

/** Foguinho da amizade: dias seguidos em que OS DOIS estudaram (até hoje ou ontem). */
async function fogoJuntos(x, y) {
  const desde = diaAntes(hojeBR(), 90);
  const [dx, dy] = await Promise.all([diasAtivos(x, desde), diasAtivos(y, desde)]);
  const ambos = new Set(dx.filter((d) => dy.includes(d)));
  let dia = hojeBR();
  if (!ambos.has(dia)) dia = diaAntes(dia, 1);
  let n = 0;
  while (ambos.has(dia)) { n++; dia = diaAntes(dia, 1); }
  return n;
}

const cartao = (p) => p && ({ id: p.id, apelido: p.apelido, nome: p.nome, avatar: p.avatar, sequencia: sequenciaValida(p), online: estaOnline(p.id) });

export function criarRotasSociais({ exigirAluno, lerCorpo, temIA, gerarPerguntasIA, ehPago }) {
  async function eu(req) {
    const aluno = await exigirAluno(req);
    const perfil = await perfilSocial(aluno.id);
    if (!perfil) throw erro('Crie seu perfil de amigos primeiro (apelido e avatar).', 412);
    return { aluno, perfil };
  }
  async function exigirAmigo(meuId, outroId) {
    const a = await amizade(meuId, outroId);
    if (!a || a.status !== 'aceita') throw erro('Vocês ainda não são amigos.', 403);
    if (await bloqueado(meuId, outroId)) throw erro('Não é possível falar com essa pessoa.', 403);
  }
  async function avisarAmigosOnline(usuarioId, online) {
    const lista = await amizadesDe(usuarioId);
    for (const r of lista) if (r.status === 'aceita') enviar(r.a === usuarioId ? r.b : r.a, 'amigo:online', { id: usuarioId, online });
  }

  // grava cada duelo no histórico
  duelo.quandoTerminar(salvarDuelo);

  const rotas = {
    'GET /social/eu': async (req) => {
      const aluno = await exigirAluno(req);
      return { perfil: await perfilSocial(aluno.id), avatares: AVATARES };
    },

    'POST /social/perfil': async (req) => {
      const aluno = await exigirAluno(req);
      const c = await lerCorpo(req);
      const apelido = String(c.apelido || '').trim().toLowerCase();
      if (!/^[a-z0-9_.]{3,20}$/.test(apelido)) throw erro('Apelido com 3 a 20 letras, números, ponto ou _ (sem espaço).');
      const nome = String(c.nome || '').replace(/\s+/g, ' ').trim().slice(0, 40) || apelido;
      const avatar = AVATARES.includes(c.avatar) ? c.avatar : '🎓';
      const p = await salvarPerfilSocial({ usuarioId: aluno.id, apelido, nome, avatar });
      if (!p) throw erro('Esse apelido já é de outra pessoa. Tente outro.', 409);
      return { perfil: p };
    },

    /* o app conta quando o aluno estudou: vira o foguinho dele e o da amizade */
    'POST /social/atividade': async (req) => {
      const { aluno, perfil } = await eu(req);
      const c = await lerCorpo(req);
      const sequencia = Math.max(0, Math.min(3650, Number(c.sequencia) || 0));
      const estudouHoje = c.ultimoDia === hojeBR();
      await registrarAtividade(aluno.id, { sequencia, dia: estudouHoje ? hojeBR() : null });
      return { ok: true, sequencia, estudouHoje, apelido: perfil.apelido };
    },

    'GET /social/buscar': async (req, url) => {
      const { aluno } = await eu(req);
      const q = String(url.searchParams.get('q') || '').trim();
      limite(`busca:${aluno.id}`, 30, 60000, 'Muitas buscas seguidas. Espere um pouco.');
      const bloq = new Set(await bloqueadosPor(aluno.id));
      const achados = (await buscarPerfis(q)).filter((p) => p.id !== aluno.id && !bloq.has(p.id));
      const rel = new Map((await amizadesDe(aluno.id)).map((r) => [r.a === aluno.id ? r.b : r.a, r]));
      return {
        resultados: achados.map((p) => {
          const r = rel.get(p.id);
          return { ...cartao(p), relacao: !r ? 'nenhuma' : r.status === 'aceita' ? 'amigos' : r.solicitante === aluno.id ? 'enviado' : 'recebido' };
        }),
      };
    },

    'GET /social/amigos': async (req) => {
      const { aluno, perfil } = await eu(req);
      const lista = await amizadesDe(aluno.id);
      const outros = lista.map((r) => (r.a === aluno.id ? r.b : r.a));
      const perfis = new Map((await perfisPorIds(outros)).map((p) => [p.id, p]));
      const conversas = await resumoConversas(aluno.id);
      const amigos = [], recebidos = [], enviados = [];
      for (const r of lista) {
        const outro = r.a === aluno.id ? r.b : r.a;
        const p = perfis.get(outro);
        if (!p) continue;
        if (r.status === 'aceita') {
          const conv = conversas.get(outro) || { naoLidas: 0, ultima: null };
          amigos.push({ ...cartao(p), fogoJuntos: await fogoJuntos(aluno.id, outro), naoLidas: conv.naoLidas, ultima: conv.ultima, desde: r.aceitaEm });
        } else if (r.solicitante === aluno.id) enviados.push(cartao(p));
        else recebidos.push(cartao(p));
      }
      amigos.sort((x, y) => (y.ultima?.em || y.desde || '').localeCompare(x.ultima?.em || x.desde || ''));
      return { eu: { ...cartao(perfil) }, amigos, recebidos, enviados };
    },

    /* pedir por apelido; se a outra pessoa já tinha pedido, vira amizade na hora */
    'POST /social/amizade': async (req) => {
      const { aluno, perfil } = await eu(req);
      const { apelido } = await lerCorpo(req);
      const alvo = await perfilPorApelido(apelido);
      if (!alvo || alvo.id === aluno.id) throw erro('Não achei ninguém com esse apelido.', 404);
      if (await bloqueado(aluno.id, alvo.id)) throw erro('Não é possível adicionar essa pessoa.', 403);
      limite(`pedido:${aluno.id}`, 30, 86400000, 'Muitos pedidos hoje. Tente amanhã.');
      const r = await amizade(aluno.id, alvo.id);
      if (r?.status === 'aceita') return { status: 'amigos' };
      if (r && r.solicitante !== aluno.id) {
        await aceitarAmizade(aluno.id, alvo.id);
        enviar(alvo.id, 'amizade', { tipo: 'aceita', de: cartao(perfil) });
        return { status: 'amigos' };
      }
      if (!r) await pedirAmizade(aluno.id, alvo.id);
      enviar(alvo.id, 'amizade', { tipo: 'pedido', de: cartao(perfil) });
      return { status: 'enviado' };
    },

    'POST /social/amizade/responder': async (req) => {
      const { aluno, perfil } = await eu(req);
      const { id, aceitar } = await lerCorpo(req);
      const r = await amizade(aluno.id, String(id));
      if (!r || r.status !== 'pendente' || r.solicitante === aluno.id) throw erro('Esse pedido não existe mais.', 404);
      if (aceitar) {
        await aceitarAmizade(aluno.id, String(id));
        enviar(String(id), 'amizade', { tipo: 'aceita', de: cartao(perfil) });
        return { status: 'amigos' };
      }
      await apagarAmizade(aluno.id, String(id));
      return { status: 'recusado' };
    },

    'POST /social/amizade/desfazer': async (req) => {
      const { aluno } = await eu(req);
      const { id } = await lerCorpo(req);
      await apagarAmizade(aluno.id, String(id));
      enviar(String(id), 'amizade', { tipo: 'desfeita', id: aluno.id });
      return { ok: true };
    },

    'POST /social/bloquear': async (req) => {
      const { aluno } = await eu(req);
      const { id } = await lerCorpo(req);
      if (!id || String(id) === aluno.id) throw erro('Pessoa inválida.');
      await bloquear(aluno.id, String(id));
      await apagarAmizade(aluno.id, String(id));
      enviar(String(id), 'amizade', { tipo: 'desfeita', id: aluno.id });
      return { ok: true };
    },

    'POST /social/denunciar': async (req) => {
      const { aluno } = await eu(req);
      const { id, motivo, mensagemId } = await lerCorpo(req);
      if (!id) throw erro('Pessoa inválida.');
      limite(`denuncia:${aluno.id}`, 10, 86400000, 'Muitas denúncias hoje.');
      await denunciar({ de: aluno.id, alvo: String(id), motivo: String(motivo || '').slice(0, 300), mensagemId: Number(mensagemId) || null });
      console.warn(`🚩 denúncia: ${aluno.id} → ${id} (${String(motivo || '').slice(0, 80)})`);
      return { ok: true };
    },

    'POST /social/mensagem': async (req) => {
      const { aluno } = await eu(req);
      const { para, texto } = await lerCorpo(req);
      await exigirAmigo(aluno.id, String(para));
      limite(`msg:${aluno.id}`, 20, 60000, 'Calma! Muitas mensagens seguidas.');
      const limpo = limparTexto(texto);
      if (!limpo) throw erro('Mensagem vazia.');
      const m = await salvarMensagem(aluno.id, String(para), limpo);
      enviar(String(para), 'mensagem', m);
      enviar(aluno.id, 'mensagem', m);              // os outros aparelhos de quem mandou
      return { mensagem: m };
    },

    'POST /social/lidas': async (req) => {
      const { aluno } = await eu(req);
      const { de } = await lerCorpo(req);
      await marcarLidas(aluno.id, String(de));
      enviar(String(de), 'lidas', { por: aluno.id });
      return { ok: true };
    },

    'POST /tempo-real/ticket': async (req) => {
      const { aluno } = await eu(req);
      return { ticket: await criarTicketTempoReal(aluno.id) };
    },

    /* ---------- duelos ---------- */
    'GET /duelos/materias': async () => ({ materias: MATERIAS_BANCO }),

    'POST /duelos': async (req) => {
      const { aluno, perfil } = await eu(req);
      const { amigo, tema, materia } = await lerCorpo(req);
      await exigirAmigo(aluno.id, String(amigo));
      if (!estaOnline(String(amigo))) throw erro('Seu amigo não está com o MindTrack aberto agora.', 409);
      limite(`duelo:${aluno.id}`, 20, 3600000, 'Muitos duelos nesta hora. Descanse um pouco!');
      const temaLivre = String(tema || '').trim().slice(0, 80);
      if (temaLivre) {
        if (!(await ehPago(aluno.id))) throw erro('Duelo com tema livre (a IA cria as perguntas) é do MindTrack Pro.', 402);
        limite(`dueloIA:${aluno.id}`, 10, 86400000, 'Você já fez 10 duelos com tema livre hoje.');
      }
      const outro = await perfilSocial(String(amigo));
      const d = duelo.convidar({
        de: aluno.id, para: String(amigo), tema: temaLivre, materia: MATERIAS_BANCO.includes(materia) ? materia : '',
        jogadores: { [aluno.id]: { apelido: perfil.apelido, avatar: perfil.avatar }, [outro.id]: { apelido: outro.apelido, avatar: outro.avatar } },
      });
      return { duelo: { id: d.id, status: d.status } };
    },

    'GET /duelos/placar': async (req, url) => {
      const { aluno } = await eu(req);
      return placarEntre(aluno.id, String(url.searchParams.get('amigo') || ''));
    },
  };

  const dinamicas = [
    {
      padrao: /^GET \/social\/mensagens\/([\w.-]+)$/,
      async executar(req, url, [outro]) {
        const { aluno } = await eu(req);
        await exigirAmigo(aluno.id, outro);
        const antes = Number(url.searchParams.get('antes')) || null;
        return { mensagens: await mensagensEntre(aluno.id, outro, { antes, limite: 50 }) };
      },
    },
    {
      padrao: /^POST \/duelos\/(dl_[\w-]+)\/(aceitar|recusar|responder|sair)$/,
      async executar(req, url, [id, acao]) {
        const { aluno } = await eu(req);
        if (acao === 'aceitar') {
          return { duelo: await duelo.aceitar(id, aluno.id, async (d) => (d.tema && temIA() ? gerarPerguntasIA(d.tema) : null)) };
        }
        if (acao === 'recusar') { duelo.recusar(id, aluno.id); return { ok: true }; }
        if (acao === 'sair') { duelo.sair(id, aluno.id); return { ok: true }; }
        const { i, opcao } = await lerCorpo(req);
        return duelo.responder(id, aluno.id, i, opcao);
      },
    },
  ];

  /** GET /tempo-real?ticket=… — o canal de eventos (não passa pelo json() do servidor). */
  async function abrirTempoReal(req, res, url) {
    const usuarioId = await lerTicketTempoReal(url.searchParams.get('ticket'));
    if (!usuarioId) { res.writeHead(401, { 'content-type': 'application/json' }); res.end('{"erro":"Faça login de novo."}'); return; }
    const jaEstava = estaOnline(usuarioId);
    abrirCanal(usuarioId, req, res, (id) => { if (!estaOnline(id)) avisarAmigosOnline(id, false).catch(() => {}); });
    if (!jaEstava) avisarAmigosOnline(usuarioId, true).catch(() => {});
  }

  return { rotas, dinamicas, abrirTempoReal };
}
