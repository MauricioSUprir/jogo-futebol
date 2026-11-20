// Leituras do Health Center (página, painel, insights e exportação).
import { db } from "@/lib/db";
import type { User } from "@/generated/prisma/client";
import { chaveParaData, dataParaChave, horaNoFuso, intervaloDeDias, somaDias, type ChaveDia } from "@/lib/datas";
import type { Insight } from "@/lib/insights";
import { umaCasa } from "@/lib/checkin";
import { energiaEAtividade, lerContatos, nomeAtividade, type DiaDiario, type TipoSaude } from "@/lib/saude";
import { duracaoMin } from "@/lib/sono";
import { checkinsDoPeriodo } from "./checkin";

export interface RegistroSaude {
  id: string;
  tipo: TipoSaude;
  titulo: string;
  dia: ChaveDia;
  hora: string | null;
  diaFim: ChaveDia | null;
  profissional: string | null;
  detalhes: string | null;
  dose: string | null;
  proximo: ChaveDia | null;
  intensidade: number | null;
  parteCorpo: string | null;
  status: string;
  temEvento: boolean;
  documentos: { id: string; nome: string; tamanho: number; mime: string }[];
}

export async function registrosSaude(user: User, tipos?: TipoSaude[]): Promise<RegistroSaude[]> {
  const linhas = await db.healthRecord.findMany({
    where: { userId: user.id, ...(tipos ? { type: { in: tipos } } : {}) },
    orderBy: [{ day: "desc" }, { createdAt: "desc" }],
    include: { files: { select: { id: true, name: true, size: true, mime: true }, orderBy: { createdAt: "asc" } } },
  });
  return linhas.map((r) => ({
    id: r.id,
    tipo: r.type as TipoSaude,
    titulo: r.title,
    dia: dataParaChave(r.day),
    hora: r.at ? horaNoFuso(r.at, user.timezone) : null,
    diaFim: r.endDay ? dataParaChave(r.endDay) : null,
    profissional: r.professional,
    detalhes: r.details,
    dose: r.dose,
    proximo: r.nextDay ? dataParaChave(r.nextDay) : null,
    intensidade: r.severity,
    parteCorpo: r.bodyPart,
    status: r.status,
    temEvento: !!r.eventId,
    documentos: r.files.map((f) => ({ id: f.id, nome: f.name, tamanho: f.size, mime: f.mime })),
  }));
}

export async function emergencia(userId: string) {
  const e = await db.emergencyInfo.findUnique({ where: { userId } });
  return {
    sangue: e?.bloodType ?? null,
    alergias: e?.allergies ?? null,
    condicoes: e?.conditions ?? null,
    medicamentos: e?.medications ?? null,
    plano: e?.insurance ?? null,
    observacoes: e?.notes ?? null,
    contatos: lerContatos(e?.contacts),
    existe: !!e,
  };
}

/** Os dias do diário de saúde (check-in + sono da noite + atividades do dia), do mais recente ao mais antigo. */
export async function diasDoDiario(user: User, de: ChaveDia, ate: ChaveDia): Promise<DiaDiario[]> {
  const [checkins, noites, atividades] = await Promise.all([
    checkinsDoPeriodo(user.id, de, ate),
    db.sleepLog.findMany({ where: { userId: user.id, day: { gte: chaveParaData(de), lte: chaveParaData(ate) } } }),
    db.activity.findMany({
      where: { userId: user.id, day: { gte: chaveParaData(de), lte: chaveParaData(ate) } },
      select: { day: true, kind: true, subtype: true },
      orderBy: { day: "asc" },
    }),
  ]);
  const sono = new Map(noites.map((n) => [dataParaChave(n.day), duracaoMin({ deitou: n.bedtime, acordou: n.wakeTime, latenciaMin: n.latencyMin })]));
  const ativ = new Map<ChaveDia, string[]>();
  for (const a of atividades) {
    const k = dataParaChave(a.day);
    const nome = nomeAtividade(a.kind, a.subtype);
    const lista = ativ.get(k) ?? [];
    if (!lista.includes(nome)) lista.push(nome);
    ativ.set(k, lista);
  }
  return intervaloDeDias(de, ate)
    .reverse()
    .map((dia) => ({ dia, checkin: checkins.get(dia) ?? null, sonoMin: sono.get(dia) ?? null, atividades: ativ.get(dia) ?? [] }));
}

