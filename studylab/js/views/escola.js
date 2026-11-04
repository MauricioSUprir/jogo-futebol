/* ===== views/escola.js — Minha Escola =====
   Tudo da escola num lugar só, em abas:
   - Semana: as aulas de cada dia (o horário escolar)
   - Calendário: feriados, férias, bimestres, reuniões e eventos da escola
   - Provas e testes: as avaliações marcadas, com a contagem e o preparo
   - Materiais: arquivos (PDF, fotos, documentos), links e anotações por matéria
   - Aprendendo: o que o aluno conta que está vendo em cada matéria, com fotos
   Os arquivos e fotos ficam só no aparelho (IndexedDB, fotos.js). O calendário
   pode ser importado de uma foto/PDF pela IA (plano pago), sempre conferido
   pelo aluno antes de entrar.                                                 */
import { h, iso, fmtData, today, parseISO, daysBetween } from '../util.js';
import { st, set, nomeMateria, emojiMateria, novoMaterial, novaProva, novoEvento, remover } from '../store.js';
import { preparoProva } from '../engine.js';
import { titulo, cartao, vazio, toast, confirmar, txtarea, modal, fecharModal, segmento, sel, paywall, liberado } from '../ui.js';
import {
  comprimirImagem, guardarFoto, fotosDaMateria, apagarFoto, salvarArquivo, abrirArquivoSalvo, apagarArquivoSalvo,
  tamanhoLegivel, dataUrlParaBloco,
} from '../fotos.js';
import { formProva, formMaterial, TIPOS_EVENTO, TIPOS_CALENDARIO, rotuloAvaliacao, opcoesMaterias } from './comum.js';
import { editarHorario, formEvento } from './agenda.js';
import { temIA, lerCalendarioEscolar } from '../ai.js';
import { norm } from '../util.js';

const MAX_FOTOS_POR_MATERIA = 40;
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const ABAS = [
  { v: 'semana', t: '📆 Semana' }, { v: 'calendario', t: '🗓️ Calendário' }, { v: 'provas', t: '🎯 Provas e testes' },
  { v: 'materiais', t: '📂 Materiais' }, { v: 'aprendendo', t: '✍️ Aprendendo' },
];
let aba = 'semana';
let materiaFiltro = '';

export function render(el, { params } = {}) {
  const pedida = params?.get?.('aba');
  if (pedida && ABAS.some((a) => a.v === pedida)) aba = pedida;
  const pintar = () => { el.replaceChildren(); montar(el, pintar); };
  montar(el, pintar);
}

function montar(el, pintar) {
  el.append(titulo('🏫 Minha Escola', 'Aulas, calendário, provas e materiais da sua escola — tudo num lugar só.'));
  el.append(h('div', { class: 'mb', style: { overflowX: 'auto' } }, segmento(ABAS, aba, (v) => { aba = v; pintar(); })));
  const corpo = {
    semana: abaSemana, calendario: abaCalendario, provas: abaProvas, materiais: abaMateriais, aprendendo: abaAprendendo,
  }[aba] || abaSemana;
  el.append(corpo(pintar));
}

const quando = (dataISO) => {
  const d = daysBetween(today(), parseISO(dataISO));
  return d === 0 ? 'hoje' : d === 1 ? 'amanhã' : d < 0 ? `há ${-d} dia(s)` : `em ${d} dias`;
};
const diaSemana = (dataISO) => DIAS[parseISO(dataISO).getDay()].slice(0, 3).toLowerCase();

/* ==========================================================
   SEMANA — as aulas de cada dia
   ========================================================== */
