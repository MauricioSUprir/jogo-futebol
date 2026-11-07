/* ===== views/entrar.js — criar conta e primeira configuração =====
   Aparece uma única vez, antes do app. Nada de dados de exemplo: o aluno diz
   quem é e quais matérias tem, e o MindTrack começa com a escola dele.         */
import { h, iso } from '../util.js';
import { st, set, novaMateria, concluirOnboarding, carregarExemplo } from '../store.js';
import { toast, inp, sel, campo, segmento, modal, fecharModal } from '../ui.js';
import { temServidor, criarContaNoServidor, entrarComEmail, pedirCodigo, novaSenha, configConexoes, iniciarGoogle, trocarTicket, garantirSessao } from '../api.js';
import { comprimirImagem } from '../fotos.js';

/* ---------- catálogo de matérias por nível ---------- */
const M = (nome, emoji, cor) => ({ nome, emoji, cor });
const FUND1 = [
  M('Português', '📖', '#f472b6'), M('Matemática', '📐', '#60a5fa'), M('Ciências', '🔬', '#f1d794'),
  M('História', '🏛️', '#fbbf24'), M('Geografia', '🌎', '#34d399'), M('Inglês', '🌐', '#a78bfa'),
  M('Arte', '🎨', '#fb923c'), M('Educação Física', '⚽', '#4ade80'), M('Ensino Religioso', '🕊️', '#94a3b8'),
];
const FUNDAMENTAL = [
  M('Português', '📖', '#f472b6'), M('Matemática', '📐', '#60a5fa'), M('História', '🏛️', '#fbbf24'),
  M('Geografia', '🌎', '#34d399'), M('Ciências', '🔬', '#f1d794'), M('Inglês', '🌐', '#a78bfa'),
  M('Arte', '🎨', '#fb923c'), M('Educação Física', '⚽', '#4ade80'), M('Espanhol', '🇪🇸', '#f87171'),
  M('Redação', '✍️', '#c084fc'), M('Ensino Religioso', '🕊️', '#94a3b8'),
];
const MEDIO = [
  M('Português', '📖', '#f472b6'), M('Redação', '✍️', '#c084fc'), M('Literatura', '📚', '#e879f9'),
  M('Matemática', '📐', '#60a5fa'), M('Física', '🧲', '#38bdf8'), M('Química', '⚗️', '#f1d794'),
  M('Biologia', '🧬', '#4ade80'), M('História', '🏛️', '#fbbf24'), M('Geografia', '🌎', '#34d399'),
  M('Filosofia', '🤔', '#a78bfa'), M('Sociologia', '👥', '#fb923c'), M('Inglês', '🌐', '#818cf8'),
  M('Espanhol', '🇪🇸', '#f87171'), M('Educação Física', '⚽', '#84cc16'), M('Arte', '🎨', '#f0abfc'),
];
/* Do 1º ano até a faculdade. Os valores levam o nível junto porque "1º ano"
   sozinho seria ambíguo (existe no fundamental e no médio). */
export const SERIES = [
  { v: '1º ano do fundamental', t: '1º ano — fundamental' },
  { v: '2º ano do fundamental', t: '2º ano — fundamental' },
  { v: '3º ano do fundamental', t: '3º ano — fundamental' },
  { v: '4º ano do fundamental', t: '4º ano — fundamental' },
  { v: '5º ano do fundamental', t: '5º ano — fundamental' },
  { v: '6º ano', t: '6º ano — fundamental' },
  { v: '7º ano', t: '7º ano — fundamental' },
  { v: '8º ano', t: '8º ano — fundamental' },
  { v: '9º ano', t: '9º ano — fundamental' },
  { v: '1º ano do médio', t: '1º ano — ensino médio' },
  { v: '2º ano do médio', t: '2º ano — ensino médio' },
  { v: '3º ano do médio', t: '3º ano — ensino médio' },
  { v: 'Técnico', t: 'Curso técnico' },
  { v: 'Cursinho', t: 'Cursinho / pré-vestibular' },
  { v: 'EJA', t: 'EJA — educação de jovens e adultos' },
  { v: 'Faculdade', t: 'Faculdade / ensino superior' },
  { v: 'Concurso', t: 'Estudando para concurso' },
  { v: 'Outro', t: 'Outro' },
];

