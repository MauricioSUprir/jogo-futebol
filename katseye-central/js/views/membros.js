/* ===== views/membros.js — Enciclopédia e perfis =====
   Duas telas no mesmo arquivo: a grade das integrantes (#/membros) e o perfil
   completo (#/membros/<id>), com ficha editável, lore, linha do tempo,
   discografia e galeria com lightbox.                                       */

import { h, fmtData, iso, uid, lerArquivo, cortar } from '../util.js';
import {
  st, set, integrantes, integrantePorId, editarIntegrante, restaurarIntegrante,
  integranteEditada, lancamentos, salvarLancamento, removerLancamento,
  addFotoGaleria, removerFotoGaleria, galeriaDe, registrar,
} from '../store.js';
import { AVISO_DADOS, MARCOS, GRUPO } from '../dados.js';
import {
  tituloPagina, painel, monograma, vazio, aviso, modal, fecharModal, toast,
  campo, inp, txtarea, sel, confirmar, lightbox, carregando, cascata, kpi,
} from '../ui.js';
import * as fotos from '../fotos.js';

export function render(alvo, { id = null } = {}) {
  if (id) return perfil(alvo, id);
  return grade(alvo);
}

/* ==========================================================
   GRADE
   ========================================================== */
function grade(alvo) {
  const lista = integrantes();
  const rel = lancamentos();
  const recarregar = () => { alvo.replaceChildren(); grade(alvo); };

  const cartoes = h('div', { class: 'mgrid' }, ...lista.map((m) => {
    const fotoId = galeriaDe(m.id)[0]?.fotoId;
    const art = h('div', {
      class: 'mcard__art',
      style: { background: `linear-gradient(150deg, ${m.cor}, ${m.cor2})` },
    }, h('span', { class: 'mcard__mono' }, m.monograma || m.nome.slice(0, 2).toUpperCase()));

    if (fotoId) {
      fotos.ler(fotoId).then((src) => { if (src) art.prepend(h('img', { src, alt: m.nome })); });
    }

    return h('button', {
      class: 'mcard',
      onclick: () => { location.hash = `#/membros/${m.id}`; },
    }, art, h('div', { class: 'mcard__t' },
      h('b', {}, m.nome),
      h('span', {}, `${m.bandeira || ''} ${m.papel || m.pais || ''}`)));
  }));

  const disco = painel('Discografia', {
    icone: '💿',
    acao: h('button', { class: 'btn btn--xs', onclick: () => formLancamento(null, recarregar) }, '+ lançamento'),
  }, rel.length
    ? h('div', { class: 'list' }, ...rel.map((r) => h('div', {
      class: 'row row--btn',
      onclick: () => formLancamento(r, recarregar),
    },
      h('span', { style: { fontSize: '17px' } }, r.tipo === 'EP' || r.tipo === 'álbum' ? '💿' : '🎵'),
      h('span', { class: 'grow' },
        h('div', { class: 'ttl' }, r.titulo, h('span', { class: 'chip' }, r.tipo)),
        h('div', { class: 'sub' },
          h('span', {}, fmtData(r.data, { relativo: false })),
          r.nota ? h('span', {}, cortar(r.nota, 52)) : null)),
      r.faixas?.length ? h('span', { class: 'chip' }, `${r.faixas.length} faixas`) : null)))
    : vazio('Sem lançamentos', 'Adicione o primeiro.', null, '💿'));

  const linha = painel('Linha do tempo do projeto', { icone: '🕰️' },
    h('div', { class: 'tl' }, ...MARCOS.map((mk) => h('div', { class: 'tl__i' },
      h('span', { class: 'yr' }, fmtData(mk.data, { relativo: false })),
      h('b', {}, mk.titulo),
      h('p', {}, mk.texto)))));

  const ficha = h('div', { class: 'grid g4 keep2' },
    kpi(lista.length, 'integrantes'),
    kpi(rel.length, 'lançamentos registrados'),
    kpi(st().galeria.length, 'fotos na galeria'),
    kpi(GRUPO.fandom, 'fandom', GRUPO.gravadoras));

  const raiz = h('div', { class: 'flexc', style: { gap: '18px' } },
    ficha,
    painel('As integrantes', {
      icone: '👑',
      acao: h('button', { class: 'btn btn--xs', onclick: () => formIntegrante(null, recarregar) }, '+ integrante'),
    }, cartoes),
    disco,
    linha,
    aviso(AVISO_DADOS, 'info'));

  alvo.replaceChildren(
    tituloPagina('Enciclopédia',
      `${GRUPO.nome} · ${GRUPO.gravadoras} · estreia em ${fmtData(GRUPO.estreia, { relativo: false })}`),
    raiz);
  cascata(raiz.children, { passo: 60 });
  return null;
}

