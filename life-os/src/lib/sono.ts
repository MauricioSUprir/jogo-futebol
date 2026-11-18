// SLEEP LAB — regras PURAS do sono (tests/unit/sono.test.ts). Sem banco nem DOM.
// A noite pertence ao dia em que a pessoa ACORDOU; dormir antes da meia-noite cai no dia anterior.
// Horários de dormir cruzam a meia-noite (23:30, 00:15…): médias e desvios são CIRCULARES (relógio de 24 h).
import {
  type ChaveDia,
  diaDaSemana,
  horaParaMinutos,
  localParaUtc,
  minutosNoFuso,
  somaDias,
} from "./datas";
import { comparaGrupos, type Checkin } from "./checkin";

export const DIA_MIN = 1440;

export interface Noite {
  id?: string;
  dia: ChaveDia; // dia em que acordou
  deitou: Date;
  acordou: Date;
  latenciaMin: number | null;
  despertares: number | null;
  qualidade: number | null; // 1–5
  notas: string | null;
}

export const QUALIDADE: Record<number, string> = { 1: "Muito ruim", 2: "Ruim", 3: "Regular", 4: "Boa", 5: "Ótima" };

/** Limites de uma noite registrada (tempo na cama). */
export const NA_CAMA_MIN = 60;
export const NA_CAMA_MAX = 16 * 60;

/**
 * Converte "deitou HH:MM" e "acordou HH:MM" (horário local) nos instantes UTC da noite que termina em `diaAcordou`.
 * Se o horário de dormir é igual ou depois do de acordar no relógio (23:30 → 07:15), dormiu no dia anterior.
 */
export function instantesDaNoite(diaAcordou: ChaveDia, deitouHHMM: string, acordouHHMM: string, fuso: string): { deitou: Date; acordou: Date } {
  const acordou = localParaUtc(diaAcordou, acordouHHMM, fuso);
  const diaDeitou = horaParaMinutos(deitouHHMM) >= horaParaMinutos(acordouHHMM) ? somaDias(diaAcordou, -1) : diaAcordou;
  const deitou = localParaUtc(diaDeitou, deitouHHMM, fuso);
  return { deitou, acordou };
}

/** Minutos na cama (de deitar a acordar). */
export function minutosNaCama(n: Pick<Noite, "deitou" | "acordou">): number {
  return Math.round((n.acordou.getTime() - n.deitou.getTime()) / 60_000);
}

/** Duração do sono em minutos: tempo na cama menos o tempo até pegar no sono. */
export function duracaoMin(n: Pick<Noite, "deitou" | "acordou" | "latenciaMin">): number {
  return Math.max(0, minutosNaCama(n) - (n.latenciaMin ?? 0));
}

/** "7 h 45 min", "8 h", "45 min". */
export function formatarDuracao(min: number | null): string {
  if (min === null || !Number.isFinite(min)) return "—";
  const m = Math.round(min);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  return r === 0 ? `${h} h` : `${h} h ${r} min`;
}

/** Diferença assinada b − a no relógio de 24 h, em minutos, no intervalo [−720, 720). */
export function difCircular(a: number, b: number): number {
  return ((((b - a + 720) % DIA_MIN) + DIA_MIN) % DIA_MIN) - 720;
}

/** Média circular de horários (minutos desde a meia-noite). null sem dados. */
export function mediaCircular(minutos: number[]): number | null {
  if (!minutos.length) return null;
  let s = 0;
  let c = 0;
  for (const m of minutos) {
    const ang = (m / DIA_MIN) * 2 * Math.PI;
    s += Math.sin(ang);
    c += Math.cos(ang);
  }
  if (Math.abs(s) < 1e-9 && Math.abs(c) < 1e-9) return null; // horários espalhados igualmente: sem média
  const ang = Math.atan2(s, c);
  return ((((ang / (2 * Math.PI)) * DIA_MIN) % DIA_MIN) + DIA_MIN) % DIA_MIN;
}

/** Desvio (raiz da média dos quadrados) dos horários em torno da média circular, em minutos. */
export function desvioCircular(minutos: number[]): number | null {
  const m = mediaCircular(minutos);
  if (m === null) return null;
  const q = minutos.reduce((s, x) => s + difCircular(m, x) ** 2, 0) / minutos.length;
  return Math.sqrt(q);
}

/** Minuto local em que pegou no sono (deitou + latência). */
export function minutoDormiu(n: Noite, fuso: string): number {
  return minutosNoFuso(new Date(n.deitou.getTime() + (n.latenciaMin ?? 0) * 60_000), fuso);
}

/** Ponto médio do sono (minuto local), entre pegar no sono e acordar. */
export function pontoMedio(n: Noite, fuso: string): number {
  const ini = n.deitou.getTime() + (n.latenciaMin ?? 0) * 60_000;
  const meio = new Date((ini + n.acordou.getTime()) / 2);
  return minutosNoFuso(meio, fuso);
}

