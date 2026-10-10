// teste-forma (Etapa 3, Parte 2): a forma do time sem e com a bola no 11×11, IA × IA (Golaço 4-3-3 ×
// Ventania 4-2-3-1, tática padrão), 8 sementes × 3 min, amostras a cada 0,1 s com a bola no pé de um
// jogador de linha. Definições de tools/lib/partida-medidas.mjs (as da análise da Metrica; FIFA EFI):
// terço pela bola no referencial de quem é medido, comprimento e largura sem o goleiro, altura da
// linha = defensor de linha mais recuado até o próprio gol, linha de 4 = os 4 mais recuados.
// Metas (plano 5.1; PESQUISA-ETAPA3.md §2–§3):
//  - sem a bola, por terço (t1 = bola no meu terço): comprimento 26–34 / 24–31 / 30–39 m, largura
//    30–37 / 34–41 / 35–43 m (Metrica; FIFA 2022: 27,2 × 40,1 no bloco médio);
//  - altura da linha 12–18 / 28–36 / 44–52 m (Metrica 15,0 / 31,8 / 48,0);
//  - linha de 4: espalhamento (máx − mín) ≤ 5 / ≤ 5 / ≤ 10 m (Metrica 3,5 / 4,0 / 8,4);
//  - defesa–meio 9–13 m e meio–ataque 11–15 m com a bola no meio (Forcher 2024: 10,2 e 13,2), com as
//    linhas da forma SEM a bola (o 4-3-3 defende em 4-1-4-1: a frente é só o centroavante);
//  - ≥ 8 de 10 atrás da bola, defendendo (média);
//  - marcação individual (ramo 'marca') ≤ 25% do tempo de quem defende, com a bola fora da área;
//  - com a bola: comprimento 30–39 m e largura 44–54 m (Metrica 33,9 × 48,3), área com ÷ sem 1,3–2,0
//    (Metrica 1,48). A forma com a bola é a do apoio (Parte 3): sem ela, só informa.
// Cada terço precisa de ≥ 300 amostras (30 s de bola no pé naquele terço); com menos, a medida informa
// (sem a Parte 3) e, com a Parte 3, reprova.
// Os terços das pontas (t1, t3) dependem de ONDE a bola fica dentro deles, que é do ataque: na Metrica
// a mediana da bola no t1 é −28,6 m e no t3 +31,6 m; com o ataque substituto dos testes ela fica ~6 m
// mais perto do meio. Por isso, sem a Parte 3 eles informam (com ela, contam) e uma meta que não
// depende dessa distribuição entra no lugar: a altura da linha por FAIXA de 5 m da bola, contra a
// mesma medida na Metrica (scratchpad p2/scripts/forma_por_bola.py; 33 475 amostras), |Δ| ≤ 2,5 m em
// toda faixa com ≥ 100 amostras.
//   node tools/teste-forma.mjs [--antes] [--js <pasta>] [--sementes N] [--base K]
import * as T from './lib/partida-tatica.mjs';

const a = T.argumentos(8);
const L = await T.carregar(a.js);
const P3 = T.parte3Presente(L);
const ATAQUE = P3 ? 'jogo' : 'substituto'; // sem a Parte 3, o ataque substituto dos testes (lib/partida-tatica.mjs)
const { fmt, mediana, media } = T;
const MIN_AMOSTRAS = 300;
const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
function reg(nome, medido, meta, ok, info = false, motivo = 'AGUARDANDO PARTE 3') {
  linhas.push([nome, medido, meta, info ? (ok ? 'passa (informativo)' : motivo) : ok ? 'PASSOU' : 'REPROVOU']);
  if (!ok && !info) falhas++;
}
const t0 = Date.now();
const R = T.medirJogos(L, a.sementes, { antes: a.antes, min: 3, ataque: ATAQUE });
const dentro = (v, [lo, hi]) => v >= lo && v <= hi;
const med = (fase, t, k) => mediana(R[fase][t].map(x => x[k]));
const n = t => R.sem[t].length;
// meta por terço: conta só com amostra suficiente (ou, com a Parte 3, reprova pela amostra pequena)
function porTerco(nome, k, faixas, fmtMeta) {
  const v = [1, 2, 3].map(t => med('sem', t, k));
  const ok = v.map((x, i) => dentro(x, faixas[i]));
  const pouca = [1, 2, 3].filter(t => n(t) < MIN_AMOSTRAS);
  const okCheio = [1, 2, 3].every(t => n(t) < MIN_AMOSTRAS || ok[t - 1]);
  const medido = v.map((x, i) => `${fmt(x)}${n(i + 1) < MIN_AMOSTRAS || (!P3 && i !== 1) ? '*' : ''}`).join(' / ') + ' m';
  // sem a Parte 3, os terços das pontas (t1, t3) só informam (a profundidade da bola é do ataque)
  if (!P3) pouca.push(...[1, 3].filter(t => !pouca.includes(t)));
  if (pouca.length && !P3) {
    // os terços com amostra contam; os com pouca amostra só informam
    reg(nome, medido + '  (*: só informa)', fmtMeta, [1, 2, 3].every(t => pouca.includes(t) || ok[t - 1]));
    if (!pouca.every(t => ok[t - 1])) reg(`  ${nome} — t1/t3 (profundidade da bola é do ataque)`, pouca.map(t => `t${t}: ${fmt(v[t - 1])}`).join(', '), fmtMeta, false, true, 'AGUARDANDO PARTE 3');
  } else reg(nome, medido, fmtMeta, ok.every(Boolean) && !pouca.length);
}
porTerco('sem a bola: comprimento t1 / t2 / t3', 'comp', [[26, 34], [24, 31], [30, 39]], '26–34 / 24–31 / 30–39 m');
porTerco('sem a bola: largura t1 / t2 / t3', 'larg', [[30, 37], [34, 41], [35, 43]], '30–37 / 34–41 / 35–43 m');
porTerco('altura da linha sem a bola t1 / t2 / t3', 'alturaLinha', [[12, 18], [28, 36], [44, 52]], '12–18 / 28–36 / 44–52 m');
porTerco('linha de 4: espalhamento t1 / t2 / t3', 'espalha4', [[0, 5], [0, 5], [0, 10]], '≤ 5 / ≤ 5 / ≤ 10 m');
// altura da linha por faixa de 5 m da bola × Metrica (u da bola no referencial de quem defende)
const METRICA_ALTURA = [[-47.5, 4.9], [-42.5, 7.9], [-37.5, 10.9], [-32.5, 13.3], [-27.5, 15.6], [-22.5, 17.8], [-17.5, 21.1],
  [-12.5, 24.2], [-7.5, 26.9], [-2.5, 30.0], [2.5, 32.7], [7.5, 36.1], [12.5, 39.0], [17.5, 42.1], [22.5, 45.5], [27.5, 47.0],
  [32.5, 48.7], [37.5, 49.5], [42.5, 50.2], [47.5, 49.9]];
