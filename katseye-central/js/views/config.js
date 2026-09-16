/* ===== views/config.js — Sistema e preferências =====
   Tema, movimento, fusos do relógio, conexão da IA, seus dados, cache do
   app e o registro de atividade.                                           */

import { h, baixar, fmtQuando, nf, lerTexto } from '../util.js';
import {
  st, set, aplicarPrefs, exportar, importar, zerar, resumoDados, registrar, GRUPO,
} from '../store.js';
import { PROVEDORES, provedor, chaveDe, modeloAtual, modoIA, motivoIA, usoHoje, MANUAL } from '../ia.js';
import { FUSOS, AVISO_DADOS } from '../dados.js';
import {
  tituloPagina, painel, campo, inp, sel, segmento, chave as chaveUI, toast,
  confirmar, modal, fecharModal, vazio, cascata, aviso, seletorDeArquivo, kpi,
} from '../ui.js';
import * as fotos from '../fotos.js';

export const VERSAO = '1.0.0';

export function render(alvo) {
  const s = st();
  const recarregar = () => { alvo.replaceChildren(); render(alvo); };

  /* ---------- perfil ---------- */
  const cNome = inp({ value: s.perfil.nome, placeholder: 'Como você quer ser chamado' });
  const cPapel = inp({ value: s.perfil.papel, placeholder: 'Ex.: direção criativa' });
  const perfil = painel('Seu perfil', { icone: '👤' },
    h('div', { class: 'f-row' }, campo('Nome', cNome), campo('Papel', cPapel)),
    h('button', {
      class: 'btn btn--p btn--sm',
      onclick: () => {
        set((x) => { x.perfil.nome = cNome.value.trim(); x.perfil.papel = cPapel.value.trim(); });
        toast('Perfil salvo', 'good');
      },
    }, 'Salvar perfil'));

  /* ---------- aparência ---------- */
  const aparencia = painel('Aparência', { icone: '🎨' },
    h('label', { class: 'f' }, h('span', {}, 'Tema'),
      segmento([{ v: 'escuro', t: '🌙 Escuro' }, { v: 'claro', t: '☀️ Claro' }], s.prefs.tema, (v) => {
        set((x) => { x.prefs.tema = v; }); aplicarPrefs();
      })),
    h('label', { class: 'f' }, h('span', {}, 'Densidade'),
      segmento([{ v: 'confortavel', t: 'Confortável' }, { v: 'compacta', t: 'Compacta' }], s.prefs.densidade, (v) => {
        set((x) => { x.prefs.densidade = v; }); aplicarPrefs();
      })),
    h('label', { class: 'f' }, h('span', {}, 'Cor de acento'),
      h('div', { class: 'flexb' },
        ...['', '#a855f7', '#ff4f8b', '#f0c674', '#54e0e6', '#3ddc97'].map((cor) => h('button', {
          class: `swatch ${(s.prefs.acento || '') === cor ? 'on' : ''}`,
          title: cor || 'Padrão do app',
          style: { background: cor || 'linear-gradient(135deg,#a855f7,#ff4f8b 55%,#f0c674)' },
          onclick: () => { set((x) => { x.prefs.acento = cor; }); aplicarPrefs(); recarregar(); },
        })))),
    chaveUI('Animações', 'Transições e entradas suaves. Desligue se preferir a tela estática.',
      s.prefs.movimento !== false, (v) => { set((x) => { x.prefs.movimento = v; }); aplicarPrefs(); }));

  /* ---------- relógio mundial ---------- */
  const fusosEl = h('div', { class: 'chips' }, ...FUSOS.map((f) => {
    const ativo = (st().prefs.fusos || []).includes(f.id);
    return h('button', {
      class: `chip chip--btn ${ativo ? 'chip--on' : ''}`,
      onclick: () => {
        set((x) => {
          const lista = new Set(x.prefs.fusos || []);
          if (lista.has(f.id)) lista.delete(f.id); else lista.add(f.id);
          x.prefs.fusos = [...lista];
        });
        recarregar();
      },
    }, `${f.bandeira} ${f.cidade}`);
  }));
  const relogio = painel('Relógio mundial', { icone: '🌍' },
    h('p', { class: 'small muted mb' }, 'Quais cidades aparecem no Command Center.'),
    fusosEl);

  /* ---------- conselheiro / IA ---------- */
  const conselheiro = painelIA(recarregar);

  /* ---------- dados ---------- */
  const r = resumoDados();
  const numeros = h('div', { class: 'grid g4 keep2' },
    kpi(r.eventos, 'compromissos'),
    kpi(r.tarefas, 'tarefas'),
    kpi(r.projetos, 'peças no estúdio'),
    kpi(r.fotos, 'fotos'));

  const importador = seletorDeArquivo('📥 Importar backup', 'application/json,.json', async (arquivo) => {
    try {
      importar(await lerTexto(arquivo));
      toast('Backup restaurado', 'good');
      recarregar();
    } catch (e) {
      toast(`Não consegui importar: ${e.message}`, 'bad');
    }
  });

  const dados = painel('Seus dados', { icone: '💾' },
    numeros,
    h('p', { class: 'small muted mt mb' },
      `Tudo mora neste navegador: ${nf(r.bytes / 1024, 1)} KB de estado, mais as imagens no IndexedDB. `
      + 'Limpar os dados do site apaga o app inteiro — faça backup de vez em quando.'),
    h('div', { class: 'flexb' },
      h('button', {
        class: 'btn btn--sm',
        onclick: () => {
          baixar(`katseye-central-backup-${new Date().toISOString().slice(0, 10)}.json`,
            exportar(), 'application/json');
          toast('Backup baixado', 'good');
        },
      }, '📤 Exportar backup'),
      importador,
      h('button', {
        class: 'btn btn--sm btn--d sp',
        onclick: () => confirmar('Apagar tudo deste aparelho?',
          'Compromissos, tarefas, peças, fotos e conversas somem. Isso não tem volta — exporte um backup antes.',
          async () => {
            await fotos.apagarTudo();
            zerar();
            toast('App zerado');
            location.hash = '#/inicio';
            location.reload();
          }, { ok: 'Apagar tudo' }),
      }, '🗑️ Apagar tudo')));

  /* ---------- cache / PWA ---------- */
  const cacheEl = painel('Cache e instalação', { icone: '📦' },
    h('p', { class: 'small muted mb' },
      'O app funciona offline por um service worker. Se uma tela ficar desatualizada depois de uma '
      + 'atualização, limpe o cache aqui e recarregue.'),
    h('div', { class: 'flexb' },
      h('button', {
        class: 'btn btn--sm',
        onclick: async () => {
          try {
            const chaves = await caches.keys();
            await Promise.all(chaves.map((k) => caches.delete(k)));
            const regs = await navigator.serviceWorker?.getRegistrations?.() || [];
            await Promise.all(regs.map((x) => x.unregister()));
            toast('Cache limpo — recarregando…', 'good');
            setTimeout(() => location.reload(), 700);
          } catch (e) { toast(`Não consegui limpar: ${e.message}`, 'bad'); }
        },
      }, '🧹 Limpar cache'),
      h('button', {
        class: 'btn btn--sm',
        onclick: async () => {
          const e = await fotos.espaco();
          const orfas = await fotos.limparOrfas(st().galeria.map((g) => g.fotoId));
          modal('📦 Armazenamento', h('div', { class: 'small' },
            e ? h('p', {}, `Usado: ${nf(e.usado / 1048576, 1)} MB de ${nf(e.cota / 1048576, 0)} MB liberados pelo navegador.`)
              : h('p', {}, 'Este navegador não informa o espaço usado.'),
            h('p', { class: 'mt' }, `Imagens órfãs removidas: ${orfas}.`),
            h('p', { class: 'mt muted' }, `Estado do app: ${nf(resumoDados().bytes / 1024, 1)} KB.`)));
        },
      }, '📊 Ver espaço usado')));

  /* ---------- registro de atividade ---------- */
  const log = painel('Registro de atividade', {
    icone: '📜',
    acao: s.log.length ? h('button', {
      class: 'btn btn--xs btn--d',
      onclick: () => confirmar('Limpar o registro?', 'O histórico de ações some (os dados ficam).', () => {
        set((x) => { x.log = []; }); toast('Registro limpo'); recarregar();
      }),
    }, 'Limpar') : null,
  }, s.log.length
    ? h('div', { class: 'feed' }, ...s.log.slice(0, 40).map((l) => h('div', { class: 'feed__i' },
      h('span', { class: 'feed__dot' }, l.icone),
      h('span', { class: 'feed__c' }, h('b', {}, l.titulo), l.texto ? h('span', {}, l.texto) : null),
      h('span', { class: 'feed__t' }, fmtQuando(l.em)))))
    : vazio('Sem registros ainda', 'Cada ação no app aparece aqui.', null, '📜'));

  /* ---------- ajuda / sobre ---------- */
  const sobre = painel('Sobre', { icone: 'ℹ️' },
    h('p', { class: 'small' },
      h('b', {}, 'KATSEYE Central'), ` v${VERSAO} — painel de gestão criativa dedicado ao ${GRUPO.nome} `,
      `(${GRUPO.gravadoras}).`),
    h('p', { class: 'small muted mt' },
      'App estático: HTML, CSS e JavaScript puro, sem build e sem dependência. Instalável como PWA.'),
    h('div', { class: 'flexb mt' },
      h('button', {
        class: 'btn btn--sm',
        onclick: () => modal('❓ Manual rápido', h('div', { class: 'small' },
          ...MANUAL.map(([t, txt]) => h('div', { class: 'mb' },
            h('b', {}, t), h('p', { class: 'muted' }, txt)))), { largo: true }),
      }, '❓ Manual rápido'),
      h('a', { class: 'btn btn--sm', href: '#/conselheiro' }, '🧠 Perguntar ao Conselheiro')),
    aviso(AVISO_DADOS, 'info'));

  const raiz = h('div', { class: 'grid g2', style: { alignItems: 'start' } },
    h('div', { class: 'flexc' }, perfil, conselheiro, dados, log),
    h('div', { class: 'flexc' }, aparencia, relogio, cacheEl, sobre));

  alvo.replaceChildren(
    tituloPagina('Sistema', 'Preferências, conexão da IA, seus dados e o registro do que aconteceu.'),
    raiz);
  cascata(raiz.children, { passo: 60 });
  return null;
}

