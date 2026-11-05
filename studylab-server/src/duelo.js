/* ===== duelo.js — combate de quiz em tempo real entre dois amigos =====
   O SERVIDOR é o juiz: sorteia as perguntas, manda a mesma pergunta ao mesmo
   tempo para os dois celulares, cronometra, guarda a resposta certa até o fim
   da rodada (ninguém consegue espiar) e soma os pontos por acerto + rapidez.

   convite ──aceitar──▶ contagem (3 s) ──▶ pergunta i (15 s) ──▶ revelar (2,5 s) ──▶ … ──▶ fim
   Os tempos podem ser acelerados nos testes com DUELO_ESCALA (0,05 = 20× mais rápido). */
import crypto from 'node:crypto';
import { enviar } from './tempo-real.js';
import { sortearPerguntas, embaralharOpcoes } from './perguntas-banco.js';

const escala = () => Number(process.env.DUELO_ESCALA) || 1;
const T = () => ({
  convite: 60000 * escala(), contagem: 3000 * escala(), pergunta: 15000 * escala(), revelar: 2500 * escala(), limpar: 120000 * escala(),
});
export const TOTAL_PERGUNTAS = 5;

const duelos = new Map();          // id → estado (fica na memória: um duelo dura ~1,5 min)
let aoTerminar = async () => {};   // gravar no banco (social.js liga)
export const quandoTerminar = (f) => { aoTerminar = f; };
export const dueloAtual = (id) => duelos.get(id) || null;

/** O que cada um vê do duelo (sem a resposta certa da pergunta em andamento). */
function publico(d) {
  return {
    id: d.id, status: d.status, tema: d.tema, materia: d.materia, total: d.total,
    jogadores: d.jogadores, placar: d.placar, i: d.i,
  };
}
const paraOsDois = (d, evento, dados) => { enviar(d.a, evento, dados); enviar(d.b, evento, dados); };

/** Cria o convite. `jogadores` = { [id]: { apelido, avatar } } para mostrar na tela. */
export function convidar({ de, para, jogadores, tema = '', materia = '' }) {
  for (const d of duelos.values()) {
    const comEles = [d.a, d.b].includes(de) || [d.a, d.b].includes(para);
    if (comEles && ['convite', 'contagem', 'jogando'].includes(d.status)) {
      if (d.status === 'convite' && d.a === de && d.b === para) return d;   // convite repetido: o mesmo
      throw Object.assign(new Error('Um de vocês já está num duelo. Espere terminar.'), { status: 409 });
    }
  }
  const d = {
    id: `dl_${crypto.randomUUID().slice(0, 12)}`, a: de, b: para, tema: String(tema || '').slice(0, 80), materia,
    jogadores, status: 'convite', total: TOTAL_PERGUNTAS, perguntas: null, i: -1,
    placar: { [de]: 0, [para]: 0 }, acertos: { [de]: 0, [para]: 0 }, respostas: [], timer: null, criado: Date.now(),
  };
  duelos.set(d.id, d);
  enviar(para, 'duelo:convite', { ...publico(d), de });
  d.timer = setTimeout(() => {
    if (d.status !== 'convite') return;
    d.status = 'expirado';
    paraOsDois(d, 'duelo:cancelado', { id: d.id, motivo: 'O convite expirou.' });
    duelos.delete(d.id);
  }, T().convite);
  return d;
}

/** O convidado aceita: as perguntas são geradas e a contagem começa. */
export async function aceitar(id, quem, gerarPerguntas) {
  const d = duelos.get(id);
  if (!d || d.status !== 'convite') throw Object.assign(new Error('Esse convite não vale mais.'), { status: 404 });
  if (quem !== d.b) throw Object.assign(new Error('Esse convite não é para você.'), { status: 403 });
  clearTimeout(d.timer);
  d.status = 'preparando';
  paraOsDois(d, 'duelo:preparando', publico(d));
  let perguntas = null;
  try { perguntas = await gerarPerguntas(d); } catch { perguntas = null; }
  if (!perguntas || perguntas.length < TOTAL_PERGUNTAS) perguntas = sortearPerguntas(TOTAL_PERGUNTAS, d.materia);
  d.perguntas = perguntas.slice(0, TOTAL_PERGUNTAS).map((q) => embaralharOpcoes(q));
  d.status = 'contagem';
  paraOsDois(d, 'duelo:inicio', { ...publico(d), comecaEm: T().contagem });
  d.timer = setTimeout(() => proxima(d), T().contagem);
  return publico(d);
}

