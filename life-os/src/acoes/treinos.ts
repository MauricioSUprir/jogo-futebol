"use server";
// FITNESS CENTER: fichas de treino, atividades (musculação, cardio, futebol) e recuperação.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { configAgua } from "@/lib/servidor/dados";
import { chaveParaData, diasEntre, hoje, localParaUtc, validaChave, validaHora } from "@/lib/datas";
import { GRUPOS_MUSCULARES, POSICOES, TIPOS_CARDIO, TIPOS_FUTEBOL, mascaraDias } from "@/lib/treinos";
import type { Estado } from "./tipos";

function revalidar() {
  for (const p of ["/", "/treinos", "/agua", "/saude"]) revalidatePath(p);
}

const texto = (max: number, msg?: string) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined), z.string().max(max, msg).optional());
const numero = (min: number, max: number, msg: string, inteiro = true) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(String(v).replace(",", "."))),
    (inteiro ? z.number().int(msg) : z.number()).min(min, msg).max(max, msg).nullable(),
  );
const grupo = z.preprocess((v) => (typeof v === "string" && v in GRUPOS_MUSCULARES ? v : "outro"), z.string());

// ───────────── Fichas ─────────────

const esquemaExercicio = z.object({
  nome: z.string().trim().min(1, "Dê nome a todos os exercícios.").max(80, "Nome de exercício: até 80 caracteres."),
  grupo,
  series: numero(1, 20, "Séries: de 1 a 20.").transform((v) => v ?? 3),
  reps: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : "10"), z.string().max(20, "Repetições: até 20 caracteres.")),
  carga: numero(0, 1000, "Carga: de 0 a 1.000 kg.", false),
  descanso: numero(0, 900, "Intervalo: de 0 a 900 s.").transform((v) => v ?? 60),
  obs: texto(200, "Observação do exercício: até 200 caracteres."),
});

const esquemaFicha = z.object({
  nome: z.string().trim().min(1, "Dê um nome à ficha.").max(80, "Nome da ficha: até 80 caracteres."),
  foco: texto(80, "Foco: até 80 caracteres."),
  notas: texto(1000, "Observações: até 1.000 caracteres."),
  exercicios: z.array(esquemaExercicio).min(1, "Adicione pelo menos um exercício.").max(30, "No máximo 30 exercícios por ficha."),
});

function lerJson(v: FormDataEntryValue | null): unknown {
  try {
    return JSON.parse(String(v ?? "[]"));
  } catch {
    return null;
  }
}

export async function salvarFicha(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const r = esquemaFicha.safeParse({ nome: fd.get("nome"), foco: fd.get("foco"), notas: fd.get("notas"), exercicios: lerJson(fd.get("exercicios")) });
  if (!r.success) return { erro: r.error.issues[0].message };
  const dias = mascaraDias(fd.getAll("dias").map(Number).filter(Number.isInteger));
  const favorita = fd.get("favorita") === "on";
  const id = String(fd.get("id") ?? "");
  const exercicios = r.data.exercicios.map((e, i) => ({
    name: e.nome,
    muscleGroup: e.grupo,
    sets: e.series,
    reps: e.reps,
    loadKg: e.carga,
    restSec: e.descanso,
    notes: e.obs ?? null,
    position: i,
  }));
  const dados = { name: r.data.nome, focus: r.data.foco ?? null, notes: r.data.notas ?? null, weekdays: dias, favorite: favorita };
  if (id) {
    const ficha = await db.workoutPlan.findFirst({ where: { id, userId: user.id }, select: { id: true } });
    if (!ficha) return { erro: "Ficha não encontrada." };
    await db.$transaction([
      db.workoutPlan.update({ where: { id }, data: dados }),
      db.planExercise.deleteMany({ where: { planId: id } }),
      db.planExercise.createMany({ data: exercicios.map((e) => ({ ...e, planId: id })) }),
    ]);
  } else {
    const ultima = await db.workoutPlan.aggregate({ where: { userId: user.id }, _max: { position: true } });
    await db.workoutPlan.create({
      data: { ...dados, userId: user.id, position: (ultima._max.position ?? -1) + 1, exercises: { create: exercicios } },
    });
  }
  revalidar();
  return { ok: id ? "Ficha atualizada." : "Ficha criada." };
}

export async function alternarFavorita(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  const f = await db.workoutPlan.findFirst({ where: { id: String(fd.get("id") ?? ""), userId: user.id }, select: { id: true, favorite: true } });
  if (f) await db.workoutPlan.update({ where: { id: f.id }, data: { favorite: !f.favorite } });
  revalidar();
}

export async function arquivarFicha(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  const f = await db.workoutPlan.findFirst({ where: { id: String(fd.get("id") ?? ""), userId: user.id }, select: { id: true, archived: true } });
  if (f) await db.workoutPlan.update({ where: { id: f.id }, data: { archived: !f.archived } });
  revalidar();
}

export async function excluirFicha(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  // As sessões feitas com a ficha ficam (planId vira nulo).
  await db.workoutPlan.deleteMany({ where: { id: String(fd.get("id") ?? ""), userId: user.id } });
  revalidar();
}

