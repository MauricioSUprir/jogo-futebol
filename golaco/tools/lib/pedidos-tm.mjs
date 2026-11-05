// Pedidos do Total Match montados à mão (o formato v2 do legacy-total-match/js/tm3d.js, com as vagas da prancheta do TM)
// para os testes da ponte (tools/teste-ponte-tm.mjs em Node, tools/teste-tm-tela.mjs no navegador): nada depende do TM.
// Times fictícios; atributos por um gerador xorshift com semente (o mesmo pedido sempre).

// vagas da prancheta do TM (legacy-total-match/js/competitions.js FORMATIONS) e as posições de cada vaga
export const SLOTS = {
  '4-3-3': [['GK', 50, 88], ['DF', 16, 68], ['DF', 39, 72], ['DF', 61, 72], ['DF', 84, 68], ['MF', 30, 48], ['MF', 50, 52], ['MF', 70, 48], ['FW', 20, 22], ['FW', 50, 16], ['FW', 80, 22]],
  '4-2-3-1': [['GK', 50, 88], ['DF', 16, 68], ['DF', 39, 72], ['DF', 61, 72], ['DF', 84, 68], ['MF', 38, 56], ['MF', 62, 56], ['MF', 24, 36], ['MF', 50, 32], ['MF', 76, 36], ['FW', 50, 16]],
  '3-4-3': [['GK', 50, 88], ['DF', 28, 70], ['DF', 50, 73], ['DF', 72, 70], ['MF', 12, 48], ['MF', 38, 50], ['MF', 62, 50], ['MF', 88, 48], ['FW', 22, 20], ['FW', 50, 15], ['FW', 78, 20]],
  '4-1-2-1-2': [['GK', 50, 88], ['DF', 16, 70], ['DF', 39, 72], ['DF', 61, 72], ['DF', 84, 70], ['MF', 50, 60], ['MF', 26, 47], ['MF', 74, 47], ['MF', 50, 33], ['FW', 38, 17], ['FW', 62, 17]],
  '5-3-2': [['GK', 50, 88], ['DF', 10, 64], ['DF', 30, 72], ['DF', 50, 74], ['DF', 70, 72], ['DF', 90, 64], ['MF', 30, 48], ['MF', 50, 52], ['MF', 70, 48], ['FW', 38, 17], ['FW', 62, 17]],
};
export const POS = {
  // (no 4-2-3-1 o 4º defensor é um ZAGUEIRO posto na lateral direita da prancheta: tem de jogar na lateral direita)
  '4-3-3': ['GOL', 'LE', 'ZAG', 'ZAG', 'LD', 'MC', 'VOL', 'MC', 'PE', 'CA', 'PD'],
  '4-2-3-1': ['GOL', 'LE', 'ZAG', 'ZAG', 'ZAG', 'VOL', 'VOL', 'ME', 'MEI', 'MD', 'CA'],
  '3-4-3': ['GOL', 'ZAG', 'ZAG', 'ZAG', 'ME', 'MC', 'MC', 'MD', 'PE', 'CA', 'PD'],
  '4-1-2-1-2': ['GOL', 'LE', 'ZAG', 'ZAG', 'LD', 'VOL', 'MC', 'MC', 'MEI', 'CA', 'CA'],
  '5-3-2': ['GOL', 'ADE', 'ZAG', 'ZAG', 'ZAG', 'ADD', 'MC', 'VOL', 'MC', 'CA', 'CA'],
};
const RESERVAS = ['GOL', 'ZAG', 'LD', 'VOL', 'MEI', 'PD', 'CA'];
export function timeTM(nome, sigla, formacao, ov, sem) {
  let s = sem >>> 0 || 1;
  const r = (a, b) => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return a + (s % (b - a + 1)); };
  const players = [...POS[formacao], ...RESERVAS].map((pos, i) => {
    const o = ov + r(-3, 3) - (i >= 11 ? 4 : 0), gol = pos === 'GOL';
    const p = {
      tmId: `${sigla.toLowerCase()}${i + 1}`, name: `${String.fromCharCode(65 + (i % 26))}. ${sigla}${i + 1}`, nomeCompleto: `Jogador ${sigla} ${i + 1}`,
      num: i + 1, pos, overall: o, foot: pos === 'LE' || pos === 'PE' || pos === 'ME' ? 'E' : 'D',
      attrs: { pac: o + r(-8, 8), sho: o + r(-10, 6), pas: o + r(-6, 6), dri: o + r(-6, 8), def: o + r(-20, 6), phy: o + r(-6, 6), gk: gol ? o : r(8, 21) },
      look: { skin: '#c99169', hair: 'short', hairColor: '#15110e', height: 1.7 + r(0, 25) / 100, build: 0.5, beard: false },
    };
    if (i < 11) p.slot = SLOTS[formacao][i];
    return p;
  });
  return {
    id: `tm_${sigla.toLowerCase()}`, name: nome, short: sigla, stadium: `Arena ${nome}`, formation: formacao, formacaoTM: formacao, rating: ov,
    colors: { primary: '#1e6fd9', secondary: '#ffffff' }, kits: {}, kitEscolhido: null, players,
    identidade: { escudo: null, escudoTipo: null, bandeira: null, pais: '', liga: '', tecnico: '', estadio: null },
  };
}
export const AZUL = timeTM('Azul Atlético', 'AZU', '4-3-3', 80, 11);
export const VERDE = timeTM('Verde Esporte', 'VER', '4-2-3-1', 76, 23);
export const ROXO = timeTM('Roxo United', 'ROX', '3-4-3', 78, 37);
export const LARANJA = timeTM('Laranja FC', 'LAR', '4-1-2-1-2', 74, 41);
const partida = { neutro: false, publico: 0.75, classico: false, nomeClassico: null, competicao: 'Teste' };
export const PED_A = { v: 2, id: 'tA', titulo: 'A', origem: 'teste', userSide: 'home', controle: null, partida, home: AZUL, away: VERDE };
// B: o usuário é o visitante e controla SÓ o centroavante reserva (índice 17, no banco do pedido)
export const PED_B = { v: 2, id: 'tB', titulo: 'B', origem: 'teste', userSide: 'away', controle: { tmId: VERDE.players[17].tmId }, partida, home: AZUL, away: VERDE };
// C: o usuário é o mandante e controla só um meia titular
export const PED_C = { v: 2, id: 'tC', titulo: 'C', origem: 'teste', userSide: 'home', controle: { tmId: ROXO.players[5].tmId }, partida, home: ROXO, away: LARANJA };

