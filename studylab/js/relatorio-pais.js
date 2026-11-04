/* ===== relatorio-pais.js — o relatório da semana para os responsáveis (Pro) =====
   Montado só com os dados do aparelho (nada de IA, custo zero): tempo de estudo,
   tarefas, questões, próximas provas com o preparo e o que precisa de atenção.
   O aluno compartilha pelo WhatsApp (texto) ou salva em PDF. As conversas com o
   MindTrack AI NUNCA entram no relatório.                                      */
import { h, fmtData, fmtMin, iso } from './util.js';
import { st, nomeMateria } from './store.js';
import { resumoPeriodo, desempenhoPorMateria, preparoProva, mediaGeral } from './engine.js';
import { modal, toast, paywall, liberado } from './ui.js';

export function dadosDaSemana() {
  const s = st();
  const r = resumoPeriodo(7);
  const ant = resumoPeriodo(14);
  const semanaPassada = { minutos: ant.minutos - r.minutos, tarefas: ant.tarefas - r.tarefas };
  const hoje = iso();
  const provas = s.provas.filter((p) => p.data >= hoje).sort((a, b) => a.data.localeCompare(b.data)).slice(0, 4)
    .map((p) => ({ titulo: p.titulo, materia: nomeMateria(p.materiaId), data: p.data, ...preparoProva(p) }));
  const atrasadas = s.tarefas.filter((t) => t.status !== 'concluido' && t.prazo && t.prazo < hoje).length;
  const materias = desempenhoPorMateria().filter((m) => m.questoes || m.minutos || m.media !== null);
  const atencao = materias.filter((m) => (m.media !== null && m.media < 6) || (m.questoes >= 5 && m.taxa < 60))
    .map((m) => m.materia.nome).slice(0, 3);
  return { nome: s.perfil.nome || 'O aluno', r, semanaPassada, provas, atrasadas, atencao, media: mediaGeral(), sequencia: s.jogo.streak || 0 };
}

const seta = (agora, antes) => (agora > antes ? '↑' : agora < antes ? '↓' : '=');

export function textoDoRelatorio(d = dadosDaSemana()) {
  const linhas = [
    `📊 *Semana de estudos de ${d.nome}* — MindTrack AI`,
    '',
    `⏱️ Tempo estudando: ${fmtMin(d.r.minutos)} (${seta(d.r.minutos, d.semanaPassada.minutos)} semana passada: ${fmtMin(d.semanaPassada.minutos)})`,
    `✅ Tarefas concluídas: ${d.r.tarefas}${d.atrasadas ? ` · ⚠️ ${d.atrasadas} atrasada(s)` : ' · nenhuma atrasada'}`,
    `📝 Questões resolvidas: ${d.r.questoes}${d.r.questoes ? ` (${d.r.taxa}% de acerto)` : ''}`,
    `🔥 Sequência: ${d.sequencia} dia(s) seguidos`,
  ];
  if (d.media !== null) linhas.push(`🎓 Média geral: ${String(d.media).replace('.', ',')}`);
  if (d.provas.length) {
    linhas.push('', '🎯 *Próximas provas*');
    for (const p of d.provas) linhas.push(`• ${p.titulo} (${p.materia}) — ${fmtData(p.data, { curto: true })}, em ${p.dias} dia(s) · preparo ${p.preparo}%`);
  }
  if (d.atencao.length) linhas.push('', `💡 Precisa de atenção: ${d.atencao.join(', ')}`);
  linhas.push('', 'Enviado pelo MindTrack AI. As conversas do aluno com a IA são privadas e não entram aqui.');
  return linhas.join('\n');
}

export function abrirRelatorioPais() {
  const porta = liberado('relatorio_pais');
  if (!porta.ok) {
    return modal('👨‍👩‍👧 Relatório para os responsáveis', paywall('Relatório semanal para os pais',
      'Toda semana, um resumo pronto para mandar no WhatsApp: tempo de estudo, tarefas, provas que vêm aí e o que precisa de atenção.', porta.precisa));
  }
  const d = dadosDaSemana();
  const txt = textoDoRelatorio(d);
  const kpi = (v, t) => h('div', { class: 'kpi' }, h('b', {}, v), h('span', {}, t));
  modal('👨‍👩‍👧 Relatório da semana', h('div', { class: 'rel-pais' },
    h('div', { class: 'grid g4 keep2' },
      kpi(fmtMin(d.r.minutos), 'estudando'), kpi(String(d.r.tarefas), 'tarefas feitas'),
      kpi(d.r.questoes ? `${d.r.taxa}%` : '—', 'de acerto'), kpi(String(d.sequencia), 'dias seguidos')),
    d.provas.length ? h('div', { class: 'list mt' }, ...d.provas.map((p) => h('div', { class: 'row' },
      h('div', { class: 'grow' }, h('div', { class: 'ttl' }, p.titulo), h('div', { class: 'sub' }, `${p.materia} · ${fmtData(p.data, { curto: true })} · em ${p.dias} dia(s)`)),
      h('span', { class: `chip ${p.preparo >= 70 ? 'ok' : p.preparo >= 40 ? 'warn' : 'bad'}` }, `preparo ${p.preparo}%`)))) : null,
    d.atencao.length ? h('p', { class: 'small mt' }, `💡 Precisa de atenção: ${d.atencao.join(', ')}`) : null,
    h('p', { class: 'tiny muted' }, 'As conversas com o MindTrack AI são privadas e não entram no relatório.'),
    h('div', { class: 'flexb mt' },
      h('button', {
        class: 'btn btn--p', onclick: async () => {
          try {
            if (navigator.share) await navigator.share({ title: 'Semana de estudos', text: txt });
            else { await navigator.clipboard.writeText(txt); toast('Copiado! Cole no WhatsApp dos seus responsáveis. ✅', 'good'); }
          } catch (e) { if (e.name !== 'AbortError') toast('Não consegui compartilhar. Tente copiar.', 'bad'); }
        },
      }, '📤 Enviar (WhatsApp)'),
      h('a', { class: 'btn', href: `https://wa.me/?text=${encodeURIComponent(txt)}`, target: '_blank', rel: 'noopener' }, 'Abrir no WhatsApp'),
      h('button', { class: 'btn', onclick: async () => { await navigator.clipboard?.writeText(txt); toast('Texto copiado ✅', 'good'); } }, 'Copiar'))));
}
