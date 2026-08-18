/* ===== views/escola.js — Minha Escola =====
   O aluno conta, com as palavras dele, o que está aprendendo em cada matéria —
   e junta fotos do caderno, do quadro e da apostila. Tudo fica no aparelho.
   O Study AI lê esses textos para responder melhor (as fotos só vão para a IA
   quando o aluno anexa numa pergunta).                                        */
import { h, iso } from '../util.js';
import { st, set } from '../store.js';
import { titulo, cartao, vazio, toast, confirmar, txtarea, modal, fecharModal } from '../ui.js';
import { comprimirImagem, guardarFoto, fotosDaMateria, apagarFoto } from '../fotos.js';

const MAX_FOTOS_POR_MATERIA = 40;

export function render(el) {
  const pintar = () => { el.replaceChildren(); montar(el, pintar); };
  montar(el, pintar);
}

function montar(el, pintar) {
  const s = st();
  el.append(titulo('🏫 Minha Escola', 'Escreva o que você está aprendendo em cada matéria e junte fotos do caderno.',
    h('a', { class: 'btn', href: '#/materias' }, '📚 Editar matérias')));

  if (!s.materias.length) {
    el.append(vazio('Nenhuma matéria ainda', 'Cadastre suas matérias primeiro — depois volte aqui para contar o que está aprendendo em cada uma.',
      h('a', { class: 'btn btn--p', href: '#/materias' }, '📚 Cadastrar matérias')));
    return;
  }

  el.append(h('p', { class: 'small muted' },
    '💡 O Study AI lê o que você escrever aqui para responder do jeito da SUA escola. As fotos ficam só no seu aparelho, '
    + 'organizadas por matéria — e dá para anexar qualquer uma delas numa pergunta.'));

  for (const m of s.materias) el.append(cartaoMateria(m));
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
