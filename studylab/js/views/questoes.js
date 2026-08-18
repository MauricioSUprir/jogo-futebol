/* ===== views/questoes.js — banco de questões, gerador, modo prova, desafio e boss ===== */
import { h, iso, fmtMin, round, uid, norm, esc, clamp } from '../util.js';
import {
  st, set, novaQuestao, registrarTentativa, registrarSessao, atualizar, remover,
  nomeMateria, emojiMateria, conteudo as getConteudo, materia as getMateria, prova as getProva,
} from '../store.js';
import {
  ganharXP, verificarConquistas, tocarStreak, recalcularDominios, proximaRevisao, semaforo, XP,
} from '../engine.js';
import {
  titulo, cartao, kpi, vazio, modal, fecharModal, toast, campo, inp, sel, txtarea, segmento,
  confirmar, barra, gAnel, progresso, gBarrasH,
} from '../ui.js';
import { opcoesMaterias, opcoesConteudos, selMateria, tagMateria } from './comum.js';
import { temIA, gerarQuestoes, questoesLocais, TIPOS_QUESTAO, NIVEIS_QUESTAO, analisarSimulado } from '../ai.js';

const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F'];
let filtroMateria = '';

export function render(el, { params }) {
  const pintar = () => { el.replaceChildren(); montar(el, params, pintar); };
  montar(el, params, pintar);
}

function montar(el, params, pintar) {
  const s = st();
  const materiaParam = params.get('materia');
  const provaParam = params.get('prova');
  const modoParam = params.get('modo');
  if (materiaParam) filtroMateria = materiaParam;

  /* atalhos vindos de outras telas */
  if (params.get('gerar')) { setTimeout(() => abrirGerador(pintar, { materiaId: materiaParam }), 60); }
  if (modoParam === 'simulado' && provaParam) { setTimeout(() => iniciarDeProva(provaParam, 'simulado'), 60); }
  if (modoParam === 'diagnostico' && materiaParam) { setTimeout(() => iniciarDiagnostico(materiaParam), 60); }
  if (params.get('rapido')) { setTimeout(() => iniciarSessao(sortear(qsFiltradas(), Number(params.get('rapido')) || 3), { modo: 'treino' }), 60); }

  el.append(titulo('📝 Questões', 'Gere, treine e simule provas — e cada erro vira revisão.',
    h('button', { class: 'btn', onclick: () => formQuestao(null, pintar) }, '➕ Manual'),
    h('button', { class: 'btn btn--p', onclick: () => abrirGerador(pintar, { materiaId: filtroMateria }) }, '✨ Gerar questões')));

  const tent = s.tentativas;
  el.append(h('div', { class: 'grid g4 keep2 mb' },
    kpi(s.questoes.length, 'questões no banco'),
    kpi(tent.length, 'respondidas'),
    kpi(tent.length ? `${round((tent.filter((t) => t.acertou).length / tent.length) * 100)}%` : '—', 'taxa de acerto'),
    kpi(s.sessoes.filter((x) => x.tipo === 'simulado').length, 'simulados feitos')));

  /* modos */
  el.append(h('div', { class: 'grid g4 mb' },
    modoCard('📚', 'Treino', 'Responde e já vê o gabarito.', () => escolherEIniciar('treino')),
    modoCard('🧪', 'Modo prova', 'Cronômetro, sem consultar, resultado no fim.', () => escolherEIniciar('simulado')),
    modoCard('⚔️', 'Desafio', '3 vidas. Errou, perde uma.', () => escolherEIniciar('desafio')),
    modoCard('👑', 'Boss battle', 'Unidade inteira, 80% para vencer.', () => escolherEIniciar('boss'))));

  /* banco */
  const selMat = sel([{ v: '', t: 'Todas as matérias' }, ...opcoesMaterias(false)], filtroMateria, { style: { maxWidth: '220px' } });
  selMat.addEventListener('change', () => { filtroMateria = selMat.value; pintar(); });

  const banco = cartao(
    h('div', { class: 'flexb mb' }, h('b', {}, '🗂️ Banco de questões'), h('span', { class: 'sp' }, selMat)));
  const qs = qsFiltradas();
  if (!qs.length) {
    banco.append(vazio('Banco vazio', 'Gere questões com o Study AI ou cadastre manualmente.',
      h('button', { class: 'btn btn--p', onclick: () => abrirGerador(pintar, { materiaId: filtroMateria }) }, '✨ Gerar questões')));
  } else {
    banco.append(h('div', { class: 'list' }, ...qs.slice(0, 40).map((q) => linhaQuestao(q, pintar))));
    if (qs.length > 40) banco.append(h('p', { class: 'tiny muted center mt' }, `mostrando 40 de ${qs.length}`));
  }
  el.append(banco);
}

