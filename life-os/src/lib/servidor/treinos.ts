// FITNESS CENTER — leituras do banco (fichas, atividades, séries, recuperação e o sono das últimas noites).
import { db } from "@/lib/db";
import type { User } from "@/generated/prisma/client";
import { chaveParaData, dataParaChave, horaNoFuso, somaDias, type ChaveDia } from "@/lib/datas";
import {
  alertasRecuperacao,
  cargaSessao,
  cargaSemanal,
  minutosPorTipo,
  nomeSubtipo,
  type AtividadeResumo,
  type JogoFutebol,
  type RegistroRecuperacao,
  type SerieFeita,
} from "@/lib/treinos";
import type { Insight } from "@/lib/insights";

export async function carregarFichas(userId: string, comArquivadas = false) {
  return db.workoutPlan.findMany({
    where: { userId, ...(comArquivadas ? {} : { archived: false }) },
    include: { exercises: { orderBy: { position: "asc" } } },
    orderBy: [{ favorite: "desc" }, { position: "asc" }, { createdAt: "asc" }],
  });
}
export type FichaCompleta = Awaited<ReturnType<typeof carregarFichas>>[number];

export async function carregarAtividades(userId: string, de: ChaveDia, ate: ChaveDia, tipo?: string) {
  return db.activity.findMany({
    where: { userId, day: { gte: chaveParaData(de), lte: chaveParaData(ate) }, ...(tipo ? { kind: tipo } : {}) },
    include: { sets: { orderBy: { id: "asc" } }, plan: { select: { id: true, name: true } } },
    orderBy: [{ day: "desc" }, { at: "desc" }, { createdAt: "desc" }],
  });
}
export type AtividadeCompleta = Awaited<ReturnType<typeof carregarAtividades>>[number];

export function resumoDe(a: { day: Date; kind: string; durationMin: number; effort: number | null }): AtividadeResumo {
  return { dia: dataParaChave(a.day), tipo: a.kind, duracao: a.durationMin, esforco: a.effort };
}

export function jogoDe(a: AtividadeCompleta | { day: Date; subtype: string | null; minutes: number | null; durationMin: number; goals: number | null; assists: number | null; position: string | null; rating: number | null }): JogoFutebol {
  return {
    dia: dataParaChave(a.day),
    subtipo: a.subtype ?? "partida",
    minutos: a.minutes,
    duracao: a.durationMin,
    gols: a.goals,
    assistencias: a.assists,
    posicao: a.position,
    nota: a.rating,
  };
}

export async function carregarRecuperacao(userId: string, de: ChaveDia, ate: ChaveDia) {
  return db.recoveryLog.findMany({
    where: { userId, day: { gte: chaveParaData(de), lte: chaveParaData(ate) } },
    orderBy: { day: "desc" },
  });
}

export function recuperacaoDe(r: Awaited<ReturnType<typeof carregarRecuperacao>>[number]): RegistroRecuperacao {
  return {
    dia: dataParaChave(r.day),
    descanso: r.restDay,
    cansaco: r.fatigue,
    recuperacao: r.recovery,
    dor: r.soreness,
    desconforto: r.discomfort,
  };
}

/** As últimas noites do Sleep Lab (só leitura). */
export async function sonoRecente(user: User, hojeK: ChaveDia, noites = 7) {
  const linhas = await db.sleepLog.findMany({
    where: { userId: user.id, day: { gte: chaveParaData(somaDias(hojeK, -(noites - 1))), lte: chaveParaData(hojeK) } },
    orderBy: { day: "desc" },
  });
  return linhas.map((s) => ({
    dia: dataParaChave(s.day),
    deitou: horaNoFuso(s.bedtime, user.timezone),
    acordou: horaNoFuso(s.wakeTime, user.timezone),
    minutos: Math.max(0, Math.round((s.wakeTime.getTime() - s.bedtime.getTime()) / 60_000) - (s.latencyMin ?? 0)),
    qualidade: s.quality,
  }));
}

