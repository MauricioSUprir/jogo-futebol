/* ===== views/config.js — configurações, Study AI, plano e seus dados ===== */
import { h, iso, fmtData, daysBetween, parseISO, today } from '../util.js';
import {
  st, set, aplicarTema, exportar, importar, zerar, carregarExemplo,
  ehPro, sairDaConta,
} from '../store.js';
import { botaoGoogle, googleConfigurado, sairDoGoogle } from '../auth.js';
import { comoLigarGoogle } from './entrar.js';
import { SERVIDOR } from '../produto.js';
import { saudeDoServidor } from '../api.js';
import {
  titulo, cartao, kpi, toast, campo, inp, sel, txtarea, segmento, confirmar, modal, fecharModal,
  RECURSOS_PRO, selo,
} from '../ui.js';
import { MODELOS, chamar } from '../ai.js';

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

  /* ---------- área do criador ---------- */
  const endServidor = inp({ value: s.ia.servidor || '', placeholder: 'https://...up.railway.app' });
  const chaveCriador = inp({ type: 'password', value: s.ia.chaveCriador || '', placeholder: 'sk-ant-… (plano B, só para testes)' });
  const modelo = sel(MODELOS.map((m) => ({ v: m.id, t: m.nome })), s.ia.modelo);
  const statusServidor = h('div', { class: 'tiny muted mt' });

  el.append(h('div', { class: 'mt2' }, cartao(
    h('details', {},
      h('summary', { style: { cursor: 'pointer', fontWeight: 700, fontSize: '13.5px' } }, '🛠️ Área do criador'),
      h('p', { class: 'small mt' },
        'Esta parte não é para o aluno. Depois de publicar o ', h('b', {}, 'studylab-server'),
        ' (Railway), cole aqui o endereço que ele gerar: o Study AI e o pagamento passam a funcionar '
        + 'para todo mundo, sem precisar mexer no código.'),
      campo('Endereço do servidor', endServidor),
      h('div', { class: 'flexb' },
        h('button', {
          class: 'btn btn--p', onclick: () => {
            set((x) => { x.ia.servidor = endServidor.value.trim().replace(/\/$/, ''); });
            toast('Endereço salvo', 'good'); pintar();
          },
        }, 'Salvar endereço'),
        h('button', {
          class: 'btn', onclick: async (e) => {
            set((x) => { x.ia.servidor = endServidor.value.trim().replace(/\/$/, ''); });
            if (!endServidor.value.trim()) return toast('Cole o endereço primeiro', 'bad');
            e.target.disabled = true; e.target.textContent = 'Testando…';
            try {
              const d = await saudeDoServidor();
              statusServidor.replaceChildren(
                h('div', {}, `✅ servidor no ar · banco ${d.banco} · modelo ${d.modelo}`),
                h('div', { style: { marginTop: '4px' } },
                  `${d.studyAiPronto ? '✅' : '❌'} Study AI pronto · `,
                  `${d.pagamentoPronto ? '✅' : '❌'} pagamento pronto · `,
                  `${d.googleConfigurado ? '✅' : '○'} Google (opcional)`),
                ...(d.falta?.length
                  ? [h('div', { style: { marginTop: '6px' } }, 'Ainda falta configurar no servidor:'),
                    h('ul', { style: { margin: '4px 0 0', paddingLeft: '18px' } }, ...d.falta.map((f) => h('li', {}, f)))]
                  : [h('div', { style: { marginTop: '6px', color: 'var(--ok)' } }, 'Tudo configurado. 🎉')]));
              toast(d.falta?.length ? 'Servidor no ar, mas falta configuração' : 'Tudo pronto! 🎉', d.falta?.length ? '' : 'good');
            } catch (err) { statusServidor.textContent = `❌ ${err.message}`; toast(err.message, 'bad'); }
            e.target.disabled = false; e.target.textContent = '🔌 Testar servidor';
          },
        }, '🔌 Testar servidor')),
      statusServidor,
      h('div', { class: 'flexb mt' },
        h('button', {
          class: 'btn btn--sm', onclick: (e) => {
            const bytes = new Uint8Array(32);
            crypto.getRandomValues(bytes);
            const segredo = [...bytes].map((b) => b.toString(36)).join('').slice(0, 48);
            navigator.clipboard?.writeText(segredo);
            e.target.parentElement.querySelector('code').textContent = segredo;
            toast('SEGREDO copiado — cole no Railway', 'good');
          },
        }, '🎲 Gerar SEGREDO'),
        h('code', { class: 'tiny muted', style: { wordBreak: 'break-all' } }, 'clique para gerar')),
      h('div', { class: 'hr' }),
      h('p', { class: 'tiny muted' },
        'Sem servidor, dá para testar a IA colando uma chave da Claude API aqui — funciona só neste aparelho '
        + 'e só com o Pro ativo. Assim que houver servidor, esta chave deixa de ser usada.'),
      h('div', { class: 'f-row' }, campo('Chave da Claude API', chaveCriador), campo('Modelo (sem servidor)', modelo)),
      h('div', { class: 'flexb' },
        h('button', {
          class: 'btn', onclick: () => {
            set((x) => { x.ia.chaveCriador = chaveCriador.value.trim(); x.ia.modelo = modelo.value; });
            toast('Salvo', 'good'); pintar();
          },
        }, 'Salvar chave'),
        h('button', {
          class: 'btn', onclick: async (e) => {
            set((x) => { x.ia.chaveCriador = chaveCriador.value.trim(); x.ia.modelo = modelo.value; });
            if (!ehPro()) return toast('Ative o Pro primeiro (em Planos) para testar', 'bad');
            e.target.disabled = true; e.target.textContent = 'Testando…';
            try { await chamar({ system: 'Responda apenas: ok', conteudo: 'teste', maxTokens: 20, esforco: 'low' }); toast('Study AI funcionando! 🎉', 'good'); }
            catch (err) { toast(err.message, 'bad'); }
            e.target.disabled = false; e.target.textContent = '🔌 Testar Study AI';
          },
        }, '🔌 Testar Study AI')),
      h('p', { class: 'tiny muted mt' },
        `Servidor: ${s.ia.servidor || SERVIDOR || 'nenhum'} · chamadas hoje: ${s.ia.usoHoje || 0}`))))); 

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

  el.append(h('p', { class: 'tiny muted center mt2' }, 'StudyLab · versão 1.0 · feito para funcionar offline'));
}
