// Na página (window.__golaco): anda até o replay automático do impedimento (os de gol no caminho são pulados) e, nele,
// até um instante da análise semiautomática. Para os prints e os testes de navegador da cena (teste-replay F, prints).
//   ateImpedimento(pagina, {max}) → {ativo, tick, ev}
//   ateAnalise(pagina, {fase: 'linha' | 'entrada' | 'orbita' | 'final', t?: s desde o corte}) → estado do replay
export async function ateImpedimento(pagina, { max = 30000 } = {}) {
  return pagina.evaluate(max => {
    const g = window.__golaco, m = g.mundo;
    let n = 0;
    for (; n < max; n++) {
      g.relogio.avancar(1000 / 60, { desenhar: false });
      const e = g.replay.estado;
      if (e.ativo && e.tipo === 'impedimento') break;
      if (e.ativo) g.replay.pular();
    }
    const e = g.replay.estado;
    return { ativo: e.ativo && e.tipo === 'impedimento', tick: m.tick, quadros: n, ev: m.partida?.ultimoImped ?? null, fotoTick: e.fotoTick, linhaX: e.linhaX };
  }, max);
}

/**
 * No replay já começado: anda até a `fase` pedida ('linha' = o quadro do passe no P1, com a linha entrando; 'entrada',
 * 'orbita', 'final' = fases da análise) e, dentro dela, até `t` s desde o corte (análise). Sem desenhar.
 */
export async function ateAnalise(pagina, { fase = 'final', t = null } = {}) {
  return pagina.evaluate(({ fase, t }) => {
    const g = window.__golaco;
    const e = () => g.replay.estado;
    let q = 0;
    if (fase === 'linha') {
      while (q < 900 && e().ativo && !(e().cam === 'linha' && e().tick >= e().fotoTick && g.linhaImpedimento.opacidade > 0.9)) { g.relogio.avancar(1000 / 60, { desenhar: false }); q++; }
    } else {
      while (q < 1200 && e().ativo && !(e().cam === 'saot' && (fase === 'entrada' || e().saot.fase === fase || (fase === 'orbita' && e().saot.fase === 'final')))) { g.relogio.avancar(1000 / 60, { desenhar: false }); q++; }
      if (t != null) while (q < 1200 && e().ativo && e().cam === 'saot' && e().saot.t < t - 1e-6) { g.relogio.avancar(1000 / 60, { desenhar: false }); q++; }
    }
    return { ...e(), quadrosAndados: q };
  }, { fase, t });
}