/* ==========================================================
   PAINEL DA IA
   ========================================================== */
function painelIA(recarregar) {
  const s = st();
  const ia = s.ia;
  const p = provedor(ia.provedor);
  const motivo = motivoIA();

  const cChave = inp({
    type: 'password',
    value: chaveDe(ia.provedor),
    placeholder: p.id === 'gemini' ? 'AIza…' : 'sk-ant-…',
    autocomplete: 'off',
  });
  const cModelo = sel(
    [{ v: '', t: `Padrão (${p.padrao})` }, ...p.modelos.map((m) => ({ v: m, t: m }))],
    ia.modelo,
  );
  const cServidor = inp({ value: ia.servidor, placeholder: 'https://meu-servidor.exemplo.com' });

  const blocoChave = h('div', {},
    h('label', { class: 'f' }, h('span', {}, 'Provedor'),
      segmento(PROVEDORES.map((x) => ({ v: x.id, t: `${x.nome} · ${x.chamada}` })), ia.provedor, (v) => {
        set((x) => { x.ia.provedor = v; x.ia.modelo = ''; });
        recarregar();
      })),
    campo('Chave da API', cChave, p.nota),
    campo('Modelo', cModelo),
    h('div', { class: 'flexb' },
      h('a', { class: 'btn btn--sm', href: p.ondePegar, target: '_blank', rel: 'noopener' }, '🔗 Pegar uma chave'),
      h('button', {
        class: 'btn btn--p btn--sm sp',
        onclick: async (ev) => {
          set((x) => { x.ia[p.campo] = cChave.value.trim(); x.ia.modelo = cModelo.value; x.ia.modo = 'chave'; });
          const b = ev.currentTarget;
          b.disabled = true; b.textContent = 'testando…';
          const ok = await testar();
          b.disabled = false; b.textContent = 'Salvar e testar';
          toast(ok.ok ? `Funcionou — ${p.nome} respondeu 👌` : `Não rolou: ${ok.erro}`, ok.ok ? 'good' : 'bad');
          registrar('🔌', 'IA configurada', `${p.nome} · ${ok.ok ? 'teste ok' : 'teste falhou'}`, '#/config');
          recarregar();
        },
      }, 'Salvar e testar')));

  const blocoServidor = h('div', {},
    campo('Endereço do servidor', cServidor,
      'O app faz POST em /conselho com { sistema, mensagens, modelo } e espera { texto }. '
      + 'É o caminho certo para publicar: a chave fica no servidor, não no navegador de quem usa.'),
    h('button', {
      class: 'btn btn--p btn--sm',
      onclick: () => {
        set((x) => { x.ia.servidor = cServidor.value.trim(); x.ia.modo = 'servidor'; });
        toast('Servidor salvo', 'good');
        recarregar();
      },
    }, 'Salvar servidor'));

  return painel('Conselheiro (IA)', {
    icone: '🧠',
    acao: h('span', { class: `chip ${motivo.ok ? 'ok' : 'warn'}` },
      modoIA() === 'local' ? 'motor local' : 'IA ligada'),
  },
    h('p', { class: 'small muted mb' }, motivo.txt),
    h('label', { class: 'f' }, h('span', {}, 'Como conectar'),
      segmento([
        { v: 'local', t: '🧩 Só o motor local' },
        { v: 'chave', t: '🔑 Chave neste aparelho' },
        { v: 'servidor', t: '🛰️ Servidor meu' },
      ], ia.modo, (v) => { set((x) => { x.ia.modo = v; }); recarregar(); })),
    ia.modo === 'chave' ? blocoChave : null,
    ia.modo === 'servidor' ? blocoServidor : null,
    ia.modo === 'local' ? h('p', { class: 'small muted' },
      'Sem conexão nenhuma: o Conselheiro responde com cálculos sobre os seus dados e frameworks fixos. '
      + 'Funciona offline e nunca inventa número.') : null,
    ia.modo === 'chave' ? aviso(
      '**Cuidado ao publicar:** a chave salva aqui fica no `localStorage` deste navegador. '
      + 'Para uso pessoal, tudo bem. Se outras pessoas forem usar o app, prefira o modo servidor — '
      + 'senão a sua chave roda na máquina delas.', 'bad') : null,
    modoIA() !== 'local' ? h('p', { class: 'tiny dim2 mt' },
      `${usoHoje()} pergunta(s) enviadas hoje · modelo ${modeloAtual()}`) : null);
}

/** Pergunta curta só para conferir se a conexão funciona. */
async function testar() {
  try {
    const { perguntar } = await import('../ia.js');
    const r = await perguntar([], 'Responda apenas: ok');
    if (r.local) return { ok: false, erro: r.erro || 'a resposta veio do motor local' };
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e.message };
  }
}
