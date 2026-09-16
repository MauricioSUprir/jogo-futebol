/* ===== views/inicio.js — Command Center =====
   A primeira tela: em um olhar, onde o projeto está hoje. Relógio mundial,
   contagem para o próximo compromisso, números de produtividade, feed do que
   está chegando e captura rápida.                                          */

import {
  h, iso, hoje, saudacao, fmtData, fmtDataLonga, fmtQuando, horaEmFuso,
  diaEmFuso, horaNumericaEmFuso, cortar, textoRico,
} from '../util.js';
import { st, integrantes, lancamentos, tipoEvento, GRUPO } from '../store.js';
import {
  metricas, saudeDoPlano, feed, proximoEvento, contagem, eventosNoDia,
  ordemDoDia, resumoDoDia, aniversarios,
} from '../engine.js';
import {
  tituloPagina, kpi, painel, gAnel, gBarras, vazio, monograma, aviso,
  cascata, modal, toast,
} from '../ui.js';
import { FUSOS, AVISO_DADOS } from '../dados.js';
import { capturaRapida, linhaTarefa, linhaEvento, abrirFormEvento, abrirFormTarefa } from './comum.js';

export function render(alvo, ctx = {}) {
  const s = st();
  const m = metricas();
  const saude = saudeDoPlano();
  const nome = s.perfil.nome ? s.perfil.nome.split(' ')[0] : '';
  const proximo = proximoEvento();
  const timers = [];

  const recarregar = () => { alvo.replaceChildren(); render(alvo, ctx); };

  /* ---------- 1. Hero ---------- */
  const anel = gAnel(saude.nota / 100, {
    tam: 84, traco: 8, texto: String(saude.nota),
    cor: saude.cls === 'ok' ? '#3ddc97' : saude.cls === 'warn' ? '#f7c948' : saude.cls === 'alert' ? '#ff9f45' : '#ff6b6b',
  });

  const contagemTxt = h('b', { class: 'mono', style: { fontSize: '19px' } }, '—');
  if (proximo) {
    const tick = () => {
      const c = contagem(proximo.dataEfetiva || proximo.data, proximo.hora);
      contagemTxt.textContent = c.passou ? 'acontecendo' : c.txt;
    };
    tick();
    timers.push(setInterval(tick, 30000));
  }

  const hero = h('div', { class: 'hero' },
    h('div', { class: 'flexb', style: { alignItems: 'flex-start' } },
      h('div', { class: 'grow' },
        h('span', { class: 'eyebrow' }, `${GRUPO.nome} CENTRAL · COMMAND CENTER`),
        h('h1', {}, `${saudacao()}${nome ? `, ${nome}` : ''}.`),
        h('p', {}, fmtDataLonga(iso(hoje()))),
        h('div', { class: 'chips', style: { marginTop: '14px' } },
          h('span', { class: `chip ${saude.cls}` }, `Planejamento ${saude.rot}`),
          h('span', { class: 'chip' }, `${m.abertas} em aberto`),
          m.atrasadas ? h('span', { class: 'chip bad' }, `${m.atrasadas} atrasada${m.atrasadas > 1 ? 's' : ''}`) : null,
          m.sequencia > 1 ? h('span', { class: 'chip gold' }, `🔥 ${m.sequencia} dias seguidos`) : null)),
      h('div', { class: 'center', style: { flex: '0 0 auto' } },
        anel,
        h('div', { class: 'tiny muted', style: { marginTop: '4px' } }, 'controle'))),
    proximo ? h('div', {
      class: 'flexb',
      style: {
        marginTop: '18px', paddingTop: '16px', borderTop: '1px solid var(--line)',
      },
    },
      h('span', { style: { fontSize: '20px' } }, tipoEvento(proximo.tipo).emoji),
      h('span', { class: 'grow' },
        h('div', { style: { fontWeight: '700' } }, proximo.titulo),
        h('div', { class: 'tiny muted' },
          `${fmtData(proximo.dataEfetiva || proximo.data)}${proximo.hora ? ` às ${proximo.hora}` : ''}`
          + `${proximo.local ? ` · ${proximo.local}` : ''}`)),
      h('span', { class: 'right' },
        contagemTxt,
        h('div', { class: 'tiny muted' }, 'para começar'))) : null);

  /* ---------- 2. Relógio mundial ---------- */
  const relogios = h('div', { class: 'clocks' });
  function pintarRelogios() {
    const escolhidos = (st().prefs.fusos || []).map((id) => FUSOS.find((f) => f.id === id)).filter(Boolean);
    relogios.replaceChildren(...escolhidos.map((f) => {
      const hora = horaNumericaEmFuso(f.fuso);
      const noite = hora < 6 || hora >= 19;
      return h('div', { class: `clock ${noite ? 'noite' : 'dia'}` },
        h('b', {}, horaEmFuso(f.fuso)),
        h('span', {}, `${f.bandeira} ${f.cidade}`),
        h('small', {}, `${noite ? '🌙' : '☀️'} ${diaEmFuso(f.fuso)}`));
    }));
    if (!escolhidos.length) relogios.replaceChildren(h('div', { class: 'muted small' }, 'Nenhum fuso escolhido — ajuste em Configurações.'));
  }
  pintarRelogios();
  timers.push(setInterval(pintarRelogios, 1000 * 20));

  /* ---------- 3. Números ---------- */
  const numeros = h('div', { class: 'grid g4 keep2' },
    kpi(m.paraHoje, 'vencem hoje', m.paraHoje ? 'precisa sair hoje' : 'nada vencendo'),
    kpi(m.atrasadas, 'atrasadas', m.atrasadas ? 'resolva primeiro' : 'tudo em dia'),
    kpi(m.feitas7, 'entregas em 7 dias', `taxa geral ${m.taxa}%`),
    kpi(m.eventosSemana, 'compromissos na semana', `${m.projetos} peça(s) no estúdio`));

  /* ---------- 4. Captura rápida ---------- */
  const captura = painel('Captura rápida', { icone: '⚡' },
    h('p', { class: 'small muted mb' },
      'Escreva do jeito que você pensa. O app separa data, hora, tipo e integrante sozinho — '
      + 'e mostra o que entendeu antes de salvar.'),
    capturaRapida(recarregar));

  /* ---------- 5. Feed ---------- */
  const itens = feed(11);
  const feedEl = h('div', { class: 'feed' });
  if (!itens.length) {
    feedEl.append(vazio('O painel começa vazio', 'Crie um compromisso ou uma tarefa e o movimento aparece aqui.',
      h('button', { class: 'btn btn--p', onclick: () => abrirFormEvento(null, recarregar) }, 'Criar o primeiro'), '📡'));
  } else {
    for (const i of itens) {
      feedEl.append(h('div', {
        class: 'feed__i',
        style: i.rota ? { cursor: 'pointer' } : {},
        onclick: () => { if (i.rota) location.hash = i.rota; },
      },
        h('span', { class: 'feed__dot' }, i.icone),
        h('span', { class: 'feed__c' },
          h('b', {}, i.titulo),
          i.texto ? h('span', {}, i.texto) : null),
        h('span', { class: 'feed__t' }, i.éLog ? fmtQuando(i.quando) : i.quando)));
    }
  }

  /* ---------- 6. Atalhos ---------- */
  const atalhos = h('div', { class: 'shortcuts' },
    atalho('📅', 'Compromisso', 'novo na agenda', () => abrirFormEvento(null, recarregar)),
    atalho('✅', 'Tarefa', 'com prioridade', () => abrirFormTarefa(null, recarregar)),
    atalho('🎨', 'Criar peça', 'cartaz ou ingresso', () => { location.hash = '#/estudio'; }),
    atalho('🧠', 'Conselheiro', 'pedir análise', () => { location.hash = '#/conselheiro'; }),
    atalho('📓', 'Resumo do dia', 'gerado agora', () => {
      modal('📓 Resumo do dia', h('div', { class: 'msg ia', style: { maxWidth: '100%' }, html: textoDoResumo() }));
    }),
    atalho('👑', 'Integrantes', 'enciclopédia', () => { location.hash = '#/membros'; }));

  /* ---------- 7. Prioridades de hoje ---------- */
  const top = ordemDoDia(5);
  const prioridades = painel('Prioridade agora', {
    icone: '🎯',
    acao: h('a', { class: 'btn btn--xs', href: '#/agenda' }, 'ver tudo'),
  }, top.length
    ? h('div', { class: 'list' }, ...top.map((t) => linhaTarefa(t, recarregar, { compacta: false })))
    : vazio('Sem tarefa aberta', 'Quando houver, a ordem aparece aqui calculada por prazo, peso e esforço.', null, '🎯'));

  /* ---------- 8. Hoje na agenda ---------- */
  const doDia = eventosNoDia(iso(hoje()));
  const agendaHoje = painel('Hoje na agenda', {
    icone: '🗓️',
    acao: h('a', { class: 'btn btn--xs', href: '#/agenda' }, 'abrir agenda'),
  }, doDia.length
    ? h('div', { class: 'list' }, ...doDia.map((e) => linhaEvento(e, recarregar)))
    : vazio('Dia livre', 'Nenhum compromisso marcado para hoje.', null, '🌤️'));

  /* ---------- 9. Produtividade ---------- */
  const grafico = painel('Entregas dos últimos 7 dias', { icone: '📈' },
    m.feitas7 || m.concluidas
      ? h('div', {}, gBarras(m.seteDias, { cor: 'var(--iris)' }),
        h('p', { class: 'tiny muted mt' },
          `${m.feitas7} tarefa(s) concluída(s) na semana · taxa de conclusão geral de ${m.taxa}%.`))
      : vazio('Ainda sem histórico', 'Conclua uma tarefa e a curva começa.', null, '📈'));

  /* ---------- 10. Destaques do grupo ---------- */
  const membros = integrantes();
  const bias = membros.find((x) => x.id === st().perfil.biasId);
  const ultimo = lancamentos()[0];
  const proximasDatas = aniversarios(60).slice(0, 3);

  const destaques = painel('Destaques do grupo', {
    icone: '👑',
    acao: h('a', { class: 'btn btn--xs', href: '#/membros' }, 'enciclopédia'),
  },
    h('div', { class: 'wrap-x mb' }, ...membros.map((mem) => h('button', {
      class: 'center',
      style: { width: '74px', cursor: 'pointer', background: 'none', border: 0 },
      onclick: () => { location.hash = `#/membros/${mem.id}`; },
      title: mem.nomeCompleto || mem.nome,
    },
      h('div', { style: { display: 'grid', placeItems: 'center' } }, monograma(mem, { tamanho: 52, raio: 16 })),
      h('div', { class: 'tiny', style: { marginTop: '6px', fontWeight: '700' } }, mem.nome),
      h('div', { class: 'tiny dim2' }, mem.bandeira || '')))),
    ultimo ? h('div', { class: 'row row--flat' },
      h('span', { style: { fontSize: '18px' } }, '💿'),
      h('span', { class: 'grow' },
        h('div', { class: 'ttl' }, ultimo.titulo),
        h('div', { class: 'sub' }, h('span', {}, `${ultimo.tipo} · ${fmtData(ultimo.data, { relativo: false })}`))),
      h('span', { class: 'chip' }, 'último registrado')) : null,
    bias ? h('div', { class: 'row row--flat mt' },
      monograma(bias, { tamanho: 34, raio: 11 }),
      h('span', { class: 'grow' },
        h('div', { class: 'ttl' }, `${bias.nome} — sua destacada`),
        h('div', { class: 'sub' }, h('span', {}, cortar(bias.papel || '', 40))))) : null,
    proximasDatas.length ? h('div', { class: 'mt' },
      h('div', { class: 'tiny dim2 mb' }, 'DATAS CHEGANDO'),
      ...proximasDatas.map((a) => h('div', { class: 'tiny muted', style: { padding: '3px 0' } }, `🎉 ${a.texto}`))) : null);

  /* ---------- montagem ---------- */
  const colEsq = h('div', { class: 'flexc' }, captura, prioridades, grafico);
  const colDir = h('div', { class: 'flexc' },
    painel('Feed', { icone: '📡' }, feedEl),
    agendaHoje,
    destaques);

  const blocos = [
    hero,
    painel('Relógio mundial', {
      icone: '🌍',
      acao: h('a', { class: 'btn btn--xs', href: '#/config' }, 'escolher cidades'),
    }, relogios),
    numeros,
    painel('Atalhos', { icone: '⚡' }, atalhos),
    h('div', { class: 'grid g-side' }, colEsq, colDir),
    st().visto.boasVindas ? null : aviso(AVISO_DADOS, 'info'),
  ].filter(Boolean);

  const raiz = h('div', { class: 'flexc', style: { gap: '18px' } }, ...blocos);
  alvo.replaceChildren(
    tituloPagina('Command Center', 'O estado do projeto agora — agenda, entregas e o que está chegando.',
      h('button', { class: 'btn btn--sm', onclick: () => { modal('📓 Resumo do dia', h('div', { class: 'msg ia', style: { maxWidth: '100%' }, html: textoDoResumo() })); } }, '📓 Resumo'),
      h('button', { class: 'btn btn--p btn--sm', onclick: () => abrirFormEvento(null, recarregar) }, '+ Compromisso')),
    raiz);

  cascata(raiz.children, { passo: 55 });

  // devolve a limpeza: sem isso os relógios continuariam rodando fora da tela
  return () => timers.forEach(clearInterval);
}

function atalho(emoji, titulo, sub, aoClicar) {
  return h('button', { class: 'shortcut', onclick: aoClicar },
    h('span', { class: 'em' }, emoji),
    h('b', {}, titulo),
    h('span', {}, sub));
}

/** O resumo sai do motor com marcação simples; aqui vira HTML. */
function textoDoResumo() { return textoRico(resumoDoDia()); }
