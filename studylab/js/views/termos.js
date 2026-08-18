/* ===== views/termos.js — Termos de uso e Política de privacidade =====
   Escrito em português claro, sem juridiquês decorativo. Só promete o que o
   app realmente faz — o que estiver aqui tem que ser verdade no código.      */
import { h } from '../util.js';
import { titulo, cartao, segmento } from '../ui.js';
import { PLANOS, precoBR, EMAIL_CONTATO, RESPONSAVEL } from '../produto.js';

const ATUALIZADO = '18 de agosto de 2026';
let aba = 'termos';

export function render(el, { params }) {
  if (params?.get('aba')) aba = params.get('aba');
  const pintar = () => { el.replaceChildren(); montar(el, pintar); };
  montar(el, pintar);
}

const P = (...kids) => h('p', { class: 'small', style: { lineHeight: 1.65 } }, ...kids);
const T = (txt) => h('h3', { style: { fontSize: '15px', margin: '18px 0 6px' } }, txt);
const LI = (...kids) => h('li', { style: { marginBottom: '5px' } }, ...kids);
const UL = (...kids) => h('ul', { class: 'small', style: { paddingLeft: '20px', lineHeight: 1.6, margin: '4px 0' } }, ...kids);

function montar(el, pintar) {
  el.append(titulo('📄 Termos e privacidade', `Atualizado em ${ATUALIZADO}.`));
  el.append(h('div', { class: 'mb' }, segmento([
    { v: 'termos', t: '📜 Termos de uso' }, { v: 'privacidade', t: '🔒 Privacidade' },
  ], aba, (v) => { aba = v; pintar(); })));
  el.append(aba === 'termos' ? termos() : privacidade());
  el.append(h('p', { class: 'tiny muted center mt2' },
    'Dúvidas? Escreva para ', h('a', { href: `mailto:${EMAIL_CONTATO}` }, EMAIL_CONTATO)));
}

/* ==========================================================
   TERMOS DE USO
   ========================================================== */