// Nomes LONGOS (item 29: a escalação do pré-jogo em pé, teste-prejogo item 15 e teste-escalacao-campo N5), edição pública: os nomes
// de time mais compridos e camisas de 10 letras (o teto do tm-times.js camisaDe) com letras largas (M, W); o visitante leva 3
// nomes de ESTRESSE (MMMMMMMMMM e afins), que saem com "…" no celular. O nome curto do TM é "A. <camisa>".
export const CAM_LONGAS = ['Wanderleyy', 'Bittencour', 'Mascherano', 'Wellington', 'Guimarães', 'Maximilian', 'Washington', 'Wallyssonn', 'Montenegro', 'Magalhães', 'Wendellson'];
export const CAM_ESTRESSE = ['MMMMMMMMMM', 'Wwwwwwwwww', 'Mmmmmmmmmm'];
function timeNomesLongos(nome, sigla, formacao, sem, camisas) {
  const t = timeTM(nome, sigla, formacao, 78, sem);
  t.stadium = `Arena ${sigla}`;
  t.players.forEach((p, i) => { const c = camisas[i % camisas.length]; p.name = `A. ${c}`; p.nomeCompleto = `Jogador ${c}`; });
  // o centroavante com número de 2 dígitos (99)
  t.players[9].num = 99;
  return t;
}
export const PED_NOMES_LONGOS = {
  v: 2, id: 'f29', titulo: 'f29', origem: 'teste', userSide: 'home', controle: null,
  partida: { neutro: false, publico: 0.8, classico: false, nomeClassico: null, competicao: 'Teste' },
  home: timeNomesLongos('Sociedade Esportiva Recreativa Bandeirantes do Norte', 'SEB', '4-3-3', 11, CAM_LONGAS),
  away: timeNomesLongos('Associação Atlética Internacional de Wenceslau Braz', 'AAW', '5-3-2', 23, [...CAM_ESTRESSE, 'Wanderleyy', 'Mascherano', 'Maximilian', 'Washington', 'Montenegro', 'Wellington', 'Bittencour', 'Wendellson']),
};
// MISTO (revisão do item 29, A1/V2): o mandante com o nome de time curto e camisas curtas, o visitante com o nome e as camisas
// longas — as colunas dos dois times com larguras diferentes (a caixa do campo tem de ser a mesma nas duas folhas) e as cartas de
// cada folha pelos nomes dela (as pontas do time de nomes curtos dentro do campo)
export const CAM_CURTAS = ['Rocha', 'Ramos', 'Gusmão', 'Prado', 'Siqueira', 'Henrique', 'Lima', 'Patrick', 'Souza', 'Valença', 'Borges'];
export const PED_NOMES_MISTOS = {
  ...PED_NOMES_LONGOS, id: 'f29m', titulo: 'f29m',
  home: timeNomesLongos('Rio Azul', 'RAZ', '4-3-3', 31, CAM_CURTAS),
  away: timeNomesLongos('Sociedade Esportiva Recreativa Bandeirantes do Norte', 'SEB', '4-2-3-1', 43, CAM_LONGAS),
};

