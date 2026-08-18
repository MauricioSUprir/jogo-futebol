/* ===== seed.js — dados de exemplo do primeiro acesso (tudo editável/apagável) ===== */
import { uid, iso, today, addDays } from './util.js';

const D = (n) => iso(addDays(today(), n));

export function seedInicial(s) {
  s.perfil = { ...s.perfil, nome: 'Gui', serie: '8º ano', avatar: '🎓' };

  const mk = (nome, emoji, cor, professor, meta) =>
    ({ id: uid('mat'), nome, emoji, cor, professor, meta, arquivada: false, criadaEm: iso() });

  const M = {
    port: mk('Português', '📖', '#f472b6', 'Renata', 9),
    mat: mk('Matemática', '📐', '#60a5fa', 'Carlos', 9),
    hist: mk('História', '🏛️', '#fbbf24', 'Nathalia', 9),
    geo: mk('Geografia', '🌎', '#34d399', 'Paulo', 8.5),
    ing: mk('Inglês', '🌐', '#a78bfa', 'Sophia', 9),
    cie: mk('Ciências', '🔬', '#22d3ee', 'Marcos', 9),
  };
  s.materias = Object.values(M);

  /* ---------- conteúdos (árvore: pai -> filhos) ---------- */
  const cs = [];
  const cnt = (mat, nome, status, dominio, paiId = null) => {
    const c = {
      id: uid('cnt'), materiaId: mat.id, paiId, nome, status, dominio,
      srs: { passo: dominio > 70 ? 3 : dominio > 40 ? 1 : 0, facilidade: 2.5,
        proxima: dominio >= 80 ? D(7) : dominio >= 60 ? D(2) : D(0),
        repeticoes: dominio > 60 ? 3 : 1, falhas: dominio < 50 ? 2 : 0, ultima: D(-3) },
      criadoEm: iso(),
    };
    cs.push(c); return c;
  };

  // História — o exemplo do projeto
  cnt(M.hist, 'Iluminismo', 'dominado', 92);
  cnt(M.hist, 'Revolução Industrial', 'dominado', 84);
  cnt(M.hist, 'Revolução Francesa', 'revisar', 68);
  cnt(M.hist, 'Era Napoleônica', 'dificuldade', 41);
  cnt(M.hist, 'Congresso de Viena', 'novo', 0);

  // Matemática — árvore com sub-conteúdos
  const geo = cnt(M.mat, 'Geometria', 'estudando', 62);
  const tri = cnt(M.mat, 'Triângulos', 'estudando', 66, geo.id);
  cnt(M.mat, 'Congruência (LLL)', 'dominado', 88, tri.id);
  cnt(M.mat, 'Congruência (LAL)', 'dominado', 81, tri.id);
  cnt(M.mat, 'Congruência (ALA)', 'revisar', 63, tri.id);
  cnt(M.mat, 'Quadriláteros', 'novo', 12, geo.id);
  const alg = cnt(M.mat, 'Álgebra', 'estudando', 58);
  cnt(M.mat, 'Equações do 1º grau', 'dominado', 86, alg.id);
  cnt(M.mat, 'Sistemas de equações', 'dificuldade', 38, alg.id);
  cnt(M.mat, 'Produtos notáveis', 'revisar', 55, alg.id);

  cnt(M.port, 'Orações subordinadas', 'revisar', 59);
  cnt(M.port, 'Crase', 'dificuldade', 44);
  cnt(M.port, 'Figuras de linguagem', 'dominado', 83);
  cnt(M.port, 'Redação dissertativa', 'estudando', 61);

  cnt(M.geo, 'Climas do Brasil', 'dominado', 80);
  cnt(M.geo, 'Urbanização', 'estudando', 57);
  cnt(M.geo, 'África: colonização', 'novo', 8);

  cnt(M.ing, 'Present Perfect', 'revisar', 64);
  cnt(M.ing, 'Phrasal verbs', 'dificuldade', 47);

  cnt(M.cie, 'Sistema digestório', 'dominado', 85);
  cnt(M.cie, 'Sistema respiratório', 'revisar', 66);
  cnt(M.cie, 'Corrente elétrica', 'novo', 15);
  s.conteudos = cs;

  const cid = (nome) => cs.find((c) => c.nome === nome)?.id || null;

  /* ---------- tarefas ---------- */
  const tar = (materiaId, titulo, prazo, imp, dif, min, valor, status = 'aberto', extra = {}) => ({
    id: uid('tar'), materiaId, titulo, descricao: '', prazo, importancia: imp, dificuldade: dif,
    minutos: min, valor, status, subtarefas: [], conteudoIds: [], criadaEm: iso(),
    concluidaEm: status === 'concluido' ? D(-1) : null, minutosFeitos: 0, ...extra,
  });
  s.tarefas = [
    tar(M.port.id, 'Atividade de crase (página 84)', D(1), 4, 3, 30, 1),
    tar(M.hist.id, 'Resumo da Revolução Francesa', D(1), 5, 4, 120, 2, 'andamento',
      { conteudoIds: [cid('Revolução Francesa')].filter(Boolean) }),
    tar(M.mat.id, 'Lista de exercícios — sistemas', D(2), 4, 4, 40, 1.5),
    tar(M.ing.id, 'Worksheet — present perfect', D(3), 2, 2, 20, 0.5),
    tar(M.geo.id, 'Trabalho sobre urbanização', D(6), 5, 4, 180, 3),
    tar(M.cie.id, 'Relatório do experimento', D(-1), 3, 2, 45, 1),
    tar(M.mat.id, 'Exercícios de produtos notáveis', D(-3), 3, 3, 35, 0, 'concluido'),
    tar(M.port.id, 'Leitura do capítulo 4', D(-4), 2, 1, 25, 0, 'concluido'),
  ];

  /* ---------- provas ---------- */
  s.provas = [
    {
      id: uid('prv'), materiaId: M.hist.id, titulo: 'Prova de História — 3º bimestre',
      data: D(4), valor: 10,
      conteudoIds: ['Iluminismo', 'Revolução Francesa', 'Era Napoleônica'].map(cid).filter(Boolean),
      plano: [], criadaEm: iso(), nota: null,
    },
    {
      id: uid('prv'), materiaId: M.mat.id, titulo: 'Prova de Matemática', data: D(11), valor: 10,
      conteudoIds: ['Sistemas de equações', 'Produtos notáveis', 'Quadriláteros'].map(cid).filter(Boolean),
      plano: [], criadaEm: iso(), nota: null,
    },
  ];

  /* ---------- horário escolar ---------- */
  const aula = (h, m) => ({ hora: h, materiaId: m.id });
  s.horario = {
    1: [aula('07:00', M.port), aula('07:50', M.port), aula('08:40', M.hist), aula('09:50', M.mat), aula('10:40', M.cie)],
    2: [aula('07:00', M.mat), aula('07:50', M.geo), aula('08:40', M.ing), aula('09:50', M.port), aula('10:40', M.cie)],
    3: [aula('07:00', M.hist), aula('07:50', M.hist), aula('08:40', M.mat), aula('09:50', M.geo), aula('10:40', M.port)],
    4: [aula('07:00', M.cie), aula('07:50', M.mat), aula('08:40', M.port), aula('09:50', M.ing), aula('10:40', M.hist)],
    5: [aula('07:00', M.geo), aula('07:50', M.cie), aula('08:40', M.mat), aula('09:50', M.hist), aula('10:40', M.ing)],
  };

  /* ---------- flashcards ---------- */
  const fc = (mat, conteudoNome, frente, verso) => ({
    id: uid('fc'), materiaId: mat.id, conteudoId: cid(conteudoNome), frente, verso, favorito: false,
    srs: { passo: 1, facilidade: 2.5, proxima: D(Math.floor(Math.random() * 3) - 1), repeticoes: 1, falhas: 0, ultima: D(-2) },
    criadoEm: iso(),
  });
  s.flashcards = [
    fc(M.hist, 'Era Napoleônica', 'O que foi o Bloqueio Continental?', 'Proibição imposta por Napoleão (1806) ao comércio europeu com a Inglaterra, para enfraquecer economicamente os ingleses.'),
    fc(M.hist, 'Revolução Francesa', 'O que foram os Estados Gerais?', 'Assembleia dos três estados (clero, nobreza e Terceiro Estado) convocada em 1789 por Luís XVI para resolver a crise financeira.'),
    fc(M.hist, 'Iluminismo', 'Qual a ideia central do Iluminismo?', 'O uso da razão como caminho para o conhecimento, a liberdade e a crítica ao absolutismo e aos privilégios de nascimento.'),
    fc(M.port, 'Crase', 'Quando NÃO se usa crase?', 'Antes de palavras masculinas, de verbos, de pronomes pessoais e, em geral, antes de palavras no plural precedidas de "a" (sem artigo).'),
    fc(M.mat, 'Sistemas de equações', 'O que é o método da substituição?', 'Isolar uma incógnita em uma equação e substituir seu valor na outra, reduzindo o sistema a uma equação com uma só incógnita.'),
    fc(M.ing, 'Present Perfect', 'Quando usar o Present Perfect?', 'Para ações que começaram no passado e continuam ou têm efeito no presente. Estrutura: have/has + particípio.'),
    fc(M.cie, 'Sistema respiratório', 'Onde ocorrem as trocas gasosas?', 'Nos alvéolos pulmonares, por difusão entre o ar alveolar e os capilares sanguíneos.'),
  ];

  /* ---------- questões ---------- */
  const q = (mat, conteudoNome, tipo, dificuldade, enunciado, alternativas, correta, explicacao) => ({
    id: uid('q'), materiaId: mat.id, conteudoId: cid(conteudoNome), tipo, dificuldade,
    enunciado, alternativas, correta, resposta: '', explicacao, origem: 'exemplo', favorita: false, criadaEm: iso(),
  });
  s.questoes = [
    q(M.hist, 'Revolução Francesa', 'objetiva', 'medio',
      'Qual grupo social sustentava a maior parte da carga tributária na França às vésperas de 1789?',
      ['O clero', 'A nobreza', 'O Terceiro Estado', 'A família real'], 2,
      'O Terceiro Estado (burguesia, camponeses e trabalhadores urbanos) pagava os impostos, enquanto clero e nobreza tinham privilégios fiscais.'),
    q(M.hist, 'Era Napoleônica', 'objetiva', 'medio',
      'O Bloqueio Continental tinha como alvo principal:',
      ['A Rússia', 'A Inglaterra', 'A Espanha', 'Portugal'], 1,
      'O bloqueio buscava sufocar economicamente a Inglaterra, principal rival de Napoleão.'),
    q(M.hist, 'Iluminismo', 'vf', 'facil',
      'O Iluminismo defendia que a autoridade dos reis vinha diretamente de Deus.',
      ['Verdadeiro', 'Falso'], 1,
      'Falso: essa é a tese do direito divino, justamente criticada pelos iluministas.'),
    q(M.mat, 'Sistemas de equações', 'objetiva', 'medio',
      'No sistema x + y = 10 e x − y = 2, o valor de x é:',
      ['4', '5', '6', '8'], 2,
      'Somando as duas equações: 2x = 12, logo x = 6 (e y = 4).'),
    q(M.port, 'Crase', 'objetiva', 'dificil',
      'Assinale a alternativa em que a crase está corretamente empregada:',
      ['Vou à pé até a escola.', 'Refiro-me à ela.', 'Entreguei o trabalho à professora.', 'Começou à chover.'], 2,
      '"Entregar algo a alguém" + artigo "a" antes de "professora" = à. Nos outros casos não há artigo.'),
    q(M.cie, 'Sistema respiratório', 'objetiva', 'facil',
      'A troca gasosa nos pulmões ocorre nos:',
      ['Brônquios', 'Alvéolos', 'Traqueia', 'Diafragma'], 1,
      'Os alvéolos têm paredes finas e grande superfície, ideais para a difusão de gases.'),
  ];

  /* ---------- histórico (tentativas + sessões dos últimos 21 dias) ---------- */
  const tent = [], ses = [];
  for (let d = 21; d >= 0; d--) {
    if (d % 7 === 0 && d !== 0) continue;             // um dia de folga por semana
    const data = new Date(addDays(today(), -d)); data.setHours(19, 0, 0, 0);
    const nQ = 3 + Math.floor(Math.random() * 8);
    for (let i = 0; i < nQ; i++) {
      const qq = s.questoes[Math.floor(Math.random() * s.questoes.length)];
      // a chance de acerto acompanha o domínio que o conteúdo deveria ter,
      // para o histórico de exemplo bater com o mapa do conhecimento
      const domAlvo = (cs.find((c) => c.id === qq.conteudoId)?.dominio ?? 60) / 100;
      const chance = Math.min(0.97, 0.45 + domAlvo * 0.5 + (21 - d) * 0.006);
      tent.push({
        id: uid('tt'), questaoId: qq.id, conteudoId: qq.conteudoId, materiaId: qq.materiaId,
        acertou: Math.random() < chance, resposta: '', modo: 'treino',
        em: new Date(data.getTime() + i * 60000).toISOString(),
      });
    }
    ses.push({
      id: uid('ses'), tipo: 'foco', minutos: [25, 25, 40, 50][Math.floor(Math.random() * 4)],
      materiaId: s.materias[Math.floor(Math.random() * s.materias.length)].id,
      tarefaId: null, conteudoId: null, em: data.toISOString(),
    });
  }
  s.tentativas = tent; s.sessoes = ses;

  /* ---------- notas ---------- */
  const nt = (mat, titulo, valor, bim) => ({ id: uid('nt'), materiaId: mat.id, titulo, valor, maximo: 10, peso: 1, bimestre: bim, data: D(-20) });
  s.notas = [
    nt(M.port, 'Prova 1', 8.2, 3), nt(M.port, 'Trabalho', 8.0, 3),
    nt(M.mat, 'Prova 1', 7.5, 3), nt(M.mat, 'Lista', 7.0, 3),
    nt(M.hist, 'Prova 1', 9.0, 3), nt(M.hist, 'Seminário', 9.5, 3),
    nt(M.geo, 'Prova 1', 8.7, 3),
    nt(M.ing, 'Prova 1', 9.2, 3),
    nt(M.cie, 'Prova 1', 8.4, 3),
  ];

  /* ---------- metas ---------- */
  s.metas = [
    { id: uid('meta'), tipo: 'academica', titulo: 'Média 9 em História', alvo: 9, atual: 0, materiaId: M.hist.id, prazo: D(45), criadaEm: iso(), concluida: false },
    { id: uid('meta'), tipo: 'semanal', titulo: 'Estudar 5 dias por semana', alvo: 5, atual: 0, materiaId: null, prazo: null, criadaEm: iso(), concluida: false },
    { id: uid('meta'), tipo: 'tempo', titulo: '6 horas de estudo na semana', alvo: 360, atual: 0, materiaId: null, prazo: null, criadaEm: iso(), concluida: false },
  ];

  /* ---------- biblioteca ---------- */
  s.biblioteca = [
    { id: uid('bib'), materiaId: M.hist.id, tipo: 'resumo', titulo: 'Resumo — Revolução Francesa (aula)', conteudo: 'Causas: crise financeira, desigualdade entre os três estados, influência iluminista...', url: '', favorito: true, criadoEm: iso() },
    { id: uid('bib'), materiaId: M.mat.id, tipo: 'lista', titulo: 'Lista de exercícios — sistemas', conteudo: '', url: '', favorito: false, criadoEm: iso() },
  ];

  s.jogo = { ...s.jogo, xp: 640, moedas: 120, streak: 4, ultimoDia: iso(addDays(today(), -1)), recordeStreak: 9, conquistas: ['primeiros_passos'], itens: [] };
  return s;
}