/** Números do cartão do painel e do Resumo. */
export async function resumoSaude(user: User, hojeK: ChaveDia) {
  const agora = new Date();
  const [consultas, doses, ativos, checkin] = await Promise.all([
    db.healthRecord.findMany({
      where: {
        userId: user.id,
        type: "consulta",
        OR: [{ at: { gte: agora } }, { at: null, day: { gte: chaveParaData(hojeK) } }],
      },
      orderBy: [{ day: "asc" }, { at: "asc" }],
      take: 3,
    }),
    db.healthRecord.findMany({
      where: { userId: user.id, type: "vacina", nextDay: { gte: chaveParaData(hojeK) } },
      orderBy: { nextDay: "asc" },
      take: 3,
    }),
    db.healthRecord.count({ where: { userId: user.id, type: "medicamento", status: "ativo" } }),
    db.dailyCheckin.findUnique({ where: { userId_day: { userId: user.id, day: chaveParaData(hojeK) } } }),
  ]);
  return {
    consultas: consultas.map((c) => ({ id: c.id, titulo: c.title, dia: dataParaChave(c.day), hora: c.at ? horaNoFuso(c.at, user.timezone) : null })),
    doses: doses.map((v) => ({ id: v.id, titulo: v.title, dose: v.dose, dia: dataParaChave(v.nextDay!) })),
    medicamentosAtivos: ativos,
    checkinHoje: checkin ? { energia: checkin.energy, disposicao: checkin.disposition } : null,
  };
}

/** Até 2 frases do Health Center: compromissos próximos e energia × atividade (padrões, nunca diagnóstico). */
export async function insightsSaude(user: User, hojeK: ChaveDia): Promise<Insight[]> {
  const r: Insight[] = [];
  const res = await resumoSaude(user, hojeK);
  const prox = res.consultas[0];
  if (prox) {
    const quando = prox.dia === hojeK ? "hoje" : prox.dia === somaDias(hojeK, 1) ? "amanhã" : null;
    if (quando) r.push({ tom: "neutro", texto: `Consulta ${quando}${prox.hora ? ` às ${prox.hora}` : ""}: ${prox.titulo}.` });
  }
  const dias = await diasDoDiario(user, somaDias(hojeK, -27), hojeK);
  const e = energiaEAtividade(dias);
  if (e && Math.abs(e.diferenca) >= 0.5) {
    r.push({
      tom: "neutro",
      texto: `Nos seus registros, a energia nos dias com atividade física ficou em ${umaCasa(e.a)}, e nos outros dias em ${umaCasa(e.b)}.`,
    });
  }
  const dose = res.doses[0];
  if (r.length < 2 && dose && dose.dia <= somaDias(hojeK, 14)) {
    r.push({ tom: "neutro", texto: `Próxima dose de ${dose.titulo} marcada para ${dose.dia.split("-").reverse().join("/")}.` });
  }
  return r.slice(0, 2);
}

/** Tudo do Health Center para a exportação completa (os documentos vão só com nome e tamanho, sem o conteúdo). */
export async function exportarSaude(userId: string) {
  const [registros, emerg, checkins] = await Promise.all([
    db.healthRecord.findMany({
      where: { userId },
      orderBy: { day: "asc" },
      include: { files: { select: { name: true, mime: true, size: true, createdAt: true } } },
    }),
    db.emergencyInfo.findUnique({ where: { userId } }),
    db.dailyCheckin.findMany({ where: { userId }, orderBy: { day: "asc" } }),
  ]);
  return {
    registros: registros.map((r) => ({
      tipo: r.type,
      titulo: r.title,
      dia: dataParaChave(r.day),
      horario: r.at?.toISOString() ?? null,
      fim: r.endDay ? dataParaChave(r.endDay) : null,
      profissional: r.professional,
      detalhes: r.details,
      dose: r.dose,
      proximo: r.nextDay ? dataParaChave(r.nextDay) : null,
      intensidade: r.severity,
      parteDoCorpo: r.bodyPart,
      situacao: r.status,
      documentos: r.files.map((f) => ({ nome: f.name, tipo: f.mime, bytes: f.size, enviadoEm: f.createdAt.toISOString() })),
    })),
    emergencia: emerg && {
      tipoSanguineo: emerg.bloodType,
      alergias: emerg.allergies,
      condicoes: emerg.conditions,
      medicamentos: emerg.medications,
      contatos: lerContatos(emerg.contacts),
      planoDeSaude: emerg.insurance,
      observacoes: emerg.notes,
    },
    checkins: checkins.map((c) => ({
      dia: dataParaChave(c.day),
      energia: c.energy,
      humor: c.mood,
      estresse: c.stress,
      disposicao: c.disposition,
      emocoes: c.emotions,
      observacoes: c.notes,
    })),
  };
}