function termos() {
  return cartao(
    P('Estes termos valem entre você e ', h('b', {}, RESPONSAVEL), ', responsável pelo StudyLab. '
      + 'Ao usar o app, você concorda com o que está aqui. Se não concordar, é só não usar.'),

    T('1. O que o StudyLab é'),
    P('Um app de organização e apoio aos estudos: agenda, tarefas, provas, revisão espaçada, questões, '
      + 'flashcards, foco e acompanhamento de desempenho. Ele ', h('b', {}, 'não substitui a escola, o professor '
      + 'nem o material didático'), ' — é uma ferramenta para você se organizar e estudar melhor.'),

    T('2. Idade e responsáveis'),
    P('O StudyLab é feito para estudantes, inclusive menores de idade. Se você tem ', h('b', {}, 'menos de 18 anos'),
      ', precisa da autorização de um pai, mãe ou responsável para usar o app — e ', h('b', {}, 'qualquer pagamento '
      + 'deve ser feito por essa pessoa'), ', porque contratos assinados por menores dependem de quem responde por eles.'),
    P('Se você é responsável por um menor: ao permitir o uso e ao pagar, você concorda com estes termos em nome dele.'),

    T('3. Conta'),
    UL(
      LI('Dá para usar sem conta: os dados ficam guardados só no aparelho.'),
      LI('Com conta (Google ou conta de aparelho), a assinatura fica ligada a você.'),
      LI('Você é responsável por manter o acesso à sua conta. Se perder o aparelho e estiver sem conta Google, '
        + 'não temos como recuperar os dados — eles estavam só ali.')),

    T('4. Plano grátis e plano Pro'),
    P('Quase tudo é gratuito e sem limite. O ', h('b', {}, 'Study AI'), ' — o tutor que responde com base nas suas '
      + 'matérias e no seu desempenho — faz parte do plano Pro. Os preços de hoje:'),
    UL(...PLANOS.map((p) => LI(h('b', {}, p.nome), `: ${precoBR(p.preco)} — ${p.dias} dias de Pro.`))),
    P('Podemos mudar os preços a qualquer momento, mas ', h('b', {}, 'nunca no período que você já pagou'),
      '. Quem tem cobrança automática é avisado antes de qualquer aumento.'),

    T('5. Pagamento'),
    UL(
      LI('O pagamento é processado pelo ', h('b', {}, 'Mercado Pago'), '. Não recebemos nem guardamos os dados do '
        + 'seu cartão nem a sua chave Pix.'),
      LI('No ', h('b', {}, 'Pix'), ', você compra uma quantidade de dias. Quando acabam, o acesso volta ao plano '
        + 'grátis — não há cobrança surpresa.'),
      LI('No ', h('b', {}, 'cartão com renovação'), ', a cobrança se repete no período contratado até você cancelar.'),
      LI('Os dias são creditados assim que o pagamento é confirmado. Pix costuma ser na hora; cartão pode levar '
        + 'alguns minutos.')),

    T('6. Cancelamento e arrependimento'),
    P(h('b', {}, 'Cancelar: '), 'a qualquer momento, pelo próprio app, em ✨ StudyLab Pro. No cartão, a cobrança para '
      + 'na hora e você continua com acesso até o fim do período já pago. Não cobramos multa.'),
    P(h('b', {}, 'Arrependimento: '), 'pelo artigo 49 do Código de Defesa do Consumidor, você pode desistir da compra '
      + 'em até ', h('b', {}, '7 dias'), ' e receber o dinheiro de volta. É só escrever para ',
      h('a', { href: `mailto:${EMAIL_CONTATO}` }, EMAIL_CONTATO), ' com o e-mail usado no pagamento. '
      + 'Devolvemos o valor integral pelo mesmo meio.'),

    T('7. Sobre as respostas da inteligência artificial'),
    P('O Study AI usa modelos de linguagem para explicar conteúdos, criar questões e resumir material. ',
      h('b', {}, 'Ele pode errar'),
      ': datas, contas e detalhes devem ser conferidos no seu material e com o seu professor. '
      + 'As respostas são apoio ao estudo, não verdade absoluta nem substituto de orientação profissional. '
      + 'Não use o app para fraudar avaliações — isso é responsabilidade sua e da sua escola.'),

    T('8. Uso correto'),
    UL(
      LI('Não tente burlar o pagamento, invadir o servidor ou usar o app de forma automatizada em massa.'),
      LI('Não envie conteúdo ilegal, ofensivo ou que não seja seu.'),
      LI('Uso abusivo pode levar ao bloqueio da conta, com devolução proporcional do que foi pago.')),

    T('9. Disponibilidade'),
    P('Fazemos o possível para manter tudo no ar, mas o app pode ficar indisponível por manutenção ou por falha de '
      + 'serviços de terceiros. A parte que funciona offline continua funcionando. Se uma indisponibilidade longa '
      + 'atrapalhar seu plano pago, avise que compensamos os dias.'),

    T('10. Mudanças nestes termos'),
    P('Se algo mudar, atualizamos esta página e a data no topo. Mudanças importantes são avisadas dentro do app.'),

    T('11. Lei e foro'),
    P('Valem as leis brasileiras, incluindo o Código de Defesa do Consumidor e a LGPD. Questões vão para o foro do '
      + 'domicílio do consumidor.'),
  );
}

/* ==========================================================
   POLÍTICA DE PRIVACIDADE
   ========================================================== */
