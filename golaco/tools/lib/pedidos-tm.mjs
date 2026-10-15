// Pedidos do Total Match montados à mão (o formato v2 do legacy-total-match/js/tm3d.js, com as vagas da prancheta do TM)
// para os testes da ponte (tools/teste-ponte-tm.mjs em Node, tools/teste-tm-tela.mjs no navegador): nada depende do TM.
// Times fictícios; atributos por um gerador xorshift com semente (o mesmo pedido sempre).

// vagas da prancheta do TM (legacy-total-match/js/competitions.js FORMATIONS) e as posições de cada vaga
export const SLOTS = {
  '4-3-3': [['GK', 50, 88], ['DF', 16, 68], ['DF', 39, 72], ['DF', 61, 72], ['DF', 84, 68], ['MF', 30, 48], ['MF', 50, 52], ['MF', 70, 48], ['FW', 20, 22], ['FW', 50, 16], ['FW', 80, 22]],
  '4-2-3-1': [['GK', 50, 88], ['DF', 16, 68], ['DF', 39, 72], ['DF', 61, 72], ['DF', 84, 68], ['MF', 38, 56], ['MF', 62, 56], ['MF', 24, 36], ['MF', 50, 32], ['MF', 76, 36], ['FW', 50, 16]],
  '3-4-3': [['GK', 50, 88], ['DF', 28, 70], ['DF', 50, 73], ['DF', 72, 70], ['MF', 12, 48], ['MF', 38, 50], ['MF', 62, 50], ['MF', 88, 48], ['FW', 22, 20], ['FW', 50, 15], ['FW', 78, 20]],
  '4-1-2-1-2': [['GK', 50, 88], ['DF', 16, 70], ['DF', 39, 72], ['DF', 61, 72], ['DF', 84, 70], ['MF', 50, 60], ['MF', 26, 47], ['MF', 74, 47], ['MF', 50, 33], ['FW', 38, 17], ['FW', 62, 17]],
};
export const POS = {
  // (no 4-2-3-1 o 4º defensor é um ZAGUEIRO posto na lateral direita da prancheta: tem de jogar na lateral direita)
  '4-3-3': ['GOL', 'LE', 'ZAG', 'ZAG', 'LD', 'MC', 'VOL', 'MC', 'PE', 'CA', 'PD'],
  '4-2-3-1': ['GOL', 'LE', 'ZAG', 'ZAG', 'ZAG', 'VOL', 'VOL', 'ME', 'MEI', 'MD', 'CA'],
  '3-4-3': ['GOL', 'ZAG', 'ZAG', 'ZAG', 'ME', 'MC', 'MC', 'MD', 'PE', 'CA', 'PD'],
  '4-1-2-1-2': ['GOL', 'LE', 'ZAG', 'ZAG', 'LD', 'VOL', 'MC', 'MC', 'MEI', 'CA', 'CA'],
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

