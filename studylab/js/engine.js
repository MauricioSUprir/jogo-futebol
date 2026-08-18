/* ===== engine.js — o "cérebro" do StudyLab =====
   Prioridades, revisão espaçada, índice de domínio, planos de prova,
   divisão de tarefas, XP/níveis, conquistas, streak e notificações.
   Tudo aqui é determinístico e roda offline (não depende de IA).           */
import {
  clamp, round, sum, avg, iso, today, addDays, daysBetween, hoursUntil, parseISO, uid, norm,
} from './util.js';
import { st, set, materia, conteudo, nomeMateria } from './store.js';

/* ==========================================================
   1) MOTOR DE PRIORIDADES
   ========================================================== */
const PESOS = { prazo: 0.42, importancia: 0.18, valor: 0.16, dificuldade: 0.14, tamanho: 0.10 };

/** urgência 0..1 — cai suavemente ao longo de ~14 dias; atrasado = 1 */
export function urgencia(prazo) {
  const h = hoursUntil(prazo);
  if (h <= 0) return 1;
  const dias = h / 24;
  return clamp(1 - Math.log1p(dias) / Math.log1p(14), 0.06, 1);
}

/** Nota de prioridade 0..100 + a explicação de como ela foi montada. */
export function prioridade(t) {
  if (!t || t.status === 'concluido') return { nota: 0, partes: [], atrasada: false };
  const p = {
    prazo: urgencia(t.prazo),
    importancia: clamp((t.importancia || 3) / 5, 0, 1),
    valor: clamp((t.valor || 0) / 4, 0, 1),          // 4 pontos já é "peso cheio"
    dificuldade: clamp((t.dificuldade || 3) / 5, 0, 1),
    tamanho: clamp((t.minutos || 30) / 180, 0, 1),
  };
  let nota = 100 * sum(Object.entries(PESOS).map(([k, w]) => w * p[k]));
  const atrasada = hoursUntil(t.prazo) <= 0;
  if (atrasada) nota = Math.max(nota, 90) + clamp(-daysBetween(today(), parseISO(t.prazo)), 0, 8);
  return {
    nota: clamp(round(nota), 0, 100),
    atrasada,
    partes: [
      { rot: 'Prazo', v: p.prazo, w: PESOS.prazo },
      { rot: 'Importância', v: p.importancia, w: PESOS.importancia },
      { rot: 'Vale nota', v: p.valor, w: PESOS.valor },
      { rot: 'Dificuldade', v: p.dificuldade, w: PESOS.dificuldade },
      { rot: 'Tamanho', v: p.tamanho, w: PESOS.tamanho },
    ],
  };
}

export function faixaPrioridade(n) {
  if (n >= 80) return { cor: '#f87171', cls: 'bad', rot: 'Urgente' };
  if (n >= 60) return { cor: '#fb923c', cls: 'alert', rot: 'Alta' };
  if (n >= 40) return { cor: '#fbbf24', cls: 'warn', rot: 'Média' };
  return { cor: '#34d399', cls: 'ok', rot: 'Tranquila' };
}

/** Tarefas abertas ordenadas por prioridade (maior primeiro). */
export function filaTarefas() {
  return st().tarefas
    .filter((t) => t.status !== 'concluido')
    .map((t) => ({ ...t, _p: prioridade(t) }))
    .sort((a, b) => b._p.nota - a._p.nota);
}

/* ==========================================================
   2) ORDEM RECOMENDADA DO DIA (blocos de estudo)
   Divide tarefas grandes em blocos e alterna matérias para
   não deixar o aluno 2h presos na mesma coisa.
   ========================================================== */
export function ordemRecomendada({ minutos = null, bloco = null } = {}) {
  const s = st();
  const total = minutos ?? s.prefs.minutosDia ?? 90;
  const max = bloco ?? Math.max(20, s.prefs.blocoFoco || 25);
  const fila = filaTarefas().map((t) => ({
    id: t.id, titulo: t.titulo, materiaId: t.materiaId, nota: t._p.nota,
    resta: Math.max(5, (t.minutos || 30) - (t.minutosFeitos || 0)),
  }));
  const blocos = [];
  let usado = 0, ultimaMateria = null;

  while (usado < total && fila.some((t) => t.resta > 0)) {
    const cand = fila.filter((t) => t.resta > 0);
    // prefere a de maior prioridade que NÃO seja da mesma matéria do bloco anterior
    let alvo = cand.find((t) => t.materiaId !== ultimaMateria) || cand[0];
    // ...mas se a top for muito mais prioritária (>18 pontos), ela vence mesmo repetindo
    if (cand[0] !== alvo && cand[0].nota - alvo.nota > 18) alvo = cand[0];

    const dur = Math.min(alvo.resta, max, total - usado);
    if (dur < 5) break;
    blocos.push({ tarefaId: alvo.id, titulo: alvo.titulo, materiaId: alvo.materiaId, minutos: dur, nota: alvo.nota });
    alvo.resta -= dur; usado += dur; ultimaMateria = alvo.materiaId;
    if (usado < total && blocos.length % 2 === 0) {
      const pausa = Math.min(s.prefs.pausaCurta || 5, total - usado);
      if (pausa >= 3) { blocos.push({ pausa: true, minutos: pausa }); usado += pausa; }
    }
  }
  return { blocos, minutosPlanejados: usado, minutosPedidos: total };
}