const qsFiltradas = () => st().questoes.filter((q) => !filtroMateria || q.materiaId === filtroMateria);
const sortear = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);

function modoCard(emoji, nome, desc, onclick) {
  return h('button', { class: 'card', style: { cursor: 'pointer', textAlign: 'left' }, onclick },
    h('div', { style: { fontSize: '24px' } }, emoji),
    h('b', {}, nome), h('p', { class: 'tiny muted', style: { margin: '4px 0 0' } }, desc));
}

function linhaQuestao(q, pintar) {
  const tent = st().tentativas.filter((t) => t.questaoId === q.id);
  const acertos = tent.filter((t) => t.acertou).length;
  return h('div', { class: 'row' },
    h('span', { class: 'lead', style: { background: tent.length ? (acertos / tent.length >= .6 ? '#34d399' : '#f87171') : '#242a3d' } }),
    h('div', { class: 'grow', style: { cursor: 'pointer' }, onclick: () => verQuestao(q, pintar) },
      h('div', { class: 'ttl' }, q.enunciado.length > 110 ? q.enunciado.slice(0, 107) + '…' : q.enunciado),
      h('div', { class: 'sub' }, tagMateria(q.materiaId),
        q.conteudoId ? h('span', { class: 'chip' }, getConteudo(q.conteudoId)?.nome || '') : null,
        h('span', { class: 'chip' }, NIVEIS_QUESTAO.find((n) => n.id === q.dificuldade)?.rot || q.dificuldade),
        tent.length ? h('span', { class: 'chip' }, `${acertos}/${tent.length} acertos`) : null)),
    h('button', { class: 'icon-btn', title: 'Favoritar', onclick: () => { atualizar('questoes', q.id, { favorita: !q.favorita }); pintar(); } }, q.favorita ? '⭐' : '☆'),
    h('button', { class: 'icon-btn', onclick: () => iniciarSessao([q], { modo: 'treino' }) }, '▶'));
}

function verQuestao(q, pintar) {
  modal('Questão', h('div', {},
    h('p', { style: { marginTop: 0, fontWeight: 600 } }, q.enunciado),
    q.alternativas?.length
      ? h('div', {}, ...q.alternativas.map((a, i) => h('div', {
        class: `q-opt ${i === q.correta ? 'right' : ''}`,
      }, h('span', { class: 'k' }, LETRAS[i]), h('span', {}, a))))
      : h('p', { class: 'small' }, h('b', {}, 'Resposta esperada: '), q.resposta || '—'),
    q.explicacao ? h('div', { class: 'card card--flat mt' }, h('b', { class: 'small' }, '💡 Explicação'), h('p', { class: 'small', style: { marginBottom: 0 } }, q.explicacao)) : null,
    h('div', { class: 'flexb mt2' },
      h('button', { class: 'btn btn--d', onclick: () => confirmar('Apagar questão?', '', () => { remover('questoes', q.id); fecharModal(); pintar(); }) }, 'Apagar'),
      h('button', { class: 'btn sp', onclick: () => { fecharModal(); formQuestao(q, pintar); } }, '✏️ Editar'),
      h('button', { class: 'btn btn--p', onclick: () => { fecharModal(); iniciarSessao([q], { modo: 'treino' }); } }, '▶ Responder'))));
}

/* ==========================================================
   GERADOR
   ========================================================== */