// FOTOS (item 31; o tm3d.js põe `foto` em cada jogador do pedido só na edição pro): comFotos(ped, origem, opc) devolve uma CÓPIA
// do pedido com `foto` nos jogadores — o endereço `${origem}/__fotos/<lado>/<tmId>.jpg` (o lado no caminho: o mesmo tmId nos dois
// lados ganha fotos diferentes; os testes de navegador servem a rota com JPGs de verdade de legacy-total-match/assets/jogadores) —
// e, com opc.recusadas, as RECUSADAS de propósito nos jogadores do mandante de índice 10 em diante e as data: pequenas nos do
// visitante de índice 11 e 12. opc.sem = os tmId (ou 'home:i'/'away:i') sem foto; opc.edicao (padrão 'pro'; null = sem o campo).
// Um JPEG de 8 × 8 de verdade (632 bytes):
export const FOTO_DATA = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAAIAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDAooorhPDP/9k=';
// as recusadas: HTML, SVG (script dentro), data: acima de 48 000 caracteres, outra origem, relativo, javascript:, número, objeto
export const FOTOS_RECUSADAS = ['data:text/html;base64,PGI+eDwvYj4=', 'data:image/svg+xml;base64,PHN2Zy8+', `data:image/jpeg;base64,${'A'.repeat(48001)}`,
  'https://outro.exemplo/x.jpg', 'assets/jogadores/x.jpg', 'javascript:alert(1)', 42, { src: 'x.jpg' }];
export const urlFoto = (origem, lado, tmId) => `${origem}/__fotos/${lado}/${tmId}.jpg`;
export function comFotos(ped, origem, opc = {}) {
  const c = structuredClone(ped);
  const sem = new Set(opc.sem ?? []);
  for (const lado of ['home', 'away']) {
    c[lado].players.forEach((p, i) => {
      if (sem.has(p.tmId) || sem.has(`${lado}:${i}`)) return;
      p.foto = urlFoto(origem, lado, p.tmId);
      if (opc.recusadas && lado === 'home' && i >= 10 && i - 10 < FOTOS_RECUSADAS.length) p.foto = FOTOS_RECUSADAS[i - 10];
      if (opc.recusadas && lado === 'away' && (i === 11 || i === 12)) p.foto = FOTO_DATA;
    });
  }
  const ed = opc.edicao === undefined ? 'pro' : opc.edicao;
  if (ed == null) delete c.edicao; else c.edicao = ed;
  return c;
}