/** "Faça isso agora": o próximo bloco único (modo anti-procrastinação). */
export function agoraFaca() {
  const { blocos } = ordemRecomendada({ minutos: 240 });
  return blocos.find((b) => !b.pausa) || null;
}

/* ==========================================================
   3) REVISÃO ESPAÇADA (SM-2 simplificado)
   Dia 1 → +1 → +3 → +7 → +14 → +30 → ×2…
   ========================================================== */
export const PASSOS = [1, 3, 7, 14, 30];

export function proximaRevisao(srs, qualidade) {
  // qualidade: 0 = errei feio, 1 = difícil, 2 = ok, 3 = fácil
  const s = { passo: 0, facilidade: 2.5, repeticoes: 0, falhas: 0, ...(srs || {}) };
  if (qualidade <= 0) {
    s.passo = 0; s.falhas++; s.facilidade = clamp(s.facilidade - 0.2, 1.3, 3.0);
    s.proxima = iso(today()); s.ultima = iso(today()); s.repeticoes++;
    return { ...s, intervalo: 0 };
  }
  if (qualidade === 1) s.facilidade = clamp(s.facilidade - 0.12, 1.3, 3.0);
  if (qualidade === 3) s.facilidade = clamp(s.facilidade + 0.10, 1.3, 3.0);
  s.passo = Math.min(s.passo + 1, PASSOS.length + 6);
  const base = s.passo <= PASSOS.length ? PASSOS[s.passo - 1] : PASSOS[PASSOS.length - 1] * 2 ** (s.passo - PASSOS.length);
  const intervalo = Math.max(1, Math.round(base * (s.facilidade / 2.5) * (qualidade === 1 ? 0.6 : 1)));
  s.repeticoes++; s.ultima = iso(today()); s.proxima = iso(addDays(today(), intervalo));
  return { ...s, intervalo };
}

export const venceHoje = (srs) => !srs?.proxima || daysBetween(today(), parseISO(srs.proxima)) <= 0;

export function filaRevisao() {
  const s = st();
  const cards = s.flashcards.filter((f) => venceHoje(f.srs));
  const conteudos = s.conteudos.filter((c) => c.status !== 'novo' && venceHoje(c.srs));
  const erros = questoesErradasPendentes();
  return { cards, conteudos, erros, total: cards.length + conteudos.length + erros.length };
}

/** Banco de erros: questões erradas cuja "reapresentação" já venceu. */
export function questoesErradasPendentes() {
  const s = st();
  const porQuestao = new Map();
  for (const t of s.tentativas) {
    const at = porQuestao.get(t.questaoId) || [];
    at.push(t); porQuestao.set(t.questaoId, at);
  }
  const out = [];
  for (const [qid, ats] of porQuestao) {
    const q = s.questoes.find((x) => x.id === qid); if (!q) continue;
    ats.sort((a, b) => new Date(b.em) - new Date(a.em));
    if (!ats[0].acertou) {
      const dias = daysBetween(new Date(ats[0].em), new Date());
      const acertosSeguidos = 0;
      if (dias >= 2 - acertosSeguidos) out.push({ questao: q, ultima: ats[0], dias });
    }
  }
  return out.sort((a, b) => b.dias - a.dias);
}

export function bancoDeErros() {
  const s = st();
  const map = new Map();
  for (const t of s.tentativas.filter((x) => !x.acertou)) {
    const q = s.questoes.find((x) => x.id === t.questaoId); if (!q) continue;
    const cur = map.get(q.id) || { questao: q, vezes: 0, ultima: t.em, respostas: [] };
    cur.vezes++; cur.respostas.push(t);
    if (new Date(t.em) > new Date(cur.ultima)) cur.ultima = t.em;
    map.set(q.id, cur);
  }
  // "já superou?" = acertou depois do último erro
  const out = [...map.values()].map((e) => {
    const depois = s.tentativas.filter((t) => t.questaoId === e.questao.id && new Date(t.em) > new Date(e.ultima) && t.acertou);
    return { ...e, superado: depois.length > 0 };
  });
  return out.sort((a, b) => b.vezes - a.vezes || new Date(b.ultima) - new Date(a.ultima));
}