export function abrirGerador(aoSalvar, { materiaId = '', conteudoId = '' } = {}) {
  const f = {};
  f.materia = selMateria(materiaId);
  let selCont = sel(opcoesConteudos(materiaId), conteudoId);
  const wrapC = h('div', {}, selCont);
  f.materia.addEventListener('change', () => { selCont = sel(opcoesConteudos(f.materia.value), ''); wrapC.replaceChildren(selCont); });
  f.qtd = inp({ type: 'number', min: 1, max: 30, value: 5 });
  let tipo = 'objetiva', nivel = 'medio';
  f.material = txtarea({ placeholder: 'Opcional: cole aqui o conteúdo da aula/resumo para as questões saírem em cima do SEU material.', style: { minHeight: '90px' } });

  const saida = h('div', { class: 'mt2' });
  const btn = h('button', {
    class: 'btn btn--p btn--blk', onclick: async () => {
      const mid = f.materia.value, cid = selCont.value;
      const materiaNome = mid ? nomeMateria(mid) : '';
      const conteudoNome = cid ? getConteudo(cid)?.nome : (f.material.value ? 'material colado' : '');
      const qtd = clamp(Number(f.qtd.value) || 5, 1, 30);
      if (!temIA()) {
        const locais = questoesLocais({ materiaId: mid || null, conteudoId: cid || null, quantidade: qtd });
        if (!locais.length) {
          saida.replaceChildren(h('div', { class: 'empty' },
            h('b', {}, 'Sem Study AI configurado'),
            h('span', {}, 'Para gerar questões novas eu preciso da chave da Claude API. Sem ela, só consigo montar questões a partir dos seus flashcards — e você tem poucos desta matéria.'),
            h('div', { class: 'mt' }, h('a', { class: 'btn', href: '#/config', onclick: fecharModal }, '⚙️ Configurar Study AI'))));
          return;
        }
        mostrarPrevia(locais, { mid, cid, nivel }, saida, aoSalvar);
        return;
      }
      btn.disabled = true; btn.textContent = 'Gerando…';
      saida.replaceChildren(h('p', { class: 'muted small' }, '✨ O Study AI está escrevendo as questões. Isso leva alguns segundos.'));
      try {
        const qs = await gerarQuestoes({
          materiaNome: materiaNome || 'Geral', conteudoNome: conteudoNome || 'conteúdo geral',
          quantidade: qtd, tipo, nivel, material: f.material.value,
        });
        mostrarPrevia(qs, { mid, cid, nivel }, saida, aoSalvar);
      } catch (e) {
        saida.replaceChildren(h('p', { class: 'small', style: { color: 'var(--bad)' } }, e.message));
      }
      btn.disabled = false; btn.textContent = '✨ Gerar questões';
    },
  }, '✨ Gerar questões');

  modal('✨ Gerador de questões', h('div', {},
    h('div', { class: 'f-row' }, campo('Matéria', f.materia), campo('Conteúdo', wrapC)),
    campo('Quantidade', f.qtd),
    h('label', { class: 'f' }, h('span', {}, 'Tipo'), segmento(TIPOS_QUESTAO.map((t) => ({ v: t.id, t: t.rot })), tipo, (v) => { tipo = v; })),
    h('label', { class: 'f' }, h('span', {}, 'Dificuldade'), segmento(NIVEIS_QUESTAO.map((t) => ({ v: t.id, t: t.rot })), nivel, (v) => { nivel = v; })),
    campo('Material base (opcional)', f.material),
    temIA() ? null : h('p', { class: 'tiny', style: { color: 'var(--warn)' } },
      '⚠️ Study AI desligado: vou montar questões a partir dos seus flashcards. Para questões novas, configure a chave em ⚙️ Configurações.'),
    btn, saida), { largo: true });
}