/** Séries de musculação (para a evolução da carga e o preenchimento da sessão nova). */
export async function seriesFeitas(userId: string, desde?: ChaveDia): Promise<SerieFeita[]> {
  const linhas = await db.workoutSet.findMany({
    where: { activity: { userId, kind: "musculacao", ...(desde ? { day: { gte: chaveParaData(desde) } } : {}) } },
    select: { exercise: true, setIndex: true, reps: true, loadKg: true, activity: { select: { id: true, day: true } } },
  });
  return linhas.map((s) => ({
    dia: dataParaChave(s.activity.day),
    sessaoId: s.activity.id,
    exercicio: s.exercise,
    serie: s.setIndex,
    reps: s.reps,
    carga: s.loadKg,
  }));
}

/** Atividades (resumo) e recuperação das últimas 5 semanas: base dos alertas. */
export async function baseDosAlertas(userId: string, hojeK: ChaveDia) {
  const de = somaDias(hojeK, -34);
  const [ativs, recs] = await Promise.all([
    db.activity.findMany({
      where: { userId, day: { gte: chaveParaData(de), lte: chaveParaData(hojeK) } },
      select: { day: true, kind: true, durationMin: true, effort: true },
    }),
    carregarRecuperacao(userId, de, hojeK),
  ]);
  // A data da primeira atividade de todas: o alerta de carga só compara com 3 semanas inteiras de histórico.
  const primeira = await db.activity.findFirst({ where: { userId }, orderBy: { day: "asc" }, select: { day: true, kind: true, durationMin: true, effort: true } });
  const resumo = ativs.map(resumoDe);
  if (primeira && dataParaChave(primeira.day) < de) resumo.push({ ...resumoDe(primeira), duracao: 0 });
  const recup = recs.map(recuperacaoDe);
  return { resumo, recup, alertas: alertasRecuperacao(resumo, recup, hojeK), carga: cargaSemanal(resumo, hojeK) };
}

// ───────────── Integração (painel, Registrar, insights, exportação) ─────────────

export async function dadosRegistroRapidoTreinos(user: User, hojeK: ChaveDia) {
  const fichas = await db.workoutPlan.findMany({
    where: { userId: user.id, archived: false },
    select: { id: true, name: true },
    orderBy: [{ favorite: "desc" }, { position: "asc" }, { createdAt: "asc" }],
  });
  return { hoje: hojeK, fichas: fichas.map((f) => ({ id: f.id, nome: f.name })) };
}

export async function insightsTreinos(user: User, hojeK: ChaveDia): Promise<Insight[]> {
  const { alertas, resumo } = await baseDosAlertas(user.id, hojeK);
  const r: Insight[] = alertas
    .filter((a) => a.id !== "equilibrio")
    .slice(0, 2)
    .map((a) => ({ tom: "atencao" as const, texto: a.texto }));
  if (r.length < 2) {
    const semana = minutosPorTipo(resumo, somaDias(hojeK, -6), hojeK);
    const total = semana.musculacao + semana.cardio + semana.futebol;
    const eq = alertas.find((a) => a.id === "equilibrio");
    if (eq) r.push({ tom: "positivo", texto: eq.texto });
    else if (total > 0 && r.length === 0) r.push({ tom: "neutro", texto: `${total} min de atividade nos últimos 7 dias.` });
  }
  return r.slice(0, 2);
}

export async function exportarTreinos(userId: string) {
  const [fichas, atividades, recuperacao] = await Promise.all([
    db.workoutPlan.findMany({ where: { userId }, include: { exercises: { orderBy: { position: "asc" } } }, orderBy: { position: "asc" } }),
    db.activity.findMany({ where: { userId }, include: { sets: { orderBy: [{ exercise: "asc" }, { setIndex: "asc" }] } }, orderBy: [{ day: "asc" }, { at: "asc" }] }),
    db.recoveryLog.findMany({ where: { userId }, orderBy: { day: "asc" } }),
  ]);
  return {
    fichas: fichas.map(({ userId: _u, ...f }) => ({ ...f, exercises: f.exercises.map(({ planId: _p, ...e }) => e) })),
    atividades: atividades.map(({ userId: _u, ...a }) => ({
      ...a,
      day: dataParaChave(a.day),
      tipo: nomeSubtipo(a.kind, a.subtype),
      carga: cargaSessao(a.durationMin, a.effort),
      sets: a.sets.map(({ activityId: _a, ...s }) => s),
    })),
    recuperacao: recuperacao.map(({ userId: _u, ...r }) => ({ ...r, day: dataParaChave(r.day) })),
  };
}