/* ==========================================================
   4) ÍNDICE DE DOMÍNIO (0–100) + semáforo
   ========================================================== */
export function semaforo(d) {
  if (d >= 80) return { emoji: '🟢', rot: 'Dominado', cls: 'ok', cor: '#34d399' };
  if (d >= 60) return { emoji: '🟡', rot: 'Revisar', cls: 'warn', cor: '#fbbf24' };
  if (d >= 40) return { emoji: '🟠', rot: 'Atenção', cls: 'alert', cor: '#fb923c' };
  return { emoji: '🔴', rot: 'Prioridade', cls: 'bad', cor: '#f87171' };
}
export const iconeStatus = (s) => ({ dominado: '✅', revisar: '🟡', dificuldade: '🔴', estudando: '🔵', novo: '⚪' }[s] || '⚪');

/** Recalcula o domínio de um conteúdo a partir das evidências reais. */
export function calcularDominio(cid) {
  const s = st();
  const c = conteudo(cid); if (!c) return 0;
  const filhos = s.conteudos.filter((x) => x.paiId === cid);
  if (filhos.length) return round(avg(filhos.map((f) => calcularDominio(f.id))));

  const tents = s.tentativas.filter((t) => t.conteudoId === cid)
    .sort((a, b) => new Date(b.em) - new Date(a.em)).slice(0, 24);

  let base;
  if (tents.length >= 3) {
    let num = 0, den = 0;
    tents.forEach((t, i) => { const w = 0.92 ** i; num += w * (t.acertou ? 1 : 0); den += w; });
    const acerto = num / den;
    // cobertura é medida contra o que existe cadastrado: quem tem 3 questões no banco
    // não pode ser punido por não ter respondido 8.
    const distintas = new Set(tents.map((t) => t.questaoId)).size;
    const cards = s.flashcards.filter((f) => f.conteudoId === cid);
    const cardsRevisados = cards.filter((f) => (f.srs?.repeticoes || 0) > 0).length;
    const alvoQ = Math.min(8, Math.max(3, s.questoes.filter((q) => q.conteudoId === cid).length));
    const alvoC = Math.min(6, Math.max(2, cards.length));
    const cobertura = clamp(distintas / alvoQ, 0, 1) * 0.6 + clamp(cardsRevisados / alvoC, 0, 1) * 0.4;
    const forca = clamp((c.srs?.passo || 0) / 5, 0, 1) - clamp((c.srs?.falhas || 0) * 0.05, 0, 0.3);
    base = 0.60 * acerto + 0.22 * cobertura + 0.18 * clamp(forca, 0, 1);
  } else {
    base = (c.dominio || 0) / 100;                          // ainda sem evidência: mantém o que foi marcado à mão
  }

  // esquecimento: perde valor conforme o tempo desde a última revisão
  const ult = c.srs?.ultima ? parseISO(c.srs.ultima) : null;
  const dias = ult ? Math.max(0, daysBetween(ult, new Date())) : 30;
  const meiaVida = Math.max(3, (PASSOS[Math.min(c.srs?.passo || 0, PASSOS.length - 1)] || 3) * 1.8);
  const retencao = Math.exp(-dias / meiaVida);
  return clamp(round(100 * base * (0.60 + 0.40 * retencao)), 0, 100);
}

export function recalcularDominios() {
  set((s) => {
    for (const c of s.conteudos) {
      const d = calcularDominio(c.id);
      c.dominio = d;
      if (c.status !== 'novo' || d > 0) {
        c.status = d >= 80 ? 'dominado' : d >= 60 ? 'revisar' : d >= 40 ? 'estudando' : d > 0 ? 'dificuldade' : 'novo';
      }
    }
  });
}

export function dominioMateria(mid) {
  const cs = st().conteudos.filter((c) => c.materiaId === mid && !c.paiId);
  return cs.length ? round(avg(cs.map((c) => c.dominio || 0))) : 0;
}

/* ==========================================================
   5) PROVAS: preparo + plano automático + modo recuperação
   ========================================================== */
export function preparoProva(p) {
  const cs = (p.conteudoIds || []).map(conteudo).filter(Boolean);
  const dom = cs.length ? avg(cs.map((c) => c.dominio || 0)) : 0;
  const feitos = (p.plano || []).filter((b) => b.feito).length;
  const totalPlano = (p.plano || []).length;
  const exec = totalPlano ? feitos / totalPlano : 0;
  const preparo = clamp(round(dom * 0.75 + exec * 25), 0, 100);
  return { preparo, dominioMedio: round(dom), conteudos: cs, feitos, totalPlano, dias: daysBetween(today(), parseISO(p.data)) };
}