/* ==========================================================
   PERFIL
   ========================================================== */
function perfil(alvo, id) {
  const m = integrantePorId(id);
  if (!m) {
    alvo.replaceChildren(vazio('Integrante não encontrada', 'Talvez o endereço esteja errado.',
      h('a', { class: 'btn btn--p', href: '#/membros' }, 'Voltar para a enciclopédia'), '🔍'));
    return null;
  }
  const recarregar = () => { alvo.replaceChildren(); perfil(alvo, id); };
  const minhasFotos = galeriaDe(m.id);

  /* --- hero --- */
  const mono = h('div', {
    class: 'mhero__mono',
    style: { background: `linear-gradient(135deg, ${m.cor}, ${m.cor2})` },
  }, m.monograma || m.nome.slice(0, 2).toUpperCase());
  if (minhasFotos[0]) {
    fotos.ler(minhasFotos[0].fotoId).then((src) => { if (src) mono.prepend(h('img', { src, alt: m.nome })); });
  }

  const hero = h('div', {
    class: 'mhero',
    style: {
      background: `radial-gradient(120% 140% at 0% 0%, ${m.cor}44, transparent 60%),`
        + `radial-gradient(110% 130% at 100% 20%, ${m.cor2}33, transparent 58%), var(--panel)`,
    },
  }, mono,
    h('div', { class: 'mhero__t' },
      h('span', { class: 'eyebrow' }, m.papel || 'Integrante'),
      h('h1', {}, m.nome),
      h('p', { class: 'muted' }, m.nomeCompleto || ''),
      h('div', { class: 'chips', style: { marginTop: '12px' } },
        m.pais ? h('span', { class: 'chip' }, `${m.bandeira || '🌍'} ${m.pais}`) : null,
        m.idiomas ? h('span', { class: 'chip' }, `🗣️ ${m.idiomas}`) : null,
        integranteEditada(m.id) ? h('span', { class: 'chip gold' }, 'editada por você') : null,
        st().perfil.biasId === m.id ? h('span', { class: 'chip gold' }, '⭐ destacada') : null)),
    h('div', { class: 'flexc', style: { flex: '0 0 auto' } },
      h('button', { class: 'btn btn--sm', onclick: () => formIntegrante(m, recarregar) }, '✏️ Editar'),
      h('button', {
        class: 'btn btn--sm',
        onclick: () => {
          const ja = st().perfil.biasId === m.id;
          set((s) => { s.perfil.biasId = ja ? '' : m.id; });
          toast(ja ? 'Destaque removido' : `${m.nome} destacada no painel`, 'good');
          recarregar();
        },
      }, st().perfil.biasId === m.id ? '☆ Tirar destaque' : '⭐ Destacar')));

  /* --- ficha --- */
  const linhas = [
    ['Nome completo', m.nomeCompleto],
    ['Origem', m.origem || m.pais],
    ['Função no grupo', m.papel],
    ['Nascimento', m.nascimento],
    ['Idiomas', m.idiomas],
  ].filter(([, v]) => v);

  const fichaEl = painel('Ficha', { icone: '📇' },
    linhas.length
      ? h('table', { class: 'tb' }, h('tbody', {}, ...linhas.map(([k, v]) =>
        h('tr', {}, h('td', { class: 'muted', style: { width: '40%' } }, k), h('td', {}, h('b', {}, v))))))
      : h('p', { class: 'small muted' }, 'A ficha está vazia — use “Editar” para preencher.'),
    h('p', { class: 'tiny dim2 mt' },
      'Campos em branco ficam assim de propósito: a semente do app não traz dado que não dê para confirmar.'));

  /* --- lore --- */
  const lore = painel('Lore', { icone: '📖' },
    m.lore ? h('p', { class: 'small', style: { lineHeight: '1.7' } }, m.lore)
      : h('p', { class: 'small muted' }, 'Sem texto ainda.'),
    (m.fatos || []).length
      ? h('div', { class: 'chips mt' }, ...m.fatos.map((f) => h('span', { class: 'chip' }, f)))
      : null);

  /* --- galeria --- */
  const galeriaEl = h('div', { class: 'gal' });
  montarGaleria(galeriaEl, m, recarregar);

  const galeriaPainel = painel('Galeria', {
    icone: '🖼️',
    acao: h('span', { class: 'tiny dim2' }, `${minhasFotos.length} foto(s)`),
  }, galeriaEl,
    h('p', { class: 'tiny dim2 mt' },
      'As imagens ficam neste aparelho (IndexedDB) e nunca são enviadas para lugar nenhum. '
      + 'Suba só o que você tem direito de usar.'));

  /* --- discografia relacionada --- */
  const rel = lancamentos();
  const disco = painel('Lançamentos do grupo', { icone: '💿' },
    h('div', { class: 'tl' }, ...rel.map((r) => h('div', { class: 'tl__i' },
      h('span', { class: 'yr' }, fmtData(r.data, { relativo: false })),
      h('b', {}, `${r.titulo} · ${r.tipo}`),
      r.nota ? h('p', {}, r.nota) : null))));

  const acoes = h('div', { class: 'flexb' },
    h('a', { class: 'btn btn--sm', href: '#/membros' }, '← Enciclopédia'),
    m.semente && integranteEditada(m.id) ? h('button', {
      class: 'btn btn--sm btn--d',
      onclick: () => confirmar('Restaurar dados originais?',
        `Suas edições em ${m.nome} serão descartadas e a ficha volta à semente do app.`,
        () => { restaurarIntegrante(m.id); toast('Ficha restaurada'); recarregar(); }),
    }, 'Restaurar original') : null);

  const raiz = h('div', { class: 'flexc', style: { gap: '18px' } },
    hero,
    h('div', { class: 'grid g-side' },
      h('div', { class: 'flexc' }, lore, galeriaPainel),
      h('div', { class: 'flexc' }, fichaEl, disco)),
    acoes);

  alvo.replaceChildren(raiz);
  cascata(raiz.children, { passo: 60 });
  return null;
}

