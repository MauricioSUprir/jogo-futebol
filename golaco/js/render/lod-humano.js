// Nível de detalhe de cada boneco do corpo humano (render/humano3d.js), PURO: pela altura que ele ocupa na tela, em px
// reais, com histerese (±10%: nada pisca na fronteira), no máximo 2 na LOD0, no máximo 3 níveis com gente no quadro (o do
// meio se junta ao de cima) e um teto de triângulos por qualidade (passou, os mais baixos na tela descem primeiro).
//   LOD0 ≥ 280 px · LOD1 120–280 · LOD2 60–120 · LOD3 < 60 (a TV do celular)
export const LIMIARES = [280, 120, 60];
export const HISTERESE = 0.1;
export const MAX_LOD0 = 2;

export function criarEstadoLod() {
  return { alturas: new Float32Array(64), antes: new Map(), saida: new Uint8Array(64), ordem: [] };
}

function nivelPelaAltura(h, antes) {
  let l = 3;
  for (let i = 0; i < LIMIARES.length; i++) if (h >= LIMIARES[i]) { l = i; break; }
  if (antes == null || antes === l) return l;
  // histerese: só troca se passou do limiar com folga
  if (l < antes) return h >= LIMIARES[l] * (1 + HISTERESE) ? l : antes;   // subir de detalhe
  return h < LIMIARES[antes] * (1 - HISTERESE) ? l : antes;               // descer
}

/**
 * est.alturas[p]: a altura do boneco p em px. itens[p].chave: identidade para a histerese. tri[l]: triângulos de um boneco
 * no nível l. teto: triângulos no quadro (Infinity = sem teto). Devolve est.saida (o nível de cada boneco).
 */
export function escolherLods(est, n, itens, tri, teto = Infinity) {
  if (est.saida.length < n) est.saida = new Uint8Array(n * 2);
  const out = est.saida, alt = est.alturas;
  const vistos = new Set();
  for (let p = 0; p < n; p++) {
    const ch = itens[p].chave ?? p;
    out[p] = nivelPelaAltura(alt[p], est.antes.get(ch));
    vistos.add(ch);
  }
  // no máximo MAX_LOD0 na LOD0: os mais altos ficam
  const ordem = est.ordem; ordem.length = 0;
  for (let p = 0; p < n; p++) ordem.push(p);
  ordem.sort((a, b) => alt[b] - alt[a] || a - b);
  let n0 = 0;
  for (const p of ordem) if (out[p] === 0) { if (n0 < MAX_LOD0) n0++; else out[p] = 1; }
  // no máximo 3 níveis com gente: o do meio (2) se junta ao de cima (1)
  const usados = [0, 0, 0, 0];
  for (let p = 0; p < n; p++) usados[out[p]]++;
  if (usados[0] && usados[1] && usados[2] && usados[3]) for (let p = 0; p < n; p++) if (out[p] === 2) out[p] = 1;
  // teto de triângulos: os mais baixos na tela descem um nível por vez
  let total = 0;
  for (let p = 0; p < n; p++) total += tri[out[p]];
  for (let k = ordem.length - 1; total > teto && k >= 0; k--) {
    const p = ordem[k];
    while (out[p] < 3 && total > teto) { total += tri[out[p] + 1] - tri[out[p]]; out[p]++; }
  }
  // o teto pode ter reaberto o 4º nível: aí o do meio desce (só tira triângulos)
  usados[0] = usados[1] = usados[2] = usados[3] = 0;
  for (let p = 0; p < n; p++) usados[out[p]]++;
  if (usados[0] && usados[1] && usados[2] && usados[3]) for (let p = 0; p < n; p++) if (out[p] === 2) out[p] = 3;
  for (let p = 0; p < n; p++) est.antes.set(itens[p].chave ?? p, out[p]);
  if (est.antes.size > 4 * n + 64) for (const k of est.antes.keys()) if (!vistos.has(k)) est.antes.delete(k);
  return out;
}