/** Monta o cronograma dia a dia até a prova, atacando primeiro o que está fraco. */
export function gerarPlanoProva(p, { minutosDia = null } = {}) {
  const s = st();
  const md = minutosDia ?? s.prefs.minutosDia ?? 60;
  const dias = Math.max(1, daysBetween(today(), parseISO(p.data)));
  const cs = (p.conteudoIds || []).map(conteudo).filter(Boolean);
  if (!cs.length) return [];

  // peso: quanto mais fraco, mais tempo recebe
  const pesos = cs.map((c) => ({ c, w: Math.max(10, 100 - (c.dominio || 0)) }));
  const somaW = sum(pesos.map((x) => x.w));
  const diasEstudo = Math.max(1, dias - (dias >= 4 ? 2 : dias >= 2 ? 1 : 0)); // reserva simulado + revisão
  const orcamento = diasEstudo * md;

  const fila = [];
  for (const { c, w } of pesos.sort((a, b) => b.w - a.w)) {
    let min = Math.round((w / somaW) * orcamento);
    while (min > 0) { const bloco = Math.min(min, 45); fila.push({ conteudoId: c.id, minutos: bloco }); min -= bloco; }
  }

  const plano = [];
  let i = 0;
  for (let d = 0; d < dias; d++) {
    const data = iso(addDays(today(), d));
    const faltam = dias - d;
    if (faltam === 1) { plano.push({ id: uid('bl'), data, tipo: 'revisao', titulo: 'Revisão rápida de tudo', minutos: Math.min(40, md), feito: false }); continue; }
    if (faltam === 2 && dias >= 4) { plano.push({ id: uid('bl'), data, tipo: 'simulado', titulo: 'Simulado completo (modo prova)', minutos: Math.min(45, md), feito: false }); continue; }
    let usado = 0;
    while (i < fila.length && usado + fila[i].minutos <= md) {
      const b = fila[i++];
      plano.push({ id: uid('bl'), data, tipo: 'estudo', conteudoId: b.conteudoId, minutos: b.minutos, feito: false,
        titulo: conteudo(b.conteudoId)?.nome || 'Estudo' });
      usado += b.minutos;
      if (usado >= md * 0.75 && plano.filter((x) => x.data === data).length >= 2) break;
    }
    if (usado === 0 && i < fila.length) { const b = fila[i++]; plano.push({ id: uid('bl'), data, tipo: 'estudo', conteudoId: b.conteudoId, minutos: Math.min(b.minutos, md), feito: false, titulo: conteudo(b.conteudoId)?.nome || 'Estudo' }); }
    // fecha o dia com questões quando sobrou espaço
    if (usado > 0 && md - usado >= 15) plano.push({ id: uid('bl'), data, tipo: 'questoes', titulo: '10 questões do conteúdo do dia', minutos: 15, feito: false });
  }
  return plano;
}

/** Modo recuperação: pouco tempo, muita matéria → corta o que não é essencial. */
export function planoEmergencia(p, minutosDisponiveis) {
  const cs = (p.conteudoIds || []).map(conteudo).filter(Boolean)
    .sort((a, b) => (a.dominio || 0) - (b.dominio || 0));
  const blocos = []; let resta = minutosDisponiveis;
  for (const c of cs) {
    if (resta < 15) break;
    const min = Math.min(resta, (c.dominio || 0) < 40 ? 30 : 20);
    blocos.push({ conteudoId: c.id, titulo: c.nome, minutos: min, foco: (c.dominio || 0) < 40 ? 'do zero' : 'revisão dirigida' });
    resta -= min;
  }
  const cortados = cs.slice(blocos.length).map((c) => c.nome);
  if (resta >= 10) blocos.push({ titulo: 'Questões dos pontos mais fracos', minutos: Math.min(resta, 20), foco: 'fixação' });
  return { blocos, cortados };
}

/* ==========================================================
   6) DIVISÃO AUTOMÁTICA DE TAREFAS (sem IA — por tipo de trabalho)
   ========================================================== */
