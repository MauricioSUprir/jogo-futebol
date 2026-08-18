/* ===== views/entrar.js — criar conta e primeira configuração =====
   Aparece uma única vez, antes do app. Nada de dados de exemplo: o aluno diz
   quem é e quais matérias tem, e o StudyLab começa com a escola dele.         */
import { h, iso } from '../util.js';
import { st, set, entrarComo, novaMateria, concluirOnboarding, carregarExemplo } from '../store.js';
import { toast, inp, sel, campo, segmento, modal, fecharModal } from '../ui.js';
import { botaoGoogle, googleConfigurado } from '../auth.js';

/* ---------- catálogo de matérias por nível ---------- */
const M = (nome, emoji, cor) => ({ nome, emoji, cor });
const FUNDAMENTAL = [
  M('Português', '📖', '#f472b6'), M('Matemática', '📐', '#60a5fa'), M('História', '🏛️', '#fbbf24'),
  M('Geografia', '🌎', '#34d399'), M('Ciências', '🔬', '#22d3ee'), M('Inglês', '🌐', '#a78bfa'),
  M('Arte', '🎨', '#fb923c'), M('Educação Física', '⚽', '#4ade80'), M('Espanhol', '🇪🇸', '#f87171'),
  M('Redação', '✍️', '#c084fc'), M('Ensino Religioso', '🕊️', '#94a3b8'),
];
const MEDIO = [
  M('Português', '📖', '#f472b6'), M('Redação', '✍️', '#c084fc'), M('Literatura', '📚', '#e879f9'),
  M('Matemática', '📐', '#60a5fa'), M('Física', '🧲', '#38bdf8'), M('Química', '⚗️', '#22d3ee'),
  M('Biologia', '🧬', '#4ade80'), M('História', '🏛️', '#fbbf24'), M('Geografia', '🌎', '#34d399'),
  M('Filosofia', '🤔', '#a78bfa'), M('Sociologia', '👥', '#fb923c'), M('Inglês', '🌐', '#818cf8'),
  M('Espanhol', '🇪🇸', '#f87171'), M('Educação Física', '⚽', '#84cc16'), M('Arte', '🎨', '#f0abfc'),
];
const SERIES = [
  { v: '6º ano', t: '6º ano — fundamental' }, { v: '7º ano', t: '7º ano — fundamental' },
  { v: '8º ano', t: '8º ano — fundamental' }, { v: '9º ano', t: '9º ano — fundamental' },
  { v: '1º ano', t: '1º ano — médio' }, { v: '2º ano', t: '2º ano — médio' },
  { v: '3º ano', t: '3º ano — médio' }, { v: 'Cursinho', t: 'Cursinho / pré-vestibular' },
  { v: 'Outro', t: 'Outro' },
];
const ehMedio = (serie) => ['1º ano', '2º ano', '3º ano', 'Cursinho'].includes(serie);

export const precisaEntrar = () => !st().perfil.onboarding;

const MARCA = (tam = 84) => {
  const svg = document.querySelector('.boot__mark svg') || document.querySelector('.side__logo svg');
  const copia = svg ? svg.cloneNode(true) : h('span', { style: { fontSize: `${tam}px` } }, '📚');
  return h('div', { style: { width: `${tam}px`, color: 'var(--txt)', margin: '0 auto' } }, copia);
};

/* Botão do Google quando o Client ID ainda não foi colado em produto.js. */
function botaoGoogleFalso() {
  return h('button', {
    class: 'btn btn--blk', style: { height: '44px', borderRadius: '99px', fontWeight: 700 },
    onclick: () => comoLigarGoogle(),
  }, h('span', { style: { fontSize: '15px' } }, 'G'), 'Continuar com o Google');
}

function comoLigarGoogle() {
  modal('Ligar o login com o Google', h('div', {},
    h('p', { class: 'small', style: { marginTop: 0 } },
      'O botão do Google já está pronto no app — falta só criar o Client ID e colar em '
      + 'studylab/js/produto.js. Leva uns 5 minutos e é de graça.'),
    h('ol', { class: 'small', style: { paddingLeft: '20px', lineHeight: 1.8 } },
      h('li', {}, 'Abra ', h('a', { href: 'https://console.cloud.google.com', target: '_blank', rel: 'noopener' }, 'console.cloud.google.com'), ' e crie um projeto chamado StudyLab.'),
      h('li', {}, 'Vá em ', h('b', {}, 'APIs e serviços → Tela de permissão OAuth'), ', escolha ', h('b', {}, 'Externo'), ' e preencha nome do app e e-mail de contato.'),
      h('li', {}, 'Em ', h('b', {}, 'Credenciais → Criar credenciais → ID do cliente OAuth'), ', escolha ', h('b', {}, 'Aplicativo da Web'), '.'),
      h('li', {}, 'Em ', h('b', {}, 'Origens JavaScript autorizadas'), ', adicione ', h('code', {}, 'https://mauriciosuprir.github.io'), '.'),
      h('li', {}, 'Copie o ', h('b', {}, 'ID do cliente'), ' e cole em ', h('code', {}, 'studylab/js/produto.js'), ' na linha ', h('code', {}, 'GOOGLE_CLIENT_ID'), '.')),
    h('p', { class: 'tiny muted' },
      'Enquanto isso, dá para usar o app inteiro sem conta — os dados ficam salvos neste aparelho.'),
    h('button', { class: 'btn btn--p btn--blk mt', onclick: fecharModal }, 'Entendi')));
}

