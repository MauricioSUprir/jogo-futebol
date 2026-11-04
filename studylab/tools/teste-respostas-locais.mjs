/* O chat responde na hora (sem IA) só as perguntas certas: node tools/teste-respostas-locais.mjs */
import { intencaoLocal } from '../js/respostas-locais.js';

let ok = 0, falhas = 0;
const conferir = (c, t, x = '') => { if (c) { ok++; console.log(`  ✓ ${t}`); } else { falhas++; console.log(`  ✗ ${t}${x ? ' → ' + x : ''}`); } };
const casos = [
  ['O que eu estudo agora?', 'agora'], ['oque faço agora', 'agora'], ['por onde começo?', 'agora'],
  ['Qual o plano de hoje?', 'hoje'], ['meu dia', 'hoje'], ['o que tenho pra hoje', 'hoje'],
  ['Minhas próximas provas', 'provas'], ['quando é a prova de história?', 'provas'], ['tenho teste essa semana?', 'provas'],
  ['Tarefas atrasadas', 'tarefas'], ['tenho dever pra entregar?', 'tarefas'],
  ['revisões de hoje', 'revisao'], ['Como foi minha semana?', 'desempenho'], ['quanto estudei', 'desempenho'],
  ['quais aulas tenho hoje', 'aulas'], ['aula de amanhã', 'aulasAmanha'], ['oi', 'oi'], ['Bom dia!', 'oi'],
  // estas vão para a IA
  ['Explique meu pior conteúdo de forma simples', null], ['Por que a revolução francesa começou?', null],
  ['resolve essa equação: 2x + 3 = 7', null], ['me ajuda com a prova de química sobre ligações covalentes', null],
  ['Quais são meus pontos mais fracos?', null], ['o que é fotossíntese', null],
  ['Faça um resumo sobre a Segunda Guerra Mundial focando nas causas e consequências para o Brasil e para o mundo', null],
];
for (const [pergunta, esperado] of casos) {
  const r = intencaoLocal(pergunta);
  conferir(r === esperado, `"${pergunta}" → ${esperado ?? 'IA'}`, String(r));
}
console.log(`\n${falhas ? '❌' : '✅'} ${ok} passaram, ${falhas} falharam`);
process.exit(falhas ? 1 : 0);
