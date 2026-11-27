/** Formatação em pt-BR (datas no fuso de São Paulo por padrão no servidor). */
const FUSO = "America/Sao_Paulo";

export function dinheiro(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === "") return null;
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: Number(v) % 1 ? 2 : 0 });
}

export function faixaDePreco(min: number | string | null, max: number | string | null) {
  const a = dinheiro(min);
  const b = dinheiro(max);
  if (a && b) return a === b ? a : `${a} a ${b}`;
  if (b) return `até ${b}`;
  if (a) return `a partir de ${a}`;
  return null;
}

export function dataHora(iso: string | null | undefined, opcoes: Intl.DateTimeFormatOptions = {}) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    ...opcoes,
  });
}

export function dataCurta(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "short", year: "numeric" });
}

export function relativo(iso: string) {
  const s = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  const abs = Math.abs(s);
  if (abs < 60) return rtf.format(s, "second");
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(s / 86400), "day");
  return dataCurta(iso) ?? "";
}

/** Para <input type="datetime-local"> no fuso de São Paulo. */
export function paraInputLocal(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const partes = new Intl.DateTimeFormat("sv-SE", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d);
  return partes.replace(" ", "T");
}

/** "2026-12-24T20:00" (hora de São Paulo) → ISO UTC. */
export function deInputLocal(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(valor);
  if (!m) return null;
  const [, a, mes, d, h, min] = m.map(Number) as unknown as number[];
  // São Paulo não tem horário de verão desde 2019: UTC−3
  return new Date(Date.UTC(a, mes - 1, d, h + 3, min)).toISOString();
}
