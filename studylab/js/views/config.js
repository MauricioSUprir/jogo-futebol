/* ===== views/config.js — configurações, Study AI, plano e seus dados ===== */
import { h, iso } from '../util.js';
import { st, set, aplicarTema, exportar, importar, zerar } from '../store.js';
import {
  titulo, cartao, kpi, toast, campo, inp, sel, txtarea, segmento, confirmar, modal, fecharModal,
  COBRANCA_ATIVA, RECURSOS, LIMITES_FREE, ehPro, selo,
} from '../ui.js';
import { MODELOS, temIA, chamar } from '../ai.js';

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

  /* ---------- Study AI ---------- */
  const chave = inp({ type: 'password', value: s.ia.chave, placeholder: 'sk-ant-...' });
  const modelo = sel(MODELOS.map((m) => ({ v: m.id, t: m.nome })), s.ia.modelo);
  const statusEl = h('span', { class: `chip ${temIA() ? 'ok' : ''}` }, temIA() ? '✅ configurado' : '○ desligado');
  el.append(h('div', { class: 'mt2' }, cartao(
    h('div', { class: 'flexb mb' }, h('b', {}, '🤖 Study AI'), h('span', { class: 'sp' }, statusEl)),
    h('p', { class: 'small' },
      'O StudyLab roda inteiro no seu aparelho, sem servidor. Para usar as funções de IA (explicações, geração de questões e flashcards, '
      + 'resumos, professor socrático, leitura de PDF e foto), cole aqui uma chave da Claude API.'),
    h('details', { class: 'card card--flat mb' },
      h('summary', { style: { cursor: 'pointer', fontWeight: 700, fontSize: '13.5px' } }, '📋 Como conseguir a chave — passo a passo'),
      h('ol', { class: 'small', style: { margin: '10px 0 0', paddingLeft: '20px', lineHeight: 1.7 } },
        h('li', {}, 'Abra ', h('a', { href: 'https://console.anthropic.com', target: '_blank', rel: 'noopener' }, 'console.anthropic.com'),
          ' e crie uma conta (serve o mesmo e-mail que você já usa no Claude).'),
        h('li', {}, 'No menu, vá em ', h('b', {}, 'Billing'), ' e coloque um cartão. Sem crédito a chave existe, mas toda chamada falha.'),
        h('li', {}, 'Adicione crédito. ', h('b', {}, 'US$ 5 já dura muito tempo'), ' para o uso de um aluno.'),
        h('li', {}, 'Vá em ', h('b', {}, 'API Keys'), ' → ', h('b', {}, 'Create Key'), '. Dê um nome (ex.: "StudyLab") e crie.'),
        h('li', {}, 'Copie a chave ', h('b', {}, 'na hora'), ' — ela começa com ', h('code', {}, 'sk-ant-'), ' e o site só mostra uma vez.'),
        h('li', {}, 'Cole no campo abaixo, clique em ', h('b', {}, 'Salvar'), ' e depois em ', h('b', {}, '🔌 Testar conexão'), '.')),
      h('p', { class: 'tiny muted', style: { marginBottom: 0 } },
        'Quanto custa: você paga por uso, não por mês. Uma pergunta ao Study AI ou um lote de 5 questões custa poucos centavos de dólar. '
        + 'O modelo Haiku 4.5 é o mais barato; o Opus 5 é o mais capaz. Dá para trocar aqui embaixo a qualquer momento.')),
    h('div', { class: 'card card--flat mb' },
      h('b', { class: 'small' }, '🔒 Sobre a segurança da chave'),
      h('ul', { class: 'tiny muted', style: { margin: '6px 0 0', paddingLeft: '18px' } },
        h('li', {}, 'A chave é guardada só neste navegador (localStorage) e vai direto do seu aparelho para a Anthropic.'),
        h('li', {}, 'Quem usar este mesmo aparelho/navegador consegue recuperá-la — não use em computador compartilhado.'),
        h('li', {}, 'O uso é cobrado na sua conta da Anthropic. Cada pergunta custa centavos, mas custa.'),
        h('li', {}, 'Dá para apagar a chave a qualquer momento no botão abaixo.'))),
    h('div', { class: 'f-row' }, campo('Chave da API', chave), campo('Modelo', modelo)),
    h('div', { class: 'flexb' },
      h('button', {
        class: 'btn btn--p', onclick: () => {
          set((x) => { x.ia.chave = chave.value.trim(); x.ia.modelo = modelo.value; x.ia.ligada = !!chave.value.trim(); });
          toast('Study AI atualizado', 'good'); pintar();
        },
      }, 'Salvar'),
      h('button', {
        class: 'btn', onclick: async (e) => {
          set((x) => { x.ia.chave = chave.value.trim(); x.ia.modelo = modelo.value; });
          if (!chave.value.trim()) return toast('Cole a chave primeiro', 'bad');
          e.target.disabled = true; e.target.textContent = 'Testando…';
          try {
            await chamar({ system: 'Responda apenas: ok', conteudo: 'teste', maxTokens: 20, esforco: 'low' });
            toast('Conexão funcionando! 🎉', 'good');
          } catch (err) { toast(err.message, 'bad'); }
          e.target.disabled = false; e.target.textContent = '🔌 Testar conexão';
        },
      }, '🔌 Testar conexão'),
      s.ia.chave ? h('button', {
        class: 'btn btn--d sp', onclick: () => confirmar('Apagar a chave?', 'As funções de IA voltam ao modo local.', () => {
          set((x) => { x.ia.chave = ''; x.ia.ligada = false; }); toast('Chave apagada'); pintar();
        }),
      }, 'Apagar chave') : null),
    h('p', { class: 'tiny muted mt' }, `Chamadas hoje: ${s.ia.usoHoje || 0}`))));

  /* ---------- plano ---------- */
  const gratis = RECURSOS.filter((r) => !r.pro);
  const pro = RECURSOS.filter((r) => r.pro);
  el.append(h('div', { class: 'mt2' }, cartao(
    h('div', { class: 'flexb mb' }, h('b', {}, '💳 Plano'),
      h('span', { class: `chip sp ${ehPro(s) ? 'ok' : ''}` }, ehPro(s) ? 'Pro' : 'Gratuito')),
    COBRANCA_ATIVA
      ? null
      : h('p', { class: 'small' },
        'Hoje o StudyLab é gratuito e sem nenhum bloqueio. O plano pago já está desenhado no código '
        + '(um único porteiro, a função liberado(), decide tudo) — quando for a hora, é ligar a chave e plugar o pagamento.'),
    h('div', { class: 'grid g2 mt' },
      h('div', { class: 'card card--flat' },
        h('b', { class: 'small' }, '🆓 Gratuito — para sempre'),
        h('ul', { class: 'small', style: { paddingLeft: '18px', margin: '8px 0 0', lineHeight: 1.6 } },
          ...gratis.map((r) => h('li', {}, r.nome))),
        COBRANCA_ATIVA
          ? h('p', { class: 'tiny muted', style: { marginBottom: 0 } },
            `Limites: ${LIMITES_FREE.iaPorDia} chamadas de IA por dia, ${LIMITES_FREE.arquivosPorDia} arquivos por dia.`)
          : null),
      h('div', { class: 'card card--flat', style: { borderColor: '#f59e0b55' } },
        h('div', { class: 'flexb' }, h('b', { class: 'small' }, 'Pro'), h('span', { class: 'sp' }, selo())),
        h('ul', { class: 'small', style: { paddingLeft: '18px', margin: '8px 0 0', lineHeight: 1.6 } },
          ...pro.map((r) => h('li', {}, r.nome))),
        h('button', {
          class: 'btn btn--p btn--blk mt', disabled: !COBRANCA_ATIVA || null,
          onclick: () => toast('Assinatura ainda não disponível'),
        }, COBRANCA_ATIVA ? 'Assinar o Pro' : 'Em breve'))))));

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