/* ==========================================================
   FLUXO
   ========================================================== */
export function abrirEntrada(aoConcluir) {
  const dados = { nome: '', serie: '8º ano', materias: new Set(), minutos: 90 };
  let passo = 0;

  const tela = h('div', { class: 'focus-full entrada', style: { alignContent: 'center', overflowY: 'auto', padding: '24px 16px' } });
  document.body.append(tela);
  document.body.style.overflow = 'hidden';

  const fechar = () => { tela.remove(); document.body.style.overflow = ''; aoConcluir?.(); };

  const cabecalho = (titulo, sub) => h('div', { class: 'center mb' },
    h('h1', { style: { fontSize: '22px', fontWeight: 800 } }, titulo),
    sub ? h('p', { class: 'muted small', style: { margin: '6px auto 0', maxWidth: '46ch' } }, sub) : null);

  const passos = (n) => h('div', { class: 'flexb', style: { justifyContent: 'center', gap: '6px', margin: '0 0 18px' } },
    ...[0, 1, 2, 3].map((i) => h('span', {
      style: {
        width: i === n ? '22px' : '7px', height: '7px', borderRadius: '99px',
        background: i <= n ? 'var(--acc)' : 'var(--line)', transition: 'width .2s',
      },
    })));

  const caixa = (...kids) => h('div', {
    class: 'card', style: { width: 'min(460px,100%)', margin: '0 auto', textAlign: 'left' },
  }, ...kids);

  /* ---------- passo 0: entrar ---------- */
  function boasVindas() {
    const google = h('div', { style: { display: 'flex', justifyContent: 'center', minHeight: '44px' } });
    const erroG = h('p', { class: 'tiny', style: { color: 'var(--bad)', textAlign: 'center' } });

    const conteudo = h('div', { style: { width: 'min(420px,100%)', margin: '0 auto' } },
      MARCA(88),
      h('div', { class: 'center', style: { marginTop: '14px' } },
        h('div', { class: 'wordmark', style: { fontSize: '30px' } }, 'Study', h('span', {}, 'Lab')),
        h('div', { class: 'tagline', style: { marginTop: '6px' } }, 'Estude', h('i', {}, '.'), ' Pratique', h('i', {}, '.'), ' Evolua', h('i', {}, '.'))),
      h('p', { class: 'muted center', style: { margin: '16px auto 20px', maxWidth: '38ch' } },
        'Sua vida escolar organizada: o que fazer agora, o que está atrasado, quando revisar e quanto falta para a prova.'),
      googleConfigurado() ? google : botaoGoogleFalso(), erroG,
      h('div', { class: 'flexb', style: { justifyContent: 'center', gap: '10px', margin: '14px 0 6px', color: 'var(--dim2)' } },
        h('span', { style: { flex: 1, height: '1px', background: 'var(--line)' } }),
        h('span', { class: 'tiny' }, 'ou'),
        h('span', { style: { flex: 1, height: '1px', background: 'var(--line)' } })),
      h('button', {
        class: 'btn btn--blk', style: { height: '44px' },
        onclick: () => { entrarComo({ provedor: 'local' }); passo = 1; pintar(); },
      }, 'Continuar sem conta'),
      h('p', { class: 'tiny muted center mt' },
        'Seus dados ficam no seu aparelho. Sem conta, eles não passam para outro celular.'),
      h('div', { class: 'center mt2' },
        h('button', {
          class: 'btn btn--sm', style: { background: 'none', border: 0, color: 'var(--dim2)' },
          onclick: () => { carregarExemplo(); toast('App aberto com dados de exemplo', 'good'); fechar(); },
        }, 'ver o app com dados de exemplo')));

    tela.replaceChildren(conteudo);
    if (googleConfigurado()) {
      botaoGoogle(google, () => { passo = 1; pintar(); }, (e) => { erroG.textContent = e.message; });
    }
  }

  /* ---------- passo 1: quem é você ---------- */
  function perfil() {
    const nome = inp({ placeholder: 'Como quer ser chamado?', value: dados.nome || st().conta.nome?.split(' ')[0] || '' });
    const serie = sel(SERIES, dados.serie);
    tela.replaceChildren(h('div', { style: { width: 'min(460px,100%)', margin: '0 auto' } },
      passos(0),
      cabecalho('Prazer, quem é você? 👋', 'Só isso já muda como o app fala com você.'),
      caixa(
        campo('Seu nome', nome),
        campo('Em que ano você está', serie),
        h('button', {
          class: 'btn btn--p btn--blk mt', onclick: () => {
            dados.nome = nome.value.trim() || 'Estudante';
            dados.serie = serie.value;
            passo = 2; pintar();
          },
        }, 'Continuar'))));
  }

  /* ---------- passo 2: matérias ---------- */
  function materias() {
    const lista = ehMedio(dados.serie) ? MEDIO : FUNDAMENTAL;
    const grade = h('div', { class: 'chips' });
    const extras = [];
    const pintarChips = () => {
      grade.replaceChildren(...[...lista, ...extras].map((m) => {
        const on = dados.materias.has(m.nome);
        return h('button', {
          class: `chip ${on ? 'chip--on' : ''}`,
          style: { cursor: 'pointer', padding: '7px 12px', fontSize: '13px', borderColor: on ? m.cor + '99' : undefined },
          onclick: () => { on ? dados.materias.delete(m.nome) : dados.materias.add(m.nome); pintarChips(); },
        }, `${m.emoji} ${m.nome}`);
      }));
    };
    pintarChips();

    const nova = inp({ placeholder: 'Outra matéria (ex.: Robótica)' });
    const adicionar = () => {
      const n = nova.value.trim(); if (!n) return;
      if (![...lista, ...extras].some((m) => m.nome.toLowerCase() === n.toLowerCase())) {
        extras.push(M(n, '📘', '#7c5cff'));
      }
      dados.materias.add(n); nova.value = ''; pintarChips();
    };
    nova.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); adicionar(); } });

    tela.replaceChildren(h('div', { style: { width: 'min(560px,100%)', margin: '0 auto' } },
      passos(1),
      cabecalho('Quais matérias você tem?',
        'O StudyLab não adivinha sua grade — você escolhe aqui e pode mudar quando quiser. Toque para marcar.'),
      caixa(
        grade,
        h('div', { class: 'flexb mt' }, nova, h('button', { class: 'btn', onclick: adicionar }, '+ Adicionar')),
        h('div', { class: 'flexb mt2' },
          h('button', { class: 'btn', onclick: () => { passo = 1; pintar(); } }, '‹ Voltar'),
          h('button', {
            class: 'btn btn--p sp', onclick: () => {
              if (!dados.materias.size) return toast('Escolha pelo menos uma matéria', 'bad');
              passo = 3; pintar();
            },
          }, `Continuar (${dados.materias.size})`)))));
  }

  /* ---------- passo 3: ritmo ---------- */
  function ritmo() {
    tela.replaceChildren(h('div', { style: { width: 'min(460px,100%)', margin: '0 auto' } },
      passos(2),
      cabecalho('Quanto tempo por dia?',
        'É a base do plano diário. Comece baixo: é melhor cumprir 30 minutos do que falhar em 3 horas.'),
      caixa(
        segmento([
          { v: 30, t: '30 min' }, { v: 60, t: '1 hora' }, { v: 90, t: '1h30' }, { v: 120, t: '2 horas' },
        ], dados.minutos, (v) => { dados.minutos = Number(v); }),
        h('p', { class: 'tiny muted mt' }, 'Dá para mudar depois em Configurações.'),
        h('div', { class: 'flexb mt2' },
          h('button', { class: 'btn', onclick: () => { passo = 2; pintar(); } }, '‹ Voltar'),
          h('button', { class: 'btn btn--p sp', onclick: () => { passo = 4; pintar(); } }, 'Continuar')))));
  }

  /* ---------- passo 4: pronto ---------- */
  function pronto() {
    tela.replaceChildren(h('div', { style: { width: 'min(460px,100%)', margin: '0 auto' } },
      passos(3),
      MARCA(),
      cabecalho(`Tudo pronto, ${dados.nome}! 🎉`,
        'Seu StudyLab começa vazio de propósito — só com o que é seu. O próximo passo é cadastrar a primeira tarefa ou prova.'),
      caixa(
        h('div', { class: 'list' },
          h('div', { class: 'row row--flat' }, h('span', {}, '📚'),
            h('span', { class: 'grow small' }, `${dados.materias.size} matérias`)),
          h('div', { class: 'row row--flat' }, h('span', {}, '⏱️'),
            h('span', { class: 'grow small' }, `${dados.minutos} minutos de estudo por dia`)),
          h('div', { class: 'row row--flat' }, h('span', {}, '🎓'),
            h('span', { class: 'grow small' }, dados.serie))),
        h('button', {
          class: 'btn btn--p btn--blk btn--xl mt2', onclick: () => {
            const catalogo = [...FUNDAMENTAL, ...MEDIO];
            for (const nome of dados.materias) {
              const base = catalogo.find((m) => m.nome === nome) || M(nome, '📘', '#7c5cff');
              novaMateria({ nome: base.nome, emoji: base.emoji, cor: base.cor, meta: 9 });
            }
            set((s) => {
              s.perfil.nome = dados.nome;
              s.perfil.serie = dados.serie;
              s.prefs.minutosDia = dados.minutos;
            });
            concluirOnboarding();
            toast(`Bem-vindo ao StudyLab, ${dados.nome}!`, 'good');
            fechar();
          },
        }, '▶ Entrar no StudyLab'))));
  }

  function pintar() {
    [boasVindas, perfil, materias, ritmo, pronto][passo]();
    tela.scrollTop = 0;
  }
  pintar();
}
