// Datas e fusos — sem bibliotecas, só Intl. Funções PURAS (testadas em tests/unit/datas.test.ts).
// "Chave do dia" = "AAAA-MM-DD" na data LOCAL do usuário; é a unidade de água, hábitos e tarefas.

export type ChaveDia = string;

const formatadores = new Map<string, Intl.DateTimeFormat>();

function formatador(fuso: string): Intl.DateTimeFormat {
  let f = formatadores.get(fuso);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: fuso,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatadores.set(fuso, f);
  }
  return f;
}

export interface PartesData {
  ano: number;
  mes: number; // 1–12
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
}

/** Ano, mês, dia, hora… de um instante, no fuso pedido. */
export function partesNoFuso(data: Date, fuso: string): PartesData {
  const p: Record<string, number> = {};
  for (const parte of formatador(fuso).formatToParts(data)) {
    if (parte.type !== "literal") p[parte.type] = Number(parte.value);
  }
  return {
    ano: p.year,
    mes: p.month,
    dia: p.day,
    hora: p.hour === 24 ? 0 : p.hour,
    minuto: p.minute,
    segundo: p.second,
  };
}

/** Diferença (ms) entre o relógio local do fuso e o UTC naquele instante. */
export function deslocamentoFuso(data: Date, fuso: string): number {
  const p = partesNoFuso(data, fuso);
  const comoUtc = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  const semMs = data.getTime() - data.getUTCMilliseconds();
  return comoUtc - semMs;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function chave(ano: number, mes: number, dia: number): ChaveDia {
  return `${ano}-${pad(mes)}-${pad(dia)}`;
}

/** Chave do dia (local) de um instante. */
export function chaveNoFuso(data: Date, fuso: string): ChaveDia {
  const p = partesNoFuso(data, fuso);
  return chave(p.ano, p.mes, p.dia);
}

export function hoje(fuso: string, agora: Date = new Date()): ChaveDia {
  return chaveNoFuso(agora, fuso);
}

/** "HH:MM" local de um instante. */
export function horaNoFuso(data: Date, fuso: string): string {
  const p = partesNoFuso(data, fuso);
  return `${pad(p.hora)}:${pad(p.minuto)}`;
}

/** Minutos desde a meia-noite local de um instante. */
export function minutosNoFuso(data: Date, fuso: string): number {
  const p = partesNoFuso(data, fuso);
  return p.hora * 60 + p.minuto;
}

export function validaChave(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function validaHora(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export function horaParaMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function minutosParaHora(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** Instante UTC de uma data + hora LOCAIS no fuso (trata horário de verão). */
export function localParaUtc(dia: ChaveDia, hhmm: string, fuso: string): Date {
  const [a, me, d] = dia.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const palpite = Date.UTC(a, me - 1, d, h, mi);
  const o1 = deslocamentoFuso(new Date(palpite), fuso);
  let t = palpite - o1;
  const o2 = deslocamentoFuso(new Date(t), fuso);
  if (o2 !== o1) t = palpite - o2;
  return new Date(t);
}

/** Meia-noite local do dia, em UTC. */
export function inicioDoDiaUtc(dia: ChaveDia, fuso: string): Date {
  return localParaUtc(dia, "00:00", fuso);
}

/** Date (meia-noite UTC) para gravar em colunas @db.Date. */
export function chaveParaData(dia: ChaveDia): Date {
  return new Date(dia + "T00:00:00.000Z");
}

/** Lê uma coluna @db.Date de volta para a chave. */
export function dataParaChave(d: Date): ChaveDia {
  return d.toISOString().slice(0, 10);
}

export function somaDias(dia: ChaveDia, n: number): ChaveDia {
  const d = chaveParaData(dia);
  d.setUTCDate(d.getUTCDate() + n);
  return dataParaChave(d);
}

/** Dias entre duas chaves (b − a). */
export function diasEntre(a: ChaveDia, b: ChaveDia): number {
  return Math.round((chaveParaData(b).getTime() - chaveParaData(a).getTime()) / 86_400_000);
}

/** 0 = domingo … 6 = sábado. */
export function diaDaSemana(dia: ChaveDia): number {
  return chaveParaData(dia).getUTCDay();
}

/** Segunda-feira da semana do dia (semanas começam na segunda). */
export function inicioDaSemana(dia: ChaveDia): ChaveDia {
  const dow = diaDaSemana(dia);
  return somaDias(dia, -((dow + 6) % 7));
}

export function inicioDoMes(dia: ChaveDia): ChaveDia {
  return dia.slice(0, 8) + "01";
}

export function diasNoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

export function somaMeses(dia: ChaveDia, n: number): ChaveDia {
  const [a, m] = dia.split("-").map(Number);
  const total = a * 12 + (m - 1) + n;
  const na = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const nd = Math.min(Number(dia.slice(8)), diasNoMes(na, nm));
  return chave(na, nm, nd);
}

export function intervaloDeDias(de: ChaveDia, ate: ChaveDia): ChaveDia[] {
  const r: ChaveDia[] = [];
  for (let d = de; d <= ate; d = somaDias(d, 1)) r.push(d);
  return r;
}

// ───── Textos em português ─────

const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function nomeDia(dia: ChaveDia): string {
  return DIAS[diaDaSemana(dia)];
}

export function nomeDiaCurto(dow: number): string {
  return DIAS_CURTOS[dow];
}

export function nomeMes(mes: number): string {
  return MESES[mes - 1];
}

/** "segunda-feira, 17 de novembro" */
export function diaPorExtenso(dia: ChaveDia, comAno = false): string {
  const [a, m, d] = dia.split("-").map(Number);
  return `${nomeDia(dia)}, ${d} de ${nomeMes(m)}${comAno ? ` de ${a}` : ""}`;
}

/** "17 nov" */
export function diaCurto(dia: ChaveDia): string {
  const [, m, d] = dia.split("-").map(Number);
  return `${d} ${nomeMes(m).slice(0, 3)}`;
}

/** "Hoje", "Amanhã", "Ontem" ou "qua, 19 nov". */
export function diaRelativo(dia: ChaveDia, hojeChave: ChaveDia): string {
  const n = diasEntre(hojeChave, dia);
  if (n === 0) return "Hoje";
  if (n === 1) return "Amanhã";
  if (n === -1) return "Ontem";
  return `${nomeDiaCurto(diaDaSemana(dia))}, ${diaCurto(dia)}`;
}

export function saudacao(minutosLocais: number): string {
  if (minutosLocais < 5 * 60) return "Boa noite";
  if (minutosLocais < 12 * 60) return "Bom dia";
  if (minutosLocais < 18 * 60) return "Boa tarde";
  return "Boa noite";
}

/** Fusos válidos do Intl (com o do Brasil primeiro). */
export function listaDeFusos(): string[] {
  const todos = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["America/Sao_Paulo", "UTC"];
  const br = todos.filter((z) => z.startsWith("America/") && /Sao_Paulo|Manaus|Fortaleza|Recife|Bahia|Belem|Cuiaba|Campo_Grande|Porto_Velho|Rio_Branco|Boa_Vista|Araguaina|Maceio|Noronha|Santarem/.test(z));
  return [...br, ...todos.filter((z) => !br.includes(z))];
}

export function fusoValido(fuso: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: fuso });
    return true;
  } catch {
    return false;
  }
}
