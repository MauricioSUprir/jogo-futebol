/* ===== views/estudio.js — Estúdio Criativo =====
   Cartazes, flyers, posts e ingressos colecionáveis. O desenho é feito pelo
   renderizador (cartaz.js); esta tela é o painel de controle e a exportação. */

import { h, debounce, baixar, lerArquivo, uid, fmtQuando, cortar } from '../util.js';
import {
  st, salvarProjeto, removerProjeto, projeto as acharProjeto, registrar, integrantes,
} from '../store.js';
import { FORMATOS, PALETAS } from '../dados.js';
import {
  cfgPadrao, renderizar, paraPNG, paraImpressao, gerarSerie, TIPOS_FUNDO,
} from '../cartaz.js';
import {
  tituloPagina, painel, campo, inp, txtarea, sel, segmento, toast, vazio,
  confirmar, modal, fecharModal, carregando, cascata, monograma, aviso,
} from '../ui.js';

/* configuração em edição — vive só enquanto a tela está aberta */
let cfg = null;
let projetoId = null;

export function render(alvo, { id = null } = {}) {
  if (id && id !== projetoId) {
    const p = acharProjeto(id);
    if (p) { cfg = { ...cfgPadrao(), ...p.cfg }; projetoId = p.id; }
  }
  if (!cfg) { cfg = cfgPadrao(); projetoId = null; }

  const recarregar = () => { alvo.replaceChildren(); render(alvo, {}); };

  /* ---------- palco ---------- */
  const canvas = h('canvas');
  const palco = h('div', { class: 'studio__palco' }, canvas);
  const estado = h('div', { class: 'tiny dim2 center mt' }, '—');

  const desenhar = debounce(async () => {
    try {
      await renderizar(cfg, { escala: 1, canvas });
      const f = FORMATOS.find((x) => x.id === cfg.formato);
      estado.textContent = `${f.nome} · ${f.l}×${f.a}px · exporta em até 3× (${f.l * 3}×${f.a * 3})`;
    } catch (e) {
      estado.textContent = `Não consegui desenhar: ${e.message}`;
    }
  }, 90);
  desenhar();

  const mudar = (chave, valor) => { cfg[chave] = valor; desenhar(); };

  /* ---------- controles ---------- */
  const formatoEl = h('div', { class: 'tpl' }, ...FORMATOS.map((f) => h('button', {
    class: cfg.formato === f.id ? 'on' : '',
    onclick: (ev) => {
      [...ev.currentTarget.parentElement.children].forEach((c) => c.classList.remove('on'));
      ev.currentTarget.classList.add('on');
      mudar('formato', f.id);
    },
  }, h('span', { class: 'em' }, f.emoji), h('b', {}, f.nome), h('span', {}, f.desc))));

  const paletaEl = h('div', { class: 'swatches' }, ...PALETAS.map((p) => h('button', {
    class: `swatch ${cfg.paleta === p.id ? 'on' : ''}`,
    title: `${p.nome} — ${p.chamada}`,
    style: { background: `linear-gradient(135deg, ${p.a}, ${p.b} 60%, ${p.c})` },
    onclick: (ev) => {
      [...ev.currentTarget.parentElement.children].forEach((c) => c.classList.remove('on'));
      ev.currentTarget.classList.add('on');
      mudar('paleta', p.id);
    },
  })));

  const campos = {
    selo: inp({ value: cfg.selo, oninput: (e) => mudar('selo', e.target.value) }),
    titulo: inp({ value: cfg.titulo, oninput: (e) => mudar('titulo', e.target.value) }),
    subtitulo: inp({ value: cfg.subtitulo, oninput: (e) => mudar('subtitulo', e.target.value) }),
    data: inp({ value: cfg.data, oninput: (e) => mudar('data', e.target.value) }),
    hora: inp({ value: cfg.hora, oninput: (e) => mudar('hora', e.target.value) }),
    local: inp({ value: cfg.local, oninput: (e) => mudar('local', e.target.value) }),
    setor: inp({ value: cfg.setor, oninput: (e) => mudar('setor', e.target.value) }),
    preco: inp({ value: cfg.preco, oninput: (e) => mudar('preco', e.target.value) }),
    portador: inp({ value: cfg.portador, oninput: (e) => mudar('portador', e.target.value) }),
    rodape: inp({ value: cfg.rodape, oninput: (e) => mudar('rodape', e.target.value) }),
  };

  const serieEl = inp({
    value: cfg.serie || gerarSerie(cfg.titulo),
    oninput: (e) => mudar('serie', e.target.value),
  });

  const textoBloco = painel('Texto', { icone: '✍️' },
    campo('Selo (o topo da peça)', campos.selo),
    campo('Título', campos.titulo),
    campo('Subtítulo', campos.subtitulo),
    h('div', { class: 'f-row' }, campo('Data', campos.data), campo('Hora', campos.hora)),
    campo('Local', campos.local),
    campo('Rodapé', campos.rodape));

  const ingressoBloco = painel('Ingresso', { icone: '🎟️' },
    h('div', { class: 'f-row' }, campo('Setor', campos.setor), campo('Preço', campos.preco)),
    campo('Portador', campos.portador, 'O nome impresso no ingresso.'),
    campo('Série', serieEl, 'O código de barras é gerado a partir dela — mesma série, mesmo padrão.'),
    h('button', {
      class: 'btn btn--sm',
      onclick: () => { serieEl.value = gerarSerie(`${cfg.titulo}${Math.random()}`); mudar('serie', serieEl.value); },
    }, '🎲 Nova série'));

  const estiloBloco = painel('Estilo', { icone: '🎨' },
    h('label', { class: 'f' }, h('span', {}, 'Paleta'), paletaEl),
    h('label', { class: 'f' }, h('span', {}, 'Fundo'),
      segmento(TIPOS_FUNDO, cfg.fundo, (v) => mudar('fundo', v))),
    h('label', { class: 'f' }, h('span', {}, 'Alinhamento'),
      segmento([{ v: 'centro', t: 'Centro' }, { v: 'esquerda', t: 'Esquerda' }], cfg.alinhamento, (v) => mudar('alinhamento', v))),
    h('label', { class: 'f' }, h('span', {}, 'Tamanho do texto'),
      inp({
        type: 'range', min: 0.7, max: 1.35, step: 0.01, value: cfg.escalaTexto,
        oninput: (e) => mudar('escalaTexto', Number(e.target.value)),
      })),
    h('label', { class: 'f' }, h('span', {}, 'Cor de acento da integrante'),
      sel([{ v: '', t: 'Usar a paleta' }, ...integrantes().map((m) => ({ v: m.cor, t: `${m.nome} (${m.cor})` }))],
        cfg.corIntegrante, { onchange: (e) => mudar('corIntegrante', e.target.value) })),
    h('div', { class: 'flexb' },
      chaveSimples('MAIÚSCULAS', cfg.maiusculas, (v) => mudar('maiusculas', v)),
      chaveSimples('Grão', cfg.granulado, (v) => mudar('granulado', v)),
      chaveSimples('Brilho', cfg.brilho, (v) => mudar('brilho', v))));

  /* ---------- foto de fundo ---------- */
  const arquivoFoto = h('input', {
    type: 'file', accept: 'image/*', hidden: true,
    onchange: async (e) => {
      const f = e.target.files?.[0];
      e.target.value = '';
      if (!f) return;
      try {
        const bruto = await lerArquivo(f);
        cfg.fotoDataURL = bruto;
        desenhar();
        toast('Imagem no fundo', 'good');
        recarregar();
      } catch (err) { toast(err.message, 'bad'); }
    },
  });

  const fotoBloco = painel('Imagem de fundo', { icone: '🖼️' },
    h('div', { class: 'flexb mb' },
      h('button', { class: 'btn btn--sm', onclick: () => arquivoFoto.click() },
        cfg.fotoDataURL ? 'Trocar imagem' : 'Escolher imagem'),
      cfg.fotoDataURL ? h('button', {
        class: 'btn btn--sm btn--d',
        onclick: () => { cfg.fotoDataURL = ''; desenhar(); recarregar(); },
      }, 'Remover') : null,
      arquivoFoto),
    cfg.fotoDataURL ? h('div', {},
      h('label', { class: 'f' }, h('span', {}, 'Opacidade'),
        inp({
          type: 'range', min: 0.1, max: 1, step: 0.02, value: cfg.fotoOpacidade,
          oninput: (e) => mudar('fotoOpacidade', Number(e.target.value)),
        })),
      h('label', { class: 'f' }, h('span', {}, 'Enquadramento vertical'),
        inp({
          type: 'range', min: 0, max: 100, step: 1, value: cfg.fotoPosicao,
          oninput: (e) => mudar('fotoPosicao', Number(e.target.value)),
        }))) : h('p', { class: 'tiny dim2' },
      'A imagem fica só nesta peça e não sai do aparelho. Use material que você tenha direito de usar.'));

  /* ---------- exportação ---------- */
  const exportar = painel('Exportar', { icone: '⬇️' },
    h('div', { class: 'flexb mb' },
      ...[1, 2, 3].map((n) => h('button', {
        class: `btn btn--sm ${n === 2 ? 'btn--p' : ''}`,
        onclick: async (ev) => {
          const b = ev.currentTarget;
          const antes = b.textContent;
          b.textContent = 'gerando…'; b.disabled = true;
          try {
            const url = await paraPNG(cfg, n);
            baixar(`${(cfg.titulo || 'katseye').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${n}x.png`, url);
            registrar('🎨', 'Peça exportada', `${cfg.titulo} (${n}×)`, '#/estudio');
            toast(`PNG em ${n}× baixado`, 'good');
          } catch (e) { toast(`Falhou: ${e.message}`, 'bad'); }
          b.textContent = antes; b.disabled = false;
        },
      }, `PNG ${n}×`))),
    h('button', {
      class: 'btn btn--blk btn--gold',
      onclick: async () => {
        try {
          await paraImpressao(cfg);
          toast('Escolha “Salvar como PDF” na janela de impressão', 'good');
        } catch (e) { toast(e.message, 'bad'); }
      },
    }, '🖨️ PDF / impressão'),
    h('p', { class: 'tiny dim2 mt' },
      'O PDF sai pela janela de impressão do navegador, no tamanho exato da peça (150 dpi). '
      + 'Sem biblioteca extra — e o resultado é o mesmo arquivo vetorializado que a impressora recebe.'));

  /* ---------- projetos salvos ---------- */
  const salvos = st().projetos;
  const painelSalvos = painel('Minhas peças', {
    icone: '📁',
    acao: h('button', {
      class: 'btn btn--xs btn--p',
      onclick: () => {
        const nome = (cfg.titulo || 'Peça sem título').trim();
        const p = salvarProjeto({ ...(projetoId ? { id: projetoId } : {}), nome, formato: cfg.formato, cfg: { ...cfg } });
        projetoId = p.id;
        registrar('🎨', projetoId ? 'Peça salva' : 'Peça criada', nome, '#/estudio');
        toast('Peça salva', 'good');
        recarregar();
      },
    }, projetoId ? '💾 Salvar' : '💾 Salvar como nova'),
  }, salvos.length
    ? h('div', { class: 'list' }, ...salvos.map((p) => h('div', {
      class: `row row--btn ${p.id === projetoId ? 'card--acc' : ''}`,
      onclick: () => { cfg = { ...cfgPadrao(), ...p.cfg }; projetoId = p.id; recarregar(); },
    },
      h('span', { style: { fontSize: '17px' } }, FORMATOS.find((f) => f.id === p.formato)?.emoji || '🎨'),
      h('span', { class: 'grow' },
        h('div', { class: 'ttl' }, cortar(p.nome, 30)),
        h('div', { class: 'sub' }, h('span', {}, `${p.formato} · ${fmtQuando(p.atualizadoEm)}`))),
      h('button', {
        class: 'btn btn--xs btn--d',
        onclick: (ev) => {
          ev.stopPropagation();
          confirmar('Apagar peça?', `"${p.nome}" some da lista.`, () => {
            removerProjeto(p.id);
            if (projetoId === p.id) { cfg = cfgPadrao(); projetoId = null; }
            toast('Peça apagada'); recarregar();
          });
        },
      }, '✕'))))
    : vazio('Nenhuma peça salva', 'Monte a arte ao lado e clique em salvar.', null, '📁'));

  /* ---------- montagem ---------- */
  const controles = h('div', { class: 'studio__ctrl' },
    painel('Formato', { icone: '📐' }, formatoEl),
    textoBloco,
    cfg.formato === 'ingresso' ? ingressoBloco : null,
    estiloBloco,
    fotoBloco,
    exportar);

  const raiz = h('div', { class: 'studio' },
    h('div', {}, palco, estado, h('div', { class: 'mt' }, painelSalvos)),
    controles);

  alvo.replaceChildren(
    tituloPagina('Estúdio Criativo',
      'Cartaz, flyer, post e ingresso colecionável — desenhados no navegador e exportados em alta.',
      h('button', {
        class: 'btn btn--sm',
        onclick: () => confirmar('Começar do zero?', 'A peça atual não salva será perdida.', () => {
          cfg = cfgPadrao(); projetoId = null; recarregar();
        }, { perigo: false, ok: 'Começar' }),
      }, 'Nova peça'),
      h('button', {
        class: 'btn btn--sm',
        onclick: () => modal('🎨 Como o Estúdio funciona', h('div', { class: 'small' },
          h('p', {}, 'Tudo é desenhado num canvas do navegador, no tamanho real do projeto. '
            + 'A pré-visualização é a mesma função do arquivo final — só muda a escala.'),
          h('p', { class: 'mt' }, h('b', {}, 'PNG 1×/2×/3×: '), 'redes sociais (1×), uso geral (2×) e impressão (3×).'),
          h('p', { class: 'mt' }, h('b', {}, 'PDF: '), 'abre a janela de impressão com a página no tamanho exato da peça. '
            + 'Escolha “Salvar como PDF” e o arquivo sai pronto para gráfica.'),
          h('p', { class: 'mt' }, h('b', {}, 'Ingresso: '), 'tem canhoto destacável, picote, série e código de barras '
            + 'derivado da série — a mesma série gera sempre o mesmo padrão.')))
      }, 'Como funciona')),
    raiz);
  cascata([palco, controles], { passo: 70 });
  return null;
}

/* chave liga/desliga compacta, usada no bloco de estilo */
function chaveSimples(rotulo, ligado, aoTrocar) {
  const b = h('button', {
    class: `chip chip--btn ${ligado ? 'chip--on' : ''}`,
    onclick: () => {
      const novo = !b.classList.contains('chip--on');
      b.classList.toggle('chip--on', novo);
      aoTrocar(novo);
    },
  }, rotulo);
  return b;
}