const ehMedio = (serie) => ['1º ano do médio', '2º ano do médio', '3º ano do médio',
  'Cursinho', 'Técnico', 'EJA', 'Faculdade', 'Concurso',
  '1º ano', '2º ano', '3º ano'].includes(serie);   // os três últimos: contas antigas
const ehFund1 = (serie) => /^[1-5]º ano do fundamental$/.test(serie);

/** Quais matérias sugerir para quem está nesse ano. */
export function materiasSugeridas(serie) {
  if (ehFund1(serie)) return FUND1;
  if (ehMedio(serie)) return MEDIO;
  return FUNDAMENTAL;
}

export const precisaEntrar = () => !st().perfil.onboarding;

const MARCA = (tam = 84) => {
  const svg = document.querySelector('.boot__mark svg') || document.querySelector('.side__logo svg');
  const copia = svg ? svg.cloneNode(true) : h('span', { style: { fontSize: `${tam}px` } }, '📚');
  return h('div', { style: { width: `${tam}px`, color: 'var(--txt)', margin: '0 auto' } }, copia);
};

/* Como ligar o login do Google — mora em Configurações, não na cara do aluno. */
export function comoLigarGoogle() {
  modal('Ligar o login com o Google', h('div', {},
    h('p', { class: 'small', style: { marginTop: 0 } },
      'O botão do Google já está pronto no app — falta só criar o Client ID e colar em '
      + 'studylab/js/produto.js. Leva uns 5 minutos e é de graça.'),
    h('ol', { class: 'small', style: { paddingLeft: '20px', lineHeight: 1.8 } },
      h('li', {}, 'Abra ', h('a', { href: 'https://console.cloud.google.com', target: '_blank', rel: 'noopener' }, 'console.cloud.google.com'), ' e crie um projeto chamado MindTrack.'),
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
  const dados = { nome: '', serie: '6º ano', materias: new Set(), minutos: 90 };
  let passo = 0;

  const tela = h('div', { class: 'focus-full entrada', style: { alignContent: 'center', overflowY: 'auto', padding: '24px 16px' } });
  document.body.append(tela);
  document.body.style.overflow = 'hidden';

  const fechar = () => { tela.remove(); document.body.style.overflow = ''; aoConcluir?.(); };

  const ticket = (/[?&]entrou=([^&]+)/.exec(location.hash) || [])[1];
  if (ticket) {
    history.replaceState(null, '', `${location.pathname}${location.search}#/ai`);   // antes da tela de Conexões ver
    tela.replaceChildren(h('div', { class: 'center' }, MARCA(72), h('p', { class: 'muted' }, 'Entrando com o Google…')));
    trocarTicket(decodeURIComponent(ticket))
      .then((r) => { dados.nome = (r.usuario?.nome || '').split(' ')[0]; passo = 1; pintar(); })
      .catch((e) => { toast(e.message, 'bad'); passo = 0; pintar(); });
    return;
  }

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

  /* ---------- passo 0: criar conta (ou entrar) — o questionário só vem depois ---------- */
  function boasVindas() {
    let modo = 'criar';          // 'criar' | 'entrar' | 'codigo' (conta nova) | 'esqueci'
    let foto = '';
    let comCodigo = false;       // o servidor manda o código por e-mail? (vem do /conexoes/config)
    let esqueciEtapa = 1;
    const erro = h('p', { class: 'tiny', role: 'alert', style: { color: 'var(--bad)', textAlign: 'center', minHeight: '16px', margin: '8px 0 0' } });
    const caixaGoogle = h('div', {});
    const formulario = h('div', {});

    const nome = inp({ placeholder: 'Seu nome', autocomplete: 'name' });
    const email = inp({ placeholder: 'seu@email.com', type: 'email', autocomplete: 'email', inputmode: 'email' });
    const telefone = inp({ placeholder: '(11) 98765-4321', type: 'tel', autocomplete: 'tel', inputmode: 'tel' });
    const senha = inp({ placeholder: 'Pelo menos 8 caracteres', type: 'password', autocomplete: 'new-password' });
    const emailEntrar = inp({ placeholder: 'seu@email.com', type: 'email', autocomplete: 'email', inputmode: 'email' });
    const codigo = inp({ placeholder: '000000', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 6, class: 'inp conta-codigo' });
    const codigoSenha = inp({ placeholder: '000000', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 6, class: 'inp conta-codigo' });
    const senhaNova = inp({ placeholder: 'Pelo menos 8 caracteres', type: 'password', autocomplete: 'new-password' });
    for (const c of [codigo, codigoSenha]) c.addEventListener('input', () => { c.value = c.value.replace(/\D/g, '').slice(0, 6); });
    const senhaEntrar = inp({ placeholder: 'Sua senha', type: 'password', autocomplete: 'current-password' });
    const aceite = h('input', { type: 'checkbox', id: 'aceite' });
    const previa = h('div', { class: 'conta-foto', 'aria-hidden': 'true' }, '📷');
    const arquivo = h('input', { type: 'file', accept: 'image/*', hidden: true });
    arquivo.addEventListener('change', async () => {
      const f = arquivo.files?.[0]; arquivo.value = '';
      if (!f) return;
      try {
        foto = await comprimirImagem(f, { max: 256, qualidade: 0.8 });
        previa.replaceChildren(h('img', { src: foto, alt: 'Sua foto' }));
      } catch (e) { erro.textContent = e.message; }
    });

    const enviar = async (botao, acao) => {
      erro.textContent = '';
      if (!temServidor()) { erro.textContent = 'O servidor do MindTrack não está ligado agora.'; return; }
      const texto = botao.textContent;
      botao.disabled = true; botao.textContent = 'Um instante…';
      try { await acao(); } catch (e) { erro.textContent = e.message; }
      botao.disabled = false;
      if (botao.textContent === 'Um instante…') botao.textContent = texto;   // a etapa pode ter trocado o texto
    };

    const dadosConta = () => ({
      nome: nome.value.trim(), email: email.value.trim(), telefone: telefone.value.trim(), senha: senha.value, foto,
    });
    const conferirCampos = () => {
      if (nome.value.trim().length < 2) throw new Error('Escreva seu nome.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) throw new Error('Esse e-mail não parece certo.');
      if (telefone.value.replace(/\D/g, '').length < 10) throw new Error('Coloque o WhatsApp com DDD.');
      if (senha.value.length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
      if (!aceite.checked) throw new Error('Marque que você leu e aceita os termos.');
    };
    const contaCriada = (r) => {
      set((x) => { x.conta.foto = foto || x.conta.foto; });
      dados.nome = nome.value.trim().split(' ')[0];
      toast(r.whatsapp === 'enviado' ? 'Conta criada! Mandamos uma mensagem no seu WhatsApp 📲' : 'Conta criada! 🎉', 'good');
      passo = 1; pintar();
    };

    const btnCriar = h('button', {
      class: 'btn btn--p btn--blk btn--xl mt', onclick: () => enviar(btnCriar, async () => {
        conferirCampos();
        if (comCodigo) {                       // 1º o código no e-mail, depois a conta
          await pedirCodigo(email.value.trim(), 'criar', nome.value.trim());
          modo = 'codigo'; pintarForm();
          setTimeout(() => codigo.focus(), 50);
          return;
        }
        const r = await criarContaNoServidor(dadosConta());
        contaCriada(r);
      }),
    }, 'Criar minha conta');

    const btnConfirmar = h('button', {
      class: 'btn btn--p btn--blk btn--xl mt', onclick: () => enviar(btnConfirmar, async () => {
        if (!/^\d{6}$/.test(codigo.value)) throw new Error('O código tem 6 números.');
        contaCriada(await criarContaNoServidor({ ...dadosConta(), codigo: codigo.value }));
      }),
    }, 'Confirmar e criar a conta');
    codigo.addEventListener('input', () => { if (codigo.value.length === 6) btnConfirmar.click(); });

    // reenviar: espera 30 s entre um e outro
    let esperaAte = 0, relogio = null;
    const btnReenviar = h('button', { class: 'btn btn--sm', type: 'button' }, 'Reenviar código');
    const armarReenvio = () => {
      esperaAte = Date.now() + 30000; clearInterval(relogio);
      const tique = () => {
        const s = Math.ceil((esperaAte - Date.now()) / 1000);
        btnReenviar.disabled = s > 0;
        btnReenviar.textContent = s > 0 ? `Reenviar em ${s}s` : 'Reenviar código';
        if (s <= 0) clearInterval(relogio);
      };
      tique(); relogio = setInterval(tique, 1000);
    };
    const reenviar = (motivo, emailDe) => async () => {
      erro.textContent = '';
      btnReenviar.disabled = true;
      try { await pedirCodigo(emailDe(), motivo, nome.value.trim()); toast('Mandamos outro código 📩', 'good'); armarReenvio(); }
      catch (e) { erro.textContent = e.message; btnReenviar.disabled = false; }
    };

    // esqueci a senha: e-mail → código + senha nova
    const btnEsqueci = h('button', {
      class: 'btn btn--p btn--blk btn--xl mt', onclick: () => enviar(btnEsqueci, async () => {
        if (esqueciEtapa === 1) {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailEntrar.value.trim())) throw new Error('Escreva o e-mail da sua conta.');
          await pedirCodigo(emailEntrar.value.trim(), 'senha');
          esqueciEtapa = 2; pintarForm(); setTimeout(() => codigoSenha.focus(), 50);
          return;
        }
        if (!/^\d{6}$/.test(codigoSenha.value)) throw new Error('O código tem 6 números.');
        if (senhaNova.value.length < 8) throw new Error('A senha nova precisa ter pelo menos 8 caracteres.');
        const r = await novaSenha(emailEntrar.value.trim(), codigoSenha.value, senhaNova.value);
        dados.nome = (r.usuario?.nome || '').split(' ')[0];
        toast('Senha nova salva! 🔑', 'good');
        passo = 1; pintar();
      }),
    }, 'Mandar o código');

    const btnEntrar = h('button', {
      class: 'btn btn--p btn--blk btn--xl mt', onclick: () => enviar(btnEntrar, async () => {
        const r = await entrarComEmail(emailEntrar.value.trim(), senhaEntrar.value);
        dados.nome = (r.usuario?.nome || '').split(' ')[0];
        toast(`Que bom te ver de novo, ${dados.nome || 'estudante'}!`, 'good');
        passo = 1; pintar();
      }),
    }, 'Entrar');

    const linkTexto = (texto, fn) => h('button', { class: 'conta-link', type: 'button', onclick: fn }, texto);
    const pintarForm = () => {
      erro.textContent = '';
      abas.hidden = modo === 'codigo' || modo === 'esqueci';
      if (modo === 'codigo') {
        btnReenviar.onclick = reenviar('criar', () => email.value.trim());
        armarReenvio();
        formulario.replaceChildren(h('div', { class: 'conta-passo' },
          h('div', { class: 'conta-envelope', 'aria-hidden': 'true' }, '📩'),
          h('h3', {}, 'Confira seu e-mail'),
          h('p', { class: 'small muted' }, 'Mandamos um código de 6 números para ', h('b', {}, email.value.trim()), '. Pode estar no spam.'),
          campo('Código', codigo), btnConfirmar,
          h('div', { class: 'flexb', style: { justifyContent: 'space-between', marginTop: '10px' } },
            linkTexto('← Trocar o e-mail', () => { modo = 'criar'; codigo.value = ''; pintarForm(); }), btnReenviar)));
        return;
      }
      if (modo === 'esqueci') {
        btnEsqueci.textContent = esqueciEtapa === 1 ? 'Mandar o código' : 'Salvar a senha nova';
        if (esqueciEtapa === 2) { btnReenviar.onclick = reenviar('senha', () => emailEntrar.value.trim()); armarReenvio(); }
        formulario.replaceChildren(h('div', { class: 'conta-passo' },
          h('h3', {}, 'Esqueci a senha'),
          esqueciEtapa === 1
            ? h('div', {}, h('p', { class: 'small muted' }, 'Escreva o e-mail da conta. Mandamos um código para você criar uma senha nova.'), campo('E-mail', emailEntrar))
            : h('div', {}, h('p', { class: 'small muted' }, 'Mandamos o código para ', h('b', {}, emailEntrar.value.trim()), '.'),
              campo('Código', codigoSenha), campo('Senha nova', senhaNova)),
          btnEsqueci,
          h('div', { class: 'flexb', style: { justifyContent: 'space-between', marginTop: '10px' } },
            linkTexto('← Voltar para entrar', () => { modo = 'entrar'; esqueciEtapa = 1; pintarForm(); }),
            esqueciEtapa === 2 ? btnReenviar : null)));
        return;
      }
      formulario.replaceChildren(modo === 'criar'
        ? h('div', {},
          h('div', { class: 'conta-foto-linha' },
            h('button', { class: 'conta-foto-btn', type: 'button', onclick: () => arquivo.click(), 'aria-label': 'Escolher foto' }, previa),
            h('div', { class: 'small muted' }, h('b', { style: { color: 'var(--txt)' } }, 'Sua foto'), h('br'), 'opcional — toque para escolher')),
          arquivo,
          campo('Nome', nome), campo('E-mail', email), campo('WhatsApp (com DDD)', telefone), campo('Senha', senha),
          h('label', { class: 'conta-aceite small', for: 'aceite' }, aceite,
            h('span', {}, 'Li e aceito os ', h('a', { href: '#/termos', target: '_blank' }, 'Termos'), ' e a ',
              h('a', { href: '#/termos?aba=privacidade', target: '_blank' }, 'Privacidade'),
              '. Se tenho menos de 18 anos, meu responsável autorizou.')),
          btnCriar)
        : h('div', {}, campo('E-mail', emailEntrar), campo('Senha', senhaEntrar), btnEntrar,
          comCodigo ? h('div', { class: 'center', style: { marginTop: '10px' } },
            linkTexto('Esqueci a senha', () => { modo = 'esqueci'; esqueciEtapa = 1; pintarForm(); })) : null));
    };

    const abas = segmento([{ v: 'criar', t: 'Criar conta' }, { v: 'entrar', t: 'Já tenho conta' }], modo, (v) => { modo = v; pintarForm(); });
    abas.classList.add('conta-abas');

    const conteudo = h('div', { style: { width: 'min(440px,100%)', margin: '0 auto' } },
      MARCA(72),
      h('div', { class: 'center', style: { margin: '10px 0 16px' } },
        h('div', { class: 'marca marca--escura' }, 'MindTrack', h('b', {}, 'AI')),
        h('p', { class: 'muted small', style: { margin: '8px auto 0', maxWidth: '36ch' } },
          'Crie sua conta para começar. Seus estudos ficam salvos e seus amigos te encontram.')),
      caixa(abas, h('div', { class: 'mt' }, formulario), erro, caixaGoogle),
      // parte separada, embaixo: entrar sem login, só para testar (apresentação, jurados, curiosos)
      h('section', { class: 'conta-teste', 'aria-label': 'Entrar sem login para teste' },
        h('div', { class: 'conta-teste__ou' }, h('span', {}, 'ou')),
        h('div', { class: 'conta-teste__selo' }, 'Modo teste'),
        h('p', { class: 'conta-teste__txt' }, 'Só quer conhecer o app? Entre sem login, com dados de exemplo.'),
        h('button', {
          class: 'btn btn--blk conta-demo', type: 'button',
          onclick: () => { carregarExemplo(); toast('Modo teste: app aberto com dados de exemplo', 'good'); fechar(); },
        }, 'Entrar sem login (só para teste)'),
        h('p', { class: 'muted small conta-teste__nota' }, 'Os dados são só de exemplo. Para usar de verdade, crie sua conta.')));
    pintarForm();
    tela.replaceChildren(conteudo);

    // "Entrar com o Google": só aparece quando o Google estiver ligado no servidor
    if (temServidor()) {
      configConexoes().then((c) => {
        comCodigo = !!c.email;
        if (comCodigo && modo === 'entrar') pintarForm();      // mostra o "Esqueci a senha"
        if (!c.google) return;
        caixaGoogle.replaceChildren(
          h('div', { class: 'flexb', style: { gap: '10px', margin: '14px 0 10px', color: 'var(--dim2)' } },
            h('span', { style: { flex: 1, height: '1px', background: 'var(--line)' } }), h('span', { class: 'tiny' }, 'ou'),
            h('span', { style: { flex: 1, height: '1px', background: 'var(--line)' } })),
          h('button', {
            class: 'btn btn--blk conx-google', onclick: async (e) => {
              e.target.disabled = true;
              try { await garantirSessao().catch(() => null); location.assign((await iniciarGoogle('conta')).url); }
              catch (err) { erro.textContent = err.message; e.target.disabled = false; }
            },
          }, h('span', { class: 'conx-g' }, 'G'), 'Entrar com o Google'));
      }).catch(() => {});
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
    const lista = materiasSugeridas(dados.serie);
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
        extras.push(M(n, '📘', '#3ec9f5'));
      }
      dados.materias.add(n); nova.value = ''; pintarChips();
    };
    nova.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); adicionar(); } });

    tela.replaceChildren(h('div', { style: { width: 'min(560px,100%)', margin: '0 auto' } },
      passos(1),
      cabecalho('Quais matérias você tem?',
        ['Faculdade', 'Concurso', 'Técnico'].includes(dados.serie)
          ? 'Como cada curso tem a sua grade, comece digitando as suas matérias aqui embaixo. Dá para mudar depois.'
          : 'O MindTrack não adivinha sua grade — você escolhe aqui e pode mudar quando quiser. Toque para marcar.'),
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
        'Seu MindTrack começa vazio de propósito — só com o que é seu. O próximo passo é cadastrar a primeira tarefa ou prova.'),
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
            const catalogo = [...FUND1, ...FUNDAMENTAL, ...MEDIO];
            for (const nome of dados.materias) {
              const base = catalogo.find((m) => m.nome === nome) || M(nome, '📘', '#3ec9f5');
              novaMateria({ nome: base.nome, emoji: base.emoji, cor: base.cor, meta: 9 });
            }
            set((s) => {
              s.perfil.nome = dados.nome;
              s.perfil.serie = dados.serie;
              s.prefs.minutosDia = dados.minutos;
            });
            concluirOnboarding();
            toast(`Bem-vindo ao MindTrack, ${dados.nome}!`, 'good');
            fechar();
          },
        }, '▶ Entrar no MindTrack'))));
  }

  function pintar() {
    [boasVindas, perfil, materias, ritmo, pronto][passo]();
    tela.scrollTop = 0;
  }
  pintar();
}
