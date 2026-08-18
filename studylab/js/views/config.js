/* ===== views/config.js — configurações, Study AI, plano e seus dados ===== */
import { h, iso, fmtData, daysBetween, parseISO, today } from '../util.js';
import {
  st, set, aplicarTema, exportar, importar, zerar, carregarExemplo,
  ehPro, sairDaConta,
} from '../store.js';
import { botaoGoogle, googleConfigurado, sairDoGoogle } from '../auth.js';
import { comoLigarGoogle } from './entrar.js';
import { SERVIDOR } from '../produto.js';
import {
  titulo, cartao, kpi, toast, campo, inp, sel, txtarea, segmento, confirmar, modal, fecharModal,
  RECURSOS_PRO, selo,
} from '../ui.js';

export function render(el) {
  const pintar = () => { el.replaceChildren(); montar(el, pintar); };
  montar(el, pintar);
}

function montar(el, pintar) {
  const s = st();
  el.append(titulo('⚙️ Configurações', 'Perfil, ritmo de estudo, Study AI e seus dados.'));

  /* ---------- perfil ---------- */
  const nome = inp({ value: s.perfil.nome });
  const serie = inp({ value: s.perfil.serie, placeholder: 'Ex.: 8º ano' });
  const avatar = inp({ value: s.perfil.avatar, maxlength: 2, style: { maxWidth: '80px', textAlign: 'center', fontSize: '20px' } });
  el.append(cartao(
    h('b', {}, '👤 Perfil'),
    h('div', { class: 'f-row mt' }, campo('Nome', nome), campo('Série / ano', serie)),
    campo('Avatar (um emoji)', avatar),
    h('label', { class: 'f' }, h('span', {}, 'Tema'),
      segmento([{ v: 'escuro', t: '🌙 Escuro' }, { v: 'claro', t: '☀️ Claro' }], s.perfil.tema, (v) => {
        set((x) => { x.perfil.tema = v; }); aplicarTema();
      })),
    h('button', {
      class: 'btn btn--p', onclick: () => {
        set((x) => { x.perfil.nome = nome.value.trim() || 'Estudante'; x.perfil.serie = serie.value.trim(); x.perfil.avatar = avatar.value.trim() || '🎓'; });
        toast('Perfil salvo', 'good'); pintar();
      },
    }, 'Salvar perfil')));

  /* ---------- ritmo ---------- */
  const minDia = inp({ type: 'number', min: 15, step: 15, value: s.prefs.minutosDia });
  const bloco = inp({ type: 'number', min: 10, max: 90, step: 5, value: s.prefs.blocoFoco });
  const pausaC = inp({ type: 'number', min: 2, max: 20, value: s.prefs.pausaCurta });
  const pausaL = inp({ type: 'number', min: 5, max: 40, value: s.prefs.pausaLonga });
  const ciclos = inp({ type: 'number', min: 2, max: 8, value: s.prefs.ciclosAtePausaLonga });
  const stkMin = inp({ type: 'number', min: 5, max: 60, value: s.prefs.metaStreakMin });
  const stkQ = inp({ type: 'number', min: 1, max: 30, value: s.prefs.metaStreakQuestoes });
  el.append(h('div', { class: 'mt2' }, cartao(
    h('b', {}, '⏱️ Ritmo de estudo'),
    h('p', { class: 'tiny muted' }, 'Isso alimenta o plano do dia, o pomodoro e a exigência da sequência.'),
    h('div', { class: 'f-row mt' }, campo('Minutos por dia (meta)', minDia), campo('Bloco de foco (min)', bloco)),
    h('div', { class: 'f-row' }, campo('Pausa curta', pausaC), campo('Pausa longa', pausaL)),
    h('div', { class: 'f-row' }, campo('Ciclos até a pausa longa', ciclos), h('div')),
    h('div', { class: 'hr' }),
    h('b', { class: 'small' }, '🔥 O que mantém a sequência'),
    h('p', { class: 'tiny muted' }, 'De propósito é pouco: a ideia é não incentivar maratonas, e sim constância.'),
    h('div', { class: 'f-row' }, campo('Minutos mínimos no dia', stkMin), campo('OU questões no dia', stkQ)),
    h('button', {
      class: 'btn btn--p', onclick: () => {
        set((x) => {
          x.prefs.minutosDia = Number(minDia.value) || 90;
          x.prefs.blocoFoco = Number(bloco.value) || 25;
          x.prefs.pausaCurta = Number(pausaC.value) || 5;
          x.prefs.pausaLonga = Number(pausaL.value) || 15;
          x.prefs.ciclosAtePausaLonga = Number(ciclos.value) || 4;
          x.prefs.metaStreakMin = Number(stkMin.value) || 10;
          x.prefs.metaStreakQuestoes = Number(stkQ.value) || 5;
        });
        toast('Preferências salvas', 'good');
      },
    }, 'Salvar preferências'))));

  /* ---------- conta ---------- */
  const c = s.conta;
  const caixaGoogle = h('div', { style: { minHeight: '4px' } });
  el.append(h('div', { class: 'mt2' }, cartao(
    h('div', { class: 'flexb mb' }, h('b', {}, '👤 Conta'),
      h('span', { class: `chip sp ${c.provedor === 'google' ? 'ok' : ''}` },
        c.provedor === 'google' ? 'Google' : 'Sem conta')),
    c.provedor === 'google'
      ? h('div', { class: 'flexb' },
        c.foto ? h('img', { src: c.foto, referrerpolicy: 'no-referrer', style: { width: '42px', height: '42px', borderRadius: '50%' } }) : null,
        h('div', { class: 'grow' }, h('b', { class: 'small' }, c.nome || '—'), h('div', { class: 'tiny muted' }, c.email || '')),
        h('button', {
          class: 'btn btn--d', onclick: () => confirmar('Sair da conta?', 'Seus dados de estudo continuam salvos neste aparelho.', () => {
            sairDoGoogle(); sairDaConta(); location.reload();
          }),
        }, 'Sair'))
      : h('div', {},
        h('p', { class: 'small' }, googleConfigurado()
          ? 'Você está usando o StudyLab sem conta. Entre com o Google para identificar sua assinatura.'
          : 'Você está usando o StudyLab sem conta — tudo fica salvo só neste aparelho. Com o servidor ligado, '
            + 'isso já basta para assinar e usar o Study AI.'),
        caixaGoogle,
        googleConfigurado() ? null : h('button', { class: 'btn btn--sm mt', onclick: comoLigarGoogle }, '🔑 Como ligar o login do Google')))));
  if (c.provedor !== 'google' && googleConfigurado()) {
    botaoGoogle(caixaGoogle, () => { toast('Conectado!', 'good'); pintar(); }, (e) => toast(e.message, 'bad'));
  }

  /* ---------- plano ---------- */
  const pro = ehPro();
  const dias = c.proAte ? daysBetween(today(), parseISO(c.proAte)) : null;
  el.append(h('div', { class: 'mt2' }, cartao(
    h('div', { class: 'flexb mb' }, h('b', {}, '✨ Plano'),
      h('span', { class: `chip sp ${pro ? 'ok' : ''}` }, pro ? 'Pro' : 'Gratuito')),
    pro
      ? h('div', {},
        h('p', { class: 'small' }, dias === null ? 'Sua assinatura está ativa.'
          : `Ativo até ${fmtData(c.proAte)}${dias >= 0 ? ` — faltam ${dias} dia(s).` : ' (vencido).'}`),
        h('a', { class: 'btn', href: '#/planos' }, 'Gerenciar assinatura'))
      : h('div', {},
        h('p', { class: 'small' },
          'O StudyLab é gratuito e completo: prioridades, revisão espaçada, questões, flashcards, foco, desempenho e conquistas. '
          + 'O ', h('b', {}, 'Study AI'), ' — o tutor que conhece suas matérias, provas e erros — faz parte do plano Pro.'),
        h('div', { class: 'chips mb' }, ...RECURSOS_PRO.slice(0, 4).map((r) => h('span', { class: 'chip' }, r.nome))),
        h('a', { class: 'btn btn--p', href: '#/planos' }, '✨ Ver planos')))));

  /* ---------- status do Study AI (só leitura, sem chave nenhuma) ---------- */
  const ligado = !!(s.ia.servidor || SERVIDOR);
  el.append(h('div', { class: 'mt2' }, cartao(
    h('div', { class: 'flexb mb' }, h('b', {}, '🤖 Study AI'),
      h('span', { class: `chip sp ${ligado ? 'ok' : ''}` }, ligado ? 'ligado' : 'ainda não ligado')),
    h('p', { class: 'small', style: { marginBottom: 0 } }, ligado
      ? 'Quem tem o Pro conversa com o Study AI normalmente — nada para configurar aqui.'
      : 'O Study AI ainda não foi ligado pelo dono do app. Nada que você precise fazer: quando ligar, '
        + 'quem tiver o Pro passa a usar automaticamente.'))));

  /* ---------- dados ---------- */
  el.append(h('div', { class: 'mt2' }, cartao(
    h('b', {}, '💾 Seus dados'),
    h('p', { class: 'small' },
      'Tudo fica salvo apenas neste navegador. Nada é enviado para nenhum servidor (a única exceção são as chamadas de IA, '
      + 'que vão direto para a Anthropic quando você usa o Study AI). Faça backup de vez em quando.'),
    h('div', { class: 'grid g2 keep2 mt' },
      h('button', {
        class: 'btn btn--blk', onclick: () => {
          const blob = new Blob([exportar()], { type: 'application/json' });
          const a = h('a', { href: URL.createObjectURL(blob), download: `studylab-backup-${iso()}.json` });
          document.body.append(a); a.click(); a.remove();
          toast('Backup baixado', 'good');
        },
      }, '⬇️ Exportar backup'),
      h('button', {
        class: 'btn btn--blk', onclick: () => {
          const file = h('input', { type: 'file', accept: 'application/json' });
          file.addEventListener('change', () => {
            const fr = new FileReader();
            fr.onload = () => {
              try { importar(String(fr.result)); toast('Backup restaurado', 'good'); location.reload(); }
              catch (e) { toast(e.message, 'bad'); }
            };
            fr.readAsText(file.files[0]);
          });
          file.click();
        },
      }, '⬆️ Importar backup'),
      h('button', {
        class: 'btn btn--blk', onclick: () => confirmar('Recomeçar com dados de exemplo?', 'Tudo que você criou será apagado.', () => {
          zerar({ comExemplo: true }); toast('Dados de exemplo recriados', 'good'); location.reload();
        }),
      }, '🧪 Restaurar exemplo'),
      h('button', {
        class: 'btn btn--blk btn--d', onclick: () => confirmar('Apagar TUDO?', 'Matérias, tarefas, questões, histórico e XP. Não dá para desfazer.', () => {
          zerar({ comExemplo: false }); toast('Tudo apagado'); location.reload();
        }),
      }, '🗑️ Apagar tudo')))));

  // Toque 5 vezes na versão para abrir a Área do criador (o aluno nunca esbarra nisso).
  let toques = 0;
  el.append(h('p', {
    class: 'tiny muted center mt2', style: { cursor: 'default', userSelect: 'none' },
    onclick: () => {
      toques++;
      if (toques >= 5) { toques = 0; location.hash = '#/criador'; }
      else if (toques === 3) toast('Mais 2 toques…');
    },
  }, 'StudyLab · versão 1.1 · feito para funcionar offline'));
}
