/* ===== store.js — o estado único do KATSEYE Central =====

   Um objeto, uma fonte de verdade. Quem quiser ler chama `st()`; quem quiser
   escrever chama `set(fn)`, que grava e avisa a tela. A gravação no
   localStorage é adiada (debounce) para o app não escrever a cada tecla.

   Pronto para nuvem: `registrarSync()` pluga um adaptador externo que recebe
   o estado a cada mudança. Sem adaptador, tudo continua no aparelho.        */

import { uid, iso, hoje, addDias, cortar } from './util.js';
import { INTEGRANTES, DISCOGRAFIA, FUSOS_PADRAO, GRUPO } from './dados.js';

const CHAVE = 'katseye.central.v1';
const SCHEMA = 1;
const LIMITE_LOG = 300;

/* ---------- estado padrão ---------- */
export function estadoVazio() {
  return {
    schema: SCHEMA,
    perfil: {
      nome: '',
      papel: 'Direção criativa',
      avatar: '',
      biasId: '',                       // integrante favorita, destacada no painel
      criadoEm: new Date().toISOString(),
    },
    prefs: {
      tema: 'escuro',                   // escuro | claro
      acento: '',                       // vazio = gradiente padrão do app
      densidade: 'confortavel',         // confortavel | compacta
      movimento: true,                  // animações ligadas
      fusos: [...FUSOS_PADRAO],
      semanaComeca: 0,                  // 0 = domingo
      abrirEm: 'inicio',
    },
    /* Enciclopédia: só o que o usuário mudou por cima da semente de dados.js */
    integrantesEdit: {},                // { [id]: { campos alterados } }
    integrantesExtra: [],               // integrantes criadas do zero
    lancamentos: [],                    // lançamentos criados/editados pelo usuário
    lancamentosOcultos: [],             // ids da semente que o usuário removeu
    galeria: [],                        // { id, integranteId, fotoId, legenda, em }

    /* Agenda */
    eventos: [],                        // { id, titulo, data, hora, tipo, local, integranteId, nota, repete }
    tarefas: [],                        // { id, titulo, prazo, importancia, esforco, status, tags, integranteId }

    /* Estúdio */
    projetos: [],                       // { id, nome, formato, cfg, atualizadoEm }

    /* Conselheiro */
    conversas: [],                      // { id, titulo, mensagens:[{de,txt,em}], em }
    ia: {
      modo: 'local',                    // local | servidor | chave
      servidor: '',                     // endpoint proxy (POST /conselho)
      chave: '',                        // chave da Anthropic, guardada só neste aparelho
      modelo: 'claude-opus-5',
      usoHoje: 0, usoDia: null,
    },

    /* Sistema */
    log: [],                            // { id, em, icone, titulo, texto, rota }
    lidas: [],
    visto: { boasVindas: false },
  };
}

/* ---------- carregar / salvar ---------- */
let S = estadoVazio();
const ouvintes = new Set();
let sincronizador = null;

export function carregar() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) S = migrar({ ...estadoVazio(), ...JSON.parse(bruto) });
    else { S = estadoVazio(); salvar(); }
  } catch (e) {
    console.warn('Não consegui ler os dados salvos — começando limpo.', e);
    S = estadoVazio();
  }
  aplicarPrefs();
  return S;
}

/** Completa dados antigos com os campos novos, sem perder o que já existia. */
function migrar(d) {
  const base = estadoVazio();
  for (const k of Object.keys(base)) if (d[k] === undefined) d[k] = base[k];
  for (const grupo of ['perfil', 'prefs', 'ia', 'visto']) {
    d[grupo] = { ...base[grupo], ...(d[grupo] || {}) };
  }
  if (!Array.isArray(d.prefs.fusos) || !d.prefs.fusos.length) d.prefs.fusos = [...FUSOS_PADRAO];
  d.schema = SCHEMA;
  return d;
}

let relogio = null;
export function salvar() {
  clearTimeout(relogio);
  relogio = setTimeout(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(S));
    } catch (e) {
      console.error('Não consegui salvar (armazenamento cheio?)', e);
      avisarFalhaDeGravacao(e);
    }
    if (sincronizador) { try { sincronizador(S); } catch (e) { console.warn('Sync falhou', e); } }
  }, 140);
}

let jaAvisouGravacao = false;
function avisarFalhaDeGravacao(e) {
  if (jaAvisouGravacao) return;
  jaAvisouGravacao = true;
  document.dispatchEvent(new CustomEvent('ks:erro-gravacao', { detail: String(e?.message || e) }));
}

export const st = () => S;
export function set(fn) { fn(S); salvar(); emitir(); }
export function emitir() { ouvintes.forEach((f) => { try { f(S); } catch (e) { console.error(e); } }); }
export function aoMudar(f) { ouvintes.add(f); return () => ouvintes.delete(f); }