export async function moverFicha(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  const id = String(fd.get("id") ?? "");
  const direcao = fd.get("direcao") === "cima" ? -1 : 1;
  const lista = await db.workoutPlan.findMany({
    where: { userId: user.id, archived: false },
    orderBy: [{ favorite: "desc" }, { position: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const i = lista.findIndex((f) => f.id === id);
  const j = i + direcao;
  if (i < 0 || j < 0 || j >= lista.length) return;
  [lista[i], lista[j]] = [lista[j], lista[i]];
  await db.$transaction(lista.map((f, k) => db.workoutPlan.update({ where: { id: f.id }, data: { position: k } })));
  revalidar();
}

// ───────────── Atividades ─────────────

const esquemaSerie = z.object({
  exercicio: z.string().trim().min(1, "Dê nome a todos os exercícios da sessão.").max(80),
  grupo,
  serie: z.number().int().min(1).max(50),
  reps: numero(0, 500, "Repetições: de 0 a 500."),
  carga: numero(0, 1000, "Carga: de 0 a 1.000 kg.", false),
});

const esquemaAtividade = z.object({
  tipo: z.enum(["musculacao", "cardio", "futebol"], { message: "Escolha o tipo de atividade." }),
  subtipo: texto(20),
  dia: z.string().refine(validaChave, "Data inválida."),
  hora: z.string().refine(validaHora, "Horário inválido.").optional(),
  duracao: numero(1, 600, "Duração: de 1 a 600 minutos.").refine((v) => v !== null, "Informe a duração."),
  esforco: numero(0, 10, "Esforço: de 0 a 10."),
  distancia: numero(0, 500, "Distância: de 0 a 500 km.", false),
  titulo: texto(80, "Título: até 80 caracteres."),
  notas: texto(2000, "Observações: até 2.000 caracteres."),
  fichaId: texto(40),
  minutos: numero(0, 200, "Minutos jogados: de 0 a 200."),
  gols: numero(0, 50, "Gols: de 0 a 50."),
  assistencias: numero(0, 50, "Assistências: de 0 a 50."),
  posicao: z.preprocess((v) => (typeof v === "string" && v in POSICOES ? v : undefined), z.string().optional()),
  time: texto(60, "Time: até 60 caracteres."),
  adversario: texto(60, "Adversário: até 60 caracteres."),
  competicao: texto(60, "Competição: até 60 caracteres."),
  placarPro: numero(0, 99, "Placar: de 0 a 99."),
  placarContra: numero(0, 99, "Placar: de 0 a 99."),
  nota: numero(1, 10, "Desempenho: de 1 a 10."),
  series: z.array(esquemaSerie).max(200, "No máximo 200 séries por sessão.").default([]),
});

/** Marca o dia como "dia de treino" no Hydro Track (cria a linha do dia com a meta atual, como a água faz). */
async function marcarDiaDeTreino(userId: string, dia: string) {
  const cfg = await configAgua(userId);
  await db.waterDay.upsert({
    where: { userId_day: { userId, day: chaveParaData(dia) } },
    create: { userId, day: chaveParaData(dia), goalMl: cfg.goalMl, trainingDay: true },
    update: { trainingDay: true },
  });
}

export async function registrarAtividade(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const campos = [
    "tipo", "subtipo", "dia", "duracao", "esforco", "distancia", "titulo", "notas", "fichaId", "minutos", "gols", "assistencias",
    "posicao", "time", "adversario", "competicao", "placarPro", "placarContra", "nota",
  ];
  const bruto: Record<string, unknown> = Object.fromEntries(campos.map((k) => [k, fd.get(k) ?? undefined]));
  const hora = String(fd.get("hora") ?? "").trim();
  if (hora) bruto.hora = hora;
  if (fd.has("series")) bruto.series = lerJson(fd.get("series"));
  const r = esquemaAtividade.safeParse(bruto);
  if (!r.success) return { erro: r.error.issues[0].message };
  const d = r.data;
  const tz = user.timezone;
  const hojeK = hoje(tz);
  if (diasEntre(d.dia, hojeK) < 0) return { erro: "Não dá para registrar atividade no futuro." };
  if (diasEntre(d.dia, hojeK) > 366) return { erro: "Só dá para registrar até um ano atrás." };
  const at = d.hora ? localParaUtc(d.dia, d.hora, tz) : null;
  if (at && at.getTime() > Date.now() + 60_000) return { erro: "Esse horário ainda não chegou." };

  let subtipo: string | null = null;
  if (d.tipo === "cardio") subtipo = d.subtipo && d.subtipo in TIPOS_CARDIO ? d.subtipo : "outro";
  if (d.tipo === "futebol") subtipo = d.subtipo && d.subtipo in TIPOS_FUTEBOL ? d.subtipo : "partida";

  let planId: string | null = null;
  if (d.tipo === "musculacao" && d.fichaId) {
    const f = await db.workoutPlan.findFirst({ where: { id: d.fichaId, userId: user.id }, select: { id: true } });
    if (!f) return { erro: "Ficha não encontrada." };
    planId = f.id;
  }
  const futebol = d.tipo === "futebol";
  const jogo = futebol && subtipo !== "treino";
  const dados = {
    day: chaveParaData(d.dia),
    at,
    kind: d.tipo,
    subtype: subtipo,
    title: d.titulo ?? null,
    planId,
    durationMin: d.duracao!,
    effort: d.esforco,
    distanceKm: d.tipo === "cardio" ? d.distancia : null,
    notes: d.notas ?? null,
    minutes: jogo ? d.minutos : null,
    goals: jogo ? d.gols : null,
    assists: jogo ? d.assistencias : null,
    position: jogo ? (d.posicao ?? null) : null,
    team: futebol ? (d.time ?? null) : null,
    opponent: jogo ? (d.adversario ?? null) : null,
    competition: jogo ? (d.competicao ?? null) : null,
    scoreFor: jogo ? d.placarPro : null,
    scoreAgainst: jogo ? d.placarContra : null,
    rating: futebol ? d.nota : null,
  };
  const series =
    d.tipo === "musculacao"
      ? d.series
          .filter((s) => s.reps !== null || s.carga !== null)
          .map((s) => ({ exercise: s.exercicio, muscleGroup: s.grupo, setIndex: s.serie, reps: s.reps, loadKg: s.carga }))
      : [];
  const id = String(fd.get("id") ?? "");
  if (id) {
    const a = await db.activity.findFirst({ where: { id, userId: user.id }, select: { id: true } });
    if (!a) return { erro: "Registro não encontrado." };
    await db.$transaction([
      db.activity.update({ where: { id }, data: dados }),
      ...(d.tipo === "musculacao" && fd.has("series")
        ? [db.workoutSet.deleteMany({ where: { activityId: id } }), db.workoutSet.createMany({ data: series.map((s) => ({ ...s, activityId: id })) })]
        : d.tipo !== "musculacao"
          ? [db.workoutSet.deleteMany({ where: { activityId: id } })]
          : []),
    ]);
  } else {
    await db.activity.create({ data: { ...dados, userId: user.id, sets: { create: series } } });
  }
  await marcarDiaDeTreino(user.id, d.dia);
  revalidar();
  const voltar = String(fd.get("voltar") ?? "");
  if (/^\/treinos(\?[\w=&%-]*)?$/.test(voltar)) redirect(voltar);
  return { ok: id ? "Atividade atualizada." : "Atividade registrada." };
}

export async function excluirAtividade(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  await db.activity.deleteMany({ where: { id: String(fd.get("id") ?? ""), userId: user.id } });
  revalidar();
}

// ───────────── Recuperação ─────────────

const esquemaRecuperacao = z.object({
  dia: z.string().refine(validaChave, "Data inválida."),
  cansaco: numero(1, 5, "Cansaço: de 1 a 5."),
  recuperacao: numero(1, 5, "Recuperação: de 1 a 5."),
  dor: numero(1, 5, "Dor muscular: de 1 a 5."),
  desconforto: texto(200, "Desconforto: até 200 caracteres."),
  local: texto(60, "Onde: até 60 caracteres."),
  notas: texto(1000, "Observações: até 1.000 caracteres."),
});

export async function salvarRecuperacao(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const r = esquemaRecuperacao.safeParse(Object.fromEntries(["dia", "cansaco", "recuperacao", "dor", "desconforto", "local", "notas"].map((k) => [k, fd.get(k) ?? undefined])));
  if (!r.success) return { erro: r.error.issues[0].message };
  const d = r.data;
  const hojeK = hoje(user.timezone);
  // Dia de descanso pode ser planejado para a semana; o resto só até hoje.
  if (diasEntre(d.dia, hojeK) < -7) return { erro: "Planeje o descanso no máximo para os próximos 7 dias." };
  if (diasEntre(d.dia, hojeK) > 60) return { erro: "Só dá para registrar até 60 dias atrás." };
  const descanso = fd.get("descanso") === "on";
  const futuro = diasEntre(d.dia, hojeK) < 0;
  const dados = {
    restDay: descanso,
    fatigue: futuro ? null : d.cansaco,
    recovery: futuro ? null : d.recuperacao,
    soreness: futuro ? null : d.dor,
    discomfort: futuro ? null : (d.desconforto ?? null),
    bodyPart: futuro ? null : (d.local ?? null),
    notes: d.notas ?? null,
  };
  if (futuro && !descanso) return { erro: "Para dias que ainda não chegaram, só dá para planejar o descanso." };
  await db.recoveryLog.upsert({
    where: { userId_day: { userId: user.id, day: chaveParaData(d.dia) } },
    create: { userId: user.id, day: chaveParaData(d.dia), ...dados },
    update: dados,
  });
  revalidar();
  return { ok: "Recuperação salva." };
}

export async function excluirRecuperacao(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  const dia = String(fd.get("dia") ?? "");
  if (!validaChave(dia)) return;
  await db.recoveryLog.deleteMany({ where: { userId: user.id, day: chaveParaData(dia) } });
  revalidar();
}
