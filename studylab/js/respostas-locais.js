/* ===== respostas-locais.js — o chat responde na hora, SEM gastar a IA =====
   Perguntas comuns sobre os próprios estudos ("o que estudo agora?", "minhas
   provas") já têm a resposta calculada pelo app (engine.js). Elas nunca vão
   para a IA: custo zero, resposta instantânea, e funcionam até sem plano pago.
   Pergunta longa, de conteúdo ou com "explique/por que/resolva" vai para a IA. */
import { st, nomeMateria, emojiMateria } from './store.js';
import {
  agoraFaca, ordemRecomendada, filaTarefas, filaRevisao, preparoProva, resumoPeriodo, aulasDoDia, agendaDoDia,
} from './engine.js';
import { norm, fmtData, fmtMin, iso, today, parseISO, daysBetween, addDays } from './util.js';

/** Palavras que pedem raciocínio de verdade: nesses casos quem responde é a IA. */
const PEDE_IA = /\b(explic|por ?que|porque|como funciona|resolv|calcul|corrig|redac|resum|traduz|exemplo|o que (e|sao|significa)\b|defin|ensin|questao|exercicio|me ajud)/;

const INTENCOES = [
  { id: 'oi', re: /^(oi+|ola|opa|e ai|eai|bom dia|boa tarde|boa noite|salve|hey|hello)\b[!. ]*$/ },
  { id: 'agora', re: /(o que|oque|q) (eu )?(estud|fac|faz|fazer)\w* (agora|primeiro|hoje)|por onde (eu )?comec|o que estudar|qual (a )?proxima tarefa|faco o que/ },
  { id: 'aulasAmanha', re: /aula\w* (de |pra |para )?amanha|horario (de |pra |para )?amanha/ },
  { id: 'aulas', re: /aula\w* (de )?hoje|horario (de )?hoje|quais aulas|minhas aulas|tenho aula/ },
  { id: 'hoje', re: /plano (de |do |pra |para )?(hoje|dia)|meu dia|o que tenho (pra |para )?hoje|agenda (de )?hoje|organiz\w* (o |meu )?dia|rotina de hoje/ },
  { id: 'provas', re: /prova|teste\b|testes\b|avaliac|simulado marcado/ },
  { id: 'tarefas', re: /tarefa|dever|licao|trabalho\w* (pendente|atrasad|pra entregar)|atrasad|entregar/ },
  { id: 'revisao', re: /revis|flashcard|cartoes? (pra|para) hoje/ },
  { id: 'desempenho', re: /como (eu )?(estou|to|tou|vou) (indo|nos estudos)?|quanto (eu )?estudei|meu desempenho|resumo da semana|minha semana|meu progresso/ },
];

/** Qual pergunta local isto é (ou null para mandar à IA). Exportada para os testes. */
export function intencaoLocal(texto) {
  const t = norm(texto).replace(/[?¿!]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t || t.length > 90 || PEDE_IA.test(t)) return null;
  return INTENCOES.find((i) => i.re.test(t))?.id || null;
}

/** A resposta pronta (texto) ou null. */
export function responderLocal(texto) {
  const id = intencaoLocal(texto);
  return id ? RESPOSTAS[id]() : null;
}

const linha = (itens) => itens.map((x) => `• ${x}`).join('\n');
const quando = (dataISO) => {
  const d = daysBetween(today(), parseISO(dataISO));
  return d === 0 ? 'hoje' : d === 1 ? 'amanhã' : d < 0 ? `há ${-d} dia(s)` : `em ${d} dias (${fmtData(dataISO, { curto: true })})`;
};

