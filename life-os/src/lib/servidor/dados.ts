// Leituras do banco usadas por várias telas (painel, água, hábitos, agenda).
import { db } from "@/lib/db";
import type { Habit, User } from "@/generated/prisma/client";
import {
  type ChaveDia,
  chaveNoFuso as chaveDoInstante,
  chaveParaData,
  horaNoFuso,
  dataParaChave,
  intervaloDeDias,
  minutosNoFuso,
  partesNoFuso,
  somaDias,
} from "@/lib/datas";
import { resumoPorDia, type RegistroAgua } from "@/lib/agua";
import {
  type DefHabito,
  type Registros,
  melhorSequencia,
  progressoSemana,
  sequenciaAtual,
  statusDoDia,
  taxaConclusao,
  totalConclusoes,
  type Sequencia,
  type StatusDia,
  type Taxa,
} from "@/lib/habitos";
import { ocorrencias, type Ocorrencia } from "@/lib/recorrencia";

// ───────────── Água ─────────────

/** Configuração da água (criada com o padrão na primeira leitura; tolera leituras simultâneas — ver configSono). */
export async function configAgua(userId: string) {
  const atual = await db.waterSettings.findUnique({ where: { userId } });
  if (atual) return atual;
  await db.waterSettings.createMany({ data: [{ userId }], skipDuplicates: true });
  return db.waterSettings.findUniqueOrThrow({ where: { userId } });
}

export async function aguaDoPeriodo(user: User, de: ChaveDia, ate: ChaveDia) {
  const [cfg, entradas, dias] = await Promise.all([
    configAgua(user.id),
    db.waterEntry.findMany({
      where: { userId: user.id, day: { gte: chaveParaData(de), lte: chaveParaData(ate) } },
      orderBy: { at: "asc" },
    }),
    db.waterDay.findMany({ where: { userId: user.id, day: { gte: chaveParaData(de), lte: chaveParaData(ate) } } }),
  ]);
  const metas = new Map(dias.map((d) => [dataParaChave(d.day), d]));
  const registros: (RegistroAgua & { id: string; at: Date; kind: string })[] = entradas.map((e) => ({
    id: e.id,
    at: e.at,
    kind: e.kind,
    day: dataParaChave(e.day),
    hora: partesNoFuso(e.at, user.timezone).hora,
    amountMl: e.amountMl,
    beverage: e.beverage,
  }));
  const resumo = resumoPorDia(
    registros,
    intervaloDeDias(de, ate),
    (d) => metas.get(d)?.goalMl ?? cfg.goalMl,
    (d) => metas.get(d)?.trainingDay ?? false,
  );
  return { cfg, registros, resumo };
}

// ───────────── Hábitos ─────────────

export interface HabitoCompleto {
  habito: Habit;
  def: DefHabito;
  regs: Registros;
  hoje: { status: StatusDia; count: number; skipped: boolean };
  sequencia: Sequencia;
  melhor: Sequencia;
  taxa7: Taxa;
  taxa30: Taxa;
  semana: { feitos: number; meta: number } | null;
  total: number;
  /** status dos últimos 7 dias (do mais antigo para hoje) */
  ultimos7: { dia: ChaveDia; status: StatusDia }[];
}

export function defDe(h: Habit): DefHabito {
  return {
    frequency: h.frequency,
    weekdays: h.weekdays,
    timesPerWeek: h.timesPerWeek,
    targetPerDay: h.source === "agua" ? 1 : h.targetPerDay,
    startDay: dataParaChave(h.startDay),
  };
}

/** Registros "virtuais" do hábito ligado à água: feito no dia em que a meta foi batida. */
async function registrosDaAgua(user: User, de: ChaveDia, hoje: ChaveDia): Promise<Registros> {
  const { resumo } = await aguaDoPeriodo(user, de, hoje);
  return new Map(resumo.filter((d) => d.bateu).map((d) => [d.dia, { count: 1, skipped: false }]));
}

export async function carregarHabitos(
  user: User,
  hoje: ChaveDia,
  opcoes: { incluirArquivados?: boolean; id?: string; dias?: number } = {},
): Promise<HabitoCompleto[]> {
  const de = somaDias(hoje, -(opcoes.dias ?? 400));
  const habitos = await db.habit.findMany({
    where: { userId: user.id, ...(opcoes.incluirArquivados ? {} : { archived: false }), ...(opcoes.id ? { id: opcoes.id } : {}) },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: { logs: { where: { day: { gte: chaveParaData(de) } } } },
  });
  const precisaAgua = habitos.some((h) => h.source === "agua");
  const regsAgua = precisaAgua ? await registrosDaAgua(user, de, hoje) : new Map();

  return habitos.map(({ logs, ...h }) => {
    const def = defDe(h);
    const regs: Registros =
      h.source === "agua" ? regsAgua : new Map(logs.map((l) => [dataParaChave(l.day), { count: l.count, skipped: l.skipped }]));
    const r = regs.get(hoje);
    return {
      habito: h,
      def,
      regs,
      hoje: { status: statusDoDia(def, r, hoje), count: r?.count ?? 0, skipped: r?.skipped ?? false },
      sequencia: sequenciaAtual(def, regs, hoje),
      melhor: melhorSequencia(def, regs, hoje),
      taxa7: taxaConclusao(def, regs, somaDias(hoje, -6), hoje, hoje),
      taxa30: taxaConclusao(def, regs, somaDias(hoje, -29), hoje, hoje),
      semana: h.frequency === "semanal" ? progressoSemana(def, regs, hoje) : null,
      total: totalConclusoes(def, regs),
      ultimos7: intervaloDeDias(somaDias(hoje, -6), hoje).map((d) => ({ dia: d, status: statusDoDia(def, regs.get(d), d) })),
    };
  });
}