const RECEITAS = [
  { chave: ['redacao', 'redação', 'dissert', 'texto'], passos: ['Entender o tema e o comando', 'Levantar 3 argumentos', 'Escrever a introdução', 'Escrever o desenvolvimento', 'Escrever a conclusão/proposta', 'Revisar gramática e coesão', 'Passar a limpo / entregar'] },
  { chave: ['apresenta', 'seminario', 'seminário', 'slide'], passos: ['Definir o recorte do tema', 'Pesquisar em 3 fontes', 'Montar o roteiro da fala', 'Criar os slides', 'Ensaiar em voz alta (cronometrar)', 'Ajustar e revisar', 'Entregar/apresentar'] },
  { chave: ['trabalho', 'pesquisa', 'projeto'], passos: ['Pesquisar o assunto', 'Selecionar as informações úteis', 'Escrever o texto', 'Criar imagens/gráficos', 'Montar a apresentação/documento', 'Revisar', 'Entregar'] },
  { chave: ['lista', 'exerc', 'atividade'], passos: ['Reler a teoria (10 min)', 'Fazer as questões fáceis', 'Fazer as questões difíceis', 'Conferir os resultados', 'Anotar as dúvidas para perguntar'] },
  { chave: ['resumo', 'fichamento'], passos: ['Ler o material inteiro', 'Marcar as ideias principais', 'Escrever o resumo por tópicos', 'Criar 5 flashcards do resumo'] },
  { chave: ['relatorio', 'relatório', 'experimento'], passos: ['Retomar objetivo e hipótese', 'Descrever materiais e método', 'Organizar os resultados', 'Escrever a discussão/conclusão', 'Revisar e formatar'] },
  { chave: ['prova', 'simulado', 'estudar'], passos: ['Diagnóstico rápido (10 questões)', 'Revisar os pontos fracos', 'Fazer questões do conteúdo', 'Simulado cronometrado', 'Revisão final'] },
];

export function dividirTarefa(titulo, minutos = 60) {
  const n = norm(titulo);
  const receita = RECEITAS.find((r) => r.chave.some((k) => n.includes(k))) || RECEITAS[2];
  const cada = Math.max(10, Math.round(minutos / receita.passos.length / 5) * 5);
  return receita.passos.map((p) => ({ id: uid('sub'), titulo: p, minutos: cada, feito: false }));
}

/* ==========================================================
   7) XP, NÍVEIS, MOEDAS, STREAK, CONQUISTAS
   ========================================================== */
export const XP = { tarefa: 50, simulado: 100, revisao: 30, foco: 40, flashcard: 3, questao: 6, diagnostico: 60, boss: 200 };
export const NIVEIS = [
  { n: 1, t: 'Iniciante' }, { n: 5, t: 'Estudante' }, { n: 10, t: 'Estrategista' },
  { n: 20, t: 'Especialista' }, { n: 30, t: 'Mestre' }, { n: 50, t: 'Lenda Acadêmica' },
];
export const xpDoNivel = (n) => Math.round(60 * (n - 1) ** 1.55);
export function nivelDe(xp) {
  let n = 1; while (xpDoNivel(n + 1) <= xp && n < 99) n++;
  const atual = xpDoNivel(n), prox = xpDoNivel(n + 1);
  const titulo = [...NIVEIS].reverse().find((x) => n >= x.n)?.t || 'Iniciante';
  return { nivel: n, titulo, xpAtual: xp - atual, xpFaltando: prox - xp, xpNivel: prox - atual, progresso: (xp - atual) / Math.max(1, prox - atual) };
}

export function ganharXP(qtd, motivo = '') {
  const antes = nivelDe(st().jogo.xp).nivel;
  set((s) => { s.jogo.xp += qtd; s.jogo.moedas += Math.max(1, Math.round(qtd / 5)); });
  const depois = nivelDe(st().jogo.xp).nivel;
  return { subiu: depois > antes, nivel: depois, qtd, motivo };
}

export function atividadeDoDia(dia = iso()) {
  const s = st();
  const min = sum(s.sessoes.filter((x) => x.em.slice(0, 10) === dia).map((x) => x.minutos));
  const q = s.tentativas.filter((t) => t.em.slice(0, 10) === dia).length;
  const cards = s.flashcards.filter((f) => f.srs?.ultima === dia).length;
  const tarefas = s.tarefas.filter((t) => t.concluidaEm === dia).length;
  return { minutos: min, questoes: q, cards, tarefas };
}

/** Chamado depois de qualquer atividade: mantém/aumenta o streak do dia. */
export function tocarStreak() {
  const s = st();
  const hoje = iso();
  if (s.jogo.ultimoDia === hoje) return { mudou: false, streak: s.jogo.streak };
  const a = atividadeDoDia(hoje);
  const ok = a.minutos >= (s.prefs.metaStreakMin || 10) || a.questoes >= (s.prefs.metaStreakQuestoes || 5) || a.cards >= 5 || a.tarefas >= 1;
  if (!ok) return { mudou: false, streak: s.jogo.streak };
  const ontem = iso(addDays(today(), -1));
  set((x) => {
    x.jogo.streak = x.jogo.ultimoDia === ontem ? x.jogo.streak + 1 : 1;
    x.jogo.ultimoDia = hoje;
    x.jogo.recordeStreak = Math.max(x.jogo.recordeStreak || 0, x.jogo.streak);
  });
  return { mudou: true, streak: st().jogo.streak };
}

