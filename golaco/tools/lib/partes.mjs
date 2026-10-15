// Divisão de uma lista de testes em partes para o CI rodar em várias máquinas ao mesmo tempo (dono, 15/10:
// "diminuir o tempo"). Usada por rodar-testes.mjs (Node) e rodar-navegador.mjs (Chromium).
// A divisão é pura e não depende da máquina (nem do número de núcleos): a mesma lista dá as mesmas partes em
// qualquer máquina, então as n partes juntas são a lista inteira, sem repetir nenhum teste.

// LPT (o mais caro primeiro, cada um na parte mais leve até ali; empate = a parte de menor número).
// custos[i] = segundos estimados do item i. Devolve n partes { carga, idx } com os índices na ordem da lista.
export function dividirPorCusto(custos, n) {
  const partes = Array.from({ length: n }, () => ({ carga: 0, idx: [] }));
  const ordem = custos.map((_, i) => i).sort((a, b) => custos[b] - custos[a] || a - b);
  for (const i of ordem) {
    let m = 0;
    for (let p = 1; p < n; p++) if (partes[p].carga < partes[m].carga) m = p;
    partes[m].carga += custos[i];
    partes[m].idx.push(i);
  }
  for (const p of partes) p.idx.sort((a, b) => a - b);
  return partes;
}

// --parte i --de n → { i, n } (1 ≤ i ≤ n); só --de n → { i: null, n } (o --lista imprime as n partes);
// nenhum dos dois → null (roda tudo, como antes). Erro de uso: mensagem e sai com código 2.
export function lerParte(argv) {
  const val = nome => { const k = argv.indexOf(nome); return k >= 0 ? argv[k + 1] : undefined; };
  const sp = val('--parte'), sn = val('--de');
  if (sp === undefined && sn === undefined) return null;
  const n = Number(sn), i = sp === undefined ? null : Number(sp);
  if (!Number.isInteger(n) || n < 1 || (i !== null && (!Number.isInteger(i) || i < 1 || i > n))) {
    console.error(`uso: --parte i --de n (1 ≤ i ≤ n); recebi --parte ${sp} --de ${sn}`);
    process.exit(2);
  }
  return { i, n };
}