/* ---------- galeria (assíncrona) ---------- */
async function montarGaleria(el, m, recarregar) {
  const itens = galeriaDe(m.id);
  el.replaceChildren(itens.length ? carregando('Abrindo as imagens…') : h('span'));

  const mapa = await fotos.lerVarias(itens.map((i) => i.fotoId));
  const validos = itens.filter((i) => mapa[i.fotoId]).map((i) => ({ ...i, src: mapa[i.fotoId] }));

  const adicionar = h('input', {
    type: 'file', accept: 'image/*', multiple: true, hidden: true,
    onchange: async (ev) => {
      const arquivos = [...(ev.target.files || [])];
      ev.target.value = '';
      for (const f of arquivos) {
        try {
          const bruto = await lerArquivo(f);
          const menor = await fotos.redimensionar(bruto);
          const fotoId = uid('img');
          await fotos.guardar(fotoId, menor);
          addFotoGaleria({ integranteId: m.id, fotoId, legenda: f.name.replace(/\.[^.]+$/, '') });
        } catch (e) {
          toast(`Não consegui guardar ${f.name}: ${e.message}`, 'bad');
        }
      }
      registrar('🖼️', 'Fotos adicionadas', `${arquivos.length} em ${m.nome}`, `#/membros/${m.id}`);
      toast(`${arquivos.length} imagem(ns) na galeria`, 'good');
      recarregar();
    },
  });

  const grade = validos.map((it, i) => h('button', {
    class: 'gal__i',
    onclick: () => lightbox(validos, i),
    oncontextmenu: (ev) => {
      ev.preventDefault();
      confirmar('Apagar foto?', 'Ela sai da galeria e do armazenamento do aparelho.', async () => {
        await fotos.apagar(it.fotoId);
        removerFotoGaleria(it.id);
        toast('Foto apagada');
        recarregar();
      });
    },
    title: `${it.legenda || 'Foto'} — clique para ampliar, botão direito para apagar`,
  }, h('img', { src: it.src, alt: it.legenda || '', loading: 'lazy' })));

  el.replaceChildren(
    ...grade,
    h('button', { class: 'gal__i gal__add', onclick: () => adicionar.click(), title: 'Adicionar imagens' }, '＋'),
    adicionar);

  if (!validos.length) {
    el.parentElement?.insertBefore(
      h('p', { class: 'small muted mb' }, 'Nenhuma imagem ainda. O “＋” aceita várias de uma vez.'),
      el,
    );
  }
}

/* ==========================================================
   FORMULÁRIOS
   ========================================================== */