function privacidade() {
  return cartao(
    P('Resumo honesto: ', h('b', {}, 'quase tudo o que você escreve no StudyLab fica no seu próprio aparelho'),
      '. O que sai dali é pouco, e está listado abaixo.'),

    T('1. O que fica só no seu aparelho'),
    P('Matérias, tarefas, provas, notas, flashcards, questões, anotações, sessões de estudo, XP e conquistas ficam '
      + 'guardados no armazenamento do navegador. Não temos acesso a isso. Se você limpar os dados do site ou trocar '
      + 'de aparelho sem backup, some — inclusive para nós.'),

    T('2. O que o nosso servidor guarda'),
    UL(
      LI('Um identificador da sua conta, seu nome e e-mail (se entrar com o Google).'),
      LI('A situação da sua assinatura: plano, data de início e de término.'),
      LI('Quantas perguntas você fez ao Study AI por dia — só a contagem, para respeitar os limites e evitar abuso.'),
      LI('Registro dos pagamentos: valor, data e identificador do Mercado Pago.')),
    P(h('b', {}, 'Não guardamos'), ' o conteúdo das suas conversas com o Study AI, nem suas tarefas, notas ou materiais.'),

    T('3. O que acontece quando você usa o Study AI'),
    P('Para responder, o app envia à ', h('b', {}, 'Anthropic'), ' (empresa do modelo Claude) a sua pergunta e um resumo '
      + 'do seu contexto de estudo: nomes das matérias, conteúdos e o seu percentual de domínio, provas marcadas e '
      + 'tarefas em aberto. Você pode ver exatamente esse texto no botão ', h('b', {}, '"👁️ o que ele sabe"'),
      ' dentro do Study AI.'),
    P('Esse envio é feito pelo nosso servidor, pela API comercial da Anthropic, que ', h('b', {}, 'não usa esse conteúdo '
      + 'para treinar modelos'), '. Não mandamos seu nome completo, e-mail nem dados de pagamento.'),

    T('4. Pagamento'),
    P('Quem processa é o ', h('b', {}, 'Mercado Pago'), '. Os dados do cartão e da sua conta bancária são digitados lá e '
      + 'nunca passam pelo StudyLab. Recebemos de volta apenas: se o pagamento foi aprovado, o valor e um identificador.'),

    T('5. Login com o Google'),
    P('Se você escolher entrar com o Google, recebemos seu nome, e-mail, foto e um identificador — só para reconhecer '
      + 'sua conta e sua assinatura. Não postamos nada, não lemos seus e-mails e não acessamos mais nada da sua conta Google.'),

    T('6. Crianças e adolescentes'),
    P('Sabemos que boa parte de quem usa o StudyLab é menor de idade. Por isso pedimos o mínimo de dados possível e '
      + 'deixamos o app funcionar sem conta. Para menores de 16 anos, o tratamento de dados depende do ',
      h('b', {}, 'consentimento de um responsável'), ' (LGPD, art. 14). Responsáveis podem pedir a exclusão de tudo a '
      + 'qualquer momento pelo e-mail abaixo.'),

    T('7. Seus direitos (LGPD)'),
    UL(
      LI(h('b', {}, 'Ver seus dados: '), 'em ⚙️ Configurações → Exportar backup você baixa tudo o que está no aparelho.'),
      LI(h('b', {}, 'Apagar: '), 'em ⚙️ Configurações → Apagar tudo você elimina os dados locais. Para apagar também o que '
        + 'está no servidor (conta e assinatura), escreva para ', h('a', { href: `mailto:${EMAIL_CONTATO}` }, EMAIL_CONTATO), '.'),
      LI(h('b', {}, 'Corrigir: '), 'você edita seus dados dentro do app quando quiser.'),
      LI(h('b', {}, 'Tirar o consentimento: '), 'basta cancelar a assinatura e apagar a conta.')),
    P('Respondemos pedidos em até 15 dias.'),

    T('8. Rastreamento'),
    P('Não usamos cookies de publicidade, nem Google Analytics, nem pixel de rede social. O app usa o armazenamento '
      + 'local do navegador só para guardar os seus dados de estudo e manter você conectado.'),

    T('9. Segurança'),
    P('A conversa com o servidor é criptografada (HTTPS). A chave da inteligência artificial fica só no servidor, nunca '
      + 'no seu aparelho. Nenhum sistema é 100% seguro, mas guardamos o mínimo possível justamente para que um problema '
      + 'exponha o mínimo possível.'),

    T('10. Mudanças'),
    P('Se algo mudar, atualizamos esta página e a data no topo.'),
  );
}
