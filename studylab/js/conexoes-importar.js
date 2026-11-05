/* ===== conexoes-importar.js — o que vem dos apps ligados vira dado do MindTrack =====
   Cada item traz um idExterno (ex.: "gagenda:abc"). Sincronizar de novo ATUALIZA
   o que já existe (nada duplica) e tira do app o que sumiu lá na origem — só o
   que ainda não aconteceu; o passado fica como histórico.                     */
import { st, set } from './store.js';
import { uid, iso, addDays, today, norm } from './util.js';

const AVALIACOES = ['prova', 'teste', 'trabalho', 'simulado'];

export function acharMateria(nome) {
  const n = norm(nome || '').trim();
  if (!n) return null;
  const ms = st().materias;
  return (ms.find((m) => norm(m.nome) === n)
    || ms.find((m) => n.includes(norm(m.nome)) || norm(m.nome).includes(n)))?.id || null;
}

/** Eventos da Agenda / calendário por link → provas (avaliações) e eventos. */
export function importarEventos(itens, origem) {
  const hoje = iso();
  const conta = { novos: 0, atualizados: 0, removidos: 0, provas: 0 };
  const vistos = new Set();
  set((s) => {
    for (const x of itens || []) {
      if (!x?.idExterno || !x.data) continue;
      vistos.add(x.idExterno);
      const ehProva = AVALIACOES.includes(x.tipo);
      const lista = ehProva ? s.provas : s.eventos;
      const outra = ehProva ? s.eventos : s.provas;
      // se o título mudou de "evento" para "prova" (ou o contrário), troca de lista
      const iOutra = outra.findIndex((y) => y.idExterno === x.idExterno);
      if (iOutra >= 0) outra.splice(iOutra, 1);
      const existente = lista.find((y) => y.idExterno === x.idExterno);
      const materiaId = acharMateria(x.materia) || acharMateria(x.titulo);
      if (existente) {
        Object.assign(existente, { titulo: x.titulo, data: x.data },
          ehProva ? { tipo: x.tipo } : { tipo: tipoEvento(x.tipo), ate: x.ate || null, hora: x.hora || '' });
        conta.atualizados++;
      } else if (ehProva) {
        s.provas.push({
          id: uid('prv'), materiaId, titulo: x.titulo, tipo: x.tipo, data: x.data, valor: 10, conteudoIds: [], plano: [],
          criadaEm: iso(), nota: null, origem, idExterno: x.idExterno,
        });
        conta.novos++; conta.provas++;
      } else {
        s.eventos.push({
          id: uid('evt'), tipo: tipoEvento(x.tipo), titulo: x.titulo, data: x.data, ate: x.ate || null, hora: x.hora || '',
          materiaId, refId: null, origem, idExterno: x.idExterno,
        });
        conta.novos++;
      }
    }
    for (const col of ['provas', 'eventos']) {
      const antes = s[col].length;
      s[col] = s[col].filter((y) => y.origem !== origem || vistos.has(y.idExterno) || (y.ate || y.data) < hoje);
      conta.removidos += antes - s[col].length;
    }
  });
  return conta;
}

const tipoEvento = (t) => (t === 'evento' || !t ? 'atividade' : t);

/** Atividades do Classroom → tarefas (já entregue = concluída). */
export function importarAtividades(atividades, origem = 'classroom') {
  const conta = { novos: 0, atualizados: 0, concluidas: 0 };
  set((s) => {
    for (const a of atividades || []) {
      if (!a?.idExterno) continue;
      const t = s.tarefas.find((y) => y.idExterno === a.idExterno);
      const descricao = [a.descricao, a.link ? `Abrir no Classroom: ${a.link}` : ''].filter(Boolean).join('\n\n');
      if (t) {
        t.titulo = a.titulo;
        if (a.entrega) t.prazo = a.entrega;
        if (a.feita && t.status !== 'concluido') { t.status = 'concluido'; t.concluidaEm = iso(); conta.concluidas++; }
        conta.atualizados++;
        continue;
      }
      if (a.feita) continue;                       // já entregue e nunca esteve aqui: não precisa entrar
      s.tarefas.push({
        id: uid('tar'), materiaId: acharMateria(a.materia) || acharMateria(a.titulo), titulo: a.titulo, descricao,
        prazo: a.entrega || iso(addDays(today(), 7)), importancia: AVALIACOES.includes(a.tipo) ? 4 : 3, dificuldade: 3,
        minutos: 45, valor: 0, status: 'aberto', subtarefas: [], conteudoIds: [], criadaEm: iso(), concluidaEm: null,
        minutosFeitos: 0, origem, idExterno: a.idExterno, link: a.link || '',
      });
      conta.novos++;
    }
  });
  return conta;
}

/** Arquivos escolhidos no Drive → Materiais (como link; o arquivo continua no Drive). */
export function importarDoDrive(docs) {
  let n = 0;
  set((s) => {
    for (const d of docs || []) {
      const idExterno = `gdrive:${d.id}`;
      if (s.biblioteca.some((m) => m.idExterno === idExterno)) continue;
      s.biblioteca.push({
        id: uid('bib'), materiaId: acharMateria(d.name), tipo: 'link', titulo: d.name || 'Arquivo do Drive',
        conteudo: '', url: d.url, favorito: false, criadoEm: iso(), origem: 'drive', idExterno,
      });
      n++;
    }
  });
  return n;
}