let piorFaixa = 0, faixaTxt = '', nFaixas = 0;
for (const [c, h] of METRICA_ALTURA) {
  const s = R.porBola.filter(q => q[0] >= c - 2.5 && q[0] < c + 2.5);
  if (s.length < 100) continue;
  nFaixas++;
  const dlt = mediana(s.map(q => q[1])) - h;
  if (Math.abs(dlt) > Math.abs(piorFaixa)) { piorFaixa = dlt; faixaTxt = `[${c - 2.5}, ${c + 2.5})`; }
}
reg('altura da linha por faixa de 5 m da bola × Metrica', `${nFaixas} faixas; maior Δ ${fmt(piorFaixa)} m em ${faixaTxt}`, '|Δ| ≤ 2,5 m (faixas com ≥ 100 amostras)', Math.abs(piorFaixa) <= 2.5 && nFaixas >= 8);
const dm = med('sem', 2, 'defMeio'), ma = med('sem', 2, 'meioAtaque');
reg('defesa–meio / meio–ataque sem a bola (bola no meio)', `${fmt(dm)} / ${fmt(ma)} m`, '9–13 / 11–15 m', dentro(dm, [9, 13]) && dentro(ma, [11, 15]));
const atras = media(R.atras);
reg('de 10 atrás da bola, defendendo (média)', `${fmt(atras)}  (por terço ${[1, 2, 3].map(t => fmt(media(R.atrasT[t]))).join(' / ')})`, '≥ 8', atras >= 8);
const marca = 100 * R.marca / R.defN;
reg('marcação individual de quem defende (bola fora da área)', `${fmt(marca)}%`, '≤ 25%', marca <= 25);
// com a bola (Parte 3)
const todosCom = [1, 2, 3].flatMap(t => R.com[t]);
const cc = mediana(todosCom.map(x => x.comp)), lc = mediana(todosCom.map(x => x.larg));
reg('com a bola: comprimento × largura', `${fmt(cc)} × ${fmt(lc)} m (t1/t2/t3: ${[1, 2, 3].map(t => `${fmt(med('com', t, 'comp'))} × ${fmt(med('com', t, 'larg'))}`).join(' · ')})`, '30–39 × 44–54 m', dentro(cc, [30, 39]) && dentro(lc, [44, 54]), !P3);
const razao = mediana(R.areaCom) / mediana(R.areaSem);
reg('área com ÷ sem a bola', fmt(razao, 2), '1,3–2,0', dentro(razao, [1.3, 2.0]), !P3);

console.log(`lógica: ${a.js}${a.antes ? '  (--antes: IA clássica no 11×11)' : ''} · Parte 3 ${P3 ? 'presente (jogo de verdade)' : 'ausente: ataque substituto dos testes; a forma com a bola só informa'}`);
const mBola = t => mediana(R.porBola.filter(q => (t === 1 ? q[0] < -17.5 : t === 3 ? q[0] >= 17.5 : Math.abs(q[0]) < 17.5)).map(q => q[0]));
console.log(`${a.sementes.length} sementes (${a.sementes[0]}–${a.sementes[a.sementes.length - 1]}) × 3 min, ${((Date.now() - t0) / 1000).toFixed(0)} s; amostras sem a bola por terço: ${[1, 2, 3].map(n).join(' / ')}; bola (mediana) no t1 / t3: ${fmt(mBola(1))} / ${fmt(mBola(3))} m (Metrica −28,6 / +31,6); chutes ${fmt(R.chutes / R.minutos)}/min, gols ${fmt(R.gols / R.minutos, 2)}/min`);
const tot = Object.values(R.ramos).reduce((s, v) => s + v, 0);
console.log('papéis de quem defende: ' + Object.entries(R.ramos).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${fmt(100 * v / tot)}%`).join(' · '));
const larg = linhas[0].map((_, c) => Math.max(...linhas.map(l => String(l[c]).length)));
console.log(linhas.map(l => l.map((x, c) => String(x).padEnd(larg[c])).join(' | ')).join('\n'));
console.log(falhas ? `\nteste-forma: REPROVOU (${falhas})` : '\nteste-forma: PASSOU');
process.exit(falhas ? 1 : 0);