export const CONQUISTAS = [
  { id: 'primeiros_passos', emoji: '🏆', nome: 'Primeiros Passos', desc: 'Complete sua primeira sessão de estudo.', teste: (s) => s.sessoes.length >= 1 },
  { id: 'consistencia', emoji: '🔥', nome: 'Consistência', desc: 'Estude 7 dias seguidos.', teste: (s) => (s.jogo.recordeStreak || 0) >= 7 },
  { id: 'maratona', emoji: '🏃', nome: 'Maratonista', desc: 'Acumule 20 horas de estudo.', teste: (s) => sum(s.sessoes.map((x) => x.minutos)) >= 1200 },
  { id: 'maquina', emoji: '🧠', nome: 'Máquina de Questões', desc: 'Responda 500 questões.', teste: (s) => s.tentativas.length >= 500 },
  { id: 'cem_questoes', emoji: '💯', nome: 'Cem na Conta', desc: 'Responda 100 questões.', teste: (s) => s.tentativas.length >= 100 },
  { id: 'precisao', emoji: '🎯', nome: 'Precisão', desc: 'Acerte 20 questões seguidas.', teste: (s) => maiorSequenciaAcertos(s) >= 20 },
  { id: 'mestre_materia', emoji: '📚', nome: 'Mestre da Matéria', desc: 'Chegue a 90% de domínio em uma matéria.', teste: (s) => s.materias.some((m) => dominioMateria(m.id) >= 90) },
  { id: 'sem_atraso', emoji: '⏰', nome: 'Em Dia', desc: 'Fique sem nenhuma tarefa atrasada.', teste: (s) => s.tarefas.length > 3 && !s.tarefas.some((t) => t.status !== 'concluido' && hoursUntil(t.prazo) <= 0) },
  { id: 'colecionador', emoji: '🃏', nome: 'Colecionador', desc: 'Tenha 50 flashcards.', teste: (s) => s.flashcards.length >= 50 },
  { id: 'boss', emoji: '👑', nome: 'Caçador de Boss', desc: 'Vença uma Boss Battle.', teste: (s) => s.sessoes.some((x) => x.tipo === 'boss' && x.venceu) },
  { id: 'simulador', emoji: '🧪', nome: 'Sangue Frio', desc: 'Faça 5 simulados.', teste: (s) => s.sessoes.filter((x) => x.tipo === 'simulado').length >= 5 },
  { id: 'madrugador', emoji: '🌅', nome: 'Madrugador', desc: 'Estude antes das 8h da manhã.', teste: (s) => s.sessoes.some((x) => new Date(x.em).getHours() < 8) },
  { id: 'recuperacao', emoji: '🚑', nome: 'Virada', desc: 'Suba um conteúdo de menos de 40% para mais de 80%.', teste: (s) => s.conteudos.some((c) => (c.dominio || 0) >= 80 && (c.srs?.falhas || 0) >= 2) },
  { id: 'nivel10', emoji: '🎮', nome: 'Estrategista', desc: 'Chegue ao nível 10.', teste: (s) => nivelDe(s.jogo.xp).nivel >= 10 },
];
function maiorSequenciaAcertos(s) {
  let m = 0, c = 0;
  for (const t of [...s.tentativas].sort((a, b) => new Date(a.em) - new Date(b.em))) { c = t.acertou ? c + 1 : 0; m = Math.max(m, c); }
  return m;
}
/** Verifica conquistas novas e devolve as recém-desbloqueadas. */
export function verificarConquistas() {
  const s = st(); const novas = [];
  for (const c of CONQUISTAS) {
    if (s.jogo.conquistas.includes(c.id)) continue;
    let ok = false; try { ok = !!c.teste(s); } catch { ok = false; }
    if (ok) novas.push(c);
  }
  if (novas.length) set((x) => { x.jogo.conquistas.push(...novas.map((c) => c.id)); x.jogo.moedas += novas.length * 25; });
  return novas;
}

/* ==========================================================
   8) NOTIFICAÇÕES INTELIGENTES
   ========================================================== */
