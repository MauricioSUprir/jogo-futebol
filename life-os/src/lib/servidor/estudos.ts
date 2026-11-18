// STUDY CENTER — leituras do banco (página, painel, insights, exportação e registro rápido).
import { db } from "@/lib/db";
import type { User } from "@/generated/prisma/client";
import { chaveNoFuso, chaveParaData, dataParaChave, diaDaSemana, diasEntre, inicioDaSemana, somaDias, type ChaveDia } from "@/lib/datas";
import { lerPref } from "./prefs";
import { configPomodoro, contagem, formatarMinutos, pct, type ConfigPomodoro } from "@/lib/estudos";
import type { Insight } from "@/lib/insights";

export interface PrefsEstudos extends ConfigPomodoro {
  metaTotal: number | null;
}

export function prefsEstudos(user: Pick<User, "prefs">): PrefsEstudos {
  const p = lerPref<PrefsEstudos>(user, "estudos");
  const m = Number(p.metaTotal);
  return { ...configPomodoro(p), metaTotal: p.metaTotal === null || p.metaTotal === undefined || !Number.isFinite(m) ? null : m };
}

export interface ProvaItem {
  id: string;
  titulo: string;
  tipo: "prova" | "trabalho";
  materiaId: string | null;
  materiaNome: string | null;
  materiaCor: string | null;
  dia: ChaveDia;
  diaInteiro: boolean;
  inicio: Date;
  fim: Date | null;
  notas: string | null;
  checklist: { id: string; texto: string; feito: boolean }[];
}

/** Provas e trabalhos (eventos da agenda) a partir de `de`. */
export async function provasETrabalhos(user: User, de: ChaveDia, ate?: ChaveDia): Promise<ProvaItem[]> {
  const tz = user.timezone;
  const eventos = await db.calendarEvent.findMany({
    where: {
      userId: user.id,
      category: { in: ["prova", "trabalho"] },
      start: { gte: chaveParaData(somaDias(de, -1)), ...(ate ? { lte: chaveParaData(somaDias(ate, 2)) } : {}) },
    },
    include: { subject: { select: { name: true, color: true } } },
    orderBy: { start: "asc" },
  });
  const ids = eventos.map((e) => e.id);
  const itens = ids.length
    ? await db.checklistItem.findMany({ where: { userId: user.id, eventId: { in: ids } }, orderBy: { position: "asc" } })
    : [];
  return eventos
    .map((e) => ({
      id: e.id,
      titulo: e.title,
      tipo: (e.category === "trabalho" ? "trabalho" : "prova") as "prova" | "trabalho",
      materiaId: e.subjectId,
      materiaNome: e.subject?.name ?? null,
      materiaCor: e.subject?.color ?? null,
      dia: e.allDay ? dataParaChave(e.start) : chaveNoFuso(e.start, tz),
      diaInteiro: e.allDay,
      inicio: e.start,
      fim: e.end,
      notas: e.notes,
      checklist: itens.filter((i) => i.eventId === e.id).map((i) => ({ id: i.id, texto: i.text, feito: i.done })),
    }))
    .filter((p) => p.dia >= de && (!ate || p.dia <= ate));
}

/** Resumo para o painel e os insights. */
export async function resumoEstudos(user: User, hojeK: ChaveDia) {
  const ini = inicioDaSemana(hojeK);
  const [materias, minutos, topicos, cartoes, provas, recentes] = await Promise.all([
    db.subject.findMany({ where: { userId: user.id, archived: false }, select: { id: true, weeklyGoalMin: true } }),
    db.studySession.aggregate({ where: { userId: user.id, day: { gte: chaveParaData(ini), lte: chaveParaData(hojeK) } }, _sum: { durationMin: true } }),
    db.studyTopic.count({ where: { userId: user.id, status: "concluido", nextReview: { lte: chaveParaData(hojeK) } } }),
    db.flashcard.count({ where: { userId: user.id, due: { lte: chaveParaData(hojeK) } } }),
    provasETrabalhos(user, hojeK, somaDias(hojeK, 30)),
    db.studySession.count({ where: { userId: user.id, day: { gte: chaveParaData(somaDias(hojeK, -13)) } } }),
  ]);
  const p = prefsEstudos(user);
  const metaSemana = p.metaTotal ?? materias.reduce((s, m) => s + m.weeklyGoalMin, 0);
  const proxima = provas.find((x) => x.tipo === "prova") ?? null;
  return {
    materias: materias.length,
    minutosSemana: minutos._sum.durationMin ?? 0,
    metaSemana,
    revisoesHoje: topicos,
    cartoesHoje: cartoes,
    proximaProva: proxima,
    proximasProvas: provas,
    sessoesRecentes: recentes,
  };
}