function abaSemana(pintar) {
  const s = st();
  const hoje = new Date().getDay();
  const temAula = [1, 2, 3, 4, 5, 6].some((d) => (s.horario[d] || []).length);
  const box = h('div', {});
  box.append(h('div', { class: 'flexb mb' },
    h('p', { class: 'small muted grow', style: { margin: 0 } }, 'O horário da escola: o MindTrack usa para montar o seu dia e responder "quais aulas tenho hoje?".'),
    h('button', { class: 'btn btn--p', onclick: () => editarHorario(pintar) }, '✏️ Editar aulas')));
  if (!s.materias.length) {
    box.append(vazio('Cadastre suas matérias primeiro', 'As aulas são escolhidas da lista de matérias.',
      h('a', { class: 'btn btn--p', href: '#/materias' }, '📚 Cadastrar matérias')));
    return box;
  }
  if (!temAula) {
    box.append(vazio('Nenhuma aula cadastrada', 'Toque em "Editar aulas" e monte a semana — leva 2 minutos.',
      h('button', { class: 'btn btn--p', onclick: () => editarHorario(pintar) }, '✏️ Montar a semana')));
    return box;
  }
  box.append(h('div', { class: 'grid g3' }, ...[1, 2, 3, 4, 5, 6].filter((d) => d <= 5 || (s.horario[d] || []).length).map((d) => {
    const aulas = [...(s.horario[d] || [])].sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
    const c = cartao(
      h('div', { class: 'flexb' }, h('b', {}, DIAS[d]), d === hoje ? h('span', { class: 'chip chip--on' }, 'hoje') : null),
      aulas.length
        ? h('div', { class: 'list mt' }, ...aulas.map((a) => h('div', { class: 'row row--flat' },
          h('span', { class: 'tiny muted', style: { width: '42px', fontVariantNumeric: 'tabular-nums' } }, a.hora || '--:--'),
          h('span', {}, emojiMateria(a.materiaId)),
          h('span', { class: 'grow small' }, nomeMateria(a.materiaId)))))
        : h('p', { class: 'tiny muted' }, 'sem aulas'));
    if (d === hoje) c.style.borderColor = 'var(--acc)';
    return c;
  })));
  return box;
}

/* ==========================================================
   CALENDÁRIO DA ESCOLA
   ========================================================== */
let verPassados = false;

function abaCalendario(pintar) {
  const s = st();
  const box = h('div', {});
  box.append(h('div', { class: 'flexb mb', style: { flexWrap: 'wrap' } },
    h('button', { class: 'btn btn--p', onclick: () => formEvento(null, pintar, { tipo: 'feriado' }) }, '+ Adicionar data'),
    h('button', { class: 'btn', onclick: () => abrirImportar(pintar) }, '📸 Importar foto ou PDF do calendário'),
    h('label', { class: 'tiny muted sp', style: { display: 'flex', gap: '6px', alignItems: 'center' } },
      h('input', { type: 'checkbox', checked: verPassados, onchange: (e) => { verPassados = e.target.checked; pintar(); } }),
      'mostrar o que já passou')));

  const hoje = iso();
  const evs = s.eventos
    .filter((e) => TIPOS_CALENDARIO.includes(e.tipo))
    .filter((e) => verPassados || (e.ate || e.data) >= hoje)
    .sort((a, b) => a.data.localeCompare(b.data));
  if (!evs.length) {
    box.append(vazio('Nenhuma data da escola ainda',
      'Feriados, férias, início e fim de bimestre, reuniões e eventos. Adicione à mão ou importe a foto do calendário que a escola entregou.'));
    return box;
  }
  let mes = '';
  const lista = h('div', {});
  for (const e of evs) {
    const m = e.data.slice(0, 7);
    if (m !== mes) {
      mes = m;
      const nome = parseISO(e.data).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      lista.append(h('div', { class: 'side__grupo', style: { margin: '14px 4px 6px' } }, nome));
    }
    const tipo = TIPOS_EVENTO.find((t) => t.v === e.tipo);
    lista.append(h('div', { class: 'row', style: { opacity: (e.ate || e.data) < hoje ? 0.55 : 1 } },
      h('div', { style: { width: '54px', textAlign: 'center' } },
        h('b', { style: { fontSize: '20px', display: 'block', lineHeight: 1 } }, e.data.slice(8, 10)),
        h('span', { class: 'tiny muted' }, diaSemana(e.data))),
      h('div', { class: 'grow', style: { cursor: 'pointer' }, onclick: () => formEvento(e, pintar) },
        h('div', { class: 'small' }, `${tipo?.t.split(' ')[0] || '•'} ${e.titulo}`),
        h('div', { class: 'tiny muted' }, e.ate
          ? `de ${fmtData(e.data, { curto: true })} a ${fmtData(e.ate, { curto: true })}`
          : `${tipo?.t.slice(2).trim() || ''} · ${quando(e.data)}`)),
      h('button', {
        class: 'icon-btn', title: 'Apagar', 'aria-label': 'Apagar',
        onclick: () => confirmar('Apagar esta data?', e.titulo, () => { remover('eventos', e.id); pintar(); }),
      }, '✕')));
  }
  box.append(lista);
  return box;
}

