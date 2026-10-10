// teste-pressao (Etapa 3, Parte 2): a pressão sem a bola no 11×11, IA × IA (Golaço 4-3-3 × Ventania
// 4-2-3-1), os dois times com a mesma pressão — Baixa, Média e Alta —, 8 sementes × 1,5 min por
// nível, amostras a cada 0,1 s com a bola no pé de um jogador de linha. Definições de
// tools/lib/partida-medidas.mjs (Metrica, StatsBomb, Wyscout; PESQUISA-ETAPA3.md §4).
// Metas (plano 5.1):
//  - 1º marcador até o condutor, mediana: Baixa 4–7 / Média 2,5–5 / Alta 1,5–4 m (real 4,7; a Média
//    fica mais apertada que o real de propósito: o dono pediu jogo mais intenso);
//  - Média: 2º marcador 7–13 m (real 9,6); defensores a ≤ 10 m, média 1,4–2,4 (real 1,8);
//  - Média, sem recuo (metas do teste-movimento): marcador a ≤ 3 m do condutor ≥ 40% do tempo e
//    ≥ 50% na posse assentada (o mesmo condutor há > 1,5 s);
//  - PPDA (Wyscout) decrescente Baixa > Média > Alta, cada passo ≥ 15% menor;
//  - contrapressão: alguém (≠ quem perdeu) a ≤ 2 m da bola em ≤ 3 s depois da perda 50–70% na Média
//    (Metrica 61%); a retomada em ≤ 5 s na Alta ≥ Média + 5 pontos; 2 s depois da janela de
//    contrapressão ninguém segue em contrapressão e no máximo os 2 mais perto (1º e 2º homem) apertam;
//  - dependem do ATAQUE (Parte 3; sem ela, contra o condutor clássico que perde a bola ~25×/min no
//    11×11, só informam): PPDA da Média 8–16 (Wyscout: média 11), "agressão" (recepção com defensor
//    a ≤ 4,6 m em ≤ 2 s) 19–29% na Média (StatsBomb) e retomada em ≤ 5 s 25–40% na Média (Metrica
//    36,5%; Bauer & Anzer 31%).
//   node tools/teste-pressao.mjs [--antes] [--js <pasta>] [--sementes N] [--base K]
import * as T from './lib/partida-tatica.mjs';

