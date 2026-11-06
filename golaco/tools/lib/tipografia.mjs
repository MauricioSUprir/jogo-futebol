// A régua do sistema tipográfico do item 125 (dono, 05/11: "fontes tem que ser mais legais ... e não é só aí"): as funções que
// rodam NA PÁGINA (serializadas pelo page.evaluate: nada de fora delas). Medem o texto VISÍVEL dentro de uma raiz:
//   T1 — toda família PEDIDA (a 1ª do font-family computado) tem @font-face na página ou é do sistema (genérica/system-ui...):
//        a "Inter" sem face nenhuma (as tarjas das cenas, o cartão do autor, a faixa ENTRA/SAI, o online) caía na letra do
//        aparelho — com a Inter instalada uma, sem ela outra;
//   T2 — a letra mínima (o font-size computado do texto visível): ≥ 11 px (o pedido de legibilidade do celular).
// Usadas por teste-pausa-tela (P8), teste-comemoracao-tela (H), teste-editor-tela, teste-cenas-tela e teste-prepartida-tela.

/** As famílias "do sistema" (não pedem @font-face). */
export const FAMILIAS_SISTEMA = ['system-ui', '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'roboto', 'helvetica neue', 'helvetica', 'arial',
  'sans-serif', 'serif', 'monospace', 'ui-sans-serif', 'ui-monospace', 'arial narrow', 'liberation sans', 'dejavu sans'];

/**
 * NA PÁGINA: o texto visível dentro de `sel` (cada elemento com um nó de texto próprio não vazio, com caixa > 0 e visível).
 * Volta { n, familias: {família: n}, semFace: [{fam, el, txt}], minimo: {px, el, txt}, pequenos: [{px, el, txt}] }.
 * `limite` = a letra mínima (padrão 11); `ignorar` = seletores cujo texto não conta (ex.: o leitor de tela); `mesmoTransparente`
 * = conta também o texto com opacidade 0 (o 1º quadro de uma animação de entrada).
 */
export function medirTipografia({ sel, limite = 11, ignorar = [], sistema, mesmoTransparente = false }) {
  const raizes = [...document.querySelectorAll(sel)];
  const faces = new Set();
  try { for (const f of document.fonts) faces.add(String(f.family).replace(/^["']|["']$/g, '').toLowerCase()); } catch (_) { /* sem a API */ }
  const sys = new Set(sistema);
  const nomeEl = e => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : ''}`;
  const out = { n: 0, familias: {}, semFace: [], minimo: null, pequenos: [] };
  const vistos = new Set();
  for (const raiz of raizes) {
    const andar = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    for (let t = andar.nextNode(); t; t = andar.nextNode()) {
      const txt = t.nodeValue.trim();
      if (!txt) continue;
      const e = t.parentElement;
      if (!e || vistos.has(e)) continue;
      vistos.add(e);
      if (ignorar.some(s => e.closest(s))) continue;
      const cs = getComputedStyle(e);
      // (mesmoTransparente: o texto no começo de uma animação de entrada — opacidade 0 no 1º quadro — conta)
      if (cs.visibility !== 'visible' || (!mesmoTransparente && +cs.opacity === 0)) continue;
      const r = e.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) continue;
      // fora da janela (um submenu escondido por transform, o leitor de tela recortado): não conta
      if (r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) continue;
      if (cs.clipPath && cs.clipPath !== 'none' && /inset\(50%/.test(cs.clipPath)) continue;
      out.n++;
      const fam = cs.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');
      out.familias[fam] = (out.familias[fam] || 0) + 1;
      const fl = fam.toLowerCase();
      if (!faces.has(fl) && !sys.has(fl)) out.semFace.push({ fam, el: nomeEl(e), txt: txt.slice(0, 24) });
      const px = parseFloat(cs.fontSize);
      if (!out.minimo || px < out.minimo.px) out.minimo = { px, el: nomeEl(e), txt: txt.slice(0, 24) };
      if (px < limite - 0.01) out.pequenos.push({ px: Math.round(px * 10) / 10, el: nomeEl(e), txt: txt.slice(0, 24) });
    }
  }
  return out;
}

/** Resumo curto para a linha do teste. */
export function resumoTipografia(m) {
  if (!m) return 'sem medida';
  const fams = Object.entries(m.familias).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ${n}`).join(', ');
  const sem = m.semFace.length ? ` · SEM FACE: ${[...new Set(m.semFace.map(s => `${s.fam} (${s.el})`))].slice(0, 4).join('; ')}` : '';
  const peq = m.pequenos.length ? ` · < limite: ${m.pequenos.slice(0, 4).map(p => `${p.px}px ${p.el} "${p.txt}"`).join('; ')}` : '';
  return `${m.n} textos; ${fams}; mínimo ${m.minimo ? m.minimo.px.toFixed(1) : '—'} px${sem}${peq}`;
}
