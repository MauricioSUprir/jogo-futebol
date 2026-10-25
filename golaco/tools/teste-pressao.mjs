// teste-pressao (Etapa 3, Parte 2): a pressão sem a bola no 11×11, IA × IA (Golaço 4-3-3 × Ventania
// 4-2-3-1), os dois times com a mesma pressão — Baixa, Média e Alta —, 24 sementes × 1,5 min por
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
//    a ≤ 4,6 m em ≤ 2 s) 58–78% na Média e retomada em ≤ 5 s 34–54% na Média (Metrica 44,1%; Bauer &
//    Anzer 31%).
//    A agressão: a faixa do plano (19–29%) é a da StatsBomb, que conta EVENTOS de pressão (o defensor
//    marcado como pressionando), e não a proximidade. Com a definição deste teste (adversário de linha
//    a ≤ 4,6 m do recebedor em ≤ 2 s), o rastreamento da Metrica (2 jogos, 1763 recepções de passe;
//    tools/pesquisa/agressao_metrica.py) dá 68,0% (t1/t2/t3 do recebedor: 55,9 / 65,5 / 83,7%). A meta
//    passa a ser a da mesma definição no jogo real: 68 ± 10 pontos (como as outras metas da Metrica).
//    A retomada: com a definição deste medidor (perda = qualquer toque do outro time com a bola rolando;
//    retomada = qualquer toque de volta em ≤ 5 s), os eventos da Metrica dão 44,1% (555 perdas;
//    tools/pesquisa/retomada_metrica.py) — os 36,5% da pesquisa são de outra definição (rastreamento, posse
//    "assentada"). PR "IA intensa" (dono, 10/10: "o jogo tem que ser MAIS INTENSO"; contrapressão da Média
//    3 → 4 s, Bauer & Anzer 2021): a meta passa a ser a da MESMA definição no jogo real, 44,1 ± 10 pontos
//    (34–54%), como a agressão (68 ± 10). Era 25–40%.
//   node tools/teste-pressao.mjs [--antes] [--js <pasta>] [--sementes N] [--base K]
//
// VARIANTE --humano (categoria D, D3: item 20, "pressão mais agressiva — PPDA da Média 11,0 × 8,4"; só contra a pessoa): a
// IA (time 1, Média) contra uma PESSOA no time 0 (sem a marca `ia` na entrada: tatica.js contraPessoa liga) — o 'construtor'
// (lib/partida-tatica.mjs: o ataque substituto só no time 0 — trota, segura 2,5–5 s e passa para o mais livre, ~11 passes por
// minuto como no jogo real; os roteiros do tools/lib/humano-roteiro.mjs quase não passam: contra eles o PPDA da IA dá ~1,5 e a
// retomada ~74%, medidas do roteiro e não da IA) —, N sementes (padrão 48: com 24 o PPDA variava ±1 entre calibrações
// vizinhas) × 4 min em 3 processos. Mede só a IA defendendo,
// com as MESMAS definições de cima:
//  - PPDA (Wyscout) da IA: 8–10,5 — o alvo do plano D3 é 9–10,5 e o piso 8 (os times que mais apertam: Liverpool 2021/22
//    8,62, Wyscout via Coaches' Voice; Bournemouth 2024/25 9,9, Opta; a média das 5 grandes ligas, 11,01);
//  - agressão (recepção da pessoa com alguém da IA a ≤ 4,6 m em ≤ 2 s) 58–78%: a Metrica nesta definição (68 ± 10; a guarda do
//    item 20 da FILA).
//    O "≤ 33%" do plano D3 é o máximo REAL da StatsBomb (Leeds de Bielsa 29–30%), que conta EVENTOS de pressão — outra
//    definição (a nota da agressão acima);
//  - retomada da IA em ≤ 5 s depois da perda: 34–54% (Metrica 44,1 ± 10, a mesma definição).
//   node tools/teste-pressao.mjs --humano [--sementes 48] [--roteiros espelho] [--js <pasta>] [--set CONST.caminho=valor]
import * as T from './lib/partida-tatica.mjs';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (process.argv.includes('--humano')) await varianteHumano();

// 24 sementes (eram 8: ~50–60 perdas por nível; entre conjuntos de sementes a contrapressão variava
// 34–70%, o PPDA 6,9–10,1 e a retomada por nível ±10 pontos — o "Alta ≥ Média + 5" era sorteio)
const a = T.argumentos(24);
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
reg('Média: agressão (recepção com defensor a ≤ 4,6 m em ≤ 2 s)', `${fmt(agr)}% de ${M.recepcoes}`, '58–78% (Metrica 68,0%)', dentro(agr, [58, 78]), !P3);
reg('Média: retomada em ≤ 5 s depois da perda', `${fmt(ret[1])}%`, '34–54% (Metrica 44,1%, mesma definição)', dentro(ret[1], [34, 54]), !P3);