function mostrarPrevia(qs, { mid, cid, nivel }, saida, aoSalvar) {
  if (!qs.length) { saida.replaceChildren(h('p', { class: 'small muted' }, 'Nenhuma questão foi gerada.')); return; }
  const marcadas = new Set(qs.map((_, i) => i));
  const lista = h('div', { class: 'list' }, ...qs.map((q, i) => h('label', { class: 'row row--flat', style: { alignItems: 'flex-start' } },
    h('input', { type: 'checkbox', checked: true, onchange: (e) => { e.target.checked ? marcadas.add(i) : marcadas.delete(i); } }),
    h('div', { class: 'grow' },
      h('div', { class: 'small', style: { fontWeight: 600 } }, q.enunciado),
      ...(q.alternativas || []).map((a, j) => h('div', { class: 'tiny muted' }, `${LETRAS[j]}) ${a}${j === q.correta ? '  ✓' : ''}`)),
      q.explicacao ? h('div', { class: 'tiny', style: { color: 'var(--dim2)', marginTop: '4px' } }, `💡 ${q.explicacao}`) : null))));
  saida.replaceChildren(
    h('b', { class: 'small' }, `${qs.length} questões geradas — desmarque o que não quiser`),
    lista,
    h('div', { class: 'flexb mt' },
      h('button', {
        class: 'btn btn--p', onclick: () => {
          let n = 0;
          for (const [i, q] of qs.entries()) {
            if (!marcadas.has(i)) continue;
            novaQuestao({
              materiaId: mid || null, conteudoId: cid || null, tipo: q.tipo || 'objetiva',
              dificuldade: nivel, enunciado: q.enunciado, alternativas: q.alternativas || [],
              correta: q.correta ?? 0, resposta: q.resposta || '', explicacao: q.explicacao || '',
              origem: q.origem === 'local' ? 'flashcards' : 'ia',
            });
            n++;
          }
          fecharModal(); toast(`${n} questões salvas no banco`, 'good'); aoSalvar?.();
        },
      }, '💾 Salvar no banco'),
      h('button', {
        class: 'btn sp', onclick: () => {
          const sel1 = qs.filter((_, i) => marcadas.has(i)).map((q) => ({
            id: uid('tmp'), materiaId: mid || null, conteudoId: cid || null, tipo: q.tipo || 'objetiva',
            dificuldade: nivel, enunciado: q.enunciado, alternativas: q.alternativas || [],
            correta: q.correta ?? 0, resposta: q.resposta || '', explicacao: q.explicacao || '', temporaria: true,
          }));
          fecharModal(); iniciarSessao(sel1, { modo: 'treino' });
        },
      }, '▶ Responder agora')));
}

/* ==========================================================
   ESCOLHER E INICIAR
   ========================================================== */
function escolherEIniciar(modo) {
  const s = st();
  const f = {};
  f.materia = selMateria(filtroMateria);
  let selCont = sel(opcoesConteudos(filtroMateria), '');
  const wrapC = h('div', {}, selCont);
  f.materia.addEventListener('change', () => { selCont = sel(opcoesConteudos(f.materia.value), ''); wrapC.replaceChildren(selCont); });
  const padraoQtd = { treino: 10, simulado: 20, desafio: 15, boss: 30 }[modo];
  f.qtd = inp({ type: 'number', min: 1, max: 60, value: padraoQtd });
  f.min = inp({ type: 'number', min: 1, max: 180, value: modo === 'simulado' ? 30 : 20 });

  const nomes = { treino: '📚 Treino', simulado: '🧪 Modo prova', desafio: '⚔️ Desafio', boss: '👑 Boss battle' };
  modal(nomes[modo], h('div', {},
    h('div', { class: 'f-row' }, campo('Matéria', f.materia), campo('Conteúdo', wrapC)),
    h('div', { class: 'f-row' }, campo('Quantas questões', f.qtd),
      modo === 'simulado' ? campo('Minutos', f.min) : h('div')),
    modo === 'desafio' ? h('p', { class: 'small muted' }, 'Você começa com ❤️❤️❤️. Cada erro custa uma vida. Chegue ao fim com pelo menos uma.') : null,
    modo === 'boss' ? h('p', { class: 'small muted' }, 'Boss battle: acerte 80% ou mais para vencer a unidade. Vale 200 XP.') : null,
    h('button', {
      class: 'btn btn--p btn--blk mt', onclick: () => {
        const mid = f.materia.value, cid = selCont.value;
        let pool = st().questoes.filter((q) => (!mid || q.materiaId === mid) && (!cid || q.conteudoId === cid));
        if (pool.length < 1) return toast('Não há questões com esse filtro. Gere questões primeiro.', 'bad');
        const qs = sortear(pool, clamp(Number(f.qtd.value) || padraoQtd, 1, pool.length));
        fecharModal();
        iniciarSessao(qs, { modo, minutos: Number(f.min.value) || 30, titulo: nomes[modo] });
      },
    }, '▶ Começar')));
}

function iniciarDeProva(provaId, modo) {
  const p = getProva(provaId); if (!p) return;
  const pool = st().questoes.filter((q) => q.materiaId === p.materiaId && (!p.conteudoIds?.length || p.conteudoIds.includes(q.conteudoId)));
  if (!pool.length) return toast('Sem questões dessa prova no banco. Gere questões primeiro.', 'bad');
  iniciarSessao(sortear(pool, Math.min(20, pool.length)), { modo, minutos: 30, titulo: `Simulado — ${p.titulo}`, provaId });
}