/* ==========================================================
   PROVAS E TESTES
   ========================================================== */
function abaProvas(pintar) {
  const s = st();
  const box = h('div', {});
  box.append(h('div', { class: 'flexb mb', style: { flexWrap: 'wrap' } },
    h('button', { class: 'btn btn--p', onclick: () => formProva(null, pintar) }, '+ Nova prova ou teste'),
    h('button', { class: 'btn', onclick: () => abrirImportar(pintar) }, '📸 Importar calendário de provas')));

  const hoje = iso();
  const futuras = s.provas.filter((p) => p.data >= hoje).sort((a, b) => a.data.localeCompare(b.data));
  const passadas = s.provas.filter((p) => p.data < hoje).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 6);
  if (!futuras.length && !passadas.length) {
    box.append(vazio('Nenhuma prova ou teste marcado', 'Cadastre as avaliações — o MindTrack conta os dias, mede o seu preparo e monta o plano de estudo até cada uma.'));
    return box;
  }
  const linha = (p, passada) => {
    const pr = preparoProva(p);
    const cor = pr.preparo >= 70 ? 'var(--ok)' : pr.preparo >= 40 ? 'var(--warn)' : 'var(--bad)';
    return h('a', { class: 'row', href: `#/provas/${p.id}`, style: { opacity: passada ? 0.6 : 1 } },
      h('div', { style: { width: '54px', textAlign: 'center' } },
        h('b', { style: { fontSize: '20px', display: 'block', lineHeight: 1 } }, p.data.slice(8, 10)),
        h('span', { class: 'tiny muted' }, parseISO(p.data).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''))),
      h('div', { class: 'grow' },
        h('div', { class: 'small' }, `${emojiMateria(p.materiaId)} ${p.titulo}`),
        h('div', { class: 'tiny muted' }, `${rotuloAvaliacao(p.tipo)} · ${nomeMateria(p.materiaId)} · ${passada
          ? (p.nota != null ? `nota ${p.nota}` : 'já foi') : quando(p.data)}`)),
      passada ? null : h('span', { class: 'chip', style: { color: cor, borderColor: cor } }, `${pr.preparo}%`));
  };
  if (futuras.length) {
    box.append(h('div', { class: 'list' }, ...futuras.map((p) => linha(p, false))));
    box.append(h('p', { class: 'tiny muted mt' }, 'O número é o seu preparo estimado. Toque na avaliação para ver o plano de estudo até o dia.'));
  }
  if (passadas.length) {
    box.append(h('div', { class: 'side__grupo', style: { margin: '18px 4px 6px' } }, 'Já passaram'));
    box.append(h('div', { class: 'list' }, ...passadas.map((p) => linha(p, true))));
  }
  return box;
}

/* ==========================================================
   MATERIAIS — arquivos, links e anotações por matéria
   ========================================================== */
const ICONE_MAT = { pdf: '📄', imagem: '🖼️', link: '🔗', anotacao: '📝', resumo: '📖', lista: '📋', mapa: '🗺️', arquivo: '📎' };