export interface Regularidade {
  n: number;
  dormir: number | null; // horário médio de deitar (minutos)
  acordar: number | null;
  desvioDormir: number | null; // minutos
  desvioAcordar: number | null;
}

/** Regularidade dos horários: horários médios e quanto variam (precisa de ≥ 3 noites para os desvios). */
export function regularidade(noites: Noite[], fuso: string): Regularidade {
  const dormir = noites.map((n) => minutosNoFuso(n.deitou, fuso));
  const acordar = noites.map((n) => minutosNoFuso(n.acordou, fuso));
  const comDesvio = noites.length >= 3;
  return {
    n: noites.length,
    dormir: mediaCircular(dormir),
    acordar: mediaCircular(acordar),
    desvioDormir: comDesvio ? desvioCircular(dormir) : null,
    desvioAcordar: comDesvio ? desvioCircular(acordar) : null,
  };
}

/** A noite antecede um dia de aula? (pelo dia em que acordou; bit 0 = domingo). */
export function noiteDeAula(dia: ChaveDia, diasAula: number): boolean {
  return (diasAula & (1 << diaDaSemana(dia))) !== 0;
}

export interface GrupoNoites {
  n: number;
  duracao: number | null;
  dormir: number | null;
  acordar: number | null;
  meio: number | null;
}

function grupo(noites: Noite[], fuso: string): GrupoNoites {
  return {
    n: noites.length,
    duracao: noites.length ? noites.reduce((s, x) => s + duracaoMin(x), 0) / noites.length : null,
    dormir: mediaCircular(noites.map((x) => minutosNoFuso(x.deitou, fuso))),
    acordar: mediaCircular(noites.map((x) => minutosNoFuso(x.acordou, fuso))),
    meio: mediaCircular(noites.map((x) => pontoMedio(x, fuso))),
  };
}

/**
 * Dias de aula × fins de semana (e outros dias livres). jetlagMin = diferença entre os pontos médios do sono
 * (o "jet lag social"): quanto o relógio do sono muda entre os dois tipos de dia. Só com ≥ 2 noites de cada lado.
 */
export function aulaVsLivre(noites: Noite[], diasAula: number, fuso: string): { aula: GrupoNoites; livre: GrupoNoites; jetlagMin: number | null } {
  const aula = grupo(noites.filter((n) => noiteDeAula(n.dia, diasAula)), fuso);
  const livre = grupo(noites.filter((n) => !noiteDeAula(n.dia, diasAula)), fuso);
  const jetlagMin = aula.n >= 2 && livre.n >= 2 && aula.meio !== null && livre.meio !== null ? Math.abs(difCircular(aula.meio, livre.meio)) : null;
  return { aula, livre, jetlagMin };
}

/** A noite chegou à meta? */
export function bateuMeta(n: Pick<Noite, "deitou" | "acordou" | "latenciaMin">, metaMin: number): boolean {
  return duracaoMin(n) >= metaMin;
}

/**
 * Sono e disposição: energia do check-in no dia em que acordou, depois de noites com a meta (a) × sem (b).
 * Só responde com ≥ 3 noites de cada lado (comparaGrupos).
 */
export function sonoEEnergia(noites: Noite[], checkins: Map<ChaveDia, Checkin>, metaMin: number) {
  return comparaGrupos(
    noites.map((n) => ({ grupo: bateuMeta(n, metaMin) ? ("a" as const) : ("b" as const), valor: checkins.get(n.dia)?.energia ?? null })),
  );
}

/** Lembrete de preparar o descanso: de `antes` minutos antes do horário de dormir até ele (relógio de 24 h). */
export function lembreteDescanso(agoraMin: number, dormirHHMM: string, antesMin: number): boolean {
  if (antesMin <= 0) return false;
  const faltam = ((horaParaMinutos(dormirHHMM) - agoraMin) % DIA_MIN + DIA_MIN) % DIA_MIN;
  return faltam <= antesMin;
}

/** Minutos de um dia → "HH:MM" (aceita frações e valores fora de 0–1439). */
export function horaDeMinutos(min: number | null): string {
  if (min === null) return "—";
  const m = ((Math.round(min) % DIA_MIN) + DIA_MIN) % DIA_MIN;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Dias da semana marcados num inteiro (bit 0 = domingo). */
export function bitsParaDias(bits: number): number[] {
  return [0, 1, 2, 3, 4, 5, 6].filter((d) => (bits & (1 << d)) !== 0);
}

export function diasParaBits(dias: number[]): number {
  return dias.reduce((s, d) => (d >= 0 && d <= 6 ? s | (1 << d) : s), 0);
}

/** Horas com 1 casa (para gráfico). */
export function horas(min: number): number {
  return Math.round((min / 60) * 10) / 10;
}
