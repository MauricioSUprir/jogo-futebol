/* ===== views/conexoes.js — ligar os apps da escola ao MindTrack =====
   Só funciona com CONTA (entrou com o Google): a ligação fica salva no servidor,
   então vale em qualquer aparelho em que o aluno entrar. O app nunca guarda o
   acesso do Google — só recebe as provas, eventos e atividades já prontos.
   - Google Agenda   → provas e eventos (com período, horário)
   - Google Classroom → atividades viram tarefas (entregue = concluída)
   - Google Drive    → escolher arquivos e guardar como Materiais
   - Calendário por link (.ics) → Outlook, iCloud, Moodle, calendário da escola */
import { h, fmtData } from '../util.js';
import { st, set } from '../store.js';
import { titulo, cartao, toast, confirmar, inp } from '../ui.js';
import {
  temServidor, garantirSessao, configConexoes, iniciarGoogle, trocarTicket, listarConexoes, sincronizarConexao,
  ligarCalendarioPorLink, acessoDoDrive, removerConexao,
} from '../api.js';
import { importarEventos, importarAtividades, importarDoDrive } from '../conexoes-importar.js';

export const temConta = () => st().conta.provedor === 'google' && !!st().conta.token;

const APPS = [
  { s: 'agenda', i: '📅', t: 'Google Agenda', d: 'Provas, trabalhos e eventos da sua agenda entram no calendário do MindTrack.' },
  { s: 'classroom', i: '🏫', t: 'Google Classroom', d: 'As atividades das suas turmas viram tarefas, com a data de entrega. O que você entregou fica concluído.' },
  { s: 'drive', i: '📁', t: 'Google Drive', d: 'Escolha apostilas, listas e resumos do Drive para guardar nos seus Materiais.' },
  { s: 'ics', i: '🔗', t: 'Calendário por link', d: 'Outlook, iCloud, Moodle, Teams ou o calendário do site da escola — qualquer link .ics ou webcal.' },
];
const EM_BREVE = [
  { i: '🟦', t: 'Microsoft 365', d: 'Outlook, Teams e OneDrive direto (hoje: pelo link do calendário)' },
  { i: '⬛', t: 'Notion', d: 'Suas anotações e listas de estudo' },
];
const ERROS = {
  cancelado: 'Você cancelou no Google. Nada foi ligado.',
  faltou_permissao: 'Faltou marcar a permissão no Google. Tente de novo e deixe a caixinha marcada.',
  sem_permissao: 'O Google não liberou o acesso contínuo. Tente de novo.',
  sem_conta: 'Entre com o Google primeiro.',
  expirou: 'O login demorou demais. Tente de novo.',
  falhou: 'Não deu certo agora. Tente de novo em instantes.',
};

let config = null;          // { google, drive } do servidor
let lista = null;           // conexões ligadas
let ocupado = '';

export function render(el, { params } = {}) {
  const pintar = () => { el.replaceChildren(); montar(el, pintar); };
  montar(el, pintar);
  if (params && [...params.keys()].length) tratarVolta(params, pintar);
}

/* O Google volta para #/conexoes?entrou=… | ok=agenda | erro=… */
async function tratarVolta(params, pintar) {
  history.replaceState(null, '', `${location.pathname}${location.search}#/conexoes`);
  try {
    if (params.get('entrou')) {
      await trocarTicket(params.get('entrou'));
      toast(`Conta ligada: ${st().conta.email || st().conta.nome} ✅`, 'good');
      lista = null;
    } else if (params.get('ok')) {
      const servico = params.get('ok');
      lista = null;
      toast(`${APPS.find((a) => a.s === servico)?.t || 'App'} conectado ✅`, 'good');
      if (servico !== 'drive') await sincronizar(servico, pintar, { silencioso: false });
    } else if (params.get('erro')) {
      toast(ERROS[params.get('erro')] || ERROS.falhou, 'bad');
    }
  } catch (e) { toast(e.message, 'bad'); }
  pintar();
}