function abaMateriais(pintar) {
  const s = st();
  const box = h('div', {});
  const filtro = sel([{ v: '', t: 'Todas as matérias' }, ...opcoesMaterias(false)], materiaFiltro);
  filtro.addEventListener('change', () => { materiaFiltro = filtro.value; pintar(); });

  const arquivo = h('input', { type: 'file', multiple: true, hidden: true, accept: '.pdf,image/*,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.odt' });
  arquivo.addEventListener('change', async () => {
    const escolhidos = [...(arquivo.files || [])];
    arquivo.value = '';
    let ok = 0;
    for (const f of escolhidos) {
      try {
        const a = await salvarArquivo(f);
        novoMaterial({
          titulo: f.name.replace(/\.[^.]+$/, ''), materiaId: materiaFiltro || null,
          tipo: /pdf/.test(a.mime) ? 'pdf' : /^image\//.test(a.mime) ? 'imagem' : 'arquivo',
          arquivoId: a.id, nomeArquivo: a.nome, mime: a.mime, tamanho: a.tamanho,
        });
        ok++;
      } catch (e) { toast(e.message, 'bad'); }
    }
    if (ok) { toast(`${ok} arquivo(s) guardado(s) 📎`, 'good'); pintar(); }
  });

  box.append(h('div', { class: 'flexb mb', style: { flexWrap: 'wrap' } },
    filtro,
    h('button', { class: 'btn btn--p', onclick: () => arquivo.click() }, '📎 Arquivo'),
    h('button', { class: 'btn', onclick: () => formMaterial(null, pintar, { tipo: 'link', materiaId: materiaFiltro }) }, '🔗 Link'),
    h('button', { class: 'btn', onclick: () => formMaterial(null, pintar, { tipo: 'anotacao', materiaId: materiaFiltro }) }, '📝 Anotação'),
    arquivo));

  const ms = s.biblioteca.filter((m) => !materiaFiltro || m.materiaId === materiaFiltro)
    .sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
  if (!ms.length) {
    box.append(vazio('Nenhum material ainda', 'Guarde PDFs, fotos da apostila, listas de exercícios, links e anotações — separados por matéria. Os arquivos ficam só no seu aparelho.'));
    return box;
  }
  box.append(h('div', { class: 'list' }, ...ms.map((m) => h('div', { class: 'row' },
    h('span', { style: { fontSize: '20px' } }, ICONE_MAT[m.tipo] || '📎'),
    h('div', {
      class: 'grow', style: { cursor: 'pointer', minWidth: 0 },
      onclick: () => {
        if (m.arquivoId) abrirArquivoSalvo(m.arquivoId).catch((e) => toast(e.message, 'bad'));
        else if (m.url && !m.conteudo) window.open(m.url, '_blank', 'noopener');
        else formMaterial(m, pintar);
      },
    },
      h('div', { class: 'small', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, m.titulo),
      h('div', { class: 'tiny muted' }, [
        m.materiaId ? `${emojiMateria(m.materiaId)} ${nomeMateria(m.materiaId)}` : 'sem matéria',
        m.tamanho ? tamanhoLegivel(m.tamanho) : null,
        m.criadoEm ? fmtData(m.criadoEm, { curto: true }) : null,
      ].filter(Boolean).join(' · '))),
    h('button', {
      class: 'icon-btn', title: 'Apagar', 'aria-label': 'Apagar',
      onclick: () => confirmar('Apagar material?', m.titulo, () => {
        if (m.arquivoId) apagarArquivoSalvo(m.arquivoId).catch(() => {});
        remover('biblioteca', m.id); pintar();
      }),
    }, '✕')))));
  return box;
}

/* ==========================================================
   IMPORTAR O CALENDÁRIO DE UMA FOTO / PDF (IA, plano pago)
   ========================================================== */
const AVALIACOES = ['prova', 'teste', 'trabalho', 'simulado'];

function acharMateria(nome) {
  const n = norm(nome || '').trim();
  if (!n) return null;
  const ms = st().materias;
  return (ms.find((m) => norm(m.nome) === n) || ms.find((m) => norm(m.nome).includes(n) || n.includes(norm(m.nome))))?.id || null;
}

function abrirImportar(pintar) {
  const porta = liberado('ia_arquivos');
  if (!porta.ok || !temIA()) {
    return modal('📸 Importar calendário', h('div', {},
      !porta.ok
        ? paywall('Ler o calendário por foto é dos planos pagos', 'O MindTrack AI lê a foto ou o PDF do calendário da escola e cadastra provas, feriados e férias de uma vez. Sem plano, adicione as datas à mão — leva 1 minuto.', porta.precisa)
        : h('p', { class: 'small' }, 'O MindTrack AI ainda está sendo ligado no servidor. Enquanto isso, adicione as datas à mão.')));
  }
  let anexos = [];
  const lista = h('div', { class: 'tiny muted' }, 'Nenhum arquivo escolhido.');
  const texto = txtarea({ placeholder: 'Ou cole aqui o texto do calendário (do site da escola, do WhatsApp…)', style: { minHeight: '90px' } });
  const arquivo = h('input', { type: 'file', accept: 'image/*,application/pdf', multiple: true, hidden: true });
  arquivo.addEventListener('change', async () => {
    for (const f of [...(arquivo.files || [])].slice(0, 2)) {
      try {
        if (f.type === 'application/pdf') {
          if (f.size > 1.8 * 1024 * 1024) { toast('PDF grande demais (até 1,8 MB) — mande um print da página.', 'bad'); continue; }
          const b64 = await new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = erro; r.readAsDataURL(f); });
          anexos.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } });
        } else anexos.push(dataUrlParaBloco(await comprimirImagem(f, { max: 1600, qualidade: 0.85 })));
      } catch (e) { toast(e.message, 'bad'); }
    }
    arquivo.value = '';
    anexos = anexos.slice(0, 2);
    lista.textContent = anexos.length ? `${anexos.length} arquivo(s) prontos para ler.` : 'Nenhum arquivo escolhido.';
  });
  const resultado = h('div', {});
  const ler = h('button', {
    class: 'btn btn--p btn--blk', onclick: async () => {
      if (!anexos.length && !texto.value.trim()) return toast('Escolha a foto/PDF ou cole o texto.', 'bad');
      ler.disabled = true; ler.textContent = 'Lendo o calendário…';
      try {
        const itens = await lerCalendarioEscolar({ fotos: anexos, texto: texto.value.trim() });
        mostrarPrevia(itens, resultado, pintar);
      } catch (e) { toast(e.message, 'bad'); }
      ler.disabled = false; ler.textContent = 'Ler de novo';
    },
  }, '✨ Ler com o MindTrack AI');

  modal('📸 Importar calendário da escola', h('div', {},
    h('p', { class: 'small muted', style: { marginTop: 0 } },
      'Mande a foto ou o PDF do calendário (provas, feriados, férias, bimestres). Você confere a lista antes de importar.'),
    h('div', { class: 'flexb mb' }, h('button', { class: 'btn', onclick: () => arquivo.click() }, '📷 Foto ou PDF'), lista),
    arquivo, texto, h('div', { class: 'mt' }, ler), resultado), { largo: true });
}

