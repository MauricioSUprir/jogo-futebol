// O relógio do placar em MM:SS (item 32 da FILA; dono, 17/10: "o placar com mais a cara do Total Match, um pouco MAIOR e o
// relógio com os SEGUNDOS além dos minutos"). PURO: sem DOM, sem three.js, sem rng e SEM import — fica FORA do fecho do hash
// (tools/fecho-hash.mjs): só o main.js e o hud.js o importam e ele só LÊ os campos do mundo (m.tick, m.partida). Contrato
// "Placar (17/10)" no CONTRATOS.md; teste: tools/teste-relogio-placar.mjs.
//
// O tempo de jogo anda 45 min por tempo (2 × 4 min reais viram 2 × 45: 11,25 segundos de jogo por segundo real). O minuto
// sai da MESMA conta float do partida.js minutoDeJogo (a conta inteira pura floor(d·2700/T) discordava dela em 34 de 537.402
// ticks de 17 durações; assim, 0) e os segundos da fração dela. Nos acréscimos o relógio continua andando ("47:13", com o
// "+4" ao lado, como o PES 2019 — manual oficial —, o EA FC, a Premier League desde 2023/24 e a Bundesliga desde 2026); o
// minuto dele é 45/90 + o "decorrido" do acrescimoDeJogo (a mesma conta inteira: floor(floor(a·2700/T)/60) = floor(a·45/T)).

/**
 * Segundo de jogo mostrado no placar (inteiro, ≥ 0): 0–2700 no 1º tempo, 2700–5400 no 2º e além disso nos acréscimos (o
 * relógio continua, como na TV). No tempo regulamentar floor(s/60) é SEMPRE o minutoDeJogo (a mesma conta float, na mesma
 * ordem); nos acréscimos é 45/90 + acrescimoDeJogo().decorrido (até o teto dele; depois do apito, num gol nos acréscimos, o
 * relógio passa de 45 + N durante a pausa do gol, como na TV). Intervalo: 2700. Fim: 5400. Sem partida: 0.
 */
export function segundoDeJogo(m) {
  const p = m.partida;
  if (!p) return 0;
  if (p.estado === 'fim') return 5400;
  if (p.estado === 'intervalo') return 2700;
  const d = Math.max(0, m.tick - p.tick0Tempo), T = p.ticksPorTempo, base = (p.tempo - 1) * 2700;
  if (d < T) {
    // a expressão do minutoDeJogo, na mesma ordem (Math.min(1, d / T) * 45): o mesmo float, o mesmo minuto
    const x = Math.min(1, d / T) * 45, mm = Math.floor(x);
    return base + mm * 60 + Math.min(59, Math.floor((x - mm) * 60));
  }
  // floor(·/60) = o "decorrido" do acrescimoDeJogo (floor((d − T)·45/T))
  return base + 2700 + Math.floor((d - T) * 2700 / T);
}

const dois = n => (n < 10 ? '0' : '') + n;

/**
 * Texto do bloco do relógio. r = {segundo, estado, acrescimo: {anunciado} | null} (aceita também o {minuto, acrescimo:
 * {decorrido}} de antes: segundo = (minuto + decorrido)·60).
 * → {texto: '34:12' | '100:18' | 'Intervalo' | 'Fim', extra: '' | '+4', formato: 'jogo' | 'acrescimo' | 'parado'}.
 * Os minutos sempre com 2 dígitos ("05:07"); 3 só além de 99:59 (um gol nos acréscimos máximos do 2º tempo, na pausa do gol).
 */
export function textoRelogio(r) {
  if (r.estado === 'intervalo') return { texto: 'Intervalo', extra: '', formato: 'parado' };
  if (r.estado === 'fim') return { texto: 'Fim', extra: '', formato: 'parado' };
  const ac = r.acrescimo ?? null;
  let s = r.segundo;
  if (s == null) s = ((r.minuto ?? 0) + (ac && ac.decorrido > 0 ? ac.decorrido : 0)) * 60;
  s = Math.max(0, Math.floor(s));
  const texto = `${dois(Math.floor(s / 60))}:${dois(s % 60)}`;
  return ac ? { texto, extra: `+${ac.anunciado}`, formato: 'acrescimo' } : { texto, extra: '', formato: 'jogo' };
}