export function recusar(id, quem) {
  const d = duelos.get(id);
  if (!d || d.status !== 'convite' || ![d.a, d.b].includes(quem)) return;
  clearTimeout(d.timer);
  d.status = 'recusado';
  paraOsDois(d, 'duelo:cancelado', { id, motivo: quem === d.b ? 'Convite recusado.' : 'Convite cancelado.' });
  duelos.delete(id);
}

function proxima(d) {
  if (!['contagem', 'jogando'].includes(d.status)) return;
  d.i++;
  if (d.i >= d.total) return terminar(d);
  d.status = 'jogando';
  const q = d.perguntas[d.i];
  d.respostas[d.i] = {};
  d.inicio = Date.now();
  paraOsDois(d, 'duelo:pergunta', {
    id: d.id, i: d.i, total: d.total, enunciado: q.enunciado, opcoes: q.opcoes, materia: q.materia || d.materia, tempo: T().pergunta,
  });
  d.timer = setTimeout(() => revelar(d), T().pergunta + 300);   // + folga da rede
}

/** Resposta de um jogador. Pontos: 100 por acerto + até 100 pela rapidez. */
export function responder(id, quem, i, opcao) {
  const d = duelos.get(id);
  if (!d || d.status !== 'jogando' || ![d.a, d.b].includes(quem)) throw Object.assign(new Error('Esse duelo não está rolando.'), { status: 409 });
  if (Number(i) !== d.i) return { ignorada: true };              // chegou atrasada (a rodada já passou)
  const r = d.respostas[d.i];
  if (r[quem]) return { ignorada: true };                        // só vale a primeira
  const ms = Math.max(0, Date.now() - d.inicio);
  const certo = Number(opcao) === d.perguntas[d.i].correta;
  const pontos = certo ? 100 + Math.round(100 * Math.max(0, 1 - ms / T().pergunta)) : 0;
  r[quem] = { opcao: Number(opcao), certo, pontos, ms };
  d.placar[quem] += pontos;
  if (certo) d.acertos[quem]++;
  paraOsDois(d, 'duelo:respondeu', { id, i: d.i, quem });        // o outro só sabe QUE respondeu
  if (r[d.a] && r[d.b]) { clearTimeout(d.timer); revelar(d); }
  return { ok: true };
}

function revelar(d) {
  if (d.status !== 'jogando') return;
  const q = d.perguntas[d.i];
  paraOsDois(d, 'duelo:revelar', {
    id: d.id, i: d.i, correta: q.correta, explicacao: q.explicacao || '', respostas: d.respostas[d.i], placar: d.placar,
  });
  d.timer = setTimeout(() => proxima(d), T().revelar);
}

async function terminar(d, { desistiu = null } = {}) {
  clearTimeout(d.timer);
  d.status = 'fim';
  let vencedor = null;
  if (desistiu) vencedor = desistiu === d.a ? d.b : d.a;
  else if (d.placar[d.a] !== d.placar[d.b]) vencedor = d.placar[d.a] > d.placar[d.b] ? d.a : d.b;
  paraOsDois(d, 'duelo:fim', { id: d.id, placar: d.placar, acertos: d.acertos, vencedor, desistiu, total: d.total });
  try { await aoTerminar({ id: d.id, a: d.a, b: d.b, tema: d.tema || d.materia, placarA: d.placar[d.a], placarB: d.placar[d.b], vencedor }); } catch { /* segue */ }
  setTimeout(() => duelos.delete(d.id), T().limpar);
}

/** Sair no meio: o outro ganha. */
export function sair(id, quem) {
  const d = duelos.get(id);
  if (!d || ![d.a, d.b].includes(quem)) return;
  if (d.status === 'convite') return recusar(id, quem);
  if (['contagem', 'jogando', 'preparando'].includes(d.status)) terminar(d, { desistiu: quem });
}

export const _duelos = duelos;