function mostrarPrevia(itens, alvo, pintar) {
  const s = st();
  const jaTem = (x) => (AVALIACOES.includes(x.tipo) ? s.provas : s.eventos)
    .some((y) => y.data === x.data && norm(y.titulo) === norm(x.titulo));
  const marcados = itens.map((x) => !jaTem(x));
  if (!itens.length) {
    alvo.replaceChildren(h('p', { class: 'small mt' }, 'Não encontrei datas nesse material. Tente uma foto mais nítida ou cole o texto.'));
    return;
  }
  const rotulo = (tipo) => (AVALIACOES.includes(tipo) ? rotuloAvaliacao(tipo) : TIPOS_EVENTO.find((t) => t.v === tipo)?.t || tipo);
  alvo.replaceChildren(
    h('div', { class: 'side__grupo', style: { margin: '14px 0 6px' } }, `Encontrei ${itens.length} data(s) — confira`),
    h('div', { class: 'list' }, ...itens.map((x, i) => h('label', { class: 'row row--flat', style: { cursor: 'pointer' } },
      h('input', { type: 'checkbox', checked: marcados[i], onchange: (e) => { marcados[i] = e.target.checked; } }),
      h('div', { class: 'grow' },
        h('div', { class: 'small' }, `${rotulo(x.tipo)} — ${x.titulo}`),
        h('div', { class: 'tiny muted' }, [
          x.ate ? `${fmtData(x.data, { curto: true })} a ${fmtData(x.ate, { curto: true })}` : fmtData(x.data, { curto: true }),
          x.materia || null, jaTem(x) ? 'já cadastrado' : null,
        ].filter(Boolean).join(' · ')))))),
    h('button', {
      class: 'btn btn--p btn--blk mt', onclick: () => {
        let n = 0;
        itens.forEach((x, i) => {
          if (!marcados[i]) return;
          const materiaId = acharMateria(x.materia);
          if (AVALIACOES.includes(x.tipo)) novaProva({ titulo: x.titulo, tipo: x.tipo, data: x.data, materiaId });
          else novoEvento({ tipo: x.tipo, titulo: x.titulo, data: x.data, ate: x.ate && x.ate > x.data ? x.ate : null, materiaId });
          n++;
        });
        fecharModal(); toast(`${n} data(s) importada(s) 🗓️`, 'good'); pintar();
      },
    }, 'Importar as marcadas'));
}

/* ==========================================================
   APRENDENDO — o que estou vendo em cada matéria (com fotos)
   ========================================================== */