const RESPOSTAS = {
  oi() {
    const nome = st().perfil.nome || '';
    return `Oi${nome ? `, ${nome}` : ''}! 👋 Posso te dizer na hora:\n${linha([
      'o que estudar agora', 'o plano de hoje', 'suas próximas provas', 'tarefas atrasadas', 'revisões de hoje', 'como foi a sua semana'])}`;
  },

  agora() {
    const b = agoraFaca();
    if (!b) return 'Nada pendente agora. 🎉 Que tal revisar ou adiantar uma matéria? Cadastre tarefas e provas e eu monto a ordem para você.';
    const t = st().tarefas.find((x) => x.id === b.tarefaId);
    const porque = t ? (daysBetween(today(), parseISO(t.prazo)) < 0 ? 'está atrasada'
      : daysBetween(today(), parseISO(t.prazo)) <= 1 ? 'o prazo é até amanhã' : `é a de maior prioridade (${b.nota}/100)`) : 'é a de maior prioridade';
    return `${emojiMateria(b.materiaId)} Agora: "${b.titulo}" (${nomeMateria(b.materiaId)}), ${b.minutos} min.\nPor quê: ${porque}.\nAbra o Foco e comece — o resto eu organizo depois.`;
  },

  hoje() {
    const { blocos, minutosPlanejados } = ordemRecomendada();
    const ag = agendaDoDia(iso()).filter((x) => x.tipo === 'aula' || x.tipo === 'prova');
    const partes = [];
    if (ag.length) partes.push(`Na escola hoje:\n${linha(ag.map((x) => `${x.hora ? x.hora + ' ' : ''}${x.tipo === 'prova' ? '🎯 PROVA: ' : ''}${x.titulo}`))}`);
    if (blocos.length) {
      partes.push(`Plano de estudo (${fmtMin(minutosPlanejados)}):\n${linha(blocos.map((x) => (x.pausa ? `☕ pausa de ${x.minutos} min` : `${x.titulo} — ${nomeMateria(x.materiaId)}, ${x.minutos} min`)))}`);
    } else partes.push('Nenhuma tarefa pendente para estudar hoje. 🎉');
    const rev = filaRevisao().total;
    if (rev) partes.push(`E ${rev} revisão(ões) vencendo — 10 minutos resolvem.`);
    return partes.join('\n\n');
  },

  provas() {
    const ps = st().provas.filter((p) => p.data >= iso()).sort((a, b) => a.data.localeCompare(b.data)).slice(0, 6);
    if (!ps.length) return 'Nenhuma prova marcada. 📅 Cadastre na aba Provas (ou na Minha Escola) e eu monto o plano até o dia.';
    return `Suas próximas provas:\n${linha(ps.map((p) => {
      const pr = preparoProva(p);
      return `${emojiMateria(p.materiaId)} ${p.titulo} — ${quando(p.data)} · preparo ${pr.preparo}%`;
    }))}${ps.some((p) => preparoProva(p).preparo < 50 && daysBetween(today(), parseISO(p.data)) <= 7)
      ? '\n\n⚠️ Tem prova nesta semana com preparo abaixo de 50%: comece por ela.' : ''}`;
  },

  tarefas() {
    const fila = filaTarefas();
    if (!fila.length) return 'Nenhuma tarefa pendente. 🎉';
    const atrasadas = fila.filter((t) => daysBetween(today(), parseISO(t.prazo)) < 0);
    return `${atrasadas.length ? `⚠️ ${atrasadas.length} atrasada(s).\n` : ''}As mais urgentes:\n${linha(fila.slice(0, 5).map((t) =>
      `${t.titulo} — ${nomeMateria(t.materiaId)}, ${quando(t.prazo)} (${t._p.nota}/100)`))}`;
  },

  revisao() {
    const r = filaRevisao();
    if (!r.total) return 'Nenhuma revisão vencendo hoje. ✅ A memória agradece.';
    return `Para revisar hoje: ${r.total}\n${linha([
      r.cards.length && `${r.cards.length} flashcard(s)`,
      r.conteudos.length && `${r.conteudos.length} conteúdo(s)`,
      r.erros.length && `${r.erros.length} questão(ões) que você errou`,
    ].filter(Boolean))}\nAbra a aba Revisão — leva uns 10 minutos.`;
  },

  aulas() { return aulas(new Date(), 'hoje'); },
  aulasAmanha() { return aulas(addDays(new Date(), 1), 'amanhã'); },

  desempenho() {
    const r = resumoPeriodo(7);
    if (!r.minutos && !r.questoes) return 'Ainda não tenho estudo registrado nesta semana. Use o Foco e as Questões que eu acompanho para você.';
    return `Sua semana:\n${linha([
      `${fmtMin(r.minutos)} de estudo em ${r.sessoes} sessão(ões)`,
      `${r.questoes} questões, ${r.taxa}% de acerto`,
      `${r.tarefas} tarefa(s) concluída(s)`,
      `sequência de ${st().jogo.streak} dia(s) 🔥`])}`;
  },
};

function aulas(dia, rotulo) {
  const as = aulasDoDia(dia);
  if (!as.length) return `Sem aulas cadastradas para ${rotulo}. Monte a semana na Minha Escola → Semana.`;
  return `Aulas de ${rotulo}:\n${linha(as.map((a) => `${a.hora || '--:--'} ${a.materia?.emoji || '📘'} ${a.materia?.nome || 'Aula'}`))}`;
}
