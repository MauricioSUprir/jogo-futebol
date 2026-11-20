// MIND CENTER — leituras do banco: acesso ao diário (cifrado), padrões, painel, insights e exportação.
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import type { User } from "@/generated/prisma/client";
import { chaveParaData, dataParaChave, intervaloDeDias, somaDias, type ChaveDia } from "@/lib/datas";
import { decifrar } from "@/lib/seguranca/cifra";
import { COOKIE_DIARIO, desembrulharChave } from "@/lib/seguranca/diario";
import { checkinsDoPeriodo } from "./checkin";
import { carregarAgenda } from "./dados";
import type { Insight } from "@/lib/insights";
import {
  diaMaisEstressante,
  diasComProvaPerto,
  estresseEProvas,
  estresseESono,
  frasesPadroes,
  tipoValido,
  type TipoDiario,
} from "@/lib/mente";

/**
 * Como o diário está para esta requisição.
 * - sem senha extra: aberto, cifrado com a chave do servidor (`chave` indefinida = a do servidor);
 * - com senha extra: aberto só com o cookie válido (a chave vem dele); senão, trancado.
 */
export interface AcessoDiario {
  temSenha: boolean;
  aberto: boolean;
  chave?: Buffer;
}

export async function acessoAoDiario(userId: string): Promise<AcessoDiario> {
  const trava = await db.journalLock.findUnique({ where: { userId }, select: { userId: true } });
  if (!trava) return { temSenha: false, aberto: true };
  const chave = desembrulharChave((await cookies()).get(COOKIE_DIARIO)?.value, userId);
  return chave ? { temSenha: true, aberto: true, chave } : { temSenha: true, aberto: false };
}

export interface EntradaDiario {
  id: string;
  dia: ChaveDia;
  tipo: TipoDiario;
  titulo: string | null;
  texto: string;
  criadaEm: Date;
  atualizadaEm: Date;
}

function abrir(cifrado: string | null, acesso: AcessoDiario): string | null {
  if (cifrado === null) return null;
  return decifrar(cifrado, acesso.chave);
}

/** Entradas decifradas (só com o diário aberto). As que não abrem com a chave atual ficam de fora. */
export async function lerEntradas(
  userId: string,
  acesso: AcessoDiario,
  filtro: { tipo?: TipoDiario; de?: ChaveDia; limite?: number } = {},
): Promise<EntradaDiario[]> {
  if (!acesso.aberto) return [];
  const linhas = await db.journalEntry.findMany({
    where: {
      userId,
      locked: acesso.temSenha,
      ...(filtro.tipo ? { kind: filtro.tipo } : {}),
      ...(filtro.de ? { day: { gte: chaveParaData(filtro.de) } } : {}),
    },
    orderBy: [{ day: "desc" }, { createdAt: "desc" }],
    take: filtro.limite ?? 200,
  });
  const r: EntradaDiario[] = [];
  for (const l of linhas) {
    try {
      r.push({
        id: l.id,
        dia: dataParaChave(l.day),
        tipo: tipoValido(l.kind) ? l.kind : "diario",
        titulo: abrir(l.titleEnc, acesso),
        texto: abrir(l.bodyEnc, acesso)!,
        criadaEm: l.createdAt,
        atualizadaEm: l.updatedAt,
      });
    } catch {
      // Chave que não abre esta entrada (não deveria acontecer): não mostra lixo.
    }
  }
  return r;
}

/** Minutos dormidos por dia em que acordou (só leitura do Sleep Lab) e a meta de sono. */
export async function sonoDoPeriodo(userId: string, de: ChaveDia, ate: ChaveDia) {
  const [noites, cfg] = await Promise.all([
    db.sleepLog.findMany({ where: { userId, day: { gte: chaveParaData(de), lte: chaveParaData(ate) } } }),
    db.sleepSettings.findUnique({ where: { userId } }),
  ]);
  const sono = new Map<ChaveDia, number>();
  for (const n of noites) {
    const min = Math.round((n.wakeTime.getTime() - n.bedtime.getTime()) / 60_000) - (n.latencyMin ?? 0);
    if (min > 0) sono.set(dataParaChave(n.day), min);
  }
  return { sono, metaMin: cfg?.targetMin ?? 540 };
}

/** Os padrões de estresse dos últimos `dias` dias (a mesma conta na página e no painel). */
export async function padroesDeEstresse(user: User, hojeK: ChaveDia, dias = 60) {
  const de = somaDias(hojeK, -(dias - 1));
  const [checkins, { sono, metaMin }, agenda] = await Promise.all([
    checkinsDoPeriodo(user.id, de, hojeK),
    sonoDoPeriodo(user.id, de, hojeK),
    carregarAgenda(user, de, somaDias(hojeK, 3)),
  ]);
  const lista = [...checkins.values()];
  const provas = agenda.filter((i) => i.tipo === "evento" && i.categoria === "prova").map((i) => i.dia);
  const comProva = diasComProvaPerto(intervaloDeDias(de, hojeK), provas);
  const dia = diaMaisEstressante(lista);
  const sonoCmp = estresseESono(lista, sono, metaMin);
  const provasCmp = estresseEProvas(lista, comProva);
  return { checkins: lista, sono, metaMin, dia, sonoCmp, provasCmp, frases: frasesPadroes({ dia, sono: sonoCmp, provas: provasCmp }) };
}

/** Insights do painel (máx. 2), sem nada do texto do diário. */
export async function insightsMente(user: User, hojeK: ChaveDia): Promise<Insight[]> {
  const p = await padroesDeEstresse(user, hojeK);
  return p.frases.slice(0, 2);
}

/** Exportação: check-ins e o diário. Com a senha extra, as entradas saem cifradas (só a senha as abre). */
export async function exportarMente(userId: string) {
  const [checkins, trava, entradas] = await Promise.all([
    db.dailyCheckin.findMany({ where: { userId }, orderBy: { day: "asc" } }),
    db.journalLock.findUnique({ where: { userId }, select: { createdAt: true } }),
    db.journalEntry.findMany({ where: { userId }, orderBy: [{ day: "asc" }, { createdAt: "asc" }] }),
  ]);
  return {
    checkins: checkins.map((c) => ({
      dia: dataParaChave(c.day),
      energia: c.energy,
      humor: c.mood,
      estresse: c.stress,
      disposicao: c.disposition,
      emocoes: c.emotions,
      notas: c.notes,
    })),
    diario: {
      senhaExtra: !!trava,
      aviso: trava ? "Entradas cifradas com a senha extra do diário (AES-256-GCM; chave por scrypt). Só a senha as abre." : undefined,
      entradas: entradas.map((e) => {
        const base = { dia: dataParaChave(e.day), tipo: e.kind, criadaEm: e.createdAt.toISOString(), atualizadaEm: e.updatedAt.toISOString() };
        if (e.locked) return { ...base, cifrada: true, titulo: e.titleEnc, texto: e.bodyEnc };
        try {
          return { ...base, cifrada: false, titulo: e.titleEnc ? decifrar(e.titleEnc) : null, texto: decifrar(e.bodyEnc) };
        } catch {
          return { ...base, cifrada: true, titulo: e.titleEnc, texto: e.bodyEnc };
        }
      }),
    },
  };
}
