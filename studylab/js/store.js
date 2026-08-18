/* ===== store.js — estado único do app, salvo no navegador (localStorage) ===== */
import { uid, iso, today, addDays } from './util.js';
import { seedInicial } from './seed.js';

const KEY = 'studylab.v1';
const SCHEMA = 3;

/* ---------- estado padrão ---------- */
export function estadoVazio() {
  return {
    schema: SCHEMA,
    perfil: { nome: 'Estudante', serie: '8º ano', ano: new Date().getFullYear(), avatar: '🎓', tema: 'escuro' },
    conta: { plano: 'free', desde: iso(), proAte: null },
    prefs: {
      minutosDia: 90,             // quanto pretende estudar por dia
      blocoFoco: 25,              // duração padrão do bloco de foco
      pausaCurta: 5, pausaLonga: 15, ciclosAtePausaLonga: 4,
      metaStreakMin: 10,          // streak exige 10 min OU 5 questões
      metaStreakQuestoes: 5,
      som: 'nenhum',              // ambiente de foco
      notificar: true,
    },
    jogo: { xp: 0, moedas: 0, streak: 0, ultimoDia: null, recordeStreak: 0, conquistas: [], itens: [] },
    ia: { chave: '', modelo: 'claude-opus-5', ligada: false, memoria: [], usoHoje: 0, usoDia: null },
    materias: [], conteudos: [], tarefas: [], provas: [], eventos: [], horario: {},
    flashcards: [], questoes: [], tentativas: [], sessoes: [], notas: [], metas: [],
    anotacoes: [], biblioteca: [], resumos: [], mapas: [], conversas: [],
    lidas: [],  // notificações já lidas
  };
}

/* ---------- carregar / salvar ---------- */
let S = estadoVazio();
const ouvintes = new Set();

export function carregar() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      S = migrar({ ...estadoVazio(), ...d });
    } else {
      S = seedInicial(estadoVazio());
      salvar();
    }
  } catch (e) {
    console.warn('Falha ao ler dados salvos, começando limpo.', e);
    S = seedInicial(estadoVazio());
  }
  aplicarTema();
  return S;
}
function migrar(d) {
  d.schema = SCHEMA;
  // garante que campos novos existam mesmo em dados antigos
  const base = estadoVazio();
  for (const k of Object.keys(base)) if (d[k] === undefined) d[k] = base[k];
  for (const k of Object.keys(base.prefs)) if (d.prefs[k] === undefined) d.prefs[k] = base.prefs[k];
  for (const k of Object.keys(base.jogo)) if (d.jogo[k] === undefined) d.jogo[k] = base.jogo[k];
  for (const k of Object.keys(base.ia)) if (d.ia[k] === undefined) d.ia[k] = base.ia[k];
  return d;
}
let timer = null;
export function salvar() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { console.error('Não consegui salvar (armazenamento cheio?)', e); }
  }, 120);
}
export const st = () => S;
export function set(fn) { fn(S); salvar(); emit(); }
export function emit() { ouvintes.forEach((f) => { try { f(S); } catch (e) { console.error(e); } }); }
export function onChange(f) { ouvintes.add(f); return () => ouvintes.delete(f); }

export function aplicarTema() {
  const raiz = document.documentElement;
  raiz.setAttribute('data-theme', S.perfil.tema === 'claro' ? 'claro' : 'escuro');
  if (S.perfil.acento) raiz.style.setProperty('--acc', S.perfil.acento);
  else raiz.style.removeProperty('--acc');
}

/* ---------- exportar / importar / zerar ---------- */
export function exportar() { return JSON.stringify(S, null, 2); }
export function importar(txt) {
  const d = JSON.parse(txt);
  if (!d || typeof d !== 'object' || !d.perfil) throw new Error('Arquivo não parece ser um backup do StudyLab.');
  S = migrar({ ...estadoVazio(), ...d });
  salvar(); aplicarTema(); emit();
}
export function zerar({ comExemplo = false } = {}) {
  S = comExemplo ? seedInicial(estadoVazio()) : estadoVazio();
  salvar(); aplicarTema(); emit();
}

/* ---------- buscas rápidas ---------- */
export const materia = (id) => S.materias.find((m) => m.id === id) || null;
export const conteudo = (id) => S.conteudos.find((c) => c.id === id) || null;
export const tarefa = (id) => S.tarefas.find((t) => t.id === id) || null;
export const prova = (id) => S.provas.find((p) => p.id === id) || null;
export const conteudosDe = (materiaId) => S.conteudos.filter((c) => c.materiaId === materiaId);
export const tarefasAbertas = () => S.tarefas.filter((t) => t.status !== 'concluido');
export const nomeMateria = (id) => materia(id)?.nome || 'Geral';
export const emojiMateria = (id) => materia(id)?.emoji || '📘';
export const corMateria = (id) => materia(id)?.cor || '#7c5cff';