// ───────────── Agenda ─────────────

export interface ItemAgenda {
  tipo: "evento" | "tarefa";
  id: string;
  titulo: string;
  categoria: string;
  dia: ChaveDia;
  diaFim: ChaveDia;
  diaInteiro: boolean;
  inicio: Date;
  fim: Date | null;
  local?: string | null;
  notas?: string | null;
  recorrencia?: string;
  concluida?: boolean;
  duracaoMin?: number;
  prioridade?: number;
  /** Valores para o formulário de edição (do evento original, não da ocorrência). */
  edicao: Record<string, string | number | boolean | undefined>;
}

export async function carregarAgenda(user: User, de: ChaveDia, ate: ChaveDia) {
  const tz = user.timezone;
  // Eventos que podem ter ocorrências no intervalo: os que começam até o fim do intervalo
  // (os repetidos podem ter começado muito antes).
  const [eventos, tarefasNoPeriodo] = await Promise.all([
    db.calendarEvent.findMany({
      where: {
        userId: user.id,
        start: { lte: new Date(chaveParaData(somaDias(ate, 2)).getTime()) },
        OR: [
          { recurrence: { not: "nenhuma" } },
          { start: { gte: new Date(chaveParaData(somaDias(de, -60)).getTime()) } },
        ],
      },
    }),
    db.task.findMany({
      where: {
        userId: user.id,
        scheduledStart: { gte: new Date(chaveParaData(somaDias(de, -1)).getTime()), lte: new Date(chaveParaData(somaDias(ate, 2)).getTime()) },
      },
    }),
  ]);

  const itens: ItemAgenda[] = [];
  for (const ev of eventos) {
    const baseDia = ev.allDay ? dataParaChave(ev.start) : chaveDoInstante(ev.start, tz);
    const edicao = {
      dia: baseDia,
      diaFim: ev.end ? (ev.allDay ? dataParaChave(ev.end) : chaveDoInstante(ev.end, tz)) : undefined,
      diaInteiro: ev.allDay,
      inicio: ev.allDay ? undefined : horaNoFuso(ev.start, tz),
      fim: ev.end && !ev.allDay ? horaNoFuso(ev.end, tz) : undefined,
      repetirAte: ev.recurrenceUntil ? dataParaChave(ev.recurrenceUntil) : undefined,
    };
    for (const o of ocorrencias(ev, de, ate, tz) as Ocorrencia[]) {
      itens.push({
        tipo: "evento",
        id: ev.id,
        titulo: ev.title,
        categoria: ev.category,
        dia: o.dia,
        diaFim: o.diaFim,
        diaInteiro: ev.allDay,
        inicio: o.inicio,
        fim: o.fim,
        local: ev.location,
        notas: ev.notes,
        recorrencia: ev.recurrence,
        edicao,
      });
    }
  }
  for (const t of tarefasNoPeriodo) {
    const ini = t.scheduledStart!;
    const p = partesNoFuso(ini, tz);
    const dia = `${p.ano}-${String(p.mes).padStart(2, "0")}-${String(p.dia).padStart(2, "0")}`;
    if (dia < de || dia > ate) continue;
    itens.push({
      tipo: "tarefa",
      id: t.id,
      titulo: t.title,
      categoria: "tarefa",
      dia,
      diaFim: dia,
      diaInteiro: false,
      inicio: ini,
      fim: new Date(ini.getTime() + t.durationMin * 60_000),
      notas: t.notes,
      concluida: t.done,
      duracaoMin: t.durationMin,
      prioridade: t.priority,
      edicao: { prazo: t.dueDay ? dataParaChave(t.dueDay) : undefined, dia, hora: horaNoFuso(ini, tz) },
    });
  }
  itens.sort((a, b) => {
    if (a.diaInteiro !== b.diaInteiro) return a.diaInteiro ? -1 : 1;
    return a.inicio.getTime() - b.inicio.getTime();
  });
  return itens;
}

/** Itens que ocupam o dia `dia` (inclui eventos de vários dias). */
export function itensDoDia(itens: ItemAgenda[], dia: ChaveDia): ItemAgenda[] {
  return itens.filter((i) => i.dia <= dia && i.diaFim >= dia);
}

/** Minutos ocupados de um dia, para o planejador (eventos com hora; dia inteiro não bloqueia). */
export function ocupadosDoDia(itens: ItemAgenda[], dia: ChaveDia, tz: string): { inicio: number; fim: number }[] {
  return itensDoDia(itens, dia)
    .filter((i) => !i.diaInteiro && !(i.tipo === "tarefa" && i.concluida))
    .map((i) => {
      const ini = i.dia < dia ? 0 : minutosNoFuso(i.inicio, tz);
      const fimDia = i.fim ? (i.diaFim > dia ? 1440 : minutosNoFuso(i.fim, tz) || 1440) : ini + 30;
      return { inicio: ini, fim: Math.max(ini + 5, fimDia) };
    });
}