function formIntegrante(m = null, aoSalvar = () => {}) {
  const base = m || {
    nome: '', nomeCompleto: '', pais: '', bandeira: '🌍', origem: '', papel: '',
    nascimento: '', idiomas: '', lore: '', cor: '#a855f7', cor2: '#ff4f8b', monograma: '',
  };
  const c = {
    nome: inp({ value: base.nome, placeholder: 'Nome artístico' }),
    nomeCompleto: inp({ value: base.nomeCompleto || '' }),
    pais: inp({ value: base.pais || '' }),
    bandeira: inp({ value: base.bandeira || '', maxlength: 4, placeholder: '🇧🇷' }),
    origem: inp({ value: base.origem || '' }),
    papel: inp({ value: base.papel || '', placeholder: 'Ex.: vocal principal' }),
    nascimento: inp({ value: base.nascimento || '', placeholder: 'AAAA-MM-DD (opcional)' }),
    idiomas: inp({ value: base.idiomas || '' }),
    monograma: inp({ value: base.monograma || '', maxlength: 3 }),
    cor: inp({ type: 'color', value: base.cor || '#a855f7' }),
    cor2: inp({ type: 'color', value: base.cor2 || '#ff4f8b' }),
    lore: txtarea({ value: base.lore || '', rows: 5, placeholder: 'A apresentação dela dentro do projeto.' }),
  };

  modal(m ? `✏️ Editar ${m.nome}` : '👑 Nova integrante', h('div', {},
    h('div', { class: 'f-row' }, campo('Nome', c.nome), campo('Nome completo', c.nomeCompleto)),
    h('div', { class: 'f-row3' }, campo('País', c.pais), campo('Bandeira', c.bandeira), campo('Monograma', c.monograma)),
    campo('Origem', c.origem),
    h('div', { class: 'f-row' }, campo('Função no grupo', c.papel), campo('Idiomas', c.idiomas)),
    campo('Nascimento', c.nascimento, 'Deixe em branco se não tiver certeza — o app prefere vazio a errado.'),
    h('div', { class: 'f-row' }, campo('Cor 1', c.cor), campo('Cor 2', c.cor2)),
    campo('Lore', c.lore),
    h('div', { class: 'flexb mt' },
      h('button', { class: 'btn sp', onclick: fecharModal }, 'Cancelar'),
      h('button', {
        class: 'btn btn--p',
        onclick: () => {
          const dados = Object.fromEntries(Object.entries(c).map(([k, el]) => [k, el.value.trim()]));
          if (!dados.nome) { toast('Precisa de um nome', 'bad'); return; }
          if (!dados.monograma) dados.monograma = dados.nome.slice(0, 2).toUpperCase();
          if (m) editarIntegrante(m.id, dados);
          else {
            set((s) => s.integrantesExtra.push({ id: uid('int'), fatos: [], ...dados }));
            registrar('👑', 'Integrante adicionada', dados.nome, '#/membros');
          }
          fecharModal(); toast('Salvo', 'good'); aoSalvar();
        },
      }, 'Salvar'))));
}

function formLancamento(r = null, aoSalvar = () => {}) {
  const base = r || { titulo: '', tipo: 'single', data: iso(), nota: '', faixas: [] };
  const cTitulo = inp({ value: base.titulo });
  const cTipo = sel([
    { v: 'single', t: 'Single' }, { v: 'EP', t: 'EP' },
    { v: 'álbum', t: 'Álbum' }, { v: 'colaboração', t: 'Colaboração' },
  ], base.tipo);
  const cData = inp({ type: 'date', value: String(base.data).slice(0, 10) });
  const cNota = txtarea({ value: base.nota || '', rows: 2 });
  const cFaixas = txtarea({
    value: (base.faixas || []).join('\n'), rows: 5,
    placeholder: 'Uma faixa por linha (opcional)',
  });

  modal(r ? '✏️ Editar lançamento' : '💿 Novo lançamento', h('div', {},
    campo('Título', cTitulo),
    h('div', { class: 'f-row' }, campo('Tipo', cTipo), campo('Data', cData)),
    campo('Observação', cNota),
    campo('Faixas', cFaixas, 'Se você não tem a lista confirmada, deixe vazio.'),
    h('div', { class: 'flexb mt' },
      r ? h('button', {
        class: 'btn btn--d',
        onclick: () => confirmar('Remover lançamento?', `"${r.titulo}" sai da discografia.`, () => {
          removerLancamento(r.id); fecharModal(); toast('Removido'); aoSalvar();
        }),
      }, 'Remover') : null,
      h('button', { class: 'btn sp', onclick: fecharModal }, 'Cancelar'),
      h('button', {
        class: 'btn btn--p',
        onclick: () => {
          const titulo = cTitulo.value.trim();
          if (!titulo) { toast('Precisa de um título', 'bad'); return; }
          salvarLancamento({
            ...(r ? { id: r.id } : {}),
            titulo, tipo: cTipo.value, data: cData.value, nota: cNota.value.trim(),
            faixas: cFaixas.value.split('\n').map((x) => x.trim()).filter(Boolean),
          });
          registrar('💿', r ? 'Lançamento atualizado' : 'Lançamento adicionado', titulo, '#/membros');
          fecharModal(); toast('Salvo', 'good'); aoSalvar();
        },
      }, 'Salvar'))));
}
