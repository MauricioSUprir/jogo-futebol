/* ===== relogio.js — as contas do cronômetro e do timer (sem tela, testável em Node) =====
   Tudo guardado por horário (ms desde 1970), nunca somando de segundo em segundo:
   assim os dois continuam certos ao trocar de tela, recarregar a página ou com a
   aba no fundo (o navegador atrasa o relógio das abas escondidas).            */

export function cronometroNovo() {
  return { rodando: false, inicio: 0, acumulado: 0, voltas: [] };
}
export function timerNovo(duracao = 5 * 60000) {
  return { duracao, rodando: false, fim: 0, restante: duracao, tocou: false };
}

/* ---------- cronômetro ---------- */
export const tempoCronometro = (c, agora) => (c.rodando ? c.acumulado + (agora - c.inicio) : c.acumulado);

export function iniciarCronometro(c, agora) {
  return c.rodando ? c : { ...c, rodando: true, inicio: agora };
}
export function pausarCronometro(c, agora) {
  return c.rodando ? { ...c, rodando: false, acumulado: tempoCronometro(c, agora), inicio: 0 } : c;
}
/** Volta: guarda o tempo total no momento (a duração da volta sai da diferença). */
export function voltaCronometro(c, agora) {
  return c.rodando ? { ...c, voltas: [...c.voltas, tempoCronometro(c, agora)] } : c;
}
export const zerarCronometro = () => cronometroNovo();

/** As voltas com a duração de cada uma, a mais recente primeiro. */
export function listaVoltas(c) {
  return c.voltas.map((total, i) => ({ n: i + 1, total, volta: total - (i ? c.voltas[i - 1] : 0) })).reverse();
}

/* ---------- timer ---------- */
export const restanteTimer = (t, agora) => (t.rodando ? Math.max(0, t.fim - agora) : t.restante);

export function definirTimer(t, duracao) {
  const d = Math.max(1000, Math.min(Math.round(duracao), 24 * 3600000));
  return { ...t, duracao: d, rodando: false, fim: 0, restante: d, tocou: false };
}
export function iniciarTimer(t, agora) {
  if (t.rodando) return t;
  const restante = t.restante > 0 ? t.restante : t.duracao;   // acabou: começa de novo
  return { ...t, rodando: true, fim: agora + restante, restante, tocou: false };
}
export function pausarTimer(t, agora) {
  return t.rodando ? { ...t, rodando: false, restante: restanteTimer(t, agora), fim: 0 } : t;
}
export const reiniciarTimer = (t) => definirTimer(t, t.duracao);
/** +1 min (ou o que vier): funciona rodando, pausado e depois de acabar. */
export function somarTimer(t, ms, agora) {
  if (t.rodando) return { ...t, fim: t.fim + ms, duracao: t.duracao + ms };
  const restante = restanteTimer(t, agora) + ms;
  return { ...t, restante, duracao: Math.max(t.duracao, restante), tocou: false };
}
/** O timer chegou a zero agora e ainda não tocou? */
export const timerAcabou = (t, agora) => t.rodando && !t.tocou && agora >= t.fim;
export function marcarTocou(t) {
  return { ...t, rodando: false, restante: 0, fim: 0, tocou: true };
}

/* ---------- texto ---------- */
const dois = (n) => String(n).padStart(2, '0');
/** 1:02:03 · 02:03 · com centésimos: 02:03,45. Arredonda para baixo (o cronômetro não "adianta"). */
export function formatar(ms, { centesimos = false, paraCima = false } = {}) {
  const v = Math.max(0, ms);
  const totalS = paraCima ? Math.ceil(v / 1000) : Math.floor(v / 1000);
  const h = Math.floor(totalS / 3600), m = Math.floor((totalS % 3600) / 60), s = totalS % 60;
  const base = h ? `${h}:${dois(m)}:${dois(s)}` : `${dois(m)}:${dois(s)}`;
  return centesimos ? `${base},${dois(Math.floor((v % 1000) / 10))}` : base;
}