/**
 * Pluga um destino de nuvem. O adaptador recebe o estado inteiro a cada
 * gravação — quem for implementar decide o que mandar (e com que frequência).
 */
export function registrarSync(fn) { sincronizador = typeof fn === 'function' ? fn : null; }

/* ---------- preferências aplicadas ao documento ---------- */
export function aplicarPrefs() {
  const r = document.documentElement;
  r.setAttribute('data-theme', S.prefs.tema === 'claro' ? 'claro' : 'escuro');
  r.setAttribute('data-densidade', S.prefs.densidade || 'confortavel');
  r.setAttribute('data-movimento', S.prefs.movimento === false ? 'off' : 'on');
  if (S.prefs.acento) {
    r.style.setProperty('--acc', S.prefs.acento);
    r.style.setProperty('--acc-soft', `${S.prefs.acento}28`);
  } else {
    r.style.removeProperty('--acc');
    r.style.removeProperty('--acc-soft');
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', S.prefs.tema === 'claro' ? '#f6f5fb' : '#07070f');
}

/* ---------- registro de atividade ---------- */
/** Toda ação relevante passa por aqui: é o que alimenta o feed e os logs. */
export function registrar(icone, titulo, texto = '', rota = '') {
  set((s) => {
    s.log.unshift({ id: uid('lg'), em: new Date().toISOString(), icone, titulo, texto: cortar(texto, 140), rota });
    if (s.log.length > LIMITE_LOG) s.log.length = LIMITE_LOG;
  });
}

/* ==========================================================
   ENCICLOPÉDIA — semente + edições do usuário
   ========================================================== */
/** A lista final de integrantes: semente com as edições aplicadas por cima. */
export function integrantes() {
  const base = INTEGRANTES.map((m) => ({ ...m, ...(S.integrantesEdit[m.id] || {}), semente: true }));
  return [...base, ...S.integrantesExtra];
}
export const integrantePorId = (id) => integrantes().find((m) => m.id === id) || null;

export function editarIntegrante(id, patch) {
  set((s) => {
    if (s.integrantesExtra.some((m) => m.id === id)) {
      const m = s.integrantesExtra.find((x) => x.id === id);
      Object.assign(m, patch);
    } else {
      s.integrantesEdit[id] = { ...(s.integrantesEdit[id] || {}), ...patch };
    }
  });
}
export function restaurarIntegrante(id) {
  set((s) => { delete s.integrantesEdit[id]; });
}
export const integranteEditada = (id) => Object.keys(S.integrantesEdit[id] || {}).length > 0;

/** Lançamentos: semente (menos os ocultos) + os do usuário, do mais novo ao mais antigo. */
export function lancamentos() {
  const semente = DISCOGRAFIA
    .filter((r) => !S.lancamentosOcultos.includes(r.id))
    .map((r) => ({ ...r, ...(S.lancamentos.find((x) => x.id === r.id) || {}), semente: true }));
  const proprios = S.lancamentos.filter((r) => !DISCOGRAFIA.some((d) => d.id === r.id));
  return [...semente, ...proprios].sort((a, b) => String(b.data).localeCompare(String(a.data)));
}
export function salvarLancamento(rel) {
  set((s) => {
    const i = s.lancamentos.findIndex((x) => x.id === rel.id);
    if (i >= 0) s.lancamentos[i] = { ...s.lancamentos[i], ...rel };
    else s.lancamentos.push({ id: uid('rel'), tipo: 'single', faixas: [], ...rel });
  });
}
export function removerLancamento(id) {
  set((s) => {
    s.lancamentos = s.lancamentos.filter((x) => x.id !== id);
    if (DISCOGRAFIA.some((d) => d.id === id) && !s.lancamentosOcultos.includes(id)) s.lancamentosOcultos.push(id);
  });
}

/* ---------- galeria ---------- */
export function addFotoGaleria({ integranteId = '', fotoId, legenda = '' }) {
  const item = { id: uid('foto'), integranteId, fotoId, legenda, em: new Date().toISOString() };
  set((s) => s.galeria.unshift(item));
  return item;
}
export function removerFotoGaleria(id) {
  set((s) => { s.galeria = s.galeria.filter((f) => f.id !== id); });
}
export const galeriaDe = (integranteId) =>
  S.galeria.filter((f) => !integranteId || f.integranteId === integranteId);

/* ==========================================================
   AGENDA — eventos e tarefas
   ========================================================== */
export const TIPOS_EVENTO = [
  { id: 'comeback', nome: 'Comeback / lançamento', emoji: '💿', cor: '#a855f7' },
  { id: 'show', nome: 'Show / turnê', emoji: '🎤', cor: '#ff4f8b' },
  { id: 'reuniao', nome: 'Reunião', emoji: '🗓️', cor: '#54e0e6' },
  { id: 'conteudo', nome: 'Conteúdo / gravação', emoji: '🎬', cor: '#f0c674' },
  { id: 'aniversario', nome: 'Data especial', emoji: '🎂', cor: '#3ddc97' },
  { id: 'outro', nome: 'Outro', emoji: '📌', cor: '#8b8ab0' },
];
export const tipoEvento = (id) => TIPOS_EVENTO.find((t) => t.id === id) || TIPOS_EVENTO[5];

export function novoEvento(d = {}) {
  const e = {
    id: uid('evt'), titulo: 'Novo compromisso', data: iso(), hora: '',
    tipo: 'outro', local: '', integranteId: '', nota: '', repete: '',
    criadoEm: new Date().toISOString(), ...d,
  };
  set((s) => s.eventos.push(e));
  registrar(tipoEvento(e.tipo).emoji, 'Compromisso criado', e.titulo, '#/agenda');
  return e;
}
export function novaTarefa(d = {}) {
  const t = {
    id: uid('tar'), titulo: 'Nova tarefa', prazo: iso(addDias(hoje(), 2)),
    importancia: 3, esforco: 2, status: 'aberta', tags: [], integranteId: '',
    nota: '', criadaEm: new Date().toISOString(), concluidaEm: null, ...d,
  };
  set((s) => s.tarefas.push(t));
  registrar('✅', 'Tarefa criada', t.titulo, '#/agenda');
  return t;
}
export function concluirTarefa(id, concluida = true) {
  set((s) => {
    const t = s.tarefas.find((x) => x.id === id);
    if (!t) return;
    t.status = concluida ? 'concluida' : 'aberta';
    t.concluidaEm = concluida ? new Date().toISOString() : null;
  });
}
export const tarefasAbertas = () => S.tarefas.filter((t) => t.status !== 'concluida');
export const eventosDe = (dataISO) => S.eventos.filter((e) => e.data === dataISO);

/* ==========================================================
   ESTÚDIO — projetos salvos
   ========================================================== */
export function salvarProjeto(p) {
  const agora = new Date().toISOString();
  let salvo;
  set((s) => {
    const i = s.projetos.findIndex((x) => x.id === p.id);
    if (i >= 0) { s.projetos[i] = { ...s.projetos[i], ...p, atualizadoEm: agora }; salvo = s.projetos[i]; }
    else { salvo = { id: uid('prj'), criadoEm: agora, atualizadoEm: agora, ...p }; s.projetos.unshift(salvo); }
  });
  return salvo;
}
export function removerProjeto(id) {
  set((s) => { s.projetos = s.projetos.filter((p) => p.id !== id); });
}
export const projeto = (id) => S.projetos.find((p) => p.id === id) || null;

/* ==========================================================
   CONSELHEIRO — conversas
   ========================================================== */
export function novaConversa(titulo = 'Nova conversa') {
  const c = { id: uid('cv'), titulo, mensagens: [], em: new Date().toISOString() };
  set((s) => s.conversas.unshift(c));
  return c;
}
export function addMensagem(conversaId, de, txt) {
  set((s) => {
    const c = s.conversas.find((x) => x.id === conversaId);
    if (!c) return;
    c.mensagens.push({ de, txt, em: new Date().toISOString() });
    if (c.titulo === 'Nova conversa' && de === 'me') c.titulo = cortar(txt, 42);
  });
}
export function removerConversa(id) {
  set((s) => { s.conversas = s.conversas.filter((c) => c.id !== id); });
}
export const conversa = (id) => S.conversas.find((c) => c.id === id) || null;

/* ==========================================================
   DADOS — exportar, importar, zerar
   ========================================================== */
export function exportar() {
  return JSON.stringify({ app: 'katseye-central', versao: SCHEMA, em: new Date().toISOString(), estado: S }, null, 2);
}
export function importar(texto) {
  const d = JSON.parse(texto);
  const estado = d?.estado || d;
  if (!estado || typeof estado !== 'object' || !estado.prefs) {
    throw new Error('Esse arquivo não parece um backup do KATSEYE Central.');
  }
  S = migrar({ ...estadoVazio(), ...estado });
  salvar(); aplicarPrefs(); emitir();
}
export function zerar() {
  S = estadoVazio();
  salvar(); aplicarPrefs(); emitir();
}

/** Quanto o app está ocupando neste navegador (aproximado, em bytes). */
export function tamanhoLocal() {
  try { return new Blob([localStorage.getItem(CHAVE) || '']).size; } catch { return 0; }
}

/** Contagem geral, usada nas Configurações e no Command Center. */
export function resumoDados() {
  return {
    eventos: S.eventos.length,
    tarefas: S.tarefas.length,
    projetos: S.projetos.length,
    fotos: S.galeria.length,
    conversas: S.conversas.length,
    lancamentos: lancamentos().length,
    registros: S.log.length,
    bytes: tamanhoLocal(),
  };
}

export { GRUPO };
