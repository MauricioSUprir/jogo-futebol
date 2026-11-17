// Arquivo iCalendar (RFC 5545) — PURO (tests/unit/ics.test.ts).
export interface EventoIcs {
  uid: string;
  titulo: string;
  categoria?: string;
  diaInteiro: boolean;
  inicio: Date;
  fim: Date | null;
  local?: string | null;
  notas?: string | null;
  recorrencia?: string;
  repetirAte?: Date | null;
}

const escapar = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Dobra linhas em 75 octetos (UTF-8), como pede a RFC. */
export function dobrar(linha: string): string {
  const bytes = Buffer.from(linha, "utf8");
  if (bytes.length <= 75) return linha;
  const partes: string[] = [];
  let atual = "";
  let tam = 0;
  for (const ch of linha) {
    const t = Buffer.byteLength(ch, "utf8");
    if (tam + t > (partes.length ? 74 : 75)) {
      partes.push(atual);
      atual = "";
      tam = 0;
    }
    atual += ch;
    tam += t;
  }
  partes.push(atual);
  return partes.join("\r\n ");
}

const utc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const data = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

const FREQ: Record<string, string> = { diaria: "DAILY", semanal: "WEEKLY", mensal: "MONTHLY", anual: "YEARLY" };

export function gerarIcs(eventos: EventoIcs[], agora = new Date()): string {
  const l: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LIFE OS//Agenda//PT-BR", "CALSCALE:GREGORIAN", "X-WR-CALNAME:LIFE OS"];
  for (const e of eventos) {
    l.push("BEGIN:VEVENT", `UID:${e.uid}@life-os`, `DTSTAMP:${utc(agora)}`);
    if (e.diaInteiro) {
      l.push(`DTSTART;VALUE=DATE:${data(e.inicio)}`);
      const fim = new Date((e.fim ?? e.inicio).getTime() + 86_400_000); // DTEND exclusivo
      l.push(`DTEND;VALUE=DATE:${data(fim)}`);
    } else {
      l.push(`DTSTART:${utc(e.inicio)}`);
      l.push(`DTEND:${utc(e.fim ?? new Date(e.inicio.getTime() + 30 * 60_000))}`);
    }
    l.push(`SUMMARY:${escapar(e.titulo)}`);
    if (e.categoria) l.push(`CATEGORIES:${escapar(e.categoria)}`);
    if (e.local) l.push(`LOCATION:${escapar(e.local)}`);
    if (e.notas) l.push(`DESCRIPTION:${escapar(e.notas)}`);
    if (e.recorrencia && FREQ[e.recorrencia]) {
      l.push(`RRULE:FREQ=${FREQ[e.recorrencia]}${e.repetirAte ? `;UNTIL=${data(e.repetirAte)}T235959Z` : ""}`);
    }
    l.push("END:VEVENT");
  }
  l.push("END:VCALENDAR");
  return l.map(dobrar).join("\r\n") + "\r\n";
}

/** Uma linha de CSV com aspas onde precisa (e sem fórmulas que o Excel executaria). */
export function linhaCsv(campos: (string | number | boolean | null | undefined)[]): string {
  return campos
    .map((c) => {
      let s = c == null ? "" : String(c);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return /[";,\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    })
    .join(";");
}