function iniciarDiagnostico(materiaId) {
  const pool = st().questoes.filter((q) => q.materiaId === materiaId);
  if (pool.length < 3) return toast('Poucas questões para diagnosticar. Gere questões primeiro.', 'bad');
  iniciarSessao(sortear(pool, Math.min(15, pool.length)), { modo: 'diagnostico', titulo: `Diagnóstico — ${nomeMateria(materiaId)}` });
}

/* ==========================================================
   SESSÃO DE QUESTÕES (tela cheia)
   ========================================================== */
export function iniciarSessao(questoes, { modo = 'treino', minutos = 30, titulo: tit = '', provaId = null } = {}) {
  if (!questoes.length) return toast('Nenhuma questão', 'bad');
  const feedbackNaHora = modo === 'treino' || modo === 'desafio';
  const estado = { i: 0, respostas: [], vidas: 3, inicio: Date.now(), fim: null };
  const tela = h('div', { class: 'focus-full', style: { alignContent: 'start', paddingTop: '18px', overflowY: 'auto' } });
  document.body.append(tela);
  document.body.style.overflow = 'hidden';

  let timer = null;
  const restanteEl = h('b', {});
  if (modo === 'simulado') {
    const fimEm = Date.now() + minutos * 60000;
    timer = setInterval(() => {
      const r = Math.max(0, fimEm - Date.now());
      restanteEl.textContent = `${String(Math.floor(r / 60000)).padStart(2, '0')}:${String(Math.floor((r % 60000) / 1000)).padStart(2, '0')}`;
      if (r <= 0) { clearInterval(timer); finalizar(); }
    }, 500);
  }

  function sair() {
    clearInterval(timer); tela.remove(); document.body.style.overflow = '';
  }

  function pintar() {
    const q = questoes[estado.i];
    const respondida = estado.respostas[estado.i];
    tela.replaceChildren();
    tela.append(h('div', { style: { width: 'min(720px,100%)', textAlign: 'left' } },
      h('div', { class: 'flexb mb' },
        h('button', { class: 'icon-btn', onclick: () => confirmar('Sair da sessão?', 'O progresso desta sessão será perdido.', sair) }, '✕'),
        h('b', { class: 'small' }, tit || (modo === 'treino' ? 'Treino' : modo)),
        h('span', { class: 'sp' }),
        modo === 'desafio' ? h('span', {}, '❤️'.repeat(clamp(estado.vidas, 0, 3)) + '🖤'.repeat(clamp(3 - estado.vidas, 0, 3))) : null,
        modo === 'simulado' ? h('span', { class: 'chip' }, '⏱️ ', restanteEl) : null,
        h('span', { class: 'chip' }, `${estado.i + 1}/${questoes.length}`)),
      barra(((estado.i) / questoes.length) * 100),
      h('div', { class: 'card mt2' },
        h('p', { style: { marginTop: 0, fontSize: '16px', fontWeight: 600, lineHeight: 1.5 } }, q.enunciado),
        q.alternativas?.length ? h('div', {}, ...q.alternativas.map((a, i) => {
          let cls = 'q-opt';
          if (respondida !== undefined) {
            if (feedbackNaHora) {
              if (i === q.correta) cls += ' right';
              else if (i === respondida) cls += ' wrong';
            } else if (i === respondida) cls += ' sel';
          }
          return h('button', {
            class: cls, onclick: () => responder(i),
            disabled: respondida !== undefined && feedbackNaHora ? true : null,
          }, h('span', { class: 'k' }, LETRAS[i]), h('span', {}, a));
        })) : (() => {
          const ta = txtarea({ placeholder: 'Escreva sua resposta…' });
          if (respondida !== undefined) ta.value = respondida;
          return h('div', {}, ta, h('button', {
            class: 'btn btn--p mt', onclick: () => responder(ta.value),
          }, 'Responder'));
        })(),
        respondida !== undefined && feedbackNaHora && q.explicacao
          ? h('div', { class: 'card card--flat mt' },
            h('b', { class: 'small' }, respondida === q.correta ? '✅ Isso aí!' : '❌ Não foi dessa vez'),
            h('p', { class: 'small', style: { marginBottom: 0 } }, q.explicacao))
          : null),
      h('div', { class: 'flexb mt2' },
        estado.i > 0 ? h('button', { class: 'btn', onclick: () => { estado.i--; pintar(); } }, '‹ Anterior') : null,
        h('span', { class: 'sp' }),
        estado.i < questoes.length - 1
          ? h('button', { class: 'btn btn--p', onclick: () => { estado.i++; pintar(); } }, 'Próxima ›')
          : h('button', { class: 'btn btn--g', onclick: finalizar }, '✔ Finalizar'))));
  }

  function responder(resp) {
    if (estado.acabou || estado.finalizado) return;
    const q = questoes[estado.i];
    if (estado.respostas[estado.i] !== undefined && feedbackNaHora) return;
    estado.respostas[estado.i] = resp;
    const acertou = q.alternativas?.length ? resp === q.correta : null;
    if (acertou === false && modo === 'desafio') {
      estado.vidas--;
      if (estado.vidas <= 0) { estado.acabou = true; pintar(); setTimeout(finalizar, 900); return; }
    }
    if (feedbackNaHora) { pintar(); }
    else if (estado.i < questoes.length - 1) { estado.i++; pintar(); }
    else pintar();
  }

  function finalizar() {
    if (estado.finalizado) return;
    estado.finalizado = true;
    clearInterval(timer);
    const detalhes = questoes.map((q, i) => {
      const r = estado.respostas[i];
      const acertou = q.alternativas?.length ? r === q.correta : null;
      return { q, resposta: r, acertou };
    });
    const objetivas = detalhes.filter((d) => d.acertou !== null);
    const acertos = objetivas.filter((d) => d.acertou).length;
    const nota = objetivas.length ? round((acertos / objetivas.length) * 10, 1) : null;
    const minutosGastos = Math.max(1, Math.round((Date.now() - estado.inicio) / 60000));

    // grava tentativas (só de questões salvas no banco)
    for (const d of detalhes) {
      if (d.resposta === undefined || d.q.temporaria) continue;
      registrarTentativa({
        questaoId: d.q.id, conteudoId: d.q.conteudoId, materiaId: d.q.materiaId,
        acertou: !!d.acertou, resposta: String(d.resposta), modo,
      });
      // revisão espaçada do conteúdo
      if (d.q.conteudoId) {
        const c = getConteudo(d.q.conteudoId);
        if (c) atualizar('conteudos', c.id, { srs: proximaRevisao(c.srs, d.acertou ? 2 : 0) });
      }
    }
    registrarSessao({
      tipo: modo === 'treino' ? 'questoes' : modo, minutos: minutosGastos,
      materiaId: questoes[0]?.materiaId || null,
      venceu: modo === 'boss' ? (objetivas.length ? acertos / objetivas.length >= .8 : false) : undefined,
    });
    const xp = { treino: XP.questao * objetivas.length, simulado: XP.simulado, desafio: 80, boss: XP.boss, diagnostico: XP.diagnostico }[modo] || 30;
    const g = ganharXP(Math.round(xp), modo);
    tocarStreak(); recalcularDominios();
    const novas = verificarConquistas();

    tela.style.display = 'none';   // some com a sessão para o resultado ficar sozinho na tela
    resultado({ detalhes, acertos, total: objetivas.length, nota, minutosGastos, modo, g, novas, estado, sair, provaId });
  }

  pintar();
}