export function notificacoes() {
  const s = st(); const out = [];
  const push = (id, icone, txt, rota, urg = 1) => out.push({ id, icone, txt, rota, urg });

  for (const p of s.provas.filter((p) => daysBetween(today(), parseISO(p.data)) >= 0)) {
    const d = daysBetween(today(), parseISO(p.data));
    const { preparo, conteudos } = preparoProva(p);
    const fracos = conteudos.filter((c) => (c.dominio || 0) < 60);
    if (d <= 7 && fracos.length) {
      push(`prv_${p.id}_${d}`, '📚', `${nomeMateria(p.materiaId)} tem prova ${d === 0 ? 'hoje' : d === 1 ? 'amanhã' : `em ${d} dias`} e você ainda tem ${fracos.length} conteúdo(s) com domínio abaixo de 60%.`, `#/provas/${p.id}`, 3);
    } else if (d <= 3) {
      push(`prv_${p.id}_${d}`, '🎯', `Prova de ${nomeMateria(p.materiaId)} em ${d} dia(s). Preparo estimado: ${preparo}%.`, `#/provas/${p.id}`, 2);
    }
  }
  for (const t of s.tarefas.filter((t) => t.status !== 'concluido')) {
    const h = hoursUntil(t.prazo);
    if (h <= 0) push(`tar_${t.id}`, '🚨', `"${t.titulo}" está atrasada.`, '#/tarefas', 4);
    else if (h <= 30) push(`tar_${t.id}`, '⏰', `"${t.titulo}" (${nomeMateria(t.materiaId)}) vence ${h <= 12 ? 'hoje' : 'amanhã'}.`, '#/tarefas', 3);
  }
  // assinatura vencendo ou vencida
  const c = s.conta || {};
  if (c.plano === 'pro' && c.proAte) {
    const faltam = daysBetween(today(), parseISO(c.proAte));
    if (faltam < 0) {
      push(`pro_venceu_${c.proAte}`, '⏳', 'Sua assinatura do StudyLab Pro venceu. O Study AI ficou indisponível.', '#/planos', 4);
    } else if (faltam <= 5) {
      push(`pro_vence_${c.proAte}`, '⏳',
        faltam === 0 ? 'Seu StudyLab Pro termina hoje. Renove para não perder o Study AI.'
          : `Seu StudyLab Pro termina em ${faltam} dia(s).`, '#/planos', 3);
    }
  }

  const rev = filaRevisao();
  if (rev.total) push(`rev_${iso()}`, '🔁', `${rev.total} item(ns) de revisão venceram hoje.`, '#/revisao', 2);
  const a = atividadeDoDia();
  if (s.jogo.streak > 0 && s.jogo.ultimoDia !== iso() && a.minutos < (s.prefs.metaStreakMin || 10)) {
    push(`streak_${iso()}`, '🔥', `Sua sequência de ${s.jogo.streak} dias termina hoje — bastam ${s.prefs.metaStreakMin} minutos.`, '#/foco', 3);
  }
  const fracos = s.conteudos.filter((c) => !c.paiId && (c.dominio || 0) < 40 && c.status !== 'novo');
  if (fracos.length >= 3) push(`fracos_${iso()}`, '🧠', `${fracos.length} conteúdos estão na faixa vermelha. Que tal um diagnóstico?`, '#/aprender', 1);
  return out.sort((a, b) => b.urg - a.urg);
}

/* ==========================================================
   9) MISSÃO DE 5 MINUTOS
   ========================================================== */
export function missao5min() {
  const s = st(); const rev = filaRevisao();
  const ops = [];
  if (rev.cards.length) ops.push({ icone: '🃏', txt: `${Math.min(5, rev.cards.length)} flashcards que venceram`, rota: '#/flashcards?rev=1' });
  if (s.questoes.length) ops.push({ icone: '📝', txt: '3 questões rápidas', rota: '#/questoes?rapido=3' });
  if (rev.erros.length) ops.push({ icone: '❌', txt: 'Rever 2 questões que você errou', rota: '#/revisao' });
  ops.push({ icone: '⏱️', txt: '5 minutos de foco na tarefa mais urgente', rota: '#/foco?min=5' });
  const conteudoFraco = s.conteudos.filter((c) => !c.paiId && c.status !== 'novo').sort((a, b) => (a.dominio || 0) - (b.dominio || 0))[0];
  if (conteudoFraco) ops.push({ icone: '📖', txt: `Revisar "${conteudoFraco.nome}" por 5 minutos`, rota: `#/materias` });
  return ops;
}

/* ==========================================================
   10) DESEMPENHO / ANALYTICS
   ========================================================== */
export function resumoPeriodo(dias = 7) {
  const s = st(); const lim = addDays(today(), -(dias - 1));
  const ses = s.sessoes.filter((x) => parseISO(x.em.slice(0, 10)) >= lim);
  const tent = s.tentativas.filter((x) => parseISO(x.em.slice(0, 10)) >= lim);
  const acertos = tent.filter((t) => t.acertou).length;
  return {
    minutos: sum(ses.map((x) => x.minutos)),
    sessoes: ses.length,
    questoes: tent.length,
    taxa: tent.length ? round((acertos / tent.length) * 100) : 0,
    dominados: s.conteudos.filter((c) => (c.dominio || 0) >= 80).length,
    tarefas: s.tarefas.filter((t) => t.concluidaEm && parseISO(t.concluidaEm) >= lim).length,
  };
}
export function serieDiaria(dias = 14) {
  const s = st(); const out = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = iso(addDays(today(), -i));
    out.push({
      dia: d,
      minutos: sum(s.sessoes.filter((x) => x.em.slice(0, 10) === d).map((x) => x.minutos)),
      questoes: s.tentativas.filter((x) => x.em.slice(0, 10) === d).length,
      acertos: s.tentativas.filter((x) => x.em.slice(0, 10) === d && x.acertou).length,
    });
  }
  return out;
}
export function desempenhoPorMateria() {
  const s = st();
  return s.materias.map((m) => {
    const t = s.tentativas.filter((x) => x.materiaId === m.id);
    const min = sum(s.sessoes.filter((x) => x.materiaId === m.id).map((x) => x.minutos));
    return {
      materia: m, questoes: t.length,
      taxa: t.length ? round((t.filter((x) => x.acertou).length / t.length) * 100) : 0,
      minutos: min, dominio: dominioMateria(m.id), media: mediaMateria(m.id),
    };
  });
}