console.log(`lógica: ${a.js}${a.antes ? '  (--antes: IA clássica no 11×11)' : ''} · Parte 3 ${P3 ? 'presente (jogo de verdade)' : 'ausente: ataque substituto dos testes; as metas do ataque só informam'}`);
console.log(`${a.sementes.length} sementes (${a.sementes[0]}–${a.sementes[a.sementes.length - 1]}) × 1,5 min × 3 níveis, ${((Date.now() - t0) / 1000).toFixed(0)} s; perdas/min ${R.map(r => fmt(r.perdas / r.minutos)).join(' / ')}; chutes/min ${R.map(r => fmt(r.chutes / r.minutos)).join(' / ')}`);
const larg = linhas[0].map((_, c) => Math.max(...linhas.map(l => String(l[c]).length)));
console.log(linhas.map(l => l.map((x, c) => String(x).padEnd(larg[c])).join(' | ')).join('\n'));
console.log(falhas ? `\nteste-pressao: REPROVOU (${falhas})` : '\nteste-pressao: PASSOU');
process.exit(falhas ? 1 : 0);

// --------------------------------------------------------------------------- variante --humano (D3)
async function varianteHumano() {
  const argv = process.argv.slice(2), val = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  const a = T.argumentos(48);
  if (argv.includes('--filho')) {
    // --set CONST.caminho=valorJSON (repetível; triagem): o config.js trocado antes de a lógica carregar
    const sets = argv.flatMap((x, i) => (x === '--set' ? [argv[i + 1]] : []));
    if (sets.length) {
      const { pathToFileURL } = await import('node:url'), path = await import('node:path');
      const C = await import(pathToFileURL(path.join(a.js, 'config.js')).href);
      for (const q of sets) {
        const chave = q.slice(0, q.indexOf('=')), partes = chave.split('.');
        let o = C[partes[0]];
        for (const k of partes.slice(1, -1)) o = o?.[k];
        if (!o || !(partes[partes.length - 1] in o)) throw new Error(`--set: ${chave} não existe`);
        o[partes[partes.length - 1]] = JSON.parse(q.slice(q.indexOf('=') + 1));
      }
    }
    const L = await T.carregar(a.js);
    const R = T.medirJogos(L, a.sementes.filter((_, k) => k % 3 === +val('--fatia', 0)), { humano: val('--roteiro', 'espelho'), min: 4 });
    process.send({ porTime: R.porTime, minutos: R.minutos, chutes: R.chutes, gols: R.gols }, () => process.exit(0));
    return await new Promise(() => {});
  }
  const ROT = val('--roteiros', 'espelho').split(',').filter(Boolean);
  const t0 = Date.now();
  const tarefas = ROT.flatMap(r => [0, 1, 2].map(f => [r, f]));
  const res = await Promise.all(tarefas.map(([r, f]) => new Promise((ok, erro) => {
    const c = fork(fileURLToPath(import.meta.url), [...argv.filter(x => x !== '--roteiros'), '--filho', '--roteiro', r, '--fatia', String(f)]);
    c.on('message', ok); c.on('error', erro);
    c.on('exit', cod => { if (cod) erro(new Error(`roteiro ${r}: saiu com ${cod}`)); });
  })));
  const soma = k => res.reduce((s, r) => s + r.porTime[1][k], 0);
  const ppda = soma('passesAdv') / Math.max(1, soma('acoes'));
  const agr = 100 * soma('agressao') / Math.max(1, soma('recepcoes')), ret = 100 * soma('retomada5') / Math.max(1, soma('perdas'));
  const ppdaR = ROT.map(r => { const q = res.filter((_, k) => tarefas[k][0] === r); return T.fmt(q.reduce((s, x) => s + x.porTime[1].passesAdv, 0) / Math.max(1, q.reduce((s, x) => s + x.porTime[1].acoes, 0)), 1); }).join(' / ');
  const linhas = [['teste (a IA contra a pessoa)', 'medido', 'meta', 'resultado']];
  let falhas = 0;
  const reg = (nome, medido, meta, ok) => { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; };
  reg('PPDA da IA (Wyscout)', `${T.fmt(ppda, 2)} (${ROT.join(' / ')}: ${ppdaR}; ${soma('acoes')} ações)`, '8–10,5 (alvo 9–10,5)', ppda >= 8 && ppda <= 10.5);
  reg('agressão: recepção da pessoa com a IA a ≤ 4,6 m em ≤ 2 s', `${T.fmt(agr)}% de ${soma('recepcoes')}`, '58–78% (Metrica 68 ± 10)', agr >= 58 && agr <= 78);
  reg('retomada da IA em ≤ 5 s depois da perda', `${T.fmt(ret)}% de ${soma('perdas')}`, '34–54% (Metrica 44,1 ± 10)', ret >= 34 && ret <= 54);
  console.log(`teste-pressao --humano — lógica: ${a.js} · ${ROT.join(', ')} × ${a.sementes.length} sementes × 4 min, ${((Date.now() - t0) / 1000).toFixed(0)} s · passes da pessoa (os que contam no PPDA) por min ${T.fmt(soma('passesAdv') / Math.max(1, res.reduce((s, r) => s + r.minutos, 0)), 1)}`);
  const larg = linhas[0].map((_, c) => Math.max(...linhas.map(l => String(l[c]).length)));
  console.log(linhas.map(l => l.map((x, c) => String(x).padEnd(larg[c])).join(' | ')).join('\n'));
  console.log(falhas ? `\nteste-pressao --humano: REPROVOU (${falhas})` : '\nteste-pressao --humano: PASSOU');
  process.exit(falhas ? 1 : 0);
}