function montar(el, pintar) {
  el.append(titulo('🔗 Conexões', 'Ligue seus apps da escola: o MindTrack junta tudo num lugar só'));
  if (!temServidor()) {
    el.append(cartao(h('p', { class: 'small' }, 'As Conexões precisam do servidor do MindTrack, que ainda não está configurado.')));
    return;
  }
  if (!config) {
    el.append(cartao(h('p', { class: 'small muted' }, 'Carregando…')));
    configConexoes().then((c) => { config = c; pintar(); })
      .catch((e) => { config = { google: false, erro: e.message }; pintar(); });
    return;
  }
  if (!temConta()) return el.append(portao(pintar));
  if (!lista) {
    el.append(cartao(h('p', { class: 'small muted' }, 'Buscando seus apps…')));
    listarConexoes().then((d) => { lista = d.conexoes || []; guardarLista(); pintar(); })
      .catch((e) => {
        if (e.status === 403 || e.status === 401) set((s) => { s.conta.provedor = 'local'; });
        lista = []; toast(e.message, 'bad'); pintar();
      });
    return;
  }

  const c = st().conta;
  el.append(h('div', { class: 'card conx-conta' },
    c.foto ? h('img', { src: c.foto, alt: '', class: 'conx-foto', referrerpolicy: 'no-referrer' }) : h('div', { class: 'conx-foto' }, (c.nome || '?')[0]),
    h('div', { class: 'grow' }, h('b', {}, c.nome || 'Sua conta'), h('div', { class: 'tiny muted' }, `${c.email} · conta Google`)),
    h('span', { class: 'chip' }, `${lista.length} app(s) ligado(s)`)));

  el.append(h('div', { class: 'conx-grade' }, ...APPS.map((a) => cartaoApp(a, pintar))));
  el.append(h('h3', { class: 'side__grupo', style: { margin: '22px 0 8px' } }, 'Em breve'));
  el.append(h('div', { class: 'conx-grade' }, ...EM_BREVE.map((a) => h('div', { class: 'card conx conx--breve' },
    h('div', { class: 'conx-topo' }, h('span', { class: 'conx-ic' }, a.i), h('b', {}, a.t), h('span', { class: 'chip' }, 'em breve')),
    h('p', { class: 'small muted' }, a.d)))));
  el.append(h('p', { class: 'tiny muted mt' },
    '🔒 O MindTrack só LÊ: nunca muda nada na sua Agenda, no Classroom ou no Drive. O acesso fica guardado cifrado no servidor '
    + 'e você desliga quando quiser — aqui ou em myaccount.google.com/permissions.'));
}

function portao(pintar) {
  const pronto = config.google;
  return h('div', {},
    h('div', { class: 'card conx-portao' },
      h('div', { class: 'conx-portao__ic' }, '🔐'),
      h('h2', {}, 'As Conexões precisam de uma conta'),
      h('p', { class: 'small' }, 'Entre com o Google e a ligação com os seus apps fica salva — vale em qualquer celular ou computador '
        + 'em que você entrar. Seu plano e tudo o que você já tem no MindTrack continuam iguais.'),
      pronto
        ? h('button', {
          class: 'btn btn--p conx-google', disabled: !!ocupado, onclick: async (ev) => {
            ev.target.disabled = true; ev.target.textContent = 'Abrindo o Google…';
            try {
              await garantirSessao().catch(() => null);       // liga o Google na conta deste aparelho (o plano vem junto)
              const { url } = await iniciarGoogle('conta');
              location.assign(url);
            } catch (e) { toast(e.message, 'bad'); ev.target.disabled = false; ev.target.textContent = 'Entrar com o Google'; }
          },
        }, h('span', { class: 'conx-g' }, 'G'), 'Entrar com o Google')
        : h('p', { class: 'small muted' }, config.erro
          ? `Não consegui falar com o servidor agora (${config.erro}).`
          : 'O login com o Google está sendo configurado pelo dono do app. Volte daqui a pouco.')),
    h('div', { class: 'conx-grade mt' }, ...APPS.map((a) => h('div', { class: 'card conx conx--trancado' },
      h('div', { class: 'conx-topo' }, h('span', { class: 'conx-ic' }, a.i), h('b', {}, a.t), h('span', { class: 'chip' }, '🔒 com conta')),
      h('p', { class: 'small muted' }, a.d)))));
}