/* ---------- notas ---------- */
export function mediaMateria(mid) {
  const ns = st().notas.filter((n) => n.materiaId === mid);
  if (!ns.length) return null;
  const pesoTotal = sum(ns.map((n) => n.peso || 1));
  return round(sum(ns.map((n) => (n.valor / (n.maximo || 10)) * 10 * (n.peso || 1))) / pesoTotal, 2);
}
export function mediaGeral() {
  const ms = st().materias.map((m) => mediaMateria(m.id)).filter((x) => x !== null);
  return ms.length ? round(avg(ms), 2) : null;
}
/** Simulador: quanto preciso tirar na próxima avaliação para atingir a média alvo? */
export function simularNota({ materiaId, alvo, valorProxima = 10, pesoProxima = 1 }) {
  const ns = st().notas.filter((n) => n.materiaId === materiaId);
  const pesoAtual = sum(ns.map((n) => n.peso || 1));
  const somaAtual = sum(ns.map((n) => (n.valor / (n.maximo || 10)) * 10 * (n.peso || 1)));
  const precisa = (alvo * (pesoAtual + pesoProxima) - somaAtual) / pesoProxima;
  const emPontos = (precisa / 10) * valorProxima;
  return {
    precisa: round(precisa, 2),
    emPontos: round(emPontos, 2),
    possivel: precisa <= 10.001,
    mediaAtual: pesoAtual ? round(somaAtual / pesoAtual, 2) : null,
  };
}
export function seTirar({ materiaId, nota, pesoProxima = 1 }) {
  const ns = st().notas.filter((n) => n.materiaId === materiaId);
  const pesoAtual = sum(ns.map((n) => n.peso || 1));
  const somaAtual = sum(ns.map((n) => (n.valor / (n.maximo || 10)) * 10 * (n.peso || 1)));
  return round((somaAtual + nota * pesoProxima) / (pesoAtual + pesoProxima), 2);
}

/* ---------- agenda do dia ---------- */
export function aulasDoDia(data = new Date()) {
  const dia = new Date(data).getDay();
  return (st().horario[dia] || []).map((a) => ({ ...a, materia: materia(a.materiaId) }));
}
export function agendaDoDia(dataISO = iso()) {
  const s = st(); const itens = [];
  for (const a of aulasDoDia(parseISO(dataISO))) itens.push({ tipo: 'aula', hora: a.hora, titulo: a.materia?.nome || 'Aula', materiaId: a.materiaId });
  for (const t of s.tarefas.filter((t) => t.prazo === dataISO && t.status !== 'concluido')) itens.push({ tipo: 'tarefa', hora: '', titulo: t.titulo, materiaId: t.materiaId, refId: t.id });
  for (const p of s.provas.filter((p) => p.data === dataISO)) itens.push({ tipo: 'prova', hora: '', titulo: p.titulo, materiaId: p.materiaId, refId: p.id });
  for (const p of s.provas) for (const b of (p.plano || []).filter((b) => b.data === dataISO && !b.feito)) itens.push({ tipo: 'plano', hora: '', titulo: `${b.titulo} (${b.minutos}min)`, materiaId: p.materiaId, refId: p.id });
  for (const e of s.eventos.filter((e) => e.data === dataISO)) itens.push({ tipo: e.tipo, hora: e.hora || '', titulo: e.titulo, materiaId: e.materiaId, refId: e.id });
  const rev = dataISO === iso() ? filaRevisao().total : 0;
  if (rev) itens.push({ tipo: 'revisao', hora: '', titulo: `${rev} itens para revisar`, materiaId: null });
  return itens.sort((a, b) => (a.hora || 'zz').localeCompare(b.hora || 'zz'));
}

/* ---------- fechamento do dia ---------- */
export function fechamentoDoDia() {
  const a = atividadeDoDia();
  const s = st();
  const restantes = s.tarefas.filter((t) => t.status !== 'concluido' && daysBetween(today(), parseISO(t.prazo)) <= 1).length;
  return { ...a, restantes };
}