/* ---------- tela de resultado ---------- */
function resultado({ detalhes, acertos, total, nota, minutosGastos, modo, g, novas, estado, sair, provaId }) {
  const tela = h('div', { class: 'focus-full', style: { alignContent: 'start', paddingTop: '18px', overflowY: 'auto' } });
  document.body.append(tela);

  const porConteudo = {};
  for (const d of detalhes) {
    if (d.acertou === null) continue;
    const cid = d.q.conteudoId || 'geral';
    (porConteudo[cid] ||= { n: 0, ok: 0 });
    porConteudo[cid].n++; if (d.acertou) porConteudo[cid].ok++;
  }
  const linhas = Object.entries(porConteudo).map(([cid, v]) => ({
    rot: cid === 'geral' ? 'Geral' : (getConteudo(cid)?.nome || 'Conteúdo'),
    v: round((v.ok / v.n) * 100), max: 100,
    cor: v.ok / v.n >= .8 ? '#34d399' : v.ok / v.n >= .6 ? '#fbbf24' : '#f87171',
  })).sort((a, b) => a.v - b.v);

  const venceu = modo === 'boss' ? (total ? acertos / total >= .8 : false) : (modo === 'desafio' ? estado.vidas > 0 : null);
  const recomendar = linhas.filter((l) => l.v < 60).map((l) => l.rot);

  const caixaIA = h('div', { class: 'mt2' });
  tela.append(h('div', { style: { width: 'min(720px,100%)', textAlign: 'left' } },
    h('div', { class: 'center mb' },
      h('div', { style: { fontSize: '46px' } }, venceu === true ? '🏆' : venceu === false ? '💀' : nota >= 7 ? '🎉' : '📚'),
      h('div', { style: { fontSize: '38px', fontWeight: 800 } }, nota !== null ? `Nota ${nota}` : 'Concluído'),
      h('div', { class: 'muted' }, `${acertos}/${total} acertos · ${fmtMin(minutosGastos)} · +${g.qtd} XP`),
      venceu === true ? h('div', { class: 'chip ok mt' }, modo === 'boss' ? 'BOSS DERROTADO!' : 'Desafio vencido!') : null,
      venceu === false ? h('div', { class: 'chip bad mt' }, modo === 'boss' ? 'Faltou chegar a 80%' : 'Suas vidas acabaram') : null),
    g.subiu ? h('div', { class: 'card card--flat center mb' }, `🎮 Você subiu para o nível ${g.nivel}!`) : null,
    ...novas.map((c) => h('div', { class: 'card card--flat center mb' }, `${c.emoji} Conquista: ${c.nome}`)),
    linhas.length ? h('div', { class: 'card mb' },
      h('b', { class: 'small' }, '📊 Desempenho por conteúdo'),
      h('div', { class: 'mt' }, gBarrasH(linhas, { formato: (v) => `${v}%` }))) : null,
    recomendar.length ? h('div', { class: 'card card--flat mb' },
      h('b', { class: 'small' }, '🎯 Recomendação'),
      h('p', { class: 'small', style: { marginBottom: 0 } }, `Revisar: ${recomendar.join(', ')}. Esses conteúdos ficaram abaixo de 60%.`)) : null,
    temIA() && (modo === 'simulado' || modo === 'diagnostico')
      ? h('button', {
        class: 'btn btn--blk mb', onclick: async (e) => {
          e.target.disabled = true; e.target.textContent = 'Analisando…';
          try {
            const txt = await analisarSimulado({
              modo, nota, acertos, total,
              porConteudo: linhas.map((l) => ({ conteudo: l.rot, acerto: l.v })),
            });
            caixaIA.replaceChildren(h('div', { class: 'card' }, h('b', { class: 'small' }, '🤖 Análise do Study AI'),
              h('p', { class: 'small', style: { whiteSpace: 'pre-wrap', marginBottom: 0 } }, txt)));
          } catch (err) { toast(err.message, 'bad'); }
          e.target.disabled = false; e.target.textContent = '🤖 Analisar com o Study AI';
        },
      }, '🤖 Analisar com o Study AI') : null,
    caixaIA,
    h('div', { class: 'card mb' },
      h('b', { class: 'small' }, '📝 Gabarito'),
      h('div', { class: 'list mt' }, ...detalhes.map((d, i) => h('div', { class: 'row row--flat', style: { alignItems: 'flex-start' } },
        h('span', {}, d.acertou === null ? '✍️' : d.acertou ? '✅' : '❌'),
        h('div', { class: 'grow' },
          h('div', { class: 'small', style: { fontWeight: 600 } }, `${i + 1}. ${d.q.enunciado}`),
          d.q.alternativas?.length
            ? h('div', { class: 'tiny muted' },
              `sua resposta: ${d.resposta === undefined ? '— em branco —' : LETRAS[d.resposta] + ') ' + d.q.alternativas[d.resposta]}`
              + ` · correta: ${LETRAS[d.q.correta]}) ${d.q.alternativas[d.q.correta]}`)
            : h('div', { class: 'tiny muted' }, `esperado: ${d.q.resposta || '—'}`),
          d.q.explicacao ? h('div', { class: 'tiny', style: { marginTop: '3px' } }, `💡 ${d.q.explicacao}`) : null))))),
    h('div', { class: 'flexb' },
      h('button', { class: 'btn btn--p', onclick: () => { tela.remove(); sair(); } }, 'Concluir'),
      h('a', { class: 'btn sp', href: '#/revisao', onclick: () => { tela.remove(); sair(); } }, '🔁 Ver banco de erros'))));
}