function cartaoApp(a, pintar) {
  const ligado = lista.find((x) => x.servico === a.s);
  const quando = ligado?.sincronizadoEm ? `sincronizado ${haQuanto(ligado.sincronizadoEm)}` : 'ainda não sincronizado';
  const corpo = [h('p', { class: 'small muted' }, a.d)];
  const botoes = [];
  if (ligado) {
    corpo.push(h('div', { class: 'tiny' }, `✅ ${ligado.conta || 'ligado'}${a.s === 'drive' ? '' : ` · ${quando}`}`));
    if (a.s === 'drive') {
      botoes.push(h('button', { class: 'btn btn--p', disabled: !!ocupado, onclick: () => escolherNoDrive(pintar) },
        config.drive ? '📂 Escolher arquivos' : '📂 Escolher (em configuração)'));
    } else {
      botoes.push(h('button', { class: 'btn btn--p', disabled: !!ocupado, onclick: () => sincronizar(a.s, pintar) },
        ocupado === a.s ? 'Sincronizando…' : '🔄 Sincronizar agora'));
    }
    botoes.push(h('button', { class: 'btn', disabled: !!ocupado, onclick: () => desligar(a, pintar) }, 'Desconectar'));
  } else if (a.s === 'ics') {
    const campoLink = inp({ placeholder: 'Cole o link (https://… ou webcal://…)', type: 'url', 'aria-label': 'Link do calendário' });
    corpo.push(campoLink, h('details', { class: 'tiny muted' }, h('summary', {}, 'Onde acho esse link?'),
      h('ul', {},
        h('li', {}, 'Outlook/Teams: Configurações → Calendário → Calendários compartilhados → Publicar → link ICS.'),
        h('li', {}, 'iCloud: no app Calendário, toque no ⓘ do calendário → Calendário Público → copiar link.'),
        h('li', {}, 'Moodle: Calendário → Exportar calendário → copiar o link.'),
        h('li', {}, 'Escola: procure "assinar calendário" ou "iCal" no site.'))));
    botoes.push(h('button', {
      class: 'btn btn--p', disabled: !!ocupado, onclick: async (ev) => {
        if (!campoLink.value.trim()) return toast('Cole o link do calendário.', 'bad');
        ocupado = 'ics'; ev.target.textContent = 'Lendo o calendário…'; ev.target.disabled = true;
        try {
          const d = await ligarCalendarioPorLink(campoLink.value.trim());
          lista = null;
          aplicarResultado('ics', d);
        } catch (e) { toast(e.message, 'bad'); }
        ocupado = ''; pintar();
      },
    }, 'Ligar calendário'));
  } else {
    botoes.push(h('button', {
      class: 'btn btn--p', disabled: !!ocupado, onclick: async (ev) => {
        ev.target.disabled = true; ev.target.textContent = 'Abrindo o Google…';
        try { location.assign((await iniciarGoogle(a.s)).url); }
        catch (e) { toast(e.message, 'bad'); ev.target.disabled = false; ev.target.textContent = 'Conectar'; }
      },
    }, 'Conectar'));
  }
  return h('div', { class: `card conx${ligado ? ' conx--on' : ''}` },
    h('div', { class: 'conx-topo' }, h('span', { class: 'conx-ic' }, a.i), h('b', {}, a.t),
      ligado ? h('span', { class: 'chip chip--on' }, 'ligado') : null),
    ...corpo, h('div', { class: 'flexb mt' }, ...botoes));
}

function aplicarResultado(servico, d, { silencioso = false } = {}) {
  let msg;
  if (servico === 'classroom') {
    const r = importarAtividades(d.atividades, 'classroom');
    msg = `Classroom: ${r.novos} atividade(s) nova(s)${r.concluidas ? `, ${r.concluidas} marcada(s) como entregue` : ''}.`;
  } else {
    const r = importarEventos(d.itens, servico === 'ics' ? 'ics' : 'agenda');
    msg = `${servico === 'ics' ? (d.nome || 'Calendário') : 'Agenda'}: ${r.novos} nova(s) data(s)`
      + `${r.provas ? ` (${r.provas} prova/teste)` : ''}${r.atualizados ? `, ${r.atualizados} atualizada(s)` : ''}.`;
  }
  set((s) => { s.conexoes = { ...s.conexoes, ultima: { ...(s.conexoes?.ultima || {}), [servico]: new Date().toISOString() } }; });
  if (!silencioso) toast(msg, 'good');
  return msg;
}