export async function insightsEstudos(user: User, hojeK: ChaveDia): Promise<Insight[]> {
  const r = await resumoEstudos(user, hojeK);
  const lista: Insight[] = [];
  const prova = r.proximasProvas.find((p) => p.tipo === "prova" && diasEntre(hojeK, p.dia) <= 7);
  if (prova) {
    const n = diasEntre(hojeK, prova.dia);
    const pendentes = prova.checklist.filter((c) => !c.feito).length;
    lista.push({
      tom: pendentes ? "atencao" : "positivo",
      texto: `Prova "${prova.titulo}" ${contagem(n)}${pendentes ? `: ${pendentes} ${pendentes === 1 ? "item" : "itens"} do checklist por fazer.` : ": checklist completo."}`,
    });
  }
  // Ritmo da semana: só com estudo registrado nas últimas 2 semanas (dados suficientes).
  if (r.metaSemana > 0 && r.sessoesRecentes >= 3) {
    const diasPassados = ((diaDaSemana(hojeK) + 6) % 7) + 1; // seg = 1 … dom = 7
    const esperado = (r.metaSemana * diasPassados) / 7;
    lista.push({
      tom: r.minutosSemana >= esperado ? "positivo" : "neutro",
      texto: `Você estudou ${formatarMinutos(r.minutosSemana)} nesta semana (${pct(r.minutosSemana, r.metaSemana)}% da meta semanal).`,
    });
  }
  const revisoes = r.revisoesHoje + r.cartoesHoje;
  if (revisoes > 0 && lista.length < 2) {
    lista.push({ tom: "neutro", texto: `${revisoes} ${revisoes === 1 ? "revisão programada" : "revisões programadas"} para hoje no Study Center.` });
  }
  return lista.slice(0, 2);
}

export async function dadosRegistroRapidoEstudos(user: User, hojeK: ChaveDia) {
  const materias = await db.subject.findMany({ where: { userId: user.id, archived: false }, orderBy: { position: "asc" }, select: { id: true, name: true } });
  return { hoje: hojeK, materias: materias.map((m) => ({ id: m.id, nome: m.name })) };
}

export async function exportarEstudos(userId: string) {
  const [materias, sessoes, conteudos, flashcards, notas, resumos, simulados, checklist, provas] = await Promise.all([
    db.subject.findMany({ where: { userId }, orderBy: { position: "asc" } }),
    db.studySession.findMany({ where: { userId }, orderBy: { at: "asc" } }),
    db.studyTopic.findMany({ where: { userId }, orderBy: [{ subjectId: "asc" }, { position: "asc" }] }),
    db.flashcard.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    db.grade.findMany({ where: { userId }, orderBy: { day: "asc" } }),
    db.studyNote.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    db.quizResult.findMany({ where: { userId }, orderBy: { day: "asc" } }),
    db.checklistItem.findMany({ where: { userId }, orderBy: [{ eventId: "asc" }, { position: "asc" }] }),
    db.calendarEvent.findMany({ where: { userId, category: { in: ["prova", "trabalho"] } }, orderBy: { start: "asc" } }),
  ]);
  return { materias, sessoes, conteudos, flashcards, notas, resumos, simulados, provasETrabalhos: provas, checklistDasProvas: checklist };
}

/** Tudo o que a página do Study Center usa (dados de uma pessoa só: poucas centenas de linhas). */
export async function carregarEstudos(user: User, hojeK: ChaveDia) {
  const ini = inicioDaSemana(hojeK);
  const [materias, arquivadas, sessoes14, ultimas, conteudos, cartoes, notas, simulados, resumos, provas, provasPassadas] = await Promise.all([
    db.subject.findMany({ where: { userId: user.id, archived: false }, orderBy: { position: "asc" } }),
    db.subject.findMany({ where: { userId: user.id, archived: true }, orderBy: { name: "asc" } }),
    db.studySession.findMany({
      where: { userId: user.id, day: { gte: chaveParaData(somaDias(ini, -7)) } },
      include: { subject: { select: { name: true } } },
      orderBy: { at: "desc" },
    }),
    db.studySession.findMany({ where: { userId: user.id }, distinct: ["subjectId"], orderBy: { at: "desc" }, select: { subjectId: true, day: true, kind: true } }),
    db.studyTopic.findMany({ where: { userId: user.id }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    db.flashcard.findMany({ where: { userId: user.id }, include: { subject: { select: { name: true } } }, orderBy: { due: "asc" } }),
    db.grade.findMany({ where: { userId: user.id }, orderBy: { day: "asc" } }),
    db.quizResult.findMany({ where: { userId: user.id }, include: { subject: { select: { name: true } } }, orderBy: { day: "asc" } }),
    db.studyNote.findMany({ where: { userId: user.id }, include: { subject: { select: { name: true } } }, orderBy: { updatedAt: "desc" } }),
    provasETrabalhos(user, hojeK),
    provasETrabalhos(user, somaDias(hojeK, -30), somaDias(hojeK, -1)),
  ]);
  const prefs = prefsEstudos(user);
  const daSemana = sessoes14.filter((s) => dataParaChave(s.day) >= ini);
  const minPorMateria = new Map<string | null, number>();
  for (const s of daSemana) minPorMateria.set(s.subjectId, (minPorMateria.get(s.subjectId) ?? 0) + s.durationMin);
  const somaMetas = materias.reduce((s, m) => s + m.weeklyGoalMin, 0);
  return {
    prefs,
    inicioSemana: ini,
    materias,
    arquivadas,
    sessoes: sessoes14,
    sessoesSemana: daSemana,
    minutosSemana: daSemana.reduce((s, x) => s + x.durationMin, 0),
    minPorMateria,
    metaSemana: prefs.metaTotal ?? somaMetas,
    somaMetas,
    ultimaPorMateria: new Map(ultimas.map((u) => [u.subjectId, { dia: dataParaChave(u.day), tipo: u.kind }])),
    conteudos,
    revisoesHoje: conteudos.filter((c) => c.status === "concluido" && c.nextReview && dataParaChave(c.nextReview) <= hojeK),
    cartoes,
    cartoesHoje: cartoes.filter((c) => dataParaChave(c.due) <= hojeK),
    notas,
    simulados,
    resumos,
    provas,
    provasPassadas,
  };
}

export type DadosEstudos = Awaited<ReturnType<typeof carregarEstudos>>;