/* ---------- criação (com padrões) ---------- */
export function novaMateria(d = {}) {
  const m = {
    id: uid('mat'), nome: 'Nova matéria', emoji: '📘', cor: '#7c5cff', professor: '',
    meta: 9, arquivada: false, criadaEm: iso(), ...d,
  };
  set((s) => s.materias.push(m)); return m;
}
export function novoConteudo(d = {}) {
  const c = {
    id: uid('cnt'), materiaId: null, paiId: null, nome: 'Novo conteúdo',
    status: 'novo',                       // novo | estudando | revisar | dificuldade | dominado
    dominio: 0,                           // 0..100 (calculado, mas pode ser ajustado à mão)
    srs: { passo: 0, facilidade: 2.5, proxima: null, repeticoes: 0, falhas: 0, ultima: null },
    criadoEm: iso(), ...d,
  };
  set((s) => s.conteudos.push(c)); return c;
}
export function novaTarefa(d = {}) {
  const t = {
    id: uid('tar'), materiaId: null, titulo: 'Nova tarefa', descricao: '',
    prazo: iso(addDays(today(), 1)), importancia: 3, dificuldade: 3, minutos: 30, valor: 0,
    status: 'aberto',                     // aberto | andamento | quase | concluido
    subtarefas: [], conteudoIds: [], criadaEm: iso(), concluidaEm: null, minutosFeitos: 0, ...d,
  };
  set((s) => s.tarefas.push(t)); return t;
}
export function novaProva(d = {}) {
  const p = {
    id: uid('prv'), materiaId: null, titulo: 'Prova', data: iso(addDays(today(), 7)),
    valor: 10, conteudoIds: [], plano: [], criadaEm: iso(), nota: null, ...d,
  };
  set((s) => s.provas.push(p)); return p;
}
export function novoEvento(d = {}) {
  const e = { id: uid('evt'), tipo: 'aula', titulo: '', data: iso(), hora: '', materiaId: null, refId: null, ...d };
  set((s) => s.eventos.push(e)); return e;
}
export function novoFlashcard(d = {}) {
  const f = {
    id: uid('fc'), materiaId: null, conteudoId: null, frente: '', verso: '', favorito: false,
    srs: { passo: 0, facilidade: 2.5, proxima: iso(), repeticoes: 0, falhas: 0, ultima: null }, criadoEm: iso(), ...d,
  };
  set((s) => s.flashcards.push(f)); return f;
}
export function novaQuestao(d = {}) {
  const q = {
    id: uid('q'), materiaId: null, conteudoId: null, tipo: 'objetiva', dificuldade: 'medio',
    enunciado: '', alternativas: [], correta: 0, resposta: '', explicacao: '', origem: 'manual',
    favorita: false, criadaEm: iso(), ...d,
  };
  set((s) => s.questoes.push(q)); return q;
}
export function registrarTentativa(d) {
  const t = { id: uid('tt'), questaoId: null, conteudoId: null, materiaId: null, acertou: false,
    resposta: '', modo: 'treino', em: new Date().toISOString(), ...d };
  set((s) => s.tentativas.push(t)); return t;
}
export function registrarSessao(d) {
  const s0 = { id: uid('ses'), tipo: 'foco', minutos: 25, materiaId: null, tarefaId: null,
    conteudoId: null, em: new Date().toISOString(), ...d };
  set((s) => s.sessoes.push(s0)); return s0;
}
export function novaNota(d = {}) {
  const n = { id: uid('nt'), materiaId: null, titulo: 'Avaliação', valor: 0, maximo: 10, peso: 1,
    bimestre: 1, data: iso(), ...d };
  set((s) => s.notas.push(n)); return n;
}
export function novoMaterial(d = {}) {
  const m = { id: uid('bib'), materiaId: null, tipo: 'anotacao', titulo: 'Material', conteudo: '',
    url: '', favorito: false, criadoEm: iso(), ...d };
  set((s) => s.biblioteca.push(m)); return m;
}
export function novaMeta(d = {}) {
  const m = { id: uid('meta'), tipo: 'semanal', titulo: 'Nova meta', alvo: 5, atual: 0,
    materiaId: null, prazo: null, criadaEm: iso(), concluida: false, ...d };
  set((s) => s.metas.push(m)); return m;
}
export function remover(colecao, id) {
  set((s) => { const i = s[colecao].findIndex((x) => x.id === id); if (i >= 0) s[colecao].splice(i, 1); });
}
export function atualizar(colecao, id, patch) {
  set((s) => { const o = s[colecao].find((x) => x.id === id); if (o) Object.assign(o, typeof patch === 'function' ? patch(o) : patch); });
}