async function sincronizar(servico, pintar, { silencioso = false } = {}) {
  ocupado = servico; pintar?.();
  try {
    const d = await sincronizarConexao(servico);
    aplicarResultado(servico, d, { silencioso });
    lista = null;
  } catch (e) {
    if (e.status === 410) lista = null;          // a permissão caiu no Google: a conexão saiu
    if (!silencioso) toast(e.message, 'bad');
  }
  ocupado = ''; pintar?.();
}

function desligar(a, pintar) {
  confirmar(`Desconectar ${a.t}?`, 'O que já entrou no MindTrack continua aqui. Ele só para de buscar novidades.', async () => {
    try { await removerConexao(a.s); lista = null; toast(`${a.t} desconectado.`); }
    catch (e) { toast(e.message, 'bad'); }
    pintar();
  }, { ok: 'Desconectar' });
}

/* ---------- Drive: o seletor oficial do Google (Picker) ---------- */
function carregarScript(src) {
  return new Promise((ok, erro) => {
    if ([...document.scripts].some((s) => s.src === src)) return ok();
    const s = document.createElement('script');
    s.src = src; s.async = true; s.onload = () => ok(); s.onerror = () => erro(new Error('Não consegui abrir o Drive. Verifique a internet.'));
    document.head.append(s);
  });
}

async function escolherNoDrive(pintar) {
  if (!config.drive) return toast('O seletor do Drive ainda está sendo configurado pelo dono do app.', 'bad');
  ocupado = 'drive';
  try {
    const [{ accessToken }] = await Promise.all([acessoDoDrive(), carregarScript('https://apis.google.com/js/api.js')]);
    await new Promise((ok) => window.gapi.load('picker', ok));
    const P = window.google.picker;
    const visao = new P.DocsView().setIncludeFolders(true).setSelectFolderEnabled(false).setMode(P.DocsViewMode.LIST);
    new P.PickerBuilder()
      .addView(visao).enableFeature(P.Feature.MULTISELECT_ENABLED)
      .setOAuthToken(accessToken).setDeveloperKey(config.drive.chave).setAppId(config.drive.projeto)
      .setLocale('pt-BR').setTitle('Escolha os materiais')
      .setCallback((d) => {
        if (d[P.Response.ACTION] !== P.Action.PICKED) return;
        const docs = (d[P.Response.DOCUMENTS] || []).map((x) => ({
          id: x[P.Document.ID], name: x[P.Document.NAME], url: x[P.Document.URL], mimeType: x[P.Document.MIME_TYPE],
        }));
        const n = importarDoDrive(docs);
        toast(n ? `${n} arquivo(s) nos seus Materiais 📂` : 'Esses arquivos já estavam nos Materiais.', 'good');
      })
      .build().setVisible(true);
  } catch (e) {
    if (e.status === 410 || e.status === 404) lista = null;
    toast(e.message, 'bad');
  }
  ocupado = ''; pintar();
}

/* ---------- utilidades ---------- */
function guardarLista() {
  set((s) => { s.conexoes = { ...s.conexoes, lista: lista.map((c) => ({ servico: c.servico, conta: c.conta })) }; });
}

function haQuanto(isoData) {
  const min = Math.round((Date.now() - Date.parse(isoData)) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  if (min < 60 * 24) return `há ${Math.round(min / 60)} h`;
  return `em ${fmtData(isoData.slice(0, 10), { curto: true })}`;
}

/** Ao abrir o app: busca novidades dos apps ligados que não sincronizam há 6 h (sem atrapalhar). */
export async function sincronizarAoAbrir() {
  if (!temServidor() || !temConta()) return;
  const ligados = (st().conexoes?.lista || []).map((c) => c.servico).filter((s) => s !== 'drive');
  const ultima = st().conexoes?.ultima || {};
  for (const servico of ligados) {
    if (ultima[servico] && Date.now() - Date.parse(ultima[servico]) < 6 * 3600000) continue;
    await sincronizar(servico, null, { silencioso: true });
  }
}