const a = T.argumentos(8);
const L = await T.carregar(a.js);
const P3 = T.parte3Presente(L);
const ATAQUE = P3 ? 'jogo' : 'substituto'; // sem a Parte 3, o ataque substituto dos testes (lib/partida-tatica.mjs)
const { fmt, mediana, media } = T;
const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
function reg(nome, medido, meta, ok, info = false) {
  linhas.push([nome, medido, meta, info ? (ok ? 'passa (informativo)' : 'AGUARDANDO PARTE 3') : ok ? 'PASSOU' : 'REPROVOU']);
  if (!ok && !info) falhas++;
}
const dentro = (v, [lo, hi]) => v >= lo && v <= hi;
const t0 = Date.now();
const R = [0, 1, 2].map(p => {
  const tat = { mentalidade: 0, pressao: p, largura: 1, linha: 1 };
  return T.medirJogos(L, a.sementes, { antes: a.antes, min: 1.5, ataque: ATAQUE, times: { 0: { tatica: tat }, 1: { tatica: tat } } });
});
const NOMES = ['Baixa', 'Média', 'Alta'];
const m1 = R.map(r => mediana(r.m1));
const F1 = [[4, 7], [2.5, 5], [1.5, 4]];
reg('1º marcador até o condutor (mediana) Baixa / Média / Alta', m1.map(v => `${fmt(v)} m`).join(' / '), '4–7 / 2,5–5 / 1,5–4 m', m1.every((v, k) => dentro(v, F1[k])));
const M = R[1];
const m2 = mediana(M.m2), a10 = media(M.a10);
reg('Média: 2º marcador até o condutor (mediana)', `${fmt(m2)} m`, '7–13 m', dentro(m2, [7, 13]));
reg('Média: defensores a ≤ 10 m do condutor (média)', fmt(a10, 2), '1,4–2,4', dentro(a10, [1.4, 2.4]));
const perto = 100 * M.perto3 / M.porta, assent = 100 * M.assentada / M.assentadaN;
reg('sem recuo — Média: marcador a ≤ 3 m do condutor', `${fmt(perto)}% do tempo`, '≥ 40%', perto >= 40);
reg('sem recuo — Média: na posse assentada (> 1,5 s)', `${fmt(assent)}%`, '≥ 50%', assent >= 50);
const ppda = R.map(r => r.ppdaTotal);
reg('PPDA Baixa > Média > Alta (cada passo ≥ 15% menor)', ppda.map(v => fmt(v, 2)).join(' / '), 'decrescente, −15% por passo', ppda[1] <= 0.85 * ppda[0] && ppda[2] <= 0.85 * ppda[1]);
const chega = 100 * M.chega2 / M.perdas;
reg('Média: alguém (≠ quem perdeu) a ≤ 2 m da bola em ≤ 3 s', `${fmt(chega)}% de ${M.perdas} perdas`, '50–70%', dentro(chega, [50, 70]));
const ret = R.map(r => 100 * r.retomada5 / r.perdas);
reg('retomada em ≤ 5 s: Alta ≥ Média + 5 pontos', `${ret.map(v => `${fmt(v)}%`).join(' / ')} (Baixa / Média / Alta)`, 'Alta ≥ Média + 5', ret[2] >= ret[1] + 5);
const dj = [1, 2].flatMap(k => R[k].depoisJanela);
const contraDepois = dj.filter(q => q.contra > 0).length, maisDe2 = dj.filter(q => q.apertam > 2).length;
reg('2 s depois da janela (Média e Alta): em contrapressão / mais de 2 apertando', `${contraDepois} / ${maisDe2} de ${dj.length} perdas`, '0 / ≤ 5%', contraDepois === 0 && maisDe2 <= 0.05 * dj.length);
// dependem do ataque (Parte 3)
reg('Média: PPDA (Wyscout)', fmt(ppda[1], 2), '8–16', dentro(ppda[1], [8, 16]), !P3);
const agr = 100 * M.agressao / M.recepcoes;
reg('Média: agressão (recepção com defensor a ≤ 4,6 m em ≤ 2 s)', `${fmt(agr)}% de ${M.recepcoes}`, '19–29%', dentro(agr, [19, 29]), !P3);
reg('Média: retomada em ≤ 5 s depois da perda', `${fmt(ret[1])}%`, '25–40%', dentro(ret[1], [25, 40]), !P3);

console.log(`lógica: ${a.js}${a.antes ? '  (--antes: IA clássica no 11×11)' : ''} · Parte 3 ${P3 ? 'presente (jogo de verdade)' : 'ausente: ataque substituto dos testes; as metas do ataque só informam'}`);
console.log(`${a.sementes.length} sementes (${a.sementes[0]}–${a.sementes[a.sementes.length - 1]}) × 1,5 min × 3 níveis, ${((Date.now() - t0) / 1000).toFixed(0)} s; perdas/min ${R.map(r => fmt(r.perdas / r.minutos)).join(' / ')}; chutes/min ${R.map(r => fmt(r.chutes / r.minutos)).join(' / ')}`);
const larg = linhas[0].map((_, c) => Math.max(...linhas.map(l => String(l[c]).length)));
console.log(linhas.map(l => l.map((x, c) => String(x).padEnd(larg[c])).join(' | ')).join('\n'));
console.log(falhas ? `\nteste-pressao: REPROVOU (${falhas})` : '\nteste-pressao: PASSOU');
process.exit(falhas ? 1 : 0);
