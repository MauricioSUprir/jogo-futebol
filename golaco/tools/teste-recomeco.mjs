// Recomeço do treino de condução ("Bola no pé" e bola que volta depois de sair):
//  - perto das linhas, a bola volta DENTRO do campo: o aviso "Bola fora" não se repete sem fim
//    (jogador parado na beira, de frente para a linha; e conduzindo até sair pela lateral em 4
//    ângulos × 3 inclinações × com/sem arrancada × 3 tempos de reação);
//  - com o jogador correndo, a bola recolocada não é atropelada (fica à frente do corpo, sem o
//    corpo ter de ir buscá-la), em 320 recomeços (trote, corrida, arrancada; 4 rumos; 20 fases).
//   node tools/teste-recomeco.mjs
import { criarTreino, passoTreino } from '../js/sessao.js';
import { BOTAO } from '../js/config.js';
import { tabelaTexto, fmt } from './lib/medidas.mjs';

const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
function reg(nome, medido, meta, ok) { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; }
const treino = opc => criarTreino({ modo: 'conducao', ...opc });

// parado na beira do campo, de frente para a linha
{
  let pior = 0;
  for (const [x, z, rumo] of [[0, 33.8, Math.PI / 2], [0, -33.8, -Math.PI / 2], [52.35, 0, 0], [-52.35, 5, Math.PI]]) {
    const m = treino({ semente: 3, x, z, rumo });
    let fora = 0;
    for (let i = 0; i < 600; i++) for (const ev of passoTreino(m, { x: 0, z: 0, botoes: 0 })) if (ev.tipo === 'fora' || ev.tipo === 'gol') fora++;
    pior = Math.max(pior, fora);
  }
  reg('parado na beira, de frente para a linha: avisos de bola fora em 10 s', `${pior} (pior de 4)`, '≤ 1', pior <= 1);
}
// conduzindo até sair pela lateral e soltando o analógico
{
  let pior = 0, casos = 0, presos = 0;
  for (const ang of [90, 75, 60, 45]) for (const mag of [0.5, 0.8, 1]) for (const corre of [0, 1]) for (const reacao of [0, 0.25, 0.5]) {
    const a = (ang * Math.PI) / 180;
    const m = treino({ semente: 7, x: 0, z: 22, rumo: a });
    let tFora = null, fora = 0;
    for (let i = 0; i < 60 * 14; i++) {
      let e = { x: Math.cos(a) * mag, z: Math.sin(a) * mag, botoes: corre ? BOTAO.CORRER : 0 };
      if (tFora !== null && (i - tFora) / 60 >= reacao) e = { x: 0, z: 0, botoes: 0 };
      for (const ev of passoTreino(m, e)) if (ev.tipo === 'fora') { fora++; if (tFora === null) tFora = i; }
    }
    casos++; pior = Math.max(pior, fora); if (fora >= 3) presos++;
  }
  reg('conduz para fora e solta: avisos de bola fora em 14 s', `${pior} (pior de ${casos}) · ${presos} em laço`, '≤ 2 · 0', pior <= 2 && presos === 0);
}
// "Bola no pé" com o jogador correndo
{
  let tot = 0, ruins = 0, pior = 9, buscas = 0, perdas = 0;
  for (const [mag, bot] of [[0.6, 0], [1, 0], [1, BOTAO.CORRER], [0.35, 0]]) {
    for (const ang of [0, 0.7, -1.2, 2.5]) {
      for (let pre = 100; pre < 160; pre += 3) {
        const m = treino({ semente: 7, x: -10, z: 0, rumo: ang });
        const j = m.jogadores[0];
        const e = { x: Math.cos(ang) * mag, z: Math.sin(ang) * mag, botoes: bot };
        for (let i = 0; i < pre; i++) passoTreino(m, e);
        passoTreino(m, e, ['recomecar']);
        let minFr = 9, busca = 0, ant = false;
        for (let i = 0; i < 90; i++) {
          const ev = passoTreino(m, e);
          if (ev.some(x => x.tipo === 'perda')) perdas++;
          const fr = (m.bola.p.x - j.x) * Math.cos(j.rumo) + (m.bola.p.z - j.z) * Math.sin(j.rumo);
          minFr = Math.min(minFr, fr);
          if (j.cond.busca && !ant) busca++;
          ant = j.cond.busca;
        }
        tot++; pior = Math.min(pior, minFr); buscas += busca;
        if (minFr < 0.1 || busca) ruins++;
      }
    }
  }
  reg(`"Bola no pé" correndo: bola atropelada ou corpo indo buscá-la (${tot} recomeços)`, `${ruins} · pior frente ${fmt(pior)} m · ${buscas} busca(s) · ${perdas} perda(s)`, '0 · ≥ 0,10 m', ruins === 0 && perdas === 0);
}
console.log(tabelaTexto(linhas));
console.log(falhas ? `\nteste-recomeco: REPROVOU (${falhas})` : '\nteste-recomeco: PASSOU');
process.exit(falhas ? 1 : 0);