/* ==========================================================
   FORM MANUAL
   ========================================================== */
export function formQuestao(q = null, aoSalvar = null) {
  const d = q || { enunciado: '', alternativas: ['', '', '', ''], correta: 0, explicacao: '', materiaId: '', conteudoId: '', tipo: 'objetiva', dificuldade: 'medio', resposta: '' };
  const f = {};
  f.enunciado = txtarea({ placeholder: 'Enunciado da questão', style: { minHeight: '80px' } }); f.enunciado.value = d.enunciado;
  f.materia = selMateria(d.materiaId);
  let selCont = sel(opcoesConteudos(d.materiaId), d.conteudoId);
  const wrapC = h('div', {}, selCont);
  f.materia.addEventListener('change', () => { selCont = sel(opcoesConteudos(f.materia.value), ''); wrapC.replaceChildren(selCont); });
  f.tipo = sel([{ v: 'objetiva', t: 'Objetiva' }, { v: 'vf', t: 'Verdadeiro/Falso' }, { v: 'discursiva', t: 'Discursiva' }], d.tipo);
  f.dif = sel(NIVEIS_QUESTAO.map((n) => ({ v: n.id, t: n.rot })), d.dificuldade);
  f.explicacao = txtarea({ placeholder: 'Explicação (aparece depois que responde)', style: { minHeight: '60px' } }); f.explicacao.value = d.explicacao;
  f.resposta = inp({ value: d.resposta, placeholder: 'Resposta esperada (discursiva)' });

  let alts = [...(d.alternativas?.length ? d.alternativas : ['', '', '', ''])];
  let correta = d.correta || 0;
  const altBox = h('div', { class: 'list' });
  const pintarAlts = () => {
    altBox.replaceChildren(...alts.map((a, i) => {
      const campoA = inp({ value: a, placeholder: `Alternativa ${LETRAS[i]}` });
      campoA.addEventListener('input', () => { alts[i] = campoA.value; });
      return h('div', { class: 'row row--flat' },
        h('input', { type: 'radio', name: 'correta', checked: i === correta || null, onchange: () => { correta = i; } }),
        h('span', { class: 'k grow' }, campoA),
        h('button', { class: 'icon-btn', onclick: () => { alts.splice(i, 1); if (correta >= alts.length) correta = 0; pintarAlts(); } }, '✕'));
    }));
    altBox.append(h('button', { class: 'btn btn--sm', onclick: () => { alts.push(''); pintarAlts(); } }, '+ alternativa'));
  };
  pintarAlts();

  modal(q ? '✏️ Editar questão' : '➕ Nova questão', h('div', {},
    campo('Enunciado', f.enunciado),
    h('div', { class: 'f-row' }, campo('Matéria', f.materia), campo('Conteúdo', wrapC)),
    h('div', { class: 'f-row' }, campo('Tipo', f.tipo), campo('Dificuldade', f.dif)),
    h('label', { class: 'f' }, h('span', {}, 'Alternativas (marque a correta)'), altBox),
    campo('Resposta esperada (se discursiva)', f.resposta),
    campo('Explicação', f.explicacao),
    h('div', { class: 'flexb mt2' },
      h('button', { class: 'btn sp', onclick: fecharModal }, 'Cancelar'),
      h('button', {
        class: 'btn btn--p', onclick: () => {
          const dados = {
            enunciado: f.enunciado.value.trim(), materiaId: f.materia.value || null, conteudoId: selCont.value || null,
            tipo: f.tipo.value, dificuldade: f.dif.value, explicacao: f.explicacao.value,
            alternativas: f.tipo.value === 'discursiva' ? [] : alts.filter((a) => a.trim()),
            correta, resposta: f.resposta.value, origem: 'manual',
          };
          if (!dados.enunciado) return toast('Escreva o enunciado', 'bad');
          if (q) atualizar('questoes', q.id, dados); else novaQuestao(dados);
          fecharModal(); toast('Questão salva', 'good'); aoSalvar?.();
        },
      }, 'Salvar'))));
}