function abaAprendendo() {
  const s = st();
  const box = h('div', {});
  if (!s.materias.length) {
    box.append(vazio('Nenhuma matéria ainda', 'Cadastre suas matérias primeiro — depois volte aqui para contar o que está aprendendo em cada uma.',
      h('a', { class: 'btn btn--p', href: '#/materias' }, '📚 Cadastrar matérias')));
    return box;
  }
  box.append(h('p', { class: 'small muted' },
    '💡 O MindTrack AI lê o que você escrever aqui para responder do jeito da SUA escola. As fotos ficam só no seu aparelho, '
    + 'organizadas por matéria — e dá para anexar qualquer uma delas numa pergunta.'));
  for (const m of s.materias) box.append(cartaoMateria(m));
  return box;
}

function cartaoMateria(m) {
  const s = st();
  const nota = s.escola[m.id] || { texto: '', em: null };

  const texto = txtarea({
    placeholder: 'O que vocês estão vendo agora? Ex.: "equação de 2º grau, fórmula de Bhaskara — a prova vai cobrar problemas com área"',
    style: { minHeight: '64px' },
  });
  texto.value = nota.texto || '';
  texto.addEventListener('change', () => {
    set((x) => { x.escola[m.id] = { texto: texto.value.trim(), em: iso() }; });
    toast('Anotado ✓', 'good');
  });

  const grade = h('div', {
    class: 'chips',
    style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: '8px' },
  });

  async function pintarFotos() {
    const fotos = await fotosDaMateria(m.id).catch(() => []);
    grade.replaceChildren(...fotos.map((f) => {
      const img = h('img', {
        src: f.dataUrl, alt: `Foto de ${m.nome}`,
        style: { width: '100%', height: '84px', objectFit: 'cover', borderRadius: '10px', cursor: 'pointer', display: 'block' },
      });
      img.onclick = () => verFoto(f, () => pintarFotos());
      return img;
    }));
    if (!fotos.length) grade.append(h('span', { class: 'tiny muted' }, 'Sem fotos ainda.'));
    return fotos.length;
  }
  pintarFotos();

  const arquivo = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
  arquivo.addEventListener('change', async () => {
    const escolhidas = [...(arquivo.files || [])];
    arquivo.value = '';
    if (!escolhidas.length) return;
    const jaTem = await fotosDaMateria(m.id).then((f) => f.length).catch(() => 0);
    if (jaTem + escolhidas.length > MAX_FOTOS_POR_MATERIA) {
      return toast(`No máximo ${MAX_FOTOS_POR_MATERIA} fotos por matéria — apague alguma antes.`, 'bad');
    }
    let salvas = 0;
    for (const f of escolhidas) {
      try {
        const dataUrl = await comprimirImagem(f);
        await guardarFoto({ materiaId: m.id, dataUrl });
        salvas++;
      } catch (e) { toast(e.message, 'bad'); }
    }
    if (salvas) { toast(`${salvas} foto(s) guardada(s) 📸`, 'good'); pintarFotos(); }
  });

  return cartao(
    h('div', { class: 'flexb' },
      h('span', { style: { fontSize: '20px' } }, m.emoji || '📘'),
      h('div', { class: 'grow' },
        h('b', {}, m.nome),
        m.professor ? h('div', { class: 'tiny muted' }, `Prof. ${m.professor}`) : null),
      h('button', { class: 'btn btn--sm', onclick: () => arquivo.click() }, '📸 Fotos')),
    h('div', { class: 'mt' },
      h('b', { class: 'small' }, '✍️ O que estou aprendendo'),
      texto),
    h('div', { class: 'mt' }, grade),
    arquivo);
}

function verFoto(f, aoMudar) {
  const img = h('img', {
    src: f.dataUrl, alt: 'Foto ampliada',
    style: { maxWidth: '100%', maxHeight: '60dvh', borderRadius: '12px', display: 'block', margin: '0 auto' },
  });
  modal('📸 Foto', h('div', {},
    img,
    h('p', { class: 'tiny muted center mt' }, `Guardada em ${f.em.slice(0, 10)} — só no seu aparelho.`),
    h('div', { class: 'flexb mt' },
      h('button', { class: 'btn sp', onclick: fecharModal }, 'Fechar'),
      h('button', {
        class: 'btn btn--d', onclick: () => confirmar('Apagar esta foto?', 'Ela some do aparelho e não tem volta.', async () => {
          await apagarFoto(f.id);
          fecharModal(); toast('Foto apagada'); aoMudar?.();
        }),
      }, '🗑️ Apagar'))), { largo: true });
}
